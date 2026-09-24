/* =========================================================
   EMOJI - the Hub's own picker.

   A hand-picked set rather than all 3,700: the ones people actually send,
   grouped, each with a few words so the search box finds them. They're
   plain Unicode, so they look like the emoji on whatever device you use.
   ========================================================= */

var RAW = {
  "School": "📚 books study read|✏️ pencil write|📝 notes memo homework|📖 book open read|📓 notebook|📐 triangle ruler math|📏 ruler measure|🎒 backpack bag school|🏫 school building|🔬 microscope science|🧪 test tube science chem|🧮 abacus math count|💻 laptop computer|🖥️ desktop computer|⌨️ keyboard type|🖊️ pen|🗓️ calendar date|📅 calendar|⏰ alarm clock time|⌛ hourglass time|🎓 graduate grad cap|🧑‍🏫 teacher|🏆 trophy win|🥇 gold medal first|📊 chart graph|📈 chart up growth|🧠 brain smart think|💡 idea bulb light|🎨 art paint palette|🎵 music note|🌍 earth world globe geography|🔭 telescope space|🧬 dna biology|🤖 robot tech|⚽ soccer football sport|🏀 basketball sport|📣 megaphone announce|🔔 bell|✅ done check yes|❌ no wrong cross|❓ question|❗ important",
  "Smileys": "😀 grin smile happy|😃 smile happy|😄 laugh happy|😁 grin teeth|😆 laugh xd|😅 sweat laugh nervous|🤣 rofl lol laugh|😂 joy lol cry laugh|🙂 smile|🙃 upside down|😉 wink|😊 blush smile|😇 angel innocent|🥰 love hearts|😍 heart eyes love|🤩 star struck wow|😘 kiss|😋 yum tasty|😛 tongue|😜 wink tongue crazy|🤪 zany crazy|😝 tongue|🤑 money|🤗 hug|🤭 oops giggle|🫢 gasp|🤫 shh quiet|🤔 think hmm|🫡 salute|🤐 zip quiet|🤨 raised eyebrow sus|😐 neutral meh|😑 blank|😶 speechless|🫥 dotted|😏 smirk|😒 unamused|🙄 eye roll|😬 grimace awkward|😮‍💨 exhale sigh|🤥 lie|😌 relieved|😔 sad pensive|😪 sleepy|🤤 drool|😴 sleep zzz|😷 mask sick|🤒 sick|🤕 hurt|🤢 nauseous gross|🤮 vomit gross|🥵 hot|🥶 cold freezing|🥴 woozy|😵 dizzy|🤯 mind blown|🤠 cowboy|🥳 party celebrate|🥸 disguise|😎 cool sunglasses|🤓 nerd|🧐 monocle|😕 confused|🫤 meh|😟 worried|🙁 frown|😮 wow open mouth|😯 hushed|😲 astonished|😳 flushed embarrassed|🥺 pleading puppy|🥹 holding tears|😦 frown|😧 anguished|😨 fearful|😰 anxious|😥 sad relieved|😢 cry sad|😭 sob cry|😱 scream|😖 confounded|😣 persevere|😞 disappointed|😓 sweat|😩 weary|😫 tired|🥱 yawn bored|😤 triumph huff|😡 angry mad|😠 angry|🤬 swear|😈 devil|👿 imp|💀 skull dead lol|☠️ skull crossbones|💩 poop|🤡 clown|👻 ghost|👽 alien|👾 game alien|🤖 robot|😺 cat smile|😹 cat joy|😻 cat love|🙈 see no evil monkey|🙉 hear no evil|🙊 speak no evil",
  "Hands": "👍 thumbs up yes like|👎 thumbs down no|👌 ok perfect|🤌 pinched fingers|✌️ peace victory|🤞 fingers crossed luck|🫰 heart hand|🤟 love you|🤘 rock|🤙 call me|👈 left point|👉 right point|👆 up point|👇 down point|☝️ one point|✋ hand stop|🤚 raised back hand|🖐️ hand|🖖 vulcan|👋 wave hi bye|🫶 heart hands|👏 clap applause|🙌 raise hands yay|👐 open hands|🤲 palms|🤝 handshake deal|🙏 pray please thanks|✍️ writing|💪 muscle strong flex|🫵 you point|👀 eyes look|👁️ eye|🧠 brain|🫀 heart organ|👄 mouth|🦾 robot arm",
  "Hearts": "❤️ red heart love|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|💜 purple heart|🖤 black heart|🤍 white heart|🤎 brown heart|💔 broken heart|❤️‍🔥 heart fire|💕 two hearts|💞 revolving hearts|💓 heartbeat|💗 growing heart|💖 sparkle heart|💘 cupid|💝 gift heart|💯 hundred 100|💢 anger|💥 boom|💫 dizzy star|💦 sweat drops|💨 dash fast|🕳️ hole|💬 speech chat|💭 thought|💤 zzz sleep",
  "Nature": "🐶 dog|🐱 cat|🐭 mouse|🐹 hamster|🐰 rabbit bunny|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🐯 tiger|🦁 lion|🐮 cow|🐷 pig|🐸 frog|🐵 monkey|🐔 chicken|🐧 penguin|🐦 bird|🦅 eagle|🦉 owl|🦇 bat|🐺 wolf|🐴 horse|🦄 unicorn|🐝 bee|🦋 butterfly|🐌 snail|🐞 ladybug|🐢 turtle|🐍 snake|🦖 dinosaur trex|🐙 octopus|🦈 shark|🐬 dolphin|🐳 whale|🐊 crocodile|🦜 parrot|🌵 cactus|🌲 tree|🌴 palm tree beach|🌱 seedling grow|🍀 clover luck|🍁 leaf|🌸 blossom flower|🌹 rose|🌻 sunflower|🌈 rainbow|☀️ sun sunny|🌤️ sun cloud|⛅ cloud|🌧️ rain|⛈️ storm|❄️ snow cold|🔥 fire lit hot|⭐ star|🌟 glowing star|✨ sparkles|⚡ lightning zap|🌊 wave ocean|🌙 moon night|🌎 earth",
  "Food": "🍎 apple|🍊 orange|🍋 lemon|🍌 banana|🍉 watermelon|🍇 grapes|🍓 strawberry|🥭 mango|🍍 pineapple|🥥 coconut|🥑 avocado|🌽 corn|🌶️ pepper spicy|🥕 carrot|🍞 bread|🥐 croissant|🧀 cheese|🍳 egg|🥓 bacon|🍔 burger|🍟 fries|🍕 pizza|🌭 hotdog|🌮 taco|🌯 burrito|🥗 salad|🍝 pasta|🍜 noodles ramen|🍣 sushi|🍚 rice|🍗 chicken leg|🥟 dumpling|🍦 ice cream|🍩 donut|🍪 cookie|🎂 cake birthday|🧁 cupcake|🍫 chocolate|🍬 candy|🍭 lollipop|🍿 popcorn|🥤 soda drink|🧃 juice box|☕ coffee|🍵 tea|🧋 boba bubble tea|🥛 milk|🍼 bottle",
  "Fun": "🎉 party tada celebrate|🎊 confetti|🎈 balloon|🎁 gift present|🎀 ribbon|🎮 game controller|🕹️ joystick|🎲 dice|🧩 puzzle|♟️ chess|🎯 target bullseye|🎳 bowling|🏈 football|⚾ baseball|🎾 tennis|🏐 volleyball|🏓 ping pong|🥊 boxing|🛹 skateboard|🚴 bike|🏊 swim|🏃 run|💃 dance|🕺 dance|🎤 mic sing|🎧 headphones music|🎸 guitar|🥁 drum|🎹 piano|🎬 movie film|📸 camera photo|📷 camera|📱 phone|🔋 battery|🔌 plug|💰 money bag|💸 money fly|💎 gem|🔑 key|🔒 lock|🧸 teddy|🪄 magic wand|🔮 crystal ball|🎟️ ticket|🚀 rocket launch|✈️ plane travel|🚗 car|🚌 bus school|🚲 bicycle|🏝️ island beach|🏖️ beach vacation|🗺️ map|⛺ camp|🏠 house home",
  "Symbols": "✅ check done|☑️ check box|✔️ check|❌ cross no|⭕ circle|🚫 no forbidden|⛔ stop|⚠️ warning|❓ question|❔ question white|❗ exclamation|‼️ double bang|⁉️ interrobang|💯 100|🔴 red circle|🟠 orange circle|🟡 yellow circle|🟢 green circle|🔵 blue circle|🟣 purple circle|⚫ black circle|⚪ white circle|🟥 red square|🟧 orange square|🟨 yellow square|🟩 green square|🟦 blue square|🟪 purple square|➕ plus|➖ minus|✖️ times|➗ divide|🟰 equals|♾️ infinity|🔁 repeat|🔄 refresh|⏩ fast forward|⏪ rewind|▶️ play|⏸️ pause|⏹️ stop|🔀 shuffle|🔝 top|🆗 ok|🆕 new|🆒 cool|🆓 free|🆙 up|🔜 soon|📌 pin|📍 location|🏁 finish flag|🚩 red flag|🏳️ white flag|#️⃣ hash|🔢 numbers|🔤 letters"
};

