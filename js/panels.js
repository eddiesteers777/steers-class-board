/* ==========================================
   Anchor Board — panels.
   The board is a stage (the lesson screen) plus panels. A panel is a tool
   (js/boardTools.js) or a lesson panel built here: Timer, Learning target,
   Agenda, Period clock. Every panel can be on the shelf beside the lesson,
   floating over it, minimized to a live chip, or off. Layouts ("scenes")
   set the screen and the panels in one tap. All of it lives in S.tools
   inside the shared board state, so the board and the Remote always match.
========================================== */
import { buildWidget, PANEL_LIST, LESSON_PANELS, MATH_LIST, CALC_LIST, WORK, cleanScene, PALERT_MINS, MAX_SCENES } from "./boardTools.js?v=78";
import { meterEl, setVoice, camBody, tooLoud } from "./roomSense.js?v=1";
import { MARKS, markUrl } from "./marks.js?v=1";
import { EFFECTS, FX_AMOUNTS, applyEffect, effectSample } from "./effects.js?v=3";
import { isMine, mineList, mineSrc, onMine, addMine, removeMine, MY_MAX } from "./myPhotos.js?v=1";
import { cleanStickers } from "./stickers.js?v=1";
import { findBody, findChip, findTitle } from "./findPanel.js?v=13";
import { isFind, FIND_KEYS } from "./findCore.js?v=1";
import { mtBody } from "./manipPanels.js?v=14";
import { isMt, mtChip } from "./manipCore.js?v=14";
export { MARKS, EFFECTS, FX_AMOUNTS };

const LESSON = new Set(LESSON_PANELS.map((x) => x[0])), MATH = new Set(MATH_LIST.concat(CALC_LIST).map((x) => x[0]));
export const labelOf = (k) => (PANEL_LIST.find((x) => x[0] === k) || [k, k])[1];

