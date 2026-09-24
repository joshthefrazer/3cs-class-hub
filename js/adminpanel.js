import { canAdmin, dbErrMsg, requireDb, saveConfig, toast, BE } from "./backend.js";
import { state } from "./state.js";
import { svgIcon } from "./text.js";
import {
  liveSched, liveCal, liveModes, liveLegend, liveBellNote
} from "./live.js";
import { SCHED, CAL, BELL_MODES, DEFAULT_LEGEND, MONTH_NAMES } from "./data.js";

/* =========================================================
   SITE EDITOR. The admin console.

   This is the "edit the site like you're coding it" half of the Hub. Every
   panel here writes into the single config/site document, which every open
   copy of the Hub is already listening to, so a change lands on the class's
   screens a second after Publish.

   Nothing here is destructive: each panel stores an OVERRIDE, and Reset
   deletes the override rather than writing the printed values back in. The
   official 2026-2027 calendar in data.js is always the floor to fall back to.
   ========================================================= */

var built = false;
var current = "timetable";
var collect = null;        // panel-supplied () -> { patch } | null when invalid
var dirty = false;

var PANELS = [
  { key:"timetable", label:"Timetable", icon:"i-grid",  render: panelTimetable, field:"schedule2" },
  { key:"calendar",  label:"Calendar",  icon:"i-cal",   render: panelCalendar,  field:"events"   },
  { key:"bells",     label:"Bell times",label2:"Bells", icon:"i-clock", render: panelBells, field:"bells" },
  { key:"subjects",  label:"Subjects",  icon:"i-book",  render: panelSubjects,  field:"legend"   },
  { key:"banner",    label:"Banner",    icon:"i-alert", render: panelBanner,    field:"globalBanner" }
];

function el(tag, cls, text){
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function field(label, node, hint){
  var l = el("label", "field");
  l.appendChild(el("span", null, label));
  l.appendChild(node);
  if (hint) l.appendChild(el("small", "hint", hint));
  return l;
}
function input(value, ph, cls){
  var i = document.createElement("input");
  i.type = "text"; i.value = value === undefined || value === null ? "" : value;
  if (ph) i.placeholder = ph;
  if (cls) i.className = cls;
  i.addEventListener("input", markDirty);
  return i;
}
function markDirty(){
  dirty = true;
  var s = document.getElementById("consoleStatus");
  if (s){ s.textContent = "Unpublished changes"; s.className = "console-status warn"; }
}
function clearDirty(msg){
  dirty = false;
  var s = document.getElementById("consoleStatus");
  if (s){ s.textContent = msg || ""; s.className = "console-status"; }
}

/* ---------------------------------------------------------------- shell -- */

function build(){
  if (built) return;
  built = true;

  var wrap = el("div", "console");
  wrap.id = "siteConsole";
  wrap.hidden = true;
  wrap.innerHTML =
    '<div class="console-box" role="dialog" aria-modal="true" aria-label="Site editor">' +
      '<header class="console-head">' +
        '<div class="console-title">' +
          svgIcon("i-spark") +
          '<div><h2>Site editor</h2>' +
          '<p>Changes publish to everyone the moment you save.</p></div>' +
        '</div>' +
        '<button class="console-close" id="consoleClose" aria-label="Close editor">' +
          svgIcon("i-close") + '</button>' +
      '</header>' +
      '<nav class="console-tabs" id="consoleTabs" role="tablist"></nav>' +
      '<div class="console-body" id="consoleBody"></div>' +
      '<footer class="console-foot">' +
        '<span class="console-status" id="consoleStatus"></span>' +
        '<button class="btn ghost sm" id="consoleReset">Reset this section</button>' +
        '<button class="btn" id="consoleSave">Publish to everyone</button>' +
      '</footer>' +
    '</div>';
  document.body.appendChild(wrap);

  var tabs = wrap.querySelector("#consoleTabs");
  PANELS.forEach(function(p){
    var b = el("button", "console-tab", p.label);
    b.type = "button";
    b.dataset.key = p.key;
    b.setAttribute("role", "tab");
    b.addEventListener("click", function(){ show(p.key); });
    tabs.appendChild(b);
  });

  wrap.querySelector("#consoleClose").addEventListener("click", close);
  wrap.addEventListener("click", function(e){ if (e.target === wrap) close(); });
  wrap.querySelector("#consoleSave").addEventListener("click", publish);
  wrap.querySelector("#consoleReset").addEventListener("click", resetSection);
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && !wrap.hidden) close();
  });
}

