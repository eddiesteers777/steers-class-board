/* ==========================================
   Calera Math — classroom tools screen.
   Small widgets Mr. Steers turns on from the Remote; the Board shows the
   same ones. All state lives in S.tools inside the shared board state.
   Original Calera-look widgets: traffic light, voice level, clock,
   stopwatch, message, dice, scoreboard.
========================================== */

export const TOOL_LIST = [["traffic", "Traffic light"], ["work", "Voice level"], ["clock", "Clock"], ["stopwatch", "Stopwatch"], ["text", "Message"], ["dice", "Dice"], ["score", "Scoreboard"]];
const WORK = [["silent", "Silent", "Voices off", 0], ["whisper", "Whisper", "Only your partner can hear", 1], ["partner", "Partner Talk", "Table voices", 2], ["group", "Group Work", "Everyone shares the work", 4]];
const PERIODS = ["1st", "2nd", "4th", "5th", "6th"];
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function defaultTools() {
    return { on: {}, pos: {}, traffic: "green", work: "silent", text: "",
        dice: { n: 2, vals: [3, 5], roll: 0 }, score: { teams: [{ n: "Team 1", s: 0 }, { n: "Team 2", s: 0 }] },
        sw: { running: false, t0: 0, elapsed: 0 } };
}
export function mergeTools(d) {
    const t = defaultTools(); if (!d || typeof d !== "object") return t;
    if (d.on && typeof d.on === "object") { t.on = {}; TOOL_LIST.forEach(([k]) => { if (d.on[k]) t.on[k] = true; }); }
    if (d.pos && typeof d.pos === "object") TOOL_LIST.forEach(([k]) => { const q = d.pos[k]; if (q) t.pos[k] = { x: Math.min(95, Math.max(0, +q.x || 0)), y: Math.min(92, Math.max(0, +q.y || 0)), s: Math.min(3, Math.max(0.5, +q.s || 1)) }; });
    if (["green", "yellow", "red"].includes(d.traffic)) t.traffic = d.traffic;
    if (WORK.some((w) => w[0] === d.work)) t.work = d.work;
    if (typeof d.text === "string") t.text = d.text.slice(0, 600);
    if (d.dice && Array.isArray(d.dice.vals)) t.dice = { n: Math.min(3, Math.max(1, +d.dice.n || 1)), vals: d.dice.vals.slice(0, 3).map((v) => Math.min(6, Math.max(1, +v || 1))), roll: +d.dice.roll || 0 };
    if (d.score && Array.isArray(d.score.teams)) t.score = { teams: d.score.teams.slice(0, 6).map((x) => ({ n: String(x.n || "Team").slice(0, 16), s: +x.s || 0 })) };
    if (d.sw) t.sw = { running: !!d.sw.running, t0: +d.sw.t0 || 0, elapsed: +d.sw.elapsed || 0 };
    return t;
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
}
