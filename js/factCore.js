/* ==========================================
   Anchor Board — Fact Blitz, the rules (an arcade-style timed fact fluency check).
   Pure functions only (no page, no store), so they can be tested on their own (tools/fluency/core.test.mjs).

   Fact sets: multiplication, division (no remainders), integer + and −, integer × and ÷, all integer
   operations, and a mix of everything. Facts go up to 10 or 12. A run is timed; it ends on its own when the clock
   runs out. A student with extra time (an accommodation the teacher sets) gets the same run, longer.

   A run's log is one string per fact: "<fact>:<typed>:<ms>", the fact as "7x8", "56d7", "-3p9", "4m-6"
   (x times, d divided by, p plus, m minus). The teacher's page scores a run from its log, never from a score
   the student's Chromebook reports.

   Grade (only for a Speed check): facts right ÷ the goal for the run's length, capped at 100%.
   The goal is facts right per minute (the teacher sets it; 25 to start). Extra time does not raise the goal:
   a student with 1.5× time on a 2-minute check still needs 2 minutes' worth of facts for 100%.
========================================== */

export const SETS = [
    ["mul", "Multiplication", "×"],
    ["div", "Division", "÷"],
    ["ias", "Integers: add and subtract", "+ −"],
    ["imd", "Integers: multiply and divide", "× ÷"],
    ["int", "Integers: all four", "+ − × ÷"],
    ["mix", "Mixed: all of it", "×  ÷  ±"],
];
export const setName = (k) => (SETS.find((s) => s[0] === k) || SETS[0])[1];
export const isSet = (k) => SETS.some((s) => s[0] === k);
export const TIMES = [60, 120, 180, 300];               // seconds a run can be
export const EXTRA = [1, 1.25, 1.5, 2];                  // extra time a student can have
export const DEFAULTS = { set: "mul", top: 12, secs: 120, goal: 25, mode: "check", tries: 1, counts: "first" };
export const MAX_RUNS = 30, MAX_LOG = 400;

/* ---------- facts ---------- */
const OPS = { x: "×", d: "÷", p: "+", m: "−" };
const FACT = /^(-?\d+)([xdpm])(-?\d+)$/;
/** "7x8" -> { a: 7, op: "x", b: 8 } or null. */
export function parseFact(f) { const m = FACT.exec(String(f || "")); return m ? { a: +m[1], op: m[2], b: +m[3] } : null; }
export const makeFact = (a, op, b) => a + op + b;
/** The answer to a fact, or null for a bad one (or a division that doesn't come out even). */
export function answerOf(f) {
    const p = typeof f === "string" ? parseFact(f) : f; if (!p) return null;
    if (p.op === "x") return p.a * p.b;
    if (p.op === "p") return p.a + p.b;
    if (p.op === "m") return p.a - p.b;
    if (p.op === "d") return p.b !== 0 && p.a % p.b === 0 ? p.a / p.b : null;
    return null;
}
const neg = (n) => (n < 0 ? "−" + -n : String(n));
/** How a fact reads on screen: "7 × 8", "−56 ÷ 7", "4 − (−6)". A negative second number gets parentheses. */
export function showFact(f) {
    const p = typeof f === "string" ? parseFact(f) : f; if (!p) return "";
    return neg(p.a) + " " + OPS[p.op] + " " + (p.b < 0 ? "(" + neg(p.b) + ")" : String(p.b));
}

/** Every fact in a set, once each. top = the biggest factor (10 or 12). Factors start at 2 (×0 and ×1 are not drilled). */
export function factsOf(set, top = 12) {
    const T = top === 10 ? 10 : 12, out = [], range = []; for (let i = 2; i <= T; i++) range.push(i);
    const mul = () => range.forEach((a) => range.forEach((b) => out.push(makeFact(a, "x", b))));
    const div = () => range.forEach((b) => range.forEach((q) => out.push(makeFact(b * q, "d", b))));
    const ias = () => {
        // integer + and −: numbers from −T to T (not 0), at least one negative in every fact, so each one is an integer fact
        for (let a = -T; a <= T; a++) for (let b = -T; b <= T; b++) {
            if (!a || !b || (a > 0 && b > 0)) continue;
            out.push(makeFact(a, "p", b)); out.push(makeFact(a, "m", b));
        }
    };
    const imd = () => range.forEach((a) => range.forEach((b) => {
        [[-a, b], [a, -b], [-a, -b]].forEach(([x, y]) => out.push(makeFact(x, "x", y)));
        [[-a * b, a], [a * b, -a], [-a * b, -a]].forEach(([x, y]) => out.push(makeFact(x, "d", y)));
    }));
    if (set === "mul") mul(); else if (set === "div") div(); else if (set === "ias") ias(); else if (set === "imd") imd();
    else if (set === "int") { ias(); imd(); }
    else { mul(); div(); ias(); imd(); }
    return out;
}

