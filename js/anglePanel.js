/* The angle explorer panel (Math tools, "angle"), for 8.25.
   Parallel lines: two lines cut by a transversal. Drag the dot to turn the transversal; the eight angles update.
   Tap a kind of pair (corresponding, alternate interior…) to light up every pair of that kind, or tap two angles to
   hear what they are to each other. "Hide angles" shows one angle and asks for the rest; "Not parallel" tips the
   lower line so the pairs stop matching. Triangle: drag the corners, then tear the three corners off onto a straight line.
   The model is in js/manipCore.js (angVals, angPair, triAngles); the state is S.tools.mt.angle. */

const PAIR_COLS = ["#3F7FE0", "#F2B33D", "#2FA36B", "#D6409F"];
const TRI_COLS = ["#3F7FE0", "#F2B33D", "#2FA36B"];
const UP = 92, LOW = 188, MID = (UP + LOW) / 2;   // where the two lines cross the middle of the picture
const rad = (d) => d * Math.PI / 180;

/** ctx: { shell, h, btn, st, save, s, txt, svgPt, drag, clear, M } from js/manipPanels.js */
export function makeAngle(k, ctx) {
    const { h, btn, s, txt, svgPt, drag, clear, M } = ctx;
    const st = () => ctx.st(k), save = ctx.save;
    const p = ctx.shell(k);
    const W = M.ANG_W, H = M.ANG_H, CX = W / 2;
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "mt-svg an-svg", role: "img" });
    const parG = s("g", { class: "an-par" }, svg), triG = s("g", { class: "an-tri" }, svg);

    /* ---- the side ---- */
    const modes = h("div", "mt-row an-modes");
    const mPar = btn("Parallel lines", "mt-chip", () => { const A = st(); if (A.m !== "par") { A.m = "par"; save(); } }), mTri = btn("Triangle", "mt-chip", () => { const A = st(); if (A.m !== "tri") { A.m = "tri"; save(); } });
    modes.append(mPar, mTri);
    const head = h("div", "mt-eq an-head");
    const sub = h("p", "an-sub");
    const kinds = h("div", "an-kinds");
    const kindB = {};
    M.ANG_KINDS.forEach((kk) => {
        const P = M.ANG_PAIRS[kk];
        kindB[kk] = btn(P.name, "mt-chip an-kind", () => { const A = st(); A.pk = A.pk === kk ? "" : kk; A.sel = []; save(); }, "Show the " + P.plural.toLowerCase());
        kinds.appendChild(kindB[kk]);
    });
    const opts = h("div", "mt-row an-opts");
    const tHide = btn("Hide angles", "mt-chip", () => { const A = st(); A.hide = !A.hide; A.rv = []; A.sel = []; save(); }, "Show one angle and find the rest");
    const tNp = btn("Not parallel", "mt-chip", () => { const A = st(); A.np = !A.np; save(); }, "Tip the lower line so the lines are not parallel");
    opts.append(tHide, tNp);
    const tearB = btn("Tear off the corners", "an-tear", () => { const A = st(); A.torn = !A.torn; save(); });
    const triFacts = h("div", "an-tfacts");
    const reset = h("div", "mt-row mt-setup");
    reset.append(btn("Start over", "", () => { const A = st(), m = A.m; Object.assign(A, M.angDefault(), { m }); save(); }));
    p.main.append(svg);
    p.side.append(modes, head, sub, kinds, opts, triFacts, tearB, reset, p.note);

    /* ---- parallel lines: the picture ---- */
    const linesG = s("g", { class: "an-lines" }, parG);
    const upL = s("line", { class: "an-l" }, linesG), lowL = s("line", { class: "an-l" }, linesG), trL = s("line", { class: "an-tr" }, linesG);
    const arrows = s("g", { class: "an-arr" }, linesG);
    const sectG = s("g", null, parG);
    const sect = [null];
    for (let i = 1; i <= 8; i++) {
        const g = s("g", { class: "an-ang", tabindex: "0", role: "button" }, sectG);
        const hit = s("path", { class: "an-hit" }, g), fill = s("path", { class: "an-fill" }, g), num = txt(g, 0, 0, String(i), "an-num", { "text-anchor": "middle" }), val = txt(g, 0, 0, "", "an-val", { "text-anchor": "middle" });
        g.addEventListener("pointerdown", (e) => e.stopPropagation());
        g.addEventListener("click", (e) => { e.stopPropagation(); tap(i); });
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(i); } });
        sect.push({ g, hit, fill, num, val });
    }
    const knob = s("g", { class: "an-knob", tabindex: "0", role: "slider", "aria-label": "Turn the transversal. Drag it, or use the arrow keys", "aria-valuemin": M.ANG_MIN, "aria-valuemax": M.ANG_MAX }, parG);
    s("circle", { r: 17, class: "an-khit" }, knob); s("circle", { r: 9, class: "an-kdot" }, knob);
    let liveA = null;
    drag(p, knob, {
        down: () => { liveA = st().a; knob.classList.add("drag"); },
        move: (e) => { const q = svgPt(svg, e); let d = Math.atan2(MID - q.y, q.x - CX) * 180 / Math.PI; if (d < 0) d += 180; const a = Math.min(M.ANG_MAX, Math.max(M.ANG_MIN, Math.round(d))); if (a !== liveA) { liveA = a; draw(Object.assign({}, st(), { a })); } },
        up: (e, cancel) => { knob.classList.remove("drag"); const A = st(); if (!cancel && liveA !== A.a) { A.a = liveA; save(); } else draw(A); },
    });
    knob.addEventListener("keydown", (e) => { const d = { ArrowLeft: 1, ArrowUp: 1, ArrowRight: -1, ArrowDown: -1 }[e.key]; if (!d) return; e.preventDefault(); e.stopPropagation(); const A = st(), a = Math.min(M.ANG_MAX, Math.max(M.ANG_MIN, A.a + d * (e.shiftKey ? 5 : 1))); if (a !== A.a) { A.a = a; save(); refocus(knob); } });

    /** A save can redraw the board around the panel; keep the keys on the thing being moved. */
    const refocus = (el) => { const f = () => { if (document.activeElement !== el) el.focus({ preventScroll: true }); }; f(); setTimeout(f, 0); requestAnimationFrame(f); };
    function tap(i) {
        const A = st();
        if (A.m !== "par") return;
        A.pk = "";
        if (A.hide && !A.rv.includes(i) && i !== 2) A.rv = A.rv.concat(i);
        if (A.sel.length === 1 && A.sel[0] !== i) A.sel = [A.sel[0], i];
        else A.sel = A.sel.length === 1 && A.sel[0] === i ? [] : [i];
        save();
    }
    /** A point r out from c at math angle d (degrees, anticlockwise from the right). */
    const at = (c, r, d) => [c[0] + r * Math.cos(rad(d)), c[1] - r * Math.sin(rad(d))];
    const sector = (c, r, d1, d2) => { const [x1, y1] = at(c, r, d1), [x2, y2] = at(c, r, d2); return "M" + c[0] + " " + c[1] + " L" + x1.toFixed(1) + " " + y1.toFixed(1) + " A" + r + " " + r + " 0 " + (d2 - d1 > 180 ? 1 : 0) + " 0 " + x2.toFixed(1) + " " + y2.toFixed(1) + " Z"; };
    const shown = (A, i) => !A.hide || i === 2 || A.rv.includes(i);
    const name = (i) => "∠" + i;

    function drawPar(A) {
        const a = A.a, t = A.np ? M.ANG_TILT : 0, cot = 1 / Math.tan(rad(a));
        const P1 = [CX + (MID - UP) * cot, UP], P2 = [CX - (LOW - MID) * cot, LOW];
        const far = W * 1.5;
        const ln = (el, c, d) => { const [x1, y1] = at(c, far, d + 180), [x2, y2] = at(c, far, d); el.setAttribute("x1", x1); el.setAttribute("y1", y1); el.setAttribute("x2", x2); el.setAttribute("y2", y2); };
        ln(upL, P1, 0); ln(lowL, P2, t); ln(trL, P1, a);
        clear(arrows);   // the little arrows that mark two lines as parallel
        if (!A.np) [P1, P2].forEach((c) => { const x = 40, y = c[1]; s("path", { d: "M" + (x - 5) + " " + (y - 5) + " L" + x + " " + y + " L" + (x - 5) + " " + (y + 5), class: "an-pmark" }, arrows); s("path", { d: "M" + (W - 40) + " " + (y - 5) + " L" + (W - 35) + " " + y + " L" + (W - 40) + " " + (y + 5), class: "an-pmark" }, arrows); });
        const v = M.angVals(A);
        // each angle's two rays, anticlockwise from the first: 1 TL, 2 TR, 3 BL, 4 BR, then 5–8 the same at the lower line
        const span = { 1: [P1, a, 180], 2: [P1, 0, a], 3: [P1, 180, 180 + a], 4: [P1, 180 + a, 360], 5: [P2, a, 180 + t], 6: [P2, t, a], 7: [P2, 180 + t, 180 + a], 8: [P2, 180 + a, 360 + t] };
        const col = {};
        if (A.pk) M.ANG_PAIRS[A.pk].pairs.slice(0, A.pk === "lin" ? 4 : 8).forEach(([x, y], n) => { col[x] = col[x] || PAIR_COLS[n % 4]; col[y] = col[y] || PAIR_COLS[n % 4]; });
        A.sel.forEach((i, n) => { col[i] = n ? "#F2B33D" : "#3F7FE0"; });
        for (let i = 1; i <= 8; i++) {
            const [c, d1, d2] = span[i], e = sect[i], mid = (d1 + d2) / 2, small = d2 - d1 < 50;
            e.hit.setAttribute("d", sector(c, 46, d1, d2));
            e.fill.setAttribute("d", sector(c, 24, d1, d2));
            const [vx, vy] = at(c, small ? 58 : 40, mid), [nx, ny] = at(c, small ? 34 : 14, mid);
            e.val.setAttribute("x", vx.toFixed(1)); e.val.setAttribute("y", (vy + 5).toFixed(1));
            e.num.setAttribute("x", nx.toFixed(1)); e.num.setAttribute("y", (ny + 4).toFixed(1));
            e.val.textContent = shown(A, i) ? v[i] + "°" : "?";
            e.num.style.display = small ? "none" : "";
            e.g.classList.toggle("lit", !!col[i]); e.g.classList.toggle("given", A.hide && i === 2);
            e.g.style.setProperty("--c", col[i] || "transparent");
            e.g.setAttribute("aria-label", name(i) + (shown(A, i) ? ", " + v[i] + " degrees" : ", hidden"));
        }
        const [kx, ky] = at(P1, 62, a);
        knob.setAttribute("transform", "translate(" + kx.toFixed(1) + " " + ky.toFixed(1) + ")");
        knob.setAttribute("aria-valuenow", a); knob.setAttribute("aria-valuetext", a + " degrees");
        svg.setAttribute("aria-label", (A.np ? "Two lines that are not parallel" : "Two parallel lines") + " cut by a transversal at " + a + " degrees");
    }

    function sayPar(A) {
        const v = M.angVals(A);
        if (A.sel.length === 2) {
            const [i, j] = A.sel, r = M.angPair(A, i, j), vi = shown(A, i) ? v[i] + "°" : "?", vj = shown(A, j) ? v[j] + "°" : "?";
            if (r.kind) {
                head.textContent = name(i) + " and " + name(j) + ": " + r.name.toLowerCase() + (r.kind === "vert" || r.kind === "lin" ? "" : " angles");
                sub.textContent = r.same ? (r.ok ? "They are equal: " + vi + " = " + vj + "." : "Not equal (" + vi + " and " + vj + "), because the lines are not parallel.")
                    : (r.ok ? "They add to 180°: " + vi + " + " + vj + " = 180°." : "They do not add to 180° (" + vi + " + " + vj + "), because the lines are not parallel.");
            } else {
                head.textContent = name(i) + " and " + name(j);
                sub.textContent = "Not a named pair, but " + (r.same ? "they are equal: " + vi + " = " + vj : r.a + r.b === 180 ? "they add to 180°: " + vi + " + " + vj + " = 180°" : "you can get from one to the other through another pair") + ".";
            }
            return;
        }
        if (A.sel.length === 1) { const i = A.sel[0]; head.textContent = name(i) + " = " + (shown(A, i) ? v[i] + "°" : "?"); sub.textContent = "Tap a second angle to name the pair."; return; }
        if (A.pk) {
            const P = M.ANG_PAIRS[A.pk];
            head.textContent = P.plural;
            sub.textContent = "They " + P.where + ". " + (P.same ? (A.np && !["vert"].includes(A.pk) ? "Only parallel lines make them equal, and these are not parallel." : "They are equal.") : (A.np && A.pk === "same" ? "Only parallel lines make them add to 180°, and these are not parallel." : "They add to 180°."));
            return;
        }
        if (A.hide) { head.textContent = "∠2 = " + v[2] + "°. Find the rest."; sub.textContent = "Tap an angle to check it."; return; }
        head.textContent = A.a + "° and " + (180 - A.a) + "°";
        sub.textContent = A.np ? "The lines are not parallel now, so the pairs stop matching." : "Drag the dot to turn the line. Tap two angles to name the pair.";
    }

    /* ---- triangle ---- */
    const tri = s("polygon", { class: "an-tpoly" }, triG);
    const arcs = [], wedges = [], corners = [];
    const base = s("g", { class: "an-base" }, triG);
    const Q = [CX, H - 16], WR = 40;
    s("line", { x1: CX - 120, y1: Q[1], x2: CX + 120, y2: Q[1], class: "an-bl" }, base);
    const baseLab = txt(base, CX, Q[1] - WR - 8, "180°", "an-blab", { "text-anchor": "middle" });
    for (let i = 0; i < 3; i++) {
        const a = s("g", { class: "an-tarc" }, triG); a.style.setProperty("--c", TRI_COLS[i]);
        arcs.push({ g: a, path: s("path", null, a), val: txt(a, 0, 0, "", "an-val", { "text-anchor": "middle" }) });
    }
    for (let i = 0; i < 3; i++) { const w = s("g", { class: "an-wedge" }, triG); w.style.setProperty("--c", TRI_COLS[i]); wedges.push({ g: w, path: s("path", null, w) }); }
    for (let i = 0; i < 3; i++) {
        const c = s("g", { class: "an-corner", tabindex: "0", role: "slider", "aria-label": "Corner " + "ABC"[i] + ". Drag it, or use the arrow keys" }, triG);
        s("circle", { r: 16, class: "an-khit" }, c); s("circle", { r: 7.5, class: "an-cdot" }, c); const lab = txt(c, 0, 0, "ABC"[i], "an-clab", { "text-anchor": "middle" });
        corners.push({ g: c, lab });
        let live = null;
        drag(p, c, {
            down: () => { live = st().t.map((q) => q.slice()); c.classList.add("drag"); },
            move: (e) => { const q = svgPt(svg, e), nt = live.map((x) => x.slice()); nt[i] = [Math.round(q.x / 5) * 5, Math.round(q.y / 5) * 5]; if (M.triOk(nt)) { live = nt; draw(Object.assign({}, st(), { t: live, torn: false })); } },
            up: (e, cancel) => { c.classList.remove("drag"); const A = st(); if (!cancel && JSON.stringify(live) !== JSON.stringify(A.t)) { A.t = live; A.torn = false; save(); } else draw(A); },
        });
        c.addEventListener("keydown", (e) => { const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key]; if (!d) return; e.preventDefault(); e.stopPropagation(); const A = st(), nt = A.t.map((x) => x.slice()); nt[i] = [nt[i][0] + d[0], nt[i][1] + d[1]]; if (M.triOk(nt)) { A.t = nt; A.torn = false; save(); refocus(c); } });
    }
    /** The math angle (anticlockwise from the right) from p toward q. */
    const dirOf = (p0, q) => { let d = Math.atan2(p0[1] - q[1], q[0] - p0[0]) * 180 / Math.PI; return d < 0 ? d + 360 : d; };
    function drawTri(A) {
        const t = A.t, ta = M.triAngles(t);
        tri.setAttribute("points", t.map((q) => q.join(",")).join(" "));
        const cen = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3];
        let run = 0;
        for (let i = 0; i < 3; i++) {
            const P0 = t[i], u = dirOf(P0, t[(i + 1) % 3]), w = dirOf(P0, t[(i + 2) % 3]);
            // the corner's angle, anticlockwise from its first side
            let d1 = u, sweep = (w - u + 360) % 360; if (sweep > 180) { d1 = w; sweep = 360 - sweep; }
            const r = 30;
            arcs[i].path.setAttribute("d", sector(P0, r, d1, d1 + sweep));
            const [vx, vy] = at(P0, sweep < 40 ? 58 : 46, d1 + sweep / 2);
            arcs[i].val.setAttribute("x", vx.toFixed(1)); arcs[i].val.setAttribute("y", (vy + 5).toFixed(1)); arcs[i].val.textContent = ta.deg[i] + "°";
            // the torn-off piece: drawn from 0° at the origin, then turned and moved into place
            wedges[i].path.setAttribute("d", sector([0, 0], WR, 0, sweep));
            const home = "translate(" + P0[0] + "px," + P0[1] + "px) rotate(" + (-d1) + "deg)";
            const away = "translate(" + Q[0] + "px," + Q[1] + "px) rotate(" + (-run) + "deg)";
            run += sweep;
            wedges[i].g.style.transform = A.torn ? away : home;
            wedges[i].g.classList.toggle("torn", A.torn);
            // the corner's dot and letter, pushed away from the middle
            const off = [P0[0] - cen[0], P0[1] - cen[1]], len = Math.hypot(...off) || 1;
            corners[i].g.setAttribute("transform", "translate(" + P0[0] + " " + P0[1] + ")");
            corners[i].lab.setAttribute("x", (off[0] / len * 17).toFixed(1)); corners[i].lab.setAttribute("y", (off[1] / len * 17 + 5).toFixed(1));
        }
        triG.classList.toggle("torn", A.torn);
        baseLab.style.opacity = A.torn ? "1" : "0"; base.classList.toggle("on", A.torn);
        clear(triFacts);
        ta.deg.forEach((d, i) => { const f = h("div", "an-tf"); f.style.setProperty("--c", TRI_COLS[i]); f.append(h("span", null, "∠" + "ABC"[i]), h("b", null, d + "°")); triFacts.appendChild(f); });
        head.textContent = ta.deg.join("° + ") + "° = 180°";
        sub.textContent = A.torn ? "The three corners fit together on a straight line, and a straight line is 180°." : "Drag a corner. The angles change, but they always add to 180°.";
        tearB.textContent = A.torn ? "Put the corners back" : "Tear off the corners";
        svg.setAttribute("aria-label", "A triangle with angles " + ta.deg.join(", ") + " degrees");
    }

    function draw(A) {
        const par = A.m === "par";
        parG.style.display = par ? "" : "none"; triG.style.display = par ? "none" : "";
        kinds.hidden = !par; opts.hidden = !par; tearB.hidden = par; triFacts.hidden = par;
        mPar.setAttribute("aria-pressed", String(par)); mTri.setAttribute("aria-pressed", String(!par));
        if (par) {
            drawPar(A); sayPar(A);
            M.ANG_KINDS.forEach((kk) => kindB[kk].setAttribute("aria-pressed", String(A.pk === kk)));
            tHide.setAttribute("aria-pressed", String(A.hide)); tNp.setAttribute("aria-pressed", String(A.np));
        } else drawTri(A);
    }
    p.sync = () => draw(st());
    return p;
}
