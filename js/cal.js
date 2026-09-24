import { DOW, MONTHS, MONTH_NAMES } from "./data.js";
import { liveCal, liveDayMode } from "./live.js";
import { esc } from "./text.js";
import { todayISO } from "./sched.js";

/* =========================================================
   4. Rendering, Calendar tab
   ========================================================= */
var calCursor = (function(){
  var t = new Date();
  var idx = MONTHS.findIndex(function(m){ return m[0]===t.getFullYear() && m[1]===t.getMonth(); });
  return idx>=0 ? idx : 0;
})();

// calCursor lives here; other modules move it through this setter, because
// an imported binding cannot be assigned to.
function setCalCursor(i){ calCursor = i; }

function renderCalendarDow(){
  var el = document.getElementById("calDow");
  el.innerHTML = DOW.map(function(d){ return '<div class="cal-dow">'+d+'</div>'; }).join("");
}

function renderCalendar(){
  var my = MONTHS[calCursor];
  var year = my[0], month = my[1];
  document.getElementById("calTitle").textContent = MONTH_NAMES[month] + " " + year;
  document.getElementById("calPrev").disabled = calCursor===0;
  document.getElementById("calNext").disabled = calCursor===MONTHS.length-1;

  var first = new Date(year, month, 1);
  var firstDow = (first.getDay()+6)%7; // Mon=0
  var daysInMonth = new Date(year, month+1, 0).getDate();
  var todayStr = todayISO();

  var grid = document.getElementById("calGrid");
  grid.innerHTML = "";
  for (var i=0;i<firstDow;i++){
    var blank = document.createElement("div");
    blank.className = "cal-cell blank";
    grid.appendChild(blank);
  }
  for (var day=1; day<=daysInMonth; day++){
    var iso = year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
    var info = liveCal()[iso];
    var cell = document.createElement("div");
    var short = info && info.day && liveDayMode(info).key !== "regular";
    cell.className = "cal-cell" + (info && info.kind ? " k-" + info.kind : "") + (short ? " k-short" : "") + (iso === todayStr ? " is-today" : "");
    var html = '<div class="dnum">' + day + '</div>';
    if (info && info.day) html += '<div class="dlabel">' + esc(info.day) + '</div>';
    if (info && info.events && info.events.length){
      html += info.events.slice(0, 3).map(function(e){ return '<div class="ev">' + esc(e) + '</div>'; }).join("");
    }
    var said = [new Date(year, month, day).toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" })];
    if (info && info.day) said.push(info.day);
    if (info && info.events) said = said.concat(info.events);
    cell.setAttribute("aria-label", said.join(". "));
    cell.style.animationDelay = Math.min(day * 10, 360) + "ms";
    cell.innerHTML = html;
    grid.appendChild(cell);
  }
}


export { setCalCursor, calCursor, renderCalendar, renderCalendarDow };
