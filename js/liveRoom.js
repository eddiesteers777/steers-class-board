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

   Fact Blitz can be picked here too (the switch at the top of the panel). The check on the board is
   teacher/{uid}/games/fact { id, code, title, … }; the check itself is Fact Blitz's (flu/…, js/fluencyKeep.js).
   The Remote and the board both run Fact Blitz's keeper while a check is up, so clocks (with extra time)
   and scores keep flowing as long as either one is open.
========================================== */
import * as V from "./vaultCore.js?v=75";
import * as F from "./acapFormats.js?v=1";
import * as PC from "./profileCore.js?v=2";
import * as Buddy from "./buddy.js?v=2";
import { loadKids, credit as creditProfiles } from "./profiles.js?v=2";
import qrcode from "./vendor/qrcode.js?v=1";
import { drawItems } from "./mathTools.js?v=1";
import { setsFor, pickSet } from "./vaultPick.js?v=1";

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
/* ---------- student profiles (js/profileCore.js) ----------
   The period's profiles are read once when the room opens (or when this Remote takes the game over) and kept here,
   off H, so the heartbeat stays small. During play each student's live level and next lock are worked out in memory
   from their answers. The profile document is written once, at Game over (saveProfiles). Students never write it. */
let PF = null, pfFor = "", pfLoading = false;
const profOn = () => H && H.opts.prof !== false;
const kidOf = (p) => (p && p.pk && PF ? PF[p.pk] || null : null);
function pfEnsure() {
    if (!H || !hosting || pfLoading || pfFor === H.code) return;
    const code = H.code; pfLoading = true;
    loadKids(A.store().rooms, H.per).then((k) => { PF = k; }, () => { PF = PF || {}; }).then(() => { pfLoading = false; pfFor = code; if (H && H.code === code && running()) flush(everyone()); });
}
/** Characters open to this student: the first 8 for everyone, more with XP. */
const avOpen = (p) => Math.min(V.AVATARS.length, PC.avatarsOpen(kidOf(p) ? kidOf(p).xp : 0));
/** Vault skins open: by the most coins held this game (as before), or for good by locks cracked. */
const skOpen = (p) => Math.min(V.SKINS.length, Math.max(V.skinsOpen(Math.max(+p.top || 0, p.c)), kidOf(p) ? PC.skinsByLevel(PC.levelOf(kidOf(p))) : 1));
/** What this student has earned toward character pieces (js/buddy.js): saved profile plus this game so far. Guests get the open pieces. */
const lkMe = (p) => { const s = livePf(p); return s ? { xp: s.xp, lv: s.lv, b: s.b } : null; };
/** The roster's short names for the game's period (to match typed names to a profile). */
const rosterShort = () => V.shortNames((A.rosters()[H.per] || []).filter(Boolean));
let SETS = null, setsWatched = false, note = "", busy = "", tab = "players", dtab = "report", peek = "", endArm = 0, resetArm = 0;
let saveTimer = 0, lastSave = 0, panelSig = "", panelAt = 0, padWatch = null, padFor = "", PAD = null;
const setKey = (per) => "anchorboard-vset:" + per;
/** The teacher's last pick for a period on this device ("" when none). */
const recallSet = (per) => { try { return localStorage.getItem(setKey(per)) || ""; } catch (e) { return ""; } };
const keepSet = (per, id) => { try { if (id) localStorage.setItem(setKey(per), id); } catch (e) { /* private window */ } };
const choice = { set: (() => { try { return new URLSearchParams(location.search).get("vset") || ""; } catch (e) { return ""; } })(), mins: 10, names: "roster", board: true, save: false, live: false, work: true, retry: true, steps: true, slow: true, snd: true, comeback: true, sab: true, dj: true, goal: "auto", prof: true, game: (() => { try { return localStorage.getItem("anchorboard-live-game") === "fact" ? "fact" : "vault"; } catch (e) { return "vault"; } })() };

export function mountLive(api) { A = api; }
export const liveSig = () => rev + "#" + loaded + "#" + hosting + "#" + (PAD ? PAD.it : "") + "#" + fbRev;
const onLive = () => A && A.S.screen === "live";
const isRemote = () => A.mode() === "remote";
const running = () => H && (H.status === "lobby" || H.status === "play");
const joinUrl = () => location.host + "/" + JOIN_PATH;
/** A QR code that opens the student page with this game's code already typed in. */
function qrSvg(code, url) {
    const q = qrcode(0, "M"); q.addData(url || location.origin + "/play.html?code=" + code); q.make();
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
    watchCmd();
    watchPad();
    fbWatch();
}
/* ---------- moves made on a screen that isn't running the game ----------
   Only the Remote running the game writes the game. When the board (or another Remote)
   taps Next question, Send it back or Stop, it asks that Remote through
   teacher/{uid}/games/cmd, so its older copy of the game never overwrites the newer one. */
let cmdSeen = -1, cmdWatched = false;
const hostAlive = () => !!(H && H.host && Date.now() - (+H.hb || 0) < HOST_STALE);
function doMove(op, qi, ans) {
    if (op === "review") review(qi, ans);
    else if (op === "send") { if (isRemote() && !hosting) takeHost(); sendBack(qi, !!ans); }
    else if (op === "finish") finishRedo();
}
function ask(op, qi, ans) {
    if (!H) return;
    if ((isRemote() && hosting) || (isRemote() && !hostAlive())) return doMove(op, qi, ans);
    if (!hostAlive() && op === "review") return review(qi, ans);   // no Remote is running it: nobody else is writing
    A.store().save("games/cmd", { op, qi: qi == null ? -1 : qi, ans: !!ans, n: Date.now(), by: PAGE }).catch((e) => { note = "Could not reach the Remote (" + ((e && e.code) || "connection") + ")."; });
    if (op === "review") { H.review = qi == null ? null : { qi, ans: !!ans }; rev++; A.redraw(); }   // show it here at once; the Remote's copy follows
}
function watchCmd() {
    if (cmdWatched || !isRemote()) return; cmdWatched = true;
    A.store().watch("games/cmd", (snap) => {
        if (snap.pending) return;
        const d = snap.exists ? snap.data : null, n = d ? +d.n || 0 : 0;
        if (cmdSeen < 0) { cmdSeen = n; return; }   // just opened: never replay an old move
        if (n <= cmdSeen) return; cmdSeen = n;
        if (hosting && H && d.by !== PAGE) doMove(d.op, +d.qi < 0 ? null : +d.qi, !!d.ans);
    }, () => {});
}
function takeHost() {
    hosting = true; H.host = PAGE; H.hb = Date.now(); saveSoon(true); pfEnsure();
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
function feed(txt, kind, vs) { H.feed = (H.feed || []).concat([Object.assign({ t: Date.now(), txt, k: kind || "" }, vs ? { vs } : {})]).slice(-12); }

function handle(id, d, sends) {
    let p = P(id);
    if (!p) {
        if (d.ni == null && !d.nm) return;
        let nm = "", ni = -1, pk = "";
        if (H.mode === "roster") {
            ni = Math.floor(+d.ni); nm = H.names[ni] || "";
            const holder = Object.keys(H.players).find((k) => H.players[k].ni === ni);
            if (!nm || holder) { sendErr(id, nm ? "That name is taken. Pick yours, or ask your teacher to free it." : "Pick your name from the list."); return; }
            pk = PC.kidKey(nm);
        } else {
            nm = V.cleanTyped(d.nm); if (!nm) { sendErr(id, "Type your first name and last initial."); return; }
            // A typed name that matches the roster ("ava r", "Ava R") plays as that roster name and profile: no duplicates.
            const names = rosterShort(), at = PC.matchRoster(nm, names);
            if (at >= 0) {
                nm = names[at]; pk = PC.kidKey(nm);
                if (Object.values(H.players).some((x) => x.pk === pk)) { sendErr(id, nm + " is already playing. Ask your teacher to free that name."); return; }
            } else {
                const used = new Set(Object.values(H.players).map((x) => x.nm.toLowerCase())); let k = 2, base = nm;
                while (used.has(nm.toLowerCase())) nm = base + " " + k++;
            }
        }
        const kid = pk && PF ? PF[pk] : null, kAv = kid && Number.isInteger(kid.av) && kid.av < PC.avatarsOpen(kid.xp) ? kid.av : -1;
        p = H.players[id] = { nm, ni, pk, c: 0, r: 0, n: 0, st: 0, best: 0, h: 0, code: "", qn: 0, ord: shuffledOrder(), g: {}, sh: 0, la: null, fb: null, hk: null, hit: null, cr: 0, sa: 0, sk: 0, sc: 0, sn: 0, at: Date.now(),
            av: kAv >= 0 ? kAv : Math.floor(Math.random() * Math.min(V.AVATARS.length, PC.avatarsOpen(kid ? kid.xp : 0))), pu: "", dbl: 0, blk: 0, ins: 0, box: 0, vs: 0, top: 0, qt: Date.now(), sm: 0, sp: 0, su: 0 };
        if (ni >= 0) H.taken = (H.taken || []).concat([ni]);
        if (kid && Number.isInteger(kid.vs) && kid.vs < skOpen(p)) p.vs = kid.vs;   // the vault skin they picked last game
        p.lk = kid && Buddy.validLook(kid.lk) && kid.lk ? Buddy.cleanLook(kid.lk, lkMe(p)) : Buddy.seedLook(nm);   // their character's outfit
        feed(nm + " joined", "join"); sends.add("room");
    }
    // Waiting room: a character any time, a starting power-up until the game starts.
    if (d.av != null && Number.isInteger(+d.av) && +d.av >= 0 && +d.av < avOpen(p) && +d.av !== p.av) { p.av = +d.av; sends.add("room"); }
    if (typeof d.lk === "string" && Buddy.validLook(d.lk) && d.lk) { const lk = Buddy.cleanLook(d.lk, lkMe(p)); if (lk !== p.lk) { p.lk = lk; sends.add("room"); } }
    if (d.pu != null && H.status === "lobby" && (d.pu === "" || V.starter(d.pu))) p.pu = d.pu;
    // A vault skin, any time, once the student has held enough coins to unlock it.
    if (d.vs != null && Number.isInteger(+d.vs) && +d.vs >= 0 && +d.vs < skOpen(p) && +d.vs !== (p.vs || 0)) p.vs = +d.vs;
    // A new vault code.
    if ((+d.cn || 0) > p.sc) { p.sc = +d.cn; if (V.validCode(d.code)) { p.code = d.code; p.hit = null; } }
    // An answer to the question on their screen.
    const a = d.a;
    if (a && (+a.n || 0) > p.sa) {
        p.sa = +a.n;
        if (H.paused) { /* paused: nothing counts until the teacher resumes */ }
        else if (H.exit && !H.exit.done) exitAnswer(id, p, a);
        else if (H.redo && !H.redo.done) redoAnswer(id, p, a);
        else if ((+p.cd || 0) > Date.now()) { /* slowing down after 2 misses in a row */ }
        else if (H.status === "play" && +a.q === p.qn && p.code && !(H.opts.work !== false && !d.img)) {   // work required: an answer with no pad picture is not taken
            p.ta = (+p.ta || 0) + 1; p.f0 = +p.f0 || Date.now(); p.f1 = Date.now();   // effort for Student Progress: every try, first and last answer time
            const q = qOf(p, p.qn), typed = String(a.t || "").slice(0, 80), ok = V.sameAnswer(typed, q.a, q.al), qi = p.ord[p.qn % p.ord.length];
            const second = p.rt === p.qn;   // this is their second (or later) try at this question
            let plus = 0, x2 = [], box = null, taxed = null;
            const steps = H.opts.steps !== false ? V.stepsFor(q) : [];
            if (second && p.sm) stepTry(p, q, qi, typed, ok, steps);
            else if (second) {
                // Only the first try counts for percent right and the report; a fix on the second try earns half coins.
                if (ok) {
                    plus = Math.round(V.coinsFor(1) / 2); p.st = 1; classRight();
                    if (bonusOn()) { plus *= 2; x2.push("bonus"); }
                    p.c += plus;
                    const last = (p.lg || []).slice().reverse().find((x) => x.i === qi && !x.ok); if (last) last.fx = 1;
                }
                p.fb = { q: p.qn, ok, y: typed, a: ok ? "" : q.a, plus, x2, box: null, second: 1 };
                if (ok) p.la = { qi, q: p.qn, y: typed, ok, second: 1 };   // a miss keeps the first try, so "Count it" still counts that one
                p.rt = -1; nextQ(p); missRow(p, ok);
            } else {
                p.n++;
                if (ok) {
                    p.r++; p.st++; p.best = Math.max(p.best, p.st); plus = V.coinsFor(p.st); classRight(); p.h = Math.min(V.MAX_HACKS, p.h + 1);
                    if (p.dbl > 0) { plus *= 2; p.dbl--; x2.push("double"); }
                    if (bonusOn()) { plus *= 2; x2.push("bonus"); }
                    if (comeback(id)) { const cb = V.comebackPlus(plus); plus += cb; x2.push("comeback"); }
                    const tx = taxOn(p);   // a Tax sabotage: a quarter of this answer's coins go to the player who set it
                    if (tx) { const cut = V.taxCut(plus); plus -= cut; tx.c += cut; taxed = { by: p.tax.nm, cut }; feed(tx.nm + "'s Tax took " + cut + " coins from " + p.nm, "sab"); sends.add(p.tax.by); p.tax = null; }
                    p.c += plus;
                    if (p.r % V.BOX_EVERY === 0 || p.mb) { box = V.rollBox(Math.random, H.opts.dj === false); openBox(p, box); p.mb = 0; }
                }
                else p.st = 0;
                const stepIn = !ok && steps.length > 0, retry = !ok && !stepIn && H.opts.retry !== false;
                p.la = { qi, q: p.qn, y: typed, ok };
                tally(p, qi, typed, ok);
                if (stepIn) {
                    // Step-by-step help: a real first try unlocks step 1. A quick guess unlocks nothing yet.
                    const fast = Date.now() - (+p.qt || 0) < V.STEP_TRY_MS;
                    p.sm = 1; p.sp = fast ? 0 : 1; p.su = Date.now(); p.rt = p.qn;
                    p.fb = stepFb(p, q, typed, steps, fast ? "fast" : "step");
                } else {
                    p.fb = retry ? { q: p.qn, ok, y: typed, a: "", plus: 0, x2, box: null, retry: 1, hint: q.h || V.hintFor(typed, q.a, q.q) } : Object.assign({ q: p.qn, ok, y: typed, a: ok ? "" : q.a, plus, x2, box }, taxed ? { tax: taxed } : {});
                    if (retry) p.rt = p.qn; else nextQ(p);
                    missRow(p, ok);
                }
            }
        }
    }
    // A hack: one guess at a classmate's vault code.
    const k = d.k;
    if (k && (+k.n || 0) > p.sk) {
        p.sk = +k.n;
        const t = P(k.to), g = String(k.g || "");
        if (H.status !== "play" || H.redo || H.exit || H.paused || !t || k.to === id || !V.validCode(g)) p.hk = { n: p.sk, to: k.to || "", g, m: "", why: "That vault can't be hacked." };
        else if (lockOn()) p.hk = { n: p.sk, to: k.to, g, m: "", why: "Lockdown! No hacking until it ends. Answer questions." };
        else if ((+p.jam || 0) > Date.now()) p.hk = { n: p.sk, to: k.to, g, m: "", why: "Your hacks are jammed for " + Math.ceil((p.jam - Date.now()) / 1000) + " more seconds." };
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
            let grace = 0;
            if (m === "2".repeat(V.CODE_LEN) && graceFor(k.to)) {
                // Grace lock: once a game, a student in the bottom half who gets cracked keeps every coin. The hacker still
                // finds GRACE_GIFT new coins (made, not taken), so the crack still pays and nobody behind is crushed.
                grace = 1; t.gr = 1; steal = PC.GRACE_GIFT; p.c += steal; p.cr++;
                t.code = ""; t.sh = Date.now() + V.SHIELD_MS; t.hit = { by: p.nm, lost: 0, at: Date.now(), grace: 1 };
                Object.values(H.players).forEach((x) => { delete x.g[k.to]; if (x.spy) delete x.spy[k.to]; });
                feed(p.nm + " cracked " + t.nm + "'s vault, but a grace lock kept their coins", "crack", t.vs || 0); sends.add(k.to);
            } else if (m === "2".repeat(V.CODE_LEN)) {
                steal = V.stealFrom(t.c); if (t.ins) steal = Math.round(steal / 2); t.c -= steal; p.c += steal; p.cr++;
                t.code = ""; t.sh = Date.now() + V.SHIELD_MS; t.hit = { by: p.nm, lost: steal, at: Date.now() };
                Object.values(H.players).forEach((x) => { delete x.g[k.to]; if (x.spy) delete x.spy[k.to]; });   // the old code is gone for everyone
                feed(p.nm + " cracked " + t.nm + "'s vault (+" + steal + ")", "crack", t.vs || 0); sends.add(k.to);
            }
            p.hk = Object.assign({ n: p.sk, to: k.to, g, m, steal, tn: t.nm }, grace ? { grace: 1 } : {});
        }
    }
    // A sabotage: spend coins to slow down a player who is ahead (see V.SABOTAGES for the rules).
    const sb = d.sb;
    if (sb && (+sb.n || 0) > (+p.ssb || 0)) {
        p.ssb = +sb.n;
        if (V.djKey(sb.k)) { djPick(id, p, V.djKey(sb.k)); sends.add(id); return; }
        if (sb.k === "bk:shld") { bankShield(p); sends.add(id); return; }
        const t = P(sb.to), s = V.sabotage(sb.k), now = Date.now(), no = (why) => { p.sbr = { n: p.ssb, ok: 0, why }; };
        if (H.status !== "play" || H.redo || H.exit || H.paused || H.opts.sab === false || !s || !t || sb.to === id) no("You can't sabotage right now.");
        else if (lockOn()) no("Lockdown! No sabotages until it ends.");
        else if ((+p.sbc || 0) > now) no("Your sabotage is recharging. Ready in " + Math.ceil((p.sbc - now) / 1000) + " s.");
        else if (p.c < s[2]) no(s[1] + " costs " + s[2] + " coins. Answer more questions first.");
        else if (!V.canSabotage(p.c, t.c)) no("You can only sabotage players with at least as many coins as you.");
        else if (shielded(t)) no(t.code ? t.nm + " has a firewall up. Try someone else." : t.nm + " is setting a new vault code. Try someone else.");
        else if ((+t.sbs || 0) > now) no(t.nm + " was just sabotaged. Give them a minute.");
        else if (s[0] === "spy" && V.spyPick((p.spy || {})[sb.to]) < 0) no("You already know all of " + t.nm + "'s code. Hack it!");
        else {
            p.c -= s[2]; p.sbc = now + V.SAB_COOL_MS; t.sbs = now + V.SAB_SAFE_MS;
            const r = { n: p.ssb, ok: 1, k: s[0], tn: t.nm };
            if (s[0] === "fog") t.fog = now + V.FOG_MS;
            else if (s[0] === "jam") t.jam = now + V.JAM_MS;
            else if (s[0] === "tax") t.tax = { by: id, nm: p.nm, until: now + V.TAX_MS };
            else if (s[0] === "spy") { const known = (p.spy || {})[sb.to] || "", i = V.spyPick(known); p.spy = Object.assign({}, p.spy, { [sb.to]: known + i }); r.i = i; r.d = t.code[i]; }
            p.sbr = r; t.sbh = { k: s[0], by: p.nm, at: now };
            feed(p.nm + " used " + s[1] + " on " + t.nm, "sab"); sends.add(sb.to);
        }
    }
    sends.add(id);
}
/** A grace lock is ready for this student: not used yet this game, and in the bottom half of 2 or more players. */
function graceFor(id) {
    const t = P(id); if (!t || t.gr) return false;
    const order = ranked(), rank = order.findIndex((x) => x.id === id) + 1;
    return order.length >= 2 && rank > Math.ceil(order.length / 2);
}
/** A Shield bought with banked coins (once a game). The coins come off the bank when the game saves to profiles. */
function bankShield(p) {
    const no = (why) => { p.bkr = { n: p.ssb, ok: 0, why }; }, kid = kidOf(p), have = kid ? PC.summary(kid).coins : 0;
    if (!running() || H.redo || H.exit) no("You can't do that right now.");
    else if (!profOn() || !p.pk) no("Banked coins aren't on for this game.");
    else if (p.bsp) no("You already brought a Shield this game.");
    else if (p.blk || (H.status === "lobby" && p.pu === "shield")) no("You already have a Shield.");
    else if (have < PC.BANK_SHIELD) no("A Shield costs " + PC.BANK_SHIELD + " banked coins. You have " + have + ".");
    else { p.blk = 1; p.bsp = PC.BANK_SHIELD; p.bkr = { n: p.ssb, ok: 1 }; }
}
/** This student's profile right now: what's saved plus this game so far (nothing is written until Game over). */
function livePf(p) {
    if (!profOn() || !p.pk || PF == null) return null;
    if (p.pres) return p.pres;
    const kid = kidOf(p), g = PC.vaultGain(p, H.qs), r = PC.applyGain(kid, g, PC.dayOf()), s = PC.summary(r.kid);
    s.gx = g.xp + PC.XP.lock * r.locks.length; s.gb = g.bank; s.g0 = kid ? +kid.g || 0 : 0; s.coins = Math.max(0, s.coins - (+p.bsp || 0));
    if (p.plv == null) p.plv = PC.levelOf(kid || {});
    if (s.lv > p.plv) { p.plk = { l: r.locks[r.locks.length - 1] || "", at: Date.now() }; p.plv = s.lv; }
    return s;
}
/** Game over: add each roster student's game to their profile, in one transaction. Runs once a game. */
async function saveProfiles() {
    if (!H || !profOn() || H.pfSaved || H.pfBusy) return;
    const per = H.per, code = H.code, gains = {}, who = {};
    Object.keys(H.players).forEach((id) => {
        const p = H.players[id]; if (!p.pk) return;
        const g = PC.vaultGain(p, H.qs); if (!g.n && !p.bsp) return;   // joined but never answered: nothing to add
        g.av = p.av; g.vs = p.vs || 0; g.lk = p.lk || ""; gains[p.nm] = g; who[p.nm] = id;
    });
    if (!Object.keys(gains).length) { H.pfSaved = true; return; }
    H.pfBusy = true; panelSig = "";
    try {
        const out = await creditProfiles(A.store().rooms, per, gains);
        if (!H || H.code !== code) return;
        if (out.kids) PF = out.kids;
        Object.entries(out.res).forEach(([nm, r]) => {
            const p = P(who[nm]); if (!p) return;
            p.pres = Object.assign({}, r.sum, { gx: gains[nm].xp + PC.XP.lock * r.locks.length, gb: gains[nm].bank, nl: r.locks, nb: r.badges, saved: 1 });
        });
        H.pfSaved = true; note = "";
        flush(everyone());
    } catch (e) { note = "Could not save to student profiles (" + ((e && e.code) || "connection") + "). Tap Save to profiles to try again."; }
    if (H) H.pfBusy = false; panelSig = ""; saveSoon(true); drawLivePanel(true);
}
/* ---------- send it back: everyone tries a gone-over question again ---------- */
const REDO_COINS = 15;
const redoN = () => 100000 + (H.redo ? H.redo.k : 0);   // a question number no regular question uses
function redoAnswer(id, p, a) {
    const rd = H.redo; if (+a.q !== redoN() || rd.res[id]) return;
    const q = H.qs[rd.qi], typed = String(a.t || "").slice(0, 80), ok = V.sameAnswer(typed, q.a, q.al);
    rd.res[id] = { ok: ok ? 1 : 0, y: typed.slice(0, 40) };
    const plus = ok ? REDO_COINS : 0; p.c += plus;
    p.fb = { q: redoN(), ok, y: typed, a: ok ? "" : q.a, plus, x2: [], box: null, redo: 1 };
}
/** After going over a missed question, send it to every student's screen once more. The game reopens just for this question.
    Unless the teacher sends it blank, the work on the board's whiteboard page goes with it: each student's pad starts
    with the teacher's work on it (a picture under their own ink), so they pick up where the class left off. */
