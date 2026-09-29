/* =========================================================
   3CS Hub desktop app - the main process.

   The window shows the real Hub (the same site as the browser), so every
   update to the site reaches the app the moment it's published; this file
   never needs changing for that. What the app adds around it:

     tray          the current class and countdown on hover, and a menu to
                   jump straight to Today, Work, Add assignment or Chat
     stays open    closing the window keeps the Hub in the tray, so class
                   reminders and message alerts keep coming
     notifications real Windows toasts; clicking one opens the right place
     badge         the unread count on the taskbar icon, and a flash when a
                   message arrives while you're elsewhere
     shortcuts     Ctrl+Alt+H shows or hides the Hub, Ctrl+Alt+A adds work
     start up      optional: open quietly in the tray when you log in
     offline       a friendly page (and a retry) if the Hub can't be reached
     sign-in       Google won't sign in inside app windows, so that one step
                   happens in your browser and comes back here

   Security: the page runs sandboxed with no access to Node or the
   computer. The only things it can ask for are the few calls in preload.js,
   and links that leave the Hub always open in your normal browser.
   ========================================================= */
const {
  app, BrowserWindow, Tray, Menu, Notification, nativeImage, shell, ipcMain,
  globalShortcut, session, dialog
} = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

// the live Hub; a development copy can be pointed elsewhere with HUB_URL
const HUB = (!app.isPackaged && process.env.HUB_URL) || "https://joshthefrazer.github.io/3cs-class-hub/";
const HUB_ORIGIN = new URL(HUB).origin;
const HUB_PATH = new URL(HUB).pathname;
const APP_ID = "bz.itzat.3cshub";

let win = null, tray = null, quitting = false, status = "", unread = 0, pendingRoute = null;

/* ------------------------------------------------------------ settings -- */
const SETTINGS_FILE = () => path.join(app.getPath("userData"), "settings.json");
let settings = { closeToTray: true, openAtLogin: false, bounds: null, maximized: false, trayTipShown: false };
function loadSettings(){
  try{ settings = Object.assign(settings, JSON.parse(fs.readFileSync(SETTINGS_FILE(), "utf8"))); }catch(e){}
}
function saveSettings(){
  try{ fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2)); }catch(e){}
}
function setSetting(k, v){
  if (!["closeToTray", "openAtLogin"].includes(k)) return;
  settings[k] = !!v;
  saveSettings();
  if (k === "openAtLogin") applyLogin();
  buildTrayMenu();
}
function applyLogin(){
  try{ app.setLoginItemSettings({ openAtLogin: !!settings.openAtLogin, args: ["--hidden"] }); }catch(e){}
}

/* ------------------------------------------------------------ helpers -- */
function isHub(u){
  try{ const x = new URL(u); return x.origin === HUB_ORIGIN && x.pathname.startsWith(HUB_PATH); }catch(e){ return false; }
}
function openOutside(u){
  try{
    const x = new URL(u);
    if (["https:", "http:", "mailto:"].includes(x.protocol)) shell.openExternal(x.href);
  }catch(e){}
}
function icon(name){ return nativeImage.createFromPath(path.join(__dirname, "assets", name)); }

