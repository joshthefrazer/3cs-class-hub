import { BE, canAdmin, dbErrMsg, meId, myName, toast, usingFirebase } from "./backend.js";
import { state } from "./state.js";
import { safeUrl } from "./text.js";
import { avatarEl, displayName, onProfiles } from "./profile.js";
import { registerCommands } from "./palette.js";
import { openAuthSheet } from "./auth.js";

/* =========================================================
   CLASS CHAT — one room for 3CS.

   chat/{id}  { uid, name, text, createdAt }
   The newest 50 messages are streamed; each new message costs every open
   Hub one read, which for a class of ten is nothing against the free
   plan. The rules make sure a message is signed with the sender's own
   account and stamped with the server's clock, so nobody can post as
   someone else or backdate a message. You can delete your own; admins can
   delete anything.
   ========================================================= */

var LIMIT = 50;
var SEEN_KEY = "3cs_chat_seen";
var open = false;
var lastSend = 0;

function el(id){ return document.getElementById(id); }

function tsOf(m){
  var v = m && m.createdAt;
  if (!v) return m && m._local ? m._local : Date.now();
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  var t = Date.parse(v);
  return isNaN(t) ? Date.now() : t;
}
function seenAt(){ try{ return parseInt(localStorage.getItem(SEEN_KEY) || "0", 10) || 0; }catch(e){ return 0; } }
function markSeen(){
  var msgs = state.chat || [];
  var newest = msgs.length ? Math.max.apply(null, msgs.map(tsOf)) : Date.now();
  try{ localStorage.setItem(SEEN_KEY, String(Math.max(newest, seenAt()))); }catch(e){}
  paintBadge();
}

function paintBadge(){
  var b = el("chatBadge");
  if (!b) return;
  var me = meId(), since = seenAt();
  var n = open ? 0 : (state.chat || []).filter(function(m){ return m.uid !== me && tsOf(m) > since; }).length;
  b.hidden = !n;
  b.textContent = n > 9 ? "9+" : String(n);
  var fab = el("chatFab");
  if (fab) fab.setAttribute("aria-label", n ? "Open class chat, " + n + " new" : "Open class chat");
}

/* Text with bare links turned into real ones — only http(s), and always
   built as DOM nodes, so nothing typed can become markup. */
