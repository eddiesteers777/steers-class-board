/* ==========================================
   Calera Math — school calendar helpers (pure, no page code).
   Dates are "YYYY-MM-DD" strings in local time everywhere.
========================================== */
import { SCHOOL_YEAR } from "../data/calendar.js?v=28";
export { SCHOOL_YEAR };

export const iso = (d) => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
export const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const today = () => iso(new Date());
export const weekday = (s) => parse(s).getDay();            // 0 Sunday … 6 Saturday
export const mondayOf = (s) => { const w = weekday(s); return addDays(s, w === 0 ? -6 : 1 - w); };

/** School events on a date: [{ kind, text, start, end }]. */
export function eventsOn(s) {
    return SCHOOL_YEAR.events.filter(([a, b]) => s >= a && s <= b).map(([a, b, kind, text]) => ({ kind, text, start: a, end: b }));
}
/** True when students are in school that day. */
export function isSchoolDay(s) {
    const w = weekday(s);
    if (w === 0 || w === 6 || s < SCHOOL_YEAR.first || s > SCHOOL_YEAR.last) return false;
    return !eventsOn(s).some((e) => e.kind === "off" || e.kind === "work");
}
const dayList = (() => { const out = []; for (let d = SCHOOL_YEAR.first; d <= SCHOOL_YEAR.last; d = addDays(d, 1)) if (isSchoolDay(d)) out.push(d); return out; })();
export const SCHOOL_DAYS = dayList;
/** 1-based student day number, or 0 when not a school day. */
export const dayNumber = (s) => dayList.indexOf(s) + 1;
/** The nine weeks a date falls in ({ n, start, end }), or null (breaks between terms count as the next one). */
export function nineWeeksOf(s) {
    return SCHOOL_YEAR.nineWeeks.find((q) => s <= q.end) || null;
}
export const schoolDaysBetween = (a, b) => dayList.filter((d) => d >= a && d <= b).length;
/** School days left in that nine weeks, counting the given day if it is one. */
export function daysLeftInNineWeeks(s) { const q = nineWeeksOf(s); return q ? schoolDaysBetween(s, q.end) : 0; }
/** Short label: "Mon Nov 16". */
export function short(s, opts) { return parse(s).toLocaleDateString([], opts || { weekday: "short", month: "short", day: "numeric" }); }
