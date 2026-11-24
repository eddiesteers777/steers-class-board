/* ==========================================
   Focal — Week Review (review.html).
   Shows the week Claude saved (teacher/{uid}/weekfiles/<id>) next to the plan it was built from
   (plans/<id>), runs the site's checks, lets the teacher fix any line in place, and Approve puts the
   week on the board, Planner, Library and Home (weekfiles/index). Math is recomputed by Claude before
   saving (the week carries a "checked" stamp); the page shows that stamp and flags any answer edited after it.
   ?demo keeps everything on this device. ?week=week6 opens a given week.
========================================== */
import { WEEKS as PUBLISHED } from "../data/weeks.js?v=62";
import { SCHOOL_YEAR, addDays, today, mondayOf, isSchoolDay, nineWeeksOf, parse } from "./schoolCal.js?v=59";
import { weekIdFor } from "./weeksLive.js?v=58";
import { publishWeek, unpublishWeek, classUrl, parentMessage } from "./publish.js?v=60";
import { closeoutItems, drawCloseout } from "./closeout.js?v=3";
import { repeats, saveBankWeek, extract } from "./bank.js?v=2";
import { figuresIn, isFunction, stripFigures } from "./figures.js?v=1";
import { bankFor, openBankPicker } from "./bankPick.js?v=2";
import { STANDARDS } from "../data/standards.js?v=58";
import { allPapers } from "./weekPapers.js?v=1";
import { printPapers, saveToDrive } from "./weekPack.js?v=1";
import * as Drive from "./drive.js?v=2";
import { buildWeekSlides, plannedDecks } from "./weekSlides.js?v=2";

const qs = new URLSearchParams(location.search), demo = qs.has("demo");
const store = await import(demo ? "./localStore.js?v=58" : "./boardStore.js?v=58");
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const LABEL = { "8th": "8th Grade", "7th": "7th Grade", "8th-acc": "8th Accelerated" };

let index = { weeks: [] }, id = "", week = null, plan = null, cls = "8th", dirty = false, my = 0, uid = "", parentSet = { questions: "" }, co = {}, coSet = {}, bank = [];
const canPublish = () => !!(store.rooms && uid);

