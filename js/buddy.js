/* ==========================================
   Anchor Board — the student character ("Buddy"): Anchor Board's own cartoon kid, drawn here in SVG.
   Pure functions plus one small player: the same code draws the character on the student page (play.html),
   the teacher's Remote and the board, and checks a look on the Remote.

   A look is a short string, one letter + one digit (base 36) per part, like "s2h1c0e0m0t1u2b0v0f0w3a0k0g0x0":
     s skin · h hair · c hair color · e eyes · m mouth · t top · u top color · b bottoms · v bottoms color
     f shoes · w shoe color · a hat · k hat color · g glasses · x back (backpack, cape, rocket pack, wings)
   Most pieces are open to everyone. A few are earned (XP, level = locks cracked, a badge), never bought.

   How it's drawn (the technique from the Southbound demo athlete): a small 3D skeleton posed by joint
   angles, seen through a camera from three-quarters and a little above. Every body part is a rounded
   "sweep" along a bone with its own width and depth, shaded with light from the upper left, and the
   parts are painted far to near. Legs are solved from where the feet are (two-bone IK), so feet stay
   planted while the body sways and dips. Hair and hats are cut from the head's sphere, the face and shirt
   prints are decals that turn with the surface, and capes, long hair and flames trail behind on a spring.
   Moves ("wave", "dance", "cheer", "oops") are eased key poses with squash and stretch. Reduced motion
   shows each move's key moment as a still picture.
========================================== */

export const SKINS = ["#FCE3CF", "#F5CBA7", "#E0AC86", "#C68863", "#8D5A3B", "#5E3B26"];
/** Clothes and hat colors. The last one (gold) is earned. */
export const COLORS = [["#10358A", "Navy"], ["#7FAEDD", "Sky"], ["#F2B33D", "Amber"], ["#D94848", "Red"], ["#2E9A69", "Green"], ["#7B5CD6", "Purple"], ["#F28CB8", "Pink"], ["#F28C28", "Orange"], ["#2A3346", "Charcoal"], ["#F4F7FB", "White"], ["#E6B422", "Gold"]];
export const HAIR_COLORS = [["#2A1E1A", "Black"], ["#4A2F22", "Dark brown"], ["#7A4A2A", "Brown"], ["#9C3F22", "Auburn"], ["#E8C26A", "Blonde"], ["#D9692C", "Ginger"], ["#B9BFC9", "Silver"], ["#3A7BD5", "Blue"], ["#E264A8", "Pink"], ["#8A5CE0", "Purple"]];

/** Each part: [key in the look, label, list of [name, need]]. need: null (open), { xp }, { lv } or { badge }. */
export const PARTS = [
    ["s", "Skin", SKINS.map((c, i) => ["Tone " + (i + 1), null])],
    ["h", "Hair", [["Short", null], ["Spiky", null], ["Curly", null], ["Long", null], ["Buns", null], ["Buzz", null], ["Puffs", null], ["Swoop", null], ["Braids", null], ["None", null]]],
    ["c", "Hair color", HAIR_COLORS.map(([, n], i) => [n, i >= 6 ? { xp: 150 } : null])],
    ["e", "Eyes", [["Bright", null], ["Happy", null], ["Sparkle", null], ["Sleepy", null], ["Focused", null], ["Wink", null]]],
    ["m", "Mouth", [["Smile", null], ["Big grin", null], ["Oh!", null], ["Smirk", null], ["Silly", null]]],
    ["t", "Top", [["T-shirt", null], ["Hoodie", null], ["Tank", null], ["Jersey", { xp: 100 }], ["Jacket", { xp: 250 }], ["Math tee", { lv: 1 }]]],
    ["u", "Top color", COLORS.map(([, n], i) => [n, i === 10 ? { lv: 3 } : null])],
    ["b", "Bottoms", [["Jeans", null], ["Shorts", null], ["Joggers", null], ["Skirt", null], ["Cargo shorts", { xp: 120 }]]],
    ["v", "Bottoms color", COLORS.map(([, n], i) => [n, i === 10 ? { lv: 3 } : null])],
    ["f", "Shoes", [["Sneakers", null], ["High-tops", null], ["Boots", null], ["Slides", null], ["Rocket kicks", { xp: 400 }]]],
    ["w", "Shoe color", COLORS.map(([, n], i) => [n, i === 10 ? { lv: 3 } : null])],
    ["a", "Hat", [["None", null], ["Cap", null], ["Beanie", null], ["Bucket hat", null], ["Headband", null], ["Headphones", { xp: 300 }], ["Crown", { badge: "lock5" }], ["Grad cap", { lv: 2 }]]],
    ["k", "Hat color", COLORS.map(([, n], i) => [n, i === 10 ? { lv: 3 } : null])],
    ["g", "Glasses", [["None", null], ["Shades", null], ["Round", null], ["Visor", { xp: 200 }], ["Star shades", { badge: "steady" }], ["Goggles", { xp: 500 }]]],
    ["x", "Back", [["None", null], ["Backpack", null], ["Cape", { lv: 2 }], ["Rocket pack", { xp: 600 }], ["Anchor wings", { badge: "eq" }]]],
];
const PART = Object.fromEntries(PARTS.map((p) => [p[0], p]));
const KEYS = PARTS.map((p) => p[0]);
export const BADGE_NAMES = { lock5: "Lock Master", steady: "Steady Hand", eq: "Equation Breaker", lock1: "First Lock", comeback: "Comeback Crew", team: "Team Anchor" };

/** What it takes to earn a piece, in words ("300 XP", "Level 2", "Steady Hand badge"), or "" when it's open. */
export const needText = (need) => (!need ? "" : need.xp ? need.xp + " XP" : need.lv ? "Level " + need.lv : need.badge ? (BADGE_NAMES[need.badge] || "a badge") + " badge" : "");
/** Has this student earned a piece? me: { xp, lv, b: [badge keys] }. */
export const earned = (need, me) => !need || (!!me && ((need.xp && (+me.xp || 0) >= need.xp) || (need.lv && (+me.lv || 0) >= need.lv) || (need.badge && (me.b || []).includes(need.badge))));

/** The starting look: a random one from the open pieces, so no two kids start the same. rand: () => 0..1. */
export function randomLook(rand = Math.random) {
    const o = {};
    PARTS.forEach(([k, , list]) => { const open = list.map((x, i) => (x[1] ? -1 : i)).filter((i) => i >= 0); o[k] = open[Math.floor(rand() * open.length)]; });
    o.a = rand() < 0.5 ? 0 : o.a; o.g = rand() < 0.7 ? 0 : o.g; o.x = rand() < 0.6 ? 0 : o.x;   // most start plain
    return o;
}
/** A starting look picked from a name, so the same kid gets the same one until they dress it up themselves. */
export function seedLook(seed) {
    let h = 2166136261; for (const ch of String(seed || "")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const rand = () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x6D2B79F5) >>> 0; return (h % 10000) / 10000; };
    return stringify(randomLook(rand));
}
/** Read a look string ("s2h1…") into { s: 2, h: 1, … }. Unknown or out-of-range parts become 0. */
export function parse(str) {
    const o = {}; KEYS.forEach((k) => { o[k] = 0; });
    const s = String(str || "");
    for (let i = 0; i + 1 < s.length; i += 2) {
        const k = s[i], v = parseInt(s[i + 1], 36);
        if (PART[k] && Number.isInteger(v) && v >= 0 && v < PART[k][2].length) o[k] = v;
    }
    return o;
}
export const stringify = (o) => KEYS.map((k) => k + Math.max(0, Math.floor(+o[k] || 0)).toString(36).slice(0, 1)).join("");
export const validLook = (str) => typeof str === "string" && str.length <= 40 && /^([a-z][0-9a-z])*$/.test(str);
/** A look with every piece the student hasn't earned swapped back to an open one. Used by the Remote before it accepts a look. */
export function cleanLook(str, me) {
    const o = parse(str);
    KEYS.forEach((k) => { const it = PART[k][2][o[k]]; if (!it || !earned(it[1], me)) o[k] = 0; });
    return stringify(o);
}

const col = (i) => (COLORS[i] || COLORS[0])[0];

