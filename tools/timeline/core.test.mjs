// Standards Timeline logic. Run: node tools/timeline/core.test.mjs
import assert from "node:assert/strict";
import { STANDARDS } from "../../data/standards.js";
import * as T from "../../js/timelineCore.js";
import { nextUp } from "../../js/standardsNext.js";

// Every standard of each class is one card, exactly once, and the locked plans use only real codes.
for (const cls of Object.keys(STANDARDS).filter((c) => STANDARDS[c].units.length)) {   // classes with district units (not the g2..g6 bank grades)
    const codes = STANDARDS[cls].standards.map((s) => s.code).sort();
    const lanes = T.defaultLanes(cls), flat = lanes.flat();
    assert.equal(lanes.length, 4, cls);
    assert.equal(new Set(flat).size, flat.length, cls + ": no repeats");
    assert.deepEqual(flat.slice().sort(), codes, cls + ": every standard once");
    lanes.forEach((l, i) => assert.ok(l.length, cls + " lane " + (i + 1) + " not empty"));
}
assert.equal(T.defaultLanes("8th").flat().length, 30);
assert.equal(T.defaultLanes("7th").flat().length, 22);
// Eddie's 8th spine: equations end the 1st, triangle angle sum (8.25a) opens the 2nd, functions open the 3rd.
assert.equal(T.PLAN["8th"].lanes[0].at(-1), "8.11");
assert.equal(T.PLAN["8th"].lanes[1][0], "8.25");
assert.ok(STANDARDS["8th"].standards.find((s) => s.code === "8.25").parts.some((p) => /triangle is 180/.test(p.text)));
assert.equal(T.PLAN["8th"].lanes[2][0], "8.13");
// 8th Acc: district order, split by whole units, order kept.
assert.deepEqual(T.defaultLanes("8th-acc").flat(), T.districtOrder("8th-acc"));
console.log("8th Acc lanes:", T.defaultLanes("8th-acc").map((l) => l.length).join(" / "));

// Saved order is cleaned: junk and repeats dropped, missing standards go back to their default lane.
const saved = { lanes: [["8.11", "8.1", "8.1", "9.99"], ["8.2"], [], []] };
const got = T.lanesFor("8th", saved);
assert.deepEqual(got[0].slice(0, 2), ["8.11", "8.1"]);
assert.equal(got[1][0], "8.2");
assert.equal(got.flat().length, 30);
assert.ok(T.isDefault("8th", T.lanesFor("8th", null)));
// The saved shape (an object, Firestore has no lists of lists) reads back the same.
assert.deepEqual(T.lanesFor("8th", { lanes: T.toSaved(got) }), got);
assert.ok(!T.isDefault("8th", got));

// Moving a card within and across lanes.
let L = T.defaultLanes("7th");
L = T.moveCard(L, "7.9", 0, 0); assert.equal(L[0][0], "7.9"); assert.ok(!L[1].includes("7.9"));
L = T.moveCard(L, "7.9", 1, 99); assert.equal(L[1].at(-1), "7.9");
assert.deepEqual(T.whereIs(L, "7.9"), { lane: 1, index: L[1].length - 1 });
assert.equal(L.flat().length, 22);

// Next up: with the district order it matches js/standardsNext.js exactly.
const districtLanes = (cls) => [T.districtOrder(cls), [], [], []];
const marks = [
    {},
    { "8th": { "8.1": { s: "taught" }, "8.2": { s: "taught" } } },
    { "8th": { "8.1": { s: "taught" }, "8.2": { s: "taught" }, "8.4": { s: "taught" }, "8.3": { s: "teaching" } } },
    { "8th": { "8.13": { s: "teaching" }, "8.25": { s: "teaching" }, "8.11": { s: "reteach" } } },
    { "7th": { "7.4": { s: "taught" }, "7.5": { s: "teaching" } } },
];
for (const cls of ["8th", "7th", "8th-acc"]) for (const m of marks) {
    const a = nextUp(cls, m), b = T.timelineNext(cls, districtLanes(cls), m);
    // Standards in no district unit (8th: 8.29, 8.30) are cards on the Timeline; the Standards page's Next up skips them.
    const inUnit = (x) => !!x.unit;
    assert.deepEqual(b.next.filter(inUnit).map((x) => x.code), a.next.map((x) => x.code), cls + " next " + JSON.stringify(m));
    assert.deepEqual(b.left.map((x) => x.code), a.left.map((x) => x.code), cls + " left");
    assert.equal(b.critLeft, a.critLeft);
    assert.deepEqual(b.teaching.slice().sort(), a.teaching.slice().sort());
}
// In the locked order: 1st nine weeks taught, so Next up starts with triangle angle sum (8.25), not Pythagorean.
const q1 = { "8th": Object.fromEntries(T.PLAN["8th"].lanes[0].map((c) => [c, { s: "taught" }])) };
const n = T.timelineNext("8th", T.defaultLanes("8th"), q1);
assert.deepEqual(n.next.slice(0, 4).map((x) => x.code), ["8.25", "8.26", "8.27", "8.28"]);
assert.equal(n.current.lane, 1);
// Teaching 8.13 while 8.25 is open: 8.25 shows as left open in an earlier lane.
const ahead = T.timelineNext("8th", T.defaultLanes("8th"), { "8th": { ...q1["8th"], "8.13": { s: "teaching" } } });
assert.deepEqual(ahead.left.map((x) => x.code), ["8.25", "8.26", "8.27", "8.28"]);
assert.equal(ahead.next[0].code, "8.14");
// timelineUnit: the unit the Planner suggests follows the Timeline order, not the district order.
assert.match(T.timelineUnit("8th", T.defaultLanes("8th"), q1), /^\S+ \S+: /);
assert.equal(T.timelineUnit("8th", T.defaultLanes("8th"), q1), n.unitWord + " " + n.next[0].unit.id + ": " + n.next[0].unit.name);
assert.equal(T.timelineUnit("nope", [], {}), "");
console.log("timeline core tests: passed");

