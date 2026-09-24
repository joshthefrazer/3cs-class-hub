import { esc, safeUrl } from "./text.js";
import { toast } from "./backend.js";
import { registerCommands } from "./palette.js";

/* =========================================================
   QUICK LAUNCH. The apps the class opens every day, one tap away.

   Shown as a card on Today and as a popover from the grid button in the
   header. The glyphs are drawn for the Hub (a board, a bulb, a page…) -
   they are not the companies' logos.

   Your own additions and anything you hide are kept in this browser only:
   it's a personal shortcut list, so it costs the database nothing.
   ========================================================= */

var DEFAULTS = [
  { id:"classroom", name:"Classroom", url:"https://classroom.google.com/",          icon:"q-board",   color:"#0F9D6B" },
  { id:"gemini",    name:"Gemini",    url:"https://gemini.google.com/app",         icon:"q-bulb",    color:"#6A3DE8" },
  { id:"docs",      name:"Docs",      url:"https://docs.google.com/document/",     icon:"q-doc",     color:"#2F6BEF" },
  { id:"canva",     name:"Canva",     url:"https://www.canva.com/",                icon:"q-brush",   color:"#0E9FB5" },
  { id:"teams",     name:"Teams",     url:"https://teams.microsoft.com/",          icon:"q-people",  color:"#5B4FD6" },
  { id:"drive",     name:"Drive",     url:"https://drive.google.com/",             icon:"q-folder",  color:"#D98300" },
  { id:"gmail",     name:"Gmail",     url:"https://mail.google.com/",              icon:"q-mail",    color:"#D6456A" },
  { id:"slides",    name:"Slides",    url:"https://docs.google.com/presentation/", icon:"q-present", color:"#E8601A" }
];
var PALETTE = ["#6A3DE8","#F26B1D","#2F6BEF","#0F9D6B","#D6456A","#0E9FB5","#8A4DF0","#D98300"];
var KEY = "3cs_links_v1";

function load(){
  try{
    var raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw === "object") return { hidden: raw.hidden || [], custom: raw.custom || [] };
  }catch(e){}
  return { hidden: [], custom: [] };
}
function save(cfg){ try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(e){} }

