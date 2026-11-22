/* ==========================================
   Calera Math — the board app.
   board.html runs it with mode "board" (the Promethean: controls hidden),
   remote.html with mode "remote" (the Chromebook: controls shown).
   Both read and write the same state document, so whatever one device
   changes, the other follows. Lesson content comes from data/weeks.js.
========================================== */
import { parseFigure, figureEl } from "./figures.js?v=1";
import { WEEKS as ALL_WEEKS, PERIODS as PACK_PERIODS } from "../data/weeks.js?v=61";
import { watchPrivateWeeks } from "./weeksLive.js?v=58";
// The public demo page passes its own sample week and periods (opts.weeks, opts.periods).
let WEEKS = ALL_WEEKS;
let store = null; // the signed-in Firestore store, or a this-device-only store for the sub page
import { trail } from "./signInTrail.js";
import { tickTools, defaultTools, mergeTools, TOOL_LIST, PANEL_LIST, LESSON_PANELS } from "./boardTools.js?v=60";
import { setFloatDefault, buildPanel, tickPanels, chip, ordered, panelOn, panelOff, panelToggle, SCENES, sceneActive, applyScene, openSheet, refreshSheet, sheetOpen, icon as pIcon, labelOf, defaultLook, cleanLook, applyLook, lookPicker, lookSeal, gradOf } from "./panels.js?v=11";
import { cleanStickers, renderStickers } from "./stickers.js?v=1";
import * as snd from "./sound.js?v=60";
import { createMathPad } from "./mathPad.js?v=2";
import { wbIcon } from "./wbIcons.js?v=1";
import { mountGames, syncGames, gameSig, drawStage as drawGame, drawPanel as drawGamePanel, tickGames, gameFlow, gameFlowLabel } from "./games.js?v=62";
import { mountLive, syncLive, liveSig, drawLiveStage, drawLivePanel, tickLive, liveReview, goReview, reviewBody, liveSound } from "./liveRoom.js?v=88";
import { mountNotes, syncNotes, drawNotesOverlay, drawNotesPanel, tickNotes } from "./liveNotes.js?v=11";
import { cleanPdf, pageUrl } from "./pdfNotes.js?v=1";
import { cleanBplan, cleanPlan, planTick, mountPlanFold } from "./bellPlan.js?v=6";
import { cleanChart, cleanPeriod, cleanView, seatCount, drawRoom } from "./seats.js?v=7";
import { DAILY as SL_DAILY, INDEX as SL_INDEX, MAX_DAILY as SL_MAX_DAILY, cleanDeck, cleanIndex, showList, revealSteps, indexHas, liveContext, lessonDate, textOf } from "./slides.js?v=1";
import { renderSlide, fitSlide, imageLoader, thumb } from "./slideView.js?v=1";

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

/* Text with stacked fractions: "{2/5}" -> 2 over 5, "{{1/2}/{1/4}}" nests. */
function rich(text) {
    const s = String(text == null ? "" : text); let i = 0;
    function parse(stop) {
        const frag = document.createDocumentFragment(); let buf = "";
        const flush = () => { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ""; } };
        while (i < s.length) {
            const ch = s[i];
            if (stop && stop.includes(ch)) break;
            if (ch === "[" && s[i + 1] === "[") { const f = parseFigure(s, i); if (f) { flush(); frag.appendChild(figureEl(f)); i = f.end; continue; } }   // a graph, table or mapping diagram (js/figures.js)
            if (ch === "{") {
                const save = i; i++;
                const num = parse("/}");
                if (s[i] === "/") {
                    i++; const den = parse("}");
                    if (s[i] === "}") {
                        i++; flush();
                        const f = el("span", "frac"), a = el("span"), b = el("span");
                        a.appendChild(num); b.appendChild(den); f.appendChild(a); f.appendChild(b); frag.appendChild(f);
                        continue;
                    }
                }
                i = save + 1; buf += "{"; continue;
            }
            buf += ch; i++;
        }
        flush(); return frag;
    }
    return parse("");
}
function richEl(tag, cls, text) { const e = el(tag, cls); e.appendChild(rich(text)); return e; }

const SCREENS = [["seats", "Seating Chart"], ["agenda", "Weekly Agenda"], ["today", "Today"], ["deck", "Slides"], ["bell", "Bellringer"], ["notes", "Guided Notes"], ["steps", "Show Steps"], ["speed", "Speed Dating"], ["fix", "Fix It"], ["game", "Review Game"], ["live", "Student Game"], ["timer", "Timer"], ["tools", "Tools"], ["blank", "Whiteboard"]];
const DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
// Each period and the class plan it follows.
let PERIODS = PACK_PERIODS;
const classOf = (period) => (PERIODS.find((p) => p[0] === period) || PERIODS[0])[1];
const ROUND = 240, GAP = 10, CHECK = 600;   // speed dating: 4:00 rounds, 10 s to rotate; 10:00 to go over the master problems
const PRESETS = [1, 2, 3, 5, 10, 15];
let skew = 0; // this device's clock vs the shared clock, in ms
const now = () => Date.now() + skew;
const blankTimer = () => ({ running: false, t0: 0, elapsed: 0 });

