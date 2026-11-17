/* ==========================================
   AnchorBoard — math tools for any whiteboard canvas.
   The model and the drawing only: no board state, no Firebase, no page layout.
   The board's whiteboard uses it through js/mathPad.js, and any other drawing
   surface (a student drawing pad, a game) can import the same two files.

   An item is a small plain object, saved as-is:
     { id, k (kind), x, y (centre, 0..1 of the canvas width / height), s (width, 0..1 of the
       canvas width), r (turn, degrees), ...settings for that kind }
   Sizes follow the canvas width, so a tool keeps its shape on a board and on a Chromebook.
   Original AnchorBoard tools; the ideas (number line, protractor, algebra tiles…) are classroom staples.
========================================== */

export const C = { ink: "#14213D", blue: "#10358A", pen: "#1552D6", sky: "#7FAEDD", skyFill: "rgba(127,174,221,.30)", amber: "#F2B33D", red: "#C62828", green: "#1B7F3B", paper: "#FFFFFF", glass: "rgba(235,243,252,.80)", grid: "#DCE7F5", grid2: "#B9CDE6" };
export const PLOT = [C.pen, C.red, C.green];
const FONT = '"Instrument Sans", system-ui, sans-serif';

/* What the Add menu offers, in groups. The key is passed to newItem(). */
export const MENU = [
    ["Graph and numbers", [["plane", "Coordinate plane"], ["numline", "Number line"], ["table", "Table"]]],
    ["Measure", [["ruler", "Ruler"], ["protractor", "Protractor"]]],
    ["Fractions", [["fracbar", "Fraction bar"], ["fraccircle", "Fraction circle"]]],
    ["Algebra tiles", [["tile:1", "+1"], ["tile:-1", "−1"], ["tile:x", "+x"], ["tile:-x", "−x"], ["tile:x2", "+x²"], ["tile:-x2", "−x²"]]],
    ["Shapes", [["rect", "Rectangle"], ["ellipse", "Circle"], ["tri", "Triangle"], ["rtri", "Right triangle"], ["seg", "Line segment"]]],
    ["Type", [["text", "Math text"]]]
];
export const NAMES = { plane: "Coordinate plane", numline: "Number line", table: "Table", ruler: "Ruler", protractor: "Protractor", fracbar: "Fraction bar", fraccircle: "Fraction circle", tile: "Algebra tile", rect: "Rectangle", ellipse: "Circle", tri: "Triangle", rtri: "Right triangle", seg: "Line segment", text: "Math text" };
const TILE_X = 0.09, TILE_THIN = 0.22;   // x-tile length (of the canvas width) and its thickness ratio; a 1-tile is thin × thin
export const FREE_SHAPE = { rect: 1, ellipse: 1, tri: 1, rtri: 1, seg: 1 };  // corner drag changes width and height separately

const rid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
const r4 = (v) => Math.round(v * 10000) / 10000;

export function newItem(key, at) {
    const p = at || { x: 0.5, y: 0.5 }, base = { id: rid(), x: p.x, y: p.y, r: 0 };
    if (key.startsWith("tile:")) { const t = key.slice(5), neg = t[0] === "-", tt = neg ? t.slice(1) : t; return Object.assign(base, { k: "tile", t: tt, neg, s: tt === "1" ? TILE_X * TILE_THIN : TILE_X }); }
    const d = {
        plane: { s: 0.3, xmin: -10, xmax: 10, ymin: -10, ymax: 10, fx: ["", "", ""] },
        numline: { s: 0.6, min: -10, max: 10, step: "1" },
        table: { s: 0.26, rows: 5, cols: 2, hd: "x, y" },
        ruler: { s: 0.5, n: 10 },
        protractor: { s: 0.34 },
        fracbar: { s: 0.5, n: 4, sh: 1, lab: true },
        fraccircle: { s: 0.18, n: 4, sh: 1, lab: true },
        rect: { s: 0.2, a: 0.6 }, ellipse: { s: 0.16, a: 1 }, tri: { s: 0.2, a: 0.85 }, rtri: { s: 0.2, a: 0.75 }, seg: { s: 0.25, a: 0 },
        text: { s: 0.2, txt: "", fs: 0.032 }
    }[key];
    if (!d) return null;
    return Object.assign(base, { k: key }, JSON.parse(JSON.stringify(d)));
}

