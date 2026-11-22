/* ==========================================
   Calera Math — printable sheets built in the browser from a week.
   Same layout rules as tools/weekly_kit/docs.py, so a sheet printed here
   matches the one the weekly kit builds. No sign-in needed by this file:
   it only turns a week object into page elements.

   Math markup in any text: {2/5} stacked fraction, 4{2/3} mixed number,
   x^2 or x^{10} exponent, § a dollar sign, $...$ wrappers are dropped.
========================================== */
import { parseFigure, figureEl } from "./figures.js?v=1";
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

/** Text with stacked fractions and exponents, as a document fragment. */
export function rich(text) {
    const s = String(text == null ? "" : text).replace(/\$/g, "").replace(/§/g, "$"); let i = 0;
    function parse(stop) {
        const frag = document.createDocumentFragment(); let buf = "";
        const flush = () => { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ""; } };
        while (i < s.length) {
            const ch = s[i];
            if (stop && stop.includes(ch)) break;
            if (ch === "[" && s[i + 1] === "[") { const f = parseFigure(s, i); if (f) { flush(); frag.appendChild(figureEl(f)); i = f.end; continue; } }   // a graph, table or mapping diagram (js/figures.js)
            if (ch === "^") {                                   // x^2, x^{10}, x^{−3}
                const save = i; i++; let sup = null;
                if (s[i] === "{") { i++; const inner = parse("}"); if (s[i] === "}") { i++; sup = inner; } }
                else { const m = /^[−-]?[0-9a-zA-Z]+/.exec(s.slice(i)); if (m) { i += m[0].length; sup = document.createTextNode(m[0]); } }
                if (sup) { flush(); const e = el("sup"); e.appendChild(sup); frag.appendChild(e); continue; }
                i = save + 1; buf += "^"; continue;
            }
            if (ch === "{") {
                const save = i; i++;
                const num = parse("/}");
                if (s[i] === "/") {
                    i++; const den = parse("}");
                    if (s[i] === "}") {
                        i++; flush();
                        const f = el("span", "frac"), a = el("span"), b = el("span");
                        a.appendChild(num); b.appendChild(den); f.appendChild(a); f.appendChild(b); frag.appendChild(f);
                        continue;
                    }
                }
                i = save + 1; buf += "{"; continue;
            }
            buf += ch; i++;
        }
        flush(); return frag;
    }
    return parse("");
}
function richEl(tag, cls, text) { const e = el(tag, cls); e.appendChild(rich(text)); return e; }

/** "11/16/26" for day i of the week that starts on week.monday (YYYY-MM-DD). */
export function dayDate(week, i) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(week.monday || ""); if (!m) return "";
    const d = new Date(+m[1], +m[2] - 1, +m[3] + i);
    return (d.getMonth() + 1) + "/" + d.getDate() + "/" + String(d.getFullYear()).slice(2);
}

function head(sheet, title, sub) { sheet.appendChild(el("h1", "sh-title", title)); if (sub) sheet.appendChild(el("p", "sh-sub", sub)); }

/** Student bellringer sheet: one block per day, an answer line under each problem. */
export function bellringerSheet(week, cid) {
    const c = week.classes[cid], b = c.bellringer || {}, sheet = el("section", "sheet");
    head(sheet, b.title || "Weekly Bellringer: Week of " + String(week.dates || "").split("–")[0], b.subtitle || c.label + " Mathematics");
    const name = el("p", "sh-name");
    [["Name:", "w30"], ["Date:", "w14"], ["Class/Period:", "w8"]].forEach(([t, w]) => { name.appendChild(el("b", null, t + " ")); name.appendChild(el("span", "rule " + w)); });
    sheet.appendChild(name);
    sheet.appendChild(el("p", "sh-dir", b.directions || "Do these problems at the start of class each day. Show your work."));
    c.days.forEach((day, i) => {
        const probs = day.problems || []; if (!probs.length) return;
        const note = day.bellNote || (i === 4 ? "Review of Earlier Topics" : "");
        const block = el("div", "sh-day" + (probs.length <= 3 ? " roomy" : ""));
        block.appendChild(el("h2", null, DAYS[i] + " " + dayDate(week, i) + (note ? " (" + note + ")" : "")));
        probs.forEach((p, n) => {
            const item = el("div", "sh-prob"), q = el("p", "sh-q");
            q.appendChild(el("b", null, (n + 1) + ". ")); q.appendChild(rich(p.q)); item.appendChild(q);
            const a = el("p", "sh-ans", "Answer: "); a.appendChild(el("span", "rule w22")); item.appendChild(a);
            block.appendChild(item);
        });
        sheet.appendChild(block);
    });
    return sheet;
}

