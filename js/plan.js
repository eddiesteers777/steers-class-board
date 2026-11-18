/* ==========================================
   Anchor Board — Plan the Week (plan.html). Replaces the weekly intake Sheet.
   Everything the site already knows is filled in: the dates and days off (district calendar), the next
   standards for each class (Standards page marks + district unit order), the Planner's unit for the week,
   last week's work, and the usual day pattern. The teacher changes what is different and taps Send to Claude.
   Saved privately at teacher/{uid}/plans/<weekId>: the editable plan, and on Send the "brief" Claude reads
   (dates, classes, topics, standards with their exact wording, quiz or test, roster COUNTS only, last week).
   ?demo keeps everything on this device. ?week=week6 opens a given week.
========================================== */
import { STANDARDS } from "../data/standards.js?v=58";
import { WEEKS as PUBLISHED } from "../data/weeks.js?v=59";
import { SCHOOL_YEAR, addDays, today, mondayOf, isSchoolDay, eventsOn, nineWeeksOf, daysLeftInNineWeeks, short, parse } from "./schoolCal.js?v=58";
import { nextUp } from "./standardsNext.js?v=58";
import { watchPrivateWeeks, weekIdFor } from "./weeksLive.js?v=58";

const qs = new URLSearchParams(location.search), demo = qs.has("demo");
const store = await import(demo ? "./localStore.js?v=58" : "./boardStore.js?v=58");
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const CLASSES = [["8th", "8th Grade", ["1st", "2nd", "4th"]], ["7th", "7th Grade", ["5th"]], ["8th-acc", "8th Accelerated", ["6th"]]];
const ALLPERIODS = ["1st", "2nd", "4th", "5th", "6th"];
const DAYTYPES = [["", "Regular day"], ["out", "I'm out (sub day)"], ["half", "Half day"], ["bells", "Different bells"]];
const ACTIVITIES = ["Speed dating", "Review game", "Partner challenge", "Stations", "Gallery walk", "None"];
const HOMEWORK = { "8th": "Homework Packet, Monday to Wednesday problems, due Thursday", "8th-acc": "Homework Packet, Monday to Wednesday problems, due Thursday", "7th": "Extra Practice, Monday to Wednesday, 3 problems a day" };

let WEEKS = PUBLISHED, progress = {}, planner = { weeks: {} }, rosters = {}, plan = null, mon = "", saveT = 0, dirty = false;

/* ---------- which week ---------- */
const schoolDaysOf = (m) => [0, 1, 2, 3, 4].map((i) => addDays(m, i)).filter(isSchoolDay);
const isSchoolWeek = (m) => schoolDaysOf(m).length > 0;
function weekNumber(m) {   // school weeks from the week the nine weeks starts in (that week is Week 0), as the site numbers them
    const q = nineWeeksOf(m); if (!q) return { n: 0, q: 0 };
    let n = 0; for (let d = mondayOf(q.start); d < m; d = addDays(d, 7)) if (isSchoolWeek(d)) n++;
    return { n, q: q.n };
}
const built = (m) => WEEKS.some((w) => w.monday === m);
function defaultMonday() {   // the first school week from this one on that is not built yet
    let m = mondayOf(today());
    for (let i = 0; i < 60; i++, m = addDays(m, 7)) if (isSchoolWeek(m) && !built(m)) return m;
    return mondayOf(today());
}
function stepWeek(dir) { let m = mon; for (let i = 0; i < 60; i++) { m = addDays(m, 7 * dir); if (m < mondayOf(SCHOOL_YEAR.first) || m > SCHOOL_YEAR.last) return; if (isSchoolWeek(m)) { openWeek(m); return; } } }
const fmtRange = (m) => { const a = parse(m), b = parse(addDays(m, 4)); const mo = (d) => d.toLocaleDateString([], { month: "long" }); return mo(a) + " " + a.getDate() + "–" + (mo(a) === mo(b) ? "" : mo(b) + " ") + b.getDate(); };

