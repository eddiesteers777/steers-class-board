/* ==========================================
   Anchor Board — math manipulatives: the model only (no DOM, no Firebase).
   Eddie, 2026-11-24: "more manipulatives on the board for me and the kids". Six board panels, built in
   js/manipPanels.js, that move, size, minimize and style like every other panel:
     balance   Equation balance     x and unit tiles on a scale that tips until both sides match (7.9, 8.11, Alg I.11)
     chance    Chance lab           spinner, coin or dice, with a running tally beside the expected results (7.13–7.16)
     line      Line explorer        two points on a grid; slope triangle and y = mx + b (8.7–8.9, Alg I)
     xform     Transformations      slide, flip, turn, dilate a shape; coordinates and the rule (8.22–8.24)
     pyth      Pythagorean squares  a right triangle with a square on each side (8.26–8.28)
     counters  Integer counters     two-colour counters and zero pairs (7.4, 7.5)
     angle     Angle explorer       parallel lines cut by a transversal, and a triangle's corners torn onto a line (8.25)
     area      Expression area model  a(bx + c) as tiles or an area box, expand and factor (7.6, 7.7)
     nl        Rational number line  jumps with fractions and decimals, subtracting as adding the opposite, distance (7.5)
     sys       Systems graph        two lines; where they cross, parallel or the same line; check a point in both (8.12, Alg I.10)
     scat      Scatter plot         data on real axes; the trend, outliers, the class's own trend line and a prediction (8.SP)
     tape      Tape diagram         percent of a whole, and ratios as equal units; solved one step at a time (7.RP)
     vol       Volume shapes        cylinder, cone and sphere; volume or a missing size, in π or 3.14; a cone is 1/3 of a cylinder (8.G.9)
     fn        Function machine     inputs go in, the rule makes outputs; mystery rules, and "function or not?" (8.13, 8.14)
     calc      Basic calculator     + − × ÷ and percent, with the order of operations
     sci       Scientific calculator powers, roots, trig, logs, Ans and fraction answers
     graph     Graphing calculator  expressions, sliders and a live graph (js/graphPanel.js)
   What each one shows lives in the shared board state (tools.mt.<key>), so the board and the Remote always match.
   Saved state can come from another device, so cleanMt() keeps only what is known, in range.
   Original Anchor Board tools; the ideas (balance, spinner, counters…) are classroom staples.
========================================== */
import { gcDefault, cleanGc, fmt } from "./graphCalc.js?v=1";

export const MT_KEYS = ["balance", "chance", "line", "xform", "pyth", "counters", "angle", "fn", "area", "nl", "sys", "scat", "tape", "vol", "calc", "sci", "graph"];
export const isMt = (k) => MT_KEYS.includes(k);

const int = (v, d) => { const n = Math.round(+v); return Number.isFinite(n) ? n : d; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const cint = (v, a, b, d) => clamp(int(v, d), a, b);
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

/* ---------- Equation balance ---------- */
export const BAL_MAX_X = 12, BAL_MAX_U = 30;   // tiles a pan can hold
const okCounts = (s) => Math.abs(s[0]) <= BAL_MAX_X && Math.abs(s[1]) <= BAL_MAX_U && Math.abs(s[2]) <= BAL_MAX_X && Math.abs(s[3]) <= BAL_MAX_U;

/** "3x + 7 = 22", "2x - 3 = x + 5", "-x+4=10", "5 = 2x - 1" -> [a, b, c, d] for ax + b = cx + d, or { err }. */
export function parseEq(str) {
    const s = String(str || "").replace(/[−–—]/g, "-").replace(/\s+/g, "").toLowerCase();
    if (!s) return { err: "Type an equation, like 3x + 7 = 22." };
    const sides = s.split("="); if (sides.length !== 2 || !sides[0] || !sides[1]) return { err: "Use one = sign, like 3x + 7 = 22." };
    const side = (t) => {
        if (!/^[-+]?(\d*x|\d+)([-+](\d*x|\d+))*$/.test(t)) return null;
        let x = 0, u = 0; (t.match(/[-+]?(\d*x|\d+)/g) || []).forEach((m) => { const neg = m[0] === "-", body = m.replace(/^[-+]/, "");
            if (body.endsWith("x")) x += (neg ? -1 : 1) * (body === "x" ? 1 : +body.slice(0, -1)); else u += (neg ? -1 : 1) * +body; });
        return [x, u];
    };
    const L = side(sides[0]), R = side(sides[1]);
    if (!L || !R) return { err: "Use whole numbers and x, like 2x - 3 = x + 5." };
    const e = [L[0], L[1], R[0], R[1]];
    if (e[0] === e[2]) return { err: e[1] === e[3] ? "Both sides are always equal: every x works. Try another." : "No x makes those sides equal. Try another." };
    if (!okCounts(e)) return { err: "Keep it to " + BAL_MAX_X + " x tiles and " + BAL_MAX_U + " unit tiles a side, so the tiles fit." };
    return e;
}
export const solveOf = (e) => (e[3] - e[1]) / (e[0] - e[2]);
/* Inequality mode (Alg I.11): the same pans, with <, >, ≤ or ≥ between them. x is not one hidden number any more, so the
   class tries values of x and the scale tips for each; dividing both sides by a negative flips the sign and the scale. */
export const RELS = ["=", "<", ">", "≤", "≥"];
export const FLIP = { "=": "=", "<": ">", ">": "<", "≤": "≥", "≥": "≤" };
export const REL_WORDS = { "<": "less than", ">": "greater than", "≤": "less than or equal to", "≥": "greater than or equal to" };
export const BAL_TRY = 10;   // try x from −10 to 10
/** "3x + 7 < 22", "2x - 3 >= x + 5" -> { e, r }, or { err }. An "=" gives an equation, as parseEq. */
export function parseRel(str) {
    const s = String(str || "").replace(/<=|=</g, "≤").replace(/>=|=>/g, "≥");
    const m = s.match(/[=<>≤≥]/g);
    if (!s.trim()) return { err: "Type an equation or inequality, like 3x + 7 < 22." };
    if (!m || m.length !== 1) return { err: "Use one sign, =, <, >, ≤ or ≥, like 3x + 7 < 22." };
    const r = m[0], e = parseEq(s.replace(/[<>≤≥]/, "="));
    if (e.err) return r !== "=" && /every x|No x/.test(e.err) ? { err: "The x's cancel out, so no value of x decides it. Try another." } : e;
    return { e, r };
}
export function balDefault() { const e = [3, 7, 0, 22]; return { e, s: e.slice(), h: [], r: "=", er: "=", t: 0, tr: [], sh: false }; }
export const isIneq = (B) => !!B.er && B.er !== "=";
/** The pans' weights for a tried x (inequality mode). */
export function balTryWeights(B) { const x = B.t || 0, s = B.s; return { L: s[0] * x + s[1], R: s[2] * x + s[3], x }; }
export const relHolds = (L, r, R) => ({ "=": L === R, "<": L < R, ">": L > R, "≤": L <= R, "≥": L >= R })[r];
/** Does x = B.t make the inequality on the pans true? */
export function balTrue(B) { const { L, R } = balTryWeights(B); return relHolds(L, B.r || "=", R); }
/** Every solution, as x r b: the boundary b and which way the arrow goes. */
export function ineqSol(B) { const e = B.e, k = e[0] - e[2], b = (e[3] - e[1]) / k; return { b, r: k > 0 ? B.er : FLIP[B.er] }; }
/** Try a value of x: the scale tips for it, and it is kept on the number line. */
export function balTry(B, x) { x = clamp(int(x, 0), -BAL_TRY, BAL_TRY); B.t = x; if (!B.tr.includes(x)) B.tr = B.tr.concat(x).slice(-(2 * BAL_TRY + 1)); }
/** The weights of the two pans for the hidden x. */
export function balWeights(B) { const xv = solveOf(B.e), s = B.s; return { L: s[0] * xv + s[1], R: s[2] * xv + s[3], xv }; }
export function balTilt(B) { const { L, R } = isIneq(B) ? balTryWeights(B) : balWeights(B), d = R - L; if (Math.abs(d) < 1e-9) return 0; return Math.sign(d) * Math.min(14, 4 + Math.abs(d) * 1.5); }   // degrees; + = right pan down
export const balanced = (B) => balTilt(B) === 0;
/** x alone on one side, a number on the other: the answer. */
export function balSolved(B) {
    const s = B.s;
    if (isIneq(B)) {   // x alone, whatever the scale does: x < 5 (or 5 > x, read as x < 5)
        if (s[0] === 1 && s[1] === 0 && s[2] === 0) return { side: "L", v: s[3], r: B.r };
        if (s[2] === 1 && s[3] === 0 && s[0] === 0) return { side: "R", v: s[1], r: FLIP[B.r] };
        return null;
    }
    if (!balanced(B)) return null;
    if (s[0] === 1 && s[1] === 0 && s[2] === 0) return { side: "L", v: s[3] };
    if (s[2] === 1 && s[3] === 0 && s[0] === 0) return { side: "R", v: s[1] };
    return null;
}
/** One side as words: 3x + 7, −x − 2, 0. */
export function sideText(x, u) {
    const parts = [];
    if (x) parts.push((x < 0 ? "−" : "") + (Math.abs(x) === 1 ? "" : Math.abs(x)) + "x");
    if (u) parts.push(parts.length ? (u < 0 ? "− " : "+ ") + Math.abs(u) : (u < 0 ? "−" : "") + Math.abs(u));
    return parts.length ? parts.join(" ") : "0";
}
export const eqText = (s, r) => sideText(s[0], s[1]) + " " + (r || "=") + " " + sideText(s[2], s[3]);
const push = (B, s, label, r) => { if (!okCounts(s)) return "Too many tiles for the pans."; B.h = B.h.concat([{ s: B.s.slice(), l: label, r: B.r || "=" }]).slice(-10); B.s = s; if (r) B.r = r; return ""; };
/** One tile onto (n > 0) or off (n < 0) one pan. kind "x" or "u". Returns "" or why not. */
export function balAdd(B, side, kind, n) { const s = B.s.slice(), i = (side === "R" ? 2 : 0) + (kind === "x" ? 0 : 1); s[i] += n; return push(B, s, ""); }
/** The same to both sides: op "+" or "-" with n tiles of kind, or "/" by n. */
export function balBoth(B, op, n, kind) {
    n = int(n, 0); if (n < 1) return "Pick a number first.";
    const s = B.s.slice();
    if (op === "/") {
        if (n < 2) return "Divide by 2 or more.";
        if (s.some((v) => v % n)) return "Not every pile splits into " + n + " equal groups.";
        return push(B, s.map((v) => v / n), "÷ " + n);
    }
    if (op === "/-") {   // divide by −n: every tile turns over, and an inequality's sign flips
        if (s.some((v) => v % n)) return "Not every pile splits into " + n + " equal groups.";
        return push(B, s.map((v) => (v ? -v / n : 0)), "÷ (−" + n + ")", FLIP[B.r || "="]);
    }
    const d = op === "-" ? -n : n, i = kind === "x" ? 0 : 1; s[i] += d; s[i + 2] += d;
    return push(B, s, (op === "-" ? "− " : "+ ") + (kind === "x" ? (n === 1 ? "" : n) + "x" : n));
}
export function balUndo(B) { if (!B.h.length) return false; const last = B.h[B.h.length - 1]; B.s = last.s.slice(); if (last.r) B.r = last.r; B.h = B.h.slice(0, -1); return true; }
export function balSet(B, e, r) { B.e = e.slice(); B.s = e.slice(); B.h = []; B.er = B.r = RELS.includes(r) ? r : "="; B.t = 0; B.tr = []; B.sh = false; }
function cleanBal(o) {
    const d = balDefault(); if (!o || typeof o !== "object") return d;
    const arr = (a) => (Array.isArray(a) && a.length === 4 ? a.map((v, i) => cint(v, -(i % 2 ? BAL_MAX_U : BAL_MAX_X), i % 2 ? BAL_MAX_U : BAL_MAX_X, 0)) : null);
    const e = arr(o.e); if (!e || e[0] === e[2]) return d;
    const s = arr(o.s) || e.slice();
    const rel = (v) => (RELS.includes(v) ? v : "=");
    const h = Array.isArray(o.h) ? o.h.slice(-10).map((x) => x && arr(x.s) ? { s: arr(x.s), l: typeof x.l === "string" ? x.l.slice(0, 12) : "", r: rel(x.r) } : null).filter(Boolean) : [];
    const er = rel(o.er), r = er === "=" ? "=" : rel(o.r) === "=" ? er : rel(o.r);
    const tr = Array.isArray(o.tr) ? [...new Set(o.tr.filter((v) => Number.isInteger(v) && Math.abs(v) <= BAL_TRY))].slice(-(2 * BAL_TRY + 1)) : [];
    return { e, s, h, r, er, t: cint(o.t, -BAL_TRY, BAL_TRY, 0), tr, sh: !!o.sh };
}

/* ---------- Chance lab ---------- */
export const SPIN_COLS = [["Blue", "#3F7FE0"], ["Amber", "#F2B33D"], ["Green", "#2FA36B"], ["Red", "#E0524F"], ["Purple", "#8E5BD6"], ["Teal", "#1FA7A7"]];
export function chanceDefault() { return { m: "spin", w: [1, 1, 1, 1], d2: false, t: [0, 0, 0, 0], last: -1, rot: 0, at: 0 }; }
/** The outcomes of the current mode: [label, probability, colour]. */
export function outcomes(C) {
    if (C.m === "coin") return [["Heads", 0.5, "#F2B33D"], ["Tails", 0.5, "#8CC8FF"]];
    if (C.m === "dice") {
        if (!C.d2) return [1, 2, 3, 4, 5, 6].map((v) => [String(v), 1 / 6, "#8CC8FF"]);
        return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((v) => [String(v), (6 - Math.abs(v - 7)) / 36, "#8CC8FF"]);
    }
    const tot = C.w.reduce((a, x) => a + x, 0); return C.w.map((x, i) => [SPIN_COLS[i][0], x / tot, SPIN_COLS[i][1]]);
}
/** Each outcome's chance as a fraction in lowest terms: "1/4". */
export function fracOf(C, i) {
    let num, den;
    if (C.m === "coin") { num = 1; den = 2; } else if (C.m === "dice") { if (C.d2) { num = 6 - Math.abs(i + 2 - 7); den = 36; } else { num = 1; den = 6; } }
    else { num = C.w[i]; den = C.w.reduce((a, x) => a + x, 0); }
    const g = gcd(num, den); return [num / g, den / g];
}
const pick = (probs, r) => { let acc = 0; for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (r < acc) return i; } return probs.length - 1; };
/** Run n trials; the last one is the one the panel animates. rng() in [0, 1). */
export function chanceRun(C, n, rng = Math.random, now = Date.now()) {
    const os = outcomes(C), probs = os.map((o) => o[1]); let last = -1, a = 0, b = 0;
    for (let k = 0; k < n; k++) {
        if (C.m === "dice") { a = 1 + Math.floor(rng() * 6); b = 1 + Math.floor(rng() * 6); last = C.d2 ? a + b - 2 : a - 1; }
        else last = pick(probs, rng());
        C.t[last] = Math.min(999999, (C.t[last] || 0) + 1);
    }
    C.last = last; C.at = now; C.dv = C.m === "dice" ? (C.d2 ? [a, b] : [a]) : undefined;
    if (C.m === "spin") {   // land somewhere inside the winning slice, a few whole turns on from where it was
        const tot = C.w.reduce((s, x) => s + x, 0), start = C.w.slice(0, last).reduce((s, x) => s + x, 0) / tot * 360, size = C.w[last] / tot * 360;
        const into = start + size * (0.15 + rng() * 0.7), base = Math.ceil((C.rot || 0) / 360) * 360;
        C.rot = Math.round((base + 360 * (n > 1 ? 2 : 4) + (360 - into)) * 10) / 10;   // the pointer is at the top; the wheel turns under it
    }
    return last;
}
export const trials = (C) => C.t.reduce((a, x) => a + x, 0);
export function chanceMode(C, m, d2) { C.m = m; C.d2 = !!d2; chanceReset(C); }
export function chanceReset(C) { C.t = outcomes(C).map(() => 0); C.last = -1; C.at = 0; delete C.dv; }
export function chanceWeight(C, i, d) { if (C.m !== "spin") return; C.w[i] = clamp(C.w[i] + d, 1, 4); chanceReset(C); }
export function chanceSlices(C, n) { if (C.m !== "spin") return; n = clamp(n, 2, 6); C.w = C.w.slice(0, n); while (C.w.length < n) C.w.push(1); chanceReset(C); }
function cleanChance(o) {
    const d = chanceDefault(); if (!o || typeof o !== "object") return d;
    const C = { m: ["spin", "coin", "dice"].includes(o.m) ? o.m : "spin", d2: !!o.d2, w: Array.isArray(o.w) && o.w.length >= 2 ? o.w.slice(0, 6).map((v) => cint(v, 1, 4, 1)) : d.w.slice(), t: [], last: -1, rot: 0, at: 0 };
    const n = outcomes(C).length;
    C.t = Array.from({ length: n }, (_, i) => cint(Array.isArray(o.t) ? o.t[i] : 0, 0, 999999, 0));
    C.last = cint(o.last, -1, n - 1, -1); C.rot = clamp(+o.rot || 0, 0, 1e7); C.at = clamp(+o.at || 0, 0, 1e14);
    if (Array.isArray(o.dv) && C.m === "dice") C.dv = o.dv.slice(0, C.d2 ? 2 : 1).map((v) => cint(v, 1, 6, 1));
    return C;
}

