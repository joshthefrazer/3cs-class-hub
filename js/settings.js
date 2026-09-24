import { BE, signOutNow, toast, usingFirebase, canAdmin } from "./backend.js";
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
import { setBackgroundMode, bgMode, openGallery } from "./campus.js";

/* =========================================================
   SETTINGS - everything here is a preference for this browser, except
   "show my email", which lives on your directory entry so it follows you.
   ========================================================= */

var DEFAULTS = {
  "3cs_intro_mode": "daily",   // daily | updates | off
  "3cs_motion":     "system",  // system | reduce
  "3cs_ntf":        "all",     // all | direct | off
  "3cs_ntf_sound":  "off",     // on | off
  "3cs_enter":      "on"       // on | off  (Enter sends a message)
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

function openSettings(){
  var signedIn = usingFirebase() && !!BE.user;
  var listing = myListing();
  var box = openSheet(
    '<div class="sheet-head"><div><h2>Settings</h2><p class="hint">Saved in this browser unless it says otherwise.</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +

    '<section class="set-sec"><h3>Look</h3>' +
      row("Theme", "System follows your device.", seg("setTheme", themeChoice(), [["system","System"],["light","Light"],["dark","Dark"]])) +
      row("Motion", "Reduce turns off the bigger animations everywhere.", seg("setMotion", getPref("3cs_motion"), [["system","Full"],["reduce","Reduced"]])) +
      row("Background", "Photos of the Itz'at campus. Each section can have its own spot, or one photo can change daily.",
        seg("setBg", bgMode(), [["sections","By section"],["daily","Daily"],["paper","Graph paper"]])) +
      '<div class="btn-row" style="margin-top:6px"><button class="btn ghost sm" id="setPhotos" type="button">' + svgIcon("i-image") + ' See the campus photos</button></div>' +
    '</section>' +

    '<section class="set-sec"><h3>Welcome animation</h3>' +
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
    '</section>' +

    '<section class="set-sec"><h3>Chat</h3>' +
      row("Pop-up notifications", "Small cards at the side when a message arrives while the chat is closed.",
        '<select id="setNtf" aria-label="Pop-up notifications">' +
          '<option value="all">Everything</option>' +
          '<option value="direct">Only chats and @mentions</option>' +
          '<option value="off">Off</option>' +
        '</select>') +
      row("Sound", "A soft blip with each pop-up.", toggle("setSound", getPref("3cs_ntf_sound") === "on")) +
      row("Enter sends", "Turn off to use Enter for new lines, and Ctrl+Enter to send.", toggle("setEnter", getPref("3cs_enter") === "on")) +
    '</section>' +

    '<section class="set-sec"><h3>Privacy</h3>' +
      (signedIn
        ? row("Show my email in People", "Classmates can see and copy your school email. Turn off to hide it.",
            toggle("setListed", listing !== false))
        : '<p class="hint">Sign in to choose whether your email shows in People.</p>') +
    '</section>' +

    '<section class="set-sec"><h3>Account</h3>' +
      (signedIn
        ? '<div class="set-row"><div><b>' + esc(BE.user.name) + (BE.isOwner ? ' <span class="badge priv">Owner</span>' : BE.isAdmin ? ' <span class="badge priv">Admin</span>' : '') + '</b><small>' + esc(BE.user.email) + '</small></div>' +
          '<div class="btn-row"><button class="btn ghost sm" id="setProfile" type="button">' + svgIcon("i-user") + ' Profile</button>' +
          '<button class="btn ghost sm" id="setOut" type="button">' + svgIcon("i-logout") + ' Sign out</button></div></div>'
        : (usingFirebase()
            ? '<div class="btn-row"><button class="btn" id="setIn" type="button">Sign in</button></div>'
            : '<p class="hint">This copy of the Hub has no accounts.</p>')) +
    '</section>' +

    (canAdmin()
      ? '<section class="set-sec"><h3>Admin</h3><div class="btn-row">' +
          '<button class="btn ghost sm" id="setMod" type="button">' + svgIcon("i-shield") + ' Moderation</button>' +
          '<button class="btn ghost sm" id="setEditor" type="button">' + svgIcon("i-edit") + ' Edit the site</button>' +
        '</div></section>'
      : '') +

    '<section class="set-sec"><h3>Keyboard</h3><div class="set-keys">' +
      '<span><kbd>Ctrl</kbd> <kbd>K</kbd></span><span>Search everything</span>' +
      '<span><kbd>1</kbd> to <kbd>7</kbd></span><span>Jump between sections</span>' +
      '<span><kbd>/</kbd></span><span>Search</span>' +
      '<span><kbd>Esc</kbd></span><span>Close whatever is open</span>' +
    '</div></section>'
  );
  box.classList.add("wide");

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
  box.querySelectorAll('input[name="setBg"]').forEach(function(r){
    r.addEventListener("change", function(){
      if (!r.checked) return;
      setBackgroundMode(r.value);
      toast(r.value === "paper" ? "Back to graph paper." : r.value === "daily" ? "A new campus photo every day." : "Each section has its own spot on campus.");
    });
  });
  box.querySelector("#setPhotos").addEventListener("click", function(){ closeSheet(); openGallery(0); });
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
  var pb = box.querySelector("#setProfile");
  if (pb) pb.addEventListener("click", function(){ closeSheet(); openProfileSheet(); });
  var ob = box.querySelector("#setOut");
  if (ob) ob.addEventListener("click", function(){ closeSheet(); signOutNow(); });
  var ib = box.querySelector("#setIn");
  if (ib) ib.addEventListener("click", function(){ closeSheet(); openAuthSheet(); });
  var mb = box.querySelector("#setMod");
  if (mb) mb.addEventListener("click", function(){ closeSheet(); openModeration(); });
  var eb = box.querySelector("#setEditor");
  if (eb) eb.addEventListener("click", function(){ closeSheet(); openSiteEditor(); });
}

/* The phone's "More" button: the sections that don't fit in the bar. */
function openMoreSheet(){
  var items = [
    ["help", "i-help", "Help board", "Ask the class, post reminders"],
    ["calendar", "i-calendar", "Calendar", "Cycle days, holidays, half days"],
    ["announcements", "i-megaphone", "News", "Announcements from admins"],
    ["people", "i-people", "People", "Everyone's school email"]
  ];
  var box = openSheet(
    '<div class="sheet-head"><h2>More</h2><button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +
    '<div class="more-list">' + items.map(function(it){
      return '<button type="button" class="more-item" data-tab="' + it[0] + '"><span class="si">' + svgIcon(it[1]) + '</span><span><b>' + it[2] + '</b><small>' + it[3] + '</small></span></button>';
    }).join("") +
    '<button type="button" class="more-item" data-do="search"><span class="si">' + svgIcon("i-search") + '</span><span><b>Search</b><small>Find anything in the Hub</small></span></button>' +
    '<button type="button" class="more-item" data-do="apps"><span class="si">' + svgIcon("i-grid") + '</span><span><b>Apps</b><small>Classroom, Docs, Canva and more</small></span></button>' +
    '<button type="button" class="more-item" data-do="settings"><span class="si">' + svgIcon("i-settings") + '</span><span><b>Settings</b><small>Theme, notifications, privacy</small></span></button>' +
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
