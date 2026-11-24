/* ==========================================
   Anchor Board — the six math manipulative panels (Eddie, 2026-11-24: "more manipulatives on the board for me
   and the kids"). The model is js/manipCore.js; this file draws them and handles touch.

   Each is an ordinary board panel (js/panels.js buildPanel): on the shelf, floating, minimized to a live chip, sized
   from its corners, styled from its gear. What it shows is shared (tools.mt.<key>), so the board and the Remote match;
   a tap or a drag changes it on every screen.

   Built for a Promethean and a Chromebook: everything is drawn in SVG that grows with the panel, every control is a
   finger-sized button, and nothing is redrawn under a finger. Like the Find panel, each panel's DOM is one node kept
   between redraws of the board's panels, so a redraw never drops a drag, a half-typed equation or a spin in flight.
   A drag only moves things on this screen; the shared state is written once, when the finger lifts.
========================================== */
import * as M from "./manipCore.js?v=7";
import { makeCalc } from "./calcPanel.js?v=1";
import { makeGraph } from "./graphPanel.js?v=1";
import { makeAngle } from "./anglePanel.js?v=1";
import { makeFn } from "./fnPanel.js?v=1";
import { makeArea } from "./areaPanel.js?v=1";
import { makeNl } from "./nlPanel.js?v=1";

let api = null;
const panels = new Map();
const NS = "http://www.w3.org/2000/svg";

export const MT_TITLES = { balance: "Equation balance", chance: "Chance lab", line: "Line explorer", xform: "Transformations", pyth: "Pythagorean squares", counters: "Integer counters", angle: "Angle explorer", fn: "Function machine", area: "Expression area model", nl: "Rational number line", calc: "Basic calculator", sci: "Scientific calculator", graph: "Graphing calculator" };
export function mtBody(a, k) {
    api = a;
    let p = panels.get(k); if (!p) { p = MAKE[k](k); panels.set(k, p); }
    const sig = JSON.stringify(M.mtOf(a.S.tools, k));   // only redraw when this panel's own state changed
    if (!p.busy && sig !== p.sig) { p.sig = sig; p.sync(); }
    return p.root;
}

/* ---------- small helpers ---------- */
const st = (k) => M.mtOf(api.S.tools, k);
const save = () => api.push();
function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(label, cls, fn, aria) { const b = h("button", "mt-b" + (cls ? " " + cls : "")); b.type = "button"; b.innerHTML = label; if (aria) { b.setAttribute("aria-label", aria); b.title = aria; } b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; }
function s(tag, attrs, parent) { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function txt(parent, x, y, t, cls, extra) { const e = s("text", Object.assign({ x, y, class: cls || "" }, extra || {}), parent); e.textContent = t; return e; }
function svgPt(svg, e) { const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 }; const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return { x: q.x, y: q.y }; }
const clear = (e) => { while (e.firstChild) e.removeChild(e.firstChild); };
/** A drag that lives on this screen only: move() redraws locally, up() saves. */
function drag(p, target, { down, move, up }) {
    target.addEventListener("pointerdown", (e) => {
        if (e.button) return; if (down && down(e) === false) return;
        e.preventDefault(); e.stopPropagation(); p.busy = true;
        const mv = (ev) => { if (move) move(ev); };
        const end = (ev) => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); p.busy = false; if (up) up(ev, ev.type === "pointercancel"); };
        window.addEventListener("pointermove", mv); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
    });
}
/** The shell every panel shares: a note line that says what just happened, on this screen. */
function shell(k) {
    const root = h("div", "mt mt-" + k); root.dataset.key = k;
    root.addEventListener("pointerdown", (e) => e.stopPropagation());   // a touch inside never starts a panel drag
    const note = h("p", "mt-note"); note.setAttribute("role", "status");
    let nt = 0;
    const say = (t, tone) => { note.textContent = t || ""; note.dataset.tone = tone || ""; note.classList.toggle("on", !!t); clearTimeout(nt); if (t) nt = setTimeout(() => note.classList.remove("on"), 3800); };
    const main = h("div", "mt-main"), side = h("div", "mt-side"); root.append(main, side);
    return { root, main, side, note, say, busy: false };
}
/** A row of − n + for a small number. */
function stepper(label, get, set, min, max) {
    const w = h("div", "mt-step"); w.appendChild(h("span", "mt-sl", label));
    const v = h("b", "mt-sv");
    const go = (d) => { const n = Math.min(max, Math.max(min, get() + d)); if (n !== get()) set(n); };
    w.append(btn("−", "mt-sb", () => go(-1), "Less " + label.toLowerCase()), v, btn("+", "mt-sb", () => go(1), "More " + label.toLowerCase()));
    w.refresh = () => { v.textContent = String(get()); };
    return w;
}
/* A coordinate grid in an SVG, R units each way. Returns the scale helpers. */
function grid(svg, R, px, label) {
    const u = px / (2 * R + 2), X = (x) => (x + R + 1) * u, Y = (y) => (R + 1 - y) * u, g = s("g", { class: "mt-grid" }, svg);
    for (let i = -R; i <= R; i++) {
        s("line", { x1: X(i), y1: Y(-R), x2: X(i), y2: Y(R), class: i ? "gl" : "ax" }, g);
        s("line", { x1: X(-R), y1: Y(i), x2: X(R), y2: Y(i), class: i ? "gl" : "ax" }, g);
        if (i && i % label === 0) { txt(g, X(i), Y(0) + u * 0.95, M.fracText([i, 1]), "tk", { "text-anchor": "middle" }); txt(g, X(0) - u * 0.35, Y(i) + u * 0.32, M.fracText([i, 1]), "tk", { "text-anchor": "end" }); }
    }
    txt(g, X(R) + u * 0.45, Y(0) + u * 0.3, "x", "axl"); txt(g, X(0), Y(R) - u * 0.4, "y", "axl", { "text-anchor": "middle" });
    return { u, X, Y, ux: (px) => px / u - R - 1, uy: (py) => R + 1 - py / u };
}

