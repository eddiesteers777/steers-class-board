/* ==========================================
   Focal — Live notes: students follow the guided notes on their Chromebooks.
   The teacher teaches from paper guided notes as usual. Students keep a Chromebook open at
   /play (or the class link), tap their name, and see the same notes card as the board.
   At an anchor problem the teacher taps "Check in" on the Remote: every Chromebook switches
   to that problem with a work pad and an answer box. The Remote sees at once who has it,
   who doesn't, and who is stuck. The board only ever shows counts, never names.

   Where things live (same rooms as Vault Raid, see firestore.rules and js/liveRoom.js):
     rooms/{code}               kind "notes": status, the name list, the notes card on the board,
                                and the open check-in (question only, never the answer)
     rooms/{code}/p/{student}   one student's own entry: name pick, answer, work pad, "I'm stuck"
                                ("I'm stuck" rides in the k field: { n, to: "help", g: "1" or "0" })
     rooms/{code}/s/{student}   what the Remote sends that student only: their seat, "got it", their result
     teacher/{uid}/games/notes  the whole session (names, answers, results). Private to the teacher.
   Each period keeps the same room code from day to day, so a class link posted once keeps working.
   Closing live notes deletes the room and everything students sent. Nothing is saved to Class Data.
========================================== */
import * as V from "./vaultCore.js?v=70";
import qrcode from "./vendor/qrcode.js?v=1";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };
const mathEl = (tag, cls, text) => { const e = el(tag, cls); e.append(V.mathText(text)); return e; };
const clean = (o) => JSON.parse(JSON.stringify(o));

const PAGE = (() => { try { let id = sessionStorage.getItem("focal-notes-host"); if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("focal-notes-host", id); } return id; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
const LEFT_OPEN = 24 * 3600 * 1000;   // a room untouched this long is closed the next time the Remote opens
const HOST_STALE = 20000;
const SCREENS_ON = { notes: 1, bell: 1, blank: 1, fix: 1 };   // where the Live notes panel and the board's check-in ring appear

let A = null;      // lent by the board app: { S, store, rosters, redraw, mode, signedIn, frames, day }
let H = null, CODES = {}, loaded = false, rev = 0, hosting = false, unsubH = null, unsubP = null, watchingCode = "";
let PL = {};       // the latest entry from each student (rooms/{code}/p), Remote only
let note = "", busy = "", open = false, peek = "", panelSig = "", panelAt = 0, saveTimer = 0, lastSave = 0, nowSig = "", nowTimer = 0;
let padWatch = null, padFor = "", PAD = null, endArm = 0;
const draft = { q: "", a: "", own: false, src: "" };   // the check-in about to be sent (Remote only)
const choice = { names: "roster", tell: "close", work: true };

export function mountNotes(api) { A = api; }
/** Redraw the Remote panel and the board's check-in layer in place (the whiteboard itself is not rebuilt, so ink is never interrupted). */
function redraw() { fillLayer(); A.redraw(); }
export const notesSig = () => rev + "#" + loaded + "#" + hosting + "#" + (PAD ? PAD.it : "");
const isRemote = () => A.mode() === "remote";
const running = () => !!(H && H.status === "open");
const joinUrl = () => location.host + "/play";
const classLink = (code) => location.origin + "/follow.html?code=" + code;

/* ---------- following the session ---------- */
export function syncNotes() {
    if (!A || !A.signedIn() || A.mode() === "sub") return;
    if (!unsubH) {
        unsubH = A.store().watch("games/notes", (snap) => {
            if (snap.pending) return;
            const d = snap.exists ? snap.data : null;
            CODES = (d && d.codes) || CODES;
            if (hosting && H && d && d.host === PAGE) return;   // this Remote runs it: its own copy is newest
            const was = hosting; H = d && d.v === 1 && d.status === "open" ? d : null; loaded = true;
            // A game nobody has touched for a day was left open by mistake: close it, which deletes the students' names and answers.
            if (isRemote() && H && !hosting && Date.now() - Math.max(+H.hb || 0, +H.at || 0) > LEFT_OPEN) { autoClose(); rev++; redraw(); return; }
            if (isRemote() && H && (!H.host || H.host === PAGE || Date.now() - (+H.hb || 0) > HOST_STALE)) takeHost();
            else if (was && H && H.host !== PAGE) { hosting = false; stopPlayers(); }
            if (!H) { hosting = false; stopPlayers(); }
            rev++; redraw();
        }, () => { loaded = true; rev++; redraw(); });
    }
    watchPad();
    if (hosting) followBoard();
}
function takeHost() {
    hosting = true; H.host = PAGE; H.hb = Date.now(); saveSoon(true);
    if (watchingCode !== H.code) {
        stopPlayers(); watchingCode = H.code; PL = {};
        unsubP = A.store().rooms.watchAll("rooms/" + H.code + "/p", (docs, changed) => {
            if (!hosting || !H) return;
            docs.forEach((d) => { PL[d.id] = d.data; });
            Object.keys(PL).forEach((id) => { if (!docs.some((d) => d.id === id)) delete PL[id]; });
            const sends = new Set();
            changed.forEach((id) => { if (PL[id]) handle(id, PL[id], sends); });
            flush(sends);
        }, (e) => { note = "Can't hear the students' devices right now (" + ((e && e.code) || "connection") + "). Trying again…"; panelSig = ""; drawNotesPanel(true); });
    }
}
function stopPlayers() { if (unsubP) { unsubP(); unsubP = null; } watchingCode = ""; PL = {}; }
function saveSoon(now) {
    if (!hosting || !H) return;
    clearTimeout(saveTimer);
    const go = () => { H.hb = Date.now(); lastSave = Date.now(); A.store().save("games/notes", clean(Object.assign({}, H, { codes: CODES }))).catch((e) => { note = "Could not save live notes (" + ((e && e.code) || "connection") + ")."; panelSig = ""; }); };
    if (now) go(); else saveTimer = setTimeout(go, Math.max(0, 1000 - (Date.now() - lastSave)));
}
function changed(now) { rev++; saveSoon(now); redraw(); }

/* ---------- what the board is showing, for the students' screens ---------- */
/** The notes card (or bellringer problem) on the board right now, as plain text. */
function boardCard() {
    const S = A.S;
    if (S.period !== H.per) return null;
    if (S.screen === "notes") {
        const fr = A.frames(); if (!fr.length) return null;
        const i = Math.min(S.note, fr.length - 1), f = fr[i], shown = f.open ? f.lines.length : Math.min(S.step, f.lines.length);
        const q = f.blanks ? (S.show ? String(f.q).replace(/\[([^\]]+)\]/g, "$1") : String(f.q).replace(/\[([^\]]+)\]/g, "_____")) : f.q;
        return { src: "n" + i, k: f.kind, q: String(q || "").slice(0, 400), l: f.lines.slice(0, shown).map((x) => String(x.m || "").slice(0, 200)), a: S.show && f.ans && !f.blanks ? String(f.ans).slice(0, 200) : "", ans: keyOf(f) };
    }
    if (S.screen === "bell") {
        const d = A.day(), ps = (d && d.problems) || [], p = ps[Math.min(S.prob, ps.length - 1)]; if (!p) return null;
        return { src: "b" + S.prob, k: "Bellringer · Problem " + (Math.min(S.prob, ps.length - 1) + 1), q: String(p.q || "").slice(0, 400), l: [], a: S.show ? String(p.a || "").slice(0, 200) : "", ans: String(p.a || "") };
    }
    return null;
}
/** The answer key for a notes frame: its answer, or the last line of a worked example when that line is short. */
function keyOf(f) {
    if (f.blanks || f.open) return "";
    if (f.ans && f.ans !== "fill") return String(f.ans);
    const last = f.lines.length ? String(f.lines[f.lines.length - 1].m || "") : "";
    return last && last.length <= 30 && /\d/.test(last) ? last : "";
}
/** Copy the board's card to the room, so students can follow along. Only when it changes. */
function followBoard() {
    if (!hosting || !running()) return;
    const c = boardCard(), sig = JSON.stringify(c ? [c.k, c.q, c.l, c.a] : null);
    if (sig === nowSig) return;
    nowSig = sig; clearTimeout(nowTimer);
    nowTimer = setTimeout(() => { if (!running()) return; H.now = c ? { k: c.k, q: c.q, l: c.l, a: c.a } : null; A.store().rooms.save("rooms/" + H.code, roomDoc()).catch(() => {}); }, 350);
}

