import { saveConfig } from "./backend.js";
import { liveBell, liveBellNote, liveLegend, liveSched, liveSessions, liveDayMode } from "./live.js";
import { renderFilterChips } from "./help.js";
import { todayInfo } from "./orbit.js";
import { state } from "./state.js";
import { esc } from "./text.js";

/* =========================================================
   3. Rendering, Schedule tab
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

/* Each subject keeps one colour everywhere it appears: the timeline, the
   timetable, work, notes. Known codes are picked by hand so neighbours in
   a day don't clash; anything new gets one from its name. */
var SUBJECT_COLORS = {
  "LA":"#2F66E0", "M":"#7B3FE4", "S&T":"#16A06A", "QR":"#0E9AB0", "DA&M":"#E8641C",
  "FA":"#D6456A", "Span":"#C58A06", "BS":"#4F52D8", "PE":"#DD3E6E", "FL&E":"#A5651A",
  "LS":"#0B8FB0", "CP":"#5E6B82", "PLC":"#8A8597", "DA/FA":"#C2521A",
  "Assembly":"#5B2B8C"
};
var SPARE_COLORS = ["#2F66E0","#7B3FE4","#16A06A","#0E9AB0","#E8641C","#D6456A","#C58A06","#4F52D8"];
function subjectColor(code){
  if (!code || code === "general") return "#5B2B8C";
  if (SUBJECT_COLORS[code]) return SUBJECT_COLORS[code];
  var h = 0; code = String(code);
  for (var i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  return SPARE_COLORS[Math.abs(h) % SPARE_COLORS.length];
}

function renderScheduleTable(highlightDay){
  /* Repaints after a live edit call this with no argument; today's row
     should stay marked either way. */
  if (highlightDay === undefined){ try{ highlightDay = todayInfo().dayNum; }catch(e){ highlightDay = null; } }
  var table = document.getElementById("schedTable");
  var html = "<thead><tr><th>Day</th>";
  liveSessions().forEach(function(s){
    html += "<th>S" + s.n + "<br>" + esc(String(s.time).replace(/\u2013/g, "-")) + "</th>";
  });
  html += "</tr></thead><tbody>";
  for (var day = 1; day <= 7; day++){
    html += '<tr' + (day === highlightDay ? ' class="today"' : "") + '><td class="daycol"><span>Day ' + day + "</span></td>";
    liveSched()[day].forEach(function(s, i){
      var tip = [subjectName(s.c) || s.c, s.r && s.r !== "-" ? "Room " + s.r : "", s.t].filter(Boolean).join(" · ");
      html += '<td data-i="' + i + '" title="' + esc(tip) + '" style="--sc:' + subjectColor(s.c) + '"><div class="code">' + esc(s.c) +
              '</div><div class="rt">' + esc([s.r, s.t].filter(function(x){ return x && x !== "\u2014" && x !== "-"; }).join(" · ")) + "</div></td>";
    });
    html += "</tr>";
  }
  html += "</tbody>";
  table.innerHTML = html;

  /* The header times above are the regular schedule — say so plainly when
     today isn't running it, so nobody reads the wrong clock off this grid. */
  var note = document.getElementById("rotationNote");
  if (note){
    var ti = todayInfo(), m = liveDayMode(ti.info);
    note.textContent = (ti.dayNum && m.key !== "regular")
      ? "Times in this grid are the regular bell schedule. Today is a " +
        m.name.toLowerCase() + ", so check the timeline above for today's real times."
      : "Times in this grid are the regular bell schedule. Quick-exit and half days shift them.";
  }
}

function renderBell(){
  var wrap = document.getElementById("bellSchedules");
  var active = liveDayMode(todayInfo().info).key;
  var modeOf = { 0:"regular", 1:"quick", 2:"half" };
  wrap.innerHTML = "";
  Object.keys(liveBell()).forEach(function(name, idx){
    var isToday = modeOf[idx] === active && !!todayInfo().dayNum;
    var col = document.createElement("div");
    col.className = "bell-col" + (isToday ? " today" : "");
    var rows = liveBell()[name].map(function(r){
      return '<div class="bell-row"><span>' + esc(r[1]) + '</span><span>' + esc(String(r[0]).replace(/\u2013/g, "-")) + '</span></div>';
    }).join("");
    col.innerHTML = '<div class="bell-head"><span>' + esc(String(name).replace(/\s*\(.*\)\s*$/, "")) + '</span>' +
      (isToday ? '<span class="badge now">Today</span>' : '') + '</div>' + rows;
    wrap.appendChild(col);
  });
  // the note sits under the schedules, not inside them, so on phones it
  // stays put while the schedules swipe sideways
  var note = document.getElementById("bellNote");
  if (!note){
    note = document.createElement("p");
    note.className = "hint bell-note";
    note.id = "bellNote";
    wrap.insertAdjacentElement("afterend", note);
  }
  note.textContent = liveBellNote();
  // phones: start on today's schedule
  var t = wrap.querySelector(".bell-col.today");
  if (t && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft += t.getBoundingClientRect().left - wrap.getBoundingClientRect().left - 16;
}

function renderLegend(){
  var legend = liveLegend();
  var grid = document.getElementById("legendGrid");
  grid.innerHTML = "";
  Object.keys(legend).sort().forEach(function(code){
    var def = legend[code];
    var item = document.createElement("div");
    item.className = "legend-item";
    if (state.adminMode){
      item.innerHTML = '<span class="code">' + esc(code) + '</span><input data-code="' + esc(code) + '" value="' + esc(def || "") + '" placeholder="add description" aria-label="What ' + esc(code) + ' stands for">';
    } else {
      item.innerHTML = '<span class="code">' + esc(code) + '</span><span class="def' + (def ? "" : " placeholder") + '">' + esc(def || "not documented yet") + '</span>';
    }
    item.style.setProperty("--sc", subjectColor(code));
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
  return Object.keys(liveLegend()).sort();
}
function subjectLabel(code){
  if (!code || code === "general") return "General";
  var legend = liveLegend();
  return legend[code] ? code + ": " + legend[code] : code;
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


function subjectName(code){ var l = liveLegend(); return (l && l[code]) || ""; }

export { subjectColor, subjectName, dayNumberFromLabel, renderBell, renderLegend, renderScheduleTable, renderSubjectSelectors, saveLegend, subjectCodes, subjectLabel, todayISO };
