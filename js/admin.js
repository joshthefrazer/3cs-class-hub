import { postAnnouncement, renderAnnouncements, renderGlobalBanner, saveGlobalBanner } from "./ann.js";
import { BE, toast, usingFirebase } from "./backend.js";
import { calCursor, setCalCursor, renderCalendar } from "./cal.js";
import { MONTHS } from "./data.js";
import { postHelp, renderHelp } from "./help.js";
import { openByLinkSheet, openNoteById, openNoteEditor, renderNotebook, renderNotebookIntro, saveNotebookIntro } from "./notebook.js";
import { REDUCED, Sky, WORLD, renderHero, updateEdgePlanets, warpTo } from "./orbit.js";
import { renderLegend, saveLegend } from "./sched.js";
import { ADMIN_HASH, hashPass, paintAdminSheet, setAdminUnlocked, state } from "./state.js";
import { openNameSheet, svgIcon } from "./text.js";
import { openSiteEditor } from "./adminpanel.js";
import { replayReveal } from "./fx.js";
import { wireAuthSheet, openAuthSheet } from "./auth.js";
import { openWorkSheet, closeWorkSheet, saveWork, deleteWork, renderWork, renderWorkFilters } from "./work.js";
import { syncClassroom, classroomLabel } from "./classroom.js";

/* =========================================================
   7. Admin mode + tabs + wiring
   ========================================================= */
function applyAdminMode(){
  if (usingFirebase()){
    /* Firebase decides admin by account, so the passcode plays no part. */
    state.adminMode = BE.isAdmin;
    document.querySelectorAll(".admin-only").forEach(function(el){ el.hidden = !BE.isAdmin; });
    renderGlobalBanner();
    renderAnnouncements();
    renderNotebookIntro();
    renderNotebook();
    renderHelp();
    renderLegend();
    paintTrustNotes();
    return;
  }
  if (!state.adminUnlocked) state.adminMode = false;
  document.getElementById("adminToggleBtn").classList.toggle("is-on", state.adminMode);
  document.getElementById("adminToggleBtn").innerHTML =
    svgIcon(state.adminMode ? "i-unlock" : "i-lock") +
    "<span>" + (state.adminMode ? "Admin on" : "Admin") + "</span>";
  document.querySelectorAll(".admin-only").forEach(function(el){ el.hidden = !state.adminMode; });
  renderGlobalBanner();
  renderAnnouncements();
  renderNotebookIntro();
  renderNotebook();
  renderHelp();
  renderLegend();
}

/* The honest description of privacy differs per backend, so it is written
   from whichever one is actually live. */
function paintTrustNotes(){
  var nb = document.getElementById("notebookTrustNote");
  var hb = document.getElementById("helpTrustNote");
  if (!nb || !hb) return;
  if (usingFirebase()){
    nb.innerHTML =
      "<strong>Public</strong> notes are visible to everyone signed in. " +
      "<strong>Link only</strong> notes are kept out of the list by the server, so they open only for someone who has the link. " +
      "<strong>Private</strong> notes are stored under your account and the security rules stop anyone else reading them — including admins — and they follow you between devices. " +
      "Names come from your Google account, so posts carry a real one.";
    hb.innerHTML =
      "Everyone signed in can post, reply and react. Your name comes from your Google account, and the server only lets you edit or delete your own posts — admins can moderate anything.";
  } else {
    nb.innerHTML =
      "<strong>Public</strong> notes are visible to everyone who can open this Hub. " +
      "<strong>Link only</strong> notes stay out of the list, but anyone signed in who has the link can open one — that's secrecy, not a lock. " +
      "<strong>Private</strong> notes never leave this browser: they won't show up on your phone, and no one, admins included, can recover them. " +
      "This copy can't verify who anyone is, so shared editing runs on class trust.";
    hb.innerHTML =
      "Everyone signed in can post, reply, and react here. Names are self-chosen and unverified, so a classmate could in theory edit or remove someone else's post — " +
      "admins can clean up anything that goes wrong.";
  }
}

