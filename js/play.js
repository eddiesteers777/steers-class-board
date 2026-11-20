/* ==========================================
   Anchor Board — the student page for Vault Raid (play.html, anchorboard.web.app/play).
   No account and no password: the page signs in as an anonymous guest on this
   device only, so the game can tell this Chromebook's answers from the others'.
   It never touches the teacher's sign-in (it runs as its own Firebase app, "play").

   A student types the game code, picks their name (or types it), sets a secret
   3-digit vault code, then answers questions with a pad to show their work.
   The teacher's Remote checks every answer and hack; this page only ever sees its
   own questions and results, never the answers or anyone else's code.
========================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeFirestore, doc, getDoc, onSnapshot, setDoc, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import * as V from "./vaultCore.js?v=75";
import { createMathPad } from "./mathPad.js?v=2";
import { wbIcon } from "./wbIcons.js?v=2";

// Same project as js/firebase.js. A separate app name keeps a teacher signed in on this device signed in.
const app = initializeApp({
    apiKey: "AIzaSyA8kAei_AJMU66EePYQyI8nlVJeLes5HLY",
    authDomain: "steers-class-board.firebaseapp.com",
    projectId: "steers-class-board",
    storageBucket: "steers-class-board.firebasestorage.app",
    messagingSenderId: "997357619072",
    appId: "1:997357619072:web:8e47464df7c4e329fd2365"
}, "play");
// iPhone and iPad Safari can stall Firestore's streaming connection with no error (seen 2026-11-07 and in the
// first live test, 2026-11-17: the first question took about 30 seconds). Those devices use plain requests.
const appleTouch = /iPhone|iPad|iPod/.test(navigator.userAgent || "") || (/Macintosh/.test(navigator.userAgent || "") && navigator.maxTouchPoints > 1);
const auth = getAuth(app), db = initializeFirestore(app, appleTouch ? { experimentalForceLongPolling: true } : { experimentalAutoDetectLongPolling: true });
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {   // local testing with the emulators only
    try {
        if (new URLSearchParams(location.search).has("emu")) sessionStorage.setItem("anchorboard-emu", "1");
        if (sessionStorage.getItem("anchorboard-emu")) { connectFirestoreEmulator(db, "127.0.0.1", 8080); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); }
    } catch (e) { /* storage blocked */ }
}
setPersistence(auth, browserLocalPersistence).catch(() => {});

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };
const mathEl = (tag, cls, text) => { const e = el(tag, cls); e.append(V.mathText(text)); return e; };
const store = { get: (k) => { try { return localStorage.getItem("anchorboard-play-" + k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { localStorage.setItem("anchorboard-play-" + k, v); } catch (e) { /* ok */ } } };

const ST = {
    uid: "", code: "", room: null, roomGone: false, me: null, hadMe: false,
    step: "code",        // code → name → vault → (playing)
    pick: null,          // { ni } or { nm } while joining
    view: "q",           // q (question) · fb (answer result) · targets · guess
    sentQ: -1, sentK: 0, coins: null, picks: {}, pickErr: false, opened: {}, seenBlock: 0, target: "", guess: "", vault: "", typed: "", err: "", seenHit: 0, busy: false,
    skin: null, skinsSeen: null, skinFb: "", newSkin: -1, back: "q", lastBonus: null, lastStatus: "", endSnd: false,
};
let unsubRoom = null, unsubMe = null, sig = "";

/* ---------- sound: short tones made right here (no sound files) ---------- */
// The teacher can switch sound off for the whole game; each student can mute their own (kept on this device).
let AC = null;
const soundOn = () => store.get("mute") !== "1" && !(ST.room && ST.room.snd === false);
const SOUNDS = {   // [frequency, start s, length s, wave, volume, slide to]
    right: [[660, 0, .12], [880, .1, .2]],
    streak: [[660, 0, .1], [880, .08, .1], [1175, .16, .26]],
    miss: [[330, 0, .26, "triangle", .1, 220]],
    box: [[1047, 0, .08], [1319, .07, .08], [1568, .14, .08], [2093, .21, .24]],
    crack: [[523, 0, .12, "square", .05], [659, .11, .12, "square", .05], [784, .22, .12, "square", .05], [1047, .33, .4, "square", .06]],
    hit: [[440, 0, .45, "sawtooth", .05, 130]],
    bonus: [[220, 0, .35, "square", .04, 880], [880, .36, .18, "square", .04]],
    start: [[523, 0, .12], [784, .12, .22]],
    win: [[523, 0, .14], [659, .14, .14], [784, .28, .14], [1047, .42, .5]],
    tap: [[880, 0, .06, "sine", .06]],
};
function sfx(k) {
    if (!soundOn() || !SOUNDS[k]) return;
    try {
        AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume();
        const t = AC.currentTime + 0.01;
        SOUNDS[k].forEach(([f, at, len, wave, vol, to]) => {
            const o = AC.createOscillator(), g = AC.createGain(); o.type = wave || "sine"; o.frequency.setValueAtTime(f, t + at);
            if (to) o.frequency.exponentialRampToValueAtTime(to, t + at + len);
            g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
            o.connect(g).connect(AC.destination); o.start(t + at); o.stop(t + at + len + 0.03);
        });
    } catch (e) { /* no sound on this device */ }
}
// Browsers only allow sound after a tap, so wake the sound up on the first one.
document.addEventListener("pointerdown", () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch (e) { /* ok */ } }, { once: true });

/* ---------- vault skins ---------- */
/** The skin this student's vault wears: their pick on this device, else what the teacher's screen has, kept to the ones they've unlocked. */
const mySkin = (m) => { const open = V.skinsOpen(m && m.top), i = ST.skin != null ? ST.skin : (m && m.vs) || 0; return i < open ? i : 0; };
function pickSkin(i) {
    ST.skin = i; sfx("tap"); draw(true);
    // Its own small write; a site whose rules are older still keeps the look on this device.
    setDoc(mine(), { at: Date.now(), vs: i }, { merge: true }).catch(() => {});
}

/* ---------- connecting ---------- */
async function signIn() {
    if (auth.currentUser) return auth.currentUser.uid;
    await new Promise((r) => { const u = onAuthStateChanged(auth, () => { u(); r(); }); });
    if (auth.currentUser) return auth.currentUser.uid;
    const c = await signInAnonymously(auth); return c.user.uid;
}
async function join(code) {
    ST.err = ""; ST.busy = true; draw();
    try { ST.uid = await signIn(); }
    catch (e) {
        ST.busy = false;
        ST.err = /operation-not-allowed|admin-restricted/.test((e && e.code) || "") ? "Student games aren't turned on for this site yet. Tell your teacher." : "Couldn't connect. Check the Wi-Fi and try again.";
        draw(); return;
    }
    if (unsubRoom) unsubRoom(); if (unsubMe) unsubMe();
    ST.code = code; ST.room = null; ST.me = null; ST.hadMe = false; ST.roomGone = false;
    unsubRoom = onSnapshot(doc(db, "rooms", code), (s) => {
        ST.busy = false;
        if (!s.exists()) {
            if (ST.room) { ST.roomGone = true; draw(); return; }
            // Not a game: it may be an assignment code (do.html), so one join page works for both.
            stopAll(); getDoc(doc(db, "asg", code)).then((a) => a.exists(), () => false).then((isAsg) => {
                if (isAsg) { location.replace("do.html?c=" + code); return; }
                ST.err = "No game has that code. Check the board."; ST.step = "code"; ST.code = ""; draw();
            });
            return;
        }
        if (s.data().kind === "notes") { stopAll(); location.replace("follow.html?code=" + code); return; }   // a Live notes code (js/follow.js)
        const was = ST.room; ST.room = s.data(); store.set("code", code);
        const bn = +ST.room.bonus || 0;
        if (was && bn > Date.now() && bn !== ST.lastBonus) sfx("bonus");
        ST.lastBonus = bn;
        if (was && was.status === "lobby" && ST.room.status === "play" && ST.me) sfx("start");
        if (!ST.me && ST.room.status === "done") { ST.err = "That game has ended."; ST.step = "code"; ST.code = ""; stopAll(); }
        else if (ST.step === "code") ST.step = "name";
        draw();
    }, () => { ST.busy = false; ST.err = "Couldn't open that game. Check the code."; ST.step = "code"; ST.code = ""; stopAll(); draw(); });
    unsubMe = onSnapshot(doc(db, "rooms", code, "s", ST.uid), (s) => {
        if (!s.exists()) {
            // Closing the room deletes this first and the room a moment later, so wait before saying the name was freed.
            if (ST.hadMe) setTimeout(() => { if (ST.roomGone || ST.me === null || !ST.hadMe) return; ST.me = null; ST.hadMe = false; ST.step = "name"; ST.view = "q"; ST.err = "Your teacher freed your name. Pick it again."; draw(true); }, 2500);
            return;
        }
        const d = s.data();
        if (d.err) { ST.err = d.err; ST.step = "name"; ST.pick = null; ST.busy = false; draw(); return; }
        ST.me = d; ST.hadMe = true; ST.busy = false; ST.err = "";
        if (ST.skinsSeen == null) ST.skinsSeen = V.skinsOpen(d.top);
        if (d.hit && d.hit.at > ST.seenHit && d.need) { ST.view = "hit"; }
        if (ST.view === "q" && ST.sentQ >= 0 && d.fb && d.fb.q === ST.sentQ) {
            if (d.fb.exit) { ST.sentQ = -1; pad.clear(); }   // exit ticket: straight on to the next question, no right or wrong
            else if (d.fb.step && !d.fb.ok) ST.sentQ = -1;   // step help: they stay on the question (the step pops up on the right)
            else { ST.view = "fb"; ST.sentQ = -1; if (!d.fb.retry) pad.clear(); }   // a second try keeps the work
        }
        // Step help: a new step (after a miss, or by itself when they've been stuck a while) pops up on the right, open.
        if (d.fb && d.fb.step && !d.fb.ok && d.fb.t !== ST.stepT && d.q && d.q.n === d.fb.q) {
            ST.stepT = d.fb.t; ST.stepInk = pad.len(); ST.stepNew = { kind: d.fb.kind, at: Date.now() };
            if ((d.fb.sp || []).length && d.fb.kind !== "read") { ST.stepMin = false; if (d.fb.kind !== "fast") ST.stepAt = Date.now(); }
            sfx(d.fb.kind === "auto" ? "tap" : "miss"); ST.err = "";
            if (ST.view === "q") { draw(true); return; }   // rebuild the question card (the pad keeps its work)
        }
        if (ST.view === "guess" && ST.sentK && d.hk && d.hk.n === ST.sentK) { ST.sentK = 0; ST.guess = ""; }
        notices(d);
        draw();
    }, () => {});
}
function stopAll() { if (unsubRoom) unsubRoom(); if (unsubMe) unsubMe(); unsubRoom = unsubMe = null; }
const mine = () => doc(db, "rooms", ST.code, "p", ST.uid);
function send(data) {
    return setDoc(mine(), Object.assign({ at: Date.now() }, data), { merge: true }).catch((e) => {
        ST.busy = false; ST.sentQ = -1; ST.sentK = 0;
        ST.err = (e && e.code) === "permission-denied" ? "The game isn't taking answers right now." : "That didn't send. Check the Wi-Fi and try again.";
        draw();
    });
}

/* ---------- reading handwriting ----------
   Chrome's Handwriting Recognition API runs on the device (it is on Chromebooks); nothing is sent
   anywhere. Where it is missing, the Circle tool is simply not shown. */
const CAN_READ = typeof navigator !== "undefined" && "createHandwritingRecognizer" in navigator;
let reader = null;
async function readInk(list) {
    if (!reader) reader = await navigator.createHandwritingRecognizer({ languages: ["en"] });
    const d = reader.startDrawing({ recognitionType: "text", alternatives: 3 });
    let t = 0;
    list.slice().sort((a, b) => Math.min(...a.p.map((p) => p[0])) - Math.min(...b.p.map((p) => p[0]))).forEach((s) => {
        const hs = new HandwritingStroke(); s.p.forEach(([x, y]) => { hs.addPoint({ x, y, t }); t += 8; }); t += 120; d.addStroke(hs);
    });
    const preds = await d.getPrediction(); d.clear();
    return cleanRead(preds && preds[0] ? preds[0].text : "");
}
/** Tidy what the reader saw: letters that look like digits in a number (O for 0, l for 1), a long dash for minus. */
function cleanRead(raw) {
    let t = String(raw || "").replace(/[−–—]/g, "-").replace(/\s+/g, " ").trim().slice(0, 40);
    if (/\d/.test(t) && !/[a-np-z]{2,}/i.test(t.replace(/[oOlI|]/g, "")) ) t = t.replace(/(?<=[\d.\-\/ ]|^)[oO](?=[\d.\/ ]|$)/g, "0").replace(/(?<=[\d.\-\/ ]|^)[lI|](?=[\d.\/ ]|$)/g, "1");
    return t.replace(/(\d) (?=\d)/g, "$1");
}

/* ---------- the work pad ----------
   The same canvas-first whiteboard as the board: paper across most of the screen, a floating
   tool rail, and the math tools (js/mathPad.js) on a layer under the ink. */
const pad = (() => {
    const W = 1000, PENS = { ink: ["#14213D", "Navy"], blue: ["#1552D6", "Blue"], red: ["#C62828", "Red"], green: ["#1B7F3B", "Green"] }, SIZES = [3, 6, 11];
    let H = 600, strokes = [], items = [], hist = [], host = null, canvas = null, ctx = null, mp = null, cur = null, ro = null;
    let tool = "pen", pen = "ink", size = 1, dirty = false, sentAt = 0;
    // The teacher's work, sent with a question that was gone over (Send it back): a picture under the student's ink.
    // bg = { k, src, img, box: [x, y, w, h] in pad units }. The eraser and Clear only touch the student's own work.
    let bg = null, bgEl = null;
    function placeBg() {
        if (!bgEl) return; if (!bg || !host) { bgEl.remove(); return; }
        const [x, y, w, h] = bg.box; Object.assign(bgEl.style, { left: x / W * 100 + "%", top: y / H * 100 + "%", width: w / W * 100 + "%", height: h / H * 100 + "%" });
        if (!bgEl.isConnected) { const cv = host.querySelector(".padcv"); host.insertBefore(bgEl, cv || null); }
    }
    function setBg(rw) {
        if (!rw || !rw.img) { if (bg) { bg = null; placeBg(); } return; }
        if (bg && bg.k === rw.k) { placeBg(); return; }
        // Fit it in the top left, past the tool rail, about as wide as it was on the board, leaving room to keep working.
        const ar = (+rw.w || 1) / (+rw.h || 1), maxW = W - 110, maxH = H * 0.7;
        let w = Math.min(maxW, Math.max(120, (+rw.fw || 0.5) * W)), h = w / ar; if (h > maxH) { h = maxH; w = h * ar; }
        const img = new Image(); img.src = rw.img; img.alt = "";
        bg = { k: rw.k, src: rw.img, img, box: [96, 14, Math.round(w), Math.round(h)] };
        bgEl = el("img", "padbg"); bgEl.src = rw.img; bgEl.alt = "Your teacher's work"; bgEl.draggable = false; placeBg();
    }
    function paint() {
        if (!ctx) return; ctx.clearRect(0, 0, W, H); ctx.lineCap = ctx.lineJoin = "round";
        strokes.forEach((s) => {
            ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over"; ctx.globalAlpha = s.h ? 0.35 : 1;
            ctx.setLineDash(s.ring ? [14, 10] : []);
            ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.beginPath(); s.p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            if (s.p.length === 1) ctx.lineTo(s.p[0][0] + 0.1, s.p[0][1]); ctx.stroke();
        });
        ctx.setLineDash([]); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }
    const at = (e) => { const r = canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)]; };
    const snap = () => { hist.push(JSON.stringify({ strokes, items: mp ? mp.items() : items })); if (hist.length > 60) hist.shift(); };
    const saved = () => { if (mp) items = mp.items(); dirty = true; };
    function undo() { const last = hist.pop(); if (!last) return; const d = JSON.parse(last); strokes = d.strokes || []; items = d.items || []; if (mp) mp.setItems(items); dirty = true; paint(); }
    /** The paper's shape follows the screen: the width is always 1000, the height follows. */
    function fit() {
        if (!host || !host.isConnected) return; const r = host.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
        const h = Math.max(200, Math.round(W * r.height / r.width)); if (h !== H || canvas.height !== h) { H = h; canvas.height = H; paint(); placeBg(); }
        if (mp) mp.resize();
    }
    function rail() {
        const t = el("div", "wbrail"); t.id = "padrail"; t.setAttribute("role", "toolbar"); t.setAttribute("aria-label", "Work pad tools");
        const moving = !!(mp && mp.on);
        const b = (name, label, on, fn, cls) => { const x = el("button", "rb" + (cls ? " " + cls : "")); x.type = "button"; x.innerHTML = wbIcon(name); x.title = label; x.setAttribute("aria-label", label); if (on != null) x.setAttribute("aria-pressed", String(on)); x.onclick = fn; t.append(x); return x; };
        const pick = (k) => () => { tool = k; if (mp) mp.setOn(false); retool(); };
        b("pen", "Pen", !moving && tool === "pen", pick("pen"));
        b("hi", "Highlighter", !moving && tool === "hi", pick("hi"));
        b("eraser", "Eraser", !moving && tool === "eraser", pick("eraser"));
        b("move", "Move the math tools", moving, () => { if (mp) mp.setOn(!mp.on); retool(); });
        if (CAN_READ) b("circle", "Circle your answer to put it in the answer box", !moving && tool === "circle", pick("circle"), "prb-circle" + (tool === "circle" && !moving ? " on" : ""));
        t.append(el("i", "rsep"));
        const sw = el("div", "rsw");
        Object.keys(PENS).forEach((k) => { const x = el("button", "sw"); x.type = "button"; x.style.background = PENS[k][0]; x.title = PENS[k][1] + " pen"; x.setAttribute("aria-label", x.title); x.setAttribute("aria-pressed", String(pen === k)); x.onclick = () => { pen = k; if (tool !== "pen") tool = "pen"; if (mp) mp.setOn(false); retool(); }; sw.append(x); });
        t.append(sw);
        const sz = el("button", "rb size"); sz.type = "button"; sz.title = ["Thin", "Medium", "Thick"][size] + " line (tap to change)"; sz.setAttribute("aria-label", sz.title);
        const dot = el("i"); dot.style.width = dot.style.height = [0.35, 0.6, 0.9][size] + "em"; dot.style.background = tool === "hi" ? "#F2B33D" : pen === "ink" ? "#F4F7FB" : PENS[pen][0]; sz.append(dot);
        sz.onclick = () => { size = (size + 1) % 3; retool(); }; t.append(sz);
        t.append(el("i", "rsep"));
        b("math", "Add a math tool", null, () => { if (mp) mp.openMenu(); }, "amber");
        b("undo", "Undo", null, undo);
        b("trash", "Clear the pad", null, () => { if (!strokes.length && !(mp && mp.items().length)) return; snap(); strokes = []; items = []; if (mp) mp.clear(); dirty = true; paint(); });
        return t;
    }
    function retool() { const old = $("padrail"); if (old) old.replaceWith(rail()); }
    /* Circle your answer: the pen strokes inside the loop are read as handwriting (the browser's own
       handwriting reader, which Chromebooks have) and the result goes into the answer box. The loop
       stays on the pad as a dashed ring so the teacher can see what was circled. */
    async function circled(ring) {
        const poly = ring.p; strokes = strokes.filter((s) => !s.ring || s === ring);
        if (poly.length < 6) { strokes = strokes.filter((s) => s !== ring); paint(); return; }
        const inside = ([x, y]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
        const picked = strokes.filter((s) => !s.ring && !s.e && !s.h && s.p.filter(inside).length >= s.p.length * 0.6);
        dirty = true; paint();
        if (!picked.length) { padMsg("Circle the answer you wrote with the pen."); return; }
        padMsg("Reading your answer…");
        let text = "";
        try { text = await readInk(picked); } catch (e) { text = ""; }
        if (!text) { padMsg("Couldn't read that. Write it a little bigger, or type it in the box."); return; }
        if (ST.box) ST.box.fill(text);
        padMsg("Put " + text + " in the answer box. Check it, then Submit.");
    }
    function padMsg(t) {
        if (!host) return; let m = host.querySelector(".pcirclemsg");
        if (!m) { m = el("div", "pcirclemsg"); m.setAttribute("role", "status"); host.append(m); }
        m.textContent = t; clearTimeout(padMsg.t); padMsg.t = setTimeout(() => m.remove(), 4500);
    }
    function mount(h) {
        host = h; canvas = el("canvas", "padcv"); canvas.width = W; canvas.height = H; canvas.setAttribute("aria-label", "Work pad. Draw your work here."); ctx = canvas.getContext("2d");
        host.append(canvas);
        canvas.onpointerdown = (e) => {
            if (e.button) return; e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
            if (mp) mp.closeMenu();
            if (tool === "circle") { cur = { ring: 1, c: "#F2B33D", w: 4, p: [at(e)] }; strokes.push(cur); paint(); return; }
            snap();
            cur = tool === "eraser" ? { e: 1, c: "#000", w: [18, 32, 56][size], p: [at(e)] } : tool === "hi" ? { h: 1, c: "#F2B33D", w: [14, 22, 34][size], p: [at(e)] } : { c: PENS[pen][0], w: SIZES[size], p: [at(e)] };
            strokes.push(cur); paint();
        };
        canvas.onpointermove = (e) => { if (!cur) return; e.preventDefault(); const p = at(e), l = cur.p[cur.p.length - 1]; if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) > 2) { cur.p.push(p); paint(); } };
        canvas.onpointerup = canvas.onpointercancel = () => {
            if (!cur) return;
            if (cur.ring) { const ring = cur; cur = null; circled(ring); return; }
            cur = null; dirty = true;
        };
        mp = createMathPad(host, canvas, { change: snap, commit: saved, onMode: () => retool() });
        mp.setItems(items); host.append(rail());
        if (ro) ro.disconnect();
        if (window.ResizeObserver) { ro = new ResizeObserver(() => fit()); ro.observe(host); }
        if (bgEl) bgEl.remove(); placeBg();
        requestAnimationFrame(fit); paint();
    }
    /** A picture of the work for the teacher: the math tools under the ink, on white. */
    function image() {
        if (!strokes.length && !(mp ? mp.items() : items).length && !bg) return "";
        const c = document.createElement("canvas"); c.width = 640; c.height = Math.round(640 * H / W); const x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        if (bg && bg.img.complete && bg.img.naturalWidth) { const [bx, by, bw, bh] = bg.box, sx = c.width / W, sy = c.height / H; try { x.drawImage(bg.img, bx * sx, by * sy, bw * sx, bh * sy); } catch (e) { /* the picture didn't load: send the student's own work */ } }
        if (mp && mp.el.width) x.drawImage(mp.el, 0, 0, c.width, c.height);
        x.drawImage(canvas, 0, 0, c.width, c.height);
        let url = c.toDataURL("image/png"); if (url.length > 380000) url = c.toDataURL("image/jpeg", 0.7);
        return url.length > 395000 ? c.toDataURL("image/jpeg", 0.45) : url;
    }
    return {
        mount, image, setBg,
        clear() { strokes = []; items = []; hist = []; dirty = false; bg = null; placeBg(); if (mp) mp.clear(); paint(); },
        dirty: () => dirty, sent() { dirty = false; sentAt = Date.now(); }, sentAt: () => sentAt, has: () => strokes.length > 0,
        /** Real work on the pad: pen strokes (not eraser) adding up to more than a quick tap, or math typed in a text box. */
        shown() { return this.len() >= 60; },
        /** How much work is on the pad: pen length in pad units, plus 40 for each character typed in a text box. */
        len() {
            let len = 0;
            strokes.forEach((s) => { if (s.e || s.ring) return; for (let i = 1; i < s.p.length; i++) len += Math.hypot(s.p[i][0] - s.p[i - 1][0], s.p[i][1] - s.p[i - 1][1]); });
            (mp ? mp.items() : items).forEach((it) => { if (it.k === "text") len += 40 * String(it.txt || "").replace(/\s/g, "").length; });
            return len;
        }
    };
})();
// Live work: when the teacher turns it on, the pad is sent every few seconds while it changes.
// A student the teacher called up to the board sends it about every second, so the class watches it live.
const calledUp = () => !!(ST.room && ST.uid && ST.room.call === ST.uid && ST.room.status === "play");
setInterval(() => {
    const called = calledUp(), q = curQ(ST.me);
    if (!ST.room || !(ST.room.live || called) || !ST.me || ST.me.status !== "play" || !q || ST.view !== "q" || !pad.dirty() || Date.now() - pad.sentAt() < (called ? 900 : 5000)) return;
    const img = pad.image(); pad.sent(); send({ img, iq: q.n, it: Date.now() });
}, 300);