/* Small 24×24 stroke icons (currentColor). */
const IC = {
    ptimer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2.5h6"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
    agenda: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.3 1.3L7.5 4.6M3.5 12l1.3 1.3 2.7-2.7"/><circle cx="5.5" cy="18" r="1.2"/>',
    period: '<rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4M12 13v3l2 1.2"/>',
    traffic: '<rect x="8" y="2.5" width="8" height="19" rx="4"/><circle cx="12" cy="7" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="17" r="1.4"/>',
    work: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    stopwatch: '<circle cx="12" cy="14" r="7.5"/><path d="M12 14l3-3M10 2.5h4M12 2.5v4M18.5 6.5L20 5"/>',
    text: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
    score: '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 14v3M8 20h8"/>',
    goal: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    pick: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0114 0"/>',
    groups: '<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="9" r="3"/><path d="M2.5 19a5.5 5.5 0 0111 0M11 19a5.5 5.5 0 0111 0"/>',
    layout: '<rect x="3" y="4" width="12" height="16" rx="2"/><rect x="17" y="4" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/>',
    slide: '<rect x="3" y="5" width="13" height="10" rx="2"/><path d="M7 19h13a1 1 0 0 0 1-1V9"/>',
    find: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8 10.5h5M10.5 8v5"/>',
    cam: '<rect x="2.5" y="6" width="13.5" height="12" rx="2.5"/><path d="M16 10.5l5.5-3v9l-5.5-3z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="3.5" rx=".8"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" stroke-width="2.4"/>',
    sci: '<rect x="3.5" y="2.5" width="17" height="19" rx="2.5"/><path d="M7 7h10"/><path d="M7 12.5l2 3 2-5h2.5M15 13l3 3M18 13l-3 3"/>',
    graph: '<path d="M4 3v17h17"/><path d="M6 17c3-9 6-11 8-6s4 2 6-6"/><path d="M6 13l13-6" stroke-dasharray="2 2.2"/>',
    balance: '<path d="M12 4v16M8 20h8M4 8h16"/><path d="M4 8l-2.5 6h5zM20 8l-2.5 6h5z"/><path d="M1.5 14a2.5 1.6 0 0 0 5 0M17.5 14a2.5 1.6 0 0 0 5 0"/>',
    chance: '<circle cx="12" cy="13" r="8.5"/><path d="M12 13V4.5M12 13l6.5 5M12 13l-7.5 3.5"/><path d="M10 2h4l-2 3z"/>',
    line: '<path d="M3 21h18M3 21V3"/><path d="M5 18L20 5"/><circle cx="8" cy="15.5" r="1.6"/><circle cx="16.5" cy="8" r="1.6"/>',
    xform: '<path d="M3 12h18M12 3v18"/><path d="M5 9l3-5 3 5zM13 15l3 5 3-5z"/>',
    pyth: '<path d="M6 18V9l8 9z"/><rect x="6" y="18" width="8" height="4" rx=".5"/><path d="M6 9H2v9h4"/><path d="M6 9l4.5-4 8 9-4.5 4"/>',
    angle: '<path d="M2 8h20M2 17h20M7 22L17 3"/><path d="M13.6 8a3 3 0 0 0 1.6 2.4"/>',
    area: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M14 5v14M3 12h18"/>',
    nl: '<path d="M2 16h20M5 13v6M12 13v6M19 13v6"/><path d="M6 10q6-8 12 0"/><path d="M15.5 8.5L18 10l.4-2.8"/>',
    sys: '<path d="M3 3v18h18"/><path d="M5 18L20 6"/><path d="M5 8l15 9"/><circle cx="12.6" cy="12.4" r="1.8" fill="currentColor"/>',
    scat: '<path d="M3 3v18h18"/><path d="M6 17L20 7" stroke-dasharray="2 2.4"/><circle cx="7.5" cy="14" r="1.4" fill="currentColor"/><circle cx="11" cy="14.5" r="1.4" fill="currentColor"/><circle cx="12.5" cy="10.5" r="1.4" fill="currentColor"/><circle cx="16" cy="11" r="1.4" fill="currentColor"/><circle cx="18" cy="7" r="1.4" fill="currentColor"/>',
    vol: '<ellipse cx="8" cy="6" rx="5" ry="1.8"/><path d="M3 6v12a5 1.8 0 0 0 10 0V6"/><path d="M17.5 6l-4 12.2a4 1.6 0 0 0 8 0z"/>',
    tape: '<rect x="2.5" y="5" width="19" height="6" rx="1"/><path d="M7.3 5v6M12 5v6M16.7 5v6"/><rect x="2.5" y="14" width="11" height="6" rx="1"/><path d="M7.3 14v6"/><path d="M2.5 11h9.5" stroke-width="3"/>',
    fn: '<rect x="6" y="7" width="12" height="10" rx="2"/><path d="M12 2v5M12 17v5M9 12h6"/><path d="M10 4.5L12 7l2-2.5"/>',
    counters: '<circle cx="7" cy="8" r="4"/><circle cx="17" cy="16" r="4"/><path d="M5.5 8h3M7 6.5v3M15.5 16h3"/>',
    send: '<path d="M21 3L10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    style: '<path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/>',
    pin: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v5"/>',
    front: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4"/>',
    back: '<rect x="4" y="4" width="11" height="11" rx="2"/><path d="M15 9h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-4"/>',
    small: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
    stage: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><rect x="7.5" y="8" width="9" height="8" rx="1.5"/>',
    min: '<path d="M6 12h12"/>', float: '<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    dock: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export const icon = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[k] || (/^find\d$/.test(k) ? IC.find : IC.layout)) + "</svg>";

export const PANEL_INFO = {
    ptimer: "A countdown the whole room can see", target: "Today's learning target", agenda: "Today's plan, and where we are in it", period: "The time, and when class ends",
    traffic: "Stop, slow down, go", work: "From silent to group work", clock: "Time and date", stopwatch: "Count up from zero", text: "Type a note for the room",
    dice: "Roll one to three dice", score: "Points for teams or periods", goal: "Class points toward a reward", pick: "A random name, no repeats", groups: "Random groups from the roster",
    cam: "The camera, live, and recording to this device",
    slide: "One of this lesson's slides, as a panel you can move and size",
    find: "Search the problem bank by standard or topic and put one on the board",
    calc: "Plus, minus, times, divide and percent, with the order of operations", sci: "Powers, roots, trig in degrees or radians, logs, Ans and fraction answers",
    graph: "Type equations and see them graphed live, with sliders, zoom and tap-to-trace",
    balance: "x and unit tiles on a scale that tips until both sides match", chance: "Spinner, coin and dice, with a tally beside the expected results",
    line: "Drag two points: slope triangle and y = mx + b", xform: "Slide, flip, turn and dilate a shape on the grid", pyth: "A right triangle with a square on each side",
    counters: "Two-colour counters and zero pairs", angle: "Parallel lines cut by a transversal, and a triangle's angles",
    fn: "Inputs in, outputs out: mystery rules, and function or not",
    area: "Expand and factor expressions with tiles or an area box",
    nl: "Add, subtract and find distance with fractions and decimals on a number line",
    sys: "Two lines on a grid: where they cross, parallel or the same line, and test a point",
    scat: "Data on a graph: the trend, outliers, your own trend line and a prediction",
    tape: "Bar models for percent and ratio problems, solved one step at a time",
    vol: "Cylinders, cones and spheres: volume or a missing size, in π or 3.14",
};

/* ---------- layouts ---------- */
export const SCENES = [
    { id: "sub", n: "Sub day", d: "Today, agenda, period clock, silent", screen: "today", on: ["agenda", "period", "work"], min: ["period"], work: "silent" },
    { id: "seats", n: "Find seats", d: "Seating chart, period clock", screen: "seats", on: ["period"], min: ["period"], guestless: true },
    { id: "arrive", n: "Arrive", d: "Today, period clock, silent", screen: "today", on: ["period", "work"], min: ["work"], work: "silent" },
    { id: "bell", n: "Bell work", d: "Bellringer, timer, silent", screen: "bell", on: ["ptimer", "work"], work: "silent", timer: "bell" },
    { id: "notes", n: "Notes", d: "Guided notes, target, agenda", screen: "notes", on: ["target", "agenda"], min: ["agenda"] },
    { id: "work", n: "Work time", d: "Whiteboard, timer, partner talk", screen: "blank", on: ["ptimer", "work", "traffic"], work: "partner" },
    { id: "group", n: "Group work", d: "Groups, timer, group voices", screen: "blank", on: ["groups", "ptimer", "work"], float: ["groups"], work: "group", guestless: true },
    { id: "game", n: "Review game", d: "Game, period clock", screen: "game", on: ["period"], min: ["period"], guestless: true },
];
const asScene = (sc) => (sc.on && !Array.isArray(sc.on) ? sc : { id: sc.id, n: sc.n, screen: sc.screen, work: sc.work || "", timer: sc.timer,
    on: Object.fromEntries(sc.on.map((k) => [k, true])), min: Object.fromEntries((sc.min || []).map((k) => [k, true])), pos: {}, float: sc.on.filter((k) => !(sc.min || []).includes(k)), order: sc.on.slice() });
/* Built-in layouts put their panels on the board, floating (Eddie, 2026-11-20: panels show on the board first, and go to
   the side only when he picks that). A saved layout keeps exactly where each panel was, side or board. */
const keysOf = (o) => Object.keys(o || {}).filter((k) => o[k]).sort().join(",");
export function sceneActive(S, raw) {
    const sc = asScene(raw), T = S.tools;
    if (!(keysOf(T.on) === keysOf(sc.on) && keysOf(T.min) === keysOf(sc.min) && (!sc.screen || S.screen === sc.screen))) return false;
    // A board saved in the Board Builder is showing only when its look and stickers are too.
    if (sc.look) { const L = cleanLook(sc.look); if (["theme", "bg", "mark", "fx"].some((k) => (S.look[k] || "") !== (L[k] || ""))) return false; }
    if (Array.isArray(sc.stk) && sc.stk.map((x) => x.id).join() !== (S.stickers || []).map((x) => x.id).join()) return false;
    return true;
}
export function applyScene(S, raw, api) {
    const sc = asScene(raw), T = S.tools, avail = (k) => api.panelOk(k);
    // "Show in all screens": a pinned panel stays where it is through every layout and Spotlight screen
    const keep = Object.keys(T.pin || {}).filter((k) => T.on[k]).map((k) => [k, !!T.min[k], T.pos[k] ? Object.assign({}, T.pos[k]) : null]);
    T.on = {}; T.min = {}; T.pos = {};
    keep.forEach(([k, mn, p]) => { T.on[k] = true; if (mn) T.min[k] = true; if (p) T.pos[k] = p; });
    Object.keys(sc.on).filter(avail).forEach((k) => { T.on[k] = true; if (sc.min[k]) T.min[k] = true; });
    Object.keys(sc.pos || {}).forEach((k) => { if (T.on[k]) T.pos[k] = Object.assign({}, sc.pos[k]); });
    (sc.float || []).forEach((k) => { if (T.on[k] && !T.min[k] && !T.pos[k]) T.pos[k] = (floatAt && floatAt(k, T)) || api.defaultPos(k); });
    keep.forEach(([k, mn, p]) => { T.on[k] = true; if (mn) T.min[k] = true; else delete T.min[k]; if (p) T.pos[k] = p; });
    T.order = (sc.order || []).filter((k) => T.on[k]);
    if (sc.work) T.work = sc.work;
    if (sc.look) S.look = cleanLook(sc.look);          // a board saved in the Board Builder brings its look
    if (Array.isArray(sc.stk)) S.stickers = cleanStickers(sc.stk);   // ...and its stickers
    if (sc.timer === "bell" && !S.timers.free.running) api.timerSet(api.bellSeconds());
    if (sc.screen && api.screenOk(sc.screen) && sc.screen !== S.screen) { S.screen = sc.screen; S.show = false; }
    api.push();
}
/** Save what the board shows now as a layout. withLook: the Board Builder also keeps the look and the stickers.
    A layout with the same name is replaced and keeps its id, so bell timeline steps that use it still find it. */
export function saveScene(S, name, withLook) {
    const T = S.tools, on = {}, min = {}, pos = {};
    Object.keys(T.on).forEach((k) => { on[k] = true; if (T.min[k]) min[k] = true; if (T.pos[k]) pos[k] = T.pos[k]; });
    const old = T.scenes.find((x) => x.n.toLowerCase() === String(name).trim().toLowerCase());
    const sc = cleanScene(Object.assign({ id: old ? old.id : "u" + Date.now().toString(36), n: name, screen: S.screen, on, min, pos, order: T.order.slice(), work: T.on.work ? T.work : "" },
        withLook ? { look: S.look, stk: S.stickers || [] } : {}));
    T.scenes = T.scenes.filter((x) => x.id !== sc.id).concat([sc]).slice(-MAX_SCENES);
    return sc;
}

/* ---------- turning panels on, off, smaller ---------- */
/* A panel turned on by itself (Quick panels, the Panels sheet, the rail) lands on the board, floating over the lesson,
   where the class can see it right away (Eddie, 2026-11-19). Layouts still place panels their own way, and
   "Put it back on the shelf" passes { dock: true }. boardApp.js gives the spot for each panel. */
let floatAt = null;
export function setFloatDefault(fn) { floatAt = fn; }
export function panelOn(T, k, opts) {
    const fresh = !T.on[k]; T.on[k] = true; delete T.min[k]; T.order = T.order.filter((x) => x !== k).concat([k]);
    if (fresh && !(opts && opts.dock) && floatAt && !T.pos[k]) { const p = floatAt(k, T); if (p) T.pos[k] = p; }
}
export function panelOff(T, k) { delete T.on[k]; delete T.min[k]; delete T.pos[k]; T.order = T.order.filter((x) => x !== k); }
export function panelToggle(T, k) {
    if (k === "find") {   // one switch for every Find panel: off turns them all off, on shows them all again (or opens the first)
        const open = FIND_KEYS.filter((x) => T.on[x]);
        if (!open.length) panelOn(T, "find"); else if (open.some((x) => !T.min[x])) open.forEach((x) => panelOff(T, x)); else open.forEach((x) => panelOn(T, x));
        return;
    }
    if (T.on[k] && !T.min[k]) panelOff(T, k); else panelOn(T, k);
}
/** Is panel k on? The Find switch is on while any Find panel is. */
export const isOn = (T, k) => (k === "find" ? FIND_KEYS.some((x) => T.on[x]) : !!T.on[k]);
const allMin = (T, k) => (k === "find" ? FIND_KEYS.filter((x) => T.on[x]).every((x) => T.min[x]) : !!T.min[k]);
/** Shelf order: the saved order first, then any other panels in list order. */
export function ordered(T, keys) { const o = T.order; return keys.slice().sort((a, b) => { const ia = o.indexOf(a), ib = o.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }); }

/* ---------- lesson panels ---------- */
/** The Slide panel (Eddie, 2026-11-23): one of the lesson's slides in a panel that moves, sizes and styles like the rest.
    It opens filling the screen (spotlight.js), with arrows for the slides before and after. tools.slp = the slide's id. */
function slidePanel(api) {
    const { S, el } = api, T = S.tools, c = api.card(labelOf("slide"), "tool panel tool-slide"), b = c.i;
    const list = api.slideList ? api.slideList() : [], at = Math.max(0, list.findIndex((x) => x.id === T.slp)), cur = list[at];
    const stage = el("div", "pslide"); b.appendChild(stage);
    if (!cur) stage.appendChild(el("p", "vsub", api.slidesReady && !api.slidesReady() ? "Getting your slides…" : "No slides for this lesson yet. Make them in the Slides tab."));
    else requestAnimationFrame(() => { if (stage.isConnected) api.slideInto(stage, cur); });
    if (list.length > 1) {
        const row = el("div", "minis pslnav"), go = (n) => { const x = list[Math.min(list.length - 1, Math.max(0, at + n))]; if (x) { T.slp = x.id; api.push(); } };
        const pv = el("button", null, "‹ Back"), nx = el("button", null, "Next ›"); pv.type = nx.type = "button"; pv.disabled = at <= 0; nx.disabled = at >= list.length - 1;
        pv.onclick = (e) => { e.stopPropagation(); go(-1); }; nx.onclick = (e) => { e.stopPropagation(); go(1); };
        row.append(pv, el("span", "pslnum", (at + 1) + " / " + list.length), nx); b.appendChild(row);
    }
    return c.c;
}
export function buildPanel(k, api) {
    if (k === "slide") return slidePanel(api);
    if (MATH.has(k)) { const c = api.card(labelOf(k), "tool panel tool-mt tool-" + k); c.i.appendChild(mtBody(api, k)); return c.c; }
    if (isFind(k)) { const c = api.card(findTitle(k, api.S.tools) || labelOf(k), "tool panel tool-find"); c.i.appendChild(findBody(api, k)); return c.c; }
    if (k === "cam") { const c = api.card(labelOf(k), "tool tool-cam"); c.i.appendChild(camBody(api.el)); return c.c; }
    if (k === "work") {   // the voice level, and the room's microphone against it (js/roomSense.js, this device only)
        const w = buildWidget(k, api); setVoice(api.S.tools.work); const inn = w.querySelector(".in") || w; inn.appendChild(meterEl(api.el)); return w;
    }
    if (!LESSON.has(k)) return buildWidget(k, api);
    const { S, el } = api, c = api.card(labelOf(k), "tool panel tool-" + k), b = c.i, d = api.day();
    if (k === "ptimer") {
        const v = api.freeView(), ring = el("div", "pring"); ring.dataset.ring = "free";
        ring.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="44"/><circle class="arc" cx="50" cy="50" r="44" pathLength="100"/></svg>';
        const t = el("p", "ptime", v.txt); ring.appendChild(t); b.appendChild(ring);
        const row = el("div", "minis"), go = el("button", "primary", v.running ? "Pause" : (v.elapsed ? "Resume" : "Start")), rs = el("button", null, "Reset"); go.type = rs.type = "button";
        go.dataset.go = "free"; go.onclick = () => api.timerGo(); rs.onclick = () => api.timerReset(); row.append(go, rs); b.appendChild(row);
        const pr = el("div", "minis setup"); [1, 2, 3, 5, 10, 15].forEach((m) => { const x = el("button", null, m + " min"); x.type = "button"; x.setAttribute("aria-pressed", String(v.dur === m * 60)); x.onclick = () => { api.timerSet(m * 60); api.push(); }; pr.appendChild(x); });
        b.appendChild(pr);
    } else if (k === "target") {
        const t = el("p", "ptarget"); t.appendChild(api.rich((d && d.lt) || (api.lesson() && api.lesson().weekLT) || "No learning target is loaded for this day.")); b.appendChild(t);
    } else if (k === "agenda") {
        const items = agendaItems(api), key = api.agendaKey(), manual = S.tools.agenda.k === key, at = agendaAt(api, items);
        if (!items.length) b.appendChild(el("p", "vsub", "No agenda is loaded for this day."));
        const list = el("ol", "pagenda");
        items.forEach((it, i) => {
            const li = el("li", i < at ? "done" : i === at ? "now" : ""), btn = el("button"); btn.type = "button";
            btn.setAttribute("aria-current", i === at ? "step" : "false"); btn.title = i === at && manual ? "Let the agenda follow the lesson again" : "We are here";
            btn.appendChild(el("i")); const sp = el("span"); sp.appendChild(api.rich(it.t)); btn.appendChild(sp);
            btn.onclick = () => { S.tools.agenda = i === at && manual ? { k: "", at: -1 } : { k: key, at: i }; api.push(); };
            li.appendChild(btn); list.appendChild(li);
        });
        b.appendChild(list);
        if (items.length) {
            const row = el("div", "minis setup");
            if (manual) { const f = el("button", null, "Follow the lesson"); f.type = "button"; f.onclick = () => { S.tools.agenda = { k: "", at: -1 }; api.push(); }; row.appendChild(f); }
            const nx = el("button", "primary", at < 0 ? "Start" : "Next item"); nx.type = "button"; nx.disabled = at >= items.length - 1;
            nx.onclick = () => { S.tools.agenda = { k: key, at: Math.min(items.length - 1, at + 1) }; api.push(); };
            row.appendChild(nx); b.appendChild(row);
            if (!manual) b.appendChild(el("p", "vsub setup pnote", "Follows the lesson. Tap a line to set it yourself."));
        }
    } else if (k === "period") {
        const t = el("p", "bigtime"); t.dataset.pclock = "time"; b.appendChild(t);
        const ln = el("p", "vsub"); ln.dataset.pclock = "line"; b.appendChild(ln);
        const bar = el("div", "goalbar pbar"); bar.dataset.pclock = "bar"; bar.appendChild(el("i")); b.appendChild(bar);
        // Alerts before the end of class (Remote only): which minutes, sound, on/off
        const A = S.tools.palert, row = el("div", "minis setup palerts"); row.appendChild(el("span", "palh", "Alerts"));
        PALERT_MINS.forEach((m) => { const x = el("button", null, m ? m + " min" : "Bell"); x.type = "button"; const on = A.at.includes(m); x.setAttribute("aria-pressed", String(A.on && on));
            x.onclick = () => { const at = on ? A.at.filter((y) => y !== m) : A.at.concat(m); S.tools.palert = Object.assign({}, A, { on: true, at: PALERT_MINS.filter((y) => at.includes(y)) }); api.push(); }; row.appendChild(x); });
        const snd = el("button", "palsnd", A.sound ? "Sound on" : "Sound off"); snd.type = "button"; snd.setAttribute("aria-pressed", String(A.sound)); snd.onclick = () => { S.tools.palert = Object.assign({}, A, { sound: !A.sound }); api.push(); }; row.appendChild(snd);
        const off = el("button", "paloff", A.on ? "Alerts on" : "Alerts off"); off.type = "button"; off.setAttribute("aria-pressed", String(A.on)); off.onclick = () => { S.tools.palert = Object.assign({}, A, { on: !A.on }); api.push(); }; row.appendChild(off);
        b.appendChild(row);
        periodTick(api, b);
    }
    return c.c;
}

/* The day's run of show: the bellringer, the agenda lines, the exit ticket. Each knows the screens it covers,
   so the agenda follows the lesson by itself until the teacher taps a line. */
function agendaItems(api) {
    const d = api.day(); if (!d) return [];
    const out = [], ag = (d.agenda || []).filter(Boolean);
    if ((d.problems && d.problems.length) || d.bell) out.push({ t: "Bellringer", s: ["today", "bell"] });
    ag.forEach((t, i) => out.push({ t, s: i === 0 ? ["notes", "speed", "fix", "game", "live", "blank", "timer"] : [] }));
    if (d.notes && d.notes.exit && d.notes.exit.length) out.push({ t: "Exit ticket", s: [], exit: true });
    return out;
}
function agendaAt(api, items) {
    const T = api.S.tools; if (T.agenda.k === api.agendaKey()) return Math.min(T.agenda.at, items.length - 1);
    const ex = items.findIndex((x) => x.exit); if (ex >= 0 && api.S.screen === "notes" && /^Exit/.test(api.noteKind())) return ex;
    return items.findIndex((x) => x.s.includes(api.S.screen));
}

/* Where the chosen period is in the day, from the bell times on Home. Never claims a time it cannot know. */
const mins = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
const nice = (m) => { const h = Math.floor(m / 60); return ((h + 11) % 12 + 1) + ":" + ("0" + (m % 60)).slice(-2); };
export function periodInfo(api) {
    const d = new Date(api.now()), bells = api.bells(), p = api.S.period, b = bells && bells[p], s = mins(b && b.start), e = mins(b && b.end);
    const nowM = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60, wk = d.getDay() >= 1 && d.getDay() <= 5;
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (!bells || s == null || e == null) return { time, line: api.guest() ? d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "Set bell times on Home to see when class ends.", frac: -1, chip: time };
    if (!wk) return { time, line: "No school today", frac: -1, chip: time };
    if (nowM < s) { const left = Math.ceil(s - nowM); return { time, line: p + " period starts at " + nice(s) + (left <= 60 ? " · in " + left + " min" : ""), frac: 0, chip: left <= 60 ? "Starts in " + left + " min" : time }; }
    if (nowM >= e) return { time, line: p + " period ended at " + nice(e), frac: 1, chip: time };
    const left = Math.ceil(e - nowM);
    return { time, line: p + " period · ends " + nice(e) + " · " + left + " min left", frac: (nowM - s) / (e - s), chip: left + " min left", hot: left <= 5 };
}
function periodTick(api, host) {
    const q = (n) => host.querySelector('[data-pclock="' + n + '"]'), t = q("time"); if (!t) return;
    const pi = periodInfo(api); t.textContent = pi.time; q("line").textContent = pi.line;
    const bar = q("bar"); bar.hidden = pi.frac < 0; bar.classList.toggle("done", !!pi.hot); bar.firstChild.style.width = Math.round(Math.max(0, pi.frac) * 100) + "%";
}

/* ---------- live chips: what a minimized panel still shows ---------- */
export function chipValue(k, api) {
    const T = api.S.tools, sec = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); };
    if (k === "ptimer") { const v = api.freeView(); return { v: v.txt, tone: v.done ? "red" : v.hot ? "amber" : v.running ? "green" : "" }; }
    if (k === "stopwatch") return { v: sec(T.sw.running ? api.now() - T.sw.t0 : T.sw.elapsed), tone: T.sw.running ? "green" : "" };
    if (k === "clock") return { v: new Date(api.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) };
    if (k === "period") { const pi = periodInfo(api); return { v: pi.chip, tone: pi.hot ? "amber" : "" }; }
    if (k === "traffic") return { v: { red: "Stop", yellow: "Slow down", green: "Go" }[T.traffic], tone: T.traffic === "yellow" ? "amber" : T.traffic };
    if (k === "work") { const w = WORK.find((x) => x[0] === T.work) || WORK[0]; return tooLoud() ? { v: "Too loud!", tone: "red" } : { v: w[1], tone: "v-" + w[0] }; }
    if (k === "cam") return { v: "Camera" };
    if (isFind(k)) return findChip(k, T);
    if (isMt(k)) return mtChip(k, T);
    if (k === "slide") { const l = api.slideList ? api.slideList() : [], i = Math.max(0, l.findIndex((x) => x.id === T.slp)); return { v: l.length ? "Slide " + (i + 1) + " of " + l.length : "No slides" }; }
    if (k === "text") return { v: (T.text || "No message").slice(0, 28) + ((T.text || "").length > 28 ? "…" : "") };
    if (k === "dice") { const vals = T.dice.vals.slice(0, T.dice.n); return { v: vals.join(" · ") + (vals.length > 1 ? " = " + vals.reduce((a, x) => a + x, 0) : "") }; }
    if (k === "score") return { v: T.score.teams.map((x) => x.s).join(" – ") };
    if (k === "goal") { const p = api.S.period || "1st", n = T.goal.pts[p] || 0; return { v: n + " / " + T.goal.target, tone: n >= T.goal.target ? "amber" : "" }; }
    if (k === "pick") { const names = api.rosters()[T.pick.period || api.S.period] || []; return { v: T.pick.cur >= 0 && names[T.pick.cur] ? names[T.pick.cur] : "Ready" }; }
    if (k === "groups") { const n = T.groups.order.length; return { v: n ? Math.ceil(n / T.groups.size) + " groups" : "Not made" }; }
    if (k === "agenda") { const items = agendaItems(api), at = agendaAt(api, items); return { v: at >= 0 && items[at] ? String(items[at].t).replace(/[{}]/g, "").slice(0, 30) : items.length + (items.length === 1 ? " item" : " items") }; }
    if (k === "target") return { v: "I can…" };
    return { v: "" };
}
export function chip(k, api, onOpen) {
    const { el } = api, c = chipValue(k, api), b = el("button", "pchip"); b.type = "button"; b.dataset.chip = k;
    b.title = "Show " + labelOf(k); b.setAttribute("aria-label", "Show " + labelOf(k));
    const ic = el("span", "pci"); ic.innerHTML = icon(k); b.appendChild(ic);
    const tx = el("span", "pct"); tx.appendChild(el("b", null, labelOf(k))); const v = el("span", "pcv", c.v); tx.appendChild(v); b.appendChild(tx);
    b.dataset.tone = c.tone || ""; b.onclick = onOpen;
    return b;
}

