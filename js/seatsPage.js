/* ==========================================
   Anchor Board — the seating chart editor (seats.html).
   Two modes: "Seat students" (drag names onto desks, swap, fill, shuffle) and
   "Arrange room" (layouts, add/move/turn/copy/remove desks and furniture).
   Everything saves on its own to teacher/{uid}/seats/chart, and the board's
   Seating Chart screen follows it live. Rosters come from rosters/all.
   ?demo uses made-up names and a this-tab store: nothing is saved.
========================================== */
import { ROOM, KINDS, TEMPLATES, MIN, SAVED_MAX, FOLDER_MAX, perFolder, cleanSaved, isSeat, sizeOf, uid, snap, cleanChart, cleanPeriod, seatList, seatCount, drawRoom } from "./seats.js?v=7";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const Q = new URLSearchParams(location.search), DEMO = Q.has("demo");
const PAGE = Math.random().toString(36).slice(2, 10);
const DEMO_NAMES = ["Ava R.", "Liam T.", "Mia C.", "Noah B.", "Zoe K.", "Eli W.", "Nora P.", "Jalen M.", "Ivy S.", "Owen D.", "Lucy H.", "Mason G.", "Ruby F.", "Caleb J.", "Stella N.", "Isaiah L.", "Hazel A.", "Wyatt E.", "Maya O.", "Grayson V.", "Layla Q.", "Kai Z."];

let store, PERIODS = [], ROSTERS = {}, chart = cleanChart(null);
let eachTurn = false;   // a group turns as a whole (false) or each item turns where it stands (true)
let per = "1st", mode = "seat", sels = new Set(), pick = null, flip = false, loaded = false;
const undo = {}, redo = {};
try { flip = localStorage.getItem("anchor:seatsFlip") === "1"; } catch (e) { /* storage off */ }

const selItems = () => P().items.filter((x) => sels.has(x.id));
const prune = () => { const ids = new Set(P().items.map((x) => x.id)); [...sels].forEach((id) => { if (!ids.has(id)) sels.delete(id); }); };
const P = () => (chart.periods[per] || (chart.periods[per] = cleanPeriod(null)));
const roster = () => (ROSTERS[per] || []).slice();
const seatedNames = () => new Set(Object.values(P().seats));
const status = (t, st) => { const s = $("status"); s.textContent = t; s.dataset.state = st || (/^(Live|Saved|Sample)/.test(t) ? "ok" : /Could not/.test(t) ? "bad" : "wait"); };

/* ---------- saving ---------- */
let saveT = 0, saving = false, again = false;
function save() {
    clearTimeout(saveT); status("Saving…", "wait");
    saveT = setTimeout(async function go() {
        if (saving) { again = true; return; }
        saving = true; chart.at = Date.now(); chart.by = PAGE;
        try { await store.save("seats/chart", JSON.parse(JSON.stringify(chart))); status(DEMO ? "Sample, nothing is saved" : "Saved"); }
        catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
        saving = false; if (again) { again = false; go(); }
    }, 450);
}
let SAVED = { folders: [], list: [] };
let fview = null; // the saved-layouts folder that is open, or null for all folders
const locked = () => !!P().lock;
function lockedNote() { toast("This chart is locked. Tap Locked at the top to unlock it."); const b = $("lockBtn"); b.classList.remove("nudge"); void b.offsetWidth; b.classList.add("nudge"); }
/** Every change goes through here: one undo step, redraw, save. A locked chart refuses every change. */
function change(fn) {
    if (locked()) { lockedNote(); render(); return; }
    const before = JSON.stringify(P());
    fn();
    const after = JSON.stringify(P()); if (after === before) { render(); return; }
    (undo[per] = undo[per] || []).push(before); if (undo[per].length > 80) undo[per].shift(); redo[per] = [];
    P().at = Date.now(); render(); save();
}
function stepHist(from, to) {
    if (locked()) { lockedNote(); return; }
    const a = from[per]; if (!a || !a.length) return;
    (to[per] = to[per] || []).push(JSON.stringify(P())); chart.periods[per] = cleanPeriod(JSON.parse(a.pop()));
    prune();
    render(); save();
}

/* ---------- seat moves ---------- */
const seatOf = (name) => Object.keys(P().seats).find((k) => P().seats[k] === name);
function place(name, key) {
    const s = P().seats, from = seatOf(name), other = s[key];
    if (from === key) return;
    if (from) delete s[from];
    if (other && other !== name) { if (from) s[from] = other; else delete s[key]; }
    s[key] = name;
}
function unseat(name) { const k = seatOf(name); if (k) delete P().seats[k]; }
const shuffled = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function fill(names) { const open = seatList(P()).filter((s) => !P().seats[s.key]); names.forEach((n, i) => { if (open[i]) P().seats[open[i].key] = n; }); }

