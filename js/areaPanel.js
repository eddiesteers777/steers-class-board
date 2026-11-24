/* The expression area model panel (Math tools, "area"), for 7.6 and 7.7.
   Expand: a(bx + c) as a rows of algebra tiles (or an area box). The area of each part is a·bx and a·c, so the class sees
   why a(bx + c) = abx + ac. "Hide the answer" turns the two areas into ?s to tap. A negative outside flips every tile.
   Factor: px + q as tiles sorted into equal rows. When the rows come out even, the tiles make a rectangle r(…), and the
   biggest r that works is the greatest common factor.
   The model is in js/manipCore.js (exLin, exFactored, exExpanded, exRows, exNewFactor); the state is S.tools.mt.area. */

const POS_X = "#2FA36B", POS_U = "#F2B33D", NEG = "#E0524F";
const neg = (n) => (n < 0 ? "−" + Math.abs(n) : String(n));
const plus = (n) => (n < 0 ? "− " + Math.abs(n) : "+ " + n);

/** ctx: { shell, h, btn, st, save, s, txt, clear, M } from js/manipPanels.js */
export function makeArea(k, ctx) {
    const { h, btn, s, txt, clear, M } = ctx;
    const st = () => ctx.st(k), save = ctx.save;
    const p = ctx.shell(k);
    const W = 360, H = 250;
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "mt-svg ex-svg", role: "img" });
    const g = s("g", null, svg);

    /* ---- the side ---- */
    const modes = h("div", "mt-row");
    const mExp = btn("Expand", "mt-chip", () => { const E = st(); if (E.m !== "exp") { E.m = "exp"; save(); } }, "Multiply out a(bx + c)");
    const mFac = btn("Factor", "mt-chip", () => { const E = st(); if (E.m !== "fac") { E.m = "fac"; save(); } }, "Sort px + q into equal rows");
    modes.append(mExp, mFac);
    const head = h("div", "mt-eq ex-head");
    const sub = h("p", "ex-sub");

    const stepper = (lab, key, lo, hi, nz, aria) => {
        const w = h("div", "ex-step"), v = h("b", "ex-sv");
        const go = (d) => { const E = st(); let n = E[key] + d; if (nz && n === 0) n += d; if (n >= lo && n <= hi) { E[key] = n; if (key === "a" || key === "b" || key === "c") E.rv = [false, false]; if (key === "p" || key === "q") E.r = 1; save(); } };
        w.append(h("span", "mt-sl", lab), btn("−", "ex-sb", () => go(-1), aria + " down"), v, btn("+", "ex-sb", () => go(1), aria + " up"));
        return { w, v };
    };
    const expRow = h("div", "ex-steps");
    const sA = stepper("Outside", "a", -M.EX_A, M.EX_A, true, "The number outside"), sB = stepper("x's", "b", -M.EX_B, M.EX_B, true, "The number of x's"), sC = stepper("Number", "c", -M.EX_C, M.EX_C, false, "The number inside");
    expRow.append(sA.w, sB.w, sC.w);
    const looks = h("div", "mt-row");
    const lT = btn("Tiles", "mt-chip", () => { const E = st(); if (E.look !== "tiles") { E.look = "tiles"; save(); } }), lB = btn("Area box", "mt-chip", () => { const E = st(); if (E.look !== "box") { E.look = "box"; save(); } });
    const tHide = btn("Hide the answer", "mt-chip", () => { const E = st(); E.hide = !E.hide; E.rv = [false, false]; save(); }, "Hide the two areas for the class to find");
    looks.append(lT, lB, tHide);

    const facRow = h("div", "ex-steps");
    const sP = stepper("x's", "p", -M.EX_P, M.EX_P, true, "The number of x's"), sQ = stepper("Number", "q", -M.EX_Q, M.EX_Q, true, "The number");
    facRow.append(sP.w, sQ.w);
    const rows = h("div", "ex-rows");
    rows.appendChild(h("span", "mt-sl", "Rows"));
    const rowB = [];
    for (let r = 1; r <= M.EX_R; r++) { const b = btn(String(r), "mt-chip ex-r", () => { const E = st(); if (E.r !== r) { E.r = r; save(); } }, "Sort into " + r + (r === 1 ? " row" : " rows")); rowB.push(b); rows.appendChild(b); }

    const foot = h("div", "mt-row mt-setup");
    const bNew = btn("New expression", "", () => { M.exNewFactor(st()); save(); });
    const bOver = btn("Start over", "", () => { const E = st(), m = E.m; Object.assign(E, M.exDefault(), { m }); save(); });
    foot.append(bNew, bOver);

    p.main.append(svg);
    p.side.append(modes, head, sub, expRow, looks, facRow, rows, foot, p.note);

    /* ---- drawing helpers ---- */
    function tile(x, y, w, hh, col, label, cls) {
        const t = s("g", { class: "ex-tile" + (cls ? " " + cls : ""), style: "--c:" + col }, g);
        s("rect", { x: x + 0.8, y: y + 0.8, width: w - 1.6, height: hh - 1.6, rx: Math.min(4, hh / 5) }, t);
        if (label && hh >= 13) txt(t, x + w / 2, y + hh / 2 + Math.min(5, hh / 4), label, "ex-tl", { "text-anchor": "middle", "font-size": Math.min(13, hh * 0.55) });
        return t;
    }
    function label(x, y, t, cls, anchor) { return txt(g, x, y, t, "ex-lab" + (cls ? " " + cls : ""), { "text-anchor": anchor || "middle" }); }
    function brace(x1, x2, y) { s("path", { d: "M" + x1 + " " + (y - 4) + " V" + y + " H" + x2 + " V" + (y - 4), class: "ex-br" }, g); }
    /** A part's area: the value, or a ? to tap when hidden. */
    function area(x, y, i, val, E, big) {
        const shown = !E.hide || E.rv[i];
        const t = txt(g, x, y, shown ? val : "?", "ex-area" + (big ? " big" : "") + (shown ? "" : " q"), { "text-anchor": "middle" });
        if (!shown) {
            const hit = s("rect", { x: x - 30, y: y - (big ? 30 : 20), width: 60, height: big ? 40 : 28, class: "ex-qhit", tabindex: "0", role: "button", "aria-label": "Show this area" }, g);
            const show = (e) => { e.stopPropagation(); const F = st(); F.rv[i] = true; save(); };
            hit.addEventListener("pointerdown", (e) => e.stopPropagation()); hit.addEventListener("click", show);
            hit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(e); } });
        }
        return t;
    }

    /* ---- expand ---- */
    function drawExpand(E) {
        const A = Math.abs(E.a), B = Math.abs(E.b), C = Math.abs(E.c);
        const [ax, ac] = M.exParts(E);
        const colX = ax > 0 ? POS_X : NEG, colU = ac > 0 ? POS_U : NEG;
        const L = 62, R = 348, T = 46, BOT = 206;
        if (E.look === "box") {
            const total = R - L, wx = C ? Math.round(total * Math.min(0.72, Math.max(0.5, B * 2.6 / (B * 2.6 + C)))) : total;
            s("rect", { x: L, y: T, width: wx, height: BOT - T, class: "ex-box", style: "--c:" + colX }, g);
            if (C) s("rect", { x: L + wx, y: T, width: total - wx, height: BOT - T, class: "ex-box", style: "--c:" + colU }, g);
            label(L + wx / 2, T - 10, exXs(E.b)); if (C) label(L + wx + (total - wx) / 2, T - 10, plus(E.c));
            label(L - 14, (T + BOT) / 2 + 6, neg(E.a), "side", "end");
            area(L + wx / 2, (T + BOT) / 2 + 12, 0, exXs(ax), E, true);
            if (C) area(L + wx + (total - wx) / 2, (T + BOT) / 2 + 12, 1, neg(ac), E, true);
            return;
        }
        const gap = C ? 0.5 : 0;
        const U = Math.min(34, (R - L) / (B * 2.6 + C + gap), (BOT - T - 34) / A);
        const XW = U * 2.6, rowW = B * XW + (gap + C) * U, x0 = L + (R - L - rowW) / 2, y0 = T;
        for (let r = 0; r < A; r++) {
            const y = y0 + r * U;
            for (let i = 0; i < B; i++) tile(x0 + i * XW, y, XW, U, colX, ax > 0 ? "x" : "−x");
            for (let i = 0; i < C; i++) tile(x0 + B * XW + gap * U + i * U, y, U, U, colU, ac > 0 ? "1" : "−1");
        }
        const yb = y0 + A * U;
        label(x0 + B * XW / 2, y0 - 10, exXs(E.b));
        if (C) label(x0 + B * XW + gap * U + C * U / 2, y0 - 10, plus(E.c));
        label(x0 - 12, y0 + A * U / 2 + 6, neg(E.a), "side", "end");
        s("path", { d: "M" + (x0 - 6) + " " + y0 + " V" + yb, class: "ex-br" }, g);
        brace(x0, x0 + B * XW, yb + 10); area(x0 + B * XW / 2, yb + 30, 0, exXs(ax), E);
        if (C) { brace(x0 + B * XW + gap * U, x0 + rowW, yb + 10); area(x0 + B * XW + gap * U + C * U / 2, yb + 30, 1, neg(ac), E); }
    }
    const exXs = (n) => (n === 1 ? "x" : n === -1 ? "−x" : neg(n) + "x");

    /* ---- factor ---- */
    function drawFactor(E) {
        const R0 = M.exRows(E), r = E.r, P = Math.abs(E.p), Q = Math.abs(E.q);
        const colX = E.p > 0 ? POS_X : NEG, colU = E.q > 0 ? POS_U : NEG;
        const L = 62, R = 348, T = 46, BOT = 206;
        const maxX = R0.px + (R0.lx ? 1 : 0), maxU = R0.qx + (R0.lq ? 1 : 0);
        const U = Math.min(34, (R - L) / (maxX * 2.6 + maxU + 0.5), (BOT - T - 34) / r);
        const XW = U * 2.6, rowW = maxX * XW + (0.5 + maxU) * U, x0 = L + (R - L - rowW) / 2;
        for (let i = 0; i < r; i++) {
            const y = T + i * U, nx = R0.px + (i < R0.lx ? 1 : 0), nq = R0.qx + (i < R0.lq ? 1 : 0);
            for (let j = 0; j < nx; j++) tile(x0 + j * XW, y, XW, U, colX, E.p > 0 ? "x" : "−x", !R0.even && i < R0.lx && j === nx - 1 && R0.lx ? "odd" : "");
            for (let j = 0; j < nq; j++) tile(x0 + maxX * XW + 0.5 * U + j * U, y, U, U, colU, E.q > 0 ? "1" : "−1", !R0.even && i < R0.lq && j === nq - 1 && R0.lq ? "odd" : "");
        }
        if (R0.even) {
            label(x0 + maxX * XW / 2, T - 10, exXs(E.p / r));
            label(x0 + maxX * XW + 0.5 * U + maxU * U / 2, T - 10, plus(E.q / r));
            label(x0 - 12, T + r * U / 2 + 6, String(r), "side" + (R0.best && r > 1 ? " best" : ""), "end");
            s("path", { d: "M" + (x0 - 6) + " " + T + " V" + (T + r * U), class: "ex-br" }, g);
            if (r > 1) s("rect", { x: x0 - 3, y: T - 3, width: rowW + 6, height: r * U + 6, rx: 6, class: "ex-frame" + (R0.best ? " best" : "") }, g);
        }
        void P; void Q;
    }

    /* ---- drawing ---- */
    function draw(E) {
        clear(g);
        const exp = E.m === "exp";
        mExp.setAttribute("aria-pressed", String(exp)); mFac.setAttribute("aria-pressed", String(!exp));
        [expRow, looks].forEach((e) => { e.hidden = !exp; });
        [facRow, rows, bNew].forEach((e) => { e.hidden = exp; });
        head.classList.remove("done");
        if (exp) {
            sA.v.textContent = neg(E.a); sB.v.textContent = neg(E.b); sC.v.textContent = neg(E.c);
            lT.setAttribute("aria-pressed", String(E.look === "tiles")); lB.setAttribute("aria-pressed", String(E.look === "box")); tHide.setAttribute("aria-pressed", String(E.hide));
            const [ax, ac] = M.exParts(E), all = !E.hide || (E.rv[0] && (E.rv[1] || !E.c));
            head.textContent = M.exFactored(E.a, E.b, E.c) + " = " + (all ? M.exExpanded(E.a, E.b, E.c) : "?");
            if (E.hide && all) head.classList.add("done");
            const rowsTxt = Math.abs(E.a) + (Math.abs(E.a) === 1 ? " row of " : " rows of ") + M.exLin(E.b, E.c) + ".";
            sub.textContent = E.hide && !all ? "What's the area of each part? Tap a ? to check."
                : (E.look === "tiles" ? rowsTxt + " " : "") + neg(E.a) + " × " + exXs(E.b) + " = " + exXs(ax) + (E.c ? " and " + neg(E.a) + " × " + neg(E.c) + " = " + neg(ac) + "." : ".") + (E.a < 0 ? " A negative outside flips every tile." : "");
            svg.setAttribute("aria-label", "Area model of " + M.exFactored(E.a, E.b, E.c));
            drawExpand(E);
        } else {
            sP.v.textContent = neg(E.p); sQ.v.textContent = neg(E.q);
            rowB.forEach((b, i) => b.setAttribute("aria-pressed", String(E.r === i + 1)));
            const R0 = M.exRows(E), ex = M.exLin(E.p, E.q);
            head.textContent = R0.even && E.r > 1 ? ex + " = " + E.r + "(" + R0.inside + ")" : ex;
            if (R0.best && E.r > 1) head.classList.add("done");
            if (E.r === 1) sub.textContent = R0.gcf > 1 ? "Sort the tiles into equal rows. Try 2, 3 or more." : "Sort the tiles into equal rows. Try a few. Does any number work?";
            else if (R0.best) sub.textContent = E.r + " equal rows of " + R0.inside + ". " + E.r + " is the greatest common factor, so " + ex + " = " + E.r + "(" + R0.inside + ").";
            else if (R0.even) sub.textContent = E.r + " equal rows of " + R0.inside + ". That works, but a bigger number of rows works too.";
            else {
                const left = [];
                if (R0.lx) left.push(Math.abs(E.p) + " x's");
                if (R0.lq) left.push(Math.abs(E.q) + (Math.abs(E.q) === 1 ? " unit" : " units"));
                sub.textContent = "The " + left.join(" and the ") + " don't split into " + E.r + " equal rows. The orange tiles are left over.";
            }
            svg.setAttribute("aria-label", "Tiles for " + ex + " in " + E.r + (E.r === 1 ? " row" : " rows"));
            drawFactor(E);
        }
    }
    p.sync = () => draw(st());
    return p;
}
