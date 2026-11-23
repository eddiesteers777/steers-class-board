/* ==========================================
   Anchor Board — what an absent student missed, and the warnings (Phase 2B, Nov 23 2026). Pure: no page, no store,
   no network (tests: tools/attendance/absence.test.mjs).

   Inputs are records the site already keeps; nothing new about a student is stored.
     absences   js/attendanceCore.js absences(): [{ day, per, key, nm }]   (Remote "Who's out", plus Tracker "abs" taps)
     weeks      the weeks on the board (published + approved private): classes[cls].days[i].agenda ...
     periods    [[period, class]]
     gb         Gradebook: { items: gb/items list, cats: gb/setup cats }   -> graded or not, and the category's name
     data       Class Data index (data/index imports): Fact Blitz and Vault Raid sets carry source, period, date
     asg        Assignments index (asg/index list)
     behind     (period, studentName, codes[]) => the standards among codes the student is still working on (game profile)
     marks      (period, studentName) => catch-up marks by day { "<day>": { st: "assigned"|"done", via } } (js/catchupCore.js)
     found      (period, studentName) => the student's foundational-track placement { skill } or null (ACAP Phase 3,
                js/foundational.js: found/{period}, students Eddie places by hand)

   Graded or practice follows the Gradebook (Eddie, Nov 23): something is GRADED when it belongs to a Gradebook
   category (Homework, Class Work, Quizzes & Tests). A quiz or test, and homework, are graded by their name;
   anything else is graded only when a Gradebook item for that period and day matches it. The rest is practice.

   A day marked "done" (caught up) stays listed but no longer counts toward any warning; a student whose missed days
   are all caught up has no warnings.
   Warnings (Eddie's four):
     days     absent 2 or more days in one school week
     test     missed a test or quiz (a make-up is due)
     work     missed 3 or more graded assignments in the last two weeks
     behind   behind on foundational skills and missed class: placed on the foundational track (Phase 3), or missed a
              lesson on a standard the game profile shows is not Secure yet
========================================== */
import { isDay } from "./attendanceCore.js?v=1";
import { topicOf } from "./profileCore.js?v=2";

export const WINDOW_DAYS = 14;          // how far back absences are shown
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const GRADED_WORK = 3;           // missed graded assignments that raise the warning
export const ABSENT_DAYS = 2;           // days in one school week that raise the warning

const noon = (iso) => new Date(iso + "T12:00:00");
export const isoOf = (d) => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
export const dayName = (iso) => DAY_NAMES[noon(iso).getDay()];
/** The Monday of the school week a date falls in (a weekend belongs to the week before). */
export function mondayOf(iso) { const d = noon(iso), k = d.getDay(); d.setDate(d.getDate() - (k === 0 ? 6 : k - 1)); return isoOf(d); }
export const daysAgo = (iso, today) => Math.round((noon(today) - noon(iso)) / 864e5);
/** 0 = Monday .. 4 = Friday for a school day, -1 for a weekend. */
export const dayIndex = (iso) => { const k = noon(iso).getDay(); return k >= 1 && k <= 5 ? k - 1 : -1; };

/** The week on the board for a date, or null. */
export function weekFor(weeks, iso) {
    const mon = mondayOf(iso);
    return (weeks || []).find((w) => w && w.monday === mon) || null;
}

const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !["activity", "sheet", "practice", "class", "work", "assignment", "week", "period"].includes(w));
const shares = (a, b) => { const x = new Set(words(a)); return words(b).some((w) => x.has(w)); };
const CAT_DEFAULT = { hw: "Homework", cw: "Class Work", qt: "Quizzes & Tests" };

/** The gradebook category name for an id. */
export const catName = (gb, id) => { const c = ((gb && gb.cats) || []).find((x) => x && x.id === id); return (c && c.name) || CAT_DEFAULT[id] || ""; };

/** How an agenda line reads: { kind, cat } where cat is a gradebook category id the NAME alone settles, else "". */
export function classify(text) {
    const t = String(text || "");
    if (/\b(test|quiz|assessment|exam)\b/i.test(t) && !/study guide|review|jeopardy|practice (test|quiz)|correction|retake/i.test(t)) return { kind: /\bquiz\b/i.test(t) && !/\btest\b/i.test(t) ? "quiz" : "test", cat: "qt" };
    if (/homework|extra practice|\bhw\b/i.test(t)) return { kind: "homework", cat: "hw" };
    if (/fact blitz/i.test(t)) return { kind: "game", game: "Fact Blitz", cat: "" };
    if (/vault raid/i.test(t)) return { kind: "game", game: "Vault Raid", cat: "" };
    if (/guided notes|notes/i.test(t)) return { kind: "notes", cat: "" };
    if (/speed dating/i.test(t)) return { kind: "activity", cat: "" };
    return { kind: "activity", cat: "" };
}

/** Pretty label for an agenda line ("Speed Dating Activity" stays; a bare "Test" stays "Test"). */
const label = (t) => String(t || "").replace(/\s+/g, " ").trim();

