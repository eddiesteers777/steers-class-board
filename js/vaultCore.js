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

/* ---------- step-by-step help ----------
   After a miss, a question can show one step at a time on the student's pad. Steps come from the
   question set (the Question Maker's "Steps" box, `st`) or, when there are none, from autoSteps(),
   which builds them for the kinds of problems it can read: one-variable equations and inequalities,
   triangle angle sums, the Pythagorean theorem and two-number rational-number problems.
   A step never gives the final answer: the last one says what to do, not what it comes to. */
export const STEP_MAX = 4;
/** Share of the coins a right answer still earns after using 0, 1, 2, 3 or 4 steps. */
export const STEP_PAY = [1, 0.6, 0.4, 0.25, 0.2];
/** How long after a step appears before the student can answer again (ms), so it gets read. */
export const STEP_READ_MS = 5000;
/** Stuck on a step this long with no new try (ms): the next step drops onto their board by itself, so no one sits on one problem forever. */
export const STEP_STUCK_MS = 60000;
/** A first answer sooner than this after the question appears is a guess: it doesn't unlock a step. */
export const STEP_TRY_MS = 12000;
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
/** A number for a step: whole numbers as they are, else a fraction with a small bottom, else a short decimal. */
let fmtDec = false;   // the question is written in decimals: keep the steps in decimals too
function fmt(v) {
    if (!isFinite(v)) return "?"; const sg = v < 0 ? "−" : "", a = Math.abs(v);
    if (Math.abs(a - Math.round(a)) < 1e-9) return sg + Math.round(a);
    if (fmtDec && Math.abs(a * 1e4 - Math.round(a * 1e4)) < 1e-6) return sg + String(+a.toFixed(4));
    for (let d = 2; d <= 16; d++) { const n = a * d; if (Math.abs(n - Math.round(n)) < 1e-9) return sg + Math.round(n) + "/" + d; }
    return sg + String(+a.toFixed(4));
}
/** "3x", "−x", "(2/3)x" */
function termX(a, x) { if (Math.abs(a - 1) < 1e-9) return x; if (Math.abs(a + 1) < 1e-9) return "−" + x; const f = fmt(a); return (f.includes("/") ? "(" + f + ")" : f) + x; }
/** "3x + 4", "−x − 2", "5" */
function lin(a, b, x) {
    const parts = []; if (Math.abs(a) > 1e-9) parts.push(termX(a, x));
    if (Math.abs(b) > 1e-9 || !parts.length) parts.push(parts.length ? (b < 0 ? "− " + fmt(-b) : "+ " + fmt(b)) : fmt(b));
    return parts.join(" ");
}
const OPS = { "<": "<", ">": ">", "<=": "≤", ">=": "≥", "=": "=" };
function linearSteps(src) {
    // "Solve: 3(2x − 4) = 4x + 6" → the equation part, in the checker's plain spelling.
    let t = norm(src).replace(/^(solve|simplify|find x|find)\b[^:]*:\s*/, "").replace(/^solve\s+/, "").replace(/\s*(for [a-z])?\.?$/, "");
    const m = t.match(/^([^<>=]+?)\s*(<=|>=|<|>|=)\s*([^<>=]+)$/); if (!m) return null;
    let L = m[1].trim(), R = m[3].trim(), op = m[2]; const letters = [...new Set((L + R).replace(/[^a-z]/g, ""))];
    fmtDec = /\d\.\d/.test(t);
    if (letters.length !== 1) return null; const x = letters[0];
    const ev = (side, v) => evalExpr(side.replace(/(\d)\s+(?=\d)/g, "$1+"), { [x]: v });
    const l0 = ev(L, 0), l1 = ev(L, 1), l2 = ev(L, 2), r0 = ev(R, 0), r1 = ev(R, 1), r2 = ev(R, 2);
    if ([l0, l1, l2, r0, r1, r2].some((v) => v == null)) return null;
    if (Math.abs((l2 - l1) - (l1 - l0)) > 1e-9 || Math.abs((r2 - r1) - (r1 - r0)) > 1e-9) return null;   // not linear
    let La = l1 - l0, Lb = l0, Ra = r1 - r0, Rb = r0; const ineq = op !== "=", out = [];
    const messy = /[()]/.test(L + R) || termCount(L) > 2 || termCount(R) > 2 || /[a-z]\s*\/\s*\d/.test(L + R);   // 1/2x is fine as it is; x/2 or 3(x + 1) gets tidied first
    if (messy) out.push("Simplify each side first (distribute and combine like terms): " + lin(La, Lb, x) + " " + OPS[op] + " " + lin(Ra, Rb, x));
    // x on both sides with more x's on the right: work with the sides switched, so nobody divides by a negative they didn't need.
    let swapped = false;
    if (Math.abs(La) > 1e-9 && Math.abs(Ra) > 1e-9 && Ra > La) { [La, Lb, Ra, Rb] = [Ra, Rb, La, Lb]; op = ineq ? FLIP[op] : op; swapped = true; }
    const O = OPS[op], k = La - Ra, c = Rb - Lb, one = Math.abs(k - 1) < 1e-9;
    if (Math.abs(La - Ra) < 1e-9) { out.push("The " + x + "'s cancel out. Look at the numbers that are left: is that always true, or never true?"); return out; }
    // Never show the line that IS the answer (x = 11): with 1x left, the step says what to do, not what it comes to.
    if (Math.abs(Ra) > 1e-9) {
        const now = one && Math.abs(Lb) < 1e-9 ? "" : " Now it's " + lin(k, Lb, x) + " " + O + " " + fmt(Rb) + ".";
        out.push((swapped ? "Keep the " + x + "'s on the side that has more. " + (Ra > 0 ? "Subtract " : "Add ") : "Get the " + x + "'s on one side: " + (Ra > 0 ? "subtract " : "add ")) + termX(Math.abs(Ra), x) + " on both sides." + now);
    }
    if (Math.abs(Lb) > 1e-9) out.push("Undo the " + fmt(Math.abs(Lb)) + ": " + (Lb > 0 ? "subtract " : "add ") + fmt(Math.abs(Lb)) + " on both sides." + (one ? "" : " Now it's " + termX(k, x) + " " + O + " " + fmt(c) + "."));
    if (!one) out.push("Divide both sides by " + fmt(k) + (Math.abs(k) < 1 && fmt(k).includes("/") ? " (same as multiplying by " + fmt(1 / k) + ")" : "") + "." + (ineq && k < 0 ? " You're dividing by a negative, so flip the sign." : ""));
    if (out.length < 2) out.push("Check it: put your answer back in for " + x + ". Do both sides match?");
    return out.slice(0, STEP_MAX);
}
function triangleSteps(src) {
    const q = String(src || ""), lq = q.toLowerCase(); if (!/triangle/.test(lq) || !/angle/.test(lq)) return null;
    // Angles with a letter: x°, 2x°, (x + 20)°
    const exprs = [...q.matchAll(/\(([^()]*[a-z][^()]*)\)\s*°|(\d*[a-z])\s*°/gi)].map((m) => (m[1] || m[2]).replace(/\s+/g, " ").trim());
    if (exprs.length >= 2 && /base angles/.test(lq)) return ["The base angles of an isosceles triangle are equal. Set them equal: " + exprs[0] + " = " + exprs[1] + ".", "Solve that for x.", "Put x back in to get a base angle. The vertex angle is 180° minus both base angles."];
    if (exprs.length >= 3) {
        const sum = exprs.slice(0, 3).map((e) => (/[+−-]/.test(e) ? "(" + e + ")" : e)).join(" + ");
        const steps = ["The three angles of a triangle add up to 180°. Write it: " + sum + " = 180."];
        const xv = (exprs.join("").match(/[a-z]/) || ["x"])[0], all = exprs.slice(0, 3).map((e) => "(" + e + ")").join("+").replace(/−/g, "-");
        const f0 = evalExpr(all, { [xv]: 0 }), f1 = evalExpr(all, { [xv]: 1 });
        if (f0 != null && f1 != null && Math.abs(f1 - f0) > 1e-9) {
            const a = f1 - f0, b = f0; fmtDec = false;
            steps.push("Combine like terms: " + lin(a, b, xv) + " = 180.");
            steps.push("Solve for " + xv + ": " + (Math.abs(b) > 1e-9 ? (b > 0 ? "subtract " : "add ") + fmt(Math.abs(b)) + " on both sides, then " : "") + "divide by " + fmt(a) + ".");
        }
        if (!/find x\b|find the value of x/.test(lq)) steps.push("You found " + xv + ". Put it back in to get the angle the question asks for.");
        return steps.slice(0, STEP_MAX);
    }
    const nums = [...q.matchAll(/(\d+(?:\.\d+)?)\s*°/g)].map((m) => m[1]);
    if (/exterior/.test(lq)) return nums.length >= 2 && /remote|interior/.test(lq) && /find the other|other (remote )?interior|missing/.test(lq) ? ["An exterior angle equals the two remote interior angles added together.", "So the missing angle is the exterior angle minus the one you know: " + nums[0] + " − " + nums[1] + "."] : null;
    if (/right triangle/.test(lq) && /acute/.test(lq) && nums.length >= 1) return ["A right triangle has a 90° angle, so the other two angles add up to 90°.", "Subtract the angle you know from 90."];
    if (/isosceles/.test(lq) && /vertex/.test(lq) && nums.length >= 1) return ["The three angles add up to 180°. Take away the vertex angle: 180 − " + nums[0] + ".", "What's left is shared by the two base angles, which are equal. Split it in half."];
    if (nums.length >= 3 && /can a triangle|could a triangle|possible/.test(lq)) return ["Add the three angles: " + nums.slice(0, 3).join(" + ") + ".", "A triangle's angles must add up to exactly 180°. Does yours?"];
    if (nums.length >= 2 && /third|missing|other|find x/.test(lq)) return ["The three angles of a triangle add up to 180°.", "Add the two angles you know: " + nums[0] + " + " + nums[1] + ".", "Subtract that from 180."];
    return null;
}
function pythagSteps(src) {
    const lq = String(src || "").toLowerCase(); if (!/hypotenuse|\blegs?\b/.test(lq) || /\bangles?\b|°/.test(lq)) return null;
    const nums = [...lq.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => m[1]); if (nums.length < 2) return null;
    const hm = lq.match(/hypotenuse(?: is| of| =|:)?\s*(\d+(?:\.\d+)?)/);
    if (hm && !/find the hypotenuse|how long is the hypotenuse/.test(lq)) { const c = hm[1], a = nums.find((n) => n !== c); if (!a) return null; return ["Use a² + b² = c². The hypotenuse is the longest side, so c = " + c + ".", "Put in what you know: " + a + "² + b² = " + c + "². Square the numbers.", "Subtract to get b² by itself, then take the square root."]; }
    if (!/find the hypotenuse|hypotenuse\?|how long is the hypotenuse|length of the hypotenuse/.test(lq) && !/legs (are|of)/.test(lq)) return null;
    return ["Use a² + b² = c². The legs are a and b.", "Square both legs and add them: " + nums[0] + "² + " + nums[1] + "².", "Take the square root of that sum."];
}
/** "−2/5", "4 2/3", "-0.6", "(−6)" as a value, or null. */
const ratOf = (s) => { const t = String(s).trim().replace(/^\((.*)\)$/, "$1").trim(); return numberOf(t); };
function rationalSteps(src) {
    let t = norm(src).replace(/^(find|simplify|evaluate|compute|what is)\b:?\s*/, "").replace(/[?.]\s*$/, "").trim(); fmtDec = /\d\.\d/.test(t);
    const OPR = "([-]?\\(?\\s*-?\\d+(?:\\.\\d+)?(?: \\d+\\/\\d+|\\/\\d+)?\\s*\\)?)";
    let m = t.match(new RegExp("^" + OPR + "\\s*([+\\-×*÷]|\\s)\\s*" + OPR + "$")) || t.match(new RegExp("^" + OPR + "\\s*" + OPR + "$"));
    if (!m) return null;
    const A = m[1], op = m.length === 4 ? (m[2].trim() || "×") : "×", B = m.length === 4 ? m[3] : m[2];
    const a = ratOf(A), b = ratOf(B); if (a == null || b == null) return null;
    if (b === 0 && /[÷/]/.test(op)) return null;   // dividing by zero: no steps to give
    const isFrac = (s) => /\//.test(s), mixed = (s) => /\d \d+\/\d+/.test(s), dec = (s) => /\./.test(s);
    const steps = [];
    const sgn = (v) => (v < 0 ? "negative" : "positive");
    if (op === "-" && b < 0) steps.push("Subtracting a negative is the same as adding: change − (" + fmt(b) + ") to + " + fmt(-b) + ".");
    if (op === "+" || op === "-") {
        const bb = op === "-" ? -b : b;
        if (isFrac(A) || isFrac(B)) {
            const da = +(String(A).match(/\/(\d+)/) || [0, 1])[1], db = +(String(B).match(/\/(\d+)/) || [0, 1])[1], lcd = da * db / gcd(da, db);
            if (mixed(A) || mixed(B)) steps.push("Change the mixed numbers to improper fractions first.");
            steps.push(da === db ? "The bottoms already match (" + lcd + "), so keep " + lcd + " on the bottom." : "Find a common denominator: " + lcd + ". Rewrite both fractions with " + lcd + " on the bottom.");
            steps.push((a < 0) !== (bb < 0) ? "The signs are different: subtract the tops, and keep the sign of the one that's bigger without its sign." : "Add the tops and keep " + lcd + " on the bottom.");
            steps.push("Simplify your answer if you can.");
        } else {
            if ((a < 0) !== (bb < 0)) steps.push("The signs are different. Subtract the smaller size from the bigger one, and keep the sign of the bigger one.");
            else steps.push("The signs are the same. Add the sizes and keep the sign (" + sgn(a) + ").");
            if (dec(A) || dec(B)) steps.push("Line up the decimal points before you add or subtract.");
        }
    } else if (op === "×" || op === "*" || op === "÷") {
        steps.push("Signs first: " + sgn(a) + " " + (op === "÷" ? "÷" : "×") + " " + sgn(b) + " gives a " + ((a < 0) === (b < 0) ? "positive" : "negative") + " answer.");
        if (mixed(A) || mixed(B)) steps.push("Change the mixed numbers to improper fractions.");
        if (op === "÷") steps.push(isFrac(B) || isFrac(A) ? "Keep, change, flip: keep the first number, change ÷ to ×, and flip the second fraction." : "Divide the sizes. " + (dec(A) || dec(B) ? "Move the decimal points so you divide by a whole number." : ""));
        else steps.push(isFrac(A) || isFrac(B) ? "Multiply the tops, then multiply the bottoms. Simplify across first if you can." : "Multiply the sizes" + (dec(A) || dec(B) ? ", then count the decimal places." : "."));
        if (isFrac(A) || isFrac(B)) steps.push("Simplify your answer if you can.");
    } else return null;
    return steps.map((s) => s.trim()).filter(Boolean).slice(0, STEP_MAX);
}
/** Steps for a question, built from its text when it is a kind autoSteps can read; [] when it isn't. */
export function autoSteps(question) {
    const q = String(question || "");
    try { return triangleSteps(q) || pythagSteps(q) || linearSteps(q) || rationalSteps(q) || []; } catch (e) { return []; }
}
/** The steps a game question uses: the teacher's own (st), else automatic ones. */
export function stepsFor(q) { const own = Array.isArray(q && q.st) ? q.st.filter(Boolean) : []; return (own.length ? own : autoSteps(q && q.q)).slice(0, STEP_MAX).map(mathify); }
/** Write a step the way it looks in math class: 3/4 as a stacked fraction {3/4}, (2/3)x as {2/3}x, x/4 as {x/4}, 2 1/2 as 2{1/2},
    and powers like x^2 as x². The whiteboard and the step cards draw {a/b} as a real fraction. */
