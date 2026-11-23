/* ==========================================
   Anchor Board — Grades: the rules, with no page, no sign-in and no network (tested in Node:
   tools/grades/core.test.mjs). Used by grades.html (js/gradesPage.js).

   A grade item is one column in the gradebook. Its scores come from one of three places:
     asg    an Assignment (js/assignCore.js): grade = points earned, complete = how much was tried,
            test corrections show as before → after (70% → 85%)
     data   a Class Data set per period (Magma Math, DeltaMath, Wayground, Blooket, scanned papers, Vault Raid)
     hand   typed in here (paper quizzes, homework checks)
   A score typed here for a linked item overrides that one student's linked score, and says so.

   Grade and complete are two numbers and stay two numbers. Tries, misses and time never lower a grade.

   Names: every score is keyed by the period's roster line (first name + last initial). No full names,
   no student IDs, no dates of birth, ever. Nothing here is student-visible.

   Saved (private, teacher/{uid}/…, no rules change):
     gb/setup     { cats: [{ id, name, w }], scale: [[letter, min%]], missing: "zero" | "blank", at }
     gb/items     { list: [item], skip: [source keys the teacher chose not to grade], at }
     gb/s_<id>    { sc: { "<period>|<roster name>": { p: points | null, x: "" | "m" | "ex", n: note } }, at }
   item = { id, title, date "YYYY-MM-DD", cat, pts, periods: [], src: { k: "hand" } | { k: "asg", id } | { k: "data", ids: { period: importId } },
            std, off (true = shown but not counted), xc (true = extra credit: points earned add, points possible don't), at }
========================================== */
import { matchRoster } from "./progress.js?v=3";

/* Eddie's syllabus (2026-27) names these three categories and gives no percentages, so weights start blank.
   With no weights set, the grade is total points; once any weight is set, it is a weighted average. */
export const DEFAULT_SETUP = {
    cats: [{ id: "hw", name: "Homework", w: 0 }, { id: "cw", name: "Class Work", w: 0 }, { id: "qt", name: "Quizzes & Tests", w: 0 }],
    scale: [["A", 90], ["B", 80], ["C", 70], ["D", 60], ["F", 0]],
    missing: "zero",
};
export const FLAG = { m: "Missing", ex: "Excused" };
/** Points an extra-credit assignment is worth when it comes in (editable on the column). A starting guess, not Eddie's number yet. */
export const XC_PTS = 5;

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const day = (x) => String(x || "").slice(0, 10);
export const pct = (v, dp = 0) => (v == null || !isFinite(v) ? "–" : (Math.round(v * 100 * 10 ** dp) / 10 ** dp) + "%");
export const keyOf = (per, name) => per + "|" + name;

/** The setup with every field present and sane (weights 0..100, a scale sorted high to low that ends at 0). */
export function cleanSetup(s) {
    const src = s || {};
    const cats = (Array.isArray(src.cats) && src.cats.length ? src.cats : DEFAULT_SETUP.cats)
        .filter((c) => c && c.id && String(c.name || "").trim())
        .map((c) => ({ id: String(c.id).slice(0, 16), name: String(c.name).trim().slice(0, 40), w: Math.max(0, Math.min(100, +c.w || 0)) }));
    let scale = (Array.isArray(src.scale) && src.scale.length ? src.scale : DEFAULT_SETUP.scale)
        .filter((x) => Array.isArray(x) && String(x[0] || "").trim()).map(([l, m]) => [String(l).trim().slice(0, 3), Math.max(0, Math.min(100, +m || 0))])
        .sort((a, b) => b[1] - a[1]);
    if (!scale.length) scale = DEFAULT_SETUP.scale.slice();
    if (scale[scale.length - 1][1] !== 0) scale[scale.length - 1] = [scale[scale.length - 1][0], 0];
    return { cats: cats.length ? cats : DEFAULT_SETUP.cats.slice(), scale, missing: src.missing === "blank" ? "blank" : "zero" };
}
export const weighted = (setup) => setup.cats.some((c) => c.w > 0);
export const weightTotal = (setup) => setup.cats.reduce((s, c) => s + c.w, 0);

/** Letter for a 0..1 grade on the teacher's scale. */
export function letter(v, scale) {
    if (v == null || !isFinite(v)) return "";
    const p = Math.round(v * 1000) / 10;   // 89.95% rounds to 90.0 and earns the A, the way a printed report card shows it
    for (const [l, min] of scale) if (p >= min) return l;
    return scale[scale.length - 1][0];
}