/* ---------- drawing ---------- */
function render() {
    document.querySelectorAll(".se-mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    $("seatPane").hidden = mode !== "seat"; $("roomPane").hidden = mode !== "room";
    $("flipBtn").setAttribute("aria-pressed", String(flip));
    $("undo").disabled = !(undo[per] || []).length; $("redo").disabled = !(redo[per] || []).length;
    { const lk = locked(); $("lockBtn").setAttribute("aria-pressed", String(lk)); $("lockTxt").textContent = lk ? "Locked" : "Lock"; $("lockShackle").setAttribute("d", lk ? "M8 11V7a4 4 0 0 1 8 0v4" : "M8 11V7a4 4 0 0 1 7.5-2");
        document.body.classList.toggle("se-locked", lk); }
    $("showBoard").href = "remote.html?screen=seats&period=" + encodeURIComponent(per);
    const p = P(), r = roster(), seated = seatedNames(), seats = seatCount(p);
    $("title").textContent = per + " period";
    $("sub").textContent = !p.items.length ? "No room yet. Pick a layout to start." : seats + " seats · " + [...seated].filter((n) => r.includes(n)).length + " of " + r.length + " students seated";
    // the room
    const host = $("stageHost"); host.textContent = "";
    if (!p.items.length) {
        const e = el("div", "seatempty"); e.appendChild(el("h2", null, "Set up the room for " + per + " period")); e.appendChild(el("p", null, "Start from a layout, then move the desks to match your room. Or copy a room you already made for another period."));
        const go = el("a", null, "Pick a layout"); go.href = "#"; go.onclick = (ev) => { ev.preventDefault(); mode = "room"; render(); }; e.appendChild(go);
        host.appendChild(e);
    } else {
        const room = drawRoom(host, p, { edit: true, flip, roster: r, sel: mode === "room" ? sels : null, count: mode === "seat" });
        room.classList.add(mode); if (locked()) { room.classList.add("locked"); const t = el("div", "srlock", "Locked"); room.appendChild(t); }
        if (mode === "seat" && pick) { const k = seatOf(pick); const c = k && room.querySelector('[data-seat="' + k + '"]'); if (c) c.classList.add("picked"); }
        if (mode === "room" && sels.size === 1) {   // one item: a handle on every corner and side, and one to turn it
            const s = room.querySelector('[data-id="' + [...sels][0] + '"]');
            if (s) { ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((h) => { const g = el("div", "srgrab g-" + h); g.dataset.grab = h; s.appendChild(g); });
                const t = el("div", "srturn"); t.dataset.turn = "1"; t.title = "Drag to turn"; s.appendChild(t); }
        }
        bindRoom(room);
    }
    // the tray
    const tray = $("tray"); tray.textContent = "";
    const out = r.filter((n) => !seated.has(n)).sort((a, b) => a.localeCompare(b));
    out.forEach((n) => { const c = el("button", "se-chip", n); c.type = "button"; c.dataset.name = n; c.setAttribute("aria-pressed", String(pick === n)); tray.appendChild(c); bindChip(c, n); });
    if (!r.length) tray.appendChild(el("p", "se-hint", DEMO ? "" : "No class list for " + per + " period yet. Add it on the Rosters page."));
    else if (!out.length) tray.appendChild(el("p", "se-done", "Everyone has a seat."));
    $("trayCount").textContent = String(out.length);
    const gone = [...seated].filter((n) => !r.includes(n));
    $("trayHint").textContent = (pick ? "Now tap a desk for " + pick + ". " : "Drag a name onto a desk, or tap a name and then a desk. Drag a seated student onto someone else to swap them. ")
        + (gone.length ? gone.length + " seated name" + (gone.length > 1 ? "s are" : " is") + " not on the class list (dashed red). Drag them back here to remove." : "")
        + (out.length > seats - seated.size && p.items.length ? " There are more students than open seats: add desks in Arrange room." : "");
    // the selected item's bar
    const many = mode === "room" ? selItems() : [], it = many.length === 1 ? many[0] : null;
    $("selBar").hidden = !many.length;
    if (many.length) {
        const K = it ? KINDS[it.k] : null;
        $("selName").textContent = it ? K.n : many.length + " selected";
        $("rotL").title = "Turn left (Shift+R)"; $("rotR").title = "Turn right (R)";
        $("eachBtn").hidden = many.length < 2; $("eachBtn").setAttribute("aria-pressed", String(eachTurn)); $("eachBtn").textContent = eachTurn ? "Each turns in place" : "Turns as a group";
        $("labWrap").hidden = !(K && K.edit); if (K && K.edit && document.activeElement !== $("labIn")) $("labIn").value = typeof it.label === "string" ? it.label : K.label;
    }
    $("foot").textContent = mode === "room" ? "Drag to move. Drag a box around desks (or Shift-click) to pick several, then move or turn them together. Pull any corner or side to resize, or the round handle to turn. R turns, arrows nudge, Delete removes, Ctrl+A picks everything. Hold Alt to skip the grid." : (flip ? "Teacher view: the front of the room is at the bottom, as you see it from your desk. The board always shows the students' view." : "Students' view: the front of the room is at the top, the way the class sees it on the board.");
}

/* ---------- pointer work: one drag helper for everything ---------- */
function roomPt(room, e) {
    const r = room.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width * ROOM.W, y = (e.clientY - r.top) / r.height * ROOM.H;
    if (flip) { x = ROOM.W - x; y = ROOM.H - y; }
    return { x, y };
}
function drag(e, h) {   // h: { move(ev, dx, dy), up(ev, moved), tap(ev) }
    const sx = e.clientX, sy = e.clientY; let moved = false;
    const mv = (ev) => { if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return; moved = true; ev.preventDefault(); h.move && h.move(ev, ev.clientX - sx, ev.clientY - sy); };
    const up = (ev) => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); if (moved) h.up && h.up(ev); else h.tap && h.tap(ev); };
    document.addEventListener("pointermove", mv, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
}
let ghost = null;
function ghostOn(text) { ghostOff(); ghost = el("div", "se-ghost", text); document.body.appendChild(ghost); }
function ghostAt(ev) { if (ghost) ghost.style.translate = ev.clientX + "px " + ev.clientY + "px"; }
function ghostOff() { if (ghost) ghost.remove(); ghost = null; }
function targetAt(ev) {
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!hit) return null;
    const c = hit.closest(".scell[data-seat]"); if (c) return { seat: c.dataset.seat, el: c };
    const t = hit.closest("#tray, .se-side"); if (t) return { tray: true, el: $("tray") };
    return null;
}
let overEl = null;
function hover(t) { if (overEl) overEl.classList.remove("drop", "over"); overEl = t ? t.el : null; if (overEl) overEl.classList.add(t.tray ? "over" : "drop"); }

