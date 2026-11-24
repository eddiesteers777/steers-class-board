/* ==========================================
   Anchor Board — Board Builder (studio.html).
   One place to build the board and the lesson behind it, in four steps:
     1 Look      Quick looks, colours, background, falling effect, logo, music
     2 Panels    add panels, pick one on the board to size or move it, tidy them up, layouts
     3 Stickers  pictures, math symbols and word badges, dragged, sized and turned on the board
     4 Lesson    the day's lesson (target, agenda, bellringer), the screen, saved boards,
                 the bell timeline, the day's files and the pages that feed the board
   It is the Remote with a builder rail: the stage is the real board (js/boardApp.js), every change
   is the same shared state, so the projected board follows as you build. "Save this board" keeps the
   look, panels, stickers and screen as one layout that the Remote, the board and the bell timeline can use.
   Slides (the switch in the header): the teacher's own slides for each lesson, Google Slides-style (js/slideEditor.js).
   Spotlight (the third tab): the board full screen, with a glass toolbar to pop panels on and draw on the background (js/spotlight.js).
========================================== */
import { PANEL_LIST, LESSON_PANELS, TOOL_LIST, MATH_LIST, CALC_LIST, MAX_SCENES, MAX_DAYB } from "./boardTools.js?v=79";
import { SCENES, sceneActive, applyScene, saveScene, panelOn, panelOff, panelToggle, PANEL_INFO, labelOf, icon, LOOK_THEMES, LOOK_BGS, LOOK_PHOTOS, bgName, LOOK_PRESETS,
    presetTile, photoPicker, photoGroupNow, gradOf, themeCols, MARKS, EFFECTS, FX_AMOUNTS } from "./panels.js?v=42";
import { markUrl } from "./marks.js?v=1";
import { addStepAndEdit } from "./bellPlan.js?v=6";
import { effectSample } from "./effects.js?v=3";
import { STICKER_SETS, WORDS, WORD_COLORS, MAX_STICKERS, makeSticker, stickerFace, cleanSticker } from "./stickers.js?v=1";

const $ = (id) => document.getElementById(id);
let A = null;          // the board app's studio API (boardApp.js studioApi)
let pick = null;       // { kind: "panel" | "sticker", id } — what was last picked on the board
let step = "look", lookTab = "quick", stkTab = "School", wordColor = 0;
const sigs = {};
const STEPS = [
    ["look", "Look", "Colors, background, effects",
        '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="15.5" cy="10" r="1.3"/><path d="M12 21a3 3 0 0 1 0-6h2a3 3 0 0 0 3-3"/>'],
    ["panels", "Panels", "Add, move and size",
        '<rect x="3" y="4" width="11" height="16" rx="2"/><rect x="16" y="4" width="5" height="7" rx="1.5"/><rect x="16" y="13" width="5" height="7" rx="1.5"/>'],
    ["stickers", "Stickers", "Pictures and words",
        '<path d="M14.5 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8.5L21 14.5V6a3 3 0 0 0-3-3z"/><path d="M14.5 21v-4.5a2 2 0 0 1 2-2H21"/><circle cx="9" cy="10" r="1"/><circle cx="14" cy="10" r="1"/><path d="M8.5 14a4 4 0 0 0 6 0"/>'],
    ["lesson", "Lesson", "Plan it and run it",
        '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8M8 13h8M8 17h5"/>'],
];
const svg = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(cls, text, fn, title) { const b = el("button", cls, text); b.type = "button"; if (title) b.title = title; if (fn) b.onclick = fn; return b; }
const pressed = (b, on) => { b.setAttribute("aria-pressed", String(!!on)); if (on) b.classList.add("on"); return b; };
const head = (t, hint) => { const f = document.createDocumentFragment(); f.appendChild(el("h3", "sh", t)); if (hint) f.appendChild(el("p", "shint", hint)); return f; };
const nameOf = (list, id) => (list.find((x) => x[0] === id) || [id, id])[1];
const pushNow = () => { A.push(); refresh(); };

/* ---------- Board | Slides ----------
   Slides opens the slide editor in place of the board (js/slideEditor.js, loaded the first time). It has its own
   week, class and day, so building next week's slides never moves the live board; "Show on board" is the one way across.
   The address keeps the lesson (#slides/<week>/<class>/<day>), so a reload or a link from the board opens the same slides. */
