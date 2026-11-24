/* ==========================================
   Anchor Board — Spotlight (the Board Builder's third tab, studio.html).
   The board, full screen, built live: the look's own background edge to edge, panels that pop on with one tap,
   and ink right on the background. Everything is the same shared board state as the rest of the Board Builder,
   so the projected board follows (it shows the "Spotlight" screen).

     top left      Back to the Board Builder, and full screen on/off
     bottom        the toolbar: Click / Draw, Background, every panel, and a button to tuck the toolbar away
                   (tucked, it keeps only Click, Draw and the button to bring it back)
     above it      when Draw is on: pen, highlighter, eraser, inks, line size, math tools, undo, clear
     top right     Show on board (lit while the live board shows Spotlight)
     bottom right  the screens: back, "2 / 4", next, and + to add a screen after this one

   Each Spotlight screen keeps its own panels, look and drawing (boardApp.js spotApi; state in wb.spot).
   Frosted glass: translucent layers with a backdrop blur, a light top edge and a soft shadow.
========================================== */
import { PANEL_LIST, LESSON_PANELS, TOOL_LIST, MATH_LIST, CALC_LIST } from "./boardTools.js?v=67";
import { panelOn, panelOff, icon, labelOf, PANEL_INFO, lookPicker, photoGroupNow, gradOf } from "./panels.js?v=26";
import { wbIcon } from "./wbIcons.js?v=1";
import { FIND_KEYS } from "./findCore.js?v=1";

let A = null, host = null, onBack = null, tucked = false, sheet = "", picked = "", built = false, lastSig = "", musicHooked = false;
const PREF = "anchorboard-spot-tucked";
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const svg = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
const IC = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    unfull: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    click: '<path d="M5 3l5.5 15 2.2-6.3L19 9.5z"/><path d="M13 13l5 5"/>',
    bg: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    down: '<path d="M6 9l6 6 6-6"/>', up: '<path d="M6 15l6-6 6 6"/>',
    prev: '<path d="M15 18l-6-6 6-6"/>', next: '<path d="M9 18l6-6-6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    slides: '<rect x="3" y="5" width="13" height="10" rx="2"/><path d="M7 19h13a1 1 0 0 0 1-1V9"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    spot: '<path d="M12 3v2M5.6 5.6 7 7M3 12h2M18.4 5.6 17 7M21 12h-2"/><path d="M8 16a4 4 0 1 1 8 0"/><path d="M5 20h14"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
};
function button(cls, html, label, fn) {
    const b = el("button", cls); b.type = "button"; b.innerHTML = html; if (label) { b.title = label; b.setAttribute("aria-label", label); }
    if (fn) b.onclick = (e) => { e.stopPropagation(); fn(e); };
    return b;
}
const isFull = () => !!document.fullscreenElement;
function toggleFull() {
    try {
        if (isFull()) { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); }
        else { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* the browser said no: the tab still fills the window */ }
}

/** Open Spotlight in host (the studio's #spotApp). back(): go back to the Board Builder. */
export function openSpot(api, hostEl, back) {
    A = api; host = hostEl; onBack = back; sheet = ""; picked = "";
    try { tucked = localStorage.getItem(PREF) === "1"; } catch (e) { tucked = false; }
    if (!built) build();
    host.hidden = false; document.body.classList.add("spotmode");
    A.spot.open(); A.spot.draw(false);
    window.addEventListener("keydown", keys, true);
    hookMusic(); { const m = A.music && A.music(); if (m) m.draw(); }   // the music panel moves above the toolbar
    document.addEventListener("fullscreenchange", paintFull);
    lastSig = ""; paint();
    setTimeout(() => { A.fit(); A.redraw(); }, 0);
}
export function closeSpot() {
    if (!A) return;
    A.spot.draw(false); sheet = ""; picked = "";
    document.body.classList.remove("spotmode", "spotdraw", "spphoto"); document.body.style.removeProperty("--spph");
    if (host) host.hidden = true;
    window.removeEventListener("keydown", keys, true);
    document.removeEventListener("fullscreenchange", paintFull);
    if (isFull()) toggleFull();
    { const m = A.music && A.music(); if (m) m.draw(); }   // the music panel goes back under the top bar
    setTimeout(() => { A.fit(); A.redraw(); }, 0);
}
/** The board changed (here or on another device): bring the buttons up to date. Never rebuilds a button under a finger. */
export function renderSpot() { if (A && host && !host.hidden) paint(); }
/** A panel on the board was tapped: its quick settings open over the toolbar. */
export function pickSpot(kind, id) {
    // Each panel has its own Settings and More menus in its title bar now (js/boardApp.js), so a tap on a panel opens nothing here.
    if (!A || !host || host.hidden) return;
    if (sheet === "panel") { sheet = ""; picked = ""; lastSig = ""; paint(); }
}

