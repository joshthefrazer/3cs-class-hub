import { applyAdminMode, paintTrustNotes, setTab, wire } from "./admin.js";
import { renderGlobalBanner } from "./ann.js";
import { initDb, myName, paintAuth } from "./backend.js";
import { calCursor, renderCalendar, renderCalendarDow } from "./cal.js";
import { MONTHS, MONTH_NAMES } from "./data.js";
import { liveCal, liveModes, liveSched, liveDayMode } from "./live.js";
import { renderHelp } from "./help.js";
import { renderNotebook, renderNotebookIntro } from "./notebook.js";
import { dayNumberFromLabel, renderBell, renderLegend, renderScheduleTable, renderSubjectSelectors, todayISO } from "./sched.js";
import { state } from "./state.js";
import { renderWork, renderWorkFilters, renderDueSoon, workSummary } from "./work.js";
import { initPalette, setNavigator, paletteOpen, showPalette } from "./palette.js";
import { initFx, replayReveal } from "./fx.js";
import { esc, svgIcon } from "./text.js";
import { initTheme } from "./theme.js";
import { initLinks } from "./links.js";
import { initProfile, onProfiles } from "./profile.js";
import { initChat } from "./chat.js";

/* =========================================================
   9. Today + navigation — the live "now", section changes, keys
   ========================================================= */
var TABS = ["schedule","work","notebook","help","calendar","announcements"];
var WORLD = {
  schedule:      { label:"Today" },
  work:          { label:"Work" },
  notebook:      { label:"Notebook" },
  help:          { label:"Help board" },
  calendar:      { label:"Calendar" },
  announcements: { label:"Announcements" }
};
var HERO = {
  work:          { eyebrow:"What's actually due", word:"Work",
    sub:"Soonest first. Tick things off as you finish them." },
  notebook:      { eyebrow:"Shared by the class", word:"Notebook",
    sub:"Notes, resources and revision checklists — anyone in 3CS can add a page." },
  help:          { eyebrow:"Ask · answer · remind", word:"Help board",
    sub:"Stuck on something? Post it. Remember something the class will forget? Post that too." },
  announcements: { eyebrow:"From the front of the room", word:"Announcements",
    sub:"Official word from admins — closures, schedule changes, and anything pinned to the top." }
};

var REDUCED = false;
try{ REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}

/* The sliding pill behind the active section on wide screens. */
function updateTabInk(){
  var nav = document.getElementById("tabs");
  var ink = document.getElementById("tabInk");
  if (!nav || !ink) return;
  var btn = nav.querySelector("button.active");
  if (!btn || !btn.offsetWidth){ ink.style.setProperty("--ink-w", "0px"); return; }
  ink.style.setProperty("--ink-x", btn.offsetLeft + "px");
  ink.style.setProperty("--ink-w", btn.offsetWidth + "px");
}

function setHeroWord(text){
  var el = document.getElementById("heroWord");
  if (!el) return;
  el.innerHTML = "";
  el.setAttribute("aria-label", text);
  String(text).split("").forEach(function(c, i){
    var s = document.createElement("span");
    s.className = "ch";
    s.textContent = c === " " ? " " : c;
    s.style.animationDelay = (i * 0.035) + "s";
    s.setAttribute("aria-hidden", "true");
    el.appendChild(s);
  });
}

function todayInfo(){
  var iso = todayISO();
  var info = liveCal()[iso] || null;
  return { iso: iso, info: info, dayNum: info ? dayNumberFromLabel(info.day) : null };
}

