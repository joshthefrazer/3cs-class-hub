import { applyAdminMode, paintTrustNotes } from "./admin.js";
import { renderAnnouncements, renderGlobalBanner } from "./ann.js";
import { renderHelp } from "./help.js";
import { renderNotebook, renderNotebookIntro } from "./notebook.js";
import { renderLegend, renderSubjectSelectors } from "./sched.js";
import { renderWork, renderWorkFilters, paintWorkChip, loadLocalDone, renderDueSoon } from "./work.js";
import { state } from "./state.js";
import { bumpLive } from "./live.js";
import { renderLiveConfig } from "./orbit.js";
import { openAuthSheet } from "./auth.js";
import { paintMe, setProfiles } from "./profile.js";
import { setChat } from "./chat.js";

/* =========================================================
   BACKEND. One data layer, two drivers.

     hosted normally (GitHub Pages, Netlify, a local file)
       -> Firebase: Firestore + Google sign-in. Real identity, real
          privacy, permissions enforced on the server.

     inside the Claude Hub
       -> Claude's artifact db. The artifact sandbox blocks outbound
          connections to non-allowlisted hosts, so Firestore cannot talk
          to its servers there; the built-in db is used instead, with the
          soft device identity it has always had.

   Both drivers expose the same doc()/collection() surface, so everything
   below this block is written once and runs on either.
   ========================================================= */
var BE = {
  kind: null,      // "firebase" | "artifact" | null
  db: null,
  auth: null,
  user: null,      // { id, name, email, photo } once signed in
  isAdmin: false
};
function usingFirebase(){ return BE.kind === "firebase"; }
function signedIn(){ return !usingFirebase() || !!BE.user; }

/* Soft identity: only used by the artifact driver, which cannot verify
   anyone. On Firebase this is replaced by the real signed-in account. */
var ME = (function(){
  var token = null, name = null;
  try{
    token = localStorage.getItem("3cs_token");
    name  = localStorage.getItem("3cs_name");
  }catch(e){}
  if (!token){
    token = "u" + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
    try{ localStorage.setItem("3cs_token", token); }catch(e){}
  }
  return { token: token, name: name };
})();

function meId(){ return BE.user ? BE.user.id : ME.token; }
function myName(){ return BE.user ? BE.user.name : (ME.name || "Anonymous"); }
function setMyName(n){
  ME.name = n;
  try{ localStorage.setItem("3cs_name", n); }catch(e){}
  var b = document.getElementById("postAsBtn");
  if (b) b.textContent = myName();
}
/* Authorship: a verified uid on Firebase, a device token on the artifact. */
function mine(row){
  if (!row) return false;
  var id = meId();
  return row.authorUid === id || (!row.authorUid && row.authorToken === id);
}
function authorFields(){
  return BE.user
    ? { authorUid: BE.user.id, authorName: BE.user.name, authorEmail: BE.user.email }
    : { authorToken: ME.token, authorName: myName() };
}
function canAdmin(){ return usingFirebase() ? BE.isAdmin : state.adminMode; }

function fmtWhen(iso){
  try{
    var d = new Date(iso);
    return d.toLocaleDateString(undefined,{month:"short",day:"numeric"}) + " · " +
           d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
  }catch(e){ return ""; }
}
function fmtAgo(iso){
  if (!iso) return "";
  var t = Date.parse(iso); if (isNaN(t)) return "";
  var s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s/60) + "m ago";
  if (s < 86400) return Math.floor(s/3600) + "h ago";
  if (s < 604800) return Math.floor(s/86400) + "d ago";
  return new Date(t).toLocaleDateString(undefined,{month:"short",day:"numeric"});
}

