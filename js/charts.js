/* ==========================================
   Anchor Board — small SVG charts for Student Progress.
   No chart library: three chart shapes cover the page (a line over time, a three-band bar,
   a tiny sparkline), they draw in the site's own colours and fonts, work offline from the
   service-worker cache, and add nothing to load on a school Chromebook.
   Every chart has a hover/tap tooltip and an aria-label; the same numbers sit in text beside it.
========================================== */
const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (parent) parent.appendChild(e); return e; };
export const BAND = { low: "#C9434B", mid: "#E0A526", ok: "#2E9A69" };
const INK = "#0E1B3A", MUTE = "#55627F", GRID = "#E3E8F1", LINE = "#10358A";
const pct = (v) => Math.round(v * 100) + "%";
const fmtDay = (d) => { const t = new Date(d + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

let tip = null;
function showTip(evt, html) {
    if (!tip) { tip = document.createElement("div"); tip.className = "pgTip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    tip.innerHTML = ""; html.forEach((t, i) => { const l = document.createElement(i ? "span" : "b"); l.textContent = t; tip.appendChild(l); });
    tip.hidden = false;
    const x = Math.min(innerWidth - tip.offsetWidth - 8, Math.max(8, evt.clientX + 12)), y = Math.max(8, evt.clientY - tip.offsetHeight - 12);
    tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = () => { if (tip) tip.hidden = true; };

/**
 * A line over time. pts: [{ d: "YYYY-MM-DD", v: 0..1, label? }] in date order.
 * refs: [{ v, label, kind: "base" | "target" | "stretch" | "cut" }] horizontal guide lines, labelled at the right.
 */
export function lineChart(pts, { refs = [], h = 220, title = "", cut = null } = {}) {
    const W = 640, H = h, L = 40, R = 92, T = 14, B = 28;
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "pgLine", role: "img", "aria-label": title + ": " + pts.map((p) => fmtDay(p.d) + " " + pct(p.v)).join(", ") });
    const x = (i) => L + (pts.length < 2 ? (W - L - R) / 2 : (i * (W - L - R)) / (pts.length - 1)), y = (v) => T + (1 - v) * (H - T - B);
    [0, 0.5, 1].forEach((v) => { svg("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: GRID, "stroke-width": 1 }, root); const t = svg("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end", fill: MUTE, "font-size": 11 }, root); t.textContent = pct(v); });
    if (cut != null && !refs.some((r) => Math.abs(r.v - cut) < 0.04)) { svg("line", { x1: L, x2: W - R, y1: y(cut), y2: y(cut), stroke: BAND.low, "stroke-width": 1, "stroke-dasharray": "2 4", opacity: 0.7 }, root); const t = svg("text", { x: W - R + 6, y: y(cut) + 4, fill: MUTE, "font-size": 11 }, root); t.textContent = "Help line " + pct(cut); }
    refs.forEach((r) => {
        const col = r.kind === "base" ? MUTE : r.kind === "cut" ? BAND.low : "#B07A06";
        svg("line", { x1: L, x2: W - R, y1: y(r.v), y2: y(r.v), stroke: col, "stroke-width": 1.5, "stroke-dasharray": r.kind === "base" ? "1 0" : "6 4", opacity: r.kind === "base" ? 0.5 : 0.9 }, root);
        const t = svg("text", { x: W - R + 6, y: y(r.v) + 4, fill: INK, "font-size": 11, "font-weight": 600 }, root); t.textContent = r.label + " " + pct(r.v);
    });
    if (pts.length > 1) svg("path", { d: pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join(" "), fill: "none", stroke: LINE, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, root);
    pts.forEach((p, i) => {
        svg("circle", { cx: x(i), cy: y(p.v), r: 4.5, fill: LINE, stroke: "#fff", "stroke-width": 2 }, root);
        const hit = svg("rect", { x: x(i) - 14, y: T, width: 28, height: H - T - B, fill: "transparent" }, root);
        const lines = [fmtDay(p.d) + " · " + pct(p.v)].concat(p.label ? [p.label] : []);
        hit.addEventListener("pointermove", (e) => showTip(e, lines)); hit.addEventListener("pointerleave", hideTip);
    });
    // first and last date under the axis
    if (pts.length) { const a = svg("text", { x: x(0), y: H - 8, "text-anchor": pts.length > 1 ? "start" : "middle", fill: MUTE, "font-size": 11 }, root); a.textContent = fmtDay(pts[0].d); }
    if (pts.length > 1) { const b = svg("text", { x: x(pts.length - 1), y: H - 8, "text-anchor": "end", fill: MUTE, "font-size": 11 }, root); b.textContent = fmtDay(pts[pts.length - 1].d); }
    return root;
}

/** A tiny trend line for a table row. pts: [0..1]. Draws nothing for fewer than 2 points. */
export function sparkline(vals, title) {
    const W = 96, H = 28, root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "pgSpark", role: "img", "aria-label": title + ": " + vals.map(pct).join(", ") });
    if (vals.length < 2) return root;
    const x = (i) => 3 + (i * (W - 6)) / (vals.length - 1), y = (v) => 3 + (1 - v) * (H - 6);
    svg("path", { d: vals.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" "), fill: "none", stroke: LINE, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, root);
    svg("circle", { cx: x(vals.length - 1), cy: y(vals[vals.length - 1]), r: 3, fill: LINE }, root);
    return root;
}

/** Share of the class in each band, as one bar: Not yet | Getting there | Has it. c: { low, mid, ok }. */
export function bandBar(c, label) {
    const n = c.low + c.mid + c.ok, box = document.createElement("div"); box.className = "pgBar"; box.setAttribute("role", "img");
    box.setAttribute("aria-label", label + ": " + c.low + " not yet, " + c.mid + " getting there, " + c.ok + " have it");
    [["low", "Not yet"], ["mid", "Getting there"], ["ok", "Has it"]].forEach(([k, w]) => {
        if (!c[k]) return; const s = document.createElement("span"); s.className = "b-" + k; s.style.flexGrow = c[k];
        s.textContent = c[k]; s.addEventListener("pointermove", (e) => showTip(e, [w, c[k] + " of " + n + " students"])); s.addEventListener("pointerleave", hideTip);
        box.appendChild(s);
    });
    return box;
}

/** A progress meter toward a target: earned of need points. */
export function meter(earned, need, label) {
    const box = document.createElement("div"); box.className = "pgMeter"; box.setAttribute("role", "meter");
    box.setAttribute("aria-valuemin", "0"); box.setAttribute("aria-valuemax", String(need)); box.setAttribute("aria-valuenow", String(Math.min(earned, need))); box.setAttribute("aria-label", label);
    const f = document.createElement("span"); f.style.width = Math.min(100, (100 * earned) / Math.max(1, need)) + "%"; if (earned >= need) f.className = "met"; box.appendChild(f);
    return box;
}
