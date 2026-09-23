import { state } from "./state.js";
import { esc, svgIcon } from "./text.js";
import { liveCal, liveSched, liveLegend, liveSessions } from "./live.js";
import { assignments, duePhrase, isDone, openWorkSheet } from "./work.js";
import { canAdmin, signedIn, usingFirebase, BE, signIn } from "./backend.js";
import { openSiteEditor } from "./adminpanel.js";
import { openAuthSheet } from "./auth.js";

/* =========================================================
   COMMAND PALETTE — one box that finds anything.

   Ctrl-K (or Cmd-K) anywhere. It searches across every part of the Hub at
   once — assignments, notes, help posts, calendar dates, the timetable —
   rather than making you guess which tab a thing lives in first, and it
   doubles as the fastest way to run the handful of actions people repeat.

   The index is rebuilt on open, from whatever the live snapshots currently
   hold, so it is never out of date and there is nothing to invalidate.
   ========================================================= */

var open = false;
var rows = [];          // current results
var cursor = 0;
var goTab = null;       // injected by main to avoid importing the tab owner

function setNavigator(fn){ goTab = fn; }

/* Other modules (quick links, chat, profile, theme) add their own actions
   here rather than this file importing all of them. */
var extra = [];
function registerCommands(fn){ extra.push(fn); }
function nav(tab){ if (goTab) goTab(tab); }

/* ---------------------------------------------------------------- score -- */

/* Small, predictable ranking: a word-start match beats a match buried in the
   middle, and a short field beats a long one. No fuzzy matching, because
   guessing wrong is more annoying than finding nothing. */