let mode = "board", editor = null, wantSlides = null, spot = null, wantSpot = false;
function lessonFromHash() {
    const m = /^#slides(?:\/([^/]*)\/([^/]*)\/([0-4]))?$/.exec(location.hash || ""); if (!m) return null;
    try { return m[1] ? { week: decodeURIComponent(m[1]), cls: decodeURIComponent(m[2]), day: +m[3] } : {}; } catch (e) { return {}; }
}
function setMode(m, at) {
    const was = mode;
    mode = m === "slides" ? "slides" : m === "spot" ? "spot" : "board";
    try { sessionStorage.setItem("anchorboard-studio-mode", mode); } catch (e) { /* this visit only */ }
    document.body.classList.toggle("slidemode", mode === "slides");
    document.querySelectorAll("#modeSwitch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    if (was === "spot" && mode !== "spot" && spot) spot.closeSpot();
    if (mode === "spot") {
        const app = $("slideApp"); if (app) app.hidden = true; wantSlides = null; if (editor) editor.closeEditor();
        if (/^#slides/.test(location.hash)) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* the address is a convenience */ } }
        if (!A.synced()) { wantSpot = true; return; }   // open on the saved board, once it has arrived
        import("./spotlight.js?v=36").then((mod) => { spot = mod; if (mode === "spot") mod.openSpot(A, $("spotApp"), () => setMode("board")); })
            .catch(() => { setMode("board"); note("saveNote", "Spotlight did not load. Check the connection and reload the page."); });
        return;
    }
    const app = $("slideApp"); if (!app) return;
    if (mode === "slides") {
        app.hidden = false;
        if (!A.synced()) { wantSlides = at || {}; return; }   // open on the lesson the board is on, once that has arrived
        import("./slideEditor.js?v=37").then((mod) => { editor = mod; if (mode === "slides") mod.openEditor(A, app, at && at.week ? at : null); })
            .catch(() => { app.textContent = "The slide editor did not load. Check the connection and reload the page."; });
    } else {
        app.hidden = true; wantSlides = null;
        if (editor) editor.closeEditor();
        if (/^#slides/.test(location.hash)) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* the address is a convenience */ } }
        setTimeout(() => { A.fit(); A.redraw(); }, 0);
    }
}

/* ---------- the hooks boardApp.js calls ---------- */
export const studio = {
    ready(api) {
        A = api;
        // The three tabs work as one: Slides and Spotlight can send the teacher to each other (setMode("spot"), setMode("slides", lesson)).
        A.goMode = (m, at) => setMode(m, at);
        document.querySelectorAll("#modeSwitch button").forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
        { const at = lessonFromHash(); let m = "board"; try { m = sessionStorage.getItem("anchorboard-studio-mode") || "board"; } catch (e) { /* board */ }
            if (at) setMode("slides", at); else if (m === "slides" || m === "spot") setMode(m); }
        window.addEventListener("hashchange", () => { const at = lessonFromHash(); if (at && at.week) setMode("slides", at); });
        try { const s = sessionStorage.getItem("anchorboard-studio-step"); if (STEPS.some((x) => x[0] === s)) step = s; } catch (e) { /* first step */ }
        drawSteps(); showStep(step);
        $("saveForm").onsubmit = (e) => { e.preventDefault(); saveBoard(); };
        $("undoBtn").onclick = () => undo();
        saveFold();
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z") && !/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || "")) { e.preventDefault(); undo(); }
        });
        // A tap on the empty board lets go of whatever was picked.
        $("stage").addEventListener("pointerdown", (e) => { if (!e.target.closest(".stk,.float,.docked,.pchip,button,a,input,select,textarea")) studio.pick(null); });
        document.addEventListener("keydown", (e) => {
            if (!pick || /INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || "")) return;
            if (e.key === "Escape") { studio.pick(null); }
        });
        refresh();
    },
    render() {
        if (!A) return;
        if (wantSlides && A.synced()) { const at = wantSlides; wantSlides = null; setMode("slides", at); }
        if (wantSpot && A.synced()) { wantSpot = false; if (mode === "spot") setMode("spot"); }
        if (mode === "spot") { if (spot) spot.renderSpot(); return; }   // full screen: the rail is hidden
        if (mode === "slides") { if (editor) editor.weeksChanged(); return; }   // the board is hidden: nothing on the rail to redraw
        refresh();
    },
    selected() { return pick && pick.kind === "sticker" ? pick.id : ""; },
    /** Something on the board was picked (or nothing, with null). Never rebuilds the board: a drag may be starting. */
    pick(kind, id) {
        pick = kind ? { kind, id } : null;
        if (A) A.pickPanel(pick && pick.kind === "panel" ? pick.id : "");
        if (mode === "spot") { if (spot) spot.pickSpot(kind, id); return; }
        document.querySelectorAll("#stickerLayer .stk").forEach((w) => w.classList.toggle("sel", !!pick && pick.kind === "sticker" && w.dataset.id === pick.id));
        if (kind === "sticker" && step !== "stickers") showStep("stickers");
        else if (kind === "panel" && step !== "panels") showStep("panels");
        setTimeout(refresh, 0);   // after the pointerdown, so the rail never changes under the finger
    },
};

/* ---------- steps ---------- */
function drawSteps() {
    const nav = $("steps"); nav.textContent = "";
    STEPS.forEach(([id, name, sub, ic], i) => {
        const b = el("button", "sstep"); b.type = "button"; b.id = "tab-" + id; b.setAttribute("role", "tab"); b.setAttribute("aria-controls", "pane-" + id);
        const n = el("span", "ssn", String(i + 1)), ico = el("span", "ssi"); ico.innerHTML = svg(ic);
        const t = el("span", "sst"); t.appendChild(el("b", null, name)); const st = el("small", null, sub); st.dataset.status = id; t.appendChild(st);
        b.append(n, ico, t); b.onclick = () => showStep(id); nav.appendChild(b);
    });
    nav.addEventListener("keydown", (e) => {
        const i = STEPS.findIndex((x) => x[0] === step); let j = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % STEPS.length; else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i + STEPS.length - 1) % STEPS.length;
        if (j >= 0) { e.preventDefault(); showStep(STEPS[j][0]); $("tab-" + step).focus(); }
    });
}
function showStep(id) {
    if (id !== "stickers" && pick && pick.kind === "sticker") { pick = null; document.querySelectorAll("#stickerLayer .stk.sel").forEach((w) => w.classList.remove("sel")); }
    step = id; try { sessionStorage.setItem("anchorboard-studio-step", id); } catch (e) { /* this visit only */ }
    STEPS.forEach(([s]) => { const t = $("tab-" + s), p = $("pane-" + s); const on = s === id; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; t.classList.toggle("on", on); p.hidden = !on; });
    $("soundHost").hidden = !(id === "look" && lookTab === "sound");
    document.body.classList.toggle("stkstep", id === "stickers");   // on the Stickers step, stickers sit above the panels so any one can be grabbed
    $("sscroll").scrollTop = 0; refresh();
}
function stepStatus() {
    const S = A.S, T = S.tools, n = Object.keys(T.on).length, k = S.stickers.length, set = (id, t) => { const x = document.querySelector('[data-status="' + id + '"]'); if (x && x.textContent !== t) x.textContent = t; };
    const preset = LOOK_PRESETS.find((p) => S.look.theme === p[2] && S.look.bg === p[3] && (S.look.mark || "anchor") === p[4] && (S.look.fx || "none") === p[5]);
    set("look", preset ? preset[1] : nameOf(LOOK_THEMES, S.look.theme) + " · " + bgName(S.look.bg) + (S.look.fx && S.look.fx !== "none" ? " · " + nameOf(EFFECTS, S.look.fx) : ""));
    set("panels", n ? n + (n === 1 ? " panel on" : " panels on") : "No panels yet");
    set("stickers", k ? k + (k === 1 ? " sticker" : " stickers") : "None yet");
    set("lesson", A.dayName() + " · " + A.classLabel());
    paintSaveDay();
}
/* ---------- Undo: every change to the look, panels, stickers or screen, from the rail or the board ---------- */
let hist = [], last = null, lastSig = "";
const snap = () => { const S = A.S, T = S.tools; return JSON.parse(JSON.stringify({ look: S.look, stickers: S.stickers, screen: S.screen, on: T.on, min: T.min, pos: T.pos, order: T.order })); };
function track() {
    const cur = snap(), sig = JSON.stringify(cur);
    if (sig === lastSig) return;
    if (last) { hist.push(last); if (hist.length > 40) hist.shift(); }
    last = cur; lastSig = sig; paintUndo();
}
function undo() {
    const prev = hist.pop(); if (!prev) return;
    const S = A.S, T = S.tools;
    S.look = prev.look; S.stickers = prev.stickers; S.screen = prev.screen; T.on = prev.on; T.min = prev.min; T.pos = prev.pos; T.order = prev.order;
    last = snap(); lastSig = JSON.stringify(last); pick = null; A.pickPanel("");
    A.push(); paintUndo(); refresh();
}
function paintUndo() { const u = $("undoBtn"); if (u) { u.disabled = !hist.length; u.title = hist.length ? "Undo the last change (Ctrl+Z)" : "Nothing to undo yet"; } }

