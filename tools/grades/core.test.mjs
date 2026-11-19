// Grades rules check: node tools/grades/core.test.mjs (no browser, no network). Made-up names and scores only.
import * as G from "../../js/gradeCore.js";
import assert from "node:assert/strict";
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, (m || "") + ": " + a + " vs " + b);
const terms = [{ n: 1, start: "2026-08-13", end: "2026-10-09" }, { n: 2, start: "2026-10-14", end: "2026-12-18" }, { n: 3, start: "2027-01-05", end: "2027-03-05" }];
assert.equal(G.termOf("2026-11-19", terms), 2); assert.equal(G.termOf("2026-10-12", terms), 1); assert.equal(G.termOf("2027-01-05", terms), 3);

const setup = G.cleanSetup(null);
assert.equal(setup.cats.length, 3); assert.equal(G.weighted(setup), false);
assert.equal(G.letter(0.8995, setup.scale), "A"); assert.equal(G.letter(0.899, setup.scale), "B"); assert.equal(G.letter(0.42, setup.scale), "F"); assert.equal(G.letter(null, setup.scale), "");

const roster = ["Ava R.", "Ben S.", "Cora D.", "Dev P."];
const asg = new Map([["a1", { id: "a1", res: { rows: [
    { per: "1st", ni: 0, nm: "Ava R.", s: 1, g: 0.7, c: 1, fx: 0.85 },
    { per: "1st", ni: 1, nm: "Ben S.", s: 1, g: 0.83, c: 1, fx: null },
    { per: "1st", ni: 2, nm: "Cora D.", s: 0, g: 0, c: 0, fx: null },
    { per: "2nd", ni: 0, nm: "Zed Q.", s: 1, g: 1, c: 1 } ] } }]]);
const imports = new Map([["i1", { id: "i1", source: "DeltaMath", rows: [{ s: "Ava Rodriguez", v: [1, 0.5] }, { s: "Ben S", v: [0.6, null] }, { s: "Nobody Here", v: [1] }] }]]);
const hand = new Map([["h1", { sc: { "1st|Ava R.": { p: 8 }, "1st|Ben S.": { x: "m" }, "1st|Cora D.": { x: "ex" }, "2nd|Ava R.": { p: 1 } } }],
    ["a1", { sc: { "1st|Ben S.": { p: 90 }, "1st|Dev P.": { x: "m" } } }]]);
const ctx = { asg, imports, hand };
const itA = G.makeItem({ title: "Unit 4 Test", date: "2026-11-12", cat: "qt", periods: ["1st", "2nd"], src: { k: "asg", id: "a1" } }, "a1");
const itD = G.makeItem({ title: "DeltaMath 4.2", date: "2026-11-10", cat: "cw", periods: ["1st"], src: { k: "data", ids: { "1st": "i1" } } }, "d1");
const itH = G.makeItem({ title: "HW 12", date: "2026-11-16", cat: "hw", pts: 10, periods: ["1st"], src: { k: "hand" } }, "h1");
assert.equal(itA.pts, 100); assert.equal(itH.pts, 10);

const cA = G.cellsFor(itA, "1st", roster, ctx);
near(cA.get(0).f, 0.85, "corrections after"); near(cA.get(0).before, 0.7, "before"); assert.equal(cA.get(0).c, 1);
assert.equal(cA.get(1).by, "hand"); assert.equal(cA.get(1).edited, true); near(cA.get(1).f, 0.9, "typed override");
assert.equal(cA.has(2), false, "not started = no score"); assert.equal(cA.get(3).x, "m");
const cD = G.cellsFor(itD, "1st", roster, ctx);
near(cD.get(0).f, 0.75, "full name matched to roster, mean"); near(cD.get(1).f, 0.6, "blank column ignored"); assert.equal(cD.size, 2, "unmatched name dropped");
const cH = G.cellsFor(itH, "1st", roster, ctx);
near(cH.get(0).f, 0.8); assert.equal(cH.get(1).x, "m"); assert.equal(cH.get(2).x, "ex");

