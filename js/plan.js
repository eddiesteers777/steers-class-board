/* ==========================================
   Focal — Plan the Week (plan.html). Replaces the weekly intake Sheet.
   Everything the site already knows is filled in: the dates and days off (district calendar), the next
   standards for each class (Standards page marks + the Standards Timeline order), the Planner's unit for the week,
   last week's work, and the usual day pattern. The teacher changes what is different and taps Send to Claude.
   Saved privately at teacher/{uid}/plans/<weekId>: the editable plan, and on Send the "brief" Claude reads
   (dates, classes, topics, standards with their exact wording, quiz or test, roster COUNTS only, last week).
   ?demo keeps everything on this device. ?week=week6 opens a given week.
========================================== */
import { STANDARDS } from "../data/standards.js?v=60";
import { WEEKS as PUBLISHED } from "../data/weeks.js?v=64";
import { toLoginIfSignedOut } from "./signedOut.js?v=1";
import { SCHOOL_YEAR, addDays, today, mondayOf, isSchoolDay, eventsOn, nineWeeksOf, daysLeftInNineWeeks, short, parse } from "./schoolCal.js?v=59";
import { timelineNext, lanesFor } from "./timelineCore.js?v=3";
import { watchPrivateWeeks, weekIdFor } from "./weeksLive.js?v=58";
import { watchEvidence, classEvidence, evidenceForBrief, weekStandards } from "./planEvidence.js?v=3";
import { openBankPicker, bankFor } from "./bankPick.js?v=2";
import { rich } from "./weekSheets.js?v=60";
import { loadStdBank } from "./stdBank.js?v=6";
import { bellWeek } from "./acapFormats.js?v=2";
import { icon } from "./icons.js";
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
        // Typed into Claude for the teacher by Send (claude.ai/new?q=…), so it names the connector's tools.
        prompt: "Build " + plan.label + " (" + plan.dates + ") on Anchor Board. Use the Anchor Board connector: read_week_plan for " + plan.id + ", build the week from its brief, then save it with save_week_file so I can check it on Week Review."
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
/* Send (Nov 26): fills the bellringers left on auto, saves the brief and opens Claude in a new tab with the message
   typed in. The tab opens on the tap itself (browsers block a tab opened after a wait) and goes to Claude once saved. */
