import { BE, canAdmin, dbErrMsg, myName, registerStream, toast, usingFirebase } from "./backend.js";
import { esc, svgIcon, openSheet, closeSheet } from "./text.js";
import { avatarEl, displayName, onProfiles } from "./profile.js";
import { openAuthSheet } from "./auth.js";
import { registerCommands } from "./palette.js";
import { notify } from "./notify.js";

/* =========================================================
   POLLS & FEEDBACK - the class's say in how things go.

   polls/{pid}               { question, options[], optionIds[], multi,
                               closed, closesAt, note, counts{o0..}, voters,
                               authorUid, authorName, createdAt }
   polls/{pid}/votes/{uid}   { choices[], at }          (only you + admins)
   feedback/{fid}            { kind, title, body, anon, authorUid,
                               authorName, createdAt, status, votes{uid},
                               voteCount, adminNote? }
   feedbackAuthors/{fid}     { uid }   who wrote an anonymous post (admins)

   Only admins make polls; everyone signed in answers. A vote and the
   poll's totals are written together, and the rules only accept totals that
   move exactly as your answer moved. Feedback can be anonymous to
   classmates, never to admins.
   ========================================================= */

var polls = [], pollsLoaded = false;
var myVotes = {};            // pid -> [choices] (null while unknown)
var voteSubs = {};           // pid -> unsubscribe
var changing = {};           // pid -> true while re-voting
var picks = {};              // pid -> { oX: true } for multi polls before submitting
var feedback = [], fbLoaded = false;
var fbKind = "all", fbSort = "top";
var seenPolls = null;        // for "new poll" pop-ups, after the first load

var KINDS = { idea: ["Idea", "i-bulb"], flaw: ["Something's broken", "i-alert"], change: ["A change", "i-edit"] };
var STATUS = { "new": "New", planned: "Planned", doing: "In progress", done: "Done", no: "Not doing" };

