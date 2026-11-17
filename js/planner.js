/* ==========================================
   Calera Math — Planner: the school year by day, week, month and year.
   School dates come from data/calendar.js. Published weeks (data/weeks.js) show their real lesson.
   Anything typed here saves to teacher/{uid}/planner/plans:
     { days: { "2026-11-18": { note, c: { "8th": "plan" } } }, weeks: { "2026-11-16": { c: { "8th": "unit or focus" } } } }
   ?demo keeps everything on this device only.
========================================== */
import { WEEKS } from "../data/weeks.js?v=41";
import { LIBRARY } from "../data/library.js?v=41";
import { SCHOOL_YEAR, iso, parse, addDays, today, weekday, mondayOf, eventsOn, isSchoolDay, dayNumber, nineWeeksOf, daysLeftInNineWeeks, schoolDaysBetween, SCHOOL_DAYS, short } from "./schoolCal.js?v=41";

const demo = new URLSearchParams(location.search).has("demo");
const store = await import(demo ? "./localStore.js?v=41" : "./boardStore.js?v=41");
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };

const CLASSES = [["8th", "8th Grade", "8"], ["7th", "7th Grade", "7"], ["8th-acc", "8th Accelerated", "8A"]];
const VIEWS = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"]];
const KIND = { off: "No school", work: "No students", term: "School", early: "Early dismissal", note: "" };
const ORD = ["", "1st", "2nd", "3rd", "4th"];

// Published lessons by date: iso -> { week, i }
const PUB = {};
WEEKS.forEach((w) => { if (w.monday) for (let i = 0; i < 5; i++) PUB[addDays(w.monday, i)] = { week: w, i }; });
const weekOf = (mon) => WEEKS.find((w) => w.monday === mon);

const keep = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
const q = new URLSearchParams(location.search);
let view = VIEWS.some((v) => v[0] === q.get("view")) ? q.get("view") : (keep("planner-view") || "week");
let cur = parse(q.get("date") || "") ? q.get("date") : today();
let shown = new Set(JSON.parse(keep("planner-classes") || "null") || CLASSES.map((c) => c[0]));
let plans = { days: {}, weeks: {} }, loaded = false, saveTimer = 0, dirty = false;

/* ---------- saving ---------- */
function save() {
    dirty = true; status("Saving…"); clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        try { await store.save("planner/plans", plans); dirty = false; status(demo ? "This device only" : "Saved", "ok"); }
        catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
    }, 700);
}
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
const dayPlan = (d) => plans.days[d] || {};
const setDay = (d, fn) => { const x = plans.days[d] = plans.days[d] || {}; x.c = x.c || {}; fn(x); if (!x.note && !Object.values(x.c).some(Boolean)) delete plans.days[d]; save(); };
const weekPlan = (m) => (plans.weeks[m] && plans.weeks[m].c) || {};
const setWeek = (m, cls, v) => { const x = plans.weeks[m] = plans.weeks[m] || { c: {} }; if (v) x.c[cls] = v; else delete x.c[cls]; if (!Object.keys(x.c).length) delete plans.weeks[m]; save(); };

/** A text box that saves as you type and grows with its text. */
function box(value, label, placeholder, onSave, cls) {
    const t = el("textarea", "pl-in" + (cls ? " " + cls : "")); t.value = value || ""; t.placeholder = placeholder; t.setAttribute("aria-label", label); t.rows = 1;
    const grow = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
    t.oninput = () => { grow(); onSave(t.value.trim() ? t.value : ""); };
    requestAnimationFrame(grow);
    return t;
}
const chip = (kind, text) => el("span", "pl-chip k-" + kind, text);

