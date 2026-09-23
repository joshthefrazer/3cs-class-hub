import { REDUCED } from "./orbit.js";

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

/* -------------------------------------------------------- scroll reveal -- */

var REVEAL = ".card, .work-card, .note-card, .post, .announce-item";

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

/* ------------------------------------------------------------- ripple ---- */

/* A press leaves a mark where it was pressed. Uses one element, added and
   removed per press, so nothing accumulates. */
function initRipple(){
  if (REDUCED) return;
  document.addEventListener("pointerdown", function(e){
    var el = e.target && e.target.closest ? e.target.closest(".btn, .chip-btn, .console-tab, .pal-row, .auth-btn, .quick") : null;
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

/* ---------------------------------------------------------------- boot --- */

function initFx(){
  initPointerBus();
  initReveal();
  initRipple();
}

export { initFx, replayReveal, onPointer };