/**
 * Everything one period had on one day, as items: { t, kind, cat, graded, catName, makeup, game }.
 * ctx: { weeks, periods, gb, data, asg, per, day }
 */
export function itemsFor(ctx) {
    const { weeks, periods, gb, data, asg, per, day } = ctx, out = [], idx = dayIndex(day);
    if (idx < 0) return out;
    const cls = ((periods || []).find((p) => p[0] === per) || [])[1], wk = weekFor(weeks, day), c = wk && wk.classes && wk.classes[cls], d = c && c.days && c.days[idx];
    const add = (t, extra) => { t = label(t); if (!t || out.some((x) => x.t.toLowerCase() === t.toLowerCase())) return; const k = classify(t); out.push(Object.assign({ t, kind: k.kind, cat: k.cat, game: k.game || "", graded: !!k.cat, catName: k.cat ? catName(gb, k.cat) : "", makeup: k.kind === "test" || k.kind === "quiz" }, extra || {})); };
    if (d) {
        (d.agenda || []).forEach((a) => add(a));
        const hasTest = () => out.some((x) => x.makeup);   // the agenda already names the day's test: never count it twice
        const as = c.assessment; if (as && +as.day === idx && !hasTest()) add(as.name || (as.type === "quiz" ? "Quiz" : "Test"));
        const q = c.quiz; if (q && +q.day === idx && !hasTest()) add(q.kind === "quiz" ? "Quiz" : "Test");
        const hw = c.homework; if (hw && (hw.days || []).some((h) => +h.day === idx)) add("Homework, day " + (idx + 1));
    }
    (data || []).filter((m) => m && m.period === per && String(m.date || "").slice(0, 10) === day && (m.source === "Fact Blitz" || m.source === "Vault Raid")).forEach((m) => {
        const dup = out.findIndex((x) => x.game === m.source); if (dup >= 0) { out[dup].t = label(m.title) || out[dup].t; return; }
        add(m.title || m.source, { kind: "game", game: m.source });
    });
    (asg || []).filter((a) => a && !a.only && !a.xc && a.status !== "draft" && (a.periods || []).includes(per) && isoOf(new Date(+a.opened || +a.at || 0)) === day).forEach((a) => {
        const qt = a.type === "quiz" || a.type === "test";
        add(a.title || "Assignment", qt ? { kind: a.type, cat: "qt", graded: true, catName: catName(gb, "qt"), makeup: true } : { kind: "assignment" });
    });
    // Gradebook: an item for this period and day settles graded + the category's name; one with no match is listed on its own.
    ((gb && gb.items) || []).filter((g) => g && !g.off && !g.xc && String(g.date || "").slice(0, 10) === day && (!g.periods || !g.periods.length || g.periods.includes(per))).forEach((g) => {
        const hit = out.find((x) => !x.graded && (shares(x.t, g.title) || (x.game && shares(x.game, g.title))));
        const nm = catName(gb, g.cat);
        if (hit) { hit.graded = true; hit.cat = g.cat; hit.catName = nm; if (g.cat === "qt") hit.makeup = true; }
        else if (!out.some((x) => shares(x.t, g.title))) add(g.title, { kind: g.cat === "qt" ? "test" : "assignment", cat: g.cat, graded: true, catName: nm, makeup: g.cat === "qt" });
    });
    return out;
}

/** "Missed Tuesday — Speed Dating sheet, Guided Notes Day 1" (the plain line Eddie reads). */
export function missedLine(day, items, hasPlan) {
    if (!hasPlan && !items.length) return "Missed " + dayName(day) + " — no lesson plan found for that day";
    const bits = items.map((i) => i.t + (i.makeup ? " (make-up needed)" : ""));
    return "Missed " + dayName(day) + " — " + (bits.length ? bits.join(", ") : "nothing recorded for that day");
}

/** Standards a missed day covered: codes written on that day's notes (its standard line or its practice problems), else the class quiz's codes for the week. Never guessed. */
export function standardsFor(ctx) {
    const { weeks, periods, per, day } = ctx, idx = dayIndex(day); if (idx < 0) return [];
    const cls = ((periods || []).find((p) => p[0] === per) || [])[1], wk = weekFor(weeks, day), c = wk && wk.classes && wk.classes[cls], d = c && c.days && c.days[idx], seen = new Set(), out = [];
    const take = (txt) => { const t = topicOf(txt); if (t && t.std && !seen.has(t.std)) { seen.add(t.std); out.push(t.std); } };
    if (d && d.notes && d.notes.standard) String(d.notes.standard).split(/[;,\n]/).forEach(take);
    // codes the week file wrote on that day's practice problems (Week 5: "std": "8.25")
    if (d && d.notes) ((d.notes.practice || [])).forEach((x) => ((x && x.problems) || [x]).forEach((p) => p && p.std && take(p.std)));
    if (!out.length && c && c.quiz && Array.isArray(c.quiz.items)) c.quiz.items.forEach((q) => q && q.std && take(q.std));
    return out;
}

