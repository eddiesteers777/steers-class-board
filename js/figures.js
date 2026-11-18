/* ==========================================
   Focal — pictures inside question text: coordinate graphs, input/output tables and mapping diagrams.
   Written in any week-file text field as a token, so every place that shows the text (printed papers, the board,
   the Class Page, the Question Bank) draws the same picture:
     [[graph {"x":[-5,5],"y":[-5,5],"pts":[[1,2],[3,-1]]}]]
         x, y: axis ranges · pts: points · open: open circles · seg: segments [[x1,y1],[x2,y2]] ·
         line: lines through two points, drawn edge to edge with arrows · curve: a smooth path through points ·
         step: grid step (1) · size: width in em (10)
     [[table {"cols":["x","y"],"rows":[[1,3],[2,5]]}]]          add "across":true to lay it out sideways
     [[map {"left":[1,2,3],"right":[4,5],"arrows":[[1,4],[2,5],[3,5]],"lt":"Input","rt":"Output"}]]
   isFunction() says whether a picture shows a function (null when it cannot tell), for Week Review's checks.
   The Word kit (tools/weekly_kit/figures.py) reads the same tokens.
========================================== */
const NS = "http://www.w3.org/2000/svg";
const TYPES = /^\[\[(graph|table|map)\s*/;

/** At s[i] ("[[type {json}]]"): { type, spec, end } or null. */
export function parseFigure(s, i) {
    const m = TYPES.exec(s.slice(i, i + 12)); if (!m) return null;
    let j = i + m[0].length; if (s[j] !== "{") return null;
    let d = 0, str = false, k = j;
    for (; k < s.length; k++) {
        const c = s[k];
        if (str) { if (c === "\\") k++; else if (c === '"') str = false; continue; }
        if (c === '"') str = true; else if (c === "{") d++; else if (c === "}") { d--; if (!d) break; }
    }
    if (d) return null;
    let e = k + 1; while (s[e] === " ") e++;
    if (s.slice(e, e + 2) !== "]]") return null;
    try { return { type: m[1], spec: JSON.parse(s.slice(j, k + 1)), end: e + 2 }; } catch (err) { return null; }
}
/** Every picture in a text. */
export function figuresIn(text) {
    const s = String(text == null ? "" : text), out = [];
    for (let i = s.indexOf("[["); i >= 0; i = s.indexOf("[[", i + 2)) { const f = parseFigure(s, i); if (f) { out.push(f); i = f.end - 2; } }
    return out;
}
/** The text with pictures taken out (for plain-text places such as the parent message). */
export function stripFigures(text) {
    const s = String(text == null ? "" : text); let out = "", i = 0;
    while (i < s.length) { const f = s[i] === "[" && s[i + 1] === "[" ? parseFigure(s, i) : null; if (f) { i = f.end; continue; } out += s[i++]; }
    return out.replace(/\s{2,}/g, " ").trim();
}

function css() {
    if (typeof document === "undefined" || document.getElementById("fig-css")) return;
    const st = document.createElement("style"); st.id = "fig-css";
    st.textContent = ".fig{display:block;margin:.35em 0 .45em;max-width:100%;height:auto;overflow:visible}" +
        ".fig-table{border-collapse:collapse;margin:.35em 0 .45em;font-variant-numeric:tabular-nums}" +
        ".fig-table th,.fig-table td{border:1.5px solid currentColor;padding:.12em .7em;text-align:center;font-weight:400}" +
        ".fig-table th{font-weight:700;background:rgba(127,140,170,.16)}" +
        ".board .fig,.deck .fig{max-height:52vh;width:auto!important}";
    document.head.appendChild(st);
}
const svg = (tag, a) => { const n = document.createElementNS(NS, tag); Object.entries(a || {}).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
const num = (v) => String(v).replace(/^-/, "−");
let uid = 0;
function arrowDef(root, id) {
    const defs = svg("defs"), mk = svg("marker", { id, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "5", markerHeight: "5", orient: "auto-start-reverse" });
    mk.appendChild(svg("path", { d: "M0 0L10 5L0 10z", fill: "currentColor" })); defs.appendChild(mk); root.appendChild(defs);
}

function graph(g) {
    const [x0, x1] = g.x || [-5, 5], [y0, y1] = g.y || [-5, 5], step = +g.step || 1, U = 18, P = 14;
    const W = (x1 - x0) * U + 2 * P, H = (y1 - y0) * U + 2 * P;
    const X = (x) => P + (x - x0) * U, Y = (y) => P + (y1 - y) * U;
    const root = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "fig fig-graph", role: "img", "aria-label": "Coordinate graph" });
    root.style.width = (+g.size || 10) + "em";
    const id = "fa" + (++uid); arrowDef(root, id);
    const grid = svg("g", { stroke: "currentColor", "stroke-opacity": ".2", "stroke-width": ".7" });
    for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-9; x += step) grid.appendChild(svg("line", { x1: X(x), y1: Y(y0), x2: X(x), y2: Y(y1) }));
    for (let y = Math.ceil(y0 / step) * step; y <= y1 + 1e-9; y += step) grid.appendChild(svg("line", { x1: X(x0), y1: Y(y), x2: X(x1), y2: Y(y) }));
    root.appendChild(grid);
    const ax = svg("g", { stroke: "currentColor", "stroke-width": "1.3" });
    if (y0 <= 0 && y1 >= 0) ax.appendChild(svg("line", { x1: X(x0) - 6, y1: Y(0), x2: X(x1) + 6, y2: Y(0), "marker-start": "url(#" + id + ")", "marker-end": "url(#" + id + ")" }));
    if (x0 <= 0 && x1 >= 0) ax.appendChild(svg("line", { x1: X(0), y1: Y(y0) + 6, x2: X(0), y2: Y(y1) - 6, "marker-start": "url(#" + id + ")", "marker-end": "url(#" + id + ")" }));
    root.appendChild(ax);
    // Numbers on the axes: every step when the range is small, else every other one.
    const lab = svg("g", { fill: "currentColor", "font-size": "8.5", "font-family": "inherit" }), every = (x1 - x0) / step > 12 ? 2 * step : step;
    for (let x = Math.ceil(x0 / every) * every; x <= x1 + 1e-9; x += every) if (Math.abs(x) > 1e-9 && x !== x0 && x !== x1) { const t = svg("text", { x: X(x), y: Y(Math.max(y0, Math.min(0, y1))) + 10, "text-anchor": "middle" }); t.textContent = num(x); lab.appendChild(t); }
    for (let y = Math.ceil(y0 / every) * every; y <= y1 + 1e-9; y += every) if (Math.abs(y) > 1e-9 && y !== y0 && y !== y1) { const t = svg("text", { x: X(Math.max(x0, Math.min(0, x1))) - 4, y: Y(y) + 3, "text-anchor": "end" }); t.textContent = num(y); lab.appendChild(t); }
    root.appendChild(lab);
    const ink = svg("g", { stroke: "currentColor", "stroke-width": "2", fill: "none", "stroke-linecap": "round" });
    (g.seg || []).forEach(([a, b]) => ink.appendChild(svg("line", { x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]) })));
    (g.line || []).forEach(([a, b]) => {   // through two points, clipped to the box
        const dx = b[0] - a[0], dy = b[1] - a[1], ts = [];
        if (dx) { ts.push((x0 - a[0]) / dx, (x1 - a[0]) / dx); } if (dy) { ts.push((y0 - a[1]) / dy, (y1 - a[1]) / dy); }
        const ins = ts.map((t) => [a[0] + t * dx, a[1] + t * dy]).filter(([x, y]) => x >= x0 - 1e-9 && x <= x1 + 1e-9 && y >= y0 - 1e-9 && y <= y1 + 1e-9);
        if (ins.length < 2) return;
        ins.sort((p, q) => p[0] - q[0] || p[1] - q[1]); const p = ins[0], q = ins[ins.length - 1];
        ink.appendChild(svg("line", { x1: X(p[0]), y1: Y(p[1]), x2: X(q[0]), y2: Y(q[1]), "marker-start": "url(#" + id + ")", "marker-end": "url(#" + id + ")" }));
    });
    if ((g.curve || []).length > 1) {
        const c = g.curve.map(([x, y]) => [X(x), Y(y)]); let d = "M" + c[0].join(" ");
        for (let k = 1; k < c.length; k++) { const p0 = c[k - 2] || c[k - 1], p1 = c[k - 1], p2 = c[k], p3 = c[k + 1] || p2; d += " C" + (p1[0] + (p2[0] - p0[0]) / 6) + " " + (p1[1] + (p2[1] - p0[1]) / 6) + " " + (p2[0] - (p3[0] - p1[0]) / 6) + " " + (p2[1] - (p3[1] - p1[1]) / 6) + " " + p2[0] + " " + p2[1]; }
        ink.appendChild(svg("path", { d }));
    }
    root.appendChild(ink);
    const dots = svg("g", { stroke: "currentColor", "stroke-width": "1.6" });
    (g.pts || []).forEach(([x, y]) => dots.appendChild(svg("circle", { cx: X(x), cy: Y(y), r: "3.4", fill: "currentColor" })));
    (g.open || []).forEach(([x, y]) => dots.appendChild(svg("circle", { cx: X(x), cy: Y(y), r: "3.4", fill: "#fff" })));
    root.appendChild(dots);
    return root;
}

