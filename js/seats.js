/* ==========================================
   Anchor Board — seating charts: the shared model and the room drawing.
   Used by the editor (seats.html, js/seatsPage.js) and by the board's
   "Seating Chart" screen (js/boardApp.js), so both draw the same room.

   Saved in one private document, teacher/{uid}/seats/chart:
     { v: 1, at, by, periods: { "1st": { items: [...], seats: { "<itemId>:<n>": "Name" }, at } } }
   An item is one thing in the room: { id, k (kind), x, y, r (degrees), w?, h?, label? }.
   The room is ROOM.W x ROOM.H units, the front of the room (the board) at the top,
   which is how the students see it when they face the board.
   Names come from the roster (first name and last initial). Never in this public repo.
========================================== */

export const ROOM = { W: 1000, H: 620 };
const SNAP = 10;

// Seat cells are fractions of the item: [x, y, w, h, chair side]. Chair side: b(ottom) t(op) l(eft) r(ight).
const grid = (cols, rows) => { const c = []; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) c.push([i / cols, j / rows, 1 / cols, 1 / rows, rows === 1 ? "b" : (j === 0 ? "t" : "b")]); return c; };
export const KINDS = {
    desk: { n: "Single desk", g: "Desks", w: 84, h: 58, cells: grid(1, 1) },
    pair: { n: "Pair", g: "Desks", w: 164, h: 58, cells: grid(2, 1) },
    trio: { n: "Row of 3", g: "Desks", w: 244, h: 58, cells: grid(3, 1) },
    table4: { n: "Table of 4", g: "Desks", w: 164, h: 112, cells: grid(2, 2) },
    table6: { n: "Table of 6", g: "Desks", w: 244, h: 112, cells: grid(3, 2) },
    chair: { n: "Chair", g: "Desks", w: 66, h: 58, chair: true, cells: [[0, 0, 1, 0.78, "b"]] },
    round: { n: "Round table", g: "Desks", w: 170, h: 170, round: true, cells: [[0.29, 0.02, 0.42, 0.3, "t"], [0.68, 0.35, 0.3, 0.3, "r"], [0.29, 0.68, 0.42, 0.3, "b"], [0.02, 0.35, 0.3, 0.3, "l"]] },
    teacher: { n: "Teacher desk", g: "Room", w: 170, h: 70, label: "Teacher", resize: true },
    tchair: { n: "Teacher chair", g: "Room", w: 62, h: 62, label: "", resize: true },
    board: { n: "Board", g: "Room", w: 360, h: 26, label: "Board", resize: true },
    door: { n: "Door", g: "Room", w: 90, h: 18, label: "Door", resize: true },
    window: { n: "Windows", g: "Room", w: 220, h: 14, label: "Windows", resize: true },
    shelf: { n: "Shelf", g: "Room", w: 150, h: 42, label: "Shelf", resize: true, edit: true },
    station: { n: "Station", g: "Room", w: 140, h: 84, label: "Station", resize: true, edit: true },
    rug: { n: "Rug", g: "Room", w: 220, h: 150, label: "", resize: true, edit: true },
    lamp: { n: "Lamp", g: "Room", w: 54, h: 54, round: true, label: "", resize: true },
    label: { n: "Label", g: "Room", w: 150, h: 40, label: "Label", resize: true, edit: true },
};
export const isSeat = (k) => !!(KINDS[k] && KINDS[k].cells);
export const sizeOf = (it) => { const K = KINDS[it.k] || KINDS.desk; return { w: it.w || K.w, h: it.h || K.h }; };
export const MIN = { w: 20, h: 10 };
export const uid = () => Math.random().toString(36).slice(2, 8);
export const snap = (v) => Math.round(v / SNAP) * SNAP;

