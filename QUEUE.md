# Steers Class Board — queue

One list of what is next. Pull from the top of "Next up". Move an item when its state changes.
Scout before building (see DESIGN.md). Check the head of `main` before every push.

## Waiting on Eddie
| # | Item | What is needed |
|---|------|----------------|
| 1 | Calendar page with school dates | The Shelby County 2026-27 calendar and the nine-weeks dates. Never guess dates. |
| 2 | Homework printing in the Week Builder | One real week file that has a homework section. |
| 3 | Fit the Class Data import to Magma Math | The header row of a real Magma Math export. |
| 4 | Remove the two live test items | Eddie says when: the "65 (test)" bellringer answer (Week Builder, "Go back to the published week") and the "Test — live test set (delete me)" data set (Class Data, Remove). They are in his private account, not in this repo. |
| 5 | Colours and fonts | See the open question in DESIGN.md. |
| 6 | Set the bell times | Home, "Bell times". Until then Home shows no current period. |

## Next up
| # | Item | Notes |
|---|------|-------|
| 7 | Sign-in popup needed a second try | Seen in the Nov 16 live test: the first Google popup closed without finishing. Scout `js/googleSignIn.js`, `js/signInRetry.js`. |
| 8 | Board takes about 8 seconds to load its state | Seen Nov 16. The skeleton now covers the wait; find out where the time goes (sign-in, Firestore, clock check). |
| 9 | Check every teacher page against DESIGN.md | 390px and desktop: Home, Remote, Rosters, Library, Week Builder, Class Data, sign-in. Home's header now has six buttons and needs thinning. |
| 10 | Week 6 content | Starts from the "Weekly Plan Intake - Steers Math" Sheet (school account). New `data/week6.js`, add to `data/weeks.js` and `data/library.js`. |
| 11 | Study guide and speed dating printing in the Week Builder | Port from `tools/weekly_kit/docs.py`, as was done for bellringers and guided notes. |
| 12 | Class Data: tie results to skills over time | Link a set to a Library week, show growth, group by standard once the curriculum documents are in the project. |
| 13 | Guided notes for the days that have none | 7th Monday and 8th Accelerated Monday were taught from paper notes kept in the school Drive. Load them only from those, never rewrite them. |
| 14 | Remove unused starter pages | `planning.html`, `homework.html`, `schedule.html` and their scripts look unused. Confirm with the school thread first. |

## Done
| When | Item |
|------|------|
| Nov 16 | Live test by Eddie: rules confirmed closed, sign-in, Library, Week Builder save and Class Data save all passed. |
| Nov 16 | "Today" means today: a board left on another day starts on the real day the next morning; the Remote marks today and warns, with one tap back, when it shows another day; a skeleton shows until the saved state arrives. |
| Nov 16 | Home no longer claims a period without bell times, after school, or on a weekend. |
| Nov 16 | Tools sit on a shelf beside the lesson instead of covering it; a tool can still be floated on purpose. |
| Nov 16 | Class Data page. Library page. Week Builder (bellringer sheet and key, guided notes and key). |
| Nov 16 | 8th Accelerated Wednesday guided notes on the board; paper notes layout fixed to 4 pages. |
