/* ==========================================
   Anchor Board — walkthrough engine (js/walk.js).
   Reads a problem ({ id, q, a, std, walk? }) and writes the work out step by step, the way it goes on the board:
   one line at a time, each with a "why", and with the move named so the player can animate it
   (distribute, combine, both sides, cancel, keep-change-flip, sign flip, number line, triangle angles, story → equation).

   Nothing here is typed in by hand. The steps come from the problem itself, and every walkthrough is checked before
   anyone sees it:
     - every equation or inequality line must have exactly the same answers as the first line (exact fractions, no rounding),
     - every line of an evaluation must have the same exact value as the first line,
     - every check line must come out true,
     - the final answer must match the problem's answer key.
   If any of that fails, walkFor() returns { ok: false, why } and no walkthrough is shown.

   Pure JavaScript, no page needed: tools/walk/verify.mjs runs it over the whole standards bank in Node.

   A step:   { move, title, why, seq: [ {a:"row", row} | {a:"hl"|"strike"|"arrow"|"fly"|"flip"|"turn"|"box", ...} ] }
   A row:    { t:"line", cells:[dt…] } (lined up on the = or < sign) · { t:"op", cells } (what is done to each side)
             · { t:"pic", pic } (number line, triangle, angles, story) · { t:"ans", dt } (the boxed answer)
   A dt (what is written): a string, { r:[…] } a row, { f:[top, bottom] } a stacked fraction, { sup } an exponent.
   Any dt may carry k (a key the animations point at), c (a colour class) and x (struck through), u (a small number
   written above it, used when cancelling).
========================================== */

/* ---------- exact numbers ---------- */
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const lcm = (a, b) => (a / gcd(a, b)) * b;
export class Q {
    constructor(n, d = 1) {
        if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) throw new Error("number out of range");
        if (d < 0) { n = -n; d = -d; }
        const g = gcd(n, d); this.n = n / g || 0; this.d = d / g;
    }
    static of(x) { return x instanceof Q ? x : new Q(x); }
    add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { return this.add(Q.of(o).neg()); }
    mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
    div(o) { o = Q.of(o); if (!o.n) throw new Error("divide by zero"); return new Q(this.n * o.d, this.d * o.n); }
    neg() { return new Q(-this.n, this.d); }
    abs() { return new Q(Math.abs(this.n), this.d); }
    inv() { return new Q(this.d, this.n); }
    pow(k) { let r = new Q(1); for (let i = 0; i < k; i++) r = r.mul(this); return r; }
    eq(o) { o = Q.of(o); return this.n === o.n && this.d === o.d; }
    cmp(o) { o = Q.of(o); return Math.sign(this.n * o.d - o.n * this.d); }
    get sign() { return Math.sign(this.n); }
    get int() { return this.d === 1; }
    get zero() { return this.n === 0; }
    get one() { return this.n === 1 && this.d === 1; }
    toNumber() { return this.n / this.d; }
}
const ZERO = new Q(0), ONE = new Q(1);
const MINUS = "−";
const terminates = (q) => { let d = q.d; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; };
function decStr(q) {   // a terminating decimal, no trailing zeros; null when it repeats
    if (!terminates(q)) return null;
    const a = q.abs(); let p = 0;
    while (Math.pow(10, p) % a.d !== 0) p++;
    const scaled = (a.n * (Math.pow(10, p) / a.d)).toString().padStart(p + 1, "0");
    let s = p ? scaled.slice(0, -p) + "." + scaled.slice(-p) : scaled;
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return (q.sign < 0 ? "-" : "") + s;
}
/** A number from text: 5, 2.75, .5, 3/4, 2{1/4}, {3/4}, with − or -. */
export function qOf(s) {
    s = String(s).replace(/[−‒–—]/g, "-").replace(/[§$,\s]/g, "");
    let m = s.match(/^(-?)(\d+)\{(\d+)\/(\d+)\}$/) || s.match(/^(-?)(\d+) (\d+)\/(\d+)$/);
    if (m) { const v = new Q(+m[2]).add(new Q(+m[3], +m[4])); return m[1] ? v.neg() : v; }
    m = s.match(/^(-?)\{?(\d+)\/(\d+)\}?$/) || s.match(/^\{(-?)(\d+)\/(\d+)\}$/);
    if (m) { const v = new Q(+m[2], +m[3]); return m[1] ? v.neg() : v; }
    m = s.match(/^(-?)(\d*)\.?(\d*)$/);
    if (m && (m[2] || m[3])) { const p = m[3].length; const v = new Q(+(m[2] + m[3] || "0"), Math.pow(10, p)); return m[1] ? v.neg() : v; }
    return null;
}

/* ---------- what gets written (dt) ---------- */
const R = (items, o) => Object.assign({ r: items.filter((x) => x !== "" && x != null) }, o || {});
const F = (top, bot, o) => Object.assign({ f: [top, bot] }, o || {});
const key = (W) => "k" + (++W.kc);
/** Plain text of a dt, fractions as a/b (for why lines, matching and screen readers). */
export function dtText(d) {
    if (d == null) return "";
    if (typeof d === "string") return d;
    if (d.f) { const t = dtText(d.f[0]), b = dtText(d.f[1]), wrap = (x) => (/[\s+−\-/]/.test(x.trim()) ? "(" + x + ")" : x); return wrap(t) + "/" + wrap(b); }
    if (d.sup) return "^" + dtText(d.sup);
    const parts = d.r || [];
    let out = "";
    parts.forEach((x, i) => {
        let t = dtText(x);
        let y = x; while (y && typeof y === "object" && y.r && y.r.filter((z) => z !== "").length === 1) y = y.r.find((z) => z !== "");
        const isF = !!(y && typeof y === "object" && y.f);
        if (isF && /\d$/.test(out)) out += " ";                      // 2 1/4, not 21/4
        if (isF && /^[a-z]/i.test(dtText(parts[i + 1] || ""))) t = "(" + t + ")";   // (1/4)x, not 1/4x
        out += t;
    });
    return out;
}
let MONEY = false;   // set while building a walkthrough whose answer is money: decimals keep two places
/** A number as written: style "dec" (decimals), "frac" (stacked, improper), "mixed" (whole + stacked). */
function numDT(q, style, o) {
    const a = q.abs(); let body;
    if (a.int) body = String(a.n);
    else if (style === "dec" && terminates(a)) { body = decStr(a); if (MONEY && /\.\d$/.test(body)) body += "0"; }
    else if (style === "mixed" && a.n > a.d) { const w = Math.floor(a.n / a.d); body = R([String(w), F(String(a.n - w * a.d), String(a.d))]); }
    else body = F(String(a.n), String(a.d));
    return R(q.sign < 0 ? [MINUS, body] : [body], o);
}
const numText = (q, style) => dtText(numDT(q, style));
const styleOf = (...ss) => (ss.includes("dec") ? "dec" : ss.includes("frac") || ss.includes("mixed") ? "frac" : "int");

/* ---------- text in ---------- */
const clean = (s) => String(s).replace(/[−‒–—]/g, "-").replace(/·/g, "*").replace(/×/g, "*").replace(/÷/g, "/:").replace(/§/g, "").replace(/°/g, "").replace(/≤/g, "<=").replace(/≥/g, ">=").trim();
function tokens(s) {
    const out = []; let i = 0; s = clean(s);
    while (i < s.length) {
        const ch = s[i];
        if (/\s/.test(ch)) { i++; continue; }
        let m = s.slice(i).match(/^(\d+)\{(-?\d+)\/(\d+)\}/);
        if (m) { out.push({ t: "num", q: new Q(+m[1]).add(new Q(+m[2], +m[3])), s: "mixed" }); i += m[0].length; continue; }
        m = s.slice(i).match(/^(\d+(?:\.\d+)?|\.\d+)/);
        if (m) { out.push({ t: "num", q: qOf(m[1]), s: m[1].includes(".") ? "dec" : "int" }); i += m[0].length; continue; }
        if (ch === "{") {   // a stacked fraction: {3/4}, {x/2}, {2x/3}, {a/b} with expressions
            let depth = 0, j = i;
            for (; j < s.length; j++) { if (s[j] === "{") depth++; else if (s[j] === "}" && --depth === 0) break; }
            const inner = s.slice(i + 1, j); i = j + 1;
            let d2 = 0, cut = -1;
            for (let k = 0; k < inner.length; k++) { const c = inner[k]; if ("({".includes(c)) d2++; else if (")}".includes(c)) d2--; else if (c === "/" && inner[k + 1] !== ":" && d2 === 0) { cut = k; break; } }
            if (cut < 0) return null;
            out.push({ t: "brace", top: inner.slice(0, cut), bot: inner.slice(cut + 1) }); continue;
        }
        if (s.startsWith("/:", i)) { out.push({ t: "op", v: "/" }); i += 2; continue; }
        if (s.startsWith("<=", i) || s.startsWith(">=", i)) { out.push({ t: "rel", v: s.slice(i, i + 2) === "<=" ? "≤" : "≥" }); i += 2; continue; }
        if ("<>=".includes(ch)) { out.push({ t: "rel", v: ch }); i++; continue; }
        if ("+-*/^".includes(ch)) { out.push({ t: "op", v: ch }); i++; continue; }
        if (ch === "²" || ch === "³") { out.push({ t: "op", v: "^" }, { t: "num", q: new Q(ch === "²" ? 2 : 3), s: "int" }); i++; continue; }
        if ("()".includes(ch)) { out.push({ t: ch }); i++; continue; }
        if (ch === "|") { out.push({ t: "|" }); i++; continue; }
        if (/[a-zA-Z]/.test(ch)) { out.push({ t: "var", v: ch }); i++; continue; }
        return null;
    }
    return out;
}

/* ---------- linear sides: terms { c, v, g, over, dec, k } ---------- */
function parseSide(W, toks) {
    let i = 0;
    const peek = () => toks[i];
    function side(stop) {
        const terms = [];
        let sign = 1, first = true;
        while (i < toks.length && !(peek().t === stop) && peek().t !== "rel") {
            const tk = peek();
            if (tk.t === "op" && (tk.v === "+" || tk.v === "-")) { if (tk.v === "-") sign = -sign; i++; continue; }
            if (!first && sign === 1 && terms.length && toks[i - 1] && !(toks[i - 1].t === "op")) throw new Error("missing sign");
            const t = term(); if (!t) throw new Error("bad term");
            if (sign < 0) t.c = t.c.neg();
            terms.push(t); sign = 1; first = false;
        }
        return terms;
    }
    function term() {
        let c = ONE, v = null, g = null, over = false, dec = false, n = 0;
        while (i < toks.length) {
            const tk = peek();
            if (tk.t === "num") { c = c.mul(tk.q); if (tk.s === "dec") dec = true; i++; n++; }
            else if (tk.t === "var") { if (v || g) throw new Error("not linear"); v = tk.v; i++; n++; }
            else if (tk.t === "brace") {
                const top = tokens(tk.top), bot = tokens(tk.bot);
                if (!top || !bot || bot.length !== 1 || bot[0].t !== "num") throw new Error("bad fraction");
                const inner = parseSide(W, top);
                if (inner.length !== 1 || inner[0].g) throw new Error("bad fraction");
                const t0 = inner[0];
                if (t0.v) { if (v || g) throw new Error("not linear"); v = t0.v; over = true; }
                c = c.mul(t0.c).div(bot[0].q); i++; n++;
            }
            else if (tk.t === "(") {
                if (g || v) throw new Error("not linear");
                i++; const inner = side(")"); if (!peek() || peek().t !== ")") throw new Error("no )"); i++; g = inner; n++;
            }
            else if (tk.t === "op" && tk.v === "*") { i++; }
            else break;
        }
        if (!n) return null;
        return { c, v, g, over, dec, k: key(W) };
    }
    const out = side(null);
    if (i !== toks.length) throw new Error("left over");
    return out;
}
/** A line: { s: [side, side(, side)], r: [rel(, rel)] }, or null. Also |x − a| < b. */
function parseLine(W, text) {
    const toks = tokens(text); if (!toks) return null;
    const parts = [[]], rels = [];
    toks.forEach((t) => { if (t.t === "rel") { rels.push(t.v); parts.push([]); } else parts[parts.length - 1].push(t); });
    if (!rels.length || rels.length > 2) return null;
    if (parts.some((p) => !p.length)) return null;
    if (rels.length === 1 && parts[0][0] && parts[0][0].t === "|" && parts[0][parts[0].length - 1].t === "|") {
        const inner = parseSide(W, parts[0].slice(1, -1)), b = parseSide(W, parts[1]);
        return { s: [inner, b], r: rels, abs: true };
    }
    if (toks.some((t) => t.t === "|")) return null;
    return { s: parts.map((p) => parseSide(W, p)), r: rels };
}
const dup = (W, t) => Object.assign({}, t, { k: key(W), g: t.g ? t.g.map((x) => dup(W, x)) : null });
const varOf = (line) => { let v = null; line.s.forEach((sd) => sd.forEach((t) => { if (t.v) v = t.v; if (t.g) t.g.forEach((x) => { if (x.v) v = x.v; }); })); return v; };
/** a·x + b for a side (groups multiplied out). */
function formOf(side) {
    let a = ZERO, b = ZERO;
    side.forEach((t) => {
        if (t.g) { const f = formOf(t.g); a = a.add(f.a.mul(t.c)); b = b.add(f.b.mul(t.c)); }
        else if (t.v) a = a.add(t.c); else b = b.add(t.c);
    });
    return { a, b };
}
const semOf = (line) => ({ s: line.s.map(formOf), r: line.r.slice() });

/* ---------- writing terms ---------- */
const absText = (q, dec) => numText(q.abs(), dec ? "dec" : "frac");
function coefDT(t) {   // the number in front, without its sign; "" for 1
    const a = t.c.abs();
    if (t.v && a.one) return "";
    if (t.v && t.over) return null;   // written as {x/2}
    if (t.g && a.one) return "";
    return numDT(a, t.dec ? "dec" : "frac");
}
function termDT(t, lead) {
    const neg = t.c.sign < 0, parts = [];
    const sg = neg && lead ? R([MINUS], { k: t.k + "s" }) : "";
    if (t.g) {
        const cd = coefDT(t);
        parts.push(R([sg, cd], { k: t.k + "c" }), "(", sideDT(t.g), ")");
        return R(parts, { k: t.k });
    }
    if (t.v) {
        if (t.over) {
            const a = t.c.abs(), top = a.n === 1 ? t.v : String(a.n) + t.v;
            return R([sg, F(R([top], { k: t.k + "c" }), String(a.d))], { k: t.k });
        }
        const cd = coefDT(t);
        return R([sg, cd ? R([cd], { k: t.k + "c" }) : "", R([t.v], { k: t.k + "v" })], { k: t.k });
    }
    return R([sg, numDT(t.c.abs(), t.dec ? "dec" : "frac")], { k: t.k });
}
function sideDT(side) {
    if (!side.length) return R(["0"]);
    const items = [];
    side.forEach((t, i) => {
        if (i === 0) items.push(termDT(t, true));
        else { items.push(t.c.sign < 0 ? " " + MINUS + " " : " + "); items.push(termDT(t, false)); }
    });
    return R(items);
}
const termText = (t, lead) => dtText(termDT(t, lead));
const sideText = (side) => dtText(sideDT(side));
const signedText = (t) => (t.c.sign < 0 ? MINUS : "+") + dtText(termDT(Object.assign({}, t, { c: t.c.abs() }), true));
function lineRow(W, line, o) {
    const cells = [];
    line.s.forEach((sd, i) => { cells.push(line.abs && i === 0 ? R(["|", sideDT(sd), "|"]) : sideDT(sd)); if (i < line.r.length) cells.push(R([line.r[i]], { k: (line.rk && line.rk[i]) || undefined })); });
    return Object.assign({ t: "line", cells, sem: semOf(line) }, o || {});
}
const lineText = (line) => line.s.map(sideText).reduce((acc, s, i) => acc + (i ? " " + line.r[i - 1] + " " : "") + s, "");
const FLIPREL = { "<": ">", ">": "<", "≤": "≥", "≥": "≤", "=": "=" };

/* ---------- moves on a line ---------- */
function stepDistribute(W, line) {
    const seq = [], whys = [];
    const s2 = line.s.map((sd) => {
        const out = [];
        sd.forEach((t) => {
            if (!t.g) { out.push(t); return; }
            const ks = [];
            t.g.forEach((x) => {
                const n = { c: t.c.mul(x.c), v: x.v, g: null, over: false, dec: t.dec || x.dec, k: key(W) };
                out.push(n); ks.push([x.k, n.k]);
            });
            if (t.c.one) whys.push("Nothing is multiplying the parentheses, so drop them.");
            else if (t.c.eq(-1) && !t.dec) {
                seq.push({ a: "arrow", from: t.k + "c", to: t.g.map((x) => x.k) });
                whys.push("The minus in front means −1 times everything inside, so every sign inside changes: " + t.g.map((x) => termText(x, true) + " becomes " + termText({ c: x.c.neg(), v: x.v, dec: x.dec }, true)).join(", ") + ".");
            }
            else {
                seq.push({ a: "arrow", from: t.k + "c", to: t.g.map((x) => x.k) });
                const cT = t.c.eq(-1) ? MINUS + "1" : numText(t.c, t.dec ? "dec" : "frac");
                whys.push("Distribute the " + cT + ": " + t.g.map((x) => cT + " × " + (x.c.sign < 0 && !x.v ? "(" + termText(x, true) + ")" : termText(x, true)) + " = " + termText({ c: t.c.mul(x.c), v: x.v, dec: t.dec || x.dec }, true)).join(", ") + ".");
            }
            seq.push({ a: "fly", pairs: ks, late: true });
        });
        return out;
    });
    const next = Object.assign({}, line, { s: s2 });
    const fly = seq.filter((x) => x.a === "fly"), pre = seq.filter((x) => x.a !== "fly");
    W.steps.push({ move: "distribute", title: whys.some((w) => w.startsWith("Distribute") || w.startsWith("The minus")) ? "Distribute" : "Drop the parentheses",
        why: [...new Set(whys)].join(" "), seq: [...pre, { a: "row", row: lineRow(W, next) }, ...fly] });
    return next;
}
const needsCombine = (sd) => sd.filter((t) => t.v).length > 1 || sd.filter((t) => !t.v).length > 1;
function combineSide(W, sd, why, hl, fly) {
    if (!needsCombine(sd)) return sd;
    const vs = sd.filter((t) => t.v), cs = sd.filter((t) => !t.v), out = [];
    const make = (list, tone) => {
        if (!list.length) return;
        if (list.length === 1) { out.push(list[0]); return; }
        const c = list.reduce((s, t) => s.add(t.c), ZERO);
        hl.push({ ks: list.map((t) => t.k), tone });
        const sum = list.map((t, i) => (i ? signedText(t).replace(/^([+−])/, " $1 ") : termText(t, true))).join("");
        const n = { c, v: list[0].v, g: null, over: list.some((t) => t.over) && !list.some((t) => !t.over && !t.c.int), dec: list.some((t) => t.dec), k: key(W) };
        const one = list.find((t) => t.v && t.c.one && !t.g);
        why.push(sum + " = " + (c.zero ? "0" : termText(n, true)) + (one && list.some((t) => !t.c.int) ? " (" + one.v + " is 1" + one.v + ")" : ""));
        if (!c.zero) { out.push(n); fly.push([list.map((t) => t.k), n.k]); }
    };
    // keep the order the kinds first appear in: x terms, then numbers, unless the number came first
    const varFirst = sd.findIndex((t) => t.v) <= sd.findIndex((t) => !t.v) || !cs.length;
    if (varFirst) { make(vs, "x"); make(cs, "n"); } else { make(cs, "n"); make(vs, "x"); }
    return out;
}
function stepCombine(W, line) {
    const why = [], hl = [], fly = [];
    const s2 = line.s.map((sd) => combineSide(W, sd, why, hl, fly));
    const next = Object.assign({}, line, { s: s2 });
    W.steps.push({ move: "combine", title: "Combine like terms", why: "Combine like terms: " + why.join("; ") + ".",
        seq: [...hl.map((h) => ({ a: "hl", ks: h.ks, tone: h.tone })), { a: "row", row: lineRow(W, next) }, ...fly.map(([from, to]) => ({ a: "fly", pairs: from.map((f) => [f, to]), merge: true }))] });
    return next;
}
/** Add a term (op) to every side. Matching terms that cancel get struck through; others combine. */
function stepBoth(W, line, op, purpose) {
    const opCells = [], strikes = [], fly = [], keepRel = line.r.slice();
    const s2 = line.s.map((sd, si) => {
        const ok = key(W);
        opCells.push(R([signedText(op)], { k: ok }));
        const like = sd.findIndex((t) => !t.g && !!t.v === !!op.v);
        const out = sd.slice();
        if (like >= 0) {
            const t = sd[like], c = t.c.add(op.c);
            if (c.zero) { out.splice(like, 1); strikes.push(t.k, ok); }
            else { const n = { c, v: t.v, g: null, over: t.over && op.over, dec: t.dec || op.dec, k: key(W) }; out[like] = n; fly.push([[t.k, ok], n.k]); }
        } else { const n = Object.assign({}, op, { k: key(W) }); out.push(n); fly.push([[ok], n.k]); }
        return out;
    });
    const cells = []; opCells.forEach((c, i) => { cells.push(c); if (i < line.r.length) cells.push(null); });
    const next = { s: s2, r: keepRel };
    const amt = dtText(termDT(Object.assign({}, op, { c: op.c.abs() }), true));
    const verb = op.c.sign < 0 ? "Subtract " + amt + " from" : "Add " + amt + " to";
    const n = line.s.length === 3 ? "all three parts" : "both sides";
    W.steps.push({ move: "both", title: verb + " " + n, why: verb + " " + n + (purpose ? " " + purpose : "") + ".",
        seq: [{ a: "row", row: { t: "op", cells } }, ...(strikes.length ? [{ a: "strike", ks: strikes }] : []), { a: "row", row: lineRow(W, next) }, ...fly.map(([from, to]) => ({ a: "fly", pairs: from.map((f) => [f, to]), merge: true }))] });
    return next;
}
function stepClear(W, line) {
    let L = 1;
    line.s.forEach((sd) => sd.forEach((t) => { L = lcm(L, t.c.d); }));
    const m = new Q(L), fly = [], ops = [];
    const s2 = line.s.map((sd) => {
        ops.push(R(["×" + L], { k: key(W) }));
        return sd.map((t) => { const n = { c: t.c.mul(m), v: t.v, g: null, over: false, dec: false, k: key(W) }; fly.push([t.k, n.k]); return n; });
    });
    const dens = [...new Set(line.s.flat().filter((t) => !t.c.int).map((t) => t.c.d))].join(" and ");
    const cells = []; ops.forEach((c, i) => { cells.push(c); if (i < line.r.length) cells.push(null); });
    const next = { s: s2, r: line.r.slice() };
    W.steps.push({ move: "clear", title: "Clear the fractions", why: "Multiply every term on both sides by " + L + " (the least common denominator of " + dens + "). The fractions go away and the answer stays the same.",
        seq: [{ a: "row", row: { t: "op", cells } }, { a: "row", row: lineRow(W, next) }, { a: "fly", pairs: fly }] });
    return next;
}
function stepDivide(W, line, vi, a) {
    const flip = a.sign < 0 && line.r.some((r) => r !== "=");
    const dec = line.s[vi].some((t) => t.dec);
    const asDiv = a.int || (dec && terminates(a));
    const r2 = flip ? line.r.map((r) => FLIPREL[r]) : line.r.slice();
    const rk = line.r.map(() => key(W));
    const vt = line.s[vi].find((t) => t.v), v = vt.v;
    const s2 = line.s.map((sd, i) => (i === vi ? [{ c: ONE, v, g: null, over: false, dec: false, k: key(W) }] : sd.map((t) => ({ c: t.c.div(a), v: null, g: null, over: false, dec: t.dec || dec, k: key(W) }))));
    const next = { s: s2, r: r2, rk: flip ? rk : null };
    const aT = numText(a, dec ? "dec" : "frac");
    const seq = [];
    let why;
    if (asDiv && !flip && !a.abs().one) {
        // write each side over a, then cancel a/a on the x side
        const kt = key(W), kb = key(W), sty = dec ? "dec" : "frac", cells = [];
        line.s.forEach((sd, i) => {
            cells.push(i === vi ? F(R([R([numDT(a, sty)], { k: kt }), v]), R([numDT(a, sty)], { k: kb })) : F(sideDT(sd), numDT(a, sty)));
            if (i < line.r.length) cells.push(line.r[i]);
        });
        const semDiv = { s: line.s.map(formOf).map((f) => ({ a: f.a.div(a), b: f.b.div(a) })), r: line.r.slice() };
        seq.push({ a: "row", row: { t: "line", cells, sem: semDiv } }, { a: "strike", ks: [kt, kb] }, { a: "row", row: lineRow(W, next) });
        why = "Divide " + (line.s.length === 3 ? "all three parts" : "both sides") + " by " + aT + ". On the " + v + " side, " + aT + " ÷ " + aT + " = 1, so " + v + " is alone.";
    } else if (asDiv) {
        const cells = []; line.s.forEach((sd, i) => { cells.push(R(["÷" + (a.sign < 0 ? "(" + aT + ")" : aT)], { k: key(W) })); if (i < line.r.length) cells.push(null); });
        seq.push({ a: "row", row: { t: "op", cells } }, { a: "row", row: lineRow(W, next) });
        if (flip) seq.push({ a: "turn", ks: rk });
        why = "Divide both sides by " + aT + "." + (flip ? " Dividing by a negative number flips the inequality sign: " + line.r.join(" ") + " becomes " + r2.join(" ") + "." : " Now " + v + " is alone.");
    } else {
        // multiply by the reciprocal: the fraction in front of x flips over
        const rcp = a.inv(), ck = vt.k + "c", cells = [], okv = key(W);
        line.s.forEach((sd, i) => { cells.push(R(["×", R([numDT(rcp, "frac")], i === vi ? { k: okv } : {})], i === vi ? {} : { k: key(W) })); if (i < line.r.length) cells.push(null); });
        seq.push({ a: "row", row: { t: "op", cells } }, { a: "flip", from: ck, to: okv }, { a: "strike", ks: [ck, okv] }, { a: "row", row: lineRow(W, next) });
        if (flip) seq.push({ a: "turn", ks: rk });
        why = "Multiply both sides by " + numText(rcp, "frac") + ", the reciprocal (flip) of " + numText(a, "frac") + ". " + numText(a, "frac") + " × " + numText(rcp, "frac") + " = 1, so " + v + " is alone." + (flip ? " Multiplying by a negative flips the sign: " + line.r.join(" ") + " becomes " + r2.join(" ") + "." : "");
    }
    W.steps.push({ move: flip ? "flip" : asDiv ? "divide" : "reciprocal", title: asDiv ? "Divide " + (line.s.length === 3 ? "all three parts" : "both sides") + " by " + aT : "Multiply by the reciprocal", why, seq });
    return next;
}
function stepSwap(W, line) {
    const r2 = [FLIPREL[line.r[0]]], next = { s: [line.s[1].map((t) => dup(W, t)), line.s[0].map((t) => dup(W, t))], r: r2 };
    const pairs = []; line.s[1].forEach((t, i) => pairs.push([t.k, next.s[0][i].k])); line.s[0].forEach((t, i) => pairs.push([t.k, next.s[1][i].k]));
    const v = varOf(line);
    const why = line.r[0] === "=" ? "Read it from the " + v + " side: " + lineText(line) + " means " + lineText(next) + "."
        : "Read it from the " + v + " side. " + lineText(line) + " means " + lineText(next) + ": the sign turns around with the sides.";
    W.steps.push({ move: "swap", title: "Put " + v + " first", why, seq: [{ a: "row", row: lineRow(W, next) }, { a: "fly", pairs }] });
    return next;
}

