import { BE, toast, noteErr, usingFirebase } from "./backend.js";
import { state } from "./state.js";
import { esc, svgIcon, openSheet, closeSheet } from "./text.js";
import { whereNow } from "./orbit.js";
import { assignments, isDone, dueDate } from "./work.js";
import { subjectName } from "./sched.js";
import { registerCommands } from "./palette.js";

/* =========================================================
   THE APP LAYER - what makes the Hub behave like an installed app.

     installing     the browser's install prompt (Chromebooks, Android,
                    Windows), and plain instructions on iPhone
     offline        sw.js keeps a copy of the Hub itself on the device
     alerts         system notifications for messages while you're elsewhere,
                    a reminder before each class, and one for homework
     badge          the unread count on the app icon / taskbar
     launching      shortcuts (Add assignment, Chat) and the Share menu

   In the desktop app (Electron) window.hubDesktop is provided by its
   preload script, and the same code drives the tray, the taskbar badge and
   native toasts. Nothing here is required: every piece checks for support
   and quietly does nothing without it.
   ========================================================= */

var D = window.hubDesktop || null;
var installEvt = null;
var swReg = null;

function pref(k, d){ try{ var v = localStorage.getItem(k); return v == null ? d : v; }catch(e){ return d; } }
function setPref(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }

function isStandalone(){
  return !!D || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}
function isIOS(){ return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }

/* ---------------------------------------------------- service worker -- */
/* sw.js loads the Hub fresh whenever there's a connection and keeps a copy
   for when there isn't, so there's no "new version" step to manage. */
function registerSW(){
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  if (window.__FIREBASE_EMULATOR) return;               // test runs stay uncached
  navigator.serviceWorker.register("sw.js").then(function(reg){ swReg = reg; })
    .catch(function(e){ noteErr("offline copy", e); });
  // a notification clicked while the Hub was open elsewhere
  navigator.serviceWorker.addEventListener("message", function(e){
    if (e.data && e.data.type === "route") route(e.data.route);
  });
}

/* ---------------------------------------------------------- install -- */
function initInstall(){
  window.addEventListener("beforeinstallprompt", function(e){
    e.preventDefault();
    installEvt = e;
    paintInstall();
  });
  window.addEventListener("appinstalled", function(){
    installEvt = null;
    paintInstall();
    toast("Installed. The Hub now opens like an app.");
  });
  paintInstall();
}
function canInstall(){ return !!installEvt || (isIOS() && !isStandalone()); }
function install(){
  if (installEvt){
    var e = installEvt;
    installEvt = null;
    e.prompt();
    (e.userChoice || Promise.resolve()).then(function(){ paintInstall(); });
    return;
  }
  if (isIOS()) return iosHowTo();
  toast(isStandalone() ? "You're already using the app." : "Your browser can install the Hub from its menu: look for Install or Add to Home screen.");
}
function iosHowTo(){
  openSheet('<div class="sheet-head"><div><h2>Add the Hub to your iPhone</h2><p class="hint">Two taps in Safari.</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + "</button></div>" +
    '<ol class="howto"><li>Tap the <b>Share</b> button at the bottom of Safari (the square with the arrow).</li>' +
    '<li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>' +
    '<li>Open 3CS Hub from your home screen. Notifications and the badge work from there.</li></ol>');
}
function paintInstall(){
  document.querySelectorAll(".js-install").forEach(function(b){ b.hidden = !canInstall(); });
  document.documentElement.classList.toggle("is-app", isStandalone());
}

