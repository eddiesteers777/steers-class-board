/* ==========================================
   Anchor Board — which day Home's Today card is about (Nov 24 2026).
   Eddie, Nov 23: the card said "Monday, November 16" on the Monday of Thanksgiving Break. Home only checked
   for a weekday, so on a break it fell back to the last week whose Monday had passed and showed its Monday.
   Now the school calendar decides: on a school day the card is today; on a weekend, break or holiday it says
   so and points at the next school day, using that day's plan when a week for it exists.
   Pure: no page code, so tools/attendance/homeday.test.mjs can check it in Node.
========================================== */

const pad = (n) => ("0" + n).slice(-2);
const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const mondayOf = (s) => { const w = parse(s).getDay(); return addDays(s, w === 0 ? -6 : 1 - w); };
export const isWeekday = (s) => { const w = parse(s).getDay(); return w >= 1 && w <= 5; };

/**
 * opts: { today "YYYY-MM-DD", weeks (oldest first), inSchool(day) → bool, offOn(day) → { text, start, end } | null,
 *         byCalendar (true for the Calera pack: weeks are matched to the calendar by their Monday) }
 * Returns { school, off, planDay, week, di, planned }:
 *   school   today is a school day
 *   off      the break or holiday today falls in (null on a plain weekend or a school day)
 *   planDay  the day the card and "period by period" are about: today, else the next school day (null if none)
 *   week, di the week and day index (0 Monday … 4 Friday) to show
 *   planned  that week really is planDay's week (false: planDay has no week yet, so `week` is the last one saved)
 */
export function homeDay(opts) {
    const { today, weeks, inSchool, offOn, byCalendar } = opts, list = weeks || [];
    const school = !!inSchool(today);
    let planDay = school ? today : null;
    if (!school) for (let d = addDays(today, 1), n = 0; n < 200 && !planDay; d = addDays(d, 1), n++) if (inSchool(d)) planDay = d;
    const off = school ? null : (offOn ? offOn(today) : null) || null;
    // The newest week whose Monday has arrived (the old rule; also every week with no Monday, like the sample week).
    let latest = list[0] || null; for (const w of list) if (!w.monday || w.monday <= today) latest = w;
    let week = latest, planned = true;
    if (byCalendar && planDay) {
        const exact = list.find((w) => w.monday === mondayOf(planDay));
        if (exact) week = exact; else planned = !!(latest && !latest.monday);
    }
    const di = planDay && planned ? parse(planDay).getDay() - 1 : 0;
    return { school, off, planDay, week, di: di >= 0 && di <= 4 ? di : 0, planned };
}

/** "Monday, November 30" */
export function longDay(s) { return parse(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); }
/** "Nov 23 to 27" or "Dec 21 to Jan 1"; one day gives "Nov 11". */
export function span(a, b) {
    const A = parse(a), B = parse(b), m = (d) => d.toLocaleDateString("en-US", { month: "short" });
    if (a === b) return m(A) + " " + A.getDate();
    return m(A) + " " + A.getDate() + " to " + (A.getMonth() === B.getMonth() ? "" : m(B) + " ") + B.getDate();
}