/* ---------- cleaning what comes back from the store ---------- */
const num = (v, a, b, d) => (typeof v === "number" && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
export function cleanItem(o) {
    if (!o || typeof o !== "object" || !KINDS[o.k]) return null;
    const it = { id: str(o.id, 16) || uid(), k: o.k, x: num(o.x, -200, ROOM.W, 0), y: num(o.y, -200, ROOM.H, 0), r: ((Math.round(num(o.r, -720, 720, 0)) % 360) + 360) % 360 };
    if (o.w) it.w = num(o.w, MIN.w, ROOM.W, KINDS[o.k].w); if (o.h) it.h = num(o.h, MIN.h, ROOM.H, KINDS[o.k].h);
    if (typeof o.label === "string") it.label = o.label.slice(0, 40);
    return it;
}
export function cleanPeriod(o) {
    const p = { items: [], seats: {}, at: 0 };   // + lock: true when the teacher locked the chart
    if (!o || typeof o !== "object") return p;
    const seen = new Set();
    (Array.isArray(o.items) ? o.items : []).slice(0, 120).forEach((x) => { const it = cleanItem(x); if (it && !seen.has(it.id)) { seen.add(it.id); p.items.push(it); } });
    const ok = new Set(); p.items.forEach((it) => { if (isSeat(it.k)) KINDS[it.k].cells.forEach((_, i) => ok.add(it.id + ":" + i)); });
    const names = new Set();
    Object.keys(o.seats || {}).forEach((k) => { const n = str(o.seats[k], 60).trim(); if (ok.has(k) && n && !names.has(n)) { names.add(n); p.seats[k] = n; } });
    p.at = num(o.at, 0, 9e15, 0);
    if (o.lock === true) p.lock = true;
    return p;
}
export function cleanChart(o) {
    const c = { v: 1, periods: {}, at: 0 };
    if (!o || typeof o !== "object") return c;
    Object.keys(o.periods || {}).slice(0, 20).forEach((k) => { c.periods[str(k, 20)] = cleanPeriod(o.periods[k]); });
    c.at = num(o.at, 0, 9e15, 0);
    return c;
}

/** Saved layouts (teacher/{uid}/seats/saved): { list: [{ id, n (name), per (period it came from), at, items, seats }] }. */
export const SAVED_MAX = 40;
export function cleanSaved(o) {
    const list = [];
    (o && Array.isArray(o.list) ? o.list : []).slice(0, SAVED_MAX).forEach((x) => {
        if (!x || typeof x !== "object") return;
        const p = cleanPeriod(x); if (!p.items.length) return;
        list.push({ id: str(x.id, 16) || uid(), n: str(x.n, 40).trim() || "Saved layout", per: str(x.per, 20), at: num(x.at, 0, 9e15, 0), items: p.items, seats: p.seats });
    });
    return { list };
}

/* ---------- geometry ---------- */
/** Every seat of a period, with its centre in room units, front row first, then left to right. */
export function seatList(p) {
    const out = [];
    p.items.forEach((it) => {
        if (!isSeat(it.k)) return;
        const K = KINDS[it.k], s = sizeOf(it), cx = it.x + s.w / 2, cy = it.y + s.h / 2, a = it.r * Math.PI / 180;
        K.cells.forEach((c, i) => {
            const dx = (c[0] + c[2] / 2 - 0.5) * s.w, dy = (c[1] + c[3] / 2 - 0.5) * s.h;
            out.push({ key: it.id + ":" + i, x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) });
        });
    });
    const row = 40;   // seats within 40 units of each other count as one row
    return out.sort((a, b) => (Math.abs(a.y - b.y) < row ? a.x - b.x : a.y - b.y));
}
export const seatCount = (p) => p.items.reduce((n, it) => n + (isSeat(it.k) ? KINDS[it.k].cells.length : 0), 0);

/* ---------- starting layouts ---------- */
function frontOf(items) {
    items.push({ id: uid(), k: "board", x: 320, y: 8, r: 0 });
    items.push({ id: uid(), k: "teacher", x: 790, y: 40, r: 0 });
    items.push({ id: uid(), k: "door", x: 20, y: 600, r: 0 });
    return items;
}
export const TEMPLATES = [
    { id: "rows", n: "Rows", make() { const it = frontOf([]); for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) it.push({ id: uid(), k: "desk", x: 110 + i * 130, y: 150 + j * 92, r: 0 }); return it; } },
    { id: "pairs", n: "Pairs", make() { const it = frontOf([]); for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) it.push({ id: uid(), k: "pair", x: 90 + i * 280, y: 150 + j * 92, r: 0 }); return it; } },
    { id: "groups", n: "Groups of 4", make() { const it = frontOf([]); [[90, 160], [400, 160], [710, 160], [90, 330], [400, 330], [710, 330], [400, 480]].forEach(([x, y]) => it.push({ id: uid(), k: "table4", x, y, r: 0 })); return it; } },
    { id: "ushape", n: "U shape", make() {
        const it = frontOf([]);
        for (let j = 0; j < 5; j++) { it.push({ id: uid(), k: "desk", x: 40, y: 130 + j * 86, r: 90 }); it.push({ id: uid(), k: "desk", x: 876, y: 130 + j * 86, r: 270 }); }
        [140, 390, 640].forEach((x) => it.push({ id: uid(), k: "trio", x, y: 550, r: 0 }));
        return it;
    } },
    { id: "stations", n: "Stations", make() { const it = frontOf([]); [[140, 150], [640, 150], [140, 400], [640, 400]].forEach(([x, y], i) => { it.push({ id: uid(), k: "round", x, y, r: 0 }); it.push({ id: uid(), k: "label", x: x + 10, y: y + 175, r: 0, label: "Station " + (i + 1), w: 150, h: 34 }); }); return it; } },
    { id: "blank", n: "Empty room", make() { return frontOf([]); } },
];