/* ------------------------------------------------------------ alerts -- */
function canNotify(){ return !!D || ("Notification" in window && Notification.permission === "granted"); }
function askNotify(){
  if (D) return Promise.resolve("granted");
  if (!("Notification" in window)) return Promise.resolve("unsupported");
  if (Notification.permission !== "default") return Promise.resolve(Notification.permission);
  return Notification.requestPermission();
}
/* A system notification. Clicking it brings the Hub forward and runs go(). */
function systemNotify(title, body, opts){
  opts = opts || {};
  if (!canNotify()) return;
  try{
    if (D && D.notify){ D.notify({ title: title, body: body, tag: opts.tag || "", route: opts.route || "" }); return; }
    var n = new Notification(title, { body: body, tag: opts.tag || undefined, icon: "assets/app/icon-192.png", badge: "assets/app/icon-192.png", silent: !!opts.silent });
    n.onclick = function(){ try{ window.focus(); }catch(e){} n.close(); route(opts.route); };
  }catch(e){
    // some browsers only allow notifications through the service worker
    if (swReg && swReg.showNotification) swReg.showNotification(title, { body: body, tag: opts.tag || undefined, icon: "assets/app/icon-192.png", data: { route: opts.route || "" } }).catch(function(){});
  }
}
/* Messages: the side cards only help if you're looking. When the Hub is in
   the background, the same message also goes to the system. */
function messageAlert(n){
  if (pref("3cs_sys_ntf", "on") !== "on") return;
  if (!document.hidden && document.hasFocus()) return;
  systemNotify((n.name || "Someone") + (n.where ? " · " + n.where : ""), n.text || "", { tag: "msg-" + (n.key || ""), route: "chat" });
}

/* Where a notification, shortcut or tray item takes you. */
function route(r){
  if (!r) return;
  var go = function(tab){ var b = document.querySelector('nav.tabs button[data-tab="' + tab + '"], #bottomNav button[data-tab="' + tab + '"]'); if (b) b.click(); };
  if (r === "chat") return import("./chat.js").then(function(m){ m.openChat(); });
  if (r === "add-work") return whenSignedIn(function(){ go("work"); import("./work.js").then(function(m){ m.openWorkSheet(null); }); });
  if (r === "search") return import("./palette.js").then(function(m){ m.showPalette(); });
  if (r === "today") return go("schedule");
  go(r);
}
function whenSignedIn(fn){
  if (!usingFirebase() || BE.user){ fn(); return; }
  var tries = 0;
  var t = setInterval(function(){
    if (BE.user || ++tries > 40){ clearInterval(t); if (BE.user) fn(); else import("./auth.js").then(function(m){ m.openAuthSheet(); }); }
  }, 250);
}

/* ---------------------------------------------------------- reminders -- */
/* A heads-up before each class, and one about homework in the evening.
   They run while the Hub is open; the desktop app keeps it open in the tray,
   which is what makes them dependable there. */
var fired = {};
function firedKey(k){ if (fired[k]) return true; fired[k] = 1; return false; }
function checkReminders(){
  if (!canNotify()) return;
  var lead = parseInt(pref("3cs_remind_class", D ? "5" : "off"), 10);
  if (lead > 0){
    try{
      var w = whereNow();
      if (w && w.ranges && w.next != null && w.next >= 0){
        var r = w.ranges[w.next], c = (w.row && w.row[w.next]) || {};
        var until = r.start - w.cur;
        if (c.c && until > 0 && until <= lead && !firedKey(w.ti.iso + ":s" + r.n)){
          var name = subjectName(c.c) || c.c;
          var room = [c.r && c.r !== "-" ? "Room " + c.r : "", c.t].filter(Boolean).join(" · ");
          systemNotify(c.c + " in " + Math.max(1, Math.round(until)) + " min", (name !== c.c ? name + ". " : "") + "Session " + r.n + " at " + r.from + (room ? " · " + room : ""), { tag: "class", route: "today" });
        }
      }
    }catch(e){}
  }
  var at = pref("3cs_remind_work", D ? "18:00" : "off");
  if (at !== "off" && BE.user !== null){
    var now = new Date(), hm = at.split(":");
    var due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +hm[0], +hm[1]);
    var key = "w:" + now.toDateString();
    if (now >= due && now - due < 30 * 60000 && !fired[key]){
      var tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString();
      var list = assignments().filter(function(a){ var d = dueDate(a); return d && d.toDateString() === tmr && !isDone(a); });
      var late = assignments().filter(function(a){ var d = dueDate(a); return d && d < now && !isDone(a); });
      fired[key] = 1;
      if (list.length || late.length){
        var bits = [];
        if (list.length) bits.push(list.length + " due tomorrow: " + list.slice(0, 3).map(function(a){ return a.title; }).join(", ") + (list.length > 3 ? "…" : ""));
        if (late.length) bits.push(late.length + " overdue");
        systemNotify("Homework check", bits.join(". "), { tag: "work", route: "work" });
      }
    }
  }
}

