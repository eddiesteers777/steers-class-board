/* ==========================================
   Anchor Board — lesson slides: the model (no page, no Firebase).
   A teacher builds their own slides for a lesson in the Board Builder (Slides), starting from a blank
   slide, a layout, or the built-in screens turned into pieces they can move, change or delete.
   The board shows them one at a time; Next shows the next piece set to appear, then the next slide.

   Where they live (teacher/{uid}/...):
     slides/<week>|<class>|<day>   one lesson's slides                   { v, slides: [Slide], nod }
     slides/daily                  every-day slides, shown at the start of every lesson
     slides/index                  how many slides each lesson has       { v, n: { key: count } }
     slideimg/<id>                 a picture, shrunk on the device        { d: data URL, w, h }

   A slide: { id, bg: { t, c, g, p }, els: [El], nt (notes for the teacher, never on the board), hide, pn, th, gd }
     th  the theme its glass blocks wear: { c, f, o, r } from js/panelStyle.js (color, finish, how solid, corners).
         None: "Match my panels", the frosted glass of Spotlight's own panels (Nov 26)
     gd  the grid it was made from (GRIDS), so the Grid menu can show it
     pn  panels Spotlight opens when it reaches this slide: { tm: timer seconds, tg: learning target, ag: agenda } (Nov 24)
     bg.t  "board" (the board's own look) | "color" (c) | "grad" (g); bg.p a paper pattern over a color or gradient
   An element: { id, k, x, y, w, h, r, ap, lk, op, ...its own settings }, in slide units (1600 x 900)
     k   "bx" a box: text, a card (hd = its heading), a shape (sh) or a sticky note.
              gl 1 makes it a glass block in the slide's theme (fill and line are not used); gl 2 is the same with an amber edge (answers, targets)
         "ln" a line or arrow (x1, y1, x2, y2 instead of x, y, w, h)
         "tb" a table of short texts     "pc" a picture (img = its id)
         "mt" a math tool (js/mathTools.js item)   "st" a sticker (js/stickers.js)   "lg" the board's logo
         "wk" Show Steps: a worked walkthrough from the standards bank (wid = its problem id, n = its steps, q = the problem).
              On the board and in Spotlight it plays one step per Next (js/stepPlayer.js); in the editor it is a card.
     r   turn in degrees   ap  appears on the ap-th Next (0 = always shown)   lk  locked   op  see-through
   Text is a small safe subset of HTML (sanitizeHtml). {3/4} draws a fraction, x^2 a power, √{49} a root,
   and {{agenda}} style live fields fill in from the lesson's plan wherever the slide is shown.
========================================== */
import { cleanItems, NAMES as MATH_NAMES } from "./mathTools.js?v=1";
import { cleanSticker } from "./stickers.js?v=1";
import { PANEL_COLORS, PANEL_FINISHES, PANEL_CORNERS, MIN_SOLID } from "./panelStyle.js?v=3";

export const SW = 1600, SH = 900;
export const MAX_SLIDES = 40, MAX_ELS = 80, MAX_HTML = 6000, MAX_NOTES = 3000, MAX_DAILY = 6;
export const DAILY = "daily", INDEX = "index";
const KEY = /^[\w.-]{1,40}\|[\w.-]{1,20}\|[0-4]$/;
export const isLessonKey = (k) => typeof k === "string" && KEY.test(k);
export const deckKey = (week, cls, day) => week + "|" + cls + "|" + day;

