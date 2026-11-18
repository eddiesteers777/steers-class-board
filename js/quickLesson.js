/* ==========================================
   Anchor Board — Quick lesson (lesson.html).
   One class, one day: title, learning target, bellringer problems, agenda and exit ticket.
   It saves the same week format the board already reads, as a private week:
     teacher/{uid}/weekfiles/<id> = { json, at }, listed (approved) in weekfiles/index.
   A week that is already private (Week Review, Week Builder) is edited in place. A published week
   (built into the code) is copied to "ql-<monday>" first, so its other days and classes stay as they were.
   With no week for that Monday, the week starts blank and every class gets five empty days.
========================================== */

export const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const parseIso = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const plus = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return d; };
/** "November 17" for the i-th day of the week starting on monday. */
export const dayDate = (monday, i) => { const d = plus(monday, i); return MONTHS[d.getMonth()] + " " + d.getDate(); };
/** "November 16–20", or "March 30–April 3" across a month. */
export function weekDates(monday) {
    const a = plus(monday, 0), b = plus(monday, 4);
    return a.getMonth() === b.getMonth() ? MONTHS[a.getMonth()] + " " + a.getDate() + "–" + b.getDate() : dayDate(monday, 0) + "–" + dayDate(monday, 4);
}

export function blankDay(monday, i) {
    return { name: FULL[i], title: FULL[i], date: dayDate(monday, i), agendaLine: "", short: "", bell: "Bellringer", agenda: [], supplies: ["Pencil"], reminders: [], lt: "", problems: [] };
}
export function blankClass(label, cls, monday) {
    return { label, cls: cls || label, weekLT: "", bellSeconds: 300, days: [0, 1, 2, 3, 4].map((i) => blankDay(monday, i)) };
}

const clean = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n || 300) : "");
const pairs = (list) => (Array.isArray(list) ? list : []).map((p) => ({ q: clean(p && p.q, 300), a: clean(p && p.a, 120) })).filter((p) => p.q).slice(0, 12);

/** What the form shows for a day: the fields Quick lesson edits. */
export function formFrom(day) {
    const d = day || {}, n = d.notes || {};
    return {
        title: d.title && d.title !== d.name ? d.title : (d.agendaLine || ""),
        lt: d.lt || "",
        problems: pairs(d.problems),
        agenda: (Array.isArray(d.agenda) ? d.agenda : []).join(" · "),
        exit: pairs(n.exit)
    };
}

/** Write the form into a day, keeping everything else the day already has (supplies, reminders, full guided notes). */
export function applyForm(day, f) {
    const d = Object.assign({}, day), title = clean(f.title, 80), lt = clean(f.lt, 200);
    const agenda = String(f.agenda || "").split(/\s*(?:·|•|;|\n|\s\|\s)\s*/).map((t) => clean(t, 120)).filter(Boolean).slice(0, 10);
    d.title = title || d.name;
    d.agendaLine = title || agenda.find((t) => !/^bell\s?ringer$/i.test(t)) || "";
    d.short = (title || d.agendaLine).slice(0, 40);
    d.lt = lt;
    d.problems = pairs(f.problems);
    d.agenda = agenda;
    const exit = pairs(f.exit);
    if (d.notes || exit.length) {
        d.notes = Object.assign({ title: title || d.name, targets: lt ? [lt.replace(/^I can\s*/i, "")] : [] }, d.notes || {});
        if (exit.length) d.notes.exit = exit; else delete d.notes.exit;
    }
    return d;
}

/** One line of a problem list: "6 × 4 ÷ 2 | 12", "Solve x + 3 = 5   Answer: 2", "Area? -> 30". */
export function splitProblem(line) {
    const t = clean(line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, ""), 400);
    if (!t) return null;
    const m = /^(.*?)\s*(?:\||\t|→|->|\(?\b(?:answer|ans|key)\s*[:=]\s*)\s*(.*?)\)?$/i.exec(t);
    return m && m[1] ? { q: m[1].trim(), a: m[2].trim() } : { q: t, a: "" };
}