function open(key){
  build();
  if (!canAdmin()){ toast("Admins only.", true); return; }
  document.getElementById("siteConsole").hidden = false;
  document.body.classList.add("console-open");
  show(key || current);
}
function close(){
  var w = document.getElementById("siteConsole");
  if (!w) return;
  if (dirty && !window.confirm("You have changes that haven't been published. Close anyway?")) return;
  w.hidden = true;
  document.body.classList.remove("console-open");
  dirty = false;
}
function isOpen(){
  var w = document.getElementById("siteConsole");
  return !!w && !w.hidden;
}

function show(key){
  current = key;
  var body = document.getElementById("consoleBody");
  body.innerHTML = "";
  document.querySelectorAll(".console-tab").forEach(function(b){
    b.classList.toggle("on", b.dataset.key === key);
  });
  var p = PANELS.filter(function(x){ return x.key === key; })[0];
  collect = p.render(body);
  clearDirty("");
}

function publish(){
  if (!collect) return;
  var out = collect();
  if (!out) return;                      // the panel already explained why
  var db = requireDb(); if (!db) return;
  var btn = document.getElementById("consoleSave");
  btn.disabled = true; btn.textContent = "Publishing…";
  saveConfig(out, "Published. Everyone sees it now.");
  setTimeout(function(){
    btn.disabled = false; btn.textContent = "Publish to everyone";
    clearDirty("Published.");
    show(current);
  }, 700);
}

function resetSection(){
  var p = PANELS.filter(function(x){ return x.key === current; })[0];
  if (!window.confirm("Drop this section's edits and go back to the printed 2026-2027 calendar?")) return;
  var patch = {};
  patch[p.field] = p.field === "globalBanner" ? null : {};
  saveConfig(patch, "Reset to the printed version.");
  setTimeout(function(){ show(current); }, 700);
}

/* ------------------------------------------------------------ timetable -- */

function panelTimetable(body){
  var sched = liveSched();
  var draft = {};
  Object.keys(sched).forEach(function(d){
    draft[d] = sched[d].map(function(c){ return { c:c.c, r:c.r, t:c.t }; });
  });
  var day = "1";

  body.appendChild(intro(
    "The seven-day cycle",
    "Pick a cycle day, then set what each session is. Codes are the short ones the timetable uses. The Subjects panel is where a code gets its full name."
  ));

  var chips = el("div", "console-chips");
  ["1","2","3","4","5","6","7"].forEach(function(d){
    var b = el("button", "chip-btn", "Day " + d);
    b.type = "button";
    b.addEventListener("click", function(){ day = d; paint(); });
    b.dataset.day = d;
    chips.appendChild(b);
  });
  body.appendChild(chips);

  var rows = el("div", "console-rows");
  body.appendChild(rows);

  function paint(){
    chips.querySelectorAll(".chip-btn").forEach(function(b){
      b.classList.toggle("on", b.dataset.day === day);
    });
    rows.innerHTML = "";
    var modes = liveModes();
    (draft[day] || []).forEach(function(cell, i){
      var r = el("div", "console-row");
      var t = modes.regular.sessions[i];
      r.appendChild(el("div", "console-row-n", "S" + (i + 1) +
        (t ? "  " + t[0] + "-" + t[1] : "")));
      var grid = el("div", "console-row-grid");
      var a = input(cell.c, "Code");
      var b = input(cell.r, "Room");
      var c = input(cell.t, "Teacher");
      a.addEventListener("input", function(){ cell.c = a.value.trim(); });
      b.addEventListener("input", function(){ cell.r = b.value.trim(); });
      c.addEventListener("input", function(){ cell.t = c.value.trim(); });
      grid.appendChild(a); grid.appendChild(b); grid.appendChild(c);
      r.appendChild(grid);
      rows.appendChild(r);
    });
  }
  paint();

  return function(){
    /* Only days that actually differ from the printed timetable are stored,
       so the override document stays small and honest about what changed. */
    var out = {};
    Object.keys(draft).forEach(function(d){
      var base = SCHED[d] || [];
      var changed = draft[d].some(function(cell, i){
        var b = base[i] || {};
        return cell.c !== (b.c||"") || cell.r !== (b.r||"") || cell.t !== (b.t||"");
      });
      if (changed) out[d] = draft[d];
    });
    return { schedule2: out };
  };
}

