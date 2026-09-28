import { BE, canAdmin, dbErrMsg, isOwnerEmail, registerStream, toast, usingFirebase } from "./backend.js";
import { state } from "./state.js";
import { esc, svgIcon, openSheet, closeSheet } from "./text.js";
import { avatarEl, displayName } from "./profile.js";

/* =========================================================
   ROLES - who's who in 3CS, beyond "student".

   config/people   { roles: { uid: "teacher" | "mod" }, lockedNames: { uid: true } }
   config/admins   { emails: [...] }   (unchanged: owners manage it)

     Owner    the two hard-coded accounts; everything, including roles
     Admin    everything but handing out admin
     Teacher  posts and manages news (announcements)
     Mod      keeps the public spaces tidy: deletes messages in the class
              chat, help posts and feedback, pins and locks help threads,
              and can pause someone's chat access. Not private chats.

   The rules check the same document, so the buttons here are only a
   convenience; nobody gets a power the server wouldn't also grant.
   Staff get a badge next to their name in chat, People, Help and News.
   ========================================================= */

var LABELS = { owner: "Owner", admin: "Admin", teacher: "Teacher", mod: "Mod" };
var cfg = { roles: {}, lockedNames: {} };
var adminEmails = [];
var subs = [];

function emailOf(uid){
  var d = state.directory && state.directory[uid];
  if (d && d.email) return String(d.email).toLowerCase();
  if (BE.user && BE.user.id === uid) return String(BE.user.email || "").toLowerCase();
  return "";
}
function roleOf(uid){
  if (!uid) return "";
  var e = emailOf(uid);
  if (e && isOwnerEmail(e)) return "owner";
  if (e && adminEmails.indexOf(e) > -1) return "admin";
  return (cfg.roles && cfg.roles[uid]) || "";
}
function myRole(){ return BE.user ? roleOf(BE.user.id) || (BE.isAdmin ? "admin" : "") : ""; }
function canModerate(){ return canAdmin() || myRole() === "mod"; }
function canAnnounce(){ return canAdmin() || myRole() === "teacher"; }
function nameLocked(uid){ return !!(cfg.lockedNames && cfg.lockedNames[uid]); }

function roleBadgeHtml(uid){
  var r = roleOf(uid);
  return r ? '<span class="role-badge r-' + r + '" title="' + LABELS[r] + '">' + LABELS[r] + "</span>" : "";
}
function roleBadgeEl(uid){
  var r = roleOf(uid);
  if (!r) return null;
  var s = document.createElement("span");
  s.className = "role-badge r-" + r;
  s.textContent = LABELS[r];
  return s;
}

/* show or hide the controls that belong to each role */
function paintRoleUI(){
  var ann = canAnnounce(), mod = canModerate();
  document.querySelectorAll(".announce-only").forEach(function(e){ e.hidden = !ann; });
  document.querySelectorAll(".mod-only").forEach(function(e){ e.hidden = !mod; });
  document.documentElement.classList.toggle("is-staff", ann || mod);
  window.dispatchEvent(new Event("3cs:roles"));
}

registerStream(function(db){
  if (!usingFirebase() || !BE.user) return [];
  var s1 = db.doc("config/people").onSnapshot(function(d){
    var x = d.exists ? d.data() : {};
    cfg = { roles: x.roles || {}, lockedNames: x.lockedNames || {} };
    paintRoleUI();
  }, function(){ paintRoleUI(); });
  var s2 = db.doc("config/admins").onSnapshot(function(d){
    adminEmails = ((d.exists && d.data().emails) || []).map(function(e){ return String(e).toLowerCase(); });
    BE.adminEmails = adminEmails;
    paintRoleUI();
  }, function(){});
  return [s1, s2];
}, function(){ cfg = { roles: {}, lockedNames: {} }; adminEmails = []; paintRoleUI(); });

/* ------------------------------------------------ members and roles -- */
function people(){
  var d = state.directory || {};
  return Object.keys(d).map(function(uid){ return Object.assign({ uid: uid }, d[uid]); })
    .sort(function(a, b){ return displayName(a.uid, a.name).toLowerCase() < displayName(b.uid, b.name).toLowerCase() ? -1 : 1; });
}

function setRole(uid, role){
  var up = {}; up["roles." + uid] = role ? role : firebase.firestore.FieldValue.delete();
  var ref = BE.db.doc("config/people");
  // make sure the document exists, then change just this one entry
  return ref.set({}, { merge: true }).then(function(){ return ref.update(up); });
}
function setLocked(uid, on){
  var up = {}; up["lockedNames." + uid] = on ? true : firebase.firestore.FieldValue.delete();
  return BE.db.doc("config/people").set({}, { merge: true }).then(function(){ return BE.db.doc("config/people").update(up); });
}
function setAdmin(email, on){
  var FV = firebase.firestore.FieldValue;
  return BE.db.doc("config/admins").set({ emails: on ? FV.arrayUnion(email) : FV.arrayRemove(email) }, { merge: true });
}
function rename(uid, name){
  var b = BE.db.batch(), now = new Date().toISOString();
  var prof = (state.profiles && state.profiles[uid]) || {};
  b.set(BE.db.doc("profiles/" + uid), { name: name, photo: prof.photo || "", updatedAt: now }, { merge: true });
  if (state.directory && state.directory[uid]) b.update(BE.db.doc("directory/" + uid), { name: name, updatedAt: now });
  return b.commit();
}

