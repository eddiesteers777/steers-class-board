// Catch-up rules: node tools/attendance/catchup.test.mjs  (made-up names; real Week 5 notes from data/week5.js)
import assert from "node:assert/strict";
import fs from "node:fs";
import * as K from "../../js/catchupCore.js";
import * as C from "../../js/absenceCore.js";
import { absences } from "../../js/attendanceCore.js";

// the day's student papers only: never a key, never the modified group's copy, never another day's paper
const papers = [{ id: "sheet", pre: "0 Weekly" }, { id: "notes0", pre: "1 Monday" }, { id: "notes0key", pre: "1 Monday", key: true }, { id: "modnotes0", pre: "1 Monday", alt: true }, { id: "sd", pre: "2 Tuesday" }, { id: "quiz", pre: "4 Thursday" }, { id: "quizkey", pre: "4 Thursday", key: true }];
assert.deepEqual(K.dayPapers(papers, 0).map((p) => p.id), ["notes0"]);
assert.deepEqual(K.dayPapers(papers, 3).map((p) => p.id), ["quiz"]);
assert.deepEqual(K.dayPapers(papers, 4), []);

// the routing rule in Eddie's words
assert.match(K.ROUTES.deltamath.when, /built-in examples, videos and instant help/);
assert.match(K.ROUTES.magma.when, /control the pacing/);

// marks: one student per write, the kid key Phase 1-3 use, first name + initial only
assert.deepEqual(K.markWrite("Ben K.", "2026-11-17", "assigned", "deltamath", 5), { kids: { "ben-k": { nm: "Ben K.", d: { "2026-11-17": { st: "assigned", via: "deltamath", at: 5 } } } }, at: 5 });
assert.equal(K.markWrite("Ben K.", "2026-11-17", "done", "nonsense", 5).kids["ben-k"].d["2026-11-17"].via, "");
const doc = { kids: { "ben-k": { nm: "Ben K.", d: { "2026-11-17": { st: "done", via: "magma", at: 1 }, "2026-11-19": { st: "", via: "", at: 2 } } } } };
assert.deepEqual(K.marksOf(doc, "ben k"), { "2026-11-17": { st: "done", via: "magma", at: 1 } });   // a cleared mark is dropped
assert.deepEqual(K.marksOf(null, "Ben K."), {});