/* ---------- the answer box ----------
   A plain box, a fraction (top and bottom boxes over a bar) and a mixed number, plus a ready-made
   shape when the answer needs one: tap a choice for how many solutions, a base and an exponent
   (3³), scientific notation (8 × 10⁵) or one box per number (6 and 7). The Remote says which one
   fits the question (V.answerKind); a student can still switch to a plain box. */
const KINDS = [["", "Number"], ["frac", "Fraction"], ["mixed", "Mixed number"]];
const SPECIAL = { sol: ["Choose", "✓"], mc: ["Choose", "✓"], pow: ["Exponent", "xⁿ"], sci: ["Sci. notation", "×10ⁿ"], list: ["Boxes", "□ □"] };
const SOLS = ["One solution", "No solution", "Infinitely many solutions"];
function answerBox(kind, options) {
    if (kind === "mc" && !(Array.isArray(options) && options.length >= 2)) kind = "";   // multiple choice needs its choices
    const ineq = kind === "ineq"; if (ineq || (kind && !SPECIAL[kind] && !/^list[2-4]$/.test(kind) && !KINDS.some((k) => k[0] === kind))) kind = "";   // an inequality (or a shape this page doesn't know) goes in the plain box
    const lm = /^list([2-4])$/.exec(kind || ""), sk = lm ? "list" : SPECIAL[kind] ? kind : "", count = lm ? +lm[1] : 0;
    const kinds = sk === "mc" ? [["mc", "Choose"]] : (sk ? [[sk, SPECIAL[sk][0]]] : []).concat(KINDS);   // multiple choice: tap a choice, no other box
    const wrap = el("div", "pabox"); let mode = kinds.some((k) => k[0] === kind || k[0] === sk) ? (sk || kind) : "", neg = false, choice = "";
    const tabs = el("div", "patabs"); tabs.setAttribute("role", "radiogroup"); tabs.setAttribute("aria-label", "Answer type");
    const field = el("div", "pafield");
    const num = (label, cls) => { const i = el("input", "pnum" + (cls ? " " + cls : "")); i.inputMode = "numeric"; i.autocomplete = "off"; i.maxLength = 7; i.setAttribute("aria-label", label); i.oninput = () => { i.value = i.value.replace(/[^\d.]/g, "").slice(0, 7); }; return i; };
    // A box in a ready-made shape: numbers with a minus sign or decimal point (and letters for a base like x).
    const cell = (label, cls, letters) => { const i = el("input", "pnum" + (cls ? " " + cls : "")); i.autocomplete = "off"; i.maxLength = 8; i.inputMode = letters ? "text" : "decimal"; i.setAttribute("aria-label", label); i.oninput = () => { i.value = i.value.replace(/[−–]/g, "-").replace(letters ? /[^\da-zA-Z.\-]/g : /[^\d.\-]/g, "").slice(0, 8); }; return i; };
    const text = el("input", "ptext"); text.maxLength = 80; text.autocomplete = "off"; text.placeholder = ineq ? "Like x > 3" : "Your answer"; text.setAttribute("aria-label", "Your answer");
    // Inequality answers get buttons for the signs a Chromebook keyboard doesn't have (≤ ≥), plus the rest.
    const syms = el("div", "pasyms"); syms.setAttribute("aria-label", "Math symbols");
    if (ineq) ["x", "<", ">", "≤", "≥", "−", "or", "and"].forEach((sy) => {
        const b = btn("pasym", sy, () => {
            const put = sy === "or" || sy === "and" ? " " + sy + " " : sy === "−" ? "-" : sy, a = text.selectionStart != null ? text.selectionStart : text.value.length, z = text.selectionEnd != null ? text.selectionEnd : a;
            text.value = (text.value.slice(0, a) + put + text.value.slice(z)).slice(0, 80); const c = Math.min(80, a + put.length); text.focus(); try { text.setSelectionRange(c, c); } catch {}
        });
        b.onmousedown = (e) => e.preventDefault();   // keep the cursor in the box
        b.setAttribute("aria-label", { "<": "less than", ">": "greater than", "≤": "less than or equal to", "≥": "greater than or equal to", "−": "negative", x: "x", or: "or", and: "and" }[sy]);
        syms.append(b);
    });
    const whole = num("Whole number", "whole"), top = num("Top number (numerator)"), bot = num("Bottom number (denominator)");
    top.onkeydown = (e) => { if (e.key === "/" || (e.key === "Enter" && top.value && !bot.value)) { e.preventDefault(); bot.focus(); } };
    whole.onkeydown = (e) => { if (e.key === " " || (e.key === "Enter" && whole.value && !top.value)) { e.preventDefault(); top.focus(); } };
    const sign = btn("pasign", "+/−", () => { neg = !neg; sign.classList.toggle("on", neg); sign.setAttribute("aria-pressed", String(neg)); sign.textContent = neg ? "−" : "+/−"; });
    sign.setAttribute("aria-label", "Make it negative"); sign.setAttribute("aria-pressed", "false");
    const frac = el("span", "pafrac"); frac.append(top, el("i"), bot);
    // The ready-made shapes.
    const base = cell(kind === "pow" ? "Base" : "Number", "base", kind === "pow"), exp = cell("Exponent", "exp");
    exp.maxLength = 4;
    // Only one of these shapes is ever offered for a question, so they can share the two boxes.
    const powEl = el("span", "papow" + (sk === "sci" ? " sci" : ""));
    if (sk === "sci") powEl.append(base, el("span", "pax", "× 10"), exp); else powEl.append(base, exp);
    const boxes = Array.from({ length: count }, (_, i) => cell("Answer " + (i + 1) + " of " + count, "item"));
    const listEl = el("span", "palist"); boxes.forEach((b, i) => { if (i) listEl.append(el("span", "pajoin", i === count - 1 ? (count > 2 ? ", and" : "and") : ",")); listEl.append(b); });
    boxes.forEach((b, i) => { b.onkeydown = (e) => { if ((e.key === "," || e.key === " " || (e.key === "Enter" && b.value)) && boxes[i + 1] && !boxes[i + 1].value) { e.preventDefault(); boxes[i + 1].focus(); } }; });
    base.onkeydown = (e) => { if ((e.key === "^" || (e.key === "Enter" && base.value && !exp.value))) { e.preventDefault(); exp.focus(); } };
    const choiceEl = el("div", "pachoices" + (sk === "mc" ? " mc" : "")); choiceEl.setAttribute("role", "radiogroup"); choiceEl.setAttribute("aria-label", sk === "mc" ? "Answer choices" : "How many solutions?");
    (sk === "mc" ? options : SOLS).forEach((label, k) => {
        const c = btn("pachoice", sk === "mc" ? null : label, () => { choice = label; [...choiceEl.children].forEach((x) => { const on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); }); });
        if (sk === "mc") { c.append(el("b", "pachl", "ABCDE"[k]), mathEl("span", "pacht", label)); c.setAttribute("aria-label", "ABCDE"[k] + ": " + label); }
        c.setAttribute("role", "radio"); c.setAttribute("aria-checked", "false"); choiceEl.append(c);
    });
    const first = () => mode === "" ? text : mode === "mixed" ? whole : mode === "frac" ? top : mode === "list" ? boxes[0] : mode === "sol" || mode === "mc" ? choiceEl.firstChild : base;
    function show() {
        field.textContent = ""; field.classList.toggle("choices", mode === "sol" || mode === "mc");
        if (mode === "") { field.append(text); if (syms.childNodes.length) field.append(syms); }
        else if (mode === "sol" || mode === "mc") field.append(choiceEl);
        else if (mode === "pow" || mode === "sci") field.append(powEl);
        else if (mode === "list") field.append(listEl);
        else { field.append(sign); if (mode === "mixed") field.append(whole); field.append(frac); }
        [...tabs.children].forEach((b) => { const on = b.dataset.k === mode; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
    }
    kinds.forEach(([k, n]) => {
        const b = btn("patab", null, () => { mode = k; show(); first().focus(); });
        b.dataset.k = k; b.setAttribute("role", "radio"); b.title = n; b.setAttribute("aria-label", n);
        if (k === "") b.append(el("b", null, "123"));
        else if (SPECIAL[k]) b.append(el("b", null, SPECIAL[k][1]));
        else { const f = el("span", "frac"); f.append(el("span", null, "a"), el("span", null, "b")); if (k === "mixed") b.append(el("b", null, "1")); b.append(f); }
        b.append(el("small", null, n.replace(" number", ""))); tabs.append(b);
    });
    if (sk === "mc") tabs.hidden = true;   // only one way to answer
    wrap.append(tabs, field); show();
    return {
        el: wrap,
        focus() { first().focus(); },
        /** Put an answer read from the work pad into the box: into the fraction or exponent boxes when it fits them, otherwise the plain box. */
        fill(t) {
            t = String(t || "").trim(); if (!t) return;
            let m;
            if ((mode === "frac" || mode === "mixed") && (m = /^(-?)(?:(\d+) )?(\d+)\/(\d+)$/.exec(t))) { if (neg !== !!m[1]) sign.click(); whole.value = m[2] || ""; top.value = m[3]; bot.value = m[4]; if (m[2] && mode === "frac") { mode = "mixed"; show(); } return; }
            if (mode === "pow" && (m = /^(-?[\da-z.]+)\^(-?\d+)$/i.exec(t))) { base.value = m[1]; exp.value = m[2]; return; }
            if (mode === "list") { const parts = t.split(/\s*(?:,|and|&)\s*|\s+/).filter(Boolean); if (parts.length === count) { boxes.forEach((b, i) => { b.value = parts[i]; }); return; } }
            mode = ""; text.value = t.slice(0, 80); show();
        },
        /** The answer as text ("3/4", "-1 1/2", "12", "3^3", "8 × 10^5", "6, 7"), or an error message to show. */
        read() {
            if (mode === "") return { t: text.value.trim() };
            if (mode === "sol" || mode === "mc") return choice ? { t: choice } : { err: "Tap one of the choices." };
            if (mode === "pow" || mode === "sci") {
                const x = base.value.trim(), e = exp.value.trim();
                if (!x || !e) return { err: mode === "pow" ? "Fill in the base and the exponent." : "Fill in the number and the power of 10." };
                return { t: mode === "pow" ? x + "^" + e : x + " × 10^" + e };
            }
            if (mode === "list") { const v = boxes.map((b) => b.value.trim()); if (v.some((x) => !x)) return { err: "Fill in every box." }; return { t: v.join(", ") }; }
            const w = whole.value.trim(), a = top.value.trim(), b = bot.value.trim(), s = neg ? "-" : "";
            if (mode === "mixed" && w && !a && !b) return { t: s + w };
            if (!a || !b) return { err: mode === "mixed" ? "Fill in the whole number, the top and the bottom." : "Fill in the top and the bottom of the fraction." };
            if (+b === 0) return { err: "The bottom number can't be 0." };
            return { t: s + (mode === "mixed" && w ? w + " " : "") + a + "/" + b };
        }
    };
}

/* ---------- celebrations ---------- */
const calm = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** A burst of paper confetti from a point on the screen (x, y as 0 to 1). */
function confetti(n, x0, y0, colors) {
    if (calm()) return;
    const c = el("canvas", "pconfetti"), d = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    c.width = W * d; c.height = H * d; document.body.append(c); const x = c.getContext("2d"); x.scale(d, d);
    const cols = colors || ["#F2B33D", "#7FAEDD", "#1F9D61", "#FFFFFF", "#F6D58A", "#1552D6"];
    const ps = Array.from({ length: n }, () => { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 7 + Math.random() * 9; return { x: W * x0, y: H * y0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)] }; });
    const t0 = performance.now();
    (function frame(t) {
        const age = t - t0; x.clearRect(0, 0, W, H);
        ps.forEach((p) => { p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.globalAlpha = Math.max(0, 1 - age / 2200); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, Math.abs(Math.cos(p.r * 2)) * p.h + 1); x.restore(); });
        if (age < 2200) requestAnimationFrame(frame); else c.remove();
    })(t0);
}
/** Count a number up on screen. */
function countUp(node, to, prefix) {
    if (calm() || to <= 0) { node.textContent = prefix + to; return; }
    const t0 = performance.now(), ms = 700;
    (function frame(t) { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); node.textContent = prefix + Math.round(to * e); if (k < 1) requestAnimationFrame(frame); })(t0);
}
let celebrated = "", lastScreen = "";
/** Run a celebration once for this event, not on every redraw. */
const once = (key, fn) => { if (celebrated === key) return; celebrated = key; setTimeout(fn, 60); };

