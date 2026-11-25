/* ==========================================
   Anchor Board — a teacher's own school year (pure, no page code; tests: tools/calendar/core.test.mjs).

   Saved once per teacher at teacher/{uid}/settings/calendar (setup.html "Your school year"):
     { v: 1, label: "2026–27", first: "2026-08-13", last: "2027-05-27",
       terms: { kind: "nine" | "sem" | "tri", list: [{ n, start, end }] },
       events: [{ a, b, k, t }],          a/b: first and last date, k: off | work | term | early | note, t: name
       preset: "shelby-2026-27" | "" }
   (Firestore can't hold a list inside a list, so events are objects here and become
   [a, b, kind, text] rows in the SCHOOL_YEAR shape every page already reads.)

   js/schoolCal.js turns it into SCHOOL_YEAR. With nothing saved, every page keeps data/calendar.js exactly as before.
   Grading periods always exist (pages like Grades file work by period), so there is no "none".
========================================== */
import { SCHOOL_YEAR as SHELBY } from "../data/calendar.js?v=57";

export const KINDS = ["off", "work", "term", "early", "note"];
/** Grading periods: how many, what pages call one ("left in the 2nd nine weeks"), and the chip label. */
export const TERM_KINDS = {
    nine: { count: 4, name: "nine weeks", label: "Nine weeks" },
    sem: { count: 2, name: "semester", label: "Semesters" },
    tri: { count: 3, name: "trimester", label: "Trimesters" }
};
export const PRESETS = [{ id: "shelby-2026-27", label: "Shelby County 2026–27", year: SHELBY }];

const pad = (n) => ("0" + n).slice(-2);
export const okDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T12:00:00"));
const parse = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12);
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const weekday = (s) => parse(s).getDay();
const span = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);

/** "Teacher Workday", "PD", "Institute"… count as teacher days (no students); everything else is a day off. */
export const guessKind = (name) => (/work\s*day|teacher|\bpd\b|professional|institute|planning|in-?service/i.test(name || "") ? "work" : "off");

/** Every school day between first and last: weekdays that no off or work row covers. events: [a, b, kind, text] rows. */
export function schoolDays(first, last, events) {
    const out = [], off = (events || []).filter((e) => e[2] === "off" || e[2] === "work");
    if (!okDate(first) || !okDate(last) || first > last) return out;
    for (let d = first, n = 0; d <= last && n < 450; d = addDays(d, 1), n++) {
        const w = weekday(d);
        if (w === 0 || w === 6) continue;
        if (off.some(([a, b]) => d >= a && d <= b)) continue;
        out.push(d);
    }
    return out;
}

/** Split the year's school days into `kind`'s number of grading periods, as even as the days allow. */
export function splitTerms(first, last, events, kind) {
    const count = (TERM_KINDS[kind] || TERM_KINDS.nine).count, days = schoolDays(first, last, events);
    if (!count || days.length < count) return [];
    const out = [];
    for (let n = 1; n <= count; n++) {
        const s = Math.round(((n - 1) * days.length) / count), e = Math.round((n * days.length) / count) - 1;
        out.push({ n, start: n === 1 ? first : days[s], end: n === count ? last : days[e] });
    }
    return out;
}

/** Given only the end dates the teacher picked, fill each start (the next school day) and check the order. */
export function termsFromEnds(first, last, events, ends) {
    const days = schoolDays(first, last, events), list = [];
    let start = first;
    for (let i = 0; i < ends.length; i++) {
        const end = i === ends.length - 1 ? last : ends[i];
        if (!okDate(end) || end < start || end > last) return null;
        list.push({ n: i + 1, start, end });
        start = days.find((d) => d > end) || addDays(end, 1);
    }
    return list;
}

/** "2026–27" from the first and last day. */
export const labelFor = (first, last) => first.slice(0, 4) === last.slice(0, 4) ? first.slice(0, 4) : first.slice(0, 4) + "–" + last.slice(2, 4);

/** Keep only well-formed fields, so a bad document can never break a page. Returns the doc shape, or null. */
export function cleanCalendar(raw) {
    const d = raw && typeof raw === "object" ? raw : null;
    if (!d || !okDate(d.first) || !okDate(d.last) || d.first >= d.last || span(d.first, d.last) > 400) return null;
    const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
    const events = (Array.isArray(d.events) ? d.events : []).map((e) => {
        if (!e || typeof e !== "object") return null;
        const a = e.a, b = okDate(e.b) ? e.b : e.a, k = KINDS.includes(e.k) ? e.k : "off", t = str(e.t, 100) || (k === "work" ? "Teacher workday" : "No school");
        return okDate(a) && b >= a && span(a, b) <= 60 ? { a, b, k, t } : null;
    }).filter(Boolean).sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : 0)).slice(0, 80);
    const t = d.terms && typeof d.terms === "object" ? d.terms : {};
    const kind = TERM_KINDS[t.kind] ? t.kind : "nine";
    let list = (Array.isArray(t.list) ? t.list : []).filter((q) => q && okDate(q.start) && okDate(q.end) && q.start <= q.end)
        .map((q, i) => ({ n: i + 1, start: q.start, end: q.end })).slice(0, 6);
    if (list.some((q, i) => i && q.start <= list[i - 1].end) || (list.length && (list[0].start < d.first || list[list.length - 1].end > d.last))) list = [];
    if (list.length !== TERM_KINDS[kind].count) list = splitTerms(d.first, d.last, events.map((e) => [e.a, e.b, e.k, e.t]), kind);
    const preset = PRESETS.some((p) => p.id === d.preset) ? d.preset : "";
    return { v: 1, label: str(d.label, 20) || labelFor(d.first, d.last), first: d.first, last: d.last, terms: { kind, list }, events, preset };
}