/** Teacher key: answers by day in one table, then any worked lines. */
export function bellringerKey(week, cid) {
    const c = week.classes[cid], sheet = el("section", "sheet key");
    head(sheet, "TEACHER KEY: Bellringers (" + c.label + ", " + week.label + ")", "Teacher only. Never post or link.");
    const width = Math.max(1, ...c.days.map((d) => (d.problems || []).length));
    const table = el("table", "sh-table"), hr = el("tr"); hr.appendChild(el("th", null, "Day"));
    for (let n = 1; n <= width; n++) hr.appendChild(el("th", null, String(n)));
    table.appendChild(hr);
    c.days.forEach((day, i) => {
        const probs = day.problems || []; if (!probs.length) return;
        const tr = el("tr"); tr.appendChild(el("td", "d", DAYS[i]));
        for (let n = 0; n < width; n++) tr.appendChild(richEl("td", null, probs[n] ? probs[n].a : ""));
        table.appendChild(tr);
    });
    sheet.appendChild(table);
    let any = false;
    c.days.forEach((day, i) => {
        const work = (day.problems || []).map((p, n) => [n + 1, p]).filter(([, p]) => p.work); if (!work.length) return;
        if (!any) { sheet.appendChild(el("h2", null, "Worked solutions")); any = true; }
        sheet.appendChild(el("p", "sh-wday", DAYS[i]));
        work.forEach(([n, p]) => { const w = el("p", "sh-work"); w.appendChild(document.createTextNode(n + ". ")); w.appendChild(rich(p.work)); sheet.appendChild(w); });
    });
    const all = c.days.flatMap((d) => d.problems || []), edited = all.filter((p) => p.edited).length;
    sheet.appendChild(el("p", "sh-verify", edited
        ? edited + " of " + all.length + " problems were changed on the site and have NOT been re-checked. Work those answers yourself before using this key."
        : "All " + all.length + " answers are the ones saved with the week. None were changed on the site."));
    return sheet;
}

/* ---------- homework packet (8th) / extra practice (7th) ----------
   Same week-file shape as tools/weekly_kit (docs.homework): homework { title, subtitle, directions, space,
   pagePerDay, days: [{ day: "Monday", heading, example: { q, steps[] }, problems: [{ q, a, work, check, edited }] }] }. */
const HW_TITLE = { "7th": "Weekly Extra Practice", "8th": "Weekly Homework Packet", "8th-acc": "Weekly Homework Packet" };
export function homeworkTitle(week, cid) { const c = week.classes[cid], h = c.homework || {}; return h.title || HW_TITLE[cid] || "Homework"; }
export function homeworkSheet(week, cid) {
    const c = week.classes[cid], h = c.homework, sheet = el("section", "sheet hwork");
    head(sheet, homeworkTitle(week, cid), h.subtitle || c.label + " Mathematics");
    const name = el("p", "sh-name");
    [["Name:", "w30"], ["Date:", "w14"], ["Period:", "w8"]].forEach(([t, w]) => { name.appendChild(el("b", null, t + " ")); name.appendChild(el("span", "rule " + w)); });
    sheet.appendChild(name);
    if (h.directions) sheet.appendChild(richEl("p", "sh-dir", h.directions));
    (h.days || []).forEach((day, n) => {
        const block = el("div", "sh-day");
        const hd = el("h2", n && h.pagePerDay ? "newpage" : null, day.heading || (day.day || "") + " Problems"); block.appendChild(hd);
        const ex = day.example;
        if (ex) { const b = boxed([para(null, "Worked example: ", ex.q), ...(ex.steps || []).map((x) => para(null, "", x))]); b.classList.add("white"); block.appendChild(b); }
        (day.problems || []).forEach((p, k) => {
            const item = el("div", "sh-prob"); item.style.marginBottom = (h.space || 18) + "pt";
            const q = el("p", "sh-q"); q.appendChild(el("b", null, (k + 1) + ". ")); q.appendChild(rich(p.q)); item.appendChild(q);
            const a = el("p", "sh-ans", "Answer: "); a.appendChild(el("span", "rule w22")); item.appendChild(a);
            block.appendChild(item);
        });
        sheet.appendChild(block);
    });
    return sheet;
}
export function homeworkKey(week, cid) {
    const c = week.classes[cid], h = c.homework, sheet = el("section", "sheet key");
    head(sheet, "TEACHER KEY: " + homeworkTitle(week, cid), c.label + " • Teacher only. Never post or link.");
    const t = el("table", "sh-table sh-small"), hr = el("tr");
    [["Day", "1in"], ["#", "0.4in"], ["Answer", "2.2in"], ["Work", ""]].forEach(([x, w]) => { const th = el("th", null, x); if (w) th.style.width = w; hr.appendChild(th); }); t.appendChild(hr);
    let total = 0, checked = 0, edited = 0;
    (h.days || []).forEach((day) => (day.problems || []).forEach((p, k) => {
        total++; if (p.check) checked++; if (p.edited) edited++;
        const tr = el("tr"); tr.appendChild(el("td", "d", k ? "" : day.day || "")); tr.appendChild(el("td", null, String(k + 1)));
        tr.appendChild(richEl("td", null, p.a || "")); tr.appendChild(richEl("td", null, p.work || "")); t.appendChild(tr);
    }));
    sheet.appendChild(t);
    sheet.appendChild(el("p", "sh-verify", checked + " of " + total + " answers were recomputed by a written check when the week file was built." + (edited ? " " + edited + " were changed by hand since and are NOT re-checked." : "")));
    return sheet;
}

