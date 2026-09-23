import {
  BE, authorFields, canAdmin, dbErrMsg, fmtAgo, meId, mine,
  requireDb, signedIn, toast, usingFirebase
} from "./backend.js";
import { state } from "./state.js";
import { esc, safeUrl, svgIcon } from "./text.js";
import { subjectCodes, subjectLabel } from "./sched.js";
import { renderNowStrip } from "./orbit.js";

/* =========================================================
   WORK — assignments and due dates.

   Two things live side by side here and they are deliberately kept apart:

     the assignment   is the class's. Title, subject, due date, link. Everyone
                      reads it, and it is the same row on every screen.

     whether you are  is yours. It is written under your own account at
     finished with it users/<you>/done/<assignment>, which the security rules
                      make unreadable to everyone else, including admins and
                      the owner. Nobody can see who has and hasn't finished.

   That split is what lets one person's Google Classroom feed the whole class
   without also telling the class what that person has handed in.
   ========================================================= */

var DAY = 86400000;

/* ---------------------------------------------------------------- data --- */

function assignments(){
  var rows = (state.assignments || []).slice();
  var pend = state.pending || {};
  Object.keys(pend).forEach(function(id){
    if (pend[id] && pend[id].__kind === "work" && !rows.some(function(r){ return r.id === id; })){
      rows.push(pend[id]);
    }
  });
  return rows;
}

function isDone(a){ return !!(state.workDone && state.workDone[a.id]); }

/* Due dates are stored as "YYYY-MM-DD" with an optional "THH:MM". Comparing
   them as local Date objects keeps "today" honest in Belize rather than UTC. */
function dueDate(a){
  if (!a || !a.due) return null;
  var p = String(a.due).split("T");
  var d = p[0].split("-").map(Number);
  if (d.length !== 3 || isNaN(d[0])) return null;
  var t = (p[1] || "").split(":").map(Number);
  return new Date(d[0], d[1] - 1, d[2], t[0] || 23, isNaN(t[1]) ? 59 : t[1], 0, 0);
}
function hasTime(a){ return !!(a && a.due && String(a.due).indexOf("T") > -1); }

function startOfToday(){
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

/* Which bucket a piece of work belongs in. Order matters: this is the order
   they are shown in, and it is the order they actually matter in. */
var BUCKETS = [
  { key:"overdue",  label:"Overdue",        tone:"bad"  },
  { key:"today",    label:"Due today",      tone:"hot"  },
  { key:"tomorrow", label:"Due tomorrow",   tone:"warm" },
  { key:"week",     label:"This week",      tone:""     },
  { key:"later",    label:"Later",          tone:""     },
  { key:"undated",  label:"No date set",    tone:""     }
];

function bucketOf(a){
  var d = dueDate(a);
  if (!d) return "undated";
  var t0 = startOfToday(), ms = d.getTime();
  if (ms < Date.now())      return "overdue";   // the moment has passed
  if (ms < t0 + DAY)        return "today";
  if (ms < t0 + 2 * DAY)    return "tomorrow";
  if (ms < t0 + 7 * DAY)    return "week";
  return "later";
}

/* A short, plain phrase for how long is left. Deliberately not a ticking
   clock: "in 3 days" is what a person actually needs. */
function duePhrase(a){
  var d = dueDate(a);
  if (!d) return "no date";
  var ms = d.getTime() - Date.now();
  var t0 = startOfToday();
  var days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - t0) / DAY);
  var clock = hasTime(a)
    ? d.toLocaleTimeString(undefined, { hour:"numeric", minute:"2-digit" })
    : "";
  if (ms < 0){
    var over = Math.abs(days);
    if (over === 0) return "was due today" + (clock ? " at " + clock : "");
    if (over === 1) return "was due yesterday";
    return over + " days late";
  }
  if (days === 0) return clock ? "today at " + clock : "today";
  if (days === 1) return clock ? "tomorrow at " + clock : "tomorrow";
  if (days < 7) return "in " + days + " days";
  if (days < 14) return "next week";
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
}

/* What the front page shows. Counts only what you have not finished. */
function workSummary(){
  var over = 0, today = 0, soon = 0;
  assignments().forEach(function(a){
    if (isDone(a)) return;
    var b = bucketOf(a);
    if (b === "overdue") over++;
    else if (b === "today") today++;
    else if (b === "tomorrow" || b === "week") soon++;
  });
  return { overdue: over, today: today, soon: soon, total: over + today + soon };
}

