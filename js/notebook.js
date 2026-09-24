import { checkNoteHash, setTab } from "./admin.js";
import { BE, ME, authorFields, canAdmin, dbErrMsg, fmtAgo, fmtWhen, mine, myName, requireDb, saveConfig, signedIn, toast, usingFirebase } from "./backend.js";
import { renderFilterChips } from "./help.js";
import { subjectCodes, subjectLabel, subjectColor } from "./sched.js";
import { compressImage, uploadMedia, loadMedia, mediaEl, pickFiles, mediaError, lazy } from "./media.js";
import { avatarEl, displayName } from "./profile.js";
import { state } from "./state.js";
import { SHARE_BASE, closeSheet, esc, mdRender, openSheet, svgIcon, toggleCheckSource } from "./text.js";

/* =========================================================
   7. Class Notebook
   ========================================================= */
function renderNotebookIntro(){
  var intro = state.notebookNote ||
    "Notes, resources, and study material for 3CS. Anyone in the class can add a page.";
  document.getElementById("notebookNote").textContent = intro;
  document.getElementById("notebookInput").value = state.notebookNote || "";
  document.getElementById("notebookEditWrap").hidden = !state.adminMode;
}
function saveNotebookIntro(){
  saveConfig({ notebookNote: document.getElementById("notebookInput").value.trim() }, "Intro saved for everyone.");
}

function subjectOptionsHtml(selected){
  var opts = [["general","General"]].concat(subjectCodes().map(function(c){ return [c, subjectLabel(c)]; }));
  return opts.map(function(o){
    return '<option value="' + esc(o[0]) + '"' + (o[0] === selected ? " selected" : "") + ">" + esc(o[1]) + "</option>";
  }).join("");
}

function localNotes(){
  try{
    var v = JSON.parse(localStorage.getItem("3cs_private") || "[]");
    return Array.isArray(v) ? v : [];
  }catch(e){ return []; }
}
function setLocalNotes(arr){
  try{ localStorage.setItem("3cs_private", JSON.stringify(arr)); return true; }
  catch(e){ toast("This browser blocked local storage, so private notes can't be saved here.", true); return false; }
}