/* ---------- expressions (for checks and for evaluating) ---------- */
// node: {k:"n", q, s} {k:"op", op:"+-*/^", a, b, imp, sym} {k:"p", a} {k:"cf", a, b} {k:"v", name}
function parseExpr(W, text, vars) {
    const toks = typeof text === "string" ? tokens(text) : text;
    if (!toks) return null;
    let i = 0;
    const peek = () => toks[i];
    const N = (o) => Object.assign(o, { id: key(W) });
    function expr() {
        let a = term();
        while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) { const op = peek().v; i++; a = N({ k: "op", op, a, b: term() }); }
        return a;
    }
    function term() {
        let a = unary();
        for (;;) {
            const tk = peek();
            if (tk && tk.t === "op" && (tk.v === "*" || tk.v === "/")) { i++; a = N({ k: "op", op: tk.v, a, b: unary(), sym: tk.v === "*" ? "×" : "÷" }); }
            else if (tk && (tk.t === "(" || tk.t === "var" || (tk.t === "brace" && a.k !== "n"))) a = N({ k: "op", op: "*", a, b: unary(), imp: true });
            else return a;
        }
    }
    function unary() {
        const tk = peek();
        if (tk && tk.t === "op" && tk.v === "-") {
            i++; const b = unary();
            if (b.k === "n") return N({ k: "n", q: b.q.neg(), s: b.s });
            return N({ k: "op", op: "*", a: N({ k: "n", q: new Q(-1), s: "int", neg1: true }), b, imp: true });
        }
        if (tk && tk.t === "op" && tk.v === "+") { i++; return unary(); }
        return power();
    }
    function power() {
        const a = atom();
        if (peek() && peek().t === "op" && peek().v === "^") { i++; const b = atom(); return N({ k: "op", op: "^", a, b }); }
        return a;
    }
    function atom() {
        const tk = peek(); if (!tk) throw new Error("end");
        if (tk.t === "num") { i++; return N({ k: "n", q: tk.q, s: tk.s }); }
        if (tk.t === "var") { i++; if (vars && vars[tk.v]) return N({ k: "p", a: N({ k: "n", q: vars[tk.v], s: "int", sub: true }) }); return N({ k: "v", name: tk.v }); }
        if (tk.t === "(") { i++; const a = expr(); if (!peek() || peek().t !== ")") throw new Error("no )"); i++; return N({ k: "p", a }); }
        if (tk.t === "brace") {
            i++;
            const top = parseExpr(W, tk.top, vars), bot = parseExpr(W, tk.bot, vars);
            if (top.k === "n" && bot.k === "n" && top.q.int && bot.q.int && top.q.sign >= 0 && bot.q.sign > 0) return N({ k: "n", q: top.q.div(bot.q), s: "frac", rawTop: top.q, rawBot: bot.q });
            if (top.k === "n" && bot.k === "n" && top.q.int && bot.q.int) return N({ k: "n", q: top.q.div(bot.q), s: "frac" });
            return N({ k: "cf", a: top, b: bot });
        }
        throw new Error("bad token");
    }
    const out = expr();
    if (i !== toks.length) throw new Error("left over");
    return out;
}
function valueOf(n, vars) {
    switch (n.k) {
        case "n": return n.q;
        case "v": if (vars && vars[n.name]) return vars[n.name]; throw new Error("unknown " + n.name);
        case "p": return valueOf(n.a, vars);
        case "cf": return valueOf(n.a, vars).div(valueOf(n.b, vars));
        case "op": {
            const a = valueOf(n.a, vars), b = valueOf(n.b, vars);
            if (n.op === "+") return a.add(b); if (n.op === "-") return a.sub(b); if (n.op === "*") return a.mul(b); if (n.op === "/") return a.div(b);
            if (n.op === "^") { if (!b.int || b.n < 0 || b.n > 12) throw new Error("power"); return a.pow(b.n); }
        }
    }
    throw new Error("bad node");
}
const isNum = (n) => n.k === "n" || (n.k === "p" && n.a.k === "n");
const numOf = (n) => (n.k === "n" ? n : n.a);
function exprDT(n, parentOp, right) {
    let d;
    switch (n.k) {
        case "n": d = n.rawTop ? numDT(n.q, "frac") : numDT(n.q, n.s === "int" && !n.q.int ? "frac" : n.s); if (n.sub) d.c = "w-sub"; break;
        case "v": d = R([n.name]); break;
        case "p": d = R(["(", exprDT(n.a), ")"]); break;
        case "cf": d = F(exprDT(n.a), exprDT(n.b)); break;
        case "op": {
            if (n.op === "^") { d = R([exprDT(n.a), { sup: exprDT(n.b) }]); break; }
            const sym = n.op === "+" ? " + " : n.op === "-" ? " " + MINUS + " " : n.op === "/" ? " ÷ " : n.imp ? "" : " " + (n.sym || "×") + " ";
            if (n.a.neg1 && n.imp) { d = R([R([MINUS], { k: n.a.id }), exprDT(n.b)]); break; }
            d = R([exprDT(n.a, n.op), sym ? R([sym], { k: n.id + "o" }) : "", exprDT(n.b, n.op, true)]);
            break;
        }
    }
    d.k = n.id; return d;
}
const exprText = (n) => dtText(exprDT(n));
const replaceNode = (n, target, by) => {
    if (n === target || (target && target.id && n.id === target.id)) return by;
    const o = Object.assign({}, n);
    if (n.a) o.a = replaceNode(n.a, target, by);
    if (n.b) o.b = replaceNode(n.b, target, by);
    return o;
};
/** The next operation to do, by the order of operations: inside parentheses first, then powers, × ÷, + − (left to right). */
function nextOp(root) {
    const found = [];
    (function walk(n, depth) {
        if (n.k === "p") { walk(n.a, depth + 1); return; }
        if (n.k === "cf") { if (isNum(n.a) && isNum(n.b)) found.push({ n, depth: depth + 1, rank: 2 }); else { walk(n.a, depth + 1); walk(n.b, depth + 1); } return; }
        if (n.k !== "op") return;
        if (isNum(n.a) && isNum(n.b)) found.push({ n, depth, rank: n.op === "^" ? 3 : n.op === "*" || n.op === "/" ? 2 : 1 });
        walk(n.a, depth); walk(n.b, depth);
    })(root, 0);
    if (!found.length) return null;
    found.sort((x, y) => y.depth - x.depth || y.rank - x.rank);
    return found[0].n;
}
/** Wrap a number in ( ) when it is negative and sits after an operation, the way it is written. */
function tidyParens(root) {
    function fix(n, ctx) {
        if (!n) return n;
        if (n.k === "p" && n.a.k === "n" && n.a.q.sign >= 0 && ctx !== "imp" && ctx !== "base" && !(n.a.sub && (ctx === "impL" || ctx === "top"))) return fix(n.a, ctx);
        const o = Object.assign({}, n);
        if (n.k === "op") {
            o.a = fix(n.a, n.op === "^" ? "base" : n.imp ? "impL" : "left");
            o.b = fix(n.b, n.imp ? "imp" : "right");
            if (o.b.k === "n" && (o.b.q.sign < 0 || (n.imp && !(n.a.neg1)))) o.b = { k: "p", a: o.b, id: o.b.id + "p" };   // 2(4), never 24
            if (n.op === "^" && o.a.k === "n" && o.a.q.sign < 0) o.a = { k: "p", a: o.a, id: o.a.id + "p" };
        } else if (n.k === "p") o.a = fix(n.a, "in");
        else if (n.k === "cf") { o.a = fix(n.a, "in"); o.b = fix(n.b, "in"); }
        return o;
    }
    return fix(root, "top");
}

/* ---------- evaluating step by step ---------- */
function evalRow(W, root, first) {
    return { t: "line", cells: first ? [exprDT(root), null, null] : [null, "=", exprDT(root)], sem: { v: valueOf(root) } };
}
function signWhy(a, b, op) {
    const neg = (a.sign < 0) !== (b.sign < 0);
    const w = op === "*" ? "×" : "÷";
    if (a.sign < 0 || b.sign < 0) return (a.sign < 0 ? "Negative" : "Positive") + " " + w + " " + (b.sign < 0 ? "negative" : "positive") + " = " + (neg ? "negative" : "positive") + ".";
    return "";
}
const fracLike = (n) => n.s === "frac" || n.s === "mixed";
function evaluate(W, root0, opts) {
    let root = tidyParens(root0);
    const only = nextOp(root) && (root.k === "op" || root.k === "cf") && isNum(root.a) && isNum(root.b);
    const OPN = { "+": "adding", "-": "subtracting", "*": "multiplying", "/": "dividing", "^": "an exponent" };
    const why0 = only && root.k === "op" ? "This is " + OPN[root.op] + (root.op === "*" || root.op === "/" ? ". Decide the sign first, then work with the numbers." : " signed numbers. Look at both signs first.")
        : "More than one operation, so go in order: parentheses, exponents, × and ÷, then + and −, left to right.";
    const seq0 = [{ a: "row", row: evalRow(W, root, true) }];
    if (opts && opts.story) {
        const norm = (t) => String(t).replace(/[\s()]/g, "").replace(/[\u2212-]/g, "-").replace(/\{(\d+)\/(\d+)\}/g, "$1/$2").replace(/\*/g, "×");
        const nodes = []; (function walk(n) { if (!n) return; nodes.push(n); walk(n.a); walk(n.b); })(root);
        const pairs = opts.story.map((mk, i) => { const n = nodes.find((x) => norm(exprText(x)) === norm(mk[1])); return n ? ["s" + i, n.id] : null; }).filter(Boolean);
        if (pairs.length) seq0.push({ a: "fly", pairs, story: true });
    }
    if (!(opts && opts.noStart)) W.steps.push({ move: opts && opts.story ? "setup" : "start", title: opts && opts.story ? "Write it as math" : opts && opts.title || "The problem", why: opts && opts.story ? "Each number from the story goes into the problem" + (/[\u2212-]\d/.test(exprText(root).replace(/(\d|\)) [\u2212-] /g, "$1 + ")) ? ", with its sign." : ".") : opts && opts.why0 || why0, seq: seq0 });
    // mixed decimals and fractions: write the fractions as decimals first
    const nums = []; (function walk(n) { if (n.k === "n") nums.push(n); ["a", "b"].forEach((x) => n[x] && walk(n[x])); })(root);
    if (nums.some((n) => n.s === "dec") && nums.some((n) => fracLike(n) && terminates(n.q))) {
        const conv = []; let r2 = root;
        nums.filter((n) => fracLike(n) && terminates(n.q)).forEach((n) => { const m = { k: "n", q: n.q, s: "dec", id: key(W) }; conv.push([n.id, m.id, numText(n.q, "frac") + " = " + numText(n.q, "dec")]); r2 = replaceNode(r2, n, m); });
        root = tidyParens(r2);
        W.steps.push({ move: "convert", title: "Write every number as a decimal", why: "Some numbers are fractions and some are decimals. Write them all as decimals: " + conv.map((c) => c[2]).join(", ") + ".",
            seq: [{ a: "hl", ks: conv.map((c) => c[0]), tone: "n" }, { a: "row", row: evalRow(W, root) }, { a: "fly", pairs: conv.map((c) => [c[0], c[1]]), flip: true }] });
    }
    let guard = 0;
    for (let n = nextOp(root); n && guard < 30; n = nextOp(root), guard++) root = reduce(W, root, n, only);
    return root;
}
function reduce(W, root, n, only) {
    const after = (by, move, title, why, extra) => {
        const r2 = tidyParens(replaceNode(root, n, by));
        W.steps.push({ move, title, why, seq: [{ a: "box", ks: [n.id] }, ...(extra && extra.pre || []), { a: "row", row: evalRow(W, r2) }, ...(extra && extra.post || [{ a: "fly", pairs: [[n.id, by.id]], merge: true }])] });
        return r2;
    };
    if (n.k === "cf") {
        const by = { k: "op", op: "/", a: n.a, b: n.b, sym: "÷", id: key(W) };
        return after(by, "cfrac", "The fraction bar means divide", "A complex fraction is a division problem: the top divided by the bottom. " + exprText(n.a) + " ÷ " + exprText(n.b) + ".", { post: [] });
    }
    const A = numOf(n.a), B = numOf(n.b), a = A.q, b = B.q;
    const st = styleOf(A.s, B.s);
    const res = (q, s) => ({ k: "n", q, s: s || (st === "dec" && terminates(q) ? "dec" : st === "int" && !q.int ? "frac" : st), id: key(W) });
    if (n.op === "-" && (b.sign < 0 || (a.sign < 0 && b.sign > 0 && a.int && b.int))) {
        const nb = { k: "n", q: b.neg(), s: B.s, id: key(W) };
        const by = { k: "op", op: "+", a: n.a, b: nb, id: key(W) };
        const r2 = tidyParens(replaceNode(root, n, by));
        W.steps.push({ move: "kcc", title: "Subtracting is adding the opposite", why: "Keep " + numText(a, A.s) + ", change − to +, and change " + numText(b, B.s) + " to its opposite, " + numText(b.neg(), B.s) + ".",
            seq: [{ a: "box", ks: [n.id] }, { a: "row", row: evalRow(W, r2) }, { a: "turn", ks: [by.id + "o"] }, { a: "fly", pairs: [[B.id, nb.id]], flip: true }] });
        return r2;
    }
    if (n.op === "+" || n.op === "-") {
        const v = n.op === "+" ? a.add(b) : a.sub(b);
        if (st === "frac" && a.d !== b.d) {
            const L = lcm(a.d, b.d);
            const ea = { k: "n", q: a, s: "frac", id: key(W), rawTop: new Q(a.n * (L / a.d)), rawBot: new Q(L) }, eb = { k: "n", q: b, s: "frac", id: key(W), rawTop: new Q(b.n * (L / b.d)), rawBot: new Q(L) };
            const showA = { k: "n", q: a, s: "frac", id: ea.id }, showB = { k: "n", q: b, s: "frac", id: eb.id };
            const by = Object.assign({}, n, { a: n.a.k === "p" ? Object.assign({}, n.a, { a: showA }) : showA, b: n.b.k === "p" ? Object.assign({}, n.b, { a: showB }) : showB, id: key(W) });
            const r2 = tidyParens(replaceNode(root, n, by));
            const row = evalRow(W, r2);
            row.cells[2] = exprDTwith(r2, (m) => (m.id === ea.id ? unreduced(a, L, ea.id) : m.id === eb.id ? unreduced(b, L, eb.id) : null));
            const parts = [a, b].filter((q) => q.d !== L).map((q) => numText(q, "frac") + " = " + dtText(unreduced(q, L)) + " (× " + (L / q.d) + " on top and bottom)");
            W.steps.push({ move: "lcd", title: "Find a common denominator", why: "The bottoms are different. Use " + L + " for both: " + parts.join(", ") + ".", seq: [{ a: "box", ks: [n.id] }, { a: "row", row: row }, { a: "fly", pairs: [[A.id, ea.id], [B.id, eb.id]] }] });
            root = r2;
            const tops = (q) => q.n * (L / q.d);
            const raw = new Q(n.op === "+" ? tops(a) + tops(b) : tops(a) - tops(b), 1);
            const by2 = { k: "n", q: v, s: "frac", id: key(W), rawTop: raw.abs(), rawBot: new Q(L), rawNeg: raw.sign < 0 };
            const r3 = tidyParens(replaceNode(root, findNode(root, by.id), by2));
            const row3 = evalRow(W, r3); row3.cells[2] = exprDTwith(r3, (m) => (m.id === by2.id ? R([raw.sign < 0 ? MINUS : "", F(String(Math.abs(raw.n)), String(L))], { k: by2.id }) : null));
            const sg = (x) => (x < 0 ? MINUS + Math.abs(x) : String(x));
            W.steps.push({ move: "addtops", title: (n.op === "+" ? "Add" : "Subtract") + " the tops", why: "Same bottom, so " + (n.op === "+" ? "add" : "subtract") + " the tops and keep the bottom " + L + ": " + sg(tops(a)) + (n.op === "+" ? " + " : " − ") + (tops(b) < 0 ? "(" + sg(tops(b)) + ")" : tops(b)) + " = " + sg(raw.n) + ".", seq: [{ a: "box", ks: [by.id] }, { a: "row", row: row3 }, { a: "fly", pairs: [[ea.id, by2.id], [eb.id, by2.id]], merge: true }] });
            root = r3;
            if (gcd(Math.abs(raw.n), L) > 1 && !raw.zero) {
                const by3 = { k: "n", q: v, s: "frac", id: key(W) };
                const g = gcd(Math.abs(raw.n), L), r4 = tidyParens(replaceNode(root, findNode(root, by2.id), by3));
                W.steps.push({ move: "simplify", title: "Simplify", why: "Divide the top and bottom by " + g + ": " + (raw.sign < 0 ? MINUS : "") + Math.abs(raw.n) + "/" + L + " = " + numText(v, "frac") + ".", seq: [{ a: "box", ks: [by2.id] }, { a: "row", row: evalRow(W, r4) }, { a: "fly", pairs: [[by2.id, by3.id]] }] });
                root = r4;
            }
            return root;
        }
        const by = res(v);
        if (only && a.int && b.int && Math.abs(a.n) <= 30 && Math.abs(b.n) <= 30 && n.op === "+") {
            const why = "Start at " + numText(a) + ". Adding " + numText(b) + " means move " + Math.abs(b.n) + " to the " + (b.sign < 0 ? "left" : "right") + ". You land on " + numText(v) + ".";
            return after(by, "numline", "Use a number line", why, { pre: [{ a: "row", row: { t: "pic", pic: { kind: "numline", start: a.n, move: b.n } } }] });
        }
        let why;
        const sa = numText(a.abs(), st === "dec" ? "dec" : "frac"), sb = numText(b.abs(), st === "dec" ? "dec" : "frac");
        if (n.op === "+") {
            if (v.zero && !a.zero) why = numText(a, st === "dec" ? "dec" : "frac") + " and " + numText(b, st === "dec" ? "dec" : "frac") + " are opposites. Opposites add up to 0.";
            else if (a.sign * b.sign < 0) why = "Different signs: subtract " + (a.abs().cmp(b.abs()) >= 0 ? sa + " − " + sb : sb + " − " + sa) + " and keep the sign of the number farther from 0. " + numText(a, st === "dec" ? "dec" : "frac") + " + " + numText(b, st === "dec" ? "dec" : "frac") + " = " + numText(v, st === "dec" ? "dec" : "frac") + ".";
            else why = a.sign < 0 && b.sign < 0 ? "Same signs: add " + sa + " + " + sb + " and keep the negative sign: " + numText(v, st === "dec" ? "dec" : "frac") + "." : "Add: " + sa + " + " + sb + " = " + numText(v, st === "dec" ? "dec" : "frac") + ".";
        } else why = "Subtract: " + numText(a, st === "dec" ? "dec" : "frac") + " − " + numText(b, st === "dec" ? "dec" : "frac") + " = " + numText(v, st === "dec" ? "dec" : "frac") + "." + (v.sign < 0 && a.sign > 0 ? " The bigger number is subtracted, so the answer is negative." : "");
        if (st === "dec" && (!a.int || !b.int)) why += " Line up the decimal points.";
        return after(by, n.op === "+" ? "add" : "sub", n.op === "+" ? "Add" : "Subtract", why);
    }
    if (n.op === "^") {
        if (!b.int || b.n < 1 || b.n > 4) throw new Error("power");
        const v = a.pow(b.n), by = res(v);
        const base = numText(a, A.s), rep = Array(b.n).fill(a.sign < 0 || !a.int ? "(" + base + ")" : base).join(a.sign < 0 || !a.int ? "" : " × ");
        return after(by, "power", "Exponent", "The exponent " + b.n + " means use " + base + " as a factor " + b.n + " times: " + rep + " = " + numText(v, st === "dec" ? "dec" : "frac") + "." + (a.sign < 0 ? (b.n % 2 ? " An odd number of negatives is negative." : " An even number of negatives is positive.") : ""));
    }
    if (n.op === "/") {
        if (b.zero) throw new Error("divide by zero");
        if (st === "frac") {
            // keep, change, flip
            const fb = { k: "n", q: b.inv(), s: "frac", id: key(W) };
            const by = Object.assign({}, n, { op: "*", sym: "×", b: n.b.k === "p" ? Object.assign({}, n.b, { a: fb }) : fb, id: key(W), imp: false });
            const r2 = tidyParens(replaceNode(root, n, by));
            W.steps.push({ move: "kcf", title: "Keep, change, flip", why: "Dividing by a fraction is multiplying by its reciprocal. Keep " + numText(a, A.s) + ", change ÷ to ×, flip " + numText(b, B.s) + " to " + numText(b.inv(), "frac") + ".",
                seq: [{ a: "box", ks: [n.id] }, { a: "row", row: evalRow(W, r2) }, { a: "turn", ks: [by.id + "o"] }, { a: "fly", pairs: [[B.id, fb.id]], flip: true }] });
            root = r2;
            return reduce(W, root, findNode(root, by.id), only);
        }
        const v = a.div(b), by = res(v);
        let why = signWhy(a, b, "/") + " " + numText(a.abs(), A.s) + " ÷ " + numText(b.abs(), B.s) + " = " + numText(v.abs(), by.s) + ".";
        if (st === "dec" && !b.int) { const p = (decStr(b.abs()).split(".")[1] || "").length; why += " Move both decimal points " + p + " place" + (p > 1 ? "s" : "") + " to the right so you divide by a whole number."; }
        return after(by, "div", "Divide", why.trim());
    }
    if (n.op === "*") {
        const v = a.mul(b);
        if (st === "frac" && !(a.int && b.int)) {
            // mixed numbers become improper first
            if (A.s === "mixed" || B.s === "mixed") {
                const na = A.s === "mixed" ? { k: "n", q: a, s: "frac", id: key(W) } : A, nb = B.s === "mixed" ? { k: "n", q: b, s: "frac", id: key(W) } : B;
                let by = Object.assign({}, n, { id: key(W) });
                by = replaceNode(by, A, na); by = replaceNode(by, B, nb);
                const r2 = tidyParens(replaceNode(root, n, by));
                const parts = [A, B].filter((x) => x.s === "mixed").map((x) => numText(x.q, "mixed") + " = " + numText(x.q, "frac"));
                W.steps.push({ move: "improper", title: "Mixed numbers to fractions", why: "Write the mixed number as a fraction first: " + parts.join(", ") + ".", seq: [{ a: "box", ks: [A.s === "mixed" ? A.id : B.id] }, { a: "row", row: evalRow(W, r2) }, { a: "fly", pairs: [[A.id, na.id], [B.id, nb.id]] }] });
                root = r2;
                return reduce(W, root, findNode(root, by.id), only);
            }
            const an = Math.abs(a.n), ad = a.d, bn = Math.abs(b.n), bd = b.d;
            const g1 = gcd(an, bd), g2 = gcd(bn, ad);
            const sgn = signWhy(a, b, "*");
            if ((g1 > 1 || g2 > 1) && !(an === 0 || bn === 0)) {
                // cross-cancel: strike the numbers and write the smaller ones above
                const row = evalRow(W, root);
                const ks = [];
                row.cells[0] = null; row.cells[1] = "=";
                row.cells[2] = exprDTwith(root, (m) => {
                    if (m.id !== A.id && m.id !== B.id) return null;
                    const isA = m.id === A.id, top = isA ? an : bn, bot = isA ? ad : bd, gt = isA ? g1 : g2, gb = isA ? g2 : g1;
                    const kt = key(W), kb = key(W); if (gt > 1) ks.push(kt); if (gb > 1) ks.push(kb);
                    const T = R([String(top)], { k: kt, u: gt > 1 ? String(top / gt) : undefined });
                    if (bot === 1) return R([m.q.sign < 0 ? MINUS : "", T], { k: m.id + "x" });
                    return R([m.q.sign < 0 ? MINUS : "", F(T, R([String(bot)], { k: kb, u: gb > 1 ? String(bot / gb) : undefined }))], { k: m.id + "x" });
                });
                const pairs = []; if (g1 > 1) pairs.push(an + " and " + bd + " (÷" + g1 + ")"); if (g2 > 1) pairs.push(bn + " and " + ad + " (÷" + g2 + ")");
                W.steps.push({ move: "cancel", title: "Cancel first", why: "Before multiplying, divide a top and a bottom by the same number: " + pairs.join(", ") + ". Smaller numbers, same answer.", seq: [{ a: "row", row }, { a: "strike", ks, up: true }] });
                const by = res(v, "frac");
                const tA = an / g1, bB = bd / g1, tB = bn / g2, bA = ad / g2;
                return after(by, "mul", "Multiply", (sgn ? sgn + " " : "") + "Multiply the tops and the bottoms: " + tA + " × " + tB + " = " + tA * tB + ", " + bA + " × " + bB + " = " + bA * bB + ". So " + numText(v, "frac") + ".");
            }
            const by = res(v, "frac");
            return after(by, "mul", "Multiply", (sgn ? sgn + " " : "") + "Multiply the tops and the bottoms: " + an + " × " + bn + " = " + an * bn + ", " + ad + " × " + bd + " = " + ad * bd + "." + (gcd(an * bn, ad * bd) > 1 ? " Simplify: " + numText(v.abs(), "frac") + "." : ""));
        }
        const by = res(v);
        let why = (signWhy(a, b, "*") + " " + numText(a.abs(), A.s === "int" ? "int" : st) + " × " + numText(b.abs(), B.s === "int" ? "int" : st) + " = " + numText(v.abs(), by.s) + ".").trim();
        if (st === "dec" && (!a.int || !b.int)) why += " Multiply as whole numbers, then count the decimal places.";
        return after(by, "mul", "Multiply", why);
    }
    throw new Error("cannot do " + n.op);
}
function findNode(root, id) { let f = null; (function w(n) { if (!n || f) return; if (n.id === id) { f = n; return; } w(n.a); w(n.b); })(root); return f; }
function exprDTwith(root, swap) {
    function go(n) {
        const s = swap(n); if (s) return s;
        if (n.k === "n" || n.k === "v") return exprDT(n);
        if (n.k === "p") return R(["(", go(n.a), ")"], { k: n.id });
        if (n.k === "cf") return F(go(n.a), go(n.b), { k: n.id });
        if (n.op === "^") return R([go(n.a), { sup: go(n.b) }], { k: n.id });
        const sym = n.op === "+" ? " + " : n.op === "-" ? " " + MINUS + " " : n.op === "/" ? " ÷ " : n.imp ? "" : " " + (n.sym || "×") + " ";
        return R([go(n.a), sym ? R([sym], { k: n.id + "o" }) : "", go(n.b)], { k: n.id });
    }
    return go(root);
}
const unreduced = (q, L, k) => R([q.sign < 0 ? MINUS : "", F(String(Math.abs(q.n) * (L / q.d)), String(L))], k ? { k } : undefined);

/* ---------- the answer key ---------- */
/** What an answer key says: {kind:"num", v} {kind:"eq", v} {kind:"rel", rel, v} {kind:"and", …} {kind:"none"} {kind:"all"} {kind:"undef"}. */
export function readKey(a) {
    let s = String(a || "").trim();
    if (/^no solution/i.test(s)) return { kind: "none" };
    if (/^infinitely many/i.test(s)) return { kind: "all" };
    if (/^undefined/i.test(s)) return { kind: "undef" };
    let m = s.match(/^one solution\s*\(\s*[a-z]\s*=\s*([^)]+)\)/i);
    if (m) { const v = qOf(m[1]); return v ? { kind: "eq", v, one: true } : null; }
    m = s.match(/^(?:[^;]*;\s*)?([a-zA-Z])\s*([<≤])\s*([−-]?[\d.]+)(?:\s*[a-z]+)?\s+or\s+\1\s*([>≥])\s*([−-]?[\d.]+)(?:\s*[a-z]+)?$/);
    if (m) { const lo = qOf(m[3]), hi = qOf(m[5]); return lo && hi ? { kind: "or", lo, hi, rlo: m[2], rhi: m[4] } : null; }
    if (/, so /.test(s)) { const ps = s.split(/, so /); s = /^[a-z]\s*[<>≤≥]/.test(ps[0]) ? ps[0] : ps.pop(); }
    s = s.replace(/\s*\(.*\)\s*$/, "").trim();
    m = s.match(/^(\S+)\s*([<≤])\s*([a-z])\s*([<≤])\s*(\S+)$/);
    if (m) { const lo = qOf(m[1]), hi = qOf(m[5]); return lo && hi ? { kind: "and", lo, hi, rlo: m[2], rhi: m[4] } : null; }
    m = s.match(/^([a-z])\s*(=|<|>|≤|≥)\s*([^\s,;]+)(.*)$/);
    if (m) { const v = qOf(m[3]); return v ? { kind: m[2] === "=" ? "eq" : "rel", rel: m[2], v, rest: m[4].trim() } : null; }
    m = s.match(/^([−-]?§?[\d.,]+(?:\{\d+\/\d+\})?|[−-]?\{\d+\/\d+\})\s*(.*)$/);
    if (m) { const v = qOf(m[1]); return v ? { kind: "num", v, unit: m[2], mixed: /\d\{/.test(m[1]), dec: /\./.test(m[1]), money: /§/.test(m[1]) } : null; }
    return null;
}

/* ---------- checking a walkthrough ---------- */
const relTrue = (x, r, y) => { const c = x.cmp(y); return r === "=" ? c === 0 : r === "<" ? c < 0 : r === ">" ? c > 0 : r === "≤" ? c <= 0 : c >= 0; };
const lineTrue = (sem, x) => sem.r.every((r, i) => relTrue(sem.s[i].a.mul(x).add(sem.s[i].b), r, sem.s[i + 1].a.mul(x).add(sem.s[i + 1].b)));
/** True when two linear lines have exactly the same answers (tested at every boundary, between them and beyond). */
function sameAnswers(s1, s2) {
    const pts = [];
    [s1, s2].forEach((sem) => sem.r.forEach((r, i) => { const da = sem.s[i].a.sub(sem.s[i + 1].a), db = sem.s[i + 1].b.sub(sem.s[i].b); if (!da.zero) pts.push(db.div(da)); }));
    pts.push(ZERO);
    pts.sort((x, y) => x.cmp(y));
    const test = [pts[0].sub(ONE), pts[pts.length - 1].add(ONE)];
    pts.forEach((p, i) => { test.push(p); if (i) test.push(p.add(pts[i - 1]).div(new Q(2))); });
    return test.every((x) => lineTrue(s1, x) === lineTrue(s2, x));
}
function verify(W) {
    const errs = [];
    let first = null;
    W.steps.forEach((st, si) => st.seq.forEach((x) => {
        if (x.a !== "row" || !x.row.sem) return;
        const sem = x.row.sem;
        if (sem.truth != null) { if (!sem.truth) errs.push("step " + (si + 1) + ": check line is not true"); return; }
        if (sem.v) { if (W.kind === "eval") { if (!first) first = sem.v; else if (!sem.v.eq(first)) errs.push("step " + (si + 1) + ": value changed"); } return; }
        if (sem.f && W.kind === "simp") { if (!first) first = sem.f; else if (!(sem.f.a.eq(first.a) && sem.f.b.eq(first.b))) errs.push("step " + (si + 1) + ": not the same expression as the first line"); return; }
        if (sem.s && W.kind === "solve" && !sem.then) { if (!first) first = sem; else if (!sameAnswers(first, sem)) errs.push("step " + (si + 1) + ": not the same answers as the first line"); }
    }));
    return errs;
}

