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
import * as V from "./vaultCore.js?v=66";
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
};
let unsubRoom = null, unsubMe = null, sig = "";

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
        if (!s.exists()) { if (ST.room) { ST.roomGone = true; } else { ST.err = "No game has that code. Check the board."; ST.step = "code"; ST.code = ""; stopAll(); } draw(); return; }
        if (s.data().kind === "notes") { stopAll(); location.replace("follow.html?code=" + code); return; }   // a Live notes code (js/follow.js)
        ST.room = s.data(); store.set("code", code);
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
        if (d.hit && d.hit.at > ST.seenHit && d.need) { ST.view = "hit"; }
        if (ST.view === "q" && ST.sentQ >= 0 && d.fb && d.fb.q === ST.sentQ) { ST.view = "fb"; ST.sentQ = -1; if (!d.fb.retry) pad.clear(); }   // a second try keeps the work
        if (ST.view === "guess" && ST.sentK && d.hk && d.hk.n === ST.sentK) { ST.sentK = 0; ST.guess = ""; }
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
        const h = Math.max(200, Math.round(W * r.height / r.width)); if (h !== H || canvas.height !== h) { H = h; canvas.height = H; paint(); }
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
        requestAnimationFrame(fit); paint();
    }
    /** A picture of the work for the teacher: the math tools under the ink, on white. */
    function image() {
        if (!strokes.length && !(mp ? mp.items() : items).length) return "";
        const c = document.createElement("canvas"); c.width = 640; c.height = Math.round(640 * H / W); const x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        if (mp && mp.el.width) x.drawImage(mp.el, 0, 0, c.width, c.height);
        x.drawImage(canvas, 0, 0, c.width, c.height);
        let url = c.toDataURL("image/png"); if (url.length > 380000) url = c.toDataURL("image/jpeg", 0.7);
        return url.length > 395000 ? c.toDataURL("image/jpeg", 0.45) : url;
    }
    return {
        mount, image,
        clear() { strokes = []; items = []; hist = []; dirty = false; if (mp) mp.clear(); paint(); },
        dirty: () => dirty, sent() { dirty = false; sentAt = Date.now(); }, sentAt: () => sentAt, has: () => strokes.length > 0,
        /** Real work on the pad: pen strokes (not eraser) adding up to more than a quick tap, or math typed in a text box. */
        shown() {
            let len = 0;
            strokes.forEach((s) => { if (s.e || s.ring) return; for (let i = 1; i < s.p.length; i++) len += Math.hypot(s.p[i][0] - s.p[i - 1][0], s.p[i][1] - s.p[i - 1][1]); });
            return len >= 60 || (mp ? mp.items() : items).some((it) => it.k === "text" && String(it.txt || "").replace(/\s/g, "").length >= 2);
        }
    };
})();
// Live work: when the teacher turns it on, the pad is sent every few seconds while it changes.
setInterval(() => {
    if (!ST.room || !ST.room.live || !ST.me || ST.me.status !== "play" || !ST.me.q || ST.view !== "q" || !pad.dirty() || Date.now() - pad.sentAt() < 5000) return;
    const img = pad.image(); pad.sent(); send({ img, iq: ST.me.q.n, it: Date.now() });
}, 1000);

/* ---------- the answer box ----------
   A plain box, a fraction (top and bottom boxes over a bar) and a mixed number, plus a ready-made
   shape when the answer needs one: tap a choice for how many solutions, a base and an exponent
   (3³), scientific notation (8 × 10⁵) or one box per number (6 and 7). The Remote says which one
   fits the question (V.answerKind); a student can still switch to a plain box. */
