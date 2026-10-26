# Class Tracker

A simple web app for running classes: students, attendance, payments, photos of students' work and bookkeeping. It works on phone and desktop.

## Features

- **Dashboard**: greeting, pending fees (with overdue count), today's attendance rate, today's sessions, quick studio actions, today's class timeline with check-in status, and the latest student artwork.
- **Classes and attendance**: add a class (name, date, start and end time, room) and tap each student to mark them present. There's also a "mark everyone present" button.
- **Students**: name, phone, parent/guardian, email, fee per class, join date, active/inactive and notes. Each student has a page with their attendance history, payments, balance and work.
- **Payments**: record payments as **before classes (prepaid, with the number of classes covered)** or **after classes**. Payments can be edited at any time. The app tracks prepaid classes used and remaining, and shows who owes money.
- **Gallery**: upload photos of each student's work (with title and medium), several at a time. Photos are resized automatically.
- **Books**: monthly ledger of income (payments) and expenses, with all-time totals, the amount still owed to you, and CSV export.
- **Backup and restore**: download all data, photos included, as one file, and restore it on another device.

## Running it

No install or build is needed. Open `index.html` in a browser, or publish the repo with GitHub Pages (Settings → Pages → Deploy from branch → `main` / root).

## Data

All data is stored in the browser on the device you use (IndexedDB). Nothing is sent to a server. Use **Books → Download backup** regularly.

## Files

- `index.html`: page shell
- `styles.css`: styles, light and dark mode
- `db.js`: IndexedDB storage
- `app.js`: the app
