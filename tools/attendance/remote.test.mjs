// The Remote's list sync for Who's out: node tools/attendance/remote.test.mjs  (made-up names only)
import assert from "node:assert/strict";
import { posNames, mirrorList } from "../../js/attendanceRemote.js";

// positions match the raw roster even with a blank line (the Name Picker counts raw positions)
assert.deepEqual(posNames(["Ava Rivera", "", "Ben Kim", "Ava Tran"]), ["Ava R.", "", "Ben K.", "Ava T."]);
const names = (per) => ({ "1st": posNames(["Ava Rivera", "", "Ben Kim", "Cara Lopez"]) }[per] || []);
const doc = { out: { "1st": { "ben-k": { n: "Ben K.", at: 1 }, "cara-l": { n: "Cara L.", at: 2, x: 1 } } } };

// yesterday's list is dropped, not carried into today
let r = mirrorList({ day: "2026-11-23", periods: { "1st": [0, 3] } }, doc, "2026-11-24", names, ["1st"]);
assert.deepEqual(r.list, { day: "2026-11-24", periods: { "1st": [2] } }); assert.ok(r.changed);
// today: a Name Picker-only tap stays; the record wins for the students it names (Cara tapped back in elsewhere)
r = mirrorList({ day: "2026-11-24", periods: { "1st": [0, 3] } }, doc, "2026-11-24", names, ["1st"]);
assert.deepEqual(r.list.periods["1st"], [0, 2]);
// nothing to change: no push
r = mirrorList({ day: "2026-11-24", periods: { "1st": [0, 2] } }, doc, "2026-11-24", names, ["1st"]);
assert.equal(r.changed, false);
console.log("who's out list sync: all checks passed");