/** Which nine weeks a date is in (SCHOOL_YEAR.nineWeeks). Dates between terms count with the term just ended. */
export function termOf(date, terms) {
    const d = day(date); if (!d || !terms || !terms.length) return 0;
    let n = terms[0].n;
    for (const t of terms) if (d >= t.start) n = t.n;
    return n;
}

/** A first guess at the category for something brought in: tests and quizzes, else class work. */
export function guessCat(src, setup) {
    const has = (id) => setup.cats.some((c) => c.id === id);
    const want = src.type === "quiz" || src.type === "test" || /\b(quiz|test|assessment|exam)\b/i.test(src.title || "") ? "qt" : /\bhomework|\bhw\b/i.test(src.title || "") ? "hw" : "cw";
    return has(want) ? want : setup.cats[0].id;
}

/**
 * Every score for one item in one period: Map roster index -> cell.
 * cell = { f: 0..1 | null (grade), c: 0..1 | null (complete), before: 0..1 | null (test score before corrections),
 *          x: "" | "m" | "ex", by: "asg" | "data" | "hand" | "", edited: true when a typed score replaced a linked one, n: note }
 * ctx = { asg: Map id -> assignment (with res.rows), imports: Map id -> Class Data set, hand: Map itemId -> gb/s_ doc }
 */
export function cellsFor(item, per, roster, ctx) {
    const out = new Map(), at = (i) => { if (!out.has(i)) out.set(i, { f: null, c: null, before: null, x: "", by: "", edited: false, n: "" }); return out.get(i); };
    const src = item.src || { k: "hand" };
    if (src.k === "asg") {
        const d = ctx.asg && ctx.asg.get(src.id);
        ((d && d.res && d.res.rows) || []).filter((r) => r && r.per === per && r.s).forEach((r) => {
            const i = r.ni >= 0 && r.ni < roster.length ? r.ni : matchRoster(r.nm, roster); if (i < 0) return;
            const cell = at(i), g = r.fx != null ? r.fx : r.g;
            cell.f = clamp01(+g || 0); cell.c = r.c == null ? null : clamp01(+r.c); cell.before = r.fx != null && r.fx > r.g ? clamp01(+r.g) : null; cell.by = "asg";
        });
    } else if (src.k === "data") {
        const imp = ctx.imports && ctx.imports.get((src.ids || {})[per]);
        if (imp && Array.isArray(imp.rows)) {
            const first = imp.source === "Vault Raid" || imp.source === "Assignment" || imp.source === "Fact Blitz";   // these put the overall score first
            imp.rows.forEach((row) => {
                const i = matchRoster(row.s, roster); if (i < 0) return;
                const vals = (row.v || []).filter((v) => v != null && isFinite(v)); if (!vals.length) return;
                const cell = at(i); cell.f = clamp01(first ? (row.v[0] != null ? row.v[0] : vals[0]) : mean(vals)); cell.by = "data";
            });
        }
    }
    const hand = ctx.hand && ctx.hand.get(item.id), sc = (hand && hand.sc) || {};
    Object.entries(sc).forEach(([k, h]) => {
        const bar = k.indexOf("|"); if (bar < 0 || k.slice(0, bar) !== per || !h) return;
        const name = k.slice(bar + 1), i = roster.indexOf(name) >= 0 ? roster.indexOf(name) : matchRoster(name, roster); if (i < 0) return;
        const cell = at(i), p = h.p == null || h.p === "" ? null : +h.p;
        if (p != null && isFinite(p)) { if (cell.by && cell.by !== "hand") cell.edited = true; cell.f = item.pts > 0 ? Math.max(0, p / item.pts) : null; cell.by = "hand"; cell.before = null; }
        if (h.x === "m" || h.x === "ex") cell.x = h.x;
        if (h.n) cell.n = String(h.n).slice(0, 200);
    });
    // A score that arrived wins over "missing": the work came in.
    out.forEach((cell) => { if (cell.x === "m" && cell.f != null) cell.x = ""; });
    return out;
}

/** What one cell adds to a grade: { earned, possible } in points, or null when it does not count. */
export function counts(cell, item, setup) {
    if (item.off || !(item.pts > 0)) return null;
    if (!cell) return null;
    if (cell.x === "ex") return null;
    if (item.xc) return cell.f != null ? { earned: cell.f * item.pts, possible: 0 } : null;   // extra credit: never a zero, never adds to possible
    if (cell.f != null) return { earned: cell.f * item.pts, possible: item.pts };
    if (cell.x === "m" && setup.missing === "zero") return { earned: 0, possible: item.pts };
    return null;   // not turned in / not entered yet: left out, never a silent zero
}

