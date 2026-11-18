/* ==========================================
   Anchor Board — student game on Chromebooks: Vault Raid.
   The "Student Game" screen. Students play on their own devices at /play with a
   game code and their name: no Google account, no password. The teacher runs it
   from the Remote, and the board shows the code, the scores and any student's work.

   Where things live (see firestore.rules):
     rooms/{code}               what students may read: status, the name list, the clock
     rooms/{code}/p/{student}   one student's own entry: name pick, vault code, answer, hack, work pad
     rooms/{code}/s/{student}   what the Remote sends back to that student only: question, score, results
     teacher/{uid}/games/room   the whole game (answers, every vault code). Private to the teacher.
   The Remote is the referee: it checks every answer and every hack, so answers and other
   students' codes never reach a student's device. Keep the Remote open while a game runs.
   Closing the room deletes rooms/{code} and everything under it.
   Each student's result is saved to Class Data only when the teacher turns that on.
========================================== */
import * as V from "./vaultCore.js?v=65";
import qrcode from "./vendor/qrcode.js?v=1";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };
const mathEl = (tag, cls, text) => { const e = el(tag, cls); e.append(V.mathText(text)); return e; };

// This Remote's mark as the referee. Kept for the tab's life, so a reload carries on running the game.
const PAGE = (() => { try { let id = sessionStorage.getItem("anchorboard-live-host"); if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("anchorboard-live-host", id); } return id; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
const LENGTHS = [[5, "5 minutes"], [8, "8 minutes"], [10, "10 minutes"], [15, "15 minutes"], [20, "20 minutes"], [0, "Until I end it"]];
const LEFT_OPEN = 24 * 3600 * 1000;   // a room untouched this long is closed the next time the Remote opens
const HOST_STALE = 20000;    // another Remote that has not checked in for this long can be taken over
const JOIN_PATH = "play";

let A = null;                // lent by the board app: { S, header, store, writer, now, redraw, mode, signedIn, rosters }
let H = null, loaded = false, rev = 0, hosting = false, unsubH = null, unsubP = null, watchingCode = "";
let PL = {};                 // the latest entry from each student (rooms/{code}/p), Remote only
let SETS = null, setsWatched = false, note = "", busy = "", tab = "players", dtab = "report", peek = "", endArm = 0;
let saveTimer = 0, lastSave = 0, panelSig = "", panelAt = 0, padWatch = null, padFor = "", PAD = null;
const choice = { set: "", mins: 10, names: "roster", board: true, save: false, live: false, work: true };

export function mountLive(api) { A = api; }
export const liveSig = () => rev + "#" + loaded + "#" + hosting + "#" + (PAD ? PAD.it : "");
const onLive = () => A && A.S.screen === "live";
const isRemote = () => A.mode() === "remote";
const running = () => H && (H.status === "lobby" || H.status === "play");
const joinUrl = () => location.host + "/" + JOIN_PATH;
/** A QR code that opens the student page with this game's code already typed in. */
function qrSvg(code) {
    const q = qrcode(0, "M"); q.addData(location.origin + "/play.html?code=" + code); q.make();
    const n = q.getModuleCount(), m = 2, NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + (n + 2 * m) + " " + (n + 2 * m)); svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "QR code to join game " + code);
    let d = ""; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    const bg = document.createElementNS(NS, "rect"); bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#fff");
    const path = document.createElementNS(NS, "path"); path.setAttribute("d", d); path.setAttribute("fill", "#081B45");
    svg.append(bg, path); return svg;
}
const clean = (o) => JSON.parse(JSON.stringify(o));

/* ---------- following the game ---------- */
export function syncLive() {
    if (!A || !A.signedIn() || A.mode() === "sub") return;
    if (!unsubH) {
        unsubH = A.store().watch("games/room", (snap) => {
            if (snap.pending) return;
            const d = snap.exists ? snap.data : null;
            if (hosting && H && d && d.host === PAGE) return;           // this Remote is the referee: its own copy is newest
            const was = hosting; H = d && d.v === 1 && d.status && d.status !== "none" ? d : null; loaded = true;
            // A game nobody has touched for a day was left open by mistake: close it, which deletes the students' names and answers.
            if (isRemote() && H && !hosting && Date.now() - Math.max(+H.hb || 0, +H.at || 0) > LEFT_OPEN) { autoClose(); rev++; A.redraw(); return; }
            if (isRemote() && H && running() && (!H.host || H.host === PAGE || Date.now() - (+H.hb || 0) > HOST_STALE)) takeHost();
            else if (was && H && H.host !== PAGE) { hosting = false; stopPlayers(); }
            if (!H) { hosting = false; stopPlayers(); }
            rev++; A.redraw();
        }, () => { loaded = true; rev++; A.redraw(); });
    }
    if (isRemote() && onLive() && !setsWatched) {
        setsWatched = true;
        A.store().watch("games/index", (snap) => { if (snap.pending) return; SETS = ((snap.exists && snap.data && snap.data.sets) || []).filter((s) => s && s.id).slice(0, 200); panelSig = ""; drawLivePanel(true); }, () => { SETS = []; panelSig = ""; drawLivePanel(true); });
    }
    watchPad();
}
function takeHost() {
    hosting = true; H.host = PAGE; H.hb = Date.now(); saveSoon(true);
    if (watchingCode !== H.code) {
        stopPlayers(); watchingCode = H.code; PL = {};
        ensureRoom(H.code);
        unsubP = A.store().rooms.watchAll("rooms/" + H.code + "/p", (docs, changed) => {
            if (!hosting || !H) return;
            docs.forEach((d) => { PL[d.id] = d.data; });
            Object.keys(PL).forEach((id) => { if (!docs.some((d) => d.id === id)) delete PL[id]; });
            const sends = new Set();
            changed.forEach((id) => { if (PL[id]) handle(id, PL[id], sends); });
            flush(sends);
        }, (e) => { note = "Can't hear the students' devices right now (" + ((e && e.code) || "connection") + "). Trying again…"; panelSig = ""; drawLivePanel(true); });
    }
}
/** The game's public room can be gone while this Remote still has the game open (closed from another
    screen, or deleted while the Remote was asleep). Students then get "No game has that code" and the
    Remote can't hear them (permission-denied, since the rules check the room's owner). Put it back. */
async function ensureRoom(code) {
    let there = true;
    try { there = !!(await A.store().rooms.get("rooms/" + code)); } catch (e) { there = true; }
    if (there || !hosting || !H || H.code !== code || !running()) return;
    if (H.status === "lobby") { H.players = {}; H.taken = []; }   // their entries went with the room: they join again
    try { await A.store().rooms.save("rooms/" + code, roomDoc()); note = ""; saveSoon(true); stopPlayers(); takeHost(); }   // listen again now the room is back
    catch (e) { note = "This game's room is gone (" + ((e && e.code) || "connection") + "). Close the room and open a new one."; }
    rev++; panelSig = ""; drawLivePanel(true); A.redraw();
}
function stopPlayers() { if (unsubP) { unsubP(); unsubP = null; } watchingCode = ""; PL = {}; }

/** Save the whole game to the teacher's private copy: right away, or bundled within about a second. */
function saveSoon(now) {
    if (!hosting || !H) return;
    clearTimeout(saveTimer);
    const go = () => { H.hb = Date.now(); lastSave = Date.now(); A.store().save("games/room", clean(H)).catch((e) => { note = "Could not save the game (" + ((e && e.code) || "connection") + ")."; panelSig = ""; }); };
    if (now) go(); else saveTimer = setTimeout(go, Math.max(0, 1200 - (Date.now() - lastSave)));
}
function changed(now) { rev++; saveSoon(now); A.redraw(); }

