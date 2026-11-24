/* ==========================================
   Anchor Board — StepPlayer (js/stepPlayer.js). One player for every walkthrough from js/walk.js.
   It writes the work on a whiteboard one line at a time and animates each move: arrows for distributing, like terms
   highlighted and sliding together, the same thing done to both sides with the cancelled pieces struck through in red,
   a fraction flipping over for keep-change-flip, the inequality sign turning when you divide by a negative,
   hops on a number line, triangle angles sliding onto a straight line, numbers moving from a story into the equation.

   createStepPlayer(host, walk, opts) → { go(i, animate), next(), back(), play(), pause(), replay(), index, count, destroy() }
     opts.controls (default true) · opts.big (projected board) · opts.onStep(i, step) · opts.autoplay
     opts.look: "hand" (default) writes the work in marker handwriting, one piece at a time with a pen tip, and draws
     each cancel as a red slash and the answer box in green, the way a teacher writes it; "print" is the older typed look.
   Calm on purpose: one move at a time, no sound, no confetti, and no motion at all when the device asks for reduced motion.
========================================== */
const NS = "http://www.w3.org/2000/svg";
const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const sv = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a || {}) n.setAttribute(k, a[k]); return n; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MINUS = "−";
const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
    replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>'
};

/* ---------- writing a dt ---------- */
function draw(d) {
    if (d == null) return document.createTextNode("");
    if (typeof d === "string") return document.createTextNode(d.replace(/^ +| +$/g, (m) => "\u00a0".repeat(m.length)));
    let n;
    if (d.f) {
        n = el("span", "w-f");
        const t = el("span", "w-t"), b = el("span", "w-b");
        t.appendChild(draw(d.f[0])); b.appendChild(draw(d.f[1])); n.append(t, b);
    } else if (d.sup) { n = el("sup", "w-sup"); n.appendChild(draw(d.sup)); }
    else { n = el("span", "w-r"); (d.r || []).forEach((x) => n.appendChild(draw(x))); }
    if (d.c) n.classList.add(d.c);
    if (d.k) {
        const w = d.f || d.sup ? (() => { const s = el("span", "w-k"); s.appendChild(n); return s; })() : n;
        w.classList.add("w-k"); w.dataset.k = d.k;
        if (d.u) w.appendChild(el("span", "w-u", d.u));
        return w;
    }
    return n;
}