const SUPS = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export function mathify(t) {
    return String(t || "")
        .replace(/(\d+) (\d+)\/(\d+)(?![\w}\/]|\.\d)/g, "$1{$2/$3}")
        .replace(/\((−?-?)(\d+)\/(\d+)\)(?=[a-z])/g, (m, sg, n, d) => (sg ? "−" : "") + "{" + n + "/" + d + "}")
        .replace(/(?<![\w{}\/.])([a-z]|\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?|[a-z])(?![\w}\/]|\.\d)/g, "{$1/$2}")
        .replace(/\^(\d)(?!\d)/g, (m, d) => SUPS[d]);
}

/** One question from a saved set, made ready for the game: { c, q, a, al, h, ch }.
    al: other answers to accept · h: the teacher's own second-try hint · ch: answer choices (multiple choice, 2 to 5).
    The Question Maker (maker.html) writes these; question sets made elsewhere just have q and a. */
export function gameQuestion(k, cat) {
    const ch = Array.isArray(k.ch) ? k.ch.map((x) => String(x == null ? "" : x).trim().slice(0, 80)).filter(Boolean).slice(0, 5) : [];
    return { c: String(cat || "").slice(0, 60), q: String(k.q).slice(0, 400), a: String(k.a).slice(0, 200),
        al: Array.isArray(k.al) ? k.al.map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 8) : [],
        h: k.h ? String(k.h).trim().slice(0, 200) : "", ch: ch.length >= 2 ? ch : null,
        st: Array.isArray(k.st) ? k.st.map((x) => String(x == null ? "" : x).trim().slice(0, 200)).filter(Boolean).slice(0, STEP_MAX) : [] };
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