/* -------------------------------------------------------------- filters -- */

function visibleWork(){
  var subj = state.workSubject || "all";
  var hide = state.workHideDone !== false;
  return assignments().filter(function(a){
    if (subj !== "all" && a.subject !== subj) return false;
    if (hide && isDone(a)) return false;
    return true;
  }).sort(function(x, y){
    var dx = dueDate(x), dy = dueDate(y);
    if (!dx && !dy) return (y.createdAt || "").localeCompare(x.createdAt || "");
    if (!dx) return 1;
    if (!dy) return -1;
    return dx - dy;
  });
}

function renderWorkFilters(){
  var row = document.getElementById("workFilters");
  if (!row) return;
  var codes = ["all"].concat(subjectCodes());
  row.innerHTML = "";
  codes.forEach(function(c){
    var b = document.createElement("button");
    b.className = "chip-btn" + ((state.workSubject || "all") === c ? " on" : "");
    b.type = "button";
    b.textContent = c === "all" ? "All subjects" : c;
    if (c !== "all") b.title = subjectLabel(c) || c;
    b.addEventListener("click", function(){
      state.workSubject = c;
      renderWorkFilters();
      renderWork();
    });
    row.appendChild(b);
  });
}

/* --------------------------------------------------------------- render -- */

function renderWork(){
  var list = document.getElementById("workList");
  if (!list) return;
  var status = document.getElementById("workStatus");
  var rows = visibleWork();

  if (!state.workLoaded && !rows.length){
    list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    return;
  }
  list.innerHTML = "";

  if (!rows.length){
    var done = assignments().length && state.workHideDone !== false;
    list.appendChild(emptyState(
      done ? "i-check" : "i-spark",
      done ? "Nothing left" : "Nothing set yet",
      done
        ? "You've ticked off everything that's showing. Untick “hide what I've finished” to see it all again."
        : "When something gets assigned it shows up here, soonest first."
    ));
    if (status) status.textContent = "";
    return;
  }

  var grouped = {};
  rows.forEach(function(a){
    var b = bucketOf(a);
    (grouped[b] = grouped[b] || []).push(a);
  });

  BUCKETS.forEach(function(bk){
    var group = grouped[bk.key];
    if (!group || !group.length) return;
    var head = document.createElement("div");
    head.className = "work-group" + (bk.tone ? " " + bk.tone : "");
    head.innerHTML = '<span>' + bk.label + '</span><b>' + group.length + '</b>';
    list.appendChild(head);
    group.forEach(function(a){ list.appendChild(workCard(a, bk)); });
  });

  if (status){
    var s = workSummary();
    status.textContent = s.total
      ? s.overdue + " overdue · " + s.today + " due today"
      : "";
  }
}

function workCard(a, bk){
  var card = document.createElement("article");
  var done = isDone(a);
  card.className = "work-card" + (done ? " done" : "") + (bk.key === "overdue" ? " overdue" : "");
  card.dataset.id = a.id;

  var tick = document.createElement("button");
  tick.className = "work-tick" + (done ? " on" : "");
  tick.type = "button";
  tick.setAttribute("aria-pressed", done ? "true" : "false");
  tick.setAttribute("aria-label", done ? "Mark as not finished" : "Mark as finished");
  tick.innerHTML = svgIcon("i-check");
  tick.addEventListener("click", function(){ toggleDone(a); });
  card.appendChild(tick);

  var mid = document.createElement("div");
  mid.className = "work-body";

  var top = document.createElement("div");
  top.className = "work-top";
  if (a.subject){
    var pill = document.createElement("span");
    pill.className = "work-subj";
    pill.textContent = a.subject;
    pill.title = subjectLabel(a.subject) || a.subject;
    top.appendChild(pill);
  }
  var h = document.createElement("h3");
  h.textContent = a.title || "Untitled";
  top.appendChild(h);
  mid.appendChild(top);

  if (a.detail){
    var d = document.createElement("p");
    d.className = "work-detail";
    d.textContent = a.detail;
    mid.appendChild(d);
  }

  var meta = document.createElement("div");
  meta.className = "work-meta";
  var due = document.createElement("span");
  due.className = "work-due" + (bk.key === "overdue" ? " bad" : bk.key === "today" ? " hot" : "");
  due.innerHTML = svgIcon("i-clock") + "<span>" + esc(duePhrase(a)) + "</span>";
  meta.appendChild(due);

  if (a.source === "classroom" && a.courseName){
    var src = document.createElement("span");
    src.className = "work-src";
    src.innerHTML = svgIcon("i-cloud") + "<span>" + esc(a.courseName) + "</span>";
    meta.appendChild(src);
  }
  var href = safeUrl(a.link);
  if (href){
    var lk = document.createElement("a");
    lk.className = "linkbtn";
    lk.href = href;
    lk.target = "_blank";
    lk.rel = "noopener";
    lk.innerHTML = svgIcon("i-link") + "<span>Open</span>";
    meta.appendChild(lk);
  }
  if (canAdmin() || mine(a)){
    var ed = document.createElement("button");
    ed.className = "linkbtn";
    ed.type = "button";
    ed.textContent = "Edit";
    ed.addEventListener("click", function(){ openWorkSheet(a); });
    meta.appendChild(ed);
  }
  mid.appendChild(meta);
  card.appendChild(mid);
  return card;
}

