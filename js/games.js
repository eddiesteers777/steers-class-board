/* ==========================================
   Anchor Board — review games the teacher runs.
   The board shows the game; the Remote runs it. Students never sign in
   and never touch a device. The teacher scores the teams.

   Question sets are the teacher's own and are PRIVATE:
     teacher/{uid}/games/index        the list of saved sets
     teacher/{uid}/games/s_<id>       one question set
     teacher/{uid}/games/live_<per>   the game being played in one period
     teacher/{uid}/games/results      a summary of every finished game (Class Data shows it)
   Nothing here goes in the public repo.

   Games: the Review Board (a grid of categories and point tiles) and
   Treasure Chests (every team answers; teams that got it right open a chest), and
   Class vs. Teacher (the whole class plays together against the teacher).
========================================== */

import { shortNames } from "./vaultCore.js?v=75";
import * as PC from "./profileCore.js?v=2";
import { credit as creditProfiles } from "./profiles.js?v=2";

// The teacher's name on the board in Class vs. Teacher (js/teacherName.js): this device's last one at once, then the
// signed-in account's ("Mr. Steers" on the Calera account, the setup name for a new teacher). "Teacher" when unknown.
let ME = (() => { try { return (JSON.parse(localStorage.getItem("anchor-who") || "null") || {}).name || ""; } catch { return ""; } })();
if (typeof window !== "undefined" && typeof document !== "undefined") import("./teacherName.js?v=1").then((m) => m.myName()).then((n) => { if (n) ME = n; }).catch(() => {});
const teacherName = () => (ME || "Teacher").slice(0, 16);
export const LIMITS = { cats: 6, clues: 6, q: 400, a: 200, title: 80, cat: 60, teams: 6 };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };

/* ---------- math text ---------- */
/* "10^4" and "10^-3" become raised exponents, "3/4" and "{x+1/2}" become stacked fractions,
   and <= >= != sqrt( become their signs. Typed the way the table is already written. */
