import { BE, canAdmin, dbErrMsg, meId, myName, toast, usingFirebase, registerStream } from "./backend.js";
import { state } from "./state.js";
import { esc, safeUrl, svgIcon, openSheet, closeSheet } from "./text.js";
import { avatarEl, displayName, onProfiles } from "./profile.js";
import { registerCommands } from "./palette.js";
import { openAuthSheet } from "./auth.js";
import { notify, clearFor, setTitleCount } from "./notify.js";
import { buildEmojiPanel, CATS, CAT_ICON, isEmojiOnly } from "./emoji.js";
import { STICKERS, stickerEl, stickerName } from "./stickers.js";
import { compressImage, prepareGif, uploadMedia, mediaEl, pickFiles, mediaError } from "./media.js";
import { getPref } from "./settings.js";
import { people, isOnline, seenText } from "./people.js";

/* =========================================================
   MESSAGES - the 3CS class room, private chats and group chats.

     chat/{id}                      the class room (everyone signed in)
     convos/{cid}                   a DM (dm_<uid>_<uid>) or a group (g_...)
     convos/{cid}/messages/{id}     its messages
     users/{uid}/prefs/chat         your muted, hidden and pinned chats
     config/moderation              who an admin has timed out

   A message is { uid, name, text, createdAt } plus, optionally, a sticker,
   a picture (media id), a reply quote, and reactions. The rules check that
   every message is signed by its sender and stamped by the server.

   Only the open conversation streams its messages. The chat list reads
   each conversation's one-line preview (convo.last), so ten chats cost ten
   small documents, not ten conversations' worth of messages.
   ========================================================= */

var MAIN = "main";
var QUICK = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
var open = false;
var active = MAIN;
var convos = {};
var allConvos = null;          // admin view of every conversation
var adminAll = false;
var convoMsgs = {};
var convoUnsub = null;
var convoLoaded = {};
var prefs = { muted: {}, hidden: {}, pinned: {} };
var moderation = { chatBlocked: [] };
var bootAt = Date.now();
var notified = {};
var lastSeenConvo = {};
var reply = null;
var editing = null;
var listQuery = "";
var showHidden = false;
var lastSend = 0;
var uploads = [];              // pictures on their way up: { key, cid, preview }
var dividerAt = {};            // cid -> read time when it was opened
var mediaNodes = {};           // media id -> element, so pictures don't reload on every repaint
var stickerNodes = {};

function el(id){ return document.getElementById(id); }
function me(){ return meId(); }
function fbTS(){ return usingFirebase() ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString(); }

function tsOf(m){
  var v = m && (m.createdAt !== undefined ? m.createdAt : m.at);
  if (!v) return m && m._local ? m._local : Date.now();
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  var t = Date.parse(v);
  return isNaN(t) ? Date.now() : t;
}

/* ------------------------------------------------------------ reading -- */
var READ_KEY = "3cs_read_v2";
var readMap = (function(){
  var m = {};
  try{ m = JSON.parse(localStorage.getItem(READ_KEY) || "{}") || {}; }catch(e){}
  if (!m._since){
    m._since = Date.now();
    try{
      var old = parseInt(localStorage.getItem("3cs_chat_seen") || "0", 10);
      m.main = old || Date.now();
    }catch(e){ m.main = Date.now(); }
  }
  return m;
})();
var readSaveT = null;
function readAt(cid){ return readMap[cid] || readMap._since || 0; }
function markRead(cid){
  var newest = Date.now();
  if ((readMap[cid] || 0) >= newest - 500) return;
  readMap[cid] = newest;
  clearTimeout(readSaveT);
  readSaveT = setTimeout(function(){ try{ localStorage.setItem(READ_KEY, JSON.stringify(readMap)); }catch(e){} }, 400);
  clearFor(cid + ":");
  paintBadge();
}
function viewing(cid){ return open && active === cid && !document.hidden; }