const localIso = () => { const d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
const isSchoolDay = () => { const n = new Date().getDay(); return n >= 1 && n <= 5; };
const realDay = () => (isSchoolDay() ? new Date().getDay() - 1 : 0);   // today's weekday, 0 = Monday
const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
let synced = false;   // false until the saved board state has arrived, so the wrong day is never drawn first
function defaultWeek() {
    const today = localIso();
    let pick = WEEKS[0];
    for (const w of WEEKS) if (!w.monday || w.monday <= today) pick = w;
    return pick.id;
}
const wd = new Date().getDay();
/* Canvas-first whiteboard: where the lesson card sits (fractions of the paper), its size, and the extra pages per board. */
function defaultWb() { return { card: { x: 0.06, y: 0.05, w: 1, hide: false }, pg: { k: "", n: 0 }, pages: {} }; }
function cleanWb(o) {
    const d = defaultWb(); if (!o || typeof o !== "object") return d; const c = o.card || {}, num = (v, a, b, def) => (typeof v === "number" && v >= a && v <= b ? v : def);
    d.card = { x: num(c.x, 0, 0.95, 0.06), y: num(c.y, 0, 0.95, 0.05), w: num(c.w, 0, 2, 1), hide: !!c.hide };
    if (o.pg && typeof o.pg.k === "string") d.pg = { k: o.pg.k.slice(0, 120), n: num(o.pg.n, 0, 11, 0) };
    if (o.pages && typeof o.pages === "object") Object.keys(o.pages).slice(-40).forEach((k) => { const n = Math.floor(+o.pages[k]); if (n > 1) d.pages[k.slice(0, 120)] = Math.min(12, n); });
    return d;
}
const S = { week: defaultWeek(), period: "1st", cls: "8th", day: (wd >= 1 && wd <= 5) ? wd - 1 : 0, screen: "today", prob: 0, show: false, note: 0, step: 0, slide: 0, sstep: 0,
    timers: { bell: blankTimer(), round: blankTimer(), check: blankTimer(), free: Object.assign(blankTimer(), { dur: 300 }) }, speedMode: "round", fix: null, tools: defaultTools(), wb: defaultWb(),
    sound: { fx: true, fxv: 0.7, music: false, mv: 0.35, style: "focus", at: "", game: true }, look: defaultLook(), stickers: [], seatHi: null, seatView: cleanView(null), bplan: cleanBplan(null), walk: { id: "", step: 0 } };

// This page's own mark on what it saves, so a change from another tab of the same browser can be shown
// before the server confirms it (those tabs share one offline copy, where it first arrives as "pending").
const PAGE = Math.random().toString(36).slice(2, 10);
let saveFailedAt = 0;
// Board and Remote open in the same browser hear each other's changes at once through this channel,
// without waiting for the server. Firestore still saves every change for reloads and other devices.
let wantWeek = "", lateWeek = "", autoWeekUntil = 0;   // a ?week= the Remote was opened with, or the saved board week, that has not loaded yet
let tabs = null, heard = { by: "", at: 0 };   // a failed save stays on screen a few seconds, even when the connection itself is fine
let mode = "remote", signedIn = false, sig = "", writeState = null;
/* The Board Builder (studio.html) runs the Remote with a builder rail: stickers can be moved there, panels snap to a
   grid while they are dragged, and the panel last touched is outlined. studio = its hooks (js/studio.js), or null. */
let studio = null, pickedPanel = "", stickerBusy = false;
let presence = null, shown = { by: "", at: 0 };   // Live status check-ins (js/presence.js): which screens are on, and which change each one shows

function writer(path) {
    let busy = false, next = null;
    const w = function (d) {
        d.by = PAGE; d.at = Date.now();
        if (path === "board/state") { seen(d); quickSave(d); }   // this tab shows its own change at once
        if (path === "board/state" && tabs) { try { tabs.postMessage(d); } catch (e) { /* the server copy still gets there */ } }
        next = d; if (busy) return; busy = true;
        (async function () {
            while (next) { const x = next; next = null; try { await store.save(path, x); } catch (e) { saveFailedAt = Date.now(); setStatus("Could not save (" + ((e && e.code) || "connection") + "). The board did not change."); } }
            busy = false;
        })();
    };
    w.busy = () => busy || !!next;
    return w;
}
function seen(d) { if (!d || !d.by || !d.at) return; shown = { by: d.by, at: +d.at || 0 }; if (presence) presence.saw(shown.by, shown.at); }
function setStatus(t) {
    const st = (t === "Live" || t === "This device only") ? "ok" : (t.startsWith("Connecting") || t.startsWith("Syncing") || t.startsWith("Still") ? "wait" : "bad");
    // data-long: a message to read (not just "Live" or the first "Connecting…"); a phone gives it its own row
    const s = $("status"); if (s) { s.textContent = t; s.dataset.state = st; s.dataset.long = st === "ok" || t.startsWith("Connecting") || t.startsWith("Syncing") ? "" : "1"; }
    // The board view hides the header, so a lost connection shows as a small pill in the corner instead.
    const pill = $("connPill"); if (pill) { pill.hidden = st === "ok" || !synced; pill.textContent = st === "bad" ? "Offline \u00b7 showing the saved lesson \u00b7 reconnecting\u2026" : "Connecting\u2026"; }
}
function push() {
    S.stamp = localIso(); dayBoard(); render();
    // Until the saved state has arrived, only the teacher's own taps are saved: a timer or the bell timeline acting on this
    // device's older copy must not overwrite a newer board.
    if (!stateIn) { if (Date.now() - lastInput < 2000) earlyTap = true; else return; }
    if (writeState) writeState(JSON.parse(JSON.stringify(S)));
}
/* Instant start (2026-11-21): the last board state this device saw is kept in localStorage, so the Remote and the board draw
   the lesson the moment the code has loaded, before sign-in and Firestore have opened (those took 1-3 s on a phone).
   It notes whose it is; the "school-live:" prefix is cleared on sign-out and account switches (js/auth.js). */
let earlyTap = false, quickUid = "", stateIn = false, lastInput = 0;
["pointerdown", "keydown", "change"].forEach((ev) => document.addEventListener(ev, () => { lastInput = Date.now(); }, true));
const QUICK_KEY = "school-live:board";
function quickLoad() {
    try { const q = JSON.parse(localStorage.getItem(QUICK_KEY) || "null"); return q && q.uid && q.d && typeof q.d === "object" ? q : null; } catch (e) { return null; }
}
let quickT = 0, quickNext = null;
function quickSave(d) {   // at most every 400 ms; a big board state is still small next to localStorage's room
    if (!quickUid || !d) return; quickNext = d; if (quickT) return;
    quickT = setTimeout(() => { quickT = 0; try { localStorage.setItem(QUICK_KEY, JSON.stringify({ uid: quickUid, d: quickNext })); } catch (e) { /* storage full or off: the next load waits for Firestore */ } }, 400);
}
/* Day boards (Board Builder): a saved board can belong to one lesson (week, class, day). When this device moves to that
   lesson (a day or period tap, the morning's fresh start, the bell timeline's next period), the board opens with it.
   Only the device that made the move applies it; the others get the result in the shared state. */
let lessonKey = "";
const lessonKeyNow = () => S.week + "|" + S.cls + "|" + S.day;
function dayBoard() {
    const k = lessonKeyNow(); if (k === lessonKey) return; lessonKey = k;
    const id = S.tools.dayb && S.tools.dayb[k], sc = id && S.tools.scenes.find((x) => x.id === id);
    if (sc) { if (!sceneActive(S, sc)) applyScene(S, sc, Object.assign({}, toolApi, { push: () => {} })); return; }   // the caller saves it
    // A lesson with its own slides (or every-day slides) opens on them, unless a game or the seating chart is up.
    if (slHas(k) && screenOk("deck") && !["live", "game", "seats"].includes(S.screen)) { S.screen = "deck"; S.slide = 0; S.sstep = 0; S.show = false; }
}
let quietTimer = 0;
function quiet() { clearTimeout(quietTimer); quietTimer = setTimeout(() => { if (writeState) writeState(JSON.parse(JSON.stringify(S))); }, 500); } // save typing without redrawing
let ROSTERS = {};
let SEATS = cleanChart(null), seatsIn = false, seatLast = "";   // seating charts (seats.html), whether they have arrived, and the period last drawn
let BELLS = null;   // today's bell times from Home (settings/bells), for the Period clock panel
let BELL_DOC = null, BELL_ID = "regular";   // the whole bell-times doc, and which schedule today runs on
let PLAN = null, planFold = null;   // the bell timeline (settings/timeline, js/bellPlan.js) and its fold on the rail
const schedName = (id) => (id === "regular" ? "Regular" : (BELL_DOC && BELL_DOC.schedules && BELL_DOC.schedules[id] && BELL_DOC.schedules[id].name) || "Schedule");
function bellsOf(id) {
    if (!BELL_DOC) return null;
    const per = id === "regular" ? (BELL_DOC.periods || {}) : ((BELL_DOC.schedules && BELL_DOC.schedules[id] && BELL_DOC.schedules[id].periods) || {});
    return Object.keys(per).length ? per : null;
}
/** Which schedule a date runs on: today's pick on Home or the Remote, else a day planned ahead, else Regular. */
function schedFor(d, date) {
    const ok = (id) => id && (id === "regular" || (d.schedules && d.schedules[id]));
    if (d.today && d.today.date === date && ok(d.today.id)) return d.today.id;
    if (d.days && ok(d.days[date])) return d.days[date];
    return "regular";
}
const planApi = { S, el, now, push: () => push(), mode: () => mode, today: () => localIso(), schoolDay: () => isSchoolDay(),
    plan: () => PLAN, bells: () => BELLS, bellId: () => BELL_ID, bellName: () => schedName(BELL_ID), bellsFor: (id) => bellsOf(id),
    schedules: () => [["regular", "Regular"]].concat(Object.keys((BELL_DOC && BELL_DOC.schedules) || {}).filter((id) => id !== "regular").map((id) => [id, schedName(id)])),
    periods: () => PERIODS, screens: () => SCREENS.filter((x) => screenOrder().includes(x[0])),
    panels: () => PANEL_LIST.filter(([k]) => panelOk(k)),
    layouts: () => SCENES.filter((sc) => !(mode === "sub" && sc.guestless)).concat(S.tools.scenes || []),
    screenOk: (id) => screenOk(id), applyScene: (sc) => applyScene(S, sc, toolApi),
    goPeriod: (p) => {   // the bell for another period: its class, today's lesson, from the top
        if (!W().classes[classOf(p)]) return; S.period = p; S.cls = classOf(p);
        if (isSchoolDay() && (S.week !== defaultWeek() || S.day !== realDay())) { const dw = defaultWeek(); if (WEEKS.find((w) => w.id === dw).classes[S.cls]) { S.week = dw; S.day = realDay(); } }
        resetPos();
        dayBoard();   // the new class's lesson board first, so the timeline step that called this still sets the screen and panels
    },
    savePlan: async (p) => { PLAN = cleanPlan(p); try { await store.save("settings/timeline", PLAN); return true; } catch (e) { return false; } },
    setToday: async (id) => {   // pick today's schedule from the Remote (the same field Home's "Today's schedule" sets)
        if (!BELL_DOC) return false; const d = JSON.parse(JSON.stringify(BELL_DOC)), date = localIso();
        d.today = id === "regular" ? null : { date, id }; if (d.days) delete d.days[date];
        try { await store.save("settings/bells", d); return true; } catch (e) { return false; }
    } };
const toolApi = { S, el, push, quiet, now, card, rosters: () => ROSTERS, cue: (n) => snd.cue(n), redraw: () => { layerSig = ""; renderLayer(); },
    // panels (js/panels.js)
    day: () => D(), lesson: () => L(), rich, bells: () => BELLS, guest: () => mode === "sub", panelOk: (k) => panelOk(k), screenOk: (id) => screenOk(id),
    defaultPos: (k) => { const d = DEFAULT_POS[k] || [10, 30]; return { x: d[0], y: d[1], s: 1 }; }, bellSeconds: () => { const l = L(); return (l && l.bellSeconds) || 300; },
    agendaKey: () => [S.week, S.period, S.day].join("|"), noteKind: () => { if (S.screen !== "notes") return ""; const fr = notesFrames(D()); const f = fr[Math.min(S.note, fr.length - 1)]; return (f && f.kind) || ""; }, freeView, timerGo: () => timerGo("free"), timerReset: () => { S.timers.free = Object.assign(blankTimer(), { dur: S.timers.free.dur || 300 }); push(); },
    timerSet: (sec) => { S.timers.free = Object.assign(blankTimer(), { dur: sec }); } };
function toolSig() { const t = Object.assign({}, S.tools); delete t.text; t.goal = Object.assign({}, t.goal); delete t.goal.text; const f = S.timers.free; return JSON.stringify([t, S.period, Object.keys(ROSTERS).map((k) => k + ROSTERS[k].length), f.running, f.dur, f.t0, f.elapsed, S.week, S.cls, S.day, !!BELLS, S.tools.on.agenda ? [S.screen, S.screen === "notes" ? S.note : 0] : 0]); }
const panelOk = (k) => !(mode === "sub" && (k === "pick" || k === "groups"));
function screenOk(id) { if (!screenOrder().includes(id)) return false; if (id === "notes") return notesFrames(D()).length > 0; if (id === "speed") return isSpeedDay(); return true; }
/* The free Timer, shared by the Timer screen and the Timer panel. */
function freeView() {
    const t = S.timers.free, T = t.dur || 300, ms = t.running ? now() - t.t0 : t.elapsed, e = Math.max(0, Math.floor(ms / 1000)), r = Math.max(0, T - e);
    return { txt: fmt(r), frac: r / T, hot: r > 0 && r <= Math.min(60, T / 4), done: r === 0 && e > 0, running: t.running, elapsed: t.elapsed, dur: T };
}
function timerGo(kind) {
    const t = S.timers[kind];
    if (t.running) { t.elapsed = now() - t.t0; t.running = false; }
    else { if (kind !== "round" && t.elapsed >= secsFor(kind) * 1000) t.elapsed = 0; t.t0 = now() - t.elapsed; t.running = true; unlockSound(); }
    push();
}
function resetPos() { S.prob = 0; S.show = false; S.note = 0; S.step = 0; S.slide = 0; S.sstep = 0; }
const W = () => WEEKS.find((w) => w.id === S.week) || WEEKS[WEEKS.length - 1];
const L = () => { const w = W(); return (w && w.classes[S.cls]) || null; };
const D = () => { const l = L(); return (l && l.days && l.days[S.day]) || null; };

/* ---------- Slides: the teacher's own slides (Board Builder > Slides, js/slideEditor.js) ----------
   slides/<week>|<class>|<day> holds one lesson's slides, slides/daily the every-day slides that open every lesson,
   slides/index which lessons have any. The Slides screen shows them one at a time: Next shows the next piece set to
   appear on Next, then the next slide. S.slide and S.sstep are where the board is. */
const SL = { idx: cleanIndex(null), daily: null, lesson: null, key: "", ver: 0 };
let slUnsub = null, slOn = false, slPen = false, slLast = "", slImages = null;
function slStart() {   // after sign-in
    if (slOn) return; slOn = true;
    store.watch("slides/" + SL_INDEX, (snap) => { if (snap.pending) return; SL.idx = cleanIndex(snap.exists ? snap.data : null); SL.ver++; slChanged(); }, () => {});
    store.watch("slides/" + SL_DAILY, (snap) => { if (snap.pending) return; SL.daily = cleanDeck(snap.exists ? snap.data : null, SL_MAX_DAILY); SL.ver++; slChanged(); }, () => { SL.daily = cleanDeck(null); });
    slWatch();
}
/** Follow the slides of the lesson on the board now (called on every draw; only a new lesson starts a new watch). */
function slWatch() {
    if (!slOn) return;
    const k = lessonKeyNow(); if (k === SL.key) return;
    SL.key = k; SL.lesson = null; SL.ver++; if (slUnsub) { slUnsub(); slUnsub = null; }
    slUnsub = store.watch("slides/" + k, (snap) => { if (snap.pending || SL.key !== k) return; SL.lesson = cleanDeck(snap.exists ? snap.data : null); SL.ver++; slChanged(); }, () => { if (SL.key === k) { SL.lesson = cleanDeck(null); SL.ver++; slChanged(); } });
}
function slChanged() { if (!synced) return; if (S.screen === "deck") sig = ""; render(); }
const slLoaded = () => slOn && SL.key === lessonKeyNow() && !!SL.lesson && !!SL.daily;
const slList = () => (slLoaded() ? showList(SL.daily, SL.lesson) : []);
/** Whether a lesson has slides to show: its own list once loaded, else the index. */
function slHas(k) {
    if (!slOn) return false;
    if ((k || lessonKeyNow()) === lessonKeyNow() && slLoaded()) return slList().length > 0;
    return indexHas(SL.idx, k || lessonKeyNow(), SL.daily);
}
/** The slide on the board now: { list, i, s }, or null when this lesson has none (or they have not loaded). */
function deckNow() { const list = slList(); if (!list.length) return null; const i = Math.max(0, Math.min(S.slide, list.length - 1)); return { list, i, s: list[i] }; }
function slImg() { if (!slImages) slImages = imageLoader(() => store, () => { slImgVer++; if (S.screen === "deck") { sig = ""; render(); } else if (slDropOpen && synced) screensUi(); }); return slImages; }
const slLive = () => { const w = W(), d = D(); return liveContext(w, L(), d, S.day, lessonDate(w, S.day, d)); };
/** Into the Slides screen from the screen before it (n = 1: the first slide) or after it (n = -1: the last slide, all shown). */
function slEnter(n) { const list = slList(); S.screen = "deck"; S.show = false; if (n > 0 || !list.length) { S.slide = 0; S.sstep = 0; } else { S.slide = list.length - 1; S.sstep = revealSteps(list[S.slide]); } }
/** Back from the lesson's first screens: to the end of the slides when the lesson has them, else Today. */
function backToToday() { if (slHas()) slEnter(-1); else S.screen = "today"; }
function drawDeck(st) {
    const box = el("div", "deckx"), host = el("div", "deckhost"); box.appendChild(host); st.appendChild(box);
    const dn = deckNow();
    if (!dn) {
        if (slOn && !slLoaded()) { slLast = ""; return; }   // still arriving: the board's own look, never a flash of "no slides"
        const e = el("div", "deckempty");
        e.appendChild(el("h2", null, "No slides for " + (FULL[S.day] || "this day") + " yet"));
        e.appendChild(el("p", null, mode === "board" ? "Build them on the Remote: Board Builder, then Slides." : "Make your own slides for this lesson: from your plan, a layout or a blank slide."));
        if (mode !== "board") { const a = el("a", null, "Build slides"); a.href = "studio.html#slides/" + encodeURIComponent(S.week) + "/" + encodeURIComponent(S.cls) + "/" + S.day; e.appendChild(a); }
        box.appendChild(e); slLast = ""; return;
    }
    const steps = revealSteps(dn.s), at = Math.min(S.sstep, steps), k2 = dn.s.id + ":" + at, was = slLast.split(":");
    const fresh = at && was[0] === dn.s.id && +was[1] === at - 1 ? at : 0; slLast = k2;
    const r = renderSlide(dn.s, { step: at, fresh, live: slLive(), img: slImg().src, logo: lookSeal(), scale: (st.clientWidth || 1280) / 1600 });
    r.setAttribute("role", "img"); r.setAttribute("aria-label", "Slide " + (dn.i + 1) + " of " + dn.list.length);
    host.appendChild(r); fitSlide(host, r);
    const cv = makeCv(); cv.classList.add("deckink"); cv.classList.toggle("drawoff", !slPen); box.appendChild(cv);
    const pen = el("button", "deckpen"); pen.type = "button"; pen.setAttribute("aria-pressed", String(slPen)); pen.title = slPen ? "Stop drawing" : "Draw on this slide"; pen.setAttribute("aria-label", pen.title); pen.innerHTML = wbIcon("pen");
    pen.onclick = () => { slPen = !slPen; sig = ""; render(); }; box.appendChild(pen);
    box.appendChild(el("span", "deckcount", (dn.i + 1) + " / " + dn.list.length + (steps ? " \u00b7 " + (at < steps ? "more on Next" : "all shown") : "")));
    bindCanvas(); sizeCanvas();
}
/** The Remote: the open slide's notes for the teacher, under Next and Back (never on the board). */
function deckNotes() {
    if (mode !== "remote" && !studio) return;
    const fb = document.querySelector(".flowbar"); if (!fb) return;
    let n = $("slNotesOut"); if (!n) { n = el("div", "slnotes"); n.id = "slNotesOut"; n.setAttribute("aria-live", "polite"); fb.after(n); }
    const dn = S.screen === "deck" ? deckNow() : null, t = dn && dn.s.nt ? dn.s.nt : "";
    if (n.dataset.t === t) return; n.dataset.t = t; n.hidden = !t; n.textContent = "";
    if (t) { n.appendChild(el("b", null, "Your notes")); n.appendChild(document.createTextNode(t)); }
}

/* What the Board Builder (js/studio.js) works with: the same state, the same push, the same panels and timeline. */
function studioApi() {
    return { S, el, push, toolApi, planApi, rich, screens: () => SCREENS.filter((x) => screenOrder().includes(x[0])), screenOk, panelOk,
        day: () => D(), lesson: () => L(), week: () => W(), classLabel: () => { const l = L(); return (l && l.label) || S.cls; }, dayName: () => FULL[S.day] || "",
        synced: () => synced, guest: () => mode === "sub", rosters: () => ROSTERS, bells: () => BELLS,
        lessonKey: () => lessonKeyNow(), dayNames: () => FULL.slice(), goDay: (i) => { S.day = i; resetPos(); push(); },
        // Slides (js/slideEditor.js): the store, every week (published and private), a day's notes frames, and "Show on board"
        store: () => store, allWeeks: () => WEEKS, framesFor: (w, c, i) => { const wk = WEEKS.find((x) => x.id === w), l = wk && wk.classes[c], d = l && l.days && l.days[i]; return d ? notesFrames(d) : []; },
        showSlide: (w, c, i, n) => {
            if (!WEEKS.some((x) => x.id === w)) return false;
            const wk = WEEKS.find((x) => x.id === w); if (!wk.classes[c]) return false;
            S.week = w; if (S.cls !== c) { S.cls = c; const p = PERIODS.find((x) => x[1] === c); if (p) S.period = p[0]; }
            if (S.day !== i) S.day = i;
            dayBoard();   // that lesson's own board first, so its panels and look come along; the slide still wins the screen
            S.screen = "deck"; S.slide = Math.max(0, n || 0); S.sstep = 0; S.show = false; slWatch(); push(); return true;
        },
        weeks: () => WEEKS.map((w) => [w.id, w.monday || ""]),
        editHref: () => { const w = W(), q = new URLSearchParams({ day: (DK[S.day] || "Mon").toLowerCase() }); if (w.monday) q.set("monday", w.monday); if (S.cls) q.set("class", S.cls); return "lesson.html?" + q; },
        // Outline the panel in place: never rebuild the layer here, since this runs on the pointerdown that may start a drag.
        pickPanel: (k) => { pickedPanel = k || ""; document.querySelectorAll("#toolLayer .float").forEach((w) => w.classList.toggle("picked", w.dataset.panel === pickedPanel)); },
        redraw: () => { sig = ""; layerSig = ""; render(); }, fit: () => fit(), defaultPos: (k) => toolApi.defaultPos(k), step: (n) => step(n) };
}
/* ---------- controls ---------- */
function seg(host, items, current, onPick, icon) {
    // Same buttons as last time: update them in place. Rebuilding them on every redraw broke taps, because
    // the first touch of any tap wakes the sound (a redraw) and the button under the finger was replaced
    // before the tap finished, so the tap never landed (the music style buttons, Nov 19).
    // icon(id): an icon before each label (shown on a phone).
    const key = items.map((x) => x[0] + "\u0001" + x[1]).join("\u0002") + (icon ? "\u0003" : "");
    if (host.dataset.seg === key && host.children.length === items.length) {
        items.forEach(([id], i) => { const b = host.children[i]; b.setAttribute("aria-pressed", String(id === current)); b.onclick = () => onPick(id); });
        return;
    }
    host.dataset.seg = key; host.textContent = "";
    items.forEach(([id, label]) => {
        const b = el("button", null, icon ? null : label); b.type = "button";
        if (icon) { const i = el("span", "sci"); i.innerHTML = icon(id); b.append(i, el("span", "scl", label)); }
        b.setAttribute("aria-pressed", String(id === current));
        b.onclick = () => onPick(id); host.appendChild(b);
    });
}
/* ---------- Screens: the day's slides first, then the screens used every day, then More screens ----------
   Eddie, Nov 21: fewer tabs, Slides as the main screen, and a drop-down of the slides that are really there for
   that day. Tapping Slides puts them on the board and opens that list; tapping a slide in it shows that slide.
   On a day with slides, the plan's own screens (Today, Bellringer, Guided Notes, Agenda) move into More screens,
   since the slides hold them; on a day without, they stay out front. Guided Notes and Speed Dating show only on
   days that have them. Next and Back still walk every screen in order, as before. */
const SCR_MAIN = ["seats", "blank", "timer", "live"], SCR_LESSON = ["today", "bell", "notes", "speed"];
const SCR_IC = {
    deck: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
    seats: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    blank: '<path d="M4 20h4L19.2 8.8a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2.5h6"/>',
    live: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11" r="1"/><circle cx="17.5" cy="14" r="1"/>',
    today: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15.5" r="1.8"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    notes: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
    speed: '<path d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5"/>',
    agenda: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.3 1.3L7.5 4.6M3.5 12l1.3 1.3 2.7-2.7"/><circle cx="5.5" cy="18" r="1.2"/>',
    steps: '<path d="M4 20h4.5v-4.5H13V11h4.5V6.5H20"/>',
    fix: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20M8 10.5l2 2 3.5-4"/>',
    game: '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 14v3M8 20h8"/>',
    tools: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
};
const svgIcon = (paths, wd) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (wd || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
const scrIcon = (id) => svgIcon(SCR_IC[id] || SCR_IC.deck);
let scrMoreOpen = false, slDropOpen = false, slDropSig = "", slImgVer = 0;
function pickScreen(id) { if (id === "deck" && S.screen !== "deck") S.sstep = 0; S.screen = id; S.show = false; push(); }
function screensUi() {
    const host = $("screens"); if (!host) return;
    const order = screenOrder(), withDeck = order.includes("deck"), d = D();
    const off = { notes: !notesFrames(d).length, speed: !isSpeedDay() };   // nothing for them today
    const main = (withDeck && slHas() ? [] : SCR_LESSON.filter((id) => order.includes(id) && !off[id])).concat(SCR_MAIN.filter((id) => order.includes(id)));
    const more = order.filter((id) => id !== "deck" && !main.includes(id) && !off[id]);
    const named = (ids) => ids.map((id) => [id, screenName(id)]);
    seg(host, named(main), S.screen, pickScreen, scrIcon);
    let mf = $("scrMore");
    if (!mf) {
        mf = el("details", "menu fold smore"); mf.id = "scrMore"; mf.open = scrMoreOpen;
        const sm = el("summary"); sm.id = "scrMoreSum"; mf.appendChild(sm);
        const g = el("div", host.className); g.id = "screensMore"; g.setAttribute("role", "group"); g.setAttribute("aria-label", "More screens"); mf.appendChild(g);
        mf.addEventListener("toggle", () => { scrMoreOpen = mf.open; });
        host.after(mf);
    }
    mf.hidden = !more.length;
    seg($("screensMore"), named(more), S.screen, pickScreen, scrIcon);
    // The board on one of these: say so on the closed fold, so the screen up is never hidden
    const on = more.includes(S.screen) ? screenName(S.screen) : "", sm = $("scrMoreSum");
    if (sm.dataset.on !== on || !sm.firstChild) { sm.dataset.on = on; sm.textContent = "More screens"; if (on) sm.appendChild(el("span", "smon", on + " is on")); }
    mf.classList.toggle("on", !!on);
    if (withDeck) slidesPick(host); else if ($("slPick")) $("slPick").remove();
}
const slEditHref = () => "studio.html#slides/" + encodeURIComponent(S.week) + "/" + encodeURIComponent(S.cls) + "/" + S.day;
/** A slide's name in the list: its biggest words, with the live fields filled in for this lesson. */
function slideTitle(s, live) {
    const t = (s.els || []).filter((e) => e.k === "bx" && e.html).sort((a, b) => b.fs - a.fs || a.y - b.y)[0];
    const fill = (m, k) => { const v = live ? live[k] : ""; return Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v); };
    const words = t ? textOf(t.html).replace(/\{\{\s*(\w+)\s*\}\}/g, fill).split("\n").map((x) => x.trim()).filter(Boolean)[0] || "" : "";
    return words.slice(0, 80) || (s.els && s.els.some((e) => e.k === "pc") ? "Picture" : "Slide");
}
/** Slides: the card (what is on the board) and, when open, the day's slides as pictures to tap. */
function slidesPick(host) {
    let box = $("slPick");
    if (!box) {
        box = el("div", "slpick"); box.id = "slPick";
        const b = el("button", "slcard"); b.id = "slCard"; b.type = "button"; b.setAttribute("aria-controls", "slDrop");
        b.innerHTML = '<span class="slico">' + scrIcon("deck") + '</span><span class="slctx"><b>Slides</b><small id="slSub"></small></span><span class="slchev">' + svgIcon('<path d="M6 9l6 6 6-6"/>', 2.2) + "</span>";
        b.onclick = () => {
            if (slList().length && S.screen !== "deck") { slDropOpen = true; pickScreen("deck"); return; }   // on the board, list open
            slDropOpen = !slDropOpen; slidesPick($("screens"));
        };
        const dr = el("div", "sldrop"); dr.id = "slDrop"; dr.hidden = true; dr.setAttribute("role", "group"); dr.setAttribute("aria-label", "This day's slides");
        box.append(b, dr); host.before(box);
    }
    const loaded = !slOn || slLoaded(), list = slList(), n = list.length, on = S.screen === "deck", day = FULL[S.day] || "this day";
    const dn = on && n ? deckNow() : null;
    const words = !loaded ? "Loading\u2026" : !n ? "None for " + day + " yet" : dn ? "Slide " + (dn.i + 1) + " of " + n + " on the board" : n + (n === 1 ? " slide" : " slides") + " for " + day;
    const sub = $("slSub"); if (sub.textContent !== words) sub.textContent = words;
    const card = $("slCard"); card.classList.toggle("on", on); card.setAttribute("aria-expanded", String(slDropOpen));
    const dr = $("slDrop"); dr.hidden = !slDropOpen;
    if (!slDropOpen) return;
    // two across (three on a phone for a long lesson, so 30 slides stay a short scroll), more on a wide rail
    const w = box.clientWidth || 300, cols = Math.max(isPhone() && n > 12 ? 3 : 2, Math.min(4, Math.floor(w / 170))), tw = Math.floor((w - 8 * (cols - 1)) / cols);
    const live = slLive(), look = S.look || {};
    const k = JSON.stringify([loaded, lessonKeyNow(), SL.ver, slImgVer, list.map((s) => s.id), tw, cols, live, look.theme, look.bg, look.mark]);
    if (k !== slDropSig) {
        slDropSig = k; dr.textContent = "";
        if (!loaded) dr.appendChild(el("p", "sdnote", "Loading the slides\u2026"));
        else if (!n) dr.appendChild(el("p", "sdnote", "No slides for " + day + " yet. Make them in the Board Builder: from your plan, a layout or a blank slide."));
        else {
            const g = el("div", "sdgrid"); g.style.gridTemplateColumns = "repeat(" + cols + ",minmax(0,1fr))";
            const opt = { live, img: slImg().src, logo: lookSeal(), board: { grad: gradOf(look.theme || "navy"), cls: "stagebg pv-" + (look.bg || "anchor") } };
            list.forEach((s, i) => {
                const b = el("button", "sdi"), t = slideTitle(s, live), th = thumb(s, opt, tw); b.type = "button"; b.dataset.i = i;
                th.appendChild(el("span", "sdn", String(i + 1)));
                if (s.daily) th.appendChild(el("span", "sdd", "Every day"));
                b.append(th, el("span", "sdt", t));
                b.setAttribute("aria-label", "Slide " + (i + 1) + ": " + t + (s.daily ? ", every day" : ""));
                b.onclick = () => { S.screen = "deck"; S.slide = i; S.sstep = 0; S.show = false; push(); };
                g.appendChild(b);
            });
            dr.appendChild(g);
        }
        if (mode === "remote" && !studio && loaded) { const a = el("a", "sdedit", n ? "Edit these slides" : "Make slides for " + day); a.href = slEditHref(); dr.appendChild(a); }
    }
    const cur = dn ? dn.i : -1;   // the slide on the board, marked in place (no rebuild while a finger is down)
    dr.querySelectorAll(".sdi").forEach((b) => { const me = +b.dataset.i === cur; b.classList.toggle("on", me); if (me) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
}
let notTodayShut = (() => { try { return sessionStorage.getItem("anchorboard-nottoday") || ""; } catch (e) { return ""; } })();
/* Phone: one-tap setups (layouts) and the panels used most, at the top of the controls.
   Built once and updated in place (a control rebuilt during a tap never gets the tap). */
const QUICK = ["ptimer", "pick", "traffic", "work", "clock", "target"];
let quickSig = "";
function quickBar() {
    if (!isPhone() || mode === "sub") return;
    const rail = document.querySelector(".rail"); if (!rail) return;
    let q = $("quickBar");
    const scenes = SCENES.filter((x) => !x.guestless || mode !== "sub").concat(S.tools.scenes || []), sg = scenes.map((x) => x.id + x.n).join("|");
    if (!q || sg !== quickSig) {
        quickSig = sg; if (q) q.remove();
        q = el("div", "quickbar"); q.id = "quickBar";
        q.appendChild(el("p", "railh", "Setups"));
        const row = el("div", "qscenes"); row.setAttribute("role", "group"); row.setAttribute("aria-label", "One-tap setups");
        scenes.forEach((raw) => { const b = el("button", "qscene"); b.type = "button"; b.dataset.id = raw.id; b.appendChild(el("b", null, raw.n)); if (raw.d) b.appendChild(el("span", null, raw.d)); b.onclick = () => { applyScene(S, raw, toolApi); }; b._raw = raw; row.appendChild(b); });
        q.appendChild(row);
        q.appendChild(el("p", "railh", "Quick panels"));
        const tg = el("div", "qtools"); tg.setAttribute("role", "group"); tg.setAttribute("aria-label", "Panels on the board");
        QUICK.forEach((k) => { const b = el("button", "qtool"); b.type = "button"; b.dataset.k = k; const ic = el("span", "qti"); ic.innerHTML = pIcon(k); b.appendChild(ic); b.appendChild(el("span", "qtl", labelOf(k))); b.onclick = () => { panelToggle(S.tools, k); push(); }; tg.appendChild(b); });
        q.appendChild(tg);
        q.appendChild(liveControls());
        ($("editDay") || $("scrMore") || $("screens") || rail.firstChild).after(q);   // under Screens: the day's slides come first
    }
    q.querySelectorAll(".qscene").forEach((b) => { const on = sceneActive(S, b._raw); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    q.querySelectorAll(".qtool").forEach((b) => { const k = b.dataset.k, ok = panelOk(k), on = !!S.tools.on[k]; b.hidden = !ok; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    liveSync();
}
/* Big phone controls for the panels that are on the board: timer, traffic light, voice level, name picker,
   and a message box. The small board copy is too small to tap these. Each card shows only while its panel is on
   (the message box always shows: typing puts the Message panel on the board). */
const pressed = (b, on) => { b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); };
function liveControls() {
    const box = el("div", "qlive"); box.id = "qLive";
    const card = (k, title) => { const c = el("section", "qcard"); c.dataset.k = k; const h = el("div", "qch"); const ic = el("span", "qti"); ic.innerHTML = pIcon(k); h.append(ic, el("b", null, title)); if (k !== "text") { const off = el("button", "qoff", "Take off board"); off.type = "button"; off.onclick = () => { panelToggle(S.tools, k); push(); }; h.appendChild(off); } c.appendChild(h); box.appendChild(c); return c; };
    {   // timer
        const c = card("ptimer", "Timer"), big = el("p", "qtime"); big.id = "qTime"; c.appendChild(big);
        const row = el("div", "qrow"), go = el("button", "qgo"), rs = el("button", null, "Reset"); go.id = "qTimerGo"; go.type = rs.type = "button";
        go.onclick = () => timerGo("free"); rs.onclick = () => toolApi.timerReset(); row.append(go, rs); c.appendChild(row);
        const pr = el("div", "qrow qmins"); [1, 2, 3, 5, 10, 15].forEach((m) => { const b = el("button", null, m + " min"); b.type = "button"; b.dataset.sec = m * 60; b.onclick = () => { toolApi.timerSet(m * 60); push(); }; pr.appendChild(b); }); c.appendChild(pr);
    }
    {   // traffic light
        const c = card("traffic", "Traffic light"), row = el("div", "qrow qlights");
        [["red", "Stop"], ["yellow", "Slow down"], ["green", "Go"]].forEach(([col, n]) => { const b = el("button", "ql " + col, n); b.type = "button"; b.dataset.v = col; b.onclick = () => { S.tools.traffic = col; push(); }; row.appendChild(b); });
        c.appendChild(row);
    }
    {   // voice level
        const c = card("work", "Voice level"), row = el("div", "qrow qwork");
        [["silent", "Silent"], ["whisper", "Whisper"], ["partner", "Partner talk"], ["group", "Group work"]].forEach(([v, n]) => { const b = el("button", null, n); b.type = "button"; b.dataset.v = v; b.onclick = () => { S.tools.work = v; push(); }; row.appendChild(b); });
        c.appendChild(row);
    }
    {   // name picker (names show here on the Remote, as on the board's own panel)
        const c = card("pick", "Name picker"), who = el("p", "qwho"); who.id = "qWho"; c.appendChild(who);
        const row = el("div", "qrow"), go = el("button", "qgo", "Pick a name"), rs = el("button", null, "Start over"); go.type = rs.type = "button";
        go.onclick = () => {
            const T = S.tools, st = T.pick, period = st.period || S.period, names = ROSTERS[period] || [];
            const today = localIso(), out = T.absent && T.absent.day === today ? (T.absent.periods[period] || []) : [];
            const here = names.map((_, i) => i).filter((i) => !out.includes(i)); if (!here.length) return;
            let pool = here.filter((i) => !st.used.includes(i)); if (!pool.length) { st.used = []; pool = here.slice(); }
            st.cur = pool[Math.floor(Math.random() * pool.length)]; st.used.push(st.cur); st.period = period; push();
        };
        rs.onclick = () => { S.tools.pick.cur = -1; S.tools.pick.used = []; push(); };
        row.append(go, rs); c.appendChild(row);
    }
    {   // message
        const c = card("text", "Message to the room"), ta = el("textarea", "qmsg"); ta.id = "qMsg"; ta.maxLength = 600; ta.rows = 2; ta.placeholder = "Type here. It shows on the board."; ta.setAttribute("aria-label", "Message for the board");
        ta.oninput = () => { S.tools.text = ta.value; if (ta.value.trim() && !S.tools.on.text) { panelOn(S.tools, "text"); push(); } else quiet(); };
        const row = el("div", "qrow"), sh = el("button", null), cl = el("button", null, "Clear"); sh.id = "qMsgShow"; sh.type = cl.type = "button";
        sh.onclick = () => { panelToggle(S.tools, "text"); push(); };
        cl.onclick = () => { S.tools.text = ""; ta.value = ""; push(); };
        row.append(sh, cl); c.append(ta, row);
    }
    return box;
}
function liveSync() {
    const box = $("qLive"); if (!box) return; const T = S.tools;
    box.querySelectorAll(".qcard").forEach((c) => { const k = c.dataset.k; c.hidden = k === "text" ? !panelOk("text") : !(T.on[k] && panelOk(k)); });
    box.querySelectorAll(".qlights button").forEach((b) => pressed(b, T.traffic === b.dataset.v));
    box.querySelectorAll(".qwork button").forEach((b) => pressed(b, T.work === b.dataset.v));
    box.querySelectorAll(".qmins button").forEach((b) => pressed(b, (S.timers.free.dur || 300) === +b.dataset.sec));
    const st = T.pick, names = ROSTERS[st.period || S.period] || [], w = $("qWho");
    if (w) w.textContent = !names.length ? "No names saved for this period yet." : st.cur >= 0 && names[st.cur] ? names[st.cur] : "Ready";
    const ta = $("qMsg"); if (ta && document.activeElement !== ta && ta.value !== (T.text || "")) ta.value = T.text || "";
    const sh = $("qMsgShow"); if (sh) { sh.textContent = T.on.text ? "Take off board" : "Show on board"; pressed(sh, !!T.on.text); }
    quickTick();
}
function quickTick() {
    const t = $("qTime"); if (!t || t.closest("[hidden]")) return;
    const v = freeView(); t.textContent = v.txt; t.classList.toggle("hot", v.hot); t.classList.toggle("done", v.done);
    const g = $("qTimerGo"); if (g) { const l = v.running ? "Pause" : (v.elapsed && !v.done ? "Resume" : "Start"); if (g.textContent !== l) g.textContent = l; }
}
function buildControls() {
    const w = W();
    const ps = $("periodSel"); ps.textContent = "";
    PERIODS.filter((p) => w.classes[p[1]]).forEach((p) => { const o = el("option", null, p[0] + (isPhone() ? " \u00b7 " : " period, ") + w.classes[p[1]].label); o.value = p[0]; ps.appendChild(o); });
    ps.value = S.period;
    seg($("days"), DK.map((k, i) => [i, k]), S.day, (i) => { S.day = i; resetPos(); push(); });
    {   // Mark the real day, and say so plainly whenever the board is showing a different one.
        const rd = realDay(), thisWeek = S.week === defaultWeek(), btn = $("days").children[rd];
        if (isSchoolDay() && thisWeek && btn) btn.classList.add("istoday");
        let nt = $("notToday"); if (!nt) { nt = el("div", "nottoday"); nt.id = "notToday"; nt.setAttribute("role", "status"); }
        { const at = $("days").closest(".flowtop") || $("days"); if (nt.previousElementSibling !== at) at.after(nt); }   // its own line, under the days (and the phone's day row)
        const nk = [S.week, S.day, rd, localIso()].join("|");   // closed with the X: stays closed until the week or day shown changes
        nt.hidden = !isSchoolDay() || (thisWeek && S.day === rd) || notTodayShut === nk; nt.textContent = "";
        if (!nt.hidden) {
            nt.appendChild(el("span", null, "Showing " + (thisWeek ? "" : W().label + ", ") + FULL[S.day] + ". Today is " + FULL[rd] + "."));
            const b = el("button", null, "Go to today"); b.type = "button"; b.onclick = () => { S.week = defaultWeek(); S.day = rd; resetPos(); push(); }; nt.appendChild(b);
            const x = el("button", "ntx", "\u00d7"); x.type = "button"; x.setAttribute("aria-label", "Keep showing " + FULL[S.day] + " and close this note");
            x.onclick = () => { notTodayShut = nk; try { sessionStorage.setItem("anchorboard-nottoday", nk); } catch (e) { /* this visit only */ } nt.hidden = true; fit(); }; nt.appendChild(x);
        }
    }
    screensUi();
    const sel = $("weekSel"); sel.textContent = "";
    WEEKS.forEach((x) => { const o = el("option", null, x.label + " · " + (isPhone() ? String(x.dates || "").replace(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/g, "$1") : x.dates)); o.value = x.id; sel.appendChild(o); });
    sel.value = w.id; $("weekField").hidden = WEEKS.length < 2;
    const fn = $("flowNext"); if (fn) { fn.textContent = stepLabel(); fn.disabled = fn.textContent === "Next" && !nextScreen(1); $("flowBack").disabled = S.screen === screenOrder()[0]; }
    quickBar();
    const bn = $("bnNext"), bb = $("bnBack");
    if (bn) { const nl = stepLabel(), bl = backLabel(); bn.title = nl; bn.setAttribute("aria-label", nl); bn.disabled = $("flowNext").disabled; bb.title = bl; bb.setAttribute("aria-label", bl); bb.disabled = $("flowBack").disabled; }
    const files = $("files"), l = L();
    if (files) {
        files.textContent = "";
        const links = (l && l.links) || [];
        $("filesMenu").hidden = !links.length;
        if (links.length) {
            links.forEach((k) => { const a = el("a", null, k.t); a.href = k.u; a.target = "_blank"; a.rel = "noopener"; files.appendChild(a); });
        }
    }
}

/* ---------- stage ---------- */
/* Tools sit on a shelf beside the lesson, so they never cover it. The stage gets a little
   smaller to make room. A tool the teacher drags out floats over the lesson by choice. */
const SHELF_EM = 14.5, SHELF_WIDE_EM = 22.5, CHIP_EM = 11;
const narrowWrap = () => { if (phoneMirror()) return false; const w = $("wrap"); return !w || w.clientWidth - 16 < 700; };
/* On a phone the Remote shows a true small copy of the board: the stage is drawn at board size (1280 x 720)
   and shrunk to fit, so the teacher sees exactly what the class sees. "Phone size" turns it off on that phone. */
const MIRROR_KEY = "anchorboard-phone-mirror";
let mirrorOn = (() => { try { return localStorage.getItem(MIRROR_KEY) !== "off"; } catch (e) { return true; } })();
/* A phone, held either way. The page's own width (clientWidth), not innerWidth: on an iPhone innerWidth follows a
   pinch or double-tap zoom, and a zoomed-out Remote once came back with the laptop layout (Nov 21). A small touch
   screen is a phone whatever the page width says. */
let smallTouchIs = null;
const smallTouch = () => { if (smallTouchIs == null) { try { smallTouchIs = Math.min(screen.width, screen.height) < 600 && (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0); } catch (e) { smallTouchIs = false; } } return smallTouchIs; };
const isPhone = () => {
    if (mode === "board") return false;
    const de = document.documentElement, w = de.clientWidth || window.innerWidth, h = de.clientHeight || window.innerHeight;
    return (Math.min(w, h) < 600 && w < 1000) || smallTouch();
};
const phoneMirror = () => mirrorOn && isPhone();
const PANEL_KEYS = PANEL_LIST.map((x) => x[0]);
/** Minimized panels: live chips at the foot of the shelf. */
function chipKeys() { return ordered(S.tools, PANEL_KEYS.filter((k) => S.tools.on[k] && S.tools.min[k] && panelOk(k))); }
function shelfKeys() { return narrowWrap() ? [] : ordered(S.tools, PANEL_KEYS.filter((k) => S.tools.on[k] && !S.tools.pos[k] && !S.tools.min[k] && k !== "groups" && panelOk(k))); }
function shelfEm() { const ks = shelfKeys(); if (ks.length) return ks.includes("score") ? SHELF_WIDE_EM : SHELF_EM; return !narrowWrap() && chipKeys().length ? CHIP_EM : 0; }
function shelfEl() { let sh = $("toolShelf"); if (!sh) { sh = el("div", "toolshelf"); sh.id = "toolShelf"; sh.hidden = true; $("wrap").appendChild(sh); } return sh; }
let shelfApplied = "";
function fit() {
    const w = $("wrap"), st = $("stage");
    document.body.classList.toggle("phone", isPhone()); document.body.classList.toggle("mirror", phoneMirror());
    if (isPhone() && !phoneHeadDone) phoneHeader();
    const mir = phoneMirror(), Wd = mir ? 1280 : w.clientWidth - 16, H = mir ? 720 : w.clientHeight - 16;
    if (Wd < 50 || H < 50) return;
    const se = synced ? shelfEm() : 0;
    let sw = Math.min(Wd / (1 + se / 52), H * 16 / 9), sh = sw * 9 / 16;
    if (!mir && Wd < 700) { sw = Wd; sh = Math.max(440, Math.round(window.innerHeight * 0.82)); }
    if (mir) {   // shrink the board-size stage (and its shelf) to the phone's width, or its height in Board view
        const full = sw + (se ? (se - 0.6) * Math.max(9, sw / 52) + 6 : 0), aw = w.clientWidth - 8, ah = document.body.classList.contains("board") ? w.clientHeight - 8 : Infinity;
        const k = Math.min(aw / full, ah / sh);
        w.style.setProperty("--mk", k); w.style.setProperty("--shx", ((sw + 0.6 * Math.max(9, sw / 52)) * k) + "px");
        w.style.setProperty("--mx", Math.max(4, (w.clientWidth - full * k) / 2) + "px"); w.style.height = Math.round(sh * k + 8) + "px";
    } else { ["--mk", "--shx", "--mx"].forEach((v) => w.style.removeProperty(v)); w.style.height = ""; }   // not the wrap's height: on a phone the wrap grows with the stage, and the stage kept growing
    st.style.width = sw + "px"; st.style.height = sh + "px"; st.style.fontSize = Math.max(9, sw / 52) + "px";
    { const shelf = shelfEl(), f = Math.max(9, sw / 52); shelf.hidden = !se; shelf.style.fontSize = f + "px"; shelf.style.width = ((se - 0.6) * f) + "px"; shelf.style.maxHeight = sh + "px"; shelf.style.height = sh + "px"; } fitShelf();
    { const key = se + "|" + narrowWrap(); if (key !== shelfApplied) { shelfApplied = key; layerSig = ""; setTimeout(renderLayer, 0); } }
    sizeCanvas(); placeCard();
}

function header(title, sub) {
    const l = L(), h = el("div", "hdr"), im = el("img"); im.src = lookSeal(); im.alt = ""; h.appendChild(im);
    const t = el("div", "ttl"); t.appendChild(el("h1", null, title)); t.appendChild(el("p", null, sub || "")); h.appendChild(t);
    h.appendChild(el("p", "cls", (l && l.cls) || "")); return h;
}
function card(title, cls) { const c = el("div", "card" + (cls ? " " + cls : "")); c.appendChild(el("h3", null, title)); const i = el("div", "in"); c.appendChild(i); return { c, i }; }
function lines(parent, arr, cls) { (arr || []).forEach((t) => parent.appendChild(richEl("p", cls, t))); }
function ltBox(text) { const b = el("div", "lt"); b.appendChild(el("p", "chip", "Learning Target")); b.appendChild(richEl("p", "ltt", text || "")); return b; }
function weekCard() { const k = card("This Week", "wk"), l = L(); (l.days || []).forEach((d, i) => k.i.appendChild(el("p", "wl" + (i === S.day ? " now" : ""), DK[i] + ": " + (d.short || "")))); return k.c; }

function timerParts(kind, host) {
    const c = el("p", "clock"); c.id = "clock";
    const bar = el("div", "bar"); bar.id = "tbar"; bar.appendChild(el("i"));
    const tb = el("div", "tbtns"), go = el("button", null, "Start"), rs = el("button", "alt", "Reset"); go.id = "tgo"; go.type = rs.type = "button";
    go.onclick = () => timerGo(kind);
    rs.onclick = () => { S.timers[kind] = Object.assign(blankTimer(), kind === "free" ? { dur: S.timers.free.dur || 300 } : {}); push(); };
    tb.appendChild(go); tb.appendChild(rs);
    host.appendChild(c);
    if (kind === "round" || kind === "check") { const r = el("p", "round"); r.id = "round"; if (kind === "check") r.textContent = "Go over each master problem"; host.appendChild(r); }
    host.appendChild(bar); host.appendChild(tb);
    host.dataset.kind = kind; host.id = "tcard";
}
function timerCard(kind, title) { const k = card(title); k.i.classList.add("timer"); timerParts(kind, k.i); return k.c; }
/* Speed dating timer: rounds (4:00, then 10 s to rotate) or a 10:00 check of the master problems. */
function speedTimer() {
    const m = S.speedMode === "check" ? "check" : "round", k = card("Timer");
    k.c.classList.add("stimer"); k.i.classList.add("timer");
    const sw = el("div", "tmode"); sw.setAttribute("role", "group"); sw.setAttribute("aria-label", "Timer");
    [["round", "Rounds 4:00"], ["check", "Check 10:00"]].forEach(([v, label]) => {
        const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", String(m === v));
        b.onclick = () => { if (S.speedMode === v) return; const t = S.timers[S.speedMode === "check" ? "check" : "round"]; if (t.running) { t.elapsed = now() - t.t0; t.running = false; } S.speedMode = v; push(); };
        sw.appendChild(b);
    });
    k.c.firstChild.appendChild(sw); timerParts(m, k.i);
    const fx = el("button", "alt tfix", "Set time"); fx.type = "button"; fx.title = "Pick the round and the time left";
    fx.onclick = () => { speedFix = speedNow(); sig = ""; render(); };
    k.i.querySelector(".tbtns").appendChild(fx);
    if (speedFix) k.c.appendChild(speedFixPanel(m));
    return k.c;
}
/* Set time (Remote only): put the speed dating timer back where it was after an accidental Reset.
   The fix lives on this device until Save, so the board keeps counting while the teacher types. */
let speedFix = null;
function speedNow() {
    const m = S.speedMode === "check" ? "check" : "round", t = S.timers[m], e = Math.max(0, Math.floor((t.running ? now() - t.t0 : t.elapsed) / 1000));
    if (m === "check") return { n: 1, left: Math.max(0, CHECK - e) };
    const x = e % (ROUND + GAP), n = Math.floor(e / (ROUND + GAP)) + 1;
    return x < ROUND ? { n, left: ROUND - x } : { n: n + 1, left: ROUND };   // during the rotate gap, offer the next round
}
function speedFixPanel(m) {
    const max = m === "check" ? CHECK : ROUND, f = speedFix, p = el("div", "sfix");
    p.setAttribute("role", "group"); p.setAttribute("aria-label", "Set the speed dating timer");
    const stepper = (label, get, set, show) => {
        const r = el("div", "sfrow"); r.appendChild(el("span", "sflab", label));
        const minus = el("button", "sfstep", "\u2212"), val = el("span", "sfval", show()), plus = el("button", "sfstep", "+");
        minus.type = plus.type = "button"; minus.setAttribute("aria-label", label + " down"); plus.setAttribute("aria-label", label + " up");
        minus.onclick = () => { set(get() - 1); val.textContent = show(); }; plus.onclick = () => { set(get() + 1); val.textContent = show(); };
        r.appendChild(minus); r.appendChild(val); r.appendChild(plus); return r;
    };
    if (m === "round") p.appendChild(stepper("Round", () => f.n, (v) => { f.n = Math.max(1, Math.min(40, v)); }, () => String(f.n)));
    p.appendChild(stepper("Minutes", () => Math.floor(f.left / 60), (v) => { f.left = Math.max(0, Math.min(max, Math.max(0, Math.min(Math.floor(max / 60), v)) * 60 + f.left % 60)); }, () => String(Math.floor(f.left / 60))));
    p.appendChild(stepper("Seconds", () => f.left % 60, (v) => { const mm = Math.floor(f.left / 60), ss = ((v % 60) + 60) % 60; f.left = Math.max(0, Math.min(max, mm * 60 + ss)); }, () => ("0" + (f.left % 60)).slice(-2)));
    const b = el("div", "sfbtns"), ok = el("button", null, "Save"), no = el("button", "alt", "Cancel"); ok.type = no.type = "button";
    ok.onclick = () => {
        const t = S.timers[m], left = Math.max(m === "round" ? 1 : 0, Math.min(max, f.left));
        t.elapsed = (m === "round" ? (f.n - 1) * (ROUND + GAP) + (ROUND - left) : CHECK - left) * 1000;
        if (t.running) t.t0 = now() - t.elapsed;
        speedFix = null; sig = ""; push();
    };
    no.onclick = () => { speedFix = null; sig = ""; render(); };
    b.appendChild(ok); b.appendChild(no); p.appendChild(b); return p;
}
function secsFor(kind) { if (kind === "check") return CHECK; if (kind === "free") return S.timers.free.dur || 300; const l = L(); return (l && l.bellSeconds) || 300; }
const fmt = (r) => Math.floor(r / 60) + ":" + ("0" + (r % 60)).slice(-2);

const unlockSound = () => snd.unlock();
/* ---------- sound ----------
   One screen plays the sound: the board, unless the Remote picked "This device".
   Settings are shared, so the Remote turns music on and the board plays it. */
const DEVICE = (() => { try { let id = localStorage.getItem("anchorboard-device-id"); if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem("anchorboard-device-id", id); } return id; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
function playsHere() { return mode === "sub" || (S.sound.at ? S.sound.at === DEVICE : document.body.classList.contains("board")); }
function soundSync() { snd.set(S.sound, playsHere()); soundControls(); }
/* Every timer, every quarter second, whatever screen is showing. */
function soundTick() {
    const sec = (t) => Math.max(0, Math.floor((t.running ? now() - t.t0 : t.elapsed) / 1000));
    ["bell", "free", "check"].forEach((k) => { const t = S.timers[k]; snd.watchTimer({ kind: k, running: t.running, secs: sec(t), total: secsFor(k) }); });
    const r = S.timers.round; snd.watchTimer({ kind: "round", running: r.running, secs: sec(r), round: { len: ROUND, gap: GAP } });
    // Vault Raid: the theme song follows the game, and each big moment has its own sound.
    const g = liveSound(); snd.gameSong(g.song); snd.gamePhase(g.phase); g.cues.forEach((c) => snd.cue(c));
}
function soundPanel() {
    const rail = document.querySelector(".rail"), host = $("soundHost"); if ((!rail && !host) || $("soundMenu")) return;
    const box = el("details", "menu fold"); box.id = "soundMenu"; box.open = window.innerWidth > 860;
    const sum = el("summary", null, "Sound "); const cnt = el("span", "count"); cnt.id = "soundCount"; sum.appendChild(cnt); box.appendChild(sum);
    const b = el("div", "sndbox"); box.appendChild(b);
    const toggle = (id, label) => { const x = el("button", "sndtog"); x.type = "button"; x.id = id; x.appendChild(el("span", null, label)); x.appendChild(el("i")); b.appendChild(x); return x; };
    const slider = (id, label) => { const w = el("label", "sndvol"); w.appendChild(el("span", null, label)); const r = el("input"); r.type = "range"; r.min = "0"; r.max = "100"; r.step = "5"; r.id = id; w.appendChild(r); b.appendChild(w); return r; };
    toggle("sndMusic", "Music").onclick = () => { S.sound.music = !S.sound.music; snd.unlock(); push(); };
    const sty = el("div", "seg sndsty"); sty.id = "sndStyle"; sty.setAttribute("role", "group"); sty.setAttribute("aria-label", "Music style"); b.appendChild(sty);
    const mv = slider("sndMv", "Music volume");
    mv.oninput = () => { S.sound.mv = +mv.value / 100; soundSync(); quiet(); };
    toggle("sndGame", "Game theme song").onclick = () => { S.sound.game = !S.sound.game; snd.unlock(); push(); };
    toggle("sndFx", "Sound effects").onclick = () => { S.sound.fx = !S.sound.fx; snd.unlock(); push(); };
    const fv = slider("sndFv", "Effects volume");
    fv.oninput = () => { S.sound.fxv = +fv.value / 100; soundSync(); quiet(); };
    fv.onchange = () => snd.preview("warn");
    const tr = el("div", "sndtry"); tr.appendChild(el("span", null, "Hear:"));
    [["go", "Start"], ["tick", "Tick"], ["rotate", "Rotate"], ["done", "Time up"], ["crack", "Vault crack"], ["bonus", "Bonus"]].forEach(([k, label]) => { const x = el("button", null, label); x.type = "button"; x.onclick = () => snd.preview(k); tr.appendChild(x); });
    b.appendChild(tr);
    if (mode !== "sub") {
        b.appendChild(el("p", "sndlab", "Sound plays on"));
        const at = el("div", "seg sndat"); at.id = "sndAt"; at.setAttribute("role", "group"); at.setAttribute("aria-label", "Sound plays on"); b.appendChild(at);
    }
    const n = el("p", "sndnote"); n.id = "sndNote"; n.setAttribute("role", "status"); b.appendChild(n);
    if (host) { box.open = true; host.appendChild(box); } else { const anchor = $("filesMenu") || $("toolsMenu"); anchor.after(box); }
    // The quick switch in the top bar, so music goes on and off without scrolling the rail.
    const q = el("button", "btn ghost musicbtn"); q.id = "musicBtn"; q.type = "button"; q.title = "Background music (M key)";
    q.onclick = () => { S.sound.music = !S.sound.music; snd.unlock(); push(); };
    $("boardBtn").before(q);
    snd.onChange(soundControls);
}
/* On a phone the top bar is two tidy rows: logo, connection and boards, and a menu button; then the class and week
   side by side. Music and Board view move into the menu. Done once (a phone stays a phone): at load, or on the first
   fit that finds a phone, should the page have opened at another size. */
let phoneHeadReady = false, phoneHeadDone = false;
function phoneHeader() {
    if (!phoneHeadReady || phoneHeadDone || !isPhone()) return;
    phoneHeadDone = true;
    const acct = document.querySelector(".cbar details.acct"), pop = acct && acct.querySelector(".pop"); if (!pop) return;
    const sum = acct.querySelector("summary"); if (sum) { sum.textContent = "Menu"; sum.classList.add("phmenu"); sum.setAttribute("aria-label", "Menu"); }
    const top = [el("p", "pophead", "This phone"), $("boardBtn"), $("musicBtn"), el("p", "pophead", "Pages")].filter(Boolean);
    pop.prepend(...top);
    if ($("boardBtn")) $("boardBtn").textContent = "Full-screen board";
    {   // Reload: an app opened from the Home Screen has no browser reload button
        const r = el("button", null, "Reload"); r.id = "phReload"; r.type = "button"; r.onclick = () => location.reload(); ($("musicBtn") || $("boardBtn")).after(r);
    }
    const app = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    document.body.classList.toggle("app", app);
    if (!app) {   // a short how-to for putting the Remote on the Home Screen, so it opens full screen like an app
        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
        const h = el("button", "phhome", "Add to Home Screen"); h.type = "button";
        h.onclick = () => {
            let d = $("homeHow"); if (d) { d.hidden = false; return; }
            d = el("div", "homehow"); d.id = "homeHow"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Add the Remote to your Home Screen");
            const box = el("div", "hhbox");
            box.appendChild(el("b", null, "Put the Remote on your Home Screen"));
            const ol = el("ol");
            (ios ? ["Tap the Share button in Safari (the square with the arrow). On newer iPhones it is behind the \u22ef button next to the address.", "Scroll down and tap \u201cAdd to Home Screen\u201d.", "Keep the name \u201cRemote\u201d and tap Add.", "Open it from the new icon. It runs full screen, with no Safari bars. Sign in once inside it."]
                : ["Open the browser menu (\u22ee).", "Tap \u201cAdd to Home screen\u201d or \u201cInstall app\u201d.", "Open it from the new icon. Sign in once inside it."]).forEach((t) => ol.appendChild(el("li", null, t)));
            box.appendChild(ol);
            const ok = el("button", "btn", "Got it"); ok.type = "button"; ok.onclick = () => { d.hidden = true; }; box.appendChild(ok);
            d.appendChild(box); d.onclick = (e) => { if (e.target === d) d.hidden = true; }; document.body.appendChild(d);
        };
        ($("phReload") || pop.lastChild).after(h);
    }
    pop.querySelectorAll("button,a").forEach((b) => b.addEventListener("click", () => { acct.open = false; }));
    const tm = $("toolsMenu"); if (tm) tm.open = false;   // the rail starts folded on a phone: open only what is needed
}
function soundControls() {
    const box = $("soundMenu");
    let tap = $("sndTap");   // a screen that should play but has not been tapped yet (browsers need one tap first)
    if (!tap) { tap = el("button", "sndtap", "Tap for sound"); tap.id = "sndTap"; tap.type = "button"; tap.onclick = (e) => { e.stopPropagation(); snd.unlock(); }; document.body.appendChild(tap); }
    tap.hidden = !(synced && snd.wanted() && !snd.running());
    if (!box) return;
    const so = S.sound, here = playsHere();
    const on = (id, v) => { const x = $(id); x.setAttribute("aria-pressed", String(v)); x.querySelector("i").textContent = v ? "On" : "Off"; };
    on("sndMusic", so.music); on("sndFx", so.fx); on("sndGame", so.game);
    seg($("sndStyle"), snd.STYLES, so.style, (v) => { S.sound.style = v; S.sound.music = true; snd.unlock(); push(); });
    [["sndMv", so.mv], ["sndFv", so.fxv]].forEach(([id, v]) => { const r = $(id); if (document.activeElement !== r) r.value = String(Math.round(v * 100)); });
    if ($("sndAt")) seg($("sndAt"), [["board", "The board"], ["here", "This device"]], so.at && so.at === DEVICE ? "here" : (so.at ? "other" : "board"), (v) => { S.sound.at = v === "here" ? DEVICE : ""; snd.unlock(); push(); });
    $("soundCount").textContent = so.music ? "Music on" : "";
    const q = $("musicBtn"); if (q) { q.textContent = so.music ? "Music on" : "Music off"; q.setAttribute("aria-pressed", String(so.music)); }
    let note;
    if (!so.music && !so.fx && !so.game) note = "Sound is off.";
    else if (here) note = snd.running() ? "Playing on this device." : "Tap this screen once to let it play sound.";
    else if (so.at) note = "Playing on another device.";
    else note = "Playing on the board. If it stays quiet, tap the board once.";
    $("sndNote").textContent = note;
}
function tick() {
    const tc = $("tcard"); if (!tc) return;
    const kind = tc.dataset.kind, t = S.timers[kind], ms = t.running ? now() - t.t0 : t.elapsed, e = Math.max(0, Math.floor(ms / 1000));
    const c = $("clock"), bar = $("tbar"); let txt, hot, frac, phase;
    if (kind === "round") {
        const x = e % (ROUND + GAP), n = Math.floor(e / (ROUND + GAP)) + 1;
        if (x < ROUND) { const rr = ROUND - x; txt = fmt(rr); hot = rr <= 30; frac = rr / ROUND; phase = "work" + n; }
        else { const g = ROUND + GAP - x; txt = fmt(g); hot = true; frac = (GAP - g) / GAP; phase = "rotate" + n; }
        const rl = $("round"); rl.textContent = x < ROUND ? "Round " + n + " · then rotate" : "Rotate now! Next partner"; rl.classList.toggle("hot", x >= ROUND);
    } else {
        const T = secsFor(kind), r = Math.max(0, T - e); txt = r > 0 ? fmt(r) : "Time!"; hot = r <= Math.min(60, T / 4); frac = r / T; phase = r > 0 ? "run" : "done";
    }
    c.textContent = txt; c.classList.toggle("hot", hot); bar.classList.toggle("hot", hot); bar.firstChild.style.width = (frac * 100) + "%";
    $("tgo").textContent = t.running ? "Pause" : (t.elapsed > 0 ? "Resume" : "Start");
}

function skeleton() {
    const k = el("div", "skel"); k.setAttribute("aria-busy", "true"); k.setAttribute("aria-label", "Getting today's lesson");
    k.appendChild(el("div", "skb hd")); const b = el("div", "skbody"); ["w70", "w90", "w55"].forEach((c) => b.appendChild(el("div", "skb " + c))); k.appendChild(b); return k;
}
function render() {
    if (!synced) { const st = $("screenHost"); if (!st.querySelector(".skel")) { st.textContent = ""; st.appendChild(skeleton()); } return; }
    slWatch(); syncGames(); syncLive(); syncNotes(); buildControls(); soundSync(); applyLook(S.look); renderLookFold(); renderEditLink(); drawStickers(); deckNotes();
    if (studio && studio.render) studio.render();
    const l = L(), d = D(), ns = JSON.stringify([S.week, S.period, S.cls, S.day, S.screen, S.prob, S.show, S.note, S.step, S.timers.free.dur, S.speedMode, !!speedFix, signedIn, S.screen === "game" ? gameSig() : "", S.screen === "live" ? liveSig() : "", S.screen === "fix" ? JSON.stringify([S.fix, !!sdSet()]) : "", wbKind() ? JSON.stringify([S.wb.card.w, S.wb.card.hide, inkBase(), pageNow(), pageCount()]) : "", S.screen === "seats" ? seatSig() : "", S.screen === "steps" ? stepsSig() : "", S.screen === "deck" ? JSON.stringify([SL.ver, S.slide, S.sstep, slPen, S.look.mark, inkBase()]) : ""]);
    renderDock(); drawGamePanel(); drawLivePanel(); drawNotesPanel();
    if (sheetOpen()) refreshSheet();
    if (ns === sig) { if (S.screen === "steps") stepsSync(); renderLayer(); tick(); tickTools(toolApi); placeCard(); return; }
    sig = ns;
    if (S.screen !== "seats") seatLast = "";
    if (stepPlayer) { stepPlayer.destroy(); stepPlayer = null; stepFor = ""; }
    const st = $("screenHost"); st.textContent = ""; canvas = null; ctx = null; pad = null;
    if (S.screen === "seats") { drawSeats(st); renderLayer(); watchInk(); return; }
    if (S.screen === "steps") { drawSteps(st); renderLayer(); watchInk(); return; }
    if (S.screen === "deck") { drawDeck(st); renderLayer(); watchInk(); tick(); return; }
    if (!l) { st.appendChild(el("div", "empty", "No lesson found for this class and week.")); watchInk(); return; }
    const w = W();
    if (S.screen === "agenda") {
        st.appendChild(header("Weekly Agenda", w.label + " · " + w.dates));
        const b = el("div", "body rows");
        (l.days || []).forEach((x, i) => { const r = el("div", "row" + (i === S.day ? " now" : "")), tab = el("div", "tab"); tab.appendChild(el("span", "dot", "+−×÷="[i])); tab.appendChild(el("span", null, x.name)); r.appendChild(tab); r.appendChild(el("p", "what", x.agendaLine || "")); b.appendChild(r); });
        b.appendChild(ltBox(l.weekLT)); st.appendChild(b);
    } else if (S.screen === "today" && d) {
        st.appendChild(header(d.title || d.name, d.date));
        const g = el("div", "body today"); let k;
        k = card("Bell Ringer"); lines(k.i, [d.bell], "big"); g.appendChild(k.c);
        k = card("Agenda"); lines(k.i, d.agenda, "big"); g.appendChild(k.c);
        k = card("Supplies"); lines(k.i, d.supplies, "item"); g.appendChild(k.c);
        k = card("Reminders"); lines(k.i, d.reminders, "big"); g.appendChild(k.c);
        g.appendChild(timerCard("bell", "Bellringer Timer")); g.appendChild(weekCard()); g.appendChild(ltBox(d.lt)); st.appendChild(g);
    } else if (S.screen === "speed") {
        const sp = l.speed || {};
        st.appendChild(header("Speed Dating", sp.motto));
        const g2 = el("div", "body speed"), k2 = card("How It Works", "steps"), ol = el("ol");
        (sp.steps || []).forEach((t) => ol.appendChild(el("li", null, t))); k2.c.replaceChild(ol, k2.i);
        g2.appendChild(k2.c); g2.appendChild(speedTimer()); g2.appendChild(weekCard()); g2.appendChild(ltBox(sp.lt)); st.appendChild(g2);
    } else if (S.screen === "fix") {
        drawWb(st, "fix");
    } else if (S.screen === "timer") {
        st.appendChild(header("Timer", (d ? d.name + " · " : "") + ((d && d.date) || "")));
        const box = el("div", "bigtimer"); timerParts("free", box);
        const pr = el("div", "presets");
        PRESETS.forEach((m) => { const b = el("button", null, m + " min"); b.type = "button"; b.setAttribute("aria-pressed", String((S.timers.free.dur || 300) === m * 60)); b.onclick = () => { S.timers.free = Object.assign(blankTimer(), { dur: m * 60 }); push(); }; pr.appendChild(b); });
        box.appendChild(pr); st.appendChild(box);
    } else if (S.screen === "notes") {
        drawWb(st, "notes");
    } else if (S.screen === "game") {
        drawGame(st); tickGames();
    } else if (S.screen === "live") {
        if (liveReview()) drawWb(st, "vr"); else drawLiveStage(st);   // going over missed questions: the whiteboard
        tickLive();
    } else if (S.screen === "tools") {
        st.appendChild(header("Classroom Tools", (d ? d.name + " · " : "") + ((d && d.date) || "")));
        const box = el("div", "toolsbody"); box.appendChild(el("p", "toolempty", Object.keys(S.tools.on).length ? "" : "Add panels from Panels on the Remote, or tap Panels on the board. Drag a panel by its title to move it.")); st.appendChild(box);
    } else { /* bellringer or blank whiteboard */
        drawWb(st, S.screen === "blank" || !d ? "blank" : "bell");
    }
    renderLayer(); watchInk(); tick();
}

/* ---------- Show Steps: a worked example from the standards bank, one step at a time (js/walk.js, js/stepPlayer.js) ----------
   The Remote picks the problem and steps through it (or plays it); the board follows step by step, with the moves animated.
   Only walkthroughs the teacher has checked (walk.html, or "Looks right" here on the Remote) are ever shown on the board. */
let walkMods = null, WALKITEMS = null, WALKOK = {}, WALKED = {}, walkIn = false, stepPlayer = null, stepFor = "", stepReady = false;
function stepsLoad() {
    if (!walkMods) walkMods = Promise.all([import("./walkBank.js?v=1"), import("./stepPlayer.js?v=1"), import("./walk.js?v=1")]).then(async ([wb, sp, wk]) => { WALKITEMS = await wb.loadWalkItems(); return { wb, sp, wk }; });
    return walkMods;
}
function stepsSig() { return JSON.stringify([S.walk.id, !!WALKOK[S.walk.id], walkIn, WALKED[S.walk.id] || null, mode === "remote" ? S.cls : ""]); }
function stepsSync() {
    if (!stepPlayer || !stepReady || stepFor !== S.walk.id) return;
    const i = Math.min(S.walk.step, stepPlayer.count - 1);
    if (i !== stepPlayer.index) stepPlayer.go(i, i === stepPlayer.index + 1);
}
function drawSteps(st) {
    const remote = mode === "remote", id = S.walk.id;
    st.appendChild(header("Show Steps", "Watch each move, then try the next one yourself"));
    const body = el("div", "body stepsbody"); st.appendChild(body);
    const pick = remote ? el("div", "steppick") : null;
    if (pick) body.appendChild(pick);
    const host = el("div", "stepshost"); body.appendChild(host);
    if (!walkIn && !guestMode()) return;
    stepsLoad().then(({ wb, sp, wk }) => {
        if (S.screen !== "steps" || S.walk.id !== id || !host.isConnected) return;
        const mine = WALKITEMS.filter((x) => (x.cls === S.cls || (x.for || []).includes(S.cls)) && wb.walkOf(x).ok);
        if (pick) {
            const lab = el("label", "steppicklab"); lab.appendChild(el("span", null, "Problem"));
            const sel = el("select"); sel.appendChild(Object.assign(el("option", null, mine.length ? "Pick a problem…" : "No walkthroughs for this class yet"), { value: "" }));
            let grp = null, last = "";
            mine.forEach((x) => { if (x.std !== last) { grp = el("optgroup"); grp.label = x.std; sel.appendChild(grp); last = x.std; } const o = el("option", null, (WALKOK[x.id] ? "✓ " : "") + plainQ(x.q)); o.value = x.id; grp.appendChild(o); });
            sel.value = id; sel.onchange = () => { S.walk = { id: sel.value, step: 0 }; push(); };
            lab.appendChild(sel); pick.appendChild(lab);
            const more = el("a", "steplink", "All walkthroughs"); more.href = "walk.html" + (id ? "?id=" + encodeURIComponent(id) : ""); pick.appendChild(more);
        }
        const item = id && WALKITEMS.find((x) => x.id === id), w = item && wb.walkOf(item);
        if (!id || !w || !w.ok) {
            const e = el("div", "stepempty");
            e.appendChild(el("h2", null, id ? "That walkthrough is not available" : remote ? "Pick a problem above" : "Pick a problem on the Remote"));
            e.appendChild(el("p", null, remote ? "Choose one of this class's walkthroughs. You can also open the Walkthroughs page to watch and check them first." : "The worked example shows here, one step at a time."));
            host.appendChild(e); return;
        }
        if (!WALKOK[id]) {
            if (!remote) { const e = el("div", "stepempty"); e.appendChild(el("h2", null, "Not checked yet")); e.appendChild(el("p", null, "This walkthrough shows here after the teacher checks it on the Remote.")); host.appendChild(e); return; }
            const n = el("div", "stepcheck"); n.appendChild(el("p", null, "Only you can see this. Watch it, and when it looks right it goes on the board."));
            const b = el("button", "btn go", "Looks right, show it"); b.type = "button";
            b.onclick = async () => { b.disabled = true; const ids = Object.assign({}, WALKOK, { [id]: Date.now() }); WALKOK = ids; try { await store.save("walk/ok", { ids, at: Date.now() }); } catch (e) { setStatus("Could not save (" + ((e && e.code) || "connection") + ")."); } render(); };
            n.appendChild(b); host.appendChild(n);
        }
        const q = el("div", "stepq"); q.appendChild(el("span", "stepstd", item.std)); const qt = el("span", "stepqt"); qt.appendChild(sp.drawDT(wk.keyDT(item.q))); q.appendChild(qt); host.appendChild(q);
        const box = el("div", "stepbox"); host.appendChild(box);
        stepReady = false;
        stepPlayer = sp.createStepPlayer(box, wb.withEdits(w, WALKED[id]), { big: true, controls: false, onStep: (i) => { if (remote && stepReady && i !== S.walk.step) { S.walk.step = i; push(); } } });
        stepFor = id;
        stepPlayer.go(Math.min(S.walk.step, w.steps.length - 1), false);
        stepReady = true;
        if (pick) {
            const play = el("button", "btn ghost onnavy", "Play"); play.type = "button";
            play.onclick = () => { if (!stepPlayer) return; if (play.dataset.on) { stepPlayer.pause(); delete play.dataset.on; play.textContent = "Play"; } else { stepPlayer.play(); play.dataset.on = "1"; play.textContent = "Pause"; } };
            const again = el("button", "btn ghost onnavy", "Replay"); again.type = "button";
            again.onclick = () => { if (stepPlayer) { delete play.dataset.on; play.textContent = "Play"; S.walk.step = 0; push(); } };
            pick.append(play, again);
        }
        buildControls();
    });
}
const plainQ = (t) => String(t).replace(/§/g, "$").replace(/(\d+)\{(\d+)\/(\d+)\}/g, "$1 $2/$3").replace(/\{([^{}/]+)\/([^{}/]+)\}/g, "$1/$2").slice(0, 90);
const guestMode = () => mode === "sub";

/* ---------- Seating Chart: the period's room from seats.html, so students can find their seat ----------
   Names show here because the teacher put them here (Eddie asked for it, Nov 19). On the Remote, tap a
   name to light that seat up on the board for 15 seconds. */
const SEAT_HI_MS = 15000;
const seatHiNow = () => (S.seatHi && now() - S.seatHi.at < SEAT_HI_MS ? S.seatHi.n : "");
function seatSig() { const p = SEATS.periods[S.period]; return JSON.stringify([seatsIn, p ? p.at : 0, p ? p.items.length : 0, seatHiNow(), (ROSTERS[S.period] || []).length, S.seatView]); }
function drawSeats(st) {
    const p = SEATS.periods[S.period] || cleanPeriod(null), n = Object.keys(p.seats).length, hi = seatHiNow();
    const hd = header("Find Your Seat", S.period + " period" + (n ? " \u00b7 " + n + " students" : "")); st.appendChild(hd);
    const body = el("div", "seatbody"); st.appendChild(body);
    const editHref = "seats.html?period=" + encodeURIComponent(S.period);
    if (!seatsIn) return;   // never flash "no chart" before the charts have loaded
    if (!p.items.length || !seatCount(p)) {
        const e = el("div", "seatempty"); e.appendChild(el("h2", null, "No seating chart for " + S.period + " period yet"));
        e.appendChild(el("p", null, "Set up the room and drag each student to a desk. It shows here as soon as you save."));
        const a = el("a", null, "Make the seating chart"); a.href = editHref; e.appendChild(a); body.appendChild(e); return;
    }
    const room = drawRoom(body, p, { hi, view: S.seatView });
    if (seatLast !== S.period) { room.classList.add("enter"); seatLast = S.period; }
    if (hi) {
        room.classList.add("lit");
        const f = el("div", "seatfind"); f.appendChild(el("span", null, "Your seat is lit up")); f.appendChild(el("b", null, hi)); hd.classList.add("seatlit"); hd.appendChild(f);
    }
    if (mode !== "board") {   // the Remote: tap a name to light it up on the board
        room.addEventListener("click", (e) => {
            const c = e.target.closest(".scell.full"); if (!c) return;
            const nm = p.seats[c.dataset.seat]; S.seatHi = nm && nm !== hi ? { n: nm, at: now() } : null; push();
        });
        const ed = el("p", "seatedit"); const a = el("a", null, "Edit seating chart"); a.href = editHref; ed.appendChild(a);
        ed.appendChild(document.createTextNode(" \u00b7 Tap a name to light up that seat on the board"));
        const foot = el("div", "seatfoot"); foot.appendChild(ed); foot.appendChild(seatViewBar()); body.appendChild(foot);
    }
}

/** The Remote's buttons to turn and mirror the room on the board, for a board that faces the room another way. */
const SV_ICONS = {
    l: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    r: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    mx: '<path d="M12 3v18"/><path d="M8 7 3 12l5 5"/><path d="m16 7 5 5-5 5"/>',
    my: '<path d="M3 12h18"/><path d="M7 8l5-5 5 5"/><path d="m7 16 5 5 5-5"/>',
};
function seatViewBar() {
    const v = S.seatView, bar = el("div", "seatview"); bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Turn or flip the room on the board");
    bar.appendChild(el("span", null, "Board view"));
    const set = (fn) => { const n = Object.assign({}, S.seatView); fn(n); S.seatView = cleanView(n); push(); };
    const btn = (icon, label, title, fn, pressed) => {
        const b = el("button"); b.type = "button"; b.title = title; b.setAttribute("aria-label", title);
        b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + SV_ICONS[icon] + "</svg>";
        if (label) b.appendChild(el("span", null, label));
        if (pressed != null) b.setAttribute("aria-pressed", pressed ? "true" : "false");
        b.onclick = (e) => { e.stopPropagation(); set(fn); };
        bar.appendChild(b);
    };
    btn("l", "", "Turn the room left", (n) => { n.rot = (n.rot + 270) % 360; });
    btn("r", "", "Turn the room right", (n) => { n.rot = (n.rot + 90) % 360; });
    btn("mx", "Left\u2013right", "Flip left and right", (n) => { n.mx = !n.mx; }, v.mx);
    btn("my", "Top\u2013bottom", "Flip top and bottom", (n) => { n.my = !n.my; }, v.my);
    if (v.rot || v.mx || v.my) { const b = el("button", null, "Reset"); b.type = "button"; b.title = "Back to the room as you set it up"; b.onclick = (e) => { e.stopPropagation(); set((n) => { n.rot = 0; n.mx = false; n.my = false; }); }; bar.appendChild(b); }
    return bar;
}

/* ---------- canvas-first whiteboard: Bellringer, Whiteboard and Guided Notes ----------
   A thin strip on top, then paper edge to edge. The lesson sits on a card that floats on the paper:
   drag it by its top bar, make it bigger or smaller, or hide it. The tool rail floats on the left,
   and pages run along the bottom. Card place, size and pages are shared, so the board follows the Remote. */
const WB_SCREENS = { bell: 1, blank: 1, notes: 1, fix: 1 };
/** Which whiteboard is up: one of WB_SCREENS, "vr" while going over a Student Game's missed questions, or "". */
const wbKind = () => (WB_SCREENS[S.screen] ? S.screen : S.screen === "live" && liveReview() ? "vr" : "");
const CARD_W = [0.3, 0.38, 0.5];
function wbStrip(title, sub, extra) {
    const h = el("div", "wbstrip"), im = el("img"); im.src = lookSeal(); im.alt = ""; h.appendChild(im);
    h.appendChild(el("h1", null, title)); if (sub) h.appendChild(el("p", "wbsub", sub));
    if (extra) h.appendChild(extra);
    h.appendChild(el("span", "wbfill"));
    const l = L(); h.appendChild(el("p", "cls", (l && l.cls) || "")); return h;
}
function drawWb(st, kind) {
    const d = D(), ps = (d && d.problems) || [];
    let extra = null, sub = "";
    if (kind === "bell") {
        sub = d.name + (ps.length ? " · Problem " + (Math.min(S.prob, ps.length - 1) + 1) + " of " + ps.length : "");
        extra = el("div", "wbdots"); extra.setAttribute("role", "group"); extra.setAttribute("aria-label", "Problems");
        ps.forEach((p, i) => { const b = el("button", i === S.prob ? "on" : (i < S.prob ? "done" : "")); b.type = "button"; b.setAttribute("aria-label", "Problem " + (i + 1)); b.setAttribute("aria-pressed", String(i === S.prob)); b.onclick = () => { S.prob = i; S.show = false; push(); }; extra.appendChild(b); });
    } else if (kind === "notes") {
        const n = d && d.notes, fr = notesFrames(d); sub = n ? n.title : (d ? d.name : "");
        if (fr.length) { const at = Math.min(S.note, fr.length - 1); extra = el("div", "wbprog"); extra.setAttribute("role", "progressbar"); extra.setAttribute("aria-label", "Notes progress"); extra.setAttribute("aria-valuemin", "1"); extra.setAttribute("aria-valuemax", String(fr.length)); extra.setAttribute("aria-valuenow", String(at + 1));
            const bar = el("i"), fill = el("b"); fill.style.width = ((at + 1) / fr.length * 100) + "%"; bar.appendChild(fill); extra.appendChild(bar); extra.appendChild(el("span", null, (at + 1) + " / " + fr.length)); }
    } else if (kind === "fix") {
        const f = fixState(), sd = sdSet(); sub = sd && sd.title ? "Speed dating review: " + sd.title : "The cards that tripped us up";
        if (f.list.length) {
            extra = el("div", "fixchips"); extra.setAttribute("role", "group"); extra.setAttribute("aria-label", "Tricky cards");
            f.list.forEach((x, i) => {
                const b = el("button", "fixchip" + (i === f.cur ? " on" : "") + (x.done ? " done" : ""), "#" + x.n + (x.done ? " \u2713" : ""));
                b.type = "button"; b.setAttribute("aria-label", "Card " + x.n + (x.done ? ", fixed" : "")); b.onclick = () => fixGo(i); extra.appendChild(b);
            });
        }
    } else if (kind === "vr") {
        const r = liveReview(); sub = r.title + " · the questions we missed";
        extra = el("div", "fixchips"); extra.setAttribute("role", "group"); extra.setAttribute("aria-label", "Missed questions");
        r.list.forEach((qi, i) => { const b = el("button", "fixchip" + (qi === r.qi ? " on" : "") + (i < r.at ? " done" : ""), String(i + 1)); b.type = "button"; b.setAttribute("aria-label", "Missed question " + (i + 1)); b.onclick = () => goReview(qi); extra.appendChild(b); });
    } else sub = d ? d.name + (d.date ? " · " + d.date : "") : "Work it out";
    const wrap = el("div", "wbx");
    wrap.appendChild(wbStrip(kind === "bell" ? "Bellringer" : kind === "notes" ? "Guided Notes" : kind === "fix" ? "Fix It Together" : kind === "vr" ? "Let's go over it" : "Whiteboard", sub, extra));
    const paperEl = el("div", "wbpaper"); paperEl.id = "wbpaper"; wrap.appendChild(paperEl);
    const cv = makeCv(); paperEl.appendChild(cv);
    if (kind === "notes") pdfLayer(cv);
    const card = kind === "bell" ? bellCard(d, ps) : kind === "notes" ? notesCard(d) : kind === "fix" ? fixCard() : kind === "vr" ? vrCard() : null;
    if (card) {
        if (S.wb.card.hide) { const sb = el("button", "wbshow"); sb.type = "button"; sb.innerHTML = wbIcon("doc") + "<span>" + (kind === "bell" || kind === "vr" ? "Show problem" : kind === "fix" ? "Show card" : "Show notes") + "</span>"; sb.onclick = () => { S.wb.card.hide = false; push(); }; paperEl.appendChild(sb); }
        else paperEl.appendChild(card);
    }
    paperEl.appendChild(pagesBar());
    drawNotesOverlay(paperEl, kind);   // live notes: the check-in ring and join code (js/liveNotes.js)
    st.appendChild(wrap); bindCanvas(); sizeCanvas(); placeCard();
    const list = paperEl.querySelector(".nlines"); if (list) list.scrollTop = list.scrollHeight;
}
function cardShell(label, aria) {
    const c = el("section", "wbcard"); c.id = "wbcard"; c.setAttribute("aria-label", aria || label);
    const top = el("div", "wbctop"), grip = el("span", "wbgrip"); grip.innerHTML = wbIcon("grip"); top.appendChild(grip);
    top.appendChild(el("span", "wbclabel", label));
    const sm = el("button", "wbcb", "A−"), lg = el("button", "wbcb", "A+"), hide = el("button", "wbcb"); sm.type = lg.type = hide.type = "button";
    sm.title = "Smaller card"; lg.title = "Bigger card"; sm.disabled = S.wb.card.w <= 0; lg.disabled = S.wb.card.w >= 2;
    sm.onclick = () => { S.wb.card.w = Math.max(0, S.wb.card.w - 1); push(); }; lg.onclick = () => { S.wb.card.w = Math.min(2, S.wb.card.w + 1); push(); };
    hide.innerHTML = wbIcon("eyeOff"); hide.title = "Hide the card"; hide.setAttribute("aria-label", "Hide the card"); hide.onclick = () => { S.wb.card.hide = true; push(); };
    top.append(sm, lg, hide); c.appendChild(top);
    const body = el("div", "wbcbody"); c.appendChild(body);
    dragCard(c, top);
    return { c, body };
}
/* A missed Student Game question floats on the paper like the bellringer (js/liveRoom.js fills it). */
function vrCard() {
    const r = liveReview(); const { c, body } = cardShell("Missed question " + (r.at + 1) + " of " + r.count, "Missed question"); c.classList.add("wbvr");
    reviewBody(body); return c;
}
function bellCard(d, ps) {
    const p = ps[S.prob];
    const { c, body } = cardShell(p ? "Problem " + (S.prob + 1) : "Bellringer");
    if (!p) { body.appendChild(el("p", "wbq", "No bellringer problems are loaded for this day.")); return c; }
    body.appendChild(richEl("p", "wbq", p.q));
    if (S.show) body.appendChild(richEl("p", "wbans", p.a));
    const row = el("div", "wbcrow");
    const sb = el("button", "wbbtn dark"); sb.type = "button"; sb.innerHTML = wbIcon(S.show ? "eyeOff" : "eye") + "<span>" + (S.show ? "Hide answer" : "Show answer") + "</span>"; sb.onclick = () => { S.show = !S.show; push(); }; row.appendChild(sb);
    if (S.prob < ps.length - 1) { const nb = el("button", "wbbtn"); nb.type = "button"; nb.textContent = "Next problem"; nb.onclick = () => { S.prob++; S.show = false; push(); }; row.appendChild(nb); }
    body.appendChild(row); return c;
}
function notesCard(d) {
    const frames = notesFrames(d);
    if (!frames.length) { const { c, body } = cardShell("Guided Notes"); body.appendChild(el("p", "wbq", "No guided notes are loaded for this day.")); return c; }
    if (S.note >= frames.length) S.note = frames.length - 1;
    const f = frames[S.note], shown = f.open ? f.lines.length : Math.min(S.step, f.lines.length);
    if (f.pdf) return pdfCard(f);
    const { c, body } = cardShell(f.kind, "Guided notes: " + f.kind); c.classList.add("wbnotes");
    if (f.blanks) { const q = blanked(f.q, S.show); q.className = "wbq"; body.appendChild(q); } else body.appendChild(richEl("p", "wbq", f.q));
    const list = el("div", "nlines");
    f.lines.slice(0, shown).forEach((ln, i) => { const row = el("div", "nline" + (i === shown - 1 && !f.open ? " new" : "")); row.appendChild(richEl("p", "nm", ln.m)); if (ln.why) row.appendChild(richEl("p", "nw", ln.why)); list.appendChild(row); });
    body.appendChild(list);
    if (f.ans && S.show && !f.blanks) body.appendChild(richEl("p", "wbans", f.ans));
    const row = el("div", "wbcrow");
    if (!f.open && f.lines.length) row.appendChild(el("span", "ncount", shown < f.lines.length ? "Step " + shown + " of " + f.lines.length : "All " + f.lines.length + " steps"));
    row.appendChild(el("span", "wbfill"));
    const bk = el("button", "wbbtn"); bk.type = "button"; bk.textContent = "Back"; bk.onclick = () => step(-1); bk.disabled = S.screen === screenOrder()[0];
    const nx = el("button", "wbbtn amber"); nx.type = "button"; nx.textContent = stepLabel().replace(/^Next: /, "") || "Next"; nx.onclick = () => step(1);
    row.append(bk, nx); body.appendChild(row);
    return c;
}
/* PDF notes: a small card that pages through the PDF. The page itself sits on the paper under the pen (pdfLayer). */
const pdfFrame = () => { if (S.screen !== "notes") return null; const fr = notesFrames(D()); const f = fr[Math.min(S.note, fr.length - 1)]; return f && f.pdf ? f : null; };
function pdfCard(f) {
    const { c, body } = cardShell(S.show ? f.kind.replace(/ · (top|bottom)$/, "") : f.kind, "PDF notes: " + f.kind); c.classList.add("wbnotes", "wbpdf");
    const row = el("div", "wbcrow");
    const wb = el("button", "wbbtn dark"); wb.type = "button"; wb.textContent = S.show ? "Zoom in" : "Whole page"; wb.title = S.show ? "Show half the page, bigger" : "Show the whole page"; wb.onclick = () => { S.show = !S.show; push(); }; row.appendChild(wb);
    row.appendChild(el("span", "wbfill"));
    const bk = el("button", "wbbtn"); bk.type = "button"; bk.textContent = "Back"; bk.onclick = () => step(-1);
    const nx = el("button", "wbbtn amber"); nx.type = "button"; nx.textContent = stepLabel().replace(/^Next: /, "") || "Next"; nx.onclick = () => step(1);
    row.append(bk, nx); body.appendChild(row);
    return c;
}
function pdfLayer(cv) {
    const f = pdfFrame(); if (!f) return;
    const view = el("div", "pdfview"), clip = el("div", "pdfclip"), img = el("img"); img.alt = f.q + ", " + f.kind; img.draggable = false;
    clip.appendChild(img); view.appendChild(clip); cv.insertBefore(view, cv.firstChild);
    if (!signedIn) { view.appendChild(el("p", "pdfwait", "PDF notes show when you're signed in.")); return; }
    const url = pageUrl(store, f.pdf.id, f.pdf.n, () => { sig = ""; render(); });
    if (!url) { view.appendChild(el("p", "pdfwait", "Loading page " + (f.pdf.n + 1) + "…")); clip.hidden = true; }
    else if (url === "x") { view.appendChild(el("p", "pdfwait", "This page could not be loaded. Upload the PDF again on Quick lesson.")); clip.hidden = true; }
    else img.src = url;
    pageUrl(store, f.pdf.id, f.pdf.n + 1);   // the next page, ready before it is needed
    fitPdf();
}
/** Size the page to the paper: the half (or the whole page) as large as fits, centered. */
function fitPdf() {
    const f = pdfFrame(), view = document.querySelector(".pdfview"); if (!f || !view) return;
    const clip = view.querySelector(".pdfclip"), img = clip.querySelector("img"), W2 = view.clientWidth, H2 = view.clientHeight; if (W2 < 10) return;
    const ph = S.show ? f.pdf.h : f.pdf.h / 2, k = Math.min(W2 / f.pdf.w, H2 / ph), cw = f.pdf.w * k, ch = ph * k;
    clip.style.width = cw + "px"; clip.style.height = ch + "px"; clip.style.left = (W2 - cw) / 2 + "px"; clip.style.top = (H2 - ch) / 2 + "px";
    img.style.width = cw + "px"; img.style.height = f.pdf.h * k + "px"; img.style.top = (!S.show && f.pdf.half ? -ch : 0) + "px";
}
/* Put the card where it was left, kept inside the paper. */
function placeCard() {
    const c = $("wbcard"), pp = $("wbpaper"); if (!c || !pp) return;
    const W2 = pp.clientWidth, H2 = pp.clientHeight; if (W2 < 10) return;
    c.style.width = Math.max(Math.min(W2 - 16, 260), Math.round(W2 * CARD_W[S.wb.card.w])) + "px";
    const cw = c.offsetWidth, ch = c.offsetHeight;
    c.style.left = Math.round(Math.min(Math.max(0, S.wb.card.x * W2), Math.max(0, W2 - cw))) + "px";
    c.style.top = Math.round(Math.min(Math.max(0, S.wb.card.y * H2), Math.max(0, H2 - Math.min(ch, H2)))) + "px";
}
function dragCard(c, handle) {
    let st0 = null;
    handle.addEventListener("pointerdown", (e) => {
        if (e.button || e.target.closest("button")) return; e.preventDefault(); const pp = $("wbpaper"); if (!pp) return;
        try { handle.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
        st0 = { x: e.clientX, y: e.clientY, l: c.offsetLeft, t: c.offsetTop, W: pp.clientWidth, H: pp.clientHeight }; c.classList.add("dragging");
    });
    handle.addEventListener("pointermove", (e) => {
        if (!st0) return; const l = Math.min(Math.max(0, st0.l + e.clientX - st0.x), st0.W - c.offsetWidth), t = Math.min(Math.max(0, st0.t + e.clientY - st0.y), Math.max(0, st0.H - 40));
        c.style.left = l + "px"; c.style.top = t + "px";
    });
    const end = () => { if (!st0) return; const s0 = st0; st0 = null; c.classList.remove("dragging"); S.wb.card.x = Math.round(c.offsetLeft / s0.W * 1000) / 1000; S.wb.card.y = Math.round(c.offsetTop / s0.H * 1000) / 1000; push(); };
    handle.addEventListener("pointerup", end); handle.addEventListener("pointercancel", end);
}
/* Pages: more room on the same problem. Each page is its own saved drawing. */
function pagesBar() {
    const bar = el("div", "wbpages"); bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Pages");
    const n = pageCount(), cur = pageNow(), base = inkBase();
    for (let i = 0; i < n; i++) { const b = el("button", i === cur ? "on" : "", i === cur ? "Page " + (i + 1) : String(i + 1)); b.type = "button"; b.setAttribute("aria-pressed", String(i === cur)); b.setAttribute("aria-label", "Page " + (i + 1)); b.onclick = () => { S.wb.pg = { k: base, n: i }; push(); }; bar.appendChild(b); }
    if (n < 12) { const a = el("button", "add"); a.type = "button"; a.innerHTML = wbIcon("plus"); a.title = "New page"; a.setAttribute("aria-label", "New page"); a.onclick = () => { const ks = Object.keys(S.wb.pages); if (ks.length >= 40) delete S.wb.pages[ks[0]]; S.wb.pages[base] = n + 1; S.wb.pg = { k: base, n }; push(); }; bar.appendChild(a); }
    return bar;
}

/* ---------- guided notes ---------- */
// The day's notes become a list of frames. Each frame is one thing on screen: a question, lines
// that are revealed one tap at a time, and sometimes an answer. The whiteboard sits beside it.
function notesFrames(d) {
    // The teacher's own PDF notes (Quick lesson): each page is two frames, top half then bottom half.
    const pdf = cleanPdf(d && d.pdf);
    if (pdf) { const F = []; for (let i = 0; i < pdf.pages; i++) [0, 1].forEach((half) => F.push({ kind: "Page " + (i + 1) + " of " + pdf.pages + (half ? " · bottom" : " · top"), q: pdf.title, lines: [], open: true, pdf: { id: pdf.id, n: i, half, w: pdf.w, h: pdf.h } }));
        const ex = d.notes && d.notes.exit; if (ex && ex.length) F.push({ kind: "Exit ticket", q: "On your own. Show every step.", lines: ex.map((p, i) => ({ m: (i + 1) + ". " + p.q })), open: true });
        return F; }
    const n = d && d.notes; if (!n) return [];
    const F = [];
    if (n.targets && n.targets.length) F.push({ kind: "Learning targets", q: "I can…", lines: n.targets.map((t) => ({ m: t })), open: true });
    (n.warmup || []).forEach((p, i, a) => F.push({ kind: "Warm-up " + (i + 1) + " of " + a.length, q: p.q, lines: [], ans: p.a }));
    ((n.vocab && n.vocab.items) || []).forEach((v, i, a) => F.push({ kind: "Vocabulary " + (i + 1) + " of " + a.length, q: v, lines: [], ans: "fill", blanks: true }));
    if (n.bigIdea && n.bigIdea.length) F.push({ kind: "The big idea", q: n.bigIdea[0], lines: n.bigIdea.slice(1).concat(n.steps || []).map((t) => ({ m: t })) });
    (n.examples || []).forEach((e, i, a) => {
        if (e.intro && e.intro.length) F.push({ kind: "Key idea", q: e.intro[0], lines: e.intro.slice(1).map((t) => ({ m: t })) }); // a rule box that sits before this example on the paper notes
        F.push({ kind: "Example " + (i + 1) + " of " + a.length + (e.title ? ": " + e.title : ""), q: e.q, lines: e.steps || [] });
    });
    if (n.guided) F.push({ kind: "Your turn, with help", q: n.guided.q, lines: n.guided.steps || [] });
    (n.practice || []).forEach((part) => (part.problems || []).forEach((p) => F.push({ kind: (part.kind || "Practice") + " " + (p.n || ""), q: p.q, lines: p.work ? [{ m: p.work }] : [], ans: p.a })));
    if (n.exit && n.exit.length) F.push({ kind: "Exit ticket", q: "On your own. Show every step.", lines: n.exit.map((p, i) => ({ m: (i + 1) + ". " + p.q })), open: true });
    return F;
}
// A sentence with [blanks]: shown as empty lines until revealed, then the word appears.
function blanked(text, reveal) {
    const p = el("p", "nq"); String(text).split(/(\[[^\]]+\])/).forEach((part) => {
        if (/^\[.*\]$/.test(part)) { const w = part.slice(1, -1), sp = el("span", reveal ? "fill" : "blank", reveal ? w : ""); if (!reveal) sp.style.minWidth = Math.max(3, w.length * 0.62) + "em"; p.appendChild(sp); }
        else p.appendChild(rich(part));
    });
    return p;
}

/* ---------- floating tools (shown over every screen) ---------- */
const DEFAULT_POS = { pick: [34, 30], groups: [10, 24],  traffic: [2, 23], work: [10, 55], text: [48, 23], stopwatch: [72, 60], dice: [46, 60], clock: [20, 66], score: [28, 40], goal: [60, 30], ptimer: [66, 18], target: [24, 8], agenda: [4, 18], period: [66, 6] };
let topZ = 1;
let layerSig = "", dragging = false;
function posOf(k) { const p = S.tools.pos[k]; if (p) return p; const d = DEFAULT_POS[k] || [10, 30]; return { x: d[0], y: d[1], s: 1 }; }
/* The Remote's rail: layouts first, then every panel as a switch. */
function renderDock() {
    const dock = $("dock"); if (!dock) return; dock.textContent = ""; const T = S.tools;
    { const n = Object.keys(T.on).length, tc = $("toolCount"); if (tc) tc.textContent = n ? n + " on" : ""; }
    dock.appendChild(el("p", "dockh", "Layouts"));
    const sc = el("div", "rscenes"); sc.setAttribute("role", "group"); sc.setAttribute("aria-label", "Layouts");
    SCENES.filter((x) => !(x.guestless && mode === "sub")).concat(T.scenes).forEach((x) => { const on = sceneActive(S, x), b = el("button", on ? "on" : "", x.n); b.type = "button"; b.setAttribute("aria-pressed", String(on)); b.title = x.d || "Your saved layout"; b.onclick = () => applyScene(S, x, toolApi); sc.appendChild(b); });
    dock.appendChild(sc);
    [["Lesson", LESSON_PANELS], ["Classroom", TOOL_LIST]].forEach(([h, list]) => {
        dock.appendChild(el("p", "dockh", h));
        list.filter(([k]) => panelOk(k)).forEach(([k, label]) => {
            // An on/off slider for each panel (Eddie, 2026-11-20: "toggle on and off sliders").
            const b = el("button", "psw"); b.type = "button"; b.setAttribute("aria-pressed", String(!!T.on[k])); b.appendChild(el("span", "pswl", label));
            if (T.on[k] && T.min[k]) { b.appendChild(el("small", "dmin", "small")); b.title = "Show it again"; }
            b.appendChild(el("i", "swk"));
            b.onclick = () => { panelToggle(T, k); push(); }; dock.appendChild(b);
        });
    });
    const more = el("button", "more"); more.type = "button"; more.innerHTML = pIcon("layout") + "<span>All panels and layouts</span>"; more.onclick = () => openSheet(toolApi); dock.appendChild(more);
    if (mode === "remote" && !studio) { const bb = el("a", "more bbuild"); bb.href = "studio.html"; bb.innerHTML = pIcon("float") + "<span>Board Builder</span>"; bb.title = "Look, panels, stickers and the lesson, in one place"; dock.appendChild(bb); }
    if (Object.keys(T.on).length) { const c = el("button", "clear", "Hide all"); c.type = "button"; c.onclick = () => { T.on = {}; T.min = {}; T.pos = {}; T.order = []; push(); }; dock.appendChild(c); }
}
/* "Edit this day": opens Quick lesson on the class and day showing, for the agenda, bellringer, target, supplies and reminders. */
function renderEditLink() {
    const sc = $("screens"); if (!sc || mode !== "remote") return;
    let a = $("editDay"); if (!a) { a = el("a", "btn editday"); a.id = "editDay"; a.target = "_blank"; a.rel = "noopener"; a.title = "Agenda, bellringer, learning target, supplies, reminders and exit ticket"; ($("scrMore") || sc).after(a); }
    const w = W(), dk = DK[S.day] || "Mon", q = new URLSearchParams({ day: dk.toLowerCase() });
    if (w.monday) q.set("monday", w.monday); if (S.cls) q.set("class", S.cls);
    const href = "lesson.html?" + q;
    if (a.getAttribute("href") !== href) { a.href = href; a.textContent = "Edit " + dk + " lesson"; }
}
/* The Remote's "Board look" fold: colours and background, right under Panels. */
let lookSig = "";
function renderLookFold() {
    const tm = $("toolsMenu"); if (!tm) return;
    let f = $("lookMenu"); if (!f) { f = el("details", "menu fold"); f.id = "lookMenu"; f.open = window.innerWidth > 860; const sm = el("summary", null, "Board look "); const c = el("span", "count"); c.id = "lookCount"; sm.appendChild(c); f.appendChild(sm); f.appendChild(el("div", "lookhost")); tm.after(f); }
    const k = S.look.theme + "|" + S.look.bg + "|" + S.look.mark + "|" + S.look.fx; if (k === lookSig) return; lookSig = k;
    const host = f.querySelector(".lookhost"); host.textContent = ""; host.appendChild(lookPicker(toolApi, true));
}
/* Stickers (js/stickers.js): drawn on every page; only the Board Builder lets them be picked up. */
function drawStickers() {
    if (stickerBusy) return;
    renderStickers($("stickerLayer"), S.stickers, studio ? { edit: true, sel: studio.selected ? studio.selected() : "", onSelect: (id) => studio.pick && studio.pick("sticker", id),
        onChange: (list) => { S.stickers = cleanStickers(list); push(); }, busy: (b) => { stickerBusy = b; } } : null);
}
/* One small icon button in a panel's title bar. */
function hbtn(ic, label, fn, cls) { const b = el("button", "close pbtn" + (cls ? " " + cls : "")); b.type = "button"; b.innerHTML = pIcon(ic); b.title = label; b.setAttribute("aria-label", label); b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; }
const inside = (r, e) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
/** Where a panel dropped on the shelf goes: before the first docked panel whose middle is below the pointer. */
function shelfSlot(shelf, y, skip) { for (const c of shelf.querySelectorAll(".docked")) { if (c === skip) continue; const r = c.getBoundingClientRect(); if (y < r.top + r.height / 2) return c; } return shelf.querySelector(".ptray"); }
let placed = {};   // where each panel was last drawn, so only a panel that just arrived animates in
function renderLayer() {
    const layer = $("toolLayer"); if (!layer || dragging) return;
    const ns = toolSig(); if (ns === layerSig) return; layerSig = ns;
    const typingId = document.activeElement && ["toolMsgIn", "toolGoalIn"].includes(document.activeElement.id) ? document.activeElement.id : "", typing = !!typingId, caret = typing ? document.activeElement.selectionStart : 0;
    layer.textContent = ""; const shelf = shelfEl(), docked = shelfKeys(), chips = chipKeys(), canDock = !narrowWrap(), stage = $("stage"); shelf.textContent = "";
    const T = S.tools, minimize = (k) => { T.min[k] = true; push(); }, now2 = {};
    docked.forEach((k) => {   // on the shelf: beside the lesson, never over it
        const w = buildPanel(k, toolApi), h = w.querySelector("h3"); w.classList.add("docked"); w.dataset.panel = k; now2[k] = "dock";
        const tail = el("span", "hbtns");
        tail.append(hbtn("min", "Minimize " + labelOf(k), () => minimize(k)), hbtn("float", "Float over the lesson", () => { T.pos[k] = toolApi.defaultPos(k); push(); }, "pop"), hbtn("x", "Close " + labelOf(k), () => { panelOff(T, k); push(); }));
        h.appendChild(tail); if (placed[k] !== "dock") w.classList.add("enter"); shelf.appendChild(w);
        // Drag a shelf panel up or down to reorder it, or out onto the lesson to float it there.
        h.addEventListener("pointerdown", (e) => {
            if (e.button || e.target.closest("button")) return; e.preventDefault();
            const sx = e.clientX, sy = e.clientY, r0 = w.getBoundingClientRect(); let lifted = false, ph = null;
            const move = (ev) => {
                if (!lifted) {
                    if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
                    lifted = true; dragging = true; ph = el("div", "pholder"); ph.style.height = r0.height + "px"; w.after(ph);
                    w.style.fontSize = getComputedStyle(shelf).fontSize; w.style.width = r0.width + "px"; w.classList.add("lifting"); document.body.appendChild(w);
                }
                w.style.left = (r0.left + ev.clientX - sx) + "px"; w.style.top = (r0.top + ev.clientY - sy) + "px";
                const over = inside(shelf.getBoundingClientRect(), ev); shelf.classList.toggle("dropok", over); stage.classList.toggle("floatok", !over);
                if (over) { const at = shelfSlot(shelf, ev.clientY, null); if (at) shelf.insertBefore(ph, at); else shelf.appendChild(ph); }
            };
            const end = (ev) => {
                window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
                if (!lifted) return; dragging = false; shelf.classList.remove("dropok"); stage.classList.remove("floatok");
                if (ev.type !== "pointercancel" && inside(shelf.getBoundingClientRect(), ev)) {
                    const keys = []; Array.from(shelf.children).forEach((c) => { if (c === ph) keys.push(k); else if (c.dataset && c.dataset.panel) keys.push(c.dataset.panel); });
                    T.order = keys.concat(T.order.filter((x) => !keys.includes(x)));
                } else if (ev.type !== "pointercancel") {
                    const sr = stage.getBoundingClientRect(), wr = w.getBoundingClientRect();
                    T.pos[k] = { x: Math.round(Math.min(95, Math.max(0, (wr.left - sr.left) / sr.width * 100)) * 10) / 10, y: Math.round(Math.min(92, Math.max(0, (wr.top - sr.top) / sr.height * 100)) * 10) / 10, s: 1 };
                }
                w.remove(); if (ph) ph.remove(); layerSig = ""; push();
            };
            window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
        });
    });
    if (chips.length) {   // minimized: a live chip each, still counting
        const tray = el("div", "ptray"); tray.setAttribute("role", "group"); tray.setAttribute("aria-label", "Minimized panels");
        chips.forEach((k) => { const c = chip(k, toolApi, () => { delete T.min[k]; push(); }); now2[k] = "chip"; if (placed[k] !== "chip") c.classList.add("enter"); tray.appendChild(c); });
        (canDock ? shelf : layer).appendChild(tray);
    }
    PANEL_KEYS.forEach((k) => {
        if (!T.on[k] || T.min[k] || docked.includes(k) || !panelOk(k)) return;
        const w = buildPanel(k, toolApi), p = posOf(k); w.classList.add("float"); w.dataset.panel = k; now2[k] = "float"; if (placed[k] !== "float") w.classList.add("enter");
        if (studio && pickedPanel === k) w.classList.add("picked");
        w.style.left = p.x + "%"; w.style.top = p.y + "%"; w.style.fontSize = p.s + "em";
        const h = w.querySelector("h3"), tail = el("span", "hbtns");
        tail.appendChild(hbtn("min", "Minimize " + labelOf(k), () => minimize(k)));
        if (canDock && k !== "groups") tail.appendChild(hbtn("dock", "Put it back on the shelf", () => { delete T.pos[k]; panelOn(T, k, { dock: true }); push(); }, "pop"));
        tail.appendChild(hbtn("x", "Close " + labelOf(k), () => { panelOff(T, k); push(); }));
        h.appendChild(tail);
        const grips = ["nw", "ne", "sw", "se"].map((c) => { const g = el("span", "grip g-" + c); g.dataset.c = c; g.setAttribute("aria-hidden", "true"); w.appendChild(g); return g; });
        const start = (e, kind) => {
            if (e.target.closest && e.target.closest("button")) return; e.preventDefault(); dragging = true; w.classList.add("moving");
            const r = stage.getBoundingClientRect(), p0 = Object.assign({}, posOf(k)), sx = e.clientX, sy = e.clientY, b0 = w.getBoundingClientRect(), w0 = b0.width, h0 = b0.height; let cur = Object.assign({}, p0), dock = false;
            // Board Builder: the panel snaps to a 2.5% grid (shown while dragging) and lines up with the other panels' edges
            const snap = studio && kind === "move" && !e.altKey, others = snap ? Array.from(layer.querySelectorAll(".float")).filter((o) => o !== w).map((o) => { const q = o.getBoundingClientRect(); return { l: (q.left - r.left) / r.width * 100, t: (q.top - r.top) / r.height * 100, r: (q.right - r.left) / r.width * 100, b: (q.bottom - r.top) / r.height * 100 }; }) : [];
            const fw = w0 / r.width * 100, fh = h0 / r.height * 100;
            const snapTo = (v, size, lo, hi) => { let best = null; lo.concat(hi.map((x) => x - size)).forEach((t) => { if (Math.abs(t - v) < 1.2 && (best == null || Math.abs(t - v) < Math.abs(best - v))) best = t; }); return best != null ? best : Math.round(v / 2.5) * 2.5; };
            if (snap) stage.classList.add("snapgrid");
            const corner = kind === "size" ? (e.currentTarget.dataset.c || "se") : "", gx = corner.includes("w") ? -1 : 1, gy = corner.includes("n") ? -1 : 1;
            const move = (ev) => {
                if (kind === "move") {
                    cur.x = Math.min(95, Math.max(0, p0.x + (ev.clientX - sx) / r.width * 100)); cur.y = Math.min(92, Math.max(0, p0.y + (ev.clientY - sy) / r.height * 100));
                    if (snap) { cur.x = Math.min(100 - fw, Math.max(0, snapTo(cur.x, fw, others.map((o) => o.l).concat(others.map((o) => o.r)), others.map((o) => o.r).concat(others.map((o) => o.l), [100])))); cur.y = Math.min(100 - fh, Math.max(0, snapTo(cur.y, fh, others.map((o) => o.t).concat(others.map((o) => o.b)), others.map((o) => o.b).concat(others.map((o) => o.t), [100])))); cur.x = Math.max(0, Math.min(95, cur.x)); cur.y = Math.max(0, Math.min(92, cur.y)); }
                    w.style.left = cur.x + "%"; w.style.top = cur.y + "%";
                    dock = canDock && k !== "groups" && !shelf.hidden && inside(shelf.getBoundingClientRect(), ev); shelf.classList.toggle("dropok", dock);
                } else {   // any corner: grow away from the opposite corner, which stays put
                    const dx = (ev.clientX - sx) * gx, dy = (ev.clientY - sy) * gy * (w0 / Math.max(1, h0)), d = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
                    cur.s = Math.min(3, Math.max(0.5, p0.s * (w0 + d) / w0)); const k2 = cur.s / p0.s;
                    cur.x = gx < 0 ? Math.max(0, p0.x + (w0 - w0 * k2) / r.width * 100) : p0.x; cur.y = gy < 0 ? Math.max(0, p0.y + (h0 - h0 * k2) / r.height * 100) : p0.y;
                    w.style.fontSize = cur.s + "em"; w.style.left = cur.x + "%"; w.style.top = cur.y + "%";
                }
            };
            const end = (ev) => {
                window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); dragging = false; w.classList.remove("moving"); shelf.classList.remove("dropok"); stage.classList.remove("snapgrid");
                if (dock && ev.type !== "pointercancel") {   // dropped on the shelf: dock it at that spot
                    delete T.pos[k]; const at = shelfSlot(shelf, ev.clientY, null), keys = Array.from(shelf.querySelectorAll(".docked")).map((c) => c.dataset.panel), i = at && at.dataset.panel ? keys.indexOf(at.dataset.panel) : keys.length;
                    keys.splice(i < 0 ? keys.length : i, 0, k); T.order = keys.concat(T.order.filter((x) => !keys.includes(x))); layerSig = ""; push(); return;
                }
                T.pos[k] = { x: Math.round(cur.x * 10) / 10, y: Math.round(cur.y * 10) / 10, s: Math.round(cur.s * 100) / 100 }; layerSig = toolSig(); if (writeState) writeState(JSON.parse(JSON.stringify(S)));
            };
            window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
        };
        h.addEventListener("pointerdown", (e) => start(e, "move")); grips.forEach((g) => g.addEventListener("pointerdown", (e) => start(e, "size")));
        w.addEventListener("pointerdown", () => { w.style.zIndex = String(++topZ); if (studio && studio.pick) studio.pick("panel", k); });
        layer.appendChild(w);
    });
    placed = now2;
    if (typing) { const t = $(typingId); if (t) { t.focus(); try { t.setSelectionRange(caret, caret); } catch (e) { /* ok */ } } }
    tickTools(toolApi); tickPanels(toolApi);
    if ((shelfEm() + "|" + narrowWrap()) !== shelfApplied) fit();   // the shelf appeared, went away or changed width
    fitShelf();
}
/* The board cannot scroll, so a full shelf shrinks its tools to fit instead of cutting one off. */
function fitShelf() {
    const sh = shelfEl(); if (sh.hidden) return; const base = parseFloat($("stage").style.fontSize) || 12;
    sh.style.fontSize = base + "px";
    if (sh.scrollHeight > sh.clientHeight + 2) sh.style.fontSize = Math.max(base * 0.6, base * sh.clientHeight / sh.scrollHeight * 0.98) + "px";
}

/* ---------- whiteboard ink ---------- */
let canvas = null, ctx = null, strokes = [], cur = null, pen = "ink", size = 1, paper = "", inkKey = "", inkUnsub = null, inkWrite = null, clearArm = 0;
let pad = null, hist = [], padItems = [];   // pad: the math tools under the ink (js/mathPad.js); hist: undo copies; padItems: the tools, kept while the screen redraws
const PAPERS = [["", "Plain"], ["grid", "Grid"], ["dots", "Dots"], ["lines", "Lines"]];
/* The whiteboard: math tools on a canvas underneath, ink on top. */
function makeCv() {
    const cv = el("div", "cv" + (paper ? " p-" + paper : "")); cv.id = "cv"; canvas = el("canvas"); cv.appendChild(canvas);
    pad = createMathPad(cv, canvas, { change: snap, commit: saveInk, onMode: () => retool() });
    pad.setItems(padItems); cv.appendChild(rail()); const n = el("p", "inknote"); n.id = "inknote"; n.setAttribute("role", "status"); cv.appendChild(n); return cv;
}
function snap() { hist.push(JSON.stringify({ strokes, items: pad ? pad.items() : padItems })); if (hist.length > 60) hist.shift(); }
function undo() {
    const last = hist.pop(); if (!last) return; const d = JSON.parse(last);
    strokes = d.strokes || []; padItems = d.items || []; if (pad) pad.setItems(padItems); redraw(); saveInk();
}
function setPaper(p) { paper = p; const cv = $("cv"); if (cv) { PAPERS.forEach(([k]) => { if (k) cv.classList.remove("p-" + k); }); if (p) cv.classList.add("p-" + p); } }
const PENS = { ink: "--pen-ink", blue: "--pen-blue", red: "--pen-red", green: "--pen-green" }, SIZES = [3, 6, 11];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
/* The tool rail floats on the left of the paper: pen, highlighter, eraser, move; four inks and a size;
   then math tools, undo, paper and clear. Icons only, with names for screen readers and on hover. */
let tool = "pen";   // "pen", "hi" (highlighter) or "eraser"
function rail() {
    const t = el("div", "wbrail"); t.id = "tools"; t.setAttribute("role", "toolbar"); t.setAttribute("aria-label", "Whiteboard tools");
    const moving = !!(pad && pad.on);
    const b = (name, label, on, fn, cls) => { const x = el("button", "rb" + (cls ? " " + cls : "")); x.type = "button"; x.innerHTML = wbIcon(name); x.title = label; x.setAttribute("aria-label", label); if (on != null) x.setAttribute("aria-pressed", String(on)); x.onclick = fn; t.appendChild(x); return x; };
    const pick = (k) => () => { tool = k; if (pad) pad.setOn(false); retool(); };
    b("pen", "Pen", !moving && tool === "pen", pick("pen"));
    b("hi", "Highlighter", !moving && tool === "hi", pick("hi"));
    b("eraser", "Eraser", !moving && tool === "eraser", pick("eraser"));
    b("move", "Move the math tools", moving, () => { if (pad) pad.setOn(!pad.on); retool(); });
    t.appendChild(el("i", "rsep"));
    const sw = el("div", "rsw");
    Object.keys(PENS).forEach((k) => { const x = el("button", "sw"); x.type = "button"; x.style.background = css(PENS[k]); x.title = k === "ink" ? "Navy ink" : k[0].toUpperCase() + k.slice(1) + " ink"; x.setAttribute("aria-label", x.title); x.setAttribute("aria-pressed", String(pen === k)); x.onclick = () => { pen = k; if (tool === "eraser") tool = "pen"; if (pad) pad.setOn(false); retool(); }; sw.appendChild(x); });
    t.appendChild(sw);
    const sz = el("button", "rb size"); sz.type = "button"; sz.title = ["Thin", "Medium", "Thick"][size] + " line (tap to change)"; sz.setAttribute("aria-label", sz.title);
    const dot = el("i"); dot.style.width = dot.style.height = [0.35, 0.6, 0.9][size] + "em"; dot.style.background = tool === "hi" ? "#F2B33D" : pen === "ink" ? "#F4F7FB" : css(PENS[pen]); sz.appendChild(dot); sz.onclick = () => { size = (size + 1) % 3; retool(); }; t.appendChild(sz);
    t.appendChild(el("i", "rsep"));
    b("math", "Add a math tool", null, () => { if (pad) pad.openMenu(); }, "amber");
    b("undo", "Undo", null, undo);
    const pi = Math.max(0, PAPERS.findIndex((x) => x[0] === paper));
    b("paper", "Paper: " + PAPERS[pi][1] + " (tap for " + PAPERS[(pi + 1) % PAPERS.length][1].toLowerCase() + ")", null, () => { setPaper(PAPERS[(pi + 1) % PAPERS.length][0]); saveInk(); retool(); });
    const cl = b("trash", Date.now() - clearArm < 3000 ? "Tap again to clear this page" : "Clear this page", null, () => {
        if (Date.now() - clearArm < 3000) { snap(); strokes = []; padItems = []; if (pad) pad.clear(); redraw(); saveInk(); clearArm = 0; retool(); }
        else { clearArm = Date.now(); retool(); setTimeout(() => { if (Date.now() - clearArm >= 2900) retool(); }, 3000); }
    }, Date.now() - clearArm < 3000 ? "armed" : "");
    void cl; return t;
}
function retool() { const old = $("tools"); if (old) old.parentNode.replaceChild(rail(), old); }
function sizeCanvas() { fitPdf(); if (!canvas) return; const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); if (r.width < 2) return; canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); ctx = canvas.getContext("2d"); redraw(); if (pad) pad.resize(); }
function drawStroke(s) {
    if (!ctx || !s.p || s.p.length < 2) return; const Wd = canvas.width, H = canvas.height, p = s.p;
    ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over"; ctx.strokeStyle = s.h && (s.c === "ink" || !PENS[s.c]) ? "#F2B33D" : (css(PENS[s.c] || PENS.ink) || "#14213D");
    ctx.globalAlpha = s.h ? 0.38 : 1;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = (s.e ? 5 : s.h ? 3.4 : 1) * (SIZES[s.w] || 6) * Wd / 1400;
    ctx.beginPath(); ctx.moveTo(p[0] / 10000 * Wd, p[1] / 10000 * H); if (p.length === 2) ctx.lineTo(p[0] / 10000 * Wd + 0.1, p[1] / 10000 * H);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] / 10000 * Wd, p[i + 1] / 10000 * H);
    ctx.stroke(); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
}
function redraw() { if (!ctx || !canvas) return; ctx.clearRect(0, 0, canvas.width, canvas.height); strokes.forEach(drawStroke); if (cur) drawStroke(cur); }
function pt(e) { const r = canvas.getBoundingClientRect(); return [Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 10000), Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 10000)]; }
function bindCanvas() {
    canvas.addEventListener("pointerdown", (e) => { if (e.button || (pad && pad.on)) return; e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } const p = pt(e); cur = { c: pen, w: size, e: tool === "eraser" ? 1 : 0, p: [p[0], p[1]] }; if (tool === "hi") cur.h = 1; redraw(); });
    canvas.addEventListener("pointermove", (e) => { if (!cur) return; const p = pt(e), a = cur.p, n = a.length; if (Math.abs(p[0] - a[n - 2]) + Math.abs(p[1] - a[n - 1]) < 14) return; a.push(p[0], p[1]); redraw(); });
    const end = () => { if (!cur) return; snap(); strokes.push(cur); cur = null; redraw(); saveInk(); };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
}
function note(t) { const n = $("inknote"); if (n) n.textContent = t; }
function saveInk() {
    if (pad) padItems = pad.items();
    if (!inkWrite) return; const body = { strokes, items: padItems, paper, at: Date.now() };
    if (canvas && canvas.width > 2 && canvas.height > 2) body.ar = +(canvas.width / canvas.height).toFixed(3);   // the page's shape, so a copy of it (Vault Raid's Send it back) isn't stretched
    if (JSON.stringify(body).length > 700000) { note("This board is full. Clear it to keep saving."); return; }
    note(""); inkWrite(JSON.parse(JSON.stringify(body)));
}
function inkBase() { return [S.week, S.period, "d" + S.day, S.screen === "deck" ? "s" + (((deckNow() || {}).s || {}).id || "none") : S.screen === "notes" ? "n" + S.note + (S.show && pdfFrame() ? "w" : "") : S.screen === "fix" ? "fix" + ((fixCur() || {}).n || 0) : S.screen === "live" ? (liveReview() || { key: "live" }).key : ((S.screen === "bell" && D()) ? "p" + S.prob : "blank")].join("_"); }
function pageCount() { return S.wb.pages[inkBase()] || 1; }
function pageNow() { const b = inkBase(); return S.wb.pg.k === b ? Math.min(S.wb.pg.n, pageCount() - 1) : 0; }
function watchInk() {
    const key = canvas ? inkBase() + (pageNow() ? "_pg" + pageNow() : "") : "";
    if (key === inkKey) return; inkKey = key; if (inkUnsub) { inkUnsub(); inkUnsub = null; } inkWrite = null; strokes = []; cur = null; hist = []; padItems = []; if (pad) pad.setItems([]); redraw();
    if (!key || !signedIn) return;
    inkWrite = writer("ink/" + key);
    inkUnsub = store.watch("ink/" + key, (sn) => {
        if (key !== inkKey || sn.pending || cur || (inkWrite && inkWrite.busy()) || (pad && pad.busy())) return; const dd = sn.exists && sn.data;
        strokes = dd && Array.isArray(dd.strokes) ? JSON.parse(JSON.stringify(dd.strokes)) : [];
        padItems = dd && Array.isArray(dd.items) ? JSON.parse(JSON.stringify(dd.items)) : []; if (pad) pad.setItems(padItems);
        const pp = dd && PAPERS.some((x) => x[0] === dd.paper) ? dd.paper : ""; if (pp !== paper) { setPaper(pp); retool(); }
        redraw(); }, () => note("Saved drawings are not available right now."));
}

