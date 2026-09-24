import { BE, canAdmin, dbErrMsg, authorFields, requireDb, toast, usingFirebase } from "./backend.js";
import { state } from "./state.js";
import { esc, svgIcon } from "./text.js";
import { subjectCodes } from "./sched.js";

/* =========================================================
   GOOGLE CLASSROOM. One account's feed, the whole class's list.

   Only an admin ever connects this, and only ever to their own Google
   account. What comes back is read three ways:

     the coursework        title, due date, description, link  -> published,
                           because that is the class's information

     your submission       turned in, returned, reclaimed      -> never leaves
     state                 this browser. It is used once, to decide what is
                           still worth publishing, and then thrown away.

   Nothing about what anyone has handed in is ever written to the database.
   The token is held in memory for the length of the sync and is not stored.

   Requires a Google Cloud OAuth client id in window.CLASSROOM_CLIENT_ID with
   the Classroom API enabled. Without one the button explains itself instead
   of failing.
   ========================================================= */

var SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly"
].join(" ");

var API = "https://classroom.googleapis.com/v1";
var GIS = "https://accounts.google.com/gsi/client";

var token = null;          // in memory only, for this sync
var tokenClient = null;
var pulled = [];           // preview rows awaiting a decision
var includePastDue = false;

function configured(){ return !!window.CLASSROOM_CLIENT_ID; }

function status(msg, isErr){
  var el = document.getElementById("workSyncStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "status-line" + (isErr ? " err" : "");
}

/* ------------------------------------------------------------- sign-in --- */

function loadGis(){
  return new Promise(function(resolve, reject){
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve();
    var s = document.createElement("script");
    s.src = GIS;
    s.async = true;
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error("Couldn't load Google's sign-in script.")); };
    document.head.appendChild(s);
  });
}

/* Asks Google for a token scoped to reading your own Classroom. The popup is
   Google's own, so this page never sees a password. */
function getToken(){
  return loadGis().then(function(){
    return new Promise(function(resolve, reject){
      try{
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: window.CLASSROOM_CLIENT_ID,
          scope: SCOPES,
          callback: function(resp){
            if (resp && resp.access_token){ token = resp.access_token; resolve(token); }
            else reject(new Error(describeOauthError(resp)));
          },
          error_callback: function(err){ reject(new Error(describeOauthError(err))); }
        });
        tokenClient.requestAccessToken({ prompt: token ? "" : "consent" });
      }catch(e){ reject(e); }
    });
  });
}

function describeOauthError(r){
  var t = (r && (r.type || r.error)) || "";
  if (t === "popup_closed" || t === "popup_failed_to_open")
    return "The Google window closed before it finished.";
  if (t === "access_denied")
    return "Google declined. If this is a school account, the school may block outside apps from reading Classroom.";
  if (t === "admin_policy_enforced")
    return "Your school's Google admin blocks this app from reading Classroom. Nothing on this side can change that.";
  return "Google wouldn't authorise the connection.";
}

/* ---------------------------------------------------------------- fetch -- */

function api(path){
  return fetch(API + path, { headers: { Authorization: "Bearer " + token } })
    .then(function(r){
      if (r.status === 401){ token = null; throw new Error("The Google session expired. Connect again."); }
      if (r.status === 403) throw new Error("Google refused that request. The Classroom API may not be enabled, or your school blocks it.");
      if (!r.ok) throw new Error("Classroom returned " + r.status + ".");
      return r.json();
    });
}

function courses(){
  return api("/courses?courseStates=ACTIVE&pageSize=50")
    .then(function(j){ return j.courses || []; });
}
function courseWork(id){
  return api("/courses/" + encodeURIComponent(id) + "/courseWork?pageSize=200")
    .then(function(j){ return j.courseWork || []; })
    .catch(function(){ return []; });     // a course you can't read is not fatal
}
/* One call per course gets every submission of yours in it. */
function submissions(id){
  return api("/courses/" + encodeURIComponent(id) + "/courseWork/-/studentSubmissions?userId=me&pageSize=400")
    .then(function(j){ return j.studentSubmissions || []; })
    .catch(function(){ return []; });
}

