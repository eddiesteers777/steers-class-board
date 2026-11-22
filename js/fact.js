/* ==========================================
   Anchor Board — Fact Blitz, the student page (fact.html, anchorboard.web.app/fact?c=123456).
   Same sign-in as Vault Raid and Assignments: no account and no password, an anonymous guest on this device only.
   A student types the code (or opens the link), taps their period and name, and plays.

   A run is timed and ends on its own when the clock runs out. The clock is the teacher's (1 to 5 minutes), times
   the student's extra time when the teacher gave them some; that comes from the teacher's page to this student
   only (flu/{code}/s/{guest}), so a Speed check waits for it before the run can start.
   Speed check: one try (unless the teacher gives another), then practice if they want.
   Practice: as many runs as they like; facts they miss or are slow on come back more often (kept on this device).

   Every run is written to the student's own entry (flu/{code}/p/{guest}) as it goes: each fact, what they typed
   and how long it took. The teacher's page scores it from that. Arcade points and high scores are just for fun
   and stay on this device; they are never part of a grade.
========================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeFirestore, doc, getDoc, onSnapshot, setDoc, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import * as F from "./factCore.js?v=1";
import * as Buddy from "./buddy.js?v=2";

// Same project and app name as the Vault Raid page, so a Chromebook is the same guest in both.
const app = initializeApp({
    apiKey: "AIzaSyA8kAei_AJMU66EePYQyI8nlVJeLes5HLY",
    authDomain: "steers-class-board.firebaseapp.com",
    projectId: "steers-class-board",
    storageBucket: "steers-class-board.firebasestorage.app",
    messagingSenderId: "997357619072",
    appId: "1:997357619072:web:8e47464df7c4e329fd2365"
}, "play");
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
const local = {
    get: (k) => { try { return localStorage.getItem("anchorboard-fact-" + k) || ""; } catch (e) { return ""; } },
    set: (k, v) => { try { localStorage.setItem("anchorboard-fact-" + k, v); } catch (e) { /* ok */ } },
    json: (k, d) => { try { return JSON.parse(local.get(k)) || d; } catch (e) { return d; } },
};
const calm = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n) => Math.round(+n || 0).toLocaleString();

/* ---------- sound (made here, no files) ---------- */
let AC = null;
const SOUNDS = {   // [frequency, start s, length s, wave, volume, slide to]
    right: [[880, 0, .07, "square", .03], [1320, .05, .09, "square", .03]],
    combo: [[660, 0, .07, "square", .04], [990, .06, .07, "square", .04], [1320, .12, .14, "square", .04]],
    miss: [[196, 0, .18, "sawtooth", .05, 130]],
    tick: [[1200, 0, .03, "square", .02]],
    go: [[523, 0, .1, "square", .04], [784, .1, .1, "square", .04], [1047, .2, .24, "square", .05]],
    count: [[440, 0, .12, "square", .04]],
    over: [[784, 0, .14, "square", .05], [587, .14, .14, "square", .05], [392, .28, .3, "square", .05]],
    best: [[523, 0, .1, "square", .04], [659, .1, .1, "square", .04], [784, .2, .1, "square", .04], [1047, .3, .1, "square", .04], [1319, .4, .4, "square", .05]],
    tap: [[880, 0, .05, "sine", .05]],
};
const soundOn = () => local.get("mute") !== "1";
function sfx(k) {
    if (!soundOn() || !SOUNDS[k]) return;
    try {
        AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume();
        const t = AC.currentTime + 0.01;
        SOUNDS[k].forEach(([f, at, len, wave, vol, to]) => {
            const o = AC.createOscillator(), g = AC.createGain(); o.type = wave || "sine"; o.frequency.setValueAtTime(f, t + at);
            if (to) o.frequency.exponentialRampToValueAtTime(to, t + at + len);
            g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
            o.connect(g).connect(AC.destination); o.start(t + at); o.stop(t + at + len + 0.03);
        });
    } catch (e) { /* no sound on this device */ }
}
document.addEventListener("pointerdown", () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch (e) { /* ok */ } }, { once: true });
function paintMute() { const b = $("mute"); b.textContent = soundOn() ? "Sound on" : "Sound off"; b.setAttribute("aria-pressed", soundOn() ? "false" : "true"); }
$("mute").onclick = () => { local.set("mute", soundOn() ? "1" : "0"); paintMute(); sfx("tap"); };
paintMute();

