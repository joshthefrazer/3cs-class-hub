import { BE, registerStream, toast, usingFirebase } from "./backend.js";
import { esc, svgIcon } from "./text.js";

/* =========================================================
   MAKE IT YOURS - how your Hub looks and what goes where.

   Everything is on by default. From Settings, or the Customize button on
   Today, you can:
     - reorder, collapse or hide any card on Today (and bring it back)
     - hide sections you never use from the menu
     - dock a small "right now" pill on every other page
     - move the chat button to the other side
     - pick an accent colour, text size, density and glass cards

   Saved in this browser (localStorage "3cs_look") and, when signed in, in
   users/{uid}/prefs/look so it follows you to other devices. The head
   script in index.html applies the colour/size attributes before the
   first paint so nothing flashes.
   ========================================================= */

var TOP = ["timeline", "row", "next", "timetable", "bells", "codes"];
var ROW = ["due", "chat", "apps"];
var NAMES = {
  now: "Right now card", timeline: "Today's timeline", row: "Due, chat and apps row",
  due: "What's due", chat: "Class chat", apps: "Apps", next: "Pack your bag (next day)",
  timetable: "Weekly timetable", bells: "Bell times", codes: "Subject codes"
};
var TAB_NAMES = { work: "Work", notebook: "Notes", help: "Help", calendar: "Calendar", announcements: "News", people: "People", voice: "Feedback" };
var ACCENTS = [
  ["plum", "Plum", "#5B2B8C"], ["ocean", "Ocean", "#1F5FBF"], ["teal", "Teal", "#0E7C7B"], ["forest", "Forest", "#1E7A4C"],
  ["gold", "Gold", "#9A6F00"], ["sunset", "Sunset", "#C4501A"], ["rose", "Rose", "#B8336A"], ["slate", "Slate", "#3F4A5C"]
];
/* one tap sets the colour, the background and light or dark together */
var THEMES = [
  { id: "itzat",    name: "Itz'at",   accent: "plum",   bg: "sections", mode: "system", swatch: "url(assets/campus/front-640.webp) center/cover" },
  { id: "aurora",   name: "Aurora",   accent: "plum",   bg: "aurora",   mode: "light",  swatch: "radial-gradient(circle at 20% 20%, #B794F4, transparent 60%), radial-gradient(circle at 85% 20%, #F6AD55, transparent 55%), radial-gradient(circle at 70% 90%, #7F9CF5, transparent 60%), #F4F1FA" },
  { id: "sunset",   name: "Sunset",   accent: "sunset", bg: "sunset",   mode: "light",  swatch: "radial-gradient(circle at 85% 15%, #FF9A5A, transparent 60%), radial-gradient(circle at 15% 35%, #F472B6, transparent 55%), radial-gradient(circle at 60% 95%, #A78BFA, transparent 60%), #FBF3EE" },
  { id: "ocean",    name: "Ocean",    accent: "ocean",  bg: "ocean",    mode: "light",  swatch: "radial-gradient(circle at 15% 15%, #38BDF8, transparent 60%), radial-gradient(circle at 90% 40%, #2DD4BF, transparent 55%), radial-gradient(circle at 40% 95%, #3B82F6, transparent 60%), #EFF6FB" },
  { id: "forest",   name: "Forest",   accent: "forest", bg: "forest",   mode: "light",  swatch: "radial-gradient(circle at 15% 15%, #4ADE80, transparent 60%), radial-gradient(circle at 85% 25%, #FACC15, transparent 55%), radial-gradient(circle at 60% 95%, #2DD4BF, transparent 60%), #F1F7F2" },
  { id: "midnight", name: "Midnight", accent: "ocean",  bg: "midnight", mode: "dark",   swatch: "radial-gradient(circle at 15% 10%, #6366F1, transparent 60%), radial-gradient(circle at 90% 30%, #A855F7, transparent 55%), linear-gradient(#1B1740, #0E0B22)" },
  { id: "notebook", name: "Notebook", accent: "plum",   bg: "paper",    mode: "light",  swatch: "linear-gradient(rgba(91,43,140,.18) 1px, transparent 1px) 0 0/12px 12px, linear-gradient(90deg, rgba(91,43,140,.18) 1px, transparent 1px) 0 0/12px 12px, #FBFAF7" },
  { id: "minimal",  name: "Minimal",  accent: "slate",  bg: "plain",    mode: "system", swatch: "linear-gradient(135deg, #F4F5F7 50%, #1E2330 50%)" }
];
var BGS = [
  ["sections", "Campus", "A different spot for each section", "url(assets/campus/wings-640.webp) center/cover"],
  ["daily", "Campus daily", "One photo, new each day", "url(assets/campus/courtyard-640.webp) center/cover"],
  ["custom", "Your photo", "Pick any picture", ""],
  ["aurora", "Aurora", "", THEMES[1].swatch], ["sunset", "Sunset", "", THEMES[2].swatch], ["ocean", "Ocean", "", THEMES[3].swatch],
  ["forest", "Forest", "", THEMES[4].swatch], ["midnight", "Midnight", "", THEMES[5].swatch],
  ["paper", "Graph paper", "", THEMES[6].swatch], ["plain", "Plain", "", "var(--bg)"]
];

