/* ==========================================
   Calera Math — the board app.
   board.html runs it with mode "board" (the Promethean: controls hidden),
   remote.html with mode "remote" (the Chromebook: controls shown).
   Both read and write the same state document, so whatever one device
   changes, the other follows. Lesson content comes from data/weeks.js.
========================================== */
import { WEEKS as ALL_WEEKS } from "../data/weeks.js?v=57";
// The public demo page passes its own sample week and periods (opts.weeks, opts.periods).
let WEEKS = ALL_WEEKS;
let store = null; // the signed-in Firestore store, or a this-device-only store for the sub page
import { trail } from "./signInTrail.js";
import { buildWidget, tickTools, defaultTools, mergeTools, TOOL_LIST } from "./boardTools.js?v=57";
import * as snd from "./sound.js?v=57";
import { createMathPad } from "./mathPad.js?v=1";
import { mountGames, syncGames, gameSig, drawStage as drawGame, drawPanel as drawGamePanel, tickGames, gameFlow, gameFlowLabel } from "./games.js?v=57";
import { mountLive, syncLive, liveSig, drawLiveStage, drawLivePanel, tickLive } from "./liveRoom.js?v=58";

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

/* Text with stacked fractions: "{2/5}" -> 2 over 5, "{{1/2}/{1/4}}" nests. */
function rich(text) {
    const s = String(text == null ? "" : text); let i = 0;
    function parse(stop) {
        const frag = document.createDocumentFragment(); let buf = "";
        const flush = () => { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ""; } };
        while (i < s.length) {
            const ch = s[i];
            if (stop && stop.includes(ch)) break;
            if (ch === "{") {
                const save = i; i++;
                const num = parse("/}");
                if (s[i] === "/") {
                    i++; const den = parse("}");
                    if (s[i] === "}") {
                        i++; flush();
                        const f = el("span", "frac"), a = el("span"), b = el("span");
                        a.appendChild(num); b.appendChild(den); f.appendChild(a); f.appendChild(b); frag.appendChild(f);
                        continue;
                    }
                }
                i = save + 1; buf += "{"; continue;
            }
            buf += ch; i++;
        }
        flush(); return frag;
    }
    return parse("");
}
function richEl(tag, cls, text) { const e = el(tag, cls); e.appendChild(rich(text)); return e; }

const SCREENS = [["agenda", "Weekly Agenda"], ["today", "Today"], ["bell", "Bellringer"], ["notes", "Guided Notes"], ["speed", "Speed Dating"], ["fix", "Fix It"], ["game", "Review Game"], ["live", "Student Game"], ["timer", "Timer"], ["tools", "Tools"], ["blank", "Whiteboard"]];
const DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
// Each period and the class plan it follows.
let PERIODS = [["1st", "8th"], ["2nd", "8th"], ["4th", "8th"], ["5th", "7th"], ["6th", "8th-acc"]];
const classOf = (period) => (PERIODS.find((p) => p[0] === period) || PERIODS[0])[1];
const ROUND = 240, GAP = 10, CHECK = 600;   // speed dating: 4:00 rounds, 10 s to rotate; 10:00 to go over the master problems
const PRESETS = [1, 2, 3, 5, 10, 15];
let skew = 0; // this device's clock vs the shared clock, in ms
const now = () => Date.now() + skew;
const blankTimer = () => ({ running: false, t0: 0, elapsed: 0 });

