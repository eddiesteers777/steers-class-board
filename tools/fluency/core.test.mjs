// Fact Blitz rules (js/factCore.js). Run: node tools/fluency/core.test.mjs
import * as F from "../../js/factCore.js";
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log("FAIL", msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + " (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

// every fact in every set has a whole-number answer, and the sets are the expected sizes
eq(F.factsOf("mul", 12).length, 121, "mul 2-12");
eq(F.factsOf("mul", 10).length, 81, "mul 2-10");
eq(F.factsOf("div", 12).length, 121, "div 2-12");
eq(F.factsOf("ias", 12).length, 864, "int +/- 12");
eq(F.factsOf("imd", 12).length, 726, "int x/÷ 12");
for (const [k] of F.SETS) for (const top of [10, 12]) {
    const all = F.factsOf(k, top);
    ok(all.every((f) => { const a = F.answerOf(f); return a != null && Number.isInteger(a); }), k + top + " whole answers");
    if (k === "div" || k === "imd") ok(all.filter((f) => f.includes("d")).every((f) => { const p = F.parseFact(f); return p.b !== 0 && p.a % p.b === 0 && Math.abs(F.answerOf(f)) >= 2 && Math.abs(F.answerOf(f)) <= top; }), k + top + " division quotients in the table");
    if (k === "ias") ok(all.every((f) => { const p = F.parseFact(f); return p.a < 0 || p.b < 0; }), "every integer fact has a negative");
    if (k === "ias") ok(all.every((f) => { const p = F.parseFact(f); return Math.abs(p.a) <= top && Math.abs(p.b) <= top && p.a && p.b; }), "integer facts in range, no zero");
}
// answers checked by hand
eq(F.answerOf("7x8"), 56, "7x8");
eq(F.answerOf("56d7"), 8, "56÷7");
eq(F.answerOf("-56d7"), -8, "-56÷7");
eq(F.answerOf("-56d-7"), 8, "-56÷-7");
eq(F.answerOf("-3p9"), 6, "-3+9");
eq(F.answerOf("4m-6"), 10, "4-(-6)");
eq(F.answerOf("-4m6"), -10, "-4-6");
eq(F.answerOf("-12x-11"), 132, "-12x-11");
eq(F.answerOf("7d2"), null, "uneven division is no fact");
eq(F.showFact("4m-6"), "4 − (−6)", "shows parentheses");
eq(F.showFact("-56d7"), "−56 ÷ 7", "shows minus sign");
eq(F.showFact("7x8"), "7 × 8", "shows times");
eq(F.answerLen("-3m9"), 3, "answer length with sign");

// typed answers
ok(F.isRight("4m-6", "10"), "right");
ok(F.isRight("-4m6", "−10"), "unicode minus");
ok(!F.isRight("-4m6", "10"), "sign matters");
ok(!F.isRight("7x8", ""), "blank is wrong");
ok(!F.isRight("7x8", "5 6x"), "junk is wrong");

// decks: right length, no repeats back to back, only facts from the set, same seed same deck
for (const [k] of F.SETS) {
    const d = F.deck(k, 12, 12345, 300), all = new Set(F.factsOf(k, 12));
    eq(d.length, 300, k + " deck length");
    ok(d.every((f) => all.has(f)), k + " deck from its set");
    ok(d.every((f, i) => i === 0 || f !== d[i - 1]), k + " no repeat in a row");
}
eq(F.deck("mul", 12, 7, 20), F.deck("mul", 12, 7, 20), "deck replays from a seed");
const mix = F.deck("mix", 12, 99, 4000), kinds = { x: 0, d: 0, ia: 0 };
mix.forEach((f) => { const p = F.parseFact(f); if (p.op === "p" || p.op === "m") kinds.ia++; else if (p.a > 0 && p.b > 0) kinds[p.op]++; });
ok(kinds.x > 700 && kinds.d > 700 && kinds.ia > 700, "mix comes up evenly: " + JSON.stringify(kinds));

// scoring a run from its log
const lg = ["7x8:56:1500", "6x7:42:2000", "9x9:81:5000", "8x7:54:3000", "12x12:144:1800", "3x4:12:100"];
let sc = F.scoreRun({ s: 60, b: 60, lg });
eq([sc.n, sc.r], [6, 5], "right and tried (100 ms right answer still right)");
eq(sc.miss, ["8x7"], "missed facts");
eq(sc.slow, ["9x9"], "slow facts");
ok(!sc.ok, "an answer in 100 ms flags the run");
sc = F.scoreRun({ s: 60, b: 60, lg: lg.slice(0, 5) });
ok(sc.ok, "a normal run fits the clock");
eq(sc.pm, 4, "4 right in 1 minute");
eq(F.gradeOf(sc, 25, 60), 4 / 25, "grade = right / goal");
ok(F.gradeOf({ r: 80, base: 120 }, 25, 120) === 1, "grade caps at 100%");
eq(F.gradeOf({ r: 50, base: 120 }, 25, 120), 1, "50 right in 2 min at goal 25 = 100%");
// extra time: 1.5x of 2 minutes is 180 s, the goal stays 2 minutes' worth
const ext = F.scoreRun({ s: 180, b: 120, lg: Array(45).fill("7x8:56:3500") });
ok(ext.ok, "extra-time run fits its longer clock");
eq(F.gradeOf(ext, 25, 120), 45 / 50, "extra time does not raise the goal");
ok(!F.scoreRun({ s: 60, b: 60, lg: Array(40).fill("7x8:56:2000") }).ok, "80 s of answers in a 60 s run is flagged");

// counted run
const runs = [{ id: "a", md: "c", b: 60, s: 60, lg: ["7x8:56:2000"], t0: 1 }, { id: "b", md: "c", b: 60, s: 60, lg: ["7x8:56:2000", "6x6:36:2000"], t0: 2 }, { id: "c", md: "p", b: 60, s: 60, lg: Array(20).fill("2x2:4:1000") }];
eq(F.countedRun(runs, "first", 25).id, "a", "first try counts");
eq(F.countedRun(runs, "best", 25).id, "b", "best try counts");
eq(F.checksUsed(runs), 2, "practice runs are not tries");
eq(F.countedRun([runs[2]], "first", 25), null, "practice only: nothing counted");

// profile record: added once per run id
let r1 = F.addRun(null, "mul", { id: "r1", md: "c", s: 120, b: 120, lg: Array(30).fill("7x8:56:3000") }, "2026-11-30");
eq(r1.fl.mul.b, 15, "best per minute");
eq(r1.xp, 30, "xp = right answers");
ok(r1.fl.mul.h.every((h) => !Array.isArray(h)) && !JSON.stringify(r1.fl).includes("[["), "no lists inside lists (Firestore refuses them)");
const again = F.addRun(r1.fl, "mul", { id: "r1", md: "c", s: 120, b: 120, lg: Array(30).fill("7x8:56:3000") }, "2026-11-30");
ok(!again.added && again.xp === 0, "same run is never added twice");
const r2 = F.addRun(r1.fl, "mul", { id: "r2", md: "p", s: 60, b: 60, lg: Array(60).fill("7x8:56:900") }, "2026-12-03");
eq(r2.xp, 40, "xp capped per run");
const tr = F.flTrend(r2.fl.mul);
eq([tr.first.pm, tr.last.pm, tr.best], [15, 15, 60], "trend uses checks, best uses everything");
const r3 = F.addRun(r2.fl, "mul", { id: "r3", md: "c", s: 120, b: 120, lg: Array(44).fill("7x8:56:2700") }, "2026-12-14");
eq(F.flTrend(r3.fl.mul).change, 7, "change from the baseline check");

// tough facts
const t = F.updateTough({}, { miss: ["7x8"], slow: ["6x7"] }, [{ f: "9x9", ok: true, ms: 1000 }]);
eq(t, { "7x8": 3, "6x7": 1 }, "tough facts weighted");
const t2 = F.updateTough(t, { miss: [], slow: [] }, [{ f: "6x7", ok: true, ms: 1200 }]);
eq(t2, { "7x8": 3 }, "a quick right answer works a fact off");
const wt = F.withTough(F.deck("mul", 12, 3, 40), { "7x8": 3 }, "mul", 12, 3);
ok(wt.filter((f) => f === "7x8").length >= 5, "tough facts come back often");
ok(F.withTough(F.deck("div", 12, 3, 40), { "7x8": 3 }, "div", 12, 3).every((f) => f.includes("d")), "tough facts from another set stay out");

eq(F.pointsFor(0, 3000), 100, "points, slow, no combo");
eq(F.pointsFor(10, 0), 350, "points, x3 combo + speed");
console.log(fails ? fails + " of " + n + " FAILED" : "all " + n + " passed");
process.exit(fails ? 1 : 0);