async function send() {
    const problems = CLASSES.filter(([cls]) => !plan.classes[cls].topic.trim() || !plan.classes[cls].standards.length).map(([, l]) => l);
    if (problems.length) { const m = "Add a topic and at least one standard for " + problems.join(" and "); status(m, "bad"); const sum = $("barSum"); sum.textContent = m; sum.classList.add("warn"); return; }
    let tab = null; try { tab = window.open("about:blank", "_blank"); } catch (e) { tab = null; }
    const b = $("sendBtn"); b.disabled = true; b.lastChild.textContent = "Sending…";
    try { for (const [cls] of CLASSES) if (plan.classes[cls].bellAuto !== false && plan.classes[cls].standards.length) await fillBells(cls); }
    catch (e) { /* the bank did not load: Claude writes the bellringers */ }
    CLASSES.forEach(([cls]) => normalize(plan.classes[cls]));
    const was = { brief: plan.brief, status: plan.status, sentAt: plan.sentAt };
    plan.brief = brief(); plan.status = "sent"; plan.sentAt = Date.now();
    clearTimeout(saveT);
    const ok = await save(); b.disabled = false;
    if (!ok) { if (tab) tab.close(); Object.assign(plan, was); if (!was.brief) delete plan.brief; draw(); status("Not sent: the plan could not be saved. Try again.", "bad"); return; }
    if (tab) { try { tab.opener = null; tab.location.href = claudeUrl(); } catch (e) { tab = null; } }
    draw();
    if (!tab) status("Sent. Tap Open Claude again to finish in Claude.", "ok");
    $("sendCard").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
/* ---------- drawing: one screen of taps (Nov 26) ----------
   The week strip, three class cards and a bar with Send. Everything is a tap; typing is only in the sheets
   ("Type my own", notes). Sheets are <dialog>s so they sit over the page and the bank picker can stack on top. */
const IC = (n) => icon(n, "wp-ic");
const DAYPLANS = ["Guided notes", "Practice", "Speed dating", "Review game", "Stations", "Gallery walk", "Partner challenge", "Practice + study guide", "Reteach + practice", "Review", "Quiz", "Test"];
const TYPESHORT = { "": "Regular", out: "I'm out", half: "Half day", bells: "Different bells" };
const TYPEICON = { out: "user", half: "clock", bells: "bell" };
const SHORT = { "Guided notes": "Notes", "Practice + study guide": "Study guide", "Reteach + practice": "Reteach", "Partner challenge": "Partners" };
function btn(cls, html, on, label) { const b = el("button", cls); b.type = "button"; b.innerHTML = html; if (label) b.setAttribute("aria-label", label); if (on) b.onclick = on; return b; }
function chip(text, on, onClick, cls, ic) {
    const b = btn("wp-chip" + (on ? " on" : "") + (cls ? " " + cls : ""), (ic ? IC(ic) : "") + "<span></span>", onClick);
    b.lastChild.textContent = text; b.setAttribute("aria-pressed", String(!!on)); return b;
}
function field(label, ctrl, hint) { const f = el("label", "pw-field"); f.appendChild(el("span", "pw-lab", label)); f.appendChild(ctrl); if (hint) f.appendChild(el("small", "pw-hint", hint)); return f; }
function input(v, on, ph) { const i = el("input", "pw-in"); i.type = "text"; i.value = v || ""; if (ph) i.placeholder = ph; i.oninput = () => { on(i.value); touch(); }; return i; }
function select(opts, v, on) { const s = el("select", "pw-in"); opts.forEach(([val, t]) => { const o = el("option", null, t); o.value = val; s.appendChild(o); }); s.value = v; s.onchange = () => { on(s.value); touch(); }; return s; }
const clip = (t, n) => (t && t.length > n ? t.slice(0, n - 1) + "…" : t || "");
const schoolIdx = () => plan.days.map((d, i) => (d.school ? i : -1)).filter((i) => i >= 0);

/* ---------- sheets ---------- */
let sheetRender = null;   // the open sheet redraws itself when the cards do
function sheet(title, build) {
    const d = el("dialog", "wp-sheet"); d.setAttribute("aria-label", title);
    const h = el("div", "wp-sh"); h.appendChild(el("h2", null, title));
    h.appendChild(btn("wp-x", IC("close"), () => d.close(), "Close"));
    const body = el("div", "wp-sb"), foot = el("div", "wp-sf");
    foot.appendChild(btn("btn", "Done", () => d.close()));
    d.append(h, body, foot); document.body.appendChild(d);
    const render = () => { const y = body.scrollTop; body.textContent = ""; build(body); body.scrollTop = y; };
    sheetRender = render; render();
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });   // tap outside closes
    d.addEventListener("close", () => { if (sheetRender === render) sheetRender = null; d.remove(); draw(); });
    d.showModal();
}
const busy = () => !!document.querySelector("dialog[open]") || !!(document.activeElement && $("view").contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));