/* ---------- the referee ---------- */
const P = (id) => H.players[id];
const roster = () => Object.keys(H.players).map((id) => Object.assign({ id }, H.players[id])).sort((a, b) => a.nm.localeCompare(b.nm));
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
            const used = new Set(Object.values(H.players).map((x) => x.nm.toLowerCase())); let k = 2; const base = nm;
            while (used.has(nm.toLowerCase())) nm = base + " " + k++;
        }
        p = H.players[id] = { nm, ni, sa: 0, sk: 0, sn: 0, at: Date.now() };
        if (ni >= 0) H.taken = (H.taken || []).concat([ni]);
        sends.add("room");
    }
    const ci = H.ci;
    // An answer to the open check-in. A newer answer replaces an older one while it is open.
    const a = d.a;
    if (a && (+a.n || 0) > p.sa) {
        p.sa = +a.n;
        if (ci && ci.open && +a.q === ci.n && !(ci.work && !d.img)) {
            const y = String(a.t || "").slice(0, 80);
            const prev = ci.res[id] || {};
            ci.res[id] = { y, ok: prev.set ? prev.ok : (ci.a ? V.sameAnswer(y, ci.a, ci.al) : null), set: prev.set || 0, at: Date.now(), help: prev.help || 0 };
            if (ci.res[id].ok && ci.res[id].help) ci.res[id].help = 0;
        }
    }
    // "I'm stuck" on or off.
    const k = d.k;
    if (k && k.to === "help" && (+k.n || 0) > p.sk) {
        p.sk = +k.n;
        if (ci && ci.open) { const r = ci.res[id] || (ci.res[id] = { y: "", ok: null, set: 0, at: 0, help: 0, none: 1 }); r.help = k.g === "1" ? Date.now() : 0; }
    }
    sends.add(id);
}
function sendErr(id, msg) { A.store().rooms.save("rooms/" + H.code + "/s/" + id, { n: Date.now(), err: msg }).catch(() => {}); }
/** What one student's device is allowed to see: their seat, whether the teacher has their answer, and their result once shown. */
function view(id) {
    const p = P(id), ci = H.ci, r = ci && ci.res[id];
    p.sn = (p.sn || 0) + 1;
    const out = { n: p.sn, nm: p.nm, got: ci && r && !r.none ? { q: ci.n, y: r.y } : null, help: !!(ci && ci.open && r && r.help), fb: null };
    if (ci && r && !r.none && (ci.tell === "now" || !ci.open)) out.fb = { q: ci.n, ok: r.ok, y: r.y, a: r.ok === false ? ci.a : "" };
    return out;
}
function flush(sends) {
    if (!sends.size) return;
    const list = [];
    if (sends.has("room")) list.push({ path: "rooms/" + H.code, data: roomDoc() });
    sends.forEach((id) => { if (id !== "room" && P(id)) list.push({ path: "rooms/" + H.code + "/s/" + id, data: view(id) }); });
    A.store().rooms.many(list).catch((e) => { note = "Could not reach the students' devices (" + ((e && e.code) || "connection") + ")."; panelSig = ""; });
    changed(false);
}
const everyone = () => { const s = new Set(Object.keys(H.players)); s.add("room"); return s; };
function roomDoc() {
    const ci = H.ci && H.ci.open ? { n: H.ci.n, q: H.ci.q, work: !!H.ci.work } : null;
    // status "play" is what the room rules let students write to, as in Vault Raid.
    return { owner: A.store().rooms.uid(), kind: "notes", status: "play", title: H.title, per: H.per, mode: H.mode, names: H.mode === "roster" ? H.names : [], taken: H.taken || [],
        now: H.now || null, ci, at: Date.now() };
}