/* ------------------------------------------------------------- calendar -- */

var KINDS = [
  ["",          "Normal school day"],
  ["quickexit", "Quick exit"],
  ["halfday",   "Half day (PLC)"],
  ["holiday",   "No school / holiday"],
  ["event",     "Event only"]
];

function panelCalendar(body){
  var cal = liveCal();
  var edits = Object.assign({}, (state.config || {}).events || {});
  var iso = todayOrFirst(cal);

  body.appendChild(intro(
    "One day at a time",
    "Change what a date says, or add a date the printed calendar never had. The schedule the Hub shows for that day follows the kind you pick here."
  ));

  var picker = el("div", "console-datepick");
  var dateInput = document.createElement("input");
  dateInput.type = "date"; dateInput.value = iso;
  dateInput.addEventListener("change", function(){
    if (dateInput.value){ iso = dateInput.value; paint(); }
  });
  picker.appendChild(field("Date", dateInput));
  body.appendChild(picker);

  var form = el("div", "console-form");
  body.appendChild(form);

  var dayIn, kindIn, evIn;

  function paint(){
    dateInput.value = iso;
    var cur = edits[iso] !== undefined && edits[iso] !== null
      ? Object.assign({}, cal[iso], edits[iso])
      : (cal[iso] || {});
    form.innerHTML = "";

    dayIn = input(cur.day || "", "Day 1 … Day 7, or blank");
    kindIn = document.createElement("select");
    KINDS.forEach(function(k){
      var o = document.createElement("option");
      o.value = k[0]; o.textContent = k[1];
      kindIn.appendChild(o);
    });
    kindIn.value = cur.kind || "";
    kindIn.addEventListener("change", markDirty);

    evIn = document.createElement("textarea");
    evIn.value = (cur.events || []).join("\n");
    evIn.placeholder = "One line per thing happening that day";
    evIn.addEventListener("input", markDirty);

    form.appendChild(field("Cycle day", dayIn, "Leave blank for a day with no classes."));
    form.appendChild(field("Kind of day", kindIn));
    form.appendChild(field("What's on", evIn));

    var row = el("div", "btn-row");
    var save = el("button", "btn sm", "Stage this date");
    save.type = "button";
    save.addEventListener("click", function(){
      edits[iso] = {
        day: dayIn.value.trim(),
        kind: kindIn.value,
        events: evIn.value.split("\n").map(function(s){ return s.trim(); }).filter(Boolean)
      };
      markDirty();
      paintStaged();
      toast("Staged. Publish to send it out.");
    });
    var clear = el("button", "btn ghost sm", "Clear this date");
    clear.type = "button";
    clear.addEventListener("click", function(){
      edits[iso] = null;             // an explicit tombstone: hide a printed day
      markDirty(); paintStaged();
    });
    row.appendChild(save); row.appendChild(clear);
    form.appendChild(row);
    paintStaged();
  }

  var staged = el("div", "console-staged");
  body.appendChild(staged);
  function paintStaged(){
    var keys = Object.keys(edits).sort();
    staged.innerHTML = "";
    if (!keys.length) return;
    staged.appendChild(el("h4", null, "Waiting to publish"));
    keys.forEach(function(k){
      var v = edits[k];
      var line = el("div", "console-staged-row");
      line.appendChild(el("span", "mono", k));
      line.appendChild(el("span", null, v === null ? "cleared"
        : [v.day, (v.events||[]).join(", ")].filter(Boolean).join(" · ") || "(empty)"));
      var x = el("button", "linkbtn", "undo");
      x.type = "button";
      x.addEventListener("click", function(){ delete edits[k]; markDirty(); paintStaged(); });
      line.appendChild(x);
      staged.appendChild(line);
    });
  }

  paint();
  return function(){ return { events: edits }; };
}

