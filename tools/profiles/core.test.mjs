// Student profile rules: node tools/profiles/core.test.mjs
import assert from "node:assert/strict";
import * as P from "../../js/profileCore.js";

const names = ["Ava R.", "Ava Ro.", "Ben T.", "Cara L.", "Dev P."];
assert.equal(P.matchRoster("ben t", names), 2);
assert.equal(P.matchRoster("Ben T.", names), 2);
assert.equal(P.matchRoster("BenT", names), 2);
assert.equal(P.matchRoster("cara", names), 3);          // only one Cara
assert.equal(P.matchRoster("ava", names), -1);          // two Avas: never guess
assert.equal(P.matchRoster("Dev Patel", names), 4);
assert.equal(P.matchRoster("Zed Q", names), -1);
assert.equal(P.kidKey("Ava R."), "ava-r");
assert.equal(P.kidKey("ava r"), P.kidKey("Ava R."));

assert.deepEqual(P.topicOf("AL 7.10a"), { k: "s-7-10", l: "7.10", std: "7.10" });
assert.equal(P.topicOf("AL Alg I.12").l, "Alg I.12");
assert.equal(P.topicOf("Solving equations").k, "k-solving-equations");
assert.ok(P.isEquationTopic(P.topicOf("AL 8.11b")));
assert.ok(!P.isEquationTopic(P.topicOf("AL 7.1")));
assert.equal(P.weekOf("2026-11-20"), "2026-W47");

// Vault Raid: first try counts for accuracy, a fix earns XP and coins.
const qs = [{ c: "AL 7.10a" }, { c: "AL 7.10b" }, { c: "Ratios" }];
const g1 = P.vaultGain({ nm: "Ava R.", c: 140, best: 3, lg: [{ i: 0, ok: 1 }, { i: 1, ok: 1 }, { i: 0, ok: 0, fx: 1 }, { i: 2, ok: 1 }, { i: 0, ok: 1 }] }, qs);
assert.equal(g1.n, 5); assert.equal(g1.r, 4); assert.equal(g1.fx, 1);
assert.equal(g1.xp, 4 * 10 + 6 + 5); assert.equal(g1.bank, 45);
assert.equal(g1.best.acc, 0);   // under 8 answers: no accuracy best

// One day is never enough to crack a lock.
let r = P.applyGain(null, g1, "2026-11-16");
assert.equal(r.kid.t["s-7-10"].a, 4); assert.equal(r.kid.t["s-7-10"].r, 3);
assert.equal(P.levelOf(r.kid), 0); assert.deepEqual(r.locks, []);
assert.equal(r.kid.g, 1); assert.equal(r.kid.bank, 45);
const nx = P.nextLock(r.kid); assert.equal(nx.l, "7.10"); assert.match(nx.left, /one more day/);

// A second day with more right answers cracks it (level 1, First Lock, +50 XP).
const g2 = P.vaultGain({ nm: "Ava R.", c: 60, best: 3, lg: [{ i: 0, ok: 1 }, { i: 1, ok: 1 }, { i: 0, ok: 1 }] }, qs);
const xpBefore = r.kid.xp;
r = P.applyGain(r.kid, g2, "2026-11-17");
assert.deepEqual(r.locks, ["7.10"]); assert.equal(P.levelOf(r.kid), 1);
assert.ok(r.badges.includes("lock1")); assert.equal(r.kid.xp, xpBefore + g2.xp + 50);
assert.equal(r.kid.best.c, 140);   // the personal best stays
// Locks never re-lock, even after misses.
r = P.applyGain(r.kid, P.vaultGain({ nm: "Ava R.", lg: Array.from({ length: 8 }, () => ({ i: 0, ok: 0 })) }, qs), "2026-11-18");
assert.equal(P.levelOf(r.kid), 1);
assert.ok(r.kid.xp > xpBefore);   // nothing is ever taken away

// Team games: only named members count, wrong teams get a try with no right.
const tg = P.teamGains([{ c: "AL 8.11a", w: [0], x: [0, 1] }, { c: "AL 8.11a", w: [0, 1], x: [0, 1] }, { c: "Old", ok: 1, of: 1 }],
    [{ m: ["Ava R.", "Ben T."] }, { m: ["Cara L.", "Nobody Here"] }, {}], (line) => (names.includes(line) ? line : ""));
assert.deepEqual(Object.keys(tg).sort(), ["Ava R.", "Ben T.", "Cara L."]);
assert.equal(tg["Ava R."].r, 2); assert.equal(tg["Cara L."].r, 1); assert.equal(tg["Cara L."].n, 2); assert.equal(tg["Ava R."].tr, 2);
assert.equal(tg["Ava R."].ans[0].team, 1);

// Whole-class games: capped participation, no topics.
const cg = P.classGain("Ben T.", 50); assert.equal(cg.xp, 20); assert.equal(cg.bank, 20); assert.equal(cg.ans.length, 0);

// Badges: Steady Hand needs 90%+ on 10 or more answers in one game.
const steady = P.vaultGain({ nm: "Dev P.", lg: Array.from({ length: 10 }, (_, i) => ({ i: 2, ok: i < 9 ? 1 : 0 })) }, qs);
assert.ok(P.applyGain(null, steady, "2026-11-16").badges.includes("steady"));
assert.equal(steady.best.acc, 90);

// Summary: coins to spend = bank - spent; avatars open with XP.
const s = P.summary(Object.assign({}, r.kid, { sp: 30 }));
assert.equal(s.coins, r.kid.bank - 30); assert.equal(s.lv, 1); assert.equal(s.sk, 2);
assert.equal(P.avatarsOpen(0), 8); assert.equal(P.avatarsOpen(1500), 16);
assert.equal(P.topicRows(r.kid)[0].m, "");   // not-yet-cracked topics first

console.log("profile core: all checks passed");