/* ---------- guided notes ---------- */
function blanks(text, key) {   // [word] -> a blank for students, the bold word for the key
    const frag = document.createDocumentFragment();
    String(text).split(/(\[[^\]]+\])/).forEach((part) => {
        const m = /^\[([^\]]+)\]$/.exec(part);
        if (!m) frag.appendChild(rich(part)); else if (key) frag.appendChild(el("b", null, m[1])); else frag.appendChild(el("span", "rule w14 inl"));
    });
    return frag;
}
function stepTable(rows) {     // math | why. Never splits across a page.
    const t = el("table", "sh-steps");
    rows.forEach(([m, why]) => { const tr = el("tr"), a = el("td", "m"), b = el("td"); a.appendChild(rich(m)); b.appendChild(rich(why)); tr.appendChild(a); tr.appendChild(b); t.appendChild(tr); });
    return t;
}
function boxed(lines) { const d = el("div", "sh-box"); lines.forEach((x) => d.appendChild(x)); return d; }
function para(cls, bold, text) { const p = el("p", cls); if (bold) p.appendChild(el("b", null, bold)); p.appendChild(rich(text)); return p; }

/** One day's guided notes (student copy, or the teacher key). Same content as the board's Guided Notes screen.
    A published week holds no exit ticket answers and only the filled-in guided steps, so the student copy
    leaves those steps blank and the key says when exit answers are missing. */