/* ---------- the pieces, made once ---------- */
function build() {
    built = true; host.textContent = "";
    // top left: back
    const top = el("div", "spg sptop");
    top.append(button("spb spback", svg(IC.back, 2.2) + "<span>Board Builder</span>", "Back to the Board Builder", () => onBack && onBack()));
    host.appendChild(top);

    // top right: full screen / back to normal, then put Spotlight on the live board (it follows every change from then on)
    const live = el("div", "spg splive");
    live.append(button("spb spfull", svg(IC.full), "Full screen", toggleFull), el("i", "spsep"),
        button("spb splivebtn", "<i></i><span>Show on board</span>", "Show this on the live board", () => { A.spot.open(); flash("On the live board"); }));
    host.appendChild(live);

    // bottom right: the screens
    const scr = el("div", "spg spscr"); scr.id = "spScr"; scr.setAttribute("role", "group"); scr.setAttribute("aria-label", "Screens");
    // the count opens every screen of the lesson, with the lesson's slides ready to bring in
    scr.append(button("spb sparrow", svg(IC.prev, 2.2), "Back a screen", () => go(-1)), button("spb spcount", "", "All screens and slides", () => openSheet(sheet === "screens" ? "" : "screens")), button("spb sparrow", svg(IC.next, 2.2), "Next screen", () => go(1)),
        el("i", "spsep"), button("spb spadd", svg(IC.plus, 2.2) + "<span>Screen</span>", "Add a screen after this one", () => { if (A.spot.add()) flash("New screen"); }),
        button("spb spdel", svg(IC.trash), "Remove this screen", removeScreen));
    host.appendChild(scr);

    // the sheet over the toolbar (Background, or the panel that was tapped)
    const sh = el("div", "spg spsheet"); sh.id = "spSheet"; sh.hidden = true; host.appendChild(sh);

    // the pen row, over the toolbar while Draw is on
    const pen = el("div", "spg sppen"); pen.id = "spPen"; pen.setAttribute("role", "toolbar"); pen.setAttribute("aria-label", "Drawing tools"); host.appendChild(pen);

    // the toolbar
    const dock = el("div", "spg spdock"); dock.id = "spDock"; dock.setAttribute("role", "toolbar"); dock.setAttribute("aria-label", "Spotlight toolbar");
    const modes = el("div", "spmodes"); modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "Click or draw");
    modes.append(button("spm", svg(IC.click) + "<span>Click</span>", "Click: tap and move panels", () => setDraw(false)),
        button("spm", wbIcon("pen") + "<span>Draw</span>", "Draw on the background", () => setDraw(true)));
    modes.firstChild.dataset.m = "click"; modes.lastChild.dataset.m = "draw";
    dock.appendChild(modes);
    const full = el("div", "spfulltools");
    full.appendChild(el("i", "spsep"));
    const bgb = button("spt sptbg", svg(IC.bg) + "<span>Background</span>", "Background, colors and effects", () => openSheet(sheet === "look" ? "" : "look")); bgb.dataset.k = "look"; full.appendChild(bgb);
    // Eddie, 2026-11-23: saved slides right from the toolbar (they come in as screens: js/boardApp.js spotApi)
    const slb = button("spt sptsl", svg(IC.slides) + "<span>Slides</span>", "Bring in your saved slides", () => openSheet(sheet === "slides" ? "" : "slides")); slb.dataset.k = "slides"; full.appendChild(slb);
    // Eddie, 2026-11-24: YouTube music from the toolbar. The same panel, player and library as the board and the top bar
    // (js/ytMusic.js), so the music never restarts when the teacher switches tabs.
    if (A.music && A.music()) {
        const mub = button("spt sptmu", svg(IC.music) + "<i class=\"spmudot\"></i><span>Music</span>", "YouTube music: search, play and your saved videos", () => music("toggle")); full.appendChild(mub);
    }
    full.appendChild(el("i", "spsep"));
    const rack = el("div", "sprack");
    [LESSON_PANELS, CALC_LIST, TOOL_LIST, MATH_LIST].forEach((list, li) => {
        if (li) rack.appendChild(el("i", "spsep thin"));
        list.filter(([k]) => k !== "slide").forEach(([k, label]) => {
            const b = button("spt", icon(k) + "<span>" + shortName(k, label) + "</span>", (PANEL_INFO[k] || label), () => togglePanel(k));
            b.dataset.k = k; rack.appendChild(b);
        });
    });
    full.appendChild(rack);
    dock.appendChild(full);
    dock.appendChild(el("i", "spsep"));
    dock.appendChild(button("spb sptuck", svg(IC.down, 2.2), "Make the toolbar small", () => setTucked(!tucked)));
    host.appendChild(dock);

    const toast = el("p", "sptoast"); toast.id = "spToast"; toast.setAttribute("role", "status"); host.appendChild(toast);
}
const SHORT = { ptimer: "Timer", target: "Target", agenda: "Agenda", period: "Period clock", traffic: "Traffic light", work: "Voice level", stopwatch: "Stopwatch", text: "Message", score: "Scoreboard", goal: "Class goal", pick: "Name picker", groups: "Groups" };
const shortName = (k, label) => SHORT[k] || label;

