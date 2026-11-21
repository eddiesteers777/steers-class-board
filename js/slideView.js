/* ==========================================
   Anchor Board — drawing a lesson slide (js/slides.js is the model).
   One drawing for every place a slide shows: the board, the Remote's picture, the Board Builder's
   canvas and its little slide pictures. A slide is drawn at 1600 x 900 and scaled to fit (fitSlide).
========================================== */
import { SW, SH, shapePath, textInset, fontOf, fillLive, sanitizeHtml, inkFor, inkOn, GRADS, boxOf } from "./slides.js?v=1";
import { drawItem, geom } from "./mathTools.js?v=1";
import { stickerFace } from "./stickers.js?v=1";
import { parseFigure, figureEl } from "./figures.js?v=1";

const NS = "http://www.w3.org/2000/svg";
function div(cls) { const d = document.createElement("div"); if (cls) d.className = cls; return d; }
function svgEl(tag, attrs) { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k])); return e; }

/* ---------- math in text: {3/4} fractions, x^2 powers, √{49} roots, [[graph …]] pictures ---------- */
export function mathText(s) {
    const src = String(s == null ? "" : s); let i = 0;
    function group(stop) {
        const frag = document.createDocumentFragment(); let buf = "";
        const flush = () => { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ""; } };
        while (i < src.length) {
            const ch = src[i];
            if (stop && stop.includes(ch)) break;
            if (ch === "[" && src[i + 1] === "[") { const f = parseFigure(src, i); if (f) { flush(); frag.appendChild(figureEl(f)); i = f.end; continue; } }
            if (ch === "{") {
                const save = i; i++; const nu = group("/}");
                if (src[i] === "/") { i++; const de = group("}"); if (src[i] === "}") { i++; flush(); const f = document.createElement("span"), a = document.createElement("span"), b = document.createElement("span"); f.className = "slfrac"; a.appendChild(nu); b.appendChild(de); f.append(a, b); frag.appendChild(f); continue; } }
                i = save + 1; buf += "{"; continue;
            }
            if ((ch === "^" || ch === "√") && i + 1 < src.length) {
                const save = i; i++; let arg = null;
                if (src[i] === "{") { i++; arg = group("}"); if (src[i] === "}") i++; else { i = save + 1; buf += ch; continue; } }
                else { const m = /^(-?[0-9.]+|[A-Za-z]|\([^()]*\))/.exec(src.slice(i)); if (m) { arg = document.createTextNode(m[0]); i += m[0].length; } }
                if (!arg) { buf += ch; continue; }
                flush();
                if (ch === "^") { const sup = document.createElement("sup"); sup.appendChild(arg); frag.appendChild(sup); }
                else { const r = document.createElement("span"); r.className = "slroot"; const rad = document.createElement("span"); rad.className = "slrad"; rad.appendChild(arg); r.append("√", rad); frag.appendChild(r); }
                continue;
            }
            buf += ch; i++;
        }
        flush(); return frag;
    }
    return group("");
}
/** Safe slide HTML as nodes: live fields filled in, math drawn. raw: as typed (for editing), nothing filled or drawn. */
export function richNodes(html, live, mark, raw) {
    const t = document.createElement("template");
    t.innerHTML = raw ? sanitizeHtml(html) : fillLive(sanitizeHtml(html), live || {}, mark);
    if (!raw) {
        const walk = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT), list = [];
        for (let n = walk.nextNode(); n; n = walk.nextNode()) if (/[{^√]|\[\[/.test(n.nodeValue)) list.push(n);
        list.forEach((n) => n.parentNode.replaceChild(mathText(n.nodeValue), n));
    }
    return t.content;
}

/* ---------- backgrounds ---------- */
const PAT_LIGHT = "rgba(16,53,138,.16)", PAT_DARK = "rgba(255,255,255,.13)";
export function paintBg(host, bg, o) {
    host.style.background = ""; host.textContent = "";
    if (!bg || bg.t === "board") {
        if (o && o.board) {   // outside the board itself (Board Builder, little pictures): a stand-in for the board's look
            host.style.background = o.board.grad || "";
            if (o.board.cls) { const p = div(o.board.cls); p.setAttribute("aria-hidden", "true"); host.appendChild(p); }
        }
        return;
    }
    if (bg.t === "grad") { const g = (GRADS.find((x) => x[0] === bg.g) || GRADS[0])[2]; host.style.background = "linear-gradient(160deg," + g[0] + " 0%," + g[1] + " 100%)"; }
    else host.style.background = bg.c || "#ffffff";
    if (bg.p) { const p = div("slpat slpat-" + bg.p); p.style.setProperty("--pc", inkFor(bg) === "#14213d" ? PAT_LIGHT : PAT_DARK); host.appendChild(p); }
}

/* ---------- one element ---------- */
function dashOf(d, lw) { return d === "d" ? (lw * 3) + " " + (lw * 2) : d === "o" ? "0.1 " + (lw * 2.2) : ""; }
function drawBox(e, o, ink) {
    const d = div("sle slbx sh-" + e.sh);
    const hasShape = e.fill || (e.ln && e.lw);
    if (hasShape) {
        const s = svgEl("svg", { viewBox: "0 0 " + e.w + " " + e.h, width: e.w, height: e.h, class: "slshape", "aria-hidden": "true", preserveAspectRatio: "none" });
        const p = svgEl("path", { d: shapePath(e.sh, e.w, e.h, e.rd), fill: e.fill || "none", stroke: e.ln && e.lw ? e.ln : "none", "stroke-width": e.lw || 0, "stroke-linejoin": "round", "stroke-linecap": "round" });
        if (e.dash && e.lw) p.setAttribute("stroke-dasharray", dashOf(e.dash, e.lw));
        s.appendChild(p); d.appendChild(s);
    }
    if (e.sd) d.classList.add("slsd");
    const fill = e.fill || "", textInk = e.fc || (fill ? inkOn(fill) : ink);
    let top = 0;
    if (e.hd) {
        const h = div("slhd"), hf = e.hf || "#10358a", rr = e.sh === "round" || e.sh === "rect" ? Math.min(e.rd || 0, e.w / 2) : 0;
        h.textContent = e.hd; h.style.background = hf; h.style.color = e.hc || inkOn(hf);
        const hs = Math.max(22, Math.min(64, Math.round(e.fs * 0.78)));
        h.style.fontSize = hs + "px"; h.style.borderRadius = rr + "px " + rr + "px 0 0"; h.style.fontFamily = fontOf("display");
        top = Math.round(hs * 1.7); h.style.height = top + "px";
        d.appendChild(h);
    }
    const ins = textInset(e.sh), t = div("sltx va-" + e.va);
    t.style.left = Math.round(e.w * ins[0] + e.pad) + "px"; t.style.right = Math.round(e.w * ins[0] + e.pad) + "px";
    t.style.top = Math.round(top + e.h * ins[1] + e.pad) + "px"; t.style.bottom = Math.round(e.h * ins[1] + e.pad) + "px";
    t.style.fontSize = e.fs + "px"; t.style.fontFamily = fontOf(e.ff); t.style.color = textInk; t.style.lineHeight = String(e.lh || 1.2);
    t.style.textAlign = { l: "left", c: "center", r: "right", j: "justify" }[e.al] || "left";
    const inner = div("sltxi");
    if (o.editing === e.id) inner.appendChild(richNodes(e.html, null, false, true));
    else inner.appendChild(richNodes(e.html, o.live, o.mark));
    if (o.edit && !e.html && o.editing !== e.id) { inner.classList.add("slph"); inner.textContent = e.hd ? "Double-click to type" : (hasShape ? "" : "Double-click to type"); }
    t.appendChild(inner); d.appendChild(t);
    return d;
}
function drawLine(e) {
    const b = boxOf(e), m = Math.max(24, e.lw * 4), ox = b.x - m, oy = b.y - m, w = b.w + 2 * m, h = b.h + 2 * m;
    const d = div("sle slln"); d.style.left = ox + "px"; d.style.top = oy + "px"; d.style.width = w + "px"; d.style.height = h + "px";
    const s = svgEl("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, "aria-hidden": "true" });
    const x1 = e.x1 - ox, y1 = e.y1 - oy, x2 = e.x2 - ox, y2 = e.y2 - oy, ang = Math.atan2(y2 - y1, x2 - x1), hl = Math.max(14, e.lw * 3.2);
    const trim = (x, y, a, head) => (head === "arrow" ? [x - Math.cos(a) * hl * 0.6, y - Math.sin(a) * hl * 0.6] : [x, y]);
    const [sx, sy] = trim(x1, y1, ang + Math.PI, e.a1), [ex, ey] = trim(x2, y2, ang, e.a2);
    const ln = svgEl("line", { x1: sx, y1: sy, x2: ex, y2: ey, stroke: e.ln, "stroke-width": e.lw, "stroke-linecap": "round" });
    if (e.dash) ln.setAttribute("stroke-dasharray", dashOf(e.dash, e.lw));
    s.appendChild(ln);
    const head = (x, y, a, kind) => {
        if (kind === "arrow") { const p = [[x, y], [x - Math.cos(a - 0.42) * hl, y - Math.sin(a - 0.42) * hl], [x - Math.cos(a + 0.42) * hl, y - Math.sin(a + 0.42) * hl]]; s.appendChild(svgEl("path", { d: "M" + p.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L") + "Z", fill: e.ln, stroke: e.ln, "stroke-width": Math.max(1, e.lw * 0.4), "stroke-linejoin": "round" })); }
        else if (kind === "dot") s.appendChild(svgEl("circle", { cx: x, cy: y, r: Math.max(6, e.lw * 1.4), fill: e.ln }));
        else if (kind === "bar") { const k = Math.max(10, e.lw * 2.2), nx = -Math.sin(a), ny = Math.cos(a); s.appendChild(svgEl("line", { x1: x + nx * k, y1: y + ny * k, x2: x - nx * k, y2: y - ny * k, stroke: e.ln, "stroke-width": e.lw, "stroke-linecap": "round" })); }
    };
    head(x1, y1, ang + Math.PI, e.a1); head(x2, y2, ang, e.a2);
    d.appendChild(s); return d;
}
function drawTable(e, o, ink) {
    const d = div("sle sltbx"), tb = document.createElement("table"); tb.className = "sltb";
    tb.style.fontSize = e.fs + "px"; tb.style.fontFamily = fontOf(e.ff);
    const cellInk = e.fc || inkOn(e.fill || "#ffffff");
    e.rows.forEach((row, ri) => {
        const tr = document.createElement("tr"); tr.style.height = (100 / e.rows.length) + "%";
        row.forEach((txt, ci) => {
            const head = e.hdr && ri === 0, td = document.createElement(head ? "th" : "td");
            td.style.borderColor = e.bd || "#9fb8d8"; td.style.textAlign = { l: "left", c: "center", r: "right", j: "justify" }[e.al] || "center";
            if (head) { td.style.background = e.hf || "#10358a"; td.style.color = inkOn(e.hf || "#10358a"); }
            else { td.style.background = e.fill || "transparent"; td.style.color = e.fill ? cellInk : (e.fc || ink); }
            td.dataset.r = ri; td.dataset.c = ci;
            if (o.editing === e.id + ":" + ri + ":" + ci) td.textContent = txt; else td.appendChild(mathText(fillLive(txt, o.live || {}, false).replace(/<br>/g, "\n")));
            tr.appendChild(td);
        });
        tb.appendChild(tr);
    });
    d.appendChild(tb); return d;
}
function drawPic(e, o) {
    const d = div("sle slpc"); if (e.sd) d.classList.add("slsd");
    const src = o.img ? o.img(e.img) : "";
    if (src && src !== "x") {
        const im = document.createElement("img"); im.src = src; im.alt = e.alt || ""; im.draggable = false; im.style.objectFit = e.fit || "contain";
        if (e.rd) im.style.borderRadius = e.rd + "px"; if (e.ln && e.lw) im.style.border = e.lw + "px solid " + e.ln;
        d.appendChild(im);
    } else { const p = div("slpcwait"); p.textContent = src === "x" ? "Picture not found" : "Loading picture…"; d.appendChild(p); }
    return d;
}
function drawMath(e, o) {
    const d = div("sle slmt"), cv = document.createElement("canvas"); d.appendChild(cv);
    const k = Math.min(3, Math.max(0.25, (o.scale || 1) * (window.devicePixelRatio || 1))), W = Math.max(8, Math.round(Math.min(2400, e.w * k))), H = Math.max(8, Math.round(Math.min(2400, e.h * k)));
    cv.width = W; cv.height = H; cv.setAttribute("aria-label", e.it.k);
    const draw = () => {
        const ctx = cv.getContext("2d"); if (!ctx) return; ctx.clearRect(0, 0, W, H);
        const g1 = geom(Object.assign({}, e.it, { s: 1 }), W, H, ctx), s = Math.max(0.05, Math.min(0.94, 0.94 * H / Math.max(1, g1.h)));
        drawItem(ctx, Object.assign({}, e.it, { x: 0.5, y: 0.5, r: 0, s }), W, H);
    };
    draw(); if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(draw);
    return d;
}
function drawSticker(e) {
    const d = div("sle slst"), f = stickerFace({ t: e.t, v: e.v, c: e.c || 0 });
    d.style.setProperty("--h", e.h + "px"); d.appendChild(f); return d;
}
function drawLogo(e, o) { const d = div("sle slg"), im = document.createElement("img"); im.src = o.logo || "brand/logo.svg"; im.alt = ""; im.draggable = false; d.appendChild(im); return d; }

/** One element as a node, placed and turned on the slide. o: as renderSlide. ink: the slide's automatic text color. */
export function renderEl(e, o, ink) {
    const n = e.k === "bx" ? drawBox(e, o, ink) : e.k === "ln" ? drawLine(e) : e.k === "tb" ? drawTable(e, o, ink) : e.k === "pc" ? drawPic(e, o) : e.k === "mt" ? drawMath(e, o) : e.k === "st" ? drawSticker(e) : e.k === "lg" ? drawLogo(e, o) : div("sle");
    n.dataset.id = e.id;
    if (e.k !== "ln") { n.style.left = e.x + "px"; n.style.top = e.y + "px"; n.style.width = e.w + "px"; n.style.height = e.h + "px"; if (e.r) n.style.transform = "rotate(" + e.r + "deg)"; }
    if (e.op) n.style.opacity = String(e.op);
    if (e.ap) { n.dataset.ap = e.ap; if (o.edit) { const b = div("slapb"); b.textContent = String(e.ap); b.title = "Shows on Next press " + e.ap; n.appendChild(b); } }
    return n;
}

/**
 * The slide as a node, 1600 x 900, for fitSlide to scale.
 * o.step: how many Nexts have been pressed on this slide (pieces set to appear later stay hidden). Infinity or o.edit: everything.
 * o.fresh: the step just reached (those pieces animate in) · o.live: the lesson's plan for live fields · o.mark: show live fields as live
 * o.img(id): a picture's address ("" while loading, "x" when missing) · o.logo: the board's logo · o.board: { grad, cls } a stand-in for the board's look
 * o.edit: the Board Builder (ids, reveal badges) · o.editing: the element being typed in · o.scale: screen pixels per slide unit (sharp math tools)
 */
export function renderSlide(slide, o) {
    const opt = o || {}, root = div("sl" + (opt.edit ? " sledit" : "")), bg = div("slbg"), layer = div("slels");
    root.style.width = SW + "px"; root.style.height = SH + "px";
    paintBg(bg, slide && slide.bg, opt); root.append(bg, layer);
    const ink = inkFor(slide && slide.bg); root.style.color = ink; root.dataset.ink = ink;
    const step = opt.edit ? Infinity : (opt.step == null ? Infinity : opt.step);
    ((slide && slide.els) || []).forEach((e) => {
        if ((e.ap || 0) > step) return;
        const n = renderEl(e, opt, ink);
        if (!opt.edit && opt.fresh && e.ap === opt.fresh) n.classList.add("slin");
        layer.appendChild(n);
    });
    return root;
}
/**
 * Words that do not fit their box get smaller until they do (down to 40%), like "shrink text on overflow".
 * Live fields fill a different amount of words each day, so a box that fits Monday's agenda still fits Thursday's.
 * Needs the slide on the page (sizes are measured); runs again once the fonts have loaded.
 */
export function fitText(root) {
    if (!root || !root.isConnected) return;
    root.querySelectorAll(".sltx").forEach((t) => {
        const inner = t.firstChild; if (!inner || inner.isContentEditable || inner.querySelector("[contenteditable]")) return;
        const want = +t.dataset.fs || parseFloat(t.style.fontSize) || 32; t.dataset.fs = want;
        t.style.fontSize = want + "px";
        const room = t.clientHeight, roomW = t.clientWidth; if (room < 4) return;
        const fits = () => inner.offsetHeight <= room + 1 && inner.scrollWidth <= roomW + 1;
        if (fits()) return;
        let lo = want * 0.4, hi = want;
        for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; t.style.fontSize = mid + "px"; if (fits()) lo = mid; else hi = mid; }
        t.style.fontSize = Math.floor(lo * 10) / 10 + "px";
    });
}
function fitTextSoon(root) {
    requestAnimationFrame(() => fitText(root));
    if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(() => fitText(root));
}
/** Scale a drawn slide to fit its host, centred; again whenever the host changes size. Returns the scale now. */
export function fitSlide(host, root) {
    fitText(root); fitTextSoon(root);
    const fit = () => {
        const w = host.clientWidth, h = host.clientHeight; if (w < 4 || h < 4) return 0;
        const k = Math.min(w / SW, h / SH);
        root.style.transform = "scale(" + k + ")"; root.style.left = Math.round((w - SW * k) / 2) + "px"; root.style.top = Math.round((h - SH * k) / 2) + "px";
        root.dataset.k = k; return k;
    };
    if (window.ResizeObserver) { if (host._slro) host._slro.disconnect(); host._slro = new ResizeObserver(() => fit()); host._slro.observe(host); }
    return fit();
}
/** A small picture of a slide (the Board Builder's slide list, the Remote). */
export function thumb(slide, o, width) {
    const box = div("slthumb"), w = width || 200, k = w / SW;
    box.style.width = w + "px"; box.style.height = Math.round(SH * k) + "px";
    const r = renderSlide(slide, Object.assign({}, o, { scale: k, thumb: true }));
    r.style.transform = "scale(" + k + ")"; r.style.left = "0"; r.style.top = "0"; box.appendChild(r);
    fitTextSoon(r);   // once the caller has put it on the page
    return box;
}

/**
 * Pictures on slides live in their own saved records (slideimg/<id>), so a lesson's slides stay small.
 * Each one is read once and kept for the visit. src(id): its address, "" while it loads, "x" when it is missing.
 * put(id, url): one just added on this device. onChange(id) runs when one arrives, so the slide can be drawn again.
 * Only the server can say a picture is missing: with no wifi one that is not on this device yet stays
 * "loading" and arrives when the wifi is back. One listener per picture at a time.
 */
export function imageLoader(getStore, onChange) {
    const cache = new Map(), live = new Map(), failed = new Map(); let ver = 0;
    const ok = (d) => typeof d === "string" && d.length < 1200000 && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(d);
    const stop = (un) => { if (un) setTimeout(() => { try { un(); } catch (e) { /* gone */ } }, 0); };
    function src(id) {
        if (typeof id !== "string" || !/^[\w-]{1,24}$/.test(id)) return "x";
        if (cache.has(id)) return cache.get(id);
        if (live.has(id)) return "";
        const f = failed.get(id); if (f && Date.now() - f < 20000) return "";
        let fin = false, un = null;
        const end = (v) => { if (fin) return; fin = true; stop(live.get(id) || un); live.delete(id); if (v !== null) { cache.set(id, v); ver++; } if (onChange) onChange(id); };
        try {
            un = getStore().watch("slideimg/" + id, (snap) => {
                if (fin || snap.pending) return;
                if (!snap.exists && snap.fromCache) return;   // not on this device yet: wait for the server
                end(snap.exists && ok(snap.data && snap.data.d) ? snap.data.d : "x");
            }, () => { if (fin) return; failed.set(id, Date.now()); fin = true; stop(live.get(id) || un); live.delete(id); setTimeout(() => { if (onChange) onChange(id); }, 20000); });   // try again later
            if (fin) stop(un); else live.set(id, un);
        } catch (e) { end("x"); }
        return cache.has(id) ? cache.get(id) : "";
    }
    return { src, put(id, url) { if (ok(url)) { cache.set(id, url); ver++; } }, version: () => ver };
}