/* ---------- 3D math (the same approach as the Southbound exercise figure) ---------- */
const D2R = Math.PI / 180, TAU = 2 * Math.PI;
const rx = (a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const ry = (a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const rz = (a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const app = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (v) => Math.hypot(v[0], v[1], v[2]);
const norm3 = (v) => { const l = len3(v) || 1; return scale(v, 1 / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rot = ([x = 0, y = 0, z = 0] = []) => mul(rz(z), mul(ry(y), rx(x)));
const along = (a, b, t) => add(a, scale(sub(b, a), t));
const tr3 = (M) => [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
const cols = (X, Y, Z) => [[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]];
const IDENT = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const f1 = (n) => Math.round(n * 10) / 10;
/** A number with one decimal, as text: the same as f1 but built from whole numbers, which is quicker in paths. */
const n1 = (n) => { const i = Math.round(n * 10), a = i < 0 ? -i : i, w = (a / 10) | 0, r = a - w * 10; return (i < 0 ? "-" : "") + w + (r ? "." + r : ""); };
const f3 = (n) => Math.round(n * 1000) / 1000;
const smooth = (u) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
/** A frame (columns: side, along y, front) from a direction and a hint for the front. */
function frameFrom(y, zHint) {
    const Y = norm3(y);
    let Z = sub(zHint, scale(Y, dot(zHint, Y)));
    if (len3(Z) < 1e-4) Z = Math.abs(Y[2]) < 0.9 ? sub([0, 0, 1], scale(Y, Y[2])) : sub([1, 0, 0], scale(Y, Y[0]));
    Z = norm3(Z);
    return cols(cross(Y, Z), Y, Z);
}

/* ---------- the skeleton ----------
   Units are about a centimetre; the kid stands about 100 tall, a big round head on a small body (a chibi build).
   Joint angles are degrees [x, y, z] in the parent's frame: x negative swings a limb forward, z sideways
   (positive toward the kid's left, +x). The kid faces +z. Legs are solved from where the feet are
   (two-bone IK), so feet stay planted while the hips sway, dip and jump. */
export const BONES = { hip: 37.3, spine: 21, neck: 3.4, head: 16.6, r: 19.5, shX: 9.6, shY: -3.4, upper: 11.4, fore: 10.4, hipX: 4.6, hipY: -2.4, thigh: 15.8, shin: 15.4 };
export const REST = Object.freeze({
    root: [0, 0, 0], pos: [0, 0, 0], spine: [0, 0, 0], neck: [0, 0, 0], shr: 0,
    lSh: [-4, 0, 10], lEl: [-18, 0, 0], rSh: [-4, 0, -10], rEl: [-18, 0, 0],
    lFt: [5.1, 4.2, 0.4], rFt: [-5.1, 4.2, 0.4], lToe: 0, rToe: 0, sq: 0,
});
export function skeleton(pose) {
    const p = Object.assign({}, REST, pose), B = BONES;
    const R0 = rot(p.root), S = mul(R0, rot(p.spine));
    const pelvis = [p.pos[0], B.hip + p.pos[1], p.pos[2]];
    const chest = add(pelvis, app(S, [0, B.spine, 0]));
    const N = mul(S, rot(p.neck));
    const neckTop = add(chest, app(N, [0, B.neck, 0]));
    const head = add(neckTop, app(N, [0, B.head, 1.2]));
    const P = { pelvis, chest, neckTop, head }, F = { root: R0, spine: S, head: N };
    const fwd = app(R0, [0, 0, 1]);
    for (const [s, sx] of [["l", 1], ["r", -1]]) {
        const sh = add(chest, app(S, [sx * B.shX, B.shY + p.shr, -0.4]));
        const U = mul(S, rot(p[s + "Sh"])), el = add(sh, app(U, [0, -B.upper, 0]));
        const Fo = mul(U, rot(p[s + "El"])), wr = add(el, app(Fo, [0, -B.fore, 0]));
        const hp = add(pelvis, app(R0, [sx * B.hipX, B.hipY, 0]));
        const T = p[s + "Ft"], v = sub(T, hp), u = norm3(v);
        const d = Math.min(Math.max(len3(v), 4), B.thigh + B.shin - 0.05);
        const a = (B.thigh * B.thigh - B.shin * B.shin + d * d) / (2 * d), h = Math.sqrt(Math.max(0, B.thigh * B.thigh - a * a));
        let f = sub(fwd, scale(u, dot(fwd, u))); f = len3(f) < 1e-3 ? [0, 0, 1] : norm3(f);
        const kn = add(hp, add(scale(u, a), scale(f, h))), an = add(hp, scale(u, d));
        const yaw = Math.atan2(fwd[0], fwd[2]) / D2R + sx * 7;
        const Ft = mul(ry(yaw), rx(p[s + "Toe"]));
        Object.assign(P, { [s + "Sh"]: sh, [s + "El"]: el, [s + "Wr"]: wr, [s + "Hd"]: add(wr, app(Fo, [0, -5.4, 0.5])), [s + "Hp"]: hp, [s + "Kn"]: kn, [s + "An"]: an,
            [s + "Heel"]: add(an, app(Ft, [0, -2.6, -3.6])), [s + "Toe"]: add(an, app(Ft, [0, -2.3, 9.6])) });
        Object.assign(F, { [s + "Up"]: U, [s + "Fo"]: Fo, [s + "Th"]: frameFrom(sub(hp, kn), fwd), [s + "Sn"]: frameFrom(sub(kn, an), fwd), [s + "Ft"]: Ft });
    }
    return { P, F, p };
}

/* ---------- moves: eased key poses, plus a little life on top ---------- */
const EASE = { io: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2), out: (u) => 1 - (1 - u) * (1 - u), in: (u) => u * u };
const POSE_KEYS = Object.keys(REST);
const fullPose = (p) => Object.assign({}, REST, p);
function lerpPose(a, b, u) {
    const o = {};
    POSE_KEYS.forEach((k) => { const x = a[k], y = b[k]; o[k] = Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * u) : x + (y - x) * u; });
    return o;
}
function addPose(a, d, w = 1) {
    Object.keys(d).forEach((k) => { if (!(k in a)) return; a[k] = Array.isArray(a[k]) ? a[k].map((v, i) => v + (d[k][i] || 0) * w) : a[k] + d[k] * w; });
    return a;
}
function keysAt(keys, t) {
    if (t <= keys[0][0]) return fullPose(keys[0][1]);
    for (let i = 0; i < keys.length - 1; i++) {
        const [ta, pa] = keys[i], [tb, pb, e] = keys[i + 1];
        if (t <= tb) return lerpPose(fullPose(pa), fullPose(pb), EASE[e || "io"]((t - ta) / Math.max(1e-6, tb - ta)));
    }
    return fullPose(keys[keys.length - 1][1]);
}
const env = (t, a, b, c, d) => (t < a || t > d ? 0 : t < b ? smooth((t - a) / (b - a)) : t > c ? 1 - smooth((t - c) / (d - c)) : 1);
// Arms up go wide, in a V with the shoulders lifted: with a big cartoon head, straight up only reaches the ears and reads
// as hands on the head. The waving hand stays out to the side, clear of the face and any hat brim.
const ARMS_UP = { shr: 1.6, lSh: [-14, 0, 128], rSh: [-14, 0, -128], lEl: [-10, 0, -6], rEl: [-10, 0, 6] };
const WAVING = { shr: 0.8, lSh: [-14, 0, 102], lEl: [-10, 0, 60], neck: [0, 9, 7], spine: [-2, 6, 3] };
const SHRUG = { shr: 2.4, lSh: [-16, 0, 24], rSh: [-16, 0, -24], lEl: [-72, 0, 50], rEl: [-72, 0, -50], spine: [-4, 0, 0], neck: [6, -10, 12], pos: [0, 0.4, 0] };
const FEET = (y, toe) => ({ lFt: [5.1, y, 0.4], rFt: [-5.1, y, 0.4], lToe: toe, rToe: toe });
/** Each move: seconds, the frame to show when motion is off (peak), key poses, extra motion on top, and the face. */
export const MOVES = {
    wave: { dur: 2.2, peak: 0.95, keys: [[0, {}], [0.34, WAVING], [1.72, WAVING], [2.2, {}]],
        add: (t) => ({ lEl: [0, 0, 26 * Math.sin((2 * Math.PI * (t - 0.34)) / 0.5) * env(t, 0.28, 0.42, 1.55, 1.75)] }),
        face: (t) => (t > 0.15 && t < 2.05 ? { mouth: 1, brow: 0.6 } : null) },
    dance: { dur: 2.4, peak: 0.3, keys: [[0, {}], [2.4, {}]],
        add: (t) => {
            const w = env(t, 0, 0.25, 2.15, 2.4), s = Math.sin((2 * Math.PI * t) / 1.2), dip = (1 - Math.cos((2 * Math.PI * t) / 0.6)) / 2;
            return { pos: [2.6 * s * w, -1.9 * dip * w, 0], root: [0, 12 * s * w, -4 * s * w], spine: [-3 * w, -5 * s * w, 5 * s * w], neck: [3 * Math.cos((4 * Math.PI * t) / 1.2) * w, -7 * s * w, -8 * s * w],
                lSh: [(-24 - 30 * s) * w, 0, (22 + 16 * s) * w], rSh: [(-24 + 30 * s) * w, 0, (-22 + 16 * s) * w], lEl: [-64 * w, 0, 18 * s * w], rEl: [-64 * w, 0, 18 * s * w],
                lFt: [0, 1.4 * Math.max(0, s) * w, 0], rFt: [0, 1.4 * Math.max(0, -s) * w, 0], lToe: 16 * Math.max(0, s) * w, rToe: 16 * Math.max(0, -s) * w, sq: -0.025 * dip * w };
        },
        face: (t) => (t > 0.1 && t < 2.3 ? { mouth: 1, eyes: Math.abs(Math.sin((2 * Math.PI * t) / 1.2)) > 0.92 ? 1 : -1, brow: 0.5 } : null) },
    cheer: { dur: 1.95, peak: 0.46, keys: [
        [0, {}],
        [0.22, { pos: [0, -5, 0], spine: [14, 0, 0], neck: [-6, 0, 0], lSh: [24, 0, 14], rSh: [24, 0, -14], lEl: [-28, 0, 0], rEl: [-28, 0, 0], sq: -0.07 }],
        [0.46, { pos: [0, 10, 0], ...FEET(12.2, 34), spine: [-6, 0, 0], neck: [-10, 0, 0], ...ARMS_UP, sq: 0.07 }, "out"],
        [0.66, { pos: [0, -3.6, 0], spine: [8, 0, 0], ...ARMS_UP, sq: -0.08 }, "in"],
        [0.84, { ...ARMS_UP }],
        [1.04, { pos: [0, 5, 0], ...FEET(8.2, 24), ...ARMS_UP, neck: [-6, 0, 0], sq: 0.04 }, "out"],
        [1.22, { pos: [0, -2.4, 0], ...ARMS_UP, sq: -0.05 }, "in"],
        [1.5, { ...ARMS_UP }],
        [1.95, {}]],
        add: (t) => { const w = env(t, 0.5, 0.6, 1.4, 1.5), s = Math.sin((2 * Math.PI * t) / 0.36); return { lSh: [0, 0, 9 * s * w], rSh: [0, 0, 9 * s * w] }; },
        face: (t) => (t > 0.12 && t < 1.8 ? { mouth: 1, eyes: t > 0.3 && t < 1.35 ? 1 : -1, brow: 1 } : null) },
    hop: { dur: 0.62, peak: 0.3, keys: [[0, {}], [0.12, { pos: [0, -2.4, 0], spine: [6, 0, 0], sq: -0.06 }], [0.3, { pos: [0, 3.8, 0], ...FEET(7.6, 12), lSh: [-4, 0, 34], rSh: [-4, 0, -34], sq: 0.05 }, "out"], [0.47, { pos: [0, -1.2, 0], sq: -0.04 }, "in"], [0.62, {}]],
        face: (t) => (t < 0.56 ? { mouth: 1, eyes: 1 } : null) },
    oops: { dur: 1.7, peak: 0.6, keys: [[0, {}], [0.3, SHRUG], [1.15, SHRUG], [1.7, {}]],
        face: (t) => (t > 0.12 && t < 1.5 ? { mouth: 2, brow: 0.9, worried: 1, look: [-0.5, -0.4] } : null) },
};
const idleDelta = (t) => {
    const br = Math.sin((2 * Math.PI * t) / 3.4), lk = Math.sin((2 * Math.PI * t) / 7.3), tl = Math.sin((2 * Math.PI * t) / 5.1 + 1), sw = Math.sin((2 * Math.PI * t) / 6.3);
    return { spine: [1.3 * br, 0, 1.5 * sw], pos: [0.6 * sw, 0.3 * br, 0], root: [0, 0, -1.3 * sw], neck: [-1.2 * br, 9 * lk, 3 * tl - 1 * sw],
        lSh: [0, 0, 2.2 * br], rSh: [0, 0, -2.2 * br], lEl: [-3 * br, 0, 0], rEl: [-3 * br, 0, 0] };
};
const blinkAt = (t) => {
    const c = 3.7, ph = t % c, b = ph < 0.14 ? Math.sin((Math.PI * ph) / 0.14) : 0;
    return Math.floor(t / c) % 3 === 2 && ph > 0.24 && ph < 0.38 ? Math.sin((Math.PI * (ph - 0.24)) / 0.14) : b;
};
/** The pose (with the face) for a move at mt seconds, on top of being alive for t seconds. move "" is just standing. */
export function poseAt(move, mt, t = 0) {
    const m = MOVES[move];
    const P = m ? keysAt(m.keys, mt) : fullPose({});
    if (m && m.add) addPose(P, m.add(mt));
    addPose(P, idleDelta(t), m ? 0.35 : 1);
    const lk = Math.sin((2 * Math.PI * t) / 7.3 + 0.5);
    const face = Object.assign({ blink: blinkAt(t), mouth: -1, eyes: -1, brow: 0, worried: 0, look: [0.45 * lk, 0] }, (m && m.face && m.face(mt)) || {});
    return Object.assign(P, face, { t });
}

/* ---------- drawing: shaded parts, painted far to near ---------- */
const INK = [27, 34, 56];
const hexRgb = (h) => { const n = parseInt(String(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lite = (c, a) => c.map((v) => v + (255 - v) * a);
const dk = (c, k) => c.map((v) => v * k);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, k = 1) => "rgb(" + c.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))).join(",") + ")";
const stops = (c, k, hi = 0.2) => [[0, lite(c, hi)], [0.42, c], [0.62, dk(c, 0.86)], [1, dk(c, 0.7)]].map(([o, v]) => `<stop offset="${o}" stop-color="${rgb(v, k)}"/>`).join("");
const sp = (C, p) => { const q = app(C.M, p); return { x: q[0], y: -q[1], z: q[2] }; };
const pt = (q) => n1(q.x) + " " + n1(q.y);
const lineOf = (c, k = 1) => rgb(dk(c, 0.42), k);
/** A part to paint: its shape (an SVG tag left open), its fill, outline color and depth.
 *  line 0: no outline; 1: one outline shared with its group (no seams inside a leg or an arm); 2: its own outline too. */
const part = (z, tag, fill, oc, line = 1, zb = 0, d = "") => ({ z, zb, tag, fill, oc, d, line: line === true ? 1 : line || 0 });
const strokeOf = (p, w) => ` stroke="${p.oc}" stroke-width="${f3(w)}" stroke-linejoin="round"`;
const solo = (C, p) => (p.tag ? `${p.tag} fill="${p.fill}"${p.line && C.sw ? strokeOf(p, C.sw) : ""}/>` : p.svg);
/** Parts that read as one piece (a leg, an arm, the hair): every outline first, then every fill, so only the outside shows a line.
 *  The outlines are strokes only (each fill covers the inside of its own stroke), sent as one path per outline color. */
function merged(C, list) {
    list.sort((a, b) => a.z - b.z);
    let s = "";
    if (C.sw) {
        const byColor = new Map();
        for (const p of list) if (p.tag && p.line && p.d) byColor.set(p.oc, (byColor.get(p.oc) || "") + p.d);
        byColor.forEach((d, oc) => { s += `<path d="${d}" fill="none" stroke="${oc}" stroke-width="${f3(C.sw * 2)}" stroke-linejoin="round"/>`; });
    }
    for (const p of list) s += p.tag ? `${p.tag} fill="${p.fill}"${p.line === 2 && C.sw ? strokeOf(p, C.sw) : ""}/>` : p.svg;
    return s;
}
/* Shading colors live in a palette that outlasts a frame. A part's gradient only says where its light falls and points at
   a palette entry for the colors, so a moving character doesn't re-send its colors every frame. Depth shading (far limbs a
   little darker) goes in steps of 2%, too small to see, so the palette stays small. */
export const newPalette = (pre) => ({ pre, map: new Map(), n: 0, add: [] });
function shade(C, c, k, hi) {
    const kq = Math.round(k * 50) / 50, key = c.join() + "|" + kq + "|" + hi;
    let id = C.pal.map.get(key);
    if (!id) { id = C.pal.pre + "p" + C.pal.n++; C.pal.map.set(key, id); C.pal.add.push(`<linearGradient id="${id}">${stops(c, kq, hi)}</linearGradient>`); }
    return id;
}
function sample(prof, t) {
    const z = { ox: 0, oy: 0, oz: 0 };
    if (t <= prof[0].t) return Object.assign(z, prof[0]);
    for (let i = 0; i < prof.length - 1; i++) {
        const a = prof[i], b = prof[i + 1];
        if (t <= b.t) {
            const u = smooth((t - a.t) / Math.max(1e-6, b.t - a.t)), m = (k) => (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * u;
            return { w: m("w"), d: m("d"), ox: m("ox"), oy: m("oy"), oz: m("oz") };
        }
    }
    return Object.assign(z, prof[prof.length - 1]);
}
/** A rounded part swept from a to b: each sample has a width (side to side) and a depth (front to back), so it looks right from any angle. */
function sweep(C, { a, b, fr = IDENT, prof, c, k = 1, z = 0, steps = 6, cap = "round", cap0, cap1, line = 1, hi = 0.2 }) {
    const X = app(fr, [1, 0, 0]), Y = app(fr, [0, 1, 0]), Z = app(fr, [0, 0, 1]), u0 = norm3(sub(b, a));
    const flat = (v, ...g) => { let w = v; for (const q of g) w = sub(w, scale(q, dot(w, q))); return w; };
    let XS = flat(X, u0); if (len3(XS) < 0.35) XS = flat(Y, u0); XS = norm3(XS);
    let ZS = flat(Z, u0, XS); if (len3(ZS) < 0.35) ZS = flat(Y, u0, XS); ZS = norm3(ZS);
    const ex = sp(C, XS), ez = sp(C, ZS), pa = sp(C, a), pb = sp(C, b);
    let dx = pb.x - pa.x, dy = pb.y - pa.y; const sl = Math.hypot(dx, dy);
    if (sl < 1e-3) { dx = 0; dy = 1; } else { dx /= sl; dy /= sl; }
    const nx = -dy, ny = dx, L = [], R = [], H = [];
    let zs = 0;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps, s = sample(prof, t);
        const q = sp(C, add(along(a, b, t), add(scale(X, s.ox), add(scale(Y, s.oy), scale(Z, s.oz)))));
        const hw = Math.hypot(s.w * (ex.x * nx + ex.y * ny), s.d * (ez.x * nx + ez.y * ny));
        L.push([q.x + nx * hw, q.y + ny * hw]); R.push([q.x - nx * hw, q.y - ny * hw]); H.push(hw); zs += q.z;
    }
    const n = steps, fk = Math.abs(app(C.M, u0)[2]);
    const b0 = 1.33 * H[0] * ((cap0 || cap) === "flat" ? fk : 1), bN = 1.33 * H[n] * ((cap1 || cap) === "flat" ? fk : 1);
    const P = (v) => n1(v[0]) + " " + n1(v[1]);
    let d = "M" + P(L[0]);
    for (let i = 1; i <= n; i++) d += "L" + P(L[i]);
    d += "C" + P([L[n][0] + dx * bN, L[n][1] + dy * bN]) + " " + P([R[n][0] + dx * bN, R[n][1] + dy * bN]) + " " + P(R[n]);
    for (let i = n - 1; i >= 0; i--) d += "L" + P(R[i]);
    d += "C" + P([R[0][0] - dx * b0, R[0][1] - dy * b0]) + " " + P([L[0][0] - dx * b0, L[0][1] - dy * b0]) + " " + P(L[0]) + "Z";
    const mid = sp(C, along(a, b, 0.5)), r = Math.max(...H, 0.5), sg = nx * -0.55 + ny * -0.83 > 0 ? 1 : -1, id = C.id + "g" + C.gid++;
    C.defs.push(`<linearGradient id="${id}" href="#${shade(C, c, k, hi)}" gradientUnits="userSpaceOnUse" x1="${f1(mid.x + nx * r * sg)}" y1="${f1(mid.y + ny * r * sg)}" x2="${f1(mid.x - nx * r * sg)}" y2="${f1(mid.y - ny * r * sg)}"/>`);
    return part(zs / (n + 1) + z, `<path d="${d}"`, `url(#${id})`, lineOf(c, k), line, z, d);
}
function radial(C, x, y, r, c, k, hi = 0.26) {
    const id = C.id + "g" + C.gid++;
    C.defs.push(`<radialGradient id="${id}" href="#${shade(C, c, k, hi)}" gradientUnits="userSpaceOnUse" cx="${f1(x - r * 0.38)}" cy="${f1(y - r * 0.46)}" r="${f1(r * 1.55)}"/>`);
    return id;
}
/** A ball: a joint, a curl, a bun, the nose. */
function ball(C, c3, r, c, k = 1, z = 0, line = 1) {
    const q = sp(C, c3), x = f1(q.x), y = f1(q.y), R = f1(r);
    return part(q.z + z, `<circle cx="${x}" cy="${y}" r="${R}"`, `url(#${radial(C, q.x, q.y, r, c, k)})`, lineOf(c, k), line, z, `M${f1(x - R)} ${y}a${R} ${R} 0 1 0 ${f1(2 * R)} 0a${R} ${R} 0 1 0 ${f1(-2 * R)} 0Z`);
}
/** A flat shape through 3D points (a cape, a wing, a hat brim). */
function poly(C, pts3, c, k = 1, z = 0, line = 1) {
    const q = pts3.map((p) => sp(C, p));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, zs = 0;
    q.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); zs += p.z; });
    const id = C.id + "g" + C.gid++;
    C.defs.push(`<linearGradient id="${id}" href="#${shade(C, c, k, 0.16)}" gradientUnits="userSpaceOnUse" x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}"/>`);
    const d = `M${q.map(pt).join("L")}Z`;
    return part(zs / q.length + z, `<path d="${d}"`, `url(#${id})`, lineOf(c, k), line, z, d);
}
/** A line through 3D points (a collar, a hem, a strap edge): a stroke with no fill. */
function strand(C, pts3, c, w, z = 0) {
    if (pts3.length < 2) return null;
    const q = pts3.map((p) => sp(C, p));
    return { z: q.reduce((s, p) => s + p.z, 0) / q.length + z, svg: `<path d="M${q.map(pt).join("L")}" stroke="${c}" stroke-width="${f3(w)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` };
}
/** Something printed on a surface (an eye, a mouth, a shirt number): drawn flat in its own units, turned and squashed with the surface. */
function decal(C, p3, tx, ty, inner, { nrm, min = 0.1, z = 0, fade = true } = {}) {
    const n = sp(C, nrm); if (n.z < min) return null;
    const a = sp(C, tx), b = sp(C, ty), q = sp(C, p3), op = fade ? Math.min(1, (n.z - min) * 5) : 1;
    return { z: q.z + z, svg: `<g transform="matrix(${f3(a.x)} ${f3(a.y)} ${f3(b.x)} ${f3(b.y)} ${f1(q.x)} ${f1(q.y)})"${op < 1 ? ` opacity="${f3(op)}"` : ""}>${inner}</g>` };
}
/** A point on a ball's surface with its outward normal and the surface's right and down directions. */
function onBall(ctr, N, r, lx, ly, lift = 0) {
    const dir = norm3([lx, ly, Math.sqrt(Math.max(0, r * r - lx * lx - ly * ly))]), nrm = app(N, dir);
    const flat = (v) => norm3(sub(v, scale(nrm, dot(v, nrm))));
    return { p: add(ctr, scale(nrm, r + lift)), nrm, tx: flat(app(N, [1, 0, 0])), ty: flat(app(N, [0, -1, 0])) };
}
/**
 * The visible part of a region on a ball (hair on a head, a hat's crown, a band): the region is every direction
 * within the angle th(phi) of the axis n (in the ball's frame N), phi going round from the front toward the kid's left.
 * Walks the region's edge, keeps the runs that face the camera and joins them along the ball's outline.
 * Returns SVG path data (a ring uses evenodd), or "" when none of it shows.
 */