function renderHero(tab){
  /* Callers that just want a repaint (a config change, a calendar edit) pass
     nothing; without this the hero would collapse to its compact form as if
     the viewer had left the schedule. */
  tab = tab || state.tab || "schedule";
  var hero = document.getElementById("hero");
  var eyebrow = document.getElementById("heroEyebrow");
  var sub = document.getElementById("heroSub");
  var cta = document.getElementById("heroCta");
  var strip = document.getElementById("nowStrip");
  if (!hero) return;

  var emb = document.getElementById("heroEmblemUse");
  if (emb) emb.querySelector("use").setAttribute("href", "#e-" + tab);
  hero.classList.toggle("today", tab === "schedule");
  cta.hidden = tab !== "schedule";
  strip.hidden = tab !== "schedule";
  var bar = document.getElementById("dayBar");
  if (bar && tab !== "schedule") bar.hidden = true;
  var flag0 = document.getElementById("modeFlag");
  if (flag0 && tab !== "schedule") flag0.hidden = true;

  if (tab === "schedule"){
    var d = new Date(), ti = todayInfo();
    eyebrow.textContent = d.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });
    if (ti.info && ti.info.kind === "holiday"){
      setHeroWord("No school");
      sub.textContent = ti.info.events[0] || "Holiday.";
    } else if (ti.info && ti.info.kind === "async"){
      setHeroWord("Async day");
      sub.textContent = "Asynchronous day — work from home, no in-person classes.";
    } else if (ti.dayNum){
      setHeroWord("Day " + ti.dayNum);
      var extras = (ti.info.events || []).filter(function(e){ return !/^Week \d+$/.test(e); });
      sub.textContent = extras.length
        ? extras.join(" · ")
        : "Day " + ti.dayNum + " of the seven-day cycle. Six sessions, starting at 8:00.";
    } else {
      setHeroWord(d.getDay() === 0 || d.getDay() === 6 ? "Weekend" : "No classes");
      sub.textContent = "Nothing scheduled today — the next cycle day is on the Calendar.";
    }
    renderNowStrip();
    renderLineup();
    renderNextDay();
  } else if (tab === "calendar"){
    var my = MONTHS[calCursor];
    eyebrow.textContent = "The whole school year";
    setHeroWord(MONTH_NAMES[my[1]]);
    sub.textContent = "Cycle days, holidays, quick exits and half days for " + MONTH_NAMES[my[1]] + " " + my[0] + ".";
  } else {
    var h = HERO[tab];
    eyebrow.textContent = h.eyebrow;
    setHeroWord(h.word);
    sub.textContent = h.sub;
  }
}

/* ---------- live "right now" ---------- */
function parseClock(t){
  var p = String(t).split(":");
  var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
  if (h < 8) h += 12;                 // 1:00 means 13:00 on a school day
  return h * 60 + m;
}
/* Session slots for a given bell mode, not the generic weekly header times. */
function sessionRanges(mode){
  mode = mode || liveModes().regular;
  return mode.sessions.map(function(p, i){
    return { n: i + 1, start: parseClock(p[0]), end: parseClock(p[1]),
             time: p[0] + "–" + p[1], from: p[0], to: p[1] };
  });
}
function minsNow(){
  var d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}
function fmtLeft(mins){
  if (mins >= 60){
    var h = Math.floor(mins / 60), m = Math.floor(mins % 60);
    return h + "h " + (m < 10 ? "0" : "") + m + "m";
  }
  var s = Math.max(0, Math.round(mins * 60));
  var mm = Math.floor(s / 60), ss = s % 60;
  return mm + ":" + (ss < 10 ? "0" : "") + ss;
}
/* Next day that runs the half-day schedule — the PLC days staff and
   students both plan around. */
