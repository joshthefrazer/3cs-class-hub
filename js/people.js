import { BE, dbErrMsg, registerStream, toast, usingFirebase, isOwnerEmail } from "./backend.js";
import { state } from "./state.js";
import { esc, svgIcon } from "./text.js";
import { avatarEl, displayName, onProfiles } from "./profile.js";
import { registerCommands } from "./palette.js";
import { openAuthSheet } from "./auth.js";
import { openDM, newGroupWith, isBlocked, setBlocked } from "./chat.js";

/* =========================================================
   PEOPLE - everyone's school email, in one place.

   directory/{uid}  { name, email, listed, lastSeen, updatedAt }

   Each person's own page writes their entry when they sign in, and the
   rules make sure the email is really theirs. Anyone can hide theirs in
   Settings; then it's stored empty. lastSeen is refreshed at most every
   ten minutes while the Hub is open, which is what the green dot and
   "active 5 min ago" come from.
   ========================================================= */

var TOUCH_EVERY = 10 * 60 * 1000;
var lastTouch = 0;
var selected = {};
var query = "";

function dir(){ return state.directory || {}; }
function people(){
  var d = dir();
  return Object.keys(d).map(function(uid){ return Object.assign({ uid: uid }, d[uid]); })
    .sort(function(a, b){
      var an = displayName(a.uid, a.name).toLowerCase(), bn = displayName(b.uid, b.name).toLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
}
function seenMs(p){
  var v = p && p.lastSeen;
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  var t = Date.parse(v); return isNaN(t) ? 0 : t;
}
function isOnline(uid){ return Date.now() - seenMs(dir()[uid]) < 15 * 60 * 1000; }
function seenText(p){
  var ms = seenMs(p);
  if (!ms) return "";
  var s = (Date.now() - ms) / 1000;
  if (s < 15 * 60) return "Active now";
  if (s < 3600) return "Active " + Math.floor(s / 60) + " min ago";
  if (s < 86400) return "Active " + Math.floor(s / 3600) + "h ago";
  var d = Math.floor(s / 86400);
  return d === 1 ? "Active yesterday" : "Active " + d + " days ago";
}
function emailOf(uid){ var p = dir()[uid]; return p && p.listed !== false && p.email ? p.email : ""; }
function myListing(){
  if (!BE.user) return null;
  var me = dir()[BE.user.id];
  if (me) return me.listed !== false;
  try{ return localStorage.getItem("3cs_listed") !== "0"; }catch(e){ return true; }
}

/* ------------------------------------------------------------- write -- */
function touchDirectory(force){
  if (!usingFirebase() || !BE.user || !BE.db) return Promise.resolve();
  if (!force && Date.now() - lastTouch < TOUCH_EVERY) return Promise.resolve();
  lastTouch = Date.now();
  var listed = myListing();
  if (listed === null) listed = true;
  var row = {
    name: displayName(BE.user.id, BE.user.name).slice(0, 40) || "Someone",
    email: listed ? BE.user.email : "",
    listed: !!listed,
    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: new Date().toISOString()
  };
  return BE.db.doc("directory/" + BE.user.id).set(row).catch(function(){ lastTouch = 0; });
}
function setListed(on){
  try{ localStorage.setItem("3cs_listed", on ? "1" : "0"); }catch(e){}
  if (!BE.user) return Promise.resolve();
  var d = state.directory = state.directory || {};
  d[BE.user.id] = Object.assign({}, d[BE.user.id] || {}, { listed: on, email: on ? BE.user.email : "" });
  renderPeople();
  return touchDirectory(true);
}

/* ------------------------------------------------------------- stream -- */
registerStream(function(db){
  if (!usingFirebase() || !BE.user) return [];
  lastTouch = 0;
  touchDirectory(true);
  return [db.collection("directory").limit(300).onSnapshot(function(qs){
    var map = {};
    qs.docs.forEach(function(d){ map[d.id] = d.data({ serverTimestamps: "estimate" }); });
    state.directory = map;
    state.directoryLoaded = true;
    renderPeople();
    listeners.forEach(function(fn){ try{ fn(); }catch(e){} });
  }, function(){ state.directoryLoaded = true; renderPeople(); })];
}, function(){ state.directory = {}; state.directoryLoaded = false; selected = {}; renderPeople(); });

var listeners = [];
function onDirectory(fn){ listeners.push(fn); }

document.addEventListener("visibilitychange", function(){ if (!document.hidden) touchDirectory(false); });
setInterval(function(){ if (!document.hidden) touchDirectory(false); }, 60 * 1000);

/* ------------------------------------------------------------ actions -- */
function copy(text, what){
  function fallback(){
    var t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try{ document.execCommand("copy"); toast(what + " copied."); }catch(e){ toast("Couldn't copy here. Select it and copy by hand.", true); }
    t.remove();
  }
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ toast(what + " copied."); }, fallback);
  } else fallback();
}
/* School accounts are Google accounts, so Gmail's compose window is the
   quickest route. It opens in a new tab with everyone already filled in. */