function sendBack(qi, blank) {
    if (!H || H.status !== "done" || !H.qs[qi]) return;
    const key = reviewInkKey(qi);
    if (H.redo && H.redo.res) H.rdl = (H.rdl || []).concat([{ qi: H.redo.qi, res: H.redo.res }]).slice(-12);   // keep earlier send-backs for Student Progress
    H.redo = { qi, k: ((H.redo && H.redo.k) || 0) + 1, res: {}, at: Date.now(), done: 0, mine: blank ? 0 : 1 };
    H.review = { qi, ans: false }; H.status = "play"; H.ends = 0; H.bonus = 0; H.show = null; redoWork = null;
    feed("Try it again!", "start"); flush(everyone()); saveSoon(true); panelSig = ""; drawLivePanel(true);
    if (!blank) { const k = H.redo.k; teacherWork(key).then((w) => { if (!H || !H.redo || H.redo.k !== k || H.redo.done) return; redoWork = w ? Object.assign({ k }, w) : null; H.redo.mine = w ? 1 : 0; flush(new Set(["room"])); panelSig = ""; drawLivePanel(true); }); }
}
let redoWork = null;   // { k, img, w, h }: the picture of the teacher's work for the redo now running (kept off H so heartbeats stay small)
/** The whiteboard page the board shows for a gone-over question (the same key boardApp's whiteboard uses). */
function reviewInkKey(qi) {
    const S = A.S, base = [S.week, S.period, "d" + S.day, "vr" + String(H.rid || H.code || "").replace(/\W/g, "") + "q" + qi].join("_");
    const pg = S.wb && S.wb.pg && S.wb.pg.k === base ? Math.max(0, Math.floor(+S.wb.pg.n || 0)) : 0;
    return base + (pg ? "_pg" + pg : "");
}
/** The teacher's whiteboard page as a picture: math tools under the ink, cut down to just the part with work on it.
    Transparent where there is no work, so it sits on the student's paper. null when the page is empty. */
async function teacherWork(key) {
    let d = null; try { d = await A.store().rooms.get("teacher/" + A.store().rooms.uid() + "/ink/" + key); } catch (e) { d = null; }
    const strokes = d && Array.isArray(d.strokes) ? d.strokes : [], items = d && Array.isArray(d.items) ? d.items : [];
    if (!strokes.length && !items.length) return null;
    const ar = +d.ar > 0.3 && +d.ar < 5 ? +d.ar : 1.85, W = 1400, Hh = Math.round(W / ar);
    const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = Hh; return c; };
    const ink = mk(), x = ink.getContext("2d"), css = (v, f) => (getComputedStyle(document.documentElement).getPropertyValue(v).trim() || f);
    const PEN = { ink: css("--pen-ink", "#14213D"), blue: css("--pen-blue", "#1552D6"), red: css("--pen-red", "#C62828"), green: css("--pen-green", "#1B7F3B") }, SIZES = [3, 6, 11];
    x.lineCap = "round"; x.lineJoin = "round";
    strokes.forEach((st) => {   // the same drawing as the board's whiteboard (boardApp drawStroke)
        const p = st && st.p; if (!Array.isArray(p) || p.length < 2) return;
        x.globalCompositeOperation = st.e ? "destination-out" : "source-over"; x.globalAlpha = st.h ? 0.38 : 1;
        x.strokeStyle = st.h && (st.c === "ink" || !PEN[st.c]) ? "#F2B33D" : (PEN[st.c] || PEN.ink);
        x.lineWidth = (st.e ? 5 : st.h ? 3.4 : 1) * (SIZES[st.w] || 6) * W / 1400;
        x.beginPath(); x.moveTo(p[0] / 10000 * W, p[1] / 10000 * Hh); if (p.length === 2) x.lineTo(p[0] / 10000 * W + 0.1, p[1] / 10000 * Hh);
        for (let i = 2; i < p.length; i += 2) x.lineTo(p[i] / 10000 * W, p[i + 1] / 10000 * Hh);
        x.stroke();
    });
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
    const all = mk(), y = all.getContext("2d");
    try { if (items.length) drawItems(y, items, W, Hh); } catch (e) { /* a tool that won't draw: the ink still goes */ }
    y.drawImage(ink, 0, 0);
    // Crop to the work, with a margin.
    const px = y.getImageData(0, 0, W, Hh).data; let x0 = W, y0 = Hh, x1 = -1, y1 = -1;
    for (let j = 0; j < Hh; j += 2) for (let i = 0; i < W; i += 2) if (px[(j * W + i) * 4 + 3] > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 < 0) return null;
    const m = 24; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W, x1 + m); y1 = Math.min(Hh, y1 + m);
    const cw = x1 - x0, ch = y1 - y0, sc = Math.min(1, 900 / Math.max(cw, ch)), out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(cw * sc)); out.height = Math.max(1, Math.round(ch * sc));
    out.getContext("2d").drawImage(all, x0, y0, cw, ch, 0, 0, out.width, out.height);
    let img = out.toDataURL("image/png"); if (img.length > 300000) img = out.toDataURL("image/webp", 0.85);
    if (img.length > 600000 || !/^data:image\/(png|webp)/.test(img)) img = out.toDataURL("image/webp", 0.6);
    // How big it was on the board, as a share of the board's width, so the student sees it at about the same size.
    return img.length > 700000 ? null : { img, w: out.width, h: out.height, fw: +(cw / W).toFixed(3) };
}
function finishRedo() {
    const rd = H && H.redo; if (!rd || rd.done) return;
    const r = Object.values(rd.res); rd.done = 1; H.show = null;
    H.redos = (H.redos || []).filter((x) => x.qi !== rd.qi).concat([{ qi: rd.qi, ok: r.filter((x) => x.ok).length, of: r.length }]);
    H.status = "done"; flush(everyone()); saveSoon(true); panelSig = ""; drawLivePanel(true);
}
const redoCount = () => { const r = Object.values((H.redo && H.redo.res) || {}); return { of: r.length, ok: r.filter((x) => x.ok).length, n: Object.keys(H.players).length }; };

/* ---------- pause: freeze the clock and every screen so the teacher can teach ---------- */
function setPause(on) {
    if (!H || H.status !== "play") return;
    if (on && !H.paused) { H.paused = Date.now(); feed("Paused", "pause"); }
    else if (!on && H.paused) {
        const gap = Date.now() - H.paused; H.paused = 0;
        if (H.ends) H.ends += gap;
        if (+H.bonus > 0) H.bonus = +H.bonus + gap;
        if (+H.lock > 0) H.lock = +H.lock + gap;
        Object.values(H.players).forEach((p) => {
            ["cd", "sh", "fog", "jam", "sbc", "sbs"].forEach((k) => { if ((+p[k] || 0) > 0) p[k] = +p[k] + gap; });
            if (p.tax) p.tax.until += gap;
        });
        feed("Back to the game!", "start");
    }
    flush(everyone()); saveSoon(true); panelSig = ""; drawLivePanel(true);
}

/* ---------- step-by-step help after a miss ----------
   How it's built to work for 12-year-olds (and not get gamed):
   - A real try comes first. A wrong answer in the first few seconds of a question is a guess: it counts as a
     miss and unlocks no step ("Steps unlock after a real try"). So spamming wrong answers to see steps doesn't pay.
   - Each step costs coins: a right answer after a miss earns 60%, then 40%, 25%, 20% (V.STEP_PAY). The coin meter
     shrinks in front of them, so trying hard before asking for the next step is the better deal (loss aversion).
   - Solving it with one step or fewer still earns a hack, so the comeback feels like a win, not a consolation.
   - Their phone/Chromebook makes them read a step (a few seconds) and write new work on the pad before trying again.
   - Steps never give the final answer. After the last step, one more miss shows the answer and moves on.
   - Only the first try counts in the report and percent right. Steps used are private: the student and the Remote. */