// total points (no weights): Ava 85 + 75 + 8 of 210
const T = G.gradeTable([itA, itD, itH], "1st", roster, ctx, setup, 2, terms);
assert.deepEqual(T.cols.map((c) => c.item.id), ["h1", "a1", "d1"], "newest first");
near(T.rows[0].grade.v, (85 + 75 + 8) / 210, "Ava total points");
// Ben: 90 + 60 + missing 0 of 210
near(T.rows[1].grade.v, (90 + 60) / 210, "Ben missing counts 0"); assert.equal(T.rows[1].grade.missing, 1);
// Cora: excused, nothing else: no grade
assert.equal(T.rows[2].grade.v, null);
// Dev: only missing on the test -> 0
near(T.rows[3].grade.v, 0);
// missing as blank
const blank = G.cleanSetup({ missing: "blank" });
assert.equal(G.gradeTable([itA, itD, itH], "1st", roster, ctx, blank, 2, terms).rows[3].grade.v, null);
// weighted: qt 50, cw 30, hw 20
const w = G.cleanSetup({ cats: [{ id: "hw", name: "Homework", w: 20 }, { id: "cw", name: "Class Work", w: 30 }, { id: "qt", name: "Quizzes & Tests", w: 50 }] });
const TW = G.gradeTable([itA, itD, itH], "1st", roster, ctx, w, 2, terms);
near(TW.rows[0].grade.v, 0.5 * 0.85 + 0.3 * 0.75 + 0.2 * 0.8, "Ava weighted");
// a category with nothing graded shares out its weight: Dev has only qt (0) -> 0; Cora has none
near(TW.rows[1].grade.v, 0.5 * 0.9 + 0.3 * 0.6 + 0.2 * 0, "Ben weighted");
const onlyCW = G.gradeOf([{ item: itD, cell: cD.get(0) }], w); near(onlyCW.v, 0.75, "renormalized");
// not-counted item
const off = Object.assign({}, itH, { off: true });
near(G.gradeTable([itA, itD, off], "1st", roster, ctx, setup, 2, terms).rows[0].grade.v, (85 + 75) / 200);
// other period / other term
assert.equal(G.gradeTable([itA, itD, itH], "2nd", roster, ctx, setup, 2, terms).cols.length, 1);
assert.equal(G.gradeTable([itA, itD, itH], "1st", roster, ctx, setup, 1, terms).cols.length, 0);
// class averages per column
near(T.cols[1].avg, (0.85 + 0.9) / 2, "test class average");
// a score arriving clears missing
const h2 = new Map([["h1", { sc: { "1st|Ben S.": { p: 7, x: "m" } } }]]);
assert.equal(G.cellsFor(itH, "1st", roster, { hand: h2 }).get(1).x, "");
// trajectory
const tr = G.trajectory([itA, itD, itH], (it) => G.cellsFor(it, "1st", roster, ctx).get(0) || null, setup);
assert.deepEqual(tr.map((p) => p.d), ["2026-11-10", "2026-11-12", "2026-11-16"]); near(tr[0].v, 0.75);
// CSV: oldest first, points, M / EX, no full names
const csv = G.tableCsv(T, setup).split("\n");
assert.ok(csv[0].startsWith('"Student","Term grade %","Letter","DeltaMath 4.2'));
assert.ok(csv[2].includes(",M"), csv[2]); assert.ok(csv[3].includes("EX")); assert.ok(!csv.join().includes("Rodriguez"));
// candidates
const cands = G.candidates([{ id: "a1", title: "Unit 4 Test", type: "test", periods: ["1st"], at: 1 }, { id: "a2", title: "Slope practice", type: "practice", periods: ["1st"], at: 2 }, { id: "a3", type: "fix", title: "x" }, { id: "a4", status: "draft", title: "y" }],
    [{ id: "i1", title: "DeltaMath 4.2", date: "2026-11-10", period: "1st" }, { id: "i2", title: "Magma Quiz 3", date: "2026-11-11", period: "1st" }, { id: "i3", title: "Magma Quiz 3", date: "2026-11-11", period: "2nd" }, { id: "x", title: "Assignment: T", source: "Assignment", period: "1st" }],
    [itA, itD], ["asg:a9"], setup);
assert.deepEqual(cands.map((c) => c.title), ["Magma Quiz 3", "Slope practice"]);
assert.deepEqual(cands[0].src.ids, { "1st": "i2", "2nd": "i3" }); assert.equal(cands[0].cat, "qt"); assert.equal(cands[1].cat, "cw");
// typed scores
assert.equal(G.parseScore("8", 10), 8); assert.equal(G.parseScore("85%", 10), 8.5); assert.equal(G.parseScore("4/5", 10), 8); assert.equal(G.parseScore("", 10), null); assert.equal(G.parseScore("abc", 10), null);
console.log("grades core: all checks passed");
