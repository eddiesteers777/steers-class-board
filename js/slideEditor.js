/* ==========================================
   Anchor Board — the Slides side of the Board Builder (studio.html → Slides).
   Google Slides-style: tools across the top, the day's slides down the left, the slide in the middle,
   notes for the teacher underneath. Everything on a slide can be moved, sized, turned, restyled or deleted.
   Slides belong to a lesson (week, class, day); every-day slides show at the start of every lesson.
   It edits saved slides, never the live board, so next week can be built while class runs on this one.
   Slides is where a lesson is built; Spotlight is where it is taught.
   Nov 24 (Eddie: "Spotlight is the main focus; Slides is a way to quickly edit a lot of panels at one time and get a lot
   of layouts set up for class"): Select in the slide list ticks several slides (Shift- or Ctrl-click does too); the
   bar above the list then puts them all in Spotlight, sets their panels, duplicates, copies, hides or deletes them at
   once (one Undo each), and a layout can be added several times in one go. "Teach this slide" is the one big button across:
   it puts the lesson on the board and opens this slide in Spotlight. (Nov 24: Present was cut, since Spotlight does it
   with ink and panels.) The lesson row (week, days, saved, Teach, more) sits in the Board Builder's own header
   (studio.html #slBarSlot), so the slide gets the room.
   Model: js/slides.js. Drawing: js/slideView.js. The board side: js/boardApp.js (the Slides screen).
========================================== */
import { SW, SH, MAX_SLIDES, MAX_DAILY, DAILY, INDEX, deckKey, newId, cleanDeck, cleanSlide, cleanEl, cleanIndex, newEl, mathBox, LAYOUTS, todaySlide, agendaSlide,
    fromPlan, liveContext, lessonDate, showList, revealSteps, countShown, sanitizeHtml, textOf, PALETTE, FONTS, SHAPES, GRADS, PATTERNS, LIVE, boxOf, shapePath, inkFor,
    PANEL_MINS, cleanPanels, panelWords, bankSlide, walkSlide } from "./slides.js?v=2";
import { renderSlide, renderEl, fitSlide, thumb, imageLoader } from "./slideView.js?v=2";
import { newItem, geom, MENU as MATH_MENU, parseStep, compileExpr, PLOT } from "./mathTools.js?v=1";
import { STICKER_SETS, WORDS, WORD_COLORS, stickerFace } from "./stickers.js?v=1";
import { gradOf, lookSeal } from "./panels.js?v=44";

const PAGE = Math.random().toString(36).slice(2, 10);
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
let A = null, R = null, active = false, built = false;
let lesson = { week: "", cls: "", day: 0 };
const decks = {};                       // key -> { deck, ready, fresh, since, dirty, saving, err, t, unsub }
let idx = cleanIndex(null), idxFresh = false, idxT = 0, idxDirty = false;
let cur = { key: "", id: "" };          // the open slide: its deck (a lesson key or "daily") and its id
let sel = [], editing = "", hist = [], fut = [], lastTag = "", lastAt = 0, clip = null;
let k = 0.5, slideEl = null, drag = null, pop = null, popFor = null, toastT = 0, notesOpen = false;
const thumbs = new Map();
let images = null;

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const svg = (d, cls) => '<svg class="' + (cls || "ic") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
/** A week's name for a menu: "Week 5 · Nov 16–20" (short months keep the lesson bar on one line). */
const weekName = (w) => (w.label || w.id) + (w.dates ? " · " + String(w.dates).replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/g, "$1") : "");
function btn(cls, html, fn, title) {
    const b = el("button", cls); b.type = "button"; b.innerHTML = html;
    if (title) { b.title = title; b.setAttribute("aria-label", title); }
    if (fn) b.onclick = (e) => fn(e, b);
    b.addEventListener("mousedown", (e) => e.preventDefault());   // keep the caret where it is while typing on a slide
    return b;
}
const IC = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    text: '<path d="M5 7V5h14v2"/><path d="M12 5v14"/><path d="M9 19h6"/>', card: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/>',
    shape: '<circle cx="8.5" cy="8.5" r="5"/><rect x="11" y="11" width="10" height="10" rx="1.6"/>', line: '<path d="M5 19 19 5"/><path d="M12 5h7v7"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>', pic: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/>',
    math: '<path d="M4 7h6M7 4v6M14 7h6M4.5 17.5l5-5M9.5 17.5l-5-5M14 15h6M14 19h6"/>', sticker: '<path d="M14.5 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8.5L21 14.5V6a3 3 0 0 0-3-3z"/><path d="M14.5 21v-4.5a2 2 0 0 1 2-2H21"/><circle cx="9" cy="10" r="1"/><circle cx="14" cy="10" r="1"/>',
    live: '<circle cx="12" cy="12" r="2.4"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M9.2 9.2a4 4 0 0 0 0 5.6M14.8 9.2a4 4 0 0 1 0 5.6"/>',
    bg: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>', layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M10 9v12"/>',
    reveal: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', arrange: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    dup: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    spot: '<path d="M12 3v2M5.6 5.6 7 7M3 12h2M18.4 5.6 17 7M21 12h-2"/><path d="M8 16a4 4 0 1 1 8 0"/><path d="M5 20h14"/>',
    board: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 8.5 4 2-4 2z"/>',
    plan: '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8M8 13h8M8 17h5"/>', copyto: '<rect x="3" y="7" width="12" height="12" rx="2"/><path d="M9 3h10a2 2 0 0 1 2 2v10"/><path d="M13 13l6-6M14 7h5v5"/>',
    al: '<path d="M4 6h16M4 12h10M4 18h13"/>', ac: '<path d="M4 6h16M7 12h10M5.5 18h13"/>', ar: '<path d="M4 6h16M10 12h10M7 18h13"/>', aj: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    vt: '<path d="M4 4h16"/><path d="M8 9h8M8 13h8"/>', vm: '<path d="M8 10h8M8 14h8"/><path d="M4 4h16M4 20h16" opacity=".35"/>', vb: '<path d="M4 20h16"/><path d="M8 11h8M8 15h8"/>',
    ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>',
    ol: '<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 9h3M3.5 15.5a1.5 1.5 0 0 1 3 0c0 1-3 2.2-3 3.5h3"/>',
    fill: '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0z"/><path d="M5 2l5 5"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 2-2.6 2-4 0 1.4 2 2.4 2 4z"/>',
    border: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2.4"/>', shadow: '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M8 20h10a2 2 0 0 0 2-2V8"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', caret: '<path d="m7 10 5 5 5-5"/>', check: '<path d="m5 12 5 5L20 7"/>',
    hide: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/>',
    head: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18" stroke-width="3"/>', round: '<path d="M4 20V10a6 6 0 0 1 6-6h10"/>', grid: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    keys: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    notes: '<path d="M4 4h16v12H8l-4 4z"/><path d="M8 8h8M8 12h5"/>',
    panels: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 1.5M10 3h4"/>', bank: '<path d="M4 19V6a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2z"/><path d="M8 8h6M8 11h4"/>',
    steps: '<path d="M4 18h4v-4h4v-4h4V6h4"/>', every: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
};
const icon = (k) => svg(IC[k] || IC.more);

/* ---------- the state of the open lesson and slide ---------- */
const lessonKey = () => deckKey(lesson.week, lesson.cls, lesson.day);
const deckOf = (key) => (decks[key] ? decks[key].deck : null);
const S0 = () => { const d = deckOf(cur.key); return (d && d.slides.find((s) => s.id === cur.id)) || null; };
const byId = (id) => { const s = S0(); return (s && s.els.find((e) => e.id === id)) || null; };
const weeks = () => (A && A.allWeeks ? A.allWeeks() : []);
const weekObj = (id) => weeks().find((w) => w.id === (id || lesson.week)) || null;
const classOf = (w, c) => (w && w.classes && w.classes[c]) || null;
const dayOf = () => { const L = classOf(weekObj(), lesson.cls); return (L && L.days && L.days[lesson.day]) || null; };
const canEdit = (key) => { const d = decks[key]; return !!d && d.ready && (d.fresh || !navigator.onLine || Date.now() - d.since > 6000); };
const dateText = (w, i, d) => lessonDate(w, i, d);
function liveCtx() { const w = weekObj(), L = classOf(w, lesson.cls), d = L && L.days ? L.days[lesson.day] : null; return liveContext(w, L, d, lesson.day, dateText(w, lesson.day, d)); }
function boardStandIn() { const lk = (A && A.S && A.S.look) || {}; return { grad: gradOf(lk.theme || "navy"), cls: "stagebg pv-" + (lk.bg || "anchor") }; }
function viewOpts(extra) { return Object.assign({ live: liveCtx(), mark: true, img: images ? images.src : null, logo: lookSeal(), board: boardStandIn() }, extra || {}); }
function slideName(s) {
    const t = (s.els || []).filter((e) => e.k === "bx" && e.html).sort((a, b) => b.fs - a.fs || a.y - b.y)[0];
    const words = t ? textOf(t.html).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k2) => (LIVE.find((x) => x[0] === k2) || [k2, k2])[1]).split("\n")[0] : "";
    return words.slice(0, 60) || (s.els && s.els.length ? "Slide" : "Blank slide");
}

/* ---------- undo / redo ---------- */
function snapshot() { return JSON.stringify({ key: lessonKey(), L: deckOf(lessonKey()), D: deckOf(DAILY), cur, sel }); }
function before(tag) {
    const now = Date.now();
    if (tag && tag === lastTag && now - lastAt < 1200) { lastAt = now; return; }   // a run of nudges or notes typing is one step
    lastTag = tag || ""; lastAt = now;
    hist.push(snapshot()); if (hist.length > 120) hist.shift(); fut = [];
}
function restore(json) {
    const s = JSON.parse(json); if (s.key !== lessonKey()) return;
    if (s.L && decks[s.key]) { decks[s.key].deck = s.L; dirty(s.key); }
    if (s.D && decks[DAILY]) { decks[DAILY].deck = s.D; dirty(DAILY); }
    cur = s.cur; sel = (s.sel || []).filter((id) => byId(id)); editing = "";
    if (!S0()) pickFirst();
    draw();
}
function undo() { if (editing) finishEdit(); if (!hist.length) return toast("Nothing to undo"); fut.push(snapshot()); restore(hist.pop()); lastTag = ""; }
function redo() { if (editing) finishEdit(); if (!fut.length) return toast("Nothing to redo"); hist.push(snapshot()); restore(fut.pop()); lastTag = ""; }
/** Change the open slide: one undo step, saved soon, drawn again. */
function change(fn, tag) {
    const s = S0(); if (!s || !canEdit(cur.key)) return;
    before(tag); fn(s); dirty(cur.key);
    sel = sel.filter((id) => s.els.some((e) => e.id === id));
    draw();
}
/** Change a whole deck (add, move, delete slides). */
function changeDeck(key, fn) {
    const d = deckOf(key); if (!d || !canEdit(key)) return false;
    before(); fn(d); dirty(key); draw(); return true;
}

/* ---------- saving ---------- */
function dirty(key) {
    const d = decks[key]; if (!d) return;
    d.dirty = true; clearTimeout(d.t); d.t = setTimeout(() => save(key), 700); status();
}
async function save(key) {
    const d = decks[key]; if (!d || !d.dirty) return;
    if (d.saving) { clearTimeout(d.t); d.t = setTimeout(() => save(key), 400); return; }
    d.saving = true; d.dirty = false; status();
    const body = Object.assign(cleanDeck(d.deck, key === DAILY ? MAX_DAILY : MAX_SLIDES), { at: Date.now(), by: PAGE });
    if (d.deck.nod) body.nod = true;
    try { await A.store().save("slides/" + key, body); d.err = ""; }
    catch (e) { d.err = (e && e.code) || "connection"; d.dirty = true; }
    d.saving = false;
    const n = countShown(d.deck), off = key !== DAILY && !!d.deck.nod;
    if ((idx.n[key] || 0) !== n || !!idx.off[key] !== off) { if (n) idx.n[key] = n; else delete idx.n[key]; if (off) idx.off[key] = 1; else delete idx.off[key]; idxDirty = true; saveIndex(); }
    if (d.dirty) { clearTimeout(d.t); d.t = setTimeout(() => save(key), d.err ? 5000 : 300); }
    status(); drawDays();
}
function saveIndex() {
    clearTimeout(idxT);
    idxT = setTimeout(async () => {
        if (!idxDirty) return;
        if (!idxFresh && navigator.onLine) { saveIndex(); return; }   // wait for the saved list, so it is never written from an old copy
        idxDirty = false;
        try { await A.store().save("slides/" + INDEX, Object.assign({}, idx, { at: Date.now() })); } catch (e) { idxDirty = true; setTimeout(saveIndex, 5000); }
    }, 500);
}
async function flush() {
    const keys = Object.keys(decks).filter((key) => decks[key].dirty || decks[key].saving);
    for (const key of keys) { clearTimeout(decks[key].t); await save(key); let n = 0; while (decks[key].saving && n++ < 50) await new Promise((r) => setTimeout(r, 100)); }
}
function status() {
    const s = $("slSave"); if (!s) return;
    const ds = [decks[lessonKey()], decks[DAILY]].filter(Boolean);
    let t = "Saved", st = "ok";
    if (A && A.guest && A.guest()) { t = "Sample: not saved"; st = "wait"; }
    else if (ds.some((d) => !d.ready || !canEdit(d === decks[DAILY] ? DAILY : lessonKey()))) { t = "Getting your slides…"; st = "wait"; }
    else if (ds.some((d) => d.err)) { t = "Not saved yet (" + ds.find((d) => d.err).err + "). Trying again…"; st = "bad"; }
    else if (ds.some((d) => d.dirty || d.saving)) { t = navigator.onLine ? "Saving…" : "No wifi: saved on this computer"; st = "wait"; }
    if (s.title !== t || !s.firstChild) { s.textContent = ""; s.appendChild(el("span", null, t)); }   // a span, so a long one ends in "…" on a narrow screen
    s.dataset.state = st; s.title = t;
}

/* ---------- loading ---------- */
function watchDeck(key) {
    let d = decks[key];
    if (d && d.unsub) return;
    if (!d) d = decks[key] = { deck: cleanDeck(null), ready: false, fresh: false, since: Date.now(), dirty: false, saving: false, err: "" };
    d.since = Date.now(); d.fresh = false;
    d.unsub = A.store().watch("slides/" + key, (snap) => {
        if (snap.pending) return;
        const first = !d.ready; d.ready = true; if (!snap.fromCache) d.fresh = true;
        if (d.dirty || d.saving) { status(); return; }   // what is on this screen is newer
        const data = snap.exists ? snap.data : null;
        if (data && data.by === PAGE && !first) { status(); return; }
        d.deck = cleanDeck(data, key === DAILY ? MAX_DAILY : MAX_SLIDES); if (data && data.nod) d.deck.nod = true;
        if (cur.key === key && !S0()) { sel = []; editing = ""; }
        if (!S0() || (wantSlide && d.deck.slides.some((x) => x.id === wantSlide))) { pickFirst(); if (active) draw(); return; }
        sel = sel.filter((id) => byId(id));
        if (active) softDraw();
    }, () => { d.ready = true; d.err = d.err || "load"; status(); });
    setTimeout(() => { if (active) softDraw(); }, 6100);
}
function unwatch(key) { const d = decks[key]; if (!d || !d.unsub) return; d.unsub(); d.unsub = null; d.ready = false; d.fresh = false; }
let picks = new Set(), selMode = false;   // ticked slides ("<deck key>|<slide id>") and the Select switch in the slide list
let wantSlide = "";   // Spotlight > Edit this slide: open on that slide once its deck has arrived
function pickFirst() {
    const own = deckOf(lessonKey()), daily = deckOf(DAILY);
    if (wantSlide) { const inOwn = own && own.slides.some((x) => x.id === wantSlide), inDaily = daily && daily.slides.some((x) => x.id === wantSlide);
        if (inOwn || inDaily) { cur = { key: inOwn ? lessonKey() : DAILY, id: wantSlide }; wantSlide = ""; return; } }
    if (own && own.slides.length) cur = { key: lessonKey(), id: own.slides[0].id };
    else if (daily && daily.slides.length) cur = { key: DAILY, id: daily.slides[0].id };
    else cur = { key: lessonKey(), id: "" };
}
function setLesson(week, cls, day) {
    const w = weeks().find((x) => x.id === week) || weeks().find((x) => x.id === (A && A.S && A.S.week)) || weeks()[weeks().length - 1]; if (!w) return;
    const c = w.classes[cls] ? cls : Object.keys(w.classes)[0], dd = Math.max(0, Math.min(4, +day || 0));
    const old = lessonKey(), next = deckKey(w.id, c, dd);
    if (editing) finishEdit();
    if (old !== next && decks[old]) { const d = decks[old]; if (d.dirty) save(old); setTimeout(() => { if (old !== lessonKey()) unwatch(old); }, 1500); }
    lesson = { week: w.id, cls: c, day: dd }; hist = []; fut = []; sel = []; editing = "";
    watchDeck(next); watchDeck(DAILY);
    pickFirst();
    try { history.replaceState(null, "", "#slides/" + encodeURIComponent(w.id) + "/" + encodeURIComponent(c) + "/" + dd); } catch (e) { /* the hash is a convenience */ }
    draw();
}

/* ---------- drawing the editor ---------- */
function draw() { if (!active) return; drawLessonBar(); drawFilm(); drawCanvas(); drawTools(); drawNotes(); status(); }
/** Draw again after something that did not come from this person's hand (a saved copy arriving, the 6 s wait ending):
    an open menu stays open, and words being typed or a piece being dragged are left alone. */
