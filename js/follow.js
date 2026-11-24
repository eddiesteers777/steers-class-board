/* ==========================================
   Focal — Live notes, the student page (follow.html, opened from /play or the class link).
   No account and no password: like Vault Raid, the page signs in as an anonymous guest on this
   device only (its own Firebase app, "play", so a teacher signed in here stays signed in).

   A student opens the class link (or types the code at /play), taps their name, and follows
   the notes card from the board. When the teacher starts a check-in, the problem shows here
   with a work pad and an answer box. The student sends their work, and can say "I'm stuck".
   The teacher's Remote checks the answers; this page never sees the answer key or anyone else.

   Send to students (2026-11-24, js/pushCore.js): a check-in can carry one of the board's math tools (a calculator,
   the graphing calculator, a manipulative). It opens here beside the problem and the work pad, as this student's own
   copy (nothing they do in it is sent), or on its own to explore. After a check-in the teacher can send a fresh try,
   or Show Steps (the board's worked example, js/stepPlayer.js), to only the students who didn't get it: the room
   says what is open, and this student's own s doc says whether it is for them (cin, st).
========================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { firebaseConfig } from "./firebaseConfig.js?v=1";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeFirestore, doc, onSnapshot, setDoc, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import * as V from "./vaultCore.js?v=75";
import { createStudentPad } from "./studentPad.js?v=1";
import * as PC from "./pushCore.js?v=5";

const app = initializeApp(firebaseConfig, "play");
// iPhone and iPad Safari can stall Firestore's streaming connection with no error (see js/play.js).
const appleTouch = /iPhone|iPad|iPod/.test(navigator.userAgent || "") || (/Macintosh/.test(navigator.userAgent || "") && navigator.maxTouchPoints > 1);
const auth = getAuth(app), db = initializeFirestore(app, appleTouch ? { experimentalForceLongPolling: true } : { experimentalAutoDetectLongPolling: true });
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
const store = {
    get: (k) => { try { return localStorage.getItem("focal-follow-" + k) || ""; } catch (e) { return ""; } },
    set: (k, v) => { try { localStorage.setItem("focal-follow-" + k, v); } catch (e) { /* ok */ } },
};

const ST = {
    uid: "", code: "", room: null, waiting: false, gone: false, me: null, hadMe: false,
    joining: false, err: "", busy: false, typed: "",
    sentQ: 0, editing: 0, help: false, seenFb: 0, padFor: 0, answer: "", seenSt: 0, tab: "tool",
};
let unsubRoom = null, unsubMe = null, sig = "";
const pad = createStudentPad();

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
        ST.err = /operation-not-allowed|admin-restricted/.test((e && e.code) || "") ? "Live notes aren't turned on for this site yet. Tell your teacher." : "Couldn't connect. Check the Wi-Fi and try again.";
        draw(); return;
    }
    stopAll();
    ST.code = code; ST.room = null; ST.me = null; ST.hadMe = false; ST.gone = false; ST.waiting = false;
    store.set("code", code);
    try { history.replaceState(null, "", "follow.html?code=" + code); } catch (e) { /* ok */ }
    unsubRoom = onSnapshot(doc(db, "rooms", code), (s) => {
        ST.busy = false;
        if (!s.exists()) {
            // The class link works every day: with no live notes open yet, wait here and join when the teacher starts.
            if (ST.hadMe || (ST.room && ST.me)) ST.gone = true;
            ST.room = null; ST.waiting = !ST.gone; draw(true); return;
        }
        const r = s.data();
        if (r.kind !== "notes") { location.replace("play.html?code=" + code); return; }
        if (ST.gone) { ST.gone = false; ST.me = null; ST.hadMe = false; }   // a new session on the same class link
        ST.room = r; ST.waiting = false; draw();
    }, () => { ST.busy = false; ST.err = "Couldn't open that code. Check it and try again."; ST.code = ""; stopAll(); draw(true); });
    unsubMe = onSnapshot(doc(db, "rooms", code, "s", ST.uid), (s) => {
        if (!s.exists()) {
            if (ST.hadMe) setTimeout(() => { if (ST.gone || !ST.hadMe || !ST.room) return; ST.me = null; ST.hadMe = false; ST.err = "Your teacher freed your name. Tap it again."; draw(true); }, 2500);
            return;
        }
        const d = s.data();
        if (d.err) { ST.err = d.err; ST.joining = false; ST.busy = false; draw(true); return; }
        ST.me = d; ST.hadMe = true; ST.joining = false; ST.busy = false; ST.err = "";
        ST.help = !!d.help;
        if (d.got && d.got.q === ST.sentQ) { ST.sentQ = 0; ST.editing = 0; }
        draw();
    }, () => {});
}
function stopAll() { if (unsubRoom) unsubRoom(); if (unsubMe) unsubMe(); unsubRoom = unsubMe = null; }
function send(data) {
    return setDoc(doc(db, "rooms", ST.code, "p", ST.uid), Object.assign({ at: Date.now() }, data), { merge: true }).then(() => true).catch((e) => {
        ST.busy = false; ST.sentQ = 0; ST.joining = false;
        ST.err = (e && e.code) === "permission-denied" ? "Live notes aren't taking work right now." : "That didn't send. Check the Wi-Fi and try again.";
        draw(true); return false;
    });
}

