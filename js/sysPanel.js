/* The systems graph panel (Math tools, "sys"), for 8.12 and Alg I.10.
   Two lines on a −10..10 grid, each through two whole-number points the class can drag (or move with the arrow keys).
   Where the lines cross is the solution. Parallel lines (same slope, different intercepts) have no solution; the same
   line drawn twice has infinitely many. Equations show in slope-intercept or standard form.
   Tap the grid to drop a test point: the side shows it substituted into both equations, so the class sees that only the
   crossing point works in both. "Hide the answer" turns the crossing point into a ? to tap.
   New system: one solution, no solution or infinitely many. Or type two equations.
   The model is in js/manipCore.js (sysABC, sysSolve, sysEq, sysCheck, sysPts, parseLine, sysSet, sysMove, sysNew, sysAns);
   the state is S.tools.mt.sys. */

const COL = ["sys-l1", "sys-l2"];

/** ctx: { shell, h, btn, st, save, s, txt, svgPt, drag, clear, grid, M } from js/manipPanels.js */
export function makeSys(k, ctx) {
    const { h, btn, s, txt, svgPt, drag, clear, M } = ctx;
    const st = () => ctx.st(k), save = ctx.save;
    const p = ctx.shell(k), R = M.SYS_R, PX = 320;
    const svg = s("svg", { viewBox: "0 0 " + PX + " " + PX, class: "mt-svg sys-svg", role: "img" });
    const G = ctx.grid(svg, R, PX, 2);
    const clip = s("clipPath", { id: "mtSysClip" }, s("defs", null, svg));
    s("rect", { x: G.X(-R), y: G.Y(R), width: G.X(R) - G.X(-R), height: G.Y(-R) - G.Y(R) }, clip);
    const lines = [0, 1].map((i) => s("line", { class: "sys-line " + COL[i] + (i ? " two" : ""), "clip-path": "url(#mtSysClip)" }, svg));
    const meet = s("g", { class: "sys-meet", role: "button", tabindex: "0" }, svg);
    const tpG = s("g", { class: "sys-tp" }, svg);
    const ptG = s("g", null, svg);

    /* ---- the side ---- */
    const eqs = h("div", "sys-eqs"), eqT = [0, 1].map((i) => { const r = h("div", "sys-eqr " + COL[i]); r.append(h("i", "sys-sw"), h("span", "sys-n", "Line " + (i + 1)), h("b", "sys-eq")); eqs.appendChild(r); return r.lastChild; });
    const forms = h("div", "mt-row");
    const fSi = btn("y = mx + b", "mt-chip", () => setForm("si"), "Show slope-intercept form"), fStd = btn("Ax + By = C", "mt-chip", () => setForm("std"), "Show standard form");
    forms.append(fSi, fStd);
    const setForm = (f) => { const S = st(); if (S.f !== f) { S.f = f; save(); } };
    const res = h("div", "sys-res"), resH = h("b", "sys-rh"), resP = h("p", "sys-rp");
    const reveal = btn("Check the answer", "mt-chip", () => { st().rv = true; save(); }, "Show the solution");
    res.append(resH, resP, reveal);
    const chk = h("div", "sys-chk");
    const news = h("div", "mt-row"); news.appendChild(h("span", "mt-sl", "New system"));
    [["one", "One solution"], ["none", "No solution"], ["many", "Infinitely many"]].forEach(([kind, lab]) =>
        news.appendChild(btn(lab, "", () => { const S = st(); if (M.sysNew(S, kind)) { p.say(""); save(); } }, "A new system with " + lab.toLowerCase())));
    const form = h("form", "mt-row mt-set sys-form");
    const ins = [0, 1].map((i) => { const inp = h("input", "mt-in"); inp.type = "text"; inp.autocomplete = "off"; inp.spellcheck = false; inp.id = "mtIn-sys" + i; inp.setAttribute("aria-label", "Line " + (i + 1)); inp.placeholder = i ? "x + y = 7" : "y = 2x + 1"; return inp; });
    form.append(ins[0], ins[1], btn("Graph", "mt-go", () => form.requestSubmit(), "Graph the two equations"));
    form.addEventListener("pointerdown", (e) => e.stopPropagation());
    form.onsubmit = (e) => {
        e.preventDefault();
        const A = M.parseLine(ins[0].value), B = M.parseLine(ins[1].value);
        const bad = A.err ? ["Line 1", A.err] : B.err ? ["Line 2", B.err] : null;
        if (bad) { p.say(bad[0] + ": " + bad[1], "amber"); return; }
        const why = M.sysSet(st(), A, B); if (why) { p.say(why, "amber"); return; }
        ins.forEach((x) => { x.value = ""; x.blur(); }); p.say("Graphed. Where do they cross?"); save();
    };
    const tools = h("div", "mt-row");
    const bHide = btn("Hide the answer", "mt-chip", () => { const S = st(); S.hide = !S.hide; S.rv = false; save(); }, "Hide where the lines cross");
    tools.append(bHide, btn("Clear the test point", "", () => { const S = st(); if (S.tp) { S.tp = null; save(); } }, "Take the test point off"),
        btn("Start over", "", () => { Object.assign(st(), M.sysDefault()); p.say(""); save(); }, "Back to the starting system"));
    p.main.append(svg); p.side.append(eqs, forms, res, chk, news, form, tools, p.note);

    /* ---- the four points ---- */
    let live = null;   // a drag in progress: the system as it looks on this screen
    const pts = [];
    [0, 1].forEach((i) => [0, 1].forEach((w) => {
        const g = s("g", { class: "sys-pt " + COL[i], tabindex: "0", role: "slider", "data-key": i + "-" + w, "aria-label": "Line " + (i + 1) + ", point " + (w + 1) + ". Drag it, or use the arrow keys" }, ptG);
        s("circle", { r: 15, class: "sys-hit" }, g); s("circle", { r: 7, class: "sys-dot" }, g);
        pts.push({ g, i, w });
        drag(p, g, {
            down: () => { live = JSON.parse(JSON.stringify(st())); g.classList.add("drag"); },
            move: (e) => { const q = svgPt(svg, e); if (live && M.sysMove(live, i, w, Math.round(G.ux(q.x)), Math.round(G.uy(q.y)))) draw(live); },
            up: (e, cancel) => {
                g.classList.remove("drag"); const L = live; live = null; const S = st();
                if (L && !cancel && JSON.stringify(L.l) !== JSON.stringify(S.l)) { S.l = L.l; S.rv = false; save(); } else draw(S);
            },
        });
        g.addEventListener("keydown", (e) => {
            const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!d) return;
            e.preventDefault(); e.stopPropagation();
            const S = st(), q = S.l[i][w];
            if (M.sysMove(S, i, w, q[0] + d[0], q[1] + d[1])) { save(); refocus(i + "-" + w); }
        });
    }));
    const refocus = (key) => { const f = () => { const el = ptG.querySelector('[data-key="' + key + '"]'); if (el && document.activeElement !== el) el.focus({ preventScroll: true }); }; f(); setTimeout(f, 0); requestAnimationFrame(f); };

    /* tap the grid: drop a test point there (tap it again to lift it) */
    svg.addEventListener("click", (e) => {
        if (e.target.closest(".sys-pt") || e.target.closest(".sys-meet")) return;
        const q = svgPt(svg, e), x = Math.round(G.ux(q.x)), y = Math.round(G.uy(q.y));
        if (Math.abs(x) > R || Math.abs(y) > R) return;
        const S = st(); S.tp = S.tp && S.tp[0] === x && S.tp[1] === y ? null : [x, y]; save();
    });
    /* the crossing point: tap the ? to check it, or tap the point to test it in both equations */
    const doReveal = () => {
        const S = st(); if (S.hide && !S.rv) { S.rv = true; save(); return; }
        const r = M.sysSolve(S); if (r.kind === "one" && r.x[1] === 1 && r.y[1] === 1) { S.tp = [r.x[0], r.y[0]]; save(); }
    };
    meet.addEventListener("click", (e) => { e.stopPropagation(); doReveal(); });
    meet.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doReveal(); } });

    const pt = (x, y) => "(" + M.fracText([x, 1]) + ", " + M.fracText([y, 1]) + ")";
    function setLine(el, P, Q) {
        if (P[0] === Q[0]) { el.setAttribute("x1", G.X(P[0])); el.setAttribute("x2", G.X(P[0])); el.setAttribute("y1", G.Y(R + 2)); el.setAttribute("y2", G.Y(-R - 2)); return; }
        const m = (Q[1] - P[1]) / (Q[0] - P[0]), f = (x) => P[1] + m * (x - P[0]);
        el.setAttribute("x1", G.X(-R - 2)); el.setAttribute("y1", G.Y(f(-R - 2))); el.setAttribute("x2", G.X(R + 2)); el.setAttribute("y2", G.Y(f(R + 2)));
    }
    function draw(S) {
        const sol = M.sysSolve(S), hid = S.hide && !S.rv;
        S.l.forEach((L, i) => { setLine(lines[i], L[0], L[1]); eqT[i].textContent = M.sysEq(L[0], L[1], S.f); });
        lines[1].classList.toggle("same", sol.kind === "many");
        pts.forEach(({ g, i, w }) => { const q = S.l[i][w]; g.setAttribute("transform", "translate(" + G.X(q[0]) + " " + G.Y(q[1]) + ")"); g.setAttribute("aria-valuetext", pt(q[0], q[1])); });

        /* where they cross */
        clear(meet);
        const xv = sol.kind === "one" ? sol.x[0] / sol.x[1] : 0, yv = sol.kind === "one" ? sol.y[0] / sol.y[1] : 0, onGrid = sol.kind === "one" && Math.abs(xv) <= R + 0.5 && Math.abs(yv) <= R + 0.5;
        meet.style.display = onGrid ? "" : "none";
        if (onGrid) {
            const cx = G.X(xv), cy = G.Y(yv), lab = hid ? "?" : M.sysAns(S), right = xv < R - 4, up = yv < R - 2;
            s("circle", { cx, cy, r: 13, class: "sys-halo" }, meet); s("circle", { cx, cy, r: 7.5, class: "sys-x" }, meet);
            const tw = lab.length * 7.4 + 14, bx = right ? cx + 12 : cx - 12 - tw, by = up ? cy - 30 : cy + 10;
            s("rect", { x: bx, y: by, width: tw, height: 20, rx: 10, class: "sys-pill" + (hid ? " q" : "") }, meet);
            txt(meet, bx + tw / 2, by + 14.5, lab, "sys-pl", { "text-anchor": "middle" });
            meet.setAttribute("aria-label", hid ? "The lines cross here. Tap to check the answer" : "The lines cross at " + lab + ". Tap to test it");
        }

        /* the test point */
        clear(tpG); clear(chk);
        if (S.tp) {
            const [x, y] = S.tp, c = [0, 1].map((i) => M.sysCheck(S, i, S.tp)), both = c[0].on && c[1].on;
            s("rect", { x: G.X(x) - 6.5, y: G.Y(y) - 6.5, width: 13, height: 13, rx: 2, transform: "rotate(45 " + G.X(x) + " " + G.Y(y) + ")", class: "sys-tpd" + (both ? " yes" : "") }, tpG);
            const tl = pt(x, y), atMeet = onGrid && !hid && x === xv && y === yv;
            if (!atMeet) txt(tpG, G.X(x) + (x < R - 3 ? 10 : -10), G.Y(y) + (y > -R + 2 ? 16 : -10), tl, "sys-tpl", { "text-anchor": x < R - 3 ? "start" : "end" });
            chk.appendChild(h("div", "sys-ch", "Test " + tl));
            c.forEach((r, i) => { const d = h("div", "sys-cl " + COL[i] + (r.on ? " yes" : " no")); d.append(h("i", "sys-sw"), h("span", null, r.text), h("b", null, r.on ? "✓" : "✗")); chk.appendChild(d); });
            chk.appendChild(h("p", "sys-cv" + (both ? " yes" : ""), both ? tl + " works in both equations, so it is the solution." : c[0].on || c[1].on ? tl + " is only on line " + (c[0].on ? 1 : 2) + ", so it is not a solution." : tl + " is on neither line."));
        } else chk.appendChild(h("p", "sys-hint", "Tap the grid to test a point in both equations."));

        /* the answer */
        res.dataset.kind = hid ? "" : sol.kind;
        reveal.hidden = !hid;
        if (hid) { resH.textContent = "One solution, none, or infinitely many?"; resP.textContent = sol.kind === "one" ? "Read where the lines cross, then tap the ? to check." : "Look at the slopes and the y-intercepts, then check."; }
        else if (sol.kind === "one") {
            const a = M.sysAns(S);
            resH.textContent = "One solution: " + a;
            resP.textContent = "x = " + M.fracText(sol.x) + " and y = " + M.fracText(sol.y) + " make both equations true." + (onGrid ? "" : " They cross off this grid.");
        } else {
            const o = M.lineOf({ a: S.l[0][0], b: S.l[0][1] });
            const slope = o.vert ? "Both lines are vertical" : "Both lines have slope " + M.fracText(o.m);
            resH.textContent = sol.kind === "none" ? "No solution" : "Infinitely many solutions";
            resP.textContent = sol.kind === "none" ? slope + ", but a different " + (o.vert ? "x-intercept" : "y-intercept") + ", so they are parallel and never meet." : "It's the same line twice, so every point on it works in both equations.";
        }
        fSi.setAttribute("aria-pressed", String(S.f !== "std")); fStd.setAttribute("aria-pressed", String(S.f === "std"));
        bHide.setAttribute("aria-pressed", String(!!S.hide));
        svg.setAttribute("aria-label", "Line 1: " + eqT[0].textContent + ". Line 2: " + eqT[1].textContent + "." + (hid ? "" : " " + M.sysAns(S) + "."));
    }
    p.sync = () => { if (!live) draw(st()); };
    return p;
}
