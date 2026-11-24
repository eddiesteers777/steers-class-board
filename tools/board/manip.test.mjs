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

t("expression area model", () => {
    assert.equal(M.exFactored(3, 2, 3) + " = " + M.exExpanded(3, 2, 3), "3(2x + 3) = 6x + 9");
    assert.equal(M.exFactored(-2, 1, -3) + " = " + M.exExpanded(-2, 1, -3), "−2(x − 3) = −2x + 6");
    assert.equal(M.exLin(-1, 0), "−x"); assert.equal(M.exLin(4, -7), "4x − 7");
    assert.deepEqual(M.exParts({ a: -3, b: 1, c: -3 }), [-3, 9]);
    const E = M.exDefault();
    E.r = 2; let R = M.exRows(E); assert.equal(R.even, false); assert.equal(R.lq, 1); assert.equal(R.lx, 0);
    E.r = 3; R = M.exRows(E); assert.equal(R.even, true); assert.equal(R.best, true); assert.equal(R.inside, "2x + 3");
    Object.assign(E, { p: 12, q: 18, r: 2 }); R = M.exRows(E); assert.equal(R.even, true); assert.equal(R.best, false); assert.equal(R.gcf, 6);
    Object.assign(E, { p: 4, q: -6, r: 2 }); assert.equal(M.exRows(E).inside, "2x − 3");
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 100; i++) { M.exNewFactor(E, rnd); assert.ok(M.gcd(E.p, E.q) >= 2 && E.p >= 1 && E.p <= M.EX_P && Math.abs(E.q) <= M.EX_Q && E.r === 1, E.p + "," + E.q); }
    const c = M.cleanMt({ area: { m: "fac", a: 0, b: 99, c: "x", look: "zz", rv: [1], p: 0, q: -50, r: 9 } }).area;
    assert.deepEqual([c.m, c.a, c.b, c.c, c.look, c.rv, c.p, c.q, c.r], ["fac", 3, M.EX_B, 3, "tiles", [true, false], 6, -M.EX_Q, M.EX_R]);
    assert.equal(M.mtChip("area", { mt: { area: M.exDefault() } }).v, "3(2x + 3) = 6x + 9");
});

t("rational number line", () => {
    const N = M.nlDefault();
    assert.equal(M.nlSum(N), "−1 1/2 + 2 3/4 = 1 1/4");
    N.op = "−"; assert.equal(M.nlSum(N), "−1 1/2 − 2 3/4 = −4 1/4"); assert.equal(M.nlMove(N), -11);
    N.q = -6; assert.equal(M.nlSum(N), "−1 1/2 − (−1 1/2) = 0");
    N.op = "+"; N.q = 6; assert.equal(M.nlEnd(N), 0);
    N.f = "dec"; assert.equal(M.nlSum(N), "−1.5 + 1.5 = 0");
    assert.equal(M.nlText(-5, 3, "frac"), "−1 2/3"); assert.equal(M.nlText(1, 3, "dec"), "0.3\u0305"); assert.equal(M.nlText(10, 4, "frac"), "2 1/2"); assert.equal(M.nlText(3, 10, "dec"), "0.3");
    assert.deepEqual(M.nlDec(-7, 3), { s: "−2.", rep: "3" });
    assert.deepEqual(M.nlParts(6, 8), { neg: false, w: 0, num: 3, den: 4, zero: false });
    // limits: nothing leaves −10..10
    const L = Object.assign(M.nlDefault(), { p: 30, q: 10 });
    assert.equal(M.nlStep(L, "q", 1), false); assert.equal(M.nlStep(L, "p", -1), true); assert.equal(L.p, 29);
    assert.equal(M.nlSet(L, "q", 12), false); assert.equal(M.nlSet(L, "q", -40), true); assert.equal(M.nlStep(L, "p", 12), false);
    // changing the step size keeps the values close
    const D = M.nlDefault(); M.nlDen(D, 2); assert.deepEqual([D.d, D.p, D.q], [2, -3, 6]); M.nlDen(D, 10); assert.deepEqual([D.p, D.q], [-15, 30]);
    D.m = "dist"; D.a = -25; D.b = 13;
    assert.equal(M.nlSum(Object.assign({}, D, { f: "dec" })), "|1.3 − (−2.5)| = 3.8");
    assert.equal(M.nlSum(D, true), "|1 3/10 − (−2 1/2)| = ?");
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const R = M.nlDefault();
    for (let i = 0; i < 100; i++) { M.nlNew(R, rnd); const e = M.nlEnd(R); assert.ok(R.q !== 0 && Math.abs(e) <= M.NL_MAX * R.d && Math.abs(R.p) <= 4 * R.d, M.nlSum(R)); }
    R.m = "dist"; for (let i = 0; i < 50; i++) { M.nlNew(R, rnd); assert.ok(R.a !== R.b, M.nlSum(R)); }
    const c = M.cleanMt({ nl: { m: "zz", d: 7, f: "dec", op: "x", p: 999, q: "a", a: -999, b: 3.4, hide: 1 } }).nl;
    assert.deepEqual([c.m, c.d, c.f, c.op, c.p, c.q, c.a, c.b, c.hide], ["add", 4, "dec", "+", 40, 0, -40, 3, true]);
    assert.equal(M.mtChip("nl", { mt: { nl: M.nlDefault() } }).v, "−1 1/2 + 2 3/4 = 1 1/4");
    assert.equal(M.mtChip("nl", { mt: { nl: Object.assign(M.nlDefault(), { hide: true }) } }).v, "−1 1/2 + 2 3/4 = ?");
});