var CATS = Object.keys(RAW).map(function(name){
  return {
    name: name,
    items: RAW[name].split("|").map(function(s){
      var sp = s.indexOf(" ");
      return { e: s.slice(0, sp), k: s.slice(sp + 1).toLowerCase() };
    })
  };
});
var CAT_ICON = { School:"📚", Smileys:"😀", Hands:"👍", Hearts:"❤️", Nature:"🌿", Food:"🍕", Fun:"🎉", Symbols:"✅" };

var RECENT_KEY = "3cs_emoji_recent";
function recent(){
  try{ var r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(r) ? r.slice(0, 24) : []; }catch(e){ return []; }
}
function remember(e){
  var r = recent().filter(function(x){ return x !== e; });
  r.unshift(e);
  try{ localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 24))); }catch(err){}
}

function search(q){
  q = String(q || "").trim().toLowerCase();
  if (!q) return [];
  var out = [], seen = {};
  CATS.forEach(function(c){
    c.items.forEach(function(it){
      if (seen[it.e]) return;
      if (it.k.indexOf(q) > -1){ seen[it.e] = 1; out.push(it.e); }
    });
  });
  return out.slice(0, 80);
}

/* Is this message nothing but one to three emoji? Then it's shown big. */
var EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;
function isEmojiOnly(t){
  try{ return EMOJI_ONLY.test(String(t || "").trim()); }catch(e){ return false; }
}

