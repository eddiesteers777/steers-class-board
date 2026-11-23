// Foundational ladder: every problem re-solved here from its own text, independently of foundBank.js.
// node tools/acap/found.test.mjs
import * as FB from "../../js/foundBank.js";
import { sameAnswer } from "../../js/vaultCore.js";
import assert from "node:assert/strict";
const toJs = (s) => s.replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/(\d)\{(\d+)\/(\d+)\}/g, "($1+$2/$3)").replace(/\{(\d+)\/(\d+)\}/g, "($1/$2)").replace(/\{x\/(\d+)\}/g, "(x/$1)").replace(/(\d)x/g, "$1*x");
const val = (s) => Function("return (" + toJs(s) + ")")();
const near = (a, b) => Math.abs(a - b) < 1e-9;
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
