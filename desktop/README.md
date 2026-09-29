# 3CS Hub for Windows

The 3CS Class Hub as a desktop app. The window shows the live Hub, so every
update to the site reaches the app straight away. The app adds:

- **Tray**: hover to see the current class and time left; right-click for
  Today, Work, Add assignment, Class chat and Search.
- **Keeps running when closed**, so class reminders and message alerts still
  arrive. Quit from the tray menu.
- **Reminders**: a heads-up 5 minutes before each class and a homework check
  at 6 PM (change or turn off in Settings > Reminders).
- **Taskbar badge** with the unread count, and a flash when a message arrives.
- **Shortcuts**: Ctrl+Alt+H shows or hides the Hub from anywhere,
  Ctrl+Alt+A jumps straight to adding an assignment.
- **Start with my computer** (optional): opens quietly in the tray at login.
- **Right-click menu** with copy, paste and spelling suggestions.
- **Offline page** with automatic retry; once you've opened the Hub online,
  the timetable works offline too.
- **Google sign-in** happens in your normal browser for one step (Google
  doesn't allow it inside app windows) and comes straight back.

## Installing

Run `3CS-Hub-Setup-<version>.exe`. The installer isn't code-signed, so
Windows may say "Windows protected your PC": choose **More info**, then
**Run anyway**.

## Building

```
cd desktop
npm install
npm start            # run it against the live Hub
npm run dist         # build dist/3CS-Hub-Setup-<version>.exe
```

`HUB_URL=http://127.0.0.1:8822/ npm start` points a development copy at a
local server instead.

## Releasing

`release-workflow.yml` is a GitHub Actions workflow that builds the
installer on Windows and publishes it as a GitHub release. To turn it on,
move it to `.github/workflows/desktop.yml` in the repo (GitHub Desktop will
show it as a new file to commit). It publishes the release, which is where the Hub's
Settings > Reminders > Download link points. Run it from the Actions tab
(Run workflow) after raising `version` in `package.json`. Installed copies
update themselves from the newest release.