/** A name dragged from the tray or from a seat. */
function nameDrag(e, name, fromEl, tap) {
    drag(e, {
        move(ev) { if (!ghost) { ghostOn(name); if (fromEl) fromEl.classList.add("from"); } ghostAt(ev); hover(targetAt(ev)); },
        up(ev) { const t = targetAt(ev); hover(null); ghostOff(); if (fromEl) fromEl.classList.remove("from"); pick = null;
            if (t && t.seat) change(() => place(name, t.seat)); else if (t && t.tray) change(() => unseat(name)); else render(); },
        tap: tap || (() => { pick = pick === name ? null : name; render(); }),
    });
}
function bindChip(c, name) { c.addEventListener("pointerdown", (e) => { if (e.button) return; e.preventDefault(); if (locked()) { lockedNote(); return; } nameDrag(e, name, null); }); }

function bindRoom(room) {
    room.addEventListener("pointerdown", (e) => {
        if (e.button) return;
        if (locked()) { if (e.target.closest(".sit")) lockedNote(); return; }
        if (mode === "seat") {
            const c = e.target.closest(".scell[data-seat]"); if (!c) return;
            e.preventDefault(); const key = c.dataset.seat, name = P().seats[key];
            const tap = () => {   // a tap on a desk: seat the picked name there, or pick up whoever sits there
                if (pick && pick !== name) { const n = pick; pick = null; change(() => place(n, key)); }
                else if (name) { pick = pick === name ? null : name; render(); }
            };
            if (name) nameDrag(e, name, c, tap); else drag(e, { tap });
            return;
        }
        // Arrange room
        const s = e.target.closest(".sit");
        if (!s) { marquee(e, room); return; }
        e.preventDefault();
        const it = P().items.find((x) => x.id === s.dataset.id); if (!it) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {   // add to or take out of the selection
            if (sels.has(it.id)) sels.delete(it.id); else sels.add(it.id);
            drag(e, { tap() { render(); }, up() { render(); } }); render(); return;
        }
        const grab = e.target.closest("[data-grab]"), turn = e.target.closest("[data-turn]");
        if (!sels.has(it.id)) { sels = new Set([it.id]); room.querySelectorAll(".sit.sel").forEach((x) => x.classList.remove("sel")); s.classList.add("sel"); }
        const before = JSON.stringify(P()), r = room.getBoundingClientRect(), k = ROOM.W / r.width * (flip ? -1 : 1);
        const commit = () => { const after = JSON.stringify(P()); chart.periods[per] = cleanPeriod(JSON.parse(before)); change(() => { chart.periods[per] = cleanPeriod(JSON.parse(after)); }); };
        const place1 = (x, d) => { const w = sizeOf(x), vx = flip ? ROOM.W - x.x - w.w : x.x, vy = flip ? ROOM.H - x.y - w.h : x.y;
            d.style.left = (vx / ROOM.W * 100) + "%"; d.style.top = (vy / ROOM.H * 100) + "%"; d.style.width = (w.w / ROOM.W * 100) + "%"; d.style.height = (w.h / ROOM.H * 100) + "%";
            const rr = (x.r + (flip ? 180 : 0)) % 360; d.style.transform = rr ? "rotate(" + rr + "deg)" : ""; };
        if (turn) {   // turn around its centre, following the pointer
            const sz = sizeOf(it), cx = it.x + sz.w / 2, cy = it.y + sz.h / 2;
            drag(e, { move(ev) { const pt = roomPt(room, ev); let a = Math.atan2(pt.y - cy, pt.x - cx) * 180 / Math.PI + 90; if (!ev.altKey) a = Math.round(a / 15) * 15; it.r = ((Math.round(a) % 360) + 360) % 360; s.classList.add("drag"); place1(it, s); }, up: commit });
            return;
        }
        if (grab) {   // resize from any corner or side: the opposite side stays put
            const h = grab.dataset.grab, sx = h.includes("e") ? 1 : h.includes("w") ? -1 : 0, sy = h.includes("s") ? 1 : h.includes("n") ? -1 : 0;
            const sz = sizeOf(it), c0 = { x: it.x + sz.w / 2, y: it.y + sz.h / 2 }, a = it.r * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
            drag(e, { move(ev, dx, dy) {
                const ux = dx * k, uy = dy * k, lx = ux * cos + uy * sin, ly = -ux * sin + uy * cos;   // the pull, in the item's own frame
                let w = sz.w + sx * lx, hh = sz.h + sy * ly;
                if (!ev.altKey) { w = snap(w); hh = snap(hh); }
                w = Math.max(MIN.w, Math.min(ROOM.W, w)); hh = Math.max(MIN.h, Math.min(ROOM.H, hh));
                const ox = sx * (w - sz.w) / 2, oy = sy * (hh - sz.h) / 2, cx = c0.x + ox * cos - oy * sin, cy = c0.y + ox * sin + oy * cos;
                it.w = Math.round(w); it.h = Math.round(hh); it.x = Math.round(cx - w / 2); it.y = Math.round(cy - hh / 2);
                s.classList.add("drag"); place1(it, s);
            }, up: commit, tap() { render(); } });
            return;
        }
        // move everything that is selected together
        const group = selItems().map((x) => ({ x, ox: x.x, oy: x.y, d: room.querySelector('[data-id="' + x.id + '"]') })), lead = group.find((g) => g.x === it);
        drag(e, {
            move(ev, dx, dy) {
                let ux = dx * k, uy = dy * k;
                if (!ev.altKey) { ux = snap(lead.ox + ux) - lead.ox; uy = snap(lead.oy + uy) - lead.oy; }   // the desk under the pointer snaps; the rest keep their spacing
                group.forEach((g) => { const w = sizeOf(g.x); g.x.x = Math.max(-w.w / 2, Math.min(ROOM.W - w.w / 2, g.ox + ux)); g.x.y = Math.max(-w.h / 2, Math.min(ROOM.H - w.h / 2, g.oy + uy)); if (g.d) { g.d.classList.add("drag"); place1(g.x, g.d); } });
            },
            up: commit,
            tap() { if (sels.size > 1) sels = new Set([it.id]); render(); },
        });
    });
}
/** Drag a box on the floor to pick everything whose middle is inside it. Shift adds to what is picked. */
function marquee(e, room) {
    e.preventDefault();
    const add = e.shiftKey || e.ctrlKey || e.metaKey, start = new Set(add ? sels : []), r = room.getBoundingClientRect();
    const box = el("div", "srbox"); room.appendChild(box);
    const x0 = e.clientX - r.left, y0 = e.clientY - r.top;
    drag(e, {
        move(ev) {
            const x1 = Math.max(0, Math.min(r.width, ev.clientX - r.left)), y1 = Math.max(0, Math.min(r.height, ev.clientY - r.top));
            const L = Math.min(x0, x1), T = Math.min(y0, y1), W = Math.abs(x1 - x0), H = Math.abs(y1 - y0);
            Object.assign(box.style, { left: L + "px", top: T + "px", width: W + "px", height: H + "px" });
            sels = new Set(start);
            room.querySelectorAll(".sit").forEach((d) => { const b = d.getBoundingClientRect(), cx = b.left + b.width / 2 - r.left, cy = b.top + b.height / 2 - r.top;
                const inside = cx >= L && cx <= L + W && cy >= T && cy <= T + H; if (inside) sels.add(d.dataset.id); d.classList.toggle("sel", sels.has(d.dataset.id)); });
        },
        up() { box.remove(); render(); },
        tap() { box.remove(); if (!add) sels = new Set(); render(); },
    });
}