function nextQ(p) { p.qn++; p.sm = 0; p.sp = 0; p.qt = Date.now(); }
function stepFb(p, q, typed, steps, kind) {
    const pay = V.STEP_PAY[Math.max(1, Math.min(p.sp, V.STEP_PAY.length - 1))];
    return { q: p.qn, ok: false, y: typed, a: "", plus: 0, x2: [], box: null, retry: 1, step: 1, kind, t: Date.now(), sp: steps.slice(0, p.sp), sn: steps.length,
        worth: Math.max(2, Math.round(V.coinsFor(1) * pay)), hack: p.sp <= 1 ? 1 : 0 };
}
/** Stuck: no new try for a while after a miss, so the next step drops onto their board by itself (and the coins drop like any step). */
function stuckSteps() {
    if (H.paused || (H.exit && !H.exit.done) || (H.redo && !H.redo.done) || H.opts.steps === false) return;
    const now = Date.now(), sends = new Set();
    Object.keys(H.players).forEach((id) => {
        const p = H.players[id];
        if (!p.sm || p.rt !== p.qn || !p.code || now - Math.max(+p.su || 0, +p.qt || 0) < V.STEP_STUCK_MS) return;
        const q = qOf(p, p.qn), steps = V.stepsFor(q); if (p.sp >= steps.length) return;
        p.sp++; p.su = now;
        const last = (p.lg || []).slice().reverse().find((x) => x.i === p.ord[p.qn % p.ord.length] && !x.ok); if (last) last.sp = p.sp;
        p.fb = stepFb(p, q, (p.la && p.la.y) || "", steps, "auto"); sends.add(id);
    });
    if (sends.size) { flush(sends); saveSoon(); }
}
/** A second (or later) try at a question in step mode. */
function stepTry(p, q, qi, typed, ok, steps) {
    const last = (p.lg || []).slice().reverse().find((x) => x.i === qi && !x.ok);
    if (ok) {
        let plus = Math.max(2, Math.round(V.coinsFor(1) * V.STEP_PAY[Math.max(1, Math.min(p.sp, V.STEP_PAY.length - 1))])); const x2 = [];
        if (bonusOn()) { plus *= 2; x2.push("bonus"); }
        p.c += plus; p.st = 1; classRight();
        const hack = p.sp <= 1; if (hack) p.h = Math.min(V.MAX_HACKS, p.h + 1);
        if (last) { last.fx = 1; last.sp = p.sp; }
        p.fb = { q: p.qn, ok: true, y: typed, a: "", plus, x2, box: null, second: 1, steps: p.sp, hack: hack ? 1 : 0 };
        p.la = { qi, q: p.qn, y: typed, ok: true, second: 1 };
        p.rt = -1; nextQ(p); missRow(p, true);
        return;
    }
    if (!typed.trim()) {   // Skip: show the answer and move on (no coins)
        if (last) last.sp = p.sp;
        p.fb = { q: p.qn, ok: false, y: "", a: q.a, plus: 0, x2: [], box: null, second: 1, steps: p.sp, skip: 1 };
        p.rt = -1; nextQ(p); return;
    }
    if (p.sp === 0 && Date.now() - (+p.qt || 0) < V.STEP_TRY_MS) {   // still guessing fast: no step yet
        p.fb = stepFb(p, q, typed, steps, "fast");
        return;
    }
    if (p.sp > 0 && Date.now() - (+p.su || 0) < V.STEP_READ_MS - 1500) {   // tried again before reading the step: nothing new
        p.fb = stepFb(p, q, typed, steps, "read");
        return;
    }
    if (p.sp < steps.length) {   // the next step
        p.sp++; p.su = Date.now(); if (last) last.sp = p.sp;
        p.fb = stepFb(p, q, typed, steps, "step");
        return;
    }
    // Every step used and still not it: show the answer and move on.
    if (last) last.sp = p.sp;
    p.fb = { q: p.qn, ok: false, y: typed, a: q.a, plus: 0, x2: [], box: null, second: 1, steps: p.sp, allsteps: 1, sp: steps.slice(0, p.sp) };
    p.rt = -1; nextQ(p); missRow(p, false);
}

/* ---------- slow down guessing: 2 misses in a row means a short wait ---------- */
const COOL_S = 15;
function missRow(p, ok) {
    if (ok) { p.ms = 0; return; }
    p.ms = (p.ms || 0) + 1;
    if (H.opts.slow !== false && p.ms >= 2) { p.cd = Date.now() + COOL_S * 1000; p.ms = 0; }
}

/* ---------- exit ticket: the class's most-missed questions, no coins and no hacks ---------- */
const EXIT_N = 3;
const exitN = (i) => 200000 + (H.exit ? H.exit.k : 0) * 10 + i;   // question numbers no regular question uses
/** The questions for the exit ticket: the most missed first, then the ones the class got right least often. */
function exitPick() {
    const missed = missedList().map((x) => x.qi);
    const rest = (H.qst || []).map((st, qi) => ({ qi, r: st.n ? st.ok / st.n : 1 })).filter((x) => !missed.includes(x.qi)).sort((a, b) => a.r - b.r).map((x) => x.qi);
    return missed.concat(rest).slice(0, Math.min(EXIT_N, H.qs.length));
}
function startExit() {
    if (!H || H.status !== "done") return;
    H.exit = { k: ((H.exit && H.exit.k) || 0) + 1, qis: exitPick(), res: {}, at: Date.now(), done: 0 };
    H.review = null; H.redo = H.redo && !H.redo.done ? null : H.redo; H.status = "play"; H.ends = 0; H.bonus = 0; H.show = null; H.paused = 0;
    feed("Exit ticket", "start"); flush(everyone()); saveSoon(true); panelSig = ""; drawLivePanel(true);
}
function exitAnswer(id, p, a) {
    const ex = H.exit, mine = ex.res[id] = ex.res[id] || [], i = mine.length;
    if (i >= ex.qis.length || +a.q !== exitN(i)) return;
    const q = H.qs[ex.qis[i]], typed = String(a.t || "").slice(0, 80);
    mine.push({ ok: V.sameAnswer(typed, q.a, q.al) ? 1 : 0, y: typed.slice(0, 40) });
    p.fb = { q: exitN(i), ok: true, y: typed, a: "", plus: 0, x2: [], box: null, exit: 1, last: mine.length >= ex.qis.length ? 1 : 0 };
}
function exitView(id) {
    const ex = H.exit, mine = ex.res[id] || [], i = mine.length;
    if (i >= ex.qis.length) return { done: 1, of: ex.qis.length };
    const q = H.qs[ex.qis[i]];
    return { i, of: ex.qis.length, q: { n: exitN(i), c: "Exit ticket", t: q.q, f: F.formOf(q), ch: q.ch || null } };
}
function finishExit() {
    const ex = H && H.exit; if (!ex || ex.done) return;
    ex.done = 1; ex.end = Date.now(); H.status = "done";
    flush(everyone()); saveSoon(true); panelSig = ""; dtab = "report"; drawLivePanel(true);
}
/** Each student's exit ticket: [{ id, nm, ok, of, done }], lowest scores first. */
function exitRows() {
    const ex = H.exit; if (!ex) return [];
    return Object.keys(H.players).map((id) => { const r = ex.res[id] || []; return { id, nm: H.players[id].nm, av: H.players[id].av, ok: r.filter((x) => x.ok).length, n: r.length, of: ex.qis.length, list: r }; })
        .sort((a, b) => (a.n === a.of ? 0 : 1) - (b.n === b.of ? 0 : 1) || a.ok - b.ok || a.nm.localeCompare(b.nm));
}
function exitPanel(p, live) {
    const ex = H.exit, rows = exitRows(), fin = rows.filter((r) => r.n >= r.of).length;
    p.append(hd(live ? "Exit ticket" : "Exit ticket results"));
    const ol = el("ol", "vrexitqs"); ex.qis.forEach((qi, i) => { const li = el("li"); li.append(mathEl("span", null, H.qs[qi].q)); const n = rows.filter((r) => r.list[i]).length, ok = rows.filter((r) => r.list[i] && r.list[i].ok).length; li.append(el("small", null, n ? " · " + ok + " of " + n + " right" : "")); ol.append(li); }); p.append(ol);
    p.append(el("p", "gpnote", fin + " of " + rows.length + " finished. No coins, no hacks, and students don't see right or wrong."));
    const box = el("div", "gprows");
    rows.forEach((r) => {
        const row = el("div", "gprow vrprow" + (r.n >= r.of && r.ok <= Math.floor(r.of / 2) ? " vrexitlow" : ""));
        row.append(el("span", "gpname", V.avatar(r.av)[0] + " " + r.nm), el("small", "vrla", r.n < r.of ? (live ? "working… " : "didn't finish · ") + r.n + " of " + r.of : r.ok + " of " + r.of + " right"));
        box.append(row);
    });
    if (live) p.append(btn("btn go", "Finish the exit ticket", finishExit));
    p.append(box);
    if (!live) { const low = rows.filter((r) => r.n >= r.of && r.ok <= Math.floor(r.of / 2)); if (low.length) p.append(el("p", "gpnote", "Pull for help: " + low.map((r) => r.nm).join(", "))); }
}

/* ---------- the heat map: every student's answers as green and red squares ---------- */
const HEAT_COLS = 12;
/** Students in the order they joined, each with their last answers: "ok", "fx" (right on the second try) or "no". */
function heatRows() {
    return Object.keys(H.players).map((id) => Object.assign({ id }, H.players[id])).sort((a, b) => (a.at || 0) - (b.at || 0)).map((p, i) => {
        const cells = (p.lg || []).slice(-HEAT_COLS).map((x) => (x.ok ? "ok" : x.fx ? "fx" : "no"));
        const tail = (p.lg || []).slice(-3);
        return { id: p.id, i, nm: p.nm, av: p.av, cells, r: p.r, n: p.n, stuck: tail.length === 3 && tail.every((x) => !x.ok && !x.fx) };
    });
}
function heatGrid(rows, names, teacher) {
    const g = el("div", "vrheat" + (teacher ? " remote" : ""));
    if (!rows.length) { g.append(el("p", "vrempty", "Waiting for players.")); return g; }
    rows.forEach((r) => {
        const row = el("div", "vrhrow" + (teacher && r.stuck ? " stuck" : ""));
        row.append(el("span", "vrhname", names ? V.avatar(r.av)[0] + " " + r.nm : "Player " + (r.i + 1)));
        const cells = el("span", "vrhcells");
        for (let i = 0; i < HEAT_COLS; i++) { const k = r.cells[i]; const c = el("i", "vrhc" + (k ? " " + k : ""), k === "ok" ? "✓" : k === "fx" ? "↻" : k === "no" ? "✗" : ""); cells.append(c); }
        row.append(cells, el("small", "vrhpct", r.n ? pctOf(r.r, r.n) + "%" : "–"));
        if (teacher && r.stuck) row.append(el("b", "vrhstuck", "Stuck"));
        g.append(row);
    });
    return g;
}
/** What the board shows, picked on the Remote: the scores, the heat map, or one student's work. Only one at a time. */
function setHeat(on, names) {
    H.heat = { on: !!on, names: !!names };
    if (on) { H.show = null; H.review = null; }
    boardNow();
}
function boardNow() {
    rev++; panelSig = "";
    if (hosting && running()) saveSoon(true);
    else A.store().save("games/room", clean(H)).catch((e) => { note = "Could not update the board (" + ((e && e.code) || "connection") + ")."; });
    A.redraw(); drawLivePanel(true);
}

/* ---------- power-ups ---------- */
const bonusOn = () => (+H.bonus || 0) > Date.now();
/** Catch-up boost: after the first minute, the bottom quarter of the leaderboard earns half again on a right answer. Only that student sees it. */
function comebackRank(rank, order) { return H.opts.comeback !== false && H.status === "play" && !H.redo && !H.exit && Date.now() - (+H.t0 || 0) >= V.COMEBACK_AFTER && !!order.length && V.comebackOn(rank, order.length, (order[rank - 1] || {}).c, order[0].c); }
function comeback(id) { const order = ranked(), i = order.findIndex((x) => x.id === id); return i >= 0 && comebackRank(i + 1, order); }
/** A mystery box takes effect as soon as it is earned; the student's screen only shows what was in it. */
function openBox(p, b) {
    if (b.k === "bag") p.c += b.v;
    else if (b.k === "hack") p.h = Math.min(V.MAX_HACKS + 1, p.h + 1);
    else if (b.k === "double") p.dbl = (p.dbl || 0) + b.v;
    else if (b.k === "firewall") p.sh = Math.max(+p.sh || 0, Date.now()) + b.v * 1000;
    else if (b.k === "dj") p.dj = (+p.dj || 0) + 1;
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
const lockOn = () => (+H.lock || 0) > Date.now();
/** A Tax on this player that still counts: the player who set it, or null. */
function taxOn(p) { const t = p.tax; return t && t.until > Date.now() && P(t.by) ? P(t.by) : null; }
/* Teacher moves during a game (the Remote's Game events). Each one shows on the board and on every screen. */
function startLock() { if (!H || H.status !== "play" || lockOn()) return; H.lock = Date.now() + V.LOCK_MS; feed("Lockdown! No hacking or sabotage for 60 seconds. Answer questions!", "event"); flush(everyone()); saveSoon(true); }
function keyDrop() {
    if (!H || H.status !== "play") return;
    Object.values(H.players).forEach((p) => { p.h = Math.min(V.MAX_HACKS + 1, (+p.h || 0) + 1); });
    feed("Key drop! Everyone gets a hack.", "event"); flush(everyone()); saveSoon(true);
}
function mysteryDrop() {
    if (!H || H.status !== "play") return;
    Object.values(H.players).forEach((p) => { p.mb = 1; });
    feed("Mystery drop! Your next right answer opens a mystery box.", "event"); flush(everyone()); saveSoon(true);
}
function codeReset() {
    if (!H || H.status !== "play") return;
    Object.values(H.players).forEach((p) => { p.code = ""; p.g = {}; p.spy = {}; p.sh = 0; });
    feed("Alarm! Every vault code was reset. Pick a new code.", "event"); flush(everyone()); saveSoon(true);
}
function shoutOut(id) {
    const p = P(id); if (!p || !H || H.status !== "play") return;
    p.c += V.SHOUT_COINS; p.so = { at: Date.now(), v: V.SHOUT_COINS };
    feed("Shout-out from your teacher: " + p.nm + " +" + V.SHOUT_COINS, "shout"); flush(new Set([id, "room"])); saveSoon(true);
}
/* ---------- Class Treasure and DJ Tickets ---------- */
/** One more right answer for the whole class. Reaching the goal unlocks the treasure on the board. */
function classRight() {
    H.tr = (+H.tr || 0) + 1;
    const g = V.classGoal(H.opts.goal, Object.keys(H.players).length);
    if (g && !H.goalHit && H.tr >= g) { H.goalHit = Date.now(); feed("Class Treasure unlocked! " + g + " right answers together!", "goal"); }
}
function setGoal(v) {
    H.opts.goal = v; const g = V.classGoal(v, Object.keys(H.players).length);
    if (!g || (+H.tr || 0) < g) H.goalHit = 0; else if (!H.goalHit) { H.goalHit = Date.now(); feed("Class Treasure unlocked! " + g + " right answers together!", "goal"); }
    saveSoon(true); panelSig = ""; drawLivePanel(true);
}
/** A student picks the song with a DJ Ticket (or buys one pick with coins). */
function djPick(id, p, k) {
    const now = Date.now(), s = V.song(k), hold = H.dj && !H.dj.t ? (+H.dj.at || 0) + V.DJ_HOLD_MS - now : 0, no = (why) => { p.sbr = { n: p.ssb, ok: 0, k: "dj", why }; };
    if (H.status !== "play" || H.redo || H.exit || H.paused) no("You can't pick a song right now.");
    else if (H.opts.dj === false) no("DJ Tickets are off in this game.");
    else if (H.opts.djlock) no("Your teacher locked the music for now.");
    else if (H.dj && H.dj.k === k) no(s[1] + " is already playing.");
    else if (hold > 0) no("A new song can start in " + Math.ceil(hold / 1000) + " s.");
    else if (!(+p.dj > 0) && p.c < V.DJ_COST) no("You need a DJ Ticket or " + V.DJ_COST + " coins.");
    else {
        const paid = +p.dj > 0 ? "ticket" : "coins";
        if (paid === "ticket") p.dj--; else p.c -= V.DJ_COST;
        H.dj = { k, nm: p.nm, by: id, at: now };
        p.sbr = { n: p.ssb, ok: 1, k: "dj", song: k, paid };
        feed("🎧 " + p.nm + " picked " + s[1], "dj"); flush(everyone()); saveSoon(true);
    }
}
function giveDj(id) {
    const p = P(id); if (!p || !H || H.status !== "play") return;
    p.dj = (+p.dj || 0) + 1; p.djg = { at: Date.now() };
    feed("🎧 Your teacher gave " + p.nm + " a DJ Ticket", "dj"); flush(new Set([id, "room"])); saveSoon(true);
}
/** The teacher picks the song. It plays right away (no wait) and starts a fresh hold for the students. */
function teacherSong(k) {
    if (!H || !V.song(k)) return;
    H.dj = { k, nm: "", at: Date.now(), t: 0 };
    feed("🎧 Now playing: " + V.song(k)[1], "dj"); flush(everyone()); saveSoon(true); panelSig = ""; drawLivePanel(true);
}
function setDjLock(on) { H.opts.djlock = on; flush(everyone()); saveSoon(true); panelSig = ""; drawLivePanel(true); }
function setDj(on) { H.opts.dj = on; flush(everyone()); saveSoon(true); panelSig = ""; drawLivePanel(true); }
function setSab(on) { H.opts.sab = on; feed(on ? "Sabotages are on." : "Sabotages are off.", "event"); flush(everyone()); saveSoon(true); panelSig = ""; drawLivePanel(true); }
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
    const t = Math.max(0, Math.min(900, Math.round((Date.now() - (+p.qt || Date.now())) / 1000)));   // seconds on this question before the first try
    p.lg = (p.lg || []).concat([ok ? { i: qi, ok: 1, t } : { i: qi, ok: 0, y: String(typed || "").trim().slice(0, 40), t }]).slice(-80);
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
    H.review = qi == null ? null : { qi, ans: !!ans }; if (qi != null && H.heat) H.heat.on = false; rev++; panelSig = "";
    A.store().save("games/room", clean(H)).catch((e) => { note = "Could not update the board (" + ((e && e.code) || "connection") + ")."; });
    A.redraw(); drawLivePanel(true);
}