/* ---------- solving ---------- */
function solve(W, line0, opts) {
    opts = opts || {};
    const v = varOf(line0) || "x";
    let line = line0;
    if (!opts.started) W.steps.push({ move: "start", title: opts.title || "The problem", why: opts.why0 || (line.r.some((r) => r !== "=") ? "Solve it like an equation. Watch for multiplying or dividing by a negative." : "Goal: get " + v + " alone. Undo what is done to " + v + ", the same way on both sides."), seq: [{ a: "row", row: lineRow(W, line, line.abs ? { sem: null } : null) }] });
    if (line.abs) {
        const r = line.r[0], b = formOf(line.s[1]);
        if (r === ">" || r === "≥") return absOr(W, line, v);
        if (!(r === "<" || r === "≤") || !b.a.zero || b.b.sign <= 0) throw new Error("absolute value kind");
        const lo = [{ c: b.b.neg(), v: null, g: null, k: key(W) }], hi = [{ c: b.b, v: null, g: null, k: key(W) }];
        const mid = line.s[0].map((t) => dup(W, t));
        const next = { s: [lo, mid, hi], r: [r, r] };
        W.steps.push({ move: "abs", title: "Absolute value to two inequalities", why: "|" + sideText(line.s[0]) + "| " + r + " " + numText(b.b) + " means " + sideText(line.s[0]) + " is within " + numText(b.b) + " of 0: between " + numText(b.b.neg()) + " and " + numText(b.b) + ".", seq: [{ a: "row", row: lineRow(W, next) }] });
        line = next;
    }
    const start = line;
    if (line.s.some((sd) => sd.some((t) => t.g))) line = stepDistribute(W, line);
    if (line.s.some(needsCombine)) line = stepCombine(W, line);
    const coef = (sd) => sd.filter((t) => t.v).reduce((s, t) => s.add(t.c), ZERO);
    const vsides = line.s.map((sd, i) => (sd.some((t) => t.v) ? i : -1)).filter((i) => i >= 0);
    if (line.s.length === 3 && (vsides.length !== 1 || vsides[0] !== 1)) throw new Error("compound with x outside the middle");
    if (vsides.length > 1) {
        if (line.s.some((sd) => sd.some((t) => !t.c.int && !t.dec))) line = stepClear(W, line);
        const a = coef(line.s[0]), c = coef(line.s[1]);
        const smaller = a.cmp(c) <= 0 ? 0 : 1, sv = line.s[smaller].find((t) => t.v);
        line = stepBoth(W, line, { c: (smaller ? c : a).neg(), v, g: null, over: sv.over, dec: sv.dec }, a.eq(c) ? "" : "to get the " + v + "'s on one side");
        if (a.eq(c)) {
            const L = formOf(line.s[0]).b, Rr = formOf(line.s[1]).b, tr = relTrue(L, line.r[0], Rr);
            W.steps.push({ move: tr ? "all" : "none", title: tr ? "Always true" : "Never true", why: "The " + v + "'s are gone. " + numText(L) + " " + line.r[0] + " " + numText(Rr) + " is " + (tr ? "always true, so every number works: infinitely many solutions." : "never true, so no number works: no solution."), seq: [{ a: "row", row: { t: "pic", pic: { kind: "verdict", ok: tr, text: tr ? "Always true" : "Never true" } } }] });
            return { kind: tr ? "all" : "none", v };
        }
    }
    const vs = line.s.map((sd, i) => (sd.some((t) => t.v) ? i : -1)).filter((i) => i >= 0);
    if (!vs.length) {
        const L = formOf(line.s[0]).b, Rr = formOf(line.s[1]).b, tr = relTrue(L, line.r[0], Rr);
        return { kind: tr ? "all" : "none", v };
    }
    const vi = vs[0];
    const cst = line.s[vi].filter((t) => !t.v).reduce((s, t) => s.add(t.c), ZERO);
    if (!cst.zero) {
        const ct = line.s[vi].find((t) => !t.v);
        line = stepBoth(W, line, { c: cst.neg(), v: null, g: null, dec: ct.dec }, "to get " + v + " alone");
    }
    const a = coef(line.s[vi]);
    if (!a.one) line = stepDivide(W, line, vi, a);
    if (vi === 1 && line.s.length === 2) line = stepSwap(W, line);
    if (line.s.length === 3) return { kind: "and", lo: formOf(line.s[0]).b, hi: formOf(line.s[2]).b, rlo: line.r[0], rhi: line.r[1], v, line, start };
    const val = formOf(line.s[1]).b;
    return line.r[0] === "=" ? { kind: "eq", v, val, line, start } : { kind: "rel", v, rel: line.r[0], val, line, start };
}
function checkStep(W, srcText, res, line0) {
    const v = res.v;
    if (res.kind === "eq") {
        const vars = { [v]: res.val };
        const sides = srcText.split(/\s*=\s*/);
        if (sides.length !== 2) return;
        const [L, Rr] = sides.map((s) => parseExpr(W, s, vars));
        const lv = valueOf(L), rv = valueOf(Rr);
        const st = W.dec ? "dec" : "frac";
        W.steps.push({ move: "check", title: "Check", why: "Put " + numText(res.val, st) + " in for " + v + ". Both sides come out " + numText(lv, st) + ", so it checks." + (lv.eq(rv) ? "" : ""),
            seq: [{ a: "row", row: { t: "line", cells: [exprDT(tidyParens(L)), "=", exprDT(tidyParens(Rr))], sem: { truth: lv.eq(rv) }, c: "w-check" } }, { a: "row", row: { t: "line", cells: [numDT(lv, st), "=", R([numDT(rv, st), " ✓"])], sem: { truth: lv.eq(rv) }, c: "w-check" } }] });
    } else if (res.kind === "rel" || res.kind === "and") {
        let t;
        if (res.kind === "and") { const mid = res.lo.add(res.hi).div(new Q(2)), r = new Q(Math.round(mid.toNumber())); t = lineTrue(semOf(res.line), r) ? r : mid; }
        else { const right = res.rel === ">" || res.rel === "≥"; t = new Q(right ? Math.floor(res.val.toNumber()) + 1 : Math.ceil(res.val.toNumber()) - 1); }
        const sem = semOf(res.start || line0), ok = lineTrue(sem, t);
        const vals = sem.s.map((f) => f.a.mul(t).add(f.b));
        const st = W.dec ? "dec" : "frac";
        const src = res.start || line0, vsd = src.s.find((sd) => sd.some((x) => x.v));
        const sub = vsd ? parseExpr(W, sideText(vsd), { [v]: t }) : null;
        const subT = sub ? exprText(tidyParens(sub)) + " = " + numText(valueOf(sub), st) + ", and " : "";
        W.steps.push({ move: "check", title: "Check", why: "Pick a number in the answer, like " + numText(t, st) + ". Put it in for " + v + ": " + subT + vals.map((x) => numText(x, st)).reduce((acc, s, i) => acc + (i ? " " + sem.r[i - 1] + " " : "") + s, "") + " is true ✓.",
            seq: [{ a: "row", row: { t: "line", cells: vals.flatMap((x, i) => (i < sem.r.length ? [numDT(x, st), sem.r[i]] : [R([numDT(x, st), " ✓"])])), sem: { truth: ok }, c: "w-check" } }] });
        const pic = res.kind === "and" ? { kind: "ineq", lo: res.lo.toNumber(), hi: res.hi.toNumber(), loT: numText(res.lo, st), hiT: numText(res.hi, st), cl: res.rlo === "≤", ch: res.rhi === "≤" }
            : { kind: "ineq", at: res.val.toNumber(), atT: numText(res.val, st), closed: res.rel === "≤" || res.rel === "≥", dir: res.rel === ">" || res.rel === "≥" ? 1 : -1 };
        const circle = (c) => (c ? "closed circle (the number is included)" : "open circle (the number is not included)");
        W.steps.push({ move: "graph", title: "Graph it", why: res.kind === "and" ? "Shade between " + pic.loT + " and " + pic.hiT + ": " + circle(pic.cl) + " at " + pic.loT + ", " + circle(pic.ch) + " at " + pic.hiT + "."
            : "Put a " + circle(pic.closed) + " at " + pic.atT + ", then shade to the " + (pic.dir > 0 ? "right (greater)" : "left (less)") + ".", seq: [{ a: "row", row: { t: "pic", pic } }] });
    }
}
function answerStep(W, keyText, extra) {
    W.steps.push({ move: "answer", title: "Answer", why: extra || "That's the answer.", seq: [{ a: "row", row: { t: "ans", dt: keyDT(keyText) } }] });
}
/** The answer key, written with stacked fractions and $ for §. */
export function keyDT(s) {
    s = String(s).replace(/§/g, "$");
    const out = []; const re = /(\d+)\{(\d+)\/(\d+)\}|\{([^{}/]+)\/([^{}/]+)\}|\^\{?([a-z0-9]+)\}?/g; let last = 0, m;
    while ((m = re.exec(s))) {
        if (m.index > last) out.push(s.slice(last, m.index));
        out.push(m[6] ? { sup: m[6] } : m[1] ? R([m[1], F(m[2], m[3])]) : F(m[4], m[5]));
        last = re.lastIndex;
    }
    if (last < s.length) out.push(s.slice(last));
    return R(out);
}

/* ---------- angles: the fact that turns them into an equation ---------- */
const deg = (s) => s.replace(/[()]/g, "").trim();
function angleSetup(q) {
    let m;
    const T = (eq, fact, pic, then) => ({ eq, fact, pic, then });
    if ((m = q.match(/Two angles of a triangle are (\d+)° and (\d+)°\. Find the third angle/i))) return T(m[1] + " + " + m[2] + " + x = 180", "The three angles of a triangle add up to 180°.", { kind: "triangle", labels: [m[1] + "°", m[2] + "°", "x°"] });
    if ((m = q.match(/angles of a triangle are \((.+?)\)°, \((.+?)\)° and \((.+?)\)°\. Find x/i))) return T("(" + m[1] + ") + (" + m[2] + ") + (" + m[3] + ") = 180", "The three angles of a triangle add up to 180°.", { kind: "triangle", labels: ["(" + m[1] + ")°", "(" + m[2] + ")°", "(" + m[3] + ")°"], exprs: [m[1], m[2], m[3]] });
    if ((m = q.match(/isosceles triangle has a vertex angle of (\d+)°\. Find each base angle/i))) return T(m[1] + " + x + x = 180", "The angles add up to 180°, and the two base angles of an isosceles triangle are equal, so call each one x.", { kind: "triangle", labels: [m[1] + "°", "x°", "x°"], iso: true });
    if ((m = q.match(/angles of a triangle are in the ratio (\d+) : (\d+) : (\d+)\. Find the largest angle/i))) { const big = Math.max(+m[1], +m[2], +m[3]); return T(m[1] + "x + " + m[2] + "x + " + m[3] + "x = 180", "Ratio " + m[1] + " : " + m[2] + " : " + m[3] + " means the angles are " + m[1] + "x, " + m[2] + "x and " + m[3] + "x. They add up to 180°.", { kind: "triangle", labels: [m[1] + "x", m[2] + "x", m[3] + "x"], exprs: [m[1] + "x", m[2] + "x", m[3] + "x"] }, [{ label: "Largest angle", expr: big + "x", unit: "°" }]); }
    if ((m = q.match(/exterior angle of a triangle is (\d+)°\. One remote interior angle is (\d+)°\. Find the other/i))) return T(m[2] + " + x = " + m[1], "An exterior angle equals the sum of the two remote interior angles.", null);
    if ((m = q.match(/Two angles are complementary\. One is (\d+)°\. Find the other/i))) return T(m[1] + " + x = 90", "Complementary angles add up to 90°.", { kind: "wedges", total: 90, labels: [m[1] + "°", "x°"] });
    if ((m = q.match(/Two angles are supplementary\. One is (\d+)°\. Find the other/i))) return T(m[1] + " + x = 180", "Supplementary angles add up to 180°.", { kind: "wedges", total: 180, labels: [m[1] + "°", "x°"] });
    if ((m = q.match(/Vertical angles measure \((.+?)\)° and (\d+)°\. Find x/i))) return T(m[1] + " = " + m[2], "Vertical angles are equal.", { kind: "lines", pair: "vertical", labels: ["(" + m[1] + ")°", m[2] + "°"] });
    if ((m = q.match(/Two supplementary angles are \((.+?)\)° and \((.+?)\)°\. Find x/i))) return T(m[1] + " + " + m[2] + " = 180", "Supplementary angles add up to 180°.", { kind: "wedges", total: 180, labels: ["(" + deg(m[1]) + ")°", "(" + deg(m[2]) + ")°"], exprs: [m[1], m[2]] });
    if ((m = q.match(/Two complementary angles are \((.+?)\)° and \((.+?)\)°\. Find x/i))) return T(m[1] + " + " + m[2] + " = 90", "Complementary angles add up to 90°.", { kind: "wedges", total: 90, labels: ["(" + m[1] + ")°", "(" + m[2] + ")°"], exprs: [m[1], m[2]] });
    if ((m = q.match(/adjacent and form a right angle\. A = (\d+)x° and B = (\d+)x°\. Find each angle/i))) return T(m[1] + "x + " + m[2] + "x = 90", "Together they make a right angle, so they add up to 90°.", { kind: "wedges", total: 90, labels: ["A = " + m[1] + "x", "B = " + m[2] + "x"], exprs: [m[1] + "x", m[2] + "x"] }, [{ label: "A", expr: m[1] + "x", unit: "°" }, { label: "B", expr: m[2] + "x", unit: "°" }]);
    if ((m = q.match(/Three angles on a straight line are (\d+)°, x°, and (\d+)°\. Find x/i))) return T(m[1] + " + x + " + m[2] + " = 180", "Angles on a straight line add up to 180°.", { kind: "wedges", total: 180, labels: [m[1] + "°", "x°", m[2] + "°"] });
    if ((m = q.match(/An angle is (\d+) times its supplement\. Find the angle/i))) return T("x = " + m[1] + "(180 − x)", "Call the angle x. Its supplement is 180 − x, and the angle is " + m[1] + " times that.", null);
    if ((m = q.match(/Two lines cross\. One angle is (\d+)°\. Find the angle next to it/i))) return T(m[1] + " + x = 180", "Angles next to each other on a straight line add up to 180°.", { kind: "lines", pair: "linear", labels: [m[1] + "°", "x°"] });
    if ((m = q.match(/One angle is (\d+)°\. Find its (corresponding|alternate interior|alternate exterior) angle/i))) return T("x = " + m[1], (m[2][0].toUpperCase() + m[2].slice(1)) + " angles are equal when the lines are parallel.", { kind: "lines", pair: m[2].replace(" ", "-"), labels: [m[1] + "°", "x°"] });
    if ((m = q.match(/Same-side interior angles are \((.+?)\)° and \((.+?)\)°\. Find x/i))) return T(m[1] + " + " + m[2] + " = 180", "Same-side interior angles add up to 180° when the lines are parallel.", { kind: "lines", pair: "same-side", labels: ["(" + m[1] + ")°", "(" + m[2] + ")°"] });
    if ((m = q.match(/(Alternate exterior|Alternate interior|Corresponding) angles are \((.+?)\)° and (?:\((.+?)\)°|(\d+)°)\. Find x/i))) return T(m[2] + " = " + (m[3] || m[4]), m[1] + " angles are equal when the lines are parallel.", { kind: "lines", pair: m[1].toLowerCase().replace(" ", "-"), labels: ["(" + m[2] + ")°", m[3] ? "(" + m[3] + ")°" : m[4] + "°"] });
    // the same facts, worded the way newer bank problems word them
    const D = "(?:°| degrees)";
    if ((m = q.match(/^A triangle has interior angles measuring (\d+)° and (\d+)°\. What is the measure of the third interior angle\?$/))) return T(m[1] + " + " + m[2] + " + x = 180", "The three angles of a triangle add up to 180°.", { kind: "triangle", labels: [m[1] + "°", m[2] + "°", "x°"] });
    if ((m = q.match(/^In a right triangle, one of the acute angles measures (\d+)°\. What is the measure of the other acute angle\?$/))) return T("90 + " + m[1] + " + x = 180", "The three angles of a triangle add up to 180°, and the right angle is 90°.", { kind: "triangle", labels: ["90°", m[1] + "°", "x°"] });
    if ((m = q.match(/isosceles triangle with a top vertex angle of (\d+)°\. What is the measure of each of the two equal base angles\?$/))) return T(m[1] + " + x + x = 180", "The angles add up to 180°, and the two base angles of an isosceles triangle are equal, so call each one x.", { kind: "triangle", labels: [m[1] + "°", "x°", "x°"], iso: true });
    if ((m = q.match(/^The interior angles of a triangle measure \((.+?)\)°, (\d+)°, and (\d+)°\. What is the value of x\?$/))) return T("(" + m[1] + ") + " + m[2] + " + " + m[3] + " = 180", "The three angles of a triangle add up to 180°.", { kind: "triangle", labels: ["(" + m[1] + ")°", m[2] + "°", m[3] + "°"], exprs: [m[1], m[2], m[3]] });
    if ((m = q.match(/^In triangle ([A-Z])([A-Z])([A-Z]), angle \1 measures \((.+?)\)°, angle \2 measures \((.+?)\)°, and angle \3 measures \((.+?)\)°\. What is the measure of the (largest|smallest) angle in triangle \1\2\3\?$/))) {
        const ex = [m[4], m[5], m[6]], names = [m[1], m[2], m[3]], vals = anglesAt(ex, 180);
        if (!vals) return null;
        const pick = vals.indexOf((m[7] === "largest" ? Math.max : Math.min)(...vals));
        return T("(" + ex[0] + ") + (" + ex[1] + ") + (" + ex[2] + ") = 180", "The three angles of a triangle add up to 180°.", { kind: "triangle", labels: ex.map((e, i) => names[i] + " = (" + e + ")°"), exprs: ex },
            Object.assign(ex.map((e, i) => ({ label: "Angle " + names[i], expr: e, unit: "°", pick: i === pick })), { why: (v) => "Find all three angles. The " + m[7] + " is angle " + names[pick] + ", " + v[pick] + "°." }));
    }
    if ((m = q.match(/^The interior angles of a triangle are in the ratio (\d+) : (\d+) : (\d+)\. What is the difference between the largest angle and the smallest angle of the triangle\?$/))) {
        const r = [+m[1], +m[2], +m[3]], big = Math.max(...r), small = Math.min(...r);
        return T(r.map((x) => x + "x").join(" + ") + " = 180", "Ratio " + r.join(" : ") + " means the angles are " + r.map((x) => x + "x").join(", ") + ". They add up to 180°.", { kind: "triangle", labels: r.map((x) => x + "x"), exprs: r.map((x) => x + "x") }, [{ label: "Largest − smallest", expr: big + "x − " + small + "x", unit: "°" }]);
    }
    if ((m = q.match(new RegExp("^Two parallel lines are cut by a transversal\\. One of the acute angles formed measures (\\d+)" + D + "\\. What is the measure of any obtuse angle formed by these lines\\?$")))) return T(m[1] + " + x = 180", "An acute angle and the obtuse angle next to it sit on a straight line, so they add up to 180°.", { kind: "lines", pair: "linear", labels: [m[1] + "°", "x°"] });
    if ((m = q.match(new RegExp("Angle (\\d+) and Angle (\\d+) are corresponding angles\\. If Angle \\1 measures (\\d+)" + D + ", what is the measure of Angle \\2\\?$")))) return T("x = " + m[3], "Corresponding angles are equal when the lines are parallel.", { kind: "lines", pair: "corresponding", labels: [m[3] + "°", "x°"] });
    if ((m = q.match(new RegExp("One pair of corresponding angles measures \\((.+?)\\)" + D + " and \\((.+?)\\)" + D + "\\. What must x equal for \\S+ and \\S+ to be parallel, and what is the measure of those angles\\?$")))) return T(m[1] + " = " + m[2], "For the lines to be parallel, corresponding angles have to be equal.", { kind: "lines", pair: "corresponding", labels: ["(" + m[1] + ")°", "(" + m[2] + ")°"] }, [{ label: "Each angle", expr: m[1], unit: "°" }]);
    if ((m = q.match(new RegExp("Two (alternate exterior|alternate interior|corresponding) angles measure \\((.+?)\\)" + D + " and \\((.+?)\\)" + D + "\\. (?:Solve for|Find) x\\.$", "i")))) return T(m[2] + " = " + m[3], m[1][0].toUpperCase() + m[1].slice(1) + " angles are equal when the lines are parallel.", { kind: "lines", pair: m[1].toLowerCase().replace(" ", "-"), labels: ["(" + m[2] + ")°", "(" + m[3] + ")°"] });
    if ((m = q.match(new RegExp("Two same-side \\(consecutive\\) interior angles measure \\((.+?)\\)" + D + " and \\((.+?)\\)" + D + "\\. Find the measure of the (smaller|larger) angle\\.$")))) {
        const ex = [m[1], m[2]], vals = anglesAt(ex, 180);
        if (!vals || vals[0] === vals[1]) return null;
        const pick = vals.indexOf((m[3] === "larger" ? Math.max : Math.min)(...vals));
        return T("(" + ex[0] + ") + (" + ex[1] + ") = 180", "Same-side interior angles add up to 180° when the lines are parallel.", { kind: "lines", pair: "same-side", labels: ["(" + ex[0] + ")°", "(" + ex[1] + ")°"] },
            Object.assign(ex.map((e, i) => ({ label: i ? "Second angle" : "First angle", expr: e, unit: "°", pick: i === pick })), { why: (v) => "Find both angles. The " + m[3] + " one is " + v[pick] + "°." }));
    }
    if ((m = q.match(new RegExp("Angle A and Angle B are alternate interior angles, and Angle C is supplementary to Angle B\\. If Angle A = \\((.+?)\\)" + D + " and Angle C = \\((.+?)\\)" + D + ", find the measure of Angle B\\.$")))) return T("(" + m[1] + ") + (" + m[2] + ") = 180", "Alternate interior angles are equal, so angle B is the same as angle A. Angle C is supplementary to angle B, so A and C add up to 180°.", null, [{ label: "Angle B", expr: m[1], unit: "°" }]);
    return null;
}
/** The angles (as numbers) once x is found from "they add up to total"; null if that does not work out. */
function anglesAt(exprs, total) {
    try {
        const Wt = { kc: 0 }, fs = exprs.map((e) => formOf(parseSide(Wt, tokens(e))));
        const a = fs.reduce((s, f) => s.add(f.a), ZERO), b = fs.reduce((s, f) => s.add(f.b), ZERO);
        if (a.zero) return null;
        const x = new Q(total).sub(b).div(a);
        return fs.map((f) => f.a.mul(x).add(f.b).toNumber());
    } catch (e) { return null; }
}

