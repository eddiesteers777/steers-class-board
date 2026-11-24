/* ==========================================
   Anchor Board — "What it looks like in class" panel for one standard (Nov 24).
   Eddie: the standard's wording is a lot to take in, so show what students actually do, on a little map of its own.
   The panel is a short trail of four stops, joined by a path that fills in as you go:
     1 The standard (the official wording)  2 In plain words (an "I can")  3 In class (a sample problem that steps
     through, with a picture that changes at each step)  4 Your turn (one quick check, tap an answer).
   Data: data/stdExamples.js. Used by js/timelineMap.js (beside the map on a wide screen, as a sheet on a phone).
   Styles: css/timeline.css (class names start se-).
========================================== */

const NS = "http://www.w3.org/2000/svg";
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function svg(tag, attrs, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
const STATE_WORD = { taught: "Taught", teaching: "Teaching", reteach: "Reteach", "": "Not yet" };

/** Where each standard's trail is, kept while the page is open: code -> { shown (steps revealed), pick (answer index or -1) }. */
const memo = new Map();
const stateOf = (code) => { if (!memo.has(code)) memo.set(code, { shown: 0, pick: -1 }); return memo.get(code); };
export function resetExplain(code) { memo.delete(code); }

/**
 * Draw the panel into `box`.
 * o = { code, text (official wording), critical, state (progress mark), where ("Stop 4 · Topic 7"), ex (example or null),
 *       openStd(code) (the problems picker), close() or null (shows a Close button when given), headingId }
 */
export function renderExplain(box, o) {
    box.textContent = "";
    const S = stateOf(o.code), ex = o.ex;
    const wrap = el("div", "se");

    const top = el("div", "se-top");
    const code = el("span", "se-code t-" + (o.state || "none"), o.code); top.appendChild(code);
    top.appendChild(el("span", "se-mark", STATE_WORD[o.state || ""] + (o.critical ? " · ★ critical" : "")));
    if (o.close) { const x = el("button", "se-x", "Close"); x.type = "button"; x.onclick = o.close; top.appendChild(x); }
    wrap.appendChild(top);
    if (o.where) wrap.appendChild(el("p", "se-where", o.where));
    const h = el("h2", "se-skill", ex ? ex.skill : "Standard " + o.code); h.tabIndex = -1; if (o.headingId) h.id = o.headingId;
    wrap.appendChild(h);

    const trail = el("ol", "se-trail");
    const nSteps = ex ? ex.steps.length : 0, allShown = ex && S.shown >= nSteps, gotIt = ex && S.pick === ex.check.right;

    // 1 the standard
    const w1 = wp("done", "1", "The standard");
    w1.appendChild(el("p", "se-std", o.text));
    trail.appendChild(w1);

    if (!ex) {
        const w = wp("", "2", "What it looks like in class");
        w.appendChild(el("p", "se-none", "No classroom example for " + o.code + " yet. Its problems are a tap away."));
        trail.appendChild(w);
    } else {
        // 2 plain words
        const w2 = wp("done", "2", "In plain words");
        w2.appendChild(el("p", "se-plain", ex.plain));
        trail.appendChild(w2);

        // 3 in class: the problem, a picture, the steps
        const w3 = wp(allShown ? "done" : "now", "3", "What it looks like in class");
        w3.appendChild(el("p", "se-prob", ex.problem));
        const hl = S.shown ? ex.steps[S.shown - 1].hl || [] : [];
        if (ex.visual) { const v = visual(ex.visual, S.shown, hl); if (v) w3.appendChild(v); }
        const ol = el("ol", "se-steps"); ol.setAttribute("aria-live", "polite");
        ex.steps.slice(0, S.shown).forEach((st, i) => {
            const li = el("li", "se-step" + (i === S.shown - 1 && S.fresh ? " fresh" : ""));
            li.appendChild(el("span", "se-sn", String(i + 1)));
            const b = el("div");
            b.appendChild(el("p", "se-say", st.say));
            if (st.show) b.appendChild(el("p", "se-math", st.show));
            li.appendChild(b); ol.appendChild(li);
        });
        S.fresh = false;
        w3.appendChild(ol);
        const ctl = el("div", "se-ctl");
        if (!allShown) {
            const nx = el("button", "btn se-next", S.shown ? "Next step" : "Show step 1"); nx.type = "button";
            nx.onclick = () => { S.shown++; S.fresh = true; renderExplain(box, o); const n = box.querySelector(".se-next") || box.querySelector(".se-again"); if (n) n.focus({ preventScroll: true }); };
            ctl.appendChild(nx);
        } else {
            const ag = el("button", "btn ghost sm se-again", "Start over"); ag.type = "button";
            ag.onclick = () => { S.shown = 0; renderExplain(box, o); const n = box.querySelector(".se-next"); if (n) n.focus({ preventScroll: true }); };
            ctl.appendChild(ag);
        }
        ctl.appendChild(el("span", "se-count", S.shown ? "Step " + S.shown + " of " + nSteps : nSteps + " steps"));
        w3.appendChild(ctl);
        trail.appendChild(w3);

        // 4 your turn
        const w4 = wp(gotIt ? "done" : allShown ? "now" : "", "4", "Your turn");
        w4.appendChild(el("p", "se-q", ex.check.q));
        const opts = el("div", "se-opts"); opts.setAttribute("role", "group"); opts.setAttribute("aria-label", "Answers");
        ex.check.options.forEach((t, i) => {
            const b = el("button", "se-opt", t); b.type = "button";
            if (S.pick >= 0) {
                if (i === ex.check.right) b.classList.add("ok");
                else if (i === S.pick) b.classList.add("bad");
                b.setAttribute("aria-pressed", String(i === S.pick));
            }
            b.onclick = () => { S.pick = i; renderExplain(box, o); const n = box.querySelectorAll(".se-opt")[i]; if (n) n.focus({ preventScroll: true }); };
            opts.appendChild(b);
        });
        w4.appendChild(opts);
        const fb = el("p", "se-fb"); fb.setAttribute("aria-live", "polite");
        if (S.pick >= 0) { fb.className = "se-fb " + (gotIt ? "ok" : "bad"); fb.textContent = (gotIt ? "Yes. " : "Not quite. ") + ex.check.why; }
        w4.appendChild(fb);
        trail.appendChild(w4);
    }
    wrap.appendChild(trail);

    const pb = el("button", "btn ghost se-probs", "Problems for " + o.code); pb.type = "button";
    pb.onclick = () => o.openStd(o.code);
    wrap.appendChild(pb);
    box.appendChild(wrap);
}

/** One stop on the panel's trail. state: "done" (green), "now" (amber), "" (ahead). */
function wp(state, n, label) {
    const li = el("li", "se-wp" + (state ? " " + state : ""));
    const mk = el("span", "se-mk", state === "done" ? "✓" : n); mk.setAttribute("aria-hidden", "true");
    li.appendChild(mk);
    li.appendChild(el("p", "se-k", label));
    return li;
}

/* ---------- pictures ---------- */
export function visual(v, shown, hl) {
    const f = VIS[v.type]; if (!f) return null;
    const box = el("div", "se-vis se-v-" + v.type);
    const out = f(v, shown, hl || []); if (!out) return null;
    box.appendChild(out);
    return box;
}

const VIS = {
    /** Two parallel lines (m, n) cut by t at 65°, angles numbered 1–4 at m and 5–8 at n, the usual way round. */
    transversal(v, shown, hl) {
        const s = svg("svg", { viewBox: "0 0 300 182", role: "img", "aria-label": "Parallel lines m and n crossed by line t, with angles 1 to 8" });
        const top = 58, bot = 128, x0 = 113, x1 = 187, y0 = 8, y1 = 174;
        const at = (y) => x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
        s.appendChild(svg("line", { x1: 16, y1: top, x2: 284, y2: top, class: "se-ln" }));
        s.appendChild(svg("line", { x1: 16, y1: bot, x2: 284, y2: bot, class: "se-ln" }));
        s.appendChild(svg("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: "se-ln t" }));
        s.appendChild(svg("text", { x: 290, y: top + 5, class: "se-lt", "text-anchor": "end" }, "m"));
        s.appendChild(svg("text", { x: 290, y: bot + 5, class: "se-lt", "text-anchor": "end" }, "n"));
        s.appendChild(svg("text", { x: x0 - 10, y: y0 + 10, class: "se-lt" }, "t"));
        // parallel marks
        [top, bot].forEach((y) => s.appendChild(svg("path", { d: "M244 " + (y - 5) + "l6 5-6 5", class: "se-arrow" })));
        // label spots: top-left, top-right, bottom-left, bottom-right around each crossing (the bisectors of 65° and 115°)
        const off = [[-21, -12], [13, -19], [-13, 21], [21, 14]];
        [[top, 1], [bot, 5]].forEach(([y, first]) => {
            const cx = at(y);
            off.forEach(([dx, dy], k) => {
                const n = first + k, on = hl.includes(n);
                const g = svg("g", { class: "se-ang" + (on ? " hl" : "") });
                g.appendChild(svg("circle", { cx: cx + dx, cy: y + dy, r: 10.5 }));
                g.appendChild(svg("text", { x: cx + dx, y: y + dy + 4.5, "text-anchor": "middle" }, String(n)));
                s.appendChild(g);
                if (v.given && v.given[n]) s.appendChild(svg("text", { x: cx + dx - 14, y: y + dy + 4.5, class: "se-given", "text-anchor": "end" }, v.given[n]));
            });
        });
        return s;
    },

    /** A mapping diagram: inputs on the left, outputs on the right, an arrow per pair (lit up from step 1 on). */
    mapping(v, shown) {
        const s = svg("svg", { viewBox: "0 0 300 176", role: "img", "aria-label": "Mapping diagram: " + v.pairs.map(([a, b]) => v.from[a] + " to " + v.to[b]).join(", ") });
        const ys = (n) => Array.from({ length: n }, (_, i) => 28 + ((i + 0.5) * 132) / n);
        const yi = ys(v.from.length), yo = ys(v.to.length);
        s.appendChild(svg("text", { x: 70, y: 16, class: "se-cap", "text-anchor": "middle" }, "Input"));
        s.appendChild(svg("text", { x: 230, y: 16, class: "se-cap", "text-anchor": "middle" }, "Output"));
        s.appendChild(svg("ellipse", { cx: 70, cy: 94, rx: 34, ry: 70, class: "se-oval" }));
        s.appendChild(svg("ellipse", { cx: 230, cy: 94, rx: 34, ry: 70, class: "se-oval" }));
        v.pairs.forEach(([a, b]) => {
            const x1 = 92, y1 = yi[a], x2 = 204, y2 = yo[b], ang = Math.atan2(y2 - y1, x2 - x1);
            const g = svg("g", { class: "se-arr" + (shown ? " hl" : "") });
            g.appendChild(svg("line", { x1, y1, x2: x2 - 4 * Math.cos(ang), y2: y2 - 4 * Math.sin(ang) }));
            const p = (d, w) => (x2 - d * Math.cos(ang) + w * Math.sin(ang)).toFixed(1) + " " + (y2 - d * Math.sin(ang) - w * Math.cos(ang)).toFixed(1);
            g.appendChild(svg("path", { d: "M" + x2 + " " + y2 + "L" + p(10, 5) + "L" + p(10, -5) + "Z" }));
            s.appendChild(g);
        });
        v.from.forEach((t, i) => s.appendChild(svg("text", { x: 70, y: yi[i] + 5, class: "se-val", "text-anchor": "middle" }, t)));
        v.to.forEach((t, i) => s.appendChild(svg("text", { x: 230, y: yo[i] + 5, class: "se-val", "text-anchor": "middle" }, t)));
        return s;
    },

    /** A function machine: input → rule → output (the output shows once the steps get there). */
    machine(v, shown) {
        const row = el("div", "se-mach");
        const cell = (k, t, cls) => { const c = el("div", "se-mc " + cls); c.append(el("span", "se-mk2", k), el("strong", null, t)); return c; };
        row.appendChild(cell("In", v.input, "in"));
        row.appendChild(el("span", "se-to", "→"));
        row.appendChild(cell("Rule", v.rule.join(" then "), "rule"));
        row.appendChild(el("span", "se-to", "→"));
        row.appendChild(cell("Out", shown >= v.at ? v.output : "?", "out" + (shown >= v.at ? " got" : "")));
        return row;
    },

    /** A table, with a worked column that fills in at step `extra.at`. */
    table(v, shown) {
        const t = el("table", "se-tab"), on = v.extra && shown >= v.extra.at;
        const hr = el("tr"); v.head.forEach((x) => hr.appendChild(el("th", null, x))); if (v.extra) hr.appendChild(el("th", "x" + (on ? " on" : ""), v.extra.head));
        const th = el("thead"); th.appendChild(hr); t.appendChild(th);
        const tb = el("tbody");
        v.rows.forEach((r, i) => { const tr = el("tr"); r.forEach((x) => tr.appendChild(el("td", null, x))); if (v.extra) tr.appendChild(el("td", "x" + (on ? " on" : ""), on ? v.extra.vals[i] : "?")); tb.appendChild(tr); });
        t.appendChild(tb);
        return t;
    },

    /** An area model for the distributive property: outer factor down the side, terms across the top. */
    area(v, shown) {
        const g = el("div", "se-area"); g.style.gridTemplateColumns = "auto repeat(" + v.parts.length + ", minmax(0,1fr))";
        g.appendChild(el("span", "se-al"));
        v.parts.forEach((p) => g.appendChild(el("span", "se-al top", p)));
        g.appendChild(el("span", "se-al side", v.outer));
        v.cells.forEach((c) => g.appendChild(el("span", "se-ac" + (shown >= v.at ? " on" : ""), shown >= v.at ? c : "?")));
        return g;
    },

    /** A bar model: the parts side by side, with the total under them from step `at`. */
    bar(v, shown) {
        const w = el("div", "se-bar");
        const r = el("div", "se-bars");
        v.parts.forEach((p, i) => { const s = el("div", "se-seg s" + i); s.style.flex = p.w + " 1 0"; s.append(el("strong", null, p.t), el("span", null, p.sub)); r.appendChild(s); });
        w.appendChild(r);
        const tot = el("div", "se-total" + (shown >= v.at ? " on" : ""), shown >= v.at ? "Together: " + v.total : "Together: ?");
        w.appendChild(tot);
        return w;
    },

    /** A tape diagram: one long piece for the unknown, split into its equal parts once it is solved. */
    tape(v, shown) {
        const w = el("div", "se-bar");
        const r = el("div", "se-bars");
        if (shown >= v.at) for (let i = 0; i < v.count; i++) { const s = el("div", "se-seg s0 eq"); s.style.flex = "1 1 0"; s.appendChild(el("strong", null, v.unit)); r.appendChild(s); }
        else { const s = el("div", "se-seg s0"); s.style.flex = v.count + " 1 0"; s.append(el("strong", null, "?"), el("span", null, v.unknown)); r.appendChild(s); }
        const e = el("div", "se-seg s1"); e.style.flex = "1.1 1 0"; e.append(el("strong", null, v.extra), el("span", null, v.extraSub)); r.appendChild(e);
        w.appendChild(r);
        w.appendChild(el("div", "se-total on", "Total: " + v.total));
        return w;
    },

    /** A number line: a jump from start to end, or a shaded piece from `ray.from` to `ray.at`, shown from step `at`. */
    line(v, shown) {
        const L = 18, R = 282, s = svg("svg", { viewBox: "0 0 300 78", role: "img", "aria-label": "Number line from " + v.min + " to " + v.max });
        const x = (n) => L + ((n - v.min) / (v.max - v.min)) * (R - L), y = 50, on = shown >= v.at;
        s.appendChild(svg("line", { x1: L - 8, y1: y, x2: R + 8, y2: y, class: "se-ln" }));
        for (let n = v.min; n <= v.max + 1e-9; n += v.step) {
            s.appendChild(svg("line", { x1: x(n), y1: y - 5, x2: x(n), y2: y + 5, class: "se-ln" }));
            s.appendChild(svg("text", { x: x(n), y: y + 21, class: "se-tick", "text-anchor": "middle" }, n < 0 ? "−" + -n : String(n)));
        }
        if (v.start != null) {
            if (on) {
                const a = x(v.start), b = x(v.end), mid = (a + b) / 2;
                s.appendChild(svg("path", { d: "M" + a + " " + (y - 8) + "Q" + mid + " " + (y - 50) + " " + b + " " + (y - 8), class: "se-jump" }));
                s.appendChild(svg("path", { d: "M" + (b - 7) + " " + (y - 17) + "L" + b + " " + (y - 8) + "L" + (b - 10) + " " + (y - 7), class: "se-jump" }));
                s.appendChild(svg("text", { x: mid, y: 12, class: "se-cap", "text-anchor": "middle" }, "+" + (v.end - v.start)));
                s.appendChild(svg("circle", { cx: b, cy: y, r: 6, class: "se-dot end" }));
            }
            s.appendChild(svg("circle", { cx: x(v.start), cy: y, r: 6, class: "se-dot" }));
        }
        if (v.ray && on) {
            s.appendChild(svg("line", { x1: x(v.ray.from), y1: y, x2: x(v.ray.at), y2: y, class: "se-shade" }));
            [v.ray.from, v.ray.at].forEach((n) => s.appendChild(svg("circle", { cx: x(n), cy: y, r: 6, class: "se-dot end" + (v.ray.closed ? "" : " open") })));
        }
        return s;
    },
};
