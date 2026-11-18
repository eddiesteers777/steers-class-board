/* ==========================================
   Anchor Board — roster import (rosters.html).
   Reads a class list exported from Google Classroom, PowerSchool, a gradebook or a sheet (CSV),
   or pasted names, and keeps first name and last initial only ("Ava R."), so full names never
   need to be stored. Two students who would get the same short name keep one more letter ("Ava Ro.").
========================================== */

/** CSV text to rows of cells. Handles quotes, commas and new lines inside quotes, tabs, and semicolons. */
export function parseCsv(text) {
    const t = String(text || "").replace(/^﻿/, ""), first = t.split(/\r?\n/, 1)[0] || "";
    const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : ((first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",");
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
        if (c === '"' && !cell) q = true;
        else if (c === sep) { row.push(cell.trim()); cell = ""; }
        else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
        else cell += c;
    }
    if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
    return rows.filter((r) => r.some((c) => c));
}

const cap = (w) => w ? w.charAt(0).toLocaleUpperCase() + w.slice(1) : "";
/** Split a full name into { first, last }: "Rodriguez, Ava", "Ava Maria Rodriguez", "AVA RODRIGUEZ". */
export function splitName(full) {
    let s = String(full || "").replace(/\s+/g, " ").trim(); if (!s) return null;
    if (s === s.toUpperCase() && /[A-Z]{2}/.test(s)) s = s.toLowerCase().split(" ").map(cap).join(" ");
    if (s.includes(",")) { const [last, rest] = s.split(/,(.*)/s).map((x) => x.trim()); return { first: (rest || "").split(" ")[0] || last, last: rest ? last : "" }; }
    const w = s.split(" ");
    if (w.length === 1) return { first: w[0], last: "" };
    if (/^[A-Z]\.?$/i.test(w[w.length - 1])) return { first: w[0], last: w[w.length - 1].replace(".", "") };   // already "Ava R."
    return { first: w[0], last: w.slice(1).filter((x) => !/^(jr|sr|ii|iii|iv)\.?$/i.test(x)).pop() || "" };
}

/** Short names for one class, in the same order: "Ava R.", and "Ava Ro." / "Ava Ru." when two would match. */
export function shortNames(list) {
    const people = list.map(splitName).filter(Boolean);
    const make = (p, n) => (p.last ? p.first + " " + p.last.slice(0, n) + "." : p.first);
    const out = people.map((p) => make(p, 1));
    for (let n = 2; n <= 4; n++) {
        const seen = {}; out.forEach((x) => { seen[x] = (seen[x] || 0) + 1; });
        let again = false;
        out.forEach((x, i) => { if (seen[x] > 1 && people[i].last.length >= n) { out[i] = make(people[i], n); again = true; } });
        if (!again) break;
    }
    return out;
}

/** Which period a cell names, from the teacher's period keys ("1st", "2nd"…): "1", "Period 1", "P1", "01", "1st Period", "Math 7 - 4th". */
export function periodOf(cell, keys) {
    const s = String(cell || "").toLowerCase();
    const named = keys.find((k) => new RegExp("(^|[^a-z0-9])" + k.toLowerCase().replace(/[^a-z0-9]/g, "") + "($|[^a-z0-9])").test(s));
    if (named) return named;
    const m = s.match(/(?:^|period|per\.?|p)\s*0*(\d{1,2})(?!\d)/) || s.match(/^\s*0*(\d{1,2})\s*$/);
    if (!m) return null;
    return keys.find((k) => parseInt(k, 10) === +m[1]) || null;
}

/**
 * Rows from a CSV to rosters: { byPeriod: { "1st": ["Ava R.", …] }, unplaced: [...], how }.
 * Uses a header row when there is one (First / Last / Name / Student, and Period / Class / Section / Course).
 * With no period column, every name goes to fallback (the period picked on the page).
 */
export function rowsToRosters(rows, keys, fallback) {
    if (!rows.length) return { byPeriod: {}, unplaced: [], how: "empty" };
    const H = rows[0].map((h) => h.toLowerCase());
    const col = (re) => H.findIndex((h) => re.test(h));
    const fi = col(/first|given|preferred/), li = col(/last|surname|family/), ni = col(/^(student\s*)?(full\s*)?name$|^student$/);
    const pi = col(/period|class|section|course|hour|block/);
    const header = fi >= 0 || li >= 0 || ni >= 0 || (pi >= 0 && rows.length > 1);
    const body = header ? rows.slice(1) : rows;
    const full = (r) => {
        if (fi >= 0 || li >= 0) { const f = (r[fi] || "").trim(), l = (li >= 0 ? r[li] : "").trim(); return f && l ? f + " " + l : f || l; }
        if (ni >= 0) return r[ni] || "";
        return r.length >= 2 && !periodOf(r[1], keys) && !/@/.test(r[1]) && /^[a-z' .-]+$/i.test(r[1]) && /^[a-z' .-]+$/i.test(r[0]) && r[0].split(" ").length === 1 && r[1].split(" ").length === 1 ? r[0] + " " + r[1] : r[0];
    };
    const raw = {}, unplaced = [];
    body.forEach((r) => {
        const name = String(full(r) || "").trim(); if (!name || /@/.test(name)) return;
        const p = pi >= 0 ? periodOf(r[pi], keys) : fallback;
        if (!p) { unplaced.push(name); return; }
        (raw[p] = raw[p] || []).push(name);
    });
    const byPeriod = {}; Object.keys(raw).forEach((p) => { byPeriod[p] = shortNames(raw[p]).slice(0, 60); });
    return { byPeriod, unplaced: shortNames(unplaced), how: pi >= 0 ? "periods" : "one" };
}