/* ------------------------------------------------------------ helpers -- */
function isMuted(cid){ return !!prefs.muted[cid]; }
function isBlocked(uid){ return (moderation.chatBlocked || []).indexOf(uid) > -1; }
function convoOf(cid){ return convos[cid] || (allConvos && allConvos[cid]) || null; }
function isMember(cid){
  if (cid === MAIN) return true;
  var c = convoOf(cid);
  return !!(c && BE.user && (c.members || []).indexOf(BE.user.id) > -1);
}
function otherOf(c){
  if (!c || !BE.user) return null;
  var o = (c.members || []).filter(function(u){ return u !== BE.user.id; });
  return o[0] || null;
}
function dirName(uid){
  var d = state.directory && state.directory[uid];
  return displayName(uid, d && d.name);
}
function convoTitle(cid){
  if (cid === MAIN) return "3CS class";
  var c = convoOf(cid);
  if (!c) return "Chat";
  if (c.type === "group") return c.name || "Group";
  if (!isMember(cid) && c.members) return c.members.map(dirName).join(" & ");
  var o = otherOf(c);
  if (!o && c.members) return c.members.map(dirName).join(" & ");
  return dirName(o);
}
function preview(m){
  if (!m) return "";
  if (m.text) return m.text;
  if (m.sticker) return "Sticker: " + stickerName(m.sticker);
  if (m.mediaKind === "gif") return "GIF";
  if (m.media) return "Picture";
  return "";
}
function clock(t){ return new Date(t).toLocaleTimeString(undefined, { hour:"numeric", minute:"2-digit" }); }
function shortWhen(t){
  if (!t) return "";
  var d = new Date(t), now = new Date();
  if (d.toDateString() === now.toDateString()) return clock(t);
  var y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  if (now - d < 6 * 86400000) return d.toLocaleDateString(undefined, { weekday:"short" });
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
}
function dayLabel(t){
  var d = new Date(t), now = new Date();
  var a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  var b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var diff = Math.round((b - a) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric" });
}

/* Names that can be @mentioned in a room, longest first so "Ana Maria"
   wins over "Ana". */
function mentionNames(cid){
  var ids = cid === MAIN
    ? Object.keys(state.directory || {})
    : ((convoOf(cid) || {}).members || []);
  return ids.map(function(u){ return { uid: u, name: dirName(u) }; })
    .filter(function(x){ return x.name && x.name !== "Someone"; })
    .sort(function(a, b){ return b.name.length - a.name.length; });
}
function mentionsMe(text){
  if (!BE.user || !text) return false;
  var n = dirName(BE.user.id).toLowerCase();
  return String(text).toLowerCase().indexOf("@" + n) > -1;
}

/* Text with links and @mentions, always built as DOM nodes, never HTML. */
var LINK_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi;
function addMentions(node, text, names){
  if (!names.length || text.indexOf("@") < 0){ node.appendChild(document.createTextNode(text)); return; }
  var lower = text.toLowerCase(), i = 0, last = 0;
  while ((i = lower.indexOf("@", i)) > -1){
    var hit = null;
    for (var k = 0; k < names.length; k++){
      if (lower.substr(i + 1, names[k].name.length) === names[k].name.toLowerCase()){ hit = names[k]; break; }
    }
    if (hit){
      if (i > last) node.appendChild(document.createTextNode(text.slice(last, i)));
      var s = document.createElement("span");
      s.className = "mention";
      s.textContent = text.substr(i, hit.name.length + 1);
      node.appendChild(s);
      last = i + hit.name.length + 1;
      i = last;
    } else i++;
  }
  if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
}
function fillText(node, text, names){
  names = names || [];
  var last = 0, m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text))){
    if (m.index > last) addMentions(node, text.slice(last, m.index), names);
    var href = safeUrl(m[0]);
    if (href){
      var a = document.createElement("a");
      a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer nofollow";
      a.textContent = m[0];
      node.appendChild(a);
    } else node.appendChild(document.createTextNode(m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) addMentions(node, text.slice(last), names);
}

/* ------------------------------------------------------------ streams -- */
function normPrefs(d){
  d = d || {};
  return { muted: d.muted || {}, hidden: d.hidden || {}, pinned: d.pinned || {} };
}
registerStream(function(db){
  if (!usingFirebase() || !BE.user) return [];
  var uid = BE.user.id;
  var first = true;
  return [
    db.collection("convos").where("members", "array-contains", uid).limit(100).onSnapshot(function(qs){
      var next = {};
      qs.docs.forEach(function(d){
        var data = d.data({ serverTimestamps: "estimate" });
        next[d.id] = Object.assign({ id: d.id }, data);
      });
      convos = next;
      Object.keys(next).forEach(function(cid){
        var c = next[cid], l = c.last;
        var at = l ? tsOf(l) : 0;
        if (!first && l && l.uid !== uid && at > bootAt && at > (lastSeenConvo[cid] || 0) && !viewing(cid)){
          var mention = mentionsMe(l.text);
          if (!isMuted(cid) || mention){
            notify({
              key: cid + ":" + at, uid: l.uid, name: l.name || dirName(l.uid),
              where: c.type === "group" ? "in " + (c.name || "a group") : "sent you a message",
              text: l.text, kind: c.type === "group" ? "group" : "dm", mention: mention,
              onOpen: function(){ openChat(cid); },
              onReply: function(v){ sendTo(cid, { text: v }); }
            });
          }
        }
        lastSeenConvo[cid] = Math.max(lastSeenConvo[cid] || 0, at);
      });
      first = false;
      if (active !== MAIN && !convoOf(active) && !adminAll){ switchTo(MAIN); }
      renderAll();
    }, function(){ convos = {}; renderAll(); }),

    db.doc("users/" + uid + "/prefs/chat").onSnapshot(function(s){
      prefs = normPrefs(s.exists ? s.data() : null);
      renderAll();
    }, function(){}),

    db.doc("config/moderation").onSnapshot(function(s){
      var d = s.exists ? s.data() : {};
      moderation = { chatBlocked: Array.isArray(d.chatBlocked) ? d.chatBlocked : [] };
      renderAll();
      try{ import("./people.js").then(function(m){ m.renderPeople(); }); }catch(e){}
    }, function(){})
  ];
}, function(){
  convos = {}; allConvos = null; adminAll = false;
  if (convoUnsub){ convoUnsub(); convoUnsub = null; }
  convoMsgs = {}; convoLoaded = {};
  prefs = normPrefs(); moderation = { chatBlocked: [] };
  active = MAIN; reply = null; editing = null;
  renderAll();
});

function listenConvo(cid){
  if (convoUnsub){ convoUnsub(); convoUnsub = null; }
  if (cid === MAIN || !BE.db) return;
  convoLoaded[cid] = !!convoMsgs[cid];
  convoUnsub = BE.db.collection("convos").doc(cid).collection("messages")
    .orderBy("createdAt", "desc").limit(80)
    .onSnapshot(function(qs){
      var rows = [];
      qs.docs.forEach(function(d){
        var row = Object.assign({ id: d.id }, d.data({ serverTimestamps: "estimate" }));
        if (d.metadata && d.metadata.hasPendingWrites) row._pending = true;
        rows.push(row);
      });
      convoMsgs[cid] = rows;
      convoLoaded[cid] = true;
      if (active === cid){ renderThread(); if (viewing(cid)) markRead(cid); }
    }, function(err){
      convoLoaded[cid] = true;
      convoMsgs[cid] = convoMsgs[cid] || [];
      if (active === cid){ renderThread(); toast(dbErrMsg(err), true); }
    });
}

/* Called by the backend's class-room stream with the newest page. */
function setChat(rows){
  var prev = {};
  (state.chat || []).forEach(function(m){ prev[m.id] = 1; });
  var hadAny = (state.chat || []).length > 0;
  state.chat = rows;
  state.chatLoaded = true;
  rows.forEach(function(m){
    if (prev[m.id] || notified[m.id] || !hadAny && !state._chatPrimed) return;
    if (m.uid === me() || tsOf(m) < bootAt || m._pending) return;
    notified[m.id] = 1;
    if (viewing(MAIN)) return;
    var mention = mentionsMe(m.text);
    if (isMuted(MAIN) && !mention) return;
    notify({
      key: MAIN + ":" + m.id, uid: m.uid, name: displayName(m.uid, m.name), where: "in 3CS class",
      text: preview(m), kind: "main", mention: mention,
      onOpen: function(){ openChat(MAIN); },
      onReply: function(v){ sendTo(MAIN, { text: v, replyTo: { id: m.id, uid: m.uid, name: displayName(m.uid, m.name).slice(0, 40), text: preview(m).slice(0, 160) } }); }
    });
  });
  state._chatPrimed = true;
  if (active === MAIN) renderThread();
  if (viewing(MAIN)) markRead(MAIN);
  renderList();
  renderPeek();
  paintBadge();
  if (!open && rows.length && hadAny){
    var fab = el("chatFab");
    if (fab && fab.animate && !document.documentElement.classList.contains("reduce-motion") &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches && rows[0] && !prev[rows[0].id] && rows[0].uid !== me()){
      fab.animate([{ transform:"scale(1)" }, { transform:"scale(1.1) rotate(-4deg)" }, { transform:"scale(1)" }],
                  { duration: 450, easing: "cubic-bezier(.34,1.56,.64,1)" });
    }
  }
}

/* -------------------------------------------------------------- badge -- */
function unreadMain(){
  var since = readAt(MAIN);
  return (state.chat || []).filter(function(m){ return m.uid !== me() && tsOf(m) > since; }).length;
}
function convoUnread(cid){
  var c = convoOf(cid);
  if (!c || !c.last || !BE.user || c.last.uid === BE.user.id) return 0;
  if (tsOf(c.last) <= readAt(cid)) return 0;
  var rows = convoMsgs[cid];
  if (rows){
    var n = rows.filter(function(m){ return m.uid !== BE.user.id && tsOf(m) > readAt(cid); }).length;
    return Math.max(1, n);
  }
  return 1;
}
function paintBadge(){
  var total = 0;
  if (!isMuted(MAIN)) total += unreadMain();
  Object.keys(convos).forEach(function(cid){ if (!isMuted(cid)) total += convoUnread(cid) ? 1 : 0; });
  if (open && !document.hidden){
    total -= active === MAIN ? (isMuted(MAIN) ? 0 : unreadMain()) : (convoUnread(active) && !isMuted(active) ? 1 : 0);
  }
  total = Math.max(0, total);
  var b = el("chatBadge");
  if (b){ b.hidden = !total; b.textContent = total > 9 ? "9+" : String(total); }
  var bb = el("bnChatBadge");
  if (bb){ bb.hidden = !total; bb.textContent = total > 9 ? "9+" : String(total); }
  var fab = el("chatFab");
  if (fab) fab.setAttribute("aria-label", total ? "Open messages, " + total + " unread" : "Open messages");
  setTitleCount(total);
}

/* ----------------------------------------------------------- shell ---- */
var built = false;
function build(){
  if (built) return;
  var p = el("chatPanel");
  if (!p) return;
  built = true;
  p.innerHTML =
    '<aside class="ms-side" aria-label="Chats">' +
      '<div class="ms-side-head"><h2>Messages</h2>' +
        '<button class="icon-btn sm" id="msNew" type="button" aria-label="Start a new chat" title="New chat">' + svgIcon("i-user-plus") + '</button>' +
        '<button class="icon-btn sm ms-expand" id="msExpand" type="button" aria-label="Make the chat window bigger" title="Bigger window">' + svgIcon("i-maximize") + '</button>' +
        '<button class="icon-btn sm ms-close-list" id="msCloseList" type="button" aria-label="Close messages">' + svgIcon("i-close") + '</button>' +
      '</div>' +
      '<label class="ms-search">' + svgIcon("i-search") + '<input id="msSearch" type="search" placeholder="Search chats" aria-label="Search chats" autocomplete="off"></label>' +
      '<div class="ms-list" id="msList"></div>' +
      '<div class="ms-side-foot" id="msSideFoot" hidden></div>' +
    '</aside>' +
    '<section class="ms-thread" aria-label="Conversation">' +
      '<header class="ms-head" id="msHead"></header>' +
      '<div class="ms-notice" id="msNotice" hidden></div>' +
      '<div class="ms-msgs" id="chatList" role="log" aria-live="polite" aria-label="Messages"></div>' +
      '<button class="ms-jump" id="msJump" type="button" hidden>' + svgIcon("i-arrow-down") + ' New messages</button>' +
      '<div class="ms-reply" id="msReply" hidden></div>' +
      '<div class="chat-gate" id="chatGate" hidden><span></span><button class="btn sm js-signin" type="button">Sign in</button></div>' +
      '<form class="ms-compose" id="chatForm" autocomplete="off">' +
        '<button class="icon-btn flat" id="msAttach" type="button" aria-label="Send a picture" title="Picture">' + svgIcon("i-image") + '</button>' +
        '<textarea id="chatInput" rows="1" maxlength="2000" placeholder="Message 3CS" aria-label="Message"></textarea>' +
        '<button class="icon-btn flat" id="msEmojiBtn" type="button" aria-label="Emoji" title="Emoji">' + svgIcon("i-smile") + '</button>' +
        '<button class="icon-btn flat" id="msStkBtn" type="button" aria-label="Stickers and GIFs" title="Stickers and GIFs">' + svgIcon("i-sticker") + '</button>' +
        '<button class="icon-btn solid ms-send" id="chatSend" type="submit" aria-label="Send" disabled>' + svgIcon("i-send") + '</button>' +
      '</form>' +
      '<div class="ms-picker" id="msPicker" hidden></div>' +
      '<div class="ms-mention" id="msMention" hidden role="listbox" aria-label="Mention someone"></div>' +
    '</section>';

  el("msNew").addEventListener("click", openNewChat);
  el("msExpand").addEventListener("click", function(){ p.classList.toggle("big"); });
  el("msCloseList").addEventListener("click", closeChat);
  el("msSearch").addEventListener("input", function(e){ listQuery = e.target.value; renderList(); });
  el("chatForm").addEventListener("submit", function(e){ e.preventDefault(); submit(); });
  var inp = el("chatInput");
  inp.addEventListener("input", function(){ autosize(); paintSend(); mentionCheck(); });
  inp.addEventListener("keydown", onInputKey);
  inp.addEventListener("paste", function(e){
    var files = Array.prototype.slice.call((e.clipboardData && e.clipboardData.files) || []).filter(function(f){ return /^image\//.test(f.type); });
    if (files.length){ e.preventDefault(); files.slice(0, 4).forEach(function(f){ sendPicture(active, f); }); }
  });
  el("msAttach").addEventListener("click", function(){
    if (!canSendHere()) return;
    pickFiles("image/*", true).then(function(files){ files.slice(0, 4).forEach(function(f){ sendPicture(active, f); }); });
  });
  el("msEmojiBtn").addEventListener("click", function(){ togglePicker("emoji"); });
  el("msStkBtn").addEventListener("click", function(){ togglePicker("stickers"); });
  el("msJump").addEventListener("click", function(){ var l = el("chatList"); l.scrollTop = l.scrollHeight; el("msJump").hidden = true; });
  el("chatList").addEventListener("scroll", function(){
    var l = el("chatList");
    if (l.scrollHeight - l.scrollTop - l.clientHeight < 80) el("msJump").hidden = true;
  }, { passive: true });

  var thread = p.querySelector(".ms-thread");
  ["dragenter", "dragover"].forEach(function(t){ thread.addEventListener(t, function(e){
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") > -1){ e.preventDefault(); thread.classList.add("drop"); }
  }); });
  ["dragleave", "drop"].forEach(function(t){ thread.addEventListener(t, function(){ thread.classList.remove("drop"); }); });
  thread.addEventListener("drop", function(e){
    var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []).filter(function(f){ return /^image\//.test(f.type); });
    if (!files.length) return;
    e.preventDefault();
    files.slice(0, 4).forEach(function(f){ sendPicture(active, f); });
  });
}

/* ------------------------------------------------------------- list --- */
function listItems(){
  var src = adminAll && allConvos ? allConvos : convos;
  var q = listQuery.trim().toLowerCase();
  return Object.keys(src).map(function(cid){ return src[cid]; }).filter(function(c){
    if (q) return convoTitle(c.id).toLowerCase().indexOf(q) > -1;
    if (adminAll) return true;
    var h = prefs.hidden[c.id];
    if (h && !showHidden){
      var at = c.last ? tsOf(c.last) : 0;
      if (!(at > h)) return false;
    }
    return true;
  }).sort(function(a, b){
    var pa = prefs.pinned[a.id] ? 1 : 0, pb = prefs.pinned[b.id] ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return tsOf(b.last || { at: b.updatedAt }) - tsOf(a.last || { at: a.updatedAt });
  });
}
function hiddenCount(){
  return Object.keys(convos).filter(function(cid){
    var h = prefs.hidden[cid]; if (!h) return false;
    var c = convos[cid]; var at = c.last ? tsOf(c.last) : 0;
    return !(at > h);
  }).length;
}
function convoAvatar(c){
  if (!c || c.id === MAIN){
    var a = document.createElement("span");
    a.className = "class-av";
    a.textContent = "3CS";
    a.setAttribute("aria-hidden", "true");
    return a;
  }
  if (c.type === "group"){
    var g = document.createElement("span");
    g.className = "group-av";
    var others = (c.members || []).filter(function(u){ return !BE.user || u !== BE.user.id; }).slice(0, 2);
    if (others.length < 2 && BE.user) others.push(BE.user.id);
    others.forEach(function(u){ g.appendChild(avatarEl(u, dirName(u), "sm")); });
    return g;
  }
  var o = otherOf(c);
  var w = document.createElement("span");
  w.className = "av-wrap";
  var av = avatarEl(o, dirName(o));
  av.style.setProperty("--av", "40px");
  w.appendChild(av);
  if (o && isOnline(o)){ var d = document.createElement("i"); d.className = "online"; w.appendChild(d); }
  return w;
}
function itemEl(cid, title, lastText, when, unread, avatarNode){
  var b = document.createElement("button");
  b.type = "button";
  b.className = "ms-item" + (cid === active ? " on" : "") + (unread ? " unread" : "") + (isMuted(cid) ? " muted" : "");
  b.dataset.cid = cid;
  b.appendChild(avatarNode);
  var body = document.createElement("span");
  body.className = "mi-b";
  body.innerHTML = '<span class="mi-top"><span class="mi-name"></span><span class="mi-time"></span></span><span class="mi-last"><span></span></span>';
  body.querySelector(".mi-name").textContent = title;
  body.querySelector(".mi-time").textContent = when;
  body.querySelector(".mi-last span").textContent = lastText;
  var lastRow = body.querySelector(".mi-last");
  if (prefs.pinned[cid]) lastRow.insertAdjacentHTML("afterbegin", svgIcon("i-pin"));
  if (isMuted(cid)) lastRow.insertAdjacentHTML("beforeend", svgIcon("i-bell-off"));
  if (unread){
    var bd = document.createElement("span");
    bd.className = "mi-badge";
    bd.textContent = unread > 9 ? "9+" : String(unread);
    lastRow.appendChild(bd);
  }
  b.appendChild(body);
  b.setAttribute("aria-label", title + (unread ? ", " + unread + " unread" : ""));
  b.addEventListener("click", function(){ switchTo(cid); showThreadOnPhone(); });
  return b;
}
function renderList(){
  var list = el("msList");
  if (!list) return;
  var foot = el("msSideFoot");
  list.innerHTML = "";

  var q = listQuery.trim().toLowerCase();
  if (!q || "3cs class".indexOf(q) > -1){
    var sec = document.createElement("div"); sec.className = "ms-sec"; sec.textContent = "Class";
    list.appendChild(sec);
    var ms = (state.chat || [])[0];
    list.appendChild(itemEl(MAIN, "3CS class",
      ms ? (ms.uid === me() ? "You: " : displayName(ms.uid, ms.name).split(" ")[0] + ": ") + preview(ms) : "Everyone in the class",
      ms ? shortWhen(tsOf(ms)) : "", isMuted(MAIN) ? 0 : (viewing(MAIN) ? 0 : unreadMain()), convoAvatar(null)));
  }

  var canDM = usingFirebase() && !!BE.user;
  var items = canDM ? listItems() : [];
  var sec2 = document.createElement("div");
  sec2.className = "ms-sec";
  sec2.textContent = adminAll ? "Every chat (admin view)" : "Chats";
  list.appendChild(sec2);
  if (!canDM){
    var p = document.createElement("p");
    p.className = "hint"; p.style.padding = "6px 10px";
    p.textContent = usingFirebase() ? "Sign in to message people one to one, or start a group." : "Private chats need accounts, which this copy doesn't have.";
    list.appendChild(p);
  } else if (!items.length){
    var e = document.createElement("div");
    e.className = "hint";
    e.style.padding = "6px 10px 10px";
    e.innerHTML = q ? "No chats match that." : 'No private chats yet. Start one with the <b>+</b> button, or from someone\'s card in People.';
    list.appendChild(e);
  }
  items.forEach(function(c){
    var l = c.last;
    var who = l ? (BE.user && l.uid === BE.user.id ? "You: " : (c.type === "group" ? (l.name || dirName(l.uid)).split(" ")[0] + ": " : "")) : "";
    list.appendChild(itemEl(c.id, convoTitle(c.id),
      l ? who + (l.text || "") : (c.type === "group" ? (c.members || []).length + " members" : "Say hi"),
      shortWhen(l ? tsOf(l) : tsOf({ at: c.updatedAt })),
      viewing(c.id) ? 0 : convoUnread(c.id), convoAvatar(c)));
  });

  if (foot){
    foot.innerHTML = "";
    var hc = canDM && !adminAll ? hiddenCount() : 0;
    if (hc){
      var hb = document.createElement("button");
      hb.type = "button"; hb.className = "linkbtn muted";
      hb.innerHTML = svgIcon(showHidden ? "i-eye-off" : "i-eye", "sm") + (showHidden ? " Hide hidden chats" : " Show " + hc + " hidden chat" + (hc === 1 ? "" : "s"));
      hb.addEventListener("click", function(){ showHidden = !showHidden; renderList(); });
      foot.appendChild(hb);
    }
    if (canDM && BE.isAdmin){
      var ab = document.createElement("button");
      ab.type = "button"; ab.className = "linkbtn";
      ab.innerHTML = svgIcon("i-shield", "sm") + (adminAll ? " Back to my chats" : " See every chat");
      ab.addEventListener("click", toggleAdminAll);
      foot.appendChild(ab);
    }
    foot.hidden = !foot.children.length;
  }
}

function toggleAdminAll(){
  if (!BE.isAdmin) return;
  adminAll = !adminAll;
  if (adminAll){
    BE.db.collection("convos").limit(200).get().then(function(qs){
      var map = {};
      qs.docs.forEach(function(d){ map[d.id] = Object.assign({ id: d.id }, d.data({ serverTimestamps: "estimate" })); });
      allConvos = map;
      renderList();
    }).catch(function(err){ adminAll = false; toast(dbErrMsg(err), true); renderList(); });
  } else {
    if (active !== MAIN && !convos[active]) switchTo(MAIN);
  }
  renderList();
}

/* ----------------------------------------------------------- thread --- */
function switchTo(cid){
  if (active !== cid){
    reply = null; editing = null;
    closePicker();
    var inp = el("chatInput");
    if (inp && !editing){ inp.value = draftFor(cid); autosize(); paintSend(); }
  }
  saveDraft();
  active = cid;
  dividerAt[cid] = readAt(cid);
  listenConvo(cid);
  var list = el("chatList"); if (list) list.dataset.first = "";
  var inp2 = el("chatInput");
  if (inp2) inp2.value = draftFor(cid);
  autosize(); paintSend();
  renderAll();
  if (viewing(cid)) markRead(cid);
}
var drafts = {};
function draftFor(cid){ return drafts[cid] || ""; }
function saveDraft(){
  var inp = el("chatInput");
  if (inp && !editing) drafts[active] = inp.value;
}
function showThreadOnPhone(){
  var p = el("chatPanel");
  if (p) p.classList.add("show-thread");
}

function canSendHere(){
  if (usingFirebase() && !BE.user){ openAuthSheet(); return false; }
  if (!BE.db){ toast("Chat isn't connected in this view.", true); return false; }
  if (BE.user && isBlocked(BE.user.id)){ toast("An admin has paused your chat for now.", true); return false; }
  if (!isMember(active)){ toast("You're viewing this chat as an admin, so you can't post in it.", true); return false; }
  return true;
}

function renderHead(){
  var h = el("msHead");
  if (!h) return;
  var c = convoOf(active);
  h.innerHTML = "";
  var back = document.createElement("button");
  back.type = "button"; back.className = "icon-btn flat sm ms-back";
  back.setAttribute("aria-label", "Back to chats");
  back.innerHTML = svgIcon("i-arrow-left");
  back.addEventListener("click", function(){ el("chatPanel").classList.remove("show-thread"); });
  h.appendChild(back);
  h.appendChild(convoAvatar(active === MAIN ? null : c));
  var b = document.createElement("div");
  b.className = "mh-b";
  b.innerHTML = "<h3></h3><p></p>";
  b.querySelector("h3").textContent = convoTitle(active);
  var sub = "";
  if (active === MAIN){
    var n = Object.keys(state.directory || {}).length;
    var on = Object.keys(state.directory || {}).filter(isOnline).length;
    sub = (n ? n + " people" : "Everyone in 3CS") + (on ? " · " + on + " active now" : "") ;
  } else if (c && c.type === "group"){
    sub = (c.members || []).map(function(u){ return dirName(u).split(" ")[0]; }).join(", ");
  } else if (c){
    var o = otherOf(c), d = state.directory && state.directory[o];
    sub = d ? seenText(d) || "In 3CS" : "In 3CS";
  }
  b.querySelector("p").textContent = sub;
  h.appendChild(b);

  var act = document.createElement("div");
  act.className = "mh-actions";
  function btn(icon, label, fn, on){
    var x = document.createElement("button");
    x.type = "button"; x.className = "icon-btn flat sm" + (on ? " on" : "");
    x.setAttribute("aria-label", label); x.title = label;
    x.innerHTML = svgIcon(icon);
    x.addEventListener("click", fn);
    act.appendChild(x);
    return x;
  }
  if (BE.user){
    btn(isMuted(active) ? "i-bell-off" : "i-bell", isMuted(active) ? "Unmute this chat" : "Mute this chat", function(){ toggleMute(active); }, isMuted(active));
    if (active !== MAIN && c && c.type === "group") btn("i-people", "People in this group", function(){ openGroupSheet(active); });
    btn("i-more", "More options", function(e){ convoMenu(e.currentTarget); });
  }
  var x = btn("i-close", "Close messages", closeChat);
  x.classList.add("ms-close");
  h.appendChild(act);
}

function renderNotice(){
  var n = el("msNotice");
  if (!n) return;
  var html = "", warn = false;
  if (BE.user && isBlocked(BE.user.id)){
    html = svgIcon("i-shield-x") + "<span>An admin has paused your chat access for now. You can still read messages.</span>"; warn = true;
  } else if (active !== MAIN && !isMember(active)){
    html = svgIcon("i-shield") + "<span>You're viewing this chat as an admin. The people in it can't see that you're here.</span>"; warn = true;
  } else if (active === MAIN){
    html = svgIcon("i-shield") + "<span>Everyone signed in to the Hub can read the class chat. Be kind.</span>";
  } else if (usingFirebase()){
    html = svgIcon("i-shield") + "<span>Only the people in this chat can read it, and the class admins can review chats to keep the Hub safe.</span>";
  }
  n.innerHTML = html;
  n.hidden = !html;
  n.classList.toggle("warn", warn);
}

function messagesFor(cid){
  var rows = cid === MAIN ? (state.chat || []) : (convoMsgs[cid] || []);
  return rows.slice().sort(function(a, b){ return tsOf(a) - tsOf(b); });
}
function loadedFor(cid){ return cid === MAIN ? !!state.chatLoaded : !!convoLoaded[cid]; }

function renderThread(){
  var list = el("chatList");
  if (!list) return;
  paintGate();
  renderHead();
  renderNotice();
  renderReplyBar();
  if (!open) return;

  var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 100;
  var firstPaint = list.dataset.first !== "1";
  var prevHeight = list.scrollHeight;
  var msgs = messagesFor(active);
  list.innerHTML = "";

  if (usingFirebase() && !BE.user){
    list.innerHTML = '<div class="chat-empty">' + svgIcon("i-msg") + '<span class="hand">come say hi</span>The chat is for people signed in to the Hub.</div>';
    return;
  }
  if (!msgs.length && !uploads.some(function(u){ return u.cid === active; })){
    list.innerHTML = '<div class="chat-empty">' + svgIcon("i-msg") +
      (loadedFor(active)
        ? '<span class="hand">it\'s quiet in here</span>' + (active === MAIN ? "Say something to the class." : "Send the first message.")
        : "Loading messages") + '</div>';
    return;
  }

  var myId = me(), lastDay = "", group = null, lastUid = null, lastT = 0;
  var names = mentionNames(active);
  var divider = dividerAt[active] || 0, dividerDone = false;
  msgs.forEach(function(m){
    var t = tsOf(m), day = dayLabel(t);
    if (day !== lastDay){
      var sep = document.createElement("div");
      sep.className = "msg-day"; sep.textContent = day;
      list.appendChild(sep);
      lastDay = day; group = null;
    }
    if (!dividerDone && divider && t > divider && m.uid !== myId){
      dividerDone = true;
      var nd = document.createElement("div");
      nd.className = "msg-new"; nd.textContent = "New";
      list.appendChild(nd);
      group = null;
    }
    if (!group || m.uid !== lastUid || t - lastT > 5 * 60000){
      group = document.createElement("div");
      group.className = "msg-group" + (m.uid === myId ? " me" : "");
      group.appendChild(avatarEl(m.uid, m.name, "sm"));
      var col = document.createElement("div");
      col.className = "msg-col";
      var nm = document.createElement("div");
      nm.className = "msg-name";
      nm.appendChild(document.createTextNode(m.uid === myId ? "You" : displayName(m.uid, m.name)));
      var tm = document.createElement("time");
      tm.textContent = clock(t);
      tm.dateTime = new Date(t).toISOString();
      nm.appendChild(tm);
      col.appendChild(nm);
      group.appendChild(col);
      list.appendChild(group);
    }
    group.querySelector(".msg-col").appendChild(messageEl(m, names));
    lastUid = m.uid; lastT = t;
  });

  uploads.filter(function(u){ return u.cid === active; }).forEach(function(u){
    var g = document.createElement("div");
    g.className = "msg-group me";
    var col = document.createElement("div");
    col.className = "msg-col";
    var w = document.createElement("div");
    w.className = "msg-wrap";
    var bx = document.createElement("div");
    bx.className = "msg-media loading";
    bx.style.width = "180px"; bx.style.aspectRatio = (u.w || 4) + " / " + (u.h || 3);
    if (u.preview){ var im = document.createElement("img"); im.src = u.preview; im.alt = ""; im.style.opacity = ".6"; bx.appendChild(im); }
    w.appendChild(bx);
    col.appendChild(w); g.appendChild(col); list.appendChild(g);
  });

  if (firstPaint || nearBottom){
    list.scrollTop = list.scrollHeight;
    list.dataset.first = "1";
    var j = el("msJump"); if (j) j.hidden = true;
  } else if (list.scrollHeight > prevHeight){
    var j2 = el("msJump"); if (j2) j2.hidden = false;
  }
}

function messageEl(m, names){
  var myId = me();
  var wrap = document.createElement("div");
  wrap.className = "msg-wrap";
  wrap.dataset.id = m.id || "";
  var mine = m.uid === myId;

  if (m.sticker){
    var sk = stickerNodes[m.id] || (stickerNodes[m.id] = (function(){
      var box = document.createElement("div");
      box.className = "msg-sticker";
      box.appendChild(stickerEl(m.sticker));
      return box;
    })());
    wrap.appendChild(sk);
  }
  if (m.media){
    var key = m.media;
    var node = mediaNodes[key] || (mediaNodes[key] = mediaEl(m.media, m.w, m.h, {
      alt: m.mediaKind === "gif" ? "GIF from " + displayName(m.uid, m.name) : "Picture from " + displayName(m.uid, m.name),
      label: m.mediaKind === "gif" ? "Open GIF" : "Open picture"
    }));
    wrap.appendChild(node);
  }
  if (m.text || m.replyTo){
    var bubble = document.createElement("div");
    var big = !m.replyTo && !m.media && isEmojiOnly(m.text);
    bubble.className = "msg" + (m._pending ? " pending" : "") + (big ? " big-emoji" : "") + (!mine && mentionsMe(m.text) ? " mentions-me" : "");
    if (m.replyTo){
      var q = document.createElement("span");
      q.className = "msg-quote";
      q.innerHTML = "<b></b><span></span>";
      q.querySelector("b").textContent = m.replyTo.uid === myId ? "You" : displayName(m.replyTo.uid, m.replyTo.name);
      q.querySelector("span").textContent = m.replyTo.text || "";
      q.addEventListener("click", function(){ jumpTo(m.replyTo.id); });
      bubble.appendChild(q);
    }
    if (m.text) fillText(bubble, String(m.text), names);
    if (m.edited){
      var ed = document.createElement("span");
      ed.className = "edited"; ed.textContent = "(edited)";
      bubble.appendChild(ed);
    }
    wrap.appendChild(bubble);
  }

  var r = m.reactions || {};
  var counts = {}, order = [];
  Object.keys(r).forEach(function(u){
    var e = r[u]; if (!e) return;
    if (!counts[e]){ counts[e] = []; order.push(e); }
    counts[e].push(u);
  });
  if (order.length){
    var rr = document.createElement("div");
    rr.className = "msg-reacts";
    order.forEach(function(e){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "msg-react" + (counts[e].indexOf(myId) > -1 ? " mine" : "");
      b.innerHTML = "<span></span><b></b>";
      b.firstChild.textContent = e;
      b.lastChild.textContent = counts[e].length;
      b.title = counts[e].map(function(u){ return u === myId ? "You" : dirName(u); }).join(", ");
      b.setAttribute("aria-label", e + " from " + b.title + (counts[e].indexOf(myId) > -1 ? ". Tap to remove yours." : ". Tap to add yours."));
      b.addEventListener("click", function(){ react(m, e); });
      rr.appendChild(b);
    });
    wrap.appendChild(rr);
  }

  if (m.id && !m._pending){
    var tools = document.createElement("div");
    tools.className = "msg-tools";
    function tb(html, label, fn, cls){
      var b = document.createElement("button");
      b.type = "button"; b.innerHTML = html; b.setAttribute("aria-label", label); b.title = label;
      if (cls) b.className = cls;
      b.addEventListener("click", function(e){ e.stopPropagation(); fn(e.currentTarget); });
      tools.appendChild(b);
    }
    tb(svgIcon("i-smile"), "React", function(b){ openReactPop(b, m); });
    tb(svgIcon("i-reply"), "Reply", function(){ startReply(m); });
    tb(svgIcon("i-more"), "More", function(b){ msgMenu(b, m); });
    wrap.appendChild(tools);
    /* touch screens: tap a message to show its buttons, hold to react */
    var pressT = null;
    wrap.addEventListener("click", function(e){
      if (!window.matchMedia("(hover: none)").matches) return;
      if (e.target.closest("a, .msg-media, .msg-react, .msg-tools")) return;
      document.querySelectorAll(".msg-wrap.tools").forEach(function(x){ if (x !== wrap) x.classList.remove("tools"); });
      wrap.classList.toggle("tools");
    });
    wrap.addEventListener("touchstart", function(){
      pressT = setTimeout(function(){ openReactPop(wrap, m); }, 480);
    }, { passive: true });
    ["touchend", "touchmove", "touchcancel"].forEach(function(t){ wrap.addEventListener(t, function(){ clearTimeout(pressT); }, { passive: true }); });
    wrap.addEventListener("dblclick", function(e){
      if (e.target.closest("a, .msg-media")) return;
      react(m, "❤️");
    });
  }
  return wrap;
}

function jumpTo(id){
  var t = document.querySelector('#chatList .msg-wrap[data-id="' + CSS.escape(id) + '"]');
  if (!t){ toast("That message is too far back to show here."); return; }
  t.scrollIntoView({ block: "center", behavior: "smooth" });
  t.animate([{ background: "var(--now-soft)" }, { background: "transparent" }], { duration: 1400 });
}

function paintGate(){
  var gate = el("chatGate"), form = el("chatForm");
  if (!gate || !form) return;
  var signedOut = usingFirebase() && !BE.user;
  var noDb = !signedOut && !BE.db;
  var viewer = !signedOut && !noDb && !isMember(active);
  gate.hidden = !(signedOut || noDb);
  form.hidden = signedOut || noDb || viewer;
  var msg = gate.querySelector("span"), b = gate.querySelector("button");
  if (msg) msg.textContent = noDb
    ? (state.dbSettled ? "Chat needs a connection to the Hub's database." : "Connecting")
    : "Sign in to join the conversation.";
  if (b) b.hidden = noDb;
  var inp = el("chatInput");
  if (inp){
    var blocked = BE.user && isBlocked(BE.user.id);
    inp.disabled = !!blocked;
    inp.placeholder = blocked ? "Chat is paused for you" : editing ? "Edit your message" :
      "Message " + (active === MAIN ? "3CS" : convoTitle(active));
  }
}

/* ------------------------------------------------------------ open ---- */
function openChat(cid){
  var p = el("chatPanel");
  if (!p) return;
  build();
  var wasOpen = open;
  open = true;
  p.classList.remove("closing");
  p.hidden = false;
  document.body.classList.add("chat-open");
  var fab = el("chatFab"); if (fab) fab.setAttribute("aria-expanded", "true");
  if (cid){ switchTo(cid); showThreadOnPhone(); }
  else if (!wasOpen){
    dividerAt[active] = readAt(active);
    var l = el("chatList"); if (l) l.dataset.first = "";
    listenConvo(active);
    if (window.matchMedia("(max-width: 900px)").matches) p.classList.remove("show-thread");
  }
  renderAll();
  markRead(active);
  var inp = el("chatInput");
  if (inp && BE.user !== null && window.matchMedia("(hover: hover)").matches) setTimeout(function(){ inp.focus(); }, 80);
}
function closeChat(){
  var p = el("chatPanel");
  if (!p || p.hidden) return;
  saveDraft();
  closePicker();
  open = false;
  p.classList.add("closing");
  document.body.classList.remove("chat-open");
  var fab = el("chatFab"); if (fab) fab.setAttribute("aria-expanded", "false");
  setTimeout(function(){ if (!open){ p.hidden = true; p.classList.remove("closing", "show-thread"); } }, 190);
  if (convoUnsub && active !== MAIN){ /* keep streaming the open DM so notifications stay accurate */ }
  paintBadge();
}
function toggleChat(){ open ? closeChat() : openChat(); }

function renderAll(){
  renderList();
  renderThread();
  renderPeek();
  paintBadge();
}

/* ----------------------------------------------------------- sending -- */
function autosize(){
  var t = el("chatInput");
  if (!t) return;
  t.style.height = "auto";
  t.style.height = Math.min(160, t.scrollHeight + 2) + "px";
}
function paintSend(){
  var t = el("chatInput"), b = el("chatSend");
  if (t && b) b.disabled = !t.value.trim();
}

function sendTo(cid, extra){
  if (usingFirebase() && !BE.user){ openAuthSheet(); return Promise.reject(new Error("signed out")); }
  if (!BE.db){ toast("Chat isn't connected in this view.", true); return Promise.reject(new Error("no db")); }
  if (BE.user && isBlocked(BE.user.id)){ toast("An admin has paused your chat for now.", true); return Promise.reject(new Error("blocked")); }
  var row = {
    uid: me(),
    name: displayName(me(), myName()).slice(0, 40) || "Someone",
    text: extra.text || "",
    createdAt: fbTS()
  };
  ["media", "mediaKind", "w", "h", "sticker", "replyTo"].forEach(function(k){ if (extra[k] !== undefined && extra[k] !== null) row[k] = extra[k]; });
  if (row.w) row.w = Math.round(row.w);
  if (row.h) row.h = Math.round(row.h);

  if (cid === MAIN){
    return BE.db.collection("chat").add(row).catch(function(err){ toast(dbErrMsg(err), true); throw err; });
  }
  var cref = BE.db.collection("convos").doc(cid);
  var mref = cref.collection("messages").doc();
  var last = { uid: row.uid, name: row.name, text: preview(row).slice(0, 160), at: fbTS() };
  if (usingFirebase()){
    var batch = BE.db.batch();
    batch.set(mref, row);
    batch.update(cref, { last: last, updatedAt: fbTS() });
    return batch.commit().catch(function(err){ toast(dbErrMsg(err), true); throw err; });
  }
  return mref.set(row).then(function(){ return cref.update({ last: last, updatedAt: fbTS() }); });
}

function submit(){
  var inp = el("chatInput");
  var text = (inp.value || "").replace(/^\s+|\s+$/g, "");
  if (!text) return;
  if (!canSendHere()) return;
  if (text.length > 2000){ toast("Keep messages under 2,000 characters.", true); return; }

  if (editing){
    var ed = editing;
    editing = null;
    inp.value = draftFor(active);
    autosize(); paintSend(); renderReplyBar(); paintGate();
    if (text === ed.m.text) return;
    msgRef(ed.cid, ed.m.id).update({ text: text, edited: true }).catch(function(err){ toast(dbErrMsg(err), true); });
    return;
  }

  var now = Date.now();
  if (now - lastSend < 700){ toast("Slow down a little.", true); return; }
  lastSend = now;
  var extra = { text: text };
  if (reply) extra.replyTo = reply;
  var cid = active;
  inp.value = ""; drafts[cid] = "";
  reply = null;
  autosize(); paintSend(); renderReplyBar(); closeMention();
  sendTo(cid, extra).catch(function(){
    if (!inp.value){ inp.value = text; autosize(); paintSend(); }
  });
}

function sendPicture(cid, file){
  if (!canSendHere()) return;
  var isGif = file.type === "image/gif";
  var key = "u" + Math.random().toString(36).slice(2);
  var local = URL.createObjectURL(file);
  var up = { key: key, cid: cid, preview: local };
  uploads.push(up);
  renderThread();
  var scope = cid === MAIN ? "hub" : "convo";
  (isGif ? prepareGif(file) : compressImage(file)).then(function(m){
    up.w = m.w; up.h = m.h;
    return uploadMedia(m, scope, cid).then(function(id){
      var extra = { text: "", media: id, mediaKind: m.kind, w: m.w, h: m.h };
      if (reply && active === cid){ extra.replyTo = reply; reply = null; renderReplyBar(); }
      return sendTo(cid, extra);
    });
  }).catch(function(e){
    toast(mediaError(e), true);
  }).then(function(){
    uploads = uploads.filter(function(u){ return u.key !== key; });
    URL.revokeObjectURL(local);
    renderThread();
  });
}

function sendSticker(id){
  if (!canSendHere()) return;
  var extra = { text: "", sticker: id };
  if (reply){ extra.replyTo = reply; reply = null; renderReplyBar(); }
  closePicker();
  sendTo(active, extra);
}

function msgRef(cid, id){
  return cid === MAIN ? BE.db.collection("chat").doc(id) : BE.db.collection("convos").doc(cid).collection("messages").doc(id);
}

/* ------------------------------------------------------- reactions ---- */
function react(m, emoji){
  if (usingFirebase() && !BE.user){ openAuthSheet(); return; }
  if (!BE.db || !m.id) return;
  var uid = me();
  var cur = (m.reactions || {})[uid];
  var ref = msgRef(active, m.id);
  var patch = {};
  if (usingFirebase()){
    patch["reactions." + uid] = cur === emoji ? firebase.firestore.FieldValue.delete() : emoji;
    ref.update(patch).catch(function(err){ toast(dbErrMsg(err), true); });
  } else {
    var inner = {}; inner[uid] = cur === emoji ? null : emoji;
    ref.update({ reactions: inner }).catch(function(err){ toast(dbErrMsg(err), true); });
  }
}
var popEl = null;
function closePop(){
  if (popEl){ popEl.remove(); popEl = null; }
  document.removeEventListener("pointerdown", popOutside, true);
  document.removeEventListener("keydown", popKey, true);
}
function popOutside(e){ if (popEl && !popEl.contains(e.target)) closePop(); }
function popKey(e){ if (e.key === "Escape"){ e.stopPropagation(); closePop(); } }
function placePop(pop, anchor){
  document.body.appendChild(pop);
  var r = anchor.getBoundingClientRect(), pr = pop.getBoundingClientRect();
  var x = Math.min(window.innerWidth - pr.width - 8, Math.max(8, r.left + r.width / 2 - pr.width / 2));
  var y = r.top - pr.height - 8;
  if (y < 8) y = r.bottom + 8;
  pop.style.left = x + "px"; pop.style.top = y + "px";
  popEl = pop;
  setTimeout(function(){
    document.addEventListener("pointerdown", popOutside, true);
    document.addEventListener("keydown", popKey, true);
  }, 0);
  var f = pop.querySelector("button"); if (f) f.focus({ preventScroll: true });
}
function openReactPop(anchor, m){
  closePop();
  var pop = document.createElement("div");
  pop.className = "react-pop";
  pop.setAttribute("role", "menu");
  QUICK.forEach(function(e){
    var b = document.createElement("button");
    b.type = "button"; b.textContent = e; b.setAttribute("aria-label", "React " + e);
    b.addEventListener("click", function(){ closePop(); react(m, e); });
    pop.appendChild(b);
  });
  var more = document.createElement("button");
  more.type = "button"; more.className = "more"; more.setAttribute("aria-label", "More emoji");
  more.innerHTML = svgIcon("i-plus");
  more.addEventListener("click", function(){ closePop(); togglePicker("emoji", function(e){ react(m, e); closePicker(); }); });
  pop.appendChild(more);
  placePop(pop, anchor);
}

/* A small menu anchored to a button. items: [{icon,label,run,danger}] */
function popMenu(anchor, items){
  closePop();
  var pop = document.createElement("div");
  pop.className = "pop-menu";
  pop.setAttribute("role", "menu");
  items.forEach(function(it){
    if (!it) return;
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    if (it.danger) b.className = "danger";
    b.innerHTML = svgIcon(it.icon) + "<span></span>";
    b.lastChild.textContent = it.label;
    b.addEventListener("click", function(){ closePop(); it.run(); });
    pop.appendChild(b);
  });
  placePop(pop, anchor);
}

function msgMenu(anchor, m){
  var mine = m.uid === me();
  var admin = canAdmin();
  var items = [
    { icon: "i-reply", label: "Reply", run: function(){ startReply(m); } },
    m.text ? { icon: "i-copy", label: "Copy text", run: function(){
      if (navigator.clipboard) navigator.clipboard.writeText(m.text).then(function(){ toast("Copied."); }, function(){ toast("Couldn't copy here.", true); });
    } } : null,
    mine && m.text && !m.sticker ? { icon: "i-edit", label: "Edit", run: function(){ startEdit(m); } } : null,
    (mine || admin) ? { icon: "i-trash", label: mine ? "Delete" : "Delete for everyone", danger: true, run: function(){ confirmDelete(anchor, m); } } : null,
    admin && !mine && usingFirebase() ? { icon: isBlocked(m.uid) ? "i-msg" : "i-shield-x", label: (isBlocked(m.uid) ? "Let " : "Time out ") + displayName(m.uid, m.name).split(" ")[0], danger: !isBlocked(m.uid), run: function(){ setBlocked(m.uid, !isBlocked(m.uid)); } } : null
  ];
  popMenu(anchor, items);
}
function confirmDelete(anchor, m){
  popMenu(anchor, [
    { icon: "i-trash", label: "Yes, delete it", danger: true, run: function(){
      msgRef(active, m.id).delete().then(function(){ toast("Deleted."); }).catch(function(err){ toast(dbErrMsg(err), true); });
    } },
    { icon: "i-close", label: "Keep it", run: function(){} }
  ]);
}

/* -------------------------------------------------- reply and edit ---- */
function startReply(m){
  reply = { id: m.id, uid: m.uid, name: displayName(m.uid, m.name).slice(0, 40), text: preview(m).slice(0, 160) };
  editing = null;
  renderReplyBar();
  var inp = el("chatInput"); if (inp) inp.focus();
}
function startEdit(m){
  saveDraft();
  editing = { cid: active, m: m };
  reply = null;
  var inp = el("chatInput");
  inp.value = m.text || "";
  autosize(); paintSend(); renderReplyBar(); paintGate();
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
}
function renderReplyBar(){
  var bar = el("msReply");
  if (!bar) return;
  if (!reply && !editing){ bar.hidden = true; bar.innerHTML = ""; return; }
  bar.hidden = false;
  bar.innerHTML = svgIcon(editing ? "i-edit" : "i-reply") + '<span></span><button type="button" aria-label="Cancel">&times;</button>';
  var s = bar.querySelector("span");
  if (editing){ s.innerHTML = "<b>Editing</b> your message. Press Esc to cancel."; }
  else {
    s.appendChild(document.createTextNode("Replying to "));
    var b = document.createElement("b"); b.textContent = reply.uid === me() ? "yourself" : reply.name; s.appendChild(b);
    s.appendChild(document.createTextNode(": " + reply.text));
  }
  bar.querySelector("button").addEventListener("click", cancelReplyEdit);
}
function cancelReplyEdit(){
  if (editing){
    editing = null;
    var inp = el("chatInput");
    inp.value = draftFor(active); autosize(); paintSend();
  }
  reply = null;
  renderReplyBar(); paintGate();
}

/* ------------------------------------------------------------ keys ---- */
function onInputKey(e){
  if (mentionOpen() && mentionKey(e)) return;
  if (e.key === "Escape"){
    if (!el("msPicker").hidden){ e.preventDefault(); e.stopPropagation(); closePicker(); return; }
    if (reply || editing){ e.preventDefault(); e.stopPropagation(); cancelReplyEdit(); return; }
  }
  if (e.key === "ArrowUp" && !e.target.value){
    var mine = messagesFor(active).filter(function(m){ return m.uid === me() && m.text && !m.sticker; });
    if (mine.length){ e.preventDefault(); startEdit(mine[mine.length - 1]); }
    return;
  }
  if (e.key === "Enter" && !e.isComposing){
    var enterSends = getPref("3cs_enter") === "on";
    if ((enterSends && !e.shiftKey) || e.ctrlKey || e.metaKey){ e.preventDefault(); submit(); }
  }
}

/* ---------------------------------------------------------- mentions -- */
var mentionState = null;
function mentionOpen(){ return !!mentionState; }
function closeMention(){ mentionState = null; var m = el("msMention"); if (m){ m.hidden = true; m.innerHTML = ""; } }
function mentionCheck(){
  var inp = el("chatInput");
  var pos = inp.selectionStart, before = inp.value.slice(0, pos);
  var m = /(^|\s)@([^\s@]{0,20})$/.exec(before);
  if (!m){ closeMention(); return; }
  var q = m[2].toLowerCase();
  var list = mentionNames(active).filter(function(x){ return !BE.user || x.uid !== BE.user.id; })
    .filter(function(x){ return x.name.toLowerCase().split(/\s+/).some(function(w){ return w.indexOf(q) === 0; }) || x.name.toLowerCase().indexOf(q) === 0; })
    .sort(function(a, b){ return a.name.localeCompare(b.name); }).slice(0, 6);
  if (!list.length){ closeMention(); return; }
  mentionState = { start: pos - m[2].length - 1, list: list, i: 0 };
  paintMention();
}
function paintMention(){
  var box = el("msMention");
  box.innerHTML = "";
  mentionState.list.forEach(function(x, i){
    var b = document.createElement("button");
    b.type = "button";
    b.className = i === mentionState.i ? "on" : "";
    b.setAttribute("role", "option");
    b.appendChild(avatarEl(x.uid, x.name, "xs"));
    b.appendChild(document.createTextNode(x.name));
    b.addEventListener("mousedown", function(e){ e.preventDefault(); pickMention(i); });
    box.appendChild(b);
  });
  box.hidden = false;
}
function pickMention(i){
  var inp = el("chatInput"), x = mentionState.list[i];
  var pos = inp.selectionStart;
  inp.value = inp.value.slice(0, mentionState.start) + "@" + x.name + " " + inp.value.slice(pos);
  var np = mentionState.start + x.name.length + 2;
  inp.setSelectionRange(np, np);
  closeMention(); autosize(); paintSend();
  inp.focus();
}
function mentionKey(e){
  if (e.key === "ArrowDown"){ e.preventDefault(); mentionState.i = (mentionState.i + 1) % mentionState.list.length; paintMention(); return true; }
  if (e.key === "ArrowUp"){ e.preventDefault(); mentionState.i = (mentionState.i - 1 + mentionState.list.length) % mentionState.list.length; paintMention(); return true; }
  if (e.key === "Enter" || e.key === "Tab"){ e.preventDefault(); pickMention(mentionState.i); return true; }
  if (e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); closeMention(); return true; }
  return false;
}

/* ------------------------------------------------------------ picker -- */
var pickerTab = null, pickerPick = null;
var gifCache = null;
function closePicker(){
  var p = el("msPicker");
  if (p){ p.hidden = true; p.innerHTML = ""; }
  pickerTab = null; pickerPick = null;
  var a = el("msEmojiBtn"), b = el("msStkBtn");
  if (a) a.classList.remove("on");
  if (b) b.classList.remove("on");
}
function togglePicker(tab, onPick){
  if (pickerTab === tab && !onPick){ closePicker(); return; }
  var p = el("msPicker");
  if (!p) return;
  pickerTab = tab; pickerPick = onPick || null;
  el("msEmojiBtn").classList.toggle("on", tab === "emoji");
  el("msStkBtn").classList.toggle("on", tab !== "emoji");
  p.hidden = false;
  p.innerHTML =
    '<div class="pk-tabs" role="tablist">' +
      '<button type="button" class="pk-tab' + (tab === "emoji" ? " on" : "") + '" data-t="emoji" role="tab">Emoji</button>' +
      (onPick ? "" :
      '<button type="button" class="pk-tab' + (tab === "stickers" ? " on" : "") + '" data-t="stickers" role="tab">Stickers</button>' +
      '<button type="button" class="pk-tab' + (tab === "gifs" ? " on" : "") + '" data-t="gifs" role="tab">GIFs</button>') +
      '<span class="grow"></span>' +
      '<button type="button" class="icon-btn flat sm" id="pkClose" aria-label="Close">' + svgIcon("i-close") + '</button>' +
    '</div><div class="pk-top"></div><div class="pk-body"></div>';
  p.querySelectorAll(".pk-tab").forEach(function(b){ b.addEventListener("click", function(){ togglePicker(b.dataset.t, pickerPick); }); });
  p.querySelector("#pkClose").addEventListener("click", closePicker);
  var top = p.querySelector(".pk-top"), body = p.querySelector(".pk-body");
  if (tab === "emoji") emojiTab(top, body);
  else if (tab === "stickers") stickerTab(body);
  else gifTab(body);
}
function emojiTab(top, body){
  top.innerHTML = '<div class="pk-search"><input type="search" placeholder="Search emoji" aria-label="Search emoji"></div><div class="pk-cats"></div>';
  var search = top.querySelector("input");
  var cats = top.querySelector(".pk-cats");
  CATS.forEach(function(c){
    var b = document.createElement("button");
    b.type = "button"; b.textContent = CAT_ICON[c.name] || c.items[0].e; b.title = c.name;
    b.setAttribute("aria-label", c.name);
    b.addEventListener("click", function(){
      search.value = "";
      panel.paint("");
      var t = body.querySelector("#emo-" + CSS.escape(c.name));
      if (t) body.scrollTop = t.offsetTop - 4;
    });
    cats.appendChild(b);
  });
  var panel = buildEmojiPanel(body, function(e){
    if (pickerPick){ pickerPick(e); return; }
    insertAtCursor(e);
  }, search);
  if (window.matchMedia("(hover: hover)").matches) setTimeout(function(){ search.focus(); }, 30);
}
function insertAtCursor(s){
  var inp = el("chatInput");
  var a = inp.selectionStart != null ? inp.selectionStart : inp.value.length;
  var b = inp.selectionEnd != null ? inp.selectionEnd : inp.value.length;
  inp.value = inp.value.slice(0, a) + s + inp.value.slice(b);
  inp.setSelectionRange(a + s.length, a + s.length);
  autosize(); paintSend();
}
function stickerTab(body){
  body.innerHTML = '<div class="pk-label">Made for the Hub</div>';
  var g = document.createElement("div");
  g.className = "stk-grid";
  STICKERS.forEach(function(s){
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", "Send sticker: " + s.name);
    b.title = s.name;
    b.appendChild(stickerEl(s.id));
    b.addEventListener("click", function(){ sendSticker(s.id); });
    g.appendChild(b);
  });
  body.appendChild(g);
}
function gifTab(body){
  body.innerHTML = '<div class="pk-label">The class GIF library</div>';
  var g = document.createElement("div");
  g.className = "gif-grid";
  body.appendChild(g);
  var up = document.createElement("button");
  up.type = "button"; up.className = "gif-up";
  up.innerHTML = svgIcon("i-plus", "lg") + "<span>Add a GIF</span><small>up to 680 KB</small>";
  up.addEventListener("click", uploadGif);
  g.appendChild(up);
  if (!usingFirebase() || !BE.user){
    body.insertAdjacentHTML("beforeend", '<div class="pk-empty">Sign in to use the GIF library.</div>');
    return;
  }
  function paint(list){
    g.querySelectorAll(".gif-tile").forEach(function(x){ x.remove(); });
    if (!list.length){
      if (!body.querySelector(".pk-empty")) body.insertAdjacentHTML("beforeend", '<div class="pk-empty">No GIFs yet. Add the first one.</div>');
      return;
    }
    var em = body.querySelector(".pk-empty"); if (em) em.remove();
    list.forEach(function(x){
      var t = document.createElement("button");
      t.type = "button"; t.className = "gif-tile";
      t.setAttribute("aria-label", "Send GIF: " + (x.name || "GIF"));
      t.innerHTML = '<img alt="" src="' + esc(x.thumb) + '"><span class="gt-name"></span>';
      t.querySelector(".gt-name").textContent = x.name || "";
      t.addEventListener("click", function(){
        if (!canSendHere()) return;
        closePicker();
        var extra = { text: "", media: x.media, mediaKind: "gif", w: x.w, h: x.h };
        if (reply){ extra.replyTo = reply; reply = null; renderReplyBar(); }
        sendTo(active, extra);
      });
      if (x.uid === me() || canAdmin()){
        var del = document.createElement("span");
        del.className = "gt-x"; del.setAttribute("role", "button"); del.setAttribute("aria-label", "Remove from library");
        del.textContent = "×";
        del.addEventListener("click", function(e){
          e.stopPropagation();
          if (!window.confirm("Remove this GIF from the class library?")) return;
          BE.db.collection("gifs").doc(x.id).delete().then(function(){
            gifCache = (gifCache || []).filter(function(y){ return y.id !== x.id; });
            paint(gifCache);
          }).catch(function(err){ toast(dbErrMsg(err), true); });
        });
        t.appendChild(del);
      }
      g.appendChild(t);
    });
  }
  if (gifCache) paint(gifCache);
  BE.db.collection("gifs").orderBy("createdAt", "desc").limit(60).get().then(function(qs){
    gifCache = qs.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); });
    if (pickerTab === "gifs") paint(gifCache);
  }).catch(function(){ if (!gifCache) paint([]); });
}
function uploadGif(){
  if (!canSendHere()) return;
  pickFiles("image/gif", false).then(function(files){
    var f = files[0];
    if (!f) return;
    var name = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 40) || "GIF";
    toast("Adding " + name + "…");
    prepareGif(f).then(function(m){
      return uploadMedia(m, "hub").then(function(id){
        var row = { uid: me(), name: name, media: id, thumb: m.thumb, w: m.w, h: m.h, createdAt: fbTS() };
        return BE.db.collection("gifs").add(row).then(function(ref){
          gifCache = [Object.assign({ id: ref.id }, row, { createdAt: new Date().toISOString() })].concat(gifCache || []);
          closePicker();
          return sendTo(active, { text: "", media: id, mediaKind: "gif", w: m.w, h: m.h });
        });
      });
    }).then(function(){ toast("Added to the class GIF library."); }).catch(function(e){ toast(mediaError(e), true); });
  });
}

