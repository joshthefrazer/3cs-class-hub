import { svgIcon } from "./text.js";

/* =========================================================
   OUR CAMPUS - the page background is a real photo of Itz'at STEAM
   Academy in Belize City, under a soft wash so everything stays readable.

   Photos: the Ministry of Education, Culture, Science and Technology
   (MoECST), taken at the opening on 10 May 2024 (Flickr album
   "Inauguration of the Itz'at STEAM Academy").

   assets/campus/bg-<id>.webp   background versions: 1600px, colour-graded
                                and lightly softened in advance (so the
                                browser never has to blur a full screen)
   assets/campus/<id>-1440.webp sharp versions for the photo viewer
   assets/campus/<id>-640.webp  thumbnails

   Settings > Look > Background picks how it behaves (saved as 3cs_bg):
     sections  each section has its own spot on campus (the default)
     daily     one photo for the whole site, a new one every day
     paper     the plain graph paper, no photo
   ========================================================= */

var PHOTOS = [
  { id: "front",     tag: "The main block",       alt: "The two-storey main classroom block, with young palms and a lawn in front" },
  { id: "courtyard", tag: "The courtyard garden", alt: "The planted courtyard between the classroom wings, under a white pergola" },
  { id: "wings",     tag: "Both wings",           alt: "Both classroom wings facing each other across the courtyard" },
  { id: "stairs",    tag: "The big stairs",       alt: "The wide outdoor staircase up to the second-floor walkway" },
  { id: "pergola",   tag: "Under the pergola",    alt: "The covered walkway and pergola along the side of the main block" },
  { id: "entrance",  tag: "The front gate",       alt: "The front gate with a STEAM is Dynamic banner and the stairs behind it" },
  { id: "studio",    tag: "The maker studio",     alt: "Long wooden work tables in the bright maker studio" },
  { id: "projects",  tag: "Student projects",     alt: "Colourful student-built boxes and models lined up on a work table" },
  { id: "workshop",  tag: "The workshop",         alt: "The workshop, with a pegboard of tools, drill presses and a work bench" }
];
/* where each section "is" on campus */
var BY_SECTION = {
  schedule: "front",
  work: "workshop",
  notebook: "courtyard",
  help: "stairs",
  calendar: "entrance",
  announcements: "wings",
  people: "pergola",
  voice: "studio"
};
var OUTSIDE = ["front", "courtyard", "wings", "stairs", "pergola", "entrance"];
var CREDIT = "Photo: Ministry of Education, Culture, Science and Technology, Belize";
var SOURCE = "https://www.flickr.com/photos/193643118@N04/albums/72177720317011818";
var KEY = "3cs_bg";

function src(id, w){ return "assets/campus/" + id + "-" + (w || 640) + ".webp"; }
function bgSrc(id){ return "assets/campus/bg-" + id + ".webp"; }
function indexOf(id){ for (var i = 0; i < PHOTOS.length; i++) if (PHOTOS[i].id === id) return i; return 0; }

function bgMode(){
  try{ var v = localStorage.getItem(KEY); return v === "daily" || v === "paper" ? v : "sections"; }catch(e){ return "sections"; }
}
function photoOfTheDay(){
  var d = new Date();
  var day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return OUTSIDE[day % OUTSIDE.length];
}
function photoFor(section){
  return bgMode() === "daily" ? photoOfTheDay() : (BY_SECTION[section] || "front");
}

/* ------------------------------------------------------ background ---- */
var layers = null, bgBox = null, front = 0, shown = null, loading = {};

function paint(id){
  if (!layers || id === shown) return;
  shown = id;
  var url = bgSrc(id);
  function swap(){
    if (shown !== id) return;                      // someone moved on while it loaded
    var next = layers[1 - front];
    next.style.backgroundImage = 'url("' + url + '")';
    next.classList.add("on");
    layers[front].classList.remove("on");
    // the blueprint grid flashes up and the photo "develops" out of it
    if (bgBox){
      bgBox.classList.remove("plan");
      void bgBox.offsetWidth;
      bgBox.classList.add("plan");
    }
    front = 1 - front;
    document.documentElement.classList.add("bg-ready");
  }
  if (loading[url] === true){ swap(); return; }
  var img = new Image();
  img.decoding = "async";
  img.onload = function(){ loading[url] = true; swap(); };
  img.onerror = function(){ loading[url] = false; };
  img.src = url;
  var name = document.getElementById("bgName");
  if (name) name.textContent = PHOTOS[indexOf(id)].tag.toLowerCase();
}

function applyBackground(){
  var mode = bgMode();
  var root = document.documentElement;
  root.classList.toggle("campus-on", mode !== "paper");
  if (mode === "paper"){
    shown = null;
    if (layers) layers.forEach(function(l){ l.classList.remove("on"); });
    root.classList.remove("bg-ready");
    return;
  }
  paint(photoFor(document.body.getAttribute("data-world") || "schedule"));
}

function setBackgroundMode(mode){
  try{ localStorage.setItem(KEY, mode); }catch(e){}
  applyBackground();
}