/**
 * One student's grade from a list of { item, cell }.
 * Total points when no weights are set. Weighted otherwise: each category is points earned / points possible,
 * and the weights of categories with nothing graded yet are shared out among the rest (the usual gradebook rule).
 */
export function gradeOf(list, setup) {
    const cats = setup.cats.map((c) => ({ id: c.id, name: c.name, w: c.w, earned: 0, possible: 0, n: 0, missing: 0 }));
    let earned = 0, possible = 0, missing = 0;
    list.forEach(({ item, cell }) => {
        if (cell && cell.x === "m" && cell.f == null && !item.off) missing++;
        const k = counts(cell, item, setup); if (!k) return;
        const c = cats.find((x) => x.id === item.cat) || cats[0];
        c.earned += k.earned; c.possible += k.possible; c.n++; if (cell.x === "m" && cell.f == null) c.missing++;
        earned += k.earned; possible += k.possible;
    });
    cats.forEach((c) => { c.v = c.possible > 0 ? c.earned / c.possible : null; });
    let v = null;
    if (weighted(setup)) {
        const used = cats.filter((c) => c.v != null && c.w > 0), wsum = used.reduce((s, c) => s + c.w, 0);
        v = wsum > 0 ? used.reduce((s, c) => s + c.w * c.v, 0) / wsum : null;
        cats.forEach((c) => { c.share = c.v != null && c.w > 0 && wsum > 0 ? c.w / wsum : 0; });
    } else {
        v = possible > 0 ? earned / possible : null;
        cats.forEach((c) => { c.share = possible > 0 ? c.possible / possible : 0; });
    }
    return { v, letter: letter(v, setup.scale), earned, possible, cats, missing, n: list.filter(({ item, cell }) => counts(cell, item, setup)).length };
}

/**
 * The grade table for one period and one term: newest column first (the way a teacher grades), one row per roster student.
 * Returns { cols: [{ item, avg, cAvg, n, blanks }], rows: [{ i, s, cells: [cell|null], grade }], avg, missing }.
 */
export function gradeTable(items, per, roster, ctx, setup, term, terms) {
    const mine = items.filter((it) => (it.periods || []).includes(per) && (!term || termOf(it.date, terms) === term))
        .sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0));
    const cellMaps = mine.map((it) => cellsFor(it, per, roster, ctx));
    const rows = roster.map((s, i) => {
        const cells = cellMaps.map((m) => m.get(i) || null);
        return { i, s, cells, grade: gradeOf(mine.map((item, k) => ({ item, cell: cells[k] })), setup) };
    });
    const cols = mine.map((item, k) => {
        const fs = rows.map((r) => r.cells[k]).filter((c) => c && c.f != null && c.x !== "ex");
        const cs = rows.map((r) => r.cells[k]).filter((c) => c && c.c != null && c.x !== "ex");
        const blanks = rows.filter((r) => { const c = r.cells[k]; return !c || (c.f == null && !c.x); }).length;
        return { item, avg: mean(fs.map((c) => c.f)), cAvg: cs.length ? mean(cs.map((c) => c.c)) : null, n: fs.length, blanks, missing: rows.filter((r) => r.cells[k] && r.cells[k].x === "m" && r.cells[k].f == null).length };
    });
    const graded = rows.filter((r) => r.grade.v != null);
    return { cols, rows, avg: mean(graded.map((r) => r.grade.v)), missing: rows.reduce((s, r) => s + r.grade.missing, 0) };
}

/** How a student's term grade moved: the running grade after each graded day, oldest first. */
export function trajectory(items, cellsOf, setup) {
    const dated = items.slice().sort((a, b) => a.date.localeCompare(b.date));
    const days = [...new Set(dated.filter((it) => counts(cellsOf(it), it, setup)).map((it) => it.date))];
    return days.map((d) => {
        const upto = dated.filter((it) => it.date <= d).map((item) => ({ item, cell: cellsOf(item) }));
        const g = gradeOf(upto, setup), today = dated.filter((it) => it.date === d && counts(cellsOf(it), it, setup));
        return { d, v: g.v, label: today.map((it) => it.title).join(", ") };
    }).filter((p) => p.v != null);
}

