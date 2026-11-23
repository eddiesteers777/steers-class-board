// Attendance rules: node tools/attendance/core.test.mjs
import assert from "node:assert/strict";
import * as A from "../../js/attendanceCore.js";

// first names only; the initial comes back only for two students who share a first name
const per = ["Ava R.", "Ava T.", "Ben K.", "Cara L."];
assert.equal(A.displayName("Ben K.", per), "Ben");
assert.equal(A.displayName("Ava R.", per), "Ava R.");
assert.equal(A.displayName("Ava T.", per), "Ava T.");
assert.equal(A.displayName("cara", ["cara"]), "cara");
assert.equal(A.firstOf("Ava R."), "Ava");

// a tap writes one student only, keyed like the game profiles
const w = A.tapWrite("2026-11-24", "1st", "Ben K.", true, 5);
assert.deepEqual(w, { v: 1, day: "2026-11-24", out: { "1st": { "ben-k": { n: "Ben K.", at: 5 } } } });
assert.equal(JSON.stringify(w).includes("Kim"), false);
assert.deepEqual(A.tapWrite("2026-11-24", "1st", "Ben K.", false, 9).out["1st"]["ben-k"], { n: "Ben K.", at: 9, x: 1 });

// reading: tapped back in is not out; oldest tap first
const doc = { v: 1, day: "2026-11-24", out: { "1st": { "ben-k": { n: "Ben K.", at: 5 }, "ava-r": { n: "Ava R.", at: 3 }, "cara-l": { n: "Cara L.", at: 4, x: 1 } } } };
assert.deepEqual(A.outList(doc, "1st").map((o) => o.nm), ["Ava R.", "Ben K."]);
assert.ok(A.isOut(doc, "1st", "ben k")); assert.ok(!A.isOut(doc, "1st", "Cara L.")); assert.ok(!A.isOut(doc, "2nd", "Ben K."));
assert.deepEqual(A.positionsOut(doc, "1st", per), [0, 2]);   // roster positions for the Name Picker's own list

// odd or hostile documents are cleaned, never trusted
const bad = A.cleanDoc({ out: { "1st": { "ok-one": { n: "Ok", at: 1 }, "BAD KEY": { n: "x", at: 1 }, "no-name": { at: 2 }, "n-long": { n: "x".repeat(99), at: -4 } }, "bad per!": { a: { n: "z", at: 1 } } } }, "2026-11-24");
assert.deepEqual(Object.keys(bad.out), ["1st"]);
assert.deepEqual(Object.keys(bad.out["1st"]).sort(), ["n-long", "ok-one"]);
assert.equal(bad.out["1st"]["n-long"].n.length, 24); assert.equal(bad.out["1st"]["n-long"].at, 0);
assert.deepEqual(A.cleanDoc(null, "nope"), { v: 1, day: "", out: {} });

// absences across days: dedupes, newest first, adds the Tracker's older taps unless tapped back in on attendance
const docs = [{ day: "2026-11-24", doc }, { day: "2026-11-23", doc: { out: { "1st": { "ben-k": { n: "Ben K.", at: 1 } } } } }];
const track = [{ day: "2026-11-24", ev: { a: { p: "1st", n: "Cara L.", k: "abs" }, b: { p: "1st", n: "Dev P.", k: "abs" }, c: { p: "1st", n: "Eli S.", k: "abs", x: 1 }, d: { p: "1st", n: "Ava R.", k: "abs" } } }];
const all = A.absences(docs, track);
assert.deepEqual(all.map((x) => x.day + " " + x.nm), ["2026-11-24 Ava R.", "2026-11-24 Ben K.", "2026-11-24 Dev P.", "2026-11-23 Ben K."]);
console.log("attendance core: all checks passed");
