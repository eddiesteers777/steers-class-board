/* The graphing calculator panel (Math tools, "graph"): a list of expressions on the left, a live graph on the right.
   Type y = 2x + 1, f(x) = x^2, x = 3, y > x, x^2 + y^2 = 25, (2, 3) or a = 3 (a slider). Drag to pan, scroll or pinch
   to zoom, tap a curve to trace it, and tap a gray dot for an intercept or a crossing. The maths is in js/graphCalc.js.
   The rows and the view are saved in S.tools.mt.graph, so the board and the Remote show the same graph. */
import * as G from "./graphCalc.js?v=1";

const KEYS = [
    ["x", "y", "a", "b", "(", ")", "<", ">"],
    ["7", "8", "9", "÷", "^", "x²", "√", "π"],
    ["4", "5", "6", "×", "|a|", ",", "=", "≤"],
    ["1", "2", "3", "−", "≥", "{", "}", "⌫"],
    ["0", ".", "+", "sin", "cos", "◀", "▶", "↵"],
];
const INSERT = { "÷": "/", "×": "*", "−": "-", "x²": "^2", "√": "sqrt(", "|a|": "||", sin: "sin(", cos: "cos(" };
const newId = () => Math.random().toString(36).slice(2, 10);
const HOME = { cx: 0, cy: 0, w: 22 };