/* ---------- Line explorer ---------- */
export const LINE_R = 9;   // the grid runs −9..9
export function lineDefault() { return { a: [0, 1], b: [3, 3], tri: true, eq: true }; }
/** Slope and intercept as fractions in lowest terms. m: [num, den] or null for a vertical line. */
export function lineOf(L) {
    const [x1, y1] = L.a, [x2, y2] = L.b, rise = y2 - y1, run = x2 - x1;
    if (!run) return { vert: true, x: x1, rise, run };
    const g = gcd(rise, run), s = run < 0 ? -1 : 1, m = [s * rise / g, s * run / g];
    const bn = y1 * m[1] - m[0] * x1, bd = m[1], gb = gcd(bn, bd);   // b = y1 − m·x1
    return { m, b: [bn / gb, bd / gb], rise, run, prop: bn === 0 };
}
/** A fraction as text: "2/3", "−4", "1/2". */
export const fracText = (f) => (f[1] === 1 ? (f[0] < 0 ? "−" : "") + Math.abs(f[0]) : (f[0] < 0 ? "−" : "") + Math.abs(f[0]) + "/" + f[1]);
/** y = mx + b as parts for display: [{t:"txt"|"frac", …}]. */
export function lineEq(L) {
    const o = lineOf(L);
    if (o.vert) return "x = " + fracText([o.x, 1]);
    const m = o.m, b = o.b; let s = "y = ";
    if (m[0] === 0) return s + fracText(b);
    s += m[1] === 1 && Math.abs(m[0]) === 1 ? (m[0] < 0 ? "−" : "") + "x" : fracText(m) + "x";
    if (b[0]) s += (b[0] < 0 ? " − " : " + ") + fracText([Math.abs(b[0]), b[1]]);
    return s;
}
export function linePoint(L, which, x, y) {
    const p = [cint(x, -LINE_R, LINE_R, 0), cint(y, -LINE_R, LINE_R, 0)], other = which === "a" ? L.b : L.a;
    if (p[0] === other[0] && p[1] === other[1]) return false;
    L[which] = p; return true;
}
function cleanLine(o) {
    const d = lineDefault(); if (!o || typeof o !== "object") return d;
    const pt = (p, q) => (Array.isArray(p) ? [cint(p[0], -LINE_R, LINE_R, q[0]), cint(p[1], -LINE_R, LINE_R, q[1])] : q);
    const L = { a: pt(o.a, d.a), b: pt(o.b, d.b), tri: o.tri !== false, eq: o.eq !== false };
    if (L.a[0] === L.b[0] && L.a[1] === L.b[1]) { L.a = d.a; L.b = d.b; }
    return L;
}

/* ---------- Transformations ---------- */
export const XF_R = 10;
export const SHAPES = [["Triangle", [[1, 1], [4, 1], [1, 3]]], ["Flag", [[1, 1], [1, 5], [3, 4], [1, 3]]], ["Trapezoid", [[2, 1], [5, 1], [4, 3], [3, 3]]]];
/* Each move is an affine map: (x, y) -> (a x + b y + e, c x + d y + f). Kept as short codes so the state stays small. */
const MOVES = {
    rx: { n: "Reflect over the x-axis", m: [1, 0, 0, -1, 0, 0] }, ry: { n: "Reflect over the y-axis", m: [-1, 0, 0, 1, 0, 0] }, rxy: { n: "Reflect over y = x", m: [0, 1, 1, 0, 0, 0] },
    r90: { n: "Rotate 90° counterclockwise", m: [0, -1, 1, 0, 0, 0] }, r180: { n: "Rotate 180°", m: [-1, 0, 0, -1, 0, 0] }, r270: { n: "Rotate 90° clockwise", m: [0, 1, -1, 0, 0, 0] },
    d2: { n: "Dilate by 2", m: [2, 0, 0, 2, 0, 0] }, dh: { n: "Dilate by 1/2", m: [0.5, 0, 0, 0.5, 0, 0] },
};
export const MOVE_NAMES = Object.fromEntries(Object.entries(MOVES).map(([k, v]) => [k, v.n]));
const tMatch = /^t(-?\d+),(-?\d+)$/;
export function moveOf(code) { const t = tMatch.exec(code); if (t) return { n: "Translate (" + sgn(+t[1]) + ", " + sgn(+t[2]) + ")", m: [1, 0, 0, 1, +t[1], +t[2]], t: [+t[1], +t[2]] }; return MOVES[code] || null; }
const sgn = (v) => (v < 0 ? "−" + Math.abs(v) : String(v));
export function xfDefault() { return { sh: 0, ops: [] }; }
const compose = (p, q) => [q[0] * p[0] + q[1] * p[2], q[0] * p[1] + q[1] * p[3], q[2] * p[0] + q[3] * p[2], q[2] * p[1] + q[3] * p[3], q[0] * p[4] + q[1] * p[5] + q[4], q[2] * p[4] + q[3] * p[5] + q[5]];   // q after p
export function xfMap(X) { return X.ops.reduce((acc, c) => { const mv = moveOf(c); return mv ? compose(acc, mv.m) : acc; }, [1, 0, 0, 1, 0, 0]); }
const r6 = (v) => Math.round(v * 1e6) / 1e6;
export function xfImage(X) { const m = xfMap(X); return SHAPES[X.sh][1].map(([x, y]) => [r6(m[0] * x + m[1] * y + m[4]), r6(m[2] * x + m[3] * y + m[5])]); }
/** The whole move as one rule: (x, y) → (−y + 3, x). */
export function xfRule(X) {
    const m = xfMap(X), num = (v) => (Number.isInteger(v) ? String(Math.abs(v)) : Math.abs(v) === 0.5 ? "½" : String(Math.abs(r6(v))));
    const term = (a, b, e) => {
        const parts = []; [[a, "x"], [b, "y"]].forEach(([k, v]) => { if (!k) return; parts.push({ neg: k < 0, s: (Math.abs(k) === 1 ? "" : num(k)) + v }); });
        if (e) parts.push({ neg: e < 0, s: num(e) });
        if (!parts.length) return "0";
        return parts.map((p, i) => (i ? (p.neg ? " − " : " + ") : p.neg ? "−" : "") + p.s).join("");
    };
    return "(x, y) → (" + term(m[0], m[1], m[4]) + ", " + term(m[2], m[3], m[5]) + ")";
}
/** Add a move; back-to-back slides join into one. */
export function xfDo(X, code) {
    const mv = moveOf(code); if (!mv) return false;
    const lastT = X.ops.length && tMatch.exec(X.ops[X.ops.length - 1]);
    if (mv.t && lastT) { const dx = +lastT[1] + mv.t[0], dy = +lastT[2] + mv.t[1]; X.ops = X.ops.slice(0, -1); if (dx || dy) X.ops.push("t" + dx + "," + dy); return true; }
    if (mv.t && !mv.t[0] && !mv.t[1]) return false;
    X.ops = X.ops.concat([code]).slice(-8); return true;
}
export const xfOff = (X) => xfImage(X).some(([x, y]) => Math.abs(x) > XF_R || Math.abs(y) > XF_R);
export const ptText = (p) => "(" + p.map((v) => (v < 0 ? "−" : "") + (Number.isInteger(v) ? Math.abs(v) : Math.abs(v) % 1 === 0.5 ? Math.abs(v) : Math.abs(r6(v)))).join(", ") + ")";
function cleanXf(o) {
    const d = xfDefault(); if (!o || typeof o !== "object") return d;
    const ops = Array.isArray(o.ops) ? o.ops.slice(-8).filter((c) => typeof c === "string" && (MOVES[c] || (tMatch.test(c) && c.length < 12 && moveOf(c).t.every((v) => Math.abs(v) <= 40)))) : [];
    return { sh: cint(o.sh, 0, SHAPES.length - 1, 0), ops };
}

