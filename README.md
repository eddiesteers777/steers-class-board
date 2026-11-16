# Steers Class Board — Calera Math

Teacher-led classroom display for Mr. Steers, Calera Middle School
("Home of the Eagles"): 7th Grade, 8th Grade, and 8th Grade Accelerated.
Built around Week 5, Nov 16–20, 2026, then reusable week by week.

**Teacher-only.** Students never sign in and cannot type into this site.
Worksheets stay as paper or Google Docs. No grades, no parent/public access.

## Repo + Firebase — created Nov 16, 2026

- **GitHub repo:** `eddiesteers777/steers-class-board` — **private**,
  https://github.com/eddiesteers777/steers-class-board — created empty
  Nov 16, 2026; this scaffold is the first push (main branch).
- **Firebase:** project **Steers Class Board**, ID
  `steers-class-board`, under Eddie's **personal** Google account
  (`eddiesteers777@gmail.com`), **not** the school account.
  Analytics OFF, Spark free plan, Google sign-in enabled, Firestore
  production mode in us-central1. Console:
  https://console.firebase.google.com/project/steers-class-board/overview
  Teacher-only rules published Nov 16, 2026, 10:41 AM CST and read
  back byte-identical. Web app "Steers Class Board" registered the
  same day (appId `1:997357619072:web:8e47464df7c4e329fd2365`,
  project number `997357619072`); no Analytics, no measurementId.