function regionPath(C, ctr, N, rad, n, th) {
    const cs = sp(C, ctr), V = mul(C.M, N), VT = tr3(V), n0 = norm3(n);
    let f0 = sub([0, 0, 1], scale(n0, n0[2])); f0 = len3(f0) < 1e-3 ? [1, 0, 0] : norm3(f0);
    const g0 = cross(n0, f0), K = 96, Q = [];
    for (let i = 0; i < K; i++) {
        const ph = (TAU * i) / K, t = th(ph);
        Q.push(app(V, add(scale(n0, Math.cos(t)), scale(add(scale(f0, Math.cos(ph)), scale(g0, Math.sin(ph))), Math.sin(t)))));
    }
    const inside = (q) => {
        const d = app(VT, q), a = Math.acos(Math.max(-1, Math.min(1, dot(d, n0))));
        let ph = Math.atan2(dot(d, g0), dot(d, f0)); if (ph < 0) ph += TAU;
        return a <= th(ph);
    };
    const S = (q) => n1(cs.x + rad * q[0]) + " " + n1(cs.y - rad * q[1]);
    const disc = `M${f1(cs.x - rad)} ${f1(cs.y)}a${f1(rad)} ${f1(rad)} 0 1 0 ${f1(2 * rad)} 0a${f1(rad)} ${f1(rad)} 0 1 0 ${f1(-2 * rad)} 0Z`;
    const vis = Q.map((q) => q[2] >= 0), nv = vis.filter(Boolean).length;
    if (!nv) return inside([0, 0, 1]) ? disc : "";
    if (nv === K) { const ring = "M" + Q.map(S).join("L") + "Z"; return inside([1, 0, 0]) ? disc + ring : ring; }
    const cut = (a, b) => { const p = add(a, scale(sub(b, a), a[2] / (a[2] - b[2]))), l = Math.hypot(p[0], p[1]) || 1; return [p[0] / l, p[1] / l, 0]; };
    const runs = [];
    for (let i = 0; i < K; i++) {
        if (!vis[i] || vis[(i - 1 + K) % K]) continue;
        const pts = []; let j = i;
        while (vis[j % K] && pts.length < K) pts.push(Q[j++ % K]);
        const A = cut(Q[(i - 1 + K) % K], Q[i]), B = cut(Q[(j - 1) % K], Q[j % K]);
        runs.push({ pts, A, B, aA: Math.atan2(A[1], A[0]), aB: Math.atan2(B[1], B[0]), used: false });
    }
    let d = "";
    for (const r0 of runs) {
        if (r0.used) continue;
        const loop = []; let r = r0;
        for (let guard = 0; r && !r.used && guard < 48; guard++) {
            r.used = true; loop.push(r.A, ...r.pts, r.B);
            const sg = inside([Math.cos(r.aB + 0.03), Math.sin(r.aB + 0.03), 0]) ? 1 : -1;
            let best = null, bd = Infinity;
            for (const q of runs) { const D = ((((q.aA - r.aB) * sg) % TAU) + TAU) % TAU; if (D < bd) { bd = D; best = q; } }
            const steps = Math.ceil(bd / 0.12);
            for (let j = 1; j < steps; j++) { const f = r.aB + (sg * bd * j) / steps; loop.push([Math.cos(f), Math.sin(f), 0]); }
            r = best;
        }
        d += "M" + loop.map(S).join("L") + "Z";
    }
    return d;
}
const flatTh = (d) => { const a = Math.acos(Math.max(-1, Math.min(1, d))); return () => a; };
function region(C, ctr, N, rad, n, th, c, z, line = 1, hi = 0.22) {
    const d = regionPath(C, ctr, N, rad, n, th); if (!d) return null;
    const q = sp(C, ctr);
    return part(z, `<path d="${d}" fill-rule="evenodd"`, `url(#${radial(C, q.x, q.y, rad, c, 1, hi)})`, lineOf(c), line, 0, d);
}
/** A band round a ball between two parallel planes (a beanie's cuff, a headband). */
function zone(C, ctr, N, rad, n, d1, d2, c, z, line = 1) {
    const a = regionPath(C, ctr, N, rad, n, flatTh(d1)); if (!a) return null;
    const b = regionPath(C, ctr, N, rad, n, flatTh(d2)), q = sp(C, ctr);
    return part(z, `<path d="${a}${b}" fill-rule="evenodd"`, `url(#${radial(C, q.x, q.y, rad, c, 1, 0.2)})`, lineOf(c), line, 0, a + b);
}

/* ---------- the face ---------- */
function eyeSvg(type, blink, lx, ly, wink) {
    if (wink || type === 1) return `<path d="M-2.7 .9q2.7-3.5 5.4 0" stroke="${rgb(INK)}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    if (blink > 0.72) return `<path d="M-2.6 .4q2.6 1.4 5.2 0" stroke="${rgb(INK)}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    const big = type === 2, rxe = big ? 2.85 : type === 4 ? 2.3 : 2.55, rye = (big ? 3.55 : type === 4 ? 2.7 : 3.25) * (1 - blink * 0.85);
    let s = `<ellipse cx="${f1(lx)}" cy="${f1(ly)}" rx="${rxe}" ry="${f1(rye)}" fill="${rgb(INK)}"/>`;
    if (type === 3) s = `<path d="M${f1(lx - 2.6)} ${f1(ly - 0.3)}h5.2a2.6 2.7 0 0 1-5.2 0z" fill="${rgb(INK)}"/>`;
    if (blink < 0.5) s += `<circle cx="${f1(lx + 0.9)}" cy="${f1(ly - (type === 3 ? -0.6 : 1.15))}" r="${big ? 1.2 : 0.95}" fill="#fff"/>` + (type === 3 ? "" : `<circle cx="${f1(lx - 0.8)}" cy="${f1(ly + 1.05)}" r="${big ? 0.62 : 0.45}" fill="#fff"/>`);
    if (big && blink < 0.5) s += `<path d="M${f1(lx + 1.7)} ${f1(ly - 2.8)}l.35.85.85.35-.85.35-.35.85-.35-.85-.85-.35.85-.35z" fill="#fff"/>`;
    if (type === 4) s += `<path d="M${f1(lx - 2.6)} ${f1(ly - 2.6)}l5.2 1" stroke="${rgb(INK)}" stroke-width=".9" stroke-linecap="round"/>`;
    return s;
}
const MOUTHS = [
    `<path d="M-3.2-.5q3.2 3.3 6.4 0" stroke="#1B2238" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
    `<path d="M-3.7-.9q3.7 6.2 7.4 0z" fill="#1B2238"/><path d="M-3.1-.7h6.2l-.5 1.1h-5.2z" fill="#fff"/><ellipse cx=".3" cy="2.7" rx="1.75" ry=".9" fill="#E85A71"/>`,
    `<ellipse cx="0" cy=".6" rx="1.6" ry="2" fill="#1B2238"/><ellipse cx=".2" cy="1.75" rx=".9" ry=".5" fill="#E85A71"/>`,
    `<path d="M-2.5.7q3.1 1.8 5.5-1.6" stroke="#1B2238" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
    `<path d="M-3.2-.5q3.2 3.3 6.4 0" stroke="#1B2238" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M.3 1q1.45 3.3 2.9.2z" fill="#E85A71"/>`,
];