/* ---------- Pythagorean squares ---------- */
export const PY_MAX = 8;
export function pyDefault() { return { a: 3, b: 4, c: true }; }
export function pyOf(P) {
    const s = P.a * P.a + P.b * P.b, r = Math.round(Math.sqrt(s)), whole = r * r === s;
    // simplest radical form: √50 = 5√2
    let out = 1, inn = s; for (let k = Math.floor(Math.sqrt(s)); k > 1; k--) if (s % (k * k) === 0) { out = k; inn = s / (k * k); break; }
    return { a2: P.a * P.a, b2: P.b * P.b, c2: s, c: Math.sqrt(s), whole, cText: whole ? String(r) : "√" + s, simple: !whole && out > 1 ? out + "√" + inn : "" };
}
function cleanPy(o) { const d = pyDefault(); if (!o || typeof o !== "object") return d; return { a: cint(o.a, 1, PY_MAX, 3), b: cint(o.b, 1, PY_MAX, 4), c: o.c !== false }; }

/* ---------- Integer counters ---------- */
export const CT_MAX = 20;
export function ctDefault() { return { p: 3, n: 5, pr: false }; }
export const ctValue = (K) => K.p - K.n;
/** Take one away. Returns "" or why not (no counter of that kind: add a zero pair first). */
export function ctTake(K, kind) {
    if (kind === "p") { if (!K.p) return "No positive counters to take. Add a zero pair first."; K.p--; return ""; }
    if (!K.n) return "No negative counters to take. Add a zero pair first."; K.n--; return "";
}
export function ctAdd(K, kind, n = 1) { const k = kind === "p" ? "p" : "n"; if (K[k] + n > CT_MAX) return "The mat holds " + CT_MAX + " of each."; K[k] += n; return ""; }
export function ctPair(K) { if (K.p >= CT_MAX || K.n >= CT_MAX) return "The mat holds " + CT_MAX + " of each."; K.p++; K.n++; return ""; }
export function ctClear(K) { const z = Math.min(K.p, K.n); K.p -= z; K.n -= z; return z; }
function cleanCt(o) { const d = ctDefault(); if (!o || typeof o !== "object") return d; return { p: cint(o.p, 0, CT_MAX, 0), n: cint(o.n, 0, CT_MAX, 0), pr: !!o.pr }; }

/* ---------- Angle explorer ---------- */
/* Two parallel lines cut by a transversal, angles numbered 1–8 (1 top left, 2 top right, 3 bottom left, 4 bottom right
   at the top crossing; 5–8 the same at the bottom one), and a triangle whose corners tear off onto a straight line. */
export const ANG_MIN = 30, ANG_MAX = 150, ANG_TILT = 12;   // the transversal's slant, and how far "not parallel" tips the lower line
export const ANG_W = 360, ANG_H = 280, TRI_BOT = 205;      // the triangle stays above the strip where its corners land
export const ANG_PAIRS = {
    corr: { name: "Corresponding", plural: "Corresponding angles", same: true, pairs: [[1, 5], [2, 6], [3, 7], [4, 8]], where: "sit in the same spot at each crossing" },
    altin: { name: "Alternate interior", plural: "Alternate interior angles", same: true, pairs: [[3, 6], [4, 5]], where: "sit between the lines, on opposite sides of the transversal" },
    altex: { name: "Alternate exterior", plural: "Alternate exterior angles", same: true, pairs: [[1, 8], [2, 7]], where: "sit outside the lines, on opposite sides of the transversal" },
    same: { name: "Same-side interior", plural: "Same-side interior angles", same: false, pairs: [[3, 5], [4, 6]], where: "sit between the lines, on the same side of the transversal" },
    vert: { name: "Vertical", plural: "Vertical angles", same: true, pairs: [[1, 4], [2, 3], [5, 8], [6, 7]], where: "sit across from each other at one crossing" },
    lin: { name: "Linear pair", plural: "Linear pairs", same: false, pairs: [[1, 2], [3, 4], [5, 6], [7, 8], [1, 3], [2, 4], [5, 7], [6, 8]], where: "sit side by side on one line" },
};
export const ANG_KINDS = Object.keys(ANG_PAIRS);
export function angDefault() { return { m: "par", a: 60, np: false, pk: "", sel: [], hide: false, rv: [], t: [[70, 195], [300, 195], [205, 55]], torn: false }; }
/** The eight angles, index 1–8 (0 is unused). Whole degrees. */
export function angVals(A) {
    const a = A.a, b = A.a - (A.np ? ANG_TILT : 0);
    return [0, 180 - a, a, a, 180 - a, 180 - b, b, b, 180 - b];
}
/** What two angles are to each other: the pair's name, and whether they match or add to 180°. */
export function angPair(A, i, j) {
    const v = angVals(A);
    if (i === j) return null;
    for (const k of ANG_KINDS) {
        const P = ANG_PAIRS[k];
        if (P.pairs.some(([x, y]) => (x === i && y === j) || (x === j && y === i))) {
            const ok = P.same ? v[i] === v[j] : v[i] + v[j] === 180;
            return { kind: k, name: P.name, same: P.same, ok, a: v[i], b: v[j] };
        }
    }
    return { kind: "", name: "", same: v[i] === v[j], ok: v[i] === v[j] || v[i] + v[j] === 180, a: v[i], b: v[j] };
}
/** A triangle's three angles: exact, and in whole degrees that still add to 180. */
export function triAngles(t) {
    const ang = (p, q, r) => { const u = [q[0] - p[0], q[1] - p[1]], w = [r[0] - p[0], r[1] - p[1]]; const c = (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w)); return Math.acos(clamp(c, -1, 1)) * 180 / Math.PI; };
    const ex = [ang(t[0], t[1], t[2]), ang(t[1], t[2], t[0]), ang(t[2], t[0], t[1])];
    const fl = ex.map(Math.floor); let left = 180 - fl.reduce((x, y) => x + y, 0);
    ex.map((x, i) => [x - fl[i], i]).sort((p, q) => q[0] - p[0]).forEach(([, i]) => { if (left > 0) { fl[i]++; left--; } });
    return { ex, deg: fl };
}
export const triArea = (t) => Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1])) / 2;
/** A corner may move here: on the page, above the strip, and the triangle keeps some width (no corner under 8°). */
export function triOk(t) { return t.every(([x, y]) => x >= 15 && x <= ANG_W - 15 && y >= 15 && y <= TRI_BOT) && triArea(t) >= 600 && triAngles(t).ex.every((x) => x >= 8); }
function cleanAng(o) {
    const d = angDefault(); if (!o || typeof o !== "object") return d;
    const idx = (v) => { const n = int(v, 0); return n >= 1 && n <= 8 ? n : 0; };
    const list = (v, n) => (Array.isArray(v) ? v : []).map(idx).filter((x, i, a) => x && a.indexOf(x) === i).slice(0, n);
    let t = Array.isArray(o.t) && o.t.length === 3 && o.t.every((q) => Array.isArray(q) && q.length === 2) ? o.t.map((q) => [cint(q[0], 0, ANG_W, 0), cint(q[1], 0, ANG_H, 0)]) : d.t;
    if (!triOk(t)) t = d.t;
    return { m: o.m === "tri" ? "tri" : "par", a: cint(o.a, ANG_MIN, ANG_MAX, 60), np: !!o.np, pk: ANG_KINDS.includes(o.pk) ? o.pk : "", sel: list(o.sel, 2), hide: !!o.hide, rv: list(o.rv, 8), t, torn: !!o.torn };
}

/* ---------- Function machine ---------- */
/* A machine with a rule y = ax + b (or y = ax² + b). Each input dropped in comes out as its output, and the pairs build
   a table, a mapping and a graph. A mystery rule hides the rule for the class to find. "Function or not?" shows a set
   of pairs and asks whether each input has exactly one output. */