/* ------------------------------------------------------------- badge -- */
function setBadge(n){
  n = n || 0;
  try{ if (D && D.setBadge) D.setBadge(n); }catch(e){}
  try{
    if (!("setAppBadge" in navigator) || !isStandalone()) return;
    if (n) navigator.setAppBadge(n).catch(function(){}); else navigator.clearAppBadge().catch(function(){});
  }catch(e){}
}

/* --------------------------------------------------------- launching -- */
/* Shortcuts on the app icon open ./?do=add-work and friends; the Share
   menu opens ./?share_text=... Both are read once and then tidied out of
   the address bar. */
function handleLaunch(){
  var q;
  try{ q = new URLSearchParams(location.search); }catch(e){ return; }
  var da = q.get("desktop_auth");
  if (da && /^\d{2,5}\.[a-f0-9]{16,64}$/.test(da)){
    try{ history.replaceState(history.state, "", location.pathname); }catch(e){}
    setTimeout(function(){ desktopAuth(da); }, 600);
    return;
  }
  var todo = q.get("do");
  var shared = [q.get("share_title"), q.get("share_text"), q.get("share_url")].filter(function(x){ return x && x.trim(); });
  if (!todo && !shared.length) return;
  try{ history.replaceState(history.state, "", location.pathname + location.hash); }catch(e){}
  setTimeout(function(){
    if (todo) route(todo);
    if (shared.length) openShare(q.get("share_title") || "", q.get("share_text") || "", q.get("share_url") || "");
  }, 900);
}
function openShare(title, text, url){
  // Android often puts the link inside the text; don't show it twice
  if (url && text.indexOf(url) > -1) url = "";
  var body = [text, url].filter(Boolean).join("\n").trim();
  var box = openSheet('<div class="sheet-head"><div><h2>Share to 3CS</h2><p class="hint">Where should it go?</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + "</button></div>" +
    '<div class="share-preview">' + (title ? "<b>" + esc(title) + "</b>" : "") + "<p>" + esc(body) + "</p></div>" +
    '<div class="share-go"><button class="staff-card" type="button" data-to="chat">' + svgIcon("i-msg") + "<b>Class chat</b><small>Post it for everyone in 3CS</small></button>" +
    '<button class="staff-card" type="button" data-to="note">' + svgIcon("i-notebook") + "<b>New note</b><small>Keep it in the class notebook</small></button>" +
    '<button class="staff-card" type="button" data-to="work">' + svgIcon("i-clipboard") + "<b>Assignment</b><small>Add it to Work with this link</small></button></div>");
  box.querySelectorAll("[data-to]").forEach(function(b){
    b.addEventListener("click", function(){
      var to = b.dataset.to;
      closeSheet();
      whenSignedIn(function(){
        if (to === "chat") import("./chat.js").then(function(m){
          m.openChat("main");
          setTimeout(function(){ var i = document.getElementById("chatInput"); if (i){ i.value = [title, body].filter(Boolean).join("\n"); i.dispatchEvent(new Event("input", { bubbles: true })); i.focus(); } }, 300);
        });
        if (to === "note") import("./notebook.js").then(function(m){ m.openNoteEditor(null); setTimeout(function(){
          var t = document.querySelector(".sheet:not([hidden]) input[type=text], .sheet:not([hidden]) #noteTitle");
          var ta = document.querySelector(".sheet:not([hidden]) textarea");
          if (t && title) t.value = title.slice(0, 200);
          if (ta){ ta.value = body; ta.dispatchEvent(new Event("input", { bubbles: true })); }
        }, 250); });
        if (to === "work") import("./work.js").then(function(m){
          var tb = document.querySelector('nav.tabs button[data-tab="work"]'); if (tb) tb.click();
          m.openWorkSheet(null);
          setTimeout(function(){
            var link = (url || (body.match(/https?:\/\/\S+/) || [""])[0]);
            var tt = document.getElementById("workTitle"); if (tt) tt.value = (title || body.replace(link, "").trim()).slice(0, 300);
            var wl = document.getElementById("workLink"); if (wl) wl.value = link;
          }, 150);
        });
      });
    });
  });
}

