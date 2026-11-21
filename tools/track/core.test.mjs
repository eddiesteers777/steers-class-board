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

// Passes out of class: places, trips, totals by week / month / nine weeks / year.
assert.equal(T.placeOf({ k: "rr" }), "Restroom"); assert.equal(T.placeOf({ k: "rr", w: "Nurse" }), "Nurse");
const M = 60000, at = (day, h, m) => new Date(day + "T" + ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2)).getTime();
const tdocs = [
    { day: "2026-11-20", ev: { a: { p: "1st", n: "Ava R.", k: "rr", at: at("2026-11-20", 9, 0), b: at("2026-11-20", 9, 6) }, b: { p: "1st", n: "Ava R.", k: "rr", w: "Nurse", at: at("2026-11-20", 9, 30), b: at("2026-11-20", 9, 50) } } },
    { day: "2026-11-16", ev: { c: { p: "1st", n: "Ava R.", k: "rr", at: at("2026-11-16", 9, 0), b: at("2026-11-16", 9, 4) } } },
    { day: "2026-11-02", ev: { d: { p: "1st", n: "Ava R.", k: "rr", w: "Office", at: at("2026-11-02", 9, 0) } } },              // no back time
    { day: "2026-10-01", ev: { e: { p: "1st", n: "Ava R.", k: "rr", at: at("2026-10-01", 9, 0), b: at("2026-10-01", 9, 10) } } },
    { day: "2026-10-01", ev: { f: { p: "2nd", n: "Ava R.", k: "rr", at: 1, b: 2 } } },                                           // other period
];
const trips = T.tripsOf(tdocs, "1st", "Ava R.");
assert.equal(trips.length, 5); assert.equal(trips[0].w, "Nurse"); assert.equal(trips[0].mins, 20);
const NWK = [{ n: 1, start: "2026-08-13", end: "2026-10-09" }, { n: 2, start: "2026-10-14", end: "2026-12-18" }];
const tot = T.outTotals(trips, "2026-11-20", NWK, "2026-08-13");
assert.deepEqual(tot.week, { mins: 30, n: 3 });     // Mon Nov 16 to Fri Nov 20
assert.deepEqual(tot.month, { mins: 30, n: 4 });    // November (one with no back time)
assert.deepEqual(tot.nine, { mins: 30, n: 4 }); assert.equal(tot.nineN, 2);
assert.deepEqual(tot.year, { mins: 40, n: 5 });
assert.equal(tot.noBack, 1);
assert.deepEqual(tot.places[0], { w: "Restroom", mins: 20, n: 3 });
assert.equal(T.hm(65), "1 h 05 min"); assert.equal(T.hm(7), "7 min");
console.log("passes and totals: all checks passed");