function defaults(){
  return { theme: "itzat", accent: "plum", text: "m", density: "comfy", glass: "off", chat: "right", dock: "on", rail: "off",
    order: TOP.slice(), row: ROW.slice(), hidden: {}, collapsed: {}, tabsHidden: {} };
}
var look = load();

function load(){
  var d = defaults();
  try{
    var s = JSON.parse(localStorage.getItem("3cs_look") || "{}");
    Object.keys(d).forEach(function(k){ if (s[k] !== undefined) d[k] = s[k]; });
  }catch(e){}
  // new blocks added in later versions still show up
  TOP.forEach(function(k){ if (d.order.indexOf(k) < 0) d.order.push(k); });
  ROW.forEach(function(k){ if (d.row.indexOf(k) < 0) d.row.push(k); });
  d.order = d.order.filter(function(k){ return TOP.indexOf(k) >= 0; });
  d.row = d.row.filter(function(k){ return ROW.indexOf(k) >= 0; });
  return d;
}
var syncT = null;
function save(){
  var at = new Date().toISOString();
  try{ localStorage.setItem("3cs_look", JSON.stringify(look)); localStorage.setItem("3cs_look_at", at); }catch(e){}
  clearTimeout(syncT);
  syncT = setTimeout(function(){
    if (!usingFirebase() || !BE.user || !BE.db) return;
    BE.db.doc("users/" + BE.user.id + "/prefs/look").set(Object.assign({}, look, { updatedAt: at }))
      .catch(function(){ /* it's still saved in this browser */ });
  }, 1200);
}
function set(k, v){ look[k] = v; save(); apply(); }

/* bring your look along when you sign in somewhere new */
registerStream(function(db){
  if (!usingFirebase() || !BE.user) return [];
  db.doc("users/" + BE.user.id + "/prefs/look").get().then(function(d){
    if (!d.exists) { save(); return; }
    var r = d.data(), localAt = "";
    try{ localAt = localStorage.getItem("3cs_look_at") || ""; }catch(e){}
    if (localAt && r.updatedAt && localAt > r.updatedAt) return;
    var dd = defaults();
    Object.keys(dd).forEach(function(k){ if (r[k] !== undefined) look[k] = r[k]; });
    look = Object.assign(load(), look);
    try{ localStorage.setItem("3cs_look", JSON.stringify(look)); localStorage.setItem("3cs_look_at", r.updatedAt || ""); }catch(e){}
    apply();
  }).catch(function(){});
  return [];
}, function(){});

/* --------------------------------------------------------------- apply -- */
function blk(id){ return document.querySelector('[data-block="' + id + '"]'); }

