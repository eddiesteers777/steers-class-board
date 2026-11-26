// Which lessons an account sees: node tools/pack/core.test.mjs
import assert from "node:assert/strict";
import { inferPack, trusted, EVIDENCE_DOCS, EVIDENCE_COLLECTIONS } from "../../js/packRules.js";

// Eddie's account on Nov 23: "starter" saved as an inferred "new account", rosters and week5 there, weekfiles/index missing
const eddie = { pack: "starter", how: "new account" };
assert.equal(trusted(eddie), false, "an inferred starter is not trusted");
const found = { "rosters/all": true, "board/state": true, "weekfiles/index": false, "settings/bells": true, "data/index": true, "weekfiles/*": true, "plans/*": true };
assert.deepEqual(inferPack(eddie, found), { pack: "calera", save: true, why: "real data: rosters/all, board/state, settings/bells, data/index, weekfiles/*, plans/*" });
assert.equal(inferPack(eddie, { "weekfiles/index": false, "weekfiles/*": true }).pack, "calera", "week files without an index still count");

// finding nothing is inconclusive: Calera, nothing saved; never "starter"
assert.deepEqual(inferPack(null, { "rosters/all": false, "board/state": false, "weekfiles/index": false, "weekfiles/*": false }), { pack: "calera", save: false, why: "no data found: inconclusive, nothing saved" });
assert.deepEqual(inferPack(null, null), { pack: "calera", save: false, why: "checks could not run" });
assert.equal(inferPack(eddie, {}).pack, "calera");

// explicit choices are kept
assert.deepEqual(inferPack({ pack: "starter", how: "chosen on Home" }, null), { pack: "starter", save: false, why: "saved (chosen on Home)" });
assert.equal(inferPack({ pack: "starter", how: "set by hand" }, null).pack, "starter");
assert.equal(inferPack({ pack: "calera", how: "existing account" }, null).pack, "calera");
assert.equal(inferPack({ pack: "nonsense" }, null).pack, "calera");

// no combination of evidence ever answers "starter"
const keys = EVIDENCE_DOCS.concat(EVIDENCE_COLLECTIONS.map((c) => c + "/*"));
for (let m = 0; m < 1 << keys.length; m++) {
    const f = {}; keys.forEach((k, i) => { f[k] = !!(m & (1 << i)); });
    for (const saved of [null, eddie, { pack: "calera", how: "existing account" }]) assert.equal(inferPack(saved, f).pack, "calera");
    if (!m) assert.equal(inferPack(null, f).save, false); else assert.equal(inferPack(null, f).save, true);
}
// Early access: a teacher the owner let in, with every check run and nothing found, starts on their own setup
const empty = Object.fromEntries(keys.map((k) => [k, false]));
assert.deepEqual(inferPack(null, empty, "approved"), { pack: "starter", save: true, why: "new teacher on the approved list" });
assert.equal(trusted({ pack: "starter", how: "new teacher (approved list)" }), true);
// ...but never the owner, never when unsure, never with any real data, never over a saved choice
for (const a of ["owner", "unknown", "waiting", "guest", undefined]) assert.equal(inferPack(null, empty, a).pack, "calera", String(a));
assert.equal(inferPack(eddie, empty, "owner").pack, "calera");
assert.equal(inferPack(null, null, "approved").pack, "calera");
for (const k of keys) assert.equal(inferPack(null, { ...empty, [k]: true }, "approved").pack, "calera", k);
assert.equal(inferPack({ pack: "calera", how: "existing account" }, empty, "approved").pack, "calera");
console.log("pack rules: all checks passed");