/* ---------- hair, hats and glasses (in the head's own frame: x the kid's left, y up, z front) ----------
   Hair on the head is a region of a slightly bigger ball: round the axis n, out to an angle that changes as it goes
   round (th: [degrees round from the front, degrees from the axis], mirrored left/right; asym: both sides given).
   fringe / zig / curl add bangs, points or curls along the edge. */
const HAIR = [
    { n: [0, 1, -0.5], th: [[0, 82], [56, 84], [70, 88], [79, 99], [87, 99], [94, 80], [118, 86], [150, 98], [180, 104]], fringe: [62, 4, 6], lift: 1.6 },    // short
    { n: [0, 1, -0.55], th: [[0, 80], [58, 82], [74, 90], [86, 94], [94, 80], [130, 90], [180, 100]], zig: [58, 6, 9], lift: 1.2, spikes: 1 },           // spiky
    { n: [0, 1, -0.45], th: [[0, 84], [70, 88], [96, 86], [180, 104]], curl: [16, 5], lift: 1.6, curls: 1 },                                             // curly
    { n: [0, 1, -0.3], th: [[0, 70], [14, 84], [45, 92], [78, 114], [120, 120], [180, 122]], lift: 1.4, long: 1, noEars: 1, part: 1 },                    // long
    { n: [0, 1, -0.5], th: [[0, 76], [60, 80], [94, 80], [140, 92], [180, 98]], lift: 1, buns: 1 },                                                      // buns
    { n: [0, 1, -0.55], th: [[0, 83], [80, 87], [94, 81], [180, 100]], lift: 0.35, buzz: 1 },                                                           // buzz
    { n: [0, 1, -0.35], th: [[0, 72], [14, 82], [60, 84], [94, 82], [180, 98]], lift: 1.2, puffs: 1, part: 1 },                                           // puffs
    { n: [0, 1, -0.55], th: [[0, 80], [58, 82], [74, 90], [86, 94], [94, 80], [130, 90], [180, 100]], lift: 1.6, lock: { n: [0, 1, -0.3], asym: [[-180, 58], [-70, 60], [-20, 70], [12, 88], [38, 104], [58, 112], [74, 100], [96, 64], [180, 58]], lift: 1 } },   // swoop
    { n: [0, 1, -0.45], th: [[0, 72], [14, 84], [60, 86], [94, 84], [180, 100]], lift: 1, braids: 1, part: 1 },                                           // braids
    null,                                                                                                                                              // none
];
const table = (rows) => (x) => {
    if (x <= rows[0][0]) return rows[0][1];
    for (let i = 1; i < rows.length; i++) if (x <= rows[i][0]) { const [x0, y0] = rows[i - 1], [x1, y1] = rows[i]; return y0 + (y1 - y0) * smooth((x - x0) / (x1 - x0)); }
    return rows[rows.length - 1][1];
};
function hairTh(st) {
    const sym = st.th && table(st.th), asym = st.asym && table(st.asym);
    return (ph) => {
        let d = ph / D2R; if (d > 180) d -= 360;
        let t = asym ? asym(d) : sym(Math.abs(d));
        if (st.fringe) { const [w, k, A] = st.fringe; if (Math.abs(d) < w) t += A * Math.abs(Math.sin((Math.PI * (d + w) * k) / (2 * w))); }
        if (st.zig) { const [w, k, A] = st.zig; if (Math.abs(d) < w) { const u = ((d + w) * k) / (2 * w); t += A * (1 - Math.abs(2 * (u - Math.floor(u)) - 1)); } }
        if (st.curl) { const [p, A] = st.curl; t += A * Math.abs(Math.sin((Math.PI * d) / p)); }
        return t * D2R;
    };
}
const SPIKES = [[0, 1, 0.3, 8.5], [-0.45, 0.88, 0.15, 7.5], [0.45, 0.88, 0.15, 7.5], [-0.2, 0.92, -0.35, 8], [0.25, 0.9, -0.38, 7.5], [-0.78, 0.6, -0.05, 6], [0.78, 0.6, -0.05, 6], [0, 0.72, 0.68, 6.2], [0, 0.6, -0.8, 6]];
const CURLS = (() => {
    const out = [];
    [[22, 11, 5.4], [48, 8, 5.2], [72, 5, 4.8], [88, 1, 4.6]].forEach(([el, n, r], ring) => {
        for (let i = 0; i < n; i++) {
            const az = (360 * i) / n + ring * 17, a = az * D2R, e = el * D2R, x = Math.cos(e) * Math.sin(a), y = Math.sin(e), z = Math.cos(e) * Math.cos(a);
            if (ring === 0 && z > 0.45) continue;   // keep the face clear
            out.push([x, y, z, r]);
        }
    });
    [[-0.38, 0.62, 0.69], [0, 0.66, 0.75], [0.38, 0.62, 0.69]].forEach(([x, y, z]) => out.push([x, y, z, 4.1]));
    return out;
})();
/** Hat crowns: the plane that bounds them; hair poking out above it is hidden under the hat. */
const HAT_CAP = { 1: [[0, 1, -0.12], 0.22], 2: [[0, 1, -0.18], 0.1], 3: [[0, 1, -0.08], 0.32], 7: [[0, 1, -0.1], 0.42] };

/** A point (head frame) on the edge of a flat region: axis n, cut d, phi degrees round from the front toward the kid's left. */
function edgePt(n, d, phDeg, rad) {
    const n0 = norm3(n), f0 = norm3(sub([0, 0, 1], scale(n0, n0[2]))), g0 = cross(n0, f0), t = Math.acos(d), ph = phDeg * D2R;
    return scale(add(scale(n0, Math.cos(t)), scale(add(scale(f0, Math.cos(ph)), scale(g0, Math.sin(ph))), Math.sin(t))), rad);
}
/** A hat brim from its inner and outer edges (head frame), cut into runs that face the same way so the head sorts between them. */
function brimParts(C, L, inner, outer, c, cz, closed) {
    const n = inner.length, mids = inner.map((p, i) => sp(C, L(scale(add(p, outer[i]), 0.5))).z), side = mids.map((z) => z >= cz), out = [];
    const starts = []; for (let i = 0; i < n; i++) if (!closed ? i === 0 || side[i] !== side[i - 1] : side[i] !== side[(i - 1 + n) % n]) starts.push(i);
    if (!starts.length) starts.push(0);
    starts.forEach((s0, k) => {
        const run = []; let i = s0;
        do { run.push(i); i = closed ? (i + 1) % n : i + 1; } while (i !== (closed ? starts[(k + 1) % starts.length] : starts[k + 1] ?? n) && run.length < n);
        const ext = closed || k + 1 < starts.length ? [i % n] : [];   // share an edge with the next run so there's no gap
        const idx = [...run, ...ext].filter((j) => j < n);
        if (idx.length < 2) return;
        out.push(poly(C, [...idx.map((j) => L(inner[j])), ...idx.slice().reverse().map((j) => L(outer[j]))], c, 1, 0, 1));
    });
    return out;
}

