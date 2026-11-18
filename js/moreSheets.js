/* ==========================================
   Focal — the rest of the week's papers, printed from the week file (Phase 3 of the weekly workflow).
   Quiz or test + key (scored by standard), the modified group's 2-page quiz + key, the 1-page sub plan,
   the 4-page sub worksheet + key, and the 2-page 4-puzzle Sudoku early-finisher sheet + key.
   Every paper is built from fixed-size pages (.sh-page, one printed page each), so pageCheck() can say
   which page spills over before anything is printed. Same paper look as js/weekSheets.js.

   Week file fields, on a class (all optional; a paper shows only when its part is there):
     quiz: { title, kind: "quiz"|"test", day: 0-4, calculator, sub?, directions?, scoring?,
             items: [{ q, choices?, select?, a, pts?, std?, skill?, work?, wrong? }],
             modified: { title?, items: [{ q, choices: [3], a, std? }], bonus: [{ q, choices?, a, std? }] } }
     sub:  { day: 0-4, minutes?: 55, intro?, handout: [..], steps?: [[min, text]], readAloud, print?, copies?, finisher?,
             worksheet: { title, sub?, pages: [{ heading, notes: [..], example: { q, work, answer }, problems: [{ q, a, work? }] }],
                          exit?: [{ q, a }] } }
========================================== */
import { rich, DAYS, dayDate } from "./weekSheets.js?v=58";

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const R = (tag, cls, text) => { const e = el(tag, cls); e.appendChild(rich(text)); return e; };
const NAME = [["Name:", "w24"], ["Date:", "w14"], ["Class/Period:", "w8"]];
function nameRow(page) { const p = el("p", "sh-name"); NAME.forEach(([t, w]) => { p.appendChild(el("b", null, t + " ")); p.appendChild(el("span", "rule " + w)); }); page.appendChild(p); }
function sheet(kind, key) { return el("section", "sheet paged " + kind + (key ? " key" : "")); }
function page(sh) { const p = el("div", "sh-page"); sh.appendChild(p); return p; }
const LET = ["A", "B", "C", "D", "E"];

/** Pages that spill over: [{ n, over }] in printed inches (the sheet must be in the document). */
export function pageCheck(sh) {
    const out = []; if (!sh) return out;
    sh.querySelectorAll(".sh-page").forEach((p, i) => { const over = p.scrollHeight - p.clientHeight; if (over > 2) out.push({ n: i + 1, over: +(over / 96).toFixed(2) }); });
    return out;
}

