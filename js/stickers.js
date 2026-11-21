/* ==========================================
   Anchor Board — stickers on the board (Board Builder → Stickers).
   Pictures, math symbols and short word badges the teacher puts on the board.
   They live in the shared board state as S.stickers, so the board, the Remote
   and the Board Builder all show the same ones. Only the Board Builder moves them:
   everywhere else they are part of the picture and never catch a tap.

   A sticker: { id, t, v, x, y, s, r, c }
     t  "e" a picture (emoji), "m" a math symbol, "w" words
     v  what it shows (pictures and symbols only from the lists below; words are the teacher's own, 40 letters at most)
     x, y  where its top-left corner sits, in % of the board
     s  size (1 = normal), r  turn in degrees, c  colour of a word badge (0-4)
   Nothing a student could be identified by: no photos, no uploads.
========================================== */
export const STICKER_SETS = [
    ["School", "e", ["🍎", "✏️", "📐", "📏", "📚", "🧮", "🎒", "💡", "🧠", "🔬", "⏰", "📝", "🗂️", "🧩", "🖍️", "🏫"]],
    ["Cheer", "e", ["⭐", "🌟", "🏆", "🥇", "🎉", "🙌", "👍", "💯", "🔥", "🚀", "❤️", "😀", "😎", "🤓", "🥳", "✅"]],
    ["Seasons", "e", ["🍂", "🍁", "🎃", "🦃", "🥧", "❄️", "⛄", "🎄", "🎁", "🌸", "🌷", "☀️", "🌈", "☘️", "💝", "🎆"]],
    ["Sports", "e", ["⚽", "🏈", "🏀", "⚾", "🏐", "🏃", "🏅", "🥅", "🎯", "🏁"]],
    ["Math", "m", ["π", "√", "∞", "Σ", "÷", "×", "+", "−", "=", "≠", "≤", "≥", "x²", "½", "%", "∠", "△", "°", "y = mx + b", "a² + b² = c²"]],
];
export const WORDS = ["Great job!", "Quiet please", "Test today", "Show your work", "Ask 3 before me", "You've got this!", "Happy Friday!",
    "Phones away", "Check your answer", "Be kind", "Welcome back!", "Eyes up here", "Pencils down", "Grab a calculator"];
export const WORD_COLORS = [["Amber", "#F2B33D", "#2A1C00"], ["Sky", "#7FAEDD", "#081B45"], ["Paper", "#F6F9FD", "#0E1B3A"], ["Green", "#3FB37F", "#04261A"], ["Pink", "#F28DA6", "#3A0A18"]];
export const MAX_STICKERS = 24;