/* ------------------------------------------------------ conversations -- */
function sortedPair(a, b){ return a < b ? [a, b] : [b, a]; }
function openDM(uid){
  if (usingFirebase() && !BE.user){ openAuthSheet(); return; }
  if (!usingFirebase()){ toast("Private chats need accounts, which this copy doesn't have.", true); return; }
  if (!uid || uid === BE.user.id) return;
  var pair = sortedPair(BE.user.id, uid);
  var cid = "dm_" + pair[0] + "_" + pair[1];
  if (convos[cid]){ openChat(cid); return; }
  var ref = BE.db.collection("convos").doc(cid);
  ref.get().then(function(s){
    if (s.exists){ convos[cid] = Object.assign({ id: cid }, s.data({ serverTimestamps: "estimate" })); return; }
    return ref.set({ type: "dm", members: pair, createdBy: BE.user.id, createdAt: fbTS(), updatedAt: fbTS() }).then(function(){
      convos[cid] = { id: cid, type: "dm", members: pair, createdBy: BE.user.id, updatedAt: new Date().toISOString() };
    });
  }).then(function(){
    if (prefs.hidden[cid]) setPref("hidden", cid, false);
    openChat(cid);
  }).catch(function(err){ toast(dbErrMsg(err), true); });
}
function randomId(n){
  var a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", s = "";
  var buf = new Uint8Array(n);
  (window.crypto || window.msCrypto).getRandomValues(buf);
  for (var i = 0; i < n; i++) s += a[buf[i] % a.length];
  return s;
}
function createGroup(name, uids){
  var members = [BE.user.id].concat(uids.filter(function(u){ return u !== BE.user.id; }));
  var cid = "g_" + randomId(16);
  var row = { type: "group", name: name.slice(0, 60), members: members, createdBy: BE.user.id, createdAt: fbTS(), updatedAt: fbTS() };
  return BE.db.collection("convos").doc(cid).set(row).then(function(){
    convos[cid] = Object.assign({ id: cid }, row, { updatedAt: new Date().toISOString() });
    return cid;
  });
}

