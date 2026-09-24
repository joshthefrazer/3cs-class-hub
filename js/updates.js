/* =========================================================
   WHAT'S NEW - the update log.

   Shown in the welcome animation and under "What's new" in the footer and
   Settings. Newest first. When you ship a new version, add an entry at the
   top AND bump window.HUB_VERSION in index.html to match, so people who set
   the intro to "only after updates" see it once.
   ========================================================= */

var RELEASES = [
  {
    version: "3.0",
    date: "September 2026",
    title: "The big redesign",
    added: [
      "A completely new look in the school's own colours",
      "The new Day 1 to 7 timetable",
      "Real photos of the Itz'at campus as the background, a different spot for each section",
      "Each photo arrives as a blueprint and develops into the real building, with depth as you scroll",
      "Today is now a live timeline of the day, with a marker that moves in real time",
      "Messages: private chats, group chats, and the 3CS class room in one window",
      "Emoji, 22 animated stickers, and a class GIF library you can add to",
      "Send pictures in chat, and add pictures to notes",
      "Reactions, replies, @mentions, editing, and muting or hiding chats",
      "Pop-up notifications at the side when someone messages you",
      "People: everyone's school email in one place, so emailing a group is one click",
      "Settings: theme, motion, background, notifications, the welcome animation, and email privacy",
      "The browser tab shows what class you're in and how long is left",
      "Each section remembers where you scrolled to, and a back-to-top button appears on long pages",
      "A longer welcome animation with this update log and the credits"
    ],
    fixed: [
      "Share links for notes now point at the real site",
      "Calendar and timetable text is always shown as text, never as page code",
      "The timetable's highlight for today survives live edits",
      "Keyboard shortcuts no longer fire while a window is open on top",
      "Phones get a proper bottom bar instead of a squashed header",
      "Tidier spacing: bell times and subject codes get the full width, and bell times swipe sideways on phones",
      "The Today cards line up, and today's row in the timetable is highlighted in the right place"
    ]
  },
  {
    version: "2.0",
    date: "September 2026",
    title: "Purple, white and orange",
    added: [
      "Class chat, profile pictures and the quick launch apps",
      "The first welcome animation",
      "Light and dark mode"
    ],
    fixed: []
  }
];

function latest(){ return RELEASES[0]; }

export { RELEASES, latest };