/**
 * Split a pasted lesson into the form's boxes. Headings ("Learning target:", "Bellringer", "Agenda", "Exit ticket")
 * start a section; text on the heading line counts too. A first line with no heading becomes the title.
 * Returns { title, lt, problems, agenda, exit, found } where found lists the boxes that got something.
 */
export function splitPaste(text) {
    const out = { title: "", lt: "", problems: [], agenda: "", exit: [] }, agenda = [];
    // A heading is a known word followed by ":" or a dash, or alone on its line ("Bellringer"). "I can …" is always a target.
    const H = (words) => new RegExp("^(?:" + words + ")\\s*(?:[:\\-–]\\s*|$)", "i");
    const HEAD = [
        ["title", H("title|lesson|topic")],
        ["lt", H("learning target|target|objective|lt")],
        ["problems", H("bell\\s?ringer|bell work|warm[\\s-]?up|do now")],
        ["agenda", H("agenda|today|plan")],
        ["exit", H("exit\\s?ticket|exit slip|exit")]
    ];
    let sec = "";
    String(text || "").split(/\r?\n/).forEach((raw) => {
        let line = raw.trim(); if (!line) return;
        if (/^i can\b/i.test(line) && !out.lt) { out.lt = line; sec = ""; return; }
        const h = HEAD.find(([, re]) => re.test(line));
        if (h) {
            sec = h[0];
            const rest = line.replace(h[1], "").trim();
            line = rest; if (!line) return;
        }
        if (sec === "title" || (!sec && !out.title)) { out.title = out.title || line; sec = sec === "title" ? "" : sec; return; }
        if (sec === "lt") { out.lt = out.lt ? out.lt + " " + line : line; return; }
        if (sec === "problems" || sec === "exit") { const p = splitProblem(line); if (p) out[sec].push(p); return; }
        if (sec === "agenda") { agenda.push(...line.split(/\s*(?:·|•|;)\s*/).map((t) => t.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim()).filter(Boolean)); return; }
    });
    out.agenda = agenda.join(" · ");
    out.problems = out.problems.slice(0, 12); out.exit = out.exit.slice(0, 12);
    out.found = ["title", "lt", "problems", "agenda", "exit"].filter((k) => (Array.isArray(out[k]) ? out[k].length : out[k]));
    return out;
}

/** The class ids and names the teacher has, in bell order: [{ id, label, periods: ["1st", "2nd"] }]. */
export function classList(periods, weeks) {
    const out = [];
    periods.forEach(([p, c]) => {
        let row = out.find((r) => r.id === c);
        if (!row) {
            const w = [...weeks].reverse().find((x) => x.classes && x.classes[c]);
            row = { id: c, label: (w && w.classes[c].label) || c, cls: (w && w.classes[c].cls) || "", periods: [] }; out.push(row);
        }
        row.periods.push(p);
    });
    return out;
}

/**
 * The week to edit for a Monday: { week, id, isNew }. A private week for that Monday is edited in place;
 * a published one is copied to ql-<monday>; with neither, a blank week. Every class the teacher has gets five days.
 */
export function weekFor(monday, allWeeks, classes) {
    const strip = (w) => { const c = JSON.parse(JSON.stringify(w)); delete c._at; delete c._private; return c; };
    const priv = allWeeks.find((w) => w._private && w.monday === monday);
    const pub = allWeeks.find((w) => !w._private && w.monday === monday);
    let week, id, isNew = false;
    if (priv) { week = strip(priv); id = priv.id; }
    else if (pub) { week = strip(pub); id = "ql-" + monday; week.id = id; week.label = (week.label || "Week") + " (edited)"; isNew = true; }
    else { week = { id: "ql-" + monday, label: "Week of " + dayDate(monday, 0).replace(/^(\w{3})\w*/, "$1"), dates: weekDates(monday), monday, classes: {} }; id = week.id; isNew = true; }
    classes.forEach((c) => {
        const have = week.classes[c.id];
        if (!have || !Array.isArray(have.days) || have.days.length !== 5) week.classes[c.id] = blankClass(c.label, c.cls, monday);
    });
    return { week, id, isNew };
}
