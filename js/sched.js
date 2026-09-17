import { saveConfig } from "./backend.js";
import { BELL, BELL_NOTE, DEFAULT_LEGEND, SCHED, SESSIONS, dayMode } from "./data.js";
import { renderFilterChips } from "./help.js";
import { todayInfo } from "./orbit.js";
import { state } from "./state.js";
import { esc } from "./text.js";

/* =========================================================
   3. Rendering — Schedule tab
   ========================================================= */
function todayISO(){
  var d = new Date();
  var m = String(d.getMonth()+1).padStart(2,"0");
  var day = String(d.getDate()).padStart(2,"0");
  return d.getFullYear()+"-"+m+"-"+day;
}
function dayNumberFromLabel(label){
  if (!label) return null;
  var m = /Day\s+(\d)/.exec(label);
  return m ? parseInt(m[1],10) : null;
}

/* Today's cycle day drives the hero, the line-up and the table highlight.
   The display lives in renderHero()/renderLineup(); this just computes. */

function renderScheduleTable(highlightDay){
  var table = document.getElementById("schedTable");
  var html = "<thead><tr><th>Day</th>";
  SESSIONS.forEach(function(s){
    html += '<th class="'+(s.n===highlightDay?"":"")+'">S'+s.n+'<br>'+s.time+'</th>';
  });
  html += "</tr></thead><tbody>";
  for (var day=1; day<=7; day++){
    html += "<tr><td class=\"daycol"+(day===highlightDay?" today":"")+"\">Day "+day+"</td>";
    SCHED[day].forEach(function(s){
      html += '<td class="'+(day===highlightDay?"today":"")+'"><div class="code">'+s.c+'</div><div class="rt">'+s.r+' · '+s.t+'</div></td>';
    });
    html += "</tr>";
  }
  html += "</tbody>";
  table.innerHTML = html;

  /* The header times above are the regular schedule — say so plainly when
     today isn't running it, so nobody reads the wrong clock off this grid. */
  var note = document.getElementById("rotationNote");
  if (note){
    var ti = todayInfo(), m = dayMode(ti.info);
    note.textContent = (ti.dayNum && m.key !== "regular")
      ? "Times in this grid are the regular bell schedule. Today is a " +
        m.name.toLowerCase() + " — check Today's line-up above for the real times."
      : "Times in this grid are the regular bell schedule. Quick-exit and half days shift them.";
  }
}

function renderBell(){
  var wrap = document.getElementById("bellSchedules");
  var active = dayMode(todayInfo().info).key;
  var modeOf = { 0:"regular", 1:"quick", 2:"half" };
  wrap.innerHTML = "";
  Object.keys(BELL).forEach(function(name, idx){
    var isToday = modeOf[idx] === active && !!todayInfo().dayNum;
    var col = document.createElement("div");
    col.className = "bell-col" + (isToday ? " today" : "");
    var rows = BELL[name].map(function(r){
      return '<div class="bell-row"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>';
    }).join("");
    col.innerHTML = '<div class="bell-head"><span>' + esc(name) + '</span>' +
      (isToday ? '<span class="badge pub">Today</span>' : '') + '</div>' + rows;
    wrap.appendChild(col);
  });
  var note = document.createElement("p");
  note.className = "hint";
  note.style.flexBasis = "100%";
  note.textContent = BELL_NOTE;
  wrap.appendChild(note);
}

function renderLegend(){
  var legend = Object.assign({}, DEFAULT_LEGEND, state.legend || {});
  var grid = document.getElementById("legendGrid");
  grid.innerHTML = "";
  Object.keys(legend).sort().forEach(function(code){
    var def = legend[code];
    var item = document.createElement("div");
    item.className = "legend-item";
    if (state.adminMode){
      item.innerHTML = '<span class="code">'+code+'</span><input data-code="'+code+'" value="'+(def||"").replace(/"/g,"&quot;")+'" placeholder="add description">';
    } else {
      item.innerHTML = '<span class="code">'+code+'</span><span class="def'+(def?"":" placeholder")+'">'+(def || "not documented yet")+'</span>';
    }
    grid.appendChild(item);
  });
  document.getElementById("legendEditBtn").hidden = !state.adminMode;
}

function saveLegend(){
  var inputs = document.querySelectorAll("#legendGrid input[data-code]");
  var next = {};
  inputs.forEach(function(inp){ next[inp.getAttribute("data-code")] = inp.value.trim(); });
  saveConfig({ legend: next }, "Legend saved for everyone.");
}

/* Subject codes drive the notebook + help board tags as well as the legend. */
function subjectCodes(){
  return Object.keys(Object.assign({}, DEFAULT_LEGEND, state.legend || {})).sort();
}
function subjectLabel(code){
  if (!code || code === "general") return "General";
  var legend = Object.assign({}, DEFAULT_LEGEND, state.legend || {});
  return legend[code] ? code + " — " + legend[code] : code;
}
function renderSubjectSelectors(){
  ["postSubject","noteSubjectSelect"].forEach(function(id){
    var sel = document.getElementById(id);
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = "";
    var opts = [["general","General"]].concat(subjectCodes().map(function(c){ return [c, subjectLabel(c)]; }));
    opts.forEach(function(o){
      var opt = document.createElement("option");
      opt.value = o[0]; opt.textContent = o[1];
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });
  renderFilterChips();
}


export { dayNumberFromLabel, renderBell, renderLegend, renderScheduleTable, renderSubjectSelectors, saveLegend, subjectCodes, subjectLabel, todayISO };