/* Saved items come from another device (or anyone who can write the document): keep only what we know, in range. */
export function cleanItems(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    arr.slice(0, 80).forEach((o) => {
        if (!o || typeof o !== "object" || !NAMES[o.k]) return;
        const it = { id: String(o.id || rid()).slice(0, 12), k: o.k, x: r4(clamp(num(o.x, 0.5), -0.2, 1.2)), y: r4(clamp(num(o.y, 0.5), -0.2, 1.2)), s: r4(clamp(num(o.s, 0.2), 0.01, 1.6)), r: Math.round(num(o.r, 0) * 10) / 10 % 360 };
        const str = (v, n, d) => (typeof v === "string" ? v.slice(0, n) : d);
        switch (o.k) {
            case "plane": {
                let a = num(o.xmin, -10), b = num(o.xmax, 10), c = num(o.ymin, -10), e = num(o.ymax, 10);
                if (!(b > a)) { a = -10; b = 10; } if (!(e > c)) { c = -10; e = 10; }
                Object.assign(it, { xmin: clamp(a, -1e4, 1e4), xmax: clamp(b, -1e4, 1e4), ymin: clamp(c, -1e4, 1e4), ymax: clamp(e, -1e4, 1e4), fx: [0, 1, 2].map((i) => str((o.fx || [])[i], 80, "")) }); break;
            }
            case "numline": { let a = num(o.min, -10), b = num(o.max, 10); if (!(b > a)) { a = -10; b = 10; } Object.assign(it, { min: clamp(a, -1e5, 1e5), max: clamp(b, -1e5, 1e5), step: str(o.step, 12, "1") }); break; }
            case "table": Object.assign(it, { rows: clamp(Math.round(num(o.rows, 5)), 1, 12), cols: clamp(Math.round(num(o.cols, 2)), 1, 8), hd: str(o.hd, 120, "") }); break;
            case "ruler": it.n = clamp(Math.round(num(o.n, 10)), 2, 30); break;
            case "fracbar": case "fraccircle": { const n = clamp(Math.round(num(o.n, 4)), 1, 24); Object.assign(it, { n, sh: clamp(Math.round(num(o.sh, 0)), 0, n), lab: o.lab !== false }); break; }
            case "tile": Object.assign(it, { t: ["1", "x", "x2"].includes(o.t) ? o.t : "1", neg: !!o.neg }); break;
            case "rect": case "ellipse": case "tri": case "rtri": case "seg": it.a = r4(clamp(num(o.a, 0.6), 0, 6)); break;
            case "text": Object.assign(it, { txt: str(o.txt, 400, ""), fs: r4(clamp(num(o.fs, 0.032), 0.01, 0.2)) }); break;
        }
        out.push(it);
    });
    return out;
}

/* ---------- size of an item in canvas pixels ---------- */
export function geom(it, W, H, ctx) {
    const w = it.s * W;
    switch (it.k) {
        case "plane": return { w, h: w * clamp((it.ymax - it.ymin) / (it.xmax - it.xmin), 0.25, 4) };
        case "numline": return { w, h: w * 0.15 };
        case "table": return { w, h: w * (it.rows * 0.42 / it.cols) };
        case "ruler": return { w, h: w * 0.13 };
        case "protractor": return { w, h: w * 0.58 };
        case "fracbar": return { w, h: w * 0.16 };
        case "fraccircle": return { w, h: w };
        case "tile": return it.t === "x2" ? { w, h: w } : it.t === "x" ? { w, h: w * TILE_THIN } : { w, h: w };
        case "seg": return { w, h: Math.max(w * it.a, 1) };
        case "text": { const fs = it.fs * W, b = ctx ? textBox(ctx, it.txt || "Type here", fs) : { w: fs * 6, h: fs * 1.4 }; return { w: b.w + fs * 0.6, h: b.h + fs * 0.4 }; }
        default: return { w, h: w * (it.a || 1) };
    }
}

