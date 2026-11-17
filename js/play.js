/* ==========================================
   Focal — the student page for Vault Raid (play.html, focalboard.web.app/play).
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
import { getFirestore, doc, getDoc, onSnapshot, setDoc, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import * as V from "./vaultCore.js?v=58";

// Same project as js/firebase.js. A separate app name keeps a teacher signed in on this device signed in.
const app = initializeApp({
    apiKey: "AIzaSyA8kAei_AJMU66EePYQyI8nlVJeLes5HLY",
    authDomain: "steers-class-board.firebaseapp.com",
    projectId: "steers-class-board",
    storageBucket: "steers-class-board.firebasestorage.app",
    messagingSenderId: "997357619072",
    appId: "1:997357619072:web:8e47464df7c4e329fd2365"
}, "play");
const auth = getAuth(app), db = getFirestore(app);
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {   // local testing with the emulators only
    try {
        if (new URLSearchParams(location.search).has("emu")) sessionStorage.setItem("focal-emu", "1");
        if (sessionStorage.getItem("focal-emu")) { connectFirestoreEmulator(db, "127.0.0.1", 8080); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); }
    } catch (e) { /* storage blocked */ }
}
setPersistence(auth, browserLocalPersistence).catch(() => {});

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };
const mathEl = (tag, cls, text) => { const e = el(tag, cls); e.append(V.mathText(text)); return e; };
const store = { get: (k) => { try { return localStorage.getItem("focal-play-" + k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { localStorage.setItem("focal-play-" + k, v); } catch (e) { /* ok */ } } };

const ST = {
    uid: "", code: "", room: null, roomGone: false, me: null, hadMe: false,
    step: "code",        // code → name → vault → (playing)
    pick: null,          // { ni } or { nm } while joining
    view: "q",           // q (question) · fb (answer result) · targets · guess
    sentQ: -1, sentK: 0, target: "", guess: "", vault: "", typed: "", err: "", seenHit: 0, busy: false,
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
        if (ST.view === "q" && ST.sentQ >= 0 && d.fb && d.fb.q === ST.sentQ) { ST.view = "fb"; ST.sentQ = -1; pad.clear(); }
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

/* ---------- the work pad ---------- */
const pad = (() => {
    const W = 900, H = 520, strokes = []; let canvas = null, ctx = null, cur = null, color = "#0E1B3A", erase = false, dirty = false, sentAt = 0;
    function paint() {
        if (!ctx) return; ctx.clearRect(0, 0, W, H);
        strokes.forEach((s) => { ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over"; ctx.strokeStyle = s.c; ctx.lineWidth = s.e ? 28 : 4; ctx.lineCap = ctx.lineJoin = "round"; ctx.beginPath(); s.p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (s.p.length === 1) ctx.lineTo(s.p[0][0] + 0.1, s.p[0][1]); ctx.stroke(); });
        ctx.globalCompositeOperation = "source-over";
    }
    function at(e) { const r = canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)]; }
    function mount(host) {
        canvas = el("canvas", "padcv"); canvas.width = W; canvas.height = H; canvas.setAttribute("aria-label", "Work pad. Draw your work here."); ctx = canvas.getContext("2d");
        canvas.onpointerdown = (e) => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); cur = { c: color, e: erase, p: [at(e)] }; strokes.push(cur); paint(); };
        canvas.onpointermove = (e) => { if (!cur) return; e.preventDefault(); const p = at(e), l = cur.p[cur.p.length - 1]; if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) > 2) { cur.p.push(p); paint(); } };
        canvas.onpointerup = canvas.onpointercancel = () => { if (cur) { cur = null; dirty = true; } };
        host.append(canvas); paint();
        const tools = el("div", "padtools"), pens = [];
        const mark = () => { pens.forEach(([b, c]) => { const on = c ? !erase && color === c : erase; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }); };
        [["#0E1B3A", "Black"], ["#1F5FCC", "Blue"], ["#C02631", "Red"]].forEach(([c, n]) => { const b = btn("padpen", "", () => { color = c; erase = false; mark(); }); b.style.setProperty("--pen", c); b.setAttribute("aria-label", n + " pen"); pens.push([b, c]); tools.append(b); });
        const er = btn("padbtn", "Eraser", () => { erase = !erase; mark(); }); pens.push([er, ""]); tools.append(er); mark();
        tools.append(btn("padbtn", "Undo", () => { strokes.pop(); dirty = true; paint(); }), btn("padbtn", "Clear", () => { strokes.length = 0; dirty = true; paint(); }));
        host.append(tools);
    }
    /** A small picture of the work for the teacher (white background, about 600 px wide). */
    function image() {
        if (!strokes.length) return "";
        const c = document.createElement("canvas"); c.width = 600; c.height = Math.round(600 * H / W); const x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(canvas, 0, 0, c.width, c.height);
        return c.toDataURL("image/png");
    }
    return { mount, image, clear() { strokes.length = 0; dirty = false; paint(); }, dirty: () => dirty, sent() { dirty = false; sentAt = Date.now(); }, sentAt: () => sentAt, has: () => strokes.length > 0 };
})();
// Live work: when the teacher turns it on, the pad is sent every few seconds while it changes.
setInterval(() => {
    if (!ST.room || !ST.room.live || !ST.me || ST.me.status !== "play" || !ST.me.q || ST.view !== "q" || !pad.dirty() || Date.now() - pad.sentAt() < 5000) return;
    const img = pad.image(); pad.sent(); send({ img, iq: ST.me.q.n, it: Date.now() });
}, 1000);

