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
     calc      Basic calculator     + − × ÷ and percent, with the order of operations
     sci       Scientific calculator powers, roots, trig, logs, Ans and fraction answers
     graph     Graphing calculator  expressions, sliders and a live graph (js/graphPanel.js)
   What each one shows lives in the shared board state (tools.mt.<key>), so the board and the Remote always match.
   Saved state can come from another device, so cleanMt() keeps only what is known, in range.
   Original Anchor Board tools; the ideas (balance, spinner, counters…) are classroom staples.
========================================== */
import { gcDefault, cleanGc, fmt } from "./graphCalc.js?v=1";

export const MT_KEYS = ["balance", "chance", "line", "xform", "pyth", "counters", "angle", "calc", "sci", "graph"];
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
export function balDefault() { const e = [3, 7, 0, 22]; return { e, s: e.slice(), h: [] }; }
/** The weights of the two pans for the hidden x. */
export function balWeights(B) { const xv = solveOf(B.e), s = B.s; return { L: s[0] * xv + s[1], R: s[2] * xv + s[3], xv }; }
export function balTilt(B) { const { L, R } = balWeights(B), d = R - L; if (Math.abs(d) < 1e-9) return 0; return Math.sign(d) * Math.min(14, 4 + Math.abs(d) * 1.5); }   // degrees; + = right pan down
export const balanced = (B) => balTilt(B) === 0;
/** x alone on one side, a number on the other: the answer. */
export function balSolved(B) {
    const s = B.s; if (!balanced(B)) return null;
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
export const eqText = (s) => sideText(s[0], s[1]) + " = " + sideText(s[2], s[3]);
const push = (B, s, label) => { if (!okCounts(s)) return "Too many tiles for the pans."; B.h = B.h.concat([{ s: B.s.slice(), l: label }]).slice(-10); B.s = s; return ""; };
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
    const d = op === "-" ? -n : n, i = kind === "x" ? 0 : 1; s[i] += d; s[i + 2] += d;
    return push(B, s, (op === "-" ? "− " : "+ ") + (kind === "x" ? (n === 1 ? "" : n) + "x" : n));
}
export function balUndo(B) { if (!B.h.length) return false; B.s = B.h[B.h.length - 1].s.slice(); B.h = B.h.slice(0, -1); return true; }
export function balSet(B, e) { B.e = e.slice(); B.s = e.slice(); B.h = []; }
function cleanBal(o) {
    const d = balDefault(); if (!o || typeof o !== "object") return d;
    const arr = (a) => (Array.isArray(a) && a.length === 4 ? a.map((v, i) => cint(v, -(i % 2 ? BAL_MAX_U : BAL_MAX_X), i % 2 ? BAL_MAX_U : BAL_MAX_X, 0)) : null);
    const e = arr(o.e); if (!e || e[0] === e[2]) return d;
    const s = arr(o.s) || e.slice();
    const h = Array.isArray(o.h) ? o.h.slice(-10).map((x) => x && arr(x.s) ? { s: arr(x.s), l: typeof x.l === "string" ? x.l.slice(0, 12) : "" } : null).filter(Boolean) : [];
    return { e, s, h };
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

const DEFAULTS = { balance: balDefault, chance: chanceDefault, line: lineDefault, xform: xfDefault, pyth: pyDefault, counters: ctDefault, angle: angDefault, calc: calcDefault, sci: sciDefault, graph: gcDefault };
const CLEAN = { balance: cleanBal, chance: cleanChance, line: cleanLine, xform: cleanXf, pyth: cleanPy, counters: cleanCt, angle: cleanAng, calc: cleanCalc, sci: (o) => Object.assign(sciDefault(), cleanCalc(o)), graph: cleanGc };
export const mtDefault = (k) => DEFAULTS[k]();
/** tools.mt as saved: only panels that were used are kept, each cleaned. */
export function cleanMt(o) { const out = {}; if (!o || typeof o !== "object") return out; MT_KEYS.forEach((k) => { if (o[k] && typeof o[k] === "object") out[k] = CLEAN[k](o[k]); }); return out; }
/** The state of one panel, made if it is not there yet. */
export function mtOf(T, k) { if (!T.mt || typeof T.mt !== "object") T.mt = {}; if (!T.mt[k]) T.mt[k] = DEFAULTS[k](); return T.mt[k]; }
/** What a minimized panel's chip says. */
export function mtChip(k, T) {
    const s = (T.mt || {})[k] || DEFAULTS[k]();
    if (k === "balance") { const v = balSolved(s); return { v: v ? "x = " + v.v : eqText(s.s), tone: v ? "green" : balanced(s) ? "" : "amber" }; }
    if (k === "chance") { const n = trials(s); return { v: n ? n + (n === 1 ? " trial" : " trials") : { spin: "Spinner", coin: "Coin", dice: s.d2 ? "Two dice" : "Die" }[s.m] }; }
    if (k === "line") return { v: s.eq ? lineEq(s) : "Line" };
    if (k === "xform") return { v: s.ops.length ? s.ops.length + (s.ops.length === 1 ? " move" : " moves") : SHAPES[s.sh][0] };
    if (k === "pyth") return { v: s.a + "² + " + s.b + "² = " + pyOf(s).c2 };
    if (k === "calc" || k === "sci") return { v: s.done && num(s.r) != null ? fmt(s.r) : s.x ? s.x.slice(-14) : "0" };
    if (k === "graph") { const n = s.e.filter((x) => x.t.trim()).length; return { v: n === 1 ? s.e.find((x) => x.t.trim()).t.slice(0, 16) : n ? n + " graphs" : "Graph" }; }
    if (k === "angle") { if (s.m === "tri") { const d = triAngles(s.t).deg; return { v: d.join("° + ") + "° = 180°" }; } return { v: (s.np ? "Not parallel, " : "") + s.a + "° and " + (180 - s.a) + "°" }; }
    if (k === "counters") { const v = ctValue(s); return { v: (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) }; }
    return { v: "" };
}