function signedOut(){ return usingFirebase() && !BE.user; }
function me(){ return BE.user ? BE.user.id : ""; }
function ms(v){ if (!v) return 0; if (typeof v.toMillis === "function") return v.toMillis(); var t = Date.parse(v); return isNaN(t) ? 0 : t; }
function ago(v){
  var t = ms(v); if (!t) return "just now";
  var s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  var d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : d < 30 ? d + " days ago" : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isOpen(p){ return !p.closed && (!p.closesAt || ms(p.closesAt) > Date.now()); }
function closesText(p){
  if (p.closed) return "Closed";
  if (!p.closesAt) return "Open";
  var left = ms(p.closesAt) - Date.now();
  if (left <= 0) return "Closed";
  var h = left / 3600000;
  if (h < 1) return "Closes in " + Math.max(1, Math.round(left / 60000)) + " min";
  if (h < 24) return "Closes in " + Math.round(h) + "h";
  var d = Math.round(h / 24);
  return "Closes in " + d + (d === 1 ? " day" : " days");
}
function myAnon(){ try{ return JSON.parse(localStorage.getItem("3cs_myanon") || "[]"); }catch(e){ return []; } }
function rememberAnon(id){ try{ var a = myAnon(); a.push(id); localStorage.setItem("3cs_myanon", JSON.stringify(a.slice(-200))); }catch(e){} }
function gate(){ if (signedOut()){ openAuthSheet(); return true; } if (!BE.db){ toast("This copy of the Hub has no database.", true); return true; } return false; }

/* ------------------------------------------------------------ streams -- */
registerStream(function(db){
  if (!usingFirebase() || !BE.user) return [];
  var subs = [];
  subs.push(db.collection("polls").orderBy("createdAt", "desc").limit(30).onSnapshot(function(qs){
    polls = qs.docs.map(function(d){ return Object.assign({ id: d.id }, d.data({ serverTimestamps: "estimate" })); });
    pollsLoaded = true;
    watchMyVotes(db);
    announceNewPolls();
    renderVoice();
  }, function(){ pollsLoaded = true; renderVoice(); }));
  subs.push(db.collection("feedback").orderBy("createdAt", "desc").limit(300).onSnapshot(function(qs){
    feedback = qs.docs.map(function(d){ return Object.assign({ id: d.id }, d.data({ serverTimestamps: "estimate" })); });
    fbLoaded = true;
    renderFeedback();
  }, function(){ fbLoaded = true; renderFeedback(); }));
  return subs;
}, function(){
  Object.keys(voteSubs).forEach(function(k){ try{ voteSubs[k](); }catch(e){} });
  voteSubs = {}; myVotes = {}; polls = []; feedback = []; pollsLoaded = fbLoaded = false; seenPolls = null;
  renderVoice();
});

/* your own answer to each poll, so the card knows what you picked */
function watchMyVotes(db){
  var live = {};
  polls.forEach(function(p){
    live[p.id] = true;
    if (voteSubs[p.id]) return;
    myVotes[p.id] = null;
    voteSubs[p.id] = db.doc("polls/" + p.id + "/votes/" + me()).onSnapshot(function(d){
      myVotes[p.id] = d.exists ? (d.data().choices || []) : [];
      renderVoice();
    }, function(){ myVotes[p.id] = []; renderVoice(); });
  });
  Object.keys(voteSubs).forEach(function(k){
    if (!live[k]){ try{ voteSubs[k](); }catch(e){} delete voteSubs[k]; delete myVotes[k]; }
  });
}

function announceNewPolls(){
  var ids = polls.map(function(p){ return p.id; });
  if (seenPolls === null){ seenPolls = ids; return; }
  polls.forEach(function(p){
    if (seenPolls.indexOf(p.id) >= 0 || p.authorUid === me() || !isOpen(p)) return;
    notify({ key: "poll:" + p.id, kind: "poll", uid: p.authorUid, name: p.authorName || "An admin", where: "started a poll",
      text: p.question, onOpen: function(){ goVoice(); } });
  });
  seenPolls = ids;
}

/* the Today page and the tab badge ask how many polls are waiting on you */
function pollsToAnswer(){
  if (signedOut()) return [];
  return polls.filter(function(p){ return isOpen(p) && myVotes[p.id] && !myVotes[p.id].length; });
}
function goVoice(){
  var t = document.querySelector('nav.tabs button[data-tab="voice"]');
  if (t) t.click();
}

/* -------------------------------------------------------------- polls -- */
function vote(p, choices){
  if (gate()) return;
  var before = myVotes[p.id];
  if (before === null || before === undefined){ toast("One second, still loading your answer.", true); return; }
  var db = BE.db, FV = firebase.firestore.FieldValue;
  var up = { voters: FV.increment(before.length ? 0 : 1) };
  var ids = {};
  before.forEach(function(k){ ids[k] = (ids[k] || 0) - 1; });
  choices.forEach(function(k){ ids[k] = (ids[k] || 0) + 1; });
  var moved = false;
  Object.keys(ids).forEach(function(k){ if (ids[k]){ up["counts." + k] = FV.increment(ids[k]); moved = true; } });
  if (!moved && before.length){ delete changing[p.id]; renderVoice(); return; }
  var b = db.batch();
  b.set(db.doc("polls/" + p.id + "/votes/" + me()), { choices: choices, at: FV.serverTimestamp() });
  b.update(db.doc("polls/" + p.id), up);
  delete changing[p.id]; delete picks[p.id];
  myVotes[p.id] = choices.slice();          // shows at once; the stream confirms
  renderVoice();
  b.commit().then(function(){
    toast(before.length ? "Vote changed." : "Vote counted. Thanks!");
  }).catch(function(err){
    myVotes[p.id] = before;
    renderVoice();
    toast(dbErrMsg(err), true);
  });
}

function pollCard(p){
  var mine = myVotes[p.id] || [];
  var open = isOpen(p);
  var voted = mine.length > 0;
  var admin = canAdmin();
  var showResults = !open || (voted && !changing[p.id]) || admin;
  var canVote = open && !signedOut() && (!voted || changing[p.id]);
  var total = 0, max = 0;
  (p.optionIds || []).forEach(function(k){ var n = (p.counts && p.counts[k]) || 0; total += n; if (n > max) max = n; });

  var c = document.createElement("article");
  c.className = "card poll-card" + (open ? "" : " closed") + (voted ? " voted" : "");
  c.dataset.id = p.id;
  var head = '<div class="pc-top"><span class="badge ' + (open ? "now" : "") + '">' + svgIcon(open ? "i-poll" : "i-lock", "sm") + " " + esc(closesText(p)) + '</span>' +
    (p.multi ? '<span class="badge priv">Pick any</span>' : "") +
    '<span class="grow"></span>' +
    (admin ? '<button class="icon-btn flat sm pc-more" type="button" aria-label="Poll options">' + svgIcon("i-more") + "</button>" : "") + "</div>";
  var body = '<h3 class="pc-q"></h3>' + (p.note ? '<p class="pc-note"></p>' : "");
  var opts = '<div class="pc-opts' + (canVote ? " can" : "") + (showResults && !canVote ? " results" : "") + '" role="' + (canVote ? (p.multi ? "group" : "radiogroup") : "list") + '">';
  (p.options || []).forEach(function(text, i){
    var k = p.optionIds[i], n = (p.counts && p.counts[k]) || 0;
    var pct = total ? Math.round(n / total * 100) : 0;
    var picked = mine.indexOf(k) >= 0;
    var lead = !canVote && showResults && n > 0 && n === max;
    if (canVote){
      var on = p.multi ? !!(picks[p.id] && picks[p.id][k]) : false;
      // admins see the running totals even before they vote
      opts += '<button type="button" class="po-opt' + (showResults ? " peek" : "") + '" data-k="' + k + '" role="' + (p.multi ? "checkbox" : "radio") + '" aria-checked="' + on + '"' +
        (showResults ? ' style="--p:' + pct + '%"' : "") + '>' +
        (showResults ? '<span class="po-fill" aria-hidden="true"></span>' : "") +
        '<span class="po-mark" aria-hidden="true">' + (p.multi ? svgIcon("i-check", "sm") : "") + '</span><span class="po-t"></span>' +
        (showResults ? '<b class="po-pct">' + pct + '%</b>' : "") + '</button>';
    } else {
      opts += '<div class="po-res' + (picked ? " mine" : "") + (lead ? " lead" : "") + '" role="listitem" style="--p:' + (showResults ? pct : 0) + '%">' +
        '<span class="po-fill" aria-hidden="true"></span>' +
        '<span class="po-t"></span>' + (picked ? '<span class="po-you">' + svgIcon("i-check", "sm") + " You</span>" : "") +
        (showResults ? '<b class="po-pct">' + pct + '%</b>' : "") + "</div>";
    }
  });
  opts += "</div>";
  var foot = '<div class="pc-foot"><span>' + total + (total === 1 ? " vote" : " votes") + (p.voters && p.multi ? " from " + p.voters + (p.voters === 1 ? " person" : " people") : "") +
    " · " + esc(p.authorName || "Admin") + " · " + ago(p.createdAt) + "</span>" +
    (canVote && p.multi ? '<button class="btn sm pc-send" type="button">Vote</button>' : "") +
    (canVote && voted ? '<button class="linkbtn pc-cancel" type="button">Keep my vote</button>' : "") +
    (!canVote && voted && open ? '<button class="linkbtn pc-change" type="button">Change my vote</button>' : "") +
    (!voted && open && signedOut() ? '<button class="btn sm js-signin" type="button">Sign in to vote</button>' : "") +
    "</div>";
  c.innerHTML = head + body + opts + foot;
  c.querySelector(".pc-q").textContent = p.question;
  if (p.note) c.querySelector(".pc-note").textContent = p.note;
  c.querySelectorAll(".po-t").forEach(function(t, i){ t.textContent = p.options[i]; });

  c.querySelectorAll(".po-opt").forEach(function(b){
    b.addEventListener("click", function(){
      var k = b.dataset.k;
      if (!p.multi){ vote(p, [k]); return; }
      picks[p.id] = picks[p.id] || {};
      picks[p.id][k] = !picks[p.id][k];
      b.setAttribute("aria-checked", String(!!picks[p.id][k]));
    });
  });
  var send = c.querySelector(".pc-send");
  if (send) send.addEventListener("click", function(){
    var ch = Object.keys(picks[p.id] || {}).filter(function(k){ return picks[p.id][k]; });
    if (!ch.length){ toast("Pick at least one.", true); return; }
    vote(p, p.optionIds.filter(function(k){ return ch.indexOf(k) >= 0; }));
  });
  var chg = c.querySelector(".pc-change");
  if (chg) chg.addEventListener("click", function(){
    changing[p.id] = true;
    if (p.multi){ picks[p.id] = {}; mine.forEach(function(k){ picks[p.id][k] = true; }); }
    renderVoice();
  });
  var cancel = c.querySelector(".pc-cancel");
  if (cancel) cancel.addEventListener("click", function(){ delete changing[p.id]; delete picks[p.id]; renderVoice(); });
  var more = c.querySelector(".pc-more");
  if (more) more.addEventListener("click", function(){ pollMenu(p); });
  return c;
}

function pollMenu(p){
  var box = openSheet(
    '<div class="sheet-head"><div><h2>Poll</h2><p class="hint"></p></div><button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + "</button></div>" +
    '<div class="btn-row">' +
      '<button class="btn ghost" id="pmToggle" type="button">' + svgIcon(p.closed ? "i-unlock" : "i-lock") + (p.closed ? " Reopen" : " Close it now") + "</button>" +
      '<button class="btn ghost" id="pmWho" type="button">' + svgIcon("i-people") + " Who voted</button>" +
      '<button class="btn danger" id="pmDel" type="button">' + svgIcon("i-trash") + " Delete</button>" +
    "</div><div class=\"pm-who\" id=\"pmWhoList\"></div>");
  box.querySelector(".hint").textContent = p.question;
  box.querySelector("#pmToggle").addEventListener("click", function(){
    var up = p.closed ? { closed: false } : { closed: true };
    if (p.closed && p.closesAt && ms(p.closesAt) < Date.now()) up.closesAt = null;
    BE.db.doc("polls/" + p.id).update(up).then(function(){ closeSheet(); toast(p.closed ? "Poll reopened." : "Poll closed. Results are final."); })
      .catch(function(err){ toast(dbErrMsg(err), true); });
  });
  box.querySelector("#pmDel").addEventListener("click", function(){
    if (!window.confirm("Delete this poll and its results?")) return;
    BE.db.doc("polls/" + p.id).delete().then(function(){ closeSheet(); toast("Poll deleted."); })
      .catch(function(err){ toast(dbErrMsg(err), true); });
  });
  box.querySelector("#pmWho").addEventListener("click", function(){
    var list = box.querySelector("#pmWhoList");
    list.innerHTML = '<p class="hint">Loading…</p>';
    BE.db.collection("polls/" + p.id + "/votes").get().then(function(qs){
      if (qs.empty){ list.innerHTML = '<p class="hint">Nobody has voted yet.</p>'; return; }
      list.innerHTML = "";
      qs.docs.forEach(function(d){
        var row = document.createElement("div");
        row.className = "pm-row";
        row.appendChild(avatarEl(d.id, displayName(d.id, ""), "sm"));
        var t = document.createElement("span");
        t.textContent = displayName(d.id, "Someone") + ": " + (d.data().choices || []).map(function(k){ return p.options[p.optionIds.indexOf(k)]; }).join(", ");
        row.appendChild(t);
        list.appendChild(row);
      });
    }).catch(function(err){ list.innerHTML = ""; toast(dbErrMsg(err), true); });
  });
}

function openPollSheet(){
  if (!canAdmin()){ toast("Only admins can start polls.", true); return; }
  var box = openSheet(
    '<div class="sheet-head"><div><h2>New poll</h2><p class="hint">Everyone gets a pop-up and can vote once. You can close it any time.</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + "</button></div>" +
    '<label class="field"><span>Question</span><input id="npQ" maxlength="200" placeholder="e.g. Where should the class trip go?"></label>' +
    '<div class="field"><span>Choices</span><div class="np-opts" id="npOpts"></div>' +
    '<button class="linkbtn" id="npAdd" type="button">' + svgIcon("i-plus", "sm") + " Add a choice</button></div>" +
    '<div class="set-row"><div><b>People can pick more than one</b><small>Good for "which of these would you come to?"</small></div><input type="checkbox" class="switch" id="npMulti"></div>' +
    '<label class="field"><span>Closes</span><select id="npClose">' +
      '<option value="">When I close it</option><option value="1">In 1 day</option><option value="3">In 3 days</option><option value="7" selected>In a week</option><option value="14">In 2 weeks</option></select></label>' +
    '<label class="field"><span>Note <em class="opt">optional</em></span><textarea id="npNote" maxlength="500" rows="2" placeholder="Anything people should know before voting"></textarea></label>' +
    '<div class="sheet-actions"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn" id="npGo" type="button">' + svgIcon("i-poll") + " Start the poll</button></div>");
  box.classList.add("wide");
  var wrap = box.querySelector("#npOpts");
  function addOpt(v){
    if (wrap.children.length >= 8){ toast("Eight choices at most.", true); return; }
    var r = document.createElement("div");
    r.className = "np-opt";
    r.innerHTML = '<input maxlength="80" placeholder="Choice ' + (wrap.children.length + 1) + '"><button class="icon-btn flat sm" type="button" aria-label="Remove choice">' + svgIcon("i-close") + "</button>";
    r.querySelector("input").value = v || "";
    r.querySelector("button").addEventListener("click", function(){
      if (wrap.children.length <= 2){ toast("A poll needs two choices.", true); return; }
      r.remove();
    });
    r.querySelector("input").addEventListener("keydown", function(e){
      if (e.key === "Enter"){ e.preventDefault(); addOpt(""); wrap.lastChild.querySelector("input").focus(); }
    });
    wrap.appendChild(r);
  }
  addOpt(""); addOpt("");
  box.querySelector("#npAdd").addEventListener("click", function(){ addOpt(""); var l = wrap.lastChild; if (l) l.querySelector("input").focus(); });
  var close = box.querySelector("[data-close]"); if (close) close.addEventListener("click", closeSheet);
  box.querySelector("#npQ").focus();
  box.querySelector("#npGo").addEventListener("click", function(){
    var q = box.querySelector("#npQ").value.trim();
    var options = Array.prototype.map.call(wrap.querySelectorAll("input"), function(i){ return i.value.trim(); }).filter(Boolean);
    if (!q){ toast("Write the question first.", true); box.querySelector("#npQ").focus(); return; }
    if (options.length < 2){ toast("Give people at least two choices.", true); return; }
    var days = +box.querySelector("#npClose").value;
    var FV = firebase.firestore.FieldValue;
    var doc = {
      question: q, options: options, optionIds: options.map(function(_, i){ return "o" + i; }),
      multi: box.querySelector("#npMulti").checked, closed: false,
      closesAt: days ? firebase.firestore.Timestamp.fromMillis(Date.now() + days * 86400000) : null,
      note: box.querySelector("#npNote").value.trim(), counts: {}, voters: 0,
      authorUid: me(), authorName: String(myName()).slice(0, 40), createdAt: FV.serverTimestamp()
    };
    var go = box.querySelector("#npGo");
    go.disabled = true;
    BE.db.collection("polls").add(doc).then(function(){ closeSheet(); toast("Poll started. Everyone can vote now."); })
      .catch(function(err){ go.disabled = false; toast(dbErrMsg(err), true); });
  });
}

/* ----------------------------------------------------------- feedback -- */
function openFeedbackSheet(edit){
  if (gate()) return;
  var f = edit || {};
  var box = openSheet(
    '<div class="sheet-head"><div><h2>' + (edit ? "Edit your post" : "Share feedback") + '</h2><p class="hint">Ideas for the Hub or the class, things that are broken, or changes you want. Admins read every one.</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + "</button></div>" +
    '<div class="fb-kinds" role="radiogroup" aria-label="What kind of feedback">' +
      Object.keys(KINDS).map(function(k){
        return '<label class="fb-kind k-' + k + '"><input type="radio" name="fbKind" value="' + k + '"' + ((f.kind || "idea") === k ? " checked" : "") + '><span>' + svgIcon(KINDS[k][1]) + "<b>" + KINDS[k][0] + "</b></span></label>";
      }).join("") + "</div>" +
    '<label class="field"><span>In a few words</span><input id="fbTitle" maxlength="120" placeholder="e.g. Let us pin notes to the top"></label>' +
    '<label class="field"><span>Details <em class="opt">optional</em></span><textarea id="fbBody" maxlength="2000" rows="4" placeholder="What happened, or what would be better? The more specific, the easier it is to act on."></textarea></label>' +
    (edit ? "" : '<div class="set-row"><div><b>Post anonymously</b><small>Classmates won\'t see your name. Admins still can.</small></div><input type="checkbox" class="switch" id="fbAnon"></div>') +
    '<div class="sheet-actions"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn" id="fbGo" type="button">' + (edit ? "Save" : "Post it") + "</button></div>");
  box.querySelector("#fbTitle").value = f.title || "";
  box.querySelector("#fbBody").value = f.body || "";
  var close = box.querySelector("[data-close]"); if (close) close.addEventListener("click", closeSheet);
  box.querySelector("#fbTitle").focus();
  box.querySelector("#fbGo").addEventListener("click", function(){
    var kind = (box.querySelector('input[name="fbKind"]:checked') || {}).value || "idea";
    var title = box.querySelector("#fbTitle").value.trim();
    var body = box.querySelector("#fbBody").value.trim();
    if (!title){ toast("Give it a short title.", true); box.querySelector("#fbTitle").focus(); return; }
    var go = box.querySelector("#fbGo"); go.disabled = true;
    var db = BE.db, FV = firebase.firestore.FieldValue;
    var p;
    if (edit){
      p = db.doc("feedback/" + edit.id).update({ kind: kind, title: title, body: body });
    } else {
      var anon = box.querySelector("#fbAnon").checked;
      var ref = db.collection("feedback").doc();
      var doc = { kind: kind, title: title, body: body, anon: anon,
        authorUid: anon ? "" : me(), authorName: anon ? "" : String(myName()).slice(0, 40),
        createdAt: FV.serverTimestamp(), status: "new", votes: {}, voteCount: 0 };
      if (anon){
        var b = db.batch();
        b.set(db.doc("feedbackAuthors/" + ref.id), { uid: me() });
        b.set(ref, doc);
        p = b.commit().then(function(){ rememberAnon(ref.id); });
      } else p = ref.set(doc);
    }
    p.then(function(){ closeSheet(); toast(edit ? "Saved." : "Posted. Thanks for helping make the Hub better!"); })
     .catch(function(err){ go.disabled = false; toast(dbErrMsg(err), true); });
  });
}

function isMine(f){ return (f.authorUid && f.authorUid === me()) || (f.anon && myAnon().indexOf(f.id) >= 0); }

function upvote(f){
  if (gate()) return;
  var had = !!(f.votes && f.votes[me()]);
  var FV = firebase.firestore.FieldValue;
  var up = { voteCount: (f.voteCount || 0) + (had ? -1 : 1) };
  up["votes." + me()] = had ? FV.delete() : true;
  BE.db.doc("feedback/" + f.id).update(up).catch(function(err){ toast(dbErrMsg(err), true); });
}

function fbCard(f){
  var had = !!(f.votes && f.votes[me()]);
  var admin = canAdmin(), mine = isMine(f);
  var k = KINDS[f.kind] || KINDS.idea;
  var c = document.createElement("article");
  c.className = "card fb-card k-" + (f.kind || "idea") + " s-" + (f.status || "new");
  c.innerHTML =
    '<button class="fb-vote' + (had ? " on" : "") + '" type="button" aria-pressed="' + had + '" aria-label="' + (had ? "Take back your upvote" : "Upvote") + '">' + svgIcon("i-up") + "<b>" + (f.voteCount || 0) + "</b></button>" +
    '<div class="fb-main">' +
      '<div class="fb-tags"><span class="fb-k">' + svgIcon(k[1], "sm") + " " + k[0] + '</span><span class="fb-s">' + (STATUS[f.status] || "New") + "</span></div>" +
      '<h3 class="fb-title"></h3>' + (f.body ? '<p class="fb-body"></p>' : "") +
      (f.adminNote ? '<div class="fb-note">' + svgIcon("i-shield", "sm") + '<span></span></div>' : "") +
      '<div class="fb-meta"><span class="fb-who"></span><span>' + ago(f.createdAt) + "</span>" +
        (mine && !admin ? '<button class="linkbtn fb-edit" type="button">Edit</button><button class="linkbtn danger fb-del" type="button">Delete</button>' : "") +
        (admin ? '<select class="fb-status" aria-label="Status">' + Object.keys(STATUS).map(function(s){ return '<option value="' + s + '"' + ((f.status || "new") === s ? " selected" : "") + ">" + STATUS[s] + "</option>"; }).join("") + "</select>" +
          '<button class="linkbtn fb-reply" type="button">' + (f.adminNote ? "Edit reply" : "Reply as admin") + "</button>" +
          (f.anon ? '<button class="linkbtn fb-who-btn" type="button">Who posted this?</button>' : "") +
          '<button class="linkbtn danger fb-del" type="button">Delete</button>' : "") +
      "</div>" +
    "</div>";
  c.querySelector(".fb-title").textContent = f.title;
  if (f.body) c.querySelector(".fb-body").textContent = f.body;
  if (f.adminNote) c.querySelector(".fb-note span").textContent = f.adminNote;
  var who = c.querySelector(".fb-who");
  if (f.anon){ who.textContent = mine ? "Anonymous (you)" : "Anonymous"; }
  else { who.appendChild(avatarEl(f.authorUid, f.authorName, "xs")); who.appendChild(document.createTextNode(" " + displayName(f.authorUid, f.authorName))); }

  c.querySelector(".fb-vote").addEventListener("click", function(){ upvote(f); });
  var ed = c.querySelector(".fb-edit"); if (ed) ed.addEventListener("click", function(){ openFeedbackSheet(f); });
  var del = c.querySelector(".fb-del"); if (del) del.addEventListener("click", function(){
    if (!window.confirm("Delete this post?")) return;
    BE.db.doc("feedback/" + f.id).delete().then(function(){ toast("Deleted."); }).catch(function(err){ toast(dbErrMsg(err), true); });
  });
  var st = c.querySelector(".fb-status"); if (st) st.addEventListener("change", function(){
    BE.db.doc("feedback/" + f.id).update({ status: st.value }).then(function(){ toast("Marked " + STATUS[st.value].toLowerCase() + "."); })
      .catch(function(err){ toast(dbErrMsg(err), true); });
  });
  var rp = c.querySelector(".fb-reply"); if (rp) rp.addEventListener("click", function(){
    var v = window.prompt("A short reply everyone will see (leave empty to remove it):", f.adminNote || "");
    if (v === null) return;
    BE.db.doc("feedback/" + f.id).update({ adminNote: v.trim().slice(0, 500) }).catch(function(err){ toast(dbErrMsg(err), true); });
  });
  var wb = c.querySelector(".fb-who-btn"); if (wb) wb.addEventListener("click", function(){
    BE.db.doc("feedbackAuthors/" + f.id).get().then(function(d){
      toast(d.exists ? "Posted by " + displayName(d.data().uid, "someone") + "." : "No record of who posted this.");
    }).catch(function(err){ toast(dbErrMsg(err), true); });
  });
  return c;
}

function renderFeedback(){
  var list = document.getElementById("fbList"), empty = document.getElementById("fbEmpty"), chips = document.getElementById("fbChips");
  if (!list) return;
  // filter chips with counts
  var counts = { all: feedback.length, idea: 0, flaw: 0, change: 0 };
  feedback.forEach(function(f){ if (counts[f.kind] !== undefined) counts[f.kind]++; });
  chips.innerHTML = "";
  [["all", "Everything"], ["idea", "Ideas"], ["flaw", "Broken"], ["change", "Changes"]].forEach(function(it){
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip-btn" + (fbKind === it[0] ? " on" : "");
    b.setAttribute("aria-pressed", String(fbKind === it[0]));
    b.innerHTML = esc(it[1]) + (counts[it[0]] ? ' <span class="cnt">' + counts[it[0]] + "</span>" : "");
    b.addEventListener("click", function(){ fbKind = it[0]; renderFeedback(); });
    chips.appendChild(b);
  });

  list.innerHTML = "";
  if (signedOut()){
    empty.hidden = false;
    empty.innerHTML = svgIcon("i-lock", "big") + "<h3>Sign in to share feedback</h3><p>Ideas, bugs and changes need a signed-in account.</p>" +
      '<div class="gate-actions"><button class="btn js-signin" type="button">Sign in</button></div>';
    return;
  }
  if (!fbLoaded){
    empty.hidden = true;
    for (var s = 0; s < 2; s++){ var sk = document.createElement("div"); sk.className = "skel"; sk.style.height = "96px"; list.appendChild(sk); }
    return;
  }
  var rows = feedback.filter(function(f){ return fbKind === "all" || f.kind === fbKind; });
  rows.sort(function(a, b){
    var done = function(x){ return x.status === "done" || x.status === "no" ? 1 : 0; };
    if (done(a) !== done(b)) return done(a) - done(b);
    if (fbSort === "top" && (b.voteCount || 0) !== (a.voteCount || 0)) return (b.voteCount || 0) - (a.voteCount || 0);
    return ms(b.createdAt) - ms(a.createdAt);
  });
  if (!rows.length){
    empty.hidden = false;
    empty.innerHTML = svgIcon("i-bulb", "big") + (fbKind === "all"
      ? "<h3>No feedback yet</h3><p>Got an idea, spotted something broken, or want something changed? Be the first.</p>"
      : "<h3>Nothing in this list yet</h3><p>Switch back to Everything, or post the first one.</p>") +
      '<div class="gate-actions"><button class="btn" type="button" id="fbEmptyBtn">' + svgIcon("i-bulb") + " Share feedback</button></div>";
    var eb = document.getElementById("fbEmptyBtn"); if (eb) eb.addEventListener("click", function(){ openFeedbackSheet(); });
    return;
  }
  empty.hidden = true;
  rows.forEach(function(f){ list.appendChild(fbCard(f)); });
}

/* ------------------------------------------------------------- render -- */
function renderVoice(){
  var list = document.getElementById("pollList"), empty = document.getElementById("pollEmpty"), hint = document.getElementById("pollHint");
  if (!list) return;
  var waiting = pollsToAnswer();
  var badge = document.getElementById("tabCountVoice");
  if (badge){ badge.hidden = !waiting.length; badge.textContent = String(waiting.length); }
  window.dispatchEvent(new Event("3cs:polls"));

  list.innerHTML = "";
  if (signedOut()){
    hint.textContent = "";
    empty.hidden = false;
    empty.innerHTML = svgIcon("i-lock", "big") + "<h3>Sign in to see the polls</h3><p>Admins ask; everyone in 3CS votes.</p>" +
      '<div class="gate-actions"><button class="btn js-signin" type="button">Sign in</button></div>';
    return;
  }
  if (!pollsLoaded){
    empty.hidden = true;
    var sk = document.createElement("div"); sk.className = "skel"; sk.style.height = "200px"; list.appendChild(sk);
    return;
  }
  var open = polls.filter(isOpen), shut = polls.filter(function(p){ return !isOpen(p); });
  hint.textContent = !polls.length ? "" : waiting.length ? waiting.length + (waiting.length === 1 ? " waiting for your vote" : " waiting for your vote") : open.length ? "You've voted on everything open" : "No open polls right now";
  if (!polls.length){
    empty.hidden = false;
    empty.innerHTML = svgIcon("i-poll", "big") + "<h3>No polls yet</h3><p>" + (canAdmin()
      ? "Ask the class something: where the trip goes, what to change next, which date works for an event.</p>" +
        '<div class="gate-actions"><button class="btn" type="button" id="pollEmptyBtn">' + svgIcon("i-poll") + " Start a poll</button></div>"
      : "When an admin asks the class something, it shows up here and you'll get a pop-up.</p>");
    var pb = document.getElementById("pollEmptyBtn"); if (pb) pb.addEventListener("click", openPollSheet);
    return;
  }
  empty.hidden = true;
  open.concat(shut.slice(0, 6)).forEach(function(p){ list.appendChild(pollCard(p)); });
}

function initVoice(){
  var nb = document.getElementById("pollNewBtn"); if (nb) nb.addEventListener("click", openPollSheet);
  var fb = document.getElementById("fbNewBtn"); if (fb) fb.addEventListener("click", function(){ openFeedbackSheet(); });
  document.querySelectorAll('input[name="fbSort"]').forEach(function(r){
    r.addEventListener("change", function(){ if (r.checked){ fbSort = r.value; renderFeedback(); } });
  });
  onProfiles(function(){ renderFeedback(); });
  // countdowns ("closes in 3h") stay honest without a reload
  setInterval(function(){ if (!document.hidden && polls.length) renderVoice(); }, 60000);
  registerCommands(function(){
    var c = [
      { kind: "Go", title: "Polls & feedback", hint: "vote, share ideas and report problems", run: goVoice },
      { kind: "Do", title: "Share feedback", hint: "an idea, a bug, or a change", run: function(){ openFeedbackSheet(); } }
    ];
    if (canAdmin()) c.push({ kind: "Do", title: "New poll", hint: "ask the class something", run: openPollSheet });
    return c;
  });
  renderVoice();
  renderFeedback();
}

export { initVoice, renderVoice, renderFeedback, pollsToAnswer, openFeedbackSheet, openPollSheet };
