/* ==========================================
   Anchor Board — the student page for assignments (do.html, anchorboard.web.app/do?c=123456).
   Same sign-in as Vault Raid: no account and no password, an anonymous guest on this device only.
   A student types the code (or opens the link), taps their period and name, and works.

   Practice: one skill at a time, N right to master it. Instant feedback, a hint and another try after a miss,
     worked steps when the tries run out, and "Still stuck?" to see how it's done (that problem then doesn't count,
     and a fresh one comes up). A miss never takes points away.
   Quiz/test: one question per skill, saved as they go, then Turn in. No right or wrong on this page until the
     teacher releases results; this page never has the answer key.
   Corrections: only the questions this student missed on the test, with feedback.

   Every attempt is written to the student's own entry (asg/{code}/p/{guest}), so the teacher sees who is trying.
========================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeFirestore, doc, getDoc, onSnapshot, setDoc, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import * as V from "./vaultCore.js?v=75";
import * as C from "./assignCore.js?v=6";
import { answerBox } from "./answerBox.js?v=5";

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
const mathEl = (tag, cls, text) => { const e = el(tag, cls); e.append(V.mathText(text)); return e; };
const local = { get: (k) => { try { return localStorage.getItem("anchorboard-do-" + k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { localStorage.setItem("anchorboard-do-" + k, v); } catch (e) { /* ok */ } } };
const calm = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

const ST = {
    uid: "", code: "", A: null, me: null, res: null, err: "", busy: false,
    step: "code",              // code → name → pass → home
    per: "", typing: false,
    view: "home", k: -1,        // home · work (practice skill k) · test
    fb: null,                   // feedback on the open problem: { kind: "right"|"again"|"out"|"stuck", hint, i }
    shownAt: 0, ex: false, q: 0, saved: "", passOk: false,
};
let unsubA = null, unsubMe = null, unsubR = null, box = null;

/* ---------- connecting ---------- */
async function signIn() {
    if (auth.currentUser) return auth.currentUser.uid;
    await new Promise((r) => { const u = onAuthStateChanged(auth, () => { u(); r(); }); });
    if (auth.currentUser) return auth.currentUser.uid;
    return (await signInAnonymously(auth)).user.uid;
}
const mineRef = () => doc(db, "asg", ST.code, "p", ST.uid);
async function open(code) {
    ST.err = ""; ST.busy = true; draw();
    try { ST.uid = await signIn(); }
    catch (e) { ST.busy = false; ST.err = /operation-not-allowed|admin-restricted/.test((e && e.code) || "") ? "Student sign-in isn't turned on for this site yet. Tell your teacher." : "Couldn't connect. Check the Wi-Fi and try again."; draw(); return; }
    [unsubA, unsubMe, unsubR].forEach((u) => u && u()); unsubR = null;
    ST.code = code; ST.A = null; ST.me = null; ST.res = null;
    // Coming back: their own entry first, so they land on their work, not the name list.
    try { const s = await getDoc(mineRef()); if (s.exists()) { ST.me = Object.assign({ lg: [], ans: {} }, s.data()); ST.per = ST.me.per; ST.passOk = true; } } catch (e) { /* not there yet */ }
    unsubA = onSnapshot(doc(db, "asg", code), (s) => {
        ST.busy = false;
        if (!s.exists()) { ST.err = "No assignment has that code. Check it and try again."; ST.code = ""; ST.step = "code"; stop(); draw(); return; }
        ST.A = s.data(); local.set("code", code);
        if (ST.step === "code") ST.step = ST.me ? "home" : "name";
        if (C.isTest(ST.A.type) && !unsubR) unsubR = onSnapshot(doc(db, "asg", code, "r", ST.uid), (r) => { ST.res = r.exists() ? r.data() : null; draw(); }, () => {});
        draw();
    }, () => { ST.busy = false; ST.err = "Couldn't open that assignment. Check the code."; ST.code = ""; ST.step = "code"; stop(); draw(); });
    unsubMe = onSnapshot(mineRef(), (s) => {
        if (!s.exists() || s.metadata.hasPendingWrites) return;
        const d = s.data(), had = !!ST.me;
        ST.me = Object.assign({ lg: [], ans: {} }, d);
        if (!had) { ST.per = d.per; if (ST.step === "name" || ST.step === "code") ST.step = "home"; ST.passOk = true; draw(); }
    }, () => {});
}
function stop() { [unsubA, unsubMe, unsubR].forEach((u) => u && u()); unsubA = unsubMe = unsubR = null; }