/* End-of-class alerts: a banner across the board and a chime, once per threshold, whether or not the
   Period clock panel is showing. Fires only inside the first few seconds of a threshold, so opening
   a page mid-class never replays an old alert. */
const fired = new Set();
let bannerTimer = 0;
function periodAlerts(api) {
    const A = api.S.tools.palert; if (!A || !A.on || !A.at.length) return;
    const bells = api.bells(), p = api.S.period, bt = bells && bells[p], e = mins(bt && bt.end), s = mins(bt && bt.start); if (e == null || s == null) return;
    const d = new Date(api.now()); if (d.getDay() < 1 || d.getDay() > 5) return;
    const nowS = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(), leftS = e * 60 - nowS; if (nowS < s * 60) return;
    A.at.forEach((m) => {
        const k = d.toDateString() + "|" + p + "|" + m; if (fired.has(k)) return;
        if (leftS <= m * 60 && leftS > m * 60 - 6) { fired.add(k); showAlert(m); if (A.sound && api.cue) api.cue(m === 0 ? "done" : "warn"); }
    });
}
function showAlert(m) {
    const stage = document.getElementById("stage"); if (!stage) return;
    let b = document.getElementById("palertBanner"); if (!b) { b = document.createElement("div"); b.id = "palertBanner"; b.className = "palert"; b.setAttribute("role", "status"); stage.appendChild(b); }
    b.textContent = m === 0 ? "That's the bell. Class is over." : m === 1 ? "1 minute left in class" : m + " minutes left in class";
    b.classList.remove("show"); void b.offsetWidth; b.classList.add("show"); b.classList.toggle("last", m <= 1);
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove("show"), 9000);
}
/** Four times a second: timers, the period clock and the chips. */
export function tickPanels(api) {
    periodAlerts(api);
    const v = api.freeView();
    document.querySelectorAll('[data-ring="free"]').forEach((r) => {
        r.querySelector(".ptime").textContent = v.txt; r.querySelector(".arc").style.strokeDashoffset = String(100 - v.frac * 100);
        r.classList.toggle("hot", v.hot && !v.done); r.classList.toggle("done", v.done); r.classList.toggle("run", v.running);
    });
    document.querySelectorAll('[data-go="free"]').forEach((g) => { g.textContent = v.running ? "Pause" : (v.elapsed ? "Resume" : "Start"); });
    document.querySelectorAll(".tool-period .in").forEach((h) => periodTick(api, h));
    document.querySelectorAll(".pchip").forEach((b) => { const c = chipValue(b.dataset.chip, api), pv = b.querySelector(".pcv"); if (pv.textContent !== c.v) pv.textContent = c.v; if (b.dataset.tone !== (c.tone || "")) b.dataset.tone = c.tone || ""; });
}