/* ---------- quiz or test ---------- */
export function quizSheet(week, cid) {
    const c = week.classes[cid], q = c.quiz, sh = sheet("squiz"); let pg = page(sh);
    const title = q.title || (q.kind === "test" ? "Test" : "Quiz");
    pg.appendChild(R("h1", "sh-title", title));
    const pts = q.items.reduce((a, x) => a + (+x.pts || 2), 0);
    pg.appendChild(el("p", "sh-sub", [c.label + " Math", q.sub, q.items.length + " questions, " + pts + " points", q.calculator ? "Calculator allowed" : "No calculator"].filter(Boolean).join(" | ")));
    nameRow(pg);
    if (q.directions) pg.appendChild(R("p", "sh-dir", q.directions));
    const list = el("div", "sh-qlist"); pg.appendChild(list);
    q.items.forEach((x, n) => {
        const item = el("div", "sh-prob sh-qitem");
        const qq = el("p", "sh-q"); qq.appendChild(el("b", null, (n + 1) + ". ")); qq.appendChild(rich(x.q)); qq.appendChild(el("span", "sh-pts", " (" + (+x.pts || 2) + " pts)")); item.appendChild(qq);
        if (Array.isArray(x.choices) && x.choices.length) {
            const ch = el("div", "sh-vchoices"); x.choices.forEach((t, k) => { const s = el("p"); s.appendChild(el("b", null, LET[k] + ". ")); s.appendChild(rich(t)); ch.appendChild(s); }); item.appendChild(ch);
            if (x.select) { const a = el("p", "sh-q"); a.appendChild(el("b", null, "Answer(s): ")); a.appendChild(el("span", "rule w14")); item.appendChild(a); }
        } else item.appendChild(el("div", "sh-workspace"));
        list.appendChild(item);
    });
    paginate(sh);
    return sh;
}
export function quizKey(week, cid) {
    const c = week.classes[cid], q = c.quiz, sh = sheet("squiz", true), pg = page(sh);
    pg.appendChild(R("h1", "sh-title", "TEACHER KEY: " + (q.title || (q.kind === "test" ? "Test" : "Quiz"))));
    pg.appendChild(el("p", "sh-sub", "Teacher only. Never post or link. " + c.label));
    const t = el("table", "sh-table sh-keyt"); const hr = el("tr"); ["#", "Answer", "Work", "Likely wrong answers"].forEach((h) => hr.appendChild(el("th", null, h))); t.appendChild(hr);
    const ans = (x) => { if (!(x.choices && x.choices.length)) return x.a; const many = String(x.a).split(/\s*;\s*/); return many.map((v) => { const k = x.choices.indexOf(v); return k < 0 ? v : LET[k]; }).join(", "); };
    q.items.forEach((x, n) => {
        const r = el("tr"); r.appendChild(el("td", null, String(n + 1)));
        const a = el("td"); a.appendChild(el("b", null, "")); a.firstChild.appendChild(rich(ans(x))); a.appendChild(el("span", "sh-pts", " (" + (+x.pts || 2) + " pts" + (x.skill || x.std ? ", " + (x.std || x.skill) : "") + ")")); r.appendChild(a);
        const w = el("td"); w.appendChild(rich(x.work || "")); r.appendChild(w);
        const wr = el("td"); wr.appendChild(rich(Array.isArray(x.wrong) ? x.wrong.map((v) => (v && v.a ? v.a + (v.why ? " (" + v.why + ")" : "") : v)).join("; ") : (x.wrong || ""))); r.appendChild(wr);
        t.appendChild(r);
    });
    pg.appendChild(t);
    // Scored by standard (or by skill when the item has no standard code)
    const by = {}; q.items.forEach((x, n) => { const k = x.std || x.skill || "Other"; (by[k] = by[k] || { pts: 0, qs: [] }).pts += +x.pts || 2; by[k].qs.push(n + 1); });
    pg.appendChild(el("h2", null, q.items.some((x) => x.std) ? "Score by standard" : "Score by skill"));
    const s = el("table", "sh-table"); const h2 = el("tr"); [q.items.some((x) => x.std) ? "Standard" : "Skill", "Questions", "Points"].forEach((h) => h2.appendChild(el("th", null, h))); s.appendChild(h2);
    Object.entries(by).forEach(([k, v]) => { const r = el("tr"); [k, v.qs.join(", "), String(v.pts)].forEach((x) => r.appendChild(el("td", null, x))); s.appendChild(r); });
    const tot = el("tr"); ["Total", q.items.length + " questions", String(q.items.reduce((a, x) => a + (+x.pts || 2), 0))].forEach((x) => tot.appendChild(el("td", "d", x))); s.appendChild(tot);
    pg.appendChild(s);
    if (q.scoring) pg.appendChild(R("p", "sh-work", q.scoring));
    paginate(sh);
    return sh;
}