/** A small seeded random (so a deck can be replayed in tests). */
export function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/**
 * A deck to draw from: the set's facts shuffled, with "mix" weighted so each kind comes up about as often
 * (integer + and − has many more facts than the tables). Never the same fact twice in a row, and turnarounds
 * (7×8 then 8×7) not back to back.
 */
export function deck(set, top, seed, n = 200) {
    const r = rng(seed);
    const groups = set === "mix" ? ["mul", "div", "ias", "imd"].map((k) => factsOf(k, top)) : set === "int" ? ["ias", "imd"].map((k) => factsOf(k, top)) : [factsOf(set, top)];
    const bags = groups.map(() => []), out = [];
    const twin = (f, g) => { const a = parseFact(f), b = parseFact(g); return a && b && a.op === b.op && a.op === "x" && Math.abs(a.a) === Math.abs(b.b) && Math.abs(a.b) === Math.abs(b.a); };
    for (let i = 0; i < n; i++) {
        const gi = Math.floor(r() * groups.length);
        if (!bags[gi].length) { bags[gi] = groups[gi].slice(); for (let j = bags[gi].length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [bags[gi][j], bags[gi][k]] = [bags[gi][k], bags[gi][j]]; } }
        let f = bags[gi].pop(), tries = 0;
        while (out.length && (f === out[out.length - 1] || twin(f, out[out.length - 1])) && tries++ < 5) { bags[gi].unshift(f); f = bags[gi].pop(); }
        out.push(f);
    }
    return out;
}

/** Normalize a typed answer: "−12", "-12", " 12 " -> "-12" / "12". Empty stays empty. */
export const cleanTyped = (y) => String(y == null ? "" : y).replace(/[−–—]/g, "-").replace(/\s+/g, "").slice(0, 8);
export function isRight(fact, typed) {
    const a = answerOf(fact), y = cleanTyped(typed);
    if (a == null || !/^-?\d+$/.test(y)) return false;
    return +y === a;
}
/** How many characters the answer takes ("-56" is 3): the game checks an answer once that many are typed. */
export const answerLen = (fact) => { const a = answerOf(fact); return a == null ? 0 : String(a).length; };

/* ---------- a run ---------- */
/** One log entry. */
export const logItem = (fact, typed, ms) => fact + ":" + cleanTyped(typed) + ":" + Math.max(0, Math.min(99999, Math.round(+ms || 0)));
export function parseLog(lg) {
    return (Array.isArray(lg) ? lg : []).map((s) => {
        const parts = String(s).split(":"); if (parts.length !== 3) return null;
        const f = parts[0]; if (answerOf(f) == null) return null;
        return { f, y: parts[1], ms: +parts[2] || 0, ok: isRight(f, parts[1]) };
    }).filter(Boolean);
}

/**
 * Score a run from its log. run = { s: seconds allowed (after extra time), b: base seconds, lg: [...] }.
 * Returns { n tried, r right, acc 0..1, pm right per minute (of the time they had), ms median ms per right fact,
 *           slow: [facts right but slow], miss: [facts missed], ok: false when the log doesn't fit the clock }.
 */
export function scoreRun(run) {
    const items = parseLog(run && run.lg), secs = +run.s || 0, base = +run.b || secs;
    const n = items.length, r = items.filter((x) => x.ok).length;
    const total = items.reduce((t, x) => t + x.ms, 0);
    const okMs = items.filter((x) => x.ok).map((x) => x.ms).sort((a, b) => a - b);
    const med = okMs.length ? okMs[Math.floor(okMs.length / 2)] : 0;
    const miss = [...new Set(items.filter((x) => !x.ok).map((x) => x.f))];
    const slow = [...new Set(items.filter((x) => x.ok && x.ms > 4000).map((x) => x.f))].filter((f) => !miss.includes(f));
    // the log can't hold more time than the clock gave (plus a little for the last keypress), or an answer faster than a person types
    const fits = secs > 0 && total <= secs * 1000 + 3000 && items.every((x) => x.ms >= 150 || !x.ok);
    return { n, r, acc: n ? r / n : 0, pm: secs > 0 ? r / (secs / 60) : 0, base, secs, ms: med, miss, slow, ok: fits };
}
/** The grade for a check run: right ÷ (goal per minute × base minutes), capped at 1. */
export function gradeOf(sc, goal, baseSecs) {
    const need = Math.max(1, (+goal || DEFAULTS.goal) * ((+baseSecs || sc.base || 60) / 60));
    return Math.max(0, Math.min(1, sc.r / need));
}
export const pct = (x) => (x == null || !isFinite(x) ? "–" : Math.round(x * 100) + "%");
export const fmtSecs = (s) => { s = Math.max(0, Math.round(+s || 0)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); };

/* ---------- arcade points (the fun number on the student's screen; never part of a grade) ---------- */
/** Combo multiplier from the streak of right answers: ×1, ×2 at 5, ×3 at 10, ×4 at 20. */
export const comboOf = (streak) => (streak >= 20 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1);
/** Points for one right answer: 100 × combo, plus a speed bonus up to 50 for answers under 3 seconds. */
export const pointsFor = (streak, ms) => 100 * comboOf(streak) + Math.max(0, Math.round(50 * (1 - Math.min(ms, 3000) / 3000)));