/* ================= Equation balance ================= */
const TILE = { x: [12, 34], u: [12, 12] }, PIV = { x: 220, y: 58 }, ARM = 128;
function makeBalance(k) {
    const p = shell(k);
    const steps = h("div", "mt-hist"), eq = h("div", "mt-eq");
    const svg = s("svg", { viewBox: "0 0 440 262", class: "mt-svg mt-scale", role: "img" });
    s("path", { d: "M220 62 L220 236 M178 248 L262 248 L244 232 L196 232 Z", class: "bal-stand" }, svg);
    const beam = s("g", { class: "bal-beam" }, svg);
    s("rect", { x: PIV.x - ARM - 6, y: PIV.y - 5, width: ARM * 2 + 12, height: 10, rx: 5, class: "bal-arm" }, beam);
    s("circle", { cx: PIV.x, cy: PIV.y, r: 9, class: "bal-pin" }, svg);
    const pans = { L: s("g", { class: "bal-pan" }, svg), R: s("g", { class: "bal-pan" }, svg) };
    const tiles = { L: null, R: null };
    ["L", "R"].forEach((sd) => {
        const g = pans[sd];
        s("path", { d: "M0 0 L-82 104 M0 0 L82 104", class: "bal-str" }, g);
        s("path", { d: "M-90 104 L90 104 L80 116 L-80 116 Z", class: "bal-plate" }, g);
        s("circle", { cx: 0, cy: 0, r: 4, class: "bal-hook" }, g);
        tiles[sd] = s("g", { class: "bal-tiles" }, g);
    });
    const state = h("p", "mt-state");
    /* the tray: drag a tile onto a pan */
    const tray = h("div", "mt-tray"); tray.appendChild(h("span", "mt-sl", "Drag onto a pan"));
    [["x", 1, "x"], ["x", -1, "−x"], ["u", 1, "1"], ["u", -1, "−1"]].forEach(([kind, sg, lab]) => {
        const t = h("span", "bal-chip " + kind + (sg < 0 ? " neg" : "")); t.textContent = lab; t.setAttribute("role", "button"); t.tabIndex = 0;
        t.setAttribute("aria-label", "Drag a " + lab + " tile onto a pan"); tray.appendChild(t);
        let ghost = null;
        drag(p, t, {
            down: (e) => { ghost = t.cloneNode(true); ghost.classList.add("bal-ghost"); document.body.appendChild(ghost); place(e); },
            move: (e) => place(e),
            up: (e, cancel) => {
                ghost.remove(); ghost = null; if (cancel) return;
                const r = svg.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top - 20 || e.clientY > r.bottom) { p.say("Drop it on a pan."); return; }
                const side = svgPt(svg, e).x < PIV.x ? "L" : "R", B = st(k), was = B.s.slice(), why = M.balAdd(B, side, kind, sg);
                if (why) { p.say(why, "amber"); return; }
                const i = (side === "R" ? 2 : 0) + (kind === "x" ? 0 : 1);
                if (Math.sign(was[i]) === -sg && was[i]) p.say("A zero pair: " + (kind === "x" ? "x and −x" : "1 and −1") + " cancel out."); else p.say("");
                save();
            },
        });
        function place(e) { ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px"; }
    });
    /* both sides */
    let n = 1;
    const both = h("div", "mt-row mt-both"); both.appendChild(h("span", "mt-sl", "Both sides"));
    const nStep = stepper("", () => n, (v) => { n = v; drawBoth(); }, 1, 12); nStep.classList.add("mt-n");
    const opBtns = [["-", "u"], ["+", "u"], ["-", "x"], ["+", "x"], ["/", ""]].map(([op, kind]) => {
        const b = btn("", "mt-op", () => { const why = M.balBoth(st(k), op, n, kind); if (why) p.say(why, "amber"); else { p.say(""); save(); } });
        b.dataset.op = op; b.dataset.kind = kind; return b;
    });
    both.append(nStep, ...opBtns);
    function drawBoth() {
        nStep.refresh();
        opBtns.forEach((b) => { const op = b.dataset.op, kind = b.dataset.kind, nx = kind === "x" ? (n === 1 ? "" : n) + "x" : String(n);
            b.textContent = op === "/" ? "÷ " + n : (op === "-" ? "− " : "+ ") + nx; b.disabled = op === "/" && n < 2;
            b.setAttribute("aria-label", op === "/" ? "Divide both sides by " + n : (op === "-" ? "Take " : "Add ") + nx + (op === "-" ? " from" : " to") + " both sides"); });
    }
    /* set up */
    const form = h("form", "mt-row mt-set"); const inp = h("input", "mt-in"); inp.id = "mtIn-balance"; inp.type = "text"; inp.autocomplete = "off"; inp.spellcheck = false;
    inp.placeholder = "New equation, like 2x − 3 = x + 5"; inp.setAttribute("aria-label", "New equation");
    form.append(inp, btn("Set", "mt-go", () => form.requestSubmit()));
    form.onsubmit = (e) => { e.preventDefault(); const r = M.parseEq(inp.value); if (r.err) { p.say(r.err, "amber"); return; } M.balSet(st(k), r); inp.value = ""; inp.blur(); p.say("Set. The scale knows x; can the class find it?"); save(); };
    const tools = h("div", "mt-row mt-foot");
    tools.append(btn("Undo", "", () => { if (M.balUndo(st(k))) save(); }, "Undo the last move"), btn("Start over", "", () => { const B = st(k); M.balSet(B, B.e); save(); }, "Back to the starting equation"));
    p.main.append(steps, eq, svg, state); p.side.append(tray, both, form, tools, p.note);

    function tile(g, kind, neg, x, y, side) {
        const [w, hh] = TILE[kind], r = s("g", { class: "bal-t " + kind + (neg ? " neg" : ""), transform: "translate(" + x + " " + y + ")", tabindex: "0", role: "button", "aria-label": "Take " + (neg ? "−" : "") + (kind === "x" ? "x" : "1") + " off this pan" }, g);
        s("rect", { width: w, height: hh, rx: 2.5 }, r);
        txt(r, w / 2, kind === "x" ? hh / 2 + 4 : hh / 2 + 3.6, (neg ? "−" : "") + (kind === "x" ? "x" : ""), "tl", { "text-anchor": "middle" });
        r.addEventListener("click", (e) => { e.stopPropagation(); const why = M.balAdd(st(k), side, kind, neg ? 1 : -1); if (!why) { p.say("One side only: watch the scale."); save(); } });
    }
    function fill(sd, xs, us) {
        const g = tiles[sd]; clear(g);
        const nx = Math.abs(xs), nu = Math.abs(us), xw = Math.min(6, nx) * 14, uw = Math.min(6, nu) * 14, gap = nx && nu ? 8 : 0, left = -(xw + gap + uw) / 2;
        for (let i = 0; i < nx; i++) tile(g, "x", xs < 0, left + (i % 6) * 14, 102 - 34 - Math.floor(i / 6) * 36, sd);
        for (let i = 0; i < nu; i++) tile(g, "u", us < 0, left + xw + gap + (i % 6) * 14, 102 - 12 - Math.floor(i / 6) * 14, sd);
    }
    p.sync = () => {
        const B = st(k), tilt = M.balTilt(B), rad = tilt * Math.PI / 180, ok = tilt === 0, solved = M.balSolved(B);
        beam.style.transform = "rotate(" + tilt + "deg)";
        [["L", -1], ["R", 1]].forEach(([sd, dir]) => { const x = PIV.x + dir * ARM * Math.cos(rad), y = PIV.y + dir * ARM * Math.sin(rad); pans[sd].style.transform = "translate(" + x + "px," + y + "px)"; });
        fill("L", B.s[0], B.s[1]); fill("R", B.s[2], B.s[3]);
        eq.textContent = solved ? "x = " + solved.v : M.eqText(B.s); eq.classList.toggle("done", !!solved);
        clear(steps); B.h.slice(-3).forEach((x) => { const l = h("div", "mt-hl"); l.appendChild(h("span", null, M.eqText(x.s))); if (x.l) l.appendChild(h("i", null, x.l)); steps.appendChild(l); });
        state.textContent = solved ? "Solved: x = " + solved.v + ". Check it in " + M.sideText(B.e[0], B.e[1]) + " = " + M.sideText(B.e[2], B.e[3]) + "." : ok ? "Balanced" : "Not balanced: do the same to both sides";
        state.dataset.tone = solved ? "green" : ok ? "" : "amber";
        svg.setAttribute("aria-label", "Balance scale, " + (ok ? "level" : "tipped") + ": " + M.eqText(B.s));
        drawBoth();
    };
    return p;
}