/** Redraw the open step only when what it shows has changed (a redraw under a tap would swallow the tap). */
function refresh() {
    if (!A || !A.synced()) return;
    track(); stepStatus(); markUnder(); drawPick();
    const S = A.S, T = S.tools;
    const sig = {
        look: JSON.stringify([S.look, lookTab, photoGroupNow()]),
        panels: JSON.stringify([T.on, T.min, T.pos, T.scenes.map((x) => x.id), S.screen, A.guest()]),
        stickers: JSON.stringify([S.stickers.length, stkTab, wordColor]),
        lesson: JSON.stringify([S.week, S.cls, S.day, S.screen, A.spot.slides().map((x) => x.id), A.spot.slidesReady(), A.spotScreens().map((x) => x.sl), T.scenes, T.dayb, T.on, T.min, S.look, S.stickers.map((x) => x.id), (A.day() || {}).lt, ((A.day() || {}).agenda || []).join("|"), A.guest()]),
    }[step];
    if (sigs[step] === sig) return; sigs[step] = sig;
    const sc = $("sscroll"), top = sc.scrollTop;
    ({ look: drawLook, panels: drawPanels, stickers: drawStickers, lesson: drawLesson })[step]();
    sc.scrollTop = top;
}

/* ---------- 1 Look ---------- */
const LOOK_TABS = [["quick", "Quick looks"], ["colors", "Colors"], ["bg", "Background"], ["photos", "Photos"], ["fx", "Falling"], ["logo", "Logo"], ["sound", "Music"]];
function setLook(patch) { A.S.look = Object.assign({}, A.S.look, patch); pushNow(); }
function drawLook() {
    const p = $("pane-look"), S = A.S; const f = document.createDocumentFragment();
    f.appendChild(head("Pick the look", "Start with a Quick look, or set each part. The board changes as you tap."));
    const tabs = el("div", "schips"); tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "Look settings");
    LOOK_TABS.forEach(([id, name]) => tabs.appendChild(pressed(btn("schip", name, () => { lookTab = id; refresh(); }), lookTab === id)));
    f.appendChild(tabs);
    const box = el("div", "lookpick slook");
    if (lookTab === "quick") {
        const groups = []; LOOK_PRESETS.forEach((x) => { if (!groups.includes(x[6])) groups.push(x[6]); });
        groups.forEach((g) => {
            box.appendChild(el("p", "lookh", g));
            const grid = el("div", "lookbgs lookpresets"); LOOK_PRESETS.filter((x) => x[6] === g).forEach((x) => grid.appendChild(presetTile(A.toolApi, x, refresh))); box.appendChild(grid);
        });
    } else if (lookTab === "colors") {
        const th = el("div", "lookthemes");
        LOOK_THEMES.forEach(([id, name]) => {
            const b = pressed(btn("lookth", null, () => setLook({ theme: id }), name), S.look.theme === id);
            const sw = el("span", "lsw"); sw.style.background = gradOf(id); b.append(sw, el("span", "lnm", name)); th.appendChild(b);
        });
        box.appendChild(th);
    } else if (lookTab === "bg") {
        const bg = el("div", "lookbgs");
        LOOK_BGS.forEach(([id, name]) => {
            const b = pressed(btn("lookbg", null, () => setLook({ bg: id })), S.look.bg === id);
            const pv = el("span", "lpv"); pv.style.background = gradOf(S.look.theme); pv.appendChild(el("span", "stagebg pv-" + id)); b.append(pv, el("span", "lnm", name)); bg.appendChild(b);
        });
        box.appendChild(bg);
    } else if (lookTab === "photos") {
        box.appendChild(photoPicker(el, S.look, (id) => setLook({ bg: id }), refresh, { guest: A.guest() }));
    } else if (lookTab === "fx") {
        const amt = el("div", "schips small"); amt.setAttribute("role", "group"); amt.setAttribute("aria-label", "How many fall at once");
        amt.appendChild(el("span", "schiph", "How many"));
        FX_AMOUNTS.forEach(([n, name]) => amt.appendChild(pressed(btn("schip", name, () => setLook({ fxn: n })), (S.look.fxn || 2) === n)));
        box.appendChild(amt);
        const fx = el("div", "lookfxs");
        EFFECTS.forEach(([id, name]) => {
            const b = pressed(btn("lookfx", null, () => setLook({ fx: id })), (S.look.fx || "none") === id);
            const pv = el("span", "lfx fx-" + id, id === "none" ? "" : effectSample(id)); pv.style.background = gradOf(S.look.theme); b.append(pv, el("span", "lnm", name)); fx.appendChild(b);
        });
        box.appendChild(fx);
    } else if (lookTab === "logo") {
        const mks = el("div", "lookmarks");
        MARKS.forEach(([id, name]) => {
            const b = pressed(btn("lookmk", null, () => setLook({ mark: id }), name), (S.look.mark || "anchor") === id);
            const im = el("img", "lmk"); im.alt = ""; im.src = S.look.theme === "navy" && id === "anchor" ? "brand/logo.svg" : markUrl(id, themeCols(S.look.theme), "tile", S.look.theme);
            b.append(im, el("span", "lnm", name)); mks.appendChild(b);
        });
        box.appendChild(mks);
        box.appendChild(el("p", "shint", "The logo is drawn in the board's colors."));
    }
    if (lookTab === "sound") box.appendChild(el("p", "shint", "Music and sounds play on the board computer. Press M on the board to turn music on or off."));
    f.appendChild(box);
    p.replaceChildren(f);
    // Music and sound: the Remote's own Sound controls (js/boardApp.js soundPanel), living under this step
    $("soundHost").hidden = lookTab !== "sound" || step !== "look";
}