/* ---------- Fix It Together: the speed dating error review ----------
   After speed dating, students name the cards that tripped people up. The teacher picks each card
   on the Remote, it shows on the board beside a whiteboard, and the class works it out together.
   Card problems come from the week saved in Week Builder (private, never in this public repo).
   An answer or a common mistake reaches the board only when the teacher taps to reveal it. */
const sdWeeks = {}, sdWatched = {};
function sdSet() {
    if (!store || !signedIn) return null;
    const id = S.week;
    if (!sdWatched[id]) {
        sdWatched[id] = true;
        store.watch("weekfiles/" + id, (snap) => {
            if (snap.pending) return; let w = null;
            try { if (snap.exists && snap.data && snap.data.json) w = JSON.parse(snap.data.json); } catch (e) { /* a damaged copy: type the problem instead */ }
            sdWeeks[id] = w; if (S.screen === "fix") { sig = ""; render(); }
        }, () => { sdWeeks[id] = null; });
    }
    const w = sdWeeks[id], c = w && w.classes && w.classes[S.cls], sd = c && c.speedDating;
    if (sd && Array.isArray(sd.cards) && sd.cards.length) return sd;
    // Fallback: the card problems published with the week (student-facing, no answers).
    const sp = (L() || {}).speed;
    return sp && Array.isArray(sp.cards) && sp.cards.length ? { title: sp.cardsTitle || "", cards: sp.cards } : null;
}
const fixKey = () => S.week + "|" + S.period + "|" + S.day;
const str = (x, n) => (typeof x === "string" ? x : "").slice(0, n);
function cleanFix(f) {
    if (!f || typeof f !== "object" || typeof f.key !== "string") return null;
    const list = (Array.isArray(f.list) ? f.list : []).slice(0, 40).map((x) => ({ n: Math.max(1, Math.min(99, Math.floor(+(x && x.n) || 1))), q: str(x && x.q, 400), done: !!(x && x.done) }));
    return { key: f.key, list, cur: Math.max(0, Math.min(list.length - 1, Math.floor(+f.cur || 0))), ans: str(f.ans, 200), err: (Array.isArray(f.err) ? f.err : []).slice(0, 4).map((e) => str(e, 200)) };
}
function fixState() { if (!S.fix || S.fix.key !== fixKey()) S.fix = { key: fixKey(), list: [], cur: 0, ans: "", err: [] }; return S.fix; }
function fixCur() { const f = S.fix && S.fix.key === fixKey() ? S.fix : null; return f && f.list[f.cur]; }
function fixGo(i) { const f = fixState(); f.cur = i; f.ans = ""; f.err = []; push(); }
function fixAdd(n, q) {
    const f = fixState(), at = f.list.findIndex((x) => x.n === n);
    if (at >= 0) { if (q) f.list[at].q = q; fixGo(at); return; }
    f.list.push({ n, q: q || "", done: false }); fixGo(f.list.length - 1);
}
/* Fix It on the canvas-first whiteboard: the tricky card floats on the paper like the guided notes. */
function fixCard() {
    const f = fixState(), c = f.list[f.cur], sd = sdSet();   // Eddie: the picker shows on every screen, the board too
    const { c: card, body } = cardShell(c ? "Card #" + c.n + " \u00b7 tricky card " + (f.cur + 1) + " of " + f.list.length : "Fix It", "Fix it card"); card.classList.add("wbfix");
    body.appendChild(fixPicker(f, sd));
    if (c) {
        body.appendChild(c.q ? richEl("p", "wbq", c.q) : el("p", "wbq fixnoq", "Card #" + c.n));
        if (f.err.length) { const w = el("div", "fixerr"); w.appendChild(el("p", "fixerrh", "Watch out: common mistakes")); f.err.forEach((t) => w.appendChild(richEl("p", null, t))); body.appendChild(w); }
        if (f.ans) body.appendChild(richEl("p", "wbans", f.ans));
        body.appendChild(fixReveal(f, c, sd));
    } else {
        const e = el("div", "fixempty");
        e.appendChild(el("p", "wbq", "Which card tripped you up?"));
        e.appendChild(el("p", null, "Check the Errors box on your card. Tell us the card number and the most common mistake."));
        body.appendChild(e);
    }
    return card;
}
/* Remote only: pick a card, or type one when the week's cards are not saved in Week Builder. */
// A dropdown cannot stack fractions: {3/4} becomes 3/4, and {{3/4}/{1/2}} becomes (3/4)/(1/2).
function flatFrac(t) {
    let i = 0; const atom = (x) => (/^[\w.−-]+$/.test(x) ? x : "(" + x + ")");
    const parse = (stop) => { let out = ""; while (i < t.length && !(stop && stop.includes(t[i]))) { if (t[i] === "{") { const save = i++; const a = parse("/}").trim(); if (t[i] === "/") { i++; const b = parse("}").trim(); if (t[i] === "}") { i++; const nested = !!stop; out += (/\d$/.test(out) ? " " : "") + (nested && /\d \d/.test(a + b) ? "(" + atom(a) + "/" + atom(b) + ")" : atom(a) + "/" + atom(b)); continue; } } i = save + 1; out += "{"; continue; } out += t[i++]; } return out; };
    return parse("");
}
function fixPicker(f, sd) {
    const box = el("div", "fixctl"), row = el("div", "fixrow"), sel = el("select"), cards = sd ? sd.cards : null, n = cards ? cards.length : 40;
    sel.setAttribute("aria-label", "Pick a card");
    const o0 = el("option", null, "Pick a tricky card\u2026"); o0.value = ""; sel.appendChild(o0);
    for (let i = 1; i <= n; i++) {
        const q = cards && cards[i - 1] && cards[i - 1].q ? flatFrac(String(cards[i - 1].q)).replace(/\s+/g, " ") : "", o = el("option", null, "#" + i + (q ? "  " + (q.length > 70 ? q.slice(0, 68) + "\u2026" : q) : "") + (f.list.some((x) => x.n === i) ? "  (on the list)" : ""));
        o.value = String(i); sel.appendChild(o);
    }
    row.appendChild(sel);
    if (cards) sel.onchange = () => { const i = +sel.value; if (i) fixAdd(i, String((cards[i - 1] && cards[i - 1].q) || "")); };
    else {
        const t = el("input"); t.type = "text"; t.placeholder = "Type the problem on the card"; t.id = "fixType"; t.setAttribute("aria-label", "Problem on the card");
        const add = el("button", null, "Show it"); add.type = "button";
        const go = () => { const i = +sel.value; if (!i) { sel.focus(); return; } fixAdd(i, t.value.trim()); };
        add.onclick = go; t.onkeydown = (e) => { if (e.key === "Enter") go(); };
        row.appendChild(t); row.appendChild(add);
    }
    box.appendChild(row);
    if (!cards) box.appendChild(el("p", "fixhint", "Save this week in Week Builder and the card problems show up in this list."));
    return box;
}
function fixReveal(f, c, sd) {
    const box = el("div", "fixctl fixbtns"), card = sd && sd.cards[c.n - 1];
    const btn = (label, on, fn, cls) => { const b = el("button", cls || null, label); b.type = "button"; b.setAttribute("aria-pressed", String(!!on)); b.onclick = fn; box.appendChild(b); };
    const wrong = card && Array.isArray(card.wrong) ? card.wrong.filter((w) => w && w.a) : [];
    // Handlers read the state fresh: a synced copy can replace S.fix without a redraw.
    if (wrong.length) btn(f.err.length ? "Hide mistakes" : "Show common mistakes", f.err.length, () => { const f = fixState(); f.err = f.err.length ? [] : wrong.slice(0, 3).map((w) => String(w.a) + (w.why ? ": " + w.why : "")); push(); });
    if (card && card.a) btn(f.ans ? "Hide answer" : "Show answer", f.ans, () => { const f = fixState(); f.ans = f.ans ? "" : String(card.a); push(); });
    btn(c.done ? "Fixed \u2713" : "Mark fixed", c.done, () => { const f = fixState(), c = f.list[f.cur]; if (!c) return; c.done = !c.done; if (c.done && f.cur < f.list.length - 1) { fixGo(f.cur + 1); return; } push(); }, "fixdone");
    btn("Remove", false, () => { const f = fixState(); f.list.splice(f.cur, 1); fixGo(Math.max(0, Math.min(f.cur, f.list.length - 1))); }, "alt");
    return box;
}