export const FN_A = 6, FN_B = 12, FN_IN = 10, FN_MAX = 8;   // rule limits, input limit, inputs kept
export const FN_VIEWS = ["table", "map", "graph"];
export const fnDefault = () => ({ m: "mach", a: 2, b: 1, q: false, hide: false, ins: [], v: "table", ps: [], g: "", sh: false });
/** The rule's output for x. */
export const fnOut = (F, x) => F.a * (F.q ? x * x : x) + F.b;
const fsg = (n, first) => (n < 0 ? (first ? "−" : " − ") : first ? "" : " + ");
/** "2x + 1", "−x² − 4", "3": the right side of the rule. */
export function fnRule(F) {
    const v = F.q ? "x²" : "x";
    const ax = F.a === 0 ? "" : fsg(F.a, true) + (Math.abs(F.a) === 1 ? "" : Math.abs(F.a)) + v;
    if (!ax) return (F.b < 0 ? "−" : "") + Math.abs(F.b);
    return ax + (F.b ? fsg(F.b, false) + Math.abs(F.b) : "");
}
/** The pairs the machine has made, in the order the inputs went in. */
export const fnPairs = (F) => F.ins.map((x) => [x, fnOut(F, x)]);
/** A new mystery rule, never the same as the one before. rnd: a function giving [0, 1). */
export function fnMystery(F, rnd = Math.random) {
    const pick = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    let a, b, q, n = 0;
    do { q = rnd() < 0.2; a = q ? pick(1, 2) : pick(-3, 4) || 3; b = pick(-6, 6); n++; } while (n < 20 && a === F.a && b === F.b && q === F.q);
    Object.assign(F, { a, b, q, hide: true, ins: [] });
}
/** Is a set of pairs a function? If not, the first input that goes to two outputs, and those outputs. */
export function fnTest(ps) {
    const seen = new Map();
    for (const [x, y] of ps) { if (!seen.has(x)) seen.set(x, new Set()); seen.get(x).add(y); }
    for (const [x, ys] of seen) if (ys.size > 1) return { ok: false, x, ys: [...ys].sort((p, q) => p - q) };
    const outs = ps.map((q) => q[1]);
    return { ok: true, shared: outs.some((y, i) => outs.indexOf(y) !== i) };
}
/** A new set of pairs for "Function or not?": about half are functions, and some functions share an output. */
export function fnNewSet(F, rnd = Math.random) {
    const pick = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const n = pick(4, 5), xs = [];
    while (xs.length < n) { const x = pick(-4, 6); if (!xs.includes(x)) xs.push(x); }
    const ps = xs.map((x) => [x, pick(-5, 9)]);
    if (rnd() < 0.5) {   // not a function: one input gets a second output
        const [x, y] = ps[pick(0, n - 1)]; let y2 = y; while (y2 === y) y2 = pick(-5, 9);
        ps.push([x, y2]);
    } else if (rnd() < 0.5) ps[1][1] = ps[0][1];   // a function where two inputs share an output
    for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ps[i], ps[j]] = [ps[j], ps[i]]; }
    Object.assign(F, { ps, g: "", sh: false });
}
function cleanFn(o) {
    const d = fnDefault(); if (!o || typeof o !== "object") return d;
    const ins = (Array.isArray(o.ins) ? o.ins : []).map((v) => int(v, NaN)).filter((v) => Number.isFinite(v) && Math.abs(v) <= FN_IN).slice(-FN_MAX);
    const ps = (Array.isArray(o.ps) ? o.ps : []).filter((q) => Array.isArray(q) && q.length === 2).map((q) => [cint(q[0], -20, 20, 0), cint(q[1], -40, 40, 0)]).slice(0, 8);
    return { m: o.m === "test" ? "test" : "mach", a: cint(o.a, -FN_A, FN_A, 2), b: cint(o.b, -FN_B, FN_B, 1), q: !!o.q, hide: !!o.hide, ins, v: FN_VIEWS.includes(o.v) ? o.v : "table", ps, g: o.g === "f" || o.g === "n" ? o.g : "", sh: !!o.sh };
}

/* ---------- Expression area model ---------- */
/* Expand: a rows of (bx + c) as algebra tiles, or an area box; the area is abx + ac. Factor: px + q tiles sorted into
   r equal rows. When r divides both, the tiles make a rectangle r(…); the biggest such r is the greatest common factor. */
export const EX_A = 6, EX_B = 5, EX_C = 9, EX_P = 12, EX_Q = 18, EX_R = 6;
export const exDefault = () => ({ m: "exp", a: 3, b: 2, c: 3, look: "tiles", hide: false, rv: [false, false], p: 6, q: 9, r: 1 });
/** "2x + 3", "−x − 4", "5", "x": a linear expression bx + c. */
export function exLin(b, c) {
    const xs = b === 0 ? "" : (b < 0 ? "−" : "") + (Math.abs(b) === 1 ? "" : Math.abs(b)) + "x";
    if (!xs) return (c < 0 ? "−" : "") + Math.abs(c);
    return xs + (c ? (c < 0 ? " − " : " + ") + Math.abs(c) : "");
}
const exNum = (n) => (n < 0 ? "−" + Math.abs(n) : String(n));
/** a(bx + c) as written, and as expanded. */
export const exFactored = (a, b, c) => (a === 1 ? "" : a === -1 ? "−" : exNum(a)) + "(" + exLin(b, c) + ")";
export const exExpanded = (a, b, c) => exLin(a * b, a * c);
/** The two parts of the area: a·bx and a·c. */
export const exParts = (E) => [E.a * E.b, E.a * E.c];
/** Sorting px + q into r rows: how many of each per row, what is left over, and whether it is the greatest common factor. */
export function exRows(E) {
    const P = Math.abs(E.p), Q = Math.abs(E.q), r = E.r, g = gcd(P, Q);
    const even = P % r === 0 && Q % r === 0;
    return { even, gcf: g, best: even && r === g, px: Math.floor(P / r), qx: Math.floor(Q / r), lx: P % r, lq: Q % r,
        inside: even ? exLin(E.p / r, E.q / r) : null };
}
/** A new expression to factor, with a common factor from 2 to 4. */
export function exNewFactor(E, rnd = Math.random) {
    const pick = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    let p, q, n = 0;
    do { const g = pick(2, 4); p = g * pick(1, 3); q = g * pick(1, Math.floor(EX_Q / g)) * (rnd() < 0.25 ? -1 : 1); n++; } while (n < 20 && (gcd(p, q) < 2 || (p === E.p && q === E.q) || Math.abs(q) > EX_Q || p > EX_P));
    Object.assign(E, { p, q, r: 1 });
}
function cleanEx(o) {
    const d = exDefault(); if (!o || typeof o !== "object") return d;
    const nz = (v, lim, dd) => { const n = cint(v, -lim, lim, dd); return n || dd; };
    const rv = Array.isArray(o.rv) ? [!!o.rv[0], !!o.rv[1]] : [false, false];
    return { m: o.m === "fac" ? "fac" : "exp", a: nz(o.a, EX_A, 3), b: nz(o.b, EX_B, 2), c: cint(o.c, -EX_C, EX_C, 3), look: o.look === "box" ? "box" : "tiles", hide: !!o.hide, rv,
        p: nz(o.p, EX_P, 6), q: nz(o.q, EX_Q, 9), r: cint(o.r, 1, EX_R, 1) };
}

/* ---------- Rational number line ---------- */
/* Every value is a whole number of steps of 1/d (p = −6 with d = 4 is −1½), so the sums are always exact. */
export const NL_MAX = 10, NL_DENS = [2, 3, 4, 5, 8, 10];   // values stay within −10..10
export const nlDefault = () => ({ m: "add", d: 4, f: "frac", op: "+", p: -6, q: 11, a: -10, b: 5, hide: false, rv: false });
/** Where the jump lands, in steps. */
export const nlEnd = (N) => (N.op === "−" ? N.p - N.q : N.p + N.q);
/** The move the jump makes: subtracting q is adding −q. */
export const nlMove = (N) => (N.op === "−" ? -N.q : N.q);
/** n/d as sign, whole, and a reduced fraction part. */
export function nlParts(n, d) {
    const neg = n < 0, A = Math.abs(n), w = Math.floor(A / d), r = A % d;
    return { neg: neg && A > 0, w, num: r / (r ? gcd(r, d) : 1), den: r ? d / gcd(r, d) : 1, zero: A === 0 };
}
/** n/d as a decimal: { s } when it ends, or { s, rep } when one digit repeats (thirds). */
export function nlDec(n, d) {
    const P = nlParts(n, d), sg = P.neg ? "−" : "";
    if (P.den === 3) return { s: sg + P.w + ".", rep: P.num === 1 ? "3" : "6" };
    const v = Math.abs(n) / d;
    return { s: sg + String(Math.round(v * 1000) / 1000) };
}
/** Plain text for n/d: "−1 1/2", or "−1.5", or "0.3̅" for a repeating decimal. */
export function nlText(n, d, f) {
    if (f === "dec") { const D = nlDec(n, d); return D.rep ? D.s + D.rep + "̅" : D.s; }
    const P = nlParts(n, d);
    if (P.zero) return "0";
    return (P.neg ? "−" : "") + (P.w ? String(P.w) : "") + (P.num ? (P.w ? " " : "") + P.num + "/" + P.den : "");
}
const nlPar = (n, d, f) => (n < 0 ? "(" + nlText(n, d, f) + ")" : nlText(n, d, f));
/** The whole sentence, as plain text: "−1 1/2 + 2 3/4 = 1 1/4" or "|1 1/4 − (−2 1/2)| = 3 3/4". */
export function nlSum(N, hideAns) {
    if (N.m === "dist") return "|" + nlText(N.b, N.d, N.f) + " − " + nlPar(N.a, N.d, N.f) + "| = " + (hideAns ? "?" : nlText(Math.abs(N.b - N.a), N.d, N.f));
    return nlText(N.p, N.d, N.f) + " " + N.op + " " + nlPar(N.q, N.d, N.f) + " = " + (hideAns ? "?" : nlText(nlEnd(N), N.d, N.f));
}
export const nlIn = (n, d) => Math.abs(n) <= NL_MAX * d;
/** Move one value by k steps, if everything stays on the line. */
export function nlStep(N, key, k) {
    const T = Object.assign({}, N, { [key]: N[key] + k });
    if (!nlIn(T[key], N.d) || (N.m === "add" && !nlIn(nlEnd(T), N.d))) return false;
    N[key] = T[key]; N.rv = false; return true;
}
/** Set a value straight (a drag); false if it would leave the line. */
export function nlSet(N, key, v) {
    const T = Object.assign({}, N, { [key]: Math.round(v) });
    if (!nlIn(T[key], N.d) || (N.m === "add" && !nlIn(nlEnd(T), N.d))) return false;
    N[key] = T[key]; return true;
}
/** Change the step size, keeping each value as close as it can. */
export function nlDen(N, d) {
    if (!NL_DENS.includes(d) || d === N.d) return;
    const cv = (n) => Math.max(-NL_MAX * d, Math.min(NL_MAX * d, Math.round(n * d / N.d)));
    N.p = cv(N.p); N.q = cv(N.q); N.a = cv(N.a); N.b = cv(N.b); N.d = d; N.rv = false;
    if (!nlIn(nlEnd(N), d)) N.q = 0;
}
/** A new problem in the current step size: a start and a jump that cross 0 more often than not. */
export function nlNew(N, rnd = Math.random) {
    const d = N.d, pick = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1)), R = 4 * d;
    let n = 0;
    do {
        if (N.m === "dist") { N.a = pick(-R, R); N.b = pick(-R, R); }
        else { N.p = pick(-R, R); N.q = pick(-R, R); N.op = rnd() < 0.35 ? "−" : "+"; }
        n++;
    } while (n < 40 && (N.m === "dist" ? Math.abs(N.a - N.b) < d / 2 || N.a % d === 0 && N.b % d === 0 : N.q === 0 || N.p === 0 || (N.p % d === 0 && N.q % d === 0) || !nlIn(nlEnd(N), d)));
    N.rv = false;
}
function cleanNl(o) {
    const D = nlDefault(); if (!o || typeof o !== "object") return D;
    const d = NL_DENS.includes(+o.d) ? +o.d : D.d, L = NL_MAX * d;
    const N = { m: o.m === "dist" ? "dist" : "add", d, f: o.f === "dec" ? "dec" : "frac", op: o.op === "−" ? "−" : "+",
        p: cint(o.p, -L, L, D.p), q: cint(o.q, -L, L, D.q), a: cint(o.a, -L, L, D.a), b: cint(o.b, -L, L, D.b), hide: !!o.hide, rv: !!o.rv };
    if (!nlIn(nlEnd(N), d)) N.q = 0;
    return N;
}