function table(t) {
    const cols = t.cols || ["x", "y"], rows = t.rows || [], tb = document.createElement("table"); tb.className = "fig-table";
    tb.setAttribute("aria-label", "Table of values");
    const cell = (tag, v) => { const c = document.createElement(tag); c.textContent = num(v); return c; };
    if (t.across) cols.forEach((h, j) => { const tr = document.createElement("tr"); tr.appendChild(cell("th", h)); rows.forEach((r) => tr.appendChild(cell("td", r[j]))); tb.appendChild(tr); });
    else { const hr = document.createElement("tr"); cols.forEach((h) => hr.appendChild(cell("th", h))); tb.appendChild(hr); rows.forEach((r) => { const tr = document.createElement("tr"); r.forEach((v) => tr.appendChild(cell("td", v))); tb.appendChild(tr); }); }
    return tb;
}

function mapping(m) {
    const L = m.left || [], Rt = m.right || [], n = Math.max(L.length, Rt.length, 1), rowH = 22, top = m.lt || m.rt ? 22 : 8, H = top + n * rowH + 16, W = 190;
    const root = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "fig fig-map", role: "img", "aria-label": "Mapping diagram" });
    root.style.width = (+m.size || 10) + "em";
    const id = "fm" + (++uid); arrowDef(root, id);
    const lx = 40, rx = 150, cy = top + (n * rowH + 8) / 2, ry = (n * rowH + 8) / 2 + 2;
    const g = svg("g", { stroke: "currentColor", "stroke-width": "1.5", fill: "none" });
    g.appendChild(svg("ellipse", { cx: lx, cy, rx: 26, ry })); g.appendChild(svg("ellipse", { cx: rx, cy, rx: 26, ry })); root.appendChild(g);
    const yOf = (list, k) => cy - ((list.length - 1) * rowH) / 2 + k * rowH;
    const txt = svg("g", { fill: "currentColor", "font-size": "11", "text-anchor": "middle", "font-family": "inherit" });
    if (m.lt) { const t = svg("text", { x: lx, y: 13, "font-weight": "700" }); t.textContent = m.lt; txt.appendChild(t); }
    if (m.rt) { const t = svg("text", { x: rx, y: 13, "font-weight": "700" }); t.textContent = m.rt; txt.appendChild(t); }
    L.forEach((v, k) => { const t = svg("text", { x: lx, y: yOf(L, k) + 4 }); t.textContent = num(v); txt.appendChild(t); });
    Rt.forEach((v, k) => { const t = svg("text", { x: rx, y: yOf(Rt, k) + 4 }); t.textContent = num(v); txt.appendChild(t); });
    root.appendChild(txt);
    const ar = svg("g", { stroke: "currentColor", "stroke-width": "1.3" });
    (m.arrows || []).forEach(([a, b]) => {
        const i = L.findIndex((v) => String(v) === String(a)), j = Rt.findIndex((v) => String(v) === String(b)); if (i < 0 || j < 0) return;
        ar.appendChild(svg("line", { x1: lx + 14, y1: yOf(L, i), x2: rx - 15, y2: yOf(Rt, j), "marker-end": "url(#" + id + ")" }));
    });
    root.appendChild(ar);
    return root;
}

