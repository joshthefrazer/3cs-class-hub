import { applyAdminMode, paintTrustNotes, setTab, wire } from "./admin.js";
import { renderGlobalBanner } from "./ann.js";
import { initDb, myName, paintAuth } from "./backend.js";
import { calCursor, renderCalendar, renderCalendarDow } from "./cal.js";
import { BELL_MODES, CAL, MONTHS, MONTH_NAMES, SCHED, dayMode } from "./data.js";
import { renderHelp } from "./help.js";
import { renderNotebook, renderNotebookIntro } from "./notebook.js";
import { dayNumberFromLabel, renderBell, renderLegend, renderScheduleTable, renderSubjectSelectors, todayISO } from "./sched.js";
import { state } from "./state.js";
import { esc, svgIcon } from "./text.js";

/* =========================================================
   9. Orbit — starfield, worlds, warp navigation, live "now"
   ========================================================= */
var TABS = ["schedule","notebook","help","calendar","announcements"];
var WORLD = {
  schedule:      { label:"Schedule",      g1:"#2f95d8", g2:"#0a3a66", a:"#2ee6c8" },
  notebook:      { label:"Notebook",      g1:"#d79a48", g2:"#5c3a11", a:"#f5c46a" },
  help:          { label:"Help Board",    g1:"#d95f3c", g2:"#63220f", a:"#ff8a6b" },
  calendar:      { label:"Calendar",      g1:"#6c5ce0", g2:"#2a2470", a:"#9d8cff" },
  announcements: { label:"Announcements", g1:"#d0629b", g2:"#5e1f45", a:"#ff9ec4" }
};
var HERO = {
  notebook:      { eyebrow:"Shared by the class", word:"NOTEBOOK",
    sub:"Everything 3CS is working from — notes, resources, revision checklists. Anyone in the class can add a page." },
  help:          { eyebrow:"Ask · answer · remind", word:"HELP",
    sub:"Stuck on something? Post it. Remember something the class will forget? Post that too." },
  announcements: { eyebrow:"From the front of the room", word:"NOTICES",
    sub:"Official word from admins — closures, schedule changes, and anything pinned to the top of the Hub." }
};

var REDUCED = false;
try{ REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}

/* ---------- starfield ---------- */
var Sky = (function(){
  var cv, ctx, W = 0, H = 0, cx = 0, cy = 0, dpr = 1;
  var stars = [], shooters = [], warp = 0, warpTarget = 0, last = 0, tint = "#2ee6c8";
  var nextShooter = 4000;

  function mk(z){
    return {
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: z == null ? Math.random() : z,
      tw: Math.random() * Math.PI * 2,
      warm: Math.random() < 0.14,
      px: 0, py: 0, seen: false
    };
  }
  function resize(){
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2;
    var target = Math.round(Math.min(560, Math.max(150, (W * H) / 3000)));
    stars = [];
    for (var i = 0; i < target; i++) stars.push(mk());
  }
  function frame(now){
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    warp += (warpTarget - warp) * Math.min(1, dt * 7);
    ctx.clearRect(0, 0, W, H);

    var speed = (REDUCED ? 0 : 0.016) + warp * 0.9;
    var t = now / 1000;
    var hw = W * 0.5, hh = H * 0.5;

    for (var i = 0; i < stars.length; i++){
      var s = stars[i];
      s.z -= speed * dt;
      if (s.z <= 0.03){ stars[i] = mk(1); continue; }

      var sx = cx + (s.x / s.z) * hw;
      var sy = cy + (s.y / s.z) * hh;
      if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60){ stars[i] = mk(1); continue; }

      var size = (1 - s.z) * 1.9 + 0.3;
      var alpha = (0.32 + 0.44 * Math.sin(s.tw + t * 1.6)) * (1 - s.z * 0.55);
      if (alpha < 0.03) alpha = 0.03;

      if (warp > 0.04 && s.seen){
        ctx.strokeStyle = s.warm ? tint : "#ffffff";
        ctx.globalAlpha = Math.min(0.85, alpha + warp * 0.5);
        ctx.lineWidth = Math.max(0.6, size * 0.8);
        ctx.beginPath();
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      } else {
        ctx.fillStyle = s.warm ? tint : "#ffffff";
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, 6.2832);
        ctx.fill();
      }
      s.px = sx; s.py = sy; s.seen = true;
    }

    /* shooting stars — rare, quiet, never during warp */
    if (!REDUCED && warp < 0.05){
      nextShooter -= dt * 1000;
      if (nextShooter <= 0){
        nextShooter = 7000 + Math.random() * 11000;
        shooters.push({
          x: Math.random() * W * 0.7, y: Math.random() * H * 0.45,
          vx: 280 + Math.random() * 200, vy: 110 + Math.random() * 90, life: 1
        });
      }
    }
    for (var k = shooters.length - 1; k >= 0; k--){
      var sh = shooters[k];
      sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt * 0.75;
      if (sh.life <= 0){ shooters.splice(k, 1); continue; }
      var g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.13, sh.y - sh.vy * 0.13);
      g.addColorStop(0, "rgba(255,255,255," + (sh.life * 0.9) + ")");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g; ctx.globalAlpha = 1; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(sh.x - sh.vx * 0.13, sh.y - sh.vy * 0.13);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  return {
    init: function(){
      cv = document.getElementById("starfield");
      if (!cv || !cv.getContext) return;
      ctx = cv.getContext("2d");
      resize();
      var rt = null;
      window.addEventListener("resize", function(){
        clearTimeout(rt);
        rt = setTimeout(resize, 160);
      });
      last = performance.now();
      requestAnimationFrame(frame);
    },
    warp: function(v){ warpTarget = v; },
    tint: function(c){ tint = c; }
  };
})();