/* ---------- one place for the quiz: the seg and the day tiles are the same setting ---------- */
function setAssess(c, kind, i) {
    const school = schoolIdx();
    if (i == null) i = DK.indexOf(c.assess.day);
    if (!school.includes(i)) i = school.includes(3) ? 3 : school[school.length - 1];
    c.assess.kind = kind; if (i != null) c.assess.day = DK[i];
    c.plans = c.plans.map((p, k) => {
        if (!plan.days[k].school) return p;
        if (kind !== "none" && k === i) return kind === "test" ? "Test" : "Quiz";
        return /^(Quiz|Test)$/.test(p) ? pattern(k, { kind: "none" }, false) : p;
    });
}
/** A saved plan can say "no quiz" while a day says "Quiz" (it had two places for one job). The day wins. */
function normalize(c) {
    const k = c.plans.findIndex((p, i) => plan.days[i].school && /^(Quiz|Test)$/.test(p));
    if (k >= 0) { c.assess.kind = c.plans[k] === "Test" ? "test" : "quiz"; c.assess.day = DK[k]; }
    else if (c.assess.kind !== "none") c.assess.kind = "none";
    const a = c.plans.findIndex((p, i) => plan.days[i].school && ACTIVITIES.includes(p) && p !== "None");
    c.activity = a >= 0 ? { day: DK[a], type: c.plans[a] } : { day: (c.activity && c.activity.day) || "Tue", type: "None" };
}

/* ---------- bellringers: every day up to 4 from the standards bank (2 this week + 2 review) ---------- */
function reviewFor(cls, c) {
    const ev = evidenceOf(cls), spiral = c.spiral || [];
    const fromData = ev ? [...ev.reteach, ...ev.below.slice().sort((a, b) => b.low - a.low || a.avg - b.avg).map((x) => x.code)] : [];
    return [...new Set(spiral.length ? spiral : fromData)].filter((x) => !c.standards.includes(x)).slice(0, 3);
}
async function fillBells(cls) {
    const c = plan.classes[cls], review = reviewFor(cls, c);
    const days = plan.days.map((pd, i) => ({ school: !!pd.school, bell: (dayOf(c, i).bell || []) }));
    const add = bellWeek({ cls, bank: await loadStdBank(), now: c.standards, review, days });
    let n = 0; add.forEach((list, i) => { if (!list.length) return; const d = dayOf(c, i); d.bell = [...(d.bell || []), ...list.map((x) => ({ id: x.id, q: x.q, a: x.a, std: x.std, lvl: x.lvl, also: x.also }))]; n += list.length; });
    // The newest Vault Raid spiral for this class (Student Progress > Readiness) becomes the last school day's review game, if that day has none.
    const sp = sets.filter((x) => x.sp && x.cls === cls).sort((x, y) => (y.at || 0) - (x.at || 0))[0], last = schoolIdx().pop();
    let game = ""; if (sp && last != null && !dayOf(c, last).set) { dayOf(c, last).set = { id: sp.id, title: sp.title || "" }; game = " " + DAYS[last] + "'s review game: " + (sp.title || "your Vault Raid spiral") + "."; }
    bellMsg[cls] = (n ? "Added " + n + " bellringers" + (review.length ? ", review " + review.join(", ") : "") + "." : "Every day already has 4.") + game;
    if (n || game) touch();
    return n;
}
const bellCount = (c) => (c.day || []).reduce((n, d, i) => n + (d && plan.days[i].school ? (d.bell || []).length : 0), 0);

/* ---------- the bar: what Claude gets, and Send ---------- */
function summary() {
    if (!plan) return;
    const sd = plan.days.filter((d) => d.school).length, out = plan.days.filter((d) => d.school && d.type === "out").length;
    const qs = CLASSES.map(([cls]) => plan.classes[cls].assess).filter((a) => a.kind !== "none");
    const quiz = qs.length ? CLASSES.filter(([cls]) => plan.classes[cls].assess.kind !== "none").map(([cls]) => { const a = plan.classes[cls].assess; return cls.replace("-acc", " Acc") + " " + a.kind + " " + a.day; }).join(", ") : "no quizzes";
    const bells = CLASSES.some(([cls]) => plan.classes[cls].bellAuto !== false) ? " · bellringers from the bank" : "";
    const long = CLASSES.length + " classes · " + sd + " school day" + (sd === 1 ? "" : "s") + (out ? ", " + out + " with a sub" : "") + " · " + quiz + bells;
    const sum = $("barSum"); sum.textContent = ""; sum.classList.remove("warn");
    const l = el("span", "long"); l.appendChild(el("b", null, "Claude gets: ")); l.appendChild(document.createTextNode(long));
    sum.append(l, el("span", "short", sd + " school days · " + (qs.length ? [["quiz", "quiz", "quizzes"], ["test", "test", "tests"]].map(([k, one, many]) => { const n = qs.filter((x) => x.kind === k).length; return n ? n + " " + (n === 1 ? one : many) : ""; }).filter(Boolean).join(", ") : "no quizzes")));
    const sent = plan.status === "sent", changed = sent && (plan.at || 0) > (plan.sentAt || 0) + 5000;
    $("sendBtn").innerHTML = IC("send") + "<span>" + (!sent ? "Send to Claude" : changed ? "Send the changes" : "Send again") + "</span>";
    const st = $("state"); st.textContent = sent ? (isBuilt() ? "Claude built it" : "Sent to Claude") : built(plan.monday) ? "On the board" : "Draft · filled in for you";
    st.dataset.state = sent ? "sent" : "draft";
}