/* ---------- maths text: {a/b} stacked fractions, ^2 or ^{…} powers, √x or √{…} roots ---------- */
function parseMath(s) {
    let i = 0;
    function group(stop) {
        const row = []; let buf = "";
        const flush = () => { if (buf) { row.push({ t: "txt", s: buf }); buf = ""; } };
        while (i < s.length) {
            const ch = s[i];
            if (stop && stop.includes(ch)) break;
            if (ch === "{") {
                const save = i; i++; const a = group("/}");
                if (s[i] === "/") { i++; const b = group("}"); if (s[i] === "}") { i++; flush(); row.push({ t: "frac", nu: a, de: b }); continue; } }
                if (s[i] === "}" && save >= 0) { i++; flush(); row.push(a); continue; }
                i = save + 1; buf += "{"; continue;
            }
            if (ch === "^" || ch === "√") {
                i++; flush(); let arg;
                if (s[i] === "{") { i++; arg = group("}"); if (s[i] === "}") i++; }
                else { const m = /^(-?[0-9.]+|[A-Za-z]|\([^)]*\))/.exec(s.slice(i)); if (m) { arg = { t: "row", c: [{ t: "txt", s: m[0] }] }; i += m[0].length; } else arg = { t: "row", c: [] }; }
                row.push({ t: ch === "^" ? "sup" : "sqrt", c: arg }); continue;
            }
            buf += ch === "*" ? "×" : ch === "-" ? "−" : ch; i++;
        }
        flush(); return { t: "row", c: row };
    }
    return group("");
}
function measure(ctx, n, fs) {
    switch (n.t) {
        case "txt": ctx.font = "600 " + fs + "px " + FONT; return Object.assign(n, { w: ctx.measureText(n.s).width, a: fs * 0.78, d: fs * 0.24, fs });
        case "row": { let w = 0, a = fs * 0.78, d = fs * 0.24; n.c.forEach((k) => { measure(ctx, k, fs); w += k.w; a = Math.max(a, k.a); d = Math.max(d, k.d); }); return Object.assign(n, { w, a, d, fs }); }
        case "frac": { const f = fs * 0.82; measure(ctx, n.nu, f); measure(ctx, n.de, f); const ax = fs * 0.3, g = fs * 0.12; return Object.assign(n, { w: Math.max(n.nu.w, n.de.w) + fs * 0.4, a: ax + g + n.nu.d + n.nu.a, d: -ax + g + n.de.a + n.de.d, fs }); }
        case "sup": { const f = fs * 0.62; measure(ctx, n.c, f); return Object.assign(n, { w: n.c.w + fs * 0.06, a: Math.max(fs * 0.78, fs * 0.45 + n.c.a), d: fs * 0.24, fs }); }
        case "sqrt": { measure(ctx, n.c, fs); return Object.assign(n, { w: n.c.w + fs * 0.75, a: n.c.a + fs * 0.18, d: Math.max(n.c.d, fs * 0.24), fs }); }
    }
    return n;
}
function paint(ctx, n, x, y, color) {
    switch (n.t) {
        case "txt": ctx.font = "600 " + n.fs + "px " + FONT; ctx.fillStyle = color; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillText(n.s, x, y); break;
        case "row": { let cx = x; n.c.forEach((k) => { paint(ctx, k, cx, y, color); cx += k.w; }); break; }
        case "frac": {
            const ax = n.fs * 0.3, g = n.fs * 0.12, cx = x + n.w / 2;
            paint(ctx, n.nu, cx - n.nu.w / 2, y - ax - g - n.nu.d, color); paint(ctx, n.de, cx - n.de.w / 2, y - ax + g + n.de.a, color);
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, n.fs * 0.07); ctx.beginPath(); ctx.moveTo(x + n.fs * 0.1, y - ax); ctx.lineTo(x + n.w - n.fs * 0.1, y - ax); ctx.stroke(); break;
        }
        case "sup": paint(ctx, n.c, x + n.fs * 0.04, y - n.fs * 0.45, color); break;
        case "sqrt": {
            const top = y - n.c.a - n.fs * 0.1, s = n.fs; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, s * 0.07); ctx.lineJoin = "round";
            ctx.beginPath(); ctx.moveTo(x + s * 0.05, y - s * 0.3); ctx.lineTo(x + s * 0.22, y - s * 0.38); ctx.lineTo(x + s * 0.42, y + n.c.d * 0.6); ctx.lineTo(x + s * 0.62, top); ctx.lineTo(x + n.w, top); ctx.stroke();
            paint(ctx, n.c, x + s * 0.7, y, color); break;
        }
    }
}
/* Width/height of a block of maths text (several lines) at font size fs. */
export function textBox(ctx, str, fs) {
    const ls = String(str).split("\n").map((l) => measure(ctx, parseMath(l), fs));
    const gap = fs * 0.25; let w = 0, h = 0; ls.forEach((l, i) => { w = Math.max(w, l.w); h += l.a + l.d + (i ? gap : 0); });
    return { w, h, ls, gap };
}
/* Draw maths text with its box centred on (cx, cy). */
export function drawText(ctx, str, fs, cx, cy, color) {
    const b = textBox(ctx, str, fs); let y = cy - b.h / 2;
    b.ls.forEach((l) => { y += l.a; paint(ctx, l, cx - l.w / 2, y, color || C.ink); y += l.d + b.gap; });
    return b;
}

