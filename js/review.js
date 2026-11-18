/* ==========================================
   Focal — Week Review (review.html).
   Shows the week Claude saved (teacher/{uid}/weekfiles/<id>) next to the plan it was built from
   (plans/<id>), runs the site's checks, lets the teacher fix any line in place, and Approve puts the
   week on the board, Planner, Library and Home (weekfiles/index). Math is recomputed by Claude before
   saving (the week carries a "checked" stamp); the page shows that stamp and flags any answer edited after it.
   ?demo keeps everything on this device. ?week=week6 opens a given week.
========================================== */
import { WEEKS as PUBLISHED } from "../data/weeks.js?v=58";
import { SCHOOL_YEAR, addDays, today, mondayOf, isSchoolDay, nineWeeksOf, parse } from "./schoolCal.js?v=58";
import { weekIdFor } from "./weeksLive.js?v=58";

const qs = new URLSearchParams(location.search), demo = qs.has("demo");
const store = await import(demo ? "./localStore.js?v=58" : "./boardStore.js?v=58");
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const LABEL = { "8th": "8th Grade", "7th": "7th Grade", "8th-acc": "8th Accelerated" };

let index = { weeks: [] }, id = "", week = null, plan = null, cls = "8th", dirty = false, my = 0;

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
        const sd = c.speedDating;
        if (sd && Array.isArray(sd.cards)) {
            const qsx = sd.cards.map((x) => String((x && x.q) || "").trim().toLowerCase());
            if (sd.cards.length !== 40) bad(L + ": speed dating has " + sd.cards.length + " cards, not 40.");
            if (new Set(qsx).size !== qsx.length) bad(L + ": two speed dating cards are the same.");
            sd.cards.forEach((x, n) => {
                const wr = Array.isArray(x.wrong) ? x.wrong : [];
                if (!x.a) bad(L + ": speed dating card " + (n + 1) + " has no answer.");
                else if (!wr.length) warn(L + ": speed dating card " + (n + 1) + " has no likely wrong answers.");
                else if (wr.some((v) => String((v && v.a) || v).trim() === String(x.a).trim())) bad(L + ": a likely wrong answer on card " + (n + 1) + " equals the answer.");
            });
        }
        (c.links || []).forEach((l) => { if (BADLINK.test((l.t || "") + " " + (l.u || ""))) bad(L + ": the link “" + (l.t || l.u) + "” looks like a key, test or Jeopardy board. Only student files are linked."); });
    });
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
    const pr = el("a", "btn ghost", "Print in Week Builder"); pr.href = "builder.html"; pr.style.textDecoration = "none"; box.appendChild(pr);
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
            if (d.notes) card.appendChild(el("p", "rv-extras", "Guided notes: " + (d.notes.title || "") + " · " + ((d.notes.examples || []).length) + " worked examples · " + ((d.notes.practice || []).reduce((a, p) => a + (p.problems || []).length, 0)) + " practice problems"));
        }
        box.appendChild(card);
    });
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
        try {
            const w = JSON.parse(await f.text());
            if (!w || w.id !== id || !w.classes || !Object.values(w.classes).every((c) => Array.isArray(c.days) && c.days.length === 5)) { status(w && w.id && w.id !== id ? "That file is " + w.id + ", not " + id : "That file is not a week file", "bad"); return; }
            week = w; await saveWeek(); draw();
        } catch (e) { status("That file is not a week file", "bad"); }
    };
    s.appendChild(lab);
    box.appendChild(s);
}
function draw() { drawPick(); summary(); $("checks").textContent = ""; $("actions").textContent = ""; if (week) { drawChecks(); drawClass(); } else emptyState(); }

/* ---------- save and approve ---------- */
async function saveWeek() {
    status("Saving…");
    try { await store.save("weekfiles/" + id, { json: JSON.stringify(week), at: Date.now() }); dirty = false; $("saveBtn").hidden = true; status(demo ? "This device only" : "Saved", "ok"); drawChecks(); }
    catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
}
async function setApproved(on) {
    const list = (index.weeks || []).filter((x) => x && x.id !== id);
    list.push({ id, label: week.label || id, dates: week.dates || "", monday: week.monday || "", approved: !!on, at: Date.now() });
    list.sort((a, b) => String(a.monday).localeCompare(String(b.monday)));
    status("Saving…");
    try { await store.save("weekfiles/index", { weeks: list, at: Date.now() }); index = { weeks: list }; status(demo ? "This device only" : "Saved", "ok"); summary(); drawActions(); }
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
    status(demo ? "This device only" : "Live", "ok");
    let first = true;
    store.watch("weekfiles/index", (s) => {
        if (s.pending) return; index = (s.exists && s.data && Array.isArray(s.data.weeks)) ? s.data : { weeks: [] };
        if (first) { first = false; const w = qs.get("week"); const c = candidates(); const notBuilt = c.find((x) => !PUBLISHED.some((p) => p.id === x.id) && !(index.weeks || []).some((y) => y.id === x.id && y.approved));
            openWeek(w && /^(week|q\d+w)\d+$/.test(w) ? w : (notBuilt || c[0] || { id: "week6" }).id); }
        else if (id) { drawPick(); summary(); drawActions(); }
    }, () => { if (first) { first = false; openWeek(qs.get("week") || candidates()[0].id); } });
}
