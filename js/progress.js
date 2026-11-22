/* ==========================================
   Anchor Board — student progress (pure, no sign-in, no network).
   Joins what the site already saves into one record per student, keyed by the roster line
   (period + first name + last initial):
     teacher/{uid}/data/i_*            Class Data sets (scores 0..1 per student, per column)
     teacher/{uid}/games/results       one summary per finished review game (teams, winners)
     teacher/{uid}/progress/g_*        Vault Raid effort detail per game (written by js/liveRoom.js)
     teacher/{uid}/tally/{day}         the class tally (behaviour: kept apart from learning)
   The record is worked out on the page each time, not stored a second time, so it can never drift
   from the sources and it covers every game and import already saved.
   Names: the roster line is the only name shown. A pasted full name is matched to its roster line
   and then dropped; one that matches nothing is shortened to first name + last initial.
   Nothing here is normed: targets come from each student's own first scores on this site.
========================================== */

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const words = (s) => String(s || "").replace(/[^A-Za-zÀ-ɏ'\- .,#0-9]/g, " ").replace(/\s+/g, " ").trim();

/** "Rodriguez, Ava" / "Ava Maria Rodriguez" / "Ava R." -> { f: "ava", l: "rodriguez" } (lower case). */
function parts(name) {
    let s = words(name); if (!s) return null;
    if (s.includes(",")) { const [l, f] = s.split(/,(.*)/s).map((x) => x.trim()); s = (f || "").split(" ")[0] + " " + l; }
    const w = s.toLowerCase().split(" ").filter(Boolean);
    return { f: w[0] || "", l: w.length > 1 ? w[w.length - 1].replace(/\.$/, "") : "" };
}
/** First name + last initial, the only form a name ever takes outside the roster. */
export function shortName(name) {
    const p = parts(name); if (!p || !p.f) return "";
    const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
    return cap(p.f) + (p.l ? " " + p.l.charAt(0).toUpperCase() + "." : "");
}

/** Match any name (pasted full name, "#3" roster number, typed "Ava R", roster "Ava Ro.") to a roster index, or -1. */
export function matchRoster(name, roster) {
    const raw = String(name || "").trim();
    const num = /^#(\d+)$/.exec(raw); if (num) { const i = +num[1] - 1; return i >= 0 && i < roster.length ? i : -1; }
    const exact = roster.findIndex((r) => String(r).trim().toLowerCase() === raw.toLowerCase()); if (exact >= 0) return exact;
    const p = parts(raw); if (!p || !p.f) return -1;
    if (!p.l) { const same = roster.map((r, i) => [parts(r), i]).filter(([q]) => q && q.f === p.f); return same.length === 1 ? same[0][1] : -1; }   // a first name alone: only when one student has it
    let best = -1, bestLen = -1, ties = 0;
    roster.forEach((r, i) => {
        const q = parts(r); if (!q || q.f !== p.f) return;
        if (!q.l || !p.l || !p.l.startsWith(q.l) && !q.l.startsWith(p.l)) return;   // "Ro" matches "Rodriguez" and the other way round
        const len = Math.min(q.l.length, p.l.length);
        if (len > bestLen) { best = i; bestLen = len; ties = 0; } else if (len === bestLen) ties++;
    });
    return ties ? -1 : best;   // two equally good roster lines: don't guess
}

/** A standard code inside a category or column name: "AL 8.5b", "8.5", "Alg I.12". Only codes the class has. */
export function stdIn(text, codes) {
    const t = String(text || "");
    const m = t.match(/(Alg\s*I\.\d+|\b\d{1,2}\.\d{1,2})(?=[a-z]?\b)/i); if (!m) return "";
    const code = m[1].replace(/^alg\s*i/i, "Alg I").replace(/\s+/g, " ");
    return codes.has(code) ? code : "";
}

const day = (x) => String(x || "").slice(0, 10);
export const bandOf = (v, cut) => (v == null ? "" : v < cut ? "low" : v < Math.min(1, cut + 0.15) ? "mid" : "ok");
export const BAND_WORD = { low: "Not yet", mid: "Getting there", ok: "Has it" };

/** Decode one answer from a progress game doc: "qi:o:t:h" (o 1 right, 2 fixed after a miss, 0 missed; t seconds; h steps used). */
export function lgOf(s) { const [i, o, t, h] = String(s).split(":").map((x) => +x || 0); return { i, o, t, h }; }

/**
 * Build every record for one period.
 * input: { roster: ["Ava R.", …], codes: Set of standard codes, imports: [], results: [], details: [], tally: [{ day, periods }], period, cut }
 * Returns { students: [record], sets: [{ id, title, date }], details (this period, oldest first), unmatched: n }.
 */
export function buildProgress(input) {
    const { roster = [], codes = new Set(), period, cut = 0.7 } = input;
    const blank = (s, i) => ({ s, i, onRoster: i >= 0, sets: [], std: new Map(), games: { played: 0, wins: 0, last: "" },
        effort: { games: 0, tries: 0, right: 0, missed: 0, fixed: 0, steps: 0, secs: [], mins: 0, redo: 0, redoOk: 0, exit: 0, exitOk: 0, perGame: [] },
        behavior: { p: 0, t: 0, r: 0, days: 0 }, lastSolve: "", lastSeen: "" });
    const recs = roster.map((s, i) => blank(s, i)), extra = new Map();
    const recOf = (name) => {
        const i = matchRoster(name, roster); if (i >= 0) return recs[i];
        const sn = shortName(name); if (!sn) return null;
        if (!extra.has(sn)) extra.set(sn, blank(sn, -1));
        return extra.get(sn);
    };
    const seen = (r, d, solved) => { if (!d) return; if (d > r.lastSeen) r.lastSeen = d; if (solved && d > r.lastSolve) r.lastSolve = d; };
    const addStd = (r, code, d, v, title, w = 3) => { if (!code) return; if (!r.std.has(code)) r.std.set(code, []); r.std.get(code).push({ d, v, title, w }); };

    // 1. Class Data sets: one trajectory point per set (the mean of that student's columns), and per-standard points.
    const sets = [];
    (input.imports || []).filter((imp) => imp && imp.period === period && Array.isArray(imp.rows) && !imp.removed).forEach((imp) => {
        const d = day(imp.date) || (imp.at ? new Date(imp.at).toISOString().slice(0, 10) : ""), vr = imp.source === "Vault Raid" || imp.source === "Assignment" || imp.source === "Fact Blitz";   // these put the overall score first
        sets.push({ id: imp.id, title: imp.title, date: d });
        imp.rows.forEach((row) => {
            const r = recOf(row.s); if (!r) return;
            const vals = (row.v || []).map((v, k) => ({ v, k })).filter((x) => x.v != null && isFinite(x.v));
            if (!vals.length) return;
            const overall = vr ? (vals.find((x) => x.k === 0) || vals[0]).v : mean(vals.map((x) => x.v));
            r.sets.push({ id: imp.id, d, v: overall, title: imp.title, src: imp.source || "" });
            seen(r, d, overall > 0);
            vals.forEach(({ v, k }) => {
                if (vr && k === 0 && (imp.items || []).length > 1) return;   // "All questions" is the overall, the categories carry the standards
                const code = (imp.istd && imp.istd[k]) || imp.std || stdIn((imp.items || [])[k], codes) || (vr ? stdIn(imp.title, codes) : "");
                addStd(r, code, d, v, imp.title);
            });
        });
    });

    // 2. Review game summaries: games played and wins (team games have no per-student accuracy).
    (input.results || []).filter((g) => g && g.period === period).forEach((g) => {
        const win = g.win || [];
        (g.teams || []).forEach((t, ti) => (t.m || []).forEach((name) => {
            const r = recOf(name); if (!r) return;
            r.games.played++; if (win.includes(ti) && win.length < (g.teams || []).length) r.games.wins++;
            if (!r.games.last || g.date > r.games.last) r.games.last = g.date;
            seen(r, day(g.date), (t.ok || 0) > 0 || g.kind !== "vault");
        }));
    });

    // 3. Vault Raid detail: tries, fixes after a miss, steps, time, send-backs and exit tickets.
    const details = (input.details || []).filter((g) => g && g.period === period).sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.at || 0) - (b.at || 0));
    details.forEach((g) => {
        (g.st || []).forEach((x) => {
            const r = recOf(x.s); if (!r) return;
            const lg = (x.lg || []).map(lgOf), e = r.effort;
            const right = lg.filter((a) => a.o === 1).length, fixed = lg.filter((a) => a.o === 2).length, missed = lg.filter((a) => a.o !== 1).length;
            e.games++; e.tries += (+x.ta || lg.length); e.right += right; e.missed += missed; e.fixed += fixed; e.steps += lg.reduce((s, a) => s + a.h, 0);
            lg.forEach((a) => { if (a.t > 0 && a.t < 900) e.secs.push(a.t); });
            e.mins += +x.mins || 0;
            (x.rd || []).forEach((o) => { e.redo++; if (o) e.redoOk++; });
            if (x.ex) { e.exit += +x.ex.of || 0; e.exitOk += +x.ex.ok || 0; }
            e.perGame.push({ id: g.id, d: g.date, title: g.title, first: lg.length, right, fixed, missed, steps: lg.reduce((s, a) => s + a.h, 0), mins: +x.mins || 0 });
            seen(r, g.date, right + fixed > 0);
            // standards from the question categories, when the set came from the standards bank or names a code
            // (one point per standard per game: the share right on the first try), unless the same game is already a Class Data set
            if (!g.vr) { const per = new Map(); lg.forEach((a) => { const q = (g.qs || [])[a.i]; if (!q || !q.std) return; const c = per.get(q.std) || [0, 0]; c[1]++; if (a.o === 1) c[0]++; per.set(q.std, c); }); per.forEach(([ok, of], code) => addStd(r, code, g.date, ok / of, g.title, of)); }
        });
    });

    // 4. The class tally: behaviour, never mixed into learning or effort.
    (input.tally || []).forEach((t) => {
        const per = (t.periods || {})[period] || {};
        Object.keys(per).forEach((name) => { const r = recOf(name); if (!r) return; const m = per[name]; r.behavior.p += +m.p || 0; r.behavior.t += +m.t || 0; r.behavior.r += +m.r || 0; r.behavior.days++; seen(r, t.day, false); });
    });

    const all = recs.concat([...extra.values()]);
    all.forEach((r) => finish(r, cut));
    return { students: all, sets: sets.sort((a, b) => a.date.localeCompare(b.date)), details, unmatched: extra.size };
}

