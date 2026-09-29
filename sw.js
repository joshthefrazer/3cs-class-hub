/* =========================================================
   3CS Hub offline copy (service worker).

   The rule is simple on purpose: when there's a connection the Hub always
   loads fresh from the site, exactly as it would without this file, so an
   update can never be held back by an old copy. Every file that loads is
   also saved, and when there is no connection (or the school Wi-Fi drops)
   the saved copy opens instead: the timetable, bell times and calendar all
   work offline, and Firebase shows the class data it last saw.

   Nothing here needs changing when the site changes. New files are saved
   the first time they load. The list below only warms the copy on install.
   ========================================================= */
var CACHE = "3cs-hub-v1";
var WARM = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/itzat-glyph.svg",
  "assets/icon-180.png",
  "assets/app/icon-192.png",
  "assets/app/icon-512.png",
  "assets/campus/bg-front.webp",
  "styles/components.css",
  "styles/features.css",
  "styles/intro.css",
  "styles/layout.css",
  "styles/social.css",
  "styles/theme.css",
  "js/admin.js",
  "js/adminpanel.js",
  "js/ann.js",
  "js/app.js",
  "js/auth.js",
  "js/backend.js",
  "js/cal.js",
  "js/campus.js",
  "js/chat.js",
  "js/classroom.js",
  "js/data.js",
  "js/emoji.js",
  "js/fx.js",
  "js/help.js",
  "js/intro.js",
  "js/layout.js",
  "js/links.js",
  "js/live.js",
  "js/main.js",
  "js/media.js",
  "js/notebook.js",
  "js/notify.js",
  "js/orbit.js",
  "js/palette.js",
  "js/people.js",
  "js/profile.js",
  "js/roles.js",
  "js/sched.js",
  "js/settings.js",
  "js/state.js",
  "js/stickers.js",
  "js/text.js",
  "js/theme.js",
  "js/updates.js",
  "js/voice.js",
  "js/work.js"
];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    // one missing file must not stop the rest being saved
    return Promise.all(WARM.map(function(u){
      return fetch(u, { cache: "reload" }).then(function(r){ if (r.ok) return c.put(u, r); }).catch(function(){});
    }));
  }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k.indexOf("3cs-hub-") === 0 && k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function save(req, res){
  if (res && (res.ok || res.type === "opaque")){
    var copy = res.clone();
    caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
  }
  return res;
}
function fromCache(req){
  return caches.match(req, { ignoreSearch: true }).then(function(hit){
    if (hit) return hit;
    if (req.mode === "navigate") return caches.match("index.html").then(function(h){ return h || caches.match("./"); });
    return Response.error();
  });
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // the Firebase library is versioned in its address, so a saved copy is always right
  if (url.hostname === "cdn.jsdelivr.net" && url.pathname.indexOf("/npm/firebase@") === 0){
    e.respondWith(caches.match(req).then(function(hit){ return hit || fetch(req).then(function(r){ return save(req, r); }); }));
    return;
  }
  // fonts: use what's saved, refresh it in the background
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com"){
    e.respondWith(caches.match(req).then(function(hit){
      var net = fetch(req).then(function(r){ return save(req, r); }).catch(function(){ return hit; });
      return hit || net;
    }));
    return;
  }
  // everything else off-site (the database, sign-in) is left alone
  if (url.origin !== self.location.origin) return;

  // the Android app download goes straight to the network, never into the saved copy
  if (url.pathname.indexOf("/download/") > -1) return;
  // the site itself: fresh from the network, the saved copy only when offline
  e.respondWith(fetch(req).then(function(r){ return save(req, r); }).catch(function(){ return fromCache(req); }));
});

/* a reminder or message notification was clicked */
self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var route = (e.notification.data && e.notification.data.route) || "";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++){
      if ("focus" in list[i]){ list[i].postMessage({ type: "route", route: route }); return list[i].focus(); }
    }
    return self.clients.openWindow("./" + (route ? "?do=" + route : ""));
  }));
});

self.addEventListener("message", function(e){
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