/* ---------- a student's runs in one session ---------- */
/** Which check runs count: the first, or the best (when the teacher allows more than one try). Returns the run or null. */
export function countedRun(runs, counts, goal) {
    // every check run counts as a try, even one left before the clock ran out (its log is scored as it stands)
    const checks = (runs || []).filter((x) => x && x.md === "c");
    if (!checks.length) return null;
    if (counts !== "best") return checks[0];
    return checks.map((x) => ({ x, g: gradeOf(scoreRun(x), goal, x.b) })).sort((a, b) => b.g - a.g || (a.x.t0 || 0) - (b.x.t0 || 0))[0].x;
}
/** Check runs used (finished or started and walked away from). */
export const checksUsed = (runs) => (runs || []).filter((x) => x && x.md === "c").length;

/* ---------- the profile record (teacher/{uid}/profiles/{period}.kids[key].fl) ----------
   fl = { <set>: { b: best right per minute, n: runs, h: [{ i: run id, d: day, p: per minute, a: accuracy, c: check 1/0, s: secs }, ... last 24] } }
   (maps, not lists: Firestore keeps no lists inside lists). Added once per run (its id), so saving again never doubles anything. */
export const FL_HIST = 24, XP_PER_RIGHT = 1, XP_MAX_RUN = 40;
export function addRun(flIn, set, run, day) {
    const fl = flIn && typeof flIn === "object" ? JSON.parse(JSON.stringify(flIn)) : {};
    const rec = fl[set] || (fl[set] = { b: 0, n: 0, h: [] });
    rec.h = Array.isArray(rec.h) ? rec.h : [];
    rec.h = rec.h.filter((h) => h && typeof h === "object" && !Array.isArray(h));
    if (rec.h.some((h) => h.i === run.id)) return { fl, xp: 0, added: false, best: false };
    const sc = scoreRun(run), pm = Math.round(sc.pm * 10) / 10;
    const best = pm > (+rec.b || 0);
    rec.h.push({ i: run.id, d: day, p: pm, a: Math.round(sc.acc * 100) / 100, c: run.md === "c" ? 1 : 0, s: +run.b || +run.s || 0 });
    rec.h.sort((a, b) => String(a.d).localeCompare(String(b.d)));
    rec.h = rec.h.slice(-FL_HIST); rec.n = (+rec.n || 0) + 1; rec.b = Math.max(+rec.b || 0, pm);
    return { fl, xp: sc.ok ? Math.min(XP_MAX_RUN, sc.r * XP_PER_RIGHT) : 0, added: true, best };
}
/** For a chart: one point per run, oldest first: { day, pm, acc, check }. */
export const flPoints = (rec) => ((rec && rec.h) || []).filter((h) => h && typeof h === "object").map((h) => ({ id: h.i, day: h.d, pm: +h.p || 0, acc: +h.a || 0, check: !!h.c, secs: +h.s || 0 }));
/** First check (the baseline), the latest check, and the change. */
export function flTrend(rec) {
    const pts = flPoints(rec), checks = pts.filter((p) => p.check), use = checks.length ? checks : pts;
    if (!use.length) return null;
    const first = use[0], last = use[use.length - 1];
    return { first, last, change: Math.round((last.pm - first.pm) * 10) / 10, best: Math.max(...pts.map((p) => p.pm)), n: pts.length };
}

/* ---------- practice on this device: the facts a student misses or is slow on come back sooner ---------- */
/** tough: { <fact>: weight }. After a run, missed facts get +3, slow ones +1, right-and-quick ones −1 (gone at 0). */
export function updateTough(tough, sc, items) {
    const t = Object.assign({}, tough || {});
    sc.miss.forEach((f) => { t[f] = Math.min(9, (t[f] || 0) + 3); });
    sc.slow.forEach((f) => { t[f] = Math.min(9, (t[f] || 0) + 1); });
    (items || []).filter((x) => x.ok && x.ms <= 4000).forEach((x) => { if (t[x.f]) { t[x.f] -= 1; if (t[x.f] <= 0) delete t[x.f]; } });
    const keys = Object.keys(t).sort((a, b) => t[b] - t[a]).slice(0, 60), out = {}; keys.forEach((k) => { out[k] = t[k]; });
    return out;
}
/** Mix tough facts into a practice deck: about one in four draws is a tough fact from this set. */
export function withTough(dk, tough, set, top, seed) {
    const inSet = new Set(factsOf(set, top)), list = Object.keys(tough || {}).filter((f) => inSet.has(f));
    if (!list.length) return dk;
    const r = rng(seed ^ 0x5bd1e995), out = dk.slice();
    for (let i = 2; i < out.length; i += 4) { const f = list[Math.floor(r() * list.length)]; if (f !== out[i - 1]) out[i] = f; }
    return out;
}