function composeTo(list){
  list = list.filter(Boolean);
  if (!list.length){ toast("None of those people have shared an email.", true); return; }
  var url = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(list.join(","));
  window.open(url, "_blank", "noopener");
}
function allEmails(){ return people().map(function(p){ return emailOf(p.uid); }).filter(Boolean); }

/* ------------------------------------------------------------- render -- */
function renderPeople(){
  var grid = document.getElementById("peopleGrid");
  if (!grid) return;
  var empty = document.getElementById("peopleEmpty");
  var count = document.getElementById("peopleCount");
  grid.innerHTML = "";

  if (usingFirebase() && !BE.user){
    empty.hidden = false;
    empty.innerHTML = svgIcon("i-lock", "big") + "<h3>Sign in to see the class</h3><p>The list of names and emails is only shown to people signed in to the Hub.</p>" +
      '<div class="gate-actions"><button class="btn js-signin" type="button">Sign in</button></div>';
    if (count) count.textContent = "";
    paintSelBar();
    return;
  }
  if (!usingFirebase()){
    empty.hidden = false;
    empty.innerHTML = svgIcon("i-people", "big") + "<h3>People needs accounts</h3><p>This copy of the Hub has no sign-in, so there's no list of emails to show.</p>";
    return;
  }
  if (!state.directoryLoaded){
    empty.hidden = true;
    for (var i = 0; i < 6; i++){ var sk = document.createElement("div"); sk.className = "skel"; sk.style.minHeight = "150px"; grid.appendChild(sk); }
    return;
  }

  var q = query.trim().toLowerCase();
  var list = people().filter(function(p){
    if (!q) return true;
    return (displayName(p.uid, p.name) + " " + (p.email || "")).toLowerCase().indexOf(q) > -1;
  });
  if (count){
    var shared = allEmails().length;
    count.textContent = people().length + (people().length === 1 ? " person" : " people") + " · " + shared + " email" + (shared === 1 ? "" : "s") + " shared";
  }
  if (!list.length){
    empty.hidden = false;
    empty.innerHTML = q
      ? svgIcon("i-search-x", "big") + "<h3>No one matches that</h3><p>Try part of a first name, or clear the search.</p>"
      : svgIcon("i-people", "big") + "<h3>No one here yet</h3><p>People show up the first time they sign in.</p>";
    paintSelBar();
    return;
  }
  empty.hidden = true;
  var me = BE.user ? BE.user.id : null;

  list.forEach(function(p, i){
    var card = document.createElement("article");
    card.className = "person" + (selected[p.uid] ? " sel" : "");
    card.style.animationDelay = Math.min(i * 30, 300) + "ms";
    var name = displayName(p.uid, p.name);
    var mail = emailOf(p.uid);

    var top = document.createElement("div");
    top.className = "person-top";
    var avw = document.createElement("span");
    avw.className = "av-wrap";
    avw.appendChild(avatarEl(p.uid, name));
    if (isOnline(p.uid)){ var dot = document.createElement("i"); dot.className = "online"; dot.title = "Active now"; avw.appendChild(dot); }
    top.appendChild(avw);
    var id = document.createElement("div");
    id.className = "person-id";
    id.innerHTML = "<b></b><small></small>";
    id.querySelector("b").textContent = name;
    if (p.uid === me) id.querySelector("b").insertAdjacentHTML("beforeend", '<span class="you">you</span>');
    if (isOwnerEmail(p.email) || (BE.adminEmails || []).indexOf(String(p.email || "").toLowerCase()) > -1)
      id.querySelector("b").insertAdjacentHTML("beforeend", '<span class="adm">admin</span>');
    if (BE.isAdmin && isBlocked(p.uid)) id.querySelector("b").insertAdjacentHTML("beforeend", '<span class="badge bad">timed out</span>');
    id.querySelector("small").textContent = seenText(p);
    top.appendChild(id);
    card.appendChild(top);

    var mailRow = document.createElement("div");
    mailRow.className = "person-mail" + (mail ? "" : " hidden-mail");
    if (mail){
      mailRow.innerHTML = svgIcon("i-at", "sm") + "<span></span>";
      mailRow.querySelector("span").textContent = mail;
      var cp = document.createElement("button");
      cp.type = "button"; cp.className = "icon-btn flat sm";
      cp.setAttribute("aria-label", "Copy " + name + "'s email");
      cp.innerHTML = svgIcon("i-copy");
      cp.addEventListener("click", function(){ copy(mail, "Email"); });
      mailRow.appendChild(cp);
    } else {
      mailRow.textContent = p.uid === me ? "Your email is hidden. Change it in Settings." : "Email hidden";
    }
    card.appendChild(mailRow);

    var act = document.createElement("div");
    act.className = "person-actions";
    if (mail && p.uid !== me){
      var em = document.createElement("button");
      em.type = "button"; em.className = "btn ghost sm";
      em.innerHTML = svgIcon("i-mail") + " Email";
      em.addEventListener("click", function(){ composeTo([mail]); });
      act.appendChild(em);
    }
    if (p.uid !== me){
      var msg = document.createElement("button");
      msg.type = "button"; msg.className = "btn soft sm";
      msg.innerHTML = svgIcon("i-msg") + " Message";
      msg.addEventListener("click", function(){ openDM(p.uid); });
      act.appendChild(msg);
    }
    if (BE.isAdmin && p.uid !== me){
      var to = document.createElement("button");
      to.type = "button"; to.className = "icon-btn sm";
      var blocked = isBlocked(p.uid);
      to.setAttribute("aria-label", blocked ? "Let " + name + " chat again" : "Time out " + name + " from chat");
      to.title = blocked ? "Let them chat again" : "Time out from chat";
      to.innerHTML = svgIcon(blocked ? "i-msg" : "i-shield-x");
      to.addEventListener("click", function(){ setBlocked(p.uid, !blocked); });
      act.appendChild(to);
    }
    if (act.children.length) card.appendChild(act);

    if (p.uid !== me){
      var sel = document.createElement("input");
      sel.type = "checkbox";
      sel.className = "person-sel";
      sel.checked = !!selected[p.uid];
      sel.setAttribute("aria-label", "Select " + name);
      sel.addEventListener("change", function(){
        if (sel.checked) selected[p.uid] = true; else delete selected[p.uid];
        card.classList.toggle("sel", sel.checked);
        paintSelBar();
      });
      card.appendChild(sel);
    }
    grid.appendChild(card);
  });
  paintSelBar();
}