/* People picker, shared by "new chat", "add people" and groups from People. */
function peoplePicker(box, exclude, preselect){
  var chosen = {};
  (preselect || []).forEach(function(u){ chosen[u] = true; });
  var wrap = document.createElement("div");
  wrap.innerHTML = '<label class="search" style="max-width:none">' + svgIcon("i-search") + '<input type="search" placeholder="Search people" aria-label="Search people"></label><div class="pp-list"></div>';
  var list = wrap.querySelector(".pp-list"), q = wrap.querySelector("input");
  function paint(){
    list.innerHTML = "";
    var term = q.value.trim().toLowerCase();
    var rows = people().filter(function(p){
      if (BE.user && p.uid === BE.user.id) return false;
      if (exclude && exclude.indexOf(p.uid) > -1) return false;
      return !term || dirName(p.uid).toLowerCase().indexOf(term) > -1;
    });
    if (!rows.length){ list.innerHTML = '<p class="hint" style="padding:10px">' + (term ? "No one matches that." : "No one else has signed in yet.") + '</p>'; return; }
    rows.forEach(function(p){
      var r = document.createElement("label");
      r.className = "pp-row";
      var av = document.createElement("span"); av.className = "av-wrap";
      av.appendChild(avatarEl(p.uid, dirName(p.uid), "md"));
      if (isOnline(p.uid)){ var d = document.createElement("i"); d.className = "online"; av.appendChild(d); }
      r.appendChild(av);
      var t = document.createElement("span");
      t.innerHTML = "<b></b><small></small>";
      t.querySelector("b").textContent = dirName(p.uid);
      t.querySelector("small").textContent = seenText(p) || "";
      r.appendChild(t);
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = !!chosen[p.uid];
      cb.setAttribute("aria-label", "Choose " + dirName(p.uid));
      cb.addEventListener("change", function(){ if (cb.checked) chosen[p.uid] = true; else delete chosen[p.uid]; if (wrap.onchange2) wrap.onchange2(); });
      r.appendChild(cb);
      list.appendChild(r);
    });
  }
  q.addEventListener("input", paint);
  paint();
  box.appendChild(wrap);
  return { chosen: function(){ return Object.keys(chosen); }, onChange: function(fn){ wrap.onchange2 = fn; } };
}

