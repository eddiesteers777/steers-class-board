// Checks data/stdExamples.js: every example belongs to a real standard and is complete. Run: node tools/timeline/examples.test.mjs
import { STANDARDS } from "../../data/standards.js";
import { STD_EXAMPLES } from "../../data/stdExamples.js";
let bad = 0; const fail = (m) => { bad++; console.error("✗ " + m); };
const known = new Set(Object.values(STANDARDS).flatMap((C) => C.standards.map((s) => s.code)));
const TYPES = ["transversal", "mapping", "machine", "table", "area", "bar", "tape", "line"];
for (const [code, e] of Object.entries(STD_EXAMPLES)) {
    if (!known.has(code)) fail(code + ": not a standard code");
    for (const k of ["skill", "plain", "problem"]) if (!e[k] || typeof e[k] !== "string") fail(code + ": missing " + k);
    if (!Array.isArray(e.steps) || !e.steps.length) fail(code + ": no steps");
    (e.steps || []).forEach((s, i) => { if (!s.say) fail(code + " step " + (i + 1) + ": no words"); });
    const c = e.check;
    if (!c || !c.q || !Array.isArray(c.options) || c.options.length < 2 || !(c.right >= 0 && c.right < c.options.length) || !c.why) fail(code + ": check is incomplete");
    if (e.visual && !TYPES.includes(e.visual.type)) fail(code + ": unknown picture " + e.visual.type);
    if (e.visual && e.visual.at != null && e.visual.at > e.steps.length) fail(code + ": picture waits for a step that never comes");
    const txt = JSON.stringify(e);
    if (/\d-\d|\(-|\s-\d|= -/.test(txt)) fail(code + ": uses a hyphen for minus");
}
// each class has at least one example at a standard in its course
for (const [cls, C] of Object.entries(STANDARDS).filter(([, c]) => c.units.length)) {   // timeline classes only, not the g2..g6 bank grades
    const n = C.standards.filter((s) => STD_EXAMPLES[s.code]).length;
    if (!n) fail(cls + ": no examples yet");
}
console.log(bad ? bad + " problem(s)" : "✓ " + Object.keys(STD_EXAMPLES).length + " examples check out");
process.exit(bad ? 1 : 0);