function fillText(node, text){
  var re = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi, last = 0, m;
  while ((m = re.exec(text))){
    if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
    var href = safeUrl(m[0]);
    if (href){
      var a = document.createElement("a");
      a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer nofollow";
      a.textContent = m[0];
      node.appendChild(a);
    } else {
      node.appendChild(document.createTextNode(m[0]));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
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
function clock(t){ return new Date(t).toLocaleTimeString(undefined, { hour:"numeric", minute:"2-digit" }); }

function renderChat(){
  var list = el("chatList");
  if (!list) return;
  paintGate();
  paintFaces();
  paintBadge();
  if (!open) return;           // nothing to draw while it's closed

  var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
  var msgs = (state.chat || []).slice().sort(function(a, b){ return tsOf(a) - tsOf(b); });
  list.innerHTML = "";

  if (usingFirebase() && !BE.user){
    list.innerHTML = '<div class="chat-empty"><svg class="ic" aria-hidden="true"><use href="#i-msg"></use></svg>The class chat is for people signed in to the Hub.</div>';
    return;
  }
  if (!msgs.length){
    list.innerHTML = '<div class="chat-empty"><svg class="ic" aria-hidden="true"><use href="#i-msg"></use></svg>' +
      (state.chatLoaded ? "No messages yet. Say hi to the class." : "Loading messages…") + '</div>';
    return;
  }

  var me = meId(), lastDay = "", group = null, lastUid = null, lastT = 0;
  msgs.forEach(function(m){
    var t = tsOf(m), day = dayLabel(t);
    if (day !== lastDay){
      var sep = document.createElement("div");
      sep.className = "msg-day"; sep.textContent = day;
      list.appendChild(sep);
      lastDay = day; group = null;
    }
    if (!group || m.uid !== lastUid || t - lastT > 5 * 60000){
      group = document.createElement("div");
      group.className = "msg-group" + (m.uid === me ? " me" : "");
      group.appendChild(avatarEl(m.uid, m.name, "sm"));
      var col = document.createElement("div");
      col.className = "msg-col";
      var nm = document.createElement("div");
      nm.className = "msg-name";
      nm.textContent = m.uid === me ? "You" : displayName(m.uid, m.name);
      var tm = document.createElement("time");
      tm.textContent = clock(t);
      tm.dateTime = new Date(t).toISOString();
      nm.appendChild(tm);
      col.appendChild(nm);
      group.appendChild(col);
      list.appendChild(group);
    }
    var bubble = document.createElement("div");
    bubble.className = "msg" + (m._pending ? " pending" : "");
    fillText(bubble, String(m.text || ""));
    if (m.id && (m.uid === me || canAdmin())){
      var del = document.createElement("button");
      del.type = "button"; del.className = "msg-del"; del.innerHTML = "&times;";
      del.setAttribute("aria-label", "Delete this message");
      del.addEventListener("click", function(){ removeMsg(m); });
      bubble.appendChild(del);
    }
    group.querySelector(".msg-col").appendChild(bubble);
    lastUid = m.uid; lastT = t;
  });

  if (nearBottom || list.dataset.first !== "1"){
    list.scrollTop = list.scrollHeight;
    list.dataset.first = "1";
  }
}

function paintFaces(){
  var f = el("chatFaces");
  if (!f) return;
  var seen = [], out = [];
  (state.chat || []).slice().sort(function(a, b){ return tsOf(b) - tsOf(a); }).forEach(function(m){
    if (seen.indexOf(m.uid) < 0 && out.length < 4){ seen.push(m.uid); out.push(m); }
  });
  f.innerHTML = "";
  out.forEach(function(m){ f.appendChild(avatarEl(m.uid, m.name)); });
  var sub = el("chatSub");
  if (sub){
    var today = (state.chat || []).filter(function(m){ return dayLabel(tsOf(m)) === "Today"; });
    var people = {};
    today.forEach(function(m){ people[m.uid] = 1; });
    var n = Object.keys(people).length;
    sub.textContent = n ? n + (n === 1 ? " person" : " people") + " chatting today · be kind" : "Everyone in 3CS · be kind";
  }
}

function paintGate(){
  var gate = el("chatGate"), form = el("chatForm");
  if (!gate || !form) return;
  var signedOut = usingFirebase() && !BE.user;
  var noDb = !signedOut && !BE.db;
  gate.hidden = !(signedOut || noDb);
  form.hidden = signedOut || noDb;
  var msg = gate.querySelector("span"), b = gate.querySelector("button");
  if (msg) msg.textContent = noDb
    ? (state.dbSettled ? "Chat needs a connection to the Hub's database." : "Connecting…")
    : "Sign in to join the conversation.";
  if (b) b.hidden = noDb;
}

function openChat(){
  var p = el("chatPanel");
  if (!p) return;
  open = true;
  p.classList.remove("closing");
  p.hidden = false;
  document.body.classList.add("chat-open");
  if (window.matchMedia("(max-width: 980px)").matches) document.body.classList.add("chat-open-m");
  var fab = el("chatFab"); if (fab) fab.setAttribute("aria-expanded", "true");
  var list = el("chatList"); if (list) list.dataset.first = "";
  renderChat();
  markSeen();
  var inp = el("chatInput");
  if (inp && !(usingFirebase() && !BE.user) && window.matchMedia("(hover: hover)").matches) setTimeout(function(){ inp.focus(); }, 80);
}
function closeChat(){
  var p = el("chatPanel");
  if (!p || p.hidden) return;
  open = false;
  markSeen();
  p.classList.add("closing");
  document.body.classList.remove("chat-open", "chat-open-m");
  var fab = el("chatFab"); if (fab){ fab.setAttribute("aria-expanded", "false"); }
  setTimeout(function(){ if (!open){ p.hidden = true; p.classList.remove("closing"); } }, 200);
  if (fab) fab.focus({ preventScroll:true });
}
function toggleChat(){ open ? closeChat() : openChat(); }

function send(e){
  if (e) e.preventDefault();
  var inp = el("chatInput");
  var text = (inp.value || "").replace(/\s+$/g, "").replace(/^\s+/g, "");
  if (!text) return;
  if (usingFirebase() && !BE.user){ openAuthSheet(); return; }
  if (!BE.db){ toast("Chat isn't connected in this view.", true); return; }
  if (text.length > 800){ toast("That's a long one — keep messages under 800 characters.", true); return; }
  var now = Date.now();
  if (now - lastSend < 1200){ toast("Slow down a little.", true); return; }
  lastSend = now;

  var row = {
    uid: meId(),
    name: displayName(meId(), myName()).slice(0, 40),
    text: text,
    createdAt: usingFirebase() ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
  };
  inp.value = "";
  autosize();
  paintSend();
  BE.db.collection("chat").add(row).catch(function(err){
    inp.value = text; autosize(); paintSend();
    toast(dbErrMsg(err), true);
  });
}

function removeMsg(m){
  if (!window.confirm(m.uid === meId() ? "Delete your message?" : "Delete this message for everyone?")) return;
  BE.db.doc("chat/" + m.id).delete().catch(function(err){ toast(dbErrMsg(err), true); });
}

function autosize(){
  var t = el("chatInput");
  if (!t) return;
  t.style.height = "auto";
  t.style.height = Math.min(140, t.scrollHeight + 2) + "px";
}
function paintSend(){
  var t = el("chatInput"), b = el("chatSend");
  if (t && b) b.disabled = !t.value.trim();
}

/* Called by the backend's stream with the latest page of messages. */
function setChat(rows){
  var before = (state.chat || []).length;
  state.chat = rows;
  state.chatLoaded = true;
  renderChat();
  if (open) markSeen();
  else if (rows.length > before && before){
    var fab = el("chatFab");
    if (fab && fab.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      fab.animate([{ transform:"scale(1)" }, { transform:"scale(1.12) rotate(-4deg)" }, { transform:"scale(1)" }],
                  { duration: 450, easing: "cubic-bezier(.34,1.56,.64,1)" });
    }
  }
}

function initChat(){
  var fab = el("chatFab"), close = el("chatClose"), form = el("chatForm"), inp = el("chatInput");
  if (fab) fab.addEventListener("click", toggleChat);
  if (close) close.addEventListener("click", closeChat);
  if (form) form.addEventListener("submit", send);
  if (inp){
    inp.addEventListener("input", function(){ autosize(); paintSend(); });
    inp.addEventListener("keydown", function(e){
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); send(); }
    });
  }
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && open){
      var sheetOpen = document.querySelector(".sheet:not([hidden]), #palette:not([hidden])");
      if (!sheetOpen) closeChat();
    }
  });
  onProfiles(renderChat);
  registerCommands(function(){
    return [{ kind:"Do", title:"Open the class chat", hint:"message everyone in 3CS", run:openChat }];
  });
  state.chat = state.chat || [];
  renderChat();
}

export { initChat, openChat, closeChat, renderChat, setChat, tsOf };