/** Baseline, two classroom targets and growth for one student, plus per-standard summaries. */
function finish(r, cut) {
    r.sets.sort((a, b) => a.d.localeCompare(b.d));
    const pts = r.sets.map((x) => x.v), n = pts.length;
    r.baseline = n ? mean(pts.slice(0, Math.min(2, n))) : null;
    r.current = n ? mean(pts.slice(-Math.min(3, n))) : null;
    r.avg = n ? mean(pts) : null;
    r.target = null;
    if (n >= 3) {
        // Targets close part of the gap between the student's own start and 100%: a third ("Typical"), two thirds ("Stretch").
        // They are classroom targets for this teacher's sets, not grade-level norms.
        const gap = 1 - r.baseline, typical = r.baseline + gap / 3, stretch = r.baseline + (2 * gap) / 3;
        const need = Math.max(0.01, typical - r.baseline), earned = Math.max(0, r.current - r.baseline);
        r.target = { typical, stretch, need: Math.round(need * 100), earned: Math.round(earned * 100), pct: Math.min(999, Math.round((100 * earned) / need)), top: r.baseline >= 0.95 };
    }
    r.stds = [...r.std.entries()].map(([code, list]) => {
        list.sort((a, b) => a.d.localeCompare(b.d));
        // "Latest" reads back from the newest score until it covers about 3 questions' worth (a set counts as 3,
        // a game counts as the questions answered), so one missed question in one game is never the whole story.
        let wsum = 0, vsum = 0; for (let k = list.length - 1; k >= 0 && wsum < 3; k--) { const w = list[k].w || 3; wsum += w; vsum += w * list[k].v; }
        const v = mean(list.map((x) => x.v)), latest = vsum / wsum;
        return { code, v, latest, first: list[0].v, n: list.length, band: bandOf(latest, cut), list };
    }).sort((a, b) => a.latest - b.latest);
    r.weak = r.stds.filter((x) => x.latest < cut);
    const e = r.effort;
    e.secAvg = e.secs.length ? Math.round(mean(e.secs)) : null;
    e.keptAt = e.missed ? e.fixed / e.missed : null;   // of the questions they missed, how many they came back and fixed
    // Showing up without working: seen recently, but nothing solved for a week or more.
    r.idle = !!(r.lastSeen && (!r.lastSolve || daysBetween(r.lastSolve, r.lastSeen) >= 7));
    r.excelling = n >= 3 && r.current >= Math.min(1, cut + 0.2) && !r.weak.length;
}
export function daysBetween(a, b) { const t = (s) => new Date(s + "T12:00:00").getTime(); return Math.round((t(b) - t(a)) / 864e5); }