/* ---------- names ---------- */
export function nameParts(n) {
    const m = String(n || "").trim().match(/^(.*?)(?:\s+([A-Za-z][\w'-]*\.?))?$/);
    if (!m || !m[2] || m[2].length > 3) return [String(n || "").trim(), ""];
    return [m[1], m[2]];
}

/* ---------- drawing ---------- */
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const pct = (v, of) => (v / of * 100) + "%";

/**
 * Draw one period's room into host. Returns the room element.
 * opts: { flip (teacher's view: front at the bottom), edit (editor marks), hi (a name to light up),
 *         roster (names on the class list, to mark seated names that are not), sel (selected item id),
 *         pick (the name picked in the tray), count (number the empty seats) }
 */
export function drawRoom(host, p, opts = {}) {
    const room = el("div", "seatroom" + (opts.edit ? " edit" : "") + (opts.flip ? " flip" : ""));
    room.style.aspectRatio = ROOM.W + " / " + ROOM.H;
    const floor = el("div", "srfloor"); room.appendChild(floor);
    const front = el("div", "srfront", "Front of the room"); front.setAttribute("aria-hidden", "true"); room.appendChild(front);
    const roster = opts.roster ? new Set(opts.roster) : null;
    const order = opts.count ? new Map(seatList(p).map((s, i) => [s.key, i + 1])) : null;
    // Floor things first (rug), then furniture, so desks always sit on top of a rug.
    const items = p.items.slice().sort((a, b) => (a.k === "rug" ? 0 : 1) - (b.k === "rug" ? 0 : 1));
    let n = 0;
    items.forEach((it) => {
        const K = KINDS[it.k], s = sizeOf(it);
        const x = opts.flip ? ROOM.W - it.x - s.w : it.x, y = opts.flip ? ROOM.H - it.y - s.h : it.y, r = (it.r + (opts.flip ? 180 : 0)) % 360;
        const d = el("div", "sit k-" + it.k + (K.round ? " round" : "") + (opts.sel && (opts.sel.has ? opts.sel.has(it.id) : opts.sel === it.id) ? " sel" : ""));
        d.dataset.id = it.id;
        d.style.left = pct(x, ROOM.W); d.style.top = pct(y, ROOM.H); d.style.width = pct(s.w, ROOM.W); d.style.height = pct(s.h, ROOM.H);
        d.style.transform = r ? "rotate(" + r + "deg)" : "";
        d.style.setProperty("--i", String(n++));
        if (K.cells) {
            K.cells.forEach((c, i) => {
                const key = it.id + ":" + i, name = p.seats[key] || "";
                const cell = el("div", "scell ch-" + c[4] + (name ? " full" : " open") + (opts.hi && name === opts.hi ? " hi" : "") + (roster && name && !roster.has(name) ? " gone" : ""));
                cell.dataset.seat = key;
                cell.style.left = pct(c[0], 1); cell.style.top = pct(c[1], 1); cell.style.width = pct(c[2], 1); cell.style.height = pct(c[3], 1);
                const tag = el("div", "stag"); tag.style.transform = "translate(-50%,-50%)" + (r ? " rotate(" + (-r) + "deg)" : "");
                if (name) {
                    const [first, last] = nameParts(name);
                    tag.appendChild(el("b", null, first)); if (last) tag.appendChild(el("small", null, last));
                    tag.dataset.name = name; tag.title = name;
                } else if (order) tag.appendChild(el("i", null, String(order.get(key) || "")));
                cell.appendChild(tag); d.appendChild(cell);
            });
        } else {
            const lab = (typeof it.label === "string" ? it.label : K.label) || "";
            if (lab) { const t = el("span", "slab", lab); if (r > 90 && r <= 270) t.style.transform = "rotate(180deg)"; d.appendChild(t); }
        }
        room.appendChild(d);
    });
    host.appendChild(room);
    return room;
}
