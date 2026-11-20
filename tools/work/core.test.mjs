// Student Work archive rules check: node tools/work/core.test.mjs (no browser, no network). Made-up names only.
import * as W from "../../js/workCore.js";
import assert from "node:assert/strict";

const terms = [{ n: 1, start: "2026-08-13", end: "2026-10-09" }, { n: 2, start: "2026-10-14", end: "2026-12-18" }, { n: 3, start: "2027-01-05", end: "2027-03-05" }];
const off = new Set(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-10-12", "2026-10-13"]);
const school = (d) => { const w = new Date(d + "T12:00:00").getDay(); return w > 0 && w < 6 && !off.has(d); };

// filing
let f = W.fileOf("2026-11-19", terms, school);
assert.equal(f.q, 2); assert.equal(f.label, "Week 5"); assert.equal(f.range, "Nov 16-20"); assert.equal(f.monday, "2026-11-16");
assert.equal(W.fileOf("2026-10-14", terms, school).label, "Week 0");            // the week the nine weeks starts in
assert.equal(W.fileOf("2026-12-02", terms, school).label, "Week 6");            // Thanksgiving week has no school, not counted
assert.equal(W.fileOf("2026-12-02", terms, school).range, "Nov 30-Dec 4");
assert.equal(W.fileOf("2026-10-12", terms, school).q, 1);                       // fall break files with the 1st nine weeks
assert.equal(W.fileOf("", terms, school).label, "No date");

// cutting the stack
assert.deepEqual(W.cut(5, 2), [[0, 2], [2, 4], [4, 5]]);
assert.deepEqual(W.cut(3, 0), [[0, 1], [1, 2], [2, 3]]);
assert.equal(W.guessPer(56, 29), 2); assert.equal(W.guessPer(28, 29), 1); assert.equal(W.guessPer(84, 29), 3); assert.equal(W.guessPer(10, 0), 1);

// matching names
const roster = ["Ava M.", "Ben C.", "Chloe D.", "Diego F.", "Ella G."];
let m = W.matchNames(4, roster);
assert.deepEqual(m.map((x) => x.name), ["Ava M.", "Ben C.", "Chloe D.", "Diego F."]);
assert.ok(m.every((x) => x.guess));
assert.deepEqual(W.missing(roster, m), ["Ella G."]);
// Ben is absent: the teacher fixes paper 1 to Chloe, the rest move along
m = W.matchNames(4, roster, { 1: "Chloe D." });
assert.deepEqual(m.map((x) => x.name), ["Ava M.", "Chloe D.", "Diego F.", "Ella G."]);
assert.deepEqual(W.missing(roster, m), ["Ben C."]);
// key on top
m = W.matchNames(3, roster, {}, "roster", true);
assert.deepEqual(m.map((x) => x.name), [W.KEY, "Ava M.", "Ben C."]);
// a name picked later is not guessed earlier
m = W.matchNames(3, roster, { 2: "Ava M." });
assert.deepEqual(m.map((x) => x.name), ["Ben C.", "Chloe D.", "Ava M."]);
// mixed stack: nothing guessed
m = W.matchNames(2, roster, { 1: "Ella G." }, "mixed");
assert.deepEqual(m.map((x) => x.name), ["", "Ella G."]);
assert.deepEqual(W.doubles([{ name: "A" }, { name: "A" }, { name: W.SAME }, { name: W.SAME }]), ["A"]);

// pages to save
const papers = W.cut(6, 2);
const names = [{ name: "Ava M." }, { name: W.SAME }, { name: W.SKIP }];
assert.deepEqual(W.pagesFor(papers, names), [{ page: 0, s: "Ava M." }, { page: 1, s: "Ava M." }, { page: 2, s: "Ava M." }, { page: 3, s: "Ava M." }]);

// tree and folder
const sets = [
    { id: "a", title: "Exit ticket", date: "2026-11-19", kind: "graded", pages: [{ p: "1", s: "Ava M." }, { p: "2", s: "Ben C." }] },
    { id: "b", title: "Notes", date: "2026-11-16", kind: "kept", pages: [{ p: "3", s: "Ben C." }] },
    { id: "c", title: "Quiz 4", date: "2026-11-13", kind: "graded", pages: [{ p: "4", s: "Ben C." }] },
];
const t = W.tree(sets, terms, school);
assert.equal(t.length, 1); assert.equal(t[0].q, 2); assert.equal(t[0].weeks[0].label, "Week 5"); assert.equal(t[0].weeks[0].sets[0].id, "a"); assert.equal(t[0].weeks[1].label, "Week 4");
const fo = W.folder("Ava M.", sets, terms, school);
assert.equal(fo.length, 2);
assert.deepEqual(fo[0].items.map((i) => [i.set.id, i.missing]), [["a", false]]);   // kept notes she did not turn in are not "missing"
assert.deepEqual(fo[1].items.map((i) => [i.set.id, i.missing]), [["c", true]]);

assert.deepEqual(W.parts([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.equal(W.weeksLeft(0, 100, 0), null); assert.equal(W.weeksLeft(200, 1000, 2), 8);
assert.equal(W.initials("Chloe D."), "CD"); assert.equal(W.initials("Ava"), "A");
console.log("work core: all checks passed");

// pasting Claude's name list
const r2 = ["Ava M.", "Ben C.", "Ben D.", "Chloe D.", "Diego F."];
const got = W.parseNameList("1. Ava Martinez\n2) Ben Carter (high)\n3 skip\n4 ?\n5 key\n6 same\n7 Chloe\n8 Ben\n9 Zed Q.", r2);
assert.deepEqual(got.picks, { 0: "Ava M.", 1: "Ben C.", 2: W.SKIP, 3: "", 4: W.KEY, 5: W.SAME, 6: "Chloe D.", 7: "", 8: "" });
assert.deepEqual(got.unknown.map((u) => u.n), [8, 9]); assert.equal(got.count, 9);
assert.deepEqual(W.parseNameList("1 Ava M., 2 Diego F., 3 Chloe D.", r2).picks, { 0: "Ava M.", 1: "Diego F.", 2: "Chloe D." });
console.log("paste list: all checks passed");