t("function machine", () => {
    const F = M.fnDefault();
    assert.equal(M.fnRule(F), "2x + 1");
    assert.equal(M.fnRule({ a: -1, b: -4, q: true }), "−x² − 4");
    assert.equal(M.fnRule({ a: 0, b: -3, q: false }), "−3");
    assert.equal(M.fnRule({ a: 1, b: 0, q: false }), "x");
    F.ins = [1, 2, -3]; assert.deepEqual(M.fnPairs(F), [[1, 3], [2, 5], [-3, -5]]);
    assert.equal(M.fnOut({ a: 2, b: 1, q: true }, -2), 9);
    assert.deepEqual(M.fnTest([[1, 2], [2, 2]]), { ok: true, shared: true });
    assert.deepEqual(M.fnTest([[3, 8], [1, 2], [3, 5]]), { ok: false, x: 3, ys: [5, 8] });
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    let yes = 0, no = 0;
    for (let i = 0; i < 200; i++) { M.fnNewSet(F, rnd); assert.ok(F.ps.length >= 4 && F.ps.length <= 6); M.fnTest(F.ps).ok ? yes++ : no++; }
    assert.ok(yes > 50 && no > 50, yes + " / " + no);
    const G = M.fnDefault(); M.fnMystery(G, rnd); assert.equal(G.hide, true); assert.deepEqual(G.ins, []); assert.ok(G.a !== 0);
    const c = M.cleanMt({ fn: { m: "test", a: 99, b: -99, ins: [1, "x", 50, 2, 3, 4, 5, 6, 7, 8, 9], v: "nope", ps: [[1, 2], [3], "x"], g: "f", sh: 1 } }).fn;
    assert.equal(c.a, M.FN_A); assert.equal(c.b, -M.FN_B); assert.deepEqual(c.ins, [2, 3, 4, 5, 6, 7, 8, 9]); assert.equal(c.v, "table"); assert.deepEqual(c.ps, [[1, 2]]); assert.equal(c.sh, true);
    assert.equal(M.mtChip("fn", { mt: { fn: M.fnDefault() } }).v, "y = 2x + 1");
});