/* ================= Chance lab ================= */
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function makeChance(k) {
    const p = shell(k);
    const modes = h("div", "mt-row mt-seg"); modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "What to use");
    const modeBtns = [["spin", false, "Spinner"], ["coin", false, "Coin"], ["dice", false, "1 die"], ["dice", true, "2 dice"]].map(([m, d2, lab]) => {
        const b = btn(lab, "mt-chip", () => { const C = st(k); if (C.m === m && !!C.d2 === d2) return; M.chanceMode(C, m, d2); p.lastAt = 0; save(); }); b.dataset.m = m; b.dataset.d2 = String(d2); modes.appendChild(b); return b;
    });
    const stage = h("div", "ch-stage");
    /* the spinner */
    const spin = s("svg", { viewBox: "-110 -118 220 228", class: "mt-svg ch-spin", role: "img" });
    const wheel = s("g", { class: "ch-wheel" }, spin);
    s("circle", { r: 100, class: "ch-rim" }, spin);
    s("circle", { r: 9, class: "ch-hub" }, spin);
    s("path", { d: "M-11 -114 L11 -114 L0 -90 Z", class: "ch-ptr" }, spin);
    /* the coin and the dice */
    const coin = h("div", "ch-coin"); const coinIn = h("div", "ch-coin-in"); coinIn.append(h("b", "ch-face h", "H"), h("b", "ch-face t", "T")); coin.appendChild(coinIn);
    const dice = h("div", "ch-dice");
    stage.append(spin, coin, dice);
    const last = h("p", "ch-last");
    const acts = h("div", "mt-row ch-acts");
    const go1 = btn("Spin", "mt-go ch-go", () => run(1)), go10 = btn("×10", "", () => run(10), "Run it 10 times"), go100 = btn("×100", "", () => run(100), "Run it 100 times");
    acts.append(go1, go10, go100, btn("Clear", "", () => { M.chanceReset(st(k)); p.lastAt = 0; save(); }, "Clear the results"));
    const chart = s("svg", { class: "mt-svg ch-chart", role: "img" }); const legend = h("p", "ch-leg");
    legend.innerHTML = '<span><i class="ch-k obs"></i>What happened</span><span><i class="ch-k exp"></i>Expected</span>';
    const setup = h("div", "mt-row mt-setup ch-setup");
    const slices = stepper("Slices", () => st(k).w.length, (v) => { M.chanceSlices(st(k), v); save(); }, 2, 6);
    setup.append(slices, h("span", "mt-hint", "Tap a slice to make it bigger"));
    p.main.append(stage, last); p.side.append(modes, acts, chart, legend, setup, p.note);
    p.lastAt = 0; let revealAt = 0, revealT = 0;
    function run(n) { const C = st(k); M.chanceRun(C, n); save(); }
    function drawWheel(C) {
        clear(wheel); const tot = C.w.reduce((a, x) => a + x, 0); let a0 = 0;
        C.w.forEach((w, i) => {
            const a1 = a0 + w / tot * 360, r = 100, P = (a) => [Math.sin(a * Math.PI / 180) * r, -Math.cos(a * Math.PI / 180) * r];
            const [x0, y0] = P(a0), [x1, y1] = P(a1), big = a1 - a0 > 180 ? 1 : 0;
            const path = s("path", { d: C.w.length === 1 ? "" : "M0 0 L" + x0 + " " + y0 + " A100 100 0 " + big + " 1 " + x1 + " " + y1 + " Z", fill: M.SPIN_COLS[i][1], class: "ch-slice" + (i === C.last && C.at ? " hit" : ""), tabindex: "0", role: "button",
                "aria-label": M.SPIN_COLS[i][0] + " slice, " + M.fracText(M.fracOf(C, i)) + ". Tap to make it bigger" }, wheel);
            path.addEventListener("click", (e) => { e.stopPropagation(); const W = st(k); if (W.m !== "spin") return; W.w[i] = W.w[i] >= 4 ? 1 : W.w[i] + 1; M.chanceReset(W); p.lastAt = 0; p.say(M.SPIN_COLS[i][0] + " is now " + M.fracText(M.fracOf(W, i)) + " of the spinner."); save(); });
            const mid = (a0 + a1) / 2, [lx, ly] = [Math.sin(mid * Math.PI / 180) * 64, -Math.cos(mid * Math.PI / 180) * 64];
            txt(wheel, lx, ly + 5, M.fracText(M.fracOf(C, i)), "ch-sl", { "text-anchor": "middle" });
            a0 = a1;
        });
    }
    function drawDice(C, roll) {
        clear(dice); (C.dv || (C.d2 ? [3, 4] : [5])).forEach((v) => {
            const d = h("div", "ch-die" + (roll ? " roll" : "")); for (let i = 0; i < 9; i++) d.appendChild(h("i", (PIPS[v] || []).includes(i) ? "pip" : "")); d.setAttribute("aria-label", "Die showing " + v); dice.appendChild(d);
        });
    }
    function drawChart(C) {
        const os = M.outcomes(C), n = M.trials(C), W = 300, H = 128, base = 104, top = 10, bw = Math.min(40, (W - 20) / os.length - 6), step = (W - 20) / os.length;
        const maxP = Math.max(...os.map((o) => o[1]), ...C.t.map((x) => (n ? x / n : 0)), 0.01);
        chart.setAttribute("viewBox", "0 0 " + W + " " + H); clear(chart);
        s("line", { x1: 8, x2: W - 8, y1: base, y2: base, class: "ch-base" }, chart);
        os.forEach((o, i) => {
            const cx = 10 + step * i + step / 2, obs = n ? C.t[i] / n : 0, ho = obs / maxP * (base - top - 14), he = o[1] / maxP * (base - top - 14);
            s("rect", { x: cx - bw / 2, y: base - ho, width: bw, height: Math.max(0, ho), rx: 3, fill: C.m === "spin" ? o[2] : "", class: "ch-bar" + (C.m === "spin" ? "" : " plain") + (i === C.last && C.at ? " hit" : "") }, chart);
            s("line", { x1: cx - bw / 2 - 3, x2: cx + bw / 2 + 3, y1: base - he, y2: base - he, class: "ch-exp" }, chart);
            if (n) txt(chart, cx, base - ho - 4, Math.round(obs * 100) + "%", "ch-pct", { "text-anchor": "middle" });
            txt(chart, cx, base + 13, C.m === "spin" ? M.fracText(M.fracOf(C, i)) : o[0], "ch-lab", { "text-anchor": "middle" });
            if (os.length <= 6) txt(chart, cx, base + 24, C.m === "spin" ? o[0] : C.m === "coin" ? "1/2" : M.fracText(M.fracOf(C, i)), "ch-lab2", { "text-anchor": "middle" });
        });
        chart.setAttribute("aria-label", n ? n + " trials: " + os.map((o, i) => o[0] + " " + C.t[i]).join(", ") : "No trials yet");
    }
    function drawLast(C) {
        const os = M.outcomes(C), n = M.trials(C);
        last.textContent = C.last >= 0 && n ? (C.m === "dice" && C.d2 ? "Rolled " + (C.dv ? C.dv.join(" + ") + " = " : "") + os[C.last][0] : C.m === "dice" ? "Rolled " + os[C.last][0] : C.m === "coin" ? os[C.last][0] : "Landed on " + os[C.last][0]) + " · " + n + (n === 1 ? " trial" : " trials")
            : { spin: "Spin it, or run it 100 times to see the pattern.", coin: "Flip it, or run it 100 times.", dice: "Roll, or run it 100 times." }[C.m];
    }
    p.sync = () => {
        const C = st(k), fresh = C.at && C.at !== p.lastAt && Date.now() - C.at < 6000, single = fresh && M.trials(C) - (p.lastN || 0) === 1;
        modeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === C.m && b.dataset.d2 === String(!!C.d2))));
        spin.style.display = C.m === "spin" ? "" : "none"; coin.style.display = C.m === "coin" ? "" : "none"; dice.style.display = C.m === "dice" ? "" : "none"; setup.hidden = C.m !== "spin";
        go1.textContent = { spin: "Spin", coin: "Flip", dice: "Roll" }[C.m]; slices.refresh();
        if (C.m === "spin") {
            drawWheel(C);
            if (fresh) { wheel.style.transition = "transform " + (single ? 2.6 : 1.2) + "s cubic-bezier(.12,.75,.18,1)"; requestAnimationFrame(() => { wheel.style.transform = "rotate(" + C.rot + "deg)"; }); }
            else { wheel.style.transition = "none"; wheel.style.transform = "rotate(" + (C.rot || 0) + "deg)"; }
        }
        if (C.m === "coin") { const face = C.last === 1 ? 180 : 0; if (fresh) { coinIn.style.transition = "none"; coinIn.style.transform = "rotateY(" + (face + 1080) + "deg)"; void coinIn.offsetWidth; coinIn.style.transition = "transform 1.1s cubic-bezier(.2,.7,.2,1)"; } else coinIn.style.transition = "none"; coinIn.style.transform = "rotateY(" + face + "deg)"; }
        if (C.m === "dice") drawDice(C, fresh);
        const wait = fresh ? (C.m === "spin" ? (single ? 2600 : 1200) : C.m === "coin" ? 1100 : 650) : 0;
        clearTimeout(revealT); const show = () => { drawChart(C); drawLast(C); stage.classList.remove("busy"); };
        if (wait) { stage.classList.add("busy"); revealAt = Date.now() + wait; revealT = setTimeout(show, wait); if (!chart.firstChild) drawChart(C); }
        else if (Date.now() >= revealAt) show();
        p.lastAt = C.at; p.lastN = M.trials(C);
    };
    return p;
}