function openNewChat(preselect){
  if (usingFirebase() && !BE.user){ openAuthSheet(); return; }
  if (!usingFirebase()){ toast("Private chats need accounts, which this copy doesn't have.", true); return; }
  var box = openSheet(
    '<div class="sheet-head"><div><h2>New chat</h2><p class="hint">Pick one person for a private chat, or a few for a group.</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +
    '<div id="ncPick"></div>' +
    '<label class="field" id="ncNameF" hidden style="margin-top:14px"><span>Group name</span><input id="ncName" maxlength="60" placeholder="e.g. S&T project team"></label>' +
    '<div class="sheet-actions"><button class="btn" id="ncGo" type="button" disabled>Start chat</button></div>'
  );
  var pk = peoplePicker(box.querySelector("#ncPick"), null, Array.isArray(preselect) ? preselect : null);
  var go = box.querySelector("#ncGo"), nf = box.querySelector("#ncNameF"), nm = box.querySelector("#ncName");
  function paint(){
    var n = pk.chosen().length;
    go.disabled = !n;
    nf.hidden = n < 2;
    go.textContent = n < 2 ? "Start chat" : "Start group with " + n + " people";
  }
  pk.onChange(paint); paint();
  go.addEventListener("click", function(){
    var ids = pk.chosen();
    if (ids.length === 1){ closeSheet(); openDM(ids[0]); return; }
    var name = nm.value.trim() || ids.map(function(u){ return dirName(u).split(" ")[0]; }).slice(0, 3).join(", ") + (ids.length > 3 ? " +" + (ids.length - 3) : "");
    go.disabled = true; go.textContent = "Creating";
    createGroup(name, ids).then(function(cid){ closeSheet(); openChat(cid); toast("Group started."); })
      .catch(function(err){ go.disabled = false; paint(); toast(dbErrMsg(err), true); });
  });
}
function newGroupWith(ids){ openNewChat(ids); }

