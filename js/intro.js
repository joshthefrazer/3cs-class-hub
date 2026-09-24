import { latest } from "./updates.js";

/* =========================================================
   WELCOME - the opening sequence, about half a minute long.

   1. What's new    the latest version, what was added and what was fixed
   2. Thank you     Joshua Malic in the spotlight for the concept, then
                    Alejhandro Morales and Stoney Jones, and a plain note
                    that the code was written by an AI
   3. Claude        the AI that wrote the code, at work
   4. Welcome       the Itz'at STEAM Academy logo draws itself, then 3CS

   Settings decides when it plays (first visit each day, only after an
   update, or never). It can be skipped at any moment with the button, Esc
   or Enter, and each chapter can be jumped to from the bar at the bottom.
   With reduced motion the scenes simply cross-fade.
   ========================================================= */

var root = document.documentElement;
var timers = [];
var stops = [];
var running = false;
var startedAt = 0;

function reduced(){
  try{ return window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("reduce-motion"); }catch(e){ return false; }
}
function later(fn, ms){ timers.push(setTimeout(fn, ms)); }
function clearTimers(){ timers.forEach(clearTimeout); timers = []; }
function stopFx(){ stops.forEach(function(f){ try{ f(); }catch(e){} }); stops = []; }
function h(tag, cls, text){
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function letters(el, text, cls){
  el.textContent = "";
  el.setAttribute("aria-label", text);
  var i = 0;
  text.split(" ").forEach(function(word, wi, arr){
    var w = h("span", "w");
    w.setAttribute("aria-hidden", "true");
    word.split("").forEach(function(ch){
      var c = h("span", cls || "c", ch);
      c.style.setProperty("--i", i++);
      w.appendChild(c);
    });
    el.appendChild(w);
    if (wi < arr.length - 1) el.appendChild(document.createTextNode(" "));
  });
}

/* ------------------------------------------------------------ scenes -- */
var CHAPTERS = [
  { key: "a", label: "What's new", ms: 9000 },
  { key: "b", label: "Thank you",  ms: 9000 },
  { key: "c", label: "Claude",     ms: 8000 },
  { key: "d", label: "Welcome",    ms: 9000 }
];

function buildScenes(box){
  var rel = latest();
  box.innerHTML = "";
  box.appendChild(h("div", "in-grid"));
  var fx = h("canvas", "in-fx"); fx.id = "introFx"; fx.setAttribute("aria-hidden", "true");
  box.appendChild(fx);

  /* 1 - what's new */
  var a = h("section", "scene sa");
  a.setAttribute("aria-label", "What's new in version " + rel.version);
  a.innerHTML =
    '<div class="sa-wrap">' +
      '<div class="sa-left">' +
        '<div class="in-kicker">3CS Class Hub</div>' +
        '<div class="sa-ver"><span class="v">v</span><span class="n"></span></div>' +
        '<h2 class="sa-title"></h2>' +
        '<div class="sa-date"></div>' +
        '<div class="hand sa-note">here\'s what changed</div>' +
      '</div>' +
      '<div class="sa-right">' +
        '<div class="sa-col"><h3>New</h3><ul class="sa-list new"></ul></div>' +
        '<div class="sa-col"><h3>Fixed</h3><ul class="sa-list fixed"></ul></div>' +
      '</div>' +
    '</div>';
  a.querySelector(".sa-ver .n").textContent = rel.version;
  a.querySelector(".sa-title").textContent = rel.title;
  a.querySelector(".sa-date").textContent = rel.date;
  var i = 0;
  rel.added.slice(0, 7).forEach(function(t){
    var li = h("li", null, t); li.style.setProperty("--i", i++);
    a.querySelector(".sa-list.new").appendChild(li);
  });
  rel.fixed.slice(0, 4).forEach(function(t){
    var li = h("li", null, t); li.style.setProperty("--i", i++);
    a.querySelector(".sa-list.fixed").appendChild(li);
  });
  box.appendChild(a);

  /* 2 - thank you */
  var b = h("section", "scene sb");
  b.setAttribute("aria-label", "Credits");
  b.innerHTML =
    '<div class="sb-spot" aria-hidden="true"></div>' +
    '<div class="sb-dust" aria-hidden="true">' + new Array(18).join("<i></i>") + '</div>' +
    '<div class="sb-wrap">' +
      '<div class="hand sb-kicker">thank you for the support</div>' +
      '<div class="sb-lead">Concept development</div>' +
      '<h1 class="sb-name" id="introName">Joshua Malic</h1>' +
      '<p class="sb-note"><b>Heads-up:</b> Joshua came up with the ideas and guided every step. He didn\'t write the code. Claude, an AI, wrote every line.</p>' +
      '<div class="sb-cards">' +
        '<div class="sb-card c1"><span class="sb-av">AM</span><div><b>Alejhandro Morales</b><small>Helped Joshua get more out of Claude</small></div></div>' +
        '<div class="sb-card c2"><span class="sb-av">SJ</span><div><b>Stoney Jones</b><small>Came up with a few of the ideas</small></div></div>' +
      '</div>' +
    '</div>';
  box.appendChild(b);

  /* 3 - Claude at work */
  var c = h("section", "scene sc");
  c.setAttribute("aria-label", "Built by Claude");
  var ring = "";
  var glyphs = "{ } < / > ( ) ; = + [ ] * # 0 1 & |".split(" ");
  for (var k = 0; k < 18; k++) ring += '<span style="--k:' + k + '">' + glyphs[k % glyphs.length] + '</span>';
  c.innerHTML =
    '<div class="sc-sweep" aria-hidden="true"></div>' +
    '<div class="sc-wrap">' +
      '<div class="sc-center">' +
        '<div class="sc-stage" aria-hidden="true"><div class="sc-ring">' + ring + '</div>' +
          '<svg class="sc-mark" viewBox="0 0 80 80"><path class="bl" pathLength="1" d="M26 22 10 40l16 18"/><path class="br" pathLength="1" d="M54 22l16 18-16 18"/><rect class="caret" x="35" y="48" width="12" height="8" rx="2"/></svg>' +
        '</div>' +
        '<h2 class="sc-name" id="introClaude">Claude</h2>' +
        '<div class="sc-sub">An AI model made by Anthropic</div>' +
        '<div class="sc-role">Wrote every line of the Hub</div>' +
      '</div>' +
      '<div class="sc-editor" aria-hidden="true">' +
        '<div class="ed-bar"><i></i><i></i><i></i><span>3cs-class-hub / js / chat.js</span></div>' +
        '<pre class="ed-code" id="introCode"></pre>' +
        '<div class="ed-status"><span class="spin"></span><span id="introBuild">Building the Hub</span></div>' +
      '</div>' +
    '</div>';
  box.appendChild(c);

  /* 4 - the school, then 3CS */
  var d = h("section", "scene sd");
  d.setAttribute("aria-label", "Welcome to 3CS");
  d.innerHTML =
    '<div class="sd-photos" aria-hidden="true">' + INTRO_PHOTOS.map(function(p, k){
      return '<i style="--k:' + k + ';background-image:url(assets/campus/' + p + '-1440.webp)"></i>';
    }).join("") + '</div>' +
    '<div class="sd-rays" aria-hidden="true"></div>' +
    '<div class="sd-logo" id="introLogo" role="img" aria-label="Itz\'at STEAM Academy"></div>' +
    '<div class="sd-welcome">' +
      '<div class="sd-hello">Welcome to</div>' +
      '<h1 class="sd-title" id="introTitle">3CS</h1>' +
      '<div class="sd-sub">Class Hub <i aria-hidden="true"></i> 2026-2027</div>' +
    '</div>' +
    '<div class="sd-confetti" aria-hidden="true">' + (function(){
      var s = "", cols = ["#FF8A4C", "#B98CFF", "#7EA3FF", "#FFD34D", "#4FCB95", "#FF7A8A"];
      for (var q = 0; q < 40; q++) s += '<i style="--x:' + ((q * 53) % 100) + ';--d:' + ((q * 37) % 10) / 10 + ';--c:' + cols[q % cols.length] + ';--r:' + ((q * 71) % 360) + 'deg"></i>';
      return s;
    })() + '</div>';
  box.appendChild(d);

  /* chrome: skip, chapters */
  var skip = h("button", "intro-skip");
  skip.type = "button"; skip.id = "introSkip";
  skip.innerHTML = "Skip <kbd>Esc</kbd>";
  box.appendChild(skip);
  var bar = h("nav", "intro-chapters");
  bar.setAttribute("aria-label", "Chapters");
  CHAPTERS.forEach(function(ch, n){
    var btn = h("button", "ic-ch");
    btn.type = "button";
    btn.dataset.n = n;
    btn.innerHTML = '<span class="ic-fill"></span><span class="ic-lbl"></span>';
    btn.querySelector(".ic-lbl").textContent = ch.label;
    btn.setAttribute("aria-label", "Jump to " + ch.label);
    bar.appendChild(btn);
  });
  box.appendChild(bar);

  letters(b.querySelector(".sb-name"), "Joshua Malic");
  letters(c.querySelector(".sc-name"), "Claude");
  letters(d.querySelector(".sd-title"), "3CS");
}

/* the real campus fades in behind "Welcome to 3CS" */
var INTRO_PHOTOS = ["front", "courtyard", "wings"];
function preloadPhotos(){
  INTRO_PHOTOS.forEach(function(p){ var i = new Image(); i.decoding = "async"; i.src = "assets/campus/" + p + "-1440.webp"; });
}

/* --------------------------------------------------------- the logo -- */
var logoReady = null;
function loadLogo(){
  if (logoReady) return logoReady;
  logoReady = fetch("assets/itzat-logo.svg").then(function(r){ return r.text(); }).then(function(svg){
    var box = document.getElementById("introLogo");
    if (!box) return;
    box.innerHTML = svg;
    var s = box.querySelector("svg");
    if (s){ s.setAttribute("aria-hidden", "true"); s.removeAttribute("role"); }
    box.querySelectorAll(".lg-glyph path").forEach(function(p){ p.setAttribute("pathLength", "1"); });
  }).catch(function(){
    var box = document.getElementById("introLogo");
    if (box) box.innerHTML = '<img src="assets/itzat-logo.svg" alt="" style="width:100%">';
  });
  return logoReady;
}

/* ------------------------------------------------------ code typing -- */
var CODE = [
  [["c","// messages for 3CS, written by Claude"]],
  [["k","export function"],["f"," sendTo"],["t","(chat, message) {"]],
  [["t","  "],["k","const"],["t"," row = { ...message, "],["t","sentAt: "],["f","serverTime"],["t","() };"]],
  [["t","  "],["k","if"],["t"," (!row.text && !row.sticker) "],["k","return"],["t",";"]],
  [["t","  "],["k","return"],["t"," db."],["f","add"],["t","(chat, row);"]],
  [["t","}"]],
  [],
  [["t","hub."],["f","add"],["t","(timeline, people, stickers, gifs);"]],
  [["t","hub."],["f","welcome"],["t","("],["s","\"3CS\""],["t",");  "],["c","// ready"]]
];
var STEPS = ["Drawing the timeline", "Wiring up messages", "Animating the stickers", "Final checks"];

function typeCode(duration){
  var pre = document.getElementById("introCode");
  var label = document.getElementById("introBuild");
  if (!pre) return function(){};
  pre.innerHTML = "";
  var status = pre.parentNode.querySelector(".ed-status");
  if (status) status.classList.remove("done");
  var chars = [];
  CODE.forEach(function(line, li){
    line.forEach(function(seg){ seg[1].split("").forEach(function(ch){ chars.push({ c: seg[0], ch: ch }); }); });
    if (li < CODE.length - 1) chars.push({ c: "t", ch: "\n" });
  });
  var cursor = h("span", "cur");
  var shown = 0, spanCls = null, span = null, stopped = false, t0 = performance.now();
  function add(x){
    if (x.c !== spanCls || !span){
      span = document.createElement("span");
      if (x.c !== "t") span.className = x.c;
      pre.appendChild(span);
      spanCls = x.c;
    }
    span.textContent += x.ch;
  }
  function finish(){
    if (label) label.textContent = "Build complete, 0 errors";
    if (status) status.classList.add("done");
  }
  if (reduced()){ chars.forEach(add); pre.appendChild(cursor); finish(); return function(){}; }
  function frame(now){
    if (stopped) return;
    var want = Math.min(chars.length, Math.floor(((now - t0) / duration) * chars.length));
    if (want > shown){
      if (cursor.parentNode) cursor.remove();
      while (shown < want) add(chars[shown++]);
      pre.appendChild(cursor);
      if (label && shown < chars.length) label.textContent = STEPS[Math.min(STEPS.length - 1, Math.floor((shown / chars.length) * STEPS.length))];
    }
    if (shown >= chars.length){ finish(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return function(){ stopped = true; };
}

/* ------------------------------------------------------- canvas fx -- */
function canvas(){
  var cv = document.getElementById("introFx");
  if (!cv || !cv.getContext) return null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = cv.clientWidth || innerWidth, H = cv.clientHeight || innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  var ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cv: cv, ctx: ctx, W: W, H: H };
}

/* Falling code, in the Hub's colours, for Claude's scene. */
function startRain(){
  if (reduced()) return function(){};
  var c = canvas(); if (!c) return function(){};
  var ctx = c.ctx, W = c.W, H = c.H;
  var FS = W < 600 ? 13 : 15, colW = FS + 6;
  var cols = Math.ceil(W / colW);
  var glyphs = "{}[]()<>=+-*/;:.,!?&|#01constletifreturnhub3CSchat".split("");
  var tints = ["#B793F0", "#FF9A5E", "#8FB0FF", "#D9C8F7"];
  var drops = [];
  for (var i = 0; i < cols; i++) drops.push({ y: Math.random() * -H / FS, v: .3 + Math.random() * .7, tint: tints[i % tints.length] });
  ctx.font = "600 " + FS + "px 'JetBrains Mono', monospace";
  var stopped = false, last = 0;
  function frame(now){
    if (stopped) return;
    requestAnimationFrame(frame);
    if (now - last < 33) return;
    last = now;
    ctx.fillStyle = "rgba(14,11,26,0.22)";
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < drops.length; i++){
      var d = drops[i], y = d.y * FS;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * colW, y);
      ctx.fillStyle = d.tint;
      ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * colW, y - FS);
      d.y += d.v;
      if (y > H + FS * 4 && Math.random() > .96) d.y = Math.random() * -12;
    }
  }
  requestAnimationFrame(frame);
  return function(){ stopped = true; ctx.clearRect(0, 0, W, H); };
}