/* ---------- pictures (drawn here, no image files) ---------- */
const svg = (inner, cls, vb) => { const s = el("span", "pic" + (cls ? " " + cls : "")); s.innerHTML = '<svg viewBox="' + (vb || "0 0 120 120") + '" aria-hidden="true" focusable="false">' + inner + "</svg>"; return s; };
/** A round vault door with a dial. open: the door swings away and coins show. */
function vaultPic(cls, vs) {
    const k = V.skin(vs)[3];
    const bolts = [0, 60, 120, 180, 240, 300].map((a) => { const r = a * Math.PI / 180; return '<circle cx="' + (60 + 46 * Math.cos(r)).toFixed(1) + '" cy="' + (60 + 46 * Math.sin(r)).toFixed(1) + '" r="3.2" fill="' + k.ring + '"/>'; }).join("");
    const extra = (k.stars ? [[30, 34], [86, 30], [92, 80], [26, 82], [60, 98], [44, 18]].map(([x, y], i) => '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 2 ? 1.6 : 2.4) + '" fill="#fff"/>').join("") : "")
        + (k.shine ? '<path d="M22 40L40 22M28 52L52 28" stroke="#fff" stroke-opacity=".7" stroke-width="4" stroke-linecap="round"/><path d="M92 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff"/>' : "");
    const ticks = Array.from({ length: 12 }, (_, i) => '<line x1="60" y1="36" x2="60" y2="' + (i % 3 ? 39 : 41) + '" stroke="#081B45" stroke-width="2" transform="rotate(' + i * 30 + ' 60 60)"/>').join("");
    return svg('<g class="vcoins"><circle cx="48" cy="66" r="12" fill="#F2B33D"/><circle cx="66" cy="58" r="12" fill="#F6C866"/><circle cx="72" cy="74" r="12" fill="#F2B33D"/></g>'
        + '<g class="vdoor"><circle cx="60" cy="60" r="56" fill="' + k.door + '"/><circle cx="60" cy="60" r="56" fill="none" stroke="' + k.ring + '" stroke-width="4"/>' + bolts + extra
        + '<circle cx="60" cy="60" r="30" fill="' + k.face + '"/><g class="vdial">' + ticks + '<path d="M60 60L60 24" stroke="#F2B33D" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="60" r="9" fill="#081B45"/></g></g>', "vault" + (cls ? " " + cls : ""));
}
const coinPic = () => svg('<circle cx="60" cy="60" r="52" fill="#F2B33D"/><circle cx="60" cy="60" r="40" fill="none" stroke="#FFE3A3" stroke-width="5"/><path d="M60 36v48M48 46h18a8 8 0 010 16H54a8 8 0 000 16h18" fill="none" stroke="#8A5F00" stroke-width="7" stroke-linecap="round"/>', "coin");
const lockPic = () => svg('<rect x="24" y="52" width="72" height="56" rx="12" fill="#B4232A"/><path d="M40 52V38a20 20 0 0136-12" fill="none" stroke="#F4F7FB" stroke-width="9" stroke-linecap="round"/><circle cx="60" cy="78" r="8" fill="#F4F7FB"/><path d="M60 84v10" stroke="#F4F7FB" stroke-width="6" stroke-linecap="round"/>', "lock");
function medal(rank) {
    const c = rank === 1 ? ["#F2B33D", "#8A5F00"] : rank === 2 ? ["#C9D3E3", "#55627F"] : rank === 3 ? ["#D99A63", "#6B3F16"] : ["#7FAEDD", "#081B45"];
    const s = svg('<path d="M38 6l14 40M82 6L68 46" stroke="#1552D6" stroke-width="12"/><circle cx="60" cy="72" r="40" fill="' + c[0] + '"/><circle cx="60" cy="72" r="31" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4"/>', "medal");
    s.append(el("b", null, String(rank))); s.style.setProperty("--mk", c[1]); return s;
}
/** Flames for the streak: one lit per right answer in a row, up to 5. */
function streakRow(st) {
    const r = el("div", "pstreak"); r.setAttribute("aria-label", st + " in a row");
    for (let i = 0; i < 5; i++) r.append(svg('<path d="M60 8c4 22 30 34 30 62a30 30 0 01-60 0c0-14 8-22 14-30 2 10 8 14 12 14-4-16 0-34 4-46z"/>', "flame" + (i < st ? " lit" : ""), "0 0 120 120"));
    return r;
}
const STREAK_WORDS = { 2: "Two in a row!", 3: "On a roll!", 4: "Heating up!", 5: "On fire!", 7: "Unstoppable!", 10: "Legendary!" };
const RIGHT_WORDS = ["Right!", "Nailed it!", "Yes!", "Correct!", "Got it!"];
const MISS_WORDS = ["Shake it off. The next one is yours.", "Close one. Check the answer and keep going.", "Mistakes help you learn. Keep going!"];

function toast(text, cls) {
    const t = el("div", "ptoast" + (cls ? " " + cls : ""), text); t.setAttribute("role", "status"); document.body.append(t);
    setTimeout(() => t.classList.add("out"), 3600); setTimeout(() => t.remove(), 4200);
}
// The bonus round and firewall end on their own: check every second so the badges go away.
setInterval(() => { if (ST.me && !!ST.fogOn !== fogged(ST.me)) stats(); if (ST.view === "q" && ST.me && ST.me.status === "play") { const fx = $("pfx"); if (fx) fx.replaceWith(effects(ST.me) || Object.assign(el("div", "pfx"), { id: "pfx" })); refreshTools(); } }, 1000);

/* ---------- the waiting room: a character and a starting power-up ---------- */
/** Character and power-up picks go in their own small write, so a site whose rules are older still lets the game run. */
function pick(data) {
    Object.assign(ST.picks, data); showPicks();
    setDoc(mine(), Object.assign({ at: Date.now() }, data), { merge: true }).catch(() => { ST.pickErr = true; showPicks(); });
}
/** Mark the picks in place, so tapping a character or a power-up doesn't redraw the page. */
function showPicks() {
    const m = ST.me || {}, av = ST.picks.av != null ? ST.picks.av : m.av, pu = ST.picks.pu != null ? ST.picks.pu : m.pu;
    document.querySelectorAll(".wravatar").forEach((b, i) => { const on = i === av; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
    document.querySelectorAll(".wrpower").forEach((b) => { const on = b.dataset.k === pu; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
    const me = document.querySelector(".wrme"); if (me) me.textContent = V.avatar(av)[0];
    const n = document.querySelector(".wroom > .pnote"); if (n) n.textContent = pickNote(pu);
    const nm = document.querySelector("#stats .pstat b"); if (nm && m.nm) nm.textContent = V.avatar(av)[0] + " " + m.nm;
}
const pickNote = (pu) => (ST.pickErr ? "Characters and power-ups aren't switched on for this game yet. You can still play." : pu ? "Ready! You can change your picks until the game starts." : "Pick one. It works once the game starts.");
function waitingRoom(card, m) {
    card.classList.add("lobby", "wide", "wroom");
    const av = ST.picks.av != null ? ST.picks.av : m.av, pu = ST.picks.pu != null ? ST.picks.pu : m.pu;
    const head = el("div", "wrhead"), me = el("span", "wrme", V.avatar(av)[0]); me.setAttribute("aria-hidden", "true");
    const hi = el("div"); hi.append(el("h1", null, "You're in, " + m.nm + "!"));
    const w = el("p", "pwait"); w.append(document.createTextNode("Waiting for your teacher to start"), el("i"), el("i"), el("i")); hi.append(w);
    // The code stays blurred so classmates can't read it off the screen. Tap to see it for 3 seconds.
    const code = el("div", "wrcode"), digits = codeShow(m.code), peek = btn("wrpeek", null, () => {
        ST.peekUntil = Date.now() + 3000; hide(false);
        clearTimeout(ST.peekT); ST.peekT = setTimeout(() => { const d = document.querySelector(".wrcode .pcodeshow"), b = document.querySelector(".wrpeek"); if (d) d.classList.add("hid"); if (b) { b.textContent = "Tap to see it"; b.setAttribute("aria-pressed", "false"); } }, 3000);
    });
    const hide = (on) => { digits.classList.toggle("hid", on); peek.textContent = on ? "Tap to see it" : "Hiding in 3 s"; peek.setAttribute("aria-pressed", String(!on)); };
    peek.setAttribute("aria-label", "Show my secret code for 3 seconds"); hide(!((ST.peekUntil || 0) > Date.now()));
    code.append(el("small", null, "Your secret code"), digits, peek);
    head.append(me, hi, code); card.append(head);
    card.append(el("h2", "wrh", "Pick your character"));
    const grid = el("div", "wravatars"); grid.setAttribute("role", "radiogroup"); grid.setAttribute("aria-label", "Characters");
    V.AVATARS.forEach(([e, n], i) => { const b = btn("wravatar" + (i === av ? " on" : ""), e, () => pick({ av: i })); b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(i === av)); b.setAttribute("aria-label", n); b.title = n; grid.append(b); });
    card.append(grid);
    card.append(el("h2", "wrh", "Pick a power-up for the game"));
    const pus = el("div", "wrpowers"); pus.setAttribute("role", "radiogroup"); pus.setAttribute("aria-label", "Power-ups");
    V.STARTERS.forEach(([k, n, d]) => { const b = btn("wrpower" + (k === pu ? " on" : ""), null, () => pick({ pu: k })); b.dataset.k = k; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(k === pu)); b.append(powerIcon(k), el("b", null, n), el("small", null, d)); pus.append(b); });
    card.append(pus);
    card.append(el("p", "pnote", pickNote(pu)));
    card.append(practiceVault());
    card.append(el("h2", "wrh", "Vault skins"), el("p", "pnote", "Earn coins in the game to unlock new looks for your vault."), skinsGrid(m, false));
}
/** A quick game while they wait: crack a practice vault with the same marks as the real game. Nothing is sent anywhere. */
function practiceVault() {
    const mg = ST.mg || (ST.mg = { code: V.randomCode(), hist: [], cur: "" }), won = mg.hist.some((x) => x.m === "2".repeat(V.CODE_LEN));
    const best = +store.get("pvbest") || 0, w = el("div", "wrgame");
    const head = el("div", "wrgamehead"); head.append(vaultPic(won ? "open" : "mini", 0));
    const tt = el("div"); tt.append(el("h2", "wrh", "While you wait: crack the practice vault"), el("p", "pnote", "Same marks as the real game. Guess 3 different digits." + (best ? " Your best: " + best + (best === 1 ? " guess." : " guesses.") : "")));
    head.append(tt); w.append(head);
    const legend = el("p", "plegend"); legend.append(dot(2), document.createTextNode(" right spot  "), dot(1), document.createTextNode(" wrong spot  "), dot(0), document.createTextNode(" not in it")); w.append(legend);
    const hist = el("div", "phist");
    mg.hist.forEach((x) => { const r = el("div", "phrow"); [...x.g].forEach((d, i) => r.append(el("span", "phd m" + x.m[i], d))); hist.append(r); });
    w.append(hist);
    if (won) {
        const n = mg.hist.length; w.append(el("p", "pbig wrgamewin", "Cracked in " + n + (n === 1 ? " guess!" : " guesses!")));
        w.append(btn("pbtn go", "New practice vault", () => { ST.mg = null; draw(true); }));
        return w;
    }
    const slots = el("div", "pslots"); for (let i = 0; i < V.CODE_LEN; i++) slots.append(el("span", "pslot" + (mg.cur[i] ? " full" : ""), mg.cur[i] || ""));
    w.append(slots, keypad(mg.cur, (v) => { mg.cur = v; draw(true); }));
    const go = btn("pbtn go", "Try it", () => {
        if (!V.validCode(mg.cur)) return;
        const m = V.codeMarks(mg.code, mg.cur); mg.hist.push({ g: mg.cur, m }); mg.cur = "";
        if (m === "2".repeat(V.CODE_LEN)) { const n = mg.hist.length; if (!best || n < best) store.set("pvbest", String(n)); sfx("crack"); confetti(80, 0.5, 0.4, ["#F2B33D", "#F6C866", "#FFE3A3"]); } else sfx("tap");
        draw(true);
    });
    go.disabled = mg.cur.length !== V.CODE_LEN; w.append(go);
    return w;
}
const POWER_ICONS = {
    shield: '<path d="M60 10l40 14v30c0 28-18 46-40 56-22-10-40-28-40-56V24z" fill="#7FAEDD"/><path d="M60 22l28 10v22c0 20-12 33-28 41z" fill="#10358A"/>',
    head: '<circle cx="60" cy="60" r="46" fill="#F2B33D"/><path d="M42 64l18-26 18 26M60 40v44" fill="none" stroke="#8A5F00" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>',
    double: '<circle cx="46" cy="60" r="32" fill="#F6C866"/><circle cx="74" cy="60" r="32" fill="#F2B33D"/><text x="74" y="72" text-anchor="middle" font-size="34" font-weight="800" fill="#8A5F00" font-family="sans-serif">×2</text>',
    keys: '<circle cx="40" cy="44" r="20" fill="none" stroke="#F2B33D" stroke-width="10"/><path d="M54 58l40 40M80 84l10-10M70 74l8-8" stroke="#F2B33D" stroke-width="10" stroke-linecap="round"/>',
    insure: '<path d="M20 60a40 40 0 0180 0z" fill="#1F9D61"/><path d="M60 60v38a10 10 0 01-20 0" fill="none" stroke="#0E1B3A" stroke-width="8" stroke-linecap="round"/>',
    bag: '<path d="M38 30h44l-8 14c20 8 30 26 30 42 0 14-14 22-44 22S16 100 16 86c0-16 10-34 30-42z" fill="#F2B33D"/><path d="M60 58v34M50 66h16a6 6 0 010 12H54a6 6 0 000 12h16" fill="none" stroke="#8A5F00" stroke-width="6" stroke-linecap="round"/>',
    hack: '<rect x="18" y="30" width="84" height="60" rx="10" fill="#081B45"/><path d="M34 52l14 10-14 10M56 74h24" fill="none" stroke="#7FFFB2" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    firewall: '<path d="M60 8c8 22 30 30 30 58a30 30 0 01-60 0c0-16 10-24 14-32 2 12 8 16 12 16-4-18 0-30 4-42z" fill="#F28C28"/><path d="M60 52c4 10 14 14 14 26a14 14 0 01-28 0c0-10 8-16 14-26z" fill="#FFE3A3"/>',
};
POWER_ICONS.comeback = '<circle cx="60" cy="60" r="50" fill="#1F9D61"/><path d="M60 92V34M36 56l24-24 24 24" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>';
POWER_ICONS.lock = '<rect x="22" y="52" width="76" height="56" rx="10" fill="#10358A"/><path d="M38 52V38a22 22 0 0144 0v14" fill="none" stroke="#10358A" stroke-width="12"/><circle cx="60" cy="78" r="9" fill="#F2B33D"/>';
POWER_ICONS.jam = '<circle cx="60" cy="60" r="48" fill="#C62828"/><path d="M38 38l44 44M82 38L38 82" stroke="#fff" stroke-width="12" stroke-linecap="round"/>';
POWER_ICONS.fog = '<path d="M30 74a20 20 0 010-40 28 28 0 0154-6 22 22 0 016 46z" fill="#8A97AD"/><path d="M20 92h80M34 106h52" stroke="#8A97AD" stroke-width="9" stroke-linecap="round"/>';
POWER_ICONS.tax = '<circle cx="60" cy="60" r="46" fill="#F2B33D"/><text x="60" y="76" text-anchor="middle" font-size="46" font-weight="800" fill="#8A5F00" font-family="sans-serif">%</text>';
POWER_ICONS.spy = '<circle cx="42" cy="66" r="18" fill="none" stroke="#10358A" stroke-width="9"/><circle cx="80" cy="66" r="18" fill="none" stroke="#10358A" stroke-width="9"/><path d="M60 62v0M16 50l18-24h52l18 24" fill="none" stroke="#10358A" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>';
POWER_ICONS.bonus = '<path d="M68 6L24 66h30l-8 48 46-64H60z" fill="#3A2A00"/>';
POWER_ICONS.dj = '<path d="M22 70V58a38 38 0 0176 0v12" fill="none" stroke="#10358A" stroke-width="10" stroke-linecap="round"/><rect x="12" y="62" width="24" height="40" rx="10" fill="#1552D6"/><rect x="84" y="62" width="24" height="40" rx="10" fill="#1552D6"/><circle cx="60" cy="40" r="7" fill="#F2B33D"/>';
POWER_ICONS.box = '<rect x="18" y="44" width="84" height="60" rx="8" fill="#10358A"/><rect x="12" y="30" width="96" height="20" rx="6" fill="#1552D6"/><rect x="52" y="30" width="16" height="74" fill="#F2B33D"/><path d="M60 30c-10-18-30-18-28-6 2 8 18 6 28 6 10 0 26 2 28-6 2-12-18-12-28 6z" fill="#F2B33D"/>';
const powerIcon = (k) => svg(POWER_ICONS[k] || POWER_ICONS.box, "pwicon");
/** What's helping right now: power-ups and the bonus round. */
function effects(m) {
    const list = [], now = Date.now(), bonus = Math.max(+m.bonus || 0, +(ST.room && ST.room.bonus) || 0);
    if (bonus > now) list.push(["bonus", "Bonus round ×2 · " + Math.ceil((bonus - now) / 1000) + " s", "hot"]);
    if (m.dbl > 0) list.push(["double", "Double coins: " + m.dbl + " left", ""]);
    if (m.blk) list.push(["shield", "Shield ready", ""]);
    if (m.fw > now) list.push(["firewall", "Firewall on", ""]);
    if (m.ins) list.push(["insure", "Insured", ""]);
    if (m.cb && m.status === "play" && !m.redo && !m.exit) list.push(["comeback", "Catch-up boost: +50% coins", ""]);
    const lock = Math.max(+m.lock || 0, +(ST.room && ST.room.lock) || 0);
    if (lock > now) list.push(["lock", "Lockdown · no hacking · " + Math.ceil((lock - now) / 1000) + " s", "hot"]);
    if (m.mb) list.push(["box", "Mystery drop: next right answer opens a box", ""]);
    if (m.jam > now) list.push(["jam", "Hacks jammed · " + Math.ceil((m.jam - now) / 1000) + " s", "bad"]);
    if (m.fog > now) list.push(["fog", "Fogged · " + Math.ceil((m.fog - now) / 1000) + " s", "bad"]);
    if (m.tax) list.push(["tax", "Taxed: your next right answer pays a quarter", "bad"]);
    if (m.djon && m.dj > 0) list.push(["dj", "DJ Ticket" + (m.dj > 1 ? " ×" + m.dj : "") + ": pick the song", ""]);
    if (!list.length) return null;
    const box = el("div", "pfx"); box.id = "pfx"; list.forEach(([k, t, c]) => { const x = el("span", "pfxc" + (c ? " " + c : "")); x.append(powerIcon(k), document.createTextNode(t)); box.append(x); });
    return box;
}
/** A mystery box from a right answer. What's inside already counts; opening it shows what it was. */
function mysteryBox(b, key) {
    const wrap = el("div", "pbox" + (ST.opened[key] ? " open" : ""));
    const name = { bag: "Coin bag: +" + b.v + " coins", hack: "Extra hack!", double: "Double coins on your next " + b.v + " right answers", firewall: "Firewall: your vault is safe for " + b.v + " seconds", dj: "DJ Ticket! Tap 🎧 DJ to pick the song" }[b.k] || "A surprise";
    if (!ST.opened[key]) {
        const go = btn("pboxbtn", null, () => { ST.opened[key] = 1; sfx("box"); wrap.classList.add("open"); go.replaceWith(prize()); confetti(70, 0.5, 0.55, ["#F2B33D", "#7FAEDD", "#FFFFFF"]); });
        go.append(powerIcon("box"), el("b", null, "Mystery box! Tap to open"));
        wrap.append(go);
    } else wrap.append(prize());
    function prize() { const p = el("div", "pboxprize"); p.append(powerIcon(b.k), el("b", null, name)); return p; }
    return wrap;
}

/* ---------- drawing the page ---------- */
function stats() {
    const s = $("stats"), m = ST.me;
    if (!m || !m.nm || ST.roomGone) { s.hidden = true; return; }
    s.hidden = false; s.textContent = "";
    const chip = (label, val, cls) => { const c = el("span", "pstat" + (cls ? " " + cls : "")); c.append(el("small", null, label), el("b", null, val)); s.append(c); };
    const was = ST.coins; ST.coins = m.c;
    chip("Name", V.avatar(m.status === "lobby" && ST.picks.av != null ? ST.picks.av : m.av)[0] + " " + m.nm); const fog = fogged(m); ST.fogOn = fog;
    chip("Coins", fog ? "???" : String(m.c), "coin" + (fog ? " fog" : was != null && m.c > was ? " up" : was != null && m.c < was ? " down" : "")); chip("Hacks", String(m.h)); if (m.status !== "lobby") chip("Place", fog ? "???" : m.rank + " of " + m.players, fog ? "fog" : "");
    const t = el("span", "pstat"); t.append(el("small", null, "Time"), el("b", null, "")); t.id = "ptime"; s.append(t); tickTime();
    if (!(ST.room && ST.room.snd === false)) {
        const on = store.get("mute") !== "1", b = btn("pstat pmute" + (on ? "" : " off"), null, () => { store.set("mute", on ? "1" : ""); stats(); if (!on) sfx("tap"); });
        b.append(el("small", null, "Sound"), el("b", null, on ? "On" : "Off")); b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", on ? "Sound is on. Tap to mute." : "Sound is off. Tap to turn it on."); s.append(b);
    }
}
const fogged = (m) => !!(m && m.status === "play" && +m.fog > Date.now());
function tickTime() {
    const t = $("ptime"); if (!t) return; const e = ST.me && ST.me.ends;
    t.hidden = !(ST.me && ST.me.status === "play" && e);
    const pz = ST.room && +ST.room.paused;
    if (!t.hidden) { const l = Math.max(0, e - (pz || Date.now())); t.lastChild.textContent = (pz ? "⏸ " : "") + Math.floor(l / 60000) + ":" + ("0" + Math.floor((l % 60000) / 1000)).slice(-2); }
}
setInterval(tickTime, 500);

/** The question on a student's screen: the game's, or the exit ticket's. */
const curQ = (m) => m && (m.q || (m.exit && m.exit.q)) || null;
/** Paused by the teacher: a cover over everything, without redrawing (the pad and anything typed stay). */
function pauseCover() {
    const on = !!(ST.room && ST.room.paused && ST.room.status === "play" && ST.me && ST.me.nm && !ST.roomGone);
    let c = $("ppause");
    if (on && !c) { c = el("div", "ppause"); c.id = "ppause"; c.setAttribute("role", "alert"); const b = el("div", "ppausebox"); b.append(el("b", null, "Paused"), el("p", null, "Eyes up here. Your teacher has something to show you.")); c.append(b); document.body.append(c); }
    else if (!on && c) c.remove();
}
/** Called up to the board: a banner, without redrawing (the pad and anything typed stay). */
function callBanner() {
    const on = calledUp() && !!(ST.me && ST.me.nm) && !ST.roomGone;
    let c = $("pcall");
    if (on && !c) { c = el("div", "pcall"); c.id = "pcall"; c.setAttribute("role", "status"); c.append(el("b", null, "You're on the board!"), el("span", null, "Work it out on your pad. The class sees it live.")); document.body.append(c); sfx("start"); }
    else if (!on && c) c.remove();
}
function draw(force) {
    pauseCover(); callBanner();
    const m = ST.me;
    if (m && m.nm && ST.step !== "play") ST.step = "play";
    const k = JSON.stringify([ST.step, ST.view, ST.err, ST.busy, ST.target, ST.guess, ST.vault, ST.sabK, ST.sentS, ST.mg && ST.mg.cur, ST.mg && ST.mg.hist.length, ST.roomGone, ST.room && [ST.room.status, ST.step === "name" ? [ST.room.taken, ST.room.names && ST.room.names.length] : 0, ST.room.bonus, ST.room.rw ? ST.room.rw.k : 0], m && [m.status === "lobby" ? 0 : m.n, m.status, m.need]]);
    if (k === sig && !force) return;
    // Keep the pad (and anything typed) while the same question stays on screen.
    const cq = curQ(m), sameQ = !force && ST.step === "play" && ST.view === "q" && cq && document.getElementById("padhost") && +$("padhost").dataset.q === cq.n && !ST.roomGone;
    sig = k; stats();
    if (m && m.hit && m.hit.blocked && m.hit.at > ST.seenBlock) { ST.seenBlock = m.hit.at; toast("Your Shield blocked " + m.hit.by + "'s crack! Your coins are safe.", "good"); sfx("box"); }
    if (sameQ) { const rw = ST.room && ST.room.rw; if (rw && cq.n === 100000 + (+rw.k || 0)) { pad.setBg(rw); teacherTag($("padhost"), !!(ST.room && ST.room.work !== false)); }
        const n = $("pnote"); if (n) n.textContent = ST.err; const fx = $("pfx"); if (fx) fx.replaceWith(effects(m) || Object.assign(el("div", "pfx"), { id: "pfx" })); refreshTools(); return; }
    document.body.classList.remove("qmode");
    const main = $("main"), y = window.scrollY; main.textContent = "";
    const card = el("section", "pcard"); main.append(card);
    // Only a new screen slides in. Redrawing the same screen (a typed digit, a pick) stays still and keeps its scroll spot.
    const screen = [ST.step, ST.view, m && m.status, m && m.need, ST.roomGone].join("|");
    if (screen === lastScreen) { card.classList.add("still"); requestAnimationFrame(() => window.scrollTo(0, y)); }
    lastScreen = screen;
    if (ST.roomGone) { card.append(el("h1", null, "The game is closed"), el("p", "plead", "Thanks for playing! Your teacher closed the game.")); return; }
    if (ST.step === "code") return codeStep(card);
    if (ST.step === "name") return nameStep(card);
    if (ST.step === "vault") return vaultStep(card, false);
    if (!m) { card.append(el("h1", null, "Joining…"), el("p", "plead", "Hang on a second.")); return; }
    if (m.status === "lobby") {
        if (m.need) return vaultStep(card, true);
        return waitingRoom(card, m);
    }
    if (m.status === "done") {
        card.classList.add("done");
        card.append(el("h1", null, "Game over!"), medal(m.rank), el("p", "pbig", ordinal(m.rank) + " place"));
        const tiles = el("div", "ptiles"), tile = (v, l) => { const t = el("div", "ptile"); t.append(el("b", null, String(v)), el("small", null, l)); tiles.append(t); };
        tile(m.c, "coins"); tile(m.r + " of " + m.of, "right"); if (m.best != null) tile(m.best, "best streak"); if (m.cr != null) tile(m.cr, m.cr === 1 ? "vault cracked" : "vaults cracked");
        if (m.of) tile(Math.round(100 * m.r / m.of) + "%", "correct");
        card.append(tiles, el("p", "pnote", m.rank <= 3 ? "Top 3! Look at the board for the winners." : "Great work. Look at the board for the winners."));
        if (Array.isArray(m.res) && m.res.length) card.append(myResults(m.res));
        if (!ST.endSnd) { ST.endSnd = true; setTimeout(() => sfx(m.rank <= 3 ? "win" : "start"), 80); }
        if (m.rank <= 3) once("done", () => { confetti(160, 0.5, 0.35); setTimeout(() => confetti(90, 0.2, 0.5), 400); setTimeout(() => confetti(90, 0.8, 0.5), 700); });
        return;
    }
    if (ST.view === "hit" && m.hit) {
        card.classList.add("alert"); if (celebrated !== "hit" + m.hit.at) card.classList.add("shake"); once("hit" + m.hit.at, () => { sfx("hit"); });
        card.append(lockPic(), el("h1", null, "Your vault was cracked!"), el("p", "plead", m.hit.by + " guessed your code and took " + m.hit.lost + " coins. Set a new code to lock it again."));
        const b = btn("pbtn go", "Set a new code", () => { ST.seenHit = m.hit.at; ST.view = "q"; draw(true); }); card.append(b); return;
    }
    if (m.need) return vaultStep(card, true);
    if (ST.view === "fb") return fbView(card);
    if (ST.view === "targets") return targetsView(card);
    if (ST.view === "sab") return sabView(card);
    if (ST.view === "dj") return djView(card);
    if (ST.view === "guess") return guessView(card);
    if (ST.view === "skins") return skinsView(card);
    questionView(card);
}
/** The student's own questions after the game: the ones to look at again first (what they wrote and the answer), then the ones they got. */
function myResults(res) {
    const box = el("div", "presults"), miss = res.filter((x) => !x.ok), got = res.filter((x) => x.ok);
    if (miss.length) {
        box.append(el("h2", "wrh", "Look at these again (" + miss.length + ")"));
        miss.forEach((x) => { const r = el("div", "pres miss"); r.append(el("span", "presmark", "✗"), mathEl("p", "presq", x.t)); const d = el("p", "presa"); d.append(document.createTextNode("You wrote "), x.y ? V.mathText(x.y) : document.createTextNode("nothing"), document.createTextNode(" · Answer: "), V.mathText(x.a)); r.append(d); box.append(r); });
    } else box.append(el("h2", "wrh", "You got every one right!"));
    if (got.length) {
        const det = el("details", "presgot"); det.append(el("summary", null, "You got these right (" + got.length + ")"));
        got.forEach((x) => { const r = el("div", "pres ok"); r.append(el("span", "presmark", "✓"), mathEl("p", "presq", x.t)); det.append(r); });
        box.append(det);
    }
    return box;
}
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
function codeShow(code) { const b = el("div", "pcodeshow"); [...String(code || "")].forEach((d) => b.append(el("span", null, d))); return b; }
function note(card) { const n = el("p", "pnote err", ST.err); n.id = "pnote"; n.setAttribute("role", "alert"); card.append(n); }

function codeStep(card) {
    card.append(el("h1", null, "Join the game"), el("p", "plead", "Type the game code on the board."));
    const f = el("form", "pform"), inp = el("input", "pcode");
    inp.inputMode = "numeric"; inp.autocomplete = "off"; inp.maxLength = 6; inp.placeholder = "000000"; inp.setAttribute("aria-label", "Game code");
    inp.value = new URLSearchParams(location.search).get("code") || "";
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 6); };
    const go = el("button", "pbtn go", ST.busy ? "Joining…" : "Join"); go.type = "submit"; go.disabled = ST.busy;
    f.onsubmit = (e) => { e.preventDefault(); const c = inp.value.trim(); if (!V.validRoomCode(c)) { ST.err = "Game codes have 6 digits."; draw(true); return; } join(c); };
    f.append(inp, go); card.append(f); note(card); setTimeout(() => inp.focus(), 0);
}
function nameStep(card) {
    const r = ST.room || {};
    card.append(el("h1", null, r.title ? r.title : "Who are you?"));
    if (r.mode === "roster") {
        card.append(el("p", "plead", "Tap your name."));
        const list = el("div", "pnames"), taken = new Set(r.taken || []);
        (r.names || []).forEach((n, i) => { const b = btn("pname", n, () => { ST.pick = { ni: i, nm: n }; ST.step = "vault"; ST.err = ""; draw(true); }); if (taken.has(i)) { b.disabled = true; b.title = "Already playing"; } list.append(b); });
        card.append(list, el("p", "pnote", "Is your name greyed out or missing? Tell your teacher."));
    } else {
        card.append(el("p", "plead", "Type your first name and last initial."));
        const f = el("form", "pform"), inp = el("input", "ptext"); inp.maxLength = 20; inp.autocomplete = "off"; inp.placeholder = "Ava R."; inp.setAttribute("aria-label", "Your first name and last initial"); inp.value = ST.typed;
        const go = el("button", "pbtn go", "Next"); go.type = "submit";
        f.onsubmit = (e) => { e.preventDefault(); const n = V.cleanTyped(inp.value); ST.typed = inp.value; if (!n) { ST.err = "Type your first name and last initial."; draw(true); return; } ST.pick = { nm: n }; ST.step = "vault"; ST.err = ""; draw(true); };
        f.append(inp, go); card.append(f); setTimeout(() => inp.focus(), 0);
    }
    note(card);
}
function vaultStep(card, again) {
    card.append(vaultPic("small", mySkin(ST.me)), el("h1", null, again ? "Set a new vault code" : "Set your vault code"), el("p", "plead", "Pick 3 different digits, 1 to 9. Classmates will try to guess it, so don't share it."));
    const slots = el("div", "pslots"); for (let i = 0; i < V.CODE_LEN; i++) slots.append(el("span", "pslot" + (ST.vault[i] ? " full" : ""), ST.vault[i] || ""));
    card.append(slots, keypad(ST.vault, (v) => { ST.vault = v; draw(true); }));
    const ok = btn("pbtn go", ST.busy ? "Saving…" : again ? "Lock my vault" : "Join the game", async () => {
        if (!V.validCode(ST.vault)) { ST.err = "Use 3 different digits."; draw(true); return; }
        ST.busy = true; ST.err = ""; draw(true);
        if (again) await send({ code: ST.vault, cn: Date.now() });
        else await send(Object.assign(ST.pick.ni != null ? { ni: ST.pick.ni } : { nm: ST.pick.nm }, { code: ST.vault, cn: Date.now() }));
        ST.vault = ""; if (!again) { ST.step = "play"; ST.me = null; } ST.busy = false; draw(true);
    });
    ok.disabled = ST.busy || ST.vault.length !== V.CODE_LEN; card.append(ok);
    if (!again) card.append(btn("pbtn ghost", "Back", () => { ST.step = "name"; ST.vault = ""; draw(true); }));
    note(card);
}
function keypad(value, set) {
    const k = el("div", "pkeys");
    for (let d = 1; d <= 9; d++) { const s = String(d), b = btn("pkey", s, () => { if (value.length < V.CODE_LEN && !value.includes(s)) set(value + s); }); b.disabled = value.includes(s) || value.length >= V.CODE_LEN; k.append(b); }
    const back = btn("pkey wide", "Delete", () => set(value.slice(0, -1))); back.disabled = !value; k.append(back);
    return k;
}
/** The Hack and Sabotage buttons over the question. Rebuilt in place (no pad reset) when hacks, a Lockdown, a Jam or the Sabotage switch change. */
function qTools(m) {
    const ex = m.exit, w = el("span", "pqtools"); w.id = "pqtools";
    if (m.h > 0 && !ex && !m.redo) { const off = hackOff(m), hb = btn("pbtn hack", off || "Hack a vault (" + m.h + ")", () => { ST.view = "targets"; draw(true); }); hb.disabled = !!off; w.append(hb); }
    if (m.sab && !ex && !m.redo && m.status === "play") w.append(btn("pbtn hack sab", "Sabotage", () => { ST.view = "sab"; ST.err = ""; draw(true); }));
    if (m.djon && !ex && !m.redo && m.status === "play") { const b = btn("pbtn hack dj", "🎧 DJ" + (m.dj > 0 ? " ×" + m.dj : ""), () => { ST.view = "dj"; ST.err = ""; draw(true); }); b.title = "Pick the song"; w.append(b); }
    w.dataset.k = [m.h, hackOff(m), m.sab, !!ex, !!m.redo, m.status, m.djon, m.dj].join("|");
    return w;
}
function refreshTools() {
    const t = $("pqtools"), m = ST.me; if (!t || !m) return;
    const n = qTools(m); if (n.dataset.k !== t.dataset.k) t.replaceWith(n);
}
/** Why hacking is off right now (a Lockdown or a Jam), or "". */
function hackOff(m) {
    const now = Date.now(), lock = Math.max(+m.lock || 0, +(ST.room && ST.room.lock) || 0);
    return lock > now ? "Lockdown" : +m.jam > now ? "Hacks jammed" : "";
}
function questionView(card) {
    const m = ST.me, ex = m.exit, q = curQ(m);
    if (ex && ex.done) { card.classList.add("center"); card.append(el("h1", null, "All done!"), el("p", "plead", "Thanks. Your teacher will look at how you did. Wait for your teacher.")); return; }
    if (!q && m.redo) { card.classList.add("center"); card.append(el("h1", null, "Nice work!"), el("p", "plead", "Wait for your teacher. Everyone is trying that one again.")); return; }
    if (!q) { card.classList.add("wide"); card.append(el("p", "plead", "Getting your question…")); return; }
    // The question and answer sit in a slim card on top; the work pad takes the rest of the screen.
    card.classList.add("qview"); document.body.classList.add("qmode");
    const need = !!(ST.room && ST.room.work);
    const qc = el("div", "pqcard"), left = el("div", "pqleft"), top = el("div", "pqtop");
    top.append(effects(m) || Object.assign(el("div", "pfx"), { id: "pfx" }));
    if (q.c) top.append(el("span", "pchip", q.c + (ex ? " · " + (ex.i + 1) + " of " + ex.of : "")));
    top.append(qTools(m));
    left.append(top, mathEl("p", "pq", q.t));
    // Step help after a miss: the steps so far sit under the question while they work.
    const sf = !ex && !m.redo && m.fb && m.fb.step && m.fb.q === q.n ? m.fb : null;
    if (sf) left.append(stepStrip(sf));
    const right = el("div", "pqright");
    const f = el("form", "pform ans"), box = answerBox(q.f || "", q.ch); ST.box = box;
    const go = el("button", "pbtn go", "Submit"); go.type = "submit";
    // Two misses in a row: a short wait before the next answer, to look over the work.
    const cool = () => Math.ceil(((+m.cd || 0) - Date.now()) / 1000);
    if (!ex && !m.redo && cool() > 0) {
        go.disabled = true; go.textContent = "Wait " + cool() + " s"; ST.err = "Two misses in a row. Look over your work on the pad first.";
        clearInterval(ST.coolT); ST.coolT = setInterval(() => { const s = cool(); if (!go.isConnected) { clearInterval(ST.coolT); return; } if (s > 0) go.textContent = "Wait " + s + " s"; else { clearInterval(ST.coolT); go.disabled = false; go.textContent = "Submit"; ST.err = ""; const n = $("pnote"); if (n) n.textContent = ""; } }, 250);
    }
    // A new step: read it first. Submit waits a few seconds (the game checks this too).
    const readLeft = () => (sf && (sf.sp || []).length ? Math.ceil(((+ST.stepAt || 0) + V.STEP_READ_MS - Date.now()) / 1000) : 0);
    if (readLeft() > 0 && !go.disabled) {
        go.disabled = true; go.textContent = "Read the step · " + readLeft();
        clearInterval(ST.readT); ST.readT = setInterval(() => { const s = readLeft(); if (!go.isConnected) { clearInterval(ST.readT); return; } if (s > 0) go.textContent = "Read the step · " + s; else { clearInterval(ST.readT); go.disabled = false; go.textContent = "Submit"; } }, 250);
    }
    f.onsubmit = (e) => {
        e.preventDefault(); const r = box.read(), t = r.t || "";
        if (r.err || !t) { ST.err = r.err || "Type your answer first."; const n = $("pnote"); if (n) n.textContent = ST.err; return; }
        if (need && !pad.shown()) { ST.err = "Show your work on the pad first, then submit."; const n = $("pnote"); if (n) n.textContent = ST.err; return; }
        if (sf && need && pad.len() - (+ST.stepInk || 0) < 40) { ST.err = (sf.sp || []).length ? "Use the step: add new work on your pad, then submit." : "Change something in your work on the pad first, then submit."; const n = $("pnote"); if (n) n.textContent = ST.err; return; }
        if (ST.sentQ === q.n || go.disabled) return;
        ST.sentQ = q.n; ST.err = ""; go.disabled = true; go.textContent = "Checking…";
        const img = pad.image(); pad.sent(); send({ a: { n: Date.now(), q: q.n, t: t.slice(0, 80) }, img, iq: q.n, it: Date.now() });
        setTimeout(() => { if (ST.sentQ === q.n && ST.view === "q") { ST.sentQ = -1; ST.err = "Your teacher's screen didn't answer. Try Submit again, or tell your teacher."; draw(true); } }, 10000);
    };
    f.append(box.el, go); right.append(f);
    if (sf) { const sb = left.querySelector(".pstepbar"); if (sb) sb.append(btn("pbtn ghost small pskip", "Skip it", () => { if (ST.sentQ === q.n) return; ST.sentQ = q.n; send({ a: { n: Date.now(), q: q.n, t: "" }, img: pad.image(), iq: q.n, it: Date.now() }); })); }
    note(right);
    qc.append(left, right); card.append(qc);
    const host = el("div", "wbpaper ppaper"); host.id = "padhost"; host.dataset.q = String(q.n);
    host.append(el("p", "ptag", need ? "Show your work here (needed to submit)" : "Show your work here"));
    card.append(host); pad.mount(host);
    if (sf && (sf.sp || []).length) host.append(stepPop(sf, q.n));   // over the top right of the pad (the tool rail is on the left)
    const rw = ST.room && ST.room.rw, withWork = !!(rw && q.n === 100000 + (+rw.k || 0)); pad.setBg(withWork ? rw : null);
    if (withWork) teacherTag(host, need);
}
/** Under the question in step help: what just happened, and what a right answer is worth now. The steps themselves pop up on the right. */
function stepStrip(f) {
    const sp = (f.sp || []).length, fresh = ST.stepNew && Date.now() - ST.stepNew.at < 1500, b = el("div", "pstepbar" + (fresh ? " fresh" : "") + (sp ? "" : " wait"));
    const msg = f.kind === "fast" && !sp ? "Too quick! Take a real try first. Steps unlock after you work on it."
        : f.kind === "read" ? "Read step " + sp + " on the right first."
        : f.kind === "auto" ? "Step " + sp + " is on the right to keep you moving. Use it and keep going."
        : (sp === 1 ? "Not quite. Step 1 is on the right. Use it and keep going." : "Still not it. Step " + sp + " is on the right.");
    b.append(el("b", null, msg));
    const full = V.coinsFor(1), now = +f.worth || full, m = el("span", "pstepcoins"); m.append(coinPic(), document.createTextNode(now + " coins if you get it now" + (f.hack && sp ? " + a hack" : "")));
    const bar = el("i", "pstepmeter"), fill = el("i"); fill.style.width = Math.round(100 * now / full) + "%"; bar.append(fill); m.append(bar);
    b.append(m);
    if (sp && sp >= (f.sn || 0)) b.append(el("small", null, "That's the last step. One more miss shows the answer."));
    return b;
}
/** Step help as a small window on the right, over the edge of the pad. A new step opens it; the student can shrink it
    to a small tab and open it again any time, so it never covers their work for long. */
function stepPop(f, qn) {
    const list = f.sp || [], n = list.length, fresh = ST.stepNew && Date.now() - ST.stepNew.at < 1500;
    const w = el("aside", "pstepop" + (ST.stepMin ? " min" : "") + (fresh && !ST.stepMin ? " fresh" : "")); w.id = "pstepop"; w.setAttribute("aria-label", "Steps");
    const set = (min) => { ST.stepMin = min; w.classList.toggle("min", min); w.classList.remove("fresh"); tab.setAttribute("aria-expanded", String(!min)); };
    const tab = btn("psptab", null, () => set(false)); tab.append(el("span", "pspbulb", "💡"), el("b", null, "Step " + n + (f.sn ? " of " + f.sn : "")));
    tab.setAttribute("aria-expanded", String(!ST.stepMin)); tab.title = "Show the steps";
    const box = el("div", "pspbox"), head = el("div", "psphead");
    head.append(el("span", "pspbulb", "💡"), el("b", null, "Step " + n + (f.sn ? " of " + f.sn : "")));
    const mn = btn("pspmin", "–", () => set(true)); mn.title = "Shrink"; mn.setAttribute("aria-label", "Shrink the steps"); head.append(mn);
    const ol = el("ol"); list.forEach((t, i) => { const li = mathEl("li", i === n - 1 ? "new" : "", t); li.value = i + 1; ol.append(li); });
    box.append(head, ol, el("small", "pspfoot", "Use it on your pad, then try again."));
    w.append(tab, box);
    return w;
}
/** The steps unlocked so far, newest on the bottom and highlighted. */
function stepsCard(f, slim) {
    const list = f.sp || [], c = el("div", "psteps" + (slim ? " slim" : ""));
    c.append(el("small", null, "Step " + list.length + " of " + (f.sn || list.length)));
    const ol = el("ol"); list.forEach((t, i) => { const li = mathEl("li", i === list.length - 1 ? "new" : "", t); ol.append(li); }); c.append(ol);
    return c;
}
/** What a right answer is worth now, as a bar that shrinks with each step. */
function stepMeter(f) {
    const full = V.coinsFor(1), now = +f.worth || full, w = el("div", "pmeter");
    const bar = el("div", "pmbar"), fill = el("i"); fill.style.width = Math.round(100 * now / full) + "%"; bar.append(fill);
    const lbl = el("p", "pmlbl"); lbl.append(coinPic(), el("b", null, now + " coins"), document.createTextNode(" if you get it now"));
    w.append(lbl, bar);
    const sp = (f.sp || []).length, next = sp < (f.sn || 0) ? Math.max(2, Math.round(full * V.STEP_PAY[Math.min(sp + 1, V.STEP_PAY.length - 1)])) : 0;
    if (next && sp > 0) w.append(el("small", null, "Another miss shows step " + (sp + 1) + " and drops it to " + next + "."));
    else if (sp && sp >= (f.sn || 0)) w.append(el("small", null, "That's the last step. One more miss shows the answer."));
    return w;
}
/** A miss with step help: a real try unlocks the next step; each step lowers the coins. */
function stepView(card, m, f, key, fresh) {
    card.classList.add("miss", "pstepcard"); if (fresh) card.classList.add("shake");
    const sp = (f.sp || []).length;
    if (f.kind === "fast" || (f.kind === "read" && !sp)) {
        card.append(el("h1", null, "Too quick! Take a real try first."), el("p", "plead", "Steps only unlock after you work on it. Use your pad, then try again."));
        card.append(stepMeter(f));
    } else if (f.kind === "read") {
        card.append(el("h1", null, "Read the step first"), el("p", "plead", "Take a few seconds with it and add it to your work."), stepsCard(f, false), stepMeter(f));
    } else {
        card.append(el("h1", null, sp === 1 ? "Not quite. Here's a step to help." : "Still not it. Here's step " + sp + "."));
        const y = el("p", "plead"); y.append(document.createTextNode("You wrote ")); if (f.y) y.append(V.mathText(f.y)); else y.append(document.createTextNode("nothing")); y.append(document.createTextNode(".")); card.append(y);
        card.append(stepsCard(f, false), stepMeter(f));
        if (f.hack) card.append(el("p", "pnote hackon", "Get it with this step and you still earn a hack."));
    }
    once(key, () => { sfx("miss"); });
    const row = el("div", "prow");
    row.append(btn("pbtn go", sp ? "Try it with this step" : "Back to my work", () => { ST.view = "q"; ST.sentQ = -1; draw(true); }));
    card.append(row);
}
/** The pad's label when the teacher's work came with the question. */
function teacherTag(host, need) { const t = host && host.querySelector(".ptag"); if (t) t.textContent = "Your teacher's work is on your pad. Pick up where the class left off" + (need ? " and add your own work." : "."); }
function fbView(card) {
    const m = ST.me, f = m.fb || {}, key = "fb" + f.q + (f.t ? "_" + f.t : ""), fresh = celebrated !== key;
    if (f.step && !f.ok) { ST.view = "q"; return questionView(card); }   // step help stays on the question
    card.classList.add(f.ok ? "good" : "miss");
    if (f.ok) {
        if (fresh) card.classList.add("pop");
        const pick = (list) => list[(f.q || 0) % list.length];
        card.append(el("h1", null, f.fixed ? "Your teacher counted it!" : f.second ? "You fixed it!" : f.redo ? "You got it this time!" : pick(RIGHT_WORDS)));
        const win = el("div", "pwin"), amt = el("b", "pplus", fresh ? "+0" : "+" + f.plus); win.append(coinPic(), amt); card.append(win);
        const st = m.st || 1, words = STREAK_WORDS[st] || (st > 10 ? "Legendary!" : "");
        card.append(streakRow(st));
        const chips = el("div", "pchips"); if (!f.second && !f.redo) chips.append(el("span", "pgain", "+1 hack"));
        else if (f.steps != null) { chips.append(el("span", "pgain", f.steps ? "Solved with " + f.steps + (f.steps === 1 ? " step" : " steps") : "Solved on your own")); if (f.hack) chips.append(el("span", "pgain hot", "+1 hack")); }
        else chips.append(el("span", "pgain", f.second ? "Second try: half coins" : "Try-again bonus"));
        (f.x2 || []).forEach((k) => chips.append(el("span", "pgain hot", k === "bonus" ? "Bonus round ×2" : k === "comeback" ? "Catch-up boost" : "Double coins ×2")));
        if (f.tax) chips.append(el("span", "pgain bad", f.tax.by + "'s Tax took " + f.tax.cut));
        if (st > 1) chips.append(el("span", "pgain hot", words || st + " in a row"));
        if (V.coinsFor(st) > V.RIGHT_COINS) chips.append(el("span", "pgain", "Streak bonus +" + (V.coinsFor(st) - V.RIGHT_COINS)));
        card.append(chips);
        once(key, () => { countUp(amt, f.plus || 0, "+"); confetti(st >= 5 ? 170 : st >= 3 ? 120 : 80, 0.5, 0.3); sfx(st >= 3 ? "streak" : "right"); });
        if (f.box) card.append(mysteryBox(f.box, key));
        // A new vault skin unlocked by this answer's coins.
        const open = V.skinsOpen(m.top);
        if (ST.skinFb !== key && open > (ST.skinsSeen || 1)) { ST.skinFb = key; ST.newSkin = open - 1; ST.skinsSeen = open; }
        if (ST.skinFb === key && ST.newSkin > 0) {
            const k = V.skin(ST.newSkin), nb = el("div", "pnewskin"); nb.append(vaultPic("tiny", ST.newSkin));
            const tx = el("div"); tx.append(el("small", null, "New vault skin unlocked"), el("b", null, k[1])); nb.append(tx);
            if (mySkin(m) === ST.newSkin) nb.append(el("span", "pskinon", "Using it")); else nb.append(btn("pbtn go small", "Use it", () => pickSkin(ST.newSkin)));
            card.append(nb);
        }
    } else if (f.retry) {
        // First miss: a hint and one more try for half coins. The answer stays hidden.
        if (fresh) card.classList.add("shake");
        card.append(el("h1", null, "Not quite. Try once more!"));
        const y = el("p", "plead"); y.append(document.createTextNode("You wrote ")); if (f.y) y.append(V.mathText(f.y)); else y.append(document.createTextNode("nothing")); y.append(document.createTextNode(".")); card.append(y);
        if (f.hint) { const h = el("div", "phint"); h.append(el("small", null, "Hint"), mathEl("p", null, f.hint)); card.append(h); }
        once(key, () => { sfx("miss"); });
        const row = el("div", "prow");
        row.append(btn("pbtn go", "Try again (half coins)", () => { ST.view = "q"; ST.sentQ = -1; draw(true); }));
        row.append(btn("pbtn ghost", "Skip it", () => { const q = m.q; if (!q) return; ST.sentQ = q.n; send({ a: { n: Date.now(), q: q.n, t: "" } }); ST.view = "q"; draw(true); }));
        card.append(row);
        return;
    } else {
        if (fresh) card.classList.add("shake");
        card.append(el("h1", null, f.skip ? "Skipped" : f.second ? "Still not it" : "Not quite"));
        if (f.a) { const a = el("div", "pansbox"); a.append(el("small", null, "The answer was"), mathEl("p", null, f.a)); card.append(a); }
        if (f.allsteps && (f.sp || []).length) { card.append(stepsCard(f, false)); card.append(el("p", "pnote", "Look at how each step leads to the answer. You'll see this kind again.")); }
        if (!f.skip) { const y = el("p", "plead"); y.append(document.createTextNode("You wrote ")); if (f.y) y.append(V.mathText(f.y)); else y.append(document.createTextNode("nothing")); y.append(document.createTextNode(".")); card.append(y); }
        card.append(el("p", "pnote", f.skip ? "Check how the answer works, then keep going." : MISS_WORDS[(f.q || 0) % MISS_WORDS.length]));
        once(key, () => { sfx("miss"); });
    }
    const row = el("div", "prow");
    row.append(btn("pbtn go", f.redo ? "OK" : "Next question", () => { ST.view = "q"; draw(true); }));
    if (m.h > 0) row.append(btn("pbtn hack", "Hack a vault (" + m.h + ")", () => { ST.view = "targets"; draw(true); }));
    if (!f.redo) row.append(btn("pbtn ghost", "Vault skins", () => { ST.back = "q"; ST.view = "skins"; draw(true); }));
    card.append(row);
}
/** Every vault skin: the unlocked ones to pick, the rest with the coins they need. */
function skinsGrid(m, canPick) {
    const g = el("div", "pskins"), open = V.skinsOpen(m && m.top), on = mySkin(m);
    V.SKINS.forEach(([, name, need], i) => {
        const locked = i >= open, b = btn("pskin" + (i === on ? " on" : "") + (locked ? " locked" : ""), null, canPick && !locked ? () => pickSkin(i) : null);
        b.append(vaultPic("tiny", i), el("b", null, name), el("small", null, locked ? "Unlocks at " + need + " coins" : i === on ? "Using it" : canPick ? "Tap to use" : "Unlocked"));
        b.disabled = locked || !canPick; if (i === on) b.setAttribute("aria-current", "true"); g.append(b);
    });
    return g;
}
function skinsView(card) {
    const m = ST.me; card.classList.add("wide");
    card.append(el("h1", null, "Vault skins"), el("p", "plead", "The most coins you've had this game is " + (+m.top || 0) + ". Getting cracked never locks a skin again."));
    card.append(skinsGrid(m, true), btn("pbtn go", "Back to questions", () => { ST.view = ST.back || "q"; draw(true); }));
}
function targetsView(card) {
    const m = ST.me; card.classList.add("wide");
    card.append(el("h1", null, "Pick a vault to hack"), el("p", "plead", "You have " + m.h + (m.h === 1 ? " hack" : " hacks") + ". Each guess uses one. Crack a code to take a share of the coins."));
    const off = hackOff(m); if (off) card.append(el("p", "pnote err", off === "Lockdown" ? "Lockdown! No hacking until it ends. Answer questions." : "Your hacks are jammed for a few seconds. Answer questions."));
    const list = el("div", "ptargets");
    (m.targets || []).forEach((t) => {
        const b = btn("ptarget", null, () => { ST.target = t.id; ST.guess = ""; ST.view = "guess"; draw(true); });
        const nm = el("b"); nm.append(vaultPic("mini", t.vs), document.createTextNode(V.avatar(t.av)[0] + " " + t.nm));
        b.append(nm, el("span", null, t.c + " coins"), el("small", null, t.sh ? "Firewall up" : t.g.length ? t.g.length + (t.g.length === 1 ? " guess so far" : " guesses so far") : "Not tried yet"));
        b.disabled = !!t.sh || m.h < 1 || !!off; list.append(b);
    });
    if (!(m.targets || []).length) list.append(el("p", "plead", "No one else is playing yet."));
    card.append(list, btn("pbtn ghost", "Back to questions", () => { ST.view = "q"; draw(true); }));
}
function guessView(card) {
    const m = ST.me, t = (m.targets || []).find((x) => x.id === ST.target);
    if (!t) { ST.view = "targets"; return targetsView(card); }
    card.classList.add("wide");
    const hk = m.hk && m.hk.to === t.id ? m.hk : null, cracked = m.hk && m.hk.steal != null && m.hk.m === "222" && m.hk.tn === t.nm && !t.g.length;
    card.append(el("h1", null, cracked ? "You cracked " + t.nm + "'s vault!" : "Hack " + t.nm + "'s vault"));
    if (cracked) { card.classList.add("good", "center"); if (celebrated !== "crack" + m.hk.n) card.classList.add("pop"); card.append(vaultPic("open", t.vs), el("p", "pbig", "Cracked! +" + m.hk.steal + " coins")); once("crack" + m.hk.n, () => { confetti(150, 0.5, 0.35, ["#F2B33D", "#F6C866", "#FFE3A3", "#7FAEDD", "#FFFFFF"]); sfx("crack"); }); card.append( el("p", "plead", t.nm + " has to set a new code.")); card.append(btn("pbtn go", "Back to questions", () => { ST.view = "q"; ST.target = ""; draw(true); })); return; }
    if (hk && hk.why) card.append(el("p", "pnote err", hk.why));
    if (t.spy && !cracked) { const sp = el("div", "pspyhint"); sp.append(powerIcon("spy"), el("span", null, "Your Spy saw: "), el("b", null, [...t.spy].join(" "))); card.append(sp); }
    const legend = el("p", "plegend"); legend.append(dot(2), document.createTextNode(" right digit, right spot  "), dot(1), document.createTextNode(" in the code, wrong spot  "), dot(0), document.createTextNode(" not in the code")); card.append(legend);
    const hist = el("div", "phist");
    t.g.forEach((x) => { const [g, mk] = String(x).split(":"); const r = el("div", "phrow"); [...g].forEach((d, i) => { const c = el("span", "phd m" + mk[i], d); c.setAttribute("aria-label", d + ": " + ["not in the code", "in the code, wrong spot", "right spot"][+mk[i]]); r.append(c); }); hist.append(r); });
    if (!t.g.length) hist.append(el("p", "pnote", "No guesses yet. Try any 3 different digits."));
    card.append(hist);
    if (t.sh) { card.append(el("p", "plead", "Their firewall is up. Try again soon."), btn("pbtn ghost", "Back", () => { ST.view = "targets"; draw(true); })); return; }
    const slots = el("div", "pslots"); for (let i = 0; i < V.CODE_LEN; i++) slots.append(el("span", "pslot" + (ST.guess[i] ? " full" : ""), ST.guess[i] || ""));
    card.append(slots, keypad(ST.guess, (v) => { ST.guess = v; draw(true); }));
    const row = el("div", "prow"), go = btn("pbtn go", ST.sentK ? "Trying…" : m.h ? "Try it (uses 1 hack)" : "No hacks left", () => {
        if (!V.validCode(ST.guess) || ST.sentK) return; const n = ST.sentK = Date.now(); send({ k: { n, to: t.id, g: ST.guess } }); draw(true);
        setTimeout(() => { if (ST.sentK === n) { ST.sentK = 0; ST.err = "Your teacher's screen didn't answer. Try again, or tell your teacher."; draw(true); } }, 10000);
    });
    go.disabled = !!ST.sentK || m.h < 1 || ST.guess.length !== V.CODE_LEN;
    row.append(go, btn("pbtn ghost", "Back to questions", () => { ST.view = "q"; ST.guess = ""; draw(true); })); card.append(row);
    if (m.h < 1) card.append(el("p", "pnote", "Answer a question right to earn another hack."));
    note(card);
}
/* ---------- sabotage: spend coins to slow down a player who is ahead ---------- */
const SAB_HIT = {
    fog: (by) => by + " fogged you! Your coins and place are hidden for 20 seconds.",
    jam: (by) => by + " jammed your hacks for 30 seconds. Keep answering!",
    tax: (by) => by + " taxed you! A quarter of your next right answer goes to them.",
    spy: (by) => by + " sent a spy and saw one digit of your vault code.",
};
const SAB_DONE = {
    fog: (r) => "Fog hit " + r.tn + "!",
    jam: (r) => r.tn + "'s hacks are jammed!",
    tax: (r) => "Tax set on " + r.tn + ". You get a quarter of their next right answer.",
    dj: (r) => "🎧 Now playing: " + ((V.song(r.song) || [])[1] || "your song") + "!" + (r.paid === "coins" ? " (" + V.DJ_COST + " coins)" : ""),
    spy: (r) => "Your spy saw spot " + (r.i + 1) + " of " + r.tn + "'s code: " + r.d,
};
function sabView(card) {
    const m = ST.me, now = Date.now(); card.classList.add("wide", "psab");
    card.append(el("h1", null, "Sabotage"), el("p", "plead", "Spend coins to slow down a player with at least as many coins as you. It never touches anyone's questions."));
    const lock = hackOff(m) === "Lockdown", wait = Math.ceil(((+m.sbc || 0) - now) / 1000);
    if (lock) card.append(el("p", "pnote err", "Lockdown! No sabotages until it ends."));
    else if (wait > 0) {
        const w = el("p", "pnote psabwait", "Recharging · ready in " + wait + " s"); card.append(w);
        const t = setInterval(() => { const l = Math.ceil(((+ST.me.sbc || 0) - Date.now()) / 1000); if (!w.isConnected) { clearInterval(t); return; } if (l > 0) w.textContent = "Recharging · ready in " + l + " s"; else { clearInterval(t); if (ST.view === "sab") draw(true); } }, 500);
    }
    if (!V.sabotage(ST.sabK)) ST.sabK = (V.SABOTAGES.find((x) => m.c >= x[2]) || V.SABOTAGES[0])[0];
    const kinds = el("div", "psabkinds"); kinds.setAttribute("role", "radiogroup"); kinds.setAttribute("aria-label", "Sabotages");
    V.SABOTAGES.forEach(([k, n, c, d]) => {
        const b = btn("psabk" + (k === ST.sabK ? " on" : ""), null, () => { ST.sabK = k; ST.err = ""; draw(true); });
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(k === ST.sabK));
        b.append(powerIcon(k), el("b", null, n), el("span", "psabcost", c + " coins"), el("small", null, d)); b.disabled = m.c < c; kinds.append(b);
    });
    card.append(kinds);
    const s = V.sabotage(ST.sabK), ready = !lock && wait <= 0 && !ST.sentS && m.c >= s[2];
    card.append(el("h2", "wrh", ST.sentS ? "Sending…" : "Use " + s[1] + " on…"));
    const list = el("div", "ptargets");
    (m.targets || []).forEach((t) => {
        const why = !V.canSabotage(m.c, t.c) ? "Behind you, so you can't" : t.sh ? "Firewall up" : t.sbs ? "Just hit · safe for now" : "";
        const b = btn("ptarget", null, () => {
            if (ST.sentS) return; const n = ST.sentS = Date.now(); ST.err = ""; send({ sb: { n, to: t.id, k: ST.sabK } }); draw(true);
            setTimeout(() => { if (ST.sentS === n) { ST.sentS = 0; ST.err = "Your teacher's screen didn't answer. Try again."; draw(true); } }, 10000);
        });
        const nm = el("b"); nm.append(vaultPic("mini", t.vs), document.createTextNode(V.avatar(t.av)[0] + " " + t.nm));
        b.append(nm, el("span", null, t.c + " coins"), el("small", null, why || s[1] + " · " + s[2] + " coins")); b.disabled = !!why || !ready; list.append(b);
    });
    if (!(m.targets || []).length) list.append(el("p", "plead", "No one else is playing yet."));
    card.append(list, btn("pbtn ghost", "Back to questions", () => { ST.view = "q"; ST.err = ""; draw(true); }));
    note(card);
}
/** The DJ Booth: pick the song that plays on the teacher's board, with a DJ Ticket or coins. */
function djView(card) {
    const m = ST.me, now = Date.now(); card.classList.add("wide", "pdj");
    card.append(el("h1", null, "🎧 DJ Booth"), el("p", "plead", "Pick the song for the whole class. It plays on your teacher's board."));
    const hold = m.song ? Math.ceil(((+m.song.at || 0) + V.DJ_HOLD_MS - now) / 1000) : 0, pay = m.dj > 0 ? "ticket" : m.c >= V.DJ_COST ? "coins" : "";
    card.append(el("p", "pdjwallet", m.dj > 0 ? "You have " + m.dj + " DJ Ticket" + (m.dj > 1 ? "s" : "") + "." : "No DJ Ticket. A pick costs " + V.DJ_COST + " coins (you have " + m.c + ")."));
    if (m.djlock) card.append(el("p", "pnote err", "Your teacher locked the music for now."));
    else if (hold > 0) {
        const w = el("p", "pnote psabwait", "This song plays a little longer · next pick in " + hold + " s"); card.append(w);
        const t = setInterval(() => { const l = ST.me.song ? Math.ceil(((+ST.me.song.at || 0) + V.DJ_HOLD_MS - Date.now()) / 1000) : 0; if (!w.isConnected) { clearInterval(t); return; } if (l > 0) w.textContent = "This song plays a little longer · next pick in " + l + " s"; else { clearInterval(t); if (ST.view === "dj") draw(true); } }, 500);
    }
    const ready = !m.djlock && hold <= 0 && !!pay && !ST.sentS, cur = m.song ? m.song.k : "vault", list = el("div", "psongs");
    V.SONGS.forEach(([k, n, e, d]) => {
        const playing = k === cur, b = btn("psong" + (playing ? " on" : ""), null, () => {
            if (ST.sentS) return; const sn = ST.sentS = Date.now(); ST.err = ""; send({ sb: { n: sn, to: "", k: "dj:" + k } }); draw(true);
            setTimeout(() => { if (ST.sentS === sn) { ST.sentS = 0; ST.err = "Your teacher's screen didn't answer. Try again."; draw(true); } }, 10000);
        });
        b.append(el("span", "psongic", e), el("b", null, n), el("small", null, playing ? "Playing now" + (m.song && m.song.nm ? " · picked by " + m.song.nm : "") : d));
        b.disabled = playing || !ready; list.append(b);
    });
    card.append(el("h2", "wrh", ST.sentS ? "Sending…" : pay === "coins" ? "Pick one (" + V.DJ_COST + " coins)" : "Pick one"), list, btn("pbtn ghost", "Back to questions", () => { ST.view = "q"; ST.err = ""; draw(true); }));
    note(card);
}
/** Things that happen to this student from outside: a sabotage, a shout-out, the result of their own sabotage, a Lockdown. */
function notices(d) {
    const first = !ST.noticed; ST.noticed = true;
    if (d.sbh && d.sbh.at > (ST.seenSbh || 0)) { ST.seenSbh = d.sbh.at; if (!first && SAB_HIT[d.sbh.k]) { toast(SAB_HIT[d.sbh.k](d.sbh.by), "bad"); sfx("hit"); } }
    if (d.djg && d.djg.at > (ST.seenDjg || 0)) { ST.seenDjg = d.djg.at; if (!first) { toast("🎧 Your teacher gave you a DJ Ticket! Tap 🎧 DJ to pick the song.", "good"); sfx("box"); } }
    if (d.so && d.so.at > (ST.seenSo || 0)) { ST.seenSo = d.so.at; if (!first) { toast("★ Shout-out from your teacher! +" + d.so.v + " coins", "good"); sfx("box"); confetti(60, 0.5, 0.25); } }
    if (ST.sentS && d.sbr && d.sbr.n === ST.sentS) {
        ST.sentS = 0;
        if (d.sbr.ok) { ST.view = "q"; ST.err = ""; toast((SAB_DONE[d.sbr.k] || (() => "Done!"))(d.sbr), "good"); sfx("crack"); }
        else ST.err = d.sbr.why || "That didn't work.";
    }
    const lock = +(d.lock || 0);
    if (lock > Date.now() && lock !== ST.seenLock) { ST.seenLock = lock; if (!first) { toast("Lockdown! No hacking or sabotage for 60 seconds. Answer questions!"); sfx("bonus"); } }
    if (ST.view === "sab" && (!d.sab || d.status !== "play")) ST.view = "q";
    if (ST.view === "dj" && (!d.djon || d.status !== "play")) ST.view = "q";
}
const dot = (k) => { const s = el("span", "phd sm m" + k); s.setAttribute("aria-hidden", "true"); return s; };

/* ---------- start ---------- */
{
    const q = new URLSearchParams(location.search).get("code"), last = store.get("code");
    draw();
    if (q && V.validRoomCode(q)) join(q);
    else if (last && V.validRoomCode(last)) {
        // Back after a reload: if this device already has a seat in that game, carry on.
        signIn().then((uid) => getDoc(doc(db, "rooms", last, "s", uid)))
            .then((s) => { if (s.exists() && !s.data().err && ST.step === "code" && !ST.code) join(last); }).catch(() => {});
    }
}
