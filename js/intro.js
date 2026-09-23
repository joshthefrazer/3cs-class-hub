/* =========================================================
   INTRO — the opening sequence.

   1. Credits: Joshua Malic, concept development, and a plain heads-up
      that he didn't write the code.
   2. Claude at work: an editor typing, code falling behind it.
   3. The welcome: the Itz'at STEAM Academy logo draws itself in, then 3CS.

   It plays on the first visit of each day (the inline script in <head>
   decides that before first paint), can be skipped at any point with the
   button or Esc, and can be replayed from the footer or the search box.
   With reduced motion on, the same scenes simply cross-fade.
   ========================================================= */

var root = document.documentElement;
var timers = [];
var rainStop = null, typeStop = null;
var running = false;

var REDUCED = false;
try{ REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}

function later(fn, ms){ timers.push(setTimeout(fn, ms)); }
function clearTimers(){ timers.forEach(clearTimeout); timers = []; }

/* ------------------------------------------------------------- text -- */
function splitLetters(el, text){
  if (!el || el.dataset.split === "1") return;
  el.dataset.split = "1";
  el.textContent = "";
  var i = 0;
  text.split(" ").forEach(function(word){
    var w = document.createElement("span");
    w.className = "w";
    w.setAttribute("aria-hidden", "true");
    word.split("").forEach(function(ch){
      var c = document.createElement("span");
      c.className = "c";
      c.textContent = ch;
      c.style.setProperty("--i", i++);
      w.appendChild(c);
    });
    el.appendChild(w);
  });
}

/* ------------------------------------------------------------- logo -- */
var logoReady = null;
function loadLogo(){
  if (logoReady) return logoReady;
  var box = document.getElementById("introLogo");
  logoReady = fetch("assets/itzat-logo.svg").then(function(r){ return r.text(); }).then(function(svg){
    if (!box) return;
    box.innerHTML = svg;
    var s = box.querySelector("svg");
    if (s){ s.setAttribute("aria-hidden", "true"); s.removeAttribute("role"); }
    box.querySelectorAll(".lg-glyph path").forEach(function(p){
      p.setAttribute("pathLength", "1");
      p.style.stroke = p.getAttribute("fill");
    });
  }).catch(function(){
    if (box) box.innerHTML = '<img src="assets/itzat-logo.svg" alt="" style="width:100%">';
  });
  return logoReady;
}

/* ------------------------------------------------------ code typing -- */
var CODE = [
  [["c","// 3CS Class Hub — written by Claude"]],
  [["k","import"],["t"," { today, schedule } "],["k","from"],["s"," \"./itzat.js\""],["t",";"]],
  [],
  [["k","const"],["t"," hub = "],["f","createHub"],["t","({"]],
  [["t","  school: "],["s","\"Itz'at STEAM Academy\""],["t",","]],
  [["t","  class:  "],["s","\"3CS\""],["t",","]],
  [["t","  colors: ["],["s","\"purple\""],["t",", "],["s","\"white\""],["t",", "],["s","\"orange\""],["t",", "],["s","\"blue\""],["t","],"]],
  [["t","});"]],
  [],
  [["t","hub."],["f","add"],["t","(schedule, work, notes, chat);"]],
  [["t","hub."],["f","welcome"],["t","(everyone);  "],["c","// ready"]]
];
var STEPS = [
  "Laying out today's schedule…",
  "Wiring up the class chat…",
  "Mixing purple, orange and blue…",
  "Polishing the animations…"
];

