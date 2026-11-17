/* ==========================================
   Calera Math — the board app.
   board.html runs it with mode "board" (the Promethean: controls hidden),
   remote.html with mode "remote" (the Chromebook: controls shown).
   Both read and write the same state document, so whatever one device
   changes, the other follows. Lesson content comes from data/weeks.js.
========================================== */
import { WEEKS } from "../data/weeks.js?v=25";
let store = null; // the signed-in Firestore store, or a this-device-only store for the sub page
import { trail } from "./signInTrail.js";
import { buildWidget, tickTools, defaultTools, mergeTools, TOOL_LIST } from "./boardTools.js?v=25";

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

const SCREENS = [["agenda", "Weekly Agenda"], ["today", "Today"], ["bell", "Bellringer"], ["notes", "Guided Notes"], ["speed", "Speed Dating"], ["timer", "Timer"], ["tools", "Tools"], ["blank", "Whiteboard"]];
const DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
// Each period and the class plan it follows.
const PERIODS = [["1st", "8th"], ["2nd", "8th"], ["4th", "8th"], ["5th", "7th"], ["6th", "8th-acc"]];
const classOf = (period) => (PERIODS.find((p) => p[0] === period) || PERIODS[0])[1];
const ROUND = 240, GAP = 10;
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
    timers: { bell: blankTimer(), round: blankTimer(), free: Object.assign(blankTimer(), { dur: 300 }) }, tools: defaultTools() };

let mode = "remote", signedIn = false, sig = "", writeState = null, SEAL = "brand/calera-seal.webp";

function writer(path) {
    let busy = false, next = null;
    const w = function (d) {
        next = d; if (busy) return; busy = true;
        (async function () {
            while (next) { const x = next; next = null; try { await store.save(path, x); } catch (e) { setStatus("Could not save (" + ((e && e.code) || "connection") + ")"); } }
            busy = false;
        })();
    };
    w.busy = () => busy || !!next;
    return w;
}
function setStatus(t) { const s = $("status"); if (s) { s.textContent = t; s.dataset.state = (t === "Live" || t === "This device only") ? "ok" : (t.startsWith("Connecting") || t.startsWith("Still") ? "wait" : "bad"); } }
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
    seg($("screens"), SCREENS, S.screen, (id) => { S.screen = id; S.show = false; push(); });
    const sel = $("weekSel"); sel.textContent = "";
    WEEKS.forEach((x) => { const o = el("option", null, x.label + " · " + x.dates); o.value = x.id; sel.appendChild(o); });
    sel.value = w.id; $("weekField").hidden = WEEKS.length < 2;
    const fn = $("flowNext"); if (fn) { fn.textContent = flowLabel(); const dead = !["agenda", "today", "bell", "notes"].includes(S.screen) || fn.textContent === "Next"; fn.disabled = dead; $("flowBack").disabled = !["today", "bell", "notes", "speed"].includes(S.screen); }
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
    if (Wd < 700) { sw = Wd; sh = H; }
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
    if (kind === "round") { const r = el("p", "round"); r.id = "round"; host.appendChild(r); }
    host.appendChild(bar); host.appendChild(tb);
    host.dataset.kind = kind; host.id = "tcard";
}
function timerCard(kind, title) { const k = card(title); k.i.classList.add("timer"); timerParts(kind, k.i); return k.c; }
function secsFor(kind) { if (kind === "free") return S.timers.free.dur || 300; const l = L(); return (l && l.bellSeconds) || 300; }
const fmt = (r) => Math.floor(r / 60) + ":" + ("0" + (r % 60)).slice(-2);