function hash(s){ var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

function links(){
  var cfg = load();
  return DEFAULTS.filter(function(l){ return cfg.hidden.indexOf(l.id) < 0; })
    .concat(cfg.custom.map(function(c){
      return { id:c.id, name:c.name, url:c.url, custom:true, color:PALETTE[hash(c.id) % PALETTE.length] };
    }));
}

function tile(l){
  var cell = document.createElement("div");
  cell.className = "quick-cell";
  var a = document.createElement("a");
  a.className = "quick";
  a.href = l.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.setProperty("--q", l.color);
  a.setAttribute("aria-label", "Open " + l.name + " in a new tab");
  var glyph = l.icon
    ? '<svg aria-hidden="true"><use href="#' + l.icon + '"></use></svg>'
    : '<b aria-hidden="true">' + esc((l.name || "?").trim().charAt(0).toUpperCase()) + '</b>';
  a.innerHTML = '<span class="qi">' + glyph + '</span><span class="ql">' + esc(l.name) + '</span>';
  a.addEventListener("click", function(e){
    if (cell.parentNode && cell.parentNode.classList.contains("editing")) e.preventDefault();
  });
  var x = document.createElement("button");
  x.type = "button";
  x.className = "qx";
  x.setAttribute("aria-label", "Remove " + l.name);
  x.innerHTML = "&times;";
  x.addEventListener("click", function(e){ e.preventDefault(); removeLink(l); });
  cell.appendChild(a);
  cell.appendChild(x);
  return cell;
}

function addTile(){
  var b = document.createElement("button");
  b.type = "button";
  b.className = "quick add";
  b.innerHTML = '<span class="qi"><svg aria-hidden="true"><use href="#i-plus"></use></svg></span><span class="ql">Add link</span>';
  b.addEventListener("click", openAddForm);
  return b;
}

function paintGrid(grid){
  if (!grid) return;
  grid.innerHTML = "";
  links().forEach(function(l){ grid.appendChild(tile(l)); });
  grid.appendChild(addTile());
}

function renderLinks(){
  paintGrid(document.getElementById("quickLinks"));
  paintGrid(document.getElementById("launcherGrid"));
}

function removeLink(l){
  var cfg = load();
  if (l.custom) cfg.custom = cfg.custom.filter(function(c){ return c.id !== l.id; });
  else if (cfg.hidden.indexOf(l.id) < 0) cfg.hidden.push(l.id);
  save(cfg);
  renderLinks();
  toast(l.name + " removed from your shortcuts.");
}

function openAddForm(){
  closeLauncher();
  var sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML =
    '<div class="box" role="dialog" aria-modal="true" aria-labelledby="qlHead" style="max-width:440px">' +
      '<div class="sheet-head"><div><h2 id="qlHead">Add a shortcut</h2>' +
      '<p class="hint" style="margin:2px 0 0">Saved on this device only. It doesn\'t change anyone else\'s list.</p></div>' +
      '<button class="sheet-close" type="button" aria-label="Close"><svg class="ic" aria-hidden="true"><use href="#i-close"></use></svg></button></div>' +
      '<label class="field" style="margin-top:10px"><span>Name</span><input id="qlName" maxlength="24" placeholder="e.g. Khan Academy"></label>' +
      '<label class="field" style="margin-top:12px"><span>Web address</span><input id="qlUrl" type="url" inputmode="url" placeholder="https://"></label>' +
      '<div class="sheet-actions">' +
        (load().hidden.length ? '<button class="btn ghost sm" id="qlReset" type="button" style="margin-right:auto">Bring back the defaults</button>' : '') +
        '<button class="btn" id="qlSave" type="button">Add shortcut</button></div>' +
    '</div>';
  document.body.appendChild(sheet);
  function close(){ sheet.remove(); document.removeEventListener("keydown", onKey); }
  function onKey(e){ if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);
  sheet.addEventListener("mousedown", function(e){ if (e.target === sheet) close(); });
  sheet.querySelector(".sheet-close").addEventListener("click", close);
  var name = sheet.querySelector("#qlName"), url = sheet.querySelector("#qlUrl");
  setTimeout(function(){ name.focus(); }, 60);
  function doSave(){
    var n = name.value.trim(), u = safeUrl(url.value);
    if (!n){ toast("Give it a name.", true); name.focus(); return; }
    if (!u){ toast("That doesn't look like a web address.", true); url.focus(); return; }
    var cfg = load();
    if (cfg.custom.length >= 12){ toast("That's the most shortcuts the grid holds.", true); return; }
    cfg.custom.push({ id: "c" + Date.now().toString(36), name: n.slice(0, 24), url: u });
    save(cfg);
    renderLinks();
    close();
    toast(n + " added.");
  }
  sheet.querySelector("#qlSave").addEventListener("click", doSave);
  url.addEventListener("keydown", function(e){ if (e.key === "Enter") doSave(); });
  var reset = sheet.querySelector("#qlReset");
  if (reset) reset.addEventListener("click", function(){
    var cfg = load(); cfg.hidden = []; save(cfg); renderLinks(); close(); toast("Default shortcuts are back.");
  });
}

/* ----------------------------------------------------------- popover -- */
function openLauncher(){
  var btn = document.getElementById("appsBtn");
  if (document.getElementById("launcher")) return closeLauncher();
  var pop = document.createElement("div");
  pop.className = "launcher";
  pop.id = "launcher";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Quick launch");
  pop.innerHTML = '<div class="card-head"><h3>Quick launch</h3><span class="hint" style="margin:0">new tab</span></div>' +
    '<div class="quick-grid" id="launcherGrid"></div>';
  document.body.appendChild(pop);
  paintGrid(pop.querySelector("#launcherGrid"));
  if (btn) btn.setAttribute("aria-expanded", "true");
  var first = pop.querySelector(".quick");
  if (first) setTimeout(function(){ first.focus(); }, 30);
  setTimeout(function(){
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", esc2);
  }, 0);
  pop.addEventListener("click", function(e){
    if (e.target.closest && e.target.closest("a.quick")) setTimeout(closeLauncher, 50);
  });
}
function outside(e){
  var pop = document.getElementById("launcher"), btn = document.getElementById("appsBtn");
  if (!pop) return;
  if (pop.contains(e.target) || (btn && btn.contains(e.target))) return;
  closeLauncher();
}
function esc2(e){ if (e.key === "Escape") closeLauncher(); }
function closeLauncher(){
  var pop = document.getElementById("launcher");
  if (pop) pop.remove();
  var btn = document.getElementById("appsBtn");
  if (btn) btn.setAttribute("aria-expanded", "false");
  document.removeEventListener("pointerdown", outside, true);
  document.removeEventListener("keydown", esc2);
}

function initLinks(){
  renderLinks();
  var apps = document.getElementById("appsBtn");
  if (apps) apps.addEventListener("click", function(e){ e.stopPropagation(); openLauncher(); });
  var edit = document.getElementById("quickEditBtn");
  var grid = document.getElementById("quickLinks");
  if (edit && grid) edit.addEventListener("click", function(){
    var on = !grid.classList.contains("editing");
    grid.classList.toggle("editing", on);
    edit.textContent = on ? "Done" : "Edit";
  });
  registerCommands(function(){
    return links().map(function(l){
      return { kind:"App", title:"Open " + l.name, hint:l.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
               run:function(){ window.open(l.url, "_blank", "noopener"); } };
    });
  });
}

export { initLinks, renderLinks, openLauncher, closeLauncher };
