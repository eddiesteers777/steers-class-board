/* ==========================================
   Anchor Board — Vault Raid, the rules both sides share.
   Pure functions only (no page, no store), so they can be tested on their own.
   The student page (play.html) and the teacher's Remote (js/liveRoom.js) both use them.

   Vault Raid is Anchor Board's own game: every student has a vault with a secret
   3-digit code. Right answers earn coins and a "hack". A hack is one guess at a
   classmate's code; the board-style marks (right spot, wrong spot, not in it)
   let a student work the code out. Cracking a vault takes a share of its coins.
========================================== */

export const CODE_LEN = 3;
export const RIGHT_COINS = 10, STREAK_STEP = 5, STREAK_MAX = 25;   // 10, 15, 20, 25, 25…
export const MAX_HACKS = 3, STEAL_SHARE = 0.25, STEAL_MIN = 10, SHIELD_MS = 45000;

/** Coins for a right answer at this streak (the streak counts this answer). */
export const coinsFor = (streak) => Math.min(STREAK_MAX, RIGHT_COINS + STREAK_STEP * Math.max(0, streak - 1));

/** A vault code is 3 different digits, 1 to 9. */
export const validCode = (s) => typeof s === "string" && /^[1-9]{3}$/.test(s) && new Set(s).size === CODE_LEN;
export function randomCode(rand = Math.random) {
    const d = [..."123456789"];
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d.slice(0, CODE_LEN).join("");
}
/** Marks for one guess, one per digit: 2 = right digit, right spot; 1 = in the code, wrong spot; 0 = not in the code. */
export function codeMarks(secret, guess) {
    return [...guess].map((g, i) => (secret[i] === g ? 2 : secret.includes(g) ? 1 : 0)).join("");
}
/** Coins a crack takes from a vault holding this many. */
export const stealFrom = (coins) => Math.max(0, Math.min(coins, Math.max(STEAL_MIN, Math.round(coins * STEAL_SHARE))));

/* ---------- characters and power-ups ---------- */
/** Characters a student picks in the waiting room (an index into this list is saved). */
export const AVATARS = [["🦊", "Fox"], ["🐼", "Panda"], ["🐸", "Frog"], ["🐙", "Octopus"], ["🦁", "Lion"], ["🐯", "Tiger"], ["🐵", "Monkey"], ["🦄", "Unicorn"],
    ["🐲", "Dragon"], ["🐧", "Penguin"], ["🦉", "Owl"], ["🐢", "Turtle"], ["🤖", "Robot"], ["👾", "Alien"], ["🦈", "Shark"], ["🐝", "Bee"]];
export const avatar = (i) => AVATARS[(+i >= 0 && +i < AVATARS.length) ? +i : 0];
/** The power-up a student picks before the game starts. Each helps once or all game, as it says. */
export const STARTERS = [
    ["shield", "Shield", "Blocks the first hack that would crack your vault."],
    ["head", "Head start", "Start the game with 25 coins."],
    ["double", "Double down", "Your first 3 right answers earn double coins."],
    ["keys", "Master keys", "Start with 2 hacks ready to use."],
    ["insure", "Insurance", "If your vault is cracked, you lose half as much. All game."],
];
export const starter = (k) => STARTERS.find((x) => x[0] === k) || null;
export const BOX_EVERY = 3, BONUS_MS = 60000;
/** What a mystery box can hold (every 3rd right answer earns one). */
export const BOXES = [["bag", "Coin bag"], ["hack", "Extra hack"], ["double", "Double coins"], ["firewall", "Firewall"]];
export function rollBox(rand = Math.random) {
    const k = BOXES[Math.floor(rand() * BOXES.length)][0];
    return k === "bag" ? { k, v: 15 + 5 * Math.floor(rand() * 4) } : k === "double" ? { k, v: 2 } : k === "firewall" ? { k, v: 60 } : { k, v: 1 };
}