/* ---------- one problem ---------- */
/** The walkthrough for a problem, or { ok: false, why }. */
export function walkFor(item) {
    const W = { kc: 0, steps: [], kind: "", dec: false };
    MONEY = /§|\$/.test(String(item.a || ""));
    try {
        const out = build(W, item);
        if (!out) return { ok: false, why: "No walkthrough for this kind of problem yet." };
        MONEY = false;
        const errs = verify(W);
        if (errs.length) return { ok: false, why: "Held back: " + errs[0] + ".", errs };
        return { ok: true, id: item.id, q: item.q, a: item.a, steps: W.steps, cols: W.cols || 3 };
    } catch (e) {
        MONEY = false;
        return { ok: false, why: e.message === "key" ? "Held back: the steps do not match the answer key." : "No walkthrough for this kind of problem yet.", err: e.message };
    }
}
function matchKey(res, key, item) {
    if (!key) throw new Error("key");
    const ok = (() => {
        if (key.kind === "none" || key.kind === "all") return res.kind === key.kind;
        if (key.kind === "eq") return res.kind === "eq" && res.val.eq(key.v);
        if (key.kind === "rel") return res.kind === "rel" && res.rel === key.rel && res.val.eq(key.v);
        if (key.kind === "or") return res.kind === "or" && res.lo.eq(key.lo) && res.hi.eq(key.hi) && res.rlo === key.rlo && res.rhi === key.rhi;
        if (key.kind === "and") return res.kind === "and" && res.lo.eq(key.lo) && res.hi.eq(key.hi) && res.rlo === key.rlo && res.rhi === key.rhi;
        if (key.kind === "num") return (res.kind === "eq" && res.val.eq(key.v)) || (res.kind === "num" && res.val.eq(key.v));
        return false;
    })();
    if (!ok) throw new Error("key");
    void item;
}
function build(W, item) {
    const q = String(item.q || ""), setup = item.walk || null;
    let m;
    // a word problem whose setup is stored with it (tools/stdbank → data/stdbank/walk.js)
    if (setup && setup.eq) return solveSetup(W, item, setup.eq, { story: setup.story, why0: setup.why, then: setup.then, var: setup.var, end: setup.end, whole: setup.whole });
    if (setup && setup.quad) return quadSetup(W, item, Object.assign({ why0: setup.why }, setup));
    if (setup && setup.grow) return growSetup(W, item, Object.assign({ why0: setup.why }, setup));
    if (setup && setup.expr) return evalSetup(W, item, setup.expr, { story: setup.story, why0: setup.why });
    if (setup && setup.simp) return simpStory(W, item, Object.assign({ why0: setup.why }, setup));
    if (setup && setup.write) return writeStory(W, item, Object.assign({ why0: setup.why }, setup));
    if (setup && setup.line) return lineSetup(W, item, Object.assign({ why0: setup.why }, setup.line, { story: setup.story }));
    if (setup && setup.prop) return propSetup(W, item, Object.assign({ why0: setup.why }, setup.prop, { story: setup.story }));
    if (setup && setup.rates) return ratesSetup(W, item, Object.assign({ why0: setup.why }, setup.rates, { story: setup.story }));
    if (setup && setup.cmp) return cmpSetup(W, item, Object.assign({ why0: setup.why }, setup.cmp, { story: setup.story }));
    // lines through two points, proportional tables, linear or not
    const P2 = (s) => pairsIn(s).map((p) => p.map(qIn));
    const XY = (xs, ys) => { const a = xs.split(/\s*,\s*/), b = ys.split(/\s*,\s*/); return a.length === b.length ? a.map((x, i) => [x, b[i]]) : null; };
    if ((m = q.match(/^Write the function for the line through (\(.+?\)) and (\(.+?\))\.$/))) return lineSetup(W, item, { pts: P2(m[1] + m[2]), ask: "eq" });
    if ((m = q.match(/^A linear function passes through the points (\(.+?\)) and (\(.+?\))\. Write the equation of the function in y = mx \+ b form\.$/))) return lineSetup(W, item, { pts: P2(m[1] + m[2]), ask: "eq" });
    if ((m = q.match(/^A (?:line goes through|table of a linear function contains the points) (\(.+?\)) and (\(.+?\))\. What is the rate of change\?$/))) return lineSetup(W, item, { pts: P2(m[1] + m[2]), ask: "m" });
    if ((m = q.match(/^A table of a linear function gives (\(.+?\)) and (\(.+?\))\. What is the initial value \(y-intercept\) of this function\?$/))) return lineSetup(W, item, { pts: P2(m[1] + m[2]), ask: "b" });
    if ((m = q.match(/^A table shows x: (.+?) and y: (.+?)\. Write the function\.$/)) && XY(m[1], m[2])) return lineSetup(W, item, { pts: XY(m[1], m[2]), ask: "eq" });
    if ((m = q.match(/^Is this table proportional\? x: (.+?) and y: (.+)$/)) && XY(m[1], m[2])) return propSetup(W, item, { pts: XY(m[1], m[2]), ask: "yes" });
    if ((m = q.match(/^A table shows the \(x, y\) pairs (.+?)\. Does this table represent a proportional relationship\?$/))) return propSetup(W, item, { pts: pairsIn(m[1]), ask: "yes" });
    if ((m = q.match(/^The points (.+?) are on a line through the origin\. What is the constant of proportionality\?$/))) return propSetup(W, item, { pts: pairsIn(m[1]), ask: "k" });
    if ((m = q.match(/^A table shows x: (.+?) and y: (.+?)\. Find the constant of proportionality \(y per x\)\.$/)) && XY(m[1], m[2])) return propSetup(W, item, { pts: XY(m[1], m[2]), ask: "k" });
    if (/^Which set of \(x, y\) pairs represents a proportional relationship\?$/.test(q)) return propSetup(W, item, { ask: "sets" });
    if ((m = q.match(/^Which equation is proportional\? (A\. .+)$/))) return propSetup(W, item, { ask: "eqs", choices: m[1].split(/\s+(?=[A-D]\. )/).map((x) => ({ label: x[0], x: x.slice(3).trim() })) });
    if ((m = q.match(/^Table: x (.+?) and y (.+?)\. Linear or non-linear\?$/)) && XY(m[1], m[2])) return linTableSetup(W, item, XY(m[1], m[2]));
    if ((m = q.match(/^Examine the table: (.+?)\. Is this function linear or non-linear\? Explain\.$/))) return linTableSetup(W, item, m[1].split(/\s*;\s*/).map((s) => (s.match(/x = ([^,]+), y = (.+)/) || []).slice(1)));
    // is it a function?
    const rel = relParse(q);
    if (rel) return relSetup(W, item, rel);
    if (/^Which set of ordered pairs represents a function\?$/.test(q)) return relChoiceSetup(W, item);
    if (/^Which set of three angle measures can form a triangle\?$/.test(q)) return triChoiceSetup(W, item);
    if ((m = q.match(/^A relation contains the points (.+)\. Which value of ([a-z]) would make the relation NOT a function\?$/))) return relUnknownSetup(W, item, pairsIn(m[1]), m[2]);
    if ((m = q.match(/^Given the relation \{(.+)\}, what must the value of ([a-z]) be for this relation to be a function\?$/))) return relSolveSetup(W, item, pairsIn(m[1]), m[2]);
    // angles
    const ang = angleSetup(q);
    if (ang) return solveSetup(W, item, ang.eq, { fact: ang.fact, pic: ang.pic, then: ang.then, thenWhy: ang.then && ang.then.why });
    // functions: plug a number in, or find the input that gives an output
    const fn = funcParse(q);
    if (fn && fn.at != null) return funcSetup(W, item, fn);
    if (fn && fn.out != null) return solveSetup(W, item, fn.rule.replace(new RegExp(fn.v, "g"), fn.solveFor) + " = " + fn.out, { intro: { title: "Write the equation", why: fn.label + " = " + fn.out + " means the output is " + fn.out + ". Set the rule equal to " + fn.out + " and solve for " + fn.solveFor + ".", rows: [{ t: "line", cells: [R([fn.name + "(" + fn.v + ")"]), "=", exprDT(tidyParens(parseExpr(W, fn.rule)))] }] } });
    if ((m = q.match(/^Solve(?: for [a-z])?(?: and [^:]*)?:\s*(.+)$/))) return solveSetup(W, item, m[1], {});
    if ((m = q.match(/^Solve (.+?) and describe the graph of its solution set on a number line\.$/))) return solveSetup(W, item, m[1], {});
    if ((m = q.match(/^How many solutions does (.+) have\?$/))) return solveSetup(W, item, m[1], { count: true });
    if ((m = q.match(/^A complex fraction has (.+?) on top and (.+?) on the bottom\. Simplify it\.$/))) return evalSetup(W, item, { k: "cf", a: parseExpr(W, m[1]), b: parseExpr(W, m[2]), id: key(W) }, { cf: true });
    if ((m = q.match(/^Use the distributive property to find: (\d+) × (\d+)\{(\d+)\/(\d+)\}$/))) return distribNumber(W, item, +m[1], +m[2], +m[3], +m[4]);
    if ((m = q.match(/^Rewrite (.+) as an addition problem\.$/)) || (m = q.match(/^Which addition expression is equivalent to (.+)\?$/))) return addOppSetup(W, item, m[1]);
    if ((m = q.match(/^What is (\S+ ÷ 0)\?$/))) return evalSetup(W, item, m[1], {});
    if ((m = q.match(/^Write ([−-]?)\{(\d+)\/(\d+)\} as a decimal\.( Does it terminate or repeat\?)?$/))) return decSetup(W, item, m[1], +m[2], +m[3], !!m[4]);
    if ((m = q.match(/^What is the decimal form of ([−-]?)\{(\d+)\/(\d+)\}\?$/))) return decSetup(W, item, m[1], +m[2], +m[3], false);
    if ((m = q.match(/^Does ([−-]?)\{(\d+)\/(\d+)\} terminate or repeat as a decimal\?$/))) return decSetup(W, item, m[1], +m[2], +m[3], true);
    // 8.1: rational or irrational, decimals and fractions
    if ((m = q.match(/^Does the decimal for ([−-]?)\{(\d+)\/(\d+)\} terminate or repeat\?$/))) return decSetup(W, item, m[1], +m[2], +m[3], true);
    if ((m = q.match(/^Write the rational number ([−-]?)\{(\d+)\/(\d+)\} as a decimal\.$/))) return decSetup(W, item, m[1], +m[2], +m[3], false);
    if ((m = q.match(/^Is (\S+) rational or irrational\?$/))) return ratOneSetup(W, item, m[1]);
    if ((m = q.match(/^Which number is irrational\? (A\. .+)$/))) return ratChoiceSetup(W, item, m[1].split(/\s+(?=[A-D]\. )/).map((x) => ({ label: x[0], x: x.slice(3).trim() })), (r) => r.c.label);
    if (/^Which of the following numbers is irrational\?$/.test(q)) return ratChoiceSetup(W, item, (item.choices || []).map((c) => ({ x: String(c) })), (r) => r.c.x);
    if ((m = q.match(/^Consider the set of numbers: \{(.+?)\}\. How many of these numbers are rational\?$/))) return ratCountSetup(W, item, m[1].split(/\s*,\s*/));
    if (/^Which fraction produces a repeating decimal expansion\?$/.test(q)) return repChoiceSetup(W, item);
    if ((m = q.match(/^Write (\d*\.\d+(?:…|\.\.\.)) \((\d+ repeating)\) as a fraction(?: in simplest form)?\.$/))) return repFracSetup(W, item, m[1], m[2]);
    if ((m = q.match(/^Express the sum of (\d*\.\d+(?:…|\.\.\.)) and (\d*\.\d+(?:…|\.\.\.))(?: \((where only the \d+ repeats)\))? as a single fraction in simplest form\.$/))) return repSumSetup(W, item, m[1], "", m[2], m[3] || "");
    if ((m = q.match(/^Which fraction is equivalent to the repeating decimal (\d*\.\d+(?:…|\.\.\.))\?$/))) return repFracSetup(W, item, m[1], "");
    if ((m = q.match(/^Convert the repeating decimal (\d*\.\d+(?:…|\.\.\.))(?: \((where only the \d+ repeats)\))? into a fraction in simplest form\.$/))) return repFracSetup(W, item, m[1], m[2] || "");
    // 8.2: square roots and π
    if ((m = q.match(/^√(\d+) is between which two whole numbers\?$/)) || (m = q.match(/^Between which two consecutive whole numbers does √(\d+) lie\?$/))) return sqBetweenSetup(W, item, "", +m[1]);
    if ((m = q.match(/^Between which two consecutive whole numbers is ([−-]?)√(\d+)\?$/))) return sqBetweenSetup(W, item, m[1], +m[2]);
    if ((m = q.match(/^Is √(\d+) closer to (\d+) or (\d+)\?$/)) && +m[3] === +m[2] + 1 && Math.floor(Math.sqrt(+m[1])) === +m[2]) return sqNearestSetup(W, item, +m[1]);
    if ((m = q.match(/^Which whole number is closest to √(\d+)\?$/))) return sqNearestSetup(W, item, +m[1]);
    if ((m = q.match(/^Estimate (?:the value of )?√(\d+) to the nearest tenth\.$/))) return sqTenthSetup(W, item, +m[1], "round");
    if ((m = q.match(/^A square garden has an area of (\d+) square feet\. Between which two tenths of a foot does the side length of the garden fall\?$/))) {
        W.steps.push({ move: "story", title: "The side is √" + m[1], why: "A square's area is side × side. The side times itself is " + m[1] + ", so the side is √" + m[1] + " feet.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "story", text: item.q, marks: [["area of " + m[1] + " square feet", m[1]]] } } }] });
        return sqTenthSetup(W, item, +m[1], "between");
    }
    if ((m = q.match(/^Find an integer n such that ([\d.]+) < √n < ([\d.]+)\.$/))) return sqFindSetup(W, item, m[1], m[2]);
    if ((m = q.match(/^Which is greater: (\S+) or (\S+)\?$/))) return sqGreaterSetup(W, item, m[1], m[2]);
    if ((m = q.match(/^Which symbol makes the statement true\? \((√\d+)\) ___ (\S+)$/))) return sqSymbolSetup(W, item, m[1], m[2]);
    if ((m = q.match(/^Which number is closest to (\S+) on a number line\?$/))) return sqClosestSetup(W, item, m[1]);
    if ((m = q.match(/^Order (?:the following numbers )?from least to greatest: (.+?)\.?$/)) && /√|π/.test(m[1])) return sqOrderSetup(W, item, m[1].split(/\s*,\s*/));
    if (/^Estimate π² to the nearest whole number\.$/.test(q)) return piSqSetup(W, item);
    if ((m = q.match(/^Point P on a number line represents the value \((\d+)π\) \+ (\d+)\. Which statement best describes the location of Point P\?$/))) return piLineSetup(W, item, +m[1], +m[2]);
    if ((m = q.match(/^Convert ([−-]?)\{(\d+)\/(\d+)\} to a decimal using long division and classify it\.$/))) return decSetup(W, item, m[1], +m[2], +m[3], true);
    if (/[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(String(item.a))) return null;   // exponent rules: the answer is a power, not a number
    // expressions with a variable: distribute and combine like terms, or factor out the GCF
    if ((m = q.match(/^(?:Simplify|Expand|Expand the expression|Expand and simplify|Combine like terms to simplify|Subtract the linear expressions):\s*(.+)$/)) && /[a-z]/i.test(m[1].replace(/\{[^}]*\}/g, ""))) return simpSetup(W, item, m[1]);
    if ((m = q.match(/^Factor(?: the expression using the greatest common factor)?:\s*(.+)$/))) return factorSetup(W, item, m[1]);
    if ((m = q.match(/^Factor (\S+) out of the expression (.+)\.$/))) return factorOutSetup(W, item, m[1], m[2]);
    if ((m = q.match(/^Which expression is NOT equivalent to (.+)\?$/)) && item.choices) return choiceSimpSetup(W, item, m[1], item.choices.map((x) => ({ x: String(x) })), "not");
    if ((m = q.match(/^Which is the same as (.+?)\?\s+(A\. .+)$/))) return choiceSimpSetup(W, item, m[1], m[2].split(/\s+(?=[A-D]\. )/).map((x) => ({ label: x[0], x: x.slice(3).trim() })), "same");
    if ((m = q.match(/^(?:Find|Simplify|Evaluate):\s*(.+)$/))) return evalSetup(W, item, m[1], {});
    return null;
}
function solveSetup(W, item, eqText, o) {
    W.kind = "solve";
    const line = parseLine(W, eqText);
    if (!line) return null;
    W.dec = /\d\.\d/.test(eqText);
    W.cols = line.s.length === 3 ? 5 : 3;
    const v = varOf(line);
    let started = false;
    if (o.intro) {
        W.steps.push({ move: "setup", title: o.intro.title, why: o.intro.why, seq: [...(o.intro.rows || []).map((row) => ({ a: "row", row })), { a: "row", row: lineRow(W, line) }] });
        started = true;
    }
    if (o.story || o.fact) {
        const seq = [];
        if (o.story) seq.push({ a: "row", row: { t: "pic", pic: { kind: "story", text: item.q, marks: o.story } } });
        if (o.pic) seq.push({ a: "row", row: { t: "pic", pic: Object.assign({ solved: null }, o.pic) } });
        if (!o.story && !o.pic) seq.push({ a: "row", row: { t: "pic", pic: { kind: "fact", text: o.fact } } });
        W.steps.push({ move: o.story ? "story" : "fact", title: o.story ? "Read the story" : "Use the angle fact", why: o.story ? (o.why0 || "Find the numbers in the story and what each one means.") : o.fact, seq });
        const norm = (t) => String(t).replace(/[\s()]/g, "").replace(/[\u2212-]/g, "-");
        const terms = line.s.flatMap((sd) => sd.flatMap((t) => (t.g ? [t, ...t.g] : [t])));
        const pairs = (o.story || []).map((mk, i) => { const t = terms.find((x) => norm(termText(x, true)) === norm(mk[1]) || norm(termText(x, true)).replace(/^-/, "") === norm(mk[1]).replace(/^-/, "")); return t ? ["s" + i, t.k] : null; }).filter(Boolean);
        const noun = line.r.every((r) => r === "=") ? "equation" : "inequality";
        W.steps.push({ move: "setup", title: "Write the " + noun, why: o.story ? "Each number from the story goes into the " + noun + "." + (v ? " " + v + " is " + (o.var || "the unknown") + "." : "") : o.fact + " Write that as an equation.", seq: [{ a: "row", row: lineRow(W, line, line.abs ? { sem: null } : null) }, ...(pairs.length ? [{ a: "fly", pairs, story: true }] : [])] });
        started = true;
    }
    const key = readKey(item.a);
    const res = solve(W, line, { started });
    if (!W.first) W.first = semOf(line);
    // replace the verifier's first line with the line we really started from
    W.steps.forEach((st) => st.seq.forEach((x) => { if (x.a === "row" && x.row.sem && x.row.sem.s && x.row.c === "w-check") x.row.sem.then = true; }));
    if (res.kind === "eq" || res.kind === "rel" || res.kind === "and") checkStep(W, eqText, res, line);
    else if (res.kind === "or") orCheck(W, res);
    if (o.then && res.kind === "eq") {
        const vals = o.then.map((t) => {
            const e = parseExpr(W, t.expr, { [res.v]: res.val }), val = valueOf(e);
            return { t, e, val };
        });
        const best = vals.find((x) => x.t.pick) || (o.then.length === 1 ? vals[0] : null);
        const low1 = (l) => l[0].toLowerCase() + l.slice(1);
        W.steps.push({ move: "then", title: "Answer the question", why: res.v + " = " + numText(res.val) + " is not the end. " + (o.thenWhy ? o.thenWhy(vals.map((x) => numText(x.val))) : "The question asks for " + o.then.map((t) => low1(t.label)).join(" and ") + "."),
            seq: vals.map(({ t, e, val }) => ({ a: "row", row: { t: "line", cells: [R([t.label, " = ", exprDT(tidyParens(e)), " = ", numDT(val), t.unit || ""]), null, null], sem: { truth: true } } })) });   // one piece, written from the left, so a long line above never pushes it off the board
        const kb = readKey(item.a);
        if (best && kb && kb.kind === "eq" && kb.rest) {
            if (!res.val.eq(kb.v) || !new RegExp("(^|[^\\d.])" + numText(best.val).replace(".", "\\.") + "([^\\d.]|$)").test(kb.rest)) throw new Error("key");
        } else if (best) matchKey({ kind: "num", val: best.val }, kb, item);
        else if (!/=/.test(item.a)) throw new Error("key");
        else { const got = item.a.split(",").map((p) => qOf(p.split("=")[1].replace(/[°\s]/g, ""))); if (got.length !== vals.length || got.some((g, i) => !g || !g.eq(vals[i].val))) throw new Error("key"); }
    } else if (o.count) {
        if (!(key && ((key.kind === "eq" && res.kind === "eq" && res.val.eq(key.v)) || key.kind === res.kind))) throw new Error("key");
    } else if (o.whole && res.kind === "rel" && (res.rel === "≤" || res.rel === "<")) {
        // "at most how many": the answer is the largest whole number that works
        const fl = new Q(Math.floor(res.val.toNumber())), w = res.rel === "<" && res.val.int ? res.val.sub(ONE) : fl;
        const st = W.dec && terminates(res.val) ? "dec" : "mixed", vT = numText(res.val, st);
        if (!res.val.int && st === "mixed") {
            // 203/13 on its own means little: say it as a mixed number, on the graph too
            const fT = numText(res.val, "frac");
            W.steps.forEach((s) => { if (s.move === "check" || s.move === "graph") s.why = s.why.split(fT).join(vT); s.seq.forEach((x) => { if (x.a === "row" && x.row.t === "pic" && x.row.pic.kind === "ineq" && x.row.pic.atT === fT) x.row.pic.atT = vT; }); });
        }
        W.steps.push({ move: "then", title: "Answer the question", why: (!res.val.int && st === "mixed" ? numText(res.val, "frac") + " = " + vT + ". " : "") + res.v + " has to be a whole number of " + o.whole + ". The largest whole number with " + res.v + " " + res.rel + " " + vT + " is " + w.n + ".",
            seq: [{ a: "row", row: { t: "line", cells: [R(["Most " + o.whole + " = " + w.n]), null, null], chain: true, sem: { truth: relTrue(w, res.rel, res.val) && !relTrue(w.add(ONE), res.rel, res.val) } } }] });
        const a = String(item.a).replace(/(\d),(\d{3})/g, "$1$2"), head = a.split(";")[0];
        if (!new RegExp("(^|[^\\d.])" + w.n + "([^\\d.]|$)").test(a.split(";").pop())) throw new Error("key");
        if (/[<>≤≥]/.test(head) && head.replace(/\s/g, "") !== eqText.replace(/\s/g, "").replace(/(\d),(\d{3})/g, "$1$2")) throw new Error("key");
    } else matchKey(res, key, item);
    if (o.pic && o.pic.kind === "triangle" && res.kind === "eq") {
        // the picture shows the real angles once x is known
        const vals = (o.pic.exprs || o.pic.labels.map((l) => l.replace(/[°()]/g, ""))).map((ex) => valueOf(parseExpr(W, ex.replace(/°/g, ""), { [res.v]: res.val })).toNumber());
        W.steps.forEach((st) => st.seq.forEach((x) => { if (x.a === "row" && x.row.t === "pic" && x.row.pic.kind === "triangle") x.row.pic.solved = vals; }));
    }
    if (o.pic && (o.pic.kind === "wedges") && res.kind === "eq") {
        const vals = (o.pic.exprs || o.pic.labels.map((l) => l.replace(/[°()]/g, "").replace(/^[AB] = /, ""))).map((ex) => valueOf(parseExpr(W, ex.replace(/°/g, ""), { [res.v]: res.val })).toNumber());
        W.steps.forEach((st) => st.seq.forEach((x) => { if (x.a === "row" && x.row.t === "pic" && x.row.pic.kind === "wedges") x.row.pic.solved = vals; }));
    }
    answerStep(W, item.a, o.end ? o.end : o.count ? (res.kind === "eq" ? "One number works, so there is exactly one solution." : "") : res.kind === "none" ? "No number makes it true." : res.kind === "all" ? "Every number makes it true." : "");
    return true;
}
function evalSetup(W, item, exprText0, o) {
    W.kind = "eval";
    const root = typeof exprText0 === "string" ? parseExpr(W, exprText0) : exprText0;
    if (!root) return null;
    if (o.story) W.steps.push({ move: "story", title: "Read the story", why: o.why0 || "Find the numbers in the story and what each one means.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "story", text: item.q, marks: o.story } } }] });
    let key = readKey(item.a);
    if (typeof exprText0 === "string") {
        // "|−35.5 − 14.2| = 49.7 meters": the key repeats the expression, then gives the value
        const nm = (t) => String(t).replace(/[\s()]/g, "").replace(/[\u2212-]/g, "-").replace(/[×·*]/g, "x");
        const km = String(item.a).match(/^(.+?) = (\S+)(.*)$/);
        if (km && nm(km[1]) === nm(exprText0)) key = readKey(km[2] + km[3]);
    }
    if (key && key.kind === "undef") {
        if (!(root.k === "op" && root.op === "/" && isNum(root.b) && numOf(root.b).q.zero)) throw new Error("key");
        W.steps.push({ move: "start", title: "The problem", why: "Division asks: how many groups of 0 make " + exprText(root.a) + "? No number of zeros ever adds up to it.", seq: [{ a: "row", row: { t: "line", cells: [exprDT(root), null, null] } }] });
        answerStep(W, item.a, "You cannot divide by zero, so the answer is undefined.");
        return true;
    }
    let out = evaluate(W, root, { why0: o.cf ? "The fraction bar in a complex fraction means divide." : undefined, story: o.story });
    const v = valueOf(out);
    // "30%": the math gives 0.3, then it is written as a percent
    const pct = key && key.kind === "num" && /^%/.test(key.unit) && !v.eq(key.v) && v.mul(new Q(100)).eq(key.v) && terminates(v);
    if (!key || key.kind !== "num" || !(v.eq(key.v) || pct)) throw new Error("key");
    const n = numOf(out);
    if (pct) {
        let at = n;
        if (n.s !== "dec" && !v.int) {
            at = { k: "n", q: v, s: "dec", id: key2(W) };
            W.steps.push({ move: "decimal", title: "Write it as a decimal", why: numText(v, "frac") + " = " + numText(v, "dec") + ".", seq: [{ a: "row", row: evalRow(W, at) }, { a: "fly", pairs: [[n.id, at.id]] }] });
        }
        const p100 = v.mul(new Q(100)), kp = key2(W);
        W.steps.push({ move: "percent", title: "Write it as a percent", why: "Percent means out of 100, so multiply by 100: " + numText(v, "dec") + " × 100 = " + numText(p100, "dec") + ". Move the decimal point 2 places right.", seq: [{ a: "row", row: { t: "line", cells: [null, "=", R([numText(p100, "dec") + "%"], { k: kp })] } }, { a: "fly", pairs: [[at.id, kp]] }] });
        answerStep(W, item.a);
        return true;
    }
    if (key.mixed && !v.int && v.abs().cmp(ONE) > 0 && n.s !== "mixed") {
        const by = { k: "n", q: v, s: "mixed", id: key2(W) };
        W.steps.push({ move: "mixed", title: "Write it as a mixed number", why: numText(v.abs(), "frac") + " = " + numText(v.abs(), "mixed") + ": " + v.abs().n + " ÷ " + v.d + " = " + Math.floor(v.abs().n / v.d) + " remainder " + (v.abs().n % v.d) + ".", seq: [{ a: "row", row: evalRow(W, by) }, { a: "fly", pairs: [[n.id, by.id]] }] });
    } else if (key.dec && !v.int && n.s !== "dec" && terminates(v)) {
        const by = { k: "n", q: v, s: "dec", id: key2(W) };
        W.steps.push({ move: "decimal", title: "Write it as a decimal", why: numText(v, "frac") + " = " + numText(v, "dec") + ".", seq: [{ a: "row", row: evalRow(W, by) }, { a: "fly", pairs: [[n.id, by.id]] }] });
    }
    answerStep(W, item.a);
    return true;
}
const key2 = (W) => key(W);
function distribNumber(W, item, k, w, n, d) {
    W.kind = "eval";
    const kk = key(W), kw = key(W), kf = key(W), kp1 = key(W), kp2 = key(W);
    const fr = new Q(n, d), v = new Q(k).mul(new Q(w).add(fr));
    W.steps.push({ move: "start", title: "The problem", why: "A mixed number is a whole number plus a fraction. Split it, then multiply each part.", seq: [{ a: "row", row: { t: "line", cells: [R([String(k), " × ", R([String(w), F(String(n), String(d))])]), null, null], sem: { v } } }] });
    W.steps.push({ move: "split", title: "Split the mixed number", why: w + " " + n + "/" + d + " means " + w + " + " + n + "/" + d + ".", seq: [{ a: "row", row: { t: "line", cells: [null, "=", R([R([String(k)], { k: kk }), "(", R([String(w)], { k: kw }), " + ", R([F(String(n), String(d))], { k: kf }), ")"])], sem: { v } } }] });
    W.steps.push({ move: "distribute", title: "Distribute", why: "Multiply " + k + " by each part: " + k + " × " + w + " = " + k * w + " and " + k + " × " + n + "/" + d + " = " + numText(new Q(k).mul(fr), "frac") + ".", seq: [{ a: "arrow", from: kk, to: [kw, kf] }, { a: "row", row: { t: "line", cells: [null, "=", R([R([String(k * w)], { k: kp1 }), " + ", R([numDT(new Q(k).mul(fr), "frac")], { k: kp2 })])], sem: { v } } }, { a: "fly", pairs: [[kw, kp1], [kf, kp2]] }] });
    W.steps.push({ move: "add", title: "Add", why: k * w + " + " + numText(new Q(k).mul(fr), "frac") + " = " + numText(v, "mixed") + ".", seq: [{ a: "row", row: { t: "line", cells: [null, "=", R([numDT(v, "mixed")], { k: key(W) })], sem: { v } } }] });
    const key0 = readKey(item.a); if (!key0 || !key0.v || !key0.v.eq(v)) throw new Error("key");
    answerStep(W, item.a);
    return true;
}

/* ---------- functions: f(x) = rule ---------- */
/** { name, v, rule, label, at } to evaluate, or { …, out, solveFor } to find the input. null when it is not one of these. */
function funcParse(q) {
    let m;
    const F = (name, v, rule, o) => Object.assign({ name, v, rule: rule.trim(), label: name === "y" ? "y" : name + "(" + v + ")" }, o);
    if ((m = q.match(/^([A-Z])\(([a-z])\) = (.+?) is the [^.]+\. Find \1\(([^)]+)\)\.$/))) return F(m[1], m[2], m[3], { at: m[4] });
    if ((m = q.match(/^([a-zA-Z])\(([a-z])\) = (.+?)\. Find \1\(([^)]+)\)\.$/))) return F(m[1], m[2], m[3], { at: m[4] });
    if ((m = q.match(/^Given the function ([a-zA-Z])\(([a-z])\) = (.+?), find \1\(([^)]+)\)\.$/))) return F(m[1], m[2], m[3], { at: m[4] });
    if ((m = q.match(/^For the function ([a-zA-Z])\(([a-z])\) = (.+?), what is the value of \1\(([^)]+)\)\?$/))) return F(m[1], m[2], m[3], { at: m[4] });
    if ((m = q.match(/^Evaluate ([a-zA-Z])\(([a-z])\) = (.+?) for \2 = (\S+)\.$/))) return F(m[1], m[2], m[3], { at: m[4] });
    if ((m = q.match(/^The function ([A-Z])\(([a-z])\) = (.+?) represents [^.]+\. Find \1\(([^)]+)\) and state what it means\.$/))) return F(m[1], m[2], m[3], { at: m[4], means: true });
    if ((m = q.match(/^y = (.+?)\. Find y when x = (\S+)\.$/))) return F("y", "x", m[1], { at: m[2] });
    if ((m = q.match(/^Evaluate the function y = (.+?) when x = (\S+)\.$/))) return F("y", "x", m[1], { at: m[2] });
    if ((m = q.match(/^A function rule is: '(Multiply the input by (\d+), then (add|subtract) (\d+))\.' What is the output when the input is (\S+)\?$/))) return F("y", "x", m[2] + "x " + (m[3] === "add" ? "+" : "−") + " " + m[4], { at: m[5], words: m[1] });
    if ((m = q.match(/^([a-zA-Z])\(([a-z])\) = (.+?)\. Find \2 when \1\(\2\) = (\S+)\.$/))) return F(m[1], m[2], m[3], { out: m[4], solveFor: m[2] });
    if ((m = q.match(/^If ([a-zA-Z])\(([a-z])\) = (.+?) and \1\(([a-z])\) = (\S+), what is the value of \4\?$/))) return Object.assign(F(m[1], m[2], m[3], { out: m[5], solveFor: m[4] }), { label: m[1] + "(" + m[4] + ")" });
    return null;
}
function funcSetup(W, item, fn) {
    W.kind = "eval";
    const at = qOf(fn.at); if (!at) return null;
    const rule = parseExpr(W, fn.rule);
    if (!rule) return null;
    const atT = numText(at), labelAt = fn.name === "y" ? "y" : fn.name + "(" + atT + ")";
    W.steps.push({ move: "start", title: "The problem", why: fn.words ? "Call the input x. \u201c" + fn.words + "\u201d is " + exprText(tidyParens(rule)) + ". Here the input is " + atT + "." : fn.name === "y" ? "The rule tells you how to get y from x. Here x is " + atT + "." : fn.label + " is the rule. " + labelAt + " means: put " + atT + " in for " + fn.v + ".",
        seq: [{ a: "row", row: { t: "line", cells: [R([fn.label]), "=", exprDT(tidyParens(rule))] } }] });
    const sub = tidyParens(parseExpr(W, fn.rule, { [fn.v]: at }));
    const vs = [], ns = [];
    (function w(n) { if (!n) return; if (n.k === "v") vs.push(n.id); w(n.a); w(n.b); })(rule);
    (function w(n) { if (!n) return; if (n.k === "n" && n.sub) ns.push(n.id); w(n.a); w(n.b); })(sub);
    if (!vs.length || vs.length !== ns.length) return null;
    W.steps.push({ move: "sub", title: "Plug in " + atT, why: "Write " + atT + " everywhere " + fn.v + " was. Keep it in parentheses so the signs stay right.",
        seq: [{ a: "row", row: { t: "line", cells: [R([labelAt]), "=", exprDT(sub)], sem: { v: valueOf(sub) } } }, { a: "fly", pairs: vs.map((v, i) => [v, ns[i]]) }] });
    const out = evaluate(W, sub, { noStart: true });
    const v = valueOf(out), key0 = readKey(item.a);
    if (!key0 || key0.kind !== "num" || !v.eq(key0.v)) throw new Error("key");
    answerStep(W, item.a, (fn.words ? "So the output is " : "So " + labelAt + " = ") + "" + numText(v, key0.dec || key0.money ? "dec" : "frac") + "." + (fn.means ? " Put it back in the story to say what it means." : ""));
    return true;
}