// copy text from the real Week 5 Monday notes: worked example, problems, key, all copied from the week file
const s = fs.readFileSync(new URL("../../data/week5.js", import.meta.url), "utf8"), wk5 = JSON.parse(s.slice(s.indexOf("export default") + 14).trim().replace(/;\s*$/, ""));
const notes = wk5.classes["8th"].days[0].notes, probs = K.notesProblems(notes);
assert.ok(probs.length >= 4, "week 5 notes have practice problems");
const cp = K.copyFromNotes(notes, "deltamath", "Monday, Nov 16");
assert.equal(cp.n, Math.min(10, probs.length));
assert.match(cp.text, /^Catch-up: Triangle Angle Sum \(Monday, Nov 16\)/);
assert.match(cp.text, /For DeltaMath: /); assert.match(cp.text, /Worked example: Find the missing angle/); assert.match(cp.text, /Step 3: x = 70°/);
const keyAt = cp.text.indexOf("Answer key (teacher only)"), probAt = cp.text.indexOf("\nProblems\n");
assert.ok(probAt > 0 && keyAt > probAt, "problems first, key after");
probs.slice(0, cp.n).forEach((p, k) => { assert.ok(cp.text.includes((k + 1) + ". " + K.plain(p.q))); assert.ok(cp.text.slice(keyAt).includes((k + 1) + ". " + K.plain(p.a)), "key line " + (k + 1) + " is the week file's answer"); });
// independent check of the copied answers: Week 5 Monday is the triangle angle sum (angles add to 180)
const ang = (t) => (String(t).match(/(\d+)°/g) || []).map((x) => +x.replace("°", ""));
probs.slice(0, cp.n).forEach((p) => { const g = ang(p.q), a = ang(p.a); if (/triangle has angles/i.test(p.q) && g.length === 2 && a.length === 1) assert.equal(g[0] + g[1] + a[0], 180, "answer checked: " + p.q); });
assert.match(K.copyFromNotes(notes, "magma").text, /For Magma Math: You lead/);
assert.deepEqual(K.copyFromNotes(null, "deltamath"), { text: "", n: 0 });
assert.equal(K.plain("{3/4} of 4{2/3} costs §5 [[graph {}]]"), "3/4 of 4 2/3 costs $5 [picture]");
assert.equal(K.plain("{1{1/2}/−{3/4}}"), "(1 1/2)/(−3/4)");   // Week 5 7th grade, problem 4 (was "{1 1/2/−3/4}")
assert.equal(K.plain("{{3/4}/{1/8}}"), "(3/4)/(1/8)");
assert.equal(K.plain("x^2 + {3/4}x"), "x^2 + (3/4)x");
assert.equal(K.plain("−{2/3} ÷ (−{4/9})"), "−2/3 ÷ (−4/9)");
// real braces stay (sets and relations); exponents as before (Nov 23 paste fix, checked against the whole standards bank)
assert.equal(K.plain("{1, 2, 4}"), "{1, 2, 4}"); assert.equal(K.plain("What is the domain of {(1, 3), (2, 5), (4, 3)}?"), "What is the domain of {(1, 3), (2, 5), (4, 3)}?");
assert.equal(K.plain("x^{2}"), "x^2"); assert.equal(K.plain("2^{n−1}"), "2^(n−1)"); assert.equal(K.plain("4^{1/2}"), "4^(1/2)");
assert.equal(K.plain("Expand: −{2/3}(6x − 9)"), "Expand: −(2/3)(6x − 9)");
// Phase 1's DeltaMath / Magma copy now uses the same converter
const AA = await import("../../js/acapAssign.js");
["{1, 2, 4}", "x^{2n}", "{3/4}x", "2{1/4}", "{{3/4}/{1/8}}"].forEach((t) => assert.equal(AA.plain(t), K.plain(t))); assert.equal(AA.plain("{1{1/2}/−{3/4}}"), "(1 1/2)/(−3/4)");

// the dashboard: a caught-up day no longer counts; all caught up = no warnings
const day = (n, ag) => ({ name: n, agenda: ag });
const weeks = [{ id: "w", monday: "2026-11-16", classes: { "8th": { assessment: { type: "test", day: 3, name: "Test" }, days: [day("Mon", ["Guided Notes"]), day("Tue", ["Speed Dating Activity"]), day("Wed", []), day("Thu", ["Test"]), day("Fri", [])] } } }];
const att = [{ day: "2026-11-17", doc: { out: { "1st": { "ben-k": { n: "Ben K.", at: 1 } } } } }, { day: "2026-11-19", doc: { out: { "1st": { "ben-k": { n: "Ben K.", at: 1 } } } } }];
const run = (marks) => C.buildDashboard({ absences: absences(att, []), weeks, periods: [["1st", "8th"]], gb: { items: [], cats: [] }, data: [], asg: [], marks, today: "2026-11-23" }).periods[0].students[0];
assert.deepEqual(run(null).warnings.map((w) => w.k), ["days", "test"]);
const half = run(() => ({ "2026-11-19": { st: "done", via: "", at: 1 } }));
assert.deepEqual(half.warnings.map((w) => w.k), ["days"]); assert.equal(half.days.find((d) => d.day === "2026-11-19").mark.st, "done");
const all = run(() => ({ "2026-11-17": { st: "done" }, "2026-11-19": { st: "done" } }));
assert.deepEqual(all.warnings, []); assert.ok(all.allDone);
assert.deepEqual(run(() => ({ "2026-11-19": { st: "assigned", via: "deltamath" } })).warnings.map((w) => w.k), ["days", "test"]);   // assigned is not done yet

// the standard a missed day covered now also comes from codes on that day's practice problems (Week 5: 8.25)
assert.deepEqual(C.standardsFor({ weeks: [wk5], periods: [["1st", "8th"]], per: "1st", day: "2026-11-16" }), ["8.25"]);
console.log("catch-up core: all checks passed");