t("angle explorer", () => {
    const A = M.angDefault();
    assert.deepEqual(M.angVals(A).slice(1), [120, 60, 60, 120, 120, 60, 60, 120]);
    for (const k of M.ANG_KINDS) M.ANG_PAIRS[k].pairs.forEach(([i, j]) => assert.equal(M.angPair(A, i, j).ok, true, k + " " + i + "," + j));
    assert.equal(M.angPair(A, 3, 6).name, "Alternate interior"); assert.equal(M.angPair(A, 4, 6).name, "Same-side interior");
    const N = Object.assign(M.angDefault(), { np: true });
    assert.equal(M.angPair(N, 2, 6).ok, false); assert.equal(M.angPair(N, 2, 3).ok, true, "vertical angles match even when the lines are not parallel");
    const d = M.triAngles([[0, 0], [100, 0], [0, 100]]).deg; assert.deepEqual(d, [90, 45, 45]);
    for (let n = 0; n < 50; n++) { const t = [[20 + n, 190], [330 - n, 180], [100 + 3 * n, 30 + n]]; assert.equal(M.triAngles(t).deg.reduce((a, b) => a + b, 0), 180); }
    assert.equal(M.triOk([[20, 100], [300, 100], [160, 100]]), false, "a flat triangle is not allowed");
    const c = M.cleanMt({ angle: { m: "tri", a: 500, pk: "evil", sel: [9, 3, 3, 4, 5], rv: ["x"], t: [[0, 0], [1, 1], [2, 2]], torn: 1 } }).angle;
    assert.deepEqual([c.m, c.a, c.pk, c.sel, c.rv, c.torn], ["tri", 150, "", [3, 4], [], true]);
    assert.deepEqual(c.t, M.angDefault().t);
});

t("inequality balance", () => {
    const r = M.parseRel("3x + 7 < 22"); assert.deepEqual([r.e, r.r], [[3, 7, 0, 22], "<"]);
    assert.equal(M.parseRel("2x - 1 >= x + 4").r, "≥"); assert.equal(M.parseRel("x+1 <= 5").r, "≤"); assert.equal(M.parseRel("2x = 8").r, "=");
    assert.ok(M.parseRel("3x < 5 < 9").err); assert.ok(M.parseRel("x + 1 < x + 4").err);
    const B = M.balDefault(); M.balSet(B, r.e, r.r); assert.ok(M.isIneq(B)); assert.equal(M.eqText(B.s, B.r), "3x + 7 < 22");
    M.balTry(B, 2); assert.deepEqual(M.balTryWeights(B), { L: 13, R: 22, x: 2 }); assert.ok(M.balTrue(B)); assert.ok(M.balTilt(B) > 0, "13 < 22: the right pan is heavier");
    M.balTry(B, 7); assert.ok(!M.balTrue(B)); assert.ok(M.balTilt(B) < 0); M.balTry(B, 99); assert.equal(B.t, M.BAL_TRY); assert.deepEqual(B.tr, [2, 7, 10]);
    assert.deepEqual(M.ineqSol(B), { b: 5, r: "<" });
    assert.equal(M.balBoth(B, "-", 7, "u"), ""); assert.equal(M.balBoth(B, "/", 3, ""), ""); assert.deepEqual(M.balSolved(B), { side: "L", v: 5, r: "<" });
    const N = M.balDefault(); M.balSet(N, [-2, 3, 0, 11], "<");   // −2x + 3 < 11
    assert.deepEqual(M.ineqSol(N), { b: -4, r: ">" });
    M.balBoth(N, "-", 3, "u"); assert.equal(M.balBoth(N, "/-", 2, ""), ""); assert.equal(N.r, ">", "dividing by a negative flips the sign");
    assert.equal(M.eqText(N.s, N.r), "x > −4"); assert.deepEqual(M.balSolved(N), { side: "L", v: -4, r: ">" });
    M.balUndo(N); assert.equal(N.r, "<"); assert.equal(M.eqText(N.s, N.r), "−2x < 8");
    const R = M.balDefault(); M.balSet(R, [0, 4, 1, 1], "≤"); assert.deepEqual(M.balSolved({ ...R, s: [0, 3, 1, 0] }), { side: "R", v: 3, r: "≥" }, "3 ≤ x reads as x ≥ 3");
    const c = M.cleanMt({ balance: { e: [3, 7, 0, 22], s: [3, 7, 0, 22], r: "<", er: "<", t: "9", tr: [1, "x", 50, 2], sh: 1, h: [{ s: [3, 7, 0, 22], l: "x", r: "!!" }] } }).balance;
    assert.deepEqual([c.r, c.er, c.t, c.tr, c.sh, c.h[0].r], ["<", "<", 9, [1, 2], true, "="]);
    assert.equal(M.mtChip("balance", { mt: { balance: Object.assign(M.balDefault(), { er: "<", r: "<", s: [1, 0, 0, 5] }) } }).v, "x < 5");
});