/* ---------- prefill ---------- */
const stdOf = (cls, code) => (STANDARDS[cls] || { standards: [] }).standards.find((s) => s.code === code);
function suggest(cls) {
    const n = nextUp(cls, progress) || { teaching: [], next: [], current: null, unitWord: "Unit" };
    const codes = [...n.teaching]; n.next.slice(0, 3).forEach((x) => { if (!codes.includes(x.code)) codes.push(x.code); });
    const unit = n.current || (n.next[0] && n.next[0].unit);
    return { codes, unit: unit ? n.unitWord + " " + unit.id + ": " + unit.name : "", options: [...new Set([...n.teaching, ...n.next.slice(0, 8).map((x) => x.code)])] };
}
function pattern(day, assess, off) {
    if (off) return "No school";
    if (assess.kind !== "none" && DK[day] === assess.day) return assess.kind === "test" ? "Test" : "Quiz";
    return ["Guided notes", "Speed dating", "Practice + study guide", "Practice", "Review"][day];
}
function freshPlan(m) {
    const { n, q } = weekNumber(m), id = weekIdFor(n, q), focus = (planner.weeks && planner.weeks[m]) || {};
    const days = DAYS.map((name, i) => { const d = addDays(m, i), ev = eventsOn(d).filter((e) => e.kind !== "note"); return { date: d, school: isSchoolDay(d), event: ev.map((e) => e.text).join(" · "), type: "" }; });
    const classes = {};
    CLASSES.forEach(([cls]) => {
        const s = suggest(cls), assess = { kind: "quiz", day: "Thu", teacherWrites: false };
        if (!days[3].school) assess.day = DK[days.map((d) => d.school).lastIndexOf(true)] || "Thu";
        classes[cls] = {
            topic: focus[cls] || s.unit, standards: s.codes.slice(0, 3), assess,
            activity: { day: "Tue", type: "Speed dating" },
            plans: days.map((d, i) => pattern(i, assess, !d.school)), homework: HOMEWORK[cls], notes: ""
        };
    });
    return { id, n, nineWeeks: q, monday: m, label: "Week " + n, dates: fmtRange(m), days, schedule: "", shared: "", classes, status: "draft", at: 0 };
}

/* ---------- save ---------- */
function touch() { dirty = true; status("Saving…"); clearTimeout(saveT); saveT = setTimeout(save, 600); summary(); }
async function save() {
    if (!plan) return; plan.at = Date.now();
    try { await store.save("plans/" + plan.id, plan); dirty = false; status(demo ? "This device only" : "Saved", "ok"); }
    catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
}