/** Write this student's whole entry (small: who they are plus their attempts). */
function save() {
    const m = ST.me; if (!m) return Promise.resolve();
    const data = { per: m.per, ni: m.ni, nm: m.nm || "", at: Date.now(), lg: (m.lg || []).slice(-C.MAX_LOG), ans: m.ans || {}, done: !!m.done };
    if (m.sub) data.sub = m.sub;
    ST.saved = "saving";
    return setDoc(mineRef(), data).then(() => { ST.saved = "saved"; drawSaved(); }, (e) => {
        ST.saved = "fail"; ST.err = /permission/.test((e && e.code) || "") ? (ST.A && ST.A.status !== "open" ? "This assignment is closed, so new answers can't be saved." : "Your answer couldn't be saved. Tell your teacher.") : "Not saved yet: check the Wi-Fi. Keep going; it will try again.";
        draw();
    });
}
function drawSaved() { const n = document.querySelector(".dsaved"); if (n) n.textContent = ST.saved === "saving" ? "Saving…" : ST.saved === "saved" ? "Saved" : ""; }

/* ---------- what this student has ---------- */
const seed = () => C.seedOf(ST.code, ST.me.per, ST.me.ni >= 0 ? "#" + ST.me.ni : String(ST.me.nm || "").toLowerCase());
const myKey = () => ST.me.per + "|" + (ST.me.ni >= 0 ? "#" + ST.me.ni : String(ST.me.nm || "").toLowerCase());
/** The skills this student works: all of them, or for corrections only the questions they missed (their exact problem). */
function mySkills() {
    const A = ST.A; if (!A) return [];
    if (A.type !== "fix") return A.skills.map((sk, k) => Object.assign({ k: k }, sk, { kid: k }));
    const mine = ((A.fix || {}).who || {})[myKey()]; if (!mine) return [];
    return mine.q.map((k, j) => Object.assign({}, A.skills[k], { kid: k, need: 1, pin: mine.i[j] }));
}
const optsOf = () => Object.assign({}, C.DEFAULTS, ST.A.opts || {});
const localCheck = (sk) => (i, y) => C.isRight(sk.pool[i], y);
const stateOf = (sk) => C.skillState(sk, sk.kid, ST.me.lg, optsOf(), localCheck(sk));

/* ---------- drawing ---------- */
const main = () => $("main");
let lastView = "";
function draw() {
    const m = main(); m.textContent = "";
    // The card slides in when the screen changes, not every time an answer is checked or saved.
    const key = [ST.step, ST.view, ST.k, ST.q, !!ST.A, !!(ST.me && ST.me.done)].join("|"), still = key === lastView; lastView = key;
    drawInto(m); if (still && m.firstChild) m.firstChild.classList.add("dstill");
}
function drawInto(m) {
    const who = $("who");
    if (ST.me && ST.A) { who.hidden = false; who.textContent = ST.me.nm || ""; } else who.hidden = true;
    if (ST.step === "code" || !ST.A) return m.append(codeCard());
    if (ST.step === "name") return m.append(nameCard());
    if (ST.A.opts && ST.A.opts.pass && !ST.passOk && !(ST.me && ST.me.done)) return m.append(passCard());
    if (C.isTest(ST.A.type)) return m.append(testCard());
    if (ST.view === "work" && ST.k >= 0) return m.append(workCard());
    m.append(homeCard());
}
function card(cls) { return el("section", "pcard" + (cls ? " " + cls : "")); }
function errLine() { return el("p", "pnote err", ST.err || ""); }

function codeCard() {
    const c = card(); c.append(el("h1", null, "Your assignment"), el("p", "plead", "Type the code your teacher gave you."));
    const f = el("form", "pform"), i = el("input", "pcode"); i.inputMode = "numeric"; i.maxLength = 6; i.autocomplete = "off"; i.placeholder = "123456"; i.setAttribute("aria-label", "Assignment code");
    i.value = ST.code || ""; i.oninput = () => { i.value = i.value.replace(/\D/g, "").slice(0, 6); };
    const go = btn("pbtn go", ST.busy ? "Opening…" : "Open"); go.type = "submit"; go.disabled = ST.busy;
    f.onsubmit = (e) => { e.preventDefault(); if (!C.validCode(i.value)) { ST.err = "The code is 6 digits."; draw(); return; } open(i.value); };
    f.append(i, go); c.append(f, errLine());
    c.append(el("p", "pnote", "Playing a game instead? Go to the game page."));
    const a = el("a", "dlink", "Join a game"); a.href = "play.html"; c.lastChild.append(" ", a);
    setTimeout(() => i.focus(), 0); return c;
}