const localIso = () => { const d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
const isSchoolDay = () => { const n = new Date().getDay(); return n >= 1 && n <= 5; };
const realDay = () => (isSchoolDay() ? new Date().getDay() - 1 : 0);   // today's weekday, 0 = Monday
const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
let synced = false;   // false until the saved board state has arrived, so the wrong day is never drawn first
function defaultWeek() {
    const today = localIso();
    let pick = WEEKS[0];
    for (const w of WEEKS) if (!w.monday || w.monday <= today) pick = w;
    return pick.id;
}
const wd = new Date().getDay();
const S = { week: defaultWeek(), period: "1st", cls: "8th", day: (wd >= 1 && wd <= 5) ? wd - 1 : 0, screen: "today", prob: 0, show: false, note: 0, step: 0,
    timers: { bell: blankTimer(), round: blankTimer(), check: blankTimer(), free: Object.assign(blankTimer(), { dur: 300 }) }, speedMode: "round", fix: null, tools: defaultTools(),
    sound: { fx: true, fxv: 0.7, music: false, mv: 0.35, style: "focus", at: "" } };

// This page's own mark on what it saves, so a change from another tab of the same browser can be shown
// before the server confirms it (those tabs share one offline copy, where it first arrives as "pending").
const PAGE = Math.random().toString(36).slice(2, 10);
let saveFailedAt = 0;
// Board and Remote open in the same browser hear each other's changes at once through this channel,
// without waiting for the server. Firestore still saves every change for reloads and other devices.
let tabs = null, heard = { by: "", at: 0 };   // a failed save stays on screen a few seconds, even when the connection itself is fine
let mode = "remote", signedIn = false, sig = "", writeState = null, SEAL = "brand/logo.svg";

function writer(path) {
    let busy = false, next = null;
    const w = function (d) {
        d.by = PAGE; d.at = Date.now();
        if (path === "board/state" && tabs) { try { tabs.postMessage(d); } catch (e) { /* the server copy still gets there */ } }
        next = d; if (busy) return; busy = true;
        (async function () {
            while (next) { const x = next; next = null; try { await store.save(path, x); } catch (e) { saveFailedAt = Date.now(); setStatus("Could not save (" + ((e && e.code) || "connection") + "). The board did not change."); } }
            busy = false;
        })();
    };
    w.busy = () => busy || !!next;
    return w;
}
function setStatus(t) {
    const st = (t === "Live" || t === "This device only") ? "ok" : (t.startsWith("Connecting") || t.startsWith("Still") ? "wait" : "bad");
    const s = $("status"); if (s) { s.textContent = t; s.dataset.state = st; }
    // The board view hides the header, so a lost connection shows as a small pill in the corner instead.
    const pill = $("connPill"); if (pill) { pill.hidden = st === "ok" || !synced; pill.textContent = st === "bad" ? "Not connected. Reconnecting\u2026" : "Connecting\u2026"; }
}
function push() { S.stamp = localIso(); render(); if (writeState) writeState(JSON.parse(JSON.stringify(S))); }
let quietTimer = 0;
function quiet() { clearTimeout(quietTimer); quietTimer = setTimeout(() => { if (writeState) writeState(JSON.parse(JSON.stringify(S))); }, 500); } // save typing without redrawing
let ROSTERS = {};
const toolApi = { S, el, push, quiet, now, card, rosters: () => ROSTERS, redraw: () => { layerSig = ""; renderLayer(); } };
function toolSig() { const t = Object.assign({}, S.tools); delete t.text; t.goal = Object.assign({}, t.goal); delete t.goal.text; return JSON.stringify([t, S.period, Object.keys(ROSTERS).map((k) => k + ROSTERS[k].length)]); }
function resetPos() { S.prob = 0; S.show = false; S.note = 0; S.step = 0; }
const W = () => WEEKS.find((w) => w.id === S.week) || WEEKS[WEEKS.length - 1];
const L = () => { const w = W(); return (w && w.classes[S.cls]) || null; };
const D = () => { const l = L(); return (l && l.days && l.days[S.day]) || null; };

/* ---------- controls ---------- */
function seg(host, items, current, onPick) {
    host.textContent = "";
    items.forEach(([id, label]) => {
        const b = el("button", null, label); b.type = "button";
        b.setAttribute("aria-pressed", String(id === current));
        b.onclick = () => onPick(id); host.appendChild(b);
    });
}
function buildControls() {
    const w = W();
    const ps = $("periodSel"); ps.textContent = "";
    PERIODS.filter((p) => w.classes[p[1]]).forEach((p) => { const o = el("option", null, p[0] + " period, " + w.classes[p[1]].label); o.value = p[0]; ps.appendChild(o); });
    ps.value = S.period;
    seg($("days"), DK.map((k, i) => [i, k]), S.day, (i) => { S.day = i; resetPos(); push(); });
    {   // Mark the real day, and say so plainly whenever the board is showing a different one.
        const rd = realDay(), thisWeek = S.week === defaultWeek(), btn = $("days").children[rd];
        if (isSchoolDay() && thisWeek && btn) btn.classList.add("istoday");
        let nt = $("notToday"); if (!nt) { nt = el("div", "nottoday"); nt.id = "notToday"; nt.setAttribute("role", "status"); $("days").after(nt); }
        nt.hidden = !isSchoolDay() || (thisWeek && S.day === rd); nt.textContent = "";
        if (!nt.hidden) {
            nt.appendChild(el("span", null, "Showing " + (thisWeek ? "" : W().label + ", ") + FULL[S.day] + ". Today is " + FULL[rd] + "."));
            const b = el("button", null, "Go to today"); b.type = "button"; b.onclick = () => { S.week = defaultWeek(); S.day = rd; resetPos(); push(); }; nt.appendChild(b);
        }
    }
    seg($("screens"), SCREENS.filter((x) => mode !== "sub" || (x[0] !== "game" && x[0] !== "live")), S.screen, (id) => { S.screen = id; S.show = false; push(); });
    const sel = $("weekSel"); sel.textContent = "";
    WEEKS.forEach((x) => { const o = el("option", null, x.label + " · " + x.dates); o.value = x.id; sel.appendChild(o); });
    sel.value = w.id; $("weekField").hidden = WEEKS.length < 2;
    const fn = $("flowNext"); if (fn) { fn.textContent = stepLabel(); fn.disabled = fn.textContent === "Next" && !nextScreen(1); $("flowBack").disabled = S.screen === screenOrder()[0]; }
    const bn = $("bnNext"), bb = $("bnBack");
    if (bn) { const nl = stepLabel(), bl = backLabel(); bn.title = nl; bn.setAttribute("aria-label", nl); bn.disabled = $("flowNext").disabled; bb.title = bl; bb.setAttribute("aria-label", bl); bb.disabled = $("flowBack").disabled; }
    const files = $("files"), l = L();
    if (files) {
        files.textContent = "";
        const links = (l && l.links) || [];
        $("filesMenu").hidden = !links.length;
        if (links.length) {
            links.forEach((k) => { const a = el("a", null, k.t); a.href = k.u; a.target = "_blank"; a.rel = "noopener"; files.appendChild(a); });
        }
    }
}

/* ---------- stage ---------- */
/* Tools sit on a shelf beside the lesson, so they never cover it. The stage gets a little
   smaller to make room. A tool the teacher drags out floats over the lesson by choice. */
const SHELF_EM = 14.5, SHELF_WIDE_EM = 22.5;
const narrowWrap = () => { const w = $("wrap"); return !w || w.clientWidth - 16 < 700; };
function shelfKeys() { return narrowWrap() ? [] : TOOL_LIST.map((x) => x[0]).filter((k) => S.tools.on[k] && !S.tools.pos[k] && k !== "groups"); }
function shelfEm() { const ks = shelfKeys(); return !ks.length ? 0 : (ks.includes("score") ? SHELF_WIDE_EM : SHELF_EM); }
function shelfEl() { let sh = $("toolShelf"); if (!sh) { sh = el("div", "toolshelf"); sh.id = "toolShelf"; sh.hidden = true; $("wrap").appendChild(sh); } return sh; }
let shelfApplied = "";
function fit() {
    const w = $("wrap"), st = $("stage"), Wd = w.clientWidth - 16, H = w.clientHeight - 16;
    if (Wd < 50 || H < 50) return;
    const se = synced ? shelfEm() : 0;
    let sw = Math.min(Wd / (1 + se / 52), H * 16 / 9), sh = sw * 9 / 16;
    if (Wd < 700) { sw = Wd; sh = Math.max(440, Math.round(window.innerHeight * 0.82)); }   // not the wrap's height: on a phone the wrap grows with the stage, and the stage kept growing
    st.style.width = sw + "px"; st.style.height = sh + "px"; st.style.fontSize = Math.max(9, sw / 52) + "px";
    { const shelf = shelfEl(), f = Math.max(9, sw / 52); shelf.hidden = !se; shelf.style.fontSize = f + "px"; shelf.style.width = ((se - 0.6) * f) + "px"; shelf.style.maxHeight = sh + "px"; } fitShelf();
    { const key = se + "|" + narrowWrap(); if (key !== shelfApplied) { shelfApplied = key; layerSig = ""; setTimeout(renderLayer, 0); } }
    sizeCanvas();
}

function header(title, sub) {
    const l = L(), h = el("div", "hdr"), im = el("img"); im.src = SEAL; im.alt = ""; h.appendChild(im);
    const t = el("div", "ttl"); t.appendChild(el("h1", null, title)); t.appendChild(el("p", null, sub || "")); h.appendChild(t);
    h.appendChild(el("p", "cls", (l && l.cls) || "")); return h;
}
function card(title, cls) { const c = el("div", "card" + (cls ? " " + cls : "")); c.appendChild(el("h3", null, title)); const i = el("div", "in"); c.appendChild(i); return { c, i }; }
function lines(parent, arr, cls) { (arr || []).forEach((t) => parent.appendChild(richEl("p", cls, t))); }
function ltBox(text) { const b = el("div", "lt"); b.appendChild(el("p", "chip", "Learning Target")); b.appendChild(richEl("p", "ltt", text || "")); return b; }
function weekCard() { const k = card("This Week", "wk"), l = L(); (l.days || []).forEach((d, i) => k.i.appendChild(el("p", "wl" + (i === S.day ? " now" : ""), DK[i] + ": " + (d.short || "")))); return k.c; }

function timerParts(kind, host) {
    const c = el("p", "clock"); c.id = "clock";
    const bar = el("div", "bar"); bar.id = "tbar"; bar.appendChild(el("i"));
    const tb = el("div", "tbtns"), go = el("button", null, "Start"), rs = el("button", "alt", "Reset"); go.id = "tgo"; go.type = rs.type = "button";
    go.onclick = () => {
        const t = S.timers[kind];
        if (t.running) { t.elapsed = now() - t.t0; t.running = false; }
        else { if (kind !== "round" && t.elapsed >= secsFor(kind) * 1000) t.elapsed = 0; t.t0 = now() - t.elapsed; t.running = true; unlockSound(); }
        push();
    };
    rs.onclick = () => { S.timers[kind] = Object.assign(blankTimer(), kind === "free" ? { dur: S.timers.free.dur || 300 } : {}); push(); };
    tb.appendChild(go); tb.appendChild(rs);
    host.appendChild(c);
    if (kind === "round" || kind === "check") { const r = el("p", "round"); r.id = "round"; if (kind === "check") r.textContent = "Go over each master problem"; host.appendChild(r); }
    host.appendChild(bar); host.appendChild(tb);
    host.dataset.kind = kind; host.id = "tcard";
}
function timerCard(kind, title) { const k = card(title); k.i.classList.add("timer"); timerParts(kind, k.i); return k.c; }
/* Speed dating timer: rounds (4:00, then 10 s to rotate) or a 10:00 check of the master problems. */
function speedTimer() {
    const m = S.speedMode === "check" ? "check" : "round", k = card("Timer");
    k.c.classList.add("stimer"); k.i.classList.add("timer");
    const sw = el("div", "tmode"); sw.setAttribute("role", "group"); sw.setAttribute("aria-label", "Timer");
    [["round", "Rounds 4:00"], ["check", "Check 10:00"]].forEach(([v, label]) => {
        const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", String(m === v));
        b.onclick = () => { if (S.speedMode === v) return; const t = S.timers[S.speedMode === "check" ? "check" : "round"]; if (t.running) { t.elapsed = now() - t.t0; t.running = false; } S.speedMode = v; push(); };
        sw.appendChild(b);
    });
    k.c.firstChild.appendChild(sw); timerParts(m, k.i);
    const fx = el("button", "alt tfix", "Set time"); fx.type = "button"; fx.title = "Pick the round and the time left";
    fx.onclick = () => { speedFix = speedNow(); sig = ""; render(); };
    k.i.querySelector(".tbtns").appendChild(fx);
    if (speedFix) k.c.appendChild(speedFixPanel(m));
    return k.c;
}
/* Set time (Remote only): put the speed dating timer back where it was after an accidental Reset.
   The fix lives on this device until Save, so the board keeps counting while the teacher types. */
let speedFix = null;
function speedNow() {
    const m = S.speedMode === "check" ? "check" : "round", t = S.timers[m], e = Math.max(0, Math.floor((t.running ? now() - t.t0 : t.elapsed) / 1000));
    if (m === "check") return { n: 1, left: Math.max(0, CHECK - e) };
    const x = e % (ROUND + GAP), n = Math.floor(e / (ROUND + GAP)) + 1;
    return x < ROUND ? { n, left: ROUND - x } : { n: n + 1, left: ROUND };   // during the rotate gap, offer the next round
}
function speedFixPanel(m) {
    const max = m === "check" ? CHECK : ROUND, f = speedFix, p = el("div", "sfix");
    p.setAttribute("role", "group"); p.setAttribute("aria-label", "Set the speed dating timer");
    const stepper = (label, get, set, show) => {
        const r = el("div", "sfrow"); r.appendChild(el("span", "sflab", label));
        const minus = el("button", "sfstep", "\u2212"), val = el("span", "sfval", show()), plus = el("button", "sfstep", "+");
        minus.type = plus.type = "button"; minus.setAttribute("aria-label", label + " down"); plus.setAttribute("aria-label", label + " up");
        minus.onclick = () => { set(get() - 1); val.textContent = show(); }; plus.onclick = () => { set(get() + 1); val.textContent = show(); };
        r.appendChild(minus); r.appendChild(val); r.appendChild(plus); return r;
    };
    if (m === "round") p.appendChild(stepper("Round", () => f.n, (v) => { f.n = Math.max(1, Math.min(40, v)); }, () => String(f.n)));
    p.appendChild(stepper("Minutes", () => Math.floor(f.left / 60), (v) => { f.left = Math.max(0, Math.min(max, Math.max(0, Math.min(Math.floor(max / 60), v)) * 60 + f.left % 60)); }, () => String(Math.floor(f.left / 60))));
    p.appendChild(stepper("Seconds", () => f.left % 60, (v) => { const mm = Math.floor(f.left / 60), ss = ((v % 60) + 60) % 60; f.left = Math.max(0, Math.min(max, mm * 60 + ss)); }, () => ("0" + (f.left % 60)).slice(-2)));
    const b = el("div", "sfbtns"), ok = el("button", null, "Save"), no = el("button", "alt", "Cancel"); ok.type = no.type = "button";
    ok.onclick = () => {
        const t = S.timers[m], left = Math.max(m === "round" ? 1 : 0, Math.min(max, f.left));
        t.elapsed = (m === "round" ? (f.n - 1) * (ROUND + GAP) + (ROUND - left) : CHECK - left) * 1000;
        if (t.running) t.t0 = now() - t.elapsed;
        speedFix = null; sig = ""; push();
    };
    no.onclick = () => { speedFix = null; sig = ""; render(); };
    b.appendChild(ok); b.appendChild(no); p.appendChild(b); return p;
}
function secsFor(kind) { if (kind === "check") return CHECK; if (kind === "free") return S.timers.free.dur || 300; const l = L(); return (l && l.bellSeconds) || 300; }
const fmt = (r) => Math.floor(r / 60) + ":" + ("0" + (r % 60)).slice(-2);

const unlockSound = () => snd.unlock();
/* ---------- sound ----------
   One screen plays the sound: the board, unless the Remote picked "This device".
   Settings are shared, so the Remote turns music on and the board plays it. */
const DEVICE = (() => { try { let id = localStorage.getItem("focal-device-id"); if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem("focal-device-id", id); } return id; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
function playsHere() { return mode === "sub" || (S.sound.at ? S.sound.at === DEVICE : document.body.classList.contains("board")); }
function soundSync() { snd.set(S.sound, playsHere()); soundControls(); }
/* Every timer, every quarter second, whatever screen is showing. */
function soundTick() {
    const sec = (t) => Math.max(0, Math.floor((t.running ? now() - t.t0 : t.elapsed) / 1000));
    ["bell", "free", "check"].forEach((k) => { const t = S.timers[k]; snd.watchTimer({ kind: k, running: t.running, secs: sec(t), total: secsFor(k) }); });
    const r = S.timers.round; snd.watchTimer({ kind: "round", running: r.running, secs: sec(r), round: { len: ROUND, gap: GAP } });
}
function soundPanel() {
    const rail = document.querySelector(".rail"); if (!rail || $("soundMenu")) return;
    const box = el("details", "menu fold"); box.id = "soundMenu"; box.open = window.innerWidth > 860;
    const sum = el("summary", null, "Sound "); const cnt = el("span", "count"); cnt.id = "soundCount"; sum.appendChild(cnt); box.appendChild(sum);
    const b = el("div", "sndbox"); box.appendChild(b);
    const toggle = (id, label) => { const x = el("button", "sndtog"); x.type = "button"; x.id = id; x.appendChild(el("span", null, label)); x.appendChild(el("i")); b.appendChild(x); return x; };
    const slider = (id, label) => { const w = el("label", "sndvol"); w.appendChild(el("span", null, label)); const r = el("input"); r.type = "range"; r.min = "0"; r.max = "100"; r.step = "5"; r.id = id; w.appendChild(r); b.appendChild(w); return r; };
    toggle("sndMusic", "Music").onclick = () => { S.sound.music = !S.sound.music; snd.unlock(); push(); };
    const sty = el("div", "seg sndsty"); sty.id = "sndStyle"; sty.setAttribute("role", "group"); sty.setAttribute("aria-label", "Music style"); b.appendChild(sty);
    const mv = slider("sndMv", "Music volume");
    mv.oninput = () => { S.sound.mv = +mv.value / 100; soundSync(); quiet(); };
    toggle("sndFx", "Timer sounds").onclick = () => { S.sound.fx = !S.sound.fx; snd.unlock(); push(); };
    const fv = slider("sndFv", "Timer volume");
    fv.oninput = () => { S.sound.fxv = +fv.value / 100; soundSync(); quiet(); };
    fv.onchange = () => snd.preview("warn");
    const tr = el("div", "sndtry"); tr.appendChild(el("span", null, "Hear:"));
    [["go", "Start"], ["tick", "Tick"], ["rotate", "Rotate"], ["done", "Time up"]].forEach(([k, label]) => { const x = el("button", null, label); x.type = "button"; x.onclick = () => snd.preview(k); tr.appendChild(x); });
    b.appendChild(tr);
    if (mode !== "sub") {
        b.appendChild(el("p", "sndlab", "Sound plays on"));
        const at = el("div", "seg sndat"); at.id = "sndAt"; at.setAttribute("role", "group"); at.setAttribute("aria-label", "Sound plays on"); b.appendChild(at);
    }
    const n = el("p", "sndnote"); n.id = "sndNote"; n.setAttribute("role", "status"); b.appendChild(n);
    const anchor = $("filesMenu") || $("toolsMenu"); anchor.after(box);
    // The quick switch in the top bar, so music goes on and off without scrolling the rail.
    const q = el("button", "btn ghost musicbtn"); q.id = "musicBtn"; q.type = "button"; q.title = "Background music (M key)";
    q.onclick = () => { S.sound.music = !S.sound.music; snd.unlock(); push(); };
    $("boardBtn").before(q);
    snd.onChange(soundControls);
}
function soundControls() {
    const box = $("soundMenu");
    let tap = $("sndTap");   // a screen that should play but has not been tapped yet (browsers need one tap first)
    if (!tap) { tap = el("button", "sndtap", "Tap for sound"); tap.id = "sndTap"; tap.type = "button"; tap.onclick = (e) => { e.stopPropagation(); snd.unlock(); }; document.body.appendChild(tap); }
    tap.hidden = !(synced && snd.wanted() && !snd.running());
    if (!box) return;
    const so = S.sound, here = playsHere();
    const on = (id, v) => { const x = $(id); x.setAttribute("aria-pressed", String(v)); x.querySelector("i").textContent = v ? "On" : "Off"; };
    on("sndMusic", so.music); on("sndFx", so.fx);
    seg($("sndStyle"), snd.STYLES, so.style, (v) => { S.sound.style = v; S.sound.music = true; snd.unlock(); push(); });
    [["sndMv", so.mv], ["sndFv", so.fxv]].forEach(([id, v]) => { const r = $(id); if (document.activeElement !== r) r.value = String(Math.round(v * 100)); });
    if ($("sndAt")) seg($("sndAt"), [["board", "The board"], ["here", "This device"]], so.at && so.at === DEVICE ? "here" : (so.at ? "other" : "board"), (v) => { S.sound.at = v === "here" ? DEVICE : ""; snd.unlock(); push(); });
    $("soundCount").textContent = so.music ? "Music on" : "";
    const q = $("musicBtn"); if (q) { q.textContent = so.music ? "Music on" : "Music off"; q.setAttribute("aria-pressed", String(so.music)); }
    let note;
    if (!so.music && !so.fx) note = "Sound is off.";
    else if (here) note = snd.running() ? "Playing on this device." : "Tap this screen once to let it play sound.";
    else if (so.at) note = "Playing on another device.";
    else note = "Playing on the board. If it stays quiet, tap the board once.";
    $("sndNote").textContent = note;
}
function tick() {
    const tc = $("tcard"); if (!tc) return;
    const kind = tc.dataset.kind, t = S.timers[kind], ms = t.running ? now() - t.t0 : t.elapsed, e = Math.max(0, Math.floor(ms / 1000));
    const c = $("clock"), bar = $("tbar"); let txt, hot, frac, phase;
    if (kind === "round") {
        const x = e % (ROUND + GAP), n = Math.floor(e / (ROUND + GAP)) + 1;
        if (x < ROUND) { const rr = ROUND - x; txt = fmt(rr); hot = rr <= 30; frac = rr / ROUND; phase = "work" + n; }
        else { const g = ROUND + GAP - x; txt = fmt(g); hot = true; frac = (GAP - g) / GAP; phase = "rotate" + n; }
        const rl = $("round"); rl.textContent = x < ROUND ? "Round " + n + " · then rotate" : "Rotate now! Next partner"; rl.classList.toggle("hot", x >= ROUND);
    } else {
        const T = secsFor(kind), r = Math.max(0, T - e); txt = r > 0 ? fmt(r) : "Time!"; hot = r <= Math.min(60, T / 4); frac = r / T; phase = r > 0 ? "run" : "done";
    }
    c.textContent = txt; c.classList.toggle("hot", hot); bar.classList.toggle("hot", hot); bar.firstChild.style.width = (frac * 100) + "%";
    $("tgo").textContent = t.running ? "Pause" : (t.elapsed > 0 ? "Resume" : "Start");
}

function skeleton() {
    const k = el("div", "skel"); k.setAttribute("aria-busy", "true"); k.setAttribute("aria-label", "Getting today's lesson");
    k.appendChild(el("div", "skb hd")); const b = el("div", "skbody"); ["w70", "w90", "w55"].forEach((c) => b.appendChild(el("div", "skb " + c))); k.appendChild(b); return k;
}
function render() {
    if (!synced) { const st = $("screenHost"); if (!st.querySelector(".skel")) { st.textContent = ""; st.appendChild(skeleton()); } return; }
    syncGames(); syncLive(); buildControls(); soundSync();
    const l = L(), d = D(), ns = JSON.stringify([S.week, S.period, S.cls, S.day, S.screen, S.prob, S.show, S.note, S.step, S.timers.free.dur, S.speedMode, !!speedFix, signedIn, S.screen === "game" ? gameSig() : "", S.screen === "live" ? liveSig() : "", S.screen === "fix" ? JSON.stringify([S.fix, !!sdSet()]) : ""]);
    renderDock(); drawGamePanel(); drawLivePanel();
    if (ns === sig) { renderLayer(); tick(); tickTools(toolApi); return; }
    sig = ns;
    const st = $("screenHost"); st.textContent = ""; canvas = null; ctx = null; pad = null;
    if (!l) { st.appendChild(el("div", "empty", "No lesson found for this class and week.")); watchInk(); return; }
    const w = W();
    if (S.screen === "agenda") {
        st.appendChild(header("Weekly Agenda", w.label + " · " + w.dates));
        const b = el("div", "body rows");
        (l.days || []).forEach((x, i) => { const r = el("div", "row" + (i === S.day ? " now" : "")), tab = el("div", "tab"); tab.appendChild(el("span", "dot", "+−×÷="[i])); tab.appendChild(el("span", null, x.name)); r.appendChild(tab); r.appendChild(el("p", "what", x.agendaLine || "")); b.appendChild(r); });
        b.appendChild(ltBox(l.weekLT)); st.appendChild(b);
    } else if (S.screen === "today" && d) {
        st.appendChild(header(d.title || d.name, d.date));
        const g = el("div", "body today"); let k;
        k = card("Bell Ringer"); lines(k.i, [d.bell], "big"); g.appendChild(k.c);
        k = card("Agenda"); lines(k.i, d.agenda, "big"); g.appendChild(k.c);
        k = card("Supplies"); lines(k.i, d.supplies, "item"); g.appendChild(k.c);
        k = card("Reminders"); lines(k.i, d.reminders, "big"); g.appendChild(k.c);
        g.appendChild(timerCard("bell", "Bellringer Timer")); g.appendChild(weekCard()); g.appendChild(ltBox(d.lt)); st.appendChild(g);
    } else if (S.screen === "speed") {
        const sp = l.speed || {};
        st.appendChild(header("Speed Dating", sp.motto));
        const g2 = el("div", "body speed"), k2 = card("How It Works", "steps"), ol = el("ol");
        (sp.steps || []).forEach((t) => ol.appendChild(el("li", null, t))); k2.c.replaceChild(ol, k2.i);
        g2.appendChild(k2.c); g2.appendChild(speedTimer()); g2.appendChild(weekCard()); g2.appendChild(ltBox(sp.lt)); st.appendChild(g2);
    } else if (S.screen === "fix") {
        drawFix(st);
    } else if (S.screen === "timer") {
        st.appendChild(header("Timer", (d ? d.name + " · " : "") + ((d && d.date) || "")));
        const box = el("div", "bigtimer"); timerParts("free", box);
        const pr = el("div", "presets");
        PRESETS.forEach((m) => { const b = el("button", null, m + " min"); b.type = "button"; b.setAttribute("aria-pressed", String((S.timers.free.dur || 300) === m * 60)); b.onclick = () => { S.timers.free = Object.assign(blankTimer(), { dur: m * 60 }); push(); }; pr.appendChild(b); });
        box.appendChild(pr); st.appendChild(box);
    } else if (S.screen === "notes") {
        const frames = notesFrames(d), n = d && d.notes;
        st.appendChild(header("Guided Notes", n ? n.title : (d ? d.name + " · " + (d.date || "") : "")));
        if (!frames.length) { const e = el("div", "toolsbody"); e.appendChild(el("p", "toolempty", "No guided notes are loaded for this day.")); st.appendChild(e); }
        else {
            if (S.note >= frames.length) S.note = frames.length - 1;
            const f = frames[S.note], shown = f.open ? f.lines.length : Math.min(S.step, f.lines.length);
            const body = el("div", "notes"), left = el("div", "nleft"), right = el("div", "nright");
            const dots = el("div", "ndots"); frames.forEach((x, i) => { const b = el("button", i === S.note ? "on" : (i < S.note ? "done" : "")); b.type = "button"; b.title = x.kind; b.setAttribute("aria-label", "Go to " + x.kind); b.onclick = () => { S.note = i; S.step = 0; S.show = false; push(); }; dots.appendChild(b); });
            left.appendChild(dots);
            left.appendChild(el("p", "nkind", f.kind));
            if (f.blanks) left.appendChild(blanked(f.q, S.show)); else left.appendChild(richEl("p", "nq", f.q));
            const list = el("div", "nlines");
            f.lines.slice(0, shown).forEach((ln, i) => { const row = el("div", "nline" + (i === shown - 1 && !f.open ? " new" : "")); row.appendChild(richEl("p", "nm", ln.m)); if (ln.why) row.appendChild(richEl("p", "nw", ln.why)); list.appendChild(row); });
            left.appendChild(list);
            if (!f.open && f.lines.length) left.appendChild(el("p", "ncount", shown < f.lines.length ? "Step " + shown + " of " + f.lines.length : "All " + f.lines.length + " steps shown"));
            if (f.ans && S.show && !f.blanks) left.appendChild(richEl("p", "nans", f.ans));
            body.appendChild(left);
            const cv = makeCv();
            right.appendChild(cv); right.appendChild(toolbar()); body.appendChild(right); st.appendChild(body); bindCanvas(); sizeCanvas();
            list.scrollTop = list.scrollHeight; // keep the newest step in view
        }
    } else if (S.screen === "game") {
        drawGame(st); tickGames();
    } else if (S.screen === "live") {
        drawLiveStage(st); tickLive();
    } else if (S.screen === "tools") {
        st.appendChild(header("Classroom Tools", (d ? d.name + " · " : "") + ((d && d.date) || "")));
        const box = el("div", "toolsbody"); box.appendChild(el("p", "toolempty", Object.keys(S.tools.on).length ? "" : "Turn tools on from the Tools row on the Remote. Drag a tool by its title to move it, and drag its corner to resize it.")); st.appendChild(box);
    } else { /* bellringer or blank whiteboard */
        const blank = S.screen === "blank" || !d, ps = (d && d.problems) || [];
        st.appendChild(header(blank ? "Whiteboard" : "Bellringer", blank ? "Work it out" : (d.name + " · " + (d.date || ""))));
        const wk = el("div", "work"); wk.style.flex = "1"; wk.style.minHeight = "0";
        if (!blank) {
            const pr = el("div", "probs");
            ps.forEach((p, i) => { const b2 = el("button", null, "Problem " + (i + 1)); b2.type = "button"; b2.setAttribute("aria-pressed", String(i === S.prob)); b2.onclick = () => { S.prob = i; S.show = false; push(); }; pr.appendChild(b2); });
            wk.appendChild(pr);
            const p = ps[S.prob];
            if (p) {
                const q = el("div", "q"); q.appendChild(richEl("p", "qt", p.q)); if (S.show) q.appendChild(richEl("p", "ans", p.a));
                const sb = el("button", null, S.show ? "Hide answer" : "Show answer"); sb.type = "button"; sb.onclick = () => { S.show = !S.show; push(); }; q.appendChild(sb); wk.appendChild(q);
            } else wk.appendChild(el("div", "q", "No bellringer problems are loaded for this day."));
        }
        const cv = makeCv();
        wk.appendChild(cv); wk.appendChild(toolbar()); st.appendChild(wk); bindCanvas(); sizeCanvas();
    }
    renderLayer(); watchInk(); tick();
}

/* ---------- guided notes ---------- */
// The day's notes become a list of frames. Each frame is one thing on screen: a question, lines
// that are revealed one tap at a time, and sometimes an answer. The whiteboard sits beside it.
function notesFrames(d) {
    const n = d && d.notes; if (!n) return [];
    const F = [];
    if (n.targets && n.targets.length) F.push({ kind: "Learning targets", q: "I can…", lines: n.targets.map((t) => ({ m: t })), open: true });
    (n.warmup || []).forEach((p, i, a) => F.push({ kind: "Warm-up " + (i + 1) + " of " + a.length, q: p.q, lines: [], ans: p.a }));
    ((n.vocab && n.vocab.items) || []).forEach((v, i, a) => F.push({ kind: "Vocabulary " + (i + 1) + " of " + a.length, q: v, lines: [], ans: "fill", blanks: true }));
    if (n.bigIdea && n.bigIdea.length) F.push({ kind: "The big idea", q: n.bigIdea[0], lines: n.bigIdea.slice(1).concat(n.steps || []).map((t) => ({ m: t })) });
    (n.examples || []).forEach((e, i, a) => {
        if (e.intro && e.intro.length) F.push({ kind: "Key idea", q: e.intro[0], lines: e.intro.slice(1).map((t) => ({ m: t })) }); // a rule box that sits before this example on the paper notes
        F.push({ kind: "Example " + (i + 1) + " of " + a.length + (e.title ? ": " + e.title : ""), q: e.q, lines: e.steps || [] });
    });
    if (n.guided) F.push({ kind: "Your turn, with help", q: n.guided.q, lines: n.guided.steps || [] });
    (n.practice || []).forEach((part) => (part.problems || []).forEach((p) => F.push({ kind: (part.kind || "Practice") + " " + (p.n || ""), q: p.q, lines: p.work ? [{ m: p.work }] : [], ans: p.a })));
    if (n.exit && n.exit.length) F.push({ kind: "Exit ticket", q: "On your own. Show every step.", lines: n.exit.map((p, i) => ({ m: (i + 1) + ". " + p.q })), open: true });
    return F;
}
// A sentence with [blanks]: shown as empty lines until revealed, then the word appears.
function blanked(text, reveal) {
    const p = el("p", "nq"); String(text).split(/(\[[^\]]+\])/).forEach((part) => {
        if (/^\[.*\]$/.test(part)) { const w = part.slice(1, -1), sp = el("span", reveal ? "fill" : "blank", reveal ? w : ""); if (!reveal) sp.style.minWidth = Math.max(3, w.length * 0.62) + "em"; p.appendChild(sp); }
        else p.appendChild(rich(part));
    });
    return p;
}

/* ---------- floating tools (shown over every screen) ---------- */
const DEFAULT_POS = { pick: [34, 30], groups: [10, 24],  traffic: [2, 23], work: [20, 23], text: [48, 23], stopwatch: [72, 60], dice: [46, 60], clock: [20, 66], score: [28, 40], goal: [60, 30] };
let topZ = 1;
let layerSig = "", dragging = false;
function posOf(k) { const p = S.tools.pos[k]; if (p) return p; const d = DEFAULT_POS[k] || [10, 30]; return { x: d[0], y: d[1], s: 1 }; }
function renderDock() {
    const dock = $("dock"); if (!dock) return; dock.textContent = ""; { const n = Object.keys(S.tools.on).length, tc = $("toolCount"); if (tc) tc.textContent = n ? n + " on" : ""; }
    TOOL_LIST.filter(([k]) => !(mode === "sub" && (k === "pick" || k === "groups"))).forEach(([k, label]) => { const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", String(!!S.tools.on[k])); b.onclick = () => { if (S.tools.on[k]) delete S.tools.on[k]; else S.tools.on[k] = true; push(); }; dock.appendChild(b); });
    if (Object.keys(S.tools.on).length) { const c = el("button", "clear", "Hide all"); c.type = "button"; c.onclick = () => { S.tools.on = {}; push(); }; dock.appendChild(c); }
}
function renderLayer() {
    const layer = $("toolLayer"); if (!layer || dragging) return;
    const ns = toolSig(); if (ns === layerSig) return; layerSig = ns;
    const typingId = document.activeElement && ["toolMsgIn", "toolGoalIn"].includes(document.activeElement.id) ? document.activeElement.id : "", typing = !!typingId, caret = typing ? document.activeElement.selectionStart : 0;
    layer.textContent = ""; const shelf = shelfEl(), docked = shelfKeys(), canDock = !narrowWrap(); shelf.textContent = "";
    TOOL_LIST.forEach(([k]) => {
        if (!S.tools.on[k]) return;
        if (docked.includes(k)) {   // on the shelf: beside the lesson, never over it
            const w = buildWidget(k, toolApi), h = w.querySelector("h3"); w.classList.add("docked");
            const out = el("button", "close pop", "↗"); out.type = "button"; out.title = "Float this tool over the lesson"; out.setAttribute("aria-label", "Float this tool over the lesson");
            out.onclick = () => { const d = DEFAULT_POS[k] || [10, 30]; S.tools.pos[k] = { x: d[0], y: d[1], s: 1 }; push(); };
            const x = el("button", "close", "×"); x.type = "button"; x.setAttribute("aria-label", "Hide this tool"); x.onclick = () => { delete S.tools.on[k]; push(); };
            const tail = el("span", "hbtns"); tail.appendChild(out); tail.appendChild(x); h.appendChild(tail); shelf.appendChild(w); return;
        }
        const w = buildWidget(k, toolApi), p = posOf(k); w.classList.add("float");
        w.style.left = p.x + "%"; w.style.top = p.y + "%"; w.style.fontSize = p.s + "em";
        const h = w.querySelector("h3"), x = el("button", "close", "×"); x.type = "button"; x.setAttribute("aria-label", "Hide this tool"); x.onclick = () => { delete S.tools.on[k]; push(); };
        const tail = el("span", "hbtns");
        if (canDock && k !== "groups") { const back = el("button", "close pop", "↘"); back.type = "button"; back.title = "Put this tool back on the shelf"; back.setAttribute("aria-label", "Put this tool back on the shelf"); back.onclick = () => { delete S.tools.pos[k]; push(); }; tail.appendChild(back); }
        tail.appendChild(x); h.appendChild(tail);
        const grip = el("span", "grip"); grip.setAttribute("aria-hidden", "true"); w.appendChild(grip);
        const stage = $("stage");
        const start = (e, kind) => {
            if (e.target.closest && e.target.closest("button")) return; e.preventDefault(); dragging = true;
            const r = stage.getBoundingClientRect(), p0 = Object.assign({}, posOf(k)), sx = e.clientX, sy = e.clientY, w0 = w.getBoundingClientRect().width; let cur = Object.assign({}, p0);
            const move = (ev) => {
                if (kind === "move") { cur.x = Math.min(95, Math.max(0, p0.x + (ev.clientX - sx) / r.width * 100)); cur.y = Math.min(92, Math.max(0, p0.y + (ev.clientY - sy) / r.height * 100)); w.style.left = cur.x + "%"; w.style.top = cur.y + "%"; }
                else { cur.s = Math.min(3, Math.max(0.5, p0.s * (w0 + ev.clientX - sx) / w0)); w.style.fontSize = cur.s + "em"; }
            };
            const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); dragging = false; S.tools.pos[k] = { x: Math.round(cur.x * 10) / 10, y: Math.round(cur.y * 10) / 10, s: Math.round(cur.s * 100) / 100 }; layerSig = toolSig(); if (writeState) writeState(JSON.parse(JSON.stringify(S))); };
            window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
        };
        h.addEventListener("pointerdown", (e) => start(e, "move")); grip.addEventListener("pointerdown", (e) => start(e, "size"));
        w.addEventListener("pointerdown", () => { w.style.zIndex = String(++topZ); });
        layer.appendChild(w);
    });
    if (typing) { const t = $(typingId); if (t) { t.focus(); try { t.setSelectionRange(caret, caret); } catch (e) { /* ok */ } } }
    tickTools(toolApi);
    if ((shelfEm() + "|" + narrowWrap()) !== shelfApplied) fit();   // the shelf appeared, went away or changed width
    fitShelf();
}
/* The board cannot scroll, so a full shelf shrinks its tools to fit instead of cutting one off. */
function fitShelf() {
    const sh = shelfEl(); if (sh.hidden) return; const base = parseFloat($("stage").style.fontSize) || 12;
    sh.style.fontSize = base + "px";
    if (sh.scrollHeight > sh.clientHeight + 2) sh.style.fontSize = Math.max(base * 0.6, base * sh.clientHeight / sh.scrollHeight * 0.98) + "px";
}

/* ---------- whiteboard ink ---------- */
let canvas = null, ctx = null, strokes = [], cur = null, pen = "ink", size = 1, erasing = false, paper = "", inkKey = "", inkUnsub = null, inkWrite = null, clearArm = 0;
let pad = null, hist = [], padItems = [];   // pad: the math tools under the ink (js/mathPad.js); hist: undo copies; padItems: the tools, kept while the screen redraws
const PAPERS = [["", "Plain"], ["grid", "Grid"], ["dots", "Dots"], ["lines", "Lines"]];
/* The whiteboard: math tools on a canvas underneath, ink on top. */
function makeCv() {
    const cv = el("div", "cv" + (paper ? " p-" + paper : "")); cv.id = "cv"; canvas = el("canvas"); cv.appendChild(canvas);
    pad = createMathPad(cv, canvas, { change: snap, commit: saveInk, onMode: () => retool() });
    pad.setItems(padItems); return cv;
}
function snap() { hist.push(JSON.stringify({ strokes, items: pad ? pad.items() : padItems })); if (hist.length > 60) hist.shift(); }
function undo() {
    const last = hist.pop(); if (!last) return; const d = JSON.parse(last);
    strokes = d.strokes || []; padItems = d.items || []; if (pad) pad.setItems(padItems); redraw(); saveInk();
}
function setPaper(p) { paper = p; const cv = $("cv"); if (cv) { PAPERS.forEach(([k]) => { if (k) cv.classList.remove("p-" + k); }); if (p) cv.classList.add("p-" + p); } }
const PENS = { ink: "--pen-ink", blue: "--pen-blue", red: "--pen-red", green: "--pen-green" }, SIZES = [3, 6, 11];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function toolbar() {
    const t = el("div", "tools"); t.id = "tools";
    Object.keys(PENS).forEach((k) => { const b = el("button", "sw"); b.type = "button"; b.style.background = css(PENS[k]); b.setAttribute("aria-label", k + " pen"); b.setAttribute("aria-pressed", String(!erasing && pen === k)); b.onclick = () => { pen = k; erasing = false; if (pad) pad.setOn(false); retool(); }; t.appendChild(b); });
    ["Thin", "Medium", "Thick"].forEach((n, i) => { const b = el("button", null, n); b.type = "button"; b.setAttribute("aria-pressed", String(size === i)); b.onclick = () => { size = i; retool(); }; t.appendChild(b); });
    const er = el("button", null, "Eraser"); er.type = "button"; er.setAttribute("aria-pressed", String(erasing && !(pad && pad.on))); er.onclick = () => { erasing = !erasing; if (pad) pad.setOn(false); retool(); }; t.appendChild(er);
    const moving = !!(pad && pad.on);
    const mv = el("button", null, "Move"); mv.type = "button"; mv.title = "Pick up, move, size and turn the math tools"; mv.setAttribute("aria-pressed", String(moving)); mv.onclick = () => { if (pad) pad.setOn(!pad.on); retool(); }; t.appendChild(mv);
    const ad = el("button", "addtool", "+ Math tool"); ad.type = "button"; ad.onclick = () => { if (pad) pad.openMenu(); }; t.appendChild(ad);
    const un = el("button", null, "Undo"); un.type = "button"; un.onclick = undo; t.appendChild(un);
    const cl = el("button", null, "Clear"); cl.type = "button";
    cl.onclick = () => { if (Date.now() - clearArm < 3000) { snap(); strokes = []; padItems = []; if (pad) pad.clear(); redraw(); saveInk(); cl.textContent = "Clear"; clearArm = 0; } else { clearArm = Date.now(); cl.textContent = "Tap again to clear"; setTimeout(() => { cl.textContent = "Clear"; }, 3000); } };
    t.appendChild(cl);
    const pi = Math.max(0, PAPERS.findIndex((x) => x[0] === paper));
    const gr = el("button", null, "Paper: " + PAPERS[pi][1]); gr.type = "button"; gr.title = "Plain, grid, dots or lines behind the work"; gr.setAttribute("aria-pressed", String(!!paper)); gr.onclick = () => { setPaper(PAPERS[(pi + 1) % PAPERS.length][0]); saveInk(); retool(); }; t.appendChild(gr);
    const n = el("span", "note"); n.id = "inknote"; t.appendChild(n); return t;
}
function retool() { const old = $("tools"); if (old) old.parentNode.replaceChild(toolbar(), old); }
function sizeCanvas() { if (!canvas) return; const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); if (r.width < 2) return; canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); ctx = canvas.getContext("2d"); redraw(); if (pad) pad.resize(); }
function drawStroke(s) {
    if (!ctx || !s.p || s.p.length < 2) return; const Wd = canvas.width, H = canvas.height, p = s.p;
    ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over"; ctx.strokeStyle = css(PENS[s.c] || PENS.ink) || "#14213D";
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = (s.e ? 5 : 1) * (SIZES[s.w] || 6) * Wd / 1400;
    ctx.beginPath(); ctx.moveTo(p[0] / 10000 * Wd, p[1] / 10000 * H); if (p.length === 2) ctx.lineTo(p[0] / 10000 * Wd + 0.1, p[1] / 10000 * H);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] / 10000 * Wd, p[i + 1] / 10000 * H);
    ctx.stroke(); ctx.globalCompositeOperation = "source-over";
}
function redraw() { if (!ctx || !canvas) return; ctx.clearRect(0, 0, canvas.width, canvas.height); strokes.forEach(drawStroke); if (cur) drawStroke(cur); }
function pt(e) { const r = canvas.getBoundingClientRect(); return [Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 10000), Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 10000)]; }
function bindCanvas() {
    canvas.addEventListener("pointerdown", (e) => { if (e.button || (pad && pad.on)) return; e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } const p = pt(e); cur = { c: pen, w: size, e: erasing ? 1 : 0, p: [p[0], p[1]] }; redraw(); });
    canvas.addEventListener("pointermove", (e) => { if (!cur) return; const p = pt(e), a = cur.p, n = a.length; if (Math.abs(p[0] - a[n - 2]) + Math.abs(p[1] - a[n - 1]) < 14) return; a.push(p[0], p[1]); redraw(); });
    const end = () => { if (!cur) return; snap(); strokes.push(cur); cur = null; redraw(); saveInk(); };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
}
function note(t) { const n = $("inknote"); if (n) n.textContent = t; }
function saveInk() {
    if (pad) padItems = pad.items();
    if (!inkWrite) return; const body = { strokes, items: padItems, paper, at: Date.now() };
    if (JSON.stringify(body).length > 700000) { note("This board is full. Clear it to keep saving."); return; }
    note(""); inkWrite(JSON.parse(JSON.stringify(body)));
}
function watchInk() {
    const key = canvas ? [S.week, S.period, "d" + S.day, S.screen === "notes" ? "n" + S.note : S.screen === "fix" ? "fix" + ((fixCur() || {}).n || 0) : ((S.screen === "bell" && D()) ? "p" + S.prob : "blank")].join("_") : "";
    if (key === inkKey) return; inkKey = key; if (inkUnsub) { inkUnsub(); inkUnsub = null; } inkWrite = null; strokes = []; cur = null; hist = []; padItems = []; if (pad) pad.setItems([]); redraw();
    if (!key || !signedIn) return;
    inkWrite = writer("ink/" + key);
    inkUnsub = store.watch("ink/" + key, (sn) => {
        if (key !== inkKey || sn.pending || cur || (inkWrite && inkWrite.busy()) || (pad && pad.busy())) return; const dd = sn.exists && sn.data;
        strokes = dd && Array.isArray(dd.strokes) ? JSON.parse(JSON.stringify(dd.strokes)) : [];
        padItems = dd && Array.isArray(dd.items) ? JSON.parse(JSON.stringify(dd.items)) : []; if (pad) pad.setItems(padItems);
        const pp = dd && PAPERS.some((x) => x[0] === dd.paper) ? dd.paper : ""; if (pp !== paper) { setPaper(pp); retool(); }
        redraw(); }, () => note("Saved drawings are not available right now."));
}

