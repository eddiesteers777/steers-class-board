# Weekly kit

One week file in, the week's repeatable pieces out. Built so the same fact
(a date, a test day, a bellringer answer) is typed once.

```
python3 tools/weekly_kit/build_week.py WEEK.json --out OUT --site .
```

Per class it writes the bellringer sheet (.docx and .pdf, native equations with
stacked fractions), its teacher key, the parent message text and the slide
text. With `--site .` it also writes `data/<id>.js` for the board site.

It refuses to build if the week file has an error: a missing field, a date
that does not match the Monday, a bellringer answer whose written check is
false, or a link that looks like a key, test or Jeopardy board.

- `weekfile.py` loads and checks the week file and converts the math markup.
- `docs.py` builds the Word files. `mathdoc.py` is the equation/Word layer.
- `outputs.py` builds the board data, parent messages and slide text.
- `example_week5.json` is Week 5 (November 16-20, 2026) as a week file.

Week files that hold teacher-only content stay in the week's Drive folder,
not in this public repo. Needs python-docx and LibreOffice (for the PDFs).
