/* ==========================================
   Calera Math — the board app.
   board.html runs it with mode "board" (the Promethean: controls hidden),
   remote.html with mode "remote" (the Chromebook: controls shown).
   Both read and write the same state document, so whatever one device
   changes, the other follows. Lesson content comes from data/weeks.js.
========================================== */
import { WEEKS } from "../data/weeks.js?v=5";
import * as store from "./boardStore.js?v=5";
import { buildWidget, tickTools, defaultTools, mergeTools, TOOL_LIST } from "./boardTools.js?v=5";

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

const SCREENS = [["agenda", "Weekly Agenda"], ["today", "Today"], ["bell", "Bellringer"], ["speed", "Speed Dating"], ["timer", "Timer"], ["tools", "Tools"], ["blank", "Whiteboard"]];
const DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const ROUND = 240, GAP = 10;
const PRESETS = [1, 2, 3, 5, 10, 15];
let skew = 0; // this device's clock vs the shared clock, in ms
const now = () => Date.now() + skew;
const blankTimer = () => ({ running: false, t0: 0, elapsed: 0 });

function defaultWeek() {
    const today = new Date().toISOString().slice(0, 10);
    let pick = WEEKS[0];
    for (const w of WEEKS) if (!w.monday || w.monday <= today) pick = w;
    return pick.id;
}
const wd = new Date().getDay();
const S = { week: defaultWeek(), cls: "8th", day: (wd >= 1 && wd <= 5) ? wd - 1 : 0, screen: "today", prob: 0, show: false,
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
function setStatus(t) { const s = $("status"); if (s) s.textContent = t; }
function push() { render(); if (writeState) writeState(JSON.parse(JSON.stringify(S))); }
let quietTimer = 0;
function quiet() { clearTimeout(quietTimer); quietTimer = setTimeout(() => { if (writeState) writeState(JSON.parse(JSON.stringify(S))); }, 500); } // save typing without redrawing
const toolApi = { S, el, push, quiet, now, card };
function toolSig() { const t = Object.assign({}, S.tools); delete t.text; return JSON.stringify(t); }
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
    seg($("classes"), Object.entries(w.classes).map(([id, c]) => [id, c.label]), S.cls, (id) => { S.cls = id; S.prob = 0; S.show = false; push(); });
    seg($("days"), DK.map((k, i) => [i, k]), S.day, (i) => { S.day = i; S.prob = 0; S.show = false; push(); });
    seg($("screens"), SCREENS, S.screen, (id) => { S.screen = id; S.show = false; push(); });
    const sel = $("weekSel"); sel.textContent = "";
    WEEKS.forEach((x) => { const o = el("option", null, x.label + " · " + x.dates); o.value = x.id; sel.appendChild(o); });
    sel.value = w.id; sel.hidden = WEEKS.length < 2;
    const files = $("files"), l = L();
    if (files) {
        files.textContent = "";
        const links = (l && l.links) || [];
        if (links.length) {
            files.appendChild(el("span", null, "Files:"));
            links.forEach((k) => { const a = el("a", null, k.t); a.href = k.u; a.target = "_blank"; a.rel = "noopener"; files.appendChild(a); });
        }
    }
}

