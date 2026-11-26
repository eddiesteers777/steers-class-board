// node tools/courses/order.test.mjs — courses come out in grade level order (js/courseOrder.js), for any teacher's set.
import assert from "node:assert/strict";
import { gradeRank, byGrade } from "../../js/courseOrder.js";
import { STANDARDS } from "../../data/standards.js";
let n = 0; const ok = (name, fn) => { fn(); n++; };

ok("the bank's courses go 2nd to 8th, 8th Accelerated, then high school", () => {
    const labels = byGrade(Object.values(STANDARDS).map((c) => c.label));
    assert.deepEqual(labels, ["2nd Grade", "3rd Grade", "4th Grade", "5th Grade", "6th Grade", "7th Grade", "8th Grade", "8th Accelerated",
        "Geometry", "Algebra II", "Precalculus", "Math Modeling", "Finite Math"]);
});
ok("other ways of naming a grade read the same", () => {
    assert.equal(gradeRank("Grade 7"), 7); assert.equal(gradeRank("Math 6"), 6); assert.equal(gradeRank("seventh grade math"), 7);
    assert.equal(gradeRank("Kindergarten"), 0); assert.equal(gradeRank("10th Grade"), 10);
    assert.equal(gradeRank("Grade 8 Accelerated"), 8.5); assert.equal(gradeRank("Honors 7th"), 7.5);
});
ok("high school courses go in their usual order", () => {
    assert.deepEqual(byGrade(["AP Calculus AB", "Algebra II with Statistics", "Statistics", "Geometry with Data Analysis", "Algebra I", "Pre-Calculus", "Pre-Algebra", "6th Grade"]),
        ["6th Grade", "Pre-Algebra", "Algebra I", "Geometry with Data Analysis", "Algebra II with Statistics", "Pre-Calculus", "Statistics", "AP Calculus AB"]);
    assert.deepEqual(byGrade(["Integrated Math III", "Integrated Math I", "Integrated Math II"]), ["Integrated Math I", "Integrated Math II", "Integrated Math III"]);
});
ok("names it can't place keep their order and go last", () => {
    assert.deepEqual(byGrade(["Study Hall", "Math Lab", "5th Grade"]), ["5th Grade", "Study Hall", "Math Lab"]);
    assert.deepEqual(byGrade([["g", "Geometry"], ["s", "3rd Grade"]], (x) => x[1]).map((x) => x[0]), ["s", "g"]);
});
console.log("courses order: " + n + " checks passed");