/* Sparks that gather into the middle while the logo draws, then burst. */
function startGather(){
  if (reduced()) return function(){};
  var c = canvas(); if (!c) return function(){};
  var ctx = c.ctx, W = c.W, H = c.H, cx = W / 2, cy = H * .42;
  var cols = ["#B793F0", "#FF9A5E", "#8FB0FF", "#FFE08A"];
  var P = [];
  for (var i = 0; i < 140; i++){
    var ang = Math.random() * Math.PI * 2, r = Math.max(W, H) * (.45 + Math.random() * .5);
    P.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, s: 1 + Math.random() * 2.2, c: cols[i % cols.length], k: .018 + Math.random() * .03 });
  }
  var stopped = false, t0 = performance.now();
  function frame(now){
    if (stopped) return;
    requestAnimationFrame(frame);
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < P.length; i++){
      var p = P[i];
      if (t < 2.4){ p.x += (cx - p.x) * p.k; p.y += (cy - p.y) * p.k; }
      else { var dx = p.x - cx, dy = p.y - cy, dd = Math.hypot(dx, dy) || 1; p.x += dx / dd * 9 * p.s; p.y += dy / dd * 9 * p.s; }
      ctx.globalAlpha = t < 2.4 ? .9 : Math.max(0, 1 - (t - 2.4) * 1.2);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (t > 3.4) stopped = true;
  }
  requestAnimationFrame(frame);
  return function(){ stopped = true; ctx.clearRect(0, 0, W, H); };
}

