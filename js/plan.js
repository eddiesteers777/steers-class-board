/* ==========================================
   Focal — Plan the Week (plan.html). Replaces the weekly intake Sheet.
   Everything the site already knows is filled in: the dates and days off (district calendar), the next
   standards for each class (Standards page marks + the Standards Timeline order), the Planner's unit for the week,
   last week's work, and the usual day pattern. The teacher changes what is different and taps Send to Claude.
   Saved privately at teacher/{uid}/plans/<weekId>: the editable plan, and on Send the "brief" Claude reads
   (dates, classes, topics, standards with their exact wording, quiz or test, roster COUNTS only, last week).
   ?demo keeps everything on this device. ?week=week6 opens a given week.
========================================== */
import { STANDARDS } from "../data/standards.js?v=58";
import { WEEKS as PUBLISHED } from "../data/weeks.js?v=62";
import { toLoginIfSignedOut } from "./signedOut.js?v=1";
import { SCHOOL_YEAR, addDays, today, mondayOf, isSchoolDay, eventsOn, nineWeeksOf, daysLeftInNineWeeks, short, parse } from "./schoolCal.js?v=58";
import { timelineNext, lanesFor } from "./timelineCore.js?v=2";
import { watchPrivateWeeks, weekIdFor } from "./weeksLive.js?v=58";
import { watchEvidence, classEvidence, evidenceForBrief, weekStandards } from "./planEvidence.js?v=3";
import { openBankPicker, bankFor } from "./bankPick.js?v=2";
import { rich } from "./weekSheets.js?v=60";
import { loadStdBank } from "./stdBank.js?v=3";
import { bellWeek } from "./acapFormats.js?v=2";
const bellMsg = {};   // the last "Fill every day" result, per class

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
let evDocs = null, sets = [], asgs = [];
/* ---------- quick copy (Nov 22): what this phone saw last time, so the week draws at once ----------
   Standards marks, the Planner, the class lists and the last few saved plans. The server's answer replaces them a
   moment later. The "school-live:" name means signing out or switching accounts clears it (js/auth.js). */
const QUICK = "school-live:plan", got = new Set();
let quickUid = "", quickT = 0, quickPlans = {};
function quickLoad(uid) { try { const q = JSON.parse(localStorage.getItem(QUICK) || "null"); return q && q.uid === uid ? q : null; } catch (e) { return null; } }
function quickSave() {
    if (demo || !quickUid || got.size < 3) return;
    clearTimeout(quickT);
    quickT = setTimeout(() => {
        if (plan && plan.at) quickPlans[plan.id] = plan;
        const keep = Object.values(quickPlans).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 3);
        quickPlans = Object.fromEntries(keep.map((x) => [x.id, x]));
        try { localStorage.setItem(QUICK, JSON.stringify({ uid: quickUid, progress, planner, rosters, plans: quickPlans })); } catch (e) { /* storage full or off: the next visit waits for the server */ }
    }, 800);
}
const openDays = new Set();   // which day drawers are open ("8th:2")
const CUT = (() => { try { const v = parseFloat(localStorage.getItem("anchorboard-progress-cut")); return v > 0 && v < 1 ? v : 0.7; } catch (e) { return 0.7; } })();
const TEMPLATES = ["Guided notes", "Practice", "Speed dating", "Review game", "Stations", "Practice + study guide", "Quiz", "Test", "Reteach + practice", "Review"];

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
let tlOrder = {};   // the Standards Timeline order (standards/timeline); suggestions follow it, else the locked/district order
function suggest(cls) {
    const n = timelineNext(cls, lanesFor(cls, tlOrder[cls]), progress) || { teaching: [], next: [], current: null, unitWord: "Unit" };
    const codes = [...n.teaching]; n.next.slice(0, 3).forEach((x) => { if (!codes.includes(x.code)) codes.push(x.code); });
    const unit = (n.current && n.current.unit) || (n.next[0] && n.next[0].unit);
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
    try { await store.save("plans/" + plan.id, JSON.parse(JSON.stringify(plan))); dirty = false; status(demo ? "This device only" : "Saved", "ok"); quickSave(); return true; }   // JSON copy: Firestore refuses undefined values
    catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); return false; }
}

