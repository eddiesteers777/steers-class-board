/* ==========================================
   Anchor Board — put any teacher's courses in grade level order (pure, no page code; tests: tools/courses/order.test.mjs).
   Works from the course name alone, so it fits any set of courses, not one school's:
     Kindergarten, 1st Grade … 8th Grade ("Grade 7", "Math 6" and "seventh grade" read the same way),
     an Accelerated / Advanced / Honors course right after its grade,
     then high school: Algebra I, Geometry, Algebra II, Precalculus, the other senior courses, then Calculus.
   Names it can't place keep their order and go last.
========================================== */

const WORDS = { kindergarten: 0, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8 };
const SENIOR = /model|finite|statistic|stats|quantitative|discrete|trig|college|consumer|financial|data science/;

/** A number to sort a course name by: the grade (8.5 for an accelerated 8th), 9 and up for high school, 99 if unknown. */
export function gradeRank(label) {
    const s = String(label || "").toLowerCase();
    const extra = /acc|advanced|honou?rs|\bgt\b|gifted/.test(s) ? 0.5 : 0;
    if (/\bk\b|kinder/.test(s)) return 0 + extra;
    let m = /\b([1-9]|1[0-2])(?:st|nd|rd|th)\b/.exec(s) || /\bgrade\s*([1-9]|1[0-2])\b/.exec(s) || /\b(?:math|mathematics)\s*([4-8])\b/.exec(s);
    if (m) return Number(m[1]) + extra;
    m = /\b(first|second|third|fourth|fifth|sixth|seventh|eighth)\b/.exec(s);
    if (m) return WORDS[m[1]] + extra;
    if (/pre-?\s?alg/.test(s)) return 7.8;
    if (/integrated/.test(s)) { m = /\b(i{1,3}|[1-3])\b/.exec(s.replace(/integrated|math\w*/g, " ")); if (m) return 8 + (/^\d$/.test(m[1]) ? Number(m[1]) : m[1].length) + extra / 2; }
    if (/alg\w*\s*(ii|2)\b/.test(s)) return 11 + extra / 2;
    if (/alg/.test(s)) return 9 + extra / 2;
    if (/geometry/.test(s)) return 10 + extra / 2;
    if (/pre-?\s?calc/.test(s)) return 12;
    if (/calc/.test(s)) return 13;
    if (SENIOR.test(s)) return 12.5;
    return 99;
}

/** The same items in grade level order. labelOf turns an item into its course name. Ties keep their order. */
export function byGrade(items, labelOf = (x) => x) {
    return items.map((x, i) => [gradeRank(labelOf(x)), i, x]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((r) => r[2]);
}
