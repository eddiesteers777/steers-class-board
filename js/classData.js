/* ==========================================
   Calera Math — class data helpers (no sign-in, no network).
   Turns a pasted or uploaded table into scores between 0 and 1, and
   summarises them by skill and by student. Student data never goes in
   this public repo: the page saves it under teacher/{uid}/data/... only.
========================================== */

/** Parse CSV / tab / semicolon text into rows of cells. Handles quoted cells. */
export function parseTable(text) {
    const t = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    const first = t.split("\n")[0] || "", count = (ch) => first.split(ch).length - 1;
    const sep = count("\t") >= Math.max(count(","), count(";")) && count("\t") ? "\t" : (count(";") > count(",") ? ";" : ",");
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
        else if (ch === '"' && cell === "") q = true;
        else if (ch === sep) { row.push(cell.trim()); cell = ""; }
        else if (ch === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
        else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell.trim()); rows.push(row); }
    return rows.filter((r) => r.some((c) => c !== ""));
}

/** One cell -> a score from 0 to 1, or null when blank / not a score.
    kind: "percent" (85 or 85%), "points" (out of max), "right" (1/0, yes/no, ✓/x). */
export function toScore(cell, kind, max) {
    const s = String(cell == null ? "" : cell).trim(); if (s === "" || s === "-" || /^(n\/?a|absent|exempt|missing)$/i.test(s)) return null;
    if (kind === "right") {
        if (/^(1|y|yes|true|t|correct|right|✓|✔|x✓)$/i.test(s)) return 1;
        if (/^(0|n|no|false|f|incorrect|wrong|x|✗|✘)$/i.test(s)) return 0;
        return null;
    }
    const frac = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s);          // "7/10" always means 7 out of 10
    if (frac) return +frac[2] > 0 ? clamp(+frac[1] / +frac[2]) : null;
    const n = parseFloat(s.replace(/%$/, "").replace(/,/g, "")); if (!isFinite(n)) return null;
    if (kind === "points") return max > 0 ? clamp(n / max) : null;
    return clamp(n / 100);
}
const clamp = (x) => Math.max(0, Math.min(1, x));

/** Does this column look like scores? Used to pre-tick score columns. */
export function looksNumeric(rows, col) {
    let n = 0, ok = 0;
    for (const r of rows) { const c = (r[col] || "").trim(); if (!c) continue; n++; if (/^-?\d+(\.\d+)?\s*%?$/.test(c) || /^\d+(\.\d+)?\s*\/\s*\d+/.test(c)) ok++; }
    return n > 0 && ok / n >= 0.8;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z ,]/g, "").replace(/\s+/g, " ").trim();
/** Match an imported name to a roster line: exact, "Last, First" flipped, or same first + last word. */
export function rosterIndex(name, roster) {
    const a = norm(name); if (!a) return -1;
    const flip = (x) => { const m = /^([^,]+),\s*(.+)$/.exec(x); return m ? m[2] + " " + m[1] : x; };
    const key = (x) => { const w = flip(norm(x)).replace(/,/g, "").split(" ").filter(Boolean); return w.length ? w[0] + " " + w[w.length - 1] : ""; };
    const ka = key(name);
    for (let i = 0; i < roster.length; i++) if (norm(roster[i]) === a || key(roster[i]) === ka) return i;
    return -1;
}

const mean = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;

/** Summaries for a list of imports (each { id, title, date, skill, items[], rows[{s, v[]}] }). cut is 0..1. */
export function summarise(imports, cut) {
    const skills = [], students = new Map();
    for (const imp of imports) {
        imp.items.forEach((item, k) => {
            const got = imp.rows.map((r) => [r.s, r.v[k]]).filter(([, v]) => v != null);
            if (!got.length) return;
            const label = imp.items.length === 1 && (item === imp.title || !item) ? imp.title : imp.title + ": " + item;
            const low = got.filter(([, v]) => v < cut).sort((a, b) => a[1] - b[1]);
            skills.push({ label, skill: imp.skill || "", date: imp.date || "", avg: mean(got.map(([, v]) => v)), n: got.length, low: low.map(([s, v]) => ({ s, v })) });
            for (const [s, v] of got) { if (!students.has(s)) students.set(s, []); students.get(s).push({ label, v }); }
        });
    }
    const people = [...students.entries()].map(([s, list]) => {
        const worst = [...list].sort((a, b) => a.v - b.v)[0];
        return { s, avg: mean(list.map((x) => x.v)), n: list.length, low: list.filter((x) => x.v < cut).length, worst };
    }).sort((a, b) => a.avg - b.avg);
    return { skills, people };
}

/** Scores grouped by Alabama standard. An import carries a standard for the whole set (imp.std) and,
    optionally, one per score column (imp.istd[k], "" = same as the set). Untagged scores are counted, not shown.
    Returns { list: [{ code, avg, n, sets: [{ title, date, avg }], low: [{ s, v }] }], untagged } with sets by date. */
export function byStandard(imports, cut) {
    const map = new Map(); let untagged = 0;
    for (const imp of imports) {
        imp.items.forEach((item, k) => {
            const code = (imp.istd && imp.istd[k]) || imp.std || "";
            const got = imp.rows.map((r) => [r.s, r.v[k]]).filter(([, v]) => v != null);
            if (!got.length) return;
            if (!code) { untagged++; return; }
            if (!map.has(code)) map.set(code, { code, sets: new Map(), people: new Map() });
            const g = map.get(code), key = imp.id || imp.title;
            if (!g.sets.has(key)) g.sets.set(key, { title: imp.title, date: imp.date || "", vals: [] });
            for (const [s, v] of got) { g.sets.get(key).vals.push(v); if (!g.people.has(s)) g.people.set(s, []); g.people.get(s).push(v); }
        });
    }
    const list = [...map.values()].map((g) => {
        const sets = [...g.sets.values()].map((x) => ({ title: x.title, date: x.date, avg: mean(x.vals), n: x.vals.length })).sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const per = [...g.people.entries()].map(([s, vs]) => ({ s, v: mean(vs) }));
        return { code: g.code, avg: mean(per.map((p) => p.v)), n: per.length, sets, low: per.filter((p) => p.v < cut).sort((a, b) => a.v - b.v) };
    });
    return { list, untagged };
}
