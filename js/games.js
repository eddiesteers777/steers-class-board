/* ==========================================
   Focal — review games the teacher runs.
   The board shows the game; the Remote runs it. Students never sign in
   and never touch a device. The teacher scores the teams.

   Question sets are the teacher's own and are PRIVATE:
     teacher/{uid}/games/index        the list of saved sets
     teacher/{uid}/games/s_<id>       one question set
     teacher/{uid}/games/live_<per>   the game being played in one period
   Nothing here goes in the public repo.

   Games: the Review Board (a grid of categories and point tiles) and
   Treasure Chests (every team answers; teams that got it right open a chest).
========================================== */

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
        .map((k) => ({ p: Math.max(1, Math.floor(+k.p || 0)), q: str(k.q, LIMITS.q), a: str(k.a, LIMITS.a) })).filter((k) => k.q) })).filter((c) => c.clues.length);
    if (!cats.length) return null;
    const f = d.final && d.final.q ? { c: str(d.final.c, LIMITS.cat) || "Final question", q: str(d.final.q, LIMITS.q), a: str(d.final.a, LIMITS.a) } : null;
    return { id: str(d.id, 40), title: str(d.title, LIMITS.title) || "Review game", cats, final: f };
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
    if (d && d.kind === "chests") return cleanChests(d);
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
const prizeText = (c) => ({ add: "+" + c.n + " points", dbl: "Double points!", steal: c.x >= 0 ? "Stole " + (c.g || 0) : "Steal " + c.n, swap: "Swap scores", lose: "Lose " + c.n, none: "Empty chest" }[c.k] || "");
const needsTarget = (c) => (c.k === "steal" || c.k === "swap") && c.x === -1;

/* ---------- the live game for the period on screen ---------- */
let A = null;             // what the board app lends us: { S, header, store, writer, now, beep, redraw, mode, signedIn }
let G = null, loaded = false, key = "", unsub = null, write = null, rev = 0;
let SETS = null, setsWatched = false, starting = "", panelSig = "", lastDone = false, endArm = 0, panelNote = "";