/* ---------- pictures ---------- */
const PEN = { ink: "#14213D", blue: "#1552D6", red: "#C62828", green: "#1B7F3B", amber: "#F2B33D", sky: "#7FAEDD", grid: "#DCE7F5", board: "#FBFCFE" };
function arrowHead(svg, id, color) {
    const defs = sv("defs"), m = sv("marker", { id, viewBox: "0 0 10 10", refX: "7", refY: "5", markerWidth: "5", markerHeight: "5", orient: "auto-start-reverse" });
    m.appendChild(sv("path", { d: "M0 0L10 5L0 10z", fill: color })); defs.appendChild(m); svg.appendChild(defs);
}
let uid = 0;
const pics = {
    numline(p) {
        const a = p.start, b = p.start + p.move, lo = Math.min(a, b) - 2, hi = Math.max(a, b) + 2, n = hi - lo;
        const W = 640, H = 150, pad = 30, X = (v) => pad + ((v - lo) / n) * (W - 2 * pad), y = 100;
        const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "sp-pic", width: W, role: "img", "aria-label": `Number line: start at ${a}, move ${Math.abs(p.move)} ${p.move < 0 ? "left" : "right"}, land on ${b}` });
        const id = "ah" + ++uid; arrowHead(svg, id, PEN.blue);
        svg.appendChild(sv("line", { x1: pad - 14, y1: y, x2: W - pad + 14, y2: y, stroke: PEN.ink, "stroke-width": 3, "marker-start": "", "stroke-linecap": "round" }));
        const every = n > 26 ? 5 : n > 14 ? 2 : 1;
        for (let v = lo; v <= hi; v++) {
            svg.appendChild(sv("line", { x1: X(v), y1: y - 8, x2: X(v), y2: y + 8, stroke: PEN.ink, "stroke-width": v === 0 ? 3 : 1.6 }));
            if (v % every === 0 || v === a || v === b) { const t = sv("text", { x: X(v), y: y + 32, "text-anchor": "middle", "font-size": 19, "font-weight": v === a || v === b ? 700 : 400 }); t.textContent = v < 0 ? MINUS + Math.abs(v) : String(v); svg.appendChild(t); }
        }
        const mid = (X(a) + X(b)) / 2, rise = Math.min(70, 26 + Math.abs(X(b) - X(a)) * 0.22);
        const arc = sv("path", { d: `M${X(a)} ${y - 10} Q${mid} ${y - 10 - rise * 2} ${X(b)} ${y - 10}`, stroke: PEN.blue, "stroke-width": 4, fill: "none", "marker-end": `url(#${id})`, "stroke-linecap": "round", class: "pa" });
        const lab = sv("text", { x: mid, y: y - 18 - rise, "text-anchor": "middle", "font-size": 22, "font-weight": 700, fill: PEN.blue, class: "pl" }); lab.textContent = (p.move < 0 ? MINUS : "+") + Math.abs(p.move);
        const d0 = sv("circle", { cx: X(a), cy: y, r: 9, fill: PEN.ink, class: "p0" }), d1 = sv("circle", { cx: X(b), cy: y, r: 11, fill: PEN.amber, stroke: PEN.ink, "stroke-width": 2.5, class: "p1" });
        svg.append(arc, lab, d0, d1);
        return { node: svg, async play(fast) {
            if (fast) return;
            [arc, lab, d1].forEach((x) => (x.style.opacity = 0)); d0.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], { duration: 260, easing: "ease-out" });
            d0.style.transformOrigin = `${X(a)}px ${y}px`; d0.style.transformBox = "view-box";
            await wait(350);
            const L = arc.getTotalLength ? arc.getTotalLength() : 400;
            arc.style.opacity = 1; arc.style.strokeDasharray = L; arc.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 300 + Math.abs(p.move) * 70, easing: "ease-in-out", fill: "forwards" });
            await wait(300 + Math.abs(p.move) * 70);
            lab.style.opacity = 1; d1.style.opacity = 1; d1.style.transformBox = "fill-box"; d1.style.transformOrigin = "center";
            d1.animate([{ transform: "scale(0.2)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 320 });
            await wait(320);
        } };
    },
    ineq(p) {
        const W = 640, H = 120, pad = 34, y = 60, u = p.unit || 1;
        const c = p.at != null ? p.at : (p.lo + p.hi) / 2;
        const span = p.at != null ? 5 : Math.max(5, Math.ceil((p.hi - p.lo) / 2 / u) + 3);
        const lo = (Math.floor(c / u) - span) * u, hi = (Math.ceil(c / u) + span) * u, n = Math.round((hi - lo) / u), X = (v) => pad + ((v - lo) / (hi - lo)) * (W - 2 * pad);
        const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "sp-pic", width: W, role: "img", "aria-label": "Graph of the answer on a number line" });
        const id = "ah" + ++uid; arrowHead(svg, id, PEN.ink); const id2 = "ah" + ++uid; arrowHead(svg, id2, PEN.blue);
        svg.appendChild(sv("line", { x1: pad - 20, y1: y, x2: W - pad + 20, y2: y, stroke: PEN.ink, "stroke-width": 3, "marker-start": `url(#${id})`, "marker-end": `url(#${id})` }));
        const every = n > 16 || (u < 1 && n > 8) ? 2 : 1;
        const labeled = (v) => { const i = Math.round(v / u); return Math.abs(i * u - v) < 1e-9 && i % every === 0; };
        for (let i = 0; i <= n; i++) {
            const v = +(lo + i * u).toFixed(6);
            svg.appendChild(sv("line", { x1: X(v), y1: y - 8, x2: X(v), y2: y + 8, stroke: PEN.ink, "stroke-width": 1.6 }));
            if (labeled(v)) { const t = sv("text", { x: X(v), y: y + 32, "text-anchor": "middle", "font-size": 18 }); t.textContent = v < 0 ? MINUS + Math.abs(v) : String(v); svg.appendChild(t); }
        }
        const dots = [], rays = [];
        const dot = (v, closed, label) => {
            const g = sv("g");
            g.appendChild(sv("circle", { cx: X(v), cy: y, r: 11, fill: closed ? PEN.blue : PEN.board, stroke: PEN.blue, "stroke-width": 4 }));
            if (u === 1 ? !Number.isInteger(v) : !labeled(v)) { const t = sv("text", { x: X(v), y: y - 22, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: PEN.blue }); t.textContent = label; g.appendChild(t); }
            dots.push(g); return g;
        };
        const rayTo = (from, dir) => { const ray = sv("line", { x1: X(from) + dir * 12, y1: y, x2: dir > 0 ? W - pad + 8 : pad - 8, y2: y, stroke: PEN.blue, "stroke-width": 7, "stroke-linecap": "round", "marker-end": `url(#${id2})` }); rays.push(ray); svg.appendChild(ray); };
        if (p.at != null) {
            rayTo(p.at, p.dir); svg.appendChild(dot(p.at, p.closed, p.atT));
        } else if (p.out) {
            rayTo(p.lo, -1); rayTo(p.hi, 1); svg.appendChild(dot(p.lo, p.cl, p.loT)); svg.appendChild(dot(p.hi, p.ch, p.hiT));
        } else {
            const ray = sv("line", { x1: X(p.lo) + 12, y1: y, x2: X(p.hi) - 12, y2: y, stroke: PEN.blue, "stroke-width": 7, "stroke-linecap": "round" });
            rays.push(ray); svg.appendChild(ray); svg.appendChild(dot(p.lo, p.cl, p.loT)); svg.appendChild(dot(p.hi, p.ch, p.hiT));
        }
        return { node: svg, async play(fast) {
            if (fast) return;
            rays.forEach((r) => (r.style.opacity = 0));
            for (const d of dots) { d.style.transformBox = "fill-box"; d.style.transformOrigin = "center"; d.animate([{ transform: "scale(0)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }], { duration: 320 }); await wait(260); }
            await wait(200);
            rays.forEach((r) => { r.style.opacity = 1; const L = Math.hypot(r.x2.baseVal.value - r.x1.baseVal.value, 0); r.style.strokeDasharray = L + 40; r.animate([{ strokeDashoffset: L + 40 }, { strokeDashoffset: 0 }], { duration: 650, easing: "ease-out", fill: "forwards" }); });
            await wait(650);
        } };
    },
    triangle(p) {
        // the three angles, drawn to size once x is known; then torn off and set side by side on a straight line
        const ang = p.solved && p.solved.length === 3 && p.solved.every((v) => v > 0) ? p.solved : [60, 60, 60];
        const W = 640, H = 330, A = ang[0] * Math.PI / 180, B = ang[1] * Math.PI / 180;
        const base = 300, P0 = [0, 0], P1 = [base, 0];
        const t = Math.sin(B) / Math.sin(A + B) * base, P2 = [t * Math.cos(A), t * Math.sin(A)];   // y up
        const xs = [P0[0], P1[0], P2[0]], minx = Math.min(...xs), maxx = Math.max(...xs), hgt = P2[1];
        const sc = Math.min(1.25, 380 / (maxx - minx), 200 / Math.max(hgt, 1));
        const ox = 40 - minx * sc, oy = 220;
        const S = (pt) => [ox + pt[0] * sc, oy - pt[1] * sc];
        const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "sp-pic", width: W, role: "img", "aria-label": "Triangle with angles " + p.labels.join(", ") + ". The three angles fit together on a straight line, 180 degrees." });
        const V = [P0, P1, P2].map(S);
        const tri = sv("path", { d: `M${V[0]}L${V[1]}L${V[2]}Z`, fill: "none", stroke: PEN.ink, "stroke-width": 3.5, "stroke-linejoin": "round" });
        svg.appendChild(tri);
        const dir = (from, to) => { const d = Math.atan2(-(to[1] - from[1]), to[0] - from[0]) * 180 / Math.PI; return (d + 360) % 360; };
        const fills = ["rgba(242,179,61,.75)", "rgba(127,174,221,.8)", "rgba(27,127,59,.45)"];
        const r = 52, wedges = [], labels = [];
        const sector = (deg) => { const a = deg * Math.PI / 180; return `M0 0L${r} 0A${r} ${r} 0 ${deg > 180 ? 1 : 0} 0 ${r * Math.cos(a)} ${-r * Math.sin(a)}Z`; };
        const starts = V.map((v, i) => {
            const o1 = V[(i + 1) % 3], o2 = V[(i + 2) % 3], d1 = dir(v, o1), d2 = dir(v, o2);
            return Math.abs(((d2 - d1 + 360) % 360) - ang[i]) < 1 ? d1 : d2;
        });
        const lineY = 300, Q = [W - 170, lineY];
        let cum = 0; const targets = ang.map((a) => { const s = cum; cum += a; return s; });
        V.forEach((v, i) => {
            const mk = sv("path", { d: sector(ang[i]).replace(/^M0 0L[^A]*/, "M" + (r * 0.55) + " 0").replace(/A[\d.]+ [\d.]+/, "A" + r * 0.55 + " " + r * 0.55).replace(/ ([-\d.]+) ([-\d.]+)Z$/, (m0, a, b) => " " + a * 0.55 + " " + b * 0.55), fill: "none", stroke: fills[i].replace(/[\d.]+\)$/, "1)"), "stroke-width": 4 });
            mk.style.transform = `translate(${v[0]}px,${v[1]}px) rotate(${-starts[i]}deg)`; svg.appendChild(mk);
            const g = sv("g"); g.appendChild(sv("path", { d: sector(ang[i]), fill: fills[i], stroke: PEN.ink, "stroke-width": 1.5 }));
            g.style.transform = `translate(${v[0]}px,${v[1]}px) rotate(${-starts[i]}deg)`;
            wedges.push({ g, from: `translate(${v[0]}px,${v[1]}px) rotate(${-starts[i]}deg)`, to: `translate(${Q[0]}px,${Q[1]}px) rotate(${-targets[i]}deg)` });
            svg.appendChild(g);
            const mid = (starts[i] + ang[i] / 2) * Math.PI / 180, lr = r + 30;
            const lab = sv("text", { x: v[0] + lr * Math.cos(mid), y: v[1] - lr * Math.sin(mid) + 7, "text-anchor": "middle", "font-size": 21, "font-weight": 700 }); lab.textContent = p.labels[i];
            const mid2 = (targets[i] + ang[i] / 2) * Math.PI / 180, lr2 = r + 30;
            labels.push({ lab, to: [Q[0] + lr2 * Math.cos(mid2), Q[1] - lr2 * Math.sin(mid2) + 7] });
            svg.appendChild(lab);
        });
        const line = sv("line", { x1: Q[0] - 120, y1: lineY, x2: Q[0] + 120, y2: lineY, stroke: PEN.ink, "stroke-width": 3.5, "stroke-linecap": "round" });
        const sum = sv("text", { x: Q[0], y: lineY + 24, "text-anchor": "middle", "font-size": 22, "font-weight": 700, fill: PEN.blue }); sum.textContent = "180°";
        svg.append(line, sum);
        const place = (end) => { wedges.forEach((w) => (w.g.style.transform = end ? w.to : w.from)); labels.forEach((l, i) => { const v = V[i], mid = (starts[i] + ang[i] / 2) * Math.PI / 180; const xy = end ? l.to : [v[0] + (r + 30) * Math.cos(mid), v[1] - (r + 30) * Math.sin(mid) + 7]; l.lab.setAttribute("x", xy[0]); l.lab.setAttribute("y", xy[1]); }); };
        place(true); // the finished picture shows the straight line
        return { node: svg, async play(fast) {
            if (fast) return;
            place(false); line.style.opacity = 0; sum.style.opacity = 0;
            const L = tri.getTotalLength ? tri.getTotalLength() : 900;
            tri.style.strokeDasharray = L; tri.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, easing: "ease-in-out", fill: "forwards" });
            wedges.forEach((w) => w.g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 500, fill: "backwards" }));
            await wait(1300);
            line.style.opacity = 1; line.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
            labels.forEach((l) => l.lab.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }));
            for (let i = 0; i < 3; i++) {
                const w = wedges[i];
                const an = w.g.animate([{ transform: w.from }, { transform: w.to }], { duration: 900, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" });
                await wait(i < 2 ? 260 : 0);
                if (i === 2) await an.finished.catch(() => {});
            }
            await wait(150);
            wedges.forEach((w) => { w.g.getAnimations().forEach((a) => a.cancel()); w.g.style.transform = w.to; });
            place(true);
            labels.forEach((l) => { l.lab.getAnimations().forEach((a) => a.cancel()); l.lab.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); });
            sum.style.opacity = 1; sum.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 320 });
            await wait(400);
        } };
    },
    wedges(p) {
        const total = p.total, n = p.labels.length;
        const vals = p.solved && p.solved.length === n && Math.abs(p.solved.reduce((a, b) => a + b, 0) - total) < 1e-6 ? p.solved : p.labels.map(() => total / n);
        const W = 520, H = total === 180 ? 230 : 280, O = total === 180 ? [W / 2, 190] : [170, 240], R = total === 180 ? 170 : 210, r = 60;
        const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "sp-pic", width: W, role: "img", "aria-label": (total === 180 ? "Angles on a straight line: " : "Angles in a right angle: ") + p.labels.join(", ") });
        const fills = ["rgba(242,179,61,.7)", "rgba(127,174,221,.8)", "rgba(27,127,59,.4)"];
        const pt = (deg, rad) => [O[0] + rad * Math.cos(deg * Math.PI / 180), O[1] - rad * Math.sin(deg * Math.PI / 180)];
        const parts = []; let cum = 0;
        vals.forEach((v, i) => {
            const a0 = cum, a1 = cum + v; cum = a1;
            const p0 = pt(a0, r), p1 = pt(a1, r);
            const wedge = sv("path", { d: `M${O}L${p0}A${r} ${r} 0 0 0 ${p1}Z`, fill: fills[i % 3], stroke: "none" });
            const mid = pt((a0 + a1) / 2, r + 34), lab = sv("text", { x: mid[0], y: mid[1] + 7, "text-anchor": "middle", "font-size": 20, "font-weight": 700 }); lab.textContent = p.labels[i];
            parts.push(wedge, lab); svg.append(wedge, lab);
        });
        const rays = [];
        if (total === 180) rays.push(sv("line", { x1: O[0] - R, y1: O[1], x2: O[0] + R, y2: O[1], stroke: PEN.ink, "stroke-width": 3.5, "stroke-linecap": "round" }));
        else { rays.push(sv("line", { x1: O[0], y1: O[1], x2: O[0] + R, y2: O[1], stroke: PEN.ink, "stroke-width": 3.5, "stroke-linecap": "round" }), sv("line", { x1: O[0], y1: O[1], x2: O[0], y2: O[1] - R, stroke: PEN.ink, "stroke-width": 3.5, "stroke-linecap": "round" })); svg.appendChild(sv("path", { d: `M${O[0] + 18} ${O[1]}v-18h-18`, fill: "none", stroke: PEN.ink, "stroke-width": 2 })); }
        let c2 = 0; vals.slice(0, -1).forEach((v) => { c2 += v; const e = pt(c2, R); rays.push(sv("line", { x1: O[0], y1: O[1], x2: e[0], y2: e[1], stroke: PEN.ink, "stroke-width": 3.5, "stroke-linecap": "round" })); });
        rays.forEach((x) => svg.appendChild(x));
        const tl = sv("text", { x: total === 180 ? O[0] : O[0] + R - 10, y: total === 180 ? O[1] + 30 : O[1] + 30, "text-anchor": "middle", "font-size": 20, "font-weight": 700, fill: PEN.blue }); tl.textContent = total + "° in all";
        svg.appendChild(tl);
        return { node: svg, async play(fast) {
            if (fast) return;
            parts.concat([tl]).forEach((x) => (x.style.opacity = 0));
            for (const ray of rays) { const L = Math.hypot(ray.x2.baseVal.value - ray.x1.baseVal.value, ray.y2.baseVal.value - ray.y1.baseVal.value); ray.style.strokeDasharray = L; ray.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 380, easing: "ease-out", fill: "forwards" }); await wait(260); }
            for (const x of parts) { x.style.opacity = 1; x.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 }); await wait(140); }
            tl.style.opacity = 1; tl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
            await wait(300);
        } };
    },
    lines(p) {
        // two parallel lines cut by a transversal (or two crossing lines), with the two angles in the problem marked
        const W = 560, H = 300, cross = p.pair === "vertical" || p.pair === "linear";
        const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "sp-pic", width: W, role: "img", "aria-label": (cross ? "Two crossing lines" : "Two parallel lines cut by a transversal") + " with angles " + p.labels.join(" and ") });
        const ys = cross ? [150] : [95, 215], t0 = [190, 20], t1 = [370, 285];
        const atY = (y) => t0[0] + (t1[0] - t0[0]) * (y - t0[1]) / (t1[1] - t0[1]);
        const parts = [];
        ys.forEach((y) => { const l = sv("line", { x1: 40, y1: y, x2: W - 40, y2: y, stroke: PEN.ink, "stroke-width": 3.5, "stroke-linecap": "round" }); parts.push(l); svg.appendChild(l); if (!cross) { const a = sv("path", { d: `M${W - 70} ${y - 8}l10 8l-10 8`, fill: "none", stroke: PEN.ink, "stroke-width": 2.5 }); parts.push(a); svg.appendChild(a); } });
        const tr = sv("line", { x1: t0[0], y1: t0[1], x2: t1[0], y2: t1[1], stroke: PEN.ink, "stroke-width": 3.5, "stroke-linecap": "round" }); parts.push(tr); svg.appendChild(tr);
        const td = Math.atan2(-(t1[1] - t0[1]), t1[0] - t0[0]) * 180 / Math.PI;   // transversal heading down-right, about −56°
        const up = (td + 180 + 360) % 360, down = (td + 360) % 360;   // directions along the transversal
        // corners at an intersection, as [start, end] angles (counterclockwise): ul, ur, ll, lr
        const corner = { ur: [0, up], ul: [up, 180], ll: [180, down], lr: [down, 360] };
        const POS = { corresponding: [["T", "ur"], ["B", "ur"]], "alternate-interior": [["T", "lr"], ["B", "ul"]], "alternate-exterior": [["T", "ul"], ["B", "lr"]], "same-side": [["T", "lr"], ["B", "ur"]], vertical: [["T", "ul"], ["T", "lr"]], linear: [["T", "ul"], ["T", "ur"]] };
        const marks = [];
        (POS[p.pair] || POS.corresponding).forEach(([which, cnr], i) => {
            const y = which === "T" ? ys[0] : ys[ys.length - 1], O = [atY(y), y], [a0, a1] = corner[cnr], rr = 34;
            const P = (d, rad) => [O[0] + rad * Math.cos(d * Math.PI / 180), O[1] - rad * Math.sin(d * Math.PI / 180)];
            const wedge = sv("path", { d: `M${O}L${P(a0, rr)}A${rr} ${rr} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${P(a1, rr)}Z`, fill: i ? "rgba(127,174,221,.85)" : "rgba(242,179,61,.8)" });
            const lp = P((a0 + a1) / 2, rr + 40), lab = sv("text", { x: lp[0], y: lp[1] + 7, "text-anchor": "middle", "font-size": 20, "font-weight": 700 }); lab.textContent = p.labels[i];
            marks.push(wedge, lab); svg.append(wedge, lab);
        });
        return { node: svg, async play(fast) {
            if (fast) return;
            marks.forEach((m) => (m.style.opacity = 0));
            for (const l of parts.filter((x) => x.tagName === "line")) { const L = Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value); l.style.strokeDasharray = L; l.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 420, easing: "ease-out", fill: "forwards" }); await wait(220); }
            await wait(200);
            for (const m of marks) { m.style.opacity = 1; m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); await wait(220); }
        } };
    },
    story(p) {
        const box = el("div", "sp-story");
        const plain = (t) => String(t).replace(/§/g, "$").replace(/(\d+)\{(\d+)\/(\d+)\}/g, "$1 $2/$3").replace(/\{([^{}/]+)\/([^{}/]+)\}/g, "$1/$2");
        const text = plain(p.text);
        const marks = (p.marks || []).map((m, i) => ({ s: plain(m[0]), i })).filter((m) => text.includes(m.s));
        let rest = text; const spans = [];
        while (rest) {
            let best = null; marks.forEach((m) => { const at = rest.indexOf(m.s); if (at >= 0 && (!best || at < best.at)) best = { at, m }; });
            if (!best) { box.appendChild(document.createTextNode(rest)); break; }
            if (best.at) box.appendChild(document.createTextNode(rest.slice(0, best.at)));
            const s = el("span", "w-k", best.m.s); s.dataset.k = "s" + best.m.i; s.classList.add(best.m.i % 2 ? "hl-n" : "hl-x"); box.appendChild(s); spans.push(s);
            marks.splice(marks.indexOf(best.m), 1);
            rest = rest.slice(best.at + best.m.s.length);
        }
        return { node: box, async play(fast) {
            if (fast) return;
            spans.forEach((s) => (s.style.backgroundSize = "0% 100%"));
            await wait(250);
            for (const s of spans) { s.animate([{ backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%" }], { duration: 380, easing: "ease-out", fill: "forwards" }); await wait(420); s.style.backgroundSize = "100% 100%"; }
        } };
    },
    verdict(p) {
        const b = el("span", "sp-verdict " + (p.ok ? "yes" : "no"), (p.ok ? "✓ " : "✗ ") + p.text);
        return { node: b, async play(fast) { if (!fast) await b.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 300 }).finished.catch(() => {}); } };
    },
    fact(p) {
        const b = el("span", "sp-fact", p.text);
        return { node: b, async play(fast) { if (!fast) await b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }).finished.catch(() => {}); } };
    }
};

