/* The volume shapes panel (Math tools, "vol"), for 8.G.9: cylinders, cones and spheres.
   A shape drawn to scale with its radius and height. Find the volume, or work back to the height (cylinder, cone) or
   the radius (sphere), in terms of π or with 3.14. The steps are revealed one at a time; the base lights up when it is
   found. Compare puts the matching cylinder beside a cone or a sphere, filled to 1/3 or 2/3, to show where the
   formulas come from.
   The model is in js/manipCore.js (volDefault, volOf, volQ, volA, volSteps, volNew, volSet, volShape, volAsk, volN,
   piText, VL_SH, VL_UNITS); the state is S.tools.mt.vol. */

const W = 400, H = 292;
const HINT = { base: "Start with the base. It's a circle.", cube: "Start by cubing the radius.", undo: "Undo the 4/3 π first." };

/** ctx: { shell, h, btn, st, save, s, txt, svgPt, drag, clear, grid, stepper, M } from js/manipPanels.js */
export function makeVol(k, ctx) {
    const { h, btn, s, txt, clear, M } = ctx;
    const st = () => ctx.st(k), save = ctx.save;
    const p = ctx.shell(k);
    const q = h("div", "mt-eq vl-q");
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "mt-svg vl-svg", role: "img" });
    const fact = h("p", "vl-fact");

    /* ---- the side ---- */
    const act = (fn) => () => { if (fn(st())) { p.say(""); save(); } };
    const shapes = h("div", "mt-row"), shB = {};
    [["cyl", "Cylinder"], ["cone", "Cone"], ["sph", "Sphere"]].forEach(([sh, lab]) => { shB[sh] = btn(lab, "mt-chip", act((V) => M.volShape(V, sh)), lab); shapes.appendChild(shB[sh]); });
    const asks = h("div", "mt-row vl-asks"), askB = {};
    [["v", "Find the volume"], ["h", "Find the height"], ["r", "Find the radius"]].forEach(([a, lab]) => { askB[a] = btn(lab, "mt-chip", act((V) => M.volAsk(V, a)), lab); asks.appendChild(askB[a]); });
    const opts = h("div", "mt-row");
    const bPi = btn("In terms of π", "mt-chip", act((V) => { if (V.pi === "pi") return false; V.pi = "pi"; V.s = 0; return true; }), "Answers in terms of π");
    const bDec = btn("Use 3.14", "mt-chip", act((V) => { if (V.pi === "dec") return false; V.pi = "dec"; V.s = 0; return true; }), "Use 3.14 for π");
    const bCmp = btn("Compare", "mt-chip", act((V) => { V.cmp = !V.cmp; return true; }), "Compare with a cylinder");
    opts.append(bPi, bDec, bCmp);
    const steps = h("div", "tp-steps"), list = h("ol", "tp-ol"), ans = h("p", "tp-ans");
    const bNext = btn("Next step", "mt-go", () => { const V = st(); if (V.s < M.volN(V)) { V.s++; save(); } }, "Show the next step");
    const bAll = btn("Show the answer", "", () => { const V = st(), n = M.volN(V); if (V.s < n) { V.s = n; save(); } }, "Show every step and the answer");
    const sRow = h("div", "mt-row"); sRow.append(bNext, bAll);
    steps.append(list, ans, sRow);
    const nums = h("div", "mt-row tp-nums");
    const tw = (key) => (n) => { const V = st(); if (M.volSet(V, key, n - V[key])) { p.say(""); save(); } };
    const stR = ctx.stepper("Radius", () => st().r, tw("r"), 1, 12), stH = ctx.stepper("Height", () => st().h, tw("h"), 1, 20);
    nums.append(stR, stH);
    const tools = h("div", "mt-row");
    tools.append(btn("New problem", "", () => { M.volNew(st()); p.say(""); save(); }, "A new problem with this shape"),
        btn("Start over", "", () => { const V = st(), keep = { sh: V.sh, pi: V.pi }; Object.assign(V, M.volDefault(), keep); if (keep.sh === "sph") V.ask = "v"; p.say(""); save(); }, "Back to the first problem"));
    p.main.append(q, svg, fact); p.side.append(shapes, asks, opts, steps, nums, tools, p.note);

    /* ---- drawing helpers ---- */
    const pill = (g, x, y, t, cls) => {
        const w = String(t).length * 7.4 + 16;
        s("rect", { x: x - w / 2, y: y - 13, width: w, height: 20, rx: 10, class: "tp-pill " + cls }, g); txt(g, x, y + 2, String(t), "tp-pt", { "text-anchor": "middle" });
    };
    /* A label that may be the unknown: amber "?" until solved, green once it is. */
    const label = (g, x, y, name, value, unknown, done, anchor) => {
        if (!unknown) { txt(g, x, y, name + " = " + value, "vl-lab", { "text-anchor": anchor || "middle" }); return; }
        const t = name + " = " + (done ? value : "?"), w = t.length * 7.4 + 16, cx = anchor === "start" ? x + w / 2 : x;
        pill(g, cx, y - 4, t, done ? "ok" : "q");
    };
    const ell = (g, cx, cy, rx, ry, cls) => s("ellipse", { cx, cy, rx, ry, class: cls }, g);
    const arc = (x0, x1, y, rx, ry, sweep) => "A" + rx + " " + ry + " 0 0 " + sweep + " " + x1 + " " + y;

    /** One shape. Returns its top for the label above it. */
    function shape(g, sh, cx, bot, rx, ry, hp, o) {
        if (sh === "sph") {
            const cy = bot - rx;
            s("circle", { cx, cy, r: rx, class: "vl-ball" }, g);
            s("path", { d: "M" + (cx - rx) + " " + cy + arc(cx - rx, cx + rx, cy, rx, ry, 1), class: "vl-hid" }, g);
            s("path", { d: "M" + (cx - rx) + " " + cy + arc(cx - rx, cx + rx, cy, rx, ry, 0), class: "vl-eq" }, g);
            s("circle", { cx, cy, r: rx, class: "vl-edge" }, g);
            s("line", { x1: cx, y1: cy, x2: cx + rx, y2: cy, class: "vl-r" + (o.hlR ? " on" : "") }, g);
            s("circle", { cx, cy, r: 3, class: "vl-dot" }, g);
            return cy - rx;
        }
        const top = bot - hp, L = cx - rx, R = cx + rx;
        if (sh === "cyl") {
            s("path", { d: "M" + L + " " + top + " V" + bot + arc(L, R, bot, rx, ry, 0) + " V" + top + " Z", class: "vl-body" }, g);
            s("path", { d: "M" + L + " " + bot + arc(L, R, bot, rx, ry, 1), class: "vl-hid" }, g);
            if (o.hlB) ell(g, cx, bot, rx, ry, "vl-base");
            s("path", { d: "M" + L + " " + top + " V" + bot + arc(L, R, bot, rx, ry, 0) + " V" + top, class: "vl-edge" }, g);
            ell(g, cx, top, rx, ry, "vl-top");
        } else {
            s("path", { d: "M" + cx + " " + top + " L" + R + " " + bot + arc(R, L, bot, rx, ry, 1) + " Z", class: "vl-body" }, g);
            s("path", { d: "M" + L + " " + bot + arc(L, R, bot, rx, ry, 1), class: "vl-hid" }, g);
            if (o.hlB) ell(g, cx, bot, rx, ry, "vl-base");
            s("path", { d: "M" + L + " " + bot + " L" + cx + " " + top + " L" + R + " " + bot + arc(R, L, bot, rx, ry, 1), class: "vl-edge" }, g);
            s("line", { x1: cx, y1: bot, x2: cx, y2: top, class: "vl-hid" }, g);
        }
        s("line", { x1: cx, y1: bot, x2: R, y2: bot, class: "vl-r" }, g);
        s("circle", { cx, cy: bot, r: 3, class: "vl-dot" }, g);
        return top;
    }
    /** The cylinder a cone or sphere is compared with, filled to f of its height. */
    function ghost(g, cx, bot, rx, ry, hp, f) {
        const top = bot - hp, wt = bot - hp * f, L = cx - rx, R = cx + rx;
        s("path", { d: "M" + L + " " + wt + " V" + bot + arc(L, R, bot, rx, ry, 0) + " V" + wt + " Z", class: "vl-water" }, g);
        ell(g, cx, wt, rx, ry, "vl-surf");
        s("path", { d: "M" + L + " " + bot + arc(L, R, bot, rx, ry, 1), class: "vl-hid" }, g);
        s("path", { d: "M" + L + " " + top + " V" + bot + arc(L, R, bot, rx, ry, 0) + " V" + top, class: "vl-ghost" }, g);
        ell(g, cx, top, rx, ry, "vl-ghost");
        /* thirds marked up the side */
        for (let i = 1; i < 3; i++) { const y = bot - (hp * i) / 3; s("line", { x1: R - 6, y1: y, x2: R + 6, y2: y, class: "vl-tick" }, g); }
        return top;
    }

    function draw(V) {
        clear(svg);
        const v = M.volOf(V), n = M.volN(V), done = V.s >= n, u = M.VL_UNITS[V.u], sph = V.sh === "sph";
        const cmp = V.cmp && V.sh !== "cyl";
        const g = s("g", null, svg);
        /* to scale: the shape's (and the compare cylinder's) height and width fit the room */
        const tall = v.h, wide = 2 * v.r, roomW = cmp ? 150 : 200, roomH = cmp ? 172 : 178;
        const kk = Math.min(roomW / wide, roomH / tall, 30), rx = v.r * kk, ry = Math.max(5, rx * 0.28), hp = tall * kk;
        const bot = 236, cx = cmp ? 112 : 168, Wv = cmp ? 470 : W;
        svg.setAttribute("viewBox", "0 0 " + Wv + " " + H);
        const hlB = !sph && V.s >= 1, hlR = sph && V.ask === "v" && V.s >= 1;
        const top = shape(g, V.sh, cx, bot, rx, ry, hp, { hlB, hlR });
        /* the radius */
        if (sph) label(g, cx + rx / 2, bot - rx - 9, "r", v.r + " " + u, V.ask === "r", done);
        else label(g, cx + rx / 2, bot + ry + 22, "r", v.r + " " + u, false, done);
        /* the height, on a dimension line to the right */
        if (!sph) {
            const x = cx + rx + 16;
            s("path", { d: "M" + (x - 5) + " " + top + " H" + (x + 5) + " M" + x + " " + top + " V" + bot + " M" + (x - 5) + " " + bot + " H" + (x + 5), class: "vl-dim" }, g);
            label(g, x + 8, (top + bot) / 2 + 5, "h", v.h + " " + u, V.ask === "h", done, "start");
        }
        /* the volume, above */
        const vt = M.volText(V) + " " + u + "³";
        label(g, cx, top - (sph ? 26 : ry + 14), "V", vt, V.ask === "v", done);
        if (hlB && V.s >= 1) txt(g, cx - rx - 8, bot + 4, "B", "vl-bl", { "text-anchor": "end" });
        /* compare: the cylinder that goes with it */
        if (cmp) {
            const c2 = 370, f = sph ? 2 / 3 : 1 / 3, gt = ghost(g, c2, bot, rx, ry, hp, f);
            txt(g, c2, bot + ry + 22, sph ? "2/3 full" : "1/3 full", "vl-lab ok", { "text-anchor": "middle" });
            txt(g, c2, gt - ry - 10, sph ? "Cylinder: same r, h = 2r" : "Cylinder: same r and h", "vl-small", { "text-anchor": "middle" });
            const x0 = cx + rx * 0.5, y0 = top - (sph ? 34 : ry + 30), x1 = c2 - rx * 0.55, y1 = gt - ry - 30;
            const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 26;
            s("path", { d: "M" + x0 + " " + y0 + " Q" + mx + " " + my + " " + x1 + " " + y1, class: "vl-pour" }, g);
            s("path", { d: "M" + (x1 - 7) + " " + (y1 - 6) + " L" + x1 + " " + y1 + " L" + (x1 + 1) + " " + (y1 - 9), class: "vl-pour" }, g);
            txt(g, mx, my + 8, "pour", "vl-small", { "text-anchor": "middle" });
        }
        svg.setAttribute("aria-label", M.volQ(V));

        q.textContent = M.volQ(V);
        fact.textContent = !V.cmp ? "" : V.sh === "cone" ? "Three cones of water fill the cylinder, so a cone is 1/3 of it: V = 1/3 πr²h." : sph ? "A sphere fills 2/3 of the cylinder that just fits around it: 2/3 × πr² × 2r = 4/3 πr³." : "";
        fact.hidden = !fact.textContent;
        Object.entries(shB).forEach(([sh, b]) => b.setAttribute("aria-pressed", String(sh === V.sh)));
        askB.h.hidden = sph; askB.r.hidden = !sph;
        Object.entries(askB).forEach(([a, b]) => b.setAttribute("aria-pressed", String(a === V.ask)));
        bPi.setAttribute("aria-pressed", String(V.pi === "pi")); bDec.setAttribute("aria-pressed", String(V.pi === "dec"));
        bCmp.hidden = V.sh === "cyl"; bCmp.setAttribute("aria-pressed", String(V.cmp));
        stH.hidden = sph; stR.refresh(); stH.refresh();
        /* the number being solved for stays hidden until the answer is shown */
        if (!done && V.ask !== "v") (V.ask === "h" ? stH : stR).querySelector(".mt-sv").textContent = "?";
        const all = M.volSteps(V);
        clear(list); all.slice(0, V.s).forEach((t) => list.appendChild(h("li", null, t)));
        list.hidden = !V.s;
        ans.textContent = done ? "Answer: " + M.volA(V) : V.s ? "" : HINT[sph ? (V.ask === "v" ? "cube" : "undo") : "base"];
        ans.classList.toggle("ok", done);
        bNext.hidden = bAll.hidden = done;
        bNext.textContent = V.s ? "Next step" : sph ? (V.ask === "v" ? "Cube the radius" : "Find r³") : "Find the base";
    }
    p.sync = () => draw(st());
    return p;
}