/** The picture for a parsed token. */
export function figureEl(f) {
    css();
    try { return f.type === "graph" ? graph(f.spec) : f.type === "table" ? table(f.spec) : mapping(f.spec); }
    catch (e) { const s = document.createElement("span"); s.textContent = "[picture could not be drawn]"; return s; }
}

/** Does the picture show a function? true / false, or null when it cannot tell (lines and curves). */
export function isFunction(f) {
    const one = (pairs) => { const m = new Map(); for (const [x, y] of pairs) { const k = String(x); if (m.has(k) && String(m.get(k)) !== String(y)) return false; m.set(k, y); } return true; };
    if (f.type === "map") {
        const L = f.spec.left || [], arrows = f.spec.arrows || [];
        if (L.some((v) => !arrows.some(([a]) => String(a) === String(v)))) return false;   // every input needs an output
        return one(arrows);
    }
    if (f.type === "table") { const rows = f.spec.rows || []; return one(rows.map((r) => [r[0], r[1]])); }
    if (f.type === "graph") {
        const g = f.spec; if ((g.line || []).some(([a, b]) => a[0] === b[0]) || (g.seg || []).some(([a, b]) => a[0] === b[0])) return false;   // a vertical line
        if ((g.line || []).length || (g.seg || []).length || (g.curve || []).length || (g.open || []).length) return null;
        return one(g.pts || []);
    }
    return null;
}