/* The browser half of signing in to the desktop app with Google. The app
   opened this page with ?desktop_auth=<port>.<nonce>; after Google says yes,
   the result goes straight back to the app, which is listening on this
   computer only (127.0.0.1), and nowhere else. */
function desktopAuth(da){
  var port = da.split(".")[0], nonce = da.split(".")[1];
  var box = openSheet('<div class="sheet-head"><div><h2>Sign in to the desktop app</h2><p class="hint">Only continue if you just pressed Sign in on the 3CS desktop app.</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + "</button></div>" +
    '<div class="btn-row" style="margin-top:14px"><button class="btn" id="daGo" type="button">Continue with Google</button></div>' +
    '<p class="hint" id="daMsg" style="margin-top:12px"></p>');
  box.querySelector("#daGo").addEventListener("click", function(){
    var msg = box.querySelector("#daMsg");
    if (!window.firebase || !firebase.auth){ msg.textContent = "Still loading. Try again in a second."; return; }
    var p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    firebase.auth().signInWithPopup(p).then(function(r){
      var c = firebase.auth.GoogleAuthProvider.credentialFromResult ? firebase.auth.GoogleAuthProvider.credentialFromResult(r) : r.credential;
      if (!c || !c.idToken) throw new Error("Google didn't send a sign-in back.");
      msg.textContent = "Done. Handing you back to the app…";
      location.href = "http://127.0.0.1:" + port + "/done?state=" + nonce +
        "&id_token=" + encodeURIComponent(c.idToken) + "&access_token=" + encodeURIComponent(c.accessToken || "");
    }).catch(function(err){ msg.textContent = "That didn't work: " + (err && err.message ? err.message : "try again") + "."; });
  });
}

/* ------------------------------------------------- desktop app bridge -- */
function initDesktop(){
  document.documentElement.classList.toggle("is-desktop", !!D);
  if (!D) return;
  try{ if (D.onRoute) D.onRoute(route); }catch(e){}
  var push = function(){ try{ D.setStatus && D.setStatus((window.__hubTitle || "").replace(/\s*\|\s*3CS$/, "")); }catch(e){} };
  window.addEventListener("3cs:title", push);
  push();
}

