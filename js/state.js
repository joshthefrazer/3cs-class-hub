import { applyAdminMode } from "./admin.js";

/* =========================================================
   2. State + db wiring
   ========================================================= */
var state = {
  tab: "schedule",
  standalone: false,
  adminMode: false,
  db: null,
  dbReady: false,
  dbSettled: false,      // use("db") has resolved one way or the other
  config: {},            // last full snapshot of site/config
  globalBanner: null,
  announcements: [],
  notebookNote: null,
  legend: null,
  notes: [],             // public notebook notes
  myNotes: [],           // notes you authored, any visibility (firebase)
  privNotes: [],         // your private notes, server-side (firebase)
  notesLoaded: false,
  posts: [],             // help board posts from db
  postsLoaded: false,
  pending: {},           // optimistic rows, keyed by id
  replies: {},           // postId -> [replies]
  openThread: null,
  replyUnsub: null,
  nbSubject: "all", nbVis: "all", nbQuery: "",
  hbStatus: "all", hbSubject: "all",

  assignments: [],       // the class's work, from the db
  workLoaded: false,
  workDone: {},          // assignment id -> true, yours alone
  workSubject: "all",
  workHideDone: true
};

try{
  state.adminMode     = localStorage.getItem("3cs_admin_ui") === "1";
  state.adminUnlocked = localStorage.getItem("3cs_admin_ok") === "1";
}catch(e){}
if (!state.adminUnlocked) state.adminMode = false;

/* Passcode gate. Stored as a hash so the digits aren't sitting in the page
   source, but this guards the INTERFACE only. The db write rules are what
   actually decide who can change shared data. */
var ADMIN_HASH = "9e263801";
function hashPass(s){
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;   // 32-bit multiply; plain * loses precision
  }
  return h.toString(16);
}
function setAdminUnlocked(on){
  state.adminUnlocked = on;
  if (!on) state.adminMode = false;
  try{
    localStorage.setItem("3cs_admin_ok", on ? "1" : "0");
    if (!on) localStorage.setItem("3cs_admin_ui", "0");
  }catch(e){}
  paintAdminSheet();
  applyAdminMode();
}
function paintAdminSheet(){
  var locked = document.getElementById("adminLocked");
  var open   = document.getElementById("adminUnlocked");
  if (!locked || !open) return;
  locked.hidden = state.adminUnlocked;
  open.hidden   = !state.adminUnlocked;
  var err = document.getElementById("adminPassErr");
  if (err) err.textContent = "";
  var f = document.getElementById("adminPass");
  if (f) f.value = "";
}


export { ADMIN_HASH, hashPass, paintAdminSheet, setAdminUnlocked, state };