function sendErr(id, msg) { A.store().rooms.save("rooms/" + H.code + "/s/" + id, { n: Date.now(), err: msg, status: H.status }).catch(() => {}); }

/** What one student's device is allowed to see. */
function view(id, order) {
    const p = P(id), rank = order.findIndex((x) => x.id === id) + 1;
    const rd = H.redo && !H.redo.done ? H.redo : null, rq = rd ? H.qs[rd.qi] : null, ex = H.exit && !H.exit.done ? H.exit : null;
    const q = rd ? null : H.status === "play" && p.code ? qOf(p, p.qn) : null;
    p.sn = (p.sn || 0) + 1; p.top = Math.max(+p.top || 0, p.c);
    return { n: p.sn, status: H.status, title: H.title, nm: p.nm, c: p.c, h: p.h, st: p.st, r: p.r, of: p.n, rank, players: order.length, ends: H.ends || 0,
        av: p.av, lk: p.lk || "", pu: p.pu || "", dbl: p.dbl || 0, blk: p.blk || 0, ins: p.ins || 0, fw: (+p.sh || 0) > Date.now() && p.code ? +p.sh : 0, bonus: +H.bonus || 0,
        lock: +H.lock || 0, sab: H.opts.sab !== false ? 1 : 0, sbc: +p.sbc || 0, fog: +p.fog || 0, jam: +p.jam || 0, tax: taxOn(p) ? 1 : 0, mb: p.mb ? 1 : 0, sbr: p.sbr || null, sbh: p.sbh || null, so: p.so || null,
        dj: +p.dj || 0, djon: H.opts.dj !== false ? 1 : 0, djlock: H.opts.djlock ? 1 : 0, song: H.dj ? { k: H.dj.k, nm: H.dj.nm || "", at: +H.dj.at || 0 } : null, djg: p.djg || null,
        vs: p.vs || 0, top: p.top, cb: (p.cbv = comebackRank(rank, order) ? 1 : 0), code: p.code, need: rd || ex ? false : !p.code, exit: ex ? exitView(id) : null, cd: +p.cd || 0, q: ex ? null : rd ? (rd.res[id] ? null : { n: redoN(), c: rq.c, t: rq.q, f: F.formOf(rq), ch: rq.ch || null }) : q ? { n: p.qn, c: q.c, t: q.q, f: F.formOf(q), ch: q.ch || null } : null, redo: rd ? 1 : 0, best: p.best, cr: p.cr, fb: p.fb, hk: p.hk, hit: p.hit,
        targets: order.filter((x) => x.id !== id).map((x) => ({ id: x.id, nm: x.nm, av: x.av, lk: x.lk || "", vs: x.vs || 0, c: x.c, sh: shielded(x) ? 1 : 0, g: p.g[x.id] || [], sbs: (+x.sbs || 0) > Date.now() ? 1 : 0, spy: (p.spy || {})[x.id] ? V.spyShow(x.code, p.spy[x.id]) : "" })),
        res: H.status === "done" ? results(p) : null,
        // profile: their own level, XP, banked coins and next lock (never anyone else's), what they can wear, and the comeback tools
        pf: livePf(p), plk: p.plk || null, avo: avOpen(p), sko: skOpen(p), gr: profOn() && !p.gr ? 1 : 0, bsp: +p.bsp || 0, bkr: p.bkr || null };
}
/** A student's own results for their screen after the game: each question they answered, what they wrote when it was wrong, and the answer. */
function results(p) {
    return (p.lg || []).slice(-40).map((x) => { const q = H.qs[x.i]; return q ? (x.ok ? { t: String(q.q).slice(0, 200), ok: 1 } : { t: String(q.q).slice(0, 200), ok: 0, y: x.y || "", a: String(q.a).slice(0, 80) }) : null; }).filter(Boolean);
}
function flush(sends) {
    if (!sends.size) return;
    const order = ranked(), list = [];
    // The catch-up badge follows the leaderboard: tell anyone whose boost just turned on or off.
    order.forEach((x, i) => { const on = comebackRank(i + 1, order) ? 1 : 0; if (on !== (H.players[x.id].cbv || 0)) sends.add(x.id); });
    if (sends.has("room")) list.push({ path: "rooms/" + H.code, data: roomDoc(), merge: false });
    sends.forEach((id) => { if (id !== "room" && P(id)) list.push({ path: "rooms/" + H.code + "/s/" + id, data: view(id, order) }); });
    A.store().rooms.many(list).catch((e) => { note = "Could not reach the students' devices (" + ((e && e.code) || "connection") + ")."; panelSig = ""; });
    changed(false);
}
const everyone = () => { const s = new Set(Object.keys(H.players)); s.add("room"); return s; };
function roomDoc() {
    return { owner: A.store().rooms.uid(), status: H.status, title: H.title, per: H.per || "", mode: H.mode, names: H.mode === "roster" ? H.names : [], taken: H.taken || [],
        live: !!H.opts.live, work: H.opts.work !== false, ends: H.ends || 0, bonus: +H.bonus || 0, lock: +H.lock || 0, sab: H.opts.sab !== false, paused: +H.paused || 0, snd: H.opts.snd !== false, call: H.status === "play" && H.show ? H.show.id : "",
        rw: H.status === "play" && H.redo && !H.redo.done && redoWork && redoWork.k === H.redo.k ? { k: redoWork.k, img: redoWork.img, w: redoWork.w, h: redoWork.h, fw: redoWork.fw } : null, at: Date.now() };
}

/* ---------- teacher moves ---------- */
async function openRoom() {
    const meta = (SETS || []).find((s) => s.id === choice.set); if (!meta || busy) return;
    busy = "open"; note = ""; panelSig = ""; drawLivePanel(true);
    if (FB) fbOff();   // Vault Raid takes the board
    try {
        const set = await A.store().rooms.get("teacher/" + A.store().rooms.uid() + "/games/s_" + meta.id);
        const qs = []; ((set && set.cats) || []).forEach((c) => (c.clues || []).forEach((k) => { if (k && k.q && k.a) qs.push(Object.assign(V.gameQuestion(k, c.n), F.fmOf(k))); }));   // fm: an ACAP format (js/acapFormats.js)
        if (set && set.final && set.final.q && set.final.a) qs.push(V.gameQuestion(set.final, set.final.c || "Final"));
        if (qs.length < 3) throw new Error("That set needs at least 3 questions.");
        const roster = (A.rosters()[A.S.period] || []).filter(Boolean), names = choice.names === "roster" ? V.shortNames(roster) : [];
        if (choice.names === "roster" && !names.length) throw new Error("There is no class list for " + A.S.period + " period. Add one on the Rosters page, or let students type a name.");
        let code = "";
        for (let i = 0; i < 6 && !code; i++) { const c = V.newRoomCode(); try { if (!(await A.store().rooms.get("rooms/" + c))) code = c; } catch (e) { code = c; } }
        if (!code) throw new Error("Could not find a free game code. Try again.");
        keepSet(A.S.period, meta.id);   // the set a game was played with is this period's pick next time
        H = { v: 1, code, status: "lobby", title: set.title || meta.title || "Review", setId: meta.id, per: A.S.period, qs, mode: choice.names, names, taken: [],
            opts: { mins: choice.mins, board: choice.board, save: choice.save, live: choice.live, work: choice.work, retry: choice.retry, steps: choice.steps, slow: choice.slow, snd: choice.snd, comeback: choice.comeback, sab: choice.sab, dj: choice.dj, goal: choice.goal, prof: choice.prof }, paused: 0, exit: null, heat: { on: false, names: false }, redo: null, players: {}, qst: qs.map(() => ({ n: 0, ok: 0, w: [] })), review: null, feed: [], show: null, ends: 0, t0: 0, rid: "", saved: false,
            host: PAGE, hb: Date.now(), at: Date.now() };
        await A.store().rooms.save("rooms/" + code, roomDoc());
        if (H.opts.prof !== false) { try { PF = await loadKids(A.store().rooms, H.per); } catch (e) { PF = {}; } pfFor = code; }
        hosting = true; loaded = true; await A.store().save("games/room", clean(H)); takeHost(); tab = "players";
    } catch (e) { note = (e && e.message && !e.code ? e.message : "Could not open the room (" + ((e && e.code) || "connection") + ")."); H = null; hosting = false; }
    busy = ""; panelSig = ""; rev++; A.redraw();
}
function startGame() {
    if (!H || H.status !== "lobby") return;
    H.status = "play"; H.t0 = Date.now(); H.ends = H.opts.mins ? H.t0 + H.opts.mins * 60000 : 0; feed("Game on!", "start"); applyStarters();
    Object.values(H.players).forEach((p) => { p.qt = H.t0; });
    flush(everyone()); saveSoon(true);
}
function endGame() {
    if (!H || H.status !== "play") return;
    H.status = "done"; H.show = null; endArm = 0; feed("Game over", "end");
    flush(everyone()); saveSoon(true);
    if (H.opts.save) saveResults();
    saveProfiles();
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
        await saveProgress();
    } catch (e) { note = "Could not save to Class Data (" + ((e && e.code) || "connection") + ")."; }
    busy = ""; changed(true); drawLivePanel(true);
}
/* ---------- Student Progress: the effort record that used to vanish when the room closed ----------
   Saved only when the teacher saves results (the same "Save results to Class Data" choice), to
   teacher/{uid}/progress/g_<rid>, with an entry in progress/index. Names are the game names (first name +
   last initial), never more. Each answer is "question:result:seconds:steps" (Firestore keeps no lists in lists). */
