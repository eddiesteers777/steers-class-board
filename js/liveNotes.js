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

   Send to students (Eddie, 2026-11-24; the shared logic is js/pushCore.js). A check-in can carry a tool: any of the ten
   math tools opens on every Chromebook beside the problem, or on its own to explore (ci.ex, nothing to submit).
   Every sendable board panel has a Send button in its title bar (js/boardApp.js panelHead → sendPanel): a Find panel
   sends its problem with its key, a tool panel sends the tool. On the board, which can't referee, Send leaves a request
   in the shared board state (tools.lns) that the Remote running live notes picks up. The Remote groups the answers
   ("12 said 7, 5 said −7"), can put them on the board with no names, or two students' work side by side (no names),
   and after a check-in sends a fresh try, or Show Steps, to only the students who didn't get it
   (ci.to and stp.to: who it is for; each student's s doc says whether they are in it).
========================================== */
import * as V from "./vaultCore.js?v=75";
import * as PC from "./pushCore.js?v=5";
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
let padWatch = null, padFor = "", PAD = null, PADS = {}, endArm = 0;   // padWatch: the board's listeners on the pads it shows (PADS, by student)
const draft = { q: "", a: "", own: false, src: "", tool: "", al: [], id: "" };   // the check-in about to be sent (Remote only)
let gOpen = null, cmp = [], stpCache = {}, lnsDone = (() => { try { return +sessionStorage.getItem("focal-notes-lns") || 0; } catch (e) { return 0; } })();
const choice = { names: "roster", tell: "close", work: true };

export function mountNotes(api) { A = api; }
/** Redraw the Remote panel and the board's check-in layer in place (the whiteboard itself is not rebuilt, so ink is never interrupted). */
function redraw() { fillLayer(); A.redraw(); }
export const notesSig = () => rev + "#" + loaded + "#" + hosting + "#" + Object.keys(PADS).map((k) => (PADS[k] ? PADS[k].it : 0)).join(",");
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
    fillLayer();   // the screen may have changed: the layer over other screens shows or hides
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
        if (ci && ci.open && !ci.ex && +a.q === ci.n && inCi(ci, id) && !(ci.work && !d.img)) {
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
        if (ci && ci.open && !ci.ex && inCi(ci, id)) { const r = ci.res[id] || (ci.res[id] = { y: "", ok: null, set: 0, at: 0, help: 0, none: 1 }); r.help = k.g === "1" ? Date.now() : 0; }
    }
    sends.add(id);
}
const inCi = (ci, id) => !ci || !Array.isArray(ci.to) || ci.to.includes(id);
function sendErr(id, msg) { A.store().rooms.save("rooms/" + H.code + "/s/" + id, { n: Date.now(), err: msg }).catch(() => {}); }
/** What one student's device is allowed to see: their seat, whether the teacher has their answer, and their result once shown. */
function view(id) {
    const p = P(id), ci = H.ci, r = ci && ci.res[id];
    p.sn = (p.sn || 0) + 1;
    const out = { n: p.sn, nm: p.nm, got: ci && r && !r.none ? { q: ci.n, y: r.y } : null, help: !!(ci && ci.open && r && r.help), fb: null,
        cin: ci && ci.open && inCi(ci, id) ? ci.n : 0, st: H.stp && (!Array.isArray(H.stp.to) || H.stp.to.includes(id)) ? H.stp.n : 0 };
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
    const c0 = H.ci && H.ci.open ? H.ci : null;
    const ci = c0 ? { n: c0.n, q: c0.q, work: !!c0.work, tool: c0.tool || "", ts: c0.ts || "", ex: c0.ex ? 1 : 0, tg: Array.isArray(c0.to) ? 1 : 0 } : null;
    const stp = H.stp ? { n: H.stp.n, q: H.stp.q, w: H.stp.w || null, h: H.stp.h || [] } : null;
    // status "play" is what the room rules let students write to, as in Vault Raid.
    return { owner: A.store().rooms.uid(), kind: "notes", status: "play", title: H.title, per: H.per, mode: H.mode, names: H.mode === "roster" ? H.names : [], taken: H.taken || [],
        now: H.now || null, ci, stp, at: Date.now() };
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
/** Start a check-in. o (optional) overrides the draft: { q, a, al, id, tool, ts, to, again }.
    A problem makes an ordinary check-in; a tool with no problem opens that tool on every Chromebook to explore.
    A problem sent while students have a tool open keeps the tool beside it. */
function startCheck(o) {
    o = o && typeof o === "object" && !o.type ? o : {};   // (a click event is not options)
    if (!H || !running()) return false;
    const q = String(o.q != null ? o.q : draft.q || "").trim();
    let tool = PC.isTool(o.tool) ? o.tool : PC.isTool(draft.tool) ? draft.tool : "", ts = o.ts != null ? o.ts : tool && A.S.tools ? PC.toolStart(tool, A.S.tools) : "";
    if (!tool && q && H.ci && H.ci.open && H.ci.ex && H.ci.tool) { tool = H.ci.tool; ts = H.ci.ts || ""; }   // students keep the tool they have open
    if (!q && !tool) { note = "Type the problem first."; panelSig = ""; drawNotesPanel(true); return false; }
    if (H.ci && H.ci.open) closeCheck(true);
    const n = Math.max(H.past.length ? H.past[H.past.length - 1].n : 0, H.ci ? H.ci.n : 0, +H.cn || 0) + 1; H.cn = n;
    const fromDraft = o.q == null;
    const a = String(o.a != null ? o.a : fromDraft ? draft.a || "" : "").trim().slice(0, 200);
    const al = (Array.isArray(o.al) ? o.al : fromDraft ? draft.al || [] : []).slice(0, 8);
    H.ci = { n, q: q.slice(0, 400), a, al, id: String(o.id != null ? o.id : fromDraft ? draft.id || "" : "").slice(0, 40), src: fromDraft ? draft.src : "", open: true, work: q ? H.work : false, tell: H.tell,
        t0: Date.now(), t1: 0, res: {}, tool, ts: ts || "", ex: q ? 0 : 1, to: Array.isArray(o.to) ? o.to.slice(0, 60) : null, again: +o.again || 0, snt: o.snt ? 1 : 0 };
    H.stp = null; H.board = "ring"; H.show = null; H.cmp = null; peek = ""; note = ""; gOpen = null; cmp = [];
    // Checking in on the board's own problem: hide its answer and worked steps until the check-in is done.
    const card = boardCard();
    if (q && fromDraft && !draft.own && card && card.src === draft.src && A.push && (A.S.show || (A.S.screen === "notes" && A.S.step > 0))) { A.S.show = false; if (A.S.screen === "notes") A.S.step = 0; A.push(); }
    if (fromDraft) { draft.own = false; draft.tool = ""; draft.al = []; draft.id = ""; }
    open = true; flush(everyone()); saveSoon(true);
    return true;
}
/** Add a tool to the check-in that is open (a calculator for the problem students are on), or take it away (""). */
function setTool(k) {
    const ci = H && H.ci; if (!ci || !ci.open) return;
    if (!k && ci.ex) { closeCheck(false); return; }
    ci.tool = PC.isTool(k) ? k : ""; ci.ts = ci.tool ? PC.toolStart(ci.tool, A.S.tools) : "";
    flush(new Set(["room"])); saveSoon(true);
}
function closeCheck(quiet) {
    const ci = H && H.ci; if (!ci || !ci.open) return;
    ci.open = false; ci.t1 = Date.now(); endArm = 0;
    if (!ci.ex) H.past = H.past.filter((x) => x.n !== ci.n).concat([ci]).slice(-30);
    if (!ci.ex && !stpCache[ci.n]) stepsFor(ci);   // get Show Steps ready for the follow-up
    if (ci.ex) { H.ci = H.past.length ? H.past[H.past.length - 1] : null; if (H.board === "ring" && !H.ci) H.board = ""; }
    if (!quiet) flush(everyone()); saveSoon(true);
}
/** Try again: the same problem, sent only to the students who didn't get it. */
function tryAgain(ci) {
    const ids = PC.notYet(ci, Object.keys(H.players)); if (!ids.length) return;
    startCheck({ q: ci.q, a: ci.a, al: ci.al, id: ci.id, tool: ci.tool, ts: ci.ts, to: ids, again: ci.n, snt: ci.snt });
}
/* ---------- Show Steps for the students who didn't get it ---------- */
/** The worked example for a check-in (js/walk.js, as the board's Show Steps builds it), or the bank's hint lines. Cached by check-in. */
function stepsFor(ci) {
    if (stpCache[ci.n]) return stpCache[ci.n];
    const n = ci.n;
    stpCache[n] = (async () => {
        let item = null, w = null;
        try {
            const wb = await import("./walkBank.js?v=15");
            if (ci.id) { const items = await wb.loadWalkItems(); item = items.find((x) => x.id === ci.id) || null; }
            if (item) { w = wb.walkOf(item); if (w && w.ok && A.walkEdits) w = wb.withEdits(w, A.walkEdits(item.id)); }
            if (!(w && w.ok) && ci.a) { const wk = await import("./walk.js?v=14"); w = wk.walkFor({ id: "ln" + n, q: ci.q, a: ci.a, std: item ? item.std : "" }); }
        } catch (e) { w = null; }
        const out = { w: PC.slimWalk(w), h: PC.hintLines(item), done: true };
        stpCache[n] = out; panelSig = ""; if (open) drawNotesPanel(true);
        return out;
    })();
    return stpCache[n];
}
function sendSteps(ci, all) {
    const s = stpCache[ci.n]; if (!s || !s.done || (!s.w && !s.h.length)) return;
    const ids = all ? null : PC.notYet(ci, Object.keys(H.players)); if (ids && !ids.length) return;
    H.stp = { n: ci.n, q: ci.q, w: s.w, h: s.h, to: ids, all: all ? 1 : 0, at: Date.now() };
    flush(everyone()); saveSoon(true);
}
function stopSteps() { if (!H.stp) return; H.stp = null; flush(everyone()); saveSoon(true); }

/* ---------- Send to students from a board panel ---------- */
const isFindKey = (k) => /^find\d?$/.test(k);
/** Can panel k be sent? Tools always; a Find panel once it shows a problem. */
export function canSend(k, T) { return PC.isTool(k) || (isFindKey(k) && !!(((T || {}).find || {})[k] || {}).id); }
/** What panel k sends, read from the shared board state: { q, a, al, id } or { tool, ts }. */
async function payloadOf(k) {
    const T = A.S.tools;
    if (PC.isTool(k)) return { tool: k, ts: PC.toolStart(k, T) };
    if (isFindKey(k)) { const f = (T.find || {})[k]; const it = f && f.id && A.findItem ? await A.findItem(f.id) : null; return PC.fromFind(it); }
    return null;
}
let toastT = 0;
/** A short line on this screen (the board or the Remote), over the panels. */
function toast(msg) {
    let t = document.getElementById("lnToast");
    if (!t) { t = el("div", "lntoast"); t.id = "lnToast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3600);
}
/** The Send button on a board panel's title bar. The Remote running live notes sends at once (starting live notes for
    this period first if none is open); any other screen leaves a request for it in the shared board state. */
export async function sendPanel(k) {
    if (!A || !A.signedIn() || A.mode() === "sub") return;
    const o = await payloadOf(k);
    if (!o) { toast(isFindKey(k) ? "Pick a problem in this panel first." : "This panel can't be sent."); return; }
    if (isRemote() && (!H || hosting)) { await doSend(o, k); return; }
    if (H && running()) {
        A.S.tools.lns = { k, at: Date.now() }; if (A.push) A.push();
        toast("Sending " + (o.tool && !o.q ? PC.TOOL_NAMES[o.tool] : "the problem") + " to students…");
        return;
    }
    toast("Start Live notes on your Remote first, then tap Send again.");
}
async function doSend(o, k) {
    if (!H || !running()) {
        if (!isRemote()) return;
        await openRoom(); if (!H || !hosting) return;
    }
    if (H.per !== A.S.period) { note = "Live notes are open for " + H.per + " period. Switch to it, or close it and start " + A.S.period + "."; open = true; panelSig = ""; drawNotesPanel(true); toast(note); return; }
    const name = o.tool ? PC.TOOL_NAMES[o.tool] : "";
    if (o.tool && !o.q && H.ci && H.ci.open && !H.ci.ex) { setTool(o.tool); toast(name + " added beside check-in " + H.ci.n + "."); }
    else if (startCheck(Object.assign({ snt: 1 }, o))) toast(o.q ? "Problem sent to every Chromebook." : name + " sent to every Chromebook.");
    open = true; panelSig = ""; drawNotesPanel(true);
    if (k) { const ob = document.getElementById("notesOpen"); if (ob) ob.setAttribute("aria-expanded", "true"); }
}
/** On the Remote that runs live notes: a Send tapped on the board. */
function pickUpRequest() {
    const rq = A.S.tools && A.S.tools.lns;
    if (!rq || !rq.k || !(+rq.at > lnsDone)) return;
    lnsDone = +rq.at; try { sessionStorage.setItem("focal-notes-lns", String(lnsDone)); } catch (e) { /* fine */ }
    if (Date.now() - rq.at > 120000) return;   // an old tap, from before this Remote opened
    payloadOf(rq.k).then((o) => { if (o) doSend(o, rq.k); });
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
/** Mark everyone in an answer group right or not yet. Right also counts that answer from anyone who sends it later. */
function markGroup(g, ok) {
    const ci = H.ci; if (!ci) return;
    g.ids.forEach((id) => { const r = ci.res[id]; if (r && !r.none) { r.ok = ok; r.set = 1; if (ok) r.help = 0; } });
    if (ok && g.y && !ci.al.includes(g.y)) ci.al = ci.al.concat([g.y]).slice(-8);
    if (!ci.open) H.past = H.past.map((x) => (x.n === ci.n ? ci : x));
    flush(new Set(g.ids));
}
function removePlayer(id) {
    const p = P(id); if (!p) return;
    delete H.players[id]; if (p.ni >= 0) H.taken = (H.taken || []).filter((i) => i !== p.ni);
    if (H.ci) delete H.ci.res[id]; if (H.show && H.show.id === id) H.show = null; if (peek === id) peek = ""; cmp = cmp.filter((x) => x !== id); if (H.cmp && H.cmp.includes(id)) { H.cmp = null; if (H.board === "compare") H.board = "ring"; }
    const room = "rooms/" + H.code;
    A.store().rooms.many([{ path: room + "/s/" + id, del: true }, { path: room + "/p/" + id, del: true }, { path: room, data: roomDoc() }]).catch(() => {});
    changed(true);
}
function setBoard(what, id, withName) { H.board = what; H.show = what === "work" ? { id, nm: !!withName } : null; if (what !== "compare") H.cmp = null; changed(true); }
/** Two students' work side by side on the board, with no names: "Work A" and "Work B". */
function compareOnBoard(ids) { H.board = "compare"; H.show = null; H.cmp = ids.slice(0, 2); changed(true); }
function counts(ci) {
    const ids = PC.forIds(ci, Object.keys(H.players)), c = { of: ids.length, in: 0, ok: 0, no: 0, open: 0, help: 0, wait: 0 };
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
    if (hosting && running()) { followBoard(); pickUpRequest(); if (Date.now() - lastSave > 8000) saveSoon(true); }
    const c = document.getElementById("lnClock");
    if (c && H.ci && H.ci.open) { const s = Math.floor((Date.now() - H.ci.t0) / 1000); c.textContent = Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    if (endArm && Date.now() - endArm > 4000) { endArm = 0; panelSig = ""; }
}

/* ---------- the board: a check-in ring and the join chip, on the whiteboard screens ---------- */
/** The work pads the board shows (one student's, or two to compare). The Remote that runs live notes already has every pad. */
function padIds() { return !H ? [] : H.board === "work" && H.show ? [H.show.id] : H.board === "compare" && Array.isArray(H.cmp) ? H.cmp.slice(0, 2) : []; }
function watchPad() {
    const ids = isRemote() && hosting ? [] : padIds(), want = H ? ids.map((id) => "rooms/" + H.code + "/p/" + id).join("|") : "";
    if (want === padFor) return;
    if (padWatch) { padWatch.forEach((u) => u()); padWatch = null; } padFor = want; PAD = null; PADS = {};
    if (!want) return;
    padWatch = ids.map((id) => A.store().rooms.watch("rooms/" + H.code + "/p/" + id, (snap) => {
        if (want !== padFor) return;
        PADS[id] = snap.exists ? { img: snap.data.img || "", iq: +snap.data.iq || 0, it: +snap.data.it || 0 } : null;
        PAD = PADS[ids[0]] || null; rev++; redraw();
    }, () => {}));
}
function padOf(id) { if (isRemote() && hosting) { const d = PL[id]; return d && d.img ? { img: d.img, iq: +d.iq || 0, it: +d.it || 0 } : null; } return id ? PADS[id] || null : null; }
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
/** A layer over every other screen (Today, slides, Show Steps…), for a check-in that came from a panel's Send:
    its ring, the answers chart and the compare card show on whatever screen the board is on. Under nothing but the board's chrome. */
export function mountStageLayer(stage) {
    if (!stage || document.getElementById("lnstage")) return;
    const layer = el("div", "lnlayer stage"); layer.id = "lnstage"; layer.dataset.kind = "stage"; stage.append(layer); fillLayer();
}
function fillLayer() { ["lnlayer", "lnstage"].forEach((id) => { const l = document.getElementById(id); if (l && A) fillOne(l); }); }
function fillOne(layer) {
    const kind = layer.dataset.kind, base = H && running() && A.S.period === H.per;
    const on = base && (kind === "stage" ? !SCREENS_ON[A.S.screen] && !!H.ci && !!H.ci.snt : !!SCREENS_ON[kind]);
    const ci = on ? H.ci : null, c = ci ? counts(ci) : null, pads = on ? padIds().map((id) => padOf(id)) : [];
    const gs = on && ci && H.board === "groups" ? PC.answerGroups(ci.res, PC.forIds(ci, Object.keys(H.players)), (a, b) => V.sameAnswer(a, b) || V.sameAnswer(b, a)) : null;
    const sig = JSON.stringify(on ? [H.code, H.board, H.show, H.cmp, H.gk, ci && [ci.n, ci.open, ci.a, ci.ex, ci.tool], c, gs && gs.map((g) => [g.y, g.n, g.ok]), Object.keys(H.players).length, pads.map((x) => x && x.it)] : 0);
    if (sig === layer.dataset.sig && layer.childNodes.length) return;
    layer.dataset.sig = sig; layer.textContent = "";
    if (!on) return;
    if (H.board === "work" && H.show && P(H.show.id)) {
        const p = P(H.show.id), box = el("section", "lnwork"), pad = pads[0];
        box.setAttribute("aria-label", "Student work");
        box.append(el("p", "lnlab", H.show.nm ? p.nm + "'s work" : "Student work"));
        if (pad && pad.img) { const im = el("img"); im.src = pad.img; im.alt = "Student work"; box.append(im); } else box.append(el("p", "lnempty", "No work yet."));
        layer.append(box);
    } else if (H.board === "compare" && Array.isArray(H.cmp) && ci) {
        // Two students' work side by side, never with names: what is the same, what is different?
        const box = el("section", "lncompare"); box.setAttribute("aria-label", "Two students' work to compare");
        const head = el("div", "lncmphead"); head.append(el("p", "lnlab", "Compare the work · Check-in " + ci.n)); head.append(mathEl("p", "lncmpq", ci.q)); box.append(head);
        const row = el("div", "lncmprow");
        H.cmp.slice(0, 2).forEach((id, i) => {
            const pad = pads[i], r = ci.res[id], card = el("figure", "lncmpcard");
            const cap = el("figcaption"); cap.append(el("b", null, "Work " + "AB"[i])); if (r && r.y) { const y = el("span"); y.append("Answer: "); y.append(V.mathText(r.y)); cap.append(y); }
            card.append(cap);
            if (pad && pad.img && +pad.iq === ci.n) { const im = el("img"); im.src = pad.img; im.alt = "Work " + "AB"[i]; card.append(im); } else card.append(el("p", "lnempty", "No work yet."));
            row.append(card);
        });
        box.append(row, el("p", "lncmpask", "What is the same? What is different? Which one would you trust, and why?"));
        layer.append(box);
    } else if (ci && H.board === "groups" && gs && gs.length) {
        // Every answer the class gave and how many gave it. No names, and the right one only when the teacher shows it.
        const box = el("section", "lngroupsb"); box.setAttribute("aria-label", "The class's answers");
        const head = el("div", "lngbhead"); head.append(el("p", "lnlab", "Our answers · Check-in " + ci.n)); head.append(mathEl("p", "lncmpq", ci.q)); box.append(head);
        const max = Math.max(...gs.map((g) => g.n)), total = gs.reduce((a, g) => a + g.n, 0), list = el("div", "lngblist");
        gs.filter((g) => !g.blank).slice(0, 7).forEach((g, i) => {
            const right = H.gk && g.ok === true, wrong = H.gk && g.ok === false;
            const r = el("div", "lngbrow" + (right ? " right" : wrong ? " wrong" : "")); r.style.setProperty("--d", (i * 70) + "ms");
            const y = el("span", "lngby"); y.append(V.mathText(g.y)); if (right) y.append(el("em", null, " ✓"));
            const bar = el("span", "lngbbar"), fill = el("i"); fill.style.width = Math.max(6, Math.round(g.n / max * 100)) + "%"; bar.append(fill);
            r.append(y, bar, el("b", null, String(g.n))); list.append(r);
        });
        const more = gs.filter((g) => !g.blank).length - 7; if (more > 0) list.append(el("p", "lnsub", "and " + more + " more answers"));
        box.append(list, el("p", "lnsub", total + (total === 1 ? " answer" : " answers") + (H.gk ? "" : " · Which one is right? Convince your partner.")));
        layer.append(box);
    } else if (ci && ci.open && ci.ex) {
        const box = el("section", "lnci"); box.setAttribute("aria-label", "On your Chromebook");
        box.append(el("p", "lnlab", "On your Chromebook"), el("p", "lnbig lntoolname", PC.TOOL_NAMES[ci.tool] || "Tool"), el("p", "lnsub", "It's open on your screen. Try it out."));
        layer.append(box);
    } else if (ci && H.board === "ring") {
        const box = el("section", "lnci" + (ci.open ? "" : " done"));
        box.setAttribute("aria-label", "Check-in");
        box.append(el("p", "lnlab", (ci.again ? "Try again · " : "Check-in ") + ci.n));
        if (ci.open) {
            box.append(ring(c.of ? c.in / c.of : 0, c.in + "/" + c.of, "in"));
            box.append(el("p", "lnbig", c.in === c.of && c.of ? "Everyone is in!" : "Solve it on your Chromebook"), el("p", "lnsub", ci.tool ? "The " + PC.TOOL_NAMES[ci.tool].toLowerCase() + " is beside the problem." : "Show your work, then submit."));
        } else if (ci.a || c.ok || c.no) {
            box.append(ring(c.in ? c.ok / c.in : 0, c.in ? Math.round(c.ok / c.in * 100) + "%" : "–", "got it"));
            box.append(el("p", "lnbig", c.ok + " of " + c.in + " got it"));
            if (ci.a) box.append(mathEl("p", "lnsub", "Answer: " + ci.a));
        } else {
            box.append(ring(c.of ? c.in / c.of : 0, c.in + "/" + c.of, "in"), el("p", "lnbig", "Thanks for sending your work"));
        }
        layer.append(box);
    }
    if ((!ci || !ci.open || H.board !== "ring") && H.board !== "compare" && H.board !== "groups") {
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
    if (card && (!draft.src || draft.src !== card.src)) { draft.src = card.src; draft.q = card.q; draft.a = card.ans; draft.id = ""; draft.al = []; }
    const sig = notesSig() + "|" + busy + "|" + note + "|" + peek + "|" + endArm + "|" + JSON.stringify(choice) + "|" + JSON.stringify(draft) + "|" + A.S.screen + A.S.period + "|" + Object.keys(PL).map((k) => k + (PL[k].it || 0)).join(",")
        + "|" + JSON.stringify([gOpen, cmp, H && H.ci ? !!stpCache[H.ci.n] && !!stpCache[H.ci.n].done : 0]);
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

    if (ci && ci.open && !ci.ex) checkPanel(p, ci);
    else {
        if (ci && ci.open && ci.ex) explorePanel(p, ci);
        else if (ci) { results(p, ci, false); followUps(p, ci); }
        p.append(el("p", "gph sm", ci && ci.open && ci.ex ? "Add a problem (they keep the " + PC.TOOL_NAMES[ci.tool].toLowerCase() + ")" : ci ? "Next check-in" : "Check in on a problem"));
        const src = boardCard();
        if (!draft.own && !src) p.append(el("p", "gpnote", "Go to a Guided Notes or Bellringer problem, type your own, or tap Send on a Find panel."));
        const qa = el("textarea", "lnq"); qa.rows = 3; qa.placeholder = "The problem students will solve"; qa.value = draft.q; qa.setAttribute("aria-label", "Check-in problem");
        qa.oninput = () => { draft.q = qa.value; draft.own = true; draft.id = ""; draft.al = []; syncGo(); };
        const ka = el("input", "lnkey"); ka.placeholder = "Answer key (optional)"; ka.value = draft.a; ka.setAttribute("aria-label", "Answer key");
        ka.oninput = () => { draft.a = ka.value; draft.own = true; draft.al = []; };
        p.append(qa);
        const kl = el("label", "gpchk vrfield"); kl.append(el("span", null, "Answer key"), ka); p.append(kl);
        if (!(ci && ci.open && ci.ex)) {
            const tl = el("select", "lntool"); tl.setAttribute("aria-label", "Tool on the students' screens");
            [["", "No tool"]].concat(PC.SEND_TOOLS).forEach(([v, t]) => { const o = el("option", null, t); o.value = v; tl.append(o); });
            tl.value = draft.tool || ""; tl.onchange = () => { draft.tool = tl.value; syncGo(); };
            const tw = el("label", "gpchk vrfield"); tw.append(el("span", null, "Tool beside it"), tl); p.append(tw);
        }
        p.append(el("p", "gpnote", draft.a ? "Answers are checked against this. You can still mark any answer right." : "No key: you mark each answer right or not from its work."));
        const row = el("div", "gpbtns");
        const go = btn("btn go", "", () => startCheck());
        const syncGo = () => { const q = String(draft.q).trim(), t = draft.tool; go.textContent = q ? (t ? "Send the problem with the " + PC.TOOL_NAMES[t].toLowerCase() : "Check in on this problem") : t ? "Send the " + PC.TOOL_NAMES[t].toLowerCase() + " to explore" : "Check in on this problem"; go.disabled = !q && !t; };
        syncGo(); row.append(go);
        if (draft.own) row.append(btn("btn ghost", "Use the board's problem", () => { draft.own = false; draft.src = ""; draft.id = ""; draft.al = []; panelSig = ""; drawNotesPanel(true); }));
        p.append(row);
        p.append(el("p", "gpnote lntip", "Tip: the send button in the title bar of any math tool, calculator or Find panel sends it straight to every Chromebook."));
        if (!n) p.append(el("p", "gpnote", "Waiting for students to join. Anything you send waits for them."));
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
    return PC.forIds(ci, roster().map((x) => x.id)).sort((a, b) => rank(a) - rank(b) || P(a).nm.localeCompare(P(b).nm));
}
function checkPanel(p, ci) {
    const top = el("div", "gptimer"), t = el("b", null, (ci.again ? "Try again · " : "Check-in ") + ci.n + " · "), c = el("span"); c.id = "lnClock"; t.append(c); top.append(t);
    top.append(btn("btn go", "Close check-in", () => closeCheck(false)));
    p.append(top, mathEl("p", "gpq", ci.q));
    if (ci.a) p.append(mathEl("p", "gpnote", "Key: " + ci.a));
    if (Array.isArray(ci.to)) p.append(el("p", "gpnote", "Sent to the " + ci.to.length + " who didn't get check-in " + ci.again + ". Everyone else stays on the notes."));
    toolRow(p, ci);
    results(p, ci, true);
}
/** The tool on the students' screens for an open check-in: change it, add one, or take it away. */
function toolRow(p, ci) {
    const row = el("div", "lntoolrow"), sel = el("select", "lntool"); sel.setAttribute("aria-label", "Tool on the students' screens");
    [["", ci.ex ? "Close the tool" : "No tool"]].concat(PC.SEND_TOOLS).forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.append(o); });
    sel.value = ci.tool || ""; sel.onchange = () => setTool(sel.value);
    const l = el("label", "gpchk vrfield"); l.append(el("span", null, ci.ex ? "On their screens" : "Tool beside it"), sel); row.append(l); p.append(row);
}
/** A tool sent on its own: students explore it, nothing to submit. */
function explorePanel(p, ci) {
    const ids = PC.forIds(ci, Object.keys(H.players));
    const top = el("div", "gptimer"), t = el("b", null, "Exploring · "), c = el("span"); c.id = "lnClock"; t.append(c); top.append(t);
    top.append(btn("btn go", "Close the tool", () => closeCheck(false)));
    p.append(top);
    const card = el("div", "lnexplore"); card.append(el("b", null, PC.TOOL_NAMES[ci.tool] || "Tool"), el("small", null, "Open on " + ids.length + (ids.length === 1 ? " Chromebook" : " Chromebooks") + ". Each student has their own copy" + (ci.ts ? ", starting from your panel's setup." : ".")));
    p.append(card);
    toolRow(p, ci);
}
/** Grouped answers: "12 said 7, 5 said −7". Tap a group for who sent it and their work. */
function groupsBox(p, ci) {
    const ids = PC.forIds(ci, Object.keys(H.players)), gs = PC.answerGroups(ci.res, ids, (a, b) => V.sameAnswer(a, b) || V.sameAnswer(b, a));
    if (!gs.length) return gs;
    const max = Math.max(...gs.map((g) => g.n)), box = el("div", "lngroups");
    box.append(el("p", "gph sm", "Answers (" + gs.reduce((a, g) => a + g.n, 0) + ")"));
    gs.forEach((g) => {
        const key = g.blank ? "\u0000" : g.y, isOpen = gOpen === key, st = g.ok === true ? "ok" : g.ok === false ? "no" : "mid";
        const b = btn("lngrp " + st + (isOpen ? " on" : ""), null, () => { gOpen = isOpen ? null : key; panelSig = ""; drawNotesPanel(true); });
        b.setAttribute("aria-expanded", String(isOpen));
        const label = el("span", "lngy"); if (g.blank) label.append("Work only, no answer"); else label.append(V.mathText(g.y));
        const bar = el("span", "lngbar"); const fill = el("i"); fill.style.width = Math.round(g.n / max * 100) + "%"; bar.append(fill);
        b.append(el("span", "lngmk", st === "ok" ? "✓" : st === "no" ? "✗" : "?"), label, bar, el("b", "lngn", String(g.n)));
        b.setAttribute("aria-label", (g.blank ? "Work only" : g.y) + ": " + g.n + (g.n === 1 ? " student" : " students") + ({ ok: ", right", no: ", not yet", mid: ", to check" })[st]);
        box.append(b);
        if (isOpen) {
            const more = el("div", "lngmore"), names = el("div", "lnnames");
            g.ids.forEach((id) => { const x = P(id); if (!x) return; const nb = btn("lnname" + (peek === id ? " arm" : ""), x.nm, () => { peek = peek === id ? "" : id; panelSig = ""; drawNotesPanel(true); }); names.append(nb); });
            more.append(names);
            const r = el("div", "gpbtns");
            if (!g.blank) { if (g.ok !== true) r.append(btn("gpok", "Count it right", () => markGroup(g, true))); if (g.ok !== false) r.append(btn("gpno", "Mark not yet", () => markGroup(g, false))); }
            const withPad = g.ids.filter((id) => { const pd = padOf(id); return pd && pd.img && +pd.iq === ci.n; });
            if (withPad.length >= 2) r.append(btn("btn ghost", "Compare two of these", () => { cmp = withPad.slice(0, 2); panelSig = ""; drawNotesPanel(true); }));
            more.append(r); box.append(more);
        }
    });
    p.append(box);
    return gs;
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
    const gs = groupsBox(p, ci);
    // What the board shows: the count, the answers with no names, or two students' work side by side
    const brow = el("div", "lnboardrow"); brow.append(el("span", "lnbl", "On the board"));
    const seg = el("div", "lnseg"); brow.append(seg);
    const opt = (what, label, on, fn) => { const b = btn("lnsegb" + (on ? " on" : ""), label, fn); b.setAttribute("aria-pressed", String(on)); seg.append(b); };
    opt("", "Nothing", !H.board, () => setBoard("", null));
    opt("ring", ci.open ? "Count" : "Results", H.board === "ring", () => setBoard("ring", null));
    if (gs.length) opt("groups", "Answers", H.board === "groups", () => { H.gk = false; setBoard("groups", null); });
    p.append(brow);
    if (H.board === "groups") p.append(check("Show which answer is right on the board", !!H.gk, (v) => { H.gk = v; changed(true); }, "Off: the class sees every answer and how many gave it, and talks about which is right."));
    if (cmp.length) compareBar(p, ci);
    const brow2 = el("div", "gpbtns");
    if (!ci.open) brow2.append(btn("btn ghost", "Copy results", () => copyResults(ci)));
    if (brow2.childNodes.length) p.append(brow2);
    if (peek && P(peek)) peekBox(p, ci, peek);
    const grid = el("div", "lngrid");
    sortIds(ci).forEach((id) => {
        const x = P(id), r = ci.res[id], pad = padOf(id), has = r && !r.none;
        const st = !has ? (r && r.help && ci.open ? "help" : "wait") : r.help && ci.open ? "help" : r.ok === true ? "ok" : r.ok === false ? "no" : "mid";
        const b = btn("lntile " + st + (H.show && H.show.id === id ? " on" : "") + (cmp.includes(id) ? " cmp" : ""), null, () => { peek = peek === id ? "" : id; panelSig = ""; drawNotesPanel(true); });
        if (pad && pad.img && +pad.iq === ci.n) { const im = el("img"); im.src = pad.img; im.alt = ""; b.append(im); } else b.append(el("span", "lnnone", has ? "No work" : ci.open ? "Working…" : "Didn't send"));
        const mk = st === "ok" ? "✓ " : st === "no" ? "✗ " : st === "help" ? "✋ " : st === "mid" ? "? " : "";
        b.append(el("small", null, mk + x.nm + (has && r.y ? " · " + r.y : "")));
        b.setAttribute("aria-label", x.nm + ": " + ({ ok: "got it", no: "not yet", help: "stuck", mid: "sent, to check", wait: ci.open ? "working" : "didn't send" })[st] + (has && r.y ? ", answered " + r.y : ""));
        grid.append(b);
    });
    p.append(grid);
    if (!Object.keys(H.players).length) p.append(el("p", "gpnote", "No students have joined."));
}
/** Two students picked to compare: put their work side by side on the board, as Work A and Work B, with no names. */
function compareBar(p, ci) {
    const box = el("div", "lncmp");
    box.append(el("b", null, "Compare: " + cmp.map((id, i) => "ABC"[i] + " " + (P(id) ? P(id).nm : "")).join(" · ")));
    const row = el("div", "gpbtns");
    if (cmp.length === 2) row.append(btn("btn go", H.board === "compare" && H.cmp && H.cmp.join() === cmp.join() ? "On the board" : "Side by side on the board", () => compareOnBoard(cmp)));
    else row.append(el("small", "gpnote", "Pick one more: tap a student, then Compare."));
    row.append(btn("btn ghost", "Clear", () => { cmp = []; if (H.board === "compare") setBoard("ring", null); else { panelSig = ""; drawNotesPanel(true); } }));
    box.append(row, el("p", "gpnote", "The board shows Work A and Work B. Names stay on your Remote."));
    p.append(box);
}
/** After a check-in: a fresh try, or Show Steps, for only the students who didn't get it. */
function followUps(p, ci) {
    if (ci.ex) return;
    const ny = PC.notYet(ci, Object.keys(H.players)).length, judged = !!(ci.a || Object.values(ci.res).some((r) => r.ok != null));
    const box = el("div", "lnfollowup"); box.append(el("p", "gph sm", "Follow up"));
    const row = el("div", "gpbtns");
    if (judged && ny) row.append(btn("btn go", "Try again: the " + ny + " who didn't get it", () => tryAgain(ci)));
    const sc = stpCache[ci.n] || stepsFor(ci);
    const on = H.stp && H.stp.n === ci.n;
    if (on) {
        box.append(el("p", "gpnote", "Show Steps is on " + (Array.isArray(H.stp.to) ? H.stp.to.length + (H.stp.to.length === 1 ? " screen" : " screens") : "every screen") + "."));
        row.append(btn("btn ghost", "Take Show Steps off", stopSteps));
    } else if (!sc.done) box.append(el("p", "gpnote", "Getting Show Steps ready…"));
    else if (sc.w || sc.h.length) {
        const what = sc.w ? "Show Steps" : "The hint steps";
        if (judged && ny) row.append(btn("btn ghost", what + " to the " + ny + " who didn't get it", () => sendSteps(ci, false)));
        row.append(btn("btn ghost", what + " to everyone", () => sendSteps(ci, true)));
        if (!sc.w) box.append(el("p", "gpnote", "This problem has no worked example yet, so students get the bank's hint lines."));
    } else box.append(el("p", "gpnote", "No worked steps for this problem. Go over it on the board."));
    if (!judged) box.append(el("p", "gpnote", "Mark the answers (or add a key next time) to follow up with only the students who didn't get it."));
    box.append(row); p.append(box);
}
function peekBox(p, ci, id) {
    const x = P(id), r = ci.res[id], pad = padOf(id), big = el("div", "vrpeek");
    big.append(el("b", null, x.nm + (r && r.y ? " answered " + r.y : "")));
    if (pad && pad.img && +pad.iq === ci.n) { const im = el("img"); im.src = pad.img; im.alt = x.nm + "'s work"; big.append(im); } else big.append(el("p", "gpnote", "No work for this check-in."));
    const row = el("div", "gpbtns");
    if (r && !r.none) { row.append(btn("gpok", "Mark right", () => mark(id, true)), btn("gpno", "Mark not yet", () => mark(id, false))); }
    if (pad && pad.img) row.append(btn("btn go", "Show on board", () => setBoard("work", id, false)), btn("btn ghost", "Show with name", () => setBoard("work", id, true)));
    if (pad && pad.img && +pad.iq === ci.n) row.append(btn("btn ghost", cmp.includes(id) ? "Don't compare" : "Compare", () => { cmp = cmp.includes(id) ? cmp.filter((z) => z !== id) : cmp.concat([id]).slice(-2); panelSig = ""; drawNotesPanel(true); }));
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
