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
import { PANEL_LIST, LESSON_PANELS, TOOL_LIST } from "./boardTools.js?v=62";
import { panelOn, panelOff, icon, labelOf, PANEL_INFO, lookPicker } from "./panels.js?v=13";
import { wbIcon } from "./wbIcons.js?v=1";

let A = null, host = null, onBack = null, tucked = false, sheet = "", picked = "", built = false, lastSig = "";
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
    spot: '<path d="M12 3v2M5.6 5.6 7 7M3 12h2M18.4 5.6 17 7M21 12h-2"/><path d="M8 16a4 4 0 1 1 8 0"/><path d="M5 20h14"/>',
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
    document.addEventListener("fullscreenchange", paintFull);
    lastSig = ""; paint();
    setTimeout(() => { A.fit(); A.redraw(); }, 0);
}
export function closeSpot() {
    if (!A) return;
    A.spot.draw(false); sheet = ""; picked = "";
    document.body.classList.remove("spotmode", "spotdraw");
    if (host) host.hidden = true;
    window.removeEventListener("keydown", keys, true);
    document.removeEventListener("fullscreenchange", paintFull);
    if (isFull()) toggleFull();
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
    scr.append(button("spb sparrow", svg(IC.prev, 2.2), "Back a screen", () => go(-1)), el("span", "spcount"), button("spb sparrow", svg(IC.next, 2.2), "Next screen", () => go(1)),
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
    full.appendChild(el("i", "spsep"));
    const rack = el("div", "sprack");
    [LESSON_PANELS, TOOL_LIST].forEach((list, li) => {
        if (li) rack.appendChild(el("i", "spsep thin"));
        list.forEach(([k, label]) => {
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
    if (T.on[k] && !T.min[k] && T.pos[k]) { panelOff(T, k); if (picked === k) { picked = ""; sheet = ""; } A.push(); return; }
    // on, small or on the side: bring it onto the screen, floating, right away
    if (T.on[k]) { delete T.min[k]; if (!T.pos[k]) T.pos[k] = A.defaultPos(k); }
    else panelOn(T, k);
    if (!T.pos[k] && k !== "groups") T.pos[k] = A.defaultPos(k);
    A.push();
    if (T.pos[k]) roomFor(k);
    const w = document.querySelector('#toolLayer [data-panel="' + k + '"]'); if (w) { w.classList.remove("sppop"); void w.offsetWidth; w.classList.add("sppop"); }
}
/** A panel that just popped on goes to the first open spot (top right first, then leftward and down), never on top of another one. */
function roomFor(k) {
    const layer = $("toolLayer"), me = layer && layer.querySelector('.float[data-panel="' + k + '"]');
    if (!me || !layer.clientWidth || !layer.clientHeight) return;
    // offsets, not screen boxes: a panel that is popping in is still scaled down
    const LW = layer.clientWidth, LH = layer.clientHeight, pc = (w) => ({ l: w.offsetLeft / LW * 100, t: w.offsetTop / LH * 100, r: (w.offsetLeft + w.offsetWidth) / LW * 100, b: (w.offsetTop + w.offsetHeight) / LH * 100 });
    const others = Array.from(layer.querySelectorAll(".float")).filter((w) => w !== me).map(pc);
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
function go(n) { const p = A.spot.pages(), i = p.n + n; if (i < 0 || i >= p.count) return; A.spot.go(i); }
let delArm = 0;
function removeScreen() {
    if (A.spot.pages().count < 2) { flash("This is the only screen"); return; }
    if (Date.now() - delArm > 3000) { delArm = Date.now(); flash("Tap the trash again to remove this screen"); lastSig = ""; paint(); setTimeout(() => { lastSig = ""; paint(); }, 3100); return; }
    delArm = 0; A.spot.remove(); flash("Screen removed");
}
function openSheet(which) { sheet = which; if (which !== "panel") picked = ""; lastSig = ""; paint(); }
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
    const sig = JSON.stringify([S.screen, T.on, T.min, Object.keys(T.pos), drawing, tucked, sheet, picked, p, A.spot.tool(), A.spot.pen(), A.spot.size(), S.look, Date.now() - delArm < 3000, picked && T.pos[picked] ? T.pos[picked].s : 0]);
    if (sig === lastSig) return; lastSig = sig;
    host.classList.toggle("tucked", tucked); document.body.classList.toggle("spotdraw", drawing);
    // toolbar
    host.querySelectorAll(".spm").forEach((b) => { const on = (b.dataset.m === "draw") === drawing; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("on", on); });
    host.querySelectorAll(".sprack .spt").forEach((b) => {
        const k = b.dataset.k, ok = A.panelOk(k); b.hidden = !ok;
        const st = !T.on[k] ? "off" : T.min[k] ? "min" : "on"; b.dataset.st = st; b.setAttribute("aria-pressed", String(st !== "off"));
        b.title = (st === "off" ? "Add " : st === "min" ? "Bring back " : "Take off ") + labelOf(k).toLowerCase();
    });
    { const b = host.querySelector(".sptbg"); b.setAttribute("aria-pressed", String(sheet === "look")); b.classList.toggle("on", sheet === "look"); }
    { const t = host.querySelector(".sptuck"); t.innerHTML = svg(tucked ? IC.up : IC.down, 2.2); t.title = tucked ? "Show the whole toolbar" : "Make the toolbar small"; t.setAttribute("aria-label", t.title); t.setAttribute("aria-expanded", String(!tucked)); }
    // screens
    { const c = host.querySelector(".spcount"); c.textContent = (p.n + 1) + " / " + p.count;
        const ar = host.querySelectorAll(".sparrow"); ar[0].disabled = p.n <= 0; ar[1].disabled = p.n >= p.count - 1;
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
    const sh = $("spSheet"), want = tucked ? "" : sheet === "panel" && picked && A.S.tools.on[picked] ? "panel:" + picked : sheet === "look" ? "look" : "";
    if (!want) { sh.hidden = true; sh.dataset.k = ""; sh.textContent = ""; return; }
    sh.hidden = false;
    // The look picker redraws itself on each tap (it is built fresh), the panel card when its size changes.
    sh.textContent = ""; sh.dataset.k = want;
    const head = el("div", "spsh");
    if (want === "look") {
        const ic = el("span", "spshi"); ic.innerHTML = svg(IC.bg); head.append(ic, el("b", null, "Background"));
        head.appendChild(button("spb spclose", svg(IC.x, 2.2), "Close", () => openSheet("")));
        sh.appendChild(head);
        const box = el("div", "spshbody"); box.appendChild(lookPicker(Object.assign({}, A.toolApi, { push: () => { A.push(); lastSig = ""; paint(); } }), false)); sh.appendChild(box);
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
