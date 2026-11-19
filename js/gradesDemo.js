/* ==========================================
   Anchor Board — made-up sample data for grades.html?demo.
   Every name and score here is invented. It goes only into the page's this-tab store
   (js/localStore.js) and is never saved anywhere.
========================================== */
const NAMES = ["Avery B.", "Jordan C.", "Riley D.", "Mason E.", "Harper F.", "Logan G.", "Quinn H.", "Parker J.", "Rowan K.", "Skyler L.", "Emerson M.", "Reese N.", "Dakota P.", "Finley S."];
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const r2 = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100) / 100;

export async function seedDemo(store) {
    const per = { "1st": NAMES, "2nd": NAMES.slice(0, 10), "5th": NAMES.slice(3), "6th": NAMES.slice(2, 12) };
    await store.save("rosters/all", { periods: per });
    const lvl = NAMES.map((_, i) => 0.55 + rnd() * 0.4 - (i === 6 ? 0.25 : 0));
    const at = (d) => new Date(d + "T15:00:00").getTime();

    // Assignments: a test with corrections, and a practice set (still waiting to be added).
    const testRows = [], pracRows = [];
    Object.entries(per).forEach(([p, names]) => names.forEach((nm, ni) => {
        const L = lvl[NAMES.indexOf(nm)], g = r2(L - 0.05 + (rnd() - 0.5) * 0.2), started = !(p === "1st" && ni === 9);
        const fx = g < 0.8 && rnd() > 0.3 ? r2(g + (1 - g) * 0.5 * (0.6 + rnd() * 0.4)) : null;
        testRows.push({ key: p + "|#" + ni, per: p, ni, nm, g: started ? g : 0, c: started ? 1 : 0, s: started ? 1 : 0, after: null, fx: started ? fx : null });
        const pg = r2(L + 0.1 + rnd() * 0.1), pc = r2(Math.min(1, pg + 0.15 + rnd() * 0.2));
        pracRows.push({ key: p + "|#" + ni, per: p, ni, nm, g: pg, c: pc, s: ni % 7 === 5 ? 0 : 1 });
    }));
    const t1 = { id: "dt1", title: "Unit 4 Test: Linear equations", type: "test", cls: "8th", periods: ["1st", "2nd", "5th", "6th"], status: "closed", at: at("2026-11-06"), opened: at("2026-11-06"), skills: [],
        res: { n: testRows.length, started: testRows.filter((r) => r.s).length, rows: testRows } };
    const p1 = { id: "dp1", title: "Slope and rate of change practice", type: "practice", cls: "8th", periods: ["1st", "2nd", "5th", "6th"], status: "open", at: at("2026-11-17"), opened: at("2026-11-17"), skills: [],
        res: { n: pracRows.length, started: pracRows.filter((r) => r.s).length, rows: pracRows } };
    await store.save("asg/a_dt1", t1); await store.save("asg/a_dp1", p1);
    await store.save("asg/index", { list: [t1, p1].map((d) => ({ id: d.id, title: d.title, type: d.type, cls: d.cls, periods: d.periods, status: d.status, at: d.at, n: 4 })), at: Date.now() });

    // Class Data: a DeltaMath set and a Magma Math quiz per period, tagged with standards.
    const index = [];
    const sets = [["DeltaMath 4.2: Solving equations", "2026-11-03", "DeltaMath", "8.11", ["Q1", "Q2", "Q3", "Q4", "Q5"]], ["Magma Math Quiz 5", "2026-11-12", "Magma Math", "8.12", ["Q1", "Q2", "Q3", "Q4"]], ["DeltaMath 4.4: Slope", "2026-10-22", "DeltaMath", "8.10", ["Q1", "Q2", "Q3"]]];
    for (const [title, date, source, std, items] of sets) for (const [p, names] of Object.entries(per)) {
        const id = "dd" + index.length;
        const rows = names.map((nm) => ({ s: nm, v: items.map(() => (rnd() < lvl[NAMES.indexOf(nm)] ? 1 : 0)) }));
        await store.save("data/i_" + id, { id, title, date, source, std, skill: "", period: p, items, rows, at: at(date) });
        index.push({ id, title, date, source, std, period: p, n: rows.length, items: items.length, at: at(date) });
    }
    await store.save("data/index", { imports: index, at: Date.now() });

    // The gradebook: two columns already linked, one homework typed in, one paper quiz.
    const hw = { id: "dh1", title: "HW 14: Two-step equations", date: "2026-11-10", cat: "hw", pts: 10, periods: ["1st", "2nd", "5th", "6th"], src: { k: "hand" }, std: "", off: false, at: at("2026-11-10") };
    const quiz = { id: "dh2", title: "Paper quiz: Slope", date: "2026-11-16", cat: "qt", pts: 20, periods: ["1st", "2nd", "5th", "6th"], src: { k: "hand" }, std: "", off: false, at: at("2026-11-16") };
    const items = [
        { id: "adt1", title: t1.title, date: "2026-11-06", cat: "qt", pts: 100, periods: t1.periods, src: { k: "asg", id: "dt1" }, std: "", off: false, at: at("2026-11-06") },
        { id: "ddm", title: "DeltaMath 4.2: Solving equations", date: "2026-11-03", cat: "cw", pts: 100, periods: Object.keys(per), src: { k: "data", ids: Object.fromEntries(index.filter((m) => m.title.startsWith("DeltaMath 4.2")).map((m) => [m.period, m.id])) }, std: "", off: false, at: at("2026-11-03") },
        hw, quiz,
    ];
    const sc = { hw: {}, quiz: {} };
    Object.entries(per).forEach(([p, names]) => names.forEach((nm, ni) => {
        const L = lvl[NAMES.indexOf(nm)];
        if (ni === 4) sc.hw[p + "|" + nm] = { p: null, x: "m" }; else if (ni === 11) sc.hw[p + "|" + nm] = { p: null, x: "ex" }; else sc.hw[p + "|" + nm] = { p: Math.round(Math.min(10, 5 + L * 6)) };
        if (ni !== 8) sc.quiz[p + "|" + nm] = { p: Math.round(20 * r2(L + (rnd() - 0.5) * 0.2)) };   // one blank: not entered yet
    }));
    await store.save("gb/s_dh1", { sc: sc.hw, at: Date.now() }); await store.save("gb/s_dh2", { sc: sc.quiz, at: Date.now() });
    await store.save("gb/items", { list: items, skip: [], at: Date.now() });
}
