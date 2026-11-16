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