/* Classroom hands back a date as parts, and sometimes a time in UTC. The Hub
   stores the local calendar date, because that is what a due date means to a
   person looking at a timetable. */
function dueOf(cw){
  var d = cw.dueDate;
  if (!d || !d.year) return "";
  var iso = d.year + "-" + String(d.month).padStart(2, "0") + "-" + String(d.day).padStart(2, "0");
  var t = cw.dueTime;
  if (!t || (t.hours === undefined && t.minutes === undefined)) return iso;
  /* dueTime is UTC; convert to this device's day and clock. */
  var utc = new Date(Date.UTC(d.year, d.month - 1, d.day, t.hours || 0, t.minutes || 0));
  return utc.getFullYear() + "-" + String(utc.getMonth()+1).padStart(2,"0") + "-" +
         String(utc.getDate()).padStart(2,"0") + "T" +
         String(utc.getHours()).padStart(2,"0") + ":" + String(utc.getMinutes()).padStart(2,"0");
}

/* Still-assigned means: you haven't turned it in, and it hasn't been handed
   back. TURNED_IN and RETURNED drop out here and are never published. */
function stillAssigned(sub){
  if (!sub) return true;                      // no submission row yet = new
  var s = sub.state;
  return s === "NEW" || s === "CREATED" || s === "RECLAIMED_BY_STUDENT";
}

function isPastDue(due){
  if (!due) return false;
  var p = due.split("T"), d = p[0].split("-").map(Number);
  var t = (p[1] || "23:59").split(":").map(Number);
  return new Date(d[0], d[1]-1, d[2], t[0], t[1]).getTime() < Date.now();
}

/* Map a Classroom course to one of the Hub's subject codes when the name
   makes it obvious, so cards land under the right subject without asking. */
function guessSubject(courseName){
  var n = (courseName || "").toLowerCase();
  var codes = subjectCodes();
  var hints = {
    "math":"M", "language":"LA", "english":"LA", "spanish":"Span",
    "physical":"PE", "science":"S&T", "technolog":"S&T", "business":"BS",
    "quantitative":"QR", "fine art":"FA", "digital":"DA&M", "career":"CP",
    "life":"LS", "financial":"FL&E"
  };
  var hit = Object.keys(hints).filter(function(k){ return n.indexOf(k) > -1; })[0];
  var code = hit ? hints[hit] : "";
  return codes.indexOf(code) > -1 ? code : "";
}

/* ---------------------------------------------------------------- sync --- */

function sync(){
  if (!canAdmin()){ toast("Admins only.", true); return; }
  if (!configured()){
    status("Google Classroom isn't set up for this Hub yet. It needs a Google Cloud client id. Nothing else is affected.", true);
    return;
  }
  status("Opening Google…");
  getToken()
    .then(function(){
      status("Reading your courses…");
      return courses();
    })
    .then(function(list){
      if (!list.length){
        status("That account isn't in any active Classroom courses.", true);
        return null;
      }
      status("Found " + list.length + " course" + (list.length === 1 ? "" : "s") + ". Checking what's still set…");
      return Promise.all(list.map(function(c){
        return Promise.all([courseWork(c.id), submissions(c.id)]).then(function(r){
          var work = r[0], subs = {};
          r[1].forEach(function(s){ subs[s.courseWorkId] = s; });
          return work.map(function(cw){
            return { course: c, cw: cw, sub: subs[cw.id] };
          });
        });
      }));
    })
    .then(function(groups){
      if (!groups) return;
      var rows = [];
      groups.forEach(function(g){ g.forEach(function(x){ rows.push(x); }); });

      pulled = rows
        .filter(function(x){ return x.cw.workType !== "COURSE_MATERIAL"; })
        .filter(function(x){ return stillAssigned(x.sub); })
        .map(function(x){
          return {
            classroomId: x.cw.id,
            title: x.cw.title || "Untitled",
            detail: (x.cw.description || "").slice(0, 2000),
            due: dueOf(x.cw),
            link: x.cw.alternateLink || "",
            courseName: x.course.name || "",
            subject: guessSubject(x.course.name),
            take: true
          };
        })
        .filter(function(r){ return includePastDue || !isPastDue(r.due); })
        .sort(function(a, b){ return (a.due || "9999").localeCompare(b.due || "9999"); });

      token = null;        // done with it
      if (!pulled.length){
        status("Nothing outstanding. Everything in Classroom is either handed in or past its date.");
        renderPreview();
        return;
      }
      status(pulled.length + " still to do. Nothing about what you've handed in was read into the Hub.");
      renderPreview();
    })
    .catch(function(err){
      token = null;
      status(err && err.message ? err.message : "Couldn't reach Google Classroom.", true);
    });
}