let audio = null, lastPhase = "";
function unlockSound() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (e) { /* no sound on this device */ } }
function beep(times) {
    if (!audio) return;
    try { for (let n = 0; n < times; n++) { const o = audio.createOscillator(), g = audio.createGain(), at = audio.currentTime + n * 0.35; o.frequency.value = 880; g.gain.setValueAtTime(0.25, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.3); o.connect(g); g.connect(audio.destination); o.start(at); o.stop(at + 0.3); } } catch (e) { /* ignore */ }
}
function tick() {
    const tc = $("tcard"); if (!tc) { lastPhase = ""; return; }
    const kind = tc.dataset.kind, t = S.timers[kind], ms = t.running ? now() - t.t0 : t.elapsed, e = Math.max(0, Math.floor(ms / 1000));
    const c = $("clock"), bar = $("tbar"); let txt, hot, frac, phase;
    if (kind === "round") {
        const x = e % (ROUND + GAP), n = Math.floor(e / (ROUND + GAP)) + 1;
        if (x < ROUND) { const rr = ROUND - x; txt = fmt(rr); hot = rr <= 30; frac = rr / ROUND; phase = "work" + n; }
        else { const g = ROUND + GAP - x; txt = "Rotate! " + g; hot = true; frac = (GAP - g) / GAP; phase = "rotate" + n; }
        $("round").textContent = "Round " + n;
    } else {
        const T = secsFor(kind), r = Math.max(0, T - e); txt = r > 0 ? fmt(r) : "Time!"; hot = r <= Math.min(60, T / 4); frac = r / T; phase = r > 0 ? "run" : "done";
    }
    if (t.running && lastPhase && phase !== lastPhase && (phase === "done" || phase.startsWith("rotate"))) beep(phase === "done" ? 3 : 2);
    lastPhase = phase;
    c.textContent = txt; c.classList.toggle("hot", hot); bar.classList.toggle("hot", hot); bar.firstChild.style.width = (frac * 100) + "%";
    $("tgo").textContent = t.running ? "Pause" : (t.elapsed > 0 ? "Resume" : "Start");
}