/* ---------- the modified group's quiz: exactly 2 pages ---------- */
export function modQuizSheet(week, cid) {
    const c = week.classes[cid], q = c.quiz, m = q.modified, sh = sheet("smod");
    const p1 = page(sh);
    p1.appendChild(R("h1", "sh-title", m.title || (q.title || "Quiz") + " (A)"));
    p1.appendChild(el("p", "sh-sub", [(GR[cid] || c.label), m.items.length + " questions", q.calculator ? "Calculator allowed" : "No calculator"].join(" | ")));
    nameRow(p1);
    p1.appendChild(el("p", "sh-dir", "Circle the best answer. Show your work in the box."));
    const grid = el("div", "sh-modgrid");
    m.items.forEach((x, n) => {
        const b = el("div", "sh-modbox"); const qq = el("p", "sh-q"); qq.appendChild(el("b", null, (n + 1) + ". ")); qq.appendChild(rich(x.q)); b.appendChild(qq);
        const ch = el("p", "sh-choices"); (x.choices || []).slice(0, 3).forEach((t, k) => { const s = el("span"); s.appendChild(el("b", null, LET[k] + ". ")); s.appendChild(rich(t)); ch.appendChild(s); }); b.appendChild(ch);
        grid.appendChild(b);
    });
    p1.appendChild(grid);
    const p2 = page(sh);
    p2.appendChild(el("h2", null, "Bonus: earlier topics (½ point each, up to " + ((m.bonus || []).length / 2) + " extra points)"));
    (m.bonus || []).forEach((x, n) => {
        const b = el("div", "sh-prob"); const qq = el("p", "sh-q"); qq.appendChild(el("b", null, "B" + (n + 1) + ". ")); qq.appendChild(rich(x.q)); b.appendChild(qq);
        if (x.choices && x.choices.length) { const ch = el("p", "sh-choices"); x.choices.slice(0, 3).forEach((t, k) => { const s = el("span"); s.appendChild(el("b", null, LET[k] + ". ")); s.appendChild(rich(t)); ch.appendChild(s); }); b.appendChild(ch); }
        b.appendChild(el("div", "sh-workspace small"));
        p2.appendChild(b);
    });
    requestAnimationFrame(() => { if (sh.isConnected) { fitSpace(sh); sh.dispatchEvent(new CustomEvent("paged")); } });
    return sh;
}
export function modQuizKey(week, cid) {
    const c = week.classes[cid], m = c.quiz.modified, sh = sheet("smod", true), pg = page(sh);
    pg.appendChild(R("h1", "sh-title", "TEACHER KEY: " + (m.title || (c.quiz.title || "Quiz") + " (A)")));
    pg.appendChild(el("p", "sh-sub", "Teacher only. Never post or link."));
    const t = el("table", "sh-table"); const hr = el("tr"); ["#", "Answer", "Standard", "Likely wrong answer"].forEach((h) => hr.appendChild(el("th", null, h))); t.appendChild(hr);
    [...m.items.map((x, n) => [String(n + 1), x]), ...(m.bonus || []).map((x, n) => ["B" + (n + 1), x])].forEach(([n, x]) => {
        const r = el("tr"); r.appendChild(el("td", null, n)); const a = el("td"); a.appendChild(rich((x.choices && x.choices.length ? (LET[x.choices.indexOf(x.a)] || "") + ". " : "") + x.a)); r.appendChild(a);
        r.appendChild(el("td", null, x.std || "")); const w = el("td"); w.appendChild(rich(Array.isArray(x.wrong) ? x.wrong.map((v) => (v && v.a) || v).join("; ") : "")); r.appendChild(w); t.appendChild(r);
    });
    pg.appendChild(t);
    pg.appendChild(el("p", "sh-dir", "Main questions: the current standard only. Bonus: Critical Standards (DIGS), ½ point each."));
    paginate(sh);
    return sh;
}