/* ---------- 2 Panels ---------- */
const SIZES = [[0.8, "S"], [1, "M"], [1.35, "L"], [1.8, "XL"]];
function posFor(k) { const T = A.S.tools; return T.pos[k] ? Object.assign({}, T.pos[k]) : A.defaultPos(k); }
function drawPanels() {
    const p = $("pane-panels"), S = A.S, T = S.tools, f = document.createDocumentFragment();
    f.appendChild(head("Add panels", "Tap a panel to put it on the board. Drag it by its title bar: it snaps into line with the grid and the other panels. Drag a corner to size it."));
    [["Lesson", LESSON_PANELS], ["Calculators", CALC_LIST], ["Classroom", TOOL_LIST], ["Math tools", MATH_LIST]].forEach(([title, list]) => {
        f.appendChild(el("p", "lookh", title));
        const g = el("div", "stiles");
        list.filter(([k]) => A.panelOk(k)).forEach(([k, label]) => {
            const st = !T.on[k] ? "off" : T.min[k] ? "min" : T.pos[k] ? "float" : "side";
            const b = btn("stile st-" + st, null, () => {
                if (!T.on[k] || T.min[k]) { panelOn(T, k); pushNow(); studio.pick("panel", k); }
                else { studio.pick("panel", k); }
            }, PANEL_INFO[k] || label);
            b.setAttribute("aria-pressed", String(st !== "off"));
            const ic = el("span", "sti"); ic.innerHTML = icon(k); b.appendChild(ic);
            b.appendChild(el("b", null, label)); b.appendChild(el("small", null, { off: "Add", side: "On the side", min: "Small", float: "On the board" }[st]));
            g.appendChild(b);
        });
        f.appendChild(g);
    });
    const on = Object.keys(T.on);
    f.appendChild(head("Arrange", on.length ? "One tap to line every panel up neatly." : "Add a panel first."));
    const ar = el("div", "sbtns");
    const tidy = btn("btn ghost", "Tidy up the right side", () => arrange("right")), row = btn("btn ghost", "Line up across the top", () => arrange("top"));
    const side = btn("btn ghost", "All to the side", () => { on.forEach((k) => { delete T.pos[k]; delete T.min[k]; }); pushNow(); });
    const clear = btn("btn ghost danger", "Take all off", () => { T.on = {}; T.min = {}; T.pos = {}; T.order = []; studio.pick(null); pushNow(); });
    [tidy, row, side, clear].forEach((b) => { b.disabled = !on.length; ar.appendChild(b); });
    f.appendChild(ar);
    f.appendChild(head("Ready-made layouts", "A screen and its panels in one tap. Your saved boards are under Lesson."));
    const sc = el("div", "schips wrap");
    SCENES.filter((x) => !(x.guestless && A.guest())).forEach((x) => { const b = pressed(btn("schip", x.n, () => { applyScene(S, x, A.toolApi); refresh(); }, x.d), sceneActive(S, x)); sc.appendChild(b); });
    f.appendChild(sc);
    p.replaceChildren(f);
}
function pickedPanel(k) {
    const T = A.S.tools, card = el("div", "spicked"), cur = T.pos[k] ? T.pos[k].s || 1 : 1;
    const top = el("div", "spt"); const ic = el("span", "sti"); ic.innerHTML = icon(k); top.append(ic, el("b", null, labelOf(k)));
    top.appendChild(btn("spx", "Done", () => studio.pick(null), "Let go of this panel")); card.appendChild(top);
    const sz = el("div", "schips small"); sz.appendChild(el("span", "schiph", "Size"));
    SIZES.forEach(([s, n]) => sz.appendChild(pressed(btn("schip", n, () => { const q = posFor(k); q.s = s; q.x = Math.min(q.x, 95); q.y = Math.min(q.y, 92); T.pos[k] = q; delete T.min[k]; pushNow(); }, "Size " + n), T.pos[k] && Math.abs(cur - s) < 0.05)));
    card.appendChild(sz);
    const mv = el("div", "schips small"); mv.appendChild(el("span", "schiph", "Move to"));
    [["tl", "↖", "Top left"], ["tr", "↗", "Top right"], ["c", "•", "Middle"], ["bl", "↙", "Bottom left"], ["br", "↘", "Bottom right"]].forEach(([id, g, t]) => mv.appendChild(btn("schip corner", g, () => corner(k, id), t)));
    card.appendChild(mv);
    const act = el("div", "sbtns");
    act.appendChild(btn("btn ghost", "Make it small", () => { T.min[k] = true; studio.pick(null); pushNow(); }, "A live chip in the corner"));
    if (k !== "groups") act.appendChild(btn("btn ghost", T.pos[k] ? "Put on the side" : "Put on the board", () => { if (T.pos[k]) { delete T.pos[k]; panelOn(T, k, { dock: true }); } else T.pos[k] = A.defaultPos(k); pushNow(); }));
    act.appendChild(btn("btn ghost danger", "Remove", () => { panelOff(T, k); studio.pick(null); pushNow(); }));
    card.appendChild(act);
    return card;
}
/** The panel's size on the board, in % of the stage (measured from the board itself). */
function boxOf(k) {
    const st = $("stage").getBoundingClientRect(), w = document.querySelector('#toolLayer .float[data-panel="' + k + '"]');
    if (!w || !st.width) return { w: 22, h: 24 };
    const r = w.getBoundingClientRect(); return { w: r.width / st.width * 100, h: r.height / st.height * 100 };
}
function corner(k, id) {
    const T = A.S.tools, q = posFor(k); T.pos[k] = q; delete T.min[k]; A.redraw();
    const b = boxOf(k), m = 2;
    q.x = id === "tl" || id === "bl" ? m : id === "c" ? (100 - b.w) / 2 : 100 - b.w - m;
    q.y = id === "tl" || id === "tr" ? m : id === "c" ? (100 - b.h) / 2 : 100 - b.h - m;
    q.x = Math.round(Math.max(0, Math.min(95, q.x)) * 10) / 10; q.y = Math.round(Math.max(0, Math.min(92, q.y)) * 10) / 10; T.pos[k] = q; pushNow();
}
/** Line every panel up: down the right side (a second column if it runs out of room) or across the top. */
function arrange(how) {
    const T = A.S.tools, keys = PANEL_LIST.map((x) => x[0]).filter((k) => T.on[k] && A.panelOk(k));
    if (!keys.length) return;
    keys.forEach((k) => { delete T.min[k]; if (!T.pos[k]) T.pos[k] = A.defaultPos(k); });
    A.redraw();   // draw them floating once, so their sizes can be measured
    const m = 1.5, g = 1.5; let y = m, colW = 0, right = 100 - m, left = m;
    const order = keys.slice().sort((a, b) => (LESSON_PANELS.some((p) => p[0] === b) - LESSON_PANELS.some((p) => p[0] === a)) || T.order.indexOf(a) - T.order.indexOf(b));
    order.forEach((k) => {
        const b = boxOf(k), q = T.pos[k];
        if (how === "right") {
            if (y + b.h > 100 - m && y > m) { right -= colW + g; y = m; colW = 0; }
            q.x = right - b.w; q.y = y; y += b.h + g; colW = Math.max(colW, b.w);
        } else {
            if (left + b.w > 100 - m && left > m) { left = m; y += colW + g; colW = 0; }
            q.x = left; q.y = y; left += b.w + g; colW = Math.max(colW, b.h);
        }
        q.x = Math.round(Math.max(0, Math.min(95, q.x)) * 10) / 10; q.y = Math.round(Math.max(0, Math.min(92, q.y)) * 10) / 10;
    });
    pushNow();
}