const OK = new Set(STICKER_SETS.flatMap(([, t, list]) => list.map((v) => t + v)));
const num = (v, a, b, d) => { const n = +v; return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const r1 = (n) => Math.round(n * 10) / 10;
export const newId = () => Math.random().toString(36).slice(2, 10);

export function cleanSticker(o) {
    if (!o || typeof o !== "object") return null;
    const t = ["e", "m", "w"].includes(o.t) ? o.t : "", v = typeof o.v === "string" ? o.v : "";
    if (!t || !v) return null;
    if (t === "w") { if (!v.trim()) return null; } else if (!OK.has(t + v)) return null;
    const out = { id: typeof o.id === "string" && /^[\w-]{1,12}$/.test(o.id) ? o.id : newId(), t, v: t === "w" ? v.trim().slice(0, 40) : v,
        x: r1(num(o.x, 0, 96, 40)), y: r1(num(o.y, 0, 94, 40)), s: Math.round(num(o.s, 0.4, 4, 1) * 100) / 100, r: Math.round(num(o.r, -180, 180, 0)) };
    if (t === "w") out.c = Math.floor(num(o.c, 0, WORD_COLORS.length - 1, 0));
    return out;
}
export function cleanStickers(a) { return Array.isArray(a) ? a.map(cleanSticker).filter(Boolean).slice(0, MAX_STICKERS) : []; }

/** A new sticker lands in the header strip, right of the day's title, where the lesson has the most room;
    each next one a step further along so it never lands on the last. */
export function makeSticker(t, v, list, c) {
    const n = (list || []).length, x = 44 + (n % 6) * 7 + Math.floor(n / 6) * 2, y = 3 + Math.floor(n / 6) % 3 * 4;
    return cleanSticker({ id: newId(), t, v, x, y, s: t === "w" ? 1 : 1.2, r: t === "w" ? -3 : 0, c: c || 0 });
}

/** The sticker itself, without any handles (also used for the picker tiles). */
export function stickerFace(st) {
    const f = document.createElement("span");
    f.className = "stkf stk-" + st.t + (st.t === "m" && st.v.length > 3 ? " long" : "");
    f.textContent = st.v;
    if (st.t === "w") { const c = WORD_COLORS[st.c || 0] || WORD_COLORS[0]; f.style.background = c[1]; f.style.color = c[2]; }
    return f;
}

let drawn = "";
/**
 * Draw the stickers into the board's sticker layer.
 * opts.edit: the Board Builder, where stickers can be picked, moved, sized, turned and removed.
 * opts.sel / opts.onSelect(id) / opts.onChange(list) / opts.busy(bool) for that mode.
 */
export function renderStickers(layer, list, opts) {
    if (!layer) return;
    const o = opts || {}, sig = JSON.stringify([list, !!o.edit, o.sel || ""]);
    if (sig === drawn && layer.childElementCount === list.length) return; drawn = sig;
    const ae = document.activeElement, keep = ae && layer.contains(ae) && ae.dataset ? ae.dataset.id : "";   // keyboard users keep their sticker
    layer.textContent = "";
    list.forEach((st) => {
        const w = document.createElement("div"); w.className = "stk" + (o.edit && o.sel === st.id ? " sel" : ""); w.dataset.id = st.id;
        w.style.left = st.x + "%"; w.style.top = st.y + "%"; w.style.fontSize = st.s + "em"; w.style.transform = "rotate(" + st.r + "deg)";
        w.appendChild(stickerFace(st));
        if (o.edit) {
            w.tabIndex = 0; w.setAttribute("role", "button"); w.setAttribute("aria-label", "Sticker " + st.v + ". Drag to move.");
            const del = document.createElement("button"); del.type = "button"; del.className = "stkx"; del.setAttribute("aria-label", "Remove sticker"); del.textContent = "×";
            const size = document.createElement("span"); size.className = "stkg stks"; size.title = "Drag to make it bigger or smaller";
            const turn = document.createElement("span"); turn.className = "stkg stkt"; turn.title = "Drag to turn it";
            w.append(del, size, turn);
            del.onclick = (e) => { e.stopPropagation(); o.onChange(list.filter((x) => x.id !== st.id)); };
            w.addEventListener("pointerdown", (e) => dragSticker(e, w, st, layer, list, o));
            w.addEventListener("keydown", (e) => keySticker(e, st, list, o));
        }
        layer.appendChild(w);
        if (keep && keep === st.id) w.focus({ preventScroll: true });
    });
}
function dragSticker(e, w, st, layer, list, o) {
    if (e.button || e.target.closest(".stkx")) return;
    e.preventDefault(); e.stopPropagation(); if (o.busy) o.busy(true); if (o.onSelect) o.onSelect(st.id);
    const kind = e.target.classList.contains("stks") ? "size" : e.target.classList.contains("stkt") ? "turn" : "move";
    const R = layer.getBoundingClientRect(), b = w.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const sx = e.clientX, sy = e.clientY, cur = Object.assign({}, st), d0 = Math.hypot(sx - cx, sy - cy) || 1, a0 = Math.atan2(sy - cy, sx - cx);
    let moved = false; w.classList.add("moving");
    const move = (ev) => {
        moved = true;
        if (kind === "move") {
            cur.x = r1(Math.min(96, Math.max(0, st.x + (ev.clientX - sx) / R.width * 100))); cur.y = r1(Math.min(94, Math.max(0, st.y + (ev.clientY - sy) / R.height * 100)));
            w.style.left = cur.x + "%"; w.style.top = cur.y + "%";
        } else if (kind === "size") {
            cur.s = Math.round(Math.min(4, Math.max(0.4, st.s * Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0)) * 100) / 100; w.style.fontSize = cur.s + "em";
        } else {
            let r = st.r + (Math.atan2(ev.clientY - cy, ev.clientX - cx) - a0) * 180 / Math.PI; r = ((r + 540) % 360) - 180;
            if (Math.abs(r) < 4) r = 0;   // a little pull to straight
            cur.r = Math.round(r); w.style.transform = "rotate(" + cur.r + "deg)";
        }
    };
    const end = () => {
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
        w.classList.remove("moving"); if (o.busy) o.busy(false);
        if (moved) o.onChange(list.map((x) => (x.id === st.id ? cur : x)));
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
}
/* Keyboard: arrows move, + and - size, [ and ] turn, Delete removes. */
function keySticker(e, st, list, o) {
    const step = e.shiftKey ? 5 : 1, c = Object.assign({}, st);
    if (e.key === "ArrowLeft") c.x -= step; else if (e.key === "ArrowRight") c.x += step; else if (e.key === "ArrowUp") c.y -= step; else if (e.key === "ArrowDown") c.y += step;
    else if (e.key === "+" || e.key === "=") c.s *= 1.1; else if (e.key === "-") c.s /= 1.1; else if (e.key === "[") c.r -= 15; else if (e.key === "]") c.r += 15;
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); o.onChange(list.filter((x) => x.id !== st.id)); return; }
    else return;
    e.preventDefault(); e.stopPropagation(); o.onChange(list.map((x) => (x.id === st.id ? cleanSticker(c) : x)));
}