function emptyState(icon, title, text){
  var d = document.createElement("div");
  d.className = "empty";
  d.innerHTML = svgIcon(icon, "ic big") +
    "<h3>" + esc(title) + "</h3><p>" + esc(text) + "</p>";
  return d;
}

/* ------------------------------------------------------------- my ticks -- */

/* Written under your own account, never into the shared row. On the artifact
   driver there is no verified account to hang it on, so it stays in this
   browser - which is the honest version of "private" there. */
function toggleDone(a){
  var next = !isDone(a);
  state.workDone = state.workDone || {};
  if (next) state.workDone[a.id] = true; else delete state.workDone[a.id];
  renderWork();
  paintWorkChip();

  if (usingFirebase() && BE.user){
    var ref = BE.db.doc("users/" + BE.user.id + "/done/" + a.id);
    var p = next
      ? ref.set({ done:true, at:new Date().toISOString() })
      : ref.delete();
    p.catch(function(err){
      state.workDone[a.id] = !next;    // put it back; the server said no
      if (!next) state.workDone[a.id] = true; else delete state.workDone[a.id];
      renderWork();
      toast(dbErrMsg(err), true);
    });
    return;
  }
  try{
    localStorage.setItem("3cs_done", JSON.stringify(Object.keys(state.workDone)));
  }catch(e){}
}

function loadLocalDone(){
  state.workDone = state.workDone || {};
  if (usingFirebase() && BE.user) return;      // the server copy is the truth
  try{
    var raw = localStorage.getItem("3cs_done");
    if (raw) JSON.parse(raw).forEach(function(id){ state.workDone[id] = true; });
  }catch(e){}
}

/* --------------------------------------------------------------- editor -- */

var editing = null;

function openWorkSheet(a){
  editing = a || null;
  var sheet = document.getElementById("workSheet");
  if (!sheet) return;

  var sel = document.getElementById("workSubject");
  sel.innerHTML = '<option value="">No subject</option>';
  subjectCodes().forEach(function(c){
    var o = document.createElement("option");
    o.value = c;
    o.textContent = subjectLabel(c) ? c + " — " + subjectLabel(c) : c;
    sel.appendChild(o);
  });

  document.getElementById("workSheetTitle").textContent = a ? "Edit assignment" : "New assignment";
  document.getElementById("workTitle").value = a ? (a.title || "") : "";
  sel.value = a ? (a.subject || "") : "";
  var parts = a && a.due ? String(a.due).split("T") : ["", ""];
  document.getElementById("workDue").value = parts[0] || "";
  document.getElementById("workDueTime").value = parts[1] || "";
  document.getElementById("workDetail").value = a ? (a.detail || "") : "";
  document.getElementById("workLink").value = a ? (a.link || "") : "";
  document.getElementById("workDeleteBtn").hidden = !a;
  document.getElementById("workSaveBtn").textContent = a ? "Save for the class" : "Post to the class";
  sheet.hidden = false;
  setTimeout(function(){ document.getElementById("workTitle").focus(); }, 40);
}
function closeWorkSheet(){
  var s = document.getElementById("workSheet");
  if (s) s.hidden = true;
  editing = null;
}