/** ctx: { shell, h, btn, st, save } from js/manipPanels.js */
export function makeGraph(k, ctx) {
    const { h, btn } = ctx;
    const p = ctx.shell(k); p.root.classList.add("gc");
    /* ---- the list ---- */
    const top = h("div", "gc-top");
    const addB = btn("+", "gc-add", () => { const r = addRow(""); focusRow(r.id); }, "Add an expression");
    const keysB = btn("Keys", "gc-kt", () => { keysOn = !keysOn; pad.hidden = !keysOn; keysB.classList.toggle("on", keysOn); }, "Show the math keys");
    const clearB = btn("Clear", "gc-kt", () => { rows = [blank(0)]; selId = ""; trace = null; buildRows(); recalc(); saveSoon(0); }, "Remove every expression");
    top.append(addB, keysB, clearB);
    const listEl = h("div", "gc-list");
    const pad = h("div", "gc-pad"); pad.hidden = true;
    KEYS.forEach((row) => row.forEach((key) => {
        const b = h("button", "gc-key" + (/^[0-9.]$/.test(key) ? " num" : key === "↵" ? " go" : ""), key); b.type = "button";
        b.addEventListener("pointerdown", (e) => e.preventDefault());   // keep the cursor in the row being typed
        b.onclick = (e) => { e.stopPropagation(); press(key); };
        pad.appendChild(b);
    }));
    p.main.append(top, listEl, pad);
    /* ---- the graph ---- */
    const plot = h("div", "gc-plot"), cv = h("canvas", "gc-cv"), tip = h("div", "gc-tip"); tip.hidden = true;
    cv.setAttribute("role", "img");
    const zoom = h("div", "gc-zoom");
    zoom.append(btn("+", "gc-z", () => zoomBy(1 / 1.5), "Zoom in"), btn("−", "gc-z", () => zoomBy(1.5), "Zoom out"), btn("⌂", "gc-z", () => { view = Object.assign({}, HOME); trace = null; draw(); saveView(); }, "Back to the start view"));
    plot.append(cv, zoom, tip);
    p.side.append(plot, p.note);

    let rows = [], model = { rows: [] }, view = Object.assign({}, HOME), selId = "", keysOn = false, lastInput = null;
    let trace = null, marks = [], dirty = false, saveT = 0, viewT = 0, errT = {}, playing = null;
    const rowEls = new Map();
    const blank = (i) => ({ id: newId(), t: "", c: i % G.GC_COLS.length });

    /* ---------- rows ---------- */
    function addRow(t, after) {
        const at = after != null ? rows.findIndex((r) => r.id === after) + 1 : Math.max(0, rows.length - (rows.length && !rows[rows.length - 1].t ? 1 : 0));
        const used = new Set(rows.map((r) => r.c)); let c = rows.length % G.GC_COLS.length;
        for (let i = 0; i < G.GC_COLS.length; i++) if (!used.has(i)) { c = i; break; }
        const r = { id: newId(), t, c };
        rows.splice(at, 0, r); tidy(); buildRows(); recalc(); saveSoon(300);
        return r;
    }
    function tidy() {   // always one empty row at the end to type into
        while (rows.length > 1 && !rows[rows.length - 1].t && !rows[rows.length - 2].t && !isFocused(rows[rows.length - 2].id)) rows.splice(rows.length - 2, 1);
        if (!rows.length || rows[rows.length - 1].t) rows.push(blank(rows.length));
        if (rows.length > G.GC_MAX) rows.length = G.GC_MAX;
    }
    const isFocused = (id) => { const e = rowEls.get(id); return !!e && e.inp === document.activeElement; };
    function focusRow(id, end) { const e = rowEls.get(id); if (e) { e.inp.focus(); if (end !== false) { const n = e.inp.value.length; e.inp.setSelectionRange(n, n); } } }
    function rowEl(r) {
        let e = rowEls.get(r.id);
        if (e) return e;
        const el = h("div", "gc-row"); el.dataset.id = r.id;
        const sw = h("button", "gc-sw"); sw.type = "button";
        sw.onclick = (ev) => { ev.stopPropagation(); const x = rows.find((q) => q.id === r.id); if (!x || !x.t) return; x.h = !x.h; if (!x.h) delete x.h; paintRow(x); draw(); saveSoon(0); };
        const body = h("div", "gc-body");
        const inp = h("input", "gc-in"); inp.type = "text"; inp.id = "mtIn-graph-" + r.id; inp.autocomplete = "off"; inp.spellcheck = false; inp.setAttribute("autocapitalize", "off"); inp.setAttribute("aria-label", "Expression");
        const out = h("div", "gc-out");
        body.append(inp, out);
        const x = h("button", "gc-del", "×"); x.type = "button"; x.title = "Remove"; x.setAttribute("aria-label", "Remove this expression");
        x.onclick = (ev) => { ev.stopPropagation(); remove(r.id); };
        el.append(sw, body, x);
        inp.addEventListener("focus", () => { p.busy = true; lastInput = inp; selId = r.id; markSel(); draw(); });
        inp.addEventListener("blur", () => { setTimeout(() => { if (!p.root.contains(document.activeElement) || !document.activeElement.classList.contains("gc-in")) { p.busy = false; flush(); } }, 0); });
        inp.addEventListener("input", () => { const q = rows.find((z) => z.id === r.id); if (!q) return; q.t = inp.value.slice(0, G.GC_LEN); errT[r.id] = Date.now(); const was = rows.length; tidy(); if (rows.length !== was) buildRows(); recalc(); saveSoon(700); setTimeout(() => paintAll(), 750); });
        inp.addEventListener("keydown", (ev) => {
            const i = rows.findIndex((z) => z.id === r.id);
            if (ev.key === "Enter") { ev.preventDefault(); const nx = rows[i + 1] && !rows[i + 1].t ? rows[i + 1] : addRow("", r.id); focusRow(nx.id); }
            else if (ev.key === "ArrowDown" && rows[i + 1]) { ev.preventDefault(); focusRow(rows[i + 1].id); }
            else if (ev.key === "ArrowUp" && i > 0) { ev.preventDefault(); focusRow(rows[i - 1].id); }
            else if (ev.key === "Backspace" && !inp.value && rows.length > 1 && i > 0) { ev.preventDefault(); const prev = rows[i - 1].id; remove(r.id); focusRow(prev); }
            ev.stopPropagation();
        });
        e = { el, sw, inp, out, sliderOf: null };
        rowEls.set(r.id, e);
        return e;
    }
    function remove(id) {
        const i = rows.findIndex((z) => z.id === id); if (i < 0) return;
        rows.splice(i, 1); rowEls.delete(id); if (selId === id) selId = ""; trace = null;
        tidy(); buildRows(); recalc(); saveSoon(0);
    }
    function buildRows() {
        const kids = rows.map((r) => rowEl(r).el);
        kids.forEach((el, i) => { if (listEl.children[i] !== el) listEl.insertBefore(el, listEl.children[i] || null); });
        while (listEl.children.length > kids.length) listEl.removeChild(listEl.lastChild);
        [...rowEls.keys()].forEach((id) => { if (!rows.some((r) => r.id === id)) rowEls.delete(id); });
        rows.forEach((r, i) => { const e = rowEl(r); if (e.inp !== document.activeElement && e.inp.value !== r.t) e.inp.value = r.t; e.inp.placeholder = i === rows.length - 1 ? (rows.length === 1 ? "Type y = 2x + 1" : "Add another") : ""; });
        markSel();
    }
    function markSel() { rowEls.forEach((e, id) => e.el.classList.toggle("sel", id === selId)); }

    /* ---------- what each row says ---------- */
    function recalc() {
        model = G.buildList(rows.map((r) => ({ id: r.id, t: r.t })));
        paintAll(); draw();
    }
    function paintAll() { rows.forEach((r) => paintRow(r)); }
    function paintRow(r) {
        const e = rowEls.get(r.id); if (!e) return;
        const i = rows.indexOf(r), o = model.rows[i] || { kind: "none" }, col = G.GC_COLS[r.c];
        const graphs = ["fn", "xfn", "ineq", "imp", "pts", "fdef"].includes(o.kind);
        e.sw.style.setProperty("--c", col);
        e.sw.classList.toggle("off", !!r.h); e.sw.classList.toggle("none", !graphs);
        e.sw.disabled = !graphs; e.sw.setAttribute("aria-label", graphs ? (r.h ? "Show this graph" : "Hide this graph") : "No graph");
        e.el.classList.toggle("err", o.kind === "err");
        const typing = isFocused(r.id) && Date.now() - (errT[r.id] || 0) < 700;
        // keep a slider that is being dragged
        if (o.kind === "slider") { sliderRow(r, o, e); return; }
        e.sliderOf = null; e.out.innerHTML = ""; e.out.className = "gc-out";
        if (o.kind === "val" || o.kind === "def") { e.out.textContent = "= " + G.fmt(o.value); e.out.classList.add("ans"); }
        else if (o.kind === "miss") {
            e.out.classList.add("miss");
            e.out.appendChild(h("span", null, "Add a slider:"));
            o.vars.forEach((v) => e.out.appendChild(btn(v, "gc-chip", () => { addRow(v + " = 1", r.id); })));
            if (o.vars.length > 1) e.out.appendChild(btn("All", "gc-chip", () => { let after = r.id; o.vars.forEach((v) => { after = addRow(v + " = 1", after).id; }); }));
        }
        else if (o.kind === "err" && !typing) { e.out.textContent = o.msg; e.out.classList.add("warn"); }
    }
    function sliderRow(r, o, e) {
        const rg = G.rangeOf(r, o.value);
        if (e.sliderOf !== o.name || !e.out.querySelector("input[type=range]")) {
            e.out.innerHTML = ""; e.out.className = "gc-out sl"; e.sliderOf = o.name;
            const play = btn("▶", "gc-play", () => togglePlay(r.id), "Play the slider");
            const lo = h("input", "gc-lim"), hi = h("input", "gc-lim"), s = h("input", "gc-sl");
            [lo, hi].forEach((q, j) => { q.type = "text"; q.inputMode = "decimal"; q.id = "mtIn-graph-" + r.id + (j ? "hi" : "lo"); q.setAttribute("aria-label", j ? "Slider top" : "Slider bottom");
                q.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") q.blur(); });
                q.addEventListener("change", () => { const x = rows.find((z) => z.id === r.id); if (!x) return; const cur = G.rangeOf(x, o.value), v = parseFloat(G.normalize(q.value)); if (Number.isFinite(v)) { const n = { lo: j ? cur.lo : v, hi: j ? v : cur.hi, st: cur.st }; if (n.hi > n.lo) x.r = n; } paintRow(x); saveSoon(0); }); });
            s.type = "range"; s.setAttribute("aria-label", "Value of " + o.name);
            s.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); p.busy = true; });
            s.addEventListener("input", () => { const x = rows.find((z) => z.id === r.id); if (!x) return; setSlider(x, o.name, +s.value); });
            s.addEventListener("change", () => { p.busy = false; saveSoon(0); });
            e.out.append(play, lo, s, hi);
        }
        const [play, lo, s, hi] = e.out.children;
        if (document.activeElement !== lo) lo.value = G.fmt(rg.lo).replace("−", "-");
        if (document.activeElement !== hi) hi.value = G.fmt(rg.hi).replace("−", "-");
        s.min = rg.lo; s.max = rg.hi; s.step = rg.st || "any"; s.value = o.value;
        play.textContent = playing && playing.id === r.id ? "❚❚" : "▶";
        play.classList.toggle("on", !!(playing && playing.id === r.id));
    }
    function setSlider(x, name, v) {
        const rg = G.rangeOf(x, v);
        x.t = G.sliderText(name, G.snapTo(v, rg));
        const e = rowEls.get(x.id); if (e && e.inp !== document.activeElement) e.inp.value = x.t;
        recalc();
    }
    function togglePlay(id) {
        if (playing && playing.id === id) { cancelAnimationFrame(playing.raf); playing = null; p.busy = false; paintAll(); saveSoon(0); return; }
        if (playing) cancelAnimationFrame(playing.raf);
        const x = rows.find((z) => z.id === id); if (!x) return;
        p.busy = true; playing = { id, t0: 0 };
        const tick = (t) => {
            if (!playing || playing.id !== id) return;
            const r = rows.find((z) => z.id === id), i = rows.indexOf(r), o = model.rows[i];
            if (!r || !o || o.kind !== "slider") { playing = null; p.busy = false; return; }
            const rg = G.rangeOf(r, o.value), span = rg.hi - rg.lo;
            if (!playing.t0) playing.t0 = t;
            const dt = Math.min(80, t - (playing.last || t)); playing.last = t;
            let v = o.value + span * dt / 5000;   // the whole range in five seconds
            if (v > rg.hi) v = rg.lo;
            r.t = G.sliderText(o.name, +v.toPrecision(6));
            const e = rowEls.get(id); if (e && e.inp !== document.activeElement) e.inp.value = r.t;
            recalc();
            playing.raf = requestAnimationFrame(tick);
        };
        playing.raf = requestAnimationFrame(tick);
        paintAll();
    }

    /* ---------- the keys ---------- */
    function press(key) {
        let inp = lastInput && p.root.contains(lastInput) ? lastInput : null;
        if (!inp) { const last = rows[rows.length - 1]; focusRow(last.id); inp = rowEls.get(last.id).inp; }
        if (document.activeElement !== inp) inp.focus();
        const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a;
        if (key === "↵") { inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return; }
        if (key === "◀") { const n = Math.max(0, a - 1); inp.setSelectionRange(n, n); return; }
        if (key === "▶") { const n = Math.min(inp.value.length, b + 1); inp.setSelectionRange(n, n); return; }
        if (key === "⌫") {
            if (a !== b) inp.setRangeText("", a, b, "end"); else if (a > 0) inp.setRangeText("", a - 1, a, "end");
        } else {
            const t = INSERT[key] != null ? INSERT[key] : key;
            inp.setRangeText(t, a, b, "end");
            if (t === "||") inp.setSelectionRange(a + 1, a + 1);
        }
        inp.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /* ---------- saving ---------- */
    function saveSoon(ms) { clearTimeout(saveT); saveT = setTimeout(flush, ms); }
    function flush() {
        clearTimeout(saveT);
        const S = ctx.st(k);
        const keep = rows.filter((r, i) => r.t || i < rows.length - 1).map((r) => { const o = { id: r.id, t: r.t, c: r.c }; if (r.h) o.h = true; if (r.r) o.r = r.r; return o; });
        const next = G.cleanGc({ e: keep, v: view });
        if (JSON.stringify(next.e) === JSON.stringify(S.e) && JSON.stringify(next.v) === JSON.stringify(S.v)) return;
        S.e = next.e; S.v = next.v;
        p.sig = JSON.stringify(S);   // our own change: no need to rebuild from it
        ctx.save();
    }
    function saveView() { clearTimeout(viewT); viewT = setTimeout(flush, 500); }

    /* ---------- the graph ---------- */
    let W = 0, H = 0, dpr = 1, raf = 0;
    const g2 = cv.getContext("2d");
    function draw() { if (!raf) raf = requestAnimationFrame(paint); }
    function frame() {
        const sc = W / view.w;
        return { sc, x0: view.cx - view.w / 2, y0: view.cy - H / sc / 2, X: (x) => (x - (view.cx - view.w / 2)) * sc, Y: (y) => H - (y - (view.cy - H / sc / 2)) * sc };
    }
    function paint() {
        raf = 0;
        const r = plot.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) return;
        const d = Math.min(2, window.devicePixelRatio || 1);
        if (Math.round(r.width) !== W || Math.round(r.height) !== H || d !== dpr) { W = Math.round(r.width); H = Math.round(r.height); dpr = d; cv.width = W * dpr; cv.height = H * dpr; }
        const c = g2; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
        const F = frame();
        gridOf(c, F);
        marks = [];
        model.rows.forEach((o, i) => { const rw = rows[i]; if (!rw || rw.h) return; const col = G.GC_COLS[rw.c]; c.save(); try { drawRow(c, F, o, col, rw.id === selId); } catch (e) { /* a bad row draws nothing */ } c.restore(); });
        specialPoints(c, F);
        if (trace) drawTrace(c, F);
        cv.setAttribute("aria-label", "Graph of " + rows.filter((x) => x.t && !x.h).map((x) => x.t).join("; ") || "an empty graph");
    }
    function gridOf(c, F) {
        const step = G.niceStep(view.w, Math.max(4, W / 90)), m = step / (Math.round(step / Math.pow(10, Math.floor(Math.log10(step)))) === 2 ? 4 : 5);
        const x1 = F.x0 + W / F.sc, y1 = F.y0 + H / F.sc;
        const lines = (s, style) => {
            c.beginPath(); c.strokeStyle = style; c.lineWidth = 1;
            for (let x = Math.ceil(F.x0 / s) * s; x <= x1; x += s) { const px = Math.round(F.X(x)) + 0.5; c.moveTo(px, 0); c.lineTo(px, H); }
            for (let y = Math.ceil(F.y0 / s) * s; y <= y1; y += s) { const py = Math.round(F.Y(y)) + 0.5; c.moveTo(0, py); c.lineTo(W, py); }
            c.stroke();
        };
        if (m * F.sc > 6) lines(m, "rgba(30,60,110,.06)");
        lines(step, "rgba(30,60,110,.16)");
        // axes
        const ax = F.X(0), ay = F.Y(0);
        c.beginPath(); c.strokeStyle = "rgba(15,30,60,.75)"; c.lineWidth = 1.6;
        if (ax >= 0 && ax <= W) { c.moveTo(ax, 0); c.lineTo(ax, H); }
        if (ay >= 0 && ay <= H) { c.moveTo(0, ay); c.lineTo(W, ay); }
        c.stroke();
        // numbers on the axes (or on the edge when an axis is off screen)
        c.font = "600 " + Math.max(10, Math.min(14, W / 50)) + "px Inter, system-ui, sans-serif"; c.fillStyle = "rgba(15,30,60,.8)";
        c.lineWidth = 3; c.strokeStyle = "rgba(255,255,255,.92)";
        const ly = Math.min(H - 6, Math.max(14, ay + 15)), lx = Math.min(W - 4, Math.max(4, ax - 5));
        c.textAlign = "center"; c.textBaseline = "alphabetic";
        for (let x = Math.ceil(F.x0 / step) * step; x <= x1; x += step) { if (Math.abs(x) < step / 2) continue; const px = F.X(x), t = G.fmt(+x.toPrecision(12)); if (px < 12 || px > W - 12) continue; c.strokeText(t, px, ly); c.fillText(t, px, ly); }
        c.textAlign = ax - 5 < 30 ? "left" : "right"; c.textBaseline = "middle";
        const lxx = ax - 5 < 30 ? Math.max(4, ax + 5) : lx;
        for (let y = Math.ceil(F.y0 / step) * step; y <= y1; y += step) { if (Math.abs(y) < step / 2) continue; const py = F.Y(y), t = G.fmt(+y.toPrecision(12)); if (py < 10 || py > H - 10) continue; c.strokeText(t, lxx, py); c.fillText(t, lxx, py); }
        if (ax >= 0 && ax <= W && ay >= 0 && ay <= H) { c.textAlign = "right"; c.textBaseline = "alphabetic"; c.strokeText("0", ax - 5, ay + 15); c.fillText("0", ax - 5, ay + 15); }
    }
    function curve(c, F, f, ok, sideways) {
        // sample every half pixel, lift the pen at gaps, jumps and outside a {limit}
        const n = Math.ceil((sideways ? H : W) * 2), out = [];
        let pen = false, prev = null;
        c.beginPath();
        for (let i = 0; i <= n; i++) {
            const s = i / 2;
            const t = sideways ? F.y0 + (H - s) / F.sc : F.x0 + s / F.sc;
            let v = f(t);
            if (ok && !(sideways ? ok(v, t) : ok(t, v))) v = NaN;
            if (!Number.isFinite(v)) { pen = false; prev = null; continue; }
            let px = sideways ? F.X(v) : s, py = sideways ? s === 0 ? H : H - s : F.Y(v);
            if (sideways) py = H - s;
            const lim = sideways ? W : H;
            const q = sideways ? px : py;
            if (prev != null && Math.abs(q - prev) > lim * 1.2 && (q < -lim || q > 2 * lim || prev < -lim || prev > 2 * lim)) pen = false;   // an asymptote
            const cq = Math.max(-lim * 2, Math.min(lim * 3, q));
            if (sideways) px = cq; else py = cq;
            if (pen) c.lineTo(px, py); else c.moveTo(px, py);
            pen = true; prev = q;
            out.push([px, py]);
        }
        c.stroke();
        return out;
    }
    function drawRow(c, F, o, col, sel) {
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = sel ? 3.6 : 2.8; c.lineJoin = "round"; c.lineCap = "round";
        if (o.kind === "fn" || (o.kind === "fdef" && o.arg === "x")) { curve(c, F, o.f, o.restrictF); return; }
        if (o.kind === "xfn") { curve(c, F, o.f, o.restrictF, true); return; }
        if (o.kind === "pts") {
            o.points.forEach(([x, y]) => {
                if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                const px = F.X(x), py = F.Y(y);
                c.beginPath(); c.arc(px, py, sel ? 6.5 : 5.5, 0, Math.PI * 2); c.fill();
                c.lineWidth = 2; c.strokeStyle = "#fff"; c.stroke();
                marks.push({ px, py, x, y, col, always: true });
            });
            return;
        }
        if (o.kind === "ineq") {
            const strict = o.op === "<" || o.op === ">", up = o.op === ">" || o.op === "≥";
            // shade first, then the edge
            c.globalAlpha = 0.16; c.beginPath();
            if (o.side === "y") {
                const n = Math.ceil(W);
                for (let s = 0; s <= n; s++) { const x = F.x0 + s / F.sc; let v = o.f(x); if (o.restrictF && !o.restrictF(x, v)) continue; if (!Number.isFinite(v)) continue; const py = Math.max(-2, Math.min(H + 2, F.Y(v))); c.rect(s - 0.5, up ? 0 : py, 1.02, up ? py : H - py); }
            } else {
                const n = Math.ceil(H);
                for (let s = 0; s <= n; s++) { const y = F.y0 + (H - s) / F.sc; let v = o.f(y); if (!Number.isFinite(v)) continue; const px = Math.max(-2, Math.min(W + 2, F.X(v))); c.rect(up ? px : 0, s - 0.5, up ? W - px : px, 1.02); }
            }
            c.fill(); c.globalAlpha = 1;
            if (strict) c.setLineDash([9, 7]);
            curve(c, F, o.f, o.restrictF, o.side === "x");
            c.setLineDash([]);
            return;
        }
        if (o.kind === "imp") implicit(c, F, o);
    }
    /** x² + y² = 25 and friends: marching squares on a coarse grid. */
    function implicit(c, F, o) {
        const cell = Math.max(4, Math.round(Math.sqrt(W * H / 9000))), nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1;
        const v = new Float64Array(nx * ny);
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = F.x0 + i * cell / F.sc, y = F.y0 + (H - j * cell) / F.sc; let z = o.f(x, y); if (o.restrictF && !o.restrictF(x, y)) z = NaN; v[j * nx + i] = z; }
        const ineq = o.op !== "=";
        if (ineq) {
            const want = (z) => (o.op === "<" ? z < 0 : o.op === ">" ? z > 0 : o.op === "≤" ? z <= 0 : z >= 0);
            c.globalAlpha = 0.16; c.beginPath();
            for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const z = (v[j * nx + i] + v[j * nx + i + 1] + v[(j + 1) * nx + i] + v[(j + 1) * nx + i + 1]) / 4; if (Number.isFinite(z) && want(z)) c.rect(i * cell, j * cell, cell + 0.4, cell + 0.4); }
            c.fill(); c.globalAlpha = 1;
            if (o.op === "<" || o.op === ">") c.setLineDash([9, 7]);
        }
        c.beginPath();
        const lerp = (a, b) => (a / (a - b));
        for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
            const a = v[j * nx + i], b = v[j * nx + i + 1], d = v[(j + 1) * nx + i], e = v[(j + 1) * nx + i + 1];
            if (![a, b, d, e].every(Number.isFinite)) continue;
            const pts = [];
            if ((a < 0) !== (b < 0)) pts.push([i + lerp(a, b), j]);
            if ((b < 0) !== (e < 0)) pts.push([i + 1, j + lerp(b, e)]);
            if ((d < 0) !== (e < 0)) pts.push([i + lerp(d, e), j + 1]);
            if ((a < 0) !== (d < 0)) pts.push([i, j + lerp(a, d)]);
            for (let q = 0; q + 1 < pts.length; q += 2) { c.moveTo(pts[q][0] * cell, pts[q][1] * cell); c.lineTo(pts[q + 1][0] * cell, pts[q + 1][1] * cell); }
        }
        c.stroke(); c.setLineDash([]);
    }
    /** The selected graph's intercepts and where it crosses the others: gray dots you can tap. */
    function specialPoints(c, F) {
        const i = rows.findIndex((r) => r.id === selId); if (i < 0) return;
        const o = model.rows[i], rw = rows[i]; if (!o || rw.h || !(o.kind === "fn" || (o.kind === "fdef" && o.arg === "x"))) return;
        const a = F.x0, b = F.x0 + W / F.sc, f = (x) => (o.restrictF && !o.restrictF(x, o.f(x)) ? NaN : o.f(x)), pts = [];
        G.zerosOf(f, a, b).forEach((x) => pts.push([x, 0]));
        const y0 = f(0); if (Number.isFinite(y0) && a <= 0 && b >= 0) pts.push([0, y0]);
        model.rows.forEach((q, j) => {
            if (j === i || rows[j].h || !(q.kind === "fn" || (q.kind === "fdef" && q.arg === "x"))) return;
            const g = (x) => (q.restrictF && !q.restrictF(x, q.f(x)) ? NaN : q.f(x));
            G.zerosOf((x) => f(x) - g(x), a, b, 300, 8).forEach((x) => pts.push([x, f(x)]));
        });
        pts.forEach(([x, y]) => {
            const px = F.X(x), py = F.Y(y); if (px < -5 || px > W + 5 || py < -5 || py > H + 5) return;
            c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.fillStyle = "rgba(90,100,120,.95)"; c.fill(); c.lineWidth = 2; c.strokeStyle = "#fff"; c.stroke();
            marks.push({ px, py, x, y, col: "#5A6478" });
        });
    }
    function drawTrace(c, F) {
        const { x, y, col } = trace;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const px = F.X(x), py = F.Y(y);
        c.beginPath(); c.arc(px, py, 7, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = 2.5; c.strokeStyle = "#fff"; c.stroke();
        showTip(px, py, x, y);
    }
    function showTip(px, py, x, y) {
        tip.hidden = false; tip.textContent = "(" + G.fmt(round(x)) + ", " + G.fmt(round(y)) + ")";
        tip.style.left = Math.min(W - 10, Math.max(10, px)) + "px"; tip.style.top = Math.max(8, py - 14) + "px";
    }
    const round = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : +v.toFixed(3));

    /* ---------- touching the graph ---------- */
    const ptrs = new Map();
    let pan = null, pinch = null;
    const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    function hitCurve(q) {
        const F = frame(); let best = null;
        model.rows.forEach((o, i) => {
            const rw = rows[i]; if (!rw || rw.h) return;
            if (o.kind === "fn" || (o.kind === "fdef" && o.arg === "x") || (o.kind === "ineq" && o.side === "y")) {
                const x = F.x0 + q.x / F.sc, y = o.f(x); if (!Number.isFinite(y) || (o.restrictF && !o.restrictF(x, y))) return;
                const d = Math.abs(F.Y(y) - q.y); if (d < 16 && (!best || d < best.d)) best = { d, id: rw.id, f: o.f, col: G.GC_COLS[rw.c] };
            }
        });
        return best;
    }
    cv.addEventListener("pointerdown", (e) => {
        if (e.button) return;
        e.preventDefault(); e.stopPropagation();
        cv.setPointerCapture(e.pointerId);
        ptrs.set(e.pointerId, local(e)); p.busy = true;
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: view.w, cx: view.cx, cy: view.cy, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; pan = null; trace = null; tip.hidden = true; return; }
        const q = local(e);
        const mk = marks.find((m) => Math.hypot(m.px - q.x, m.py - q.y) < 12);
        if (mk) { trace = null; showTip(mk.px, mk.py, mk.x, mk.y); pan = { tap: true }; return; }
        const hit = hitCurve(q);
        if (hit) { selId = hit.id; markSel(); trace = { f: hit.f, col: hit.col, x: frame().x0 + q.x / frame().sc }; trace.y = hit.f(trace.x); draw(); pan = { trace: true }; return; }
        tip.hidden = true; trace = null;
        pan = { x: q.x, y: q.y, cx: view.cx, cy: view.cy, moved: false }; draw();
    });
    cv.addEventListener("pointermove", (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, local(e));
        const F = frame();
        if (pinch && ptrs.size >= 2) {
            const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, f = pinch.d / d;
            const w = clampW(pinch.w * f), sc0 = W / pinch.w, sc1 = W / w;
            const mx = pinch.cx - pinch.w / 2 + pinch.mid.x / sc0, my = pinch.cy + (H / 2 - pinch.mid.y) / sc0;
            view = { w, cx: mx - (pinch.mid.x - W / 2) / sc1, cy: my - (H / 2 - pinch.mid.y) / sc1 };
            draw(); return;
        }
        if (!pan) return;
        const q = local(e);
        if (pan.trace && trace) { trace.x = F.x0 + q.x / F.sc; trace.y = trace.f(trace.x); draw(); return; }
        if (pan.tap) return;
        if (Math.abs(q.x - pan.x) + Math.abs(q.y - pan.y) > 3) pan.moved = true;
        view = { w: view.w, cx: pan.cx - (q.x - pan.x) / F.sc, cy: pan.cy + (q.y - pan.y) / F.sc };
        draw();
    });
    const up = (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch = null;
        if (!ptrs.size) { pan = null; p.busy = false; saveView(); }
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", (e) => {
        e.preventDefault(); e.stopPropagation();
        const q = local(e), f = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.0022)));
        zoomAt(q, f);
    }, { passive: false });
    function clampW(w) { return Math.max(0.01, Math.min(1e5, w)); }
    function zoomAt(q, f) {
        const F = frame(), mx = F.x0 + q.x / F.sc, my = F.y0 + (H - q.y) / F.sc, w = clampW(view.w * f), sc = W / w;
        view = { w, cx: mx - (q.x - W / 2) / sc, cy: my - (H / 2 - q.y) / sc };
        draw(); saveView();
    }
    function zoomBy(f) { zoomAt({ x: W / 2, y: H / 2 }, f); }
    if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(plot);

    /* ---------- from the saved state ---------- */
    p.sync = () => {
        const S = ctx.st(k);
        if (playing) return;
        const focusedId = rows.find((r) => isFocused(r.id));
        rows = S.e.map((r) => Object.assign({}, r));
        if (focusedId && !rows.some((r) => r.id === focusedId.id)) rows.push(focusedId);
        view = Object.assign({}, S.v);
        tidy(); buildRows(); recalc();
    };
    p.onPlace = () => draw();
    return p;
}
