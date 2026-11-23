/* ==========================================
   Anchor Board — the three classroom checks that feed ACAP readiness (pure; tools/acap/checks.test.mjs).
   Each one is an ordinary Quiz assignment (js/assignCore.js) built from the standards bank, one standard per
   question, so every answer lands in Student Progress per student and per standard.

     diag  Monday diagnostic   5 questions: 2 on earlier standards (prerequisite / spiral) + 3 on the new standard(s)
     week  Friday check        5 questions on the week's standard(s)
     cum   Cumulative check    20 questions over the standards taught so far, spread by the ACAP blueprint points
                               (replaces the old bonus test, which gave no data)

   This file only proposes. The teacher sees every question's standard, can swap any of them, and nothing is
   assigned until they tap Approve. Fluency (Fact Blitz) is the fourth check and keeps its own page.
========================================== */
import * as C from "./assignCore.js?v=7";
import { catOf } from "./readiness.js?v=1";

export const KINDS = {
    diag: { label: "Monday diagnostic", n: 5, blurb: "Start of the week: 2 questions on earlier standards, 3 on what's new. Not for a grade: it shows who needs the prerequisite first." },
    week: { label: "Friday check", n: 5, blurb: "End of the week: 5 questions on this week's standard(s), On level and Stretch." },
    cum: { label: "Cumulative check", n: 20, blurb: "Every 4 weeks: 20 questions over everything taught so far, spread by ACAP blueprint points. Replaces the bonus test." },
};
export const ROLE_WORD = { prior: "Earlier standard", new: "New standard", week: "This week", cum: "Taught so far" };
const LV = { prior: [1, 2], new: [1, 2], week: [2, 3], cum: [2, 3] };

/**
 * The standards a check would use. ctx = {
 *   cls, order: [codes in course order], marks: { code: "teaching" | "taught" | "reteach" },
 *   need: Map code -> class need (bigger = further from Secure, from readiness classFocus), scored: Set of codes with any score,
 *   focus: [codes] (optional: the week's standards, else the ones marked Teaching) }
 * Returns [{ code, role, lv }].
 */
export function planCheck(kind, ctx) {
    const order = ctx.order || [], marks = ctx.marks || {}, need = ctx.need || new Map(), scored = ctx.scored || new Set();
    const teaching = (ctx.focus && ctx.focus.length ? ctx.focus : order.filter((c) => marks[c] === "teaching")).filter((c) => order.includes(c));
    const taught = order.filter((c) => ["taught", "reteach", "teaching"].includes(marks[c]));
    const covered = taught.length ? taught : order.filter((c) => scored.has(c));
    const firstUntaught = order.find((c) => !marks[c]) || order[0];
    const now = teaching.length ? teaching : [firstUntaught].filter(Boolean);
    const slot = (code, role) => ({ code, role, lv: LV[role] });
    const spread = (codes, n, role) => Array.from({ length: n }, (_, i) => slot(codes[i % codes.length], role));
    if (kind === "week") return spread(now, KINDS.week.n, "week");
    if (kind === "diag") {
        const at = Math.min(...now.map((c) => order.indexOf(c)).filter((i) => i >= 0));
        // Earlier standards: before the new one in course order, taught if any are marked; the class's weakest first, then the nearest.
        let earlier = order.slice(0, isFinite(at) ? at : 0).filter((c) => !now.includes(c));
        const marked = earlier.filter((c) => marks[c]); if (marked.length) earlier = marked;
        earlier = earlier.map((c, i) => ({ c, i, n: need.get(c) || 0 })).sort((a, b) => b.n - a.n || b.i - a.i).map((x) => x.c);
        const prior = earlier.slice(0, 2); while (prior.length < 2 && earlier.length) prior.push(earlier[prior.length % earlier.length]);
        return (prior.length ? prior.map((c) => slot(c, "prior")) : []).concat(spread(now, KINDS.diag.n - prior.length, "new"));
    }
    if (kind === "cum") return cumulative(ctx.cls, covered.length ? covered : now, need, KINDS.cum.n);
    return [];
}

