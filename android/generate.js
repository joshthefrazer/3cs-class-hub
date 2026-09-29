// Generates the Android (Trusted Web Activity) project for the 3CS Hub from
// the live web app manifest, using Google's Bubblewrap library.
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');
const path = require('path');

(async () => {
  const log = new ConsoleLog('3cs');
  const url = 'https://joshthefrazer.github.io/3cs-class-hub/manifest.webmanifest';
  const res = await fetch(url);
  const json = await res.json();
  const m = TwaManifest.fromWebManifestJson(new URL(url), json);
  m.packageId = 'bz.itzat.threecshub';
  m.name = '3CS Class Hub';
  m.launcherName = '3CS Hub';
  m.startUrl = '/3cs-class-hub/?source=android';
  m.themeColor = m.themeColor; // from the manifest
  m.navigationColor = m.backgroundColor;
  m.enableNotifications = true;       // the Hub's reminders and message alerts go through Android
  m.fallbackType = 'customtabs';
  m.enableSiteSettingsShortcut = false;
  m.orientation = 'default';
  m.appVersionCode = parseInt(process.env.VERSION_CODE || '1', 10);
  m.appVersionName = process.env.VERSION_NAME || '1.0.0';
  m.minSdkVersion = 23;
  m.signingKey = { path: process.env.KEYSTORE || path.join(__dirname, '3cs-hub-android.keystore'), alias: '3cshub' };
  m.fingerprints = [];
  const target = path.join(__dirname, 'project');
  await new TwaGenerator().createTwaProject(target, m, log);
  await m.saveToFile(path.join(target, 'twa-manifest.json'));
  console.log('generated', target, 'shortcuts', m.shortcuts.length, 'share', !!m.shareTarget);
})().catch(e => { console.error(e); process.exit(1); });