/* ---------- the referee ---------- */
const P = (id) => H.players[id];
const ranked = () => Object.keys(H.players).map((id) => Object.assign({ id }, H.players[id])).sort((a, b) => b.c - a.c || b.r - a.r || a.nm.localeCompare(b.nm));
const qOf = (p, n) => H.qs[p.ord[n % p.ord.length]];
const shielded = (p) => !p.code || (+p.sh || 0) > Date.now();
function shuffledOrder() { const o = H.qs.map((_, i) => i); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
function feed(txt, kind) { H.feed = (H.feed || []).concat([{ t: Date.now(), txt, k: kind || "" }]).slice(-12); }

function handle(id, d, sends) {
    let p = P(id);
    if (!p) {
        if (d.ni == null && !d.nm) return;
        let nm = "", ni = -1;
        if (H.mode === "roster") {
            ni = Math.floor(+d.ni); nm = H.names[ni] || "";
            const holder = Object.keys(H.players).find((k) => H.players[k].ni === ni);
            if (!nm || holder) { sendErr(id, nm ? "That name is taken. Pick yours, or ask your teacher to free it." : "Pick your name from the list."); return; }
        } else {
            nm = V.cleanTyped(d.nm); if (!nm) { sendErr(id, "Type your first name and last initial."); return; }
            const used = new Set(Object.values(H.players).map((x) => x.nm.toLowerCase())); let k = 2, base = nm;
            while (used.has(nm.toLowerCase())) nm = base + " " + k++;
        }
        p = H.players[id] = { nm, ni, c: 0, r: 0, n: 0, st: 0, best: 0, h: 0, code: "", qn: 0, ord: shuffledOrder(), g: {}, sh: 0, la: null, fb: null, hk: null, hit: null, cr: 0, sa: 0, sk: 0, sc: 0, sn: 0, at: Date.now(),
            av: Math.floor(Math.random() * V.AVATARS.length), pu: "", dbl: 0, blk: 0, ins: 0, box: 0 };
        if (ni >= 0) H.taken = (H.taken || []).concat([ni]);
        feed(nm + " joined", "join"); sends.add("room");
    }
    // Waiting room: a character any time, a starting power-up until the game starts.
    if (d.av != null && Number.isInteger(+d.av) && +d.av >= 0 && +d.av < V.AVATARS.length && +d.av !== p.av) { p.av = +d.av; sends.add("room"); }
    if (d.pu != null && H.status === "lobby" && (d.pu === "" || V.starter(d.pu))) p.pu = d.pu;
    // A new vault code.
    if ((+d.cn || 0) > p.sc) { p.sc = +d.cn; if (V.validCode(d.code)) { p.code = d.code; p.hit = null; } }
    // An answer to the question on their screen.
    const a = d.a;
    if (a && (+a.n || 0) > p.sa) {
        p.sa = +a.n;
        if (H.status === "play" && +a.q === p.qn && p.code && !(H.opts.work !== false && !d.img)) {   // work required: an answer with no pad picture is not taken
            const q = qOf(p, p.qn), typed = String(a.t || "").slice(0, 80), ok = V.sameAnswer(typed, q.a, q.al);
            p.n++;
            let plus = 0;
            let x2 = [], box = null;
            if (ok) {
                p.r++; p.st++; p.best = Math.max(p.best, p.st); plus = V.coinsFor(p.st); p.h = Math.min(V.MAX_HACKS, p.h + 1);
                if (p.dbl > 0) { plus *= 2; p.dbl--; x2.push("double"); }
                if (bonusOn()) { plus *= 2; x2.push("bonus"); }
                p.c += plus;
                if (p.r % V.BOX_EVERY === 0) { box = V.rollBox(); openBox(p, box); }
            }
            else p.st = 0;
            p.fb = { q: p.qn, ok, y: typed, a: ok ? "" : q.a, plus, x2, box };
            p.la = { qi: p.ord[p.qn % p.ord.length], q: p.qn, y: typed, ok };
            tally(p, p.la.qi, typed, ok);
            p.qn++;
        }
    }
    // A hack: one guess at a classmate's vault code.
    const k = d.k;
    if (k && (+k.n || 0) > p.sk) {
        p.sk = +k.n;
        const t = P(k.to), g = String(k.g || "");
        if (H.status !== "play" || !t || k.to === id || !V.validCode(g)) p.hk = { n: p.sk, to: k.to || "", g, m: "", why: "That vault can't be hacked." };
        else if (p.h < 1) p.hk = { n: p.sk, to: k.to, g, m: "", why: "No hacks left. Answer a question to earn one." };
        else if (shielded(t)) p.hk = { n: p.sk, to: k.to, g, m: "", why: t.nm + "'s vault has a firewall up. Try someone else." };
        else if (t.blk && V.codeMarks(t.code, g) === "2".repeat(V.CODE_LEN)) {
            p.h--; t.blk = 0; t.hit = { by: p.nm, lost: 0, at: Date.now(), blocked: 1 };
            p.hk = { n: p.sk, to: k.to, g, m: "", why: "You cracked it, but " + t.nm + "'s Shield blocked you! The Shield is gone now. Try again." };
            feed(t.nm + "'s Shield blocked a crack!", "block"); sends.add(k.to);
        }
        else {
            p.h--;
            const m = V.codeMarks(t.code, g);
            p.g[k.to] = (p.g[k.to] || []).concat([g + ":" + m]).slice(-8);   // "465:211" (Firestore keeps no lists inside lists)
            let steal = 0;
            if (m === "2".repeat(V.CODE_LEN)) {
                steal = V.stealFrom(t.c); if (t.ins) steal = Math.round(steal / 2); t.c -= steal; p.c += steal; p.cr++;
                t.code = ""; t.sh = Date.now() + V.SHIELD_MS; t.hit = { by: p.nm, lost: steal, at: Date.now() };
                Object.values(H.players).forEach((x) => { delete x.g[k.to]; });   // the old code is gone for everyone
                feed(p.nm + " cracked " + t.nm + "'s vault (+" + steal + ")", "crack"); sends.add(k.to);
            }
            p.hk = { n: p.sk, to: k.to, g, m, steal, tn: t.nm };
        }
    }
    sends.add(id);
}
/* ---------- power-ups ---------- */
const bonusOn = () => (+H.bonus || 0) > Date.now();
/** A mystery box takes effect as soon as it is earned; the student's screen only shows what was in it. */
function openBox(p, b) {
    if (b.k === "bag") p.c += b.v;
    else if (b.k === "hack") p.h = Math.min(V.MAX_HACKS + 1, p.h + 1);
    else if (b.k === "double") p.dbl = (p.dbl || 0) + b.v;
    else if (b.k === "firewall") p.sh = Math.max(+p.sh || 0, Date.now()) + b.v * 1000;
    feed(p.nm + " opened a mystery box", "box");
}
/** Starting power-ups take effect when the game starts. */
function applyStarters() {
    Object.values(H.players).forEach((p) => {
        if (p.pu === "shield") p.blk = 1;
        else if (p.pu === "head") p.c += 25;
        else if (p.pu === "double") p.dbl = 3;
        else if (p.pu === "keys") p.h = Math.max(p.h, 2);
        else if (p.pu === "insure") p.ins = 1;
    });
}
function startBonus() { if (!H || H.status !== "play" || bonusOn()) return; H.bonus = Date.now() + V.BONUS_MS; feed("Bonus round! Double coins for 60 seconds", "bonus"); flush(everyone()); saveSoon(true); }

/* ---------- the after-game report: kept in the teacher's private game doc only ---------- */
/** Count one answer: how many tried each question, how many got it, which wrong answers came up, and each student's own list. */
function tally(p, qi, typed, ok) {
    if (!Array.isArray(H.qst) || H.qst.length !== H.qs.length) H.qst = H.qs.map(() => ({ n: 0, ok: 0, w: [] }));
    const st = H.qst[qi]; if (!st) return;
    st.n++;
    if (ok) st.ok++;
    else {
        const y = String(typed || "").trim().slice(0, 40) || "(blank)", k = y.toLowerCase().replace(/\s+/g, "");
        const w = st.w.find((x) => x.y.toLowerCase().replace(/\s+/g, "") === k);
        if (w) w.n++; else if (st.w.length < 12) st.w.push({ y, n: 1 });
    }
    p.lg = (p.lg || []).concat([ok ? { i: qi, ok: 1 } : { i: qi, ok: 0, y: String(typed || "").trim().slice(0, 40) }]).slice(-80);
}
/** Undo the miss when the teacher counts a wrong answer as right. */
function untally(p, qi, typed) {
    const st = H.qst && H.qst[qi]; if (st) { st.ok++; const k = String(typed || "").trim().toLowerCase().replace(/\s+/g, ""); const w = st.w.find((x) => x.y.toLowerCase().replace(/\s+/g, "") === k); if (w) { w.n--; if (w.n <= 0) st.w = st.w.filter((x) => x !== w); } }
    const last = (p.lg || []).slice().reverse().find((x) => x.i === qi && !x.ok); if (last) last.ok = 1;
}
const pctOf = (ok, of) => (of ? Math.round(100 * ok / of) : 0);
/** The questions students missed, worst first: [{ qi, q, n, ok, w (wrong answers, most common first) }]. */
function missedList() {
    return (H.qst || []).map((st, qi) => ({ qi, q: H.qs[qi], n: st.n, ok: st.ok, w: st.w.slice().sort((a, b) => b.n - a.n) }))
        .filter((x) => x.q && x.n > x.ok).sort((a, b) => a.ok / a.n - b.ok / b.n || b.n - a.n);
}
/** Right answers by category for one student, or for the whole class when p is null. */
function byCategory(p) {
    const m = new Map();
    const add = (qi, ok) => { const q = H.qs[qi]; if (!q) return; const k = q.c || "Questions", x = m.get(k) || { c: k, ok: 0, of: 0 }; x.of++; if (ok) x.ok++; m.set(k, x); };
    if (p) (p.lg || []).forEach((x) => add(x.i, x.ok));
    else Object.values(H.players).forEach((x) => (x.lg || []).forEach((y) => add(y.i, y.ok)));
    return [...m.values()];
}
/** Put one question on the board to go over (null: back to the final scores). Saved straight away, even after the game. */
function review(qi, ans) {
    H.review = qi == null ? null : { qi, ans: !!ans }; rev++; panelSig = "";
    A.store().save("games/room", clean(H)).catch((e) => { note = "Could not update the board (" + ((e && e.code) || "connection") + ")."; });
    A.redraw(); drawLivePanel(true);
}

function sendErr(id, msg) { A.store().rooms.save("rooms/" + H.code + "/s/" + id, { n: Date.now(), err: msg, status: H.status }).catch(() => {}); }

/** What one student's device is allowed to see. */
function view(id, order) {
    const p = P(id), q = H.status === "play" && p.code ? qOf(p, p.qn) : null, rank = order.findIndex((x) => x.id === id) + 1;
    p.sn = (p.sn || 0) + 1;
    return { n: p.sn, status: H.status, title: H.title, nm: p.nm, c: p.c, h: p.h, st: p.st, r: p.r, of: p.n, rank, players: order.length, ends: H.ends || 0,
        av: p.av, pu: p.pu || "", dbl: p.dbl || 0, blk: p.blk || 0, ins: p.ins || 0, fw: (+p.sh || 0) > Date.now() && p.code ? +p.sh : 0, bonus: +H.bonus || 0,
        code: p.code, need: !p.code, q: q ? { n: p.qn, c: q.c, t: q.q, f: V.answerKind(q.a) } : null, best: p.best, cr: p.cr, fb: p.fb, hk: p.hk, hit: p.hit,
        targets: order.filter((x) => x.id !== id).map((x) => ({ id: x.id, nm: x.nm, av: x.av, c: x.c, sh: shielded(x) ? 1 : 0, g: p.g[x.id] || [] })),
        res: H.status === "done" ? results(p) : null };
}
/** A student's own results for their screen after the game: each question they answered, what they wrote when it was wrong, and the answer. */
function results(p) {
    return (p.lg || []).slice(-40).map((x) => { const q = H.qs[x.i]; return q ? (x.ok ? { t: String(q.q).slice(0, 200), ok: 1 } : { t: String(q.q).slice(0, 200), ok: 0, y: x.y || "", a: String(q.a).slice(0, 80) }) : null; }).filter(Boolean);
}
function flush(sends) {
    if (!sends.size) return;
    const order = ranked(), list = [];
    if (sends.has("room")) list.push({ path: "rooms/" + H.code, data: roomDoc(), merge: false });
    sends.forEach((id) => { if (id !== "room" && P(id)) list.push({ path: "rooms/" + H.code + "/s/" + id, data: view(id, order) }); });
    A.store().rooms.many(list).catch((e) => { note = "Could not reach the students' devices (" + ((e && e.code) || "connection") + ")."; panelSig = ""; });
    changed(false);
}
const everyone = () => { const s = new Set(Object.keys(H.players)); s.add("room"); return s; };
function roomDoc() {
    return { owner: A.store().rooms.uid(), status: H.status, title: H.title, mode: H.mode, names: H.mode === "roster" ? H.names : [], taken: H.taken || [],
        live: !!H.opts.live, work: H.opts.work !== false, ends: H.ends || 0, bonus: +H.bonus || 0, at: Date.now() };
}

/* ---------- teacher moves ---------- */
async function openRoom() {
    const meta = (SETS || []).find((s) => s.id === choice.set); if (!meta || busy) return;
    busy = "open"; note = ""; panelSig = ""; drawLivePanel(true);
    try {
        const set = await A.store().rooms.get("teacher/" + A.store().rooms.uid() + "/games/s_" + meta.id);
        const qs = []; ((set && set.cats) || []).forEach((c) => (c.clues || []).forEach((k) => { if (k && k.q && k.a) qs.push({ c: String(c.n || "").slice(0, 60), q: String(k.q).slice(0, 400), a: String(k.a).slice(0, 200), al: [] }); }));
        if (set && set.final && set.final.q) qs.push({ c: String(set.final.c || "Final").slice(0, 60), q: String(set.final.q).slice(0, 400), a: String(set.final.a).slice(0, 200), al: [] });
        if (qs.length < 3) throw new Error("That set needs at least 3 questions.");
        const roster = (A.rosters()[A.S.period] || []).filter(Boolean), names = choice.names === "roster" ? V.shortNames(roster) : [];
        if (choice.names === "roster" && !names.length) throw new Error("There is no class list for " + A.S.period + " period. Add one on the Rosters page, or let students type a name.");
        let code = "";
        for (let i = 0; i < 6 && !code; i++) { const c = V.newRoomCode(); try { if (!(await A.store().rooms.get("rooms/" + c))) code = c; } catch (e) { code = c; } }
        if (!code) throw new Error("Could not find a free game code. Try again.");
        H = { v: 1, code, status: "lobby", title: set.title || meta.title || "Review", setId: meta.id, per: A.S.period, qs, mode: choice.names, names, taken: [],
            opts: { mins: choice.mins, board: choice.board, save: choice.save, live: choice.live, work: choice.work }, players: {}, qst: qs.map(() => ({ n: 0, ok: 0, w: [] })), review: null, feed: [], show: null, ends: 0, t0: 0, rid: "", saved: false,
            host: PAGE, hb: Date.now(), at: Date.now() };
        await A.store().rooms.save("rooms/" + code, roomDoc());
        hosting = true; loaded = true; await A.store().save("games/room", clean(H)); takeHost(); tab = "players";
    } catch (e) { note = (e && e.message && !e.code ? e.message : "Could not open the room (" + ((e && e.code) || "connection") + ")."); H = null; hosting = false; }
    busy = ""; panelSig = ""; rev++; A.redraw();
}
function startGame() {
    if (!H || H.status !== "lobby") return;
    H.status = "play"; H.t0 = Date.now(); H.ends = H.opts.mins ? H.t0 + H.opts.mins * 60000 : 0; feed("Game on!", "start"); applyStarters();
    flush(everyone()); saveSoon(true);
}
function endGame() {
    if (!H || H.status !== "play") return;
    H.status = "done"; H.show = null; endArm = 0; feed("Game over", "end");
    flush(everyone()); saveSoon(true);
    if (H.opts.save) saveResults();
}
async function saveResults() {
    if (!H || H.saved) return;
    const order = ranked(); if (!order.length) return;
    if (!H.rid) H.rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const d = new Date(), day = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    const right = order.reduce((n, p) => n + p.r, 0), tried = order.reduce((n, p) => n + p.n, 0), best = order[0].c;
    const r = { id: H.rid, date: day, at: Date.now(), period: H.per, kind: "vault", game: "Vault Raid", title: H.title,
        teams: order.map((p) => ({ n: p.nm, s: p.c, m: [p.nm], ok: p.r, of: p.n })), win: order.map((p, i) => (p.c === best ? i : -1)).filter((i) => i >= 0),
        cats: tried ? (byCategory(null).length ? byCategory(null) : [{ c: "Vault Raid questions", ok: right, of: tried }]) : [], bonus: {},
        // the report: the questions missed most and the wrong answers seen
        miss: missedList().slice(0, 20).map((x) => ({ q: x.q.q.slice(0, 200), a: x.q.a.slice(0, 60), c: x.q.c || "", ok: x.ok, of: x.n, w: x.w.slice(0, 4) })) };
    r.teams.forEach((t, i) => { t.pct = pctOf(order[i].r, order[i].n); });
    // Each student's score, by category, as a Class Data set, so it shows beside their other scores.
    const roster = (A.rosters()[H.per] || []).filter(Boolean), cats = byCategory(null).map((c) => c.c);
    const imp = { id: "vr" + H.rid, title: "Vault Raid: " + H.title, std: "", skill: "", date: day, source: "Vault Raid", period: H.per,
        items: ["All questions"].concat(cats.length > 1 ? cats : []),
        rows: order.filter((p) => p.n).map((p) => {
            const mine = byCategory(p), v = [p.r / p.n].concat(cats.length > 1 ? cats.map((c) => { const x = mine.find((y) => y.c === c); return x && x.of ? x.ok / x.of : null; }) : []);
            return { s: p.ni >= 0 && roster[p.ni] ? roster[p.ni] : p.nm, v };
        }), at: Date.now() };
    busy = "save"; panelSig = "";
    try {
        const uidPath = "teacher/" + A.store().rooms.uid();
        const cur = await A.store().rooms.get(uidPath + "/games/results");
        const list = ((cur && cur.list) || []).filter((x) => x && x.id && x.id !== r.id).concat([r]).slice(-1500);
        await A.store().save("games/results", { list, at: Date.now() });
        if (imp.rows.length) {
            await A.store().save("data/i_" + imp.id, imp);
            const ix = await A.store().rooms.get(uidPath + "/data/index"), imports = ((ix && ix.imports) || []).filter((x) => x && x.id !== imp.id);
            imports.push({ id: imp.id, title: imp.title, std: "", skill: "", date: day, source: "Vault Raid", period: H.per, n: imp.rows.length, items: imp.items.length });
            await A.store().save("data/index", { imports, at: Date.now() });
        }
        H.saved = true; note = "";
    } catch (e) { note = "Could not save to Class Data (" + ((e && e.code) || "connection") + ")."; }
    busy = ""; changed(true); drawLivePanel(true);
}
async function closeRoom() {
    if (!H || busy) return; busy = "close"; panelSig = ""; drawLivePanel(true);
    const code = H.code;
    try {
        stopPlayers();
        // A room that is already gone can't be listed (the rules check its owner), so only clear one that is there.
        let there = true; try { there = !!(await A.store().rooms.get("rooms/" + code)); } catch (e) { there = true; }
        if (there) { await A.store().rooms.clear("rooms/" + code + "/s"); await A.store().rooms.clear("rooms/" + code + "/p"); await A.store().rooms.del("rooms/" + code); }
        await A.store().save("games/room", { v: 1, status: "none", at: Date.now() });
        H = null; hosting = false; note = ""; peek = ""; endArm = 0;
    } catch (e) { note = "Could not close the room (" + ((e && e.code) || "connection") + "). Try again."; if (H && running()) takeHost(); }
    busy = ""; panelSig = ""; rev++; A.redraw();
}
let autoClosing = false;
async function autoClose() {
    if (autoClosing || !H) return; autoClosing = true;
    const since = new Date(Math.max(+H.hb || 0, +H.at || 0) || Date.now()).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    await closeRoom(); autoClosing = false;
    if (!H) { note = "A student game left open since " + since + " was closed. Its names and answers are deleted."; panelSig = ""; rev++; A.redraw(); }
}
function removePlayer(id) {
    const p = P(id); if (!p) return;
    delete H.players[id]; if (p.ni >= 0) H.taken = (H.taken || []).filter((i) => i !== p.ni);
    Object.values(H.players).forEach((x) => { delete x.g[id]; });
    if (H.show && H.show.id === id) H.show = null; if (peek === id) peek = "";
    const room = "rooms/" + H.code;
    A.store().rooms.many([{ path: room + "/s/" + id, del: true }, { path: room + "/p/" + id, del: true }, { path: room, data: roomDoc() }]).catch(() => {});
    changed(true);
}
function acceptAnswer(id) {
    const p = P(id); if (!p || !p.la || p.la.ok) return;
    const q = H.qs[p.la.qi]; if (q && p.la.y && !q.al.includes(p.la.y)) q.al = q.al.concat([p.la.y]).slice(-6);
    untally(p, p.la.qi, p.la.y);
    p.la.ok = true; p.r++; p.st = 1; p.c += V.coinsFor(1); p.h = Math.min(V.MAX_HACKS, p.h + 1);
    if (p.fb && p.fb.q === p.la.q) p.fb = Object.assign({}, p.fb, { ok: true, a: "", plus: V.coinsFor(1), fixed: 1 });
    flush(new Set([id]));
}
function setLive(on) { H.opts.live = on; flush(new Set(["room"])); saveSoon(true); }
function showWork(id, withName) { H.show = id ? { id, nm: !!withName } : null; changed(true); }

/* ---------- each quarter second ---------- */
export function tickLive() {
    if (!A || !H) return;
    const c = document.getElementById("liveClock"), pc = document.getElementById("livePClock");
    const left = H.status === "play" && H.ends ? Math.max(0, H.ends - Date.now()) : -1;
    const txt = left < 0 ? (H.status === "play" ? "No time limit" : "") : Math.floor(left / 60000) + ":" + ("0" + Math.floor((left % 60000) / 1000)).slice(-2);
    if (c) { c.textContent = txt; c.classList.toggle("hot", left >= 0 && left < 30000); }
    if (pc) pc.textContent = txt;
    const bl = H.bonus ? Math.max(0, +H.bonus - Date.now()) : 0, bb = document.getElementById("liveBonusBtn"), bs = document.getElementById("liveBonus");
    if (bb) { bb.textContent = bl ? "Bonus round on · " + Math.ceil(bl / 1000) + " s" : "Start a bonus round (double coins, 60 s)"; bb.disabled = !!bl; bb.className = "btn " + (bl ? "ghost" : "go") + " vrbonusbtn"; }
    if (bs) { bs.hidden = !bl; const t = bs.querySelector("b"); if (t) t.textContent = Math.ceil(bl / 1000) + " s"; }
    const crk = document.getElementById("liveCrack"); if (crk && Date.now() > +crk.dataset.until) crk.remove();
    if (hosting && H.status === "play" && H.ends && Date.now() >= H.ends) endGame();
    if (hosting && running() && Date.now() - lastSave > 8000) saveSoon(true);   // check in, so another Remote knows this one is running the game
    if (endArm && Date.now() - endArm > 4000) { endArm = 0; panelSig = ""; }
    if (isRemote() && onLive() && Date.now() - panelAt > 1000) drawLivePanel(true);
}

/* ---------- going over missed questions on the whiteboard ----------
   After the game the board opens each missed question on the canvas-first whiteboard (js/boardApp.js),
   with the question on a card floating over the paper like the bellringer, so the teacher can work it out. */
/** The question being gone over, or null: { key (for the saved ink), qi, at, count, list (question numbers), title, ans }. */
export function liveReview() {
    if (!H || H.status !== "done" || !H.review || !H.qs || !H.qs[H.review.qi]) return null;
    const list = missedList(), at = list.findIndex((x) => x.qi === H.review.qi);
    return { key: "vr" + String(H.rid || H.code || "").replace(/\W/g, "") + "q" + H.review.qi, qi: H.review.qi, at, count: list.length, list: list.map((x) => x.qi), title: H.title || "Student Game", ans: !!H.review.ans };
}
/** Go to a missed question (null: back to the final scores), or show or hide its answer. Works from the board or the Remote. */
export function goReview(qi, ans) { review(qi, ans); }
/** The floating card's insides: the question, how the class did, the answers we saw, then the answer once shown. */
export function reviewBody(body) {
    const r = liveReview(); if (!r) return;
    const q = H.qs[r.qi], st = (H.qst || [])[r.qi] || { n: 0, ok: 0, w: [] };
    if (q.c) body.append(el("span", "gchip alt vrwbcat", q.c));
    body.append(mathEl("p", "wbq", q.q));
    const how = el("div", "vrwbhow"); how.append(el("b", null, pctOf(st.ok, st.n) + "% got it"), el("span", null, st.ok + " of " + st.n + " answers were right"));
    body.append(how);
    const ws = st.w.slice().sort((a, b) => b.n - a.n).slice(0, 4);
    if (ws.length) { const chips = el("div", "vrrevw vrwbw"); chips.append(el("small", null, "Answers we saw")); ws.forEach((w) => { const c = el("span", "vrwrong"); c.append(mathEl("span", null, w.y), el("small", null, "×" + w.n)); chips.append(c); }); body.append(chips); }
    if (r.ans) body.append(mathEl("p", "wbans", q.a));
    const row = el("div", "vrwbbtns");
    row.append(btn("btn ghost", r.ans ? "Hide answer" : "Show answer", () => review(r.qi, !r.ans)));
    if (r.at + 1 < r.count) row.append(btn("btn go", "Next question", () => review(r.list[r.at + 1])));
    else row.append(btn("btn go", "Done: final scores", () => review(null)));
    body.append(row);
}

/* ---------- the board ---------- */
function watchPad() {
    const want = H && H.show && H.status === "play" ? "rooms/" + H.code + "/p/" + H.show.id : "";
    if (want === padFor) return;
    if (padWatch) { padWatch(); padWatch = null; } padFor = want; PAD = null;
    if (want && isRemote() && hosting) return;   // the Remote already has every pad
    if (want) padWatch = A.store().rooms.watch(want, (snap) => { if (want !== padFor) return; PAD = snap.exists ? { img: snap.data.img || "", iq: +snap.data.iq || 0, it: +snap.data.it || 0 } : null; rev++; A.redraw(); }, () => {});
}
function padOf(id) { if (isRemote() && hosting) { const d = PL[id]; return d && d.img ? { img: d.img, iq: +d.iq || 0, it: +d.it || 0 } : null; } return id && H.show && H.show.id === id ? PAD : null; }
const nameOn = (p, i) => (H.opts.board ? p.nm : "Player " + (i + 1));

export function drawLiveStage(st) {
    const per = A.S.period + " period";
    if (!loaded) { st.append(A.header("Student Game", per), el("div", "gbody")); return; }
    if (!H) {
        st.append(A.header("Student Game", per));
        const e = el("div", "empty"); e.append(el("b", null, "No student game is open."), document.createTextNode(isRemote() ? "Pick a question set in the panel beside the board to open one. Students join on their Chromebooks with a code." : "Open one from the Remote."));
        st.append(e); return;
    }
    st.append(A.header("Vault Raid", H.title));
    const body = el("div", "gbody vr");
    if (H.status === "lobby") {
        const join = el("div", "vrjoin"), how = el("div", "vrhow");
        how.append(el("p", "vrlab", "Go to"), el("p", "vrurl", joinUrl()), el("p", "vrlab", "Game code"), el("p", "vrcode", H.code.slice(0, 3) + " " + H.code.slice(3)));
        const who = el("div", "vrwho"), names = Object.values(H.players);
        const qr = el("div", "vrqr"), head = el("div", "vrwhohead"); qr.append(qrSvg(H.code), el("p", null, "Scan to join"));
        head.append(qr, el("p", "vrcount", names.length + (names.length === 1 ? " player is in" : " players are in"))); who.append(head);
        if (H.opts.board) { const chips = el("div", "vrchips"); names.slice(-40).forEach((p) => chips.append(el("span", "vrchip", V.avatar(p.av)[0] + " " + p.nm))); who.append(chips); }
        who.append(el("p", "vrrule", "Pick your name, then set a secret vault code: 3 different digits, 1 to 9. Right answers earn coins and hacks. Use a hack to guess a classmate's code and take a share of their coins."));
        join.append(how, who); body.append(join);
    } else if (H.status === "play" && H.show && P(H.show.id)) {
        const p = P(H.show.id), pad = padOf(H.show.id), wrap = el("div", "vrpad");
        const q = pad ? qOf(p, pad.iq) : null;
        const top = el("div", "vrpadtop"); top.append(el("span", "gchip", H.show.nm ? p.nm + "'s work" : "Student work"));
        if (q) top.append(mathEl("p", "vrpadq", q.q));
        wrap.append(top);
        const img = el("div", "vrpadimg"); if (pad && pad.img) { const im = el("img"); im.src = pad.img; im.alt = "Student work"; img.append(im); } else img.append(el("p", "vrempty", "No work drawn yet."));
        wrap.append(img); body.append(wrap);
    } else if (H.status === "play") {
        const grid = el("div", "vrplay"), lead = el("div", "vrlead"), side = el("div", "vrside");
        const order = ranked();
        lead.append(el("p", "vrlab", "Richest vaults"));
        if (!order.length) lead.append(el("p", "vrempty", "Waiting for players."));
        order.slice(0, 8).forEach((p, i) => { const r = el("div", "vrrow" + (i === 0 ? " vrfirst" : "")); r.append(el("b", "vrrank", String(i + 1)), el("span", "vrname", (H.opts.board ? V.avatar(p.av)[0] + " " : "") + nameOn(p, i)), el("b", "vrcoins", p.c + " coins")); lead.append(r); });
        const clock = el("div", "vrclockbox"); const c = el("p", "vrclock"); c.id = "liveClock"; clock.append(el("p", "vrlab", "Time left"), c); side.append(clock);
        const fd = el("div", "vrfeed"); fd.append(el("p", "vrlab", "Latest"));
        (H.feed || []).filter((f) => f.k === "crack" || f.k === "start" || f.k === "bonus" || f.k === "block" || f.k === "box").slice(-5).reverse().forEach((f) => fd.append(el("p", "vrf " + f.k, H.opts.board ? f.txt : f.k === "crack" ? "A vault was cracked!" : f.k === "box" ? "Someone opened a mystery box" : f.k === "block" ? "A Shield blocked a crack!" : f.txt)));
        side.append(fd, el("p", "vrlate", "Joining late? " + joinUrl() + " · code " + H.code));
        grid.append(lead, side); body.append(grid);
        const bon = el("div", "vrbonus"); bon.id = "liveBonus"; bon.hidden = !bonusOn(); bon.append(el("span", null, "BONUS ROUND · double coins"), el("b", null, "")); body.append(bon);
        // A crack in the last few seconds gets the whole board for a moment.
        const last = (H.feed || []).filter((f) => f.k === "crack" || f.k === "block").slice(-1)[0];
        if (last && Date.now() - last.t < 4000) {
            const o = el("div", "vrcrack" + (last.k === "block" ? " block" : "")); o.id = "liveCrack"; o.dataset.until = String(last.t + 4000);
            o.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><g class="vcoins"><circle cx="48" cy="66" r="12" fill="#F2B33D"/><circle cx="66" cy="58" r="12" fill="#F6C866"/><circle cx="72" cy="74" r="12" fill="#F2B33D"/></g><g class="vdoor"><circle cx="60" cy="60" r="56" fill="#10358A" stroke="#7FAEDD" stroke-width="4"/><circle cx="60" cy="60" r="30" fill="#F4F7FB"/><path d="M60 60L60 24" stroke="#F2B33D" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="60" r="9" fill="#081B45"/></g></svg>';
            o.append(el("p", null, last.k === "block" ? (H.opts.board ? last.txt : "A Shield blocked a crack!") : H.opts.board ? last.txt.replace(/ \(\+(\d+)\)$/, "! +$1 coins") : "A vault was cracked!"));
            body.append(o);
        }
    } else if (H.review && H.qs[H.review.qi]) {
        const qi = H.review.qi, q = H.qs[qi], st = (H.qst || [])[qi] || { n: 0, ok: 0, w: [] }, list = missedList(), at = list.findIndex((x) => x.qi === qi);
        const card = el("div", "vrrev"), top = el("div", "vrrevtop");
        top.append(el("span", "gchip", "Let's go over it" + (at >= 0 ? " · " + (at + 1) + " of " + list.length : "")));
        if (q.c) top.append(el("span", "gchip alt", q.c));
        card.append(top, mathEl("p", "vrrevq", q.q));
        const stat = el("div", "vrrevstats"), pc = pctOf(st.ok, st.n);
        const ring = el("div", "vrrevpct"); ring.style.setProperty("--p", pc); ring.append(el("b", null, pc + "%"), el("small", null, "got it"));
        const right = el("div", "vrrevside"); right.append(el("p", "vrlab", st.ok + " of " + st.n + " answers were right"));
        const ws = st.w.slice().sort((a, b) => b.n - a.n).slice(0, 4);
        if (ws.length) { right.append(el("p", "vrlab", "Answers we saw")); const chips = el("div", "vrrevw"); ws.forEach((w) => { const c = el("span", "vrwrong"); c.append(mathEl("span", null, w.y), el("small", null, "×" + w.n)); chips.append(c); }); right.append(chips); }
        stat.append(ring, right); card.append(stat);
        if (H.review.ans) { const a = el("div", "vrrevans"); a.append(el("small", null, "Answer"), mathEl("b", null, q.a)); card.append(a); }
        body.append(card);
    } else {
        const order = ranked(), box = el("div", "gdone");
        box.append(el("p", "gwinlab", "Game over"));
        if (order.length) { const pod = el("div", "vrpod"); order.slice(0, 3).forEach((p, i) => { const s = el("div", "vrstep s" + (i + 1)); s.append(el("b", null, ["1st", "2nd", "3rd"][i]), el("i", "vravatar", V.avatar(p.av)[0]), el("span", null, nameOn(p, i)), el("small", null, p.c + " coins"), el("small", "vrsteppct", pctOf(p.r, p.n) + "% right")); pod.append(s); }); box.append(pod); }
        if (order.length) { const all = order.reduce((a, p) => [a[0] + p.r, a[1] + p.n], [0, 0]); box.append(el("p", "vrclass", "Class: " + pctOf(all[0], all[1]) + "% right on " + all[1] + " answers")); }
        else box.append(el("p", "gwin", "No players"));
        body.append(box);
    }
    st.append(body);
}

/* ---------- the Remote's private panel ---------- */
function panelEl() {
    let p = document.getElementById("livePanel");
    if (!p) { p = el("aside", "gpanel vrpanel"); p.id = "livePanel"; p.setAttribute("aria-label", "Student game controls, only on this Remote"); const body = document.querySelector(".cbody"); if (body) body.append(p); }
    return p;
}
const hd = (text) => el("p", "gph", text);
function check(label, on, fn, sub) { const l = el("label", "gpchk"), i = el("input"); i.type = "checkbox"; i.checked = on; i.onchange = () => fn(i.checked); l.append(i, document.createTextNode(label)); if (sub) l.append(el("small", "vrsub", sub)); return l; }

export function drawLivePanel(force) {
    if (!A) return;
    const show = isRemote() && onLive() && A.signedIn();
    if (show) document.body.classList.add("gaming");
    if (!show) { const old = document.getElementById("livePanel"); if (old) old.hidden = true; panelSig = ""; return; }
    const p = panelEl(); p.hidden = false;
    if (!force && Date.now() - panelAt < 700) return;   // many students answering at once: redraw about once a second (tickLive catches up)
    const sig = liveSig() + "|" + (SETS ? SETS.length : "x") + "|" + busy + "|" + note + "|" + tab + dtab + "|" + peek + "|" + endArm + "|" + JSON.stringify(choice) + "|" + Object.keys(PL).map((k) => k + (PL[k].it || 0)).join(",");
    const typing = document.activeElement && p.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName);
    if (sig === panelSig || typing) return; panelSig = sig; panelAt = Date.now();
    const keep = p.scrollTop; p.textContent = "";
    if (!loaded) { p.append(hd("Student game"), el("p", "gpnote", "Checking for a game…")); return; }
    if (note) p.append(el("p", "gpnote bad", note));
    if (!H) { setupPanel(p); return; }
    if (!hosting && running()) {
        p.append(hd("Vault Raid"), el("p", "gpnote", "This game is running from another Remote. Answers are checked there, so keep that one open."));
        p.append(btn("btn ghost", "Run it from this Remote instead", () => { if (H) takeHost(); panelSig = ""; rev++; A.redraw(); }));
        return;
    }
    const n = Object.keys(H.players).length;
    if (H.status === "lobby") {
        p.append(hd("Students, join now"));
        const code = el("div", "vrpcode"); code.append(el("small", null, "Go to " + joinUrl() + " and type"), el("b", null, H.code));
        const qr = el("div", "vrpqr"); qr.append(qrSvg(H.code), el("small", null, "Or scan this. The board shows it too.")); code.append(qr); p.append(code);
        p.append(el("p", "gpnote", n ? n + " joined. Start when everyone is in. Late students can still join." : "Waiting for the first student…"));
        const go = btn("btn go", "Start the game", startGame); go.disabled = !n; p.append(go);
        playerRows(p, false);
    } else if (H.status === "play") {
        const top = el("div", "gptimer"), c = el("b"); c.id = "livePClock"; top.append(c);
        top.append(btn("btn ghost gpend", endArm ? "Tap again to end" : "End the game", () => { if (endArm) endGame(); else { endArm = Date.now(); panelSig = ""; drawLivePanel(true); } }));
        p.append(top, el("p", "gpnote", "Code " + H.code + " · " + n + " playing"));
        const bon = btn("btn " + (bonusOn() ? "ghost" : "go") + " vrbonusbtn", bonusOn() ? "Bonus round on" : "Start a bonus round (double coins, 60 s)", startBonus); bon.id = "liveBonusBtn"; bon.disabled = bonusOn(); p.append(bon);
        const tabs = el("div", "vrtabs"); [["players", "Players"], ["work", "Work"]].forEach(([k, label]) => { const b = btn("btn " + (tab === k ? "go" : "ghost"), label, () => { tab = k; panelSig = ""; drawLivePanel(true); }); b.setAttribute("aria-pressed", String(tab === k)); tabs.append(b); });
        p.append(tabs);
        if (H.show) p.append(btn("btn go", "Back to the scores on the board", () => showWork("")));
        if (tab === "work") workGrid(p); else playerRows(p, true);
    } else {
        const tabs = el("div", "vrtabs"); [["report", "Report"], ["players", "Standings"]].forEach(([k, label]) => { const b = btn("btn " + (dtab === k ? "go" : "ghost"), label, () => { dtab = k; panelSig = ""; drawLivePanel(true); }); b.setAttribute("aria-pressed", String(dtab === k)); tabs.append(b); });
        p.append(tabs);
        if (dtab === "report") { reportPanel(p); saveRow(p); }
        else { p.append(hd("Final standings")); saveRow(p); playerRows(p, false, true); }
    }
    p.append(el("p", "gpnote", H.status === "done" ? "Closing the room deletes the names, answers and work from this game." : "Closing the room ends the game for everyone and deletes the names, answers and work."));
    const close = btn("btn ghost gpend", busy === "close" ? "Closing…" : "Close the room", closeRoom); close.disabled = !!busy; p.append(close);
    p.scrollTop = keep;
}
function saveRow(p) {
    const n = Object.keys(H.players).length;
    {
        if (H.saved) { const t = el("p", "gpnote"), a = el("a", null, "Class Data"); a.href = "data.html#games"; t.append(document.createTextNode("Saved to "), a, document.createTextNode(".")); p.append(t); }
        else if (n) p.append(el("p", "gpnote", "Not saved. This report stays only until you close the room."), btn("btn ghost", busy ? "Saving…" : "Save results to Class Data", saveResults));
    }
}
/** After the game: top 3, everyone's percent right, the most-missed questions with the wrong answers we saw, and buttons to go over them on the board. */
function reportPanel(p) {
    const order = ranked(), list = missedList();
    if (!order.length) { p.append(el("p", "gpnote", "No one played.")); return; }
    const all = order.reduce((a, x) => [a[0] + x.r, a[1] + x.n], [0, 0]);
    const tiles = el("div", "vrtiles"), tile = (v, l) => { const t = el("div", "vrtile"); t.append(el("b", null, v), el("small", null, l)); tiles.append(t); };
    tile(pctOf(all[0], all[1]) + "%", "class right"); tile(String(all[1]), "answers"); tile(String(order.length), "players"); p.append(tiles);

    if (H.review) {
        const box = el("div", "vrrevctl"), at = list.findIndex((x) => x.qi === H.review.qi);
        box.append(el("b", null, "On the board: question " + (at >= 0 ? at + 1 + " of " + list.length : "")));
        const row = el("div", "gpbtns");
        row.append(btn("btn ghost", "Back", () => review(list[Math.max(0, at - 1)].qi)), btn("btn go", H.review.ans ? "Hide answer" : "Show answer", () => review(H.review.qi, !H.review.ans)),
            btn("btn ghost", at + 1 < list.length ? "Next" : "Done", () => (at + 1 < list.length ? review(list[at + 1].qi) : review(null))));
        if (at <= 0) row.firstChild.disabled = true;
        box.append(row, btn("btn ghost", "Back to final scores", () => review(null))); p.append(box);
    } else if (list.length) p.append(btn("btn go", "Go over the missed questions on the board (" + list.length + ")", () => review(list[0].qi)));

    p.append(hd("Top 3"));
    const pod = el("div", "gprows");
    order.slice(0, 3).forEach((x, i) => { const r = el("div", "gprow vrtop3"), left = el("div", "vrpl"); left.append(el("span", "gpname", x.nm), el("small", "vrinfo", x.c + " coins · " + x.r + " of " + x.n + " right")); r.append(el("span", "vrmedal m" + (i + 1), String(i + 1)), left, el("b", "vrpct", pctOf(x.r, x.n) + "%")); pod.append(r); });
    p.append(pod);

    p.append(hd("Missed most"));
    if (!list.length) p.append(el("p", "gpnote", "Every question was answered right. Nice."));
    list.slice(0, 12).forEach((x) => {
        const r = el("div", "vrmiss" + (H.review && H.review.qi === x.qi ? " on" : ""));
        const head = el("div", "vrmisshead"); head.append(el("b", "vrmisspct", pctOf(x.ok, x.n) + "%"), el("small", null, x.ok + " of " + x.n + " right" + (x.q.c ? " · " + x.q.c : "")));
        r.append(head, mathEl("p", "vrmissq", x.q.q));
        const ans = el("p", "vrmissa"); ans.append(el("small", null, "Answer "), mathEl("b", null, x.q.a)); r.append(ans);
        if (x.w.length) { const w = el("div", "vrrevw"); x.w.slice(0, 4).forEach((y) => { const c = el("span", "vrwrong"); c.append(mathEl("span", null, y.y), el("small", null, "×" + y.n)); w.append(c); }); r.append(el("small", "vrsub", "Common wrong answers"), w); }
        r.append(btn("btn ghost", "Go over on the board", () => review(x.qi)));
        p.append(r);
    });

    p.append(hd("Every student"));
    const t = el("div", "gprows");
    order.forEach((x, i) => {
        const r = el("div", "gprow vrprow"), left = el("div", "vrpl");
        const miss = [...new Set((x.lg || []).filter((y) => !y.ok).map((y) => y.i))].length;
        left.append(el("span", "gpname", (i + 1) + ". " + x.nm), el("small", "vrinfo", pctOf(x.r, x.n) + "% right · " + x.r + " of " + x.n + (miss ? " · missed " + miss + (miss === 1 ? " question" : " questions") : "")));
        const cats = byCategory(x).filter((c) => c.of); if (cats.length > 1) left.append(el("small", "vrsub", cats.map((c) => c.c + " " + c.ok + "/" + c.of).join(" · ")));
        r.append(left, el("b", "vrpct " + (x.n ? (x.r / x.n >= 0.8 ? "hi" : x.r / x.n >= 0.6 ? "mid" : "lo") : ""), x.n ? pctOf(x.r, x.n) + "%" : "–")); t.append(r);
    });
    p.append(t);
}
function setupPanel(p) {
    p.append(hd("Student game: Vault Raid"), el("p", "gpnote", "Students play on their Chromebooks with a game code and their name. No sign-in. Right answers earn coins and hacks; a hack guesses a classmate's 3-digit vault code to take some of their coins. Each question has a pad to show their work, which you can see here and put on the board."));
    if (!SETS) { p.append(el("p", "gpnote", "Getting your question sets…")); return; }
    if (!SETS.length) { p.append(el("p", "gpnote", "No question sets are saved yet.")); const a = el("a", "btn go gplink", "Make a question set"); a.href = "games.html"; p.append(a); return; }
    const mine = SETS.filter((s) => !Array.isArray(s.per) || !s.per.length || s.per.includes(A.S.period)), list = mine.length ? mine : SETS;
    if (!list.some((s) => s.id === choice.set)) choice.set = list.slice().sort((a, b) => (b.at || 0) - (a.at || 0))[0].id;
    const row = (label, ctl) => { const l = el("label", "gpchk vrfield"); l.append(el("span", null, label), ctl); return l; };
    const sel = el("select"); list.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).forEach((s) => { const o = el("option", null, (s.title || "Review game") + " (" + (s.clues || 0) + ")"); o.value = s.id; sel.append(o); }); sel.value = choice.set; sel.onchange = () => { choice.set = sel.value; panelSig = ""; };
    const len = el("select"); LENGTHS.forEach(([m, t]) => { const o = el("option", null, t); o.value = String(m); len.append(o); }); len.value = String(choice.mins); len.onchange = () => { choice.mins = +len.value; panelSig = ""; };
    const nm = el("select"); [["roster", "Pick from my class list"], ["typed", "Type their name"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; nm.append(o); }); nm.value = choice.names; nm.onchange = () => { choice.names = nm.value; panelSig = ""; };
    p.append(row("Question set", sel), row("Length", len), row("Students", nm));
    if (choice.names === "roster") p.append(el("p", "gpnote", "Names show as first name and last initial (" + A.S.period + " period's list on the Rosters page)."));
    const more = el("details", "gpopts"); more.append(el("summary", null, "Options"));
    more.append(check("Show names on the board", choice.board, (v) => { choice.board = v; }),
        check("Students must show work before they can submit", choice.work, (v) => { choice.work = v; }, "On: the answer button waits until there is real work on their pad."),
        check("See their work live as they draw", choice.live, (v) => { choice.live = v; }, "Off: you see each student's work when they answer. On: it updates every few seconds, which uses more of the free daily allowance."),
        check("Save each student's result to Class Data", choice.save, (v) => { choice.save = v; }, "Off by default. Names, coins and right answers are kept in your private account. Leave off until the district says student data can be stored."));
    p.append(more);
    const go = btn("btn go", busy === "open" ? "Opening…" : "Open the room", openRoom); go.disabled = !!busy; p.append(go);
}
function playerRows(p, live, final) {
    const order = ranked(); if (!order.length) return;
    const box = el("div", "gprows");
    order.forEach((x, i) => {
        const r = el("div", "gprow vrprow");
        const name = el("span", "gpname", (final ? (i + 1) + ". " : "") + V.avatar(x.av)[0] + " " + x.nm + (H.status === "lobby" && x.pu && V.starter(x.pu) ? " · " + V.starter(x.pu)[1] : ""));
        const info = el("small", "vrinfo", final || live ? x.c + " coins · " + x.r + " of " + x.n + " right" + (x.cr ? " · cracked " + x.cr : "") : x.code ? "Vault set" : "Setting a vault code…");
        const left = el("div", "vrpl"); left.append(name, info);
        if (live && x.la) { const la = el("small", "vrla " + (x.la.ok ? "ok" : "no"), (x.la.ok ? "✓ " : "✗ ") + (x.la.y || "(blank)")); left.append(la); }
        r.append(left);
        if (live && x.la && !x.la.ok && x.la.y) r.append(btn("gpok", "Count it", () => acceptAnswer(x.id)));
        if (!final) { const rm = btn("gpno", "Remove", () => removePlayer(x.id)); rm.setAttribute("aria-label", "Remove " + x.nm + " and free the name"); r.append(rm); }
        box.append(r);
    });
    p.append(box);
    if (live) p.append(el("p", "gpnote", "Count it accepts that answer from now on and gives the coins. Remove frees the name so a student can pick it again on another device."));
}
function workGrid(p) {
    const order = ranked();
    if (!H.opts.live) p.append(el("p", "gpnote", "You see each student's work from their last answer."), btn("btn ghost", "See work live as they draw", () => setLive(true)));
    else p.append(el("p", "gpnote", "Work updates every few seconds while students draw."), btn("btn ghost", "Only update when they answer", () => setLive(false)));
    if (peek && P(peek)) {
        const x = P(peek), pad = padOf(peek), big = el("div", "vrpeek");
        big.append(el("b", null, x.nm));
        if (pad && pad.img) { const q = qOf(x, pad.iq); big.append(mathEl("p", "gpnote", q.q)); const im = el("img"); im.src = pad.img; im.alt = x.nm + "'s work"; big.append(im); } else big.append(el("p", "gpnote", "No work yet."));
        const row = el("div", "gpbtns"); row.append(btn("btn go", "Show on board", () => showWork(peek, false)), btn("btn ghost", "Show with name", () => showWork(peek, true)), btn("btn ghost", "Close", () => { peek = ""; panelSig = ""; drawLivePanel(true); }));
        big.append(row); p.append(big);
    }
    const grid = el("div", "vrgrid");
    order.forEach((x) => {
        const pad = padOf(x.id), b = btn("vrthumb" + (H.show && H.show.id === x.id ? " on" : ""), null, () => { peek = x.id; panelSig = ""; drawLivePanel(true); });
        if (pad && pad.img) { const im = el("img"); im.src = pad.img; im.alt = ""; b.append(im); } else b.append(el("span", "vrnone", "No work yet"));
        b.append(el("small", null, x.nm + (x.la ? (x.la.ok ? " ✓" : " ✗") : "")));
        grid.append(b);
    });
    p.append(grid);
}
