// Standards Timeline links (needs + floor skills). Run: node tools/timeline/links.test.mjs
import assert from "node:assert/strict";
import { STANDARDS } from "../../data/standards.js";
import { LINKS } from "../../data/stdLinks.js";
import { LADDER, problemsFor } from "../../js/foundBank.js";
import * as L from "../../js/timelineLinks.js";
import * as T from "../../js/timelineCore.js";

const codes = new Set(Object.values(STANDARDS).flatMap((c) => c.standards.map((s) => s.code))), steps = new Set(LADDER.map((x) => x.id));
// Only real codes, only real ladder steps, and every 7th and 8th standard has an entry.
for (const [code, v] of Object.entries(LINKS)) {
    assert.ok(codes.has(code), "unknown code " + code);
    v.needs.forEach((c) => { assert.ok(codes.has(c), code + " needs unknown " + c); assert.notEqual(c, code); });
    v.floor.forEach((f) => assert.ok(steps.has(f), code + " floor unknown " + f));
}
for (const cls of ["7th", "8th"]) for (const s of STANDARDS[cls].standards) assert.ok(LINKS[s.code], "no links for " + s.code);
// Every floor step has problems to give.
for (const f of steps) assert.ok(problemsFor(f, 6).length >= 6, f);
// In Eddie's locked order, nothing a standard needs from its own class comes after it.
for (const cls of ["7th", "8th"]) { const lanes = T.defaultLanes(cls); for (const c of lanes.flat()) assert.deepEqual(L.needsAfter(cls, lanes, c), [], cls + " " + c); }
// Eddie's example: triangle angle sum (8.25) builds on combining like terms (7.6) and equations (8.11).
assert.ok(L.needsOf("8.25").includes("7.6") && L.needsOf("8.25").includes("8.11"));
// Dragging 8.25 ahead of 8.11 flags it.
const moved = T.moveCard(T.defaultLanes("8th"), "8.25", 0, 0);
assert.deepEqual(L.needsAfter("8th", moved, "8.25"), ["8.11"]);
// Teacher floors: set, read, empty on purpose, clear.
let f = L.setFloor({}, "8th", "8.25", ["F:intAdd", "F:intAdd", "F:nope"]);
assert.deepEqual(L.floorOf("8th", "8.25", f), ["F:intAdd"]); assert.ok(L.isCustomFloor("8th", "8.25", f));
assert.deepEqual(L.floorOf("7th", "8.25", f), L.defaultFloor("8.25"), "other class keeps the default");
f = L.setFloor(f, "8th", "8.25", []); assert.deepEqual(L.floorOf("8th", "8.25", f), []);
f = L.setFloor(f, "8th", "8.25", null); assert.deepEqual(f, {}); assert.deepEqual(L.floorOf("8th", "8.25", f), ["F:eq2"]);
const none = [...codes].filter((c) => /^[78]\./.test(c) && !L.defaultFloor(c).length);
console.log("no floor step yet:", none.join(", "));
console.log("links tests: passed");