export function notesSheet(week, cid, i, key) {
    const c = week.classes[cid], n = c.days[i].notes, sheet = el("section", "sheet gnotes" + (key ? " key" : ""));
    head(sheet, (key ? "TEACHER KEY: " : "") + n.title, (key ? "Teacher only. Never post or link. " : "") + (n.subtitle || c.label));
    if (!key) { const name = el("p", "sh-name"); [["Name:", "w30"], ["Date:", "w14"], ["Class/Period:", "w8"]].forEach(([t, w]) => { name.appendChild(el("b", null, t + " ")); name.appendChild(el("span", "rule " + w)); }); sheet.appendChild(name); }
    const top = [];
    if (n.standard) top.push(para(null, "Standard: ", n.standard));
    if (n.targets && n.targets.length) top.push(para(null, "Learning Targets: ", "I can… " + n.targets.join("  •  ")));
    if (top.length) sheet.appendChild(boxed(top));
    if (n.warmup && n.warmup.length) {
        sheet.appendChild(el("h2", null, "Warm-Up")); const p = el("p", "sh-warm" + (key ? "" : " room"));
        n.warmup.forEach((w, k) => { p.appendChild(el("b", null, "W" + (k + 1) + ". ")); p.appendChild(rich(w.q)); if (key) { p.appendChild(document.createTextNode("  →  ")); const b = el("b"); b.appendChild(rich(w.a)); p.appendChild(b); } p.appendChild(document.createTextNode("   ")); });
        sheet.appendChild(p);
    }
    if (n.vocab && n.vocab.items) {
        sheet.appendChild(el("h2", null, "Vocabulary: fill in the blanks"));
        if (n.vocab.bank) sheet.appendChild(para("sh-bank", "Word bank: ", n.vocab.bank.join("  •  ")));
        n.vocab.items.forEach((v, k) => { const p = el("p", "sh-vocab"); p.appendChild(document.createTextNode((k + 1) + ". ")); p.appendChild(blanks(v, key)); sheet.appendChild(p); });
    }
    if (n.bigIdea && n.bigIdea.length) {
        sheet.appendChild(el("h2", null, "The Big Idea"));
        const lines = [para(null, null, "")]; lines[0].appendChild(el("b", null, n.bigIdea[0]));
        n.bigIdea.slice(1).forEach((t) => lines.push(para(null, null, t)));
        if (n.steps && n.steps.length) { lines.push(para(null, "Steps:", "")); n.steps.forEach((t, k) => lines.push(para(null, null, (k + 1) + ". " + t))); }
        sheet.appendChild(boxed(lines));
    }
    if (n.examples && n.examples.length) {
        sheet.appendChild(el("h2", null, "Worked Examples"));
        n.examples.forEach((e, k) => {
            const block = el("div", "sh-keep");
            block.appendChild(para("sh-q", "Example " + (k + 1) + (e.title ? ": " + e.title + ". " : ". "), e.q));
            block.appendChild(stepTable(e.steps.map((x) => [n.blankExamples && !key ? "" : x.m, x.why || ""])));
            sheet.appendChild(block);
        });
    }
    if (n.guided) {
        const block = el("div", "sh-keep"); block.appendChild(el("h2", null, "Guided Practice: your turn with help"));
        block.appendChild(para("sh-q", null, n.guided.q));
        block.appendChild(stepTable(n.guided.steps.map((x) => [key ? (x.full || x.m) : ("full" in x ? x.m : ""), x.why || ""])));
        sheet.appendChild(block);
    }
    if (n.practice && n.practice.length) {
        const h = el("h2", n.practicePageBreak === false ? null : "newpage", "Practice"); sheet.appendChild(h);
        if (n.practiceDirections) sheet.appendChild(para("sh-dir", null, n.practiceDirections));
        n.practice.forEach((part) => {
            if (part.label) sheet.appendChild(el("p", "sh-part", part.label));
            part.problems.forEach((p) => {
                const q = para("sh-prac", (p.n || "") + ". ", p.q);
                if (key) { q.appendChild(document.createTextNode("  →  ")); const b = el("b"); b.appendChild(rich(p.a)); q.appendChild(b); }
                else q.style.marginBottom = ((part.space == null ? 2 : part.space) * 13.5 + 2) + "pt";
                sheet.appendChild(q);
            });
        });
    }
    if (n.errors && n.errors.length) {
        sheet.appendChild(el("h2", null, "Error Detectives"));
        if (!key) sheet.appendChild(para("sh-dir", null, "One of these students is correct! Decide: Correct or Mistake? If it is a mistake, explain it and give the right answer."));
        n.errors.forEach((e, k) => {
            sheet.appendChild(para("sh-q", "E" + (k + 1) + ". ", e.q));
            if (key) sheet.appendChild(para("sh-err", (e.correct ? "Correct" : "Mistake") + ". ", e.fix || ""));
            else { const p = el("p", "sh-err", "Correct or Mistake? "); p.appendChild(el("span", "rule w8 inl")); p.appendChild(document.createTextNode("  Explain: ")); p.appendChild(el("span", "rule w30 inl")); sheet.appendChild(p); }
        });
    }
    if (n.exit && n.exit.length) {
        sheet.appendChild(el("h2", key || n.exitOwnPage === false ? null : "newpage", "Exit Ticket (individual check)"));   // own page, so it can be collected
        let missing = 0;
        n.exit.forEach((p, k) => {
            const q = para("sh-prac" + (key ? "" : " room3"), "X" + (k + 1) + ". ", p.q);
            if (key) { if (p.a) { q.appendChild(document.createTextNode("  →  ")); const b = el("b"); b.appendChild(rich(p.a)); q.appendChild(b); } else missing++; }
            sheet.appendChild(q);
        });
        if (!key) sheet.appendChild(el("p", null, "Confidence: ☐ Got it   ☐ Mostly   ☐ Need help"));
        if (key && missing) sheet.appendChild(el("p", "sh-verify", "Exit ticket answers are not kept on the public site. Load the week file from the week's Drive folder to print them here."));
    }
    return sheet;
}