/* ---------- y = … expressions, without eval ---------- */
/* Numbers, x, pi, + − × ÷ ^, brackets, 2x and 3(x+1) style multiplying, abs() sqrt() sin() cos() tan(). */
export function compileExpr(src) {
    let s = String(src || "").trim().replace(/^y\s*=/i, "").replace(/^f\s*\(\s*x\s*\)\s*=/i, "").replace(/[−–]/g, "-").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/π/g, "pi").replace(/²/g, "^2").replace(/³/g, "^3").toLowerCase();
    if (!s) return null;
    const tk = []; let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (/\s/.test(c)) { i++; continue; }
        const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (m) { tk.push({ n: +m[0] }); i += m[0].length; continue; }
        const w = /^(abs|sqrt|sin|cos|tan|pi|x)/.exec(s.slice(i)); if (w) { tk.push({ w: w[0] }); i += w[0].length; continue; }
        if ("+-*/^()|".includes(c)) { tk.push({ o: c }); i++; continue; }
        throw new Error("Can't read \"" + c + "\"");
    }
    // insert × where maths writes nothing: 2x, 2(x), x(x), )(, )x, 2pi
    const t2 = []; tk.forEach((t, j) => { const p = t2[t2.length - 1]; const endsVal = p && (p.n != null || (p.w && (p.w === "x" || p.w === "pi")) || p.o === ")"); const startsVal = t.n != null || t.w || t.o === "("; if (endsVal && startsVal) t2.push({ o: "*" }); t2.push(t); });
    let k = 0; const peek = () => t2[k], eat = (o) => { if (t2[k] && t2[k].o === o) { k++; return true; } return false; };
    function prim() {
        const t = t2[k++]; if (!t) throw new Error("Unfinished");
        if (t.n != null) return () => t.n;
        if (t.w === "x") return (x) => x;
        if (t.w === "pi") return () => Math.PI;
        if (t.w) { const f = { abs: Math.abs, sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan }[t.w]; const a = unary(); return (x) => f(a(x)); }
        if (t.o === "(") { const e = expr(); if (!eat(")")) throw new Error("Missing )"); return e; }
        if (t.o === "|") { const e = expr(); if (!eat("|")) throw new Error("Missing |"); return (x) => Math.abs(e(x)); }
        throw new Error("Unexpected " + (t.o || ""));
    }
    function power() { const b = prim(); if (eat("^")) { const e = unary(); return (x) => Math.pow(b(x), e(x)); } return b; }
    function unary() { if (eat("-")) { const a = unary(); return (x) => -a(x); } if (eat("+")) return unary(); return power(); }
    function term() { let a = unary(); for (;;) { if (eat("*")) { const l = a, r = unary(); a = (x) => l(x) * r(x); } else if (eat("/")) { const l = a, r = unary(); a = (x) => l(x) / r(x); } else return a; } }
    function expr() { let a = term(); for (;;) { if (eat("+")) { const l = a, r = term(); a = (x) => l(x) + r(x); } else if (eat("-")) { const l = a, r = term(); a = (x) => l(x) - r(x); } else return a; } }
    const f = expr(); if (peek()) throw new Error("Check the end of it");
    return f;
}
function safeFn(src) { try { return compileExpr(src); } catch (e) { return null; } }

/* "1/4" -> {v: .25, den: 4}; "0.5" -> {v: .5}; anything else -> null */
export function parseStep(str) {
    const s = String(str || "").trim(), f = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
    if (f) { const a = +f[1], b = +f[2]; return a > 0 && b > 0 ? { v: a / b, den: b } : null; }
    const v = +s; return Number.isFinite(v) && v > 0 ? { v } : null;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function fracLabel(value, den) {
    const n = Math.round(value * den); if (n % den === 0) return String(n / den).replace("-", "−");
    const g = gcd(Math.abs(n), den), p = Math.abs(n) / g, q = den / g; return (n < 0 ? "−" : "") + "{" + p + "/" + q + "}";
}
function decLabel(v) { const r = Math.round(v * 1e6) / 1e6; return String(r).replace("-", "−"); }
export function niceStep(range, target) { const raw = range / (target || 10), mag = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 5, 10]) if (m * mag >= raw - 1e-12) return m * mag; return 10 * mag; }

/* ---------- drawing ---------- */
function arrowHead(ctx, x, y, ang, sz) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - sz * Math.cos(ang - 0.45), y - sz * Math.sin(ang - 0.45)); ctx.lineTo(x - sz * Math.cos(ang + 0.45), y - sz * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill(); }