/* ---------- 3 Stickers ---------- */
function addSticker(t, v) {
    const S = A.S; if (S.stickers.length >= MAX_STICKERS) { note("stkNote", "That's " + MAX_STICKERS + " stickers, the most a board holds. Remove one first."); return; }
    const st = makeSticker(t, v, S.stickers, wordColor); if (!st) return;
    const spot = freeSpot(st); if (spot) { st.x = spot.x; st.y = spot.y; }
    S.stickers = S.stickers.concat([st]); pick = { kind: "sticker", id: st.id }; pushNow();
}
function note(id, t) { const n = $(id); if (n) n.textContent = t; if (t && id === "saveNote" && !saveIsOpen) setSaveOpen(true, false); }   // a message under Save opens it
function drawStickers() {
    const p = $("pane-stickers"), S = A.S, f = document.createDocumentFragment();
    f.appendChild(head("Add stickers", "Tap one to put it on the board, in an open spot. Drag it to move it, the round handle on its corner to size it and the one on top to turn it."));
    const tabs = el("div", "schips"); tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "Sticker sets");
    STICKER_SETS.map((x) => x[0]).concat(["Words"]).forEach((n) => tabs.appendChild(pressed(btn("schip", n, () => { stkTab = n; refresh(); }), stkTab === n)));
    f.appendChild(tabs);
    if (stkTab === "Words") {
        const cols = el("div", "schips small"); cols.appendChild(el("span", "schiph", "Color"));
        WORD_COLORS.forEach(([n, bg], i) => { const b = pressed(btn("sswatch", null, () => { wordColor = i; refresh(); }, n), wordColor === i); b.style.background = bg; b.setAttribute("aria-label", n); cols.appendChild(b); });
        f.appendChild(cols);
        const own = el("form", "sown"), inp = el("input"); inp.type = "text"; inp.maxLength = 40; inp.placeholder = "Your own words"; inp.setAttribute("aria-label", "Your own words for a sticker");
        const go = el("button", "btn", "Add"); go.type = "submit"; own.append(inp, go);
        own.onsubmit = (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) { inp.focus(); return; } addSticker("w", v); };
        f.appendChild(own);
        const g = el("div", "swords");
        WORDS.forEach((w) => { const b = btn("sword", null, () => addSticker("w", w), "Add “" + w + "”"); b.appendChild(stickerFace({ t: "w", v: w, c: wordColor })); g.appendChild(b); });
        f.appendChild(g);
    } else {
        const set = STICKER_SETS.find((x) => x[0] === stkTab) || STICKER_SETS[0], g = el("div", "sstks" + (set[1] === "m" ? " math" : ""));
        set[2].forEach((v) => { const b = btn("sstk", null, () => addSticker(set[1], v), "Add " + v); b.appendChild(stickerFace({ t: set[1], v })); g.appendChild(b); });
        f.appendChild(g);
    }
    const foot = el("div", "sbtns"), n = el("p", "shint"); n.id = "stkNote"; n.setAttribute("role", "status"); n.textContent = S.stickers.length + " of " + MAX_STICKERS + " on the board.";
    const clear = btn("btn ghost danger", "Remove all stickers", () => { S.stickers = []; pick = null; pushNow(); }); clear.disabled = !S.stickers.length;
    foot.append(clear); f.append(foot, n);
    f.appendChild(el("p", "shint", "On the board, panels sit on top of stickers. A sticker that looks faded here is under a panel, so the class can't see it."));
    f.appendChild(el("p", "shint", "Keyboard: tap a sticker, then arrows move it, + and − size it, [ and ] turn it, Delete removes it, Esc lets go."));
    p.replaceChildren(f);
}
function pickedSticker(st) {
    const S = A.S, card = el("div", "spicked"), set = (patch) => { S.stickers = S.stickers.map((x) => (x.id === st.id ? cleanSticker(Object.assign({}, x, patch)) : x)); pushNow(); };
    const top = el("div", "spt"), face = el("span", "spf"); face.appendChild(stickerFace(st)); top.append(face, el("b", null, "Picked sticker"));
    top.appendChild(btn("spx", "Done", () => studio.pick(null), "Let go of this sticker")); card.appendChild(top);
    if (isUnder(st.id)) card.appendChild(el("p", "swarn", "Part of it is under a panel, so the class can't see that part. Drag it to an open spot."));
    const row = el("div", "schips small");
    const left = btn("schip turn", "⟲", () => set({ r: st.r - 15 }), "Turn it left"), right = btn("schip turn", "⟳", () => set({ r: st.r + 15 }), "Turn it right");
    left.setAttribute("aria-label", "Turn it left"); right.setAttribute("aria-label", "Turn it right");
    row.append(btn("schip", "Smaller", () => set({ s: st.s / 1.2 })), btn("schip", "Bigger", () => set({ s: st.s * 1.2 })), left, right, btn("schip", "Straight", () => set({ r: 0 })));
    card.appendChild(row);
    if (st.t === "w") {
        const cols = el("div", "schips small"); cols.appendChild(el("span", "schiph", "Color"));
        WORD_COLORS.forEach(([n, bg], i) => { const b = pressed(btn("sswatch", null, () => set({ c: i }), n), (st.c || 0) === i); b.style.background = bg; b.setAttribute("aria-label", n); cols.appendChild(b); });
        card.appendChild(cols);
    }
    const act = el("div", "sbtns");
    act.appendChild(btn("btn ghost", "Copy it", () => {
        if (S.stickers.length >= MAX_STICKERS) return;
        const c = cleanSticker(Object.assign({}, st, { id: "", x: st.x + 3, y: st.y + 4 })), spot = freeSpot(c, [st.x, st.y]); if (spot) { c.x = spot.x; c.y = spot.y; }
        S.stickers = S.stickers.concat([c]); pick = { kind: "sticker", id: c.id }; pushNow();
    }));
    act.appendChild(btn("btn ghost", "Bring to front", () => { S.stickers = S.stickers.filter((x) => x.id !== st.id).concat([st]); pushNow(); }));
    act.appendChild(btn("btn ghost danger", "Remove", () => { S.stickers = S.stickers.filter((x) => x.id !== st.id); pick = null; pushNow(); }));
    card.appendChild(act);
    return card;
}

/* ---------- The picked panel or sticker: its controls sit under the list, in view whatever the list is scrolled to,
   and opening them never moves the list under the finger. ---------- */