/* ---------- Arrange room: layouts and the palette ---------- */
function buildTemplates() {
    const host = $("templates"); host.textContent = "";
    TEMPLATES.forEach((t) => {
        const items = t.make(), n = seatCount({ items }), b = el("button"); b.type = "button";
        drawRoom(b, cleanPeriod({ items, seats: {} }), {});
        b.appendChild(el("b", null, t.n)); b.appendChild(el("small", null, n ? n + " seats" : "Board, desk and door"));
        b.onclick = () => {
            if (locked()) { lockedNote(); return; }
            const had = Object.keys(P().seats).length;
            change(() => { const keep = seatList(P()).map((s) => P().seats[s.key]).filter(Boolean); P().items = t.make().map((x) => Object.assign({}, x)); P().seats = {}; fill(keep); });
            sels = new Set();
            toast(had ? "New layout. Everyone kept a seat, front row first. Undo puts the old room back." : "Layout added. Move desks to match your room, then Seat students.");
        };
        host.appendChild(b);
    });
}
function buildPalette() {
    const host = $("palette"); host.textContent = ""; let g = "";
    Object.keys(KINDS).forEach((k) => {
        const K = KINDS[k];
        if (K.g !== g) { g = K.g; host.appendChild(el("p", "pg", g === "Desks" ? "Desks and tables" : "Around the room")); }
        const b = el("button"); b.type = "button";
        const ic = el("i"), sw = el("span"), sc = 26 / Math.max(K.w, K.h * 1.2);
        sw.style.width = Math.max(6, K.w * sc) + "px"; sw.style.height = Math.max(4, K.h * sc) + "px"; if (K.round) sw.style.borderRadius = "50%";
        if (k === "board") sw.style.background = "#173F86"; if (k === "teacher") sw.style.background = "#E9D8B4"; if (k === "tchair") { sw.style.background = "#E9D8B4"; sw.style.borderColor = "#C9A86A"; sw.style.borderTopWidth = "4px"; } if (k === "door") sw.style.background = "#C08A3E"; if (k === "rug") sw.style.background = "#F8E3B6"; if (k === "lamp") { sw.style.background = "radial-gradient(circle,#FFF8E1 0 30%,#FFD36B 31% 60%,#F2B33D 61%)"; sw.style.borderColor = "#D79A22"; }
        ic.appendChild(sw); b.appendChild(ic); b.appendChild(el("span", null, K.n));
        b.addEventListener("pointerdown", (e) => {
            if (e.button) return; e.preventDefault();
            drag(e, {
                move(ev) { if (!ghost) ghostOn(K.n); ghostAt(ev); },
                up(ev) { ghostOff(); const room = document.querySelector("#stageHost .seatroom"); if (!room) return add(k); const r = room.getBoundingClientRect();
                    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return; const pt = roomPt(room, ev); add(k, pt.x, pt.y); },
                tap() { add(k); },
            });
        });
        host.appendChild(b);
    });
}
function add(k, cx, cy) {
    if (locked()) { lockedNote(); return; }
    const K = KINDS[k], n = P().items.length;
    if (cx == null) { cx = ROOM.W / 2 + ((n % 5) - 2) * 30; cy = ROOM.H / 2 + ((n % 3) - 1) * 30; }
    const it = { id: uid(), k, x: snap(cx - K.w / 2), y: snap(cy - K.h / 2), r: 0 };
    if (K.edit && K.label) it.label = K.label;
    change(() => P().items.push(it)); sels = new Set([it.id]); mode = "room"; render();
}
/** Turn what is selected by d degrees. One item turns in place; a group turns as a whole around its middle. */
function rotate(d) {
    const many = selItems(); if (!many.length) return;
    const cs = many.map((x) => { const w = sizeOf(x); return { x, w, cx: x.x + w.w / 2, cy: x.y + w.h / 2 }; });
    const gx = cs.reduce((t, c) => t + c.cx, 0) / cs.length, gy = cs.reduce((t, c) => t + c.cy, 0) / cs.length, a = d * Math.PI / 180;
    change(() => {
        cs.forEach((c) => {
            if (!eachTurn || cs.length === 1) { const dx = c.cx - gx, dy = c.cy - gy, nx = gx + dx * Math.cos(a) - dy * Math.sin(a), ny = gy + dx * Math.sin(a) + dy * Math.cos(a); c.x.x = Math.round(nx - c.w.w / 2); c.x.y = Math.round(ny - c.w.h / 2); }
            c.x.r = ((c.x.r + d) % 360 + 360) % 360;
        });
        // keep the group inside the room: slide it back in as a whole if a turn pushed it past a wall
        const box = cs.reduce((b, c) => { const x = c.x.x + c.w.w / 2, y = c.x.y + c.w.h / 2, rr = Math.max(c.w.w, c.w.h) / 2; return { l: Math.min(b.l, x - rr), t: Math.min(b.t, y - rr), r: Math.max(b.r, x + rr), b: Math.max(b.b, y + rr) }; }, { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
        const dx = box.l < 0 ? -box.l : box.r > ROOM.W ? ROOM.W - box.r : 0, dy = box.t < 0 ? -box.t : box.b > ROOM.H ? ROOM.H - box.b : 0;
        if (dx || dy) cs.forEach((c) => { c.x.x = Math.round(c.x.x + dx); c.x.y = Math.round(c.x.y + dy); });
    });
}
function dup() {
    const many = selItems(); if (!many.length) return;
    const copies = many.map((x) => Object.assign({}, x, { id: uid(), x: x.x + 30, y: x.y + 30 }));
    change(() => copies.forEach((c) => P().items.push(c))); sels = new Set(copies.map((c) => c.id)); render();
}
function del() {
    const many = selItems(); if (!many.length) return; const ids = new Set(many.map((x) => x.id));
    change(() => { P().items = P().items.filter((x) => !ids.has(x.id)); Object.keys(P().seats).forEach((k) => { if (ids.has(k.split(":")[0])) delete P().seats[k]; }); });
    sels = new Set(); render();
}
function nudge(dx, dy) { const many = selItems(); if (many.length) change(() => many.forEach((x) => { x.x += dx; x.y += dy; })); }

let toastT = 0;
function toast(t) { $("foot").textContent = t; clearTimeout(toastT); toastT = setTimeout(render, 6000); }

/* ---------- saved layouts in folders (teacher/{uid}/seats/saved) ---------- */
const FOLDER_IDEAS = ["Test days", "Group work", "Partner work", "Stations", "Fridays", "Sub days"];
async function writeSaved() {
    try { await store.save("seats/saved", JSON.parse(JSON.stringify(SAVED))); return true; }
    catch (e) { $("saveMsg").textContent = "Could not save (" + ((e && e.code) || "connection") + "). Nothing changed."; return false; }
}
/** Change SAVED, write it, and put it back if the write fails. */
async function editSaved(fn, msg) {
    const old = JSON.parse(JSON.stringify(SAVED));
    fn();
    if (await writeSaved()) { if (msg) $("saveMsg").textContent = msg; } else SAVED = old;
    drawSaved();
}
/** Every folder: one per period (class periods first, then any old period that still has layouts), then the teacher's own. */
function folders() {
    const out = PERIODS.map((p) => ({ id: perFolder(p[0]), n: p[0] + " period", per: p[0] }));
    SAVED.list.forEach((x) => { if (x.f.startsWith("p:") && !out.some((f) => f.id === x.f)) out.push({ id: x.f, n: x.f.slice(2) + " period", per: x.f.slice(2) }); });
    SAVED.folders.forEach((f) => out.push({ id: f.id, n: f.n, mine: true }));
    return out;
}
const folderOf = (id) => folders().find((f) => f.id === id);
const inFolder = (id) => SAVED.list.filter((x) => x.f === id);
function openSaved() { $("saveMsg").textContent = ""; $("saveName").value = ""; fview = null; drawSaved(); $("savedDlg").showModal(); setTimeout(() => $("saveName").focus(), 30); }
async function saveLayout() {
    const p = P(), n = $("saveName").value.trim().slice(0, 40), f = $("saveFolder").value || perFolder(per);
    if (!p.items.length) { $("saveMsg").textContent = "This period has no room yet. Set one up first."; return; }
    if (!n) { $("saveMsg").textContent = "Give the layout a name first."; $("saveName").focus(); return; }
    const same = SAVED.list.find((x) => x.n.toLowerCase() === n.toLowerCase() && x.f === f);
    if (!same && SAVED.list.length >= SAVED_MAX) { $("saveMsg").textContent = "You have " + SAVED_MAX + " saved layouts. Delete one to save another."; return; }
    const entry = { id: same ? same.id : uid(), n, per, f, at: Date.now(), items: JSON.parse(JSON.stringify(p.items)), seats: Object.assign({}, p.seats) };
    const fo = folderOf(f);
    await editSaved(() => { SAVED.list = [entry].concat(SAVED.list.filter((x) => x !== same)); },
        (same ? "Updated “" : "Saved “") + n + "” in " + (fo ? fo.n : "its folder") + ".");
    if ($("saveMsg").textContent.startsWith("Could not")) return;
    $("saveName").value = ""; fview = f; drawSaved();
}
function folderSelect(sel, value) {
    sel.textContent = "";
    folders().forEach((f) => { const o = el("option", null, f.n); o.value = f.id; sel.appendChild(o); });
    sel.value = value;
}
const ICON_FOLDER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
function drawSaved() {
    if (fview && !folderOf(fview)) fview = null;
    folderSelect($("saveFolder"), fview || perFolder(per));
    const crumb = $("savedCrumb"), host = $("savedList");
    crumb.textContent = ""; host.textContent = "";
    const all = el("button", "se-crumbbtn", "All folders"); all.type = "button"; all.onclick = () => { fview = null; drawSaved(); };
    if (fview) all.setAttribute("aria-current", "false"); else all.setAttribute("aria-current", "page");
    crumb.appendChild(all);
    if (!fview) return drawFolders(host);
    const fo = folderOf(fview);
    crumb.appendChild(el("span", "se-crumbsep", "›"));
    crumb.appendChild(el("b", null, fo.n));
    if (fo.mine) folderTools(crumb, fo);
    drawLayouts(host, inFolder(fview));
}
function drawFolders(host) {
    const grid = el("div", "se-folders");
    folders().forEach((f) => {
        const list = inFolder(f.id);
        if (f.per && !PERIODS.some((p) => p[0] === f.per) && !list.length) return;
        const b = el("button", "se-folder" + (f.mine ? " mine" : "") + (f.per === per ? " here" : "")); b.type = "button";
        b.innerHTML = ICON_FOLDER;
        const tx = el("span"); tx.appendChild(el("b", null, f.n));
        tx.appendChild(el("small", null, (list.length ? list.length + " layout" + (list.length > 1 ? "s" : "") : "Empty") + (f.per === per ? " · this period" : "")));
        b.appendChild(tx);
        b.onclick = () => { fview = f.id; drawSaved(); };
        grid.appendChild(b);
    });
    host.appendChild(grid);
    // a new folder for days and activities
    const add = el("div", "se-newfolder");
    if (SAVED.folders.length >= FOLDER_MAX) { add.appendChild(el("p", "se-hint", "You have " + FOLDER_MAX + " folders of your own. Delete one to make another.")); host.appendChild(add); return; }
    const row = el("div", "se-saverow"), inp = el("input"); inp.id = "newFolder"; inp.maxLength = 30; inp.placeholder = "New folder, like “Test days”"; inp.autocomplete = "off"; inp.setAttribute("aria-label", "New folder name");
    const go = el("button", "btn", "New folder"); go.type = "button"; go.id = "newFolderGo";
    const make = (name) => {
        const n = String(name || "").trim().slice(0, 30);
        if (!n) { inp.focus(); return; }
        const have = SAVED.folders.find((f) => f.n.toLowerCase() === n.toLowerCase());
        if (have) { fview = have.id; drawSaved(); return; }
        const id = "f" + uid();
        editSaved(() => { SAVED.folders.push({ id, n }); fview = id; }, "Made the folder “" + n + "”. Save a layout into it above.");
    };
    go.onclick = () => make(inp.value);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); make(inp.value); } });
    row.appendChild(inp); row.appendChild(go); add.appendChild(row);
    const ideas = FOLDER_IDEAS.filter((n) => !SAVED.folders.some((f) => f.n.toLowerCase() === n.toLowerCase()));
    if (ideas.length) {
        const chips = el("div", "se-ideas"); chips.appendChild(el("small", null, "Ideas:"));
        ideas.forEach((n) => { const c = el("button", "se-idea", n); c.type = "button"; c.onclick = () => make(n); chips.appendChild(c); });
        add.appendChild(chips);
    }
    host.appendChild(add);
}
function folderTools(crumb, fo) {
    const box = el("span", "se-crumbtools");
    const rn = el("button", "btn ghost", "Rename"); rn.type = "button";
    rn.onclick = () => {
        box.textContent = "";
        const inp = el("input"); inp.value = fo.n; inp.maxLength = 30; inp.setAttribute("aria-label", "Folder name");
        const ok = el("button", "btn go", "Done"); ok.type = "button";
        const done = () => { const n = inp.value.trim().slice(0, 30); if (!n || n === fo.n) return drawSaved(); editSaved(() => { const f = SAVED.folders.find((x) => x.id === fo.id); if (f) f.n = n; }, "Renamed to “" + n + "”."); };
        ok.onclick = done; inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); done(); } if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); drawSaved(); } });
        box.appendChild(inp); box.appendChild(ok); inp.focus(); inp.select();
    };
    const dl = el("button", "btn ghost se-savedel", "Delete folder"); dl.type = "button";
    dl.onclick = () => {
        const n = inFolder(fo.id).length;
        if (dl.dataset.sure !== "1") { dl.dataset.sure = "1"; dl.textContent = n ? "Delete folder? Its " + n + " layout" + (n > 1 ? "s go" : " goes") + " back to period folders" : "Delete folder?"; setTimeout(() => { if (dl.isConnected) { dl.dataset.sure = ""; dl.textContent = "Delete folder"; } }, 5000); return; }
        fview = null;
        editSaved(() => { SAVED.list.forEach((x) => { if (x.f === fo.id) x.f = perFolder(x.per || per); }); SAVED.folders = SAVED.folders.filter((f) => f.id !== fo.id); }, "Deleted the folder “" + fo.n + "”." + (n ? " Its layouts are back in their period folders." : ""));
    };
    box.appendChild(rn); box.appendChild(dl); crumb.appendChild(box);
}
function drawLayouts(host, list) {
    if (!list.length) { host.appendChild(el("p", "se-hint se-empty", "Nothing in this folder yet. Name this period's layout above and press Save.")); return; }
    list.forEach((x) => {
        const row = el("div", "se-saveit"), th = el("div", "se-savethumb"); drawRoom(th, cleanPeriod(x), {}); row.appendChild(th);
        const tx = el("div", "se-savetx"); tx.appendChild(el("b", null, x.n));
        const n = Object.keys(x.seats).length; tx.appendChild(el("small", null, (x.per ? "From " + x.per + " period · " : "") + seatCount(x) + " seats" + (n ? ", " + n + " students" : "") + " · " + new Date(x.at).toLocaleDateString()));
        const mv = el("select", "se-move"); mv.setAttribute("aria-label", "Move “" + x.n + "” to a folder"); mv.title = "Move to another folder";
        folderSelect(mv, x.f);
        mv.onchange = () => { const to = folderOf(mv.value); editSaved(() => { const y = SAVED.list.find((z) => z.id === x.id); if (y) y.f = mv.value; }, "Moved “" + x.n + "” to " + (to ? to.n : "that folder") + "."); };
        tx.appendChild(mv);
        row.appendChild(tx);
        const go = el("button", "btn", "Restore"); go.type = "button";
        go.onclick = () => {
            if (locked()) { $("saveMsg").textContent = "This chart is locked. Unlock it to restore a layout."; return; }
            const names = new Set(roster());
            change(() => { P().items = JSON.parse(JSON.stringify(x.items)); P().seats = Object.assign({}, x.seats); });
            const away = Object.values(P().seats).filter((nm) => names.size && !names.has(nm)).length;
            sels = new Set(); $("savedDlg").close();
            toast("Restored “" + x.n + "” to " + per + " period." + (away ? " " + away + " name" + (away > 1 ? "s are" : " is") + " not on this period's class list (dashed red)." : "") + " Undo puts the last chart back.");
        };
        const dl = el("button", "btn ghost se-savedel", "Delete"); dl.type = "button";
        dl.onclick = () => {
            if (dl.dataset.sure !== "1") { dl.dataset.sure = "1"; dl.textContent = "Delete it?"; setTimeout(() => { if (dl.isConnected) { dl.dataset.sure = ""; dl.textContent = "Delete"; } }, 4000); return; }
            editSaved(() => { SAVED.list = SAVED.list.filter((y) => y.id !== x.id); }, "Deleted “" + x.n + "”.");
        };
        row.appendChild(go); row.appendChild(dl); host.appendChild(row);
    });
}