function headParts(C, sk, o, pose, skin, hc) {
    const { P, F } = sk, N = F.head, H = P.head, r = BONES.r, cz = sp(C, H).z;
    const L = (v) => add(H, app(N, v));
    const backHair = [], backOther = [], face = [], hair = [], over = [], front = [], loose = [];
    const st = HAIR[o.h], hat = HAT_CAP[o.a], hatCol = hexRgb(col(o.k));
    const underHat = (v) => hat && dot(norm3(v), norm3(hat[0])) > hat[1] - 0.12;
    const hairC = st && st.buzz ? mix(hc, skin, 0.45) : hc, rh = r + (st ? st.lift : 0);
    const hv = (p) => { if (p) (p.z < cz ? backHair : hair).push(p); };      // a lock, a curl, a bun
    const sv = (p) => { if (p) (p.z < cz ? backOther : front).push(p); };    // an ear, a brim, a headphone cup
    // Ears: a small flattened shell on each side, with the inner fold printed on.
    if (!(st && st.noEars)) for (const sx of [1, -1]) {
        const fr = cols(app(N, [0, 0, 1]), app(N, [0, 1, 0]), app(N, [sx, 0, 0]));
        const ear = sweep(C, { a: L([sx * 18.3, 2.4, -1.8]), b: L([sx * 18.5, -5.4, -0.8]), fr, prof: [{ t: 0, w: 2.8, d: 1.9, oz: 0.9 }, { t: 0.45, w: 3.5, d: 2.2, oz: 1.9 }, { t: 1, w: 2.5, d: 1.8, oz: 1.1 }], c: skin, k: 0.97, steps: 4 });
        const fold = decal(C, L([sx * 20.4, -1.4, -0.9]), app(N, [0, 0, -sx]), app(N, [0, -1, 0]), `<path d="M-.8-2.5q2.1.3 2.1 2.5t-1.7 2.5" stroke="${rgb(dk(skin, 0.7))}" stroke-width=".75" fill="none" stroke-linecap="round"/>`, { nrm: app(N, [sx, 0, 0.15]), min: 0.2 });
        sv({ z: ear.z, svg: solo(C, ear) + (fold ? fold.svg : "") });
    }
    const hq = sp(C, H);
    const headDisc = `<circle cx="${f1(hq.x)}" cy="${f1(hq.y)}" r="${r}" fill="url(#${radial(C, hq.x, hq.y, r, skin, 1, 0.22)})" stroke="${lineOf(skin)}" stroke-width="${C.sw}"/>`;
    // The face, printed on the front of the head.
    const lk = pose.look || [0, 0], bl = pose.blink || 0, eyeType = pose.eyes >= 0 ? pose.eyes : o.e, brow = pose.brow || 0;
    const fd = (lx, ly, inner, lift = 0.05, min = 0.08) => { const s = onBall(H, N, r, lx, ly, lift); const d = decal(C, s.p, s.tx, s.ty, inner, { nrm: s.nrm, min }); if (d) face.push(d); };
    for (const sx of [1, -1]) fd(sx * 11.4, -6.4, `<ellipse cx="0" cy="0" rx="2.6" ry="1.4" fill="#F28CB8" opacity=".4"/>`);
    for (const sx of [1, -1]) fd(sx * 7, -1.6, eyeSvg(eyeType, bl, lk[0] * 0.8, -lk[1] * 0.6, eyeType === 5 && sx < 0));
    const browC = rgb(!st ? dk(skin, 0.6) : dk(hc, 0.85));
    for (const sx of [1, -1]) {
        const tilt = (eyeType === 4 ? -13 : pose.worried ? 12 : 0) * sx;
        fd(sx * 7, 4.8, `<path d="M-2.5.3q2.5-1.6 5-.1" transform="translate(0 ${f1(-1.3 * brow)}) rotate(${tilt})" stroke="${browC}" stroke-width="1.05" fill="none" stroke-linecap="round"/>`);
    }
    fd(0, -9.4, MOUTHS[pose.mouth >= 0 ? pose.mouth : o.m] || MOUTHS[0]);
    const nose = onBall(H, N, r, 0, -4.4, 0);
    if (sp(C, nose.nrm).z > 0.05) face.push({ z: 0, svg: solo(C, ball(C, add(nose.p, scale(nose.nrm, 0.25)), 1.4, dk(skin, 0.96), 1, 0, 0)) });
    // Hair on the head, then what sticks out (spikes, curls, buns, puffs, the swoop).
    if (st) {
        const th = st._th || (st._th = hairTh(st));
        const cap = region(C, H, N, rh, st.n, th, hairC, cz, st.buzz ? 0 : 1);
        if (cap) hair.push(cap);
        const deco = (lx, ly, inner, min = 0.2) => { const s = onBall(H, N, rh, lx, ly, 0.1), d = decal(C, s.p, s.tx, s.ty, inner, { nrm: s.nrm, min }); if (d) { d.z = cz + 0.01; hair.push(d); } };
        if (!st.buzz && !hat) deco(-5, 13.6, `<path d="M-4.4.6q4.4-2.6 8.8-.7" stroke="${rgb(lite(hc, 0.5))}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".55"/>`);
        if (st.part && !hat) deco(0, 15.2, `<path d="M0-2.6v4.6" stroke="${rgb(dk(hc, 0.72))}" stroke-width=".6" stroke-linecap="round" opacity=".8"/>`, 0.15);
    }
    const lag = pose.lag || [0, 0, 0];
    if (st && st.spikes) SPIKES.forEach(([x, y, z, l]) => { const d = norm3([x, y, z]); if (underHat(d)) return; hv(sweep(C, { a: L(scale(d, rh - 2)), b: L(add(scale(d, rh + l), [0, 0, -1.5])), fr: N, prof: [{ t: 0, w: 3.7, d: 3.7 }, { t: 1, w: 0.25, d: 0.25 }], c: hc, steps: 4 })); });
    if (st && st.curls) CURLS.forEach(([x, y, z, rr]) => { const d = norm3([x, y, z]); if (underHat(d)) return; hv(ball(C, L(scale(d, rh + 0.4)), rr, hc, 0.98, 0, 2)); });
    if (st && st.buns) for (const sx of [1, -1]) { const d = norm3([sx * 0.55, 0.78, -0.28]); if (!underHat(d)) hv(ball(C, L(scale(d, rh + 4)), 7, hc, 1, 0, 2)); }
    if (st && st.puffs) for (const sx of [1, -1]) hv(ball(C, L([sx * 19.5, 8.5, -4]), 9.4, hc, 1, 0, 2));
    if (st && st.lock && !hat) { const lk2 = st.lock, p = region(C, H, N, rh + lk2.lift, lk2.n, lk2._th || (lk2._th = hairTh(lk2)), hc, cz + 0.02, 1, 0.34); if (p) hair.push(p); }
    // Long hair and braids hang past the head: they're sorted with the body (behind the back, in front of the shoulders).
    const hang = (v, f = 1) => add(L(v), scale(lag, f));
    if (st && st.long) {
        // Seen from behind it lies over the back of the head (under a hat); from the front it hangs behind the body.
        const cur = sweep(C, { a: L([0, 4, -13.5]), b: hang([0, -31, -9], 1), fr: N, prof: [{ t: 0, w: 17.5, d: 6 }, { t: 0.5, w: 18.5, d: 6.4 }, { t: 1, w: 17, d: 4.4 }], c: dk(hc, 0.93), steps: 5 });
        if (cur.z > cz) { cur.z = cz + 0.015; hair.push(cur); } else loose.push(Object.assign(cur, { g: "hairback" }));
        for (const sx of [1, -1]) backHair.push(sweep(C, { a: L([sx * 14.6, 2, 2.5]), b: hang([sx * 17.4, -25, 3], 0.8), fr: N, prof: [{ t: 0, w: 5.4, d: 4.4 }, { t: 0.55, w: 5, d: 4 }, { t: 0.85, w: 4.2, d: 3.4, ox: sx * 0.8 }, { t: 1, w: 2.6, d: 2.2, ox: sx * 1.6 }], c: hc, steps: 6 }));
    }
    if (st && st.braids) for (const sx of [1, -1]) {
        const br = [];
        for (let i = 0; i < 6; i++) { const t = i / 5; br.push(ball(C, hang([sx * (12.8 + 1.4 * t), -5 - 22 * t, -11 + 7.5 * t], t), 3.4 - 0.7 * t, hc, 1, 0.5, 2)); }
        br.push(ball(C, hang([sx * 14.4, -29.5, -2.8], 1), 2.2, hatCol, 1, 1, 2));
        // Seen from behind a braid lies over the head; otherwise it hangs with the body.
        if (br[0].z > cz) br.forEach((b) => { b.z = cz + 0.016 + b.z / 1e4; hair.push(b); }); else br.forEach((b) => loose.push(Object.assign(b, { g: "braid" + sx })));
    }
    // Hats.
    const crown = (lift, nl, d, c) => { const p = region(C, H, N, r + lift, nl, flatTh(d), c, 0); if (p) over.push(p); };
    if (o.a === 1) {
        crown(2.3, [0, 1, -0.12], 0.22, hatCol);
        const inner = [], outer = [];
        for (let a = -80; a <= 80; a += 10) {
            const p = edgePt([0, 1, -0.12], 0.22, a, r + 2.2), h = norm3([p[0], 0, p[2]]), w = 12 * Math.pow(Math.max(0, Math.cos(a * D2R * 1.1)), 0.55);
            inner.push(p); outer.push(add(p, add(scale(h, w), [0, -0.34 * w, 0])));
        }
        brimParts(C, L, inner, outer, dk(hatCol, 0.86), cz, false).forEach(sv);
        over.push(Object.assign(ball(C, L(scale(norm3([0, 1, -0.12]), r + 2.4)), 1.6, dk(hatCol, 0.8), 1, 0), { z: 41 }));
    } else if (o.a === 2) {
        const p = zone(C, H, N, r + 3, [0, 1, -0.18], 0.1, 0.27, dk(hatCol, 0.84), 0); if (p) over.push(p);
        crown(2.95, [0, 1, -0.18], 0.27, hatCol);
        sv(ball(C, L([0, r + 6.4, -2]), 4.8, lite(hatCol, 0.35), 1, 2));
    } else if (o.a === 3) {
        crown(2.4, [0, 1, -0.08], 0.32, hatCol);
        const p = zone(C, H, N, r + 2.5, [0, 1, -0.08], 0.32, 0.44, dk(hatCol, 0.72), 0); if (p) over.push(p);
        const inner = [], outer = [];
        for (let a = 0; a < 360; a += 15) {
            const p = edgePt([0, 1, -0.08], 0.32, a, r + 2.5), h = norm3([p[0], 0, p[2]]);
            inner.push(p); outer.push(add(p, add(scale(h, 8.6), [0, -3.6, 0])));
        }
        brimParts(C, L, inner, outer, dk(hatCol, 0.9), cz, true).forEach(sv);
    } else if (o.a === 4) {
        const p = zone(C, H, N, r + 1.7, [0, 1, -0.4], 0.27, 0.44, hatCol, 0); if (p) over.push(p);
    } else if (o.a === 5) {
        const arc = (from, to) => { const a = []; for (let i = from; i <= to; i++) { const f = (i * 15) * D2R; a.push(L([Math.cos(f) * (r + 3.4), Math.sin(f) * (r + 3.4) - 1, -1.2])); } return a; };
        for (const [from, to] of [[0, 6], [6, 12]]) {
            const band = strand(C, arc(from, to), rgb(INK), 2.6), hi = strand(C, arc(from, to), rgb(lite(INK, 0.3)), 0.8);
            sv({ z: band.z, svg: band.svg + hi.svg });
        }
        for (const sx of [1, -1]) sv(sweep(C, { a: L([sx * (r - 1.5), -1.5, -1]), b: L([sx * (r + 3.8), -1.5, -1]), fr: N, prof: [{ t: 0, w: 5.6, d: 5.6 }, { t: 1, w: 5.6, d: 5.6 }], c: hatCol, cap: "flat", steps: 2 }));
    } else if (o.a === 6) {
        const gold = [230, 180, 34];
        for (let i = 0; i < 12; i++) {
            const a0 = (i * 30) * D2R, a1 = ((i + 1) * 30) * D2R, P0 = (a, y, rad) => L([rad * Math.sin(a), y, rad * Math.cos(a) - 1]);
            const top0 = i % 2 ? 21 : 26, top1 = i % 2 ? 26 : 21;
            sv(poly(C, [P0(a0, 15.8, 14.2), P0(a1, 15.8, 14.2), P0(a1, top1, 14.9), P0(a0, top0, 14.9)], gold, 1, 0));
            if (i % 2 === 0) sv(ball(C, P0(a0, 26.6, 15), 1.3, [217, 72, 72], 1, 0.3, 0));
        }
        sv(ball(C, L([0, 19, 14.6]), 1.9, [127, 174, 221], 1, 0.5));
    } else if (o.a === 7) {
        crown(1.8, [0, 1, -0.1], 0.42, INK);
        const sq = []; for (let i = 0; i < 4; i++) { const a = (45 + i * 90 + 10) * D2R; sq.push(L([19 * Math.sin(a), r + 2.2, 19 * Math.cos(a) - 1])); }
        over.push(Object.assign(poly(C, sq.map((p) => add(p, app(N, [0, -1.3, 0]))), dk(INK, 0.7), 1, 0, 0), { z: 60 }));
        over.push(Object.assign(poly(C, sq, lite(INK, 0.12), 1, 0), { z: 61 }));
        const top = L([0, r + 2.4, -1]), corner = add(sq[0], app(N, [0, 0.2, 0]));
        over.push(Object.assign(sweep(C, { a: top, b: corner, fr: N, prof: [{ t: 0, w: 0.45, d: 0.45 }, { t: 1, w: 0.45, d: 0.45 }], c: hatCol, steps: 2, line: 0 }), { z: 62 }));
        sv(sweep(C, { a: corner, b: add(add(corner, [0, -7, 0]), scale(lag, 0.5)), fr: N, prof: [{ t: 0, w: 0.6, d: 0.6 }, { t: 1, w: 1.4, d: 1.4 }], c: hatCol, steps: 3 }));
        over.push(Object.assign(ball(C, top, 1.3, hatCol, 1, 0), { z: 63 }));
    }
    // Glasses (over the face, under a hat brim).
    if (o.g) {
        const lens = { 1: `<rect x="-3.8" y="-3" width="7.6" height="5.8" rx="1.9" fill="${rgb(INK)}"/><path d="M-2.5-1.7h2.7" stroke="#fff" stroke-width=".7" opacity=".55" stroke-linecap="round"/>`,
            2: `<circle r="3.8" fill="rgba(255,255,255,.18)" stroke="${rgb(INK)}" stroke-width=".85"/>`,
            4: (() => { let p = ""; for (let i = 0; i < 10; i++) { const rr = i % 2 ? 2.3 : 4.9, a = -Math.PI / 2 + (i * Math.PI) / 5; p += (i ? "L" : "M") + f1(rr * Math.cos(a)) + " " + f1(rr * Math.sin(a)); } return `<path d="${p}Z" fill="#F2B33D" stroke="${rgb(INK)}" stroke-width=".7" stroke-linejoin="round"/>`; })(),
            5: `<circle r="4.3" fill="#B9E3F2" stroke="${rgb(INK)}" stroke-width="1.5"/><circle cx="1.3" cy="-1.3" r="1" fill="#fff"/>` }[o.g];
        const put = (d, z) => { if (d) { d.z = z; over.push(d); } };
        if (o.g === 5) { const p = zone(C, H, N, r + 0.9, [0, 1, 0], -0.2, 0.02, INK, 0); if (p) over.push(p); }
        if (o.g === 3) {
            const s = onBall(H, N, r, 0, -1.2, 1.4);
            put(decal(C, s.p, s.tx, s.ty, `<path d="M-15.4-4.3q15.4-3 30.8 0l-1 7.7q-14.4 3.5-28.8 0z" fill="#7FAEDD" fill-opacity=".72" stroke="${rgb(INK)}" stroke-width=".9"/><path d="M-11-1.8h9" stroke="#fff" stroke-width="1.1" opacity=".7" stroke-linecap="round"/>`, { nrm: s.nrm, min: 0.05 }), 50);
        } else {
            for (const sx of [1, -1]) { const s = onBall(H, N, r, sx * 7, -1.6, 1.1); put(decal(C, s.p, s.tx, s.ty, lens, { nrm: s.nrm, min: 0.05 }), 50); }
            const s = onBall(H, N, r, 0, -1.2, 1);
            put(decal(C, s.p, s.tx, s.ty, `<path d="M-2.7 0q2.7-1.4 5.4 0" stroke="${rgb(INK)}" stroke-width=".9" fill="none"/>`, { nrm: s.nrm, min: 0.1 }), 50);
            for (const sx of [1, -1]) sv(strand(C, [onBall(H, N, r, sx * 10.6, -1, 1).p, L([sx * 19.8, -0.6, -3.5])], rgb(INK), 0.9));
        }
    }
    const zsort = (a, b) => a.z - b.z;
    backOther.sort(zsort); over.sort(zsort); front.sort(zsort);
    const back = backHair.length ? [...backOther, { z: backHair.reduce((s, p) => s + p.z, 0) / backHair.length, svg: merged(C, backHair) }].sort(zsort) : backOther;
    const svgs = back.map((x) => (x.tag ? solo(C, x) : x.svg)).join("") + headDisc + face.map((x) => x.svg).join("") + merged(C, hair)
        + over.map((x) => solo(C, x)).join("") + front.map((x) => solo(C, x)).join("");
    return { head: { z: cz, svg: svgs }, loose };
}

