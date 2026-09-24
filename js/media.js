import { BE, usingFirebase, toast, dbErrMsg } from "./backend.js";
import { svgIcon } from "./text.js";

/* =========================================================
   PICTURES - shrinking, storing and showing them.

   The free Firebase plan has no file storage, so a picture is squeezed in
   the browser and saved as text in its own small document:

     media/{id}  { uid, scope, cid?, kind, data, w, h, createdAt }

   Messages and notes only carry the id, so a chat list or the notebook
   loads instantly and each picture is fetched once, when it scrolls into
   view, and then kept in memory.

   scope decides who can open it (the rules check this):
     "hub"   anyone signed in (the class chat, public notes)
     "convo" only the people in one conversation (cid)
     "user"  only you (private notes)
   ========================================================= */

var MAX_IMAGE_CHARS = 330000;   // about 240 KB of JPEG/WebP
var MAX_GIF_BYTES = 680 * 1024; // stays under Firestore's 1 MB document limit once encoded
var cache = {};                 // id -> Promise<{data,w,h}>

function readAsDataURL(file){
  return new Promise(function(res, rej){
    var r = new FileReader();
    r.onload = function(){ res(r.result); };
    r.onerror = function(){ rej(new Error("read")); };
    r.readAsDataURL(file);
  });
}
function loadImg(src){
  return new Promise(function(res, rej){
    var im = new Image();
    im.decoding = "async";
    im.onload = function(){ res(im); };
    im.onerror = function(){ rej(new Error("decode")); };
    im.src = src;
  });
}

/* Any photo in, a small JPEG or WebP out. Big phone photos are scaled so
   the long side is at most `max` pixels, then quality steps down until the
   result fits. */
function compressImage(file, max, limit){
  max = max || 1400; limit = limit || MAX_IMAGE_CHARS;
  if (!file || !/^image\//.test(file.type)) return Promise.reject(new Error("That file isn't a picture."));
  if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error("That picture is over 25 MB. Try a smaller one."));
  var url = URL.createObjectURL(file);
  return loadImg(url).then(function(im){
    URL.revokeObjectURL(url);
    var w = im.naturalWidth, h = im.naturalHeight;
    var scale = Math.min(1, max / Math.max(w, h));
    var out = null, dims = null, sizes = [scale, scale * .8, scale * .64, scale * .5];
    for (var s = 0; s < sizes.length && !out; s++){
      var cw = Math.max(1, Math.round(w * sizes[s])), ch = Math.max(1, Math.round(h * sizes[s]));
      var c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";           // transparent PNGs get a white page, not black
      ctx.fillRect(0, 0, cw, ch);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, 0, 0, cw, ch);
      var fmt = "image/webp";
      var probe = c.toDataURL(fmt, .8);
      if (probe.indexOf("data:image/webp") !== 0) fmt = "image/jpeg";
      for (var q = .86; q >= .5; q -= .08){
        var d = c.toDataURL(fmt, q);
        if (d.length <= limit){ out = d; dims = { w: cw, h: ch }; break; }
      }
    }
    if (!out) throw new Error("Couldn't shrink that picture enough. Try another one.");
    return { data: out, w: dims.w, h: dims.h, kind: "image" };
  }).catch(function(e){
    URL.revokeObjectURL(url);
    throw e && e.message === "decode" ? new Error("Couldn't open that picture. Try a JPG or PNG.") : e;
  });
}

/* A GIF can't be re-squeezed in the browser without losing the movement,
   so it goes up as it is, if it's small enough. A still first frame is
   made for the GIF library's grid. */
function prepareGif(file){
  if (!file || file.type !== "image/gif") return Promise.reject(new Error("That isn't a GIF."));
  if (file.size > MAX_GIF_BYTES) return Promise.reject(new Error("That GIF is " + Math.round(file.size / 1024) + " KB. The limit is 680 KB, so try a shorter or smaller one."));
  return readAsDataURL(file).then(function(data){
    return loadImg(data).then(function(im){
      var w = im.naturalWidth, h = im.naturalHeight;
      var s = Math.min(1, 240 / Math.max(w, h));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      var thumb = c.toDataURL("image/jpeg", .72);
      if (thumb.length > 38000) thumb = c.toDataURL("image/jpeg", .5);
      return { data: data, w: w, h: h, kind: "gif", thumb: thumb };
    });
  });
}

function mediaCol(){ return BE.db.collection("media"); }

