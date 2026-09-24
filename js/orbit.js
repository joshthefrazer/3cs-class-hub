import { applyAdminMode, paintTrustNotes, setTab, wire } from "./admin.js";
import { renderGlobalBanner } from "./ann.js";
import { initDb, myName, paintAuth } from "./backend.js";
import { renderCalendar, renderCalendarDow } from "./cal.js";
import { liveCal, liveModes, liveSched, liveDayMode } from "./live.js";
import { renderHelp } from "./help.js";
import { renderNotebook, renderNotebookIntro } from "./notebook.js";
import { dayNumberFromLabel, renderBell, renderLegend, renderScheduleTable, renderSubjectSelectors, subjectColor, subjectName, todayISO } from "./sched.js";
import { state } from "./state.js";
import { renderWork, renderWorkFilters, renderDueSoon, workSummary } from "./work.js";
import { initPalette, setNavigator, paletteOpen, showPalette } from "./palette.js";
import { initFx } from "./fx.js";
import { esc, svgIcon } from "./text.js";
import { initTheme } from "./theme.js";
import { initLinks } from "./links.js";
import { initProfile, onProfiles } from "./profile.js";
import { initChat } from "./chat.js";
import { initPeople } from "./people.js";
import { initSettings } from "./settings.js";
import { initCampus } from "./campus.js";
import { initVoice, pollsToAnswer } from "./voice.js";
import { initLayout } from "./layout.js";

/* =========================================================
   TODAY + NAVIGATION

   The front page answers three questions without a click: what day is it
   in the seven-day cycle, what's happening right now, and what's next.
   The day is drawn as a ruler, one block per session, with a marker that
   moves along it in real time.
   ========================================================= */
var TABS = ["schedule", "work", "notebook", "help", "calendar", "announcements", "people", "voice"];

var REDUCED = false;
try{
  REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
            document.documentElement.classList.contains("reduce-motion");
}catch(e){}

/* The marker line under the active section on wide screens. */
function updateTabInk(){
  var nav = document.getElementById("tabs");
  var ink = document.getElementById("tabInk");
  if (!nav || !ink) return;
  var btn = nav.querySelector("button.active");
  if (!btn || !btn.offsetWidth){ ink.style.setProperty("--ink-w", "0px"); return; }
  ink.style.setProperty("--ink-x", (btn.offsetLeft + 10) + "px");
  ink.style.setProperty("--ink-w", Math.max(0, btn.offsetWidth - 20) + "px");
}

/* "Day 7", with the number circled in marker. Other words are just set. */
function setHeroWord(text, num){
  var el = document.getElementById("heroWord");
  if (!el) return;
  el.innerHTML = "";
  el.setAttribute("aria-label", num ? text + " " + num : text);
  var i = 0;
  function letters(str, into){
    String(str).split("").forEach(function(c){
      var s = document.createElement("span");
      s.className = "ch";
      s.textContent = c === " " ? " " : c;
      s.style.setProperty("--i", i++);
      s.setAttribute("aria-hidden", "true");
      into.appendChild(s);
    });
  }
  letters(text + (num ? " " : ""), el);
  if (num){
    var n = document.createElement("span");
    n.className = "num";
    n.setAttribute("aria-hidden", "true");
    letters(num, n);
    el.appendChild(n);
  }
}

function todayInfo(){
  var iso = todayISO();
  var info = liveCal()[iso] || null;
  return { iso: iso, info: info, dayNum: info ? dayNumberFromLabel(info.day) : null };
}
function hasClasses(ti){
  return !!(ti.dayNum && !(ti.info && (ti.info.kind === "holiday" || ti.info.kind === "async")));
}