/* ---------- shared state ---------- */
function applyState(d) {
    if (!d) return;
    ["week", "cls", "screen"].forEach((k) => { if (typeof d[k] === "string") S[k] = d[k]; });
    // A private week (Quick lesson, Week Review) may not have loaded yet: show the default week for now and switch once it arrives.
    if (!WEEKS.some((w) => w.id === S.week)) { lateWeek = typeof d.week === "string" ? d.week : ""; S.week = defaultWeek(); } else lateWeek = "";
    if (typeof d.period === "string" && PERIODS.some((p) => p[0] === d.period)) { S.period = d.period; S.cls = classOf(d.period); }
    else { const m = PERIODS.find((p) => p[1] === S.cls); if (m && classOf(S.period) !== S.cls) S.period = m[0]; }
    if (!W().classes[S.cls]) { S.cls = Object.keys(W().classes)[0]; const m = PERIODS.find((p) => p[1] === S.cls); if (m) S.period = m[0]; }
    if (!SCREENS.some((x) => x[0] === S.screen)) S.screen = "today";
    if (typeof d.day === "number" && d.day >= 0 && d.day < 5) S.day = d.day;
    if (typeof d.prob === "number") S.prob = d.prob; S.show = !!d.show;
    S.note = Math.max(0, Math.floor(+d.note || 0)); S.step = Math.max(0, Math.floor(+d.step || 0));
    S.slide = Math.max(0, Math.min(60, Math.floor(+d.slide || 0))); S.sstep = Math.max(0, Math.min(30, Math.floor(+d.sstep || 0)));
    { const m = mergeTools(d.tools); Object.keys(S.tools).forEach((k) => delete S.tools[k]); Object.assign(S.tools, m); } // keep the same object: widgets hold a reference to it
    S.speedMode = d.speedMode === "check" ? "check" : "round";
    S.fix = cleanFix(d.fix);
    S.wb = cleanWb(d.wb);
    S.look = cleanLook(d.look);
    S.stickers = cleanStickers(d.stickers);
    lessonKey = lessonKeyNow();   // a lesson another device moved to already came with its board
    S.bplan = cleanBplan(d.bplan);
    S.seatView = cleanView(d.seatView);
    S.seatHi = d.seatHi && typeof d.seatHi.n === "string" && typeof d.seatHi.at === "number" ? { n: d.seatHi.n.slice(0, 60), at: d.seatHi.at } : null;
    S.walk = d.walk && typeof d.walk.id === "string" ? { id: d.walk.id.slice(0, 40), step: Math.max(0, Math.min(40, Math.floor(+d.walk.step || 0))) } : { id: "", step: 0 };
    { const o = d.sound || {}, v = (x, def) => (typeof x === "number" && x >= 0 && x <= 1 ? x : def);
        S.sound = { fx: o.fx !== false, fxv: v(o.fxv, 0.7), music: !!o.music, mv: v(o.mv, 0.35), style: snd.STYLES.some((x) => x[0] === o.style) ? o.style : "focus", at: typeof o.at === "string" ? o.at.slice(0, 20) : "", game: o.game !== false }; }
    ["bell", "round", "check", "free"].forEach((k) => { const t = d.timers && d.timers[k]; if (t) { S.timers[k] = { running: !!t.running, t0: +t.t0 || 0, elapsed: +t.elapsed || 0 }; if (k === "free") S.timers.free.dur = +t.dur || 300; } });
}
/* One-tap lesson flow: Weekly Agenda -> Today -> each bellringer problem and its answer -> the day's activity. */
function isSpeedDay() { const d = D(); return !!d && /speed dating/i.test((d.agendaLine || "") + " " + (d.agenda || []).join(" ")); }
function flow(n) {
    if (S.screen === "game") { gameFlow(n); return; }
    if (S.screen === "deck") {   // Next shows the next piece set to appear, then the next slide; past either end, the screen changes
        const dn = deckNow(); if (!dn) return;
        const steps = revealSteps(dn.s), at = Math.min(S.sstep, steps);
        if (n > 0) { if (at < steps) S.sstep = at + 1; else if (dn.i < dn.list.length - 1) { S.slide = dn.i + 1; S.sstep = 0; } else return; }
        else { if (at > 0) S.sstep = at - 1; else if (dn.i > 0) { S.slide = dn.i - 1; S.sstep = revealSteps(dn.list[dn.i - 1]); } else return; }
        push(); return;
    }
    if (S.screen === "steps") {   // Next and Back step through the walkthrough; past either end, the screen changes
        if (stepPlayer && stepFor === S.walk.id) { const j = S.walk.step + n; if (j >= 0 && j < stepPlayer.count) { S.walk.step = j; push(); } }
        return;
    }
    const d = D(), len = (d && d.problems && d.problems.length) || 0, frames = notesFrames(d), hasNotes = frames.length > 0;
    const afterBell = () => { if (hasNotes) { S.screen = "notes"; S.note = 0; S.step = 0; S.show = false; } else if (isSpeedDay()) { S.screen = "speed"; S.show = false; } else return false; return true; };
    if (n > 0) {
        if (S.screen === "agenda") S.screen = "today";
        else if (S.screen === "today") { if (slHas()) slEnter(1); else if (len) { S.screen = "bell"; S.prob = 0; S.show = false; } else if (hasNotes || isSpeedDay()) afterBell(); else return; }
        else if (S.screen === "bell") { if (!S.show && len) S.show = true; else if (S.prob < len - 1) { S.prob++; S.show = false; } else if (!afterBell()) return; }
        else if (S.screen === "notes" && hasNotes) {
            const f = frames[Math.min(S.note, frames.length - 1)];
            if (!f.open && S.step < f.lines.length) S.step++;
            else if (f.ans && !S.show) S.show = true;
            else if (S.note < frames.length - 1) { S.note++; S.step = 0; S.show = false; }
            else if (isSpeedDay()) { S.screen = "speed"; S.show = false; } else return;
        }
        else if (S.screen === "speed") S.screen = "fix";
        else if (S.screen === "fix") { const f = fixState(); if (f.cur < f.list.length - 1) { fixGo(f.cur + 1); return; } return; }
        else return;
    } else {
        if (S.screen === "today") S.screen = "agenda";
        else if (S.screen === "bell") { if (S.show) S.show = false; else if (S.prob > 0) { S.prob--; S.show = true; } else backToToday(); }
        else if (S.screen === "notes" && hasNotes) {
            const f = frames[Math.min(S.note, frames.length - 1)];
            if (S.show) S.show = false;
            else if (!f.open && S.step > 0) S.step--;
            else if (S.note > 0) { S.note--; const g = frames[S.note]; S.step = g.lines.length; S.show = !!g.ans; }
            else if (len) { S.screen = "bell"; S.prob = len - 1; S.show = true; } else backToToday();
        }
        else if (S.screen === "fix") { const f = fixState(); if (f.list.length && f.cur > 0) { fixGo(f.cur - 1); return; } S.screen = "speed"; }
        else if (S.screen === "speed") { if (hasNotes) { S.screen = "notes"; S.note = frames.length - 1; S.step = frames[S.note].lines.length; S.show = false; } else if (len) { S.screen = "bell"; S.prob = len - 1; S.show = true; } else backToToday(); }
        else return;
    }
    push();
}
/* Next/Back for the clicker, the arrow keys and the board's own arrows. The lesson flow goes first; when it has
   nowhere to go, move to the next (or previous) screen in the Screens list, so the board never needs the side panel. */
