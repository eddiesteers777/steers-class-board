// Class Tracker rules: node tools/track/core.test.mjs
import assert from "node:assert/strict";
import * as T from "../../js/trackCore.js";

const tags = T.cleanTags(null);
assert.equal(tags.filter((t) => t.s > 0).length, 6);
assert.equal(tags.filter((t) => t.s < 0).length, 6);
assert.equal(T.cleanTags({ tags: [{ k: "rr", l: "x", s: 1 }] }).length, tags.length);   // a built-in key is never a tag: falls back
assert.deepEqual(T.cleanTags({ tags: [{ k: "a", l: " Kind ", s: 1 }, { k: "a", l: "dup", s: 1 }, { k: "b", l: "Late", s: -5, off: 1 }] }), [{ k: "a", l: "Kind", s: 1 }, { k: "b", l: "Late", s: -1, off: 1 }]);
assert.equal(T.keyFor("Helped a classmate", tags), "helped-a-classmate");
assert.equal(T.keyFor("Participation", [{ k: "participation" }]), "participation-2");

const doc = { day: "2026-11-20", ev: {
    a: { p: "1st", n: "Ava R.", k: "part", at: 1 },
    b: { p: "1st", n: "Ava R.", k: "redirect", at: 2 },
    c: { p: "1st", n: "Ben T.", k: "effort", at: 3 },
    d: { p: "1st", n: "Ben T.", k: "part", at: 4, x: 1 },             // taken back
    e: { p: "1st", n: "Cara L.", k: "rr", at: 10 * 60000 },           // out now
    f: { p: "1st", n: "Ben T.", k: "rr", at: 0, b: 4 * 60000 },        // 4 minutes
    g: { p: "2nd", n: "Dev P.", k: "part", at: 5 },
    h: { p: "1st", n: "Dev P.", k: "abs", at: 6 },
    i: { p: "1st", n: "Ava R.", k: "note", t: "Great question", at: 7 },
} };
const e1 = T.events(doc, "1st");
assert.equal(e1.length, 7);
const by = T.dayByKid(e1, tags);
assert.equal(by["Ava R."].good, 1); assert.equal(by["Ava R."].work, 1); assert.equal(by["Ava R."].notes[0].t, "Great question");
assert.equal(by["Ben T."].good, 1); assert.equal(by["Ben T."].rr.mins, 4); assert.equal(by["Ben T."].rr.out, null);
assert.equal(by["Cara L."].rr.out.id, "e"); assert.ok(by["Dev P."].abs);
assert.deepEqual(T.totals(e1, tags), { good: 2, work: 1, ratio: 2 });
assert.deepEqual(T.outNow(e1).map((x) => x.n), ["Cara L."]);

// Picker: never absent or out, no repeats until everyone present has had a turn.
const names = ["Ava R.", "Ben T.", "Cara L.", "Dev P."];
let evs = e1.slice(), seen = [];
for (let i = 0; i < 2; i++) { const r = T.pickNext(names, evs, () => 0.99); seen.push(r.name); evs.push({ id: "p" + i, p: "1st", n: r.name, k: "pick", at: 100 + i }); }
assert.deepEqual(seen.sort(), ["Ava R.", "Ben T."]);                   // Cara out, Dev absent
assert.deepEqual(T.pickRound(names, evs), { called: 0, of: 2 });        // round complete, starts over
const third = T.pickNext(names, evs, () => 0, "Ava R."); assert.equal(third.name, "Ben T.");   // no same name twice in a row
assert.equal(T.pickNext(["Dev P."], evs), null);

// History matches names loosely and adds up across days.
const doc2 = { day: "2026-11-19", ev: { z: { p: "1st", n: "ava r", k: "attn", at: 1 }, y: { p: "1st", n: "Ava R.", k: "rr", at: 0, b: 6 * 60000 } } };
const h = T.kidHistory([doc, doc2], "1st", "Ava R.", tags);
assert.equal(h.days.length, 2); assert.equal(h.days[0].day, "2026-11-20");
assert.equal(h.good, 1); assert.equal(h.work, 2); assert.equal(h.rr, 1); assert.equal(h.rrMins, 6); assert.equal(h.notes.length, 1);
assert.equal(h.tags.attn, 1);

// The old tally shape for Student Progress.
assert.deepEqual(T.toTally(doc, tags).periods["1st"]["Ava R."], { p: 1, t: 0, r: 1 });
assert.deepEqual(T.toTally(doc, tags).periods["1st"]["Ben T."], { p: 0, t: 1, r: 0 });
assert.equal(T.clock(185000), "3:05");
console.log("class tracker core: all checks passed");
