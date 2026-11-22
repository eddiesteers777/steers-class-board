/* ==========================================
   Anchor Board — what the data says, for planning (Plan the Week).
   Reads the same private documents Student Progress reads (Class Data sets, Vault Raid and assignment effort,
   review game results, the roster) and the Standards marks, and turns them into one short list per class:
     reteach   standards marked Reteach on the Standards page or in Student Progress
     below     standards where the class's latest scores are under the cut: how many students, how far under
     lastWeek  the standards last week's bellringers and plan actually covered
   Counts only. No student name ever leaves this file, so the brief Claude reads stays free of names.
   Nothing is stored: the evidence is worked out on the page each time, like Student Progress.
========================================== */
import { buildProgress, distribution, stdIn } from "./progress.js?v=3";

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Watch every document the evidence needs. onChange(docs) fires (debounced) whenever something arrives.
 * docs: { rosters, imports: [], details: [], results: [], ready }
 */
export function watchEvidence(store, onChange) {
    const D = { rosters: {}, imports: new Map(), details: new Map(), results: [], idx: false, pidx: false };
    let t = 0; const soon = () => { clearTimeout(t); t = setTimeout(() => onChange(snapshot()), 80); };
    const snapshot = () => ({
        rosters: D.rosters, results: D.results,
        imports: [...D.imports.values()].filter(Boolean), details: [...D.details.values()].filter(Boolean),
        ready: D.idx && D.pidx && ![...D.imports.values()].some((x) => x === null)
    });
    const once = (path, fn) => { let done = false, un = null; un = store.watch(path, (s) => { if (done || s.pending) return; done = true; fn(s.exists ? s.data : null); if (un) setTimeout(un, 0); }, () => { if (!done) { done = true; fn(null); } }); };
    store.watch("rosters/all", (s) => { if (s.pending) return; D.rosters = (s.exists && s.data && s.data.periods) || {}; soon(); }, () => {});
    store.watch("games/results", (s) => { if (s.pending) return; D.results = ((s.exists && s.data && s.data.list) || []).filter((r) => r && r.id); soon(); }, () => {});
    store.watch("data/index", (s) => {
        if (s.pending) return; D.idx = true;
        ((s.exists && s.data && s.data.imports) || []).forEach((m) => { if (m && m.id && !D.imports.has(m.id)) { D.imports.set(m.id, null); once("data/i_" + m.id, (d) => { D.imports.set(m.id, d && d.rows ? d : false); soon(); }); } });
        soon();
    }, () => { D.idx = true; soon(); });
    store.watch("progress/index", (s) => {
        if (s.pending) return; D.pidx = true;
        ((s.exists && s.data && s.data.games) || []).slice(-400).forEach((m) => { if (m && m.id && !D.details.has(m.id)) { D.details.set(m.id, null); once("progress/g_" + m.id, (d) => { D.details.set(m.id, d || false); soon(); }); } });
        soon();
    }, () => { D.pidx = true; soon(); });
}

/** The standards a week covered for one class: every code on its bellringers, notes and quiz items. */
export function weekStandards(week, cls) {
    const c = week && week.classes && week.classes[cls]; if (!c) return [];
    const out = new Set(), add = (x) => { if (x && x.std) String(x.std).split(/[,;\s]+/).filter(Boolean).forEach((s) => out.add(s)); };
    (c.days || []).forEach((d) => { (d.problems || []).forEach(add); });
    ((c.quiz && c.quiz.items) || []).forEach(add);
    return [...out];
}

/**
 * One class's evidence. docs from watchEvidence; C = STANDARDS[cls]; periods = the class's periods;
 * marks = standards/progress[cls]; cut = 0..1.
 * Returns { reteach: [code], below: [{ code, n, low, avg }], scored, sets, students }.
 */
export function classEvidence(docs, C, periods, marks, cut = 0.7) {
    const codes = new Set((C && C.standards || []).map((s) => s.code));
    const reteach = Object.entries(marks || {}).filter(([code, m]) => m && m.s === "reteach" && codes.has(code)).map(([code]) => code);
    const imports = docs.imports || [], vrIds = new Set(imports.filter((i) => i.source === "Vault Raid" || i.source === "Assignment").map((i) => String(i.id).replace(/^vr/, "")));
    const details = (docs.details || []).map((g) => Object.assign({}, g, { vr: vrIds.has(g.id), qs: (g.qs || []).map((q) => Object.assign({}, q, { std: q.std || stdIn(q.c, codes) })) }));
    const per = new Map(); let students = 0, sets = 0;
    periods.forEach((p) => {
        const roster = ((docs.rosters || {})[p] || []).map((n) => String(n).slice(0, 60));
        const P = buildProgress({ roster, codes, imports, results: docs.results || [], details, tally: [], period: p, cut });
        students += P.students.filter((r) => r.stds.length).length; sets += P.sets.length;
        distribution(P.students, [...codes], cut).forEach((d) => {
            const o = per.get(d.code) || { code: d.code, n: 0, low: 0, sum: 0 };
            o.n += d.n; o.low += d.low.length; o.sum += (d.avg || 0) * d.n; per.set(d.code, o);
        });
    });
    const all = [...per.values()].map((o) => ({ code: o.code, n: o.n, low: o.low, avg: o.n ? o.sum / o.n : null }));
    const below = all.filter((o) => o.n >= 2 && (o.avg < cut || o.low / o.n >= 1 / 3))
        .sort((a, b) => b.low / b.n - a.low / a.n || a.avg - b.avg).slice(0, 6);
    return { reteach, below, scored: all.length, sets, students };
}

/** The evidence as it goes into the brief: counts and standard wording only, never a name. */
export function evidenceForBrief(ev, stdOf, cut, lastWeekStds) {
    if (!ev) return null;
    const words = (code) => { const s = stdOf(code); return s ? s.text : ""; };
    return {
        cut: Math.round(cut * 100),
        reteach: ev.reteach.map((code) => ({ code, text: words(code) })),
        below: ev.below.map((x) => ({ code: x.code, text: words(x.code), studentsScored: x.n, studentsBelow: x.low, classAverage: x.avg == null ? null : Math.round(x.avg * 100) })),
        lastWeekStandards: lastWeekStds || [],
        note: ev.scored ? "From Class Data, Vault Raid and assignment scores on Anchor Board." : "No scores on Anchor Board yet for this class."
    };
}

export { mean };