/* ---------- the brief Claude reads ---------- */
function brief() {
    const last = [...WEEKS].filter((w) => w.monday && w.monday < plan.monday).pop();
    const out = {
        version: 2, made: new Date().toISOString(),
        rules: "Day plans are the teacher's own: keep each picked bellringer exactly as written (they are checked standards-bank problems, bankId), keep the day's learning target if one is given, and build everything else around them. Use the review standards for spiral bellringers. Evidence is counts only. Put the homework (8th: Homework Packet, Monday to Wednesday, due Thursday; 7th: Extra Practice, Monday to Wednesday) in classes[cls].homework as { title, directions, days: [{ day: \"Monday\", example: { q, steps[] }, problems: [{ q, a, work }] }] } so Week Review prints it with its key.",
        week: { id: plan.id, label: plan.label, nineWeeks: plan.nineWeeks, monday: plan.monday, dates: plan.dates,
            days: plan.days.map((d, i) => Object.assign({ day: DAYS[i], date: d.date, school: d.school, event: d.event || "", type: d.school ? (d.type || "regular") : "no school" },
                d.school && d.type ? { periods: d.periods || ALLPERIODS, minutes: d.minutes || (d.type === "out" ? 55 : null) } : {})) },
        schedule: plan.schedule, shared: plan.shared, classes: {},
        prompt: "Build " + plan.label + " (" + plan.dates + ") from Anchor: read plans/" + plan.id + "."
    };
    CLASSES.forEach(([cls, label, periods]) => {
        const c = plan.classes[cls], lw = last && last.classes[cls], ev = evidenceOf(cls);
        const words = (code) => { const s = stdOf(cls, code); return s ? { code, critical: !!s.critical, text: s.text } : { code, text: "" }; };
        out.classes[cls] = {
            label, periods, students: Object.fromEntries(periods.map((p) => [p, (rosters[p] || []).length])),
            topic: c.topic,
            standards: c.standards.map((code) => { const s = stdOf(cls, code); return s ? { code, critical: !!s.critical, text: s.text, parts: (s.parts || []).map((p) => (p.l ? p.l + ". " : "") + (p.t || "")).filter(Boolean) } : { code, text: "" }; }),
            assess: c.assess, activity: c.activity, plans: c.plans, homework: c.homework, notes: c.notes,
            lastWeek: lw ? { id: last.id, label: last.label, target: lw.weekLT || "", days: lw.days.map((d) => d.agendaLine || ""), standards: weekStandards(last, cls) } : null,
            // Bellringer review standards (spiral), what the scores say, and the teacher's own day plans.
            review: (c.spiral || []).map(words),
            evidence: ev ? evidenceForBrief(ev, (code) => stdOf(cls, code), CUT, lw ? weekStandards(last, cls) : []) : null,
            dayPlans: dayPlansFor(c)
        };
    });
    return out;
}
/** The day plans as Claude reads them: only days with something in them. */
function dayPlansFor(c) {
    return (c.day || []).map((d, i) => {
        if (!d || !plan.days[i].school) return null;
        const o = { day: DAYS[i], plan: c.plans[i] };
        if ((d.lt || "").trim()) o.target = d.lt.trim();
        if ((d.bell || []).length) o.bellringers = d.bell.map((b) => ({ q: b.q, a: b.a, std: b.std, bankId: b.id }));
        if (d.set) o.reviewGame = d.set.title;
        if (d.asg) o.assignment = d.asg.title + (d.asg.code ? " (code " + d.asg.code + ")" : "");
        if ((d.note || "").trim()) o.notes = d.note.trim();
        return Object.keys(o).length > 2 ? o : null;
    }).filter(Boolean);
}
/** The whole plan as text, for a Claude chat that cannot read Anchor Board directly. */
function briefText() { return plan.brief.prompt + "\n\nIf you cannot open Anchor Board, here is the whole plan (JSON). Return the finished week as one week file (JSON) with id \"" + plan.id + "\" so it can be pasted into Week Review.\n\n" + JSON.stringify(plan.brief, null, 1); }
async function send() {
    const problems = CLASSES.filter(([cls]) => !plan.classes[cls].topic.trim() || !plan.classes[cls].standards.length).map(([, l]) => l);
    if (problems.length) { status("Add a topic and at least one standard for " + problems.join(" and "), "bad"); return; }
    const was = { brief: plan.brief, status: plan.status, sentAt: plan.sentAt };
    plan.brief = brief(); plan.status = "sent"; plan.sentAt = Date.now();
    clearTimeout(saveT);
    if (!(await save())) { Object.assign(plan, was); if (!was.brief) delete plan.brief; draw(); status("Not sent: the plan could not be saved. Try again.", "bad"); return; }
    draw();
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
    const evBox = el("div", "pw-evd"); evBox.id = "ev-" + cls; card.appendChild(evBox); drawEvidence(cls, evBox);
    card.appendChild(field("Topic this week", input(c.topic, (v) => { c.topic = v; }, "Unit or topic"), s.unit && s.unit !== c.topic ? "Next up on your Standards Timeline: " + s.unit : ""));

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

    // Review standards: what the bellringers spiral back to (reteach and below-cut standards land here).
    const rv = el("div", "pw-field"); rv.appendChild(el("span", "pw-lab", "Bellringer review"));
    const spiral = c.spiral || [];
    const rchips = el("div", "pw-chips");
    spiral.forEach((code) => { const st = stdOf(cls, code), b = el("button", "pw-chip", code + " ×"); b.type = "button"; b.setAttribute("aria-pressed", "true"); b.setAttribute("aria-label", "Remove " + code + " from review"); if (st) b.title = st.text; b.onclick = () => { c.spiral = spiral.filter((x) => x !== code); touch(); drawClasses(); }; rchips.appendChild(b); });
    const radd = el("select", "pw-in pw-add"); radd.setAttribute("aria-label", "Add a " + label + " review standard");
    const r0 = el("option", null, spiral.length ? "Add another review standard…" : "Add a standard to spiral back to…"); r0.value = ""; radd.appendChild(r0);
    (STANDARDS[cls] || { standards: [] }).standards.filter((x) => !spiral.includes(x.code)).forEach((x) => { const o = el("option", null, x.code + (x.critical ? " ★ " : " · ") + (x.text.length > 60 ? x.text.slice(0, 57) + "…" : x.text)); o.value = x.code; radd.appendChild(o); });
    radd.onchange = () => { if (radd.value) { c.spiral = [...spiral, radd.value]; touch(); drawClasses(); } };
    if (spiral.length) rv.appendChild(rchips);
    rv.appendChild(radd);
    rv.appendChild(el("small", "pw-hint", "Claude mixes these into the bellringers. The day picker offers their bank problems too."));
    card.appendChild(rv);

    // Every day's bellringers in one tap: 2 on this week's standards and 2 spiral review (ACAP readiness, js/acapFormats.js bellWeek).
    const bf = el("div", "pw-field"); bf.appendChild(el("span", "pw-lab", "Bellringers for the week"));
    const brow = el("div", "pw-brow"), bmsg = el("small", "pw-hint", bellMsg[cls] || "Fills each school day up to 4 from the standards bank: 2 on this week's standards, 2 review. Days keep what you already picked. Nothing goes to the board until you approve the week.");
    bmsg.setAttribute("role", "status");
    const fillAll = el("button", "btn", "Fill every day: 2 new + 2 review"); fillAll.type = "button";
    fillAll.disabled = !c.standards.length && !spiral.length;
    if (fillAll.disabled) fillAll.title = "Pick this week's standards first";
    fillAll.onclick = async () => {
        fillAll.disabled = true; bmsg.textContent = "Filling…";
        try {
            const ev = evidenceOf(cls), fromData = ev ? [...ev.reteach, ...ev.below.slice().sort((a, b) => b.low - a.low || a.avg - b.avg).map((x) => x.code)] : [];
            const review = [...new Set(spiral.length ? spiral : fromData)].filter((x) => !c.standards.includes(x)).slice(0, 3);
            const days = plan.days.map((pd, i) => ({ school: !!pd.school, bell: (dayOf(c, i).bell || []) }));
            const add = bellWeek({ cls, bank: await loadStdBank(), now: c.standards, review, days });
            let n = 0; add.forEach((list, i) => { if (!list.length) return; const d = dayOf(c, i); d.bell = [...(d.bell || []), ...list.map((x) => ({ id: x.id, q: x.q, a: x.a, std: x.std, lvl: x.lvl, also: x.also }))]; n += list.length; });
            // The newest Vault Raid spiral for this class (Student Progress > Readiness) becomes the last school day's review game, if that day has none.
            const sp = sets.filter((x) => x.sp && x.cls === cls).sort((x, y) => (y.at || 0) - (x.at || 0))[0], last = plan.days.map((pd, i) => (pd.school ? i : -1)).filter((i) => i >= 0).pop();
            let game = ""; if (sp && last != null && !dayOf(c, last).set) { dayOf(c, last).set = { id: sp.id, title: sp.title || "" }; game = " " + DAYS[last] + "'s review game: " + (sp.title || "your Vault Raid spiral") + "."; touch(); }
            bellMsg[cls] = (n ? "Added " + n + " bellringers. Review: " + (review.length ? review.join(", ") + (spiral.length ? " (your review standards)" : " (from What the data says)") : "none yet, so all on this week's standards") + ". Open a day to see them or remove one." : "Every day already has 4 bellringers, or the bank has no more for these standards.") + game;
            if (n) touch(); drawClasses();
        } catch (e) { bmsg.textContent = "Could not load the question bank. Try again."; fillAll.disabled = false; }
    };
    brow.appendChild(fillAll); bf.append(brow, bmsg); card.appendChild(bf);

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
        else {
            const inp = input(p, (v) => { c.plans[i] = v; }); inp.setAttribute("aria-label", label + " " + DAYS[i] + " plan"); inp.setAttribute("list", "pwTemplates"); row.appendChild(inp);
            const key = cls + ":" + i, d = (c.day || [])[i] || {}, n = (d.bell || []).length + (d.lt ? 1 : 0) + (d.set ? 1 : 0) + (d.asg ? 1 : 0) + (d.note ? 1 : 0);
            const tg = el("button", "btn ghost pw-dayb" + (n ? " has" : ""), n ? "Day plan · " + n : "Plan day"); tg.type = "button"; tg.setAttribute("aria-expanded", String(openDays.has(key)));
            tg.setAttribute("aria-label", "Plan " + label + " " + DAYS[i] + " in detail");
            tg.onclick = (e) => { e.preventDefault(); openDays.has(key) ? openDays.delete(key) : openDays.add(key); drawClasses(); };
            row.appendChild(tg);
            if (plan.days[i].type === "out") row.appendChild(el("small", "pw-sub", "Sub"));
        }
        grid.appendChild(row);
        if (plan.days[i].school && openDays.has(cls + ":" + i)) grid.appendChild(dayDrawer(cls, label, i));
    });
    dd.appendChild(grid); card.appendChild(dd);

    card.appendChild(field("Homework", input(c.homework, (v) => { c.homework = v; })));
    const ta = el("textarea", "pw-in pw-notes"); ta.rows = 2; ta.value = c.notes || ""; ta.placeholder = "Anything to reuse from last week, skip, or change"; ta.oninput = () => { c.notes = ta.value; touch(); };
    card.appendChild(field("Notes for Claude", ta));
    return card;
}
/* ---------- one day, in detail: target, bellringers from the bank, and the day's materials ---------- */
function dayOf(c, i) { if (!Array.isArray(c.day)) c.day = [{}, {}, {}, {}, {}]; if (!c.day[i]) c.day[i] = {}; return c.day[i]; }
function pickCodes(cls, c) {
    const ev = evidenceOf(cls), out = [...c.standards, ...(c.spiral || [])];
    if (ev) { ev.reteach.forEach((x) => out.push(x)); ev.below.forEach((x) => out.push(x.code)); }
    return [...new Set(out)];
}
function dayDrawer(cls, label, i) {
    const c = plan.classes[cls], d = dayOf(c, i), box = el("div", "pw-drawer"); box.setAttribute("role", "group"); box.setAttribute("aria-label", label + " " + DAYS[i] + " day plan");
    box.appendChild(field("Learning target for " + DAYS[i], input(d.lt, (v) => { d.lt = v; }, "I can …"), "Leave empty and Claude writes one."));
    // Bellringers
    const bw = el("div", "pw-field"); bw.appendChild(el("span", "pw-lab", "Bellringers"));
    const list = el("ol", "pw-bells");
    (d.bell || []).forEach((b, k) => {
        const li = el("li"), q = el("span", "pw-bq"); q.appendChild(rich(b.q));
        const a = el("span", "pw-ba"); a.appendChild(document.createTextNode("Answer ")); a.appendChild(rich(b.a));
        const tag = el("span", "pw-bstd", b.std);
        const x = el("button", "btn ghost pw-bx", "×"); x.type = "button"; x.setAttribute("aria-label", "Remove bellringer " + (k + 1)); x.onclick = () => { d.bell.splice(k, 1); touch(); drawClasses(); };
        li.append(q, a, tag, x); list.appendChild(li);
    });
    if ((d.bell || []).length) bw.appendChild(list);
    const brow = el("div", "pw-brow");
    const pick = el("button", "btn", "Pick from the bank"); pick.type = "button";
    pick.onclick = () => openBankPicker({
        cls, codes: pickCodes(cls, c), extra: (STANDARDS[cls] || { standards: [] }).standards.map((x) => x.code), stdOf: (code) => stdOf(cls, code),
        taken: (d.bell || []).map((b) => b.id), title: label + ", " + DAYS[i] + " bellringers",
        onAdd: (x) => { d.bell = [...(d.bell || []), x]; touch(); }, onClose: () => drawClasses()
    });
    brow.appendChild(pick);
    if ((d.bell || []).length < 4) {
        const fill = el("button", "btn ghost", (d.bell || []).length ? "Fill to 4" : "Fill 4 for me"); fill.type = "button"; fill.title = "On-level bank problems spread across this week's and review standards, none used elsewhere this week";
        fill.onclick = async () => {
            const used = new Set(); (c.day || []).forEach((y) => (y && y.bell || []).forEach((b) => used.add(b.id)));
            const add = await bankFor(cls, pickCodes(cls, c), 4 - (d.bell || []).length, used);
            d.bell = [...(d.bell || []), ...add.map((x) => ({ id: x.id, q: x.q, a: x.a, std: x.std, lvl: x.lvl, also: x.also }))]; touch(); drawClasses();
        };
        brow.appendChild(fill);
    }
    bw.appendChild(brow);
    bw.appendChild(el("small", "pw-hint", (d.bell || []).length ? "Claude keeps these exactly as picked. Their answers were checked when the bank was built." : "Empty is fine: Claude writes the bellringers."));
    box.appendChild(bw);
    // Materials
    const mrow = el("div", "pw-row");
    const mySets = [["", sets.length ? "None" : "No saved sets yet"]].concat(sets.map((x) => [x.id, x.title || "Untitled set"]));
    const ss = select(mySets, (d.set && d.set.id) || "", (v) => { const x = sets.find((y) => y.id === v); d.set = x ? { id: x.id, title: x.title || "" } : null; drawClasses(); }); ss.setAttribute("aria-label", DAYS[i] + " review game set");
    mrow.appendChild(field("Review game set", ss));
    const mine = asgs.filter((x) => !x.cls || x.cls === cls);
    const as = select([["", mine.length ? "None" : "No assignments yet"]].concat(mine.map((x) => [x.id, (x.title || "Assignment") + (x.code ? " · " + x.code : "")])), (d.asg && d.asg.id) || "", (v) => { const x = asgs.find((y) => y.id === v); d.asg = x ? { id: x.id, title: x.title || "", code: x.code || "" } : null; drawClasses(); }); as.setAttribute("aria-label", DAYS[i] + " assignment");
    mrow.appendChild(field("Assignment", as));
    box.appendChild(mrow);
    const links = el("div", "pw-brow");
    const a1 = el("a", "btn ghost", d.set ? "Open the set" : "Make a set"); a1.href = d.set ? "maker.html?set=" + encodeURIComponent(d.set.id) : "maker.html"; a1.target = "_blank"; a1.rel = "noopener"; links.appendChild(a1);
    const a2 = el("a", "btn ghost", d.asg ? "Open the assignment" : "Make an assignment"); a2.href = d.asg ? "assign.html?a=" + encodeURIComponent(d.asg.id) : "assign.html"; a2.target = "_blank"; a2.rel = "noopener"; links.appendChild(a2);
    box.appendChild(links);
    const ta = el("textarea", "pw-in"); ta.rows = 2; ta.value = d.note || ""; ta.placeholder = "Anything Claude should know about this day"; ta.oninput = () => { d.note = ta.value; touch(); };
    box.appendChild(field("Notes for this day", ta));
    return box;
}