/* ---------- all six ---------- */
/* ---------- the calculators: the line being typed, the last answers, and the scientific one's modes ---------- */
const calcDefault = () => ({ x: "", h: [], a: 0, done: false });
const sciDefault = () => ({ x: "", h: [], a: 0, done: false, d: true, f: false });
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
function cleanCalc(o) {
    const out = { x: typeof o.x === "string" ? o.x.slice(0, 120) : "", h: [], a: num(o.a) ?? 0, done: !!o.done };
    (Array.isArray(o.h) ? o.h : []).forEach((e) => { if (out.h.length < 4 && e && typeof e.x === "string" && num(e.v) != null) out.h.push({ x: e.x.slice(0, 120), v: e.v }); });
    if (num(o.r) != null) out.r = o.r;
    if ("d" in o) out.d = !!o.d;
    if ("f" in o) out.f = !!o.f;
    return out;
}

/* ---------- Systems graph ---------- */
/* Two lines, each through two whole-number points on a −10..10 grid. Where they cross is the solution; parallel lines
   have none; one line drawn twice has infinitely many. A tapped test point is checked in both equations. */
export const SYS_R = 10;
export const sysDefault = () => ({ l: [[[0, 1], [3, 7]], [[0, 7], [3, 4]]], f: "si", hide: false, rv: false, tp: null });
const fr = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
/** The line through P and Q as a x + b y = c, whole numbers in lowest terms, a > 0 (or a = 0 and b > 0). */
export function sysABC(P, Q) {
    let a = Q[1] - P[1], b = P[0] - Q[0], c = a * P[0] + b * P[1];
    const g = gcd(gcd(a, b), c), sg = a < 0 || (a === 0 && b < 0) ? -1 : 1;
    return { a: sg * a / g, b: sg * b / g, c: sg * c / g };
}
/** Where the two lines meet: { kind: "one", x: [n, d], y: [n, d] } | { kind: "none" } | { kind: "many" }. */
export function sysSolve(S) {
    const A = sysABC(...S.l[0]), B = sysABC(...S.l[1]), D = A.a * B.b - B.a * A.b;
    if (D) return { kind: "one", x: fr(A.c * B.b - B.c * A.b, D), y: fr(A.a * B.c - B.a * A.c, D) };
    return A.a === B.a && A.b === B.b && A.c === B.c ? { kind: "many" } : { kind: "none" };
}
const coefX = (n, v) => (n === 1 ? v : n === -1 ? "−" + v : fracText([n, 1]) + v);
/** One equation as text, in slope-intercept ("si") or standard form ("std"). */
export function sysEq(P, Q, f) {
    if (f !== "std") return lineEq({ a: P, b: Q });
    const { a, b, c } = sysABC(P, Q); let s = "";
    if (a) s = coefX(a, "x");
    if (b) s += s ? (b < 0 ? " − " : " + ") + coefX(Math.abs(b), "y") : coefX(b, "y");
    return s + " = " + fracText([c, 1]);
}
/** Is the point on line i? With the working, in the panel's form: "2(1) + 1 = 3" and whether it matches. */
export function sysCheck(S, i, pt) {
    const [P, Q] = S.l[i], { a, b, c } = sysABC(P, Q), [x, y] = pt, on = a * x + b * y === c, par = (v) => "(" + fracText([v, 1]) + ")";
    if (S.f === "std") {
        const parts = []; if (a) parts.push((a === 1 ? "" : a === -1 ? "−" : fracText([a, 1])) + "(" + x + ")"); if (b) parts.push((parts.length ? (b < 0 ? " − " : " + ") : b < 0 ? "−" : "") + (Math.abs(b) === 1 ? "" : Math.abs(b)) + "(" + y + ")");
        const v = a * x + b * y;
        return { on, text: parts.join("").replace(/\((-\d+)\)/g, (m, n) => "(−" + n.slice(1) + ")") + " = " + fracText([v, 1]) + (on ? "" : ", not " + fracText([c, 1])) };
    }
    const o = lineOf({ a: P, b: Q });
    if (o.vert) return { on, text: "x is " + fracText([x, 1]) + (on ? "" : ", not " + fracText([o.x, 1])) };
    const [mn, md] = o.m, [bn, bd] = o.b, yv = fr(mn * x * bd + bn * md, md * bd);
    let s = mn === 0 ? "" : (md === 1 && Math.abs(mn) === 1 ? (mn < 0 ? "−" : "") : fracText(o.m)) + par(x);
    if (bn || !s) s += s ? (bn < 0 ? " − " : " + ") + fracText([Math.abs(bn), bd]) : fracText(o.b);
    return { on, text: s + " = " + fracText(yv) + (on ? "" : ", not " + fracText([y, 1])) };
}
const inR = (v) => Math.abs(v) <= SYS_R;
/** Two whole-number points on a x + b y = c, inside the grid, near the middle, not at `avoid`. Null if there are none. */
export function sysPts(a, b, c, avoid) {
    const pts = [];
    for (let x = -SYS_R; x <= SYS_R; x++) for (let y = -SYS_R; y <= SYS_R; y++) if (a * x + b * y === c && !(avoid && avoid[0] === x && avoid[1] === y)) pts.push([x, y]);
    if (pts.length < 2) return null;
    pts.sort((p, q) => Math.abs(p[0]) + Math.abs(p[1]) - Math.abs(q[0]) - Math.abs(q[1]) || p[0] - q[0]);
    const P = pts[0], g = gcd(a, b), d = [b / g, -a / g];
    let Q = [P[0] + d[0], P[1] + d[1]];
    if (!inR(Q[0]) || !inR(Q[1]) || (avoid && Q[0] === avoid[0] && Q[1] === avoid[1])) Q = pts.find((q) => q !== P && !(avoid && q[0] === avoid[0] && q[1] === avoid[1])) || pts[1];
    if (Math.abs(Q[0] - P[0]) + Math.abs(Q[1] - P[1]) < 2) { const far = [P[0] + 2 * d[0], P[1] + 2 * d[1]]; if (inR(far[0]) && inR(far[1]) && !(avoid && far[0] === avoid[0] && far[1] === avoid[1])) Q = far; }
    return [P, Q];
}
/** One equation typed in: y = 2x + 1, 2x + 3y = 12, x = 4, y = −1/2x + 3, 3x − y + 2 = 0. -> { a, b, c } or { err }. */
export function parseLine(str) {
    const t = String(str || "").toLowerCase().replace(/[−–—]/g, "-").replace(/\s+/g, "").replace(/\*/g, "");
    const sides = t.split("=");
    if (sides.length !== 2 || !sides[0] || !sides[1]) return { err: "Write it with one =, like y = 2x + 1 or 2x + 3y = 12." };
    const tot = { x: [0, 1], y: [0, 1], k: [0, 1] }, add = (key, f) => { const [n, d] = tot[key]; tot[key] = fr(n * f[1] + f[0] * d, d * f[1]); };
    for (const [si, side] of sides.entries()) {
        const terms = side.replace(/(?!^)-/g, "+-").split("+").filter((z) => z !== "");
        if (!terms.length) return { err: "Something is missing around the =." };
        for (const term of terms) {
            const dv = term.match(/^(-?)(\d*)([xy])\/(\d+)$/);   // x/2, -3y/4
            if (dv) { if (!+dv[4]) return { err: "A fraction can't have 0 on the bottom." }; let f = fr(dv[2] ? +dv[2] : 1, +dv[4]); if (dv[1]) f = [-f[0], f[1]]; if (si === 1) f = [-f[0], f[1]]; add(dv[3], f); continue; }
            const m = term.match(/^(-?)(\d+(?:\/\d+)?|\d*\.\d+)?(\(?(?:\d+\/\d+)\)?)?([xy])?$/);
            if (!m || (!m[2] && !m[3] && !m[4])) return { err: "I can't read “" + term + "”. Use x, y, whole numbers and fractions." };
            let f = [1, 1];
            const num = m[2] || (m[3] ? m[3].replace(/[()]/g, "") : "");
            if (num) { if (num.includes("/")) { const [n, d] = num.split("/").map(Number); if (!d) return { err: "A fraction can't have 0 on the bottom." }; f = fr(n, d); } else if (num.includes(".")) { const d = 10 ** (num.split(".")[1].length); f = fr(Math.round(+num * d), d); } else f = [+num, 1]; }
            if (m[1]) f = [-f[0], f[1]];
            if (si === 1) f = [-f[0], f[1]];
            add(m[4] || "k", f);
        }
    }
    const L = [tot.x[1], tot.y[1], tot.k[1]].reduce((p, q) => p * q / gcd(p, q), 1);
    let a = tot.x[0] * L / tot.x[1], b = tot.y[0] * L / tot.y[1], c = -tot.k[0] * L / tot.k[1];
    if (!a && !b) return { err: "That has no x or y in it once it's simplified. Try another." };
    const g = gcd(gcd(a, b), c), sg = a < 0 || (a === 0 && b < 0) ? -1 : 1;
    a = sg * a / g; b = sg * b / g; c = sg * c / g;
    if (!sysPts(a, b, c)) return { err: "That line misses the grid's whole-number points. Try numbers that land on the grid." };
    return { a, b, c };
}
/** Set the system from two typed equations. Returns "" or why not. */
export function sysSet(S, A, B) {
    const P = sysPts(A.a, A.b, A.c), Q = sysPts(B.a, B.b, B.c);
    if (!P || !Q) return "That line misses the grid's whole-number points.";
    S.l = [P, Q]; S.tp = null; S.rv = false; return "";
}
/** Move point w (0 or 1) of line i. False if it would sit on the line's other point or leave the grid. */
export function sysMove(S, i, w, x, y) {
    x = int(x, 0); y = int(y, 0); if (!inR(x) || !inR(y)) return false;
    const o = S.l[i][1 - w]; if (o[0] === x && o[1] === y) return false;
    S.l[i][w] = [x, y]; S.rv = false; return true;
}
const SLOPES = [[1, 1], [2, 1], [3, 1], [-1, 1], [-2, 1], [-3, 1], [1, 2], [-1, 2], [1, 3], [-1, 3], [2, 3], [-2, 3], [3, 2], [-3, 2]];
/** A new system with one solution (whole numbers), no solution or infinitely many. */
export function sysNew(S, kind, rnd = Math.random) {
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    for (let n = 0; n < 200; n++) {
        const sx = Math.floor(rnd() * 9) - 4, sy = Math.floor(rnd() * 9) - 4, m1 = pick(SLOPES);
        let m2 = pick(SLOPES); if (kind !== "one") m2 = m1; else if (m2[0] * m1[1] === m1[0] * m2[1]) continue;
        const L1 = { a: m1[0], b: -m1[1], c: m1[0] * sx - m1[1] * sy };   // through (sx, sy): rise·x − run·y = rise·sx − run·sy
        let L2 = { a: m2[0], b: -m2[1], c: m2[0] * sx - m2[1] * sy };
        if (kind === "none") { const sh = pick([-6, -5, -4, -3, 3, 4, 5, 6]); L2 = { a: m2[0], b: -m2[1], c: L1.c + sh * m2[1] }; }
        if ([L1, L2].some((L) => L.c % L.b || Math.abs(L.c / L.b) > 8)) continue;   // whole-number y-intercepts on the grid
        const avoid = kind === "one" ? [sx, sy] : null, P = sysPts(L1.a, L1.b, L1.c, avoid);
        let Q = sysPts(L2.a, L2.b, L2.c, avoid);
        if (!P || !Q) continue;
        if (kind === "many") { const all = []; for (let x = -SYS_R; x <= SYS_R; x++) for (let y = -SYS_R; y <= SYS_R; y++) if (L1.a * x + L1.b * y === L1.c && !P.some((q) => q[0] === x && q[1] === y)) all.push([x, y]); if (all.length < 2) continue; all.sort((p, q) => Math.abs(p[0]) + Math.abs(p[1]) - Math.abs(q[0]) - Math.abs(q[1])); Q = [all[0], all[1]]; }
        if (kind === "one" && (P.some((q) => Math.abs(q[1]) > 8) || Q.some((q) => Math.abs(q[1]) > 8))) continue;
        S.l = [P, Q]; S.tp = null; S.rv = false; return true;
    }
    return false;
}
/** The system's answer as text, for the chip and the panel. */
export function sysAns(S) { const r = sysSolve(S); return r.kind === "one" ? "(" + fracText(r.x) + ", " + fracText(r.y) + ")" : r.kind === "none" ? "No solution" : "Infinitely many"; }
function cleanSys(o) {
    const D = sysDefault(); if (!o || typeof o !== "object") return D;
    const pt = (q) => (Array.isArray(q) && q.length === 2 && q.every((v) => Number.isInteger(v) && inR(v)) ? [q[0], q[1]] : null);
    const ln = (L) => { if (!Array.isArray(L) || L.length !== 2) return null; const P = pt(L[0]), Q = pt(L[1]); return P && Q && (P[0] !== Q[0] || P[1] !== Q[1]) ? [P, Q] : null; };
    const l = Array.isArray(o.l) && o.l.length === 2 ? o.l.map(ln) : [null, null];
    return { l: [l[0] || D.l[0], l[1] || D.l[1]], f: o.f === "std" ? "std" : "si", hide: !!o.hide, rv: !!o.rv, tp: pt(o.tp) };
}