const KINDS = [["", "Number"], ["frac", "Fraction"], ["mixed", "Mixed number"]];
const SPECIAL = { sol: ["Choose", "✓"], pow: ["Exponent", "xⁿ"], sci: ["Sci. notation", "×10ⁿ"], list: ["Boxes", "□ □"] };
const SOLS = ["One solution", "No solution", "Infinitely many solutions"];
function answerBox(kind) {
    const lm = /^list([2-4])$/.exec(kind || ""), sk = lm ? "list" : SPECIAL[kind] ? kind : "", count = lm ? +lm[1] : 0;
    const kinds = (sk ? [[sk, SPECIAL[sk][0]]] : []).concat(KINDS);
    const wrap = el("div", "pabox"); let mode = kinds.some((k) => k[0] === kind || k[0] === sk) ? (sk || kind) : "", neg = false, choice = "";
    const tabs = el("div", "patabs"); tabs.setAttribute("role", "radiogroup"); tabs.setAttribute("aria-label", "Answer type");
    const field = el("div", "pafield");
    const num = (label, cls) => { const i = el("input", "pnum" + (cls ? " " + cls : "")); i.inputMode = "numeric"; i.autocomplete = "off"; i.maxLength = 7; i.setAttribute("aria-label", label); i.oninput = () => { i.value = i.value.replace(/[^\d.]/g, "").slice(0, 7); }; return i; };
    // A box in a ready-made shape: numbers with a minus sign or decimal point (and letters for a base like x).
    const cell = (label, cls, letters) => { const i = el("input", "pnum" + (cls ? " " + cls : "")); i.autocomplete = "off"; i.maxLength = 8; i.inputMode = letters ? "text" : "decimal"; i.setAttribute("aria-label", label); i.oninput = () => { i.value = i.value.replace(/[−–]/g, "-").replace(letters ? /[^\da-zA-Z.\-]/g : /[^\d.\-]/g, "").slice(0, 8); }; return i; };
    const text = el("input", "ptext"); text.maxLength = 80; text.autocomplete = "off"; text.placeholder = "Your answer"; text.setAttribute("aria-label", "Your answer");
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
    const choiceEl = el("div", "pachoices"); choiceEl.setAttribute("role", "radiogroup"); choiceEl.setAttribute("aria-label", "How many solutions?");
    SOLS.forEach((label) => {
        const c = btn("pachoice", label, () => { choice = label; [...choiceEl.children].forEach((x) => { const on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); }); });
        c.setAttribute("role", "radio"); c.setAttribute("aria-checked", "false"); choiceEl.append(c);
    });
    const first = () => mode === "" ? text : mode === "mixed" ? whole : mode === "frac" ? top : mode === "list" ? boxes[0] : mode === "sol" ? choiceEl.firstChild : base;
    function show() {
        field.textContent = ""; field.classList.toggle("choices", mode === "sol");
        if (mode === "") field.append(text);
        else if (mode === "sol") field.append(choiceEl);
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
            if (mode === "sol") return choice ? { t: choice } : { err: "Tap one of the choices." };
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
function vaultPic(cls) {
    const bolts = [0, 60, 120, 180, 240, 300].map((a) => { const r = a * Math.PI / 180; return '<circle cx="' + (60 + 46 * Math.cos(r)).toFixed(1) + '" cy="' + (60 + 46 * Math.sin(r)).toFixed(1) + '" r="3.2" fill="#7FAEDD"/>'; }).join("");
    const ticks = Array.from({ length: 12 }, (_, i) => '<line x1="60" y1="36" x2="60" y2="' + (i % 3 ? 39 : 41) + '" stroke="#081B45" stroke-width="2" transform="rotate(' + i * 30 + ' 60 60)"/>').join("");
    return svg('<g class="vcoins"><circle cx="48" cy="66" r="12" fill="#F2B33D"/><circle cx="66" cy="58" r="12" fill="#F6C866"/><circle cx="72" cy="74" r="12" fill="#F2B33D"/></g>'
        + '<g class="vdoor"><circle cx="60" cy="60" r="56" fill="#10358A"/><circle cx="60" cy="60" r="56" fill="none" stroke="#7FAEDD" stroke-width="4"/>' + bolts
        + '<circle cx="60" cy="60" r="30" fill="#F4F7FB"/><g class="vdial">' + ticks + '<path d="M60 60L60 24" stroke="#F2B33D" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="60" r="9" fill="#081B45"/></g></g>', "vault" + (cls ? " " + cls : ""));
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
setInterval(() => { if (ST.view === "q" && ST.me && ST.me.status === "play") { const fx = $("pfx"); if (fx) fx.replaceWith(effects(ST.me) || Object.assign(el("div", "pfx"), { id: "pfx" })); } }, 1000);

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
    const code = el("div", "wrcode"); code.append(el("small", null, "Your secret code"), codeShow(m.code));
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
POWER_ICONS.bonus = '<path d="M68 6L24 66h30l-8 48 46-64H60z" fill="#3A2A00"/>';
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
    if (!list.length) return null;
    const box = el("div", "pfx"); box.id = "pfx"; list.forEach(([k, t, c]) => { const x = el("span", "pfxc" + (c ? " " + c : "")); x.append(powerIcon(k), document.createTextNode(t)); box.append(x); });
    return box;
}
/** A mystery box from a right answer. What's inside already counts; opening it shows what it was. */
function mysteryBox(b, key) {
    const wrap = el("div", "pbox" + (ST.opened[key] ? " open" : ""));
    const name = { bag: "Coin bag: +" + b.v + " coins", hack: "Extra hack!", double: "Double coins on your next " + b.v + " right answers", firewall: "Firewall: your vault is safe for " + b.v + " seconds" }[b.k] || "A surprise";
    if (!ST.opened[key]) {
        const go = btn("pboxbtn", null, () => { ST.opened[key] = 1; wrap.classList.add("open"); go.replaceWith(prize()); confetti(70, 0.5, 0.55, ["#F2B33D", "#7FAEDD", "#FFFFFF"]); });
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
    chip("Name", V.avatar(m.status === "lobby" && ST.picks.av != null ? ST.picks.av : m.av)[0] + " " + m.nm); chip("Coins", String(m.c), "coin" + (was != null && m.c > was ? " up" : was != null && m.c < was ? " down" : "")); chip("Hacks", String(m.h)); if (m.status !== "lobby") chip("Place", m.rank + " of " + m.players);
    const t = el("span", "pstat"); t.append(el("small", null, "Time"), el("b", null, "")); t.id = "ptime"; s.append(t); tickTime();
}
function tickTime() {
    const t = $("ptime"); if (!t) return; const e = ST.me && ST.me.ends;
    t.hidden = !(ST.me && ST.me.status === "play" && e);
    if (!t.hidden) { const l = Math.max(0, e - Date.now()); t.lastChild.textContent = Math.floor(l / 60000) + ":" + ("0" + Math.floor((l % 60000) / 1000)).slice(-2); }
}
setInterval(tickTime, 500);

function draw(force) {
    const m = ST.me;
    if (m && m.nm && ST.step !== "play") ST.step = "play";
    const k = JSON.stringify([ST.step, ST.view, ST.err, ST.busy, ST.target, ST.guess, ST.vault, ST.roomGone, ST.room && [ST.room.status, ST.step === "name" ? [ST.room.taken, ST.room.names && ST.room.names.length] : 0, ST.room.bonus], m && [m.status === "lobby" ? 0 : m.n, m.status, m.need]]);
    if (k === sig && !force) return;
    // Keep the pad (and anything typed) while the same question stays on screen.
    const sameQ = !force && ST.step === "play" && ST.view === "q" && m && m.q && document.getElementById("padhost") && +$("padhost").dataset.q === m.q.n && !ST.roomGone;
    sig = k; stats();
    if (m && m.hit && m.hit.blocked && m.hit.at > ST.seenBlock) { ST.seenBlock = m.hit.at; toast("Your Shield blocked " + m.hit.by + "'s crack! Your coins are safe.", "good"); }
    if (sameQ) { const n = $("pnote"); if (n) n.textContent = ST.err; const fx = $("pfx"); if (fx) fx.replaceWith(effects(m) || Object.assign(el("div", "pfx"), { id: "pfx" })); return; }
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
        if (m.rank <= 3) once("done", () => { confetti(160, 0.5, 0.35); setTimeout(() => confetti(90, 0.2, 0.5), 400); setTimeout(() => confetti(90, 0.8, 0.5), 700); });
        return;
    }
    if (ST.view === "hit" && m.hit) {
        card.classList.add("alert"); if (celebrated !== "hit" + m.hit.at) card.classList.add("shake"); once("hit" + m.hit.at, () => {});
        card.append(lockPic(), el("h1", null, "Your vault was cracked!"), el("p", "plead", m.hit.by + " guessed your code and took " + m.hit.lost + " coins. Set a new code to lock it again."));
        const b = btn("pbtn go", "Set a new code", () => { ST.seenHit = m.hit.at; ST.view = "q"; draw(true); }); card.append(b); return;
    }
    if (m.need) return vaultStep(card, true);
    if (ST.view === "fb") return fbView(card);
    if (ST.view === "targets") return targetsView(card);
    if (ST.view === "guess") return guessView(card);
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
    card.append(vaultPic("small"), el("h1", null, again ? "Set a new vault code" : "Set your vault code"), el("p", "plead", "Pick 3 different digits, 1 to 9. Classmates will try to guess it, so don't share it."));
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
function questionView(card) {
    const m = ST.me, q = m.q;
    if (!q && m.redo) { card.classList.add("center"); card.append(el("h1", null, "Nice work!"), el("p", "plead", "Wait for your teacher. Everyone is trying that one again.")); return; }
    if (!q) { card.classList.add("wide"); card.append(el("p", "plead", "Getting your question…")); return; }
    // The question and answer sit in a slim card on top; the work pad takes the rest of the screen.
    card.classList.add("qview"); document.body.classList.add("qmode");
    const need = !!(ST.room && ST.room.work);
    const qc = el("div", "pqcard"), left = el("div", "pqleft"), top = el("div", "pqtop");
    top.append(effects(m) || Object.assign(el("div", "pfx"), { id: "pfx" }));
    if (q.c) top.append(el("span", "pchip", q.c));
    if (m.h > 0) top.append(btn("pbtn hack", "Hack a vault (" + m.h + ")", () => { ST.view = "targets"; draw(true); }));
    left.append(top, mathEl("p", "pq", q.t));
    const right = el("div", "pqright");
    const f = el("form", "pform ans"), box = answerBox(q.f || ""); ST.box = box;
    const go = el("button", "pbtn go", "Submit"); go.type = "submit";
    f.onsubmit = (e) => {
        e.preventDefault(); const r = box.read(), t = r.t || "";
        if (r.err || !t) { ST.err = r.err || "Type your answer first."; const n = $("pnote"); if (n) n.textContent = ST.err; return; }
        if (need && !pad.shown()) { ST.err = "Show your work on the pad first, then submit."; const n = $("pnote"); if (n) n.textContent = ST.err; return; }
        if (ST.sentQ === q.n) return;
        ST.sentQ = q.n; ST.err = ""; go.disabled = true; go.textContent = "Checking…";
        const img = pad.image(); pad.sent(); send({ a: { n: Date.now(), q: q.n, t: t.slice(0, 80) }, img, iq: q.n, it: Date.now() });
        setTimeout(() => { if (ST.sentQ === q.n && ST.view === "q") { ST.sentQ = -1; ST.err = "Your teacher's screen didn't answer. Try Submit again, or tell your teacher."; draw(true); } }, 10000);
    };
    f.append(box.el, go); right.append(f); note(right);
    qc.append(left, right); card.append(qc);
    const host = el("div", "wbpaper ppaper"); host.id = "padhost"; host.dataset.q = String(q.n);
    host.append(el("p", "ptag", need ? "Show your work here (needed to submit)" : "Show your work here"));
    card.append(host); pad.mount(host);
}
function fbView(card) {
    const m = ST.me, f = m.fb || {}, key = "fb" + f.q, fresh = celebrated !== key;
    card.classList.add(f.ok ? "good" : "miss");
    if (f.ok) {
        if (fresh) card.classList.add("pop");
        const pick = (list) => list[(f.q || 0) % list.length];
        card.append(el("h1", null, f.fixed ? "Your teacher counted it!" : f.second ? "You fixed it!" : f.redo ? "You got it this time!" : pick(RIGHT_WORDS)));
        const win = el("div", "pwin"), amt = el("b", "pplus", fresh ? "+0" : "+" + f.plus); win.append(coinPic(), amt); card.append(win);
        const st = m.st || 1, words = STREAK_WORDS[st] || (st > 10 ? "Legendary!" : "");
        card.append(streakRow(st));
        const chips = el("div", "pchips"); if (!f.second && !f.redo) chips.append(el("span", "pgain", "+1 hack")); else chips.append(el("span", "pgain", f.second ? "Second try: half coins" : "Try-again bonus"));
        (f.x2 || []).forEach((k) => chips.append(el("span", "pgain hot", k === "bonus" ? "Bonus round ×2" : "Double coins ×2")));
        if (st > 1) chips.append(el("span", "pgain hot", words || st + " in a row"));
        if (V.coinsFor(st) > V.RIGHT_COINS) chips.append(el("span", "pgain", "Streak bonus +" + (V.coinsFor(st) - V.RIGHT_COINS)));
        card.append(chips);
        once(key, () => { countUp(amt, f.plus || 0, "+"); confetti(st >= 5 ? 170 : st >= 3 ? 120 : 80, 0.5, 0.3); });
        if (f.box) card.append(mysteryBox(f.box, key));
    } else if (f.retry) {
        // First miss: a hint and one more try for half coins. The answer stays hidden.
        if (fresh) card.classList.add("shake");
        card.append(el("h1", null, "Not quite. Try once more!"));
        const y = el("p", "plead"); y.append(document.createTextNode("You wrote ")); if (f.y) y.append(V.mathText(f.y)); else y.append(document.createTextNode("nothing")); y.append(document.createTextNode(".")); card.append(y);
        if (f.hint) { const h = el("div", "phint"); h.append(el("small", null, "Hint"), mathEl("p", null, f.hint)); card.append(h); }
        once(key, () => {});
        const row = el("div", "prow");
        row.append(btn("pbtn go", "Try again (half coins)", () => { ST.view = "q"; ST.sentQ = -1; draw(true); }));
        row.append(btn("pbtn ghost", "Skip it", () => { const q = m.q; if (!q) return; ST.sentQ = q.n; send({ a: { n: Date.now(), q: q.n, t: "" } }); ST.view = "q"; draw(true); }));
        card.append(row);
        return;
    } else {
        if (fresh) card.classList.add("shake");
        card.append(el("h1", null, f.second ? "Still not it" : "Not quite"));
        if (f.a) { const a = el("div", "pansbox"); a.append(el("small", null, "The answer was"), mathEl("p", null, f.a)); card.append(a); }
        const y = el("p", "plead"); y.append(document.createTextNode("You wrote ")); if (f.y) y.append(V.mathText(f.y)); else y.append(document.createTextNode("nothing")); y.append(document.createTextNode(".")); card.append(y);
        card.append(el("p", "pnote", MISS_WORDS[(f.q || 0) % MISS_WORDS.length]));
        once(key, () => {});
    }
    const row = el("div", "prow");
    row.append(btn("pbtn go", f.redo ? "OK" : "Next question", () => { ST.view = "q"; draw(true); }));
    if (m.h > 0) row.append(btn("pbtn hack", "Hack a vault (" + m.h + ")", () => { ST.view = "targets"; draw(true); }));
    card.append(row);
}
function targetsView(card) {
    const m = ST.me; card.classList.add("wide");
    card.append(el("h1", null, "Pick a vault to hack"), el("p", "plead", "You have " + m.h + (m.h === 1 ? " hack" : " hacks") + ". Each guess uses one. Crack a code to take a share of the coins."));
    const list = el("div", "ptargets");
    (m.targets || []).forEach((t) => {
        const b = btn("ptarget", null, () => { ST.target = t.id; ST.guess = ""; ST.view = "guess"; draw(true); });
        b.append(el("b", null, V.avatar(t.av)[0] + " " + t.nm), el("span", null, t.c + " coins"), el("small", null, t.sh ? "Firewall up" : t.g.length ? t.g.length + (t.g.length === 1 ? " guess so far" : " guesses so far") : "Not tried yet"));
        b.disabled = !!t.sh || m.h < 1; list.append(b);
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
    if (cracked) { card.classList.add("good", "center"); if (celebrated !== "crack" + m.hk.n) card.classList.add("pop"); card.append(vaultPic("open"), el("p", "pbig", "Cracked! +" + m.hk.steal + " coins")); once("crack" + m.hk.n, () => { confetti(150, 0.5, 0.35, ["#F2B33D", "#F6C866", "#FFE3A3", "#7FAEDD", "#FFFFFF"]); }); card.append( el("p", "plead", t.nm + " has to set a new code.")); card.append(btn("pbtn go", "Back to questions", () => { ST.view = "q"; ST.target = ""; draw(true); })); return; }
    if (hk && hk.why) card.append(el("p", "pnote err", hk.why));
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