/* ---------- study guide and speed dating ----------
   Ported from tools/weekly_kit/docs.py (study_guide, speed_dating and their keys). These parts carry
   answers, so they are never in the published week: they come from the week file (Load week file)
   or a private saved copy. */
function nameRow(sheet, fields) {
    const p = el("p", "sh-name");
    fields.forEach(([t, w]) => { p.appendChild(el("b", null, t + " ")); p.appendChild(el("span", "rule " + w)); });
    sheet.appendChild(p);
}
const NAME3 = [["Name:", "w30"], ["Date:", "w14"], ["Period:", "w8"]];
function pageTitle(sheet, text, first) { const h = el("h2", "sh-ptitle" + (first ? "" : " newpage"), text); sheet.appendChild(h); return h; }
function richLine(cls, text, prefix) { const p = el("p", cls); if (prefix) p.appendChild(el("b", null, prefix)); p.appendChild(rich(text)); return p; }
function keyTable(head, rows, widths) {
    const t = el("table", "sh-table sh-small"), hr = el("tr");
    head.forEach((h, k) => { const th = el("th", null, h); if (widths && widths[k]) th.style.width = widths[k]; hr.appendChild(th); }); t.appendChild(hr);
    rows.forEach((r) => { const tr = el("tr"); r.forEach((cell) => { const td = el("td"); (Array.isArray(cell) ? cell : [cell]).forEach((x, k) => { if (k) td.appendChild(el("br")); td.appendChild(rich(x)); }); tr.appendChild(td); }); t.appendChild(tr); });
    return t;
}
const wrongList = (list) => (list || []).map((w) => w.a + ": " + (w.why || ""));

/** Study guide: worked examples, each practice page on its own page, then error detectives and the check-up. */
export function studyGuideSheet(week, cid) {
    const c = week.classes[cid], g = c.studyGuide, sheet = el("section", "sheet sguide");
    sheet.appendChild(el("h1", "sh-title", g.title)); if (g.subtitle) sheet.appendChild(el("p", "sh-sub", g.subtitle));
    nameRow(sheet, NAME3);
    if (g.ican) sheet.appendChild(boxed([richLine(null, g.ican, "I can: ")]));
    (g.examples || []).forEach((part) => {
        sheet.appendChild(el("h2", null, part.heading));
        (part.boxes || []).forEach((box) => sheet.appendChild(boxed(box.map((x) => richLine(null, x)))));
    });
    (g.practice || []).forEach((pr) => {
        pageTitle(sheet, pr.title); nameRow(sheet, NAME3);
        if (pr.directions) sheet.appendChild(richLine("sh-dir", pr.directions));
        let n = 0;
        (pr.parts || []).forEach((part) => {
            if (part.label) sheet.appendChild(richLine("sh-part", part.label));
            const t = el("table", "sh-steps sh-pboxes");
            (part.problems || []).forEach((p) => { n++; const tr = el("tr"), td = el("td"); td.style.height = (part.height || pr.height || 0.62) + "in"; td.appendChild(el("b", null, n + ". ")); td.appendChild(rich(p.q)); tr.appendChild(td); t.appendChild(tr); });
            sheet.appendChild(t);
        });
    });
    pageTitle(sheet, g.errorTitle || "Error Detectives and Check-Up"); nameRow(sheet, NAME3);
    const intro = el("p", "sh-dir"); intro.append("Each student solved a problem. Decide if the work is ", el("b", null, "correct"), " or has a ", el("b", null, "mistake"), ". If there is a mistake, circle it and fix it."); sheet.appendChild(intro);
    (g.errors || []).forEach((e) => {
        const b = boxed([richLine(null, e.q, e.name + ": "), richLine(null, e.shown), el("p", null, "☐ Correct   ☐ Mistake. Fix it or explain:")]);
        b.classList.add("white"); b.lastChild.appendChild(el("span", "rule w30 inl")); sheet.appendChild(b);
    });
    if (g.checklist && g.checklist.length) {
        sheet.appendChild(el("h2", null, "How am I doing?"));
        const t = el("table", "sh-table sh-check");
        g.checklist.forEach((s) => { const tr = el("tr"), a = el("td"); a.appendChild(rich(s)); tr.appendChild(a); ["☐ Got it", "☐ Mostly", "☐ Need help"].forEach((x) => tr.appendChild(el("td", "ck", x))); t.appendChild(tr); });
        sheet.appendChild(t);
        const p = el("p", null, "One thing I still need help with: "); p.appendChild(el("span", "rule w30 inl")); sheet.appendChild(p);
    }
    return sheet;
}