/** n questions over the codes, by blueprint points per category (largest remainder, each covered category at least 1),
    then round-robin inside a category, the class's weakest standard first. Standards with no ACAP weight share what's left over equally. */
export function cumulative(cls, codes, need, n) {
    const byCat = new Map(), loose = [];
    codes.forEach((c) => { const k = catOf(cls, c); if (k) { if (!byCat.has(k.id)) byCat.set(k.id, { pts: k.pts, codes: [] }); byCat.get(k.id).codes.push(c); } else loose.push(c); });
    const cats = [...byCat.entries()];
    if (!cats.length) return Array.from({ length: n }, (_, i) => ({ code: loose[i % Math.max(1, loose.length)], role: "cum", lv: LV.cum })).filter((s) => s.code);
    const tot = cats.reduce((s, [, x]) => s + x.pts, 0);
    const want = cats.map(([id, x]) => ({ id, x, raw: (n * x.pts) / tot }));
    want.forEach((w) => { w.k = Math.max(1, Math.floor(w.raw)); });
    let left = n - want.reduce((s, w) => s + w.k, 0);
    want.slice().sort((a, b) => (b.raw - Math.floor(b.raw)) - (a.raw - Math.floor(a.raw))).forEach((w) => { if (left > 0) { w.k++; left--; } });
    while (left < 0) { const big = want.filter((w) => w.k > 1).sort((a, b) => b.k - a.k)[0]; if (!big) break; big.k--; left++; }
    const out = [];
    want.forEach((w) => {
        const list = w.x.codes.slice().sort((a, b) => (need.get(b) || 0) - (need.get(a) || 0));
        for (let i = 0; i < w.k; i++) out.push({ code: list[i % list.length], role: "cum", lv: LV.cum });
    });
    return out;
}

/** How many questions each blueprint category gets, for the preview line. */
export function catCounts(cls, slots) {
    const m = new Map(); slots.forEach((s) => { const k = catOf(cls, s.code), id = k ? k.name : "No ACAP weight"; m.set(id, (m.get(id) || 0) + 1); }); return m;
}

/**
 * The quiz, ready to save. When a standard has more than one question, each question draws from its own share of the
 * problems, so a student never gets the same problem twice. Returns null when a standard has no problems in the bank.
 */
export function buildQuiz(kind, slots, bank, cls, periods, title) {
    const uses = new Map(); slots.forEach((s) => uses.set(s.code, (uses.get(s.code) || 0) + 1));
    const seen = new Map(), skills = [];
    for (const [k, s] of slots.entries()) {
        const all = (bank || []).filter((x) => x.std === s.code && (x.cls === cls || (x.for || []).includes(cls)));
        let pool = all.filter((x) => s.lv.includes(x.lvl)); if (pool.length < uses.get(s.code)) pool = all;
        if (!pool.length) return null;
        const j = seen.get(s.code) || 0, of = uses.get(s.code); seen.set(s.code, j + 1);
        const part = pool.length >= of ? pool.filter((x, i) => i % of === j) : pool;
        skills.push({ k: "q" + k, src: "bank:" + s.code, name: s.code + (of > 1 ? " (" + (j + 1) + ")" : ""), std: s.code, w: 1, pin: -1, pool: part.map(C.cleanItem) });
    }
    const now = Date.now();
    return { id: now.toString(36) + Math.random().toString(36).slice(2, 6), title, type: "quiz", cls, periods: periods.slice(), skills,
        opts: Object.assign({}, C.DEFAULTS, { shuffle: true }), due: 0, status: "open", opened: now, at: now, chk: kind };
}

/** "Monday diagnostic · 8.5, 8.6 · Nov 30" */
export function titleFor(kind, slots, day = new Date()) {
    const codes = [...new Set(slots.filter((s) => s.role !== "prior").map((s) => s.code))];
    const d = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return KINDS[kind].label + " · " + (kind === "cum" ? codes.length + " standards" : codes.join(", ")) + " · " + d;
}
