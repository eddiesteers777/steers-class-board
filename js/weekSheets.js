/* ==========================================
   Calera Math — printable sheets built in the browser from a week.
   Same layout rules as tools/weekly_kit/docs.py, so a sheet printed here
   matches the one the weekly kit builds. No sign-in needed by this file:
   it only turns a week object into page elements.

   Math markup in any text: {2/5} stacked fraction, 4{2/3} mixed number,
   x^2 or x^{10} exponent, § a dollar sign, $...$ wrappers are dropped.
========================================== */
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