/* ------------------------------------------------------------ time -- */
function parseClock(t){
  var p = String(t).split(":");
  var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
  if (h < 7) h += 12;                 // 1:00 means 13:00 on a school day
  return h * 60 + m;
}
function sessionRanges(mode){
  mode = mode || liveModes().regular;
  return mode.sessions.map(function(p, i){
    return { n: i + 1, start: parseClock(p[0]), end: parseClock(p[1]),
             time: p[0] + "-" + p[1], from: p[0], to: p[1] };
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
function minsText(m){
  m = Math.max(0, Math.ceil(m));
  if (m >= 60) return Math.floor(m / 60) + "h " + (m % 60 < 10 ? "0" : "") + (m % 60) + "m";
  return m + " min";
}
function daysBetween(a, b){
  return Math.round((Date.parse(b + "T00:00:00") - Date.parse(a + "T00:00:00")) / 86400000);
}
function nextHalfDay(){
  var today = todayISO(), best = null;
  Object.keys(liveCal()).forEach(function(k){
    if (k <= today) return;
    if (liveDayMode(liveCal()[k]) !== liveModes().half) return;
    if (!best || k < best) best = k;
  });
  if (!best) return null;
  var d = new Date(best + "T00:00:00");
  return {
    days: daysBetween(today, best), iso: best,
    when: d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" }),
    day: liveCal()[best].day || ""
  };
}
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
  var days = daysBetween(today, best);
  return {
    iso: best, info: liveCal()[best], dayNum: dayNumberFromLabel(liveCal()[best].day), days: days,
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
  return { days: daysBetween(today, best), name: (liveCal()[best].events && liveCal()[best].events[0]) || "Holiday" };
}

/* Where the day is right now: in a session, between two, before or after. */
function whereNow(){
  var ti = todayInfo();
  if (!hasClasses(ti)) return { kind: "none", ti: ti };
  var mode = liveDayMode(ti.info), ranges = sessionRanges(mode), row = liveSched()[ti.dayNum] || [];
  var cur = minsNow(), end = parseClock(mode.dismissal);
  var out = { ti: ti, mode: mode, ranges: ranges, row: row, cur: cur, end: end };
  for (var i = 0; i < ranges.length; i++){
    var r = ranges[i];
    if (cur >= r.start && cur < r.end){ out.kind = "session"; out.idx = i; out.next = i + 1 < ranges.length ? i + 1 : -1; return out; }
    if (cur < r.start){
      out.kind = i === 0 ? "before" : "gap";
      out.next = i;
      out.prevEnd = i ? ranges[i - 1].end : null;
      return out;
    }
  }
  out.kind = cur < end ? "wrap" : "after";
  return out;
}
function cellOf(w, i){ return (w.row && w.row[i]) || { c: "", r: "", t: "" }; }
function roomLine(c){
  return [c.r, c.t].filter(function(x){ return x && x !== "-" && x !== "-"; }).join(" · ");
}

/* ------------------------------------------------------------ hero -- */
function renderHero(){
  var eyebrow = document.getElementById("heroEyebrow");
  var sub = document.getElementById("heroSub");
  var flag = document.getElementById("modeFlag");
  if (!eyebrow) return;
  var d = new Date(), ti = todayInfo();
  eyebrow.textContent = d.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });
  flag.hidden = true;

  if (ti.info && ti.info.kind === "holiday"){
    setHeroWord("No school");
    sub.textContent = (ti.info.events && ti.info.events[0]) || "It's a holiday.";
  } else if (ti.info && ti.info.kind === "async"){
    setHeroWord("Async day");
    sub.textContent = "Work from home today. There are no in-person classes.";
  } else if (ti.dayNum){
    setHeroWord("Day", String(ti.dayNum));
    var mode = liveDayMode(ti.info);
    var extras = (ti.info.events || []).filter(function(e){ return !/^Week \d+$/.test(e) && !/1\/2 day|quick exit/i.test(e); });
    if (mode.key !== "regular"){
      flag.hidden = false;
      flag.innerHTML = svgIcon("i-clock") + "<span>" + esc(mode.name) + "</span>";
    }
    var base = mode.key === "regular"
      ? "Six sessions today. First bell at " + mode.sessions[0][0] + ", classes end at " + mode.dismissal + "."
      : mode.key === "half"
        ? "Sessions 1 to 4, then dismissal at " + mode.dismissal + "."
        : "Every session is shorter today and the day ends at " + mode.dismissal + ".";
    sub.textContent = extras.length ? extras.join(". ") + ". " + base : base;
  } else {
    setHeroWord(d.getDay() === 0 || d.getDay() === 6 ? "Weekend" : "No classes");
    var nd = nextSchoolDay();
    sub.textContent = nd
      ? "Back to class " + (nd.days === 1 ? "tomorrow" : "on " + nd.label) + ", Day " + nd.dayNum + "."
      : "Nothing scheduled today.";
  }
  renderNowStrip();
  renderLineup();
  renderNextDay();
}

/* The row of small facts under the big day number. */
function stat(icon, value, meta, tone, onClick){
  var el = document.createElement(onClick ? "button" : "div");
  if (onClick){ el.type = "button"; el.addEventListener("click", onClick); }
  el.className = "stat" + (tone ? " " + tone : "");
  el.innerHTML = '<span class="si">' + svgIcon(icon) + '</span><span><b></b><small></small></span>';
  el.querySelector("b").textContent = value;
  el.querySelector("small").textContent = meta || "";
  return el;
}
function renderNowStrip(){
  var strip = document.getElementById("nowStrip");
  if (!strip) return;
  strip.innerHTML = "";
  var w = workSummary();
  if (w.total){
    var big = w.overdue || w.today || w.soon;
    var label = w.overdue ? big + " overdue" : w.today ? big + " due today" : big + " due this week";
    strip.appendChild(stat("i-clipboard", label,
      w.overdue && w.today ? w.today + " more due today" : "Open Work to tick them off",
      w.overdue ? "bad" : w.today ? "hot" : "", function(){ warpTo("work"); }));
  }
  var waiting = pollsToAnswer();
  if (waiting.length) strip.appendChild(stat("i-poll",
    waiting.length === 1 ? "A poll for you" : waiting.length + " polls for you",
    waiting.length === 1 ? waiting[0].question : "Your vote counts", "hot", function(){ warpTo("voice"); }));
  var hd = nextHalfDay();
  if (hd) strip.appendChild(stat("i-clock",
    hd.days === 1 ? "Half day tomorrow" : "Half day in " + hd.days + " days",
    hd.when + (hd.day ? " · " + hd.day : ""), "info"));
  var br = nextBreak();
  if (br) strip.appendChild(stat("i-sun",
    br.days === 1 ? "Break tomorrow" : br.days + " days to the break", br.name, "good"));
  renderNowCard();
  paintWorkTabCount(w);
}
function paintWorkTabCount(w){
  var n = (w.overdue || 0) + (w.today || 0);
  var c = document.getElementById("tabCountWork");
  if (c){ c.hidden = !n; c.textContent = String(n); }
  var dot = document.getElementById("bnWorkDot");
  if (dot) dot.hidden = !n;
}

/* ------------------------------------------------- the right-now card -- */
var RING_C = 2 * Math.PI * 44;
function ring(frac, big, small){
  frac = Math.max(0, Math.min(1, frac));
  return '<div class="nc-ring"><svg viewBox="0 0 104 104" aria-hidden="true">' +
    '<circle class="bg" cx="52" cy="52" r="44"></circle>' +
    '<circle class="fg" id="nowRing" cx="52" cy="52" r="44" stroke-dasharray="' + RING_C.toFixed(1) +
    '" stroke-dashoffset="' + (RING_C * (1 - frac)).toFixed(1) + '"></circle></svg>' +
    '<div class="lbl"><b id="nowCountdown">' + esc(big) + '</b><small>' + esc(small) + '</small></div></div>';
}
function renderNowCard(){
  var card = document.getElementById("nowCard");
  if (!card) return;
  var w = whereNow();
  card.classList.remove("live");
  card.style.removeProperty("--sc");
  state.nowKey = w.kind + ":" + (w.idx != null ? w.idx : w.next);

  if (w.kind === "none" || w.kind === "after"){
    var nd = nextSchoolDay();
    var first = nd ? (liveSched()[nd.dayNum] || [])[0] : null;
    var fm = nd ? liveDayMode(nd.info) : null;
    card.innerHTML =
      '<div class="nc-top">' + svgIcon("i-moon", "sm") + '<span>' + (w.kind === "after" ? "After school" : "Today") + '</span></div>' +
      '<div class="nc-quiet"><div class="big">' + (w.kind === "after" ? "That's the day done." : "No classes today.") + '</div>' +
      (nd ? '<p>' + esc(nd.label) + ' is <b>Day ' + nd.dayNum + '</b>' + (fm && fm.key !== "regular" ? " (" + esc(fm.name.toLowerCase()) + ")" : "") +
            (first ? ', starting with <b>' + esc(first.c) + '</b> at ' + esc(fm.sessions[0][0]) + '.' : ".") + '</p>'
          : '<p>Nothing else is on the calendar yet.</p>') +
      '</div>' +
      (nd ? '<div class="nc-tmrw">' + (liveSched()[nd.dayNum] || []).slice(0, fm.sessions.length).map(function(c){
        return '<span style="--sc:' + subjectColor(c.c) + '">' + esc(c.c) + '</span>';
      }).join("") + '</div>' : '');
    return;
  }

  var nextHtml = "";
  if (w.next != null && w.next > -1 && w.ranges[w.next]){
    var nx = cellOf(w, w.next);
    nextHtml = '<div class="nc-next"><span class="hand">next</span><span><b>' + esc(nx.c) + '</b> at ' +
      esc(w.ranges[w.next].from) + (roomLine(nx) ? " in " + esc(nx.r) : "") + '</span></div>';
  } else {
    nextHtml = '<div class="nc-next"><span class="hand">then</span><span>' + esc(w.mode.dismissLabel) + ' at <b>' + esc(w.mode.dismissal) + '</b></span></div>';
  }

  if (w.kind === "session"){
    var r = w.ranges[w.idx], c = cellOf(w, w.idx);
    card.classList.add("live");
    card.style.setProperty("--sc", subjectColor(c.c));
    card.innerHTML =
      '<div class="nc-top"><span class="live-dot" aria-hidden="true"></span><span>Right now</span><span class="grow"></span><span>Session ' + r.n + '</span></div>' +
      '<div class="nc-body"><div class="nc-main">' +
        '<div class="nc-code">' + esc(c.c || "Free") + '</div>' +
        (subjectName(c.c) ? '<div class="nc-name">' + esc(subjectName(c.c)) + '</div>' : "") +
        '<div class="nc-meta">' + esc([roomLine(c), r.time].filter(Boolean).join(" · ")) + '</div>' +
      '</div>' + ring((w.cur - r.start) / (r.end - r.start), fmtLeft(r.end - w.cur), "left") + '</div>' + nextHtml;
    return;
  }

  /* before the first bell, or a break between two sessions */
  var up = w.ranges[w.next], uc = cellOf(w, w.next);
  var from = w.kind === "before" ? up.start - 60 : w.prevEnd;
  var gap = up.start - (w.prevEnd || up.start);
  var label = w.kind === "before" ? "Before school" : (gap >= 40 ? "Lunch" : "Break");
  card.style.setProperty("--sc", subjectColor(uc.c));
  card.innerHTML =
    '<div class="nc-top">' + svgIcon(w.kind === "before" ? "i-sun" : "i-clock", "sm") + '<span>' + label + '</span></div>' +
    '<div class="nc-body"><div class="nc-main">' +
      '<div class="nc-code">' + esc(uc.c || "Free") + '</div>' +
      '<div class="nc-name">Session ' + up.n + ' starts at ' + esc(up.from) + '</div>' +
      '<div class="nc-meta">' + esc(roomLine(uc)) + '</div>' +
    '</div>' + ring((w.cur - from) / Math.max(1, up.start - from), fmtLeft(up.start - w.cur), "to go") + '</div>' +
    (w.ranges[w.next + 1]
      ? '<div class="nc-next"><span class="hand">after</span><span><b>' + esc(cellOf(w, w.next + 1).c) + '</b> at ' + esc(w.ranges[w.next + 1].from) + '</span></div>'
      : '<div class="nc-next"><span class="hand">then</span><span>' + esc(w.mode.dismissLabel) + ' at <b>' + esc(w.mode.dismissal) + '</b></span></div>');
}

/* ------------------------------------------------------- the ruler -- */
function dayBounds(){
  var ti = todayInfo();
  if (!hasClasses(ti)) return null;
  var mode = liveDayMode(ti.info), ranges = sessionRanges(mode);
  if (!ranges.length) return null;
  var start = ranges[0].start, end = parseClock(mode.dismissal);
  if (!(end > start)) end = ranges[ranges.length - 1].end;
  return { start: start, end: end, ranges: ranges, mode: mode, from: ranges[0].from, to: mode.dismissal, ti: ti };
}
function dayLabel(b, cur){
  if (cur < b.start) return "First bell in <b>" + esc(minsText(b.start - cur)) + "</b>";
  if (cur >= b.end) return "The school day is over";
  return "<b>" + Math.floor(((cur - b.start) / (b.end - b.start)) * 100) + "%</b> through the day · <b>" + esc(minsText(b.end - cur)) + "</b> to go";
}
function renderDayBar(){
  var lab = document.getElementById("dayBar");
  if (!lab) return;
  var b = dayBounds();
  lab.innerHTML = b ? dayLabel(b, minsNow()) : "";
}
function clockLabel(m){
  var h = Math.floor(m / 60), mm = Math.round(m % 60);
  return (h > 12 ? h - 12 : h) + ":" + (mm < 10 ? "0" : "") + mm;
}
function renderLineup(){
  var wrap = document.getElementById("lineup");
  var card = document.getElementById("lineupCard");
  if (!wrap || !card) return;
  var b = dayBounds();
  if (!b){ card.hidden = true; return; }
  card.hidden = false;
  var mode = b.mode, row = liveSched()[b.ti.dayNum] || [];
  var span = b.end - b.start, cur = minsNow();
  function pct(m){ return ((m - b.start) / span) * 100; }

  document.getElementById("lineupTitle").textContent = "Day " + b.ti.dayNum + ", " + b.ranges.length + " sessions";
  document.getElementById("lineupMode").textContent = mode.key === "regular"
    ? "Regular bell schedule"
    : mode.name + ". These are today's times, not the usual ones.";

  var html = '<div class="rl-blocks">';
  b.ranges.forEach(function(r, i){
    var c = row[i] || { c: "", r: "", t: "" };
    var cls = cur >= r.end ? " past" : (cur >= r.start ? " now" : "");
    html += '<div class="rl-block' + cls + '" style="--i:' + i + ';--sc:' + subjectColor(c.c) + ';left:calc(' + pct(r.start).toFixed(3) + '% + 2px);width:calc(' +
      (pct(r.end) - pct(r.start)).toFixed(3) + '% - 4px)" title="' + esc(c.c + (subjectName(c.c) ? ", " + subjectName(c.c) : "") + ", " + r.time) + '">' +
      '<span class="rb-t">S' + r.n + ' · ' + esc(r.from) + '</span>' +
      '<span class="rb-c">' + esc(c.c || "Free") + '</span>' +
      '<span class="rb-m">' + esc(roomLine(c)) + '</span></div>';
    var nx = b.ranges[i + 1];
    if (nx && nx.start - r.end >= 20){
      html += '<div class="rl-gap" style="left:' + pct(r.end).toFixed(3) + '%;width:' + (pct(nx.start) - pct(r.end)).toFixed(3) + '%">' +
        (nx.start - r.end >= 40 ? "lunch" : "break") + '</div>';
    }
  });
  html += '</div>';
  var hours = '';
  for (var m = Math.ceil(b.start / 60) * 60; m < b.end; m += 60){
    if (m - b.start < 15) continue;
    hours += '<span class="rl-lab" style="left:' + pct(m).toFixed(3) + '%">' + clockLabel(m) + '</span>';
  }
  var p = Math.max(0, Math.min(1, (cur - b.start) / span));
  html += '<div class="rl-scale" style="--m5:' + (500 / span).toFixed(4) + '%;--m30:' + (3000 / span).toFixed(4) + '%">' +
    '<div class="rl-fill" id="rulerFill" style="--p:' + (p * 100).toFixed(2) + '%"></div>' +
    '<span class="rl-lab first">' + esc(b.from) + '</span>' + hours + '</div>';
  if (cur >= b.start && cur < b.end){
    html += '<div class="rl-now" id="rulerNow" style="left:' + (p * 100).toFixed(2) + '%;bottom:0;top:auto;height:44px"><span>now</span></div>';
  }
  wrap.innerHTML = html;
  wrap.setAttribute("aria-label", "Today's sessions in order");
  renderDayBar();
}
function tickRuler(){
  var b = dayBounds();
  if (!b) return;
  var cur = minsNow();
  var p = Math.max(0, Math.min(1, (cur - b.start) / (b.end - b.start)));
  var fill = document.getElementById("rulerFill");
  if (fill) fill.style.setProperty("--p", (p * 100).toFixed(2) + "%");
  var now = document.getElementById("rulerNow");
  if (now) now.style.left = (p * 100).toFixed(2) + "%";
  var lab = document.getElementById("dayBar");
  if (lab){
    var t = dayLabel(b, cur);
    if (lab.innerHTML !== t) lab.innerHTML = t;
  }
}

/* One-second tick for the countdown and the ruler; a full re-render only
   happens when the day actually moves into a new session or break. */
function tickNow(){
  if (document.hidden || state.tab !== "schedule") return;
  var w = whereNow();
  var key = w.kind + ":" + (w.idx != null ? w.idx : w.next);
  if (state.nowKey !== key){ renderNowCard(); renderLineup(); return; }
  tickRuler();
  var el = document.getElementById("nowCountdown");
  var ringEl = document.getElementById("nowRing");
  if (w.kind === "session"){
    var r = w.ranges[w.idx];
    if (el) el.textContent = fmtLeft(r.end - w.cur);
    if (ringEl) ringEl.setAttribute("stroke-dashoffset", (RING_C * (1 - Math.max(0, Math.min(1, (w.cur - r.start) / (r.end - r.start))))).toFixed(1));
  } else if (w.kind === "before" || w.kind === "gap"){
    var up = w.ranges[w.next];
    var from = w.kind === "before" ? up.start - 60 : w.prevEnd;
    if (el) el.textContent = fmtLeft(up.start - w.cur);
    if (ringEl) ringEl.setAttribute("stroke-dashoffset", (RING_C * (1 - Math.max(0, Math.min(1, (w.cur - from) / Math.max(1, up.start - from))))).toFixed(1));
  }
}

/* The browser tab says what's on, so a glance at the tab bar is enough:
   "S3 LA · 12m left". Runs whatever section is open. */
var BASE_TITLE = document.title;
function updateNowBits(){
  var w;
  try{ w = whereNow(); }catch(e){ return; }
  var t = BASE_TITLE;
  function mins(x){ x = Math.max(0, Math.ceil(x)); return x >= 60 ? Math.floor(x / 60) + "h " + (x % 60) + "m" : x + "m"; }
  if (w.kind === "session"){
    var c = cellOf(w, w.idx);
    t = "S" + (w.idx + 1) + " " + (c.c || "class") + " · " + mins(w.ranges[w.idx].end - w.cur) + " left | 3CS";
  } else if ((w.kind === "before" || w.kind === "gap") && w.next >= 0){
    var n = cellOf(w, w.next);
    t = (n.c || "Next class") + " in " + mins(w.ranges[w.next].start - w.cur) + " | 3CS";
  }
  if (window.__hubTitle !== t){ window.__hubTitle = t; window.dispatchEvent(new Event("3cs:title")); }
  // light up the cell for right now in the weekly timetable
  var on = w.kind === "session" ? w.idx : -1;
  var cur = document.querySelector("#schedTable td.now");
  var want = on >= 0 ? document.querySelector('#schedTable tr.today td[data-i="' + on + '"]') : null;
  if (cur !== want){
    if (cur) cur.classList.remove("now");
    if (want) want.classList.add("now");
  }
}

function renderNextDay(){
  var card = document.getElementById("nextDayCard");
  var wrap = document.getElementById("nextDayRow");
  if (!card || !wrap) return;
  var nd = nextSchoolDay();
  if (!nd){ card.hidden = true; return; }
  card.hidden = false;
  document.getElementById("nextDayWhen").textContent = nd.label + ", " + nd.when.replace(/^[A-Za-z]+,\s*/, "") + " · Day " + nd.dayNum;
  var m = liveDayMode(nd.info);
  var badge = document.getElementById("nextDayMode");
  badge.textContent = m.key === "regular" ? "Regular day" : m.name;
  badge.className = "badge" + (m.key === "regular" ? "" : " now");
  wrap.innerHTML = "";
  (liveSched()[nd.dayNum] || []).slice(0, m.sessions.length).forEach(function(c, i){
    var s = document.createElement("div");
    s.className = "nd-slot";
    s.style.setProperty("--sc", subjectColor(c.c));
    s.innerHTML = '<span class="nd-n">S' + (i + 1) + ' · ' + esc(m.sessions[i][0]) + '</span><span class="nd-c"></span><span class="nd-r"></span>';
    s.querySelector(".nd-c").textContent = c.c;
    s.querySelector(".nd-r").textContent = roomLine(c);
    wrap.appendChild(s);
  });
}

/* ---------------------------------------------------- section changes -- */
/* A directional glide between sections: forward slides left, back slides
   right, using the browser's view transitions where they exist and a plain
   CSS entrance everywhere else. */
var navBusy = false;
function warpTo(tab){
  if (tab === state.tab || TABS.indexOf(tab) < 0) return;
  var from = TABS.indexOf(state.tab), to = TABS.indexOf(tab);
  document.documentElement.setAttribute("data-dir", to < from ? "back" : "fwd");
  // each section remembers how far down you were, for this visit
  scrollMemo[state.tab] = window.scrollY;
  function go(){
    setTab(tab);
    var y = scrollMemo[tab] || 0;
    window.scrollTo({ top: y, behavior: "instant" });
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
var scrollMemo = {};

/* The header gets a line under it once the page scrolls. An observer on a
   pixel at the top does this without listening to every scroll event. */
function initScrollState(){
  var s = document.createElement("div");
  s.style.cssText = "position:absolute;top:0;left:0;width:1px;height:6px;pointer-events:none";
  s.setAttribute("aria-hidden", "true");
  document.body.prepend(s);
  if (!("IntersectionObserver" in window)) return;
  new IntersectionObserver(function(en){
    document.body.classList.toggle("scrolled", !en[0].isIntersecting);
  }).observe(s);
}

/* ------------------------------------------------------------ keyboard -- */
function initKeyboard(){
  document.addEventListener("keydown", function(e){
    if (paletteOpen()) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector(".sheet:not([hidden]), .console:not([hidden]), .lightbox")) return;
    if (document.body.classList.contains("chat-open")) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= TABS.length){ warpTo(TABS[n - 1]); return; }
    if (e.key === "/"){
      e.preventDefault();
      showPalette();
    }
  });
  initFx();
  initPalette();
  setNavigator(function(tab){ warpTo(tab); });
}

function boot(){
  initTheme();
  initScrollState();
  initKeyboard();
  wire();
  initLinks();
  initProfile();
  initChat();
  initPeople();
  initSettings();
  initCampus();
  initVoice();
  initLayout();
  window.__updateTabInk = updateTabInk;
  window.addEventListener("3cs:polls", function(){ if (state.tab === "schedule") renderNowStrip(); });
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
  renderHero();
  renderDueSoon();
  requestAnimationFrame(updateTabInk);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateTabInk);
  var inkT = null;
  window.addEventListener("resize", function(){ clearTimeout(inkT); inkT = setTimeout(function(){ updateTabInk(); }, 120); });
  var sb = document.getElementById("searchBtn");
  if (sb) sb.addEventListener("click", function(){ showPalette(); });

  setInterval(tickNow, 1000);
  updateNowBits();
  setInterval(function(){ if (!document.hidden) updateNowBits(); }, 15000);
  setInterval(function(){
    if (document.hidden || state.tab !== "schedule") return;
    renderHero();
    renderBell();
  }, 60000);
  document.addEventListener("visibilitychange", function(){
    if (!document.hidden && state.tab === "schedule") renderHero();
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
    updateNowBits();
    renderBell();
    renderCalendarDow();
    renderCalendar();
    renderHero();
  }catch(e){ /* a half-built DOM during boot is not worth breaking the stream for */ }
}

export {
  renderLiveConfig, REDUCED, TABS, boot, fmtLeft, initKeyboard, minsNow, nextBreak, nextHalfDay,
  nextSchoolDay, parseClock, renderDayBar, renderHero, renderLineup, renderNextDay, renderNowStrip,
  sessionRanges, setHeroWord, tickNow, todayInfo, updateTabInk, warpBusy, warpTo
};