/* ---------- Fix It Together: the speed dating error review ----------
   After speed dating, students name the cards that tripped people up. The teacher picks each card
   on the Remote, it shows on the board beside a whiteboard, and the class works it out together.
   Card problems come from the week saved in Week Builder (private, never in this public repo).
   An answer or a common mistake reaches the board only when the teacher taps to reveal it. */
const sdWeeks = {}, sdWatched = {};
function sdSet() {
    if (!store || !signedIn) return null;
    const id = S.week;
    if (!sdWatched[id]) {
        sdWatched[id] = true;
        store.watch("weekfiles/" + id, (snap) => {
            if (snap.pending) return; let w = null;
            try { if (snap.exists && snap.data && snap.data.json) w = JSON.parse(snap.data.json); } catch (e) { /* a damaged copy: type the problem instead */ }
            sdWeeks[id] = w; if (S.screen === "fix") { sig = ""; render(); }
        }, () => { sdWeeks[id] = null; });
    }
    const w = sdWeeks[id], c = w && w.classes && w.classes[S.cls], sd = c && c.speedDating;
    if (sd && Array.isArray(sd.cards) && sd.cards.length) return sd;
    // Fallback: the card problems published with the week (student-facing, no answers).
    const sp = (L() || {}).speed;
    return sp && Array.isArray(sp.cards) && sp.cards.length ? { title: sp.cardsTitle || "", cards: sp.cards } : null;
}
const fixKey = () => S.week + "|" + S.period + "|" + S.day;
const str = (x, n) => (typeof x === "string" ? x : "").slice(0, n);
function cleanFix(f) {
    if (!f || typeof f !== "object" || typeof f.key !== "string") return null;
    const list = (Array.isArray(f.list) ? f.list : []).slice(0, 40).map((x) => ({ n: Math.max(1, Math.min(99, Math.floor(+(x && x.n) || 1))), q: str(x && x.q, 400), done: !!(x && x.done) }));
    return { key: f.key, list, cur: Math.max(0, Math.min(list.length - 1, Math.floor(+f.cur || 0))), ans: str(f.ans, 200), err: (Array.isArray(f.err) ? f.err : []).slice(0, 4).map((e) => str(e, 200)) };
}
function fixState() { if (!S.fix || S.fix.key !== fixKey()) S.fix = { key: fixKey(), list: [], cur: 0, ans: "", err: [] }; return S.fix; }
function fixCur() { const f = S.fix && S.fix.key === fixKey() ? S.fix : null; return f && f.list[f.cur]; }
function fixGo(i) { const f = fixState(); f.cur = i; f.ans = ""; f.err = []; push(); }
function fixAdd(n, q) {
    const f = fixState(), at = f.list.findIndex((x) => x.n === n);
    if (at >= 0) { if (q) f.list[at].q = q; fixGo(at); return; }
    f.list.push({ n, q: q || "", done: false }); fixGo(f.list.length - 1);
}
function drawFix(st) {
    const f = fixState(), c = f.list[f.cur], sd = sdSet(), remote = true;   // Eddie: the picker shows on every screen, the board too
    st.appendChild(header("Fix It Together", sd && sd.title ? "Speed dating review: " + sd.title : "The cards that tripped us up"));
    const body = el("div", "notes fix"), left = el("div", "nleft"), right = el("div", "nright");
    if (remote) left.appendChild(fixPicker(f, sd));
    if (f.list.length) {
        const chips = el("div", "fixchips");
        f.list.forEach((x, i) => {
            const b = el("button", "fixchip" + (i === f.cur ? " on" : "") + (x.done ? " done" : ""), "#" + x.n + (x.done ? " \u2713" : ""));
            b.type = "button"; b.setAttribute("aria-label", "Card " + x.n + (x.done ? ", fixed" : "")); b.onclick = () => fixGo(i); chips.appendChild(b);
        });
        left.appendChild(chips);
    }
    if (c) {
        left.appendChild(el("p", "nkind", "Card #" + c.n + " \u00b7 tricky card " + (f.cur + 1) + " of " + f.list.length));
        left.appendChild(c.q ? richEl("p", "nq", c.q) : el("p", "nq fixnoq", "Card #" + c.n));
        if (f.err.length) { const w = el("div", "fixerr"); w.appendChild(el("p", "fixerrh", "Watch out: common mistakes")); f.err.forEach((t) => w.appendChild(richEl("p", null, t))); left.appendChild(w); }
        if (f.ans) left.appendChild(richEl("p", "nans", "Answer: " + f.ans));
        if (remote) left.appendChild(fixReveal(f, c, sd));
    } else {
        const e = el("div", "fixempty");
        e.appendChild(el("p", "fixbig", "Which card tripped you up?"));
        e.appendChild(el("p", null, "Check the Errors box on your card. Tell us the card number and the most common mistake."));
        left.appendChild(e);
    }
    body.appendChild(left);
    const cv = makeCv();
    right.appendChild(cv); right.appendChild(toolbar()); body.appendChild(right); st.appendChild(body); bindCanvas(); sizeCanvas();
}
/* Remote only: pick a card, or type one when the week's cards are not saved in Week Builder. */
// A dropdown cannot stack fractions: {3/4} becomes 3/4, and {{3/4}/{1/2}} becomes (3/4)/(1/2).
function flatFrac(t) {
    let i = 0; const atom = (x) => (/^[\w.−-]+$/.test(x) ? x : "(" + x + ")");
    const parse = (stop) => { let out = ""; while (i < t.length && !(stop && stop.includes(t[i]))) { if (t[i] === "{") { const save = i++; const a = parse("/}").trim(); if (t[i] === "/") { i++; const b = parse("}").trim(); if (t[i] === "}") { i++; const nested = !!stop; out += (/\d$/.test(out) ? " " : "") + (nested && /\d \d/.test(a + b) ? "(" + atom(a) + "/" + atom(b) + ")" : atom(a) + "/" + atom(b)); continue; } } i = save + 1; out += "{"; continue; } out += t[i++]; } return out; };
    return parse("");
}
function fixPicker(f, sd) {
    const box = el("div", "fixctl"), row = el("div", "fixrow"), sel = el("select"), cards = sd ? sd.cards : null, n = cards ? cards.length : 40;
    sel.setAttribute("aria-label", "Pick a card");
    const o0 = el("option", null, "Pick a tricky card\u2026"); o0.value = ""; sel.appendChild(o0);
    for (let i = 1; i <= n; i++) {
        const q = cards && cards[i - 1] && cards[i - 1].q ? flatFrac(String(cards[i - 1].q)).replace(/\s+/g, " ") : "", o = el("option", null, "#" + i + (q ? "  " + (q.length > 70 ? q.slice(0, 68) + "\u2026" : q) : "") + (f.list.some((x) => x.n === i) ? "  (on the list)" : ""));
        o.value = String(i); sel.appendChild(o);
    }
    row.appendChild(sel);
    if (cards) sel.onchange = () => { const i = +sel.value; if (i) fixAdd(i, String((cards[i - 1] && cards[i - 1].q) || "")); };
    else {
        const t = el("input"); t.type = "text"; t.placeholder = "Type the problem on the card"; t.id = "fixType"; t.setAttribute("aria-label", "Problem on the card");
        const add = el("button", null, "Show it"); add.type = "button";
        const go = () => { const i = +sel.value; if (!i) { sel.focus(); return; } fixAdd(i, t.value.trim()); };
        add.onclick = go; t.onkeydown = (e) => { if (e.key === "Enter") go(); };
        row.appendChild(t); row.appendChild(add);
    }
    box.appendChild(row);
    if (!cards) box.appendChild(el("p", "fixhint", "Save this week in Week Builder and the card problems show up in this list."));
    return box;
}
function fixReveal(f, c, sd) {
    const box = el("div", "fixctl fixbtns"), card = sd && sd.cards[c.n - 1];
    const btn = (label, on, fn, cls) => { const b = el("button", cls || null, label); b.type = "button"; b.setAttribute("aria-pressed", String(!!on)); b.onclick = fn; box.appendChild(b); };
    const wrong = card && Array.isArray(card.wrong) ? card.wrong.filter((w) => w && w.a) : [];
    // Handlers read the state fresh: a synced copy can replace S.fix without a redraw.
    if (wrong.length) btn(f.err.length ? "Hide mistakes" : "Show common mistakes", f.err.length, () => { const f = fixState(); f.err = f.err.length ? [] : wrong.slice(0, 3).map((w) => String(w.a) + (w.why ? ": " + w.why : "")); push(); });
    if (card && card.a) btn(f.ans ? "Hide answer" : "Show answer", f.ans, () => { const f = fixState(); f.ans = f.ans ? "" : String(card.a); push(); });
    btn(c.done ? "Fixed \u2713" : "Mark fixed", c.done, () => { const f = fixState(), c = f.list[f.cur]; if (!c) return; c.done = !c.done; if (c.done && f.cur < f.list.length - 1) { fixGo(f.cur + 1); return; } push(); }, "fixdone");
    btn("Remove", false, () => { const f = fixState(); f.list.splice(f.cur, 1); fixGo(Math.max(0, Math.min(f.cur, f.list.length - 1))); }, "alt");
    return box;
}