function todayOrFirst(cal){
  var d = new Date();
  var iso = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  if (cal[iso]) return iso;
  var keys = Object.keys(cal).sort();
  var next = keys.filter(function(k){ return k >= iso; })[0];
  return next || keys[0] || iso;
}

/* ---------------------------------------------------------------- bells -- */

function panelBells(body){
  var modes = liveModes();
  var draft = {};
  Object.keys(modes).forEach(function(k){
    draft[k] = {
      sessions: modes[k].sessions.map(function(p){ return [p[0], p[1]]; }),
      dismissal: modes[k].dismissal,
      dismissLabel: modes[k].dismissLabel,
      blurb: modes[k].blurb
    };
  });
  var mode = "regular";

  body.appendChild(intro(
    "When the bells go",
    "These times drive the countdown on the front page, the highlighted session, and which schedule a quick-exit or half day shows. Write them the way the school does: 8:00, 1:55."
  ));

  var chips = el("div", "console-chips");
  Object.keys(modes).forEach(function(k){
    var b = el("button", "chip-btn", modes[k].name);
    b.type = "button"; b.dataset.mode = k;
    b.addEventListener("click", function(){ mode = k; paint(); });
    chips.appendChild(b);
  });
  body.appendChild(chips);

  var form = el("div", "console-form");
  body.appendChild(form);

  function paint(){
    chips.querySelectorAll(".chip-btn").forEach(function(b){
      b.classList.toggle("on", b.dataset.mode === mode);
    });
    var d = draft[mode];
    form.innerHTML = "";
    var rows = el("div", "console-rows");
    d.sessions.forEach(function(pair, i){
      var r = el("div", "console-row");
      r.appendChild(el("div", "console-row-n", "Session " + (i + 1)));
      var g = el("div", "console-row-grid two");
      var a = input(pair[0], "start"), b = input(pair[1], "end");
      a.addEventListener("input", function(){ pair[0] = a.value.trim(); });
      b.addEventListener("input", function(){ pair[1] = b.value.trim(); });
      g.appendChild(a); g.appendChild(b);
      r.appendChild(g);
      rows.appendChild(r);
    });
    form.appendChild(rows);

    var dis = input(d.dismissal, "3:15");
    dis.addEventListener("input", function(){ d.dismissal = dis.value.trim(); });
    var lab = input(d.dismissLabel, "Classes end");
    lab.addEventListener("input", function(){ d.dismissLabel = lab.value.trim(); });
    var bl = document.createElement("textarea");
    bl.value = d.blurb; bl.style.minHeight = "72px";
    bl.addEventListener("input", function(){ d.blurb = bl.value; markDirty(); });
    form.appendChild(field("Dismissal time", dis));
    form.appendChild(field("What to call it", lab));
    form.appendChild(field("One-line description", bl));
  }
  paint();

  return function(){
    var bad = null;
    Object.keys(draft).forEach(function(k){
      draft[k].sessions.forEach(function(p, i){
        if (!parseable(p[0]) || !parseable(p[1]))
          bad = bad || (liveModes()[k].name + ", session " + (i + 1));
      });
      if (!parseable(draft[k].dismissal)) bad = bad || (liveModes()[k].name + ", dismissal");
    });
    if (bad){
      toast("That time doesn't look like a clock time: " + bad, true);
      return null;
    }
    var out = {};
    Object.keys(draft).forEach(function(k){
      var base = BELL_MODES[k];
      var same = JSON.stringify(base.sessions) === JSON.stringify(draft[k].sessions)
        && base.dismissal === draft[k].dismissal
        && base.dismissLabel === draft[k].dismissLabel
        && base.blurb === draft[k].blurb;
      if (!same) out[k] = draft[k];
    });
    return { bells: out };
  };
}