/* ================= Line explorer ================= */
function makeLine(k) {
    const p = shell(k), R = M.LINE_R, PX = 300;
    const eq = h("div", "mt-eq ln-eq");
    const svg = s("svg", { viewBox: "0 0 " + PX + " " + PX, class: "mt-svg ln-svg", role: "img" });
    const G = grid(svg, R, PX, 3);
    const clip = s("clipPath", { id: "mtLnClip" }, s("defs", null, svg)); s("rect", { x: G.X(-R), y: G.Y(R), width: G.X(R) - G.X(-R), height: G.Y(-R) - G.Y(R) }, clip);
    const line = s("line", { class: "ln-line", "clip-path": "url(#mtLnClip)" }, svg);
    const tri = s("g", { class: "ln-tri" }, svg);
    const yint = s("circle", { r: 5, class: "ln-yint" }, svg);
    const pts = {};
    [["a", "A"], ["b", "B"]].forEach(([w, lab]) => {
        const g = s("g", { class: "ln-pt ln-" + w, tabindex: "0", role: "slider", "aria-label": "Point " + lab + ". Drag it, or use the arrow keys" }, svg);
        s("circle", { r: 15, class: "ln-hit" }, g); s("circle", { r: 7.5, class: "ln-dot" }, g);
        const t = txt(g, 11, -11, "", "ln-lab"); pts[w] = { g, t };
        let cur = null;
        drag(p, g, {
            down: () => { cur = st(k)[w].slice(); g.classList.add("drag"); },
            move: (e) => { const q = svgPt(svg, e), x = Math.round(G.ux(q.x)), y = Math.round(G.uy(q.y)), L = Object.assign({}, st(k)); L[w] = cur; const T = { a: L.a, b: L.b, tri: L.tri, eq: L.eq }; if (M.linePoint(T, w, x, y)) { cur = T[w]; draw(Object.assign({}, st(k), { [w]: cur })); } },
            up: (e, cancel) => { g.classList.remove("drag"); if (cancel) { draw(st(k)); return; } const L = st(k); if (L[w][0] !== cur[0] || L[w][1] !== cur[1]) { M.linePoint(L, w, cur[0], cur[1]); save(); } else draw(L); },
        });
        g.addEventListener("keydown", (e) => { const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!d) return; e.preventDefault(); const L = st(k); if (M.linePoint(L, w, L[w][0] + d[0], L[w][1] + d[1])) save(); });
    });
    const facts = h("div", "ln-facts");
    const tog = h("div", "mt-row mt-setup");
    const tTri = btn("Slope triangle", "mt-chip", () => { const L = st(k); L.tri = !L.tri; save(); }), tEq = btn("Equation", "mt-chip", () => { const L = st(k); L.eq = !L.eq; save(); });
    tog.append(tTri, tEq, btn("Start over", "", () => { Object.assign(st(k), M.lineDefault()); save(); }));
    p.main.append(svg); p.side.append(eq, facts, tog, p.note);
    function draw(L) {
        const o = M.lineOf(L), [ax, ay] = L.a, [bx, by] = L.b;
        if (o.vert) { line.setAttribute("x1", G.X(ax)); line.setAttribute("x2", G.X(ax)); line.setAttribute("y1", G.Y(R + 2)); line.setAttribute("y2", G.Y(-R - 2)); }
        else { const m = o.m[0] / o.m[1], f = (x) => ay + m * (x - ax); line.setAttribute("x1", G.X(-R - 2)); line.setAttribute("y1", G.Y(f(-R - 2))); line.setAttribute("x2", G.X(R + 2)); line.setAttribute("y2", G.Y(f(R + 2))); }
        [["a", L.a], ["b", L.b]].forEach(([w, q]) => { pts[w].g.setAttribute("transform", "translate(" + G.X(q[0]) + " " + G.Y(q[1]) + ")"); pts[w].t.textContent = (w === "a" ? "A" : "B") + M.ptText(q); pts[w].g.setAttribute("aria-valuetext", M.ptText(q)); });
        clear(tri);
        if (L.tri && !o.vert && o.rise) {
            s("path", { d: "M" + G.X(ax) + " " + G.Y(ay) + " H" + G.X(bx) + " V" + G.Y(by), class: "ln-tri-p" }, tri);
            txt(tri, (G.X(ax) + G.X(bx)) / 2, G.Y(ay) + (by > ay ? 15 : -7), "run " + M.fracText([o.run, 1]), "ln-tl run", { "text-anchor": "middle" });
            txt(tri, G.X(bx) + (bx > ax ? 6 : -6), (G.Y(ay) + G.Y(by)) / 2 + 4, "rise " + M.fracText([o.rise, 1]), "ln-tl rise", { "text-anchor": bx > ax ? "start" : "end" });
        }
        const bVal = o.vert ? null : o.b[0] / o.b[1]; yint.style.display = L.eq && bVal != null && Math.abs(bVal) <= R ? "" : "none"; if (bVal != null) { yint.setAttribute("cx", G.X(0)); yint.setAttribute("cy", G.Y(bVal)); }
        eq.textContent = L.eq ? M.lineEq(L) : "y = ?x + ?"; eq.classList.toggle("hid", !L.eq);
        clear(facts);
        const fact = (lab, val) => { const d = h("div", "ln-f"); d.append(h("span", null, lab), h("b", null, val)); facts.appendChild(d); };
        if (o.vert) { fact("Slope", "undefined"); fact("A vertical line", "x = " + M.fracText([o.x, 1])); }
        else {
            fact("Slope", L.eq ? (o.rise && o.run ? M.fracText([o.rise, 1]) + "/" + M.fracText([o.run, 1]) + (o.m[1] !== Math.abs(o.run) || o.m[0] !== o.rise ? " = " + M.fracText(o.m) : "") : M.fracText(o.m)) : "rise ÷ run = ?");
            fact("y-intercept", L.eq ? M.ptText([0, +(o.b[0] / o.b[1]).toFixed(2)]).replace(/\.\d+/, (x) => x) : "(0, ?)");
            if (L.eq && o.prop) fact("Proportional", "through (0, 0)");
        }
        svg.setAttribute("aria-label", "Line through " + M.ptText(L.a) + " and " + M.ptText(L.b));
        tTri.setAttribute("aria-pressed", String(L.tri)); tEq.setAttribute("aria-pressed", String(L.eq));
    }
    p.sync = () => draw(st(k));
    return p;
}