const tidy = (s) => String(s == null ? "" : s).replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/!=/g, "≠").replace(/sqrt\(/gi, "√(")
    .replace(/(\d)\s*[xX]\s*(10\^)/g, "$1 × $2");
export function mathRich(text) {
    const s = tidy(text), frag = document.createDocumentFragment();
    const re = /\{([^{}/]+)\/([^{}/]+)\}|(?<![\w/.^])(\d+)\/(\d+)(?![\w/.])|\^(-?[A-Za-z0-9.]+|\{[^{}]*\}|\([^()]*\))/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
        if (m.index > last) frag.append(s.slice(last, m.index));
        if (m[5] != null) { let e = m[5]; if (/^[{(]/.test(e)) e = e.slice(1, -1); frag.append(el("sup", "gsup", e.replace(/^-/, "−"))); }
        else { const f = el("span", "frac"), a = el("span"), b = el("span"); a.append(mathRich(m[1] != null ? m[1] : m[3])); b.append(mathRich(m[2] != null ? m[2] : m[4])); f.append(a, b); frag.append(f); }
        last = re.lastIndex;
    }
    frag.append(s.slice(last)); return frag;
}
const mathEl = (tag, cls, text) => { const e = el(tag, cls); e.append(mathRich(text)); return e; };

/* ---------- question sets ---------- */
/** Read the pasted table: CATEGORY | POINTS | QUESTION | ANSWER, one line each (or tab-separated,
    as pasted from a spreadsheet). A category named FINAL becomes the final question.
    Returns { cats, final, problems } and never throws. */
export function parseSet(text) {
    const problems = [], cats = [], byName = new Map(); let final = null;
    const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
    lines.forEach((raw, i) => {
        const line = raw.trim(); if (!line) return;
        let parts = line.includes("\t") ? line.split("\t") : line.split(/\s+\|\s+/);
        parts = parts.map((p) => p.trim()).filter((p, j, a) => !(p === "" && (j === 0 || j === a.length - 1)));
        if (parts.length === 1 && /^[-=|\s:]+$/.test(line)) return;                       // a divider line
        if (parts.length >= 2 && /^(points?|value|pts)$/i.test(parts[1])) return;            // the heading line
        const where = "Line " + (i + 1);
        if (parts.length !== 4) { problems.push(where + ": needs 4 parts (category, points, question, answer) and has " + parts.length + "."); return; }
        const [cat, ptsRaw, q, a] = parts;
        if (!cat || !q || !a) { problems.push(where + ": a part is blank."); return; }
        if (q.length > LIMITS.q) { problems.push(where + ": the question is too long for the board (" + q.length + " letters, limit " + LIMITS.q + ")."); return; }
        if (a.length > LIMITS.a) { problems.push(where + ": the answer is too long (" + a.length + " letters, limit " + LIMITS.a + ")."); return; }
        if (/^final\b/i.test(cat) || /^final$/i.test(ptsRaw)) {
            if (final) { problems.push(where + ": there is already a final question."); return; }
            final = { c: (cat.replace(/^final(\s+question)?\s*[:\-–]?\s*/i, "") || "Final question").slice(0, LIMITS.cat), q, a }; return;
        }
        const p = parseInt(String(ptsRaw).replace(/[^0-9]/g, ""), 10);
        if (!(p > 0)) { problems.push(where + ": the points (\"" + ptsRaw + "\") are not a number."); return; }
        const key = cat.toLowerCase();
        if (!byName.has(key)) {
            if (cats.length >= LIMITS.cats) { problems.push(where + ": more than " + LIMITS.cats + " categories. \"" + cat + "\" was left out."); return; }
            byName.set(key, { n: cat.slice(0, LIMITS.cat), clues: [] }); cats.push(byName.get(key));
        }
        const c = byName.get(key);
        if (c.clues.length >= LIMITS.clues) { problems.push(where + ": more than " + LIMITS.clues + " questions in \"" + c.n + "\"."); return; }
        if (c.clues.some((x) => x.p === p)) problems.push(where + ": \"" + c.n + "\" has two " + p + "-point questions.");
        c.clues.push({ p, q, a });
    });
    cats.forEach((c) => c.clues.sort((x, y) => x.p - y.p));
    return { cats, final, problems };
}
/** The set written back out as the paste table, for editing. */
export function setToText(set) {
    const rows = [];
    (set.cats || []).forEach((c) => c.clues.forEach((k) => rows.push([c.n, k.p, k.q, k.a].join(" | "))));
    if (set.final) rows.push(["FINAL: " + set.final.c, "FINAL", set.final.q, set.final.a].join(" | "));
    return rows.join("\n");
}
const str = (v, n) => String(v == null ? "" : v).slice(0, n);
/** Anything read back from the store is made safe before it is used. */
export function cleanSet(d) {
    if (!d || !Array.isArray(d.cats)) return null;
    const cats = d.cats.slice(0, LIMITS.cats).map((c) => ({ n: str(c && c.n, LIMITS.cat), clues: (Array.isArray(c && c.clues) ? c.clues : []).slice(0, LIMITS.clues)
        .map((k) => extras(k, { p: Math.max(1, Math.floor(+k.p || 0)), q: str(k.q, LIMITS.q), a: str(k.a, LIMITS.a) })).filter((k) => k.q) })).filter((c) => c.clues.length);
    if (!cats.length) return null;
    const f = d.final && d.final.q ? { c: str(d.final.c, LIMITS.cat) || "Final question", q: str(d.final.q, LIMITS.q), a: str(d.final.a, LIMITS.a) } : null;
    return Object.assign({ id: str(d.id, 40), title: str(d.title, LIMITS.title) || "Review game", cats, final: f }, d.maker ? { maker: 1 } : {});
}
/** What the Question Maker adds to a question (other answers to accept, a second-try hint, answer choices) survives a copy. */
function extras(k, out) {
    if (Array.isArray(k.al) && k.al.length) out.al = k.al.slice(0, 8).map((x) => str(x, 80));
    if (k.h) out.h = str(k.h, 200);
    if (Array.isArray(k.st) && k.st.length) out.st = k.st.slice(0, 4).map((x) => str(x, 200)).filter(Boolean);
    if (Array.isArray(k.ch) && k.ch.length >= 2) out.ch = k.ch.slice(0, 5).map((x) => str(x, 80));
    return out;
}
export const countClues = (set) => (set.cats || []).reduce((n, c) => n + c.clues.length, 0);

/* ---------- one game ---------- */
const blankTimer = () => ({ running: false, t0: 0, elapsed: 0 });
function newGame(set, teams) {
    return { v: 1, id: set.id, title: set.title, cats: set.cats, final: set.final || null,
        teams: (teams || ["Team 1", "Team 2", "Team 3"]).map((n) => ({ n, s: 0 })), used: {}, open: null, show: false, tried: [], turn: 0,
        dbl: "", opts: { lose: true, secs: 30, dbl: false }, timer: blankTimer(), hist: [], phase: "play", fstep: 0, wag: [], fdone: [], at: Date.now() };
}
function cleanGame(d) {
    const g = d && d.kind === "chests" ? cleanChests(d) : d && d.kind === "versus" ? cleanVersus(d) : d && d.kind === "shots" ? cleanShots(d) : d && d.kind === "tiles" ? cleanTiles(d) : d && d.kind === "race" ? cleanRace(d) : d && d.kind === "bingo" ? cleanBingo(d) : d && d.kind === "tug" ? cleanTug(d) : d && d.kind === "rapid" ? cleanRapid(d) : d && d.kind === "wheel" ? cleanWheel(d) : d && d.kind === "code" ? cleanCodeGame(d) : cleanBoard(d);
    if (!g) return null;
    g.teams.forEach((t, i) => { const m = d.teams && d.teams[i] && d.teams[i].m; if (Array.isArray(m) && m.length) t.m = m.slice(0, 12).map((x) => str(x, 60)).filter(Boolean); });
    const teamList = (v) => (Array.isArray(v) ? v.map((t) => Math.floor(+t)).filter((t) => t >= 0 && t < LIMITS.teams).slice(0, LIMITS.teams) : null);
    g.log = (Array.isArray(d.log) ? d.log : []).slice(-200).map((x) => Object.assign({ c: str(x && x.c, LIMITS.cat), ok: Math.max(0, Math.floor(+x.ok || 0)), of: Math.max(1, Math.floor(+x.of || 1)), k: str(x && x.k, 8) },
        teamList(x && x.w) && teamList(x && x.x) ? { w: teamList(x.w), x: teamList(x.x) } : {}));
    g.rid = str(d.rid, 40);
    g.pfAt = Math.max(0, Math.floor(+d.pfAt || 0)); g.pfN = Math.max(0, Math.floor(+d.pfN || 0)); g.pfC = d.pfC ? 1 : 0;   // student profiles: log entries already credited, students credited, class credit done
    return g;
}
function cleanBoard(d) {
    const set = cleanSet(d); if (!set || d.v !== 1) return null;
    const g = newGame(set, []), int = (v) => Math.floor(+v || 0);
    g.teams = (Array.isArray(d.teams) ? d.teams : []).slice(0, LIMITS.teams).map((t, i) => ({ n: str(t && t.n, 16) || "Team " + (i + 1), s: int(t && t.s) }));
    while (g.teams.length < 2) g.teams.push({ n: "Team " + (g.teams.length + 1), s: 0 });
    const has = (c, r) => !!(g.cats[c] && g.cats[c].clues[r]);
    if (d.used && typeof d.used === "object") Object.keys(d.used).forEach((k) => { const [c, r] = k.split("-").map(Number); if (has(c, r)) g.used[c + "-" + r] = 1; });
    if (d.open && has(+d.open.c, +d.open.r)) g.open = { c: +d.open.c, r: +d.open.r };
    g.show = !!d.show; g.tried = (Array.isArray(d.tried) ? d.tried : []).map(int).filter((t) => t >= 0 && t < g.teams.length);
    g.turn = Math.min(g.teams.length - 1, Math.max(0, int(d.turn)));
    g.dbl = typeof d.dbl === "string" && /^\d+-\d+$/.test(d.dbl) ? d.dbl : "";
    const o = d.opts || {}; g.opts = { lose: o.lose !== false, secs: [15, 30, 45, 60, 90].includes(+o.secs) ? +o.secs : 30, dbl: !!o.dbl };
    if (d.timer) g.timer = { running: !!d.timer.running, t0: +d.timer.t0 || 0, elapsed: +d.timer.elapsed || 0 };
    g.hist = (Array.isArray(d.hist) ? d.hist : []).slice(-60).map((h) => ({ t: int(h.t), d: int(h.d), k: str(h.k, 8), c: h.c ? 1 : 0, f: h.f ? 1 : 0 }));
    g.phase = ["play", "final", "done"].includes(d.phase) ? d.phase : "play"; if (g.phase === "final" && !g.final) g.phase = "play";
    g.fstep = Math.min(2, Math.max(0, int(d.fstep)));
    g.wag = g.teams.map((_, i) => Math.max(0, int(d.wag && d.wag[i]))); g.fdone = g.teams.map((_, i) => (d.fdone && d.fdone[i] ? 1 : 0));
    g.at = +d.at || 0;
    return g;
}


/* ---------- Treasure Chests ---------- */
/* Every team answers each question on whiteboards. The teacher taps who was right, and each of
   those teams picks one of nine closed chests. What is inside is drawn when it opens. */
const CHESTS = 9;
const PRIZES = [["add", 10, 3], ["add", 20, 3], ["add", 30, 2], ["add", 50, 1], ["dbl", 0, 1], ["steal", 25, 1], ["swap", 0, 1], ["lose", 15, 1], ["none", 0, 1]];
const closedChests = () => Array.from({ length: CHESTS }, () => ({ o: 0, k: "", n: 0, t: -1, x: -1 }));
function questionsOf(set) {   // easiest first: by points, then in category order
    const qs = []; set.cats.forEach((c, ci) => c.clues.forEach((k) => qs.push({ c: c.n, p: k.p, q: k.q, a: k.a, ci })));
    return qs.sort((x, y) => x.p - y.p || x.ci - y.ci).map(({ c, q, a }) => ({ c, q, a }));
}
function newChests(set, teams) {
    return { v: 1, kind: "chests", id: set.id, title: set.title, cats: set.cats, final: null, qs: questionsOf(set), qi: 0,
        teams: (teams || ["Team 1", "Team 2", "Team 3"]).map((n) => ({ n, s: 0 })), cp: "q", show: false, right: [], queue: [], picker: -1,
        chests: closedChests(), last: -1, opts: { secs: 30 }, timer: blankTimer(), snap: [], phase: "play", at: Date.now() };
}
function cleanChests(d) {
    const set = cleanSet(d); if (!set || d.v !== 1) return null;
    const g = newChests(set, []), int = (v) => Math.floor(+v || 0), team = (v) => { const n = int(v); return n >= 0 && n < g.teams.length ? n : -1; };
    g.teams = (Array.isArray(d.teams) ? d.teams : []).slice(0, LIMITS.teams).map((t, i) => ({ n: str(t && t.n, 16) || "Team " + (i + 1), s: Math.max(0, int(t && t.s)) }));
    while (g.teams.length < 2) g.teams.push({ n: "Team " + (g.teams.length + 1), s: 0 });
    g.qi = Math.min(g.qs.length - 1, Math.max(0, int(d.qi)));
    g.cp = ["q", "pick"].includes(d.cp) ? d.cp : "q"; g.show = !!d.show;
    const list = (a) => [...new Set((Array.isArray(a) ? a : []).map(team).filter((t) => t >= 0))];
    g.right = list(d.right); g.queue = list(d.queue); g.picker = team(d.picker);
    if (Array.isArray(d.chests)) g.chests = closedChests().map((c, i) => { const x = d.chests[i] || {}; return x.o ? { o: 1, k: PRIZES.some((p) => p[0] === x.k) ? x.k : "none", n: Math.max(0, int(x.n)), g: Math.max(0, int(x.g)), t: team(x.t), x: x.x === -2 ? -2 : team(x.x) } : c; });
    g.last = int(d.last) >= 0 && int(d.last) < CHESTS ? int(d.last) : -1;
    g.opts = { secs: [15, 30, 45, 60, 90, 120].includes(+(d.opts && d.opts.secs)) ? +d.opts.secs : 30 };
    if (d.timer) g.timer = { running: !!d.timer.running, t0: +d.timer.t0 || 0, elapsed: +d.timer.elapsed || 0 };
    g.snap = (Array.isArray(d.snap) ? d.snap : []).filter((x) => typeof x === "string" && x.length < 20000).slice(-12);
    g.phase = d.phase === "done" ? "done" : "play"; g.at = +d.at || 0;
    if (g.cp === "pick" && g.picker < 0 && !g.queue.length) g.cp = "q";
    return g;
}

/* ---------- Prize Wheel ---------- */
/* Same flow as Treasure Chests: every team answers, the teacher taps who was right, and each of
   those teams spins a 12-wedge wheel on the board. The wedge is drawn on the Remote when it spins;
   the board turns the wheel to it. */
const WHEEL = [["add", 10], ["add", 20], ["dbl", 0], ["add", 10], ["lose", 15], ["add", 30], ["steal", 25], ["add", 20], ["none", 0], ["add", 50], ["swap", 0], ["add", 10]];
const isCh = () => G && (G.kind === "chests" || G.kind === "wheel" || G.kind === "code");
function newWheel(set, teams) {
    const g = newChests(set, teams); delete g.chests; return Object.assign(g, { kind: "wheel", spin: null, rot: 0 });
}
function cleanWheel(d) {
    const g = cleanChests(Object.assign({}, d, { chests: null, last: -1 })); if (!g) return null;
    delete g.chests; g.kind = "wheel"; g.rot = Math.max(0, Math.floor(+d.rot || 0)) % 3600000; g.spin = null;
    const x = d.spin, team = (v) => { const n = Math.floor(+v); return n >= 0 && n < g.teams.length ? n : -1; };
    if (x && +x.w >= 0 && +x.w < WHEEL.length) { const w = Math.floor(+x.w), [k, n] = WHEEL[w]; g.spin = { w, k, n, t: team(x.t), x: x.x === -2 ? -2 : team(x.x), g: Math.max(0, Math.floor(+x.g || 0)) }; if (g.spin.t < 0) g.spin = null; }
    return g;
}
const wheelText = (c) => (c.k === "none" ? "Nothing this time" : prizeText(c));
const curPrize = () => (G.kind === "wheel" ? G.spin : G.last >= 0 ? G.chests[G.last] : null);

/* ---------- Code Breaker ---------- */
/* Same flow as Treasure Chests: every team answers, the teacher taps who was right. Each right
   team scores 10 and gets one guess at a secret code (3 or 4 different digits). The board marks
   each digit of every guess: right digit in the right spot, in the code but somewhere else, or
   not in the code. Everyone sees every guess, so the room reasons it out together. The team that
   cracks the code scores 50, and a new code starts. */
const CODE_RIGHT = 10, CODE_CRACK = 50;
function newCodeStr(len) { const d = [..."0123456789"]; for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d.slice(0, len).join(""); }
const codeMarks = (g, code) => [...g].map((d, i) => (code[i] === d ? "g" : code.includes(d) ? "a" : "x")).join("");
function newCode(set, teams) {
    const g = newChests(set, teams); delete g.chests;
    return Object.assign(g, { kind: "code", code: newCodeStr(4), no: 1, guesses: [], solved: null, lastG: null, opts: { secs: 30, len: 4 } });
}
function cleanCodeGame(d) {
    const g = cleanChests(Object.assign({}, d, { chests: null, last: -1 })); if (!g) return null;
    delete g.chests; g.kind = "code";
    const o = d.opts || {}; g.opts = { secs: g.opts.secs, len: +o.len === 3 ? 3 : 4 };
    g.no = Math.max(1, Math.floor(+d.no || 1));
    const ok = (c) => typeof c === "string" && /^\d{3,4}$/.test(c) && new Set(c).size === c.length;
    g.code = ok(d.code) ? d.code : newCodeStr(g.opts.len);
    const team = (v) => { const n = Math.floor(+v); return n >= 0 && n < g.teams.length ? n : -1; };
    const one = (x) => ({ t: team(x && x.t), g: String((x && x.g) || ""), r: String((x && x.r) || ""), no: Math.floor(+(x && x.no) || 0), qi: Math.floor(+(x && x.qi) || 0) });
    const good = (x) => x.t >= 0 && /^\d{3,4}$/.test(x.g) && /^[gax]{3,4}$/.test(x.r) && x.r.length === x.g.length;
    g.guesses = (Array.isArray(d.guesses) ? d.guesses : []).slice(-40).map(one).filter(good);
    g.lastG = d.lastG ? one(d.lastG) : null; if (g.lastG && !good(g.lastG)) g.lastG = null;
    g.solved = d.solved && team(d.solved.t) >= 0 && ok(String(d.solved.c)) ? { t: team(d.solved.t), c: String(d.solved.c), no: Math.floor(+d.solved.no || 0), qi: Math.floor(+d.solved.qi || 0) } : null;
    return g;
}
let codeEntry = "";
function codeGuess(g) {
    if (!G || G.kind !== "code" || G.cp !== "pick" || G.picker < 0 || g.length !== G.code.length || (G.lastG && G.lastG.t === G.picker)) return;
    save();
    const r = codeMarks(g, G.code), entry = { t: G.picker, g, r, no: G.no, qi: G.qi };
    G.guesses.push(entry); G.guesses = G.guesses.slice(-40); G.lastG = entry;
    if (!r.includes("a") && !r.includes("x")) {
        G.teams[G.picker].s += CODE_CRACK; G.solved = { t: G.picker, c: G.code, no: G.no, qi: G.qi };
        G.no++; G.code = newCodeStr(G.opts.len);
    }
    codeEntry = ""; A.unlockSound(); changed();
}

/* ---------- Class vs. Teacher ---------- */
/* The whole class answers each question on whiteboards. The teacher looks at the boards and
   gives the point to the class (enough were right) or to the teacher. First to the goal wins. */
const VS_GOALS = [5, 7, 10, 15], VS_RULES = ["Every board right", "Almost every board right", "Most boards right"];
function newVersus(set, teacher) {
    return { v: 1, kind: "versus", id: set.id, title: set.title, cats: set.cats, final: null, qs: questionsOf(set), qi: 0,
        teams: [{ n: "Class", s: 0 }, { n: (teacher || teacherName()).slice(0, 16), s: 0 }], cp: "q", show: false, won: -1, streak: 0,
        opts: { secs: 60, goal: 7, rule: 1 }, timer: blankTimer(), snap: [], phase: "play", at: Date.now() };
}
function cleanVersus(d) {
    const set = cleanSet(d); if (!set || d.v !== 1) return null;
    const g = newVersus(set, d.teams && d.teams[1] && str(d.teams[1].n, 16)), int = (v) => Math.floor(+v || 0);
    g.teams.forEach((t, i) => { t.s = Math.max(0, int(d.teams && d.teams[i] && d.teams[i].s)); });
    g.qi = Math.min(g.qs.length - 1, Math.max(0, int(d.qi))); g.cp = d.cp === "result" ? "result" : "q"; g.show = !!d.show;
    g.won = [0, 1].includes(+d.won) ? +d.won : -1; if (g.cp === "result" && g.won < 0) g.cp = "q";
    g.streak = Math.max(0, int(d.streak));
    const o = d.opts || {}; g.opts = { secs: [15, 30, 45, 60, 90, 120].includes(+o.secs) ? +o.secs : 60, goal: VS_GOALS.includes(+o.goal) ? +o.goal : 7, rule: [0, 1, 2].includes(+o.rule) ? +o.rule : 1 };
    if (d.timer) g.timer = { running: !!d.timer.running, t0: +d.timer.t0 || 0, elapsed: +d.timer.elapsed || 0 };
    g.snap = (Array.isArray(d.snap) ? d.snap : []).filter((x) => typeof x === "string" && x.length < 20000).slice(-12);
    g.phase = d.phase === "done" ? "done" : "play"; g.at = +d.at || 0;
    return g;
}

/* ---------- Trashketball ---------- */
/* Every team answers each question on whiteboards. The teacher taps who was right; each of those
   teams earns the answer points, then sends one shooter to toss a paper ball at the can from the
   1, 2 or 3 point line. The teacher taps what happened and the board keeps score. */
const SHOT_ANS = [0, 1, 2], SHOT_LINES = [[1, "1-point line"], [2, "2-point line"], [3, "3-point line"]];
function newShots(set, teams) {
    return { v: 1, kind: "shots", id: set.id, title: set.title, cats: set.cats, final: null, qs: questionsOf(set), qi: 0,
        teams: (teams || ["Team 1", "Team 2", "Team 3"]).map((n) => ({ n, s: 0 })), cp: "q", show: false, right: [], queue: [], shooter: -1, shot: -1, made: [],
        opts: { secs: 30, ans: 1 }, timer: blankTimer(), snap: [], phase: "play", at: Date.now() };
}
function cleanShots(d) {
    const set = cleanSet(d); if (!set || d.v !== 1) return null;
    const g = newShots(set, []), int = (v) => Math.floor(+v || 0), team = (v) => { const n = int(v); return n >= 0 && n < g.teams.length ? n : -1; };
    g.teams = (Array.isArray(d.teams) ? d.teams : []).slice(0, LIMITS.teams).map((t, i) => ({ n: str(t && t.n, 16) || "Team " + (i + 1), s: Math.max(0, int(t && t.s)) }));
    while (g.teams.length < 2) g.teams.push({ n: "Team " + (g.teams.length + 1), s: 0 });
    g.qi = Math.min(g.qs.length - 1, Math.max(0, int(d.qi)));
    g.cp = d.cp === "shoot" ? "shoot" : "q"; g.show = !!d.show;
    const list = (a) => [...new Set((Array.isArray(a) ? a : []).map(team).filter((t) => t >= 0))];
    g.right = list(d.right); g.queue = list(d.queue); g.shooter = team(d.shooter);
    g.shot = [0, 1, 2, 3].includes(+d.shot) && d.shot !== null && d.shot !== "" ? +d.shot : -1;
    g.made = (Array.isArray(d.made) ? d.made : []).slice(-40).map((m) => ({ t: team(m && m.t), n: Math.min(3, Math.max(0, int(m && m.n))) })).filter((m) => m.t >= 0);
    const o = d.opts || {}; g.opts = { secs: [15, 30, 45, 60, 90, 120].includes(+o.secs) ? +o.secs : 30, ans: SHOT_ANS.includes(+o.ans) ? +o.ans : 1 };
    if (d.timer) g.timer = { running: !!d.timer.running, t0: +d.timer.t0 || 0, elapsed: +d.timer.elapsed || 0 };
    g.snap = (Array.isArray(d.snap) ? d.snap : []).filter((x) => typeof x === "string" && x.length < 20000).slice(-12);
    g.phase = d.phase === "done" ? "done" : "play"; g.at = +d.at || 0;
    if (g.cp === "shoot" && g.shooter < 0) g.cp = "q";
    return g;
}

/* ---------- Mystery Tiles ---------- */
/* A phrase the teacher types hides behind 12 numbered tiles. Teams that answer right each flip a
   tile (+10). Any team can guess the phrase when the teacher calls on them: solving it is worth
   50 plus 10 for every tile still covered. Then a new mystery, or the final scores. */
const TILE_N = 12, TILE_PTS = 10, SOLVE_BASE = 50;
function newTiles(set, teams) {
    return { v: 1, kind: "tiles", id: set.id, title: set.title, cats: set.cats, final: null, qs: questionsOf(set), qi: 0,
        teams: (teams || ["Team 1", "Team 2", "Team 3"]).map((n) => ({ n, s: 0 })), cp: "setup", show: false, right: [], queue: [], picker: -1,
        tiles: Array(TILE_N).fill(0), flip: -1, ph: "", hint: "", solver: -1, got: 0, adv: 0, round: 1, opts: { secs: 30 }, timer: blankTimer(), snap: [], phase: "play", at: Date.now() };
}
function cleanTiles(d) {
    const set = cleanSet(d); if (!set || d.v !== 1) return null;
    const g = newTiles(set, []), int = (v) => Math.floor(+v || 0), team = (v) => { const n = int(v); return n >= 0 && n < g.teams.length ? n : -1; };
    g.teams = (Array.isArray(d.teams) ? d.teams : []).slice(0, LIMITS.teams).map((t, i) => ({ n: str(t && t.n, 16) || "Team " + (i + 1), s: Math.max(0, int(t && t.s)) }));
    while (g.teams.length < 2) g.teams.push({ n: "Team " + (g.teams.length + 1), s: 0 });
    g.qi = Math.min(g.qs.length - 1, Math.max(0, int(d.qi)));
    g.cp = ["setup", "q", "pick", "solved"].includes(d.cp) ? d.cp : "setup"; g.show = !!d.show;
    const list = (a) => [...new Set((Array.isArray(a) ? a : []).map(team).filter((t) => t >= 0))];
    g.right = list(d.right); g.queue = list(d.queue); g.picker = team(d.picker);
    g.tiles = Array.from({ length: TILE_N }, (_, i) => (Array.isArray(d.tiles) && d.tiles[i] ? 1 : 0));
    g.flip = int(d.flip) >= 0 && int(d.flip) < TILE_N && d.flip !== null && d.flip !== "" && d.flip !== undefined ? int(d.flip) : -1;
    g.ph = str(d.ph, 60).trim(); g.hint = str(d.hint, 60).trim(); g.solver = team(d.solver); g.got = Math.max(0, int(d.got)); g.adv = d.adv ? 1 : 0; g.round = Math.max(1, int(d.round) || 1);
    g.opts = { secs: [15, 30, 45, 60, 90, 120].includes(+(d.opts && d.opts.secs)) ? +d.opts.secs : 30 };
    if (d.timer) g.timer = { running: !!d.timer.running, t0: +d.timer.t0 || 0, elapsed: +d.timer.elapsed || 0 };
    g.snap = (Array.isArray(d.snap) ? d.snap : []).filter((x) => typeof x === "string" && x.length < 20000).slice(-12);
    g.phase = d.phase === "done" ? "done" : "play"; g.at = +d.at || 0;
    if (!g.ph) g.cp = "setup";
    if (g.cp === "pick" && g.picker < 0) g.cp = "q";
    if (g.cp === "solved" && g.solver < 0) g.cp = "q";
    return g;
}

/* ---------- Ring Race ---------- */
/* Every team has a ring. Each question, every team answers on whiteboards; each team that was right
   moves one step around its ring (the fastest right team can earn a bonus step). First team to
   close its ring wins. */
const RACE_GOALS = [5, 7, 10, 12];
function newRace(set, teams) {
    return { v: 1, kind: "race", id: set.id, title: set.title, cats: set.cats, final: null, qs: questionsOf(set), qi: 0,
        teams: (teams || ["Team 1", "Team 2", "Team 3"]).map((n) => ({ n, s: 0 })), cp: "q", show: false, right: [], fast: -1, gained: [],
        opts: { secs: 30, goal: 7, fast: true }, timer: blankTimer(), snap: [], phase: "play", at: Date.now() };
}
function cleanRace(d) {
    const set = cleanSet(d); if (!set || d.v !== 1) return null;
    const g = newRace(set, []), int = (v) => Math.floor(+v || 0), team = (v) => { const n = int(v); return n >= 0 && n < g.teams.length && v !== null && v !== "" && v !== undefined ? n : -1; };
    g.teams = (Array.isArray(d.teams) ? d.teams : []).slice(0, LIMITS.teams).map((t, i) => ({ n: str(t && t.n, 16) || "Team " + (i + 1), s: Math.max(0, int(t && t.s)) }));
    while (g.teams.length < 2) g.teams.push({ n: "Team " + (g.teams.length + 1), s: 0 });
    g.qi = Math.min(g.qs.length - 1, Math.max(0, int(d.qi))); g.cp = d.cp === "result" ? "result" : "q"; g.show = !!d.show;
    const list = (a) => [...new Set((Array.isArray(a) ? a : []).map(team).filter((t) => t >= 0))];
    g.right = list(d.right); g.fast = team(d.fast); if (!g.right.includes(g.fast)) g.fast = -1; g.gained = list(d.gained);
    const o = d.opts || {}; g.opts = { secs: [15, 30, 45, 60, 90, 120].includes(+o.secs) ? +o.secs : 30, goal: RACE_GOALS.includes(+o.goal) ? +o.goal : 7, fast: o.fast !== false };
    if (d.timer) g.timer = { running: !!d.timer.running, t0: +d.timer.t0 || 0, elapsed: +d.timer.elapsed || 0 };
    g.snap = (Array.isArray(d.snap) ? d.snap : []).filter((x) => typeof x === "string" && x.length < 20000).slice(-12);
    g.phase = d.phase === "done" ? "done" : "play"; g.at = +d.at || 0;
    return g;
}

/* ---------- Bingo ---------- */
/* Paper cards printed from a set's answers (bingo.html). The teacher calls the questions in a
   shuffled order; students solve each one and mark the answer if it is on their card. Cards come
   from a seeded shuffle, so the Remote can rebuild any card by its number to check a claim. */
const normAns = (a) => String(a).trim().replace(/\s+/g, " ").toLowerCase();
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffled(list, r) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** The distinct answers in a set, in set order. */
export function bingoPool(set) { const seen = new Set(), out = []; (set.cats || []).forEach((c) => c.clues.forEach((k) => { const n = normAns(k.a); if (n && !seen.has(n)) { seen.add(n); out.push(k.a); } })); return out; }
export const bingoSize = (pool) => (pool.length >= 24 ? 5 : pool.length >= 16 ? 4 : pool.length >= 9 ? 3 : 0);
/** Card number n (1-based) for this pool and seed: a size×size list of answers ("" is the free middle). */
export function bingoCard(pool, seed, n) {
    const size = bingoSize(pool); if (!size) return { size: 0, cells: [] };
    const free = size === 5, pick = shuffled(pool, rng(seed * 1000 + n)).slice(0, size * size - (free ? 1 : 0));
    if (free) pick.splice(12, 0, "");
    return { size, cells: pick };
}
export function bingoLines(card, called) {
    const { size, cells } = card, hit = cells.map((c) => c === "" || called.has(normAns(c))), lines = [];
    for (let r = 0; r < size; r++) if ([...Array(size)].every((_, c) => hit[r * size + c])) lines.push("Row " + (r + 1));
    for (let c = 0; c < size; c++) if ([...Array(size)].every((_, r) => hit[r * size + c])) lines.push("Column " + (c + 1));
    if ([...Array(size)].every((_, i) => hit[i * size + i])) lines.push("Diagonal");
    if ([...Array(size)].every((_, i) => hit[i * size + (size - 1 - i)])) lines.push("Other diagonal");
    return { hit, lines };
}
function newBingo(set) {
    const seed = 1 + Math.floor(Math.random() * 99999), qs = shuffled(questionsOf(set), rng(seed));
    return { v: 1, kind: "bingo", id: set.id, title: set.title, cats: set.cats, final: null, qs, qi: 0, seed, teams: [], show: false,
        check: 0, opts: { secs: 45, cards: 30 }, timer: blankTimer(), snap: [], phase: "play", at: Date.now() };
}
function cleanBingo(d) {
    const set = cleanSet(d); if (!set || d.v !== 1) return null;
    const seed = Math.max(1, Math.floor(+d.seed || 1)), g = newBingo(set), int = (v) => Math.floor(+v || 0);
    g.seed = seed; g.qs = shuffled(questionsOf(set), rng(seed));
    g.qi = Math.min(g.qs.length - 1, Math.max(0, int(d.qi))); g.show = !!d.show;
    g.teams = (Array.isArray(d.teams) ? d.teams : []).slice(0, 12).map((t) => ({ n: str(t && t.n, 16), s: 1, c: Math.max(1, int(t && t.c)) })).filter((t) => t.n);
    g.check = Math.max(0, int(d.check));
    const o = d.opts || {}; g.opts = { secs: [15, 30, 45, 60, 90, 120].includes(+o.secs) ? +o.secs : 45, cards: Math.min(60, Math.max(1, int(o.cards) || 30)) };
    if (d.timer) g.timer = { running: !!d.timer.running, t0: +d.timer.t0 || 0, elapsed: +d.timer.elapsed || 0 };
    g.snap = (Array.isArray(d.snap) ? d.snap : []).filter((x) => typeof x === "string" && x.length < 20000).slice(-12);
    g.phase = d.phase === "done" ? "done" : "play"; g.at = +d.at || 0;
    return g;
}

/* ---------- Tug of War ---------- */
/* The room splits into two sides. Each question, each side that gets it right pulls the rope one
   step its way (both right cancels out). First side to pull the marker past its line wins.
   The rope position is simply side 2's pulls minus side 1's. */
const TUG_GOALS = [3, 4, 5, 6, 8];
function newTug(set, names) {
    return { v: 1, kind: "tug", id: set.id, title: set.title, cats: set.cats, final: null, qs: questionsOf(set), qi: 0,
        teams: [{ n: (names && names[0]) || "Blue", s: 0 }, { n: (names && names[1]) || "Gold", s: 0 }], cp: "q", show: false, last: -1,
        opts: { secs: 30, goal: 4 }, timer: blankTimer(), snap: [], phase: "play", at: Date.now() };
}
function cleanTug(d) {
    const set = cleanSet(d); if (!set || d.v !== 1) return null;
    const g = newTug(set, [d.teams && d.teams[0] && str(d.teams[0].n, 16), d.teams && d.teams[1] && str(d.teams[1].n, 16)]), int = (v) => Math.floor(+v || 0);
    g.teams.forEach((t, i) => { t.s = Math.max(0, int(d.teams && d.teams[i] && d.teams[i].s)); });
    g.qi = Math.min(g.qs.length - 1, Math.max(0, int(d.qi))); g.cp = d.cp === "result" ? "result" : "q"; g.show = !!d.show;
    g.last = [0, 1, 2, 3].includes(+d.last) && d.last !== null && d.last !== "" ? +d.last : -1; if (g.cp === "result" && g.last < 0) g.cp = "q";
    const o = d.opts || {}; g.opts = { secs: [15, 30, 45, 60, 90, 120].includes(+o.secs) ? +o.secs : 30, goal: TUG_GOALS.includes(+o.goal) ? +o.goal : 4 };
    if (d.timer) g.timer = { running: !!d.timer.running, t0: +d.timer.t0 || 0, elapsed: +d.timer.elapsed || 0 };
    g.snap = (Array.isArray(d.snap) ? d.snap : []).filter((x) => typeof x === "string" && x.length < 20000).slice(-12);
    g.phase = d.phase === "done" ? "done" : "play"; g.at = +d.at || 0;
    return g;
}

/* ---------- Rapid Fire ---------- */
/* The whole class against the clock. The round timer runs (30 s to 3 min); the teacher taps Right
   or Missed as fast as the class answers and the next question shows at once. The board counts
   right answers and the streak, and shows the class record for this period to beat.
   The set loops if the round outlasts it. */
const RAPID_SECS = [30, 45, 60, 90, 120, 180];
function newRapid(set, rec) {
    return { v: 1, kind: "rapid", id: set.id, title: set.title, cats: set.cats, final: null, qs: questionsOf(set), qi: 0,
        teams: [{ n: "Class", s: 0 }], cp: "ready", miss: 0, streak: 0, best: 0, last: -1, lq: -1, rec: Math.max(0, Math.floor(+rec || 0)),
        opts: { secs: 60 }, timer: blankTimer(), snap: [], phase: "play", at: Date.now() };
}
function cleanRapid(d) {
    const set = cleanSet(d); if (!set || d.v !== 1) return null;
    const g = newRapid(set, d.rec), int = (v) => Math.max(0, Math.floor(+v || 0));
    g.teams[0].s = int(d.teams && d.teams[0] && d.teams[0].s);
    g.qi = Math.min(g.qs.length - 1, int(d.qi)); g.cp = d.cp === "go" ? "go" : "ready";
    ["miss", "streak", "best"].forEach((k) => { g[k] = int(d[k]); });
    g.last = [0, 1, 2].includes(+d.last) && d.last !== null && d.last !== "" ? +d.last : -1;
    g.lq = d.lq !== null && d.lq !== "" && +d.lq >= 0 && +d.lq < g.qs.length ? Math.floor(+d.lq) : -1;
    g.opts = { secs: RAPID_SECS.includes(+(d.opts && d.opts.secs)) ? +d.opts.secs : 60 };
    if (d.timer) g.timer = { running: !!d.timer.running, t0: +d.timer.t0 || 0, elapsed: +d.timer.elapsed || 0 };
    g.snap = (Array.isArray(d.snap) ? d.snap : []).filter((x) => typeof x === "string" && x.length < 20000).slice(-12);
    g.phase = d.phase === "done" ? "done" : "play"; g.at = +d.at || 0;
    return g;
}
/** The class's best Rapid Fire score in this period, from saved results (Remote only). */
const rapidRecord = () => Math.max(0, ...(RESULTS || []).filter((r) => r.kind === "rapid" && r.period === A.S.period).map((r) => +(r.teams && r.teams[0] && r.teams[0].s) || 0));

const prizeText = (c) => ({ add: "+" + c.n + " points", dbl: "Double points!", steal: c.x >= 0 ? "Stole " + (c.g || 0) : "Steal " + c.n, swap: "Swap scores", lose: "Lose " + c.n, none: "Empty chest" }[c.k] || "");
const needsTarget = (c) => (c.k === "steal" || c.k === "swap") && c.x === -1;

/* ---------- the live game for the period on screen ---------- */
let A = null;             // what the board app lends us: { S, header, store, writer, now, beep, redraw, mode, signedIn }
let G = null, loaded = false, key = "", unsub = null, write = null, rev = 0;
let SETS = null, setsWatched = false, starting = "", panelSig = "", lastDone = false, endArm = 0, panelNote = "";

export function mountGames(api) { A = api; }
/* The Game Library's Play button opens remote.html?screen=game&period=1st&set=<id>&game=<kind>. */
let AUTO = (() => { try { const q = new URLSearchParams(location.search), id = q.get("set"), k = q.get("game"); return id && ["board", "chests", "versus", "shots", "tiles", "race", "bingo", "tug", "rapid", "wheel", "code"].includes(k) ? { id, k, per: q.get("period") || "" } : null; } catch (e) { return null; } })();
function tryAuto() {
    if (!AUTO || A.mode() !== "remote" || !onGame() || !loaded || !SETS || starting) return;
    if (AUTO.per && AUTO.per !== A.S.period) return;   // wait for the period from the link to take hold
    const want = AUTO; AUTO = null;
    try { const u = new URL(location.href); ["set", "game", "period"].forEach((k) => u.searchParams.delete(k)); history.replaceState(null, "", u); } catch (e) { /* ok */ }
    const meta = SETS.find((s) => s.id === want.id);
    if (!meta) { panelNote = "That question set was not found. It may have been removed."; panelSig = ""; return; }
    if (G) { panelNote = "A game is already running for " + A.S.period + " period. End it first, then pick \"" + meta.title + "\" below."; panelSig = ""; return; }
    start(meta, want.k);
}
const setFor = (s, per) => !Array.isArray(s.per) || !s.per.length || s.per.includes(per);
export const gameSig = () => key + "#" + rev + "#" + loaded;
const onGame = () => A && A.S.screen === "game";
const keyOf = (c, r) => c + "-" + r;
const pts = (n) => String(n).replace("-", "−");
const clueAt = (o) => (o && G.cats[o.c] && G.cats[o.c].clues[o.r]) || null;
const valueOf = (o) => { const k = clueAt(o); return k ? k.p * (G.dbl === keyOf(o.c, o.r) ? 2 : 1) : 0; };
const allUsed = () => G.cats.every((c, ci) => c.clues.every((_, ri) => G.used[keyOf(ci, ri)]));
const topValue = () => Math.max(...G.cats.map((c) => Math.max(...c.clues.map((k) => k.p))));

/** Local change: save it and draw it. */
function changed(opts) {
    if (G && G.phase === "done" && A.mode() === "remote" && A.signedIn()) recordResult();
    rev++; if (write && G) write(JSON.parse(JSON.stringify(G)));
    if (opts && opts.quiet) { drawStrip(); return; }
    A.redraw();
}
/** Follow the right document: one live game per period, only while the game screen is up. */
export function syncGames() {
    if (!A) return;
    const want = onGame() && A.signedIn() ? "games/live_" + A.S.period : "";
    if (want !== key) {
        if (unsub) { unsub(); unsub = null; }
        key = want; G = null; loaded = false; write = null; rev++; lastDone = false; panelNote = ""; pfMsg = "";
        if (key) {
            const mine = key; write = A.writer(mine);
            unsub = A.store().watch(mine, (snap) => {
                if (mine !== key || snap.pending || (write && write.busy())) return;
                G = snap.exists ? cleanGame(snap.data) : null; loaded = true; rev++; A.redraw();
            }, () => { loaded = true; rev++; panelNote = "Saved games are not available right now."; A.redraw(); });
        }
    }
    if (onGame()) watchResults();
    if (!setsWatched && A.signedIn() && A.mode() === "remote" && onGame()) {
        setsWatched = true;
        A.store().watch("games/index", (snap) => { if (snap.pending) return; SETS = ((snap.exists && snap.data && snap.data.sets) || []).filter((s) => s && s.id).slice(0, 200); panelSig = ""; drawPanel(); }, () => { SETS = []; panelSig = ""; drawPanel(); });
    }
}


/* ---------- results for Class Data ---------- */
/* When a game reaches its final scores, a short summary is saved to games/results: day, period,
   game, set, each team's score and (when teams came from the Group maker) who was on it, the
   winner, and how many questions were answered right by category. Private, never on the board. */
let RESULTS = null, resultsWatched = false, pendingResult = null, resultsWrite = null;
/* The games up front on the Remote and the Game Library; the rest sit in a "More games" drawer.
   Nothing is removed: every game still plays from the drawer, and old links (?game=) still work. */
export const FRONT_KINDS = [["board", "Review Board"], ["versus", "Class vs. Teacher"], ["rapid", "Rapid Fire"]];
export const MORE_KINDS = [["chests", "Treasure Chests"], ["shots", "Trashketball"], ["tiles", "Mystery Tiles"], ["race", "Ring Race"], ["bingo", "Bingo"], ["tug", "Tug of War"], ["wheel", "Prize Wheel"], ["code", "Code Breaker"]];
const KIND_NAMES = { board: "Review Board", chests: "Treasure Chests", versus: "Class vs. Teacher", shots: "Trashketball", tiles: "Mystery Tiles", race: "Ring Race", bingo: "Bingo", tug: "Tug of War", rapid: "Rapid Fire", wheel: "Prize Wheel", code: "Code Breaker" };
const localDay = () => { const d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
function watchResults() {
    if (resultsWatched || !A.signedIn() || A.mode() !== "remote") return; resultsWatched = true; resultsWrite = A.writer("games/results");
    A.store().watch("games/results", (snap) => {
        if (snap.pending || resultsWrite.busy()) return;
        RESULTS = ((snap.exists && snap.data && snap.data.list) || []).filter((r) => r && r.id);
        if (pendingResult) { const r = pendingResult; pendingResult = null; putResult(r); }
    }, () => { RESULTS = RESULTS || []; });
}
function putResult(r) {
    if (!RESULTS) { pendingResult = r; return; }
    const at = RESULTS.findIndex((x) => x.id === r.id);
    if (at >= 0) { r.bonus = RESULTS[at].bonus || {}; RESULTS[at] = r; } else RESULTS.push(r);
    RESULTS = RESULTS.slice(-1500); resultsWrite({ list: RESULTS, at: Date.now() });
}
function recordResult() {
    if (!G.rid) G.rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const kind = G.kind || "board", best = Math.max(...G.teams.map((t) => t.s)), by = {};
    (G.log || []).forEach((x) => { const k = x.c || "Questions"; by[k] = by[k] || { c: k, ok: 0, of: 0 }; by[k].ok += x.ok; by[k].of += x.of; });
    putResult({ id: G.rid, date: localDay(), at: Date.now(), period: A.S.period, kind, game: KIND_NAMES[kind], title: G.title,
        teams: G.teams.map((t) => Object.assign({ n: t.n, s: t.s }, t.m ? { m: t.m } : {})), win: G.teams.map((t, i) => (t.s === best ? i : -1)).filter((i) => i >= 0),
        cats: Object.values(by), bonus: {} });
    panelNote = "";
    creditGame();
}
/* ---------- student profiles (js/profileCore.js) ----------
   When a game reaches its final scores, the questions logged since the last credit go to student profiles, once.
   Teams from the Group maker carry roster names, so each member gets the team's result for each question (team
   evidence: it counts toward topic locks and shows as "with team" on the Profiles page). Whole-class games (Class vs.
   Teacher, Rapid Fire, Bingo, Tug of War) have no names per answer, so each student present gets a little participation
   XP and no topic record. Teams with no names add nothing. Only the Remote writes, in one transaction. */
const CLASS_KINDS = ["versus", "rapid", "bingo", "tug"];
let pfMsg = "";
function creditGame() {
    if (!A.store().rooms || !A.store().rooms.tx) return;
    const per = A.S.period, roster = ((A.rosters && A.rosters()[per]) || []).filter(Boolean), shorts = shortNames(roster);
    if (!roster.length) { pfMsg = "Not added to student profiles: there is no class list for " + per + " period."; return; }
    const nameOf = (line) => { const i = roster.indexOf(line); return i >= 0 ? shorts[i] : ""; };
    const from = Math.min(G.pfAt || 0, (G.log || []).length), fresh = (G.log || []).slice(from);
    let gains = PC.teamGains(fresh, G.teams, nameOf);
    const kind = G.kind || "board";
    if (!Object.keys(gains).length && CLASS_KINDS.includes(kind) && !G.pfC) {
        const out = new Set(A.S.tools.absent && A.S.tools.absent.day === localDay() ? (A.S.tools.absent.periods[per] || []) : []);
        const rights = kind === "rapid" ? G.teams[0].s : kind === "bingo" ? G.qi + 1 : kind === "tug" ? (G.log || []).reduce((n, x) => n + x.ok, 0) : (G.log || []).reduce((n, x) => n + x.ok, 0);
        gains = {}; shorts.forEach((nm, i) => { if (!out.has(i)) gains[nm] = PC.classGain(nm, rights); });
        G.pfC = 1;
    }
    if (from > 0) Object.values(gains).forEach((g) => { g.play = 0; });   // the same game carried on: don't count it as another game played
    G.pfAt = (G.log || []).length;
    const n = Object.keys(gains).length;
    if (!n) { if (pfMsg !== "Adding to student profiles…") pfMsg = G.pfN || CLASS_KINDS.includes(kind) ? "" : "Not added to student profiles. Use the Group maker's groups as teams so each student gets credit."; return; }
    const rid = G.rid; pfMsg = "Adding to student profiles…";
    creditProfiles(A.store().rooms, per, gains).then(() => {
        if (G && G.rid === rid) { G.pfN = (G.pfN || 0) + n; pfMsg = ""; panelSig = ""; changed({ quiet: true }); drawPanel(); }
    }, (e) => {
        if (G && G.rid === rid) { G.pfAt = from; if (CLASS_KINDS.includes(kind) && !fresh.some((x) => x.w)) G.pfC = 0; pfMsg = "Could not add to student profiles (" + ((e && e.code) || "connection") + "). It will try again the next time you change anything."; panelSig = ""; drawPanel(); }
    });
}
/** The Group maker's groups for this period, as lists of names (absent students left out, as the tool does). */
function groupMembers() {
    const T = A.S.tools, gs = T.groups, per = gs.period || A.S.period, names = (A.rosters && A.rosters()[per]) || [];
    const out = T.absent && T.absent.day === localDay() ? (T.absent.periods[per] || []) : [];
    const order = (gs.order || []).filter((i) => i < names.length && !out.includes(i)), res = [];
    for (let g = 0; g * gs.size < order.length; g++) res.push(order.slice(g * gs.size, (g + 1) * gs.size).map((i) => names[i]));
    return res;
}

/* ---------- moves ---------- */
function closeClue(markUsed) {
    if (G.open && markUsed) { G.used[keyOf(G.open.c, G.open.r)] = 1; G.turn = (G.turn + 1) % G.teams.length; }
    G.open = null; G.show = false; G.tried = []; G.timer = blankTimer();
}
function openClue(c, r) {
    if (!G || G.phase !== "play" || G.open || G.used[keyOf(c, r)] || !clueAt({ c, r })) return;
    G.open = { c, r }; G.show = false; G.tried = []; G.timer = blankTimer(); A.unlockSound(); changed();
}
function score(t, right) {
    const o = G.open; if (!o) return; const v = valueOf(o), k = keyOf(o.c, o.r);
    if (right) { G.teams[t].s += v; G.hist.push({ t, d: v, k, c: 1, f: 0 }); logQ(G.cats[o.c].n, 1, 1, k, [t], G.tried.concat([t])); closeClue(true); }
    else { const d = G.opts.lose ? -v : 0; G.teams[t].s += d; if (!G.tried.includes(t)) G.tried.push(t); G.hist.push({ t, d, k, c: 0, f: 0 }); }
    G.hist = G.hist.slice(-60); changed();
}
function noOne() { const o = G.open; if (!o) return; G.hist.push({ t: -1, d: 0, k: keyOf(o.c, o.r), c: 1, f: 0 }); logQ(G.cats[o.c].n, 0, 1, keyOf(o.c, o.r), [], G.tried.slice()); closeClue(true); changed(); }
/** One question's result. w: the teams that got it right, x: the teams that answered (for student profiles; left out in whole-class games). */
function logQ(c, ok, of, k, w, x) {
    if (!G.log) G.log = [];
    const e = { c, ok, of, k: k || "" }; if (Array.isArray(w) && Array.isArray(x)) { e.w = w.slice(); e.x = x.slice(); }
    G.log.push(e);
    if (G.log.length > 200) { const cut = G.log.length - 200; G.log = G.log.slice(cut); G.pfAt = Math.max(0, (G.pfAt || 0) - cut); }
}
const allTeams = () => G.teams.map((_, i) => i);
function undo() {
    const h = G.hist.pop(); if (!h) return;
    if (h.t >= 0 && G.teams[h.t]) G.teams[h.t].s -= h.d;
    if (h.f) { if (h.t >= 0) G.fdone[h.t] = 0; }
    else if (h.k) {
        const [c, r] = h.k.split("-").map(Number);
        if (h.c) {   // the tile had closed: open it again, with the misses that came before
            if (G.log && G.log.length && G.log[G.log.length - 1].k === h.k) G.log.pop();
            delete G.used[h.k]; G.turn = (G.turn - 1 + G.teams.length) % G.teams.length; G.phase = "play";
            G.open = { c, r }; G.show = false; G.timer = blankTimer(); G.tried = [];
            for (let i = G.hist.length - 1; i >= 0 && G.hist[i].k === h.k && !G.hist[i].c && !G.hist[i].f; i--) G.tried.push(G.hist[i].t);
        } else G.tried = G.tried.filter((x) => x !== h.t);
    }
    changed();
}
function adjust(t, d) { G.teams[t].s += d; G.hist.push({ t, d, k: "", c: 0, f: 0 }); G.hist = G.hist.slice(-60); changed(); }
function timerGo() {
    const t = G.timer, now = A.now();
    if (t.running) { t.elapsed = now - t.t0; t.running = false; }
    else { if (t.elapsed >= G.opts.secs * 1000) t.elapsed = 0; t.t0 = now - t.elapsed; t.running = true; A.unlockSound(); }
    changed();
}
function pickDouble() {
    const open = []; G.cats.forEach((c, ci) => c.clues.forEach((_, ri) => { if (ri > 0 && !G.used[keyOf(ci, ri)]) open.push(keyOf(ci, ri)); }));
    G.dbl = G.opts.dbl && open.length ? open[Math.floor(Math.random() * open.length)] : "";
}
function finalScore(t, right) {
    if (G.fdone[t]) return; const w = Math.max(0, Math.floor(+G.wag[t] || 0)), d = right ? w : -w;
    G.teams[t].s += d; G.fdone[t] = 1; G.hist.push({ t, d, k: "", c: 0, f: 1 }); changed();
}
async function start(meta, kind) {
    if (starting) return; starting = meta.id; panelNote = ""; panelSig = ""; drawPanel();
    const set = await new Promise((done) => { let u = null, got = false; const fin = (v) => { if (got) return; got = true; if (u) u(); done(v); };
        u = A.store().watch("games/s_" + meta.id, (snap) => { if (snap.pending) return; fin(snap.exists ? cleanSet(snap.data) : null); }, () => fin(null)); if (got && u) u(); setTimeout(() => fin(null), 8000); });
    starting = "";
    if (!set) { panelNote = "Could not open that set. Check the connection and try again."; panelSig = ""; drawPanel(); return; }
    const keep = G && G.teams ? G.teams.map((t) => t.n) : null;
    const prev = G && G.teams;
    G = kind === "chests" ? newChests(set, keep) : kind === "wheel" ? newWheel(set, keep) : kind === "code" ? newCode(set, keep) : kind === "versus" ? newVersus(set) : kind === "shots" ? newShots(set, keep) : kind === "tiles" ? newTiles(set, keep) : kind === "race" ? newRace(set, keep) : kind === "bingo" ? newBingo(set) : kind === "tug" ? newTug(set) : kind === "rapid" ? newRapid(set, rapidRecord()) : newGame(set, keep); G.log = []; G.rid = "";
    if (prev && kind !== "versus" && kind !== "bingo" && kind !== "tug" && kind !== "rapid") G.teams.forEach((t, i) => { if (prev[i] && prev[i].m) t.m = prev[i].m; });
    loaded = true; changed();
}


/* ---------- Treasure Chests moves ---------- */
function save() { const g = Object.assign({}, G); delete g.snap; delete g.timer; G.snap.push(JSON.stringify(g)); G.snap = G.snap.slice(-12); }
function chestUndo() {
    const last = G.snap.pop(); if (!last) return; const snap = G.snap, timer = G.timer;
    G = cleanGame(Object.assign(JSON.parse(last), { snap, timer })) || G; changed();
}
const curQ = () => G.qs[G.qi];
function nextQuestion() {
    if (G.qi >= G.qs.length - 1) { G.phase = "done"; changed(); return; }
    G.qi++; G.cp = "q"; G.show = false; G.right = []; G.queue = []; G.picker = -1; if (G.kind === "wheel") G.spin = null; else if (G.kind === "code") { G.lastG = null; G.solved = null; } else G.chests = closedChests(); G.last = -1; G.timer = blankTimer(); changed();
}
function startPicking() {
    save(); logQ(curQ().c, G.right.length, G.teams.length, "", G.right, allTeams()); G.queue = G.teams.map((_, i) => i).filter((i) => G.right.includes(i));
    if (G.kind === "code") { G.queue.forEach((i) => { G.teams[i].s += CODE_RIGHT; }); G.lastG = null; codeEntry = ""; }
    if (!G.queue.length) { nextQuestion(); return; }
    G.picker = G.queue.shift(); G.cp = "pick"; G.show = true; G.timer = blankTimer(); changed();
}
function applyPrize(c, t) {
    const me = G.teams[t];
    if (c.k === "add") me.s += c.n;
    else if (c.k === "dbl") me.s *= 2;
    else if (c.k === "lose") me.s = Math.max(0, me.s - c.n);
    else if (c.k === "steal" && c.x >= 0) { const them = G.teams[c.x], got = Math.min(c.n, Math.max(0, them.s)); them.s -= got; me.s += got; c.g = got; }
    else if (c.k === "swap" && c.x >= 0) { const them = G.teams[c.x], a = me.s; me.s = them.s; them.s = a; }
}
function openChest(i) {
    if (!G || G.kind !== "chests" || G.cp !== "pick" || G.picker < 0 || G.chests[i].o) return;
    if (G.last >= 0 && needsTarget(G.chests[G.last])) return;
    if (G.last >= 0 && G.chests[G.last].t === G.picker) return;   // this team already opened one
    save();
    const bag = []; PRIZES.forEach(([k, n, w]) => { for (let j = 0; j < w; j++) bag.push([k, n]); });
    const [k, n] = bag[Math.floor(Math.random() * bag.length)], c = { o: 1, k, n, t: G.picker, x: -1 };
    const others = G.teams.map((_, j) => j).filter((j) => j !== G.picker);
    if ((k === "steal" || k === "swap") && others.length === 1) c.x = others[0];
    if ((k === "steal" || k === "swap") && !others.length) c.x = -2;
    G.chests[i] = c; G.last = i; if (!needsTarget(c)) applyPrize(c, G.picker); A.unlockSound(); changed();
}
function spinWheel() {
    if (!G || G.kind !== "wheel" || G.cp !== "pick" || G.picker < 0) return;
    const c0 = G.spin; if (c0 && (c0.t === G.picker || needsTarget(c0))) return;
    save();
    const w = Math.floor(Math.random() * WHEEL.length), [k, n] = WHEEL[w], c = { w, k, n, t: G.picker, x: -1, g: 0 };
    const others = G.teams.map((_, j) => j).filter((j) => j !== G.picker);
    if ((k === "steal" || k === "swap") && others.length === 1) c.x = others[0];
    if ((k === "steal" || k === "swap") && !others.length) c.x = -2;
    const jitter = Math.floor(Math.random() * 17) - 8, want = ((360 - (w + 0.5) * 30 + jitter) % 360 + 360) % 360;
    G.rot = G.rot - (G.rot % 360) + 360 * 5 + want;
    G.spin = c; if (!needsTarget(c)) applyPrize(c, G.picker); A.unlockSound(); changed();
}
function chooseTarget(x) { const c = curPrize(); if (!c || !needsTarget(c)) return; save(); c.x = x; applyPrize(c, c.t); changed(); }
function nextPicker() {
    if (G.queue.length) { G.picker = G.queue.shift(); if (G.kind === "code") { G.lastG = null; codeEntry = ""; } changed(); } else nextQuestion();
}


/* ---------- Class vs. Teacher moves ---------- */
function award(w) {
    if (G.cp !== "q" || G.phase !== "play") return;
    save(); logQ(curQ().c, w === 0 ? 1 : 0, 1); G.teams[w].s++; G.won = w; G.cp = "result"; G.show = true; G.timer = blankTimer();
    G.streak = w === 0 ? G.streak + 1 : 0;
    if (G.teams[w].s >= G.opts.goal) G.phase = "done";
    changed();
}
function versusNext() {
    if (G.qi >= G.qs.length - 1) { G.phase = "done"; changed(); return; }
    G.qi++; G.cp = "q"; G.show = false; G.won = -1; G.timer = blankTimer(); changed();
}

/* ---------- Trashketball moves ---------- */
function shotNextQuestion() {
    if (G.qi >= G.qs.length - 1) { G.phase = "done"; changed(); return; }
    G.qi++; G.cp = "q"; G.show = false; G.right = []; G.queue = []; G.shooter = -1; G.shot = -1; G.timer = blankTimer(); changed();
}
function startShooting() {
    save(); logQ(curQ().c, G.right.length, G.teams.length, "", G.right, allTeams());
    G.queue = G.teams.map((_, i) => i).filter((i) => G.right.includes(i));
    G.queue.forEach((i) => { G.teams[i].s += G.opts.ans; });
    if (!G.queue.length) { shotNextQuestion(); return; }
    G.shooter = G.queue.shift(); G.shot = -1; G.cp = "shoot"; G.show = true; G.timer = blankTimer(); changed();
}
function takeShot(n) {
    if (G.kind !== "shots" || G.cp !== "shoot" || G.shooter < 0 || G.shot >= 0) return;
    save(); G.shot = n; G.teams[G.shooter].s += n; G.made.push({ t: G.shooter, n }); G.made = G.made.slice(-40); A.unlockSound(); changed();
}
function nextShooter() {
    if (G.queue.length) { G.shooter = G.queue.shift(); G.shot = -1; changed(); } else shotNextQuestion();
}

/* ---------- Mystery Tiles moves ---------- */
const covered = () => G.tiles.filter((t) => !t).length;
const solveValue = () => SOLVE_BASE + TILE_PTS * covered();
function tilesNextQuestion() {
    G.right = []; G.queue = []; G.picker = -1; G.flip = -1; G.show = false; G.timer = blankTimer();
    if (G.qi >= G.qs.length - 1) { G.phase = "done"; changed(); return; }
    G.qi++; G.cp = covered() ? "q" : "solved"; if (G.cp === "solved" && G.solver < 0) G.cp = "q"; changed();
}
function tilesPicking() {
    save(); logQ(curQ().c, G.right.length, G.teams.length, "", G.right, allTeams()); G.queue = G.teams.map((_, i) => i).filter((i) => G.right.includes(i));
    if (!G.queue.length || !covered()) { tilesNextQuestion(); return; }
    G.picker = G.queue.shift(); G.flip = -1; G.cp = "pick"; G.show = true; G.timer = blankTimer(); changed();
}
function flipTile(i) {
    if (!G || G.kind !== "tiles" || G.cp !== "pick" || G.picker < 0 || G.tiles[i] || G.flip >= 0) return;
    save(); G.tiles[i] = 1; G.flip = i; G.teams[G.picker].s += TILE_PTS; A.unlockSound(); changed();
}
function tilesNextPicker() {
    if (G.queue.length && covered()) { G.picker = G.queue.shift(); G.flip = -1; changed(); } else tilesNextQuestion();
}
function solve(t) {
    if (G.kind !== "tiles" || !G.ph || G.cp === "setup" || G.cp === "solved") return;
    save(); G.adv = G.cp === "pick" ? 1 : 0; G.got = solveValue(); G.teams[t].s += G.got; G.solver = t; G.tiles = G.tiles.map(() => 1); G.cp = "solved"; G.queue = []; G.picker = -1; G.flip = -1; G.timer = blankTimer(); A.unlockSound(); changed();
}
function newMystery(ph, hint) {
    save(); G.ph = String(ph).slice(0, 60).trim(); G.hint = String(hint || "").slice(0, 60).trim(); G.tiles = Array(TILE_N).fill(0); G.solver = -1; G.got = 0; G.flip = -1;
    if (G.cp === "solved") { G.round++; if (G.adv) { if (G.qi < G.qs.length - 1) G.qi++; else G.phase = "done"; } G.adv = 0; }
    G.cp = "q"; G.show = false; G.right = []; G.queue = []; G.picker = -1; G.timer = blankTimer(); changed();
}

/* ---------- Ring Race moves ---------- */
function raceTap(i) {   // off → right → right and fastest → off
    if (G.cp !== "q") return;
    if (!G.right.includes(i)) G.right = [...G.right, i];
    else if (G.opts.fast && G.fast !== i) G.fast = i;
    else { G.right = G.right.filter((x) => x !== i); if (G.fast === i) G.fast = -1; }
    changed();
}
function raceScore() {
    if (G.cp !== "q" || G.phase !== "play") return;
    save(); logQ(curQ().c, G.right.length, G.teams.length, "", G.right, allTeams());
    G.gained = G.right.slice(); G.right.forEach((i) => { G.teams[i].s += 1 + (G.opts.fast && G.fast === i ? 1 : 0); });
    G.teams.forEach((t) => { t.s = Math.min(t.s, G.opts.goal); });
    G.cp = "result"; G.show = true; G.timer = blankTimer();
    if (G.teams.some((t) => t.s >= G.opts.goal)) G.phase = "done";
    changed();
}
function raceNext() {
    if (G.qi >= G.qs.length - 1) { G.phase = "done"; changed(); return; }
    G.qi++; G.cp = "q"; G.show = false; G.right = []; G.fast = -1; G.gained = []; G.timer = blankTimer(); changed();
}

/* ---------- Bingo moves ---------- */
const calledSet = () => { const out = new Set(); G.qs.forEach((q, i) => { if (i < G.qi || (i === G.qi && G.show)) out.add(normAns(q.a)); }); return out; };
const calledList = () => G.qs.filter((q, i) => i < G.qi || (i === G.qi && G.show)).map((q) => q.a);
function bingoNext() {
    save(); if (!G.show) G.show = true;   // the current answer counts as called once you move on
    if (G.qi >= G.qs.length - 1) { G.phase = "done"; changed(); return; }
    G.qi++; G.show = false; G.timer = blankTimer(); changed();
}
function bingoWin(n) {
    if (G.teams.some((t) => t.c === n)) return;
    save(); G.teams.push({ n: "Card " + n, s: 1, c: n }); changed();
}

/* ---------- Tug of War moves ---------- */
const tugPos = () => G.teams[1].s - G.teams[0].s;
function tugPull(w) {   // 0: side 1 right, 1: side 2 right, 2: both, 3: neither
    if (G.cp !== "q" || G.phase !== "play") return;
    save(); logQ(curQ().c, w === 2 ? 2 : w === 3 ? 0 : 1, 2);
    if (w === 0 || w === 2) G.teams[0].s++; if (w === 1 || w === 2) G.teams[1].s++;
    G.last = w; G.cp = "result"; G.show = true; G.timer = blankTimer();
    if (Math.abs(tugPos()) >= G.opts.goal) G.phase = "done";
    changed();
}
function tugNext() {
    if (G.qi >= G.qs.length - 1) { G.phase = "done"; changed(); return; }
    G.qi++; G.cp = "q"; G.show = false; G.last = -1; G.timer = blankTimer(); changed();
}

/* ---------- Rapid Fire moves ---------- */
function rapidGo() {   // start, pause or resume the round
    if (G.phase !== "play") return;
    if (G.cp === "ready") { G.cp = "go"; G.timer = blankTimer(); }
    timerGo();
}
function rapidMark(w) {   // 0: right, 1: missed, 2: skip
    if (G.cp !== "go" || G.phase !== "play") return;
    save(); if (w < 2) logQ(curQ().c, w === 0 ? 1 : 0, 1);
    if (w === 0) { G.teams[0].s++; G.streak++; G.best = Math.max(G.best, G.streak); }
    else if (w === 1) { G.miss++; G.streak = 0; }
    G.last = w; G.lq = G.qi; G.qi = (G.qi + 1) % G.qs.length;
    changed();
}
function rapidEnd() {
    if (G.timer.running) { G.timer.elapsed = A.now() - G.timer.t0; G.timer.running = false; }
    G.phase = "done"; changed();
}

/* ---------- the stage (what students see) ---------- */
function strip() {
    const s = el("div", "gteams"); s.id = "gTeams";
    const best = Math.max(...G.teams.map((t) => t.s));
    G.teams.forEach((t, i) => {
        const now = isCh() || G.kind === "tiles" ? (G.cp === "pick" && i === G.picker) : G.kind === "shots" ? (G.cp === "shoot" && i === G.shooter) : (G.phase === "play" && i === G.turn), b = el("div", "gteam" + (now ? " turn" : "") + (G.phase === "done" && t.s === best ? " win" : ""));
        b.append(el("span", "gtn", t.n), el("b", "gts", pts(t.s))); s.append(b);
    });
    return s;
}
function drawStrip() { const old = document.getElementById("gTeams"); if (old && G) old.replaceWith(strip()); }
function ring() {
    const NS = "http://www.w3.org/2000/svg", w = el("div", "gring"); w.id = "gRing"; w.hidden = true;
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("aria-hidden", "true");
    [["gr-bg", null], ["gr-fg", "gRingArc"]].forEach(([cls, id]) => { const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", 50); c.setAttribute("cy", 50); c.setAttribute("r", 42); c.setAttribute("class", cls); if (id) c.id = id; svg.append(c); });
    const b = el("b"); b.id = "gClock"; w.append(svg, b); return w;
}
const qBox = (text, plain) => { const w = el("div", "gqwrap"); w.append(plain ? el("p", "gq s2", text) : mathEl("p", "gq " + sizeOf(text), text)); return w; };
const finalName = (f) => (f.c === "Final question" ? f.c : "Final question · " + f.c);
const sizeOf = (text) => { const n = String(text).length; return n <= 40 ? "s1" : n <= 90 ? "s2" : n <= 170 ? "s3" : "s4"; };


function chestSvg() {
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 64 48"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "gchsvg");
    [["path", { d: "M6 20h52v22a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z", class: "cb" }], ["path", { d: "M6 20v-4a13 13 0 0 1 13-13h26a13 13 0 0 1 13 13v4z", class: "cl" }],
     ["path", { d: "M6 20h52", class: "cs" }], ["rect", { x: 27, y: 15, width: 10, height: 12, rx: 2, class: "ck" }], ["path", { d: "M18 4v41M46 4v41", class: "cs" }]]
        .forEach(([tag, at]) => { const e = document.createElementNS(NS, tag); Object.keys(at).forEach((k) => e.setAttribute(k, at[k])); svg.append(e); });
    return svg;
}
let shownRot = -1, spinAt = 0, spinFrom = 0, wheelWait = "";
const SPIN_MS = 4000;
function wheelSvg() {
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "-110 -118 220 228"); svg.setAttribute("class", "gwheel"); svg.setAttribute("aria-hidden", "true");
    const mk = (tag, at, text, into) => { const e = document.createElementNS(NS, tag); Object.keys(at).forEach((k) => e.setAttribute(k, at[k])); if (text != null) e.textContent = text; (into || svg).append(e); return e; };
    if (shownRot !== G.rot) { spinFrom = shownRot < 0 ? G.rot : shownRot; spinAt = spinFrom === G.rot ? 0 : performance.now(); shownRot = G.rot; }
    const gone = performance.now() - spinAt, spinning = spinAt && gone < SPIN_MS;
    const g = mk("g", { class: "gwspin" }); g.style.transform = "rotate(" + G.rot + "deg)";
    const R = 100, pt = (a, r) => [Math.sin(a * Math.PI / 180) * r, -Math.cos(a * Math.PI / 180) * r];
    WHEEL.forEach(([k, n], i) => {
        const a0 = i * 30, a1 = a0 + 30, [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
        mk("path", { d: "M0 0 L" + x0.toFixed(2) + " " + y0.toFixed(2) + " A" + R + " " + R + " 0 0 1 " + x1.toFixed(2) + " " + y1.toFixed(2) + " Z", class: "gwseg " + k + (i % 2 ? " alt" : "") }, null, g);
        const [tx, ty] = pt(a0 + 15, 60), lab = k === "add" ? "+" + n : k === "dbl" ? "×2" : k === "lose" ? "−" + n : k === "steal" ? "Steal" : k === "swap" ? "Swap" : "Zip";
        mk("text", { x: tx.toFixed(2), y: ty.toFixed(2), class: "gwlab " + k, transform: "rotate(" + (a0 + 15 - 90) + " " + tx.toFixed(2) + " " + ty.toFixed(2) + ")", "text-anchor": "middle", "dominant-baseline": "central" }, lab, g);
    });
    mk("circle", { cx: 0, cy: 0, r: 15, class: "gwhub" }, null, g);
    mk("circle", { cx: 0, cy: 0, r: R, class: "gwrim" });
    mk("path", { d: "M-11 -116 L11 -116 L0 -92 Z", class: "gwptr" });
    const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (spinning && !still && g.animate) g.animate([{ transform: "rotate(" + spinFrom + "deg)" }, { transform: "rotate(" + G.rot + "deg)" }], { duration: SPIN_MS, delay: -gone, easing: "cubic-bezier(.15,.75,.2,1)", fill: "both" });
    svg.dataset.wait = wheelWait = spinning && !still ? String(Math.round(SPIN_MS - gone)) : "";
    return svg;
}
function wheelStage(body) {
    const q = curQ(), wrap = el("div", "gchwrap gwwrap"), side = el("div", "gchside"), c = G.spin, mine = c && c.t === G.picker, svg = wheelSvg(), wait = svg.dataset.wait, late = wait ? " gwlate" : "";
    side.append(el("p", "gchwho", G.teams[G.picker] ? G.teams[G.picker].n : ""));
    if (!mine) side.append(el("p", "gchsay", "Spin the wheel!"));
    else {
        side.append(el("p", "gchsay " + c.k + late, wheelText(c)));
        if (needsTarget(c)) side.append(el("p", "gchsub" + late, c.k === "swap" ? "Which team do you swap with?" : "Which team do you steal from?"));
        else if ((c.k === "steal" || c.k === "swap") && c.x >= 0) side.append(el("p", "gchsub" + late, c.k === "swap" ? "Swapped with " + G.teams[c.x].n : "from " + G.teams[c.x].n + (c.g ? "" : ". They had none!")));
    }
    { const ans = el("p", "gchq", "Answer: "); ans.append(mathRich(q.a)); side.append(ans); }
    if (wait) side.querySelectorAll(".gwlate").forEach((e) => { e.style.animationDelay = wait + "ms"; });
    const box = el("div", "gwbox"); box.append(svg);
    wrap.append(box, side); body.append(wrap);
}
function codeRow(g, r, cls) {
    const row = el("div", "gcrow" + (cls ? " " + cls : ""));
    [...g].forEach((d, i) => { const c = el("span", "gcd " + (r ? r[i] : "q"), d); if (r) c.setAttribute("aria-label", d + (r[i] === "g" ? ", right spot" : r[i] === "a" ? ", in the code, wrong spot" : ", not in the code")); row.append(c); });
    return row;
}
function codeStage(body) {
    const q = curQ(), wrap = el("div", "gchwrap gcwrap"), left = el("div", "gcleft"), side = el("div", "gchside");
    const lock = el("div", "gclock"); lock.append(el("p", "gclab", "Secret code" + (G.no > 1 ? " #" + G.no : "")), codeRow("?".repeat(G.code.length), "", "secret")); left.append(lock);
    const mine = G.guesses.filter((x) => x.no === G.no), hist = el("div", "gchist");
    if (!mine.length) hist.append(el("p", "gcnone", "No guesses yet. Each digit is used once."));
    mine.slice(-7).forEach((x) => { const r = el("div", "gcline"); r.append(el("span", "gcwho", G.teams[x.t] ? G.teams[x.t].n : ""), codeRow(x.g, x.r)); hist.append(r); });
    left.append(hist);
    const key = el("div", "gckey"); [["g", "Right spot"], ["a", "In the code, wrong spot"], ["x", "Not in the code"]].forEach(([k, t]) => { const s = el("span"); s.append(el("i", "gcd " + k), document.createTextNode(t)); key.append(s); }); left.append(key);
    side.append(el("p", "gchwho", G.teams[G.picker] ? G.teams[G.picker].n : ""));
    const sv = G.solved && G.solved.qi === G.qi ? G.solved : null, lg = G.lastG && G.lastG.t === G.picker ? G.lastG : null;
    if (sv && lg && lg.no === sv.no) { side.append(el("p", "gchsay add", "Cracked it! +" + CODE_CRACK)); const c = el("div", "gcsolved"); c.append(el("small", null, "The code was"), codeRow(sv.c, "g".repeat(sv.c.length))); side.append(c); side.append(el("p", "gchsub", "A new code is ready.")); }
    else if (lg) { const n = [...lg.r].filter((x) => x === "g").length, a = [...lg.r].filter((x) => x === "a").length; side.append(el("p", "gchsay", n + " right spot" + (n === 1 ? "" : "s")), el("p", "gchsub", a + " in the code, wrong spot")); }
    else side.append(el("p", "gchsay", "Guess the code!"));
    if (sv && !(lg && lg.no === sv.no)) side.append(el("p", "gchsub", G.teams[sv.t].n + " cracked " + sv.c + " this round."));
    { const ans = el("p", "gchq", "Answer: "); ans.append(mathRich(q.a)); side.append(ans); }
    wrap.append(left, side); body.append(wrap);
}
function chestStage(body) {
    const q = curQ(), top = el("div", "gtop");
    if (G.cp === "q") {
        const box = el("div", "gclue");
        top.append(el("span", "gchip", "Question " + (G.qi + 1) + " of " + G.qs.length + " · " + q.c), ring());
        box.append(top, qBox(q.q));
        if (G.show) { const a = el("div", "gans"); a.append(el("small", null, "Answer"), mathEl("p", null, q.a)); box.append(a); }
        box.append(el("p", "gchnote", "Every team: write your answer. Right answers " + (G.kind === "wheel" ? "spin the wheel." : G.kind === "code" ? "score " + CODE_RIGHT + " and get a guess at the code." : "open a chest.")));
        body.append(box); return;
    }
    if (G.kind === "wheel") { wheelStage(body); return; }
    if (G.kind === "code") { codeStage(body); return; }
    const wrap = el("div", "gchwrap"), side = el("div", "gchside"), c = G.last >= 0 ? G.chests[G.last] : null, mine = c && c.t === G.picker;
    side.append(el("p", "gchwho", G.teams[G.picker] ? G.teams[G.picker].n : ""));
    if (!mine) side.append(el("p", "gchsay", "Pick a chest!"));
    else {
        side.append(el("p", "gchsay " + c.k, prizeText(c)));
        if (needsTarget(c)) side.append(el("p", "gchsub", c.k === "swap" ? "Which team do you swap with?" : "Which team do you steal from?"));
        else if ((c.k === "steal" || c.k === "swap") && c.x >= 0) side.append(el("p", "gchsub", c.k === "swap" ? "Swapped with " + G.teams[c.x].n : "from " + G.teams[c.x].n + (c.g ? "" : ". They had none!")));
    }
    { const ans = el("p", "gchq", "Answer: "); ans.append(mathRich(q.a)); side.append(ans); }
    const grid = el("div", "gchests");
    G.chests.forEach((x, i) => {
        const b = btn("gchest" + (x.o ? " open " + x.k : "") + (i === G.last ? " last" : ""), null, () => openChest(i));
        b.append(chestSvg(), el("b", "gchn", x.o ? prizeText(x) : String(i + 1)));
        if (x.o && G.teams[x.t]) b.append(el("small", null, G.teams[x.t].n));
        b.disabled = !!x.o; b.setAttribute("aria-label", x.o ? "Chest " + (i + 1) + ": " + prizeText(x) : "Open chest " + (i + 1)); grid.append(b);
    });
    wrap.append(grid, side); body.append(wrap);
}


function mysteryGrid(big) {
    const wrap = el("div", "gmy" + (big ? " big" : "")), back = el("div", "gmyback"), grid = el("div", "gmygrid");
    back.append(el("p", "gmyph " + (G.ph.length <= 14 ? "s1" : G.ph.length <= 28 ? "s2" : "s3"), G.ph));
    G.tiles.forEach((t, i) => { const b = btn("gmytile" + (t ? " open" : "") + (i === G.flip ? " last" : ""), t ? "" : String(i + 1), () => flipTile(i)); b.disabled = !!t; b.setAttribute("aria-label", t ? "Tile " + (i + 1) + ", flipped" : "Flip tile " + (i + 1)); grid.append(b); });
    wrap.append(back, grid); return wrap;
}
function tilesStage(body) {
    if (G.cp === "setup") { const e = el("div", "empty"); e.append(el("b", null, "Mystery Tiles"), document.createTextNode(A.mode() === "remote" ? "Type the mystery phrase in the panel to start." : "Get ready: a mystery phrase is about to hide behind the tiles.")); body.append(e); return; }
    const q = curQ(), side = el("div", "gchside");
    if (G.cp === "q") {
        const box = el("div", "gclue gmyq"), top = el("div", "gtop");
        top.append(el("span", "gchip", "Question " + (G.qi + 1) + " of " + G.qs.length + " · " + q.c), ring());
        box.append(top, qBox(q.q));
        if (G.show) { const a = el("div", "gans"); a.append(el("small", null, "Answer"), mathEl("p", null, q.a)); box.append(a); }
        box.append(el("p", "gchnote", "Every team: write your answer. Right answers flip a tile. Think you know the mystery? Raise your hand."));
        const wrap = el("div", "gmywrap qv"); wrap.append(box, mysteryGrid(false)); body.append(wrap); return;
    }
    if (G.cp === "solved") {
        side.append(el("p", "gchwho", G.teams[G.solver] ? G.teams[G.solver].n : ""), el("p", "gchsay add", "Solved it! +" + G.got));
        if (G.hint) side.append(el("p", "gchsub", "Hint: " + G.hint));
    } else {
        side.append(el("p", "gchwho", G.teams[G.picker] ? G.teams[G.picker].n : ""));
        side.append(el("p", "gchsay" + (G.flip >= 0 ? " add" : ""), G.flip >= 0 ? "Tile " + (G.flip + 1) + "! +" + TILE_PTS : "Pick a tile!"));
        if (G.hint) side.append(el("p", "gchsub", "Hint: " + G.hint));
        side.append(el("p", "gchsub", "Solve it now for " + solveValue() + " points"));
        { const ans = el("p", "gchq", "Answer: "); ans.append(mathRich(q.a)); side.append(ans); }
    }
    const wrap = el("div", "gmywrap"); wrap.append(mysteryGrid(true), side); body.append(wrap);
}

function raceRing(t, i) {
    const NS = "http://www.w3.org/2000/svg", got = G.cp === "result" && G.gained.includes(i), w = el("div", "grrace" + (got ? " got" : "") + (G.phase === "done" && t.s >= G.opts.goal ? " win" : ""));
    const box = el("div", "grring"), svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("aria-hidden", "true");
    const C = 2 * Math.PI * 42, frac = Math.min(1, t.s / G.opts.goal);
    [["gv-bg", 0], ["gv-fg", 1]].forEach(([cls, fg]) => { const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", 50); c.setAttribute("cy", 50); c.setAttribute("r", 42); c.setAttribute("class", cls + " c" + (i % 6));
        if (fg) { c.style.strokeDasharray = String(C); c.style.strokeDashoffset = String(C * (1 - frac)); } svg.append(c); });
    box.append(svg, el("b", null, String(t.s)));
    w.append(box, el("p", "grname", t.n), el("p", "grnote", got ? "+" + (1 + (G.opts.fast && G.fast === i ? 1 : 0)) + (G.opts.fast && G.fast === i ? " fastest!" : "") : (G.opts.goal - t.s) + " to go"));
    w.setAttribute("aria-label", t.n + ": " + t.s + " of " + G.opts.goal); return w;
}
function raceStage(body) {
    const q = curQ(), top = el("div", "gtop"), box = el("div", "gclue grq");
    top.append(el("span", "gchip", "Question " + (G.qi + 1) + " · " + q.c + " · First to " + G.opts.goal), ring()); box.append(top, qBox(q.q));
    if (G.show) { const a = el("div", "gans"); a.append(el("small", null, "Answer"), mathEl("p", null, q.a)); box.append(a); }
    const row = el("div", "grrow"); G.teams.forEach((t, i) => row.append(raceRing(t, i)));
    const wrap = el("div", "grwrap"); wrap.append(box, row); body.append(wrap);
}

function bingoStage(body) {
    const q = curQ(), top = el("div", "gtop"), box = el("div", "gclue");
    top.append(el("span", "gchip", "Question " + (G.qi + 1) + " of " + G.qs.length), ring()); box.append(top, qBox(q.q));
    if (G.show) { const a = el("div", "gans"); a.append(el("small", null, "Mark it if it is on your card"), mathEl("p", null, q.a)); box.append(a); }
    else box.append(el("p", "gchnote", "Solve it, then find the answer on your card."));
    const side = el("div", "gbside"), list = calledList();
    if (G.teams.length) side.append(el("p", "gbwin", G.teams.map((t) => t.n).join(", ") + ": BINGO!"));
    side.append(el("p", "gbh", "Called so far (" + list.length + ")"));
    const chips = el("div", "gbcalled"); list.slice().reverse().slice(0, 18).forEach((a, i) => { const c = el("span", "gbchip" + (i === 0 && G.show ? " new" : "")); c.append(mathRich(a)); chips.append(c); });
    if (!list.length) chips.append(el("span", "gbnone", "Nothing called yet."));
    side.append(chips);
    const wrap = el("div", "gbwrap"); wrap.append(box, side); body.append(wrap);
}

function ropeSvg() {
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 1000 150"); svg.setAttribute("class", "gtug"); svg.setAttribute("aria-hidden", "true");
    const add = (tag, at, text) => { const e = document.createElementNS(NS, tag); Object.keys(at).forEach((k) => e.setAttribute(k, at[k])); if (text != null) e.textContent = text; svg.append(e); return e; };
    const goal = G.opts.goal, step = 380 / goal, pos = Math.max(-goal, Math.min(goal, tugPos())), x = 500 + pos * step;
    add("rect", { x: 0, y: 0, width: 500, height: 150, class: "gtside a" }); add("rect", { x: 500, y: 0, width: 500, height: 150, class: "gtside b" });
    for (let i = -goal; i <= goal; i++) if (i) add("line", { x1: 500 + i * step, y1: 60, x2: 500 + i * step, y2: 90, class: "gttick" });
    add("line", { x1: 500 - goal * step, y1: 20, x2: 500 - goal * step, y2: 130, class: "gtwinline a" }); add("line", { x1: 500 + goal * step, y1: 20, x2: 500 + goal * step, y2: 130, class: "gtwinline b" });
    add("line", { x1: 500, y1: 10, x2: 500, y2: 140, class: "gtmid" });
    const defs = add("defs", {}), cp = document.createElementNS(NS, "clipPath"), cr = document.createElementNS(NS, "rect"); cp.id = "gtClip"; cr.setAttribute("width", 1000); cr.setAttribute("height", 150); cp.append(cr); defs.append(cp);
    const rope = document.createElementNS(NS, "path"); rope.setAttribute("d", "M-400 75 Q 250 " + (68 + (pos % 2 ? 4 : 0)) + " 500 75 T 1400 75"); rope.setAttribute("class", "gtrope"); rope.setAttribute("transform", "translate(" + (pos * step) + " 0)");
    const rg = add("g", { "clip-path": "url(#gtClip)" }); rg.append(rope);
    const knot = add("g", { class: "gtknot", transform: "translate(" + x + " 75)" });
    [["path", { d: "M0 -38 L0 0", class: "gtpole" }], ["path", { d: "M0 -38 L26 -30 L0 -22 Z", class: "gtflag" }], ["circle", { cx: 0, cy: 0, r: 11, class: "gtdot" }]].forEach(([t, at]) => { const e = document.createElementNS(NS, t); Object.keys(at).forEach((k) => e.setAttribute(k, at[k])); knot.append(e); });
    return svg;
}
function tugStage(body) {
    const q = curQ(), top = el("div", "gtop"), box = el("div", "gclue gtugq");
    top.append(el("span", "gchip", "Question " + (G.qi + 1) + " · " + q.c), ring()); box.append(top, qBox(q.q));
    if (G.show) { const a = el("div", "gans"); a.append(el("small", null, "Answer"), mathEl("p", null, q.a)); box.append(a); }
    const field = el("div", "gtugfield"), names = el("div", "gtugnames"), pos = tugPos(), goal = G.opts.goal;
    const side = (i) => { const d = el("div", "gtugname " + (i ? "b" : "a")); d.append(el("b", null, G.teams[i].n), el("small", null, G.teams[i].s + (G.teams[i].s === 1 ? " pull" : " pulls"))); return d; };
    const say = G.cp === "result" ? (G.last === 2 ? "Both right: no one moves!" : G.last === 3 ? "No one got it." : G.teams[G.last].n + " pulls!") : (pos === 0 ? "Dead even" : G.teams[pos < 0 ? 0 : 1].n + " is " + Math.abs(pos) + " of " + goal + " from winning");
    names.append(side(0), el("p", "gtugsay" + (G.cp === "result" && G.last < 2 ? " pull" : ""), say), side(1));
    field.append(names, ropeSvg());
    const wrap = el("div", "gtugwrap"); wrap.append(box, field); body.append(wrap);
}

function rapidStage(body) {
    const q = curQ(), wrap = el("div", "grfwrap"), main = el("div", "gclue grfq"), side = el("div", "grfside");
    const recTxt = G.rec ? "Class record: " + G.rec : "No record yet. Set one!";
    if (G.cp === "ready") {
        const box = el("div", "grfready"); box.append(el("p", "grfbig", G.opts.secs + " seconds"), el("p", "grfhow", "Answer as many as you can. Every right answer counts."), el("p", "grfrec", recTxt));
        main.append(box);
    } else {
        const top = el("div", "gtop"); top.append(el("span", "gchip", q.c), ring()); main.append(top, qBox(q.q));
        if (G.lq >= 0 && G.last >= 0) { const l = el("div", "grflast " + ["ok", "no", "skip"][G.last]); l.append(el("small", null, G.last === 0 ? "Right! Last answer" : G.last === 1 ? "Last answer" : "Skipped. Answer"), mathEl("p", null, G.qs[G.lq].a)); main.append(l); }
    }
    const n = G.teams[0].s, beat = G.rec && n > G.rec;
    const big = el("div", "grfcount" + (beat ? " beat" : "")); big.append(el("b", null, String(n)), el("small", null, n === 1 ? "right" : "right answers"));
    const st = el("div", "grfstreak" + (G.streak >= 3 ? " hot" : "")); st.append(el("b", null, String(G.streak)), el("small", null, "in a row"));
    side.append(big, st, el("p", "grfrec" + (beat ? " beat" : ""), beat ? "New class record!" : recTxt));
    wrap.append(main, side); body.append(wrap);
}

function courtSvg() {
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 20 400 240"); svg.setAttribute("class", "gtcourt"); svg.setAttribute("aria-hidden", "true");
    const add = (tag, at, text) => { const e = document.createElementNS(NS, tag); Object.keys(at).forEach((k) => e.setAttribute(k, at[k])); if (text != null) e.textContent = text; svg.append(e); return e; };
    const made = G.shot > 0 ? G.shot : 0;
    [[3, 200], [2, 145], [1, 90]].forEach(([n, r]) => {
        add("path", { d: "M" + (200 - r) + " 250 A" + r + " " + (r * 0.95) + " 0 0 1 " + (200 + r) + " 250", class: "gtline l" + n + (made === n ? " hit" : "") });
        add("text", { x: 200, y: 250 - r * 0.95 - 9, "text-anchor": "middle", class: "gtlab" + (made === n ? " hit" : "") }, n + (n === 1 ? " pt" : " pts"));
    });
    add("path", { d: "M176 214h48l-6 36h-36z", class: "gtcan" }); add("path", { d: "M172 210h56v6h-56z", class: "gtrim" });
    add("path", { d: "M184 222v22M200 222v22M216 222v22", class: "gtrib" });
    if (G.shot > 0) add("circle", { cx: 200, cy: 206, r: 11, class: "gtball in" });
    else if (G.shot === 0) add("circle", { cx: 246, cy: 238, r: 11, class: "gtball out" });
    return svg;
}
function shotStage(body) {
    const q = curQ(), top = el("div", "gtop");
    if (G.cp === "q") {
        const box = el("div", "gclue");
        top.append(el("span", "gchip", "Question " + (G.qi + 1) + " of " + G.qs.length + " · " + q.c), ring());
        box.append(top, qBox(q.q));
        if (G.show) { const a = el("div", "gans"); a.append(el("small", null, "Answer"), mathEl("p", null, q.a)); box.append(a); }
        box.append(el("p", "gchnote", "Every team: write your answer. Right answers" + (G.opts.ans ? " score " + G.opts.ans + (G.opts.ans === 1 ? " point" : " points") + " and" : "") + " earn a shot."));
        body.append(box); return;
    }
    const wrap = el("div", "gtwrap"), side = el("div", "gchside"), who = G.teams[G.shooter];
    side.append(el("p", "gchwho", who ? who.n : ""));
    if (G.shot < 0) side.append(el("p", "gchsay", "Pick a line and shoot!"));
    else side.append(el("p", "gchsay " + (G.shot ? "add" : "lose"), G.shot ? "Made it! +" + G.shot : "Missed!"));
    if (G.queue.length) side.append(el("p", "gchsub", "Up next: " + G.queue.map((i) => G.teams[i].n).join(", ")));
    { const ans = el("p", "gchq", "Answer: "); ans.append(mathRich(q.a)); side.append(ans); }
    const court = el("div", "gtcourtbox"); court.append(courtSvg());
    wrap.append(court, side); body.append(wrap);
}

function bigRing(t, i) {
    const NS = "http://www.w3.org/2000/svg", w = el("div", "gvside" + (i ? " teacher" : " class") + (G.won === i && G.cp === "result" ? " got" : ""));
    const box = el("div", "gvring"), svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("aria-hidden", "true");
    const C = 2 * Math.PI * 42, frac = Math.min(1, t.s / G.opts.goal);
    [["gv-bg", 0], ["gv-fg", 1]].forEach(([cls, fg]) => { const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", 50); c.setAttribute("cy", 50); c.setAttribute("r", 42); c.setAttribute("class", cls);
        if (fg) { c.style.strokeDasharray = String(C); c.style.strokeDashoffset = String(C * (1 - frac)); } svg.append(c); });
    const n = el("b", null, String(t.s)); box.append(svg, n);
    w.append(el("p", "gvname", t.n), box, el("p", "gvgoal", (G.opts.goal - t.s > 0 ? (G.opts.goal - t.s) + " to win" : "Wins!")));
    w.setAttribute("aria-label", t.n + ": " + t.s + " of " + G.opts.goal); return w;
}
function versusStage(body) {
    const q = curQ(), wrap = el("div", "gvwrap"), mid = el("div", "gclue gvmid"), top = el("div", "gtop");
    top.append(el("span", "gchip", "Question " + (G.qi + 1) + " · " + q.c), ring()); mid.append(top, qBox(q.q));
    if (G.show) { const a = el("div", "gans"); a.append(el("small", null, "Answer"), mathEl("p", null, q.a)); mid.append(a); }
    if (G.cp === "result") mid.append(el("p", "gvwho " + (G.won ? "teacher" : "class"), G.won ? "Point: " + G.teams[1].n : "Point: Class!" + (G.streak >= 3 ? " " + G.streak + " in a row!" : "")));
    else mid.append(el("p", "gchnote", "Everyone: answer on your whiteboard. The class scores when " + VS_RULES[G.opts.rule].toLowerCase().replace("every board right", "every board is right").replace("most boards right", "most boards are right") + "."));
    wrap.append(bigRing(G.teams[0], 0), mid, bigRing(G.teams[1], 1)); body.append(wrap);
}

export function drawStage(st) {
    const S = A.S, per = S.period + " period";
    if (!loaded) { st.append(A.header("Review Game", per), el("div", "gbody")); return; }
    if (!G) {
        st.append(A.header("Review Game", per));
        const e = el("div", "empty"); e.append(el("b", null, "No game is running for " + per + "."), document.createTextNode(A.mode() === "remote" ? "Pick a question set in the panel beside the board to start one." : "Start one from the Remote."));
        st.append(e); return;
    }
    st.append(A.header(G.kind === "chests" ? "Treasure Chests" : G.kind === "versus" ? "Class vs. " + G.teams[1].n : G.kind === "shots" ? "Trashketball" : G.kind === "tiles" ? "Mystery Tiles" : G.kind === "race" ? "Ring Race" : G.kind === "bingo" ? "Bingo" : G.kind === "tug" ? "Tug of War" : G.kind === "rapid" ? "Rapid Fire" : G.kind === "wheel" ? "Prize Wheel" : G.kind === "code" ? "Code Breaker" : "Review Game", G.title));
    const body = el("div", "gbody");
    if (isCh() && G.phase !== "done") { chestStage(body); if (G.kind === "wheel" && G.cp === "pick" && wheelWait) { const s = strip(); s.querySelectorAll(".gts").forEach((e) => { e.classList.add("gwlate"); e.style.animationDelay = wheelWait + "ms"; }); body.append(s); st.append(body); return; } }
    else if (G.kind === "shots" && G.phase !== "done") shotStage(body);
    else if (G.kind === "tiles" && G.phase !== "done") tilesStage(body);
    else if (G.kind === "race" && G.phase !== "done") { raceStage(body); st.append(body); return; }
    else if (G.kind === "bingo" && G.phase !== "done") { bingoStage(body); st.append(body); return; }
    else if (G.kind === "tug" && G.phase !== "done") { tugStage(body); st.append(body); return; }
    else if (G.kind === "tug") { const p = tugPos(), box = el("div", "gdone"); box.append(el("p", "gwinlab", p ? "Winner" : "It's a tie!"), el("p", "gwin", p ? G.teams[p < 0 ? 0 : 1].n : G.teams[0].n + " and " + G.teams[1].n), el("p", "gwinpts", G.teams[0].s + " pulls to " + G.teams[1].s)); body.append(box); st.append(body); return; }
    else if (G.kind === "rapid" && G.phase !== "done") { rapidStage(body); st.append(body); return; }
    else if (G.kind === "rapid") { const n = G.teams[0].s, beat = n > G.rec && n > 0, box = el("div", "gdone"); box.append(el("p", "gwinlab", beat && G.rec ? "New class record!" : beat ? "First record set!" : "Time!"), el("p", "gwin", n + (n === 1 ? " right answer" : " right answers")), el("p", "gwinpts", "Best streak: " + G.best + " in a row" + (G.rec && !beat ? " · Record to beat: " + G.rec : ""))); body.append(box); st.append(body); return; }
    else if (G.kind === "bingo") { const box = el("div", "gdone"); box.append(el("p", "gwinlab", G.teams.length ? "Bingo!" : "Game over"), el("p", "gwin", G.teams.length ? G.teams.map((t) => t.n).join(", ") : "No bingo this time"), el("p", "gwinpts", calledList().length + " answers called")); body.append(box); st.append(body); return; }
    else if (G.kind === "versus" && G.phase !== "done") { versusStage(body); st.append(body); return; }
    else if (G.phase === "done") {
        const best = Math.max(...G.teams.map((t) => t.s)), win = G.teams.filter((t) => t.s === best), box = el("div", "gdone");
        if (G.kind === "versus") box.append(el("p", "gwinlab", win.length > 1 ? "It's a tie!" : "Winner"), el("p", "gwin", win.length > 1 ? "Class and " + G.teams[1].n : (win[0] === G.teams[0] ? "The class!" : win[0].n)), el("p", "gwinpts", G.teams[0].s + " to " + G.teams[1].s));
        else box.append(el("p", "gwinlab", win.length > 1 ? "It's a tie!" : "Winner"), el("p", "gwin", win.map((t) => t.n).join(" and ")), el("p", "gwinpts", G.kind === "race" ? "Closed the ring: " + best + " of " + G.opts.goal : pts(best) + " points"));
        body.append(box);
    } else if (G.phase === "final") {
        const f = G.final, box = el("div", "gclue");
        const top = el("div", "gtop"); top.append(el("span", "gchip", finalName(f))); box.append(top);
        box.append(G.fstep === 0 ? qBox("Teams: decide how many points to risk.", true) : qBox(f.q));
        if (G.fstep === 2) { const a = el("div", "gans"); a.append(el("small", null, "Answer"), mathEl("p", null, f.a)); box.append(a); }
        body.append(box);
    } else if (G.open) {
        const o = G.open, k = clueAt(o), box = el("div", "gclue"), top = el("div", "gtop");
        top.append(el("span", "gchip", G.cats[o.c].n + " · " + k.p));
        if (G.dbl === keyOf(o.c, o.r)) top.append(el("span", "gdbl", "Double points: worth " + valueOf(o)));
        top.append(ring()); box.append(top, qBox(k.q));
        if (G.show) { const a = el("div", "gans"); a.append(el("small", null, "Answer"), mathEl("p", null, k.a)); box.append(a); }
        const row = el("div", "gbtns");
        row.append(btn(null, G.show ? "Hide answer" : "Show answer", () => { G.show = !G.show; changed(); }), btn(null, "Done", () => noOne()));
        box.append(row); body.append(box);
    } else {
        const rows = Math.max(...G.cats.map((c) => c.clues.length)), grid = el("div", "ggrid");
        grid.style.gridTemplateColumns = "repeat(" + G.cats.length + ",minmax(0,1fr))"; grid.style.gridTemplateRows = "auto repeat(" + rows + ",minmax(0,1fr))";
        G.cats.forEach((c) => grid.append(el("div", "gcat" + (c.n.length > 26 ? " long" : ""), c.n)));
        for (let r = 0; r < rows; r++) G.cats.forEach((c, ci) => {
            const k = c.clues[r]; if (!k) { grid.append(el("div", "gtile none")); return; }
            const used = !!G.used[keyOf(ci, r)], b = btn("gtile" + (used ? " used" : ""), used ? "" : String(k.p), () => openClue(ci, r));
            b.disabled = used; b.setAttribute("aria-label", c.n + " for " + k.p + (used ? ", already played" : "")); grid.append(b);
        });
        body.append(grid);
    }
    body.append(strip()); st.append(body);
}

/** Four times a second: the clue timer on the board and on the Remote. */
export function tickGames() {
    if (!G || !onGame()) return;
    const t = G.timer, total = G.opts.secs, ms = t.running ? A.now() - t.t0 : t.elapsed, left = Math.max(0, total - Math.floor(ms / 1000));
    const started = t.running || t.elapsed > 0, done = started && left <= 0, txt = done ? "Time!" : String(left);
    const r = document.getElementById("gRing");
    if (r) {
        r.hidden = !started || !(isCh() || G.kind === "versus" || G.kind === "shots" || G.kind === "tiles" || G.kind === "race" || G.kind === "tug" ? G.cp === "q" : G.kind === "rapid" ? G.cp === "go" : G.kind === "bingo" ? G.phase === "play" : G.open); r.classList.toggle("hot", started && left <= 5);
        const arc = document.getElementById("gRingArc"), C = 2 * Math.PI * 42; if (arc) { arc.style.strokeDasharray = String(C); arc.style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, 1 - ms / (total * 1000))))); }
        document.getElementById("gClock").textContent = txt;
    }
    const pc = document.getElementById("gpClock"); if (pc) { pc.textContent = started ? txt : total + " s"; pc.classList.toggle("hot", started && left <= 5); }
    if (t.running && done && !lastDone) { A.beep(3); if (G.kind === "rapid" && G.phase === "play" && A.mode() === "remote") { lastDone = done; rapidEnd(); return; } }
    lastDone = done;
}

/* Next / Back and the space bar: show the answer, then close the tile. */
export function gameFlow(n) {
    if (!G) return;
    if (G.kind === "versus") { if (G.phase !== "play") return; if (G.cp === "result") { if (n > 0) versusNext(); return; } if (n > 0 && !G.show) { G.show = true; changed(); } else if (n < 0 && G.show) { G.show = false; changed(); } return; }
    if (G.kind === "bingo") { if (G.phase !== "play") return; if (n > 0) { if (!G.show) { save(); G.show = true; changed(); } else bingoNext(); } else if (n < 0 && G.show) { G.show = false; changed(); } return; }
    if (G.kind === "rapid") { if (n > 0 && G.phase === "play" && G.cp === "ready") rapidGo(); return; }
    if (G.kind === "tug") { if (G.phase !== "play") return; if (G.cp === "result") { if (n > 0) tugNext(); return; } if (n > 0 && !G.show) { G.show = true; changed(); } else if (n < 0 && G.show) { G.show = false; changed(); } return; }
    if (G.kind === "race") { if (G.phase !== "play") return; if (G.cp === "result") { if (n > 0) raceNext(); return; } if (n > 0 && !G.show) { G.show = true; changed(); } else if (n < 0 && G.show) { G.show = false; changed(); } return; }
    if (G.kind === "tiles") { if (G.phase !== "play") return; if (G.cp === "pick") { if (n > 0 && G.flip >= 0) tilesNextPicker(); return; } if (G.cp === "q") { if (n > 0 && !G.show) { G.show = true; changed(); } else if (n < 0 && G.show) { G.show = false; changed(); } } return; }
    if (G.kind === "shots") { if (G.phase !== "play") return; if (G.cp === "shoot") { if (n > 0 && G.shot >= 0) nextShooter(); return; } if (n > 0 && !G.show) { G.show = true; changed(); } else if (n < 0 && G.show) { G.show = false; changed(); } return; }
    if (isCh()) { if (G.phase === "play" && G.cp === "q") { if (n > 0 && !G.show) { G.show = true; changed(); } else if (n < 0 && G.show) { G.show = false; changed(); } } return; }
    if (G.phase === "final") { if (n > 0 && G.fstep < 2) { G.fstep++; changed(); } else if (n < 0 && G.fstep > 0) { G.fstep--; changed(); } return; }
    if (G.phase !== "play" || !G.open) return;
    if (n > 0) { if (!G.show) { G.show = true; changed(); } else noOne(); }
    else if (G.show) { G.show = false; changed(); }
}
export function gameFlowLabel() {
    if (!G) return "Next";
    if (G.kind === "versus") return G.phase !== "play" ? "Next" : G.cp === "result" ? "Next: Next question" : !G.show ? "Next: Show answer" : "Next";
    if (isCh()) return G.phase === "play" && G.cp === "q" && !G.show ? "Next: Show answer" : "Next";
    if (G.kind === "bingo") return G.phase !== "play" ? "Next" : !G.show ? "Next: Show answer" : "Next: Next question";
    if (G.kind === "rapid") return G.phase === "play" && G.cp === "ready" ? "Next: Start the round" : "Next";
    if (G.kind === "tug") return G.phase !== "play" ? "Next" : G.cp === "result" ? "Next: Next question" : !G.show ? "Next: Show answer" : "Next";
    if (G.kind === "race") return G.phase !== "play" ? "Next" : G.cp === "result" ? "Next: Next question" : !G.show ? "Next: Show answer" : "Next";
    if (G.kind === "tiles") return G.phase !== "play" ? "Next" : G.cp === "q" && !G.show ? "Next: Show answer" : G.cp === "pick" && G.flip >= 0 ? (G.queue.length && covered() ? "Next: Next team" : "Next: Next question") : "Next";
    if (G.kind === "shots") return G.phase !== "play" ? "Next" : G.cp === "q" ? (!G.show ? "Next: Show answer" : "Next") : G.shot >= 0 ? (G.queue.length ? "Next: Next shooter" : "Next: Next question") : "Next";
    if (G.phase === "final") return G.fstep === 0 ? "Next: Show the question" : G.fstep === 1 ? "Next: Show answer" : "Next";
    if (G.phase === "play" && G.open) return G.show ? "Next: Back to the board" : "Next: Show answer";
    return "Next";
}

/* ---------- the Remote's private panel ---------- */
function panelEl() {
    let p = document.getElementById("gamePanel");
    if (!p) { p = el("aside", "gpanel"); p.id = "gamePanel"; p.setAttribute("aria-label", "Review game controls, only on this Remote"); const body = document.querySelector(".cbody"); if (body) body.append(p); }
    return p;
}
const h = (text) => el("p", "gph", text);
function teamRows(p, each) { const box = el("div", "gprows"); G.teams.forEach((t, i) => { const r = el("div", "gprow"); each(r, t, i); box.append(r); }); p.append(box); }

export function drawPanel() {
    if (!A) return;
    const show = A.mode() === "remote" && onGame() && A.signedIn();
    document.body.classList.toggle("gaming", show);
    if (!show) { const old = document.getElementById("gamePanel"); if (old) old.hidden = true; panelSig = ""; return; }
    const p = panelEl(); p.hidden = false;
    const sig = gameSig() + "|" + (SETS ? SETS.length + ":" + SETS.map((s) => s.id + s.at).join(",") : "x") + "|" + starting + "|" + panelNote + "|" + (endArm ? 1 : 0);
    const typing = document.activeElement && p.contains(document.activeElement) && document.activeElement.tagName === "INPUT";
    if (sig === panelSig || typing) return; panelSig = sig;
    p.textContent = "";
    if (!loaded) { p.append(h("Review game"), el("p", "gpnote", "Getting " + A.S.period + " period's game…")); return; }
    if (AUTO) { tryAuto(); if (starting) return; }
    if (!G) {
        p.append(h("Start a review game"), el("p", "gpnote", A.S.period + " period. Each period keeps its own game and scores."));
        if (panelNote) p.append(el("p", "gpnote bad", panelNote));
        if (!SETS) p.append(el("p", "gpnote", "Getting your question sets…"));
        else if (!SETS.length) p.append(el("p", "gpnote", "No question sets are saved yet. Make one by pasting your table."));
        else { const list = el("div", "gpsets"), mine = SETS.filter((s) => setFor(s, A.S.period)), rest = SETS.filter((s) => !setFor(s, A.S.period));
            if (!mine.length) list.append(el("p", "gpnote", "No sets are given to " + A.S.period + " period yet. Sets for other classes are below."));
            const one = (s, into) => {
            const b = el("div", "gpset"), row = el("div", "gpsetbtns");
            b.append(el("b", null, s.title || "Review game"), el("small", null, starting === s.id ? "Opening…" : (s.cats || 0) + " categories · " + (s.clues || 0) + " questions"));
            const kindBtn = (k, label, into) => { const g = btn("btn ghost", label, () => start(s, k)); g.disabled = !!starting; g.setAttribute("aria-label", "Play " + (s.title || "this set") + " as " + label); into.append(g); };
            FRONT_KINDS.forEach(([k, label]) => kindBtn(k, label, row));
            const moreK = el("details", "gpmore gpkinds"), moreRow = el("div", "gpsetbtns");
            moreK.append(el("summary", null, "More games (" + MORE_KINDS.length + ")"), moreRow); MORE_KINDS.forEach(([k, label]) => kindBtn(k, label, moreRow));
            b.append(row, moreK); into.append(b);
            };
            mine.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).forEach((s) => one(s, list));
            if (rest.length) { const more = el("details", "gpmore"); more.append(el("summary", null, "Sets for other classes (" + rest.length + ")")); rest.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).forEach((s) => one(s, more)); list.append(more); }
            p.append(list); }
        const a = el("a", "btn " + (SETS && !SETS.length ? "go" : "ghost") + " gplink", SETS && SETS.length ? "Open the Game Library" : "Make a question set"); a.href = "games.html"; p.append(a);
        return;
    }
    if (panelNote) p.append(el("p", "gpnote bad", panelNote));
    const undoBtn = () => { const b = btn("btn ghost", "Undo last score", undo); b.disabled = !G.hist.length; return b; };
    if (G.phase === "done") {
        p.append(h("Final scores"));
        { const n = el("p", "gpnote"), a = el("a", null, "Class Data"); a.href = "data.html#games"; n.append(document.createTextNode("Saved to "), a, document.createTextNode(" with today's date" + (G.kind === "rapid" ? ". Each round's score sets the record to beat next time." : G.teams.some((t) => t.m) ? " and who was on each team." : ". Use the Group maker's groups as teams to see who won by name."))); p.append(n); }
        if (pfMsg) p.append(el("p", "gpnote", pfMsg));
        else if (G.pfN) { const n = el("p", "gpnote"), a = el("a", null, "student profiles"); a.href = "profiles.html"; n.append(document.createTextNode("Added to "), a, document.createTextNode(" for " + G.pfN + (G.pfN === 1 ? " student." : " students."))); p.append(n); }
        teamRows(p, (r, t) => r.append(el("span", "gpname", t.n), el("b", "gpscore", pts(t.s))));
        if (G.kind === "board" || !G.kind || isCh() || G.kind === "shots" || G.kind === "tiles") p.append(btn("btn ghost", isCh() || G.kind === "shots" || G.kind === "tiles" ? "Back to the game" : "Back to the board", () => { G.phase = "play"; changed(); }));
        p.append(btn("btn ghost", "Play this set again", () => { const set = cleanSet(G), names = G.teams.map((t) => t.n), o = G.opts; if (G.kind === "chests") { G = newChests(set, names); G.opts = o; } else if (G.kind === "wheel") { G = newWheel(set, names); G.opts = o; } else if (G.kind === "code") { G = newCode(set, names); G.opts = o; G.code = newCodeStr(o.len); } else if (G.kind === "versus") { G = newVersus(set, names[1]); G.opts = o; } else if (G.kind === "shots") { G = newShots(set, names); G.opts = o; } else if (G.kind === "tiles") { G = newTiles(set, names); G.opts = o; } else if (G.kind === "race") { G = newRace(set, names); G.opts = o; } else if (G.kind === "bingo") { G = newBingo(set); G.opts = o; } else if (G.kind === "tug") { G = newTug(set, names); G.opts = o; } else if (G.kind === "rapid") { G = newRapid(set, Math.max(G.rec, G.teams[0].s)); G.opts = o; } else { G = newGame(set, names); G.opts = o; pickDouble(); } changed(); }));
        p.append(endButton());
        return;
    }
    if (isCh()) { chestPanel(p); return; }
    if (G.kind === "versus") { versusPanel(p); return; }
    if (G.kind === "shots") { shotPanel(p); return; }
    if (G.kind === "tiles") { tilesPanel(p); return; }
    if (G.kind === "race") { racePanel(p); return; }
    if (G.kind === "bingo") { bingoPanel(p); return; }
    if (G.kind === "tug") { tugPanel(p); return; }
    if (G.kind === "rapid") { rapidPanel(p); return; }
    if (G.phase === "final") {
        const f = G.final;
        p.append(h(finalName(f)), mathEl("p", "gpq", f.q));
        const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, f.a)); p.append(ans);
        const step = btn("btn go", G.fstep === 0 ? "Show the question" : G.fstep === 1 ? "Show the answer" : "Show the final scores", () => { if (G.fstep < 2) G.fstep++; else G.phase = "done"; changed(); });
        p.append(step, el("p", "gpnote", "Type each team's wager, then mark it right or wrong."));
        teamRows(p, (r, t, i) => {
            r.classList.add("wager"); const cap = Math.max(t.s, topValue());
            const lab = el("span", "gpname", t.n), sc = el("b", "gpscore", pts(t.s));
            const inp = el("input"); inp.type = "number"; inp.min = "0"; inp.max = String(cap); inp.step = "50"; inp.inputMode = "numeric"; inp.value = G.wag[i] ? String(G.wag[i]) : ""; inp.placeholder = "0"; inp.setAttribute("aria-label", "Wager for " + t.n + ", up to " + cap); inp.disabled = !!G.fdone[i];
            inp.oninput = () => { G.wag[i] = Math.min(cap, Math.max(0, Math.floor(+inp.value || 0))); changed({ quiet: true }); };
            const ok = btn("gpok", "Right", () => finalScore(i, true)), no = btn("gpno", "Wrong", () => finalScore(i, false)); ok.disabled = no.disabled = !!G.fdone[i];
            ok.setAttribute("aria-label", t.n + " was right"); no.setAttribute("aria-label", t.n + " was wrong");
            r.append(lab, sc, inp, ok, no);
        });
        p.append(undoBtn(), btn("btn ghost", "Back to the board", () => { G.phase = "play"; G.fstep = 0; changed(); }));
        return;
    }
    if (G.open) {
        const o = G.open, k = clueAt(o), v = valueOf(o);
        p.append(h(G.cats[o.c].n + " · " + v + (v !== k.p ? " (double)" : "")), mathEl("p", "gpq", k.q));
        const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, k.a)); p.append(ans);
        const tr = el("div", "gptimer"), clock = el("b"); clock.id = "gpClock";
        tr.append(clock, btn("btn ghost", G.timer.running ? "Pause" : (G.timer.elapsed > 0 ? "Resume" : "Start timer"), timerGo), btn("btn ghost", "Reset", () => { G.timer = blankTimer(); changed(); }));
        p.append(tr);
        p.append(el("p", "gpnote", "Who answered?" + (G.opts.lose ? " A wrong answer loses the points and another team can steal." : " A wrong answer costs nothing and another team can steal.")));
        teamRows(p, (r, t, i) => {
            const tried = G.tried.includes(i); r.classList.add("ans");
            const ok = btn("gpok", "Right +" + v, () => score(i, true)), no = btn("gpno", "Wrong" + (G.opts.lose ? " −" + v : ""), () => score(i, false));
            ok.setAttribute("aria-label", t.n + " was right, add " + v); no.setAttribute("aria-label", t.n + " was wrong"); ok.disabled = no.disabled = tried;
            r.append(el("span", "gpname" + (i === G.turn ? " turn" : ""), t.n), el("b", "gpscore", pts(t.s)), ok, no);
        });
        p.append(btn("btn ghost", G.show ? "Hide the answer on the board" : "Show the answer on the board", () => { G.show = !G.show; changed(); }));
        p.append(btn("btn ghost", "No one got it. Close the tile", noOne), btn("btn ghost", "Back to the board, keep the tile", () => { closeClue(false); changed(); }), undoBtn());
        tickGames(); return;
    }
    /* the board is showing */
    const over = allUsed();
    p.append(h(over ? "Every tile has been played" : (G.teams[G.turn].n + " picks")), el("p", "gpnote", over ? "Finish with the final question or go straight to the scores." : "Tap a tile on the board picture to open it."));
    if (over || G.final) { const row = el("div", "gpbtns");
        if (G.final) row.append(btn("btn " + (over ? "go" : "ghost"), "Final question", () => { G.phase = "final"; G.fstep = 0; G.wag = G.teams.map(() => 0); G.fdone = G.teams.map(() => 0); changed(); }));
        if (over) row.append(btn("btn " + (G.final ? "ghost" : "go"), "Show the final scores", () => { G.phase = "done"; changed(); }));
        p.append(row); }
    teamRows(p, (r, t, i) => {
        const inp = el("input", "gpname"); inp.type = "text"; inp.maxLength = 16; inp.value = t.n; inp.setAttribute("aria-label", "Name of team " + (i + 1));
        inp.oninput = () => { G.teams[i].n = inp.value.slice(0, 16) || "Team " + (i + 1); changed({ quiet: true }); };
        const step = topValue() >= 100 ? 100 : 1, minus = btn("gpadj", "−" + step, () => adjust(i, -step)), plus = btn("gpadj", "+" + step, () => adjust(i, step));
        minus.setAttribute("aria-label", "Take " + step + " from " + t.n); plus.setAttribute("aria-label", "Give " + step + " to " + t.n);
        r.classList.toggle("turn", i === G.turn); r.append(inp, el("b", "gpscore", pts(t.s)), minus, plus);
    });
    const row = el("div", "gpbtns"); row.append(btn("btn ghost", "Next team's turn", () => { G.turn = (G.turn + 1) % G.teams.length; changed(); }), undoBtn()); p.append(row);
    p.append(optionsBox());
}
function endButton() {
    const armed = Date.now() - endArm < 4000;
    return btn("btn ghost gpend", armed ? "Tap again to end this game" : "End this game", () => {
        if (Date.now() - endArm < 4000) { endArm = 0; G = null; rev++; if (write) write({ v: 0, ended: Date.now() }); A.redraw(); }
        else { endArm = Date.now(); panelSig = ""; drawPanel(); setTimeout(() => { if (endArm && Date.now() - endArm >= 4000) { endArm = 0; panelSig = ""; drawPanel(); } }, 4100); }
    });
}

