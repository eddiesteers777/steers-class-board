/* ==========================================
   Anchor Board — the panel Settings drawer.
   The gear on a panel's title bar opens a glass side panel on the right with
   that panel's own settings: size, place, layer, lock, show in all screens,
   then the things only that panel has (timer minutes, alerts, message,
   voice level and mic, webcam, dice, teams, goal, group size).
   Everything writes to the shared board state, so the projector follows.
========================================== */

import { WORK, PALERT_MINS } from "./boardTools.js?v=77";
import { PANEL_COLORS, PANEL_FINISHES, PANEL_CORNERS, PANEL_PRESETS, MIN_SOLID, cleanSty, applySty, swatchBg } from "./panelStyle.js?v=1";
import { themeCols } from "./panels.js?v=37";
import { micSens, setMicSens, micState, micStart, micStop, camMirror, setCamMirror, camState, camStart, camStop, recStart, recStop } from "./roomSense.js?v=1";

let open = "", api = null, box = null, sigWas = "", focusTo = "", paintedFor = "";
const GOALS = [10, 20, 30, 50, 100];
const SIZES = [["S", 0.75], ["M", 1], ["L", 1.5], ["XL", 2.2]];

export const psOpen = () => open;
export function openSettings(k, a, focus) {
    if (open === k && box && !focus) { closeSettings(); return; }
    open = k; api = a; sigWas = ""; paintedFor = ""; focusTo = focus || ""; ensure(); paint(); box.classList.add("show"); document.body.classList.add("psopen");
    api.toolApi.redraw && api.toolApi.redraw();
    setTimeout(() => { const f = box.querySelector(".psx"); if (f) f.focus({ preventScroll: true }); }, 60);
}
export function closeSettings() {
    if (!box) { open = ""; return; }
    const was = open; open = ""; box.classList.remove("show"); document.body.classList.remove("psopen");
    if (was && api && api.toolApi.redraw) api.toolApi.redraw();
}
/** Called on every board render: repaints when that panel's state changed elsewhere (the Remote, another tab). */
export function refreshSettings() {
    if (!open || !box || !api) return;
    if (!api.S.tools.on[open]) { closeSettings(); return; }
    if (box.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (sig() !== sigWas) paint();
}

function sig() {
    const T = api.S.tools, k = open;
    const own = { ptimer: api.S.timers && api.S.timers.free, period: T.palert, text: T.text, work: T.work, traffic: T.traffic, dice: T.dice && T.dice.n, score: T.score, goal: T.goal, groups: T.groups && T.groups.size }[k];
    return JSON.stringify([k, (T.sty || {})[k] || null, T.on, T.pos[k] || null, !!T.min[k], !!(T.pin || {})[k], !!(T.lock || {})[k], (T.zo || []).indexOf(k), (T.zo || []).length, own === undefined ? null : own]);
}

function ensure() {
    if (box) return;
    box = document.createElement("aside"); box.id = "psDrawer"; box.className = "psdrawer"; box.setAttribute("aria-label", "Panel settings");
    box.addEventListener("pointerdown", (e) => e.stopPropagation());
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSettings(); });
    document.body.appendChild(box);
}

