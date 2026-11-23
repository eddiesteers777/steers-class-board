/* ==========================================
   Anchor Board — assignment results to Student Progress, from any teacher page.
   The Assignments page (js/assignPage.js) used to be the only place that copied students' attempts into Class Data and
   the effort records, so a check or a Work on next practice reached Readiness only while that page was open.
   Now Student Progress runs the same copy when it opens (catchUp), for open assignments whose attempts changed.

   io = { save(path, data) -> Promise, get(path) -> Promise<data | null> } (paths under teacher/{uid}).
========================================== */
import * as C from "./assignCore.js?v=7";
import { namesOnly } from "./acapAssign.js?v=4";
import { shortNames } from "./vaultCore.js?v=75";

/** The name lists an assignment shows: one student's line for a one-student assignment, else each period's roster. */
export const namesFor = (rosters, d) => (d && d.only ? namesOnly((rosters || {})[d.only.per] || [], d.only)
    : Object.fromEntries((d.periods || []).map((p) => [p, shortNames(((rosters || {})[p] || []).filter(Boolean))])));
/** What changed in the attempts (the copy is skipped when this matches the last one sent). */
export const sigOf = (rows) => JSON.stringify(rows.map((r) => [r.key, r.grade, r.complete, (r.lg || []).length, Object.keys(r.ans || {}).length, r.withFix]));

/** Copy one assignment's scored rows to Class Data + effort records, and its summary onto the assignment. Returns d. */
export async function sendToProgress(io, d, rows, rosters) {
    const pers = (d.periods || []).filter((p) => rows.some((r) => r.per === p && r.started));
    const ixD = await io.get("data/index"), ixP = await io.get("progress/index");
    let imports = ((ixD && ixD.imports) || []), games = ((ixP && ixP.games) || []);
    for (const p of pers) {
        const { imp, det } = C.toProgress(d, p, rows, ((rosters || {})[p] || []).filter(Boolean));
        if (imp && imp.rows.length) { await io.save("data/i_" + imp.id, imp); imports = imports.filter((x) => x && x.id !== imp.id).concat([{ id: imp.id, title: imp.title, std: "", skill: "", date: imp.date, source: "Assignment", period: p, n: imp.rows.length, items: imp.items.length }]); }
        if (det.st.length) { await io.save("progress/g_" + det.id, det); games = games.filter((x) => x && x.id !== det.id).concat([{ id: det.id, date: det.date, period: p, title: det.title, n: det.st.length }]).slice(-2000); }
    }
    await io.save("data/index", { imports, at: Date.now() });
    await io.save("progress/index", { games, at: Date.now() });
    // A small summary on the assignment itself, for the list and the grade table.
    const started = rows.filter((r) => r.started);
    d.res = { n: rows.length, started: started.length, done: C.isTest(d.type) ? rows.filter((r) => r.done).length : started.filter((r) => r.grade >= 1).length,
        avg: started.length ? started.reduce((s, r) => s + r.grade, 0) / started.length : null, at: Date.now(), sig: sigOf(rows),
        rows: rows.map((r) => ({ key: r.key, per: r.per, ni: r.ni, nm: r.nm, g: Math.round(r.grade * 1e4) / 1e4, c: Math.round(r.complete * 1e4) / 1e4, s: r.started ? 1 : 0, after: r.after != null ? Math.round(r.after * 1e4) / 1e4 : null, fx: r.withFix != null ? Math.round(r.withFix * 1e4) / 1e4 : null })) };
    await io.save("asg/a_" + d.id, JSON.parse(JSON.stringify(d)));
    return d;
}

/**
 * Student Progress opening: bring every open assignment (opened in the last `days` days, not corrections) up to date.
 * index: the asg/index list; entriesOf(code) -> Promise<[attempts]> (asg/{code}/p). Returns how many were copied.
 * A test with corrections, or a correction itself, is left to the Assignments page (it joins the two).
 */
export async function catchUp(io, index, rosters, entriesOf, { days = 21, now = Date.now() } = {}) {
    const open = (index || []).filter((m) => m && m.code && m.status === "open" && m.type !== "fix" && now - (m.opened || m.at || 0) < days * 864e5);
    let n = 0;
    for (const m of open) {
        try {
            const d = await io.get("asg/a_" + m.id); if (!d || d.removed || d.fixId || !d.skills) continue;
            const list = await entriesOf(m.code); if (!list || !list.length) continue;
            const rows = C.scoreRows(d, C.joinEntries(list, namesFor(rosters, d)));
            if (d.res && d.res.sig === sigOf(rows)) continue;
            await sendToProgress(io, d, rows, rosters); n++;
        } catch (e) { /* tried again next time the page opens */ }
    }
    return n;
}
