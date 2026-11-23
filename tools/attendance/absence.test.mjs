// What an absent student missed, and the warnings: node tools/attendance/absence.test.mjs  (made-up names only)
import assert from "node:assert/strict";
import * as C from "../../js/absenceCore.js";
import { absences } from "../../js/attendanceCore.js";

// 2026-11-23 is a Monday. Week of 11-16 had: Mon notes, Tue speed dating, Thu test.
const day = (n, ag) => ({ name: n, agenda: ag });
const weeks = [
  { id: "week5", monday: "2026-11-16", classes: { "8th": { label: "8th Grade", assessment: { type: "test", day: 3, name: "Test" },
      days: [day("Monday", ["Guided Notes Day 1"]), day("Tuesday", ["Speed Dating Activity", "Guided Notes Day 1"]), day("Wednesday", ["Fact Blitz", "Guided Notes Day 2"]), day("Thursday", ["Test"]), day("Friday", ["Vault Raid"])] } } },
  { id: "week6", monday: "2026-11-23", classes: { "8th": { label: "8th Grade", days: [day("Monday", ["Guided Notes Day 3"]), day("Tuesday", []), day("Wednesday", []), day("Thursday", []), day("Friday", [])] } } },
];
const periods = [["1st", "8th"], ["2nd", "8th"], ["5th", "7th"]];
const gb = { cats: [{ id: "hw", name: "Homework" }, { id: "cw", name: "Class Work" }, { id: "qt", name: "Quizzes & Tests" }],
  items: [{ id: "g1", title: "Speed Dating", date: "2026-11-17", cat: "cw", periods: ["1st", "2nd"] }, { id: "g2", title: "Unit check-in", date: "2026-11-17", cat: "cw", periods: ["2nd"] }] };

// plain language, graded vs practice, make-up test
let it = C.itemsFor({ weeks, periods, gb, data: [], asg: [], per: "1st", day: "2026-11-17" });   // Tuesday
assert.deepEqual(it.map((x) => x.t), ["Speed Dating Activity", "Guided Notes Day 1"]);
assert.equal(it[0].graded, true); assert.equal(it[0].catName, "Class Work");     // the Gradebook has a Speed Dating item that day
assert.equal(it[1].graded, false);                                                // guided notes: practice
assert.equal(C.missedLine("2026-11-17", it, true), "Missed Tuesday — Speed Dating Activity, Guided Notes Day 1");
it = C.itemsFor({ weeks, periods, gb, data: [], asg: [], per: "2nd", day: "2026-11-17" });
assert.ok(it.some((x) => x.t === "Unit check-in" && x.graded), "a Gradebook item with no agenda match is listed on its own, graded");
it = C.itemsFor({ weeks, periods, gb, data: [], asg: [], per: "1st", day: "2026-11-19" });   // Thursday test
assert.equal(it.length, 1); assert.equal(it[0].t, "Test"); assert.ok(it[0].graded && it[0].makeup); assert.equal(it[0].catName, "Quizzes & Tests");
assert.equal(C.missedLine("2026-11-19", it, true), "Missed Thursday — Test (make-up needed)");

// Fact Blitz and Vault Raid: from the agenda and from Class Data sets
const data = [{ period: "1st", date: "2026-11-18", source: "Fact Blitz", title: "Fact Blitz: Integer facts" }, { period: "2nd", date: "2026-11-18", source: "Fact Blitz", title: "Fact Blitz: other period" }, { period: "1st", date: "2026-11-20", source: "Vault Raid", title: "Vault Raid: Equations" }];
it = C.itemsFor({ weeks, periods, gb, data, asg: [], per: "1st", day: "2026-11-18" });
assert.deepEqual(it.map((x) => x.t), ["Fact Blitz: Integer facts", "Guided Notes Day 2"]);   // the set's title replaces the bare agenda line, once
assert.equal(it[0].game, "Fact Blitz");
it = C.itemsFor({ weeks, periods, gb, data, asg: [], per: "1st", day: "2026-11-20" }); assert.deepEqual(it.map((x) => x.t), ["Vault Raid: Equations"]);

// Assignments opened that day (not one-student, not extra credit)
const asg = [{ id: "a", title: "Practice: 8.5", type: "practice", periods: ["1st"], opened: Date.parse("2026-11-17T10:00:00") }, { id: "b", title: "Mine only", type: "practice", periods: ["1st"], only: { per: "1st", nm: "Ava R." }, opened: Date.parse("2026-11-17T10:00:00") }];
it = C.itemsFor({ weeks, periods, gb: { cats: gb.cats, items: [] }, data: [], asg, per: "1st", day: "2026-11-17" });
assert.ok(it.some((x) => x.t === "Practice: 8.5" && !x.graded)); assert.ok(!it.some((x) => x.t === "Mine only"));