/* ---------- expressions with a variable: simplify, expand, factor ---------- */
function oneSide(W, text) {
    const toks = tokens(text);
    if (!toks || toks.some((t) => t.t === "rel" || t.t === "|")) return null;
    const side = parseSide(W, toks), names = new Set();
    side.forEach((t) => { if (t.v) names.add(t.v); if (t.g) t.g.forEach((x) => { if (x.v) names.add(x.v); if (x.g) names.add("?"); }); });
    return names.size === 1 && !names.has("?") ? side : null;
}
/** Rows of an expression chain: the first one on the left, the rest as "= …" under it. */
function chainRows(W, from) {
    W.steps.slice(from).forEach((st) => st.seq.forEach((x) => {
        if (x.a !== "row" || x.row.t !== "line" || x.row.cells.length !== 1) return;
        x.row.cells = [null, "=", x.row.cells[0]];
        if (x.row.sem && x.row.sem.s) x.row.sem = { f: x.row.sem.s[0] };
    }));
}
function simpSetup(W, item, text) {
    W.kind = "simp";
    const side = oneSide(W, text); if (!side) return null;
    const v = varOf({ s: [side] }), hasG = side.some((t) => t.g);
    let line = { s: [side], r: [] };
    if (!hasG && !needsCombine(side)) return null;
    W.steps.push({ move: "start", title: "The problem", why: hasG ? "First get rid of the parentheses, then combine like terms." : "Like terms have the same variable part. Put the " + v + " terms together and the plain numbers together.",
        seq: [{ a: "row", row: { t: "line", cells: [sideDT(side), null, null], sem: { f: formOf(side) } } }] });
    if (hasG) line = stepDistribute(W, line);
    if (needsCombine(line.s[0])) line = stepCombine(W, line);
    chainRows(W, 1);
    const k = oneSide(W, item.a); if (!k) throw new Error("key");
    const fk = formOf(k), fl = formOf(line.s[0]);
    if (k.some((t) => t.g) || needsCombine(k) || !fk.a.eq(fl.a) || !fk.b.eq(fl.b) || varOf({ s: [k] }) !== v) throw new Error("key");
    answerStep(W, item.a, "No parentheses and one term of each kind: that's as simple as it gets.");
    return true;
}
function factorList(n) { const out = []; for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i); return out; }
function factorSetup(W, item, text) {
    W.kind = "simp";
    const side = oneSide(W, text); if (!side) return null;
    if (side.length !== 2 || side.some((t) => t.g || t.over || t.dec || !t.c.int) || !side.some((t) => t.v) || !side.some((t) => !t.v)) return null;
    const g = gcd(side[0].c.n, side[1].c.n); if (g < 2) return null;
    const G = new Q(g), v = varOf({ s: [side] }), f0 = formOf(side);
    const inner = side.map((t) => ({ c: t.c.div(G), v: t.v, g: null, over: false, dec: false, k: key(W) }));
    const grp = { c: G, v: null, g: inner, over: false, dec: false, k: key(W) };
    W.steps.push({ move: "start", title: "The problem", why: "Factoring means writing it as a product: one number times parentheses. Start with the greatest common factor (GCF) of " + side.map((t) => Math.abs(t.c.n)).join(" and ") + ".",
        seq: [{ a: "row", row: { t: "line", cells: [sideDT(side), null, null], sem: { f: f0 } } }] });
    // 6x + 18 = 6 · x + 6 · 3
    const gk = side.map(() => key(W)), items = [];
    side.forEach((t, i) => {
        const inT = Object.assign({}, inner[i], { c: inner[i].c.abs() });
        if (i) items.push(t.c.sign < 0 ? " " + MINUS + " " : " + ");
        items.push(R([i === 0 && t.c.sign < 0 ? MINUS : "", R([String(g)], { k: gk[i] }), " · ", termDT(inT, true)], { k: key(W) }));
    });
    const ns = side.map((t) => Math.abs(t.c.n));
    const why1 = ns.every((n) => n <= 60) ? ns.map((n) => "Factors of " + n + ": " + factorList(n).join(", ") + ".").join(" ") + " The greatest one they share is " + g + "." : "The greatest number that divides both " + ns.join(" and ") + " is " + g + ".";
    W.steps.push({ move: "gcf", title: "Find the GCF: " + g, why: why1 + " Write each term as " + g + " times something.",
        seq: [{ a: "row", row: { t: "line", cells: [null, "=", R(items)], sem: { f: f0 } } }, { a: "hl", ks: gk, tone: "n" }] });
    W.steps.push({ move: "factor", title: "Pull out the " + g, why: "Write the " + g + " once, in front. What is left of each term goes in the parentheses: " + side.map((t, i) => termText(Object.assign({}, t, { c: t.c.abs() }), true) + " ÷ " + g + " = " + termText(Object.assign({}, inner[i], { c: inner[i].c.abs() }), true)).join(" and ") + ".",
        seq: [{ a: "row", row: { t: "line", cells: [null, "=", termDT(grp, true)], sem: { f: formOf([grp]) } } }, { a: "fly", pairs: [[gk[0], grp.k + "c"], [gk[1], grp.k + "c"]], merge: true }] });
    const back = inner.map((t) => ({ c: t.c.mul(G), v: t.v, g: null, over: false, dec: false, k: key(W) }));
    W.steps.push({ move: "check", title: "Check", why: "Distribute the " + g + " back: " + inner.map((t) => g + " × " + (t.c.sign < 0 && !t.v ? "(" + termText(t, true) + ")" : termText(t, true)) + " = " + termText(back[inner.indexOf(t)], true)).join(" and ") + ". You get the problem back ✓.",
        seq: [{ a: "row", row: { t: "line", cells: [termDT(Object.assign({}, grp, { k: key(W) }), true), "=", R([sideDT(back), " ✓"])], sem: { truth: formOf(back).a.eq(f0.a) && formOf(back).b.eq(f0.b) }, c: "w-check" } }] });
    const k = oneSide(W, item.a);
    if (!k || k.length !== 1 || !k[0].g || !k[0].c.eq(G)) throw new Error("key");
    const fk = formOf(k[0].g), fi = formOf(inner);
    if (!fk.a.eq(fi.a) || !fk.b.eq(fi.b) || varOf({ s: [k] }) !== v) throw new Error("key");
    answerStep(W, item.a, "The number in front is the GCF, so nothing else can come out.");
    return true;
}

/* ---------- subtraction as adding the opposite ---------- */
function addOppSetup(W, item, text) {
    W.kind = "eval";
    const root = tidyParens(parseExpr(W, text));
    if (!root || root.k !== "op" || root.op !== "-" || !isNum(root.a) || !isNum(root.b)) return null;
    W.steps.push({ move: "start", title: "The problem", why: "Subtracting a number is the same as adding its opposite.", seq: [{ a: "row", row: evalRow(W, root, true) }] });
    const r2 = reduce(W, root, root, true);
    if (!r2 || r2 === root || r2.k !== "op" || r2.op !== "+") return null;
    const nm = (t) => String(t).replace(/[\s()]/g, "").replace(/[−-]/g, "-");
    if (nm(exprText(r2)) !== nm(item.a)) throw new Error("key");
    answerStep(W, item.a, "Same value, now written as an addition problem.");
    return true;
}

/* ---------- fractions to decimals by long division ---------- */
/** The digits of n/d after the point (n < d), and where they start to repeat (-1 when they stop). */
function longDiv(n, d) {
    const digits = [], rows = [], seen = new Map();
    let r = n;
    while (r !== 0 && !seen.has(r) && digits.length < 12) {
        seen.set(r, digits.length);
        const big = r * 10, dg = Math.floor(big / d), rem = big - dg * d;
        rows.push({ big, dg, rem }); digits.push(dg); r = rem;
    }
    return { digits, rows, from: r === 0 ? -1 : seen.has(r) ? seen.get(r) : -2, back: r };
}
function decKey(a) {
    let s = String(a).trim(), kind = null, m;
    if ((m = s.match(/^(Terminates|Repeats)\b\s*(?:\((.*)\))?$/i))) { kind = /^t/i.test(m[1]) ? "t" : "r"; s = (m[2] || "").trim(); if (!s) return { kind }; }
    m = s.match(/^([−-]?\d*\.\d+)(…|\.\.\.)?\s*(?:\((.*)\))?$/);
    if (!m) return null;
    const note = m[3] || "", bm = note.match(/(?:repeating|with only|with) (\d+)(?: repeating)?/);
    return { kind: kind || (m[2] || /repeat/i.test(note) ? "r" : "t"), digits: m[1].replace(/−/g, "-"), dots: !!m[2], block: bm ? bm[1] : null };
}
function decSetup(W, item, sgn, n, d, classify) {
    W.kind = "dec"; W.cols = 3;
    if (!(n > 0 && n < d && d <= 99)) return null;
    const L = longDiv(n, d);
    if (L.from === -2) return null;
    const neg = !!sgn, sg = neg ? MINUS : "";
    const rep = L.from >= 0, fixed = L.digits.slice(0, rep ? L.from : L.digits.length).join(""), block = rep ? L.digits.slice(L.from).join("") : "";
    const shown = rep ? "0." + fixed + block + (block.length === 1 ? block + block : block.length === 2 ? block : "") + "…" : "0." + fixed;
    // check the key before writing anything
    const k = decKey(item.a); if (!k) throw new Error("key");
    if ((k.kind === "r") !== rep) throw new Error("key");
    if (k.digits) {
        const want = (neg ? "-" : "") + "0." + (rep ? fixed + block.repeat(12) : fixed);
        const got = k.digits.replace(/^(-?)\./, "$10.");
        if (rep ? !want.startsWith(got) : qOf(k.digits) == null || !qOf(k.digits).eq(new Q(neg ? -n : n, d))) throw new Error("key");
    }
    if (k.block && k.block !== block) throw new Error("key");
    W.steps.push({ move: "start", title: "The fraction bar means divide", why: (neg ? "Work out " + n + " ÷ " + d + ", then put the minus sign back. " : "") + n + "/" + d + " means " + n + " ÷ " + d + ". " + d + " doesn't go into " + n + ", so start with 0 and a decimal point, then bring down a 0.",
        seq: [{ a: "row", row: { t: "line", cells: [R([sg, F(String(n), String(d))]), "=", R([sg + n + " ÷ " + d])] } }] });
    const remK = [];
    L.rows.forEach((x, i) => {
        const kd = key(W), kr = key(W); remK.push(kr);
        const sofar = "0." + L.digits.slice(0, i + 1).join("");
        const last = i === L.rows.length - 1;
        let why = "How many " + d + "s fit in " + x.big + "? " + x.dg + ", because " + d + " × " + x.dg + " = " + d * x.dg + ". " + x.big + " − " + d * x.dg + " = " + x.rem + " left over.";
        const seq = [{ a: "row", row: { t: "line", cells: [R([x.big + " ÷ " + d + " = ", R([String(x.dg)], { k: kd }), " R", R([String(x.rem)], { k: kr })]), "→", R([sg + sofar])] } }, { a: "hl", ks: [kd], tone: "n" }];
        if (last && !rep) why += " Nothing is left, so the division stops.";
        if (last && rep) {
            const firstAt = L.from === 0 ? null : remK[L.from - 1];
            why += " " + x.rem + " is left over again" + (L.from === 0 ? ", the same " + x.rem + " you started with" : "") + ", so the same division comes next, again and again: " + block + " repeats forever.";
            seq.push({ a: "hl", ks: firstAt ? [firstAt, kr] : [kr], tone: "x" });
        }
        W.steps.push({ move: "longdiv", title: "Bring down a 0: " + x.big + " ÷ " + d, why, seq });
    });
    W.steps.push({ move: rep ? "repeat" : "stop", title: rep ? "It repeats" : "It terminates", why: rep ? (block.length === 1 ? "The " + block + " repeats" : "The digits " + block + " repeat") + " forever, so " + sg + n + "/" + d + " is a repeating decimal. Write the dots to show it keeps going." : "The remainder is 0, so the decimal stops. " + sg + n + "/" + d + " is a terminating decimal.",
        seq: [{ a: "row", row: { t: "line", cells: [R([sg, F(String(n), String(d))]), "=", R([sg + shown])], c: "w-check" } }] });
    answerStep(W, item.a, classify ? (rep ? "It repeats." : "It terminates.") : "");
    void k;
    return true;
}

