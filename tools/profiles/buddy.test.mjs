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
B.PARTS.forEach(([k, , list]) => list.forEach((_, i) => { const s = B.stringify(Object.assign(B.parse(""), { [k]: i })); assert.equal(B.cleanLook(s, all), s); assert.ok(B.svg(s, { move: "dance" }).includes("bd-dance")); }));
assert.equal(B.needText({ xp: 300 }), "300 XP"); assert.equal(B.needText({ lv: 2 }), "Level 2"); assert.equal(B.needText({ badge: "steady" }), "Steady Hand badge");
// Badge names match the profile badges.
PC.BADGES.forEach(([k, n]) => assert.equal(B.BADGE_NAMES[k], n));
// The profile keeps the look and gives it back.
const g = PC.newGain("Ava R."); g.lk = jacket; const r = PC.applyGain(null, g, "2026-11-20");
assert.equal(r.kid.lk, jacket); assert.equal(PC.summary(r.kid).lk, jacket);
const g2 = PC.newGain("Ava R."); g2.lk = "<bad>"; assert.equal(PC.applyGain(r.kid, g2, "2026-11-21").kid.lk, jacket);
console.log("buddy tests passed");