/* ---------- doing things ---------- */
function togglePanel(k) {
    const T = A.S.tools;
    if (k === "find") {   // one button for every Find panel (up to four): off takes them all off, on brings them all back
        const open = FIND_KEYS.filter((x) => T.on[x]);
        if (open.some((x) => !T.min[x] && T.pos[x])) { open.forEach((x) => panelOff(T, x)); if (FIND_KEYS.includes(picked)) { picked = ""; sheet = ""; } A.push(); return; }
        if (open.length && !(open.length === 1 && open[0] === "find")) {
            open.forEach((x) => { delete T.min[x]; if (!T.pos[x]) T.pos[x] = A.defaultPos(x); }); A.push();
            open.forEach((x) => { const w = document.querySelector('#toolLayer [data-panel="' + x + '"]'); if (w) { w.classList.remove("sppop"); void w.offsetWidth; w.classList.add("sppop"); } });
            return;
        }
    }
    if (T.on[k] && !T.min[k] && T.pos[k]) { panelOff(T, k); if (picked === k) { picked = ""; sheet = ""; } A.push(); return; }
    // on, small or on the side: bring it onto the screen, floating, right away
    if (T.on[k]) { delete T.min[k]; if (!T.pos[k]) T.pos[k] = A.defaultPos(k); }
    else panelOn(T, k);
    if (!T.pos[k] && k !== "groups") T.pos[k] = A.defaultPos(k);
    A.push();
    if (T.pos[k]) roomFor(k);
    const w = document.querySelector('#toolLayer [data-panel="' + k + '"]'); if (w) { w.classList.remove("sppop"); void w.offsetWidth; w.classList.add("sppop"); }
}
/** The Slide panel shows slide id: on, floating, in front. It opens about half the screen, not all of it (Eddie, 2026-11-23). */
function slidePanel(id) {
    const T = A.S.tools, fresh = !T.on.slide || T.min.slide || !T.pos.slide; T.slp = id;
    if (!T.on.slide) panelOn(T, "slide");
    delete T.min.slide;
    if (!T.pos.slide) T.pos.slide = { x: 4, y: 6, s: 1 };
    T.zo = (T.zo || []).filter((x) => x !== "slide").concat(["slide"]);
    A.push();
    if (fresh) { roomFor("slide"); const w = document.querySelector('#toolLayer [data-panel="slide"]'); if (w) { w.classList.remove("sppop"); void w.offsetWidth; w.classList.add("sppop"); } }
}
/** A panel that just popped on goes to the first open spot (top right first, then leftward and down), never on top of another one. */
function roomFor(k) {
    const layer = $("toolLayer"), me = layer && layer.querySelector('.float[data-panel="' + k + '"]');
    if (!me || !layer.clientWidth || !layer.clientHeight) return;
    // offsets, not screen boxes: a panel that is popping in is still scaled down
    const LW = layer.clientWidth, LH = layer.clientHeight, pc = (w) => ({ l: w.offsetLeft / LW * 100, t: w.offsetTop / LH * 100, r: (w.offsetLeft + w.offsetWidth) / LW * 100, b: (w.offsetTop + w.offsetHeight) / LH * 100 });
    const others = Array.from(layer.querySelectorAll(".float")).filter((w) => w !== me).map(pc);
    // the glass cards and the toolbar float over the board too: keep clear of them
    const LR = layer.getBoundingClientRect(), sx = LR.width / LW || 1;
    host.querySelectorAll(".sptop,.splive,.spdock,.spscr").forEach((c) => { const r = c.getBoundingClientRect(); if (!r.width) return;
        others.push({ l: (r.left - LR.left) / sx / LW * 100, t: (r.top - LR.top) / sx / LH * 100, r: (r.right - LR.left) / sx / LW * 100, b: (r.bottom - LR.top) / sx / LH * 100 }); });
    const box = pc(me), w = box.r - box.l, h = box.b - box.t, m = 1.2;
    const hits = (x, y) => others.some((o) => x < o.r + m && x + w > o.l - m && y < o.b + m && y + h > o.t - m);
    if (!hits(box.l, box.t)) return;
    for (let y = 2; y + h <= 98; y += 2) for (let x = 98 - w; x >= 1; x -= 2) {
        if (!hits(x, y)) { const q = Object.assign({}, A.S.tools.pos[k]); q.x = Math.round(Math.min(95, x) * 10) / 10; q.y = Math.round(Math.min(92, y) * 10) / 10; A.S.tools.pos[k] = q; A.push(); return; }
    }
}
function setDraw(on) {
    A.spot.draw(on); document.body.classList.toggle("spotdraw", !!on);
    if (on && sheet) { sheet = ""; picked = ""; }
    lastSig = ""; paint();
}
function setTucked(on) {
    tucked = !!on; try { localStorage.setItem(PREF, tucked ? "1" : "0"); } catch (e) { /* this visit only */ }
    if (tucked) sheet = "";
    lastSig = ""; paint();
}
/** The arrows and the arrow keys: a slide's pieces set to appear on Next come first (an answer, each step of a Show Steps), then the next screen. */
function go(n) { if (A.spot.step) { A.spot.step(n); return; } const p = A.spot.pages(), i = p.n + n; if (i < 0 || i >= p.count) return; A.spot.go(i); }
let delArm = 0;
function removeScreen() {
    if (A.spot.pages().count < 2) { flash("This is the only screen"); return; }
    if (Date.now() - delArm > 3000) { delArm = Date.now(); flash("Tap the trash again to remove this screen"); lastSig = ""; paint(); setTimeout(() => { lastSig = ""; paint(); }, 3100); return; }
    delArm = 0; A.spot.remove(); flash("Screen removed");
}
function openSheet(which) { sheet = which; if (which !== "panel") picked = ""; if (which) music("close"); lastSig = ""; paint(); }
/* The music panel and Spotlight's own sheets pop up in the same place, so one closes the other. */
function music(what) {
    const m = A && A.music && A.music(); if (!m) return;
    if (what === "close") { if (m.isOpen()) m.close(); return; }
    if (!m.isOpen() && sheet) { sheet = ""; picked = ""; lastSig = ""; paint(); }
    m.toggle();
}
function hookMusic() {
    const m = A.music && A.music(); if (!m || musicHooked) return; musicHooked = true;
    m.listen((st) => {
        const b = host && host.querySelector(".sptmu"); if (!b) return;
        const on = st.open && !host.hidden; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("on", on); b.classList.toggle("playing", !!st.playing);
        b.title = st.playing && st.name ? "Playing: " + st.name + ". Tap for the music panel." : "YouTube music: search, play and your saved videos"; b.setAttribute("aria-label", b.title);
    });
}
let toastT = 0;
function flash(t) { const n = $("spToast"); if (!n) return; n.textContent = t; n.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => n.classList.remove("on"), 1800); }
function keys(e) {
    if (!A || host.hidden) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || (e.target && e.target.isContentEditable) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); e.stopPropagation(); go(1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.key === "d" || e.key === "D") { e.stopPropagation(); setDraw(!A.spot.draw()); }
    else if (e.key === "f" || e.key === "F") { e.stopPropagation(); toggleFull(); }
    else if (e.key === "Escape" && sheet) { e.stopPropagation(); openSheet(""); }
    else if (["ArrowUp", "ArrowDown", " ", "m", "M", "a", "A"].includes(e.key)) e.stopPropagation();   // keep the board's own keys from moving the lesson
}