export function studyGuideKey(week, cid) {
    const c = week.classes[cid], g = c.studyGuide, sheet = el("section", "sheet key");
    head(sheet, "TEACHER KEY: " + g.title, "Teacher only. Never post or link.");
    let total = 0, checked = 0, edited = 0;
    (g.practice || []).forEach((pr) => {
        sheet.appendChild(el("h2", null, pr.title)); const rows = []; let n = 0;
        (pr.parts || []).forEach((part) => (part.problems || []).forEach((p) => { n++; total++; if (p.check) checked++; if (p.edited) edited++; rows.push([String(n), p.a || "", p.work || ""]); }));
        sheet.appendChild(keyTable(["#", "Answer", "Work"], rows, ["0.4in", "2.2in"]));
    });
    if (g.errors && g.errors.length) {
        sheet.appendChild(el("h2", null, "Error Detectives"));
        sheet.appendChild(keyTable(["Student", "Verdict", "What to look for"], g.errors.map((e) => [e.name, e.correct ? "Correct" : "Mistake", e.fix || ""]), ["1in", "0.9in"]));
    }
    sheet.appendChild(el("p", "sh-verify", checked + " of " + total + " practice answers were recomputed by a written check when the week file was built." + (edited ? " " + edited + " were changed by hand since and are NOT re-checked." : "")));
    return sheet;
}

/** Speed dating: page 1 the 40 cards, page 2 the recording sheet, page 3 early finishers. */
export function speedDatingSheet(week, cid) {
    const c = week.classes[cid], s = c.speedDating, cards = s.cards || [], sheet = el("section", "sheet sdate");
    sheet.appendChild(el("p", "sh-btitle", "SPEED DATING REVIEW: " + s.title));
    sheet.appendChild(el("p", "sh-dir sh-tiny", "Cards 1–40. Your teacher hands you ONE card. Do NOT write on the card, and do NOT show the answer to your partners."));
    const grid = el("table", "sh-cards"); grid.style.fontSize = (s.cardSize || 9) + "pt";
    for (let r = 0; r * 4 < cards.length; r++) {
        const tr = el("tr");
        for (let q = 0; q < 4; q++) { const k = r * 4 + q, td = el("td"); td.style.height = (s.cardHeight || 0.76) + "in"; if (cards[k]) { td.appendChild(el("b", null, "#" + (k + 1) + "  ")); td.appendChild(rich(cards[k].q)); } tr.appendChild(td); }
        grid.appendChild(tr);
    }
    sheet.appendChild(grid);
    const rec = el("p", "sh-btitle newpage", "SPEED DATING: Recording Sheet"); sheet.appendChild(rec);
    nameRow(sheet, [["Name:", "w30"], ["Date:", "w14"], ["Period:", "w8"], ["My card #:", "w8"]]);
    const mine = el("p", null); mine.appendChild(el("b", null, "My card's correct answer (get it checked by your teacher): ")); mine.appendChild(el("span", "rule w22")); sheet.appendChild(mine);
    const rt = el("table", "sh-table sh-rounds"), hr = el("tr");
    [["Round", "0.6in"], ["Partner's card #", "1in"], ["Show ALL work to solve their card", ""], ["My answer", "1in"], ["Partner checked ✓", "1in"]].forEach(([t, w]) => { const th = el("th", null, t); if (w) th.style.width = w; hr.appendChild(th); }); rt.appendChild(hr);
    for (let i = 1; i <= (s.rounds || 8); i++) { const tr = el("tr"); tr.appendChild(el("td", null, String(i))); for (let k = 0; k < 4; k++) tr.appendChild(el("td")); rt.appendChild(tr); }
    sheet.appendChild(rt);
    sheet.appendChild(el("h2", null, "My Master Problem: Errors"));
    sheet.appendChild(el("p", "sh-tiny", "Write what your partners got wrong on YOUR card (the wrong answer or the mistake), and how many partners made it."));
    const et = el("table", "sh-table sh-errs"), eh = el("tr"); eh.appendChild(el("th", null, "Wrong answer or mistake")); eh.appendChild(el("th", null, "How many partners?")); et.appendChild(eh);
    for (let i = 0; i < 3; i++) { const tr = el("tr"); tr.appendChild(el("td")); tr.appendChild(el("td")); et.appendChild(tr); }
    sheet.appendChild(et);
    [["The MOST common error on my problem was: ", "w40"], ["Class error review: how to fix it: ", "w40"]].forEach(([t, w]) => { const p = el("p", null, t); p.appendChild(el("span", "rule " + w + " inl")); sheet.appendChild(p); });
    sheet.appendChild(el("p", "sh-btitle newpage", "Early Finishers: Fix the Mistakes"));
    nameRow(sheet, [["Name:", "w30"], ["Period:", "w8"]]);
    if (s.example) sheet.appendChild(boxed([richLine(null, s.example.q, "Worked example: ")].concat((s.example.steps || []).map((x) => richLine(null, x)))));
    sheet.appendChild(el("p", "sh-dir", "These are deliberate extra practice. Show every step, then come back for the class error review."));
    const early = s.early || [];
    early.forEach((p, i) => sheet.appendChild(richLine("sh-prac sh-room", p.q, (i + 1) + ". ")));
    if (s.errorItem) sheet.appendChild(richLine("sh-prac sh-room", s.errorItem.q, (early.length + 1) + ". Error analysis. "));
    sheet.appendChild(el("p", "sh-dir", "When you finish, come back to the class error review at the end of the period."));
    return sheet;
}