function optionsBox() {
    const opt = el("details", "gpopts"); opt.append(el("summary", null, G.kind === "versus" ? "Options" : "Teams and options")); opt.open = sessionStorage.getItem("anchorboard-game-opts") === "1"; opt.ontoggle = () => { try { sessionStorage.setItem("anchorboard-game-opts", opt.open ? "1" : "0"); } catch (e) { /* ok */ } };
    if (isCh() || G.kind === "shots" || G.kind === "tiles" || G.kind === "race") { opt.append(el("p", "gpnote", "Team names")); teamNames(opt); }
    if (G.kind === "code") {
        const l = el("label", "gpchk"), sel = el("select"); [[4, "4 digits"], [3, "3 digits (easier)"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.append(o); }); sel.value = String(G.opts.len);
        sel.onchange = () => { G.opts.len = +sel.value; changed(); }; l.append(document.createTextNode("Code length "), sel); opt.append(l);
        opt.append(el("p", "gpnote", "A new length starts with the next code. To start one now, use the button below."));
        opt.append(btn("btn ghost", "Start a new code now", () => { save(); G.no++; G.code = newCodeStr(G.opts.len); G.lastG = null; changed(); }));
    }
    if (G.kind === "race") {
        const l = el("label", "gpchk"), sel = el("select"); RACE_GOALS.forEach((n) => { const o = el("option", null, n + " steps"); o.value = n; sel.append(o); }); sel.value = String(G.opts.goal);
        sel.onchange = () => { G.opts.goal = +sel.value; if (G.teams.some((t) => t.s >= G.opts.goal)) G.phase = "done"; changed(); }; l.append(document.createTextNode("Ring size: first to "), sel); opt.append(l);
        const c = el("label", "gpchk"), cb = el("input"); cb.type = "checkbox"; cb.checked = G.opts.fast; cb.onchange = () => { G.opts.fast = cb.checked; if (!cb.checked) G.fast = -1; changed(); }; c.append(cb, document.createTextNode(" Bonus step for the fastest right team")); opt.append(c);
    }
    const pick = (label, list, cur, fn) => { const l = el("label", "gpchk"), sel = el("select"); list.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.append(o); }); sel.value = String(cur); sel.onchange = () => fn(sel.value); l.append(document.createTextNode(label + " "), sel); return l; };
    if (G.kind === "versus") {
        const l = el("label", "gpchk"), inp = el("input", "gpname"); inp.type = "text"; inp.maxLength = 16; inp.value = G.teams[1].n; inp.setAttribute("aria-label", "Teacher name on the board");
        inp.oninput = () => { G.teams[1].n = inp.value.slice(0, 16) || teacherName(); changed({ quiet: true }); }; l.append(document.createTextNode("Your name on the board "), inp); opt.append(l);
        opt.append(pick("First to", VS_GOALS.map((n) => [n, n + " points"]), G.opts.goal, (v) => { G.opts.goal = +v; if (G.teams.some((t) => t.s >= G.opts.goal)) G.phase = "done"; changed(); }));
        opt.append(pick("The class scores when", VS_RULES.map((t, i) => [i, t]), G.opts.rule, (v) => { G.opts.rule = +v; changed(); }));
    }
    const tb = el("div", "gpbtns");
    const add = btn("btn ghost", "Add a team", () => { if (G.teams.length < LIMITS.teams) { G.teams.push({ n: "Team " + (G.teams.length + 1), s: 0 }); changed(); } }); add.disabled = G.teams.length >= LIMITS.teams;
    const rem = btn("btn ghost", "Remove last team", () => { if (G.teams.length > 2) { const gone = G.teams.length - 1; G.teams.pop(); if (G.kind === "race") { G.right = G.right.filter((x) => x !== gone); G.gained = G.gained.filter((x) => x !== gone); if (G.fast === gone) G.fast = -1; } if (isCh() || G.kind === "shots" || G.kind === "tiles") { if (G.kind === "tiles" && (G.picker === gone || G.solver === gone)) { G.picker = -1; G.solver = -1; if (G.cp !== "setup") G.cp = "q"; } G.right = G.right.filter((x) => x !== gone); G.queue = G.queue.filter((x) => x !== gone); if (G.shooter === gone) { G.shooter = -1; G.cp = "q"; } } else G.turn = Math.min(G.turn, G.teams.length - 1); if (G.hist) G.hist = []; if (G.snap) G.snap = []; changed(); } }); rem.disabled = G.teams.length <= 2;
    tb.append(add, rem);
    { const gs = A.S.tools.groups, n = gs && gs.order && gs.order.length ? Math.ceil(gs.order.length / gs.size) : 0;
        if (n >= 2 && n <= LIMITS.teams && (!gs.period || gs.period === A.S.period)) tb.append(btn("btn ghost", "Use the Group maker's " + n + " groups", () => { const old = G.teams; const mem = groupMembers(); G.teams = Array.from({ length: n }, (_, i) => Object.assign({ n: "Group " + (i + 1), s: old[i] ? old[i].s : 0 }, mem[i] && mem[i].length ? { m: mem[i] } : {})); if (G.kind === "shots") { G.right = []; G.queue = []; G.shooter = -1; G.cp = "q"; } if (G.kind === "tiles") { G.right = []; G.queue = []; G.picker = -1; G.solver = -1; if (G.cp !== "setup") G.cp = "q"; } if (G.kind === "race") { G.right = []; G.fast = -1; G.gained = []; G.cp = "q"; } if (!isCh() && G.kind !== "shots" && G.kind !== "tiles" && G.kind !== "race") G.turn = Math.min(G.turn, n - 1); if (G.hist) G.hist = []; if (G.snap) G.snap = []; changed(); })); }
    if (G.kind !== "versus") opt.append(tb);
    const chk = (label, on, fn) => { const l = el("label", "gpchk"), c = el("input"); c.type = "checkbox"; c.checked = on; c.onchange = () => fn(c.checked); l.append(c, document.createTextNode(" " + label)); return l; };
    if (G.kind === "shots") opt.append(pick("A right answer is worth", SHOT_ANS.map((n) => [n, n === 0 ? "No points, just the shot" : n + (n === 1 ? " point" : " points") + " plus the shot"]), G.opts.ans, (v) => { G.opts.ans = +v; changed(); }));
    if (!isCh() && G.kind !== "versus" && G.kind !== "shots") {
        opt.append(chk("A wrong answer loses the points", G.opts.lose, (v) => { G.opts.lose = v; changed(); }));
        opt.append(chk("Hide one double-points tile", G.opts.dbl, (v) => { G.opts.dbl = v; pickDouble(); changed(); }));
    }
    const tl = el("label", "gpchk"), sel = el("select"); (isCh() || G.kind === "versus" || G.kind === "shots" || G.kind === "tiles" || G.kind === "race" ? [15, 30, 45, 60, 90, 120] : [15, 30, 45, 60, 90]).forEach((n) => { const o = el("option", null, n + " seconds"); o.value = n; sel.append(o); }); sel.value = String(G.opts.secs); sel.onchange = () => { G.opts.secs = +sel.value; changed(); };
    tl.append(document.createTextNode("Timer for each question "), sel); opt.append(tl);
    opt.append(btn("btn ghost", "Show the scores now", () => { G.phase = "done"; changed(); }), endButton());
    return opt;
}
function teamNames(p) {
    teamRows(p, (r, t, i) => {
        r.classList.add("nm"); const inp = el("input", "gpname"); inp.type = "text"; inp.maxLength = 16; inp.value = t.n; inp.setAttribute("aria-label", "Name of team " + (i + 1));
        inp.oninput = () => { G.teams[i].n = inp.value.slice(0, 16) || "Team " + (i + 1); changed({ quiet: true }); };
        r.append(inp, el("b", "gpscore", pts(t.s)));
    });
}
function chestPanel(p) {
    const q = curQ(), undoB = () => { const b = btn("btn ghost", "Undo", chestUndo); b.disabled = !G.snap.length; return b; };
    if (G.cp === "q") {
        p.append(h("Question " + (G.qi + 1) + " of " + G.qs.length), el("p", "gpnote", q.c), mathEl("p", "gpq", q.q));
        const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, q.a)); p.append(ans);
        const tr = el("div", "gptimer"), clock = el("b"); clock.id = "gpClock";
        tr.append(clock, btn("btn ghost", G.timer.running ? "Pause" : (G.timer.elapsed > 0 ? "Resume" : "Start timer"), timerGo), btn("btn ghost", "Reset", () => { G.timer = blankTimer(); changed(); }));
        p.append(tr, btn("btn ghost", G.show ? "Hide the answer on the board" : "Show the answer on the board", () => { G.show = !G.show; changed(); }));
        p.append(el("p", "gpnote", "Tap every team that got it right."));
        const box = el("div", "gpright");
        G.teams.forEach((t, i) => { const on = G.right.includes(i), b = btn("gpteam", null, () => { G.right = on ? G.right.filter((x) => x !== i) : [...G.right, i]; changed(); });
            b.setAttribute("aria-pressed", String(on)); b.append(el("span", null, t.n), el("b", null, pts(t.s))); box.append(b); });
        p.append(box);
        const n = G.right.length;
        p.append(btn("btn go", n ? (G.kind === "wheel" ? (n === 1 ? "1 team spins the wheel" : n + " teams spin the wheel") : G.kind === "code" ? (n === 1 ? "1 team scores and guesses" : n + " teams score and guess") : n === 1 ? "1 team opens a chest" : n + " teams open chests") : (G.qi >= G.qs.length - 1 ? "No one got it. Show the final scores" : "No one got it. Next question"), startPicking));
        const row = el("div", "gpbtns"); row.append(btn("btn ghost", "Skip this question", () => { save(); nextQuestion(); }), undoB()); p.append(row);
        p.append(optionsBox()); tickGames(); return;
    }
    if (G.kind === "code") { codePanel(p, undoB); return; }
    const c = curPrize(), mine = c && c.t === G.picker, who = G.teams[G.picker], pt = G.kind === "wheel" ? wheelText : prizeText;
    if (!mine && G.kind === "wheel") {
        p.append(h(who.n + " spins"), el("p", "gpnote", "Tap Spin. The board turns the wheel, and the prize is added for you."));
        p.append(btn("btn go gpspin", "Spin the wheel", spinWheel));
    } else if (!mine) {
        p.append(h(who.n + " picks a chest"), el("p", "gpnote", "Tap the chest they call out, on the board picture or here."));
        const grid = el("div", "gpchests");
        G.chests.forEach((x, i) => { const b = btn("gpadj", String(i + 1), () => openChest(i)); b.disabled = !!x.o; b.setAttribute("aria-label", "Open chest " + (i + 1)); grid.append(b); });
        p.append(grid);
    } else if (needsTarget(c)) {
        p.append(h(who.n + ": " + pt(c)), el("p", "gpnote", c.k === "swap" ? "Which team do they swap scores with?" : "Which team do they steal from? (Up to " + c.n + " points.)"));
        const box = el("div", "gpright");
        G.teams.forEach((t, i) => { if (i === c.t) return; const b = btn("gpteam", null, () => chooseTarget(i)); b.append(el("span", null, t.n), el("b", null, pts(t.s))); box.append(b); });
        p.append(box);
    } else {
        p.append(h(who.n + ": " + pt(c)));
        const last = !G.queue.length, end = last && G.qi >= G.qs.length - 1;
        p.append(btn("btn go", !last ? G.teams[G.queue[0]].n + (G.kind === "wheel" ? " spins next" : " picks next") : (end ? "Show the final scores" : "Next question"), nextPicker));
    }
    if (G.queue.length) p.append(el("p", "gpnote", (G.kind === "wheel" ? "Still to spin: " : "Still to pick: ") + G.queue.map((i) => G.teams[i].n).join(", ")));
    teamRows(p, (r, t) => r.append(el("span", "gpname", t.n), el("b", "gpscore", pts(t.s))));
    p.append(undoB());
}