/* ---------- state ---------- */
const ST = {
    uid: "", code: "", F: null, me: null, s: null, sSeen: false, err: "", busy: false,
    step: "code",            // code → per → name → home → count → play → over
    per: "", typing: false, waitedAt: 0,
    run: null,               // the run being played (also the last entry of me.runs)
    deck: [], di: 0, typed: "", shownAt: 0, streak: 0, pts: 0, flash: null, endsAt: 0, raf: 0, last: null,
    saved: "", saveT: 0, savedAt: 0,
};
let unsubF = null, unsubMe = null, unsubS = null;

async function signIn() {
    if (auth.currentUser) return auth.currentUser.uid;
    await new Promise((r) => { const u = onAuthStateChanged(auth, () => { u(); r(); }); });
    if (auth.currentUser) return auth.currentUser.uid;
    return (await signInAnonymously(auth)).user.uid;
}
const mineRef = () => doc(db, "flu", ST.code, "p", ST.uid);
async function open(code) {
    ST.err = ""; ST.busy = true; draw();
    try { ST.uid = await signIn(); }
    catch (e) { ST.busy = false; ST.err = /operation-not-allowed|admin-restricted/.test((e && e.code) || "") ? "Student sign-in isn't turned on for this site yet. Tell your teacher." : "Couldn't connect. Check the Wi-Fi and try again."; draw(); return; }
    stop();
    ST.code = code; ST.F = null; ST.me = null; ST.s = null; ST.sSeen = false;
    try { const s = await getDoc(mineRef()); if (s.exists()) { ST.me = Object.assign({ runs: [] }, s.data()); ST.per = ST.me.per; } } catch (e) { /* not there yet */ }
    unsubF = onSnapshot(doc(db, "flu", code), (s) => {
        ST.busy = false;
        if (!s.exists()) { ST.err = "No Fact Blitz has that code. Check it and try again."; ST.code = ""; ST.step = "code"; stop(); draw(); return; }
        ST.F = Object.assign({}, F.DEFAULTS, s.data()); local.set("code", code);
        if (ST.step === "code") ST.step = ST.me ? "home" : "per";
        if (ST.step === "per") { const pers = periods(); if (pers.length === 1) { ST.per = pers[0]; ST.step = "name"; } }
        if (ST.step !== "play" && ST.step !== "count") draw();
    }, () => { ST.busy = false; ST.err = "Couldn't open that code. Check it and try again."; ST.code = ""; ST.step = "code"; stop(); draw(); });
    unsubS = onSnapshot(doc(db, "flu", code, "s", ST.uid), (s) => {
        ST.sSeen = true; ST.s = s.exists() ? s.data() : null;
        if (ST.step === "home") draw();
    }, () => { ST.sSeen = true; });
    unsubMe = onSnapshot(mineRef(), (s) => {
        if (!s.exists() || s.metadata.hasPendingWrites) return;
        if (!ST.me) { ST.me = Object.assign({ runs: [] }, s.data()); ST.per = ST.me.per; if (ST.step === "name" || ST.step === "per") { ST.step = "home"; draw(); } }
    }, () => {});
}
function stop() { [unsubF, unsubMe, unsubS].forEach((u) => u && u()); unsubF = unsubMe = unsubS = null; }

/** Write this student's whole entry (who they are plus their runs). Tries again on its own after a failed save. */
function save() {
    const m = ST.me; if (!m) return Promise.resolve();
    clearTimeout(ST.saveT);
    const data = { per: m.per, ni: m.ni, nm: m.nm || "", at: Date.now(), runs: (m.runs || []).slice(-F.MAX_RUNS) };
    ST.saved = "saving"; paintSaved();
    return setDoc(mineRef(), JSON.parse(JSON.stringify(data))).then(() => { ST.saved = "saved"; ST.savedAt = Date.now(); paintSaved(); }, (e) => {
        const closed = ST.F && ST.F.status !== "open";
        ST.saved = closed ? "closed" : "fail"; paintSaved();
        if (!closed && !/permission/.test((e && e.code) || "")) ST.saveT = setTimeout(save, 4000);
    });
}
function paintSaved() {
    const n = document.querySelector(".fbsaved"); if (!n) return;
    n.textContent = ST.saved === "saving" ? "Saving…" : ST.saved === "saved" ? "Saved for your teacher" : ST.saved === "fail" ? "Not saved yet: check the Wi-Fi. It keeps trying." : ST.saved === "closed" ? "Your teacher closed this, so it couldn't be saved." : "";
    n.dataset.s = ST.saved;
}