/* ---------- the week strip ---------- */
function drawDays() {
    const box = $("days"); box.textContent = "";
    box.appendChild(el("span", "wp-lab", "The week"));
    plan.days.forEach((d, i) => {
        const date = short(d.date, { month: "short", day: "numeric" });
        const b = btn("wp-day" + (!d.school ? " is-off" : d.type === "out" ? " is-sub" : d.type ? " is-alt" : ""), "", d.school ? () => daySheet(i) : null);
        const h = el("b", null, DK[i]); h.appendChild(el("span", null, date)); b.appendChild(h);
        const em = el("em"); if (!d.school) em.textContent = clip(d.event || "No school", 28);
        else { if (TYPEICON[d.type]) em.innerHTML = IC(TYPEICON[d.type]); em.appendChild(document.createTextNode(TYPESHORT[d.type || ""])); }
        b.appendChild(em);
        if (d.school && d.event) { b.appendChild(el("small", null, clip(d.event, 30))); b.title = d.event; }
        if (!d.school) { b.disabled = true; b.setAttribute("aria-label", DAYS[i] + " " + date + ", " + (d.event || "no school")); }
        else b.setAttribute("aria-label", DAYS[i] + " " + date + ", " + TYPESHORT[d.type || ""] + ". Change the day");
        box.appendChild(b);
    });
}
function daySheet(i) {
    const d = plan.days[i];
    sheet(DAYS[i] + ", " + short(d.date, { month: "short", day: "numeric" }), (body) => {
        if (d.event) body.appendChild(el("p", "wp-evline", d.event));
        const g = el("div", "wp-chips wp-big");
        DAYTYPES.forEach(([v, t]) => g.appendChild(chip(t, (d.type || "") === v, () => { d.type = v; if (!v) { delete d.periods; delete d.minutes; } touch(); drawDays(); sheetRender(); }, "", TYPEICON[v])));
        body.appendChild(g);
        if (!d.type) { body.appendChild(el("p", "pw-hint", "A regular day: every period meets on the usual bells.")); return; }
        // Which periods meet and how long, so Claude does not have to ask (sub plans use it).
        const all = ALLPERIODS, on = d.periods || all;
        body.appendChild(el("span", "wp-lab", "Periods that meet"));
        const pg = el("div", "wp-chips");
        all.forEach((p) => pg.appendChild(chip(p, on.includes(p), () => { const cur = new Set(d.periods || all); cur.has(p) ? cur.delete(p) : cur.add(p); const list = all.filter((x) => cur.has(x)); if (list.length === all.length) delete d.periods; else d.periods = list; touch(); sheetRender(); })));
        body.appendChild(pg);
        const m = el("input", "pw-in pw-min"); m.type = "number"; m.min = "10"; m.max = "90"; m.inputMode = "numeric"; m.value = d.minutes || ""; m.placeholder = d.type === "out" ? "55" : "Minutes";
        m.setAttribute("aria-label", DAYS[i] + " minutes per period"); m.oninput = () => { const v = parseInt(m.value, 10); if (v >= 10 && v <= 90) d.minutes = v; else delete d.minutes; touch(); };
        const ml = el("label", "pw-minrow"); ml.appendChild(m); ml.appendChild(el("span", null, "minutes per period")); body.appendChild(ml);
    });
}