/* ---------- vault skins: a new look for a student's vault, unlocked by coins ---------- */
/** [key, name, coins needed, colors]. A skin unlocks at the most coins a student has held this game, so a crack never locks one again. */
export const SKINS = [
    ["steel", "Steel", 0, { door: "#10358A", ring: "#7FAEDD", face: "#F4F7FB" }],
    ["ocean", "Ocean", 40, { door: "#0B6E8A", ring: "#5FD4E8", face: "#EFFBFD" }],
    ["jungle", "Jungle", 80, { door: "#17663F", ring: "#6BD89A", face: "#F1FBF5" }],
    ["lava", "Lava", 140, { door: "#8E1F1F", ring: "#F28C28", face: "#FFF3E8" }],
    ["gold", "Gold", 220, { door: "#A86F00", ring: "#FFE3A3", face: "#FFFBEF" }],
    ["galaxy", "Galaxy", 320, { door: "#2B1460", ring: "#B98CFF", face: "#F4EEFF", stars: 1 }],
    ["diamond", "Diamond", 450, { door: "#2F6690", ring: "#E6F6FF", face: "#FFFFFF", shine: 1 }],
];
export const skin = (i) => SKINS[(Number.isInteger(+i) && +i >= 0 && +i < SKINS.length) ? +i : 0];
/** How many skins are open at this many coins (always at least Steel). */
export const skinsOpen = (top) => SKINS.filter((s) => (+top || 0) >= s[2]).length;

/* ---------- catch-up boost: a little extra for students who fall behind ---------- */
export const COMEBACK_AFTER = 60000, COMEBACK_SHARE = 0.5;
/** The bottom quarter of the leaderboard (4 or more playing), when they are behind the leader. rank is 1 for first. */
export const comebackOn = (rank, players, coins, leader) => players >= 4 && rank > Math.ceil(players * 0.75) && (+coins || 0) < (+leader || 0);
/** Extra coins on a right answer: half again, to the nearest 5. */
export const comebackPlus = (plus) => Math.max(5, Math.round((+plus || 0) * COMEBACK_SHARE / 5) * 5);