function versusPanel(p) {
    const q = curQ(), undoB = () => { const b = btn("btn ghost", "Undo", chestUndo); b.disabled = !G.snap.length; return b; };
    p.append(h("Question " + (G.qi + 1) + " of " + G.qs.length), el("p", "gpnote", q.c), mathEl("p", "gpq", q.q));
    const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, q.a)); p.append(ans);
    const score = el("div", "gpvs"); G.teams.forEach((t) => { const d = el("div"); d.append(el("span", null, t.n), el("b", null, t.s + " / " + G.opts.goal)); score.append(d); }); p.append(score);
    if (G.cp === "q") {
        const tr = el("div", "gptimer"), clock = el("b"); clock.id = "gpClock";
        tr.append(clock, btn("btn ghost", G.timer.running ? "Pause" : (G.timer.elapsed > 0 ? "Resume" : "Start timer"), timerGo), btn("btn ghost", "Reset", () => { G.timer = blankTimer(); changed(); }));
        p.append(tr, el("p", "gpnote", "Boards up. The class scores when: " + VS_RULES[G.opts.rule].toLowerCase() + "."));
        const row = el("div", "gpvsbtns");
        const c = btn("gpok", "Point: Class", () => award(0)), t = btn("gpno", "Point: " + G.teams[1].n, () => award(1));
        row.append(c, t); p.append(row);
        p.append(btn("btn ghost", G.show ? "Hide the answer on the board" : "Show the answer on the board", () => { G.show = !G.show; changed(); }));
        const r2 = el("div", "gpbtns"); r2.append(btn("btn ghost", "Skip this question", () => { save(); versusNext(); }), undoB()); p.append(r2);
        tickGames();
    } else {
        p.append(btn("btn go", G.qi >= G.qs.length - 1 ? "Show the final score" : "Next question", versusNext));
        p.append(undoB());
    }
    p.append(optionsBox());
}