/* ---------- stage ---------- */
function fit() {
    const w = $("wrap"), st = $("stage"), Wd = w.clientWidth - 16, H = w.clientHeight - 16;
    if (Wd < 50 || H < 50) return;
    let sw = Math.min(Wd, H * 16 / 9), sh = sw * 9 / 16;
    if (Wd < 700) { sw = Wd; sh = H; }
    st.style.width = sw + "px"; st.style.height = sh + "px"; st.style.fontSize = Math.max(9, sw / 52) + "px";
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

function render() {
    buildControls();
    const l = L(), d = D(), ns = JSON.stringify([S.week, S.cls, S.day, S.screen, S.prob, S.show, S.timers.free.dur, signedIn]);
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

/* ---------- floating tools (shown over every screen) ---------- */
const DEFAULT_POS = { traffic: [2, 23], work: [20, 23], text: [48, 23], stopwatch: [72, 60], dice: [46, 60], clock: [20, 66], score: [28, 40] };
let topZ = 1;
let layerSig = "", dragging = false;
function posOf(k) { const p = S.tools.pos[k]; if (p) return p; const d = DEFAULT_POS[k] || [10, 30]; return { x: d[0], y: d[1], s: 1 }; }
function renderDock() {
    const dock = $("dock"); if (!dock) return; dock.textContent = ""; dock.appendChild(el("span", null, "Tools:"));
    TOOL_LIST.forEach(([k, label]) => { const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", String(!!S.tools.on[k])); b.onclick = () => { if (S.tools.on[k]) delete S.tools.on[k]; else S.tools.on[k] = true; push(); }; dock.appendChild(b); });
    if (Object.keys(S.tools.on).length) { const c = el("button", "clear", "Hide all"); c.type = "button"; c.onclick = () => { S.tools.on = {}; push(); }; dock.appendChild(c); }
}
function renderLayer() {
    const layer = $("toolLayer"); if (!layer || dragging) return;
    const ns = toolSig(); if (ns === layerSig) return; layerSig = ns;
    const typing = document.activeElement && document.activeElement.id === "toolMsgIn", caret = typing ? document.activeElement.selectionStart : 0;
    layer.textContent = "";
    TOOL_LIST.forEach(([k]) => {
        if (!S.tools.on[k]) return;
        const w = buildWidget(k, toolApi), p = posOf(k); w.classList.add("float");
        w.style.left = p.x + "%"; w.style.top = p.y + "%"; w.style.fontSize = p.s + "em";
        const h = w.querySelector("h3"), x = el("button", "close", "×"); x.type = "button"; x.setAttribute("aria-label", "Hide this tool"); x.onclick = () => { delete S.tools.on[k]; push(); }; h.appendChild(x);
        const grip = el("span", "grip"); grip.setAttribute("aria-hidden", "true"); w.appendChild(grip);
        const stage = $("stage");
        const start = (e, kind) => {
            if (e.target === x) return; e.preventDefault(); dragging = true;
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
    if (typing) { const t = $("toolMsgIn"); if (t) { t.focus(); try { t.setSelectionRange(caret, caret); } catch (e) { /* ok */ } } }
    tickTools(toolApi);
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
    const key = canvas ? [S.week, S.cls, "d" + S.day, (S.screen === "bell" && D()) ? "p" + S.prob : "blank"].join("_") : "";
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
    if (!W().classes[S.cls]) S.cls = Object.keys(W().classes)[0];
    if (!SCREENS.some((x) => x[0] === S.screen)) S.screen = "today";
    if (typeof d.day === "number" && d.day >= 0 && d.day < 5) S.day = d.day;
    if (typeof d.prob === "number") S.prob = d.prob; S.show = !!d.show;
    { const m = mergeTools(d.tools); Object.keys(S.tools).forEach((k) => delete S.tools[k]); Object.assign(S.tools, m); } // keep the same object: widgets hold a reference to it
    ["bell", "round", "free"].forEach((k) => { const t = d.timers && d.timers[k]; if (t) { S.timers[k] = { running: !!t.running, t0: +t.t0 || 0, elapsed: +t.elapsed || 0 }; if (k === "free") S.timers.free.dur = +t.dur || 300; } });
}
function step(n) { const d = D(), len = (d && d.problems && d.problems.length) || 0; if (S.screen !== "bell" || !len) return; S.prob = (S.prob + n + len) % len; S.show = false; push(); }

window.addEventListener("error", (e) => setStatus("Error: " + (e.message || "script problem")));
window.addEventListener("unhandledrejection", (e) => setStatus("Error: " + ((e.reason && (e.reason.code || e.reason.message)) || "request failed")));

export async function startApp(opts) {
    mode = (opts && opts.mode) || "remote";
    document.body.classList.toggle("board", mode === "board");
    $("weekSel").onchange = function () { S.week = this.value; S.prob = 0; S.show = false; push(); };
    $("boardBtn").onclick = () => { document.body.classList.add("board"); unlockSound(); try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ok */ } fit(); };
    $("exit").onclick = () => { document.body.classList.remove("board"); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ok */ } fit(); };
    $("signOut").onclick = async () => { try { await store.signOut(); } finally { location.replace("login.html"); } };
    window.addEventListener("resize", fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe($("wrap")); document.addEventListener("fullscreenchange", () => setTimeout(fit, 60));
    document.addEventListener("pointerdown", unlockSound, { once: true });
    document.addEventListener("keydown", (e) => { if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); else if (e.key === "a" || e.key === "A") { if (S.screen === "bell") { S.show = !S.show; push(); } } });
    setInterval(() => { tick(); tickTools(toolApi); }, 250);
    fit(); render();

    const user = await store.ready();
    if (!user) { location.replace("login.html"); return; }
    signedIn = true; $("who").textContent = user.name ? "Signed in as " + user.name : "Signed in";
    writeState = writer("board/state");
    store.clockSkew().then((ms) => { skew = ms; tick(); });
    const slow = setTimeout(() => setStatus("Still connecting…"), 10000);
    let first = true;
    store.watch("board/state", (snap) => {
        if (snap.pending || (writeState && writeState.busy())) return;
        clearTimeout(slow); setStatus("In sync");
        if (snap.exists) applyState(snap.data);
        if (first) {
            first = false;
            const q = new URLSearchParams(location.search), c = q.get("class"), dy = q.get("day"), di = DK.map((k) => k.toLowerCase()).indexOf((dy || "").toLowerCase());
            let changed = !snap.exists;
            if (mode === "remote" && c && W().classes[c] && (c !== S.cls)) { S.cls = c; S.prob = 0; S.show = false; changed = true; }
            if (mode === "remote" && di >= 0 && di !== S.day) { S.day = di; S.prob = 0; S.show = false; changed = true; }
            if (changed) { push(); return; }
        }
        render();
    }, (e) => { clearTimeout(slow); setStatus("Sync is off (" + ((e && e.code) || "error") + ")"); });
    render();
}
