// Send to students (js/pushCore.js): what a send carries, answer groups for the live view, and who gets a follow-up.
// Run: node tools/board/push.test.mjs
import assert from "node:assert/strict";
import * as P from "../../js/pushCore.js";
import * as M from "../../js/manipCore.js";
import * as V from "../../js/vaultCore.js";

let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FAIL", name); throw e; } };
const same = (a, b) => V.sameAnswer(a, b, []);

t("every tool that can be sent is a board math tool", () => {
    P.SEND_TOOLS.forEach(([k]) => assert.ok(M.MT_KEYS.includes(k), k));
    assert.equal(P.SEND_TOOLS.length, new Set(P.SEND_TOOLS.map((x) => x[0])).size);
    assert.ok(P.isTool("graph")); assert.ok(!P.isTool("find")); assert.ok(!P.isTool("")); assert.ok(!P.isTool(null));
});
t("calculators start blank; a manipulative starts as the board set it up", () => {
    const T = { mt: { calc: M.mtDefault("calc"), balance: M.mtDefault("balance"), graph: M.mtDefault("graph") } };
    assert.equal(P.toolStart("calc", T), ""); assert.equal(P.toolStart("sci", T), "");
    assert.equal(P.toolStart("line", T), "");   // not open on the board: the student gets a fresh one
    const b = P.readStart("balance", P.toolStart("balance", T)); assert.deepEqual(b.s, b.e); assert.deepEqual(b.h, []);
    assert.ok(P.readStart("graph", P.toolStart("graph", T)));
    assert.equal(P.readStart("balance", "{not json"), null); assert.equal(P.readStart("nope", "{}"), null); assert.equal(P.readStart("graph", ""), null);
    assert.equal(P.readStart("graph", "x".repeat(5000)), null);
});
t("chance lab, transformations and function machine start without the board's own results", () => {
    const ch = M.mtDefault("chance"); ch.t = ch.t.map(() => 9);
    const fn = M.mtDefault("fn"); fn.ins = [1, 2, 3]; fn.g = "f"; fn.sh = true;
    const T = { mt: { chance: ch, fn } };
    assert.ok(P.readStart("chance", P.toolStart("chance", T)).t.every((x) => x === 0));
    const f = P.readStart("fn", P.toolStart("fn", T)); assert.deepEqual(f.ins, []); assert.equal(f.g, ""); assert.equal(f.sh, false); assert.equal(f.a, fn.a);
});
t("a Find panel's problem: dollar signs, other answers, no problem → nothing", () => {
    const o = P.fromFind({ id: "7.9-03", std: "7.9", q: "A shirt costs §20 after a §5 discount. What was the price?", a: "§25", also: ["25", "", 7, "25.00"] });
    assert.equal(o.q, "A shirt costs $20 after a $5 discount. What was the price?"); assert.equal(o.a, "$25"); assert.deepEqual(o.al, ["25", "25.00"]); assert.equal(o.id, "7.9-03");
    assert.equal(P.fromFind(null), null); assert.equal(P.fromFind({ id: "x" }), null);
});
t("answers group by meaning, the right one first, then the most common", () => {
    const res = { a: { y: "7", ok: true }, b: { y: "-7", ok: false }, c: { y: "−7", ok: false }, d: { y: "7.0", ok: true }, e: { y: "", ok: null }, f: { none: true }, g: { y: "x=7", ok: null }, h: { y: "12", ok: false } };
    const g = P.answerGroups(res, Object.keys(res).concat("z"), same);
    assert.equal(g[0].ok, true); assert.deepEqual(g[0].ids.sort(), ["a", "d", "g"], "x = 7 means 7");
    assert.equal(g[g.length - 1].blank, true); assert.deepEqual(g[g.length - 1].ids, ["e"]);
    const neg = g.find((x) => x.ids.includes("b")); assert.deepEqual(neg.ids.sort(), ["b", "c"]); assert.equal(neg.ok, false);
    assert.ok(g.indexOf(neg) < g.findIndex((x) => x.ids.includes("h")), "the more common miss comes first");
    assert.equal(g.reduce((s, x) => s + x.n, 0), 7, "a student who sent nothing isn't in a group");
});
t("follow-ups go to the ones who didn't get it, inside a targeted check-in", () => {
    const ci = { res: { a: { ok: true }, b: { ok: false }, c: { none: true }, d: { ok: null } } };
    assert.deepEqual(P.notYet(ci, ["a", "b", "c", "d", "e"]), ["b", "c", "d", "e"]);
    const tci = Object.assign({ to: ["b", "e"] }, ci);
    assert.deepEqual(P.forIds(tci, ["a", "b", "c", "e"]), ["b", "e"]);
    assert.deepEqual(P.notYet(tci, ["a", "b", "c", "e"]), ["b", "e"]);
    assert.deepEqual(P.forIds(null, ["a"]), ["a"]);
});
t("Show Steps: a walk slimmed, too big → nothing; hint lines never more than four", () => {
    const w = { ok: true, q: "2x + 3 = 11", a: "4", steps: [{ say: "Take 3 away" }, { say: "Halve" }], cols: 2, extra: "x".repeat(50) };
    const s = P.slimWalk(w); assert.deepEqual(Object.keys(s).sort(), ["a", "cols", "ok", "q", "steps"]); assert.equal(s.cols, 2);
    assert.equal(P.slimWalk({ ok: true, steps: [{ say: "x".repeat(30000) }] }), null);
    assert.equal(P.slimWalk({ ok: false, steps: [1] }), null); assert.equal(P.slimWalk(null), null);
    assert.deepEqual(P.hintLines({ steps: ["Costs §3", "", "b", "c", "d", "e"] }), ["Costs $3", "b", "c", "d"]);
    assert.deepEqual(P.hintLines({}), []);
});

console.log("push: " + n + " tests passed");
