// Standards Timeline tray. Run: node tools/timeline/tray.test.mjs
import assert from "node:assert/strict";
import { STANDARDS } from "../../data/standards.js";
import * as Tr from "../../js/timelineTray.js";
import * as C from "../../js/assignCore.js";
const files = await Promise.all(["g7", "g8", "alg1"].map((f) => import("../../data/stdbank/" + f + ".js").then((m) => m.default)));
const cls8 = (std) => Object.keys(STANDARDS).filter((c) => STANDARDS[c].standards.some((s) => s.code === std));
const bank = files.flatMap((f) => f.items.map((x) => ({ ...x, cls: f.cls, for: cls8(x.std) })));

// Every 8th and 7th standard has bank problems, by level.
for (const cls of ["8th", "7th"]) for (const s of STANDARDS[cls].standards) { const n = Tr.counts(bank, cls, s.code); assert.ok(n.all > 0, cls + " " + s.code); }
const n825 = Tr.counts(bank, "8th", "8.25"); console.log("8.25 problems by level:", n825);

let t = Tr.add(null, "8.25"); t = Tr.add(t, "8.11", [2, 3]); t = Tr.add(t, "8.26");
assert.deepEqual(t.items.map((x) => x.code), ["8.25", "8.11", "8.26"]);
assert.equal(t.items[0].need, 4, "need 4 right (Eddie)");
assert.deepEqual(t.items[0].lv, [1, 2]);
t = Tr.add(t, "8.25", [3]); assert.equal(t.items.length, 3); assert.deepEqual(t.items[0].lv, [3], "re-adding updates the levels");
t = Tr.move(t, "8.26", 0); assert.deepEqual(t.items.map((x) => x.code), ["8.26", "8.25", "8.11"]);
t = Tr.set(t, "8.11", "need", 99); assert.equal(t.items[2].need, 10, "need capped");
t = Tr.remove(t, "8.26"); assert.ok(!Tr.has(t, "8.26"));

// Pools only hold the chosen levels and only this class.
const sk = Tr.skills(t, bank, "8th", STANDARDS["8th"].standards);
assert.deepEqual(sk.map((x) => x.std), ["8.25", "8.11"]);
assert.ok(sk[0].pool.every((x) => x.lvl === 3 && x.std === "8.25"));
assert.ok(sk[1].pool.every((x) => [2, 3].includes(x.lvl)));
assert.ok(sk.every((x) => x.src === "bank:" + x.std), "each standard stays its own skill");

// The time estimate is the Assignments builder's.
const m = Tr.minutes(t, bank, "8th", STANDARDS["8th"].standards);
assert.equal(m, C.estimateMins({ type: "practice", skills: sk, opts: { need: 4 } })); assert.ok(m > 0);
assert.equal(Tr.minutes({ items: [] }, bank, "8th", []), 0);
const h = Tr.handoff(t, bank, "8th", STANDARDS["8th"].standards, 5);
assert.equal(h.title, "8.25, 8.11 practice"); assert.equal(h.need, 4); assert.equal(h.cls, "8th"); assert.equal(h.skills.length, 2);
// Floor (foundational) skills go in the tray too, from js/foundBank.js.
const ft = Tr.add({ items: [] }, "F:eq2"); const fs = Tr.skills(ft, bank, "8th", STANDARDS["8th"].standards);
assert.equal(fs.length, 1); assert.equal(fs[0].std, "F:eq2"); assert.ok(fs[0].pool.length > 0 && fs[0].pool.every((x) => x.a)); assert.match(fs[0].name, /^Floor: Two-step/);
assert.ok(Tr.counts(bank, "8th", "F:eq2").all >= 6);
assert.match(Tr.handoff(Tr.add(ft, "8.25"), bank, "8th", STANDARDS["8th"].standards).title, /^Two-step equations, 8\.25 practice$/);
// Vault Raid set from the tray: categories per standard, at most 6x6, keys pass the game's own cleaner and checker.
{
    const G = await import("../../js/games.js"), V = await import("../../js/vaultCore.js");
    let vt = Tr.add(Tr.add({ items: [] }, "8.25", [1, 2]), "8.26", [1, 2, 3]); vt = Tr.set(vt, "8.26", "w", 2);
    const r = Tr.vaultSet(vt, bank, "8th", { seed: "t" });
    assert.ok(r.doc.cats.length >= 2 && r.doc.cats.length <= 6, "cats " + r.doc.cats.length);
    assert.ok(r.doc.cats.every((c) => c.clues.length >= 1 && c.clues.length <= 6));
    const by = (code) => r.doc.cats.filter((c) => c.n.startsWith(code)).reduce((s, c) => s + c.clues.length, 0);
    assert.ok(by("8.26") > by("8.25"), "weight 2 gets more: " + by("8.25") + " vs " + by("8.26"));
    const clean = G.cleanSet(Object.assign({ id: "x" }, r.doc)); assert.equal(G.countClues(clean), r.n, "nothing cut by Vault Raid");
    r.doc.cats.forEach((c) => c.clues.forEach((q) => { assert.ok(q.q && q.a); assert.ok(V.sameAnswer(q.a, q.a, q.al || []), q.a); if (q.ch) assert.ok(q.ch.length >= 2); }));
    const ids = r.doc.cats.flatMap((c) => c.clues.map((q) => q.q)); assert.equal(new Set(ids).size, ids.length, "no repeats");
    // levels: 8.25 only on-ramp and on level
    const lv825 = new Set(bank.filter((x) => x.std === "8.25" && x.lvl === 3).map((x) => x.q));
    assert.ok(r.doc.cats.filter((c) => c.n.startsWith("8.25")).every((c) => c.clues.every((q) => !lv825.has(q.q))));
    // one standard: split into several categories of up to 6
    const one = Tr.vaultSet(Tr.add({ items: [] }, "8.11", [1, 2, 3]), bank, "8th", { seed: "t" });
    assert.ok(one.doc.cats.length >= 2 && one.n <= 24, "one standard " + one.doc.cats.length + " cats, " + one.n);
    // 8 standards: the first 6 fit, the rest are named
    let many = { items: [] }; ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.11", "8.25"].forEach((c) => { many = Tr.add(many, c); });
    const m = Tr.vaultSet(many, bank, "8th", {}); assert.equal(m.doc.cats.length, 6); assert.deepEqual(m.left, ["8.11", "8.25"]);
    // a floor skill
    const f = Tr.vaultSet(Tr.add({ items: [] }, "F:coord", [1, 2]), bank, "8th", {}); assert.ok(f.doc.cats[0].n.startsWith("Floor: Points"));
    assert.ok(Tr.vaultTitle(vt, new Date(2026, 10, 23)).startsWith("Timeline review · 8.25, 8.26 · Nov 23"));
    console.log("vault set:", r.doc.cats.map((c) => c.n + " " + c.clues.length).join(" | "), "| one std:", one.doc.cats.length, "cats", one.n);
}
console.log("tray tests: passed (" + m + " min)");