/* ---------- the body and clothes ----------
   Parts go in groups (a leg, an arm, the torso, the hips, the back item) that share one outline, then the groups
   are painted far to near. */
function bodyParts(C, sk, o, pose) {
    const { P, F } = sk, S = F.spine, R0 = F.root, parts = [];
    const put = (x, g, z) => { if (x) { if (g) x.g = g; if (z != null) x.z = z; parts.push(x); } return x; };
    const skin = hexRgb(SKINS[o.s] || SKINS[0]), hc = hexRgb(HAIR_COLORS[o.c] ? HAIR_COLORS[o.c][0] : HAIR_COLORS[0][0]);
    const shirt = hexRgb(col(o.u)), pants = hexRgb(col(o.v)), shoe = hexRgb(col(o.w)), lag = pose.lag || [0, 0, 0], t = pose.t || 0;
    const cz = sp(C, along(P.pelvis, P.chest, 0.5)).z, depth = (p) => Math.max(0.84, Math.min(1.04, 0.97 + (sp(C, p).z - cz) / 60));
    const CH = (x, y, z) => add(P.chest, app(S, [x, y, z])), PV = (x, y, z) => add(P.pelvis, app(R0, [x, y, z]));
    const long = o.t === 1 || o.t === 4, bare = o.t === 2, white = [246, 248, 251];
    // A ring round the body (a collar, a hem): the half facing the camera, or the half facing away.
    const ring = (ctr, fr, rx0, rz0, c, w, z, nearSide) => {
        const n = 36, cq = sp(C, ctr).z, P3 = [], ok = [];
        for (let i = 0; i < n; i++) { const a = (TAU * i) / n, p = add(ctr, app(fr, [rx0 * Math.cos(a), 0, rz0 * Math.sin(a)])); P3.push(p); ok.push((sp(C, p).z >= cq) === nearSide); }
        const s0 = ok.findIndex((v, i) => v && !ok[(i - 1 + n) % n]); if (s0 < 0) return null;
        const pts = []; for (let j = 0; j < n && ok[(s0 + j) % n]; j++) pts.push(P3[(s0 + j) % n]);
        return pts.length > 2 ? Object.assign(strand(C, pts, c, w), { z }) : null;
    };
    // Legs and shoes (not in a head-and-shoulders view: they're out of the frame).
    for (const [s, sx] of C.face ? [] : [["l", 1], ["r", -1]]) {
        const g = "leg" + s, hp = P[s + "Hp"], kn = P[s + "Kn"], an = P[s + "An"], k = depth(kn), Th = F[s + "Th"], Sn = F[s + "Sn"], Ft = F[s + "Ft"];
        const pantsLong = o.b === 0 || o.b === 2, taper = o.b === 2;
        if (!pantsLong) {
            put(sweep(C, { a: hp, b: kn, fr: Th, prof: [{ t: 0, w: 4.6, d: 4.8 }, { t: 1, w: 3.5, d: 3.6 }], c: skin, k, z: -4.2 }), g);
            put(sweep(C, { a: kn, b: an, fr: Sn, prof: [{ t: 0, w: 3.5, d: 3.6 }, { t: 0.3, w: 3.6, d: 4, oz: -0.5 }, { t: 1, w: 2.7, d: 2.8 }], c: skin, k, z: -2.6 }), g);
        } else {
            put(sweep(C, { a: hp, b: kn, fr: Th, prof: [{ t: 0, w: 5.6, d: 5.8 }, { t: 1, w: 4.6, d: 4.7 }], c: pants, k, z: -4.2 }), g);
            put(sweep(C, { a: kn, b: along(kn, an, 0.9), fr: Sn, prof: [{ t: 0, w: 4.5, d: 4.6 }, { t: 1, w: taper ? 3.4 : 4.6, d: taper ? 3.4 : 4.6 }], c: pants, k, z: 3.5 }), g);
            // Jeans turn up a cuff; joggers gather into a band.
            const cw = taper ? 3.6 : 4.8;
            put(sweep(C, { a: along(kn, an, taper ? 0.78 : 0.8), b: along(kn, an, 0.97), fr: Sn, prof: [{ t: 0, w: cw, d: cw }, { t: 1, w: cw, d: cw }], c: dk(pants, taper ? 0.84 : 0.8), k, z: 3.6, steps: 2, line: 2, cap: "flat" }), g);
            if (taper) put(sweep(C, { a: along(hp, kn, 0.1), b: along(kn, an, 0.78), fr: Sn, prof: [{ t: 0, w: 0.5, d: 0.5, ox: sx * 5.4 }, { t: 1, w: 0.45, d: 0.45, ox: sx * 3.6 }], c: white, k, z: 3.55, steps: 4, line: 0 }), g);
        }
        if (o.b === 1 || o.b === 4) {
            const end = o.b === 4 ? 0.64 : 0.54;
            put(sweep(C, { a: hp, b: along(hp, kn, end), fr: Th, prof: [{ t: 0, w: 5.9, d: 6.1 }, { t: 1, w: 5.6, d: 5.8 }], c: pants, k, z: -4, steps: 3, line: 2, cap1: "flat" }), g);
            if (o.b === 4) put(sweep(C, { a: along(hp, kn, 0.26), b: along(hp, kn, 0.5), fr: Th, prof: [{ t: 0, w: 2.3, d: 3.2, ox: sx * 5.5 }, { t: 1, w: 2.3, d: 3.2, ox: sx * 5.5 }], c: dk(pants, 0.84), k, z: -3.8, steps: 2, line: 2 }), g);
        }
        // Shoes: sole, upper, then the extras. Big shoes, cartoon style.
        const heel = P[s + "Heel"], toe = P[s + "Toe"], kk = depth(an);
        const sole = o.f === 2 ? [74, 52, 34] : o.f === 4 ? [255, 210, 120] : [248, 246, 240];
        put(sweep(C, { a: heel, b: toe, fr: Ft, prof: [{ t: 0, w: 4, d: 1.25, oy: -0.45 }, { t: 0.5, w: 4.5, d: 1.25, oy: -0.45 }, { t: 1, w: 4, d: 1.1, oy: -0.3 }], c: sole, k: kk, z: 1, steps: 5, line: 2 }), g);
        if (o.f === 3) {   // slides: a strap over bare toes
            put(sweep(C, { a: along(heel, toe, 0.05), b: along(heel, toe, 0.92), fr: Ft, prof: [{ t: 0, w: 3.1, d: 1.8, oy: 1.4 }, { t: 0.6, w: 3.5, d: 1.9, oy: 1.4 }, { t: 1, w: 3, d: 1.4, oy: 1.1 }], c: skin, k: kk, z: 1.1, steps: 4 }), g);
            put(sweep(C, { a: along(heel, toe, 0.36), b: along(heel, toe, 0.66), fr: Ft, prof: [{ t: 0, w: 4.1, d: 2.5, oy: 1.6 }, { t: 1, w: 4.1, d: 2.4, oy: 1.5 }], c: shoe, k: kk, z: 1.3, steps: 2, line: 2, cap: "flat" }), g);
            put(sweep(C, { a: add(an, app(Ft, [0, -1.6, 0])), b: add(an, app(Ft, [0, 2.2, 0])), fr: Ft, prof: [{ t: 0, w: 2.8, d: 2.8 }, { t: 1, w: 2.7, d: 2.7 }], c: skin, k: kk, z: 0.9, steps: 2 }), g);
        } else {
            const boot = o.f === 2, up = boot ? [124, 84, 50] : shoe;
            put(sweep(C, { a: heel, b: toe, fr: Ft, prof: [{ t: 0, w: 3.8, d: 3.4, oy: 2 }, { t: 0.42, w: 4.2, d: 3.6, oy: 1.8 }, { t: 0.8, w: 4, d: 2.8, oy: 1.2 }, { t: 1, w: 3.4, d: 2.2, oy: 0.9 }], c: up, k: kk, z: 1.2, steps: 6, line: 2 }), g);
            if (o.f === 1) put(sweep(C, { a: along(heel, toe, 0.74), b: toe, fr: Ft, prof: [{ t: 0, w: 4.15, d: 3, oy: 1.35 }, { t: 1, w: 3.55, d: 2.35, oy: 0.95 }], c: white, k: kk, z: 1.3, steps: 3, line: 2, cap0: "flat" }), g);
            if (o.f === 1 || boot) put(sweep(C, { a: add(an, app(Ft, [0, -0.6, -0.6])), b: add(an, app(Ft, [0, boot ? 6.4 : 5, -0.5])), fr: Ft, prof: [{ t: 0, w: 3.8, d: 3.9 }, { t: 1, w: 3.7, d: 3.8 }], c: up, k: kk, z: 1.25, steps: 2, line: 2, cap1: "flat" }), g);
            if (boot) put(sweep(C, { a: add(an, app(Ft, [0, 5, -0.5])), b: add(an, app(Ft, [0, 7, -0.5])), fr: Ft, prof: [{ t: 0, w: 4.2, d: 4.3 }, { t: 1, w: 4.2, d: 4.3 }], c: dk(up, 0.82), k: kk, z: 1.27, steps: 1, line: 2, cap: "flat" }), g);
            if (o.f === 1) put(decal(C, add(an, app(Ft, [sx * 3.95, 1.2, -0.5])), app(Ft, [0, 0, -sx]), app(Ft, [0, -1, 0]), `<circle r="1.5" fill="#fff"/><path d="M0-1l.3.6.7.1-.5.5.1.7-.6-.3-.6.3.1-.7-.5-.5.7-.1z" fill="${rgb(up)}"/>`, { nrm: app(Ft, [sx, 0, 0]), min: 0.15 }), g, 999);
            if (!boot) {
                const lace = decal(C, add(along(heel, toe, 0.52), app(Ft, [0, 3.55, 0])), app(Ft, [1, 0, 0]), app(Ft, [0, 0, -1]), `<path d="M-1.6-1.6h3.2M-1.6 0h3.2M-1.6 1.6h3.2" stroke="#fff" stroke-width=".6" stroke-linecap="round"/>`, { nrm: app(Ft, [0, 1, 0.3]), min: 0.05 });
                if (lace) put(lace, g, lace.z + 2.2);
            }
            if (o.f === 4) {
                const fl = 5 + 2.2 * Math.abs(Math.sin(t * 23)), b0 = add(heel, app(Ft, [0, 0.4, -0.8]));
                put(sweep(C, { a: b0, b: add(add(b0, app(Ft, [0, -0.4, -fl])), scale(lag, 0.6)), fr: Ft, prof: [{ t: 0, w: 1.9, d: 1.9 }, { t: 1, w: 0.1, d: 0.1 }], c: [242, 140, 40], k: 1, z: 0.6, steps: 3, line: 0 }), g);
                put(sweep(C, { a: b0, b: add(b0, app(Ft, [0, -0.2, -fl * 0.55])), fr: Ft, prof: [{ t: 0, w: 1, d: 1 }, { t: 1, w: 0.1, d: 0.1 }], c: [255, 227, 163], k: 1, z: 0.7, steps: 2, line: 0 }), g);
            }
        }
    }
    // Hips (under the shirt) or a skirt.
    if (C.face) { /* out of the frame */ } else if (o.b === 3) {
        const sk2 = put(sweep(C, { a: PV(0, 3, 0), b: PV(0, -12.5, 0), fr: R0, prof: [{ t: 0, w: 11.4, d: 8.2 }, { t: 1, w: 16.8, d: 13 }], c: pants, k: 1, steps: 4, cap1: "flat" }), "hips");
        for (const a of [-56, -28, 0, 28, 56]) {
            const sa = Math.sin(a * D2R), ca = Math.cos(a * D2R);
            if (sp(C, app(R0, [sa, 0.3, ca])).z > 0.12) put(strand(C, [PV(11 * sa, 0, 8 * ca), PV(16.4 * sa, -12, 12.7 * ca)], rgb(dk(pants, 0.76)), 0.6), "hips", sk2.z + 0.1);
        }
    } else put(sweep(C, { a: PV(0, -4.6, 0), b: PV(0, 2, 0), fr: R0, prof: [{ t: 0, w: 11.2, d: 8 }, { t: 1, w: 11.2, d: 8 }], c: pants, k: 1, steps: 2, cap0: "flat" }), "hips");
    // The back item.
    const bx = o.x;
    if (bx === 1) {
        const bp = hexRgb(col((o.u + 2) % 10));
        put(sweep(C, { a: CH(0, -18, -9.6), b: CH(0, -3.2, -9.8), fr: S, prof: [{ t: 0, w: 8.6, d: 3.8 }, { t: 0.85, w: 8.8, d: 4 }, { t: 1, w: 7.8, d: 3.4 }], c: bp, k: 1, steps: 4 }), "back");
        put(sweep(C, { a: CH(0, -16, -13), b: CH(0, -9.6, -13.2), fr: S, prof: [{ t: 0, w: 6.2, d: 1.5 }, { t: 1, w: 6.2, d: 1.5 }], c: dk(bp, 0.82), k: 1, steps: 2, line: 2 }), "back");
    } else if (bx === 2) {
        const top = [-9.4, -4.7, 0, 4.7, 9.4].map((x) => CH(x, 0.6, -7.2 - (x ? 0 : 0.5)));
        const sway = 1.6 * Math.sin(t * 2.2);
        const bot = [9.4, 4.7, 0, -4.7, -9.4].map((x, i) => add(PV(x * 1.65, -21, -10.5 - Math.abs(x) * 0.15 + (i % 2 ? 0.8 : 0)), add(scale(lag, 1.4), [sway * 0.3, 0, sway * 0.4])));
        put(poly(C, [...top, ...bot], [217, 72, 72], 1, 0), "back");
        for (const sx of [1, -1]) put(ball(C, CH(sx * 5.4, 1.4, 5.6), 1.35, [230, 180, 34], 1, 0, 2), "torso", null);
    } else if (bx === 3) {
        for (const sx of [1, -1]) {
            put(sweep(C, { a: CH(sx * 4.4, -2.4, -10.2), b: CH(sx * 4.4, -15.5, -10.2), fr: S, prof: [{ t: 0, w: 3.4, d: 3.4 }, { t: 1, w: 3.4, d: 3.4 }], c: [157, 176, 207], k: 1, steps: 3 }), "back");
            put(sweep(C, { a: CH(sx * 4.4, -15.2, -10.2), b: CH(sx * 4.4, -17.8, -10.2), fr: S, prof: [{ t: 0, w: 2.1, d: 2.1 }, { t: 1, w: 2.8, d: 2.8 }], c: [70, 78, 92], k: 1, steps: 2, line: 2, cap1: "flat" }), "back");
            const fl = 6 + 2.4 * Math.abs(Math.sin(t * 19 + sx)), b0 = CH(sx * 4.4, -17.8, -10.2);
            put(sweep(C, { a: b0, b: add(add(b0, app(S, [0, -fl, -0.5])), scale(lag, 0.8)), fr: S, prof: [{ t: 0, w: 2.4, d: 2.4 }, { t: 1, w: 0.1, d: 0.1 }], c: [242, 140, 40], k: 1, steps: 3, line: 0 }), "back");
            put(sweep(C, { a: b0, b: add(b0, app(S, [0, -fl * 0.55, -0.4])), fr: S, prof: [{ t: 0, w: 1.2, d: 1.2 }, { t: 1, w: 0.1, d: 0.1 }], c: [255, 227, 163], k: 1, steps: 2, line: 0, z: 0.1 }), "back");
        }
    } else if (bx === 4) {
        const flap = 10 + 14 * Math.sin(t * 3.2);
        const W = [[2, -1], [9, 5.5], [17, 10.5], [24, 11.5], [21.5, 7], [25, 5.5], [20.5, 1.5], [23, -1.5], [17, -3.5], [17.5, -7], [10, -6], [4, -5.5]];
        for (const sx of [1, -1]) {
            const R = ry(sx * -flap), pts = W.map(([x, y]) => { const v = app(R, [sx * x, y, -x * 0.25]); return CH(v[0], v[1] - 2, v[2] - 8.6); });
            put(poly(C, pts, [220, 235, 250], 1, 0, 2), "back");
        }
    }
    // Torso, neck, collar.
    const torso = put(sweep(C, { a: PV(0, -3.4, 0), b: CH(0, 2.8, -0.4), fr: S, prof: [{ t: 0, w: 12.2, d: 8.8 }, { t: 0.16, w: 11.6, d: 8.5 }, { t: 0.55, w: 11.8, d: 8.7, oz: 0.4 }, { t: 0.84, w: 12.8, d: 8.2, oz: 0.2 }, { t: 1, w: 10.2, d: 6.4 }], c: shirt, k: 1, steps: 8, cap0: "flat", cap1: "flat" }), "torso");
    const tz = torso.z, neckFr = F.head;
    put(ring(CH(0, 2.8, -0.4), S, 4.4, 4.1, rgb(dk(shirt, 0.72)), 1.3, tz + 0.1, false), "torso");
    put(sweep(C, { a: CH(0, 2.8, -0.4), b: add(P.neckTop, app(neckFr, [0, 1.6, 0])), fr: neckFr, prof: [{ t: 0, w: 3.9, d: 3.8 }, { t: 1, w: 3.5, d: 3.4 }], c: dk(skin, 0.93), k: 1, steps: 2, cap0: "flat" }), "torso", tz + 0.2);
    const fr = (y, dep, inner, opt = {}) => decal(C, CH(0, y, dep), app(S, [1, 0, 0]), app(S, [0, -1, 0]), inner, Object.assign({ nrm: app(S, [0, 0, 1]), min: 0.15 }, opt));
    const ink = rgb(o.u === 9 ? INK : white), shade = rgb(dk(shirt, 0.74));
    if (bare) put(fr(1.4, 5.6, `<path d="M-4.4-1.6q4.4 5.6 8.8 0z" fill="${rgb(dk(skin, 0.97))}" stroke="${rgb(dk(shirt, 0.6))}" stroke-width=".7"/>`, { nrm: app(S, [0, 0.55, 1]) }), "torso", tz + 0.3);
    else {
        put(ring(CH(0, 2.8, -0.4), S, 4.4, 4.1, rgb(dk(shirt, 0.72)), 1.3, tz + 0.3, true), "torso");
        if (o.t === 3) put(fr(1.2, 5.4, `<path d="M-3.4-1.4l3.4 4.4 3.4-4.4" stroke="${rgb(white)}" stroke-width="1.1" fill="none"/>`, { nrm: app(S, [0, 0.5, 1]) }), "torso", tz + 0.35);
        if (o.t === 4) put(fr(1.2, 5.4, `<path d="M-3.3-1.4L0 3.6l3.3-5z" fill="#F4F7FB"/>`, { nrm: app(S, [0, 0.5, 1]) }), "torso", tz + 0.35);
    }
    put(ring(PV(0, -2.4, 0.2), R0, 11.7, 8.5, shade, 0.7, tz + 0.3, true), "torso");
    if (o.t === 1) {
        put(sweep(C, { a: CH(0, 0.6, -6.9), b: CH(0, 6.2, -5.8), fr: S, prof: [{ t: 0, w: 9.6, d: 4.2 }, { t: 1, w: 7.8, d: 3.3 }], c: dk(shirt, 0.9), k: 1, steps: 3, line: 2 }), "torso", tz + (sp(C, app(S, [0, 0, -1])).z > 0 ? 0.4 : -0.5));
        put(fr(-15.6, 9.1, `<path d="M-6.6-3.3h13.2l1.6 6.6h-16.4z" fill="${shade}"/>`), "torso", tz + 0.36);
        put(fr(-1.2, 7.6, `<path d="M-2.1 0l-.5 5.8M2.1 0l.5 5.8" stroke="${rgb(lite(shirt, 0.75))}" stroke-width=".65" stroke-linecap="round"/><circle cx="-2.6" cy="6" r=".65" fill="${rgb(lite(shirt, 0.75))}"/><circle cx="2.6" cy="6" r=".65" fill="${rgb(lite(shirt, 0.75))}"/>`), "torso", tz + 0.37);
    }
    if (o.t === 3) {
        put(fr(-8.8, 9.1, `<text x="0" y="3.8" text-anchor="middle" font-family="Bricolage Grotesque,Arial,sans-serif" font-weight="800" font-size="10.5" fill="${ink}">7</text>`), "torso", tz + 0.36);
        put(decal(C, CH(0, -8, -8.8), app(S, [-1, 0, 0]), app(S, [0, -1, 0]), `<text x="0" y="4.4" text-anchor="middle" font-family="Bricolage Grotesque,Arial,sans-serif" font-weight="800" font-size="12" fill="${ink}">7</text>`, { nrm: app(S, [0, 0, -1]), min: 0.15 }), "torso", tz + 0.36);
        put(fr(-2.8, 8.6, `<path d="M-11.4 0h22.8" stroke="${rgb(lite(shirt, 0.35))}" stroke-width="1.5"/>`), "torso", tz + 0.35);
    }
    if (o.t === 4) put(fr(-8, 9.1, `<path d="M0-8.8v18" stroke="${shade}" stroke-width=".75"/><rect x=".4" y="-6.8" width="1.15" height="2.3" rx=".4" fill="${rgb(lite(shirt, 0.6))}"/><path d="M-7.8 2.7l3-1M7.8 2.7l-3-1" stroke="${shade}" stroke-width=".75" stroke-linecap="round"/>`), "torso", tz + 0.36);
    if (o.t === 5) put(fr(-8.8, 9.1, `<text x="0" y="3.6" text-anchor="middle" font-family="Bricolage Grotesque,Arial,sans-serif" font-weight="800" font-size="10" fill="${ink}">π</text>`), "torso", tz + 0.36);
    if (bx === 1) for (const sx of [1, -1]) {
        const strap = rgb(dk(hexRgb(col((o.u + 2) % 10)), 0.7));
        put(strand(C, [CH(sx * 5.8, -1, -8.6), CH(sx * 6, 2.4, -3), CH(sx * 6.1, 2.2, 3.4), CH(sx * 6.6, -4, 7.6), CH(sx * 7, -12, 8.4)], strap, 1.9), "torso", tz + 0.38);
    }
    // Arms: shoulder, upper arm (sleeve), forearm, a mitten hand with a thumb.
    for (const [s, sx] of [["l", 1], ["r", -1]]) {
        const g = "arm" + s, sh = P[s + "Sh"], el = P[s + "El"], wr = P[s + "Wr"], tip = P[s + "Hd"], U = F[s + "Up"], Fo = F[s + "Fo"], k = depth(along(sh, wr, 0.5));
        put(ball(C, sh, 4.4, bare ? skin : shirt, k, 0.6), g);
        put(sweep(C, { a: sh, b: el, fr: U, prof: [{ t: 0, w: 3.4, d: 3.4 }, { t: 1, w: 2.9, d: 2.9 }], c: skin, k, z: 1.6, steps: 3 }), g);
        if (!bare) {
            if (long) {
                put(sweep(C, { a: along(sh, el, -0.08), b: el, fr: U, prof: [{ t: 0, w: 4.3, d: 4.3 }, { t: 1, w: 3.8, d: 3.8 }], c: shirt, k, z: 1.8, steps: 3 }), g);
            } else put(sweep(C, { a: along(sh, el, -0.08), b: along(sh, el, 0.56), fr: U, prof: [{ t: 0, w: 4.4, d: 4.4 }, { t: 1, w: 4.1, d: 4.1 }], c: shirt, k, z: 1.8, steps: 2, line: 2, cap1: "flat" }), g);
            if (o.t === 3) put(sweep(C, { a: along(sh, el, 0.42), b: along(sh, el, 0.53), fr: U, prof: [{ t: 0, w: 4.25, d: 4.25 }, { t: 1, w: 4.2, d: 4.2 }], c: lite(shirt, 0.6), k, z: 1.85, steps: 1, line: 0, cap: "flat" }), g);
        }
        put(sweep(C, { a: el, b: wr, fr: Fo, prof: [{ t: 0, w: 2.9, d: 2.9 }, { t: 1, w: 2.5, d: 2.4 }], c: skin, k, z: 1.7, steps: 3 }), g);
        if (long) {
            put(sweep(C, { a: el, b: along(el, wr, 0.82), fr: Fo, prof: [{ t: 0, w: 3.8, d: 3.8 }, { t: 1, w: 3.4, d: 3.4 }], c: shirt, k, z: 1.8, steps: 3 }), g);
            put(sweep(C, { a: along(el, wr, 0.72), b: along(el, wr, 0.9), fr: Fo, prof: [{ t: 0, w: 3.5, d: 3.5 }, { t: 1, w: 3.5, d: 3.5 }], c: dk(shirt, 0.82), k, z: 1.85, steps: 1, line: 2, cap: "flat" }), g);
        }
        const hf = cols(app(Fo, [0, 0, 1]), app(Fo, [0, 1, 0]), app(Fo, [1, 0, 0]));
        put(sweep(C, { a: along(wr, tip, -0.05), b: tip, fr: hf, prof: [{ t: 0, w: 2.5, d: 1.9 }, { t: 0.45, w: 3.1, d: 2.2 }, { t: 1, w: 2.5, d: 1.8 }], c: skin, k, z: 2, steps: 4 }), g);
        put(sweep(C, { a: add(wr, app(Fo, [-sx * 0.5, -1.3, 1.9])), b: add(wr, app(Fo, [-sx * 0.9, -3.4, 3.3])), fr: hf, prof: [{ t: 0, w: 1.05, d: 1.05 }, { t: 1, w: 0.9, d: 0.9 }], c: skin, k, z: 2.1, steps: 2, line: 2 }), g);
    }
    const { head, loose } = headParts(C, sk, o, pose, skin, hc);
    head.z += 20; parts.push(head);   // the head (and any hair over the back) paints after the body and the back item loose.forEach((x) => parts.push(x));
    return parts;
}