/* --- toast --- */
var toastTimer = null;
function toast(msg, isErr){
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "show" + (isErr ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.className = ""; }, isErr ? 5200 : 2600);
}
function dbErrMsg(err){
  var c = err && err.code;
  if (c === "permission-denied")
    return "The server refused that change. You don't have permission for it.";
  if (c === "unauthenticated") return "Sign in first.";
  if (c === "unavailable")     return "Can't reach the server right now. Check your connection.";
  if (c === "not-found")       return "That item no longer exists.";
  if (c === "resource-exhausted")
    return "The Hub has hit today's free usage limit. It resets after midnight.";
  if (c === "failed-precondition")
    return "The database needs an index for that query. An admin has to create it once.";
  if (c === "invalid_argument")
    return "That save was rejected. You may not have permission for it on this account.";
  if (c === "resource_exhausted") return "Too many updates at once. Wait a second and try again.";
  if (c === "quota_exceeded")     return "The Hub's storage is full. An admin needs to clear out old items.";
  if (c === "not_granted" || c === "capability_disabled" || c === "revoked")
    return "Live saving isn't available in this view.";
  return "Couldn't save. Try again in a moment.";
}
function requireDb(){
  if (!state.db){ toast("Live saving isn't available in this view.", true); return null; }
  return state.db;
}

/* --- site/config writes: always merge onto the last full snapshot --- */
function saveConfig(patch, okMsg){
  var db = requireDb(); if (!db) return;
  var next = Object.assign({}, state.config || {}, patch);
  BE.db.doc("config/site").set(next)
    .then(function(){ toast(okMsg || "Saved for everyone."); })
    .catch(function(err){ toast(dbErrMsg(err), true); });
}

/* Nested-map writes differ between the drivers: the artifact db merges a
   nested object into what's there, Firestore REPLACES the whole map unless
   you address the field by path. Writing reactions the naive way would wipe
   everyone else's. This picks the right form for the active driver. */
function mergeField(ref, mapName, key, value){
  if (usingFirebase()){
    var patch = {};
    patch[mapName + "." + key] = value;
    return ref.update(patch);
  }
  var nested = {}, inner = {};
  inner[key] = value;
  nested[mapName] = inner;
  return ref.update(nested);
}

/* Feature modules (messages, people, settings) register their own live
   listeners here instead of this file importing all of them. Each hook
   gets the db and returns unsubscribe functions. */
/* Modules can register before this file has finished evaluating (import
   cycles), so the list survives its own declaration. */
var streamHooks = streamHooks || [];
function registerStream(on, off){
  if (!streamHooks) streamHooks = [];
  streamHooks.push({ on: on, off: off });
}

var streams = [];
function stopStreams(){
  streams.forEach(function(u){ try{ u(); }catch(e){} });
  streams = [];
}

function initDb(){
  /* Inside the Hub the artifact db is the only backend that can reach a
     server, so it wins when present. Anywhere else, Firebase. */
  if (window.claude && window.claude.use){
    window.claude.use("db").then(function(db){
      if (db){
        BE.kind = "artifact";
        BE.db = db;
        state.db = db;
        state.dbReady = true;
        state.dbSettled = true;
        startStreams();
        paintAuth();
        return;
      }
      initFirebase();
    }).catch(initFirebase);
    return;
  }
  initFirebase();
}

/* The SDK is fetched only when Firebase is the driver we're going to use,
   so the Hub copy never downloads it. jsdelivr is on the artifact CSP
   allowlist; gstatic (Firebase's usual host) is not. */
var FB_VERSION = "12.19.0";
function loadFirebaseSdk(){
  if (window.firebase && window.firebase.firestore) return Promise.resolve();
  var base = "https://cdn.jsdelivr.net/npm/firebase@" + FB_VERSION + "/";
  function load(f){
    return new Promise(function(resolve, reject){
      var s = document.createElement("script");
      s.src = base + f;
      s.onload = resolve;
      s.onerror = function(){ reject(new Error("Firebase SDK failed to load")); };
      document.head.appendChild(s);
    });
  }
  /* The app script has to be in place first; auth and firestore can then
     download side by side. */
  return load("firebase-app-compat.js").then(function(){
    return Promise.all([load("firebase-auth-compat.js"), load("firebase-firestore-compat.js")]);
  });
}

function initFirebase(){
  var cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.projectId){
    showUnconfigured();
    return;
  }
  loadFirebaseSdk().then(startFirebase).catch(function(){
    toast("Couldn't load the database library. Check your connection.", true);
    showUnconfigured();
  });
}

