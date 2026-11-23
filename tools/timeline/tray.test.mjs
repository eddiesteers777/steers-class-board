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
console.log("tray tests: passed (" + m + " min)");