/* ---------- Scatter plot ---------- */
/* Points on a graph with real axes. The class drags points, taps to add more, and drags its own trend line through
   them. The panel reads the association (positive, negative or none, and how strong), flags a point far from the
   trend as a possible outlier, shows the best-fit line to compare, and predicts with the class's own line.
   The data sets are made-up classroom samples. */
export const SC_MAX = 40;
/* x / y: [axis label, low, high, tick, snap]. u: how a value reads in a sentence [before, one, many].
   per: what one step of x is, for the slope. yw: what y counts, for the slope (blank for plain y). ps: predict step. */
export const SC_SETS = {
    study: { name: "Study time", x: ["Hours studied", 0, 10, 1, 0.5], y: ["Quiz score", 40, 100, 10, 1], ux: ["", " hour", " hours"], uy: ["about ", " point", " points"], per: "each extra hour studied", yw: "points", yn: "quiz score", ps: 0.5,
        p: [[1, 54], [1.5, 58], [2, 57], [2.5, 63], [3, 65], [3.5, 68], [4, 70], [4.5, 68], [5, 75], [5.5, 77], [6, 80], [6.5, 79], [7, 85], [7.5, 86], [8, 88], [9, 93], [1.5, 88]] },
    cocoa: { name: "Cocoa sales", x: ["Temperature (°F)", 20, 80, 10, 1], y: ["Cups of cocoa sold", 0, 60, 10, 1], ux: ["", "°F", "°F"], uy: ["about ", " cup", " cups"], per: "each degree warmer", yw: "cups", yn: "cocoa sold", ps: 5,
        p: [[24, 50], [28, 53], [31, 44], [35, 46], [38, 37], [42, 40], [45, 33], [48, 34], [52, 25], [55, 29], [58, 20], [62, 24], [66, 13], [70, 17], [74, 8], [78, 11]] },
    month: { name: "Birth month", x: ["Birth month", 0, 12, 1, 1], y: ["Height (in)", 50, 74, 4, 1], ux: ["month ", "", ""], uy: ["about ", " inch", " inches"], per: "each month later", yw: "inches", yn: "height", ps: 1,
        p: [[1, 62], [2, 58], [2, 66], [3, 61], [4, 64], [5, 57], [5, 63], [6, 60], [7, 65], [7, 59], [8, 62], [9, 66], [9, 58], [10, 63], [11, 60], [12, 64], [12, 59]] },
    own: { name: "Your own", x: ["x", 0, 20, 2, 1], y: ["y", 0, 20, 2, 1], ux: ["x = ", "", ""], uy: ["y ≈ ", "", ""], per: "each 1 more in x", yw: "", yn: "y", ps: 1, p: [] },
};
export const SC_KEYS = Object.keys(SC_SETS);
const scSnap = (v, a) => { const n = Math.round((v - a[1]) / a[4]) * a[4] + a[1]; return +clamp(n, a[1], a[2]).toFixed(4); };
/** A number as the panel writes it: true minus, no trailing zeros, dp decimals at most. */
export const scNum = (v, dp = 1) => { const t = (+v.toFixed(dp)).toString(); return t === "-0" ? "0" : t.replace("-", "−"); };
function scLnDefault(D, pts) {
    const span = D.x[2] - D.x[1], ym = pts.length ? pts.reduce((t, q) => t + q[1], 0) / pts.length : (D.y[1] + D.y[2]) / 2, y = scSnap(ym, D.y);
    return [[scSnap(D.x[1] + span * 0.12, D.x), y], [scSnap(D.x[1] + span * 0.88, D.x), y]];
}
/** A fresh panel showing data set d (its own points, a flat trend line through the middle to tilt into place). */
export function scDefault(d = "study") {
    const D = SC_SETS[d] || SC_SETS.study, p = D.p.map((q) => q.slice());
    return { d: SC_SETS[d] ? d : "study", p, ln: scLnDefault(D, p), best: false, hide: false, rv: false, px: null };
}
/** Least squares and the correlation: { n, m, b, r } (m, b null when every x is the same; r null when it can't be found). */
export function scStats(pts) {
    const n = pts.length; if (n < 2) return { n, m: null, b: null, r: null };
    const mx = pts.reduce((t, q) => t + q[0], 0) / n, my = pts.reduce((t, q) => t + q[1], 0) / n;
    let sxx = 0, syy = 0, sxy = 0; pts.forEach(([x, y]) => { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); });
    if (sxx < 1e-9) return { n, m: null, b: null, r: null };
    const m = sxy / sxx; return { n, m, b: my - m * mx, r: syy < 1e-9 ? 0 : sxy / Math.sqrt(sxx * syy) };
}
/** The association in words: { dir: "positive" | "negative" | "none" | "", str: "strong" | "moderate" | "weak" | "", text }. */
export function scAssoc(pts) {
    const { n, r } = scStats(pts);
    if (n < 3 || r == null) return { dir: "", str: "", text: "Add more points to see a trend" };
    const a = Math.abs(r);
    if (a < 0.3) return { dir: "none", str: "", text: "No clear association" };
    const dir = r > 0 ? "positive" : "negative", str = a >= 0.8 ? "strong" : a >= 0.5 ? "moderate" : "weak";
    return { dir, str, text: str[0].toUpperCase() + str.slice(1) + " " + dir + " association" };
}
/** Points far from the trend: each one is checked against the best-fit line of the others. Needs 6 points or more. */
export function scOutliers(S) {
    const P = S.p, D = SC_SETS[S.d], out = []; if (P.length < 6) return out;
    P.forEach((q, i) => {
        const rest = P.filter((_, j) => j !== i), f = scStats(rest); if (f.m == null) return;
        const sse = rest.reduce((t, [x, y]) => t + (y - (f.m * x + f.b)) ** 2, 0), sd = Math.sqrt(sse / (rest.length - 2));
        if (Math.abs(q[1] - (f.m * q[0] + f.b)) > Math.max(3 * sd, 0.15 * (D.y[2] - D.y[1]))) out.push(i);
    });
    return out.length <= Math.max(1, Math.floor(P.length / 6)) ? out : [];   // if lots stand out, it isn't a line at all
}
/** The class's own line, y = m x + b. */
export function scLine(S) { const [[x1, y1], [x2, y2]] = S.ln, m = (y2 - y1) / (x2 - x1); return { m, b: y1 - m * x1 }; }
/** "y = 4.9x + 51", rounded so the numbers read well. */
export function scEq(m, b) {
    const md = Math.abs(m) < 1 ? 2 : 1, bd = Math.abs(b) < 10 ? 1 : 0;
    let s = "y = "; const mt = scNum(m, md), bt = scNum(Math.abs(b), bd);
    if (mt === "0") return s + scNum(b, bd);
    s += (mt === "1" ? "" : mt === "−1" ? "−" : mt) + "x";
    return bt === "0" ? s : s + (b < 0 ? " − " : " + ") + bt;
}
/** A value of x or y as a sentence says it: "6 hours", "65°F", "month 3", "about 80 points", "y ≈ 12". */
export function scSay(D, ax, v) { const u = ax === "x" ? D.ux : D.uy, t = scNum(v, ax === "x" ? 2 : D.y[4] < 1 ? 1 : 0); return u[0] + t + (t === "1" ? u[1] : u[2]); }
/** How many points sit above, below and on the class's line. */
export function scSides(S) {
    const { m, b } = scLine(S), tol = SC_SETS[S.d].y[4] / 2, o = { above: 0, below: 0, on: 0 };
    S.p.forEach(([x, y]) => { const e = y - (m * x + b); o[Math.abs(e) < tol ? "on" : e > 0 ? "above" : "below"]++; });
    return o;
}
/** The class's line read as slope and y-intercept sentences. */
export function scRead(S) {
    const D = SC_SETS[S.d], { m, b } = scLine(S), a = scAssoc(S.p), md = Math.abs(m) < 1 ? 2 : 1;
    const mag = scNum(Math.abs(m), md), up = m > 0;
    const slope = mag === "0" ? "Slope 0: a flat line says " + D.yn + " doesn't change. Tilt it to follow the points."
        : a.dir === "none" ? "Slope " + scNum(m, md) + ", but with no clear association the line doesn't predict much."
        : "Slope " + scNum(m, md) + ": " + D.per + " goes with " + (D.yw ? "about " + mag + (up ? " more " : " fewer ") + D.yw : "y going " + (up ? "up" : "down") + " about " + mag) + ".";
    const xs = S.p.map((q) => q[0]), outside = !xs.length || Math.min(...xs) > 0 || Math.max(...xs) < 0;
    const icpt = "y-intercept " + scNum(b, Math.abs(b) < 10 ? 1 : 0) + ": " + scSay(D, "y", b) + " at " + scSay(D, "x", 0) + (outside ? ". That's outside the data, so trust it less." : ".");
    return { slope, icpt };
}
/** What the class's line predicts at x. */
export function scPredict(S, x) { const { m, b } = scLine(S); return m * x + b; }
/** Add a point (snapped to the axes). False when the plot is full or one is already there. */
export function scAdd(S, x, y) {
    const D = SC_SETS[S.d]; if (S.p.length >= SC_MAX) return false;
    x = scSnap(x, D.x); y = scSnap(y, D.y); if (S.p.some((q) => q[0] === x && q[1] === y)) return false;
    S.p.push([x, y]); S.rv = false; return true;
}
/** Move point i. False if nothing changed or another point is already there. */
export function scMove(S, i, x, y) {
    const D = SC_SETS[S.d], q = S.p[i]; if (!q) return false;
    x = scSnap(x, D.x); y = scSnap(y, D.y); if ((q[0] === x && q[1] === y) || S.p.some((o, j) => j !== i && o[0] === x && o[1] === y)) return false;
    S.p[i] = [x, y]; S.rv = false; return true;
}
export function scDel(S, i) { if (!S.p[i]) return false; S.p.splice(i, 1); S.rv = false; return true; }
/** Move end w of the class's line. Its two ends keep apart across the graph. */
export function scHandle(S, w, x, y) {
    const D = SC_SETS[S.d]; x = scSnap(x, D.x); y = scSnap(y, D.y);
    const o = S.ln[1 - w]; if (Math.abs(x - o[0]) < (D.x[2] - D.x[1]) / 10 || (w === 0 ? x > o[0] : x < o[0])) return false;
    if (S.ln[w][0] === x && S.ln[w][1] === y) return false;
    S.ln[w] = [x, y]; return true;
}
/** The chip's words. */
export function scChip(S) { return S.hide && !S.rv ? "What's the trend?" : scAssoc(S.p).text.replace(" association", ""); }
function cleanSc(o) {
    if (!o || typeof o !== "object") return scDefault();
    const d = SC_SETS[o.d] ? o.d : "study", D = SC_SETS[d], out = scDefault(d), okNum = (v) => typeof v === "number" && Number.isFinite(v);
    const inAx = (q) => Array.isArray(q) && q.length === 2 && okNum(q[0]) && okNum(q[1]) && q[0] >= D.x[1] && q[0] <= D.x[2] && q[1] >= D.y[1] && q[1] <= D.y[2];
    if (Array.isArray(o.p)) { out.p = []; o.p.forEach((q) => { if (out.p.length < SC_MAX && inAx(q)) { const r = [scSnap(q[0], D.x), scSnap(q[1], D.y)]; if (!out.p.some((z) => z[0] === r[0] && z[1] === r[1])) out.p.push(r); } }); }
    if (Array.isArray(o.ln) && o.ln.length === 2 && o.ln.every(inAx)) { const L = o.ln.map((q) => [scSnap(q[0], D.x), scSnap(q[1], D.y)]); if (L[1][0] > L[0][0]) out.ln = L; else out.ln = scLnDefault(D, out.p); }
    else out.ln = scLnDefault(D, out.p);
    out.best = !!o.best; out.hide = !!o.hide; out.rv = !!o.rv;
    out.px = okNum(o.px) && o.px >= D.x[1] && o.px <= D.x[2] ? scSnap(o.px, D.x) : null;
    return out;
}