const subHides = (id) => mode === "sub" && (id === "game" || id === "live" || id === "seats" || id === "steps" || (id === "deck" && !studio));
const screenOrder = () => SCREENS.filter((x) => !subHides(x[0])).map((x) => x[0]);
function nextScreen(n) {   // skips Slides, Guided Notes and Speed Dating on days that have none
    const d = D(), skip = { notes: !notesFrames(d).length, speed: !isSpeedDay(), deck: !slHas() };
    const o = screenOrder().filter((id) => id === S.screen || !skip[id]), j = o.indexOf(S.screen) + n;
    return j >= 0 && j < o.length ? o[j] : null;
}
const screenName = (id) => (SCREENS.find((x) => x[0] === id) || ["", ""])[1];
const stateSig = () => JSON.stringify([S.screen, S.prob, S.show, S.note, S.step, S.slide, S.sstep, S.fix, S.screen === "game" ? gameSig() : "", S.screen === "steps" ? S.walk : ""]);
function step(n) {
    const before = stateSig();
    flow(n);
    if (stateSig() !== before) return;
    const t = nextScreen(n); if (!t) return;
    if (t === "deck") slEnter(n); else { S.screen = t; S.show = false; }
    push();
}
function stepLabel() { const l = flowLabel(); if (l !== "Next") return l; const t = nextScreen(1); return t ? "Next: " + screenName(t) : "Next"; }
function backLabel() { if (["today", "bell", "notes", "speed", "fix"].includes(S.screen) || (S.screen === "steps" && S.walk.step > 0) || (S.screen === "deck" && (S.slide > 0 || S.sstep > 0))) return "Back"; const t = nextScreen(-1); return t ? "Back: " + screenName(t) : "Back"; }
function flowLabel() {
    if (S.screen === "game") return gameFlowLabel();
    if (S.screen === "deck") { const dn = deckNow(); if (!dn) return "Next"; if (Math.min(S.sstep, revealSteps(dn.s)) < revealSteps(dn.s)) return "Next: Show more"; return dn.i < dn.list.length - 1 ? "Next: Slide " + (dn.i + 2) : "Next"; }
    if (S.screen === "steps") return stepPlayer && stepFor === S.walk.id && S.walk.step < stepPlayer.count - 1 ? "Next: Step " + (S.walk.step + 2) : "Next";
    const d = D(), len = (d && d.problems && d.problems.length) || 0, frames = notesFrames(d), hasNotes = frames.length > 0;
    const after = hasNotes ? "Next: Guided Notes" : (isSpeedDay() ? "Next: Speed Dating" : "Next");
    if (S.screen === "agenda") return "Next: Today";
    if (S.screen === "today") return slHas() ? "Next: Slides" : len ? "Next: Bellringer" : (hasNotes ? "Next: Guided Notes" : (isSpeedDay() ? "Next: Speed Dating" : "Next"));
    if (S.screen === "bell") { if (!S.show && len) return "Next: Show answer"; if (S.prob < len - 1) return "Next: Problem " + (S.prob + 2); return after; }
    if (S.screen === "notes" && hasNotes) {
        const f = frames[Math.min(S.note, frames.length - 1)];
        if (!f.open && S.step < f.lines.length) return S.step === 0 ? "Next: First step" : "Next: Step " + (S.step + 1);
        if (f.ans && !S.show) return f.blanks ? "Next: Fill the blanks" : "Next: Show answer";
        if (S.note < frames.length - 1) return "Next: " + frames[S.note + 1].kind.split(":")[0];
        return isSpeedDay() ? "Next: Speed Dating" : "Next";
    }
    if (S.screen === "speed") return "Next: Fix It Together";
    if (S.screen === "fix") { const f = fixState(); return f.cur < f.list.length - 1 ? "Next: Card #" + f.list[f.cur + 1].n : "Next"; }
    return "Next";
}
let wake = null;
async function keepAwake() { try { if ("wakeLock" in navigator && !wake && document.visibilityState === "visible") { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) { /* not supported or not allowed: the screen follows the device's own sleep setting */ } }

window.addEventListener("error", (e) => setStatus("Error: " + (e.message || "script problem")));
window.addEventListener("unhandledrejection", (e) => setStatus("Error: " + ((e.reason && (e.reason.code || e.reason.message)) || "request failed")));

export async function startApp(opts) {
    mode = (opts && opts.mode) || "remote";
    studio = (opts && opts.studio) || null; document.body.classList.toggle("studio", !!studio);
    // New panels float on the board at their usual spot, moved down and right a little if another panel is already there.
    setFloatDefault((k, T) => { const p = toolApi.defaultPos(k); let n = 0; while (n < 8 && Object.keys(T.pos).some((o) => o !== k && Math.abs(T.pos[o].x - p.x) < 4 && Math.abs(T.pos[o].y - p.y) < 4)) { p.x = Math.min(80, p.x + 5); p.y = Math.min(70, p.y + 6); n++; } return p; });
    if (opts && Array.isArray(opts.weeks) && opts.weeks.length) WEEKS = opts.weeks;
    if (opts && Array.isArray(opts.periods) && opts.periods.length) PERIODS = opts.periods;
    const storeP = (opts && opts.store) ? Promise.resolve(opts.store) : import("./boardStore.js?v=58");   // loads while the page sets up and draws
    const guest = mode === "sub";
    mountGames({ S, header, store: () => store, writer, now, beep: () => snd.cue("done"), unlockSound, rosters: () => ROSTERS, redraw: () => { sig = ""; render(); }, mode: () => mode, signedIn: () => signedIn });
    mountLive({ S, header, store: () => store, rosters: () => ROSTERS, redraw: () => { sig = ""; render(); }, mode: () => mode, signedIn: () => signedIn });
    mountNotes({ S, store: () => store, rosters: () => ROSTERS, redraw: () => render(), mode: () => mode, signedIn: () => signedIn, frames: () => notesFrames(D()), day: D, lesson: L, push });
    document.body.classList.toggle("board", mode === "board");
    { const bg = el("div", "stagebg"); bg.id = "stageBg"; bg.setAttribute("aria-hidden", "true"); $("stage").prepend(bg); }   // the board's background pattern (Board look)
    { const sl = el("div", "stickerlayer"); sl.id = "stickerLayer"; const tl = $("toolLayer"); if (tl) tl.before(sl); else $("stage").appendChild(sl); }   // stickers: over the lesson, under the panels
    {   // On the projected board the rail, pages and arrows fade after 4 s with nobody touching it, and come back on any touch.
        let idleT = 0; const wake = () => { document.body.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => { if (document.body.classList.contains("board") && !document.querySelector(".mathmenu,.mathpanel")) document.body.classList.add("idle"); }, 4000); };
        ["pointermove", "pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, wake, true)); wake();
    }
    $("periodSel").onchange = function () { S.period = this.value; S.cls = classOf(this.value); resetPos(); push(); };
    document.addEventListener("click", (e) => { document.querySelectorAll("details.acct[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
    $("weekSel").onchange = function () { autoWeekUntil = 0; S.week = this.value; resetPos(); push(); };
    $("boardBtn").onclick = () => { document.body.classList.add("board"); unlockSound(); try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ok */ } fit(); soundSync(); };
    $("exit").onclick = () => { document.body.classList.remove("board"); soundSync(); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ok */ } fit(); };
    $("signOut").onclick = async () => { try { await store.signOut(); } finally { location.replace("login.html"); } };
    window.addEventListener("resize", fit); window.addEventListener("pageshow", () => fit());   // pageshow: back to a page the phone kept
    if (window.ResizeObserver) new ResizeObserver(fit).observe($("wrap")); document.addEventListener("fullscreenchange", () => setTimeout(fit, 60));
    document.addEventListener("pointerdown", unlockSound); document.addEventListener("keydown", unlockSound);
    soundPanel();
    phoneHeadReady = true; phoneHeader();
    if (!guest) planFold = mountPlanFold(planApi, $("planAnchor") || $("soundMenu") || $("toolsMenu"));
    $("flowNext").onclick = () => step(1); $("flowBack").onclick = () => step(-1);
    {   // Phone: swipe the board picture left for Next, right for Back (the picture shows the result at once)
        const w = $("wrap"); let sx = 0, sy = 0, st = 0, on = false;
        w.addEventListener("pointerdown", (e) => { on = phoneMirror() && e.pointerType !== "mouse" && !e.target.closest("button,input,select,a,textarea,.stk,.float h3,.grip"); sx = e.clientX; sy = e.clientY; st = Date.now(); }, true);
        w.addEventListener("pointercancel", () => { on = false; }, true);
        w.addEventListener("pointerup", (e) => {
            if (!on) return; on = false;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) < 45 || Math.abs(dy) > Math.abs(dx) * 0.7 || Date.now() - st > 800) return;
            const n = dx < 0 ? 1 : -1; step(n);
            try { if (navigator.vibrate) navigator.vibrate(12); } catch (x) { /* no buzz on this phone */ }
            let f = $("swipeFlash"); if (!f) { f = el("div", "swipeflash"); f.id = "swipeFlash"; f.setAttribute("aria-hidden", "true"); w.appendChild(f); }
            f.textContent = n > 0 ? "\u203a" : "\u2039"; f.className = "swipeflash " + (n > 0 ? "nx" : "bk"); void f.offsetWidth; f.classList.add("go");
            try { localStorage.setItem("anchorboard-swiped", "1"); } catch (x) { /* fine */ }
            const tip = $("swipeTip"); if (tip) tip.remove();
        }, true);
        let seen = false; try { seen = !!localStorage.getItem("anchorboard-swiped"); } catch (x) { /* show it */ }
        const fb = document.querySelector(".flowbar");
        if (!seen && fb) { const t = el("p", "swipetip", "Tip: swipe the board picture left for Next, right for Back."); t.id = "swipeTip"; fb.appendChild(t); }
    }
    {   // on a phone: switch between a true small copy of the board and the bigger phone-shaped view
        const fb = document.querySelector(".flowbar"), days = $("days");
        if (fb && days) {
            const row = el("div", "flowtop"), tg = el("button", "mirtog"); tg.type = "button"; tg.id = "mirrorTog";
            const lbl = () => { tg.textContent = mirrorOn ? "Bigger view" : "Board picture"; tg.setAttribute("aria-pressed", mirrorOn ? "true" : "false"); };
            tg.onclick = () => { mirrorOn = !mirrorOn; try { localStorage.setItem(MIRROR_KEY, mirrorOn ? "on" : "off"); } catch (e) { /* this visit only */ } lbl(); shelfApplied = ""; fit(); sig = ""; render(); };
            lbl(); days.before(row); row.append(days, tg);
        }
    }
    { // small arrows for full-screen Board view (hidden otherwise): tap on the Promethean, click on the Chromebook
        const nav = el("div", "bnav"), b = el("button", null, "\u2039"), f = el("button", null, "\u203A");
        b.id = "bnBack"; f.id = "bnNext"; b.type = f.type = "button";
        b.onclick = () => step(-1); f.onclick = () => step(1);
        nav.append(b, f); document.body.appendChild(nav);
    }
    {   // Panels and layouts, from the board itself: bottom right, quiet until touched like the arrows
        const pb = el("button", "bpanels"); pb.id = "panelBtn"; pb.type = "button"; pb.innerHTML = pIcon("layout") + "<span>Panels</span>"; pb.onclick = () => openSheet(toolApi); document.body.appendChild(pb);
    }
    keepAwake(); document.addEventListener("visibilitychange", keepAwake); document.addEventListener("pointerdown", keepAwake);
    document.addEventListener("keydown", (e) => { if (e.target && (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable)) return; if (e.altKey || e.ctrlKey || e.metaKey) return; if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); step(1); } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); step(-1); } else if (e.key === "m" || e.key === "M") { S.sound.music = !S.sound.music; push(); } else if (e.key === "a" || e.key === "A") { if (S.screen === "bell" || S.screen === "notes") { S.show = !S.show; push(); } } });
    let seatWas = "";
    setInterval(() => { if (!synced) return; if (S.screen === "seats") { const h = seatHiNow(); if (h !== seatWas) { seatWas = h; render(); } } tick(); tickTools(toolApi); tickPanels(toolApi); tickGames(); tickLive(); tickNotes(); soundTick(); quickTick(); if (!guest && stateIn) { planTick(planApi); if (planFold) planFold.tick(); } }, 250);
    { const p = el("div", "connpill"); p.id = "connPill"; p.setAttribute("role", "status"); p.hidden = true; document.body.appendChild(p); }
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && synced) { tick(); tickTools(toolApi); tickPanels(toolApi); tickGames(); soundTick(); } });   // a tab back in view shows the right time at once
    document.body.classList.add("syncing");
    const arrived = () => { if (synced) return; synced = true; document.body.classList.remove("syncing"); sig = ""; };
    // Draw the last board this device saw right away (see quickLoad); Firestore's copy replaces it when it arrives.
    const quickQ = !guest && !(opts && opts.store) ? quickLoad() : null, quick = quickQ && quickQ.d;
    if (quick) {
        applyState(quick);
        if (quick.stamp !== localIso()) { S.week = defaultWeek(); S.day = realDay(); S.screen = "today"; resetPos(); }   // the same new-day rule the saved state gets below
        lessonKey = lessonKeyNow(); arrived(); setStatus("Syncing\u2026");
    }
    fit(); render();
    store = await storeP;
    if (studio && studio.ready) studio.ready(studioApi());

    // Load timing, kept on this device only (step names and times, no data). ?signincheck shows it.
    const t0 = performance.now(), ms = () => Math.round(performance.now() - t0) + " ms";
    const mark = guest ? () => {} : trail;
    mark("board-load", mode + ", page " + Math.round(t0) + " ms" + (quick ? ", drawn from this device's copy" : ""));
    const user = await store.ready();
    mark("board-auth", ms());
    if (!user) { location.replace("login.html"); return; }
    if (!guest && !(opts && opts.store)) quickUid = user.uid;
    if (quickQ && quickQ.uid !== user.uid) { try { localStorage.removeItem(QUICK_KEY); } catch (e) { /* fine */ } location.reload(); return; }   // another account's copy: start clean
    if (!guest && user.uid) { try { localStorage.setItem("anchor:subTeacher", user.uid); } catch (e) { /* storage off: the sub link needs ?t= */ } }   // so the guest sub page on this computer can show this teacher's approved weeks
    if (!guest) import("./callout.js?v=2").then((m) => m.mountCallout({ store, cue: (n) => snd.cue(n) })).catch(() => {});   // "Called on" banner from the phone's Class Tracker
    signedIn = true; inkKey = ""; slStart(); $("who").textContent = guest ? ((opts && opts.who) || "Guest teacher view, no sign-in") : (user.name ? "Signed in as " + user.name : "Signed in");
    if (!guest && "BroadcastChannel" in window) {
        try {
            tabs = new BroadcastChannel("anchorboard-" + user.uid);
            tabs.onmessage = (ev) => {
                const d = ev.data; if (!synced || !d || d.by === PAGE) return;
                heard = { by: d.by, at: +d.at || 0 }; applyState(d); render(); seen(d);
            };
        } catch (e) { tabs = null; }
    }
    writeState = writer("board/state");
    if (!guest && !(opts && opts.store)) {   // Live status: check in every 20 s, and answer the Remote's "Check now"
        import("./presence.js?v=2").then((m) => {
            presence = m.startPresence({ uid: user.uid, page: PAGE, mode, now,
                snap: () => ({ screen: S.screen, screenName: screenName(S.screen), period: S.period, day: DK[S.day] || "", week: S.week,
                    panels: PANEL_LIST.filter(([k]) => S.tools.on[k]).map((x) => x[1]), look: [S.look.theme, S.look.bg, S.look.fx].join(" "), conn: ($("status") || {}).textContent || "" }) });
            if (shown.at) presence.saw(shown.by, shown.at);
            if (mode === "remote" && $("status")) presence.mount($("status").nextSibling);   // right after the Live pill
            setInterval(() => presence.changed(), 1500);
        }).catch(() => { /* Live status is extra: the board works without it */ });
    }
    // Weeks approved on the Week Review page live in private data; add them to the published weeks.
    if (!guest) { const base = WEEKS; watchPrivateWeeks(store, base, (list) => {
        WEEKS = list;
        // A ?week= link to a private week (Quick lesson, Library) can arrive before that week has loaded: open it once it has.
        if (wantWeek && synced && WEEKS.some((w) => w.id === wantWeek)) { S.week = wantWeek; wantWeek = ""; lateWeek = ""; resetPos(); push(); return; }
        if (synced && Date.now() < autoWeekUntil && !wantWeek) { const dw = defaultWeek(); if (dw !== S.week) { S.week = dw; lateWeek = ""; if (!W().classes[S.cls]) S.cls = classOf(S.period); resetPos(); push(); return; } }
        if (lateWeek && WEEKS.some((w) => w.id === lateWeek)) { S.week = lateWeek; lateWeek = ""; if (!W().classes[S.cls]) S.cls = classOf(S.period); }
        if (synced) { sig = ""; render(); }
    }); }
    store.watch("rosters/all", (snap) => { const p = (snap.exists && snap.data && snap.data.periods) || {}; ROSTERS = {}; Object.keys(p).forEach((k) => { if (Array.isArray(p[k])) ROSTERS[k] = p[k].map((n) => String(n).slice(0, 60)); }); renderLayer(); }, () => {});
    if (!guest) {
        store.watch("walk/ok", (snap) => { if (snap.pending) return; import("./walkBank.js?v=1").then((wb) => { WALKOK = wb.cleanOk(snap.exists ? snap.data : null); walkIn = true; if (synced && S.screen === "steps") render(); }); }, () => { walkIn = true; });
        store.watch("walk/edits", (snap) => { if (snap.pending) return; import("./walkBank.js?v=1").then((wb) => { WALKED = wb.cleanEdits(snap.exists ? snap.data : null); if (synced && S.screen === "steps") render(); }); }, () => {});
    } else walkIn = true;
    if (!guest) store.watch("seats/chart", (snap) => { if (snap.pending) return; SEATS = cleanChart(snap.exists ? snap.data : null); seatsIn = true; if (synced && S.screen === "seats") render(); }, () => { seatsIn = true; });
    else seatsIn = true;
    if (!guest) store.watch("settings/bells", (snap) => {   // today's bell times, for the Period clock panel (Home edits them)
        const d = snap.exists ? snap.data : null; BELL_DOC = d; if (!d) { BELLS = null; BELL_ID = "regular"; layerSig = ""; renderLayer(); if (planFold) planFold.refresh(); return; }
        BELL_ID = schedFor(d, localIso()); BELLS = bellsOf(BELL_ID); layerSig = ""; renderLayer();
        if (planFold) { planFold.refresh(); planFold.editor(); }
    }, () => {});
    if (!guest) store.watch("settings/timeline", (snap) => { if (snap.pending) return; PLAN = cleanPlan(snap.exists ? snap.data : null); if (planFold) { planFold.refresh(); planFold.editor(); } }, () => { PLAN = cleanPlan(null); });
    let skewAsked = false;
    const askSkew = () => { if (skewAsked) return; skewAsked = true; store.clockSkew().then((v) => { skew = v; tick(); }); };   // after the board state arrives, so it never delays it
    setTimeout(askSkew, 6000);
    const slow = setTimeout(() => { mark("board-slow", ms()); setStatus("Still connecting\u2026"); stateIn = true; arrived(); render(); }, 10000);   // never leave the teacher on a blank board
    // Connection, said plainly. The Remote must never look live when the board cannot follow it.
    const LOST = mode === "remote" ? "Not connected. The board will not follow. Reconnecting\u2026" : "Not connected. This screen will not follow the Remote. Reconnecting\u2026";
    let first = true, gotServer = false, cacheSince = 0, errored = false, checks = 0, misses = 0;
    const live = () => { cacheSince = 0; errored = false; awaySince = 0; if (Date.now() - saveFailedAt > 8000) setStatus(guest ? "This device only" : "Live"); };
    const lost = () => { if (!guest) setStatus(LOST); };
    window.addEventListener("offline", lost);
    window.addEventListener("online", () => { if (!guest && store.kick) store.kick(); });   // back online: reconnect now, not on the SDK's next retry
    // A phone that slept (or a tab left in the background) usually comes back with a dead connection that Firestore only
    // notices after many seconds. Coming back after 15 s away: reconnect at once, and say "Syncing" until the server answers.
    let hiddenAt = 0, awaySince = 0;
    if (!guest) document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
        if (hiddenAt && Date.now() - hiddenAt > 15000 && gotServer && navigator.onLine) { awaySince = Date.now(); setStatus("Syncing\u2026"); if (store.kick) store.kick(); }
        hiddenAt = 0; if (cacheSince) cacheSince = Date.now();   // a fresh grace period: time hidden does not count
    });
    if (!guest) setInterval(async () => {   // a connection can stall with no error: check it, and wake it if it has
        if (document.visibilityState === "hidden") return;
        // Not connected only after 15 s with no server answer (was 5 s, which a phone's normal start could pass).
        if ((cacheSince && Date.now() - cacheSince > 15000) || (awaySince && Date.now() - awaySince > 15000)) lost();
        if (!synced || errored || ++checks % 6) return;   // a server read about every 30 s while in view
        // One missed check only wakes the connection; "Not connected" needs two in a row (a phone's slow answer is not a lost board).
        if (!(await store.reachable("board/state"))) { if (++misses >= 2) lost(); store.kick && store.kick(); } else misses = 0;
    }, 5000);
    store.watch("board/state", (snap) => {
        if (!gotServer && !snap.fromCache) { gotServer = true; mark("board-server", ms()); setTimeout(askSkew, 1500); }
        if (snap.fromCache) { if (!cacheSince) cacheSince = Date.now(); } else if (!guest) live();
        if ((snap.pending && !(snap.data && snap.data.by && snap.data.by !== PAGE)) || (writeState && writeState.busy())) return;
        // An older copy of a change this tab already heard over the channel must not wind it back.
        if (snap.data && heard.by && snap.data.by === heard.by && (+snap.data.at || 0) < heard.at) return;
        if (!synced) mark("board-shown", ms() + (snap.fromCache ? " (saved copy)" : " (server)"));
        clearTimeout(slow);
        if (guest) setStatus("This device only"); else if (!snap.fromCache) live(); else if (!gotServer) setStatus(synced ? "Syncing\u2026" : "Connecting\u2026");
        if (earlyTap) { earlyTap = false; first = false; stateIn = true; arrived(); push(); return; }   // a tap made before sign-in finished wins over the copy it was made on
        if (snap.exists) { applyState(snap.data); seen(snap.data); quickSave(snap.data); }
        stateIn = true; arrived();
        if (first) {
            first = false;
            const q = new URLSearchParams(location.search), c = q.get("class"), dy = q.get("day"), di = DK.map((k) => k.toLowerCase()).indexOf((dy || "").toLowerCase());
            let changed = !snap.exists;
            // A board left on another day must not come back on that day tomorrow: on a new calendar day, start on the real day.
            if (!guest && snap.exists && snap.data.stamp !== localIso()) { S.week = defaultWeek(); S.day = realDay(); S.screen = "today"; resetPos(); changed = true; }
            // That default was picked before private weeks loaded: for a few seconds, move to a newer one when it arrives.
            if (!guest && changed) autoWeekUntil = Date.now() + 15000;
            const pq = q.get("period"), sq = q.get("screen");
            if (guest) { const pp = q.get("period"); if (pp && PERIODS.some((p) => p[0] === pp)) { S.period = pp; S.cls = classOf(pp); } if (di >= 0) S.day = di; S.screen = "today"; resetPos(); push(); return; }
            const wq = q.get("week");   // the Library opens a chosen week: remote.html?week=week5&class=8th&day=mon
            if (mode === "remote" && wq && WEEKS.some((w) => w.id === wq) && wq !== S.week) { S.week = wq; resetPos(); changed = true; }
            else if (mode === "remote" && wq && !WEEKS.some((w) => w.id === wq)) wantWeek = wq;
            if (mode === "remote" && sq && SCREENS.some((x) => x[0] === sq) && sq !== S.screen) { S.screen = sq; changed = true; }
            const wq2 = q.get("walk");   // the Walkthroughs page sends one to the board: remote.html?screen=steps&walk=8.11-05
            if (mode === "remote" && wq2 && /^[\w. -]{1,40}$/.test(wq2)) { S.walk = { id: wq2, step: 0 }; S.screen = "steps"; changed = true; }
            if (mode === "remote" && pq && PERIODS.some((p) => p[0] === pq) && pq !== S.period) { S.period = pq; S.cls = classOf(pq); resetPos(); S.screen = sq && SCREENS.some((x) => x[0] === sq) ? sq : "today"; changed = true; }
            else if (mode === "remote" && c && W().classes[c] && (c !== S.cls)) { S.cls = c; S.period = (PERIODS.find((p) => p[1] === c) || [S.period])[0]; resetPos(); changed = true; }
            if (mode === "remote" && di >= 0 && di !== S.day) { S.day = di; resetPos(); changed = true; }
            if (changed) { push(); return; }
        }
        render();
    }, (e, fails) => {
        clearTimeout(slow); errored = true; mark("board-sync-error", ((e && e.code) || "error") + ", try " + fails);
        stateIn = true; arrived(); lost(); render();
        // The projected board has no one at its keyboard: if listening keeps failing while the device is online,
        // reload it (at most once every 5 minutes). The saved state comes straight back.
        if (mode === "board" && fails >= 4 && navigator.onLine) {
            try { const k = "anchorboard-reloaded", at = +sessionStorage.getItem(k) || 0; if (Date.now() - at > 300000) { sessionStorage.setItem(k, String(Date.now())); location.reload(); } } catch { /* storage blocked: keep retrying */ }
        }
    });
    render();
}