function apply(animate){
  var root = document.documentElement;
  ["accent", "text", "density", "glass", "chat", "rail"].forEach(function(k){ root.setAttribute("data-" + k, look[k]); });
  var rb = document.getElementById("railBtn");
  if (rb){ var lbl = look.rail === "on" ? "Expand the sidebar" : "Collapse the sidebar"; rb.setAttribute("aria-label", lbl); rb.title = lbl + " ( [ )"; }
  var before = animate ? rects() : null;

  var hero = document.getElementById("hero");
  if (hero) hero.style.order = 0;
  look.order.forEach(function(id, i){ var e = blk(id); if (e) e.style.order = i + 1; });
  look.row.forEach(function(id, i){ var e = blk(id); if (e) e.style.order = i; });
  Object.keys(NAMES).forEach(function(id){
    var e = blk(id); if (!e) return;
    e.classList.toggle("blk-off", !!look.hidden[id]);
    e.classList.toggle("blk-min", !!look.collapsed[id]);
    var c = e.querySelector(":scope > .card-head .blk-min-btn, :scope > .nd-head .blk-min-btn");
    if (c){
      c.setAttribute("aria-expanded", String(!look.collapsed[id]));
      c.setAttribute("aria-label", look.collapsed[id] ? "Expand " + NAMES[id] : "Collapse " + NAMES[id]);
    }
  });
  // a row with everything hidden shouldn't leave a gap
  var row = blk("row");
  if (row) row.classList.toggle("blk-empty", ROW.every(function(id){ return look.hidden[id]; }));

  document.querySelectorAll("nav.tabs button[data-tab], #bottomNav button[data-tab]").forEach(function(b){
    var t = b.getAttribute("data-tab");
    b.hidden = !!look.tabsHidden[t];
  });
  if (typeof window.__updateTabInk === "function") window.__updateTabInk();
  paintDock();
  if (customizing) paintBars();
  if (before) flip(before);
}

/* smooth reordering: every block glides from where it was */
function rects(){
  var m = {};
  document.querySelectorAll("#tab-schedule [data-block]").forEach(function(e){ m[e.dataset.block] = e.getBoundingClientRect(); });
  return m;
}
function flip(before){
  if (document.documentElement.classList.contains("reduce-motion")) return;
  document.querySelectorAll("#tab-schedule [data-block]").forEach(function(e){
    var a = before[e.dataset.block], b = e.getBoundingClientRect();
    if (!a || !e.animate) return;
    var dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    e.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }],
      { duration: 420, easing: "cubic-bezier(.16, 1, .3, 1)" });
  });
}

/* ------------------------------------------------ collapse and close -- */
/* Every card with a heading gets two small buttons in the corner. */
function addCardTools(){
  Object.keys(NAMES).forEach(function(id){
    var e = blk(id);
    if (!e) return;
    var head = e.querySelector(":scope > .card-head, :scope > .nd-head");
    if (!head || head.querySelector(".blk-tools")) return;
    var t = document.createElement("div");
    t.className = "blk-tools";
    t.innerHTML =
      '<button type="button" class="blk-btn blk-min-btn" aria-expanded="true" aria-label="Collapse ' + esc(NAMES[id]) + '">' + svgIcon("i-chev-r") + "</button>" +
      '<button type="button" class="blk-btn blk-x" aria-label="Hide ' + esc(NAMES[id]) + '">' + svgIcon("i-close") + "</button>";
    t.querySelector(".blk-min-btn").addEventListener("click", function(){
      look.collapsed[id] = !look.collapsed[id];
      if (!look.collapsed[id]) delete look.collapsed[id];
      save(); apply();
    });
    t.querySelector(".blk-x").addEventListener("click", function(){ hide(id); });
    head.appendChild(t);
  });
}
function hide(id){
  look.hidden[id] = true;
  save(); apply(true);
  toastUndo(NAMES[id] + " hidden.", function(){ delete look.hidden[id]; save(); apply(true); });
}
function toastUndo(msg, undo){
  toast(msg + " Bring it back any time from Customize or Settings.");
  var t = document.getElementById("toast");
  if (!t) return;
  var b = document.createElement("button");
  b.type = "button";
  b.className = "toast-undo";
  b.textContent = "Undo";
  b.addEventListener("click", function(){ undo(); t.className = ""; });
  t.appendChild(document.createTextNode(" "));
  t.appendChild(b);
}

