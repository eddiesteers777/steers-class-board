/* ==========================================
   Anchor Board — the student character ("Buddy"): Anchor Board's own cartoon kid, drawn here in SVG.
   Pure functions, no page or store: the same code draws the character on the student page (play.html),
   the teacher's Remote and the board, and checks a look on the Remote.

   A look is a short string, one letter + one digit (base 36) per part, like "s2h1c0e0m0t1u2b0v0f0w3a0k0g0x0":
     s skin · h hair · c hair color · e eyes · m mouth · t top · u top color · b bottoms · v bottoms color
     f shoes · w shoe color · a hat · k hat color · g glasses · x back (backpack, cape, rocket pack)
   Most pieces are open to everyone. A few are earned (XP, level = locks cracked, a badge), never bought.

   Animations are CSS on named groups (css/buddy.css): idle bob and breathing, blinking, and the moves
   "wave", "dance", "cheer" and "oops" (a shrug after a miss). Reduced motion turns them all off.
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

/* ---------- drawing ---------- */
const shade = (hex, f) => {   // darker (f < 0) or lighter (f > 0)
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = f < 0 ? 0 : 255, p = Math.abs(f);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};
const INK = "#1B2238";
const col = (i) => (COLORS[i] || COLORS[0])[0];

function hairBack(o, hc) {
    const d = shade(hc, -0.15);
    switch (o.h) {
        case 3: return `<path d="M52 70 C48 112 54 134 66 140 L134 140 C146 134 152 112 148 70 Z" fill="${d}"/>`;   // long
        case 4: return `<circle cx="58" cy="40" r="17" fill="${hc}"/><circle cx="142" cy="40" r="17" fill="${hc}"/>`;   // buns
        case 6: return `<circle cx="52" cy="52" r="24" fill="${hc}"/><circle cx="148" cy="52" r="24" fill="${hc}"/>`;   // puffs
        case 8: return `<path d="M58 90 q-8 30 -2 62" stroke="${hc}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M142 90 q8 30 2 62" stroke="${hc}" stroke-width="12" fill="none" stroke-linecap="round"/>` +
            `<circle cx="56" cy="156" r="6" fill="${col(o.k)}"/><circle cx="144" cy="156" r="6" fill="${col(o.k)}"/>`;   // braids
        default: return "";
    }
}
function hairFront(o, hc, hatOn) {
    const hl = shade(hc, 0.18);
    if (hatOn) {   // under a cap, beanie or bucket hat: just the sides show
        return o.h === 9 || o.h === 5 ? "" : `<path d="M55 68 q-3 16 4 26 l7 -4 q-4 -10 -2 -22 Z" fill="${hc}"/><path d="M145 68 q3 16 -4 26 l-7 -4 q4 -10 2 -22 Z" fill="${hc}"/>`;
    }
    switch (o.h) {
        case 0: return `<path d="M54 76 C50 12 150 12 146 76 C140 62 128 56 116 60 C106 52 88 54 80 60 C70 56 58 62 54 76 Z" fill="${hc}"/><path d="M78 40 q20 -10 44 -2" stroke="${hl}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".6"/>`;
        case 1: return `<path d="M54 74 L56 46 L68 54 L72 26 L86 44 L96 18 L106 42 L120 22 L126 46 L142 34 L140 56 L148 66 C136 60 120 56 100 56 C80 56 64 62 54 74 Z" fill="${hc}"/>`;
        case 2: return [[60, 58, 13], [72, 42, 14], [90, 34, 15], [110, 34, 15], [128, 42, 14], [140, 58, 13], [80, 54, 11], [100, 50, 12], [120, 54, 11]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${hc}"/>`).join("") + `<circle cx="96" cy="36" r="4" fill="${hl}" opacity=".6"/>`;
        case 3: return `<path d="M52 82 C46 10 154 10 148 82 C144 66 132 58 120 58 C112 66 98 70 84 66 C72 64 60 68 52 82 Z" fill="${hc}"/>`;
        case 4: return `<path d="M56 72 C52 14 148 14 144 72 C130 58 70 58 56 72 Z" fill="${hc}"/>`;
        case 5: return `<path d="M56 70 C54 14 146 14 144 70 C128 56 72 56 56 70 Z" fill="${hc}" opacity=".55"/>`;
        case 6: return `<path d="M56 72 C52 16 148 16 144 72 C130 60 70 60 56 72 Z" fill="${hc}"/>`;
        case 7: return `<path d="M54 74 C50 10 150 10 148 70 C140 58 124 50 100 56 C86 60 72 72 62 88 C58 84 55 80 54 74 Z" fill="${hc}"/><path d="M84 42 q30 -12 52 4" stroke="${hl}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".6"/>`;
        case 8: return `<path d="M54 76 C50 12 150 12 146 76 C134 60 116 56 100 62 C84 56 66 60 54 76 Z" fill="${hc}"/><path d="M100 30 v30" stroke="${shade(hc, -0.25)}" stroke-width="3"/>`;
        default: return "";
    }
}
function eyes(o) {
    const L = 82, R = 118, Y = 84;
    const dot = (x, big) => `<ellipse cx="${x}" cy="${Y}" rx="${big ? 7.5 : 5.5}" ry="${big ? 9 : 7}" fill="${INK}"/><circle cx="${x + 2}" cy="${Y - 3}" r="${big ? 2.8 : 2}" fill="#fff"/>` + (big ? `<circle cx="${x - 2.5}" cy="${Y + 3}" r="1.4" fill="#fff"/>` : "");
    const arc = (x) => `<path d="M${x - 7} ${Y + 2} q7 -9 14 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    switch (o.e) {
        case 1: return arc(L) + arc(R);
        case 2: return dot(L, 1) + dot(R, 1);
        case 3: return `<path d="M${L - 7} ${Y} q7 5 14 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M${R - 7} ${Y} q7 5 14 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
        case 4: return dot(L) + dot(R) + `<path d="M${L - 9} ${Y - 14} l14 4" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M${R + 9} ${Y - 14} l-14 4" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
        case 5: return dot(L) + arc(R);
        default: return dot(L) + dot(R);
    }
}
function mouth(o) {
    switch (o.m) {
        case 1: return `<path d="M86 100 q14 18 28 0 Z" fill="${INK}"/><path d="M89 101 h22 l-2 4 h-18 Z" fill="#fff"/>`;
        case 2: return `<ellipse cx="100" cy="104" rx="6" ry="7" fill="${INK}"/>`;
        case 3: return `<path d="M90 103 q10 6 20 -4" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
        case 4: return `<path d="M88 100 q12 14 24 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M98 106 q4 9 9 1 z" fill="#E85A71"/>`;
        default: return `<path d="M89 101 q11 11 22 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    }
}
function hat(o) {
    const c = col(o.k), d = shade(c, -0.22), l = shade(c, 0.25);
    switch (o.a) {
        case 1: return `<path d="M54 64 C54 22 146 22 146 64 Z" fill="${c}"/><path d="M118 60 C140 56 166 60 170 68 C150 70 130 68 118 66 Z" fill="${d}"/><circle cx="100" cy="26" r="4" fill="${d}"/><path d="M100 26 v36" stroke="${d}" stroke-width="2" opacity=".5"/>`;
        case 2: return `<path d="M54 66 C52 20 148 20 146 66 Z" fill="${c}"/><rect x="50" y="56" width="100" height="16" rx="8" fill="${d}"/><circle cx="100" cy="20" r="10" fill="${l}"/>` + [64, 80, 96, 112, 128].map((x) => `<path d="M${x} 58 v12" stroke="${c}" stroke-width="3" opacity=".6"/>`).join("");
        case 3: return `<path d="M62 60 C62 26 138 26 138 60 Z" fill="${c}"/><path d="M42 66 C50 52 150 52 158 66 C150 74 50 74 42 66 Z" fill="${d}"/><rect x="62" y="52" width="76" height="7" fill="${l}" opacity=".7"/>`;
        case 4: return `<path d="M56 60 C70 48 130 48 144 60 L144 68 C130 56 70 56 56 68 Z" fill="${c}"/>`;
        case 5: return `<path d="M52 76 C48 14 152 14 148 76" stroke="${INK}" stroke-width="7" fill="none"/><rect x="42" y="66" width="18" height="28" rx="8" fill="${c}"/><rect x="140" y="66" width="18" height="28" rx="8" fill="${c}"/>`;
        case 6: return `<path d="M64 52 L66 24 L82 40 L100 18 L118 40 L134 24 L136 52 Z" fill="#E6B422" stroke="#A86F00" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="36" r="5" fill="#D94848"/><circle cx="80" cy="44" r="3.5" fill="#7FAEDD"/><circle cx="120" cy="44" r="3.5" fill="#2E9A69"/>`;
        case 7: return `<path d="M62 58 C62 40 138 40 138 58 Z" fill="${INK}"/><path d="M44 40 L100 22 L156 40 L100 58 Z" fill="${INK}"/><path d="M100 40 L140 46 L142 66" stroke="${c}" stroke-width="3" fill="none"/><circle cx="142" cy="68" r="5" fill="${c}"/>`;
        default: return "";
    }
}
function glasses(o) {
    switch (o.g) {
        case 1: return `<g><rect x="68" y="74" width="28" height="20" rx="8" fill="${INK}"/><rect x="104" y="74" width="28" height="20" rx="8" fill="${INK}"/><path d="M96 82 h8" stroke="${INK}" stroke-width="4"/><path d="M73 78 l8 0" stroke="#fff" stroke-width="2.5" opacity=".5" stroke-linecap="round"/><path d="M109 78 l8 0" stroke="#fff" stroke-width="2.5" opacity=".5" stroke-linecap="round"/></g>`;
        case 2: return `<g fill="none" stroke="${INK}" stroke-width="3.5"><circle cx="82" cy="84" r="13"/><circle cx="118" cy="84" r="13"/><path d="M95 84 h10"/></g>`;
        case 3: return `<path d="M60 76 C80 70 120 70 140 76 L138 92 C118 98 82 98 62 92 Z" fill="#7FAEDD" opacity=".75" stroke="${INK}" stroke-width="3"/><path d="M70 80 h20" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>`;
        case 4: { const star = (cx) => { let p = ""; for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 16, a = -Math.PI / 2 + i * Math.PI / 5; p += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(1) + " " + (84 + r * Math.sin(a)).toFixed(1); } return `<path d="${p}Z" fill="#F2B33D" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`; }; return star(82) + star(118) + `<path d="M97 84 h6" stroke="${INK}" stroke-width="3"/>`; }
        case 5: return `<rect x="52" y="78" width="96" height="10" rx="5" fill="${INK}"/><circle cx="82" cy="84" r="15" fill="#B9E3F2" stroke="${INK}" stroke-width="5"/><circle cx="118" cy="84" r="15" fill="#B9E3F2" stroke="${INK}" stroke-width="5"/><circle cx="86" cy="80" r="4" fill="#fff"/><circle cx="122" cy="80" r="4" fill="#fff"/>`;
        default: return "";
    }
}
function backItem(o, front) {
    const c = col(o.u === 1 ? 0 : 1);
    switch (o.x) {
        case 1: return front ? `<path d="M74 120 v40" stroke="${INK}" stroke-width="5" opacity=".75"/><path d="M126 120 v40" stroke="${INK}" stroke-width="5" opacity=".75"/>` : `<rect x="66" y="116" width="68" height="62" rx="16" fill="${shade(c, -0.1)}"/>`;
        case 2: return front ? `<path d="M76 116 L100 128 L124 116" stroke="${shade("#D94848", -0.2)}" stroke-width="6" fill="none" stroke-linecap="round"/>` : `<path class="bd-cape" d="M74 118 C60 160 52 196 48 222 C80 212 120 212 152 222 C148 196 140 160 126 118 Z" fill="#D94848"/>`;
        case 3: return front ? "" : `<rect x="60" y="120" width="22" height="50" rx="10" fill="#9DB0CF"/><rect x="118" y="120" width="22" height="50" rx="10" fill="#9DB0CF"/><g class="bd-flame"><path d="M64 170 q7 26 14 0 Z" fill="#F28C28"/><path d="M122 170 q7 26 14 0 Z" fill="#F28C28"/><path d="M67 170 q4 14 8 0 Z" fill="#FFE3A3"/><path d="M125 170 q4 14 8 0 Z" fill="#FFE3A3"/></g>`;
        case 4: return front ? "" : `<g class="bd-wings"><path d="M70 130 C40 110 22 120 18 150 C34 140 46 146 52 158 C58 146 66 140 72 142 Z" fill="#B9D3EE" stroke="#7FAEDD" stroke-width="2"/><path d="M130 130 C160 110 178 120 182 150 C166 140 154 146 148 158 C142 146 134 140 128 142 Z" fill="#B9D3EE" stroke="#7FAEDD" stroke-width="2"/></g>`;
        default: return "";
    }
}
function legs(o, skin) {
    const c = col(o.v), d = shade(c, -0.18);
    let out = `<rect x="78" y="172" width="19" height="52" rx="9" fill="${skin}"/><rect x="103" y="172" width="19" height="52" rx="9" fill="${skin}"/>`;
    if (o.b === 0 || o.b === 2) {
        out += `<path d="M74 168 h52 v54 a3 3 0 0 1 -3 3 h-17 l-3 -40 h-6 l-3 40 h-17 a3 3 0 0 1 -3 -3 Z" fill="${c}"/>`;
        if (o.b === 0) out += `<path d="M100 172 v12" stroke="${d}" stroke-width="2"/><path d="M80 176 q6 4 12 0" stroke="${d}" stroke-width="2" fill="none"/>`;
        else out += `<rect x="76" y="214" width="22" height="9" rx="4" fill="${d}"/><rect x="102" y="214" width="22" height="9" rx="4" fill="${d}"/><path d="M78 176 v34 M122 176 v34" stroke="#fff" stroke-width="2.5" opacity=".7"/>`;
    } else if (o.b === 1 || o.b === 4) {
        out += `<path d="M72 168 h56 l2 30 h-26 l-4 -12 l-4 12 h-26 Z" fill="${c}"/>`;
        if (o.b === 4) out += `<rect x="76" y="182" width="14" height="10" rx="2" fill="${d}"/><rect x="110" y="182" width="14" height="10" rx="2" fill="${d}"/>`;
    } else if (o.b === 3) {
        out += `<path d="M76 166 h48 l12 36 h-72 Z" fill="${c}"/><path d="M76 172 h48" stroke="${d}" stroke-width="3"/>`;
    }
    return out;
}
function shoes(o) {
    const c = col(o.w), d = shade(c, -0.25);
    let one;   // the right shoe, toe pointing right; the left one is its mirror image
    switch (o.f) {
        case 1: one = `<path d="M102 204 h20 v18 h10 a7 7 0 0 1 0 14 h-30 Z" fill="${c}"/><path d="M102 232 h37" stroke="#fff" stroke-width="4"/><path d="M106 211 h12 M106 217 h12" stroke="#fff" stroke-width="2"/>`; break;
        case 2: one = `<path d="M102 206 h20 v16 h10 a7 7 0 0 1 0 14 h-30 Z" fill="#6B4A2E"/><rect x="101" y="232" width="38" height="5" rx="2" fill="#3A2A1C"/>`; break;
        case 3: one = `<rect x="100" y="232" width="38" height="5" rx="2.5" fill="${d}"/><rect x="104" y="224" width="24" height="9" rx="4" fill="${c}"/>`; break;
        case 4: one = `<path d="M102 220 h30 a7 7 0 0 1 0 14 h-30 Z" fill="${c}"/><path d="M102 230 h36" stroke="#fff" stroke-width="3" opacity=".8"/><g class="bd-kick"><path d="M106 236 q6 16 12 0 Z" fill="#F28C28"/><path d="M120 236 q6 12 12 0 Z" fill="#FFE3A3"/></g>`; break;
        default: one = `<path d="M102 220 h30 a7 7 0 0 1 0 14 h-30 Z" fill="${c}"/><path d="M102 232 h36" stroke="#fff" stroke-width="3.5"/><circle cx="120" cy="225" r="2" fill="${d}"/>`;
    }
    return `<g transform="translate(200 0) scale(-1 1)">${one}</g>${one}`;
}
function torso(o, skin) {
    const c = col(o.u), d = shade(c, -0.18), l = shade(c, 0.3), light = o.u === 9;
    const txt = light ? INK : "#fff";
    let out = `<rect x="92" y="104" width="16" height="14" rx="4" fill="${shade(skin, -0.12)}"/>`;
    if (o.t === 2) out += `<path d="M70 120 C70 112 78 112 82 112 L88 112 C90 120 110 120 112 112 L118 112 C122 112 130 112 130 120 L130 172 C130 176 126 178 122 178 L78 178 C74 178 70 176 70 172 Z" fill="${c}"/>`;
    else out += `<rect x="64" y="110" width="72" height="68" rx="22" fill="${c}"/>`;
    if (o.t === 1) out += `<path d="M78 110 C80 126 120 126 122 110" stroke="${d}" stroke-width="6" fill="none"/><path d="M94 122 l-2 18 M106 122 l2 18" stroke="${l}" stroke-width="3" stroke-linecap="round"/><rect x="80" y="150" width="40" height="18" rx="8" fill="${d}"/>`;
    if (o.t === 3) out += `<path d="M66 128 h68" stroke="${l}" stroke-width="5" opacity=".7"/><text x="100" y="164" text-anchor="middle" font-family="Bricolage Grotesque,Arial,sans-serif" font-weight="800" font-size="26" fill="${txt}">7</text>`;
    if (o.t === 4) out += `<path d="M100 112 V178" stroke="${d}" stroke-width="3"/><path d="M84 112 L100 136 L116 112" fill="#F4F7FB"/><rect x="72" y="150" width="14" height="4" rx="2" fill="${d}"/><rect x="114" y="150" width="14" height="4" rx="2" fill="${d}"/>`;
    if (o.t === 5) out += `<text x="100" y="156" text-anchor="middle" font-family="Bricolage Grotesque,Arial,sans-serif" font-weight="800" font-size="24" fill="${txt}">π</text>`;
    if (o.t === 0) out += `<path d="M86 112 q14 10 28 0" stroke="${d}" stroke-width="3" fill="none"/>`;
    return out;
}
function arm(o, skin, side) {
    // Drawn hanging from the shoulder and tilted a little outward; CSS swings the group from the shoulder.
    const c = col(o.u), sleeve = o.t === 2 ? 0 : o.t === 1 || o.t === 4 ? 38 : 20, sx = side < 0 ? 66 : 134;
    const tilt = side < 0 ? 10 : -10;
    return `<g transform="rotate(${tilt} ${sx} 120)"><rect x="${sx - 8}" y="114" width="16" height="50" rx="8" fill="${skin}"/>` +
        (sleeve ? `<rect x="${sx - 10}" y="112" width="20" height="${sleeve}" rx="10" fill="${c}"/><rect x="${sx - 10}" y="${112 + sleeve - 6}" width="20" height="6" rx="3" fill="${shade(c, -0.15)}"/>` : "") +
        `<circle cx="${sx}" cy="166" r="9" fill="${skin}"/></g>`;
}

