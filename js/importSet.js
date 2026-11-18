/* Turn a question list from another tool into Anchor Board's question table (CATEGORY | POINTS | QUESTION | ANSWER).
 * Reads CSV files and cells pasted from a spreadsheet (tab separated). Knows the column layouts of the
 * Blooket, Wayground (Quizizz), Gimkit and Kahoot spreadsheet templates, plus any sheet with a
 * Question column and an Answer column, or plain two to four column lists. Pure functions: nothing is
 * saved here, and the teacher reviews the table before saving. */

const MAX_CATS = 6, MAX_PER = 6;

/** Split text into rows of cells. Tabs win (a paste from Sheets or Excel); otherwise CSV with quotes. */
export function parseTable(text) {
    const src = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    const lines = src.split("\n");
    if (lines.some((l) => l.includes("\t"))) return lines.map((l) => l.split("\t").map((c) => c.trim())).filter((r) => r.some(Boolean));
    const semi = !lines.slice(0, 5).some((l) => l.includes(",")) && lines.slice(0, 5).some((l) => l.includes(";"));
    const sep = semi ? ";" : ",", rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (q) { if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
        if (ch === '"' && cell.trim() === "") { q = true; cell = ""; }
        else if (ch === sep) { row.push(cell.trim()); cell = ""; }
        else if (ch === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
        else cell += ch;
    }
    row.push(cell.trim()); rows.push(row);
    return rows.filter((r) => r.some(Boolean));
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim();
const flat = (s) => String(s || "").replace(/\s*\n\s*/g, " ").replace(/\s+\|\s+/g, " / ").replace(/\s{2,}/g, " ").trim();

/** Which column is which, from a heading row. */
function readHeader(cells) {
    const h = cells.map(norm), find = (re, not) => h.findIndex((x) => re.test(x) && !(not && not.test(x)));
    const opts = []; h.forEach((x, i) => { const m = x.match(/^(?:answer|option|choice)\s*(\d)\b/); if (m) opts[+m[1] - 1] = i; });
    const wrong = []; h.forEach((x, i) => { if (/^incorrect answer/.test(x)) wrong.push(i); });
    return {
        q: find(/^question( text)?\b/, /question (#|type|number|no)\b|^question #/),
        correct: find(/^correct answer/),
        answer: find(/^(answer|answers|solution|key)$/),
        cat: find(/^(category|topic|section|standard|skill)$/),
        pts: find(/^(points?|value|pts)$/),
        type: find(/^question type/),
        opts: opts.filter((x) => x != null), wrong,
    };
}
function nameOf(h, cells) {
    const all = cells.map(norm).join(" ");
    if (/max 120 characters|choose at least one/.test(all)) return "Kahoot";
    if (/correct answer s/.test(all) && /time limit sec/.test(all)) return "Blooket";
    if (/question type/.test(all) && /option 1/.test(all)) return "Wayground";
    if (h.wrong.length) return "Gimkit";
    return "spreadsheet";
}

/**
 * rows → { items: [{ c, p, q, a }], source, skipped, total }
 * choices: also write the answer choices into each multiple-choice question.
 */
export function readQuestions(rows, choices) {
    const items = [], skipped = []; let source = "list";
    const hi = rows.slice(0, 8).findIndex((r) => { const h = readHeader(r); return h.q >= 0 && (h.correct >= 0 || h.answer >= 0 || h.opts.length > 0); });
    if (hi >= 0) {
        const h = readHeader(rows[hi]); source = nameOf(h, rows[hi]);
        rows.slice(hi + 1).forEach((r, k) => {
            const line = hi + k + 2, q = flat(r[h.q]); if (!q) return;
            const options = h.opts.map((i) => flat(r[i])).filter(Boolean);
            let a = "", letter = "";
            if (h.wrong.length && h.correct >= 0) {   // Gimkit: the correct answer is written out
                a = flat(r[h.correct]);
            } else if (h.correct >= 0 && /^\s*\d+(\s*[,;&/ ]\s*\d+)*\s*$/.test(r[h.correct] || "")) {   // Blooket, Wayground, Kahoot: option numbers
                const nums = [...new Set(String(r[h.correct]).match(/\d+/g).map(Number))];
                const picked = nums.map((n) => flat(r[h.opts[n - 1]])).filter(Boolean);
                a = picked.join(" or "); letter = nums.map((n) => String.fromCharCode(64 + n)).join(", ");
            } else if (h.correct >= 0 && flat(r[h.correct])) a = flat(r[h.correct]);
            else if (h.answer >= 0) a = flat(r[h.answer]);
            else if (options.length && h.type >= 0 && /open|fill|blank/.test(norm(r[h.type]))) a = options.join(" or ");   // Wayground fill in the blank: every option is right
            if (!a) { skipped.push("Row " + line + ": no answer found for \"" + q.slice(0, 50) + (q.length > 50 ? "…" : "") + "\"."); return; }
            let qq = q;
            if (choices && h.opts.length && options.length > 1 && letter) {
                qq = q + "  " + options.map((o, i) => "(" + String.fromCharCode(65 + i) + ") " + o).join("  ");
                a = letter + ") " + a;
            }
            items.push({ c: h.cat >= 0 ? flat(r[h.cat]) : "", p: h.pts >= 0 ? parseInt(String(r[h.pts]).replace(/[^0-9]/g, ""), 10) || 0 : 0, q: qq, a });
        });
    } else {
        rows.forEach((r, k) => {
            const cells = r.map(flat).filter((x, i, all) => x || i < all.length - 1);
            if (cells.length === 2) items.push({ c: "", p: 0, q: cells[0], a: cells[1] });
            else if (cells.length === 3) items.push({ c: cells[0], p: 0, q: cells[1], a: cells[2] });
            else if (cells.length >= 4) items.push({ c: cells[0], p: parseInt(cells[1].replace(/[^0-9]/g, ""), 10) || 0, q: cells[2], a: cells[3] });
            else if (cells.some(Boolean)) skipped.push("Row " + (k + 1) + ": needs a question and an answer.");
        });
    }
    return { items, source, skipped, total: items.length };
}

/**
 * Lay the questions out as the board needs them: at most 6 categories of 6.
 * Questions with no category are split evenly into "Part 1", "Part 2"… in the order they came.
 * Returns { text, cats, per, cut } where cut counts questions left out for space.
 */
export function toTable(items) {
    const named = new Map(), loose = [];
    items.forEach((x) => { if (x.c) { const k = x.c.toLowerCase(); if (!named.has(k)) named.set(k, { n: x.c.slice(0, 60), list: [] }); named.get(k).list.push(x); } else loose.push(x); });
    const groups = [...named.values()];
    const room = Math.max(0, MAX_CATS - groups.length);
    let cut = loose.length && !room ? loose.length : 0;
    if (loose.length && room) {
        const parts = Math.min(room, Math.max(1, Math.ceil(loose.length / 5))), per = Math.min(MAX_PER, Math.ceil(loose.length / parts));
        for (let i = 0; i < parts; i++) { const list = loose.slice(i * per, (i + 1) * per); if (list.length) groups.push({ n: "PART " + (i + 1), list }); }
        cut += Math.max(0, loose.length - parts * per);
    }
    const keep = groups.slice(0, MAX_CATS); groups.slice(MAX_CATS).forEach((g) => { cut += g.list.length; });
    const rows = [];
    keep.forEach((g) => {
        const list = g.list.slice(0, MAX_PER); cut += g.list.length - list.length;
        const usePts = list.every((x) => x.p > 0) && new Set(list.map((x) => x.p)).size === list.length;
        list.forEach((x, i) => rows.push([g.n, usePts ? x.p : (i + 1) * 100, x.q, x.a].join(" | ")));
    });
    return { text: rows.join("\n"), cats: keep.length, cut };
}
