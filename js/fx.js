import { REDUCED, Sky } from "./orbit.js";

/* =========================================================
   FX — the motion layer.

   Everything here is decoration, so everything here is optional: each piece
   checks prefers-reduced-motion first and simply doesn't run, and none of it
   is load-bearing for reading the page. Anything that moves on a pointer or a
   scroll is written as transform and opacity only, updated once per frame
   from a stored event, so the browser can keep it on the compositor and a
   cheap school laptop doesn't drop frames scrolling a list.
   ========================================================= */

var raf = window.requestAnimationFrame.bind(window);

/* One pointer listener for the whole page. Handlers subscribe to it instead
   of each adding their own, so moving the mouse costs one frame of work no
   matter how many effects are running. */
var pointer = { x: 0, y: 0, has: false };
var pointerSubs = [];
function onPointer(fn){ pointerSubs.push(fn); }

function initPointerBus(){
  var queued = false;
  window.addEventListener("pointermove", function(e){
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.has = true;
    if (queued) return;
    queued = true;
    raf(function(){
      queued = false;
      for (var i = 0; i < pointerSubs.length; i++){
        try{ pointerSubs[i](pointer, e); }catch(err){}
      }
    });
  }, { passive:true });
}

/* ------------------------------------------------------ starfield drift -- */

/* The sky leans away from the cursor, very slightly. It reads as depth
   rather than as an effect - most people never notice it directly, they just
   feel the page isn't flat. */
function initSkyDrift(){
  if (REDUCED || !Sky.pull) return;
  onPointer(function(p){
    var nx = (p.x / window.innerWidth) * 2 - 1;
    var ny = (p.y / window.innerHeight) * 2 - 1;
    Sky.pull(nx, ny);
  });
  window.addEventListener("pointerleave", function(){ if (Sky.pull) Sky.pull(0, 0); });
}

/* -------------------------------------------------------- scroll reveal -- */

var REVEAL = ".card, .work-card, .note-card, .post, .ann-card, .lineup .slot, .now-chip";

/* Things rise into place the first time they are scrolled to, once, and then
   the observer lets them go. Elements already on screen at load are revealed
   in a short stagger so the first paint has a sense of order rather than
   everything appearing at once. */
function initReveal(){
  if (REDUCED || !("IntersectionObserver" in window)) return;

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (!en.isIntersecting) return;
      en.target.classList.add("fx-in");
      io.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

  function watch(root){
    var nodes = (root || document).querySelectorAll(REVEAL);
    var n = 0;
    nodes.forEach(function(el){
      if (el.dataset.fx) return;
      el.dataset.fx = "1";
      el.classList.add("fx-rise");
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.96){
        el.style.setProperty("--fx-delay", (Math.min(n, 7) * 42) + "ms");
        n++;
        raf(function(){ raf(function(){ el.classList.add("fx-in"); }); });
      } else {
        io.observe(el);
      }
    });
  }

  watch(document);

  /* Lists are rebuilt constantly by the renderers, so newly inserted cards are
     picked up rather than appearing without their entrance. Coalesced to one
     sweep per frame: a single renderHelp() can fire hundreds of mutations. */
  var pendingSweep = false;
  var mo = new MutationObserver(function(muts){
    if (pendingSweep) return;
    for (var i = 0; i < muts.length; i++){
      if (muts[i].addedNodes.length){
        pendingSweep = true;
        raf(function(){ pendingSweep = false; watch(document); });
        return;
      }
    }
  });
  mo.observe(document.body, { childList:true, subtree:true });
}

/* Called after a world change so the new panel's contents get their entrance
   from the top rather than inheriting the last one's scroll state. */
function replayReveal(){
  if (REDUCED) return;
  var panel = document.querySelector("section.panel.active");
  if (!panel) return;
  var n = 0;
  panel.querySelectorAll(REVEAL).forEach(function(el){
    el.classList.remove("fx-in");
    el.classList.add("fx-rise");
    el.style.setProperty("--fx-delay", (Math.min(n, 8) * 38) + "ms");
    n++;
  });
  raf(function(){
    raf(function(){
      panel.querySelectorAll(REVEAL).forEach(function(el){ el.classList.add("fx-in"); });
    });
  });
}

/* ------------------------------------------------------------ card tilt -- */

/* A few degrees, and only on devices with a real pointer. The card leans
   toward the cursor like a physical thing being looked at from an angle. */
