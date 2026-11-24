// The math manipulative panels' model (js/manipCore.js): equation balance, chance lab, line explorer,
// transformations, Pythagorean squares, integer counters, and cleaning their saved state.
// Run: node tools/board/manip.test.mjs
import assert from "node:assert/strict";
import * as M from "../../js/manipCore.js";

let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FAIL", name); throw e; } };

t("equations parse", () => {
    assert.deepEqual(M.parseEq("3x + 7 = 22"), [3, 7, 0, 22]);
    assert.deepEqual(M.parseEq("2x - 3 = x + 5"), [2, -3, 1, 5]);
    assert.deepEqual(M.parseEq("−x+4=10"), [-1, 4, 0, 10]);
    assert.deepEqual(M.parseEq("5 = 2x − 1"), [0, 5, 2, -1]);
    assert.deepEqual(M.parseEq("x + x + 2 = 8"), [2, 2, 0, 8]);
    ["", "3x + 7", "3x = 2 = 1", "3y = 9", "1.5x = 3", "x = x"].forEach((s) => assert.ok(M.parseEq(s).err, s));
    assert.match(M.parseEq("2x + 1 = 2x + 3").err, /No x/);
    assert.match(M.parseEq("13x = 26").err, /Keep it/);
});
t("the balance solves 3x + 7 = 22 step by step", () => {
    const B = M.balDefault(); assert.equal(M.solveOf(B.e), 5); assert.ok(M.balanced(B)); assert.equal(M.eqText(B.s), "3x + 7 = 22");
    assert.equal(M.balAdd(B, "L", "u", -1), ""); assert.ok(!M.balanced(B)); assert.ok(M.balTilt(B) > 0, "the right pan drops when the left loses a tile");
    M.balUndo(B); assert.ok(M.balanced(B));
    assert.equal(M.balBoth(B, "-", 7, "u"), ""); assert.equal(M.eqText(B.s), "3x = 15"); assert.ok(M.balanced(B)); assert.equal(M.balSolved(B), null);
    assert.match(M.balBoth(B, "/", 2), /equal groups/);
    assert.equal(M.balBoth(B, "/", 3), ""); assert.deepEqual(M.balSolved(B), { side: "L", v: 5 }); assert.equal(B.h.length, 2); assert.equal(B.h[1].l, "÷ 3");
    assert.equal(M.balBoth(B, "+", 1, "x"), ""); assert.equal(M.eqText(B.s), "2x = x + 5");
});
t("x on both sides, negatives", () => {
    const B = M.balDefault(); M.balSet(B, M.parseEq("2x - 3 = x + 5")); assert.equal(M.solveOf(B.e), 8);
    M.balBoth(B, "-", 1, "x"); M.balBoth(B, "+", 3, "u"); assert.equal(M.eqText(B.s), "x = 8"); assert.deepEqual(M.balSolved(B), { side: "L", v: 8 });
    assert.equal(M.sideText(-1, -2), "−x − 2"); assert.equal(M.sideText(0, 0), "0"); assert.equal(M.sideText(0, -4), "−4");
});
t("the pans have a limit", () => { const B = M.balDefault(); assert.match(M.balBoth(B, "+", 30, "u"), /Too many/); assert.equal(M.eqText(B.s), "3x + 7 = 22"); });

t("chance outcomes add to 1", () => {
    const C = M.chanceDefault(); const sum = (c) => M.outcomes(c).reduce((a, o) => a + o[1], 0);
    assert.ok(Math.abs(sum(C) - 1) < 1e-12); M.chanceWeight(C, 0, 2); assert.deepEqual(M.fracOf(C, 0), [1, 2]); assert.deepEqual(M.fracOf(C, 1), [1, 6]);
    M.chanceMode(C, "dice", true); assert.equal(M.outcomes(C).length, 11); assert.ok(Math.abs(sum(C) - 1) < 1e-12); assert.deepEqual(M.fracOf(C, 5), [1, 6]); assert.deepEqual(M.fracOf(C, 0), [1, 36]);
    M.chanceMode(C, "coin"); assert.deepEqual(C.t, [0, 0]);
});
t("chance runs tally and land the spinner in its slice", () => {
    let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const C = M.chanceDefault(); M.chanceRun(C, 1000, rng); assert.equal(M.trials(C), 1000); assert.ok(C.t.every((x) => x > 180 && x < 320), C.t.join());
    for (let i = 0; i < 50; i++) {
        M.chanceRun(C, 1, rng); const deg = ((360 - (C.rot % 360)) % 360), tot = C.w.reduce((a, x) => a + x, 0);
        const start = C.w.slice(0, C.last).reduce((a, x) => a + x, 0) / tot * 360; assert.ok(deg >= start && deg <= start + C.w[C.last] / tot * 360, "pointer in slice");
    }
    const D = M.chanceDefault(); M.chanceMode(D, "dice", true); M.chanceRun(D, 1, rng); assert.equal(D.dv.length, 2); assert.equal(D.last, D.dv[0] + D.dv[1] - 2);
});