/* ---------- sub plan: exactly 1 page, in the standing format ---------- */
const PER = { "8th": ["1st", "2nd", "4th"], "7th": ["5th"], "8th-acc": ["6th"] };
const GR = { "8th": "8th Grade Math", "7th": "7th Grade Math", "8th-acc": "8th Grade Accelerated Math" };
/** opts: { guestUrl: the guest board address (sub.html) } */
export function subPlanSheet(week, cid, opts) {
    const c = week.classes[cid], s = c.sub, i = s.day, d = c.days[i] || {}, sh = sheet("ssub"), pg = page(sh), min = +s.minutes || 55;
    const date = (() => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(week.monday || ""); if (!m) return d.date || ""; return new Date(+m[1], +m[2] - 1, +m[3] + i).toLocaleDateString("en-US", { month: "long", day: "numeric" }); })();
    const ws = s.worksheet || {}, wsName = ws.title ? ws.title.split(":")[0] : "worksheet", pages = (ws.pages || []).length;
    const hand = Array.isArray(s.handout) ? s.handout.join(" and ") : (s.handout || (wsName + " worksheet (" + pages + " pages) and Sudoku sheet (2 pages)"));
    pg.appendChild(el("h1", "sub-title", "Substitute Plan: " + DAYS[i] + ", " + date));
    const intro = el("p", "sub-intro"); intro.appendChild(document.createTextNode("Thank you for covering " + (GR[cid] || c.label) + ". " + (s.intro || "This is a review day: students practice skills they already know, so you do not need to teach anything new.") + " "));
    if (opts && opts.guestUrl) { intro.appendChild(document.createTextNode("Optional board display, no sign-in needed: on the classroom computer open ")); intro.appendChild(el("span", "sub-url", opts.guestUrl.replace(/^https?:\/\//, ""))); intro.appendChild(document.createTextNode(" and choose the period at the top.")); }
    pg.appendChild(intro);
    const ban = el("div", "sub-banner"); ban.appendChild(el("b", null, "NO PASSES OUT OF CLASS TODAY.")); ban.appendChild(document.createTextNode(" No restroom, locker, or hallway passes for any period.")); pg.appendChild(ban);
    pg.appendChild(el("h2", "sub-h", "Your Classes"));
    const t = el("table", "sub-table"); const hr = el("tr"); ["Period", "Hand out", "Absent", "Off task"].forEach((h) => hr.appendChild(el("th", null, h))); t.appendChild(hr);
    (PER[cid] || [c.label]).forEach((p) => { const r = el("tr"); r.appendChild(el("td", null, p)); r.appendChild(el("td", null, hand)); r.appendChild(el("td")); r.appendChild(el("td")); t.appendChild(r); });
    pg.appendChild(t);
    pg.appendChild(el("h2", "sub-h", "Plan for Every Period (" + min + " minutes)"));
    const exit = (ws.exit || []).length, work = min - 10 - (exit ? 10 : 0);   // 5 + 5 + work + 10 = the period
    const steps = s.steps || [[5, "Take attendance. Students sit in their seats and read the page 1 reminder box and worked example."], [5, "Read the directions aloud (below) and hand out the worksheet."],
        [work, "Students work silently on pages 1 to " + (pages || 4) + ". Walk the room. They may use their notes. " + (s.calculator ? "Calculators are allowed." : "No calculators.")]]
        .concat(exit ? [[10, "Students finish the Exit Ticket on page " + (pages || 4) + " (name and period on it) and turn it in. Collect the Exit Tickets and worksheets."]] : []);
    const ol = el("ol", "sub-steps"); steps.forEach(([m, x]) => { const li = el("li"); li.appendChild(el("b", null, m + " minutes: ")); li.appendChild(document.createTextNode(x)); ol.appendChild(li); }); pg.appendChild(ol);
    pg.appendChild(el("h2", "sub-h", "Read Aloud"));
    pg.appendChild(el("p", "sub-read", s.readAloud || "Today is a review day. Use your notes and the worked example at the top of each page. Work quietly and show your work for every problem. Write your steps neatly." + (exit ? " When you finish all four parts, do the Exit Ticket at the bottom of page " + (pages || 4) + " and turn it in." : "") + " Please stay in your seat, and raise your hand if you need help."));
    pg.appendChild(el("h2", "sub-h", "Early Finishers"));
    pg.appendChild(el("p", "sub-note", s.finisher || "Students who finish the worksheet" + (exit ? " and exit ticket" : "") + " may work on the Sudoku sheet. Quiet work only."));
    pg.appendChild(el("h2", "sub-h", "Print Before Class"));
    pg.appendChild(el("p", "sub-note", s.print || ("One copy per student" + (s.copies ? " (about " + s.copies + ")" : "") + " of the " + wsName + " worksheet (" + (pages || 4) + " pages) and of the Sudoku sheet (2 pages).")));
    pg.appendChild(el("h2", "sub-h", "Notes for You"));
    const bl = el("p", "sub-blanks"); [["Seating chart:", "w14"], ["Nearby teacher:", "w14"], ["Office ext.:", "w8"]].forEach(([a, w]) => { bl.appendChild(document.createTextNode(a + " ")); bl.appendChild(el("span", "rule " + w)); }); pg.appendChild(bl);
    pg.appendChild(el("p", "sub-close", "Please leave a note on the teacher desk about how each class went. Thank you for being here today."));
    return sh;
}

/* ---------- sub worksheet: one part per page, each with its own heading, reminder box and worked example ---------- */
export function subWorksheetSheet(week, cid, key) {
    const c = week.classes[cid], w = c.sub.worksheet, sh = sheet("ssubws", key);
    const subLine = w.sub || ((GR[cid] || c.label) + " | Review only, no new content | " + (c.sub.calculator ? "Calculator allowed" : "No calculator"));
    w.pages.forEach((p, k) => {
        const pg = page(sh);
        pg.appendChild(R("h1", "sh-title ws", w.title + (key ? " (TEACHER KEY)" : "")));
        pg.appendChild(el("p", "sh-sub", subLine)); if (!key) nameRow(pg);
        pg.appendChild(R("h2", null, "Part " + (k + 1) + ": " + p.heading));
        const box = el("div", "sh-box");
        if ((p.notes || []).length) { const r = el("p"); r.appendChild(el("b", null, "Reminder: ")); r.appendChild(rich(p.notes.join(" "))); box.appendChild(r); }
        if (p.example) {
            const e = el("p"); e.appendChild(el("b", null, "Worked example: ")); e.appendChild(rich(p.example.q)); box.appendChild(e);
            const wk = el("p"); wk.appendChild(document.createTextNode("Work: ")); wk.appendChild(rich(p.example.work || (p.example.steps || []).map((x) => x.m).join("; ")));
            if (p.example.answer) { wk.appendChild(document.createTextNode("   ")); wk.appendChild(el("b", null, "Answer: ")); wk.appendChild(rich(p.example.answer)); }
            box.appendChild(wk);
        }
        if (box.children.length) pg.appendChild(box);
        const probs = (list, room) => list.forEach((q, n) => {
            const it = el("div", "sh-prob"); const qq = el("p", "sh-q"); qq.appendChild(el("b", null, (n + 1) + ". ")); qq.appendChild(rich(q.q)); it.appendChild(qq);
            if (key) { const a = el("p", "sh-ans"); a.appendChild(el("b", null, "Answer: ")); a.appendChild(rich(q.a)); if (q.work) { a.appendChild(document.createTextNode("   ")); a.appendChild(R("i", null, q.work)); } it.appendChild(a); }
            else { if (room !== "exit") it.appendChild(el("p", "sh-worklbl", "Work:")); it.appendChild(el("div", "sh-workspace " + (room || "small"))); }
            pg.appendChild(it);
        });
        const last = k === w.pages.length - 1, ex = last && (w.exit || []).length;
        probs(p.problems || [], ex ? "tight" : "");
        if (ex) {
            pg.appendChild(el("h2", null, "Exit Ticket (turn in before leaving)"));
            if (!key) { const nr = el("p", "sh-name"); [["Name:", "w30"], ["Period:", "w8"]].forEach(([t, ww]) => { nr.appendChild(el("b", null, t + " ")); nr.appendChild(el("span", "rule " + ww)); }); pg.appendChild(nr); }
            probs(w.exit, "exit");
        }
    });
    requestAnimationFrame(() => { if (sh.isConnected) { fitSpace(sh); sh.dispatchEvent(new CustomEvent("paged")); } });
    return sh;
}

/* ---------- Sudoku: 4 puzzles on 2 pages, a unique answer each, the same puzzles every time for a week ---------- */
function rng(seed) { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e9) / 1e9; }; }
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const ok = (g, i, v) => { const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3; for (let k = 0; k < 9; k++) { if (g[r * 9 + k] === v || g[k * 9 + c] === v || g[(br + Math.floor(k / 3)) * 9 + bc + k % 3] === v) return false; } return true; };
function fill(g, r) { const i = g.indexOf(0); if (i < 0) return true; for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r)) { if (ok(g, i, v)) { g[i] = v; if (fill(g, r)) return true; g[i] = 0; } } return false; }
function count(g, cap) { const i = g.indexOf(0); if (i < 0) return 1; let n = 0; for (let v = 1; v <= 9 && n < cap; v++) if (ok(g, i, v)) { g[i] = v; n += count(g, cap - n); g[i] = 0; } return n; }
/** One puzzle: { puzzle, solution } with about `clues` givens and exactly one solution. */
export function makeSudoku(seed, clues) {
    const r = rng(seed), sol = new Array(81).fill(0); fill(sol, r);
    const puz = sol.slice(); let left = 81;
    for (const i of shuffle([...Array(81).keys()], r)) { if (left <= clues) break; const keep = puz[i]; puz[i] = 0; if (count(puz.slice(), 2) !== 1) puz[i] = keep; else left--; }
    return { puzzle: puz, solution: sol };
}
function grid(cells, given) {
    const t = el("table", "sdk"); for (let r = 0; r < 9; r++) { const tr = el("tr"); for (let c = 0; c < 9; c++) { const v = cells[r * 9 + c], td = el("td", given && given[r * 9 + c] ? "g" : "", v ? String(v) : ""); tr.appendChild(td); } t.appendChild(tr); } return t;
}
export function sudokuSheet(week, cid, key) {
    const sh = sheet("ssudoku", key), levels = [[38, "Warm-up"], [34, "Easy"], [31, "Medium"], [28, "Challenge"]];
    const puzzles = levels.map(([n], k) => makeSudoku((week.id || "") + "|" + cid + "|" + k, n));
    for (let p = 0; p < 2; p++) {
        const pg = page(sh);
        if (p === 0) { pg.appendChild(el("h1", "sh-title", (key ? "TEACHER KEY: " : "") + "Sudoku Early Finishers")); pg.appendChild(el("p", "sh-sub", key ? "Teacher only." : "Fill every row, column, and 3 × 3 box with the digits 1 to 9. Use each digit once in each.")); if (!key) nameRow(pg); }
        const two = el("div", "sdk-two");
        [0, 1].forEach((k) => { const n = p * 2 + k, box = el("div", "sdk-box"); box.appendChild(el("h2", null, "Puzzle " + (n + 1) + " (" + levels[n][1] + ")")); box.appendChild(key ? grid(puzzles[n].solution, puzzles[n].puzzle) : grid(puzzles[n].puzzle, puzzles[n].puzzle)); two.appendChild(box); });
        pg.appendChild(two);
    }
    return sh;
}

