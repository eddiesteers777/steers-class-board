// Unit checks for js/buddy.js (the student character). Run: node tools/profiles/buddy.test.mjs
import assert from "node:assert/strict";
import * as B from "../../js/buddy.js";
import * as PC from "../../js/profileCore.js";

const all = { xp: 9999, lv: 9, b: ["lock5", "steady", "eq"] };
// Every look string is short, valid, and survives a round trip.
for (let i = 0; i < 300; i++) {
    const s = B.stringify(B.randomLook());
    assert.ok(B.validLook(s) && s.length === 30, s);
    assert.equal(B.stringify(B.parse(s)), s);
    assert.ok(B.svg(s).startsWith("<svg"));
}
// Random starts only use open pieces.
for (let i = 0; i < 200; i++) { const s = B.stringify(B.randomLook()); assert.equal(B.cleanLook(s, null), s); }
// Same name, same starting look.
assert.equal(B.seedLook("Ava R."), B.seedLook("Ava R.")); assert.notEqual(B.seedLook("Ava R."), B.seedLook("Ben T."));
// Junk is fixed or refused.
assert.equal(B.validLook("x".repeat(41)), false); assert.equal(B.validLook("A1"), false); assert.equal(B.validLook("<s"), false);
assert.equal(B.parse("hz").h, 0); assert.equal(B.parse("q5").h, 0);
// Earned pieces: jacket at 250 XP, cape at level 2, crown with Lock Master.
const jacket = B.stringify(Object.assign(B.parse(""), { t: 4 })), cape = B.stringify(Object.assign(B.parse(""), { x: 2 })), crown = B.stringify(Object.assign(B.parse(""), { a: 6 }));
assert.equal(B.parse(B.cleanLook(jacket, { xp: 249 })).t, 0); assert.equal(B.parse(B.cleanLook(jacket, { xp: 250 })).t, 4);
assert.equal(B.parse(B.cleanLook(cape, { lv: 1 })).x, 0); assert.equal(B.parse(B.cleanLook(cape, { lv: 2 })).x, 2);
assert.equal(B.parse(B.cleanLook(crown, { b: ["eq"] })).a, 0); assert.equal(B.parse(B.cleanLook(crown, { b: ["lock5"] })).a, 6);
assert.equal(B.cleanLook(cape, null), B.stringify(B.parse("")));   // guests: open pieces only
// Every piece draws, earned or not.
const bad = (svg) => /NaN|undefined|Infinity/.test(svg);
B.PARTS.forEach(([k, , list]) => list.forEach((_, i) => {
    const s = B.stringify(Object.assign(B.parse(""), { [k]: i }));
    assert.equal(B.cleanLook(s, all), s);
    for (const yaw of [-30, 0, 90, 160, 180, 270]) { const f = B.frame(s, B.poseAt("", 0, 1.2), { yaw }); assert.ok(f.length > 2000 && !bad(f), k + i + " at " + yaw); }
    assert.ok(!bad(B.svg(s, { face: true, size: 64 })), k + i + " face");
}));
// Every move draws at every moment from three sides, and settles back to standing.
const busy = B.stringify({ s: 3, h: 3, c: 2, e: 2, m: 1, t: 1, u: 4, b: 3, v: 6, f: 4, w: 8, a: 1, k: 2, g: 5, x: 2 });
for (const mv of Object.keys(B.MOVES)) {
    const m = B.MOVES[mv];
    for (let i = 0; i <= 12; i++) for (const yaw of [-30, 90, 180]) assert.ok(!bad(B.frame(busy, B.poseAt(mv, (m.dur * i) / 12, i * 0.4), { yaw })), mv + " " + i);
    const end = B.poseAt(mv, m.dur + 0.01, 0); ["lSh", "rSh", "pos"].forEach((j) => end[j].forEach((v, n) => assert.ok(Math.abs(v - (B.poseAt("", 0, 0)[j][n])) < 1e-9, mv + " ends at rest")));
    assert.ok(B.svg(busy, { pose: mv }).startsWith("<svg"));
}
// The legs are solved from the feet: bones keep their length and planted feet stay where they are while the body sways.
for (let t = 0; t < 8; t += 0.37) for (const mv of ["", "wave", "oops"]) {
    const P = B.poseAt(mv, t % 2, t), k = B.skeleton(P);
    for (const sd of ["l", "r"]) {
        const th = Math.hypot(...k.P[sd + "Hp"].map((v, n) => v - k.P[sd + "Kn"][n])), sh = Math.hypot(...k.P[sd + "Kn"].map((v, n) => v - k.P[sd + "An"][n]));
        assert.ok(Math.abs(th - B.BONES.thigh) < 1e-6 && Math.abs(sh - B.BONES.shin) < 1e-6, "bone lengths");
        const off = Math.hypot(...k.P[sd + "An"].map((v, n) => v - P[sd + "Ft"][n]));
        assert.ok(off < 0.35, "planted foot moved " + off.toFixed(2));
    }
}
assert.equal(B.needText({ xp: 300 }), "300 XP"); assert.equal(B.needText({ lv: 2 }), "Level 2"); assert.equal(B.needText({ badge: "steady" }), "Steady Hand badge");
// Badge names match the profile badges.
PC.BADGES.forEach(([k, n]) => assert.equal(B.BADGE_NAMES[k], n));
// The profile keeps the look and gives it back.
const g = PC.newGain("Ava R."); g.lk = jacket; const r = PC.applyGain(null, g, "2026-11-20");
assert.equal(r.kid.lk, jacket); assert.equal(PC.summary(r.kid).lk, jacket);
const g2 = PC.newGain("Ava R."); g2.lk = "<bad>"; assert.equal(PC.applyGain(r.kid, g2, "2026-11-21").kid.lk, jacket);
console.log("buddy tests passed");