/* ---------- who plays on this Chromebook ---------- */
/** Remembered per teacher: { o: owner, p: period, n: name }. Falls back to the name Vault Raid remembers. */
function remembered() {
    const F0 = ST.F; if (!F0) return null;
    const mine = local.json("me", null), vr = (() => { try { return JSON.parse(localStorage.getItem("anchorboard-play-me") || "null"); } catch (e) { return null; } })();
    for (const m of [mine, vr]) {
        if (!m || !m.n || m.o !== (F0.owner || "") || !m.p) continue;
        const names = (F0.names || {})[m.p] || [], i = names.indexOf(m.n);
        if (i >= 0) return { per: m.p, ni: i, nm: m.n, l: m.l || "" };
    }
    return null;
}
function myLook() {
    try { const vr = JSON.parse(localStorage.getItem("anchorboard-play-me") || "null"); if (vr && ST.me && vr.n === ST.me.nm && Buddy.validLook(vr.l) && vr.l) return vr.l; } catch (e) { /* ok */ }
    return Buddy.seedLook((ST.me && ST.me.nm) || "player");
}
const periods = () => Object.keys((ST.F && ST.F.names) || {}).filter((p) => ((ST.F.names[p]) || []).length);
function pick(ni, nm) {
    ST.me = { per: ST.per || periods()[0] || "class", ni, nm: String(nm).slice(0, 24), runs: [] };
    local.set("me", JSON.stringify({ o: ST.F.owner || "", p: ST.me.per, n: ST.me.nm }));
    ST.step = "home"; sfx("tap"); save(); draw();
}

/* ---------- the rules for this student ---------- */
const extra = () => { const x = +(ST.s && ST.s.x) || 1; return F.EXTRA.includes(x) ? x : 1; };
const triesAllowed = () => Math.max(1, +(ST.s && ST.s.rt) || +ST.F.tries || 1);
const isCheck = () => ST.F.mode === "check";
const checkLeft = () => (isCheck() ? Math.max(0, triesAllowed() - F.checksUsed(ST.me.runs)) : 0);
const bestKey = (set) => "best-" + set + "-" + (ST.F.top || 12) + "-" + (ST.F.secs || 120);
const myBest = (set) => local.json(bestKey(set), { pts: 0, r: 0 });

