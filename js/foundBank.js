/* ==========================================
   Anchor Board — the foundational ladder: below-grade skills for students who cannot do the grade-level work yet
   (Eddie places them by hand). Pure: the problems are made here from numbers, with answers worked out from the same
   numbers, so every key is right by construction (tools/acap/found.test.mjs re-checks them).

   These are prior skills, not Alabama standards: they carry a code like "F:intAdd" (never a 7.x or 8.x code) and
   their names come from the prior-skill lists in the district's standards documents (data/standards.js "prior").
   "Helps with" is Anchor's guess at which grade-level standards each skill opens up; it only orders suggestions.

   Problems come out in the standards-bank shape: { id, std, q, a, lvl, also, steps }. Text uses the bank's markup:
   {a/b} fractions, − for minus, × and ÷.
========================================== */
export const LADDER = [
    { id: "F:mul", name: "Multiplication facts", helps: ["7.4", "7.5", "8.3", "8.4"] },
    { id: "F:div", name: "Division facts", helps: ["7.1", "7.5", "8.4"] },
    { id: "F:whole", name: "Add and subtract whole numbers", helps: ["7.4"] },
    { id: "F:dec", name: "Add and subtract decimals", helps: ["7.4", "7.3"] },
    { id: "F:fracEq", name: "Equivalent fractions and simplest form", helps: ["7.1", "7.4"] },
    { id: "F:fracAdd", name: "Add and subtract fractions", helps: ["7.4"] },
    { id: "F:fracMul", name: "Multiply fractions", helps: ["7.1", "7.5"] },
    { id: "F:intCmp", name: "Compare integers and absolute value", helps: ["7.4", "8.1"] },
    { id: "F:intAdd", name: "Add integers", helps: ["7.4", "7.6"] },
    { id: "F:intSub", name: "Subtract integers", helps: ["7.4", "7.6"] },
    { id: "F:intMul", name: "Multiply and divide integers", helps: ["7.5", "8.3"] },
    { id: "F:ops", name: "Order of operations", helps: ["7.6", "8.3"] },
    { id: "F:eq1", name: "One-step equations", helps: ["7.9", "8.11"] },
    { id: "F:eq2", name: "Two-step equations", helps: ["7.9", "8.11"] },
    { id: "F:pct", name: "Percent of a number", helps: ["7.3"] },
    // Added 2026-11-23 for the standards that had no floor skill (8.13, 8.17-8.20, 8.22, 7.18, 7.19), from their prior-skill lists.
    { id: "F:coord", name: "Points in all four quadrants", helps: ["8.13", "8.17", "8.22", "8.23"] },
    { id: "F:table", name: "Input/output tables and patterns", helps: ["8.13", "8.14", "8.17"] },
    { id: "F:subst", name: "Substitute to check a solution", helps: ["8.12", "8.14", "8.20"] },
    { id: "F:data", name: "Range, median and mean of a data set", helps: ["8.18", "8.19"] },
    { id: "F:shapes", name: "Name polygons and solid figures", helps: ["7.18", "7.19", "8.22"] },
];
export const isFoundational = (code) => /^F:/.test(String(code || ""));
export const stepOf = (code) => LADDER.find((x) => x.id === code) || null;
export const nameOf = (code) => (stepOf(code) || {}).name || code;