/* ---------- shared state ---------- */
function applyState(d) {
    if (!d) return;
    ["week", "cls", "screen"].forEach((k) => { if (typeof d[k] === "string") S[k] = d[k]; });
    if (!WEEKS.some((w) => w.id === S.week)) S.week = defaultWeek();
    if (typeof d.period === "string" && PERIODS.some((p) => p[0] === d.period)) { S.period = d.period; S.cls = classOf(d.period); }
    else { const m = PERIODS.find((p) => p[1] === S.cls); if (m && classOf(S.period) !== S.cls) S.period = m[0]; }
    if (!W().classes[S.cls]) { S.cls = Object.keys(W().classes)[0]; const m = PERIODS.find((p) => p[1] === S.cls); if (m) S.period = m[0]; }
    if (!SCREENS.some((x) => x[0] === S.screen)) S.screen = "today";
    if (typeof d.day === "number" && d.day >= 0 && d.day < 5) S.day = d.day;
    if (typeof d.prob === "number") S.prob = d.prob; S.show = !!d.show;
    S.note = Math.max(0, Math.floor(+d.note || 0)); S.step = Math.max(0, Math.floor(+d.step || 0));
    { const m = mergeTools(d.tools); Object.keys(S.tools).forEach((k) => delete S.tools[k]); Object.assign(S.tools, m); } // keep the same object: widgets hold a reference to it
    S.speedMode = d.speedMode === "check" ? "check" : "round";
    S.fix = cleanFix(d.fix);
    { const o = d.sound || {}, v = (x, def) => (typeof x === "number" && x >= 0 && x <= 1 ? x : def);
        S.sound = { fx: o.fx !== false, fxv: v(o.fxv, 0.7), music: !!o.music, mv: v(o.mv, 0.35), style: snd.STYLES.some((x) => x[0] === o.style) ? o.style : "focus", at: typeof o.at === "string" ? o.at.slice(0, 20) : "" }; }
    ["bell", "round", "check", "free"].forEach((k) => { const t = d.timers && d.timers[k]; if (t) { S.timers[k] = { running: !!t.running, t0: +t.t0 || 0, elapsed: +t.elapsed || 0 }; if (k === "free") S.timers.free.dur = +t.dur || 300; } });
}
/* One-tap lesson flow: Weekly Agenda -> Today -> each bellringer problem and its answer -> the day's activity. */
function isSpeedDay() { const d = D(); return !!d && /speed dating/i.test((d.agendaLine || "") + " " + (d.agenda || []).join(" ")); }
function flow(n) {
    if (S.screen === "game") { gameFlow(n); return; }
    const d = D(), len = (d && d.problems && d.problems.length) || 0, frames = notesFrames(d), hasNotes = frames.length > 0;
    const afterBell = () => { if (hasNotes) { S.screen = "notes"; S.note = 0; S.step = 0; S.show = false; } else if (isSpeedDay()) { S.screen = "speed"; S.show = false; } else return false; return true; };
    if (n > 0) {
        if (S.screen === "agenda") S.screen = "today";
        else if (S.screen === "today") { if (len) { S.screen = "bell"; S.prob = 0; S.show = false; } else if (hasNotes || isSpeedDay()) afterBell(); else return; }
        else if (S.screen === "bell") { if (!S.show && len) S.show = true; else if (S.prob < len - 1) { S.prob++; S.show = false; } else if (!afterBell()) return; }
        else if (S.screen === "notes" && hasNotes) {
            const f = frames[Math.min(S.note, frames.length - 1)];
            if (!f.open && S.step < f.lines.length) S.step++;
            else if (f.ans && !S.show) S.show = true;
            else if (S.note < frames.length - 1) { S.note++; S.step = 0; S.show = false; }
            else if (isSpeedDay()) { S.screen = "speed"; S.show = false; } else return;
        }
        else if (S.screen === "speed") S.screen = "fix";
        else if (S.screen === "fix") { const f = fixState(); if (f.cur < f.list.length - 1) { fixGo(f.cur + 1); return; } return; }
        else return;
    } else {
        if (S.screen === "today") S.screen = "agenda";
        else if (S.screen === "bell") { if (S.show) S.show = false; else if (S.prob > 0) { S.prob--; S.show = true; } else S.screen = "today"; }
        else if (S.screen === "notes" && hasNotes) {
            const f = frames[Math.min(S.note, frames.length - 1)];
            if (S.show) S.show = false;
            else if (!f.open && S.step > 0) S.step--;
            else if (S.note > 0) { S.note--; const g = frames[S.note]; S.step = g.lines.length; S.show = !!g.ans; }
            else if (len) { S.screen = "bell"; S.prob = len - 1; S.show = true; } else S.screen = "today";
        }
        else if (S.screen === "fix") { const f = fixState(); if (f.list.length && f.cur > 0) { fixGo(f.cur - 1); return; } S.screen = "speed"; }
        else if (S.screen === "speed") { if (hasNotes) { S.screen = "notes"; S.note = frames.length - 1; S.step = frames[S.note].lines.length; S.show = false; } else if (len) { S.screen = "bell"; S.prob = len - 1; S.show = true; } else S.screen = "today"; }
        else return;
    }
    push();
}
/* Next/Back for the clicker, the arrow keys and the board's own arrows. The lesson flow goes first; when it has
   nowhere to go, move to the next (or previous) screen in the Screens list, so the board never needs the side panel. */
