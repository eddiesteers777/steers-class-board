/* ==========================================
   Anchor Board — which standards each class follows (pure, no page code; tests: tools/courses/core.test.mjs).

   A new teacher picks a course for each class in setup.html (step 2). It is saved on the class row in
   teacher/{uid}/settings/setup as classes[i].course:
     "al-7"     Alabama Grade 7 math            (data/standards.js "7th")
     "al-8"     Alabama Grade 8 math            (data/standards.js "8th")
     "al-8acc"  Alabama Grade 8 Accelerated     (data/standards.js "8th-acc", Grade 8 plus Algebra I)
     "own"      the teacher's own list, pasted on the Standards page
     ""         not picked yet
   Their own lists live at teacher/{uid}/settings/standards = { v: 1, lists: { "<class name, lower case>": [{ code, text, domain }] } }
   (keyed by class name because class ids follow the order of the rows and can shift).

   The Calera account doesn't use any of this: its three classes stay exactly as data/standards.js has them.
========================================== */

export const COURSES = [
    { id: "al-7", std: "7th", label: "Grade 7 math (Alabama)" },
    { id: "al-8", std: "8th", label: "Grade 8 math (Alabama)" },
    { id: "al-8acc", std: "8th-acc", label: "Grade 8 Accelerated, with Algebra I (Alabama)" },
    { id: "own", std: "", label: "My own standards (paste a list)" }
];
export const NO_COURSE = { id: "", std: "", label: "Choose later" };
export const courseById = (id) => COURSES.find((c) => c.id === id) || null;
export const okCourse = (id) => id === "" || COURSES.some((c) => c.id === id);

/** A first guess from the class name, so most teachers only have to check it. Null when the name says nothing. */
export function guessCourse(label) {
    const s = String(label || "").toLowerCase().replace(/pre-?\s?alg\w*/g, "");   // Pre-Algebra isn't Algebra I
    if (/acc|advanced|honou?rs|alg/.test(s) && /\b8\b|8th|eighth|alg/.test(s)) return "al-8acc";
    if (/\b7\b|7th|seventh/.test(s)) return "al-7";
    if (/\b8\b|8th|eighth/.test(s)) return "al-8";
    return null;
}

export const listKey = (label) => String(label || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);

/* ---------- pasting a list of standards ----------
   One standard per line, code first: "6.NS.1 Apply and extend…", "MA.6.AR.1.1: Translate…", "7.RP.A.2 - Recognize…".
   A short line with no code (like "Number Sense" or "Geometry") starts a new domain for the lines under it.
   A long line with no code is still a standard; it gets a number as its code. */
const CODE_RE = /^\s*(?:[-•*·]\s*)?((?:[A-Za-z]{1,8}[.\-]?)*\d+(?:[.\-][A-Za-z0-9]+)*[a-z]?)\s*[:.)\-–—]?\s+(.{3,})$/;
export function parseStandardsList(text) {
    const out = [], seen = new Set();
    let domain = "";
    String(text || "").split(/\r?\n/).forEach((raw) => {
        const line = raw.replace(/\s+/g, " ").trim();
        if (!line) return;
        const m = CODE_RE.exec(line);
        if (m && /\d/.test(m[1]) && m[1].length <= 24) {
            const code = m[1].replace(/[.\-]$/, "");
            if (seen.has(code.toLowerCase())) return;
            seen.add(code.toLowerCase());
            out.push({ code, text: m[2].trim().slice(0, 500), domain });
            return;
        }
        if (line.length <= 60 && !/[.?!]$/.test(line)) { domain = line.replace(/[:\-–—]+$/, "").trim().slice(0, 60); return; }
        let n = out.length + 1, code = String(n);
        while (seen.has(code)) code = String(++n);
        seen.add(code);
        out.push({ code, text: line.slice(0, 500), domain });
    });
    return out.slice(0, 200);
}

/** Keep only well-formed lists, so a bad document can never break a page. */
export function cleanLists(raw) {
    const d = raw && typeof raw === "object" && raw.lists && typeof raw.lists === "object" ? raw.lists : {};
    const str = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
    const lists = {};
    Object.keys(d).slice(0, 12).forEach((k) => {
        const key = listKey(k), seen = new Set();
        if (!key || !Array.isArray(d[k])) return;
        const rows = d[k].map((s) => s && typeof s === "object" ? { code: str(s.code, 24), text: str(s.text, 500), domain: str(s.domain, 60) } : null)
            .filter((s) => s && s.code && s.text && !seen.has(s.code.toLowerCase()) && seen.add(s.code.toLowerCase())).slice(0, 200);
        if (rows.length) lists[key] = rows;
    });
    return { v: 1, lists };
}

/** A pasted list in the shape the Standards page reads (data/standards.js), with no units. */
export function ownCourse(label, rows) {
    return {
        label, course: label, own: true, units: [],
        standards: (rows || []).map((s, i) => ({ n: i + 1, code: s.code, domain: s.domain || "Standards", cluster: "", text: s.text, critical: false, parts: [], objectives: [], prior: [] }))
    };
}

/**
 * This account's classes for the Standards page: [{ id, label, course, std, key }].
 * periods/weeks: data/weeks.js PERIODS and WEEKS (a starter account's ids are c1, c2…); setup: its settings/setup.
 * The first row of a class decides its course.
 */
export function classesFor(periods, weeks, setup) {
    const labels = new Map(), out = [], week = (weeks && weeks[0]) || { classes: {} };
    ((setup && setup.classes) || []).forEach((r) => { if (r && r.label && !labels.has(r.label)) labels.set(r.label, r.course || ""); });
    (periods || []).forEach(([, id]) => {
        if (out.some((c) => c.id === id)) return;
        const label = ((week.classes || {})[id] || {}).label || id;
        const course = labels.has(label) ? labels.get(label) : "";
        const c = courseById(course);
        out.push({ id, label, course: c ? c.id : "", std: c ? c.std : "", key: listKey(label) });
    });
    return out;
}
