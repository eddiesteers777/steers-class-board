// The three checks: node tools/acap/checks.test.mjs (no browser, no network).
import * as K from "../../js/checks.js";
import { STANDARDS } from "../../data/standards.js";
import assert from "node:assert/strict";
const order = []; STANDARDS["8th"].units.forEach((u) => u.standards.forEach((x) => { if (!order.includes(x.code)) order.push(x.code); }));
const marks = { "8.1": "taught", "8.2": "taught", "8.4": "taught", "8.3": "taught", "8.5": "taught", "8.6": "teaching", "8.26": "taught" };
const need = new Map([["8.2", 3], ["8.5", 2], ["8.1", 0.5]]);
const ctx = { cls: "8th", order, marks, need, scored: new Set() };

const diag = K.planCheck("diag", ctx);
assert.equal(diag.length, 5);
assert.deepEqual(diag.filter((s) => s.role === "prior").map((s) => s.code), ["8.2", "8.5"], "the class's weakest earlier standards");
assert.deepEqual(diag.filter((s) => s.role === "new").map((s) => s.code), ["8.6", "8.6", "8.6"]);
const week = K.planCheck("week", Object.assign({}, ctx, { focus: ["8.6", "8.5"] }));
assert.deepEqual(week.map((s) => s.code), ["8.6", "8.5", "8.6", "8.5", "8.6"]);
assert.deepEqual(week[0].lv, [2, 3]);

// Cumulative: 20 questions, blueprint-weighted: NAF (29) vs GM (11) -> 20*29/40 = 14.5, 20*11/40 = 5.5 -> 15 + 5 or 14 + 6.
const cum = K.planCheck("cum", ctx);
assert.equal(cum.length, 20);
const c = K.catCounts("8th", cum); assert.equal(c.get("Numbers, Algebra, and Functions") + c.get("Geometry and Measurement"), 20);
assert.ok(c.get("Geometry and Measurement") >= 5 && c.get("Geometry and Measurement") <= 6);
assert.equal(cum.filter((s) => s.code === "8.26").length, c.get("Geometry and Measurement"));
// 7th: all five categories covered -> 6/10/6/15/9 of 46 -> largest remainder gives 3/4/3/6/4 (sums to 20, each at least 1)
const o7 = STANDARDS["7th"].standards.map((s) => s.code), m7 = Object.fromEntries(o7.map((c) => [c, "taught"]));
const cum7 = K.planCheck("cum", { cls: "7th", order: o7, marks: m7, need: new Map() });
const c7 = K.catCounts("7th", cum7); assert.equal(cum7.length, 20);
assert.equal(c7.get("Data Analysis, Statistics, and Probability"), 6); assert.equal(c7.get("Number Systems and Operations"), 4);
// Nothing marked yet: the diagnostic goes to the first standard.
assert.equal(K.planCheck("diag", { cls: "8th", order, marks: {}, need: new Map() }).filter((s) => s.role === "new")[0].code, order[0]);

// Building the quiz: two questions on one standard never share a problem.
const bank = []; for (let i = 0; i < 12; i++) bank.push({ std: "8.6", cls: "8th", lvl: 2 + (i % 2), q: "q" + i, a: String(i) });
for (let i = 0; i < 6; i++) bank.push({ std: "8.2", cls: "8th", lvl: 1, q: "p" + i, a: String(i) }, { std: "8.5", cls: "8th", lvl: 2, q: "r" + i, a: String(i) });
const quiz = K.buildQuiz("diag", diag, bank, "8th", ["1st", "2nd"], K.titleFor("diag", diag, new Date("2026-11-30T12:00:00")));
assert.equal(quiz.type, "quiz"); assert.equal(quiz.skills.length, 5); assert.equal(quiz.chk, "diag");
const qs = quiz.skills.filter((s) => s.std === "8.6").map((s) => s.pool.map((x) => x.q));
assert.equal(qs.length, 3); assert.equal(new Set(qs.flat()).size, qs.flat().length, "no shared problems");
assert.equal(quiz.title, "Monday diagnostic · 8.6 · Nov 30");
assert.equal(K.buildQuiz("diag", [{ code: "8.30", role: "new", lv: [1] }], bank, "8th", ["1st"], "t"), null);
console.log("checks: all checks passed");
