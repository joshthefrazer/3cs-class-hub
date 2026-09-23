import { BE, dbErrMsg, meId, paintAuth, signOutNow, toast, usingFirebase } from "./backend.js";
import { state } from "./state.js";
import { closeSheet, esc, openSheet } from "./text.js";
import { registerCommands } from "./palette.js";

/* =========================================================
   PROFILES — a name and a photo for everyone in the class.

   The photo is cropped in the browser to a small square (256px, WebP or
   JPEG, usually 10–25 KB) and stored as text right on the profile
   document. The Firebase free plan has no file storage, and a picture this
   size costs about the same to read as a long message, so ten people
   loading the Hub a few times a day stays far inside the free limits.

   profiles/{uid}  { name, photo, updatedAt }
   Only you can write yours; the security rules check the photo really is
   a small image and not anything else.
   ========================================================= */

var GRADS = [
  ["#6A3DE8","#F26B1D"], ["#2F6BEF","#6A3DE8"], ["#F26B1D","#D6456A"], ["#0F9D6B","#2F6BEF"],
  ["#8A4DF0","#2F6BEF"], ["#E8601A","#F4A340"], ["#5B4FD6","#0E9FB5"], ["#D6456A","#8A4DF0"]
];
function hash(s){ var h = 7; s = String(s || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function initials(name){
  var p = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function profileOf(uid){ return (state.profiles && uid && state.profiles[uid]) || null; }
function displayName(uid, fallback){
  var p = profileOf(uid);
  return (p && p.name) || fallback || "Someone";
}

/* One avatar element: the photo if there is one, otherwise initials on a
   gradient picked from the uid so each person keeps their colour. */
function avatarEl(uid, name, size){
  var p = profileOf(uid);
  var nm = (p && p.name) || name || "";
  var el = document.createElement("span");
  el.className = "avatar" + (size ? " " + size : "");
  var g = GRADS[hash(uid || nm) % GRADS.length];
  el.style.setProperty("--a1", g[0]);
  el.style.setProperty("--a2", g[1]);
  if (p && p.photo && /^data:image\/(webp|jpeg|png);base64,/.test(p.photo)){
    var img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.src = p.photo;
    el.appendChild(img);
  } else {
    el.textContent = initials(nm);
  }
  el.setAttribute("aria-hidden", "true");
  return el;
}

/* ---------------------------------------------------------- header -- */
function paintMe(){
  var b = document.getElementById("meBtn");
  if (!b) return;
  var me = usingFirebase() ? BE.user : null;
  if (!me){ b.hidden = true; b.innerHTML = ""; return; }
  b.hidden = false;
  b.innerHTML = "";
  b.appendChild(avatarEl(me.id, me.name, "md"));
  b.setAttribute("aria-label", "Your profile — " + displayName(me.id, me.name));
  b.title = displayName(me.id, me.name) + (BE.isAdmin ? " · admin" : "");
}

var listeners = [];
function onProfiles(fn){ listeners.push(fn); }
function setProfiles(map){
  state.profiles = map || {};
  /* Your own chosen name wins over whatever the sign-in provider says. */
  if (BE.user && state.profiles[BE.user.id] && state.profiles[BE.user.id].name){
    BE.user.name = state.profiles[BE.user.id].name;
  }
  paintMe();
  listeners.forEach(function(fn){ try{ fn(); }catch(e){} });
}

/* ------------------------------------------------------------ cropper -- */
function Cropper(canvas, onChange){
  var ctx = canvas.getContext("2d");
  var img = null, S = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var zoom = 1, ox = 0, oy = 0, base = 1;
  var ptrs = {}, pinch0 = 0, zoom0 = 1;

  function size(){
    S = canvas.clientWidth || 280;
    canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
  }
  function clamp(){
    if (!img) return;
    var w = img.naturalWidth * base * zoom, h = img.naturalHeight * base * zoom;
    var mx = Math.max(0, (w - S) / 2), my = Math.max(0, (h - S) / 2);
    ox = Math.max(-mx, Math.min(mx, ox));
    oy = Math.max(-my, Math.min(my, oy));
  }
  function draw(target, T){
    var c = target || ctx, k = T ? T / S : dpr;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    if (img){
      var w = img.naturalWidth * base * zoom, h = img.naturalHeight * base * zoom;
      c.imageSmoothingQuality = "high";
      c.drawImage(img, (S / 2 + ox - w / 2) * k, (S / 2 + oy - h / 2) * k, w * k, h * k);
    }
    c.restore();
  }
  function setZoom(z){
    zoom = Math.max(1, Math.min(4, z));
    clamp(); draw();
    if (onChange) onChange(zoom);
  }
  canvas.addEventListener("pointerdown", function(e){
    if (!img) return;
    canvas.setPointerCapture(e.pointerId);
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(ptrs);
    if (ids.length === 2){
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = zoom;
    }
  });
  canvas.addEventListener("pointermove", function(e){
    var p = ptrs[e.pointerId];
    if (!p) return;
    var ids = Object.keys(ptrs);
    if (ids.length === 1){
      ox += e.clientX - p.x; oy += e.clientY - p.y;
      clamp(); draw();
    }
    p.x = e.clientX; p.y = e.clientY;
    if (ids.length === 2 && pinch0){
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      setZoom(zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0);
    }
  });
  function up(e){ delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch0 = 0; }
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", function(e){
    if (!img) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  }, { passive:false });
  canvas.tabIndex = 0;
  canvas.addEventListener("keydown", function(e){
    var step = 8;
    if (e.key === "ArrowLeft"){ ox += step; } else if (e.key === "ArrowRight"){ ox -= step; }
    else if (e.key === "ArrowUp"){ oy += step; } else if (e.key === "ArrowDown"){ oy -= step; }
    else if (e.key === "+" || e.key === "="){ setZoom(zoom * 1.1); return; }
    else if (e.key === "-"){ setZoom(zoom / 1.1); return; }
    else return;
    e.preventDefault(); clamp(); draw();
  });

  return {
    load: function(image){
      img = image; size();
      base = S / Math.min(img.naturalWidth, img.naturalHeight);
      zoom = 1; ox = 0; oy = 0; draw();
      if (onChange) onChange(zoom);
    },
    setZoom: setZoom,
    has: function(){ return !!img; },
    /* Square export; the circle is applied when it's shown. */
    export: function(){
      var out = document.createElement("canvas");
      out.width = out.height = 256;
      draw(out.getContext("2d"), 256);
      var url = out.toDataURL("image/webp", 0.86);
      if (url.indexOf("data:image/webp") !== 0) url = out.toDataURL("image/jpeg", 0.86);
      var q = 0.78;
      while (url.length > 60000 && q > 0.4){
        url = out.toDataURL(url.indexOf("webp") > -1 ? "image/webp" : "image/jpeg", q);
        q -= 0.1;
      }
      return url;
    }
  };
}

/* -------------------------------------------------------------- sheet -- */
function openProfileSheet(){
  if (usingFirebase() && !BE.user){ toast("Sign in first.", true); return; }
  var uid = meId();
  var me = profileOf(uid) || {};
  var name0 = me.name || (BE.user && BE.user.name) || "";
  var photo = me.photo || "";
  var photoChanged = false;

  var box = openSheet(
    '<div class="sheet-head"><h2 id="pfHead">Your profile</h2>' +
    '<button class="sheet-close" type="button" aria-label="Close"><svg class="ic" aria-hidden="true"><use href="#i-close"></use></svg></button></div>' +
    '<div class="profile-top"><span id="pfAvatarSlot"></span><div><h2 id="pfShowName"></h2><p id="pfEmail"></p></div></div>' +
    '<label class="field"><span>Your name, as the class sees it</span><input id="pfName" maxlength="40" autocomplete="name"></label>' +
    '<div style="margin-top:16px">' +
      '<div class="field"><span>Profile picture</span></div>' +
      '<label class="drop-zone" id="pfDrop" style="margin-top:6px">' +
        '<svg class="ic" aria-hidden="true"><use href="#i-image"></use></svg>' +
        '<span>Choose a photo, or drop one here</span><small>JPG, PNG or WebP · you can zoom and move it next</small>' +
        '<input id="pfFile" type="file" accept="image/*" class="sr-only">' +
      '</label>' +
      '<div id="pfCropWrap" hidden>' +
        '<div class="crop-stage"><canvas id="pfCanvas" aria-label="Photo preview. Drag to move, use the slider or plus and minus to zoom."></canvas><div class="crop-ring"></div></div>' +
        '<div class="crop-zoom"><svg class="ic" aria-hidden="true"><use href="#i-minus"></use></svg>' +
        '<input id="pfZoom" type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">' +
        '<svg class="ic" aria-hidden="true"><use href="#i-plus"></use></svg></div>' +
        '<div class="crop-hint">Drag the photo to line it up inside the circle.</div>' +
        '<div class="btn-row" style="justify-content:center;margin-top:8px"><button class="linkbtn" id="pfPick" type="button">Pick a different photo</button></div>' +
      '</div>' +
    '</div>' +
    '<div class="sheet-actions">' +
      '<button class="btn ghost sm" id="pfSignOut" type="button" style="margin-right:auto"><svg class="ic" aria-hidden="true"><use href="#i-logout"></use></svg> Sign out</button>' +
      '<button class="linkbtn danger" id="pfRemove" type="button"' + (photo ? '' : ' hidden') + '>Remove photo</button>' +
      '<button class="btn" id="pfSave" type="button">Save profile</button>' +
    '</div>'
  );
  box.classList.add("profile-box");
  box.setAttribute("aria-labelledby", "pfHead");

  var nameIn = box.querySelector("#pfName");
  nameIn.value = name0;
  box.querySelector("#pfEmail").textContent = (BE.user && BE.user.email) || "Signed in on this device";
  if (!usingFirebase()) box.querySelector("#pfSignOut").hidden = true;

  function paintTop(){
    var slot = box.querySelector("#pfAvatarSlot");
    slot.innerHTML = "";
    var tmp = {}; tmp[uid] = { name: nameIn.value.trim() || name0, photo: photo };
    var saved = state.profiles; state.profiles = Object.assign({}, saved || {}, tmp);
    slot.appendChild(avatarEl(uid, nameIn.value, "lg"));
    state.profiles = saved;
    box.querySelector("#pfShowName").textContent = nameIn.value.trim() || "Your name";
  }
  paintTop();
  nameIn.addEventListener("input", paintTop);

  var wrap = box.querySelector("#pfCropWrap"), drop = box.querySelector("#pfDrop");
  var zoomIn = box.querySelector("#pfZoom");
  var crop = Cropper(box.querySelector("#pfCanvas"), function(z){ zoomIn.value = z; });
  zoomIn.addEventListener("input", function(){ crop.setZoom(parseFloat(zoomIn.value)); });

  function take(file){
    if (!file) return;
    if (!/^image\//.test(file.type)){ toast("That file isn't an image.", true); return; }
    if (file.size > 15 * 1024 * 1024){ toast("That photo is over 15 MB — try a smaller one.", true); return; }
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function(){
      drop.hidden = true; wrap.hidden = false;
      requestAnimationFrame(function(){ crop.load(im); URL.revokeObjectURL(url); });
      photoChanged = true;
    };
    im.onerror = function(){ URL.revokeObjectURL(url); toast("Couldn't open that image. Try a JPG or PNG.", true); };
    im.src = url;
  }
  var fileIn = box.querySelector("#pfFile");
  fileIn.addEventListener("change", function(){ take(fileIn.files && fileIn.files[0]); fileIn.value = ""; });
  box.querySelector("#pfPick").addEventListener("click", function(){ fileIn.click(); });
  ["dragenter","dragover"].forEach(function(t){ drop.addEventListener(t, function(e){ e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave","drop"].forEach(function(t){ drop.addEventListener(t, function(){ drop.classList.remove("over"); }); });
  drop.addEventListener("drop", function(e){ e.preventDefault(); take(e.dataTransfer && e.dataTransfer.files[0]); });

  box.querySelector("#pfRemove").addEventListener("click", function(){
    photo = ""; photoChanged = true;
    wrap.hidden = true; drop.hidden = false;
    box.querySelector("#pfRemove").hidden = true;
    paintTop();
  });
  box.querySelector("#pfSignOut").addEventListener("click", function(){ closeSheet(); signOutNow(); });

  var saveBtn = box.querySelector("#pfSave");
  saveBtn.addEventListener("click", function(){
    var nm = nameIn.value.trim().replace(/\s+/g, " ");
    if (!nm){ toast("Put in a name.", true); nameIn.focus(); return; }
    if (nm.length > 40){ toast("Keep the name under 40 characters.", true); return; }
    if (photoChanged && crop.has()) photo = crop.export();
    if (photo.length > 90000){ toast("That photo is still too big after shrinking — try another.", true); return; }
    if (!BE.db){ toast("Saving isn't available in this view.", true); return; }
    saveBtn.disabled = true; saveBtn.textContent = "Saving…";
    var row = { name: nm, photo: photo, updatedAt: new Date().toISOString() };
    BE.db.doc("profiles/" + uid).set(row).then(function(){
      /* New posts are signed with the account's display name, so keep it
         in step with the profile. */
      var u = BE.auth && BE.auth.currentUser;
      var p = (u && u.displayName !== nm) ? u.updateProfile({ displayName: nm }).catch(function(){}) : Promise.resolve();
      return p;
    }).then(function(){
      var map = Object.assign({}, state.profiles || {}); map[uid] = row;
      if (BE.user) BE.user.name = nm;
      setProfiles(map);
      paintAuth();
      closeSheet();
      toast("Profile saved.");
    }).catch(function(err){
      saveBtn.disabled = false; saveBtn.textContent = "Save profile";
      toast(dbErrMsg(err), true);
    });
  });
}

function initProfile(){
  var b = document.getElementById("meBtn");
  if (b) b.addEventListener("click", openProfileSheet);
  registerCommands(function(){
    if (usingFirebase() && !BE.user) return [];
    return [{ kind:"Do", title:"Edit my profile", hint:"name and photo", run:openProfileSheet }];
  });
  paintMe();
}

export { avatarEl, displayName, initProfile, onProfiles, openProfileSheet, paintMe, profileOf, setProfiles };