function openGroupSheet(cid){
  var c = convoOf(cid);
  if (!c || c.type !== "group") return;
  var mine = BE.user && c.createdBy === BE.user.id;
  var box = openSheet(
    '<div class="sheet-head"><div><h2>Group</h2><p class="hint">' + (c.members || []).length + ' members</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +
    '<label class="field"><span>Name</span><div style="display:flex;gap:8px"><input id="gsName" maxlength="60"><button class="btn ghost sm" id="gsRename" type="button">Rename</button></div></label>' +
    '<div class="set-sec" style="margin-top:14px"><h3>Members</h3><div id="gsMembers"></div>' +
    '<button class="btn ghost sm" id="gsAdd" type="button" style="margin-top:10px">' + svgIcon("i-user-plus") + ' Add people</button><div id="gsAddBox"></div></div>' +
    '<div class="sheet-actions">' +
      (mine || canAdmin() ? '<button class="btn ghost sm danger" id="gsDelete" type="button">' + svgIcon("i-trash") + ' Delete group</button>' : '') +
      (isMember(cid) ? '<button class="btn ghost sm" id="gsLeave" type="button">' + svgIcon("i-door") + ' Leave group</button>' : '') +
    '</div>'
  );
  var nameIn = box.querySelector("#gsName");
  nameIn.value = c.name || "";
  box.querySelector("#gsRename").addEventListener("click", function(){
    var v = nameIn.value.trim();
    if (!v){ toast("Give the group a name.", true); return; }
    BE.db.collection("convos").doc(cid).update({ name: v.slice(0, 60), updatedAt: fbTS() })
      .then(function(){ toast("Renamed."); }).catch(function(err){ toast(dbErrMsg(err), true); });
  });
  var mem = box.querySelector("#gsMembers");
  (c.members || []).forEach(function(u){
    var r = document.createElement("div");
    r.className = "member-row";
    r.appendChild(avatarEl(u, dirName(u), "md"));
    var t = document.createElement("div"); t.className = "grow";
    t.innerHTML = "<b></b><small></small>";
    t.querySelector("b").textContent = dirName(u) + (BE.user && u === BE.user.id ? " (you)" : "");
    t.querySelector("small").textContent = u === c.createdBy ? "Started the group" : "";
    r.appendChild(t);
    if ((mine || canAdmin()) && BE.user && u !== BE.user.id){
      var rm = document.createElement("button");
      rm.type = "button"; rm.className = "linkbtn danger"; rm.textContent = "Remove";
      rm.addEventListener("click", function(){
        var next = (c.members || []).filter(function(x){ return x !== u; });
        BE.db.collection("convos").doc(cid).update({ members: next, updatedAt: fbTS() })
          .then(function(){ c.members = next; r.remove(); toast(dirName(u) + " removed."); })
          .catch(function(err){ toast(dbErrMsg(err), true); });
      });
      r.appendChild(rm);
    }
    mem.appendChild(r);
  });
  box.querySelector("#gsAdd").addEventListener("click", function(){
    var ab = box.querySelector("#gsAddBox");
    if (ab.children.length) return;
    var pk = peoplePicker(ab, c.members || []);
    var go = document.createElement("button");
    go.type = "button"; go.className = "btn sm"; go.textContent = "Add to group"; go.style.marginTop = "10px";
    go.addEventListener("click", function(){
      var add = pk.chosen();
      if (!add.length) return;
      var next = (c.members || []).concat(add.filter(function(u){ return (c.members || []).indexOf(u) < 0; }));
      BE.db.collection("convos").doc(cid).update({ members: next, updatedAt: fbTS() })
        .then(function(){ closeSheet(); toast("Added."); }).catch(function(err){ toast(dbErrMsg(err), true); });
    });
    ab.appendChild(go);
  });
  var lv = box.querySelector("#gsLeave");
  if (lv) lv.addEventListener("click", function(){
    if (!window.confirm("Leave this group? You'll stop getting its messages.")) return;
    var next = (c.members || []).filter(function(x){ return x !== BE.user.id; });
    var p = next.length
      ? BE.db.collection("convos").doc(cid).update({ members: next, updatedAt: fbTS() })
      : BE.db.collection("convos").doc(cid).delete();
    p.then(function(){ closeSheet(); switchTo(MAIN); toast("You left the group."); }).catch(function(err){ toast(dbErrMsg(err), true); });
  });
  var dl = box.querySelector("#gsDelete");
  if (dl) dl.addEventListener("click", function(){
    if (!window.confirm("Delete this group for everyone in it?")) return;
    BE.db.collection("convos").doc(cid).delete()
      .then(function(){ closeSheet(); delete convos[cid]; switchTo(MAIN); toast("Group deleted."); })
      .catch(function(err){ toast(dbErrMsg(err), true); });
  });
}