export function drawItem(ctx, it, W, H) {
    const g = geom(it, W, H, ctx), w = g.w, h = g.h, L = W / 900; // L = one "line" unit
    ctx.save(); ctx.translate(it.x * W, it.y * H); ctx.rotate((it.r || 0) * Math.PI / 180);
    const x0 = -w / 2, y0 = -h / 2;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink;
    switch (it.k) {
        case "plane": drawPlane(ctx, it, x0, y0, w, h, L); break;
        case "numline": drawNumline(ctx, it, x0, y0, w, h, L); break;
        case "table": {
            ctx.fillStyle = C.paper; ctx.fillRect(x0, y0, w, h);
            const cw = w / it.cols, rh = h / it.rows, hd = (it.hd || "").split(",").map((t) => t.trim());
            if (hd.some(Boolean)) { ctx.fillStyle = C.skyFill; ctx.fillRect(x0, y0, w, rh); hd.slice(0, it.cols).forEach((t, c) => { if (t) drawText(ctx, t, Math.min(rh * 0.55, cw * 0.4), x0 + cw * (c + 0.5), y0 + rh / 2, C.ink); }); }
            ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6 * L; ctx.strokeRect(x0, y0, w, h);
            ctx.beginPath(); for (let c = 1; c < it.cols; c++) { ctx.moveTo(x0 + c * cw, y0); ctx.lineTo(x0 + c * cw, y0 + h); } for (let r = 1; r < it.rows; r++) { ctx.moveTo(x0, y0 + r * rh); ctx.lineTo(x0 + w, y0 + r * rh); } ctx.stroke();
            break;
        }
        case "ruler": {
            ctx.fillStyle = C.glass; ctx.strokeStyle = C.blue; ctx.lineWidth = 1.4 * L; roundRect(ctx, x0, y0, w, h, h * 0.12); ctx.fill(); ctx.stroke();
            const pad = w * 0.03, u = (w - 2 * pad) / it.n; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.1 * L; ctx.beginPath();
            for (let i = 0; i <= it.n * 8; i++) { const x = x0 + pad + i * u / 8, len = i % 8 === 0 ? 0.42 : i % 4 === 0 ? 0.3 : i % 2 === 0 ? 0.2 : 0.12; ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h * len); }
            ctx.stroke();
            for (let i = 0; i <= it.n; i++) drawText(ctx, String(i), h * 0.24, x0 + pad + i * u, y0 + h * 0.66, C.ink);
            break;
        }
        case "protractor": drawProtractor(ctx, x0, y0, w, h, L); break;
        case "fracbar": {
            const pw = w / it.n; for (let i = 0; i < it.n; i++) { ctx.fillStyle = i < it.sh ? C.sky : C.paper; ctx.fillRect(x0 + i * pw, y0, pw, h); }
            ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6 * L; ctx.strokeRect(x0, y0, w, h); ctx.beginPath(); for (let i = 1; i < it.n; i++) { ctx.moveTo(x0 + i * pw, y0); ctx.lineTo(x0 + i * pw, y0 + h); } ctx.stroke();
            if (it.lab && pw > h * 0.45) for (let i = 0; i < it.n; i++) drawText(ctx, it.n === 1 ? "1" : "{1/" + it.n + "}", Math.min(h * 0.3, pw * 0.32), x0 + (i + 0.5) * pw, 0, C.ink);
            break;
        }
        case "fraccircle": {
            const R = w / 2 - L, a0 = -Math.PI / 2, da = Math.PI * 2 / it.n;
            for (let i = 0; i < it.n; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0 + i * da, a0 + (i + 1) * da); ctx.closePath(); ctx.fillStyle = i < it.sh ? C.sky : C.paper; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6 * L; ctx.stroke(); }
            if (it.n === 1) { ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke(); }
            if (it.lab && it.n <= 16) for (let i = 0; i < it.n; i++) { const a = a0 + (i + 0.5) * da, rr = it.n === 1 ? 0 : R * 0.62; drawText(ctx, it.n === 1 ? "1" : "{1/" + it.n + "}", R * Math.min(0.22, 1.6 / it.n + 0.05), rr * Math.cos(a), rr * Math.sin(a), C.ink); }
            break;
        }
        case "tile": {
            const fill = it.neg ? C.red : it.t === "1" ? C.amber : it.t === "x" ? C.sky : C.blue, txt = it.neg || it.t === "x2" ? "#FFFFFF" : C.ink;
            ctx.fillStyle = fill; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.3 * L; roundRect(ctx, x0, y0, w, h, Math.min(w, h) * 0.08); ctx.fill(); ctx.stroke();
            const lab = (it.neg ? "−" : "") + (it.t === "1" ? "1" : it.t === "x" ? "x" : "x^2");
            ctx.save(); if (Math.abs(((it.r || 0) % 180 + 180) % 180 - 90) < 1 && it.t === "x") ctx.rotate(-Math.PI / 2); drawText(ctx, lab, Math.min(w, h) * (it.t === "1" ? 0.55 : it.t === "x" ? 0.6 : 0.28), 0, 0, txt); ctx.restore();
            break;
        }
        case "rect": ctx.lineWidth = 2.2 * L; ctx.strokeRect(x0, y0, w, h); break;
        case "ellipse": ctx.lineWidth = 2.2 * L; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2.2 * L, 0, Math.PI * 2); ctx.fill(); break;
        case "tri": ctx.lineWidth = 2.2 * L; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(x0 + w, y0 + h); ctx.lineTo(x0, y0 + h); ctx.closePath(); ctx.stroke(); break;
        case "rtri": {
            ctx.lineWidth = 2.2 * L; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0 + h); ctx.lineTo(x0, y0 + h); ctx.closePath(); ctx.stroke();
            const q = Math.min(w, h) * 0.12; ctx.lineWidth = 1.4 * L; ctx.beginPath(); ctx.moveTo(x0, y0 + h - q); ctx.lineTo(x0 + q, y0 + h - q); ctx.lineTo(x0 + q, y0 + h); ctx.stroke(); break;
        }
        case "seg": ctx.lineWidth = 2.2 * L; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + w, 0); ctx.stroke(); [x0, x0 + w].forEach((x) => { ctx.beginPath(); ctx.arc(x, 0, 3.6 * L, 0, Math.PI * 2); ctx.fill(); }); break;
        case "text": {
            const fs = it.fs * W; if (it.txt) drawText(ctx, it.txt, fs, 0, 0, C.ink);
            else { ctx.setLineDash([4 * L, 4 * L]); ctx.strokeStyle = C.sky; ctx.lineWidth = 1.2 * L; ctx.strokeRect(x0, y0, w, h); ctx.setLineDash([]); drawText(ctx, "Type here", fs, 0, 0, "#8A9AB8"); }
            break;
        }
    }
    ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawPlane(ctx, it, x0, y0, w, h, L) {
    const { xmin, xmax, ymin, ymax } = it, X = (x) => x0 + (x - xmin) / (xmax - xmin) * w, Y = (y) => y0 + (ymax - y) / (ymax - ymin) * h;
    ctx.fillStyle = C.paper; ctx.fillRect(x0, y0, w, h);
    const sx = niceStep(xmax - xmin, 10), sy = niceStep(ymax - ymin, 10);
    const gx = (xmax - xmin) <= 40 && w / (xmax - xmin) > 6 * L ? Math.min(1, sx) : sx, gy = (ymax - ymin) <= 40 && h / (ymax - ymin) > 6 * L ? Math.min(1, sy) : sy;
    ctx.lineWidth = 1 * L; ctx.strokeStyle = C.grid; ctx.beginPath();
    for (let v = Math.ceil(xmin / gx) * gx; v <= xmax + 1e-9; v += gx) { ctx.moveTo(X(v), y0); ctx.lineTo(X(v), y0 + h); }
    for (let v = Math.ceil(ymin / gy) * gy; v <= ymax + 1e-9; v += gy) { ctx.moveTo(x0, Y(v)); ctx.lineTo(x0 + w, Y(v)); }
    ctx.stroke();
    if (gx !== sx || gy !== sy) { ctx.strokeStyle = C.grid2; ctx.beginPath(); for (let v = Math.ceil(xmin / sx) * sx; v <= xmax + 1e-9; v += sx) { ctx.moveTo(X(v), y0); ctx.lineTo(X(v), y0 + h); } for (let v = Math.ceil(ymin / sy) * sy; v <= ymax + 1e-9; v += sy) { ctx.moveTo(x0, Y(v)); ctx.lineTo(x0 + w, Y(v)); } ctx.stroke(); }
    // axes (on the edge when 0 is off the plane)
    const ax = clamp(Y(0), y0, y0 + h), ay = clamp(X(0), x0, x0 + w), fs = Math.max(8 * L, Math.min(w, h) * 0.034);
    ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 1.8 * L; ctx.beginPath(); ctx.moveTo(x0, ax); ctx.lineTo(x0 + w, ax); ctx.moveTo(ay, y0); ctx.lineTo(ay, y0 + h); ctx.stroke();
    if (xmin < 0 && xmax > 0) { arrowHead(ctx, x0 + w, ax, 0, 8 * L); arrowHead(ctx, x0, ax, Math.PI, 8 * L); }
    if (ymin < 0 && ymax > 0) { arrowHead(ctx, ay, y0, -Math.PI / 2, 8 * L); arrowHead(ctx, ay, y0 + h, Math.PI / 2, 8 * L); }
    ctx.lineWidth = 1.2 * L; ctx.beginPath();
    for (let v = Math.ceil(xmin / sx) * sx; v <= xmax + 1e-9; v += sx) { ctx.moveTo(X(v), ax - 3 * L); ctx.lineTo(X(v), ax + 3 * L); }
    for (let v = Math.ceil(ymin / sy) * sy; v <= ymax + 1e-9; v += sy) { ctx.moveTo(ay - 3 * L, Y(v)); ctx.lineTo(ay + 3 * L, Y(v)); }
    ctx.stroke();
    const below = ax + fs * 0.95 < y0 + h, left = ay - fs * 1.2 > x0;
    for (let v = Math.ceil(xmin / sx) * sx; v <= xmax + 1e-9; v += sx) { if (Math.abs(v) < 1e-9 || X(v) < x0 + fs * 0.6 || X(v) > x0 + w - fs * 0.6) continue; drawText(ctx, decLabel(v), fs, X(v), below ? ax + fs * 0.85 : ax - fs * 0.85, C.ink); }
    for (let v = Math.ceil(ymin / sy) * sy; v <= ymax + 1e-9; v += sy) { if (Math.abs(v) < 1e-9 || Y(v) < y0 + fs * 0.5 || Y(v) > y0 + h - fs * 0.5) continue; const t = decLabel(v); ctx.font = "600 " + fs + "px " + FONT; const tw = ctx.measureText(t).width; drawText(ctx, t, fs, left ? ay - tw / 2 - fs * 0.45 : ay + tw / 2 + fs * 0.45, Y(v), C.ink); }
    if (xmin <= 0 && xmax >= 0 && ymin <= 0 && ymax >= 0) drawText(ctx, "0", fs, ay - fs * 0.5, ax + fs * 0.75, C.ink);
    drawText(ctx, "x", fs * 1.15, x0 + w - fs * 0.6, ax - fs * 0.9, C.ink); drawText(ctx, "y", fs * 1.15, ay + fs * 0.75, y0 + fs * 0.7, C.ink);
    // graphs
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    (it.fx || []).forEach((src, j) => {
        const f = safeFn(src); if (!f) return;
        ctx.strokeStyle = PLOT[j % PLOT.length]; ctx.lineWidth = 3 * L; ctx.beginPath();
        const N = Math.max(200, Math.round(w / L)); let pen = false, py = 0;
        for (let i = 0; i <= N; i++) {
            const xv = xmin + (xmax - xmin) * i / N, yv = f(xv), yy = Y(yv);
            if (!Number.isFinite(yv) || Math.abs(yy - y0) > h * 20) { pen = false; continue; }
            if (pen && Math.abs(yy - py) > h * 1.5) pen = false;
            if (pen) ctx.lineTo(X(xv), yy); else ctx.moveTo(X(xv), yy); pen = true; py = yy;
        }
        ctx.stroke();
    });
    ctx.restore();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2 * L; ctx.strokeRect(x0, y0, w, h);
}

