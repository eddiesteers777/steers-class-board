# Steers Class Board — queue

One list of what is next. Pull from the top of "Next up". Move an item when its state changes.
Scout before building (see DESIGN.md). Check the head of `main` before every push.

## Waiting on Eddie
| # | Item | What is needed |
|---|------|----------------|
| 1 | Calendar page with school dates | The Shelby County 2026-27 calendar and the nine-weeks dates. Never guess dates. |
| 2 | Homework printing in the Week Builder | One real week file that has a homework section. |
| 3 | Fit the Class Data import to Magma Math | The header row of a real Magma Math export. |
| 5 | Colours and fonts | See the open question in DESIGN.md. |

## Next up
| # | Item | Notes |
|---|------|-------|
| 16 | Record a lesson: confirm on real devices | Built Nov 16 (see Done). Still to confirm: Chrome on the Chromebook saves the file, and the video plays for students once uploaded to Schoology. Test recording here was MP4 (H.264) with Opus sound; real Chrome may pick AAC. |
| 17 | Week Builder print: notes with rule boxes and worked lines | Notes can now carry `intro` (a rule box before an example) and practice parts with `kind` and `showWork`. `js/weekSheets.js` does not print these yet; `tools/weekly_kit/docs.py` prints `intro`. |
| 15 | Bell times editor holds one schedule only | The regular schedule is saved. Not stored anywhere yet: the 3rd-period lunch block (A, B, C), gym dismissal, dismissal times, and the 1-hour and 2-hour activity schedules. Needs named schedules and more rows. Do not force these under a wrong label. |
| 8 | Board takes about 8 seconds to load its state | Seen Nov 16. The skeleton now covers the wait; find out where the time goes (sign-in, Firestore, clock check). |
| 9 | Check every teacher page against DESIGN.md | 390px and desktop: Home, Remote, Rosters, Library, Week Builder, Class Data, sign-in. Home's header now has six buttons and needs thinning. |
| 10 | Week 6 content | Starts from the "Weekly Plan Intake - Steers Math" Sheet (school account). New `data/week6.js`, add to `data/weeks.js` and `data/library.js`. |
| 11 | Study guide and speed dating printing in the Week Builder | Port from `tools/weekly_kit/docs.py`, as was done for bellringers and guided notes. |
| 12 | Class Data: tie results to skills over time | Link a set to a Library week, show growth, group by standard once the curriculum documents are in the project. |
| 14 | Remove unused starter pages | `planning.html`, `homework.html`, `schedule.html` and their scripts look unused. Confirm with the school thread first. |

## Done
| When | Item |
|------|------|
| Nov 16 | Sign-in: a failed try now stays on the sign-in page and says so (it used to jump to the dashboard and bounce back); the button waits for Google's script so the tap opens Google's own window; a "popup closed" from Google waits 15 s for a token that may still arrive (a Chrome quirk). `?signincheck` shows this device's sign-in steps (`js/signInCheck.js` was missing). Not proven on Eddie's devices: if the first try still fails, open the page with `?signincheck` and read the steps. |
| Nov 16 | Record a lesson (Remote, "Record a lesson" in the side rail): records the lesson stage only, microphone off unless turned on, warns if a student name tool is showing, saves a video to the device. `js/recorder.js`. Nothing is uploaded by the site. |
| Nov 16 | Guided notes on the board for 7th Monday and 8th Accelerated Monday, loaded from the paper notes in the school Drive (wording unchanged). The Accelerated student notes have no error detectives or exit ticket, so none were loaded. |
| Nov 16 | The three Friday Nov 20 sub plans (7th, 8th, 8th Accelerated) carry the guest teacher address. Each is still one page. |
| Nov 16 | Bell times: the regular schedule is set on Home. |
| Nov 16 | The two live test items were removed (bellringer answer back to 65, test data set removed). The "1 of 18 problems were changed" notice still shows from an earlier edit; do not clear it without Eddie. |
| Nov 16 | Live test by Eddie: rules confirmed closed, sign-in, Library, Week Builder save and Class Data save all passed. |
| Nov 16 | "Today" means today: a board left on another day starts on the real day the next morning; the Remote marks today and warns, with one tap back, when it shows another day; a skeleton shows until the saved state arrives. |
| Nov 16 | Home no longer claims a period without bell times, after school, or on a weekend. |
| Nov 16 | Tools sit on a shelf beside the lesson instead of covering it; a tool can still be floated on purpose. |
| Nov 16 | Class Data page. Library page. Week Builder (bellringer sheet and key, guided notes and key). |
| Nov 16 | 8th Accelerated Wednesday guided notes on the board; paper notes layout fixed to 4 pages. |