/** Class view of one standard: how the students with data spread across the bands, plus each student's latest. */
export function distribution(students, codesInOrder, cut) {
    return codesInOrder.map((code) => {
        const got = students.map((r) => ({ s: r.s, x: r.stds.find((y) => y.code === code) })).filter((y) => y.x);
        const c = { low: 0, mid: 0, ok: 0 }; got.forEach((y) => { c[bandOf(y.x.latest, cut)]++; });
        return { code, n: got.length, c, avg: mean(got.map((y) => y.x.latest)), low: got.filter((y) => y.x.latest < cut).sort((a, b) => a.x.latest - b.x.latest).map((y) => ({ s: y.s, v: y.x.latest })) };
    }).filter((x) => x.n);
}

/** Class accuracy on each standard over time: [{ code, pts: [{ d, v, n }] }], one point per day it was scored. */
export function standardOverTime(students) {
    const map = new Map();
    students.forEach((r) => r.stds.forEach((x) => x.list.forEach((p) => {
        if (!map.has(x.code)) map.set(x.code, new Map()); const m = map.get(x.code);
        if (!m.has(p.d)) m.set(p.d, []); m.get(p.d).push(p.v);
    })));
    return [...map.entries()].map(([code, m]) => ({ code, pts: [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, vs]) => ({ d, v: mean(vs), n: vs.length })) }));
}