/* ---------- teacher moves ---------- */
async function openRoom() {
    if (busy) return;
    busy = "open"; note = ""; panelSig = ""; drawNotesPanel(true);
    const per = A.S.period;
    try {
        const list = (A.rosters()[per] || []).filter(Boolean), names = choice.names === "roster" ? V.shortNames(list) : [];
        if (choice.names === "roster" && !names.length) throw new Error("There is no class list for " + per + " period. Add one on the Rosters page, or let students type a name.");
        // Each period keeps its code, so the class link works every day. A code someone else holds gets replaced.
        let code = "";
        const keep = CODES[per];
        if (V.validRoomCode(keep)) {
            try {
                const cur = await A.store().rooms.get("rooms/" + keep);
                if (!cur) code = keep;
                else if (cur.owner === A.store().rooms.uid() && cur.kind === "notes") { await A.store().rooms.clear("rooms/" + keep + "/s"); await A.store().rooms.clear("rooms/" + keep + "/p"); code = keep; }
            } catch (e) { /* someone else's room: pick a new code */ }
        }
        for (let i = 0; i < 6 && !code; i++) { const c = V.newRoomCode(); try { if (!(await A.store().rooms.get("rooms/" + c))) code = c; } catch (e) { /* taken */ } }
        if (!code) throw new Error("Could not find a free code. Try again.");
        CODES = Object.assign({}, CODES, { [per]: code });
        const d = A.day(), l = A.lesson();
        H = { v: 1, code, status: "open", per, title: (d && d.notes && d.notes.title) || (d && d.title) || (l && l.cls) || "Today's notes", mode: choice.names, names, taken: [],
            tell: choice.tell, work: choice.work, players: {}, ci: null, past: [], now: null, show: null, board: "", host: PAGE, hb: Date.now(), at: Date.now() };
        nowSig = ""; const c = boardCard(); H.now = c ? { k: c.k, q: c.q, l: c.l, a: c.a } : null; nowSig = JSON.stringify(c ? [c.k, c.q, c.l, c.a] : null);
        await A.store().rooms.save("rooms/" + code, roomDoc());
        hosting = true; loaded = true; await A.store().save("games/notes", clean(Object.assign({}, H, { codes: CODES }))); takeHost();
    } catch (e) { note = (e && e.message && !e.code ? e.message : "Could not start live notes (" + ((e && e.code) || "connection") + ")."); H = null; hosting = false; }
    busy = ""; panelSig = ""; rev++; redraw();
}
async function closeRoom() {
    if (!H || busy) return; busy = "close"; panelSig = ""; drawNotesPanel(true);
    const code = H.code;
    try {
        stopPlayers();
        await A.store().rooms.clear("rooms/" + code + "/s"); await A.store().rooms.clear("rooms/" + code + "/p"); await A.store().rooms.del("rooms/" + code);
        await A.store().save("games/notes", { v: 1, status: "none", codes: CODES, at: Date.now() });
        H = null; hosting = false; note = ""; peek = ""; endArm = 0;
    } catch (e) { note = "Could not close live notes (" + ((e && e.code) || "connection") + "). Try again."; if (H) takeHost(); }
    busy = ""; panelSig = ""; rev++; redraw();
}
let autoClosing = false;
async function autoClose() {
    if (autoClosing || !H) return; autoClosing = true;
    const since = new Date(Math.max(+H.hb || 0, +H.at || 0) || Date.now()).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    await closeRoom(); autoClosing = false;
    if (!H) { note = "A student game left open since " + since + " was closed. Its names and answers are deleted."; panelSig = ""; rev++; redraw(); }
}
function startCheck() {
    if (!H || !running()) return;
    const q = String(draft.q || "").trim(); if (!q) { note = "Type the problem first."; panelSig = ""; drawNotesPanel(true); return; }
    if (H.ci && H.ci.open) closeCheck(true);
    const n = (H.past.length ? H.past[H.past.length - 1].n : 0) + 1;
    H.ci = { n, q: q.slice(0, 400), a: String(draft.a || "").trim().slice(0, 200), al: [], src: draft.src, open: true, work: H.work, tell: H.tell, t0: Date.now(), t1: 0, res: {} };
    H.board = "ring"; H.show = null; peek = ""; note = "";
    // Checking in on the board's own problem: hide its answer and worked steps until the check-in is done.
    const card = boardCard();
    if (!draft.own && card && card.src === draft.src && A.push && (A.S.show || (A.S.screen === "notes" && A.S.step > 0))) { A.S.show = false; if (A.S.screen === "notes") A.S.step = 0; A.push(); }
    draft.own = false;
    flush(everyone()); saveSoon(true);
}
function closeCheck(quiet) {
    const ci = H && H.ci; if (!ci || !ci.open) return;
    ci.open = false; ci.t1 = Date.now(); endArm = 0;
    H.past = H.past.filter((x) => x.n !== ci.n).concat([ci]).slice(-30);
    if (!quiet) flush(everyone()); saveSoon(true);
}
function mark(id, ok) {
    const ci = H.ci; if (!ci) return;
    const r = ci.res[id]; if (!r || r.none) return;
    r.ok = ok; r.set = 1; if (ok) r.help = 0;
    if (ok && r.y && ci.a && !ci.al.includes(r.y)) {   // "Count it" also counts the same answer from everyone else
        ci.al = ci.al.concat([r.y]).slice(-8);
        Object.keys(ci.res).forEach((k) => { const x = ci.res[k]; if (!x.set && !x.none && x.y && V.sameAnswer(x.y, r.y)) x.ok = true; });
    }
    if (!ci.open) H.past = H.past.map((x) => (x.n === ci.n ? ci : x));
    flush(new Set(Object.keys(ci.res)));
}
function removePlayer(id) {
    const p = P(id); if (!p) return;
    delete H.players[id]; if (p.ni >= 0) H.taken = (H.taken || []).filter((i) => i !== p.ni);
    if (H.ci) delete H.ci.res[id]; if (H.show && H.show.id === id) H.show = null; if (peek === id) peek = "";
    const room = "rooms/" + H.code;
    A.store().rooms.many([{ path: room + "/s/" + id, del: true }, { path: room + "/p/" + id, del: true }, { path: room, data: roomDoc() }]).catch(() => {});
    changed(true);
}
function setBoard(what, id, withName) { H.board = what; H.show = what === "work" ? { id, nm: !!withName } : null; changed(true); }
function counts(ci) {
    const ids = Object.keys(H.players), c = { of: ids.length, in: 0, ok: 0, no: 0, open: 0, help: 0, wait: 0 };
    ids.forEach((id) => {
        const r = ci && ci.res[id];
        if (r && r.help && ci.open) c.help++;
        if (!r || r.none) { c.wait++; return; }
        c.in++; if (r.ok === true) c.ok++; else if (r.ok === false) c.no++; else c.open++;
    });
    return c;
}

