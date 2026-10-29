# Class Pouch

Class Pouch is a group app for classes and hobbies such as art, dance, sports, music, fitness and tutoring. Many of these run on WhatsApp groups today. Class Pouch gives each group one place for its schedule, attendance, fees and photos.

> **Status: prototype.** All data is saved in the browser on one device. Invites only open groups saved on that device. Sharing between organizers and members on different phones needs the online backend (planned).

## Features

- **Groups**: create a group for each class or team, much like a Slack channel or WhatsApp group. All data belongs to one group. Each group has its own:
  - members
  - sessions and attendance
  - fees
  - photos
  - books
- **Activity-aware wording**: a Dance group says *Dancers*, a Sports group says *Players* and *Practice*, a Music group says *Lessons*.
- **Invite links and codes**: every group has a 6-character code and a join link, with a copy button and a WhatsApp share button. You can make a new code to replace the old link.
- **Member preview**: see exactly what one member or their parent would see: next session, their own attendance, dues and photos.
- **Dashboard**: pending fees with an overdue count, today's attendance rate, today's sessions, quick actions, the day's timeline, and the latest photos.
- **Sessions and attendance**: add a session (name, date, start and end time, location), then tap members to mark them present.
- **Group fee**: set one fee per session for the whole group; new members get it, and changing it can update everyone.
- **Members**: contact details, guardian, fee per session (override for a different rate), active or inactive, notes, and a profile with full history.
- **Payments**: record payments as **prepaid** (with the number of sessions covered) or **after attending**. Payments can be edited. The app tracks prepaid sessions left and who owes money.
- **Photos**: upload photos for each member, with a title and tag. Photos are resized automatically.
- **Books**: monthly income and expenses for each group, all-time totals, and CSV export.
- **Backup and restore**: one JSON file holds all groups, photos included.

## Running it

No install or build is needed. Open `index.html`, or turn on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root).

## Architecture

- `index.html`: the page shell
- `styles.css`: styles, with light and dark themes
- `db.js`: IndexedDB wrapper. Stores: `groups`, `students`, `classes`, `attendance`, `payments`, `expenses`, `works`. Every record has a `groupId`.
- `app.js`: state, views and actions. It loads every store, then filters to the open group.

Class Tracker data from before groups were added is moved automatically into a first group called "My Art Class".

## Roadmap

1. Online backend (Firebase or Supabase) with sign-in, so members join from their own phones.
2. Roles enforced on the server: organizers see everything, members see only their own records.
3. Announcements feed for class updates and cancellations, replacing the WhatsApp group.
4. Fee reminders and online payments.