/* ---------- copy and print ---------- */
function openCopy() {
    const list = $("copyList"); list.textContent = "";
    PERIODS.forEach((p) => { if (p[0] === per) return; const l = el("label"), c = el("input"); c.type = "checkbox"; c.value = p[0]; c.checked = !(chart.periods[p[0]] && chart.periods[p[0]].items.length); l.appendChild(c); l.appendChild(document.createTextNode(p[0] + " period" + (chart.periods[p[0]] && chart.periods[p[0]].items.length ? " (has a room: it is replaced)" : ""))); list.appendChild(l); });
    $("copyDlg").showModal();
}
function doCopy() {
    const to = [...$("copyList").querySelectorAll("input:checked")].map((c) => c.value); if (!to.length) return;
    const items = JSON.stringify(P().items), skip = to.filter((k) => chart.periods[k] && chart.periods[k].lock);
    to.filter((k) => !skip.includes(k)).forEach((k) => { const old = chart.periods[k] || cleanPeriod(null); (undo[k] = undo[k] || []).push(JSON.stringify(old)); chart.periods[k] = cleanPeriod({ items: JSON.parse(items), seats: old.seats, at: Date.now() }); });
    const done = to.filter((k) => !skip.includes(k));
    save(); toast((done.length ? "Room copied to " + done.join(", ") + "." : "") + (skip.length ? " Skipped " + skip.join(", ") + ": locked." : ""));
}
function print() {
    const h = $("printHost"); h.textContent = "";
    h.appendChild(el("h1", null, "Seating chart · " + per + " period"));
    h.appendChild(el("p", null, (flip ? "Teacher view (front of the room at the bottom)" : "Students' view (front of the room at the top)") + " · " + new Date().toLocaleDateString()));
    drawRoom(h, P(), { flip });
    window.print();
}