/**
 * The dashboard. input: { absences, weeks, periods, gb, data, asg, behind, today, rosterOf }
 * Returns { periods: [{ per, cls, students: [{ key, nm, today, allDone, days: [{ day, name, items, line, hasPlan, stds, mark }], warnings: [{ k, text }] }] }], warned, outToday }
 * Periods with no absence in the window are left out. Students with a warning, then today's absences, come first.
 */
export function buildDashboard(input) {
    const { absences, weeks, periods, gb, data, asg, behind, today } = input;
    const keep = (absences || []).filter((a) => isDay(a.day) && daysAgo(a.day, today) >= 0 && daysAgo(a.day, today) < WINDOW_DAYS && dayIndex(a.day) >= 0);
    const by = new Map();
    keep.forEach((a) => { const k = a.per + "|" + a.key; if (!by.has(k)) by.set(k, { per: a.per, key: a.key, nm: a.nm, days: [] }); by.get(k).days.push(a.day); });
    const perOut = new Map();
    by.forEach((s) => {
        const days = s.days.sort((a, b) => b.localeCompare(a)).map((day) => {
            const ctx = { weeks, periods, gb, data, asg, per: s.per, day }, items = itemsFor(ctx), cls = ((periods || []).find((p) => p[0] === s.per) || [])[1], wk = weekFor(weeks, day);
            return { day, name: dayName(day), items, hasPlan: !!(wk && wk.classes && wk.classes[cls] && wk.classes[cls].days[dayIndex(day)]), stds: standardsFor(ctx), line: "" };
        });
        const mk = typeof input.marks === "function" ? input.marks(s.per, s.nm) || {} : {};
        days.forEach((d) => { d.line = missedLine(d.day, d.items, d.hasPlan); d.mark = mk[d.day] || null; });
        const open = days.filter((d) => !(d.mark && d.mark.st === "done")), warnings = [];
        const allDone = !open.length;
        const worst = allDone ? 0 : Math.max(...Array.from(s.days.reduce((m, d) => m.set(mondayOf(d), (m.get(mondayOf(d)) || 0) + 1), new Map()).values()));
        if (worst >= ABSENT_DAYS) warnings.push({ k: "days", text: "Absent " + worst + " days in one week" });
        const tests = open.flatMap((d) => d.items.filter((i) => i.makeup).map((i) => ({ d, i })));
        if (tests.length) warnings.push({ k: "test", text: "Missed a " + (tests[0].i.kind === "quiz" ? "quiz" : "test") + " (" + tests[0].d.name + "): make-up needed" });
        const graded = open.reduce((n, d) => n + d.items.filter((i) => i.graded && !i.makeup).length, 0) + tests.length;
        if (graded >= GRADED_WORK) warnings.push({ k: "work", text: "Missed " + graded + " graded assignments" });
        {
            const codes = Array.from(new Set(open.flatMap((d) => d.stds))), hit = typeof behind === "function" && codes.length ? behind(s.per, s.nm, codes) || [] : [];
            const pl = typeof input.found === "function" ? input.found(s.per, s.nm) : null, bits = [];
            if (pl) bits.push("On the foundational track" + (pl.skill ? " (" + pl.skill + ")" : ""));
            if (hit.length) bits.push("missed " + hit.join(", ") + ", which was still being worked on");
            if (bits.length && !allDone) { const t = bits.join("; "); warnings.push({ k: "behind", text: t.charAt(0).toUpperCase() + t.slice(1) }); }
        }
        if (!perOut.has(s.per)) perOut.set(s.per, { per: s.per, cls: ((periods || []).find((p) => p[0] === s.per) || [])[1] || "", students: [] });
        perOut.get(s.per).students.push({ key: s.key, nm: s.nm, today: s.days.includes(today), days, warnings, allDone });
    });
    const order = (periods || []).map((p) => p[0]), rank = (p) => (order.indexOf(p) < 0 ? 99 : order.indexOf(p));
    const list = Array.from(perOut.values()).sort((a, b) => rank(a.per) - rank(b.per));
    list.forEach((p) => p.students.sort((a, b) => b.warnings.length - a.warnings.length || (b.today ? 1 : 0) - (a.today ? 1 : 0) || a.nm.localeCompare(b.nm)));
    return { periods: list, warned: list.reduce((n, p) => n + p.students.filter((s) => s.warnings.length).length, 0), outToday: list.reduce((n, p) => n + p.students.filter((s) => s.today).length, 0) };
}

/** Foundational check from a game profile kid: the standards (of codes) tried 3+ times and not Secure yet (no cracked lock, or under 80% of the last results). */
export function behindFromKid(kid, codes) {
    if (!kid || !kid.t) return [];
    return (codes || []).filter((code) => {
        const t = kid.t["s-" + String(code).toLowerCase().replace(/[^a-z0-9]+/g, "-")]; if (!t || (+t.a || 0) < 3) return false;
        const h = String(t.h || ""), ok = [...h].filter((c) => c === "1").length, acc = h.length ? ok / h.length : 0;
        return !(t.m && acc >= 0.8);
    });
}