function paint() {
    const { S, el, ops, label, icon } = api, k = open, T = S.tools;
    // a tap repaints the drawer: keep the teacher's place in it (a different panel starts at the top)
    const was = box.querySelector(".psbody"), keepTop = was && paintedFor === k ? was.scrollTop : 0; paintedFor = k;
    sigWas = sig(); box.textContent = "";
    const head = el("header", "psh"), ic = el("span", "psic"); ic.innerHTML = icon(k);
    const tt = el("div", "pstt"); tt.append(el("small", null, "Settings"), el("b", null, label(k)));
    const x = btn("psx", icon("x"), "Close settings", closeSettings);
    head.append(ic, tt, x); box.appendChild(head);
    const body = el("div", "psbody"); box.appendChild(body);
    const sec = (t, note) => { const s = el("section", "pssec"); s.appendChild(el("h4", null, t)); if (note) s.appendChild(el("p", "psnote", note)); body.appendChild(s); return s; };
    const row = (s, cls) => { const r = el("div", "psrow" + (cls ? " " + cls : "")); s.appendChild(r); return r; };
    const chips = (s, list, cur, fn, cls) => { const r = row(s, "pschips" + (cls ? " " + cls : "")); list.forEach(([v, t]) => { const b = btn("pschip" + (v === cur ? " on" : ""), t, String(t), () => fn(v)); b.setAttribute("aria-pressed", String(v === cur)); r.appendChild(b); }); return r; };
    const toggle = (s, t, on, fn, sub) => { const r = el("button", "pstog" + (on ? " on" : "")); r.type = "button"; r.setAttribute("role", "switch"); r.setAttribute("aria-checked", String(on)); const l = el("span", "pstl"); l.appendChild(el("b", null, t)); if (sub) l.appendChild(el("small", null, sub)); r.append(l, el("i", "pssw")); r.onclick = fn; s.appendChild(r); return r; };

    /* ---- this panel's own settings first: that is why the teacher opened it ---- */
    own(k, sec, row, chips, toggle);

    /* ---- how it looks: color, finish, see-through (js/panelStyle.js) ---- */
    styleSec(k, sec, row, chips);

    /* ---- size, place, layer ---- */
    const docked = !T.pos[k];
    const s1 = sec("Size and place", docked ? "It sits on the side of the lesson now. Pick a size or a spot to float it." : "");
    const sz = T.pos[k] ? T.pos[k].s || 1 : 1;
    chips(s1, SIZES.map(([t, v]) => [v, t]), SIZES.reduce((a, b) => (Math.abs(b[1] - sz) < Math.abs(a[1] - sz) ? b : a))[1], (v) => ops.size(k, v), "sizes");
    const rr = row(s1, "psrange"); const rg = document.createElement("input"); rg.type = "range"; rg.min = "50"; rg.max = "300"; rg.step = "5"; rg.value = String(Math.round(sz * 100)); rg.setAttribute("aria-label", "Size");
    const rv = el("span", "psrv", Math.round(sz * 100) + "%"); rg.oninput = () => { rv.textContent = rg.value + "%"; }; rg.onchange = () => { ops.size(k, +rg.value / 100); rg.blur(); };
    rr.append(rg, rv);
    const spots = row(s1, "psspots"); [["tl", "Top left"], ["tr", "Top right"], ["c", "Middle"], ["bl", "Bottom left"], ["br", "Bottom right"]].forEach(([v, t]) => { const b = btn("psspot sp-" + v, "<i></i>", t, () => ops.move(k, v)); spots.appendChild(b); });
    const lay = row(s1, "pslayer"); lay.append(btn("psbtn", icon("front") + "<span>Bring to front</span>", "Bring to front", () => ops.front(k)), btn("psbtn", icon("back") + "<span>Send to back</span>", "Send to back", () => ops.back(k)));
    const cs = row(s1, "pslayer"); cs.append(ops.isCentered(k) ? btn("psbtn", icon("stage") + "<span>Back to its spot</span>", "Back to its spot", () => ops.uncenter(k)) : btn("psbtn", icon("stage") + "<span>Center stage</span>", "Center stage", () => ops.center(k)),
        btn("psbtn", icon("min") + "<span>Make it small</span>", "Make it small", () => { ops.small(k); }));

    /* ---- behavior ---- */
    const s2 = sec("On the board");
    toggle(s2, "Show in all screens", ops.pinned(k), () => ops.pin(k), "Stays up when you switch screens or layouts");
    toggle(s2, "Lock in place", ops.locked(k), () => ops.lock(k), "No dragging or resizing by mistake");

    const s3 = el("section", "pssec psend"); body.appendChild(s3);
    if (keepTop) body.scrollTop = keepTop;
    if (focusTo === "style") { focusTo = ""; const st = body.querySelector(".pssty"); if (st) setTimeout(() => body.scrollTo({ top: st.offsetTop - 8, behavior: "smooth" }), 40); }
    s3.appendChild(btn("psbtn danger", icon("trash") + "<span>Remove " + label(k) + "</span>", "Remove", () => { ops.remove(k); closeSettings(); }));
}