/* ---------- a class card ---------- */
function drawClass(cls, label, periods) {
    const c = plan.classes[cls], card = el("section", "pw-class wp-c"), s = suggest(cls);
    const head = el("div", "wp-ch"); head.appendChild(el("h2", null, label)); head.appendChild(el("small", null, periods.join(", ") + (periods.length === 1 ? " period" : " periods"))); card.appendChild(head);
    const tp = input(c.topic, (v) => { c.topic = v; }, "Topic this week"); tp.classList.add("wp-topic"); tp.setAttribute("aria-label", label + " topic this week");
    if (s.unit && s.unit !== c.topic) tp.title = "Next up on your Standards Timeline: " + s.unit;
    card.appendChild(tp);

    // Standards: the Timeline's next ones as chips, everything else one tap away.
    const sw = el("div", "wp-sec"); sw.appendChild(el("span", "wp-lab", "Standards"));
    const chips = el("div", "wp-chips");
    [...new Set([...s.options.slice(0, 5), ...c.standards])].forEach((code) => {
        const st = stdOf(cls, code), b = chip(code, c.standards.includes(code), () => { c.standards = c.standards.includes(code) ? c.standards.filter((x) => x !== code) : [...c.standards, code]; touch(); drawClasses(); }, "", st && st.critical ? "star" : "");
        if (st) b.title = st.text; chips.appendChild(b);
    });
    chips.appendChild(chip("All standards", false, () => stdSheet(cls, label), "more", "plus"));
    sw.appendChild(chips);
    const picked = c.standards.map((code) => stdOf(cls, code)).filter(Boolean);
    if (picked.length) { const p = el("p", "wp-std"); picked.slice(0, 3).forEach((x, k) => { if (k) p.appendChild(document.createTextNode(" · ")); p.appendChild(el("b", null, x.code + " ")); p.appendChild(document.createTextNode(clip(x.text, 46))); }); if (picked.length > 3) p.appendChild(document.createTextNode(" · +" + (picked.length - 3))); sw.appendChild(p); }
    else sw.appendChild(el("p", "wp-std warn", "Pick at least one standard."));
    card.appendChild(sw);

    // Quiz or test: one setting. The day it falls on is the day tile that says Quiz or Test.
    const qa = el("div", "wp-sec"); qa.appendChild(el("span", "wp-lab", "Quiz or test"));
    const qr = el("div", "wp-qrow"), sg = el("div", "wp-seg"); sg.setAttribute("role", "group"); sg.setAttribute("aria-label", label + " quiz or test");
    [["none", "No quiz"], ["quiz", "Quiz"], ["test", "Test"]].forEach(([v, t]) => { const b = btn(c.assess.kind === v ? "on" : "", "", () => { setAssess(c, v); touch(); drawClasses(); }); b.textContent = t; b.setAttribute("aria-pressed", String(c.assess.kind === v)); sg.appendChild(b); });
    qr.appendChild(sg);
    if (c.assess.kind !== "none") qr.appendChild(chip("I write it", !!c.assess.teacherWrites, () => { c.assess.teacherWrites = !c.assess.teacherWrites; touch(); drawClasses(); }, "sm", c.assess.teacherWrites ? "check" : "edit"));
    qa.appendChild(qr); card.appendChild(qa);

    // Day by day: tap a day to change it.
    const dd = el("div", "wp-sec"); dd.appendChild(el("span", "wp-lab", "Day by day"));
    const row = el("div", "wp-wkrow");
    c.plans.forEach((p, i) => {
        const pd = plan.days[i], d = (c.day || [])[i] || {}, n = (d.bell || []).length;
        const b = btn("wp-dp" + (!pd.school ? " is-off" : /^(Quiz|Test)$/.test(p) ? " is-qz" : pd.type === "out" ? " is-sub" : ""), "", pd.school ? () => planSheet(cls, label, i) : null);
        b.appendChild(el("small", null, DK[i])); b.appendChild(el("span", null, pd.school ? SHORT[p] || p || "Pick" : "Off"));
        if (pd.school && (n || d.lt || d.set || d.asg || d.note)) b.appendChild(el("i", null, n ? n + " bell" : "+"));
        if (!pd.school) b.disabled = true; else b.setAttribute("aria-label", label + " " + DAYS[i] + ": " + (p || "nothing yet") + ". Change it");
        row.appendChild(b);
    });
    dd.appendChild(row); card.appendChild(dd);

    // Bellringers and review: on by default, filled from the bank when you send.
    const tg = el("div", "wp-tg");
    const bf = el("div", "pw-field wp-bell"), auto = c.bellAuto !== false, have = bellCount(c);
    const top = el("div", "wp-t");
    const sw2 = btn("sw" + (auto ? "" : " off"), "", () => { c.bellAuto = !auto; touch(); drawClasses(); }, label + " bellringers from the bank"); sw2.setAttribute("role", "switch"); sw2.setAttribute("aria-checked", String(auto));
    top.append(sw2, el("span", "pw-lab", "Bellringers for the week"));
    const fill = btn("wp-fill", "Fill now", null); fill.disabled = !c.standards.length;
    fill.onclick = async () => { fill.disabled = true; fill.textContent = "Filling…"; try { await fillBells(cls); } catch (e) { bellMsg[cls] = "Could not load the question bank. Try again."; } drawClasses(); };
    top.appendChild(fill); bf.appendChild(top);
    bf.appendChild(el("small", "pw-hint", bellMsg[cls] || (have ? have + " picked from the bank." : auto ? "Filled from the bank when you send: 2 new, 2 review." : "Off: Claude writes them.")));
    tg.appendChild(bf);
    // Review standards (the spiral) and what the data flags.
    const rv = el("div", "wp-t wp-rv"); rv.appendChild(el("span", "pw-lab", "Review"));
    const rc = el("div", "wp-chips"), spiral = c.spiral || [], ev = evidenceOf(cls);
    spiral.forEach((code) => { const b = chip(code, true, () => { c.spiral = spiral.filter((x) => x !== code); touch(); drawClasses(); }, "sm", "close"); b.setAttribute("aria-label", "Take " + code + " out of review"); rc.appendChild(b); });
    const flagged = ev ? [...ev.reteach, ...ev.below.map((x) => x.code)].filter((x, k, a) => a.indexOf(x) === k && !spiral.includes(x) && !c.standards.includes(x)).slice(0, 3) : [];
    flagged.forEach((code) => { const b = chip(code, false, () => { c.spiral = [...spiral, code]; touch(); drawClasses(); }, "sm re", "flag"); b.title = "Flagged in your scores. Tap to review it in bellringers"; rc.appendChild(b); });
    if (!spiral.length && !flagged.length) rc.appendChild(el("small", "pw-hint", ev ? "Nothing flagged in your scores" : "Reading your scores…"));
    rv.appendChild(rc); tg.appendChild(rv);
    card.appendChild(tg);

    const more = chip("Homework, notes and data", !!(c.notes || "").trim(), () => moreSheet(cls, label), "more wp-morebtn", "clipboard");
    card.appendChild(more);
    return card;
}

