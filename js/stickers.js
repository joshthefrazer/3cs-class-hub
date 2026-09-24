/* =========================================================
   STICKERS - the Hub's own animated "GIFs".

   Each one is built from HTML and CSS (styles/social.css), so they're a
   few hundred bytes, sharp on any screen, and cost the database nothing:
   a sticker message only stores the sticker's name. They move only while
   they're on screen, and sit still for anyone who turned motion down.
   ========================================================= */

function letters(text){
  return text.split("").map(function(c, i){
    return '<span class="lt" style="--i:' + i + '">' + (c === " " ? "&nbsp;" : c) + '</span>';
  }).join("");
}
var CONFETTI = ["#FF8A4C", "#B98CFF", "#7EA3FF", "#4FCB95", "#FFD34D", "#FF7A8A"];
function confetti(n){
  var out = "";
  for (var i = 0; i < n; i++){
    out += '<i style="left:' + ((i * 37) % 100) + '%;background:' + CONFETTI[i % CONFETTI.length] +
           ';animation-delay:' + (-(i * .23) % 2).toFixed(2) + 's;animation-duration:' + (1.5 + (i % 4) * .25) + 's"></i>';
  }
  return out;
}

var STICKERS = [
  { id:"letsgo",  name:"Let's go",       html:function(){ return '<span class="ln"></span><span class="ln"></span><span class="ln"></span><span class="t">' + letters("LET'S GO") + '</span>'; } },
  { id:"w",       name:"W",              html:function(){ return '<span class="rays"></span><span class="t">W</span>'; } },
  { id:"l",       name:"L",              html:function(){ return '<span class="t">L</span><span class="drop"></span>'; } },
  { id:"gg",      name:"GG",             html:function(){ return confetti(10) + '<span class="t">GG</span>'; } },
  { id:"lol",     name:"LOL",            html:function(){ return '<span class="t">' + letters("LOL") + '</span>'; } },
  { id:"noway",   name:"No way",         html:function(){ return '<span class="t"><span class="e">😳</span>NO WAY</span>'; } },
  { id:"facts",   name:"Facts",          html:function(){ return '<span class="t">FACTS</span>'; } },
  { id:"bruh",    name:"Bruh",           html:function(){ return '<span class="t">bruh.</span>'; } },
  { id:"yes",     name:"Yesss",          html:function(){ return '<span class="t">YESSS</span>'; } },
  { id:"brb",     name:"brb",            html:function(){ return '<span class="d"></span><span class="d"></span><span class="t">brb</span>'; } },
  { id:"omw",     name:"On my way",      html:function(){ return '<span class="t">on my way<span class="ar"><i></i><i></i><i></i></span></span>'; } },
  { id:"hw",      name:"Homework??",     html:function(){ return '<span class="bk">📚</span><span class="q">?</span><span class="q">?</span><span class="q">?</span><span class="t">homework??</span>'; } },
  { id:"study",   name:"Study mode",     html:function(){ return '<span class="ring"></span><span class="t"><span class="e">🧠</span><br>study mode</span>'; } },
  { id:"done",    name:"Done",           html:function(){ return '<svg viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="M18 54l22 22 44-48"/></svg><span class="t">DONE</span>'; } },
  { id:"halfday", name:"Half day",       html:function(){ return confetti(12) + '<span class="t">HALF DAY!<small>see you at 12:20</small></span>'; } },
  { id:"gm",      name:"Good morning",   html:function(){ return '<span class="sun"></span><span class="t">good morning</span>'; } },
  { id:"tmrw",    name:"See you tomorrow", html:function(){ return '<span class="t"><span class="e">👋</span><br>see you tmrw</span>'; } },
  { id:"thanks",  name:"Thank you",      html:function(){ return '<span class="t"><span>thank you!</span></span><span class="e">💜</span>'; } },
  { id:"heart",   name:"Love it",        html:function(){ return '<span class="e">❤️</span><span class="h">💕</span><span class="h">💖</span><span class="h">💗</span>'; } },
  { id:"fire",    name:"Lit",            html:function(){ return '<span class="e">🔥</span><span class="t">LIT</span>'; } },
  { id:"cry",     name:"Crying",         html:function(){ return '<span class="e">😭</span><span class="tear"></span><span class="tear"></span>'; } },
  { id:"3cs",     name:"3CS",            html:function(){ return '<span class="t">' + letters("3CS") + '</span><small>class of 3CS</small>'; } }
];
var BY_ID = {};
STICKERS.forEach(function(s){ BY_ID[s.id] = s; });

/* Stickers only run their animation while visible. */
var io = null;
function watch(el){
  if (!("IntersectionObserver" in window)){ el.classList.add("on"); return; }
  if (!io){
    io = new IntersectionObserver(function(en){
      en.forEach(function(e){ e.target.classList.toggle("on", e.isIntersecting); });
    }, { threshold: .2 });
  }
  io.observe(el);
}

function stickerEl(id){
  var s = BY_ID[id];
  var el = document.createElement("div");
  el.className = "stk stk-" + (s ? s.id : "missing");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", s ? "Sticker: " + s.name : "Sticker");
  el.innerHTML = s ? s.html() : '<span class="t">?</span>';
  watch(el);
  return el;
}
function stickerName(id){ return BY_ID[id] ? BY_ID[id].name : "a sticker"; }

export { STICKERS, stickerEl, stickerName };