/* ------------------------------------------------------- your prefs ---- */
function savePrefs(){
  if (!usingFirebase() || !BE.user) return;
  BE.db.doc("users/" + BE.user.id + "/prefs/chat").set({ muted: prefs.muted, hidden: prefs.hidden, pinned: prefs.pinned })
    .catch(function(err){ toast(dbErrMsg(err), true); });
}
function setPref(kind, cid, value){
  var map = prefs[kind] = Object.assign({}, prefs[kind]);
  if (value) map[cid] = value; else delete map[cid];
  savePrefs();
  renderAll();
}
function toggleMute(cid){
  var on = !isMuted(cid);
  setPref("muted", cid, on);
  toast(on ? "Muted. No pop-ups or badges from " + convoTitle(cid) + ", except @mentions." : "Unmuted.");
}
function convoMenu(anchor){
  var cid = active;
  var items = [];
  if (cid !== MAIN){
    items.push({ icon: "i-pin", label: prefs.pinned[cid] ? "Unpin" : "Pin to top", run: function(){ setPref("pinned", cid, !prefs.pinned[cid]); } });
    items.push({ icon: "i-eye-off", label: "Hide this chat", run: function(){
      setPref("hidden", cid, Date.now());
      switchTo(MAIN);
      toast("Hidden. It comes back if someone sends a new message.");
    } });
    var c = convoOf(cid);
    if (c && c.type === "group") items.push({ icon: "i-settings", label: "Group settings", run: function(){ openGroupSheet(cid); } });
    if (c && c.type === "dm"){
      var o = otherOf(c);
      items.push({ icon: "i-people", label: "See in People", run: function(){
        closeChat();
        var t = document.querySelector('nav.tabs button[data-tab="people"]'); if (t) t.click();
        var s = el("peopleSearch"); if (s){ s.value = dirName(o); s.dispatchEvent(new Event("input")); }
      } });
    }
    if (canAdmin()) items.push({ icon: "i-trash", label: "Delete chat (admin)", danger: true, run: function(){
      if (!window.confirm("Delete this whole conversation for everyone in it?")) return;
      BE.db.collection("convos").doc(cid).delete().then(function(){ delete convos[cid]; if (allConvos) delete allConvos[cid]; switchTo(MAIN); toast("Deleted."); })
        .catch(function(err){ toast(dbErrMsg(err), true); });
    } });
  } else {
    items.push({ icon: "i-user-plus", label: "Start a private chat", run: openNewChat });
    if (canAdmin()) items.push({ icon: "i-shield", label: "Moderation", run: openModeration });
  }
  popMenu(anchor, items);
}