/* ---------- 8.1 and 8.2: rational or irrational, repeating decimals to fractions, square roots ---------- */
const isq = (n) => { const r = Math.round(Math.sqrt(n)); return r * r === n ? r : null; };
const dtx = (q) => numText(q, q.int ? undefined : "dec");
const chainRow = (parts, truth, o) => Object.assign({ t: "line", cells: [R([parts.join(" ")]), null, null], sem: { truth: !!truth }, chain: true }, o || {});
const noteRow = (left, right, o) => Object.assign({ t: "line", cells: [R([left]), "→", R([right])] }, o || {});
/** "5² = 25 < 30 < 36 = 6²": the perfect squares on each side of n (n > 0, not a perfect square). */
function bracketRow(n) {
    const a = Math.floor(Math.sqrt(n));
    return { a, row: chainRow([a + "²", "=", String(a * a), "<", String(n), "<", String((a + 1) * (a + 1)), "=", (a + 1) + "²"], a * a < n && n < (a + 1) * (a + 1)) };
}
/** One number, read for "rational or irrational". */
function realRead(text0) {
    const t = String(text0).trim().replace(/\.\.\.$/, "…");
    let m;
    if (t === "π") return { rat: false, title: "π", why: "π = 3.14159… Its digits go on forever and never fall into a repeating pattern, so π is irrational. (3.14 and 22/7 are only close to π.)", rows: [noteRow("π = 3.14159…", "never repeats")] };
    if ((m = t.match(/^([−-]?)√(\d+)$/))) {
        const n = +m[2], r = isq(n), sg = m[1] ? MINUS : "";
        if (r != null) return { rat: true, title: "Is " + n + " a perfect square?", why: n + " is a perfect square: " + r + " × " + r + " = " + n + ". So " + sg + "√" + n + " = " + sg + r + ", an integer. Integers are rational.", rows: [chainRow([sg + "√" + n, "=", sg + r], true)] };
        const b = bracketRow(n);
        return { rat: false, title: "Is " + n + " a perfect square?", why: n + " is not a perfect square. It falls between " + b.a + "² = " + b.a * b.a + " and " + (b.a + 1) + "² = " + (b.a + 1) * (b.a + 1) + ". The square root of a whole number that isn't a perfect square is irrational: its decimal never ends and never repeats.", rows: [b.row] };
    }
    if ((m = t.match(/^([−-]?\d*\.\d+)…$/))) return { rat: true, title: t, why: t + " repeats, and every repeating decimal can be written as a fraction, so it is rational.", rows: [noteRow(t, "repeats")] };
    if ((m = t.match(/^([−-]?)\{(\d+)\/(\d+)\}$/))) { const sg = m[1] ? MINUS : ""; return { rat: true, title: sg + m[2] + "/" + m[3], why: sg + m[2] + "/" + m[3] + " is already a fraction of two integers, so it is rational.", rows: [] }; }
    if ((m = t.match(/^([−-]?)(\d+)\.(\d+)$/))) {
        const sg = m[1] ? MINUS : "", top = String(+(m[2] + m[3])), bot = String(10 ** m[3].length);
        return { rat: true, title: t, why: t + " stops, so it is a fraction over " + bot + ": " + t + " = " + sg + top + "/" + bot + ". A fraction of two integers is rational.", rows: [{ t: "line", cells: [R([t.replace(/^-/, MINUS)]), "=", R([sg, F(top, bot)])], sem: { truth: qOf(t).eq(new Q((sg ? -1 : 1) * +top, +bot)) }, chain: true }] };
    }
    if ((m = t.match(/^([−-]?)(\d+)$/))) { const sg = m[1] ? MINUS : ""; return { rat: true, title: sg + m[2], why: sg + m[2] + " is an integer. It can be written " + sg + m[2] + "/1, so it is rational.", rows: [{ t: "line", cells: [R([sg + m[2]]), "=", R([sg, F(m[2], "1")])], sem: { truth: true }, chain: true }] }; }
    return null;
}
const dispX = (t) => { const m = String(t).match(/^([−-]?)\{(\d+)\/(\d+)\}$/); return m ? R([m[1] ? MINUS : "", F(m[2], m[3])]) : String(t).replace(/^-/, MINUS); };
const verdict = (x, rd, pick) => ({ a: "row", row: noteRow(dispX(x), (rd.rat ? "Rational" : "Irrational") + (pick ? " ✓" : ""), pick ? { c: "w-check" } : undefined) });
function ratOneSetup(W, item, x) {
    W.kind = "rel"; W.cols = 3;
    const rd = realRead(x); if (!rd) return null;
    if (!new RegExp("^" + (rd.rat ? "Rational" : "Irrational") + "\\b").test(String(item.a).trim())) throw new Error("key");
    W.steps.push({ move: "start", title: rd.title, why: rd.why, seq: rd.rows.map((row) => ({ a: "row", row })) });
    W.steps.push({ move: "verdict", title: rd.rat ? "Rational" : "Irrational", why: rd.rat ? "It can be written as a fraction of two integers." : "It can't be written as a fraction of two integers.", seq: [verdict(x, rd)] });
    answerStep(W, item.a);
    return true;
}
/** "Which number is irrational?": read every choice; exactly one may be irrational. */
function ratChoiceSetup(W, item, list, keyOf) {
    W.kind = "rel"; W.cols = 3;
    const rds = list.map((c) => ({ c, rd: realRead(c.x) }));
    if (rds.some((x) => !x.rd)) return null;
    const irr = rds.filter((x) => !x.rd.rat);
    if (irr.length !== 1 || keyOf(irr[0]) !== String(item.a).trim()) throw new Error("key");
    W.steps.push({ move: "fact", title: "Rational or irrational?", why: "Rational means it can be written as a fraction of two integers: integers, fractions, and decimals that stop or repeat. Check each choice.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "fact", text: "Rational = a fraction of two integers." } } }] });
    rds.forEach(({ c, rd }) => W.steps.push({ move: "choice", title: (c.label ? c.label + ". " : "") + c.x.replace(/\{(\d+)\/(\d+)\}/, "$1/$2"), why: rd.why, seq: [...rd.rows.map((row) => ({ a: "row", row })), verdict(c.x, rd, !rd.rat)] }));
    answerStep(W, item.a, "Only " + irr[0].c.x.replace(/\{(\d+)\/(\d+)\}/, "$1/$2") + " is irrational.");
    return true;
}
function ratCountSetup(W, item, xs) {
    W.kind = "rel"; W.cols = 3;
    const rds = xs.map((x) => ({ x, rd: realRead(x) }));
    if (rds.some((x) => !x.rd)) return null;
    const rat = rds.filter((x) => x.rd.rat);
    if (String(rat.length) !== String(item.a).trim()) throw new Error("key");
    W.steps.push({ move: "fact", title: "Rational or irrational?", why: "Rational means it can be written as a fraction of two integers. Check each number in the set.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "fact", text: "Rational = a fraction of two integers." } } }] });
    rds.forEach(({ x, rd }) => W.steps.push({ move: "choice", title: x, why: rd.why, seq: [...rd.rows.map((row) => ({ a: "row", row })), verdict(x, rd, rd.rat)] }));
    W.steps.push({ move: "count", title: "Count them", why: rat.length + " of the " + xs.length + " numbers are rational: " + rat.map((x) => x.x).join(", ") + ".", seq: [{ a: "row", row: noteRow(rat.map((x) => x.x).join(", "), rat.length + " rational") }] });
    answerStep(W, item.a);
    return true;
}
/** Bottoms with only 2s and 5s stop; "Which fraction produces a repeating decimal?" */
const primeList = (n) => { const out = []; for (let p = 2; n > 1; p++) while (n % p === 0) { out.push(p); n /= p; } return out; };
function repChoiceSetup(W, item) {
    W.kind = "rel"; W.cols = 3;
    const ch = (item.choices || []).map((c) => { const m = String(c).match(/^\{(\d+)\/(\d+)\}$/); return m ? { c, n: +m[1], d: +m[2] } : null; });
    if (ch.length < 2 || ch.some((x) => !x)) return null;
    W.steps.push({ move: "fact", title: "Look at the bottom", why: "In simplest form, a fraction's decimal stops only when the bottom's prime factors are all 2s and 5s. Any other prime factor makes it repeat.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "fact", text: "Bottom made of only 2s and 5s → it stops." } } }] });
    const reps = [];
    ch.forEach((x) => {
        const q = new Q(x.n, x.d); if (q.d !== x.d) throw new Error("key");     // must already be in simplest form
        const ps = primeList(x.d), other = ps.filter((p) => p !== 2 && p !== 5), rep = other.length > 0;
        if (rep !== (longDiv(x.n, x.d).from >= 0)) throw new Error("key");
        if (rep) reps.push(x.c);
        W.steps.push({ move: "choice", title: x.n + "/" + x.d, why: x.d + " = " + ps.join(" × ") + ". " + (rep ? "It has a " + other[0] + ", so " + x.n + "/" + x.d + " repeats." : "Only 2s and 5s, so " + x.n + "/" + x.d + " stops."),
            seq: [{ a: "row", row: noteRow(R([F(String(x.n), String(x.d))]), x.d + " = " + ps.join(" × ") + (rep ? "  repeats ✓" : "  stops"), rep ? { c: "w-check" } : undefined) }] });
    });
    if (reps.length !== 1 || reps[0] !== String(item.a).trim()) throw new Error("key");
    answerStep(W, item.a, "Only this bottom has a prime factor other than 2 and 5.");
    return true;
}

/** "0.1666… (6 repeating)" → { whole, fixed, block } */
function repParse(dec, note) {
    const m = String(dec).replace(/\.\.\.$/, "…").match(/^(\d+)\.(\d+)…$/);
    if (!m) return null;
    const whole = m[1], ds = m[2];
    let block = null;
    const bm = String(note || "").match(/\(?(?:where only the |only )?(\d+) (?:repeating|repeats)\)?/);
    if (bm) block = bm[1];
    let fixed;
    if (block) {
        // the digits before the block are the ones that don't repeat
        let s = 0; while (s < ds.length && !(ds.slice(s).startsWith(block) && (block.repeat(Math.ceil((ds.length - s) / block.length) + 1)).startsWith(ds.slice(s)))) s++;
        if (s >= ds.length) return null;
        fixed = ds.slice(0, s);
    } else {
        let best = null;
        for (let s = 0; s < ds.length && !best; s++) for (let p = 1; p <= 3 && !best; p++) { const tail = ds.slice(s); if (tail.length >= 2 * p && block == null && tail === tail.slice(0, p).repeat(Math.ceil(tail.length / p)).slice(0, tail.length)) best = { s, p }; }
        if (!best) return null;
        fixed = ds.slice(0, best.s); block = ds.slice(best.s, best.s + best.p);
    }
    const v = new Q(+(whole + fixed + block) - +(whole + fixed), 10 ** (fixed.length + block.length) - 10 ** fixed.length);
    return { whole, fixed, block, v };
}
const repShow = (whole, digits, block) => whole + "." + digits + block.repeat(block.length === 1 ? 3 : 2) + "…";
/** Steps that turn a repeating decimal into a fraction: x = …, 10x = …, subtract, divide. Returns the fraction. */
function repSteps(W, P, v = "x", noStart) {
    const { whole, fixed, block } = P, m = fixed.length, k = block.length;
    const lo = 10 ** m, hi = 10 ** (m + k);
    const shiftTo = (p) => { const all = whole + fixed + block.repeat(6); const s = all.slice(0, whole.length + p), rest = all.slice(whole.length + p); return { text: String(+s) + "." + rest.slice(0, Math.max(3, k * 2)) + "…", int: +s }; };
    const x0 = repShow(whole, fixed, block);
    if (!noStart) W.steps.push({ move: "start", title: "Call it " + v, why: "Let " + v + " be the repeating decimal. The goal is two copies of it with the same repeating tail, so the tail cancels when you subtract.", seq: [{ a: "row", row: { t: "line", cells: [R([v]), "=", R([x0])], sem: { truth: true } } }] });
    const A = shiftTo(m), B = shiftTo(m + k);
    if (m > 0) W.steps.push({ move: "shift", title: "Multiply by " + lo, why: "Only the " + block + " repeats. Multiply by " + lo + " to move the decimal point past the " + fixed + " that doesn't repeat.", seq: [{ a: "row", row: { t: "line", cells: [R([lo + v]), "=", R([A.text])], sem: { truth: true } } }] });
    W.steps.push({ move: "shift", title: "Multiply by " + hi, why: "Multiply by " + hi + " to move the decimal point " + (m > 0 ? "past one more full " : "past one full ") + block + ". The tail after the point is the same as " + (m > 0 ? "in " + lo + v : "in " + v) + ".", seq: [{ a: "row", row: { t: "line", cells: [R([hi + v]), "=", R([B.text])], sem: { truth: true } } }] });
    const lhs = m > 0 ? lo + v : v, aInt = m > 0 ? A.int : +whole, dv = hi - lo, top = B.int - aInt;
    W.steps.push({ move: "repsub", title: "Subtract", why: hi + v + " − " + lhs + " = " + dv + v + ". On the right the repeating tails match, so they cancel: " + B.int + " − " + aInt + " = " + top + ".", seq: [{ a: "row", row: { t: "line", cells: [R([hi + v + " − " + lhs]), "=", R([B.text + " − " + (m > 0 ? A.text : x0)])], sem: { truth: true } } }, { a: "row", row: { t: "line", cells: [R([dv + v]), "=", R([String(top)])], sem: { truth: new Q(top, dv).eq(P.v) } } }] });
    W.steps.push({ move: "divide", title: "Divide by " + dv, why: "Divide both sides by " + dv + " to get " + v + " alone.", seq: [{ a: "row", row: { t: "line", cells: [R([v]), "=", R([F(String(top), String(dv))])], sem: { truth: new Q(top, dv).eq(P.v) } } }] });
    const q = new Q(top, dv);
    if (q.d !== dv) {
        const g = dv / q.d;
        W.steps.push({ move: "simplify", title: "Simplify", why: "Divide the top and the bottom by " + g + ": " + top + " ÷ " + g + " = " + q.n + " and " + dv + " ÷ " + g + " = " + q.d + ".", seq: [{ a: "row", row: { t: "line", cells: [R([v]), "=", R([F(String(q.n), String(q.d))])], sem: { truth: q.eq(P.v) } } }] });
    }
    return q;
}
function repSumSetup(W, item, d1, n1, d2, n2) {
    W.kind = "rel"; W.cols = 3;
    const P1 = repParse(d1, n1), P2 = repParse(d2, n2); if (!P1 || !P2) return null;
    const sum = P1.v.add(P2.v), key = qOf(String(item.a).trim()); if (!key || !key.eq(sum)) throw new Error("key");
    const a = repSteps(W, P1, "x"), b = repSteps(W, P2, "y");
    const L = a.d * b.d / gcdN(a.d, b.d), a2 = a.n * (L / a.d), b2 = b.n * (L / b.d), s = new Q(a2 + b2, L);
    const frac = (n, d) => F(String(n), String(d));
    W.steps.push({ move: "lcd", title: "Add the fractions", why: "Now add " + a.n + "/" + a.d + " + " + b.n + "/" + b.d + ". Use " + L + " for both bottoms: " + a.n + "/" + a.d + " = " + a2 + "/" + L + " and " + b.n + "/" + b.d + " = " + b2 + "/" + L + ".", seq: [{ a: "row", row: { t: "line", cells: [R([frac(a.n, a.d), " + ", frac(b.n, b.d)]), "=", R([frac(a2, L), " + ", frac(b2, L)])], sem: { truth: true }, chain: true } }] });
    W.steps.push({ move: "addtops", title: "Add the tops", why: "Same bottom, so add the tops: " + a2 + " + " + b2 + " = " + (a2 + b2) + "." + (s.d !== L ? " Then simplify to " + s.n + "/" + s.d + "." : ""), seq: [{ a: "row", row: { t: "line", cells: [null, "=", R([frac(a2 + b2, L)])], sem: { truth: true }, chain: true } }, ...(s.d !== L ? [{ a: "row", row: { t: "line", cells: [null, "=", R([frac(s.n, s.d)])], sem: { truth: s.eq(sum) }, chain: true } }] : [])] });
    answerStep(W, item.a);
    return true;
}
const gcdN = (a, b) => (b ? gcdN(b, a % b) : Math.abs(a));
function repFracSetup(W, item, dec, note) {
    W.kind = "rel"; W.cols = 3;
    const P = repParse(dec, note); if (!P) return null;
    const key = qOf(String(item.a).trim()); if (!key || !key.eq(P.v)) throw new Error("key");
    const q = repSteps(W, P);
    if (!q.eq(key)) throw new Error("key");
    answerStep(W, item.a);
    return true;
}

/* ---- square roots ---- */
function sqBetweenSetup(W, item, sgn, n) {
    W.kind = "rel"; W.cols = 3;
    if (isq(n) != null) return null;
    const b = bracketRow(n), a = b.a, neg = !!sgn;
    const want = neg ? [-(a + 1), -a] : [a, a + 1];
    const km = String(item.a).replace(/−/g, "-").match(/^(-?\d+) and (-?\d+)$/);
    if (!km || +km[1] !== want[0] || +km[2] !== want[1]) throw new Error("key");
    W.steps.push({ move: "start", title: "Find the perfect squares around " + n, why: n + " is between the perfect squares " + a * a + " and " + (a + 1) * (a + 1) + ".", seq: [{ a: "row", row: b.row }] });
    W.steps.push({ move: "root", title: "Take the square roots", why: "Square roots keep the same order: √" + a * a + " = " + a + " and √" + (a + 1) * (a + 1) + " = " + (a + 1) + ", so √" + n + " is between " + a + " and " + (a + 1) + ".", seq: [{ a: "row", row: chainRow([String(a), "<", "√" + n, "<", String(a + 1)], a * a < n && n < (a + 1) * (a + 1)) }] });
    if (neg) W.steps.push({ move: "flip", title: "Take the opposite", why: "The minus sign flips everything to the other side of 0, so the order flips too: −√" + n + " is between −" + (a + 1) + " and −" + a + ".", seq: [{ a: "row", row: chainRow([MINUS + (a + 1), "<", MINUS + "√" + n, "<", MINUS + a], true) }] });
    answerStep(W, item.a);
    return true;
}
/** The nearest whole number: compare with the halfway point's square. */
function sqNearestSetup(W, item, n) {
    W.kind = "rel"; W.cols = 3;
    if (isq(n) != null) return null;
    const b = bracketRow(n), a = b.a, mid = new Q(2 * a + 1, 2), mid2 = mid.mul(mid), up = new Q(n).cmp(mid2) > 0, ans = up ? a + 1 : a;
    if (readKey(item.a) == null || !readKey(item.a).v || !readKey(item.a).v.eq(ans)) throw new Error("key");
    if ((Math.abs(Math.sqrt(n) - ans) < Math.abs(Math.sqrt(n) - (up ? a : a + 1))) !== true) throw new Error("key");
    W.steps.push({ move: "start", title: "Find the perfect squares around " + n, why: "√" + n + " is between " + a + " and " + (a + 1) + ".", seq: [{ a: "row", row: b.row }] });
    W.steps.push({ move: "half", title: "Check the halfway point", why: "Halfway between " + a + " and " + (a + 1) + " is " + dtx(mid) + ", and " + dtx(mid) + "² = " + dtx(mid2) + ". " + n + " is " + (up ? "more" : "less") + ", so √" + n + " is " + (up ? "past" : "before") + " the halfway point, closer to " + ans + ".",
        seq: [{ a: "row", row: chainRow(up ? [dtx(mid) + "²", "=", dtx(mid2), "<", String(n)] : [String(n), "<", dtx(mid2), "=", dtx(mid) + "²"], true) }] });
    answerStep(W, item.a);
    return true;
}
/** Tenths: square tenths until n is caught between two of them. */
function tenthsRows(n, a) {
    let t = new Q(a * 10, 10);
    for (let i = 0; i < 10; i++) { const u = t.add(new Q(1, 10)); if (u.mul(u).cmp(n) > 0) return { lo: t, hi: u }; t = u; }
    return null;
}
function sqTenthSetup(W, item, n, mode) {
    W.kind = "rel"; W.cols = 3;
    if (isq(n) != null) return null;
    const b = bracketRow(n), a = b.a, T = tenthsRows(n, a); if (!T) return null;
    const lo2 = T.lo.mul(T.lo), hi2 = T.hi.mul(T.hi);
    W.steps.push({ move: "start", title: "Find the perfect squares around " + n, why: "√" + n + " is between " + a + " and " + (a + 1) + ".", seq: [{ a: "row", row: b.row }] });
    W.steps.push({ move: "tenths", title: "Try tenths", why: "Square tenths between " + a + " and " + (a + 1) + " until " + n + " is caught: " + dtx(T.lo) + "² = " + dtx(lo2) + " and " + dtx(T.hi) + "² = " + dtx(hi2) + ". So √" + n + " is between " + dtx(T.lo) + " and " + dtx(T.hi) + ".",
        seq: [{ a: "row", row: chainRow([dtx(T.lo) + "²", "=", dtx(lo2), "<", String(n), "<", dtx(hi2), "=", dtx(T.hi) + "²"], lo2.cmp(n) < 0 && hi2.cmp(n) > 0) }] });
    if (mode === "between") {
        const km = String(item.a).match(/^([\d.]+)(?: \w+)? and ([\d.]+)/);
        if (!km || !qOf(km[1]).eq(T.lo) || !qOf(km[2]).eq(T.hi)) throw new Error("key");
    } else {
        const mid = T.lo.add(T.hi).div(2), mid2 = mid.mul(mid), up = new Q(n).cmp(mid2) > 0, ans = up ? T.hi : T.lo;
        const k = readKey(item.a); if (!k || !k.v || !k.v.eq(ans)) throw new Error("key");
        W.steps.push({ move: "half", title: "Round to the nearest tenth", why: "Halfway is " + dtx(mid) + ", and " + dtx(mid) + "² = " + dtx(mid2) + ". " + n + " is " + (up ? "more" : "less") + ", so √" + n + " rounds " + (up ? "up to " : "down to ") + dtx(ans) + ".",
            seq: [{ a: "row", row: chainRow(up ? [dtx(mid) + "²", "=", dtx(mid2), "<", String(n)] : [String(n), "<", dtx(mid2), "=", dtx(mid) + "²"], true) }] });
    }
    answerStep(W, item.a);
    return true;
}
/** "Find an integer n such that 4.2 < √n < 4.3." */
function sqFindSetup(W, item, lo, hi) {
    W.kind = "rel"; W.cols = 3;
    const L = qOf(lo), H = qOf(hi); if (!L || !H) return null;
    const L2 = L.mul(L), H2 = H.mul(H), ns = []; for (let n = Math.ceil(L2.n / L2.d); n * H2.d < H2.n; n++) if (L2.cmp(n) < 0) ns.push(n);
    if (ns.length !== 1 || String(ns[0]) !== String(item.a).trim()) throw new Error("key");
    W.steps.push({ move: "start", title: "Square every part", why: "All three parts are positive, so squaring keeps the order: " + lo + "² = " + dtx(L2) + " and " + hi + "² = " + dtx(H2) + ".", seq: [{ a: "row", row: chainRow([dtx(L2), "<", "n", "<", dtx(H2)], true) }] });
    W.steps.push({ move: "verdict", title: "Find the integer", why: "The only integer between " + dtx(L2) + " and " + dtx(H2) + " is " + ns[0] + ".", seq: [{ a: "row", row: chainRow([dtx(L2), "<", String(ns[0]), "<", dtx(H2)], true, { c: "w-check" }) }] });
    answerStep(W, item.a);
    return true;
}
/** A positive number's square, for comparing: √n → n, π → about 9.87, a decimal or fraction → exact. */
function sqOf(x) {
    let m; const t = String(x).trim();
    if ((m = t.match(/^√(\d+)$/))) return { v: new Q(+m[1]), approx: Math.sqrt(+m[1]), row: ["(" + t + ")²", "=", m[1]], why: "(√" + m[1] + ")² = " + m[1] };
    if (t === "π") return { v: new Q(987, 100), approx: Math.PI, row: ["π²", "≈", "9.87"], why: "π² ≈ 3.14² ≈ 9.87", pi: true };
    if ((m = t.match(/^\{(\d+)\/(\d+)\}$/))) { const q = new Q(+m[1], +m[2]), s = q.mul(q); return { v: s, approx: +m[1] / +m[2], row: ["(" + m[1] + "/" + m[2] + ")²", "=", dtx(s)], why: "(" + m[1] + "/" + m[2] + ")² = " + numText(s, "frac") + " = " + dtx(s) }; }
    const q = qOf(t); if (!q || q.sign <= 0) return null; const s = q.mul(q);
    return { v: s, approx: q.n / q.d, row: [t + "²", "=", dtx(s)], why: t + "² = " + dtx(s) };
}
function sqOrderSetup(W, item, xs) {
    W.kind = "rel"; W.cols = 3;
    const ss = xs.map((x) => ({ x, s: sqOf(x) })); if (ss.some((x) => !x.s)) return null;
    const byTrue = ss.slice().sort((p, q) => p.s.approx - q.s.approx), bySq = ss.slice().sort((p, q) => p.s.v.cmp(q.s.v));
    if (byTrue.some((p, i) => p !== bySq[i]) || new Set(ss.map((p) => p.s.v.n / p.s.v.d)).size !== ss.length) throw new Error("key");
    const order = bySq.map((p) => p.x.replace(/\{(\d+)\/(\d+)\}/, "{$1/$2}"));
    if (order.join(", ").replace(/\s/g, "") !== String(item.a).replace(/\s/g, "")) throw new Error("key");
    W.steps.push({ move: "fact", title: "Square each number", why: "All the numbers are positive, so the one with the bigger square is the bigger number. Squares are easy to compare: no square roots left.", seq: ss.map((p) => ({ a: "row", row: chainRow(p.s.row, true) })) });
    W.steps.push({ move: "order", title: "Order the squares", why: "From smallest square to biggest: " + bySq.map((p) => dtx(p.s.v)).join(" < ") + ". The numbers go in the same order.", seq: [{ a: "row", row: chainRow([bySq.map((p) => dtx(p.s.v)).join(" < ")], true) }, { a: "row", row: chainRow([order.map((o) => o.replace(/\{(\d+)\/(\d+)\}/, "$1/$2")).join(" < ")], true, { c: "w-check" }) }] });
    answerStep(W, item.a);
    return true;
}
/** "Which is greater: √50 or 7.2?" and "(√30) ___ 5.2" */
function sqCompare(x, y) {
    const a = sqOf(x), b = sqOf(y); if (!a || !b) return null;
    const c = a.v.cmp(b.v), t = Math.sign(a.approx - b.approx); if (c === 0 || c !== t) return null;
    return { a, b, c };
}
function sqGreaterSetup(W, item, x, y) {
    W.kind = "rel"; W.cols = 3;
    const C = sqCompare(x, y); if (!C) return null;
    const big = C.c > 0 ? x : y;
    if (String(item.a).trim() !== big) throw new Error("key");
    W.steps.push({ move: "fact", title: "Square both", why: "Both numbers are positive, so the one with the bigger square is bigger. " + C.a.why + " and " + C.b.why + ".", seq: [{ a: "row", row: chainRow(C.a.row, true) }, { a: "row", row: chainRow(C.b.row, true) }] });
    W.steps.push({ move: "verdict", title: "Compare", why: dtx(C.c > 0 ? C.a.v : C.b.v) + " is bigger than " + dtx(C.c > 0 ? C.b.v : C.a.v) + ", so " + big + " is greater.", seq: [{ a: "row", row: chainRow([dtx(C.a.v) + (C.c > 0 ? " > " : " < ") + dtx(C.b.v)], true) }, { a: "row", row: chainRow([x + (C.c > 0 ? " > " : " < ") + y], true, { c: "w-check" }) }] });
    answerStep(W, item.a);
    return true;
}
function sqSymbolSetup(W, item, x, y) {
    W.kind = "rel"; W.cols = 3;
    const C = sqCompare(x, y); if (!C) return null;
    const sym = C.c > 0 ? ">" : "<";
    if (String(item.a).trim() !== sym) throw new Error("key");
    W.steps.push({ move: "fact", title: "Square both", why: "Both numbers are positive, so compare their squares. " + C.a.why + " and " + C.b.why + ".", seq: [{ a: "row", row: chainRow(C.a.row, true) }, { a: "row", row: chainRow(C.b.row, true) }] });
    W.steps.push({ move: "verdict", title: "Compare", why: dtx(C.a.v) + " is " + (C.c > 0 ? "more" : "less") + " than " + dtx(C.b.v) + ", so " + x + " " + sym + " " + y + ".", seq: [{ a: "row", row: chainRow([dtx(C.a.v) + " " + sym + " " + dtx(C.b.v)], true) }, { a: "row", row: chainRow([x + " " + sym + " " + y], true, { c: "w-check" }) }] });
    answerStep(W, item.a);
    return true;
}
/** "Which number is closest to 6.5 on a number line?": compare squares with 6.5². */
function sqClosestSetup(W, item, target) {
    W.kind = "rel"; W.cols = 3;
    const T = qOf(target); if (!T || T.sign <= 0) return null;
    const ch = (item.choices || []).map((c) => { const m = String(c).match(/^√(\d+)$/); return m ? { c, n: +m[1] } : null; });
    if (ch.length < 2 || ch.some((x) => !x)) return null;
    const T2 = T.mul(T), dist = (x) => new Q(x.n).sub(T2).abs();
    const best = ch.slice().sort((p, q) => dist(p).cmp(dist(q)));
    const trueBest = ch.slice().sort((p, q) => Math.abs(Math.sqrt(p.n) - T.n / T.d) - Math.abs(Math.sqrt(q.n) - T.n / T.d));
    if (best[0] !== trueBest[0] || dist(best[0]).eq(dist(best[1])) || best[0].c !== String(item.a).trim()) throw new Error("key");
    W.steps.push({ move: "fact", title: "Square " + target, why: "Every choice is a square root, so square " + target + " and look for the number under the root that is closest: " + target + "² = " + dtx(T2) + ".", seq: [{ a: "row", row: chainRow([target + "²", "=", dtx(T2)], true) }] });
    W.steps.push({ move: "choice", title: "How far is each one?", why: "Compare each number under the root with " + dtx(T2) + ". " + best[0].n + " is only " + dtx(dist(best[0])) + " away.", seq: ch.map((x) => ({ a: "row", row: noteRow(x.c, dtx(dist(x)) + " away" + (x === best[0] ? " ✓" : ""), x === best[0] ? { c: "w-check" } : undefined) })) });
    answerStep(W, item.a);
    return true;
}
function piSqSetup(W, item) {
    W.kind = "rel"; W.cols = 3;
    const p = new Q(314, 100), s = p.mul(p), r = Math.round(s.n / s.d);
    const k = readKey(item.a); if (!k || !k.v || !k.v.eq(r) || Math.round(Math.PI * Math.PI) !== r) throw new Error("key");
    W.steps.push({ move: "start", title: "Use π ≈ 3.14", why: "π is about 3.14, close enough to estimate to the nearest whole number.", seq: [{ a: "row", row: chainRow(["π", "≈", "3.14"], true) }] });
    W.steps.push({ move: "mul", title: "Square it", why: "3.14² = 3.14 × 3.14 = " + dtx(s) + ".", seq: [{ a: "row", row: chainRow(["3.14²", "=", dtx(s)], true) }] });
    W.steps.push({ move: "round", title: "Round", why: dtx(s) + " is closest to " + r + ".", seq: [{ a: "row", row: chainRow([dtx(s), "≈", String(r)], true, { c: "w-check" }) }] });
    answerStep(W, item.a);
    return true;
}
function piLineSetup(W, item, a, b) {
    W.kind = "rel"; W.cols = 3;
    const p = new Q(314159, 100000), v = p.mul(a).add(b), lo = Math.floor((a * Math.PI + b) * 10), loQ = new Q(lo, 10), hiQ = new Q(lo + 1, 10);
    if (Math.floor(v.n / v.d * 10) !== lo) return null;
    const km = String(item.a).match(/between (\d+(?:\.\d+)?) and (\d+(?:\.\d+)?)/); if (!km || !qOf(km[1]).eq(loQ) || !qOf(km[2]).eq(hiQ)) throw new Error("key");
    W.steps.push({ move: "start", title: "Use π ≈ 3.14159", why: "Use enough decimal places of π to place it to the tenth.", seq: [{ a: "row", row: chainRow(["π", "≈", "3.14159"], true) }] });
    W.steps.push({ move: "mul", title: "Work it out", why: a + " × 3.14159 = " + dtx(p.mul(a)) + ", then + " + b + " = " + dtx(v) + ".", seq: [{ a: "row", row: chainRow([a + "(3.14159) + " + b, "=", dtx(v)], true) }] });
    W.steps.push({ move: "verdict", title: "Place it", why: dtx(v) + " is between " + dtx(loQ) + " and " + dtx(hiQ) + ".", seq: [{ a: "row", row: chainRow([dtx(loQ), "<", dtx(v), "<", dtx(hiQ)], loQ.cmp(v) < 0 && v.cmp(hiQ) < 0, { c: "w-check" }) }] });
    answerStep(W, item.a);
    return true;
}

/* ---------- Week 6: absolute value "or", quadratics by factoring, doubling, factoring out a number, which choice ---------- */
const nT = (q) => numText(q, q.int ? undefined : "dec");
/** "x + 2", "2t − 3", "L − 24" for a·v + c. */
const linT = (a, c, v) => (a.eq(ONE) ? "" : a.eq(ONE.neg()) ? MINUS : nT(a)) + v + (c.zero ? "" : (c.sign < 0 ? " " + MINUS + " " : " + ") + nT(c.abs()));
/** |a·v + c| r B with r ">" or "≥": two inequalities joined by "or". Steps go on W; returns { kind: "or", … }. */
function absOr(W, line, v) {
    const r = line.r[0], rl = r === ">" ? "<" : "≤", f = formOf(line.s[0]), B = formOf(line.s[1]).b;
    if (!formOf(line.s[1]).a.zero || B.sign <= 0 || f.a.sign <= 0) throw new Error("absolute value kind");
    const inT = linT(f.a, f.b, v);
    const holds = (t) => { const x = f.a.mul(t).add(f.b); return relTrue(x.abs(), r, B); };
    const lo = B.neg().sub(f.b).div(f.a), hi = B.sub(f.b).div(f.a);
    const pts = [lo, hi]; [lo, hi].forEach((p) => pts.push(p.sub(new Q(1, 100)), p.add(new Q(1, 100)))); pts.push(lo.add(hi).div(new Q(2)), lo.sub(ONE), hi.add(ONE));
    const same = (test) => pts.every((t) => test(t) === holds(t));
    const orRow = (L, R1, R2, test) => chainRow([L, rl, R1, "or", L, r, R2], same(test));
    const far = r === ">" ? "more than " + nT(B) + " away from 0" : nT(B) + " or more away from 0";
    W.steps.push({ move: "abs", title: "Split into two inequalities", why: "|" + inT + "| " + r + " " + nT(B) + " means " + inT + " is " + far + ": " + (r === ">" ? "less than " + nT(B.neg()) + " or greater than " + nT(B) : "at most " + nT(B.neg()) + " or at least " + nT(B)) + ". Write both, joined by \"or\".",
        seq: [{ a: "row", row: orRow(inT, nT(B.neg()), nT(B), (t) => relTrue(f.a.mul(t).add(f.b), rl, B.neg()) || relTrue(f.a.mul(t).add(f.b), r, B)) }] });
    if (!f.b.zero) {
        const L2 = linT(f.a, ZERO, v), r1 = B.neg().sub(f.b), r2 = B.sub(f.b);
        W.steps.push({ move: "both", title: (f.b.sign > 0 ? "Subtract " : "Add ") + nT(f.b.abs()) + " in each part", why: "Undo the " + (f.b.sign > 0 ? "+ " : MINUS + " ") + nT(f.b.abs()) + " the same way in both inequalities: " + nT(B.neg()) + (f.b.sign > 0 ? " − " : " + ") + nT(f.b.abs()) + " = " + nT(r1) + " and " + nT(B) + (f.b.sign > 0 ? " − " : " + ") + nT(f.b.abs()) + " = " + nT(r2) + ".",
            seq: [{ a: "row", row: orRow(L2, nT(r1), nT(r2), (t) => relTrue(f.a.mul(t), rl, r1) || relTrue(f.a.mul(t), r, r2)) }] });
    }
    if (!f.a.one) W.steps.push({ move: "divide", title: "Divide by " + nT(f.a), why: "Divide each part by " + nT(f.a) + ". It's positive, so the signs stay the same.", seq: [{ a: "row", row: orRow(v, nT(lo), nT(hi), (t) => relTrue(t, rl, lo) || relTrue(t, r, hi)) }] });
    return { kind: "or", v, lo, hi, rlo: rl, rhi: r, inner: f, B, r };
}
function orCheck(W, res) {
    const { v, lo, hi, inner: f, B, r } = res;
    const rows = [lo.sub(ONE), lo.add(hi).div(new Q(2)), hi.add(ONE)].map((t, i) => {
        const x = f.a.mul(t).add(f.b), ok = relTrue(x.abs(), r, B), rel = ok ? r : (r === ">" ? "≤" : "<");
        const subT = (f.a.one ? nT(t) : nT(f.a) + "(" + nT(t) + ")") + (f.b.zero ? "" : (f.b.sign < 0 ? " − " : " + ") + nT(f.b.abs()));
        return { t: "line", cells: [R(["|" + subT + "| = " + nT(x.abs()) + " " + rel + " " + nT(B) + (ok ? " ✓" : " ✗")]), null, null], sem: { truth: ok === (i !== 1) }, chain: true, c: ok ? "w-check" : undefined, _t: t };
    });
    const why = "Try a number from each part, and one from the gap between them. " + nT(rows[0]._t) + " and " + nT(rows[2]._t) + " work. " + nT(rows[1]._t) + " is in the gap, and it doesn't.";
    rows.forEach((row) => delete row._t);
    W.steps.push({ move: "check", title: "Check", why, seq: rows.map((row) => ({ a: "row", row })) });
    const unit = [1, 0.5, 0.25, 0.1, 0.05, 0.01].find((u) => [lo, hi].every((q) => Math.abs(q.toNumber() / u - Math.round(q.toNumber() / u)) < 1e-9) && (hi.toNumber() - lo.toNumber()) / u >= 2) || 1;
    const circle = (c) => (c ? "a closed circle (the number is included)" : "an open circle (the number is not included)");
    W.steps.push({ move: "graph", title: "Graph it", why: "Put " + circle(res.rlo === "≤") + " at " + nT(lo) + " and shade left. Put " + circle(res.rhi === "≥") + " at " + nT(hi) + " and shade right.",
        seq: [{ a: "row", row: { t: "pic", pic: { kind: "ineq", out: true, lo: lo.toNumber(), hi: hi.toNumber(), loT: nT(lo), hiT: nT(hi), cl: res.rlo === "≤", ch: res.rhi === "≥", unit } } }] });
}

/** Integer polynomial a·v² + b·v + c as text. */
function polyT(cs, v) {
    const out = []; const pw = ["²", "", ""];
    cs.forEach((c, i) => {
        if (!c) return;
        const a = Math.abs(c), body = (i < 2 && a === 1 ? "" : String(a)) + (i < 2 ? v + pw[i] : "");
        out.push(out.length ? (c < 0 ? " − " : " + ") + body : (c < 0 ? MINUS : "") + body);
    });
    return out.join("") || "0";
}
/** a·v² + b·v + c = 0 as (p·v + q)(r·v + s) with p, r > 0; null if it doesn't factor over the integers. */
function factorQuad(a, b, c) {
    for (let p = 1; p <= a; p++) {
        if (a % p) continue;
        const r = a / p;
        for (let q = -Math.abs(c) || 0; q <= Math.abs(c); q++) {
            if (c === 0 ? q !== 0 : (q === 0 || c % q)) continue;
            const s = c === 0 ? 0 : c / q;
            if (p * s + q * r === b) return { p, q, r, s };
        }
        if (c === 0 && b % p === 0) return { p, q: 0, r, s: b / p };
    }
    return null;
}
const facT = (p, q, v) => "(" + (p === 1 ? "" : p) + v + (q ? (q < 0 ? " − " : " + ") + Math.abs(q) : "") + ")";
/** "w(w + 3) = 40" or "−16t² + 96t + 40 = 148": expand, get 0 on one side, factor, zero product, keep what fits, check. */
function quadSetup(W, item, o) {
    W.kind = "rel"; W.cols = 3;
    let m, v, cs, rhs, start = o.quad, expanded = null;
    if ((m = start.match(/^([a-z])\(\1 \+ (\d+)\) = (\d+)$/))) { v = m[1]; cs = [1, +m[2], 0]; rhs = +m[3]; expanded = polyT(cs, v) + " = " + rhs; }
    else if ((m = start.match(/^([−-]?\d*)([a-z])² ([+−-]) (\d+)\2 ([+−-]) (\d+) = (\d+)$/))) {
        v = m[2]; const sg = (x) => (x === "+" ? 1 : -1);
        cs = [m[1] === "" ? 1 : m[1] === "−" || m[1] === "-" ? -1 : +m[1].replace("−", "-"), sg(m[3]) * +m[4], sg(m[5]) * +m[6]]; rhs = +m[7];
    } else return null;
    const P = (t) => new Q(cs[0]).mul(t).mul(t).add(new Q(cs[1]).mul(t)).add(new Q(cs[2]));   // left side's value
    W.steps.push({ move: "story", title: "Read the story", why: o.why0 || "Find the numbers in the story and what each one means.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "story", text: item.q, marks: o.story || [] } } }] });
    W.steps.push({ move: "setup", title: "Write the equation", why: o.why1 || ("Each piece of the story goes into the equation. " + v + " is " + (o.var || "the unknown") + "."), seq: [{ a: "row", row: chainRow([start], true) }] });
    if (expanded) W.steps.push({ move: "expand", title: "Multiply it out", why: v + " × " + v + " = " + v + "², and " + v + " × " + cs[1] + " = " + cs[1] + v + ".", seq: [{ a: "row", row: chainRow([expanded], true) }] });
    const std = [cs[0], cs[1], cs[2] - rhs];
    W.steps.push({ move: "zero", title: "Get 0 on one side", why: "To factor, one side has to be 0. Subtract " + rhs + " from both sides" + (cs[2] ? ": " + cs[2] + " − " + rhs + " = " + std[2] + "." : "."), seq: [{ a: "row", row: chainRow([polyT(std, v), "=", "0"], true) }] });
    let red = std.slice();
    const g = gcd(gcd(std[0], std[1]), std[2]) * (std[0] < 0 ? -1 : 1);
    if (g !== 1) {
        red = std.map((x) => x / g);
        W.steps.push({ move: "divide", title: "Divide every term by " + (g < 0 ? MINUS + Math.abs(g) : g), why: "Every number divides by " + (g < 0 ? MINUS + Math.abs(g) : g) + ". That makes the numbers smaller" + (g < 0 ? " and the " + v + "² term positive" : "") + ", and 0 ÷ " + (g < 0 ? "(" + MINUS + Math.abs(g) + ")" : g) + " is still 0.",
            seq: [{ a: "row", row: chainRow([polyT(red, v), "=", "0"], true) }] });
    }
    let fq = factorQuad(red[0], red[1], red[2]); if (!fq) return null;
    if (new Q(-fq.q, fq.p).cmp(new Q(-fq.s, fq.r)) > 0) fq = { p: fq.r, q: fq.s, r: fq.p, s: fq.q };   // the smaller answer first
    const { p, q, r, s } = fq;
    const expOK = p * r === red[0] && p * s + q * r === red[1] && q * s === red[2];
    const sgn = (x) => (x < 0 ? "(" + MINUS + Math.abs(x) + ")" : String(x));
    const why = red[0] === 1 ? "Find two numbers that multiply to " + sgn(red[2]).replace(/[()]/g, "") + " and add to " + sgn(red[1]).replace(/[()]/g, "") + ": " + sgn(q) + " × " + sgn(s) + " = " + red[2] + " and " + sgn(q) + " + " + sgn(s) + " = " + red[1] + "."
        : "Try " + facT(p, q, v) + facT(r, s, v) + ": " + (p === 1 ? "" : p) + v + " × " + (r === 1 ? "" : r) + v + " = " + red[0] + v + "², " + sgn(q) + " × " + sgn(s) + " = " + red[2] + ", and the middle terms add to " + (p * s + q * r) + v + ".";
    W.steps.push({ move: "factor", title: "Factor", why: why.replace(/-/g, MINUS), seq: [{ a: "row", row: chainRow([facT(p, q, v) + facT(r, s, v), "=", "0"], expOK) }] });
    const roots = [new Q(-q, p), new Q(-s, r)];
    const zeroOK = roots.every((t) => P(t).eq(new Q(rhs)));
    W.steps.push({ move: "zp", title: "Set each factor to 0", why: "Two numbers multiply to 0 only if one of them is 0. So one factor or the other is 0.", seq: [{ a: "row", row: chainRow([facT(p, q, v).slice(1, -1), "=", "0", "or", facT(r, s, v).slice(1, -1), "=", "0"], zeroOK) }] });
    W.steps.push({ move: "both", title: "Solve each one", why: roots.map((t, i) => { const pp = i ? r : p, qq = i ? s : q; return (qq < 0 ? "Add " + Math.abs(qq) : "Subtract " + qq) + (pp === 1 ? "" : ", then divide by " + pp) + ": " + v + " = " + nT(t) + "."; }).join(" "),
        seq: [{ a: "row", row: chainRow([v, "=", nT(roots[0]), "or", v, "=", nT(roots[1])], zeroOK) }] });
    let keep = roots;
    if (o.keep === "positive") {
        keep = roots.filter((t) => t.sign > 0);
        if (keep.length !== 1) return null;
        W.steps.push({ move: "pick", title: "Keep the one that fits", why: o.keepWhy || ("A length can't be negative, so " + v + " = " + nT(keep[0]) + "."), seq: [{ a: "row", row: chainRow([v, "=", nT(keep[0])], true, { c: "w-check" }) }] });
    } else if (o.keepWhy) {
        keep = roots.slice().sort((x, y) => x.cmp(y));
        W.steps.push({ move: "pick", title: "What each one means", why: o.keepWhy, seq: keep.map((t, i) => ({ a: "row", row: { t: "line", cells: [R([v + " = " + nT(t) + ((o.labels || [])[i] ? ": " + o.labels[i] : "")]), null, null], chain: true } })) });
    }
    const chk = keep.map((t) => {
        const val = P(t), tt = t.int ? nT(t) : "(" + nT(t) + ")";
        const lhs = expanded ? v + "(" + v + " + " + cs[1] + ")" : polyT(cs, v);
        const subd = lhs.replace(new RegExp(v + "²", "g"), "(" + nT(t) + ")²").replace(new RegExp("(\\d)" + v, "g"), "$1" + (t.int && t.sign >= 0 ? "(" + nT(t) + ")" : tt)).replace(new RegExp(v, "g"), nT(t));
        return { a: "row", row: { t: "line", cells: [R([subd + " = " + nT(val) + (val.eq(new Q(rhs)) ? " ✓" : "")]), null, null], sem: { truth: val.eq(new Q(rhs)) }, chain: true, c: "w-check" } };
    });
    W.steps.push({ move: "check", title: "Check", why: "Put " + keep.map(nT).join(" and ") + " back into the first equation. " + (keep.length > 1 ? "Both give " : "It gives ") + rhs + " ✓.", seq: chk });
    // the key: every kept answer is in it, and the other one isn't
    const a = String(item.a), has = (t) => new RegExp("(^|[^\\d.])" + nT(t).replace(MINUS, "[−-]").replace(".", "\\.") + "([^\\d.]|$)").test(a);
    if (!keep.every(has) || roots.some((t) => !keep.includes(t) && t.sign < 0 && has(t) && !has(t.abs()))) throw new Error("key");
    if (o.keep === "positive" && roots.some((t) => t.sign < 0 && new RegExp("[−-]" + nT(t.abs()) + "([^\\d.]|$)").test(a))) throw new Error("key");
    const eqPart = a.split(/[;,]/)[0];
    if (/=/.test(eqPart) && new RegExp(v + "\\(").test(eqPart) && eqPart.replace(/\s/g, "") !== start.replace(/\s/g, "")) throw new Error("key");
    answerStep(W, item.a, o.end || "");
    return true;
}
const supDT = (s) => { const out = []; const re = /\^\{?([a-z0-9]+)\}?/g; let last = 0, m; while ((m = re.exec(s))) { out.push(s.slice(last, m.index), { sup: m[1] }); last = re.lastIndex; } out.push(s.slice(last)); return R(out); };
/** "200 · 2^t = 3200": divide by the start, then count the doublings. */
function growSetup(W, item, o) {
    W.kind = "rel"; W.cols = 3;
    const m = o.grow.match(/^(\d+) · (\d+)\^([a-z]) = (\d+)$/); if (!m) return null;
    const a = +m[1], b = +m[2], v = m[3], T = +m[4];
    if (T % a) return null;
    const goal = T / a; let n = 0, x = 1; const rows = [];
    while (x < goal && n < 12) { n++; x *= b; rows.push({ t: "line", cells: [R([String(b), { sup: String(n) }, " = " + x]), null, null], sem: { truth: Math.pow(b, n) === x }, chain: true }); }
    if (x !== goal) return null;
    W.steps.push({ move: "story", title: "Read the story", why: o.why0 || "Find the numbers in the story and what each one means.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "story", text: item.q, marks: o.story || [] } } }] });
    W.steps.push({ move: "setup", title: "Write the equation", why: o.why1 || ("Each piece of the story goes into the equation. " + v + " is " + (o.var || "the unknown") + "."), seq: [{ a: "row", row: { t: "line", cells: [supDT(a + " · " + b + "^" + v + " = " + T), null, null], chain: true } }] });
    W.steps.push({ move: "divide", title: "Divide both sides by " + a, why: "Undo the " + a + " · by dividing both sides by " + a + ": " + T + " ÷ " + a + " = " + goal + ".", seq: [{ a: "row", row: { t: "line", cells: [supDT(b + "^" + v + " = " + goal), null, null], sem: { truth: T / a === goal }, chain: true } }] });
    W.steps.push({ move: "power", title: "Count the " + (b === 2 ? "doublings" : "times you multiply by " + b), why: "Multiply by " + b + " until you reach " + goal + ". It takes " + n + " times, so " + v + " = " + n + ".", seq: rows.map((row) => ({ a: "row", row })) });
    W.steps.push({ move: "pick", title: v + " = " + n, why: b + " to the power " + n + " is " + goal + ", so " + v + " = " + n + ".", seq: [{ a: "row", row: chainRow([v, "=", String(n)], true, { c: "w-check" }) }] });
    W.steps.push({ move: "check", title: "Check", why: "Put " + n + " back in: " + a + " · " + goal + " = " + T + " ✓.", seq: [{ a: "row", row: { t: "line", cells: [R([a + " · " + b, { sup: String(n) }, " = " + a + " · " + goal + " = " + a * goal + " ✓"]), null, null], sem: { truth: a * Math.pow(b, n) === T }, chain: true, c: "w-check" } }] });
    const s = String(item.a).replace(/(\d),(\d{3})/g, "$1$2");
    if (!new RegExp(v + " = " + n + "([^\\d.]|$)").test(s) || (/=/.test(s.split(",")[0]) && s.split(",")[0].replace(/\s/g, "").replace(/\^\{?([a-z])\}?/, "^$1") !== o.grow.replace(/\s/g, ""))) throw new Error("key");
    answerStep(W, item.a, o.end || "");
    return true;
}

/** "Factor −{3/4} out of −{3/4}x + {3/2}": divide each term by the number, put it in front, check. */
function factorOutSetup(W, item, gText, text) {
    W.kind = "simp";
    const side = oneSide(W, text), gs = oneSide(W, "x + " + gText);
    if (!side || side.some((t) => t.g) || !gs || gs.length !== 2) return null;
    const G = gs[1].c, f0 = formOf(side), v = varOf({ s: [side] });
    const inner = side.map((t) => ({ c: t.c.div(G), v: t.v, g: null, over: false, dec: t.dec && !t.c.div(G).int, k: key(W) }));
    const grp = { c: G, v: null, g: inner, over: false, dec: false, k: key(W) };
    const gT = numText(G, "frac"), gP = G.sign < 0 ? "(" + gT + ")" : gT;
    W.steps.push({ move: "start", title: "The problem", why: "Factoring " + gT + " out means writing it as " + gT + " times parentheses. To find what goes inside, divide each term by " + gT + ".",
        seq: [{ a: "row", row: { t: "line", cells: [sideDT(side), null, null], sem: { f: f0 } } }] });
    const parts = side.map((t, i) => {
        const cT = numText(t.c, "frac"), out = termText(inner[i], true);
        if (t.v && t.c.eq(G)) return termText(t, true) + " ÷ " + gP + " = " + out;
        return cT + " ÷ " + gP + " = " + cT + " × " + numText(G.inv(), "frac").replace(/^−/, "(" + MINUS) + (G.sign < 0 ? ")" : "") + " = " + out + (t.v ? "" : "");
    });
    W.steps.push({ move: "factor", title: "Divide each term by " + gT, why: parts.join(", and ") + ". Write " + gT + " in front and the answers in the parentheses.",
        seq: [{ a: "row", row: { t: "line", cells: [null, "=", termDT(grp, true)], sem: { f: formOf([grp]) } } }] });
    const back = inner.map((t) => ({ c: t.c.mul(G), v: t.v, g: null, over: false, dec: false, k: key(W) }));
    W.steps.push({ move: "check", title: "Check", why: "Distribute " + gT + " back in. You get the problem back ✓.",
        seq: [{ a: "row", row: { t: "line", cells: [termDT(Object.assign({}, grp, { k: key(W) }), true), "=", R([sideDT(back), " ✓"])], sem: { truth: formOf(back).a.eq(f0.a) && formOf(back).b.eq(f0.b) }, c: "w-check" } }] });
    const k = oneSide(W, item.a);
    if (!k || k.length !== 1 || !k[0].g || !k[0].c.eq(G)) throw new Error("key");
    const fk = formOf(k[0].g), fi = formOf(inner);
    if (!fk.a.eq(fi.a) || !fk.b.eq(fi.b)) throw new Error("key");
    answerStep(W, item.a, "");
    return true;
}
/** a·v + b written as one expression. */
const formSideT = (f, v) => sideText([{ c: f.a, v, g: null, k: "fa", dec: !f.a.int }, { c: f.b, v: null, g: null, k: "fb", dec: !f.b.int }].filter((t) => !t.c.zero));
/** Simplify an expression, then hold each choice up to it. which: "same" (find the one equal) or "not" (find the one that isn't). */
function choiceSimpSetup(W, item, text, choices, which) {
    W.kind = "simp";
    const side = oneSide(W, text); if (!side) return null;
    const v = varOf({ s: [side] }), hasG = side.some((t) => t.g);
    if (!hasG && !needsCombine(side)) return null;
    W.steps.push({ move: "start", title: "The problem", why: "Simplify it first. Then compare each choice with the simple form.", seq: [{ a: "row", row: { t: "line", cells: [sideDT(side), null, null], sem: { f: formOf(side) } } }] });
    let line = { s: [side], r: [] };
    if (hasG) line = stepDistribute(W, line);
    if (needsCombine(line.s[0])) line = stepCombine(W, line);
    chainRows(W, 1);
    const fl = formOf(line.s[0]), simpleT = formSideT(fl, v);
    const res = choices.map((c) => {
        const cs = oneSide(W, c.x); if (!cs) throw new Error("choice");
        const fc = formOf(cs), same = fc.a.eq(fl.a) && fc.b.eq(fl.b);
        const work = cs.some((t) => t.g) || needsCombine(cs) ? (cs.some((t) => t.g) ? "Distribute: " : "Combine like terms: ") + c.x + " becomes " + formSideT(fc, v) + ". " : "";
        W.steps.push({ move: "choice", title: (c.label ? c.label + ". " : "") + (same ? "Same" : "Not the same"), why: work + (same ? "That matches " + simpleT + "." : formSideT(fc, v) + " is not " + simpleT + "."),
            seq: [{ a: "row", row: { t: "line", cells: [R([(c.label ? c.label + ". " : "") + c.x + " " + (same ? "=" : "≠") + " " + simpleT + (same === (which === "same") ? " ✓" : "")]), null, null], sem: { truth: true }, chain: true, c: same === (which === "same") ? "w-check" : undefined } }] });
        return { c, same };
    });
    const hits = res.filter((r) => r.same === (which === "same"));
    if (hits.length !== 1) throw new Error("key");
    const got = hits[0].c.label || hits[0].c.x;
    if (String(item.a).trim() !== got) throw new Error("key");
    answerStep(W, item.a, which === "same" ? "Only " + got + " is the same as " + simpleT + "." : "Every other choice simplifies to " + simpleT + ". " + got + " doesn't.");
    return true;
}

/* ---------- lines and proportions: rate of change from two points, the starting value, the function, k = y ÷ x ---------- */
const nDT = (W, q) => numDT(q, W.dec && terminates(q) ? "dec" : "frac");
const nTx = (W, q) => dtText(nDT(W, q));
const pDT = (W, q) => (q.sign < 0 ? R(["(", nDT(W, q), ")"]) : nDT(W, q));
const pTx = (W, q) => dtText(pDT(W, q));
const ptDT = (W, p) => R(["(", nDT(W, p[0]), ", ", nDT(W, p[1]), ")"]);
const ptTx = (W, p) => dtText(ptDT(W, p));
const rowT = (items, truth, o) => Object.assign({ t: "line", cells: [R(items), null, null], sem: { truth: !!truth }, chain: true }, o || {});
const qIn = (t) => (t instanceof Q ? t : qOf(String(t)));
/** m·v + b written out: "4x + 3", "−20x + 500", or "500 − 20x" with bFirst */
function mbDT(W, m, b, v, bFirst) {
    const mv = (mm) => (mm.eq(ONE) ? [v] : mm.eq(ONE.neg()) ? [MINUS + v] : [nDT(W, mm), v]);
    if (m.zero) return R([nDT(W, b)]);
    if (b.zero) return R(mv(m));
    if (bFirst) return R([nDT(W, b), m.sign < 0 ? " " + MINUS + " " : " + ", ...mv(m.abs())]);
    return R([...mv(m), b.sign < 0 ? " " + MINUS + " " : " + ", nDT(W, b.abs())]);
}
/** "m(x) + b = y ✓" with the numbers in, for a check row */
const plugDT = (W, m, b, x, y) => R([pDT(W, m), "(", nDT(W, x), ")", b.zero ? "" : b.sign < 0 ? " " + MINUS + " " : " + ", b.zero ? "" : nDT(W, b.abs()), " = ", nDT(W, y), " ✓"]);
/** "y = 4x + 3", "C(g) = 25g + 250": the key has to be the same line */
function keyLine(W, a, fy, v, m, b) {
    const k = String(a).replace(/(\d),(\d{3})/g, "$1$2").replace(/§/g, "").match(/^\s*(.+?)\s*=\s*(.+?)\s*$/);
    if (!k || k[1].replace(/\s/g, "") !== fy.replace(/\s/g, "")) throw new Error("key");
    const at = (x) => valueOf(parseExpr(W, k[2], { [v]: x }));
    if (!at(ZERO).eq(b) || !at(ONE).eq(m.add(b)) || !at(new Q(7)).eq(m.mul(new Q(7)).add(b))) throw new Error("key");
}
const keyNum = (a) => { const k = readKey(a); return k && (k.kind === "num" || k.kind === "eq") ? k.v : null; };
const hasNum = (a, q) => new RegExp("(^|[^\\d.])" + numText(q.abs(), "dec").replace(".", "\\.") + "(0?)([^\\d.]|$)").test(String(a).replace(/(\d),(\d{3})/g, "$1$2"));
function storyRow(item, marks) { return { a: "row", row: { t: "pic", pic: { kind: "story", text: item.q, marks: marks || [] } } }; }

/** A linear function from two points (or from its rate and start): the rate of change, the starting value, the function, and what the question asks. */
function lineSetup(W, item, o) {
    W.kind = "rel"; W.cols = 3;
    const v = o.v || "x", fy = o.fy || "y";
    const pts = (o.pts || []).map((p) => p.map(qIn));
    if (pts.some((p) => p.some((t) => !t))) return null;
    W.dec = !!o.dec || (o.pts || []).some((p) => p.some((t) => /\./.test(String(t)))) || /\./.test(String(o.m)) || /\./.test(String(o.b));
    let m = o.m != null ? qIn(o.m) : null, b = o.b != null ? qIn(o.b) : null;
    const ask = o.ask || "eq";
    if (o.story) W.steps.push({ move: "story", title: "Read the story", why: o.why0 || "Find the numbers in the story and what each one means.", seq: [storyRow(item, o.story)] });
    if (pts.length >= 2) {
        W.steps.push({ move: "start", title: o.story ? "Write the points" : "The points", why: o.ptsWhy || (o.story ? "Each pair is (" + v + ", " + fy + ")." : "Use two points on the line. Each one is (" + v + ", " + fy + ")."),
            seq: [{ a: "row", row: rowT(pts.flatMap((p, i) => (i ? [" and ", ptDT(W, p)] : [ptDT(W, p)])), true) }] });
    }
    if (m == null) {
        if (pts.length < 2) return null;
        const [[x1, y1], [x2, y2]] = pts;
        if (x1.eq(x2)) return null;
        const dy = y2.sub(y1), dx = x2.sub(x1); m = dy.div(dx);
        W.steps.push({ move: "slope", title: "Find the rate of change", why: o.mWhy || ("Rate of change = the change in " + fy + " ÷ the change in " + v + ". " + fy + " goes from " + nTx(W, y1) + " to " + nTx(W, y2) + ", a change of " + nTx(W, dy) + ". " + v + " goes from " + nTx(W, x1) + " to " + nTx(W, x2) + ", a change of " + nTx(W, dx) + "."),
            seq: [{ a: "row", row: rowT(["m = ", F(nTx(W, y2) + " − " + pTx(W, y1), nTx(W, x2) + " − " + pTx(W, x1)), " = ", ...(dx.eq(ONE) ? [] : [F(nTx(W, dy), nTx(W, dx)), " = "]), nDT(W, m)], m.mul(dx).eq(dy)) }] });
    } else if (o.mWhy) W.steps.push({ move: "slope", title: "The rate of change", why: o.mWhy, seq: [{ a: "row", row: rowT(["m = ", nDT(W, m)], true) }] });
    if (ask === "m") {
        if (o.check !== false && pts.length > 2) W.steps.push({ move: "check", title: "Check", why: "Each step to the next point gives the same rate.", seq: pts.slice(1).map((p, i) => ({ a: "row", row: rowT([F(nTx(W, p[1]) + " − " + pTx(W, pts[i][1]), nTx(W, p[0]) + " − " + pTx(W, pts[i][0])), " = ", nDT(W, m), " ✓"], p[1].sub(pts[i][1]).eq(m.mul(p[0].sub(pts[i][0]))), { c: "w-check" }) })) });
        const k = keyNum(item.a); if (!k || !k.eq(m)) throw new Error("key");
        answerStep(W, item.a, o.end || ""); return true;
    }
    if (ask === "at") {
        const [x2, y2] = pts[pts.length - 1], x3 = qIn(o.at), y3 = y2.add(m.mul(x3.sub(x2))), dx = x3.sub(x2);
        W.steps.push({ move: "at", title: "Find " + (o.atName || fy), why: "From " + v + " = " + nTx(W, x2) + " to " + v + " = " + nTx(W, x3) + " is " + nTx(W, dx) + " more. Each 1 more adds " + nTx(W, m) + ", so add " + nTx(W, m) + " × " + nTx(W, dx) + ".",
            seq: [{ a: "row", row: rowT([(o.atName || fy) + " = ", nDT(W, y2), " + ", nDT(W, m), "(", nDT(W, dx), ") = ", nDT(W, y3)], true) }] });
        const k = readKey(item.a); if (!k || k.kind !== "eq" || !k.v.eq(y3)) throw new Error("key");
        answerStep(W, item.a, o.end || ""); return true;
    }
    if (b == null) {
        const p0 = pts.find((p) => p[0].zero);
        if (p0) {
            b = p0[1];
            W.steps.push({ move: "start0", title: "Find the starting value", why: o.bWhy || ("The starting value b is " + fy + " when " + v + " = 0. The point " + ptTx(W, p0) + " says it's " + nTx(W, b) + "."), seq: [{ a: "row", row: rowT(["b = ", nDT(W, b)], true) }] });
        } else {
            const [x1, y1] = pts[0], mx = m.mul(x1); b = y1.sub(mx);
            W.steps.push({ move: "start0", title: "Find the starting value", why: o.bWhy || ("Put m = " + nTx(W, m) + " and the point " + ptTx(W, pts[0]) + " into " + fy + " = m" + v + " + b. " + pTx(W, m) + " × " + pTx(W, x1) + " = " + nTx(W, mx) + ", so b = " + nTx(W, y1) + " − " + pTx(W, mx) + " = " + nTx(W, b) + "."),
                seq: [{ a: "row", row: rowT([nDT(W, y1), " = ", pDT(W, m), "(", nDT(W, x1), ") + b"], true) }, { a: "row", row: rowT([nDT(W, y1), " = ", nDT(W, mx), " + b"], true) },
                    { a: "row", row: rowT(["b = ", nDT(W, y1), " − ", pDT(W, mx), " = ", nDT(W, b)], y1.sub(mx).eq(b)) }] });
        }
    } else if (o.bWhy) W.steps.push({ move: "start0", title: "The starting value", why: o.bWhy, seq: [{ a: "row", row: rowT(["b = ", nDT(W, b)], true) }] });
    if (ask === "b") {
        const k = keyNum(item.a); if (!k || !k.eq(b)) throw new Error("key");
        if (pts.length >= 2 && !pts.some((p) => p[0].zero)) W.steps.push({ move: "check", title: "Check", why: "Use the other point: " + pTx(W, m) + " × " + pTx(W, pts[1][0]) + " + " + pTx(W, b) + " should be " + nTx(W, pts[1][1]) + ".", seq: [{ a: "row", row: rowT([plugDT(W, m, b, pts[1][0], pts[1][1])], m.mul(pts[1][0]).add(b).eq(pts[1][1]), { c: "w-check" }) }] });
        answerStep(W, item.a, o.end || ""); return true;
    }
    if (ask === "mb") {
        if (!hasNum(item.a, m) || !hasNum(item.a, b)) throw new Error("key");
        answerStep(W, item.a, o.end || ""); return true;
    }
    W.steps.push({ move: "write", title: "Write the function", why: o.eqWhy || (fy + " = m" + v + " + b, with m = " + nTx(W, m) + " and b = " + nTx(W, b) + "."), seq: [{ a: "row", row: rowT([fy + " = ", mbDT(W, m, b, v, o.bFirst)], true) }] });
    const others = pts.filter((p) => !p[0].zero).slice(-2);
    if (others.length) W.steps.push({ move: "check", title: "Check", why: "Put " + (others.length > 1 ? "the points" : "the point") + " in. " + (others.length > 1 ? "Each one comes out right." : "It comes out right."),
        seq: others.map((p) => ({ a: "row", row: rowT([plugDT(W, m, b, p[0], p[1])], m.mul(p[0]).add(b).eq(p[1]), { c: "w-check" }) })) });
    if (ask === "zero") {
        const z = b.div(m).neg();
        W.steps.push({ move: "zero", title: o.zeroTitle || "Set " + fy + " to 0", why: o.zeroWhy || ("Set the function equal to 0 and solve for " + v + "."),
            seq: [{ a: "row", row: rowT(["0 = ", mbDT(W, m, b, v)], true) }, { a: "row", row: rowT([nDT(W, m.neg()), v, " = ", nDT(W, b)], true) },
                { a: "row", row: rowT([v + " = ", nDT(W, b), " ÷ ", nDT(W, m.neg()), " = ", numDT(z, "mixed")], m.mul(z).add(b).zero) }] });
        const k = keyNum(item.a); if (!k || !k.eq(z)) throw new Error("key");
        answerStep(W, item.a, o.end || ""); return true;
    }
    keyLine(W, item.a, fy, v, m, b);
    answerStep(W, item.a, o.end || "");
    return true;
}

/** Proportional or not: y ÷ x for every point. k is the constant of proportionality. */
function propSetup(W, item, o) {
    W.kind = "rel"; W.cols = 3;
    const v = o.v || "x", fy = o.fy || "y", ask = o.ask || "k";
    W.dec = !!o.dec || (o.pts || []).some((p) => p.some((t) => /\./.test(String(t))));
    if (o.story) W.steps.push({ move: "story", title: "Read the story", why: o.why0 || "Find the numbers in the story and what each one means.", seq: [storyRow(item, o.story)] });
    const yesNo = (yes) => { const s = String(item.a).trim(); if (!(yes ? /^Yes\b/ : /^No\b/).test(s)) throw new Error("key"); };
    if (ask === "sets") {
        const sets = (item.choices || []).map((c) => ({ c: String(c), pts: pairsIn(String(c)).map((p) => p.map(qIn)) }));
        if (!sets.length || sets.some((s) => s.pts.length < 2)) return null;
        const prop = (s) => s.pts.every((p) => !p[0].zero && p[1].div(p[0]).eq(s.pts[0][1].div(s.pts[0][0])));
        const good = sets.filter(prop);
        if (good.length !== 1 || good[0].c !== String(item.a)) throw new Error("key");
        W.steps.push({ move: "start", title: "Divide y by x in each set", why: "Proportional means y ÷ x is the same for every pair. Only one set does that.",
            seq: sets.flatMap((s) => [{ a: "row", row: rowT(["{" + s.c + "}"], true) }, { a: "row", row: rowT(s.pts.some((p) => p[0].zero) ? ["(0, " + nTx(W, s.pts.find((p) => p[0].zero)[1]) + ") is not (0, 0) ✗"] : ["y ÷ x: ", ...s.pts.flatMap((p, i) => [i ? ", " : "", nDT(W, p[1].div(p[0]))]), prop(s) ? " ✓" : " ✗"], true, prop(s) ? { c: "w-check" } : undefined) }]) });
        answerStep(W, item.a, "In that set y is always " + nTx(W, good[0].pts[0][1].div(good[0].pts[0][0])) + " times x."); return true;
    }
    if (ask === "eqs") {
        const cs = o.choices.map((c) => { const side = oneSide(W, c.x.split("=")[1]); const f = side ? formOf(side) : null; return Object.assign({}, c, { f }); });
        if (cs.some((c) => !c.f)) return null;
        const ok = cs.filter((c) => c.f.b.zero && !c.f.a.zero);
        if (ok.length !== 1 || String(item.a).trim() !== ok[0].label) throw new Error("key");
        W.steps.push({ move: "start", title: "Look for y = kx", why: "A proportional equation is y = kx: y is a number times x, with nothing added or taken away. Adding or taking away a number moves the line off (0, 0).",
            seq: cs.map((c) => ({ a: "row", row: rowT([c.label + ". " + c.x + (c.f.b.zero ? ": y = kx with k = " + nTx(W, c.f.a) + " ✓" : ": " + (c.f.b.sign < 0 ? MINUS + " " : "+ ") + nTx(W, c.f.b.abs()) + " is added on ✗")], true, c.f.b.zero ? { c: "w-check" } : undefined) })) });
        answerStep(W, item.a, ""); return true;
    }
    if (ask === "fromEq") {
        const k = qIn(o.k);
        W.steps.push({ move: "start", title: "Read k from the equation", why: o.kWhy || ("In y = kx, k is the number multiplied by x. Here " + o.eq + ", so k = " + nTx(W, k) + ". It is also the unit rate: " + fy + " for 1 " + (o.unit || v) + "."), seq: [{ a: "row", row: rowT([o.eq], true) }, { a: "row", row: rowT(["k = ", nDT(W, k)], true) }] });
        const kk = keyNum(item.a); if (!kk || !kk.eq(k)) throw new Error("key");
        answerStep(W, item.a, ""); return true;
    }
    const pts = o.pts.map((p) => p.map(qIn));
    if (pts.some((p) => p.some((t) => !t) || p[0].zero)) return null;
    if (!o.story) W.steps.push({ move: "start", title: "The points", why: o.ptsWhy || "Each pair is (" + v + ", " + fy + ").", seq: [{ a: "row", row: rowT(pts.flatMap((p, i) => (i ? [", ", ptDT(W, p)] : [ptDT(W, p)])), true) }] });
    else if (o.ptsWhy) W.steps.push({ move: "start", title: "Write the pair", why: o.ptsWhy, seq: [{ a: "row", row: rowT(pts.flatMap((p, i) => (i ? [", ", ptDT(W, p)] : [ptDT(W, p)])), true) }] });
    const ks = pts.map((p) => p[1].div(p[0])), same = ks.every((k) => k.eq(ks[0])), k = ks[0];
    W.steps.push({ move: "ratio", title: pts.length > 1 ? "Divide y by x for each pair" : "Divide " + fy + " by " + v, why: o.kWhy || (pts.length > 1 ? "In a proportional relationship " + fy + " ÷ " + v + " is the same for every pair. That number is the constant of proportionality, k." + (same ? "" : " Here the answers are not all the same.") : fy + " ÷ " + v + " gives the constant of proportionality, k: how much " + fy + " for 1 " + (o.unit || v) + "."),
        seq: pts.map((p, i) => ({ a: "row", row: rowT([nDT(W, p[1]), " ÷ ", pDT(W, p[0]), " = ", nDT(W, ks[i])], p[1].eq(ks[i].mul(p[0]))) })) });
    if (ask === "yes") {
        yesNo(same);
        if (same) W.steps.push({ move: "k", title: "The same every time", why: "Every pair gives " + nTx(W, k) + ", so y = " + nTx(W, k) + "x. It is proportional.", seq: [{ a: "row", row: rowT(["k = ", nDT(W, k), " ✓"], true, { c: "w-check" }) }] });
        answerStep(W, item.a, same ? "" : "The quotients are not the same, so it is not proportional."); return true;
    }
    if (!same) throw new Error("not proportional");
    if (ask === "k") {
        const kk = keyNum(item.a); if (!kk || !kk.eq(k)) throw new Error("key");
        answerStep(W, item.a, o.end || ""); return true;
    }
    if (ask === "unit") {
        W.steps.push({ move: "unit", title: "The point at " + v + " = 1", why: o.unitWhy || ("At " + v + " = 1, " + fy + " = k = " + nTx(W, k) + "."), seq: [{ a: "row", row: rowT(["(1, ", nDT(W, k), ")"], true) }] });
        if (String(item.a).replace(/\s/g, "").indexOf("(1," + nTx(W, k).replace(/\s/g, "") + ")") !== 0) throw new Error("key");
        answerStep(W, item.a, o.end || ""); return true;
    }
    W.steps.push({ move: "write", title: "Write the equation", why: o.eqWhy || (fy + " = k" + v + " with k = " + nTx(W, k) + "."), seq: [{ a: "row", row: rowT([fy + " = ", mbDT(W, k, ZERO, v)], true) }] });
    keyLine(W, item.a, fy, v, k, ZERO);
    answerStep(W, item.a, o.end || "");
    return true;
}

/** Linear or not, from a table: equal steps in x, so compare the changes in y. */
function linTableSetup(W, item, pts0) {
    W.kind = "rel"; W.cols = 3;
    const pts = pts0.map((p) => p.map(qIn));
    if (pts.length < 3 || pts.some((p) => p.some((t) => !t))) return null;
    const dx = pts[1][0].sub(pts[0][0]);
    if (pts.some((p, i) => i && !p[0].sub(pts[i - 1][0]).eq(dx))) return null;
    const ds = pts.slice(1).map((p, i) => p[1].sub(pts[i][1])), lin = ds.every((d) => d.eq(ds[0]));
    W.steps.push({ move: "start", title: "The table", why: "x goes up by " + nTx(W, dx) + " each time. A linear function changes y by the same amount for each equal step in x.", seq: [{ a: "row", row: rowT(pts.flatMap((p, i) => (i ? [", ", ptDT(W, p)] : [ptDT(W, p)])), true) }] });
    W.steps.push({ move: "diff", title: "Find each change in y", why: "Subtract each y from the next one.", seq: pts.slice(1).map((p, i) => ({ a: "row", row: rowT([nDT(W, p[1]), " − ", pDT(W, pts[i][1]), " = ", nDT(W, ds[i])], true) })) });
    W.steps.push({ move: "decide", title: lin ? "The same every time" : "Not the same", why: lin ? "y changes by " + nTx(W, ds[0]) + " every time, so it is linear." : "y changes by " + ds.map((d) => (d.sign < 0 ? "" : "+") + nTx(W, d)).join(", ") + ". The changes are not the same, so it is non-linear.",
        seq: [{ a: "row", row: rowT([ds.map((d) => (d.sign < 0 ? "" : "+") + nTx(W, d)).join(", ") + (lin ? ": the same ✓" : ": not the same")], true, lin ? { c: "w-check" } : undefined) }] });
    if (!(lin ? /^Linear\b/ : /^Non-linear\b/).test(String(item.a).trim())) throw new Error("key");
    answerStep(W, item.a, "");
    return true;
}

/** Two unit rates, each one amount ÷ another: work out both, then pick the lower (or higher), and the difference when asked. */
function ratesSetup(W, item, o) {
    W.kind = "rel"; W.cols = 3; W.dec = true;
    if (o.story) W.steps.push({ move: "story", title: "Read the story", why: o.why0 || "Find each amount and what it is per.", seq: [storyRow(item, o.story)] });
    const rs = o.rates.map((r) => { const a = qIn(r.top), b = qIn(r.bot), v = a.div(b); return Object.assign({}, r, { a, b, v }); });
    if (rs.some((r) => !terminates(r.v))) return null;
    rs.forEach((r) => {
        const aD = numDT(r.a, /\./.test(r.top) ? "dec" : "mixed"), bD = numDT(r.b, /\./.test(r.bot) ? "dec" : "mixed"), flip = !r.b.int && !/\./.test(r.bot);
        const mid = flip ? [/\./.test(r.top) || r.a.int ? aD : F(String(r.a.n), String(r.a.d)), " × ", F(String(r.b.d), String(r.b.n)), " = "] : [];
        W.steps.push({ move: "rate", title: r.label + ": divide", why: o.rateWhy || (r.label + ": " + (o.per || "amount ÷ count") + "." + (flip ? (r.b.n > r.b.d ? " " + dtText(bD) + " = " + r.b.n + "/" + r.b.d + "." : "") + " Dividing by " + r.b.n + "/" + r.b.d + " is the same as multiplying by its flip, " + r.b.d + "/" + r.b.n + "." : "") + " " + dtText(aD) + " ÷ " + dtText(bD) + " = " + nTx(W, r.v) + "."),
            seq: [{ a: "row", row: rowT([aD, " ÷ ", bD, " = ", ...mid, nDT(W, r.v)], r.v.mul(r.b).eq(r.a)) }] });
    });
    const sorted = rs.slice().sort((x, y) => x.v.cmp(y.v)), win = o.pick === "high" ? sorted[sorted.length - 1] : sorted[0], other = win === sorted[0] ? sorted[sorted.length - 1] : sorted[0];
    if (win.v.eq(other.v)) return null;
    const d = win.v.sub(other.v).abs();
    W.steps.push({ move: "cmp", title: "Compare", why: nTx(W, win.v) + " is " + (o.pick === "high" ? "more" : "less") + " than " + nTx(W, other.v) + ", so " + win.label + " is " + (o.word || (o.pick === "high" ? "higher" : "lower")) + "." + (o.diff ? " The difference is " + nTx(W, sorted[sorted.length - 1].v) + " − " + nTx(W, sorted[0].v) + " = " + nTx(W, d) + "." : ""),
        seq: [{ a: "row", row: rowT([win.label + " ✓" + (o.diff ? ", by " : ""), ...(o.diff ? [nDT(W, d)] : [])], true, { c: "w-check" }) }] });
    const s = String(item.a).trim();
    if (o.diffOnly) { const k = keyNum(s); if (!k || !k.eq(d)) throw new Error("key"); }
    else if (s.indexOf(win.label) !== 0 || (o.diff && !hasNum(s, d))) throw new Error("key");
    answerStep(W, item.a, o.end || "");
    return true;
}

/** Compare two linear functions: work out each rate of change and starting value, then pick. */
function cmpSetup(W, item, o) {
    W.kind = "rel"; W.cols = 3;
    W.dec = (o.fns || []).some((f) => /\./.test(JSON.stringify(f)));
    if (o.story) W.steps.push({ move: "story", title: "Read the story", why: o.why0 || "Find what each one starts at and how much it changes each time.", seq: [storyRow(item, o.story)] });
    const fns = o.fns.map((f) => {
        const fo = { label: f.label, v: f.v || "x" };
        if (f.pts) {
            const pts = f.pts.map((p) => p.map(qIn)), [[x1, y1], [x2, y2]] = pts, m = y2.sub(y1).div(x2.sub(x1)), b = y1.sub(m.mul(x1));
            const rows = [rowT(["m = ", F(nTx(W, y2) + " − " + pTx(W, y1), nTx(W, x2) + " − " + pTx(W, x1)), " = ", F(nTx(W, y2.sub(y1)), nTx(W, x2.sub(x1))), " = ", nDT(W, m)], m.mul(x2.sub(x1)).eq(y2.sub(y1)))];
            if (o.ask !== "m" && o.ask !== "steep") rows.push(x1.zero ? rowT(["b = ", nDT(W, b)], true) : rowT(["b = ", nDT(W, y1), " − ", pDT(W, m), "(", nDT(W, x1), ") = ", nDT(W, b)], true));
            return Object.assign(fo, { m, b, title: f.label + ": use the points", why: f.label + " goes through " + pts.map((p) => ptTx(W, p)).join(" and ") + ". Rate of change = change in y ÷ change in x." + (o.ask !== "m" && o.ask !== "steep" ? (x1.zero ? " At x = 0 it is " + nTx(W, b) + ", so b = " + nTx(W, b) + "." : " Then b = y − mx for one point.") : ""), rows });
        }
        const m = qIn(f.m), b = qIn(f.b);
        return Object.assign(fo, { m, b, title: f.label + ": read it", why: f.why || (f.eq ? f.label + " is " + f.eq + ". The number times x is the rate of change, and the number added on is the starting value." : f.label + " has m = " + nTx(W, m) + " and b = " + nTx(W, b) + "."), rows: [...(f.eq ? [rowT([f.eq], true)] : []), rowT(["m = ", nDT(W, m)], true), ...(o.ask === "m" || o.ask === "steep" ? [] : [rowT(["b = ", nDT(W, b)], true)])] });
    });
    fns.forEach((f) => W.steps.push({ move: "fn", title: f.title, why: f.why, seq: f.rows.map((row) => ({ a: "row", row })) }));
    const [A, B] = fns, s = String(item.a).trim();
    let win, why;
    if (o.ask === "m") { const c = A.m.cmp(B.m); if (!c) return null; win = c > 0 ? A : B; why = nTx(W, win.m) + " is more than " + nTx(W, (win === A ? B : A).m) + ", so " + win.label + " changes faster."; }
    else if (o.ask === "b") { const c = A.b.cmp(B.b); if (!c) return null; win = c > 0 ? A : B; why = nTx(W, win.b) + " is more than " + nTx(W, (win === A ? B : A).b) + ", so " + win.label + " starts higher."; }
    else if (o.ask === "steep") { const c = A.m.abs().cmp(B.m.abs()); if (!c) return null; win = c > 0 ? A : B; why = "Steeper means the rate of change is farther from 0. " + nTx(W, win.m) + " is farther from 0 than " + nTx(W, (win === A ? B : A).m) + "."; }
    else if (o.ask === "both") {
        if (!A.m.eq(B.m) || A.b.eq(B.b) || !hasNum(s, A.m) || !hasNum(s, A.b) || !hasNum(s, B.b) || !/same slope/.test(s)) throw new Error("key");
        W.steps.push({ move: "cmp", title: "Compare", why: "Both have rate of change " + nTx(W, A.m) + ". The starting values are " + nTx(W, A.b) + " and " + nTx(W, B.b) + ", so the lines are parallel.", seq: [{ a: "row", row: rowT(["m: " + nTx(W, A.m) + " and " + nTx(W, B.m) + ", the same"], true) }, { a: "row", row: rowT(["b: " + nTx(W, A.b) + " and " + nTx(W, B.b) + ", different"], true) }] });
        answerStep(W, item.a, ""); return true;
    }
    if (s.indexOf(win.label) !== 0) throw new Error("key");
    W.steps.push({ move: "cmp", title: "Compare", why, seq: [{ a: "row", row: rowT([win.label + " ✓"], true, { c: "w-check" }) }] });
    answerStep(W, item.a, o.end || "");
    return true;
}

/* ---------- relations: is it a function? ---------- */
const MINUS_RE = /[−-]/g;
const sameNum = (a, b) => { const x = qOf(String(a)), y = qOf(String(b)); return x && y ? x.eq(y) : String(a).replace(MINUS_RE, "-").trim() === String(b).replace(MINUS_RE, "-").trim(); };
function pairsIn(text) {
    const out = [], re = /\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)/g; let m;
    while ((m = re.exec(text))) out.push([m[1], m[2]]);
    return out;
}
function listIn(text) { return text.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean); }
/** The input → output pairs a "Is it a function?" problem gives, with how they were given. null when it is not one. */
function relParse(q) {
    let m;
    if (!/a function(?: of x)?\??(?: Explain\.)?$/.test(q) || /^Which|what must|Which value/.test(q)) return null;
    if ((m = q.match(/^Is (.+?) \(for example (\(.+\))\) a function of x\?$/))) return { from: "example", rule: m[1], pairs: pairsIn(m[2]) };
    if ((m = q.match(/\{(\(.+\))\}/))) return { from: "set", pairs: pairsIn(m[1]) };
    if ((m = q.match(/x: ([^a-z]+?) and (?:outputs )?y: ([^a-z]+?)\. /))) {
        const xs = listIn(m[1]), ys = listIn(m[2]);
        return xs.length === ys.length && xs.length > 1 ? { from: "table", pairs: xs.map((x, i) => [x, ys[i]]) } : null;
    }
    if ((m = q.match(/sends (.+?)\. Is it/))) {
        const pairs = m[1].split(/\s*,\s*/).map((p) => p.split(/\s*→\s*/));
        return pairs.every((p) => p.length === 2) ? { from: "map", pairs } : null;
    }
    return null;
}
/** Which inputs come up more than once, and whether they keep the same output. */
function repeats(pairs) {
    const by = new Map();
    pairs.forEach(([x, y], i) => { const k = [...by.keys()].find((z) => sameNum(z, x)); if (k == null) by.set(x, [i]); else by.get(k).push(i); });
    const out = [];
    by.forEach((idx, x) => { if (idx.length > 1) out.push({ x, idx, ys: idx.map((i) => pairs[i][1]), clash: idx.some((i) => !sameNum(pairs[i][1], pairs[idx[0]][1])) }); });
    return out;
}
const listWords = (xs, or) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + (or ? " or " : " and ") + xs[xs.length - 1]);
const tidyNum = (s) => String(s).replace(/-/g, MINUS);
function pairRows(W, pairs) {
    return pairs.map(([x, y]) => {
        const kx = key(W), ky = key(W);
        return { kx, ky, row: { t: "line", cells: [R([tidyNum(x)], { k: kx }), "→", R([tidyNum(y)], { k: ky })] } };
    });
}
function relSetup(W, item, rel) {
    W.kind = "rel"; W.cols = 3;
    const keyYes = /^yes\b/i.test(String(item.a)), keyNo = /^no\b/i.test(String(item.a));
    if (!keyYes && !keyNo) return null;
    const rows = pairRows(W, rel.pairs), rep = repeats(rel.pairs), clash = rep.filter((r) => r.clash);
    const ok = !clash.length;
    if (ok !== keyYes) throw new Error("key");
    // a key that names the input that breaks the rule must name the one we found
    const named = String(item.a).match(/(?:input|x =)\s*([−-]?\d+(?:\.\d+)?)/);
    if (named && !clash.some((r) => sameNum(r.x, named[1]))) throw new Error("key");
    const how = rel.from === "set" || rel.from === "example" ? "In each pair (x, y), x is the input and y is the output." : rel.from === "table" ? "Each x is an input, and the y under it is its output." : "Each arrow goes from an input to its output.";
    W.steps.push({ move: "pairs", title: "Inputs and outputs", why: "A function gives each input exactly one output. " + how + " Write them one per line.", seq: rows.map((r) => ({ a: "row", row: r.row })) });
    const outsSeen = new Map();
    rel.pairs.forEach(([, y], i) => { const k = [...outsSeen.keys()].find((z) => sameNum(z, y)); if (k == null) outsSeen.set(y, [i]); else outsSeen.get(k).push(i); });
    const outRep = [...outsSeen.entries()].filter(([, idx]) => idx.length > 1);
    const seq = [], why = [];
    if (clash.length) {
        clash.forEach((r) => { seq.push({ a: "hl", ks: r.idx.map((i) => rows[i].kx), tone: "x" }); seq.push({ a: "hl", ks: r.idx.map((i) => rows[i].ky), tone: "n" }); });
        why.push(clash.map((r) => "Input " + tidyNum(r.x) + " shows up " + (r.idx.length === 2 ? "twice" : r.idx.length + " times") + ", with outputs " + listWords(r.ys.map(tidyNum)) + ".").join(" ") + " One input with two outputs breaks the rule.");
    } else {
        rep.forEach((r) => seq.push({ a: "hl", ks: r.idx.map((i) => rows[i].kx), tone: "x" }));
        why.push(rep.length ? rep.map((r) => "Input " + tidyNum(r.x) + " shows up more than once, but it goes to " + tidyNum(r.ys[0]) + " every time.").join(" ") + " That's still one output."
            : "Each input shows up only once: " + listWords(rel.pairs.map((p) => tidyNum(p[0]))) + ". So each input has one output.");
        if (outRep.length) {
            outRep.forEach(([, idx]) => seq.push({ a: "hl", ks: idx.map((i) => rows[i].ky), tone: "n" }));
            why.push("Outputs can repeat: " + outRep.map(([y, idx]) => tidyNum(y) + " comes out " + (idx.length === 2 ? "twice" : idx.length + " times")).join(" and ") + ", and that's fine.");
        }
    }
    W.steps.push({ move: "repeat", title: "Look for a repeated input", why: why.join(" "), seq });
    W.steps.push({ move: "verdict", title: ok ? "It's a function" : "Not a function", why: ok ? "Every input has exactly one output." : "At least one input has two outputs.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "verdict", ok, text: ok ? "Function" : "Not a function" } } }] });
    answerStep(W, item.a, ok ? "Yes, it's a function." : "No, it's not a function.");
    return true;
}
/** "Which set of ordered pairs represents a function?": check each choice. */
function relChoiceSetup(W, item) {
    W.kind = "rel"; W.cols = 3;
    const ch = (item.choices || []).map((c) => ({ c, pairs: pairsIn(c) }));
    if (ch.length < 2 || ch.some((x) => x.pairs.length < 2 || !/^\{.*\}$/.test(x.c))) return null;
    W.steps.push({ move: "pairs", title: "The rule", why: "A function gives each input exactly one output. In each pair (x, y), x is the input. Check each set for an input that shows up twice with different outputs.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "fact", text: "Each input has exactly one output." } } }] });
    let good = [];
    ch.forEach((x, ci) => {
        const ks = x.pairs.map(() => key(W)), rk = key(W);
        const items = ["{"];
        x.pairs.forEach(([a, b], i) => { if (i) items.push(", "); items.push("(", R([tidyNum(a)], { k: ks[i] }), ", " + tidyNum(b) + ")"); });
        items.push("}");
        const clash = repeats(x.pairs).filter((r) => r.clash);
        const seq = [{ a: "row", row: { t: "line", cells: [R(items, { k: rk }), null, null] } }];
        if (clash.length) { clash.forEach((r) => seq.push({ a: "hl", ks: r.idx.map((i) => ks[i]), tone: "x" })); seq.push({ a: "strike", ks: [rk] }); }
        else { seq[0].row.c = "w-check"; seq[0].row.cells[0].r.push(" ✓"); seq.push({ a: "box", ks: [rk] }); good.push(x.c); }
        W.steps.push({ move: "choice", title: clash.length ? "Not this one" : "This one works", why: clash.length ? clash.map((r) => "Input " + tidyNum(r.x) + " goes to " + listWords(r.ys.map(tidyNum)) + ".").join(" ") + " Two outputs for one input." : "No input shows up twice, so each input has one output.", seq });
        void ci;
    });
    if (good.length !== 1 || String(item.a).trim() !== good[0]) throw new Error("key");
    answerStep(W, item.a, "Only this set gives each input one output.");
    return true;
}
/** "(2, 6), (4, 10), (k, 14), and (8, 18). Which value of k would make the relation NOT a function?" */
function relUnknownSetup(W, item, pairs, v) {
    W.kind = "rel"; W.cols = 3;
    const ui = pairs.findIndex((p) => p[0] === v); if (ui < 0) return null;
    const others = pairs.filter((_, i) => i !== ui);
    if (others.some((p) => !qOf(p[0]) || !qOf(p[1]))) return null;
    const rows = pairRows(W, pairs);
    const outY = pairs[ui][1];
    W.steps.push({ move: "pairs", title: "Inputs and outputs", why: "A function gives each input exactly one output. In each pair, the first number is the input.", seq: rows.map((r) => ({ a: "row", row: r.row })) });
    const used = others.filter((p) => !sameNum(p[1], outY)).map((p) => p[0]);
    W.steps.push({ move: "repeat", title: "What would break it", why: "It stops being a function when an input repeats with a different output. Only (" + v + ", " + tidyNum(outY) + ") can change, so " + v + " would have to be an input that's already there: " + listWords(used.map(tidyNum), true) + ".",
        seq: [{ a: "hl", ks: rows.filter((_, i) => i !== ui && used.includes(pairs[i][0])).map((r) => r.kx), tone: "x" }, { a: "hl", ks: [rows[ui].kx], tone: "n" }] });
    const ch = (item.choices || []).filter((c) => qOf(c));
    if (ch.length < 2) return null;
    const hit = ch.filter((c) => used.some((u) => sameNum(u, c)));
    if (hit.length !== 1 || !sameNum(hit[0], item.a)) throw new Error("key");
    const k0 = hit[0], other = others.find((p) => sameNum(p[0], k0));
    const kx = key(W), ky = key(W);
    W.steps.push({ move: "choice", title: "Check the choices", why: listWords(ch.filter((c) => c !== k0).map(tidyNum)) + " would be new inputs, so it stays a function. " + tidyNum(k0) + " is already an input with output " + tidyNum(other[1]) + ". Then " + tidyNum(k0) + " would go to both " + tidyNum(other[1]) + " and " + tidyNum(outY) + ".",
        seq: [{ a: "row", row: { t: "line", cells: [R([tidyNum(k0)], { k: kx }), "→", R([tidyNum(other[1]) + " and " + tidyNum(outY)], { k: ky })] } }, { a: "hl", ks: [ky], tone: "n" }, { a: "row", row: { t: "pic", pic: { kind: "verdict", ok: false, text: "Not a function when " + v + " = " + tidyNum(k0) } } }] });
    answerStep(W, item.a, v + " = " + tidyNum(k0) + " gives input " + tidyNum(k0) + " two outputs.");
    return true;
}
/** "{(−1, 3), (0, 5), (2, 9), (2, 3a − 3)}, what must the value of a be for this relation to be a function?" */
function relSolveSetup(W, item, pairs, v) {
    const rep = repeats(pairs).filter((r) => r.idx.length === 2);
    if (rep.length !== 1) return null;
    const [i1, i2] = rep[0].idx, ys = [pairs[i1][1], pairs[i2][1]];
    const ex = ys.find((y) => new RegExp("(?<![a-z])" + v + "(?![a-z])").test(y)), num = ys.find((y) => y !== ex);
    if (!ex || !num || !qOf(num)) return null;
    const rows = pairRows(W, pairs);
    const r = solveSetup(W, item, ex + " = " + num, { intro: { title: "Set the outputs equal", why: "A function gives each input one output. Input " + tidyNum(rep[0].x) + " shows up twice, with outputs " + tidyNum(num) + " and " + tidyNum(ex) + ". So they must be the same: " + tidyNum(ex) + " = " + tidyNum(num) + ".", rows: rows.map((x) => x.row) } });
    // light up the repeated input once its rows are written
    const st = W.steps.find((s) => s.move === "setup");
    if (st) st.seq.splice(rows.length, 0, { a: "hl", ks: [rows[i1].kx, rows[i2].kx], tone: "x" }, { a: "hl", ks: [rows[i1].ky, rows[i2].ky], tone: "n" });
    return r;
}

/** "Which set of three angle measures can form a triangle?": add each set and keep the one that makes 180°. */
function triChoiceSetup(W, item) {
    W.kind = "rel"; W.cols = 3;
    const ch = (item.choices || []).map((c) => ({ c, ns: c.split(/\s*,\s*/).map((x) => qOf(x.replace(/°/g, ""))) }));
    if (ch.length < 2 || ch.some((x) => x.ns.length !== 3 || x.ns.some((n) => !n))) return null;
    W.steps.push({ move: "fact", title: "Use the angle fact", why: "The three angles of a triangle always add up to 180°. Add each set and see which one makes 180°.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "fact", text: "The angles of a triangle add up to 180°." } } }] });
    const good = [];
    ch.forEach((x) => {
        const sum = x.ns.reduce((a, b) => a.add(b), ZERO), ok = sum.eq(180), rk = key(W), vk = key(W);
        const seq = [{ a: "row", row: { t: "line", cells: [R([x.ns.map((n) => numText(n)).join(" + ")], { k: rk }), "=", R([numText(sum) + "°" + (ok ? " ✓" : "")], { k: vk })], sem: { truth: true }, c: ok ? "w-check" : undefined } }];
        seq.push(ok ? { a: "box", ks: [vk] } : { a: "strike", ks: [rk] });
        if (ok) good.push(x.c);
        W.steps.push({ move: "choice", title: ok ? "This one works" : "Not this one", why: x.ns.map((n) => numText(n)).join(" + ") + " = " + numText(sum) + (ok ? ". That's exactly 180°." : ", not 180°."), seq });
    });
    if (good.length !== 1 || String(item.a).trim() !== good[0]) throw new Error("key");
    answerStep(W, item.a, "Only this set adds up to 180°.");
    return true;
}

/* ---------- word problems: write the expression or equation, then simplify ---------- */
const flatTerms = (side) => side.flatMap((t) => (t.g ? [t, ...t.g] : [t]));
const normT = (t) => String(t).replace(/[\s()]/g, "").replace(MINUS_RE, "-");
function storyPairs(side, marks) {
    const terms = flatTerms(side);
    return (marks || []).map((mk, i) => { const t = terms.find((x) => normT(termText(x, true)) === normT(mk[1]) || normT(termText(x, true)).replace(/^-/, "") === normT(mk[1]).replace(/^-/, "")); return t ? ["s" + i, t.k] : null; }).filter(Boolean);
}
/** The part of an answer key that is the expression: "1.17w, which represents …" → ["1.17w"], "p − 0.15p and 0.85p" → both. */
function keyForms(a) {
    const s = String(a).split(/;|,\s+(?=which|because|so|meaning)\b/)[0].trim();
    return s.split(/\s+and\s+/);
}
function simpStory(W, item, o) {
    W.kind = "simp";
    const side = oneSide(W, o.simp); if (!side) return null;
    const v = varOf({ s: [side] }), hasG = side.some((t) => t.g);
    if (!hasG && !needsCombine(side)) return null;
    const f0 = formOf(side);
    W.steps.push({ move: "story", title: "Read the story", why: o.why0 || "Find the numbers in the story and what each one means.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "story", text: item.q, marks: o.story || [] } } }] });
    const pairs = storyPairs(side, o.story);
    W.steps.push({ move: "setup", title: "Write the expression", why: o.write || ("Each piece of the story becomes a piece of the expression. " + v + " is " + (o.var || "the unknown") + "."),
        seq: [{ a: "row", row: { t: "line", cells: [sideDT(side), null, null], sem: { f: f0 } } }, ...(pairs.length ? [{ a: "fly", pairs, story: true }] : [])] });
    let line = { s: [side], r: [] };
    if (hasG) line = stepDistribute(W, line);
    if (needsCombine(line.s[0])) line = stepCombine(W, line);
    chainRows(W, 2);
    const fl = formOf(line.s[0]);
    if (o.wrap) {
        const Wq = new Q(o.wrap), grp = { c: Wq, v: null, g: line.s[0].map((t) => dup(W, t)), over: false, dec: false, k: key(W) };
        W.steps.push({ move: "wrap", title: "Times " + o.wrap, why: o.wrapWhy || "Multiply the sum by " + o.wrap + ".", seq: [{ a: "row", row: { t: "line", cells: [termDT(grp, true), null, null], sem: { truth: formOf([grp]).a.eq(fl.a.mul(Wq)) && formOf([grp]).b.eq(fl.b.mul(Wq)) }, chain: true, c: "w-check" } }] });
        const k = oneSide(W, item.a);
        if (!k || k.length !== 1 || !k[0].g || !k[0].c.eq(Wq) || !formOf(k[0].g).a.eq(fl.a) || !formOf(k[0].g).b.eq(fl.b)) throw new Error("key");
        answerStep(W, item.a, o.end || "");
        return true;
    }
    const forms = keyForms(item.a).map((p) => oneSide(W, p));
    if (!forms.length || forms.some((k) => !k || varOf({ s: [k] }) !== v)) throw new Error("key");
    const isEnd = (k) => !k.some((t) => t.g) && !needsCombine(k) && formOf(k).a.eq(fl.a) && formOf(k).b.eq(fl.b);
    const isStart = (k) => formOf(k).a.eq(f0.a) && formOf(k).b.eq(f0.b);
    if (!forms.some(isEnd) || !forms.every((k) => isEnd(k) || isStart(k))) throw new Error("key");
    answerStep(W, item.a, o.end || (forms.length > 1 ? "Both lines are the same expression, written two ways." : "One term of each kind: that's as simple as it gets."));
    return true;
}
/** A story that only asks for the equation or expression: write it from the story, and it must be the key. */
function writeStory(W, item, o) {
    const norm = (s) => String(s).replace(/§/g, "").replace(/(\d),(\d{3})/g, "$1$2").replace(/\s/g, "").replace(MINUS_RE, "-");
    if (norm(o.write) !== norm(item.a)) throw new Error("key");
    const isLine = /[=<>≤≥]/.test(o.write);
    let row, side;
    if (/\^/.test(o.write)) { W.kind = "rel"; row = { t: "line", cells: [supDT(o.write), null, null], chain: true }; side = []; }
    else if (isLine) { W.kind = "solve"; const line = parseLine(W, o.write); if (!line) return null; W.cols = line.s.length === 3 ? 5 : 3; row = lineRow(W, line); side = line.s.flat(); }
    else { W.kind = "simp"; side = oneSide(W, o.write); if (!side) return null; row = { t: "line", cells: [sideDT(side), null, null], sem: { f: formOf(side) } }; }
    W.steps.push({ move: "story", title: "Read the story", why: o.why0 || "Find the numbers in the story and what each one means.", seq: [{ a: "row", row: { t: "pic", pic: { kind: "story", text: item.q, marks: o.story || [] } } }] });
    const pairs = storyPairs(side, o.story);
    const noun = !isLine ? "expression" : /[<>≤≥]/.test(o.write) ? "inequality" : "equation";
    const wv = /\^/.test(o.write) ? (o.write.match(/\^\{?([a-z])/) || [])[1] : varOf(isLine ? parseLine(W, o.write) : { s: [side] });
    W.steps.push({ move: "setup", title: "Write the " + noun, why: o.why1 || ("Each piece of the story becomes a piece of the " + noun + ". " + (o.var ? wv + " is " + o.var + "." : "")),
        seq: [{ a: "row", row }, ...(pairs.length ? [{ a: "fly", pairs, story: true }] : [])] });
    answerStep(W, item.a, o.end || "");
    return true;
}

/** Words for a move, for chips and the list. */
export const MOVE_NAMES = { distribute: "Distribute", combine: "Combine like terms", both: "Both sides", divide: "Divide", reciprocal: "Reciprocal", flip: "Flip the sign", swap: "Put x first", clear: "Clear fractions", kcc: "Add the opposite", kcf: "Keep, change, flip", lcd: "Common denominator", cancel: "Cancel", numline: "Number line", story: "Story to equation", fact: "Angle fact", graph: "Graph", check: "Check", sub: "Plug in", gcf: "Find the GCF", factor: "Factor", pairs: "Inputs and outputs", longdiv: "Long division", stop: "It stops", percent: "Write it as a percent", shift: "Move the decimal point", repsub: "Subtract the copies", root: "Square roots", half: "Halfway point", tenths: "Try tenths", count: "Count", order: "Order", round: "Round", repeat: "Repeated input", verdict: "Decide", choice: "Check the choices", abs: "Absolute value", power: "Exponent", cfrac: "Complex fraction", expand: "Multiply it out", zero: "Get 0 on one side", zp: "Set each factor to 0", pick: "Keep what fits", wrap: "Multiply the sum" };
export { parseLine as _parseLine, parseExpr as _parseExpr, valueOf as _valueOf, sameAnswers as _sameAnswers, semOf as _semOf };