/* ---------- Tape diagram ---------- */
/* Percent: one tape is the whole (100%), cut into equal parts; some parts are shaded. Find the part, the whole or the
   percent. Ratio: two tapes made of equal units, a : b. Find each amount from the total, the difference or one amount.
   Each problem is solved in two steps the class reveals one at a time: first one part (or one unit), then the answer. */
export const TP_PARTS = [2, 4, 5, 10];
export const TP_CTX = [["Boys", "Girls", "students"], ["Cats", "Dogs", "pets"], ["Red marbles", "Blue marbles", "marbles"], ["Adults", "Kids", "people"]];
export const tpDefault = () => ({ m: "pct", p: { n: 10, k: 3, u: 8, ask: "part" }, r: { a: 3, b: 5, u: 5, c: 0, ask: "total" }, s: 0 });
const ASK_P = ["part", "whole", "pct"], ASK_R = ["total", "diff", "one"];
/** The percent problem in numbers: whole, part, percent, one part's value and percent. */
export function tpPct(P) { const pp = 100 / P.n; return { whole: P.n * P.u, part: P.k * P.u, pct: P.k * pp, pp, u: P.u }; }
/** The percent problem as a question. */
export function tpPctQ(P) {
    const v = tpPct(P);
    return P.ask === "part" ? "What is " + v.pct + "% of " + v.whole + "?" : P.ask === "whole" ? v.part + " is " + v.pct + "% of what number?" : v.part + " is what percent of " + v.whole + "?";
}
export function tpPctA(P) { const v = tpPct(P); return P.ask === "part" ? String(v.part) : P.ask === "whole" ? String(v.whole) : v.pct + "%"; }
/** The two steps, as sentences. */
export function tpPctSteps(P) {
    const v = tpPct(P), parts = (k) => k + (k === 1 ? " part" : " parts");
    if (P.ask === "part") return ["100% is " + v.whole + ", cut into " + P.n + " equal parts, so each part is " + v.whole + " ÷ " + P.n + " = " + v.u + ".", v.pct + "% is " + parts(P.k) + ": " + P.k + " × " + v.u + " = " + v.part + "."];
    if (P.ask === "whole") return [v.pct + "% is " + parts(P.k) + " (each part is " + v.pp + "%), so each part is " + v.part + " ÷ " + P.k + " = " + v.u + ".", "100% is " + parts(P.n) + ": " + P.n + " × " + v.u + " = " + v.whole + "."];
    return ["The whole is " + P.n + " equal parts, so each part is " + v.whole + " ÷ " + P.n + " = " + v.u + ", and " + v.part + " ÷ " + v.u + " = " + parts(P.k) + ".", "Each part is " + v.pp + "%, so " + parts(P.k) + " is " + P.k + " × " + v.pp + "% = " + v.pct + "%."];
}
/** The ratio problem in numbers. */
export function tpRat(R) { return { A: R.a * R.u, B: R.b * R.u, tot: (R.a + R.b) * R.u, diff: Math.abs(R.a - R.b) * R.u, units: R.a + R.b }; }
export function tpRatQ(R) {
    const v = tpRat(R), [na, nb, all] = TP_CTX[R.c], lo = (t) => t.toLowerCase();
    const head = "The ratio of " + lo(na) + " to " + lo(nb) + " is " + R.a + " : " + R.b + ". ";
    if (R.ask === "total") return head + "There are " + v.tot + " " + all + " in all. How many of each?";
    if (R.ask === "diff") { const more = R.b > R.a ? nb : na; return head + "There are " + v.diff + " more " + lo(more) + ". How many of each?"; }
    return head + "There are " + v.A + " " + lo(na) + ". How many " + lo(nb) + "?";
}
export function tpRatA(R) { const v = tpRat(R), [na, nb] = TP_CTX[R.c]; return R.ask === "one" ? v.B + " " + nb.toLowerCase() : na + " " + v.A + ", " + nb.toLowerCase() + " " + v.B; }
export function tpRatSteps(R) {
    const v = tpRat(R), [na, nb] = TP_CTX[R.c], un = (k) => k + (k === 1 ? " unit" : " units");
    const ans = R.ask === "one" ? nb + ": " + R.b + " × " + R.u + " = " + v.B + "." : na + ": " + R.a + " × " + R.u + " = " + v.A + ". " + nb + ": " + R.b + " × " + R.u + " = " + v.B + ".";
    if (R.ask === "total") return [R.a + " + " + R.b + " = " + un(v.units) + " make " + v.tot + ", so 1 unit is " + v.tot + " ÷ " + v.units + " = " + R.u + ".", ans];
    if (R.ask === "diff") { const d = Math.abs(R.a - R.b); return ["The difference is " + Math.max(R.a, R.b) + " − " + Math.min(R.a, R.b) + " = " + un(d) + ", and that's " + v.diff + ", so 1 unit is " + v.diff + " ÷ " + d + " = " + R.u + ".", ans]; }
    return [un(R.a) + " of " + na.toLowerCase() + " is " + v.A + ", so 1 unit is " + v.A + " ÷ " + R.a + " = " + R.u + ".", ans];
}
/** A new problem of the same kind, with whole numbers. */
export function tpNew(S, rnd = Math.random) {
    const pick = (a) => a[Math.floor(rnd() * a.length)], ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    if (S.m === "pct") { const n = pick([4, 5, 10, 10]), big = n === 10 && rnd() < 0.2; S.p = { n, k: big ? ri(11, 15) : ri(1, n - 1), u: ri(2, 12), ask: pick(ASK_P) }; }
    else { const ask = pick(ASK_R); let a, b; do { a = ri(1, 6); b = ri(1, 6); } while (gcd(a, b) > 1 || (ask === "diff" && a === b) || a + b < 3); S.r = { a, b, u: ri(2, 12), c: ri(0, TP_CTX.length - 1), ask }; }
    S.s = 0;
}
/** Change one number on the tape. Keeps it a problem with whole numbers and starts the steps over. */
export function tpSet(S, key, v) {
    if (S.m === "pct") {
        const P = S.p;
        if (key === "n") { const i = clamp(TP_PARTS.indexOf(P.n) + Math.sign(v), 0, TP_PARTS.length - 1), n = TP_PARTS[i]; if (n === P.n) return false; P.k = clamp(Math.round(P.k * n / P.n), 1, 2 * n); P.n = n; }
        else if (key === "k") { const k = clamp(P.k + v, 1, 2 * P.n); if (k === P.k) return false; P.k = k; }
        else if (key === "u") { const u = clamp(P.u + v, 1, 25); if (u === P.u) return false; P.u = u; }
        else return false;
    } else {
        const R = S.r;
        if (key === "a" || key === "b") { const n = clamp(R[key] + v, 1, 8); if (n === R[key]) return false; R[key] = n; if (R.ask === "diff" && R.a === R.b) R.ask = "total"; }
        else if (key === "u") { const u = clamp(R.u + v, 1, 25); if (u === R.u) return false; R.u = u; }
        else return false;
    }
    S.s = 0; return true;
}
export function tpAsk(S, ask) {
    if (S.m === "pct" ? !ASK_P.includes(ask) : !ASK_R.includes(ask)) return false;
    if (S.m === "ratio" && ask === "diff" && S.r.a === S.r.b) return false;
    const o = S.m === "pct" ? S.p : S.r; if (o.ask === ask) return false; o.ask = ask; S.s = 0; return true;
}
export function tpChip(S) {
    if (S.m === "ratio") return S.s >= 2 ? tpRatA(S.r) : S.r.a + " : " + S.r.b;
    const v = tpPct(S.p), done = S.s >= 2, a = S.p.ask, q = (x, on) => (done || a !== on ? x : "?");
    return q(v.pct, "pct") + "% of " + q(v.whole, "whole") + " = " + q(v.part, "part");
}
function cleanTape(o) {
    const D = tpDefault(); if (!o || typeof o !== "object") return D;
    const P = o.p && typeof o.p === "object" ? o.p : {}, R = o.r && typeof o.r === "object" ? o.r : {};
    const n = TP_PARTS.includes(P.n) ? P.n : D.p.n;
    const out = { m: o.m === "ratio" ? "ratio" : "pct", p: { n, k: cint(P.k, 1, 2 * n, Math.min(D.p.k, 2 * n)), u: cint(P.u, 1, 25, D.p.u), ask: ASK_P.includes(P.ask) ? P.ask : "part" },
        r: { a: cint(R.a, 1, 8, D.r.a), b: cint(R.b, 1, 8, D.r.b), u: cint(R.u, 1, 25, D.r.u), c: cint(R.c, 0, TP_CTX.length - 1, 0), ask: ASK_R.includes(R.ask) ? R.ask : "total" }, s: cint(o.s, 0, 2, 0) };
    if (out.r.ask === "diff" && out.r.a === out.r.b) out.r.ask = "total";
    return out;
}

/* ---------- Volume shapes ---------- */
/* A cylinder, cone or sphere with its radius and height. Find the volume, or work back to the height (cylinder, cone)
   or the radius (sphere). Answers in terms of π, or with 3.14 for π. Solved in steps the class reveals one at a time.
   Compare puts the matching cylinder beside a cone (1/3 full) or a sphere (2/3 full). */