/* ---------- drawing the page ---------- */
function stats() {
    const s = $("stats"), m = ST.me;
    if (!m || !m.nm || ST.roomGone) { s.hidden = true; return; }
    s.hidden = false; s.textContent = "";
    const chip = (label, val, cls) => { const c = el("span", "pstat" + (cls ? " " + cls : "")); c.append(el("small", null, label), el("b", null, val)); s.append(c); };
    chip("Name", m.nm); chip("Coins", String(m.c), "coin"); chip("Hacks", String(m.h)); if (m.status !== "lobby") chip("Place", m.rank + " of " + m.players);
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
    const k = JSON.stringify([ST.step, ST.view, ST.err, ST.busy, ST.target, ST.guess, ST.vault, ST.roomGone, ST.room && [ST.room.status, ST.room.taken, ST.room.names && ST.room.names.length], m && [m.n, m.status, m.need]]);
    if (k === sig && !force) return;
    // Keep the pad (and anything typed) while the same question stays on screen.
    const sameQ = !force && ST.step === "play" && ST.view === "q" && m && m.q && document.getElementById("padhost") && +$("padhost").dataset.q === m.q.n && !ST.roomGone;
    sig = k; stats();
    if (sameQ) { const n = $("pnote"); if (n) n.textContent = ST.err; return; }
    const main = $("main"); main.textContent = "";
    const card = el("section", "pcard"); main.append(card);
    if (ST.roomGone) { card.append(el("h1", null, "The game is closed"), el("p", "plead", "Thanks for playing! Your teacher closed the game.")); return; }
    if (ST.step === "code") return codeStep(card);
    if (ST.step === "name") return nameStep(card);
    if (ST.step === "vault") return vaultStep(card, false);
    if (!m) { card.append(el("h1", null, "Joining…"), el("p", "plead", "Hang on a second.")); return; }
    if (m.status === "lobby") {
        if (m.need) return vaultStep(card, true);
        card.append(el("h1", null, "You're in, " + m.nm + "!"), el("p", "plead", "Your vault code is"), codeShow(m.code), el("p", "plead", "Keep it secret. The game starts when your teacher says go. Watch the board."));
        return;
    }
    if (m.status === "done") {
        card.append(el("h1", null, "Game over!"), el("p", "pbig", ordinal(m.rank) + " place"), el("p", "plead", m.c + " coins · " + m.r + " of " + m.of + " right"), el("p", "pnote", "Great work. Look at the board for the winners."));
        return;
    }
    if (ST.view === "hit" && m.hit) {
        card.classList.add("alert");
        card.append(el("h1", null, "Your vault was cracked!"), el("p", "plead", m.hit.by + " guessed your code and took " + m.hit.lost + " coins. Set a new code to lock it again."));
        const b = btn("pbtn go", "Set a new code", () => { ST.seenHit = m.hit.at; ST.view = "q"; draw(true); }); card.append(b); return;
    }
    if (m.need) return vaultStep(card, true);
    if (ST.view === "fb") return fbView(card);
    if (ST.view === "targets") return targetsView(card);
    if (ST.view === "guess") return guessView(card);
    questionView(card);
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
    card.append(el("h1", null, again ? "Set a new vault code" : "Set your vault code"), el("p", "plead", "Pick 3 different digits, 1 to 9. Classmates will try to guess it, so don't share it."));
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
    const m = ST.me, q = m.q; card.classList.add("wide");
    if (!q) { card.append(el("p", "plead", "Getting your question…")); return; }
    const top = el("div", "pqtop"); if (q.c) top.append(el("span", "pchip", q.c)); if (m.h > 0) top.append(btn("pbtn hack", "Hack a vault (" + m.h + ")", () => { ST.view = "targets"; draw(true); }));
    card.append(top, mathEl("p", "pq", q.t));
    const f = el("form", "pform ans"), inp = el("input", "ptext"); inp.maxLength = 80; inp.autocomplete = "off"; inp.placeholder = "Your answer"; inp.setAttribute("aria-label", "Your answer");
    const go = el("button", "pbtn go", "Submit"); go.type = "submit";
    f.onsubmit = (e) => {
        e.preventDefault(); const t = inp.value.trim(); if (!t) { ST.err = "Type your answer first."; const n = $("pnote"); if (n) n.textContent = ST.err; return; }
        if (ST.sentQ === q.n) return;
        ST.sentQ = q.n; ST.err = ""; go.disabled = true; go.textContent = "Checking…";
        const img = pad.image(); pad.sent(); send({ a: { n: Date.now(), q: q.n, t: t.slice(0, 80) }, img, iq: q.n, it: Date.now() });
        setTimeout(() => { if (ST.sentQ === q.n && ST.view === "q") { ST.sentQ = -1; ST.err = "Your teacher's screen didn't answer. Try Submit again, or tell your teacher."; draw(true); } }, 10000);
    };
    f.append(inp, go); card.append(f); note(card);
    const host = el("div", "padhost"); host.id = "padhost"; host.dataset.q = String(q.n); host.append(el("p", "padlab", "Show your work"));
    pad.mount(host); card.append(host);
}
function fbView(card) {
    const m = ST.me, f = m.fb || {};
    card.classList.add(f.ok ? "good" : "miss");
    if (f.ok) card.append(el("h1", null, f.fixed ? "Your teacher counted it!" : "Right!"), el("p", "pbig", "+" + f.plus + " coins"), el("p", "plead", "+1 hack" + (m.st > 1 ? " · " + m.st + " in a row" : "")));
    else { card.append(el("h1", null, "Not quite")); if (f.a) { const a = el("div", "pansbox"); a.append(el("small", null, "The answer was"), mathEl("p", null, f.a)); card.append(a); } card.append(el("p", "plead", "You wrote " + (f.y || "nothing") + ".")); }
    const row = el("div", "prow");
    row.append(btn("pbtn go", "Next question", () => { ST.view = "q"; draw(true); }));
    if (m.h > 0) row.append(btn("pbtn hack", "Hack a vault (" + m.h + ")", () => { ST.view = "targets"; draw(true); }));
    card.append(row);
}
function targetsView(card) {
    const m = ST.me; card.classList.add("wide");
    card.append(el("h1", null, "Pick a vault to hack"), el("p", "plead", "You have " + m.h + (m.h === 1 ? " hack" : " hacks") + ". Each guess uses one. Crack a code to take a share of the coins."));
    const list = el("div", "ptargets");
    (m.targets || []).forEach((t) => {
        const b = btn("ptarget", null, () => { ST.target = t.id; ST.guess = ""; ST.view = "guess"; draw(true); });
        b.append(el("b", null, t.nm), el("span", null, t.c + " coins"), el("small", null, t.sh ? "Firewall up" : t.g.length ? t.g.length + (t.g.length === 1 ? " guess so far" : " guesses so far") : "Not tried yet"));
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
    card.append(el("h1", null, "Hack " + t.nm + "'s vault"));
    if (cracked) { card.classList.add("good"); card.append(el("p", "pbig", "Cracked! +" + m.hk.steal + " coins"), el("p", "plead", t.nm + " has to set a new code.")); card.append(btn("pbtn go", "Back to questions", () => { ST.view = "q"; ST.target = ""; draw(true); })); return; }
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