/* ---------------------------------------------------- customize mode -- */
var customizing = false, dragId = null, barTick = null;
function startCustomize(){
  var tab = document.querySelector('nav.tabs button[data-tab="schedule"]');
  if (document.body.getAttribute("data-world") !== "schedule" && tab) tab.click();
  customizing = true;
  document.body.classList.add("customizing");
  paintBars();
  // the right-now card repaints itself; put its bar back when it does
  clearInterval(barTick);
  barTick = setInterval(function(){ var n = blk("now"); if (n && !n.querySelector(":scope > .blk-bar")) paintBars(); }, 700);
  var bar = document.getElementById("customBar");
  if (!bar){
    bar = document.createElement("div");
    bar.id = "customBar";
    bar.className = "custom-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Customizing Today");
    bar.innerHTML = '<span class="cb-t">' + svgIcon("i-grid") + '<span><b>Customizing Today</b><small>Drag cards, use the arrows, or tap the eye to hide one.</small></span></span>' +
      '<span class="grow"></span><button class="btn ghost sm" type="button" id="cbReset">Reset</button><button class="btn sm" type="button" id="cbDone">Done</button>';
    document.body.appendChild(bar);
    bar.querySelector("#cbDone").addEventListener("click", stopCustomize);
    bar.querySelector("#cbReset").addEventListener("click", function(){
      var d = defaults();
      look.order = d.order; look.row = d.row; look.hidden = {}; look.collapsed = {};
      save(); apply(true); toast("Today is back to the original layout.");
    });
  }
  bar.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function stopCustomize(){
  customizing = false;
  clearInterval(barTick);
  document.body.classList.remove("customizing");
  document.querySelectorAll(".blk-bar").forEach(function(b){ b.remove(); });
  var bar = document.getElementById("customBar");
  if (bar) bar.hidden = true;
  toast("Saved. It'll look like this every time.");
}
function listFor(id){ return ROW.indexOf(id) >= 0 ? "row" : TOP.indexOf(id) >= 0 ? "order" : null; }
function move(id, dir){
  var key = listFor(id); if (!key) return;
  var a = look[key], i = a.indexOf(id), j = i + dir;
  if (j < 0 || j >= a.length) return;
  a.splice(i, 1); a.splice(j, 0, id);
  save(); apply(true);
}
function paintBars(){
  Object.keys(NAMES).forEach(function(id){
    var e = blk(id); if (!e) return;
    var bar = e.querySelector(":scope > .blk-bar");
    if (!bar){
      bar = document.createElement("div");
      bar.className = "blk-bar";
      e.insertBefore(bar, e.firstChild);
    }
    var key = listFor(id), list = key ? look[key] : [], i = list.indexOf(id), off = !!look.hidden[id];
    bar.innerHTML =
      (key ? '<span class="bb-grip" draggable="true" title="Drag to move" aria-hidden="true">' + svgIcon("i-grid") + "</span>" : "") +
      '<b class="bb-name"></b><span class="grow"></span>' +
      (key ? '<button type="button" class="blk-btn" data-do="up" aria-label="Move ' + esc(NAMES[id]) + ' up"' + (i <= 0 ? " disabled" : "") + ">" + svgIcon("i-up") + "</button>" +
             '<button type="button" class="blk-btn" data-do="down" aria-label="Move ' + esc(NAMES[id]) + ' down"' + (i >= list.length - 1 ? " disabled" : "") + ">" + svgIcon("i-arrow-down") + "</button>" : "") +
      '<button type="button" class="blk-btn eye' + (off ? " off" : "") + '" data-do="eye" aria-pressed="' + !off + '" aria-label="' + (off ? "Show " : "Hide ") + esc(NAMES[id]) + '">' + svgIcon(off ? "i-eye-off" : "i-eye") + "</button>";
    bar.querySelector(".bb-name").textContent = NAMES[id] + (off ? " (hidden)" : "");
    bar.querySelectorAll("button").forEach(function(b){
      b.addEventListener("click", function(ev){
        ev.stopPropagation();
        var d = b.dataset.do;
        if (d === "up") move(id, -1);
        else if (d === "down") move(id, 1);
        else { if (look.hidden[id]) delete look.hidden[id]; else look.hidden[id] = true; save(); apply(true); }
      });
    });
    var g = bar.querySelector(".bb-grip");
    if (g){
      g.addEventListener("dragstart", function(ev){ dragId = id; e.classList.add("dragging"); try{ ev.dataTransfer.setData("text/plain", id); ev.dataTransfer.effectAllowed = "move"; }catch(x){} });
      g.addEventListener("dragend", function(){ dragId = null; e.classList.remove("dragging"); document.querySelectorAll(".drop-before,.drop-after").forEach(function(x){ x.classList.remove("drop-before", "drop-after"); }); });
    }
    if (!e.dataset.dnd){
      e.dataset.dnd = "1";
      e.addEventListener("dragover", function(ev){
        if (!dragId || dragId === id || listFor(dragId) !== listFor(id)) return;
        ev.preventDefault();
        var r = e.getBoundingClientRect();
        var after = listFor(id) === "row" ? ev.clientX > r.left + r.width / 2 : ev.clientY > r.top + r.height / 2;
        e.classList.toggle("drop-after", after);
        e.classList.toggle("drop-before", !after);
      });
      e.addEventListener("dragleave", function(){ e.classList.remove("drop-before", "drop-after"); });
      e.addEventListener("drop", function(ev){
        if (!dragId || dragId === id || listFor(dragId) !== listFor(id)) return;
        ev.preventDefault();
        var after = e.classList.contains("drop-after");
        e.classList.remove("drop-before", "drop-after");
        var key = listFor(id), a = look[key];
        a.splice(a.indexOf(dragId), 1);
        a.splice(a.indexOf(id) + (after ? 1 : 0), 0, dragId);
        save(); apply(true);
      });
    }
  });
}