function shotPanel(p) {
    const q = curQ(), undoB = () => { const b = btn("btn ghost", "Undo", chestUndo); b.disabled = !G.snap.length; return b; };
    if (G.cp === "q") {
        p.append(h("Question " + (G.qi + 1) + " of " + G.qs.length), el("p", "gpnote", q.c), mathEl("p", "gpq", q.q));
        const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, q.a)); p.append(ans);
        const tr = el("div", "gptimer"), clock = el("b"); clock.id = "gpClock";
        tr.append(clock, btn("btn ghost", G.timer.running ? "Pause" : (G.timer.elapsed > 0 ? "Resume" : "Start timer"), timerGo), btn("btn ghost", "Reset", () => { G.timer = blankTimer(); changed(); }));
        p.append(tr, btn("btn ghost", G.show ? "Hide the answer on the board" : "Show the answer on the board", () => { G.show = !G.show; changed(); }));
        p.append(el("p", "gpnote", "Tap every team that got it right." + (G.opts.ans ? " Each one gets " + G.opts.ans + (G.opts.ans === 1 ? " point" : " points") + " and a shot." : " Each one gets a shot.")));
        const box = el("div", "gpright");
        G.teams.forEach((t, i) => { const on = G.right.includes(i), b = btn("gpteam", null, () => { G.right = on ? G.right.filter((x) => x !== i) : [...G.right, i]; changed(); });
            b.setAttribute("aria-pressed", String(on)); b.append(el("span", null, t.n), el("b", null, pts(t.s))); box.append(b); });
        p.append(box);
        const n = G.right.length;
        p.append(btn("btn go", n ? (n === 1 ? "1 team shoots" : n + " teams shoot") : (G.qi >= G.qs.length - 1 ? "No one got it. Show the final scores" : "No one got it. Next question"), startShooting));
        const row = el("div", "gpbtns"); row.append(btn("btn ghost", "Skip this question", () => { save(); shotNextQuestion(); }), undoB()); p.append(row);
        p.append(optionsBox()); tickGames(); return;
    }
    const who = G.teams[G.shooter];
    if (G.shot < 0) {
        p.append(h(who.n + " shoots"), el("p", "gpnote", "Tap what happened."));
        const grid = el("div", "gpshots");
        SHOT_LINES.forEach(([n, label]) => { const b = btn("gpok", "Made it from the " + label, () => takeShot(n)); b.setAttribute("aria-label", who.n + " made it from the " + label + ", add " + n); grid.append(b); });
        const miss = btn("gpno", "Missed", () => takeShot(0)); miss.setAttribute("aria-label", who.n + " missed"); grid.append(miss);
        p.append(grid);
    } else {
        p.append(h(who.n + ": " + (G.shot ? "made it, +" + G.shot : "missed")));
        const last = !G.queue.length, end = last && G.qi >= G.qs.length - 1;
        p.append(btn("btn go", !last ? G.teams[G.queue[0]].n + " shoots next" : (end ? "Show the final scores" : "Next question"), nextShooter));
    }
    if (G.queue.length) p.append(el("p", "gpnote", "Still to shoot: " + G.queue.map((i) => G.teams[i].n).join(", ")));
    teamRows(p, (r, t) => r.append(el("span", "gpname", t.n), el("b", "gpscore", pts(t.s))));
    p.append(undoB());
}