function own(k, sec, row, chips, toggle) {
    const { S, el, push, quiet, toolApi } = api, T = S.tools;
    if (k === "ptimer") {
        const tm = (S.timers && S.timers.free) || {}, dur = tm.dur || 300;
        const s = sec("Timer", "Set it here, then start it from the panel or below.");
        chips(s, [1, 2, 3, 5, 10, 15, 20].map((m) => [m * 60, m + " min"]), dur, (v) => { toolApi.timerSet(v); push(); });
        const r = row(s, "psinline"); const n = num(1, 90, Math.round(dur / 60)); r.append(el("span", null, "Custom"), n, el("span", null, "minutes"));
        r.appendChild(btn("psbtn small", "Set", "Set minutes", () => { const m = Math.min(90, Math.max(1, Math.round(+n.value || 1))); toolApi.timerSet(m * 60); push(); }));
        const g = row(s, "pslayer"); g.append(btn("psbtn go", tm.running ? "Running" : "Start", "Start the timer", () => toolApi.timerGo()), btn("psbtn", "Reset", "Reset the timer", () => toolApi.timerReset()));
    } else if (k === "period") {
        const A = T.palert, s = sec("Bell alerts", "A heads-up on the board before class ends. 0 is the bell.");
        toggle(s, "Alerts", A.on, () => { T.palert = Object.assign({}, A, { on: !A.on }); push(); });
        const r = row(s, "pschips"); PALERT_MINS.forEach((m) => { const on = A.at.includes(m); const b = btn("pschip" + (on ? " on" : ""), m ? m + " min" : "Bell", m ? m + " minutes left" : "At the bell", () => { const at = on ? A.at.filter((y) => y !== m) : A.at.concat(m); T.palert = Object.assign({}, A, { on: true, at: PALERT_MINS.filter((y) => at.includes(y)) }); push(); }); b.setAttribute("aria-pressed", String(on)); r.appendChild(b); });
        toggle(s, "Sound", A.sound, () => { T.palert = Object.assign({}, A, { sound: !A.sound }); push(); });
    } else if (k === "text") {
        const s = sec("Message", "Shows on the board as you type.");
        const ta = document.createElement("textarea"); ta.className = "psta"; ta.maxLength = 600; ta.rows = 4; ta.value = T.text || ""; ta.placeholder = "Type a message for the class";
        ta.oninput = () => { T.text = ta.value.slice(0, 600); quiet(); }; ta.onblur = () => { sigWas = sig(); };
        s.appendChild(ta);
        const r = row(s, "pslayer"); r.appendChild(btn("psbtn", "Clear", "Clear the message", () => { T.text = ""; ta.value = ""; push(); }));
    } else if (k === "work") {
        const s = sec("Voice level");
        chips(s, WORK.map((w) => [w[0], w[1]]), T.work, (v) => { T.work = v; push(); });
        const m = micState(), s2 = sec("Room mic", "Listens on this device only. Nothing is recorded or sent anywhere.");
        toggle(s2, "Listen to the room", m.on, async () => { if (m.on) micStop(); else await micStart(); setTimeout(() => { sigWas = ""; refreshSettings(); }, 50); }, m.err || (m.on ? "On: the panel shows how loud it is" : "Your browser asks first"));
        const r = row(s2, "psrange"); const rg = document.createElement("input"); rg.type = "range"; rg.min = "50"; rg.max = "200"; rg.step = "10"; rg.value = String(Math.round(micSens() * 100)); rg.setAttribute("aria-label", "Mic sensitivity");
        const rv = el("span", "psrv", sensWord(micSens())); rg.oninput = () => { setMicSens(+rg.value / 100); rv.textContent = sensWord(+rg.value / 100); };
        r.append(el("span", "psrl", "Sensitivity"), rg, rv);
    } else if (k === "cam") {
        const c = camState(), s = sec("Webcam", "Stays on this device. A recording downloads to this computer.");
        toggle(s, "Camera", c.on, async () => { if (c.on) camStop(); else await camStart(); setTimeout(() => { sigWas = ""; refreshSettings(); }, 50); }, c.err || "");
        toggle(s, "Mirror", camMirror(), () => { setCamMirror(!camMirror()); sigWas = ""; refreshSettings(); }, "Flip it like a mirror");
        if (c.on) { const r = row(s, "pslayer"); r.appendChild(btn("psbtn" + (c.recording ? " danger" : " go"), c.recording ? "Stop and save" : "Record", "Record", () => { if (c.recording) recStop(); else recStart(); setTimeout(() => { sigWas = ""; refreshSettings(); }, 80); })); }
    } else if (k === "traffic") {
        const s = sec("Light");
        chips(s, [["green", "Green"], ["yellow", "Yellow"], ["red", "Red"]], T.traffic, (v) => { T.traffic = v; push(); }, "lights");
    } else if (k === "dice") {
        const s = sec("Dice");
        chips(s, [[1, "1 die"], [2, "2 dice"], [3, "3 dice"]], T.dice.n, (v) => { T.dice = Object.assign({}, T.dice, { n: v }); push(); });
        const r = row(s, "pslayer"); r.appendChild(btn("psbtn go", "Roll", "Roll the dice", () => { T.dice.vals = [0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6)); T.dice.roll = Date.now(); push(); }));
    } else if (k === "score") {
        const s = sec("Teams", "Up to 6 teams.");
        T.score.teams.forEach((tm, i) => {
            const r = row(s, "psteam"); const n = document.createElement("input"); n.type = "text"; n.maxLength = 16; n.value = tm.n; n.setAttribute("aria-label", "Team " + (i + 1) + " name");
            n.onchange = () => { tm.n = (n.value.trim() || "Team " + (i + 1)).slice(0, 16); push(); };
            r.append(n, el("b", "pssc", String(tm.s)));
            if (T.score.teams.length > 1) r.appendChild(btn("psmini", api.icon("x"), "Remove team", () => { T.score.teams.splice(i, 1); push(); }));
        });
        const r = row(s, "pslayer");
        if (T.score.teams.length < 6) r.appendChild(btn("psbtn", "Add a team", "Add a team", () => { T.score.teams.push({ n: "Team " + (T.score.teams.length + 1), s: 0 }); push(); }));
        r.appendChild(btn("psbtn", "Scores to 0", "Reset scores", () => { T.score.teams.forEach((x) => { x.s = 0; }); push(); }));
    } else if (k === "goal") {
        const s = sec("Class goal");
        const t = document.createElement("input"); t.type = "text"; t.className = "pstext"; t.maxLength = 120; t.value = T.goal.text || ""; t.placeholder = "What is the class working toward?";
        t.onchange = () => { T.goal.text = t.value.slice(0, 120); push(); }; s.appendChild(t);
        chips(s, GOALS.map((g) => [g, g + " pts"]), T.goal.target, (v) => { T.goal.target = v; push(); });
        const r = row(s, "pslayer"); r.appendChild(btn("psbtn", "Points to 0 for " + (S.period || "this class"), "Reset points", () => { if (S.period) delete T.goal.pts[S.period]; push(); }));
    } else if (k === "groups") {
        const s = sec("Group size");
        chips(s, [2, 3, 4, 5, 6].map((n) => [n, n + " per group"]), T.groups.size, (v) => { T.groups = Object.assign({}, T.groups, { size: v, order: [] }); push(); });
    } else if (k === "target" || k === "agenda") {
        const s = sec(k === "target" ? "Learning target" : "Agenda", "This comes from the lesson for today.");
        const a = document.createElement("a"); a.className = "psbtn"; a.href = api.editHref(); a.textContent = "Edit the lesson"; s.appendChild(a);
    } else if (k === "pick") {
        sec("Name picker", "It uses the class on the board. Pick a name from the panel.");
    } else {
        sec(api.label(k), "Nothing else to set for this one. Size, place and layer are below.");
    }
}

