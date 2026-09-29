import { BE, signOutNow, toast, usingFirebase, canAdmin, hubErrors } from "./backend.js";
import { closeSheet, esc, openSheet, svgIcon } from "./text.js";
import { setTheme, themeChoice } from "./theme.js";
import { openProfileSheet } from "./profile.js";
import { openAuthSheet } from "./auth.js";
import { registerCommands, showPalette } from "./palette.js";
import { RELEASES } from "./updates.js";
import { myListing, setListed } from "./people.js";
import { openModeration } from "./chat.js";
import { openSiteEditor } from "./adminpanel.js";
import { openLauncher } from "./links.js";
import { setBackgroundMode, bgMode, openGallery, setCustomImage, customImage } from "./campus.js";
import { compressImage, pickFiles } from "./media.js";
import { canModerate, canAnnounce, roleBadgeHtml, openMembers } from "./roles.js";
import { lookHtml, layoutHtml, wireLook, lookHooks } from "./layout.js";
import { alertsHtml, wireAlerts, canInstall, install, offerApk, APK } from "./app.js";

/* =========================================================
   SETTINGS - everything here is a preference for this browser, except
   "show my email", which lives on your directory entry so it follows you.
   ========================================================= */

var DEFAULTS = {
  "3cs_intro_mode": (window.hubDesktop || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)) ? "updates" : "daily",   // daily | updates | off
  "3cs_motion":     "system",  // system | reduce
  "3cs_ntf":        "all",     // all | direct | off
  "3cs_ntf_sound":  "off",     // on | off
  "3cs_enter":      "on",      // on | off  (Enter sends a message)
  "3cs_fx":         "auto"     // auto | full | lite
};
function getPref(k){
  try{ var v = localStorage.getItem(k); return v == null ? DEFAULTS[k] : v; }catch(e){ return DEFAULTS[k]; }
}
function setPref(k, v){
  try{ localStorage.setItem(k, v); }catch(e){}
}

function seg(name, value, options){
  return '<div class="seg" role="radiogroup">' + options.map(function(o){
    return '<label><input type="radio" name="' + name + '" value="' + o[0] + '"' + (o[0] === value ? " checked" : "") +
      '><span>' + o[1] + '</span></label>';
  }).join("") + '</div>';
}
function row(title, sub, control){
  return '<div class="set-row"><div><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + control + '</div>';
}
function toggle(id, on){
  return '<input type="checkbox" class="switch" id="' + id + '"' + (on ? " checked" : "") + '>';
}

/* Settings is a small app of its own: a list of panes down the side (or
   across the top on phones), so nothing is more than one tap away. */