const GROUP_Z = { leg: -3.4, arm: 1.8 };
/** One frame of the character as SVG (no outer <svg>). pose: from poseAt(); opts: { yaw, pitch, id, face, pal }.
 *  pal (from newPalette): a palette kept between frames. New entries collect in pal.add for the caller to put in
 *  the page; without one, the colors go inline in this frame. */
export function frame(look, pose = {}, opts = {}) {
    const o = typeof look === "string" ? parse(look) : Object.assign(parse(""), look || {}), id = opts.id || "bd";
    const C = { M: mul(rx(opts.pitch != null ? opts.pitch : PITCH), ry(opts.yaw != null ? opts.yaw : YAW)), defs: [], gid: 0, id, sw: opts.face ? 0.42 : 0.5, face: !!opts.face, pal: opts.pal || newPalette(id) };
    const sk = skeleton(pose), groups = new Map(), items = [];
    for (const p of bodyParts(C, sk, o, pose)) {
        if (!p.g) { items.push(p.tag ? { z: p.z, svg: solo(C, p) } : p); continue; }
        let G = groups.get(p.g);
        if (!G) { G = { list: [], zs: 0, n: 0 }; groups.set(p.g, G); items.push(G); }
        G.list.push(p); if (p.tag) { G.zs += p.z - (p.zb || 0); G.n++; }
    }
    groups.forEach((G, name) => { G.z = G.zs / Math.max(1, G.n) + (GROUP_Z[name.slice(0, 3)] || 0); G.svg = merged(C, G.list); });
    items.sort((a, b) => a.z - b.z);
    const pl = sk.P.pelvis, g = sp(C, [pl[0], 0, pl[2]]), lift = Math.max(0, Math.min(sk.P.lAn[1], sk.P.rAn[1]) - REST.lFt[1]), sq = pose.sq || 0;
    const rxs = (15.5 + Math.abs(sk.P.lAn[0] - sk.P.rAn[0]) * 0.55) * (1 - Math.min(0.45, lift / 30));
    const shadow = `<ellipse cx="${f1(g.x)}" cy="${f1(g.y + 0.8)}" rx="${f1(rxs)}" ry="${f1(rxs * 0.24)}" fill="#081B45" opacity="${f3(0.2 * (1 - Math.min(0.6, lift / 30)))}"/>`;
    const tr = sq ? ` transform="translate(${f1(g.x)} ${f1(g.y)}) scale(${f3(1 - sq * 0.5)} ${f3(1 + sq)}) translate(${f1(-g.x)} ${f1(-g.y)})"` : "";
    return `<defs>${opts.pal ? "" : C.pal.add.join("")}${C.defs.join("")}</defs>${opts.face ? "" : shadow}<g${tr}>${items.map((p) => p.svg).join("")}</g>`;
}