/* ------------------------------------------------------- the dock ---- */
/* A small pill with what's on right now, on every page except Today. */
function paintDock(){
  var d = document.getElementById("nowDock");
  if (!d){
    d = document.createElement("button");
    d.type = "button";
    d.id = "nowDock";
    d.className = "now-dock";
    d.hidden = true;
    d.addEventListener("click", function(){ var t = document.querySelector('nav.tabs button[data-tab="schedule"]'); if (t) t.click(); });
    /* It lives in the menu, not over the page: the foot of the sidebar on
       computers, a chip in the top bar on phones. Floating, it covered
       whatever was at the bottom of the screen. */
    var bar = document.querySelector(".topbar-inner"), right = bar && bar.querySelector(".hdr-right");
    if (right) bar.insertBefore(d, right); else document.body.appendChild(d);
  }
  var t = window.__hubTitle || "";
  var info = t.replace(/\s*\|\s*3CS$/, "");
  var on = look.dock === "on" && / left$| in /.test(info) &&
           document.body.getAttribute("data-world") !== "schedule";
  d.hidden = !on;
  if (on){
    if (!d.querySelector(".nd-txt")) d.innerHTML = '<span class="nd-dot" aria-hidden="true"></span><span class="nd-txt"><small>Right now</small><b></b></span>';
    d.querySelector(".nd-txt b").textContent = info;
    d.title = info;
    d.setAttribute("aria-label", "Right now: " + info + ". Open Today");
  }
}