function tilesPanel(p) {
    const undoB = () => { const b = btn("btn ghost", "Undo", chestUndo); b.disabled = !G.snap.length; return b; };
    if (G.cp === "setup" || G.cp === "solved") {
        if (G.cp === "solved") p.append(h(G.teams[G.solver].n + " solved it! +" + G.got), el("p", "gpnote", "The phrase was: " + G.ph));
        else p.append(h("Mystery Tiles: set the mystery"));
        p.append(el("p", "gpnote", "Type a word or phrase for the class to guess, like a vocabulary word, a rule or a famous mathematician. Only you see it until the tiles flip."));
        const f = el("div", "gpmy"), ph = el("input"), hint = el("input");
        ph.type = "text"; ph.maxLength = 60; ph.placeholder = "Mystery phrase"; ph.setAttribute("aria-label", "Mystery phrase"); ph.autocomplete = "off";
        hint.type = "text"; hint.maxLength = 60; hint.placeholder = "Hint on the board (optional)"; hint.setAttribute("aria-label", "Hint on the board");
        const go = btn("btn go", G.cp === "solved" ? "Start the next mystery" : "Hide it and start", () => { if (ph.value.trim()) newMystery(ph.value, hint.value); else ph.focus(); });
        ph.onkeydown = hint.onkeydown = (e) => { if (e.key === "Enter") go.click(); };
        f.append(ph, hint, go); p.append(f);
        if (G.cp === "solved") p.append(btn("btn ghost", "Show the final scores", () => { G.phase = "done"; changed(); }));
        teamRows(p, (r, t) => r.append(el("span", "gpname", t.n), el("b", "gpscore", pts(t.s))));
        p.append(undoB(), optionsBox()); return;
    }
    p.append(el("p", "gpnote gpmysecret", "Mystery: " + G.ph + (G.hint ? " · Hint: " + G.hint : "")));
    const q = curQ();
    if (G.cp === "q") {
        p.append(h("Question " + (G.qi + 1) + " of " + G.qs.length), el("p", "gpnote", q.c), mathEl("p", "gpq", q.q));
        const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, q.a)); p.append(ans);
        const tr = el("div", "gptimer"), clock = el("b"); clock.id = "gpClock";
        tr.append(clock, btn("btn ghost", G.timer.running ? "Pause" : (G.timer.elapsed > 0 ? "Resume" : "Start timer"), timerGo), btn("btn ghost", "Reset", () => { G.timer = blankTimer(); changed(); }));
        p.append(tr, btn("btn ghost", G.show ? "Hide the answer on the board" : "Show the answer on the board", () => { G.show = !G.show; changed(); }));
        p.append(el("p", "gpnote", "Tap every team that got it right. Each one flips a tile (+" + TILE_PTS + ")."));
        const box = el("div", "gpright");
        G.teams.forEach((t, i) => { const on = G.right.includes(i), b = btn("gpteam", null, () => { G.right = on ? G.right.filter((x) => x !== i) : [...G.right, i]; changed(); });
            b.setAttribute("aria-pressed", String(on)); b.append(el("span", null, t.n), el("b", null, pts(t.s))); box.append(b); });
        p.append(box);
        const n = G.right.length;
        p.append(btn("btn go", n ? (n === 1 ? "1 team flips a tile" : n + " teams flip tiles") : (G.qi >= G.qs.length - 1 ? "No one got it. Show the final scores" : "No one got it. Next question"), tilesPicking));
        const row = el("div", "gpbtns"); row.append(btn("btn ghost", "Skip this question", () => { save(); tilesNextQuestion(); }), undoB()); p.append(row);
    } else {
        const who = G.teams[G.picker];
        if (G.flip < 0) {
            p.append(h(who.n + " picks a tile"), el("p", "gpnote", "Tap the tile they call out, here or on the board picture."));
            const grid = el("div", "gpchests gpmytiles");
            G.tiles.forEach((t, i) => { const b = btn("gpadj", String(i + 1), () => flipTile(i)); b.disabled = !!t; b.setAttribute("aria-label", "Flip tile " + (i + 1)); grid.append(b); });
            p.append(grid);
        } else {
            p.append(h(who.n + ": tile " + (G.flip + 1) + ", +" + TILE_PTS));
            const last = !G.queue.length || !covered(), end = last && G.qi >= G.qs.length - 1;
            p.append(btn("btn go", !last ? G.teams[G.queue[0]].n + " picks next" : (end ? "Show the final scores" : "Next question"), tilesNextPicker));
        }
        if (G.queue.length) p.append(el("p", "gpnote", "Still to pick: " + G.queue.map((i) => G.teams[i].n).join(", ")));
    }
    const guess = el("div", "gpguess");
    guess.append(el("p", "gpnote", "A team guessed the mystery right? Tap them (+" + solveValue() + "). A wrong guess costs nothing."));
    const gb = el("div", "gpright"); G.teams.forEach((t, i) => { const b = btn("gpteam", null, () => solve(i)); b.append(el("span", null, t.n + " solved it"), el("b", null, "+" + solveValue())); gb.append(b); });
    guess.append(gb); p.append(guess);
    teamRows(p, (r, t) => r.append(el("span", "gpname", t.n), el("b", "gpscore", pts(t.s))));
    p.append(undoB(), optionsBox()); tickGames();
}