let pickSig = "";
function drawPick() {
    const host = $("pickHost"); if (!host) return;
    const S = A.S, T = S.tools, st = pick && pick.kind === "sticker" && step === "stickers" ? S.stickers.find((x) => x.id === pick.id) : null;
    const pk = pick && pick.kind === "panel" && step === "panels" && T.on[pick.id] ? pick.id : "";
    const sig = st ? JSON.stringify(["s", st, isUnder(st.id)]) : pk ? JSON.stringify(["p", pk, T.pos[pk] || null, !!T.min[pk]]) : "";
    if (sig === pickSig) return; pickSig = sig;
    host.replaceChildren(...(st ? [pickedSticker(st)] : pk ? [pickedPanel(pk)] : [])); host.hidden = !sig;
}

/* ---------- Stickers sit under the panels on the board: show which are covered, and put new ones where the class sees them ---------- */
const r1 = (n) => Math.round(n * 10) / 10;
const overlaps = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
/** A box on the screen in % of the board. */
function pct(r, S0) { return { l: (r.left - S0.left) / S0.width * 100, t: (r.top - S0.top) / S0.height * 100, r: (r.right - S0.left) / S0.width * 100, b: (r.bottom - S0.top) / S0.height * 100 }; }
const panelBoxes = (S0) => Array.from(document.querySelectorAll("#toolLayer .float")).map((w) => pct(w.getBoundingClientRect(), S0));
/** Fade the stickers a panel covers (Stickers step), since the class can't see them. */
function markUnder() {
    const S0 = $("stage").getBoundingClientRect(); if (!S0.width) return;
    const ps = panelBoxes(S0);
    document.querySelectorAll("#stickerLayer .stk").forEach((w) => { const f = w.querySelector(".stkf"), me = f && pct(f.getBoundingClientRect(), S0); w.classList.toggle("under", !!me && ps.some((p) => overlaps(me, p))); });
}
const isUnder = (id) => { const w = document.querySelector('#stickerLayer .stk[data-id="' + id + '"]'); return !!w && w.classList.contains("under"); };
/** An open spot for a sticker: never under a panel or another sticker, and off the day's title, the logo and the class name.
    Off the lesson's words and buttons too when there is room; if there isn't, over the lesson but still in view.
    The strip beside the title first, then the rest of the board from the top; for a copy (near), the open spot closest to it. */
function freeSpot(st, near) {
    const stage = $("stage"), layer = $("stickerLayer"), host = $("screenHost"), S0 = stage.getBoundingClientRect(); if (!layer || !host || !S0.width) return null;
    const probe = el("div", "stk"); probe.style.cssText = "visibility:hidden;left:0;top:0;font-size:" + st.s + "em;transform:rotate(" + st.r + "deg)"; probe.appendChild(stickerFace(st)); layer.appendChild(probe);
    const me = pct(probe.querySelector(".stkf").getBoundingClientRect(), S0); probe.remove();
    const range = document.createRange(), textOf = (e) => { range.selectNodeContents(e); return range.getBoundingClientRect(); };
    const must = panelBoxes(S0).concat(Array.from(layer.querySelectorAll(".stk .stkf")).map((f) => pct(f.getBoundingClientRect(), S0)));
    host.querySelectorAll(".hdr img, .wbstrip img, .cls").forEach((e) => must.push(pct(e.getBoundingClientRect(), S0)));
    host.querySelectorAll(".hdr h1, .hdr .ttl p, .wbstrip h1").forEach((e) => { const r = textOf(e); if (r.width) must.push(pct(r, S0)); });
    const words = [], walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);   // every line of the lesson's text, and its buttons
    for (let n = walk.nextNode(); n && words.length < 600; n = walk.nextNode()) {
        if (!n.nodeValue.trim()) continue; range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width && r.height) words.push(pct(r, S0));
    }
    host.querySelectorAll("button, img, svg, canvas").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.height) words.push(pct(r, S0)); });
    const w = me.r - me.l, h = me.b - me.t, spots = [];
    for (const y of [2, 6]) for (let x = 2; x <= 96 - w; x += 2) spots.push([x, y]);
    for (let y = 12; y <= 96 - h; y += 3) for (let x = 2; x <= 96 - w; x += 2.5) spots.push([x, y]);
    if (near) spots.sort((a, b) => Math.hypot(a[0] - near[0], a[1] - near[1]) - Math.hypot(b[0] - near[0], b[1] - near[1]));
    const gap = 0.8, boxAt = ([x, y]) => ({ l: x + me.l - gap, t: y + me.t - gap, r: x + me.r + gap, b: y + me.b + gap });
    const clear = spots.filter((p) => { const b = boxAt(p); return !must.some((o) => overlaps(b, o)); });
    const hidden = (p) => { const b = boxAt(p); let a = 0; words.forEach((o) => { if (overlaps(b, o)) a += (Math.min(b.r, o.r) - Math.max(b.l, o.l)) * (Math.min(b.b, o.b) - Math.max(b.t, o.t)); }); return a; };
    let ok = null, least = Infinity;   // the first spot that hides none of the lesson, else the one that hides the least
    for (const p of clear) { const a = hidden(p); if (a < least) { least = a; ok = p; if (!a) break; } }
    return ok ? { x: r1(Math.min(96, ok[0])), y: r1(Math.min(94, ok[1])) } : null;
}

/* ---------- 4 Lesson ---------- */
const LINKS = [["seats.html", "Seating charts", "Desks and names for the Seating Chart screen"], ["games.html", "Game Library", "Vault Raid and review games"],
    ["assign.html", "Assignments", "Practice students do on their Chromebooks"], ["bank.html", "Question Bank", "Checked problems by standard"],
    ["plan.html", "Plan the Week", "Next week's plan, sent to Claude"], ["review.html", "Week Review", "Check and approve a week"],
    ["library.html", "Library", "Every week by class and unit"], ["index.html", "Bell times", "On Home, for the period clock and the timeline"]];
