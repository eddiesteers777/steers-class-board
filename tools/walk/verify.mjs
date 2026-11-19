// Run every standards-bank problem through the walkthrough engine (js/walk.js) and report.
//   node tools/walk/verify.mjs            summary by standard
//   node tools/walk/verify.mjs 8.11       every problem for one standard, with each step's why
//   node tools/walk/verify.mjs --held     only problems the engine tried but held back (a check failed or the key disagreed)
// The engine checks each walkthrough itself (every line has the same answers or value as the first, checks come out true,
// the final answer matches the key). This script also re-checks the arithmetic in every "why" line that says a = b.
import { walkFor, dtText } from "../../js/walk.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2), only = args.find((a) => !a.startsWith("--")), heldOnly = args.includes("--held");
let setups = {};
try { setups = (await import(path.join(ROOT, "data/stdbank/walk.js"))).default; } catch (e) { /* none yet */ }
const files = ["g7", "g8", "alg1"];
let total = 0, ok = 0, held = 0;
const byStd = new Map(), problems = [];
for (const f of files) {
    const m = (await import(path.join(ROOT, "data/stdbank", f + ".js"))).default;
    for (const it of m.items) {
        const item = Object.assign({}, it, setups[it.id] ? { walk: setups[it.id] } : {});
        const w = walkFor(item);
        total++;
        const s = byStd.get(it.std) || { n: 0, ok: 0, held: 0 }; s.n++;
        if (w.ok) { ok++; s.ok++; }
        else if (/Held back/.test(w.why)) { held++; s.held++; }
        byStd.set(it.std, s);
        problems.push({ it, w });
    }
}
// re-check "a op b = c" arithmetic written in why lines (whole numbers and decimals)
const num = (t) => Number(String(t).replace(/−/g, "-"));
let whyErrs = 0;
for (const { it, w } of problems) {
    if (!w.ok) continue;
    for (const st of w.steps) {
        const re = /(?<![\d/.^])((?:\u2212?\d+(?:\.\d+)?)(?: [+\u2212×÷] \(?\u2212?\d+(?:\.\d+)?\)?)+) = (\u2212?\d+(?:\.\d+)?)(?![\d/.]| remainder)/g; let m;
        while ((m = re.exec(st.why))) {
            const expr = m[1].replace(/\u2212/g, "-").replace(/×/g, "*").replace(/÷/g, "/"), c = num(m[2]);
            const v = Function("return (" + expr + ")")();
            if (Math.abs(v - c) > 1e-9) { whyErrs++; console.log("WHY MATH?", it.id, "|", m[0], "| in:", st.why); }
        }
    }
}
if (only) {
    for (const { it, w } of problems.filter((p) => p.it.std === only || p.it.id === only)) {
        console.log("\n" + it.id, "|", it.q, "=>", it.a, "|", w.ok ? "OK " + w.steps.length + " steps" : w.why + (w.err ? " (" + w.err + ")" : ""));
        if (w.ok) w.steps.forEach((s, i) => {
            const rows = s.seq.filter((x) => x.a === "row").map((x) => x.row.t === "pic" ? "[" + x.row.pic.kind + "]" : x.row.t === "ans" ? "ANSWER " + dtText(x.row.dt) : (x.row.t === "op" ? "   op: " : "") + x.row.cells.map((c) => (c == null ? "" : dtText(c))).join(" ").trim());
            console.log("  " + (i + 1) + ". " + s.title + " — " + s.why + "\n       " + rows.join("\n       "));
        });
    }
} else if (heldOnly) {
    problems.filter((p) => !p.w.ok && /Held back/.test(p.w.why)).forEach(({ it, w }) => console.log(it.id, "|", it.q, "=>", it.a, "|", w.why, w.errs ? w.errs.join("; ") : ""));
} else {
    for (const [std, s] of byStd) if (s.ok || s.held) console.log(std.padEnd(9), String(s.ok).padStart(3) + "/" + String(s.n).padEnd(3), s.held ? "held back " + s.held : "");
    console.log("\nwalkthroughs:", ok, "of", total, "| held back:", held, "| why-line arithmetic errors:", whyErrs);
}
if (whyErrs) process.exitCode = 1;