let uid = 0;
/**
 * The character as an SVG string. opts: { size (px, default 160), face (head and shoulders only), move ("" | wave | dance | cheer | oops), still (no idle motion) }.
 * Each one gets its own id so many can share a page.
 */
export function svg(look, opts = {}) {
    const o = typeof look === "string" ? parse(look) : Object.assign(parse(""), look || {});
    const skin = SKINS[o.s] || SKINS[0], hc = HAIR_COLORS[o.c] ? HAIR_COLORS[o.c][0] : HAIR_COLORS[0][0], hatOn = [1, 2, 3, 7].includes(o.a);
    const id = "bd" + (++uid), face = !!opts.face, size = opts.size || 160;
    const vb = face ? "34 6 132 132" : "0 0 200 250", w = face ? size : Math.round(size * 0.8), h = size;
    const hb = hairBack(o, hc);
    const head = `<g class="bd-head"><circle cx="54" cy="84" r="9" fill="${skin}"/><circle cx="146" cy="84" r="9" fill="${skin}"/>` +
        `<circle cx="100" cy="78" r="46" fill="${skin}"/><path d="M60 96 C70 120 130 120 140 96 C130 112 70 112 60 96 Z" fill="${shade(skin, -0.08)}" opacity=".5"/>` +
        `<ellipse cx="72" cy="98" rx="7" ry="4.5" fill="#F28CB8" opacity=".35"/><ellipse cx="128" cy="98" rx="7" ry="4.5" fill="#F28CB8" opacity=".35"/>` +
        `<g class="bd-eyes">${eyes(o)}</g>${mouth(o)}${hairFront(o, hc, hatOn)}${hat(o)}${glasses(o)}</g>`;
    if (face) return `<svg class="bd bd-face" id="${id}" viewBox="${vb}" width="${w}" height="${h}" role="img" aria-hidden="true">${hb}${torso(o, skin)}${head}</svg>`;
    const cls = "bd" + (opts.move ? " bd-" + opts.move : "") + (opts.still ? " bd-still" : "");
    return `<svg class="${cls}" id="${id}" viewBox="${vb}" width="${w}" height="${h}" role="img" aria-hidden="true">` +
        `<ellipse class="bd-shadow" cx="100" cy="240" rx="46" ry="7" fill="#081B45" opacity=".18"/>` +
        `<g class="bd-body">${backItem(o, false)}${hb ? `<g class="bd-head">${hb}</g>` : ""}${legs(o, skin)}${shoes(o)}` +
        `<g class="bd-torso">${torso(o, skin)}${backItem(o, true)}</g>` +
        `<g class="bd-arm bd-arml">${arm(o, skin, -1)}</g><g class="bd-arm bd-armr">${arm(o, skin, 1)}</g>${head}</g></svg>`;
}

const MOVES = ["wave", "dance", "cheer", "oops"];
/** Play one move on a character already on the page (el: the <svg class="bd"> or anything holding one), then go back to idle. */
export function emote(el, move) {
    const s = el && (el.matches && el.matches("svg.bd") ? el : el.querySelector && el.querySelector("svg.bd:not(.bd-face)"));
    if (!s || !MOVES.includes(move)) return;
    MOVES.forEach((m) => s.classList.remove("bd-" + m));
    void s.getBoundingClientRect();   // restart the animation if the same move is played twice
    s.classList.add("bd-" + move);
    clearTimeout(s._bdT); s._bdT = setTimeout(() => s.classList.remove("bd-" + move), 1900);
}
