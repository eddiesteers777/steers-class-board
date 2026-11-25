/* The rational number line panel (Math tools, "nl"), for 7.5.
   Add and subtract: start at p and jump q. A jump to the right is adding a positive; to the left, a negative. Subtracting
   q draws the same jump as adding −q, so the class sees why p − q = p + (−q). Landing on 0 shows a number and its opposite.
   Distance: two points, and the distance between them as |B − A|.
   Every value is a whole number of steps (halves, thirds, fourths, fifths, eighths or tenths), shown as fractions or decimals.
   Drag either dot, or use the arrow keys on it (Shift moves a whole). "Hide the answer" turns the landing spot or the
   distance into a ? to tap.
   The model is in js/manipCore.js (nlEnd, nlMove, nlParts, nlDec, nlText, nlSum, nlStep, nlSet, nlDen, nlNew);
   the state is S.tools.mt.nl. */

const DEN_NAMES = { 2: ["½", "halves"], 3: ["⅓", "thirds"], 4: ["¼", "fourths"], 5: ["⅕", "fifths"], 8: ["⅛", "eighths"], 10: ["⅒", "tenths"] };

/** ctx: { shell, h, btn, st, save, s, txt, svgPt, drag, clear, M } from js/manipPanels.js */
export function makeNl(k, ctx) {
    const { h, btn, s, txt, svgPt, drag, clear, M } = ctx;
    const st = () => ctx.st(k), save = ctx.save;
    const p = ctx.shell(k);
    const W = 360, H = 250, X0 = 22, X1 = 338, LY = 138;
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "mt-svg nl-svg", role: "img" });
    const g = s("g", null, svg);
    const dotG = s("g", null, svg);

    /* ---- the side ---- */
    const modes = h("div", "mt-row");
    const mAdd = btn("Add and subtract", "mt-chip", () => { const N = st(); if (N.m !== "add") { N.m = "add"; N.rv = false; save(); } }, "Jump along the line");
    const mDist = btn("Distance", "mt-chip", () => { const N = st(); if (N.m !== "dist") { N.m = "dist"; N.rv = false; save(); } }, "The distance between two points");
    modes.append(mAdd, mDist);
    const head = h("div", "mt-eq nl-head");
    const sub = h("p", "nl-sub");

    const stepper = (lab, key, aria) => {
        const w = h("div", "nl-step"), v = h("b", "nl-sv");
        const go = (dd) => { const N = st(); if (M.nlStep(N, key, dd)) save(); else p.say("That would run off the line.", "amber"); };
        w.append(h("span", "mt-sl", lab), btn("−", "nl-sb", () => go(-1), aria + " down one step"), v, btn("+", "nl-sb", () => go(1), aria + " up one step"));
        return { w, v };
    };
    const addRow = h("div", "nl-steps");
    const sP = stepper("Start", "p", "The start");
    const opW = h("div", "mt-row nl-ops");
    const setOp = (o) => { const N = st(); if (N.op === o) return; if (!M.nlIn(M.nlEnd(Object.assign({}, N, { op: o })), N.d)) { p.say("That would run off the line.", "amber"); return; } N.op = o; N.rv = false; save(); };
    const oPlus = btn("Add", "mt-chip", () => setOp("+"), "Add the number");
    const oMinus = btn("Subtract", "mt-chip", () => setOp("−"), "Subtract the number");
    opW.append(h("span", "mt-sl", "Then"), oPlus, oMinus);
    const sQ = stepper("Number", "q", "The number added or subtracted");
    addRow.append(sP.w, opW, sQ.w);
    /** Plain text with a repeating digit (a digit and U+0305) drawn with a bar over it. */
    const rich = (el, text) => { clear(el); text.split(/(\d\u0305)/).forEach((bit) => { if (/^\d\u0305$/.test(bit)) el.appendChild(h("span", "nl-rep", bit[0])); else if (bit) el.append(bit); }); };
    const distRow = h("div", "nl-steps");
    const sA = stepper("A", "a", "Point A"), sB = stepper("B", "b", "Point B");
    distRow.append(sA.w, sB.w);

    const dens = h("div", "mt-row nl-dens");
    dens.appendChild(h("span", "mt-sl", "Steps"));
    const denB = M.NL_DENS.map((d) => { const b = btn(DEN_NAMES[d][0], "mt-chip nl-d", () => { const N = st(); if (N.d !== d) { M.nlDen(N, d); save(); } }, "Steps of " + DEN_NAMES[d][1]); dens.appendChild(b); return b; });
    const looks = h("div", "mt-row");
    const lF = btn("Fractions", "mt-chip", () => { const N = st(); if (N.f !== "frac") { N.f = "frac"; save(); } });
    const lD = btn("Decimals", "mt-chip", () => { const N = st(); if (N.f !== "dec") { N.f = "dec"; save(); } });
    const tHide = btn("Hide the answer", "mt-chip", () => { const N = st(); N.hide = !N.hide; N.rv = false; save(); }, "Hide the answer for the class to find");
    looks.append(lF, lD, tHide);
    const foot = h("div", "mt-row mt-setup");
    const bNew = btn("New problem", "", () => { M.nlNew(st()); save(); });
    const bOver = btn("Start over", "", () => { const N = st(), m = N.m; Object.assign(N, M.nlDefault(), { m }); save(); });
    foot.append(bNew, bOver);

    p.main.append(svg);
    p.side.append(modes, head, sub, addRow, distRow, dens, looks, foot, p.note);

    /* ---- numbers, as stacked fractions or decimals ---- */
    /** The pieces of n/d to draw, and how wide they are at font size fs. */
    function layout(n, d, f, fs, plus) {
        const sg = n < 0 ? "−" : plus && n > 0 ? "+" : "";
        if (f === "dec") { const D = M.nlDec(Math.abs(n), d), t = sg + D.s; return { t, rep: D.rep || "", w: (t.length + (D.rep ? 1 : 0)) * fs * 0.58, tall: false }; }
        const P = M.nlParts(n, d), ff = fs * 0.7;
        const t = sg + (P.zero ? "0" : P.w || !P.num ? String(P.w) : "");
        const wt = t.length * fs * 0.58, fw = P.num ? Math.max(String(P.num).length, String(P.den).length) * ff * 0.62 + 4 : 0;
        return { t, wt, P, ff, fw, w: wt + (P.num && t ? 2 : 0) + fw, tall: !!P.num };
    }
    /** Draw n/d centred at (cx, cy); returns its width and height. */
    function num(parent, cx, cy, n, d, f, fs, cls, plus) {
        const L = layout(n, d, f, fs, plus), x0 = cx - L.w / 2, gp = s("g", { class: "nl-num" + (cls ? " " + cls : "") }, parent);
        if (f === "dec") {
            const t = txt(gp, x0, cy + fs * 0.35, L.t, "", { "font-size": fs });
            if (L.rep) { const r = s("tspan", { class: "nl-rep" }, t); r.textContent = L.rep; }
            return { w: L.w, h: fs + 4 };
        }
        if (L.t) txt(gp, x0, cy + fs * 0.35, L.t, "", { "font-size": fs });
        if (L.P.num) {
            const fx = x0 + L.wt + (L.t ? 2 : 0) + L.fw / 2;
            txt(gp, fx, cy - 3, String(L.P.num), "", { "font-size": L.ff, "text-anchor": "middle" });
            s("line", { x1: fx - L.fw / 2 + 1, x2: fx + L.fw / 2 - 1, y1: cy + 0.5, y2: cy + 0.5, class: "nl-bar" }, gp);
            txt(gp, fx, cy + L.ff * 0.85 + 2, String(L.P.den), "", { "font-size": L.ff, "text-anchor": "middle" });
        }
        return { w: L.w, h: L.tall ? L.ff * 2 + 6 : fs + 4 };
    }
    /** A value in a pill; a hidden one is a ? to tap. */
    function pill(cx, cy, n, d, f, tone, hidden, plus) {
        const pg = s("g", { class: "nl-pill " + tone }, g);
        const r = s("rect", { rx: 9 }, pg);
        let w, hh;
        if (hidden) { txt(pg, cx, cy + 7, "?", "nl-q", { "text-anchor": "middle" }); w = 14; hh = 26; }
        else { const m = num(pg, cx, cy, n, d, f, 16, "", plus); w = m.w; hh = Math.max(24, m.h + 6); }
        Object.entries({ x: cx - w / 2 - 8, y: cy - hh / 2, width: w + 16, height: hh }).forEach(([a, v]) => r.setAttribute(a, v));
        if (hidden) {
            pg.setAttribute("tabindex", "0"); pg.setAttribute("role", "button"); pg.setAttribute("aria-label", "Show the answer"); pg.classList.add("tap");
            const show = (e) => { e.stopPropagation(); const N = st(); N.rv = true; save(); };
            pg.addEventListener("pointerdown", (e) => e.stopPropagation()); pg.addEventListener("click", show);
            pg.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(e); } });
        }
        return { w: w + 16, hh };
    }
    const arrowHead = (x, y, ang, cls) => {
        const a = 9, b = 5, c = Math.cos(ang), sn = Math.sin(ang);
        s("polygon", { points: [[x, y], [x - a * c - b * sn, y - a * sn + b * c], [x - a * c + b * sn, y - a * sn - b * c]].map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" "), class: "nl-ah " + cls }, g);
    };

    /* ---- the line ---- */
    /** The stretch of the line to show, in whole units: every value in view, with a unit to spare. */
    function rangeOf(N) {
        const vs = (N.m === "dist" ? [0, N.a, N.b] : [0, N.p, M.nlEnd(N)]).map((v) => v / N.d);
        let lo = Math.floor(Math.min(...vs)) - 1, hi = Math.ceil(Math.max(...vs)) + 1;
        while (hi - lo < 4) { hi++; if (hi - lo < 4) lo--; }
        return [lo, hi];
    }
    function drawLine(N, lo, hi) {
        const u = (X1 - X0) / (hi - lo), X = (v) => X0 + (v - lo) * u;
        s("line", { x1: X0 - 12, x2: X1 + 12, y1: LY, y2: LY, class: "nl-ax" }, g);
        arrowHead(X1 + 14, LY, 0, "ax"); arrowHead(X0 - 14, LY, Math.PI, "ax");
        if (u / N.d >= 5) for (let i = lo * N.d; i <= hi * N.d; i++) if (i % N.d) s("line", { x1: X(i / N.d), x2: X(i / N.d), y1: LY - 5, y2: LY + 5, class: "nl-tk" }, g);
        const every = u >= 22 ? 1 : u >= 11 ? 2 : 5;
        for (let v = lo; v <= hi; v++) {
            s("line", { x1: X(v), x2: X(v), y1: LY - 9, y2: LY + 9, class: "nl-tk big" + (v === 0 ? " zero" : "") }, g);
            if (v % every === 0) txt(g, X(v), LY + 25, v < 0 ? "−" + -v : String(v), "nl-il" + (v === 0 ? " zero" : ""), { "text-anchor": "middle" });
        }
        return X;
    }

    /* ---- the dots you drag ---- */
    let live = null;   // { key, N, R } while a dot is being dragged
    function dot(x, cls, key, aria, N) {
        const d = s("g", { class: "nl-dot " + cls, tabindex: "0", role: "slider", "aria-label": aria + ". Drag it, or use the arrow keys", transform: "translate(" + x.toFixed(1) + " " + LY + ")" }, dotG);
        d.setAttribute("aria-valuetext", M.nlText(N[key === "r" ? "p" : key] + (key === "r" ? M.nlMove(N) : 0), N.d, N.f));
        s("circle", { r: 18, class: "nl-hit" }, d); s("circle", { r: 8, class: "nl-face" }, d);
        d.dataset.key = key;
        return d;
    }
    /** Dragging the landing dot changes the number added (or subtracted); the others move a point. */
    function apply(N, key, steps) {
        if (key === "r") { const want = steps - N.p; return M.nlSet(N, "q", N.op === "−" ? -want : want); }
        return M.nlSet(N, key, steps);
    }
    function wire(d, u, lo, hi) {
        const key = d.dataset.key;
        drag(p, d, {
            down: () => { const N = st(); live = { key, N: Object.assign({}, N), R: [lo, hi] }; d.classList.add("drag"); },
            move: (e) => {
                if (!live) return;
                const q = svgPt(svg, e), N = live.N, v = Math.max(lo, Math.min(hi, lo + (q.x - X0) / u));
                const T = Object.assign({}, N);
                if (apply(T, key, Math.round(v * N.d))) { live.N = T; draw(T, live.R); }
            },
            up: (e, cancel) => {
                const L = live; live = null;
                const N = st();
                if (L && !cancel && ["p", "q", "a", "b"].some((x) => L.N[x] !== N[x])) { Object.assign(N, { p: L.N.p, q: L.N.q, a: L.N.a, b: L.N.b, rv: false }); save(); }
                else draw(N);
            },
        });
        d.addEventListener("keydown", (e) => {
            const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]; if (!dir) return;
            e.preventDefault(); e.stopPropagation();
            const N = st(), by = dir * (e.shiftKey ? N.d : 1);
            const now = key === "r" ? N.p + M.nlMove(N) : N[key];
            if (apply(N, key, now + by)) { N.rv = false; save(); refocus(key); } else p.say("That would run off the line.", "amber");
        });
    }
    /** A save can redraw the board around the panel; keep the keys on the dot being moved. */
    const refocus = (key) => { const f = () => { const el = dotG.querySelector('[data-key="' + key + '"]'); if (el && document.activeElement !== el) el.focus({ preventScroll: true }); }; f(); setTimeout(f, 0); requestAnimationFrame(f); };

    /* ---- add and subtract ---- */
    function drawAdd(N, lo, hi) {
        const X = drawLine(N, lo, hi);
        const r = M.nlEnd(N), mv = M.nlMove(N), xp = X(N.p / N.d), xr = X(r / N.d), x0 = X(0);
        const hidden = N.hide && !N.rv;
        if (N.p) {   // from 0 out to the start
            s("line", { x1: x0, x2: xp - Math.sign(xp - x0) * 9, y1: LY - 16, y2: LY - 16, class: "nl-go start" }, g);
            arrowHead(xp, LY - 16, xp > x0 ? 0 : Math.PI, "start");
        }
        if (mv) {   // the jump
            const span = Math.abs(xr - xp), hgt = Math.min(70, 26 + span * 0.3), cy = LY - 6 - 2 * hgt, tone = mv > 0 ? "right" : "left";
            const ex = xr - Math.sign(xr - xp) * 2, ey = LY - 8;
            s("path", { d: "M" + xp.toFixed(1) + " " + (LY - 8) + " Q" + ((xp + xr) / 2).toFixed(1) + " " + cy.toFixed(1) + " " + ex.toFixed(1) + " " + ey, class: "nl-jump " + tone }, g);
            arrowHead(ex, ey, Math.atan2(ey - cy, ex - (xp + xr) / 2), tone);
            const apex = LY - 6 - hgt;
            pill((xp + xr) / 2, apex - 18, mv, N.d, N.f, "move " + tone, false, true);
        }
        // the start and where you land, below the line
        const wS = layout(N.p, N.d, N.f, 16).w + 16, wR = hidden ? 30 : layout(r, N.d, N.f, 16).w + 16;
        const clash = Math.abs(xp - xr) < (wS + wR) / 2 + 4;
        if (mv) pill(xp, LY + 56, N.p, N.d, N.f, "start", false);
        pill(xr, LY + (clash && mv ? 92 : 56), r, N.d, N.f, "land", hidden);
        if (mv) { dot(xp, "start", "p", "The start", N); dot(xr, "land", "r", "Where the jump lands", N); }
        else dot(xp, "start", "p", "The start", N);
    }

    /* ---- distance ---- */
    function drawDist(N, lo, hi) {
        const X = drawLine(N, lo, hi);
        const xa = X(N.a / N.d), xb = X(N.b / N.d), dd = Math.abs(N.b - N.a), hidden = N.hide && !N.rv;
        if (dd) {
            s("line", { x1: Math.min(xa, xb), x2: Math.max(xa, xb), y1: LY, y2: LY, class: "nl-gap" }, g);
            const by = LY - 34;
            s("path", { d: "M" + xa.toFixed(1) + " " + (by + 8) + " V" + by + " H" + xb.toFixed(1) + " V" + (by + 8), class: "nl-br" }, g);
            pill((xa + xb) / 2, by - 22, dd, N.d, N.f, "dist", hidden);
        }
        const wA = layout(N.a, N.d, N.f, 16).w + 16, wB = layout(N.b, N.d, N.f, 16).w + 16;
        const clash = Math.abs(xa - xb) < (wA + wB) / 2 + 4;
        pill(xa, LY + 56, N.a, N.d, N.f, "start", false);
        pill(xb, LY + (clash ? 92 : 56), N.b, N.d, N.f, "land", false);
        txt(g, xa, LY - 14, "A", "nl-pl start", { "text-anchor": "middle" });
        txt(g, xb, LY - 14, "B", "nl-pl land", { "text-anchor": "middle" });
        dot(xa, "start", "a", "Point A", N);
        dot(xb, "land", "b", "Point B", N);
    }

    /* ---- the side, in words ---- */
    /** n/d in HTML: a stacked fraction or a decimal with its repeating digit barred. */
    function hnum(n, d, f, paren) {
        const w = h("span", "nl-hn");
        if (paren && n < 0) w.append("(");
        if (f === "dec") { const D = M.nlDec(n, d); w.append(D.s); if (D.rep) w.appendChild(h("span", "nl-rep", D.rep)); }
        else {
            const P = M.nlParts(n, d);
            const lead = (P.neg ? "−" : "") + (P.zero ? "0" : P.w || !P.num ? String(P.w) : "");
            if (lead) w.append(lead);
            if (P.num) { const fr = h("span", "nl-fr"); fr.append(h("span", "", String(P.num)), h("span", "", String(P.den))); w.appendChild(fr); }
        }
        if (paren && n < 0) w.append(")");
        return w;
    }
    const T = (n, N) => M.nlText(n, N.d, N.f);
    const amt = (n, N) => T(Math.abs(n), N);
    const dir = (n) => (n > 0 ? "to the right" : "to the left");

    function draw(N, R) {
        clear(g); clear(dotG);
        const add = N.m === "add";
        mAdd.setAttribute("aria-pressed", String(add)); mDist.setAttribute("aria-pressed", String(!add));
        addRow.hidden = !add; distRow.hidden = add;
        denB.forEach((b, i) => b.setAttribute("aria-pressed", String(M.NL_DENS[i] === N.d)));
        lF.setAttribute("aria-pressed", String(N.f === "frac")); lD.setAttribute("aria-pressed", String(N.f === "dec"));
        tHide.setAttribute("aria-pressed", String(N.hide));
        const [lo, hi] = R || rangeOf(N), hidden = N.hide && !N.rv;
        clear(head); head.classList.remove("done");
        if (add) {
            rich(sP.v, T(N.p, N)); rich(sQ.v, T(N.q, N));
            oPlus.setAttribute("aria-pressed", String(N.op === "+")); oMinus.setAttribute("aria-pressed", String(N.op === "−"));
            const r = M.nlEnd(N), mv = M.nlMove(N);
            head.append(hnum(N.p, N.d, N.f), " " + N.op + " ", hnum(N.q, N.d, N.f, true), " = ", hidden ? "?" : hnum(r, N.d, N.f));
            if (N.hide && N.rv) head.classList.add("done");
            let t = mv ? "Start at " + T(N.p, N) + " and move " + amt(mv, N) + " " + dir(mv) + "." : "Start at " + T(N.p, N) + ". Adding 0 doesn't move you.";
            t += hidden ? " Where do you land? Tap the ? to check." : mv ? " You land on " + T(r, N) + "." : "";
            if (N.op === "−" && N.q) t += " Subtracting " + T(N.q, N) + " is the same as adding its opposite, " + T(-N.q, N) + ".";
            else if (!hidden && r === 0 && N.p) t += " A number plus its opposite is 0.";
            rich(sub, t);
            svg.setAttribute("aria-label", "Number line: " + M.nlSum(N, hidden));
            drawAdd(N, lo, hi);
        } else {
            rich(sA.v, T(N.a, N)); rich(sB.v, T(N.b, N));
            const dd = Math.abs(N.b - N.a);
            head.append("|", hnum(N.b, N.d, N.f), " − ", hnum(N.a, N.d, N.f, true), "| = ", hidden ? "?" : hnum(dd, N.d, N.f));
            if (N.hide && N.rv) head.classList.add("done");
            rich(sub, "A is at " + T(N.a, N) + " and B is at " + T(N.b, N) + ". " + (hidden ? "How far apart are they? Tap the ? to check."
                : "They are " + T(dd, N) + " apart. Distance is the absolute value of the difference, so it is never negative."));
            svg.setAttribute("aria-label", "Number line: " + M.nlSum(N, hidden));
            drawDist(N, lo, hi);
        }
        const u = (X1 - X0) / (hi - lo);
        dotG.querySelectorAll(".nl-dot").forEach((d) => wire(d, u, lo, hi));
    }
    p.sync = () => { if (!live) draw(st()); };
    return p;
}