/* ------------------------------------------------------ settings UI -- */
function seg(name, value, opts){
  return '<div class="seg" role="radiogroup">' + opts.map(function(o){
    return '<label><input type="radio" name="' + name + '" value="' + o[0] + '"' + (o[0] === value ? " checked" : "") + "><span>" + o[1] + "</span></label>";
  }).join("") + "</div>";
}
function row(title, sub, control){
  return '<div class="set-row"><div><b>' + title + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</div>" + control + "</div>";
}
function swatchTile(name, value, checked, label, sub, bg, extra){
  return '<label class="tile' + (extra || "") + '"><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? " checked" : "") + '>' +
    '<span class="tile-pic" style="background:' + bg + '"></span><span class="tile-t"><b>' + esc(label) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span></label>";
}
/* Settings > Look */
function lookHtml(opts){
  var bg = opts.bgMode, custom = opts.customImage;
  return '<section class="set-sec"><h3>Themes</h3><p class="hint">Colour, background and light or dark in one tap. Change any part of it below.</p>' +
    '<div class="tiles themes" role="radiogroup" aria-label="Theme">' + THEMES.map(function(t){
      return swatchTile("setThemePreset", t.id, look.theme === t.id, t.name, "", t.swatch + "", " theme-tile a-" + t.accent);
    }).join("") + "</div></section>" +
  '<section class="set-sec"><h3>Background</h3>' +
    '<div class="tiles bgs" role="radiogroup" aria-label="Background">' + BGS.map(function(b){
      var pic = b[0] === "custom" ? (custom ? 'url(' + custom + ') center/cover' : 'repeating-linear-gradient(45deg, var(--surface-3) 0 8px, var(--surface-2) 8px 16px)') : b[3];
      return swatchTile("setBgTile", b[0], bg === b[0], b[1], b[0] === "custom" ? (custom ? "Tap to change" : "Upload a picture") : b[2], pic, b[0] === "custom" ? " up" : "");
    }).join("") + "</div>" +
    '<div class="btn-row" style="margin-top:8px"><button class="btn ghost sm" id="setPhotos" type="button">' + svgIcon("i-image") + " See the campus photos</button></div>" +
  "</section>" +
  '<section class="set-sec"><h3>Colours and text</h3>' +
    row("Light or dark", "System follows your device.", seg("setTheme", opts.themeChoice, [["system", "System"], ["light", "Light"], ["dark", "Dark"]])) +
    row("Accent colour", "Buttons, highlights and links.",
      '<div class="swatches" role="radiogroup" aria-label="Accent colour">' + ACCENTS.map(function(a){
        return '<label class="swatch" title="' + a[1] + '"><input type="radio" name="setAccent" value="' + a[0] + '"' + (look.accent === a[0] ? " checked" : "") + '><span style="--sw:' + a[2] + '"></span><em class="sr-only">' + a[1] + "</em></label>";
      }).join("") + "</div>") +
    row("Text size", "", seg("setText", look.text, [["s", "Small"], ["m", "Normal"], ["l", "Large"]])) +
    row("Spacing", "Compact fits more on the screen.", seg("setDensity", look.density, [["comfy", "Roomy"], ["compact", "Compact"]])) +
    row("Glass cards", "Cards let a little of the background through.", '<input type="checkbox" class="switch" id="setGlass"' + (look.glass === "on" ? " checked" : "") + ">") +
  "</section>" +
  '<section class="set-sec"><h3>Speed</h3>' +
    row("Effects", "Light turns off blur and moving backgrounds, for slower computers. Auto picks for you.",
      seg("setFx", opts.fx, [["auto", "Auto"], ["full", "Full"], ["lite", "Light"]])) +
    row("Motion", "Reduced turns off the bigger animations everywhere.", seg("setMotion", opts.motion, [["system", "Full"], ["reduce", "Reduced"]])) +
  "</section>";
}
/* Settings > Layout */
function layoutHtml(){
  return '<section class="set-sec"><h3>Today</h3>' +
    row("Cards on Today", "Move, collapse or hide them. Hidden ones come back from here.", '<button class="btn ghost sm" id="setCustomize" type="button">' + svgIcon("i-grid") + " Customize Today</button>") +
    '<div class="set-hidden" id="setHiddenList"></div>' +
  "</section>" +
  '<section class="set-sec"><h3>Getting around</h3>' +
    row("Sidebar", "On computers. The [ key does this too.", seg("setRail", look.rail, [["off", "Full"], ["on", "Icons only"]])) +
    '<div class="set-sub"><b>Sections in the menu</b><small>Today always stays. Hidden sections still open from search.</small></div>' +
    '<div class="tab-toggles">' + Object.keys(TAB_NAMES).map(function(t){
      return '<label class="tt"><input type="checkbox" data-tab="' + t + '"' + (look.tabsHidden[t] ? "" : " checked") + "><span>" + TAB_NAMES[t] + "</span></label>";
    }).join("") + "</div>" +
    row("Dock \"right now\"", "A small pill with your current class on every other page.", '<input type="checkbox" class="switch" id="setDock"' + (look.dock === "on" ? " checked" : "") + ">") +
    row("Chat window", "Which side it opens on.", seg("setChat", look.chat, [["right", "Right"], ["left", "Left"]])) +
    '<div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" id="setLookReset" type="button">Reset looks and layout to the original</button></div>' +
  "</section>";
}
function paintHiddenList(box){
  var l = box.querySelector("#setHiddenList"); if (!l) return;
  var ids = Object.keys(look.hidden).filter(function(k){ return look.hidden[k] && NAMES[k]; });
  l.innerHTML = ids.length ? '<small>Hidden on Today:</small>' + ids.map(function(id){
    return '<button type="button" class="chip-btn" data-show="' + id + '">' + svgIcon("i-eye", "sm") + " " + esc(NAMES[id]) + "</button>";
  }).join("") : "";
  l.querySelectorAll("[data-show]").forEach(function(b){
    b.addEventListener("click", function(){ delete look.hidden[b.dataset.show]; save(); apply(); paintHiddenList(box); toast(NAMES[b.dataset.show] + " is back."); });
  });
}
var hooks = {};
function lookHooks(h){ hooks = h; }
function wireLook(box, close){
  function radios(name, key){
    box.querySelectorAll('input[name="' + name + '"]').forEach(function(r){
      r.addEventListener("change", function(){ if (r.checked) set(key, r.value); });
    });
  }
  radios("setAccent", "accent"); radios("setText", "text"); radios("setDensity", "density"); radios("setChat", "chat"); radios("setRail", "rail");
  // a theme sets several things at once; changing one of them afterwards is fine
  box.querySelectorAll('input[name="setThemePreset"]').forEach(function(r){
    r.addEventListener("change", function(){
      if (!r.checked) return;
      var t = THEMES.filter(function(x){ return x.id === r.value; })[0]; if (!t) return;
      look.theme = t.id; look.accent = t.accent; save(); apply();
      if (hooks.setTheme) hooks.setTheme(t.mode);
      if (hooks.setBg) hooks.setBg(t.bg);
      var a = box.querySelector('input[name="setAccent"][value="' + t.accent + '"]'); if (a) a.checked = true;
      var b = box.querySelector('input[name="setBgTile"][value="' + t.bg + '"]'); if (b) b.checked = true;
      var m = box.querySelector('input[name="setTheme"][value="' + t.mode + '"]'); if (m) m.checked = true;
      toast(t.name + " theme on.");
    });
  });
  box.querySelectorAll('input[name="setBgTile"]').forEach(function(r){
    r.addEventListener("click", function(){
      if (r.value !== "custom") return;
      // the custom tile always opens the picker, even when already chosen
      if (hooks.pickBg) hooks.pickBg(function(url){
        var pic = r.parentNode.querySelector(".tile-pic"); if (pic && url) pic.style.background = "url(" + url + ") center/cover";
        var sm = r.parentNode.querySelector("small"); if (sm) sm.textContent = "Tap to change";
      });
    });
    r.addEventListener("change", function(){ if (r.checked && r.value !== "custom" && hooks.setBg) hooks.setBg(r.value); });
  });
  var q = function(sel){ return box.querySelector(sel); };
  if (q("#setGlass")) q("#setGlass").addEventListener("change", function(e){ set("glass", e.target.checked ? "on" : "off"); });
  if (q("#setDock")) q("#setDock").addEventListener("change", function(e){ set("dock", e.target.checked ? "on" : "off"); });
  if (q("#setCustomize")) q("#setCustomize").addEventListener("click", function(){ close(); setTimeout(startCustomize, 60); });
  box.querySelectorAll(".tab-toggles input").forEach(function(c){
    c.addEventListener("change", function(){
      if (c.checked) delete look.tabsHidden[c.dataset.tab]; else look.tabsHidden[c.dataset.tab] = true;
      save(); apply();
      // leave a section you just hid
      if (!c.checked && document.body.getAttribute("data-world") === c.dataset.tab){
        var t = document.querySelector('nav.tabs button[data-tab="schedule"]'); if (t) t.click();
      }
    });
  });
  if (q("#setLookReset")) q("#setLookReset").addEventListener("click", function(){
    if (!window.confirm("Put the colours, layout and menu back to how they came?")) return;
    look = defaults(); save(); apply(true); close(); toast("Everything is back to the original.");
  });
  paintHiddenList(box);
}

function initLayout(){
  addCardTools();
  apply();
  var rb = document.getElementById("railBtn");
  if (rb) rb.addEventListener("click", function(){ set("rail", look.rail === "on" ? "off" : "on"); });
  // the icon rail needs names on hover
  document.querySelectorAll("nav.tabs button").forEach(function(b){
    var l = b.querySelector(".lbl"); if (l && !b.title) b.title = l.textContent;
  });
  document.addEventListener("keydown", function(e){
    var t = e.target;
    if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    set("rail", look.rail === "on" ? "off" : "on");
  });
  var b = document.getElementById("customizeBtn");
  if (b) b.addEventListener("click", function(){ if (customizing) stopCustomize(); else startCustomize(); });
  window.addEventListener("3cs:title", paintDock);
  new MutationObserver(function(){ paintDock(); if (customizing && document.body.getAttribute("data-world") !== "schedule") stopCustomize(); })
    .observe(document.body, { attributes: true, attributeFilter: ["data-world"] });
  document.addEventListener("keydown", function(e){ if (customizing && e.key === "Escape") stopCustomize(); });
}

export { initLayout, lookHtml, layoutHtml, wireLook, lookHooks, startCustomize, look as currentLook };