/* ---------- sheets for a class ---------- */
function stdSheet(cls, label) {
    sheet(label + " standards", (body) => {
        const c = plan.classes[cls];
        body.appendChild(el("p", "pw-hint", "This week: what Claude teaches. Review: what the bellringers spiral back to."));
        const ul = el("ul", "wp-stdl");
        (STANDARDS[cls] || { standards: [] }).standards.forEach((x) => {
            const li = el("li"), t = el("div"); t.appendChild(el("b", null, x.code + (x.critical ? " " : ""))); if (x.critical) t.firstChild.innerHTML += IC("star"); t.appendChild(el("span", null, x.text));
            const a = el("div", "wp-chips");
            a.appendChild(chip("This week", c.standards.includes(x.code), () => { c.standards = c.standards.includes(x.code) ? c.standards.filter((y) => y !== x.code) : [...c.standards, x.code]; touch(); drawClasses(); }, "sm"));
            a.appendChild(chip("Review", (c.spiral || []).includes(x.code), () => { const sp = c.spiral || []; c.spiral = sp.includes(x.code) ? sp.filter((y) => y !== x.code) : [...sp, x.code]; touch(); drawClasses(); }, "sm"));
            li.append(t, a); ul.appendChild(li);
        });
        body.appendChild(ul);
    });
}
function planSheet(cls, label, i) {
    sheet(label + " · " + DAYS[i], (body) => {
        const c = plan.classes[cls], p = c.plans[i];
        body.appendChild(el("span", "wp-lab", "The plan"));
        const g = el("div", "wp-chips");
        DAYPLANS.forEach((t) => g.appendChild(chip(t, p === t, () => {
            if (/^(Quiz|Test)$/.test(t)) setAssess(c, t === "Test" ? "test" : "quiz", i);
            else { c.plans[i] = t; if (/^(Quiz|Test)$/.test(p)) { c.assess.kind = "none"; } }
            normalize(c); touch(); drawClasses();
        })));
        body.appendChild(g);
        const own = input(DAYPLANS.includes(p) ? "" : p, (v) => { c.plans[i] = v.trim() ? v : pattern(i, { kind: "none" }, false); normalize(c); }, "Or type my own");
        own.setAttribute("aria-label", label + " " + DAYS[i] + " plan in my own words"); body.appendChild(own);
        if (plan.days[i].type === "out") body.appendChild(el("p", "wp-evline", "You are out this day: Claude writes it as a sub day."));
        body.appendChild(dayDrawer(cls, label, i));
    });
}
function moreSheet(cls, label) {
    sheet(label + ": homework, notes and data", (body) => {
        const c = plan.classes[cls];
        body.appendChild(field("Homework", input(c.homework, (v) => { c.homework = v; })));
        const ta = el("textarea", "pw-in pw-notes"); ta.rows = 3; ta.value = c.notes || ""; ta.placeholder = "Anything to reuse from last week, skip, or change"; ta.oninput = () => { c.notes = ta.value; touch(); };
        body.appendChild(field("Notes for Claude", ta));
        const ev = el("div", "pw-evd"); ev.id = "ev-" + cls; body.appendChild(ev); drawEvidence(cls, ev);
    });
}
function noteSheet() {
    sheet("A note for the whole week", (body) => {
        const a = el("textarea", "pw-in"); a.rows = 2; a.value = plan.schedule || ""; a.placeholder = "Example: Wednesday 2-hour delay, all periods meet"; a.oninput = () => { plan.schedule = a.value; touch(); };
        body.appendChild(field("Schedule changes", a));
        const b = el("textarea", "pw-in"); b.rows = 2; b.value = plan.shared || ""; b.placeholder = "Example: first week back from break"; b.oninput = () => { plan.shared = b.value; touch(); };
        body.appendChild(field("Anything all classes share", b));
    });
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

function drawClasses() {
    const box = $("classes"); box.textContent = "";
    CLASSES.forEach(([cls, label, periods]) => box.appendChild(drawClass(cls, label, periods)));
    summary();
    if (sheetRender) sheetRender();
}

/* ---------- after Send: where the week is ---------- */
let wfAt = 0;   // when Claude last saved this week's file
const isBuilt = () => !!(plan && plan.status === "sent" && wfAt && wfAt >= (plan.sentAt || 0) - 60000);
const claudeUrl = () => "https://claude.ai/new?q=" + encodeURIComponent(plan.brief.prompt);
function drawSend() {
    const box = $("sendCard"), weekBuilt = isBuilt(); box.textContent = "";
    box.hidden = plan.status !== "sent"; if (box.hidden) return;
    const h = el("div", "wp-sh2"); const ok = el("span", "wp-ok"); ok.innerHTML = IC("check"); h.appendChild(ok);
    const t = el("div"); t.appendChild(el("h2", null, isBuilt() ? "Claude built " + plan.label : "Sent to Claude"));
    t.appendChild(el("p", "pw-hint", isBuilt() ? "Check it on Week Review, then approve it to put it on the board." : "Claude opens in a new tab with the message typed in. Send it there and Claude builds the week."));
    h.appendChild(t); box.appendChild(h);
    const tr = el("div", "wp-track");
    const step = (cls, ic, b, s) => { const d = el("div", cls); const bb = el("b"); bb.innerHTML = IC(ic); bb.appendChild(document.createTextNode(b)); d.append(bb, el("span", null, s)); tr.appendChild(d); };
    step("done", "check", "Sent", new Date(plan.sentAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }));
    step(isBuilt() ? "done" : "now", isBuilt() ? "check" : "clock", "Claude builds it", isBuilt() ? "Saved to Anchor Board" : "In your Claude tab");
    step(isBuilt() ? "now" : "", "eye", "You approve", "On Week Review");
    box.appendChild(tr);
    const acts = el("div", "wp-acts");
    const a = el("a", "btn" + (isBuilt() ? " ghost" : ""), ""); a.innerHTML = IC("send") + "<span>Open Claude again</span>"; a.href = claudeUrl(); a.target = "_blank"; a.rel = "noopener";
    const rv = el("a", "btn" + (isBuilt() ? " go" : " ghost"), ""); rv.innerHTML = IC("eye") + "<span>Week Review</span>"; rv.href = "review.html?week=" + plan.id + (demo ? "&demo" : "");
    const all = btn("btn ghost", IC("copy") + "<span>Copy the whole plan</span>", null); all.title = "For a Claude chat that cannot open Anchor Board: the message plus the full plan";
    all.onclick = async () => { try { await navigator.clipboard.writeText(briefText()); all.lastChild.textContent = "Copied"; setTimeout(() => (all.lastChild.textContent = "Copy the whole plan"), 1600); } catch (e) { status("Copy did not work on this device", "bad"); } };
    acts.append(isBuilt() ? rv : a, isBuilt() ? a : rv, all); box.appendChild(acts);
}