function showUnconfigured(){
  state.standalone = true;
  state.dbSettled = true;
  var bar = document.getElementById("staticBar");
  if (bar) bar.hidden = false;
  renderAllFallback();
  paintAuth();
}

function startFirebase(){
  var cfg = window.FIREBASE_CONFIG;
  if (!window.firebase){
    showUnconfigured();
    return;
  }
  try{
    /* Test harness only: point at the local emulators instead of the real
       project. Never set on the live site. */
    var emu = window.__FIREBASE_EMULATOR;
    if (emu && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) emu = null;
    if (emu && emu.projectId) cfg = Object.assign({}, cfg, { projectId: emu.projectId });
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    BE.kind = "firebase";
    BE.db   = firebase.firestore();
    if (emu){
      BE.db.useEmulator(emu.host || "127.0.0.1", emu.firestorePort || 8080);
    }
    /* Keep a local copy between visits: the Hub opens instantly on a slow
       connection, and a listener that resumes from the cache only pays for
       what changed. Private windows and old browsers just skip it. */
    try{ BE.db.enablePersistence({ synchronizeTabs: true }).catch(function(){}); }catch(e){}
    BE.auth = firebase.auth();
    if (emu){
      BE.auth.useEmulator("http://" + (emu.host || "127.0.0.1") + ":" + (emu.authPort || 9099), { disableWarnings: true });
    }
    state.db = BE.db;
    BE.auth.onAuthStateChanged(function(u){
      stopStreams();
      if (u){
        BE.user = {
          id: u.uid,
          name: u.displayName || u.email || "Someone",
          email: (u.email || "").toLowerCase(),
          photo: u.photoURL || ""
        };
        checkAdmin().then(function(){
          state.dbReady = true;
          state.dbSettled = true;
          startStreams();
          paintAuth();
          applyAdminMode();
        });
      } else {
        BE.user = null;
        BE.isAdmin = false;
        state.dbReady = false;
        state.dbSettled = true;
        state.notes = []; state.posts = []; state.announcements = [];
        state.notesLoaded = false; state.postsLoaded = false;
        setChat([]); setProfiles({});
        streamHooks.forEach(function(h){ try{ if (h.off) h.off(); }catch(e){} });
        paintAuth();
        applyAdminMode();
        renderNotebook(); renderHelp(); renderAnnouncements();
        renderWork(); renderDueSoon();
      }
    });
  }catch(e){
    state.dbSettled = true;
    renderAllFallback();
    paintAuth();
  }
}

/* Admin is a real permission on Firebase: the owner email baked into the
   rules, plus anyone listed in config/admins. The rules enforce the same
   list server-side, so this only decides what the UI offers. */
function isOwnerEmail(email){
  var owners = (window.HUB_OWNERS || [window.HUB_OWNER]).map(function(e){ return String(e || "").toLowerCase(); });
  return !!email && owners.indexOf(String(email).toLowerCase()) > -1;
}
function checkAdmin(){
  BE.isAdmin = false;
  BE.isOwner = false;
  if (!BE.user) return Promise.resolve();
  if (isOwnerEmail(BE.user.email)){ BE.isAdmin = true; BE.isOwner = true; }
  return BE.db.doc("config/admins").get().then(function(s){
    var list = (s.exists && s.data() && s.data().emails) || [];
    for (var i = 0; i < list.length; i++){
      if (String(list[i]).toLowerCase() === BE.user.email){ BE.isAdmin = true; break; }
    }
  }).catch(function(){ /* unreadable is not fatal. Stay non-admin */ });
}

function signIn(){
  if (!BE.auth) return;
  var p = new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  BE.auth.signInWithPopup(p).catch(function(err){
    var c = err && err.code;
    if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return;
    if (c === "auth/unauthorized-domain"){
      toast("This web address isn't authorised in the Firebase project yet.", true);
      return;
    }
    toast("Couldn't sign in: " + (err && err.message ? err.message : "unknown error"), true);
  });
}
function signOutNow(){
  if (BE.auth) BE.auth.signOut().then(function(){ toast("Signed out."); });
}

