/* ==========================================
   Anchor Board — ACAP question formats and the 70/30 Vault Raid spiral (pure; tools/acap/formats.test.mjs).

   ACAP asks more than "type the answer". From the standards bank, this makes four of its formats:
     not  Which statement is NOT true?     4 worked problems as statements, one with a wrong answer (ordinary multiple choice)
     ms   Select all that are true          4 statements, 2 true and 2 false: tap every true one (new answer shape "ms")
     ord  Put the steps in order            one problem's own steps, mixed up: tap them first to last (new answer shape "ord")
     sw   Show your work                    a constructed-response style problem: typed answer, work on the pad first
   A wrong statement changes one number in a checked answer, and is kept only when the game's own answer checker
   (vaultCore sameAnswer) says it is not the same answer.

   A question in a saved set carries fm ("not" | "ms" | "ord" | "sw"). For ms and ord the answer key is letters:
   "A, C" (in letter order) and "B, D, A, C" (in step order). Pages that don't know fm show ms and ord as a plain box,
   where typing the letters still counts.

   spiralSet() makes a Vault Raid question set: about 70% this week's standard(s) and 30% earlier standards
   (the class's weakest first), with about 1 in 4 of this week's questions in an ACAP format. Each standard is its own
   category, named with its code, so Vault Raid's saved results land in Student Progress per standard.
========================================== */
import { sameAnswer, formOf as vFormOf } from "./vaultCore.js?v=75";

export const FORMATS = { not: "Which is NOT true", ms: "Select all", ord: "Order the steps", sw: "Show your work" };
const LET = "ABCDE";
const CHOICE_MAX = 80;