/* Builds the emoji tab of the picker into `body`; calls onPick(emoji). */
function buildEmojiPanel(body, onPick, searchInput){
  function grid(list){
    var g = document.createElement("div");
    g.className = "emo-grid";
    list.forEach(function(e){
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = e;
      b.setAttribute("aria-label", e);
      b.addEventListener("click", function(){ remember(e); onPick(e); });
      g.appendChild(b);
    });
    return g;
  }
  function label(t, id){
    var l = document.createElement("div");
    l.className = "pk-label"; l.textContent = t;
    if (id) l.id = id;
    return l;
  }
  function paint(q){
    body.innerHTML = "";
    if (q){
      var hits = search(q);
      if (!hits.length){ body.innerHTML = '<div class="pk-empty">No emoji match that.</div>'; return; }
      body.appendChild(grid(hits));
      return;
    }
    var r = recent();
    if (r.length){ body.appendChild(label("Recent")); body.appendChild(grid(r)); }
    CATS.forEach(function(c){
      body.appendChild(label(c.name, "emo-" + c.name));
      body.appendChild(grid(c.items.map(function(i){ return i.e; })));
    });
  }
  paint("");
  if (searchInput) searchInput.addEventListener("input", function(){ paint(searchInput.value); });
  return { paint: paint };
}

export { CATS, CAT_ICON, buildEmojiPanel, isEmojiOnly, remember, search as searchEmoji };
