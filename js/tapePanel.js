/* The tape diagram panel (Math tools, "tape"), for 7.RP (percent and ratio problems).
   Percent: one tape is the whole, 100%, cut into equal parts. Shaded parts are the part. Find the part, the whole or the
   percent. Tap a box to shade up to it; past 100% the tape grows dashed boxes (percent increase, 150%).
   Ratio: two tapes of equal units, a : b. Find each amount from the total, the difference, or one amount.
   Every problem is solved in two steps the class reveals one at a time: one part (or one unit) first, then the answer.
   The model is in js/manipCore.js (tpDefault, tpPct, tpPctQ, tpPctA, tpPctSteps, tpRat, tpRatQ, tpRatA, tpRatSteps,
   tpNew, tpSet, tpAsk, TP_PARTS, TP_CTX); the state is S.tools.mt.tape. */

const W = 460, X0 = 34, X1 = 432;

/** ctx: { shell, h, btn, st, save, s, txt, svgPt, drag, clear, grid, stepper, M } from js/manipPanels.js */
export function makeTape(k, ctx) {
    const { h, btn, s, txt, clear, M } = ctx;
    const st = () => ctx.st(k), save = ctx.save;
    const p = ctx.shell(k);
    const q = h("div", "mt-eq tp-q");
    const svg = s("svg", { viewBox: "0 0 " + W + " 186", class: "mt-svg tp-svg", role: "img" });

    /* ---- the side ---- */
    const modes = h("div", "mt-row");
    const bPct = btn("Percent", "mt-chip", () => setMode("pct"), "Percent problems"), bRat = btn("Ratio", "mt-chip", () => setMode("ratio"), "Ratio problems");
    modes.append(bPct, bRat);
    const setMode = (m) => { const S = st(); if (S.m !== m) { S.m = m; S.s = 0; p.say(""); save(); } };
    const asks = h("div", "mt-row tp-asks");
    const ASKS = { pct: [["part", "Find the part"], ["whole", "Find the whole"], ["pct", "Find the percent"]], ratio: [["total", "From the total"], ["diff", "From the difference"], ["one", "From one amount"]] };
    const askB = {}; Object.entries(ASKS).forEach(([m, list]) => list.forEach(([a, lab]) => { const b = btn(lab, "mt-chip", () => { if (M.tpAsk(st(), a)) { p.say(""); save(); } }, lab); b.dataset.m = m; askB[m + a] = b; asks.appendChild(b); }));
    const steps = h("div", "tp-steps"), list = h("ol", "tp-ol"), ans = h("p", "tp-ans");
    const bNext = btn("Next step", "mt-go", () => { const S = st(); if (S.s < 2) { S.s++; save(); } }, "Show the next step");
    const bAll = btn("Show the answer", "", () => { const S = st(); if (S.s < 2) { S.s = 2; save(); } }, "Show both steps and the answer");
    const sRow = h("div", "mt-row"); sRow.append(bNext, bAll);
    steps.append(list, ans, sRow);
    const nums = h("div", "mt-row tp-nums");
    const tw = (key) => (v) => { const S = st(), o = S.m === "pct" ? S.p : S.r; if (M.tpSet(S, key, v - o[key])) { p.say(""); save(); } };
    const get = (key) => () => { const S = st(); return (S.m === "pct" ? S.p : S.r)[key]; };
    const stP = [ctx.stepper("Parts", get("n"), tw("n"), 1, 99), ctx.stepper("Shaded", get("k"), tw("k"), 1, 99), ctx.stepper("1 part", get("u"), tw("u"), 1, 25)];
    const stR = [ctx.stepper("A", get("a"), tw("a"), 1, 8), ctx.stepper("B", get("b"), tw("b"), 1, 8), ctx.stepper("1 unit", get("u"), tw("u"), 1, 25)];
    stP.forEach((x) => { x.dataset.m = "pct"; nums.appendChild(x); }); stR.forEach((x) => { x.dataset.m = "ratio"; nums.appendChild(x); });
    const tools = h("div", "mt-row");
    tools.append(btn("New problem", "", () => { M.tpNew(st()); p.say(""); save(); }, "A new problem of this kind"),
        btn("Start over", "", () => { const m = st().m; Object.assign(st(), M.tpDefault(), { m }); p.say(""); save(); }, "Back to the first problem"));
    p.main.append(q, svg); p.side.append(modes, asks, steps, nums, tools, p.note);

    /* ---- drawing helpers ---- */
    const pill = (g, x, y, t, cls, anchor) => {
        const w = String(t).length * 7.6 + 14, bx = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
        s("rect", { x: bx, y: y - 13, width: w, height: 19, rx: 9.5, class: "tp-pill " + cls }, g); txt(g, bx + w / 2, y + 1.5, String(t), "tp-pt", { "text-anchor": "middle" });
    };
    const brace = (g, xa, xb, y, down) => { const d = down ? 1 : -1, m = (xa + xb) / 2; s("path", { d: "M" + xa + " " + y + " q0 " + 6 * d + " 6 " + 6 * d + " H" + (m - 6) + " q6 0 6 " + 6 * d + " q0 " + -6 * d + " 6 " + -6 * d + " H" + (xb - 6) + " q6 0 6 " + -6 * d, class: "tp-br" }, g); return m; };

    function drawPct(S) {
        const P = S.p, v = M.tpPct(P), cells = Math.max(P.n, P.k), uw = (X1 - X0) / cells, X = (i) => X0 + i * uw, y = 50, hh = 44, done = S.s >= 2;
        svg.setAttribute("viewBox", "0 0 " + W + " 186");
        const g = s("g", null, svg);
        for (let i = 0; i < cells; i++) {
            const b = s("g", { class: "tp-cell" + (i < P.k ? " on" : "") + (i >= P.n ? " over" : ""), role: "button", tabindex: "0", "aria-label": "Shade " + (i + 1) + " parts" }, g);
            s("rect", { x: X(i) + 1, y, width: uw - 2, height: hh, rx: 4, class: "tp-box" }, b);
            if (S.s >= 1) txt(b, X(i) + uw / 2, y + hh / 2 + 5, String(v.u), "tp-in", { "text-anchor": "middle" });
            const go = () => { const S2 = st(); if (M.tpSet(S2, "k", i + 1 - S2.p.k)) { p.say(""); save(); } };
            b.addEventListener("click", go); b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
        }
        /* percents along the top */
        for (let i = 0; i <= cells; i++) {
            const pc = Math.round(i * v.pp * 100) / 100, show = i === 0 || i === P.n || done || (i === P.k && P.ask !== "pct");
            if (i === P.k && P.ask === "pct" && !done) { pill(g, X(i), y - 12, "?", "q"); continue; }
            if (show) txt(g, X(i), y - 8, pc + "%", "tp-pc" + (i === P.k ? " k" : ""), { "text-anchor": "middle" });
            s("line", { x1: X(i), y1: y - 4, x2: X(i), y2: y, class: "tp-tick" }, g);
        }
        if (P.ask === "pct" && done) pill(g, X(P.k), y - 12, v.pct + "%", "ok");
        /* the part and the whole, below */
        const mp = brace(g, X(0), X(P.k), y + hh + 6, true);
        if (P.ask === "part") pill(g, mp, y + hh + 30, done ? v.part : "?", done ? "ok" : "q"); else txt(g, mp, y + hh + 34, String(v.part), "tp-val", { "text-anchor": "middle" });
        const mw = brace(g, X(0), X(P.n), y + hh + 46, true);
        if (P.ask === "whole") pill(g, mw, y + hh + 70, done ? v.whole : "?", done ? "ok" : "q"); else txt(g, mw, y + hh + 74, String(v.whole) + " (100%)", "tp-val", { "text-anchor": "middle" });
        svg.setAttribute("aria-label", M.tpPctQ(P) + " The tape has " + P.n + " equal parts; " + P.k + " are shaded.");
    }
    function drawRat(S) {
        const R = S.r, v = M.tpRat(R), [na, nb] = M.TP_CTX[R.c], done = S.s >= 2, L = 112, uw = Math.min(54, (X1 - 70 - L) / Math.max(R.a, R.b)), hh = 40;
        const rows = [[na, R.a, v.A, 30], [nb, R.b, v.B, 96]], g = s("g", null, svg);
        svg.setAttribute("viewBox", "0 0 " + W + " 172");
        rows.forEach(([name, n, tot, y], r) => {
            txt(g, L - 10, y + hh / 2 + 5, name, "tp-nm", { "text-anchor": "end" });
            for (let i = 0; i < n; i++) { s("rect", { x: L + i * uw + 1, y, width: uw - 2, height: hh, rx: 4, class: "tp-box " + (r ? "rb" : "ra") }, g); txt(g, L + i * uw + uw / 2, y + hh / 2 + 5, S.s >= 1 ? String(R.u) : "?", "tp-in" + (S.s >= 1 ? "" : " q"), { "text-anchor": "middle" }); }
            const end = L + n * uw + 10, given = R.ask === "one" && r === 0;
            if (given) txt(g, end, y + hh / 2 + 5, "= " + tot, "tp-val", { "text-anchor": "start" });
            else pill(g, end, y + hh / 2 + 2, done ? "= " + tot : "?", done ? "ok" : "q", "start");
        });
        const far = L + Math.max(R.a, R.b) * uw;
        if (R.ask === "total") {   // a brace down the right side, around both tapes
            const x = far + 62, y0 = 30, y1 = 96 + hh;
            s("path", { d: "M" + x + " " + y0 + " q6 0 6 6 V" + ((y0 + y1) / 2 - 6) + " q0 6 6 6 q-6 0 -6 6 V" + (y1 - 6) + " q0 6 -6 6", class: "tp-br" }, g);
            txt(g, x + 16, (y0 + y1) / 2 + 5, String(v.tot), "tp-val", { "text-anchor": "start" });
        }
        if (R.ask === "diff") {   // a brace over the extra units of the longer tape
            const lo = Math.min(R.a, R.b), hi = Math.max(R.a, R.b), top = R.a > R.b, y = top ? 26 : 96 + hh + 4;
            const m = brace(g, L + lo * uw, L + hi * uw, y, !top);
            txt(g, m, top ? y - 12 : y + 24, v.diff + " more", "tp-val", { "text-anchor": "middle" });
        }
        svg.setAttribute("aria-label", M.tpRatQ(R));
    }

    function draw(S) {
        clear(svg);
        const pct = S.m === "pct";
        if (pct) drawPct(S); else drawRat(S);
        q.textContent = pct ? M.tpPctQ(S.p) : M.tpRatQ(S.r); q.classList.toggle("tp-long", !pct);
        bPct.setAttribute("aria-pressed", String(pct)); bRat.setAttribute("aria-pressed", String(!pct));
        Object.entries(askB).forEach(([key, b]) => { const m = b.dataset.m; b.hidden = m !== S.m; b.setAttribute("aria-pressed", String(m === S.m && key === m + (pct ? S.p.ask : S.r.ask))); });
        askB.ratiodiff.disabled = S.r.a === S.r.b;
        [...nums.children].forEach((x) => { x.hidden = x.dataset.m !== S.m; if (x.refresh) x.refresh(); });
        if (!pct) { const [na, nb] = M.TP_CTX[S.r.c]; stR[0].firstChild.textContent = na; stR[1].firstChild.textContent = nb; }
        const all = pct ? M.tpPctSteps(S.p) : M.tpRatSteps(S.r);
        clear(list); all.slice(0, S.s).forEach((t) => list.appendChild(h("li", null, t)));
        list.hidden = !S.s;
        ans.textContent = S.s >= 2 ? "Answer: " + (pct ? M.tpPctA(S.p) : M.tpRatA(S.r)) : S.s ? "" : pct ? "How big is one part? Find that first." : "How much is one unit? Find that first.";
        ans.classList.toggle("ok", S.s >= 2);
        bNext.hidden = bAll.hidden = S.s >= 2;
        bNext.textContent = S.s ? "Next step" : pct ? "Find one part" : "Find one unit";
    }
    p.sync = () => draw(st());
    return p;
}