function initTilt(){
  if (REDUCED) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var active = null, rect = null;

  document.addEventListener("pointerover", function(e){
    var el = e.target && e.target.closest ? e.target.closest(".card, .work-card, .note-card") : null;
    if (el === active) return;
    if (active){ active.style.transform = ""; active.classList.remove("fx-tilt"); }
    active = el;
    if (active){
      rect = active.getBoundingClientRect();
      active.classList.add("fx-tilt");
    }
  }, { passive:true });

  document.addEventListener("pointerleave", function(){
    if (active){ active.style.transform = ""; active.classList.remove("fx-tilt"); active = null; }
  }, true);

  onPointer(function(p){
    if (!active) return;
    var r = rect;
    if (!r || r.width === 0) return;
    var px = (p.x - r.left) / r.width  - 0.5;
    var py = (p.y - r.top)  / r.height - 0.5;
    if (px < -0.6 || px > 0.6 || py < -0.6 || py > 0.6){
      active.style.transform = "";
      active.classList.remove("fx-tilt");
      active = null;
      return;
    }
    var max = r.height > 320 ? 1.6 : 3.2;     // big panels tilt less
    active.style.transform =
      "perspective(900px) rotateX(" + (-py * max).toFixed(2) + "deg) rotateY(" +
      (px * max).toFixed(2) + "deg) translateZ(0)";
  });

  /* Rects go stale as soon as anything scrolls or the list re-renders. */
  window.addEventListener("scroll", function(){
    if (active) rect = active.getBoundingClientRect();
  }, { passive:true });
}

/* ------------------------------------------------------ magnetic buttons -- */

/* Buttons drift a couple of pixels toward the cursor as it approaches, which
   makes them feel like they want to be pressed. Small enough that it never
   moves the hit target out from under a finger. */
function initMagnet(){
  if (REDUCED) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var SEL = ".btn, .chip-btn, .auth-btn, .admin-toggle, .work-tick";
  var near = [];

  /* The candidate list is cached rather than re-queried every frame: the
     filter rows alone are fifteen buttons, and a querySelectorAll per pointer
     move is exactly the kind of thing that makes a cheap laptop stutter. */
  var cache = [], cacheAt = 0;
  function candidates(){
    var now = Date.now();
    if (now - cacheAt > 400){
      cache = [].slice.call(document.querySelectorAll(SEL));
      cacheAt = now;
    }
    return cache;
  }

  onPointer(function(p){
    var els = candidates();
    var seen = [];
    els.forEach(function(el){
      var r = el.getBoundingClientRect();
      if (!r.width) return;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = p.x - cx, dy = p.y - cy;
      var reach = Math.max(r.width, r.height) * 0.9 + 26;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > reach) return;
      var k = (1 - d / reach) * 0.24;
      el.style.setProperty("--mag-x", (dx * k).toFixed(2) + "px");
      el.style.setProperty("--mag-y", (dy * k).toFixed(2) + "px");
      el.classList.add("fx-mag");
      seen.push(el);
    });
    near.forEach(function(el){
      if (seen.indexOf(el) > -1) return;
      el.style.removeProperty("--mag-x");
      el.style.removeProperty("--mag-y");
      el.classList.remove("fx-mag");
    });
    near = seen;
  });
}

/* ------------------------------------------------------------- ripple ---- */

/* A press leaves a mark where it was pressed. Uses one element, added and
   removed per press, so nothing accumulates. */
function initRipple(){
  if (REDUCED) return;
  document.addEventListener("pointerdown", function(e){
    var el = e.target && e.target.closest ? e.target.closest(".btn, .chip-btn, .console-tab, .pal-row, .admin-toggle, .auth-btn") : null;
    if (!el) return;
    var r = el.getBoundingClientRect();
    var d = Math.max(r.width, r.height) * 1.6;
    var s = document.createElement("span");
    s.className = "fx-ripple";
    s.style.width = s.style.height = d + "px";
    s.style.left = (e.clientX - r.left - d / 2) + "px";
    s.style.top  = (e.clientY - r.top  - d / 2) + "px";
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(s);
    setTimeout(function(){ if (s.parentNode) s.parentNode.removeChild(s); }, 620);
  }, { passive:true });
}

/* ------------------------------------------------------------ hero glow -- */

/* The big word picks up a slow sweep of light. Pure CSS once the class is on;
   this only decides when it is worth running. */
function initHeroSheen(){
  if (REDUCED) return;
  document.body.classList.add("fx-sheen");
}

/* ---------------------------------------------------------------- boot --- */

function initFx(){
  initPointerBus();
  initSkyDrift();
  initReveal();
  initTilt();
  initMagnet();
  initRipple();
  initHeroSheen();
}

export { initFx, replayReveal, onPointer };