/* ---------- long tables or lists flow onto more pages ---------- */
// After layout, anything below the first page's bottom moves to a new page (lists and tables are split by item, keeping the table header).
function paginate(sh) {
    requestAnimationFrame(() => {
        if (!sh.isConnected) return;
        let pg = sh.querySelector(".sh-page"), guard = 0;
        while (pg && pg.scrollHeight - pg.clientHeight > 2 && guard++ < 20) {
            const limit = pg.getBoundingClientRect().top + pg.clientHeight;
            const items = []; [...pg.children].forEach((n) => { if (n.classList.contains("sh-qlist")) items.push(...n.children); else if (n.tagName === "TABLE") items.push(...[...n.rows].slice(1)); else items.push(n); });
            const k = items.findIndex((n) => n.getBoundingClientRect().bottom > limit);
            if (k <= 0) break;
            const first = items[k], box = first.parentElement === pg ? null : (first.tagName === "TR" ? first.closest("table") : first.parentElement);
            const next = el("div", "sh-page"); pg.after(next);
            let after = box || first;
            if (box) {
                const nb = box.cloneNode(false); if (first.tagName === "TR") nb.appendChild(box.rows[0].cloneNode(true));
                let n = first; while (n) { const z = n.nextElementSibling; nb.appendChild(n); n = z; } next.appendChild(nb); after = box.nextElementSibling;
            }
            let n = after; while (n) { const z = n.nextElementSibling; next.appendChild(n); n = z; }
            pg = next;
        }
        fitSpace(sh);
        sh.dispatchEvent(new CustomEvent("paged"));
    });
}
/** Share each page's empty space evenly among its work spaces (between about 1/3 and 1.4 inches), so every page is full and none spills. */
function fitSpace(sh) {
    sh.querySelectorAll(".sh-page").forEach((pg) => {
        const ws = [...pg.querySelectorAll(".sh-workspace")]; if (!ws.length) return;
        ws.forEach((w) => { w.style.height = "1px"; });   // not 0, so margins do not collapse through it while measuring
        const end = el("div"); end.style.height = "1px"; pg.appendChild(end);   // its top sits below every margin
        const used = end.getBoundingClientRect().top - pg.getBoundingClientRect().top; end.remove();
        const free = pg.clientHeight - used - 12;
        const each = Math.max(24, Math.min(134, Math.floor(free / ws.length) + 1));
        ws.forEach((w) => { w.style.height = each.toFixed(1) + "px"; });
    });
}