export function speedDatingKey(week, cid) {
    const c = week.classes[cid], s = c.speedDating, cards = s.cards || [], sheet = el("section", "sheet key sdkey");
    head(sheet, "TEACHER KEY: Speed Dating Review, " + s.title + " (" + c.label + ")", "Teacher only. Never post or link." + (s.standardNote ? " " + s.standardNote : ""));
    if (s.setup && s.setup.length) { sheet.appendChild(el("h2", null, "Setup")); sheet.appendChild(keyTable(["Item", "Plan"], s.setup.map(([a, b]) => [a, b]), ["1.6in"])); }
    sheet.appendChild(el("h2", null, "Master cards 1–" + cards.length + ": answers, work, and likely wrong answers (teacher only)"));
    sheet.appendChild(keyTable(["#", "Skill", "Answer", "Worked solution", "Likely wrong answers (why)"], cards.map((cd, n) => [String(n + 1), cd.skill || "", cd.a || "", cd.work || "", wrongList(cd.wrong)]), ["0.3in", "1.1in", "0.85in", "", "2.4in"]));
    const early = s.early || [];
    if (early.length || s.errorItem) {
        sheet.appendChild(el("h2", null, "Early-finisher key (deliberate extra practice)"));
        const rows = early.map((p, i) => [String(i + 1), p.a || "", p.work || "", wrongList(p.wrong)]);
        if (s.errorItem) rows.push([String(early.length + 1), s.errorItem.a || "", s.errorItem.work || "", []]);
        sheet.appendChild(keyTable(["#", "Answer", "Work", "Likely wrong answers"], rows, ["0.3in", "1.5in"]));
    }
    if (s.reviewNotes && s.reviewNotes.length) { sheet.appendChild(el("h2", null, "Class error review notes")); s.reviewNotes.forEach((x) => sheet.appendChild(richLine("sh-work", x, "• "))); }
    const checked = cards.filter((cd) => cd.check).length, edited = cards.filter((cd) => cd.edited).length;
    sheet.appendChild(el("h2", null, "Verification"));
    sheet.appendChild(el("p", "sh-verify", checked + " of " + cards.length + " card answers were recomputed by a written check when the week file was built." + (edited ? " " + edited + " were changed by hand since and are NOT re-checked." : "")));
    if (cards.length !== 40) sheet.appendChild(el("p", "sh-verify warn", "This deck has " + cards.length + " cards. The weekly kit expects exactly 40."));
    return sheet;
}