/**
 * Up to 5 small groups by shared need, plus one stretch group.
 * Each low student goes to the group of their weakest standard; the biggest needs get their own group,
 * and anyone left joins "Mixed needs". Groups list the most-missed question on that standard when one is known.
 */
export function needGroups(students, cut, ctx = {}) {
    const low = students.filter((r) => r.weak.length);
    const by = new Map();
    low.forEach((r) => { const w = r.weak[0]; if (!by.has(w.code)) by.set(w.code, []); by.get(w.code).push({ s: r.s, v: w.latest, also: r.weak.slice(1, 3).map((x) => x.code) }); });
    const ranked = [...by.entries()].sort((a, b) => b[1].length - a[1].length || mean(a[1].map((x) => x.v)) - mean(b[1].map((x) => x.v)));
    const groups = ranked.slice(0, 4).map(([code, who]) => ({ kind: "need", code, who: who.sort((a, b) => a.v - b.v), avg: mean(who.map((x) => x.v)), q: (ctx.missedOn || (() => null))(code) }));
    const rest = ranked.slice(4).flatMap(([code, who]) => who.map((x) => Object.assign({ code }, x)));
    if (rest.length) groups.push({ kind: "mixed", code: "", who: rest, avg: mean(rest.map((x) => x.v)) });
    const stretch = students.filter((r) => r.excelling).sort((a, b) => b.current - a.current).map((r) => ({ s: r.s, v: r.current }));
    if (stretch.length) groups.push({ kind: "stretch", code: "", who: stretch, avg: mean(stretch.map((x) => x.v)) });
    return groups;
}

/** The most-missed question on a standard across the Vault Raid detail, with its most common wrong answer. */
export function missedOn(details) {
    const by = new Map();
    details.forEach((g) => (g.qs || []).forEach((q) => {
        if (!q.std || !q.n || q.ok >= q.n) return;
        const cur = by.get(q.std), r = q.ok / q.n;
        if (!cur || r < cur.r) by.set(q.std, { r, q: q.q, a: q.a, w: (q.w || [])[0] || null, title: g.title, date: g.date });
    }));
    return (code) => by.get(code) || null;
}