/* ---------- Style ---------- */
const look = () => themeCols(api.S.look.theme);
function styleSec(k, sec, row, chips) {
    const { S, el, push, quiet } = api, T = S.tools; T.sty = T.sty || {};
    const cur = Object.assign({ c: "paper", f: "solid", o: 100, r: "soft" }, cleanSty(T.sty[k]) || {});
    const set = (o) => { const n = cleanSty(Object.assign({}, cur, o)); if (n) T.sty[k] = n; else delete T.sty[k]; push(); };
    const s = sec("Style", "Color, finish and how much of the board shows through. The board updates as you tap.");
    s.classList.add("pssty");
    /* a live sample of this panel */
    const pv = el("div", "pspv"), pc = el("div", "card tool pspvc"); pc.append(el("h3", null, api.label(k)), el("div", "in")); pc.lastChild.append(el("b", "pspvb", "12:45"), el("small", "pspvs", "Sample text"));
    applySty(pc, cur, look()); pv.appendChild(pc); s.appendChild(pv);
    /* one-tap looks */
    s.appendChild(el("p", "pslab", "Quick looks"));
    const qr = row(s, "pspresets");
    PANEL_PRESETS.forEach(([n, c, f, o]) => {
        const on = cur.c === c && cur.f === f && cur.o === o, b = btn("psprst" + (on ? " on" : ""), "", n, () => set({ c, f, o }));
        const t = el("span", "card pspt"); applySty(t, { c, f, o, r: "soft" }, look()); t.appendChild(el("i")); b.append(t, el("span", "psptn", n)); b.setAttribute("aria-pressed", String(on)); qr.appendChild(b);
    });
    /* color */
    s.appendChild(el("p", "pslab", "Color"));
    const cr = row(s, "psswatches");
    PANEL_COLORS.forEach(([c, n]) => { const b = btn("pssw2" + (cur.c === c ? " on" : ""), "", n, () => set({ c })); const i = el("i"); i.style.background = swatchBg(c, look()); b.append(i, el("span", null, n)); b.setAttribute("aria-pressed", String(cur.c === c)); cr.appendChild(b); });
    /* finish */
    s.appendChild(el("p", "pslab", "Finish"));
    const fr = row(s, "psfinish");
    PANEL_FINISHES.forEach(([f, n, line]) => {
        const b = btn("psfin" + (cur.f === f ? " on" : ""), "", n + ": " + line, () => set({ f })), t = el("span", "card psft"); applySty(t, { c: cur.c, f, o: Math.max(cur.o, 70), r: "soft" }, look());
        const tx = el("span", "psftx"); tx.append(el("b", null, n), el("small", null, line)); b.append(t, tx); b.setAttribute("aria-pressed", String(cur.f === f)); fr.appendChild(b);
    });
    /* see-through */
    const rr = row(s, "psrange psop"); const rg = document.createElement("input"); rg.type = "range"; rg.min = String(MIN_SOLID); rg.max = "100"; rg.step = "5"; rg.value = String(cur.o); rg.setAttribute("aria-label", "How solid");
    const word = (v) => (v >= 100 ? "Solid" : v >= 75 ? "A little see-through" : v >= 55 ? "See-through" : "Very see-through");
    const rv = el("span", "psrv", cur.o + "%");
    const live = () => { const n = cleanSty(Object.assign({}, cur, { o: +rg.value })); rv.textContent = rg.value + "%"; hint.textContent = word(+rg.value);
        document.querySelectorAll('.card[data-panel="' + k + '"]').forEach((c) => applySty(c, n, look())); applySty(pc, n, look()); };
    rg.oninput = () => { live(); if (cleanSty(Object.assign({}, cur, { o: +rg.value }))) T.sty[k] = cleanSty(Object.assign({}, cur, { o: +rg.value })); else delete T.sty[k]; quiet(); };
    rg.onchange = () => { set({ o: +rg.value }); rg.blur(); };
    rr.append(el("span", "psrl", "Solid"), rg, rv);
    const hint = el("p", "psnote pshint", word(cur.o) + (cur.f === "glass" ? ". Glass blurs what is behind it, so words stay clear." : "")); s.appendChild(hint);
    /* corners */
    s.appendChild(el("p", "pslab", "Corners"));
    chips(s, PANEL_CORNERS, cur.r, (r) => set({ r }));
    /* every panel, or back to plain */
    const ar = row(s, "pslayer");
    ar.append(btn("psbtn", "<span>Use on every panel</span>", "Use this style on every panel", () => { const st = cleanSty(cur); Object.keys(T.on).forEach((x) => { if (st) T.sty[x] = Object.assign({}, st); else delete T.sty[x]; }); push(); }),
        btn("psbtn", "<span>Back to plain</span>", "Back to the plain style", () => { delete T.sty[k]; push(); }));
}

function sensWord(v) { return v < 0.8 ? "Low" : v > 1.4 ? "High" : "Normal"; }
function num(min, max, v) { const n = document.createElement("input"); n.type = "number"; n.min = String(min); n.max = String(max); n.value = String(v); n.className = "psnum"; n.inputMode = "numeric"; return n; }
function btn(cls, html, label, fn) { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = html; b.title = label; b.setAttribute("aria-label", label); b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; }