/* ================= Transformations ================= */
function makeXform(k) {
    const p = shell(k), R = M.XF_R, PX = 300;
    const rule = h("div", "mt-eq xf-rule");
    const svg = s("svg", { viewBox: "0 0 " + PX + " " + PX, class: "mt-svg xf-svg", role: "img" });
    const G = grid(svg, R, PX, 5);
    const pre = s("g", { class: "xf-pre" }, svg), img = s("g", { class: "xf-img", tabindex: "0", role: "button", "aria-label": "The image. Drag it to slide it" }, svg);
    const L = "ABCDEF";
    const moves = h("div", "xf-moves");
    const group = (lab, list) => { const r = h("div", "mt-row xf-g"); r.appendChild(h("span", "mt-sl", lab)); list.forEach(([code, txtL, aria]) => r.appendChild(btn(txtL, "mt-chip", () => { if (M.xfDo(st(k), code)) { p.say(M.moveOf(code).n + "."); save(); } }, aria))); moves.appendChild(r); };
    group("Slide", [["t-1,0", "←", "Slide left 1"], ["t1,0", "→", "Slide right 1"], ["t0,1", "↑", "Slide up 1"], ["t0,-1", "↓", "Slide down 1"]]);
    group("Flip", [["rx", "x-axis", "Reflect over the x-axis"], ["ry", "y-axis", "Reflect over the y-axis"], ["rxy", "y = x", "Reflect over the line y = x"]]);
    group("Turn", [["r90", "90° ↺", "Rotate 90° counterclockwise about the origin"], ["r180", "180°", "Rotate 180° about the origin"], ["r270", "90° ↻", "Rotate 90° clockwise about the origin"]]);
    group("Dilate", [["d2", "× 2", "Dilate by 2 from the origin"], ["dh", "× ½", "Dilate by 1/2 from the origin"]]);
    const list = h("ol", "xf-list"), table = h("div", "xf-table");
    const foot = h("div", "mt-row mt-foot");
    foot.append(btn("Undo", "", () => { const X = st(k); if (X.ops.length) { X.ops = X.ops.slice(0, -1); save(); } }, "Undo the last move"),
        btn("New shape", "", () => { const X = st(k); X.sh = (X.sh + 1) % M.SHAPES.length; X.ops = []; save(); }, "Try another shape"),
        btn("Start over", "", () => { st(k).ops = []; save(); }, "Back to the starting shape"));
    p.main.append(svg); p.side.append(rule, table, moves, list, foot, p.note);
    let off = [0, 0];
    drag(p, img, {
        down: (e) => { off = [0, 0]; img.classList.add("drag"); img._s = svgPt(svg, e); },
        move: (e) => { const q = svgPt(svg, e); off = [Math.round((q.x - img._s.x) / G.u), Math.round(-(q.y - img._s.y) / G.u)]; img.style.transform = "translate(" + off[0] * G.u + "px," + -off[1] * G.u + "px)"; },
        up: (e, cancel) => { img.classList.remove("drag"); img.style.transform = ""; if (!cancel && (off[0] || off[1]) && M.xfDo(st(k), "t" + off[0] + "," + off[1])) { p.say(M.moveOf("t" + off[0] + "," + off[1]).n + "."); save(); } else draw(st(k)); },
    });
    function poly(g, vs, prime) {
        clear(g); s("polygon", { points: vs.map(([x, y]) => G.X(x) + "," + G.Y(y)).join(" ") }, g);
        vs.forEach(([x, y], i) => { s("circle", { cx: G.X(x), cy: G.Y(y), r: 3.4 }, g); txt(g, G.X(x) + 5, G.Y(y) - 5, L[i] + (prime ? "′" : ""), "xf-l"); });
    }
    function draw(X) {
        const pv = M.SHAPES[X.sh][1], iv = M.xfImage(X);
        poly(pre, pv, false); poly(img, iv, X.ops.length > 0);
        rule.textContent = X.ops.length ? M.xfRule(X) : "Pick a move, or drag the shape"; rule.classList.toggle("hid", !X.ops.length);
        clear(list); X.ops.forEach((c) => list.appendChild(h("li", null, M.moveOf(c).n)));
        clear(table); pv.forEach((q, i) => { const r = h("div", "xf-row"); r.append(h("span", null, L[i] + M.ptText(q)), h("i", null, "→"), h("b", null, X.ops.length ? L[i] + "′" + M.ptText(iv[i]) : "")); table.appendChild(r); });
        if (M.xfOff(X)) p.say("Part of the image is off the grid.", "amber");
        svg.setAttribute("aria-label", M.SHAPES[X.sh][0] + (X.ops.length ? ", moved: " + M.xfRule(X) : ""));
    }
    p.sync = () => draw(st(k));
    return p;
}