function drawNumline(ctx, it, x0, y0, w, h, L) {
    const st = parseStep(it.step) || { v: 1 }, pad = w * 0.04, lx = x0 + pad, rx = x0 + w - pad, ly = y0 + h * 0.36;
    let count = Math.floor((it.max - it.min) / st.v + 1e-9); let v = st.v; while (count > 200) { v *= 2; count = Math.floor((it.max - it.min) / v + 1e-9); }
    const X = (val) => lx + (val - it.min) / (it.max - it.min) * (rx - lx), every = Math.max(1, Math.ceil(count / 20));
    ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 2 * L; ctx.beginPath(); ctx.moveTo(x0 + 2 * L, ly); ctx.lineTo(x0 + w - 2 * L, ly); ctx.stroke();
    arrowHead(ctx, x0 + w, ly, 0, 10 * L); arrowHead(ctx, x0, ly, Math.PI, 10 * L);
    const fs = Math.min(h * 0.2, Math.max(8 * L, (rx - lx) / Math.max(1, count / every) * 0.42));
    ctx.lineWidth = 1.6 * L;
    for (let i = 0; i <= count; i++) {
        const val = it.min + i * v, x = X(val), big = i % every === 0;
        ctx.beginPath(); ctx.moveTo(x, ly - h * (big ? 0.14 : 0.08)); ctx.lineTo(x, ly + h * (big ? 0.14 : 0.08)); ctx.stroke();
        if (big) drawText(ctx, st.den ? fracLabel(val, st.den) : decLabel(val), fs, x, ly + h * 0.22 + (st.den ? fs * 0.9 : fs * 0.55), C.ink);
    }
}

