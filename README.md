# Focal (formerly Steers Class Board)

Classroom display for Mr. Steers' math classes at Calera Middle School.
Live at https://focalboard.web.app/

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
`sub.html` runs the board on one device with no sign-in: https://focalboard.web.app/sub.html
Nothing is saved and it never touches the teacher's account or rosters. Put this link in the sub plan.

## Guided Notes
A day with `notes` in the week file gets the step-by-step Guided Notes screen and the paper notes from the same content.
`data/weekN.js` is generated. Add notes to the week file and rebuild with `tools/weekly_kit/build_week.py`; never edit the data file by hand.
The real week files hold answer keys, so they live in the week's Drive folder, not here. Paper notes: step tables never split across pages, the exit ticket sits on its own page, and the build warns past 4 pages.

## Week Builder (print from the site)
`builder.html` (teacher sign-in): pick a week and class, edit bellringer problems, and print the student sheet and teacher key from the browser. `js/weekSheets.js` holds the print layouts, matching `tools/weekly_kit/docs.py`.
Edits save to `teacher/{uid}/weekfiles/{weekId}` in the private account, never to this repo. The site cannot check math, so the key counts any problem changed on the site as not re-checked. `builder.html?demo` runs on one device with nothing saved.
So far: bellringer sheet and key, and guided notes (student copy and key). A published week has no exit ticket answers, so the notes key says so until the week file is loaded. Still built by the weekly kit: homework, study guide, speed dating.

## Record a lesson
On the Remote, "Record a lesson" records the lesson stage (not the controls) and saves a video to the device for uploading to Schoology. `js/recorder.js`. The microphone is off unless turned on, and nothing is uploaded or stored by the site. It warns before recording while a student name tool is showing.

## Library
`library.html` lists every week in `data/weeks.js` by class, with search, and opens any day on the Remote (`remote.html?week=&class=&day=&screen=`).
Nine weeks and unit labels are typed in `data/library.js`. Leave them out when not known; never guess.

## Class Data
`data.html` (teacher sign-in): paste or load a CSV of results (Magma Math, a quiz, an exit ticket), pick the student and score columns, and see class averages and who needs help, by skill and by student.
Student results save only under `teacher/{uid}/data/...` in the private account. NEVER commit student names or results to this repo, including in tests or examples. Roster numbers can be saved instead of names.

## Review Games
Games the teacher runs from the Remote while the board shows them. Students never sign in or use a device.
`games.html` is the Game Library (teacher sign-in, `?demo` for testing). It describes the four games and lists every question set as a card with Play, Edit, Copy and Remove, filtered by class and searchable. Each set can be given to classes (periods); the set's `per` list lives in `games/index`, and an empty list means every class. Play opens `remote.html?screen=game&period=<p>&set=<id>&game=<kind>`, which starts that game for the period unless one is already running. On the Remote, sets for the period on screen come first and the rest sit under "Sets for other classes". To make a set, paste a table of `CATEGORY | POINTS | QUESTION | ANSWER` lines (or tab-separated), check it, and save it as a question set. A FINAL line adds a final wager question. A set can also be started from a week's problems.
Sets are private: `teacher/{uid}/games/index` and `games/s_<id>`. Never commit question sets or answers to this repo.
On the Remote, the "Review Game" screen shows the Review Board (categories and point tiles). A private panel beside the board picture shows the answer before the class sees it, scores each team right or wrong, runs a timer, and has undo. Each period keeps its own game at `games/live_<period>`. `js/games.js`, `css/games.css`.
Treasure Chests uses the same sets: one question at a time (easiest first), every team answers on whiteboards, the teacher taps the teams that were right, and each of those teams opens one of nine chests (points, double, steal, swap, lose some or empty, drawn when it opens). Undo steps back one move.
Class vs. Teacher uses the same sets: the whole class answers each question on whiteboards, and the teacher gives the point to the class or to themselves (the name on the board is editable). Two progress rings fill toward the goal (first to 5, 7, 10 or 15).
Trashketball uses the same sets: every team answers on whiteboards, the teams that were right score the answer points (0, 1 or 2) and each send a shooter to toss a paper ball at a can from the 1, 2 or 3 point line. The teacher taps "Made it from…" or "Missed" and the board shows the court and the result. Undo steps back one move.
Mystery Tiles uses the same sets: the teacher types a mystery phrase (and an optional hint) that hides behind 12 numbered tiles. Teams that answer right each flip a tile (+10). A team that guesses the phrase scores 50 plus 10 for each tile still covered; a wrong guess costs nothing. Then a new mystery or the final scores.
Ring Race uses the same sets: every team has a ring on the board. Each question, the teams that were right move one step (tap a right team again on the Remote to mark it fastest for a bonus step, which can be turned off). First to close the ring (5, 7, 10 or 12 steps) wins.
Bingo uses the same sets: the Remote panel links to `bingo.html` (Print the cards), which prints numbered paper cards from the set's distinct answers (5 by 5 with a free middle when there are 24 or more answers, else 4 by 4 or 3 by 3; at least 9 needed). Cards come from a seeded shuffle, so they only match the game that printed them, and the Remote can rebuild any card by number to check a Bingo claim. Questions are called in a shuffled order; showing an answer marks it called.
Tug of War uses the same sets: the room splits into two sides (names editable, Blue and Gold by default). Each question the teacher taps which side was right (or both, or neither); a right side pulls the rope one step its way. First side to pull the marker past its line (3 to 8 steps) wins.

