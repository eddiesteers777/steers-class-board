/* ==========================================
   Focal — math tools on a whiteboard (the page side).
   createMathPad(host, ink, opts) puts a second canvas under the ink canvas for the tools,
   and handles Move mode (pick, drag, resize, turn), the Add menu and each tool's settings.
   Nothing here knows about the board's state or saving: the page passes
     opts.change()  called once before an edit (the page keeps its undo copy)
     opts.commit()  called after an edit is finished (the page saves)
   so a student drawing pad can use it the same way.
========================================== */
import { MENU, NAMES, newItem, cleanItems, drawItems, drawSelection, hitItem, hitHandle, dragHandle, compileExpr, parseStep, PLOT } from "./mathTools.js?v=1";

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(text, fn, cls) { const b = el("button", cls, text); b.type = "button"; b.onclick = fn; return b; }

let current = null;   // the newest pad hears Delete and Escape
document.addEventListener("keydown", (e) => { if (current) current.key(e); });

export function createMathPad(host, ink, opts) {
    const o = opts || {};
    const under = el("canvas", "mathlayer"); host.insertBefore(under, ink);
    let ctx = null, items = [], selId = "", on = false, drag = null, panel = null, menu = null, editing = false;
    const sel = () => items.find((x) => x.id === selId) || null;
    const change = () => { if (o.change) o.change(); };
    const commit = () => { if (o.commit) o.commit(); };
    const px = (e) => { const r = ink.getBoundingClientRect(); return [(e.clientX - r.left) * ink.width / r.width, (e.clientY - r.top) * ink.height / r.height]; };

    function resize() {
        const r = ink.getBoundingClientRect(); if (r.width < 2) return;
        under.width = ink.width || Math.round(r.width); under.height = ink.height || Math.round(r.height); ctx = under.getContext("2d"); draw();
    }
    function draw() {
        if (!ctx) return; ctx.clearRect(0, 0, under.width, under.height);
        drawItems(ctx, items, under.width, under.height);
        const s = sel(); if (s && on) drawSelection(ctx, s, under.width, under.height);
    }

    /* ---- Move mode on the ink canvas ---- */
    function down(e) {
        if (!on || e.button) return; e.preventDefault(); e.stopImmediatePropagation(); closeMenu();
        try { ink.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
        const [x, y] = px(e), W = under.width, H = under.height, s = sel();
        if (s) { const part = hitHandle(ctx, s, x, y, W, H); if (part) { drag = { part, id: s.id, moved: false }; return; } }
        const i = hitItem(ctx, items, x, y, W, H);
        if (i < 0) { select(""); return; }
        const it = items[i]; if (it.id !== selId) select(it.id);
        drag = { part: "move", id: it.id, dx: x - it.x * W, dy: y - it.y * H, moved: false };
    }
    function move(e) {
        if (!on || !drag) return; e.preventDefault(); e.stopImmediatePropagation();
        const it = items.find((q) => q.id === drag.id); if (!it) { drag = null; return; }
        const [x, y] = px(e), W = under.width, H = under.height;
        if (!drag.moved) { change(); drag.moved = true; }
        if (drag.part === "move") { it.x = Math.round((x - drag.dx) / W * 10000) / 10000; it.y = Math.round((y - drag.dy) / H * 10000) / 10000; }
        else Object.assign(it, dragHandle(ctx, it, drag.part, x, y, W, H));
        draw();
    }
    function up(e) {
        if (!on || !drag) return; e.stopImmediatePropagation();
        const moved = drag.moved, it = items.find((q) => q.id === drag.id); drag = null;
        if (it) { it.x = Math.min(1.05, Math.max(-0.05, it.x)); it.y = Math.min(1.05, Math.max(-0.05, it.y)); }
        draw(); if (moved) { commit(); showPanel(); }
    }
    // capture phase, so the page's own pen listeners on the same canvas never see a Move-mode touch
    ink.addEventListener("pointerdown", down, true); ink.addEventListener("pointermove", move, true);
    ink.addEventListener("pointerup", up, true); ink.addEventListener("pointercancel", up, true);
    ink.addEventListener("dblclick", (e) => { if (!on) return; const [x, y] = px(e), i = hitItem(ctx, items, x, y, under.width, under.height); if (i >= 0 && items[i].k === "text") { select(items[i].id); const t = panel && panel.querySelector("textarea"); if (t) t.focus(); } });
    current = { key: (e) => {
        if (!on || !host.isConnected || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if ((e.key === "Delete" || e.key === "Backspace") && sel()) { e.preventDefault(); remove(); }
        if (e.key === "Escape") { closeMenu(); select(""); }
    } };

    function select(id) { selId = id; draw(); showPanel(); if (o.onSelect) o.onSelect(sel()); }
    function setOn(v) { on = !!v; host.classList.toggle("moving", on); if (!on) { selId = ""; drag = null; } draw(); showPanel(); }

    function add(key) {
        const it = newItem(key, { x: 0.5, y: 0.5 }); if (!it) return;
        // stagger repeats (tiles mostly) so they do not land on top of each other
        const same = items.filter((q) => q.k === it.k).length; if (same) { it.x += ((same % 6) * 0.03); it.y += ((same % 6) * 0.04); }
        change(); items.push(it); commit(); setOn(true); select(it.id);
        if (o.onMode) o.onMode(true);
    }
    function remove() { const s = sel(); if (!s) return; change(); items = items.filter((q) => q.id !== s.id); selId = ""; draw(); showPanel(); commit(); }
    function copy() { const s = sel(); if (!s) return; const c = cleanItems([s])[0]; c.id = Math.random().toString(36).slice(2, 9); c.x += 0.03; c.y += 0.04; change(); items.push(c); commit(); select(c.id); }
    function edit(fn, live) { const s = sel(); if (!s) return; if (!live || !editing) change(); editing = !!live; fn(s); draw(); commit(); }

    /* ---- the Add menu ---- */
    function closeMenu() { if (menu) { menu.remove(); menu = null; } }
    function openMenu() {
        if (menu) { closeMenu(); return; }
        menu = el("div", "mathmenu"); menu.setAttribute("role", "dialog"); menu.setAttribute("aria-label", "Add a math tool");
        const top = el("div", "mmhead"); top.appendChild(el("b", null, "Add a math tool")); top.appendChild(btn("Close", closeMenu, "mmx")); menu.appendChild(top);
        MENU.forEach(([group, list]) => {
            const g = el("div", "mmgroup"); g.appendChild(el("p", "mmh", group)); const row = el("div", "mmrow");
            list.forEach(([key, name]) => { const b = btn(name, () => { closeMenu(); add(key); }, key.startsWith("tile:") ? "mmtile t" + key.slice(5).replace("-", "n") : ""); row.appendChild(b); });
            g.appendChild(row); menu.appendChild(g);
        });
        host.appendChild(menu);
    }

    /* ---- settings for the picked tool ---- */
    function field(label, value, onInput, attrs) {
        const l = el("label", "mpf"); l.appendChild(el("span", null, label)); const i = el("input"); i.value = value; Object.assign(i, attrs || {});
        i.oninput = () => onInput(i.value, i); i.onfocus = () => { editing = false; }; l.appendChild(i); return l;
    }
    function stepper(label, get, set, min, max) {
        const w = el("div", "mpstep"); w.appendChild(el("span", null, label));
        const v = el("b", null, String(get()));
        w.appendChild(btn("−", () => { const n = Math.max(min, get() - 1); edit((s) => set(s, n)); v.textContent = String(get()); }));
        w.appendChild(v);
        w.appendChild(btn("+", () => { const n = Math.min(max(), get() + 1); edit((s) => set(s, n)); v.textContent = String(get()); }));
        return w;
    }
    function showPanel() {
        if (panel) { panel.remove(); panel = null; }
        const s = sel(); if (!s || !on || drag) return;
        panel = el("div", "mathpanel"); panel.setAttribute("aria-label", NAMES[s.k] + " settings");
        const head = el("div", "mphead"); head.appendChild(el("b", null, NAMES[s.k]));
        head.appendChild(btn("Copy", copy)); head.appendChild(btn("Delete", remove, "danger")); head.appendChild(btn("Done", () => select(""))); panel.appendChild(head);
        const body = el("div", "mpbody");
        if (s.k === "plane") {
            [0, 1, 2].forEach((j) => {
                const l = el("label", "mpf fx"); const dot = el("i"); dot.style.background = PLOT[j]; l.appendChild(dot); l.appendChild(el("span", null, "y ="));
                const i = el("input"); i.value = s.fx[j] || ""; i.placeholder = j === 0 ? "2x + 1" : j === 1 ? "-x/2 + 3" : "x^2 - 4"; i.setAttribute("aria-label", "Graph " + (j + 1) + ", y equals");
                const err = el("em"); i.oninput = () => { let ok = true; try { compileExpr(i.value); } catch (x) { ok = false; err.textContent = x.message || "Can't read that"; } if (ok) err.textContent = ""; edit((q) => { q.fx[j] = i.value.slice(0, 80); }, true); };
                i.onfocus = () => { editing = false; }; l.appendChild(i); l.appendChild(err); body.appendChild(l);
            });
            const pr = el("div", "mprow"); pr.appendChild(el("span", null, "Show"));
            [["−10 to 10", -10, 10, -10, 10], ["−5 to 5", -5, 5, -5, 5], ["0 to 10", 0, 10, 0, 10], ["0 to 20", 0, 20, 0, 20], ["0 to 100", 0, 100, 0, 100]].forEach(([n, a, b, c, d]) => pr.appendChild(btn(n, () => { edit((q) => Object.assign(q, { xmin: a, xmax: b, ymin: c, ymax: d })); showPanel(); })));
            body.appendChild(pr);
            const rr = el("div", "mprow");
            [["x from", "xmin"], ["to", "xmax"], ["y from", "ymin"], ["to", "ymax"]].forEach(([n, k]) => rr.appendChild(field(n, s[k], (v) => { const x = +v; if (v === "" || !Number.isFinite(x)) return; edit((q) => { const t = Object.assign({}, q, { [k]: x }); if (t.xmax > t.xmin && t.ymax > t.ymin) q[k] = x; }, true); }, { type: "number", inputMode: "decimal" })));
            body.appendChild(rr);
        } else if (s.k === "numline") {
            const rr = el("div", "mprow");
            rr.appendChild(field("From", s.min, (v) => { const x = +v; if (v !== "" && Number.isFinite(x)) edit((q) => { if (x < q.max) q.min = x; }, true); }, { type: "number", inputMode: "decimal" }));
            rr.appendChild(field("To", s.max, (v) => { const x = +v; if (v !== "" && Number.isFinite(x)) edit((q) => { if (x > q.min) q.max = x; }, true); }, { type: "number", inputMode: "decimal" }));
            rr.appendChild(field("Count by", s.step, (v, i) => { const ok = parseStep(v); i.classList.toggle("bad", !ok); if (ok) edit((q) => { q.step = v.trim().slice(0, 12); }, true); }, { placeholder: "1, 0.5 or 1/4" }));
            body.appendChild(rr);
            const pr = el("div", "mprow"); pr.appendChild(el("span", null, "Quick"));
            [["−10 to 10", -10, 10, "1"], ["−20 to 20 by 2", -20, 20, "2"], ["0 to 1 by ¼", 0, 1, "1/4"], ["0 to 2 by ½", 0, 2, "1/2"], ["0 to 1 by 0.1", 0, 1, "0.1"], ["−3 to 3 by ⅓", -3, 3, "1/3"]].forEach(([n, a, b, st]) => pr.appendChild(btn(n, () => { edit((q) => Object.assign(q, { min: a, max: b, step: st })); showPanel(); })));
            body.appendChild(pr);
        } else if (s.k === "table") {
            const rr = el("div", "mprow");
            rr.appendChild(stepper("Rows", () => sel().rows, (q, n) => { q.rows = n; }, 1, () => 12));
            rr.appendChild(stepper("Columns", () => sel().cols, (q, n) => { q.cols = n; }, 1, () => 8));
            body.appendChild(rr);
            body.appendChild(field("Top row (commas between)", s.hd, (v) => edit((q) => { q.hd = v.slice(0, 120); }, true), { placeholder: "x, y" }));
        } else if (s.k === "ruler") {
            body.appendChild(stepper("Units", () => sel().n, (q, n) => { q.n = n; }, 2, () => 30));
        } else if (s.k === "fracbar" || s.k === "fraccircle") {
            const rr = el("div", "mprow");
            rr.appendChild(stepper("Parts", () => sel().n, (q, n) => { q.n = n; if (q.sh > n) q.sh = n; }, 1, () => 24));
            rr.appendChild(stepper("Shaded", () => sel().sh, (q, n) => { q.sh = n; }, 0, () => sel().n));
            const lb = btn(s.lab ? "Labels on" : "Labels off", () => { edit((q) => { q.lab = !q.lab; }); lb.textContent = sel().lab ? "Labels on" : "Labels off"; lb.setAttribute("aria-pressed", String(sel().lab)); });
            lb.setAttribute("aria-pressed", String(s.lab)); rr.appendChild(lb); body.appendChild(rr);
        } else if (s.k === "tile") {
            const rr = el("div", "mprow");
            rr.appendChild(btn("Flip sign (+/−)", () => edit((q) => { q.neg = !q.neg; })));
            if (s.t === "x") rr.appendChild(btn("Turn 90°", () => edit((q) => { q.r = ((q.r || 0) + 90) % 360; })));
            rr.appendChild(btn("Make a zero pair", () => { const c = cleanItems([sel()])[0]; c.id = Math.random().toString(36).slice(2, 9); c.neg = !c.neg; c.x += s.t === "x2" ? 0.1 : 0.04; change(); items.push(c); commit(); draw(); }));
            body.appendChild(rr);
        } else if (s.k === "text") {
            const ta = el("textarea"); ta.value = s.txt; ta.rows = 2; ta.placeholder = "Type: 3x + 5 = 20, {3/4}, x^2, √{49}"; ta.setAttribute("aria-label", "Math text");
            ta.oninput = () => edit((q) => { q.txt = ta.value.slice(0, 400); }, true); ta.onfocus = () => { editing = false; };
            body.appendChild(ta);
            const kp = el("div", "mpkeys");
            const ins = (t, back) => { const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value; ta.value = v.slice(0, a) + t + v.slice(b); const p = a + t.length - (back || 0); ta.focus(); ta.setSelectionRange(p, p); editing = false; ta.oninput(); };
            [["Fraction", "{/}", 2], ["Power", "^{}", 1], ["Root", "√{}", 1], ["×", "×"], ["÷", "÷"], ["−", "−"], ["=", " = "], ["≠", "≠"], ["<", " < "], [">", " > "], ["≤", "≤"], ["≥", "≥"], ["π", "π"], ["°", "°"], ["|x|", "||", 1], ["( )", "()", 1]].forEach(([n, t, back]) => kp.appendChild(btn(n, () => ins(t, back))));
            body.appendChild(kp);
            body.appendChild(el("p", "mphint", "Drag the blue corner to make the text bigger."));
        } else if (s.k === "protractor") {
            body.appendChild(el("p", "mphint", "Line up the red dot with the angle's corner. Drag the round handle to turn it."));
        } else {
            body.appendChild(el("p", "mphint", "Drag the blue corner to change its size. Drag the round handle to turn it."));
        }
        if (body.childNodes.length) panel.appendChild(body);
        host.appendChild(panel);
    }

    return {
        el: under,
        get on() { return on; },
        setOn,
        busy: () => !!drag || (!!panel && panel.contains(document.activeElement)),
        items: () => items,
        setItems(arr) { items = cleanItems(arr); if (selId && !sel()) selId = ""; draw(); if (!panel || !panel.contains(document.activeElement)) showPanel(); },
        add, openMenu, closeMenu, resize, draw,
        clear() { items = []; selId = ""; draw(); showPanel(); },
    };
}