/* ---------- painting: update in place ---------- */
function paintFull() { const b = host && host.querySelector(".spfull"); if (!b) return; const f = isFull(); b.innerHTML = svg(f ? IC.unfull : IC.full); b.title = f ? "Leave full screen" : "Full screen"; b.setAttribute("aria-label", b.title); b.setAttribute("aria-pressed", String(f)); setTimeout(() => A && A.fit(), 80); }
function paint() {
    const S = A.S, T = S.tools, drawing = A.spot.draw(), p = A.spot.pages();
    const sig = JSON.stringify([S.screen, T.on, T.min, Object.keys(T.pos), drawing, tucked, sheet, picked, p, photoGroupNow(), sheet === "screens" || sheet === "slides" ? String(T.slp) + A.spot.slides().map((x) => x.id).join(",") + A.spot.slidesReady() + JSON.stringify(A.S.wb.spot) : "", A.spot.slideIdOf(p.n), A.spot.reveal ? A.spot.reveal() : 0, A.spot.tool(), A.spot.pen(), A.spot.size(), S.look, Date.now() - delArm < 3000, picked && T.pos[picked] ? T.pos[picked].s : 0]);
    if (sig === lastSig) return; lastSig = sig;
    host.classList.toggle("tucked", tucked); document.body.classList.toggle("spotdraw", drawing);
    // a photo background runs edge to edge behind the board, with no frame around it
    { const ph = /^ph-[a-z]+-[a-z]+$/.test(S.look.bg || "") ? S.look.bg.slice(3) : ""; document.body.classList.toggle("spphoto", !!ph);
        // a full address: a url() inside a CSS variable is read from the stylesheet's folder
        if (ph) document.body.style.setProperty("--spph", 'url("' + new URL("photos/" + ph + ".webp", location.href).href + '")'); else document.body.style.removeProperty("--spph"); }
    // toolbar
    host.querySelectorAll(".spm").forEach((b) => { const on = (b.dataset.m === "draw") === drawing; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("on", on); });
    host.querySelectorAll(".sprack .spt").forEach((b) => {
        const k = b.dataset.k, ok = A.panelOk(k); b.hidden = !ok;
        const fk = k === "find" ? FIND_KEYS.filter((x) => T.on[x]) : null;   // the Find button stands for every Find panel
        const st = fk ? (!fk.length ? "off" : fk.every((x) => T.min[x]) ? "min" : "on") : !T.on[k] ? "off" : T.min[k] ? "min" : "on"; b.dataset.st = st; b.setAttribute("aria-pressed", String(st !== "off"));
        b.title = (st === "off" ? "Add " : st === "min" ? "Bring back " : "Take off ") + labelOf(k).toLowerCase();
    });
    { const b = host.querySelector(".sptbg"); b.setAttribute("aria-pressed", String(sheet === "look")); b.classList.toggle("on", sheet === "look"); }
    { const b = host.querySelector(".sptsl"); b.setAttribute("aria-pressed", String(sheet === "slides")); b.classList.toggle("on", sheet === "slides"); }
    { const t = host.querySelector(".sptuck"); t.innerHTML = svg(tucked ? IC.up : IC.down, 2.2); t.title = tucked ? "Show the whole toolbar" : "Make the toolbar small"; t.setAttribute("aria-label", t.title); t.setAttribute("aria-expanded", String(!tucked)); }
    // screens
    { const c = host.querySelector(".spcount"), isSl = !!A.spot.slideIdOf(p.n);
        const rv = A.spot.reveal ? A.spot.reveal() : { at: 0, steps: 0 }, more = rv.at < rv.steps;
        c.innerHTML = (isSl ? '<i class="spslb">' + svg(IC.slides) + "</i>" : "") + "<b>" + (p.n + 1) + " / " + p.count + "</b>" + (rv.steps ? '<small class="sprv">' + (more ? "more on Next" : "all shown") + "</small>" : ""); c.setAttribute("aria-pressed", String(sheet === "screens"));
        c.classList.toggle("on", sheet === "screens"); c.title = isSl ? "This screen shows a slide. Tap to see every screen and slide." : "All screens and slides";
        const ar = host.querySelectorAll(".sparrow"); ar[0].disabled = p.n <= 0 && rv.at <= 0; ar[1].disabled = p.n >= p.count - 1 && !more;
        ar[1].title = more ? "Show the next piece of this slide" : "Next screen"; ar[1].setAttribute("aria-label", ar[1].title);
        host.querySelector(".spadd").disabled = p.count >= p.max;
        const del = host.querySelector(".spdel"); del.hidden = p.count < 2; del.classList.toggle("armed", Date.now() - delArm < 3000); }
    { const b = host.querySelector(".splivebtn"), on = S.screen === "canvas"; b.classList.toggle("onair", on);
        const t = on ? "Live on the board" : "Show on board"; const sp = b.querySelector("span"); if (sp.textContent !== t) sp.textContent = t;
        b.title = on ? "The live board is showing Spotlight. Every change shows there right away." : "The live board moved to another screen. Tap to bring it back to Spotlight."; b.setAttribute("aria-label", b.title); }
    paintPen(drawing);
    paintSheet();
    paintFull();
}
function paintPen(drawing) {
    const row = $("spPen"); row.hidden = !drawing;
    if (!drawing) { row.textContent = ""; return; }
    row.textContent = "";
    const tool = A.spot.tool(), pen = A.spot.pen();
    [["pen", "Pen"], ["hi", "Highlighter"], ["eraser", "Eraser"], ["move", "Move the math tools"]].forEach(([k, l]) => {
        const b = button("spb sptool", wbIcon(k), l, () => { A.spot.setTool(k); lastSig = ""; paint(); });
        b.setAttribute("aria-pressed", String(tool === k)); row.appendChild(b);
    });
    row.appendChild(el("i", "spsep"));
    A.spot.pens().forEach(([k, col, l]) => {
        const b = button("spink", "", l, () => { A.spot.setPen(k); lastSig = ""; paint(); });
        b.style.setProperty("--ink", col); b.setAttribute("aria-pressed", String(pen === k && tool !== "eraser")); row.appendChild(b);
    });
    row.appendChild(el("i", "spsep"));
    const sizes = el("div", "spsizes"); sizes.setAttribute("role", "group"); sizes.setAttribute("aria-label", "Line size");
    ["Thin", "Medium", "Thick"].forEach((l, i) => { const b = button("spsize", "<i></i>", l + " line", () => { A.spot.setSize(i); lastSig = ""; paint(); }); b.dataset.s = i; b.setAttribute("aria-pressed", String(A.spot.size() === i)); sizes.appendChild(b); });
    row.appendChild(sizes);
    row.appendChild(el("i", "spsep"));
    row.append(button("spb sptool amber", wbIcon("math"), "Add a math tool", () => A.spot.math()),
        button("spb sptool", wbIcon("undo"), "Undo", () => A.spot.undo()));
    const clr = button("spb sptool" + (Date.now() - clearArm < 3000 ? " armed" : ""), wbIcon("trash"), Date.now() - clearArm < 3000 ? "Tap again to clear the drawing" : "Clear the drawing", () => {
        if (Date.now() - clearArm < 3000) { clearArm = 0; A.spot.clear(); flash("Drawing cleared"); }
        else { clearArm = Date.now(); flash("Tap again to clear the drawing"); setTimeout(() => { lastSig = ""; paint(); }, 3100); }
        lastSig = ""; paint();
    });
    row.appendChild(clr);
}
let clearArm = 0;
function paintSheet() {
    const sh = $("spSheet"), want = tucked ? "" : sheet === "panel" && picked && A.S.tools.on[picked] ? "panel:" + picked : sheet === "look" ? "look" : sheet === "screens" || sheet === "slides" ? sheet : "";
    if (!want) { sh.hidden = true; sh.dataset.k = ""; sh.textContent = ""; return; }
    sh.hidden = false;
    // The look picker redraws itself on each tap (it is built fresh), the panel card when its size changes.
    const was = sh.querySelector(".spshbody"), keepTop = was && sh.dataset.k === want ? was.scrollTop : 0;
    sh.textContent = ""; sh.dataset.k = want;
    const head = el("div", "spsh");
    if (want === "screens" || want === "slides") { screensSheet(sh, head, keepTop, want === "slides"); return; }
    if (want === "look") {
        const ic = el("span", "spshi"); ic.innerHTML = svg(IC.bg); head.append(ic, el("b", null, "Background"));
        head.appendChild(button("spb spclose", svg(IC.x, 2.2), "Close", () => openSheet("")));
        sh.appendChild(head);
        // rebuilt on every tap, so it keeps its scroll place (a photo far down the list stays in view)
        const redo = () => { lastSig = ""; paint(); };
        const box = el("div", "spshbody"); box.appendChild(lookPicker(Object.assign({}, A.toolApi, { push: () => { A.push(); redo(); }, relook: redo }), false)); sh.appendChild(box);
        if (keepTop) box.scrollTop = keepTop;
        sh.className = "spg spsheet wide";
    } else {
        const k = picked, T = A.S.tools; sh.className = "spg spsheet";
        const ic = el("span", "spshi"); ic.innerHTML = icon(k); head.append(ic, el("b", null, labelOf(k)));
        head.appendChild(button("spb spclose", svg(IC.x, 2.2), "Done", () => { picked = ""; openSheet(""); A.pickPanel(""); }));
        sh.appendChild(head);
        const row = el("div", "spchips"); row.appendChild(el("span", "spchiph", "Size"));
        const cur = T.pos[k] ? T.pos[k].s || 1 : 1;
        [[0.75, "S"], [1, "M"], [1.35, "L"], [1.8, "XL"]].forEach(([s, n]) => {
            const b = button("spchip", n, "Size " + n, () => { const q = T.pos[k] ? Object.assign({}, T.pos[k]) : A.defaultPos(k); q.s = s; T.pos[k] = q; delete T.min[k]; A.push(); });
            b.setAttribute("aria-pressed", String(!!T.pos[k] && Math.abs(cur - s) < 0.05)); row.appendChild(b);
        });
        sh.appendChild(row);
        const act = el("div", "spchips");
        act.appendChild(button("spchip wide", "Make it small", "A live chip at the side", () => { T.min[k] = true; picked = ""; sheet = ""; A.push(); }));
        act.appendChild(button("spchip wide danger", "Take it off", "Take it off the screen", () => { panelOff(T, k); picked = ""; sheet = ""; A.push(); }));
        sh.appendChild(act);
    }
}