/* ---------- small helpers ---------- */
function rng(seed) { let h = 2166136261; const s = String(seed); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
function mix(list, seed) { const r = rng(seed), a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const letters = (idx) => idx.map((i) => LET[i]).join(", ");

/** The answer shape a game question gets: ms and ord when the question says so (and has choices), else the game's usual one. */
export function formOf(q) {
    if (q && (q.fm === "ms" || q.fm === "ord") && Array.isArray(q.ch) && q.ch.length >= 2) return q.fm;
    return vFormOf(q);
}
/** The format field to carry from a saved question into the game: {} for an ordinary question. */
export function fmOf(k) {
    const fm = k && k.fm;
    if (fm === "ms" || fm === "ord") return Array.isArray(k.ch) && k.ch.length >= 2 && lettersOk(k.a, k.ch.length, fm) ? { fm } : {};
    return fm === "not" || fm === "sw" ? { fm } : {};
}
/** Is a letters answer well formed for this many choices? ms: different letters, A to the last; ord: every choice once. */
export function lettersOk(a, n, fm) {
    const parts = String(a || "").toUpperCase().split(/[\s,]+/).filter(Boolean);
    if (!parts.length || parts.some((p) => p.length !== 1 || LET.indexOf(p) < 0 || LET.indexOf(p) >= n) || new Set(parts).size !== parts.length) return false;
    return fm === "ord" ? parts.length === n : true;
}

/* ---------- the four formats ---------- */
/** The problem and its answer as one line: "Write 0.00072 in scientific notation. → 7.2 × 10⁻⁴" (too long or no answer: ""). */
export function statement(x, ans) {
    const q = String(x.q || "").replace(/\s+/g, " ").trim(), a = String(ans == null ? x.a : ans).trim();
    if (!q || !a || /\[\[/.test(q)) return "";
    const s = q + " → " + a; return s.length <= CHOICE_MAX ? s : "";
}
/** A believable wrong answer: one number in the answer moved by 1 (or its sign flipped, or its decimal point moved).
    null when there is no safe one (estimates, answers with no number). */
export function wrongOf(x, salt = 0) {
    const a = String(x.a || ""); if (/\babout\b|≈|estimate|approx/i.test(a + " " + x.q)) return null;
    // numbers, not a base with a raised power (the 10 in 10⁶ or 10^6)
    const nums = [...a.matchAll(/([−-])?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/g)].filter((m) => !/^[⁰¹²³⁴⁵⁶⁷⁸⁹⁻^]/.test(a.slice(m.index + m[0].length)) && !/[A-Za-z]$/.test(a.slice(0, m.index)));
    if (!nums.length) return null;
    const pick = nums[(nums.length - 1 + salt) % nums.length], minus = pick[1] || "", body = pick[2];
    const comma = body.includes(","), dec = (body.split(".")[1] || "").length, v = (minus ? -1 : 1) * +body.replace(/,/g, "");
    const show = (n) => { const abs = Math.abs(n), t = comma ? abs.toLocaleString("en-US") : abs.toFixed(dec); return (n < 0 ? (minus || "−") : "") + t; };
    const step = dec ? Math.pow(10, -dec) : 1, tries = salt % 2 ? [v - step, v + step] : [v + step, v - step];
    if (dec) tries.push(v * 10);
    if (v !== 0) tries.push(-v);
    for (const t of tries) {
        const w = a.slice(0, pick.index) + show(+t.toFixed(dec + 2)) + a.slice(pick.index + pick[0].length);
        if (w !== a && !sameAnswer(w, x.a, x.al || [])) return w;
    }
    return null;
}
/** A bank problem in the game's shape (the bank writes choices, also and steps). */
export const itemOf = (x) => ({ id: x.id || "", std: x.std || "", lvl: +x.lvl || 2, q: String(x.q || ""), a: String(x.a || ""), al: (x.al || x.also || []).slice(0, 8),
    ch: (x.ch || x.choices || []).length >= 2 ? (x.ch || x.choices).slice(0, 5) : null, st: (x.st || x.steps || []).slice(0, 4) });
const hintsFor = {
    not: ["Work each problem on your pad.", "Check each answer shown against yours. The one that doesn't match is NOT true."],
    ms: ["Work each problem on your pad.", "Tap every one whose answer matches yours. Leave the others."],
    ord: ["Find the step you would do first.", "Each next step uses what the step before it found."],
};
/** "Which statement is NOT true?" from 4 problems (3 shown with their answer, 1 with a wrong one). null if they don't make one. */
export function notTrue(items, seed) {
    if ((items || []).length < 4) return null;
    const four = items.slice(0, 4), r = rng("not|" + seed), bad = Math.floor(r() * 4), w = wrongOf(four[bad], Math.floor(r() * 3));
    if (!w) return null;
    const ch = four.map((x, i) => statement(x, i === bad ? w : null));
    if (ch.some((s) => !s) || new Set(ch).size < 4) return null;
    // used: the problems shown with their right answer (the one shown wrong can still be asked on its own)
    return { q: "Which statement is NOT true?", a: ch[bad], al: [], ch, st: hintsFor.not.slice(), fm: "not", used: four.filter((x, i) => i !== bad) };
}
/** "Select all that are true" from 4 problems: 2 right, 2 with a wrong answer. Answer: the true ones' letters. */
export function selectAll(items, seed) {
    if ((items || []).length < 4) return null;
    const four = items.slice(0, 4), r = rng("ms|" + seed), badSet = new Set(mix([0, 1, 2, 3], "ms|" + seed).slice(0, 2));
    const ch = four.map((x, i) => (badSet.has(i) ? (() => { const w = wrongOf(x, Math.floor(r() * 3)); return w ? statement(x, w) : ""; })() : statement(x)));
    if (ch.some((s) => !s) || new Set(ch).size < 4) return null;
    const good = [0, 1, 2, 3].filter((i) => !badSet.has(i));
    return { q: "Select all the statements that are true.", a: letters(good), al: [good.map((i) => LET[i]).join("")], ch, st: hintsFor.ms.slice(), fm: "ms", used: good.map((i) => four[i]) };
}
/** "Put the steps in order" from one problem with 3 or 4 of its own steps. The answer: the letters, first step to last. */
export function orderSteps(x, seed) {
    const steps = (x && Array.isArray(x.st) ? x.st : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 4);
    if (steps.length < 3 || steps.some((s) => s.length > CHOICE_MAX) || new Set(steps).size < steps.length || /\[\[/.test(x.q)) return null;
    let order = mix(steps.map((_, i) => i), "ord|" + seed);
    if (order.every((v, i) => v === i)) order = order.slice(1).concat(order[0]);   // never already in order
    const ch = order.map((i) => steps[i]);
    const ans = steps.map((_, k) => order.indexOf(k));   // step k sits at choice ans[k]
    const q = String(x.q).replace(/\s+/g, " ").trim(), lead = "Put the steps in order, first to last. ";
    if ((lead + q).length > 400) return null;
    return { q: lead + q, a: letters(ans), al: [ans.map((i) => LET[i]).join("")], ch, st: hintsFor.ord.slice(), fm: "ord", used: [x] };
}
/** Show your work: the same problem, typed answer, with its steps for help after a miss. */
export function showWork(x) {
    if (!x || !x.q || !x.a) return null;
    const q = "Show your work on the pad, then answer. " + String(x.q).trim(); if (q.length > 400) return null;
    return { q, a: x.a, al: (x.al || []).slice(0, 8), ch: null, st: (x.st || []).slice(0, 4), fm: "sw", used: [x] };
}
const plainQ = (x) => ({ q: x.q, a: x.a, al: (x.al || []).slice(0, 8), ch: x.ch && x.ch.length >= 2 ? x.ch.slice(0, 5) : null, st: (x.st || []).slice(0, 4), used: [x] });

/* ---------- the spiral set ---------- */
/**
 * Which standards a spiral uses. ctx as js/checks.js planCheck: { order, marks, need, focus }.
 * now: the week's standard(s) (focus, else marked Teaching, else the first not marked); earlier: up to `many` standards
 * before them in course order (marked ones if any), the class's weakest first.
 */
export function spiralCodes(ctx, many = 3) {
    const order = ctx.order || [], marks = ctx.marks || {}, need = ctx.need || new Map();
    const teaching = (ctx.focus && ctx.focus.length ? ctx.focus : order.filter((c) => marks[c] === "teaching")).filter((c) => order.includes(c));
    const now = teaching.length ? teaching : [order.find((c) => !marks[c]) || order[0]].filter(Boolean);
    const at = Math.min(...now.map((c) => order.indexOf(c)));
    let earlier = order.slice(0, isFinite(at) ? at : 0).filter((c) => !now.includes(c));
    const marked = earlier.filter((c) => marks[c]); if (marked.length) earlier = marked;
    earlier = earlier.map((c, i) => ({ c, i, n: need.get(c) || 0 })).sort((a, b) => b.n - a.n || b.i - a.i).map((x) => x.c).slice(0, many);
    return { now, earlier };
}
/** How many questions go to this week and to the spiral: 70/30 of n, all to this week when there is nothing earlier. */
export function split(n, hasEarlier, share = 0.7) { const now = hasEarlier ? Math.round(n * share) : n; return { now, old: n - now }; }

/**
 * The Vault Raid set. o = { cls, now: [codes], earlier: [codes], bank, n = 20, share = 0.7, seed, title, fmt = 0.25 }
 * Returns { doc: the set to save (games/s_<id> shape, without id), counts: { now, old, fmt: { not, ms, ord, sw } }, short: [codes with too few problems] }.
 */
export function spiralSet(o) {
    const n = o.n || 20, seed = o.seed || "", inCls = (x) => x.cls === o.cls || (x.for || []).includes(o.cls);
    const poolOf = (code) => mix((o.bank || []).filter((x) => x.std === code && inCls(x) && x.q && x.a && !/\[\[/.test(x.q)).map(itemOf), "sp|" + code + "|" + seed);
    const { now: nNow, old: nOld } = split(n, (o.earlier || []).length > 0, o.share || 0.7);
    const share = (codes, total) => codes.map((c, i) => ({ c, k: Math.floor(total / codes.length) + (i < total % codes.length ? 1 : 0) })).filter((x) => x.k > 0);
    const counts = { now: 0, old: 0, fmt: { not: 0, ms: 0, ord: 0, sw: 0 } }, short = [], cats = [];
    const order = ["not", "ord", "ms", "sw"];
    let turn = 0;
    share(o.now || [], nNow).forEach(({ c, k }, ci) => {
        let left = poolOf(c); const out = [], want = Math.max(k >= 3 ? 1 : 0, Math.round(k * (o.fmt == null ? 0.25 : o.fmt)));
        const take = (q) => { const used = new Set(q.used); left = left.filter((x) => !used.has(x)); delete q.used; out.push(q); };
        for (let t = 0, made = 0; t < order.length && made < want; t++) {
            const f = order[(turn + t) % order.length]; let q = null;
            if (f === "not") q = notTrue(left.filter((x) => !x.ch || x.ch.length < 2), seed + c + ci);
            if (f === "ms") q = selectAll(left.filter((x) => !x.ch || x.ch.length < 2), seed + c + ci);
            if (f === "ord") { for (const x of left) { q = orderSteps(x, seed + c); if (q) break; } }
            if (f === "sw") { const x = left.find((y) => y.lvl >= 2 && !(y.ch && y.ch.length >= 2)); q = x ? showWork(x) : null; }
            if (q) { take(q); counts.fmt[f]++; made++; }
        }
        turn += 1;
        while (out.length < k && left.length) take(plainQ(left[0]));
        if (out.length < k) short.push(c);
        counts.now += out.length; if (out.length) cats.push({ n: c + " this week", clues: out });
    });
    // keep it 70/30 even when this week's standard has only a few problems in the bank
    const oldN = counts.now ? Math.min(nOld, Math.max(1, Math.round(counts.now * (1 - (o.share || 0.7)) / (o.share || 0.7)))) : nOld;
    share(o.earlier || [], oldN).forEach(({ c, k }) => {
        const pool = poolOf(c), easy = pool.filter((x) => x.lvl <= 2).concat(pool.filter((x) => x.lvl > 2));
        const out = easy.slice(0, k).map((x) => { const q = plainQ(x); delete q.used; return q; });
        if (out.length < k) short.push(c);
        counts.old += out.length; if (out.length) cats.push({ n: c + " review", clues: out });
    });
    cats.forEach((cat) => cat.clues.forEach((q, i) => { q.p = 100 * (i + 1); if (!q.ch) delete q.ch; if (!q.al || !q.al.length) delete q.al; if (!q.st || !q.st.length) delete q.st; if (!q.fm) delete q.fm; }));
    return { doc: { title: (o.title || "Spiral").slice(0, 80), maker: 1, per: (o.per || []).slice(), cats, final: null, spiral: { now: (o.now || []).slice(), earlier: (o.earlier || []).slice(), share: o.share || 0.7 } }, counts, short };
}
/** "Spiral · 8.20 + review · Nov 23" */
export function spiralTitle(now, day = new Date()) {
    return "Spiral · " + now.join(", ") + " + review · " + day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
