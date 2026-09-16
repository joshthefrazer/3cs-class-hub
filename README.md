# 3CS Class Hub

Schedule, calendar, shared notebook and help board for **3CS at Itz'at STEAM Academy**, 2026–2027.

One self-contained `index.html`. No build step, no dependencies to install, no server required — open the file and it runs.

---

## What's inside

**Schedule** — today's cycle day, a live "time left in class" countdown, today's six sessions, the full seven-day rotation, all three bell schedules, and a subject key.

**Calendar** — every month from August 2026 to June 2027, built from the school's official calendar: cycle days, holidays, quick exits, half days, asynchronous days, quarter boundaries.

**Notebook** — shared class notes with light Markdown, subject tags, and per-note visibility.

**Help Board** — questions and reminders, threaded replies, reactions, resolved/unresolved.

---

## Quick-exit and half-day handling

The Hub reads each day's entry in the calendar and switches bell schedules to match, because "Session 3" is a different slot depending on the day:

| | Sessions | Session 3 | Day ends |
|---|---|---|---|
| Regular | 6 | 10:05–11:00 | 3:15 |
| Quick exit | 6 (50 min each) | 9:55–10:45 | 2:10 |
| Half day | **1–4 only** | 10:05–11:00 | 12:20 (staff PLC at 1:00) |

On any day that isn't a regular one, a banner names the schedule and what changes. Half days are detected from the calendar's own "1/2 Day" wording rather than assuming Day 7, since several half days in May and June fall on other cycle days.

---

## Two places this file can run

This matters, so read it before hosting.

### On the live Hub (claude.ai artifact)

Everything works. The notebook, announcements, help board and admin editing run on a shared database that the claude.ai viewer provides to the page at runtime.

### As a static copy (GitHub Pages, a local file, any other host)

The runtime the collaborative features depend on **does not exist outside the claude.ai viewer**. There is no API key to add and no configuration that turns it on — it is provided by the host page, not by this file.

What still works: the schedule, the live class countdown, the full calendar, all three bell schedules, the subject key. Genuinely useful as a read-only reference.

What does not: the notebook, announcements, help board, admin editing. The page detects this and shows a notice bar linking to the live Hub instead of failing silently.

If you want the collaborative side on your own domain, it needs a real backend — the page would have to be rewritten against something like Firebase or Supabase. Happy to do that; it's a different piece of work, not a setting.

---

## Hosting on GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Source:** deploy from branch, `main`, folder `/ (root)`.
3. It'll be live at `https://<username>.github.io/<repo>/` in a minute or two.

---

## Admin passcode

Admin mode is behind a passcode. It is stored in the page as a hash rather than plain digits, and unlocking is remembered per device.

**Be clear on what this is.** It is a lock on the *interface* — it keeps edit buttons out of the way of thirty classmates. It is not security. The passcode travels to every visitor as part of the page, so anyone who reads the source or the browser console can get past it. Do not treat it as protecting anything that matters.

What actually controls who can change shared data is the Hub's sharing permission on claude.ai: the owner shares the artifact with someone as **can edit** to make them a real admin. That check happens on the server, not in this file.

---

## Editing the data

Everything is plain JavaScript near the top of the `<script>` block in `index.html`:

- `CAL` — one entry per date: `{ day, kind, events[] }`, where `kind` is `holiday`, `async`, `quickexit`, `halfday` or absent.
- `SCHED` — the 3CS rotation, keyed by cycle day 1–7, six entries each: `{ c: subject, r: room, t: teacher }`.
- `BELL_MODES` — session times for the regular, quick-exit and half-day schedules.
- `DEFAULT_LEGEND` — subject codes and their full names. Several are intentionally blank because they weren't documented anywhere; fill them in rather than guessing.

---

## Known discrepancy

The 3CS class timetable and the school's bell-schedule page disagree about Session 6:

- Class timetable: **2:05–3:00**
- School bell schedule: **2:00–2:55**

This file uses the class timetable. Worth confirming which is correct.