/* ------------------------------------------------------- moderation ---- */
function setBlocked(uid, on){
  if (!canAdmin() || !usingFirebase()) return Promise.resolve();
  var FV = firebase.firestore.FieldValue;
  return BE.db.doc("config/moderation").set({
    chatBlocked: on ? FV.arrayUnion(uid) : FV.arrayRemove(uid),
    updatedAt: new Date().toISOString()
  }, { merge: true }).then(function(){
    toast(on ? dirName(uid) + " can't send messages until you let them back." : dirName(uid) + " can chat again.");
  }).catch(function(err){ toast(dbErrMsg(err), true); });
}
function openModeration(){
  if (!canAdmin()){ toast("Admins only.", true); return; }
  var box = openSheet(
    '<div class="sheet-head"><div><h2>Moderation</h2><p class="hint">Owners and admins can read every chat, delete any message, and pause someone\'s chat access.</p></div>' +
    '<button class="sheet-close" type="button" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +
    '<div class="set-sec"><h3>Chat access</h3><div id="modList"></div></div>' +
    '<div class="set-sec"><h3>Conversations</h3><p class="hint">See every private and group chat from the chat list. The people in them aren\'t told.</p>' +
    '<div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" id="modAll" type="button">' + svgIcon("i-msg") + ' Open every chat</button></div></div>'
  );
  box.classList.add("wide");
  var list = box.querySelector("#modList");
  var rows = people().filter(function(p){ return !BE.user || p.uid !== BE.user.id; });
  if (!rows.length) list.innerHTML = '<p class="hint">No one else has signed in yet.</p>';
  rows.forEach(function(p){
    var r = document.createElement("div");
    r.className = "set-row";
    var left = document.createElement("div");
    left.style.display = "flex"; left.style.alignItems = "center"; left.style.gap = "10px";
    left.appendChild(avatarEl(p.uid, dirName(p.uid), "md"));
    var t = document.createElement("div");
    t.innerHTML = "<b></b><small></small>";
    t.querySelector("b").textContent = dirName(p.uid);
    t.querySelector("small").textContent = isBlocked(p.uid) ? "Timed out from chat" : "Can chat";
    left.appendChild(t);
    r.appendChild(left);
    var sw = document.createElement("input");
    sw.type = "checkbox"; sw.className = "switch"; sw.checked = !isBlocked(p.uid);
    sw.setAttribute("aria-label", "Let " + dirName(p.uid) + " send messages");
    sw.addEventListener("change", function(){
      setBlocked(p.uid, !sw.checked).then(function(){ t.querySelector("small").textContent = sw.checked ? "Can chat" : "Timed out from chat"; });
    });
    r.appendChild(sw);
    list.appendChild(r);
  });
  box.querySelector("#modAll").addEventListener("click", function(){
    closeSheet();
    openChat();
    if (!adminAll) toggleAdminAll();
  });
}

/* ---------------------------------------------- Today: chat preview --- */
function renderPeek(){
  var list = el("peekList");
  if (!list) return;
  var form = el("peekForm");
  list.innerHTML = "";
  if (usingFirebase() && !BE.user){
    list.innerHTML = '<div class="peek-empty">Sign in to see what the class is saying.</div><button class="btn sm js-signin" type="button">Sign in</button>';
    if (form) form.hidden = true;
    return;
  }
  if (form) form.hidden = !BE.db;
  var rows = (state.chat || []).slice(0, 5).reverse();
  if (!rows.length){
    list.innerHTML = '<div class="peek-empty">' + (state.chatLoaded ? "No messages yet. Say hi." : "Loading") + '</div>';
    return;
  }
  rows.forEach(function(m){
    var r = document.createElement("div");
    r.className = "peek-row";
    r.appendChild(avatarEl(m.uid, m.name, "sm"));
    var b = document.createElement("div");
    b.className = "pr-b";
    b.innerHTML = '<div class="pr-n"><span></span><time></time></div><div class="pr-t"></div>';
    b.querySelector(".pr-n span").textContent = m.uid === me() ? "You" : displayName(m.uid, m.name);
    b.querySelector("time").textContent = shortWhen(tsOf(m));
    b.querySelector(".pr-t").textContent = preview(m);
    r.appendChild(b);
    list.appendChild(r);
  });
  var sub = el("peekSub");
  if (sub){
    var on = Object.keys(state.directory || {}).filter(isOnline).length;
    sub.textContent = on ? on + " active now" : "What 3CS is talking about";
  }
}

/* --------------------------------------------------------------- init -- */
function initChat(){
  var fab = el("chatFab");
  if (fab) fab.addEventListener("click", toggleChat);
  var po = el("peekOpen");
  if (po) po.addEventListener("click", function(){ openChat(MAIN); });
  var pf = el("peekForm");
  if (pf) pf.addEventListener("submit", function(e){
    e.preventDefault();
    var i = el("peekInput"), v = (i.value || "").trim();
    if (!v) return;
    if (usingFirebase() && !BE.user){ openAuthSheet(); return; }
    i.value = "";
    sendTo(MAIN, { text: v }).catch(function(){ i.value = v; });
  });
  document.addEventListener("keydown", function(e){
    if (e.key !== "Escape" || !open) return;
    if (document.querySelector(".sheet:not([hidden]), #palette:not([hidden]), .lightbox, .react-pop, .pop-menu")) return;
    if (el("msPicker") && !el("msPicker").hidden){ closePicker(); return; }
    closeChat();
  });
  document.addEventListener("visibilitychange", function(){
    if (!document.hidden && open){ markRead(active); renderList(); }
  });
  onProfiles(function(){ if (open) renderAll(); else renderPeek(); });
  registerCommands(function(){
    var out = [{ kind:"Do", title:"Open messages", hint:"the class chat and your private chats", run:function(){ openChat(); } }];
    if (usingFirebase() && BE.user) out.push({ kind:"Do", title:"Start a new chat", hint:"private or group", run:openNewChat });
    if (canAdmin()) out.push({ kind:"Do", title:"Moderation", hint:"chat access, every chat", run:openModeration });
    return out;
  });
  state.chat = state.chat || [];
  renderPeek();
  paintBadge();
  setInterval(function(){ if (open) renderList(); }, 60000);
}

export { initChat, openChat, closeChat, renderChat, setChat, tsOf, openDM, newGroupWith, isBlocked, setBlocked, openModeration };
function renderChat(){ renderAll(); }