/* ---------- each quarter second ---------- */
export function tickNotes() {
    if (!A) return;
    if (isRemote() && open && Date.now() - panelAt > 1000) drawNotesPanel(true);
    if (!H) return;
    if (hosting && running()) { followBoard(); if (Date.now() - lastSave > 8000) saveSoon(true); }
    const c = document.getElementById("lnClock");
    if (c && H.ci && H.ci.open) { const s = Math.floor((Date.now() - H.ci.t0) / 1000); c.textContent = Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    if (endArm && Date.now() - endArm > 4000) { endArm = 0; panelSig = ""; }
}

/* ---------- the board: a check-in ring and the join chip, on the whiteboard screens ---------- */
function watchPad() {
    const want = H && H.board === "work" && H.show ? "rooms/" + H.code + "/p/" + H.show.id : "";
    if (want === padFor) return;
    if (padWatch) { padWatch(); padWatch = null; } padFor = want; PAD = null;
    if (want && isRemote() && hosting) return;   // the Remote already has every pad
    if (want) padWatch = A.store().rooms.watch(want, (snap) => { if (want !== padFor) return; PAD = snap.exists ? { img: snap.data.img || "", iq: +snap.data.iq || 0, it: +snap.data.it || 0 } : null; rev++; redraw(); }, () => {});
}
function padOf(id) { if (isRemote() && hosting) { const d = PL[id]; return d && d.img ? { img: d.img, iq: +d.iq || 0, it: +d.it || 0 } : null; } return id && H.show && H.show.id === id ? PAD : null; }
function qrSvg(code, label) {
    const q = qrcode(0, "M"); q.addData(classLink(code)); q.make();
    const n = q.getModuleCount(), m = 2, NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + (n + 2 * m) + " " + (n + 2 * m)); svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label || "QR code to join live notes");
    let d = ""; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    const bg = document.createElementNS(NS, "rect"); bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#fff");
    const path = document.createElementNS(NS, "path"); path.setAttribute("d", d); path.setAttribute("fill", "#081B45");
    svg.append(bg, path); return svg;
}
function ring(frac, big, small) {
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 120 120"); svg.setAttribute("class", "lnring"); svg.setAttribute("aria-hidden", "true");
    const c = (cls, dash) => { const x = document.createElementNS(NS, "circle"); x.setAttribute("cx", "60"); x.setAttribute("cy", "60"); x.setAttribute("r", "50"); x.setAttribute("class", cls); if (dash != null) { x.setAttribute("stroke-dasharray", dash + " 400"); x.setAttribute("transform", "rotate(-90 60 60)"); } return x; };
    svg.append(c("bg"), c("fg", Math.max(0, Math.min(1, frac)) * 314.16));
    const w = el("div", "lnringwrap"); w.append(svg); const t = el("div", "lnringtxt"); t.append(el("b", null, big)); if (small) t.append(el("small", null, small)); w.append(t); return w;
}
/** Called by the board app at the end of every whiteboard screen: a layer this module fills and refreshes itself. */
export function drawNotesOverlay(paper, kind) {
    const layer = el("div", "lnlayer"); layer.id = "lnlayer"; layer.dataset.kind = kind; paper.append(layer); fillLayer();
}
let layerSig = "";
function fillLayer() {
    const layer = document.getElementById("lnlayer"); if (!layer || !A) return;
    const kind = layer.dataset.kind, on = H && running() && SCREENS_ON[kind] && A.S.period === H.per;
    const ci = on ? H.ci : null, c = ci ? counts(ci) : null, pad = on && H.show ? padOf(H.show.id) : null;
    const sig = JSON.stringify(on ? [H.code, H.board, H.show, ci && [ci.n, ci.open, ci.a], c, Object.keys(H.players).length, pad && pad.it] : 0);
    if (sig === layerSig && layer.childNodes.length) return;
    layerSig = sig; layer.textContent = "";
    if (!on) return;
    if (H.board === "work" && H.show && P(H.show.id)) {
        const p = P(H.show.id), box = el("section", "lnwork");
        box.setAttribute("aria-label", "Student work");
        box.append(el("p", "lnlab", H.show.nm ? p.nm + "'s work" : "Student work"));
        if (pad && pad.img) { const im = el("img"); im.src = pad.img; im.alt = "Student work"; box.append(im); } else box.append(el("p", "lnempty", "No work yet."));
        layer.append(box);
    } else if (ci && H.board === "ring") {
        const box = el("section", "lnci" + (ci.open ? "" : " done"));
        box.setAttribute("aria-label", "Check-in");
        box.append(el("p", "lnlab", "Check-in " + ci.n));
        if (ci.open) {
            box.append(ring(c.of ? c.in / c.of : 0, c.in + "/" + c.of, "in"));
            box.append(el("p", "lnbig", c.in === c.of && c.of ? "Everyone is in!" : "Solve it on your Chromebook"), el("p", "lnsub", "Show your work, then submit."));
        } else if (ci.a || c.ok || c.no) {
            box.append(ring(c.in ? c.ok / c.in : 0, c.in ? Math.round(c.ok / c.in * 100) + "%" : "–", "got it"));
            box.append(el("p", "lnbig", c.ok + " of " + c.in + " got it"));
            if (ci.a) box.append(mathEl("p", "lnsub", "Answer: " + ci.a));
        } else {
            box.append(ring(c.of ? c.in / c.of : 0, c.in + "/" + c.of, "in"), el("p", "lnbig", "Thanks for sending your work"));
        }
        layer.append(box);
    }
    if (!ci || !ci.open || H.board !== "ring") {
        const chip = el("div", "lnjoin");
        const qr = el("div", "lnqr"); qr.append(qrSvg(H.code, "QR code to join live notes, code " + H.code)); chip.append(qr);
        const t = el("div"); t.append(el("small", null, "Follow along · " + joinUrl()), el("b", null, H.code.slice(0, 3) + " " + H.code.slice(3)), el("small", null, Object.keys(H.players).length + " joined")); chip.append(t);
        layer.append(chip);
    }
}