/* ---------- the page ---------- */
function bar() {
    const s = $("stats"), m = ST.me;
    if (!m || !m.nm || !ST.room) { s.hidden = true; return; }
    s.hidden = false; s.textContent = "";
    const chip = (label, val) => { const c = el("span", "pstat"); c.append(el("small", null, label), el("b", null, val)); s.append(c); };
    chip("Name", m.nm);
    const ci = mineCi(); chip("Now", ci ? (ci.ex ? PC.TOOL_NAMES[ci.tool] || "Tool" : "Check-in " + ci.n) : phase() === "steps" ? "Show Steps" : "Following along");
}
/** The open check-in, if it is for this student: one sent to only some students says so in their own s doc. */
function mineCi() {
    const r = ST.room, m = ST.me, ci = r && r.ci;
    if (!ci || !m) return null;
    return !ci.tg || m.cin === ci.n ? ci : null;
}
function phase() {
    const r = ST.room, m = ST.me;
    if (!ST.code) return "code";
    if (ST.gone) return "gone";
    if (ST.waiting) return "wait";
    if (!r) return "load";
    if (!m || !m.nm) return ST.joining ? "joining" : "name";
    const ci = mineCi();
    if (ci && ci.ex) return PC.isTool(ci.tool) ? "tool" : "follow";
    if (ci && (ST.editing === ci.n || !(m.got && m.got.q === ci.n))) return "ci";
    if (ci) return "sent";
    if (r.stp && m.st === r.stp.n && ST.seenSt !== r.stp.n) return "steps";
    if (m.fb && m.fb.q !== ST.seenFb) return "fb";
    return "follow";
}
function draw(force) {
    const r = ST.room, m = ST.me, ph = phase(), ci = mineCi();
    const k = JSON.stringify([ph, ST.err, ST.busy, ST.code, ST.help, ST.sentQ, ST.tab, r && [r.names && r.names.length, r.taken, r.now, ci, r.title, r.stp && r.stp.n], m && [m.nm, m.got, m.fb, m.cin, m.st]]);
    if (k === sig && !force) return;
    // Keep the pad and the typed answer while the same check-in stays on screen.
    const sameCi = !force && ph === "ci" && $("padhost") && +$("padhost").dataset.q === ci.n && ($("padhost").dataset.tool || "") === (ci.tool || "");
    sig = k; bar();
    if (sameCi) { const n = $("pnote"); if (n) n.textContent = ST.err; const h = $("helpBtn"); if (h) setHelp(h); const g = $("goBtn"); if (g) { g.disabled = ST.sentQ === ci.n; g.textContent = ST.sentQ === ci.n ? "Sending…" : "Submit"; } return; }
    document.body.classList.remove("qmode");
    const main = $("main"); main.textContent = "";
    const card = el("section", "pcard"); main.append(card);
    if (ph === "code") return codeStep(card);
    if (ph === "gone") { card.append(el("h1", null, "Live notes are over"), el("p", "plead", "Nice work today. You can close this tab.")); return; }
    if (ph === "wait") { card.classList.add("lnwait"); card.append(el("div", "lnpulse"), el("h1", null, "Waiting for your teacher"), el("p", "plead", "Keep this page open. You'll join as soon as live notes start."), el("p", "pnote", "Code " + ST.code), btn("pbtn ghost", "Use a different code", () => { stopAll(); ST.code = ""; ST.waiting = false; store.set("code", ""); draw(true); })); return; }
    if (ph === "load") { card.append(el("h1", null, "Connecting…"), el("p", "plead", "Hang on a second.")); note(card); return; }
    if (ph === "name" || ph === "joining") return nameStep(card, ph === "joining");
    if (ph === "ci") return checkView(card, ci);
    if (ph === "tool") return toolView(card, ci);
    if (ph === "steps") return stepsView(card, r.stp);
    if (ph === "sent") return sentView(card, ci);
    if (ph === "fb") return fbView(card);
    followView(card);
}
function note(card) { const n = el("p", "pnote err", ST.err); n.id = "pnote"; n.setAttribute("role", "alert"); card.append(n); }