/* ---------- the Panels sheet: layouts and every panel, on the board and the Remote ---------- */
let sheet = null, sheetApi = null;
export function openSheet(api) {
    sheetApi = api;
    if (!sheet) {
        sheet = api.el("div", "psheet"); sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Panels and layouts");
        sheet.addEventListener("pointerdown", (e) => { if (e.target === sheet) closeSheet(); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet && !sheet.hidden) closeSheet(); });
        document.body.appendChild(sheet);
    }
    sheet.hidden = false; refreshSheet();
    requestAnimationFrame(() => sheet.classList.add("open"));
    const f = sheet.querySelector(".pclose"); if (f) f.focus();
}
export function closeSheet() { if (!sheet) return; sheet.classList.remove("open"); sheet.hidden = true; }
export const sheetOpen = () => !!sheet && !sheet.hidden;
export function refreshSheet() { refreshSheetNow(); }
function refreshSheetNow() {
    if (!sheetOpen()) return;
    const api = sheetApi, { S, el } = api, T = S.tools, keep = sheet.querySelector(".psave input"), draft = keep ? keep.value : "", hadFocus = keep && document.activeElement === keep;
    const scroll = sheet.querySelector(".pbox") ? sheet.querySelector(".pbox").scrollTop : 0;
    sheet.textContent = "";
    const box = el("div", "pbox");
    const hd = el("div", "phead"), ht = el("div"); ht.appendChild(el("h2", null, "Panels and look")); ht.appendChild(el("p", null, "Pick the board\u2019s colors and background, tap a layout to set up the room, or add panels one at a time. Drag a panel by its title to move it."));
    const x = el("button", "pclose"); x.type = "button"; x.innerHTML = icon("x"); x.setAttribute("aria-label", "Close"); x.onclick = closeSheet; hd.append(ht, x); box.appendChild(hd);

    box.appendChild(el("p", "psec", "Board look"));
    box.appendChild(lookPicker(api, false));
    box.appendChild(el("p", "psec", "Layouts"));
    const sc = el("div", "pscenes");
    const sceneBtn = (raw, own) => {
        const on = sceneActive(S, raw), b = el("button", "pscene" + (on ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", String(on));
        b.appendChild(el("b", null, raw.n)); b.appendChild(el("span", null, raw.d || describe(raw)));
        b.onclick = (e) => { if (e.target.closest(".pdel")) return; applyScene(S, raw, api); refreshSheet(); };
        if (own) { const del = el("span", "pdel"); del.innerHTML = icon("x"); del.setAttribute("role", "button"); del.tabIndex = 0; del.setAttribute("aria-label", "Delete layout " + raw.n); del.title = "Delete this layout";
            const kill = (e) => { e.stopPropagation(); T.scenes = T.scenes.filter((y) => y.id !== raw.id); api.push(); refreshSheet(); }; del.onclick = kill; del.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") kill(e); }; b.appendChild(del); }
        sc.appendChild(b);
    };
    SCENES.filter((s) => !(s.guestless && api.guest())).forEach((s) => sceneBtn(s, false));
    T.scenes.forEach((s) => sceneBtn(s, true));
    box.appendChild(sc);
    const sv = el("form", "psave"), inp = el("input"); inp.type = "text"; inp.maxLength = 24; inp.placeholder = "Name this layout, like: Test day"; inp.setAttribute("aria-label", "Name for this layout"); inp.value = draft;
    const sb = el("button", null, "Save this layout"); sb.type = "submit"; sb.disabled = !Object.keys(T.on).length;
    sv.onsubmit = (e) => { e.preventDefault(); const n = inp.value.trim(); if (!n) { inp.focus(); return; } saveScene(S, n); inp.value = ""; api.push(); refreshSheet(); };
    sv.append(inp, sb); box.appendChild(sv);

    [["Lesson", LESSON_PANELS], ["Calculators", CALC_LIST], ["Classroom", PANEL_LIST.filter((p) => !LESSON.has(p[0]) && !MATH.has(p[0]) && !/^find\d/.test(p[0]))], ["Math tools", MATH_LIST]].forEach(([title, list]) => {
        box.appendChild(el("p", "psec", title));
        const g = el("div", "pgrid");
        list.filter(([k]) => api.panelOk(k)).forEach(([k, label]) => {
            const st = !isOn(T, k) ? "off" : allMin(T, k) ? "min" : T.pos[k] ? "float" : "on";
            const b = el("button", "ptile " + st); b.type = "button"; b.setAttribute("aria-pressed", String(st !== "off"));
            const ic = el("span", "pti"); ic.innerHTML = icon(k); b.appendChild(ic);
            const tx = el("span", "ptt"); tx.appendChild(el("b", null, label)); tx.appendChild(el("span", null, PANEL_INFO[k] || "")); b.appendChild(tx);
            b.appendChild(el("span", "pst", { off: "Add", on: "On", min: "Minimized", float: "Floating" }[st]));
            b.onclick = () => { panelToggle(T, k); api.push(); refreshSheet(); };
            g.appendChild(b);
        });
        box.appendChild(g);
    });
    if (Object.keys(T.on).length) { const c = el("button", "pclear", "Hide all panels"); c.type = "button"; c.onclick = () => { T.on = {}; T.min = {}; T.pos = {}; T.order = []; api.push(); refreshSheet(); }; box.appendChild(c); }
    sheet.appendChild(box); box.scrollTop = scroll;
    if (hadFocus) { const i = sheet.querySelector(".psave input"); i.focus(); }
}
const describe = (sc) => { const ks = Object.keys(sc.on || {}); return ks.length ? ks.map(labelOf).slice(0, 3).join(", ") + (ks.length > 3 ? " +" + (ks.length - 3) : "") : "No panels"; };

/* ---------- Board look: colour scheme and background, shared like everything else ---------- */
export const LOOK_THEMES = [
    ["navy", "Navy", ["#173F86", "#0B2559", "#081B45"]], ["midnight", "Midnight", ["#1C2448", "#0D132E", "#05081A"]],
    ["ocean", "Ocean", ["#11607C", "#0A3D5A", "#06243A"]], ["forest", "Forest", ["#1F5C47", "#123B2E", "#0A251C"]],
    ["plum", "Plum", ["#4B2E75", "#2D1B4B", "#1A0F2E"]], ["slate", "Slate", ["#3B4659", "#242C3B", "#141A24"]],
    ["crimson", "Crimson", ["#6E2533", "#42161F", "#260B12"]],
    // Christmas
    ["evergreen", "Evergreen", ["#1E6B43", "#0F4229", "#072617"]], ["cranberry", "Cranberry", ["#9A1F33", "#5E0F1E", "#320710"]],
    ["winter", "Winter night", ["#2C4A8C", "#182A57", "#0A1433"]],
    // Board Builder, Nov 21
    ["royal", "Royal", ["#2E3AA8", "#1C2470", "#0F1440"]], ["teal", "Teal", ["#0F6B6B", "#0A4747", "#052A2A"]],
    ["chalk", "Chalkboard", ["#33503F", "#243A2D", "#16261D"]], ["sunset", "Sunset", ["#8A3B2E", "#5A2233", "#2B1028"]],
    ["harvest", "Harvest", ["#7A4A1E", "#4E2E14", "#2A180A"]], ["berry", "Berry", ["#7A2257", "#4B1438", "#2A0A1F"]],
];
export const LOOK_BGS = [["anchor", "Big logo"], ["plain", "Plain"], ["rings", "Rings"], ["grid", "Graph paper"], ["dots", "Dots"], ["glow", "Glow"],
    ["snow", "Snowfall"], ["lights", "Christmas lights"], ["trees", "Snowy pines"], ["candy", "Candy cane"],
    // Board Builder, Nov 21
    ["axes", "Coordinate plane"], ["paper", "Notebook"], ["chalk", "Chalk dust"], ["shapes", "Shapes"], ["hex", "Honeycomb"],
    ["waves", "Waves"], ["hills", "Hills"], ["space", "Space"], ["sunset", "Sunset glow"], ["bokeh", "Soft lights"], ["leaves", "Fall leaves"], ["confetti", "Confetti"]];
/* Real photos (photos/*.webp, 2560 wide; the small tiles are photos/sm/*.webp). All from Unsplash, whose licence lets anyone
   use them free with no credit required; the photographer is still named on each tile and in photos/CREDITS.md.
   A veil in the board's colours (css/look.css) keeps the lesson readable on top. [id, name, group key, photographer]
   Ids never change once saved (boards and saved looks keep them); a photo can move to another group freely. */
export const PHOTO_SECTIONS = [
    ["Places", [["mtn", "Mountains"], ["bch", "Beaches"], ["wtr", "Forests & water"], ["dsr", "Deserts & canyons"], ["cty", "Cities"], ["sky", "Night sky & space"]]],
    ["Living things", [["ani", "Animals"], ["sea", "Ocean life"]]],
    ["Seasons", [["fal", "Fall"], ["win", "Winter"], ["spr", "Spring"]]],
    ["For class", [["mth", "Math in nature"], ["spt", "Sports"]]],
];
const PHOTO_GROUP = new Map(PHOTO_SECTIONS.flatMap((s) => s[1]));
export const LOOK_PHOTOS = [
    ["ph-mtn-lake", "Mountain lake", "mtn", "Tobias Keller"], ["ph-mtn-peak", "Alpine peak", "mtn", "Pietro De Grandi"], ["ph-mtn-ridge", "Wildflower ridge", "mtn", "Daniela Kokina"],
    ["ph-mtn-dusk", "Ridges at dusk", "mtn", "Sven Pieren"], ["ph-mtn-snow", "Snowy valley", "mtn", "Kalen Emsley"], ["ph-mtn-mist", "Misty summit", "mtn", "v2osk"],
    ["ph-bch-gold", "Golden shore", "bch", "Sean Oulashin"], ["ph-bch-palms", "Palm beach", "bch", "Matthew Brodeur"], ["ph-bch-sunset", "Beach sunset", "bch", "Cristofer Maximilian"],
    ["ph-bch-waves", "Waves", "bch", "Mink Mingle"], ["ph-bch-cove", "Hidden cove", "bch", "Derek Thomson"],
    ["ph-lnd-valley", "Valley river", "wtr", "Bailey Zindel"], ["ph-lnd-mist", "Misty forest", "wtr", "pine watt"], ["ph-lnd-cabin", "Lake cabin", "wtr", "Luca Bravo"],
    ["ph-lnd-tree", "Lone tree", "wtr", "Ken Cheung"], ["ph-wtr-bridge", "Bridge falls", "wtr", "Blake Verdoorn"], ["ph-wtr-pool", "Falls pool", "wtr", "Jeffrey Workman"],
    ["ph-wtr-basalt", "Hidden falls", "wtr", "MJ Tangonan"], ["ph-wtr-forest", "Forest falls", "wtr", "John Rodenn Castillo"], ["ph-wtr-cave", "Behind the falls", "wtr", "v2osk"],
    ["ph-dsr-canyon", "Canyon country", "dsr", "K. Mitch Hodge"], ["ph-dsr-rocks", "Red rocks", "dsr", "Thomas Ten"], ["ph-dsr-wave", "Sandstone wave", "dsr", "Tyler Franta"],
    ["ph-dsr-swirl", "Painted desert", "dsr", "John Fowler"], ["ph-dsr-river", "Canyon river", "dsr", "Megan Clark"], ["ph-dsr-slot", "Slot canyon", "dsr", "Nick Kelly"],
    ["ph-cty-dawn", "Skyline at dawn", "cty", "Jonathan Roger"], ["ph-cty-bridge", "Bridge at night", "cty", "Luca Bravo"], ["ph-cty-lake", "Lakefront skyline", "cty", "Jeff Brown"],
    ["ph-cty-pink", "Pink sky harbor", "cty", "Muzammil Soorma"], ["ph-cty-sunset", "Sunset towers", "cty", "Shea Rouda"], ["ph-cty-night", "Night reflections", "cty", "Pang Yuhao"],
    ["ph-sky-aurora", "Northern lights", "sky", "Johny Goerend"], ["ph-sky-lagoon", "Aurora lagoon", "sky", "v2osk"], ["ph-sky-pines", "Aurora forest", "sky", "Vincent Guth"],
    ["ph-sky-milky", "Milky Way", "sky", "Dns Dgn"], ["ph-sky-peaks", "Starry peaks", "sky", "Benjamin Voros"], ["ph-sky-orion", "Orion Nebula", "sky", "Bryan Goff"],
    ["ph-sky-galaxy", "Galaxy", "sky", "Jeremy Thomas"], ["ph-sky-earth", "Planet Earth", "sky", "NASA"], ["ph-sky-lights", "Earth at night", "sky", "NASA"],
    ["ph-sky-orbit", "From orbit", "sky", "NASA"],
    ["ph-ani-fox", "Fox", "ani", "Ray Hennessy"], ["ph-ani-lion", "Lion and cub", "ani", "Zdeněk Macháček"], ["ph-ani-bear", "Polar bear", "ani", "Hans-Jurgen Mager"],
    ["ph-ani-zebra", "Zebras", "ani", "sutirta budiman"], ["ph-ani-flamingo", "Flamingo", "ani", "Alejandro Contreras"], ["ph-ani-penguin", "Penguin", "ani", "Cornelius Ventures"],
    ["ph-ani-king", "King penguin", "ani", "Ian Parker"], ["ph-ani-owl", "Little owl", "ani", "Zdeněk Macháček"], ["ph-ani-eagleowl", "Eagle owl", "ani", "Dirk van Wolferen"],
    ["ph-ani-barnowl", "Barn owl", "ani", "Ronan Furuta"], ["ph-ani-elephants", "Elephants at dusk", "ani", "Mylon Ollila"], ["ph-ani-herd", "Elephant herd", "ani", "Matthew Spiteri"],
    ["ph-ani-wolf", "Gray wolf", "ani", "Marc-Olivier Jodoin"],
    ["ph-ani-turtle", "Sea turtle", "sea", "Wexor Tmg"], ["ph-sea-coral", "Coral garden", "sea", "qui nguyen"], ["ph-sea-sunlit", "Sunlit reef", "sea", "Hiroko Yoshii"],
    ["ph-sea-reef", "Reef fish", "sea", "Shifaz Abdul Hakkim"], ["ph-sea-orange", "Orange fish", "sea", "Francesco Ungaro"], ["ph-sea-breach", "Whale breach", "sea", "Todd Cravens"],
    ["ph-sea-humpback", "Humpback", "sea", "Gabriel Dizzi"], ["ph-sea-shark", "Whale shark", "sea", "Sebastian Pena Lambarri"], ["ph-sea-dolphin", "Dolphin", "sea", "Pagie Page"],
    ["ph-lnd-autumn", "Autumn forest", "fal", "Johannes Plenio"], ["ph-fal-lake", "Autumn lake", "fal", "Ryan Liu"], ["ph-fal-larch", "Golden larches", "fal", "Federica Galli"],
    ["ph-fal-path", "Golden path", "fal", "Lukasz Szmigiel"], ["ph-fal-aspen", "Aspen valley", "fal", "Thomas Morse"], ["ph-fal-stream", "Yellow woods", "fal", "Isakov Eldiiar"],
    ["ph-win-cabin", "Snowy cabin", "win", "Ian Keefe"], ["ph-win-lake", "Frozen lake", "win", "Tim Stief"], ["ph-win-pines", "Snowy pines", "win", "Annie Spratt"],
    ["ph-win-village", "Winter sunset", "win", "Michael Niessl"], ["ph-win-river", "Snowy creek", "win", "Pietro Donà"], ["ph-win-valley", "Winter valley", "win", "jms"],
    ["ph-win-falls", "Icy falls", "win", "Alessio Zappatore"],
    ["ph-lnd-flowers", "Lakeside flowers", "spr", "Mark Harpur"], ["ph-spr-water", "Cherry lake", "spr", "Mark Tegethoff"], ["ph-spr-mirror", "Blossom mirror", "spr", "Redd Francisco"],
    ["ph-spr-path", "Blossom path", "spr", "Maud Bocquillod"], ["ph-spr-branch", "Cherry branches", "spr", "Nagy Arnold"],
    ["ph-mth-hex", "Hexagon honeycomb", "mth", "Jonas Hensel"], ["ph-mth-honey", "Honey hexagons", "mth", "Cristina Marin"], ["ph-mth-nautilus", "Nautilus spiral", "mth", "Manila Kumari"],
    ["ph-mth-sunflower", "Sunflower spirals", "mth", "Lisa Siefert"], ["ph-mth-fern", "Fern spiral", "mth", "FELIXFELIX FELIX"], ["ph-mth-stairs", "Spiral staircase", "mth", "Otto Freijser"],
    ["ph-mth-succ", "Succulent spiral", "mth", "Christian Lambert"], ["ph-mth-ammonite", "Ammonite spiral", "mth", "David Clode"],
    ["ph-spt-field", "Field at sunset", "spt", "Amina"], ["ph-spt-stadium", "Stadium", "spt", "Eliézer Fernandes"], ["ph-spt-ball", "Game ball", "spt", "Connor Coyne"],
    ["ph-spt-goals", "Practice field", "spt", "Jonathan Adams"],
];
/* A new photo every day: pd-all from every group, pd-<group> from one group. The same photo all day on every screen. */
export const DAILY_PHOTOS = [["pd-all", "Photo of the day", ""]].concat(PHOTO_SECTIONS.flatMap((s) => s[1].map(([k, n]) => ["pd-" + k, n + ", a new one each day", k])));
const isPhoto = (id) => LOOK_PHOTOS.some((x) => x[0] === id) || DAILY_PHOTOS.some((x) => x[0] === id) || isMine(id);
/** Every background name, for labels: patterns, photos, daily photos and the teacher's own pictures. */
export const bgName = (id) => { const f = LOOK_BGS.concat(LOOK_PHOTOS, DAILY_PHOTOS).find((x) => x[0] === id); if (f) return f[1]; const m = mineList().find((x) => x.id === id); return m ? m.name : isMine(id) ? "My picture" : id; };
/** The photo a daily background shows on a given day (a fixed shuffle, so neighbouring days differ). */
export function dailyPhoto(bg, when) {
    const g = bg === "pd-all" ? "" : bg.slice(3), list = LOOK_PHOTOS.filter((x) => !g || x[2] === g);
    if (!list.length) return "";
    const order = list.map((x, i) => [x[0], ((i + 1) * 2654435761) % 4294967296]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    const d = when || new Date(), day = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
    return order[((day % order.length) + order.length) % order.length];
}
/* One tap for a whole look: [id, name, colours, background, logo, effect, group]. */
export const LOOK_PRESETS = [
    ["math", "Math class", "navy", "axes", "pi", "math", "Every day"], ["chalkboard", "Chalkboard", "chalk", "chalk", "anchor", "none", "Every day"],
    ["calm", "Test day calm", "slate", "plain", "anchor", "none", "Every day"], ["game", "Game day", "royal", "confetti", "star", "confetti", "Every day"],
    ["space", "Outer space", "midnight", "space", "star", "sparkles", "Every day"], ["ocean", "Under the sea", "ocean", "waves", "rings", "bubbles", "Every day"],
    ["fall", "Fall leaves", "sunset", "leaves", "anchor", "leaves", "Fall"], ["thanks", "Thanksgiving", "harvest", "leaves", "anchor", "turkeys", "Fall"],
    ["xmas-lights", "Christmas lights", "evergreen", "lights", "ornament", "none", "Winter"], ["xmas-snow", "Snowy night", "winter", "snow", "snowflake", "snow", "Winter"],
    ["xmas-pines", "Winter forest", "evergreen", "trees", "tree", "none", "Winter"], ["xmas-candy", "Candy cane", "cranberry", "candy", "star", "none", "Winter"],
    ["snowmen", "Snow day", "winter", "hills", "snowflake", "snowmen", "Winter"], ["valentine", "Valentine's", "berry", "bokeh", "anchor", "hearts", "Spring"],
    ["clover", "Lucky day", "forest", "hills", "anchor", "clovers", "Spring"], ["spring", "Spring", "teal", "hills", "anchor", "flowers", "Spring"],
    ["p-day", "Photo of the day", "navy", "pd-all", "anchor", "none", "Photos"], ["p-winter", "Winter cabin", "winter", "ph-win-cabin", "snowflake", "snow", "Photos"],
    ["p-aurora", "Northern lights", "midnight", "ph-sky-aurora", "star", "sparkles", "Photos"],
    ["p-lake", "Mountain lake", "navy", "ph-mtn-lake", "anchor", "none", "Photos"], ["p-beach", "Beach sunset", "sunset", "ph-bch-sunset", "anchor", "none", "Photos"],
    ["p-forest", "Misty forest", "forest", "ph-lnd-mist", "anchor", "none", "Photos"], ["p-city", "City at night", "midnight", "ph-cty-bridge", "star", "none", "Photos"],
    ["p-fox", "Fox in the snow", "ocean", "ph-ani-fox", "anchor", "snow", "Photos"],
];
const presetOn = (L, p) => L.theme === p[2] && L.bg === p[3] && (L.mark || "anchor") === p[4] && (L.fx || "none") === p[5];
export const presetLook = (p, fxn) => ({ theme: p[2], bg: p[3], mark: p[4], fx: p[5], fxn: fxn || 2 });
const XMAS = new Set(["evergreen", "cranberry", "winter"]);
export const defaultLook = () => ({ theme: "navy", bg: "anchor", mark: "anchor", fx: "none", fxn: 2 });
export function cleanLook(o) { const d = defaultLook(); if (!o || typeof o !== "object") return d; if (LOOK_THEMES.some((t) => t[0] === o.theme)) d.theme = o.theme; if (LOOK_BGS.some((b) => b[0] === o.bg) || isPhoto(o.bg)) d.bg = o.bg; if (MARKS.some((m) => m[0] === o.mark)) d.mark = o.mark; if (EFFECTS.some((e) => e[0] === o.fx)) d.fx = o.fx; if ([1, 2, 3].includes(+o.fxn)) d.fxn = +o.fxn; return d; }
export const themeCols = (id) => (LOOK_THEMES.find((x) => x[0] === id) || LOOK_THEMES[0])[2];
export const gradOf = (id) => { const t = LOOK_THEMES.find((x) => x[0] === id) || LOOK_THEMES[0]; return "linear-gradient(135deg," + t[2][0] + " 0%," + t[2][1] + " 55%," + t[2][2] + " 100%)"; };
let lookApplied = "", seal = "brand/logo.svg";
/** The header logo for the current look (brand/logo.svg for Navy + Anchor). */
export const lookSeal = () => seal;
const MARK_VARS = ["--ring-mark", "--ring-mark-light", "--ring-wm"];
let lastLook = null, dayT = 0;
/* At midnight a daily photo turns over to the next one, even on a board left open overnight. */
function dayTimer() {
    clearTimeout(dayT); const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 30);
    dayT = setTimeout(() => { if (lastLook && /^pd-/.test(lastLook.bg)) { lookApplied = ""; applyLook(lastLook); } }, Math.min(next - n, 2147483000));
}
onMine(() => { if (lastLook && isMine(lastLook.bg)) { lookApplied = ""; applyLook(lastLook); } });
export function applyLook(look) {
    applyEffect(look.fx || "none", look.fxn);   // has its own did-it-change check
    lastLook = look;
    // A daily photo shows one real photo all day; the teacher's own picture shows once it has loaded.
    const daily = /^pd-/.test(look.bg), shown = daily ? dailyPhoto(look.bg) : look.bg, mine = isMine(look.bg) ? mineSrc(look.bg) : "";
    const key = look.theme + "|" + shown + "|" + (look.mark || "anchor") + "|" + (mine ? mine.length : 0); if (key === lookApplied) return; lookApplied = key;
    const b = document.body, t = LOOK_THEMES.find((x) => x[0] === look.theme) || LOOK_THEMES[0];
    if (daily) { b.style.setProperty("--ph-day", 'url("photos/' + shown.slice(3) + '.webp")'); dayTimer(); } else b.style.removeProperty("--ph-day");
    if (mine) b.style.setProperty("--ph-mine", 'url("' + mine + '")'); else b.style.removeProperty("--ph-mine");
    if (t[0] === "navy") { b.style.removeProperty("--ring-grad"); b.style.removeProperty("--look-out"); b.style.removeProperty("--look-mid"); b.style.removeProperty("--look-hi"); }
    else { b.style.setProperty("--ring-grad", gradOf(t[0])); b.style.setProperty("--look-out", t[2][2]); b.style.setProperty("--look-mid", t[2][1]); b.style.setProperty("--look-hi", t[2][0]); }
    b.dataset.theme = t[0]; b.dataset.bg = shown;
    // The logo follows the colour scheme; Navy + Anchor keeps the brand files exactly as they are
    const mk = look.mark || "anchor";
    if (t[0] === "navy" && mk === "anchor") { MARK_VARS.forEach((v) => b.style.removeProperty(v)); seal = "brand/logo.svg"; }
    else {
        const u = (kind) => 'url("' + markUrl(mk, t[2], kind, t[0]) + '")';
        b.style.setProperty("--ring-mark", u("dark")); b.style.setProperty("--ring-mark-light", u("light")); b.style.setProperty("--ring-wm", u("wm"));
        seal = markUrl(mk, t[2], "tile", t[0]);
    }
    b.dataset.mark = mk;
    document.querySelectorAll("#stage .hdr > img, #stage .wbstrip > img").forEach((im) => { if (im.getAttribute("src") !== seal) im.src = seal; });
}
/** One Quick look tile: its colours, background and logo in a small picture. */
export function presetTile(api, p, after) {
    const { S, el } = api, on = presetOn(S.look, p), b = el("button", "lookbg" + (on ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", String(on));
    const pv = el("span", "lpv"); pv.style.background = gradOf(p[2]); pv.appendChild(el("span", "stagebg pv-" + p[3]));
    const pm = el("img", "lpm"); pm.alt = ""; pm.src = p[2] === "navy" && p[4] === "anchor" ? "brand/logo.svg" : markUrl(p[4], themeCols(p[2]), "tile", p[2]); pv.appendChild(pm);
    if (p[5] !== "none") pv.appendChild(el("span", "lpfx", effectSample(p[5]).split(" ")[0]));
    b.appendChild(pv); b.appendChild(el("span", "lnm", p[1]));
    b.onclick = () => { S.look = presetLook(p, S.look.fxn); api.push(); if (after) after(); };
    return b;
}
/** The photo backgrounds. One bar names the group on show (its picture, name and count) with Change; Change opens a tidy grid of
    every group as picture tiles, and picking one folds the grid away and shows that group's photos. pick(id) sets the background;
    after() redraws. "day" shows the photo-of-the-day choices, "mine" the teacher's own pictures. */
let photoGroup = "", photoBrowse = false, mineMsg = "", pickerAfter = null;
onMine(() => { if (pickerAfter) pickerAfter(); });
/** What the photo picker shows (so a redraw check can see a group change, the grid opening or a new picture). */
export const photoGroupNow = () => photoGroup + "|" + (photoBrowse ? "b" : "") + "|" + mineMsg + "|" + mineList().map((x) => x.id).join(",");
const groupOf = (bg) => { if (/^pd-/.test(bg)) return "day"; if (isMine(bg)) return "mine"; const f = LOOK_PHOTOS.find((x) => x[0] === bg); return f ? f[2] : "day"; };
/** A group's name, a short line under it, and its picture (a class for .stagebg, or the teacher's own picture). */
function groupCard(k) {
    if (k === "day") return { name: "Photo of the day", sub: "A new one every day", pv: "pd-all" };
    if (k === "mine") { const m = mineList(); return { name: "My pictures", sub: m.length ? m.length + " of " + MY_MAX : "Add your own", pv: "", img: m.length ? m[0].t : "" }; }
    const list = LOOK_PHOTOS.filter((x) => x[2] === k);
    return { name: PHOTO_GROUP.get(k) || k, sub: list.length + " photos", pv: list.length ? list[0][0] : "pd-" + k };   // one photo stands for the group
}
function groupThumb(el, c, cls) {
    const pv = el("span", "lpv " + cls), sb = el("span", "stagebg" + (c.pv ? " pv-" + c.pv : ""));
    if (c.img) Object.assign(sb.style, { backgroundImage: 'url("' + c.img + '")', backgroundSize: "cover", backgroundPosition: "center", opacity: "1" }); else if (!c.pv) pv.classList.add("lookpnone");
    pv.appendChild(sb); return pv;
}
export function photoPicker(el, look, pick, after, opts) {
    const o = opts || {};
    pickerAfter = after || null;
    if (!photoGroup) photoGroup = groupOf(look.bg);
    const box = el("div", "lookphotos");
    // The bar: what is on show now, and Change / Done for the grid of groups
    const c = groupCard(photoGroup), bar = el("button", "lookpcur" + (photoBrowse ? " open" : "")); bar.type = "button";
    bar.setAttribute("aria-expanded", String(photoBrowse)); bar.title = photoBrowse ? "Close the list of photo groups" : "Pick another group of photos";
    const tx = el("span", "lookptx"); tx.append(el("b", null, c.name), el("small", null, c.sub));
    const chg = el("span", "lookpchg", photoBrowse ? "Done" : "Change");
    bar.append(groupThumb(el, c, "lookpth"), tx, chg);
    bar.onclick = () => { photoBrowse = !photoBrowse; mineMsg = ""; if (after) after(); };
    box.appendChild(bar);
    if (photoBrowse) {   // every group as a picture tile, all the same size
        const cats = el("div", "lookcats"); cats.setAttribute("role", "group"); cats.setAttribute("aria-label", "Photo groups");
        const keys = ["day"].concat(o.guest ? [] : ["mine"], PHOTO_SECTIONS.flatMap((s) => s[1].map((g) => g[0])));
        keys.forEach((k) => {
            const g = groupCard(k), on = k === photoGroup, b = el("button", "lookcat" + (on ? " on" : "") + (k === "day" || k === "mine" ? " special" : ""));
            b.type = "button"; b.setAttribute("aria-pressed", String(on)); b.title = g.name + ", " + g.sub.toLowerCase();
            b.append(groupThumb(el, g, "lookcpv"), el("span", "lookcnm", g.name));
            b.onclick = () => { photoGroup = k; photoBrowse = false; mineMsg = ""; if (after) after(); };
            cats.appendChild(b);
        });
        box.appendChild(cats);
        return box;
    }
    const grid = el("div", "lookbgs"); grid.setAttribute("role", "group");
    const tile = (id, name, sub, title, fill) => {
        const on = look.bg === id, b = el("button", "lookbg" + (on ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", String(on)); if (title) b.title = title;
        const pv = el("span", "lpv"); pv.style.background = gradOf(look.theme); const sb = el("span", "stagebg pv-" + id); if (fill) fill(sb); pv.appendChild(sb);
        b.appendChild(pv); b.appendChild(el("span", "lnm", name)); if (sub) b.appendChild(el("span", "lwho", sub));
        b.onclick = () => pick(id); grid.appendChild(b); return b;
    };
    if (photoGroup === "day") {
        grid.setAttribute("aria-label", "Photo of the day");
        tile("pd-all", "Photo of the day", "From all " + LOOK_PHOTOS.length + " photos");
        PHOTO_SECTIONS.forEach(([, groups]) => groups.forEach(([k, n]) => tile("pd-" + k, n, LOOK_PHOTOS.filter((x) => x[2] === k).length + " photos, one a day")));
    } else if (photoGroup === "mine") {
        grid.setAttribute("aria-label", "My pictures");
        const mine = mineList();
        box.appendChild(el("p", "lookcred", "Add a picture from your computer: a class photo of a field trip, your own landscape, anything. It is made smaller and saved to your account, up to " + MY_MAX + ". Pictures with students' faces are best kept off the board unless you have permission."));
        if (mine.length < MY_MAX) {
            const add = el("button", "lookbg lookadd"); add.type = "button";
            const pv = el("span", "lpv lpvadd", "+"); add.append(pv, el("span", "lnm", "Add a picture"), el("span", "lwho", "JPG, PNG or WebP"));
            const inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.hidden = true;
            inp.onchange = async () => {
                const f = inp.files && inp.files[0]; inp.value = ""; if (!f) return;
                mineMsg = "Adding the picture\u2026"; if (after) after();
                const r = await addMine(f); mineMsg = r.ok ? "" : r.why;
                if (r.ok) pick(r.id); if (after) after();
            };
            add.onclick = () => inp.click(); grid.append(add, inp);
        }
        mine.forEach((x) => {
            const t = tile(x.id, x.name, new Date(x.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), x.name, (sb) => { sb.style.backgroundImage = 'var(--ph-veil),url("' + x.t + '")'; });
            const del = el("span", "lookdel", "\u00d7"); del.setAttribute("role", "button"); del.tabIndex = 0; del.title = "Delete " + x.name; del.setAttribute("aria-label", "Delete " + x.name);
            const go = async (ev) => { ev.stopPropagation(); ev.preventDefault(); if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "Delete?"; return; } await removeMine(x.id); if (look.bg === x.id) pick("anchor"); if (after) after(); };
            del.onclick = go; del.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") go(ev); };
            t.appendChild(del);
        });
        if (mineMsg) box.appendChild(el("p", "lookmsg", mineMsg));
    } else {
        grid.setAttribute("aria-label", (PHOTO_GROUP.get(photoGroup) || "") + " photos");
        tile("pd-" + photoGroup, "A new one each day", "From these " + LOOK_PHOTOS.filter((x) => x[2] === photoGroup).length);
        LOOK_PHOTOS.filter((x) => x[2] === photoGroup).forEach(([id, name, , who]) => tile(id, name, who, name + ". Photo: " + who + " on Unsplash"));
    }
    box.appendChild(grid);
    if (photoGroup === "day") box.appendChild(el("p", "lookcred", "A different photo each day, the same one on every screen. It turns over at midnight."));
    if (photoGroup !== "mine") box.appendChild(el("p", "lookcred", "Photos from Unsplash, free to use. The name under each one is the photographer."));
    return box;
}
/** Swatches for the colour scheme and tiles for the background. compact: the Remote's rail. */
export function lookPicker(api, compact) {
    const refreshSheet = api.refresh || api.relook || refreshSheetNow;   // Spotlight redraws its own sheet
    const { S, el } = api, box = el("div", "lookpick" + (compact ? " compact" : ""));
    const th = el("div", "lookthemes"); th.setAttribute("role", "group"); th.setAttribute("aria-label", "Board colors");
    {   // Quick looks: colours, background, logo and effect together, one tap
        box.appendChild(el("p", "lookh", "Quick looks"));
        const pr = el("div", "lookbgs lookpresets"); pr.setAttribute("role", "group"); pr.setAttribute("aria-label", "Quick looks");
        LOOK_PRESETS.forEach((p) => pr.appendChild(presetTile(api, p, () => refreshSheet())));
        box.appendChild(pr);
        // The Remote's rail keeps just the Quick looks; every color, background, effect, logo and sticker is in the Board Builder.
        const more = el("a", "lookmore", compact ? "More looks and stickers in the Board Builder" : "Open the Board Builder: every look, panels and stickers in one place");
        more.href = "studio.html"; if (api.guest && api.guest()) more.hidden = true;
        if (compact) { box.appendChild(more); return box; }
        box.appendChild(more); box.appendChild(el("p", "lookh", "Colors"));
    }
    LOOK_THEMES.forEach(([id, name]) => {
        const b = el("button", "lookth" + (XMAS.has(id) ? " xmas" : "") + (S.look.theme === id ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", String(S.look.theme === id)); b.title = name;
        const sw = el("span", "lsw"); sw.style.background = gradOf(id); b.appendChild(sw); b.appendChild(el("span", "lnm", name));
        b.onclick = () => { S.look = Object.assign({}, S.look, { theme: id }); api.push(); refreshSheet(); }; th.appendChild(b);
    });
    box.appendChild(th);
    box.appendChild(el("p", "lookh", "Logo"));   // drawn in the colours picked above
    const mks = el("div", "lookmarks"); mks.setAttribute("role", "group"); mks.setAttribute("aria-label", "Board logo");
    const cur = S.look.mark || "anchor";
    MARKS.forEach(([id, name]) => {
        const b = el("button", "lookmk" + (cur === id ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", String(cur === id)); b.title = name;
        const im = el("img", "lmk"); im.alt = ""; im.src = S.look.theme === "navy" && id === "anchor" ? "brand/logo.svg" : markUrl(id, themeCols(S.look.theme), "tile", S.look.theme);
        b.appendChild(im); b.appendChild(el("span", "lnm", name));
        b.onclick = () => { S.look = Object.assign({}, S.look, { mark: id }); api.push(); refreshSheet(); }; mks.appendChild(b);
    });
    box.appendChild(mks);
    box.appendChild(el("p", "lookh", "Background"));
    const bg = el("div", "lookbgs"); bg.setAttribute("role", "group"); bg.setAttribute("aria-label", "Board background");
    LOOK_BGS.forEach(([id, name]) => {
        const b = el("button", "lookbg" + (S.look.bg === id ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", String(S.look.bg === id));
        const pv = el("span", "lpv"); pv.style.background = gradOf(S.look.theme); pv.appendChild(el("span", "stagebg pv-" + id)); b.appendChild(pv); b.appendChild(el("span", "lnm", name));
        b.onclick = () => { S.look = Object.assign({}, S.look, { bg: id }); api.push(); refreshSheet(); }; bg.appendChild(b);
    });
    box.appendChild(bg);
    box.appendChild(el("p", "lookh", "Photos"));
    box.appendChild(photoPicker(el, S.look, (id) => { S.look = Object.assign({}, S.look, { bg: id }); api.push(); refreshSheet(); }, () => { if (api.relook) api.relook(); else refreshSheet(); }, { guest: api.guest && api.guest() }));   // relook: a host that draws its own sheet (Spotlight)
    box.appendChild(el("p", "lookh", "Effects"));   // falling shapes behind the lesson
    const fx = el("div", "lookfxs"); fx.setAttribute("role", "group"); fx.setAttribute("aria-label", "Board effect");
    const curFx = S.look.fx || "none";
    EFFECTS.forEach(([id, name]) => {
        const b = el("button", "lookfx" + (curFx === id ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", String(curFx === id));
        const pv = el("span", "lfx fx-" + id, id === "none" ? "" : effectSample(id)); pv.style.background = gradOf(S.look.theme); b.appendChild(pv); b.appendChild(el("span", "lnm", name));
        b.onclick = () => { S.look = Object.assign({}, S.look, { fx: id }); api.push(); refreshSheet(); }; fx.appendChild(b);
    });
    box.appendChild(fx);
    return box;
}