function nameCard() {
    const A = ST.A, c = card("wide"), pers = Object.keys(A.names || {}).filter((p) => (A.names[p] || []).length);
    c.append(el("p", "dkind", C.TYPES[A.type].label), el("h1", null, A.title));
    if (A.status !== "open") { c.append(el("p", "plead", "This assignment is closed. Ask your teacher if you still need to do it.")); return c; }
    if (!ST.per && pers.length === 1) ST.per = pers[0];
    if (!ST.per) {
        c.append(el("p", "plead", "Which class are you in?"));
        const g = el("div", "pnames"); pers.forEach((p) => g.append(btn("pname", p + " period", () => { ST.per = p; draw(); }))); c.append(g);
        if (!pers.length) c.append(el("p", "pnote", "Your teacher hasn't added a class list yet."), typedName());
        return c;
    }
    c.append(el("p", "plead", "Tap your name."));
    // A one-student assignment ("Work on next") lists only that student; the blank lines keep roster positions.
    const g = el("div", "pnames"); (A.names[ST.per] || []).forEach((nm, ni) => { if (nm) g.append(btn("pname", nm, () => pick(ni, nm))); }); c.append(g);
    const row = el("div", "prow");
    if (pers.length > 1) row.append(btn("pbtn ghost", "Wrong class", () => { ST.per = ""; draw(); }));
    if (!A.one) row.append(btn("pbtn ghost", "My name isn't here", () => { ST.typing = !ST.typing; draw(); }));
    c.append(row); if (ST.typing) c.append(typedName()); c.append(errLine());
    return c;
}
function typedName() {
    const f = el("form", "pform"), i = el("input", "ptext"); i.maxLength = 20; i.placeholder = "First name and last initial"; i.setAttribute("aria-label", "Your name");
    const go = btn("pbtn go", "That's me"); go.type = "submit";
    f.onsubmit = (e) => { e.preventDefault(); const nm = V.cleanTyped(i.value); if (!nm) { ST.err = "Type your first name and last initial."; draw(); return; } pick(-1, nm); };
    f.append(i, go); setTimeout(() => i.focus(), 0); return f;
}
function pick(ni, nm) {
    ST.me = { per: ST.per || Object.keys(ST.A.names || {})[0] || "class", ni, nm: String(nm).slice(0, 24), lg: [], ans: {}, done: false };
    ST.err = ""; ST.step = "home"; ST.view = "home"; ST.passOk = !(ST.A.opts && ST.A.opts.pass);
    save(); draw();
}

function passCard() {
    const c = card(); c.append(el("p", "dkind", C.TYPES[ST.A.type].label), el("h1", null, ST.A.title), el("p", "plead", "Your teacher will give you the passcode."));
    const f = el("form", "pform"), i = el("input", "ptext"); i.maxLength = 30; i.autocomplete = "off"; i.setAttribute("aria-label", "Passcode"); i.placeholder = "Passcode";
    const go = btn("pbtn go", "Start"); go.type = "submit";
    f.onsubmit = (e) => { e.preventDefault(); if (C.passOk(ST.A, ST.code, i.value)) { ST.passOk = true; ST.err = ""; } else ST.err = "That passcode isn't right."; draw(); };
    f.append(i, go); c.append(f, errLine()); setTimeout(() => i.focus(), 0); return c;
}