function progressDoc() {
    const sends = (H.rdl || []).concat(H.redo && H.redo.res ? [{ qi: H.redo.qi, res: H.redo.res }] : []);
    const st = Object.keys(H.players).map((id) => {
        const p = H.players[id], ex = H.exit && H.exit.res && H.exit.res[id];
        return { s: p.nm, ta: +p.ta || (p.lg || []).length, r: p.r, n: p.n, best: p.best || 0, cr: p.cr || 0,
            mins: p.f0 && p.f1 ? Math.round((p.f1 - p.f0) / 6000) / 10 : 0,
            lg: (p.lg || []).map((x) => x.i + ":" + (x.ok ? 1 : x.fx ? 2 : 0) + ":" + (+x.t || 0) + ":" + (+x.sp || 0)),
            rd: sends.filter((x) => x.res && x.res[id]).map((x) => (x.res[id].ok ? 1 : 0)),
            ex: ex ? { ok: ex.filter((x) => x.ok).length, of: ex.length } : null };
    }).filter((x) => x.lg.length || x.rd.length || x.ex);
    const qs = H.qs.map((q, i) => { const t = (H.qst || [])[i] || { n: 0, ok: 0, w: [] }; return { q: String(q.q).slice(0, 160), a: String(q.a).slice(0, 60), c: q.c || "", n: t.n, ok: t.ok, w: t.w.slice().sort((a, b) => b.n - a.n).slice(0, 3) }; });
    const d = new Date(), day = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    return { id: H.rid, date: day, at: Date.now(), period: H.per, game: "Vault Raid", title: H.title, setId: H.setId || "", qs, st };
}
async function saveProgress() {
    if (!H || !H.rid) return;
    try {
        const doc = progressDoc(); if (!doc.st.length) return;
        await A.store().save("progress/g_" + doc.id, doc);
        const ix = await A.store().rooms.get("teacher/" + A.store().rooms.uid() + "/progress/index");
        const games = ((ix && ix.games) || []).filter((x) => x && x.id !== doc.id).concat([{ id: doc.id, date: doc.date, period: doc.period, title: doc.title, n: doc.st.length }]).slice(-2000);
        await A.store().save("progress/index", { games, at: Date.now() });
    } catch (e) { /* the game and its Class Data result are already saved; this extra record can wait for the next save */ }
}
async function closeRoom() {
    if (!H || busy) return; busy = "close"; panelSig = ""; drawLivePanel(true);
    const code = H.code;
    try {
        if (H.saved) await saveProgress();   // send-backs and exit tickets after the game: update the effort record before the room's data is deleted
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
    p.la.ok = true; p.r++; p.st = 1; classRight(); p.c += V.coinsFor(1); p.h = Math.min(V.MAX_HACKS, p.h + 1);
    if (p.fb && p.fb.q === p.la.q) p.fb = Object.assign({}, p.fb, { ok: true, a: "", plus: V.coinsFor(1), fixed: 1, retry: 0, step: 0, hint: "" });
    if (p.rt === p.qn && p.la.q === p.qn) { p.rt = -1; nextQ(p); }   // counted while they were on their second try: move them on
    flush(new Set([id]));
}
function setLive(on) { H.opts.live = on; flush(new Set(["room"])); saveSoon(true); }
function showWork(id, withName) {
    H.show = id ? { id, nm: !!withName } : null; if (id && H.heat) H.heat.on = false;
    if (hosting && running()) flush(new Set(["room"]));   // the room says who is on the board, so that screen sends its work live
    boardNow();
}
/** The "On the board" switch at the top of the Remote's game panel. */
function boardSwitch(p) {
    const now = H.show && P(H.show.id) ? "work" : H.heat && H.heat.on ? "heat" : "lead", row = el("div", "vrboardsw");
    row.append(el("small", null, "On the board now"));
    const seg = el("div", "vrtabs");
    [["lead", H.status === "done" ? "Final scores" : "Scores"], ["heat", "Heat map"]].concat(H.status === "play" ? [["work", "Student work"]] : []).forEach(([k, label]) => {
        const b = btn("btn " + (now === k ? "go" : "ghost"), label, () => {
            if (k === "lead") { H.show = null; if (H.heat) H.heat.on = false; H.review = null; boardNow(); }
            else if (k === "heat") setHeat(true, H.heat && H.heat.names);
            else { tab = "work"; panelSig = ""; drawLivePanel(true); }
        });
        b.setAttribute("aria-pressed", String(now === k)); seg.append(b);
    });
    row.append(seg);
    if (now === "work") row.append(el("small", "vrsub", "Showing " + (H.show.nm ? P(H.show.id).nm + "'s" : "a student's") + " work. Pick another in the Work tab."));
    else if (now === "heat") row.append(btn("btn ghost", H.heat.names ? "Heat map shows names (tap for anonymous)" : "Heat map is anonymous (tap to show names)", () => setHeat(true, !H.heat.names)));
    else if (H.status === "play") row.append(el("small", "vrsub", "To show work, open the Work tab and tap a student."));
    p.append(row);
}

/* ---------- each quarter second ---------- */
export function tickLive() {
    if (!A || !H) return;
    const c = document.getElementById("liveClock"), pc = document.getElementById("livePClock");
    const left = H.status === "play" && H.ends ? Math.max(0, H.ends - (H.paused || Date.now())) : -1;
    const txt = H.paused && H.status === "play" && left < 0 ? "Paused" : left < 0 ? (H.status === "play" ? "No time limit" : "") : (H.paused ? "Paused · " : "") + Math.floor(left / 60000) + ":" + ("0" + Math.floor((left % 60000) / 1000)).slice(-2);
    if (c) { c.textContent = txt.replace("Paused · ", ""); c.classList.toggle("hot", left >= 0 && left < 30000 && !H.paused); c.classList.toggle("paused", !!H.paused); }
    if (pc) pc.textContent = txt;
    const bl = H.bonus ? Math.max(0, +H.bonus - Date.now()) : 0, bb = document.getElementById("liveBonusBtn"), bs = document.getElementById("liveBonus");
    if (bb) { const l = bb.querySelector(".vrtl"), sub = bb.querySelector(".vrts"); if (l) l.textContent = bl ? "Bonus on" : "Bonus round"; if (sub) sub.textContent = bl ? Math.ceil(bl / 1000) + " s left" : "2× coins · 60 s"; bb.disabled = !!bl; bb.classList.toggle("on", !!bl); }
    if (bs) { bs.hidden = !bl; const t = bs.querySelector("b"); if (t) t.textContent = Math.ceil(bl / 1000) + " s"; }
    const crk = document.getElementById("liveCrack"); if (crk && Date.now() > +crk.dataset.until) crk.remove();
    if (hosting && H.status === "play" && H.ends && !H.paused && !(H.exit && !H.exit.done) && !(H.redo && !H.redo.done) && Date.now() >= H.ends) endGame();
    if (hosting && H.status === "play") stuckSteps();
    if (hosting && Date.now() - lastSave > 8000) saveSoon(true);   // check in, so another screen knows this one is running the game   // check in, so another Remote knows this one is running the game
    if (endArm && Date.now() - endArm > 4000) { endArm = 0; panelSig = ""; }
    if (resetArm && Date.now() - resetArm > 4000) { resetArm = 0; panelSig = ""; }
    const ll = H.lock ? Math.max(0, +H.lock - Date.now()) : 0, lb = document.getElementById("liveLockBtn"), ls = document.getElementById("liveLock");
    if (lb) { const sub = lb.querySelector(".vrts"), l = lb.querySelector(".vrtl"); if (l) l.textContent = ll ? "Lockdown on" : "Lockdown"; if (sub) sub.textContent = ll ? Math.ceil(ll / 1000) + " s left" : "No hacks or sabotage · 60 s"; lb.disabled = !!ll; lb.classList.toggle("on", !!ll); }
    if (ls) { ls.hidden = !ll; const t = ls.querySelector("b"); if (t) t.textContent = Math.ceil(ll / 1000) + " s"; }
    if (isRemote() && onLive() && Date.now() - panelAt > 1000) drawLivePanel(true);
}

/* ---------- going over missed questions on the whiteboard ----------
   After the game the board opens each missed question on the canvas-first whiteboard (js/boardApp.js),
   with the question on a card floating over the paper like the bellringer, so the teacher can work it out. */
/** The question being gone over, or null: { key (for the saved ink), qi, at, count, list (question numbers), title, ans }. */
/* ---------- the board's sound: the theme song's mood, and a sound for each big moment ---------- */
const FEED_CUES = { join: "join", start: "start", crack: "crack", block: "block", box: "box", bonus: "bonus", event: "bonus", shout: "box", goal: "win", dj: "pop", end: "win" };
let heardT = -1, lastPhase = "";
/** What the game sounds like right now: { phase: "" | lobby | play | rush | paused, cues: [names of moments that just happened] }. */
export function liveSound() {
    if (!H || !loaded) { heardT = -1; lastPhase = ""; return { phase: "", cues: [], song: "vault" }; }
    const t = Date.now(), ends = +H.ends || 0, calm = (H.exit && !H.exit.done) || (H.redo && !H.redo.done);
    const phase = H.status === "lobby" ? "lobby" : H.status !== "play" ? "" : H.paused ? "paused" : calm ? "lobby" : ends && ends > t && ends - t <= 30000 ? "rush" : "play";
    const feedList = H.feed || [], newest = feedList.reduce((m, f) => Math.max(m, +f.t || 0), 0), cues = [];
    if (heardT < 0) heardT = newest;   // just opened: don't replay old moments
    else {
        feedList.filter((f) => (+f.t || 0) > heardT && FEED_CUES[f.k]).slice(-3).forEach((f) => cues.push(FEED_CUES[f.k]));
        heardT = Math.max(heardT, newest);
        if (phase === "rush" && lastPhase === "play") cues.push("rush");
    }
    lastPhase = phase;
    return { phase, cues, song: H.dj && V.song(H.dj.k) ? H.dj.k : "vault" };
}
export function liveReview() {
    if (!H || !(H.status === "done" || (H.redo && !H.redo.done)) || !H.review || !H.qs || !H.qs[H.review.qi]) return null;
    if (H.status === "play" && H.show && P(H.show.id)) return null;   // a student is called up: their screen has the board
    const list = missedList(), at = list.findIndex((x) => x.qi === H.review.qi);
    return { key: "vr" + String(H.rid || H.code || "").replace(/\W/g, "") + "q" + H.review.qi, qi: H.review.qi, at, count: list.length, list: list.map((x) => x.qi), title: H.title || "Student Game", ans: !!H.review.ans };
}
/** Go to a missed question (null: back to the final scores), or show or hide its answer. Works from the board or the Remote. */
export function goReview(qi, ans) { ask("review", qi, ans); }
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
    const live = H.redo && !H.redo.done && H.redo.qi === r.qi, past = (H.redos || []).find((x) => x.qi === r.qi);
    if (live) { const rc = redoCount(), t = el("div", "vrwbredo"); t.append(el("b", null, "Trying it again"), el("span", null, rc.of + " of " + rc.n + " answered · " + rc.ok + " right")); body.append(t); }
    else if (past) { const t = el("div", "vrwbredo done"); t.append(el("b", null, "Second try: " + pctOf(past.ok, past.of) + "%"), el("span", null, past.ok + " of " + past.of + " right (first try " + pctOf(st.ok, st.n) + "%)")); body.append(t); }
    if (r.ans && !live) body.append(mathEl("p", "wbans", q.a));
    const row = el("div", "vrwbbtns");
    if (live) { row.append(btn("btn go", "Stop and show the results", () => ask("finish"))); body.append(row); return; }
    row.append(btn("btn ghost", "Send it back with my work", () => ask("send", r.qi)), btn("btn ghost", "Send it back blank", () => ask("send", r.qi, true)));
    row.append(btn("btn ghost", r.ans ? "Hide answer" : "Show answer", () => ask("review", r.qi, !r.ans)));
    if (r.at + 1 < r.count) row.append(btn("btn go", "Next question", () => ask("review", r.list[r.at + 1])));
    else row.append(btn("btn go", "Done: final scores", () => ask("review", null)));
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

/* ---------- the board's crack moment: a vault door that unlocks and swings open ----------
   Built from layered HTML and CSS (no images): a steel frame, a thick round door in the
   cracked student's skin, a spoked wheel that spins, locking bolts that pull back, the
   door swinging on its hinge, and gold inside with coins flying out. A Shield block
   jams the wheel instead. Redraws resume mid-animation (a negative delay). */
const CRACK_MS = 4600, crackSeen = {};
function vaultScene(last, since) {
    const block = last.k === "block", k = V.skin(last.vs)[3], o = el("div", "vrcrack vx" + (block ? " block" : ""));
    o.style.setProperty("--el", (-since / 1000).toFixed(2) + "s"); o.style.setProperty("--skd", k.door); o.style.setProperty("--skr", k.ring);
    const scene = el("div", "vxscene"), frame = el("div", "vxframe");
    for (let i = 0; i < 4; i++) frame.append(el("i", "vxhinge h" + i));
    const inside = el("div", "vxin");
    inside.innerHTML = '<svg viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="vxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7A0"/><stop offset=".5" stop-color="#F2B33D"/><stop offset="1" stop-color="#A86F00"/></linearGradient></defs>'
        + '<rect x="30" y="98" width="140" height="6" rx="2" fill="#3A4A6B"/><rect x="30" y="150" width="140" height="6" rx="2" fill="#3A4A6B"/>'
        + [[44, 76], [80, 76], [116, 76], [62, 60], [98, 60], [50, 128], [86, 128], [122, 128], [68, 112], [104, 112]].map(([x, y]) => '<path d="M' + x + " " + (y + 22) + "l6-18h22l6 18z" + '" fill="url(#vxg)" stroke="#8A5F00" stroke-width="1.2"/>').join("")
        + '</svg>';
    const door = el("div", "vxdoor"), face = el("div", "vxface"), edge = el("div", "vxedge");
    for (let i = 0; i < 8; i++) { const b = el("i", "vxbolt"); b.style.setProperty("--a", (i * 45) + "deg"); face.append(b); }
    for (let i = 0; i < 16; i++) { const r = el("i", "vxrivet"); r.style.setProperty("--a", (i * 22.5) + "deg"); face.append(r); }
    const wheel = el("div", "vxwheel");
    wheel.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="vxw" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#C9D3E3"/><stop offset="1" stop-color="#55627F"/></radialGradient></defs>'
        + [0, 60, 120].map((a) => '<rect x="46" y="4" width="8" height="92" rx="4" fill="url(#vxw)" stroke="#2A3550" stroke-width="1.5" transform="rotate(' + a + ' 50 50)"/>').join("")
        + [0, 60, 120, 180, 240, 300].map((a) => '<circle cx="50" cy="6" r="6" fill="url(#vxw)" stroke="#2A3550" stroke-width="1.5" transform="rotate(' + a + ' 50 50)"/>').join("")
        + '<circle cx="50" cy="50" r="17" fill="url(#vxw)" stroke="#2A3550" stroke-width="2"/><circle cx="50" cy="50" r="6" fill="#2A3550"/></svg>';
    face.append(el("i", "vxring r1"), el("i", "vxring r2"), wheel, el("i", "vxdial"));
    door.append(edge, face);
    frame.append(inside, door);
    scene.append(el("i", "vxglow"), frame);
    if (block) { const sh = el("div", "vxshield"); sh.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 8l44 16v32c0 30-20 50-44 58C36 106 16 86 16 56V24z" fill="#7FAEDD" stroke="#fff" stroke-width="4"/><path d="M60 22l30 11v23c0 21-13 35-30 42z" fill="#10358A"/></svg>'; scene.append(sh); }
    else {
        const coins = el("div", "vxcoins");
        for (let i = 0; i < 18; i++) {
            const c = el("i", "vxcoin"), ang = -70 + (i * 140 / 17) + (i % 3) * 4, dist = 9 + (i % 4) * 2.6;
            c.style.setProperty("--dx", (Math.sin(ang * Math.PI / 180) * dist).toFixed(2) + "em");
            c.style.setProperty("--dy", (-Math.cos(ang * Math.PI / 180) * dist * 0.75 - 2).toFixed(2) + "em");
            c.style.setProperty("--d", (1.75 + (i % 6) * 0.06).toFixed(2) + "s"); c.style.setProperty("--r", (360 + i * 47) + "deg");
            coins.append(c);
        }
        scene.append(coins);
    }
    o.append(scene);
    return o;
}
/** A small round vault in the student's skin, for the board's leaderboard. */
function skinDot(p) { const k = V.skin(p.vs), d = el("i", "vrskin" + (k[3].stars ? " stars" : "") + (k[3].shine ? " shine" : "")); d.style.setProperty("--skd", k[3].door); d.style.setProperty("--skr", k[3].ring); d.title = k[1] + " vault"; d.setAttribute("aria-hidden", "true"); return d; }
/* ---------- the Deep Dive board: a timing tower beside an ocean where every diver sinks toward the treasure ----------
   Redraws rebuild the stage, so motion is carried across them: rows slide from where they were, divers glide
   from their last depth, and the looping water (bubbles, light, seaweed) keeps its place in time. */
const tower = { y: {}, rank: {}, up: {}, lead: "", leadAt: 0 }, diveY = {};
/** A looping animation that keeps its phase across redraws: start it part way through, by the clock. */
const loopAt = (e, ms, off = 0) => { e.style.animationDelay = -((Date.now() + off) % ms) + "ms"; e.style.animationDuration = ms + "ms"; return e; };
const boardName = (p, i) => (H.opts.board ? p.nm : "Player " + (i + 1));
function towerEl(order) {
    const lead = el("div", "vrlead vrtower"), now = Date.now(), shown = order.slice(0, 8);
    lead.append(el("p", "vrlab", "Deepest divers"));
    if (!order.length) lead.append(el("p", "vrempty", "Waiting for players."));
    const rows = [];
    shown.forEach((p, i) => {
        const was = tower.rank[p.id]; if (was != null && i < was) tower.up[p.id] = { n: was - i, at: now };
        tower.rank[p.id] = i;
        const up = tower.up[p.id] && now - tower.up[p.id].at < 8000 ? tower.up[p.id].n : 0;
        const r = el("div", "vrrow" + (i === 0 ? " vrfirst" : "") + (up ? " vrclimb" : "")); r.dataset.id = p.id;
        const nm = el("span", "vrname"); nm.append(el("span", "vrnmtxt", (H.opts.board ? V.avatar(p.av)[0] + " " : "") + boardName(p, i)));
        if ((+p.st || 0) >= 3) { const f = el("i", "vrhot", "🔥"); f.title = p.st + " right in a row"; nm.append(f); }
        r.append(el("b", "vrrank", String(i + 1)), nm, el("b", "vrcoins", p.c + ""));
        if (up) r.append(el("span", "vrup", "↑" + up));
        lead.append(r); rows.push(r);
    });
    order.slice(8).forEach((p, i) => { tower.rank[p.id] = 8 + i; });
    if (order.length > 8) lead.append(el("p", "vrmore", "+ " + (order.length - 8) + " more " + (order.length - 8 === 1 ? "diver" : "divers") + " on the way down"));
    // Slide each row from where it sat last time (once it is on the page).
    requestAnimationFrame(() => rows.forEach((r) => {
        const id = r.dataset.id, y = r.offsetTop, old = tower.y[id]; tower.y[id] = y;
        if (old != null && old !== y && r.animate) r.animate([{ transform: "translateY(" + (old - y) + "px)" }, { transform: "none" }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" });
    }));
    const first = order[0] ? order[0].id : "";
    if (first !== tower.lead) { if (tower.lead && first) tower.leadAt = now; tower.lead = first; }
    return lead;
}
function seaEl(order) {
    const sea = el("div", "vrsea"), now = Date.now(), top = order.length ? order[0].c : 0, scale = V.depthScale(top);
    sea.setAttribute("role", "img"); sea.setAttribute("aria-label", "Deep Dive: each diver sinks deeper as they earn coins");
    for (let i = 0; i < 3; i++) { const r = loopAt(el("i", "vrray r" + i), 9000 + i * 2300, i * 1700); sea.append(r); }
    for (let i = 0; i < 12; i++) { const b = el("i", "vrbub"); b.style.left = ((i * 37) % 100) + "%"; b.style.setProperty("--bs", (0.35 + ((i * 7) % 5) * 0.12) + "em"); loopAt(b, 7000 + ((i * 1300) % 5000), i * 900); sea.append(b); }
    // Depth marks down the left side, in coins.
    const marks = el("div", "vrmarks"); [0.25, 0.5, 0.75, 1].forEach((f) => { const m = el("span", null, Math.round(scale * f) + ""); m.style.top = (6 + 70 * f) + "%"; marks.append(m); }); sea.append(marks);
    // The sea floor: sand, seaweed that sways, and the class's treasure chest.
    const floor = el("div", "vrfloor");
    floor.innerHTML = '<svg viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 Q 50 14 100 26 T 200 24 T 300 28 T 400 22 V60 H0z" fill="#C9A86A"/><path d="M0 40 Q 60 30 120 38 T 260 36 T 400 34 V60 H0z" fill="#B48F52"/></svg>';
    [6, 14, 82, 92].forEach((x, i) => { const w = loopAt(el("i", "vrweed"), 4200 + i * 600, i * 800); w.style.left = x + "%"; w.style.setProperty("--wh", (2.4 + (i % 2) * 1.2) + "em"); floor.append(w); });
    floor.append(treasureEl()); sea.append(floor);
    // Divers: the top 8, each in a lane that never changes (by when they joined), as deep as their coins.
    const shown = order.slice(0, 8), lanes = shown.slice().sort((a, b) => (a.at || 0) - (b.at || 0) || (a.id < b.id ? -1 : 1));
    lanes.forEach((p, li) => {
        const i = shown.indexOf(p), y = 5 + 64 * Math.min(1, p.c / scale), x = shown.length === 1 ? 50 : 14 + li * (76 / (shown.length - 1));
        const d = el("div", "vrdiver" + (i === 0 && p.c > 0 ? " lead" : "") + ((+p.st || 0) >= 3 ? " hot" : "") + ((+p.fog || 0) > now ? " inked" : "") + (li % 2 && !(i === 0 && p.c > 0) ? " tagup" : ""));
        d.style.left = x + "%"; d.style.top = y + "%";
        const k = V.skin(p.vs)[3], bob = loopAt(el("div", "vrbob"), 3200 + li * 260, li * 500);
        bob.innerHTML = '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M8 26c0-12 10-20 24-20s24 8 24 20-10 20-24 20S8 38 8 26z" fill="' + k.door + '" stroke="' + k.ring + '" stroke-width="3"/><rect x="28" y="0" width="7" height="9" rx="2" fill="' + k.ring + '"/><path d="M56 22l7-5v18l-7-5z" fill="' + k.ring + '"/><circle cx="30" cy="26" r="12" fill="#E8F6FF" stroke="' + k.ring + '" stroke-width="3"/></svg>';
        const port = el("span", "vrport" + (H.opts.board && p.lk ? " bdport" : ""));
        if (H.opts.board && p.lk) port.innerHTML = Buddy.svg(p.lk, { face: true, size: 40 }); else port.textContent = H.opts.board ? V.avatar(p.av)[0] : String(i + 1);
        bob.append(port);
        if (i === 0 && p.c > 0) bob.append(el("span", "vrcrown", "👑"));
        if ((+p.fog || 0) > now) bob.append(el("span", "vrink"));
        d.append(bob, el("span", "vrtag", H.opts.board ? p.nm : "#" + (i + 1)));
        const old = diveY[p.id]; diveY[p.id] = y;
        if (old != null && Math.abs(old - y) > 0.2 && d.animate) d.animate([{ top: old + "%" }, { top: y + "%" }], { duration: 1400, easing: "cubic-bezier(.3,.7,.2,1)" });
        sea.append(d);
    });
    if (tower.leadAt && now - tower.leadAt < 4500 && order[0]) sea.append(el("p", "vrnewlead", H.opts.board ? "🏆 " + order[0].nm + " takes the lead!" : "🏆 New leader!"));
    return sea;
}
/** The class chest on the sea floor: the whole class's right answers toward the teacher's goal. */
function treasureEl() {
    const g = V.classGoal(H.opts.goal, Object.keys(H.players).length), w = el("div", "vrchest" + (H.goalHit ? " open" : ""));
    w.innerHTML = '<svg viewBox="0 0 80 60" aria-hidden="true"><g class="lid"><path d="M6 26c0-12 14-20 34-20s34 8 34 20z" fill="#8A5A1F" stroke="#5E3B10" stroke-width="3"/><rect x="34" y="16" width="12" height="10" rx="2" fill="#F2B33D"/></g><rect x="6" y="26" width="68" height="30" rx="4" fill="#A86E2A" stroke="#5E3B10" stroke-width="3"/><rect x="6" y="34" width="68" height="5" fill="#F2B33D"/><rect x="35" y="30" width="10" height="12" rx="2" fill="#F2B33D" stroke="#8A5F00" stroke-width="2"/></svg>';
    w.prepend(el("i", "vrglow"));
    if (!g) return w;
    const n = +H.tr || 0, meter = el("div", "vrgoal"), bar = el("div", "vrgoalbar"), fill = el("i");
    fill.style.width = Math.min(100, 100 * n / g) + "%"; bar.append(fill);
    meter.append(el("b", null, H.goalHit ? "Class Treasure unlocked!" : "Class Treasure"), bar, el("small", null, Math.min(n, g) + " of " + g + " right answers together"));
    w.append(meter);
    return w;
}
/** What's playing: the game's theme or a student's DJ pick. */
function nowPlaying() {
    const s = H.dj && V.song(H.dj.k) ? V.song(H.dj.k) : V.song("vault"), w = el("div", "vrnow");
    w.append(el("span", "vrnowic", s[2]));
    const t = el("div"); t.append(el("p", "vrlab", "Now playing"), el("b", null, s[1]));
    if (H.dj && H.dj.nm) t.append(el("small", null, H.opts.board ? "picked by " + H.dj.nm : "picked by a student"));
    else if (H.opts.dj !== false && !H.opts.djlock) t.append(el("small", null, "Earn a DJ Ticket to pick the song"));
    w.append(t); return w;
}
export function drawLiveStage(st) {
    const per = A.S.period + " period";
    if (!loaded) { st.append(A.header("Student Game", per), el("div", "gbody")); return; }
    if (!H && FB) { drawFactStage(st); return; }
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
    } else if (H.status === "play" && H.exit && !H.exit.done) {
        const rows = exitRows(), fin = rows.filter((r) => r.n >= r.of).length, card = el("div", "vrexit");
        card.append(el("p", "vrlab", "Exit ticket"), el("p", "vrexitbig", H.exit.qis.length + " questions · no coins, no hacks"), el("p", "vrexitn", fin + " of " + rows.length + " finished"));
        const bar = el("div", "vrexitbar"), fill = el("i"); fill.style.width = (rows.length ? 100 * fin / rows.length : 0) + "%"; bar.append(fill); card.append(bar);
        card.append(el("p", "vrrule", "Work it out on your pad, then answer. Your teacher sees how you did."));
        body.append(card);
    } else if (H.status === "play" && H.show && P(H.show.id)) {
        const p = P(H.show.id), pad = padOf(H.show.id), wrap = el("div", "vrpad");
        const q = pad ? (pad.iq >= 100000 && H.redo ? H.qs[H.redo.qi] : qOf(p, pad.iq)) : null;
        const top = el("div", "vrpadtop"); top.append(el("span", "gchip", H.show.nm ? p.nm + "'s work" : "Student work"));
        if (q) top.append(mathEl("p", "vrpadq", q.q));
        wrap.append(top);
        const img = el("div", "vrpadimg"); if (pad && pad.img) { const im = el("img"); im.src = pad.img; im.alt = "Student work"; img.append(im); } else img.append(el("p", "vrempty", "No work drawn yet."));
        wrap.append(img); body.append(wrap);
    } else if (H.status === "play") {
        const grid = el("div", "vrplay vrdive"), side = el("div", "vrside");
        const order = ranked(), lead = towerEl(order);
        const clock = el("div", "vrclockbox"); const c = el("p", "vrclock"); c.id = "liveClock"; clock.append(el("p", "vrlab", "Time left"), c); side.append(clock, nowPlaying());
        const fd = el("div", "vrfeed"); fd.append(el("p", "vrlab", "Latest"));
        (H.feed || []).filter((f) => ["crack", "start", "bonus", "block", "box", "event", "sab", "shout", "goal", "dj"].includes(f.k)).slice(-5).reverse().forEach((f) => fd.append(el("p", "vrf " + f.k, H.opts.board ? f.txt : f.k === "crack" ? "A vault was cracked!" : f.k === "box" ? "Someone opened a mystery box" : f.k === "block" ? "A Shield blocked a crack!" : f.k === "sab" ? "Sabotage!" : f.k === "shout" ? "A shout-out from your teacher!" : f.k === "dj" ? (/picked/.test(f.txt) ? "🎧 A student picked a new song" : /gave/.test(f.txt) ? "🎧 Someone got a DJ Ticket" : f.txt) : f.txt)));
        side.append(fd, el("p", "vrlate", "Joining late? " + joinUrl() + " · code " + H.code));
        if (H.heat && H.heat.on) { const hm = el("div", "vrlead vrheatwrap"); hm.append(el("p", "vrlab", "How everyone is doing · last " + HEAT_COLS + " answers"), heatGrid(heatRows(), !!H.heat.names, false)); grid.classList.remove("vrdive"); grid.append(hm, side); }
        else grid.append(lead, seaEl(order), side);
        body.append(grid);
        const bon = el("div", "vrbonus"); bon.id = "liveBonus"; bon.hidden = !bonusOn(); bon.append(el("span", null, "BONUS ROUND · double coins"), el("b", null, "")); body.append(bon);
        const lck = el("div", "vrbonus vrlock"); lck.id = "liveLock"; lck.hidden = !lockOn(); lck.append(el("span", null, "LOCKDOWN · no hacking or sabotage"), el("b", null, "")); body.append(lck);
        // A crack in the last few seconds gets the whole board for a moment.
        const last = (H.feed || []).filter((f) => f.k === "crack" || f.k === "block").slice(-1)[0];
        if (last && !crackSeen[last.t]) crackSeen[last.t] = Date.now();   // when this board first saw it, so a redraw picks up mid-animation
        const since = last ? Date.now() - crackSeen[last.t] : 1e9;
        if (last && Date.now() - last.t < 12000 && since < CRACK_MS) {
            const o = vaultScene(last, since); o.id = "liveCrack"; o.dataset.until = String(crackSeen[last.t] + CRACK_MS);
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
    } else if (H.status === "done" && H.heat && H.heat.on) {
        const hm = el("div", "vrlead vrheatwrap vrheatdone"); hm.append(el("p", "vrlab", "How everyone did · last " + HEAT_COLS + " answers"), heatGrid(heatRows(), !!H.heat.names, false)); body.append(hm);
    } else {
        const order = ranked(), box = el("div", "gdone");
        box.append(el("p", "gwinlab", "Game over"));
        if (order.length) { const pod = el("div", "vrpod"); order.slice(0, 3).forEach((p, i) => { const s = el("div", "vrstep s" + (i + 1)); const av = el("i", "vravatar" + (p.lk ? " bdpod" : ""), p.lk ? null : V.avatar(p.av)[0]), sk = V.skin(p.vs)[3]; if (p.lk) { av.innerHTML = Buddy.svg(p.lk, { size: 150 }); Buddy.animate(av, PODIUM_MOVES[i]); } av.style.setProperty("--skd", sk.door); av.style.setProperty("--skr", sk.ring); av.title = V.skin(p.vs)[1] + " vault";
            s.append(el("b", null, ["1st", "2nd", "3rd"][i]), av, el("span", null, nameOn(p, i)), el("small", null, p.c + " coins"), el("small", "vrsteppct", pctOf(p.r, p.n) + "% right")); pod.append(s); }); box.append(pod); }
        if (order.length) { const all = order.reduce((a, p) => [a[0] + p.r, a[1] + p.n], [0, 0]); box.append(el("p", "vrclass", "Class: " + pctOf(all[0], all[1]) + "% right on " + all[1] + " answers")); }
        else box.append(el("p", "gwin", "No players"));
        body.append(box);
    }
    if (H.status === "play" && H.paused) { const pz = el("div", "vrpaused"); pz.append(el("b", null, "Paused"), el("span", null, "Eyes up here")); body.append(pz); }
    st.append(body);
}

// Podium characters celebrate in turn, round and round: 1st dances, then 2nd cheers, then 3rd, then a short breath.
// (One moving at a time is easier to watch, and lighter for the board's computer.) Every turn is 7.5 s.
const PODIUM_MOVES = [{ move: "dance", loop: true, gap: 5.1 }, { move: "cheer", loop: true, gap: 5.55, delay: 2.5 }, { move: "cheer", loop: true, gap: 5.55, delay: 4.6 }];

/* ---------- the Remote's private panel ---------- */
function panelEl() {
    let p = document.getElementById("livePanel");
    if (!p) { p = el("aside", "gpanel vrpanel"); p.id = "livePanel"; p.setAttribute("aria-label", "Student game controls, only on this Remote"); const body = document.querySelector(".cbody"); if (body) body.append(p); }
    return p;
}
const hd = (text) => el("p", "gph", text);
const sec = (text) => el("p", "vrsec", text);
/** The panel's header card: what state the game is in, the set, the room code, and the numbers that matter now. */
function hero(p, state, label, main, stats) {
    const h = el("div", "vrhero s-" + state), top = el("div", "vrhtop"), pill = el("span", "vrpill"); pill.append(el("i"), document.createTextNode(label));
    top.append(pill); if (H && H.code && H.status !== "done") top.append(el("span", "vrhcode", "Code " + H.code));
    h.append(top, el("p", "vrhtitle", (H && H.title) || "Vault Raid"));
    if (main) h.append(main);
    if (stats && stats.length) { const st = el("div", "vrhstats"); stats.forEach(([v, l]) => { const x = el("span"); x.append(el("b", null, String(v)), el("small", null, l)); st.append(x); }); h.append(st); }
    p.append(h); return h;
}
/** A big control button: an icon, a label and a short line under it. */
function tileBtn(cls, icon, label, sub, fn) {
    const b = btn("vrtilebtn " + cls, null, fn); b.append(el("span", "vrti", icon), el("span", "vrtl", label)); if (sub) b.append(el("small", "vrts", sub)); return b;
}
const liveStats = () => { const order = ranked(), all = order.reduce((a, x) => [a[0] + x.r, a[1] + x.n], [0, 0]); return { n: order.length, ans: all[1], pct: all[1] ? pctOf(all[0], all[1]) + "%" : "–" }; };
function songSelect(v) { const s = el("select"); V.SONGS.forEach(([k, n, e, d]) => { const o = el("option", null, e + " " + n + " · " + d); o.value = k; s.append(o); }); s.value = v; return s; }
const GOALS = [["auto", "Auto (about 6 right answers each)"], ["25", "25 right answers"], ["50", "50 right answers"], ["100", "100 right answers"], ["150", "150 right answers"], ["200", "200 right answers"], ["300", "300 right answers"], ["0", "Off"]];
function goalRow(v, fn) {
    const l = el("label", "gprow2"), s = el("select"); GOALS.forEach(([k, t]) => { const o = el("option", null, t); o.value = k; s.append(o); });
    s.value = String(v == null ? "auto" : v); s.onchange = () => fn(s.value === "0" ? 0 : s.value);
    l.append(el("span", null, "Class Treasure goal"), s, el("small", "vrsub", "The whole class's right answers fill a treasure chest on the board. Reaching the goal opens it. The reward is up to you."));
    return l;
}
function check(label, on, fn, sub) { const l = el("label", "gpchk"), i = el("input"); i.type = "checkbox"; i.checked = on; i.onchange = () => fn(i.checked); l.append(i, document.createTextNode(label)); if (sub) l.append(el("small", "vrsub", sub)); return l; }

export function drawLivePanel(force) {
    if (!A) return;
    const show = isRemote() && onLive() && A.signedIn();
    if (show) document.body.classList.add("gaming");
    if (!show) { const old = document.getElementById("livePanel"); if (old) old.hidden = true; panelSig = ""; return; }
    const p = panelEl(); p.hidden = false;
    if (!force && Date.now() - panelAt < 700) return;   // many students answering at once: redraw about once a second (tickLive catches up)
    const sig = liveSig() + "|" + (SETS ? SETS.length : "x") + "|" + busy + "|" + note + "|" + tab + dtab + "|" + peek + "|" + endArm + resetArm + "|" + JSON.stringify(choice) + "|" + Object.keys(PL).map((k) => k + (PL[k].it || 0)).join(",");
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
        hero(p, "lobby", "Waiting room", null, [[n, n === 1 ? "student in" : "students in"], [H.qs.length, "questions"], [H.opts.mins ? H.opts.mins + " min" : "No limit", "game length"]]);
        p.append(sec("Students, join now"));
        const code = el("div", "vrpcode"); code.append(el("small", null, "Go to " + joinUrl() + " and type"), el("b", null, H.code));
        const qr = el("div", "vrpqr"); qr.append(qrSvg(H.code), el("small", null, "Or scan this. The board shows it too.")); code.append(qr); p.append(code);
        p.append(el("p", "gpnote", n ? n + " joined. Start when everyone is in. Late students can still join." : "Waiting for the first student…"));
        const go = btn("btn go vrbig", "Start the game", startGame); go.disabled = !n; p.append(go);
        if (n) p.append(sec("In the room"));
        playerRows(p, false);
    } else if (H.status === "play" && H.exit && !H.exit.done) {
        hero(p, "redo", "Exit ticket", null, [[n, "students"], [Math.min(EXIT_N, H.qs.length), "questions"], ["0", "coins"]]);
        exitPanel(p, true);
    } else if (H.status === "play" && H.redo && !H.redo.done) {
        const q = H.qs[H.redo.qi], rc = redoCount();
        hero(p, "redo", "Trying it again", mathEl("p", "vrhq", q.q), [[rc.of + "/" + rc.n, "answered"], [rc.ok, "right"], ["+" + REDO_COINS, "coins if right"]]);
        if (H.redo.mine) p.append(el("p", "gpnote vrmine", redoWork && redoWork.k === H.redo.k ? "Your board work is on their pads. They pick up where you left off." : "Sending your board work to their pads…"));
        const box = el("div", "gprows");
        Object.keys(H.players).map((id) => Object.assign({ id }, H.players[id])).sort((a, b) => a.nm.localeCompare(b.nm)).forEach((x) => {
            const r = H.redo.res[x.id], row = el("div", "gprow vrprow");
            row.append(el("span", "vrav", V.avatar(x.av)[0]), el("span", "gpname", x.nm), el("small", "vrla " + (!r ? "" : r.ok ? "ok" : "no"), !r ? "working…" : (r.ok ? "✓ " : "✗ ") + (r.y || "(blank)")));
            const on = H.show && H.show.id === x.id;
            row.append(btn("btn " + (on ? "go" : "ghost") + " vrcall", on ? "On the board" : "Call on", () => showWork(on ? "" : x.id, true)));
            box.append(row);
        });
        p.append(btn("btn go vrbig", "Stop and show the results", () => ask("finish")), sec("Students"), box);
    } else if (H.status === "play") {
        const ls = liveStats(), clock = el("b", "vrhclock"); clock.id = "livePClock";
        hero(p, H.paused ? "paused" : bonusOn() ? "bonus" : "live", H.paused ? "Paused" : bonusOn() ? "Bonus round" : "Live", clock, [[ls.n, "playing"], [ls.pct, "right so far"], [ls.ans, "answers"]]);
        const ctl = el("div", "vrctl");
        ctl.append(tileBtn("vrpausebtn" + (H.paused ? " on" : ""), H.paused ? "▶" : "❚❚", H.paused ? "Resume" : "Pause", H.paused ? "Unfreeze screens" : "Freeze every screen", () => setPause(!H.paused)));
        const bon = tileBtn("vrbonusbtn" + (bonusOn() ? " on" : ""), "⚡", bonusOn() ? "Bonus on" : "Bonus round", "2× coins · 60 s", startBonus); bon.id = "liveBonusBtn"; bon.disabled = bonusOn(); ctl.append(bon);
        ctl.append(tileBtn("vrendbtn" + (endArm ? " armed" : ""), "■", endArm ? "Tap again to end" : "End the game", endArm ? "Ends for everyone" : "Tap twice", () => { if (endArm) endGame(); else { endArm = Date.now(); panelSig = ""; drawLivePanel(true); } }));
        p.append(ctl);
        // Game events: shake things up. Each shows on the board and on every student's screen.
        p.append(sec("Game events"));
        const ev = el("div", "vrctl vrevents"), lk = tileBtn("vrlockbtn" + (lockOn() ? " on" : ""), "🔒", lockOn() ? "Lockdown on" : "Lockdown", "No hacks or sabotage · 60 s", startLock);
        lk.id = "liveLockBtn"; lk.disabled = lockOn();
        ev.append(lk, tileBtn("vrkeybtn", "🗝", "Key drop", "Everyone gets a hack", keyDrop), tileBtn("vrboxbtn", "🎁", "Mystery drop", "Next right answer opens a box", mysteryDrop),
            tileBtn("vralarmbtn" + (resetArm ? " armed" : ""), "🚨", resetArm ? "Tap again to reset" : "Code reset", resetArm ? "Every vault code resets" : "Everyone picks a new code", () => { if (resetArm) { resetArm = 0; codeReset(); } else { resetArm = Date.now(); panelSig = ""; drawLivePanel(true); } }));
        p.append(ev);
        p.append(check("Sabotages", H.opts.sab !== false, setSab, "Students spend coins to Fog, Jam, Tax or Spy on a player with at least as many coins. Off stops them right away."));
        p.append(sec("Music and Class Treasure"));
        const dj = el("div", "vrdjrow"), pick = songSelect(H.dj ? H.dj.k : "vault");
        pick.setAttribute("aria-label", "Song"); dj.append(pick, btn("btn ghost", "Play it", () => teacherSong(pick.value)));
        p.append(dj, el("p", "gpnote", H.dj && H.dj.nm ? "Playing " + V.song(H.dj.k)[1] + ", picked by " + H.dj.nm + "." : "Playing " + V.song(H.dj ? H.dj.k : "vault")[1] + "."));
        p.append(check("DJ Tickets", H.opts.dj !== false, setDj, "Students pick the song with a DJ Ticket (from a mystery box, or the 🎧 button on their row) or for " + V.DJ_COST + " coins. Each song plays at least 2 minutes."),
            check("Lock the music", !!H.opts.djlock, setDjLock, "On: only you can change the song."));
        p.append(goalRow(H.opts.goal, setGoal));
        p.append(sec("What you see"));
        const tabs = el("div", "vrtabs"); [["players", "Players"], ["heat", "Heat map"], ["work", "Work"]].forEach(([k, label]) => { const b = btn("btn " + (tab === k ? "go" : "ghost"), label, () => { tab = k; panelSig = ""; drawLivePanel(true); }); b.setAttribute("aria-pressed", String(tab === k)); tabs.append(b); });
        p.append(tabs);
        boardSwitch(p);
        if (tab === "work") workGrid(p);
        else if (tab === "heat") {
            const hm = H.heat || {}, row = el("div", "vrheatctl");
            row.append(btn("btn " + (hm.on ? "ghost" : "go"), hm.on ? "Back to the scores on the board" : "Show it on the board", () => setHeat(!hm.on, hm.names)),
                btn("btn ghost", hm.names ? "Board: names" : "Board: anonymous", () => setHeat(hm.on, !hm.names)));
            p.append(row, el("p", "gpnote", "Last " + HEAT_COLS + " answers each: ✓ right, ↻ right on the second try, ✗ missed. Stuck = 3 misses in a row (only you see that)."), heatGrid(heatRows(), true, true));
        } else playerRows(p, true);
    } else {
        const ls = liveStats(); hero(p, "done", "Game over", null, [[ls.pct, "class right"], [ls.ans, "answers"], [ls.n, "players"]]);
        const tabs = el("div", "vrtabs"); [["report", "Report"], ["players", "Standings"]].forEach(([k, label]) => { const b = btn("btn " + (dtab === k ? "go" : "ghost"), label, () => { dtab = k; panelSig = ""; drawLivePanel(true); }); b.setAttribute("aria-pressed", String(dtab === k)); tabs.append(b); });
        p.append(tabs);
        if (!H.review && !(H.exit && !H.exit.done)) boardSwitch(p);
        if (dtab === "report") {
            if (H.exit && H.exit.done) exitPanel(p, false);
            else if (Object.keys(H.players).length) p.append(tileBtn("vrwide vrexitbtn", "✎", "Exit ticket", Math.min(EXIT_N, H.qs.length) + " most-missed questions, no coins", startExit));
            reportPanel(p); saveRow(p);
        }
        else { p.append(hd("Final standings")); saveRow(p); playerRows(p, false, true); }
    }
    const foot = el("div", "vrfoot"), close = btn("btn ghost gpend", busy === "close" ? "Closing…" : "Close the room", closeRoom); close.disabled = !!busy;
    foot.append(close, el("p", "gpnote", H.status === "done" ? "Closing the room deletes the names, answers and work from this game." : "Closing the room ends the game for everyone and deletes the names, answers and work."));
    p.append(foot);
    p.scrollTop = keep;
}
function saveRow(p) {
    const n = Object.keys(H.players).length;
    {
        if (H.saved) { const t = el("p", "gpnote"), a = el("a", null, "Class Data"); a.href = "data.html#games"; t.append(document.createTextNode("Saved to "), a, document.createTextNode(".")); p.append(t); }
        else if (n) p.append(el("p", "gpnote", "Not saved. This report stays only until you close the room."), btn("btn ghost", busy ? "Saving…" : "Save results to Class Data", saveResults));
    }
    if (profOn()) {
        if (H.pfSaved) { const t = el("p", "gpnote"), a = el("a", null, "student profiles"); a.href = "profiles.html"; t.append(document.createTextNode("Added to "), a, document.createTextNode(" (levels, XP, banked coins, topic locks).")); p.append(t); }
        else if (n) p.append(btn("btn ghost", H.pfBusy ? "Saving…" : "Save to profiles", saveProfiles));
    }
}
/** After the game: top 3, everyone's percent right, the most-missed questions with the wrong answers we saw, and buttons to go over them on the board. */
function reportPanel(p) {
    const order = ranked(), list = missedList();
    if (!order.length) { p.append(el("p", "gpnote", "No one played.")); return; }
    const all = order.reduce((a, x) => [a[0] + x.r, a[1] + x.n], [0, 0]);
    const tiles = el("div", "vrtiles"), tile = (v, l) => { const t = el("div", "vrtile"); t.append(el("b", null, v), el("small", null, l)); tiles.append(t); };
    void tiles; void tile;   // the header card shows class right, answers and players now

    if (H.review) {
        const box = el("div", "vrrevctl"), at = list.findIndex((x) => x.qi === H.review.qi);
        box.append(el("b", null, "On the board: question " + (at >= 0 ? at + 1 + " of " + list.length : "")));
        const row = el("div", "gpbtns");
        row.append(btn("btn ghost", "Back", () => review(list[Math.max(0, at - 1)].qi)), btn("btn go", H.review.ans ? "Hide answer" : "Show answer", () => review(H.review.qi, !H.review.ans)),
            btn("btn ghost", at + 1 < list.length ? "Next" : "Done", () => (at + 1 < list.length ? review(list[at + 1].qi) : review(null))));
        if (at <= 0) row.firstChild.disabled = true;
        box.append(row, btn("btn go", "Send it back with my work (+" + REDO_COINS + " coins if right)", () => ask("send", H.review.qi)), btn("btn ghost", "Send it back blank", () => ask("send", H.review.qi, true)), btn("btn ghost", "Back to final scores", () => review(null))); p.append(box);
    } else if (list.length) p.append(tileBtn("vrwide vrgoover", "↺", "Go over the missed questions", list.length + (list.length === 1 ? " question" : " questions") + " on the board, then send them back", () => review(list[0].qi)));

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
        const used = Object.values(H.players).map((y) => (y.lg || []).find((z) => z.i === x.qi && !z.ok && z.sp)).filter(Boolean);
        if (used.length) r.append(el("small", "vrsub vrstepnote", used.length + (used.length === 1 ? " student" : " students") + " used steps · " + used.filter((z) => z.fx).length + " then got it"));
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
        const sx = (x.lg || []).filter((y) => !y.ok && y.sp); if (sx.length) left.append(el("small", "vrsub vrstepnote", "Used steps on " + sx.length + " · fixed " + sx.filter((y) => y.fx).length + " with them"));
        r.append(left, el("b", "vrpct " + (x.n ? (x.r / x.n >= 0.8 ? "hi" : x.r / x.n >= 0.6 ? "mid" : "lo") : ""), x.n ? pctOf(x.r, x.n) + "%" : "–")); t.append(r);
    });
    p.append(t);
}
function setupPanel(p) {
    gameSwitch(p);
    if (choice.game === "fact") { factPanel(p); return; }
    const intro = el("div", "vrhero s-setup"), pill = el("span", "vrpill"); pill.append(el("i"), document.createTextNode("Student game"));
    const how = el("details", "vrhow"); how.append(el("summary", null, "How it works"), el("p", null, "Students play on their Chromebooks with a game code and their name. No sign-in. Right answers earn coins and hacks; a hack guesses a classmate's 3-digit vault code to take some of their coins. Each question has a pad to show their work, which you can see here and put on the board."));
    const tt = el("div", "vrhtop"); tt.append(pill); intro.append(tt, el("p", "vrhbig", "Vault Raid"), el("p", "vrhsub", "Chromebooks, a code and a name. No sign-in."), how); p.append(intro);
    p.append(sec("Set up the game"));
    if (!SETS) { p.append(el("p", "gpnote", "Getting your question sets…")); return; }
    if (!SETS.length) { p.append(el("p", "gpnote", "No question sets are saved yet.")); const a = el("a", "btn go gplink", "Make a question set"); a.href = "maker.html?per=" + encodeURIComponent(A.S.period); p.append(a); return; }
    // Nov 28: the pick is per period (remembered on this device) and the default prefers this period's class (js/vaultPick.js)
    const list = setsFor(SETS, A.S.period);
    if (choice.per !== A.S.period) { const first = choice.per === undefined && choice.set; choice.per = A.S.period; if (!first) choice.set = recallSet(A.S.period); }
    choice.set = pickSet(SETS, A.S.period, A.S.cls, choice.set);
    const row = (label, ctl) => { const l = el("label", "gpchk vrfield"); l.append(el("span", null, label), ctl); return l; };
    const sel = el("select"); list.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).forEach((s) => { const o = el("option", null, (s.title || "Review game") + " (" + (s.clues || 0) + ")"); o.value = s.id; sel.append(o); }); // The last options open the Question Maker: edit the picked set, or start a new one.
    const per = "&per=" + encodeURIComponent(A.S.period), tools = el("optgroup"); tools.label = "Question Maker";
    const edit = el("option", null, "✎ Edit this set's questions"); edit.value = "__edit"; const make = el("option", null, "+ Make a new question set"); make.value = "__new";
    tools.append(edit, make); sel.append(tools);
    sel.value = choice.set; sel.onchange = () => {
        if (sel.value === "__edit") { location.href = "maker.html?set=" + encodeURIComponent(choice.set) + per; sel.value = choice.set; return; }
        if (sel.value === "__new") { location.href = "maker.html?" + per.slice(1); sel.value = choice.set; return; }
        choice.set = sel.value; keepSet(A.S.period, choice.set); panelSig = "";
    };
    const len = el("select"); LENGTHS.forEach(([m, t]) => { const o = el("option", null, t); o.value = String(m); len.append(o); }); len.value = String(choice.mins); len.onchange = () => { choice.mins = +len.value; panelSig = ""; };
    const nm = el("select"); [["roster", "Pick from my class list"], ["typed", "Type their name"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; nm.append(o); }); nm.value = choice.names; nm.onchange = () => { choice.names = nm.value; panelSig = ""; };
    p.append(row("Question set", sel), row("Length", len), row("Students", nm));
    if (choice.names === "roster") p.append(el("p", "gpnote", "Names show as first name and last initial (" + A.S.period + " period's list on the Rosters page)."));
    const more = el("details", "gpopts"); more.append(el("summary", null, "Options"));
    more.append(check("Show names on the board", choice.board, (v) => { choice.board = v; }),
        check("Students must show work before they can submit", choice.work, (v) => { choice.work = v; }, "On: the answer button waits until there is real work on their pad."),
        check("Slow down guessing", choice.slow, (v) => { choice.slow = v; }, "On: after 2 misses in a row, a student waits " + COOL_S + " seconds before the next answer."),
        check("Sound effects on student devices", choice.snd, (v) => { choice.snd = v; }, "On: short sounds for right answers, cracks and mystery boxes. Each student can still mute their own."),
        check("Catch-up boost", choice.comeback, (v) => { choice.comeback = v; }, "On: after the first minute, students in the bottom quarter earn half again on right answers. Only they see it, never the board."),
        check("Second chance after a miss", choice.retry, (v) => { choice.retry = v; }, "On: a wrong answer gets a hint and one more try for half coins. Only the first try counts in the report."),
        check("Step-by-step help after a miss", choice.steps, (v) => { choice.steps = v; }, "On: when a question has steps, a miss shows step 1 in a small pop-up on the right of the student's screen (they can shrink it), and each wrong try shows the next one. Every step lowers the coins it's worth (60%, 40%, 25%). Quick guesses unlock nothing, students must read each step and add work before trying again, and steps never show the answer. Who used steps shows on your Remote only."),
        check("DJ Tickets", choice.dj, (v) => { choice.dj = v; }, "On: a student with a DJ Ticket (from a mystery box or your 🎧 button) or " + V.DJ_COST + " coins picks the game's song from 7 original tracks. Each song plays at least 2 minutes, and you can lock the music."),
        goalRow(choice.goal, (v) => { choice.goal = v; panelSig = ""; }),
        check("Sabotages", choice.sab, (v) => { choice.sab = v; }, "On: students spend coins to Fog, Jam, Tax or Spy on a classmate with at least as many coins (never someone behind them). Each one costs coins and recharges, a player who was just hit is safe for a minute, and none of them touch anyone's questions or work. You can turn it off during the game."),
        check("See their work live as they draw", choice.live, (v) => { choice.live = v; }, "Off: you see each student's work when they answer. On: it updates every few seconds, which uses more of the free daily allowance."),
        check("Add to student profiles", choice.prof, (v) => { choice.prof = v; }, "On: at Game over each roster student's XP, banked coins and topic locks are added to their profile (Students > Profiles). First name and last initial only, in your private account. Students never write to it."),
        check("Save each student's result to Class Data", choice.save, (v) => { choice.save = v; }, "Off by default. Names, coins and right answers are kept in your private account. Leave off until the district says student data can be stored."));
    p.append(more);
    const go = btn("btn go vrbig", busy === "open" ? "Opening…" : "Open the room", openRoom); go.disabled = !!busy; p.append(go);
}
function playerRows(p, live, final) {
    const order = ranked(); if (!order.length) return;
    const box = el("div", "gprows");
    order.forEach((x, i) => {
        const r = el("div", "gprow vrprow");
        const name = el("span", "gpname", (final ? (i + 1) + ". " : "") + x.nm + (H.status === "lobby" && x.pu && V.starter(x.pu) ? " · " + V.starter(x.pu)[1] : ""));
        r.append(el("span", "vrav", V.avatar(x.av)[0]));
        const info = el("small", "vrinfo", final || live ? x.c + " coins · " + x.r + " of " + x.n + " right" + (x.cr ? " · cracked " + x.cr : "") : x.code ? "Vault set" : "Setting a vault code…");
        const left = el("div", "vrpl"); left.append(name, info);
        if (live && x.la) { const la = el("small", "vrla " + (x.la.ok ? "ok" : "no"), (x.la.ok ? "✓ " : "✗ ") + (x.la.y || "(blank)")); left.append(la); }
        if (live && x.sm && x.rt === x.qn) { const n = V.stepsFor(qOf(x, x.qn)).length; left.append(el("small", "vrstepchip", x.sp ? "On step " + x.sp + " of " + n : "Working before step 1")); }
        r.append(left);
        if (live && x.la && !x.la.ok && x.la.y) r.append(btn("gpok", "Count it", () => acceptAnswer(x.id)));
        if (live && H.opts.dj !== false) { const g = btn("gpok vrdjgive", "🎧" + (x.dj ? " " + x.dj : ""), () => giveDj(x.id)); g.title = "Give " + x.nm + " a DJ Ticket"; g.setAttribute("aria-label", "Give " + x.nm + " a DJ Ticket" + (x.dj ? " (has " + x.dj + ")" : "")); r.append(g); }
        if (live) { const so = btn("gpok vrshout", "★ +" + V.SHOUT_COINS, () => shoutOut(x.id)); so.title = "Shout-out: give " + x.nm + " " + V.SHOUT_COINS + " coins"; so.setAttribute("aria-label", "Shout-out: give " + x.nm + " " + V.SHOUT_COINS + " coins"); r.append(so); }
        if (!final) { const rm = btn("gpno vrrm", "Remove", () => removePlayer(x.id)); rm.title = "Remove " + x.nm + " and free the name"; rm.setAttribute("aria-label", "Remove " + x.nm + " and free the name"); r.append(rm); }
        box.append(r);
    });
    p.append(box);
    if (live) p.append(el("p", "gpnote", "Count it accepts that answer from now on and gives the coins. ★ +" + V.SHOUT_COINS + " is a shout-out: " + V.SHOUT_COINS + " coins for great effort, and it shows on the board. Remove frees the name so a student can pick it again on another device."));
}
function workGrid(p) {
    const order = ranked();
    if (!H.opts.live) p.append(el("p", "gpnote", "You see each student's work from their last answer."), btn("btn ghost", "See work live as they draw", () => setLive(true)));
    else p.append(el("p", "gpnote", "Work updates every few seconds while students draw."), btn("btn ghost", "Only update when they answer", () => setLive(false)));
    if (peek && P(peek)) {
        const x = P(peek), pad = padOf(peek), big = el("div", "vrpeek");
        big.append(el("b", null, x.nm));
        if (pad && pad.img) { const q = qOf(x, pad.iq); big.append(mathEl("p", "gpnote", q.q)); const im = el("img"); im.src = pad.img; im.alt = x.nm + "'s work"; big.append(im); } else big.append(el("p", "gpnote", "No work yet."));
        const row = el("div", "gpbtns"); row.append(btn("btn go", "Call on them (live on the board)", () => showWork(peek, true)), btn("btn ghost", "Show it without their name", () => showWork(peek, false)), btn("btn ghost", "Close", () => { peek = ""; panelSig = ""; drawLivePanel(true); }));
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

/* ---------- Fact Blitz on the Student Game screen ----------
   teacher/{uid}/games/fact holds the check on the board ({ id: "" } when none). The check is Fact Blitz's own
   (opened here or on the Fact Blitz page). The keeper (js/fluencyKeep.js) loads only when Fact Blitz is used. */
let FB = null, fbRev = 0, fbWatched = false, FK = null, FX = null, fkLoading = false, fbT = 0;
const fbDraft = { mode: "check", set: "", top: 12, secs: 0, all: false };
function fbWatch() {
    if (fbWatched || !A.signedIn() || A.mode() === "sub") return; fbWatched = true;
    if (isRemote() && choice.game === "fact") fkEnsure();
    A.store().watch("games/fact", (snap) => {
        if (snap.pending) return;
        const was = FB ? FB.id : "";
        FB = snap.exists && snap.data && snap.data.id ? snap.data : null;
        if (FB) { fkEnsure(); if (FB.id !== was && isRemote()) choice.game = "fact"; }
        fbRev++; panelSig = ""; A.redraw();
    }, () => {});
}
function fkEnsure() {
    if (FK || fkLoading) return; fkLoading = true;
    Promise.all([import("./fluencyKeep.js?v=1"), import("./factCore.js?v=1")]).then(([m, f]) => {
        FX = f; fkLoading = false;
        FK = m.createKeeper({ store: A.store(), rooms: A.store().rooms, periods: () => null, onChange: fbChanged, onErr: (msg) => { note = msg; fbChanged(); } });
        fbChanged();
    }, () => { fkLoading = false; note = "Couldn't load Fact Blitz. Check the connection, then pick it again."; fbChanged(); });
}
// students' runs change often while they play: redraw at most every few tenths of a second
function fbChanged() { if (fbT) return; fbT = setTimeout(() => { fbT = 0; fbRev++; panelSig = ""; A.redraw(); drawLivePanel(true); }, 300); }
function setGame(g) {
    choice.game = g; try { localStorage.setItem("anchorboard-live-game", g); } catch (e) { /* private window */ }
    if (g === "fact") fkEnsure();
    note = ""; panelSig = ""; drawLivePanel(true);
}
function gameSwitch(p) {
    const row = el("div", "vrboardsw vrgamesw"), seg = el("div", "vrtabs");
    [["vault", "Vault Raid"], ["fact", "Fact Blitz"]].forEach(([k, label]) => { const b = btn("btn " + (choice.game === k ? "go" : "ghost"), label, () => setGame(k)); b.setAttribute("aria-pressed", String(choice.game === k)); seg.append(b); });
    row.append(el("small", null, "GAME"), seg); p.append(row);
}
async function fbShow(x) {
    const doc = { id: x.id, code: x.code, title: x.title, mode: x.mode, set: x.set, top: x.top || 12, secs: x.secs, at: Date.now() };
    FB = doc; fbRev++; panelSig = ""; A.redraw();
    try { await A.store().save("games/fact", doc); } catch (e) { note = "Couldn't put it on the board (" + ((e && e.code) || "connection") + ")."; panelSig = ""; A.redraw(); }
}
function fbOff() { FB = null; fbRev++; panelSig = ""; A.store().save("games/fact", { id: "", at: Date.now() }).catch(() => {}); A.redraw(); }
async function fbOpen() {
    if (busy || !FK) return;
    const per = A.S.period, periods = fbDraft.all ? FK.periodsWithRoster() : FK.rosterOf(per).length ? [per] : [];
    if (!periods.length) { note = fbDraft.all ? "Add your class lists on the Rosters page first: students pick their name from them." : "There is no class list for " + per + " period. Add one on the Rosters page first: students pick their name from it."; panelSig = ""; drawLivePanel(true); return; }
    busy = "fact"; note = ""; panelSig = ""; drawLivePanel(true);
    try {
        const d = await FK.openCheck({ mode: fbDraft.mode, set: fbDraft.set, top: fbDraft.top, secs: fbDraft.secs, goal: +((FK.D.setup && FK.D.setup.goal) || FX.DEFAULTS.goal), tries: 1, counts: "first", periods, title: "" });
        await fbShow(d);
    } catch (e) { note = "Couldn't open it (" + ((e && e.code) || "connection") + ")."; }
    busy = ""; panelSig = ""; drawLivePanel(true);
}
async function fbClose(d) {
    if (busy) return; busy = "factclose"; panelSig = ""; drawLivePanel(true);
    try { await FK.setStatus(d, "closed"); fbOff(); } catch (e) { note = "Couldn't close it (" + ((e && e.code) || "connection") + "). Try again."; }
    busy = ""; panelSig = ""; drawLivePanel(true);
}
/** Joined / playing / done for the board's class (or the whole check when this class isn't in it). Counts only, never names. */
function fbCounts(d) {
    const rows = FK.rowsOf(d), mine = (d.periods || []).includes(A.S.period) ? rows.filter((r) => r.per === A.S.period) : rows;
    return { of: mine.length, in: mine.filter((r) => r.state !== "none").length, playing: mine.filter((r) => r.state === "playing").length, done: mine.filter((r) => r.state === "done" || r.state === "practiced").length };
}
const fbFacts = (x) => (FX ? FX.setName(x.set) : "Facts") + " · up to " + (x.top || 12) + " · " + (FX ? FX.fmtSecs(x.secs) : Math.round((x.secs || 0) / 60) + " min");
function factPanel(p) {
    fkEnsure();
    const on = FB && FK ? FK.def(FB.id) : null, x = on || FB;
    const intro = el("div", "vrhero " + (FB ? (on && on.status !== "open" ? "s-done" : "s-lobby") : "s-setup")), pill = el("span", "vrpill"), tt = el("div", "vrhtop");
    pill.append(el("i"), document.createTextNode(FB ? (on && on.status !== "open" ? "Closed" : "On the board") : "Student game"));
    tt.append(pill); if (FB) tt.append(el("span", "vrhcode", "Code " + FB.code));
    intro.append(tt);
    if (FB) {
        intro.append(el("p", "vrhtitle", x.title || "Fact Blitz"), el("p", "vrhbig", "Fact Blitz"), el("p", "vrhsub", (x.mode === "check" ? "Speed check" : "Practice") + " · " + fbFacts(x)));
        if (on && FK) { const c = fbCounts(on), st = el("div", "vrhstats"); [[c.in + "/" + c.of, "joined"], [c.playing, "playing"], [c.done, "done"]].forEach(([v, l]) => { const s = el("span"); s.append(el("b", null, String(v)), el("small", null, l)); st.append(s); }); intro.append(st); }
    } else {
        const how = el("details", "vrhow"); how.append(el("summary", null, "How it works"), el("p", null, "Students go to " + location.host + "/fact on their Chromebooks, type the code and pick their name. No sign-in. Each run is timed and stops on its own. Answers check themselves as they type. A Speed check's score goes to the Gradebook (Add scores) and Student Progress, and every run goes on the student's profile."));
        intro.append(el("p", "vrhbig", "Fact Blitz"), el("p", "vrhsub", "Timed math facts. A code and a name. No sign-in."), how);
    }
    p.append(intro);
    if (!FK || !FK.D.index || !FK.D.rosters) { p.append(el("p", "gpnote", "Getting your Fact Blitz checks…")); return; }
    const page = el("a", "btn ghost gplink", "Scores, extra time and progress: Fact Blitz page"); page.href = "fluency.html";
    if (FB) {
        const acts = el("div", "gpcol");
        if (on && on.status === "open") acts.append(btn("btn go vrbig", busy === "factclose" ? "Closing…" : "Close the check", () => fbClose(on)));
        acts.append(btn("btn ghost", "Take it off the board", fbOff));
        p.append(acts, el("p", "gpnote", "Keep this Remote or the board open while students play. That's what sends each student their clock (with any extra time) and saves the scores."), page);
        return;
    }
    const open = FK.D.index.filter((y) => y.status === "open");
    if (open.length) {
        p.append(sec("Open checks"));
        const rows = el("div", "gprows");
        open.slice(0, 6).forEach((y) => { const r = el("div", "gprow vrfbrow"), t = el("div"); t.append(el("b", "gpname", y.title), el("small", "vrsub", (y.mode === "check" ? "Speed check" : "Practice") + " · code " + y.code + " · " + (y.periods || []).join(", "))); r.append(t, btn("btn go vrcall", "Show on board", () => fbShow(y))); rows.append(r); });
        p.append(rows);
    }
    p.append(sec(open.length ? "Or open a new one" : "Open a speed check"));
    if (!fbDraft.set) { const last = FK.D.index[0] || {}; fbDraft.set = last.set || FX.DEFAULTS.set; fbDraft.top = last.top || 12; }
    if (!fbDraft.secs) fbDraft.secs = fbDraft.mode === "check" ? 120 : 60;
    const row = (label, ctl) => { const l = el("label", "gpchk vrfield"); l.append(el("span", null, label), ctl); return l; };
    const pick = (opts, val, fn) => { const s = el("select"); opts.forEach(([v, t]) => { const o = el("option", null, t); o.value = String(v); s.append(o); }); s.value = String(val); s.onchange = () => { fn(s.value); panelSig = ""; drawLivePanel(true); }; return s; };
    p.append(row("Kind", pick([["check", "Speed check (for a grade)"], ["practice", "Practice (no grade)"]], fbDraft.mode, (v) => { fbDraft.mode = v; fbDraft.secs = v === "check" ? 120 : 60; })),
        row("Facts", pick(FX.SETS.map((s) => [s[0], s[1]]), fbDraft.set, (v) => { fbDraft.set = v; })),
        row("Up to", pick([[12, "12 × 12"], [10, "10 × 10"]], fbDraft.top, (v) => { fbDraft.top = +v; })),
        row("Time on the clock", pick(FX.TIMES.map((t) => [t, (t / 60) + (t === 60 ? " minute" : " minutes")]), fbDraft.secs, (v) => { fbDraft.secs = +v; })),
        row("Classes", pick([["one", A.S.period + " period"], ["all", "All my classes"]], fbDraft.all ? "all" : "one", (v) => { fbDraft.all = v === "all"; })));
    const xt = Object.keys((FK.D.setup && FK.D.setup.xt) || {}).length;
    p.append(el("p", "gpnote", (xt ? xt + (xt === 1 ? " student has" : " students have") + " extra time from the Fact Blitz page; it's used here too. " : "Extra time is set per student on the Fact Blitz page. ") + (fbDraft.mode === "check" ? "Goal: " + ((FK.D.setup && FK.D.setup.goal) || FX.DEFAULTS.goal) + " right a minute, 1 try." : "")));
    const go = btn("btn go vrbig", busy === "fact" ? "Opening…" : "Open it and show on the board", fbOpen); go.disabled = !!busy; p.append(go, page);
}
/** The board: where to go, the code, a QR code and how many are in. No names. */
function drawFactStage(st) {
    const d = FK ? FK.def(FB.id) : null, x = d || FB, closed = d && d.status !== "open";
    st.append(A.header("Fact Blitz", x.title || "Fact Blitz"));
    const body = el("div", "gbody vr fbstage"), join = el("div", "vrjoin"), how = el("div", "vrhow");
    if (closed) {
        const box = el("div", "gdone"); box.append(el("p", "gwinlab", "Fact Blitz"), el("p", "gwin", "This check is closed."));
        if (FK) { const c = fbCounts(d); box.append(el("p", "vrclass", c.done + " of " + c.of + " finished")); }
        body.append(box); st.append(body); return;
    }
    how.append(el("p", "vrlab", "Go to"), el("p", "vrurl", location.host + "/fact"), el("p", "vrlab", "Code"), el("p", "vrcode", FB.code.slice(0, 3) + " " + FB.code.slice(3)));
    const who = el("div", "vrwho"), head = el("div", "vrwhohead"), qr = el("div", "vrqr");
    qr.append(qrSvg(FB.code, location.origin + "/fact.html?c=" + FB.code), el("p", null, "Scan to join"));
    const c = d && FK ? fbCounts(d) : null;
    head.append(qr, el("p", "vrcount", c ? c.in + (c.in === 1 ? " student is in" : " students are in") : "Waiting for students"));
    who.append(head);
    if (c) { const bars = el("div", "fbstats"); [[c.playing, "playing now"], [c.done, "finished"]].forEach(([v, l]) => { const s = el("div"); s.append(el("b", null, String(v)), el("span", null, l)); bars.append(s); }); who.append(bars); }
    who.append(el("p", "fbkind", (x.mode === "check" ? "Speed check" : "Practice") + " · " + fbFacts(x)),
        el("p", "vrrule", "Pick your name and press Start. Type each answer: it checks itself. Your clock stops on its own."));
    join.append(how, who); body.append(join); st.append(body);
}
