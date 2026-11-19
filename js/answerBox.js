/* ==========================================
   Anchor Board — the student answer box (number, fraction, mixed number, exponent, scientific
   notation, one box per number, multiple choice, how many solutions).
   A copy of the box in js/play.js (Vault Raid), used by the assignment page (do.html), so Vault Raid
   is not touched while it runs in class every day. Styles come from css/play.css (.pabox …).
   Later, play.js can import this file instead of keeping its own copy.
========================================== */
import * as V from "./vaultCore.js?v=72";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };
const mathEl = (tag, cls, text) => { const e = el(tag, cls); e.append(V.mathText(text)); return e; };

/* ---------- the answer box ----------
   A plain box, a fraction (top and bottom boxes over a bar) and a mixed number, plus a ready-made
   shape when the answer needs one: tap a choice for how many solutions, a base and an exponent
   (3³), scientific notation (8 × 10⁵) or one box per number (6 and 7). The Remote says which one
   fits the question (V.answerKind); a student can still switch to a plain box. */
const KINDS = [["", "Number"], ["frac", "Fraction"], ["mixed", "Mixed number"]];
const SPECIAL = { sol: ["Choose", "✓"], mc: ["Choose", "✓"], pow: ["Exponent", "xⁿ"], sci: ["Sci. notation", "×10ⁿ"], list: ["Boxes", "□ □"] };
const SOLS = ["One solution", "No solution", "Infinitely many solutions"];
export function answerBox(kind, options) {
    if (kind === "mc" && !(Array.isArray(options) && options.length >= 2)) kind = "";   // multiple choice needs its choices
    const ineq = kind === "ineq"; if (ineq || (kind && !SPECIAL[kind] && !/^list[2-4]$/.test(kind) && !KINDS.some((k) => k[0] === kind))) kind = "";   // an inequality (or a shape this page doesn't know) goes in the plain box
    const lm = /^list([2-4])$/.exec(kind || ""), sk = lm ? "list" : SPECIAL[kind] ? kind : "", count = lm ? +lm[1] : 0;
    const kinds = sk === "mc" ? [["mc", "Choose"]] : (sk ? [[sk, SPECIAL[sk][0]]] : []).concat(KINDS);   // multiple choice: tap a choice, no other box
    const wrap = el("div", "pabox"); let mode = kinds.some((k) => k[0] === kind || k[0] === sk) ? (sk || kind) : "", neg = false, choice = "";
    const tabs = el("div", "patabs"); tabs.setAttribute("role", "radiogroup"); tabs.setAttribute("aria-label", "Answer type");
    const field = el("div", "pafield");
    const num = (label, cls) => { const i = el("input", "pnum" + (cls ? " " + cls : "")); i.inputMode = "numeric"; i.autocomplete = "off"; i.maxLength = 7; i.setAttribute("aria-label", label); i.oninput = () => { i.value = i.value.replace(/[^\d.]/g, "").slice(0, 7); }; return i; };
    // A box in a ready-made shape: numbers with a minus sign or decimal point (and letters for a base like x).
    const cell = (label, cls, letters) => { const i = el("input", "pnum" + (cls ? " " + cls : "")); i.autocomplete = "off"; i.maxLength = 8; i.inputMode = letters ? "text" : "decimal"; i.setAttribute("aria-label", label); i.oninput = () => { i.value = i.value.replace(/[−–]/g, "-").replace(letters ? /[^\da-zA-Z.\-]/g : /[^\d.\-]/g, "").slice(0, 8); }; return i; };
    const text = el("input", "ptext"); text.maxLength = 80; text.autocomplete = "off"; text.placeholder = ineq ? "Like x > 3" : "Your answer"; text.setAttribute("aria-label", "Your answer");
    // Inequality answers get buttons for the signs a Chromebook keyboard doesn't have (≤ ≥), plus the rest.
    const syms = el("div", "pasyms"); syms.setAttribute("aria-label", "Math symbols");
    if (ineq) ["x", "<", ">", "≤", "≥", "−", "or", "and"].forEach((sy) => {
        const b = btn("pasym", sy, () => {
            const put = sy === "or" || sy === "and" ? " " + sy + " " : sy === "−" ? "-" : sy, a = text.selectionStart != null ? text.selectionStart : text.value.length, z = text.selectionEnd != null ? text.selectionEnd : a;
            text.value = (text.value.slice(0, a) + put + text.value.slice(z)).slice(0, 80); const c = Math.min(80, a + put.length); text.focus(); try { text.setSelectionRange(c, c); } catch {}
        });
        b.onmousedown = (e) => e.preventDefault();   // keep the cursor in the box
        b.setAttribute("aria-label", { "<": "less than", ">": "greater than", "≤": "less than or equal to", "≥": "greater than or equal to", "−": "negative", x: "x", or: "or", and: "and" }[sy]);
        syms.append(b);
    });
    const whole = num("Whole number", "whole"), top = num("Top number (numerator)"), bot = num("Bottom number (denominator)");
    top.onkeydown = (e) => { if (e.key === "/" || (e.key === "Enter" && top.value && !bot.value)) { e.preventDefault(); bot.focus(); } };
    whole.onkeydown = (e) => { if (e.key === " " || (e.key === "Enter" && whole.value && !top.value)) { e.preventDefault(); top.focus(); } };
    const sign = btn("pasign", "+/−", () => { neg = !neg; sign.classList.toggle("on", neg); sign.setAttribute("aria-pressed", String(neg)); sign.textContent = neg ? "−" : "+/−"; });
    sign.setAttribute("aria-label", "Make it negative"); sign.setAttribute("aria-pressed", "false");
    const frac = el("span", "pafrac"); frac.append(top, el("i"), bot);
    // The ready-made shapes.
    const base = cell(kind === "pow" ? "Base" : "Number", "base", kind === "pow"), exp = cell("Exponent", "exp");
    exp.maxLength = 4;
    // Only one of these shapes is ever offered for a question, so they can share the two boxes.
    const powEl = el("span", "papow" + (sk === "sci" ? " sci" : ""));
    if (sk === "sci") powEl.append(base, el("span", "pax", "× 10"), exp); else powEl.append(base, exp);
    const boxes = Array.from({ length: count }, (_, i) => cell("Answer " + (i + 1) + " of " + count, "item"));
    const listEl = el("span", "palist"); boxes.forEach((b, i) => { if (i) listEl.append(el("span", "pajoin", i === count - 1 ? (count > 2 ? ", and" : "and") : ",")); listEl.append(b); });
    boxes.forEach((b, i) => { b.onkeydown = (e) => { if ((e.key === "," || e.key === " " || (e.key === "Enter" && b.value)) && boxes[i + 1] && !boxes[i + 1].value) { e.preventDefault(); boxes[i + 1].focus(); } }; });
    base.onkeydown = (e) => { if ((e.key === "^" || (e.key === "Enter" && base.value && !exp.value))) { e.preventDefault(); exp.focus(); } };
    const choiceEl = el("div", "pachoices" + (sk === "mc" ? " mc" : "")); choiceEl.setAttribute("role", "radiogroup"); choiceEl.setAttribute("aria-label", sk === "mc" ? "Answer choices" : "How many solutions?");
    (sk === "mc" ? options : SOLS).forEach((label, k) => {
        const c = btn("pachoice", sk === "mc" ? null : label, () => { choice = label; [...choiceEl.children].forEach((x) => { const on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); }); });
        if (sk === "mc") { c.append(el("b", "pachl", "ABCDE"[k]), mathEl("span", "pacht", label)); c.setAttribute("aria-label", "ABCDE"[k] + ": " + label); }
        c.setAttribute("role", "radio"); c.setAttribute("aria-checked", "false"); choiceEl.append(c);
    });
    const first = () => mode === "" ? text : mode === "mixed" ? whole : mode === "frac" ? top : mode === "list" ? boxes[0] : mode === "sol" || mode === "mc" ? choiceEl.firstChild : base;
    function show() {
        field.textContent = ""; field.classList.toggle("choices", mode === "sol" || mode === "mc");
        if (mode === "") { field.append(text); if (syms.childNodes.length) field.append(syms); }
        else if (mode === "sol" || mode === "mc") field.append(choiceEl);
        else if (mode === "pow" || mode === "sci") field.append(powEl);
        else if (mode === "list") field.append(listEl);
        else { field.append(sign); if (mode === "mixed") field.append(whole); field.append(frac); }
        [...tabs.children].forEach((b) => { const on = b.dataset.k === mode; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
    }
    kinds.forEach(([k, n]) => {
        const b = btn("patab", null, () => { mode = k; show(); first().focus(); });
        b.dataset.k = k; b.setAttribute("role", "radio"); b.title = n; b.setAttribute("aria-label", n);
        if (k === "") b.append(el("b", null, "123"));
        else if (SPECIAL[k]) b.append(el("b", null, SPECIAL[k][1]));
        else { const f = el("span", "frac"); f.append(el("span", null, "a"), el("span", null, "b")); if (k === "mixed") b.append(el("b", null, "1")); b.append(f); }
        b.append(el("small", null, n.replace(" number", ""))); tabs.append(b);
    });
    if (sk === "mc") tabs.hidden = true;   // only one way to answer
    wrap.append(tabs, field); show();
    return {
        el: wrap,
        focus() { first().focus(); },
        /** Put an answer read from the work pad into the box: into the fraction or exponent boxes when it fits them, otherwise the plain box. */
        fill(t) {
            t = String(t || "").trim(); if (!t) return;
            let m;
            if ((mode === "frac" || mode === "mixed") && (m = /^(-?)(?:(\d+) )?(\d+)\/(\d+)$/.exec(t))) { if (neg !== !!m[1]) sign.click(); whole.value = m[2] || ""; top.value = m[3]; bot.value = m[4]; if (m[2] && mode === "frac") { mode = "mixed"; show(); } return; }
            if (mode === "pow" && (m = /^(-?[\da-z.]+)\^(-?\d+)$/i.exec(t))) { base.value = m[1]; exp.value = m[2]; return; }
            if (mode === "list") { const parts = t.split(/\s*(?:,|and|&)\s*|\s+/).filter(Boolean); if (parts.length === count) { boxes.forEach((b, i) => { b.value = parts[i]; }); return; } }
            mode = ""; text.value = t.slice(0, 80); show();
        },
        /** The answer as text ("3/4", "-1 1/2", "12", "3^3", "8 × 10^5", "6, 7"), or an error message to show. */
        read() {
            if (mode === "") return { t: text.value.trim() };
            if (mode === "sol" || mode === "mc") return choice ? { t: choice } : { err: "Tap one of the choices." };
            if (mode === "pow" || mode === "sci") {
                const x = base.value.trim(), e = exp.value.trim();
                if (!x || !e) return { err: mode === "pow" ? "Fill in the base and the exponent." : "Fill in the number and the power of 10." };
                return { t: mode === "pow" ? x + "^" + e : x + " × 10^" + e };
            }
            if (mode === "list") { const v = boxes.map((b) => b.value.trim()); if (v.some((x) => !x)) return { err: "Fill in every box." }; return { t: v.join(", ") }; }
            const w = whole.value.trim(), a = top.value.trim(), b = bot.value.trim(), s = neg ? "-" : "";
            if (mode === "mixed" && w && !a && !b) return { t: s + w };
            if (!a || !b) return { err: mode === "mixed" ? "Fill in the whole number, the top and the bottom." : "Fill in the top and the bottom of the fraction." };
            if (+b === 0) return { err: "The bottom number can't be 0." };
            return { t: s + (mode === "mixed" && w ? w + " " : "") + a + "/" + b };
        }
    };
}