/* ---------- drawing ---------- */
const main = () => $("main");
function card(cls) { const c = el("section", "pcard" + (cls ? " " + cls : "")); main().textContent = ""; main().append(c); return c; }
function errLine(c) { const p = el("p", "pnote err", ST.err); p.setAttribute("role", "alert"); c.append(p); }
function who() {
    const w = $("who"); if (!ST.me || ST.step === "code") { w.hidden = true; return; }
    w.hidden = false; w.textContent = ""; w.append(el("span", null, "Playing as "), el("b", null, ST.me.nm));
    if (ST.step === "home") { const n = btn("fbnot", "Not you?", () => { if (F.checksUsed(ST.me.runs) || (ST.me.runs || []).length) { ST.err = "This Chromebook already has runs as " + ST.me.nm + ". Ask your teacher if this isn't you."; draw(); return; } ST.me = null; ST.step = "name"; draw(); }); w.append(n); }
}
function draw() {
    document.body.dataset.step = ST.step; who();
    if (ST.step === "code") return drawCode();
    if (!ST.F) { const c = card(); c.append(el("p", "plead", "Loading…")); return; }
    if (ST.step === "per") return drawPer();
    if (ST.step === "name") return drawName();
    if (ST.step === "home") return drawHome();
    if (ST.step === "over") return drawOver();
}
function drawCode() {
    const c = card("fbcab");
    c.append(logo(), el("p", "fbins", "Type the code from your teacher."));
    const f = el("form", "pform"), inp = el("input", "pcode");
    inp.inputMode = "numeric"; inp.maxLength = 6; inp.autocomplete = "off"; inp.setAttribute("aria-label", "Code"); inp.value = ST.code || "";
    const go = btn("pbtn go", ST.busy ? "Joining…" : "Join"); go.type = "submit"; go.disabled = ST.busy;
    f.append(inp, go); f.onsubmit = (e) => { e.preventDefault(); const v = inp.value.replace(/\D/g, ""); if (v.length !== 6) { ST.err = "The code has 6 digits."; draw(); return; } open(v); };
    c.append(f); errLine(c); setTimeout(() => inp.focus(), 30);
}
function logo() {
    const w = el("div", "fblogo"); w.setAttribute("aria-label", "Fact Blitz"); w.setAttribute("role", "img");
    w.append(el("span", "fbl1", "FACT"), el("span", "fbl2", "BLITZ"));
    return w;
}
function drawPer() {
    const c = card("wide"); c.append(el("h1", null, ST.F.title || "Fact Blitz"), el("p", "plead", "Tap your class period."));
    const g = el("div", "pnames"); periods().forEach((p) => g.append(btn("pname", p + " period", () => { ST.per = p; ST.step = "name"; draw(); }))); c.append(g); errLine(c);
}
function drawName() {
    const c = card("wide"), names = (ST.F.names || {})[ST.per] || [];
    c.append(el("h1", null, "Who's playing?"));
    const r = remembered();
    if (r && r.per === ST.per) {
        const me = el("div", "fbme"), face = el("span", "fbface"); face.innerHTML = Buddy.svg(Buddy.validLook(r.l) && r.l ? r.l : Buddy.seedLook(r.nm), { face: true, size: 64 }); face.setAttribute("aria-hidden", "true");
        me.append(face, el("b", null, r.nm), btn("pbtn go", "That's me", () => pick(r.ni, r.nm))); c.append(me, el("p", "plead", "Or tap your name:"));
    } else c.append(el("p", "plead", "Tap your name."));
    const g = el("div", "pnames"); names.forEach((nm, ni) => g.append(btn("pname", nm, () => pick(ni, nm)))); c.append(g);
    if (periods().length > 1) c.append(btn("pbtn ghost", "Back to periods", () => { ST.step = "per"; draw(); }));
    errLine(c);
}

function drawHome() {
    const Fd = ST.F, c = card("fbcab wide"), check = isCheck(), left = checkLeft(), x = extra();
    const secs = Math.round((+Fd.secs || 120) * x);
    c.append(logo());
    const info = el("div", "fbinfo");
    info.append(el("p", "fbmode", check ? "SPEED CHECK" : "PRACTICE"), el("p", "fbset", F.setName(Fd.set) + (Fd.top === 10 ? " · up to 10" : " · up to 12")),
        el("p", "fbclock", F.fmtSecs(secs) + " on the clock" + (x > 1 ? " (your time)" : "")));
    c.append(info);
    if (Fd.status !== "open") { c.append(el("p", "fbins", "Your teacher closed this one. Nice work!")); return; }

    const used = (ST.me.runs || []).filter((r) => r.md === "c");
    const left0 = used.length && used[used.length - 1] && !used[used.length - 1].end;
    if (check && left > 0) {
        if (!ST.sSeen || !ST.s) {
            // the teacher's page sends each student their clock; wait for it so extra time is never missed
            if (!ST.waitedAt) ST.waitedAt = Date.now();
            const p = el("p", "fbins", "Getting your check ready…"); c.append(p);
            if (Date.now() - ST.waitedAt > 7000) c.append(el("p", "pnote", "Still waiting for your teacher's page. Tell your teacher if this doesn't change."));
            setTimeout(() => { if (ST.step === "home" && (!ST.s)) draw(); }, 2500);
        } else {
            c.append(el("p", "fbins", left > 1 || used.length ? "Answer as many as you can before time runs out. Type the answer; it checks itself." : "One try. Answer as many as you can before time runs out. Type the answer; it checks itself."));
            const go = btn("pbtn go fbstart", "PRESS START", () => start("c")); c.append(go); setTimeout(() => go.focus(), 30);
        }
    } else if (check) {
        const cr = F.countedRun(ST.me.runs, Fd.counts, Fd.goal);
        if (cr) { const sc = F.scoreRun(cr); c.append(el("p", "fbins", left0 && !cr.end ? "Your check ended when you left the page. Ask your teacher if you need another try." : "Speed check done: " + sc.r + " right. Your teacher has it.")); }
        c.append(btn("pbtn go fbstart", "PRACTICE MORE", () => start("p")));
    } else {
        c.append(el("p", "fbins", "Beat your high score. Facts you miss come back more often."));
        const go = btn("pbtn go fbstart", "PRESS START", () => start("p")); c.append(go); setTimeout(() => go.focus(), 30);
    }
    const b = myBest(Fd.set);
    const hs = el("div", "fbhs"); hs.append(el("p", "fbhst", "YOUR HIGH SCORE"), el("p", "fbhsn", fmt(b.pts)), el("p", "fbhsr", b.r ? b.r + " right" : "No runs yet"));
    const runs = (ST.me.runs || []).slice(-5).reverse();
    if (runs.length) { const ul = el("ul", "fbruns"); runs.forEach((r) => { const sc = F.scoreRun(r); ul.append(el("li", null, (r.md === "c" ? "Check" : "Practice") + ": " + sc.r + " right, " + F.pct(sc.acc))); }); hs.append(ul); }
    c.append(hs); errLine(c);
}

