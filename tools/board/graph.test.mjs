// node tools/board/graph.test.mjs — the graphing calculator's reader and maths (js/graphCalc.js)
import assert from "node:assert/strict";
import * as G from "../../js/graphCalc.js";

let n = 0;
const t = (name, f) => { try { f(); n++; } catch (e) { console.error("FAIL " + name); throw e; } };
const list = (...texts) => G.buildList(texts.map((x, i) => ({ id: "r" + i, t: x })));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, a + " ≈ " + b);

t("lines and implicit multiplication", () => {
    const r = list("y = 2x + 1", "y=-3x", "2(x+1)", "y = x(x - 2)").rows;
    assert.equal(r[0].kind, "fn"); near(r[0].f(3), 7);
    near(r[1].f(2), -6);
    assert.equal(r[2].kind, "fn"); near(r[2].f(1), 4);
    near(r[3].f(5), 15);
});
t("powers, roots, abs, trig", () => {
    const r = list("y = x^2 - 3", "y = -x^2", "y = 2^-1 x", "y = |x - 2|", "y = sqrt(x)", "y = √x + sin x", "y = x²", "y = (x+1)(x-1)", "y = 3sin(2x)", "y = cbrt(x)", "y = x^(1/3)").rows;
    near(r[0].f(2), 1); near(r[1].f(3), -9); near(r[2].f(4), 2); near(r[3].f(-1), 3);
    near(r[4].f(9), 3); near(r[5].f(0), 0); near(r[6].f(-3), 9); near(r[7].f(3), 8);
    near(r[8].f(Math.PI / 4), 3); near(r[9].f(-8), -2); near(r[10].f(-8), -2);
});
t("sliders and defined values", () => {
    const r = list("y = mx + b", "m = 2", "b = -1", "k = 2m + b", "k").rows;
    assert.equal(r[1].kind, "slider"); assert.equal(r[1].value, 2);
    assert.equal(r[2].value, -1);
    near(r[0].f(3), 5);
    assert.equal(r[3].kind, "def"); near(r[3].value, 3);
    assert.equal(r[4].kind, "val"); near(r[4].value, 3);
    const m = list("y = ax^2 + c").rows[0];
    assert.equal(m.kind, "miss"); assert.deepEqual(m.vars, ["a", "c"]);
});
t("functions", () => {
    const r = list("f(x) = x^2 + 1", "f(3)", "y = f(x - 2)", "g(t) = 2t", "g(f(2))").rows;
    assert.equal(r[0].kind, "fdef"); near(r[0].f(2), 5);
    assert.equal(r[1].kind, "val"); near(r[1].value, 10);
    near(r[2].f(2), 1);
    near(r[4].value, 10);
    assert.equal(list("y = h(x)").rows[0].kind, "miss");   // h(x) with no h is h·x, like any letter
});
t("vertical lines, sideways, inequalities, circles", () => {
    const r = list("x = 3", "x = y^2", "y > 2x - 1", "y ≤ |x|", "x^2 + y^2 = 25", "y >= x", "2x + 1 = y").rows;
    assert.equal(r[0].kind, "xfn"); near(r[0].f(7), 3);
    near(r[1].f(-2), 4);
    assert.equal(r[2].kind, "ineq"); assert.equal(r[2].op, ">"); near(r[2].f(1), 1);
    assert.equal(r[3].op, "≤");
    assert.equal(r[4].kind, "imp"); near(r[4].f(3, 4), 0);
    assert.equal(r[5].op, "≥");
    assert.equal(r[6].kind, "fn"); near(r[6].f(1), 3);
});
t("points and lists of points", () => {
    const r = list("(2, 3)", "(1, 2), (3, 4)", "(a, a^2)", "a = 3").rows;
    assert.deepEqual(r[0].points, [[2, 3]]);
    assert.deepEqual(r[1].points, [[1, 2], [3, 4]]);
    assert.deepEqual(r[2].points, [[3, 9]]);
});
t("limits on a graph", () => {
    const r = list("y = x {-2 < x < 3}", "y = 2 {x > 0}").rows;
    assert.equal(r[0].restrictF(0, 0), true); assert.equal(r[0].restrictF(4, 4), false); assert.equal(r[0].restrictF(-2, -2), false);
    assert.equal(r[1].restrictF(1, 2), true); assert.equal(r[1].restrictF(-1, 2), false);
});
t("plain answers", () => {
    const r = list("3 + 4*2", "2^10", "pi", "5!", "max(2, 9)", "1/0").rows;
    near(r[0].value, 11); near(r[1].value, 1024); near(r[2].value, Math.PI); near(r[3].value, 120); near(r[4].value, 9);
    assert.equal(G.fmt(r[5].value), "∞");
});
t("errors read as plain words", () => {
    for (const s of ["y = (x + 1", "y = x +", "y = 2x $", "a = a + 1", "y = x = 2", "a = 2", "a = 3"]) {
        const r = G.buildList([{ id: "q", t: s }, ...(s === "a = 2" ? [{ id: "w", t: "a = 3" }] : [])]).rows;
        if (s === "a = 2") { assert.equal(r[1].kind, "err"); continue; }
        if (s === "a = 3") continue;
        assert.equal(r[0].kind, "err", s); assert.ok(r[0].msg.length > 5);
    }
    const loop = list("p = q + 1", "q = p").rows;
    assert.equal(loop[0].kind, "err");
    const fl = list("f(x) = g(x)", "g(x) = f(x)", "f(2)").rows;
    assert.ok(Number.isNaN(fl[2].value) || fl[2].kind === "err");
});
t("numbers for people", () => {
    assert.equal(G.fmt(3), "3"); assert.equal(G.fmt(-1.25), "−1.25"); assert.equal(G.fmt(1 / 3), "0.333333");
    assert.equal(G.fmt(0.1 + 0.2), "0.3"); assert.equal(G.fmt(1.5e9), "1.5×10⁹"); assert.equal(G.fmt(NaN), "undefined");
});
t("zeros and grid steps", () => {
    const z = G.zerosOf((x) => x * x - 4, -10, 10);
    assert.equal(z.length, 2); near(z[0], -2, 1e-6); near(z[1], 2, 1e-6);
    assert.equal(G.zerosOf((x) => 1 / x, -5, 5).length, 0);   // the jump at 0 is not a zero
    assert.equal(G.niceStep(20), 2); assert.equal(G.niceStep(100), 10); assert.equal(G.niceStep(3), 0.2);
});
t("saved state is cleaned", () => {
    const c = G.cleanGc({ e: [{ id: "a!1", t: "y=x", c: 99, h: 1, r: { lo: 0, hi: 5, st: 0.5 } }, { id: "a1", t: "dup" }, { id: "", t: "x" }, null], v: { cx: "2", cy: 1e9, w: -3 } });
    assert.equal(c.e.length, 1); assert.equal(c.e[0].id, "a1"); assert.equal(c.e[0].c, 99 % G.GC_COLS.length); assert.equal(c.e[0].h, true);
    assert.deepEqual(c.e[0].r, { lo: 0, hi: 5, st: 0.5 });
    assert.equal(c.v.cx, 2); assert.equal(c.v.cy, 1e6); assert.equal(c.v.w, 1e-3);
    assert.deepEqual(G.cleanGc(null), { e: [], v: { cx: 0, cy: 0, w: 22 } });
    assert.equal(G.snapTo(2.537, { lo: -10, hi: 10, st: 0 }), 2.6);
    assert.equal(G.snapTo(99, { lo: 0, hi: 5, st: 0.5 }), 5);
});
console.log("graph: " + n + " checks passed");