/** The SCHOOL_YEAR shape (data/calendar.js) the pages read, from a saved document. Null when it isn't usable. */
export function yearFromDoc(raw) {
    const c = cleanCalendar(raw);
    if (!c) return null;
    const list = c.terms.list, kind = c.terms.kind;
    let semesters = [];
    if (kind === "sem") semesters = list.map((q) => Object.assign({}, q));
    else if (kind === "nine" && list.length === 4) semesters = [{ n: 1, start: list[0].start, end: list[1].end }, { n: 2, start: list[2].start, end: list[3].end }];
    const events = c.events.map((e) => [e.a, e.b, e.k, e.t]);
    return { label: c.label, first: c.first, last: c.last, semesters, nineWeeks: list, termKind: kind, termName: TERM_KINDS[kind].name, events, saved: true };
}

/** A saved document from a SCHOOL_YEAR shape (a preset, or the year a page is showing now). */
export function docFromYear(y, preset) {
    const n = (y.nineWeeks || []).length, kind = TERM_KINDS[y.termKind] ? y.termKind : n === 2 ? "sem" : n === 3 ? "tri" : "nine";
    return {
        v: 1, label: y.label, first: y.first, last: y.last,
        terms: { kind, list: (y.nineWeeks || []).map((q) => ({ n: q.n, start: q.start, end: q.end })) },
        events: (y.events || []).map(([a, b, k, t]) => ({ a, b, k, t })),
        preset: preset || ""
    };
}


/* ---------- pasting a district's dates ----------
   One break or holiday per line: "Thanksgiving Break Nov 23 - 27", "11/23/2026 – 11/27/2026 Thanksgiving",
   "Labor Day: September 7", "2027-01-18 MLK Day". A date with no year takes the school year's year for that month. */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
function yearFor(month, first, last) {
    const fy = +first.slice(0, 4), ly = +last.slice(0, 4);
    return fy === ly ? fy : month >= +first.slice(5, 7) ? fy : ly;
}
function dateTokens(line, first, last) {
    const out = [], re = new RegExp(
        "(\\d{4})-(\\d{1,2})-(\\d{1,2})" +                                   // 2026-11-23
        "|(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?" +                            // 11/23 or 11/23/2026
        "|" + MONTH_RE + "\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?" +    // Nov 23, 2026
        "|(?:[-–—]|\\bto\\b|\\bthrough\\b|\\bthru\\b)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*[/:])", // "- 27" after a month date
        "gi");
    let m, lastMonth = 0, lastYear = 0;
    while ((m = re.exec(line))) {
        let y, mo, d;
        if (m[1]) { y = +m[1]; mo = +m[2]; d = +m[3]; }
        else if (m[4]) { mo = +m[4]; d = +m[5]; y = m[6] ? (+m[6] < 100 ? 2000 + +m[6] : +m[6]) : 0; }
        else if (m[7]) { mo = MONTHS.indexOf(m[7].slice(0, 3).toLowerCase()) + 1; d = +m[8]; y = m[9] ? +m[9] : 0; }
        else if (m[10] && lastMonth && out.length === 1) { mo = lastMonth; d = +m[10]; y = lastYear; }
        else continue;
        if (!mo || mo > 12 || !d || d > 31) continue;
        if (!y) y = yearFor(mo, first, last);
        const s = y + "-" + pad(mo) + "-" + pad(d);
        if (!okDate(s)) continue;
        out.push({ s, at: m.index, len: m[0].length });
        lastMonth = mo; lastYear = y;
    }
    return out;
}
/** Returns [{ a, b, k, t }] for each line that has a date. Lines without one are skipped. */
export function parsePastedDates(text, first, last) {
    const rows = [];
    String(text || "").split(/\n/).forEach((line) => {
        const toks = dateTokens(line, first, last);
        if (!toks.length) return;
        let a = toks[0].s, b = (toks[1] || toks[0]).s;
        if (b < a) { const yb = +b.slice(0, 4) + 1; const nb = yb + b.slice(4); b = okDate(nb) && nb >= a ? nb : a; }
        let name = line;
        toks.slice().reverse().forEach((t) => { name = name.slice(0, t.at) + " " + name.slice(t.at + t.len); });
        name = name.replace(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day)?\b\.?/gi, " ")
            .replace(/[-–—:,|•·()]+/g, " ").replace(/\b(to|through|thru|and)\b/gi, " ").replace(/\s+/g, " ").trim().slice(0, 60);
        rows.push({ a, b, k: guessKind(name), t: name || "No school" });
    });
    return rows.slice(0, 80);
}