function nextHalfDay(){
  var today = todayISO(), best = null;
  Object.keys(liveCal()).forEach(function(k){
    if (k <= today) return;
    if (liveDayMode(liveCal()[k]) !== liveModes().half) return;
    if (!best || k < best) best = k;
  });
  if (!best) return null;
  var days = Math.round((Date.parse(best + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000);
  var d = new Date(best + "T00:00:00");
  return {
    days: days, iso: best,
    when: d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" }),
    day: liveCal()[best].day || ""
  };
}
/* The next date that actually has classes — for the "pack your bag" card. */
function nextSchoolDay(){
  var today = todayISO(), best = null;
  Object.keys(liveCal()).forEach(function(k){
    if (k <= today) return;
    var info = liveCal()[k];
    if (!dayNumberFromLabel(info.day)) return;
    if (info.kind === "holiday" || info.kind === "async") return;
    if (!best || k < best) best = k;
  });
  if (!best) return null;
  var d = new Date(best + "T00:00:00");
  var days = Math.round((Date.parse(best + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000);
  return {
    iso: best, info: liveCal()[best], dayNum: dayNumberFromLabel(liveCal()[best].day),
    label: days === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday:"long" }),
    when: d.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" })
  };
}
function nextBreak(){
  var today = todayISO(), best = null;
  Object.keys(liveCal()).forEach(function(k){
    if (k <= today || liveCal()[k].kind !== "holiday") return;
    if (!best || k < best) best = k;
  });
  if (!best) return null;
  var days = Math.round((Date.parse(best + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000);
  return { days: days, name: (liveCal()[best].events && liveCal()[best].events[0]) || "Holiday" };
}
function chipEl(label, value, meta, ring){
  var el = document.createElement("div");
  el.className = "now-chip";
  if (ring != null){
    var C = 113.1;
    el.innerHTML =
      '<svg class="ring" viewBox="0 0 44 44" aria-hidden="true">' +
      '<circle class="bg" cx="22" cy="22" r="18"></circle>' +
      '<circle class="fg" cx="22" cy="22" r="18" stroke-dasharray="' + C +
      '" stroke-dashoffset="' + (C * (1 - ring)) + '"></circle></svg>';
  }
  var txt = document.createElement("div");
  var l = document.createElement("div"); l.className = "lab"; l.textContent = label;
  var v = document.createElement("div"); v.className = "val"; v.textContent = value;
  txt.appendChild(l); txt.appendChild(v);
  if (meta){
    var m = document.createElement("div"); m.className = "meta"; m.textContent = meta;
    txt.appendChild(m);
  }
  el.appendChild(txt);
  return el;
}
function renderNowStrip(){
  var strip = document.getElementById("nowStrip");
  var flag = document.getElementById("modeFlag");
  if (!strip) return;
  strip.innerHTML = "";

  var ti = todayInfo();
  var mode = liveDayMode(ti.info);
  var cur = minsNow();

  /* Say loudly when today is NOT the normal bell schedule. */
  if (flag){
    if (ti.dayNum && mode.key !== "regular"){
      flag.hidden = false;
      flag.className = "mode-flag " + mode.key;
      flag.innerHTML = svgIcon("i-alert") +
        '<span><b>' + esc(mode.name) + ' schedule today</b> — ' + esc(mode.blurb) + '</span>';
    } else {
      flag.hidden = true;
    }
  }

  if (ti.dayNum){
    var ranges = sessionRanges(mode), lesson = null, idx = -1, upcoming = null, uidx = -1;
    ranges.forEach(function(r, i){
      if (cur >= r.start && cur < r.end){ lesson = r; idx = i; }
      if (upcoming === null && r.start > cur){ upcoming = r; uidx = i; }
    });
    var row = liveSched()[ti.dayNum];
    state.nowKey = mode.key + ":" + idx;

    if (lesson){
      var c = row[idx];
      var chip = chipEl("Now — " + c.c + " · " + c.r, fmtLeft(lesson.end - cur),
        "Session " + lesson.n + " ends " + lesson.to + " · " + c.t,
        (cur - lesson.start) / (lesson.end - lesson.start));
      chip.classList.add("live");
      chip.querySelector(".val").id = "nowCountdown";
      var ring = chip.querySelector(".ring .fg");
      if (ring) ring.id = "nowRing";
      strip.appendChild(chip);
    }
    if (upcoming){
      var nx = row[uidx];
      strip.appendChild(chipEl(lesson ? "Next" : "First up", nx.c + " · " + nx.r,
        "Session " + upcoming.n + " at " + upcoming.from));
    } else if (!lesson){
      strip.appendChild(chipEl("Today", "Classes are done",
        "Ended at " + mode.dismissal));
    }
    if (lesson || upcoming){
      strip.appendChild(chipEl(mode.dismissLabel, mode.dismissal,
        mode.key === "half" ? "Staff PLC at 1:00" : mode.short + " schedule"));
    }
  }

  /* What's actually due comes before what's coming up on the calendar, and
     only when there is something outstanding - an empty "0 due" chip is
     noise. The count is yours: work you have ticked off is not in it. */
  var w = workSummary();
  if (w.total){
    var kick = w.overdue ? "Overdue" : w.today ? "Due today" : "Coming up";
    var big  = w.overdue || w.today || w.soon;
    var chipW = chipEl(kick, big + (big === 1 ? " thing" : " things"),
      w.overdue ? (w.today ? w.today + " also due today" : "not handed in yet")
                : w.today ? "before the day is out" : "in the next week");
    chipW.classList.add("work-chip");
    if (w.overdue) chipW.classList.add("bad");
    else if (w.today) chipW.classList.add("hot");
    chipW.style.cursor = "pointer";
    chipW.addEventListener("click", function(){ warpTo("work"); });
    strip.appendChild(chipW);
  }

  var hd = nextHalfDay();
  if (hd) strip.appendChild(chipEl("Next half day",
    hd.days === 0 ? "Today" : hd.days + (hd.days === 1 ? " day" : " days"),
    hd.when + (hd.day ? " · " + hd.day : "")));

  var br = nextBreak();
  if (br) strip.appendChild(chipEl("Next break", br.days + (br.days === 1 ? " day" : " days"), br.name));
  renderDayBar();
}

/* ---------- the school day as one bar ---------- */
function dayBounds(){
  var ti = todayInfo();
  if (!ti.dayNum || (ti.info && (ti.info.kind === "holiday" || ti.info.kind === "async"))) return null;
  var mode = liveDayMode(ti.info), ranges = sessionRanges(mode);
  if (!ranges.length) return null;
  var start = ranges[0].start, end = parseClock(mode.dismissal);
  if (!(end > start)) end = ranges[ranges.length - 1].end;
  return { start: start, end: end, ranges: ranges, from: ranges[0].from, to: mode.dismissal };
}
function minsText(m){
  m = Math.max(0, Math.ceil(m));
  if (m >= 60) return Math.floor(m / 60) + "h " + (m % 60 < 10 ? "0" : "") + (m % 60) + "m";
  return m + " min";
}
function dayLabel(b, cur){
  if (cur < b.start) return "School starts at " + b.from;
  if (cur >= b.end) return "That's the day done";
  return Math.floor(((cur - b.start) / (b.end - b.start)) * 100) + "% through the day · " + minsText(b.end - cur) + " to go";
}
function renderDayBar(){
  var bar = document.getElementById("dayBar");
  if (!bar) return;
  var b = state.tab === "schedule" ? dayBounds() : null;
  if (!b){ bar.hidden = true; return; }
  var cur = minsNow(), span = b.end - b.start;
  var p = Math.max(0, Math.min(1, (cur - b.start) / span));
  var ticks = b.ranges.slice(1).map(function(r){
    return '<i class="day-tick" style="left:' + (((r.start - b.start) / span) * 100).toFixed(2) + '%"></i>';
  }).join("");
  bar.hidden = false;
  bar.innerHTML =
    '<div class="day-bar-top"><span>' + esc(b.from) + '</span><span id="dayBarLabel">' + esc(dayLabel(b, cur)) +
    '</span><span>' + esc(b.to) + '</span></div>' +
    '<div class="day-track" role="progressbar" aria-label="School day progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
    Math.round(p * 100) + '"><div class="day-fill" id="dayFill" style="--p:' + (p * 100).toFixed(2) + '%"></div>' + ticks + '</div>';
}
function tickDayBar(){
  var fill = document.getElementById("dayFill");
  var lab = document.getElementById("dayBarLabel");
  if (!fill) return;
  var b = dayBounds();
  if (!b) return;
  var cur = minsNow();
  var p = Math.max(0, Math.min(1, (cur - b.start) / (b.end - b.start)));
  fill.style.setProperty("--p", (p * 100).toFixed(2) + "%");
  if (lab){
    var t = dayLabel(b, cur);
    if (lab.textContent !== t) lab.textContent = t;
  }
}

/* One-second tick for the countdown only; a full re-render happens when the
   session actually changes, not every second. */
function tickNow(){
  if (document.hidden || state.tab !== "schedule") return;
  var ti = todayInfo();
  if (!ti.dayNum) return;
  tickDayBar();
  var mode = liveDayMode(ti.info), cur = minsNow();
  var ranges = sessionRanges(mode), lesson = null, idx = -1;
  ranges.forEach(function(r, i){ if (cur >= r.start && cur < r.end){ lesson = r; idx = i; } });

  if (state.nowKey !== mode.key + ":" + idx){ renderNowStrip(); renderLineup(); return; }
  if (!lesson) return;

  var el = document.getElementById("nowCountdown");
  if (el) el.textContent = fmtLeft(lesson.end - cur);
  var ring = document.getElementById("nowRing");
  if (ring){
    var frac = (cur - lesson.start) / (lesson.end - lesson.start);
    ring.setAttribute("stroke-dashoffset", 113.1 * (1 - Math.max(0, Math.min(1, frac))));
  }
}

function renderNextDay(){
  var card = document.getElementById("nextDayCard");
  var wrap = document.getElementById("nextDayRow");
  if (!card || !wrap) return;
  var nd = nextSchoolDay();
  if (!nd){ card.hidden = true; return; }
  card.hidden = false;
  document.getElementById("nextDayWhen").textContent = nd.label + " · " + nd.when;
  var m = liveDayMode(nd.info);
  document.getElementById("nextDayMode").textContent =
    nd.info.day + (m.key === "regular" ? "" : " · " + m.name);
  wrap.innerHTML = "";
  liveSched()[nd.dayNum].slice(0, m.sessions.length).forEach(function(c, i){
    var s = document.createElement("div");
    s.className = "nd-slot";
    s.innerHTML = '<span class="nd-n">S' + (i + 1) + '</span><span class="nd-c"></span>' +
                  '<span class="nd-r"></span>';
    s.querySelector(".nd-c").textContent = c.c;
    s.querySelector(".nd-r").textContent = c.r;
    wrap.appendChild(s);
  });
}

function renderLineup(){
  var wrap = document.getElementById("lineup");
  var card = document.getElementById("lineupCard");
  if (!wrap || !card) return;
  var ti = todayInfo();
  if (!ti.dayNum){ card.hidden = true; return; }
  card.hidden = false;

  var mode = liveDayMode(ti.info);
  var cur = minsNow();
  var ranges = sessionRanges(mode), row = liveSched()[ti.dayNum];

  document.getElementById("lineupTitle").textContent =
    mode.sessions.length + (mode.sessions.length === 1 ? " session" : " sessions");
  document.getElementById("lineupMode").textContent =
    mode.key === "regular" ? "Regular bell schedule" : mode.name + " — times below are today's, not the usual ones";

  wrap.innerHTML = "";
  ranges.forEach(function(r, i){
    var c = row[i];
    var slot = document.createElement("div");
    var live = cur >= r.start && cur < r.end;
    slot.className = "slot" + (live ? " now" : (cur >= r.end ? " past" : ""));
    slot.style.animationDelay = (i * 0.05) + "s";
    var n = document.createElement("div"); n.className = "s-n";
    n.textContent = (live ? "Now · " : "S" + r.n + " · ") + r.time;
    var cc = document.createElement("div"); cc.className = "s-c"; cc.textContent = c.c;
    var m = document.createElement("div"); m.className = "s-m"; m.textContent = c.r + " · " + c.t;
    slot.appendChild(n); slot.appendChild(cc); slot.appendChild(m);
    wrap.appendChild(slot);
  });

  /* Close the day out explicitly, and say what happens to the sessions a
     half day drops. */
  var end = document.createElement("div");
  end.className = "slot end" + (cur >= parseClock(mode.dismissal) ? " past" : "");
  end.style.animationDelay = (ranges.length * 0.05) + "s";
  var en = document.createElement("div"); en.className = "s-n"; en.textContent = mode.dismissLabel;
  var ec = document.createElement("div"); ec.className = "s-c"; ec.textContent = mode.dismissal;
  var em = document.createElement("div"); em.className = "s-m";
  em.textContent = mode.key === "half"
    ? "Sessions 5–6 don't run · staff PLC 1:00"
    : (mode.key === "quick" ? "Quick exit day" : "Clubs from 4:00");
  end.appendChild(en); end.appendChild(ec); end.appendChild(em);
  wrap.appendChild(end);
}

/* ---------- section changes ---------- */
/* A directional glide between sections: forward slides left, back slides
   right, using the browser's view transitions where they exist and a plain
   CSS entrance everywhere else. */
var navBusy = false;
function warpTo(tab){
  if (tab === state.tab || TABS.indexOf(tab) < 0) return;
  var from = TABS.indexOf(state.tab), to = TABS.indexOf(tab);
  document.documentElement.setAttribute("data-dir", to < from ? "back" : "fwd");
  function go(){
    setTab(tab);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  if (REDUCED || !document.startViewTransition || navBusy){ go(); return; }
  navBusy = true;
  var root = document.documentElement;
  root.classList.add("vt-active");
  function done(){ navBusy = false; root.classList.remove("vt-active"); }
  try{
    var vt = document.startViewTransition(go);
    vt.finished.then(done, done);
  }catch(e){ done(); go(); }
}
var warpBusy = false;

/* ---------- header state on scroll ---------- */
function initScrollState(){
  var queued = false, on = false;
  window.addEventListener("scroll", function(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(function(){
      queued = false;
      var next = window.scrollY > 6;
      if (next !== on){ on = next; document.body.classList.toggle("scrolled", on); }
    });
  }, { passive:true });
}

/* ---------- keyboard ---------- */
function initKeyboard(){
  document.addEventListener("keydown", function(e){
    if (paletteOpen()) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= TABS.length){ warpTo(TABS[n - 1]); return; }
    if (e.key === "/"){
      e.preventDefault();
      if (state.tab !== "notebook") setTab("notebook");
      var s = document.getElementById("noteSearch");
      if (s) s.focus();
    }
  });
  initFx();
  initPalette();
  setNavigator(function(tab){ warpTo(tab); });

  var hint = document.getElementById("kbdHint");
  var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var seenHint = false;
  try{ seenHint = localStorage.getItem("3cs_kbd_hint") === "1"; localStorage.setItem("3cs_kbd_hint", "1"); }catch(e){}
  if (hint && fine && !seenHint){
    setTimeout(function(){ hint.classList.add("show"); }, 2200);
    setTimeout(function(){ hint.classList.remove("show"); }, 9500);
  }
}

function boot(){
  initTheme();
  initScrollState();
  initKeyboard();
  wire();
  initLinks();
  initProfile();
  initChat();
  onProfiles(renderHelp);
  renderBell();
  renderScheduleTable(todayInfo().dayNum);
  renderCalendarDow();
  renderCalendar();
  renderLegend();
  renderSubjectSelectors();

  document.getElementById("postAsBtn").textContent = myName();
  paintAuth();
  paintTrustNotes();

  renderNotebookIntro();
  renderNotebook();
  renderHelp();
  renderGlobalBanner();
  applyAdminMode();

  var startTab = "schedule";
  try{
    var lastTab = sessionStorage.getItem("3cs_tab");
    if (lastTab && TABS.indexOf(lastTab) > -1) startTab = lastTab;
  }catch(e){}
  setTab(startTab);
  renderDueSoon();
  requestAnimationFrame(updateTabInk);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateTabInk);
  var inkT = null;
  window.addEventListener("resize", function(){ clearTimeout(inkT); inkT = setTimeout(updateTabInk, 120); });
  var sb = document.getElementById("searchBtn");
  if (sb) sb.addEventListener("click", function(){ showPalette(); });

  // Keep "now" honest without hammering the page: half-minute ticks,
  // and a fresh render whenever the tab comes back into view.
  setInterval(tickNow, 1000);
  setInterval(function(){
    if (document.hidden || state.tab !== "schedule") return;
    renderNowStrip();
    renderLineup();
    renderNextDay();
    renderBell();
  }, 30000);
  document.addEventListener("visibilitychange", function(){
    if (!document.hidden && state.tab === "schedule"){ renderNowStrip(); renderLineup(); }
  });

  initDb();
  /* Everything above has painted its first real content, so the page can
     show without the sections jumping around as they fill in. */
  document.documentElement.classList.add("booted");
}



/* Repaint everything that is derived from the live config. Called when an
   admin edit lands, so a timetable change shows up without a reload. */
function renderLiveConfig(){
  try{
    renderScheduleTable();
    renderBell();
    renderCalendarDow();
    renderCalendar();
    renderHero();
    renderNowStrip();
    renderLineup();
    renderNextDay();
  }catch(e){ /* a half-built DOM during boot is not worth breaking the stream for */ }
}

export { renderLiveConfig, HERO, REDUCED, TABS, WORLD, boot, chipEl, fmtLeft, initKeyboard, minsNow, nextBreak, nextHalfDay, nextSchoolDay, parseClock, renderDayBar, renderHero, renderLineup, renderNextDay, renderNowStrip, sessionRanges, setHeroWord, tickNow, todayInfo, updateTabInk, warpBusy, warpTo };