t("systems graph", () => {
    const S = M.sysDefault();
    assert.deepEqual(M.sysSolve(S), { kind: "one", x: [2, 1], y: [5, 1] }); assert.equal(M.sysAns(S), "(2, 5)");
    assert.equal(M.sysEq(...S.l[0], "si"), "y = 2x + 1"); assert.equal(M.sysEq(...S.l[1], "si"), "y = −x + 7");
    assert.equal(M.sysEq(...S.l[0], "std"), "2x − y = −1"); assert.equal(M.sysEq(...S.l[1], "std"), "x + y = 7");
    assert.deepEqual(M.sysCheck(S, 0, [1, 3]), { on: true, text: "2(1) + 1 = 3" });
    assert.deepEqual(M.sysCheck(S, 1, [1, 3]), { on: false, text: "−(1) + 7 = 6, not 3" });
    assert.equal(M.sysCheck(Object.assign(M.sysDefault(), { f: "std" }), 1, [2, 5]).on, true);
    assert.deepEqual(M.parseLine("y = 2x + 1"), { a: 2, b: -1, c: -1 }); assert.deepEqual(M.parseLine("2x + 3y = 12"), { a: 2, b: 3, c: 12 });
    assert.deepEqual(M.parseLine("y = -1/2x + 3"), { a: 1, b: 2, c: 6 }); assert.deepEqual(M.parseLine("y = x/2 − 3"), { a: 1, b: -2, c: 6 });
    assert.deepEqual(M.parseLine("x = 4"), { a: 1, b: 0, c: 4 }); assert.deepEqual(M.parseLine("3x - y + 2 = 0"), { a: 3, b: -1, c: -2 });
    assert.ok(M.parseLine("y = 2x = 3").err); assert.ok(M.parseLine("y = 2z").err); assert.ok(M.parseLine("x - x = 4").err); assert.ok(M.parseLine("2x + 2y = 3").err, "misses every grid point");
    assert.equal(M.sysSet(S, M.parseLine("y = 2x + 1"), M.parseLine("y = 2x - 3")), ""); assert.equal(M.sysSolve(S).kind, "none");
    M.sysSet(S, M.parseLine("y = 2x + 1"), M.parseLine("4x - 2y = -2")); assert.equal(M.sysSolve(S).kind, "many");
    M.sysSet(S, M.parseLine("x = 3"), M.parseLine("y = -2")); assert.equal(M.sysAns(S), "(3, −2)");
    M.sysSet(S, M.parseLine("y = 1/2x"), M.parseLine("y = -x + 1")); assert.equal(M.sysAns(S), "(2/3, 1/3)");
    const T = M.sysDefault(); assert.equal(M.sysMove(T, 0, 1, 0, 1), false, "a line's two points can't meet"); assert.equal(M.sysMove(T, 0, 1, 11, 0), false);
    assert.equal(M.sysMove(T, 0, 1, 1, 4), true); assert.equal(M.sysEq(...T.l[0], "si"), "y = 3x + 1");
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let n = 0; n < 60; n++) for (const kind of ["one", "none", "many"]) {
        assert.ok(M.sysNew(T, kind, rnd), kind); const r = M.sysSolve(T); assert.equal(r.kind, kind);
        T.l.flat().forEach((q) => assert.ok(Math.abs(q[0]) <= M.SYS_R && Math.abs(q[1]) <= M.SYS_R));
        if (kind === "one") { assert.equal(r.x[1], 1); assert.equal(r.y[1], 1); assert.ok(!T.l.flat().some((q) => q[0] === r.x[0] && q[1] === r.y[0]), "no point sits on the answer"); }
    }
    const c = M.cleanMt({ sys: { l: [[[0, 0], [0, 0]], [[1, 2], [3, 99]]], f: "x", hide: 1, tp: [2, "y"] } }).sys;
    assert.deepEqual(c, Object.assign(M.sysDefault(), { hide: true }));
    assert.equal(M.mtChip("sys", { mt: { sys: M.sysDefault() } }).v, "(2, 5)");
    assert.equal(M.mtChip("sys", { mt: { sys: Object.assign(M.sysDefault(), { hide: true }) } }).v, "Where do they cross?");
});

