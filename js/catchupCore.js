/* ==========================================
   Anchor Board — catch-up for an absent student (absence dashboard part C, Nov 23 2026). Pure: no page, no store,
   no network (tests: tools/attendance/catchup.test.mjs).

   The worksheet for a missed day is the day's own paper, made the same way Week Builder and the Class Page make it
   (js/weekPapers.js papersFor): guided notes, the speed dating set, the quiz or test for a make-up. Nothing new is
   written by hand and no answer key is ever shown to a student.

   Where the catch-up goes (Eddie, Nov 23):
     DeltaMath   the platform does some of the teaching: independent practice, homework, catch-up, with its built-in
                 examples, videos and instant help. Best for absent students and the foundational group.
     Magma Math  Eddie leads it: he controls the pacing, does the explaining, and uses it on the board.
   Neither app takes an import from this site, so choosing one gives the text to paste and records the choice.

   Record (private): teacher/{uid}/catchup/{period} = { kids: { <kidKey>: { nm, d: { "<YYYY-MM-DD>": MARK } } }, at }
   MARK = { st: "assigned" | "done", via: "deltamath" | "magma" | "", at }
   A day marked "done" no longer counts toward a warning on Home. Written one field at a time (merge).
========================================== */
import { kidKey } from "./profileCore.js?v=2";

export const ROUTES = {
    deltamath: {
        name: "DeltaMath", short: "The platform teaches",
        when: "Independent practice, homework or catch-up. DeltaMath's built-in examples, videos and instant help do some of the teaching.",
        best: "Best for absent students and the foundational group.",
    },
    magma: {
        name: "Magma Math", short: "I teach it",
        when: "You lead the lesson: you control the pacing, do the explaining and use it on the board.",
        best: "Best when you will reteach this with the student or a small group.",
    },
};
export const ROUTE_KEYS = Object.keys(ROUTES);
export const STATUS_WORD = { assigned: "Catch-up assigned", done: "Caught up" };

/** The day's student papers from a papersFor() list: that day's papers only, never a key or the modified group's copy. */
export function dayPapers(papers, idx) {
    return (papers || []).filter((p) => p && !p.key && !p.alt && new RegExp("^" + (idx + 1) + " ").test(String(p.pre || "")));
}

/** One mark for the record: a partial document to merge into catchup/{period}. */
export function markWrite(nm, day, st, via, at = Date.now()) {
    const mark = { st: st === "done" ? "done" : "assigned", via: ROUTE_KEYS.includes(via) ? via : "", at };
    return { kids: { [kidKey(nm)]: { nm: String(nm).trim().slice(0, 24), d: { [day]: mark } } }, at };
}
/** Taking a mark back: the day goes back to plain "missed". */
export function clearWrite(nm, day, at = Date.now()) {
    return { kids: { [kidKey(nm)]: { nm: String(nm).trim().slice(0, 24), d: { [day]: { st: "", via: "", at } } } }, at };
}

/** A student's marks by day: { "<day>": { st, via, at } } (blank marks dropped). */
export function marksOf(doc, nm) {
    const k = doc && doc.kids && doc.kids[kidKey(nm)], d = (k && k.d) || {}, out = {};
    Object.keys(d).forEach((day) => { const m = d[day]; if (m && (m.st === "assigned" || m.st === "done")) out[day] = { st: m.st, via: ROUTE_KEYS.includes(m.via) ? m.via : "", at: +m.at || 0 }; });
    return out;
}

/** The index of the "}" that closes the "{" at i, or -1. */
function closing(t, i) { let d = 0; for (let k = i; k < t.length; k++) { if (t[k] === "{") d++; else if (t[k] === "}" && --d === 0) return k; } return -1; }
/** Split at the "/" that is not inside braces, or null. */
function topSlash(t) { let d = 0; for (let k = 0; k < t.length; k++) { if (t[k] === "{") d++; else if (t[k] === "}") d--; else if (t[k] === "/" && d === 0) return [t.slice(0, k), t.slice(k + 1)]; } return null; }
const wrap = (x) => (/[\s+\-−×÷/]/.test(x) ? "(" + x + ")" : x);
/**
 * Week-file markup to plain text that pastes anywhere: {3/4} -> 3/4, 4{2/3} -> 4 2/3, a complex fraction
 * {1{1/2}/−{3/4}} -> (1 1/2)/(−3/4), § -> $, a picture token -> [picture]. Braces nest, so this reads them in pairs.
 */
export function plain(s) {
    let t = String(s == null ? "" : s).replace(/§/g, "$").replace(/\[\[[^\]]*\]\]/g, "[picture]"), out = "";
    for (let i = 0; i < t.length; i++) {
        if (t[i] !== "{") { out += t[i]; continue; }
        const j = closing(t, i); if (j < 0) { out += t.slice(i); break; }
        const inner = t.slice(i + 1, j), parts = topSlash(inner);
        const txt = parts ? (() => { const a = plain(parts[0]).trim(), b = plain(parts[1]).trim(); return wrap(a) + "/" + wrap(b); })() : plain(inner);
        const coef = parts && /^[A-Za-z(]/.test(t.slice(j + 1, j + 2)) && !/^\(/.test(txt);   // {3/4}x is (3/4)x, never 3/(4x)
        out += (/\d$/.test(out) && parts && !/[{]/.test(parts[0]) ? " " : "") + (coef ? "(" + txt + ")" : txt);   // 4{2/3} is the mixed number 4 2/3
        i = j;
    }
    return out;
}

/** Every practice problem in a notes day, flat: parts ({ label, problems: [{ n, q, a, std }] }) or plain { q, a } items. */
export function notesProblems(notes) {
    const out = [];
    ((notes && notes.practice) || []).forEach((x) => {
        if (x && Array.isArray(x.problems)) x.problems.forEach((p) => { if (p && p.q && p.a != null) out.push(p); });
        else if (x && x.q && x.a != null) out.push(x);
    });
    return out;
}

/**
 * Practice to paste into DeltaMath or Magma Math, from the missed day's guided notes: the first worked example
 * (its last step is the answer), then up to 10 practice problems, then the answer key (teacher only). Every problem
 * and answer is copied from the week file, which was checked when it was built; nothing is made up here.
 * Returns { text, n } (n = problems).
 */
export function copyFromNotes(notes, route, dayLabel) {
    if (!notes) return { text: "", n: 0 };
    const probs = notesProblems(notes).slice(0, 10), ex = (notes.examples || []).find((e) => e && e.q && Array.isArray(e.steps) && e.steps.length);
    if (!probs.length && !ex) return { text: "", n: 0 };
    const R = ROUTES[route] || ROUTES.deltamath, L = [];
    L.push("Catch-up: " + plain(notes.title || "Missed lesson") + (dayLabel ? " (" + dayLabel + ")" : ""));
    if (notes.standard) L.push("Standard: " + plain(notes.standard));
    L.push("For " + R.name + ": " + R.when);
    if (ex) {
        L.push("", "Worked example" + (ex.title ? ": " + plain(ex.title) : ""), plain(ex.q));
        ex.steps.forEach((st, k) => L.push("  Step " + (k + 1) + ": " + plain(st && st.m != null ? st.m : st) + (st && st.why ? "  (" + plain(st.why) + ")" : "")));
    }
    if (probs.length) { L.push("", "Problems"); probs.forEach((x, k) => L.push((k + 1) + ". " + plain(x.q))); }
    if (probs.length) { L.push("", "Answer key (teacher only)"); probs.forEach((x, k) => L.push((k + 1) + ". " + plain(x.a))); }
    return { text: L.join("\n"), n: probs.length };
}