/* ================= Pythagorean squares ================= */
function makePyth(k) {
    const p = shell(k);
    const eq = h("div", "mt-eq py-eq");
    const svg = s("svg", { class: "mt-svg py-svg", role: "img" });
    const sqA = s("g", { class: "py-sq a" }, svg), sqB = s("g", { class: "py-sq b" }, svg), sqC = s("g", { class: "py-sq c" }, svg), triG = s("g", { class: "py-tri" }, svg);
    const hA = s("g", { class: "py-h", tabindex: "0", role: "slider", "aria-label": "Leg a. Drag sideways, or use the arrow keys" }, svg), hB = s("g", { class: "py-h", tabindex: "0", role: "slider", "aria-label": "Leg b. Drag up and down, or use the arrow keys" }, svg);
    [hA, hB].forEach((g) => { s("circle", { r: 1.1, class: "py-hit" }, g); s("circle", { r: 0.42, class: "py-hd" }, g); });
    const work = h("div", "py-work");
    const steps = h("div", "mt-row mt-setup");
    const sa = stepper("a", () => st(k).a, (v) => { st(k).a = v; save(); }, 1, M.PY_MAX), sb = stepper("b", () => st(k).b, (v) => { st(k).b = v; save(); }, 1, M.PY_MAX);
    const tC = btn("Show c", "mt-chip", () => { const P = st(k); P.c = !P.c; save(); });
    steps.append(sa, sb, tC);
    p.main.append(svg); p.side.append(eq, work, steps, p.note);
    let view = null;
    function fit(P) { const x0 = -P.b - 0.8, y0 = -(P.a + P.b) - 0.8, w = P.a + 2 * P.b + 1.6, hh = 2 * P.a + P.b + 1.6, side = Math.max(w, hh); return [x0 - (side - w) / 2, y0 - (side - hh) / 2, side, side]; }
    function sq(g, pts, n, cls, label, sub) {   // a square with its unit grid, n by n, its area and its side
        clear(g); const [p0, p1, , p3] = pts, d = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        s("polygon", { points: pts.map((q) => q.join(",")).join(" "), class: "py-fill" }, g);
        const gl = s("g", { class: "py-grid" }, g);
        if (Number.isInteger(n)) for (let i = 1; i < n; i++) { const a = d(p0, p1, i / n), b = d(p3, pts[2], i / n), c = d(p0, p3, i / n), e = d(p1, pts[2], i / n); s("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, gl); s("line", { x1: c[0], y1: c[1], x2: e[0], y2: e[1] }, gl); }
        const cx = pts.reduce((a, q) => a + q[0], 0) / 4, cy = pts.reduce((a, q) => a + q[1], 0) / 4;
        const side = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), fs = Math.max(0.7, Math.min(1.6, side * 0.32));
        const lt = txt(g, cx, cy + fs * 0.2, label, "py-area " + cls, { "text-anchor": "middle" }); lt.style.fontSize = fs + "px";
        const st2 = txt(g, cx, cy + fs * 0.2 + Math.max(0.55, fs * 0.55), sub, "py-sl " + cls, { "text-anchor": "middle" }); st2.style.fontSize = Math.max(0.42, fs * 0.36) + "px";
    }
    function draw(P, keepView) {
        const o = M.pyOf(P), a = P.a, b = P.b;   // the right angle at (0,0); leg a to the right, leg b up (SVG y runs down, so up is −)
        if (!keepView || !view) view = fit(P); svg.setAttribute("viewBox", view.join(" "));
        sq(sqA, [[0, 0], [a, 0], [a, a], [0, a]], a, "a", String(o.a2), "a = " + a);
        sq(sqB, [[0, 0], [0, -b], [-b, -b], [-b, 0]], b, "b", String(o.b2), "b = " + b);
        sq(sqC, [[a, 0], [0, -b], [b, -(a + b)], [a + b, -a]], o.whole ? Math.round(o.c) : null, "c", P.c ? String(o.c2) : "?", "c = " + (P.c ? o.cText : "?"));
        clear(triG); s("polygon", { points: "0,0 " + a + ",0 0," + -b, class: "py-t" }, triG); s("path", { d: "M0.7 0 V-0.7 H0", class: "py-ra" }, triG);
        hA.setAttribute("transform", "translate(" + a + " 0)"); hB.setAttribute("transform", "translate(0 " + -b + ")");
        hA.setAttribute("aria-valuetext", "a = " + a); hB.setAttribute("aria-valuetext", "b = " + b);
        eq.textContent = "a² + b² = c²";
        work.innerHTML = "";
        const line = (l, r) => { const d = h("div", "py-l"); d.append(h("span", null, l), h("b", null, r)); work.appendChild(d); };
        line(a + "² + " + b + "²", "= " + o.a2 + " + " + o.b2 + " = " + (P.c ? o.c2 : "?"));
        line("c", P.c ? "= " + (o.whole ? o.cText : o.cText + (o.simple ? " = " + o.simple : "") + " ≈ " + o.c.toFixed(2)) : "= ?");
        sa.refresh(); sb.refresh(); tC.setAttribute("aria-pressed", String(P.c)); tC.textContent = P.c ? "Hide c" : "Show c";
        svg.setAttribute("aria-label", "Right triangle with legs " + a + " and " + b + ", squares of area " + o.a2 + " and " + o.b2 + (P.c ? ", hypotenuse square " + o.c2 : ""));
    }
    [[hA, "a", 0], [hB, "b", 1]].forEach(([g, key, ax]) => {
        let v = 0;
        drag(p, g, {
            down: () => { v = st(k)[key]; g.classList.add("drag"); },
            move: (e) => { const q = svgPt(svg, e), n = Math.min(M.PY_MAX, Math.max(1, Math.round(ax ? -q.y : q.x))); if (n !== v) { v = n; draw(Object.assign({}, st(k), { [key]: v }), true); } },
            up: (e, cancel) => { g.classList.remove("drag"); const P = st(k); if (!cancel && v !== P[key]) { P[key] = v; save(); } else draw(P); },
        });
        g.addEventListener("keydown", (e) => { const d = ax ? { ArrowUp: 1, ArrowDown: -1 }[e.key] : { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault(); const P = st(k); const n = Math.min(M.PY_MAX, Math.max(1, P[key] + d)); if (n !== P[key]) { P[key] = n; save(); } });
    });
    p.sync = () => draw(st(k));
    return p;
}

/* ================= Integer counters ================= */
function makeCounters(k) {
    const p = shell(k);
    const val = h("div", "mt-eq ct-val");
    const mat = h("div", "ct-mat"); mat.setAttribute("role", "group"); mat.setAttribute("aria-label", "Counter mat");
    const add = h("div", "mt-row ct-add");
    const act = (fn) => () => { const why = fn(st(k)); if (why) p.say(why, "amber"); else { p.say(""); save(); } };
    add.append(btn('<i class="ct-c p">+</i>Add +1', "", act((K) => M.ctAdd(K, "p")), "Add a positive counter"), btn('<i class="ct-c n">−</i>Add −1', "", act((K) => M.ctAdd(K, "n")), "Add a negative counter"),
        btn('<i class="ct-c p">+</i><i class="ct-c n">−</i>Zero pair', "", act((K) => { const w = M.ctPair(K); if (!w) p.say("A zero pair adds 0. Now there's something to take away."); return w; }), "Add a zero pair"));
    const take = h("div", "mt-row ct-take"); take.appendChild(h("span", "mt-sl", "Take away"));
    take.append(btn("+1", "", act((K) => M.ctTake(K, "p")), "Take away a positive counter"), btn("−1", "", act((K) => M.ctTake(K, "n")), "Take away a negative counter"));
    const tools = h("div", "mt-row mt-foot");
    const tPr = btn("Show zero pairs", "mt-chip", () => { const K = st(k); K.pr = !K.pr; save(); });
    tools.append(tPr, btn("Remove zero pairs", "", () => { const z = M.ctClear(st(k)); p.say(z ? z + (z === 1 ? " zero pair" : " zero pairs") + " removed. The value didn't change." : "No zero pairs to remove."); if (z) save(); }),
        btn("Clear", "", () => { const K = st(k); K.p = 0; K.n = 0; save(); }, "Clear the mat"));
    p.main.append(val, mat); p.side.append(add, take, tools, p.note);
    let was = null;   // what the mat held last time, so only new counters pop in
    function counter(kind, i) {
        const fresh = was && i >= was[kind], c = h("button", "ct-c big " + kind + (fresh ? " new" : "")); c.type = "button"; c.textContent = kind === "p" ? "+" : "−"; if (fresh) c.style.setProperty("--d", ((i - was[kind]) * 0.04) + "s");
        c.setAttribute("aria-label", "Take away this " + (kind === "p" ? "positive" : "negative") + " counter");
        c.onclick = (e) => { e.stopPropagation(); const why = M.ctTake(st(k), kind); if (!why) save(); };
        return c;
    }
    p.sync = () => {
        const K = st(k), v = M.ctValue(K), z = Math.min(K.p, K.n);
        clear(mat);
        if (K.pr && z) {
            const pairs = h("div", "ct-pairs"); for (let i = 0; i < z; i++) { const pr = h("div", "ct-pair"); pr.append(counter("p", i), counter("n", i)); pairs.appendChild(pr); } mat.appendChild(pairs);
            const rest = h("div", "ct-rest"); for (let i = z; i < K.p; i++) rest.appendChild(counter("p", i)); for (let i = z; i < K.n; i++) rest.appendChild(counter("n", i)); if (rest.firstChild) mat.appendChild(rest);
        } else {
            const ps = h("div", "ct-side"), ns = h("div", "ct-side"); for (let i = 0; i < K.p; i++) ps.appendChild(counter("p", i)); for (let i = 0; i < K.n; i++) ns.appendChild(counter("n", i));
            if (K.p) mat.appendChild(ps); if (K.n) mat.appendChild(ns);
        }
        if (!K.p && !K.n) mat.appendChild(h("p", "ct-empty", "Empty mat: the value is 0."));
        val.innerHTML = ""; val.append(h("span", "ct-sum", K.p + " positive, " + K.n + " negative"), h("b", "ct-v" + (v > 0 ? " pos" : v < 0 ? " neg" : ""), (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v)));
        tPr.setAttribute("aria-pressed", String(K.pr)); was = { p: K.p, n: K.n };
    };
    return p;
}

const CTX = () => ({ shell, h, btn, st, save, s, txt, svgPt, drag, clear, M });
const MAKE = { balance: makeBalance, chance: makeChance, line: makeLine, xform: makeXform, pyth: makePyth, counters: makeCounters, angle: (k) => makeAngle(k, CTX()), fn: (k) => makeFn(k, CTX()), area: (k) => makeArea(k, CTX()), nl: (k) => makeNl(k, CTX()),
    calc: (k) => makeCalc(k, CTX(), false), sci: (k) => makeCalc(k, CTX(), true), graph: (k) => makeGraph(k, CTX()) };