function score(text, q){
  if (!text) return -1;
  var t = String(text).toLowerCase();
  var i = t.indexOf(q);
  if (i < 0) return -1;
  var s = 100 - Math.min(i, 60);
  if (i === 0) s += 60;
  else if (/[\s\-·/(]/.test(t.charAt(i - 1))) s += 35;
  s -= Math.min(30, Math.floor(t.length / 12));
  return s;
}

/* ---------------------------------------------------------------- index -- */

function commands(){
  var c = [
    { kind:"Go", title:"Today",         hint:"today's classes and schedule", run:function(){ nav("schedule"); } },
    { kind:"Go", title:"Work",          hint:"what's due",             run:function(){ nav("work"); } },
    { kind:"Go", title:"Notebook",      hint:"shared notes",           run:function(){ nav("notebook"); } },
    { kind:"Go", title:"Help Board",    hint:"questions and reminders",run:function(){ nav("help"); } },
    { kind:"Go", title:"Calendar",      hint:"the year",               run:function(){ nav("calendar"); } },
    { kind:"Go", title:"Announcements", hint:"notices",                run:function(){ nav("announcements"); } }
  ];
  if (signedIn()){
    c.push({ kind:"Do", title:"Add an assignment", hint:"post work to the class",
             run:function(){ nav("work"); setTimeout(function(){ openWorkSheet(null); }, 260); } });
  }
  if (canAdmin()){
    c.push({ kind:"Do", title:"Edit the site", hint:"timetable, calendar, bells, subjects",
             run:function(){ openSiteEditor(); } });
  }
  if (usingFirebase() && !BE.user){
    c.push({ kind:"Do", title:"Sign in", hint:"to post, chat and tick things off", run:function(){ openAuthSheet(); } });
  }
  extra.forEach(function(fn){ try{ c = c.concat(fn() || []); }catch(e){} });
  return c;
}

function index(){
  var out = commands();

  assignments().forEach(function(a){
    out.push({
      kind:"Work", title:a.title || "Untitled",
      hint:[a.subject, duePhrase(a), isDone(a) ? "done" : ""].filter(Boolean).join(" · "),
      body:a.detail || "",
      run:function(){ nav("work"); }
    });
  });

  (state.notes || []).concat(state.myNotes || [], state.privNotes || []).forEach(function(n){
    if (!n) return;
    out.push({
      kind:"Note", title:n.title || "Untitled note",
      hint:[n.subject, n.visibility === "private" ? "private" : n.visibility].filter(Boolean).join(" · "),
      body:(n.body || "").slice(0, 400),
      run:function(){ nav("notebook"); }
    });
  });

  (state.posts || []).forEach(function(p){
    out.push({
      kind:p.kind === "reminder" ? "Reminder" : "Question",
      title:(p.body || "").split("\n")[0].slice(0, 90) || "(empty)",
      hint:[p.subject, p.resolved ? "answered" : ""].filter(Boolean).join(" · "),
      body:p.body || "",
      run:function(){ nav("help"); }
    });
  });

  (state.announcements || []).forEach(function(a){
    out.push({
      kind:"Notice", title:a.title || "Notice",
      hint:a.pinned ? "pinned" : "",
      body:a.body || "",
      run:function(){ nav("announcements"); }
    });
  });

  var cal = liveCal();
  Object.keys(cal).forEach(function(iso){
    var d = cal[iso];
    var evs = (d.events || []).join(" · ");
    if (!evs && !d.day) return;
    out.push({
      kind:"Date", title:evs || d.day,
      hint:iso + (d.day ? " · " + d.day : ""),
      run:function(){ nav("calendar"); }
    });
  });

  var legend = liveLegend();
  var sessions = liveSessions();
  Object.keys(legend).forEach(function(code){
    var when = [];
    var sched = liveSched();
    Object.keys(sched).forEach(function(day){
      sched[day].forEach(function(cell, i){
        if (cell && cell.c === code) when.push("Day " + day + " S" + (i + 1));
      });
    });
    out.push({
      kind:"Subject", title:legend[code] ? code + " — " + legend[code] : code,
      hint:when.slice(0, 4).join(", ") + (when.length > 4 ? " …" : ""),
      run:function(){ nav("schedule"); }
    });
  });

  return out;
}

/* --------------------------------------------------------------- search -- */

function search(q){
  q = (q || "").trim().toLowerCase();
  var all = index();
  if (!q) return all.filter(function(r){ return r.kind === "Go" || r.kind === "Do" || r.kind === "App"; });
  /* A field that doesn't match scores -1 and must stay negative, or its
     weighting would quietly turn every row into a hit. */
  function part(v, weight){ return v < 0 ? -1 : v + weight; }
  var hits = [];
  all.forEach(function(r){
    var s = Math.max(
      part(score(r.title, q), 20),
      part(score(r.hint, q), -10),
      part(score(r.body, q), -35)
    );
    if (s > 0) hits.push({ r:r, s:s });
  });
  hits.sort(function(a, b){ return b.s - a.s; });
  return hits.slice(0, 40).map(function(h){ return h.r; });
}

/* ----------------------------------------------------------------- view -- */

function build(){
  if (document.getElementById("palette")) return;
  var w = document.createElement("div");
  w.id = "palette";
  w.hidden = true;
  w.innerHTML =
    '<div class="pal-box" role="dialog" aria-modal="true" aria-label="Search the Hub">' +
      '<div class="pal-input">' + svgIcon("i-search") +
        '<input id="palQ" type="text" autocomplete="off" spellcheck="false" ' +
        'placeholder="Search everything, or jump somewhere…" aria-label="Search">' +
        '<kbd>esc</kbd>' +
      '</div>' +
      '<div class="pal-list" id="palList" role="listbox" aria-label="Results"></div>' +
      '<div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span>' +
      '<span><kbd>↵</kbd> open</span><span><kbd>ctrl</kbd>+<kbd>k</kbd> anytime</span></div>' +
    '</div>';
  document.body.appendChild(w);

  var q = w.querySelector("#palQ");
  q.addEventListener("input", function(){ run(q.value); });
  q.addEventListener("keydown", function(e){
    if (e.key === "ArrowDown"){ e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp"){ e.preventDefault(); move(-1); }
    else if (e.key === "Enter"){ e.preventDefault(); choose(cursor); }
    else if (e.key === "Escape"){ e.preventDefault(); hide(); }
  });
  w.addEventListener("click", function(e){ if (e.target === w) hide(); });
}

function run(q){
  rows = search(q);
  cursor = 0;
  paint();
}

function paint(){
  var list = document.getElementById("palList");
  if (!list) return;
  list.innerHTML = "";
  if (!rows.length){
    list.innerHTML = '<div class="pal-empty">Nothing matches that.</div>';
    return;
  }
  rows.forEach(function(r, i){
    var row = document.createElement("button");
    row.type = "button";
    row.className = "pal-row" + (i === cursor ? " on" : "");
    row.setAttribute("role", "option");
    row.innerHTML =
      '<span class="pal-kind">' + esc(r.kind) + '</span>' +
      '<span class="pal-title">' + esc(r.title) + '</span>' +
      (r.hint ? '<span class="pal-hint">' + esc(r.hint) + '</span>' : "");
    row.addEventListener("click", function(){ choose(i); });
    row.addEventListener("mousemove", function(){
      if (cursor === i) return;
      cursor = i; paint();
    });
    list.appendChild(row);
  });
  var on = list.querySelector(".pal-row.on");
  if (on) on.scrollIntoView({ block:"nearest" });
}

function move(d){
  if (!rows.length) return;
  cursor = (cursor + d + rows.length) % rows.length;
  paint();
}

function choose(i){
  var r = rows[i];
  if (!r) return;
  hide();
  setTimeout(function(){ try{ r.run(); }catch(e){} }, 10);
}

function show(){
  build();
  var w = document.getElementById("palette");
  w.hidden = false;
  open = true;
  document.body.classList.add("pal-open");
  var q = document.getElementById("palQ");
  q.value = "";
  run("");
  setTimeout(function(){ q.focus(); }, 20);
}
function hide(){
  var w = document.getElementById("palette");
  if (!w) return;
  w.hidden = true;
  open = false;
  document.body.classList.remove("pal-open");
}
function toggle(){ open ? hide() : show(); }
function isOpen(){ return open; }

/* ------------------------------------------------------------ shortcuts -- */

function initPalette(){
  document.addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")){
      e.preventDefault();
      toggle();
      return;
    }
    if (e.key === "Escape" && open){ e.preventDefault(); hide(); }
  }, true);
}

export { registerCommands, initPalette, show as showPalette, hide as hidePalette, isOpen as paletteOpen, setNavigator, search };