/* Saves one picture and resolves with its id. */
function uploadMedia(m, scope, cid){
  if (!BE.db) return Promise.reject(new Error("Pictures need a connection to the Hub."));
  var ref = mediaCol().doc();
  var row = {
    uid: BE.user ? BE.user.id : "device",
    scope: scope || "hub",
    kind: m.kind || "image",
    data: m.data,
    w: Math.round(m.w) || 1,
    h: Math.round(m.h) || 1,
    createdAt: usingFirebase() ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
  };
  if (scope === "convo") row.cid = cid;
  cache[ref.id] = Promise.resolve({ data: m.data, w: row.w, h: row.h, scope: row.scope, uid: row.uid });
  return ref.set(row).then(function(){ return ref.id; }, function(err){
    delete cache[ref.id];
    throw err;
  });
}

function loadMedia(id){
  if (!id) return Promise.reject(new Error("no id"));
  if (cache[id]) return cache[id];
  var ref = mediaCol().doc(id);
  var p = (usingFirebase()
    ? ref.get({ source: "cache" }).catch(function(){ return ref.get(); }).then(function(s){ return s.exists ? s : ref.get(); })
    : ref.get()
  ).then(function(s){
    if (!s.exists) throw new Error("gone");
    var d = s.data();
    return { data: d.data, w: d.w, h: d.h, scope: d.scope, uid: d.uid };
  });
  cache[id] = p;
  p.catch(function(){ delete cache[id]; });
  return p;
}

/* A picture element that fetches its data only when it's about to be seen. */
var io = null;
function lazy(el, fn){
  if (!("IntersectionObserver" in window)){ fn(); return; }
  if (!io){
    io = new IntersectionObserver(function(en){
      en.forEach(function(e){
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var f = e.target.__load; e.target.__load = null;
        if (f) f();
      });
    }, { rootMargin: "300px 0px" });
  }
  el.__load = fn;
  io.observe(el);
}
function mediaEl(id, w, h, opts){
  opts = opts || {};
  var b = document.createElement("button");
  b.type = "button";
  b.className = (opts.cls || "msg-media") + " loading";
  b.setAttribute("aria-label", opts.label || "Open picture");
  if (w && h){
    var maxW = opts.maxW || 300, maxH = opts.maxH || 320;
    var s = Math.min(1, maxW / w, maxH / h);
    b.style.width = Math.round(w * s) + "px";
    b.style.aspectRatio = w + " / " + h;
  }
  lazy(b, function(){
    loadMedia(id).then(function(m){
      var img = document.createElement("img");
      img.alt = opts.alt || "";
      img.decoding = "async";
      img.src = m.data;
      b.appendChild(img);
      b.classList.remove("loading");
      b.addEventListener("click", function(){ openLightbox(m.data, opts.alt); });
    }).catch(function(){
      b.classList.remove("loading");
      b.classList.add("failed");
      b.textContent = "This picture isn't available.";
    });
  });
  return b;
}

/* Full-screen view of one picture. */
function openLightbox(src, alt){
  var lb = document.createElement("div");
  lb.className = "lightbox";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Picture");
  var img = document.createElement("img");
  img.src = src; img.alt = alt || "";
  var bar = document.createElement("div");
  bar.className = "lb-bar";
  var dl = document.createElement("a");
  dl.href = src;
  dl.download = "3cs-picture." + ((/^data:image\/(\w+)/.exec(src) || [0, "jpg"])[1].replace("jpeg", "jpg"));
  dl.setAttribute("aria-label", "Save picture");
  dl.innerHTML = svgIcon("i-download");
  var x = document.createElement("button");
  x.type = "button";
  x.setAttribute("aria-label", "Close");
  x.innerHTML = svgIcon("i-close");
  bar.appendChild(dl); bar.appendChild(x);
  lb.appendChild(img); lb.appendChild(bar);
  function close(){ lb.remove(); document.removeEventListener("keydown", onKey, true); }
  function onKey(e){ if (e.key === "Escape"){ e.stopPropagation(); close(); } }
  lb.addEventListener("click", function(e){ if (e.target === lb) close(); });
  x.addEventListener("click", close);
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(lb);
  x.focus();
}

/* A file picker without a visible input. */
function pickFiles(accept, multiple){
  return new Promise(function(res){
    var i = document.createElement("input");
    i.type = "file"; i.accept = accept || "image/*"; i.multiple = !!multiple;
    i.style.display = "none";
    i.addEventListener("change", function(){ res(Array.prototype.slice.call(i.files || [])); i.remove(); });
    document.body.appendChild(i);
    i.click();
  });
}

function mediaError(e){
  if (e && e.code) return dbErrMsg(e);
  return (e && e.message) || "Couldn't add that picture.";
}

export { compressImage, prepareGif, uploadMedia, loadMedia, mediaEl, openLightbox, pickFiles, mediaError, lazy };