// The map (Nov 24): one stop per run of a unit in a lane, numbered through the year, "here" matches Next up.
{
    const L8 = T.defaultLanes("8th");
    const m0 = T.mapStops("8th", L8, {});
    assert.equal(m0.regions.length, 4);
    assert.equal(m0.stops.flatMap((s) => s.items).length, 30, "every 8th standard on the map once");
    assert.deepEqual(m0.stops.map((s) => s.n), m0.stops.map((_, i) => i + 1));
    assert.equal(m0.regions[0].stops[0].label, "Topic 1A");
    assert.equal(m0.regions[0].stops[0].name, "Real Numbers");
    assert.deepEqual(m0.regions[0].stops[0].items.map((x) => x.code), ["8.1", "8.2", "8.4"]);
    assert.equal(m0.here, 0, "nothing marked: the first stop");
    assert.equal(m0.next, 1);
    assert.equal(m0.stops[0].state, "here");
    assert.equal(m0.stops[1].state, "ahead");
    assert.ok(m0.stops.every((s) => s.name), "every stop has a name");
    const geo = m0.stops.find((s) => s.items.some((x) => x.code === "8.29"));
    assert.equal(geo.label, "", "8.29/8.30 have no unit doc: no label, named by their domain");
    assert.equal(geo.name, STANDARDS["8th"].standards.find((s) => s.code === "8.29").domain);
    const m7 = T.mapStops("7th", T.defaultLanes("7th"), {});
    assert.equal(m7.regions[1].stops[0].cont, true, "7.9 carries Topic 2 over from the 1st nine weeks");
    assert.equal(m7.regions[0].stops[0].cont, false);
    assert.equal(m0.taught, 0); assert.equal(m0.total, 30);
    // Eddie's marks on Nov 24: 1st nine weeks taught, 8.26-8.28 taught, 8.25, 8.13 and 8.7 teaching.
    const t = { s: "taught", d: "2026-11-17" }, g = { s: "teaching", d: "2026-11-17" };
    const P = { "8th": { "8.1": t, "8.2": t, "8.3": t, "8.4": t, "8.5": t, "8.6": t, "8.11": t, "8.26": t, "8.27": t, "8.28": t, "8.25": g, "8.13": g, "8.7": g } };
    const m = T.mapStops("8th", L8, P);
    const hereStop = m.stops[m.here];
    assert.deepEqual(hereStop.items.map((x) => x.code), ["8.25"], "here is the first stop with a card marked Teaching");
    const nu = T.timelineNext("8th", L8, P);
    assert.equal(hereStop.lane, nu.current.lane); assert.equal(hereStop.unit.id, nu.current.unit.id);
    assert.equal(m.stops.slice(0, m.here).every((s) => s.state === "done"), true);
    assert.ok(m.next > m.here && m.stops[m.next].state !== "done" && m.stops.slice(m.here + 1, m.next).every((s) => s.state === "done"), "next is the first open stop after here");
    assert.ok(m.stops.filter((s) => s.state === "teaching").length >= 2, "8.13's and 8.7's stops show Teaching too");
    assert.equal(m.taught, 10);
    // An open stop before the current one is "left".
    const P2 = { "8th": { "8.1": t, "8.2": t, "8.4": t, "8.25": g } };
    const m2 = T.mapStops("8th", L8, P2);
    assert.equal(m2.stops[0].state, "done"); assert.equal(m2.stops[1].state, "left");
    // Everything taught: no "here", no "next".
    const all = { "7th": Object.fromEntries(STANDARDS["7th"].standards.map((s) => [s.code, t])) };
    const m3 = T.mapStops("7th", T.defaultLanes("7th"), all);
    assert.equal(m3.here, -1); assert.equal(m3.next, -1); assert.ok(m3.stops.every((s) => s.state === "done"));
    // 8th Acc and a teacher's own order work the same way.
    const ma = T.mapStops("8th-acc", T.defaultLanes("8th-acc"), {});
    assert.equal(ma.stops.flatMap((s) => s.items).length, STANDARDS["8th-acc"].standards.length);
    assert.ok(ma.stops[0].label.startsWith("Unit "));
    const own = T.moveCard(L8, "8.11", 0, 0), mo = T.mapStops("8th", own, {});
    assert.deepEqual(mo.stops[0].items.map((x) => x.code), ["8.11"], "a moved card makes its own stop");
    console.log("map stops: 8th", m0.stops.length, "/ 7th", T.mapStops("7th", T.defaultLanes("7th"), {}).stops.length, "/ 8th Acc", ma.stops.length);
}