/* ---------------------------------------------------------- timeline -- */
function introEl(){ return document.getElementById("intro"); }

function setScene(key){
  var el = introEl();
  if (!el) return;
  CHAPTERS.forEach(function(ch){ el.classList.remove("play-" + ch.key); });
  if (key) el.classList.add("play-" + key);
  var n = -1;
  CHAPTERS.forEach(function(ch, i){ if (ch.key === key) n = i; });
  el.querySelectorAll(".ic-ch").forEach(function(b, i){
    b.classList.toggle("done", i < n);
    b.classList.toggle("on", i === n);
    var f = b.querySelector(".ic-fill");
    if (f){
      f.style.animation = "none";
      void f.offsetWidth;
      f.style.animation = i === n ? "chFill " + CHAPTERS[i].ms + "ms linear forwards" : "";
    }
  });
}

function runFrom(n){
  clearTimers();
  stopFx();
  var t = 0;
  for (var i = n; i < CHAPTERS.length; i++){
    (function(ch, at){
      later(function(){
        stopFx();
        setScene(ch.key);
        if (ch.key === "c"){
          stops.push(startRain());
          stops.push(typeCode(4600));
        }
        if (ch.key === "d"){
          loadLogo().then(function(){ if (running) stops.push(startGather()); });
        }
      }, at);
    })(CHAPTERS[i], t);
    t += reduced() ? Math.min(CHAPTERS[i].ms, 6000) : CHAPTERS[i].ms;
  }
  later(finish, t);
}