function typeCode(duration){
  var pre = document.getElementById("introCode");
  var status = document.getElementById("introStatus");
  var label = document.getElementById("introBuild");
  if (!pre) return function(){};
  pre.innerHTML = "";
  if (status) status.classList.remove("done");
  var chars = [];
  CODE.forEach(function(line, li){
    line.forEach(function(seg){ seg[1].split("").forEach(function(ch){ chars.push({ c: seg[0], ch: ch }); }); });
    if (li < CODE.length - 1) chars.push({ c: "t", ch: "\n" });
  });
  var cursor = document.createElement("span");
  cursor.className = "cur";
  var shown = 0, spanCls = null, span = null, stopped = false, t0 = performance.now();

  function finish(){
    if (label) label.textContent = "Build complete · 0 errors";
    if (status) status.classList.add("done");
  }
  if (REDUCED){
    chars.forEach(function(x){ add(x); });
    pre.appendChild(cursor);
    finish();
    return function(){};
  }
  function add(x){
    if (x.c !== spanCls || !span){
      span = document.createElement("span");
      if (x.c !== "t") span.className = x.c;
      pre.appendChild(span);
      spanCls = x.c;
    }
    span.textContent += x.ch;
  }
  function frame(now){
    if (stopped) return;
    var want = Math.min(chars.length, Math.floor(((now - t0) / duration) * chars.length));
    if (want > shown){
      if (cursor.parentNode) cursor.remove();
      while (shown < want) add(chars[shown++]);
      pre.appendChild(cursor);
      var step = Math.min(STEPS.length - 1, Math.floor((shown / chars.length) * STEPS.length));
      if (label && shown < chars.length) label.textContent = STEPS[step];
    }
    if (shown >= chars.length){ finish(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return function(){ stopped = true; };
}

/* ------------------------------------------------------- code rain -- */
function startRain(){
  var cv = document.getElementById("introRain");
  if (!cv || !cv.getContext || REDUCED) return function(){};
  var ctx = cv.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var FS = W < 600 ? 13 : 15, colW = FS + 5;
  var cols = Math.ceil(W / colW);
  var glyphs = "{}[]()<>=+-*/;:.,!?&|#$01constletifelsereturnfunctionhub3CS".split("");
  var tints = ["#9C80FF", "#FF8B45", "#6E9BFF", "#C9B6FF"];
  var drops = [];
  for (var i = 0; i < cols; i++){
    drops.push({ y: Math.random() * -H / FS, v: 0.35 + Math.random() * 0.65, tint: tints[i % tints.length] });
  }
  ctx.font = "600 " + FS + "px 'JetBrains Mono', monospace";
  var stopped = false, last = 0;
  function frame(now){
    if (stopped) return;
    requestAnimationFrame(frame);
    if (now - last < 33) return;          // ~30fps is plenty for this
    last = now;
    ctx.fillStyle = "rgba(13,8,32,0.2)";
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < drops.length; i++){
      var d = drops[i];
      var ch = glyphs[(Math.random() * glyphs.length) | 0];
      var y = d.y * FS;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(ch, i * colW, y);
      ctx.fillStyle = d.tint;
      ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * colW, y - FS);
      d.y += d.v;
      if (y > H + FS * 4 && Math.random() > 0.96) d.y = Math.random() * -12;
    }
  }
  requestAnimationFrame(frame);
  return function(){ stopped = true; ctx.clearRect(0, 0, W, H); };
}

/* --------------------------------------------------------- timeline -- */
function introEl(){ return document.getElementById("intro"); }

function setScene(n){
  var el = introEl();
  if (!el) return;
  el.classList.remove("play-1", "play-2", "play-3");
  if (n) el.classList.add("play-" + n);
}

function finish(){
  if (!running) return;
  running = false;
  clearTimers();
  if (rainStop){ rainStop(); rainStop = null; }
  if (typeStop){ typeStop(); typeStop = null; }
  var el = introEl();
  try{ localStorage.setItem("3cs_intro_day", new Date().toDateString()); }catch(e){}
  document.removeEventListener("keydown", onKey, true);
  if (!el){ root.classList.remove("intro-on"); return; }
  el.classList.add("leaving");
  document.body.classList.add("entering");
  setTimeout(function(){
    root.classList.remove("intro-on");
    el.classList.remove("leaving", "running", "calm", "play-1", "play-2", "play-3");
    try{ el.inert = true; }catch(e){}
    var main = document.getElementById("main");
    if (main && document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
  }, REDUCED ? 350 : 950);
  setTimeout(function(){ document.body.classList.remove("entering"); }, 1400);
}

function onKey(e){
  if (!running) return;
  if (e.key === "Escape" || e.key === "Enter"){ e.preventDefault(); e.stopPropagation(); finish(); }
  if (e.key === "Tab"){ e.preventDefault(); var b = document.getElementById("introSkip"); if (b) b.focus(); }
}

function play(){
  var el = introEl();
  if (!el){ root.classList.remove("intro-on"); return; }
  window.__introStarted = true;
  clearTimers();
  running = true;
  try{ el.inert = false; }catch(e){}
  root.classList.add("intro-on");
  el.classList.remove("leaving", "running", "play-1", "play-2", "play-3");
  el.classList.toggle("calm", REDUCED);
  void el.offsetWidth;                         // restart the CSS animations

  splitLetters(document.getElementById("introName"), "Joshua Malic");
  splitLetters(document.getElementById("introTitle"), "3CS");
  loadLogo();

  var T = REDUCED ? { s2: 4800, s3: 7800, out: 10600 } : { s2: 5600, s3: 10200, out: 14400 };
  el.style.setProperty("--intro-total", (T.out / 1000) + "s");
  el.classList.add("running");
  setScene(1);
  later(function(){
    setScene(2);
    rainStop = startRain();
    typeStop = typeCode(2900);
  }, T.s2);
  later(function(){
    loadLogo().then(function(){ setScene(3); });
    later(function(){ if (rainStop){ rainStop(); rainStop = null; } }, 900);
  }, T.s3);
  later(finish, T.out);

  var skip = document.getElementById("introSkip");
  if (skip){
    skip.onclick = finish;
    setTimeout(function(){ try{ skip.focus({ preventScroll:true }); }catch(e){} }, 50);
  }
  document.addEventListener("keydown", onKey, true);
}

/* Called once at start-up: plays only if <head> decided today needs it. */
function startIntro(){
  if (root.classList.contains("intro-on")) play();
  else { var el = introEl(); try{ if (el) el.inert = true; }catch(e){} }
}
function replayIntro(){ play(); }

export { startIntro, replayIntro };