Rapid Fire uses the same sets: the whole class plays against the clock (30 seconds to 3 minutes). The teacher taps Right, Missed or Skip and the next question shows at once; the board shows the count, the streak, the last answer and the class record for that period to beat. The round ends on its own when time runs out.

Prize Wheel uses the same sets and the Treasure Chests flow: every team answers, the teacher taps who was right, and each right team spins a 12-wedge wheel on the board (+10 to +50, double, steal 25, swap, lose 15 or nothing). The Remote draws the wedge and adds the prize; the board turns the wheel to it and shows the prize when it stops.

Code Breaker uses the same sets and the Treasure Chests flow: each right team scores 10 and calls out a guess at a secret code (3 or 4 different digits) that the teacher types on the Remote. The board marks each digit (right spot, in the code but wrong spot, not in the code) and keeps every guess on screen. Cracking the code scores 50 and starts a new one.
Results: when a game reaches its final scores, the Remote saves a short summary to `teacher/{uid}/games/results` (date, period, game, set, team scores, winner, right answers per category, and the students on each team when the teams came from the Group maker). Class Data (`data.html#games`, `js/gameResults.js`) shows who won by day and period with a "Bonus given" box, each student's wins and wins still owed a bonus, and class growth over time. Names stay in the private account and never show on the board.
The games are original to Focal. Do not copy the name, look or art of any other review-game site.

## Design rules and the queue
Read `DESIGN.md` before changing how anything looks or behaves, and `QUEUE.md` for what is next. Scout before building.

## Two build lanes
Two Claude threads (school account and personal account) push to `main`. Fetch and check the head of `main` before every push, and re-read any file you are about to overwrite.

## Hosting + Google

- Live: https://focalboard.web.app/ via Firebase Hosting (free Spark plan). Also served at https://steers-class-board.web.app/ and via GitHub Pages (https://eddiesteers777.github.io/steers-class-board/) as fallbacks. No custom domain — the `web.app` address is the official address unless Eddie buys a domain later.
- Google Search Console: property for the Pages URL, verified by HTML file, sitemap submitted. Google indexes only the public pages (`/` and `home.html`); every app page carries `noindex` and the classroom content sits behind teacher sign-in, so it is not searchable.
- SEO files in repo: `robots.txt`, `sitemap.xml`, `favicon.svg` + `icons/icon-192.png` / `icon-512.png` / `icon-maskable-512.png` (navy "S"), canonical + Open Graph tags on `index.html` and `home.html`, WebSite JSON-LD on `home.html`.