function checkNoteHash(){
  var h = "";
  try{ h = String(window.location.hash || ""); }catch(e){}
  if (h.indexOf("#note=") !== 0) return;
  var id = h.slice(6).replace(/[^A-Za-z0-9_\-.:@+~]/g, "");
  if (id) openNoteById(id);
}

function setTab(name){
  state.tab = name;
  document.querySelectorAll("nav.tabs button").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-tab")===name);
  });
  document.querySelectorAll("section.panel").forEach(function(s){
    s.classList.toggle("active", s.id==="tab-"+name);
  });
  document.body.setAttribute("data-world", name);
  document.body.classList.toggle("compact-world", name !== "schedule");
  if (name === "work"){ renderWorkFilters(); renderWork(); }
  if (WORLD[name]) Sky.tint(WORLD[name].a);
  updateEdgePlanets(name);
  renderHero(name);
  replayReveal();
  try{ sessionStorage.setItem("3cs_tab", name); }catch(e){}
}

function wire(){
  document.addEventListener("click", function(e){
    var t = e.target;
    if (t && t.closest && t.closest(".js-signin")) openAuthSheet();
  });
  document.getElementById("tabs").addEventListener("click", function(e){
    var btn = e.target.closest("button[data-tab]");
    if (btn) warpTo(btn.getAttribute("data-tab"));
  });
  ["edgeLeft","edgeRight"].forEach(function(id){
    document.getElementById(id).addEventListener("click", function(){
      warpTo(this.getAttribute("data-go"));
    });
  });
  document.getElementById("heroCtaBtn").addEventListener("click", function(){
    var card = document.getElementById("lineupCard");
    if (card) card.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block:"start" });
  });

  wireAuthSheet();

  var syncW = document.getElementById("workSyncBtn");
  if (syncW){
    var lab = document.getElementById("workSyncLabel");
    if (lab) lab.textContent = classroomLabel();
    syncW.addEventListener("click", syncClassroom);
  }

  var addW = document.getElementById("workAddBtn");
  if (addW) addW.addEventListener("click", function(){ openWorkSheet(null); });
  var closeW = document.getElementById("workSheetClose");
  if (closeW) closeW.addEventListener("click", closeWorkSheet);
  var saveW = document.getElementById("workSaveBtn");
  if (saveW) saveW.addEventListener("click", saveWork);
  var delW = document.getElementById("workDeleteBtn");
  if (delW) delW.addEventListener("click", deleteWork);
  var hideW = document.getElementById("workHideDone");
  if (hideW) hideW.addEventListener("change", function(e){
    state.workHideDone = e.target.checked;
    try{ localStorage.setItem("3cs_hide_done", state.workHideDone ? "1" : "0"); }catch(err){}
    renderWork();
  });
  try{
    if (localStorage.getItem("3cs_hide_done") === "0"){
      state.workHideDone = false;
      if (hideW) hideW.checked = false;
    }
  }catch(e){}
  var wSheet = document.getElementById("workSheet");
  if (wSheet) wSheet.addEventListener("click", function(e){ if (e.target === wSheet) closeWorkSheet(); });

  var seBtn = document.getElementById("siteEditorBtn");
  if (seBtn) seBtn.addEventListener("click", function(){ openSiteEditor(); });

  var sheet = document.getElementById("adminSheet");
  document.getElementById("adminToggleBtn").addEventListener("click", function(){
    paintAdminSheet();
    document.getElementById("adminModeCheck").checked = state.adminMode;
    document.getElementById("adminSheetBody").textContent =
      state.dbReady
        ? "Edit controls are gated by this Hub's real sharing permissions — turning this on just reveals the buttons on your device."
        : "This view can't reach live editing right now, so saves won't go through even with edit controls showing.";
    sheet.hidden = false;
  });
  document.getElementById("adminSheetClose").addEventListener("click", function(){ sheet.hidden = true; });
  document.getElementById("adminSheetOk").addEventListener("click", function(){ sheet.hidden = true; });
  var passField = document.getElementById("adminPass");
  function tryUnlock(){
    var err = document.getElementById("adminPassErr");
    if (hashPass(passField.value.trim()) === ADMIN_HASH){
      setAdminUnlocked(true);
      document.getElementById("adminModeCheck").checked = false;
      toast("Admin unlocked on this device.");
    } else {
      err.textContent = "That passcode doesn't match.";
      passField.value = "";
      passField.focus();
      var box = document.querySelector("#adminSheet .box");
      if (box){ box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); }
    }
  }
  document.getElementById("adminUnlockBtn").addEventListener("click", tryUnlock);
  passField.addEventListener("keydown", function(e){ if (e.key === "Enter") tryUnlock(); });
  document.getElementById("adminLockBtn").addEventListener("click", function(){
    setAdminUnlocked(false);
    toast("Admin locked. The passcode is needed again on this device.");
  });

  document.getElementById("adminModeCheck").addEventListener("change", function(e){
    if (!state.adminUnlocked){ e.target.checked = false; return; }
    state.adminMode = e.target.checked;
    try{ localStorage.setItem("3cs_admin_ui", state.adminMode ? "1":"0"); }catch(err){}
    applyAdminMode();
  });

  document.getElementById("gbSaveBtn").addEventListener("click", function(){ saveGlobalBanner(true); });
  document.getElementById("gbClearBtn").addEventListener("click", function(){ saveGlobalBanner(false); });
  document.getElementById("gbDismissBtn").addEventListener("click", function(){ saveGlobalBanner(false); });
  document.getElementById("announcePostBtn").addEventListener("click", postAnnouncement);
  document.getElementById("notebookSaveBtn").addEventListener("click", saveNotebookIntro);

  /* --- notebook --- */
  document.getElementById("noteNewBtn").addEventListener("click", function(){ openNoteEditor(null); });
  document.getElementById("noteOpenLinkBtn").addEventListener("click", openByLinkSheet);
  var searchEl = document.getElementById("noteSearch");
  var searchTimer = null;
  searchEl.addEventListener("input", function(){
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function(){
      state.nbQuery = searchEl.value;
      renderNotebook();
    }, 140);
  });

  /* --- help board --- */
  document.getElementById("postBtn").addEventListener("click", postHelp);
  document.getElementById("postAsBtn").addEventListener("click", function(){
    if (usingFirebase()){
      if (!BE.user){ openAuthSheet(); return; }
      toast("Your name comes from the account you signed in with.");
      return;
    }
    openNameSheet(null);
  });
  var postInput = document.getElementById("postInput");
  try{
    var draft = localStorage.getItem("3cs_draft_help");
    if (draft) postInput.value = draft;
  }catch(e){}
  postInput.addEventListener("input", function(){
    try{ localStorage.setItem("3cs_draft_help", postInput.value); }catch(e){}
  });
  document.getElementById("legendEditBtn").addEventListener("click", function(){
    state._legendEditing = true;
    renderLegend();
    var grid = document.getElementById("legendGrid");
    var saveBtn = document.createElement("button");
    saveBtn.className = "btn"; saveBtn.textContent = "Save legend"; saveBtn.style.marginTop="10px";
    saveBtn.addEventListener("click", saveLegend);
    grid.parentNode.insertBefore(saveBtn, grid.nextSibling);
    document.getElementById("legendEditBtn").hidden = true;
  });

  document.getElementById("calPrev").addEventListener("click", function(){ if (calCursor>0){ setCalCursor(calCursor-1); renderCalendar(); } });
  document.getElementById("calNext").addEventListener("click", function(){ if (calCursor<MONTHS.length-1){ setCalCursor(calCursor+1); renderCalendar(); } });
  document.getElementById("calToday").addEventListener("click", function(){
    var t = new Date();
    var idx = MONTHS.findIndex(function(m){ return m[0]===t.getFullYear() && m[1]===t.getMonth(); });
    setCalCursor(idx>=0 ? idx : 0);
    renderCalendar();
  });
}


export { applyAdminMode, checkNoteHash, paintTrustNotes, setTab, wire };