/* --------------------------------------------------- settings section -- */
function alertsHtml(row, seg){
  var perm = D ? "granted" : ("Notification" in window ? Notification.permission : "unsupported");
  return '<section class="set-sec"><h3>Reminders</h3>' +
      (perm === "default" ? '<div class="verify-note"><b>Allow notifications first</b><small>Reminders and message alerts show up as system notifications.</small><div class="btn-row"><button class="btn sm" id="setAllowNtf" type="button">Allow notifications</button></div></div>' :
       perm === "denied" ? '<p class="hint">Notifications are blocked for this site. Allow them in your browser\'s site settings to get reminders.</p>' :
       perm === "unsupported" ? '<p class="hint">This browser can\'t show notifications' + (isIOS() ? " until the Hub is added to your home screen." : ".") + "</p>" : "") +
      row("Before each class", "A heads-up with the subject and room.", seg("setRemindClass", pref("3cs_remind_class", D ? "5" : "off"), [["off", "Off"], ["2", "2 min"], ["5", "5 min"]])) +
      row("Homework check", "What's due tomorrow and anything overdue, once a day.", '<select id="setRemindWork" aria-label="Homework check time">' +
        [["off", "Off"], ["15:30", "3:30 PM"], ["18:00", "6:00 PM"], ["20:00", "8:00 PM"]].map(function(o){ return '<option value="' + o[0] + '"' + (pref("3cs_remind_work", D ? "18:00" : "off") === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>") +
      row("Messages while you're away", "A system notification when the Hub isn't the window you're looking at.", '<input type="checkbox" class="switch" id="setSysNtf"' + (pref("3cs_sys_ntf", "on") === "on" ? " checked" : "") + ">") +
      '<p class="hint">' + (D ? "The desktop app keeps these going from the tray, even with the window closed." : "These work while the Hub is open. The desktop app keeps them going from the tray.") + "</p>" +
    "</section>" +
    '<section class="set-sec"><h3>The app</h3>' +
      (D ? row("Desktop app", "Version " + esc(String(D.version || "")) + ". Everything updates on its own.", "") +
           row("Start with my computer", "Opens quietly in the tray when you log in.", '<input type="checkbox" class="switch" id="setLogin"' + (D.getSetting && D.getSetting("openAtLogin") ? " checked" : "") + ">") +
           row("Closing keeps it in the tray", "So reminders and messages still come through.", '<input type="checkbox" class="switch" id="setTray"' + (!D.getSetting || D.getSetting("closeToTray") !== false ? " checked" : "") + ">")
         : (isStandalone() ? row("Installed", "You're using the Hub as an app.", "") :
           row("Install the Hub", isIOS() ? "Add it to your home screen from Safari." : "It opens in its own window, starts faster and works offline for the timetable.", '<button class="btn sm js-install" type="button"' + (canInstall() ? "" : " hidden") + ">Install</button>")) +
           row("Desktop app for Windows", "Tray countdown, reminders with the window closed, and a quick-add shortcut.", '<a class="btn ghost sm" href="https://github.com/joshthefrazer/3cs-class-hub/releases/latest" target="_blank" rel="noopener">Download</a>')) +
    "</section>";
}
function wireAlerts(box){
  function on(id, ev, fn){ var e = box.querySelector("#" + id); if (e) e.addEventListener(ev, fn); }
  on("setAllowNtf", "click", function(){ askNotify().then(function(p){ toast(p === "granted" ? "Notifications on." : "Notifications stay off."); var n = box.querySelector("#setAllowNtf"); if (n && p === "granted") n.closest(".verify-note").remove(); }); });
  box.querySelectorAll('input[name="setRemindClass"]').forEach(function(r){
    r.addEventListener("change", function(){
      if (!r.checked) return;
      setPref("3cs_remind_class", r.value);
      if (r.value !== "off") askNotify();
      toast(r.value === "off" ? "Class reminders off." : "You'll get a heads-up " + r.value + " minutes before each class.");
    });
  });
  on("setRemindWork", "change", function(e){
    setPref("3cs_remind_work", e.target.value);
    if (e.target.value !== "off") askNotify();
    toast(e.target.value === "off" ? "Homework check off." : "Homework check set.");
  });
  on("setSysNtf", "change", function(e){ setPref("3cs_sys_ntf", e.target.checked ? "on" : "off"); if (e.target.checked) askNotify(); });
  on("setLogin", "change", function(e){ try{ D.setSetting("openAtLogin", e.target.checked); }catch(x){} });
  on("setTray", "change", function(e){ try{ D.setSetting("closeToTray", e.target.checked); }catch(x){} });
  box.querySelectorAll(".js-install").forEach(function(b){ b.addEventListener("click", install); });
}

/* --------------------------------------------------------------- boot -- */
function initApp(){
  registerSW();
  initInstall();
  initDesktop();
  handleLaunch();
  document.addEventListener("click", function(e){ var b = e.target.closest && e.target.closest(".js-install"); if (b && !b.closest(".set-pane")) install(); });
  setInterval(checkReminders, 20000);
  setTimeout(checkReminders, 4000);
  registerCommands(function(){
    var out = [];
    if (canInstall()) out.push({ kind: "Do", title: "Install the Hub as an app", hint: "own window, works offline", run: install });
    out.push({ kind: "Do", title: "Reminders and notifications", hint: "before class, homework", run: function(){ import("./settings.js").then(function(m){ m.openSettings("alerts"); }); } });
    return out;
  });
}

export { initApp, systemNotify, messageAlert, setBadge, route, alertsHtml, wireAlerts, install, canInstall, isStandalone };
