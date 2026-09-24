import { SCHED, CAL, BELL_MODES, SESSIONS, BELL, BELL_NOTE, DEFAULT_LEGEND } from "./data.js";
import { state } from "./state.js";

/* =========================================================
   LIVE CONFIG. What the site actually runs on.

   data.js holds the timetable as it was printed in the official 2026-2027
   calendar. That is the floor, and it is never edited: it is what a brand new
   visitor sees before the database has answered, and what everyone falls back
   to if the database is unreachable.

   On top of it sits whatever an admin has changed from inside the site. Those
   overrides live in one Firestore document (config/site) and arrive through a
   live snapshot, so an edit made on a phone in the corridor is on every screen
   in the room a second later.

   Every view reads through the functions here instead of importing the raw
   constants, which is what makes the site editable without touching code.
   ========================================================= */

/* Overrides are shallow-merged per key, so an admin who retypes one session on
   Day 3 does not have to resupply the other 41 cells. */
var memo = null;
var memoStamp = -1;
var stamp = 0;

/* backend.js calls this whenever config/site changes. Everything below is
   recomputed lazily on the next read rather than eagerly here, so a burst of
   snapshots costs one rebuild, not one per snapshot. */
function bumpLive(){ stamp++; }

function cfg(){ return state.config || {}; }

function build(){
  var c = cfg();

  /* ---- schedule: per cycle-day rows of six {c,r,t} cells ---- */
  var schedule = {};
  Object.keys(SCHED).forEach(function(d){ schedule[d] = SCHED[d].slice(); });
  var so = c.schedule2;   // "schedule" held edits to the first (2026) timetable
  if (so && typeof so === "object"){
    Object.keys(so).forEach(function(d){
      var row = so[d];
      if (!Array.isArray(row)) return;
      var base = (schedule[d] || []).slice();
      row.forEach(function(cell, i){
        if (cell && typeof cell === "object") base[i] = { c: cell.c || "", r: cell.r || "", t: cell.t || "" };
      });
      schedule[d] = base;
    });
  }

  /* ---- calendar: date -> { day, kind, events[] } ---- */
  var calendar = Object.assign({}, CAL);
  var eo = c.events;
  if (eo && typeof eo === "object"){
    Object.keys(eo).forEach(function(iso){
      var v = eo[iso];
      if (v === null){ delete calendar[iso]; return; }   // an admin cleared the day
      if (!v || typeof v !== "object") return;
      var prev = calendar[iso] || {};
      calendar[iso] = {
        day:    v.day    !== undefined ? v.day    : prev.day,
        kind:   v.kind   !== undefined ? v.kind   : prev.kind,
        events: Array.isArray(v.events) ? v.events : (prev.events || [])
      };
    });
  }

  /* ---- bell modes: session times and dismissal per kind of day ---- */
  var modes = {};
  Object.keys(BELL_MODES).forEach(function(k){ modes[k] = Object.assign({}, BELL_MODES[k]); });
  var bo = c.bells;
  if (bo && typeof bo === "object"){
    Object.keys(bo).forEach(function(k){
      if (!modes[k] || !bo[k] || typeof bo[k] !== "object") return;
      var patch = bo[k];
      if (Array.isArray(patch.sessions) && patch.sessions.length){
        modes[k].sessions = patch.sessions
          .filter(function(p){ return Array.isArray(p) && p.length === 2; })
          .map(function(p){ return [String(p[0]), String(p[1])]; });
      }
      ["dismissal","dismissLabel","blurb","name","short"].forEach(function(f){
        if (typeof patch[f] === "string" && patch[f]) modes[k][f] = patch[f];
      });
    });
  }

  /* Session numbering follows the regular day, since that is the one the
     printed timetable is written against. */
  var sessions = modes.regular.sessions.map(function(p, i){
    return { n: i + 1, time: p[0] + "-" + p[1] };
  });

  /* The subject key. Once an admin has published one it is authoritative, so
     removing a row actually removes it. Merging with the printed defaults
     would quietly resurrect anything they deleted. Whatever the timetable
     currently teaches is always listed, though, even with no description, so
     a code can never appear in the grid with nothing explaining it. */
  var legend = state.legend && Object.keys(state.legend).length
    ? Object.assign({}, state.legend)
    : Object.assign({}, DEFAULT_LEGEND);
  Object.keys(schedule).forEach(function(d){
    schedule[d].forEach(function(cell){
      if (cell && cell.c && legend[cell.c] === undefined) legend[cell.c] = "";
    });
  });

  return {
    schedule: schedule,
    calendar: calendar,
    modes: modes,
    sessions: sessions,
    legend: legend,
    bell: c.bellTable && typeof c.bellTable === "object" ? c.bellTable : BELL,
    bellNote: typeof c.bellNote === "string" && c.bellNote ? c.bellNote : BELL_NOTE
  };
}

function live(){
  if (memo === null || memoStamp !== stamp){ memo = build(); memoStamp = stamp; }
  return memo;
}

function liveSched(){    return live().schedule; }
function liveCal(){      return live().calendar; }
function liveModes(){    return live().modes; }
function liveSessions(){ return live().sessions; }
function liveLegend(){   return live().legend; }
function liveBell(){     return live().bell; }
function liveBellNote(){ return live().bellNote; }

/* Which schedule is a given day on? An explicit `kind` set by an admin wins;
   otherwise the day's own wording decides, exactly as the printed calendar
   reads. */
function liveDayMode(info){
  var m = liveModes();
  if (!info) return m.regular;
  if (info.kind === "halfday")   return m.half;
  if (info.kind === "quickexit") return m.quick;
  var t = (info.events || []).join(" ").toLowerCase();
  if (t.indexOf("1/2 day") > -1)    return m.half;
  if (t.indexOf("quick exit") > -1) return m.quick;
  return m.regular;
}

/* Months that the calendar tab can page through, recomputed from whatever
   dates exist once an admin has added or removed some. */
function liveMonths(){
  var seen = {};
  Object.keys(liveCal()).forEach(function(iso){
    var p = iso.split("-");
    seen[p[0] + "-" + p[1]] = [ +p[0], +p[1] - 1 ];
  });
  return Object.keys(seen).sort().map(function(k){ return seen[k]; });
}

export {
  bumpLive, liveSched, liveCal, liveModes, liveSessions, liveLegend,
  liveBell, liveBellNote, liveDayMode, liveMonths
};