/* ---------- playing ---------- */
const uidRun = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function start(md) {
    const Fd = ST.F; if (Fd.status !== "open") return;
    if (md === "c" && checkLeft() <= 0) return;
    sfx("tap"); ST.err = "";
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    let dk = F.deck(Fd.set, Fd.top, seed, 400);
    if (md === "p") dk = F.withTough(dk, local.json("tough-" + Fd.set, {}), Fd.set, Fd.top, seed);
    const b = +Fd.secs || 120, x = extra();
    ST.run = { id: uidRun(), md, set: Fd.set, top: Fd.top, b, s: Math.round(b * x), t0: Date.now(), lg: [], end: 0, pts: 0 };
    ST.me.runs = (ST.me.runs || []).concat([ST.run]).slice(-F.MAX_RUNS);
    ST.deck = dk; ST.di = -1; ST.typed = ""; ST.streak = 0; ST.pts = 0; ST.flash = null; ST.last = null;
    if (md === "c") save();   // the try is used once it starts, so walking away and back doesn't reset it
    countdown();
}
function countdown() {
    ST.step = "count"; document.body.dataset.step = "count"; who();
    const c = card("fbcab fbcount"), n = el("p", "fbcountn", "3"); c.append(el("p", "fbmode", ST.run.md === "c" ? "SPEED CHECK" : "PRACTICE"), n);
    let k = 3; sfx("count");
    const t = setInterval(() => {
        k -= 1;
        if (k > 0) { n.textContent = String(k); sfx("count"); return; }
        clearInterval(t); n.textContent = "GO!"; sfx("go"); setTimeout(play, calm() ? 150 : 420);
    }, calm() ? 700 : 800);
}
function play() {
    ST.step = "play"; document.body.dataset.step = "play"; who();
    const c = card("fbcab fbplay");
    const hud = el("div", "fbhud");
    const s1 = el("div", "fbh"), s2 = el("div", "fbh fbhmid"), s3 = el("div", "fbh fbhr");
    s1.append(el("small", null, "SCORE"), el("b", "fbpts", "0"));
    s2.append(el("small", null, "TIME"), el("b", "fbtime", F.fmtSecs(ST.run.s)));
    s3.append(el("small", null, "RIGHT"), el("b", "fbright", "0"));
    hud.append(s1, s2, s3);
    const bar = el("div", "fbbarw"), fill = el("i", "fbbarf"); bar.append(fill); bar.setAttribute("aria-hidden", "true");
    const stage = el("div", "fbstage");
    const q = el("p", "fbq"); q.setAttribute("aria-live", "off");
    const ans = el("p", "fbans"); ans.setAttribute("aria-label", "Your answer");
    const combo = el("p", "fbcombo"), fb = el("p", "fbfb"); fb.setAttribute("aria-live", "polite");
    stage.append(combo, q, ans, fb);
    const keys = el("div", "fbkeys");
    ["7", "8", "9", "4", "5", "6", "1", "2", "3", "−", "0", "⌫"].forEach((k) => {
        const b = btn("fbkey" + (k === "⌫" ? " del" : k === "−" ? " neg" : ""), k, () => key(k === "⌫" ? "Backspace" : k === "−" ? "-" : k));
        b.setAttribute("aria-label", k === "⌫" ? "Delete" : k === "−" ? "Negative" : k); keys.append(b);
    });
    const ent = btn("fbkey ent", "ENTER", () => key("Enter")); keys.append(ent);
    const lay = el("div", "fblay"); lay.append(stage, keys);
    c.append(hud, bar, lay);
    ST.endsAt = performance.now() + ST.run.s * 1000; ST.lastSec = -1;
    nextFact();
    cancelAnimationFrame(ST.raf);
    const tick = () => {
        if (ST.step !== "play") return;
        const left = Math.max(0, ST.endsAt - performance.now()), sec = Math.ceil(left / 1000);
        fill.style.transform = "scaleX(" + (left / (ST.run.s * 1000)).toFixed(4) + ")";
        if (sec !== ST.lastSec) { ST.lastSec = sec; const t = document.querySelector(".fbtime"); if (t) t.textContent = F.fmtSecs(sec); c.classList.toggle("hurry", sec <= 10); if (sec <= 5 && sec > 0) sfx("tick"); }
        if (left <= 0) { finish(); return; }
        ST.raf = requestAnimationFrame(tick);
    };
    ST.raf = requestAnimationFrame(tick);
}
function paintPlay() {
    const f = ST.deck[ST.di], q = document.querySelector(".fbq"), a = document.querySelector(".fbans"); if (!q || !a) return;
    q.textContent = F.showFact(f) + " =";
    a.textContent = ST.typed ? ST.typed.replace("-", "−") : "";
    a.classList.toggle("empty", !ST.typed);
    const cb = document.querySelector(".fbcombo"), m = F.comboOf(ST.streak); cb.textContent = m > 1 ? "COMBO ×" + m : ST.streak >= 3 ? ST.streak + " IN A ROW" : ""; cb.dataset.m = m;
    document.querySelector(".fbpts").textContent = fmt(ST.pts);
    document.querySelector(".fbright").textContent = String(ST.run.lg.filter((x) => F.isRight(x.split(":")[0], x.split(":")[1])).length);
}
function nextFact() {
    ST.di = (ST.di + 1) % ST.deck.length;
    ST.typed = ""; ST.shownAt = performance.now(); paintPlay();
}
function key(k) {
    if (ST.step !== "play") return;
    const f = ST.deck[ST.di], need = F.answerLen(f);
    if (k === "Backspace") { ST.typed = ST.typed.slice(0, -1); paintPlay(); return; }
    if (k === "Enter") { if (ST.typed && ST.typed !== "-") submit(); return; }
    if (k === "-") { if (!ST.typed) { ST.typed = "-"; paintPlay(); } return; }
    if (!/^\d$/.test(k) || ST.typed.replace("-", "").length >= 4) return;
    ST.typed += k; paintPlay();
    if (ST.typed.length >= need) submit();   // checks itself once the answer is as long as the right one
}
function submit() {
    const f = ST.deck[ST.di], ms = performance.now() - ST.shownAt, ok = F.isRight(f, ST.typed);
    ST.run.lg.push(F.logItem(f, ST.typed, ms));
    const fb = document.querySelector(".fbfb"), stage = document.querySelector(".fbstage");
    if (ok) {
        ST.streak += 1; const p = F.pointsFor(ST.streak, ms); ST.pts += p; ST.run.pts = ST.pts;
        sfx(F.comboOf(ST.streak) > F.comboOf(ST.streak - 1) ? "combo" : "right");
        if (fb) { fb.textContent = "+" + p; fb.className = "fbfb good"; }
        if (stage && !calm()) { stage.classList.remove("hit", "oops"); void stage.offsetWidth; stage.classList.add("hit"); }
    } else {
        ST.streak = 0; sfx("miss");
        if (fb) { fb.textContent = F.showFact(f) + " = " + String(F.answerOf(f)).replace("-", "−"); fb.className = "fbfb bad"; }
        if (stage && !calm()) { stage.classList.remove("hit", "oops"); void stage.offsetWidth; stage.classList.add("oops"); }
    }
    // keep the teacher's copy close to live without writing on every key
    if (ST.run.lg.length % 6 === 0 && Date.now() - ST.savedAt > 4000) save();
    nextFact();
}
document.addEventListener("keydown", (e) => {
    if (ST.step !== "play") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key === "−" || e.key === "Subtract" ? "-" : e.key;
    if (/^\d$/.test(k) || k === "-" || k === "Backspace" || k === "Enter") { e.preventDefault(); key(k); }
});
function finish() {
    cancelAnimationFrame(ST.raf);
    const r = ST.run; r.end = Date.now(); r.pts = ST.pts;
    ST.step = "over"; sfx("over");
    const sc = F.scoreRun(r), items = F.parseLog(r.lg);
    if (r.md === "p") local.set("tough-" + r.set, JSON.stringify(F.updateTough(local.json("tough-" + r.set, {}), sc, items)));
    const b = myBest(r.set), isBest = ST.pts > (+b.pts || 0);
    if (isBest) local.set(bestKey(r.set), JSON.stringify({ pts: ST.pts, r: sc.r }));
    ST.last = { sc, isBest, prevBest: +b.pts || 0 };
    const c = card("fbcab fbcount"); c.append(el("p", "fbcountn fbtimeup", "TIME!"));
    save();
    setTimeout(draw, calm() ? 200 : 1100);
}
function drawOver() {
    const r = ST.run, L = ST.last; if (!r || !L) { ST.step = "home"; draw(); return; }
    const sc = L.sc, c = card("fbcab wide fbover");
    if (L.isBest) { c.append(el("p", "fbnew", "NEW HIGH SCORE!")); sfx("best"); }
    const top = el("div", "fbtop"), fig = el("div", "fbfig"); fig.setAttribute("aria-hidden", "true");
    fig.innerHTML = Buddy.svg(myLook(), { size: 150 }); if (!calm()) { try { Buddy.animate(fig, { move: sc.r >= 10 ? "cheer" : "wave" }); } catch (e) { /* still picture */ } }
    const big = el("div", "fbbig");
    big.append(el("p", "fbbign", String(sc.r)), el("p", "fbbigl", sc.r === 1 ? "fact right" : "facts right"));
    const stats = el("div", "fbstats");
    [["SCORE", fmt(r.pts)], ["ACCURATE", F.pct(sc.acc)], ["PER MINUTE", (Math.round(sc.pm * 10) / 10).toString()]].forEach(([k, v]) => { const s = el("div", "fbst"); s.append(el("small", null, k), el("b", null, v)); stats.append(s); });
    big.append(stats); top.append(fig, big); c.append(top);
    const runs = (ST.me.runs || []).filter((x) => x.set === r.set && x.id !== r.id && x.end);
    if (runs.length) { const prev = F.scoreRun(runs[runs.length - 1]), d = sc.r - prev.r; c.append(el("p", "fbins", d > 0 ? "That's " + d + " more than your last run. Your brain is getting faster." : d === 0 ? "Same as your last run. Keep going." : "Your last run had " + prev.r + ". Every run is practice.")); }
    if (sc.miss.length) {
        const w = el("div", "fbmiss"); w.append(el("p", "fbhst", "FACTS TO PRACTICE"));
        const ul = el("ul"); sc.miss.slice(0, 12).forEach((f) => ul.append(el("li", null, F.showFact(f) + " = " + String(F.answerOf(f)).replace("-", "−")))); w.append(ul); c.append(w);
    }
    c.append(el("p", "fbsaved"));
    const row = el("div", "prow");
    if (ST.F.status === "open") row.append(btn("pbtn go", "PLAY AGAIN", () => start("p")));
    row.append(btn("pbtn ghost", "Done", () => { ST.step = "home"; draw(); }));
    c.append(row); paintSaved();
}

/* ---------- start ---------- */
const qs = new URLSearchParams(location.search), codeIn = (qs.get("c") || qs.get("code") || "").replace(/\D/g, "");
if (codeIn.length === 6) open(codeIn);
else { const last = local.get("code"); if (last) ST.code = last; draw(); }
window.addEventListener("beforeunload", (e) => { if (ST.step === "play" && ST.run && ST.run.md === "c") { e.preventDefault(); e.returnValue = ""; } });