/* ---------- start ---------- */
async function start() {
    store = await import(DEMO ? "./localStore.js?v=57" : "./boardStore.js?v=58");
    PERIODS = DEMO ? ["1st", "2nd", "4th", "5th", "6th"].map((p) => [p, ""]) : (await import("../data/weeks.js?v=61")).PERIODS;
    const user = await store.ready();
    if (!user) { location.replace("login.html"); return; }
    $("who").textContent = DEMO ? "Sample names, nothing is saved" : "Signed in as " + user.name;
    const want = Q.get("period"); per = PERIODS.some((p) => p[0] === want) ? want : PERIODS[0][0];
    try { const last = localStorage.getItem("anchor:seatsPeriod"); if (!want && PERIODS.some((p) => p[0] === last)) per = last; } catch (e) { /* ok */ }
    const ps = $("periodSel"); PERIODS.forEach((p) => { const o = el("option", null, p[0] + " period"); o.value = p[0]; ps.appendChild(o); }); ps.value = per;
    ps.onchange = () => { per = ps.value; sels = new Set(); pick = null; try { localStorage.setItem("anchor:seatsPeriod", per); } catch (e) { /* ok */ } if (!P().items.length) mode = "room"; render(); };
    document.querySelectorAll(".se-mode button").forEach((b) => { b.onclick = () => { mode = b.dataset.mode; sels = new Set(); pick = null; render(); }; });
    $("fillAz").onclick = () => change(() => fill(roster().filter((n) => !seatedNames().has(n)).sort((a, b) => a.localeCompare(b))));
    $("fillRand").onclick = () => change(() => fill(shuffled(roster().filter((n) => !seatedNames().has(n)))));
    $("shuffle").onclick = () => { if (locked()) return lockedNote(); change(() => { P().seats = {}; fill(shuffled(roster())); }); toast("New chart. Undo brings the last one back."); };
    $("clearSeats").onclick = () => { if (locked()) return lockedNote(); change(() => { P().seats = {}; }); toast("Seats cleared. Undo brings them back."); };
    $("undo").onclick = () => stepHist(undo, redo); $("redo").onclick = () => stepHist(redo, undo);
    $("flipBtn").onclick = () => { flip = !flip; try { localStorage.setItem("anchor:seatsFlip", flip ? "1" : "0"); } catch (e) { /* ok */ } render(); };
    $("copyBtn").onclick = openCopy; $("copyDlg").addEventListener("close", () => { if ($("copyDlg").returnValue === "ok") doCopy(); });
    $("printBtn").onclick = print;
    $("lockBtn").onclick = () => { const p = P(); if (p.lock) delete p.lock; else { p.lock = true; sels = new Set(); pick = null; } p.at = Date.now(); render(); save(); toast(p.lock ? "Locked. Nothing on this chart can move until you unlock it." : "Unlocked. You can change the chart again."); };
    $("savedBtn").onclick = openSaved;
    $("saveGo").onclick = saveLayout;
    $("saveName").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveLayout(); } });
    $("eachBtn").onclick = () => { eachTurn = !eachTurn; render(); };
    $("rotL").onclick = () => rotate(-15); $("rotR").onclick = () => rotate(15); $("dup").onclick = dup; $("del").onclick = del;
    $("labIn").addEventListener("change", () => { const it = selItems().length === 1 ? selItems()[0] : null; if (it) change(() => { it.label = $("labIn").value.slice(0, 40); }); });
    document.addEventListener("keydown", (e) => {
        const typing = e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); if (e.shiftKey) stepHist(redo, undo); else stepHist(undo, redo); return; }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); stepHist(redo, undo); return; }
        if (!typing && mode === "room" && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); sels = new Set(P().items.map((x) => x.id)); render(); return; }
        if (typing || mode !== "room" || !sels.size) { if (e.key === "Escape" && pick) { pick = null; render(); } return; }
        const step = e.shiftKey ? 50 : 10, f = flip ? -1 : 1;
        if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-step * f, 0); } else if (e.key === "ArrowRight") { e.preventDefault(); nudge(step * f, 0); }
        else if (e.key === "ArrowUp") { e.preventDefault(); nudge(0, -step * f); } else if (e.key === "ArrowDown") { e.preventDefault(); nudge(0, step * f); }
        else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); del(); }
        else if (e.key === "r" || e.key === "R") { e.preventDefault(); rotate(e.shiftKey ? -15 : 15); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); dup(); }
        else if (e.key === "Escape") { sels = new Set(); render(); }
    });
    buildTemplates(); buildPalette();

    if (DEMO) {
        const periods = {}; PERIODS.forEach((p, i) => { periods[p[0]] = shuffled(DEMO_NAMES).slice(0, 16 + (i % 4) * 2); });
        await store.save("rosters/all", { periods });
    }
    store.watch("rosters/all", (s) => { const p = (s.exists && s.data && s.data.periods) || {}; ROSTERS = {}; Object.keys(p).forEach((k) => { if (Array.isArray(p[k])) ROSTERS[k] = p[k].map((n) => String(n).slice(0, 60)); }); if (loaded) render(); }, () => {});
    store.watch("seats/saved", (s) => { if (s.pending) return; SAVED = cleanSaved(s.exists ? s.data : null); if ($("savedDlg").open) drawSaved(); }, () => {});
    store.watch("seats/chart", (s) => {
        if (s.pending) return;
        if (loaded && s.data && s.data.by === PAGE) return;   // our own save coming back
        if (loaded && (saving || saveT && document.querySelector(".se-ghost, .sit.drag"))) return;
        chart = cleanChart(s.exists ? s.data : null);
        if (!loaded) { loaded = true; if (!P().items.length) mode = "room"; status(DEMO ? "Sample, nothing is saved" : "Live"); }
        prune();
        render();
    }, (e) => status("Could not load (" + ((e && e.code) || "error") + ")", "bad"));
}
start();
