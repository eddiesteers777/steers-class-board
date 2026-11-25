/* The basic and scientific calculator panels (Math tools, "calc" and "sci").
   Typed the way it is said, with the order of operations, and the answer shows as you go. The scientific one adds
   powers, roots, trig in degrees or radians, logs, Ans, and answers as fractions. The maths is calcValue in
   js/graphCalc.js. The line being typed and the last answers are saved in S.tools.mt, so the board and the Remote match. */
import * as G from "./graphCalc.js?v=1";

const BASIC = [
    ["AC", "±", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "−"],
    ["1", "2", "3", "+"],
    ["0", ".", "⌫", "="],
];
const SCI = [
    ["sin", "cos", "tan", "AC", "(", ")", "÷"],
    ["sin⁻¹", "cos⁻¹", "tan⁻¹", "7", "8", "9", "×"],
    ["x²", "xʸ", "√", "4", "5", "6", "−"],
    ["ln", "log", "π", "1", "2", "3", "+"],
    ["1/x", "x!", "Ans", "0", ".", "⌫", "="],
];
const INS = { "sin⁻¹": "sin⁻¹(", "cos⁻¹": "cos⁻¹(", "tan⁻¹": "tan⁻¹(", sin: "sin(", cos: "cos(", tan: "tan(", ln: "ln(", log: "log(", "√": "√(", "x²": "²", "xʸ": "^", π: "π", Ans: "Ans", "x!": "!" };
const OPS = /[+−×÷^]$/;
/** The calculator's own symbols into the reader's. */
const plain = (s) => s.replace(/sin⁻¹/g, "asin").replace(/cos⁻¹/g, "acos").replace(/tan⁻¹/g, "atan");

