import { avatarEl } from "./profile.js";
import { getPref } from "./settings.js";
import { svgIcon } from "./text.js";

/* =========================================================
   SIDE NOTIFICATIONS - "what's up" cards for new messages.

   When a message arrives and you aren't looking at that chat, a small card
   slides in at the side with who, where and what, plus a box to reply
   without opening anything. Three at most; each leaves on its own after a
   few seconds unless you're hovering it or typing a reply.
   ========================================================= */

var MAX = 3;
var LIFE = 7000;
var shown = {};          // key -> element, so one message never shows twice
var audioCtx = null;

function blip(){
  if (getPref("3cs_ntf_sound") !== "on") return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    var t = audioCtx.currentTime;
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + .09);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.08, t + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t + .25);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + .26);
  }catch(e){}
}

/* n = { key, uid, name, where, text, kind: "main"|"dm"|"group", mention, onOpen, onReply } */
function notify(n){
  var mode = getPref("3cs_ntf");
  if (mode === "off") return;
  if (mode === "direct" && n.kind === "main" && !n.mention) return;
  if (shown[n.key]) return;
  var stack = document.getElementById("notifyStack");
  if (!stack) return;

  var card = document.createElement("div");
  card.className = "ntf" + (n.kind !== "main" ? " dm" : "");
  card.style.setProperty("--life", LIFE + "ms");
  card.setAttribute("role", "status");
  card.appendChild(avatarEl(n.uid, n.name, "md"));
  var body = document.createElement("div");
  body.className = "nb";
  var top = document.createElement("div");
  top.className = "nt";
  var b = document.createElement("b"); b.textContent = n.name || "Someone";
  var s = document.createElement("small"); s.textContent = n.where || "";
  top.appendChild(b); top.appendChild(s);
  var tx = document.createElement("div");
  tx.className = "nx";
  tx.textContent = n.text || "";
  body.appendChild(top); body.appendChild(tx);

  if (n.onReply){
    var f = document.createElement("form");
    f.autocomplete = "off";
    f.innerHTML = '<input maxlength="2000" placeholder="Reply" aria-label="Quick reply to ' + String(n.name || "").replace(/"/g, "") + '">' +
      '<button class="icon-btn solid" type="submit" aria-label="Send reply">' + svgIcon("i-send") + '</button>';
    f.addEventListener("click", function(e){ e.stopPropagation(); });
    f.addEventListener("submit", function(e){
      e.preventDefault();
      var v = f.querySelector("input").value.trim();
      if (!v) return;
      n.onReply(v);
      dismiss(card, n.key);
    });
    body.appendChild(f);
  }
  card.appendChild(body);

  var x = document.createElement("button");
  x.type = "button";
  x.className = "nclose";
  x.setAttribute("aria-label", "Dismiss");
  x.innerHTML = "&times;";
  x.addEventListener("click", function(e){ e.stopPropagation(); dismiss(card, n.key); });
  card.appendChild(x);
  var bar = document.createElement("i");
  bar.className = "nbar";
  card.appendChild(bar);

  card.addEventListener("click", function(){
    dismiss(card, n.key);
    if (n.onOpen) n.onOpen();
  });

  /* It leaves when its bar runs out, which pauses while hovered or typed in. */
  bar.addEventListener("animationend", function(){ dismiss(card, n.key); });

  shown[n.key] = card;
  stack.insertBefore(card, stack.firstChild);
  while (stack.children.length > MAX) dismiss(stack.lastChild);
  blip();
}

function dismiss(card, key){
  if (!card || !card.parentNode || card.classList.contains("leaving")) return;
  card.classList.add("leaving");
  setTimeout(function(){ if (card.parentNode) card.parentNode.removeChild(card); }, 240);
  if (key) setTimeout(function(){ delete shown[key]; }, 60000);
}
function clearFor(match){
  Object.keys(shown).forEach(function(k){ if (k.indexOf(match) === 0) dismiss(shown[k], k); });
}

/* "(3) 3CS Class Hub" in the browser tab when there's something unread. */
/* The rest of the title ("S3 LA · 12m left") belongs to js/orbit.js, which
   publishes it as window.__hubTitle; the count goes in front of whatever
   that currently is. */
var unread = 0;
function paintTitle(){
  var base = window.__hubTitle || document.title.replace(/^\(\d+\+?\) /, "");
  var t = unread ? "(" + (unread > 9 ? "9+" : unread) + ") " + base : base;
  if (document.title !== t) document.title = t;
}
function setTitleCount(n){ unread = n || 0; paintTitle(); }
window.addEventListener("3cs:title", paintTitle);

export { notify, clearFor, setTitleCount };