function draw() {
    $("wkTitle").textContent = plan.label; $("wkDates").textContent = plan.dates;
    $("prevWk").disabled = false; $("nextWk").disabled = false;
    $("builtNote").hidden = !built(plan.monday); $("bar").hidden = false;
    CLASSES.forEach(([cls]) => normalize(plan.classes[cls]));
    drawDays(); drawSend(); drawClasses();
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
        if (plan && busy()) return;   // never redraw under the teacher's typing or an open sheet
        plan = merge(d);
        $("skel").hidden = true; $("view").hidden = false; draw(); quickSave();
    }, () => { if (my !== unwatch) return; plan = fresh; $("skel").hidden = true; $("view").hidden = false; draw(); status("Could not load a saved plan", "bad"); });
    wfAt = 0;   // Claude saved the week (save_week_file): the sent card moves on to Week Review
    store.watch("weekfiles/" + id, (s) => { if (my !== unwatch || s.pending) return; wfAt = (s.exists && s.data && s.data.json && s.data.at) || 0; if (plan && !busy()) { drawSend(); summary(); } }, () => {});
}

$("prevWk").onclick = () => stepWeek(-1); $("nextWk").onclick = () => stepWeek(1);
$("sendBtn").onclick = () => { if (plan) send(); };
$("noteBtn").onclick = () => { if (plan) noteSheet(); };
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
        if (quickSig !== sig() && plan && !plan.at && !dirty && !busy()) openWeek(mon);
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
        if (!plan.at && !dirty && !busy()) openWeek(mon); else drawClasses();
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
