// ACAP readiness rules check: node tools/acap/readiness.test.mjs (no browser, no network). Made-up names only.
import * as R from "../../js/readiness.js";
import { ACAP } from "../../data/acap.js";
import { STANDARDS } from "../../data/standards.js";
import assert from "node:assert/strict";

// Blueprint: the points Eddie gave, 46 in each grade, and every 7th/8th standard falls in exactly one category.
for (const g of ["7", "8"]) assert.equal(ACAP[g].cats.reduce((s, c) => s + c.pts, 0), 46);
for (const [cls, n] of [["7th", 22], ["8th", 30], ["8th-acc", 30]]) {
    const hit = STANDARDS[cls].standards.filter((s) => R.catOf(cls, s.code));
    assert.equal(hit.length, n, cls + " standards with a category");
}
assert.equal(R.catOf("7th", "7.4").id, "NSO"); assert.equal(R.catOf("7th", "7.4").per, 5);
assert.equal(R.catOf("7th", "7.16").id, "DSP"); assert.equal(R.catOf("8th", "8.17").id, "NAF"); assert.equal(R.catOf("8th", "8.18").id, "DSP");
assert.equal(R.catOf("8th-acc", "Alg I.3"), null, "Algebra I has no ACAP weight");
assert.equal(R.catOf("8th", "7.4"), null, "a 7th standard in an 8th class is not weighted");
assert.equal(R.calcOf("8th", "8.3"), "no"); assert.equal(R.calcOf("7th", "7.8"), "yes");

// States.
assert.equal(R.stateOf(null, false), "none");
assert.equal(R.stateOf(0.49, true), "notyet");
assert.equal(R.stateOf(0.5, false), "developing");
assert.equal(R.stateOf(0.9, false), "developing", "80%+ without the lock is Developing");
assert.equal(R.stateOf(0.8, true), "secure");

// Lock from the answer trail: 5 right, 6 of last 8, 2 days.
const det = [
    { date: "2026-11-16", qs: [{ std: "7.4" }, { std: "7.10" }], st: [{ s: "Ava Rivera", lg: ["0:1:5:0", "0:1:5:0", "0:1:5:0", "1:0:5:0"] }] },
    { date: "2026-11-18", qs: [{ std: "7.4" }], st: [{ s: "Ava R.", lg: ["0:1:5:0", "0:2:5:0", "0:1:5:0", "0:1:5:0"] }] },
];
const trail = R.answerTrail(det, (s) => (s.startsWith("Ava") ? "Ava R." : ""));
const t74 = trail.get("Ava R.").get("7.4");
assert.equal(t74.h, "1111011"); assert.equal(t74.days.size, 2);
assert.equal(R.lockOf(t74).met, true);
assert.equal(R.lockOf(trail.get("Ava R.").get("7.10")).met, false);
assert.equal(R.lockOf(null, { m: "2026-11-01" }).met, true, "a lock cracked in the game profile counts");
assert.match(R.lockOf(null).left, /5 more right/);

// One student: 7.4 Secure, 7.10 Not Yet, 7.1 Developing (85% but no lock), others unscored.
const rec = { stds: [{ code: "7.4", latest: 0.9, n: 3 }, { code: "7.10", latest: 0.3, n: 2 }, { code: "7.1", latest: 0.85, n: 2 }, { code: "7.12", latest: 0.6, n: 1 }] };
const me = R.readinessOf("7th", STANDARDS["7th"].standards, rec, trail.get("Ava R."), null);
const st = (c) => me.rows.find((r) => r.code === c).state;
assert.equal(st("7.4"), "secure"); assert.equal(st("7.10"), "notyet"); assert.equal(st("7.1"), "developing"); assert.equal(st("7.22"), "none");
const nso = me.cats.find((c) => c.id === "NSO"); assert.equal(nso.secure, 1); assert.equal(nso.none, 1);
// Ranking: 7.10 (gap .7 x 15/7) > 7.12 (gap .4 x 15/7) > 7.1 (gap .15 x 2).
assert.deepEqual(me.next.map((r) => r.code), ["7.10", "7.12", "7.1"]);
assert.match(R.whyLine(me.next[0]), /about 2.1 of 46/);

// Class focus adds students up.
const focus = R.classFocus([me, me]); assert.equal(focus[0].code, "7.10"); assert.equal(focus[0].notyet, 2);