/* warm the next few so switching sections is instant */
function preloadRest(){
  var go = function(){
    Object.keys(BY_SECTION).forEach(function(k){
      var url = bgSrc(BY_SECTION[k]);
      if (loading[url]) return;
      var i = new Image();
      i.onload = function(){ loading[url] = true; };
      i.src = url;
    });
  };
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 2500);
}

function initBackground(){
  var box = document.getElementById("campusBg");
  if (!box) return;
  layers = Array.prototype.slice.call(box.querySelectorAll("i"));
  bgBox = box;
  applyBackground();
  // the section lives on <body data-world>, so follow that
  new MutationObserver(function(){ if (bgMode() === "sections") applyBackground(); })
    .observe(document.body, { attributes: true, attributeFilter: ["data-world"] });
  if (bgMode() !== "paper") preloadRest();
  var name = document.getElementById("bgName");
  if (name) name.addEventListener("click", function(){ openGallery(indexOf(shown || "front")); });
}

/* --------------------------------------------------------- gallery ---- */
function openGallery(start){
  var at = Math.max(0, Math.min(PHOTOS.length - 1, start || 0));
  var back = document.activeElement;
  var g = document.createElement("div");
  g.className = "gallery";
  g.setAttribute("role", "dialog");
  g.setAttribute("aria-modal", "true");
  g.setAttribute("aria-label", "Campus photos");
  g.innerHTML =
    '<div class="gl-stage"><img class="gl-img" alt=""></div>' +
    '<button type="button" class="gl-nav prev" aria-label="Previous photo">' + svgIcon("i-chev-l") + '</button>' +
    '<button type="button" class="gl-nav next" aria-label="Next photo">' + svgIcon("i-chev-r") + '</button>' +
    '<button type="button" class="gl-close" aria-label="Close">' + svgIcon("i-close") + '</button>' +
    '<div class="gl-foot">' +
      '<div class="gl-text"><b class="gl-tag"></b><span class="gl-alt"></span>' +
        '<a class="gl-credit" target="_blank" rel="noopener"></a></div>' +
      '<div class="gl-count" aria-live="polite"></div>' +
    '</div>' +
    '<div class="gl-thumbs" role="tablist" aria-label="All photos">' +
      PHOTOS.map(function(p, i){
        return '<button type="button" role="tab" data-i="' + i + '" aria-label="' + p.tag + '"><img src="' + src(p.id, 640) + '" alt="" loading="lazy"></button>';
      }).join("") +
    '</div>';
  var img = g.querySelector(".gl-img");
  var credit = g.querySelector(".gl-credit");
  credit.textContent = CREDIT;
  credit.href = SOURCE;

  function show(i, dir){
    at = (i + PHOTOS.length) % PHOTOS.length;
    var p = PHOTOS[at];
    var next = new Image();
    next.onload = next.onerror = function(){
      img.classList.remove("in", "from-l", "from-r");
      void img.offsetWidth;
      img.src = next.src;
      img.alt = p.alt;
      img.classList.add("in", dir < 0 ? "from-l" : "from-r");
    };
    next.src = src(p.id, 1440);
    g.querySelector(".gl-tag").textContent = p.tag;
    g.querySelector(".gl-alt").textContent = p.alt;
    g.querySelector(".gl-count").textContent = (at + 1) + " / " + PHOTOS.length;
    g.querySelectorAll(".gl-thumbs button").forEach(function(b, n){
      b.setAttribute("aria-selected", n === at ? "true" : "false");
      if (n === at && b.scrollIntoView) b.scrollIntoView({ block: "nearest", inline: "center" });
    });
  }
  function close(){
    g.classList.add("out");
    document.removeEventListener("keydown", onKey, true);
    setTimeout(function(){ g.remove(); if (back && back.focus) back.focus(); }, 220);
  }
  function onKey(e){
    if (e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowRight"){ e.preventDefault(); e.stopPropagation(); show(at + 1, 1); }
    else if (e.key === "ArrowLeft"){ e.preventDefault(); e.stopPropagation(); show(at - 1, -1); }
    else if (e.key === "Tab"){
      var f = g.querySelectorAll("button, a");
      if (e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
    }
  }
  g.querySelector(".prev").addEventListener("click", function(){ show(at - 1, -1); });
  g.querySelector(".next").addEventListener("click", function(){ show(at + 1, 1); });
  g.querySelector(".gl-close").addEventListener("click", close);
  g.querySelector(".gl-thumbs").addEventListener("click", function(e){
    var b = e.target.closest("button[data-i]");
    if (b) show(+b.dataset.i, +b.dataset.i < at ? -1 : 1);
  });
  g.addEventListener("click", function(e){ if (e.target === g || e.target.classList.contains("gl-stage")) close(); });
  var sx = null;
  g.addEventListener("touchstart", function(e){ sx = e.touches[0].clientX; }, { passive: true });
  g.addEventListener("touchend", function(e){
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(g);
  show(at, 1);
  g.querySelector(".gl-close").focus();
}

function initCampus(){ initBackground(); }

export { initCampus, openGallery, setBackgroundMode, bgMode, PHOTOS, indexOf as campusIndex };