/* ---------- what the data says ---------- */
function evidenceOf(cls) {
    if (!evDocs || !evDocs.ready) return null;
    const C = STANDARDS[cls], periods = (CLASSES.find((x) => x[0] === cls) || [])[2] || [];
    return classEvidence(evDocs, C, periods, progress[cls] || {}, CUT);
}
function drawEvidence(cls, box) {
    box.textContent = ""; if (!plan) return;
    const c = plan.classes[cls], ev = evidenceOf(cls), last = [...WEEKS].filter((w) => w.monday && w.monday < plan.monday).pop();
    const h = el("div", "pw-evh"); h.appendChild(el("b", null, "What the data says")); box.appendChild(h);
    if (!ev) { box.appendChild(el("p", "pw-hint", "Reading this class's scores…")); return; }
    const pct = (v) => Math.round(v * 100) + "%";
    const rows = [];
    ev.reteach.forEach((code) => rows.push({ code, kind: "Reteach", why: "Marked Reteach" }));
    ev.below.forEach((x) => { if (!ev.reteach.includes(x.code)) rows.push({ code: x.code, kind: "Below " + pct(CUT), why: x.low + " of " + x.n + " students under " + pct(CUT) + " · class " + pct(x.avg) }); });
    if (!rows.length) box.appendChild(el("p", "pw-hint", ev.scored ? "Nothing below " + pct(CUT) + " and nothing marked Reteach. " + ev.scored + (ev.scored === 1 ? " standard has" : " standards have") + " scores." : "No scores yet. Class Data, Vault Raid and assignment scores tagged with a standard show up here."));
    const ul = el("ul", "pw-evl");
    rows.forEach((r) => {
        const st = stdOf(cls, r.code), li = el("li");
        const t = el("div", "pw-evt"); t.append(el("span", "pw-evk" + (r.kind === "Reteach" ? " re" : ""), r.kind), el("b", null, r.code + " "), document.createTextNode(st ? (st.text.length > 90 ? st.text.slice(0, 88) + "…" : st.text) : ""));
        t.appendChild(el("small", null, r.why)); li.appendChild(t);
        const acts = el("div", "pw-eva"), inWeek = c.standards.includes(r.code), inRev = (c.spiral || []).includes(r.code);
        const b1 = el("button", "btn ghost", inWeek ? "In this week" : "Teach this week"); b1.type = "button"; b1.disabled = inWeek; b1.onclick = () => { c.standards = [...c.standards, r.code]; touch(); drawClasses(); };
        const b2 = el("button", "btn ghost", inRev ? "In review" : "Bellringer review"); b2.type = "button"; b2.disabled = inRev; b2.onclick = () => { c.spiral = [...(c.spiral || []), r.code]; touch(); drawClasses(); };
        acts.append(b1, b2); li.appendChild(acts); ul.appendChild(li);
    });
    if (rows.length) box.appendChild(ul);
    const lw = last ? weekStandards(last, cls) : [];
    const foot = el("p", "pw-hint", (last ? last.label + " covered " + (lw.length ? lw.join(", ") : "no tagged standards") + ". " : "") + "Counts only go to Claude, never names. ");
    const a = el("a", null, "Student Progress"); a.href = "progress.html"; foot.appendChild(a);
    box.appendChild(foot);
}
function drawEvidenceAll() { CLASSES.forEach(([cls]) => { const b = $("ev-" + cls); if (b && !b.contains(document.activeElement)) drawEvidence(cls, b); }); }

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
    const all = el("button", "btn", "Copy the whole plan"); all.type = "button"; all.title = "For a Claude chat that cannot open Anchor Board: the prompt plus the full plan";
    all.onclick = async () => { try { await navigator.clipboard.writeText(briefText()); all.textContent = "Copied"; setTimeout(() => (all.textContent = "Copy the whole plan"), 1600); } catch (e) { status("Copy did not work on this device", "bad"); } };
    box.appendChild(all);
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
    const merge = (d) => d && d.classes ? Object.assign(fresh, d, { days: fresh.days.map((x, i) => { const o = (d.days || [])[i] || {}; return Object.assign(x, { type: o.type || "" }, o.periods ? { periods: o.periods } : {}, o.minutes ? { minutes: o.minutes } : {}); }) }) : fresh;
    const q = quickPlans[id];
    if (q && q.classes) { plan = merge(JSON.parse(JSON.stringify(q))); $("skel").hidden = true; $("view").hidden = false; draw(); }   // last saved copy on this phone
    else { $("view").hidden = true; $("skel").hidden = false; }
    store.watch("plans/" + id, (snap) => {
        if (my !== unwatch || snap.pending || (plan && dirty)) return;
        const d = snap.exists && snap.data;
        if (plan && (!d || d.at === plan.at)) return;   // our own save coming back: keep the page as it is
        if (plan && document.activeElement && $("view").contains(document.activeElement)) return;   // never redraw under the teacher's typing
        plan = merge(d);
        $("skel").hidden = true; $("view").hidden = false; draw(); quickSave();
    }, () => { if (my !== unwatch) return; plan = fresh; $("skel").hidden = true; $("view").hidden = false; draw(); status("Could not load a saved plan", "bad"); });
}

