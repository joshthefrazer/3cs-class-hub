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
- **Make it yours**: move, collapse or hide any card on Today, hide sections from the menu, dock a "right now" pill on every page, and pick an accent colour, text size, spacing and glass cards. Saved to your account.
- **Settings**: theme, motion, background, look and layout, the welcome animation, notifications, email privacy.
- **Welcome animation**: what's new, the credits, and the welcome. It plays on the first visit each day by default.

## How it's built

Plain HTML, CSS and JavaScript modules. No build step. Data lives in Firebase (Firestore and Authentication) on the free plan. Pictures are shrunk in the browser and stored as small documents, because the free plan has no file storage.

`firestore.rules` is the real security boundary. It has to be published in the Firebase Console (Firestore Database, Rules, Publish) whenever it changes.

## Admins

Two accounts are always owners and can see and moderate everything, including private chats: `joshthefrazer@gmail.com` and `joshua.malic@sls.edu.bz`. They're listed in `firestore.rules` (`isOwner`) and in `index.html` (`HUB_OWNERS`), which must match. Other admins can be added by an owner through the `config/admins` document.

Admins can delete any message, pause someone's chat access (Settings, Moderation), read every conversation, post announcements and edit the site's timetable, calendar and bell times.

## Updating the "What's new" list

Add an entry at the top of `js/updates.js`, and change `window.HUB_VERSION` near the top of `index.html` to the same version, so people who chose "only after updates" see the animation once.

## Editing the schedule data

`js/data.js` holds the printed calendar (`CAL`), the 3CS rotation (`SCHED`), the bell schedules (`BELL_MODES`, `BELL`) and the subject key (`DEFAULT_LEGEND`). Admins can also change most of it live from the site editor without touching code.

## Hosting on GitHub Pages

Settings, Pages, deploy from branch `main`, folder `/ (root)`.