function softDraw() {
    if (!active) return;
    drawLessonBar(); drawFilm(); drawNotes(); status();
    if (!editing && !drag) drawCanvas();
    if (!pop && !editing) drawTools();
}
function drawLessonBar() {
    const ws = $("slWeek"), cs = $("slClass"); if (!ws) return;
    const wl = weeks(), wsig = wl.map((w) => w.id).join();
    if (ws.dataset.sig !== wsig) { ws.textContent = ""; wl.slice().reverse().forEach((w) => { const o = el("option", null, weekName(w)); o.value = w.id; ws.appendChild(o); }); ws.dataset.sig = wsig; }
    ws.value = lesson.week;
    // the week stepper: "‹ Week 5 / Nov 16–20 ›", with the whole list one tap away (the select sits over the name)
    const wi = wl.findIndex((x) => x.id === lesson.week), wo = wl[wi] || null, nm = $("slWkName");
    if (nm && wo) { nm.firstChild.textContent = wo.label || wo.id; nm.lastChild.textContent = wo.dates ? String(wo.dates).replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/g, "$1") : ""; nm.lastChild.hidden = !wo.dates; nm.parentNode.title = weekName(wo); }
    const pv = $("slWkPrev"), nx = $("slWkNext");
    if (pv) { pv.disabled = wi <= 0; const w2 = wl[wi - 1]; pv.title = w2 ? "Back to " + weekName(w2) : "No earlier week"; pv.setAttribute("aria-label", pv.title); }
    if (nx) { nx.disabled = wi < 0 || wi >= wl.length - 1; const w2 = wl[wi + 1]; nx.title = w2 ? "On to " + weekName(w2) : "No later week"; nx.setAttribute("aria-label", nx.title); }
    const w = weekObj(), cl = Object.keys((w && w.classes) || {}), csig = cl.join();
    if (cs.dataset.sig !== csig) { cs.textContent = ""; cl.forEach((c) => { const o = el("option", null, (w.classes[c].label || c)); o.value = c; cs.appendChild(o); }); cs.dataset.sig = csig; }
    cs.value = lesson.cls; cs.parentNode.hidden = cl.length < 2;
    drawDays();
}
function drawDays() {
    const box = $("slDays"); if (!box) return; box.textContent = "";
    const w = weekObj();
    DK.forEach((name, i) => {
        const key = deckKey(lesson.week, lesson.cls, i), n = i === lesson.day && deckOf(key) ? countShown(deckOf(key)) : (idx.n[key] || 0);
        const b = btn("slday" + (i === lesson.day ? " on" : ""), "<b>" + name + "</b><small>" + (n ? n + (n === 1 ? " slide" : " slides") : (dateText(w, i, null) || "No slides").replace(/^[A-Za-z]+ /, (m) => m.slice(0, 3) + " ")) + "</small>", () => setLesson(lesson.week, lesson.cls, i), DAYS[i] + (n ? ", " + n + " slides" : ""));
        b.setAttribute("aria-pressed", String(i === lesson.day)); if (n) b.classList.add("has"); box.appendChild(b);
    });
}
/* The slide list down the left: every-day slides, then this day's. Drag a slide to move it, even from one list to the other. */
let filmCur = "";   // the open slide the list last scrolled to
/** A slide showing in the list and where it sits, so a redraw (a tick, the bar growing) can put it back in the same place. */
function filmAnchor(f) {
    const across = narrow.matches, fr = f.getBoundingClientRect();
    const items = [...f.querySelectorAll(".sfi")], vis = items.find((it) => { const r = it.getBoundingClientRect(); return across ? r.right > fr.left + 110 && r.left < fr.right : r.bottom > fr.top + 40 && r.top < fr.bottom; });
    if (!vis) return null;
    const r = vis.getBoundingClientRect();
    return { key: vis.dataset.key, id: vis.dataset.id, off: across ? r.left - fr.left : r.top - fr.top, across };
}
function drawFilm() {
    const f = $("slFilm"); if (!f) return;
    // Nov 24 (Eddie: "every time I select one it goes back to the top"): keep the list where it is across the redraw
    const keepTop = f.scrollTop, keepLeft = f.scrollLeft, anchor = f.childElementCount ? filmAnchor(f) : null;
    f.textContent = ""; spotIds = inSpot();
    const own = deckOf(lessonKey()), daily = deckOf(DAILY), lk = lessonKey();
    prunePicks(); f.appendChild(pickBar());
    const section = (key, deck, title, sub) => {
        const h = el("div", "sfh"); h.appendChild(el("b", null, title)); if (sub) h.appendChild(el("small", null, sub)); f.appendChild(h);
        const list = el("div", "sflist"); list.dataset.key = key;
        ((deck && deck.slides) || []).forEach((s, i) => list.appendChild(filmItem(key, s, i)));
        f.appendChild(list);
        return list;
    };
    const dl = section(DAILY, daily, "Every day", "Shows first in every lesson" + ((own && own.nod) ? " (off for " + DAYS[lesson.day] + ")" : ""));
    if (daily && daily.slides.length < MAX_DAILY) dl.appendChild(btn("sfadd small", icon("plus") + "<span>Every-day slide</span>", (e, b) => openPop(b, (p) => layoutMenu(p, DAILY)), "Add an every-day slide: your own board for the start of class, made once, filled in from each day's plan"));
    const w = weekObj(), L = classOf(w, lesson.cls);
    const ol = section(lk, own, DAYS[lesson.day] + "'s slides", [(L && L.label) || lesson.cls, (w && w.label) || ""].filter(Boolean).join(" · "));
    const row = el("div", "sfaddrow");
    row.appendChild(btn("sfadd", icon("plus") + "<span>New slide</span>", () => addSlide(lk, LAYOUTS.find((x) => x[0] === "blank")[2]()), "Add a blank slide"));
    row.appendChild(btn("sfadd lay", icon("layout"), (e, b) => openPop(b, (p) => layoutMenu(p, lk)), "Add a slide from a layout"));
    ol.appendChild(row);
    f.scrollTop = keepTop; f.scrollLeft = keepLeft;
    const back = anchor && [...f.querySelectorAll(".sfi")].find((it) => it.dataset.key === anchor.key && it.dataset.id === anchor.id);
    if (back) {   // the same slide, back in the same place, however much the bar above it grew or shrank
        const fr = f.getBoundingClientRect(), r = back.getBoundingClientRect();
        if (anchor.across) f.scrollLeft += (r.left - fr.left) - anchor.off; else f.scrollTop += (r.top - fr.top) - anchor.off;
    }
    // Scroll to the open slide only when a different slide was opened (not on every tick or edit).
    const sig = cur.key + "|" + cur.id, on = f.querySelector(".sfi.on");
    if (sig !== filmCur) {
        filmCur = sig;
        if (on) {
            const fr = f.getBoundingClientRect(), r = on.getBoundingClientRect();
            const out = narrow.matches ? r.left < fr.left + 110 || r.right > fr.right : r.top < fr.top + (picks.size ? 180 : 44) || r.bottom > fr.bottom;
            if (out) on.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    }
}
/** Narrower screens (css/slidedit.css): at 1180px the slide list is thinner; at 860px it runs across under the slide. */
const narrow = window.matchMedia("(max-width:860px)"), midSize = window.matchMedia("(max-width:1180px)");
[narrow, midSize].forEach((m) => m.addEventListener("change", () => { thumbs.clear(); if (active) drawFilm(); }));
/** The slides that already have a Spotlight screen, when the board is on this lesson (a badge on each, not a second list). */
function inSpot() {
    if (!A.spotScreens || !A.isLesson || !A.isLesson(lesson.week, lesson.cls, lesson.day)) return new Set();
    return new Set(A.spotScreens().map((x) => x.sl).filter(Boolean));
}
let spotIds = new Set();
function filmItem(key, s, i) {
    const it = el("div", "sfi" + (cur.key === key && cur.id === s.id ? " on" : "") + (s.hide ? " hid" : "")); it.dataset.key = key; it.dataset.id = s.id;
    it.appendChild(el("span", "sfn", String(i + 1)));
    const b = el("button", "sft"); b.type = "button"; b.setAttribute("aria-label", "Slide " + (i + 1) + ": " + slideName(s) + (s.hide ? " (hidden on the board)" : ""));
    b.setAttribute("aria-current", String(cur.key === key && cur.id === s.id));
    const tw = narrow.matches ? 120 : midSize.matches ? 150 : 176, sig = JSON.stringify([s, (A.S.look || {}).theme, (A.S.look || {}).bg, lesson, images ? images.version() : 0, tw]);
    let t = thumbs.get(s.id); if (!t || t.sig !== sig) { t = { sig, node: thumb(s, viewOpts({ edit: true, mark: false }), tw) }; thumbs.set(s.id, t); }
    b.appendChild(t.node);
    const pk = key + "|" + s.id, ticked = picks.has(pk);
    if (ticked) it.classList.add("picked");
    b.onclick = (e) => { if (selMode || e.shiftKey || e.ctrlKey || e.metaKey) togglePick(key, s.id, e.shiftKey); else openSlide(key, s.id); };
    it.appendChild(b);
    if (selMode || picks.size) {
        const c = btn("sfpk" + (ticked ? " on" : ""), icon("check"), () => togglePick(key, s.id), (ticked ? "Untick" : "Tick") + " slide " + (i + 1));
        c.setAttribute("role", "checkbox"); c.setAttribute("aria-checked", String(ticked)); it.appendChild(c);
    }
    const badges = el("span", "sfb");
    const rv = revealSteps(s); if (rv) badges.appendChild(el("span", "sfrv", rv + " on Next"));
    if (s.hide) badges.appendChild(el("span", "sfhid", "Hidden"));
    if (s.nt) badges.appendChild(el("span", "sfnt", "Notes"));
    if (s.pn) { const b3 = el("span", "sfpn", panelWords(s.pn)); b3.title = "Spotlight opens these when it reaches this slide"; badges.appendChild(b3); }
    if (spotIds.has(s.id)) { const b2 = el("span", "sfinsp", "In Spotlight"); b2.title = "This slide has a Spotlight screen, with its own panels and drawing"; badges.appendChild(b2); }
    it.appendChild(badges);
    it.appendChild(btn("sfm", icon("more"), (e, bb) => openPop(bb, (p) => slideMenu(p, key, s.id)), "More for slide " + (i + 1)));
    it.addEventListener("pointerdown", (e) => { if (!selMode) filmDrag(e, it, key, s.id); });   // no dragging while ticking
    return it;
}
function openSlide(key, id) { if (editing) finishEdit(); cur = { key, id }; sel = []; draw(); }

/* ---------- the canvas ---------- */
function drawCanvas() {
    const host = $("slCanvas"); if (!host) return;
    host.textContent = ""; slideEl = null;
    const s = S0();
    $("slStage").classList.toggle("blank", !s);
    if (!s) { host.appendChild(emptyLesson()); drawSel(); return; }
    slideEl = renderSlide(s, viewOpts({ edit: true, editing: editing.split(":")[0] === "" ? "" : (editing.includes(":") ? editing : editing), scale: k }));
    slideEl.classList.add("slcanvas");
    host.appendChild(slideEl);
    k = fitSlide(host, slideEl) || k;
    drawSel();
}
function emptyLesson() {
    const box = el("div", "sempty"), d = dayOf(), lk = lessonKey(), ready = canEdit(lk);
    box.appendChild(el("h2", null, ready ? "Start " + DAYS[lesson.day] + "'s slides" : "Getting your slides…"));
    if (!ready) return box;
    box.appendChild(el("p", null, "Start from your plan, a layout, or a blank slide. Everything you add can be moved, sized, changed or deleted."));
    const row = el("div", "semrow");
    if (d) {
        const frames = A.framesFor(lesson.week, lesson.cls, lesson.day) || [], n = fromPlan(classOf(weekObj(), lesson.cls), lesson.day, frames).length;
        const p = btn("sembig", icon("plan") + "<b>From my plan</b><small>" + n + " slides: Today, " + ((d.problems || []).length) + " bellringer problems, " + frames.filter((f) => !f.pdf).length + " notes steps</small>", () => addPlan(), "Make slides from this day's plan");
        row.appendChild(p);
    }
    row.appendChild(btn("sembig", icon("layout") + "<b>Pick a layout</b><small>Title, two columns, I do / we do / you do, exit ticket…</small>", (e, b) => openPop(b, (pp) => layoutMenu(pp, lk)), "Pick a layout"));
    row.appendChild(btn("sembig", icon("plus") + "<b>Blank slide</b><small>Start from nothing</small>", () => addSlide(lk, LAYOUTS[0][2]()), "Add a blank slide"));
    box.appendChild(row);
    if (!d) box.appendChild(el("p", "semnote", "This day has no plan yet, so live fields like {{agenda}} stay empty until it does."));
    return box;
}
function layoutPos() { if (!slideEl) return null; const r = slideEl.getBoundingClientRect(); return r; }
function toSlide(ev) { const r = layoutPos(); if (!r) return { x: 0, y: 0 }; const kk = r.width / SW; return { x: (ev.clientX - r.left) / kk, y: (ev.clientY - r.top) / kk }; }
function nodeOf(id) { return slideEl ? slideEl.querySelector('.sle[data-id="' + id + '"]') : null; }
function redrawEl(e) {
    const n = nodeOf(e.id); if (!n || !slideEl) return;
    const nn = renderEl(e, viewOpts({ edit: true, scale: k }), slideEl.dataset.ink || inkFor(S0() && S0().bg)); n.replaceWith(nn);
}
/* Selection frames, handles and snap guides, drawn over the slide in screen pixels. */
function drawSel(guides) {
    const ov = $("slOver"), stg = $("slStage"); if (!ov || !stg) return;
    ov.textContent = "";
    if (!slideEl) return;
    const st = stg.getBoundingClientRect(), r = slideEl.getBoundingClientRect(); k = r.width / SW;
    ov.style.left = (r.left - st.left) + "px"; ov.style.top = (r.top - st.top) + "px"; ov.style.width = r.width + "px"; ov.style.height = r.height + "px";
    const list = sel.map(byId).filter(Boolean), one = list.length === 1;
    list.forEach((e) => {
        if (e.k === "ln") {
            const L = el("div", "sfline"), len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) * k, a = Math.atan2(e.y2 - e.y1, e.x2 - e.x1) * 180 / Math.PI;
            L.style.left = e.x1 * k + "px"; L.style.top = e.y1 * k + "px"; L.style.width = len + "px"; L.style.transform = "rotate(" + a + "deg)"; ov.appendChild(L);
            if (one && !e.lk) [1, 2].forEach((w) => { const h = el("span", "hd hp"); h.dataset.h = "p" + w; h.style.left = e["x" + w] * k + "px"; h.style.top = e["y" + w] * k + "px"; h.title = "Drag the end"; ov.appendChild(h); });
            return;
        }
        const f = el("div", "sfr" + (e.lk ? " lk" : "") + (editing && editing.split(":")[0] === e.id ? " typing" : ""));
        f.style.left = e.x * k + "px"; f.style.top = e.y * k + "px"; f.style.width = e.w * k + "px"; f.style.height = e.h * k + "px";
        if (e.r) f.style.transform = "rotate(" + e.r + "deg)";
        if (e.lk) f.appendChild(el("span", "sflk", "Locked"));
        if (one && !e.lk && !editing) {
            const lockAspect = e.k === "mt" || e.k === "st" || e.k === "lg";
            (lockAspect ? ["nw", "ne", "se", "sw"] : ["nw", "n", "ne", "e", "se", "s", "sw", "w"]).forEach((h) => { const x = el("span", "hd h-" + h); x.dataset.h = h; f.appendChild(x); });
            const rot = el("span", "hd hrot"); rot.dataset.h = "rot"; rot.title = "Drag to turn (hold Shift for steps of 15°)"; f.appendChild(rot);
        }
        ov.appendChild(f);
    });
    if (list.length > 1) { const b = unionBox(list), g = el("div", "sfr grp"); g.style.left = b.x * k + "px"; g.style.top = b.y * k + "px"; g.style.width = b.w * k + "px"; g.style.height = b.h * k + "px"; ov.appendChild(g); }
    (guides || []).forEach((gd) => { const g = el("div", "sguide " + gd.d); if (gd.d === "v") g.style.left = gd.at * k + "px"; else g.style.top = gd.at * k + "px"; ov.appendChild(g); });
    if (drag && drag.kind === "box" && drag.rect) { const m = el("div", "smarq"), q = drag.rect; m.style.left = q.x * k + "px"; m.style.top = q.y * k + "px"; m.style.width = q.w * k + "px"; m.style.height = q.h * k + "px"; ov.appendChild(m); }
}
function unionBox(list) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    list.forEach((e) => { const b = boxOf(e); x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/* ---------- pointer: pick, move, size, turn, draw a box around ---------- */
function stageDown(ev) {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    closePop();
    const h = ev.target.closest(".hd");
    if (h) { ev.preventDefault(); return startHandle(ev, h.dataset.h); }
    if (editing) {
        if (ev.target.closest("[contenteditable=true],[contenteditable=plaintext-only]")) return;
        finishEdit();
    }
    const s = S0(); if (!s || !canEdit(cur.key)) return;
    const n = ev.target.closest(".slcanvas .sle");
    if (n) {
        const id = n.dataset.id, e = byId(id); if (!e) return;
        ev.preventDefault();
        const was = sel.includes(id);
        if (ev.shiftKey || ev.metaKey || ev.ctrlKey) { sel = was ? sel.filter((x) => x !== id) : sel.concat([id]); drawSel(); drawTools(); return; }
        if (!was) { sel = [id]; drawSel(); drawTools(); }
        startMove(ev, was);
        return;
    }
    if (!ev.shiftKey) { sel = []; drawTools(); }
    startBox(ev);
}
function capture(ev) { try { $("slStage").setPointerCapture(ev.pointerId); } catch (e) { /* fine */ } }
function startMove(ev, wasSel) {
    const items = sel.map(byId).filter((e) => e && !e.lk); if (!items.length) { drawSel(); return; }
    drag = { kind: "move", p0: toSlide(ev), items, orig: items.map((e) => JSON.parse(JSON.stringify(e))), moved: false, wasSel, id: items[0].id };
    capture(ev);
}
function startHandle(ev, h) {
    const e = byId(sel[0]); if (!e || e.lk) return;
    drag = { kind: h === "rot" ? "rot" : h[0] === "p" ? "pt" : "size", h, e, o: JSON.parse(JSON.stringify(e)), p0: toSlide(ev), moved: false };
    capture(ev);
}
function startBox(ev) { drag = { kind: "box", p0: toSlide(ev), keep: ev.shiftKey ? sel.slice() : [], rect: null }; capture(ev); }
function snapMove(dx, dy, orig, free) {
    if (free) return { dx, dy, g: [] };
    const T = 7 / k, ids = new Set(orig.map((o) => o.id)), others = (S0().els || []).filter((e) => !ids.has(e.id));
    const xs = [0, SW / 2, SW], ys = [0, SH / 2, SH];
    others.forEach((e) => { const b = boxOf(e); xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h); });
    const b = unionBox(orig), mx = [b.x, b.x + b.w / 2, b.x + b.w], my = [b.y, b.y + b.h / 2, b.y + b.h];
    let bx = null, by = null;
    mx.forEach((m) => xs.forEach((c) => { const d = c - (m + dx); if (Math.abs(d) < T && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, at: c }; }));
    my.forEach((m) => ys.forEach((c) => { const d = c - (m + dy); if (Math.abs(d) < T && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, at: c }; }));
    const g = []; if (bx) { dx += bx.d; g.push({ d: "v", at: bx.at }); } if (by) { dy += by.d; g.push({ d: "h", at: by.at }); }
    return { dx, dy, g };
}
const MIN = 16;
function stageMove(ev) {
    if (!drag) return;
    const p = toSlide(ev);
    if (drag.kind === "box") {
        const x = Math.min(p.x, drag.p0.x), y = Math.min(p.y, drag.p0.y), w = Math.abs(p.x - drag.p0.x), h = Math.abs(p.y - drag.p0.y);
        drag.rect = { x, y, w, h };
        if (w * k > 4 || h * k > 4) sel = drag.keep.concat((S0().els || []).filter((e) => { const b = boxOf(e); return !drag.keep.includes(e.id) && b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y; }).map((e) => e.id));
        drawSel(); return;
    }
    let dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    if (!drag.moved) { if (Math.hypot(dx, dy) * k < 3) return; drag.moved = true; before(); document.body.classList.add("sldragging"); }
    if (drag.kind === "move") {
        if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        const sn = snapMove(dx, dy, drag.orig, ev.altKey || ev.shiftKey); dx = sn.dx; dy = sn.dy;
        drag.items.forEach((e, i) => { const o = drag.orig[i]; if (e.k === "ln") { e.x1 = o.x1 + dx; e.y1 = o.y1 + dy; e.x2 = o.x2 + dx; e.y2 = o.y2 + dy; } else { e.x = o.x + dx; e.y = o.y + dy; } const n = nodeOf(e.id); if (n) n.style.translate = dx + "px " + dy + "px"; });
        drawSel(sn.g); return;
    }
    const e = drag.e, o = drag.o;
    if (drag.kind === "pt") {
        let x = p.x, y = p.y; const w = drag.h === "p1" ? 1 : 2, ox = w === 1 ? o.x2 : o.x1, oy = w === 1 ? o.y2 : o.y1;
        if (ev.shiftKey) { const a = Math.round(Math.atan2(y - oy, x - ox) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(x - ox, y - oy); x = ox + Math.cos(a) * len; y = oy + Math.sin(a) * len; }
        e["x" + w] = Math.round(x * 10) / 10; e["y" + w] = Math.round(y * 10) / 10; redrawEl(e); drawSel(); return;
    }
    if (drag.kind === "rot") {
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2; let a = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
        if (ev.shiftKey) a = Math.round(a / 15) * 15; else { const near = Math.round(a / 90) * 90; if (Math.abs(a - near) < 4) a = near; }
        a = ((a + 540) % 360) - 180; e.r = Math.round(a * 10) / 10; if (Math.abs(e.r) < 0.05 || Math.abs(Math.abs(e.r) - 360) < 0.05) delete e.r;
        const n = nodeOf(e.id); if (n) n.style.transform = e.r ? "rotate(" + e.r + "deg)" : ""; drawSel(); return;
    }
    // size: work in the piece's own turned frame, keeping the opposite side where it was
    const h = drag.h, sx = h.includes("e") ? 1 : h.includes("w") ? -1 : 0, sy = h.includes("s") ? 1 : h.includes("n") ? -1 : 0;
    const th = (o.r || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th), cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const lx = (p.x - cx) * cos + (p.y - cy) * sin, ly = -(p.x - cx) * sin + (p.y - cy) * cos;
    const ax = -sx * o.w / 2, ay = -sy * o.h / 2;
    let w = sx ? Math.max(MIN, sx * (lx - ax)) : o.w, hh = sy ? Math.max(MIN, sy * (ly - ay)) : o.h;
    const keep = e.k === "mt" || e.k === "st" || e.k === "lg" || (e.k === "pc" ? !ev.shiftKey : ev.shiftKey);
    if (keep && sx && sy) { const s = Math.max(w / o.w, hh / o.h); w = Math.max(MIN, o.w * s); hh = Math.max(MIN, o.h * s); }
    else if (keep && sx) hh = o.h * w / o.w; else if (keep && sy) w = o.w * hh / o.h;
    const ncx = sx ? ax + sx * w / 2 : 0, ncy = sy ? ay + sy * hh / 2 : 0;
    const gx = cx + ncx * cos - ncy * sin, gy = cy + ncx * sin + ncy * cos;
    e.w = Math.round(w * 10) / 10; e.h = Math.round(hh * 10) / 10; e.x = Math.round((gx - w / 2) * 10) / 10; e.y = Math.round((gy - hh / 2) * 10) / 10;
    redrawEl(e); drawSel();
}
function stageUp(ev) {
    if (!drag) return;
    const d = drag; drag = null; document.body.classList.remove("sldragging");
    if (d.kind === "box") { drawSel(); drawTools(); return; }
    if (!d.moved) {
        if (d.kind === "move" && d.wasSel && sel.length > 1 && !ev.shiftKey) { sel = [d.id]; drawSel(); drawTools(); }
        return;
    }
    const s = S0(); if (s) s.els.forEach((e) => { const c = cleanEl(e); if (c) Object.keys(c).forEach((key) => { e[key] = c[key]; }); });
    dirty(cur.key); drawCanvas(); refreshThumb(); drawTools();
}
function stageDbl(ev) {
    const hd = ev.target.closest(".slhd"), n = ev.target.closest(".slcanvas .sle"); if (!n) return;
    const e = byId(n.dataset.id); if (!e || e.lk) return;
    if (hd && e.k === "bx") return startEdit(e.id + ":hd", ev);
    if (e.k === "tb") { const c = ev.target.closest("td,th"); if (c) return startEdit(e.id + ":" + c.dataset.r + ":" + c.dataset.c, ev); }
    startEdit(e.id, ev);
}

/* ---------- typing on a slide ---------- */
function startEdit(what, ev) {
    const [id, a, b] = what.split(":"), e = byId(id); if (!e || e.lk || !canEdit(cur.key)) return;
    if (e.k === "mt") { sel = [id]; drawTools(); const t = $("slTools").querySelector(".tmath"); if (t) t.click(); return; }
    if (e.k === "pc") { sel = [id]; pickPicture(id); return; }
    if (e.k === "st") { if (e.t === "w") { sel = [id]; drawTools(); const t = $("slTools").querySelector(".tword"); if (t) t.click(); } return; }
    if (e.k !== "bx" && e.k !== "tb") return;
    sel = [id]; editing = what; drawCanvas(); drawTools();
    const node = a === "hd" ? nodeOf(id).querySelector(".slhd") : e.k === "tb" ? nodeOf(id).querySelector('[data-r="' + a + '"][data-c="' + b + '"]') : nodeOf(id).querySelector(".sltxi");
    if (!node) { editing = ""; return; }
    if (e.k === "bx" && !a) { node.classList.remove("slph"); if (!e.html) node.textContent = ""; }
    try { node.contentEditable = e.k === "bx" && !a ? "true" : "plaintext-only"; } catch (x) { node.contentEditable = "true"; }
    if (node.contentEditable !== "plaintext-only" && node.contentEditable !== "true") node.contentEditable = "true";
    node.spellcheck = true; node.focus();
    try { document.execCommand("styleWithCSS", false, true); } catch (x) { /* older browsers use tags, which the cleaner turns into the same thing */ }
    const sl = window.getSelection(); let range = null;
    if (ev && ev.clientX != null && document.caretRangeFromPoint) range = document.caretRangeFromPoint(ev.clientX, ev.clientY);
    if (!range || !node.contains(range.startContainer)) { range = document.createRange(); range.selectNodeContents(node); if (e.k === "bx" && !a && !e.html) range.collapse(false); else if (!ev) range.collapse(false); }
    sl.removeAllRanges(); sl.addRange(range);
    node.addEventListener("blur", () => setTimeout(() => { if (editing === what && document.activeElement !== node && !(pop && pop.contains(document.activeElement))) finishEdit(); }, 0));
    node.addEventListener("paste", (pe) => { pe.preventDefault(); const t = (pe.clipboardData && pe.clipboardData.getData("text/plain")) || ""; document.execCommand("insertText", false, t.slice(0, 4000)); });
    drawSel();
}
function editNode() {
    if (!editing) return null; const [id, a, b] = editing.split(":"), n = nodeOf(id); if (!n) return null;
    return a === "hd" ? n.querySelector(".slhd") : a != null ? n.querySelector('[data-r="' + a + '"][data-c="' + b + '"]') : n.querySelector(".sltxi");
}
function finishEdit() {
    if (!editing) return;
    const what = editing, [id, a, b] = what.split(":"), e = byId(id), node = editNode();
    editing = "";
    if (e && node) {
        if (a === "hd") { const t = node.textContent.replace(/\s+/g, " ").trim().slice(0, 80); if (t !== e.hd) { before(); if (t) e.hd = t; else { delete e.hd; delete e.hf; delete e.hc; } dirty(cur.key); } }
        else if (e.k === "tb") { const t = (node.innerText || "").replace(/\n+$/, "").slice(0, 300); if (t !== e.rows[+a][+b]) { before(); e.rows[+a][+b] = t; dirty(cur.key); } }
        else { const html = sanitizeHtml(node.innerHTML.replace(/<br><\/div>/g, "</div>")); const clean = textOf(html) ? html : ""; if (clean !== e.html) { before(); e.html = clean; dirty(cur.key); } }
    }
    try { window.getSelection().removeAllRanges(); } catch (x) { /* fine */ }
    drawCanvas(); drawTools(); refreshThumb();
}
const typing = () => { const n = editNode(); return n && document.activeElement === n ? n : null; };
function exec(cmd, val) { const n = typing(); if (!n) return false; document.execCommand(cmd, false, val); return true; }
function insertText(t) { const n = typing(); if (!n) return false; document.execCommand("insertText", false, t); return true; }

/* ---------- adding things ---------- */
/** Where a new piece goes: the open spot that covers the least of what is already there, as near the middle as that allows. */
function freeAt(w, h) {
    const s = S0(), cx = 800 - w / 2, cy = 450 - h / 2, boxes = s ? s.els.map(boxOf) : [];
    if (!boxes.length) return { x: Math.round(cx), y: Math.round(cy) };
    const W2 = Math.min(w, SW - 40), H2 = Math.min(h, SH - 40);
    let best = null;
    for (let y = 20; y <= SH - 20 - H2; y += 30) for (let x = 20; x <= SW - 20 - W2; x += 30) {
        let cover = 0; boxes.forEach((b) => { const ox = Math.min(x + W2, b.x + b.w) - Math.max(x, b.x), oy = Math.min(y + H2, b.y + b.h) - Math.max(y, b.y); if (ox > 0 && oy > 0) cover += ox * oy; });
        const score = cover + Math.hypot(x - cx, y - cy) * 40;
        if (!best || score < best.score) best = { x, y, score };
    }
    return best ? { x: best.x, y: best.y } : { x: Math.round(cx), y: Math.round(cy) };
}
function addEl(e, edit) {
    if (!e) return; if (!S0()) addSlide(lessonKey(), LAYOUTS[0][2](), true);
    const s = S0(); if (!s) return; if (s.els.length >= 80) return toast("A slide holds 80 pieces at most.");
    if (e.k !== "ln") Object.assign(e, freeAt(e.w, e.h));
    change((sl) => { sl.els.push(e); }); sel = [e.id]; drawSel(); drawTools();
    if (edit) startEdit(e.id);
}
function addSlide(key, slide, quiet) {
    const d = deckOf(key); if (!d) return;
    const max = key === DAILY ? MAX_DAILY : MAX_SLIDES; if (d.slides.length >= max) { toast(key === DAILY ? "Up to " + MAX_DAILY + " every-day slides." : "A lesson holds " + MAX_SLIDES + " slides at most."); return; }
    const at = cur.key === key ? d.slides.findIndex((s) => s.id === cur.id) + 1 : d.slides.length;
    if (!changeDeck(key, (dd) => { dd.slides.splice(at > 0 ? at : dd.slides.length, 0, slide); })) return;
    cur = { key, id: slide.id }; sel = []; if (!quiet) draw();
}
function addPlan() {
    const L = classOf(weekObj(), lesson.cls), frames = A.framesFor(lesson.week, lesson.cls, lesson.day) || [];
    const list = fromPlan(L, lesson.day, frames), d = deckOf(lessonKey()); if (!d || !list.length) return;
    const room = MAX_SLIDES - d.slides.length; if (room <= 0) return toast("This lesson already has " + MAX_SLIDES + " slides.");
    if (!changeDeck(lessonKey(), (dd) => { dd.slides = dd.slides.concat(list.slice(0, room)); })) return;
    cur = { key: lessonKey(), id: list[0].id }; sel = []; draw();
    toast("Added " + Math.min(room, list.length) + " slides from your plan. Change anything: double-click text to type.");
}
function addTable(nr, nc) { addEl(newEl("table", { nr, nc })); }
function addMath(key) {
    const it = newItem(key, { x: 0.5, y: 0.5 }); if (!it) return;
    if (it.k === "plane") it.fx = ["", "", ""]; if (it.k === "numline") Object.assign(it, { min: -10, max: 10, step: "1" });
    const b = mathBox(it, (x, W, H) => geom(x, W, H, null));
    addEl(cleanEl(Object.assign({ k: "mt", it, id: newId("e") }, b)));
}
function addSticker(t, v, c) {
    const words = t === "w", long = t === "m" && v.length > 3;
    const h = words ? 110 : long ? 130 : 190, w = words ? Math.max(260, 70 + v.length * 34) : long ? Math.max(240, v.length * 46) : 190;
    addEl(cleanEl({ k: "st", id: newId("e"), t, v, c: c || 0, w, h }));
}
function addLive(key) {
    if (insertText("{{" + key + "}}")) return;
    const f = LIVE.find((x) => x[0] === key); if (!f) return;
    const list = Array.isArray(f[2]);
    if (list) addEl(newEl("card", { hd: f[1], html: "{{" + key + "}}", w: 640, h: 420, fs: 40 }));
    else addEl(newEl("text", { html: (key === "day" || key === "topic" ? "<b>{{" + key + "}}</b>" : "{{" + key + "}}"), w: 1100, h: 120, fs: key === "lt" ? 44 : 60, va: "m" }));
}
/* Pictures: shrunk on this device to fit the free database (about 300 KB each), never sent anywhere else. */
let picFor = "";
function pickPicture(replaceId) {
    picFor = replaceId || "";
    let inp = $("slFile"); if (!inp) { inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.id = "slFile"; inp.hidden = true; R.appendChild(inp); inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ""; if (f) addPicture(f, picFor); }; }
    inp.click();
}
async function addPicture(file, replaceId) {
    if (!file || !/^image\//.test(file.type)) return toast("That isn't a picture.");
    if (!canEdit(cur.key) && S0()) return;
    toast("Adding the picture…");
    const sh = await shrink(file); if (!sh) return toast("That picture could not be read.");
    const id = ("p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(0, 20);
    images.put(id, sh.d);
    // Wait a moment for the save. With no wifi it waits in this device's queue and goes up before the slide
    // that shows it (Firestore sends one device's writes in order), so the picture goes on the slide now.
    const saving = A.store().save("slideimg/" + id, { d: sh.d, w: sh.w, h: sh.h, at: Date.now() });
    const first = await Promise.race([saving.then(() => "ok", (e) => e || {}), new Promise((r) => setTimeout(() => r("slow"), 4000))]);
    if (first !== "ok" && first !== "slow") { toast("The picture was not saved (" + (first.code || "connection") + ")."); return; }
    if (first === "slow") saving.catch((e) => toast("A picture was not saved (" + ((e && e.code) || "connection") + "). Delete it and add it again."));
    const done = first === "slow" ? (navigator.onLine ? " It is still saving." : " It goes up to the board when the wifi is back.") : "";
    const alt = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 120);
    if (replaceId && byId(replaceId)) { change((s) => { const e = s.els.find((x) => x.id === replaceId); if (e) { e.img = id; e.alt = alt; e.h = Math.round(e.w * sh.h / sh.w); } }); toast("Picture changed." + done); return; }
    const sc = Math.min(1000 / sh.w, 620 / sh.h, 2.4), w = Math.max(120, Math.round(sh.w * sc)), h = Math.max(80, Math.round(sh.h * sc));
    addEl(cleanEl({ k: "pc", id: newId("e"), img: id, w, h, fit: "contain", alt }));
    toast("Picture added." + done);
}
function loadImg(file) { return new Promise((res) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; }); }
async function shrink(file) {
    const im = await loadImg(file); if (!im || !im.naturalWidth) return null;
    let side = 1600, q = 0.82;
    for (let i = 0; i < 6; i++) {
        const s = Math.min(1, side / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
        const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d"); ctx.drawImage(im, 0, 0, w, h);
        let d = c.toDataURL("image/webp", q);
        if (!/^data:image\/webp/.test(d)) { ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); d = c.toDataURL("image/jpeg", q); }
        if (d.length <= 720000) return { d, w, h };
        side = Math.round(side * 0.75); q = Math.max(0.5, q - 0.08);
    }
    return null;
}

/* ---------- slides: duplicate, delete, move, hide, every day ---------- */
function slideMenu(p, key, id) {
    const d = deckOf(key), i = d ? d.slides.findIndex((s) => s.id === id) : -1; if (i < 0) return;
    const s = d.slides[i], other = key === DAILY ? lessonKey() : DAILY, item = (ic, t, fn, cls) => p.appendChild(btn("spi" + (cls ? " " + cls : ""), icon(ic) + "<span>" + t + "</span>", () => { closePop(); fn(); }));
    p.appendChild(el("p", "sph", "Slide " + (i + 1)));
    item("dup", "Duplicate", () => dupSlide(key, id));
    if (i > 0) item("caret", "Move up", () => moveSlide(key, id, key, i - 1), "up");
    if (i < d.slides.length - 1) item("caret", "Move down", () => moveSlide(key, id, key, i + 1));
    item("every", key === DAILY ? "Only on " + DAYS[lesson.day] : "Show every day", () => moveSlide(key, id, other, (deckOf(other) || { slides: [] }).slides.length));
    item(s.hide ? "reveal" : "hide", s.hide ? "Show it on the board" : "Hide it on the board", () => changeDeck(key, (dd) => { const x = dd.slides.find((q) => q.id === id); if (x) { if (x.hide) delete x.hide; else x.hide = true; } }));
    item("copyto", "Copy to another day…", () => { openSlide(key, id); setTimeout(() => { const b = $("slMore"); if (b) openPop(b, copyMenu); }, 0); });
    item("board", "Put it on the board, stay here", () => { openSlide(key, id); showOnBoard(); });
    item("trash", "Delete slide", () => delSlide(key, id), "danger");
}
function dupSlide(key, id) {
    const d = deckOf(key), s = d && d.slides.find((x) => x.id === id); if (!s) return;
    const c = cleanSlide(JSON.parse(JSON.stringify(s))); c.id = newId("s"); c.els.forEach((e) => { e.id = newId("e"); });
    const max = key === DAILY ? MAX_DAILY : MAX_SLIDES; if (d.slides.length >= max) return toast("No room for another slide here.");
    changeDeck(key, (dd) => { dd.slides.splice(dd.slides.findIndex((x) => x.id === id) + 1, 0, c); }); cur = { key, id: c.id }; sel = []; draw();
}
function delSlide(key, id) {
    const d = deckOf(key); if (!d) return; const i = d.slides.findIndex((x) => x.id === id); if (i < 0) return;
    changeDeck(key, (dd) => { dd.slides.splice(i, 1); });
    if (cur.key === key && cur.id === id) { const n = d.slides[Math.min(i, d.slides.length - 1)]; if (n) cur = { key, id: n.id }; else pickFirst(); }
    sel = []; draw(); toast("Slide deleted. Undo brings it back.");
}
/* ---------- several slides at once (Nov 24): tick them, then act on them all ---------- */
/** The ticked slides in list order (every-day first, then the day's): [{ key, id, s }]. */
function pickedList() {
    const out = [];
    [DAILY, lessonKey()].forEach((key) => { const d = deckOf(key); ((d && d.slides) || []).forEach((s) => { if (picks.has(key + "|" + s.id)) out.push({ key, id: s.id, s }); }); });
    return out;
}
/** Drop ticks for slides that are gone (deleted, another lesson opened). */
function prunePicks() {
    const live = new Set(); [DAILY, lessonKey()].forEach((key) => { const d = deckOf(key); ((d && d.slides) || []).forEach((s) => live.add(key + "|" + s.id)); });
    [...picks].forEach((k) => { if (!live.has(k)) picks.delete(k); });
}
let lastPick = "";
/** Tick or untick one slide. Shift ticks the run from the last one ticked (same list). */
function togglePick(key, id, run) {
    const k = key + "|" + id, d = deckOf(key), cut = lastPick.lastIndexOf("|");   // deck keys hold "|" themselves (week|class|day): split at the last one
    if (run && cut > 0 && lastPick.slice(0, cut) === key && d) {
        const ids = d.slides.map((x) => x.id), a = ids.indexOf(lastPick.slice(cut + 1)), b = ids.indexOf(id);
        if (a >= 0 && b >= 0) { ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => picks.add(key + "|" + x)); lastPick = k; drawFilm(); return; }
    }
    if (picks.has(k)) picks.delete(k); else picks.add(k);
    lastPick = k; drawFilm();
}
function setSelMode(on) { selMode = !!on; if (!selMode) picks.clear(); drawFilm(); }
/** The bar above the slide list: Select, and when slides are ticked, what to do with all of them. */
function pickBar() {
    const bar = el("div", "sfpick" + (picks.size ? " sfpkon" : "")); bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Several slides at once");
    const all = [DAILY, lessonKey()].reduce((n, k) => n + (((deckOf(k) || {}).slides || []).length), 0);
    if (!selMode && !picks.size) {
        bar.appendChild(btn("sfsel", icon("check") + "<span>Select</span>", () => setSelMode(true), "Tick several slides to put in Spotlight, set panels, copy or delete at once"));
        return bar;
    }
    if (narrow.matches) {   // a phone: the strip is short and scrolls sideways
        if (picks.size) return pickBarCompact(bar, picks.size, picks.size === 1 ? "slide" : "slides");
        bar.appendChild(el("b", "sfpkn", "Tick slides")); bar.appendChild(btn("sfpkx", "Done", () => setSelMode(false), "Stop selecting")); return bar;
    }
    const top = el("div", "sfpkrow");
    top.appendChild(el("b", "sfpkn", picks.size ? picks.size + " selected" : "Tick slides"));
    if (picks.size < all) top.appendChild(btn("sfpkx", "All", () => { [DAILY, lessonKey()].forEach((k) => ((deckOf(k) || {}).slides || []).forEach((s) => picks.add(k + "|" + s.id))); drawFilm(); }, "Tick every slide"));
    top.appendChild(btn("sfpkx", "Done", () => setSelMode(false), "Stop selecting"));
    bar.appendChild(top);
    if (!picks.size) return bar;
    const n = picks.size, sl = n === 1 ? "slide" : "slides";
    if (A.goMode && A.spot) bar.appendChild(btn("btn amber sfpkgo", icon("spot") + "<span>Put " + n + " in Spotlight</span>", () => picksToSpotlight(), "Make a Spotlight screen for each ticked slide, in order, and open Spotlight on the first"));
    const g = el("div", "sfpkacts");
    g.appendChild(btn("sfpka", icon("panels") + "<span>Panels</span>", (e, b) => openPop(b, picksPanelsMenu), "Timer, learning target or agenda for all " + n + " " + sl));
    g.appendChild(btn("sfpka", icon("dup") + "<span>Duplicate</span>", () => picksDup(), "Duplicate all " + n + " " + sl));
    g.appendChild(btn("sfpka", icon("copyto") + "<span>Copy to…</span>", (e, b) => openPop(b, copyMenu), "Copy the " + n + " " + sl + " to another day or class"));
    const hid = pickedList().every((x) => x.s.hide);
    g.appendChild(btn("sfpka", icon(hid ? "reveal" : "hide") + "<span>" + (hid ? "Show" : "Hide") + "</span>", () => picksHide(!hid), (hid ? "Show" : "Hide") + " them on the board"));
    g.appendChild(btn("sfpka danger", icon("trash") + "<span>Delete</span>", () => picksDelete(), "Delete all " + n + " " + sl + " (Undo brings them back)"));
    bar.appendChild(g);
    return bar;
}
/** The same bar on a phone (the slide strip runs across under the slide): the count, Spotlight, and the rest under ⋯. */
function pickBarCompact(bar, n, sl) {
    bar.classList.add("sfpkc");
    bar.appendChild(el("b", "sfpkn", n + " selected"));
    if (A.goMode && A.spot) bar.appendChild(btn("btn amber sfpkgo", icon("spot") + "<span>Spotlight</span>", () => picksToSpotlight(), "Put the " + n + " ticked " + sl + " in Spotlight"));
    bar.appendChild(btn("sfpkx sfpkmore", icon("more") + "<span>More</span>", (e, b) => openPop(b, (p) => {
        p.appendChild(el("p", "sph", n + " " + sl));
        const item = (ic, t, fn, cls) => p.appendChild(btn("spi" + (cls ? " " + cls : ""), icon(ic) + "<span>" + t + "</span>", () => { closePop(); fn(b); }));
        item("panels", "Panels for all", (bb) => setTimeout(() => openPop(bb, picksPanelsMenu), 0));
        item("dup", "Duplicate", () => picksDup());
        item("copyto", "Copy to another day or class", (bb) => setTimeout(() => openPop(bb, copyMenu), 0));
        const hid = pickedList().every((x) => x.s.hide);
        item(hid ? "reveal" : "hide", hid ? "Show on the board" : "Hide on the board", () => picksHide(!hid));
        item("check", "Tick all", () => { [DAILY, lessonKey()].forEach((k) => ((deckOf(k) || {}).slides || []).forEach((s) => picks.add(k + "|" + s.id))); drawFilm(); });
        item("trash", "Delete", () => picksDelete(), "danger");
        item("caret", "Done selecting", () => setSelMode(false));
    }), "More for the ticked slides"));
    return bar;
}
/** One Undo step for a change to several slides, across both lists. */
function changePicked(fn) {
    const list = pickedList(); if (!list.length) return 0;
    const keys = [...new Set(list.map((x) => x.key))].filter((k) => canEdit(k)); if (!keys.length) return 0;
    before(); const n = fn(list.filter((x) => keys.includes(x.key)), keys); keys.forEach((k) => dirty(k)); return n;
}
function picksDelete() {
    const n = changePicked((list) => { list.forEach(({ key, id }) => { const d = deckOf(key), i = d.slides.findIndex((x) => x.id === id); if (i >= 0) d.slides.splice(i, 1); }); return list.length; });
    if (!n) return;
    if (picks.has(cur.key + "|" + cur.id)) { picks.clear(); pickFirst(); } else picks.clear();
    sel = []; selMode = false; draw(); toast(n + (n === 1 ? " slide" : " slides") + " deleted. Undo brings them back.");
}
function picksDup() {
    let full = 0;
    const n = changePicked((list) => {
        let made = 0; const fresh = [];
        list.forEach(({ key, id, s: src }) => {
            const d = deckOf(key), max = key === DAILY ? MAX_DAILY : MAX_SLIDES; if (d.slides.length >= max) { full++; return; }
            const c = cleanSlide(JSON.parse(JSON.stringify(src))); c.id = newId("s"); c.els.forEach((e) => { e.id = newId("e"); });
            d.slides.splice(d.slides.findIndex((x) => x.id === id) + 1, 0, c); fresh.push(key + "|" + c.id); made++;
        });
        picks = new Set(fresh); return made;   // the copies are ticked, ready for Panels or Spotlight
    });
    draw(); toast(n ? "Duplicated " + n + (n === 1 ? " slide" : " slides") + (full ? ". " + full + " did not fit." : ".") : "No room for more slides here.");
}
function picksHide(hide) {
    const n = changePicked((list) => { list.forEach(({ s: x }) => { if (hide) x.hide = 1; else delete x.hide; }); return list.length; });
    if (n) { draw(); toast(n + (n === 1 ? " slide" : " slides") + (hide ? " hidden on the board." : " showing on the board again.")); }
}
/** Panels for every ticked slide: a pick sets that panel on all of them; a mixed one shows as "Some". */
function picksPanelsMenu(p) {
    const list = pickedList(); if (!list.length) return;
    const all = (f) => list.every((x) => f(x.s.pn || {})), some = (f) => list.some((x) => f(x.s.pn || {}));
    const set = (fn) => {
        changePicked((l) => { l.forEach(({ s: x }) => { const o = Object.assign({}, x.pn || {}); fn(o); const c = cleanPanels(o); if (c) x.pn = c; else delete x.pn; }); return l.length; });
        draw(); setTimeout(() => { const b = document.querySelector(".sfpka[title^='Timer']") || document.querySelector(".sfpkmore"); if (b && !pop) openPop(b, picksPanelsMenu); }, 0);
    };
    p.appendChild(el("p", "sph", "For all " + list.length + " slides, when Spotlight reaches each one"));
    p.appendChild(el("p", "spnote spfirst", "Timer"));
    const r = el("div", "srow");
    r.appendChild(btn("spchip" + (all((o) => !o.tm) ? " on" : ""), "Off", () => set((o) => { delete o.tm; })));
    PANEL_MINS.forEach((m) => r.appendChild(btn("spchip" + (all((o) => o.tm === m * 60) ? " on" : ""), m + " min", () => set((o) => { o.tm = m * 60; }), "A " + m + " minute timer on all of them")));
    p.appendChild(r);
    const tog = (k, name, sub) => {
        const on = all((o) => o[k] === true), mixed = !on && some((o) => o[k] === true);
        const b = btn("spi smi" + (on ? " on" : ""), icon(on ? "check" : "plus") + "<span><b>" + name + (mixed ? " (some)" : "") + "</b><small>" + sub + "</small></span>", () => set((o) => { if (on) delete o[k]; else o[k] = true; }));
        b.setAttribute("aria-pressed", on ? "true" : mixed ? "mixed" : "false"); p.appendChild(b);
    };
    tog("tg", "Learning target", "The day's \"I can\" from your plan");
    tog("ag", "Agenda", "The day's agenda from your plan");
    p.appendChild(el("p", "spnote", "Each slide opens these by itself when Spotlight gets to it."));
}
/** Put every ticked slide in Spotlight: the board goes to this lesson, a screen is made for each (in list order, after the
    screen showing now; slides already in Spotlight keep theirs) and Spotlight opens on the first. */