/* ---------- the hand-written look ---------- */
// Sriracha is a marker handwriting with clear numbers (a 1 with a flag, so 15 never reads as "IS"). Google Fonts, like the
// site's other fonts. Patrick Hand (already on the board page) is the fallback.
function handFont() {
    if (document.getElementById("sp-handfont")) return;
    const l = document.createElement("link"); l.id = "sp-handfont"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Sriracha&display=swap"; document.head.appendChild(l);
}
const WRITE_EM = 5.5;   // how fast the pen moves, in letters (em) per second: steady enough to follow

/* ---------- the player ---------- */
/** Draw a dt (from js/walk.js) as page elements, for problem text outside the player. */
export const drawDT = (d) => draw(d);

export function createStepPlayer(host, walk, opts) {
    opts = opts || {};
    const steps = walk.steps, N = steps.length;
    const hand = opts.look !== "print";
    if (hand) handFont();
    const root = el("div", "sp" + (opts.big ? " big" : "") + (opts.controls === false ? " bare" : "") + (hand ? " hand" : ""));
    root.tabIndex = -1;
    const head = el("div", "sp-head"), mv = el("div", "sp-move"), dots = el("div", "sp-dots"), count = el("span", "sp-count");
    head.append(mv, dots, count);
    const board = el("div", "sp-board"), work = el("div", "sp-work" + (walk.cols === 5 ? " c5" : "")), ink = document.createElementNS(NS, "svg");
    ink.setAttribute("class", "sp-ink"); ink.setAttribute("aria-hidden", "true");
    const pen = el("div", "sp-pen"); pen.setAttribute("aria-hidden", "true");
    board.append(work, ink, pen);
    const why = el("p", "sp-why"); why.setAttribute("aria-live", "polite");
    const ctl = el("div", "sp-ctl");
    const btn = (icon, label, cls, opt) => { const b = el("button", cls || ""); b.type = "button"; b.innerHTML = ICON[icon] + '<span class="lbl' + (opt ? " opt" : "") + '">' + label + "</span>"; b.setAttribute("aria-label", label); return b; };
    const bReplay = btn("replay", "Replay", "", true), bBack = btn("back", "Back", "", true), bPlay = btn("play", "Play"), bNext = btn("next", "Next step", "go");
    ctl.append(bReplay, bBack, bPlay, bNext);
    root.append(head, board, why, ctl);
    host.appendChild(root);
    for (let i = 0; i < N; i++) dots.appendChild(el("i"));

    let at = -1, playing = false, token = 0, busy = false;
    const fast = () => reduced() || opts.instant;
    const keyEl = (k, scope) => { const list = (scope || work).querySelectorAll('[data-k="' + CSS.escape(k) + '"]'); return list.length ? list[list.length - 1] : null; };

    function rowNode(row) {
        let n;
        if (row.t === "pic") {
            n = el("div", "sp-row pic");
            const p = (pics[row.pic.kind] || pics.fact)(row.pic);
            n.appendChild(p.node); n._pic = p;
        } else if (row.t === "ans") {
            n = el("div", "sp-row ans"); const a = el("span", "sp-ans"); a.appendChild(draw(row.dt)); n.appendChild(a);
        } else {
            n = el("div", "sp-row" + (row.t === "op" ? " op" : "") + (row.c === "w-check" ? " check" : ""));
            const cells = row.cells.slice();
            const cols = walk.cols === 5 ? 5 : 3;
            while (cells.length < cols) cells.push(null);
            cells.forEach((c, i) => { const d = el("span", "sp-c" + (i % 2 ? " sp-rel" : "")); if (c != null) d.appendChild(draw(c)); n.appendChild(d); });
        }
        return n;
    }
    /** Lay down every row of steps 0..i with no motion (the board as it stands after step i). */
    function lay(i) {
        work.textContent = ""; ink.textContent = "";
        for (let s = 0; s <= i; s++) {
            steps[s].seq.forEach((x) => {
                if (x.a === "row") work.appendChild(rowNode(x.row));
                else if (x.a === "strike") x.ks.forEach((k) => { const e = keyEl(k); if (e) e.classList.add("x", "on"); });
                else if (x.a === "turn" && s === i) x.ks.forEach((k) => { const e = keyEl(k); if (e) e.classList.add("turned"); });
                else if (s === i && x.a === "hl") x.ks.forEach((k) => { const e = keyEl(k); if (e) e.classList.add("hl-" + (x.tone || "x")); });
                else if (s === i && x.a === "box") x.ks.forEach((k) => { const e = keyEl(k); if (e) e.classList.add("box"); });
            });
        }
        dim(i);
        if (hand) marks();
    }
    /* hand look: the red cancel slashes and the green answer box are drawn in the ink layer, so they look pen-drawn */
    const em = () => parseFloat(getComputedStyle(board).fontSize) || 30;
    function sizeInk() { ink.setAttribute("width", work.scrollWidth + 40); ink.setAttribute("height", work.scrollHeight + 80); }
    function slashOf(e) {
        const r = rel(e), f = em(), p = f * .1;
        return { d: `M${r.x - p} ${r.y + r.h * .82}Q${r.x + r.w / 2 + f * .03} ${r.y + r.h * .52} ${r.x + r.w + p} ${r.y + r.h * .16}`, w: f * .075 };
    }
    function boxOf(e) {
        const r = rel(e), f = em(), rr = f * .28;
        return { d: `M${r.x + rr} ${r.y}H${r.x + r.w - rr}Q${r.x + r.w} ${r.y} ${r.x + r.w} ${r.y + rr}V${r.y + r.h - rr}Q${r.x + r.w} ${r.y + r.h} ${r.x + r.w - rr} ${r.y + r.h}H${r.x + rr}Q${r.x} ${r.y + r.h} ${r.x} ${r.y + r.h - rr}V${r.y + rr}Q${r.x} ${r.y} ${r.x + rr} ${r.y}Z`, w: f * .07 };
    }
    function inkPath(g, color, cls) {
        const p = sv("path", { d: g.d, class: cls }); p.style.stroke = color; p.style.strokeWidth = g.w + "px"; ink.appendChild(p); return p;
    }
    function marks() {
        sizeInk();
        work.querySelectorAll(".w-k.x.on").forEach((e) => { const p = inkPath(slashOf(e), PEN.red, "sp-slash"); if (e.closest(".sp-row.old")) p.style.opacity = .5; });
        work.querySelectorAll(".sp-ans").forEach((e) => inkPath(boxOf(e), PEN.green, "sp-box"));
    }
    /** Draw a path like a pen stroke, with the pen tip riding along it. */
    async function drawStroke(p, ms) {
        const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
        const a = p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: ms, easing: "ease-in-out", fill: "forwards" });
        const pts = []; for (let j = 0; j <= 12; j++) { const q = p.getPointAtLength(L * j / 12); pts.push({ transform: `translate(${q.x}px,${q.y}px)` }); }
        pen.style.opacity = 1; pen.animate(pts, { duration: ms, easing: "ease-in-out", fill: "forwards" });
        await a.finished.catch(() => {}); pen.style.opacity = 0;
        p.style.strokeDasharray = ""; p.style.strokeDashoffset = "";
    }
    /** Write a row the way a hand does: each piece left to right, the pen tip moving with the ink. */
    async function writeRow(n, small, live) {
        const parts = n.classList.contains("ans") ? [n.querySelector(".sp-ans")] : [...n.children].filter((c) => c.textContent.trim());
        const HIDE = "inset(-40% 100% -40% -5%)";
        parts.forEach((c) => (c.style.clipPath = HIDE));
        const f = em() * (small ? .68 : 1);
        for (const c of parts) {
            if (!live()) { parts.forEach((x) => (x.style.clipPath = "")); return; }
            // a cell is a whole grid column; the writing is only where its letters are
            const rg = document.createRange(); rg.selectNodeContents(c);
            const box = rel(c), r = rel(rg.getBoundingClientRect()), ms = Math.max(200, (r.w / f / WRITE_EM) * 1000), y = r.y + r.h * .58;
            const from = Math.max(0, box.x + box.w - r.x), to = Math.max(0, box.x + box.w - (r.x + r.w)) - 4;
            c.style.clipPath = "";
            const a = c.animate([{ clipPath: `inset(-40% ${from}px -40% -5%)` }, { clipPath: `inset(-40% ${to}px -40% -5%)` }], { duration: ms, easing: "linear" });
            pen.style.opacity = 1;
            pen.animate([{ transform: `translate(${r.x}px,${y}px)` }, { transform: `translate(${r.x + r.w}px,${y}px)` }], { duration: ms, easing: "linear", fill: "forwards" });
            await a.finished.catch(() => {});
            await wait(90);
        }
        pen.style.opacity = 0;
    }
    function dim(i) {
        // earlier steps fade back so the eye lands on the newest line
        const mine = new Set(); let count2 = 0;
        if (i >= 0) steps[i].seq.forEach((x) => { if (x.a === "row") count2++; });
        const rows = [...work.children];
        rows.forEach((r, j) => r.classList.toggle("old", j < rows.length - count2 - 1 && rows.length > 3));
        void mine;
    }
    function header(i) {
        const s = steps[Math.max(0, i)];
        mv.innerHTML = ""; mv.appendChild(document.createTextNode(i < 0 ? "Walkthrough" : s.title));
        count.textContent = "Step " + (i + 1) + " of " + N;
        [...dots.children].forEach((d, j) => { d.className = j < i ? "done" : j === i ? "now" : ""; });
        why.textContent = i < 0 ? "" : String(s.why).replace(/§/g, "$");
        bBack.disabled = i <= 0; bNext.disabled = i >= N - 1;
        bPlay.innerHTML = (playing ? ICON.pause : ICON.play) + '<span class="lbl">' + (playing ? "Pause" : i >= N - 1 ? "Play again" : "Play") + "</span>";
        bPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
    }
    const toBottom = () => { board.scrollTop = board.scrollHeight; };
    function rel(e) {
        // k: the player can sit inside a scaled slide (a Show Steps piece on a slide), so screen pixels are turned back into its own
        const b = board.getBoundingClientRect(), r = e.getBoundingClientRect ? e.getBoundingClientRect() : e, k = board.offsetWidth ? (b.width / board.offsetWidth) || 1 : 1;
        return { x: (r.left - b.left) / k + board.scrollLeft, y: (r.top - b.top) / k + board.scrollTop, w: r.width / k, h: r.height / k };
    }
    async function animateStep(i, my) {
        const st = steps[i], live = () => my === token;
        const newRows = [];
        const hidden = new Set();
        st.seq.forEach((x) => { if (x.a === "fly") x.pairs.forEach((p) => p[1] && hidden.add(p[1])); if (x.a === "flip") hidden.add(x.to); });
        for (const x of st.seq) {
            if (!live()) return;
            if (x.a === "row") {
                const n = rowNode(x.row); work.appendChild(n); newRows.push(n);
                n.querySelectorAll("[data-k]").forEach((e) => { if (hidden.has(e.dataset.k)) e.style.opacity = 0; });
                dim(i); toBottom();
                if (x.row.t === "pic") { n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 }); await n._pic.play(false); }
                else if (hand) {
                    await writeRow(n, x.row.t === "op", live);
                    if (x.row.t === "ans" && live()) { sizeInk(); await drawStroke(inkPath(boxOf(n.firstChild), PEN.green, "sp-box"), 900); }
                    await wait(x.row.t === "op" ? 200 : 300);
                }
                else if (x.row.t === "ans") { const a = n.firstChild; a.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 520, easing: "ease-out" }); await wait(560); }
                else { n.animate([{ clipPath: "inset(0 100% 0 0)", opacity: .3 }, { clipPath: "inset(0 0 0 0)", opacity: 1 }], { duration: x.row.t === "op" ? 380 : 560, easing: "cubic-bezier(.3,.1,.3,1)" }); await wait(x.row.t === "op" ? 420 : 520); }
            } else if (x.a === "hl" || x.a === "box") {
                const cls = x.a === "box" ? "box" : "hl-" + (x.tone || "x");
                for (const k of x.ks) { const e = keyEl(k); if (!e) continue; e.classList.add(cls); if (x.a === "hl") e.animate([{ backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%" }], { duration: 320, easing: "ease-out" }); else e.animate([{ boxShadow: "0 0 0 0 rgba(242,179,61,0)" }, { boxShadow: "0 0 0 .08em #F2B33D, 0 0 0 .2em rgba(242,179,61,.28)" }], { duration: 320 }); await wait(x.a === "hl" ? 240 : 0); }
                await wait(420);
            } else if (x.a === "strike") {
                for (const k of x.ks) {
                    const e = keyEl(k); if (!e) continue;
                    if (hand) { sizeInk(); await drawStroke(inkPath(slashOf(e), PEN.red, "sp-slash"), 420); e.classList.add("x", "on"); await wait(160); continue; }
                    e.classList.add("x"); void e.offsetWidth; e.classList.add("on"); await wait(240);
                }
                await wait(420);
            } else if (x.a === "arrow") {
                const from = keyEl(x.from); if (!from) continue;
                ink.setAttribute("width", work.scrollWidth + 40); ink.setAttribute("height", work.scrollHeight + 40);
                if (!ink.querySelector("marker")) arrowHead(ink, "sph" + ++uid, PEN.blue);
                const head = ink.querySelector("marker").id;
                const fr = rel(from), fx = fr.x + fr.w / 2, fy = fr.y + fr.h * 0.05;
                for (const k of x.to) {
                    const t = keyEl(k); if (!t) continue;
                    const tr = rel(t), tx = tr.x + tr.w / 2, ty = tr.y + tr.h * 0.05, lift = Math.max(18, Math.abs(tx - fx) * 0.35);
                    const path = sv("path", { d: `M${fx} ${fy}C${fx} ${fy - lift} ${tx} ${ty - lift} ${tx} ${ty - 2}`, "marker-end": `url(#${head})` });
                    ink.appendChild(path);
                    const L = path.getTotalLength(); path.style.strokeDasharray = L;
                    path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 420, easing: "ease-out", fill: "forwards" });
                    t.animate([{ color: "inherit" }, { color: "#1552D6" }, { color: "inherit" }], { duration: 700, delay: 300 });
                    await wait(460);
                }
                await wait(380);
            } else if (x.a === "fly" || x.a === "flip") {
                const pairs = x.a === "flip" ? [[x.from, x.to]] : x.pairs;
                const flips = x.a === "flip" || x.flip;
                const jobs = [];
                const targets = new Set();
                for (const [fk, tk] of pairs) {
                    if (!tk) continue;
                    const scope = newRows[newRows.length - 1] || work;
                    const t = keyEl(tk, scope) || keyEl(tk);
                    const tRow = t && t.closest(".sp-row");
                    const f = t ? [...work.querySelectorAll('[data-k="' + CSS.escape(fk) + '"]')].filter((e) => e.closest(".sp-row") !== tRow).pop() : null;
                    if (!t || !f) { if (t) t.style.opacity = ""; continue; }
                    targets.add(t);
                    const a = rel(f), b = rel(t);
                    const ghost = el("div", "sp-fly");
                    ghost.appendChild((flips ? t : f).cloneNode(true));
                    ghost.firstChild.style.opacity = 1; ghost.firstChild.classList.remove("x", "on", "box");
                    ghost.style.left = a.x + "px"; ghost.style.top = a.y + "px"; const cs = getComputedStyle(f); ghost.style.fontSize = cs.fontSize; ghost.style.lineHeight = cs.lineHeight; ghost.style.fontWeight = cs.fontWeight; ghost.style.color = cs.color;
                    board.appendChild(ghost);
                    const dx = b.x - a.x + (b.w - a.w) / 2, dy = b.y - a.y + (b.h - a.h) / 2;
                    const frames = flips ? [{ transform: "translate(0,0) rotateX(180deg)", opacity: .9 }, { transform: `translate(${dx / 2}px,${dy / 2 - 30}px) rotateX(90deg)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px) rotateX(0deg)`, opacity: 1 }]
                        : [{ transform: "translate(0,0)", opacity: 1 }, { transform: `translate(${dx}px,${dy}px)`, opacity: x.merge ? .4 : 1 }];
                    jobs.push(ghost.animate(frames, { duration: flips ? 900 : 640, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }).finished.catch(() => {}).then(() => ghost.remove()));
                    if (x.story) await wait(220);
                }
                await Promise.all(jobs);
                targets.forEach((t) => { t.style.opacity = ""; t.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 220 }); });
                // anything this step hid and nobody flew into shows now
                newRows.forEach((r) => r.querySelectorAll("[data-k]").forEach((e) => { if (e.style.opacity === "0") e.style.opacity = ""; }));
                await wait(260);
            } else if (x.a === "turn") {
                for (const k of x.ks) {
                    const e = keyEl(k); if (!e) continue;
                    e.style.opacity = ""; e.classList.add("turned");
                    e.animate([{ transform: "rotateY(180deg) scale(1.2)" }, { transform: "rotateY(90deg) scale(1.35)", offset: .5 }, { transform: "rotateY(0) scale(1)" }], { duration: 700, easing: "ease-in-out" });
                }
                await wait(760);
            }
        }
        newRows.forEach((r) => r.querySelectorAll("[data-k]").forEach((e) => { if (e.style.opacity === "0") e.style.opacity = ""; }));
    }
    async function go(i, animate) {
        i = Math.max(0, Math.min(N - 1, i));
        const my = ++token;
        board.querySelectorAll(".sp-fly").forEach((g) => g.remove());
        pen.getAnimations().forEach((a) => a.cancel()); pen.style.opacity = 0;
        const step = animate && !fast() && (i === at + 1 || i === at);
        at = i; header(i);
        if (opts.onStep) opts.onStep(i, steps[i]);
        if (step) {
            lay(i - 1);
            work.querySelectorAll(".hl-x,.hl-n,.box,.turned").forEach((e) => e.classList.remove("hl-x", "hl-n", "box", "turned"));
            ink.textContent = ""; if (hand) marks();   // keep the earlier steps' slashes while this one plays
            busy = true;
            try { await animateStep(i, my); } catch (e) { if (opts.debug) console.error(e); /* a step that cannot animate still lands below */ }
            busy = false;
            if (my !== token) return;
            lay(i); toBottom();
        } else { lay(i); toBottom(); }
        if (playing && my === token) {
            if (i >= N - 1) { playing = false; header(i); return; }
            await wait(Math.min(5200, 1400 + steps[i].why.length * 28));
            if (playing && my === token) go(i + 1, true);
        }
    }
    const api = {
        go, get index() { return at; }, get count() { return N; }, get busy() { return busy; }, el: root,
        next() { if (at < N - 1) go(at + 1, true); },
        back() { playing = false; if (at > 0) go(at - 1, false); else header(at); },
        play() { playing = true; if (at >= N - 1) go(0, false).then(() => playing && go(1, true)); else go(at + 1, true); header(at); },
        pause() { playing = false; token++; header(at); lay(at); },
        replay() { playing = false; go(0, false); },
        destroy() { token++; playing = false; root.remove(); }
    };
    bNext.onclick = () => { playing = false; api.next(); };
    bBack.onclick = () => api.back();
    bPlay.onclick = () => (playing ? api.pause() : api.play());
    bReplay.onclick = () => api.replay();
    root.addEventListener("keydown", (e) => {
        if (e.target.closest("input,textarea,select")) return;
        if (e.key === "ArrowRight") { e.preventDefault(); playing = false; api.next(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); api.back(); }
        else if (e.key === " " && e.target === root) { e.preventDefault(); playing ? api.pause() : api.play(); }
    });
    let rz = 0; const ro = new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { if (!busy && at >= 0) lay(at); }, 120); });
    ro.observe(board);
    if (hand && document.fonts) document.fonts.load('40px "Sriracha"').then(() => { if (!busy && at >= 0 && root.isConnected) lay(at); }).catch(() => {});
    go(0, false);
    if (opts.autoplay) api.play();
    return api;
}