function openMembers(){
  if (!canAdmin()){ toast("Admins only.", true); return; }
  var owner = !!BE.isOwner;
  var box = openSheet(
    '<div class="sheet-head"><div><h2>Members and roles</h2><p class="hint">Everyone who has signed in. Teachers can post news; mods keep the class chat, Help and Feedback tidy. ' +
      (owner ? "As an owner you can also make admins." : "Only owners can make admins.") + '</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + "</button></div>" +
    '<label class="search mem-search">' + svgIcon("i-search") + '<input id="memSearch" type="search" placeholder="Search by name or email" aria-label="Search members"></label>' +
    '<div class="mem-legend"><span class="role-badge r-teacher">Teacher</span> posts news &nbsp; <span class="role-badge r-mod">Mod</span> moderates &nbsp; <span class="role-badge r-admin">Admin</span> everything</div>' +
    '<div class="mem-list" id="memList"></div>');
  box.classList.add("wide", "members-box");
  var list = box.querySelector("#memList"), q = "";
  function paint(){
    list.innerHTML = "";
    var rows = people().filter(function(p){
      if (!q) return true;
      return (displayName(p.uid, p.name) + " " + (p.email || "")).toLowerCase().indexOf(q) > -1;
    });
    if (!rows.length){ list.innerHTML = '<p class="hint">Nobody matches that.</p>'; return; }
    rows.forEach(function(p){
      var r = roleOf(p.uid), email = emailOf(p.uid), isMe = BE.user && p.uid === BE.user.id;
      var row = document.createElement("div");
      row.className = "mem-row";
      row.appendChild(avatarEl(p.uid, displayName(p.uid, p.name), "md"));
      var mid = document.createElement("div");
      mid.className = "mem-mid";
      mid.innerHTML = '<div class="mem-name"><input maxlength="40" aria-label="Name"><button class="btn ghost sm mem-save" type="button" hidden>Save</button></div>' +
        '<small></small>';
      var inp = mid.querySelector("input"), save = mid.querySelector(".mem-save");
      inp.value = displayName(p.uid, p.name);
      mid.querySelector("small").textContent = (email || "email hidden") + (nameLocked(p.uid) ? " · name locked" : "");
      inp.addEventListener("input", function(){ save.hidden = !inp.value.trim() || inp.value.trim() === displayName(p.uid, p.name); });
      inp.addEventListener("keydown", function(e){ if (e.key === "Enter") save.click(); });
      save.addEventListener("click", function(){
        var v = inp.value.trim().slice(0, 40); if (!v) return;
        save.disabled = true;
        rename(p.uid, v).then(function(){ save.hidden = true; save.disabled = false; toast("Renamed to " + v + "."); })
          .catch(function(err){ save.disabled = false; toast(dbErrMsg(err), true); });
      });
      row.appendChild(mid);

      var ctl = document.createElement("div");
      ctl.className = "mem-ctl";
      if (r === "owner"){
        ctl.innerHTML = '<span class="role-badge r-owner">Owner</span>';
      } else {
        var sel = document.createElement("select");
        sel.setAttribute("aria-label", "Role for " + displayName(p.uid, p.name));
        [["", "Student"], ["teacher", "Teacher"], ["mod", "Mod"]].concat(owner || r === "admin" ? [["admin", "Admin"]] : []).forEach(function(o){
          var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op);
        });
        sel.value = r;
        if (r === "admin" && !owner) sel.disabled = true;
        if (isMe && r === "admin") sel.disabled = true;
        sel.addEventListener("change", function(){
          var v = sel.value, was = r, jobs = [];
          if (v === "admin"){
            if (!email){ toast("They need to show their email in People before they can be an admin.", true); sel.value = was; return; }
            jobs.push(setAdmin(email, true)); jobs.push(setRole(p.uid, ""));
          } else {
            if (was === "admin") jobs.push(setAdmin(email, false));
            jobs.push(setRole(p.uid, v));
          }
          Promise.all(jobs).then(function(){
            toast(displayName(p.uid, p.name) + " is " + (v ? "now " + (v === "admin" ? "an admin" : "a " + LABELS[v].toLowerCase()) : "a student again") + ".");
          }).catch(function(err){ sel.value = was; toast(dbErrMsg(err), true); });
        });
        ctl.appendChild(sel);
        var lk = document.createElement("button");
        lk.type = "button";
        lk.className = "icon-btn flat sm" + (nameLocked(p.uid) ? " on" : "");
        lk.innerHTML = svgIcon(nameLocked(p.uid) ? "i-lock" : "i-unlock");
        lk.title = nameLocked(p.uid) ? "Name locked. They can't change it." : "Lock their name so they can't change it";
        lk.setAttribute("aria-label", lk.title);
        lk.addEventListener("click", function(){
          var lock = !nameLocked(p.uid);
          setLocked(p.uid, lock).then(function(){ toast(lock ? "Name locked. They can't change it now." : "Name unlocked."); })
            .catch(function(err){ toast(dbErrMsg(err), true); });
        });
        ctl.appendChild(lk);
      }
      row.appendChild(ctl);
      list.appendChild(row);
    });
  }
  box.querySelector("#memSearch").addEventListener("input", function(e){ q = e.target.value.trim().toLowerCase(); paint(); });
  var repaint = function(){ if (document.body.contains(list)) paint(); else window.removeEventListener("3cs:roles", repaint); };
  window.addEventListener("3cs:roles", repaint);
  paint();
}

export { roleOf, myRole, canModerate, canAnnounce, nameLocked, roleBadgeHtml, roleBadgeEl, paintRoleUI, openMembers };