function allNotes(){
  var seen = {}, out = [];
  function push(n){
    if (!n || !n.id || seen[n.id]) return;
    seen[n.id] = 1; out.push(n);
  }
  Object.keys(state.pending).forEach(function(k){
    if (k.indexOf("nb:") === 0) push(Object.assign({ _pending:true }, state.pending[k]));
  });
  state.notes.forEach(push);
  if (usingFirebase()){
    state.myNotes.forEach(push);
    state.privNotes.forEach(function(n){
      push(Object.assign({}, n, { _priv:true, visibility:"private" }));
    });
  } else {
    localNotes().forEach(function(n){
      push(Object.assign({}, n, { _local:true, visibility:"private" }));
    });
  }
  return out;
}
function visibleNotes(){
  var q = state.nbQuery.trim().toLowerCase();
  return allNotes().filter(function(n){
    // Link-only notes are hidden from the browse list for everyone but their
    // creator's device and admins — reachable, but not advertised.
    if (n.visibility === "link" && !n._local && !n._priv && !mine(n) && !canAdmin()) return false;
    if (state.nbSubject !== "all" && (n.subject || "general") !== state.nbSubject) return false;
    if (state.nbVis !== "all" && (n.visibility || "public") !== state.nbVis) return false;
    if (q && ((n.title || "") + " " + (n.body || "")).toLowerCase().indexOf(q) === -1) return false;
    return true;
  }).sort(function(a,b){ return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")); });
}

function snippet(body){
  return String(body || "")
    .replace(/^\s*[-*]\s+\[[ xX]\]\s*/gm, "")   // checkbox markers
    .replace(/^\s*[-*]\s+/gm, "")               // bullets
    .replace(/^\s*#{1,6}\s+/gm, "")             // headings
    .replace(/[*`]/g, "")                       // emphasis marks
    .replace(/\s+/g, " ")
    .trim();
}

function renderNotebook(){
  if (!state._hashChecked && state.notesLoaded){ state._hashChecked = true; checkNoteHash(); }
  renderFilterChips();
  var grid = document.getElementById("noteGrid");
  var empty = document.getElementById("noteEmpty");
  var loading = (!state.dbSettled) || (state.dbReady && !state.notesLoaded);

  if (loading && !localNotes().length){
    grid.innerHTML = "";
    for (var s = 0; s < 4; s++){
      var sk = document.createElement("div");
      sk.className = "skel skel-card";
      grid.appendChild(sk);
    }
    empty.hidden = true;
    return;
  }

  if (usingFirebase() && !BE.user){
    grid.innerHTML = "";
    empty.hidden = false;
    empty.innerHTML = svgIcon("i-lock","big") +
      "<h3>Sign in to open the notebook</h3>" +
      "<p>The class notebook is shared, so the Hub needs to know who you are before it will show it.</p>" +
      '<div class="gate-actions"><button class="btn js-signin">Sign in</button></div>';
    return;
  }

  var notes = visibleNotes();
  grid.innerHTML = "";

  if (!notes.length){
    empty.hidden = false;
    var filtered = state.nbQuery || state.nbSubject !== "all" || state.nbVis !== "all";
    empty.innerHTML = filtered
      ? svgIcon("i-search-x","big")+'<h3>Nothing matches those filters</h3><p>Try clearing the search or picking “All subjects”.</p>'
      : svgIcon("i-book","big")+'<h3>The notebook is empty</h3><p>Add the first page: class notes, a homework breakdown, a revision checklist.</p>';
    return;
  }
  empty.hidden = true;

  notes.forEach(function(n, i){
    var card = document.createElement("button");
    card.type = "button";
    card.className = "note-card rise" + (n._pending ? " pending" : "");
    card.style.setProperty("--sc", subjectColor(n.subject));
    card.style.animationDelay = Math.min(i * 26, 280) + "ms";

    var top = document.createElement("div");
    top.className = "note-top";
    var vis = n.visibility || "public";
    var visBadge = document.createElement("span");
    visBadge.className = "badge " + (vis === "link" ? "link" : vis === "private" ? "priv" : "pub");
      visBadge.textContent = vis === "link" ? "Link only"
                         : vis === "private" ? (usingFirebase() ? "Private" : "This device")
                         : "Public";
    var subjBadge = document.createElement("span");
    subjBadge.className = "badge subj";
    subjBadge.style.setProperty("--sc", subjectColor(n.subject));
    subjBadge.textContent = (n.subject && n.subject !== "general") ? n.subject : "General";
    top.appendChild(subjBadge);
    top.appendChild(visBadge);

    var h = document.createElement("h3");
    h.textContent = n.title || "Untitled note";
    var snip = document.createElement("div");
    snip.className = "note-snip";
    snip.textContent = snippet(n.body) || "Empty note";
    var foot = document.createElement("div");
    foot.className = "note-foot";
    var who = document.createElement("span");
    who.className = "who";
    if (!n._priv && !n._local) who.appendChild(avatarEl(n.authorUid || n.authorToken, n.authorName, "xs"));
    who.appendChild(document.createTextNode(n._priv ? "Private to you"
                    : n._local ? "Only on this device"
                    : (n.authorUid ? displayName(n.authorUid, n.authorName) : (n.authorName || "Anonymous"))));
    var when = document.createElement("span");
    when.textContent = fmtAgo(n.updatedAt);
    foot.appendChild(who); foot.appendChild(when);

    card.appendChild(top); card.appendChild(h); card.appendChild(snip);
    var imgs = Array.isArray(n.images) ? n.images.filter(function(x){ return typeof x === "string" && x.length <= 40; }) : [];
    if (imgs.length){
      var th = document.createElement("div");
      th.className = "note-thumbs";
      imgs.slice(0, 3).forEach(function(id){
        var t = document.createElement("span");
        t.className = "nt";
        lazy(t, function(){
          loadMedia(id).then(function(m){ var im = document.createElement("img"); im.alt = ""; im.src = m.data; t.appendChild(im); }).catch(function(){});
        });
        th.appendChild(t);
      });
      if (imgs.length > 3){ var more = document.createElement("span"); more.className = "nt more"; more.textContent = "+" + (imgs.length - 3); th.appendChild(more); }
      card.appendChild(th);
    }
    card.appendChild(foot);
    card.addEventListener("click", function(){ openNote(n); });
    grid.appendChild(card);
  });
}

function openNote(note){
  var canEdit = note._local || note._priv || mine(note) || canAdmin();
  var vis = note.visibility || "public";
  var shareHtml = vis === "link"
    ? '<div class="sharebox"><input id="nvLink" readonly aria-label="Share link">' +
      '<button class="btn ghost sm" id="nvCopy">Copy</button></div>' +
      '<p class="hint" style="margin-top:7px;">Anyone signed in to this Hub who has this link can open the note. It isn\'t locked to specific people.</p>'
    : "";
  var box = openSheet(
    '<div class="sheet-head"><h2 id="nvTitle"></h2>' +
    '<button class="sheet-close" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +
    '<div class="sheet-meta" id="nvMeta"></div>' +
    '<div class="md" id="nvBody"></div><div class="note-gallery" id="nvGallery" hidden></div>' + shareHtml +
    '<div class="sheet-actions" id="nvActions"></div>'
  );

  box.querySelector("#nvTitle").textContent = note.title || "Untitled note";

  var meta = box.querySelector("#nvMeta");
  var sb = document.createElement("span");
  sb.className = "badge subj";
  sb.textContent = (note.subject && note.subject !== "general") ? subjectLabel(note.subject) : "General";
  meta.appendChild(sb);
  var vb = document.createElement("span");
  vb.className = "badge " + (vis === "link" ? "link" : vis === "private" ? "priv" : "pub");
  vb.textContent = vis === "link" ? "Link only" : vis === "private" ? (usingFirebase() ? "Private" : "This device only") : "Public to the class";
  meta.appendChild(vb);
  var mw = document.createElement("span");
  mw.textContent = (note._local ? "Saved on this device" : (note.authorName || "Anonymous")) +
                   " · " + fmtWhen(note.updatedAt);
  meta.appendChild(mw);

  var bodyEl = box.querySelector("#nvBody");
  function paint(){
    bodyEl.innerHTML = mdRender(note.body);
    bodyEl.querySelectorAll("input[data-ci]").forEach(function(cb){
      cb.addEventListener("change", function(){
        var idx = parseInt(cb.getAttribute("data-ci"), 10);
        note.body = toggleCheckSource(note.body, idx, cb.checked);
        note.updatedAt = new Date().toISOString();
        paint();
        persistNoteBody(note);
      });
    });
  }
  paint();

  var gal = box.querySelector("#nvGallery");
  var nimgs = Array.isArray(note.images) ? note.images.filter(function(x){ return typeof x === "string" && x.length <= 40; }) : [];
  if (nimgs.length){
    gal.hidden = false;
    nimgs.forEach(function(id){ gal.appendChild(mediaEl(id, 0, 0, { cls: "ng-img", label: "Open picture", alt: "Picture in " + (note.title || "this note") })); });
  }

  if (vis === "link"){
    var linkInput = box.querySelector("#nvLink");
    var url = SHARE_BASE + "#note=" + note.id;
    linkInput.value = url;
    linkInput.addEventListener("focus", function(){ linkInput.select(); });
    box.querySelector("#nvCopy").addEventListener("click", function(){
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(function(){
          toast("Link copied. If it doesn't jump straight to the note, paste it into “Open by link”.");
        }).catch(function(){ linkInput.select(); toast("Copy blocked here. Select the link and copy it manually.", true); });
      } else { linkInput.select(); toast("Select the link and copy it manually."); }
    });
  }

  var actions = box.querySelector("#nvActions");
  if (canEdit){
    var edit = document.createElement("button");
    edit.className = "btn sm"; edit.textContent = "Edit";
    edit.addEventListener("click", function(){ openNoteEditor(note); });
    var del = document.createElement("button");
    del.className = "linkbtn danger"; del.textContent = "Delete";
    var armed = false;
    del.addEventListener("click", function(){
      if (!armed){ armed = true; del.textContent = "Tap again to delete"; return; }
      deleteNote(note);
    });
    actions.appendChild(edit); actions.appendChild(del);
  } else {
    var hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "Notes can be edited from the device that wrote them, or by an admin.";
    actions.appendChild(hint);
  }
}

function persistNoteBody(note){
  if (note._priv && BE.user){
    BE.db.collection("users").doc(BE.user.id).collection("private").doc(note.id)
      .update({ body: note.body, updatedAt: note.updatedAt })
      .catch(function(err){ toast(dbErrMsg(err), true); });
    return;
  }
  if (note._local){
    var arr = localNotes().map(function(n){
      return n.id === note.id ? Object.assign({}, n, { body: note.body, updatedAt: note.updatedAt }) : n;
    });
    setLocalNotes(arr);
    renderNotebook();
    return;
  }
  var db = requireDb(); if (!db) return;
  db.collection("notebook").doc(note.id).update({ body: note.body, updatedAt: note.updatedAt })
    .catch(function(err){ toast(dbErrMsg(err), true); });
}

function deleteNote(note){
  if (note._priv && BE.user){
    BE.db.collection("users").doc(BE.user.id).collection("private").doc(note.id).delete()
      .then(function(){ closeSheet(); toast("Private note deleted."); })
      .catch(function(err){ toast(dbErrMsg(err), true); });
    return;
  }
  if (note._local){
    setLocalNotes(localNotes().filter(function(n){ return n.id !== note.id; }));
    closeSheet(); renderNotebook(); toast("Note deleted from this device.");
    return;
  }
  var db = requireDb(); if (!db) return;
  db.collection("notebook").doc(note.id).delete()
    .then(function(){ closeSheet(); toast("Note deleted."); })
    .catch(function(err){ toast(dbErrMsg(err), true); });
}

function visHintText(kind){
  if (kind === "public") return "Everyone signed in to the Hub sees it in the notebook list.";
  if (kind === "link"){
    return usingFirebase()
      ? "Kept out of the notebook list by the server. It can only be opened by someone who has its link."
      : "Hidden from the list, but anyone signed in who has the link can open it. That's link-secrecy, not a lock.";
  }
  return usingFirebase()
    ? "Stored under your account, where the security rules let nobody else read it, not classmates and not admins. It follows you to your phone."
    : "Saved in this browser only. It won't appear on your phone or another computer, and nobody else (admins included) can see or recover it.";
}

function openNoteEditor(existing){
  var n = existing || { title:"", body:"", subject:"general", visibility:"public" };
  var fb = usingFirebase();
  var box = openSheet(
    '<div class="sheet-head"><h2>' + (existing ? "Edit note" : "New note") + "</h2>" +
    '<button class="sheet-close" aria-label="Close">' + svgIcon("i-close") + '</button></div>' +
    '<div class="stack" style="gap:13px;">' +
      '<label class="field"><span>Title</span><input id="neTitle" maxlength="120" placeholder="e.g. S&amp;T cell structure revision"></label>' +
      '<div class="grid-2">' +
        '<label class="field"><span>Subject</span><select id="noteSubjectSelect">' + subjectOptionsHtml(n.subject || "general") + "</select></label>" +
        '<label class="field"><span>Who can see it</span><select id="neVis">' +
          '<option value="public">Public: the whole class</option>' +
          '<option value="link">Link only: hidden from the list</option>' +
          '<option value="private">' + (fb ? "Private: only you" : "Private: this browser only") + '</option>' +
        "</select></label>" +
      "</div>" +
      '<label class="field"><span>Note</span><textarea id="neBody" placeholder="Write the note here" style="min-height:160px"></textarea></label>' +
      '<p class="hint"><strong>Formatting:</strong> <code>**bold**</code>, <code>*italic*</code>, <code>`code`</code>, <code>- bullet</code>, <code>- [ ] checkbox</code>, <code># heading</code></p>' +
      (fb
        ? '<div class="field"><span>Pictures</span><div class="img-drop" id="neImgs"></div>' +
          '<small class="hint">Up to 6. Big photos are shrunk automatically. You can also paste a picture into the note.</small></div>'
        : "") +
      '<p class="hint" id="neVisHint"></p>' +
      '<div class="sheet-actions"><button class="btn ghost sm" id="neCancel" type="button">Cancel</button>' +
      '<button class="btn" id="neSave" type="button">' + (existing ? "Save changes" : "Add to notebook") + "</button></div>" +
    "</div>"
  );
  box.classList.add("wide");
  box.querySelector("#neTitle").value = n.title || "";
  var bodyIn = box.querySelector("#neBody");
  bodyIn.value = n.body || "";
  var visSel = box.querySelector("#neVis");
  visSel.value = n.visibility || "public";
  var visHint = box.querySelector("#neVisHint");
  function paintHint(){ visHint.textContent = visHintText(visSel.value); }
  paintHint();
  visSel.addEventListener("change", paintHint);

  /* pictures: each one is uploaded as soon as it's picked, so saving the
     note is instant; the note itself only keeps the ids */
  var images = (Array.isArray(n.images) ? n.images : []).filter(function(x){ return typeof x === "string" && x.length <= 40; });
  var busy = 0;
  var imgBox = box.querySelector("#neImgs");
  function paintImgs(){
    if (!imgBox) return;
    imgBox.innerHTML = "";
    images.forEach(function(id, i){
      var chip = document.createElement("div");
      chip.className = "img-chip";
      loadMedia(id).then(function(m){ var im = document.createElement("img"); im.alt = ""; im.src = m.data; chip.insertBefore(im, chip.firstChild); }).catch(function(){});
      var x = document.createElement("button");
      x.type = "button"; x.innerHTML = "&times;"; x.setAttribute("aria-label", "Remove picture " + (i + 1));
      x.addEventListener("click", function(){ images.splice(i, 1); paintImgs(); });
      chip.appendChild(x);
      imgBox.appendChild(chip);
    });
    for (var b = 0; b < busy; b++){ var c = document.createElement("div"); c.className = "img-chip busy"; imgBox.appendChild(c); }
    if (images.length + busy < 6){
      var add = document.createElement("button");
      add.type = "button"; add.className = "img-add";
      add.setAttribute("aria-label", "Add a picture");
      add.innerHTML = svgIcon("i-image");
      add.addEventListener("click", function(){ pickFiles("image/*", true).then(addFiles); });
      imgBox.appendChild(add);
    }
  }
  function addFiles(files){
    files = files.filter(function(f){ return /^image\//.test(f.type); }).slice(0, 6 - images.length - busy);
    files.forEach(function(f){
      busy++; paintImgs();
      var scope = visSel.value === "private" ? "user" : "hub";
      compressImage(f, 1600).then(function(m){ return uploadMedia(m, scope); })
        .then(function(id){ images.push(id); })
        .catch(function(e){ toast(mediaError(e), true); })
        .then(function(){ busy--; paintImgs(); });
    });
  }
  paintImgs();
  if (imgBox) bodyIn.addEventListener("paste", function(e){
    var files = Array.prototype.slice.call((e.clipboardData && e.clipboardData.files) || []);
    if (files.some(function(f){ return /^image\//.test(f.type); })){ e.preventDefault(); addFiles(files); }
  });

  box.querySelector("#neCancel").addEventListener("click", closeSheet);
  box.querySelector("#neSave").addEventListener("click", function(){
    var title = box.querySelector("#neTitle").value.trim();
    var body  = bodyIn.value;
    if (busy){ toast("Wait a second, a picture is still uploading.", true); return; }
    if (!title && !body.trim() && !images.length){ toast("Give the note a title or some content first.", true); return; }
    var data = {
      title: title || "Untitled note",
      body: body,
      subject: box.querySelector("#noteSubjectSelect").value,
      visibility: visSel.value
    };
    if (fb) data.images = images.slice(0, 6);
    var saveBtn = box.querySelector("#neSave");
    saveBtn.disabled = true;
    /* A picture first added to a private note is only readable by you, so
       it's copied for the class when the note is shared. */
    (data.visibility !== "private" && images.length ? shareImages(images) : Promise.resolve(images)).then(function(ids){
      if (fb) data.images = ids;
      saveNote(existing, data);
    }).catch(function(e){ saveBtn.disabled = false; toast(mediaError(e), true); });
  });
}

function shareImages(ids){
  return Promise.all(ids.map(function(id){
    return loadMedia(id).then(function(m){
      if (m.scope !== "user") return id;
      return uploadMedia({ data: m.data, w: m.w, h: m.h, kind: "image" }, "hub");
    }).catch(function(){ return id; });
  }));
}

function saveNote(existing, data){
  var now = new Date().toISOString();
  var wasLocal = !!(existing && existing._local);

  if (data.visibility === "private"){
    /* On Firebase a private note lives under your own uid, where the rules
       let nobody else read it. So it syncs to your phone and is genuinely
       private. On the artifact it stays in this browser, as before. */
    if (usingFirebase()){
      if (!BE.user){ toast("Sign in to save a private note.", true); return; }
      var pcol = BE.db.collection("users").doc(BE.user.id).collection("private");
      var pref = (existing && existing._priv) ? pcol.doc(existing.id) : pcol.doc();
      pref.set(Object.assign({}, data, {
        updatedAt: now,
        createdAt: (existing && existing.createdAt) || now
      })).then(function(){
        if (existing && !existing._priv && !existing._local){
          BE.db.collection("notebook").doc(existing.id).delete().catch(function(){});
        }
        closeSheet();
        toast("Saved privately. Only your account can see it.");
      }).catch(function(err){ toast(dbErrMsg(err), true); });
      return;
    }

    var arr = localNotes();
    if (wasLocal){
      arr = arr.map(function(x){ return x.id === existing.id ? Object.assign({}, x, data, { updatedAt: now }) : x; });
    } else {
      arr.unshift(Object.assign({
        id: "loc" + Math.random().toString(36).slice(2,10),
        createdAt: now, authorName: myName(), authorToken: ME.token
      }, data, { updatedAt: now }));
    }
    if (!setLocalNotes(arr)) return;
    // Moving a shared note to private removes the shared copy.
    if (existing && !wasLocal && state.db){
      state.db.collection("notebook").doc(existing.id).delete().catch(function(){});
    }
    closeSheet(); renderNotebook();
    toast("Saved on this device only.");
    return;
  }

  var db = requireDb(); if (!db) return;
  if (!signedIn()){ toast("Sign in to add a note for the class.", true); return; }
  var keepShared = existing && !wasLocal && !existing._priv;
  var payload = Object.assign({}, data, { updatedAt: now });
  if (keepShared){
    payload.createdAt  = existing.createdAt || now;
    payload.authorUid  = existing.authorUid;
    payload.authorName = existing.authorName;
    if (!payload.authorUid) delete payload.authorUid;
    if (existing.authorToken) payload.authorToken = existing.authorToken;
  } else {
    payload.createdAt = now;
    Object.assign(payload, authorFields());
  }
  var ref = keepShared ? db.collection("notebook").doc(existing.id) : db.collection("notebook").doc();
  /* A note moving out of private leaves its private copy behind. */
  if (existing && existing._priv && BE.user){
    BE.db.collection("users").doc(BE.user.id).collection("private").doc(existing.id)
      .delete().catch(function(){});
  }
  state.pending["nb:" + ref.id] = Object.assign({ id: ref.id }, payload);
  closeSheet(); renderNotebook();
  ref.set(payload).then(function(){
    if (wasLocal) setLocalNotes(localNotes().filter(function(x){ return x.id !== existing.id; }));
    toast(existing ? "Note updated for the class." : "Note added for the class.");
    renderNotebook();
  }).catch(function(err){
    delete state.pending["nb:" + ref.id];
    renderNotebook();
    toast(dbErrMsg(err), true);
  });
}

function openNoteById(id){
  var local = allNotes().filter(function(n){ return n.id === id; })[0];
  if (local){ setTab("notebook"); openNote(local); return; }
  var db = state.db;
  if (!db){ toast("Couldn't look that note up in this view.", true); return; }
  db.collection("notebook").doc(id).get().then(function(snap){
    if (!snap.exists){ toast("No note found for that link.", true); return; }
    setTab("notebook");
    openNote(Object.assign({ id: snap.id }, snap.data()));
  }).catch(function(){ toast("Couldn't open that note.", true); });
}

function openByLinkSheet(){
  var box = openSheet(
    '<div class="sheet-head"><h2>Open a shared note</h2>' +
    '<button class="sheet-close" aria-label="Close">&times;</button></div>' +
    '<p class="hint">Paste a note link a classmate sent you (or just the code at the end of it).</p>' +
    '<label class="field" style="margin-top:14px;"><span>Link or code</span>' +
    '<input id="olInput" placeholder="…#note=abc123"></label>' +
    '<div class="btn-row" style="margin-top:16px;"><button class="btn" id="olGo">Open note</button></div>'
  );
  function go(){
    var raw = box.querySelector("#olInput").value.trim();
    if (!raw){ toast("Paste a link or code first.", true); return; }
    var id = raw.indexOf("#note=") > -1 ? raw.split("#note=").pop().trim() : raw;
    id = id.replace(/[^A-Za-z0-9_\-.:@+~]/g, "");
    if (!id){ toast("That doesn't look like a note link.", true); return; }
    closeSheet();
    openNoteById(id);
  }
  box.querySelector("#olGo").addEventListener("click", go);
  box.querySelector("#olInput").addEventListener("keydown", function(e){ if (e.key === "Enter") go(); });
}


export { allNotes, deleteNote, localNotes, openByLinkSheet, openNote, openNoteById, openNoteEditor, persistNoteBody, renderNotebook, renderNotebookIntro, saveNote, saveNotebookIntro, setLocalNotes, snippet, subjectOptionsHtml, visHintText, visibleNotes };