const screenOrder = () => SCREENS.filter((x) => mode !== "sub" || (x[0] !== "game" && x[0] !== "live")).map((x) => x[0]);
function nextScreen(n) {   // skips Guided Notes and Speed Dating on days that have none
    const d = D(), skip = { notes: !notesFrames(d).length, speed: !isSpeedDay() };
    const o = screenOrder().filter((id) => id === S.screen || !skip[id]), j = o.indexOf(S.screen) + n;
    return j >= 0 && j < o.length ? o[j] : null;
}
const screenName = (id) => (SCREENS.find((x) => x[0] === id) || ["", ""])[1];
const stateSig = () => JSON.stringify([S.screen, S.prob, S.show, S.note, S.step, S.fix, S.screen === "game" ? gameSig() : ""]);
function step(n) {
    const before = stateSig();
    flow(n);
    if (stateSig() !== before) return;
    const t = nextScreen(n); if (!t) return;
    S.screen = t; S.show = false; push();
}
function stepLabel() { const l = flowLabel(); if (l !== "Next") return l; const t = nextScreen(1); return t ? "Next: " + screenName(t) : "Next"; }
function backLabel() { if (["today", "bell", "notes", "speed", "fix"].includes(S.screen)) return "Back"; const t = nextScreen(-1); return t ? "Back: " + screenName(t) : "Back"; }
function flowLabel() {
    if (S.screen === "game") return gameFlowLabel();
    const d = D(), len = (d && d.problems && d.problems.length) || 0, frames = notesFrames(d), hasNotes = frames.length > 0;
    const after = hasNotes ? "Next: Guided Notes" : (isSpeedDay() ? "Next: Speed Dating" : "Next");
    if (S.screen === "agenda") return "Next: Today";
    if (S.screen === "today") return len ? "Next: Bellringer" : (hasNotes ? "Next: Guided Notes" : (isSpeedDay() ? "Next: Speed Dating" : "Next"));
    if (S.screen === "bell") { if (!S.show && len) return "Next: Show answer"; if (S.prob < len - 1) return "Next: Problem " + (S.prob + 2); return after; }
    if (S.screen === "notes" && hasNotes) {
        const f = frames[Math.min(S.note, frames.length - 1)];
        if (!f.open && S.step < f.lines.length) return S.step === 0 ? "Next: First step" : "Next: Step " + (S.step + 1);
        if (f.ans && !S.show) return f.blanks ? "Next: Fill the blanks" : "Next: Show answer";
        if (S.note < frames.length - 1) return "Next: " + frames[S.note + 1].kind.split(":")[0];
        return isSpeedDay() ? "Next: Speed Dating" : "Next";
    }
    if (S.screen === "speed") return "Next: Fix It Together";
    if (S.screen === "fix") { const f = fixState(); return f.cur < f.list.length - 1 ? "Next: Card #" + f.list[f.cur + 1].n : "Next"; }
    return "Next";
}
let wake = null;
async function keepAwake() { try { if ("wakeLock" in navigator && !wake && document.visibilityState === "visible") { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) { /* not supported or not allowed: the screen follows the device's own sleep setting */ } }

window.addEventListener("error", (e) => setStatus("Error: " + (e.message || "script problem")));
window.addEventListener("unhandledrejection", (e) => setStatus("Error: " + ((e.reason && (e.reason.code || e.reason.message)) || "request failed")));

export async function startApp(opts) {
    mode = (opts && opts.mode) || "remote";
    if (opts && Array.isArray(opts.weeks) && opts.weeks.length) WEEKS = opts.weeks;
    if (opts && Array.isArray(opts.periods) && opts.periods.length) PERIODS = opts.periods;
    store = (opts && opts.store) || await import("./boardStore.js?v=58");
    const guest = mode === "sub";
    mountGames({ S, header, store: () => store, writer, now, beep: () => snd.cue("done"), unlockSound, rosters: () => ROSTERS, redraw: () => { sig = ""; render(); }, mode: () => mode, signedIn: () => signedIn });
    mountLive({ S, header, store: () => store, rosters: () => ROSTERS, redraw: () => { sig = ""; render(); }, mode: () => mode, signedIn: () => signedIn });
    document.body.classList.toggle("board", mode === "board");
    $("periodSel").onchange = function () { S.period = this.value; S.cls = classOf(this.value); resetPos(); push(); };
    document.addEventListener("click", (e) => { document.querySelectorAll("details.acct[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
    $("weekSel").onchange = function () { S.week = this.value; resetPos(); push(); };
    $("boardBtn").onclick = () => { document.body.classList.add("board"); unlockSound(); try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ok */ } fit(); soundSync(); };
    $("exit").onclick = () => { document.body.classList.remove("board"); soundSync(); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ok */ } fit(); };
    $("signOut").onclick = async () => { try { await store.signOut(); } finally { location.replace("login.html"); } };
    window.addEventListener("resize", fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe($("wrap")); document.addEventListener("fullscreenchange", () => setTimeout(fit, 60));
    document.addEventListener("pointerdown", unlockSound); document.addEventListener("keydown", unlockSound);
    soundPanel();
    $("flowNext").onclick = () => step(1); $("flowBack").onclick = () => step(-1);
    { // small arrows for full-screen Board view (hidden otherwise): tap on the Promethean, click on the Chromebook
        const nav = el("div", "bnav"), b = el("button", null, "\u2039"), f = el("button", null, "\u203A");
        b.id = "bnBack"; f.id = "bnNext"; b.type = f.type = "button";
        b.onclick = () => step(-1); f.onclick = () => step(1);
        nav.append(b, f); document.body.appendChild(nav);
    }
    keepAwake(); document.addEventListener("visibilitychange", keepAwake); document.addEventListener("pointerdown", keepAwake);
    document.addEventListener("keydown", (e) => { if (e.target && (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable)) return; if (e.altKey || e.ctrlKey || e.metaKey) return; if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); step(1); } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); step(-1); } else if (e.key === "m" || e.key === "M") { S.sound.music = !S.sound.music; push(); } else if (e.key === "a" || e.key === "A") { if (S.screen === "bell" || S.screen === "notes") { S.show = !S.show; push(); } } });
    setInterval(() => { if (!synced) return; tick(); tickTools(toolApi); tickGames(); tickLive(); soundTick(); }, 250);
    { const p = el("div", "connpill"); p.id = "connPill"; p.setAttribute("role", "status"); p.hidden = true; document.body.appendChild(p); }
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && synced) { tick(); tickTools(toolApi); tickGames(); soundTick(); } });   // a tab back in view shows the right time at once
    document.body.classList.add("syncing");
    const arrived = () => { if (synced) return; synced = true; document.body.classList.remove("syncing"); sig = ""; };
    fit(); render();

    // Load timing, kept on this device only (step names and times, no data). ?signincheck shows it.
    const t0 = performance.now(), ms = () => Math.round(performance.now() - t0) + " ms";
    const mark = guest ? () => {} : trail;
    mark("board-load", mode + ", page " + Math.round(t0) + " ms");
    const user = await store.ready();
    mark("board-auth", ms());
    if (!user) { location.replace("login.html"); return; }
    signedIn = true; $("who").textContent = guest ? ((opts && opts.who) || "Guest teacher view, no sign-in") : (user.name ? "Signed in as " + user.name : "Signed in");
    if (!guest && "BroadcastChannel" in window) {
        try {
            tabs = new BroadcastChannel("focal-board-" + user.uid);
            tabs.onmessage = (ev) => {
                const d = ev.data; if (!synced || !d || d.by === PAGE) return;
                heard = { by: d.by, at: +d.at || 0 }; applyState(d); render();
            };
        } catch (e) { tabs = null; }
    }
    writeState = writer("board/state");
    store.watch("rosters/all", (snap) => { const p = (snap.exists && snap.data && snap.data.periods) || {}; ROSTERS = {}; Object.keys(p).forEach((k) => { if (Array.isArray(p[k])) ROSTERS[k] = p[k].map((n) => String(n).slice(0, 60)); }); renderLayer(); }, () => {});
    store.clockSkew().then((ms) => { skew = ms; tick(); });
    const slow = setTimeout(() => { mark("board-slow", ms()); setStatus("Still connecting\u2026"); arrived(); render(); }, 10000);   // never leave the teacher on a blank board
    // Connection, said plainly. The Remote must never look live when the board cannot follow it.
    const LOST = mode === "remote" ? "Not connected. The board will not follow. Reconnecting\u2026" : "Not connected. This screen will not follow the Remote. Reconnecting\u2026";
    let first = true, gotServer = false, cacheSince = 0, errored = false, checks = 0;
    const live = () => { cacheSince = 0; errored = false; if (Date.now() - saveFailedAt > 8000) setStatus(guest ? "This device only" : "Live"); };
    const lost = () => { if (!guest) setStatus(LOST); };
    window.addEventListener("offline", lost);
    if (!guest) setInterval(async () => {   // a connection can stall with no error: check it, and wake it if it has
        if (document.visibilityState === "hidden") return;
        if (cacheSince && Date.now() - cacheSince > 5000) lost();
        if (!synced || errored || ++checks % 6) return;   // a server read about every 30 s while in view
        if (!(await store.reachable("board/state"))) { lost(); store.kick && store.kick(); }
    }, 5000);
    store.watch("board/state", (snap) => {
        if (!gotServer && !snap.fromCache) { gotServer = true; mark("board-server", ms()); }
        if (snap.fromCache) { if (!cacheSince) cacheSince = Date.now(); } else if (!guest) live();
        if ((snap.pending && !(snap.data && snap.data.by && snap.data.by !== PAGE)) || (writeState && writeState.busy())) return;
        // An older copy of a change this tab already heard over the channel must not wind it back.
        if (snap.data && heard.by && snap.data.by === heard.by && (+snap.data.at || 0) < heard.at) return;
        if (!synced) mark("board-shown", ms() + (snap.fromCache ? " (saved copy)" : " (server)"));
        clearTimeout(slow);
        if (guest) setStatus("This device only"); else if (!snap.fromCache) live(); else if (!gotServer) setStatus("Connecting\u2026");
        if (snap.exists) applyState(snap.data);
        arrived();
        if (first) {
            first = false;
            const q = new URLSearchParams(location.search), c = q.get("class"), dy = q.get("day"), di = DK.map((k) => k.toLowerCase()).indexOf((dy || "").toLowerCase());
            let changed = !snap.exists;
            // A board left on another day must not come back on that day tomorrow: on a new calendar day, start on the real day.
            if (!guest && snap.exists && snap.data.stamp !== localIso()) { S.week = defaultWeek(); S.day = realDay(); S.screen = "today"; resetPos(); changed = true; }
            const pq = q.get("period"), sq = q.get("screen");
            if (guest) { const pp = q.get("period"); if (pp && PERIODS.some((p) => p[0] === pp)) { S.period = pp; S.cls = classOf(pp); } if (di >= 0) S.day = di; S.screen = "today"; resetPos(); push(); return; }
            const wq = q.get("week");   // the Library opens a chosen week: remote.html?week=week5&class=8th&day=mon
            if (mode === "remote" && wq && WEEKS.some((w) => w.id === wq) && wq !== S.week) { S.week = wq; resetPos(); changed = true; }
            if (mode === "remote" && sq && SCREENS.some((x) => x[0] === sq) && sq !== S.screen) { S.screen = sq; changed = true; }
            if (mode === "remote" && pq && PERIODS.some((p) => p[0] === pq) && pq !== S.period) { S.period = pq; S.cls = classOf(pq); resetPos(); S.screen = sq && SCREENS.some((x) => x[0] === sq) ? sq : "today"; changed = true; }
            else if (mode === "remote" && c && W().classes[c] && (c !== S.cls)) { S.cls = c; S.period = (PERIODS.find((p) => p[1] === c) || [S.period])[0]; resetPos(); changed = true; }
            if (mode === "remote" && di >= 0 && di !== S.day) { S.day = di; resetPos(); changed = true; }
            if (changed) { push(); return; }
        }
        render();
    }, (e, fails) => {
        clearTimeout(slow); errored = true; mark("board-sync-error", ((e && e.code) || "error") + ", try " + fails);
        arrived(); lost(); render();
        // The projected board has no one at its keyboard: if listening keeps failing while the device is online,
        // reload it (at most once every 5 minutes). The saved state comes straight back.
        if (mode === "board" && fails >= 4 && navigator.onLine) {
            try { const k = "focal-board-reloaded", at = +sessionStorage.getItem(k) || 0; if (Date.now() - at > 300000) { sessionStorage.setItem(k, String(Date.now())); location.reload(); } } catch { /* storage blocked: keep retrying */ }
        }
    });
    render();
}