var PANES = [
  ["look", "i-sparkles", "Look"],
  ["layout", "i-grid", "Layout"],
  ["chat", "i-msg", "Chat"],
  ["alerts", "i-bell", "Reminders"],
  ["welcome", "i-play", "Welcome"],
  ["account", "i-user", "Account"],
  ["staff", "i-shield", "Admin"],
  ["keys", "i-hash", "Shortcuts"],
  ["fix", "i-alert", "Troubleshoot"]
];
var lastPane = "look";
function openSettings(pane){
  var signedIn = usingFirebase() && !!BE.user;
  var listing = myListing();
  var staff = canAdmin() || canModerate() || canAnnounce();
  var panes = PANES.filter(function(p){ return p[0] !== "staff" || staff; });
  var html = {};
  html.look = lookHtml({ bgMode: bgMode(), customImage: customImage(), themeChoice: themeChoice(), fx: getPref("3cs_fx"), motion: getPref("3cs_motion") });
  html.layout = layoutHtml();
  html.chat = '<section class="set-sec"><h3>Chat</h3>' +
      row("Pop-up notifications", "Small cards at the side when a message arrives while the chat is closed.",
        '<select id="setNtf" aria-label="Pop-up notifications">' +
          '<option value="all">Everything</option>' +
          '<option value="direct">Only chats and @mentions</option>' +
          '<option value="off">Off</option>' +
        '</select>') +
      row("Sound", "A soft blip with each pop-up.", toggle("setSound", getPref("3cs_ntf_sound") === "on")) +
      row("Enter sends", "Turn off to use Enter for new lines, and Ctrl+Enter to send.", toggle("setEnter", getPref("3cs_enter") === "on")) +
    '</section>';
  html.welcome = '<section class="set-sec"><h3>Welcome animation</h3>' +
      row("Play it", "It's about half a minute, and you can always skip it.",
        '<select id="setIntro" aria-label="When to play the welcome animation">' +
          '<option value="daily">First visit each day</option>' +
          '<option value="updates">Only after updates</option>' +
          '<option value="off">Never</option>' +
        '</select>') +
      '<div class="btn-row" style="margin-top:6px">' +
        '<button class="btn ghost sm" id="setReplay" type="button">' + svgIcon("i-play") + ' Play it now</button>' +
        '<button class="btn ghost sm" id="setNews" type="button">' + svgIcon("i-sparkles") + ' What\'s new</button>' +
      '</div>' +
    '</section>';
  html.account = '<section class="set-sec"><h3>Account</h3>' +
      (signedIn
        ? '<div class="set-row"><div><b>' + esc(BE.user.name) + ' ' + roleBadgeHtml(BE.user.id) + '</b><small>' + esc(BE.user.email) + '</small></div>' +
          '<div class="btn-row"><button class="btn ghost sm" id="setProfile" type="button">' + svgIcon("i-user") + ' Profile</button>' +
          '<button class="btn ghost sm" id="setOut" type="button">' + svgIcon("i-logout") + ' Sign out</button></div></div>' +
          (BE.user.verified === false
            ? '<div class="verify-note"><b>Confirm your email</b><small>We sent a link to ' + esc(BE.user.email) + '. Until you open it your email stays hidden in People and staff roles tied to it don\'t switch on.</small>' +
              '<div class="btn-row"><button class="btn sm" id="setVerified" type="button">I\'ve opened the link</button><button class="btn ghost sm" id="setResend" type="button">Send it again</button></div></div>'
            : '')
        : (usingFirebase()
            ? '<div class="btn-row"><button class="btn" id="setIn" type="button">Sign in</button></div>'
            : '<p class="hint">This copy of the Hub has no accounts.</p>')) +
    '</section>' +
    '<section class="set-sec"><h3>Privacy</h3>' +
      (signedIn
        ? row("Show my email in People", "Classmates can see and copy your school email. Turn off to hide it.",
            toggle("setListed", listing !== false))
        : '<p class="hint">Sign in to choose whether your email shows in People.</p>') +
    '</section>';
  html.staff = '<section class="set-sec"><h3>' + (canAdmin() ? "Admin" : "Staff") + ' tools</h3><div class="staff-grid">' +
      (canAdmin() ? '<button class="staff-card" id="setMembers" type="button">' + svgIcon("i-people") + '<b>Members and roles</b><small>Rename people, make teachers and mods</small></button>' : '') +
      (canModerate() ? '<button class="staff-card" id="setMod" type="button">' + svgIcon("i-shield") + '<b>Moderation</b><small>Pause someone\'s chat access</small></button>' : '') +
      (canAnnounce() ? '<button class="staff-card" id="setAnnounce" type="button">' + svgIcon("i-megaphone") + '<b>Post news</b><small>Announcements for the class</small></button>' : '') +
      (canAdmin() ? '<button class="staff-card" id="setEditor" type="button">' + svgIcon("i-edit") + '<b>Edit the site</b><small>Timetable, calendar, bells, banner</small></button>' : '') +
    '</div></section>';
  html.fix = fixHtml();
  html.alerts = alertsHtml(row, seg);
  html.keys = '<section class="set-sec"><h3>Keyboard shortcuts</h3><div class="set-keys">' +
      '<span><kbd>Ctrl</kbd> <kbd>K</kbd></span><span>Search everything</span>' +
      '<span><kbd>1</kbd> to <kbd>8</kbd></span><span>Jump between sections</span>' +
      '<span><kbd>[</kbd></span><span>Shrink or widen the sidebar</span>' +
      '<span><kbd>/</kbd></span><span>Search</span>' +
      '<span><kbd>Alt</kbd> <kbd>←</kbd></span><span>Back to the section you were on</span>' +
      '<span><kbd>Esc</kbd></span><span>Close whatever is open</span>' +
    '</div></section>';

  var box = openSheet(
    '<div class="sheet-head"><div><h2>Settings</h2><p class="hint">Saved to your account when you\'re signed in.</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +
    '<div class="set-wrap"><nav class="set-nav" role="tablist" aria-label="Settings">' + panes.map(function(p){
      return '<button type="button" role="tab" data-pane="' + p[0] + '">' + svgIcon(p[1]) + '<span>' + p[2] + '</span></button>';
    }).join("") + '</nav><div class="set-panes">' + panes.map(function(p){
      return '<div class="set-pane" role="tabpanel" data-pane="' + p[0] + '" hidden>' + html[p[0]] + '</div>';
    }).join("") + '</div></div>'
  );
  box.classList.add("wide", "settings-box");
  function show(name){
    if (!box.querySelector('.set-pane[data-pane="' + name + '"]')) name = "look";
    lastPane = name;
    box.querySelectorAll(".set-nav button").forEach(function(b){ var on = b.dataset.pane === name; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    box.querySelectorAll(".set-pane").forEach(function(p){ p.hidden = p.dataset.pane !== name; });
    var onBtn = box.querySelector(".set-nav button.on");
    if (onBtn && onBtn.scrollIntoView) onBtn.scrollIntoView({ block: "nearest", inline: "nearest" });
    var panesEl = box.querySelector(".set-panes"); if (panesEl) panesEl.scrollTop = 0;
  }
  box.querySelectorAll(".set-nav button").forEach(function(b){ b.addEventListener("click", function(){ show(b.dataset.pane); }); });
  show(typeof pane === "string" ? pane : lastPane);

  lookHooks({
    setTheme: function(m){ setTheme(m); },
    setBg: function(v){ setBackgroundMode(v); },
    pickBg: function(done){
      pickFiles("image/*").then(function(files){
        if (!files || !files[0]) return;
        toast("Setting your picture…");
        compressImage(files[0], 1920, 950000).then(function(r){
          return setCustomImage(r.data).then(function(){ done(r.data); toast("Your picture is the background now."); });
        }).catch(function(e){ toast(e.message || "Couldn't use that picture.", true); });
      });
    }
  });
  wireLook(box, closeSheet);
  wireAlerts(box);

  box.querySelectorAll('input[name="setTheme"]').forEach(function(r){
    r.addEventListener("change", function(){ if (r.checked) setTheme(r.value); });
  });
  box.querySelectorAll('input[name="setMotion"]').forEach(function(r){
    r.addEventListener("change", function(){
      if (!r.checked) return;
      setPref("3cs_motion", r.value);
      document.documentElement.classList.toggle("reduce-motion", r.value === "reduce");
      toast(r.value === "reduce" ? "Animations turned down." : "Full animations back on.");
    });
  });
  box.querySelectorAll('input[name="setFx"]').forEach(function(r){
    r.addEventListener("change", function(){
      if (!r.checked) return;
      setPref("3cs_fx", r.value);
      var weak = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
      document.documentElement.classList.toggle("lite", r.value === "lite" || (r.value === "auto" && !!weak));
      toast(r.value === "lite" ? "Light effects on. Things should feel snappier." : r.value === "full" ? "All the effects are on." : "Effects will match this computer.");
    });
  });
  var ph = box.querySelector("#setPhotos"); if (ph) ph.addEventListener("click", function(){ closeSheet(); openGallery(0); });
  var intro = box.querySelector("#setIntro");
  intro.value = getPref("3cs_intro_mode");
  intro.addEventListener("change", function(){
    setPref("3cs_intro_mode", intro.value);
    toast(intro.value === "off" ? "The welcome animation won't play." :
          intro.value === "updates" ? "It'll play once after each update." : "It'll play on your first visit each day.");
  });
  box.querySelector("#setReplay").addEventListener("click", function(){
    closeSheet();
    import("./intro.js").then(function(m){ m.replayIntro(); });
  });
  box.querySelector("#setNews").addEventListener("click", function(){ closeSheet(); openWhatsNew(); });
  var ntf = box.querySelector("#setNtf");
  ntf.value = getPref("3cs_ntf");
  ntf.addEventListener("change", function(){ setPref("3cs_ntf", ntf.value); });
  box.querySelector("#setSound").addEventListener("change", function(e){ setPref("3cs_ntf_sound", e.target.checked ? "on" : "off"); });
  box.querySelector("#setEnter").addEventListener("change", function(e){ setPref("3cs_enter", e.target.checked ? "on" : "off"); });
  var lst = box.querySelector("#setListed");
  if (lst) lst.addEventListener("change", function(){
    setListed(lst.checked).then(function(){
      toast(lst.checked ? "Your email shows in People again." : "Your email is hidden from People.");
    }).catch(function(){ lst.checked = !lst.checked; toast("Couldn't change that. Try again.", true); });
  });
  function on(id, fn){ var e = box.querySelector("#" + id); if (e) e.addEventListener("click", fn); }
  on("setResend", function(){
    var u = BE.auth && BE.auth.currentUser;
    if (!u) return;
    u.sendEmailVerification().then(function(){ toast("Sent. Check your inbox, and the spam folder."); })
      .catch(function(){ toast("Couldn't send it just now. Try again in a minute.", true); });
  });
  on("setVerified", function(){
    var u = BE.auth && BE.auth.currentUser;
    if (!u) return;
    u.reload().then(function(){
      if (!u.emailVerified){ toast("Not confirmed yet. Open the link in the email first.", true); return; }
      return u.getIdToken(true).then(function(){ toast("Email confirmed."); setTimeout(function(){ location.reload(); }, 700); });
    }).catch(function(){ toast("Couldn't check just now. Try again.", true); });
  });
  on("setCopyReport", function(){
    var txt = report();
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ toast("Report copied. Paste it in Feedback or send it to an admin."); })
      .catch(function(){ window.prompt("Copy this report:", txt); });
  });
  on("setClearCache", function(){
    toast("Clearing this device's copy of the Hub…");
    var db = BE.db;
    var done = function(){ try{ sessionStorage.clear(); }catch(e){} location.reload(); };
    if (db && db.terminate && db.clearPersistence){
      db.terminate().then(function(){ return db.clearPersistence(); }).then(done, done);
    } else done();
  });
  on("setProfile", function(){ closeSheet(); openProfileSheet(); });
  on("setOut", function(){ closeSheet(); signOutNow(); });
  on("setIn", function(){ closeSheet(); openAuthSheet(); });
  on("setMod", function(){ closeSheet(); openModeration(); });
  on("setEditor", function(){ closeSheet(); openSiteEditor(); });
  on("setMembers", function(){ closeSheet(); openMembers(); });
  on("setAnnounce", function(){
    closeSheet();
    var t = document.querySelector('nav.tabs button[data-tab="announcements"]'); if (t) t.click();
    setTimeout(function(){ var i = document.getElementById("annInput") || document.querySelector("#tab-announcements textarea"); if (i) i.focus(); }, 400);
  });
}