/* ------------------------------------------------------------- window -- */
function createWindow(startHidden){
  const b = settings.bounds || { width: 1320, height: 860 };
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    minWidth: 380, minHeight: 520,
    show: false,
    title: "3CS Hub",
    icon: icon("icon.png"),
    backgroundColor: "#F3F3F6",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
      backgroundThrottling: false          // reminders keep time while hidden
    }
  });
  if (settings.maximized) win.maximize();

  win.once("ready-to-show", () => { if (!startHidden) win.show(); });

  // links that leave the Hub open in the browser; nothing opens new app windows
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHub(url)) { win.loadURL(url); return { action: "deny" }; }
    openOutside(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (isHub(url) || url.startsWith("file://") && url.includes("offline.html")) return;
    e.preventDefault();
    openOutside(url);
  });

  // no connection and nothing saved yet: a friendly page instead of a blank one
  win.webContents.on("did-fail-load", (e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;          // -3: a navigation was replaced, not a failure
    win.loadFile(path.join(__dirname, "offline.html"));
  });

  win.webContents.on("context-menu", (e, p) => contextMenu(p));
  win.webContents.on("page-title-updated", (e, t) => { /* keeps "(2) S3 LA · 12m left" in the taskbar */ });

  // remember where the window was
  const keep = () => {
    if (!win || win.isDestroyed()) return;
    settings.maximized = win.isMaximized();
    if (!settings.maximized && !win.isMinimized()) settings.bounds = win.getBounds();
    saveSettings();
  };
  win.on("resize", debounce(keep, 400));
  win.on("move", debounce(keep, 400));

  win.on("close", (e) => {
    if (quitting || !settings.closeToTray) return;
    e.preventDefault();
    win.hide();
    if (!settings.trayTipShown){
      settings.trayTipShown = true; saveSettings();
      toast("3CS Hub is still running", "It's in the tray by the clock, so reminders and messages keep coming. Right-click it to quit.");
    }
  });
  win.on("focus", () => { win.flashFrame(false); });

  win.webContents.on("did-finish-load", () => {
    if (pendingRoute){ send("route", pendingRoute); pendingRoute = null; }
  });

  win.loadURL(HUB + "?source=desktop");
}
function debounce(fn, ms){ let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
function send(ch, v){ if (win && !win.isDestroyed()) win.webContents.send(ch, v); }
function showWin(){
  if (!win || win.isDestroyed()) createWindow(false);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function toggleWin(){
  if (win && win.isVisible() && win.isFocused()) win.hide(); else showWin();
}
function go(route){
  showWin();
  if (win.webContents.isLoading()) pendingRoute = route; else send("route", route);
}

/* ------------------------------------------------------- context menu -- */
function contextMenu(p){
  const items = [];
  if (p.misspelledWord && p.dictionarySuggestions.length){
    p.dictionarySuggestions.slice(0, 5).forEach(s => items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) }));
    items.push({ label: "Add to dictionary", click: () => win.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
    items.push({ type: "separator" });
  }
  if (p.linkURL){
    items.push({ label: "Open link in browser", click: () => openOutside(p.linkURL) });
    items.push({ label: "Copy link", click: () => require("electron").clipboard.writeText(p.linkURL) });
    items.push({ type: "separator" });
  }
  if (p.isEditable){
    items.push({ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" });
  } else if (p.selectionText){
    items.push({ role: "copy" });
  }
  if (p.mediaType === "image" && p.srcURL && !p.srcURL.startsWith("data:")){
    items.push({ label: "Open image in browser", click: () => openOutside(p.srcURL) });
  }
  if (!items.length) items.push({ label: "Back", enabled: win.webContents.navigationHistory.canGoBack(), click: () => win.webContents.navigationHistory.goBack() }, { label: "Reload", click: () => win.webContents.reload() });
  Menu.buildFromTemplate(items).popup({ window: win });
}

/* --------------------------------------------------------------- tray -- */
function createTray(){
  tray = new Tray(icon(process.platform === "win32" ? "tray.png" : "tray@2x.png").resize({ width: 16, height: 16 }));
  tray.setToolTip("3CS Hub");
  tray.on("click", toggleWin);
  tray.on("double-click", showWin);
  buildTrayMenu();
}
function buildTrayMenu(){
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: status ? "Right now: " + status : "3CS Hub", enabled: false },
    { type: "separator" },
    { label: "Open 3CS Hub", click: showWin },
    { label: "Today", click: () => go("today") },
    { label: "Work", click: () => go("work") },
    { label: "Add assignment", accelerator: "Ctrl+Alt+A", click: () => go("add-work") },
    { label: "Class chat" + (unread ? " (" + unread + ")" : ""), click: () => go("chat") },
    { label: "Search", click: () => go("search") },
    { type: "separator" },
    { label: "Start with my computer", type: "checkbox", checked: !!settings.openAtLogin, click: (m) => setSetting("openAtLogin", m.checked) },
    { label: "Keep running when closed", type: "checkbox", checked: settings.closeToTray !== false, click: (m) => setSetting("closeToTray", m.checked) },
    { type: "separator" },
    { label: "Quit 3CS Hub", click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(status ? "3CS Hub · " + status : "3CS Hub");
}

/* ------------------------------------------------------ notifications -- */
function toast(title, body, route){
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: String(title).slice(0, 120), body: String(body || "").slice(0, 300), icon: icon("icon.png"), silent: false });
  n.on("click", () => { if (route) go(route); else showWin(); });
  n.show();
}

/* --------------------------------------------------------------- badge -- */
function setBadge(n, overlayDataUrl){
  unread = Math.max(0, Math.min(999, parseInt(n, 10) || 0));
  try{ app.setBadgeCount(unread); }catch(e){}
  if (process.platform === "win32" && win && !win.isDestroyed()){
    try{
      if (unread && typeof overlayDataUrl === "string" && overlayDataUrl.startsWith("data:image/png;base64,")){
        win.setOverlayIcon(nativeImage.createFromDataURL(overlayDataUrl), unread + " unread");
      } else {
        win.setOverlayIcon(null, "");
      }
    }catch(e){}
  }
  if (unread && win && !win.isFocused()) win.flashFrame(true);
  buildTrayMenu();
}

/* ---------------------------------------------- Google sign-in bridge -- */
/* Google blocks its sign-in page inside app windows. So: listen on this
   computer only, open the Hub in the normal browser with a one-time code,
   and wait for it to hand the Google sign-in back. */
let authServer = null;
function googleSignIn(){
  return new Promise((resolve, reject) => {
    if (authServer){ try{ authServer.close(); }catch(e){} authServer = null; }
    const nonce = crypto.randomBytes(16).toString("hex");
    const timer = setTimeout(() => { done(); reject(new Error("Sign-in timed out. Try again.")); }, 5 * 60 * 1000);
    function done(){ clearTimeout(timer); if (authServer){ try{ authServer.close(); }catch(e){} authServer = null; } }
    authServer = http.createServer((req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.pathname !== "/done" || u.searchParams.get("state") !== nonce){
        res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return;
      }
      const idToken = u.searchParams.get("id_token") || "";
      const accessToken = u.searchParams.get("access_token") || "";
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Signed in</title>' +
        '<body style="font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;background:#F3F3F6;color:#1A1726">' +
        '<div style="text-align:center"><h1 style="font-size:1.4rem">You\'re signed in to the 3CS desktop app</h1><p>You can close this tab.</p></div></body>');
      done();
      showWin();
      if (idToken) resolve({ idToken, accessToken }); else reject(new Error("Google didn't send a sign-in back."));
    });
    authServer.on("error", (e) => { done(); reject(e); });
    authServer.listen(0, "127.0.0.1", () => {
      const port = authServer.address().port;
      shell.openExternal(HUB + "?desktop_auth=" + port + "." + nonce);
    });
  });
}

