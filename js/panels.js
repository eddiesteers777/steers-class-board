/* ==========================================
   Anchor Board — panels.
   The board is a stage (the lesson screen) plus panels. A panel is a tool
   (js/boardTools.js) or a lesson panel built here: Timer, Learning target,
   Agenda, Period clock. Every panel can be on the shelf beside the lesson,
   floating over it, minimized to a live chip, or off. Layouts ("scenes")
   set the screen and the panels in one tap. All of it lives in S.tools
   inside the shared board state, so the board and the Remote always match.
========================================== */
import { buildWidget, PANEL_LIST, LESSON_PANELS, WORK, cleanScene, PALERT_MINS, MAX_SCENES } from "./boardTools.js?v=60";
import { MARKS, markUrl } from "./marks.js?v=1";
import { EFFECTS, FX_AMOUNTS, applyEffect, effectSample } from "./effects.js?v=2";
import { cleanStickers } from "./stickers.js?v=1";
export { MARKS, EFFECTS, FX_AMOUNTS };

const LESSON = new Set(LESSON_PANELS.map((x) => x[0]));
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
    min: '<path d="M6 12h12"/>', float: '<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    dock: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export const icon = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[k] || IC.layout) + "</svg>";

export const PANEL_INFO = {
    ptimer: "A countdown the whole room can see", target: "Today's learning target", agenda: "Today's plan, and where we are in it", period: "The time, and when class ends",
    traffic: "Stop, slow down, go", work: "From silent to group work", clock: "Time and date", stopwatch: "Count up from zero", text: "Type a note for the room",
    dice: "Roll one to three dice", score: "Points for teams or periods", goal: "Class points toward a reward", pick: "A random name, no repeats", groups: "Random groups from the roster",
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
    T.on = {}; T.min = {}; T.pos = {};
    Object.keys(sc.on).filter(avail).forEach((k) => { T.on[k] = true; if (sc.min[k]) T.min[k] = true; });
    Object.keys(sc.pos || {}).forEach((k) => { if (T.on[k]) T.pos[k] = Object.assign({}, sc.pos[k]); });
    (sc.float || []).forEach((k) => { if (T.on[k] && !T.min[k] && !T.pos[k]) T.pos[k] = (floatAt && floatAt(k, T)) || api.defaultPos(k); });
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
export function panelToggle(T, k) { if (T.on[k] && !T.min[k]) panelOff(T, k); else panelOn(T, k); }
/** Shelf order: the saved order first, then any other panels in list order. */
export function ordered(T, keys) { const o = T.order; return keys.slice().sort((a, b) => { const ia = o.indexOf(a), ib = o.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }); }

/* ---------- lesson panels ---------- */
export function buildPanel(k, api) {
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
    if (k === "work") { const w = WORK.find((x) => x[0] === T.work) || WORK[0]; return { v: w[1], tone: "v-" + w[0] }; }
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
export function refreshSheet() {
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

    [["Lesson", LESSON_PANELS], ["Classroom", PANEL_LIST.filter((p) => !LESSON.has(p[0]))]].forEach(([title, list]) => {
        box.appendChild(el("p", "psec", title));
        const g = el("div", "pgrid");
        list.filter(([k]) => api.panelOk(k)).forEach(([k, label]) => {
            const st = !T.on[k] ? "off" : T.min[k] ? "min" : T.pos[k] ? "float" : "on";
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
];
const presetOn = (L, p) => L.theme === p[2] && L.bg === p[3] && (L.mark || "anchor") === p[4] && (L.fx || "none") === p[5];
export const presetLook = (p, fxn) => ({ theme: p[2], bg: p[3], mark: p[4], fx: p[5], fxn: fxn || 2 });
const XMAS = new Set(["evergreen", "cranberry", "winter"]);
export const defaultLook = () => ({ theme: "navy", bg: "anchor", mark: "anchor", fx: "none", fxn: 2 });
export function cleanLook(o) { const d = defaultLook(); if (!o || typeof o !== "object") return d; if (LOOK_THEMES.some((t) => t[0] === o.theme)) d.theme = o.theme; if (LOOK_BGS.some((b) => b[0] === o.bg)) d.bg = o.bg; if (MARKS.some((m) => m[0] === o.mark)) d.mark = o.mark; if (EFFECTS.some((e) => e[0] === o.fx)) d.fx = o.fx; if ([1, 2, 3].includes(+o.fxn)) d.fxn = +o.fxn; return d; }
export const themeCols = (id) => (LOOK_THEMES.find((x) => x[0] === id) || LOOK_THEMES[0])[2];
export const gradOf = (id) => { const t = LOOK_THEMES.find((x) => x[0] === id) || LOOK_THEMES[0]; return "linear-gradient(135deg," + t[2][0] + " 0%," + t[2][1] + " 55%," + t[2][2] + " 100%)"; };
let lookApplied = "", seal = "brand/logo.svg";
/** The header logo for the current look (brand/logo.svg for Navy + Anchor). */
export const lookSeal = () => seal;
const MARK_VARS = ["--ring-mark", "--ring-mark-light", "--ring-wm"];
export function applyLook(look) {
    applyEffect(look.fx || "none", look.fxn);   // has its own did-it-change check
    const key = look.theme + "|" + look.bg + "|" + (look.mark || "anchor"); if (key === lookApplied) return; lookApplied = key;
    const b = document.body, t = LOOK_THEMES.find((x) => x[0] === look.theme) || LOOK_THEMES[0];
    if (t[0] === "navy") { b.style.removeProperty("--ring-grad"); b.style.removeProperty("--look-out"); b.style.removeProperty("--look-mid"); b.style.removeProperty("--look-hi"); }
    else { b.style.setProperty("--ring-grad", gradOf(t[0])); b.style.setProperty("--look-out", t[2][2]); b.style.setProperty("--look-mid", t[2][1]); b.style.setProperty("--look-hi", t[2][0]); }
    b.dataset.theme = t[0]; b.dataset.bg = look.bg;
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
/** Swatches for the colour scheme and tiles for the background. compact: the Remote's rail. */
export function lookPicker(api, compact) {
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