function racePanel(p) {
    const q = curQ(), undoB = () => { const b = btn("btn ghost", "Undo", chestUndo); b.disabled = !G.snap.length; return b; };
    p.append(h("Question " + (G.qi + 1) + " of " + G.qs.length), el("p", "gpnote", q.c + " · first to " + G.opts.goal), mathEl("p", "gpq", q.q));
    const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, q.a)); p.append(ans);
    if (G.cp === "q") {
        const tr = el("div", "gptimer"), clock = el("b"); clock.id = "gpClock";
        tr.append(clock, btn("btn ghost", G.timer.running ? "Pause" : (G.timer.elapsed > 0 ? "Resume" : "Start timer"), timerGo), btn("btn ghost", "Reset", () => { G.timer = blankTimer(); changed(); }));
        p.append(tr, btn("btn ghost", G.show ? "Hide the answer on the board" : "Show the answer on the board", () => { G.show = !G.show; changed(); }));
        p.append(el("p", "gpnote", "Tap every team that got it right." + (G.opts.fast ? " Tap a right team again to mark it fastest (+1 bonus step)." : "")));
        const box = el("div", "gpright");
        G.teams.forEach((t, i) => { const on = G.right.includes(i), star = G.fast === i, b = btn("gpteam" + (star ? " fast" : ""), null, () => raceTap(i));
            b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", t.n + (star ? ", right and fastest" : on ? ", right" : ", not marked"));
            b.append(el("span", null, t.n + (star ? " ★ fastest" : "")), el("b", null, t.s + " / " + G.opts.goal)); box.append(b); });
        p.append(box);
        const n = G.right.length;
        p.append(btn("btn go", n ? (n === 1 ? "Move 1 team" : "Move " + n + " teams") : "No one got it. Show the answer", raceScore));
        const row = el("div", "gpbtns"); row.append(btn("btn ghost", "Skip this question", () => { save(); raceNext(); }), undoB()); p.append(row);
        tickGames();
    } else {
        p.append(h(G.gained.length ? G.gained.map((i) => G.teams[i].n).join(", ") + " moved" : "No one moved"));
        p.append(btn("btn go", G.qi >= G.qs.length - 1 ? "Show the final scores" : "Next question", raceNext), undoB());
        teamRows(p, (r, t) => r.append(el("span", "gpname", t.n), el("b", "gpscore", t.s + " / " + G.opts.goal)));
    }
    p.append(optionsBox());
}

