import { BE, ME, authorFields, canAdmin, dbErrMsg, fmtAgo, meId, mergeField, mine, requireDb, signIn, signedIn, toast, usingFirebase } from "./backend.js";
import { allNotes, renderNotebook } from "./notebook.js";
import { state } from "./state.js";
import { openNameSheet, svgIcon } from "./text.js";

/* =========================================================
   8. Help & Reminders board
   ========================================================= */
function reactCount(post){
  var r = post.reactions || {}, n = 0;
  Object.keys(r).forEach(function(k){ if (r[k]) n++; });
  return n;
}
function iReacted(post){ return !!(post.reactions && post.reactions[meId()]); }

function visiblePosts(){
  var posts = state.posts.slice();
  Object.keys(state.pending).forEach(function(k){
    if (k.indexOf("hb:") === 0) posts.unshift(Object.assign({ _pending:true }, state.pending[k]));
  });
  return posts.filter(function(p){
    if (state.hbStatus === "open" && (p.resolved || p.kind === "reminder")) return false;
    if (state.hbStatus === "resolved" && !p.resolved) return false;
    if (state.hbStatus === "reminder" && p.kind !== "reminder") return false;
    if (state.hbSubject !== "all" && (p.subject || "general") !== state.hbSubject) return false;
    return true;
  }).sort(function(a,b){
    var ap = a.pinned ? 1 : 0, bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function renderHelp(){
  // A live snapshot must not eat a reply someone is mid-way through typing.
  var ae = document.activeElement;
  var wasTyping = !!(ae && ae.matches && ae.matches(".reply-form textarea"));

  renderFilterChips();
  var list = document.getElementById("postList");
  var empty = document.getElementById("postEmpty");
  var loading = (!state.dbSettled) || (state.dbReady && !state.postsLoaded);
  var restoreFocus = function(){
    if (!wasTyping) return;
    var t = document.querySelector(".reply-form textarea");
    if (t){ t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  };

  if (loading){
    list.innerHTML = "";
    for (var s = 0; s < 3; s++){
      var sk = document.createElement("div");
      sk.className = "skel";
      sk.style.height = "112px";
      list.appendChild(sk);
    }
    empty.hidden = true;
    return;
  }

  if (usingFirebase() && !BE.user){
    list.innerHTML = "";
    empty.hidden = false;
    empty.innerHTML = svgIcon("i-lock","big") +
      "<h3>Sign in to use the help board</h3>" +
      "<p>Posting and answering needs a signed-in account so replies carry a real name.</p>" +
      '<div class="gate-actions"><button class="btn js-signin">Sign in with Google</button></div>';
    return;
  }

  var posts = visiblePosts();
  list.innerHTML = "";

  if (!posts.length){
    empty.hidden = false;
    var filtered = state.hbStatus !== "all" || state.hbSubject !== "all";
    empty.innerHTML = filtered
      ? svgIcon("i-search-x","big")+'<h3>Nothing here with those filters</h3><p>Switch back to “All posts” to see the whole board.</p>'
      : (state.dbReady
          ? svgIcon("i-msg","big")+'<h3>The board is quiet</h3><p>Ask the first question, or drop a reminder the class shouldn\'t forget.</p>'
          : svgIcon("i-signal-off","big") + (state.standalone
              ? '<h3>The board lives on the Hub</h3><p>This is a static copy. Open the live Hub to read and post on the help board.</p>'
              : '<h3>The board can\'t load here</h3><p>You need to be signed in to the organization that owns this Hub.</p>'));
    return;
  }
  empty.hidden = true;

  posts.forEach(function(p, i){
    list.appendChild(buildPostCard(p, i));
  });
  restoreFocus();
}

function buildPostCard(p, i){
  var el = document.createElement("div");
  el.className = "post rise" + (p.pinned ? " pinned" : "") + (p.resolved ? " resolved" : "") + (p._pending ? " pending" : "");
  el.style.animationDelay = Math.min(i * 26, 240) + "ms";

  var head = document.createElement("div");
  head.className = "post-head";
  function chip(cls, text){
    var s = document.createElement("span"); s.className = cls; s.textContent = text; head.appendChild(s);
  }
  function chipIcon(icon, text, cls){
    var s = document.createElement("span");
    s.className = "meta-flag" + (cls ? " " + cls : "");
    s.innerHTML = svgIcon(icon) + "<span></span>";
    s.lastChild.textContent = text;
    head.appendChild(s);
  }
  chip("badge subj", (p.subject && p.subject !== "general") ? p.subject : "General");
  chip("badge " + (p.kind === "reminder" ? "link" : "pub"), p.kind === "reminder" ? "Reminder" : "Question");
  if (p.resolved) chip("badge res", "Resolved");
  if (p.pinned)   chipIcon("i-pin", "Pinned", "hot");
  if (p.locked)   chipIcon("i-lock", "Locked");
  var who = document.createElement("span");
  who.className = "who"; who.textContent = p.authorName || "Anonymous";
  head.appendChild(who);
  var when = document.createElement("span");
  when.textContent = "· " + fmtAgo(p.createdAt);
  head.appendChild(when);
  el.appendChild(head);

  var body = document.createElement("div");
  body.className = "post-body";
  body.textContent = p.body || "";
  el.appendChild(body);

  var actions = document.createElement("div");
  actions.className = "post-actions";

  var react = document.createElement("button");
  react.type = "button";
  react.className = "react-btn" + (iReacted(p) ? " on" : "");
  react.innerHTML = svgIcon("i-spark") + "<span>" + reactCount(p) + "</span>";
  react.setAttribute("aria-label", "Mark this helpful");
  react.addEventListener("click", function(){ toggleReact(p); });
  actions.appendChild(react);

  var nReplies = (state.replies[p.id] || []).length || p.replyCount || 0;
  var threadBtn = document.createElement("button");
  threadBtn.type = "button";
  threadBtn.className = "linkbtn";
  threadBtn.textContent = state.openThread === p.id
    ? "Hide replies"
    : (nReplies ? nReplies + (nReplies === 1 ? " reply" : " replies") : "Reply");
  if (state.openThread !== p.id) threadBtn.innerHTML = svgIcon("i-reply") + " " + threadBtn.textContent;
  threadBtn.addEventListener("click", function(){ openThread(p.id); });
  actions.appendChild(threadBtn);

  if (p.kind !== "reminder" && (mine(p) || canAdmin())){
    var res = document.createElement("button");
    res.type = "button"; res.className = "linkbtn";
    res.textContent = p.resolved ? "Mark unresolved" : "Mark resolved";
    res.addEventListener("click", function(){ patchPost(p.id, { resolved: !p.resolved }); });
    actions.appendChild(res);
  }
  if (canAdmin()){
    var pin = document.createElement("button");
    pin.type = "button"; pin.className = "linkbtn";
    pin.textContent = p.pinned ? "Unpin" : "Pin";
    pin.addEventListener("click", function(){ patchPost(p.id, { pinned: !p.pinned }); });
    actions.appendChild(pin);

    var lock = document.createElement("button");
    lock.type = "button"; lock.className = "linkbtn";
    lock.textContent = p.locked ? "Unlock" : "Lock";
    lock.addEventListener("click", function(){ patchPost(p.id, { locked: !p.locked }); });
    actions.appendChild(lock);
  }
  if (mine(p) || canAdmin()){
    var del = document.createElement("button");
    del.type = "button"; del.className = "linkbtn danger";
    del.textContent = "Delete";
    var armed = false;
    del.addEventListener("click", function(){
      if (!armed){ armed = true; del.textContent = "Tap again to delete"; return; }
      var db = requireDb(); if (!db) return;
      db.collection("help").doc(p.id).delete()
        .then(function(){ toast("Post removed."); })
        .catch(function(err){ toast(dbErrMsg(err), true); });
    });
    actions.appendChild(del);
  }
  el.appendChild(actions);

  if (state.openThread === p.id){
    el.appendChild(buildThread(p));
  }
  return el;
}

function buildThread(p){
  var wrap = document.createElement("div");
  wrap.className = "replies";
  var items = state.replies[p.id] || [];

  if (!items.length){
    var none = document.createElement("div");
    none.className = "hint";
    none.textContent = p.locked ? "No replies, and the thread is locked." : "No replies yet — you could be the one who helps.";
    wrap.appendChild(none);
  }
  items.forEach(function(r){
    var row = document.createElement("div");
    row.className = "reply";
    var meta = document.createElement("div");
    meta.className = "post-head";
    var w = document.createElement("span");
    w.className = "who"; w.textContent = r.authorName || "Anonymous";
    meta.appendChild(w);
    var t = document.createElement("span");
    t.textContent = "· " + fmtAgo(r.createdAt);
    meta.appendChild(t);
    if (mine(r) || canAdmin()){
      var d = document.createElement("button");
      d.type = "button"; d.className = "linkbtn danger"; d.textContent = "Delete";
      var armed = false;
      d.addEventListener("click", function(){
        if (!armed){ armed = true; d.textContent = "Confirm?"; return; }
        var db = requireDb(); if (!db) return;
        db.collection("help").doc(p.id).collection("replies").doc(r.id).delete()
          .catch(function(err){ toast(dbErrMsg(err), true); });
      });
      meta.appendChild(d);
    }
    var b = document.createElement("div");
    b.className = "post-body";
    b.textContent = r.body || "";
    row.appendChild(meta); row.appendChild(b);
    wrap.appendChild(row);
  });

  if (!p.locked){
    var form = document.createElement("div");
    form.className = "reply-form";
    var ta = document.createElement("textarea");
    ta.placeholder = "Write a reply…";
    ta.setAttribute("aria-label", "Reply");
    ta.value = state.replyDraft || "";
    ta.addEventListener("input", function(){ state.replyDraft = ta.value; });
    var send = document.createElement("button");
    send.className = "btn sm"; send.textContent = "Reply";
    function submitReply(){
      var text = ta.value.trim();
      if (!text){ toast("Write a reply first.", true); return; }
      if (usingFirebase() && !BE.user){ toast("Sign in to reply.", true); signIn(); return; }
      if (!usingFirebase() && !ME.name){ openNameSheet(function(){ state.replyDraft = ""; postReply(p.id, text); }); return; }
      state.replyDraft = "";
      ta.value = "";
      postReply(p.id, text);
    }
    send.addEventListener("click", submitReply);
    ta.addEventListener("keydown", function(e){
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitReply();
    });
    form.appendChild(ta); form.appendChild(send);
    wrap.appendChild(form);
  }
  return wrap;
}

function openThread(id){
  if (state.replyUnsub){ state.replyUnsub(); state.replyUnsub = null; }
  state.replyDraft = "";
  if (state.openThread === id){ state.openThread = null; renderHelp(); return; }
  state.openThread = id;
  if (!state.replies[id]) state.replies[id] = [];
  renderHelp();
  var db = state.db; if (!db) return;
  state.replyUnsub = db.collection("help").doc(id).collection("replies")
    .orderBy("createdAt", "asc").limit(200)
    .onSnapshot(function(qs){
      var items = [];
      qs.docs.forEach(function(d){ items.push(Object.assign({ id:d.id }, d.data())); });
      state.replies[id] = items;
      renderHelp();
      // The stored count is a display hint only; correct it once when it drifts.
      var post = state.posts.filter(function(x){ return x.id === id; })[0];
      if (post && (post.replyCount || 0) !== items.length && !state._fixingCount){
        state._fixingCount = true;
        db.collection("help").doc(id).update({ replyCount: items.length })
          .catch(function(){})
          .then(function(){ state._fixingCount = false; });
      }
    }, function(){ /* terminal: thread stops updating, existing replies stay */ });
}

function postReply(postId, text){
  var db = requireDb(); if (!db) return;
  db.collection("help").doc(postId).collection("replies").add({
    body: text, createdAt: new Date().toISOString(), ...authorFields()
  }).then(function(){
    var n = (state.replies[postId] || []).length + 1;
    db.collection("help").doc(postId).update({ replyCount: n }).catch(function(){});
    toast("Reply posted.");
  }).catch(function(err){ toast(dbErrMsg(err), true); });
}

function toggleReact(post){
  var db = requireDb(); if (!db) return;
  if (!signedIn()){ toast("Sign in to react.", true); return; }
  mergeField(db.collection("help").doc(post.id), "reactions", meId(), !iReacted(post))
    .catch(function(err){ toast(dbErrMsg(err), true); });
}

function patchPost(id, patch){
  var db = requireDb(); if (!db) return;
  db.collection("help").doc(id).update(patch)
    .catch(function(err){ toast(dbErrMsg(err), true); });
}

function postHelp(){
  var db = requireDb(); if (!db) return;
  var input = document.getElementById("postInput");
  var text = input.value.trim();
  if (!text){ toast("Write your question or reminder first.", true); return; }
  if (usingFirebase() && !BE.user){ toast("Sign in to post.", true); signIn(); return; }
  if (!usingFirebase() && !ME.name){ openNameSheet(function(){ postHelp(); }); return; }

  var kind = document.getElementById("postKind").value;
  var payload = {
    kind: kind,
    body: text,
    subject: document.getElementById("postSubject").value,
    createdAt: new Date().toISOString(),
    resolved: false, pinned: false, locked: false,
    replyCount: 0, reactions: {}
  };
  Object.assign(payload, authorFields());
  var ref = db.collection("help").doc();
  state.pending["hb:" + ref.id] = Object.assign({ id: ref.id }, payload);
  input.value = "";
  try{ localStorage.removeItem("3cs_draft_help"); }catch(e){}
  renderHelp();
  ref.set(payload).then(function(){
    toast(kind === "reminder" ? "Reminder posted." : "Question posted — someone will see it.");
  }).catch(function(err){
    delete state.pending["hb:" + ref.id];
    input.value = text;
    renderHelp();
    toast(dbErrMsg(err), true);
  });
}

/* --- filter chips shared by both boards --- */
function chipRow(container, items, current, onPick){
  container.innerHTML = "";
  items.forEach(function(it){
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip-btn" + (it[0] === current ? " on" : "");
    b.textContent = it[1];
    b.addEventListener("click", function(){ onPick(it[0]); });
    container.appendChild(b);
  });
}
function renderFilterChips(){
  var seen = {};
  allNotes().forEach(function(n){ seen[n.subject || "general"] = true; });
  var el = document.getElementById("noteSubjectChips");
  if (el) chipRow(el, [["all","All subjects"]].concat(Object.keys(seen).sort().map(function(c){
    return [c, c === "general" ? "General" : c];
  })), state.nbSubject, function(v){ state.nbSubject = v; renderNotebook(); });

  el = document.getElementById("noteVisChips");
  if (el) chipRow(el, [["all","Everything"],["public","Public"],["link","Link only"],["private","On this device"]],
    state.nbVis, function(v){ state.nbVis = v; renderNotebook(); });

  var pseen = {};
  state.posts.forEach(function(p){ pseen[p.subject || "general"] = true; });
  el = document.getElementById("postStatusChips");
  if (el) chipRow(el, [["all","All posts"],["open","Needs an answer"],["resolved","Resolved"],["reminder","Reminders"]],
    state.hbStatus, function(v){ state.hbStatus = v; renderHelp(); });

  el = document.getElementById("postSubjectChips");
  if (el) chipRow(el, [["all","All subjects"]].concat(Object.keys(pseen).sort().map(function(c){
    return [c, c === "general" ? "General" : c];
  })), state.hbSubject, function(v){ state.hbSubject = v; renderHelp(); });
}


export { buildPostCard, buildThread, chipRow, iReacted, openThread, patchPost, postHelp, postReply, reactCount, renderFilterChips, renderHelp, toggleReact, visiblePosts };
