// Which question set Vault Raid opens on (js/vaultPick.js). Run: node tools/board/vaultpick.test.mjs. Made-up set titles only.
import assert from "node:assert/strict";
import { classOfTitle, setsFor, pickSet } from "../../js/vaultPick.js";
let n = 0; const t = (name, fn) => { fn(); n++; };
t("titles name their class", () => {
    assert.equal(classOfTitle("Week 5 Test Review, 8th Accelerated (33)"), "8th-acc");
    assert.equal(classOfTitle("Week 5 Review, 7th Grade (25)"), "7th");
    assert.equal(classOfTitle("Week 5 Review, 8th Grade"), "8th");
    assert.equal(classOfTitle("Algebra I systems"), "8th-acc");
    assert.equal(classOfTitle("Integers warm-up"), "");
});
// the Nov 23 audit case: the newest set is 8th Accelerated, saved for every class
const SETS = [
    { id: "acc", title: "Week 5 Test Review, 8th Accelerated (33)", per: [], at: 300 },
    { id: "g7", title: "Week 5 Review, 7th Grade (25)", per: [], at: 200 },
    { id: "g8", title: "Week 5 Review, 8th Grade", per: [], at: 100 },
    { id: "any", title: "Integers warm-up", per: [], at: 250 },
];
t("5th period (7th Grade) opens on the 7th Grade set, not the newest 8th Accelerated one", () => assert.equal(pickSet(SETS, "5th", "7th", ""), "g7"));
t("6th period (8th Accelerated) opens on its own set", () => assert.equal(pickSet(SETS, "6th", "8th-acc", ""), "acc"));
t("a set saved for the period beats a title match", () => assert.equal(pickSet(SETS.concat({ id: "p5", title: "Quiz prep", per: ["5th"], at: 10 }), "5th", "7th", ""), "p5"));
t("with no title match, a set naming no class beats another class's set", () => assert.equal(pickSet(SETS.filter((s) => s.id !== "g7"), "5th", "7th", ""), "any"));
t("the teacher's remembered pick for the period wins while it still exists", () => {
    assert.equal(pickSet(SETS, "5th", "7th", "acc"), "acc");
    assert.equal(pickSet(SETS, "5th", "7th", "gone"), "g7", "a deleted pick falls back to the default");
});
t("a set saved only for other periods is not offered", () => {
    const s = [{ id: "p1", title: "x", per: ["1st"], at: 9 }, { id: "all", title: "y", per: [], at: 1 }];
    assert.deepEqual(setsFor(s, "5th").map((x) => x.id), ["all"]);
    assert.equal(pickSet(s, "5th", "7th", "p1"), "all");
});
t("no sets, no pick", () => assert.equal(pickSet([], "5th", "7th", ""), ""));
console.log("vault pick: " + n + " checks passed");
