# 3CS Class Hub

The class website for **3CS at Itz'at STEAM Academy**, 2026-2027: today's classes, what's due, class notes, the help board, the calendar, everyone's school email, and a class chat with private and group messages.

Concept by Joshua Malic, with help from Alejandro Moralez and Stoney Jones. The code was written by Claude, an AI.

Live at https://joshthefrazer.github.io/3cs-class-hub/

---

## What's inside

- **Today**: the cycle day, a live "right now" card with a countdown, the whole day as a ruler with a marker that moves in real time, what's due, a peek at the class chat, app shortcuts, what to pack for the next school day, the weekly timetable, bell times and the subject key.
- **Work**: assignments, soonest first. Your ticks are private to your account.
- **Notes**: a shared notebook with light formatting, checklists, pictures, and public, link-only or private notes.
- **Help**: questions and reminders, with replies and reactions.
- **Calendar**: every month of the school year, with cycle days, holidays, quick exits and half days.
- **News**: announcements and a sitewide banner, posted by admins.
- **People**: everyone who has signed in, with their school email. Pick people to email them together in Gmail, copy addresses, or start a chat. Anyone can hide their email in Settings.
- **Messages**: the 3CS class room, private chats and group chats. Emoji, 22 animated stickers made for the Hub, a class GIF library, pictures, reactions, replies, @mentions, editing, muting, hiding and pinning, and pop-up notifications at the side.
- **Campus background**: real photos of the Itz'at campus behind every page, a different spot for each section (or one a day, or plain graph paper, in Settings). Photos by the Ministry of Education, Culture, Science and Technology, Belize, from their [opening-day album](https://www.flickr.com/photos/193643118@N04/albums/72177720317011818). They live in `assets/campus`; the list is in `js/campus.js`.
- **Polls & feedback**: admins run polls (results can't be faked; the rules check every vote), and anyone can post ideas, report problems or ask for changes, with upvotes. Anonymous posts hide the name from classmates but not from admins.
- **Getting around**: on computers a sidebar holds every section, grouped into School and Class, and shrinks to icons (the arrow at the bottom, or the `[` key). Every section has its own address (`#work`, `#notes`, `#news`...), so links and the back button work. Phones keep the bottom bar.
- **Make it yours**: eight themes, painted backgrounds or your own photo, accent colour, text size, spacing and glass cards; move, collapse or hide any card on Today, hide sections from the menu, and dock a "right now" pill on every page. Saved to your account.
- **The app**: the Hub installs from the browser on phones, Chromebooks and computers (`manifest.webmanifest`, `sw.js`). Installed, it opens in its own window, keeps the timetable working offline, shows the unread count on its icon, has shortcuts (Today, Work, Add assignment, Chat) and appears in the Share menu so links can go straight into chat, a note or an assignment. `sw.js` always loads the site fresh when online and only uses its saved copy offline, so it never needs editing when the site changes.
- **Android app**: `download/3cs-hub.apk` is a real Android app (a Trusted Web Activity) that opens the live Hub full screen, so it updates whenever the site does. Android phones get a one-time "Get it" suggestion, and it's in Settings > Reminders and the More menu. `android/` has how to rebuild it. For it to open without a browser address bar, the root site `joshthefrazer.github.io` must serve `/.well-known/assetlinks.json` with the app's key fingerprint.
- **Desktop app** (not distributed yet): `desktop/` is an Electron app for Windows with a tray countdown, reminders while closed and a taskbar badge. See `desktop/README.md`.
- **Reminders**: a heads-up before each class and a daily homework check (Settings > Reminders), plus system notifications for messages while you're in another window.
- **Settings**: tabs for Look, Layout, Chat, Welcome, Account, staff tools, Shortcuts and Troubleshoot. Troubleshoot shows the device's browser, sign-in state and any errors, can copy a report, and can clear the device's cached data.
- **Welcome animation**: what's new, the credits, and the welcome. It plays on the first visit each day by default.

## How it's built

Plain HTML, CSS and JavaScript modules. No build step. Data lives in Firebase (Firestore and Authentication) on the free plan. Pictures are shrunk in the browser and stored as small documents, because the free plan has no file storage.

`firestore.rules` is the real security boundary. It has to be published in the Firebase Console (Firestore Database, Rules, Publish) whenever it changes. Owner, admin and listed emails only count once the address is verified (Google sign-in always is; password accounts confirm by email link).

Database reads are kept low on purpose: Notes, Help and Feedback only start listening the first time someone opens them, and "active now" is written at most every 20 minutes while someone is actually using the page.

## Admins

Two accounts are always owners and can see and moderate everything, including private chats: `joshthefrazer@gmail.com` and `joshua.malic@sls.edu.bz`. They're listed in `firestore.rules` (`isOwner`) and in `index.html` (`HUB_OWNERS`), which must match. Other admins can be added by an owner through the `config/admins` document.

Admins can delete any message, pause someone's chat access (Settings, Moderation), read every conversation, post announcements and edit the site's timetable, calendar and bell times.

## Roles

Admins hand out roles in Settings > Admin > Members and roles, where they can also rename anyone and lock a name so its owner can't change it. Roles live in `config/people` and the rules check the same document.

| Role | Can |
| --- | --- |
| Owner | Everything, including making admins |
| Admin | Everything except making admins |
| Teacher | Post news, and edit or delete their own posts |
| Mod | Delete messages in the class chat, Help posts and feedback; pin, lock and resolve Help threads; pause someone's chat access. Not private chats. |

Everyone with a role gets a badge next to their name in chat, Help, News and People, and staff are listed first in People.

## Updating the "What's new" list

Add an entry at the top of `js/updates.js`, and change `window.HUB_VERSION` near the top of `index.html` to the same version, so people who chose "only after updates" see the animation once.

## Editing the schedule data

`js/data.js` holds the printed calendar (`CAL`), the 3CS rotation (`SCHED`), the bell schedules (`BELL_MODES`, `BELL`) and the subject key (`DEFAULT_LEGEND`). Admins can also change most of it live from the site editor without touching code.

## Hosting on GitHub Pages

Settings, Pages, deploy from branch `main`, folder `/ (root)`.