/* ---------- top summary ---------- */
function summary() {
    const host = $("summary"), t = today(), n = dayNumber(t), qn = nineWeeksOf(t); host.textContent = "";
    const tile = (big, small, accent) => { const d = el("div", "pl-tile" + (accent ? " accent" : "")); d.appendChild(el("b", null, big)); d.appendChild(el("span", null, small)); host.appendChild(d); };
    if (t < SCHOOL_YEAR.first) tile(String(SCHOOL_DAYS.length), "student days this year, starting " + short(SCHOOL_YEAR.first, { month: "short", day: "numeric" }));
    else if (t > SCHOOL_YEAR.last) tile("Done", "the " + SCHOOL_YEAR.label + " school year is over");
    else {
        const left = schoolDaysBetween(t, SCHOOL_YEAR.last);
        tile(n ? "Day " + n : (eventsOn(t)[0] || { text: weekday(t) % 6 === 0 ? "Weekend" : "No school" }).text, n ? "of " + SCHOOL_DAYS.length + " student days" : "no students today", true);
        if (qn) tile(String(daysLeftInNineWeeks(t)), "school days left in the " + ORD[qn.n] + " nine weeks, counting today (ends " + short(qn.end, { month: "short", day: "numeric" }) + ")");
        const nb = SCHOOL_YEAR.events.find(([a, , k]) => k === "off" && a > t && a <= SCHOOL_YEAR.last && weekday(a) % 6);
        if (nb) tile(String(schoolDaysBetween(t, addDays(nb[0], -1)) - (n ? 1 : 0)), "school days until " + nb[3] + " (" + short(nb[0], { month: "short", day: "numeric" }) + ")");
        tile(String(left), "student days left this year, counting today");
    }
}

/* ---------- pieces ---------- */
function dayStatus(d) {
    const ev = eventsOn(d), wrap = el("div", "pl-evs");
    ev.forEach((e) => wrap.appendChild(chip(e.kind, e.text)));
    if (isSchoolDay(d) && !ev.length && dayNumber(d)) wrap.appendChild(el("span", "pl-dnum", "Day " + dayNumber(d)));
    else if (isSchoolDay(d) && ev.length) wrap.appendChild(el("span", "pl-dnum", "Day " + dayNumber(d)));
    return wrap;
}
/** What one class is doing on one day: the published lesson, or the private plan box. */
function classDay(d, cls, compact) {
    const pub = PUB[d], cell = el("div", "pl-cd");
    if (!isSchoolDay(d)) { cell.classList.add("off"); return cell; }
    const pd = pub && pub.week.classes[cls] && pub.week.classes[cls].days[pub.i];
    if (pd) {
        cell.classList.add("pub");
        cell.appendChild(el("b", "pl-pubt", pd.agendaLine || pd.short || "Lesson"));
        if (!compact && pd.lt) cell.appendChild(el("p", "pl-lt", pd.lt));
        if (!compact) {
            const links = el("div", "pl-links"), go = el("a", null, "Open on Remote");
            go.href = "remote.html?week=" + pub.week.id + "&class=" + encodeURIComponent(cls) + "&day=" + ["mon", "tue", "wed", "thu", "fri"][pub.i];
            const pr = el("a", null, "Print sheets"); pr.href = "builder.html?week=" + pub.week.id + "&class=" + encodeURIComponent(cls);
            links.appendChild(go); links.appendChild(pr); cell.appendChild(links);
        }
        return cell;
    }
    cell.appendChild(box((dayPlan(d).c || {})[cls], CLASSES.find((c) => c[0] === cls)[1] + " plan for " + short(d), compact ? "Plan…" : "What's the plan?", (v) => setDay(d, (x) => { if (v) x.c[cls] = v; else delete x.c[cls]; })));
    return cell;
}
const shownClasses = () => CLASSES.filter((c) => shown.has(c[0]));