/* Troubleshoot: what this device knows about itself, in plain words, plus
   the two fixes that solve most "it works for everyone but me" problems. */
function envFacts(){
  var ua = navigator.userAgent, b = "Browser";
  var m = /Edg\/(\d+)/.exec(ua) || /OPR\/(\d+)/.exec(ua) || /Chrome\/(\d+)/.exec(ua) || /Firefox\/(\d+)/.exec(ua) || /Version\/(\d+).*Safari/.exec(ua);
  if (/Edg\//.test(ua)) b = "Edge"; else if (/OPR\//.test(ua)) b = "Opera"; else if (/Chrome\//.test(ua)) b = "Chrome"; else if (/Firefox\//.test(ua)) b = "Firefox"; else if (/Safari/.test(ua)) b = "Safari";
  return [
    ["Hub version", String(window.HUB_VERSION || "?")],
    ["Browser", b + (m ? " " + m[1] : "") + (/CrOS/.test(ua) ? " on a Chromebook" : /Windows/.test(ua) ? " on Windows" : /Mac OS/.test(ua) ? " on a Mac" : /Android/.test(ua) ? " on Android" : /iPhone|iPad/.test(ua) ? " on iOS" : "")],
    ["Signed in", usingFirebase() ? (BE.user ? "Yes" : "No") : "No accounts in this copy"],
    ["Connection", navigator.onLine === false ? "Offline" : "Online"],
    ["Screen", window.innerWidth + " × " + window.innerHeight + (window.devicePixelRatio && window.devicePixelRatio !== 1 ? " at " + Math.round(window.devicePixelRatio * 100) + "% scale" : "")],
    ["Problems seen", hubErrors.length ? String(hubErrors.length) : "None"]
  ];
}
function fixHtml(){
  var errs = hubErrors.slice(-6).reverse();
  return '<section class="set-sec"><h3>This device</h3><div class="fix-facts">' +
      envFacts().map(function(f){ return '<span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b>'; }).join("") + '</div>' +
      (errs.length ? '<div class="fix-errs">' + errs.map(function(e){
        return '<div><b>' + esc(e.where) + (e.code ? ' · ' + esc(e.code) : '') + '</b><small>' + esc(e.msg) + '</small></div>';
      }).join("") + '</div>' : '<p class="hint" style="margin-top:10px">Nothing has gone wrong on this device since the page loaded.</p>') +
    '</section>' +
    '<section class="set-sec"><h3>Fixes</h3>' +
      row("Something missing or out of date?", "Clears this device\'s saved copy of the class data and loads it fresh. Your settings and account stay.", '<button class="btn ghost sm" id="setClearCache" type="button">Refresh data</button>') +
      row("Tell an admin", "Copies the details above so whoever fixes it can see what happened.", '<button class="btn ghost sm" id="setCopyReport" type="button">Copy report</button>') +
    '</section>';
}
function report(){
  return "3CS Hub report\n" + envFacts().map(function(f){ return f[0] + ": " + f[1]; }).join("\n") +
    "\nPage: " + location.hash + "\n" + hubErrors.slice(-10).map(function(e){ return e.at + " " + e.where + " " + e.code + " " + e.msg; }).join("\n");
}

/* The phone's "More" button: the sections that don't fit in the bar. */
function openMoreSheet(){
  var items = [
    ["help", "i-help", "Help board", "Ask the class, post reminders"],
    ["calendar", "i-calendar", "Calendar", "Cycle days, holidays, half days"],
    ["announcements", "i-megaphone", "News", "Announcements from admins"],
    ["people", "i-people", "People", "Everyone's school email"],
    ["voice", "i-poll", "Polls & feedback", "Vote, share ideas, report problems"]
  ];
  var box = openSheet(
    '<div class="sheet-head"><h2>More</h2><button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +
    '<div class="more-list">' + items.filter(function(it){ var b = document.querySelector('nav.tabs button[data-tab="' + it[0] + '"]'); return !b || !b.hidden; }).map(function(it){
      return '<button type="button" class="more-item" data-tab="' + it[0] + '"><span class="si">' + svgIcon(it[1]) + '</span><span><b>' + it[2] + '</b><small>' + it[3] + '</small></span></button>';
    }).join("") +
    '<button type="button" class="more-item" data-do="search"><span class="si">' + svgIcon("i-search") + '</span><span><b>Search</b><small>Find anything in the Hub</small></span></button>' +
    '<button type="button" class="more-item" data-do="apps"><span class="si">' + svgIcon("i-grid") + '</span><span><b>Apps</b><small>Classroom, Docs, Canva and more</small></span></button>' +
    '<button type="button" class="more-item" data-do="settings"><span class="si">' + svgIcon("i-settings") + '</span><span><b>Settings</b><small>Theme, reminders, privacy</small></span></button>' +
    (canInstall() ? '<button type="button" class="more-item" data-do="install"><span class="si">' + svgIcon("i-arrow-down") + '</span><span><b>Install the app</b><small>On your home screen, works offline</small></span></button>' : '') +
    (offerApk() ? '<a class="more-item" href="' + APK + '" download="3CS-Hub.apk"><span class="si">' + svgIcon("i-arrow-down") + '</span><span><b>Get the Android app</b><small>Notifications, reminders, one tap to open</small></span></a>' : '') +
    '</div>'
  );
  box.querySelectorAll(".more-item").forEach(function(b){
    b.addEventListener("click", function(){
      closeSheet();
      if (b.dataset.tab){
        var t = document.querySelector('nav.tabs button[data-tab="' + b.dataset.tab + '"]');
        if (t) t.click();
      } else if (b.dataset.do === "search") showPalette();
      else if (b.dataset.do === "apps") setTimeout(openLauncher, 30);
      else if (b.dataset.do === "settings") openSettings();
      else if (b.dataset.do === "install") install();
    });
  });
}

function releaseHtml(r, open){
  return '<details class="rel"' + (open ? " open" : "") + '><summary><b>Version ' + esc(r.version) + '</b><span>' + esc(r.title) + ' · ' + esc(r.date) + '</span></summary>' +
    (r.added.length ? '<h4>New</h4><ul>' + r.added.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>' : '') +
    (r.fixed.length ? '<h4>Fixed</h4><ul class="fixed">' + r.fixed.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>' : '') +
    '</details>';
}
function openWhatsNew(){
  var box = openSheet(
    '<div class="sheet-head"><div><h2>What\'s new</h2><p class="hint">Every change to the Hub, newest first.</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +
    RELEASES.map(function(r, i){ return releaseHtml(r, i === 0); }).join("")
  );
  box.classList.add("wide", "news-box");
}

function initSettings(){
  registerCommands(function(){
    return [
      { kind:"Do", title:"Settings", hint:"theme, notifications, privacy", run:openSettings },
      { kind:"Do", title:"What's new", hint:"the update log", run:openWhatsNew }
    ];
  });
}

export { getPref, setPref, openSettings, openMoreSheet, openWhatsNew, initSettings };