function picksToSpotlight() {
    if (editing) finishEdit();
    const ids = pickedList().map((x) => x.id); if (!ids.length) return;
    flush().then(() => {
        if (!A.goLesson(lesson.week, lesson.cls, lesson.day)) return toast("That lesson is not on the board's list of weeks.");
        A.goMode("spot");
        // the board's copy of this lesson's slides arrives a moment after the lesson changes
        const tryAdd = (n) => {
            if (!(A.spot.slidesReady && A.spot.slidesReady()) || !ids.every((id) => A.spot.slides().some((x) => x.id === id))) { if (n < 30) return setTimeout(() => tryAdd(n + 1), 150); }
            const before0 = new Set((A.spotScreens ? A.spotScreens() : []).map((x) => x.sl).filter(Boolean));
            const added = A.spot.addSlides(ids, "first");
            if (!added) A.spot.openSlide(ids[0]);
            const had = ids.filter((id) => before0.has(id)).length;
            toast(added ? "In Spotlight: " + added + " new " + (added === 1 ? "screen" : "screens") + (had ? ", " + had + " already there" : "") + "." : "Those slides are already in Spotlight.");
            picks.clear(); selMode = false;
        };
        tryAdd(0);
    });
}
function moveSlide(fromKey, id, toKey, at) {
    const a = deckOf(fromKey), b = deckOf(toKey); if (!a || !b || !canEdit(fromKey) || !canEdit(toKey)) return;
    const i = a.slides.findIndex((x) => x.id === id); if (i < 0) return;
    if (fromKey !== toKey && b.slides.length >= (toKey === DAILY ? MAX_DAILY : MAX_SLIDES)) return toast(toKey === DAILY ? "Up to " + MAX_DAILY + " every-day slides." : "That lesson is full.");
    before();
    const [s] = a.slides.splice(i, 1);
    b.slides.splice(Math.max(0, Math.min(b.slides.length, fromKey === toKey && at > i ? at : at)), 0, s);
    dirty(fromKey); if (toKey !== fromKey) dirty(toKey);
    if (cur.id === id) cur = { key: toKey, id };
    draw();
    if (fromKey !== toKey) toast(toKey === DAILY ? "It shows at the start of every lesson now." : "It shows only on " + DAYS[lesson.day] + " now.");
}
/* Drag a slide in the list: a short drag picks it up; drop it between others, in either list. */
function filmDrag(ev, it, key, id) {
    if (ev.target.closest(".sfm") || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    const y0 = ev.clientY, x0 = ev.clientX; let on = false, mark = null, target = null;
    const move = (e) => {
        if (!on) { if (Math.hypot(e.clientX - x0, e.clientY - y0) < 8) return; on = true; it.classList.add("lift"); document.body.classList.add("sldragging"); }
        e.preventDefault();
        const lists = [...$("slFilm").querySelectorAll(".sflist")]; let best = null;
        lists.forEach((l) => { const items = [...l.querySelectorAll(".sfi")]; const r = l.getBoundingClientRect(); if (e.clientY < r.top - 30 || e.clientY > r.bottom + 30) return;
            let at = items.length; for (let j = 0; j < items.length; j++) { const rr = items[j].getBoundingClientRect(); if (e.clientY < rr.top + rr.height / 2) { at = j; break; } }
            best = { key: l.dataset.key, at, before: items[at] || l.querySelector(".sfaddrow,.sfadd,.sfempty") }; });
        if (mark) mark.remove(); mark = null; target = best;
        if (best) { mark = el("div", "sfdrop"); const l = $("slFilm").querySelector('.sflist[data-key="' + best.key + '"]'); if (best.before) l.insertBefore(mark, best.before); else l.appendChild(mark); }
    };
    const up = () => {
        document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
        it.classList.remove("lift"); document.body.classList.remove("sldragging"); if (mark) mark.remove();
        if (!on || !target) return;
        const from = deckOf(key), i = from ? from.slides.findIndex((s) => s.id === id) : -1; if (i < 0) return;
        let at = target.at; if (target.key === key && at > i) at--;
        if (target.key === key && at === i) return;
        moveSlide(key, id, target.key, at);
    };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
}

/* ---------- popovers ---------- */
function openPop(anchor, build, cls) {
    if (pop && popFor === anchor) { closePop(); return; }
    closePop();
    pop = el("div", "spop" + (cls ? " " + cls : "")); pop.setAttribute("role", "dialog"); popFor = anchor;
    build(pop);
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = Math.min(window.innerWidth - pw - 8, Math.max(8, r.left)), y = r.bottom + 6;
    if (y + ph > window.innerHeight - 8) y = Math.max(8, r.top - ph - 6);
    pop.style.left = x + "px"; pop.style.top = y + "px";
    anchor.setAttribute("aria-expanded", "true");
}
function closePop() { if (!pop) return; pop.remove(); pop = null; if (popFor) popFor.setAttribute("aria-expanded", "false"); popFor = null; }
function swatches(p, current, onPick, opts) {
    const o = opts || {}, g = el("div", "ssw");
    if (o.none) { const b = btn("spsw none" + (!current ? " on" : ""), "", () => { onPick(""); if (!o.stay) closePop(); }, o.none); g.appendChild(b); }
    PALETTE.forEach(([c, n]) => { const b = btn("spsw" + (current === c ? " on" : ""), "", () => { onPick(c); if (!o.stay) closePop(); }, n); b.style.background = c; g.appendChild(b); });
    p.appendChild(g);
    const row = el("label", "scustom"); row.appendChild(el("span", null, "Any color"));
    const inp = el("input"); inp.type = "color"; inp.value = /^#[0-9a-f]{6}$/.test(current || "") ? current : "#10358a"; inp.oninput = () => onPick(inp.value, true); inp.onchange = () => onPick(inp.value);
    row.appendChild(inp); p.appendChild(row);
}
let layCount = 1;
/** Add a layout several times in a row (one Undo step), after the slide that is open; the new ones are ticked. */
function addMany(key, make, n) {
    if (n <= 1) return addSlide(key, make());
    const d = deckOf(key); if (!d) return;
    const max = key === DAILY ? MAX_DAILY : MAX_SLIDES, room = max - d.slides.length;
    if (room <= 0) return toast(key === DAILY ? "Up to " + MAX_DAILY + " every-day slides." : "A lesson holds " + MAX_SLIDES + " slides at most.");
    const made = Array.from({ length: Math.min(n, room) }, () => make());
    const at = cur.key === key ? d.slides.findIndex((s) => s.id === cur.id) + 1 : d.slides.length;
    if (!changeDeck(key, (dd) => { dd.slides.splice(at > 0 ? at : dd.slides.length, 0, ...made); })) return;
    cur = { key, id: made[0].id }; sel = []; picks = new Set(made.map((x) => key + "|" + x.id)); selMode = true; draw();
    toast("Added " + made.length + " slides" + (made.length < n ? " (" + (n - made.length) + " did not fit)" : "") + ". They are ticked: set their panels or put them in Spotlight.");
}
function layoutMenu(p, key) {
    p.classList.add("slay"); p.appendChild(el("p", "sph", key === DAILY ? "New every-day slide" : "New slide"));
    // How many of the picked layout to add (Nov 24: "get a lot of layouts set up for class")
    const many = key === DAILY ? [1, 2, 3] : [1, 3, 5, 10];
    const cnt = el("div", "srow slaycnt"); cnt.appendChild(el("span", "spnote", "How many"));
    many.forEach((m) => { const c = btn("spchip" + (layCount === m ? " on" : ""), String(m), () => { layCount = m; cnt.querySelectorAll(".spchip").forEach((x) => x.classList.toggle("on", x.textContent === String(m))); }, "Add " + m + " at once"); cnt.appendChild(c); });
    if (!many.includes(layCount)) layCount = 1;
    p.appendChild(cnt);
    const g = el("div", "slaygrid");
    LAYOUTS.forEach(([id, name, make]) => {
        const s = make(), b = btn("slayb", "", () => { closePop(); addMany(key, make, layCount); }, name);
        b.appendChild(thumb(s, viewOpts({ edit: false, mark: false }), 132)); b.appendChild(el("span", null, name)); g.appendChild(b);
    });
    p.appendChild(g);
    if (key !== DAILY) {
        const L = classOf(weekObj(), lesson.cls);
        if (L) p.appendChild(btn("spi", icon("plan") + "<span>The week's agenda, as a slide</span>", () => { closePop(); addSlide(key, agendaSlide(L)); }));
    }
}

/* ---------- panels per slide (Spotlight opens them when it reaches the slide) ---------- */
function panelsMenu(p) {
    const s = S0(); if (!s) return;
    const pn = s.pn || {};
    const set = (fn) => {
        change((sl) => { const o = Object.assign({}, sl.pn || {}); fn(o); const c = cleanPanels(o); if (c) sl.pn = c; else delete sl.pn; });
        setTimeout(() => { const b = $("slPanelsBtn"); if (b && !pop) openPop(b, panelsMenu); }, 0);   // stay open for the next pick
    };
    p.appendChild(el("p", "sph", "When Spotlight reaches this slide"));
    p.appendChild(el("p", "spnote spfirst", "Timer"));
    const r = el("div", "srow");
    r.appendChild(btn("spchip" + (!pn.tm ? " on" : ""), "Off", () => set((o) => { delete o.tm; })));
    PANEL_MINS.forEach((m) => r.appendChild(btn("spchip" + (pn.tm === m * 60 ? " on" : ""), m + " min", () => set((o) => { o.tm = m * 60; }), "Start with a " + m + " minute timer")));
    p.appendChild(r);
    const tog = (key, name, sub) => {
        const on = pn[key] === true;
        const b = btn("spi smi" + (on ? " on" : ""), icon(on ? "check" : "plus") + "<span><b>" + name + "</b><small>" + sub + "</small></span>", () => set((o) => { if (on) delete o[key]; else o[key] = true; }));
        b.setAttribute("aria-pressed", String(on)); p.appendChild(b);
    };
    tog("tg", "Learning target", "The day's \"I can\" from your plan");
    tog("ag", "Agenda", "The day's agenda from your plan");
    p.appendChild(el("p", "spnote", "Spotlight opens these by itself when it gets to this slide. If you close one in class, it stays closed."));
}

/* ---------- slides from the standards bank: practice problems, or a Show Steps walkthrough ---------- */
function bankMenu(p) {
    p.appendChild(el("p", "sph", "From the standards bank"));
    p.appendChild(btn("spi smi", icon("bank") + "<span><b>Practice problems</b><small>Pick a few. Each gets its own slide, with the answer on Next.</small></span>", () => { closePop(); openBank("prob"); }));
    p.appendChild(btn("spi smi", icon("steps") + "<span><b>Show Steps</b><small>A worked walkthrough. Next plays it one step at a time.</small></span>", () => { closePop(); openBank("walk"); }));
}
const byCode = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
/** The day's standards first (its bellringer problems), then the rest of the week's for this class. */
function lessonCodes() {
    const L = classOf(weekObj(), lesson.cls), out = [];
    const add = (d) => ((d && d.problems) || []).forEach((x) => { if (x && x.std) out.push(String(x.std)); });
    add(dayOf()); ((L && L.days) || []).forEach(add);
    return [...new Set(out)];
}
let bankDlg = null;
async function openBank(mode) {
    if (bankDlg) bankDlg.close();
    const walk = mode === "walk", cls = lesson.cls, lk = lessonKey();
    const dlg = el("dialog", "spick"); bankDlg = dlg;
    dlg.setAttribute("aria-label", walk ? "Show Steps on a slide" : "Practice problems from the bank");
    const head = el("div", "spk-head"); head.appendChild(el("h2", null, walk ? "Show Steps on a slide" : "Practice problems from the bank"));
    const x = btn("spk-x", svg('<path d="M6 6l12 12M18 6 6 18"/>'), () => dlg.close(), "Close"); head.appendChild(x);
    const body = el("div", "spk-body"); body.appendChild(el("p", "spk-wait", "Getting the bank…"));
    dlg.append(head, body);
    let player = null;
    dlg.addEventListener("close", () => { if (player) player.destroy(); dlg.remove(); if (bankDlg === dlg) bankDlg = null; });
    document.body.appendChild(dlg); dlg.showModal();

    let mods;
    try {
        mods = await Promise.all([import("./stdBank.js?v=5"), import("./weekSheets.js?v=60"), import("../data/standards.js?v=59"),
            walk ? import("./walkBank.js?v=14") : null, walk ? import("./stepPlayer.js?v=6") : null]);
    } catch (e) { body.textContent = ""; body.appendChild(el("p", "spk-wait", "The bank didn't load. Check the connection and try again.")); return; }
    const [sb, ws, st, wb, spm] = mods, rich = ws.rich;
    const every = walk ? await wb.loadWalkItems() : await sb.loadStdBank();
    let all = every.filter((it) => sb.inClass(it, cls));
    if (!all.length) all = every;   // a class the bank doesn't know (a new teacher's, the sample): the whole bank, the lesson's standards first
    if (!dlg.open) return;
    const stdText = (code) => { for (const c of Object.values(st.STANDARDS || {})) { const f = ((c && c.standards) || []).find((y) => y.code === code); if (f) return f.text || ""; } return ""; };
    const hasWalk = (it) => !walk || wb.walkOf(it).ok;
    const count = (code) => all.filter((it) => it.std === code && hasWalk(it)).length;
    const first = lessonCodes().filter((c) => count(c));
    const rest = [...new Set(all.map((it) => it.std))].filter((c) => !first.includes(c)).sort(byCode);
    let cur = first[0] || rest.find((c) => count(c)) || "", lvl = 0;
    let ok = {}, edits = {}, checksIn = !walk, pick = null;
    const picked = [];   // problems mode: the ones ticked, in the order ticked
    if (walk) Promise.all([readOnce("walk/ok"), readOnce("walk/edits")]).then(([o, e]) => { ok = wb.cleanOk(o); edits = wb.cleanEdits(e); checksIn = true; if (dlg.open) { drawList(); drawPick(); } });

    body.textContent = "";
    const top = el("div", "spk-top"), chips = el("div", "srow spk-chips"), other = el("select", "spk-other"), text = el("p", "spk-std"), lv = el("div", "srow spk-lv");
    other.setAttribute("aria-label", "Another standard");
    top.append(chips, other);
    const main = el("div", "spk-main" + (walk ? " two" : "")), list = el("div", "spk-list"), side = el("div", "spk-side");
    main.appendChild(list); if (walk) main.appendChild(side);
    const foot = el("div", "spk-foot");
    body.append(top, text); if (!walk) body.appendChild(lv); body.append(main, foot);
    other.onchange = () => { if (other.value) { cur = other.value; pick = null; drawAll(); } };

    function drawTop() {
        chips.textContent = "";
        first.slice(0, 8).forEach((c) => { const b = btn("spchip" + (c === cur ? " on" : ""), c + " · " + count(c), () => { cur = c; pick = null; drawAll(); }); b.setAttribute("aria-pressed", String(c === cur)); chips.appendChild(b); });
        if (!first.length) chips.appendChild(el("span", "spk-none", "No standards on this day's plan yet. Pick one:"));
        other.textContent = ""; const o0 = el("option", null, first.length ? "Another standard…" : "Pick a standard…"); o0.value = ""; other.appendChild(o0);
        [...first.slice(8), ...rest].filter((c) => count(c)).forEach((c) => { const op = el("option", null, c + " · " + count(c) + (walk ? " walkthroughs" : " problems")); op.value = c; other.appendChild(op); });
        other.value = first.slice(0, 8).includes(cur) ? "" : cur;
        const t = stdText(cur); text.textContent = cur ? cur + (t ? ": " + t : "") : "";
        text.hidden = !cur;
        lv.textContent = "";
        [[0, "All levels"], [1, sb.LEVELS[1]], [2, sb.LEVELS[2]], [3, sb.LEVELS[3]]].forEach(([v, n]) => { const b = btn("spchip" + (v === lvl ? " on" : ""), n, () => { lvl = v; drawList(); drawTop(); }); b.setAttribute("aria-pressed", String(v === lvl)); lv.appendChild(b); });
    }
    function drawList() {
        list.textContent = "";
        const items = all.filter((it) => it.std === cur && (!lvl || it.lvl === lvl) && hasWalk(it));
        if (!items.length) { list.appendChild(el("p", "spk-none", cur ? (walk ? "No walkthroughs for " + cur + " yet." : "No bank problems for " + cur + " at this level.") : "Pick a standard.")); return; }
        items.forEach((it) => {
            const row = el("button", "spk-row"); row.type = "button";
            const q = el("div", "spk-q"); q.appendChild(rich(it.q));
            const meta = el("div", "spk-meta");
            if (walk) {
                const w = wb.walkOf(it);
                meta.appendChild(el("span", null, w.steps.length + " steps"));
                if (checksIn) meta.appendChild(el("span", ok[it.id] ? "spk-ok" : "spk-un", ok[it.id] ? "Checked" : "Not checked yet"));
                row.setAttribute("aria-pressed", String(pick === it.id));
                row.onclick = () => { pick = it.id; drawList(); drawPick(); };
            } else {
                const a = el("div", "spk-a"); a.appendChild(el("span", null, "Answer ")); a.appendChild(rich(it.a)); q.appendChild(a);
                meta.appendChild(el("span", null, sb.LEVELS[it.lvl] || ""));
                const n = picked.findIndex((y) => y.id === it.id);
                if (n >= 0) meta.appendChild(el("span", "spk-ok", "Slide " + (n + 1)));
                row.setAttribute("aria-pressed", String(n >= 0));
                row.onclick = () => { const i = picked.findIndex((y) => y.id === it.id); if (i >= 0) picked.splice(i, 1); else picked.push(it); drawList(); drawFoot(); };
            }
            const tick = el("span", "spk-tick"); tick.innerHTML = svg(IC.check);
            row.append(tick, q, meta); list.appendChild(row);
        });
    }
    function drawPick() {
        if (!walk) return;
        if (player) { player.destroy(); player = null; }
        side.textContent = "";
        const it = all.find((y) => y.id === pick);
        if (!it) { side.appendChild(el("p", "spk-none", "Pick a problem to watch its walkthrough here first.")); drawFoot(); return; }
        const w = wb.walkOf(it), host = el("div", "spk-player");
        side.appendChild(host);
        player = spm.createStepPlayer(host, wb.withEdits(w, edits[it.id]), {});
        drawFoot();
        if (narrow.matches) host.scrollIntoView({ block: "start", behavior: "smooth" });   // on a phone the preview sits under the list
    }
    function drawFoot() {
        foot.textContent = "";
        const d = deckOf(lk), room = d ? MAX_SLIDES - d.slides.length : 0;
        if (!walk) {
            foot.appendChild(el("p", "spk-note", picked.length ? picked.length + " picked. Each gets its own slide, with the answer on Next." : "Tap problems to pick them. Each gets its own slide, with the answer on Next."));
            const add = btn("spk-go", picked.length > 1 ? "Add " + picked.length + " slides" : "Add the slide", () => addBank(), "Add the picked problems as slides");
            add.disabled = !picked.length || !canEdit(lk) || room < picked.length;
            if (picked.length > room) foot.appendChild(el("p", "spk-note bad", "A lesson holds " + MAX_SLIDES + " slides. There's room for " + Math.max(0, room) + " more."));
            foot.appendChild(add); return;
        }
        const it = all.find((y) => y.id === pick);
        const checked = !!(it && ok[it.id]);
        foot.appendChild(el("p", "spk-note", !it ? "Only walkthroughs you've checked show on the board." : !checksIn ? "Getting your checks…" : checked ? "You've checked this one. Next on the board plays it one step at a time." : "Watch it through. Adding it marks it checked, since only checked walkthroughs show on the board."));
        const add = btn("spk-go", checked || !it ? "Add the slide" : "Looks right, add it", () => addWalk(it, checked));
        add.disabled = !it || !checksIn || !canEdit(lk) || room < 1;
        foot.appendChild(add);
    }
    function drawAll() { drawTop(); drawList(); drawPick(); drawFoot(); }
    function addBank() {
        const n = picked.length, slides = picked.map((it, i) => bankSlide(it, i, n));
        if (!insertSlides(lk, slides)) return;
        dlg.close(); toast(n > 1 ? "Added " + n + " problem slides. Each answer shows on Next." : "Added a problem slide. The answer shows on Next.");
    }
    async function addWalk(it, checked) {
        if (!it) return;
        const w = wb.walkOf(it); if (!w.ok) return;
        let warn = "";
        if (!checked) {
            const ids = Object.assign({}, ok, { [it.id]: Date.now() }); ok = ids;
            try { await A.store().save("walk/ok", { ids, at: Date.now() }); } catch (e) { warn = " Your check didn't save (" + ((e && e.code) || "connection") + "), so check it on the Show Steps page before class."; }
        }
        if (!insertSlides(lk, [walkSlide(it, w.steps.length)])) return;
        dlg.close(); toast("Added the Show Steps slide." + warn);
    }
    drawAll();
}
/** Put new slides into a lesson right after the open slide (or at the end), and open the first. */
function insertSlides(key, slides) {
    const d = deckOf(key); if (!d || !slides.length) return false;
    if (d.slides.length + slides.length > MAX_SLIDES) { toast("A lesson holds " + MAX_SLIDES + " slides at most."); return false; }
    const at = cur.key === key ? d.slides.findIndex((s) => s.id === cur.id) + 1 : d.slides.length;
    if (!changeDeck(key, (dd) => { dd.slides.splice(at > 0 ? at : dd.slides.length, 0, ...slides); })) return false;
    cur = { key, id: slides[0].id }; sel = []; draw(); return true;
}

/* ---------- the toolbar across the top ---------- */
const FS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96, 110, 120, 140, 160, 180, 200, 240, 280, 320];
function drawTools() {
    const bar = $("slTools"); if (!bar) return;
    closePop(); bar.textContent = "";
    const s = S0(), ready = !!s && canEdit(cur.key), list = sel.map(byId).filter(Boolean), one = list.length === 1 ? list[0] : null;
    const grp = (cls) => { const g = el("div", "tgrp" + (cls ? " " + cls : "")); bar.appendChild(g); return g; };
    const tb = (g, ic, label, fn, opts) => { const o = opts || {}; const b = btn("tb" + (o.cls ? " " + o.cls : "") + (o.on ? " on" : "") + (o.text ? " txt" : ""), (ic ? icon(ic) : "") + (o.text ? "<span>" + o.text + "</span>" : "") + (o.menu ? svg(IC.caret, "icc") : ""), fn, label); if (o.on != null) b.setAttribute("aria-pressed", String(!!o.on)); if (o.dis) b.disabled = true; g.appendChild(b); return b; };
    let g = grp();
    tb(g, "undo", "Undo (Ctrl+Z)", () => undo(), { dis: !hist.length });
    tb(g, "redo", "Redo (Ctrl+Shift+Z)", () => redo(), { dis: !fut.length });
    g = grp("ins");
    const dis = !canEdit(lessonKey());
    tb(g, "text", "Text box", () => addEl(newEl("text"), true), { text: "Text", dis });
    tb(g, "card", "Card with a heading", () => addEl(newEl("card"), false), { text: "Card", dis });
    tb(g, "shape", "Shapes", (e, b) => openPop(b, shapeMenu), { text: "Shape", menu: 1, dis });
    tb(g, "line", "Lines and arrows", (e, b) => openPop(b, lineMenu), { text: "Line", menu: 1, dis });
    tb(g, "table", "Table", (e, b) => openPop(b, tableMenu), { text: "Table", menu: 1, dis });
    tb(g, "pic", "Picture from this computer (or paste one)", () => pickPicture(""), { text: "Picture", dis });
    tb(g, "math", "Math tools: graphs, number lines, fraction bars, algebra tiles", (e, b) => openPop(b, mathMenu, "wide"), { text: "Math", menu: 1, dis });
    tb(g, "sticker", "Stickers", (e, b) => openPop(b, stickerMenu, "wide"), { text: "Sticker", menu: 1, dis });
    tb(g, "live", "Live fields: fill in from the day's plan", (e, b) => openPop(b, liveMenu), { text: "Live", menu: 1, dis });
    g = grp("slideg");
    tb(g, "bg", "Background of this slide", (e, b) => openPop(b, bgMenu, "wide"), { text: "Background", menu: 1, dis: !ready });
    tb(g, "layout", "New slide from a layout", (e, b) => openPop(b, (p) => layoutMenu(p, cur.key || lessonKey())), { text: "Layout", menu: 1, dis: !canEdit(cur.key || lessonKey()) });
    tb(g, "panels", s && s.pn ? "Panels for this slide: " + panelWords(s.pn) : "Open a timer, learning target or agenda when Spotlight reaches this slide", (e, b) => openPop(b, panelsMenu), { text: "Panels", menu: 1, on: !!(s && s.pn), dis: !ready }).id = "slPanelsBtn";
    tb(g, "bank", "Slides from the standards bank: practice problems or a Show Steps walkthrough", (e, b) => openPop(b, bankMenu), { text: "Bank", menu: 1, dis });
    if (!ready) { bar.appendChild(el("span", "thint", s ? "Getting your slides…" : "Add a slide to start.")); return; }
    if (!list.length) return;   // nothing picked: the tools alone (the old "click a piece…" hint cost a whole row on a Chromebook)
    const boxes = list.filter((e) => e.k === "bx");
    if (boxes.length) formatText(grp("fmt"), boxes, tb);
    if (one && one.k === "ln") formatLine(grp("fmt"), one, tb);
    if (one && one.k === "tb") formatTable(grp("fmt"), one, tb);
    if (one && one.k === "pc") formatPic(grp("fmt"), one, tb);
    if (one && one.k === "mt") { const gg = grp("fmt"); tb(gg, "settings", "Change this math tool", (e, b) => openPop(b, (p) => mathSettings(p, one.id), "wide"), { text: "Change it", cls: "tmath" }); }
    if (one && one.k === "st" && one.t === "w") { const gg = grp("fmt"); tb(gg, "sticker", "Change the words and color", (e, b) => openPop(b, (p) => wordSettings(p, one.id)), { text: "Words", cls: "tword" }); }
    const c = grp("common");
    const rv = one ? (one.ap || 0) : 0;
    tb(c, "reveal", rv ? "Shows on Next press " + rv + " (click to change)" : "Show it on a Next press, not right away", (e, b) => openPop(b, (p) => revealMenu(p, list)), { text: rv ? "Next " + rv : (list.some((x) => x.ap) ? "Next…" : "Reveal"), on: list.some((x) => x.ap), menu: 1 });
    tb(c, "arrange", "Order and line up", (e, b) => openPop(b, (p) => arrangeMenu(p, list)), { text: "Arrange", menu: 1 });
    tb(c, "dup", "Duplicate (Ctrl+D)", () => duplicate());
    tb(c, list.some((x) => x.lk) ? "lock" : "unlock", list.some((x) => x.lk) ? "Unlock" : "Lock it in place", () => change((sl) => { const lk = !list.some((x) => x.lk); sl.els.forEach((e) => { if (sel.includes(e.id)) { if (lk) e.lk = true; else delete e.lk; } }); }), { on: list.some((x) => x.lk) });
    tb(c, "more", "See-through", (e, b) => openPop(b, (p) => opacityMenu(p, list)));
    tb(c, "trash", "Delete (Del)", () => delSel(), { cls: "danger" });
}
function setEls(fn, tag) { change((s) => { s.els.forEach((e) => { if (sel.includes(e.id)) fn(e); }); }, tag); }
function formatText(g, boxes, tb) {
    const b0 = boxes[0], typingNow = !!typing();
    const fb = tb(g, "", "Font", (e, b) => openPop(b, (p) => { p.appendChild(el("p", "sph", "Font")); FONTS.forEach(([id, name, css]) => { const x = btn("spi" + (b0.ff === id ? " on" : ""), "<span style='font-family:" + css.replace(/'/g, "") + "'>" + name + "</span>", () => { closePop(); setEls((e2) => { if (e2.k === "bx") e2.ff = id; }); }); p.appendChild(x); }); }), { text: (FONTS.find((f) => f[0] === b0.ff) || FONTS[0])[1], menu: 1, cls: "tfont" });
    void fb;
    const size = (dir) => setEls((e) => { if (e.k !== "bx") return; let i = FS.findIndex((v) => v >= e.fs); if (i < 0) i = FS.length - 1; if (dir > 0) i = FS[i] > e.fs ? i : Math.min(FS.length - 1, i + 1); else i = Math.max(0, FS[i] < e.fs ? i : i - 1); e.fs = FS[i]; }, "size");
    tb(g, "minus", "Smaller text", () => size(-1), { cls: "tsz" });
    g.appendChild(el("span", "tszv", String(Math.round(b0.fs))));
    tb(g, "plus", "Bigger text", () => size(1), { cls: "tsz" });
    const wrapAll = (tag) => setEls((e) => { if (e.k !== "bx" || !e.html) return; const re = new RegExp("^<" + tag + ">([\\s\\S]*)</" + tag + ">$"); e.html = re.test(e.html) ? e.html.replace(re, "$1") : "<" + tag + ">" + e.html + "</" + tag + ">"; e.html = sanitizeHtml(e.html); });
    [["b", "bold", "Bold (Ctrl+B)", "<b>B</b>"], ["i", "italic", "Italic (Ctrl+I)", "<i>I</i>"], ["u", "underline", "Underline (Ctrl+U)", "<u>U</u>"], ["s", "strikeThrough", "Cross out", "<s>S</s>"]].forEach(([tag, cmd, label, face]) => {
        const b = btn("tb tglyph", face, () => { if (!exec(cmd)) wrapAll(tag); }, label); g.appendChild(b);
    });
    g.appendChild(btn("tb tglyph", "x<sup>2</sup>", () => { if (!exec("superscript")) toast("Type x^2 for a power, or select text while typing and press this."); }, "Small and raised (a power)"));
    const tc = btn("tb tcolor", "<b>A</b><i style='background:" + (b0.fc || "#888") + "'></i>", (e, b) => openPop(b, (p) => { p.appendChild(el("p", "sph", typingNow ? "Color of the picked words" : "Text color")); swatches(p, b0.fc, (c, live) => { if (typing()) { if (c) exec("foreColor", c); return; } if (live) return; setEls((x) => { if (x.k === "bx") x.fc = c; }); }, { none: "Automatic (shows up on the background)" }); }), "Text color");
    g.appendChild(tc);
    g.appendChild(btn("tb tcolor hl", "<b>ab</b><i style='background:#fff3b0'></i>", (e, b) => openPop(b, (p) => { p.appendChild(el("p", "sph", "Highlight the picked words")); if (!typing()) p.appendChild(el("p", "spnote", "Double-click the text, pick some words, then choose a color.")); swatches(p, "", (c) => { exec("hiliteColor", c || "transparent"); }, { none: "No highlight" }); }), "Highlight"));
    [["l", "al", "Left"], ["c", "ac", "Center"], ["r", "ar", "Right"]].forEach(([a, ic, n]) => tb(g, ic, "Line up " + n.toLowerCase(), () => setEls((e) => { if (e.k === "bx") e.al = a; }), { on: b0.al === a }));
    tb(g, b0.va === "t" ? "vt" : b0.va === "b" ? "vb" : "vm", "Up and down: top, middle or bottom", (e, b) => openPop(b, (p) => { [["t", "vt", "Top"], ["m", "vm", "Middle"], ["b", "vb", "Bottom"]].forEach(([v, ic, n]) => p.appendChild(btn("spi" + (b0.va === v ? " on" : ""), icon(ic) + "<span>" + n + "</span>", () => { closePop(); setEls((x) => { if (x.k === "bx") x.va = v; }); }))); }), { menu: 1 });
    const listFn = (ordered) => { if (exec(ordered ? "insertOrderedList" : "insertUnorderedList")) return; setEls((e) => { if (e.k !== "bx") return; const tag = ordered ? "ol" : "ul"; const m = new RegExp("^<" + tag + ">([\\s\\S]*)</" + tag + ">$").exec(e.html);
        if (m) e.html = sanitizeHtml(m[1].replace(/<li[^>]*>/g, "<div>").replace(/<\/li>/g, "</div>")); else { const lines = textOf(e.html) ? e.html.replace(/<\/?(ul|ol)>/g, "").split(/<br>|<\/div>|<\/li>/).map((x) => x.replace(/<\/?(div|li)[^>]*>/g, "").trim()).filter(Boolean) : ["Point"]; e.html = sanitizeHtml("<" + tag + ">" + lines.map((x) => "<li>" + x + "</li>").join("") + "</" + tag + ">"); } }); };
    tb(g, "ul", "Bulleted list", () => listFn(false));
    tb(g, "ol", "Numbered list", () => listFn(true));
    tb(g, "keys", "Math keys: fractions, powers, roots, symbols", (e, b) => openPop(b, mathKeys), { menu: 1 });
    // the box itself
    tb(g, "fill", "Fill color", (e, b) => openPop(b, (p) => { p.appendChild(el("p", "sph", "Fill")); swatches(p, b0.fill, (c, live) => { if (live) return; setEls((x) => { if (x.k === "bx") x.fill = c; }); }, { none: "No fill" }); }), { menu: 1, cls: "tfill" });
    tb(g, "border", "Border", (e, b) => openPop(b, (p) => borderMenu(p, b0)), { menu: 1 });
    tb(g, "shadow", b0.sd ? "Shadow on" : "Shadow", () => setEls((x) => { if (x.k !== "bx") return; if (x.sd) delete x.sd; else x.sd = true; }), { on: !!b0.sd });
    if (boxes.length === 1) tb(g, "shape", "Change the shape", (e, b) => openPop(b, (p) => shapeMenu(p, b0.id)), { menu: 1 });
    tb(g, "head", b0.hd ? "Heading (double-click it to change the words)" : "Add a heading strip", (e, b) => openPop(b, (p) => headingMenu(p, b0)), { on: !!b0.hd, menu: 1 });
}
function borderMenu(p, b0) {
    p.appendChild(el("p", "sph", "Border color"));
    swatches(p, b0.ln, (c, live) => { if (live) return; setEls((x) => { if (x.k !== "bx") return; x.ln = c; if (c && !x.lw) x.lw = 4; }); }, { none: "No border" });
    p.appendChild(el("p", "sph", "Thickness"));
    const r = el("div", "srow"); [0, 2, 4, 6, 10, 16].forEach((w) => r.appendChild(btn("spchip" + (b0.lw === w ? " on" : ""), w ? w + "" : "None", () => { closePop(); setEls((x) => { if (x.k !== "bx") return; x.lw = w; if (w && !x.ln) x.ln = "#14213d"; }); })));
    p.appendChild(r);
    p.appendChild(el("p", "sph", "Line"));
    const r2 = el("div", "srow"); [["", "Solid"], ["d", "Dashed"], ["o", "Dotted"]].forEach(([d, n]) => r2.appendChild(btn("spchip" + ((b0.dash || "") === d ? " on" : ""), n, () => { closePop(); setEls((x) => { if (x.k === "bx") x.dash = d; }); })));
    p.appendChild(r2);
    if (b0.sh === "round" || b0.sh === "rect") {
        p.appendChild(el("p", "sph", "Corners"));
        const r3 = el("div", "srow"); [[0, "Square"], [14, "Soft"], [28, "Round"], [56, "Rounder"], [120, "Pill"]].forEach(([v, n]) => r3.appendChild(btn("spchip" + ((b0.rd || 0) === v ? " on" : ""), n, () => { closePop(); setEls((x) => { if (x.k !== "bx") return; x.rd = v; x.sh = v ? "round" : "rect"; }); })));
        p.appendChild(r3);
    }
}
function headingMenu(p, b0) {
    p.appendChild(el("p", "sph", "Heading strip"));
    p.appendChild(btn("spi", icon(b0.hd ? "minus" : "plus") + "<span>" + (b0.hd ? "Take the heading off" : "Add a heading") + "</span>", () => { closePop(); setEls((x) => { if (x.k !== "bx") return; if (x.hd) { delete x.hd; delete x.hf; delete x.hc; } else { x.hd = "Heading"; x.hf = "#10358a"; if (!x.fill) x.fill = "#ffffff"; } }); }));
    if (b0.hd) { p.appendChild(el("p", "spnote", "Double-click the heading on the slide to change its words.")); p.appendChild(el("p", "sph", "Heading color")); swatches(p, b0.hf, (c, live) => { if (live) return; setEls((x) => { if (x.k === "bx" && x.hd) x.hf = c || "#10358a"; }); }); }
}
function mathKeys(p) {
    p.appendChild(el("p", "sph", "Math keys"));
    const typingNow = !!typing();
    if (!typingNow) p.appendChild(el("p", "spnote", "Double-click a text box first. Then these type into it. Or type them yourself: {3/4} is a fraction, x^2 a power, √{49} a root."));
    const g = el("div", "skeys");
    [["Fraction", "{ / }", "{/}", 2], ["Power", "x²", "^{}", 1], ["Root", "√", "√{}", 1], ["×", "×", "×"], ["÷", "÷", "÷"], ["−", "−", "−"], ["±", "±", "±"], ["=", "=", " = "], ["≠", "≠", "≠"], ["<", "<", " < "], [">", ">", " > "], ["≤", "≤", "≤"], ["≥", "≥", "≥"],
        ["π", "π", "π"], ["°", "°", "°"], ["∠", "∠", "∠"], ["△", "△", "△"], ["≈", "≈", "≈"], ["∞", "∞", "∞"], ["|x|", "| |", "||", 1], ["( )", "( )", "()", 1]].forEach(([n, face, t, back]) => {
        const b = btn("skey", face, () => { if (!insertText(t)) return; if (back) { const s2 = window.getSelection(); for (let i = 0; i < back; i++) s2.modify("move", "backward", "character"); } }, n);
        b.disabled = !typingNow; g.appendChild(b);
    });
    p.appendChild(g);
}
function formatLine(g, e, tb) {
    tb(g, "fill", "Line color", (ev, b) => openPop(b, (p) => { p.appendChild(el("p", "sph", "Line color")); swatches(p, e.ln, (c, live) => { if (live || !c) return; setEls((x) => { if (x.k === "ln") x.ln = c; }); }); }), { menu: 1 });
    tb(g, "", "Thickness", (ev, b) => openPop(b, (p) => { const r = el("div", "srow"); [2, 4, 6, 8, 12, 16, 24].forEach((w) => r.appendChild(btn("spchip" + (e.lw === w ? " on" : ""), String(w), () => { closePop(); setEls((x) => { if (x.k === "ln") x.lw = w; }); }))); p.appendChild(r); }), { text: "Thickness " + e.lw, menu: 1 });
    tb(g, "", "Solid, dashed or dotted", (ev, b) => openPop(b, (p) => { [["", "Solid"], ["d", "Dashed"], ["o", "Dotted"]].forEach(([d, n]) => p.appendChild(btn("spi" + (e.dash === d ? " on" : ""), "<span>" + n + "</span>", () => { closePop(); setEls((x) => { if (x.k === "ln") x.dash = d; }); }))); }), { text: { "": "Solid", d: "Dashed", o: "Dotted" }[e.dash], menu: 1 });
    const heads = [["", "Plain"], ["arrow", "Arrow"], ["dot", "Dot"], ["bar", "Bar"]];
    ["a1", "a2"].forEach((which, i) => tb(g, "", i ? "End of the line" : "Start of the line", (ev, b) => openPop(b, (p) => { heads.forEach(([h, n]) => p.appendChild(btn("spi" + (e[which] === h ? " on" : ""), "<span>" + n + "</span>", () => { closePop(); setEls((x) => { if (x.k === "ln") x[which] = h; }); }))); }), { text: (i ? "End: " : "Start: ") + (heads.find((x) => x[0] === e[which]) || heads[0])[1], menu: 1 }));
}
function formatTable(g, e, tb) {
    tb(g, "minus", "Smaller text", () => setEls((x) => { if (x.k === "tb") x.fs = Math.max(12, Math.round(x.fs / 1.15)); }), { cls: "tsz" });
    g.appendChild(el("span", "tszv", String(Math.round(e.fs))));
    tb(g, "plus", "Bigger text", () => setEls((x) => { if (x.k === "tb") x.fs = Math.min(160, Math.round(x.fs * 1.15)); }), { cls: "tsz" });
    tb(g, "", "Rows and columns", (ev, b) => openPop(b, (p) => {
        p.appendChild(el("p", "sph", "Rows and columns"));
        const r = el("div", "srow");
        const ed = (fn) => () => { setEls((x) => { if (x.k === "tb") fn(x); }); };
        r.appendChild(btn("spchip", "+ Row", ed((x) => { if (x.rows.length < 12) { x.rows.push(x.rows[0].map(() => "")); x.h = Math.round(x.h * (x.rows.length) / (x.rows.length - 1)); } })));
        r.appendChild(btn("spchip", "− Row", ed((x) => { if (x.rows.length > 1) { x.h = Math.round(x.h * (x.rows.length - 1) / x.rows.length); x.rows.pop(); } })));
        r.appendChild(btn("spchip", "+ Column", ed((x) => { if (x.rows[0].length < 8) x.rows.forEach((row) => row.push("")); })));
        r.appendChild(btn("spchip", "− Column", ed((x) => { if (x.rows[0].length > 1) x.rows.forEach((row) => row.pop()); })));
        p.appendChild(r); p.appendChild(el("p", "spnote", "Double-click a cell to type in it. Tab goes to the next cell."));
    }), { text: e.rows.length + " × " + e.rows[0].length, menu: 1 });
    tb(g, "head", e.hdr ? "Top row is a heading row" : "Make the top row a heading row", () => setEls((x) => { if (x.k === "tb") x.hdr = !x.hdr; }), { on: e.hdr });
    tb(g, "fill", "Colors", (ev, b) => openPop(b, (p) => {
        p.appendChild(el("p", "sph", "Heading row")); swatches(p, e.hf, (c, live) => { if (live || !c) return; setEls((x) => { if (x.k === "tb") x.hf = c; }); }, { stay: true });
        p.appendChild(el("p", "sph", "Cells")); swatches(p, e.fill, (c, live) => { if (live) return; setEls((x) => { if (x.k === "tb") x.fill = c; }); }, { none: "No fill", stay: true });
        p.appendChild(el("p", "sph", "Lines")); swatches(p, e.bd, (c, live) => { if (live || !c) return; setEls((x) => { if (x.k === "tb") x.bd = c; }); }, { stay: true });
    }, "wide"), { menu: 1 });
}
function formatPic(g, e, tb) {
    tb(g, "", e.fit === "cover" ? "The picture fills the box (edges may be cut)" : "The whole picture shows", () => setEls((x) => { if (x.k === "pc") x.fit = x.fit === "cover" ? "contain" : "cover"; }), { text: e.fit === "cover" ? "Fill the box" : "Whole picture" });
    tb(g, "round", "Corners", (ev, b) => openPop(b, (p) => { const r = el("div", "srow"); [[0, "Square"], [16, "Soft"], [40, "Round"], [9999, "Circle"]].forEach(([v, n]) => r.appendChild(btn("spchip" + ((e.rd || 0) === Math.min(v, 400) ? " on" : ""), n, () => { closePop(); setEls((x) => { if (x.k === "pc") x.rd = Math.min(v, 400); }); }))); p.appendChild(r); }), { menu: 1 });
    tb(g, "border", "Border", (ev, b) => openPop(b, (p) => { swatches(p, e.ln, (c, live) => { if (live) return; setEls((x) => { if (x.k !== "pc") return; x.ln = c; if (c && !x.lw) x.lw = 6; if (!c) x.lw = 0; }); }, { none: "No border" }); }), { menu: 1 });
    tb(g, "shadow", "Shadow", () => setEls((x) => { if (x.k !== "pc") return; if (x.sd) delete x.sd; else x.sd = true; }), { on: !!e.sd });
    tb(g, "pic", "Use a different picture", () => pickPicture(e.id), { text: "Replace" });
}
function revealMenu(p, list) {
    const s = S0(), max = Math.max(0, ...s.els.map((e) => e.ap || 0)), one = list.length === 1 ? list[0] : null;
    p.appendChild(el("p", "sph", "When it shows on the board"));
    p.appendChild(btn("spi" + (!list.some((e) => e.ap) ? " on" : ""), icon("reveal") + "<span>Right away, with the slide</span>", () => { closePop(); setEls((e) => { delete e.ap; }); }));
    const next = one && one.ap ? one.ap : max + 1;
    for (let n = 1; n <= Math.min(30, max + 1); n++) p.appendChild(btn("spi" + (one && one.ap === n ? " on" : ""), "<span class='sapn'>" + n + "</span><span>" + (n === max + 1 ? "On the next Next press (" + ordinal(n) + ")" : "With Next press " + n) + "</span>", () => { closePop(); setEls((e) => { e.ap = n; }); }));
    void next;
    p.appendChild(el("p", "spnote", "Next on the board shows these one press at a time, then moves to the next slide. The numbers on the slide show the order."));
}
const ordinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
function arrangeMenu(p, list) {
    const item = (ic, t, fn) => p.appendChild(btn("spi", (ic ? icon(ic) : "") + "<span>" + t + "</span>", () => { closePop(); fn(); }));
    p.appendChild(el("p", "sph", "Order"));
    item("arrange", "Bring to front", () => reorder("front")); item("", "Bring forward", () => reorder("up")); item("", "Send backward", () => reorder("down")); item("", "Send to back", () => reorder("back"));
    p.appendChild(el("p", "sph", list.length > 1 ? "Line them up" : "Line up on the slide"));
    const r = el("div", "srow");
    [["l", "Left"], ["c", "Center"], ["r", "Right"], ["t", "Top"], ["m", "Middle"], ["b", "Bottom"]].forEach(([a, n]) => r.appendChild(btn("spchip", n, () => { closePop(); align(a); })));
    p.appendChild(r);
    if (list.length > 2) { const r2 = el("div", "srow"); r2.appendChild(btn("spchip", "Space across", () => { closePop(); spread("x"); })); r2.appendChild(btn("spchip", "Space down", () => { closePop(); spread("y"); })); p.appendChild(r2); }
}
function opacityMenu(p, list) {
    p.appendChild(el("p", "sph", "See-through"));
    const r = el("div", "srow"); [[1, "Solid"], [0.85, "85%"], [0.6, "60%"], [0.35, "35%"], [0.15, "Faint"]].forEach(([v, n]) => r.appendChild(btn("spchip" + (((list[0].op || 1) === v) ? " on" : ""), n, () => { closePop(); setEls((e) => { if (v >= 1) delete e.op; else e.op = v; }); })));
    p.appendChild(r);
}
function reorder(how) {
    change((s) => {
        const ids = new Set(sel), picked = s.els.filter((e) => ids.has(e.id)), rest = s.els.filter((e) => !ids.has(e.id));
        if (how === "front") s.els = rest.concat(picked); else if (how === "back") s.els = picked.concat(rest);
        else { const a = s.els.slice(); if (how === "up") { for (let i = a.length - 2; i >= 0; i--) if (ids.has(a[i].id) && !ids.has(a[i + 1].id)) { const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; } } else { for (let i = 1; i < a.length; i++) if (ids.has(a[i].id) && !ids.has(a[i - 1].id)) { const t = a[i]; a[i] = a[i - 1]; a[i - 1] = t; } } s.els = a; }
    });
}
function shiftEl(e, dx, dy) { if (e.k === "ln") { e.x1 += dx; e.x2 += dx; e.y1 += dy; e.y2 += dy; } else { e.x += dx; e.y += dy; } }
function align(a) {
    const list = sel.map(byId).filter((e) => e && !e.lk); if (!list.length) return;
    const ref = list.length > 1 ? unionBox(list) : { x: 0, y: 0, w: SW, h: SH };
    setEls((e) => { if (e.lk) return; const b = boxOf(e); let dx = 0, dy = 0;
        if (a === "l") dx = ref.x - b.x; if (a === "c") dx = ref.x + ref.w / 2 - (b.x + b.w / 2); if (a === "r") dx = ref.x + ref.w - (b.x + b.w);
        if (a === "t") dy = ref.y - b.y; if (a === "m") dy = ref.y + ref.h / 2 - (b.y + b.h / 2); if (a === "b") dy = ref.y + ref.h - (b.y + b.h);
        shiftEl(e, dx, dy); });
}
function spread(axis) {
    const list = sel.map(byId).filter((e) => e && !e.lk); if (list.length < 3) return;
    const P = axis === "x" ? "x" : "y", Z = axis === "x" ? "w" : "h", sorted = list.map((e) => ({ e, b: boxOf(e) })).sort((a, b) => a.b[P] - b.b[P]);
    const first = sorted[0].b, last = sorted[sorted.length - 1].b, total = sorted.reduce((t, x) => t + x.b[Z], 0), gap = (last[P] + last[Z] - first[P] - total) / (sorted.length - 1);
    let at = first[P] + first[Z] + gap;
    change(() => { sorted.slice(1, -1).forEach((x) => { const d = at - x.b[P]; shiftEl(x.e, axis === "x" ? d : 0, axis === "y" ? d : 0); at += x.b[Z] + gap; }); });
}
function duplicate() {
    const list = sel.map(byId).filter(Boolean); if (!list.length) return;
    const copies = list.map((e) => { const c = cleanEl(JSON.parse(JSON.stringify(e))); c.id = newId("e"); shiftEl(c, 30, 30); delete c.lk; return c; });
    change((s) => { copies.forEach((c) => { if (s.els.length < 80) s.els.push(c); }); }); sel = copies.map((c) => c.id); drawSel(); drawTools();
}
function delSel() { if (!sel.length) return; change((s) => { s.els = s.els.filter((e) => !sel.includes(e.id) || e.lk); }); sel = sel.filter((id) => byId(id)); drawSel(); drawTools(); }

/* ---------- the insert menus ---------- */
function shapeMenu(p, changeId) {
    p.appendChild(el("p", "sph", changeId ? "Change the shape" : "Add a shape"));
    const g = el("div", "sshapes");
    SHAPES.forEach(([id, name]) => {
        const b = btn("sshp", '<svg viewBox="-3 -3 66 52" aria-hidden="true"><path d="' + shapePath(id, 60, 46, 10) + '" fill="#7faedd" stroke="#10358a" stroke-width="2.5"/></svg>', () => { closePop(); if (changeId) setEls((x) => { if (x.k === "bx") x.sh = id; }); else addEl(newEl("shape", { sh: id, h: ["ellipse", "star", "burst", "heart", "plus", "hex", "oct", "pent"].includes(id) ? 400 : id.startsWith("arrow") || id === "chevron" || id === "banner" ? 240 : 360, w: id === "arrowU" || id === "arrowD" ? 240 : 400 })); }, name);
        g.appendChild(b);
    });
    p.appendChild(g);
    if (!changeId) { const r = el("div", "srow"); r.appendChild(btn("spchip", "Sticky note", () => { closePop(); addEl(newEl("sticky"), true); })); r.appendChild(btn("spchip", "Title", () => { closePop(); addEl(newEl("title"), true); })); r.appendChild(btn("spchip", "Your logo", () => { closePop(); addEl(newEl("logo")); })); p.appendChild(r); }
}
function lineMenu(p) {
    p.appendChild(el("p", "sph", "Add a line"));
    [["Line", {}], ["Arrow", { a2: "arrow" }], ["Double arrow", { a1: "arrow", a2: "arrow" }], ["Dashed line", { dash: "d" }], ["Number line arrow", { a1: "arrow", a2: "arrow", lw: 6 }], ["Line segment (dots)", { a1: "dot", a2: "dot" }]].forEach(([n, o]) =>
        p.appendChild(btn("spi", icon("line") + "<span>" + n + "</span>", () => { closePop(); addEl(cleanEl(Object.assign({ k: "ln", id: newId("e"), x1: 560, y1: 450, x2: 1040, y2: 450, ln: "#14213d", lw: 8 }, o))); })));
    p.appendChild(el("p", "spnote", "Drag either end. Hold Shift to keep it straight."));
}
function tableMenu(p) {
    p.appendChild(el("p", "sph", "Add a table"));
    const g = el("div", "stgrid"), lab = el("p", "spnote", "Pick a size");
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 6; c++) {
        const b = btn("stc", "", () => { closePop(); addTable(r, c); }, r + " rows, " + c + " columns"); b.dataset.r = r; b.dataset.c = c;
        b.onmouseenter = () => { lab.textContent = r + " × " + c; g.querySelectorAll(".stc").forEach((x) => x.classList.toggle("on", +x.dataset.r <= r && +x.dataset.c <= c)); };
        g.appendChild(b);
    }
    p.appendChild(g); p.appendChild(lab);
    const r2 = el("div", "srow"); r2.appendChild(btn("spchip", "x-y table", () => { closePop(); addEl(newEl("table", { nr: 6, nc: 2 })); })); p.appendChild(r2);
}
function mathMenu(p) {
    p.appendChild(el("p", "sph", "Math tools"));
    const g = el("div", "smath");
    MATH_MENU.forEach(([group, items]) => {
        items.filter(([key]) => key !== "text" && !["rect", "ellipse", "tri", "rtri", "seg"].includes(key)).forEach(([key, name]) => {
            const it = newItem(key, { x: 0.5, y: 0.5 }); if (!it) return;
            if (it.k === "plane") it.fx = ["2x + 1", "", ""]; if (it.k === "numline") Object.assign(it, { min: 0, max: 4, step: "1/2" });
            const c = document.createElement("canvas"); c.width = 220; c.height = 140; const ctx = c.getContext("2d");
            for (let i = 0; i < 3; i++) { const gg = geom(it, 220, 140, ctx), s = Math.min(220 * 0.84 / gg.w, 140 * 0.76 / gg.h); it.s *= s; }
            if (it.k === "tile" && it.t === "x") it.s = Math.min(it.s, 0.8);
            ctx.clearRect(0, 0, 220, 140); import("./mathTools.js?v=1").then((m) => m.drawItem(ctx, it, 220, 140));
            const b = btn("smpic", "", () => { closePop(); addMath(key); }, "Add " + name); b.appendChild(c); b.appendChild(el("span", null, name)); g.appendChild(b);
        });
        void group;
    });
    p.appendChild(g);
    p.appendChild(el("p", "spnote", "For fractions and powers in words, type them in any text box: {3/4}, x^2, √{49}."));
}
function stickerMenu(p) {
    const tabs = el("div", "stabs"), body = el("div", "spstk");
    const show = (i) => {
        [...tabs.children].forEach((b, j) => b.classList.toggle("on", i === j)); body.textContent = "";
        if (i < STICKER_SETS.length) { const [, t, list] = STICKER_SETS[i]; list.forEach((v) => { const b = btn("spstb" + (t === "m" ? " m" : ""), "", () => { closePop(); addSticker(t, v); }, v); b.appendChild(stickerFace({ t, v })); body.appendChild(b); }); }
        else {
            let col = 0; const cr = el("div", "srow"); WORD_COLORS.forEach(([n, bgc], j) => { const b = btn("spsw" + (j === col ? " on" : ""), "", () => { col = j; cr.querySelectorAll(".spsw").forEach((x, q) => x.classList.toggle("on", q === j)); }, n); b.style.background = bgc; cr.appendChild(b); }); body.appendChild(cr);
            WORDS.forEach((w) => body.appendChild(btn("spchip", w, () => { closePop(); addSticker("w", w, col); })));
            const f = el("form", "spword"), inp = el("input"); inp.maxLength = 40; inp.placeholder = "Your own words"; f.appendChild(inp); f.appendChild(btn("spchip", "Add", null)); f.lastChild.type = "submit";
            f.onsubmit = (e) => { e.preventDefault(); if (inp.value.trim()) { closePop(); addSticker("w", inp.value.trim(), col); } }; body.appendChild(f);
        }
    };
    STICKER_SETS.map((x) => x[0]).concat(["Words"]).forEach((n, i) => tabs.appendChild(btn("stab", n, () => show(i))));
    p.appendChild(tabs); p.appendChild(body); show(0);
}
function liveMenu(p) {
    p.appendChild(el("p", "sph", "Live fields"));
    p.appendChild(el("p", "spnote", typing() ? "Puts the field where you are typing." : "Each one fills in from the day's plan wherever the slide shows. Make an every-day slide with them once and it updates itself."));
    const ctx = liveCtx();
    LIVE.forEach(([key, name]) => {
        const v = ctx[key], now = Array.isArray(v) ? v.slice(0, 2).join(", ") + (v.length > 2 ? "…" : "") : v;
        p.appendChild(btn("spi live", "<b>" + name + "</b><small>" + (now ? String(now).replace(/[<>&]/g, "").slice(0, 60) : "(empty for this day)") + "</small>", () => { closePop(); addLive(key); }));
    });
}
function bgMenu(p) {
    const s = S0(); if (!s) return; const bg = s.bg || { t: "board" };
    const setBg = (nb, all) => { if (all) changeDeck(cur.key, (d) => { d.slides.forEach((x) => { x.bg = JSON.parse(JSON.stringify(nb)); }); }); else change((sl) => { sl.bg = nb; }); };
    p.appendChild(el("p", "sph", "Background"));
    const row = el("div", "sbgrow");
    const tile = (label, on, paint, fn) => { const b = btn("sbgt" + (on ? " on" : ""), "", fn, label); const sw = el("span", "sbgsw"); paint(sw); b.appendChild(sw); b.appendChild(el("span", null, label)); row.appendChild(b); return b; };
    const st = boardStandIn();
    tile("The board's look", bg.t === "board", (sw) => { sw.style.background = st.grad; const pp = el("span", st.cls); sw.appendChild(pp); }, () => { setBg({ t: "board" }); });
    p.appendChild(row);
    p.appendChild(el("p", "sph", "Color"));
    swatches(p, bg.t === "color" ? bg.c : "", (c, live) => { if (live) return; setBg(Object.assign({ t: "color", c: c || "#ffffff" }, bg.p ? { p: bg.p } : {})); }, { stay: false });
    p.appendChild(el("p", "sph", "Gradient"));
    const gr = el("div", "sgrads");
    GRADS.forEach(([id, name, c]) => { const b = btn("sgrad" + (bg.t === "grad" && bg.g === id ? " on" : ""), "", () => { closePop(); setBg(Object.assign({ t: "grad", g: id }, bg.p ? { p: bg.p } : {})); }, name); b.style.background = "linear-gradient(160deg," + c[0] + "," + c[1] + ")"; gr.appendChild(b); });
    p.appendChild(gr);
    if (bg.t !== "board") {
        p.appendChild(el("p", "sph", "Paper"));
        const pr = el("div", "srow"); PATTERNS.forEach(([id, name]) => pr.appendChild(btn("spchip" + ((bg.p || "") === id ? " on" : ""), name, () => { closePop(); const nb = Object.assign({}, bg); if (id) nb.p = id; else delete nb.p; setBg(nb); }))); p.appendChild(pr);
    }
    p.appendChild(btn("spi", icon("every") + "<span>Use this background on every slide of this day</span>", () => { closePop(); setBg(JSON.parse(JSON.stringify(bg)), true); toast("Every slide here has this background now."); }));
}
function wordSettings(p, id) {
    const e = byId(id); if (!e) return;
    const f = el("form", "spword"), inp = el("input"); inp.maxLength = 40; inp.value = e.v; f.appendChild(inp); const ok = btn("spchip", "Save", null); ok.type = "submit"; f.appendChild(ok);
    f.onsubmit = (ev) => { ev.preventDefault(); const v = inp.value.trim(); if (!v) return; closePop(); change((s) => { const x = s.els.find((q) => q.id === id); if (x) { x.v = v.slice(0, 40); x.w = Math.max(x.w, 70 + v.length * 34 * x.h / 110); } }); };
    p.appendChild(el("p", "sph", "Words")); p.appendChild(f);
    const cr = el("div", "srow"); WORD_COLORS.forEach(([n, bgc], j) => { const b = btn("spsw" + ((e.c || 0) === j ? " on" : ""), "", () => { closePop(); setEls((x) => { if (x.k === "st" && x.t === "w") x.c = j; }); }, n); b.style.background = bgc; cr.appendChild(b); });
    p.appendChild(el("p", "sph", "Color")); p.appendChild(cr);
    setTimeout(() => inp.focus(), 0);
}
/* A math tool's own settings: the same choices as on the whiteboard. */
function mathSettings(p, id) {
    const e = byId(id); if (!e) return; const it = e.it;
    const ed = (fn, refit) => { change((s) => { const x = s.els.find((q) => q.id === id); if (!x) return; fn(x.it); if (refit) { const b = mathBox(x.it, (q, W, H) => geom(q, W, H, null)), cx = x.x + x.w / 2, cy = x.y + x.h / 2, sc = Math.sqrt((x.w * x.h) / (b.w * b.h)); x.w = Math.round(b.w * sc); x.h = Math.round(b.h * sc); x.x = Math.round(cx - x.w / 2); x.y = Math.round(cy - x.h / 2); } const c = cleanEl(x); if (c) x.it = c.it; }, "math"); };
    const field = (label, val, on, attrs) => { const l = el("label", "smf"); l.appendChild(el("span", null, label)); const i = el("input"); i.value = val; Object.assign(i, attrs || {}); i.onchange = () => on(i.value, i); l.appendChild(i); return l; };
    const stepper = (label, get, set, min, max) => { const w = el("div", "smstep"); w.appendChild(el("span", null, label)); const v = el("b", null, String(get())); w.appendChild(btn("spchip", "−", () => { const n = Math.max(min, get() - 1); ed((q) => set(q, n)); v.textContent = String(n); })); w.appendChild(v); w.appendChild(btn("spchip", "+", () => { const n = Math.min(max(), get() + 1); ed((q) => set(q, n)); v.textContent = String(n); })); return w; };
    const cur2 = () => (byId(id) || e).it;
    p.appendChild(el("p", "sph", { plane: "Coordinate plane", numline: "Number line", table: "Table", ruler: "Ruler", protractor: "Protractor", fracbar: "Fraction bar", fraccircle: "Fraction circle", tile: "Algebra tile" }[it.k] || "Math tool"));
    if (it.k === "plane") {
        [0, 1, 2].forEach((j) => { const l = field("y =", it.fx[j] || "", (v, i) => { try { compileExpr(v); i.classList.remove("bad"); ed((q) => { q.fx[j] = v.slice(0, 80); }); } catch (x) { i.classList.add("bad"); } }, { placeholder: ["2x + 1", "-x/2 + 3", "x^2 - 4"][j] }); l.querySelector("span").style.color = PLOT[j]; p.appendChild(l); });
        const pr = el("div", "srow"); [["−10 to 10", -10, 10, -10, 10], ["−5 to 5", -5, 5, -5, 5], ["0 to 10", 0, 10, 0, 10], ["0 to 20", 0, 20, 0, 20], ["0 to 100", 0, 100, 0, 100]].forEach(([n, a, b, c, d]) => pr.appendChild(btn("spchip", n, () => { closePop(); ed((q) => Object.assign(q, { xmin: a, xmax: b, ymin: c, ymax: d }), true); })));
        p.appendChild(pr);
    } else if (it.k === "numline") {
        const r = el("div", "srow");
        r.appendChild(field("From", it.min, (v) => { const x = +v; if (v !== "" && Number.isFinite(x)) ed((q) => { if (x < q.max) q.min = x; }); }, { type: "number" }));
        r.appendChild(field("To", it.max, (v) => { const x = +v; if (v !== "" && Number.isFinite(x)) ed((q) => { if (x > q.min) q.max = x; }); }, { type: "number" }));
        r.appendChild(field("Count by", it.step, (v, i) => { const ok = parseStep(v); i.classList.toggle("bad", !ok); if (ok) ed((q) => { q.step = v.trim().slice(0, 12); }); }, { placeholder: "1, 0.5 or 1/4" }));
        p.appendChild(r);
        const pr = el("div", "srow"); [["−10 to 10", -10, 10, "1"], ["−20 to 20 by 2", -20, 20, "2"], ["0 to 1 by ¼", 0, 1, "1/4"], ["0 to 2 by ½", 0, 2, "1/2"], ["0 to 1 by 0.1", 0, 1, "0.1"]].forEach(([n, a, b, st]) => pr.appendChild(btn("spchip", n, () => { closePop(); ed((q) => Object.assign(q, { min: a, max: b, step: st })); })));
        p.appendChild(pr);
    } else if (it.k === "table") {
        p.appendChild(stepper("Rows", () => cur2().rows, (q, n) => { q.rows = n; }, 1, () => 12)); p.appendChild(stepper("Columns", () => cur2().cols, (q, n) => { q.cols = n; }, 1, () => 8));
        p.appendChild(field("Top row (commas between)", it.hd, (v) => ed((q) => { q.hd = v.slice(0, 120); }), { placeholder: "x, y" }));
    } else if (it.k === "ruler") p.appendChild(stepper("Units", () => cur2().n, (q, n) => { q.n = n; }, 2, () => 30));
    else if (it.k === "fracbar" || it.k === "fraccircle") {
        p.appendChild(stepper("Parts", () => cur2().n, (q, n) => { q.n = n; if (q.sh > n) q.sh = n; }, 1, () => 24));
        p.appendChild(stepper("Shaded", () => cur2().sh, (q, n) => { q.sh = n; }, 0, () => cur2().n));
        p.appendChild(btn("spchip", it.lab ? "Labels: on" : "Labels: off", () => { closePop(); ed((q) => { q.lab = !q.lab; }); }));
    } else if (it.k === "tile") {
        p.appendChild(btn("spchip", "Flip the sign (+/−)", () => { closePop(); ed((q) => { q.neg = !q.neg; }); }));
    } else p.appendChild(el("p", "spnote", "Drag a corner to size it. Drag the round handle to turn it."));
}

/* ---------- notes for the teacher ---------- */
function drawNotes() {
    const t = $("slNotes"), w = $("slNotesBox"); if (!t || !w) return;
    const s = S0(); w.hidden = !s;
    if (!s) return;
    if (document.activeElement !== t) t.value = s.nt || "";
    t.disabled = !canEdit(cur.key);
}
function notesInput() {
    const t = $("slNotes"), s = S0(); if (!s) return;
    before("notes:" + s.id);
    const v = t.value.slice(0, 3000); if (v.trim()) s.nt = v; else delete s.nt;
    dirty(cur.key); refreshThumb(true);
}
let thumbT = 0;
function refreshThumb(badgesOnly) { clearTimeout(thumbT); thumbT = setTimeout(() => { if (!badgesOnly) thumbs.delete(cur.id); drawFilm(); }, 120); }

/* ---------- teach it, show on the board, copy to another day ---------- */
function showOnBoard() {
    const list = showList(deckOf(DAILY), deckOf(lessonKey()));
    if (!list.length) return toast("There are no slides to show for " + DAYS[lesson.day] + " yet.");
    let i = list.findIndex((s) => s.id === cur.id); if (i < 0) i = 0;
    flush().then(() => { A.showSlide(lesson.week, lesson.cls, lesson.day, i); toast("On the board now: slide " + (i + 1) + " of " + list.length + "."); });
}
/** Teach this slide: the board moves to this lesson, the slide becomes a Spotlight screen (or the one that already shows
    it opens), and the Spotlight tab opens on it, live on the board, ready for panels and drawing. */
function toSpotlight() {
    if (editing) finishEdit();
    const list = showList(deckOf(DAILY), deckOf(lessonKey()));
    if (!list.length) return toast("Add a slide first.");
    const s = list.find((x) => x.id === cur.id) || list[0];
    flush().then(() => {
        if (!A.goLesson(lesson.week, lesson.cls, lesson.day)) return toast("That lesson is not on the board's list of weeks.");
        A.goMode("spot");
        // the board's copy of this lesson's slides arrives a moment after the lesson changes
        const tryOpen = (n) => { if (A.spot.openSlide(s.id)) return; if (n < 20) setTimeout(() => tryOpen(n + 1), 150); };
        tryOpen(0);
    });
}
function readOnce(path) {
    return new Promise((res) => {
        let done = false, un = null;
        const fin = (v) => { if (done) return; done = true; res(v); setTimeout(() => { try { if (un) un(); } catch (x) { /* gone */ } }, 0); };
        un = A.store().watch(path, (snap) => { if (snap.pending || (snap.fromCache && navigator.onLine)) return; fin(snap.exists ? snap.data : null); }, () => fin(undefined));
        setTimeout(() => fin(undefined), 9000);
    });
}
function copyMenu(p) {
    const s = S0(), own = deckOf(cur.key);
    p.appendChild(el("p", "sph", "Copy to another day or class"));
    const ws = el("select"), cs = el("select"), ds = el("select");
    weeks().slice().reverse().forEach((w) => { const o = el("option", null, weekName(w)); o.value = w.id; ws.appendChild(o); }); ws.value = lesson.week;
    const fillC = () => { cs.textContent = ""; const w = weekObj(ws.value); Object.keys((w && w.classes) || {}).forEach((c) => { const o = el("option", null, w.classes[c].label || c); o.value = c; cs.appendChild(o); }); const all = el("option", null, "All my classes"); all.value = "*"; cs.appendChild(all); cs.value = w && w.classes[lesson.cls] ? lesson.cls : cs.options[0].value; };
    DAYS.forEach((d, i) => { const o = el("option", null, d); o.value = i; ds.appendChild(o); }); ds.value = String(Math.min(4, lesson.day + 1));
    ws.onchange = fillC; fillC();
    [["Week", ws], ["Class", cs], ["Day", ds]].forEach(([n, x]) => { const l = el("label", "smf"); l.appendChild(el("span", null, n)); l.appendChild(x); p.appendChild(l); });
    const go = async (which) => {
        const w = weekObj(ws.value); if (!w) return;
        const classes = cs.value === "*" ? Object.keys(w.classes) : [cs.value], day = +ds.value;
        const pickSlides = which === "picked" ? pickedList().map((x) => x.s) : which === "one" ? [s] : (own ? own.slides : []);
        if (!pickSlides.length || !pickSlides[0]) return;
        closePop(); toast("Copying…"); await flush();
        let n = 0, fail = 0;
        for (const c of classes) {
            const key = deckKey(w.id, c, day); if (key === cur.key && which === "all") continue;   // ("picked" may copy onto this same day: they go at the end)
            const data = key === lessonKey() ? deckOf(key) : await readOnce("slides/" + key);
            if (data === undefined) { fail++; continue; }
            const d = cleanDeck(data); const room = MAX_SLIDES - d.slides.length; if (room <= 0) { fail++; continue; }
            pickSlides.slice(0, room).forEach((x) => { const cp = cleanSlide(JSON.parse(JSON.stringify(x))); cp.id = newId("s"); cp.els.forEach((e) => { e.id = newId("e"); }); d.slides.push(cp); });
            if (key === lessonKey()) { decks[key].deck = d; dirty(key); n++; continue; }
            try { await A.store().save("slides/" + key, Object.assign(d, { at: Date.now(), by: PAGE })); idx.n[key] = countShown(d); idxDirty = true; n++; } catch (e) { fail++; }
        }
        saveIndex(); draw();
        toast(n ? "Copied to " + n + (n === 1 ? " lesson" : " lessons") + (fail ? ". " + fail + " could not be reached; try again." : ".") : "Not copied. Your saved slides could not be reached; try again.");
    };
    const r = el("div", "srow");
    if (picks.size) r.appendChild(btn("spchip on", "Copy " + picks.size + " selected", () => go("picked")));
    else if (s) r.appendChild(btn("spchip", "Copy this slide", () => go("one")));
    if (own && own.slides.length > 1) r.appendChild(btn("spchip", "Copy all " + own.slides.length, () => go("all")));
    p.appendChild(r);
    p.appendChild(el("p", "spnote", "Copies go at the end of that day's slides. Live fields fill in with that day's plan."));
}
/** The ⋯ on the lesson row: the things that used to be buttons of their own. Each opens its own menu in the same place. */
function moreMenu(p) {
    const b = $("slMore"), item = (ic, t, sub, fn) => p.appendChild(btn("spi smi", icon(ic) + "<span><b>" + t + "</b><small>" + sub + "</small></span>", () => { closePop(); fn(); }));
    p.appendChild(el("p", "sph", DAYS[lesson.day] + "'s slides"));
    item("plan", "Start from my plan", "The day's lesson, your Today screen or the week's agenda as slides", () => setTimeout(() => openPop(b, planMenu, "wide"), 0));
    item("copyto", "Copy to another day or class", "This slide, or all of " + DAYS[lesson.day] + "'s", () => setTimeout(() => openPop(b, copyMenu), 0));
    if (A.goMode) item("board", "Put it on the board, stay here", "The board shows this slide; you keep building", () => showOnBoard());
}
function planMenu(p) {
    const L = classOf(weekObj(), lesson.cls), d = dayOf(), frames = d ? (A.framesFor(lesson.week, lesson.cls, lesson.day) || []) : [];
    p.appendChild(el("p", "sph", "Start from my plan"));
    if (d) {
        const n = fromPlan(L, lesson.day, frames).length;
        p.appendChild(btn("spi plan", "<b>" + DAYS[lesson.day] + "'s lesson as slides</b><small>" + n + " slides: your Today screen, " + (d.problems || []).length + " bellringer problems with answers on Next, " + frames.filter((f) => !f.pdf).length + " notes steps. All of it can be changed.</small>", () => { closePop(); addPlan(); }));
    } else p.appendChild(el("p", "spnote", DAYS[lesson.day] + " has no plan yet. Plan it on Quick lesson or Week Review, or start from a layout."));
    const daily = deckOf(DAILY);
    p.appendChild(btn("spi plan", "<b>My own Today screen, every day</b><small>The built-in Today screen as pieces you can move and restyle. It fills in each day's plan by itself.</small>", () => { closePop(); if (daily && daily.slides.length >= MAX_DAILY) return toast("Up to " + MAX_DAILY + " every-day slides."); addSlide(DAILY, todaySlide()); toast("Your Today screen shows at the start of every lesson. Change anything on it."); }));
    if (L) p.appendChild(btn("spi plan", "<b>The week's agenda</b><small>Monday to Friday from your plan, as one slide.</small>", () => { closePop(); addSlide(lessonKey(), agendaSlide(L)); }));
    const own = deckOf(lessonKey());
    if (own) p.appendChild(btn("spi plan", "<b>" + (own.nod ? "Show" : "Skip") + " the every-day slides on " + DAYS[lesson.day] + "</b><small>" + (own.nod ? "They are off for this day now." : "For a test day or a field trip.") + "</small>", () => { closePop(); changeDeck(lessonKey(), (dd) => { if (dd.nod) delete dd.nod; else dd.nod = true; }); }));
}

/* ---------- keys, copy and paste ---------- */
function onKey(e) {
    if (!active) return;
    const t = e.target, inField = t && (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey, key = e.key;
    if (t && t.isContentEditable) {
        e.stopPropagation();   // the board's own keys (Next, music) stay out of typing
        if (key === "Escape") { e.preventDefault(); finishEdit(); }
        else if (key === "Tab" && editing.split(":").length === 3) { e.preventDefault(); const [id, r, c] = editing.split(":"), x = byId(id); finishEdit(); if (!x) return; let rr = +r, cc = +c + (e.shiftKey ? -1 : 1); if (cc >= x.rows[0].length) { cc = 0; rr++; } if (cc < 0) { cc = x.rows[0].length - 1; rr--; } if (rr >= 0 && rr < x.rows.length) startEdit(id + ":" + rr + ":" + cc); }
        else if (key === "Enter" && !e.shiftKey && editing.split(":").length === 3) { e.preventDefault(); const [id, r, c] = editing.split(":"), x = byId(id); finishEdit(); if (x && +r + 1 < x.rows.length) startEdit(id + ":" + (+r + 1) + ":" + c); }
        else if (key === "Enter" && !e.shiftKey && editing.endsWith(":hd")) { e.preventDefault(); finishEdit(); }
        return;
    }
    if (inField) { if (mod && (key === "z" || key === "Z" || key === "y")) e.stopPropagation(); return; }
    e.stopPropagation();   // while building slides, arrows nudge pieces instead of moving the live board
    if (mod && (key === "z" || key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && (key === "y" || key === "Y")) { e.preventDefault(); redo(); return; }
    if (mod && (key === "d" || key === "D")) { e.preventDefault(); duplicate(); return; }
    if (mod && (key === "a" || key === "A")) { e.preventDefault(); const s = S0(); if (s) { sel = s.els.map((x) => x.id); drawSel(); drawTools(); } return; }
    if (key === "Escape") { if (pop) closePop(); else if (sel.length) { sel = []; drawSel(); drawTools(); } return; }
    if ((key === "Delete" || key === "Backspace") && sel.length) { e.preventDefault(); delSel(); return; }
    if (key === "Enter" && sel.length === 1) { e.preventDefault(); startEdit(sel[0]); return; }
    if (key.startsWith("Arrow") && sel.length) {
        e.preventDefault(); const st = e.shiftKey ? 10 : 1, dx = key === "ArrowLeft" ? -st : key === "ArrowRight" ? st : 0, dy = key === "ArrowUp" ? -st : key === "ArrowDown" ? st : 0;
        change((s) => { s.els.forEach((x) => { if (sel.includes(x.id) && !x.lk) shiftEl(x, dx, dy); }); }, "nudge"); return;
    }
    if (key.startsWith("Arrow") || key === "PageDown" || key === "PageUp") {   // no piece picked: move between slides
        const list = filmOrder(), i = list.findIndex((x) => x.key === cur.key && x.id === cur.id), j = i + (key === "ArrowDown" || key === "ArrowRight" || key === "PageDown" ? 1 : -1);
        if (list[j]) { e.preventDefault(); openSlide(list[j].key, list[j].id); }
    }
}
function filmOrder() { const out = []; [DAILY, lessonKey()].forEach((key) => ((deckOf(key) || { slides: [] }).slides).forEach((s) => out.push({ key, id: s.id }))); return out; }
const CLIP = "anchor-board-slide-pieces";
function onCopy(e, cut) {
    if (!active || editing || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    const list = sel.map(byId).filter(Boolean); if (!list.length) return;
    clip = JSON.parse(JSON.stringify(list)); e.preventDefault();
    try { e.clipboardData.setData("text/plain", CLIP + ":" + list.length + "\n" + list.map((x) => (x.html ? textOf(x.html) : "")).filter(Boolean).join("\n")); } catch (x) { /* the copy is kept here anyway */ }
    if (cut) delSel();
}
function onPaste(e) {
    if (!active || editing || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    const items = [...((e.clipboardData && e.clipboardData.items) || [])], img = items.find((x) => x.kind === "file" && /^image\//.test(x.type));
    if (img) { e.preventDefault(); addPicture(img.getAsFile(), ""); return; }
    const text = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    if (clip && text.startsWith(CLIP)) { e.preventDefault(); const copies = clip.map((x) => { const c = cleanEl(JSON.parse(JSON.stringify(x))); c.id = newId("e"); shiftEl(c, 24, 24); return c; }); clip = copies.map((c) => JSON.parse(JSON.stringify(c)));
        if (!S0()) return; change((s) => { copies.forEach((c) => { if (s.els.length < 80) s.els.push(c); }); }); sel = copies.map((c) => c.id); drawSel(); drawTools(); return; }
    if (text.trim()) { e.preventDefault(); addEl(newEl("text", { html: sanitizeHtml(text.slice(0, 3000).split("\n").map((l) => l.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch])).join("<br>")), h: Math.min(700, 80 + text.split("\n").length * 56) })); }
}
let toastEl = null;
function toast(t) { if (!toastEl) { toastEl = el("div", "stoast"); toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); } toastEl.textContent = t; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("on"), 3600); }

/* ---------- building the page once ---------- */
function build() {
    R.textContent = "";
    // the lesson row: ‹ week ›, class (only with more than one), Mon–Fri, saved, Teach this slide, ⋯
    const b1 = el("div", "slrow"); b1.setAttribute("role", "group"); b1.setAttribute("aria-label", "Which lesson's slides");
    const wk = el("div", "slwk"), wp = btn("slwka", svg('<path d="m15 18-6-6 6-6"/>'), () => stepWeek(-1), "Earlier week"); wp.id = "slWkPrev";
    const wn = el("label", "slwkn"); const nm = el("span", "slwkt"); nm.id = "slWkName"; nm.append(el("b"), el("small"));
    const ws = el("select"); ws.id = "slWeek"; ws.setAttribute("aria-label", "Week"); wn.append(nm, ws);
    const wx = btn("slwka", svg('<path d="m9 18 6-6-6-6"/>'), () => stepWeek(1), "Later week"); wx.id = "slWkNext";
    wk.append(wp, wn, wx);
    const cf = el("label", "slcls"); const cs = el("select"); cs.id = "slClass"; cs.setAttribute("aria-label", "Class"); cf.appendChild(cs);
    const days = el("div", "sldays"); days.id = "slDays"; days.setAttribute("role", "group"); days.setAttribute("aria-label", "Day");
    const sv = el("span", "slsave"); sv.id = "slSave"; sv.setAttribute("role", "status");
    const teach = A.goMode
        ? btn("btn amber slteach", icon("spot") + "<span>Teach<i> this slide</i></span>", () => toSpotlight(), "Teach this slide: it goes on the board and opens in Spotlight, with panels and drawing")
        : btn("btn amber slteach", icon("board") + "<span>Show on board</span>", () => showOnBoard(), "Send this slide to the board now");
    const more = btn("btn ghost slmore", icon("more"), (e, bb) => openPop(bb, moreMenu, "wide"), "More: start from my plan, copy to another day, put it on the board"); more.id = "slMore";
    b1.append(wk, cf, days, el("span", "slgap"), sv, teach, more);
    ws.onchange = () => setLesson(ws.value, lesson.cls, lesson.day); cs.onchange = () => setLesson(lesson.week, cs.value, lesson.day);
    const slot = document.getElementById("slBarSlot");
    if (slot) { slot.textContent = ""; slot.appendChild(b1); } else { const bar = el("div", "sbar1"); bar.appendChild(b1); R.appendChild(bar); }
    const b2 = el("div", "sbar2"); b2.id = "slTools"; b2.setAttribute("role", "toolbar"); b2.setAttribute("aria-label", "Slide tools");
    const main = el("div", "smain"), film = el("aside", "sfilm"); film.id = "slFilm"; film.setAttribute("aria-label", "Slides");
    const right = el("div", "sright"), stage = el("div", "sstage"); stage.id = "slStage";
    const canvas = el("div", "scanvas"); canvas.id = "slCanvas"; const over = el("div", "sover"); over.id = "slOver"; stage.append(canvas, over);
    const nb = el("div", "snotes"); nb.id = "slNotesBox"; const nl = el("label", null, "Notes for me"); nl.htmlFor = "slNotes"; const nh = el("small", null, "Only on the Remote and your phone, never on the board");
    const ta = el("textarea"); ta.id = "slNotes"; ta.rows = 2; ta.maxLength = 3000; ta.placeholder = "What to say, questions to ask, where students get stuck…"; ta.oninput = notesInput; ta.onfocus = () => { if (editing) finishEdit(); };
    const nhd = el("div", "snh"); nhd.append(nl, nh); nb.append(nhd, ta);
    right.append(stage, nb); main.append(film, right); R.append(b2, main);
    stage.addEventListener("pointerdown", stageDown); stage.addEventListener("pointermove", stageMove); stage.addEventListener("pointerup", stageUp); stage.addEventListener("pointercancel", stageUp);
    stage.addEventListener("dblclick", stageDbl);
    stage.addEventListener("dragover", (e) => { if ([...(e.dataTransfer && e.dataTransfer.items || [])].some((x) => x.kind === "file")) { e.preventDefault(); stage.classList.add("drop"); } });
    stage.addEventListener("dragleave", () => stage.classList.remove("drop"));
    stage.addEventListener("drop", (e) => { stage.classList.remove("drop"); const f = [...((e.dataTransfer && e.dataTransfer.files) || [])].find((x) => /^image\//.test(x.type)); if (f) { e.preventDefault(); addPicture(f, ""); } });
    if (window.ResizeObserver) new ResizeObserver(() => { if (!active || !slideEl) return; k = fitSlide($("slCanvas"), slideEl) || k; drawSel(); }).observe(stage);
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("copy", (e) => onCopy(e, false)); document.addEventListener("cut", (e) => onCopy(e, true)); document.addEventListener("paste", onPaste);
    document.addEventListener("pointerdown", (e) => { if (pop && !pop.contains(e.target) && !(popFor && popFor.contains(e.target))) closePop(); }, true);
    window.addEventListener("beforeunload", (e) => { if (Object.keys(decks).some((key) => decks[key].dirty || decks[key].saving)) { flush(); e.preventDefault(); e.returnValue = ""; } });
    window.addEventListener("resize", () => closePop());
    window.addEventListener("online", () => status()); window.addEventListener("offline", () => status());
    built = true;
}

/** ‹ and › on the week: the week before or after, same class and day. */
function stepWeek(n) {
    const wl = weeks(), i = wl.findIndex((x) => x.id === lesson.week), w = wl[i + n];
    if (w) setLesson(w.id, w.classes && w.classes[lesson.cls] ? lesson.cls : "", lesson.day);
}

/* ---------- what studio.js calls ---------- */
/** Open the Slides side. at: { week, cls, day } to open, or nothing for the lesson on the board now. */
export function openEditor(api, host, at) {
    A = api; R = host; active = true;
    if (!images) images = imageLoader(() => A.store(), () => { thumbs.clear(); if (active) { drawCanvas(); drawFilm(); } });
    if (!built) build();
    if (!idxFresh && !openEditor.idxOn) {
        openEditor.idxOn = true;
        A.store().watch("slides/" + INDEX, (snap) => { if (snap.pending) return; if (!idxDirty) idx = cleanIndex(snap.exists ? snap.data : null); if (!snap.fromCache) idxFresh = true; if (active) drawDays(); }, () => {});
    }
    const S = A.S, w = (at && at.week) || lesson.week || S.week, c = (at && at.cls) || lesson.cls || S.cls, d = at && at.day != null ? at.day : (lesson.week ? lesson.day : S.day);
    wantAt = at && at.week && !weeks().some((x) => x.id === at.week) ? at : null;
    wantSlide = at && typeof at.slide === "string" ? at.slide : "";   // a private week that has not loaded yet: open it when it does
    setLesson(w, c, d);
}
/** The board's weeks changed (private weeks arrive after the page loads): list them, and open one that was asked for. */
let wantAt = null;
export function weeksChanged() {
    if (!active) return;
    if (wantAt && weeks().some((x) => x.id === wantAt.week)) { const a = wantAt; wantAt = null; setLesson(a.week, a.cls, a.day); return; }
    const ws = $("slWeek"); if (ws && ws.dataset.sig !== weeks().map((x) => x.id).join()) drawLessonBar();
}
export function closeEditor() { if (!active) return; if (editing) finishEdit(); closePop(); active = false; flush(); }
export function editorBusy() { return Object.keys(decks).some((key) => decks[key].dirty || decks[key].saving); }