/* ---------- numbers ---------- */
function rng(seed) { let a = 0; for (const c of String(seed)) a = (Math.imul(a ^ c.charCodeAt(0), 2654435761) + 1) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const neg = (n) => (n < 0 ? "−" + Math.abs(n) : String(n));
const par = (n) => (n < 0 ? "(" + neg(n) + ")" : String(n));
/** A fraction in the bank's markup, simplest form; whole numbers plain, improper as mixed. */
export function frac(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1; n /= g; d /= g;
    if (d === 1) return neg(n);
    const s = n < 0 ? "−" : "", N = Math.abs(n), w = Math.floor(N / d), r = N % d;
    return s + (w ? w + "{" + r + "/" + d + "}" : "{" + r + "/" + d + "}");
}
const pt = (x, y) => "(" + neg(x) + ", " + neg(y) + ")";
const nz = (r, m) => { const v = 1 + Math.floor(r() * m); return r() < 0.5 ? -v : v; };   // a nonzero integer from −m to m
const an = (w) => (/^[aeiou]/.test(w) ? "an " : "a ") + w;
const QUAD = ["I", "II", "III", "IV"];
const POLY = [["triangle", 3], ["quadrilateral", 4], ["pentagon", 5], ["hexagon", 6], ["heptagon", 7], ["octagon", 8]];
const SOLID = [["cube", 6, 12, 8], ["rectangular prism", 6, 12, 8], ["triangular prism", 5, 9, 6], ["square pyramid", 5, 8, 5], ["triangular pyramid", 4, 6, 4]];
const dec = (x) => { const s = (Math.round(x * 100) / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, ""); return s.startsWith("-") ? "−" + s.slice(1) : s; };

/* ---------- one maker per skill: (r, k) -> problem ---------- */
const MAKERS = {
    "F:mul": (r, k) => { const a = 2 + Math.floor(r() * (k < 12 ? 8 : 11)), b = 2 + Math.floor(r() * 11); return { q: "Find: " + a + " × " + b, a: String(a * b), lvl: a > 9 || b > 9 ? 2 : 1, steps: ["Think of " + a + " groups of " + b + ".", "Use a fact you know: " + a + " × " + (b - 1) + " = " + a * (b - 1) + ", then add one more " + a + "."] }; },
    "F:div": (r, k) => { const b = 2 + Math.floor(r() * (k < 12 ? 8 : 11)), c = 2 + Math.floor(r() * 11); return { q: "Find: " + b * c + " ÷ " + b, a: String(c), lvl: b > 9 || c > 9 ? 2 : 1, steps: ["Division asks: " + b + " times what number is " + b * c + "?", "Count by " + b + "s until you reach " + b * c + "."] }; },
    "F:whole": (r, k) => { const big = k >= 15, a = (big ? 200 : 20) + Math.floor(r() * (big ? 700 : 70)), b = (big ? 100 : 10) + Math.floor(r() * (big ? 99 : 9)); const add = k % 2 === 0; return add ? { q: "Find: " + a + " + " + b, a: String(a + b), lvl: big ? 2 : 1, steps: ["Line up the ones, tens and hundreds.", "Add each place from the right. Carry a 1 when a place makes 10 or more."] } : { q: "Find: " + a + " − " + b, a: String(a - b), lvl: big ? 2 : 1, steps: ["Line up the places. Start with the ones.", "If the top digit is smaller, borrow 1 ten from the next place."] }; },
    "F:dec": (r, k) => { const a = Math.round((1 + r() * 20) * 100) / 100, b = Math.round((0.1 + r() * 9) * (k < 15 ? 10 : 100)) / (k < 15 ? 10 : 100); const add = k % 2 === 0, hi = Math.max(a, b), lo = Math.min(a, b); return add ? { q: "Find: " + dec(a) + " + " + dec(b), a: dec(a + b), lvl: k < 15 ? 1 : 2, steps: ["Line up the decimal points. Fill empty places with 0.", "Add like whole numbers, then bring the decimal point straight down."] } : { q: "Find: " + dec(hi) + " − " + dec(lo), a: dec(hi - lo), lvl: k < 15 ? 1 : 2, steps: ["Line up the decimal points. Fill empty places with 0.", "Subtract like whole numbers, then bring the decimal point straight down."] }; },
    "F:fracEq": (r, k) => { const d = 2 + Math.floor(r() * 7), n = 1 + Math.floor(r() * (d - 1)), m = 2 + Math.floor(r() * 4); const g = gcd(n, d); if (k % 2 === 0) return { q: "Write {" + n * m + "/" + d * m + "} in simplest form.", a: frac(n, d), lvl: 1, steps: ["Find a number that divides the top and the bottom. Try " + m * g + ".", "Divide the top and the bottom by it. Stop when nothing but 1 divides both."] }; return { q: "Fill in the missing number: {" + n + "/" + d + "} = {?/" + d * m + "}", a: String(n * m), lvl: 2, steps: ["The bottom went from " + d + " to " + d * m + ". That is × " + m + ".", "Do the same to the top: " + n + " × " + m + "."] }; },
    "F:fracAdd": (r, k) => { const like = k < 15, d1 = 2 + Math.floor(r() * 7), d2 = like ? d1 : [2, 3, 4, 5, 6].filter((x) => x !== d1)[Math.floor(r() * 4)] || 3; const n1 = 1 + Math.floor(r() * (d1 - 1)), n2 = 1 + Math.floor(r() * (d2 - 1)), add = k % 2 === 0 || n1 * d2 < n2 * d1 ? true : false; const top = add ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1; return { q: "Find: {" + n1 + "/" + d1 + "} " + (add ? "+" : "−") + " {" + n2 + "/" + d2 + "}", a: frac(top, d1 * d2), lvl: like ? 1 : 2, steps: like ? ["The bottoms match, so keep the bottom.", (add ? "Add" : "Subtract") + " the tops, then simplify."] : ["Make the bottoms match: use " + d1 * d2 / gcd(d1, d2) + " as the bottom.", "Rename each fraction, " + (add ? "add" : "subtract") + " the tops, then simplify."] }; },
    "F:fracMul": (r, k) => { const d1 = 2 + Math.floor(r() * 7), d2 = 2 + Math.floor(r() * 7), n1 = 1 + Math.floor(r() * (d1 - 1)), n2 = k < 15 ? 1 + Math.floor(r() * (d2 - 1)) : 2 + Math.floor(r() * 9); const q = k < 15 ? "Find: {" + n1 + "/" + d1 + "} × {" + n2 + "/" + d2 + "}" : "Find: {" + n1 + "/" + d1 + "} × " + n2; return { q, a: k < 15 ? frac(n1 * n2, d1 * d2) : frac(n1 * n2, d1), lvl: k < 15 ? 1 : 2, steps: ["Multiply the tops. Multiply the bottoms." + (k < 15 ? "" : " A whole number is itself over 1."), "Simplify the answer."] }; },
    "F:intCmp": (r, k) => { const a = Math.floor(r() * 21) - 10, b = Math.floor(r() * 21) - 10; if (k % 3 === 0) return { q: "What is |" + neg(a) + "|?", a: String(Math.abs(a)), lvl: 1, steps: ["Absolute value is the distance from 0.", "Distance is never negative."] }; const c = b === a ? b + 1 : b; return { q: "Which is greater: " + neg(a) + " or " + neg(c) + "?", a: neg(Math.max(a, c)), lvl: a < 0 && c < 0 ? 2 : 1, also: [], steps: ["Picture a number line. Numbers get greater to the right.", "A negative number closer to 0 is the greater one."] }; },
    "F:intAdd": (r, k) => { const a = Math.floor(r() * 25) - 12, b = Math.floor(r() * 25) - 12; return { q: "Find: " + neg(a) + " + " + par(b), a: neg(a + b), lvl: a < 0 && b < 0 ? 1 : 2, steps: [Math.sign(a) === Math.sign(b) ? "Same signs: add the sizes and keep the sign." : "Different signs: subtract the sizes.", Math.sign(a) === Math.sign(b) ? "" : "Keep the sign of the number with the bigger size."].filter(Boolean) }; },
    "F:intSub": (r, k) => { const a = Math.floor(r() * 25) - 12, b = Math.floor(r() * 25) - 12; return { q: "Find: " + neg(a) + " − " + par(b), a: neg(a - b), lvl: b < 0 ? 2 : 1, steps: ["Subtracting is adding the opposite: " + neg(a) + " + " + par(-b) + ".", "Now add the integers."] }; },
    "F:intMul": (r, k) => { const a = (Math.floor(r() * 11) + 2) * (r() < 0.5 ? -1 : 1), b = (Math.floor(r() * 11) + 2) * (r() < 0.5 ? -1 : 1); if (k % 2 === 0) return { q: "Find: " + neg(a) + " × " + par(b), a: neg(a * b), lvl: 1, steps: ["Multiply the sizes: " + Math.abs(a) + " × " + Math.abs(b) + ".", "Same signs make a positive. Different signs make a negative."] }; return { q: "Find: " + neg(a * b) + " ÷ " + par(b), a: neg(a), lvl: 2, steps: ["Divide the sizes: " + Math.abs(a * b) + " ÷ " + Math.abs(b) + ".", "Same signs make a positive. Different signs make a negative."] }; },
    "F:ops": (r, k) => { const a = 2 + Math.floor(r() * 9), b = 2 + Math.floor(r() * 6), c = 2 + Math.floor(r() * 6), d = 1 + Math.floor(r() * 9); if (k % 2 === 0) return { q: "Find: " + a + " + " + b + " × " + c, a: String(a + b * c), lvl: 1, steps: ["Multiply before you add: " + b + " × " + c + " = " + b * c + ".", "Then add " + a + "."] }; return { q: "Find: (" + a + " + " + b + ") × " + c + " − " + d, a: String((a + b) * c - d), lvl: 2, steps: ["Parentheses first: " + a + " + " + b + " = " + (a + b) + ".", "Multiply next, then subtract last."] }; },
    "F:eq1": (r, k) => { const x = Math.floor(r() * 21) - 6, b = 2 + Math.floor(r() * 9), kind = k % 4; if (kind === 0) return { q: "Solve: x + " + b + " = " + neg(x + b), a: "x = " + neg(x), lvl: 1, steps: ["Undo + " + b + " by subtracting " + b + " from both sides.", "x = " + neg(x + b) + " − " + b + "."] }; if (kind === 1) return { q: "Solve: x − " + b + " = " + neg(x - b), a: "x = " + neg(x), lvl: 1, steps: ["Undo − " + b + " by adding " + b + " to both sides.", "x = " + neg(x - b) + " + " + b + "."] }; if (kind === 2) return { q: "Solve: " + b + "x = " + neg(b * x), a: "x = " + neg(x), lvl: 2, steps: ["Undo × " + b + " by dividing both sides by " + b + ".", "x = " + neg(b * x) + " ÷ " + b + "."] }; const y = x || 3; return { q: "Solve: {x/" + b + "} = " + neg(y), a: "x = " + neg(y * b), lvl: 2, steps: ["Undo ÷ " + b + " by multiplying both sides by " + b + ".", "x = " + neg(y) + " × " + b + "."] }; },
    "F:eq2": (r, k) => { const x = Math.floor(r() * 17) - 6, a = 2 + Math.floor(r() * 7), b = 1 + Math.floor(r() * 12), sub = k % 2 === 1; const rhs = sub ? a * x - b : a * x + b; return { q: "Solve: " + a + "x " + (sub ? "−" : "+") + " " + b + " = " + neg(rhs), a: "x = " + neg(x), lvl: x < 0 ? 2 : 1, steps: [(sub ? "Add " : "Subtract ") + b + (sub ? " to" : " from") + " both sides: " + a + "x = " + neg(sub ? rhs + b : rhs - b) + ".", "Divide both sides by " + a + "."] }; },
    "F:pct": (r, k) => { const p = [10, 20, 25, 50, 75, 5, 30, 40][Math.floor(r() * 8)], base = (p === 25 || p === 75 ? 4 : p === 5 ? 20 : 10) * (2 + Math.floor(r() * 18)); return { q: "Find " + p + "% of " + base + ".", a: dec((p * base) / 100), lvl: [10, 50, 25].includes(p) ? 1 : 2, steps: [p + "% means " + p + " out of 100: " + p / 100 + " × " + base + ".", p === 10 ? "Or move the decimal point one place left." : "Or find 10% first, then build up to " + p + "%."] }; },
    "F:coord": (r, k) => {
        const a = nz(r, 9), b = nz(r, 9), kind = k % 4;
        if (kind === 0) { const q = a > 0 ? (b > 0 ? 0 : 3) : (b > 0 ? 1 : 2); return { q: "In which quadrant is the point " + pt(a, b) + "?", a: QUAD[q], also: [String(q + 1), "Quadrant " + QUAD[q]], lvl: 1, steps: ["The first number tells left or right. The second tells up or down.", "Quadrant I is (+, +). Go counterclockwise: II is (−, +), III is (−, −), IV is (+, −)."] }; }
        if (kind === 1) return { q: "Start at the origin. Move " + Math.abs(a) + " units " + (a > 0 ? "right" : "left") + " and " + Math.abs(b) + " units " + (b > 0 ? "up" : "down") + ". What point are you on?", a: pt(a, b), lvl: 1, steps: ["Right is +x and left is −x. Up is +y and down is −y.", "Write the x first, then the y: (x, y)."] };
        if (kind === 2) { const overX = k % 8 === 2; return { q: "Reflect the point " + pt(a, b) + " over the " + (overX ? "x" : "y") + "-axis. What is the new point?", a: overX ? pt(a, -b) : pt(-a, b), lvl: 2, steps: [overX ? "Over the x-axis, the point flips up and down. x stays the same." : "Over the y-axis, the point flips left and right. y stays the same.", overX ? "Change the sign of y." : "Change the sign of x."] }; }
        let c = nz(r, 9); if (c === b) c = -b; return { q: "How far apart are the points " + pt(a, b) + " and " + pt(a, c) + "?", a: String(Math.abs(b - c)), lvl: 2, steps: ["The x-values match, so the points are on the same up-and-down line.", "Count from " + neg(b) + " to " + neg(c) + ". If one is below 0, add the two distances to 0."] };
    },
    "F:table": (r, k) => {
        const m = 2 + Math.floor(r() * 5), b = Math.floor(r() * 9) - 4, kind = k % 4, rule = "output = " + m + " × input" + (b ? (b > 0 ? " + " : " − ") + Math.abs(b) : "");
        const f = (x) => m * x + b;
        if (kind === 0) { const x = 1 + Math.floor(r() * 9); return { q: "The rule is " + rule + ". What is the output when the input is " + x + "?", a: neg(f(x)), lvl: 1, steps: ["Put " + x + " in for input: " + m + " × " + x + (b ? (b > 0 ? " + " : " − ") + Math.abs(b) : "") + ".", "Multiply first, then add or subtract."] }; }
        if (kind === 1) { const xs = [1, 2, 3, 4]; return { q: "Inputs 1, 2, 3, 4 give outputs " + xs.map((x) => neg(f(x))).join(", ") + ". What is the output for input 5?", a: neg(f(5)), lvl: 1, steps: ["Find how much the output goes up each time: " + m + ".", "Add " + m + " to the last output, " + neg(f(4)) + "."] }; }
        if (kind === 2) { const x = Math.floor(r() * 11) - 3; return { q: "The rule is " + rule + ". What input gives an output of " + neg(f(x)) + "?", a: neg(x), lvl: 2, steps: b ? ["Work backward: undo the " + (b > 0 ? "+ " : "− ") + Math.abs(b) + " first: " + neg(f(x)) + (b > 0 ? " − " : " + ") + Math.abs(b) + " = " + neg(m * x) + ".", "Then divide by " + m + "."] : ["Work backward: undo × " + m + ".", "Divide " + neg(f(x)) + " by " + m + "."] }; }
        return { q: "Inputs 2, 4, 6, 8 give outputs " + [2, 4, 6, 8].map((x) => neg(f(x))).join(", ") + ". What is the output for input 10?", a: neg(f(10)), lvl: 2, steps: ["The input goes up by 2 each time. Find how much the output goes up: " + 2 * m + ".", "Add " + 2 * m + " to the last output, " + neg(f(8)) + "."] };
    },
    "F:subst": (r, k) => {
        const kind = k % 3;
        if (kind === 1) { const a = 2 + Math.floor(r() * 4), b = Math.floor(r() * 9) - 3 || 2, x = Math.floor(r() * 11) - 4, right = r() < 0.5, c = a * (x + b) + (right ? 0 : a), v = x;
            return { q: "Is " + neg(v) + " a solution of " + a + "(x " + (b > 0 ? "+ " : "− ") + Math.abs(b) + ") = " + neg(c) + "? Answer yes or no.", a: right ? "Yes" : "No", lvl: 2, steps: ["Put " + neg(v) + " in for x: " + a + "(" + neg(v) + (b > 0 ? " + " : " − ") + Math.abs(b) + ") = " + a + "(" + neg(v + b) + ") = " + neg(a * (v + b)) + ".", neg(a * (v + b)) + (right ? " = " : " ≠ ") + neg(c) + ", so " + (right ? "yes, it is a solution." : "no, it is not a solution.")] }; }
        const m = kind === 0 ? 2 + Math.floor(r() * 6) : -(2 + Math.floor(r() * 5)), b = Math.floor(r() * 15) - 7, x = Math.floor(r() * 13) - 6;
        return { q: "If y = " + neg(m) + "x " + (b < 0 ? "− " : "+ ") + Math.abs(b) + ", what is y when x = " + neg(x) + "?", a: neg(m * x + b), lvl: kind === 0 && x >= 0 ? 1 : 2, steps: ["Put " + neg(x) + " in for x: y = " + neg(m) + " × " + par(x) + (b < 0 ? " − " : " + ") + Math.abs(b) + ".", "Multiply first: " + neg(m * x) + ". Then " + (b < 0 ? "subtract " : "add ") + Math.abs(b) + "."] };
    },
    "F:data": (r, k) => {
        const kind = k % 4, n = kind === 2 ? 6 : 5, xs = Array.from({ length: n }, () => 1 + Math.floor(r() * 40)), srt = xs.slice().sort((a, b) => a - b), list = xs.join(", ");
        if (kind === 0) return { q: "Find the range of the data: " + list, a: String(srt[n - 1] - srt[0]), lvl: 1, steps: ["Range = greatest − least.", srt[n - 1] + " − " + srt[0] + "."] };
        if (kind === 1) return { q: "Find the median of the data: " + list, a: String(srt[2]), lvl: 1, steps: ["Put the numbers in order: " + srt.join(", ") + ".", "The median is the middle number."] };
        if (kind === 2) return { q: "Find the median of the data: " + list, a: dec((srt[2] + srt[3]) / 2), lvl: 2, steps: ["Put the numbers in order: " + srt.join(", ") + ".", "There are two middle numbers, " + srt[2] + " and " + srt[3] + ". The median is halfway between them."] };
        const sum = xs.reduce((a, b) => a + b, 0), fix = (5 - (sum % 5)) % 5; xs[4] += fix;   // make the mean a whole number
        return { q: "Find the mean of the data: " + xs.join(", "), a: String((sum + fix) / 5), lvl: 2, steps: ["Add the numbers: " + (sum + fix) + ".", "Divide by how many there are: " + (sum + fix) + " ÷ 5."] };
    },
    "F:shapes": (r, k) => {
        if (r() < 0.55) { const [nm, n] = POLY[Math.floor(r() * POLY.length)], kind = Math.floor(r() * 3);
            if (kind === 0) return { q: "A polygon has " + n + " sides. What is it called?", a: nm, lvl: 1, steps: ["The name counts the sides: tri = 3, quadri = 4, penta = 5, hexa = 6, hepta = 7, octa = 8."] };
            const w = kind === 1 ? "vertices" : "angles"; return { q: "How many " + w + " does " + an(nm) + " have?", a: String(n), lvl: 1, steps: ["A polygon has the same number of sides, angles and vertices.", "Count the sides of " + an(nm) + "."] }; }
        const [nm, f, e, v] = SOLID[Math.floor(r() * SOLID.length)], kind = Math.floor(r() * 3), w = ["faces", "edges", "vertices"][kind];
        return { q: "How many " + w + " does a " + nm + " have?", a: String([f, e, v][kind]), lvl: 2, steps: ["Faces are the flat sides, edges are where two faces meet, and vertices are the corners.", "Picture or sketch the " + nm + " and count the " + w + "."] };
    },
};

/** Every problem for one skill (n of them), the same every time for the same skill. Repeated questions are dropped. */
export function problemsFor(code, n = 30) {
    const mk = MAKERS[code]; if (!mk) return [];
    const r = rng("found|" + code), out = [], seen = new Set();
    for (let k = 0; out.length < n && k < n * 6; k++) {
        const p = mk(r, out.length); if (seen.has(p.q)) continue; seen.add(p.q);
        out.push({ id: code.slice(2) + "-" + String(out.length + 1).padStart(2, "0"), std: code, q: p.q, a: p.a, lvl: p.lvl, also: p.also || [], steps: p.steps || [] });
    }
    return out;
}
/** The whole foundational bank, in the standards-bank item shape (cls "found": offered to every class). */
export function foundBank() { return LADDER.flatMap((s) => problemsFor(s.id).map((x) => Object.assign({ cls: "found", for: ["7th", "8th", "8th-acc"], kind: "Foundational", sb: true }, x))); }