/* ---------- views ---------- */
function dayView() {
    const d = cur, host = el("div", "pl-day");
    $("title").textContent = short(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const top = el("div", "pl-dayhead"); top.appendChild(dayStatus(d));
    const qn = nineWeeksOf(d); if (qn && d >= SCHOOL_YEAR.first && d <= SCHOOL_YEAR.last) top.appendChild(el("span", "pl-q", ORD[qn.n] + " nine weeks"));
    host.appendChild(top);
    if (!isSchoolDay(d)) host.appendChild(el("p", "pl-empty", weekday(d) % 6 === 0 ? "Weekend. Use the arrows to go to a school day." : "No students today."));
    else shownClasses().forEach(([cls, label]) => {
        const card = el("section", "pl-card"), h = el("h3", null, label);
        const unit = weekPlan(mondayOf(d))[cls] || (LIBRARY[(PUB[d] || {}).week ? PUB[d].week.id : ""] || { units: {} }).units?.[cls];
        if (unit) h.appendChild(el("span", "pl-unit", unit));
        card.appendChild(h); card.appendChild(classDay(d, cls)); host.appendChild(card);
    });
    const nc = el("section", "pl-card note"); nc.appendChild(el("h3", null, "My note for the day"));
    nc.appendChild(box(dayPlan(d).note, "Note for " + short(d), "Copies to make, meetings, reminders…", (v) => setDay(d, (x) => { if (v) x.note = v; else delete x.note; }), "tall"));
    host.appendChild(nc);
    return host;
}

function weekView() {
    const mon = mondayOf(cur), days = [0, 1, 2, 3, 4].map((i) => addDays(mon, i)), w = weekOf(mon), host = el("div", "pl-week");
    $("title").textContent = "Week of " + short(mon, { month: "long", day: "numeric" }) + (w ? " · " + w.label : "");
    const meta = el("div", "pl-wmeta"), qn = nineWeeksOf(mon), sd = days.filter(isSchoolDay).length;
    if (mon <= SCHOOL_YEAR.last && addDays(mon, 4) >= SCHOOL_YEAR.first && qn) meta.appendChild(el("span", "pl-q", ORD[qn.n] + " nine weeks"));
    meta.appendChild(el("span", "pl-dnum", sd + (sd === 1 ? " school day" : " school days")));
    if (w) { const a = el("a", "pl-pill", "On the board · open in Library"); a.href = "library.html"; meta.appendChild(a); }
    host.appendChild(meta);
    const grid = el("div", "pl-wgrid"); grid.style.setProperty("--rows", shownClasses().length);
    grid.appendChild(el("div", "pl-corner"));
    days.forEach((d) => {
        const hd = el("button", "pl-wday" + (d === today() ? " is-today" : "") + (isSchoolDay(d) ? "" : " off")); hd.type = "button";
        hd.appendChild(el("b", null, short(d, { weekday: "short" }))); hd.appendChild(el("span", null, short(d, { month: "short", day: "numeric" })));
        hd.title = "Open this day"; hd.onclick = () => go("day", d);
        const ev = eventsOn(d); if (ev.length) hd.appendChild(chip(ev[0].kind, ev[0].text));
        grid.appendChild(hd);
    });
    shownClasses().forEach(([cls, label]) => {
        const rh = el("div", "pl-rowh"); rh.appendChild(el("b", null, label));
        rh.appendChild(box(weekPlan(mon)[cls], label + " unit or focus for the week", "Unit / focus", (v) => setWeek(mon, cls, v), "focus"));
        grid.appendChild(rh);
        days.forEach((d) => { const c = classDay(d, cls, true); c.dataset.day = short(d, { weekday: "short" }); grid.appendChild(c); });
    });
    host.appendChild(grid);
    const notes = el("div", "pl-wnotes");
    days.filter((d) => dayPlan(d).note).forEach((d) => { const p = el("p"); p.appendChild(el("b", null, short(d, { weekday: "short" }) + ": ")); p.appendChild(document.createTextNode(dayPlan(d).note)); notes.appendChild(p); });
    if (notes.children.length) { host.appendChild(el("h3", "pl-h3", "Notes this week")); host.appendChild(notes); }
    return host;
}

function monthView() {
    const d0 = parse(cur), first = iso(new Date(d0.getFullYear(), d0.getMonth(), 1)), last = iso(new Date(d0.getFullYear(), d0.getMonth() + 1, 0)), host = el("div", "pl-month");
    $("title").textContent = d0.toLocaleDateString([], { month: "long", year: "numeric" });
    const grid = el("div", "pl-mgrid");
    ["Mon", "Tue", "Wed", "Thu", "Fri"].forEach((n) => grid.appendChild(el("div", "pl-mh", n)));
    for (let m = mondayOf(first); m <= last; m = addDays(m, 7)) {
        for (let i = 0; i < 5; i++) {
            const d = addDays(m, i), inMonth = d >= first && d <= last, cell = el("button", "pl-mday" + (inMonth ? "" : " out") + (d === today() ? " is-today" : "") + (isSchoolDay(d) ? "" : " off"));
            cell.type = "button"; cell.onclick = () => go("day", d); cell.setAttribute("aria-label", short(d, { weekday: "long", month: "long", day: "numeric" }));
            const top = el("div", "pl-mtop"); top.appendChild(el("b", null, String(parse(d).getDate()))); if (dayNumber(d)) top.appendChild(el("span", null, "Day " + dayNumber(d))); cell.appendChild(top);
            eventsOn(d).forEach((e) => cell.appendChild(chip(e.kind, e.text)));
            if (isSchoolDay(d) && inMonth) shownClasses().forEach(([cls, , ab]) => {
                const pub = PUB[d], pd = pub && pub.week.classes[cls] && pub.week.classes[cls].days[pub.i], txt = pd ? (pd.short || pd.agendaLine) : (dayPlan(d).c || {})[cls];
                if (txt) { const l = el("p", "pl-mline" + (pd ? " pub" : "")); l.appendChild(el("i", null, ab)); l.appendChild(document.createTextNode(txt)); cell.appendChild(l); }
            });
            if (dayPlan(d).note) cell.appendChild(el("span", "pl-dot", "Note"));
            grid.appendChild(cell);
        }
    }
    host.appendChild(grid);
    const legend = el("div", "pl-legend"); [["off", "No school"], ["work", "Teacher day, no students"], ["early", "Early dismissal"], ["term", "Term starts or ends"]].forEach(([k, t]) => legend.appendChild(chip(k, t)));
    const pub = el("span", "pl-chip k-pub", "On the board"); legend.appendChild(pub);
    host.appendChild(legend);
    return host;
}

function yearView() {
    const host = el("div", "pl-year"), t = today();
    $("title").textContent = "School year " + SCHOOL_YEAR.label;
    SCHOOL_YEAR.nineWeeks.forEach((qn) => {
        const sec = el("section", "pl-qcard" + (t >= qn.start && t <= qn.end ? " now" : "")), total = schoolDaysBetween(qn.start, qn.end), done = schoolDaysBetween(qn.start, t < qn.start ? addDays(qn.start, -1) : (t > qn.end ? qn.end : addDays(t, -1)));
        const h = el("div", "pl-qhead"); h.appendChild(el("h3", null, ORD[qn.n] + " nine weeks"));
        h.appendChild(el("span", null, short(qn.start, { month: "short", day: "numeric" }) + " – " + short(qn.end, { month: "short", day: "numeric" }) + " · " + total + " days"));
        sec.appendChild(h);
        const bar = el("div", "pl-prog"), fill = el("i"); fill.style.width = Math.round(Math.max(0, Math.min(1, done / total)) * 100) + "%"; bar.appendChild(fill); bar.setAttribute("role", "progressbar"); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", String(total)); bar.setAttribute("aria-valuenow", String(Math.max(0, done))); bar.setAttribute("aria-label", ORD[qn.n] + " nine weeks, days done"); sec.appendChild(bar);
        const list = el("div", "pl-wlist");
        for (let m = mondayOf(qn.start); m <= qn.end; m = addDays(m, 7)) {
            const days = [0, 1, 2, 3, 4].map((i) => addDays(m, i)).filter((d) => d >= qn.start && d <= qn.end), sd = days.filter(isSchoolDay).length, w = weekOf(m);
            const row = el("button", "pl-wrow" + (m === mondayOf(t) ? " is-today" : "") + (sd ? "" : " off")); row.type = "button"; row.onclick = () => go("week", m);
            const a = el("div", "pl-wwhen"); a.appendChild(el("b", null, short(m, { month: "short", day: "numeric" }))); a.appendChild(el("span", null, sd + "d")); row.appendChild(a);
            const b = el("div", "pl-wwhat");
            const ev = SCHOOL_YEAR.events.filter(([s, e, k]) => k !== "note" && s <= addDays(m, 4) && e >= m);
            ev.forEach(([, , k, txt]) => b.appendChild(chip(k, txt)));
            shownClasses().forEach(([cls, , ab]) => {
                const unit = weekPlan(m)[cls] || (w && LIBRARY[w.id] && LIBRARY[w.id].units && LIBRARY[w.id].units[cls]) || (w && w.classes[cls] ? w.classes[cls].days.map((x) => x.short).filter(Boolean)[0] : "");
                if (unit) { const l = el("span", "pl-wunit" + (w ? " pub" : "")); l.appendChild(el("i", null, ab)); l.appendChild(document.createTextNode(unit)); b.appendChild(l); }
            });
            if (!b.children.length && sd) b.appendChild(el("span", "pl-wempty", "Nothing planned yet"));
            row.appendChild(b); list.appendChild(row);
        }
        sec.appendChild(list); host.appendChild(sec);
    });
    return host;
}

/* ---------- frame ---------- */
function go(v, d) { view = v; if (d) cur = d; draw(); window.scrollTo({ top: 0, behavior: "smooth" }); }
function step(n) {
    const d = parse(cur);
    if (view === "day") { let x = cur; do { x = addDays(x, n); } while (weekday(x) % 6 === 0); cur = x; }
    else if (view === "week") cur = addDays(cur, 7 * n);
    else if (view === "month") cur = iso(new Date(d.getFullYear(), d.getMonth() + n, 1));
    draw();
}
function draw() {
    keep("planner-view", view);
    try { const u = new URL(location.href); u.searchParams.set("view", view); u.searchParams.set("date", cur); history.replaceState(null, "", u); } catch { /* ok */ }
    $("views").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === view)));
    $("classes").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(shown.has(b.dataset.c))));
    $("prev").hidden = $("next").hidden = view === "year";
    summary();
    const host = $("view"); host.textContent = "";
    if (!loaded) { host.appendChild(el("div", "pl-skel")); return; }
    host.appendChild({ day: dayView, week: weekView, month: monthView, year: yearView }[view]());
}
VIEWS.forEach(([v, label]) => { const b = el("button", null, label); b.type = "button"; b.dataset.v = v; b.onclick = () => go(v); $("views").appendChild(b); });
CLASSES.forEach(([c, label, ab]) => {
    const b = el("button", null, label); b.type = "button"; b.dataset.c = c; b.title = "Show or hide " + label;
    b.onclick = () => { if (shown.has(c) && shown.size > 1) shown.delete(c); else shown.add(c); keep("planner-classes", JSON.stringify([...shown])); draw(); };
    $("classes").appendChild(b);
});
$("prev").onclick = () => step(-1); $("next").onclick = () => step(1);
$("toToday").onclick = () => go(view, today());
document.addEventListener("keydown", (e) => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (e.key === "ArrowLeft") step(-1); else if (e.key === "ArrowRight") step(1); else if (e.key === "t" || e.key === "T") go(view, today()); });
draw();

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    $("who").textContent = demo ? "This device only, nothing is saved" : "Signed in as " + user.name;
    let first = true;
    store.watch("planner/plans", (snap) => {
        if (snap.pending || dirty) return;
        const d = (snap.exists && snap.data) || {};
        plans = { days: d.days && typeof d.days === "object" ? d.days : {}, weeks: d.weeks && typeof d.weeks === "object" ? d.weeks : {} };
        loaded = true; status(demo ? "This device only" : "Live", "ok");
        // Redraw on outside changes, but never under the teacher's cursor.
        if (first || !(document.activeElement && document.activeElement.classList.contains("pl-in"))) draw();
        first = false;
    }, (e) => { loaded = true; status("Could not load plans (" + ((e && e.code) || "error") + ")", "bad"); draw(); });
}