/* ---------- the camera and the frame boxes ---------- */
export const YAW = -30, PITCH = 9;   // three-quarters, a little from above: the angle the Southbound demos use
const BODY_BOX = { x: -40, y: -108, w: 80, h: 113 };
let FACE_BOX = null;
const faceBox = () => {
    if (FACE_BOX) return FACE_BOX;
    const C = { M: mul(rx(PITCH), ry(YAW)) }, q = sp(C, skeleton(REST).P.head);
    return (FACE_BOX = { x: f1(q.x - 26), y: f1(q.y - 28), w: 52, h: 52 });
};
let uid = 0;
/**
 * The character as an <svg> string, standing still. opts: { size (px, default 160), face (head and shoulders),
 * pose (a move's name: show that move's key moment), yaw }. animate() brings one to life.
 */
export function svg(look, opts = {}) {
    const lk = typeof look === "string" ? (validLook(look) ? look : "") : stringify(look || {});
    const id = "bd" + (++uid), face = !!opts.face, size = opts.size || 160, yaw = opts.yaw != null ? opts.yaw : YAW, box = face ? faceBox() : BODY_BOX;
    const w = Math.round((size * box.w) / box.h), P = opts.pose && MOVES[opts.pose] ? poseAt(opts.pose, MOVES[opts.pose].peak, 0) : poseAt("", 0, 1.2);
    return `<svg class="bd${face ? " bd-face" : ""}" id="${id}" data-lk="${lk}" data-yaw="${yaw}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="${w}" height="${size}" role="img" aria-hidden="true">${frame(lk, P, { yaw, face, id })}</svg>`;
}

/* ---------- bringing it to life (the page only) ----------
   One animation loop for every live character on the page: 30 frames a second during a move, a spin, a drag or a
   blink, and 10 when just standing (standing still moves so slowly that 10 looks the same), paused while a character
   is off screen, dropped once it's gone from the page. The loop keeps an eye on
   how long drawing takes: when the characters on screen would use more than 40% of the page's time (a slow
   Chromebook, or three on the podium), they all slow down evenly, never below 12 frames a second for a move, and
   one frame never spends more than 12 ms drawing (the rest wait a frame), so buttons and timers stay quick.
   Reduced motion: no loop, and a move shows as its key moment. */
const LIVE = new Set();
const FRAME_MS = { move: 33, idle: 100 }, SLOWEST_MS = { move: 83, idle: 160 }, BUSY = 0.4, BUDGET_MS = 12;
let raf = 0, watcher = null, cost = 3, turnOf = 0;   // cost: how long one character takes to draw (ms), a running average
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const svgIn = (el) => (!el ? null : el.matches && el.matches("svg.bd") ? el : el.querySelector ? el.querySelector("svg.bd") : null);
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
function stateOf(s) {
    return s._bd || (s._bd = { lk: s.getAttribute("data-lk") || "", face: s.classList.contains("bd-face"), yaw: +s.getAttribute("data-yaw") || YAW, t0: now() - Math.random() * 3000,
        move: "", mt: 0, loop: false, gap: 0, on: false, last: 0, hot: 0, vis: true, gone: 0, lag: [0, 0, 0], lagV: [0, 0, 0], prev: null, spin: null, pal: null, palEl: null, frEl: null });
}
const still = (s, st) => { const m = MOVES[st.move]; st.pal = null; s.innerHTML = frame(st.lk, m ? poseAt(st.move, m.peak, 0) : poseAt("", 0, 1.2), { yaw: st.yaw, face: st.face, id: s.id }); };
/** Draw one frame of a live character. Its colors stay in the page between frames; only new ones are added. */
function render(s, st, P, yaw) {
    const o = { yaw, face: st.face, id: s.id, pal: st.pal };
    if (!st.pal || !st.frEl || st.frEl.parentNode !== s) {
        o.pal = st.pal = newPalette(s.id);
        const body = frame(st.lk, P, o);
        s.innerHTML = `<defs>${st.pal.add.join("")}</defs><g>${body}</g>`;
        st.pal.add = []; st.palEl = s.firstChild; st.frEl = s.lastChild;
        return;
    }
    const body = frame(st.lk, P, o);
    if (st.pal.add.length) { st.palEl.insertAdjacentHTML("beforeend", st.pal.add.join("")); st.pal.add = []; }
    st.frEl.innerHTML = body;
}
/**
 * Start (or keep) a character moving. el: the <svg> or something holding it.
 * opts: { move (play it once), loop (keep replaying it, with gap seconds standing between), delay (seconds before it
 * starts), spin (a full turn into place) }. Looping characters keep to their own clock, so several of them can take turns.
 */
export function animate(el, opts = {}) {
    const s = svgIn(el); if (!s) return;
    const st = stateOf(s), t = now();
    if (opts.move && MOVES[opts.move]) { st.move = opts.move; st.mt = t + (+opts.delay || 0) * 1000; st.loop = !!opts.loop; st.gap = opts.gap != null ? +opts.gap : 1.4; }
    if (opts.spin) st.spin = { t0: t, from: st.yaw - 360, to: st.yaw, dur: 1100 };
    if (reduceMotion()) { still(s, st); return; }
    if (!watcher && typeof IntersectionObserver === "function") watcher = new IntersectionObserver((es) => es.forEach((e) => { if (e.target._bd) e.target._bd.vis = e.isIntersecting; }));
    if (!LIVE.has(s)) { LIVE.add(s); if (watcher) watcher.observe(s); }
    if (!raf && typeof requestAnimationFrame === "function") raf = requestAnimationFrame(tick);
}
/** Play one move, then go back to standing. */
export function emote(el, move) { animate(el, { move }); }
/** Turn a character by some degrees (dragging it round in the studio). */
export function turn(el, deg) {
    const s = svgIn(el); if (!s) return;
    const st = stateOf(s); st.yaw = (st.spin && st.shown != null ? st.shown : st.yaw) + deg; st.spin = null; st.hot = now() + 300;
    if (reduceMotion()) still(s, st); else animate(s);
}
/** Ease a character round to face a way (degrees; the three-quarter view when left out), the short way round. */
export function turnTo(el, deg = YAW) {
    const s = svgIn(el); if (!s) return;
    const st = stateOf(s), cur = st.spin && st.shown != null ? st.shown : st.yaw, d = ((((cur - deg) % 360) + 540) % 360) - 180;
    st.yaw = deg; st.spin = null;
    if (reduceMotion()) { still(s, st); return; }
    if (Math.abs(d) >= 0.5) st.spin = { t0: now(), from: deg + d, to: deg, dur: 450 + 3.5 * Math.abs(d) };
    animate(s);
}
/** Change a live character's outfit without restarting it. */
export function restyle(el, look) { const s = svgIn(el); if (!s) return; const st = stateOf(s); st.lk = look; st.pal = null; st.last = 0; s.setAttribute("data-lk", look); if (reduceMotion()) still(s, st); else animate(s); }
/** Seconds into the move (looping ones count from the start of the current go); below 0 or past the end: standing. */
function moveTime(st, ts) {
    const m = MOVES[st.move];
    let mt = (ts - st.mt) / 1000;
    if (m && st.loop && mt > 0) mt %= m.dur + st.gap;
    return mt;
}
const playing = (st, ts) => { const m = MOVES[st.move], mt = m ? moveTime(st, ts) : -1; return !!m && mt >= 0 && mt <= m.dur; };
/** "move" (full speed) during a move and while it settles, a spin, a drag or a blink (and just after, to open the eyes
 *  again); else "idle", including the standing between goes of a looping move. */
function pace(st, ts) {
    if (st.spin || ts < st.hot || playing(st, ts)) return "move";
    const t = (ts - st.t0) / 1000;
    return blinkAt(t) > 0 || blinkAt(t - 0.05) > 0 ? "move" : "idle";
}
function tick(ts) {
    raf = 0;
    const live = [...LIVE];
    // How busy would every character on screen keep the page at full speed? (Laying out and painting a frame takes
    // about as long again as building it.)
    let busy = 0;
    for (const s of live) { const st = s._bd; if (st.vis && s.isConnected) busy += (2 * cost) / FRAME_MS[pace(st, ts)]; }
    const slow = Math.max(1, busy / BUSY), t0 = now();
    let drawn = 0;
    for (let j = 0; j < live.length; j++) {
        const s = live[(j + turnOf) % live.length], st = s._bd;   // take turns going first, so a slow frame is fair
        if (!s.isConnected) { if (++st.gone > 90) { LIVE.delete(s); if (watcher) watcher.unobserve(s); } continue; }
        st.gone = 0;
        const kind = pace(st, ts);
        if (!st.vis || ts - st.last < Math.min(FRAME_MS[kind] * slow, SLOWEST_MS[kind]) - 2) continue;
        if (drawn && now() - t0 > BUDGET_MS) break;   // this frame has drawn enough; the rest go next frame
        const dt = st.last ? Math.min(0.1, (ts - st.last) / 1000) : 0.033; st.last = ts;
        let m = MOVES[st.move];
        const mt = moveTime(st, ts), on = !!m && mt >= 0 && mt <= m.dur;
        if (st.on && !on) st.hot = ts + 600;   // just finished: full speed a moment longer while it settles
        st.on = on;
        if (m && !st.loop && mt > m.dur) { st.move = ""; m = null; }
        const P = poseAt(on ? st.move : "", mt, (ts - st.t0) / 1000);
        // Follow-through: capes, long hair and flames trail behind when the body moves.
        if (st.prev) {
            const v = scale(sub(P.pos, st.prev), 1 / dt), want = v.map((x) => Math.max(-5, Math.min(5, -x * 0.09)));
            st.lagV = st.lagV.map((x, i) => x + (60 * (want[i] - st.lag[i]) - 8 * x) * dt);
            st.lag = st.lag.map((x, i) => x + st.lagV[i] * dt);
        }
        st.prev = P.pos.slice(); P.lag = st.lag;
        let yaw = st.yaw;
        if (st.spin) { const u = (ts - st.spin.t0) / st.spin.dur; if (u >= 1) { st.spin = null; st.hot = ts + 150; } else yaw = st.spin.from + (st.spin.to - st.spin.from) * EASE.out(Math.max(0, u)); }
        st.shown = yaw;
        const c0 = now();
        render(s, st, P, yaw);
        cost += (now() - c0 - cost) * 0.1;
        drawn++;
    }
    turnOf++;
    if (LIVE.size) raf = requestAnimationFrame(tick);
}
