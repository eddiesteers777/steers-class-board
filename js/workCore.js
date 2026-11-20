/* ==========================================
   Anchor Board — Student Work archive: the rules, with no page, no sign-in and no network
   (tested in Node: tools/work/core.test.mjs). Used by work.html (js/workPage.js).

   A stack is one scanned PDF (or a pile of photos) for one class period. It is cut into papers,
   a paper is pages [from, to) that belong to one student, and each paper is matched to the roster.
   Papers are filed by their date: school year › nine weeks › week (Week 0 is the week a nine weeks
   starts in, the way the Plan and Library number weeks).
========================================== */

export const KEY = "Answer key";
export const SAME = "+ previous";   // "this is one more page of the paper before"
export const SKIP = "Not a paper";  // a blank or cover sheet: dropped

const pad = (n) => ("0" + n).slice(-2);
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const mondayOf = (s) => { const w = parse(s).getDay(); return addDays(s, w === 0 ? -6 : 1 - w); };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 16-20" or "Nov 30-Dec 4" for the school days Monday to Friday of a week. */
export function weekRange(monday) {
    const a = parse(monday), b = parse(addDays(monday, 4));
    return MON[a.getMonth()] + " " + a.getDate() + "-" + (a.getMonth() === b.getMonth() ? "" : MON[b.getMonth()] + " ") + b.getDate();
}

/** The nine weeks a date belongs to. Days between terms (breaks) count with the term just ended. */
export function termOf(date, nineWeeks) {
    if (!date || !nineWeeks || !nineWeeks.length) return 0;
    let n = nineWeeks[0].n;
    for (const t of nineWeeks) if (date >= t.start) n = t.n;
    return n;
}

/**
 * Where a date files: { q, n, monday, label, range, key }.
 * isSchoolDay(date) says whether students are in school; weeks with no school days are not counted.
 */
export function fileOf(date, nineWeeks, isSchoolDay) {
    if (!parse(date)) return { q: 0, n: 0, monday: "", label: "No date", range: "", key: "0-none" };
    const q = termOf(date, nineWeeks), t = nineWeeks.find((x) => x.n === q), monday = mondayOf(date);
    const school = (m) => [0, 1, 2, 3, 4].some((i) => isSchoolDay(addDays(m, i)));
    let n = 0; if (t) for (let m = mondayOf(t.start); m < monday; m = addDays(m, 7)) if (school(m)) n++;
    return { q, n, monday, label: "Week " + n, range: weekRange(monday), key: q + "-" + monday };
}

/** Cut `pages` pages into papers of `per` pages each: [[from, to)]. A short last paper keeps what is left. */
export function cut(pages, per) {
    per = Math.max(1, Math.floor(per) || 1); const out = [];
    for (let i = 0; i < pages; i += per) out.push([i, Math.min(pages, i + per)]);
    return out;
}

/** A first guess at pages per student: the whole number of pages that best fits the roster. */
export function guessPer(pages, rosterSize) {
    if (!rosterSize || pages <= rosterSize) return 1;
    for (const per of [2, 3, 4, 1]) if (pages % per === 0 && pages / per <= rosterSize && pages / per >= rosterSize * 0.6) return per;
    return Math.max(1, Math.round(pages / rosterSize));
}

/**
 * Names for papers in stack order.
 *   count    number of papers
 *   roster   the period's names, in roster order
 *   picks    { paperIndex: name } the teacher set by hand (a name, KEY, SAME or SKIP, or "" for "who is this?")
 *   order    "roster": papers not picked take the next roster name after the paper before them;
 *            "mixed":  papers not picked stay "" (the teacher picks each)
 *   keyFirst the first paper is the answer key
 * Returns [{ name, picked, guess }]: guess is true for a roster-order guess the teacher has not looked at.
 */