function drawProtractor(ctx, x0, y0, w, h, L) {
    const cx = 0, cy = y0 + h - h * 0.1, R = w / 2 - 2 * L;
    ctx.fillStyle = C.glass; ctx.strokeStyle = C.blue; ctx.lineWidth = 1.4 * L;
    ctx.beginPath(); ctx.moveTo(x0, cy); ctx.arc(cx, cy, R, Math.PI, 0); ctx.lineTo(x0 + w, cy); ctx.lineTo(x0 + w, y0 + h); ctx.lineTo(x0, y0 + h); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = C.ink;
    for (let d = 0; d <= 180; d++) {
        const a = Math.PI + d * Math.PI / 180, len = d % 10 === 0 ? 0.12 : d % 5 === 0 ? 0.08 : 0.045;
        ctx.lineWidth = (d % 10 === 0 ? 1.3 : 0.9) * L; ctx.beginPath(); ctx.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); ctx.lineTo(cx + R * (1 - len) * Math.cos(a), cy + R * (1 - len) * Math.sin(a)); ctx.stroke();
    }
    const fo = R * 0.065, fi = R * 0.05;
    for (let d = 0; d <= 180; d += 10) {
        const a = Math.PI + d * Math.PI / 180;
        drawText(ctx, String(d), fo, cx + R * 0.8 * Math.cos(a), cy + R * 0.8 * Math.sin(a) + (d === 0 || d === 180 ? -fo * 0.5 : 0), C.ink);
        drawText(ctx, String(180 - d), fi, cx + R * 0.66 * Math.cos(a), cy + R * 0.66 * Math.sin(a) + (d === 0 || d === 180 ? -fi * 0.5 : 0), C.blue);
    }
    ctx.lineWidth = 1.2 * L; ctx.beginPath(); ctx.moveTo(x0 + w * 0.04, cy); ctx.lineTo(x0 + w * 0.96, cy); ctx.moveTo(cx, cy - R * 0.08); ctx.lineTo(cx, cy + R * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.45, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(cx, cy, 3 * L, 0, Math.PI * 2); ctx.fill();
}

