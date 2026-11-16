# Steers Class Board

Classroom display for Mr. Steers' math classes at Calera Middle School.
Live at https://eddiesteers777.github.io/steers-class-board/

- `index.html` home: this week, with Open Remote and Open Board.
- `remote.html` the Chromebook: pick class, day and screen, run timers, show answers.
- `board.html` the Promethean: full screen, follows the Remote.
- `js/boardApp.js` the app (screens, timers, whiteboard). `js/boardStore.js` saves live state under `teacher/{uid}/` in Firestore.
- `data/weekN.js` one file of lesson content per week; `data/weeks.js` lists them.

## Adding a week
1. Copy `data/week5.js` to `data/weekN.js` and replace the content (dates, agenda, supplies, reminders, learning targets, bellringer problems with verified answers, file links).
2. Add it to `data/weeks.js`. The newest week whose Monday has arrived opens by default.
3. Student-facing content only. Never add tests or teacher keys. The repo is public.

Teacher only. Students never sign in.

## Guest teacher (sub days)
`sub.html` runs the board on one device with no sign-in: https://eddiesteers777.github.io/steers-class-board/sub.html
Nothing is saved and it never touches the teacher's account or rosters. Put this link in the sub plan.

## Guided Notes
A day with `notes` in the week file gets the step-by-step Guided Notes screen and the paper notes from the same content.
`data/weekN.js` is generated. Add notes to the week file and rebuild with `tools/weekly_kit/build_week.py`; never edit the data file by hand.
The real week files hold answer keys, so they live in the week's Drive folder, not here. Paper notes: step tables never split across pages, the exit ticket sits on its own page, and the build warns past 4 pages.

## Week Builder (print from the site)
`builder.html` (teacher sign-in): pick a week and class, edit bellringer problems, and print the student sheet and teacher key from the browser. `js/weekSheets.js` holds the print layouts, matching `tools/weekly_kit/docs.py`.
Edits save to `teacher/{uid}/weekfiles/{weekId}` in the private account, never to this repo. The site cannot check math, so the key counts any problem changed on the site as not re-checked. `builder.html?demo` runs on one device with nothing saved.
So far: bellringer sheet and key, and guided notes (student copy and key). A published week has no exit ticket answers, so the notes key says so until the week file is loaded. Still built by the weekly kit: homework, study guide, speed dating.

## Library
`library.html` lists every week in `data/weeks.js` by class, with search, and opens any day on the Remote (`remote.html?week=&class=&day=&screen=`).
Nine weeks and unit labels are typed in `data/library.js`. Leave them out when not known; never guess.

## Class Data
`data.html` (teacher sign-in): paste or load a CSV of results (Magma Math, a quiz, an exit ticket), pick the student and score columns, and see class averages and who needs help, by skill and by student.
Student results save only under `teacher/{uid}/data/...` in the private account. NEVER commit student names or results to this repo, including in tests or examples. Roster numbers can be saved instead of names.

## Two build lanes
Two Claude threads (school account and personal account) push to `main`. Fetch and check the head of `main` before every push, and re-read any file you are about to overwrite.

## Hosting + Google

- Live: https://eddiesteers777.github.io/steers-class-board/ via GitHub Pages (repo public, main branch, root folder). No custom domain — the `github.io` address is the official address unless Eddie buys a domain later.
- Google Search Console: property for the Pages URL, verified by HTML file, sitemap submitted. Google indexes only the public pages (`/` and `home.html`); every app page carries `noindex` and the classroom content sits behind teacher sign-in, so it is not searchable.
- SEO files in repo: `robots.txt`, `sitemap.xml`, `favicon.svg` + `icons/icon-192.png` / `icon-512.png` / `icon-maskable-512.png` (navy "S"), canonical + Open Graph tags on `index.html` and `home.html`, WebSite JSON-LD on `home.html`.