/* ---------- the brief Claude reads ---------- */
function brief() {
    const last = [...WEEKS].filter((w) => w.monday && w.monday < plan.monday).pop();
    const out = {
        version: 1, made: new Date().toISOString(),
        week: { id: plan.id, label: plan.label, nineWeeks: plan.nineWeeks, monday: plan.monday, dates: plan.dates,
            days: plan.days.map((d, i) => Object.assign({ day: DAYS[i], date: d.date, school: d.school, event: d.event || "", type: d.school ? (d.type || "regular") : "no school" },
                d.school && d.type ? { periods: d.periods || ALLPERIODS, minutes: d.minutes || (d.type === "out" ? 55 : null) } : {})) },
        schedule: plan.schedule, shared: plan.shared, classes: {},
        prompt: "Build " + plan.label + " (" + plan.dates + ") from Anchor: read plans/" + plan.id + "."
    };
    CLASSES.forEach(([cls, label, periods]) => {
        const c = plan.classes[cls], lw = last && last.classes[cls];
        out.classes[cls] = {
            label, periods, students: Object.fromEntries(periods.map((p) => [p, (rosters[p] || []).length])),
            topic: c.topic,
            standards: c.standards.map((code) => { const s = stdOf(cls, code); return s ? { code, critical: !!s.critical, text: s.text, parts: (s.parts || []).map((p) => (p.l ? p.l + ". " : "") + (p.t || "")).filter(Boolean) } : { code, text: "" }; }),
            assess: c.assess, activity: c.activity, plans: c.plans, homework: c.homework, notes: c.notes,
            lastWeek: lw ? { id: last.id, label: last.label, target: lw.weekLT || "", days: lw.days.map((d) => d.agendaLine || "") } : null
        };
    });
    return out;
}
async function send() {
    const problems = CLASSES.filter(([cls]) => !plan.classes[cls].topic.trim() || !plan.classes[cls].standards.length).map(([, l]) => l);
    if (problems.length) { status("Add a topic and at least one standard for " + problems.join(" and "), "bad"); return; }
    plan.brief = brief(); plan.status = "sent"; plan.sentAt = Date.now();
    clearTimeout(saveT); await save(); draw();
    $("sendCard").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ---------- drawing ---------- */
function seg(items, cur, onPick, label) {
    const g = el("div", "pl-seg pw-seg"); g.setAttribute("role", "group"); if (label) g.setAttribute("aria-label", label);
    items.forEach(([v, t]) => { const b = el("button", null, t); b.type = "button"; b.setAttribute("aria-pressed", String(v === cur)); b.onclick = () => onPick(v); g.appendChild(b); });
    return g;
}
function field(label, ctrl, hint) { const f = el("label", "pw-field"); f.appendChild(el("span", "pw-lab", label)); f.appendChild(ctrl); if (hint) f.appendChild(el("small", "pw-hint", hint)); return f; }
function input(v, on, ph) { const i = el("input", "pw-in"); i.type = "text"; i.value = v || ""; if (ph) i.placeholder = ph; i.oninput = () => { on(i.value); touch(); }; return i; }
function select(opts, v, on) { const s = el("select", "pw-in"); opts.forEach(([val, t]) => { const o = el("option", null, t); o.value = val; s.appendChild(o); }); s.value = v; s.onchange = () => { on(s.value); touch(); }; return s; }

function summary() {
    const box = $("summary"); box.textContent = "";
    const tile = (big, small, accent) => { const t = el("div", "pl-tile" + (accent ? " accent" : "")); t.appendChild(el("b", null, big)); t.appendChild(el("span", null, small)); box.appendChild(t); };
    const sd = plan.days.filter((d) => d.school).length, out = plan.days.filter((d) => d.school && d.type === "out").length;
    tile(plan.label, plan.dates, true);
    tile(String(sd), sd === 1 ? "school day" : "school days" + (out ? ", " + out + " with a sub" : ""));
    const q = nineWeeksOf(plan.monday); if (q) tile(String(daysLeftInNineWeeks(plan.monday)), "school days left in the nine weeks from Monday");
    tile(plan.status === "sent" ? "Sent" : built(plan.monday) ? "Built" : "Draft", plan.status === "sent" ? "Claude has the brief" : built(plan.monday) ? "This week is on the board" : "Not sent to Claude yet");
}

function drawDays() {
    const box = $("days"); box.textContent = "";
    plan.days.forEach((d, i) => {
        const r = el("div", "pw-day" + (d.school ? "" : " off"));
        const h = el("div", "pw-dayh"); h.appendChild(el("b", null, DAYS[i])); h.appendChild(el("span", null, short(d.date, { month: "short", day: "numeric" }))); r.appendChild(h);
        if (!d.school) r.appendChild(el("p", "pw-off", d.event || "No school"));
        else {
            if (d.event) r.appendChild(el("p", "pw-ev", d.event));
            const s = select(DAYTYPES, d.type || "", (v) => { d.type = v; if (!v) { delete d.periods; delete d.minutes; } summary(); drawDays(); }); s.setAttribute("aria-label", DAYS[i] + " day type"); r.appendChild(s);
            if (d.type) {   // which periods meet and how long, so Claude does not have to ask (sub plans use it)
                const all = ALLPERIODS, on = d.periods || all;
                const g = el("div", "pw-pers"); g.setAttribute("role", "group"); g.setAttribute("aria-label", DAYS[i] + " periods that meet");
                all.forEach((p) => { const b = el("button", null, p); b.type = "button"; b.setAttribute("aria-pressed", String(on.includes(p))); b.title = "Tap if " + p + " period does not meet";
                    b.onclick = () => { const cur = new Set(d.periods || all); cur.has(p) ? cur.delete(p) : cur.add(p); const list = all.filter((x) => cur.has(x)); if (list.length === all.length) delete d.periods; else d.periods = list; touch(); drawDays(); }; g.appendChild(b); });
                r.appendChild(el("small", "pw-hint", "Periods that meet"));
                r.appendChild(g);
                const m = el("input", "pw-in pw-min"); m.type = "number"; m.min = "10"; m.max = "90"; m.inputMode = "numeric"; m.value = d.minutes || ""; m.placeholder = d.type === "out" ? "55" : "Minutes";
                m.setAttribute("aria-label", DAYS[i] + " minutes per period"); m.oninput = () => { const v = parseInt(m.value, 10); if (v >= 10 && v <= 90) d.minutes = v; else delete d.minutes; touch(); };
                const ml = el("label", "pw-minrow"); ml.appendChild(m); ml.appendChild(el("span", null, "minutes per period")); r.appendChild(ml);
            }
        }
        box.appendChild(r);
    });
}

function drawClass(cls, label, periods) {
    const c = plan.classes[cls], card = el("section", "pw-class"), s = suggest(cls);
    const head = el("div", "pw-chead"); head.appendChild(el("h2", null, label)); head.appendChild(el("span", "pw-per", periods.join(", ") + (periods.length === 1 ? " period" : " periods"))); card.appendChild(head);
    card.appendChild(field("Topic this week", input(c.topic, (v) => { c.topic = v; }, "Unit or topic"), s.unit && s.unit !== c.topic ? "Next up on the Standards page: " + s.unit : ""));

    // Standards: the suggestions as toggles, plus any other standard of the class.
    const sw = el("div", "pw-field"); sw.appendChild(el("span", "pw-lab", "Standards"));
    const chips = el("div", "pw-chips"); const all = [...new Set([...s.options, ...c.standards])];
    all.forEach((code) => {
        const st = stdOf(cls, code), b = el("button", "pw-chip", code + (st && st.critical ? " ★" : "")); b.type = "button";
        b.setAttribute("aria-pressed", String(c.standards.includes(code))); if (st) b.title = st.text;
        b.onclick = () => { c.standards = c.standards.includes(code) ? c.standards.filter((x) => x !== code) : [...c.standards, code]; touch(); drawClasses(); };
        chips.appendChild(b);
    });
    const add = el("select", "pw-in pw-add"); add.setAttribute("aria-label", "Add another " + label + " standard");
    const o0 = el("option", null, "Add another standard…"); o0.value = ""; add.appendChild(o0);
    (STANDARDS[cls] || { standards: [] }).standards.filter((x) => !all.includes(x.code)).forEach((x) => { const o = el("option", null, x.code + (x.critical ? " ★ " : " · ") + (x.text.length > 60 ? x.text.slice(0, 57) + "…" : x.text)); o.value = x.code; add.appendChild(o); });
    add.onchange = () => { if (add.value) { c.standards.push(add.value); touch(); drawClasses(); } };
    sw.appendChild(chips); sw.appendChild(add);
    const picked = c.standards.map((code) => stdOf(cls, code)).filter(Boolean);
    if (picked.length) { const ul = el("ul", "pw-std"); picked.forEach((x) => { const li = el("li"); li.appendChild(el("b", null, x.code + " ")); li.appendChild(document.createTextNode(x.text)); ul.appendChild(li); }); sw.appendChild(ul); }
    card.appendChild(sw);

    // Quiz or test
    const qa = el("div", "pw-row");
    const kinds = seg([["none", "None"], ["quiz", "Quiz"], ["test", "Test"]], c.assess.kind, (v) => { c.assess.kind = v; c.plans = c.plans.map((p, i) => (/^(Quiz|Test)$/.test(p) || (v !== "none" && DK[i] === c.assess.day) ? pattern(i, c.assess, !plan.days[i].school) : p)); touch(); drawClasses(); }, label + " quiz or test");
    qa.appendChild(field("Quiz or test", kinds));
    if (c.assess.kind !== "none") {
        qa.appendChild(field("Day", select(DK.map((d, i) => [d, DAYS[i]]).filter((x, i) => plan.days[i].school), c.assess.day, (v) => { c.assess.day = v; c.plans = c.plans.map((p, i) => (/^(Quiz|Test)$/.test(p) || DK[i] === v ? pattern(i, c.assess, !plan.days[i].school) : p)); drawClasses(); })));
        const w = el("label", "pw-check"); const cb = el("input"); cb.type = "checkbox"; cb.checked = !!c.assess.teacherWrites; cb.onchange = () => { c.assess.teacherWrites = cb.checked; touch(); };
        w.appendChild(cb); w.appendChild(document.createTextNode(" I write it myself")); qa.appendChild(w);
    }
    card.appendChild(qa);

    // Activity
    const ac = el("div", "pw-row");
    ac.appendChild(field("Activity", select(ACTIVITIES.map((a) => [a, a]), c.activity.type, (v) => { c.activity.type = v; })));
    if (c.activity.type !== "None") ac.appendChild(field("Activity day", select(DK.map((d, i) => [d, DAYS[i]]).filter((x, i) => plan.days[i].school), c.activity.day, (v) => { c.activity.day = v; })));
    card.appendChild(ac);

    // Day by day
    const dd = el("div", "pw-field"); dd.appendChild(el("span", "pw-lab", "Day by day"));
    const grid = el("div", "pw-plans");
    c.plans.forEach((p, i) => {
        const row = el("label", "pw-plan" + (plan.days[i].school ? "" : " off")); row.appendChild(el("span", null, DK[i]));
        if (!plan.days[i].school) row.appendChild(el("em", null, plan.days[i].event || "No school"));
        else { const inp = input(p, (v) => { c.plans[i] = v; }); inp.setAttribute("aria-label", label + " " + DAYS[i] + " plan"); row.appendChild(inp); if (plan.days[i].type === "out") row.appendChild(el("small", "pw-sub", "Sub")); }
        grid.appendChild(row);
    });
    dd.appendChild(grid); card.appendChild(dd);

    card.appendChild(field("Homework", input(c.homework, (v) => { c.homework = v; })));
    const ta = el("textarea", "pw-in pw-notes"); ta.rows = 2; ta.value = c.notes || ""; ta.placeholder = "Anything to reuse from last week, skip, or change"; ta.oninput = () => { c.notes = ta.value; touch(); };
    card.appendChild(field("Notes for Claude", ta));
    return card;
}
function drawClasses() { const box = $("classes"); box.textContent = ""; CLASSES.forEach(([cls, label, periods]) => box.appendChild(drawClass(cls, label, periods))); }

function drawSend() {
    const box = $("sendCard"); box.textContent = "";
    if (plan.status !== "sent") {
        box.appendChild(el("p", "pw-sendp", "When this looks right, send it. Claude reads this one plan, so you never fill in the Sheet or answer setup questions."));
        const b = el("button", "btn go big", "Send to Claude"); b.type = "button"; b.onclick = send; box.appendChild(b); return;
    }
    box.classList.add("sent");
    box.appendChild(el("p", "pw-sendp", "Sent " + new Date(plan.sentAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) + ". Paste this to Claude:"));
    const pr = el("div", "pw-prompt"); const code = el("code", null, plan.brief.prompt); pr.appendChild(code);
    const cp = el("button", "btn", "Copy"); cp.type = "button";
    cp.onclick = async () => { try { await navigator.clipboard.writeText(plan.brief.prompt); cp.textContent = "Copied"; setTimeout(() => (cp.textContent = "Copy"), 1600); } catch (e) { const r = document.createRange(); r.selectNodeContents(code); getSelection().removeAllRanges(); getSelection().addRange(r); } };
    pr.appendChild(cp); box.appendChild(pr);
    const again = el("button", "btn ghost", "Update the brief"); again.type = "button"; again.title = "Send again after a change"; again.onclick = send; box.appendChild(again);
    const rv = el("a", "btn ghost", "Week Review"); rv.href = "review.html?week=" + plan.id + (demo ? "&demo" : ""); rv.style.textDecoration = "none"; box.appendChild(rv);
}

function draw() {
    $("wkTitle").textContent = plan.label + " · " + plan.dates;
    $("prevWk").disabled = false; $("nextWk").disabled = false;
    const bi = built(plan.monday); $("builtNote").hidden = !bi;
    summary(); drawDays(); drawClasses(); drawSend();
    $("schedule").value = plan.schedule || ""; $("shared").value = plan.shared || "";
}

/* ---------- open a week ---------- */
let unwatch = 0;
function openWeek(m) {
    mon = m; const fresh = freshPlan(m), id = fresh.id; plan = null; const my = ++unwatch;
    history.replaceState(null, "", "?week=" + id + (demo ? "&demo" : ""));
    $("view").hidden = true; $("skel").hidden = false;
    store.watch("plans/" + id, (snap) => {
        if (my !== unwatch || snap.pending || (plan && dirty)) return;
        const d = snap.exists && snap.data;
        if (plan && (!d || d.at === plan.at)) return;   // our own save coming back: keep the page as it is
        if (plan && document.activeElement && $("view").contains(document.activeElement)) return;   // never redraw under the teacher's typing
        plan = d && d.classes ? Object.assign(fresh, d, { days: fresh.days.map((x, i) => { const o = (d.days || [])[i] || {}; return Object.assign(x, { type: o.type || "" }, o.periods ? { periods: o.periods } : {}, o.minutes ? { minutes: o.minutes } : {}); }) }) : fresh;
        $("skel").hidden = true; $("view").hidden = false; draw();
    }, () => { if (my !== unwatch) return; plan = fresh; $("skel").hidden = true; $("view").hidden = false; draw(); status("Could not load a saved plan", "bad"); });
}

$("prevWk").onclick = () => stepWeek(-1); $("nextWk").onclick = () => stepWeek(1);
$("schedule").oninput = () => { if (plan) { plan.schedule = $("schedule").value; touch(); } };
$("shared").oninput = () => { if (plan) { plan.shared = $("shared").value; touch(); } };
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    $("who").textContent = demo ? "This device only, nothing is saved" : (user.name ? "Signed in as " + user.name : "Signed in");
    status(demo ? "This device only" : "Live", "ok");
    let got = 0; const ready = () => { if (++got === 3) { const w = qs.get("week"); const hit = w && /^(week|q\d+w)\d+$/.test(w) ? findMonday(w) : ""; openWeek(hit || defaultMonday()); } };
    store.watch("standards/progress", (s) => { if (s.pending) return; progress = (s.exists && s.data) || {}; ready(); }, ready);
    store.watch("planner/plans", (s) => { if (s.pending) return; planner = (s.exists && s.data) || { weeks: {} }; if (!planner.weeks) planner.weeks = {}; ready(); }, ready);
    store.watch("rosters/all", (s) => { if (s.pending) return; rosters = (s.exists && s.data && s.data.periods) || {}; ready(); }, ready);
    watchPrivateWeeks(store, PUBLISHED, (list) => { WEEKS = list; if (plan) summary(); });
}
function findMonday(id) {   // ?week=week6 → its Monday
    for (let m = mondayOf(SCHOOL_YEAR.first); m <= SCHOOL_YEAR.last; m = addDays(m, 7)) { const { n, q } = weekNumber(m); if (isSchoolWeek(m) && weekIdFor(n, q) === id) return m; }
    return "";
}