$("prevWk").onclick = () => stepWeek(-1); $("nextWk").onclick = () => stepWeek(1);
$("schedule").oninput = () => { if (plan) { plan.schedule = $("schedule").value; touch(); } };
$("shared").oninput = () => { if (plan) { plan.shared = $("shared").value; touch(); } };
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

const user = await store.ready();
if (!user) toLoginIfSignedOut();   // "Still signing in…" and one more check before login (Nov 23)
else {
    $("who").textContent = demo ? "This device only, nothing is saved" : (user.name ? "Signed in as " + user.name : "Signed in");
    status(demo ? "This device only" : "Loading…", demo ? "ok" : "wait");
    // The week opens once standards marks, the Planner and the class lists are each in (Nov 22: it used to count any three
    // answers, so an empty first answer from the phone's saved copy could fill the plan with no standards marks).
    // An empty saved copy waits for the server; after 5 s the week opens with what is in.
    let opened = false;
    const open = () => { if (opened) return; opened = true; const w = qs.get("week"); const hit = w && /^(week|q\d+w)\d+$/.test(w) ? findMonday(w) : ""; openWeek(hit || defaultMonday()); };
    const ready = (k) => {
        const was = got.size; got.add(k); quickSave();
        if (got.size < 3 || was === 3) return;
        if (!demo) status("Live", "ok");
        if (!opened) return open();
        // Opened from the quick copy: a week not saved yet is filled again from what the server says (never under typing).
        if (quickSig !== sig() && plan && !plan.at && !dirty && !(document.activeElement && $("view").contains(document.activeElement))) openWeek(mon);
    };
    const sig = () => JSON.stringify([progress, planner, rosters]);
    let quickSig = "";
    const q = demo ? null : quickLoad(user.uid);
    quickUid = user.uid;
    if (q) {
        progress = q.progress || {}; planner = q.planner && q.planner.weeks ? q.planner : { weeks: {} }; rosters = q.rosters || {}; quickPlans = q.plans || {}; quickSig = sig();
        status("Syncing…", "wait"); open();
    }
    setTimeout(() => { if (!opened) { open(); if (!demo) status("Slow connection: suggestions may change", "wait"); } }, 5000);
    const empty = (s) => s.pending || (s.fromCache && !s.exists);
    store.watch("standards/progress", (s) => { if (empty(s)) return; progress = (s.exists && s.data) || {}; ready("p"); }, () => ready("p"));
    store.watch("planner/plans", (s) => { if (empty(s)) return; planner = (s.exists && s.data) || { weeks: {} }; if (!planner.weeks) planner.weeks = {}; ready("w"); }, () => ready("w"));
    store.watch("rosters/all", (s) => { if (empty(s)) return; rosters = (s.exists && s.data && s.data.periods) || {}; ready("r"); }, () => ready("r"));
    // A changed Timeline order re-suggests a week that is not saved yet (never under typing).
    store.watch("standards/timeline", (s) => {
        if (s.pending) return; const d = (s.exists && s.data) || {}, was = JSON.stringify(tlOrder); tlOrder = d && typeof d === "object" ? d : {};
        if (was === JSON.stringify(tlOrder) || !opened || !plan) return;
        if (!plan.at && !dirty && !(document.activeElement && $("view").contains(document.activeElement))) openWeek(mon); else drawClasses();
    }, () => {});
    watchPrivateWeeks(store, PUBLISHED, (list) => { WEEKS = list; if (plan) summary(); });
    watchEvidence(store, (d) => { evDocs = d; if (plan) drawEvidenceAll(); });
    store.watch("games/index", (s) => { if (s.pending) return; sets = ((s.exists && s.data && s.data.sets) || []).filter((x) => x && x.id); }, () => {});
    store.watch("asg/index", (s) => { if (s.pending) return; asgs = ((s.exists && s.data && s.data.list) || []).filter((x) => x && x.id && !x.removed); }, () => {});
}
function findMonday(id) {   // ?week=week6 → its Monday
    for (let m = mondayOf(SCHOOL_YEAR.first); m <= SCHOOL_YEAR.last; m = addDays(m, 7)) { const { n, q } = weekNumber(m); if (isSchoolWeek(m) && weekIdFor(n, q) === id) return m; }
    return "";
}