/** CSV for one period and term: points per item (M, EX for flags), then the term grade and letter. First name + last initial only. */
export function tableCsv(T, setup) {
    const q = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    const catName = (id) => (setup.cats.find((c) => c.id === id) || {}).name || "";
    const cols = T.cols.slice().reverse();   // oldest first in a spreadsheet, the way a grade book page reads
    const head = ["Student", "Term grade %", "Letter"].concat(cols.map((c) => c.item.title + " (" + c.item.date + ", " + catName(c.item.cat) + ", out of " + c.item.pts + (c.item.off ? ", not counted" : "") + ")"));
    const lines = [head.map(q).join(",")];
    T.rows.forEach((r) => {
        const cells = T.cols.map((c, k) => r.cells[k]).reverse();
        lines.push([q(r.s), r.grade.v == null ? "" : Math.round(r.grade.v * 1000) / 10, q(r.grade.letter)].concat(cells.map((c, k) => {
            if (!c) return ""; if (c.x === "ex") return "EX"; if (c.f == null) return c.x === "m" ? "M" : "";
            return Math.round(c.f * cols[k].item.pts * 100) / 100;
        })).join(","));
    });
    return lines.join("\n");
}

/* ---------- bringing scores in ---------- */
/** A stable key for a source, so a source added (or skipped) once is not offered again. */
export const srcKey = (src) => (src.k === "asg" ? "asg:" + src.id : src.k === "data" ? "data:" + Object.values(src.ids || {}).sort().join("+") : "");

/**
 * What could become a gradebook column and isn't one yet.
 * asgIndex: the Assignments list (asg/index); dataIndex: Class Data's list (data/index imports).
 * Class Data sets with the same title and date in different periods become one candidate (one column in each period).
 * Assignment results already reach Class Data as source "Assignment": those are offered once, as the assignment.
 */
export function candidates(asgIndex, dataIndex, items, skip, setup) {
    const have = new Set(items.map((it) => srcKey(it.src || {})).concat(skip || []));
    const linkedImp = new Set(items.filter((it) => it.src && it.src.k === "data").flatMap((it) => Object.values(it.src.ids || {})));
    const out = [];
    (asgIndex || []).filter((a) => a && a.id && a.status !== "draft" && a.type !== "fix").forEach((a) => {
        const src = { k: "asg", id: a.id }; if (have.has(srcKey(src))) return;
        const date = isoDay(a.opened || a.at);
        out.push({ src, title: a.title || "Assignment", date, periods: a.periods || [], kind: a.xc ? "Extra credit" : a.type === "practice" ? "Practice" : a.type === "quiz" ? "Quiz" : "Test", from: "Assignments", cat: guessCat({ type: a.type, title: a.title }, setup), at: a.at || 0, xc: !!a.xc, pts: a.xc ? XC_PTS : 0 });
    });
    const groups = new Map();
    (dataIndex || []).filter((m) => m && m.id && m.source !== "Assignment" && !linkedImp.has(m.id) && m.period).forEach((m) => {
        const k = String(m.title || "").trim().toLowerCase() + "|" + day(m.date);
        if (!groups.has(k)) groups.set(k, { title: m.title || "Class Data set", date: day(m.date) || isoDay(m.at), ids: {}, source: m.source || "", at: m.at || 0 });
        const g = groups.get(k); if (!g.ids[m.period]) g.ids[m.period] = m.id;
    });
    groups.forEach((g) => {
        const src = { k: "data", ids: g.ids }; if (have.has(srcKey(src))) return;
        out.push({ src, title: g.title, date: g.date, periods: Object.keys(g.ids), kind: g.source || "Class Data", from: "Class Data", cat: guessCat({ title: g.title }, setup), at: g.at });
    });
    return out.sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
}
export function isoDay(ms) { const d = new Date(+ms || Date.now()); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }

/** A new item from a candidate (or by hand). Linked items are out of 100 by default, so each counts like one percentage score. */
export function makeItem(o, id) {
    return { id, title: String(o.title || "New grade").trim().slice(0, 80), date: day(o.date) || isoDay(), cat: o.cat, pts: Math.max(0, +o.pts || (o.src && o.src.k !== "hand" ? 100 : 10)),
        periods: (o.periods || []).slice(), src: o.src || { k: "hand" }, std: String(o.std || "").slice(0, 12), off: !!o.off, xc: !!o.xc, at: Date.now() };
}

/** Parse a typed score: "8", "8.5", "85%" (of the item's points), "8/10" (scaled to the item's points). null when blank or not a number. */
export function parseScore(text, pts) {
    const s = String(text == null ? "" : text).trim(); if (!s) return null;
    const frac = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s); if (frac) return +frac[2] > 0 ? Math.round((+frac[1] / +frac[2]) * pts * 100) / 100 : null;
    const per = /^(\d+(?:\.\d+)?)\s*%$/.exec(s); if (per) return Math.round((+per[1] / 100) * pts * 100) / 100;
    const n = /^\d+(?:\.\d+)?$/.test(s) ? +s : NaN; return isFinite(n) ? n : null;
}