/* -------------------------------------------------------------- preview -- */

function renderPreview(){
  var host = document.getElementById("workSyncPreview");
  if (!host) return;
  host.innerHTML = "";
  if (!pulled.length){ host.hidden = true; return; }
  host.hidden = false;

  var existing = {};
  (state.assignments || []).forEach(function(a){
    if (a.classroomId) existing[a.classroomId] = a;
  });

  var head = document.createElement("div");
  head.className = "sync-head";
  head.innerHTML = "<h4>From Google Classroom</h4>" +
    "<p>Tick what the class should see. Everyone gets the assignment; nobody gets your submission status.</p>";
  host.appendChild(head);

  var opts = document.createElement("label");
  opts.className = "checkline compact";
  opts.innerHTML = '<input type="checkbox" id="syncPastDue"' + (includePastDue ? " checked" : "") + '> Include work whose date has already passed';
  opts.querySelector("input").addEventListener("change", function(e){
    includePastDue = e.target.checked;
    sync();
  });
  host.appendChild(opts);

  pulled.forEach(function(r, i){
    var row = document.createElement("label");
    var known = existing[r.classroomId];
    row.className = "sync-row" + (known ? " known" : "");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = r.take && !known;
    r.take = cb.checked;
    cb.addEventListener("change", function(){ r.take = cb.checked; paintCount(); });
    row.appendChild(cb);
    var mid = document.createElement("div");
    mid.innerHTML = "<strong>" + esc(r.title) + "</strong>" +
      '<span class="sync-meta">' + esc(r.courseName) +
      (r.due ? " · due " + esc(r.due.replace("T", " ")) : " · no date") +
      (known ? " · already posted" : "") + "</span>";
    row.appendChild(mid);
    host.appendChild(row);
  });

  var act = document.createElement("div");
  act.className = "btn-row";
  var go = document.createElement("button");
  go.className = "btn sm";
  go.id = "syncPublishBtn";
  go.type = "button";
  go.addEventListener("click", publish);
  act.appendChild(go);
  var cancel = document.createElement("button");
  cancel.className = "btn ghost sm";
  cancel.type = "button";
  cancel.textContent = "Discard";
  cancel.addEventListener("click", function(){ pulled = []; renderPreview(); status(""); });
  act.appendChild(cancel);
  host.appendChild(act);
  paintCount();
}

function paintCount(){
  var b = document.getElementById("syncPublishBtn");
  if (!b) return;
  var n = pulled.filter(function(r){ return r.take; }).length;
  b.textContent = n ? "Post " + n + " to the class" : "Nothing ticked";
  b.disabled = !n;
}

function publish(){
  var db = requireDb(); if (!db) return;
  var take = pulled.filter(function(r){ return r.take; });
  if (!take.length) return;

  var now = new Date().toISOString();
  var writes = take.map(function(r){
    var row = {
      title: r.title,
      subject: r.subject || "",
      due: r.due || "",
      detail: r.detail || "",
      link: r.link || "",
      source: "classroom",
      classroomId: r.classroomId,
      courseName: r.courseName,
      createdAt: now,
      updatedAt: now
    };
    Object.assign(row, authorFields());
    return BE.db.collection("assignments").add(row);
  });

  status("Posting " + take.length + "…");
  Promise.all(writes)
    .then(function(){
      pulled = [];
      renderPreview();
      status("Posted. The class can see them now.");
      toast("Posted " + take.length + " to the class.");
    })
    .catch(function(err){ status(dbErrMsg(err), true); });
}

function classroomLabel(){
  return configured() ? "Sync Google Classroom" : "Google Classroom (not set up)";
}

export { sync as syncClassroom, configured as classroomConfigured, classroomLabel };