/* ---------- which weeks ---------- */
const isSchoolWeek = (m) => [0, 1, 2, 3, 4].some((i) => isSchoolDay(addDays(m, i)));
function weekNumber(m) { const q = nineWeeksOf(m); if (!q) return null; let n = 0; for (let d = mondayOf(q.start); d < m; d = addDays(d, 7)) if (isSchoolWeek(d)) n++; return { id: weekIdFor(n, q.n), label: "Week " + n, monday: m }; }
function candidates() {   // this school week and the next four, plus any week in the index
    const out = new Map(); let m = mondayOf(today());
    for (let i = 0; i < 12 && out.size < 5 && m <= SCHOOL_YEAR.last; i++, m = addDays(m, 7)) if (isSchoolWeek(m)) { const w = weekNumber(m); if (w) out.set(w.id, w); }
    (index.weeks || []).forEach((w) => { if (w && w.id && !out.has(w.id)) out.set(w.id, { id: w.id, label: w.label || w.id, monday: w.monday || "" }); });
    return [...out.values()].sort((a, b) => String(a.monday).localeCompare(String(b.monday)));
}
const fmtDay = (iso) => parse(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

/* ---------- checks ---------- */
const BADLINK = /\b(key|keys|test|jeopardy|answers?)\b/i;
const plain = (t) => String(t == null ? "" : t).replace(/(\d)\{/g, "$1 ").replace(/[{}]/g, "").replace(/§/g, "$");
function checks(w, p) {
    const out = [], bad = (t) => out.push(["bad", t]), warn = (t) => out.push(["warn", t]), ok = (t) => out.push(["ok", t]);
    if (!w || !w.classes) { bad("The saved week has no classes."); return out; }
    const want = p && p.classes ? Object.keys(p.classes) : Object.keys(LABEL);
    want.forEach((k) => { if (!w.classes[k]) bad((LABEL[k] || k) + " is missing from the week."); });
    if (p && w.monday && p.monday && w.monday !== p.monday) bad("The week's Monday (" + w.monday + ") is not the plan's Monday (" + p.monday + ").");
    let probs = 0, edited = 0;
    Object.entries(w.classes).forEach(([k, c]) => {
        const L = LABEL[k] || c.label || k;
        if (!Array.isArray(c.days) || c.days.length !== 5) { bad(L + " does not have 5 days."); return; }
        c.days.forEach((d, i) => {
            const date = w.monday ? addDays(w.monday, i) : "", school = date ? isSchoolDay(date) : true, where = L + ", " + DAYS[i];
            if (date && d.date && d.date !== fmtDay(date)) bad(where + ": the date says " + d.date + " but should be " + fmtDay(date) + ".");
            if (!school) { if (!/no school/i.test(d.agendaLine || "")) warn(where + " is a day off on the district calendar but is not marked No School."); return; }
            if (!(d.agendaLine || "").trim()) bad(where + " has no agenda line.");
            if (!(d.lt || "").trim()) bad(where + " has no learning target.");
            const ps = d.problems || [];
            if (!ps.length) warn(where + " has no bellringer problems.");
            ps.forEach((q, n) => { probs++; if (q.edited) edited++; if (!(q.q || "").trim() || !(q.a || "").trim()) bad(where + ", bellringer " + (n + 1) + " is missing its " + (!(q.q || "").trim() ? "question" : "answer") + "."); });
            if (d.notes && Array.isArray(d.notes.exit) && d.notes.exit.some((x) => x && x.a)) warn(where + ": exit ticket answers are in the week. They should stay on the paper key only.");
        });
        const pc = p && p.classes && p.classes[k];
        if (pc && pc.assess && pc.assess.kind !== "none") {
            const di = DK.indexOf(pc.assess.day), d = c.days[di];
            if (d && !/quiz|test/i.test((d.agendaLine || "") + " " + (d.agenda || []).join(" "))) warn(L + ": the plan has a " + pc.assess.kind + " on " + DAYS[di] + ", but that day does not mention it.");
        }
        // The teacher's own bellringer picks (Plan the Week, day plans) must be in the week as picked.
        ((pc && pc.day) || []).forEach((pd, i) => {
            if (pd && (pd.lt || "").trim() && c.days[i] && String(c.days[i].lt || "").replace(/^I can\s*/i, "").trim().toLowerCase() !== pd.lt.replace(/^I can\s*/i, "").trim().toLowerCase()) warn(L + ", " + DAYS[i] + ": the learning target is not the one in your day plan (“" + pd.lt.trim() + "”).");
            const picks = (pd && pd.bell) || []; if (!picks.length || !c.days[i]) return;
            const have = new Set((c.days[i].problems || []).map((q) => String(q.q).trim()));
            const miss = picks.filter((b) => !have.has(String(b.q).trim())).length;
            if (miss) warn(L + ", " + DAYS[i] + ": " + miss + " of the " + picks.length + " bellringers you picked " + (miss === 1 ? "is" : "are") + " not in the week. Use “Use my picks” on that day.");
        });
        const sd = c.speedDating;
        if (sd && Array.isArray(sd.cards)) {
            const qsx = sd.cards.map((x) => String((x && x.q) || "").trim().toLowerCase()), noWrong = [];
            if (sd.cards.length !== 40) bad(L + ": speed dating has " + sd.cards.length + " cards, not 40.");
            if (new Set(qsx).size !== qsx.length) bad(L + ": two speed dating cards are the same.");
            sd.cards.forEach((x, n) => {
                const wr = Array.isArray(x.wrong) ? x.wrong : [];
                if (!x.a) bad(L + ": speed dating card " + (n + 1) + " has no answer.");
                else if (!wr.length) noWrong.push(n + 1);
                else if (wr.some((v) => String((v && v.a) || v).trim() === String(x.a).trim())) bad(L + ": a likely wrong answer on card " + (n + 1) + " equals the answer.");
            });
            if (noWrong.length) warn(L + ": " + (noWrong.length === sd.cards.length ? "no speed dating card has" : "speed dating " + (noWrong.length === 1 ? "card " : "cards ") + noWrong.join(", ") + (noWrong.length === 1 ? " has" : " have")) + " likely wrong answers for the key." + (sd.cards.some((x) => x && x.src === "bank") ? " Bank problems carry answers only; add the common mistakes by hand or ask Claude." : ""));
        }
        // Quiz or test, the modified group's papers, and sub days: the papers Week Builder prints (js/moreSheets.js)
        const qz = c.quiz, sameAns = (x, v) => String((v && v.a) || v).trim() === String(x.a).trim();
        if (pc && pc.assess && pc.assess.kind !== "none" && !pc.assess.teacherWrites) {
            if (!qz || !(qz.items || []).length) warn(L + ": the plan has a " + pc.assess.kind + " on " + DAYS[DK.indexOf(pc.assess.day)] + ", but the week has no " + pc.assess.kind + " to print.");
            else if (qz.day != null && DK[qz.day] !== pc.assess.day) bad(L + ": the " + pc.assess.kind + " is set for " + DAYS[qz.day] + " but the plan says " + DAYS[DK.indexOf(pc.assess.day)] + ".");
        }
        if (qz && (qz.items || []).length) {
            const pts = qz.items.reduce((a, x) => a + (+x.pts || 2), 0);
            qz.items.forEach((x, n) => {
                if (!String(x.a || "").trim()) bad(L + ": " + (qz.kind || "quiz") + " question " + (n + 1) + " has no answer.");
                else if (Array.isArray(x.choices) && x.choices.length && !String(x.a).split(/\s*;\s*/).every((v) => x.choices.includes(v))) bad(L + ": " + (qz.kind || "quiz") + " question " + (n + 1) + ": the answer is not one of its choices.");
                if (Array.isArray(x.wrong) && x.wrong.some((v) => sameAns(x, v))) bad(L + ": a likely wrong answer on " + (qz.kind || "quiz") + " question " + (n + 1) + " equals the answer.");
            });
            ok(L + ": " + (qz.kind || "quiz") + " ready to print, " + qz.items.length + " questions, " + pts + " points.");
            const m = qz.modified;
            if (k === "8th" && !m) warn("8th Grade: the modified group has no quiz of its own this week.");
            if (m) {
                (m.items || []).forEach((x, n) => { if (!Array.isArray(x.choices) || x.choices.length !== 3) bad("Modified quiz question " + (n + 1) + " needs exactly 3 choices."); else if (!x.choices.includes(x.a)) bad("Modified quiz question " + (n + 1) + ": the answer is not one of its choices."); });
                if ((m.bonus || []).length !== 6) warn("The modified quiz has " + (m.bonus || []).length + " bonus questions; the standing format is 6 (B1 to B6).");
            }
        }
        if (k === "8th" && qz && qz.kind === "test" && !c.modStudyGuide) warn("8th Grade: test week, but the modified group has no study guide in the week.");
        if (k === "8th") {
            const noMod = c.days.map((d, i) => (d && d.notes && !d.modNotes ? DAYS[i] : "")).filter(Boolean);
            if (noMod.length) warn("8th Grade: " + noMod.join(", ") + (noMod.length === 1 ? " has" : " have") + " guided notes but no modified notes for the 4-student group.");
            if (c.homework && !c.modHomework) warn("8th Grade: the modified group has no homework packet this week.");
            c.days.forEach((d, i) => { const n = d && d.modNotes; if (!n) return; [...(n.examples || []).map((x) => x.turn).filter(Boolean), ...(n.practice || [])].forEach((x, j) => { if (!String(x.a || "").trim()) bad("8th Grade, " + DAYS[i] + ": a modified notes problem has no answer (" + plain(x.q).slice(0, 40) + ")."); }); });
            ((c.modHomework && c.modHomework.days) || []).forEach((d) => (d.problems || []).forEach((x) => { if (!String(x.a || "").trim()) bad("8th Grade: a modified homework problem for " + DAYS[d.day] + " has no answer."); }));
        }
        if (c.modStudyGuide && (c.modStudyGuide.parts || []).length !== 3) bad("The modified study guide has " + (c.modStudyGuide.parts || []).length + " parts; it needs 3 so it prints on exactly 4 pages.");
        const sub = c.sub, outDays = p && Array.isArray(p.days) ? p.days.map((d, i) => (d && d.type === "out" ? i : -1)).filter((i) => i >= 0) : [];
        outDays.forEach((i) => {
            if (!sub || sub.day !== i) { bad(L + ": " + DAYS[i] + " is a sub day, but there is no sub plan for it."); return; }
            const pd = p.days[i], ws = sub.worksheet, before = out.filter((x) => x[0] === "bad").length;
            if (!ws || (ws.pages || []).length !== 4) bad(L + ": the sub worksheet needs 4 parts (one per page); it has " + ((ws && ws.pages) || []).length + ".");
            else if (!(ws.exit || []).length) warn(L + ": the sub worksheet has no exit ticket.");
            (((ws && ws.pages) || []).flatMap((x) => x.problems || []).concat((ws && ws.exit) || [])).forEach((x, n) => { if (!String(x.a || "").trim()) bad(L + ": sub worksheet problem " + (n + 1) + " has no answer."); });
            if (pd.minutes && +(sub.minutes || 55) !== +pd.minutes) bad(L + ": the plan says " + pd.minutes + "-minute periods on " + DAYS[i] + ", but the sub plan uses " + (sub.minutes || 55) + ".");
            const mine = { "8th": ["1st", "2nd", "4th"], "7th": ["5th"], "8th-acc": ["6th"] }[k] || [], meet = pd.periods ? mine.filter((x) => pd.periods.includes(x)) : mine, has = sub.periods || mine;
            if (meet.join() !== has.join()) bad(L + ": the sub plan lists " + (has.join(", ") || "no periods") + " but " + (meet.join(", ") || "none of this class's periods") + " meet on " + DAYS[i] + ".");
            else if (out.filter((x) => x[0] === "bad").length === before) ok(L + ": sub day ready to print (sub plan, 4-page worksheet, Sudoku) for " + meet.join(", ") + ".");
        });
        if (sub && !outDays.includes(sub.day)) warn(L + ": there is a sub plan for " + DAYS[sub.day] + ", but the plan does not mark that day \u201cI'm out\u201d.");
        (c.links || []).forEach((l) => { if (BADLINK.test((l.t || "") + " " + (l.u || ""))) bad(L + ": the link “" + (l.t || l.u) + "” looks like a key, test or Jeopardy board. Only student files are linked."); });
    });
    const ws8 = w.classes["8th"] && w.classes["8th"].sub && w.classes["8th"].sub.worksheet, wsA = w.classes["8th-acc"] && w.classes["8th-acc"].sub && w.classes["8th-acc"].sub.worksheet;
    if (ws8 && wsA && JSON.stringify(ws8.pages) === JSON.stringify(wsA.pages)) bad("8th Accelerated and 8th Grade have the same sub worksheet. Accelerated never shares a paper with Regular.");
    if (p && Array.isArray(p.days) && p.days.some((d) => d && d.type === "out")) out.push(["info", "Sub day: once this week is approved, the guest board (sub.html) on the classroom computer shows it."]);
    // Pictures: "is it a function?" answers must agree with the graph, table or mapping diagram drawn.
    let figs = 0;
    extract(w).forEach((x) => {
        const fs = figuresIn(x.q); if (!fs.length) return; figs += fs.length;
        if (fs.length !== 1) return;
        const a = String(x.a).toLowerCase(), says = /\bnot\b|^no\b/.test(a) ? false : /\bfunction\b|^yes\b/.test(a) ? true : null, is = isFunction(fs[0]);
        if (says !== null && is !== null && says !== is) bad((LABEL[x.cls] || x.cls) + ", " + x.kind.toLowerCase() + ": the answer says " + (says ? "it is a function" : "it is not a function") + ", but the " + (fs[0].type === "map" ? "mapping diagram" : fs[0].type) + (is ? " shows a function" : " does not show a function") + ": \u201c" + plain(stripFigures(x.q)).slice(0, 60) + "\u201d.");
    });
    if (figs) out.push(["info", figs + (figs === 1 ? " picture" : " pictures") + " (graphs, tables, mapping diagrams) in the week."]);
    const rp = repeats(w, bank);
    if (rp.same.length) rp.same.slice(0, 6).forEach((x) => bad((LABEL[x.cls] || x.cls) + ": the same " + x.kind.toLowerCase() + " question is in the week twice: \u201c" + plain(x.q).slice(0, 70) + "\u201d."));
    if (rp.earlier.length) out.push(["info", rp.earlier.length + (rp.earlier.length === 1 ? " question was" : " questions were") + " already used in an earlier week (fine as spiral review; the key should say so)."]);
    const ck = w.checked;
    if (ck && ck.n) ok(ck.n + " answers recomputed by Claude" + (ck.at ? " on " + new Date(ck.at).toLocaleDateString([], { month: "short", day: "numeric" }) : "") + ".");
    else warn("The answers do not carry Claude's check yet. Ask Claude to check this week before approving.");
    if (edited) warn(edited + (edited === 1 ? " answer was" : " answers were") + " changed by hand after the check. Look at " + (edited === 1 ? "it" : "them") + " once more.");
    if (!out.some((x) => x[0] !== "ok")) ok("Every day has its agenda, target and bellringers, and the dates match the calendar.");
    out.push(["info", probs + " bellringer problems in all."]);
    return out;
}

/* ---------- drawing ---------- */
function seg(items, cur, onPick, label) {
    const g = el("div", "pl-seg"); g.setAttribute("role", "group"); g.setAttribute("aria-label", label);
    items.forEach(([v, t]) => { const b = el("button", null, t); b.type = "button"; b.setAttribute("aria-pressed", String(v === cur)); b.onclick = () => onPick(v); g.appendChild(b); });
    return g;
}
function edit(v, on, label, cls2) { const i = el("input", "pw-in" + (cls2 ? " " + cls2 : "")); i.type = "text"; i.value = v || ""; i.setAttribute("aria-label", label); i.oninput = () => { on(i.value); touch(); }; return i; }
/* A hand edit after Claude's check is flagged until it matches the checked wording again. */
function mark(q, k, v) {
    if (!q.orig) q.orig = { q: q.q, a: q.a };
    q[k] = v; q.edited = q.q !== q.orig.q || q.a !== q.orig.a;
    if (!q.edited) { delete q.edited; delete q.orig; }
}
function touch() { dirty = true; $("saveBtn").hidden = false; status("Not saved", "wait"); drawChecks(); }
const approved = () => (index.weeks || []).some((x) => x.id === id && x.approved);

function drawPick() {
    const box = $("weeks"); box.textContent = "";
    box.appendChild(seg(candidates().map((w) => [w.id, w.label + (w.monday ? " · " + parse(w.monday).toLocaleDateString([], { month: "short", day: "numeric" }) : "")]), id, (v) => { if (dirty && !confirm("Leave without saving your changes?")) return; openWeek(v); }, "Week"));
}
function summary() {
    const box = $("summary"); box.textContent = "";
    const tile = (big, small, accent) => { const t = el("div", "pl-tile" + (accent ? " accent" : "")); t.appendChild(el("b", null, big)); t.appendChild(el("span", null, small)); box.appendChild(t); };
    const c = week ? checks(week, plan) : [], nb = c.filter((x) => x[0] === "bad").length, nw = c.filter((x) => x[0] === "warn").length;
    tile(week ? (week.label || id) : (plan ? plan.label : id), week ? (week.dates || "") : (plan ? plan.dates : ""), true);
    tile(plan ? (plan.status === "sent" ? "Sent" : "Draft") : "No plan", plan ? (plan.status === "sent" ? "Plan sent to Claude" : "Plan not sent yet") : "Start in Plan the Week");
    tile(week ? (nb ? nb + " to fix" : nw ? nw + " to look at" : "Clean") : "—", week ? "Checks" : "Waiting for Claude");
    tile(approved() ? "On the board" : "Not approved", approved() ? "Board, Planner, Library and Home show it" : "Approve to put it on the board");
}
function drawChecks() {
    const box = $("checks"); box.textContent = ""; if (!week) return;
    const list = el("ul", "rv-checks");
    checks(week, plan).forEach(([lvl, t]) => { const li = el("li", "rv-" + lvl); li.appendChild(el("span", "rv-dot", lvl === "bad" ? "Fix" : lvl === "warn" ? "Look" : lvl === "ok" ? "OK" : "")); li.appendChild(el("span", null, t)); list.appendChild(li); });
    box.appendChild(list); summary(); drawActions();
}
function drawActions() {
    const box = $("actions"); box.textContent = ""; if (!week) return;
    const nb = checks(week, plan).filter((x) => x[0] === "bad").length;
    if (approved()) {
        box.appendChild(el("p", "pw-sendp", "This week is on the board, Planner, Library and Home. Edits you save show there right away."));
        const off = el("button", "btn ghost", "Take it off the board"); off.type = "button"; off.onclick = () => setApproved(false); box.appendChild(off);
    } else {
        box.appendChild(el("p", "pw-sendp", nb ? "Fix the items marked Fix, then approve." : "Approving puts this week on the board, Planner, Library and Home for every period."));
        const ap = el("button", "btn go big", "Approve and put it on the board"); ap.type = "button"; ap.disabled = !!nb || dirty; if (dirty) ap.title = "Save your changes first"; ap.onclick = () => setApproved(true); box.appendChild(ap);
    }
    if (approved() && plannedDecks(week).length) {
        const sl = el("div", "rv-slides");
        sl.appendChild(el("p", "pw-sendp", slideNote || "Approving made each lesson's slides from the plan: Today, the bellringers with answers, then the notes steps. Change them in Board Builder > Slides."));
        const mk = el("button", "btn ghost", "Make slides for lessons that have none"); mk.type = "button"; mk.disabled = slideBusy; mk.onclick = () => makeSlides();
        const op = el("a", "btn ghost", "Open Board Builder slides"); op.href = "studio.html" + (demo ? "?demo" : "") + "#slides"; op.style.textDecoration = "none";
        const ra = el("div", "rv-acts"); ra.append(mk, op); sl.appendChild(ra); box.appendChild(sl);
    }
    const pr = el("a", "btn ghost", "Change one paper in Week Builder"); pr.href = "builder.html?week=" + id + (demo ? "&demo" : ""); pr.style.textDecoration = "none"; box.appendChild(pr);
    drawPaper(); drawPages(); drawClose();
}
/* Slides: made from the plan for every lesson that has none (js/weekSlides.js). */
let slideBusy = false, slideNote = "";
async function makeSlides() {
    if (slideBusy || !week) return; slideBusy = true; slideNote = "Making slides…"; drawActions();
    try {
        const r = await buildWeekSlides(store, week, (t) => { slideNote = t; const n = document.querySelector(".rv-slides .pw-sendp"); if (n) n.textContent = t; });
        const bits = [];
        if (r.made) bits.push("Made slides for " + r.made + (r.made === 1 ? " lesson" : " lessons"));
        if (r.kept) bits.push(r.kept + (r.kept === 1 ? " lesson already had slides and was" : " lessons already had slides and were") + " left as " + (r.kept === 1 ? "it was" : "they were"));
        if (r.failed) bits.push(r.failed + (r.failed === 1 ? " lesson" : " lessons") + " could not be reached. Tap Make slides to try again");
        slideNote = (bits.join(". ") || "No lessons to make slides for") + ". Change any of them in Board Builder > Slides.";
    } catch (e) { slideNote = "Slides were not made (" + ((e && e.code) || (e && e.message) || "connection") + "). Tap Make slides to try again."; }
    finally { slideBusy = false; drawActions(); }
}
/* Paper for this week: every student paper and key, in Drive order. Print a class's set in one go, or save it all to Drive as Google Docs. */
let paperBusy = false, paperNote = "", paperLinks = {};
function drawPaper() {
    const box = $("paper"); if (!box) return; box.textContent = ""; if (!week) return;
    const groups = allPapers(week, { guestUrl: new URL("sub.html", location.href).href });
    box.appendChild(el("h2", "rv-h2", "Paper for this week"));
    box.appendChild(el("p", "rv-extras", "Everything to print, in your Drive order: 0 Weekly first, then Monday to Friday, each key right after its paper. In the print window, pick your printer or Save as PDF."));
    const list = el("div", "pk-classes");
    groups.forEach((g) => {
        const card = el("section", "pw-class pk-class"), stu = g.papers.filter((p) => !p.key), keys = g.papers.filter((p) => p.key);
        card.appendChild(el("h3", null, LABEL[g.cid] || g.label));
        if (!g.papers.length) { card.appendChild(el("p", "rv-extras", "No papers in this class's week yet.")); list.appendChild(card); return; }
        card.appendChild(el("p", "pk-count", stu.length + (stu.length === 1 ? " paper" : " papers") + " and " + keys.length + (keys.length === 1 ? " key" : " keys")));
        const det = el("details", "pk-list"); det.appendChild(el("summary", null, "See the files"));
        const ol = el("ol"); g.papers.forEach((p) => { const li = el("li", p.key ? "pk-key" : "", p.file); if (p.alt) li.appendChild(el("span", "pk-alt", "Alternate Assignments")); ol.appendChild(li); }); det.appendChild(ol); card.appendChild(det);
        const acts = el("div", "rv-acts");
        const one = (label, set, kind, cls2) => {
            const b = el("button", cls2, label); b.type = "button"; b.disabled = !set.length || paperBusy;
            b.onclick = async () => {
                if (paperBusy) return; paperBusy = true; drawPaper();
                try {
                    await printPapers(week, set, (week.label || id) + " - " + kind + " (" + (LABEL[g.cid] || g.label) + ")");
                    const stamp = {}; set.forEach((p) => { stamp[p.id] = Date.now(); });
                    mergeSave("closeout/" + id, { printed: { [g.cid]: stamp } }, co).catch(() => {});   // ticks the printed papers on the close-out list
                } catch (e) { status("Could not get the papers ready (" + ((e && e.message) || "error") + ")", "bad"); }
                finally { paperBusy = false; drawPaper(); }
            };
            acts.appendChild(b);
        };
        one("Print student papers", stu, "Student papers", "btn go");
        one("Print keys", keys, "Teacher keys", "btn");
        if (paperLinks[g.cid]) { const a = el("a", "btn ghost", "Open in Drive"); a.href = "https://drive.google.com/drive/folders/" + encodeURIComponent(paperLinks[g.cid]); a.target = "_blank"; a.rel = "noopener"; a.style.textDecoration = "none"; acts.appendChild(a); }
        card.appendChild(acts); list.appendChild(card);
    });
    box.appendChild(list);
    const drive = el("div", "pk-drive");
    const sv = el("button", "btn", "Save the whole week to Google Drive"); sv.type = "button"; sv.disabled = paperBusy || demo || !groups.some((g) => g.papers.length);
    if (demo) sv.title = "Not in test mode";
    sv.onclick = () => saveWeekToDrive(groups);
    drive.appendChild(sv);
    drive.appendChild(el("p", "rv-extras pk-note", paperNote || "Makes a Google Doc for each paper in Anchor Board > Lessons > class > nine weeks > week, so you can open, change or share them. A paper already saved there is left as it is, so saving again only adds what is missing. Fractions in the Docs read ¾ style; the printed papers keep stacked fractions."));
    box.appendChild(drive);
    if (!demo) Drive.prepare();
}
async function saveWeekToDrive(groups) {
    if (paperBusy) return; paperBusy = true;
    const say = (t) => { paperNote = t; const n = document.querySelector("#paper .pk-note"); if (n) n.textContent = t; };
    drawPaper(); say("Waiting for Google…");
    try {
        const B = await import("./backup.js?v=4");
        let S = null; try { S = await B.settings(); } catch { /* asks for the account below */ }
        if (!Drive.connected()) await Drive.connect({ pick: !S || !S.account, hint: (S && S.account) || "" });
        const r = await saveToDrive(week, groups, B, say);
        paperLinks = r.folders;
        say("Saved to Google Drive: " + r.made + (r.made === 1 ? " new Doc" : " new Docs") + (r.kept ? ", " + r.kept + " already there and left as they were" : "") + "." + (r.failed.length ? " Could not save: " + r.failed.join(", ") + ". Tap again to try those." : ""));
    } catch (e) {
        say(e && e.code && String(e.code).startsWith("drive/") ? Drive.sayError(e) : "Stopped: " + ((e && e.message) || "something went wrong") + ". Tap again to finish; what is already saved stays.");
    } finally { paperBusy = false; const keep = paperNote; drawPaper(); paperNote = keep; say(keep); }
}
/* Close out the week: what is done and what is left, by class. */
function deepMerge(a, b) { const o = Object.assign({}, a || {}); Object.entries(b).forEach(([k, v]) => { o[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge(o[k], v) : v; }); return o; }
async function mergeSave(rel, patch, cur) {
    if (store.rooms && uid) await store.rooms.save("teacher/" + uid + "/" + rel, patch, true);
    else await store.save(rel, deepMerge(cur, patch));
}
function drawClose() {
    const box = $("closeout"); if (!box) return; box.textContent = ""; if (!week) return;
    const items = closeoutItems(week, plan, { approved: approved(), co, settings: coSet });
    drawCloseout(box, items, async (x, on) => {
        status("Saving…");
        try {
            if (x.setting) await mergeSave("settings/closeout", { schoology: { [x.cls]: on ? Date.now() : null } }, coSet);
            else await mergeSave("closeout/" + id, { done: { [x.key]: on ? { at: Date.now(), by: "you" } : null } }, co);
            status(demo ? "This device only" : "Saved", "ok");
        } catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); drawClose(); }
    });
}
/* Class Pages: each class's public link and its parent message, ready to paste into Thrillshare. */
function copyBtn(text, label) {
    const b = el("button", "btn", label || "Copy"); b.type = "button";
    b.onclick = async () => { try { await navigator.clipboard.writeText(typeof text === "function" ? text() : text); const o = b.textContent; b.textContent = "Copied"; setTimeout(() => (b.textContent = o), 1600); } catch (e) { status("Copy did not work on this device", "bad"); } };
    return b;
}
function drawPages() {
    const box = $("pages"); box.textContent = ""; if (!week || !approved()) return;
    box.appendChild(el("h2", "rv-h2", "Class Pages and parent messages"));
    if (!canPublish()) { box.appendChild(el("p", "rv-extras", demo ? "Class Pages are not made in this test mode." : "Class Pages could not be made from this device.")); return; }
    box.appendChild(el("p", "rv-extras", "Each class has one link that always shows the current week, with every student paper and no answers. Put it in Schoology once; it never changes."));
    const qf = el("label", "pw-field"); qf.appendChild(el("span", "pw-lab", "Questions line in every message"));
    const qi = edit(parentSet.questions, (v) => { parentSet.questions = v; }, "Questions line"); qi.placeholder = "Example: Questions? Email me at …";
    qi.oninput = () => { parentSet.questions = qi.value; clearTimeout(qi._t); qi._t = setTimeout(async () => { try { await store.save("settings/parent", parentSet); } catch (e) { /* keeps the text on screen */ } drawMsgs(); }, 600); };
    qf.appendChild(qi); box.appendChild(qf);
    const list = el("div", "rv-pages"); list.id = "rvMsgs"; box.appendChild(list); drawMsgs();
}
function drawMsgs() {
    const list = $("rvMsgs"); if (!list) return; list.textContent = "";
    Object.keys(week.classes).forEach((k) => {
        const url = classUrl(uid, k), card = el("section", "pw-class rv-page");
        card.appendChild(el("h3", null, LABEL[k] || week.classes[k].label));
        const row = el("div", "pw-prompt"); row.appendChild(el("code", null, url)); row.appendChild(copyBtn(url, "Copy link"));
        const open = el("a", "btn ghost", "Open"); open.href = url; open.target = "_blank"; open.rel = "noopener"; open.style.textDecoration = "none"; row.appendChild(open);
        card.appendChild(row);
        const msg = el("textarea", "pw-in rv-msg"); msg.rows = 12; msg.value = parentMessage(week, k, plan, url, parentSet.questions); msg.setAttribute("aria-label", (LABEL[k] || k) + " parent message");
        card.appendChild(msg);
        const acts = el("div", "rv-acts"); acts.appendChild(copyBtn(() => msg.value, "Copy message"));
        const th = el("a", "btn ghost", "Open Thrillshare"); th.href = "https://scs-schools.rooms.thrillshare.com/rooms"; th.target = "_blank"; th.rel = "noopener"; th.style.textDecoration = "none"; acts.appendChild(th);
        card.appendChild(acts); list.appendChild(card);
    });
}
function drawClass() {
    const box = $("content"); box.textContent = ""; if (!week) return;
    const keys = Object.keys(week.classes); if (!keys.includes(cls)) cls = keys[0];
    box.appendChild(seg(keys.map((k) => [k, LABEL[k] || week.classes[k].label || k]), cls, (v) => { cls = v; drawClass(); }, "Class"));
    const c = week.classes[cls], pc = plan && plan.classes && plan.classes[cls];
    const top = el("section", "pw-class");
    top.appendChild(el("h2", null, (LABEL[cls] || c.label) + (pc && pc.topic ? " · " + pc.topic : "")));
    top.appendChild(Object.assign(el("label", "pw-field"), {})).append(el("span", "pw-lab", "Weekly learning target"), edit(c.weekLT, (v) => { c.weekLT = v; }, "Weekly learning target"));
    const extras = [];
    if (c.speedDating && c.speedDating.cards) extras.push("Speed dating: " + c.speedDating.cards.length + " cards");
    if (c.homework) extras.push("Homework set");
    if (c.studyGuide) extras.push("Study guide");
    const nd = c.days.filter((d) => d.notes).length; if (nd) extras.push("Guided notes on " + nd + (nd === 1 ? " day" : " days"));
    if (extras.length) top.appendChild(el("p", "rv-extras", extras.join(" · ")));
    if (!c.speedDating && pc && pc.activity && pc.activity.type === "Speed dating") {
        const b = el("button", "btn", "Build speed dating from the bank"); b.type = "button";
        b.title = "40 different standards-bank problems for this week's standards, then the review standards, then the rest of the unit";
        b.onclick = () => buildSpeedDating(cls, pc, b);
        const row = el("div", "rv-acts"); row.appendChild(b); row.appendChild(el("span", "rv-extras", "The plan has speed dating on " + DAYS[DK.indexOf(pc.activity.day)] + " but the week has no cards."));
        top.appendChild(row);
    }
    box.appendChild(top);
    c.days.forEach((d, i) => {
        const date = week.monday ? addDays(week.monday, i) : "", school = date ? isSchoolDay(date) : true;
        const card = el("section", "pw-class rv-day" + (school ? "" : " off"));
        const h = el("div", "pw-chead"); h.appendChild(el("h2", null, DAYS[i])); h.appendChild(el("span", "pw-per", d.date || "")); if (pc && pc.plans) h.appendChild(el("span", "rv-plan", "Plan: " + pc.plans[i])); card.appendChild(h);
        const f1 = el("label", "pw-field"); f1.append(el("span", "pw-lab", "Agenda line"), edit(d.agendaLine, (v) => { d.agendaLine = v; }, DAYS[i] + " agenda line")); card.appendChild(f1);
        if (school) {
            const f2 = el("label", "pw-field"); f2.append(el("span", "pw-lab", "Learning target"), edit(d.lt, (v) => { d.lt = v; }, DAYS[i] + " learning target")); card.appendChild(f2);
            const ps = d.problems || [];
            if (ps.length) {
                const t = el("div", "rv-probs"); t.appendChild(el("span", "pw-lab", "Bellringer"));
                ps.forEach((q, n) => {
                    const r = el("div", "rv-prob"); r.appendChild(el("b", null, String(n + 1)));
                    r.appendChild(edit(q.q, (v) => { mark(q, "q", v); }, DAYS[i] + " bellringer " + (n + 1) + " question"));
                    r.appendChild(edit(q.a, (v) => { mark(q, "a", v); }, DAYS[i] + " bellringer " + (n + 1) + " answer", "rv-ans"));
                    t.appendChild(r);
                });
                card.appendChild(t);
            }
            const pd = pc && pc.day && pc.day[i];
            if (pd && ((pd.bell || []).length || pd.set || pd.asg || pd.lt || pd.note)) card.appendChild(planBox(d, pd, i));
            const sw = el("div", "rv-acts"); const pk = el("button", "btn ghost", "Add a bellringer from the bank"); pk.type = "button";
            pk.onclick = () => openBankPicker({ cls, codes: [...new Set([...((pc && pc.standards) || []), ...((pc && pc.spiral) || [])])], extra: ((STANDARDS[cls] || {}).standards || []).map((x) => x.code), stdOf: (code) => ((STANDARDS[cls] || {}).standards || []).find((x) => x.code === code),
                title: (LABEL[cls] || cls) + ", " + DAYS[i] + " bellringer", onAdd: (x) => { d.problems = [...(d.problems || []), { q: x.q, a: x.a, std: x.std, src: "bank", bankId: x.id }]; touch(); }, onClose: () => drawClass() });
            sw.appendChild(pk); card.appendChild(sw);
            if (d.notes) card.appendChild(el("p", "rv-extras", "Guided notes: " + (d.notes.title || "") + " · " + ((d.notes.examples || []).length) + " worked examples · " + ((d.notes.practice || []).reduce((a, p) => a + (p.problems || []).length, 0)) + " practice problems"));
        }
        box.appendChild(card);
    });
}
/* What the teacher planned for this day on Plan the Week: target, picked bellringers, linked materials. */
function planBox(d, pd, i) {
    const b = el("div", "rv-planbox"); b.appendChild(el("span", "pw-lab", "From your day plan"));
    const bits = [];
    if (pd.lt) bits.push("Target: " + pd.lt);
    if (pd.note) bits.push("Notes: " + pd.note);
    bits.forEach((t) => b.appendChild(el("p", "rv-extras", t)));
    if (pd.lt && String(d.lt || "").trim() !== pd.lt.trim()) { const u = el("button", "btn ghost", "Use my target"); u.type = "button"; u.onclick = () => { d.lt = pd.lt.trim(); touch(); drawClass(); }; b.appendChild(u); }
    const picks = pd.bell || [];
    if (picks.length) {
        const have = new Set((d.problems || []).map((q) => String(q.q).trim())), miss = picks.filter((x) => !have.has(String(x.q).trim()));
        b.appendChild(el("p", "rv-extras", picks.length + " picked bellringers, " + (miss.length ? miss.length + " not in the week yet." : "all in the week.")));
        if (miss.length) {
            const use = el("button", "btn", "Use my picks"); use.type = "button"; use.title = "Put your picked bellringers first; Claude's extra ones stay after them";
            use.onclick = () => { const mine = picks.map((x) => ({ q: x.q, a: x.a, std: x.std, src: "bank", bankId: x.id })), keep = (d.problems || []).filter((q) => !picks.some((x) => String(x.q).trim() === String(q.q).trim())); d.problems = mine.concat(keep).slice(0, Math.max(picks.length, (d.problems || []).length)); touch(); drawClass(); };
            b.appendChild(use);
        }
    }
    const acts = el("div", "rv-acts");
    if (pd.set) { const a = el("a", "btn ghost", "Review game: " + (pd.set.title || "set")); a.href = "maker.html?set=" + encodeURIComponent(pd.set.id); a.target = "_blank"; a.rel = "noopener"; acts.appendChild(a); }
    if (pd.asg) { const a = el("a", "btn ghost", "Assignment: " + (pd.asg.title || "") + (pd.asg.code ? " · " + pd.asg.code : "")); a.href = "assign.html?a=" + encodeURIComponent(pd.asg.id); a.target = "_blank"; a.rel = "noopener"; acts.appendChild(a); }
    if (acts.children.length) b.appendChild(acts);
    return b;
}
/* Speed dating built on the site: 40 different bank problems (week standards first, then review, then the unit). */
async function buildSpeedDating(k, pc, btn) {
    btn.disabled = true; btn.textContent = "Building…";
    const C = STANDARDS[k] || { standards: [], units: [] }, first = [...new Set([...(pc.standards || []), ...(pc.spiral || [])])];
    const unit = (C.units || []).find((u) => u.standards.some((x) => first.includes(x.code)));
    const tiers = [first, unit ? unit.standards.map((x) => x.code).filter((c) => !first.includes(c)) : []];
    const used = new Set(), cards = [];
    for (const codes of tiers) { if (cards.length >= 40 || !codes.length) continue; const got = await bankFor(k, codes, 40 - cards.length, used); got.forEach((x) => { used.add(x.id); cards.push(x); }); }
    const seen = new Set(), uniq = cards.filter((x) => { const n = String(x.q).trim().toLowerCase(); if (seen.has(n)) return false; seen.add(n); return true; });
    if (uniq.length < 40) { status("Only " + uniq.length + " different bank problems for these standards. Add a standard on Plan the Week, or ask Claude for the deck.", "bad"); btn.disabled = false; btn.textContent = "Build speed dating from the bank"; return; }
    week.classes[k].speedDating = { title: (pc.topic || "Review").replace(/^(Topic|Unit)\s+\w+:\s*/i, ""), rounds: 8, standardNote: "Built from the standards bank on Anchor Board.",
        cards: uniq.slice(0, 40).map((x) => ({ q: x.q, a: x.a, skill: x.std, std: x.std, src: "bank", bankId: x.id, wrong: [] })) };
    touch(); drawClass();
}
function emptyState() {
    const box = $("content"); box.textContent = "";
    const s = el("section", "pw-send");
    if (!plan) { s.appendChild(el("p", "pw-sendp", "There is no plan for this week yet. Start in Plan the Week, send it to Claude, and the finished week shows up here.")); const a = el("a", "btn go big", "Plan the Week"); a.href = "plan.html?week=" + id + (demo ? "&demo" : ""); a.style.textDecoration = "none"; s.appendChild(a); }
    else if (plan.status !== "sent") { s.appendChild(el("p", "pw-sendp", "The plan for " + plan.label + " is saved but not sent to Claude yet.")); const a = el("a", "btn go big", "Finish the plan"); a.href = "plan.html?week=" + id + (demo ? "&demo" : ""); a.style.textDecoration = "none"; s.appendChild(a); }
    else { s.appendChild(el("p", "pw-sendp", "Claude has the plan for " + plan.label + " but has not saved the week yet. When it does, it shows up here on its own. Paste this to Claude if you have not:")); const c = el("div", "pw-prompt"); c.appendChild(el("code", null, (plan.brief && plan.brief.prompt) || "")); s.appendChild(c); }
    // Until Claude can save straight into Anchor, the week can come in as the file Claude hands over.
    const lab = el("label", "btn ghost rv-file"); lab.textContent = "Load a week file"; const inp = el("input"); inp.type = "file"; inp.accept = ".json,application/json"; inp.hidden = true; lab.appendChild(inp);
    inp.onchange = async () => {
        const f = inp.files[0]; inp.value = ""; if (!f) return;
        loadWeekText(await f.text());
    };
    s.appendChild(lab);
    const pb = el("button", "btn ghost", "Paste a week"); pb.type = "button";
    pb.onclick = () => {
        if (s.querySelector(".rv-paste")) return;
        const w = el("div", "rv-paste"), ta = el("textarea", "pw-in"); ta.rows = 6; ta.placeholder = "Paste the week file Claude gave you (it starts with {)"; ta.setAttribute("aria-label", "Week file text");
        const go = el("button", "btn go", "Load it"); go.type = "button"; go.onclick = () => loadWeekText(ta.value);
        w.append(ta, go); s.appendChild(w); ta.focus();
    };
    s.appendChild(pb);
    box.appendChild(s);
}
/** A week file as text (from a file or pasted from a Claude chat). Code fences and text around the JSON are dropped. */
async function loadWeekText(text) {
    let w = null; const t = String(text || ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
    try { w = JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t); } catch (e) { status("That is not a week file", "bad"); return; }
    if (!w || w.id !== id || !w.classes || !Object.values(w.classes).every((c) => Array.isArray(c.days) && c.days.length === 5)) { status(w && w.id && w.id !== id ? "That week is " + w.id + ", not " + id : "That is not a week file", "bad"); return; }
    week = w; await saveWeek(); draw();
}
function draw() { drawPick(); summary(); $("checks").textContent = ""; $("actions").textContent = ""; if (week) { drawChecks(); drawClass(); } else emptyState(); }

/* ---------- save and approve ---------- */
async function saveWeek() {
    status("Saving…");
    try {
        await store.save("weekfiles/" + id, { json: JSON.stringify(week), at: Date.now() }); dirty = false; $("saveBtn").hidden = true;
        if (approved() && canPublish()) { await publishWeek(store, uid, week, plan); await saveBankWeek(store, uid, week, true); }   // keep the Class Pages and the question bank in step
        status(demo ? "This device only" : "Saved", "ok"); drawChecks();
    }
    catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
}
async function setApproved(on) {
    const list = (index.weeks || []).filter((x) => x && x.id !== id);
    list.push({ id, label: week.label || id, dates: week.dates || "", monday: week.monday || "", approved: !!on, at: Date.now() });
    list.sort((a, b) => String(a.monday).localeCompare(String(b.monday)));
    status("Saving…");
    try {
        await store.save("weekfiles/index", { weeks: list, at: Date.now() }); index = { weeks: list };
        if (canPublish()) { if (on) { await publishWeek(store, uid, week, plan); await saveBankWeek(store, uid, week, true); } else { await unpublishWeek(store, uid, id); await saveBankWeek(store, uid, week, false); } }
        status(demo ? "This device only" : on && canPublish() ? "On the board and Class Pages" : "Saved", "ok"); summary(); drawActions();
        if (on) await makeSlides();   // every lesson gets its slides from the plan; lessons that already have slides are left alone
    }
    catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
}
$("saveBtn").onclick = saveWeek;
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- open a week ---------- */
function openWeek(wid) {
    id = wid; week = null; plan = null; dirty = false; $("saveBtn").hidden = true; const me = ++my;
    history.replaceState(null, "", "?week=" + id + (demo ? "&demo" : ""));
    let got = 0; const both = () => { if (me === my && ++got >= 2) { $("skel").hidden = true; $("view").hidden = false; draw(); } };
    $("view").hidden = true; $("skel").hidden = false;
    co = {}; store.watch("closeout/" + id, (s) => { if (me !== my || s.pending) return; co = (s.exists && s.data) || {}; if (got >= 2) drawClose(); }, () => {});
    store.watch("plans/" + id, (s) => { if (me !== my || s.pending) return; plan = (s.exists && s.data) || null; if (got >= 2) { summary(); if (!week) emptyState(); else drawChecks(); } else both(); }, both);
    store.watch("weekfiles/" + id, (s) => {
        if (me !== my || s.pending || dirty) return;
        if (got >= 2 && document.activeElement && $("content").contains(document.activeElement)) return;
        let w = null; try { w = s.exists && s.data && s.data.json ? JSON.parse(s.data.json) : null; } catch (e) { w = null; }
        week = w; if (got >= 2) draw(); else both();
    }, both);
}

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    $("who").textContent = demo ? "This device only, nothing is saved" : (user.name ? "Signed in as " + user.name : "Signed in");
    status(demo ? "This device only" : "Live", "ok"); uid = user.uid || "";
    if (store.rooms && uid && store.rooms.watchAll) store.rooms.watchAll("teacher/" + uid + "/bank", (docs) => { bank = docs.flatMap((d) => (d.data && d.data.items) || []); if (week && !dirty) drawChecks(); }, () => {});
    store.watch("settings/closeout", (s) => { if (s.pending) return; coSet = (s.exists && s.data) || {}; if (week) drawClose(); }, () => {});
    store.watch("settings/parent", (s) => { if (s.pending) return; parentSet = Object.assign({ questions: "" }, (s.exists && s.data) || {}); if (week && approved() && !($("pages").contains(document.activeElement))) drawPages(); }, () => {});
    let first = true;
    store.watch("weekfiles/index", (s) => {
        if (s.pending) return; index = (s.exists && s.data && Array.isArray(s.data.weeks)) ? s.data : { weeks: [] };
        if (first) { first = false; const w = qs.get("week"); const c = candidates(); const notBuilt = c.find((x) => !PUBLISHED.some((p) => p.id === x.id) && !(index.weeks || []).some((y) => y.id === x.id && y.approved));
            openWeek(w && /^(week|q\d+w)\d+$/.test(w) ? w : (notBuilt || c[0] || { id: "week6" }).id); }
        else if (id) { drawPick(); summary(); drawActions(); }
    }, () => { if (first) { first = false; openWeek(qs.get("week") || candidates()[0].id); } });
}
