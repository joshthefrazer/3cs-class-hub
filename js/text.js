import { ME, setMyName, toast } from "./backend.js";

/* =========================================================
   6. Text helpers. Escaping, tiny markdown, sheets
   ========================================================= */
/* Where "link only" note links point: this page, wherever it's hosted. */
var SHARE_BASE = (function(){
  try{ if (location.origin && location.origin !== "null" && /^https?:/.test(location.protocol)) return location.origin + location.pathname; }catch(e){}
  return "https://joshthefrazer.github.io/3cs-class-hub/";
})();
function svgIcon(name, cls){
  return '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#' +
         name + '"></use></svg>';
}
var ESC_MAP = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
function esc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return ESC_MAP[c]; });
}
function mdInline(s){
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}
/* Everything is escaped BEFORE any markup is added — shared data is untrusted. */
function mdRender(src){
  var lines = esc(src).split(/\r?\n/), out = [], mode = null, ci = 0, m, i, ln;
  function close(){
    if (!mode) return;
    out.push(mode === "ol" ? "</ol>" : "</ul>");
    mode = null;
  }
  for (i = 0; i < lines.length; i++){
    ln = lines[i];
    if (!ln.trim()){ close(); continue; }
    if ((m = /^#{1,2}\s+(.*)$/.exec(ln))){ close(); out.push("<h3>" + mdInline(m[1]) + "</h3>"); continue; }
    if ((m = /^#{3,6}\s+(.*)$/.exec(ln))){ close(); out.push("<h4>" + mdInline(m[1]) + "</h4>"); continue; }
    if ((m = /^\s*[-*]\s+\[([ xX])\]\s*(.*)$/.exec(ln))){
      if (mode !== "check"){ close(); out.push('<ul class="checklist">'); mode = "check"; }
      var done = m[1].toLowerCase() === "x";
      out.push('<li class="check' + (done ? " done" : "") + '"><input type="checkbox" data-ci="' +
               (ci++) + '"' + (done ? " checked" : "") + "><span>" + mdInline(m[2]) + "</span></li>");
      continue;
    }
    if ((m = /^\s*[-*]\s+(.*)$/.exec(ln))){
      if (mode !== "ul"){ close(); out.push("<ul>"); mode = "ul"; }
      out.push("<li>" + mdInline(m[1]) + "</li>"); continue;
    }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(ln))){
      if (mode !== "ol"){ close(); out.push("<ol>"); mode = "ol"; }
      out.push("<li>" + mdInline(m[1]) + "</li>"); continue;
    }
    close();
    out.push("<p>" + mdInline(ln) + "</p>");
  }
  close();
  return out.join("");
}
function toggleCheckSource(src, index, checked){
  var n = -1;
  return String(src || "").replace(/^(\s*[-*]\s+\[)([ xX])(\])/gm, function(full, a, mark, b){
    n++;
    return n === index ? a + (checked ? "x" : " ") + b : full;
  });
}

var sheetEl = null;
function escKey(e){ if (e.key === "Escape") closeSheet(); }
function openSheet(html){
  closeSheet();
  sheetEl = document.createElement("div");
  sheetEl.className = "sheet";
  sheetEl.innerHTML = '<div class="box" role="dialog" aria-modal="true"></div>';
  sheetEl.querySelector(".box").innerHTML = html;
  sheetEl.addEventListener("mousedown", function(e){ if (e.target === sheetEl) closeSheet(); });
  document.body.appendChild(sheetEl);
  document.addEventListener("keydown", escKey);
  var box = sheetEl.querySelector(".box");
  var x = box.querySelector(".sheet-close");
  if (x) x.addEventListener("click", closeSheet);
  var focusable = box.querySelector("input, textarea, select, button");
  if (focusable) setTimeout(function(){ focusable.focus(); }, 60);
  return box;
}
function closeSheet(){
  if (!sheetEl) return;
  sheetEl.remove();
  sheetEl = null;
  document.removeEventListener("keydown", escKey);
}

function openNameSheet(onDone){
  var box = openSheet(
    '<div class="sheet-head"><h2>What should the class call you?</h2>' +
    '<button class="sheet-close" aria-label="Close">&times;</button></div>' +
    '<p class="hint">This name appears on anything you post. It lives in this browser, and the Hub has no way to verify it. So use the name your classmates know you by.</p>' +
    '<label class="field" style="margin-top:14px;"><span>Display name</span>' +
    '<input id="nmInput" maxlength="32" placeholder="e.g. Joshua M."></label>' +
    '<div class="btn-row" style="margin-top:16px;"><button class="btn" id="nmSave">Save name</button></div>'
  );
  var input = box.querySelector("#nmInput");
  input.value = ME.name || "";
  function done(){
    var v = input.value.trim();
    if (!v){ toast("Type a name first.", true); return; }
    setMyName(v);
    closeSheet();
    if (onDone) onDone();
  }
  box.querySelector("#nmSave").addEventListener("click", done);
  input.addEventListener("keydown", function(e){ if (e.key === "Enter") done(); });
}


/* Only ever link out to the web. A "javascript:" or "data:" link typed into a
   shared field would run in everyone else's page if it were rendered as-is. */
function safeUrl(u){
  u = String(u || "").trim();
  if (!u) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  try{
    var x = new URL(u);
    return (x.protocol === "https:" || x.protocol === "http:") ? x.href : "";
  }catch(e){ return ""; }
}

export { safeUrl, ESC_MAP, SHARE_BASE, closeSheet, esc, escKey, mdInline, mdRender, openNameSheet, openSheet, sheetEl, svgIcon, toggleCheckSource };