export function matchNames(count, roster, picks = {}, order = "roster", keyFirst = false) {
    const out = [], used = new Set(Object.values(picks).filter((v) => v && v !== KEY && v !== SAME && v !== SKIP));
    let next = 0;   // where the roster pointer stands
    for (let i = 0; i < count; i++) {
        if (Object.prototype.hasOwnProperty.call(picks, i)) {
            const v = picks[i]; out.push({ name: v, picked: true, guess: false });
            const at = roster.indexOf(v); if (at >= 0) next = at + 1;
            continue;
        }
        if (i === 0 && keyFirst) { out.push({ name: KEY, picked: false, guess: false }); continue; }
        if (order !== "roster") { out.push({ name: "", picked: false, guess: false }); continue; }
        while (next < roster.length && used.has(roster[next])) next++;
        if (next < roster.length) { out.push({ name: roster[next], picked: false, guess: true }); used.add(roster[next]); next++; }
        else out.push({ name: "", picked: false, guess: false });
    }
    return out;
}

/**
 * Turn papers + names into the pages to save: [{ page, s }] (page = index in the stack).
 * SAME joins a paper to the one before it; SKIP drops it.
 */
export function pagesFor(papers, names) {
    const out = []; let last = "";
    papers.forEach(([a, b], i) => {
        let s = (names[i] && names[i].name) || "";
        if (s === SKIP) return;
        if (s === SAME) s = last;
        for (let p = a; p < b; p++) out.push({ page: p, s });
        last = s;
    });
    return out;
}

/** Roster names with no paper. */
export function missing(roster, names) {
    const got = new Set(names.map((n) => n.name));
    return roster.filter((r) => !got.has(r));
}

/** Names given to more than one paper (SAME, KEY and SKIP aside). */
export function doubles(names) {
    const seen = new Map();
    names.forEach((n) => { if (n.name && n.name !== KEY && n.name !== SAME && n.name !== SKIP) seen.set(n.name, (seen.get(n.name) || 0) + 1); });
    return [...seen].filter(([, c]) => c > 1).map(([n]) => n);
}

/**
 * The archive tree for one period: [{ q, weeks: [{ key, n, label, range, monday, sets: [...] }] }],
 * nine weeks in order, weeks newest first, sets newest first.
 */
export function tree(sets, nineWeeks, isSchoolDay) {
    const byQ = new Map();
    sets.forEach((m) => {
        const f = fileOf(m.date, nineWeeks, isSchoolDay);
        if (!byQ.has(f.q)) byQ.set(f.q, new Map());
        const weeks = byQ.get(f.q);
        if (!weeks.has(f.key)) weeks.set(f.key, { ...f, sets: [] });
        weeks.get(f.key).sets.push(m);
    });
    return [...byQ].sort((a, b) => a[0] - b[0]).map(([q, weeks]) => ({
        q, weeks: [...weeks.values()].sort((a, b) => b.monday.localeCompare(a.monday))
            .map((w) => ({ ...w, sets: w.sets.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.at || 0) - (a.at || 0)) }))
    }));
}

/**
 * One student's folder: weeks newest first, each with the papers they turned in and the
 * assignments of their period with no paper from them. sets are full set docs (with pages).
 * [{ key, label, range, q, items: [{ set, pages: [page refs], missing }] }]
 */
export function folder(name, sets, nineWeeks, isSchoolDay) {
    const weeks = new Map();
    sets.forEach((set) => {
        const pages = (set.pages || []).filter((p) => p.s === name);
        if (!pages.length && set.kind === "kept") return;   // a kept-only paper they did not turn in is not "missing"
        const f = fileOf(set.date, nineWeeks, isSchoolDay);
        if (!weeks.has(f.key)) weeks.set(f.key, { ...f, items: [] });
        weeks.get(f.key).items.push({ set, pages, missing: !pages.length });
    });
    return [...weeks.values()].sort((a, b) => b.monday.localeCompare(a.monday))
        .map((w) => ({ ...w, items: w.items.sort((a, b) => String(b.set.date).localeCompare(String(a.set.date))) }));
}

/** Split a long list into parts of at most `size` (for PDFs a Chromebook can make). */
export function parts(list, size) {
    const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

/** About how many more school weeks of scans fit, from what has been used so far. */
export function weeksLeft(usedBytes, freeBytes, weeksSoFar) {
    if (!weeksSoFar || usedBytes <= 0) return null;
    const perWeek = usedBytes / weeksSoFar;
    return Math.max(0, Math.floor((freeBytes - usedBytes) / perWeek));
}

/** "Chloe D." -> "CD" */
export function initials(name) {
    const w = String(name || "").replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
    return ((w[0] || "?")[0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
}
