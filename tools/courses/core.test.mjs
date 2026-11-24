// node tools/courses/core.test.mjs — which standards each class follows (js/courseRules.js) and Next up staying as it was.
import assert from "node:assert/strict";
import { COURSES, guessCourse, okCourse, parseStandardsList, cleanLists, ownCourse, classesFor, listKey } from "../../js/courseRules.js";
import { STANDARDS } from "../../data/standards.js";
import { nextUp } from "../../js/standardsNext.js";
let n = 0; const ok = (name, fn) => { fn(); n++; };

ok("every built-in course points at a class in data/standards.js", () => {
    COURSES.filter((c) => c.std).forEach((c) => assert.ok(STANDARDS[c.std], c.id));
    assert.ok(okCourse("") && okCourse("own") && okCourse("al-7") && !okCourse("tx-6") && !okCourse(undefined));
});
ok("a class name gives a first guess, or none", () => {
    assert.equal(guessCourse("Math 7"), "al-7"); assert.equal(guessCourse("7th Grade"), "al-7");
    assert.equal(guessCourse("8th Grade Math"), "al-8"); assert.equal(guessCourse("8th Accelerated"), "al-8acc");
    assert.equal(guessCourse("Algebra I"), "al-8acc"); assert.equal(guessCourse("Math 6"), null); assert.equal(guessCourse("Pre-Algebra"), null); assert.equal(guessCourse("8th Pre-Algebra"), "al-8"); assert.equal(guessCourse(""), null);
});
ok("a pasted list reads codes, groups and plain lines", () => {
    const rows = parseStandardsList("Number Sense\n6.NS.1 Interpret quotients of fractions\n• MA.6.AR.1.1: Translate words into expressions\n\nGeometry\n6.G.1 - Find the area of triangles\nStudents will explain how they reached an answer.\n6.NS.1 repeated line\n");
    assert.deepEqual(rows.map((r) => r.code), ["6.NS.1", "MA.6.AR.1.1", "6.G.1", "4"]);
    assert.deepEqual(rows.map((r) => r.domain), ["Number Sense", "Number Sense", "Geometry", "Geometry"]);
    assert.equal(rows[1].text, "Translate words into expressions"); assert.equal(rows[2].text, "Find the area of triangles");
    assert.equal(parseStandardsList("").length, 0);
});
ok("saved lists are cleaned, and a bad document can't break the page", () => {
    assert.deepEqual(cleanLists(null), { v: 1, lists: {} }); assert.deepEqual(cleanLists({ lists: 5 }), { v: 1, lists: {} });
    const c = cleanLists({ lists: { "  Math 6 ": [{ code: "6.1", text: "A" }, { code: "6.1", text: "dup" }, { code: "", text: "x" }, 7] , empty: [] } });
    assert.deepEqual(Object.keys(c.lists), ["math 6"]); assert.equal(c.lists["math 6"].length, 1);
    const C = ownCourse("Math 6", c.lists["math 6"]);
    assert.equal(C.own, true); assert.deepEqual(C.units, []); assert.equal(C.standards[0].code, "6.1");
    assert.equal(nextUp("c1", {}, C), null);   // no district order, so no Next up panel
});
ok("a new teacher's classes come from setup, one per class name", () => {
    const periods = [["1st", "c1"], ["2nd", "c1"], ["3rd", "c2"], ["4th", "c3"]];
    const weeks = [{ classes: { c1: { label: "Math 7" }, c2: { label: "Math 6" }, c3: { label: "Pre-Algebra" } } }];
    const setup = { classes: [{ p: "1st", label: "Math 7", course: "al-7" }, { p: "2nd", label: "Math 7", course: "al-8" }, { p: "3rd", label: "Math 6", course: "own" }, { p: "4th", label: "Pre-Algebra", course: "" }] };
    assert.deepEqual(classesFor(periods, weeks, setup), [
        { id: "c1", label: "Math 7", course: "al-7", std: "7th", key: "math 7" },
        { id: "c2", label: "Math 6", course: "own", std: "", key: "math 6" },
        { id: "c3", label: "Pre-Algebra", course: "", std: "", key: listKey("Pre-Algebra") }
    ]);
    assert.deepEqual(classesFor([["1st", "demo"]], [{ classes: { demo: { label: "Sample class" } } }], null).map((c) => c.course), [""]);
});
ok("Next up for the Calera classes is unchanged", () => {
    for (const k of ["8th", "7th", "8th-acc"]) assert.deepEqual(nextUp(k, {}, STANDARDS[k]), nextUp(k, {}));
    assert.ok(nextUp("8th", {}).next.length > 0);
});
console.log("courses: " + n + " checks passed");