function dueLine() {
    const A = ST.A; if (!A.due) return null;
    const d = new Date(A.due), late = Date.now() > A.due;
    return el("p", "ddue" + (late ? " late" : ""), (late ? "Was due " : "Due ") + d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
}
/** A ring that fills with the grade. */
function ring(v, label, small) {
    const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg"), r = 42, C2 = 2 * Math.PI * r;
    s.setAttribute("viewBox", "0 0 100 100"); s.setAttribute("class", "dring" + (small ? " sm" : "")); s.setAttribute("role", "img"); s.setAttribute("aria-label", label + ": " + Math.round(v * 100) + "%");
    const bg = document.createElementNS(NS, "circle"), fg = document.createElementNS(NS, "circle");
    [bg, fg].forEach((c) => { c.setAttribute("cx", "50"); c.setAttribute("cy", "50"); c.setAttribute("r", String(r)); c.setAttribute("fill", "none"); c.setAttribute("stroke-width", "10"); });
    bg.setAttribute("stroke", "#E4E9F2"); fg.setAttribute("stroke", v >= 1 ? "#1F9D61" : "#F2B33D"); fg.setAttribute("stroke-linecap", "round");
    fg.setAttribute("stroke-dasharray", (C2 * Math.max(0, Math.min(1, v))).toFixed(1) + " " + C2.toFixed(1)); fg.setAttribute("transform", "rotate(-90 50 50)");
    const t = document.createElementNS(NS, "text"); t.setAttribute("x", "50"); t.setAttribute("y", "57"); t.setAttribute("text-anchor", "middle"); t.setAttribute("class", "dringt"); t.textContent = Math.round(v * 100) + "%";
    s.append(bg, fg, t); return s;
}
function dots(right, need) { const d = el("span", "ddots"); d.setAttribute("aria-hidden", "true"); for (let j = 0; j < need; j++) d.append(el("i", j < right ? "on" : "")); return d; }

/* ---------- practice and corrections: the skill list ---------- */
function homeCard() {
    const A = ST.A, c = card("wide"), skills = mySkills(), o = optsOf();
    const head = el("div", "dhead"), ht = el("div");
    ht.append(el("p", "dkind", C.TYPES[A.type].label), el("h1", null, A.title)); const due = dueLine(); if (due) ht.append(due);
    if (A.status !== "open") ht.append(el("p", "ddue late", "Closed. You can look, but new answers won't save."));
    head.append(ht);
    if (!skills.length) { c.append(head, el("p", "plead", A.type === "fix" ? "You have nothing to correct on this test. Nice work." : "This assignment has no problems yet.")); return c; }
    const states = skills.map(stateOf);
    const grade = skills.reduce((s, sk, j) => s + (+sk.w || 1) * Math.min(states[j].right, states[j].need) / states[j].need, 0) / skills.reduce((s, sk) => s + (+sk.w || 1), 0);
    const doneN = states.filter((s) => s.mastered).length;
    const rs = el("div", "dscore"); rs.append(ring(grade, "Your score"), el("div", "dscoret")); rs.lastChild.append(el("b", null, doneN + " of " + skills.length), el("span", null, A.type === "fix" ? "fixed" : "skills done"));
    head.append(rs); c.append(head);
    if (A.type === "fix") {
        const mine = ((A.fix || {}).who || {})[myKey()];
        if (mine && mine.g != null) { const pts = states.reduce((s, st, j) => s + (st.right ? (+skills[j].w || 1) : 0), 0), after = C.withCorrections(mine.g, pts, mine.of, A.opts.back);
            c.append(el("p", "dfixline", "Your test: " + C.pct(mine.g) + (pts ? " → " + C.pct(after) + " with what you've fixed" : ". Fix a question to raise it."))); }
    } else c.append(el("p", "pnote dleft", "Get " + (o.need === 1 ? "1 right" : o.need + " right") + " in each skill. A miss never takes points away: you just get a new problem."));
    const list = el("div", "dskills");
    skills.forEach((sk, j) => {
        const s = states[j], b = btn("dskill" + (s.mastered ? " done" : s.capped ? " capped" : s.served ? " going" : ""), null, () => openSkill(j));
        const t = el("span", "dskt"); t.append(el("b", null, A.type === "fix" ? "Question " + (sk.kid + 1) : sk.name)); if (sk.std) t.append(el("small", null, "Standard " + sk.std));
        const r = el("span", "dskr"); r.append(dots(Math.min(s.right, s.need), s.need), el("small", null, s.mastered ? "Done ✓" : s.capped ? "Ask your teacher" : s.served ? s.right + " of " + s.need + " right" : "Start"));
        b.append(t, r); b.setAttribute("aria-label", (A.type === "fix" ? "Question " + (sk.kid + 1) : sk.name) + ", " + (s.mastered ? "done" : s.right + " of " + s.need + " right")); list.append(b);
    });
    c.append(list);
    const nextJ = states.findIndex((s) => !s.done);
    if (nextJ >= 0 && A.status === "open") c.append(btn("pbtn go dnext", states.some((s) => s.served) ? "Keep going" : "Start", () => openSkill(nextJ)));
    else if (nextJ < 0) c.append(el("p", "dall", A.type === "fix" ? "Every correction is done. Your teacher will see your new score." : "You've finished every skill. Great work."));
    c.append(errLine());
    return c;
}
function openSkill(j) { ST.view = "work"; ST.k = j; ST.fb = null; ST.ex = false; ST.err = ""; ST.shownAt = Date.now(); draw(); window.scrollTo(0, 0); }
function home() { ST.view = "home"; ST.k = -1; ST.fb = null; ST.ex = false; draw(); }

/* ---------- practice: one problem at a time ---------- */
function workCard() {
    const A = ST.A, o = optsOf(), sk = mySkills()[ST.k]; if (!sk) { home(); return el("div"); }
    const s = stateOf(sk), c = card("wide dwork" + (ST.fb && ST.fb.kind === "right" ? " good" : ST.fb && ST.fb.kind !== "right" ? " miss" : ""));
    const top = el("div", "dtop");
    top.append(btn("pbtn ghost dback", "← Skills", home));
    const tt = el("div", "dtt"); tt.append(el("b", null, A.type === "fix" ? "Question " + (sk.kid + 1) : sk.name)); if (sk.std) tt.append(el("small", null, "Standard " + sk.std));
    const pr = el("div", "dprog"); pr.append(dots(Math.min(s.right, s.need), s.need), el("small", null, s.right + " of " + s.need + " right"));
    top.append(tt, pr); c.append(top);

    if (ST.ex) c.append(exampleBox(sk));
    if (s.mastered && !(ST.fb && ST.fb.kind === "right")) { c.append(el("p", "dall", "You've mastered this one."), btn("pbtn go", "Back to skills", home)); return c; }
    if (s.capped && !ST.fb) { c.append(el("p", "plead", "That's the most problems this skill gives. Move on to another skill, and ask your teacher about this one."), btn("pbtn go", "Back to skills", home)); return c; }

    // The open problem, or a fresh one.
    let i = s.cur ? s.cur.i : ST.fb ? ST.fb.i : C.nextProblem(sk, s, seed(), o.shuffle);
    const it = sk.pool[i]; if (!it) { c.append(el("p", "plead", "This skill has no problems.")); return c; }
    const tries = C.triesFor(it, o), used = s.cur ? s.cur.tries.length : 0;
    const qc = el("div", "dq"); qc.dataset.i = i; qc.append(el("p", "dqn", "Problem " + (s.served + (s.cur || ST.fb ? 0 : 1)))); qc.append(mathEl("p", "dqt", it.q)); c.append(qc);

    if (ST.fb && ST.fb.kind !== "again") {
        c.append(feedback(ST.fb, it));
        const after = stateOf(sk);
        const row = el("div", "prow");
        if (after.mastered) { row.append(btn("pbtn go", "Skill done! Back to skills", home)); burst(); }
        else row.append(btn("pbtn go", "Next problem", () => { ST.fb = null; ST.shownAt = Date.now(); draw(); }));
        c.append(row);
        setTimeout(() => { const b = c.querySelector(".prow .pbtn.go"); if (b) b.focus(); }, 0);
        return c;
    }
    if (ST.fb && ST.fb.kind === "again") c.append(feedback(ST.fb, it));
    box = answerBox(it.b || C.boxOf(it), it.ch && it.ch.length >= 2 ? it.ch : null);
    const f = el("form", "pform ans dform"); f.append(box.el);
    const go = btn("pbtn go", "Check"); go.type = "submit"; f.append(go);
    f.onsubmit = (e) => { e.preventDefault(); check(sk, i, it); };
    c.append(f);
    c.append(el("p", "pnote", tries > 1 ? (tries - used) + (tries - used === 1 ? " try left on this problem." : " tries on this problem.") : "One try on this problem."));
    const help = el("div", "dhelp");
    if (o.example) help.append(btn("pbtn ghost", ST.ex ? "Hide the example" : "See an example", () => { ST.ex = !ST.ex; draw(); }));
    if (o.stuck) help.append(btn("pbtn ghost", "Still stuck?", () => stuck(sk, i)));
    if (help.childNodes.length) c.append(help);
    c.append(errLine(), el("p", "pnote dsaved", ""));
    setTimeout(() => box && box.focus(), 0);
    return c;
}
function feedback(fb, it) {
    const f = el("div", "dfb " + fb.kind); f.setAttribute("role", "status");
    if (fb.kind === "right") { f.append(el("b", null, "Right!")); f.append(el("span", null, fb.fixed ? "You fixed it. That's how math gets learned." : "Nice work.")); return f; }
    if (fb.kind === "again") { f.append(el("b", null, "Not yet. Try again.")); if (fb.hint) f.append(el("span", null, fb.hint)); return f; }
    f.append(el("b", null, fb.kind === "stuck" ? "Here's how it's done" : "That one's done. Here's how it works."));
    const steps = it.st || [];
    if (steps.length) { const ol = el("ol", "dsteps"); steps.forEach((t) => ol.append(mathEl("li", null, t))); f.append(ol); }
    const a = el("p", "dans"); a.append("Answer: "); a.append(V.mathText(it.a)); f.append(a);
    f.append(el("span", null, "This one doesn't count. You'll get a new problem."));
    return f;
}
function exampleBox(sk) {
    const j = C.exampleFor(sk, seed(), optsOf().shuffle), it = sk.pool[j], b = el("div", "dex");
    if (!it) return b;
    b.append(el("b", "dexh", "Example"), mathEl("p", "dqt", it.q));
    const steps = it.st || []; if (steps.length) { const ol = el("ol", "dsteps"); steps.forEach((t) => ol.append(mathEl("li", null, t))); b.append(ol); }
    const a = el("p", "dans"); a.append("Answer: "); a.append(V.mathText(it.a)); b.append(a);
    return b;
}
function log(entry) { ST.me.lg = (ST.me.lg || []).concat([Object.assign({ at: Date.now() }, entry)]).slice(-C.MAX_LOG); }
function check(sk, i, it) {
    if (!box) return; const r = box.read(); if (r.err) { ST.err = r.err; draw(); return; }
    const y = String(r.t || "").trim(); if (!y) { ST.err = "Type an answer first."; draw(); return; }
    ST.err = ""; const t = Math.round((Date.now() - ST.shownAt) / 1000), ok = C.isRight(it, y);
    const before = stateOf(sk), had = before.cur ? before.cur.tries.length : 0;
    log({ k: sk.kid, i, y: y.slice(0, 80), o: ok ? 1 : 0, t: Math.min(900, t) });
    ST.shownAt = Date.now();
    const after = stateOf(sk);
    if (ok) ST.fb = { kind: "right", i, fixed: had > 0 };
    else if (after.cur) ST.fb = { kind: "again", i, hint: V.hintFor(y, it.a, it.q) };
    else ST.fb = { kind: "out", i };
    save(); draw();
}
function stuck(sk, i) {
    if (!confirm("See how this one is solved? This problem won't count, and you'll get a new one.")) return;
    log({ k: sk.kid, i, y: "", o: 3, t: Math.min(900, Math.round((Date.now() - ST.shownAt) / 1000)) });
    ST.fb = { kind: "stuck", i }; save(); draw();
}
function burst() {
    if (calm()) return;
    const c = el("div", "dburst"); c.setAttribute("aria-hidden", "true");
    for (let j = 0; j < 18; j++) { const s = el("i"); s.style.setProperty("--a", (j * 20) + "deg"); s.style.setProperty("--c", ["#F2B33D", "#7FAEDD", "#1F9D61"][j % 3]); c.append(s); }
    document.body.append(c); setTimeout(() => c.remove(), 900);
}

/* ---------- quizzes and tests ---------- */
function testCard() {
    const A = ST.A, c = card("wide"), n = A.skills.length, o = optsOf();
    const head = el("div", "dhead"), ht = el("div"); ht.append(el("p", "dkind", C.TYPES[A.type].label), el("h1", null, A.title)); const due = dueLine(); if (due) ht.append(due); head.append(ht); c.append(head);
    if (ST.me.done || A.status !== "open") return resultBody(c);
    const items = C.testItems(A.skills, seed()), order = C.testOrder(n, seed(), o.shuffle);
    if (ST.q >= n) ST.q = 0;
    const k = order[ST.q], sk = A.skills[k], it = sk.pool[items[k]], ans = ST.me.ans || {};
    const nav = el("div", "dnav"); nav.setAttribute("aria-label", "Questions");
    order.forEach((kk, j) => { const b = btn("dnq" + (j === ST.q ? " on" : "") + (ans[kk] && ans[kk].y ? " has" : ""), String(j + 1), () => { keep(k, items[k]); ST.q = j; draw(); }); b.setAttribute("aria-label", "Question " + (j + 1) + (ans[kk] && ans[kk].y ? ", answered" : "")); nav.append(b); });
    c.append(nav);
    const qc = el("div", "dq"); qc.dataset.k = k; qc.dataset.i = items[k]; qc.append(el("p", "dqn", "Question " + (ST.q + 1) + " of " + n + ((+sk.w || 1) !== 1 ? " · " + sk.w + " points" : ""))); if (it) qc.append(mathEl("p", "dqt", it.q)); c.append(qc);
    if (!it) return c;
    box = answerBox(it.b || "", it.ch && it.ch.length >= 2 ? it.ch : null);
    if (ans[k] && ans[k].y) box.fill(ans[k].y);
    const f = el("form", "pform ans dform"); f.append(box.el);
    const last = ST.q === n - 1, go = btn("pbtn go", last ? "Save" : "Save and next"); go.type = "submit"; f.append(go);
    f.onsubmit = (e) => { e.preventDefault(); if (keep(k, items[k], true)) { if (!last) ST.q++; draw(); } };
    c.append(f, el("p", "pnote dsaved", ST.saved === "saved" ? "Saved" : ""), errLine());
    const left = order.filter((kk) => !(ans[kk] && ans[kk].y)).length;
    const row = el("div", "prow dturn"); row.append(btn("pbtn ghost", "Turn in" + (left ? " (" + left + " blank)" : ""), () => turnIn(k, items[k]))); c.append(row);
    setTimeout(() => box && box.focus(), 0);
    return c;
}
/** Save what's in the box for question k (when it changed). */
function keep(k, i, loud) {
    if (!box) return true; const r = box.read();
    if (r.err) { if (loud) { ST.err = r.err; draw(); } return false; }
    const y = String(r.t || "").trim().slice(0, 80), cur = (ST.me.ans || {})[k];
    if ((cur && cur.y) === y || (!cur && !y)) return true;
    ST.me.ans = Object.assign({}, ST.me.ans, { [k]: { i, y, at: Date.now() } }); ST.err = ""; save(); return true;
}
function turnIn(k, i) {
    keep(k, i);
    const n = ST.A.skills.length, left = n - Object.values(ST.me.ans || {}).filter((a) => a && a.y).length;
    if (!confirm(left ? "You left " + left + (left === 1 ? " question" : " questions") + " blank. Turn it in anyway? You can't change it after." : "Turn it in? You can't change it after.")) return;
    ST.me.done = true; ST.me.sub = Date.now(); save().then(draw); draw();
}
function resultBody(c) {
    const A = ST.A, r = ST.res;
    if (!ST.me.done && A.status !== "open") c.append(el("p", "plead", "This " + C.TYPES[A.type].word + " is closed."));
    else c.append(el("p", "dall", "Turned in. Nice work."));
    if (!r) { c.append(el("p", "pnote", "Your teacher will share your results.")); return c; }
    const sc = el("div", "dscore"); sc.append(ring(r.of ? r.pts / r.of : 0, "Your score"), el("div", "dscoret")); sc.lastChild.append(el("b", null, r.pts + " of " + r.of), el("span", null, "points"));
    if (r.fix != null) sc.lastChild.append(el("span", "dfixline", "With corrections: " + C.pct(r.fix)));
    c.append(sc);
    if (Array.isArray(r.q) && r.q.length) {
        const ol = el("ol", "dres");
        r.q.forEach((x, j) => { const li = el("li", x.ok ? "ok" : "no"); li.append(el("b", null, x.ok ? "✓" : "✗"), mathEl("span", "dresq", x.q || "Question " + (j + 1))); const p = el("small"); p.append("You: "); p.append(V.mathText(x.y || "(blank)")); if (!x.ok && x.a) { p.append(" · Answer: "); p.append(V.mathText(x.a)); } li.append(p); ol.append(li); });
        c.append(ol);
    }
    return c;
}

/* ---------- start ---------- */
const qs = new URLSearchParams(location.search), qcode = qs.get("c") || qs.get("code") || "";
if (C.validCode(qcode)) open(qcode);
else { const last = local.get("code"); if (C.validCode(last)) { ST.code = last; } draw(); }