export const VL_SH = { cyl: "cylinder", cone: "cone", sph: "sphere" };
export const VL_UNITS = ["cm", "in", "ft", "m"];
export const volDefault = () => ({ sh: "cyl", r: 3, h: 5, ask: "v", pi: "pi", cmp: false, u: 0, s: 0 });
const VL_ASK = { cyl: ["v", "h"], cone: ["v", "h"], sph: ["v", "r"] };
const r2 = (x) => Math.round(x * 100) / 100;
const dec = (x) => String(r2(x));
/** n/d as text, reduced: "15", "20/3". */
function vlFr(n, d) { const g = gcd(n, d); n /= g; d /= g; return d === 1 ? String(n) : n + "/" + d; }
/** The volume of the shape: π × n/d, and the parts the steps use. */
export function volOf(V) {
    const r = V.r, h = V.sh === "sph" ? 2 * r : V.h, B = r * r;
    const [n, d] = V.sh === "cyl" ? [B * h, 1] : V.sh === "cone" ? [B * h, 3] : [4 * r * r * r, 3];
    return { r, h, B, cyl: B * h, n, d, val: (Math.PI * n) / d, dec: r2((3.14 * n) / d) };
}
/** A multiple of π as text: "45π", "(20/3)π", "π". */
export function piText(n, d = 1) { const f = vlFr(n, d); return f === "1" ? "π" : f.includes("/") ? "(" + f + ")π" : f + "π"; }
const unit3 = (V) => " " + VL_UNITS[V.u] + "³";
/** The volume as the class writes it, in the mode chosen. */
export function volText(V) { const v = volOf(V); return V.pi === "pi" ? piText(v.n, v.d) : dec((3.14 * v.n) / v.d); }
export function volQ(V) {
    const v = volOf(V), u = VL_UNITS[V.u], nm = VL_SH[V.sh], tail = V.pi === "pi" ? "" : " Use 3.14 for π.";
    if (V.ask === "v") return (V.sh === "sph" ? "A sphere has a radius of " + v.r + " " + u + "." : "A " + nm + " has a radius of " + v.r + " " + u + " and a height of " + v.h + " " + u + ".") + " What is its volume?" + tail;
    if (V.ask === "h") return "A " + nm + " has a radius of " + v.r + " " + u + " and a volume of " + volText(V) + unit3(V) + ". What is its height?" + tail;
    return "A sphere has a volume of " + volText(V) + unit3(V) + ". What is its radius?" + tail;
}
export function volA(V) {
    const v = volOf(V), u = VL_UNITS[V.u];
    if (V.ask === "h") return "h = " + v.h + " " + u;
    if (V.ask === "r") return "r = " + v.r + " " + u;
    return V.pi === "pi" ? piText(v.n, v.d) + unit3(V) + " ≈ " + dec((3.14 * v.n) / v.d) + unit3(V) : dec((3.14 * v.n) / v.d) + unit3(V);
}
/** "=" when the numbers come out exact, "≈" when the result is rounded. */
const eqOr = (raw, shown) => (Math.abs(raw - shown) < 1e-6 ? " = " : " ≈ ");
/** The steps, as sentences. Two or three, depending on the shape and the question. */
export function volSteps(V) {
    const v = volOf(V), P = V.pi === "pi", r = v.r, r3 = r * r * r;
    const Bd = r2(3.14 * v.B), B = P ? piText(v.B) : String(Bd), Vt = volText(V), Vraw = (3.14 * v.n) / v.d;
    const base = "The base is a circle: B = πr² = " + (P ? "π × " + r + "²" : "3.14 × " + r + "²") + " = " + B + ".";
    if (V.sh === "sph") {
        if (V.ask === "v") return ["Cube the radius: r³ = " + r + "³ = " + r3 + ".", "V = 4/3 πr³ = 4/3 × " + (P ? "π" : "3.14") + " × " + r3 + (P ? " = " : eqOr(Vraw, +Vt)) + Vt + "."];
        const rr = P ? r3 : (+Vt * 3) / 4 / 3.14;
        return ["V = 4/3 πr³, so r³ = " + (P ? "V ÷ (4/3)π = " + Vt + " ÷ (4/3)π" : "V × 3 ÷ 4 ÷ 3.14 = " + Vt + " × 3 ÷ 4 ÷ 3.14") + eqOr(rr, r3) + r3 + ".", "r = ∛" + r3 + " = " + r + ", because " + r + " × " + r + " × " + r + " = " + r3 + "."];
    }
    const cylD = r2(Bd * v.h), cyl = P ? piText(v.cyl) : String(cylD);
    if (V.ask === "v") {
        if (V.sh === "cyl") return [base, "V = Bh = " + B + " × " + v.h + " = " + cyl + "."];
        return [base, "A cylinder with the same base and height holds Bh = " + B + " × " + v.h + " = " + cyl + ".", "A cone holds 1/3 of that: V = " + cyl + " ÷ 3" + (P ? " = " : eqOr(cylD / 3, +Vt)) + Vt + "."];
    }
    if (V.sh === "cyl") return [base, "V = Bh, so h = V ÷ B = " + Vt + " ÷ " + B + (P ? " = " : eqOr(+Vt / Bd, v.h)) + v.h + "."];
    const three = P ? piText(v.cyl) : dec(3 * +Vt);
    return [base, "A cone is 1/3 of the cylinder with the same base and height, so that cylinder holds 3 × " + Vt + " = " + three + ".", "h = " + three + " ÷ " + B + (P ? " = " : eqOr(+three / Bd, v.h)) + v.h + "."];
}
/** A new problem of the same shape. Mostly whole multiples of π. */
export function volNew(V, rnd = Math.random) {
    const pick = (a) => a[Math.floor(rnd() * a.length)], ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    V.ask = pick(VL_ASK[V.sh]); V.u = ri(0, VL_UNITS.length - 1); V.s = 0;
    if (V.sh === "sph") { V.r = rnd() < 0.7 ? pick([3, 3, 6]) : ri(1, 5); return; }
    V.r = ri(1, 8); V.h = ri(2, 12);
    if (V.sh === "cone" && rnd() < 0.85) while ((V.r * V.r * V.h) % 3) V.h = ri(2, 12);
}
export function volSet(V, key, d) {
    const lim = key === "r" ? [1, 12] : key === "h" ? [1, 20] : null; if (!lim || (key === "h" && V.sh === "sph")) return false;
    const n = clamp(V[key] + d, lim[0], lim[1]); if (n === V[key]) return false; V[key] = n; V.s = 0; return true;
}
export function volShape(V, sh) { if (!VL_SH[sh] || V.sh === sh) return false; V.sh = sh; if (!VL_ASK[sh].includes(V.ask)) V.ask = "v"; V.s = 0; return true; }
export function volAsk(V, ask) { if (!VL_ASK[V.sh].includes(ask) || V.ask === ask) return false; V.ask = ask; V.s = 0; return true; }
export const volN = (V) => volSteps(V).length;
export function volChip(V) { if (V.s >= volN(V)) return volA(V); return { cyl: "Cylinder", cone: "Cone", sph: "Sphere" }[V.sh] + ", " + (V.ask === "v" ? "V" : V.ask) + " = ?"; }
function cleanVol(o) {
    const D = volDefault(); if (!o || typeof o !== "object") return D;
    const sh = VL_SH[o.sh] ? o.sh : D.sh;
    const out = { sh, r: cint(o.r, 1, 12, D.r), h: cint(o.h, 1, 20, D.h), ask: VL_ASK[sh].includes(o.ask) ? o.ask : "v", pi: o.pi === "dec" ? "dec" : "pi", cmp: o.cmp === true, u: cint(o.u, 0, VL_UNITS.length - 1, 0), s: 0 };
    out.s = cint(o.s, 0, volN(out), 0);
    return out;
}

const DEFAULTS = { balance: balDefault, chance: chanceDefault, line: lineDefault, xform: xfDefault, pyth: pyDefault, counters: ctDefault, angle: angDefault, fn: fnDefault, area: exDefault, nl: nlDefault, sys: sysDefault, scat: () => scDefault(), tape: tpDefault, vol: volDefault, calc: calcDefault, sci: sciDefault, graph: gcDefault };
const CLEAN = { balance: cleanBal, chance: cleanChance, line: cleanLine, xform: cleanXf, pyth: cleanPy, counters: cleanCt, angle: cleanAng, fn: cleanFn, area: cleanEx, nl: cleanNl, sys: cleanSys, scat: cleanSc, tape: cleanTape, vol: cleanVol, calc: cleanCalc, sci: (o) => Object.assign(sciDefault(), cleanCalc(o)), graph: cleanGc };
export const mtDefault = (k) => DEFAULTS[k]();
/** tools.mt as saved: only panels that were used are kept, each cleaned. */
export function cleanMt(o) { const out = {}; if (!o || typeof o !== "object") return out; MT_KEYS.forEach((k) => { if (o[k] && typeof o[k] === "object") out[k] = CLEAN[k](o[k]); }); return out; }
/** The state of one panel, made if it is not there yet. */
export function mtOf(T, k) { if (!T.mt || typeof T.mt !== "object") T.mt = {}; if (!T.mt[k]) T.mt[k] = DEFAULTS[k](); return T.mt[k]; }
/** What a minimized panel's chip says. */
export function mtChip(k, T) {
    const s = (T.mt || {})[k] || DEFAULTS[k]();
    if (k === "balance") { const v = balSolved(s); if (isIneq(s)) return { v: v ? "x " + v.r + " " + v.v : eqText(s.s, s.r), tone: v ? "green" : "" }; return { v: v ? "x = " + v.v : eqText(s.s), tone: v ? "green" : balanced(s) ? "" : "amber" }; }
    if (k === "chance") { const n = trials(s); return { v: n ? n + (n === 1 ? " trial" : " trials") : { spin: "Spinner", coin: "Coin", dice: s.d2 ? "Two dice" : "Die" }[s.m] }; }
    if (k === "line") return { v: s.eq ? lineEq(s) : "Line" };
    if (k === "xform") return { v: s.ops.length ? s.ops.length + (s.ops.length === 1 ? " move" : " moves") : SHAPES[s.sh][0] };
    if (k === "pyth") return { v: s.a + "² + " + s.b + "² = " + pyOf(s).c2 };
    if (k === "calc" || k === "sci") return { v: s.done && num(s.r) != null ? fmt(s.r) : s.x ? s.x.slice(-14) : "0" };
    if (k === "graph") { const n = s.e.filter((x) => x.t.trim()).length; return { v: n === 1 ? s.e.find((x) => x.t.trim()).t.slice(0, 16) : n ? n + " graphs" : "Graph" }; }
    if (k === "angle") { if (s.m === "tri") { const d = triAngles(s.t).deg; return { v: d.join("° + ") + "° = 180°" }; } return { v: (s.np ? "Not parallel, " : "") + s.a + "° and " + (180 - s.a) + "°" }; }
    if (k === "area") { if (s.m === "fac") { const R = exRows(s); return { v: R.even ? (s.r === 1 ? exLin(s.p, s.q) : s.r + "(" + R.inside + ")") : exLin(s.p, s.q), tone: R.best ? "green" : "" }; } return { v: exFactored(s.a, s.b, s.c) + " = " + (s.hide ? "?" : exExpanded(s.a, s.b, s.c)) }; }
    if (k === "nl") return { v: nlSum(s, s.hide && !s.rv) };
    if (k === "sys") return { v: s.hide && !s.rv ? "Where do they cross?" : sysAns(s), tone: s.hide && !s.rv ? "" : "green" };
    if (k === "scat") return { v: scChip(s) };
    if (k === "tape") return { v: tpChip(s), tone: s.s >= 2 ? "green" : "" };
    if (k === "vol") return { v: volChip(s), tone: s.s >= volN(s) ? "green" : "" };
    if (k === "fn") return { v: s.m === "test" ? "Function or not?" : s.hide ? "Mystery rule" : "y = " + fnRule(s) };
    if (k === "counters") { const v = ctValue(s); return { v: (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) }; }
    return { v: "" };
}
