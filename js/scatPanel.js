/* The scatter plot panel (Math tools, "scat"), for 8.SP.1–8.SP.3.
   Data on real axes: study time and quiz scores, temperature and cocoa sold, birth month and height, or the class's own.
   Tap the graph to add a point, drag a point to move it, drag it off the graph to take it away.
   The side reads the association (positive, negative or none, and how strong) and flags a point far from the trend.
   The class drags its own trend line (two purple ends) through the points: the side counts points above and below it,
   and reads its slope and y-intercept in the data's own words. "Show the best-fit line" adds the least-squares line to
   compare. Predict reads a value off the class's line. "Hide the answers" keeps the association and best fit back.
   The model is in js/manipCore.js (SC_SETS, scDefault, scStats, scAssoc, scOutliers, scLine, scEq, scSay, scSides,
   scRead, scPredict, scAdd, scMove, scDel, scHandle); the state is S.tools.mt.scat. */

const W = 380, H = 322, L = 50, RT = W - 14, T = 14, B = H - 46;

/** ctx: { shell, h, btn, st, save, s, txt, svgPt, drag, clear, grid, M } from js/manipPanels.js */
export function makeScat(k, ctx) {
    const { h, btn, s, txt, svgPt, drag, clear, M } = ctx;
    const st = () => ctx.st(k), save = ctx.save;
    const p = ctx.shell(k);
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "mt-svg sc-svg", role: "img" });
    const clip = s("clipPath", { id: "mtScClip" }, s("defs", null, svg));
    s("rect", { x: L, y: T, width: RT - L, height: B - T }, clip);
    const gridG = s("g", { class: "mt-grid sc-grid" }, svg);
    const bestL = s("line", { class: "sc-best", "clip-path": "url(#mtScClip)" }, svg);
    const predG = s("g", { class: "sc-pred" }, svg);
    const myL = s("line", { class: "sc-my", "clip-path": "url(#mtScClip)" }, svg);
    const ptG = s("g", null, svg);
    const hG = s("g", null, svg);

    /* ---- the side ---- */
    const sets = h("div", "mt-row sc-sets");
    const setB = M.SC_KEYS.map((d) => { const b = btn(M.SC_SETS[d].name, "mt-chip", () => { const S = st(); if (S.d !== d) { Object.assign(S, M.scDefault(d)); p.say(d === "own" ? "Tap the graph to plot your own points." : ""); save(); } }, "Show the " + M.SC_SETS[d].name.toLowerCase() + " data"); sets.appendChild(b); return b; });
    const trend = h("div", "sc-tr"), trH = h("b", "sc-th"), trP = h("p", "sc-tp"), trO = h("p", "sc-to");
    const check = btn("Check the trend", "mt-chip", () => { st().rv = true; save(); }, "Show the association");
    trend.append(trH, trP, trO, check);
    const mine = h("div", "sc-box sc-mine"), myEq = h("b", "sc-eq"), sides = h("span", "sc-sd");
    const myHead = h("div", "sc-row"); myHead.append(h("i", "sc-sw my"), h("span", "sc-n", "Your line"), myEq);
    const rdS = h("p", "sc-rd"), rdI = h("p", "sc-rd");
    mine.append(myHead, sides, rdS, rdI);
    const bestRow = h("div", "sc-row sc-bestrow"), bestEq = h("b", "sc-eq");
    bestRow.append(h("i", "sc-sw best"), h("span", "sc-n", "Best fit"), bestEq);
    const bBest = btn("Best-fit line", "mt-chip", () => { const S = st(); S.best = !S.best; save(); }, "Show or hide the best-fit line");
    const pred = h("div", "mt-row sc-predrow"), pV = h("b", "sc-pv"), pOut = h("p", "sc-po");
    const stepX = (d) => { const S = st(), D = M.SC_SETS[S.d], v = S.px == null ? (D.x[1] + D.x[2]) / 2 : S.px + d * D.ps; S.px = +Math.min(D.x[2], Math.max(D.x[1], v)).toFixed(4); save(); };
    const bPred = btn("Predict", "mt-chip", () => { const S = st(); if (S.px == null) stepX(0); else { S.px = null; save(); } }, "Predict with your line");
    const pMinus = btn("−", "mt-sb", () => stepX(-1), "Predict at a smaller x"), pPlus = btn("+", "mt-sb", () => stepX(1), "Predict at a larger x");
    pred.append(h("span", "mt-sl", "Predict at"), pMinus, pV, pPlus);
    const chips = h("div", "mt-row"), tools = h("div", "mt-row");
    const bHide = btn("Hide the answers", "mt-chip", () => { const S = st(); S.hide = !S.hide; S.rv = false; save(); }, "Hide the trend and the best-fit line");
    chips.append(bBest, bPred, bHide);
    tools.append(btn("Clear the points", "", () => { const S = st(); if (S.p.length) { S.p = []; S.rv = false; S.px = null; p.say("Tap the graph to plot new points."); save(); } }, "Take every point off"),
        btn("Start over", "", () => { Object.assign(st(), M.scDefault(st().d)); p.say(""); save(); }, "Back to this data set's points"));
    const hint = h("p", "sc-hint", "A good trend line has about half the points on each side. Tap the graph to add a point; drag one off to take it away.");
    p.main.append(svg, pred, pOut); p.side.append(sets, trend, mine, bestRow, chips, tools, hint, p.note);

    /* ---- scale ---- */
    let D = null;
    const X = (v) => L + (v - D.x[1]) / (D.x[2] - D.x[1]) * (RT - L), Y = (v) => B - (v - D.y[1]) / (D.y[2] - D.y[1]) * (B - T);
    const ux = (px) => D.x[1] + (px - L) / (RT - L) * (D.x[2] - D.x[1]), uy = (py) => D.y[1] + (B - py) / (B - T) * (D.y[2] - D.y[1]);
    let gridOf = "";
    function drawGrid() {
        if (gridOf === D.name) return; gridOf = D.name; clear(gridG);
        for (let v = D.x[1]; v <= D.x[2] + 1e-9; v += D.x[3]) { s("line", { x1: X(v), y1: T, x2: X(v), y2: B, class: v === D.x[1] ? "ax" : "gl" }, gridG); txt(gridG, X(v), B + 15, M.scNum(v), "tk", { "text-anchor": "middle" }); }
        for (let v = D.y[1]; v <= D.y[2] + 1e-9; v += D.y[3]) { s("line", { x1: L, y1: Y(v), x2: RT, y2: Y(v), class: v === D.y[1] ? "ax" : "gl" }, gridG); txt(gridG, L - 6, Y(v) + 4, M.scNum(v), "tk", { "text-anchor": "end" }); }
        txt(gridG, (L + RT) / 2, H - 8, D.x[0], "sc-axl", { "text-anchor": "middle" });
        txt(gridG, 0, 0, D.y[0], "sc-axl", { "text-anchor": "middle", transform: "translate(13 " + (T + B) / 2 + ") rotate(-90)" });
    }
    const inPlot = (q) => q.x >= L - 8 && q.x <= RT + 8 && q.y >= T - 8 && q.y <= B + 8;

    /* ---- tap to add ---- */
    svg.addEventListener("click", (e) => {
        if (e.target.closest(".sc-pt") || e.target.closest(".sc-h")) return;
        const q = svgPt(svg, e); if (!inPlot(q)) return;
        const S = st(); D = M.SC_SETS[S.d];
        if (M.scAdd(S, ux(q.x), uy(q.y))) { p.say(""); save(); } else if (S.p.length >= M.SC_MAX) p.say("The graph holds " + M.SC_MAX + " points. Drag one off first.", "amber");
    });

    let live = null;   // a drag in progress: the panel as it looks on this screen
    const refocus = (key) => { const f = () => { const el = svg.querySelector('[data-key="' + key + '"]'); if (el && document.activeElement !== el) el.focus({ preventScroll: true }); }; f(); setTimeout(f, 0); requestAnimationFrame(f); };

    /* ---- the class's line: two ends ---- */
    const ends = [0, 1].map((w) => {
        const g = s("g", { class: "sc-h", tabindex: "0", role: "slider", "data-key": "h-" + w, "aria-label": "Your trend line, " + (w ? "right" : "left") + " end. Drag it, or use the arrow keys" }, hG);
        s("circle", { r: 16, class: "sc-hit" }, g); s("rect", { x: -7, y: -7, width: 14, height: 14, rx: 3, class: "sc-hd" }, g);
        drag(p, g, {
            down: () => { live = JSON.parse(JSON.stringify(st())); g.classList.add("drag"); },
            move: (e) => { const q = svgPt(svg, e); if (live && M.scHandle(live, w, ux(q.x), uy(q.y))) draw(live); },
            up: (e, cancel) => { g.classList.remove("drag"); const Lv = live; live = null; const S = st(); if (Lv && !cancel && JSON.stringify(Lv.ln) !== JSON.stringify(S.ln)) { S.ln = Lv.ln; save(); } else draw(S); },
        });
        g.addEventListener("keydown", (e) => {
            const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!d) return;
            e.preventDefault(); e.stopPropagation();
            const S = st(), Dd = M.SC_SETS[S.d], q = S.ln[w];
            if (M.scHandle(S, w, q[0] + d[0] * Dd.x[4], q[1] + d[1] * Dd.y[3] / 2)) { save(); refocus("h-" + w); }
        });
        return g;
    });

    /* ---- the points ---- */
    function drawPts(S, out, hid) {
        clear(ptG);
        S.p.forEach((q, i) => {
            const g = s("g", { class: "sc-pt" + (!hid && out.includes(i) ? " out" : ""), tabindex: "0", role: "slider", "data-key": "p-" + i, transform: "translate(" + X(q[0]) + " " + Y(q[1]) + ")",
                "aria-label": "Point (" + M.scNum(q[0], 2) + ", " + M.scNum(q[1], 2) + "). Drag it, use the arrow keys, or press Delete to take it away" }, ptG);
            s("circle", { r: 13, class: "sc-hit" }, g);
            if (!hid && out.includes(i)) s("circle", { r: 11, class: "sc-ring" }, g);
            s("circle", { r: 5.5, class: "sc-dot" }, g);
            drag(p, g, {
                down: () => { live = JSON.parse(JSON.stringify(st())); g.classList.add("drag"); },
                move: (e) => { const r = svgPt(svg, e); if (!live) return; if (inPlot(r)) { M.scMove(live, i, ux(r.x), uy(r.y)); g.classList.remove("gone"); } else g.classList.add("gone"); draw(live, i); },
                up: (e, cancel) => {
                    const Lv = live; live = null; const S2 = st(); if (!Lv || cancel) { draw(S2); return; }
                    if (!inPlot(svgPt(svg, e))) { M.scDel(S2, i); p.say("Point taken away."); save(); return; }
                    if (JSON.stringify(Lv.p) !== JSON.stringify(S2.p)) { S2.p = Lv.p; S2.rv = false; save(); } else draw(S2);
                },
            });
            g.addEventListener("keydown", (e) => {
                const S2 = st(), Dd = M.SC_SETS[S2.d];
                if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); M.scDel(S2, i); p.say("Point taken away."); save(); return; }
                const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!d) return;
                e.preventDefault(); e.stopPropagation();
                if (M.scMove(S2, i, q[0] + d[0] * Dd.x[4], q[1] + d[1] * Dd.y[4])) { save(); refocus("p-" + i); }
            });
        });
    }
    const setLn = (el, m, b) => { el.setAttribute("x1", X(D.x[1])); el.setAttribute("y1", Y(m * D.x[1] + b)); el.setAttribute("x2", X(D.x[2])); el.setAttribute("y2", Y(m * D.x[2] + b)); };

    function draw(S, dragging) {
        D = M.SC_SETS[S.d]; drawGrid();
        const hid = S.hide && !S.rv, st0 = M.scStats(S.p), a = M.scAssoc(S.p), out = dragging == null ? M.scOutliers(S) : [], my = M.scLine(S);
        if (dragging == null) drawPts(S, out, hid);
        else { const g = ptG.querySelector('[data-key="p-' + dragging + '"]'), q = S.p[dragging]; if (g && q) g.setAttribute("transform", "translate(" + X(q[0]) + " " + Y(q[1]) + ")"); }
        /* the class's line */
        setLn(myL, my.m, my.b);
        ends.forEach((g, w) => { const q = S.ln[w]; g.setAttribute("transform", "translate(" + X(q[0]) + " " + Y(q[1]) + ")"); g.setAttribute("aria-valuetext", "(" + M.scNum(q[0], 2) + ", " + M.scNum(q[1], 2) + ")"); });
        myEq.textContent = M.scEq(my.m, my.b);
        const sd = M.scSides(S);
        sides.textContent = S.p.length ? sd.above + " above it, " + sd.below + " below" + (sd.on ? ", " + sd.on + " on it" : "") : "";
        const rd = M.scRead(S); rdS.textContent = rd.slope; rdI.textContent = rd.icpt;
        /* the best fit */
        const showBest = S.best && !hid && st0.m != null;
        bestL.style.display = showBest ? "" : "none"; bestRow.hidden = !showBest;
        if (showBest) { setLn(bestL, st0.m, st0.b); bestEq.textContent = M.scEq(st0.m, st0.b); }
        bBest.setAttribute("aria-pressed", String(!!S.best)); bBest.disabled = hid || st0.m == null;
        /* the trend */
        check.hidden = !hid || S.p.length < 3;
        trend.dataset.kind = hid ? "" : a.dir;
        if (hid) { trH.textContent = "Positive, negative, or no association?"; trP.textContent = "Look at how the points move from left to right, then check."; trO.textContent = ""; }
        else {
            trH.textContent = a.text;
            const xn = D.x[0].replace(/ \(.*\)$/, "").toLowerCase();
            trP.textContent = a.dir === "positive" ? "As " + xn + " goes up, " + D.yn + " tends to go up." : a.dir === "negative" ? "As " + xn + " goes up, " + D.yn + " tends to go down." : a.dir === "none" ? "The points don't rise or fall together." : "";
            if (st0.r != null && a.dir) trP.textContent += " r = " + st0.r.toFixed(2).replace("-", "−") + ".";
            trO.textContent = out.length ? out.map((i) => "(" + M.scNum(S.p[i][0], 2) + ", " + M.scNum(S.p[i][1], 2) + ")").join(" and ") + (out.length > 1 ? " are" : " is") + " far from the trend. Outlier?" : "";
        }
        /* predict */
        clear(predG);
        const on = S.px != null; pred.hidden = !on; bPred.setAttribute("aria-pressed", String(on));
        if (on) {
            const yv = my.m * S.px + my.b, px = X(S.px), py = Y(Math.min(D.y[2], Math.max(D.y[1], yv)));
            pV.textContent = M.scSay(D, "x", S.px);
            s("path", { d: "M" + px + " " + B + " V" + py + " H" + L, class: "sc-guide" }, predG); s("circle", { cx: px, cy: py, r: 5, class: "sc-pdot" }, predG);
            pOut.textContent = "At " + M.scSay(D, "x", S.px) + ", your line predicts " + M.scSay(D, "y", yv) + "." + (yv < D.y[1] || yv > D.y[2] ? " That's off the graph." : "");
        } else pOut.textContent = "";
        pOut.hidden = !on;
        setB.forEach((b, j) => b.setAttribute("aria-pressed", String(M.SC_KEYS[j] === S.d)));
        bHide.setAttribute("aria-pressed", String(!!S.hide));
        svg.setAttribute("aria-label", D.x[0] + " and " + D.y[0] + ", " + S.p.length + " points. Your line: " + myEq.textContent + "." + (hid ? "" : " " + a.text + "."));
    }
    p.sync = () => { if (!live) draw(st()); };
    return p;
}