/** Heatmap for one Vault Raid game: rows are students, columns are questions in the order the class met them. */
export function heatmap(g, roster) {
    const qs = (g.qs || []).map((q, i) => Object.assign({ i }, q)).filter((q) => q.n > 0);
    const rows = (g.st || []).map((x) => {
        const cells = new Map(); (x.lg || []).map(lgOf).forEach((a) => { if (!cells.has(a.i)) cells.set(a.i, a); });
        const i = matchRoster(x.s, roster);
        return { s: i >= 0 ? roster[i] : shortName(x.s), cells, right: [...cells.values()].filter((a) => a.o === 1).length, tried: cells.size };
    }).sort((a, b) => (a.tried ? a.right / a.tried : 2) - (b.tried ? b.right / b.tried : 2) || a.s.localeCompare(b.s));
    qs.sort((a, b) => a.ok / a.n - b.ok / b.n || b.n - a.n);
    return { qs, rows };
}

/** Engagement: last day seen (any game, set or tally) against last day they solved something. Biggest gap first. */
export function engagement(students) {
    return students.filter((r) => r.lastSeen).map((r) => ({ s: r.s, seen: r.lastSeen, solve: r.lastSolve, gap: r.lastSolve ? daysBetween(r.lastSolve, r.lastSeen) : null, idle: r.idle }))
        .sort((a, b) => (b.gap == null ? 999 : b.gap) - (a.gap == null ? 999 : a.gap) || a.s.localeCompare(b.s));
}

/** One simple class number: questions tried per week in student games, over the last 4 weeks with any games. */
export function fidelity(details, students) {
    const weeks = new Map();
    details.forEach((g) => { const d = new Date(g.date + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const k = d.toISOString().slice(0, 10); const w = weeks.get(k) || { wk: k, tries: 0, games: 0, kids: new Set() }; w.games++; (g.st || []).forEach((x) => { w.tries += +x.ta || (x.lg || []).length; w.kids.add(x.s); }); weeks.set(k, w); });
    const list = [...weeks.values()].sort((a, b) => a.wk.localeCompare(b.wk)).slice(-4).map((w) => ({ wk: w.wk, games: w.games, tries: w.tries, kids: w.kids.size, per: w.kids.size ? Math.round(w.tries / w.kids.size) : 0 }));
    return { weeks: list, rosterN: students.filter((r) => r.onRoster).length };
}

/** What the student sees: their own progress in their own words. No other student, no ranks, nothing that goes down. */
export function studentSummary(r, cut, stdText = () => "") {
    const e = r.effort, got = r.stds.filter((x) => x.latest >= cut), work = r.stds.filter((x) => x.latest < cut);
    let streak = 0; [...r.sets].reverse().some((x) => { if (x.v >= cut) { streak++; return false; } return true; });
    return {
        name: r.s,
        lines: [
            r.games.played || e.games ? "You've played " + Math.max(r.games.played, e.games) + (Math.max(r.games.played, e.games) === 1 ? " game" : " games") + (e.tries ? " and tried " + e.tries + " questions" : "") + "." : "",
            e.fixed ? "You came back and fixed " + e.fixed + (e.fixed === 1 ? " question" : " questions") + " after a miss. That's how math gets learned." : "",
            r.sets.length ? "You've finished " + r.sets.length + (r.sets.length === 1 ? " scored activity" : " scored activities") + " this year." : "",
            streak >= 2 ? "You're on a streak: your last " + streak + " were at " + Math.round(cut * 100) + "% or better." : "",
            r.target && r.target.earned > 0 ? "Since your first scores you've grown " + r.target.earned + " points. Your goal is " + r.target.need + " points." : "",
        ].filter(Boolean),
        got: got.map((x) => ({ code: x.code, text: stdText(x.code) })),
        work: work.map((x) => ({ code: x.code, text: stdText(x.code) })),
        goal: r.target ? { earned: r.target.earned, need: r.target.need } : null,
    };
}
