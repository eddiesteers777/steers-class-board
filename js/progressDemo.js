/* ==========================================
   Anchor Board — made-up sample data for progress.html?demo.
   Every name and score here is invented. It goes only into the page's this-tab store
   (js/localStore.js) and is never saved anywhere.
========================================== */
const NAMES = ["Avery B.", "Jordan C.", "Riley D.", "Mason E.", "Harper F.", "Logan G.", "Quinn H.", "Parker J.", "Rowan K.", "Skyler L.", "Emerson M.", "Reese N.", "Dakota P.", "Finley S.", "Kendall T.", "Sawyer W."];
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const clamp = (x) => Math.max(0, Math.min(1, x));
const iso = (d) => d.toISOString().slice(0, 10);

export function demoData() {
    // Each student: a starting level, a growth per set, and a weak standard.
    const kid = NAMES.map((s, i) => ({ s, base: 0.35 + rnd() * 0.5, grow: (rnd() - 0.2) * 0.06, weak: ["8.5", "8.6", "8.3", "8.11"][i % 4], idle: i === 9 }));
    kid[3].base = 0.9; kid[3].grow = 0.01; kid[7].base = 0.88; kid[12].base = 0.3; kid[12].grow = 0.07;
    const codes = ["8.1", "8.2", "8.4", "8.3", "8.5", "8.6", "8.11"], start = new Date("2026-09-14T12:00:00");
    const imports = [], index = [];
    for (let k = 0; k < 8; k++) {
        const d = new Date(start); d.setDate(d.getDate() + k * 9);
        const code = codes[Math.min(codes.length - 1, Math.floor(k * codes.length / 8))], id = "demo" + k;
        const items = ["Q1-4", "Q5-8"];
        const rows = kid.map((c) => {
            const lvl = clamp(c.base + c.grow * k - (c.weak === code ? 0.22 : 0));
            return { s: k === 2 && c.s.startsWith("Jordan") ? "Jordan Carter" : c.s, v: items.map(() => (c.idle && k > 5 ? null : clamp(lvl + (rnd() - 0.5) * 0.2))) };
        }).filter((r) => r.v.some((x) => x != null));
        const imp = { id, title: ["Exit ticket", "Quiz", "DeltaMath", "Magma Math"][k % 4] + " · " + code, std: code, skill: "", date: iso(d), source: "Sample", period: "1st", items, rows, at: d.getTime() };
        imports.push(imp); index.push({ id, title: imp.title, std: code, date: imp.date, period: "1st", n: rows.length, items: 2 });
    }
    // Vault Raid games with the effort detail, last two weeks.
    // [question, answer, category, a likely wrong answer]
    const qsBase = [["Write 0.00045 in scientific notation", "4.5 × 10⁻⁴", "AL 8.5", "4.5 × 10⁴"], ["(3 × 10⁴)(2 × 10³)", "6 × 10⁷", "AL 8.6", "6 × 10¹²"], ["Simplify 2³ · 2⁴", "2⁷", "AL 8.3", "2¹²"], ["Solve 3x + 7 = 22", "x = 5", "AL 8.11", "x = 9.67"],
        ["Is √50 between 7 and 8?", "yes", "AL 8.2", "no"], ["Which is bigger: 3.1 × 10⁵ or 9.8 × 10⁴?", "3.1 × 10⁵", "AL 8.5", "9.8 × 10⁴"], ["(8 × 10⁶) ÷ (2 × 10²)", "4 × 10⁴", "AL 8.6", "4 × 10³"], ["Solve 2(x − 3) = 10", "x = 8", "AL 8.11", "x = 6.5"]];
    const details = [], results = [], pindex = [];
    [["2026-11-10", "Week 4 Review"], ["2026-11-13", "Sci notation sprint"], ["2026-11-18", "Week 5 Review"]].forEach(([date, title], gi) => {
        const id = "dg" + gi, qst = qsBase.map(() => ({ n: 0, ok: 0, w: new Map() }));
        const st = kid.map((c) => {
            if (c.idle && gi >= 1) return { s: c.s, ta: 2, r: 0, n: 1, best: 0, cr: 0, mins: 0.4, lg: ["0:0:4:0"], rd: [], ex: null };
            const lg = [], nQ = 5 + Math.floor(rnd() * 4);
            let ta = 0;
            for (let j = 0; j < nQ; j++) {
                const qi = (j + gi) % qsBase.length, code = qsBase[qi][2].slice(3), lvl = clamp(c.base + c.grow * (6 + gi) - (c.weak === code ? 0.3 : 0));
                const ok = rnd() < lvl, fixed = !ok && rnd() < 0.55, steps = ok ? 0 : Math.floor(rnd() * 3);
                ta += ok ? 1 : fixed ? 2 + steps : 1 + steps; qst[qi].n++; if (ok) qst[qi].ok++;
                else if (rnd() < 0.7) { const w = qsBase[qi][3]; qst[qi].w.set(w, (qst[qi].w.get(w) || 0) + 1); }
                lg.push(qi + ":" + (ok ? 1 : fixed ? 2 : 0) + ":" + Math.round(20 + rnd() * 70) + ":" + steps);
            }
            const right = lg.filter((x) => x.split(":")[1] === "1").length;
            return { s: c.s, ta, r: right, n: lg.length, best: 2, cr: Math.floor(rnd() * 2), mins: Math.round((4 + rnd() * 5) * 10) / 10, lg, rd: gi === 2 ? [rnd() < 0.7 ? 1 : 0] : [], ex: gi === 2 ? { ok: Math.floor(rnd() * 4), of: 3 } : null };
        });
        const qs = qsBase.map(([q, a, c], i) => ({ q, a, c, n: qst[i].n, ok: qst[i].ok, w: [...qst[i].w.entries()].map(([y, n]) => ({ y, n })).sort((x, y) => y.n - x.n).slice(0, 3) }));
        details.push({ id, date, at: Date.parse(date), period: "1st", game: "Vault Raid", title, qs, st });
        pindex.push({ id, date, period: "1st", title, n: st.length });
        const order = st.slice().sort((a, b) => b.r - a.r);
        results.push({ id, date, at: Date.parse(date), period: "1st", kind: "vault", game: "Vault Raid", title, teams: order.map((x) => ({ n: x.s, s: x.r * 10, m: [x.s], ok: x.r, of: x.n })), win: [0], cats: [], bonus: {} });
    });
    const tally = { day: "2026-11-17", periods: { "1st": { "Avery B.": { p: 2, t: 1, r: 0 }, "Skyler L.": { p: 0, t: 0, r: 2 }, "Mason E.": { p: 3, t: 1, r: 0 } } } };
    const progress = { "8th": { "8.3": { s: "taught" }, "8.5": { s: "taught" }, "8.6": { s: "teaching" }, "8.11": { s: "reteach" } } };
    return { roster: NAMES, imports, index, results, details, pindex, tally, progress };
}

/** Put the sample into the this-tab store under the same paths the real page reads. */
export async function seedDemo(store) {
    const d = demoData();
    await store.save("rosters/all", { periods: { "1st": d.roster } });
    await store.save("data/index", { imports: d.index });
    for (const imp of d.imports) await store.save("data/i_" + imp.id, imp);
    await store.save("games/results", { list: d.results });
    await store.save("progress/index", { games: d.pindex });
    for (const g of d.details) await store.save("progress/g_" + g.id, g);
    await store.save("tally/" + d.tally.day, d.tally);
    await store.save("standards/progress", d.progress);
}