/* ----------------------------------------------------------------- ipc -- */
function fromHub(e){ try{ return isHub(e.senderFrame.url); }catch(x){ return false; } }
function wireIpc(){
  ipcMain.on("hub:version", (e) => { e.returnValue = app.getVersion(); });
  ipcMain.on("hub:status", (e, s) => { if (!fromHub(e)) return; status = String(s || "").slice(0, 80); buildTrayMenu(); });
  ipcMain.on("hub:badge", (e, n, img) => { if (!fromHub(e)) return; setBadge(n, img); });
  ipcMain.on("hub:notify", (e, o) => {
    if (!fromHub(e) || !o) return;
    const routes = ["", "today", "work", "chat", "add-work", "search", "notebook", "help", "announcements", "calendar", "people", "voice"];
    toast(o.title || "3CS Hub", o.body || "", routes.includes(o.route) ? o.route : "");
  });
  ipcMain.on("hub:show", (e) => { if (fromHub(e)) showWin(); });
  ipcMain.on("hub:set", (e, k, v) => { if (fromHub(e)) setSetting(k, v); });
  ipcMain.on("hub:get", (e, k) => { e.returnValue = fromHub(e) && ["closeToTray", "openAtLogin"].includes(k) ? settings[k] : null; });
  ipcMain.handle("hub:google", (e) => { if (!fromHub(e)) throw new Error("Not allowed"); return googleSignIn(); });
  // the offline page's retry button
  ipcMain.on("hub:retry", () => { if (win) win.loadURL(HUB + "?source=desktop"); });
}

/* -------------------------------------------------------------- update -- */
function checkForUpdates(){
  try{
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("update-downloaded", () => toast("3CS Hub update ready", "It installs the next time the app closes."));
    autoUpdater.checkForUpdates().catch(() => {});
  }catch(e){}
}

/* ---------------------------------------------------------------- boot -- */
if (!app.requestSingleInstanceLock()){
  app.quit();
} else {
  app.on("second-instance", () => showWin());
  app.setAppUserModelId(APP_ID);
  loadSettings();

  app.whenReady().then(() => {
    // the Hub may ask for notifications; nothing else (camera, location...) is handed out
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => {
      cb(["notifications", "clipboard-sanitized-write", "fullscreen"].includes(perm) && isHub(details.requestingUrl || wc.getURL()));
    });
    session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => perm === "notifications" && origin === HUB_ORIGIN);

    // a hidden menu just for the keyboard: zoom, reload, back
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: "View", submenu: [
        { role: "reload" }, { role: "forceReload" },
        { role: "zoomIn" }, { role: "zoomIn", accelerator: "CommandOrControl+=", visible: false }, { role: "zoomOut" }, { role: "resetZoom" },
        { role: "togglefullscreen" },
        { label: "Back", accelerator: "Alt+Left", click: () => win && win.webContents.navigationHistory.canGoBack() && win.webContents.navigationHistory.goBack() },
        { role: "toggleDevTools", visible: false }
      ] },
      { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] }
    ]));

    wireIpc();
    createWindow(process.argv.includes("--hidden"));
    createTray();
    applyLogin();

    try{ globalShortcut.register("Control+Alt+H", toggleWin); }catch(e){}
    try{ globalShortcut.register("Control+Alt+A", () => go("add-work")); }catch(e){}

    if (app.isPackaged) setTimeout(checkForUpdates, 15000);
  });

  app.on("before-quit", () => { quitting = true; });
  app.on("will-quit", () => { globalShortcut.unregisterAll(); });
  app.on("window-all-closed", () => { if (quitting || !settings.closeToTray) app.quit(); });
  app.on("activate", showWin);
  // no other windows or webviews, ever
  app.on("web-contents-created", (e, wc) => {
    wc.on("will-attach-webview", (ev) => ev.preventDefault());
  });
}