/* ---------- worlds ---------- */
function updateEdgePlanets(tab){
  var i = TABS.indexOf(tab);
  if (i < 0) return;
  var pairs = [
    { el: document.getElementById("edgeLeft"),  tab: TABS[(i - 1 + TABS.length) % TABS.length] },
    { el: document.getElementById("edgeRight"), tab: TABS[(i + 1) % TABS.length] }
  ];
  pairs.forEach(function(p){
    if (!p.el) return;
    var w = WORLD[p.tab];
    p.el.setAttribute("data-go", p.tab);
    p.el.style.color = w.a;
    p.el.querySelector(".ep-orb use").setAttribute("href", "#e-" + p.tab);
    p.el.querySelector(".ep-label").textContent = w.label;
    p.el.setAttribute("aria-label", "Go to " + w.label);
  });
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
    s.style.animationDelay = (i * 0.05) + "s";
    s.setAttribute("aria-hidden", "true");
    el.appendChild(s);
  });
}

function todayInfo(){
  var iso = todayISO();
  var info = CAL[iso] || null;
  return { iso: iso, info: info, dayNum: info ? dayNumberFromLabel(info.day) : null };
}

function renderHero(tab){
  var hero = document.getElementById("hero");
  var eyebrow = document.getElementById("heroEyebrow");
  var sub = document.getElementById("heroSub");
  var cta = document.getElementById("heroCta");
  var strip = document.getElementById("nowStrip");
  if (!hero) return;

  var emb = document.getElementById("heroEmblemUse");
  if (emb) emb.querySelector("use").setAttribute("href", "#e-" + tab);
  hero.classList.toggle("compact", tab !== "schedule");
  cta.hidden = tab !== "schedule";
  strip.hidden = tab !== "schedule";

  if (tab === "schedule"){
    var d = new Date(), ti = todayInfo();
    eyebrow.textContent = d.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });
    if (ti.info && ti.info.kind === "holiday"){
      setHeroWord("NO SCHOOL");
      sub.textContent = ti.info.events[0] || "Holiday.";
    } else if (ti.info && ti.info.kind === "async"){
      setHeroWord("ASYNC");
      sub.textContent = "Asynchronous day — work from home, no in-person classes.";
    } else if (ti.dayNum){
      setHeroWord("DAY " + ti.dayNum);
      var extras = (ti.info.events || []).filter(function(e){ return !/^Week \d+$/.test(e); });
      sub.textContent = extras.length
        ? extras.join(" · ")
        : "Day " + ti.dayNum + " of the seven-day cycle. Six sessions, starting at 8:00.";
    } else {
      setHeroWord(d.getDay() === 0 || d.getDay() === 6 ? "WEEKEND" : "NO CLASSES");
      sub.textContent = "Nothing scheduled today — the next cycle day is on the Calendar.";
    }
    renderNowStrip();
    renderLineup();
    renderNextDay();
  } else if (tab === "calendar"){
    var my = MONTHS[calCursor];
    eyebrow.textContent = "The whole school year";
    setHeroWord(MONTH_NAMES[my[1]].toUpperCase());
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
  mode = mode || BELL_MODES.regular;
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
  Object.keys(CAL).forEach(function(k){
    if (k <= today) return;
    if (dayMode(CAL[k]) !== BELL_MODES.half) return;
    if (!best || k < best) best = k;
  });
  if (!best) return null;
  var days = Math.round((Date.parse(best + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000);
  var d = new Date(best + "T00:00:00");
  return {
    days: days, iso: best,
    when: d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" }),
    day: CAL[best].day || ""
  };
}
/* The next date that actually has classes — for the "pack your bag" card. */
function nextSchoolDay(){
  var today = todayISO(), best = null;
  Object.keys(CAL).forEach(function(k){
    if (k <= today) return;
    var info = CAL[k];
    if (!dayNumberFromLabel(info.day)) return;
    if (info.kind === "holiday" || info.kind === "async") return;
    if (!best || k < best) best = k;
  });
  if (!best) return null;
  var d = new Date(best + "T00:00:00");
  var days = Math.round((Date.parse(best + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000);
  return {
    iso: best, info: CAL[best], dayNum: dayNumberFromLabel(CAL[best].day),
    label: days === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday:"long" }),
    when: d.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" })
  };
}
function nextBreak(){
  var today = todayISO(), best = null;
  Object.keys(CAL).forEach(function(k){
    if (k <= today || CAL[k].kind !== "holiday") return;
    if (!best || k < best) best = k;
  });
  if (!best) return null;
  var days = Math.round((Date.parse(best + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000);
  return { days: days, name: (CAL[best].events && CAL[best].events[0]) || "Holiday" };
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
  var mode = dayMode(ti.info);
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
    var row = SCHED[ti.dayNum];
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

  var hd = nextHalfDay();
  if (hd) strip.appendChild(chipEl("Next half day",
    hd.days === 0 ? "Today" : hd.days + (hd.days === 1 ? " day" : " days"),
    hd.when + (hd.day ? " · " + hd.day : "")));

  var br = nextBreak();
  if (br) strip.appendChild(chipEl("Next break", br.days + (br.days === 1 ? " day" : " days"), br.name));
}

/* One-second tick for the countdown only; a full re-render happens when the
   session actually changes, not every second. */
function tickNow(){
  if (document.hidden || state.tab !== "schedule") return;
  var ti = todayInfo();
  if (!ti.dayNum) return;
  var mode = dayMode(ti.info), cur = minsNow();
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
  var m = dayMode(nd.info);
  document.getElementById("nextDayMode").textContent =
    nd.info.day + (m.key === "regular" ? "" : " · " + m.name);
  wrap.innerHTML = "";
  SCHED[nd.dayNum].slice(0, m.sessions.length).forEach(function(c, i){
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

  var mode = dayMode(ti.info);
  var cur = minsNow();
  var ranges = sessionRanges(mode), row = SCHED[ti.dayNum];

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
    n.textContent = (live ? "● now · " : "S" + r.n + " · ") + r.time;
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

/* ---------- warp navigation ---------- */
var warpBusy = false;
function warpTo(tab){
  if (tab === state.tab) return;
  if (REDUCED){ setTab(tab); return; }
  if (warpBusy){ setTab(tab); return; }
  warpBusy = true;
  document.body.classList.add("warping");
  Sky.warp(1);
  setTimeout(function(){ Sky.warp(0); }, 340);
  setTimeout(function(){ setTab(tab); window.scrollTo({ top:0, behavior:"auto" }); }, 250);
  setTimeout(function(){ document.body.classList.remove("warping"); warpBusy = false; }, 820);
}

/* ---------- pointer spotlight ---------- */
function initSpotlight(){
  var queued = false, lastEvt = null;
  document.addEventListener("pointermove", function(e){
    lastEvt = e;
    if (queued) return;
    queued = true;
    requestAnimationFrame(function(){
      queued = false;
      var t = lastEvt.target;
      if (!t || !t.closest) return;
      var el = t.closest(".card, .note-card, .post");
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (((lastEvt.clientX - r.left) / r.width) * 100) + "%");
      el.style.setProperty("--my", (((lastEvt.clientY - r.top) / r.height) * 100) + "%");
    });
  }, { passive:true });
}

/* ---------- scroll parallax ---------- */
function initParallax(){
  if (REDUCED) return;
  var queued = false;
  window.addEventListener("scroll", function(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(function(){
      queued = false;
      document.documentElement.style.setProperty("--planet-shift",
        Math.min(window.scrollY * 0.26, 400) + "px");
    });
  }, { passive:true });
}

/* ---------- keyboard ---------- */
function initKeyboard(){
  document.addEventListener("keydown", function(e){
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
  var hint = document.getElementById("kbdHint");
  if (hint){
    setTimeout(function(){ hint.classList.add("show"); }, 2200);
    setTimeout(function(){ hint.classList.remove("show"); }, 9500);
  }
}

function boot(){
  Sky.init();
  initSpotlight();
  initParallax();
  initKeyboard();
  wire();
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
}


export { HERO, REDUCED, Sky, TABS, WORLD, boot, chipEl, fmtLeft, initKeyboard, initParallax, initSpotlight, minsNow, nextBreak, nextHalfDay, nextSchoolDay, parseClock, renderHero, renderLineup, renderNextDay, renderNowStrip, sessionRanges, setHeroWord, tickNow, todayInfo, updateEdgePlanets, warpBusy, warpTo };
