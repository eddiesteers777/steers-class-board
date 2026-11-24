// Foundational ladder: every problem re-solved here from its own text, independently of foundBank.js.
// node tools/acap/found.test.mjs
import * as FB from "../../js/foundBank.js";
import { sameAnswer } from "../../js/vaultCore.js";
import assert from "node:assert/strict";
const toJs = (s) => s.replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/(\d)\{(\d+)\/(\d+)\}/g, "($1+$2/$3)").replace(/\{(\d+)\/(\d+)\}/g, "($1/$2)").replace(/\{x\/(\d+)\}/g, "(x/$1)").replace(/(\d)x/g, "$1*x");
const val = (s) => Function("return (" + toJs(s) + ")")();
const near = (a, b) => Math.abs(a - b) < 1e-9;
const pt = (s) => s.replace(/[()]/g, "").split(", ").map(val);
// Shape facts, written out separately from foundBank.js.
const POLY = { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8 };
const box = { faces: 6, edges: 12, vertices: 8 };
const SOLID = { cube: box, "rectangular prism": box, "triangular prism": { faces: 5, edges: 9, vertices: 6 }, "square pyramid": { faces: 5, edges: 8, vertices: 5 }, "triangular pyramid": { faces: 4, edges: 6, vertices: 4 } };
let n = 0;
for (const step of FB.LADDER) {
    const ps = FB.problemsFor(step.id);
    assert.ok(ps.length >= 25, step.id + " has " + ps.length);
    assert.ok(ps.some((p) => p.lvl === 1) && ps.some((p) => p.lvl === 2), step.id + " has both levels");
    for (const p of ps) {
        let m, ok;
        if ((m = /^Find: (.+)$/.exec(p.q))) ok = near(val(m[1]), val(p.a));
        else if ((m = /^Write \{(\d+)\/(\d+)\} in simplest form\.$/.exec(p.q))) { ok = near(+m[1] / +m[2], val(p.a)); const f = /\{(\d+)\/(\d+)\}/.exec(p.a); const g = (a, b) => (b ? g(b, a % b) : a); if (f) ok = ok && g(+f[1], +f[2]) === 1; }
        else if ((m = /^Fill in the missing number: \{(\d+)\/(\d+)\} = \{\?\/(\d+)\}$/.exec(p.q))) ok = near(+m[1] / +m[2], +p.a / +m[3]);
        else if ((m = /^What is \|(.+)\|\?$/.exec(p.q))) ok = near(Math.abs(val(m[1])), val(p.a));
        else if ((m = /^Which is greater: (.+) or (.+)\?$/.exec(p.q))) ok = near(Math.max(val(m[1]), val(m[2])), val(p.a)) && !near(val(m[1]), val(m[2]));
        else if ((m = /^Solve: (.+) = (.+)$/.exec(p.q))) { const x = val(p.a.replace(/^x = /, "")); ok = near(Function("x", "return " + toJs(m[1]))(x), val(m[2])); }
        else if ((m = /^Find (\d+)% of (\d+)\.$/.exec(p.q))) ok = near((+m[1] * +m[2]) / 100, val(p.a));
        // The floor steps added 2026-11-23 (coordinates, tables, substitution, data, shapes).
        else if ((m = /^In which quadrant is the point \((.+), (.+)\)\?$/.exec(p.q))) { const x = val(m[1]), y = val(m[2]); ok = p.a === (x > 0 ? (y > 0 ? "I" : "IV") : (y > 0 ? "II" : "III")); }
        else if ((m = /^Start at the origin\. Move (\d+) units (right|left) and (\d+) units (up|down)\. What point are you on\?$/.exec(p.q))) { const pa = pt(p.a); ok = pa[0] === (m[2] === "right" ? 1 : -1) * m[1] && pa[1] === (m[4] === "up" ? 1 : -1) * m[3]; }
        else if ((m = /^Reflect the point \((.+), (.+)\) over the ([xy])-axis\. What is the new point\?$/.exec(p.q))) { const x = val(m[1]), y = val(m[2]), pa = pt(p.a); ok = m[3] === "x" ? pa[0] === x && pa[1] === -y : pa[0] === -x && pa[1] === y; }
        else if ((m = /^How far apart are the points \((.+), (.+)\) and \((.+), (.+)\)\?$/.exec(p.q))) ok = val(m[1]) === val(m[3]) && near(Math.abs(val(m[2]) - val(m[4])), val(p.a)) && val(p.a) > 0;
        else if ((m = /^The rule is output = (\d+) × input(?: ([+−]) (\d+))?\. What is the output when the input is (.+)\?$/.exec(p.q))) ok = near(+m[1] * val(m[4]) + (m[2] ? (m[2] === "+" ? 1 : -1) * m[3] : 0), val(p.a));
        else if ((m = /^The rule is output = (\d+) × input(?: ([+−]) (\d+))?\. What input gives an output of (.+)\?$/.exec(p.q))) ok = near(+m[1] * val(p.a) + (m[2] ? (m[2] === "+" ? 1 : -1) * m[3] : 0), val(m[4]));
        else if ((m = /^Inputs ([\d, ]+) give outputs (.+)\. What is the output for input (\d+)\?$/.exec(p.q))) { const xs = m[1].split(", ").map(Number), ys = m[2].split(", ").map(val), sl = (ys[1] - ys[0]) / (xs[1] - xs[0]); ok = ys.every((y, i) => near(y, ys[0] + sl * (xs[i] - xs[0]))) && near(ys[0] + sl * (+m[3] - xs[0]), val(p.a)); }
        else if ((m = /^If y = (.+), what is y when x = (.+)\?$/.exec(p.q))) ok = near(Function("x", "return " + toJs(m[1]))(val(m[2])), val(p.a));
        else if ((m = /^Is (.+) a solution of (.+) = (.+)\? Answer yes or no\.$/.exec(p.q))) { const lhs = Function("x", "return " + toJs(m[2]).replace(/(\d)\(/g, "$1*("))(val(m[1])); ok = p.a === (near(lhs, val(m[3])) ? "Yes" : "No"); }
        else if ((m = /^Find the (range|median|mean) of the data: (.+)$/.exec(p.q))) { const xs = m[2].split(", ").map(Number).sort((a, b) => a - b), n = xs.length; const want = m[1] === "range" ? xs[n - 1] - xs[0] : m[1] === "mean" ? xs.reduce((a, b) => a + b, 0) / n : n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2; ok = near(want, val(p.a)); }
        else if ((m = /^A polygon has (\d+) sides\. What is it called\?$/.exec(p.q))) ok = POLY[p.a] === +m[1];
        else if ((m = /^How many (vertices|angles|faces|edges) does an? (.+) have\?$/.exec(p.q))) ok = (POLY[m[2]] ? (m[1] === "vertices" || m[1] === "angles" ? POLY[m[2]] : NaN) : SOLID[m[2]][m[1]]) === +p.a;
        else assert.fail("no checker for: " + p.q);
        assert.ok(ok, step.id + ": " + p.q + " = " + p.a);
        assert.ok(sameAnswer(p.a, p.a, []), "the game checker reads " + p.a);
        n++;
    }
}
// Typed forms students use are accepted.
assert.ok(sameAnswer("-7", "−7", [])); assert.ok(sameAnswer("3/4", "{3/4}", [])); assert.ok(sameAnswer("4", "x = 4", []));
assert.ok(FB.foundBank().every((x) => FB.isFoundational(x.std) && !/^[78]\./.test(x.std)));
console.log("foundational: " + n + " problems re-solved, all right");

// The track: placement, ladder, current step, no double assignment.
const FT = await import("../../js/foundational.js");
let doc = FT.place(null, "Cam T.", "F:intAdd", 1);
assert.deepEqual(FT.placedNames(doc), ["Cam T."]);
const trail = new Map([["F:intAdd", { h: "11111111", days: new Set(["2026-11-30", "2026-12-01"]) }]]);
const rec = { stds: [{ code: "F:intAdd", latest: 0.9, n: 3 }, { code: "F:intSub", latest: 0.4, n: 1 }] };
const L = FT.ladderOf(FT.placementOf(doc, "Cam T."), rec, trail);
assert.equal(L.steps.find((s) => s.id === "F:intAdd").state, "secure");
assert.equal(L.current.id, "F:intSub", "moves up only after Secure");
assert.equal(L.steps.find((s) => s.id === "F:mul").before, true);
const L2 = FT.ladderOf(FT.placementOf(doc, "Cam T."), { stds: [{ code: "F:intAdd", latest: 0.95, n: 3 }] }, new Map());
assert.equal(L2.current.id, "F:intAdd", "80%+ without the lock stays on the step");
assert.ok(FT.openFor([{ fnd: "F:intSub", status: "open", only: { per: "2nd", nm: "Cam T." }, code: "1" }], "2nd", "Cam T.", "F:intSub"));
doc = FT.unplace(doc, "Cam T.", 2); assert.deepEqual(FT.placedNames(doc), []);
const AA = await import("../../js/acapAssign.js");
const def = AA.makeDef({ cls: "8th", per: "2nd", nm: "Cam T.", code: "F:intAdd", text: "Add integers", pool: FB.problemsFor("F:intAdd"), fnd: true });
assert.equal(def.title, "Building blocks: Add integers"); assert.equal(def.fnd, "F:intAdd"); assert.equal(AA.indexEntry(def).fnd, "F:intAdd");
console.log("foundational track: all checks passed");