t("scatter plot", () => {
    const S = M.scDefault();
    assert.equal(S.d, "study"); assert.equal(S.p.length, 17);
    assert.equal(M.scAssoc(S.p).text, "Moderate positive association");
    assert.deepEqual(M.scOutliers(S).map((i) => S.p[i]), [[1.5, 88]], "the student who barely studied and scored 88");
    M.scDel(S, M.scOutliers(S)[0]); assert.equal(M.scAssoc(S.p).text, "Strong positive association", "without it, the trend is strong");
    assert.deepEqual(M.scOutliers(S), []);
    assert.equal(M.scAssoc(M.scDefault("cocoa").p).dir, "negative"); assert.equal(M.scAssoc(M.scDefault("month").p).dir, "none");
    assert.equal(M.scAssoc([[1, 1], [2, 2]]).text, "Add more points to see a trend");
    assert.equal(M.scEq(4.38, 52.1), "y = 4.4x + 52"); assert.equal(M.scEq(-0.857, 73.4), "y = −0.86x + 73"); assert.equal(M.scEq(1, -3.25), "y = x − 3.3"); assert.equal(M.scEq(0, 62), "y = 62");
    S.ln = [[0, 52], [10, 96]];
    assert.equal(M.scEq(M.scLine(S).m, M.scLine(S).b), "y = 4.4x + 52");
    assert.equal(M.scRead(S).slope, "Slope 4.4: each extra hour studied goes with about 4.4 more points.");
    assert.match(M.scRead(S).icpt, /^y-intercept 52: about 52 points at 0 hours. That's outside the data/);
    assert.equal(M.scSay(M.SC_SETS.study, "x", 6) + " / " + M.scSay(M.SC_SETS.study, "y", M.scPredict(S, 6)), "6 hours / about 78 points");
    assert.equal(M.scSay(M.SC_SETS.study, "x", 1), "1 hour"); assert.equal(M.scSay(M.SC_SETS.cocoa, "x", 65), "65°F"); assert.equal(M.scSay(M.SC_SETS.own, "y", 12.4), "y ≈ 12");
    const sd = M.scSides(S); assert.equal(sd.above + sd.below + sd.on, S.p.length);
    assert.equal(M.scAdd(S, 3.3, 71.6), true); assert.deepEqual(S.p[S.p.length - 1], [3.5, 72], "snapped to the axes");
    assert.equal(M.scAdd(S, 3.4, 72.2), false, "already a point there");
    assert.equal(M.scMove(S, 0, 99, -5), true); assert.deepEqual(S.p[0], [10, 40], "kept on the graph");
    assert.equal(M.scHandle(S, 0, 9.8, 60), false, "the ends stay apart"); assert.equal(M.scHandle(S, 1, 9, 90), true);
    const O = M.scDefault("own"); assert.deepEqual(O.p, []); for (let i = 0; i < 50; i++) M.scAdd(O, i % 20, Math.floor(i / 20) * 3); assert.equal(O.p.length, M.SC_MAX);
    const c = M.cleanMt({ scat: { d: "cocoa", p: [[30, 20], [30, 20], [500, 3], ["x", 1], [44.4, 19.6]], ln: [[80, 1], [20, 50]], best: 1, px: 999 } }).scat;
    assert.deepEqual(c.p, [[30, 20], [44, 20]]); assert.equal(c.ln[0][0] < c.ln[1][0], true); assert.equal(c.best, true); assert.equal(c.px, null);
    assert.equal(M.cleanMt({ scat: { d: "evil" } }).scat.d, "study");
    assert.equal(M.mtChip("scat", { mt: { scat: M.scDefault("cocoa") } }).v, "Strong negative");
    assert.equal(M.mtChip("scat", { mt: { scat: Object.assign(M.scDefault(), { hide: true }) } }).v, "What's the trend?");
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