export function drawItems(ctx, items, W, H) { (items || []).forEach((it) => drawItem(ctx, it, W, H)); }

/* ---------- picking and handles ---------- */
const HANDLE = (W) => Math.max(10, W / 90);
function toLocal(it, px, py, W, H) { const a = -(it.r || 0) * Math.PI / 180, dx = px - it.x * W, dy = py - it.y * H; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; }
/* The topmost item under (px, py) in canvas pixels, or -1. */
export function hitItem(ctx, items, px, py, W, H) {
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i], g = geom(it, W, H, ctx), [u, v] = toLocal(it, px, py, W, H), pad = HANDLE(W) * 0.6, hh = it.k === "seg" ? Math.max(g.h / 2, HANDLE(W)) : g.h / 2;
        if (it.k === "protractor") { const cy = g.h / 2 - g.h * 0.1, R = g.w / 2; if (Math.abs(u) <= g.w / 2 + pad && v <= g.h / 2 + pad && (v >= cy || Math.hypot(u, v - cy) <= R + pad)) return i; continue; }
        if (Math.abs(u) <= g.w / 2 + pad && Math.abs(v) <= hh + pad) return i;
    }
    return -1;
}
/* Which handle of a selected item is under the point: "size", "turn", or "". */
export function hitHandle(ctx, it, px, py, W, H) {
    const g = geom(it, W, H, ctx), [u, v] = toLocal(it, px, py, W, H), hs = HANDLE(W), hh = it.k === "seg" ? 0 : g.h / 2;
    if (Math.hypot(u - g.w / 2, v - hh) <= hs * 1.6) return "size";
    if (Math.hypot(u, v - (-hh - hs * 3.2)) <= hs * 1.6) return "turn";
    return "";
}
export function drawSelection(ctx, it, W, H) {
    const g = geom(it, W, H, ctx), hs = HANDLE(W), pad = hs * 0.5, hh = it.k === "seg" ? 0 : g.h / 2;
    ctx.save(); ctx.translate(it.x * W, it.y * H); ctx.rotate((it.r || 0) * Math.PI / 180);
    ctx.strokeStyle = C.sky; ctx.lineWidth = Math.max(1.5, W / 700); ctx.setLineDash([hs * 0.6, hs * 0.4]);
    ctx.strokeRect(-g.w / 2 - pad, -hh - pad, g.w + 2 * pad, hh * 2 + 2 * pad); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0, -hh - pad); ctx.lineTo(0, -hh - hs * 2.4); ctx.stroke();
    ctx.fillStyle = "#FFFFFF"; ctx.strokeStyle = C.blue; ctx.lineWidth = Math.max(1.5, W / 600);
    ctx.beginPath(); ctx.arc(0, -hh - hs * 3.2, hs * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();   // turn
    ctx.beginPath(); ctx.arc(0, -hh - hs * 3.2, hs * 0.45, -Math.PI * 0.9, Math.PI * 0.4); ctx.stroke();
    ctx.fillStyle = C.blue; ctx.fillRect(g.w / 2 - hs * 0.8, hh - hs * 0.8, hs * 1.6, hs * 1.6);  // size
    ctx.restore();
}
/* Move a handle: returns the changed fields. */
export function dragHandle(ctx, it, part, px, py, W, H) {
    if (part === "turn") {
        let deg = Math.atan2(py - it.y * H, px - it.x * W) * 180 / Math.PI + 90;
        const snap = it.k === "tile" ? 90 : 15; const near = Math.round(deg / snap) * snap; if (it.k === "tile" || Math.abs(deg - near) < 4) deg = near;
        return { r: Math.round(((deg % 360) + 360) % 360 * 10) / 10 };
    }
    const [u, v] = toLocal(it, px, py, W, H), g = geom(it, W, H, ctx);
    if (it.k === "text") { const k = Math.max(Math.abs(u) / (g.w / 2), 0.1); return { fs: r4(clamp(it.fs * k, 0.012, 0.2)) }; }
    const nw = clamp(Math.abs(u) * 2, W * 0.02, W * 1.5);
    if (FREE_SHAPE[it.k]) { const out = { s: r4(nw / W) }; if (it.k !== "seg") out.a = r4(clamp(Math.abs(v) * 2 / nw, 0.05, 6)); return out; }
    if (it.k === "tile") return {};
    return { s: r4(nw / W) };
}