/* ---------- names ---------- */
/** "Rivera, Ava Maria" or "Ava Rivera" -> "Ava R." (first name and last initial only). */
export function shortName(full) {
    const s = String(full || "").replace(/\s+/g, " ").trim(); if (!s) return "";
    let first, last;
    if (s.includes(",")) { const [l, f] = s.split(",").map((x) => x.trim()); first = (f || "").split(" ")[0]; last = l; }
    else { const p = s.split(" "); first = p[0]; last = p.length > 1 ? p[p.length - 1] : ""; }
    first = first || last; if (!first) return "";
    return (first + (last && last !== first ? " " + last[0].toUpperCase() + "." : "")).slice(0, 24);
}
/** Short names for a roster, with more of the last name where two would match ("Ava Ro.", "Ava Ru."). */
export function shortNames(list) {
    const parts = (list || []).map((full) => {
        const s = String(full || "").replace(/\s+/g, " ").trim();
        if (s.includes(",")) { const [l, f] = s.split(",").map((x) => x.trim()); return [(f || "").split(" ")[0] || l, l]; }
        const p = s.split(" "); return [p[0], p.length > 1 ? p[p.length - 1] : ""];
    });
    const make = (f, l, n) => (l && l !== f ? f + " " + l.slice(0, n).replace(/^./, (c) => c.toUpperCase()) + "." : f);
    const len = parts.map(() => 1);
    for (let round = 0; round < 6; round++) {
        const names = parts.map(([f, l], i) => make(f, l, len[i]).toLowerCase()), seen = new Map();
        names.forEach((n, i) => { if (!seen.has(n)) seen.set(n, []); seen.get(n).push(i); });
        let clash = false;
        seen.forEach((ix) => { if (ix.length > 1) ix.forEach((i) => { if (len[i] < (parts[i][1] || "").length) { len[i]++; clash = true; } }); });
        if (!clash) break;
    }
    const out = parts.map(([f, l], i) => make(f, l, len[i]).slice(0, 24)), count = new Map();
    return out.map((n) => { const k = n.toLowerCase(), c = (count.get(k) || 0) + 1; count.set(k, c); return c > 1 ? n + " " + c : n; });
}
/** A name a student typed: letters, spaces, apostrophes, hyphens and dots, 2 to 20 characters. */
export function cleanTyped(s) {
    const t = String(s || "").replace(/[^A-Za-zÀ-ɏ' .-]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
    return t.length >= 2 ? t : "";
}

/* ---------- answers ---------- */
const UNITS = /^(?:[a-z]+(?:\^?[23²³])?|°[cf]?|degrees?|%)$/;
const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
/** Exponents written as superscripts (10⁵, 3³, cm²) become ^ (10^5, 3^3, cm^2), the same way a student types them. */
const supToCaret = (s) => s.replace(/([0-9a-z)])([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, (m, b, e) => b + "^" + [...e].map((c) => SUP[c]).join(""));
function norm(s) {
    let t = String(s == null ? "" : s).toLowerCase()
        // Stacked fractions written for the board, {1/10} and 4{2/3}, read as 1/10 and 4 2/3.
        .replace(/(\d)\s*\{([^{}/]+)\/([^{}/]+)\}/g, "$1 $2/$3").replace(/\{([^{}/]+)\/([^{}/]+)\}/g, "$1/$2")
        .replace(/[−‒–—]/g, "-").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/≠/g, "!=").replace(/[ \s]+/g, " ").replace(/(\d),(?=\d{3}\b)/g, "$1");
    t = supToCaret(t)
        .replace(/\s*\^\s*/g, "^").replace(/\^\((-?\d+)\)/g, "^$1")                     // 3 ^ 3, 3^(3)
        .replace(/(\d)\s*(?:×|x|\*|·|•)\s*10\^/g, "$1×10^")                               // 8 x 10^5, 8*10^5
        .replace(/\s*°\s*/g, "°").replace(/(\d)\s*degrees?\b/g, "$1°");
    return t.replace(/^\s*[a-z]\s*=(?![<>=])\s*/, "").replace(/^(-?[\d./ ]*\d)\s*=\s*[a-z]$/, "$1").replace(/[.\\/\s]+$/, "").replace(/^\$\s*/, "").trim();
}
/** A plain number, fraction, mixed number or decimal as a value; null for anything else. */
export function numberOf(s) {
    const t = String(s).replace(/\s+/g, " ").trim();
    let m = t.match(/^(-?)(\d+) (\d+)\/(\d+)$/);
    if (m) { const v = +m[2] + +m[3] / +m[4]; return +m[4] ? (m[1] ? -v : v) : null; }
    m = t.match(/^(-?\d*\.?\d+)\s*\/\s*(-?\d*\.?\d+)$/);
    if (m) return +m[2] ? +m[1] / +m[2] : null;
    m = t.match(/^[-+]?(\d+\.?\d*|\.\d+)$/);
    return m ? +t : null;
}
/** Split "12 cm" into ["12", "cm"]; anything else stays whole. */
function withUnit(s) {
    const m = s.match(/^(-?[\d./ ]*\d)\s*([a-z°%²³^23]+)$/);
    return m && UNITS.test(m[2]) ? [m[1].trim(), unitName(m[2].replace(/^degrees?$/, "°"))] : [s, ""];
}
/** One name for each unit, so "12 in" and "12 inches" match. */
const UNIT_NAMES = [["in", /^(in|inch|inches)$/], ["ft", /^(ft|foot|feet)$/], ["yd", /^(yd|yds|yard|yards)$/], ["mi", /^(mi|mile|miles)$/],
    ["cm", /^(cm|centimeters?|centimetres?)$/], ["mm", /^(mm|millimeters?)$/], ["km", /^(km|kilometers?)$/], ["m", /^(m|meters?|metres?)$/],
    ["hr", /^(h|hr|hrs|hours?)$/], ["min", /^(min|mins|minutes?)$/], ["s", /^(s|sec|secs|seconds?)$/], ["day", /^days?$/], ["wk", /^(wk|wks|weeks?)$/],
    ["lb", /^(lb|lbs|pounds?)$/], ["oz", /^(oz|ounces?)$/], ["g", /^(g|grams?)$/], ["kg", /^(kg|kilograms?)$/], ["gal", /^(gal|gallons?)$/], ["qt", /^(qt|quarts?)$/],
    ["c", /^cups?$/], ["l", /^(l|liters?|litres?)$/], ["ml", /^(ml|milliliters?)$/], ["mph", /^mph$/]];
function unitName(u) {
    const sq = u.match(/^(.*?)(\^?[23²³])$/), base = sq && !/^(m|s)$/.test(u) ? sq[1] : u, pow = sq && base !== u ? "^" + sq[2].replace("²", "2").replace("³", "3").replace("^", "") : "";
    const hit = UNIT_NAMES.find(([, re]) => re.test(base));
    return (hit ? hit[0] : base) + pow;
}
/** An ordered pair like (2, 3): [2, 3] in that order; null otherwise. */
function pairOf(s, needParens) {
    const m = s.replace(/ /g, "").match(needParens ? /^\((-?[\d./]+),(-?[\d./]+)\)$/ : /^\(?(-?[\d./]+),(-?[\d./]+)\)?$/);
    if (!m) return null; const a = numberOf(m[1]), b = numberOf(m[2]);
    return a != null && b != null ? [a, b] : null;
}
/** Work out an expression like "5x+3" or "2(x-4)" for the given letter values; null if it isn't one. */
function evalExpr(src, vals) {
    const s = src.replace(/ /g, ""); if (!/^[0-9a-z.+\-*/^()×·]+$/.test(s) || s.length > 60) return null;
    const tok = s.match(/\d*\.?\d+|[a-z]|[+\-*/^()×·]/g); if (!tok || tok.join("") !== s) return null;
    // Put in the multiplication a student leaves out: 5x, 2(x+1), (x+1)(x-1), x(3).
    const t = []; tok.forEach((k, i) => { const p = t[t.length - 1]; if (i && (/[\d.a-z)]$/.test(p)) && (/^[\d.a-z(]/.test(k))) t.push("*"); t.push(k === "×" || k === "·" ? "*" : k); });
    let i = 0;
    const peek = () => t[i], take = () => t[i++];
    function expr() { let v = term(); while (peek() === "+" || peek() === "-") { const o = take(), r = term(); if (r == null || v == null) return null; v = o === "+" ? v + r : v - r; } return v; }
    function term() { let v = unary(); while (peek() === "*" || peek() === "/") { const o = take(), r = unary(); if (r == null || v == null) return null; v = o === "*" ? v * r : v / r; } return v; }
    function unary() { if (peek() === "-") { take(); const v = unary(); return v == null ? null : -v; } if (peek() === "+") { take(); return unary(); } return power(); }
    function power() { const b = atom(); if (peek() === "^") { take(); const e = unary(); return b == null || e == null ? null : Math.pow(b, e); } return b; }
    function atom() {
        const k = take(); if (k == null) return null;
        if (k === "(") { const v = expr(); return take() === ")" ? v : null; }
        if (/^[a-z]$/.test(k)) return k in vals ? vals[k] : null;
        return /^\d*\.?\d+$/.test(k) ? +k : null;
    }
    const v = expr(); return i === t.length && v != null && isFinite(v) ? v : null;
}
/** Terms at the top level: "5x+3" has 2, "-3x+7" has 2, "2(x+3)" has 1. */
const termCount = (x) => { let n = 1, depth = 0; const s = x.replace(/ /g, ""); for (let i = 1; i < s.length; i++) { const c = s[i]; if (c === "(") depth++; else if (c === ")") depth--; else if (!depth && (c === "+" || c === "-") && !/[\^*/(+\-]/.test(s[i - 1])) n++; } return n; };
/** The same expression written another way: 3+5x for 5x+3, 7-3x for -3x+7. Not a longer one (x+x for 2x: that's the
    question typed back), and parentheses on one side only don't count (2x+6 for 2(x+3) would be the unfactored question). */
function sameExpr(t, a) {
    const letters = (x) => [...new Set(x.replace(/[^a-z]/g, ""))].sort().join("");
    const lt = letters(t), la = letters(a);
    if (!la || lt !== la || la.length > 2 || /[=<>!]/.test(t + a)) return false;
    if (t.includes("(") !== a.includes("(")) return false;
    if (termCount(t) > termCount(a)) return false;
    return [[1.37, -0.61], [-2.29, 1.83], [0.53, 2.71]].every(([x, y]) => {
        const vals = {}; [...la].forEach((c, j) => { vals[c] = j ? y : x; });
        const p = evalExpr(t, vals), q = evalExpr(a, vals);
        return p != null && q != null && Math.abs(p - q) < 1e-6 * Math.max(1, Math.abs(q));
    });
}
/** An inequality answer read one way, so every correct way to write it matches:
    "x > 15", "15 < x", "x>15", "x is greater than 15", "m ≤ 6" for "x ≤ 6", "-1 < x ≤ 4" or "x > -1 and x <= 4",
    and "x < -5 or x >= 4" in either order. Returns "and:>-1,<=4" style text; null if it isn't an inequality. */
const FLIP = { "<": ">", ">": "<", "<=": ">=", ">=": "<=" };
function ineqOf(src) {
    let s = String(src || "").replace(/\bis\b|\bthe\b|\bnumber\b/g, " ")
        .replace(/greater than or equal to|more than or equal to|at least|no less than|minimum of/g, ">=")
        .replace(/less than or equal to|at most|no more than|maximum of/g, "<=")
        .replace(/greater than|more than|bigger than/g, ">").replace(/less than|smaller than|fewer than/g, "<")
        .replace(/=>/g, ">=").replace(/=</g, "<=").replace(/\s+/g, " ").trim();
    if (!/[<>]/.test(s)) return null;
    const num = (x) => numberOf(String(x).replace(/°$/, "").trim());
    const one = (part) => {   // "x > 3" or "3 < x" (a letter on one side, a number on the other)
        const m = part.trim().match(/^([^<>=]+?) ?(<=|>=|<|>) ?([^<>=]+)$/); if (!m) return null;
        const L = m[1].trim(), R = m[3].trim();
        if (/^[a-z]$/.test(L) && num(R) != null) return [m[2], num(R)];
        if (/^[a-z]$/.test(R) && num(L) != null) return [FLIP[m[2]], num(L)];
        return null;
    };
    const key = (kind, parts) => kind + ":" + parts.map(([o, v]) => o + (+v.toFixed(9))).sort().join(",");
    // A double inequality: -1 < x <= 4 (or 4 >= x > -1).
    const d = s.match(/^([^<>=]+?) ?(<=|<|>=|>) ?([a-z]) ?(<=|<|>=|>) ?([^<>=]+)$/);
    if (d && num(d[1]) != null && num(d[5]) != null && (d[2][0] === d[4][0])) return key("and", [[FLIP[d[2]], num(d[1])], [d[4], num(d[5])]]);
    for (const [word, kind] of [[" or ", "or"], [" and ", "and"], [", ", "and"]]) {
        if (s.includes(word)) { const ps = s.split(word).map(one); return ps.length === 2 && ps.every(Boolean) ? key(kind, ps) : null; }
    }
    const p = one(s); return p ? key("one", [p]) : null;
}
/** How-many-solutions answers: "inf", "none", "one", or "" when the answer is not one of these. */
function solKind(a) {
    if (/infinit|^all real/.test(a)) return "inf";
    if (/^(no|zero|0) (real )?solutions?$|^none$/.test(a)) return "none";
    if (/^(exactly )?(one|1) solutions?$/.test(a)) return "one";
    return "";
}
/** What a student wrote, read as a how-many-solutions answer (forgiving of spelling: "infinite", "infnet soultions"). */
function solTyped(t) {
    if (/\binf|∞/.test(t) || /^all real( numbers)?$/.test(t)) return "inf";
    if (/^(no|zero|0) (real )?(solution|soultion|solutoin|answer)s?$|^none$|^no$|^∅$/.test(t)) return "none";
    if (/^(exactly )?(one|1)( (solution|soultion)s?)?$/.test(t)) return "one";
    return "";
}
/** "6 and 7", "6, 7", "40°, 60°, and 80° (x = 20)" as a sorted list of numbers; null unless it is 2 or more numbers. */
function listOf(s) {
    const parts = s.replace(/\([^)]*\)/g, " ").split(/\s*(?:,|;|&|\band\b|\bto\b)\s*/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const v = parts.map((x) => numberOf(withUnit(x.replace(/^[a-z]\s*=\s*/, ""))[0]));
    return v.every((x) => x != null) ? v.sort((a, b) => a - b) : null;
}
/** Is what the student typed the same as the answer (or one of the other answers the teacher accepted)?
    Matches ignoring case, spaces, "x =", trailing units the student left off, equal numbers
    written differently (0.5 and 1/2), exponents typed with ^ (3^3 for 3³), scientific notation
    typed with x or * (8x10^5), lists in any order or with commas ("6, 7" for "6 and 7"), and the
    usual ways of writing how many solutions ("infinite", "no solutions"). */
export function sameAnswer(typed, answer, also) {
    const t = norm(typed); if (!t) return false;
    // An answer key with two forms, like "14/3 = 4 2/3", accepts either one.
    const list = [answer].concat(also || []).flatMap((x) => { const parts = String(x == null ? "" : x).split(/\s+=\s+|\s*=\s*(?=[-−\d{])/); return parts.length > 1 && parts.every((p) => numberOf(withUnit(norm(p))[0]) != null) ? parts : [x]; });
    return list.some((ans) => {
        const a = norm(ans); if (!a) return false;
        const sq = (x) => x.replace(/ /g, "").replace(/°/g, "");
        if (t.replace(/ /g, "") === a.replace(/ /g, "")) return true;
        const ia = ineqOf(a); if (ia) { const it = ineqOf(t); if (it) return it === ia; }
        const sk = solKind(a); if (sk) return solTyped(t) === sk;
        // A comparison like "-3/4 > -0.8": the sign on its own is right too.
        const cmp = a.match(/^\S+ ?(<=|>=|<|>|=) ?\S+$/); if (cmp && /^(<=|>=|<|>|=)$/.test(t.replace(/ /g, ""))) return t.replace(/ /g, "") === cmp[1];
        // A repeating decimal, "0.8333… (the 3 repeats)": 0.83, 0.833 or 5/6 are right.
        if (/…|\.\.\.|repeat/.test(a)) { const base = parseFloat(a.replace(/^[^\d-]*/, "")), v = numberOf(t.replace(/…|\.\.\./g, "")), dec = (t.split(".")[1] || "").replace(/\D/g, "").length;
            if (isFinite(base) && v != null && ((dec >= 2 && Math.abs(v - base) < Math.pow(10, -dec)) || (t.includes("/") && Math.abs(v - base) < 1e-3))) return true; }
        const [tn, tu] = withUnit(t), [an, au] = withUnit(a);
        if (tu && au && tu !== au) return false;
        const x = numberOf(tn), y = numberOf(an);
        if (x != null && y != null) return Math.abs(x - y) < 1e-9;
        if (a.includes("^") && sq(t) === sq(a)) return true;
        const pa = pairOf(a, true); if (pa) { const pt = pairOf(t, false); return !!pt && Math.abs(pt[0] - pa[0]) < 1e-9 && Math.abs(pt[1] - pa[1]) < 1e-9; }   // a point: same order
        const lt = listOf(t), la = listOf(a);
        if (lt && la) return lt.length === la.length && lt.every((v, i) => Math.abs(v - la[i]) < 1e-9);
        if (sameExpr(t, a)) return true;
        return au && !tu ? tn.replace(/ /g, "") === an.replace(/ /g, "") : false;
    });
}

/** The kind of answer box a question wants, read from its answer:
    "frac" (3/4), "mixed" (1 1/2), "sol" (how many solutions: tap a choice), "pow" (3³: base and exponent),
    "sci" (8 × 10⁵: number and power of 10), "list2" / "list3" / "list4" (6 and 7: one box each),
    or "" (a plain box). */
export function answerKind(ans) {
    const a = norm(ans); if (!a) return "";
    if (solKind(a)) return "sol";
    if (ineqOf(a)) return "ineq";
    if (/^-?\d+(\.\d+)?×10\^-?\d+$/.test(a)) return "sci";
    if (/^\(?-?[a-z0-9]+\)?\^-?\d+$/.test(a)) return "pow";
    const l = listOf(a); if (l && l.length <= 4) return "list" + l.length;
    const [n] = withUnit(a);
    if (/^-?\d+ \d+\/\d+$/.test(n)) return "mixed";
    if (/^-?\d+\s*\/\s*\d+$/.test(n)) return "frac";
    return "";
}

/** One question from a saved set, made ready for the game: { c, q, a, al, h, ch }.
    al: other answers to accept · h: the teacher's own second-try hint · ch: answer choices (multiple choice, 2 to 5).
    The Question Maker (maker.html) writes these; question sets made elsewhere just have q and a. */
export function gameQuestion(k, cat) {
    const ch = Array.isArray(k.ch) ? k.ch.map((x) => String(x == null ? "" : x).trim().slice(0, 80)).filter(Boolean).slice(0, 5) : [];
    return { c: String(cat || "").slice(0, 60), q: String(k.q).slice(0, 400), a: String(k.a).slice(0, 200),
        al: Array.isArray(k.al) ? k.al.map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 8) : [],
        h: k.h ? String(k.h).trim().slice(0, 200) : "", ch: ch.length >= 2 ? ch : null };
}
/** The answer box a game question gets: "mc" for multiple choice, otherwise answerKind of its answer. */
export const formOf = (q) => (q && q.ch && q.ch.length >= 2 ? "mc" : answerKind(q && q.a));

/** A nudge for a second try, from the question, the answer key and what the student wrote. It never gives the answer away. */
export function hintFor(typed, answer, question) {
    const q = String(question || "").toLowerCase(), a = norm(answer), t = norm(typed);
    const [an] = withUnit(a), [tn] = withUnit(t), x = numberOf(tn), y = numberOf(an);
    if (solKind(a)) return "Simplify both sides first. If the x's cancel out, compare the numbers that are left.";
    const ia = ineqOf(a);
    if (ia) {
        const it = ineqOf(t), flip = (k) => k && k.replace(/<=|>=|<|>/g, (o) => FLIP[o]);
        if (x != null) return "Write your answer as an inequality, like x > 3 (use the ≤ ≥ < > buttons).";
        if (it && (flip(it) === ia || (it.split(":")[0] === ia.split(":")[0] && it.replace(/[<>=]/g, "") === ia.replace(/[<>=]/g, "")))) return "Your number is right. Check the sign. Did you multiply or divide by a negative? Then flip it.";
        if (ia.startsWith("or:")) return "Solve each part on its own, then join them with \"or\".";
        if (ia.startsWith("and:")) return "Do the same step to all three parts.";
    }
    if (x != null && y != null && x !== 0) {
        if (Math.abs(x + y) < 1e-9) return "So close. Check your positive and negative signs.";
        if ([10, 100, 0.1, 0.01].some((k) => Math.abs(x * k - y) < 1e-9)) return "Check where the decimal point goes.";
        if (Math.abs(x * y - 1) < 1e-9) return "Did you flip the fraction? Check which number goes on top.";
    }
    if (/hypotenuse|\bleg\b/.test(q)) return "Use a² + b² = c². The hypotenuse is c, the longest side.";
    if (/acute angle/.test(q) && /right triangle/.test(q)) return "The two acute angles in a right triangle add up to 90°.";
    if (/triangle/.test(q) && /angle/.test(q)) return "The three angles in a triangle add up to 180°.";
    if (/√|sqrt|square root|between which/.test(q)) return "Which perfect squares is it between? Think 36, 49, 64…";
    if (/÷|divide/.test(q) && /\^|[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(question || "")) return "Dividing powers with the same base: keep the base and subtract the exponents.";
    if (/×\s*10|x\s*10\^|10[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(question || "")) return "Multiply the front numbers, then add the powers of 10.";
    if (/[×·*]|multiply/.test(q) && /\^|[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(question || "")) return "Multiplying powers with the same base: keep the base and add the exponents.";
    if (/solve|=/.test(q) && /x/.test(q)) return "Plug your answer back in. Do both sides come out equal?";
    return "Look back at each step on your pad. Where could it have gone wrong?";
}

/* ---------- math text (same writing as the review games) ---------- */
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const tidy = (s) => String(s == null ? "" : s).replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/!=/g, "≠").replace(/sqrt\(/gi, "√(")
    .replace(/(\d)\s*[xX]\s*(10\^)/g, "$1 × $2");
/** "3/4" and "{x+1/2}" become stacked fractions, "10^-3" a raised exponent. */
export function mathText(text) {
    const s = tidy(text), frag = document.createDocumentFragment();
    const re = /\{([^{}/]+)\/([^{}/]+)\}|(?<![\w/.^])(\d+)\/(\d+)(?![\w/.])|\^(-?[A-Za-z0-9.]+|\{[^{}]*\}|\([^()]*\))/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
        if (m.index > last) frag.append(s.slice(last, m.index));
        if (m[5] != null) { let e = m[5]; if (/^[{(]/.test(e)) e = e.slice(1, -1); frag.append(el("sup", "gsup", e.replace(/^-/, "−"))); }
        else { const f = el("span", "frac"), a = el("span"), b = el("span"); a.append(mathText(m[1] != null ? m[1] : m[3])); b.append(mathText(m[2] != null ? m[2] : m[4])); f.append(a, b); frag.append(f); }
        last = re.lastIndex;
    }
    frag.append(s.slice(last)); return frag;
}

/* ---------- game codes ---------- */
/** A 6-digit game code with no leading zero. */
export const newRoomCode = (rand = Math.random) => String(100000 + Math.floor(rand() * 900000));
export const validRoomCode = (s) => /^[1-9]\d{5}$/.test(String(s || ""));