function skeleton() {
    const k = el("div", "skel"); k.setAttribute("aria-busy", "true"); k.setAttribute("aria-label", "Getting today's lesson");
    k.appendChild(el("div", "skb hd")); const b = el("div", "skbody"); ["w70", "w90", "w55"].forEach((c) => b.appendChild(el("div", "skb " + c))); k.appendChild(b); return k;
}
function render() {
    if (!synced) { const st = $("screenHost"); if (!st.querySelector(".skel")) { st.textContent = ""; st.appendChild(skeleton()); } return; }
    buildControls();
    const l = L(), d = D(), ns = JSON.stringify([S.week, S.period, S.cls, S.day, S.screen, S.prob, S.show, S.note, S.step, S.timers.free.dur, signedIn]);
    renderDock();
    if (ns === sig) { renderLayer(); tick(); tickTools(toolApi); return; }
    sig = ns; lastPhase = "";
    const st = $("screenHost"); st.textContent = ""; canvas = null; ctx = null;
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
        g2.appendChild(k2.c); g2.appendChild(timerCard("round", "Round Timer · 4:00, then rotate")); g2.appendChild(weekCard()); g2.appendChild(ltBox(sp.lt)); st.appendChild(g2);
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
            const cv = el("div", "cv" + (gridOn ? " grid" : "")); cv.id = "cv"; canvas = el("canvas"); cv.appendChild(canvas);
            right.appendChild(cv); right.appendChild(toolbar()); body.appendChild(right); st.appendChild(body); bindCanvas(); sizeCanvas();
            list.scrollTop = list.scrollHeight; // keep the newest step in view
        }
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
        const cv = el("div", "cv" + (gridOn ? " grid" : "")); cv.id = "cv"; canvas = el("canvas"); cv.appendChild(canvas);
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
let canvas = null, ctx = null, strokes = [], cur = null, pen = "ink", size = 1, erasing = false, gridOn = false, inkKey = "", inkUnsub = null, inkWrite = null, clearArm = 0;
const PENS = { ink: "--pen-ink", blue: "--pen-blue", red: "--pen-red", green: "--pen-green" }, SIZES = [3, 6, 11];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function toolbar() {
    const t = el("div", "tools"); t.id = "tools";
    Object.keys(PENS).forEach((k) => { const b = el("button", "sw"); b.type = "button"; b.style.background = css(PENS[k]); b.setAttribute("aria-label", k + " pen"); b.setAttribute("aria-pressed", String(!erasing && pen === k)); b.onclick = () => { pen = k; erasing = false; retool(); }; t.appendChild(b); });
    ["Thin", "Medium", "Thick"].forEach((n, i) => { const b = el("button", null, n); b.type = "button"; b.setAttribute("aria-pressed", String(size === i)); b.onclick = () => { size = i; retool(); }; t.appendChild(b); });
    const er = el("button", null, "Eraser"); er.type = "button"; er.setAttribute("aria-pressed", String(erasing)); er.onclick = () => { erasing = !erasing; retool(); }; t.appendChild(er);
    const un = el("button", null, "Undo"); un.type = "button"; un.onclick = () => { if (strokes.length) { strokes.pop(); redraw(); saveInk(); } }; t.appendChild(un);
    const cl = el("button", null, "Clear"); cl.type = "button";
    cl.onclick = () => { if (Date.now() - clearArm < 3000) { strokes = []; redraw(); saveInk(); cl.textContent = "Clear"; clearArm = 0; } else { clearArm = Date.now(); cl.textContent = "Tap again to clear"; setTimeout(() => { cl.textContent = "Clear"; }, 3000); } };
    t.appendChild(cl);
    const gr = el("button", null, "Grid"); gr.type = "button"; gr.setAttribute("aria-pressed", String(gridOn)); gr.onclick = () => { gridOn = !gridOn; $("cv").classList.toggle("grid", gridOn); gr.setAttribute("aria-pressed", String(gridOn)); }; t.appendChild(gr);
    const n = el("span", "note"); n.id = "inknote"; t.appendChild(n); return t;
}
function retool() { const old = $("tools"); if (old) old.parentNode.replaceChild(toolbar(), old); }
function sizeCanvas() { if (!canvas) return; const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); if (r.width < 2) return; canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); ctx = canvas.getContext("2d"); redraw(); }
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
    canvas.addEventListener("pointerdown", (e) => { if (e.button) return; e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } const p = pt(e); cur = { c: pen, w: size, e: erasing ? 1 : 0, p: [p[0], p[1]] }; redraw(); });
    canvas.addEventListener("pointermove", (e) => { if (!cur) return; const p = pt(e), a = cur.p, n = a.length; if (Math.abs(p[0] - a[n - 2]) + Math.abs(p[1] - a[n - 1]) < 14) return; a.push(p[0], p[1]); redraw(); });
    const end = () => { if (!cur) return; strokes.push(cur); cur = null; redraw(); saveInk(); };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
}
function note(t) { const n = $("inknote"); if (n) n.textContent = t; }
function saveInk() {
    if (!inkWrite) return; const body = { strokes, at: Date.now() };
    if (JSON.stringify(body).length > 700000) { note("This board is full. Clear it to keep saving."); return; }
    note(""); inkWrite(JSON.parse(JSON.stringify(body)));
}
function watchInk() {
    const key = canvas ? [S.week, S.period, "d" + S.day, S.screen === "notes" ? "n" + S.note : ((S.screen === "bell" && D()) ? "p" + S.prob : "blank")].join("_") : "";
    if (key === inkKey) return; inkKey = key; if (inkUnsub) { inkUnsub(); inkUnsub = null; } inkWrite = null; strokes = []; cur = null; redraw();
    if (!key || !signedIn) return;
    inkWrite = writer("ink/" + key);
    inkUnsub = store.watch("ink/" + key, (snap) => { if (key !== inkKey || snap.pending || cur || (inkWrite && inkWrite.busy())) return; const dd = snap.exists && snap.data; strokes = dd && Array.isArray(dd.strokes) ? JSON.parse(JSON.stringify(dd.strokes)) : []; redraw(); }, () => note("Saved drawings are not available right now."));
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
    ["bell", "round", "free"].forEach((k) => { const t = d.timers && d.timers[k]; if (t) { S.timers[k] = { running: !!t.running, t0: +t.t0 || 0, elapsed: +t.elapsed || 0 }; if (k === "free") S.timers.free.dur = +t.dur || 300; } });
}
/* One-tap lesson flow: Weekly Agenda -> Today -> each bellringer problem and its answer -> the day's activity. */
function isSpeedDay() { const d = D(); return !!d && /speed dating/i.test((d.agendaLine || "") + " " + (d.agenda || []).join(" ")); }
function flow(n) {
    const d = D(), len = (d && d.problems && d.problems.length) || 0, frames = notesFrames(d), hasNotes = frames.length > 0;
    const afterBell = () => { if (hasNotes) { S.screen = "notes"; S.note = 0; S.step = 0; S.show = false; } else if (isSpeedDay()) { S.screen = "speed"; S.show = false; } else { S.screen = "today"; S.show = false; } };
    if (n > 0) {
        if (S.screen === "agenda") S.screen = "today";
        else if (S.screen === "today") { if (len) { S.screen = "bell"; S.prob = 0; S.show = false; } else if (hasNotes || isSpeedDay()) afterBell(); else return; }
        else if (S.screen === "bell") { if (!S.show && len) S.show = true; else if (S.prob < len - 1) { S.prob++; S.show = false; } else afterBell(); }
        else if (S.screen === "notes" && hasNotes) {
            const f = frames[Math.min(S.note, frames.length - 1)];
            if (!f.open && S.step < f.lines.length) S.step++;
            else if (f.ans && !S.show) S.show = true;
            else if (S.note < frames.length - 1) { S.note++; S.step = 0; S.show = false; }
            else if (isSpeedDay()) { S.screen = "speed"; S.show = false; } else return;
        }
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
        else if (S.screen === "speed") { if (hasNotes) { S.screen = "notes"; S.note = frames.length - 1; S.step = frames[S.note].lines.length; S.show = false; } else if (len) { S.screen = "bell"; S.prob = len - 1; S.show = true; } else S.screen = "today"; }
        else return;
    }
    push();
}
function flowLabel() {
    const d = D(), len = (d && d.problems && d.problems.length) || 0, frames = notesFrames(d), hasNotes = frames.length > 0;
    const after = hasNotes ? "Next: Guided Notes" : (isSpeedDay() ? "Next: Speed Dating" : "Next: Back to Today");
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
    return "Next";
}
let wake = null;
async function keepAwake() { try { if ("wakeLock" in navigator && !wake && document.visibilityState === "visible") { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) { /* not supported or not allowed: the screen follows the device's own sleep setting */ } }

window.addEventListener("error", (e) => setStatus("Error: " + (e.message || "script problem")));
window.addEventListener("unhandledrejection", (e) => setStatus("Error: " + ((e.reason && (e.reason.code || e.reason.message)) || "request failed")));

export async function startApp(opts) {
    mode = (opts && opts.mode) || "remote";
    store = (opts && opts.store) || await import("./boardStore.js?v=25");
    const guest = mode === "sub";
    document.body.classList.toggle("board", mode === "board");
    $("periodSel").onchange = function () { S.period = this.value; S.cls = classOf(this.value); resetPos(); push(); };
    document.addEventListener("click", (e) => { document.querySelectorAll("details.acct[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
    $("weekSel").onchange = function () { S.week = this.value; resetPos(); push(); };
    $("boardBtn").onclick = () => { document.body.classList.add("board"); unlockSound(); try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ok */ } fit(); };
    $("exit").onclick = () => { document.body.classList.remove("board"); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ok */ } fit(); };
    $("signOut").onclick = async () => { try { await store.signOut(); } finally { location.replace("login.html"); } };
    window.addEventListener("resize", fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe($("wrap")); document.addEventListener("fullscreenchange", () => setTimeout(fit, 60));
    document.addEventListener("pointerdown", unlockSound, { once: true });
    $("flowNext").onclick = () => flow(1); $("flowBack").onclick = () => flow(-1);
    keepAwake(); document.addEventListener("visibilitychange", keepAwake); document.addEventListener("pointerdown", keepAwake);
    document.addEventListener("keydown", (e) => { if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); flow(1); } else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); flow(-1); } else if (e.key === "a" || e.key === "A") { if (S.screen === "bell" || S.screen === "notes") { S.show = !S.show; push(); } } });
    setInterval(() => { if (!synced) return; tick(); tickTools(toolApi); }, 250);
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
    signedIn = true; $("who").textContent = guest ? "Guest teacher view, no sign-in" : (user.name ? "Signed in as " + user.name : "Signed in");
    writeState = writer("board/state");
    store.watch("rosters/all", (snap) => { const p = (snap.exists && snap.data && snap.data.periods) || {}; ROSTERS = {}; Object.keys(p).forEach((k) => { if (Array.isArray(p[k])) ROSTERS[k] = p[k].map((n) => String(n).slice(0, 60)); }); renderLayer(); }, () => {});
    store.clockSkew().then((ms) => { skew = ms; tick(); });
    const slow = setTimeout(() => { mark("board-slow", ms()); setStatus("Still connecting…"); arrived(); render(); }, 10000);   // never leave the teacher on a blank board
    let first = true, gotServer = false;
    store.watch("board/state", (snap) => {
        if (!gotServer && !snap.fromCache) { gotServer = true; mark("board-server", ms()); }
        if (snap.pending || (writeState && writeState.busy())) return;
        if (!synced) mark("board-shown", ms() + (snap.fromCache ? " (saved copy)" : " (server)"));
        clearTimeout(slow); setStatus(guest ? "This device only" : "Live");
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
            if (mode === "remote" && pq && PERIODS.some((p) => p[0] === pq) && pq !== S.period) { S.period = pq; S.cls = classOf(pq); resetPos(); S.screen = "today"; changed = true; }
            else if (mode === "remote" && c && W().classes[c] && (c !== S.cls)) { S.cls = c; S.period = (PERIODS.find((p) => p[1] === c) || [S.period])[0]; resetPos(); changed = true; }
            if (mode === "remote" && di >= 0 && di !== S.day) { S.day = di; resetPos(); changed = true; }
            if (changed) { push(); return; }
        }
        render();
    }, (e) => { clearTimeout(slow); setStatus("Sync is off (" + ((e && e.code) || "error") + ")"); arrived(); render(); });
    render();
}