/* ---------- the Remote's private panel ---------- */
function panelEl() {
    let p = document.getElementById("notesPanel");
    if (!p) { p = el("aside", "gpanel lnpanel"); p.id = "notesPanel"; p.setAttribute("aria-label", "Live notes, only on this Remote"); const body = document.querySelector(".cbody"); if (body) body.append(p); }
    return p;
}
function railButton() {
    if (document.getElementById("notesOpen")) return;
    const rail = document.querySelector(".rail"); if (!rail) return;
    const b = btn("btn tallyopen lnopen", "Live notes (Chromebooks)", () => { open = !open; b.setAttribute("aria-expanded", String(open)); panelSig = ""; drawNotesPanel(true); });
    b.id = "notesOpen"; b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", "notesPanel");
    const tally = document.getElementById("tallyOpen"); if (tally) tally.before(b); else rail.append(b);
}
const hd = (text) => el("p", "gph", text);
function check(label, on, fn, sub) { const l = el("label", "gpchk"), i = el("input"); i.type = "checkbox"; i.checked = on; i.onchange = () => fn(i.checked); l.append(i, document.createTextNode(label)); if (sub) l.append(el("small", "vrsub", sub)); return l; }

export function drawNotesPanel(force) {
    if (!A || !isRemote() || !A.signedIn()) return;
    railButton();
    if (running() && hosting && SCREENS_ON[A.S.screen] && A.S.period === H.per && !open && !document.getElementById("notesPanel")) open = true;   // a session that is running opens its panel
    const ob = document.getElementById("notesOpen"); if (ob) { ob.classList.toggle("on", running()); ob.textContent = running() ? "Live notes · " + Object.keys(H.players).length + " in" : "Live notes (Chromebooks)"; }
    const show = open && A.S.screen !== "live" && A.S.screen !== "game";
    if (!show) { const old = document.getElementById("notesPanel"); if (old) old.hidden = true; panelSig = ""; return; }
    const p = panelEl(); p.hidden = false;
    if (!force && Date.now() - panelAt < 700) return;
    const card = running() && !draft.own ? boardCard() : null;
    if (card && (!draft.src || draft.src !== card.src)) { draft.src = card.src; draft.q = card.q; draft.a = card.ans; }
    const sig = notesSig() + "|" + busy + "|" + note + "|" + peek + "|" + endArm + "|" + JSON.stringify(choice) + "|" + JSON.stringify(draft) + "|" + A.S.screen + A.S.period + "|" + Object.keys(PL).map((k) => k + (PL[k].it || 0)).join(",");
    const typing = document.activeElement && p.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (sig === panelSig || typing) return; panelSig = sig; panelAt = Date.now();
    const keep = p.scrollTop; p.textContent = "";
    const top = el("div", "lnptop"); top.append(hd("Live notes")); top.append(btn("btn ghost lnx", "Hide", () => { open = false; const o = document.getElementById("notesOpen"); if (o) o.setAttribute("aria-expanded", "false"); panelSig = ""; drawNotesPanel(true); })); p.append(top);
    if (!loaded) { p.append(el("p", "gpnote", "Checking…")); return; }
    if (note) p.append(el("p", "gpnote bad", note));
    if (!H) { setupPanel(p); p.scrollTop = keep; return; }
    if (!hosting) {
        p.append(el("p", "gpnote", "Live notes are running from another Remote. Answers come in there."));
        p.append(btn("btn ghost", "Run it from this Remote instead", () => { if (H) takeHost(); panelSig = ""; rev++; redraw(); }));
        return;
    }
    if (A.S.period !== H.per) {
        p.append(el("p", "gpnote", "Live notes are open for " + H.per + " period. The board's card only goes to students while the Remote is on " + H.per + " period."));
        p.append(btn("btn go", busy ? "Switching…" : "Close " + H.per + " and start " + A.S.period, async () => { await closeRoom(); if (!H) openRoom(); }));
    }
    const n = Object.keys(H.players).length, ci = H.ci;
    const join = el("details", "lnjoinbox"); join.open = !n;
    const sm = el("summary"); sm.append(el("b", null, "Code " + H.code), el("span", null, " · " + n + " joined")); join.append(sm);
    const qr = el("div", "vrpqr"); qr.append(qrSvg(H.code)); join.append(qr);
    join.append(el("p", "gpnote", "Students go to " + joinUrl() + " and type the code, scan the QR on the board, or open the class link. The class link for " + H.per + " period stays the same every day, so you can post it once in Schoology:"));
    const link = el("input", "lnlink"); link.readOnly = true; link.value = classLink(H.code); link.onclick = () => link.select(); join.append(link);
    join.append(btn("btn ghost", "Copy class link", () => { try { navigator.clipboard.writeText(classLink(H.code)); note = ""; } catch (e) { /* select and copy by hand */ } link.select(); }));
    p.append(join);

    if (ci && ci.open) checkPanel(p, ci);
    else {
        if (ci) results(p, ci, false);
        p.append(el("p", "gph sm", ci ? "Next check-in" : "Check in on a problem"));
        const src = boardCard();
        if (!draft.own && !src) p.append(el("p", "gpnote", "Go to a Guided Notes or Bellringer problem, or type your own."));
        const qa = el("textarea", "lnq"); qa.rows = 3; qa.placeholder = "The problem students will solve"; qa.value = draft.q; qa.setAttribute("aria-label", "Check-in problem");
        qa.oninput = () => { draft.q = qa.value; draft.own = true; };
        const ka = el("input", "lnkey"); ka.placeholder = "Answer key (optional)"; ka.value = draft.a; ka.setAttribute("aria-label", "Answer key");
        ka.oninput = () => { draft.a = ka.value; draft.own = true; };
        p.append(qa);
        const kl = el("label", "gpchk vrfield"); kl.append(el("span", null, "Answer key"), ka); p.append(kl);
        p.append(el("p", "gpnote", draft.a ? "Answers are checked against this. You can still mark any answer right." : "No key: you mark each answer right or not from its work."));
        const row = el("div", "gpbtns");
        const go = btn("btn go", "Check in on this problem", startCheck); go.disabled = !String(draft.q).trim() || !n; row.append(go);
        if (draft.own) row.append(btn("btn ghost", "Use the board's problem", () => { draft.own = false; draft.src = ""; panelSig = ""; drawNotesPanel(true); }));
        p.append(row);
        if (!n) p.append(el("p", "gpnote", "Waiting for students to join."));
        const opts = el("details", "gpopts"); opts.append(el("summary", null, "Check-in options"));
        opts.append(check("Students must show work before they can submit", H.work, (v) => { H.work = v; changed(true); }),
            check("Show students right or wrong as soon as they submit", H.tell === "now", (v) => { H.tell = v ? "now" : "close"; changed(true); }, "Off: each student sees their result when you close the check-in."));
        p.append(opts);
        if (!ci) rosterRows(p);
    }
    if (H.past.length > 1 || (H.past.length && !(ci && !ci.open))) pastList(p);
    p.append(el("p", "gpnote", "Ending live notes deletes the names, answers and work from today. Nothing is saved."));
    const end = btn("btn ghost gpend", busy === "close" ? "Ending…" : endArm ? "Tap again to end" : "End live notes", () => { if (endArm) closeRoom(); else { endArm = Date.now(); panelSig = ""; drawNotesPanel(true); } }); end.disabled = !!busy; p.append(end);
    p.scrollTop = keep;
}
function setupPanel(p) {
    p.append(el("p", "gpnote", "Students follow the guided notes on their Chromebooks: they tap their name, see the notes card from the board, and at a check-in solve the problem on a work pad and submit. You see right away who has it and who doesn't. Names show only here, never on the board."));
    const row = (label, ctl) => { const l = el("label", "gpchk vrfield"); l.append(el("span", null, label), ctl); return l; };
    const nm = el("select"); [["roster", "Tap their name from my class list"], ["typed", "Type their name"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; nm.append(o); }); nm.value = choice.names; nm.onchange = () => { choice.names = nm.value; panelSig = ""; };
    p.append(row("Students", nm));
    if (choice.names === "roster") p.append(el("p", "gpnote", "Names show as first name and last initial (" + A.S.period + " period's list on the Rosters page)."));
    const go = btn("btn go", busy === "open" ? "Starting…" : "Start live notes for " + A.S.period + " period", openRoom); go.disabled = !!busy; p.append(go);
    if (CODES[A.S.period]) p.append(el("p", "gpnote", A.S.period + " period's class link: " + classLink(CODES[A.S.period])));
}
function sortIds(ci) {
    const rank = (id) => { const r = ci.res[id]; if (r && r.help && ci.open) return 0; if (!r || r.none) return ci.open ? 3 : 1; return r.ok === false ? 1 : r.ok == null ? 2 : 4; };
    return roster().map((x) => x.id).sort((a, b) => rank(a) - rank(b) || P(a).nm.localeCompare(P(b).nm));
}
function checkPanel(p, ci) {
    const top = el("div", "gptimer"), t = el("b", null, "Check-in " + ci.n + " · "), c = el("span"); c.id = "lnClock"; t.append(c); top.append(t);
    top.append(btn("btn go", "Close check-in", () => closeCheck(false)));
    p.append(top, mathEl("p", "gpq", ci.q));
    if (ci.a) p.append(mathEl("p", "gpnote", "Key: " + ci.a));
    results(p, ci, true);
}
function results(p, ci, live) {
    const c = counts(ci);
    const box = el("div", "lncounts");
    const k = (n, label, cls) => { const s = el("span", cls); s.append(el("b", null, String(n)), el("small", null, label)); box.append(s); };
    if (ci.a || c.ok || c.no) { k(c.ok, "Got it", "ok"); k(c.no, "Not yet", "no"); }
    else k(c.in, "Sent", "ok");
    if (c.open && (ci.a || c.ok || c.no)) k(c.open, "To check", "mid");
    k(c.wait, live ? "Working" : "Didn't send", "mid");
    p.append(box);
    if (!live) p.append(el("p", "gpnote", "Check-in " + ci.n + " is closed. " + (ci.tell === "now" ? "" : "Students now see their result.")));
    if (c.help) p.append(el("p", "gpnote bad", c.help + (c.help === 1 ? " student is" : " students are") + " stuck."));
    const brow = el("div", "gpbtns");
    if (H.board === "ring") brow.append(btn("btn ghost", "Hide the results from the board", () => setBoard("", null)));
    else brow.append(btn("btn ghost", "Show the " + (ci.open ? "count" : "results") + " on the board", () => setBoard("ring", null)));
    if (!ci.open) brow.append(btn("btn ghost", "Copy results", () => copyResults(ci)));
    p.append(brow);
    if (peek && P(peek)) peekBox(p, ci, peek);
    const grid = el("div", "lngrid");
    sortIds(ci).forEach((id) => {
        const x = P(id), r = ci.res[id], pad = padOf(id), has = r && !r.none;
        const st = !has ? (r && r.help && ci.open ? "help" : "wait") : r.help && ci.open ? "help" : r.ok === true ? "ok" : r.ok === false ? "no" : "mid";
        const b = btn("lntile " + st + (H.show && H.show.id === id ? " on" : ""), null, () => { peek = peek === id ? "" : id; panelSig = ""; drawNotesPanel(true); });
        if (pad && pad.img && +pad.iq === ci.n) { const im = el("img"); im.src = pad.img; im.alt = ""; b.append(im); } else b.append(el("span", "lnnone", has ? "No work" : ci.open ? "Working…" : "Didn't send"));
        const mk = st === "ok" ? "✓ " : st === "no" ? "✗ " : st === "help" ? "✋ " : st === "mid" ? "? " : "";
        b.append(el("small", null, mk + x.nm + (has && r.y ? " · " + r.y : "")));
        b.setAttribute("aria-label", x.nm + ": " + ({ ok: "got it", no: "not yet", help: "stuck", mid: "sent, to check", wait: ci.open ? "working" : "didn't send" })[st] + (has && r.y ? ", answered " + r.y : ""));
        grid.append(b);
    });
    p.append(grid);
    if (!Object.keys(H.players).length) p.append(el("p", "gpnote", "No students have joined."));
}
function peekBox(p, ci, id) {
    const x = P(id), r = ci.res[id], pad = padOf(id), big = el("div", "vrpeek");
    big.append(el("b", null, x.nm + (r && r.y ? " answered " + r.y : "")));
    if (pad && pad.img && +pad.iq === ci.n) { const im = el("img"); im.src = pad.img; im.alt = x.nm + "'s work"; big.append(im); } else big.append(el("p", "gpnote", "No work for this check-in."));
    const row = el("div", "gpbtns");
    if (r && !r.none) { row.append(btn("gpok", "Mark right", () => mark(id, true)), btn("gpno", "Mark not yet", () => mark(id, false))); }
    if (pad && pad.img) row.append(btn("btn go", "Show on board", () => setBoard("work", id, false)), btn("btn ghost", "Show with name", () => setBoard("work", id, true)));
    if (H.board === "work" && H.show && H.show.id === id) row.append(btn("btn ghost", "Take it off the board", () => setBoard("ring", null)));
    row.append(btn("btn ghost", "Close", () => { peek = ""; panelSig = ""; drawNotesPanel(true); }));
    const rm = btn("gpno", "Free this name", () => removePlayer(id)); rm.title = "Removes " + x.nm + " so they can pick their name again on another device"; row.append(rm);
    big.append(row); p.append(big);
}
function rosterRows(p) {
    const list = roster(); if (!list.length) return;
    const box = el("div", "lnnames"); list.forEach((x) => { const s = btn("lnname", x.nm, () => { if (confirmFree === x.id) { confirmFree = ""; removePlayer(x.id); } else { confirmFree = x.id; panelSig = ""; drawNotesPanel(true); } }); if (confirmFree === x.id) { s.textContent = "Tap to free " + x.nm; s.classList.add("arm"); } box.append(s); });
    p.append(el("p", "gpnote", "Joined (tap a name twice to free it for another device):"), box);
    if (H.mode === "roster") { const missing = H.names.filter((nm, i) => !(H.taken || []).includes(i)); if (missing.length) p.append(el("p", "gpnote", "Not in yet: " + missing.join(", "))); }
}
let confirmFree = "";
function pastList(p) {
    const box = el("details", "gpopts lnpast"); box.append(el("summary", null, "Today's check-ins (" + H.past.length + ")"));
    H.past.slice().reverse().forEach((ci) => {
        const c = counts(ci), row = el("div", "lnpastrow");
        const b = btn("lnpastq", null, () => { H.ci = ci; H.board = H.board === "work" ? "" : H.board; peek = ""; changed(true); });
        b.append(el("b", null, "#" + ci.n + " "), V.mathText(ci.q.length > 60 ? ci.q.slice(0, 60) + "…" : ci.q));
        row.append(b, el("small", null, (ci.a || c.ok || c.no ? c.ok + " of " + c.in + " got it" : c.in + " sent") + (c.no ? " · not yet: " + Object.keys(ci.res).filter((id) => ci.res[id].ok === false && P(id)).map((id) => P(id).nm).join(", ") : "")));
        box.append(row);
    });
    box.append(btn("btn ghost", "Copy all of today's results", () => copyResults(null)));
    p.append(box);
}
/** Results as plain text (tab separated, pastes into a spreadsheet). Kept on this device only. */
function copyResults(only) {
    const list = only ? [only] : H.past, ids = roster();
    const head = ["Student"].concat(list.map((ci) => "Check-in " + ci.n)).join("\t");
    const rows = ids.map((x) => [x.nm].concat(list.map((ci) => { const r = ci.res[x.id]; return !r || r.none ? "" : (r.ok === true ? "right" : r.ok === false ? "not yet" : "sent") + (r.y ? " (" + r.y + ")" : ""); })).join("\t"));
    const txt = [head].concat(rows).join("\n");
    try { navigator.clipboard.writeText(txt); note = "Copied. Paste it into a spreadsheet."; } catch (e) { note = "Could not copy on this device."; }
    panelSig = ""; drawNotesPanel(true);
}