- **Config is filled in.** `js/firebase.js` has the real config
  (apiKey, authDomain `steers-class-board.firebaseapp.com`,
  projectId, storageBucket, messagingSenderId, appId) and
  `js/googleSignIn.js` has the project's web OAuth client ID
  (`997357619072-er8lup54uo6g25ihtv920s2fomr11egj`).
  Still open: the OAuth client's Authorized JavaScript origins
  currently cover `http://localhost`, `http://localhost:5000`, and
  `https://steers-class-board.firebaseapp.com` — add the real hosted
  site origin once hosting is chosen, plus
  `https://steers-class-board.firebaseapp.com/auth-return.html`
  (or the real site's `/auth-return.html`) to its Authorized
  redirect URIs before the PWA redirect flow is used. Start on the
  default `*.firebaseapp.com` auth domain (a custom auth domain
  broke Google sign-in for Southbound in Oct 2026). Hosting is NOT
  set up yet.
- **Do NOT deploy, publish, or share anything until Eddie says so.**
  District/IT approval is still needed for the site to load on the
  school network.

## Hosting + Google (added Nov 16, 2026)

- **Live:** https://eddiesteers777.github.io/steers-class-board/ via
  GitHub Pages (repo public, main branch, root folder). No custom
  domain — the `github.io` address is the official address unless
  Eddie buys a domain later.
- **Google Search Console:** property for the Pages URL, verified by
  HTML file, sitemap submitted (see below). Google indexes only the
  public pages (`/` and `home.html`); every app page carries
  `noindex` and the classroom content sits behind teacher sign-in, so
  it is not searchable.
- **SEO files in repo:** `robots.txt` (allows `/` and `home.html`,
  disallows board/remote/login/app pages and `js/` `css/` `data/`),
  `sitemap.xml` (home + index), `favicon.svg` + `icons/icon-192.png`
  / `icon-512.png` / `icon-maskable-512.png` (navy "S", generated
  Nov 16), canonical + Open Graph tags on `index.html` and
  `home.html`, WebSite JSON-LD on `home.html`.

## How it works

- `index.html` — home screen: 3 class cards, Week 5, Mon–Fri per class,
  with Board / Remote links per day. Content from `data/week5.js`.
- `board.html` — full-screen student view (Promethean board). Shows the
  current item only, plus the timer and answer when the remote says so.
- `remote.html` — teacher controller (Chromebook): previous/next item,
  show/hide answer, timer start/pause/reset, Speed Dating 4:00 /
  Bellringer 5:00, whiteboard toggle.
- Board ↔ remote sync is **one Firestore doc per live session**:
  `live/{week}-{class}-{day}`, e.g. `live/week5-8th-mon`, with
  `{ classId, weekId, dayId, itemIndex, answerVisible, whiteboardOpen,
  timer: { durationSec, endsAt, state, remainingSec } }`.
  Remote writes it (`js/liveSession.js`); board subscribes with
  `onSnapshot`. Never sync via localStorage — different devices.
- `js/classTimer.js` — classroom timer (start/pause/reset from
  `endsAt`/`remainingSec`; 5:00 bellringer, red in the last 30 seconds;
  Speed Dating 4:00 → "Rotate!" → 10-to-1 countdown → restart).
- Sign-in is Google only, via the Southbound auth stack
  (`js/firebase.js`, `js/auth.js`, `js/googleSignIn.js`,
  `js/googleRedirect.js`, `js/authReturn.js`, `auth-return.html`).
  `login.html` is the sign-in entry point (Southbound's `requireLogin()`
  pointed at a `login.html` that did not exist — this closes that gap).

## Retheme — what changed from Southbound

- Calera navy `#0E2A47` + light blue `#A8CCE8` / `#7FB3D5` (orange dropped),
  Fredoka font, "Calera Math — Steers" naming. No Southbound green/cream,
  no Southbound name, logo, or copy. Theme override: `css/calera.css`.
- `school-` storage prefixes replace the old two-letter prefix throughout
  (`school-account-storage-owner`, `school-signincheck`, etc.).
  `js/auth.js` account-cleanup lists were replaced with school-only keys.
- Roles are teacher-only: `js/role.js` (one role, `teacher`),
  `js/navAccess.js` (teacher-only `PAGE_REQUIRES`, no `services.js`),
  `js/userProfile.js` (profile at `teacher/{uid}`, no client directory
  or approvals). `js/loadHeader.js` nav is Home / Board / Remote /
  Week / Planning / Homework; Southbound's cloud-sync, coach-plan,
  COROS, Fuel, Train, and client/coach bootstrap blocks were removed.
- `manifest.json` rebranded (Calera Math, navy, landscape).
  `sw.js` cache names are `school-*` now; regenerate its precache
  after the repo/hosting is set — do not hand-edit the precache block.
- `firestore.rules` is the teacher-only starter from the handoff
  (paste into Firebase Console → Firestore → Rules → Publish).
  Southbound's full 103 KB rules file was NOT carried over.

## What was NOT carried over

COROS/Strava/wearables, running/marathon/training, fueling/nutrition,
Stripe/billing, soccer playbook, client/coaching model, and the
homework student-submit flow (`js/homeworkCoach.js` /
`js/homeworkClient.js` were removed from this scaffold — homework here
is a listing only). `js/messages.js` is kept as the live-listener
pattern reference only; there is no messaging in the school site.

## Wiring status — read before you trust a page

- **Wired and loadable now:** `index.html`, `home.html`, `login.html`,
  `board.html`, `remote.html`, `js/liveSession.js`, `js/classTimer.js`,
  `data/week5.js`, `css/calera.css`, auth stack, `loadHeader.js`,
  `navAccess.js`, `role.js`, `userProfile.js`, `firestore.js`
  (+ new `js/dashboardData.js` seed and `js/startCarry.js` stub).
  These were syntax-checked with `node --check` (see Verification).
- **Parked library (in the tree, NOT loaded by the new pages):**
  `js/app.js`, `js/schedule.js`, `js/planningView.js`,
  `js/planningCycle.js`, `js/planningContext.js`, `js/checkin.js`,
  `js/homeworkModel.js`, `js/messages.js`, `js/messageThread.js`,
  `js/calendarExport.js`, `js/ui.js`, `js/icons.js`, `js/formDraft.js`,
  `js/netStatus.js`, `js/signInErrors.js`, `js/signInTrail.js`,
  `js/signInRetry.js`, `js/registerSW.js`, `sw.js`, and the
  `schedule.html` / `planning.html` / `homework.html` shells.
  Several of these still import Southbound modules that are not in
  this repo (e.g. `js/services.js`, `js/cloudSync.js`, `js/emoji.js`);
  they are reference code for later wiring, not working pages yet.
  Do not wire one in silently — fix its imports first and test it.
- **Not yet in the repo:** the "8th Grade Work-It-Out Board" whiteboard
  artifact from the Week 5 Claude thread (Message 26). The remote's
  Whiteboard toggle flips `live.whiteboardOpen` and the board shows a
  banner; the full board (pens, colours, eraser, undo, grid) still
  lives in that thread and is the next wiring step. Drawings are not
  saved in Step 1 (same limit as the artifact).
- **Week 5 content:** titles/dates/notes only, exactly as in the
  handoff. Bellringer problems and answers are NOT in `data/week5.js`
  — they live in the thread's slides and Work-It-Out Board. Do not
  invent them.
- **Learning targets (from the thread, do not reword without Eddie):**
  8th — "I can find a missing angle in a triangle and solve equations
  to find all 3 angles." 8th ACC — "I can solve and graph inequalities
  and find a missing angle in a triangle."

## Verification (local, 2026-11-16)

- File tree listed; no code file contains the old Southbound domain
  or the old Southbound Firebase project ID. The word "Southbound"
  survives only in code comments as provenance ("school rewrite of
  the Southbound … module") — no user-facing Southbound name, logo,
  or copy remains. The real Steers Class Board Firebase config is
  now in `js/firebase.js` / `js/googleSignIn.js` (client-side
  config, as Firebase intends; repo is private).
- `node --check` passed on the new/edited JS (see the build report for
  the exact list). Not yet tested in a browser, on a Chromebook, or on
  an ActivPanel — that test is still to do; hosting is not set up yet.

## Build order (from the handoff §4)

1. Create the Firebase project + GitHub repo — DONE Nov 16, 2026
   (see above). 2. Fill in the Firebase config values — DONE Nov 16,
   2026 (rules published, web app registered, OAuth client ID in).
3. Test sign-in + home screen + board/remote sync + timers for
   8th Grade Week 5 only, on a Chromebook + the board browser.
4. Only if that works in class: 7th + 8th ACC, then full-day
   integration (Tuesday 8th as the test).