export function mountGames(api) { A = api; }
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
        key = want; G = null; loaded = false; write = null; rev++; lastDone = false; panelNote = "";
        if (key) {
            const mine = key; write = A.writer(mine);
            unsub = A.store().watch(mine, (snap) => {
                if (mine !== key || snap.pending || (write && write.busy())) return;
                G = snap.exists ? cleanGame(snap.data) : null; loaded = true; rev++; A.redraw();
            }, () => { loaded = true; rev++; panelNote = "Saved games are not available right now."; A.redraw(); });
        }
    }
    if (!setsWatched && A.signedIn() && A.mode() === "remote" && onGame()) {
        setsWatched = true;
        A.store().watch("games/index", (snap) => { if (snap.pending) return; SETS = ((snap.exists && snap.data && snap.data.sets) || []).filter((s) => s && s.id).slice(0, 200); panelSig = ""; drawPanel(); }, () => { SETS = []; panelSig = ""; drawPanel(); });
    }
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
    if (right) { G.teams[t].s += v; G.hist.push({ t, d: v, k, c: 1, f: 0 }); closeClue(true); }
    else { const d = G.opts.lose ? -v : 0; G.teams[t].s += d; if (!G.tried.includes(t)) G.tried.push(t); G.hist.push({ t, d, k, c: 0, f: 0 }); }
    G.hist = G.hist.slice(-60); changed();
}
function noOne() { const o = G.open; if (!o) return; G.hist.push({ t: -1, d: 0, k: keyOf(o.c, o.r), c: 1, f: 0 }); closeClue(true); changed(); }
function undo() {
    const h = G.hist.pop(); if (!h) return;
    if (h.t >= 0 && G.teams[h.t]) G.teams[h.t].s -= h.d;
    if (h.f) { if (h.t >= 0) G.fdone[h.t] = 0; }
    else if (h.k) {
        const [c, r] = h.k.split("-").map(Number);
        if (h.c) {   // the tile had closed: open it again, with the misses that came before
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
    G = kind === "chests" ? newChests(set, keep) : newGame(set, keep); loaded = true; changed();
}


/* ---------- Treasure Chests moves ---------- */
function save() { const g = Object.assign({}, G); delete g.snap; delete g.timer; G.snap.push(JSON.stringify(g)); G.snap = G.snap.slice(-12); }
function chestUndo() {
    const last = G.snap.pop(); if (!last) return; const snap = G.snap, timer = G.timer;
    G = cleanChests(Object.assign(JSON.parse(last), { snap, timer })) || G; changed();
}
const curQ = () => G.qs[G.qi];
function nextQuestion() {
    if (G.qi >= G.qs.length - 1) { G.phase = "done"; changed(); return; }
    G.qi++; G.cp = "q"; G.show = false; G.right = []; G.queue = []; G.picker = -1; G.chests = closedChests(); G.last = -1; G.timer = blankTimer(); changed();
}
function startPicking() {
    save(); G.queue = G.teams.map((_, i) => i).filter((i) => G.right.includes(i));
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
function chooseTarget(x) { const c = G.chests[G.last]; if (!c || !needsTarget(c)) return; save(); c.x = x; applyPrize(c, c.t); changed(); }
function nextPicker() {
    if (G.queue.length) { G.picker = G.queue.shift(); changed(); } else nextQuestion();
}

/* ---------- the stage (what students see) ---------- */
function strip() {
    const s = el("div", "gteams"); s.id = "gTeams";
    const best = Math.max(...G.teams.map((t) => t.s));
    G.teams.forEach((t, i) => {
        const now = G.kind === "chests" ? (G.cp === "pick" && i === G.picker) : (G.phase === "play" && i === G.turn), b = el("div", "gteam" + (now ? " turn" : "") + (G.phase === "done" && t.s === best ? " win" : ""));
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
function chestStage(body) {
    const q = curQ(), top = el("div", "gtop");
    if (G.cp === "q") {
        const box = el("div", "gclue");
        top.append(el("span", "gchip", "Question " + (G.qi + 1) + " of " + G.qs.length + " · " + q.c), ring());
        box.append(top, qBox(q.q));
        if (G.show) { const a = el("div", "gans"); a.append(el("small", null, "Answer"), mathEl("p", null, q.a)); box.append(a); }
        box.append(el("p", "gchnote", "Every team: write your answer. Right answers open a chest."));
        body.append(box); return;
    }
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

export function drawStage(st) {
    const S = A.S, per = S.period + " period";
    if (!loaded) { st.append(A.header("Review Game", per), el("div", "gbody")); return; }
    if (!G) {
        st.append(A.header("Review Game", per));
        const e = el("div", "empty"); e.append(el("b", null, "No game is running for " + per + "."), document.createTextNode(A.mode() === "remote" ? "Pick a question set in the panel beside the board to start one." : "Start one from the Remote."));
        st.append(e); return;
    }
    st.append(A.header(G.kind === "chests" ? "Treasure Chests" : "Review Game", G.title));
    const body = el("div", "gbody");
    if (G.kind === "chests" && G.phase !== "done") chestStage(body);
    else if (G.phase === "done") {
        const best = Math.max(...G.teams.map((t) => t.s)), win = G.teams.filter((t) => t.s === best), box = el("div", "gdone");
        box.append(el("p", "gwinlab", win.length > 1 ? "It's a tie!" : "Winner"), el("p", "gwin", win.map((t) => t.n).join(" and ")), el("p", "gwinpts", pts(best) + " points"));
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
        r.hidden = !started || !(G.kind === "chests" ? G.cp === "q" : G.open); r.classList.toggle("hot", started && left <= 5);
        const arc = document.getElementById("gRingArc"), C = 2 * Math.PI * 42; if (arc) { arc.style.strokeDasharray = String(C); arc.style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, 1 - ms / (total * 1000))))); }
        document.getElementById("gClock").textContent = txt;
    }
    const pc = document.getElementById("gpClock"); if (pc) { pc.textContent = started ? txt : total + " s"; pc.classList.toggle("hot", started && left <= 5); }
    if (t.running && done && !lastDone) A.beep(3);
    lastDone = done;
}

/* Next / Back and the space bar: show the answer, then close the tile. */
export function gameFlow(n) {
    if (!G) return;
    if (G.kind === "chests") { if (G.phase === "play" && G.cp === "q") { if (n > 0 && !G.show) { G.show = true; changed(); } else if (n < 0 && G.show) { G.show = false; changed(); } } return; }
    if (G.phase === "final") { if (n > 0 && G.fstep < 2) { G.fstep++; changed(); } else if (n < 0 && G.fstep > 0) { G.fstep--; changed(); } return; }
    if (G.phase !== "play" || !G.open) return;
    if (n > 0) { if (!G.show) { G.show = true; changed(); } else noOne(); }
    else if (G.show) { G.show = false; changed(); }
}
export function gameFlowLabel() {
    if (!G) return "Next";
    if (G.kind === "chests") return G.phase === "play" && G.cp === "q" && !G.show ? "Next: Show answer" : "Next";
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
    if (!G) {
        p.append(h("Start a review game"), el("p", "gpnote", A.S.period + " period. Each period keeps its own game and scores."));
        if (panelNote) p.append(el("p", "gpnote bad", panelNote));
        if (!SETS) p.append(el("p", "gpnote", "Getting your question sets…"));
        else if (!SETS.length) p.append(el("p", "gpnote", "No question sets are saved yet. Make one by pasting your table."));
        else { const list = el("div", "gpsets"); SETS.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).forEach((s) => {
            const b = el("div", "gpset"), row = el("div", "gpsetbtns");
            b.append(el("b", null, s.title || "Review game"), el("small", null, starting === s.id ? "Opening…" : (s.cats || 0) + " categories · " + (s.clues || 0) + " questions"));
            [["board", "Review Board"], ["chests", "Treasure Chests"]].forEach(([k, label]) => { const g = btn("btn ghost", label, () => start(s, k)); g.disabled = !!starting; g.setAttribute("aria-label", "Play " + (s.title || "this set") + " as " + label); row.append(g); });
            b.append(row); list.append(b);
        }); p.append(list); }
        const a = el("a", "btn " + (SETS && !SETS.length ? "go" : "ghost") + " gplink", SETS && SETS.length ? "Make or edit question sets" : "Make a question set"); a.href = "games.html"; p.append(a);
        return;
    }
    if (panelNote) p.append(el("p", "gpnote bad", panelNote));
    const undoBtn = () => { const b = btn("btn ghost", "Undo last score", undo); b.disabled = !G.hist.length; return b; };
    if (G.phase === "done") {
        p.append(h("Final scores"));
        teamRows(p, (r, t) => r.append(el("span", "gpname", t.n), el("b", "gpscore", pts(t.s))));
        if (G.kind !== "chests" || G.cp) p.append(btn("btn ghost", G.kind === "chests" ? "Back to the game" : "Back to the board", () => { G.phase = "play"; changed(); }));
        p.append(btn("btn ghost", "Play this set again", () => { const set = cleanSet(G), names = G.teams.map((t) => t.n), o = G.opts; if (G.kind === "chests") { G = newChests(set, names); G.opts = o; } else { G = newGame(set, names); G.opts = o; pickDouble(); } changed(); }));
        p.append(endButton());
        return;
    }
    if (G.kind === "chests") { chestPanel(p); return; }
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
    const opt = el("details", "gpopts"); opt.append(el("summary", null, "Teams and options")); opt.open = sessionStorage.getItem("focal-game-opts") === "1"; opt.ontoggle = () => { try { sessionStorage.setItem("focal-game-opts", opt.open ? "1" : "0"); } catch (e) { /* ok */ } };
    if (G.kind === "chests") { opt.append(el("p", "gpnote", "Team names")); teamNames(opt); }
    const tb = el("div", "gpbtns");
    const add = btn("btn ghost", "Add a team", () => { if (G.teams.length < LIMITS.teams) { G.teams.push({ n: "Team " + (G.teams.length + 1), s: 0 }); changed(); } }); add.disabled = G.teams.length >= LIMITS.teams;
    const rem = btn("btn ghost", "Remove last team", () => { if (G.teams.length > 2) { const gone = G.teams.length - 1; G.teams.pop(); if (G.kind === "chests") { G.right = G.right.filter((x) => x !== gone); G.queue = G.queue.filter((x) => x !== gone); } else G.turn = Math.min(G.turn, G.teams.length - 1); if (G.hist) G.hist = []; if (G.snap) G.snap = []; changed(); } }); rem.disabled = G.teams.length <= 2;
    tb.append(add, rem);
    { const gs = A.S.tools.groups, n = gs && gs.order && gs.order.length ? Math.ceil(gs.order.length / gs.size) : 0;
        if (n >= 2 && n <= LIMITS.teams && (!gs.period || gs.period === A.S.period)) tb.append(btn("btn ghost", "Use the Group maker's " + n + " groups", () => { const old = G.teams; G.teams = Array.from({ length: n }, (_, i) => ({ n: "Group " + (i + 1), s: old[i] ? old[i].s : 0 })); if (G.kind !== "chests") G.turn = Math.min(G.turn, n - 1); if (G.hist) G.hist = []; if (G.snap) G.snap = []; changed(); })); }
    opt.append(tb);
    const chk = (label, on, fn) => { const l = el("label", "gpchk"), c = el("input"); c.type = "checkbox"; c.checked = on; c.onchange = () => fn(c.checked); l.append(c, document.createTextNode(" " + label)); return l; };
    if (G.kind !== "chests") {
        opt.append(chk("A wrong answer loses the points", G.opts.lose, (v) => { G.opts.lose = v; changed(); }));
        opt.append(chk("Hide one double-points tile", G.opts.dbl, (v) => { G.opts.dbl = v; pickDouble(); changed(); }));
    }
    const tl = el("label", "gpchk"), sel = el("select"); (G.kind === "chests" ? [15, 30, 45, 60, 90, 120] : [15, 30, 45, 60, 90]).forEach((n) => { const o = el("option", null, n + " seconds"); o.value = n; sel.append(o); }); sel.value = String(G.opts.secs); sel.onchange = () => { G.opts.secs = +sel.value; changed(); };
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
        p.append(btn("btn go", n ? (n === 1 ? "1 team opens a chest" : n + " teams open chests") : (G.qi >= G.qs.length - 1 ? "No one got it. Show the final scores" : "No one got it. Next question"), startPicking));
        const row = el("div", "gpbtns"); row.append(btn("btn ghost", "Skip this question", () => { save(); nextQuestion(); }), undoB()); p.append(row);
        p.append(optionsBox()); tickGames(); return;
    }
    const c = G.last >= 0 ? G.chests[G.last] : null, mine = c && c.t === G.picker, who = G.teams[G.picker];
    if (!mine) {
        p.append(h(who.n + " picks a chest"), el("p", "gpnote", "Tap the chest they call out, on the board picture or here."));
        const grid = el("div", "gpchests");
        G.chests.forEach((x, i) => { const b = btn("gpadj", String(i + 1), () => openChest(i)); b.disabled = !!x.o; b.setAttribute("aria-label", "Open chest " + (i + 1)); grid.append(b); });
        p.append(grid);
    } else if (needsTarget(c)) {
        p.append(h(who.n + ": " + prizeText(c)), el("p", "gpnote", c.k === "swap" ? "Which team do they swap scores with?" : "Which team do they steal from? (Up to " + c.n + " points.)"));
        const box = el("div", "gpright");
        G.teams.forEach((t, i) => { if (i === c.t) return; const b = btn("gpteam", null, () => chooseTarget(i)); b.append(el("span", null, t.n), el("b", null, pts(t.s))); box.append(b); });
        p.append(box);
    } else {
        p.append(h(who.n + ": " + prizeText(c)));
        const last = !G.queue.length, end = last && G.qi >= G.qs.length - 1;
        p.append(btn("btn go", !last ? G.teams[G.queue[0]].n + " picks next" : (end ? "Show the final scores" : "Next question"), nextPicker));
    }
    if (G.queue.length) p.append(el("p", "gpnote", "Still to pick: " + G.queue.map((i) => G.teams[i].n).join(", ")));
    teamRows(p, (r, t) => r.append(el("span", "gpname", t.n), el("b", "gpscore", pts(t.s))));
    p.append(undoB());
}