function finish(){
  if (!running) return;
  running = false;
  clearTimers();
  stopFx();
  var el = introEl();
  try{
    localStorage.setItem("3cs_intro_day", new Date().toDateString());
    localStorage.setItem("3cs_intro_ver", window.HUB_VERSION || "");
  }catch(e){}
  document.removeEventListener("keydown", onKey, true);
  if (!el){ root.classList.remove("intro-on"); return; }
  el.classList.add("leaving");
  document.body.classList.add("entering");
  setTimeout(function(){
    root.classList.remove("intro-on");
    el.classList.remove("leaving", "running", "calm");
    CHAPTERS.forEach(function(ch){ el.classList.remove("play-" + ch.key); });
    try{ el.inert = true; }catch(e){}
    if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
  }, reduced() ? 300 : 1000);
  setTimeout(function(){ document.body.classList.remove("entering"); }, 1500);
}

function onKey(e){
  if (!running) return;
  if (e.key === "Escape" || e.key === "Enter"){
    if (e.target && e.target.classList && e.target.classList.contains("ic-ch") && e.key === "Enter") return;
    e.preventDefault(); e.stopPropagation(); finish();
  }
  if (e.key === "ArrowRight"){ e.preventDefault(); jump(1); }
  if (e.key === "ArrowLeft"){ e.preventDefault(); jump(-1); }
}
function currentIndex(){
  var el = introEl(), n = 0;
  CHAPTERS.forEach(function(ch, i){ if (el && el.classList.contains("play-" + ch.key)) n = i; });
  return n;
}
function jump(d){
  var n = currentIndex() + d;
  if (n < 0) n = 0;
  if (n >= CHAPTERS.length){ finish(); return; }
  runFrom(n);
}

function play(){
  var el = introEl();
  if (!el){ root.classList.remove("intro-on"); return; }
  window.__introStarted = true;
  clearTimers(); stopFx();
  running = true;
  startedAt = Date.now();
  buildScenes(el);
  try{ el.inert = false; }catch(e){}
  root.classList.add("intro-on");
  el.classList.remove("leaving");
  el.classList.toggle("calm", reduced());
  void el.offsetWidth;
  el.classList.add("running");
  loadLogo();
  preloadPhotos();

  var skip = document.getElementById("introSkip");
  if (skip){
    skip.onclick = finish;
    setTimeout(function(){ try{ skip.focus({ preventScroll: true }); }catch(e){} }, 50);
  }
  el.querySelectorAll(".ic-ch").forEach(function(b){
    b.addEventListener("click", function(){ runFrom(parseInt(b.dataset.n, 10)); });
  });
  document.addEventListener("keydown", onKey, true);
  runFrom(0);
}

/* Called once at start-up: plays only if <head> decided it should. */
function startIntro(){
  if (root.classList.contains("intro-on")) play();
  else { var el = introEl(); try{ if (el) el.inert = true; }catch(e){} }
}
function replayIntro(){ logoReady = null; play(); }

export { startIntro, replayIntro };
