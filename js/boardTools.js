/* ==========================================
   Calera Math — classroom tools screen.
   Small widgets Mr. Steers turns on from the Remote; the Board shows the
   same ones. All state lives in S.tools inside the shared board state.
   Original Calera-look widgets: traffic light, voice level, clock,
   stopwatch, message, dice, scoreboard, class goal.
========================================== */

import { cleanStickers } from "./stickers.js?v=1";
import { cleanSty } from "./panelStyle.js?v=1";
import { cleanFinds } from "./findCore.js?v=1";
import { cleanMt } from "./manipCore.js?v=13";

export const TOOL_LIST = [["traffic", "Traffic light"], ["work", "Voice level"], ["clock", "Clock"], ["stopwatch", "Stopwatch"], ["text", "Message"], ["dice", "Dice"], ["score", "Scoreboard"], ["goal", "Class goal"], ["pick", "Name picker"], ["groups", "Group maker"], ["cam", "Webcam"], ["slide", "Slide"], ["find", "Find a problem"]];
/* Lesson panels (js/panels.js builds them) sit in the same panel system as the tools. */
export const LESSON_PANELS = [["ptimer", "Timer"], ["target", "Learning target"], ["agenda", "Agenda"], ["period", "Period clock"]];
/* More Find panels: they come from a Find panel's "New panel" button, never from the switches, so they are not in TOOL_LIST. */
export const FIND_MORE = [["find2", "Find a problem 2"], ["find3", "Find a problem 3"], ["find4", "Find a problem 4"]];
/* Math manipulatives (js/manipPanels.js, Eddie 2026-11-24): their own group in the panel switches. */
export const MATH_LIST = [["balance", "Equation balance"], ["chance", "Chance lab"], ["line", "Line explorer"], ["xform", "Transformations"], ["pyth", "Pythagorean squares"], ["counters", "Integer counters"], ["angle", "Angle explorer"], ["fn", "Function machine"], ["area", "Expression area model"], ["nl", "Rational number line"], ["sys", "Systems graph"], ["scat", "Scatter plot"], ["tape", "Tape diagram"]];
export const CALC_LIST = [["calc", "Basic calculator"], ["sci", "Scientific calculator"], ["graph", "Graphing calculator"]];
export const PANEL_LIST = LESSON_PANELS.concat(CALC_LIST, TOOL_LIST, MATH_LIST, FIND_MORE);
export const PERIOD_KEYS = ["1st", "2nd", "4th", "5th", "6th"];
export const MAX_SCENES = 12;   // saved layouts and boards (was 6 before the Board Builder, Nov 21)
export const MAX_DAYB = 60;     // day boards kept (about 4 weeks of 3 classes); the oldest go first
const DAYB_KEY = /^[\w.-]{1,40}\|[\w.-]{1,20}\|[0-4]$/;
const today = () => { const d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
let showOut = false; // the "Who is out" list is open on this device only
export const WORK = [["silent", "Silent", "Voices off", 0], ["whisper", "Whisper", "Only your partner can hear", 1], ["partner", "Partner Talk", "Table voices", 2], ["group", "Group Work", "Everyone shares the work", 4]];
const PERIODS = ["1st", "2nd", "4th", "5th", "6th"];
const GOAL_TARGETS = [10, 20, 30, 50, 100];
const GOAL_HINT = "Set a class goal on the Remote.";
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function defaultTools() {
    return { v: 2, on: {}, pos: {}, min: {}, order: [], scenes: [], dayb: {}, agenda: { k: "", at: -1 }, traffic: "green", work: "silent", text: "",
        dice: { n: 2, vals: [3, 5], roll: 0 }, score: { teams: [{ n: "Team 1", s: 0 }, { n: "Team 2", s: 0 }] },
        goal: { text: "", target: 20, pts: {} },
        sw: { running: false, t0: 0, elapsed: 0 },
        pick: { period: "", cur: -1, used: [] }, groups: { period: "", size: 3, order: [] }, absent: { day: "", periods: {} },
        palert: { on: true, at: [5, 1], sound: true },   // Period clock alerts: minutes before the end of class (0 = the bell)
        pin: {}, lock: {}, zo: [], sty: {}, slp: "",
        find: {}, mt: {}, lns: { k: "", at: 0 } };   // mt: the math manipulatives, one entry per panel that was used (js/manipCore.js); find: the Find panel: which bank problem is up, and whether its answer and hints show (js/findPanel.js)   // panels shown on every screen, panels locked in place, the stacking order (back to front), each panel's own style (js/panelStyle.js); lns: a Send to students tapped on a screen that can't run live notes (the board), for the Remote to pick up (js/liveNotes.js)
}
export const PALERT_MINS = [15, 10, 5, 2, 1, 0];
export function mergeTools(d) {
    const t = defaultTools(); if (!d || typeof d !== "object") return t;
    if (d.on && typeof d.on === "object") { t.on = {}; PANEL_LIST.forEach(([k]) => { if (d.on[k]) t.on[k] = true; }); }
    // Panels: minimized ones show as live chips; order is their place on the shelf.
    if (d.min && typeof d.min === "object") PANEL_LIST.forEach(([k]) => { if (d.min[k] && t.on[k]) t.min[k] = true; });
    if (Array.isArray(d.order)) d.order.forEach((k) => { if (PANEL_LIST.some((x) => x[0] === k) && !t.order.includes(k)) t.order.push(k); });
    if (Array.isArray(d.scenes)) t.scenes = d.scenes.slice(0, MAX_SCENES).filter((x) => x && typeof x === "object").map(cleanScene);
    // Day boards (Board Builder): "<week>|<class>|<day 0-4>" -> the saved board that opens with that lesson
    if (d.dayb && typeof d.dayb === "object") { const ids = new Set(t.scenes.map((x) => x.id)); Object.keys(d.dayb).filter((k) => DAYB_KEY.test(k) && typeof d.dayb[k] === "string" && ids.has(d.dayb[k])).slice(-MAX_DAYB).forEach((k) => { t.dayb[k] = d.dayb[k]; }); }
    if (d.agenda && typeof d.agenda.k === "string") t.agenda = { k: d.agenda.k.slice(0, 80), at: Math.max(-1, Math.min(40, Math.floor(+d.agenda.at))) };
    if (!Number.isFinite(t.agenda.at)) t.agenda.at = -1;
    // v 2: tools sit on a shelf unless the teacher floats them. Positions saved before that are dropped once.
    if (d.v === 2 && d.pos && typeof d.pos === "object") PANEL_LIST.forEach(([k]) => { const q = d.pos[k]; if (q) t.pos[k] = { x: Math.min(95, Math.max(0, +q.x || 0)), y: Math.min(92, Math.max(0, +q.y || 0)), s: Math.min(3, Math.max(0.5, +q.s || 1)) }; });
    { const keys = (o) => { const r = {}; if (o && typeof o === "object") PANEL_LIST.forEach(([k]) => { if (o[k]) r[k] = true; }); return r; };
        t.pin = keys(d.pin); t.lock = keys(d.lock);
        if (typeof d.slp === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(d.slp)) t.slp = d.slp;   // which slide the Slide panel shows
        if (d.sty && typeof d.sty === "object") PANEL_LIST.forEach(([k]) => { const s = cleanSty(d.sty[k]); if (s) t.sty[k] = s; });
        if (Array.isArray(d.zo)) d.zo.forEach((k) => { if (PANEL_LIST.some((x) => x[0] === k) && !t.zo.includes(k)) t.zo.push(k); }); }
    if (d.palert && typeof d.palert === "object") t.palert = { on: d.palert.on !== false, sound: d.palert.sound !== false, at: Array.isArray(d.palert.at) ? PALERT_MINS.filter((m) => d.palert.at.includes(m)) : t.palert.at };
    if (["green", "yellow", "red"].includes(d.traffic)) t.traffic = d.traffic;
    if (WORK.some((w) => w[0] === d.work)) t.work = d.work;
    if (typeof d.text === "string") t.text = d.text.slice(0, 600);
    if (d.dice && Array.isArray(d.dice.vals)) t.dice = { n: Math.min(3, Math.max(1, +d.dice.n || 1)), vals: d.dice.vals.slice(0, 3).map((v) => Math.min(6, Math.max(1, +v || 1))), roll: +d.dice.roll || 0 };
    if (d.score && Array.isArray(d.score.teams)) t.score = { teams: d.score.teams.slice(0, 6).map((x) => ({ n: String(x.n || "Team").slice(0, 16), s: +x.s || 0 })) };
    if (d.goal && typeof d.goal === "object") {
        t.goal.text = typeof d.goal.text === "string" ? d.goal.text.slice(0, 120) : "";
        t.goal.target = GOAL_TARGETS.includes(+d.goal.target) ? +d.goal.target : 20;
        if (d.goal.pts && typeof d.goal.pts === "object") PERIOD_KEYS.forEach((k) => { const n = Math.floor(+d.goal.pts[k] || 0); if (n) t.goal.pts[k] = Math.min(999, Math.max(0, n)); });
    }
    const idx = (a) => (Array.isArray(a) ? a.slice(0, 60).map((n) => Math.max(0, Math.floor(+n || 0))) : []);
    if (d.pick) t.pick = { period: PERIOD_KEYS.includes(d.pick.period) ? d.pick.period : "", cur: Number.isInteger(d.pick.cur) ? d.pick.cur : -1, used: idx(d.pick.used) };
    if (d.groups) t.groups = { period: PERIOD_KEYS.includes(d.groups.period) ? d.groups.period : "", size: Math.min(6, Math.max(2, +d.groups.size || 3)), order: idx(d.groups.order) };
    if (d.absent && typeof d.absent.day === "string" && d.absent.periods) { t.absent.day = d.absent.day.slice(0, 10); PERIOD_KEYS.forEach((k) => { if (Array.isArray(d.absent.periods[k])) t.absent.periods[k] = idx(d.absent.periods[k]); }); }
    t.find = cleanFinds(d.find);
    t.mt = cleanMt(d.mt);
    if (d.lns && typeof d.lns.k === "string" && /^[a-z0-9]{1,12}$/.test(d.lns.k) && Number.isFinite(+d.lns.at)) t.lns = { k: d.lns.k, at: Math.max(0, Math.floor(+d.lns.at)) };
    if (d.sw) t.sw = { running: !!d.sw.running, t0: +d.sw.t0 || 0, elapsed: +d.sw.elapsed || 0 };
    return t;
}

/** A saved layout ("scene"): which screen, which panels, where. A board saved in the Board Builder also
    keeps its look (checked again by cleanLook in js/panels.js when it is used) and its stickers. */
export function cleanScene(x) {
    const keys = (o) => { const r = {}; if (o && typeof o === "object") PANEL_LIST.forEach(([k]) => { if (o[k]) r[k] = true; }); return r; };
    const pos = {}; if (x.pos && typeof x.pos === "object") PANEL_LIST.forEach(([k]) => { const q = x.pos[k]; if (q) pos[k] = { x: Math.min(95, Math.max(0, +q.x || 0)), y: Math.min(92, Math.max(0, +q.y || 0)), s: Math.min(3, Math.max(0.5, +q.s || 1)) }; });
    return { id: String(x.id || "").slice(0, 16) || ("u" + Date.now().toString(36)), n: String(x.n || "My layout").slice(0, 24), screen: typeof x.screen === "string" ? x.screen.slice(0, 12) : "",
        on: keys(x.on), min: keys(x.min), pos, order: Array.isArray(x.order) ? x.order.filter((k) => PANEL_LIST.some((p) => p[0] === k)).slice(0, 20) : [], work: WORK.some((w) => w[0] === x.work) ? x.work : "",
        ...lookPart(x) };
}
const word = (v) => (typeof v === "string" && /^[\w-]{1,16}$/.test(v) ? v : undefined);
function lookPart(x) {
    const out = {};
    if (x.look && typeof x.look === "object") { const L = { theme: word(x.look.theme), bg: word(x.look.bg), mark: word(x.look.mark), fx: word(x.look.fx), fxn: [1, 2, 3].includes(+x.look.fxn) ? +x.look.fxn : 2 }; Object.keys(L).forEach((k) => L[k] === undefined && delete L[k]); out.look = L; }
    if (Array.isArray(x.stk)) out.stk = cleanStickers(x.stk);
    return out;
}

function people(n) {
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 120 60"); svg.setAttribute("aria-hidden", "true");
    const count = Math.max(1, n), gap = 120 / (count + 1);
    for (let i = 1; i <= count; i++) {
        const head = document.createElementNS(NS, "circle"); head.setAttribute("cx", gap * i); head.setAttribute("cy", 18); head.setAttribute("r", 9);
        const body = document.createElementNS(NS, "path"); body.setAttribute("d", `M${gap * i - 14} 56 a14 16 0 0 1 28 0 z`);
        svg.appendChild(head); svg.appendChild(body);
    }
    if (n === 0) { const bar = document.createElementNS(NS, "rect"); bar.setAttribute("x", 44); bar.setAttribute("y", 14); bar.setAttribute("width", 32); bar.setAttribute("height", 7); bar.setAttribute("rx", 3); bar.setAttribute("class", "hush"); svg.appendChild(bar); }
    return svg;
}

/** Build one widget as a floating window. api = { S, el, push, quiet, now, card } */
export function buildWidget(k, api) {
    const { S, el, push } = api, T = S.tools, label = (TOOL_LIST.find((x) => x[0] === k) || [k, k])[1];
    const c = api.card(label, "tool tool-" + k), b = c.i;
    {
        if (k === "traffic") {
            const box = el("div", "lights");
            [["red", "Stop"], ["yellow", "Slow down"], ["green", "Go"]].forEach(([col, name]) => { const l = el("button", "light " + col + (T.traffic === col ? " lit" : "")); l.type = "button"; l.setAttribute("aria-label", name); l.setAttribute("aria-pressed", String(T.traffic === col)); l.onclick = () => { T.traffic = col; push(); }; box.appendChild(l); });
            b.appendChild(box);
        } else if (k === "work") {
            const cur = WORK.find((w) => w[0] === T.work) || WORK[0];
            const big = el("div", "voice v-" + cur[0]); big.appendChild(people(cur[3])); big.appendChild(el("p", "vname", cur[1])); big.appendChild(el("p", "vsub", cur[2])); b.appendChild(big);
            const pick = el("div", "minis"); WORK.forEach((w) => { const m = el("button", null, w[1]); m.type = "button"; m.setAttribute("aria-pressed", String(w[0] === T.work)); m.onclick = () => { T.work = w[0]; push(); }; pick.appendChild(m); }); b.appendChild(pick);
        } else if (k === "clock") {
            const t = el("p", "bigtime"); t.id = "toolClock"; const d = el("p", "bigdate"); d.id = "toolDate"; b.appendChild(t); b.appendChild(d);
        } else if (k === "stopwatch") {
            const t = el("p", "bigtime"); t.id = "toolSw"; b.appendChild(t);
            const row = el("div", "minis"), go = el("button", null, T.sw.running ? "Pause" : (T.sw.elapsed ? "Resume" : "Start")), rs = el("button", null, "Reset"); go.type = rs.type = "button";
            go.onclick = () => { if (T.sw.running) { T.sw.elapsed = api.now() - T.sw.t0; T.sw.running = false; } else { T.sw.t0 = api.now() - T.sw.elapsed; T.sw.running = true; } push(); };
            rs.onclick = () => { T.sw = { running: false, t0: 0, elapsed: 0 }; push(); };
            row.appendChild(go); row.appendChild(rs); b.appendChild(row);
        } else if (k === "text") {
            const show = el("p", "msg"); show.id = "toolMsg"; show.textContent = T.text || "Type a message on the Remote."; b.appendChild(show);
            const ta = el("textarea", "msgin"); ta.id = "toolMsgIn"; ta.value = T.text; ta.maxLength = 600; ta.placeholder = "Type here. It shows on the board."; ta.setAttribute("aria-label", "Message for the board");
            ta.oninput = () => { T.text = ta.value; show.textContent = T.text || "Type a message on the Remote."; api.quiet(); };
            b.appendChild(ta);
        } else if (k === "dice") {
            const row = el("div", "dice");
            T.dice.vals.slice(0, T.dice.n).forEach((v) => { const die = el("div", "die"); for (let i = 0; i < 9; i++) die.appendChild(el("i", (PIPS[v] || []).includes(i) ? "pip" : "")); die.setAttribute("aria-label", "Die showing " + v); row.appendChild(die); });
            b.appendChild(row); b.appendChild(el("p", "dsum", T.dice.n > 1 ? "Total: " + T.dice.vals.slice(0, T.dice.n).reduce((a, x) => a + x, 0) : ""));
            const ctl = el("div", "minis"), roll = el("button", null, "Roll"); roll.type = "button";
            roll.onclick = () => { T.dice.vals = [0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6)); T.dice.roll = Date.now(); push(); };
            ctl.appendChild(roll);
            [1, 2, 3].forEach((n) => { const m = el("button", null, n + (n === 1 ? " die" : " dice")); m.type = "button"; m.setAttribute("aria-pressed", String(T.dice.n === n)); m.onclick = () => { T.dice.n = n; while (T.dice.vals.length < 3) T.dice.vals.push(1); push(); }; ctl.appendChild(m); });
            b.appendChild(ctl);
        } else if (k === "score") {
            const row = el("div", "teams");
            T.score.teams.forEach((tm, ti) => {
                const box = el("div", "team"); box.appendChild(el("p", "tname", tm.n)); box.appendChild(el("p", "tscore", String(tm.s)));
                const pm = el("div", "minis"), minus = el("button", null, "−1"), plus = el("button", null, "+1"); minus.type = plus.type = "button"; minus.setAttribute("aria-label", "Take 1 from " + tm.n); plus.setAttribute("aria-label", "Add 1 to " + tm.n);
                minus.onclick = () => { T.score.teams[ti].s -= 1; push(); }; plus.onclick = () => { T.score.teams[ti].s += 1; push(); };
                pm.appendChild(minus); pm.appendChild(plus); box.appendChild(pm); row.appendChild(box);
            });
            b.appendChild(row);
            const ctl = el("div", "minis setup");
            const mk = (label, fn) => { const m = el("button", null, label); m.type = "button"; m.onclick = () => { fn(); push(); }; ctl.appendChild(m); };
            mk("Add team", () => { if (T.score.teams.length < 6) T.score.teams.push({ n: "Team " + (T.score.teams.length + 1), s: 0 }); });
            mk("Remove team", () => { if (T.score.teams.length > 2) T.score.teams.pop(); });
            mk("Use periods", () => { T.score.teams = PERIODS.map((p) => ({ n: p, s: 0 })); });
            mk("Use teams", () => { T.score.teams = [1, 2, 3, 4].map((i) => ({ n: "Team " + i, s: 0 })); });
            mk("Reset scores", () => { T.score.teams.forEach((x) => { x.s = 0; }); });
            b.appendChild(ctl);
        }
        else if (k === "goal") {
            // One class goal, points kept per period. No student names: the whole class earns together.
            const period = S.period || "1st", pts = T.goal.pts[period] || 0, tgt = T.goal.target, done = pts >= tgt;
            const show = el("p", "goaltext"); show.id = "toolGoal"; show.textContent = T.goal.text || GOAL_HINT; b.appendChild(show);
            const inp = el("input", "msgin goalin"); inp.id = "toolGoalIn"; inp.type = "text"; inp.maxLength = 120; inp.value = T.goal.text; inp.placeholder = "Goal, like: Extra recess Friday"; inp.setAttribute("aria-label", "Class goal text");
            inp.oninput = () => { T.goal.text = inp.value; show.textContent = T.goal.text || GOAL_HINT; api.quiet(); };
            b.appendChild(inp);
            const bar = el("div", "goalbar" + (done ? " done" : "")), fill = el("i"); fill.style.width = Math.min(100, Math.round(pts / tgt * 100)) + "%";
            bar.setAttribute("role", "progressbar"); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", String(tgt)); bar.setAttribute("aria-valuenow", String(Math.min(pts, tgt))); bar.setAttribute("aria-label", period + " period class points");
            bar.appendChild(fill); b.appendChild(bar);
            b.appendChild(el("p", "goalnum", done ? "Goal reached! " + pts + " points" : pts + " of " + tgt + " points"));
            b.appendChild(el("p", "vsub", period + " period"));
            const pm = el("div", "minis"), minus = el("button", null, "−1"), plus = el("button", "primary", "+1 class point"); minus.type = plus.type = "button";
            minus.setAttribute("aria-label", "Take 1 point from " + period + " period");
            minus.onclick = () => { T.goal.pts[period] = Math.max(0, pts - 1); push(); }; plus.onclick = () => { T.goal.pts[period] = Math.min(999, pts + 1); push(); };
            pm.appendChild(minus); pm.appendChild(plus); b.appendChild(pm);
            const ctl = el("div", "minis setup");
            GOAL_TARGETS.forEach((n) => { const m = el("button", null, "Goal " + n); m.type = "button"; m.setAttribute("aria-pressed", String(tgt === n)); m.onclick = () => { T.goal.target = n; push(); }; ctl.appendChild(m); });
            const rs = el("button", null, "Reset " + period); rs.type = "button"; rs.onclick = () => { delete T.goal.pts[period]; push(); }; ctl.appendChild(rs);
            b.appendChild(ctl);
        }
        else if (k === "pick" || k === "groups") {
            const st = k === "pick" ? T.pick : T.groups, period = st.period || S.period || "1st", names = (api.rosters()[period]) || [];
            if (T.absent.day !== today()) { T.absent.day = today(); T.absent.periods = {}; } // absences only last the day
            const out = (T.absent.periods[period] || []).filter((i) => i < names.length), here = names.map((_, i) => i).filter((i) => !out.includes(i));
            const pr = el("div", "minis setup"); PERIOD_KEYS.forEach((pk) => { const m = el("button", null, pk); m.type = "button"; m.setAttribute("aria-pressed", String(pk === period)); m.onclick = () => { st.period = pk; if (k === "pick") { st.cur = -1; st.used = []; } else st.order = []; push(); }; pr.appendChild(m); });
            const ob = el("button", null, "Who is out (" + out.length + ")"); ob.type = "button"; ob.setAttribute("aria-pressed", String(showOut)); ob.onclick = () => { showOut = !showOut; api.redraw(); }; pr.appendChild(ob);
            if (!names.length) { b.appendChild(el("p", "vsub", "No names saved for " + period + " period yet. Add them on the Rosters page.")); b.appendChild(pr); }
            else {
                if (k === "pick") {
                    b.appendChild(el("p", "picked", st.cur >= 0 && names[st.cur] ? names[st.cur] : "Ready"));
                    const left = here.filter((i) => !st.used.includes(i)).length;
                    b.appendChild(el("p", "vsub", left + " of " + here.length + " left"));
                    const ctl = el("div", "minis"), go = el("button", "primary", "Pick a name"), rs = el("button", null, "Start over"); go.type = rs.type = "button";
                    go.onclick = () => { if (!here.length) return; let pool = here.filter((i) => !st.used.includes(i)); if (!pool.length) { st.used = []; pool = here.slice(); } st.cur = pool[Math.floor(Math.random() * pool.length)]; st.used.push(st.cur); st.period = period; push(); };
                    rs.onclick = () => { st.cur = -1; st.used = []; push(); };
                    ctl.appendChild(go); ctl.appendChild(rs); b.appendChild(ctl);
                } else {
                    const order = st.order.filter((i) => i < names.length && !out.includes(i)), box = el("div", "groups");
                    if (order.length) { for (let g = 0; g * st.size < order.length; g++) { const col = el("div", "group"); col.appendChild(el("p", "gname", "Group " + (g + 1))); order.slice(g * st.size, (g + 1) * st.size).forEach((i) => col.appendChild(el("p", "gmem", names[i]))); box.appendChild(col); } }
                    else box.appendChild(el("p", "vsub", "Tap Make groups."));
                    b.appendChild(box);
                    const ctl = el("div", "minis"), go = el("button", "primary", "Make groups"); go.type = "button";
                    go.onclick = () => { const a = here.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } st.order = a; st.period = period; push(); };
                    ctl.appendChild(go);
                    [2, 3, 4, 5].forEach((n) => { const m = el("button", null, "Groups of " + n); m.type = "button"; m.setAttribute("aria-pressed", String(st.size === n)); m.onclick = () => { st.size = n; push(); }; ctl.appendChild(m); });
                    b.appendChild(ctl);
                }
                b.appendChild(pr);
                if (showOut) {
                    const list = el("div", "outlist setup"); list.appendChild(el("p", "vsub", "Tap anyone who is out today."));
                    names.forEach((n, i) => { const m = el("button", null, n); m.type = "button"; m.setAttribute("aria-pressed", String(out.includes(i))); m.onclick = () => { const cur = (T.absent.periods[period] || []).slice(), at = cur.indexOf(i); if (at >= 0) cur.splice(at, 1); else cur.push(i); T.absent.periods[period] = cur; push(); }; list.appendChild(m); });
                    b.appendChild(list);
                }
            }
        }
    }
    return c.c;
}

/** Called 4 times a second: clock, stopwatch, and the message text on the board. */
export function tickTools(api) {
    const T = api.S.tools, c = document.getElementById("toolClock");
    if (c) { const d = new Date(api.now()); c.textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); document.getElementById("toolDate").textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }); }
    const sw = document.getElementById("toolSw");
    if (sw) { const ms = T.sw.running ? api.now() - T.sw.t0 : T.sw.elapsed, s = Math.max(0, Math.floor(ms / 1000)); sw.textContent = Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    const msg = document.getElementById("toolMsg"), inp = document.getElementById("toolMsgIn");
    if (msg && document.activeElement !== inp) { msg.textContent = T.text || "Type a message on the Remote."; if (inp && inp.value !== T.text) inp.value = T.text; }
    const goal = document.getElementById("toolGoal"), gin = document.getElementById("toolGoalIn");
    if (goal && document.activeElement !== gin) { goal.textContent = T.goal.text || GOAL_HINT; if (gin && gin.value !== T.goal.text) gin.value = T.goal.text; }
}