// no lesson plan for that day: say so, never invent
assert.equal(C.missedLine("2026-11-10", C.itemsFor({ weeks, periods, gb, data: [], asg: [], per: "1st", day: "2026-11-10" }), false), "Missed Tuesday — no lesson plan found for that day");
assert.deepEqual(C.itemsFor({ weeks, periods, gb, data: [], asg: [], per: "1st", day: "2026-11-21" }), []);   // a Saturday

// dates
assert.equal(C.mondayOf("2026-11-22"), "2026-11-16"); assert.equal(C.mondayOf("2026-11-23"), "2026-11-23"); assert.equal(C.dayName("2026-11-19"), "Thursday");

// dashboard: a student with two days in a week, a test, 3 graded items, and a behind standard
const docs = [
  { day: "2026-11-17", doc: { out: { "1st": { "ben-k": { n: "Ben K.", at: 1 }, "ava-r": { n: "Ava R.", at: 1 } } } } },
  { day: "2026-11-19", doc: { out: { "1st": { "ben-k": { n: "Ben K.", at: 1 } } } } },
  { day: "2026-11-23", doc: { out: { "1st": { "cara-l": { n: "Cara L.", at: 1 } }, "5th": { "dev-p": { n: "Dev P.", at: 1 } } } } },
  { day: "2026-10-01", doc: { out: { "1st": { "old-o": { n: "Old O.", at: 1 } } } } },       // outside the two-week window
  { day: "2026-11-21", doc: { out: { "1st": { "sat-s": { n: "Sat S.", at: 1 } } } } },       // a Saturday: ignored
];
const behind = (per, nm, codes) => (nm === "Ben K." ? codes.filter((c) => c === "8.5") : []);
const wk = JSON.parse(JSON.stringify(weeks)); wk[0].classes["8th"].days[1].notes = { standard: "8.5 Solve linear equations" };
const D = C.buildDashboard({ absences: absences(docs, []), weeks: wk, periods, gb, data, asg: [], behind, today: "2026-11-23" });
assert.deepEqual(D.periods.map((p) => p.per), ["1st", "5th"]);
const p1 = D.periods[0].students.map((s) => s.nm);
assert.deepEqual(p1, ["Ben K.", "Cara L.", "Ava R."]);            // warned first, then out today, then the rest
const ben = D.periods[0].students[0];
assert.deepEqual(ben.days.map((d) => d.name), ["Thursday", "Tuesday"]);
assert.deepEqual(ben.warnings.map((w) => w.k), ["days", "test", "behind"]);   // 3+ graded not reached: Speed Dating (graded) + the test = 2
assert.match(ben.warnings[2].text, /8\.5/);
const cara = D.periods[0].students[1]; assert.ok(cara.today); assert.equal(cara.days[0].line, "Missed Monday — Guided Notes Day 3"); assert.deepEqual(cara.warnings, []);
assert.equal(D.outToday, 2); assert.equal(D.warned, 1);
// three graded assignments in the window raise the "work" warning
const gb3 = { cats: gb.cats, items: [{ id: "x", title: "Speed Dating", date: "2026-11-17", cat: "cw", periods: ["1st"] }, { id: "y", title: "Notes check", date: "2026-11-17", cat: "cw", periods: ["1st"] }, { id: "z", title: "Notes check two", date: "2026-11-19", cat: "hw", periods: ["1st"] }] };
const D3 = C.buildDashboard({ absences: absences(docs, []), weeks: wk, periods, gb: gb3, data: [], asg: [], behind: null, today: "2026-11-23" });
assert.ok(D3.periods[0].students.find((s) => s.nm === "Ben K.").warnings.some((w) => w.k === "work"));

// the profile check for "already behind": tried 3+ times and not Secure (no cracked lock, or under 80% lately)
const kid = { t: { "s-8-5": { a: 6, h: "100101" }, "s-8-6": { a: 8, h: "11111111", m: "2026-11-10" }, "s-8-7": { a: 2, h: "00" }, "s-8-8": { a: 5, h: "11100", m: "2026-11-01" }, "s-8-9": { a: 5, h: "11110", m: "2026-11-01" } } };   // 8.9: lock cracked and exactly 80% = Secure (Phase 1 rule)
assert.deepEqual(C.behindFromKid(kid, ["8.5", "8.6", "8.7", "8.8", "8.9", "8.10"]), ["8.5", "8.8"]);
assert.deepEqual(C.behindFromKid(null, ["8.5"]), []);
// the saved record holds no more than a key, short name, day and time
assert.ok(!JSON.stringify(docs).match(/birth|dob|id":|last/i));
console.log("absence dashboard core: all checks passed");