/** One lesson, three ways to show it: the slides, the Spotlight screens, and how they connect. Each opens its tab. */
function presentCard() {
    const sl = A.spot.slides(), sc = A.spotScreens(), linked = sc.filter((x) => x.sl).length;
    const box = el("div", "lpres"); box.appendChild(el("p", "lpresh", "Present this lesson"));
    const row = el("div", "lpresrow");
    const tile = (cls, t, sub, fn, label) => { const b = el("button", "lprt " + cls); b.type = "button"; b.title = label; b.setAttribute("aria-label", label); b.append(el("b", null, t), el("small", null, sub)); b.onclick = fn; row.appendChild(b); return b; };
    tile("lsl", "Slides", !A.spot.slidesReady() ? "Getting them…" : sl.length ? sl.length + (sl.length === 1 ? " slide" : " slides") : "None yet: make some", () => A.goMode("slides"), "Open this lesson's slides");
    tile("lsp", "Spotlight", sc.length ? sc.length + (sc.length === 1 ? " screen" : " screens") + (linked ? ", " + linked + " from slides" : "") : "Full screen, panels and drawing", () => A.goMode("spot"), "Open Spotlight for this lesson");
    box.appendChild(row);
    if (sl.length && linked < sl.length) {
        const b = el("button", "btn ghost lprall", "Bring all " + sl.length + " slides into Spotlight"); b.type = "button";
        b.onclick = () => { A.spot.addSlides(sl.map((x) => x.id), "first"); A.goMode("spot"); }; box.appendChild(b);
    }
    return box;
}
function drawLesson() {
    const S = A.S, T = S.tools, d = A.day(), l = A.lesson(), w = A.week();
    {   // the day's lesson
        const top = $("lessonTop"), f = document.createDocumentFragment();
        f.appendChild(head(A.dayName() + "'s lesson", A.classLabel() + " · " + (w ? w.label + (w.dates ? ", " + w.dates : "") : "")));
        const card = el("div", "slesson");
        if (!d) card.appendChild(el("p", "shint", "Nothing is planned for this day yet."));
        else {
            const lt = el("div", "sltg"); lt.appendChild(el("span", "sltag", "Learning target")); const ltp = el("p"); ltp.appendChild(A.rich(d.lt || (l && l.weekLT) || "No learning target yet.")); lt.appendChild(ltp); card.appendChild(lt);
            const ag = (d.agenda || []).filter(Boolean);
            if (ag.length) { const ol = el("ol", "sag"); ag.forEach((t) => { const li = el("li"); li.appendChild(A.rich(t)); ol.appendChild(li); }); card.appendChild(ol); }
            const tags = el("div", "stags"), n = (d.problems || []).length;
            if (n) tags.appendChild(el("span", null, "Bellringer · " + n + (n === 1 ? " problem" : " problems")));
            if (d.notes) tags.appendChild(el("span", null, "Guided notes"));
            if (d.speed || /speed dating/i.test(ag.join(" "))) tags.appendChild(el("span", null, "Speed dating"));
            if ((d.reminders || []).length) tags.appendChild(el("span", null, "Reminders · " + d.reminders.length));
            if (tags.childElementCount) card.appendChild(tags);
        }
        const act = el("div", "sbtns");
        if (!A.guest()) {
            const e = el("a", "btn", "Edit this lesson"); e.href = A.editHref(); e.target = "_blank"; e.rel = "noopener"; e.title = "Agenda, bellringer, learning target, supplies, reminders and exit ticket"; act.appendChild(e);
            const pw = el("a", "btn ghost", "Plan the week"); pw.href = "plan.html"; act.appendChild(pw);
        }
        card.appendChild(act); f.appendChild(card);
        f.appendChild(presentCard());
        top.replaceChildren(f);
    }
    {   // which board each day of the week opens with, and the saved boards
        const box = $("lessonBoards"), f = document.createDocumentFragment(), key = A.lessonKey(), base = key.slice(0, key.lastIndexOf("|") + 1), today = A.dayName(), short = today.slice(0, 3);
        if (T.scenes.length) {
            f.appendChild(head("Boards this week", "A day can open with its own board. When that lesson comes up, the board switches to it. Tap a day to go to it."));
            const wk = el("div", "sweek"); wk.setAttribute("role", "group"); wk.setAttribute("aria-label", "Boards this week, " + A.classLabel());
            A.dayNames().forEach((name, i) => {
                const sc = dayBoardOf(base + i), planned = !!(l && l.days && l.days[i]);
                const b = pressed(btn("sday" + (sc ? " has" : ""), null, () => A.goDay(i), name + (sc ? " opens with “" + sc.n + "”" : planned ? " has no board yet" : ": nothing planned")), i === S.day);
                b.append(el("b", null, name.slice(0, 3)), el("small", null, sc ? sc.n : planned ? "No board" : "No lesson"));
                wk.appendChild(b);
            });
            f.appendChild(wk);
        }
        f.appendChild(head("Your boards", T.scenes.length ? "Use one now, set it as " + today + "'s board, or add it as a step in the run of class. Each keeps its look, panels, stickers and screen." : "Save the board you built with “Save this board” below. It keeps the look, panels, stickers and screen."));
        if (T.scenes.length) {
            const list = el("div", "sboards");
            T.scenes.forEach((sc) => {
                const on = sceneActive(S, sc), row = el("div", "sboard" + (on ? " on" : ""));
                const pv = el("span", "sbpv"); const th = sc.look ? sc.look.theme : null; pv.style.background = gradOf(th || S.look.theme);
                if (sc.look && sc.look.bg) pv.appendChild(el("span", "stagebg pv-" + sc.look.bg));
                (sc.stk || []).slice(0, 3).forEach((st, i) => { const s = el("span", "sbst"); s.style.left = (12 + i * 22) + "%"; s.appendChild(stickerFace(st)); pv.appendChild(s); });
                const tx = el("span", "sbt"); tx.appendChild(el("b", null, sc.n));
                const parts = [nameOf(A.screens(), sc.screen) || "Any screen"], np = Object.keys(sc.on || {}).length; parts.push(np + (np === 1 ? " panel" : " panels"));
                if (sc.stk && sc.stk.length) parts.push(sc.stk.length + (sc.stk.length === 1 ? " sticker" : " stickers"));
                if (!sc.look) parts.push("keeps the look");
                tx.appendChild(el("small", null, parts.join(" · ")));
                const use = btn("btn" + (on ? " ghost" : ""), on ? "Showing" : "Use", () => { applyScene(S, sc, A.toolApi); refresh(); }); use.disabled = on;
                const del = btn("btn ghost danger icon", "×", () => { if (del.dataset.arm !== "1") { del.dataset.arm = "1"; del.textContent = "Delete?"; setTimeout(() => { del.dataset.arm = ""; del.textContent = "×"; }, 3000); return; } T.scenes = T.scenes.filter((x) => x.id !== sc.id); setDayBoard(key); pushNow(); }, "Delete " + sc.n);
                del.setAttribute("aria-label", "Delete " + sc.n);
                row.append(pv, tx, use, del);
                const mine = (T.dayb || {})[key] === sc.id, more = el("div", "sbx");
                more.appendChild(pressed(btn("sbday", mine ? "✓ " + short + "'s board" : "Set as " + short + "'s board", () => giveDay(sc, !mine),
                    mine ? "Stop opening this board with " + today + "'s lesson" : "Open this board whenever " + today + "'s " + A.classLabel() + " lesson comes up"), mine));
                if (!A.guest()) more.appendChild(btn("sbstep", "+ Add to the run of class", () => addStepAndEdit(A.planApi, "scene:" + sc.id), "A bell timeline step that shows this board"));
                row.appendChild(more);
                list.appendChild(row);
            });
            f.appendChild(list);
        }
        box.replaceChildren(f);
    }
    if (A.guest() && !$("planGuest")) { const g = el("p", "shint"); g.id = "planGuest"; g.textContent = "Sign in to use the bell timeline. This demo saves nothing."; $("planAnchor").appendChild(g); }
    {   // the pages that feed the board
        const box = $("lessonLinks"), f = document.createDocumentFragment();
        f.appendChild(head("Connected pages", "Everything the board pulls from. They open in a new tab, and the board picks up changes on its own."));
        const g = el("div", "slinks");
        LINKS.forEach(([u, n, s]) => { const a = el("a", "slink"); a.href = u; a.target = "_blank"; a.rel = "noopener"; a.appendChild(el("b", null, n)); a.appendChild(el("small", null, s)); g.appendChild(a); });
        f.appendChild(g); box.replaceChildren(f);
    }
}

