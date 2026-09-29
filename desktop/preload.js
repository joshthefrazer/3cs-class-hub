/* =========================================================
   The only door between the Hub page and the desktop app.

   The page runs sandboxed; this exposes a handful of plain calls as
   window.hubDesktop and nothing else. The Hub's js/app.js looks for it and,
   when it's there, uses it for the tray, toasts, the taskbar badge and
   Google sign-in. The main process also checks every message came from the
   Hub's own address before acting on it.
   ========================================================= */
const { contextBridge, ipcRenderer } = require("electron");

let routeFn = null;
ipcRenderer.on("route", (e, r) => { if (typeof routeFn === "function") routeFn(String(r || "")); });

/* A small red count for the taskbar icon, drawn here because the page is
   the only place with a canvas handy. */
function badgeImage(n){
  try{
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    g.fillStyle = "#D93A4A";
    g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff";
    g.font = "bold " + (n > 9 ? 15 : 19) + "px Segoe UI, Arial, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(n > 99 ? "99+" : String(n), 16, 17);
    return c.toDataURL("image/png");
  }catch(e){ return ""; }
}

contextBridge.exposeInMainWorld("hubDesktop", {
  isDesktop: true,
  version: ipcRenderer.sendSync("hub:version"),
  setStatus: (text) => ipcRenderer.send("hub:status", String(text || "").slice(0, 80)),
  setBadge: (n) => { n = Math.max(0, parseInt(n, 10) || 0); ipcRenderer.send("hub:badge", n, n ? badgeImage(n) : ""); },
  notify: (o) => ipcRenderer.send("hub:notify", {
    title: String((o && o.title) || "").slice(0, 120),
    body: String((o && o.body) || "").slice(0, 300),
    route: String((o && o.route) || "").slice(0, 20)
  }),
  show: () => ipcRenderer.send("hub:show"),
  onRoute: (fn) => { routeFn = fn; },
  getSetting: (k) => ipcRenderer.sendSync("hub:get", String(k)),
  setSetting: (k, v) => ipcRenderer.send("hub:set", String(k), !!v),
  googleSignIn: () => ipcRenderer.invoke("hub:google"),
  retry: () => ipcRenderer.send("hub:retry")
});
