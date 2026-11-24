// Every walkthrough's rows as plain text, for tools/walk/check_display.py (an independent check in Python).
import { walkFor } from "../../js/walk.js";
// A plain-math reading of what is written, independent of the engine's own numbers: stacked fractions become
// ((a)/(b)), a whole number then a fraction is a mixed number, |…| is Abs(…), raised numbers are powers.
function toPy(d) {
    if (d == null) return "";
    if (typeof d === "string") return d.replace(/\u2212/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/✓/g, "").replace(/\$/g, "");
    if (d.f) return "((" + toPy(d.f[0]) + ")/(" + toPy(d.f[1]) + "))";
    if (d.sup) return "**(" + toPy(d.sup) + ")";
    const kids = (d.r || []).filter((x) => x !== "");
    if (kids.length >= 2 && kids[0] === "|" && kids[kids.length - 1] === "|") return "Abs(" + kids.slice(1, -1).map(toPy).join("") + ")";
    let out = "";
    kids.forEach((x) => {
        let y = x; while (y && typeof y === "object" && y.r && y.r.filter((z) => z !== "").length === 1) y = y.r.find((z) => z !== "");
        const t = toPy(x);
        const m = out.match(/(\d+)\s*$/);
        if (y && typeof y === "object" && y.f && m && !/[.\d]\.\d*$/.test(out)) out = out.slice(0, m.index) + "(" + m[1] + "+" + t + ")";
        else out += t;
    });
    return out;
}
import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const setups = (await import(path.join(ROOT, "data/stdbank/walk.js"))).default;
const out = [];
for (const f of ["g7", "g8", "alg1"]) {
    const m = (await import(path.join(ROOT, "data/stdbank", f + ".js"))).default;
    for (const it of m.items) {
        const w = walkFor(Object.assign({}, it, setups[it.id] ? { walk: setups[it.id] } : {}));
        if (!w.ok) continue;
        const rows = [];
        w.steps.forEach((s, si) => s.seq.forEach((x) => { if (x.a === "row" && (x.row.t === "line")) rows.push({ step: si + 1, move: s.move, check: x.row.c === "w-check", chain: !!x.row.chain, cells: x.row.cells.map((c) => (c == null ? "" : toPy(c))) }); }));
        out.push({ id: it.id, q: it.q, a: it.a, rows });
    }
}
process.stdout.write(JSON.stringify(out));
