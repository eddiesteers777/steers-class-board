// node tools/calendar/core.test.mjs — a teacher's own school year (js/calendarRules.js) and the file year staying as it was.
import assert from "node:assert/strict";
import { cleanCalendar, yearFromDoc, docFromYear, splitTerms, termsFromEnds, schoolDays, parsePastedDates, guessKind, PRESETS } from "../../js/calendarRules.js";
import { SCHOOL_YEAR, SCHOOL_DAYS, CAL_SOURCE, TERM_NAME, isSchoolDay, nineWeeksOf } from "../../js/schoolCal.js";
import { SCHOOL_YEAR as FILE } from "../../data/calendar.js?v=57";
let n = 0; const ok = (name, fn) => { fn(); n++; };

ok("Node and the connector still get data/calendar.js unchanged", () => {
    assert.equal(CAL_SOURCE, "file"); assert.equal(SCHOOL_YEAR, FILE); assert.equal(TERM_NAME, "nine weeks");
    assert.equal(SCHOOL_DAYS.length, 177); assert.equal(isSchoolDay("2026-11-24"), false); assert.equal(nineWeeksOf("2026-11-30").n, 2);
});
ok("Shelby preset round-trips to the same year", () => {
    const y = yearFromDoc(docFromYear(PRESETS[0].year, "shelby-2026-27"));
    assert.equal(y.first, FILE.first); assert.equal(y.last, FILE.last);
    assert.deepEqual(y.nineWeeks, FILE.nineWeeks.map((q) => ({ n: q.n, start: q.start, end: q.end })));
    assert.deepEqual(y.events, FILE.events);
    assert.equal(schoolDays(y.first, y.last, y.events).length, 177);
    assert.deepEqual(y.semesters.map((s) => [s.start, s.end]), FILE.semesters.map((s) => [s.start, s.end]));
    assert.equal(y.termName, "nine weeks");
});
ok("bad documents are refused", () => {
    assert.equal(cleanCalendar(null), null);
    assert.equal(cleanCalendar({ first: "2026-08-13" }), null);
    assert.equal(cleanCalendar({ first: "2027-05-27", last: "2026-08-13" }), null);
    assert.equal(cleanCalendar({ first: "2026-08-13", last: "2028-08-13" }), null);
    const c = cleanCalendar({ first: "2026-08-10", last: "2027-05-28", events: [{ a: "x" }, { a: "2026-11-23", b: "2026-11-27", k: "zzz", t: "<b>Break</b>" }], terms: { kind: "weird" } });
    assert.equal(c.events.length, 1); assert.equal(c.events[0].k, "off"); assert.equal(c.terms.kind, "nine"); assert.equal(c.terms.list.length, 4);
});
ok("grading periods split evenly and start on the next school day", () => {
    const ev = [["2026-11-23", "2026-11-27", "off", "Thanksgiving"]];
    const sem = splitTerms("2026-08-10", "2027-05-28", ev, "sem");
    assert.equal(sem.length, 2); assert.equal(sem[0].start, "2026-08-10"); assert.equal(sem[1].end, "2027-05-28");
    const tri = splitTerms("2026-08-10", "2027-05-28", ev, "tri"); assert.equal(tri.length, 3);
    const days = schoolDays("2026-08-10", "2027-05-28", ev), sizes = tri.map((q) => days.filter((d) => d >= q.start && d <= q.end).length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, sizes.join());
    const t = termsFromEnds("2026-08-13", "2027-05-27", FILE.events, ["2026-10-09", "2026-12-18", "2027-03-05", "x"]);
    assert.deepEqual(t.map((q) => q.start), FILE.nineWeeks.map((q) => q.start));
    assert.equal(termsFromEnds("2026-08-13", "2027-05-27", [], ["2026-12-18", "2026-10-09", "", ""]), null);
});
ok("pasted district dates become rows", () => {
    const r = parsePastedDates(["Labor Day: September 7", "Thanksgiving Break Nov 23 - 27", "12/21/2026 – 1/1/2027 Winter Break", "2027-01-18 MLK Day",
        "Spring Break March 22 through March 26", "Teacher Workday Jan 4", "no date here"].join("\n"), "2026-08-10", "2027-05-28");
    assert.deepEqual(r.map((x) => [x.t, x.a, x.b, x.k]), [
        ["Labor Day", "2026-09-07", "2026-09-07", "off"], ["Thanksgiving Break", "2026-11-23", "2026-11-27", "off"],
        ["Winter Break", "2026-12-21", "2027-01-01", "off"], ["MLK Day", "2027-01-18", "2027-01-18", "off"],
        ["Spring Break", "2027-03-22", "2027-03-26", "off"], ["Teacher Workday", "2027-01-04", "2027-01-04", "work"]]);
    assert.equal(parsePastedDates("Winter Break Dec 21 - Jan 1", "2026-08-10", "2027-05-28")[0].b, "2027-01-01");
    assert.equal(guessKind("Professional Development"), "work"); assert.equal(guessKind("Fall Break"), "off");
});
console.log("calendar: " + n + " checks passed");
