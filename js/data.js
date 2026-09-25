/* =========================================================
   1. DATA. Official 2026-2027 calendar + 3CS schedule
   ========================================================= */

// Flat map "YYYY-MM-DD" -> { day, kind, events[] }
// kind: "holiday" | "async" | "quickexit" | "halfday" | null
var CAL = {};
function add(date, info){ CAL[date] = info; }

// ---- August 2026 ----
add("2026-08-19",{events:["Orientation for Form 1"]});
add("2026-08-24",{day:"Day 1",events:["The Last First Day of School","Cycle 1 Starts","Q1 Starts","Week 1"]});
add("2026-08-25",{day:"Day 2",events:[]});
add("2026-08-26",{day:"Day 3",events:[]});
add("2026-08-27",{day:"Day 4",kind:"quickexit",events:["Seminar (F1-2)","Quick Exit"]});
add("2026-08-28",{day:"Day 5",kind:"quickexit",events:["Quick Exit"]});
add("2026-08-31",{day:"Day 6",events:["Week 2"]});

// ---- September 2026 ----
add("2026-09-01",{day:"Day 7",kind:"halfday",events:["1/2 Day 12:20 PM","C1 Ends"]});
add("2026-09-02",{day:"Day 1",events:["C2 Starts"]});
add("2026-09-03",{day:"Day 2",events:[]});
add("2026-09-04",{day:"Day 3",events:["Happy Birthday Itz'at!"]});
add("2026-09-07",{day:"Day 4",events:["Week 3","Seminar (1st & 2nd)"]});
add("2026-09-08",{day:"Day 5",events:[]});
add("2026-09-09",{day:"Day 6",events:["Rags Day - Wear Yellow (Suicide Prevention & Mental Health Awareness)"]});
add("2026-09-10",{kind:"holiday",events:["Public & Bank Holiday - St. George's Caye Day"]});
add("2026-09-11",{day:"Day 7",kind:"halfday",events:["1/2 Day 12:20 PM","C2 Ends"]});
add("2026-09-14",{day:"Day 1",events:["C3 Starts","Week 4"]});
add("2026-09-15",{day:"Day 2",events:[]});
add("2026-09-16",{day:"Day 3",events:[]});
add("2026-09-17",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2026-09-18",{day:"Day 5",events:["Patriotic Dress-up"]});
add("2026-09-21",{kind:"holiday",events:["21st Uniform Parade","Independence Day","Week 5"]});
add("2026-09-22",{day:"Day 6",events:[]});
add("2026-09-23",{day:"Day 7",kind:"halfday",events:["1/2 Day 12:20 PM","C3 Ends"]});
add("2026-09-24",{day:"Day 1",kind:"quickexit",events:["C4 Starts","Quick Exit"]});
add("2026-09-25",{day:"Day 2",kind:"quickexit",events:["Quick Exit","Fundraiser - Maker Space 6:30 PM"]});
add("2026-09-28",{day:"Day 3",events:["Week 6"]});
add("2026-09-29",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2026-09-30",{day:"Day 5",events:[]});

// ---- October 2026 ----
add("2026-10-01",{day:"Day 6",events:[]});
add("2026-10-02",{day:"Day 7",kind:"halfday",events:["1/2 Day 12:20 PM","C4 Ends"]});
add("2026-10-05",{day:"Day 1",events:["C5 Starts","Mental Awareness Week begins","Week 7"]});
add("2026-10-06",{day:"Day 2",events:[]});
add("2026-10-07",{day:"Day 3",events:[]});
add("2026-10-08",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2026-10-09",{day:"Day 5",events:["Mental Awareness Week ends"]});
add("2026-10-12",{kind:"holiday",events:["P&B Holiday - Indigenous Peoples' Resistance Day","Week 8"]});
add("2026-10-13",{day:"Day 6",events:[]});
add("2026-10-14",{day:"Day 7",kind:"halfday",events:["C5 Ends","1/2 Day 12:20 PM"]});
add("2026-10-15",{day:"Day 1",events:["C6 Starts","Rags Day - Wear Orange (Anti-Bullying)"]});
add("2026-10-16",{day:"Day 2",events:[]});
add("2026-10-19",{day:"Day 3",events:["Week 9"]});
add("2026-10-20",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2026-10-21",{day:"Day 5",events:[]});
add("2026-10-22",{day:"Day 6",events:[]});
add("2026-10-23",{day:"Day 7",kind:"halfday",events:["1/2 Day 12:20 PM","C6 Ends","Q1 Ends (Form 1-3)","Upcycling Fashion Show 6:30 PM"]});
add("2026-10-26",{day:"Day 1",events:["Week 10","Q2 Begins (Form 1-3)","C7 Begins"]});
add("2026-10-27",{day:"Day 2",events:[]});
add("2026-10-28",{day:"Day 3",events:["Dress-Up Day","Rags Day ($2)"]});
add("2026-10-29",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2026-10-30",{day:"Day 5",kind:"quickexit",events:["Quick Exit"]});

// ---- November 2026 ----
add("2026-11-02",{day:"Day 6",events:["Week 11"]});
add("2026-11-03",{day:"Day 7",kind:"halfday",events:["1/2 Day 12:20 PM","C7 Ends"]});
add("2026-11-04",{day:"Day 1",events:[]});
add("2026-11-05",{kind:"async",events:["Asynchronous Day"]});
add("2026-11-06",{kind:"async",events:["Asynchronous Day"]});
add("2026-11-09",{day:"Day 2",events:["Culture Week - wear your culture wear","Week 12"]});
add("2026-11-10",{day:"Day 3",events:["Culture Week - wear your culture wear"]});
add("2026-11-11",{day:"Day 4",kind:"quickexit",events:["Quick Exit - Issuing of Q1 Report Cards","World Kindness Day","Seminar (1st & 2nd)"]});
add("2026-11-12",{day:"Day 5",kind:"quickexit",events:["Culture Week - wear your culture wear","Quick Exit"]});
add("2026-11-13",{events:["Culture Day! Cultural Fair"]});
add("2026-11-16",{day:"Day 6",events:["Week 13"]});
add("2026-11-17",{day:"Day 7",kind:"halfday",events:["C8 Ends","1/2 Day 12:20 PM"]});
add("2026-11-18",{day:"Day 1",events:["C9 Starts"]});
add("2026-11-19",{kind:"holiday",events:["Public & Bank Holiday - Garifuna Settlement Day"]});
add("2026-11-20",{day:"Day 2",events:[]});
add("2026-11-23",{day:"Day 3",events:["Week 14"]});
add("2026-11-24",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2026-11-25",{day:"Day 5",events:["Fundraiser 6:30 PM"]});
add("2026-11-26",{day:"Day 6",kind:"quickexit",events:["Quick Exit","Rags Day - Wear Orange (Gender-Based Violence)"]});
add("2026-11-27",{day:"Day 7",kind:"halfday",events:["C9 Ends","1/2 Day 12:20 PM"]});

// ---- December 2026 ----
add("2026-11-30",{day:"Day 1",events:["C10 Starts","International Day of Persons with Disabilities","Week 15"]});
add("2026-12-01",{day:"Day 2",events:["Rags Day - Wear Christmas shirt / Special Ed Day"]});
add("2026-12-02",{day:"Day 3",events:[]});
add("2026-12-03",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2026-12-04",{day:"Day 5",kind:"quickexit",events:["Christmas Theatre Fundraiser","Quick Exit"]});
add("2026-12-07",{day:"Day 6",events:["Week 16"]});
add("2026-12-08",{day:"Day 7",kind:"halfday",events:["Cycle 10 Ends","1/2 Day 12:20 PM"]});
add("2026-12-09",{day:"Day 1",events:["Cycle 11 Starts"]});
add("2026-12-10",{day:"Day 2",events:[]});
add("2026-12-11",{events:["Student Christmas Activity 12:20 PM","Wear your Christmas colours","Staff Christmas Party"]});
["2026-12-14","2026-12-15","2026-12-16","2026-12-17","2026-12-18","2026-12-19","2026-12-20",
 "2026-12-21","2026-12-22","2026-12-23","2026-12-24","2026-12-25","2026-12-26","2026-12-27",
 "2026-12-28","2026-12-29","2026-12-30","2026-12-31"].forEach(function(d,i){
  add(d,{kind:"holiday",events:[i===0?"Christmas Holidays begin":"Christmas Holidays"]});
});

// ---- January 2027 ----
["2027-01-01","2027-01-02","2027-01-03"].forEach(function(d){
  add(d,{kind:"holiday",events:[d==="2027-01-01"?"New Year's Day":"Christmas Holidays"]});
});
add("2027-01-04",{day:"Day 3",events:["School Re-opens","Q2 / C11 continue","Week 17"]});
add("2027-01-05",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2027-01-06",{day:"Day 5",events:[]});
add("2027-01-07",{day:"Day 6",events:["Incoming 1st Form application period opens"]});
add("2027-01-08",{day:"Day 7",kind:"halfday",events:["C11 Ends","1/2 Day 12:20 PM"]});
add("2027-01-11",{day:"Day 1",events:["Week 18","C12 Starts"]});
add("2027-01-12",{day:"Day 2",events:[]});
add("2027-01-13",{day:"Day 3",events:[]});
add("2027-01-14",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2027-01-15",{kind:"holiday",events:["P&B Holiday - George Price Day"]});
add("2027-01-18",{day:"Day 5",events:["Week 19"]});
add("2027-01-19",{day:"Day 6",events:[]});
add("2027-01-20",{day:"Day 7",events:["Cycle 12 Ends","Q2 Ends (Form 1-3)"]});
add("2027-01-21",{day:"Day 1",kind:"halfday",events:["Quarter 3 Begins (Form 1-3)","C13 Starts","1/2 Day 12:20 PM"]});
add("2027-01-22",{day:"Day 2",events:["Annual ISA Health Fair (Counselling Dept.)"]});
add("2027-01-25",{day:"Day 3",events:["Week 20","Rags Day"]});
add("2027-01-26",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2027-01-27",{day:"Day 5",events:[]});
add("2027-01-28",{day:"Day 6",kind:"quickexit",events:["Assembly - 4EM","Quick Exit"]});
add("2027-01-29",{day:"Day 7",kind:"quickexit",events:["Cycle 13 Ends","1/2 Day 12:20 PM","Quick Exit"]});

// ---- February 2027 ----
add("2027-02-01",{day:"Day 1",events:["Week 21","Cycle 14 Starts","Incoming 1st Form application deadline"]});
add("2027-02-02",{day:"Day 2",events:[]});
add("2027-02-03",{day:"Day 3",kind:"quickexit",events:["Quick Exit - Issuing of Q2 Report Cards"]});
add("2027-02-04",{kind:"async",events:["Asynchronous Day"]});
add("2027-02-05",{kind:"async",events:["Asynchronous Day"]});
add("2027-02-08",{day:"Day 4",events:["Week 22","Seminar (1st & 2nd)"]});
add("2027-02-09",{day:"Day 5",events:[]});
add("2027-02-10",{day:"Day 6",events:[]});
add("2027-02-11",{day:"Day 7",kind:"halfday",events:["Cycle 14 Ends","1/2 Day 12:20 PM"]});
add("2027-02-12",{events:["Rags Day - Wear Pink or White","Mini Val Fair","Annual ISA Food Sale"]});
add("2027-02-15",{day:"Day 1",events:["Week 23","Cycle 15 Starts"]});
add("2027-02-16",{day:"Day 2",events:[]});
add("2027-02-17",{day:"Day 3",events:[]});
add("2027-02-18",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2027-02-19",{day:"Day 5",events:[]});
add("2027-02-22",{day:"Day 6",events:["Week 24"]});
add("2027-02-23",{day:"Day 7",kind:"quickexit",events:["1/2 Day 12:20 PM","Cycle 16 begins","Quick Exit"]});
add("2027-02-24",{day:"Day 1",events:[]});
add("2027-02-25",{day:"Day 2",events:[]});
add("2027-02-26",{day:"Day 3",kind:"quickexit",events:["Quick Exit","ATLIB Exam"]});

// ---- March 2027 ----
add("2027-03-01",{day:"Day 4",events:["Week 25","Seminar (1st & 2nd)"]});
add("2027-03-02",{day:"Day 5",events:[]});
add("2027-03-03",{day:"Day 6",events:["Running Marathon 5:00 AM (parents, guardians, teachers, students)"]});
add("2027-03-04",{day:"Day 7",kind:"halfday",events:["1/2 Day 12:20 PM","Cycle 16 Ends","Women's Empowerment Rags Day - Wear Purple"]});
add("2027-03-05",{day:"Day 1",events:["Cycle 17 Begins"]});
add("2027-03-08",{kind:"holiday",events:["P&B Holiday - National Heroes & Benefactors Day","Week 26"]});
add("2027-03-09",{day:"Day 2",events:[]});
add("2027-03-10",{day:"Day 3",events:[]});
add("2027-03-11",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2027-03-12",{day:"Day 5",events:[]});
add("2027-03-15",{day:"Day 6",events:["Week 27"]});
add("2027-03-16",{day:"Day 7",kind:"halfday",events:["Cycle 17 Ends","1/2 Day 12:20 PM"]});
add("2027-03-17",{events:["Rock Your Socks Day - Down Syndrome Awareness","Sports Day & Fundraiser"]});
add("2027-03-18",{kind:"holiday",events:["BNTU Convention - No Classes"]});
add("2027-03-19",{kind:"holiday",events:["BNTU Convention - No Classes"]});
["2027-03-22","2027-03-23","2027-03-24","2027-03-25","2027-03-26","2027-03-29","2027-03-30","2027-03-31",
 "2027-04-01","2027-04-02"].forEach(function(d){
  add(d,{kind:"holiday",events:["Easter Holidays (Mar 22 - Apr 2)"]});
});

// ---- April 2027 ----
add("2027-04-05",{day:"Day 1",events:["Cycle 18 Starts","School Re-opens","Week 28"]});
add("2027-04-06",{day:"Day 2",events:[]});
add("2027-04-07",{day:"Day 3",events:[]});
add("2027-04-08",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2027-04-09",{day:"Day 5",events:[]});
add("2027-04-12",{day:"Day 6",events:["Week 29","Assembly - 4CS"]});
add("2027-04-13",{day:"Day 7",kind:"halfday",events:["Cycle 18 Ends","Q3 Ends (Form 1-3)","PLC 1/2 Day 12:30 PM"]});
add("2027-04-14",{day:"Day 1",events:["Cycle 19 Begins"]});
add("2027-04-15",{day:"Day 2",events:[]});
add("2027-04-16",{day:"Day 3",events:["Super Teams (1st & 2nd)"]});
add("2027-04-19",{day:"Day 4",events:["Week 30","Seminar (1st & 2nd)"]});
add("2027-04-20",{day:"Day 5",events:[]});
add("2027-04-21",{day:"Day 6",events:[]});
add("2027-04-22",{kind:"async",events:["Asynchronous Day"]});
add("2027-04-23",{kind:"async",events:["Asynchronous Day"]});
add("2027-04-26",{day:"Day 7",kind:"halfday",events:["Week 31","1/2 Day 12:20 PM","Quick Exit - Issuing of Q3 Report Cards","C19 Ends"]});
add("2027-04-27",{day:"Day 1",events:["Cycle 20 Starts"]});
add("2027-04-28",{day:"Day 2",kind:"quickexit",events:["Quick Exit"]});
add("2027-04-29",{day:"Day 3",kind:"quickexit",events:["Quick Exit"]});
add("2027-04-30",{events:["Annual ISA Open & Career Day, 8:00 AM-1:00 PM","Fundraiser"]});

// ---- May 2027 ----
add("2027-05-01",{kind:"holiday",events:["P&B Holiday - Labor Day"]});
add("2027-05-03",{day:"Day 4",events:["Week 32","Seminar (1st & 2nd)","Career Pathway Selection begins"]});
add("2027-05-04",{day:"Day 5",events:["Career Pathway Selection","Form 4 Capstone Presentations"]});
add("2027-05-05",{day:"Day 6",events:["Assembly - 2B","Form 4 Capstone Presentations","Career Pathway Selection"]});
add("2027-05-06",{day:"Day 7",kind:"halfday",events:["Cycle 20 Ends","1/2 Day 12:20 PM","Career Pathway Selection","Last Day of Form 4"]});
add("2027-05-07",{day:"Day 1",events:["Cycle 21 Begins","Career Pathway Selection"]});
add("2027-05-10",{day:"Day 2",kind:"halfday",events:["Teacher's Week","Ecumenical Service (1/2 Day 12:20 dismissal)","Week 33"]});
add("2027-05-11",{day:"Day 3",events:["Career Pathway Selection forms due"]});
add("2027-05-12",{day:"Day 4",events:[]});
add("2027-05-13",{day:"Day 5",events:[]});
add("2027-05-14",{kind:"holiday",events:["National Teacher's Day (branch level) - No Classes"]});
add("2027-05-17",{day:"Day 6",events:["Week 34"]});
add("2027-05-18",{day:"Day 7",kind:"halfday",events:["Cycle 21 Ends","1/2 Day 12:20 PM"]});
add("2027-05-19",{day:"Day 1",events:["Cycle 22 Starts"]});
add("2027-05-20",{day:"Day 2",kind:"halfday",events:["BNTU Service Day","1/2 Day 12:20 dismissal"]});
add("2027-05-21",{day:"Day 3",events:[]});
add("2027-05-24",{day:"Day 4",events:["Week 35","Seminar (1st & 2nd)"]});
add("2027-05-25",{day:"Day 5",events:["Graduation list posted"]});
add("2027-05-26",{day:"Day 6",events:["Career Pathway Selection list posted"]});
add("2027-05-27",{day:"Day 7",kind:"quickexit",events:["Cycle 22 Ends","1/2 Day 12:20 PM","Quick Exit"]});
add("2027-05-28",{day:"Day 1",events:["Cycle 23 Begins","End of School Art Exhibition, NICH Bliss Centre for the Arts"]});
add("2027-05-31",{day:"Day 2",events:["Week 36"]});

// ---- June 2027 (source PDF mislabels this page "June 2026"; weekday
//      alignment and content confirm it belongs to June 2027) ----
add("2027-06-01",{day:"Day 3",events:[]});
add("2027-06-02",{day:"Day 4",events:["Seminar (1st & 2nd)"]});
add("2027-06-03",{day:"Day 5",kind:"halfday",events:["1/2 Day 12:20 dismissal","Appreciation Night (Form 4 & parents)"]});
add("2027-06-04",{day:"Day 6",events:[]});
add("2027-06-05",{events:["Graduation - Form 4, 3:00 PM (time TBD)"]});
add("2027-06-07",{day:"Day 7",kind:"halfday",events:["1/2 Day 12:20 PM","Cycle 23 Ends","Week 37"]});
add("2027-06-08",{day:"Day 1",events:["Cycle 24 Starts"]});
add("2027-06-09",{day:"Day 2",events:["Form 1 End-of-Year Panel Presentation"]});
add("2027-06-10",{day:"Day 3",events:["Form 2 End-of-Year Panel Presentation"]});
add("2027-06-11",{day:"Day 4",events:["Seminars (Form 1 & 2)","Form 3 End-of-Year Panel Presentation"]});
add("2027-06-14",{day:"Day 5",events:["Week 38"]});
add("2027-06-15",{day:"Day 6",kind:"halfday",events:["Class clean-up","1/2 Day 12:20 PM"]});
add("2027-06-16",{day:"Day 7",events:["Last Day of Classes","End-of-Year Trip (all forms)","Cycle 24 Ends","Q4 Ends (Form 1-3)"]});
add("2027-06-17",{events:["PTA By-Election, 6:00 PM"]});
add("2027-06-21",{events:["Week 39"]});
add("2027-06-25",{events:["End of 2026/2027 School Year","Issuing of Q4 Report Cards"]});
add("2027-06-26",{kind:"holiday",events:["2026-2027 Staff Retreat"]});
add("2027-06-27",{kind:"holiday",events:["2026-2027 Staff Retreat"]});
add("2027-06-28",{events:["Summer Vacation Commences","ISA College Prep Starts"]});

var MONTHS = [
  [2026,7],[2026,8],[2026,9],[2026,10],[2026,11],
  [2027,0],[2027,1],[2027,2],[2027,3],[2027,4],[2027,5]
]; // JS month index (0=Jan); Aug 2026 -> Jun 2027
var MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
var DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

/* The three bell schedules the school actually runs. A day picks one of
   these, so "Session 3" is a different clock slot on a quick-exit day than
   on a regular one. Which is exactly the thing that causes confusion. */
var BELL_MODES = {
  regular: {
    key:"regular", name:"Regular day", short:"Regular",
    sessions:[["8:00","8:55"],["9:00","9:55"],["10:05","11:00"],["11:05","12:00"],["1:00","1:55"],["2:05","3:00"]],
    dismissal:"3:15", dismissLabel:"Classes end",
    blurb:"Six 55-minute sessions, lunch 12:00-1:00."
  },
  quick: {
    key:"quick", name:"Quick exit", short:"Quick exit",
    sessions:[["8:00","8:50"],["8:55","9:45"],["9:55","10:45"],["10:55","11:45"],["12:25","1:10"],["1:15","1:55"]],
    dismissal:"2:10", dismissLabel:"Out at",
    blurb:"Every session is 50 minutes and the whole day shifts earlier. Lunch is 11:45."
  },
  half: {
    key:"half", name:"Half day", short:"Half day",
    sessions:[["8:00","8:55"],["9:00","9:55"],["10:05","11:00"],["11:05","12:00"]],
    dismissal:"12:20", dismissLabel:"Dismissal",
    blurb:"Sessions 1-4 only, then dismissal at 12:20. Staff stay for PLC planning at 1:00."
  }
};
/* Which schedule is today on? The calendar's own wording decides. */
function dayMode(info){
  if (!info) return BELL_MODES.regular;
  var t = (info.events || []).join(" ").toLowerCase();
  if (t.indexOf("1/2 day") > -1 || info.kind === "halfday") return BELL_MODES.half;
  if (t.indexOf("quick exit") > -1 || info.kind === "quickexit") return BELL_MODES.quick;
  return BELL_MODES.regular;
}

var BELL = {
  "Regular (55‑min classes)":[
    ["7:30","Campus opens"],["7:45-8:00","Chromebook pick-up / Advisory"],
    ["8:00-8:55","Session 1"],["8:55-9:00","Break"],["9:00-9:55","Session 2"],
    ["9:55-10:05","Break"],["10:05-11:00","Session 3"],["11:00-11:05","Break"],
    ["11:05-12:00","Session 4"],["12:00-1:00","Lunch"],["1:00-1:55","Session 5"],
    ["1:55-2:05","Break"],["2:05-3:00","Session 6"],["3:00-3:15","Classroom duties / Advisory"],
    ["3:15","Classes end"],["4:30","Campus closes"]
  ],
  "Quick exit (50‑min classes)":[
    ["7:30","Campus opens"],["7:45-8:00","Chromebook pick-up / Advisory"],
    ["8:00-8:50","Session 1"],["8:50-8:55","Break"],["8:55-9:45","Session 2"],
    ["9:45-9:55","Break"],["9:55-10:45","Session 3"],["10:45-10:55","Break"],
    ["10:55-11:45","Session 4"],["11:45-12:25","Lunch"],["12:25-1:10","Session 5"],
    ["1:10-1:15","Break"],["1:15-1:55","Session 6"],["1:55-2:10","Advisory / duties"],["2:10","Classes end"]
  ],
  "Day 7 (teacher planning half-day)":[
    ["7:30","Campus opens"],["7:45-8:00","Chromebook pick-up / Advisory"],
    ["8:00-8:55","Session 1"],["8:55-9:00","Break"],["9:00-9:55","Session 2"],
    ["9:55-10:05","Break"],["10:05-11:00","Session 3"],["11:00-11:05","Break"],
    ["11:05-12:00","Session 4"],["12:00-12:10","Advisory & duty"],["1:00","PLC (teachers)"]
  ]
};
var BELL_NOTE = "Day 3 has an extended lunch, 12:20-1:15 PM. Day 7 is a half-day so teachers can attend planning sessions (PLC).";

var SESSIONS = [
  {n:1,time:"8:00-8:55"},{n:2,time:"9:00-9:55"},{n:3,time:"10:05-11:00"},
  {n:4,time:"11:05-12:00"},{n:5,time:"1:00-1:55"},{n:6,time:"2:05-3:00"}
];
/* The 3CS timetable, 2026-2027 (the "Class 3CS - Simplified Timetable",
   updated September 2026). Teachers' initials carry over from the first
   timetable where the subject and room match; admins can correct any cell
   live from the site editor. Day 7 is a half day: four sessions, then PLC for teachers. */
var SCHED = {
  1:[{c:"QR",r:"D2",t:"JM"},{c:"FA",r:"FAS",t:"KS"},{c:"LA",r:"D1",t:"KG"},{c:"S&T",r:"D4",t:"BM"},{c:"Span",r:"N5",t:"JB"},{c:"BS",r:"N3",t:"DD"}],
  2:[{c:"QR",r:"D2",t:"JM"},{c:"DA&M",r:"DAS",t:"CST/CC"},{c:"FA",r:"FAS",t:"KS"},{c:"LA",r:"D1",t:"KG"},{c:"S&T",r:"D4",t:"BM"},{c:"M",r:"MS",t:"AK"}],
  3:[{c:"FA",r:"FAS",t:"KS"},{c:"LA",r:"D1",t:"KG"},{c:"M",r:"MS",t:"AK"},{c:"M",r:"MS",t:"AK"},{c:"QR",r:"D2",t:"JM"},{c:"FL&E",r:"N2",t:"LL"}],
  4:[{c:"S&T",r:"D4",t:"BM"},{c:"M",r:"MS",t:"AK"},{c:"DA&M",r:"DAS",t:"CST/CC"},{c:"LS",r:"N3",t:"DD"},{c:"LA",r:"D1",t:"KG"},{c:"QR",r:"D2",t:"JM"}],
  5:[{c:"QR",r:"D2",t:"JM"},{c:"DA&M",r:"DAS",t:"CST/CC"},{c:"Span",r:"N5",t:"JB"},{c:"PE",r:"D3",t:"CW"},{c:"CP",r:"N4",t:"KC"},{c:"CP",r:"N4",t:"KC"}],
  6:[{c:"LA",r:"D1",t:"KG"},{c:"DA&M",r:"DAS",t:"CST/CC"},{c:"DA&M",r:"DAS",t:"CST/CC"},{c:"S&T",r:"D4",t:"BM"},{c:"PE",r:"D3",t:"CW"},{c:"Assembly",r:"Maker Space",t:""}],
  7:[{c:"DA&M",r:"DAS",t:"CST/CC"},{c:"BS",r:"N3",t:"DD"},{c:"LA",r:"D1",t:"KG"},{c:"QR",r:"D2",t:"JM"},{c:"",r:"",t:""},{c:"",r:"",t:""}]
};

var DEFAULT_LEGEND = {
  "Span":"Spanish","LA":"Language Arts","M":"Math","PE":"Physical Education",
  "CP":"Career Pathway","PLC":"Professional Learning Community (staff planning time)",
  "FL&E":"","BS":"","QR":"","DA&M":"","FA":"","LS":"","S&T":"","Assembly":"School assembly"
};


export { BELL, BELL_MODES, BELL_NOTE, CAL, DEFAULT_LEGEND, DOW, MONTHS, MONTH_NAMES, SCHED, SESSIONS, add, dayMode };
