/* ==========================================
   Anchor Board — the student work pad, as its own module.
   A copy of the Vault Raid pad in js/play.js (same look, same math tools), so the live
   notes student page (follow.html) can use it without touching the game page.
   createStudentPad() returns { mount(host), image(), clear(), dirty(), sent(), sentAt(), has(), shown() }.
========================================== */
import { createMathPad } from "./mathPad.js?v=2";
import { wbIcon } from "./wbIcons.js?v=1";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function createStudentPad() {
/* ---------- the work pad ----------
   The same canvas-first whiteboard as the board: paper across most of the screen, a floating
   tool rail, and the math tools (js/mathPad.js) on a layer under the ink. */
  return (() => {
    const W = 1000, PENS = { ink: ["#14213D", "Navy"], blue: ["#1552D6", "Blue"], red: ["#C62828", "Red"], green: ["#1B7F3B", "Green"] }, SIZES = [3, 6, 11];
    let H = 600, strokes = [], items = [], hist = [], host = null, canvas = null, ctx = null, mp = null, cur = null, ro = null;
    let tool = "pen", pen = "ink", size = 1, dirty = false, sentAt = 0;
    function paint() {
        if (!ctx) return; ctx.clearRect(0, 0, W, H); ctx.lineCap = ctx.lineJoin = "round";
        strokes.forEach((s) => {
            ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over"; ctx.globalAlpha = s.h ? 0.35 : 1;
            ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.beginPath(); s.p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            if (s.p.length === 1) ctx.lineTo(s.p[0][0] + 0.1, s.p[0][1]); ctx.stroke();
        });
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }
    const at = (e) => { const r = canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)]; };
    const snap = () => { hist.push(JSON.stringify({ strokes, items: mp ? mp.items() : items })); if (hist.length > 60) hist.shift(); };
    const saved = () => { if (mp) items = mp.items(); dirty = true; };
    function undo() { const last = hist.pop(); if (!last) return; const d = JSON.parse(last); strokes = d.strokes || []; items = d.items || []; if (mp) mp.setItems(items); dirty = true; paint(); }
    /** The paper's shape follows the screen: the width is always 1000, the height follows. */
    function fit() {
        if (!host || !host.isConnected) return; const r = host.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
        const h = Math.max(200, Math.round(W * r.height / r.width)); if (h !== H || canvas.height !== h) { H = h; canvas.height = H; paint(); }
        if (mp) mp.resize();
    }
    function rail() {
        const t = el("div", "wbrail"); t.id = "padrail"; t.setAttribute("role", "toolbar"); t.setAttribute("aria-label", "Work pad tools");
        const moving = !!(mp && mp.on);
        const b = (name, label, on, fn, cls) => { const x = el("button", "rb" + (cls ? " " + cls : "")); x.type = "button"; x.innerHTML = wbIcon(name); x.title = label; x.setAttribute("aria-label", label); if (on != null) x.setAttribute("aria-pressed", String(on)); x.onclick = fn; t.append(x); return x; };
        const pick = (k) => () => { tool = k; if (mp) mp.setOn(false); retool(); };
        b("pen", "Pen", !moving && tool === "pen", pick("pen"));
        b("hi", "Highlighter", !moving && tool === "hi", pick("hi"));
        b("eraser", "Eraser", !moving && tool === "eraser", pick("eraser"));
        b("move", "Move the math tools", moving, () => { if (mp) mp.setOn(!mp.on); retool(); });
        t.append(el("i", "rsep"));
        const sw = el("div", "rsw");
        Object.keys(PENS).forEach((k) => { const x = el("button", "sw"); x.type = "button"; x.style.background = PENS[k][0]; x.title = PENS[k][1] + " pen"; x.setAttribute("aria-label", x.title); x.setAttribute("aria-pressed", String(pen === k)); x.onclick = () => { pen = k; if (tool !== "pen") tool = "pen"; if (mp) mp.setOn(false); retool(); }; sw.append(x); });
        t.append(sw);
        const sz = el("button", "rb size"); sz.type = "button"; sz.title = ["Thin", "Medium", "Thick"][size] + " line (tap to change)"; sz.setAttribute("aria-label", sz.title);
        const dot = el("i"); dot.style.width = dot.style.height = [0.35, 0.6, 0.9][size] + "em"; dot.style.background = tool === "hi" ? "#F2B33D" : pen === "ink" ? "#F4F7FB" : PENS[pen][0]; sz.append(dot);
        sz.onclick = () => { size = (size + 1) % 3; retool(); }; t.append(sz);
        t.append(el("i", "rsep"));
        b("math", "Add a math tool", null, () => { if (mp) mp.openMenu(); }, "amber");
        b("undo", "Undo", null, undo);
        b("trash", "Clear the pad", null, () => { if (!strokes.length && !(mp && mp.items().length)) return; snap(); strokes = []; items = []; if (mp) mp.clear(); dirty = true; paint(); });
        return t;
    }
    function retool() { const old = host && host.querySelector("#padrail"); if (old) old.replaceWith(rail()); }
    function mount(h) {
        host = h; canvas = el("canvas", "padcv"); canvas.width = W; canvas.height = H; canvas.setAttribute("aria-label", "Work pad. Draw your work here."); ctx = canvas.getContext("2d");
        host.append(canvas);
        canvas.onpointerdown = (e) => {
            if (e.button) return; e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
            if (mp) mp.closeMenu(); snap();
            cur = tool === "eraser" ? { e: 1, c: "#000", w: [18, 32, 56][size], p: [at(e)] } : tool === "hi" ? { h: 1, c: "#F2B33D", w: [14, 22, 34][size], p: [at(e)] } : { c: PENS[pen][0], w: SIZES[size], p: [at(e)] };
            strokes.push(cur); paint();
        };
        canvas.onpointermove = (e) => { if (!cur) return; e.preventDefault(); const p = at(e), l = cur.p[cur.p.length - 1]; if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) > 2) { cur.p.push(p); paint(); } };
        canvas.onpointerup = canvas.onpointercancel = () => { if (cur) { cur = null; dirty = true; } };
        mp = createMathPad(host, canvas, { change: snap, commit: saved, onMode: () => retool() });
        mp.setItems(items); host.append(rail());
        if (ro) ro.disconnect();
        if (window.ResizeObserver) { ro = new ResizeObserver(() => fit()); ro.observe(host); }
        requestAnimationFrame(fit); paint();
    }
    /** A picture of the work for the teacher: the math tools under the ink, on white. */
    function image() {
        if (!strokes.length && !(mp ? mp.items() : items).length) return "";
        const c = document.createElement("canvas"); c.width = 640; c.height = Math.round(640 * H / W); const x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        if (mp && mp.el.width) x.drawImage(mp.el, 0, 0, c.width, c.height);
        x.drawImage(canvas, 0, 0, c.width, c.height);
        let url = c.toDataURL("image/png"); if (url.length > 380000) url = c.toDataURL("image/jpeg", 0.7);
        return url.length > 395000 ? c.toDataURL("image/jpeg", 0.45) : url;
    }
    return {
        mount, image,
        clear() { strokes = []; items = []; hist = []; dirty = false; if (mp) mp.clear(); paint(); },
        dirty: () => dirty, sent() { dirty = false; sentAt = Date.now(); }, sentAt: () => sentAt, has: () => strokes.length > 0,
        /** Real work on the pad: pen strokes (not eraser) adding up to more than a quick tap, or math typed in a text box. */
        shown() {
            let len = 0;
            strokes.forEach((s) => { if (s.e) return; for (let i = 1; i < s.p.length; i++) len += Math.hypot(s.p[i][0] - s.p[i - 1][0], s.p[i][1] - s.p[i - 1][1]); });
            return len >= 60 || (mp ? mp.items() : items).some((it) => it.k === "text" && String(it.txt || "").replace(/\s/g, "").length >= 2);
        }
    };
})();
}