function paintSelBar(){
  var bar = document.getElementById("peopleSelBar");
  if (!bar) return;
  var ids = Object.keys(selected).filter(function(u){ return dir()[u]; });
  var onTab = state.tab === "people";
  bar.hidden = !ids.length || !onTab;
  var c = document.getElementById("peopleSelCount");
  if (c) c.textContent = ids.length + " selected";
}
function selectedIds(){ return Object.keys(selected).filter(function(u){ return dir()[u]; }); }

function initPeople(){
  var s = document.getElementById("peopleSearch");
  if (s) s.addEventListener("input", function(){ query = s.value; renderPeople(); });
  var ca = document.getElementById("peopleCopyAll");
  if (ca) ca.addEventListener("click", function(){
    if (usingFirebase() && !BE.user){ openAuthSheet(); return; }
    var all = allEmails();
    if (!all.length){ toast("No emails to copy yet.", true); return; }
    copy(all.join(", "), all.length + " emails");
  });
  var ea = document.getElementById("peopleEmailAll");
  if (ea) ea.addEventListener("click", function(){
    if (usingFirebase() && !BE.user){ openAuthSheet(); return; }
    composeTo(allEmails().filter(function(e){ return !BE.user || e !== BE.user.email; }));
  });
  var clr = document.getElementById("peopleSelClear");
  if (clr) clr.addEventListener("click", function(){ selected = {}; renderPeople(); });
  var sc = document.getElementById("peopleSelCopy");
  if (sc) sc.addEventListener("click", function(){
    var list = selectedIds().map(emailOf).filter(Boolean);
    if (!list.length){ toast("None of them have shared an email.", true); return; }
    copy(list.join(", "), list.length === 1 ? "Email" : list.length + " emails");
  });
  var sm = document.getElementById("peopleSelMail");
  if (sm) sm.addEventListener("click", function(){ composeTo(selectedIds().map(emailOf)); });
  var sg = document.getElementById("peopleSelGroup");
  if (sg) sg.addEventListener("click", function(){
    var ids = selectedIds();
    if (ids.length === 1){ openDM(ids[0]); return; }
    newGroupWith(ids);
  });
  onProfiles(renderPeople);
  registerCommands(function(){
    var out = [{ kind:"Go", title:"People", hint:"everyone's school email", run:function(){
      var t = document.querySelector('nav.tabs button[data-tab="people"]'); if (t) t.click(); } }];
    people().forEach(function(p){
      if (BE.user && p.uid === BE.user.id) return;
      out.push({ kind:"Person", title:displayName(p.uid, p.name), hint:emailOf(p.uid) || "email hidden",
        run:function(){ openDM(p.uid); } });
    });
    return out;
  });
  setInterval(function(){ if (state.tab === "people" && !document.hidden) renderPeople(); }, 60000);
}

export { initPeople, renderPeople, touchDirectory, setListed, myListing, isOnline, emailOf, onDirectory, people, seenText, copy };
