/* =========================================================
   WHAT'S NEW - the update log.

   Shown in the welcome animation and under "What's new" in the footer and
   Settings. Newest first. When you ship a new version, add an entry at the
   top AND bump window.HUB_VERSION in index.html to match, so people who set
   the intro to "only after updates" see it once.
   ========================================================= */

var RELEASES = [
  {
    version: "3.3",
    date: "September 2026",
    title: "The Hub as an app",
    added: [
      "Install the Hub on your phone, Chromebook or computer: it opens in its own window and the timetable works offline",
      "A desktop app for Windows with the current class in the tray, reminders even with the window closed, and Ctrl+Alt+A to add work",
      "Class reminders a few minutes before each session, and a daily homework check (Settings > Reminders)",
      "System notifications for messages when the Hub isn't the window you're looking at",
      "The unread count shows on the app icon",
      "Share a link from another app straight into the class chat, a note or a new assignment",
      "Shortcuts on the app icon for Today, Work, Add assignment and Chat",
      "The \"right now\" pill lives in the menu instead of floating over the page"
    ],
    fixed: [
      "Admin and owner powers now need a confirmed email, so nobody can claim an address that isn't theirs",
      "The Hub loads faster: Notes, Help and Feedback load when you open them, and campus photos load after the page",
      "\"Active now\" uses far fewer database reads, which keeps the class inside the free daily limit",
      "Small print and empty lists stay readable over the campus photos",
      "Filters on phones fit on one line you can swipe",
      "Better contrast for subject tags, finished classes and toggles, plus fixes for screen readers and keyboards"
    ]
  },
  {
    version: "3.2",
    date: "September 2026",
    title: "Easier to get around",
    added: [
      "A sidebar on computers with every section in one place, grouped into School and Class",
      "Shrink the sidebar to icons with the arrow at the bottom or the [ key",
      "Every section has its own web address, and the browser's back button works",
      "Eight ready-made themes, painted backgrounds, and your own photo as the background",
      "Settings is organised into tabs: Look, Layout, Chat, Account and more",
      "Teacher and Mod roles: teachers post news, mods keep chat, Help and Feedback tidy",
      "Staff get a badge in chat, Help, News and People, and show first in People",
      "Admins can rename people, lock a name, and hand out roles from Members and roles",
      "A light effects mode that turns itself on for slower computers",
      "Settings > Troubleshoot shows what's going on with your device and can refresh its data"
    ],
    fixed: [
      "Sections no longer disappear off the edge of the menu on laptop screens or when zoomed in",
      "Work shows every assignment, including ones with no due date field",
      "Work and Notes now say what went wrong instead of looking empty",
      "Notes no longer depend on a database index that was missing"
    ]
  },
  {
    version: "3.1",
    date: "September 2026",
    title: "Make it yours",
    added: [
      "Polls: admins ask the class, everyone votes, and the results fill in live",
      "Feedback: share ideas, report what's broken, and upvote what you want most",
      "Customize Today: move, collapse or hide any card, and bring it back any time",
      "Pick an accent colour, text size, spacing and glass cards in Settings",
      "Hide sections you don't use from the menu",
      "A \"right now\" pill docks on every page, so your class and countdown are always there",
      "Your look follows you to any device you sign in on"
    ],
    fixed: [
      "The day number sits in a clean badge instead of a hand-drawn circle",
      "Alejandro Moralez's name is spelled right in the credits"
    ]
  },
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