/** ctx: { shell, h, btn, st, save } from js/manipPanels.js. sci: the scientific one. */
export function makeCalc(k, ctx, sci) {
    const { h, btn } = ctx;
    const p = ctx.shell(k); p.root.classList.add("cc", sci ? "cc-sci" : "cc-basic");
    const scr = h("div", "cc-scr");
    const hist = h("div", "cc-hist");
    const inp = h("input", "cc-in"); inp.type = "text"; inp.id = "mtIn-" + k; inp.autocomplete = "off"; inp.spellcheck = false; inp.inputMode = "none"; inp.setAttribute("aria-label", "Calculation");
    const res = h("div", "cc-res"); res.setAttribute("aria-live", "polite");
    scr.append(hist, inp, res);
    const bar = h("div", "cc-bar");
    let degB = null, fracB = null;
    if (sci) {
        degB = btn("Deg", "cc-tg", () => { const S = ctx.st(k); S.d = !S.d; ctx.save(); }, "Switch degrees and radians");
        fracB = btn("a/b", "cc-tg", () => { const S = ctx.st(k); S.f = !S.f; ctx.save(); }, "Show answers as fractions");
        bar.append(degB, fracB, btn("±", "cc-tg", () => press("±"), "Make the last number negative"), btn("%", "cc-tg", () => press("%"), "Percent"), btn("|x|", "cc-tg", () => press("|x|"), "Absolute value"));
    }
    const pad = h("div", "cc-pad");
    (sci ? SCI : BASIC).forEach((row) => row.forEach((key) => {
        const cls = /^[0-9.]$/.test(key) ? " num" : key === "=" ? " eq" : key === "AC" ? " ac" : /^[+−×÷]$/.test(key) ? " op" : "";
        const b = h("button", "cc-k" + cls, key); b.type = "button"; b.dataset.k = key;
        b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); });
        b.onclick = (e) => { e.stopPropagation(); press(key); };
        pad.appendChild(b);
    }));
    p.main.append(scr, bar, pad);
    p.side.append(p.note);

    const S0 = () => ctx.st(k);
    const opts = () => ({ deg: !!S0().d, ans: Number.isFinite(S0().a) ? S0().a : 0 });
    function set(x, done) { const S = S0(); S.x = x.slice(0, 120); S.done = !!done; ctx.save(); }
    function press(key) {
        const S = S0(); let x = S.x || "";
        if (key === "AC") { set("", false); return; }
        if (key === "⌫") { set(S.done ? "" : x.replace(/(sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|sin\(|cos\(|tan\(|ln\(|log\(|√\(|Ans|.)$/, ""), false); return; }
        if (key === "=") { equals(); return; }
        if (S.done) {   // after an answer: an operator carries on from it, anything else starts fresh
            if (/^[+−×÷^%²!]$/.test(INS[key] || key) || key === "xʸ" || key === "x²" || key === "x!" || key === "%") x = S.r != null ? fmtIn(S.r) : "";
            else if (key !== "±") x = "";
        }
        if (key === "±") { x = negateLast(x); set(x, false); return; }
        if (key === "1/x") { x = x ? "1÷(" + x + ")" : "1÷"; set(x, false); return; }
        if (key === "|x|") { x = x + "abs("; set(x, false); return; }
        let t = INS[key] != null ? INS[key] : key;
        if (/^[+×÷−^]$/.test(t) && OPS.test(x) && !(t === "−" && /[×÷^]$/.test(x))) x = x.slice(0, -1);   // swap an operator, but allow 3×−2
        if (/^[+×÷^]$/.test(t) && !x) x = fmtIn(S.a || 0);
        set(x + t, false);
    }
    function equals() {
        const S = S0(), x = S.x || "";
        if (!x || S.done) return;
        const r = G.calcValue(plain(x), opts());
        if (r.err) { p.say(r.err, "amber"); return; }
        if (r.v == null) return;
        S.h = [{ x, v: r.v }].concat(Array.isArray(S.h) ? S.h : []).slice(0, 4);
        S.a = r.v; S.r = r.v; S.done = true;
        ctx.save();
    }
    function negateLast(x) {
        const m = /(\(−)?(\d*\.?\d+)(\))?$/.exec(x);
        if (!m) return x + "−";
        if (m[1] && m[3]) return x.slice(0, m.index) + m[2];
        return x.slice(0, m.index) + "(−" + m[2] + ")";
    }
    const fmtIn = (v) => G.fmt(v, 10).replace(/×10(.*)$/, (s) => s);   // the answer as the next line starts

    inp.addEventListener("focus", () => { p.busy = true; });
    inp.addEventListener("blur", () => { p.busy = false; if (inp.value !== (S0().x || "")) set(inp.value, false); });
    inp.addEventListener("input", () => { const S = S0(); S.x = inp.value.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−").slice(0, 120); S.done = false; show(); });
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); set(S0().x || "", false); equals(); } else if (e.key === "Escape") { set("", false); } });

    function show() {
        const S = S0(), x = S.x || "";
        if (document.activeElement !== inp && inp.value !== x) inp.value = x;
        hist.innerHTML = "";
        (S.h || []).slice(S.done ? 1 : 0).slice(0, sci ? 3 : 2).reverse().forEach((e) => {   // the answer on show is not repeated above it
            const line = h("button", "cc-h"); line.type = "button";
            line.append(h("span", null, e.x + " ="), h("b", null, ansText(e.v)));
            line.title = "Use this answer"; line.onclick = (ev) => { ev.stopPropagation(); const s = S0(); set((s.done ? "" : s.x || "") + fmtIn(e.v), false); };
            hist.appendChild(line);
        });
        res.className = "cc-res";
        if (S.done && S.r != null) { res.textContent = ansText(S.r); res.classList.add("done"); inp.classList.add("was"); }
        else {
            inp.classList.remove("was");
            const r = x ? G.calcValue(plain(x), opts()) : { v: null };
            res.textContent = r.v != null && !OPS.test(x) ? "= " + ansText(r.v) : x ? "" : "0";
            res.classList.toggle("zero", !x);
        }
        if (degB) { degB.textContent = S.d ? "Deg" : "Rad"; degB.classList.toggle("on", !!S.d); degB.setAttribute("aria-pressed", String(!!S.d)); }
        if (fracB) { fracB.classList.toggle("on", !!S.f); fracB.setAttribute("aria-pressed", String(!!S.f)); }
        scr.classList.toggle("long", x.length > (sci ? 22 : 16));
    }
    function ansText(v) {
        const S = S0();
        if (sci && S.f) { const f = G.fracOf(v); if (f) return f.text; }
        return G.fmt(v, 12);
    }
    p.sync = show;
    return p;
}
