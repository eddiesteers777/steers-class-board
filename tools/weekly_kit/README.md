# Weekly kit

One week file in, the week's repeatable pieces out. Built so the same fact
(a date, a test day, a bellringer answer) is typed once.

```
python3 tools/weekly_kit/build_week.py WEEK.json --out OUT --site .
```

Per class it writes, each as .docx and .pdf with native equations and stacked
fractions, and each with its teacher key:
- the bellringer sheet (from each day's `problems`)
- the homework packet or extra practice (`homework`)
- the study guide, 4 pages (`studyGuide`)
- the speed dating set: 40 cards on page 1, recording sheet, early finishers (`speedDating`)
- guided notes for any day that has `notes` (the same content drives the board's step-by-step Guided Notes screen)

plus the parent message text and the slide text. With `--site .` it also
writes `data/<id>.js` for the board site. A section a class does not have that
week is left out of the week file.

It refuses to build if the week file has an error: a missing field, a date
that does not match the Monday, a bellringer answer whose written check is
false, a speed dating set that is not exactly 40 distinct cards, a listed wrong
answer equal to the correct one, or a link that looks like a key, test or
Jeopardy board. After building it warns if the study guide is not 4 pages or
card #40 is not on page 1.

- `weekfile.py` loads and checks the week file and converts the math markup.
- `docs.py` builds the Word files. `mathdoc.py` is the equation/Word layer.
- `outputs.py` builds the board data, parent messages and slide text.
- `example_week5.json` is Week 5 (November 16-20, 2026) as a week file.

Week files that hold teacher-only content stay in the week's Drive folder,
not in this public repo. Needs python-docx and LibreOffice (for the PDFs).

## Sections of a class in the week file

Every problem is `{"q": ..., "a": ..., "check": ..., "work": ...}`; `check` is a
Python expression that recomputes the answer (`F` is Fraction).

- `homework`: `title`, `subtitle`, `directions`, `days: [{day, example: {q, steps[]}, problems[]}]`
- `studyGuide`: `title`, `subtitle`, `ican`, `examples: [{heading, boxes: [[line, ...]]}]`,
  `practice: [{title, directions, height, parts: [{label, height, problems[]}]}]`,
  `errors: [{name, q, shown, correct, fix}]`, `checklist[]`
- a day's `notes`: `title`, `subtitle`, `standard`, `targets[]`, `warmup[]`, `vocab: {bank[], items[]}` with `[blanks]` in brackets,
  `bigIdea[]`, `steps[]`, `examples: [{title, q, intro[], steps: [{m, why}]}]` (`intro` is a rule box shown before that example), `guided: {q, steps: [{m, full, why}]}`,
  `practice: [{label, kind, showWork, space, problems[]}]` (each problem has `n`, such as "A1"; `showWork` sends the worked line to the board for problems done together), `errors[]`, `exit[]`
- `speedDating`: `title`, `prefix` (for example "2 Tuesday"), `cards[40]` each with
  `skill` and `wrong: [{a, why}]`, `example: {q, steps[]}`, `early[]`, `errorItem: {q, a, work}`,
  `setup: [[item, plan]]`, `reviewNotes[]`, `standardNote`

The example file here holds only what is already shown on the board. Homework,
study guide and speed dating content includes answer keys, so real week files
with those sections are kept in Drive, never in this repo.

## Pictures: graphs, tables, mapping diagrams (added 2026-11-17)

Put a picture inside any question or answer text as a token. The site (js/figures.js) and this kit (figures.py, PNG via matplotlib) draw the same picture:

    [[graph {"x":[-5,5],"y":[-5,5],"pts":[[1,2],[3,-1]]}]]      pts, open, seg [[a,b]], line [[a,b]] (edge to edge), curve [[x,y],...], step, size
    [[table {"cols":["x","y"],"rows":[[1,3],[2,5]],"across":true}]]
    [[map {"left":[1,2,3],"right":[4,5],"arrows":[[1,4],[2,5],[3,5]],"lt":"Input","rt":"Output"}]]

Week Review checks "is it a function?" answers against the picture. Keep speed dating card pictures small; the 40 cards must stay on page 1.