/* ---------- Screens and slides: the lesson's whole running order in one place ----------
   Every Spotlight screen as a tile (tap to go there), then the lesson's slides from the Slides tab. A slide brought in
   becomes a screen that shows that slide, with panels and drawing on top; edits made in Slides show up here. */
function screensSheet(sh, head, keepTop, slidesFirst) {
    const S = A.S, p = A.spot.pages(), d = S.wb.spot[[S.week, S.period, "d" + S.day].join("_")], list = A.spot.slides();
    const ic = el("span", "spshi"); ic.innerHTML = svg(IC.grid); if (slidesFirst) ic.innerHTML = svg(IC.slides); head.append(ic, el("b", null, slidesFirst ? "Your slides" : "Screens and slides"));
    head.appendChild(button("spb spclose", svg(IC.x, 2.2), "Close", () => openSheet(""))); sh.appendChild(head);
    sh.className = "spg spsheet wide spscreens";
    const body = el("div", "spshbody"); sh.appendChild(body);
    // From the Slides button on the toolbar the slides come first; from the screen count, the screens do.
    const s1 = el("div", "spspart"), s2 = el("div", "spspart"); body.append(...(slidesFirst ? [s2, s1] : [s1, s2]));
    let box = s1;
    // 1. this lesson's screens, in order
    box.appendChild(el("p", "lookh", "This lesson in Spotlight"));
    const grid = el("div", "spstiles"); box.appendChild(grid);
    const screens = d ? d.s : [];
    screens.forEach((sc, i) => {
        const sl = A.spot.slideOf(i), b = button("spstile" + (i === p.n ? " on" : ""), "", (i + 1) + (sl ? ". Slide" : ". Screen"), () => { A.spot.go(i); });
        const pv = el("span", "spspv"); if (sl) pv.appendChild(A.spot.thumb(sl, 150)); else { pv.style.background = gradOf((sc.look && sc.look.theme) || S.look.theme); const ph = sc.look && /^ph-/.test(sc.look.bg || "") ? sc.look.bg.slice(3) : ""; if (ph) pv.style.backgroundImage = 'url("photos/sm/' + ph + '.webp")'; }
        const n = Object.keys(sc.on || {}).length; if (n) pv.appendChild(el("span", "spspn", n + (n === 1 ? " panel" : " panels")));
        b.append(el("span", "spsnum", String(i + 1)), pv, el("span", "spsnm", sl ? "Slide" + (sl.daily ? " (every day)" : "") : sc.sl ? "Deleted slide" : "Screen"));
        grid.appendChild(b);
    });
    const row = el("div", "spchips");
    row.appendChild(button("spchip wide", svg(IC.plus, 2.2) + "<span>Blank screen</span>", "Add a blank screen after this one", () => { if (A.spot.add()) flash("New screen"); }));
    if (A.spot.slideIdOf(p.n) && A.goMode) row.appendChild(button("spchip wide", svg(IC.edit) + "<span>Edit this slide</span>", "Open this slide in the Slides tab", () => editSlide(A.spot.slideIdOf(p.n))));
    box.appendChild(row);
    // 2. the lesson's slides
    box = s2;
    const have = new Set(screens.map((x) => x.sl).filter(Boolean)), left = list.filter((x) => !have.has(x.id));
    const h = el("div", "spslh"); h.appendChild(el("p", "lookh", "Slides for " + (A.dayName ? A.dayName() : "this lesson")));
    if (left.length > 1 && p.count < p.max) h.appendChild(button("spchip small", "Bring in all " + left.length, "Add every slide as a screen", () => { const n = A.spot.addSlides(left.map((x) => x.id), "first"); flash(n ? n + " slides are now screens" : "No room for more screens"); }));
    box.appendChild(h);
    if (!A.spot.slidesReady()) box.appendChild(el("p", "spnote", "Getting your slides…"));
    else if (!list.length) {
        box.appendChild(el("p", "spnote", "No slides for this lesson yet. Make them in the Slides tab and they show up here, ready to present with panels and drawing."));
        if (A.goMode) box.appendChild(button("spchip wide", svg(IC.slides) + "<span>Make slides</span>", "Open the Slides tab", () => A.goMode("slides")));
    } else {
        const g2 = el("div", "spstiles"); box.appendChild(g2);
        list.forEach((x, i) => {
            // From the Slides button a slide opens as a panel (move it, size it, style it); from the screen count it becomes a screen.
            const T = A.S.tools, inPanel = slidesFirst && T.on.slide && T.slp === x.id;
            const inn = have.has(x.id), b = slidesFirst
                ? button("spstile slide" + (inPanel ? " in" : ""), "", "Open this slide as a panel", () => { slidePanel(x.id); flash("Slide " + (i + 1) + " is up"); })
                : button("spstile slide" + (inn ? " in" : ""), "", inn ? "Go to this slide" : "Bring this slide in after this screen", () => { if (A.spot.openSlide(x.id)) flash(inn ? "Slide " + (i + 1) : "Slide " + (i + 1) + " added"); else flash("No room for more screens"); });
            const pv = el("span", "spspv"); pv.appendChild(A.spot.thumb(x.s, 150));
            b.append(el("span", "spsnum", String(i + 1)), pv, el("span", "spsnm", slidesFirst ? (inPanel ? "On the board" : x.daily ? "Every day · tap to show" : "Tap to show") : inn ? "In Spotlight" : x.daily ? "Every day" : "Tap to bring in"));
            g2.appendChild(b);
        });
    }
    if (keepTop) body.scrollTop = keepTop;
    // the thumbs are drawn 150 wide: stretch each one to its tile
    requestAnimationFrame(() => body.querySelectorAll(".spspv .slthumb").forEach((t) => { const w = t.parentElement.clientWidth; if (w) t.style.transform = "scale(" + (w / 150) + ")"; }));
}
/** Over to the Slides tab, on this lesson, with that slide open. */
function editSlide(id) { if (A.goMode) A.goMode("slides", { week: A.S.week, cls: A.S.cls, day: A.S.day, slide: id }); }