t("line: slope, intercept, equation", () => {
    const L = M.lineDefault(); assert.equal(M.lineEq(L), "y = 2/3x + 1");
    M.linePoint(L, "a", 0, 0); M.linePoint(L, "b", 2, 4); assert.equal(M.lineEq(L), "y = 2x"); assert.ok(M.lineOf(L).prop);
    M.linePoint(L, "b", -3, 3); assert.equal(M.lineEq(L), "y = −x");
    M.linePoint(L, "a", 1, 2); M.linePoint(L, "b", 3, 1); assert.equal(M.lineEq(L), "y = −1/2x + 5/2");
    M.linePoint(L, "b", 1, 5); assert.equal(M.lineEq(L), "x = 1");
    M.linePoint(L, "b", 4, 2); assert.equal(M.lineEq(L), "y = 2");
    assert.equal(M.linePoint(L, "b", 1, 2), false, "the two points stay apart");
});

t("transformations", () => {
    const X = M.xfDefault(); assert.deepEqual(M.xfImage(X), [[1, 1], [4, 1], [1, 3]]); assert.equal(M.xfRule(X), "(x, y) → (x, y)");
    M.xfDo(X, "rx"); assert.deepEqual(M.xfImage(X), [[1, -1], [4, -1], [1, -3]]); assert.equal(M.xfRule(X), "(x, y) → (x, −y)");
    M.xfDo(X, "t1,0"); M.xfDo(X, "t1,0"); M.xfDo(X, "t0,2"); assert.equal(X.ops.length, 2); assert.equal(X.ops[1], "t2,2"); assert.equal(M.xfRule(X), "(x, y) → (x + 2, −y + 2)");
    const Y = M.xfDefault(); M.xfDo(Y, "r90"); assert.deepEqual(M.xfImage(Y), [[-1, 1], [-1, 4], [-3, 1]]); assert.equal(M.xfRule(Y), "(x, y) → (−y, x)");
    M.xfDo(Y, "r270"); assert.deepEqual(M.xfImage(Y), [[1, 1], [4, 1], [1, 3]]);
    const Z = M.xfDefault(); M.xfDo(Z, "dh"); assert.deepEqual(M.xfImage(Z)[1], [2, 0.5]); assert.equal(M.xfRule(Z), "(x, y) → (½x, ½y)"); assert.equal(M.ptText([2, -0.5]), "(2, −0.5)");
    M.xfDo(Z, "d2"); M.xfDo(Z, "d2"); assert.ok(!M.xfOff(Z)); M.xfDo(Z, "d2"); assert.ok(M.xfOff(Z));
    assert.equal(M.moveOf("t-3,2").n, "Translate (−3, 2)");
});

t("Pythagorean squares", () => {
    assert.deepEqual([M.pyOf({ a: 3, b: 4 }).cText, M.pyOf({ a: 3, b: 4 }).whole], ["5", true]);
    const p = M.pyOf({ a: 5, b: 5 }); assert.equal(p.cText, "√50"); assert.equal(p.simple, "5√2"); assert.equal(M.pyOf({ a: 2, b: 3 }).simple, "");
});

t("integer counters", () => {
    const K = M.ctDefault(); assert.equal(M.ctValue(K), -2);
    assert.equal(M.ctTake(K, "p"), ""); assert.equal(M.ctTake(K, "p"), ""); assert.equal(M.ctTake(K, "p"), ""); assert.match(M.ctTake(K, "p"), /zero pair/);
    M.ctPair(K); assert.equal(M.ctValue(K), -5); assert.equal(M.ctTake(K, "p"), ""); assert.equal(M.ctValue(K), -6);
    const J = { p: 4, n: 6, pr: false }; assert.equal(M.ctClear(J), 4); assert.deepEqual([J.p, J.n], [0, 2]);
    assert.match(M.ctAdd({ p: 20, n: 0 }, "p"), /holds/);
});

t("saved state is cleaned", () => {
    assert.deepEqual(M.cleanMt(null), {}); assert.deepEqual(M.cleanMt({ evil: { a: 1 } }), {});
    const c = M.cleanMt({ balance: { e: [2, 2, 2, 9], s: [1, 2, 3, 4] }, chance: { m: "dice", d2: true, t: [1, "x", -4], last: 99, rot: "NaN" }, line: { a: [99, -99], b: [99, -99] },
        xform: { sh: 9, ops: ["rx", "t1,1", "javascript:", "t999,1", "r90"] }, pyth: { a: 0, b: 40 }, counters: { p: -1, n: 500 } });
    assert.deepEqual(c.balance, M.balDefault(), "a = c is not a balance equation");
    assert.equal(c.chance.t.length, 11); assert.deepEqual(c.chance.t.slice(0, 3), [1, 0, 0]); assert.equal(c.chance.last, 10); assert.equal(c.chance.rot, 0);
    assert.deepEqual(c.line, M.lineDefault(), "two points in one place go back to the start");
    assert.deepEqual(c.xform, { sh: 2, ops: ["rx", "t1,1", "r90"] });
    assert.deepEqual([c.pyth.a, c.pyth.b], [1, 8]); assert.deepEqual([c.counters.p, c.counters.n], [0, 20]);
    const T = {}; assert.deepEqual(M.mtOf(T, "pyth"), M.pyDefault()); assert.ok(T.mt.pyth);
    M.MT_KEYS.forEach((k) => assert.ok(typeof M.mtChip(k, {}).v === "string", k));
});

console.log("manip: " + n + " checks passed");
