# 3CS Hub for Android

`../download/3cs-hub.apk` is the Hub as an Android app. It's a Trusted Web
Activity: a thin app that opens the live site full screen in Chrome, so it
updates the moment the site does and never needs rebuilding for site
changes. Notifications from the Hub (class reminders, messages) arrive as
normal Android notifications.

- Package: `bz.itzat.threecshub`
- Signing key SHA-256:
  `47:CB:FD:24:79:22:C0:2A:48:69:39:A5:40:76:A3:C8:97:72:DF:AB:2C:7E:20:5E:37:36:AC:DA:A1:AB:E6:35`

## Full screen needs the site to vouch for the app

Android only drops the browser address bar if the site's root says the
app is allowed, at `https://joshthefrazer.github.io/.well-known/assetlinks.json`.
That file lives in a separate repo named `joshthefrazer.github.io`.

## The signing key

The key (`3cs-hub-android.keystore` and its password) is kept OUT of this
repo, in `Dev/3CS Hub Android key/`. Keep a backup. A new version of the
app must be signed with the same key, or phones will refuse to update it.

## Rebuilding (only if the app itself changes: name, icon, colours)

Needs Node, JDK 17+, and the Android SDK (platform 36, build-tools 36).

```
npm i @bubblewrap/core
node generate.js                  # makes ./project from the live manifest
cd project && ./gradlew assembleRelease
zipalign -p 4 app/build/outputs/apk/release/app-release-unsigned.apk aligned.apk
apksigner sign --ks 3cs-hub-android.keystore --ks-key-alias 3cshub --out 3cs-hub.apk aligned.apk
```

Raise `VERSION_CODE` (e.g. `VERSION_CODE=2 VERSION_NAME=1.0.1 node generate.js`)
for each new build so phones accept it as an update.