/* ---------- Save this board ---------- */
/** Save this board folds down to one line (name and Undo). It starts folded and remembers how the teacher left it on this device. */
const FOLD_KEY = "ab.studio.saveOpen";
let saveIsOpen = false;
function setSaveOpen(on, keep) {
    const tog = $("saveTog"), body = $("saveBody"); if (!tog || !body) return;
    saveIsOpen = on; body.hidden = !on; tog.setAttribute("aria-expanded", String(on)); $("saveForm").classList.toggle("folded", !on);
    if (keep) try { localStorage.setItem(FOLD_KEY, on ? "1" : "0"); } catch (e) { /* not kept: fine */ }
}
function saveFold() {
    let open = false; try { open = localStorage.getItem(FOLD_KEY) === "1"; } catch (e) { /* private window: start folded */ }
    setSaveOpen(open, false);
    if ($("saveTog")) $("saveTog").onclick = () => { setSaveOpen(!saveIsOpen, true); if (saveIsOpen) $("saveName").focus(); };
}
function saveBoard() {
    const S = A.S, T = S.tools, inp = $("saveName"), n = inp.value.trim();
    if (!n) { inp.focus(); note("saveNote", "Give the board a name first."); return; }
    const same = T.scenes.find((x) => x.n.toLowerCase() === n.toLowerCase()), drop = !same && T.scenes.length >= MAX_SCENES ? T.scenes[0] : null;
    if (drop && $("saveForm").dataset.arm !== n) { $("saveForm").dataset.arm = n; note("saveNote", "You have " + MAX_SCENES + " boards. Saving drops the oldest, “" + drop.n + "”. Press Save again to go ahead."); return; }
    $("saveForm").dataset.arm = "";
    const sc = saveScene(S, n, true), withDay = $("saveDay").checked, all = withDay && $("saveDayFor").value === "all"; inp.value = "";
    (all ? allClassKeys() : [A.lessonKey()]).forEach((k) => setDayBoard(k, withDay ? sc.id : undefined)); A.push();
    note("saveNote", (same ? "Updated “" : "Saved “") + sc.n + "”. " + (all ? "It is " + A.dayName() + "'s board for all your classes now, so it opens whenever those lessons come up."
        : withDay ? "It is " + A.dayName() + "'s board now, so it opens whenever that lesson comes up." : "Use it from Lesson, from Layouts on the Remote, or as a bell timeline step."));
    sigs.lesson = ""; refresh();
}

/* ---------- Day boards: the saved board a lesson (week, class, day) opens with. boardApp.js switches to it when that lesson comes up. ---------- */
const dayBoardOf = (key) => { const T = A.S.tools, id = (T.dayb || {})[key]; return (id && T.scenes.find((x) => x.id === id)) || null; };
/** Give a lesson its board (id), take it back (""), or only tidy up (no id): boards since deleted drop out,
    and past the cap the earliest weeks go first (key order can't be trusted once the database has stored it). */
function setDayBoard(key, id) {
    const T = A.S.tools, d = Object.assign({}, T.dayb || {}), ids = new Set(T.scenes.map((x) => x.id));
    if (id) d[key] = id; else if (id === "") delete d[key];
    Object.keys(d).forEach((k) => { if (!ids.has(d[k])) delete d[k]; });
    const mon = new Map(A.weeks()), when = (k) => mon.get(k.split("|")[0]) || "";
    const rest = Object.keys(d).filter((k) => k !== key).sort((a, b) => when(a).localeCompare(when(b)));
    rest.slice(0, Math.max(0, Object.keys(d).length - MAX_DAYB)).forEach((k) => delete d[k]);
    T.dayb = d;
}
/** The same day of the same week for every class in it ("all my classes" under Save). */
function allClassKeys() { const k = A.lessonKey().split("|"), w = A.week(); return Object.keys((w && w.classes) || {}).map((c) => k[0] + "|" + c + "|" + k[2]); }
/** "Set as Mon's board": this lesson opens with it from now on, and the board shows it now. */
function giveDay(sc, on) {
    setDayBoard(A.lessonKey(), on ? sc.id : "");
    if (on && !sceneActive(A.S, sc)) { applyScene(A.S, sc, A.toolApi); refresh(); } else pushNow();
}
/** The box under Save: named for the lesson on the board, and ticked when that lesson has no board yet.
    It is set again only when the lesson or its board changes, so a box the teacher ticked or cleared stays that way. */
function paintSaveDay() {
    const box = $("saveDay"), lab = $("saveDayLabel"), sel = $("saveDayFor"); if (!box || !lab || !sel) return;
    const key = A.lessonKey(), now = key + "=" + ((A.S.tools.dayb || {})[key] || ""), t = A.dayName() + "'s board for", one = A.classLabel();
    if (lab.textContent !== t) lab.textContent = t;
    if (sel.options[0].textContent !== one) sel.options[0].textContent = one;
    sel.hidden = Object.keys((A.week() || {}).classes || {}).length < 2;   // one class: nothing to choose
    if (!box.onchange) box.onchange = () => { sel.disabled = !box.checked; };
    if (box.dataset.k !== now) {
        if ((box.dataset.k || "").split("=")[0] !== key) note("saveNote", "");   // another lesson: the last save's note is old news
        box.dataset.k = now; box.checked = !dayBoardOf(key);
    }
    sel.disabled = !box.checked;
}