function paintAuth(){
  var btn = document.getElementById("authBtn");
  var who = document.getElementById("authWho");
  var adminBtn = document.getElementById("adminToggleBtn");
  if (!btn || !who || !adminBtn) return;

  var pab = document.getElementById("postAsBtn");
  if (pab) pab.textContent = usingFirebase() && !BE.user ? "someone (sign in)" : myName();
  paintTrustNotes();

  if (usingFirebase()){
    /* Real permissions replace the passcode entirely. */
    adminBtn.hidden = true;
    btn.hidden = false;
    if (BE.user){
      /* Signed in: your avatar stands in for the button, and sign-out
         lives in the profile sheet. */
      who.hidden = true;
      who.textContent = BE.user.name + (BE.isAdmin ? " · admin" : "");
      btn.hidden = true;
      btn.onclick = null;
    } else {
      who.hidden = true;
      btn.textContent = "Sign in";
      btn.className = "btn sm auth-btn";
      btn.onclick = openAuthSheet;
    }
  } else {
    btn.hidden = true;
    who.hidden = true;
    adminBtn.hidden = false;
  }
  paintMe();
}

function startStreams(){
  var db = BE.db;
  if (!db) return;
  stopStreams();

  streams.push(db.doc("config/site").onSnapshot(function(snap){
      var data = snap.exists ? snap.data() : {};
      state.config = data;
      state.globalBanner = data.globalBanner || null;
      state.notebookNote = typeof data.notebookNote === "string" ? data.notebookNote : null;
      state.legend = data.legend || null;
      // Invalidate the live overlay only once every field it reads is in place.
      bumpLive();
      renderGlobalBanner();
      renderNotebookIntro();
      renderLegend();
      renderSubjectSelectors();
      // An admin may have just rewritten the timetable, the calendar or the
      // bell times, so everything derived from them is repainted too.
      renderLiveConfig();
    }, function(){ /* terminal: keep last-known content on screen */ }));

  /* The class's work. Small collection, always worth having in full. */
  streams.push(db.collection("assignments").orderBy("due","asc").limit(200).onSnapshot(function(qs){
      var items = [];
      qs.docs.forEach(function(d){ items.push(Object.assign({id:d.id}, d.data())); });
      state.assignments = items;
      state.workLoaded = true;
      renderWorkFilters();
      renderWork();
      paintWorkChip();
    }, function(){
      /* An ordered query needs an index the first time. Fall back to an
         unordered read so the list still appears while that is created. */
      streams.push(db.collection("assignments").limit(200).onSnapshot(function(qs){
        var items = [];
        qs.docs.forEach(function(d){ items.push(Object.assign({id:d.id}, d.data())); });
        state.assignments = items;
        state.workLoaded = true;
        renderWorkFilters();
        renderWork();
        paintWorkChip();
      }, function(){
        state.workLoaded = true;
        renderWork();
      }));
    }));

  streams.push(db.collection("announcements").orderBy("createdAt","desc").limit(50).onSnapshot(function(qs){
      var items = [];
      qs.docs.forEach(function(d){ items.push(Object.assign({id:d.id}, d.data())); });
      items.sort(function(a,b){
        var ap = a.pinned?1:0, bp=b.pinned?1:0;
        if (ap!==bp) return bp-ap;
        return (b.createdAt||"").localeCompare(a.createdAt||"");
      });
      state.announcements = items;
      renderAnnouncements();
    }, function(){
      document.getElementById("feedStatus").textContent = "Live feed unavailable in this view.";
    }));

  /* Link-only notes are excluded server-side by the rules, so the browse
     query asks only for public ones. Your own link-only notes come back
     through the private/authored stream below. */
  var nbQuery = usingFirebase()
    ? db.collection("notebook").where("visibility","==","public").orderBy("updatedAt","desc").limit(200)
    : db.collection("notebook").orderBy("updatedAt","desc").limit(200);
  streams.push(nbQuery.onSnapshot(function(qs){
      var items = [];
      qs.docs.forEach(function(d){
        items.push(Object.assign({id:d.id}, d.data()));
        delete state.pending["nb:"+d.id];
      });
      state.notes = items;
      state.notesLoaded = true;
      renderNotebook();
    }, function(){ state.notesLoaded = true; renderNotebook(); }));

  /* Notes you wrote, whatever their visibility — so link-only ones you
     created stay findable from the device that made them. */
  if (usingFirebase() && BE.user){
    streams.push(db.collection("notebook").where("authorUid","==",BE.user.id).limit(200)
      .onSnapshot(function(qs){
        var items = [];
        qs.docs.forEach(function(d){
          items.push(Object.assign({id:d.id}, d.data()));
          delete state.pending["nb:"+d.id];
        });
        state.myNotes = items;
        renderNotebook();
      }, function(){}));

    /* Private notes now live server-side under your own uid, so they
       follow you between devices and nobody else can read them. */
    streams.push(db.collection("users").doc(BE.user.id).collection("private")
      .orderBy("updatedAt","desc").limit(200)
      .onSnapshot(function(qs){
        var items = [];
        qs.docs.forEach(function(d){ items.push(Object.assign({id:d.id, _priv:true}, d.data())); });
        state.privNotes = items;
        renderNotebook();
      }, function(){}));

    /* Which assignments YOU have finished. Under your own uid, so the rules
       make it unreadable to everyone else - the class sees the work, never
       who is behind on it. */
    streams.push(db.collection("users").doc(BE.user.id).collection("done")
      .limit(500)
      .onSnapshot(function(qs){
        var map = {};
        qs.docs.forEach(function(d){ map[d.id] = true; });
        state.workDone = map;
        renderWork();
        paintWorkChip();
      }, function(){}));
  } else {
    loadLocalDone();
  }

  /* Names and photos for everyone — a class-sized collection. */
  if (!usingFirebase() || BE.user){
    streams.push(db.collection("profiles").limit(100).onSnapshot(function(qs){
      var map = {};
      qs.docs.forEach(function(d){ map[d.id] = d.data(); });
      setProfiles(map);
    }, function(){}));

    /* The class chat: newest page only. Pending server timestamps are
       estimated so a message you just sent sorts where it belongs. */
    var chatQ = db.collection("chat").orderBy("createdAt","desc").limit(50);
    streams.push(chatQ.onSnapshot(function(qs){
      var rows = [];
      qs.docs.forEach(function(d){
        var data = usingFirebase() ? d.data({ serverTimestamps: "estimate" }) : d.data();
        var row = Object.assign({ id: d.id }, data);
        if (d.metadata && d.metadata.hasPendingWrites) row._pending = true;
        rows.push(row);
      });
      setChat(rows);
    }, function(){ setChat([]); }));
  }

  streamHooks.forEach(function(h){
    try{
      var u = h.on(db);
      (Array.isArray(u) ? u : [u]).forEach(function(f){ if (typeof f === "function") streams.push(f); });
    }catch(e){}
  });

  streams.push(db.collection("help").orderBy("createdAt","desc").limit(200).onSnapshot(function(qs){
      var items = [];
      qs.docs.forEach(function(d){
        items.push(Object.assign({id:d.id}, d.data()));
        delete state.pending["hb:"+d.id];
      });
      state.posts = items;
      state.postsLoaded = true;
      renderHelp();
    }, function(){ state.postsLoaded = true; renderHelp(); }));
}

function renderAllFallback(){
  renderGlobalBanner();
  renderNotebookIntro();
  renderLegend();
  renderNotebook();
  renderHelp();
  document.getElementById("feedStatus").textContent = state.standalone
    ? "The shared features aren't connected on this copy. The schedule and calendar still work."
    : "Live announcements aren't available in this view.";
}


export { isOwnerEmail, registerStream, BE, FB_VERSION, ME, authorFields, canAdmin, checkAdmin, dbErrMsg, fmtAgo, fmtWhen, initDb, initFirebase, loadFirebaseSdk, meId, mergeField, mine, myName, paintAuth, renderAllFallback, requireDb, saveConfig, setMyName, showUnconfigured, signIn, signOutNow, signedIn, startFirebase, startStreams, stopStreams, streams, toast, toastTimer, usingFirebase };
