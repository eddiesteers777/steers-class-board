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
const UNITS = /^(?:[a-z]+(?:\^?[23²³])?|°|degrees?|%)$/;
const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
/** Exponents written as superscripts (10⁵, 3³, cm²) become ^ (10^5, 3^3, cm^2), the same way a student types them. */
const supToCaret = (s) => s.replace(/([0-9a-z)])([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, (m, b, e) => b + "^" + [...e].map((c) => SUP[c]).join(""));
function norm(s) {
    let t = String(s == null ? "" : s).toLowerCase()
        .replace(/[−‒–—]/g, "-").replace(/[ \s]+/g, " ").replace(/(\d),(?=\d{3}\b)/g, "$1");
    t = supToCaret(t)
        .replace(/\s*\^\s*/g, "^").replace(/\^\((-?\d+)\)/g, "^$1")                     // 3 ^ 3, 3^(3)
        .replace(/(\d)\s*(?:×|x|\*|·|•)\s*10\^/g, "$1×10^")                               // 8 x 10^5, 8*10^5
        .replace(/\s*°\s*/g, "°").replace(/(\d)\s*degrees?\b/g, "$1°");
    return t.replace(/^\s*[a-z]\s*=\s*/, "").replace(/[.\\/\s]+$/, "").replace(/^\$\s*/, "").trim();
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
    return m && UNITS.test(m[2]) ? [m[1].trim(), m[2].replace(/^degrees?$/, "°")] : [s, ""];
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
    const list = [answer].concat(also || []);
    return list.some((ans) => {
        const a = norm(ans); if (!a) return false;
        const sq = (x) => x.replace(/ /g, "").replace(/°/g, "");
        if (t.replace(/ /g, "") === a.replace(/ /g, "")) return true;
        const sk = solKind(a); if (sk) return solTyped(t) === sk;
        const [tn, tu] = withUnit(t), [an, au] = withUnit(a);
        if (tu && au && tu !== au) return false;
        const x = numberOf(tn), y = numberOf(an);
        if (x != null && y != null) return Math.abs(x - y) < 1e-9;
        if (a.includes("^") && sq(t) === sq(a)) return true;
        const lt = listOf(t), la = listOf(a);
        if (lt && la) return lt.length === la.length && lt.every((v, i) => Math.abs(v - la[i]) < 1e-9);
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
    if (/^-?\d+(\.\d+)?×10\^-?\d+$/.test(a)) return "sci";
    if (/^\(?-?[a-z0-9]+\)?\^-?\d+$/.test(a)) return "pow";
    const l = listOf(a); if (l && l.length <= 4) return "list" + l.length;
    const [n] = withUnit(a);
    if (/^-?\d+ \d+\/\d+$/.test(n)) return "mixed";
    if (/^-?\d+\s*\/\s*\d+$/.test(n)) return "frac";
    return "";
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