const rnd = () => Math.random().toString(36).slice(2, 10);
export const newId = (p) => (p || "e") + rnd();
const num = (v, a, b, d) => { const n = +v; return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const int = (v, a, b, d) => Math.round(num(v, a, b, d));
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const idOf = (v, p) => (typeof v === "string" && /^[\w-]{1,16}$/.test(v) ? v : newId(p));
const pick = (v, list, d) => (list.some((x) => (Array.isArray(x) ? x[0] : x) === v) ? v : d);

/* ---------- colors, fonts, shapes, backgrounds ---------- */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
/** A color is "#rgb" or "#rrggbb"; "" means none (or, for text, the automatic color). */
export const color = (v, d) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : d);
export const PALETTE = [
    ["#14213d", "Ink"], ["#10358a", "Navy"], ["#1552d6", "Blue"], ["#7faedd", "Sky"], ["#eaf2fb", "Mist"],
    ["#f2b33d", "Amber"], ["#e8710a", "Orange"], ["#c62828", "Red"], ["#d63384", "Pink"], ["#6b3fa0", "Purple"],
    ["#1b7f3b", "Green"], ["#0f8b8d", "Teal"], ["#fff3b0", "Sticky"], ["#5f6b7a", "Gray"], ["#ffffff", "White"], ["#000000", "Black"],
];
export const FONTS = [
    ["sans", "Clean", '"Instrument Sans", system-ui, sans-serif'],
    ["display", "Bold", '"Bricolage Grotesque", "Instrument Sans", sans-serif'],
    ["hand", "Handwritten", '"Patrick Hand", "Comic Sans MS", "Segoe Print", cursive'],
    ["serif", "Book", 'Georgia, "Times New Roman", serif'],
    ["mono", "Typewriter", 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace'],
];
export const fontOf = (id) => (FONTS.find((f) => f[0] === id) || FONTS[0])[2];
export const SHAPES = [
    ["rect", "Rectangle"], ["round", "Rounded box"], ["ellipse", "Circle"], ["tri", "Triangle"], ["rtri", "Right triangle"],
    ["diamond", "Diamond"], ["para", "Parallelogram"], ["trap", "Trapezoid"], ["pent", "Pentagon"], ["hex", "Hexagon"], ["oct", "Octagon"],
    ["star", "Star"], ["burst", "Burst"], ["heart", "Heart"], ["plus", "Plus"], ["arrowR", "Arrow"], ["arrowL", "Arrow left"], ["arrowU", "Arrow up"],
    ["arrowD", "Arrow down"], ["chevron", "Chevron"], ["callout", "Speech bubble"], ["cloud", "Thought cloud"], ["banner", "Banner"],
];
export const GRADS = [
    ["sky", "Sky", ["#bcd8f5", "#f4f8fd"]], ["paper", "Paper", ["#ffffff", "#e9eff7"]], ["navy", "Navy", ["#173f86", "#081b45"]],
    ["night", "Night", ["#2a3a6b", "#0b1020"]], ["sunset", "Sunset", ["#f9c74f", "#e8710a"]], ["peach", "Peach", ["#ffe0c2", "#f28da6"]],
    ["berry", "Berry", ["#7a2257", "#2a0a1f"]], ["mint", "Mint", ["#d4f5e6", "#7fcfc0"]], ["forest", "Forest", ["#1f5c47", "#0a251c"]],
    ["lemon", "Lemon", ["#fff9d6", "#ffe58a"]], ["grape", "Grape", ["#b9a4f0", "#5b3fa0"]], ["chalk", "Chalkboard", ["#33503f", "#16261d"]],
    ["aurora", "Aurora", ["#1b4fbf", "#081b45"]],   // drawn as soft glows, not a straight fade (gradCss); the two colors pick the ink
];
/* Aurora (Nov 27, Eddie approved the new background glow): sky and blue glows with a touch of amber on deep navy, behind clear glass blocks. */
const AURORA = "radial-gradient(45% 60% at 18% 20%,rgba(127,174,221,.7),transparent 70%),radial-gradient(40% 55% at 88% 88%,rgba(242,179,61,.32),transparent 70%)," +
    "radial-gradient(50% 60% at 70% 10%,rgba(27,79,191,.7),transparent 70%),#081b45";
/** The CSS background for a gradient id: a straight fade, or Aurora's glows. */
export function gradCss(id) {
    if (id === "aurora") return AURORA;
    const g = (GRADS.find((x) => x[0] === id) || GRADS[0])[2];
    return "linear-gradient(160deg," + g[0] + " 0%," + g[1] + " 100%)";
}
export const isAurora = (bg) => !!bg && bg.t === "grad" && bg.g === "aurora";
export const PATTERNS = [["", "None"], ["grid", "Graph paper"], ["dots", "Dots"], ["lines", "Lined paper"], ["axes", "x-y grid"]];
export const ALIGN = ["l", "c", "r", "j"], VALIGN = ["t", "m", "b"], DASH = ["", "d", "o"], HEADS = ["", "arrow", "dot", "bar"];

/** Relative brightness 0 (black) to 1 (white) of "#rrggbb", for picking a text color that shows up. */
export function lum(hex) {
    const h = color(hex, ""); if (!h) return 1;
    const x = h.length === 4 ? h.slice(1).split("").map((c) => c + c) : [h.slice(1, 3), h.slice(3, 5), h.slice(5, 7)];
    const [r, g, b] = x.map((c) => { const v = parseInt(c, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Text that shows up on a fill: dark ink on light colors, near-white on dark ones. */
export const inkOn = (hex) => (lum(hex) > 0.36 ? "#14213d" : "#f6f9fd");
/** The automatic text color on a slide's background. The board's own looks are all dark, so light text there. */
export function inkFor(bg) {
    if (!bg || bg.t === "board") return "#f6f9fd";
    if (bg.t === "grad") { const g = GRADS.find((x) => x[0] === bg.g) || GRADS[0]; return (lum(g[2][0]) + lum(g[2][1])) / 2 > 0.3 ? "#14213d" : "#f6f9fd"; }
    return inkOn(color(bg.c, "#ffffff"));
}

/* ---------- safe text: a small subset of HTML ----------
   Kept: b i u s sup sub br div ul ol li span, and on spans/blocks a few styles (color, highlight, size, align).
   Everything else is dropped; script-like tags lose their insides too. Text is escaped. Runs in the browser and in Node. */
const TAGS = { b: "b", strong: "b", i: "i", em: "i", u: "u", s: "s", strike: "s", del: "s", sup: "sup", sub: "sub", br: "br",
    div: "div", p: "div", ul: "ul", ol: "ol", li: "li", span: "span", font: "span" };
const DROP_ALL = /^(script|style|iframe|object|svg|math|template|textarea|select|noscript|head|title|xml|video|audio|canvas)$/i;   // these lose their insides too
const SIZE_WORDS = { "xx-small": 0.6, "x-small": 0.75, small: 0.89, medium: 1, large: 1.2, "x-large": 1.5, "xx-large": 2, "xxx-large": 3 };
const FONT_SIZES = [0, 0.6, 0.8, 1, 1.2, 1.5, 2, 3];
function cssColor(v) {
    const t = String(v || "").trim().toLowerCase();
    if (HEX.test(t)) return t;
    const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(t);
    if (m) { if (m[4] != null && +m[4] < 0.05) return "transparent"; return "#" + [m[1], m[2], m[3]].map((n) => ("0" + Math.min(255, +n).toString(16)).slice(-2)).join(""); }
    if (t === "transparent") return "transparent";
    return "";
}
function attrOf(attrs, name) {
    const re = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'>]+))", "i"), m = re.exec(attrs || "");
    return m ? (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : "";
}
const unent = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
function cleanStyle(style, tag) {
    const out = [];
    unent(style).split(";").forEach((part) => {
        const i = part.indexOf(":"); if (i < 0) return;
        const p = part.slice(0, i).trim().toLowerCase(), v = part.slice(i + 1).trim().toLowerCase().replace(/\s*!important$/, "");
        if (tag === "span") {
            if (p === "color") { const c = cssColor(v); if (c && c !== "transparent") out.push("color:" + c); }
            else if (p === "background-color" || p === "background") { const c = cssColor(v); if (c && c !== "transparent") out.push("background-color:" + c); }
            else if (p === "font-weight" && /^(bold|bolder|[6-9]00)$/.test(v)) out.push("font-weight:bold");
            else if (p === "font-style" && v === "italic") out.push("font-style:italic");
            else if ((p === "text-decoration" || p === "text-decoration-line") && /underline|line-through/.test(v)) out.push("text-decoration:" + [v.includes("underline") ? "underline" : "", v.includes("line-through") ? "line-through" : ""].filter(Boolean).join(" "));
            else if (p === "font-size") {
                let em = 0; const m = /^([\d.]+)em$/.exec(v);
                if (m) em = +m[1]; else if (SIZE_WORDS[v]) em = SIZE_WORDS[v];
                if (em) out.push("font-size:" + Math.min(5, Math.max(0.4, r2(em))) + "em");
            }
        } else if (p === "text-align" && /^(left|center|right|justify)$/.test(v)) out.push("text-align:" + v);
    });
    return out.join(";");
}
const escText = (t) => t.replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp|#\d{1,6}|#x[0-9a-f]{1,5});)/gi, "&amp;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function sanitizeHtml(src) {
    const s = String(src == null ? "" : src).slice(0, MAX_HTML * 3);
    const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y;
    let out = "", i = 0; const stack = [];
    while (i < s.length) {
        const lt = s.indexOf("<", i);
        if (lt < 0) { out += escText(s.slice(i)); break; }
        if (lt > i) out += escText(s.slice(i, lt));
        if (s.startsWith("<!--", lt)) { const e = s.indexOf("-->", lt + 4); i = e < 0 ? s.length : e + 3; continue; }
        TAG.lastIndex = lt; const m = TAG.exec(s);
        if (!m) { out += "&lt;"; i = lt + 1; continue; }
        i = TAG.lastIndex;
        const close = !!m[1], raw = m[2].toLowerCase(), name = TAGS[raw];
        if (!name) {
            if (!close && DROP_ALL.test(raw) && !/\/\s*$/.test(m[3])) { const end = new RegExp("</" + raw + "\\s*>", "ig"); end.lastIndex = i; const e = end.exec(s); i = e ? end.lastIndex : s.length; }
            continue;
        }
        if (name === "br") { if (!close) out += "<br>"; continue; }
        if (close) { const at = stack.lastIndexOf(name); if (at < 0) continue; while (stack.length > at) out += "</" + stack.pop() + ">"; continue; }
        if (stack.length >= 24) continue;   // deep nesting: keep the text, drop the extra tags
        let st = "";
        if (raw === "font") {
            const c = cssColor(attrOf(m[3], "color")), sz = +attrOf(m[3], "size");
            st = [c && c !== "transparent" ? "color:" + c : "", FONT_SIZES[sz] ? "font-size:" + FONT_SIZES[sz] + "em" : "", cleanStyle(attrOf(m[3], "style"), "span")].filter(Boolean).join(";");
        } else if (name === "span" || name === "div" || name === "li") st = cleanStyle(attrOf(m[3], "style"), name);
        stack.push(name); out += "<" + name + (st ? ' style="' + st + '"' : "") + ">";
    }
    while (stack.length) out += "</" + stack.pop() + ">";
    // Empty formatting left behind by editing: <b></b>, <span style=…></span>
    for (let k = 0; k < 3; k++) out = out.replace(/<(b|i|u|s|sup|sub|span)(?: style="[^"]*")?><\/\1>/g, "");
    return out.length > MAX_HTML ? plainHtml(textOf(out)) : out;
}
/** The words in a piece of slide HTML, for names, search and screen readers. */
export function textOf(html) {
    return String(html || "").replace(/<br>|<\/div>|<\/li>/g, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
}
/** Plain text (lines) as slide HTML. */
export const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function plainHtml(text) { return String(text == null ? "" : text).slice(0, MAX_HTML - 200).split("\n").map(esc).join("<br>"); }

/* ---------- live fields: {{agenda}} fills in from the lesson's plan ---------- */
export const LIVE = [
    ["day", "Day", "Monday"], ["date", "Date", "November 23"], ["topic", "Today's topic", "Two-step equations: guided notes"], ["class", "Class", "8th Grade"],
    ["lt", "Learning target", "I can solve two-step equations."], ["weeklt", "This week's target", "I can solve equations."],
    ["bell", "Bellringer", "Bellringer: problems 1-4"], ["agenda", "Agenda", ["Bellringer", "Guided notes", "Exit ticket"]],
    ["supplies", "Supplies", ["Pencil", "Notes"]], ["reminders", "Reminders", ["Quiz Friday"]], ["week", "This week", ["Mon: Notes", "Tue: Practice"]],
];
const LIVE_KEYS = new Set(LIVE.map((x) => x[0]));
/** The value of one live field for a lesson (ctx from liveContext), a string or a list of lines. */
export function liveValue(key, ctx) { const v = ctx ? ctx[key] : undefined; return v == null ? "" : v; }
/** Live fields in (already safe) slide HTML filled in. mark: wrap each in <span class="slv"> so the editor can show it is live. */
export function fillLive(html, ctx, mark) {
    return String(html || "").replace(/\{\{\s*([a-z]+)\s*\}\}/g, (all, k) => {
        if (!LIVE_KEYS.has(k)) return all;
        const v = liveValue(k, ctx), body = Array.isArray(v) ? v.filter((x) => x != null && x !== "").map((x) => esc(x)).join("<br>") : esc(v);
        const shown = body || (mark ? "<i>(" + esc((LIVE.find((x) => x[0] === k) || [k, k])[1]) + ")</i>" : "");
        return mark ? '<span class="slv" data-live="' + k + '">' + shown + "</span>" : shown;
    });
}
/** A lesson's date in words: the plan's own, or worked out from the week's Monday (W.monday "2026-11-16"). */
export function lessonDate(W, i, d) {
    if (d && d.date) return String(d.date).slice(0, 60);
    if (W && /^\d{4}-\d\d-\d\d$/.test(W.monday || "")) { const t = new Date(W.monday + "T12:00:00"); t.setDate(t.getDate() + (+i || 0)); return t.toLocaleDateString("en-US", { month: "long", day: "numeric" }); }
    return "";
}
/** The plan's words for one lesson, for live fields. W: the week, L: its class, d: the day, i: the day's number. */
export function liveContext(W, L, d, i, dateText) {
    const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const list = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string" && x.trim()).map((x) => x.slice(0, 300)) : []);
    return {
        day: FULL[i] || "", date: dateText || (d && d.date) || "", topic: (d && (d.agendaLine || d.short || d.title)) || "", class: (L && (L.label || L.cls)) || "",
        lt: (d && d.lt) || "", weeklt: (L && L.weekLT) || "", bell: (d && d.bell) || "", agenda: list(d && d.agenda),
        supplies: list(d && d.supplies), reminders: list(d && d.reminders),
        week: ((L && L.days) || []).map((x, j) => DK[j] + ": " + ((x && (x.short || x.agendaLine)) || "")).slice(0, 5),
    };
}

/* ---------- shapes as SVG paths, in a w x h box ---------- */
export function shapePath(sh, w, h, rd) {
    const p = (pts) => "M" + pts.map((q) => r1(q[0]) + " " + r1(q[1])).join("L") + "Z";
    const poly = (n, rot) => { const pts = []; for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; pts.push([w / 2 + w / 2 * Math.cos(a), h / 2 + h / 2 * Math.sin(a)]); } return p(pts); };
    switch (sh) {
        case "round": case "rect": {
            const r = sh === "rect" ? Math.min(num(rd, 0, 400, 0), w / 2, h / 2) : Math.min(num(rd, 0, 400, 28) || 28, w / 2, h / 2);
            if (!r) return p([[0, 0], [w, 0], [w, h], [0, h]]);
            return "M" + r + " 0H" + r1(w - r) + "A" + r + " " + r + " 0 0 1 " + r1(w) + " " + r + "V" + r1(h - r) + "A" + r + " " + r + " 0 0 1 " + r1(w - r) + " " + r1(h) + "H" + r + "A" + r + " " + r + " 0 0 1 0 " + r1(h - r) + "V" + r + "A" + r + " " + r + " 0 0 1 " + r + " 0Z";
        }
        case "ellipse": return "M0 " + r1(h / 2) + "A" + r1(w / 2) + " " + r1(h / 2) + " 0 1 0 " + r1(w) + " " + r1(h / 2) + "A" + r1(w / 2) + " " + r1(h / 2) + " 0 1 0 0 " + r1(h / 2) + "Z";
        case "tri": return p([[w / 2, 0], [w, h], [0, h]]);
        case "rtri": return p([[0, 0], [w, h], [0, h]]);
        case "diamond": return p([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
        case "para": return p([[w * 0.22, 0], [w, 0], [w * 0.78, h], [0, h]]);
        case "trap": return p([[w * 0.22, 0], [w * 0.78, 0], [w, h], [0, h]]);
        case "pent": return poly(5, -Math.PI / 2);
        case "hex": return poly(6, 0);
        case "oct": return poly(8, Math.PI / 8);
        case "star": case "burst": {
            const n = sh === "star" ? 5 : 12, inner = sh === "star" ? 0.42 : 0.72, pts = [];
            for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, k = i % 2 ? inner : 1; pts.push([w / 2 + w / 2 * k * Math.cos(a), h / 2 + h / 2 * k * Math.sin(a)]); }
            return p(pts);
        }
        case "heart": return "M" + r1(w / 2) + " " + r1(h * 0.95) + "C" + r1(w * 0.1) + " " + r1(h * 0.65) + " 0 " + r1(h * 0.42) + " 0 " + r1(h * 0.27) + "C0 " + r1(h * 0.08) + " " + r1(w * 0.16) + " 0 " + r1(w * 0.28) + " 0C" + r1(w * 0.4) + " 0 " + r1(w * 0.48) + " " + r1(h * 0.08) + " " + r1(w / 2) + " " + r1(h * 0.2) +
            "C" + r1(w * 0.52) + " " + r1(h * 0.08) + " " + r1(w * 0.6) + " 0 " + r1(w * 0.72) + " 0C" + r1(w * 0.84) + " 0 " + r1(w) + " " + r1(h * 0.08) + " " + r1(w) + " " + r1(h * 0.27) + "C" + r1(w) + " " + r1(h * 0.42) + " " + r1(w * 0.9) + " " + r1(h * 0.65) + " " + r1(w / 2) + " " + r1(h * 0.95) + "Z";
        case "plus": { const a = w * 0.32, b = w * 0.68, c = h * 0.32, d = h * 0.68; return p([[a, 0], [b, 0], [b, c], [w, c], [w, d], [b, d], [b, h], [a, h], [a, d], [0, d], [0, c], [a, c]]); }
        case "arrowR": return p([[0, h * 0.28], [w * 0.62, h * 0.28], [w * 0.62, 0], [w, h / 2], [w * 0.62, h], [w * 0.62, h * 0.72], [0, h * 0.72]]);
        case "arrowL": return p([[w, h * 0.28], [w * 0.38, h * 0.28], [w * 0.38, 0], [0, h / 2], [w * 0.38, h], [w * 0.38, h * 0.72], [w, h * 0.72]]);
        case "arrowU": return p([[w * 0.28, h], [w * 0.28, h * 0.38], [0, h * 0.38], [w / 2, 0], [w, h * 0.38], [w * 0.72, h * 0.38], [w * 0.72, h]]);
        case "arrowD": return p([[w * 0.28, 0], [w * 0.72, 0], [w * 0.72, h * 0.62], [w, h * 0.62], [w / 2, h], [0, h * 0.62], [w * 0.28, h * 0.62]]);
        case "chevron": return p([[0, 0], [w * 0.7, 0], [w, h / 2], [w * 0.7, h], [0, h], [w * 0.3, h / 2]]);
        case "banner": return p([[0, 0], [w, 0], [w * 0.92, h / 2], [w, h], [0, h], [w * 0.08, h / 2]]);
        case "callout": { const r = Math.min(28, w / 4, h / 4), b = h * 0.76; return "M" + r + " 0H" + r1(w - r) + "Q" + r1(w) + " 0 " + r1(w) + " " + r + "V" + r1(b - r) + "Q" + r1(w) + " " + r1(b) + " " + r1(w - r) + " " + r1(b) + "H" + r1(w * 0.38) + "L" + r1(w * 0.16) + " " + r1(h) + "L" + r1(w * 0.22) + " " + r1(b) + "H" + r + "Q0 " + r1(b) + " 0 " + r1(b - r) + "V" + r + "Q0 0 " + r + " 0Z"; }
        case "cloud": {
            const b = h * 0.8, bumps = [[0.18, 0.5, 0.2], [0.34, 0.26, 0.24], [0.6, 0.22, 0.27], [0.82, 0.44, 0.2], [0.68, 0.66, 0.2], [0.38, 0.68, 0.22]];
            let d = ""; bumps.forEach(([cx, cy, rr]) => { const rx = rr * w, ry = rr * b * 1.25, x = cx * w, y = cy * b; d += "M" + r1(x - rx) + " " + r1(y) + "A" + r1(rx) + " " + r1(ry) + " 0 1 0 " + r1(x + rx) + " " + r1(y) + "A" + r1(rx) + " " + r1(ry) + " 0 1 0 " + r1(x - rx) + " " + r1(y) + "Z"; });
            [[0.16, 0.9, 0.05], [0.08, 0.97, 0.03]].forEach(([cx, cy, rr]) => { const r = rr * Math.min(w, h * 2), x = cx * w, y = cy * h; d += "M" + r1(x - r) + " " + r1(y) + "A" + r1(r) + " " + r1(r) + " 0 1 0 " + r1(x + r) + " " + r1(y) + "A" + r1(r) + " " + r1(r) + " 0 1 0 " + r1(x - r) + " " + r1(y) + "Z"; });
            return d;
        }
        default: return p([[0, 0], [w, 0], [w, h], [0, h]]);
    }
}
/** How far in from each side text sits inside a shape, as parts of the width and height. */
export function textInset(sh) {
    return { ellipse: [0.15, 0.15], tri: [0.25, 0.42], rtri: [0.08, 0.42], diamond: [0.25, 0.25], para: [0.2, 0.06], trap: [0.2, 0.08], pent: [0.16, 0.2], hex: [0.18, 0.12],
        oct: [0.12, 0.12], star: [0.3, 0.32], burst: [0.22, 0.22], heart: [0.2, 0.18], plus: [0.32, 0.32], arrowR: [0.04, 0.3], arrowL: [0.3, 0.3], arrowU: [0.3, 0.38], arrowD: [0.3, 0.08],
        chevron: [0.3, 0.1], banner: [0.12, 0.08], callout: [0.06, 0.06], cloud: [0.18, 0.16] }[sh] || [0, 0];
}

/* ---------- cleaning what comes back from the database ---------- */
/* ---------- glass blocks: the snap grid and its themes (Nov 26, Eddie: "the premium panel looks", fits Spotlight) ----------
   Spotlight puts Back and Live along the top and its toolbar and screens along the bottom, over the slide.
   FRAME is the part of the slide nothing covers: 2.5% in from the sides, 10% down from the top, 13% up from the bottom. */
export const FRAME = { x: 40, y: 90, w: 1520, h: 693 };
export const GAP = 24;
/* [id, name, cells as parts of the frame [x, y, w, h], what each cell starts as] */
const TS = 0.19;   // a title strip, as part of the frame's height
const C = (hd, html, x) => Object.assign({ hd, html }, x || {});
const TITLE = (t) => C("", "<b>" + t + "</b>", { fs: 64, ff: "display", va: "m", pad: 18 });
const CENTER = (t) => '<div style="text-align:center">' + t + "</div>";
export const GRIDS = [
    ["one", "One", [[0, 0, 1, 1]], [C("Notes", "<ul><li>First point</li><li>Second point</li><li>Third point</li></ul>", { fs: 48 })]],
    ["two", "Two", [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]], [C("Example", "Type here"), C("Try it", "Type here")]],
    ["three", "Three", [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]], [C("I do", "Watch me solve one."), C("We do", "Let's solve one together.", { ap: 1 }), C("You do", "Your turn. Show every step.", { ap: 2 })]],
    ["four", "Four", [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]], [C("1", "Type a problem", { fs: 48, va: "m" }), C("2", "Type a problem", { fs: 48, va: "m" }), C("3", "Type a problem", { fs: 48, va: "m" }), C("4", "Type a problem", { fs: 48, va: "m" })]],
    ["six", "Six", [[0, 0, 1 / 3, 0.5], [1 / 3, 0, 1 / 3, 0.5], [2 / 3, 0, 1 / 3, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]], [1, 2, 3, 4, 5, 6].map((i) => C("Station " + i, "Type the task", { fs: 36 }))],
    ["fouracross", "Four across", [[0, 0, 0.25, 1], [0.25, 0, 0.25, 1], [0.5, 0, 0.25, 1], [0.75, 0, 0.25, 1]], [1, 2, 3, 4].map((i) => C("Step " + i, "Type this step", i > 1 ? { fs: 36, ap: i - 1 } : { fs: 36 }))],
    ["bigside", "Big + side", [[0, 0, 0.63, 1], [0.63, 0, 0.37, 0.5], [0.63, 0.5, 0.37, 0.5]], [C("Warm-up", "Type the problem here", { fs: 52 }), C("Hint", "Type a hint"), C("Answer", CENTER("The answer shows on Next"), { gl: 2, ap: 1, va: "m", fs: 48 })]],
    ["sidebig", "Side + big", [[0, 0, 0.37, 1], [0.37, 0, 0.63, 1]], [C("Word", CENTER("<b>word</b>"), { fs: 64, va: "m" }), C("What it means", "Type the meaning, then an example", { ap: 1 })]],
    ["bigthree", "Big + three", [[0, 0, 0.63, 1], [0.63, 0, 0.37, 1 / 3], [0.63, 1 / 3, 0.37, 1 / 3], [0.63, 2 / 3, 0.37, 1 / 3]], [C("Problem", "Type the problem here", { fs: 52 }), C("Step 1", "Type the first step", { fs: 32, ap: 1 }), C("Step 2", "Type the next step", { fs: 32, ap: 2 }), C("Answer", CENTER("The answer"), { gl: 2, ap: 3, va: "m", fs: 40 })]],
    ["twoone", "Two over one", [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1, 0.5]], [C("Example", "Type here"), C("Try it", "Type here"), C("Exit ticket", "Type the exit question", { gl: 2, ap: 1 })]],
    ["onetwo", "One over two", [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]], [C("Question", CENTER("Type the question here"), { fs: 56, va: "m" }), C("Work it out", "Show your work"), C("Answer", CENTER("The answer shows on Next"), { gl: 2, ap: 1, va: "m", fs: 48 })]],
    ["qa", "Question + answer", [[0, 0, 1, 0.66], [0, 0.66, 1, 0.34]], [C("Question", CENTER("Type the question here"), { fs: 72, va: "m" }), C("Answer", CENTER("The answer shows when you press Next"), { gl: 2, ap: 1, fs: 56, va: "m" })]],
    ["titletwo", "Title + two", [[0, 0, 1, TS], [0, TS, 0.5, 1 - TS], [0.5, TS, 0.5, 1 - TS]], [TITLE("Title"), C("Left", "Type here"), C("Right", "Type here")]],
    ["titlethree", "Title + three", [[0, 0, 1, TS], [0, TS, 1 / 3, 1 - TS], [1 / 3, TS, 1 / 3, 1 - TS], [2 / 3, TS, 1 / 3, 1 - TS]], [TITLE("Today we practice"), C("I do", "Watch me solve one."), C("We do", "Let's solve one together.", { ap: 1 }), C("You do", "Your turn. Show every step.", { ap: 2 })]],
    ["titlebig", "Title + big", [[0, 0, 1, TS], [0, TS, 0.63, 1 - TS], [0.63, TS, 0.37, 1 - TS]], [TITLE("Title"), C("Notes", "Type the main idea here", { fs: 44 }), C("Check", "A quick question", { gl: 2, ap: 1 })]],
];
/** A grid's cells in slide units, with a gap between them and none at the frame's edge. */
export function gridCells(id) {
    const g = GRIDS.find((x) => x[0] === id) || GRIDS[0], F = FRAME, W = F.w + GAP, H = F.h + GAP;
    return g[2].map(([fx, fy, fw, fh]) => {
        const x0 = F.x + fx * W, x1 = F.x + (fx + fw) * W - GAP, y0 = F.y + fy * H, y1 = F.y + (fy + fh) * H - GAP;
        return { x: r1(x0), y: r1(y0), w: r1(x1 - x0), h: r1(y1 - y0) };
    });
}
/* Ready-made themes: [id, name, { c, f, o, r }, bg?]. Built from the panel colors and finishes Eddie already has. "panels" is the default (no th).
   A theme with a bg sets the slide's background too: Aurora glass (Nov 27) is clear navy glass on the Aurora glow. */
export const THEMES = [
    ["panels", "Match my panels", null],
    ["aurora", "Aurora glass", { c: "navy", f: "glass", o: 38, r: "soft" }, { t: "grad", g: "aurora" }],
    ["board", "My board colors", { c: "board", f: "glass", o: 82, r: "soft" }],
    ["frost", "Frosted glass", { c: "paper", f: "glass", o: 55, r: "soft" }],
    ["night", "Night glass", { c: "night", f: "glass", o: 62, r: "soft" }],
    ["ocean", "Ocean glass", { c: "ocean", f: "glass", o: 64, r: "soft" }],
    ["forest", "Forest glass", { c: "forest", f: "glass", o: 64, r: "soft" }],
    ["plum", "Plum glass", { c: "plum", f: "glass", o: 64, r: "soft" }],
    ["navy", "Navy fade", { c: "navy", f: "grad", o: 94, r: "soft" }],
    ["berry", "Berry fade", { c: "berry", f: "grad", o: 94, r: "soft" }],
    ["lilac", "Lilac fade", { c: "lilac", f: "grad", o: 96, r: "round" }],
    ["candy", "Glossy candy", { c: "sky", f: "glossy", o: 100, r: "soft" }],
    ["mint", "Glossy mint", { c: "mint", f: "glossy", o: 100, r: "round" }],
    ["neon", "Neon", { c: "night", f: "glow", o: 88, r: "soft" }],
    ["neonberry", "Neon berry", { c: "berry", f: "glow", o: 88, r: "soft" }],
    ["sunny", "Sunny paper", { c: "sun", f: "grain", o: 100, r: "soft" }],
    ["rose", "Rose paper", { c: "rose", f: "grain", o: 100, r: "soft" }],
    ["outline", "Bold outline", { c: "slate", f: "frame", o: 70, r: "soft" }],
    ["charcoal", "Charcoal", { c: "slate", f: "solid", o: 96, r: "square" }],
];
const COLOR_IDS = PANEL_COLORS.map((c) => c[0]), FIN_IDS = PANEL_FINISHES.map((f) => f[0]), CORNER_IDS = PANEL_CORNERS.map((c) => c[0]);
/** A slide's theme, cleaned; null means the default (Match my panels). */
export function cleanTheme(o) {
    if (!o || typeof o !== "object" || !COLOR_IDS.includes(o.c)) return null;
    return { c: o.c, f: pick(o.f, FIN_IDS, "glass"), o: int(o.o, MIN_SOLID, 100, 80), r: pick(o.r, CORNER_IDS, "soft") };
}
/** Which ready-made theme a slide's theme is, or "" when it is one of the teacher's own. */
export function themeId(th) {
    const t = cleanTheme(th); if (!t) return "panels";
    const m = THEMES.find((x) => x[2] && x[2].c === t.c && x[2].f === t.f && x[2].o === t.o && x[2].r === t.r); return m ? m[0] : "";
}
/** Whether a theme is dark (light words on it). null: the frosted default, which is light. */
export const themeDark = (th) => { const t = cleanTheme(th); return !!t && !!(PANEL_COLORS.find((c) => c[0] === t.c) || [])[5]; };

const FIELDS_BOX = ["sh", "fill", "ln", "lw", "dash", "rd", "sd", "html", "fs", "ff", "fc", "al", "va", "pad", "lh", "hd", "hf", "hc"];
export function cleanEl(o) {
    if (!o || typeof o !== "object") return null;
    const k = o.k, e = { id: idOf(o.id, "e"), k };
    if (k === "ln") {
        ["x1", "y1", "x2", "y2"].forEach((p, i) => { e[p] = r1(num(o[p], i % 2 ? -SH : -SW, i % 2 ? 2 * SH : 2 * SW, i % 2 ? 450 : (i ? 1000 : 600))); });
        if (e.x1 === e.x2 && e.y1 === e.y2) e.x2 += 1;
        e.ln = color(o.ln, "#14213d"); e.lw = r1(num(o.lw, 1, 40, 6)); e.dash = pick(o.dash, DASH, ""); e.a1 = pick(o.a1, HEADS, ""); e.a2 = pick(o.a2, HEADS, "");
    } else if (["bx", "tb", "pc", "mt", "st", "lg", "wk"].includes(k)) {
        e.x = r1(num(o.x, -SW, 2 * SW, 200)); e.y = r1(num(o.y, -SH, 2 * SH, 200));
        e.w = r1(num(o.w, 8, 4 * SW, 400)); e.h = r1(num(o.h, 8, 4 * SH, 200));
        const r = r1(num(o.r, -720, 720, 0) % 360); if (r) e.r = r > 180 ? r - 360 : r < -180 ? r + 360 : r;
    } else return null;
    const ap = int(o.ap, 0, 30, 0); if (ap) e.ap = ap;
    if (o.lk === true) e.lk = true;
    const op = r2(num(o.op, 0.1, 1, 1)); if (op < 1) e.op = op;
    if (k === "bx") {
        e.sh = pick(o.sh, SHAPES, "rect"); e.fill = color(o.fill, ""); e.ln = color(o.ln, ""); e.lw = r1(num(o.lw, 0, 40, 0)); e.dash = pick(o.dash, DASH, "");
        e.rd = r1(num(o.rd, 0, 400, e.sh === "round" ? 28 : 0)); if (o.sd === true) e.sd = true;
        e.html = sanitizeHtml(o.html); e.fs = r1(num(o.fs, 8, 400, 44)); e.ff = pick(o.ff, FONTS, "sans"); e.fc = color(o.fc, "");
        e.al = pick(o.al, ALIGN, "l"); e.va = pick(o.va, VALIGN, "t"); e.pad = r1(num(o.pad, 0, 200, 16)); e.lh = r2(num(o.lh, 0.8, 3, 1.2));
        const hd = str(o.hd, 80).trim(); if (hd) { e.hd = hd; e.hf = color(o.hf, "#10358a"); e.hc = color(o.hc, ""); }
        if (o.gl === 1 || o.gl === 2) e.gl = o.gl;
    } else if (k === "tb") {
        const src = Array.isArray(o.rows) && o.rows.length ? o.rows.slice(0, 12) : [["", ""], ["", ""]];
        let cols = 1; src.forEach((rw) => { if (Array.isArray(rw)) cols = Math.max(cols, Math.min(8, rw.length)); });
        e.rows = src.map((rw) => { const a = Array.isArray(rw) ? rw : [], out = []; for (let c = 0; c < cols; c++) out.push(str(a[c], 300)); return out; });
        e.fs = r1(num(o.fs, 8, 200, 36)); e.ff = pick(o.ff, FONTS, "sans"); e.fc = color(o.fc, ""); e.al = pick(o.al, ALIGN, "c");
        e.hdr = o.hdr !== false; e.hf = color(o.hf, "#10358a"); e.bd = color(o.bd, "#9fb8d8"); e.fill = color(o.fill, "#ffffff");
    } else if (k === "pc") {
        e.img = typeof o.img === "string" && /^[\w-]{1,24}$/.test(o.img) ? o.img : ""; e.fit = o.fit === "cover" ? "cover" : "contain";
        e.rd = r1(num(o.rd, 0, 400, 0)); e.ln = color(o.ln, ""); e.lw = r1(num(o.lw, 0, 40, 0)); if (o.sd === true) e.sd = true; e.alt = str(o.alt, 120);
        if (!e.img) return null;
    } else if (k === "mt") {
        const it = cleanItems([o.it])[0]; if (!it || it.k === "text") return null; it.x = 0.5; it.y = 0.5; it.r = 0; e.it = it;
    } else if (k === "st") {
        const s = cleanSticker({ t: o.t, v: o.v, c: o.c }); if (!s) return null; e.t = s.t; e.v = s.v; if (s.t === "w") e.c = s.c;
    } else if (k === "wk") {
        e.wid = typeof o.wid === "string" && /^[\w.-]{1,40}$/.test(o.wid) ? o.wid : ""; if (!e.wid) return null;
        e.n = int(o.n, 1, 30, 1); e.q = str(o.q, 400); e.std = str(o.std, 20);
    }
    return e;
}
/** The box around an element, for lines as well (x, y, w, h). */
export function boxOf(e) {
    if (e.k !== "ln") return { x: e.x, y: e.y, w: e.w, h: e.h };
    const x = Math.min(e.x1, e.x2), y = Math.min(e.y1, e.y2); return { x, y, w: Math.max(1, Math.abs(e.x2 - e.x1)), h: Math.max(1, Math.abs(e.y2 - e.y1)) };
}
export function cleanBg(o) {
    const b = o && typeof o === "object" ? o : {}, t = ["board", "color", "grad"].includes(b.t) ? b.t : "board", out = { t };
    if (t === "color") out.c = color(b.c, "#ffffff");
    if (t === "grad") out.g = pick(b.g, GRADS, "sky");
    if (t !== "board") { const p = pick(b.p, PATTERNS, ""); if (p) out.p = p; }
    return out;
}
export function cleanSlide(o) {
    if (!o || typeof o !== "object") return null;
    const s = { id: idOf(o.id, "s"), bg: cleanBg(o.bg), els: [] };
    const seen = new Set();
    (Array.isArray(o.els) ? o.els : []).forEach((x) => { const e = cleanEl(x); if (e && s.els.length < MAX_ELS) { if (seen.has(e.id)) e.id = newId("e"); seen.add(e.id); s.els.push(e); } });
    const nt = str(o.nt, MAX_NOTES); if (nt.trim()) s.nt = nt;
    if (o.hide === true) s.hide = true;
    const pn = cleanPanels(o.pn); if (pn) s.pn = pn;
    const th = cleanTheme(o.th); if (th) s.th = th;
    if (GRIDS.some((g) => g[0] === o.gd)) s.gd = o.gd;
    return s;
}
export function cleanDeck(o, max) {
    const d = { v: 1, slides: [] }, seen = new Set();
    (o && Array.isArray(o.slides) ? o.slides : []).forEach((x) => { const s = cleanSlide(x); if (s && d.slides.length < (max || MAX_SLIDES)) { if (seen.has(s.id)) s.id = newId("s"); seen.add(s.id); d.slides.push(s); } });
    if (o && o.nod === true) d.nod = true;
    return d;
}
/** The list of which lessons have slides (n: key -> how many show), and which skip the every-day slides (off). */
export function cleanIndex(o) {
    const n = {}, off = {}; const src = o && o.n && typeof o.n === "object" ? o.n : {}, so = o && o.off && typeof o.off === "object" ? o.off : {};
    Object.keys(src).slice(0, 2000).forEach((k) => { const c = int(src[k], 0, MAX_SLIDES, 0); if (c && (isLessonKey(k) || k === DAILY)) n[k] = c; });
    Object.keys(so).slice(0, 2000).forEach((k) => { if (so[k] === 1 && isLessonKey(k)) off[k] = 1; });
    return { v: 1, n, off };
}
/** Whether a lesson shows any slides, from the index alone (before its own slides have loaded). */
export function indexHas(idx, key, daily) {
    if (!idx || !idx.n) return false;
    return (idx.n[key] || 0) > 0 || (!(idx.off && idx.off[key]) && countShown(daily) > 0);
}
/** Slides the board shows for a lesson: the every-day slides first (unless this lesson turns them off), then its own. */
export function showList(daily, lesson) {
    const own = (lesson && lesson.slides) || [], all = (lesson && lesson.nod ? [] : ((daily && daily.slides) || []).map((s) => Object.assign({ daily: true }, s))).concat(own);
    return all.filter((s) => !s.hide);
}
/** How many times Next reveals something on a slide before moving on. A Show Steps piece takes one Next per step after its first. */
export const revealSteps = (s) => (s && s.els ? s.els.reduce((m, e) => Math.max(m, (e.ap || 0) + (e.k === "wk" ? (e.n || 1) - 1 : 0)), 0) : 0);
/** Which step a Show Steps piece is on after `step` Nexts on its slide (0 = the problem; it appears at its own ap). */
export const walkStep = (e, step) => Math.max(0, Math.min((e.n || 1) - 1, (step === Infinity ? (e.n || 1) : step) - (e.ap || 0)));

/* ---------- panels Spotlight opens on a slide (Nov 24: Slides builds the lesson, Spotlight teaches it) ---------- */
export const PANEL_MINS = [1, 2, 3, 5, 10, 15, 20];
export function cleanPanels(o) {
    if (!o || typeof o !== "object") return null;
    const out = {}, tm = int(o.tm, 0, 5400, 0);
    if (tm) out.tm = tm; if (o.tg === true) out.tg = true; if (o.ag === true) out.ag = true;
    return Object.keys(out).length ? out : null;
}
/** The panels in words, for a badge: "Timer 5 min, target". */
export function panelWords(pn) {
    if (!pn) return "";
    const w = []; if (pn.tm) w.push("Timer " + (pn.tm % 60 ? Math.round(pn.tm / 6) / 10 : pn.tm / 60) + " min"); if (pn.tg) w.push("target"); if (pn.ag) w.push("agenda");
    const t = w.join(", "); return t.charAt(0).toUpperCase() + t.slice(1);
}
export const countShown = (deck) => ((deck && deck.slides) || []).filter((s) => !s.hide).length;

/* ---------- new elements ---------- */
const TEXT = { k: "bx", sh: "rect", fill: "", ln: "", lw: 0, html: "", fs: 44, ff: "sans", fc: "", al: "l", va: "t", pad: 16, lh: 1.2 };
/** A glass block: words in the slide's theme, sized by the snap grid. */
const GLASS = Object.assign({}, TEXT, { gl: 1, pad: 24, fs: 40 });
/* What the Block menu adds: [id, name, one line, the block] */
export const BLOCKS = [
    ["notes", "Notes", "A glass block with a heading", () => ({ hd: "Notes", html: "" })],
    ["question", "Question", "Big words in the middle", () => ({ hd: "Question", html: "", fs: 64, al: "c", va: "m" })],
    ["answer", "Answer on Next", "Hidden until you press Next", () => ({ hd: "Answer", html: "", gl: 2, fs: 52, al: "c", va: "m", ap: 1 })],
    ["steps", "Steps", "A numbered list, one step per line", () => ({ hd: "Steps", html: "<ol><li>First step</li><li>Next step</li></ol>", fs: 40 })],
    ["target", "Learning target", "Today's \"I can\" from your plan", () => ({ hd: "Learning target", html: "{{lt}}", gl: 2, fs: 40 })],
    ["agenda", "Agenda", "Today's agenda from your plan", () => ({ hd: "Agenda", html: "{{agenda}}", fs: 40 })],
    ["title", "Title strip", "A wide strip for the slide's title", () => ({ hd: "", html: "<b>Title</b>", fs: 64, ff: "display", va: "m", pad: 18 })],
];
/** A glass block from the Block menu, at x (its box in slide units). */
export function newBlock(kind, box) {
    const b = BLOCKS.find((x) => x[0] === kind) || BLOCKS[0];
    return cleanEl(Object.assign({ id: newId("e") }, GLASS, b[3](), box || { x: 400, y: 236, w: 800, h: 400 }));
}
/** Where a new block goes on a slide: the first cell of the slide's grid nothing covers yet, else the frame's free middle. */
export function freeSpot(slide, kind) {
    const els = (slide && slide.els) || [], over = (c) => els.some((e) => { const b = boxOf(e); return b.x < c.x + c.w - 8 && b.x + b.w > c.x + 8 && b.y < c.y + c.h - 8 && b.y + b.h > c.y + 8; });
    const order = [slide && slide.gd, "bigside", "four", "two", "titletwo"].filter(Boolean);
    for (const g of order) { const free = gridCells(g).find((c) => !over(c)); if (free && !(kind === "title" && free.h > 300)) return free; }
    if (kind === "title") return { x: FRAME.x, y: FRAME.y, w: FRAME.w, h: r1(FRAME.h * TS - GAP / 2) };
    return { x: 400, y: 236, w: 800, h: 400 };
}
/** A new slide laid out on a grid, every cell a glass block. th: the theme (null for Match my panels). */
export function gridSlide(id, th) {
    const g = GRIDS.find((x) => x[0] === id) || GRIDS[0], cells = gridCells(g[0]);
    const s = cleanSlide({ id: newId("s"), bg: { t: "board" }, gd: g[0], th, els: cells.map((c, i) => Object.assign({}, GLASS, g[3][i] || {}, c)) });
    return s;
}
/** Put a slide's glass blocks into a grid's cells, in reading order; cells left over get new blocks, extra blocks stay where they are. */
export function snapToGrid(slide, id) {
    const g = GRIDS.find((x) => x[0] === id) || GRIDS[0], cells = gridCells(g[0]);
    const blocks = slide.els.filter((e) => e.gl).sort((a, b) => (Math.abs(a.y - b.y) > 60 ? a.y - b.y : a.x - b.x));
    cells.forEach((c, i) => {
        const b = blocks[i];
        if (b) { b.x = c.x; b.y = c.y; b.w = c.w; b.h = c.h; delete b.r; }
        else if (slide.els.length < MAX_ELS) slide.els.push(cleanEl(Object.assign({ id: newId("e") }, GLASS, g[3][i] || {}, c)));
    });
    slide.gd = g[0];
    return slide;
}
export function newEl(kind, o) {
    const at = o || {};
    const base = (x) => cleanEl(Object.assign({ id: newId("e") }, x, at));
    switch (kind) {
        case "text": return base(Object.assign({}, TEXT, { x: 200, y: 330, w: 1200, h: 160, html: "" }));
        case "title": return base(Object.assign({}, TEXT, { x: 120, y: 60, w: 1360, h: 150, fs: 96, ff: "display", al: "c", va: "m", html: "<b>Title</b>" }));
        case "block": return base(Object.assign({}, GLASS, { x: 400, y: 236, w: 800, h: 400, hd: at.hd != null ? at.hd : "Notes", html: "" }));
        case "card": return base(Object.assign({}, TEXT, { sh: "round", rd: 28, fill: "#ffffff", ln: "#dce7f5", lw: 2, sd: true, x: 420, y: 250, w: 760, h: 420, pad: 28, fs: 44, hd: "Card", hf: "#10358a" }));
        case "sticky": return base(Object.assign({}, TEXT, { sh: "rect", fill: "#fff3b0", sd: true, x: 600, y: 260, w: 400, h: 360, pad: 28, fs: 52, ff: "hand", al: "c", va: "m", r: -2 }));
        case "shape": return base(Object.assign({}, TEXT, { sh: at.sh || "rect", fill: "#7faedd", ln: "#10358a", lw: 5, x: 600, y: 270, w: 400, h: 360, al: "c", va: "m", fs: 48, pad: 12 }));
        case "line": return base({ k: "ln", x1: 560, y1: 450, x2: 1040, y2: 450, ln: "#14213d", lw: 8, a2: at.a2 != null ? at.a2 : "" });
        case "table": { const rr = Math.max(1, Math.min(12, at.nr || 3)), cc = Math.max(1, Math.min(8, at.nc || 3)); const rows = []; for (let i = 0; i < rr; i++) { const r = []; for (let j = 0; j < cc; j++) r.push(i === 0 ? (cc === 2 ? ["x", "y"][j] : "Column " + (j + 1)) : ""); rows.push(r); }
            return base({ k: "tb", x: 800 - Math.min(1400, cc * 230) / 2, y: 450 - rr * 46, w: Math.min(1400, cc * 230), h: rr * 92, rows, fs: 40 }); }
        case "picture": return base({ k: "pc", x: 500, y: 200, w: 600, h: 450, fit: "contain" });
        case "math": return base({ k: "mt", x: 550, y: 200, w: 500, h: 500 });
        case "sticker": return base({ k: "st", x: 700, y: 330, w: 200, h: 200 });
        case "logo": return base({ k: "lg", x: 60, y: 40, w: 120, h: 120 });
        case "walk": return base({ k: "wk", x: 40, y: 172, w: 1520, h: 696, wid: at.wid, n: at.n, q: at.q, std: at.std });
    }
    return null;
}
/** A box that fits a math tool's own shape, centred where the user is looking. */
export function mathBox(it, geomFn) {
    const g = geomFn(Object.assign({}, it, { s: 1 }), 1000, 1000), ar = g.h / g.w;
    let w = it.k === "fraccircle" || it.k === "protractor" ? 460 : it.k === "plane" ? 560 : it.k === "tile" ? (it.t === "x" ? 420 : it.t === "x2" ? 300 : 110) : 900;
    let h = w * ar; if (h > 700) { h = 700; w = h / ar; }
    return { x: r1(800 - w / 2), y: r1(450 - h / 2), w: r1(w), h: r1(h) };
}

/* ---------- slides to start from ----------
   Nov 26 (Eddie: "get rid of those layouts... make it fit and look good on the spotlight view"): every starter is glass
   blocks in the slide's theme, inside FRAME. They are written on the full slide (40-1560 across, 30-870 down) and
   squeezed into the frame, so Spotlight's buttons never sit on them. */
const S1 = (els, bg) => cleanSlide({ id: newId("s"), bg: bg || { t: "board" }, els: inFrame(els) });
function inFrame(els) {
    const k = FRAME.h / 840, fy = (y) => r1(FRAME.y + (y - 30) * k);
    return els.map((e) => (e.k === "ln" ? e : Object.assign({}, e, { y: fy(e.y), h: r1(e.h * k) })));
}
const banner = (title, sub) => [Object.assign({}, GLASS, { x: 40, y: 30, w: 1520, h: 118, pad: 14, fs: 56, ff: "display", va: "m",
    html: "<b>" + esc(title) + "</b>" + (sub ? '  <span style="font-size:0.6em">' + esc(sub) + "</span>" : "") })];
const card = (x, y, w, h, hd, html, extra) => Object.assign({}, GLASS, { x, y, w, h, pad: 22, fs: 38, hd, html }, extra || {});
/** The old Layout menu's names, kept for anything that still asks for one: a blank slide, then the grids. */
export const LAYOUTS = [["blank", "Blank", () => cleanSlide({ id: newId("s"), bg: { t: "board" }, els: [] })]].concat(GRIDS.map((g) => [g[0], g[1], () => gridSlide(g[0])]));
/** The built-in Today screen as pieces: the header, Bell Ringer, Agenda, Supplies, Reminders, This Week and the target, filled in live. */
export function todaySlide() {
    return S1(banner("{{day}} · {{topic}}", "{{date}}").concat([
        card(40, 180, 500, 330, "Bell Ringer", "{{bell}}", { fs: 44 }),
        card(560, 180, 500, 330, "Agenda", "{{agenda}}", { fs: 40 }),
        card(1080, 180, 480, 330, "This Week", "{{week}}", { fs: 30 }),
        card(40, 530, 500, 330, "Supplies", "{{supplies}}", { fs: 40 }),
        card(560, 530, 500, 330, "Reminders", "{{reminders}}", { fs: 40 }),
        card(1080, 530, 480, 330, "Learning Target", "{{lt}}", { fs: 38, gl: 2 }),
    ]));
}
/** The built-in Weekly Agenda screen as pieces. */
export function agendaSlide(L) {
    const DK = ["Mon", "Tue", "Wed", "Thu", "Fri"], days = (L && L.days) || [];
    const els = banner("Weekly Agenda", "{{class}}");
    days.slice(0, 5).forEach((d, i) => els.push(card(40, 172 + i * 118, 1520, 104, "", "<b>" + DK[i] + "</b>  " + esc((d && d.agendaLine) || ""), { fs: 40, va: "m", pad: 22 })));
    els.push(card(40, 772, 1520, 100, "", "<b>Learning target:</b> {{weeklt}}", { fs: 36, va: "m", al: "c", pad: 16, gl: 2 }));
    return S1(els);
}
/** One question with its answer one Next away (a bellringer problem). */
export function problemSlide(title, sub, q, a) {
    const els = banner(title, sub);
    els.push(card(40, 180, 1520, a ? 440 : 680, "", "<div style=\"text-align:center\">" + esc(q) + "</div>", { fs: 76, va: "m" }));
    if (a) els.push(card(40, 650, 1520, 210, "Answer", "<div style=\"text-align:center\">" + esc(a) + "</div>", { fs: 64, va: "m", gl: 2, ap: 1 }));
    return S1(els);
}
/** Bank problems use § for a dollar sign and $ for nothing (js/weekSheets.js rich); slides use $ as typed. */
export const bankText = (t) => String(t == null ? "" : t).replace(/\$/g, "").replace(/§/g, "$");
/** A standards-bank problem as a slide: the problem, and its checked answer one Next away. */
export function bankSlide(item, i, n) {
    return problemSlide("Practice", [item.std, n > 1 ? "Problem " + (i + 1) + " of " + n : ""].filter(Boolean).join(" · "), bankText(item.q), bankText(item.a));
}
/** A worked walkthrough as a slide: a banner, then the walkthrough filling the rest, one step per Next. */
export function walkSlide(item, steps) {
    const els = banner("Show Steps", item.std || "");
    els.push({ k: "wk", x: 40, y: 172, w: 1520, h: 696, wid: item.id, n: steps, q: bankText(item.q), std: item.std || "" });
    return S1(els);
}
/** A Guided Notes frame (js/boardApp.js notesFrames) as a slide: the question, then each step on its own Next, then the answer. */
export function frameSlide(f) {
    const els = banner(String(f.kind || "Notes").slice(0, 70), "");
    const blanks = !!f.blanks, q = String(f.q || ""), lines = (f.lines || []).slice(0, 8);
    const qHtml = blanks ? esc(q).replace(/\[([^\]]+)\]/g, (m, w) => "<u>" + "\u00a0".repeat(Math.max(6, Math.min(24, w.length * 2))) + "</u>") : esc(q);
    const qh = lines.length ? 200 : 460;
    els.push(card(40, 172, 1520, qh, "", qHtml, { fs: lines.length ? 54 : 66, va: "m" }));
    const top = 172 + qh + 18, room = 878 - top - (f.ans || blanks ? 160 : 0), each = lines.length ? Math.min(112, Math.floor(room / lines.length)) : 0;
    lines.forEach((ln, i) => {
        const m = typeof ln === "string" ? ln : (ln && ln.m) || "", why = ln && typeof ln === "object" && ln.why ? ln.why : "";
        els.push(card(40, top + i * each, 1520, each - 12, "", esc(m) + (why ? '  <span style="font-size:0.7em">' + esc(why) + "</span>" : ""), { fs: Math.min(46, Math.round(each * 0.42)), va: "m", pad: 18, ap: f.open ? 0 : i + 1 }));
    });
    if (blanks) {
        const words = (q.match(/\[([^\]]+)\]/g) || []).map((w) => w.slice(1, -1)).join(", ");
        if (words) els.push(card(40, 718, 1520, 150, "Missing words", "<div style=\"text-align:center\">" + esc(words) + "</div>", { fs: 52, va: "m", gl: 2, ap: (f.open ? 0 : lines.length) + 1 }));
    } else if (f.ans) els.push(card(40, 718, 1520, 150, "Answer", "<div style=\"text-align:center\">" + esc(f.ans) + "</div>", { fs: 52, va: "m", gl: 2, ap: (f.open ? 0 : lines.length) + 1 }));
    return S1(els);
}
/**
 * The lesson's plan as slides the teacher can change: Today, each bellringer problem with its answer, then each Guided Notes frame.
 * L: the class's week (days, label), i: the day, frames: notesFrames for that day (PDF pages are skipped: they stay on Guided Notes).
 */
export function fromPlan(L, i, frames, opts) {
    const d = L && L.days && L.days[i], o = opts || {}, out = [];
    if (o.today !== false) out.push(todaySlide());
    if (o.agenda) out.push(agendaSlide(L));
    const ps = (d && d.problems) || [];
    ps.forEach((p, j) => { if (p && p.q) out.push(problemSlide("Bellringer", "Problem " + (j + 1) + " of " + ps.length, p.q, p.a || "")); });
    (frames || []).forEach((f) => { if (f && !f.pdf) out.push(frameSlide(f)); });
    return out.slice(0, MAX_SLIDES);
}
export { MATH_NAMES };