/* The site reads times as h:mm on a 12-hour school clock. */
function parseable(s){ return /^\d{1,2}:\d{2}$/.test(String(s || "").trim()); }

/* ------------------------------------------------------------- subjects -- */

function panelSubjects(body){
  var legend = liveLegend();
  var rowsData = Object.keys(legend).sort().map(function(k){
    return { code: k, label: legend[k] || "" };
  });

  body.appendChild(intro(
    "What the codes mean",
    "The short code is what shows in the timetable; the name is what appears under it and in the subject filters. A code the timetable still teaches stays on this list even if you remove it here. Take it out of the Timetable panel first."
  ));

  var rows = el("div", "console-rows");
  body.appendChild(rows);

  function paint(){
    rows.innerHTML = "";
    rowsData.forEach(function(r, i){
      var line = el("div", "console-row");
      var g = el("div", "console-row-grid two");
      var a = input(r.code, "Code");
      var b = input(r.label, "Full name");
      a.addEventListener("input", function(){ r.code = a.value.trim(); });
      b.addEventListener("input", function(){ r.label = b.value; });
      g.appendChild(a); g.appendChild(b);
      var x = el("button", "console-x", "×");
      x.type = "button"; x.title = "Remove";
      x.addEventListener("click", function(){ rowsData.splice(i, 1); markDirty(); paint(); });
      line.appendChild(g); line.appendChild(x);
      rows.appendChild(line);
    });
  }
  paint();

  var add = el("button", "btn ghost sm", "Add a subject");
  add.type = "button";
  add.addEventListener("click", function(){
    rowsData.push({ code:"", label:"" }); markDirty(); paint();
  });
  body.appendChild(add);

  return function(){
    var out = {};
    var dupe = null;
    rowsData.forEach(function(r){
      if (!r.code) return;
      if (out[r.code] !== undefined) dupe = r.code;
      out[r.code] = r.label;
    });
    if (dupe){ toast("Two rows both use the code “" + dupe + "”.", true); return null; }
    return { legend: out };
  };
}

/* --------------------------------------------------------------- banner -- */

function panelBanner(body){
  var b = state.globalBanner || {};
  body.appendChild(intro(
    "The strip across the top",
    "For the one thing the whole class needs to see before anything else. Leave the text empty to take it down."
  ));
  var title = input(b.title || "", "Notice");
  var txt = document.createElement("textarea");
  txt.value = b.text || "";
  txt.placeholder = "No school Monday, Independence Day.";
  txt.style.minHeight = "92px";
  txt.addEventListener("input", markDirty);

  body.appendChild(field("Heading", title));
  body.appendChild(field("Message", txt, "Clear the message and publish to take the banner down."));

  return function(){
    var text = txt.value.trim();
    return {
      globalBanner: {
        title: title.value.trim() || "Notice",
        text: text,
        active: !!text,
        updatedAt: new Date().toISOString()
      }
    };
  };
}

/* ---------------------------------------------------------------- bits --- */

function intro(title, text){
  var d = el("div", "console-intro");
  d.appendChild(el("h3", null, title));
  d.appendChild(el("p", null, text));
  return d;
}

export { open as openSiteEditor, close as closeSiteEditor, isOpen as siteEditorOpen };