let bingoPick = "";
function bingoPanel(p) {
    const q = curQ(), set = cleanSet(G), pool = bingoPool(set), size = bingoSize(pool), undoB = () => { const b = btn("btn ghost", "Undo", chestUndo); b.disabled = !G.snap.length; return b; };
    const print = el("a", "btn ghost gplink", "Print the cards for this game"); print.href = "bingo.html?" + new URLSearchParams({ set: G.id, seed: String(G.seed), n: String(G.opts.cards) }).toString(); print.target = "_blank"; print.rel = "noopener";
    if (!size) { p.append(h("Bingo needs more answers"), el("p", "gpnote", "This set has " + pool.length + " different answers. Bingo needs at least 9 (a 3 by 3 card); 24 or more makes a full 5 by 5 card."), endButton()); return; }
    p.append(el("p", "gpnote", "Cards: " + size + " by " + size + (size === 5 ? " with a free middle" : "") + " · game number " + G.seed + ". Print before you start; cards only match this game."), print);
    p.append(h("Question " + (G.qi + 1) + " of " + G.qs.length), el("p", "gpnote", q.c), mathEl("p", "gpq", q.q));
    const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, q.a)); p.append(ans);
    const tr = el("div", "gptimer"), clock = el("b"); clock.id = "gpClock";
    tr.append(clock, btn("btn ghost", G.timer.running ? "Pause" : (G.timer.elapsed > 0 ? "Resume" : "Start timer"), timerGo), btn("btn ghost", "Reset", () => { G.timer = blankTimer(); changed(); }));
    p.append(tr);
    if (!G.show) p.append(btn("btn go", "Show the answer: everyone marks it", () => { save(); G.show = true; changed(); }));
    else p.append(btn("btn go", G.qi >= G.qs.length - 1 ? "That was the last one. Show the results" : "Next question", bingoNext));
    p.append(undoB());
    /* check a card */
    const chk = el("div", "gpbingo"), row = el("div", "gpbrow"), inp = el("input");
    inp.type = "number"; inp.min = "1"; inp.max = String(G.opts.cards); inp.inputMode = "numeric"; inp.placeholder = "Card #"; inp.value = bingoPick; inp.setAttribute("aria-label", "Card number to check");
    const go = btn("btn ghost", "Check this card", () => { bingoPick = inp.value; G.check = Math.max(0, Math.floor(+inp.value || 0)); changed({ quiet: true }); panelSig = ""; drawPanel(); });
    inp.onkeydown = (e) => { if (e.key === "Enter") go.click(); };
    row.append(inp, go); chk.append(el("p", "gph", "Someone called Bingo?"), el("p", "gpnote", "Type the number printed on their card."), row);
    if (G.check > 0) {
        const card = bingoCard(pool, G.seed, G.check), { hit, lines } = bingoLines(card, calledSet()), grid = el("div", "gpbcard");
        grid.style.gridTemplateColumns = "repeat(" + card.size + ",1fr)";
        card.cells.forEach((c, i) => { const cell = el("div", "gpbcell" + (hit[i] ? " hit" : "")); if (c === "") cell.textContent = "FREE"; else cell.append(mathRich(c)); grid.append(cell); });
        chk.append(el("p", "gpnote " + (lines.length ? "gpbyes" : "bad"), "Card " + G.check + ": " + (lines.length ? "Bingo! " + lines.join(", ") : "not yet. " + hit.filter(Boolean).length + " of " + hit.length + " marked.")), grid);
        if (lines.length) { const won = G.teams.some((t) => t.c === G.check), w = btn("btn go", won ? "Card " + G.check + " is on the board" : "Card " + G.check + " wins: show it on the board", () => bingoWin(G.check)); w.disabled = won; chk.append(w); }
    }
    p.append(chk);
    const opt = el("details", "gpopts"); opt.append(el("summary", null, "Options"));
    const cl = el("label", "gpchk"), cn = el("input"); cn.type = "number"; cn.min = "1"; cn.max = "60"; cn.value = String(G.opts.cards); cn.setAttribute("aria-label", "How many cards to print");
    cn.onchange = () => { G.opts.cards = Math.min(60, Math.max(1, Math.floor(+cn.value || 30))); changed(); }; cl.append(document.createTextNode("Cards to print "), cn); opt.append(cl);
    opt.append(btn("btn ghost", "Show the results now", () => { G.phase = "done"; changed(); }), endButton());
    p.append(opt); tickGames();
}

function tugPanel(p) {
    const q = curQ(), undoB = () => { const b = btn("btn ghost", "Undo", chestUndo); b.disabled = !G.snap.length; return b; }, [A0, B0] = G.teams;
    p.append(h("Question " + (G.qi + 1) + " of " + G.qs.length), el("p", "gpnote", q.c), mathEl("p", "gpq", q.q));
    const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, q.a)); p.append(ans);
    const pos = tugPos(), sc = el("div", "gpvs"); G.teams.forEach((t) => { const d = el("div"); d.append(el("span", null, t.n), el("b", null, t.s + (t.s === 1 ? " pull" : " pulls"))); sc.append(d); }); p.append(sc);
    p.append(el("p", "gpnote", pos === 0 ? "The rope is dead even. First to " + G.opts.goal + " steps wins." : G.teams[pos < 0 ? 0 : 1].n + " is " + Math.abs(pos) + " of " + G.opts.goal + " steps from winning."));
    if (G.cp === "q") {
        const tr = el("div", "gptimer"), clock = el("b"); clock.id = "gpClock";
        tr.append(clock, btn("btn ghost", G.timer.running ? "Pause" : (G.timer.elapsed > 0 ? "Resume" : "Start timer"), timerGo), btn("btn ghost", "Reset", () => { G.timer = blankTimer(); changed(); }));
        p.append(tr, btn("btn ghost", G.show ? "Hide the answer on the board" : "Show the answer on the board", () => { G.show = !G.show; changed(); }));
        p.append(el("p", "gpnote", "Who got it right?"));
        const row = el("div", "gptug");
        row.append(btn("gpok", A0.n + " right", () => tugPull(0)), btn("gpok", B0.n + " right", () => tugPull(1)), btn("gpadj", "Both right", () => tugPull(2)), btn("gpno", "Neither", () => tugPull(3)));
        p.append(row);
        const r2 = el("div", "gpbtns"); r2.append(btn("btn ghost", "Skip this question", () => { save(); tugNext(); }), undoB()); p.append(r2);
        tickGames();
    } else {
        p.append(btn("btn go", G.qi >= G.qs.length - 1 ? "Show the final result" : "Next question", tugNext), undoB());
    }
    const opt = el("details", "gpopts"); opt.append(el("summary", null, "Options")); opt.open = sessionStorage.getItem("anchorboard-game-opts") === "1"; opt.ontoggle = () => { try { sessionStorage.setItem("anchorboard-game-opts", opt.open ? "1" : "0"); } catch (e) { /* ok */ } };
    G.teams.forEach((t, i) => { const l = el("label", "gpchk"), inp = el("input", "gpname"); inp.type = "text"; inp.maxLength = 16; inp.value = t.n; inp.setAttribute("aria-label", "Name of side " + (i + 1));
        inp.oninput = () => { G.teams[i].n = inp.value.slice(0, 16) || (i ? "Gold" : "Blue"); changed({ quiet: true }); }; l.append(document.createTextNode((i ? "Right" : "Left") + " side "), inp); opt.append(l); });
    const pick = (label, list, cur, fn) => { const l = el("label", "gpchk"), sel = el("select"); list.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.append(o); }); sel.value = String(cur); sel.onchange = () => fn(sel.value); l.append(document.createTextNode(label + " "), sel); return l; };
    opt.append(pick("Steps to win", TUG_GOALS.map((n) => [n, n + " steps"]), G.opts.goal, (v) => { G.opts.goal = +v; if (Math.abs(tugPos()) >= G.opts.goal) G.phase = "done"; changed(); }));
    opt.append(pick("Timer for each question", [15, 30, 45, 60, 90, 120].map((n) => [n, n + " seconds"]), G.opts.secs, (v) => { G.opts.secs = +v; changed(); }));
    opt.append(btn("btn ghost", "Show the result now", () => { G.phase = "done"; changed(); }), endButton());
    p.append(opt);
}

function rapidPanel(p) {
    const q = curQ(), undoB = () => { const b = btn("btn ghost", "Undo", chestUndo); b.disabled = !G.snap.length; return b; };
    const sc = el("div", "gpvs gprfvs"); [["Right", G.teams[0].s], ["Missed", G.miss], ["In a row", G.streak]].forEach(([t, v]) => { const d = el("div"); d.append(el("span", null, t), el("b", null, String(v))); sc.append(d); });
    if (G.cp === "ready") {
        p.append(h("Rapid Fire: " + G.opts.secs + " seconds"), el("p", "gpnote", "The board shows one question at a time. Tap Right or Missed as fast as the class answers, and the next one shows at once. " + (G.rec ? "Class record for " + A.S.period + " period: " + G.rec + "." : "No record yet for " + A.S.period + " period.")));
        p.append(btn("btn go", "Start the round", rapidGo));
    } else {
        p.append(h("Question " + (G.qi + 1) + " of " + G.qs.length), el("p", "gpnote", q.c), mathEl("p", "gpq", q.q));
        const ans = el("div", "gpans"); ans.append(el("small", null, "Answer (only you see this)"), mathEl("p", null, q.a)); p.append(ans);
        const tr = el("div", "gptimer"), clock = el("b"); clock.id = "gpClock";
        tr.append(clock, btn("btn ghost", G.timer.running ? "Pause" : "Resume", rapidGo)); p.append(tr);
        const row = el("div", "gprapid"), ok = btn("gpok", "Right", () => rapidMark(0)), no = btn("gpno", "Missed", () => rapidMark(1));
        ok.disabled = no.disabled = !G.timer.running; row.append(ok, no); p.append(row);
        const r2 = el("div", "gpbtns"), sk = btn("btn ghost", "Skip", () => rapidMark(2)); sk.disabled = !G.timer.running; r2.append(sk, undoB()); p.append(r2);
        if (!G.timer.running) p.append(el("p", "gpnote", "Paused. Tap Resume to keep going."));
    }
    p.append(sc);
    const opt = el("details", "gpopts"); opt.append(el("summary", null, "Options")); opt.open = sessionStorage.getItem("anchorboard-game-opts") === "1"; opt.ontoggle = () => { try { sessionStorage.setItem("anchorboard-game-opts", opt.open ? "1" : "0"); } catch (e) { /* ok */ } };
    const l = el("label", "gpchk"), sel = el("select"); RAPID_SECS.map((n) => [n, n < 60 ? n + " seconds" : n / 60 + (n === 60 ? " minute" : " minutes")]).forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.append(o); });
    sel.value = String(G.opts.secs); sel.disabled = G.cp !== "ready"; sel.onchange = () => { G.opts.secs = +sel.value; changed(); }; l.append(document.createTextNode("Round length "), sel); opt.append(l);
    if (G.cp !== "ready") opt.append(el("p", "gpnote", "Round length is set before the round starts."));
    opt.append(btn("btn ghost", "End the round now", rapidEnd), endButton());
    p.append(opt); tickGames();
}

function codePanel(p, undoB) {
    const who = G.teams[G.picker], lg = G.lastG && G.lastG.t === G.picker ? G.lastG : null;
    const sec = el("div", "gpans"); sec.append(el("small", null, "Secret code (only you see this)"), el("p", "gpcode", G.code)); 
    if (!lg) {
        p.append(h(who.n + " guesses"), el("p", "gpnote", "Type the " + G.code.length + " digits they call out. Each digit is used once in the code."));
        const show = el("div", "gpcodein"); for (let i = 0; i < G.code.length; i++) show.append(el("span", null, codeEntry[i] || "")); p.append(show);
        const pad = el("div", "gpkeys"), tap = (fn) => () => { fn(); panelSig = ""; drawPanel(); };
        [..."1234567890"].forEach((d) => { const b = btn("gpadj", d, tap(() => { if (codeEntry.length < G.code.length && !codeEntry.includes(d)) codeEntry += d; })); b.disabled = codeEntry.includes(d) || codeEntry.length >= G.code.length; pad.append(b); });
        const back = btn("gpadj", "⌫", tap(() => { codeEntry = codeEntry.slice(0, -1); })); back.setAttribute("aria-label", "Delete last digit"); back.disabled = !codeEntry; pad.append(back);
        p.append(pad);
        const go = btn("btn go", "Check the guess", () => codeGuess(codeEntry)); go.disabled = codeEntry.length !== G.code.length; p.append(go);
    } else {
        const cracked = G.solved && G.solved.qi === G.qi && G.solved.no === lg.no;
        p.append(h(who.n + ": " + (cracked ? "cracked it! +" + CODE_CRACK : [...lg.r].filter((x) => x === "g").length + " right spot, " + [...lg.r].filter((x) => x === "a").length + " wrong spot")));
        p.append(codeRow(lg.g, lg.r, "gpcrow"));
        const last = !G.queue.length, end = last && G.qi >= G.qs.length - 1;
        p.append(btn("btn go", !last ? G.teams[G.queue[0]].n + " guesses next" : (end ? "Show the final scores" : "Next question"), nextPicker));
    }
    p.append(sec);
    if (G.queue.length) p.append(el("p", "gpnote", "Still to guess: " + G.queue.map((i) => G.teams[i].n).join(", ")));
    teamRows(p, (r, t) => r.append(el("span", "gpname", t.n), el("b", "gpscore", pts(t.s))));
    p.append(undoB());
}