function saveWork(){
  var db = requireDb(); if (!db) return;
  if (!signedIn()){ toast("Sign in first.", true); return; }
  var title = document.getElementById("workTitle").value.trim();
  if (!title){ toast("Give it a title.", true); return; }
  var rawLink = document.getElementById("workLink").value.trim();
  if (rawLink && !safeUrl(rawLink)){ toast("That link needs to be a normal web address (https://…).", true); return; }
  var date = document.getElementById("workDue").value;
  var time = document.getElementById("workDueTime").value;

  var row = {
    title: title,
    subject: document.getElementById("workSubject").value || "",
    due: date ? (time ? date + "T" + time : date) : "",
    detail: document.getElementById("workDetail").value.trim(),
    link: safeUrl(document.getElementById("workLink").value),
    updatedAt: new Date().toISOString()
  };

  if (editing){
    BE.db.doc("assignments/" + editing.id).update(row)
      .then(function(){ toast("Updated for everyone."); closeWorkSheet(); })
      .catch(function(err){ toast(dbErrMsg(err), true); });
    return;
  }

  row.source = "manual";
  row.createdAt = new Date().toISOString();
  Object.assign(row, authorFields());
  BE.db.collection("assignments").add(row)
    .then(function(){ toast("Posted to the class."); closeWorkSheet(); })
    .catch(function(err){ toast(dbErrMsg(err), true); });
}

function deleteWork(){
  if (!editing) return;
  if (!window.confirm("Delete this for the whole class?")) return;
  BE.db.doc("assignments/" + editing.id).delete()
    .then(function(){ toast("Deleted."); closeWorkSheet(); })
    .catch(function(err){ toast(dbErrMsg(err), true); });
}

/* ---------------------------------------------------------- hero summary - */

/* The front-page chip is drawn by the now-strip in orbit.js, which owns that
   row; this just asks for a repaint when the numbers change. */
function paintWorkChip(){
  try{ renderNowStrip(); }catch(e){}
  renderDueSoon();
}

/* ------------------------------------------------------- due soon card --- */

/* The Today sidebar: the next few things you haven't finished, nearest
   first, so the front page answers "what do I have to do" without a click. */
var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function renderDueSoon(){
  var box = document.getElementById("dueSoon");
  if (!box) return;
  var title = document.getElementById("dueTitle");
  box.innerHTML = "";
  if (usingFirebase() && !BE.user){
    box.innerHTML = '<p class="hint" style="margin:0">Sign in to see what the class has due.</p>' +
      '<button class="btn sm js-signin" type="button" style="margin-top:10px">Sign in</button>';
    if (title) title.textContent = "What's next";
    return;
  }
  var soon = assignments().filter(function(a){
    if (isDone(a)) return false;
    var k = bucketOf(a);
    return k === "overdue" || k === "today" || k === "tomorrow" || k === "week";
  }).sort(function(a, b){ return dueDate(a) - dueDate(b); });
  if (title) title.textContent = soon.length ? soon.length + (soon.length === 1 ? " thing this week" : " things this week") : "You're all caught up";
  if (!soon.length){
    box.innerHTML = '<p class="hint" style="margin:0">' + (!state.workLoaded && !state.standalone ? "Loading…" : "Nothing due in the next seven days. Enjoy it.") + '</p>';
    return;
  }
  soon.slice(0, 5).forEach(function(a){
    var d = dueDate(a), k = bucketOf(a);
    var row = document.createElement("button");
    row.type = "button";
    row.className = "due-row" + (k === "overdue" ? " bad" : k === "today" ? " hot" : "");
    row.innerHTML =
      '<span class="dd"><b>' + d.getDate() + '</b><span>' + MON[d.getMonth()] + '</span></span>' +
      '<span class="dt"><strong></strong><small></small></span>';
    row.querySelector("strong").textContent = a.title || "Untitled";
    row.querySelector("small").textContent = [a.subject, duePhrase(a)].filter(Boolean).join(" · ");
    row.addEventListener("click", function(){
      var t = document.querySelector('nav.tabs button[data-tab="work"]');
      if (t) t.click();
    });
    box.appendChild(row);
  });
}

export {
  renderWork, renderWorkFilters, renderDueSoon, workSummary, paintWorkChip, openWorkSheet,
  closeWorkSheet, saveWork, deleteWork, toggleDone, loadLocalDone,
  dueDate, duePhrase, bucketOf, assignments, isDone, visibleWork
};