function codeStep(card) {
    card.append(el("h1", null, "Live notes"), el("p", "plead", "Type the code on the board."));
    const f = el("form", "pform"), inp = el("input", "pcode");
    inp.inputMode = "numeric"; inp.autocomplete = "off"; inp.maxLength = 6; inp.placeholder = "000000"; inp.setAttribute("aria-label", "Code");
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 6); };
    const go = el("button", "pbtn go", ST.busy ? "Joining…" : "Join"); go.type = "submit"; go.disabled = ST.busy;
    f.onsubmit = (e) => { e.preventDefault(); const c = inp.value.trim(); if (!V.validRoomCode(c)) { ST.err = "Codes have 6 digits."; draw(true); return; } join(c); };
    f.append(inp, go); card.append(f); note(card); setTimeout(() => inp.focus(), 0);
}
function pickName(p) {
    if (ST.joining) return;
    ST.joining = true; ST.err = ""; store.set("name-" + ST.code, JSON.stringify(p)); draw(true);
    send(p.ni != null ? { ni: p.ni } : { nm: p.nm });
    setTimeout(() => { if (ST.joining && !(ST.me && ST.me.nm)) { ST.joining = false; ST.err = "Your teacher's Remote didn't answer. Try again, or tell your teacher."; draw(true); } }, 12000);
}
function nameStep(card, joining) {
    const r = ST.room || {};
    card.classList.add("wide", "lnname");
    card.append(el("p", "lnkicker", "Live notes" + (r.per ? " · " + r.per + " period" : "")), el("h1", null, r.title || "Today's notes"));
    if (joining) { card.append(el("p", "plead", "Joining…")); note(card); return; }
    let saved = null; try { saved = JSON.parse(store.get("name-" + ST.code) || "null"); } catch (e) { saved = null; }
    if (r.mode === "roster") {
        const taken = new Set(r.taken || []);
        if (saved && saved.ni != null && r.names && r.names[saved.ni] === saved.nm && !taken.has(saved.ni)) {
            const me = btn("pbtn go lnme", "I'm " + saved.nm, () => pickName({ ni: saved.ni, nm: saved.nm }));
            card.append(me, el("p", "pnote", "Not you? Tap your name below."));
        } else card.append(el("p", "plead", "Tap your name."));
        const list = el("div", "pnames");
        (r.names || []).forEach((n, i) => { const b = btn("pname", n, () => pickName({ ni: i, nm: n })); if (taken.has(i)) { b.disabled = true; b.title = "Already in"; } list.append(b); });
        card.append(list, el("p", "pnote", "Is your name greyed out or missing? Tell your teacher."));
    } else {
        card.append(el("p", "plead", "Type your first name and last initial."));
        const f = el("form", "pform"), inp = el("input", "ptext"); inp.maxLength = 20; inp.autocomplete = "off"; inp.placeholder = "Ava R."; inp.setAttribute("aria-label", "Your first name and last initial"); inp.value = ST.typed || (saved && saved.nm) || "";
        const go = el("button", "pbtn go", "Join"); go.type = "submit";
        f.onsubmit = (e) => { e.preventDefault(); const n = V.cleanTyped(inp.value); ST.typed = inp.value; if (!n) { ST.err = "Type your first name and last initial."; draw(true); return; } pickName({ nm: n }); };
        f.append(inp, go); card.append(f); setTimeout(() => inp.focus(), 0);
    }
    note(card);
}
function followView(card) {
    const r = ST.room, now = r.now;
    card.classList.add("wide", "lnfollow");
    card.append(el("p", "lnkicker", r.title || "Live notes"));
    if (now && now.q) {
        const box = el("div", "lncard");
        box.append(el("p", "lnkind", now.k || ""), mathEl("p", "lnq", now.q));
        if (now.l && now.l.length) { const ol = el("div", "lnlines"); now.l.forEach((t, i) => { const row = mathEl("p", "lnline" + (i === now.l.length - 1 ? " new" : ""), t); ol.append(row); }); box.append(ol); }
        if (now.a) box.append(mathEl("p", "lnans", "Answer: " + now.a));
        card.append(box);
    } else card.append(el("h1", null, "You're in, " + ST.me.nm + "!"));
    card.append(el("p", "plead", "Write it on your paper notes. When your teacher starts a check-in, it pops up here."));
    note(card);
}
function setHelp(b) { b.classList.toggle("on", ST.help); b.setAttribute("aria-pressed", String(ST.help)); b.textContent = ST.help ? "✋ Your teacher knows you're stuck" : "✋ I'm stuck"; }
function toggleHelp() { ST.help = !ST.help; send({ k: { n: Date.now(), to: "help", g: ST.help ? "1" : "0" } }); const h = $("helpBtn"); if (h) setHelp(h); }
function checkView(card, ci) {
    if (ST.padFor !== ci.n) { pad.clear(); ST.padFor = ci.n; ST.answer = ""; ST.help = false; }
    card.classList.add("qview"); document.body.classList.add("qmode");
    const qc = el("div", "pqcard"), left = el("div", "pqleft"), top = el("div", "pqtop");
    top.append(el("span", "pchip lnchip", "Check-in " + ci.n));
    const hb = btn("pbtn ghost lnhelp", "", toggleHelp); hb.id = "helpBtn"; setHelp(hb); top.append(hb);
    left.append(top, mathEl("p", "pq", ci.q));
    const right = el("div", "pqright");
    const f = el("form", "pform ans"), inp = el("input", "ptext"); inp.maxLength = 80; inp.autocomplete = "off"; inp.placeholder = "Your answer"; inp.setAttribute("aria-label", "Your answer"); inp.value = ST.answer;
    inp.oninput = () => { ST.answer = inp.value; };
    const go = el("button", "pbtn go", ST.sentQ === ci.n ? "Sending…" : "Submit"); go.type = "submit"; go.id = "goBtn"; go.disabled = ST.sentQ === ci.n;
    f.onsubmit = (e) => {
        e.preventDefault(); const t = inp.value.trim(), say = (msg) => { ST.err = msg; const n = $("pnote"); if (n) n.textContent = msg; };
        if (ci.work && !pad.shown()) { say("Show your work on the pad first, then submit."); return; }
        if (!t && !pad.shown()) { say("Type your answer or show your work first."); return; }
        if (ST.sentQ === ci.n) return;
        ST.sentQ = ci.n; ST.err = ""; go.disabled = true; go.textContent = "Sending…";
        const img = pad.image(); pad.sent(); send({ a: { n: Date.now(), q: ci.n, t: t.slice(0, 80) }, img, iq: ci.n, it: Date.now() });
        setTimeout(() => { if (ST.sentQ === ci.n) { ST.sentQ = 0; ST.err = "Your teacher's Remote didn't answer. Try Submit again, or tell your teacher."; draw(true); } }, 10000);
    };
    f.append(inp, go); right.append(f); note(right);
    qc.append(left, right); card.append(qc);
    const host = el("div", "wbpaper ppaper"); host.id = "padhost"; host.dataset.q = String(ci.n); host.dataset.tool = ci.tool || "";
    host.append(el("p", "ptag", ci.work ? "Show your work here (needed to submit)" : "Show your work here"));
    if (PC.isTool(ci.tool)) {
        // The tool beside the work pad; on a narrow screen, one at a time with a switch.
        const duo = el("div", "lnduo tab-" + ST.tab), tabs = el("div", "lntabs"); tabs.setAttribute("role", "tablist");
        [["tool", PC.TOOL_NAMES[ci.tool]], ["pad", "Work pad"]].forEach(([v, t]) => { const b = btn("lntab" + (ST.tab === v ? " on" : ""), t, () => { ST.tab = v; duo.className = "lnduo tab-" + v; tabs.querySelectorAll(".lntab").forEach((x) => x.classList.toggle("on", x === b)); }); b.setAttribute("role", "tab"); tabs.append(b); });
        const tb = el("div", "lntoolhost"); mountTool(tb, ci.tool, ci.ts, "c" + ci.n + ci.tool);
        duo.append(tb, host); card.append(tabs, duo); pad.mount(host); return;
    }
    card.append(host); pad.mount(host);
}
/* ---------- a math tool from the board, this student's own copy ---------- */
let manip = null, TOOL = null;
function cssOnce(href) { if (document.querySelector('link[href="' + href + '"]')) return; const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.append(l); }
function loadManip() {
    if (!manip) { cssOnce("css/manip.css?v=14"); manip = import("./manipPanels.js?v=14").catch((e) => { manip = null; throw e; }); }
    return manip;
}
/** Put tool k in host. The same check-in keeps the same tool (so a half-typed calculation survives a redraw). */
function mountTool(host, k, ts, key) {
    if (TOOL && TOOL.key === key) { host.append(TOOL.box); return; }
    const box = el("section", "card tool panel tool-mt lntoolcard tool-" + k); box.setAttribute("aria-label", PC.TOOL_NAMES[k]);
    const h = el("h3", null, PC.TOOL_NAMES[k]), inn = el("div", "in"); inn.append(el("p", "lntoolwait", "Opening…")); box.append(h, inn);
    TOOL = { key, box }; host.append(box);
    loadManip().then((m) => {
        if (!TOOL || TOOL.key !== key) return;
        const api = { S: { tools: { mt: {} } }, push: () => { m.mtBody(api, k); } };
        const start = PC.readStart(k, ts); if (start) api.S.tools.mt[k] = start;
        inn.textContent = ""; inn.append(m.mtBody(api, k));
    }, () => { inn.textContent = ""; inn.append(el("p", "lntoolwait", "The " + PC.TOOL_NAMES[k].toLowerCase() + " didn't load. Check the Wi-Fi.")); });
}
/** A tool sent on its own: explore it. Nothing to submit; the teacher doesn't see what is done in it. */
function toolView(card, ci) {
    card.classList.add("wide", "lnexplorev");
    const top = el("div", "lnexhead");
    top.append(el("p", "lnkicker", "From your teacher"), el("h1", null, PC.TOOL_NAMES[ci.tool]), el("p", "plead", "Your own copy. Try it out, and keep your paper notes going."));
    card.append(top);
    const tb = el("div", "lntoolhost big"); mountTool(tb, ci.tool, ci.ts, "x" + ci.n + ci.tool); card.append(tb);
    note(card);
}
/* ---------- Show Steps from the teacher, after a check-in ---------- */
let stepMods = null, stepPlayerNow = null;
function stepsView(card, stp) {
    const m = ST.me, fb = m.fb && m.fb.q === stp.n ? m.fb : null;
    card.classList.add("wide", "lnsteps");
    card.append(el("p", "lnkicker", "Show Steps · Check-in " + stp.n), mathEl("p", "lnq", stp.q));
    if (fb && fb.ok === false) card.append(el("p", "plead", "You wrote " + (fb.y || "no answer") + ". Watch each step, then fix it on your paper."));
    else if (fb && fb.ok === true) card.append(el("p", "plead", "You got it. Watch the steps to check your work."));
    if (stepPlayerNow) { try { stepPlayerNow.destroy(); } catch (e) { /* gone */ } stepPlayerNow = null; }
    if (stp.w && stp.w.ok) {
        const host = el("div", "lnstephost"); host.append(el("p", "lntoolwait", "Opening…")); card.append(host);
        cssOnce("css/steps.css?v=5");
        if (!stepMods) stepMods = import("./stepPlayer.js?v=6");
        stepMods.then((sp) => { if (!host.isConnected) return; host.textContent = ""; stepPlayerNow = sp.createStepPlayer(host, stp.w, {}); }, () => { host.textContent = "Show Steps didn't load. Check the Wi-Fi."; });
    } else if (stp.h && stp.h.length) {
        const ol = el("ol", "lnhints"); card.append(ol);
        let shown = 0;
        const more = btn("pbtn ghost", "Next step", () => { if (shown < stp.h.length) { const li = el("li"); li.append(V.mathText(stp.h[shown])); ol.append(li); shown++; } more.disabled = shown >= stp.h.length; more.textContent = shown >= stp.h.length ? "That's every step" : "Next step"; });
        card.append(more); more.click();
    }
    card.append(btn("pbtn go", "Back to the notes", () => { ST.seenSt = stp.n; ST.seenFb = stp.n; if (stepPlayerNow) { try { stepPlayerNow.destroy(); } catch (e) { /* gone */ } stepPlayerNow = null; } draw(true); }));
}
function sentView(card, ci) {
    const m = ST.me, fb = m.fb && m.fb.q === ci.n ? m.fb : null;
    card.classList.add(fb ? (fb.ok === true ? "good" : fb.ok === false ? "miss" : "sentok") : "sentok");
    if (fb && fb.ok === true) card.append(el("h1", null, "Right!"), el("p", "plead", "You got it. Nice work."));
    else if (fb && fb.ok === false) { card.append(el("h1", null, "Not quite yet")); if (fb.a) { const a = el("div", "pansbox"); a.append(el("small", null, "The answer is"), mathEl("p", null, fb.a)); card.append(a); } card.append(el("p", "plead", "Look back at your work and find the step to fix.")); }
    else card.append(el("div", "lncheck", "✓"), el("h1", null, "Sent!"), el("p", "plead", "Your teacher has your work." + (m.got && m.got.y ? " You answered " + m.got.y + "." : "")));
    const row = el("div", "prow");
    row.append(btn("pbtn ghost", "Change my answer", () => { ST.editing = ci.n; draw(true); }));
    card.append(row);
    if (!fb) card.append(el("p", "pnote", "Wait for your teacher. Your result shows here when the check-in closes."));
    note(card);
}
function fbView(card) {
    const f = ST.me.fb;
    card.classList.add(f.ok === true ? "good" : f.ok === false ? "miss" : "sentok");
    if (f.ok === true) card.append(el("h1", null, "Check-in " + f.q + ": Right!"), el("p", "plead", "You got it" + (f.y ? " (" + f.y + ")" : "") + ". Nice work."));
    else if (f.ok === false) { card.append(el("h1", null, "Check-in " + f.q + ": not quite yet")); if (f.a) { const a = el("div", "pansbox"); a.append(el("small", null, "The answer is"), mathEl("p", null, f.a)); card.append(a); } card.append(el("p", "plead", "You wrote " + (f.y || "no answer") + ". Fix it on your paper notes.")); }
    else card.append(el("h1", null, "Check-in " + f.q + " is closed"), el("p", "plead", "Your teacher has your work."));
    card.append(btn("pbtn go", "Back to the notes", () => { ST.seenFb = f.q; draw(true); }));
}

/* ---------- start ---------- */
{
    const q = new URLSearchParams(location.search).get("code"), last = store.get("code");
    draw();
    if (q && V.validRoomCode(q)) join(q);
    else if (last && V.validRoomCode(last)) join(last);
}