// Extra credit: one a week.
const now = Date.parse("2026-11-25T15:00:00");
const idx = [{ id: "a", xc: true, status: "open", only: { per: "2nd", nm: "Ava R." }, opened: Date.parse("2026-11-23T10:00:00") }];
assert.ok(R.extraThisWeek(idx, "2nd", "Ava R.", now));
assert.equal(R.extraThisWeek(idx, "2nd", "Ben S.", now), null);
assert.equal(R.extraThisWeek(idx, "2nd", "Ava R.", Date.parse("2026-12-01T15:00:00")), null);
assert.equal(R.levelsFor("notyet")[0], 1);
console.log("readiness: all checks passed");

// Gradebook extra credit: adds earned points, never possible points, never a zero.
const G = await import("../../js/gradeCore.js");
const setup = G.cleanSetup(null), reg = G.makeItem({ title: "Quiz", cat: "qt", pts: 10, src: { k: "hand" } }, "q"), xc = G.makeItem({ title: "XC", cat: "qt", pts: 5, xc: true, src: { k: "hand" } }, "x");
const g1 = G.gradeOf([{ item: reg, cell: { f: 0.8, x: "" } }, { item: xc, cell: { f: 1, x: "" } }], setup);
assert.equal(g1.possible, 10); assert.equal(g1.earned, 13);
const g2 = G.gradeOf([{ item: reg, cell: { f: 0.8, x: "" } }, { item: xc, cell: { f: null, x: "m" } }], setup);
assert.equal(g2.v, 0.8, "missing extra credit is never a zero");
const cand = G.candidates([{ id: "a", type: "practice", status: "open", title: "Extra credit: 7.4", xc: true, periods: ["2nd"], at: 1 }], [], [], [], setup);
assert.equal(cand[0].kind, "Extra credit"); assert.equal(G.makeItem(cand[0], "z").pts, G.XC_PTS); assert.equal(G.makeItem(cand[0], "z").xc, true);
console.log("extra credit: all checks passed");

// Work on next assignments: one student only, extra credit flag, the copy text.
const AA = await import("../../js/acapAssign.js");
const roster = ["Ava R.", "Ben S.", "Cam T."];
assert.deepEqual(AA.namesOnly(roster, { per: "2nd", nm: "Ben S." }), { "2nd": ["", "Ben S.", ""] });
const { loadStdBank } = await import("../../js/stdBank.js").catch(() => ({}));
const bankItems = [];
for (let i = 0; i < 14; i++) bankItems.push({ std: "7.4", cls: "7th", lvl: 1 + (i % 3), q: "Find {1/2} + " + i, a: String(i), st: i === 3 ? ["Add the parts.", "Simplify."] : [] });
const pool = AA.poolFor(bankItems, "7th", "7.4", "notyet");
assert.ok(pool.every((x) => x.lvl <= 2) && pool.length >= 6);
const def = AA.makeDef({ cls: "7th", per: "2nd", nm: "Ben S.", code: "7.4", text: "Apply and extend previous understandings of operations", state: "notyet", latest: 0.4, pool, xc: true });
assert.equal(def.type, "practice"); assert.equal(def.skills[0].need, 5); assert.equal(def.xc, true); assert.deepEqual(def.only, { per: "2nd", nm: "Ben S." });
const C2 = await import("../../js/assignCore.js");
const pub = C2.publicDoc(Object.assign({ code: "123456" }, def), AA.namesOnly(roster, def.only), "t1");
assert.equal(pub.one, true); assert.deepEqual(pub.names["2nd"], ["", "Ben S.", ""]);
assert.equal(AA.indexEntry(def).xc, true); assert.equal(AA.indexEntry(def).only.nm, "Ben S.");
const cv = AA.copyVersion({ code: "7.4", text: "Add", calc: "no", pool: AA.poolFor(bankItems, "7th", "7.4", "notyet", 11) }, "Ben S.");
assert.equal(cv.n, 10); assert.match(cv.text, /Worked example\nFind 1\/2 \+ 3/); assert.match(cv.text, /Answer key/);
assert.equal(AA.plain("4{2/3} and {x + 1/2} and §5 and x^{12}"), "4 2/3 and (x + 1)/2 and $5 and x^(12)");
console.log("work on next: all checks passed");
