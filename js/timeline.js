/* ==========================================
   Anchor Board — Standards Timeline page (timeline.html). Logic lives in js/timelineCore.js.
   Four lanes (nine weeks), one card per Alabama standard. Drag a card by its handle (mouse, touch or pen) to change
   the order; with the keyboard, focus the handle and use the arrow keys. Tap the status to mark it.
   Saves: order -> teacher/{uid}/standards/timeline; marks -> teacher/{uid}/standards/progress (same as the Standards page).
   Two views (Nov 24): Map (default, js/timelineMap.js) shows the year as a road with a stop per unit, for following
   along; Cards is the four lanes, for changing the order and marking status. ?view=cards opens the cards.
   ?demo keeps everything on this device only. ?cls=7th opens a class.
========================================== */
import { STANDARDS } from "../data/standards.js?v=59";
import { SCHOOL_YEAR, today, short, daysLeftInNineWeeks, nineWeeksOf } from "./schoolCal.js?v=59";
import * as T from "./timelineCore.js?v=3";
import { drawMap } from "./timelineMap.js?v=2";
import { mount as mountPick, bankNow } from "./timelinePick.js?v=4";
import { counts as bankCounts, has as inTray } from "./timelineTray.js?v=4";
import * as K from "./timelineLinks.js?v=2";

const demo = new URLSearchParams(location.search).has("demo");
const store = await import(demo ? "./localStore.js?v=57" : "./boardStore.js?v=58");
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
const keep = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
const say = (t) => { $("say").textContent = ""; requestAnimationFrame(() => { $("say").textContent = t; }); };

const CLASSES = [["8th", "8th Grade"], ["7th", "7th Grade"], ["8th-acc", "8th Accelerated"]];
const MARKS = [["", "Not yet"], ["teaching", "Teaching"], ["taught", "Taught"], ["reteach", "Reteach"]];
const MARK_NAME = Object.fromEntries(MARKS);
const ORDN = ["1st", "2nd", "3rd", "4th"];

const q0 = new URLSearchParams(location.search);
let cls = CLASSES.some((c) => c[0] === q0.get("cls")) ? q0.get("cls") : (keep("tl-cls") || keep("std-cls") || "8th");
if (!STANDARDS[cls]) cls = "8th";
const VIEWS = ["map", "cards"];
let view = VIEWS.includes(q0.get("view")) ? q0.get("view") : (VIEWS.includes(keep("tl-view")) ? keep("tl-view") : "map");
let progress = {}, order = {}, floors = {}, menuFor = "";
const pending = { p: false, o: false, f: false };
const timers = { p: 0, o: 0, f: 0 };
const PATHS = { p: "standards/progress", o: "standards/timeline", f: "standards/floors" };

/* ---------- saving (whole doc, like the Standards page) ---------- */
function saveLater(which) {
    pending[which] = true; status("Saving…"); clearTimeout(timers[which]);
    timers[which] = setTimeout(async () => {
        const path = PATHS[which], data = which === "p" ? progress : which === "o" ? order : floors;
        try { await store.save(path, data); pending[which] = false; if (!pending.p && !pending.o && !pending.f) status(demo ? "This device only" : "Saved", "ok"); }
        catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
    }, 500);
}
window.addEventListener("beforeunload", (e) => { if (pending.p || pending.o || pending.f) { e.preventDefault(); e.returnValue = ""; } });

const lanes = () => T.lanesFor(cls, order[cls]);
const markOf = (code) => ((progress[cls] || {})[code] || {}).s || "";
function setMark(code, s) {
    const p = progress[cls] = progress[cls] || {};
    if (s) p[code] = { s, d: today() }; else delete p[code];
    menuFor = ""; saveLater("p"); draw(); say(code + " marked " + MARK_NAME[s]);
}
function setLanes(next, msg) {
    if (T.isDefault(cls, next)) delete order[cls]; else order[cls] = { lanes: T.toSaved(next), at: Date.now() };
    saveLater("o"); draw(); if (msg) say(msg);
}

const stdOf = (code) => STANDARDS[cls].standards.find((s) => s.code === code);
const chip = (kind, text) => el("span", "pl-chip k-" + kind, text);
const cut = (t, n) => (t.length > n ? t.slice(0, n - 1).trim() + "…" : t);

/* ---------- a card ---------- */
function card(code, li, idx, nowLane) {
    const s = stdOf(code); if (!s) return null;
    const st = markOf(code), u = T.unitOf(cls, code), C = STANDARDS[cls];
    const c = el("article", "tl-card s-" + (st || "none") + (s.critical ? " crit" : ""));
    c.dataset.code = code; c.id = "tl-" + code.replace(/[^A-Za-z0-9]+/g, "-");
    const h = el("button", "tl-handle"); h.type = "button";
    h.setAttribute("aria-label", "Move " + code + ". Arrow keys move it up, down or to another nine weeks.");
    h.title = "Drag to move";
    h.innerHTML = '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></g></svg>';
    h.addEventListener("pointerdown", (e) => startDrag(e, c, code));
    h.addEventListener("keydown", (e) => keyMove(e, code));
    const body = el("div", "tl-body");
    const top = el("div", "tl-top");
    const a = el("a", "st-code tl-code", code); a.href = "standards.html?cls=" + encodeURIComponent(cls) + "&q=" + encodeURIComponent(code); a.title = "Open " + code + " on the Standards page";
    top.appendChild(a);
    if (s.critical) top.appendChild(chip("crit", "★"));
    if (u) top.appendChild(el("span", "tl-unit", (C.unitWord || "Unit") + " " + u.id));
    else top.appendChild(el("span", "tl-unit", "No unit doc"));
    body.appendChild(top);
    // Tap the wording (or Problems) to open the problem picker for this standard.
    const t = el("button", "tl-text", cut(s.text, 120)); t.type = "button"; t.title = s.text + "\n\nShow problems for " + code; t.dataset.pick = code;
    t.onclick = () => pick.open(code); body.appendChild(t);
    // status: one button that opens the four marks
    const sb = el("div", "tl-status");
    if (menuFor === code) {
        const g = el("div", "st-marks tl-marks"); g.setAttribute("role", "group"); g.setAttribute("aria-label", "Status for " + code);
        MARKS.forEach(([k, label]) => { const b = el("button", "m-" + (k || "none"), label); b.type = "button"; b.setAttribute("aria-pressed", String(st === k)); b.onclick = () => setMark(code, k); g.appendChild(b); });
        sb.appendChild(g);
    } else {
        const b = el("button", "tl-pill p-" + (st || "none"), MARK_NAME[st] || "Not yet"); b.type = "button";
        b.setAttribute("aria-label", code + ": " + (MARK_NAME[st] || "Not yet") + ". Change status");
        b.onclick = () => { menuFor = code; draw(); const f = document.querySelector("#tl-" + code.replace(/[^A-Za-z0-9]+/g, "-") + " .tl-marks button[aria-pressed=true]"); if (f) f.focus(); };
        sb.appendChild(b);
        const when = ((progress[cls] || {})[code] || {}).d;
        if (st && when) sb.appendChild(el("span", "tl-when", short(when, { month: "short", day: "numeric" })));
        if (st !== "taught" && st !== "teaching" && nowLane >= 0 && li < nowLane) sb.appendChild(chip("early", "Behind plan"));
    }
    const B = bankNow(), n = B ? bankCounts(B, cls, code).all : null;
    const pb = el("button", "tl-probs" + (pick && inTray(pick.tray(), code) ? " in" : ""), pick && inTray(pick.tray(), code) ? "In tray ✓" : n == null ? "Problems" : n + " problems");
    pb.type = "button"; pb.setAttribute("aria-label", "Problems for " + code); pb.onclick = () => pick.open(code);
    sb.appendChild(pb);
    body.appendChild(sb);
    body.appendChild(linksLine(code));
    c.append(h, body);
    return c;
}

/* ---------- builds on + floor skills (data/stdLinks.js, js/timelineLinks.js) ---------- */
const markIn = (c2, code) => ((progress[c2] || {})[code] || {}).s || "";
const gradeOf = (code) => (/^7\./.test(code) ? "7th" : /^8\./.test(code) ? "8th" : "");
/** A need as text: its code, plus ✓ when taught in this class, or its grade when it is an earlier grade's standard. */
function needLabel(code) {
    if (K.inClass(cls, code)) return code + (markIn(cls, code) === "taught" ? " ✓" : "");
    return code + " (" + gradeOf(code) + " grade)";
}
function linksLine(code) {
    const box = el("div", "tl-links");
    const needs = K.needsOf(code), late = K.needsAfter(cls, lanes(), code);
    if (late.length) { const w = chip("early", "⚠ " + late.join(", ") + " comes later"); w.title = code + " builds on " + late.join(", ") + ", which is later in your order."; box.appendChild(w); }
    if (needs.length) { const p = el("span", "tl-needs"); p.appendChild(el("b", null, "Builds on ")); p.appendChild(document.createTextNode(needs.map(needLabel).join(", "))); box.appendChild(p); }
    const fl = K.floorOf(cls, code, floors);
    if (fl.length) {
        const f = el("div", "tl-floor"); f.appendChild(el("b", null, "Floor"));
        fl.forEach((id) => { const b = el("button", "tl-fchip", K.floorName(id)); b.type = "button"; b.title = "Problems for this floor skill"; b.onclick = () => pick.open(id); f.appendChild(b); });
        box.appendChild(f);
    }
    return box;
}
function setFloors(next) { floors = next; saveLater("f"); draw(); pick.redraw(); }

/* ---------- the two views ---------- */
const LEDE = {
    map: "Your year as a road: each stop is a unit, in your teaching order. Green stops are taught and the amber pin is where you are now. Tap a standard to see its problems.",
    cards: "Every Alabama standard in teaching order, one lane per nine weeks. Drag a card by its handle to change the order. Tap the status to mark it. Tap a standard to see its problems and add it to an assignment.",
};
function setView(v) {
    if (v === view) return;
    view = v; keep("tl-view", v); menuFor = ""; draw();
    const u = new URL(location.href); if (v === "map") u.searchParams.delete("view"); else u.searchParams.set("view", v); history.replaceState(null, "", u);
    say(v === "map" ? "Map view" : "Cards view");
}
document.querySelectorAll("#view button").forEach((b) => { b.onclick = () => setView(b.dataset.view); });
const md = (s) => short(s, { month: "short", day: "numeric" });
let marksIn = false;   // the map waits for the marks, so it never shows "You are here" at the wrong stop
function mapView(L) {
    if (!marksIn) { $("map").innerHTML = '<div class="tm-skel" aria-hidden="true"><i class="a"></i><i></i><i></i><i></i></div>'; return; }
    const plan = T.PLAN[cls], nw = nineWeeksOf(today()), nowLane = nw ? nw.n - 1 : -1;
    const Q = SCHOOL_YEAR.nineWeeks, last = Q[Q.length - 1];
    drawMap($("map"), {
        cls, model: T.mapStops(cls, L, progress),
        dates: Q.map((q) => md(q.start) + " – " + md(q.end)),
        notes: plan ? plan.notes : null,
        nowLane, nowLeft: nowLane >= 0 ? daysLeftInNineWeeks(today()) : 0,
        startLabel: "First day · " + md(Q[0].start),
        endLabel: plan ? "Then: ACAP spiral review" : "Last day · " + md(last.end),
        openStd: (code) => pick.open(code),
        edit: () => setView("cards"),
    });
}

/* ---------- lanes ---------- */
function draw() {
    seg();
    document.querySelectorAll("#view button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    $("lede").textContent = LEDE[view];
    const C = STANDARDS[cls], L = lanes(), plan = T.PLAN[cls];
    const isMap = view === "map";
    $("map").hidden = !isMap; $("lanes").hidden = isMap;
    const def0 = T.isDefault(cls, L);
    $("orderNote").textContent = def0 ? (T.isLocked(cls) ? "Locked order v" + T.PLAN[cls].v : "District unit order, split across the year") : "Your order" + (order[cls] && order[cls].at ? " · changed " + new Date(order[cls].at).toLocaleDateString([], { month: "short", day: "numeric" }) : "");
    if (isMap) { $("reset").hidden = true; $("next").hidden = true; $("lanes").textContent = ""; mapView(L); return; }
    $("map").textContent = "";
    const box = $("lanes"); box.textContent = "";
    const nw = nineWeeksOf(today()), nowLane = nw ? nw.n - 1 : -1;
    L.forEach((lane, li) => {
        const q = SCHOOL_YEAR.nineWeeks[li];
        const col = el("section", "tl-lane" + (li === nowLane ? " now" : "")); col.dataset.lane = li;
        col.setAttribute("aria-label", T.LANE_NAMES[li]);
        const head = el("header", "tl-lhead");
        const tt = el("div", "tl-ltitle"); tt.appendChild(el("h2", null, T.LANE_NAMES[li]));
        if (li === nowLane) tt.appendChild(chip("work", "Now · " + daysLeftInNineWeeks(today()) + " school days left"));
        head.appendChild(tt);
        if (q) head.appendChild(el("p", "tl-dates", short(q.start, { month: "short", day: "numeric" }) + " – " + short(q.end, { month: "short", day: "numeric" })));
        if (plan && plan.notes[li]) head.appendChild(el("p", "tl-note", plan.notes[li]));
        const d = T.laneDone(lane, cls, progress);
        head.appendChild(el("p", "tl-frac", d.taught + " of " + d.total + " taught"));
        const bar = el("div", "pl-prog"); const bi = el("i"); bi.style.width = (d.total ? (100 * d.taught) / d.total : 0) + "%"; bar.appendChild(bi); head.appendChild(bar);
        col.appendChild(head);
        const list = el("div", "tl-list"); list.dataset.lane = li;
        lane.forEach((code, idx) => { const c = card(code, li, idx, nowLane); if (c) list.appendChild(c); });
        if (!lane.length) list.appendChild(el("p", "tl-empty", "Drag a standard here."));
        col.appendChild(list);
        if (li === 3 && plan) col.appendChild(el("p", "tl-tail", "Then: ACAP spiral review"));
        box.appendChild(col);
    });
    const def = T.isDefault(cls, L);
    $("orderNote").textContent = def ? (T.isLocked(cls) ? "Locked order v" + T.PLAN[cls].v : "District unit order, split across the year") : "Your order" + (order[cls] && order[cls].at ? " · changed " + new Date(order[cls].at).toLocaleDateString([], { month: "short", day: "numeric" }) : "");
    $("reset").hidden = def;
    $("reset").textContent = T.isLocked(cls) ? "Reset to the locked order" : "Reset to the district order";
    nextPanel(L);
}

function seg() {
    const box = $("classes"); box.textContent = "";
    CLASSES.forEach(([k, label]) => { const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", String(k === cls)); b.onclick = () => { cls = k; keep("tl-cls", k); menuFor = ""; draw(); pick.redraw(); }; box.appendChild(b); });
}

/* ---------- Next up, in the Timeline's order ---------- */
function findCard(code) {
    const n = document.getElementById("tl-" + code.replace(/[^A-Za-z0-9]+/g, "-")); if (!n) return;
    n.scrollIntoView({ behavior: "smooth", block: "center" }); n.classList.add("tl-flash"); setTimeout(() => n.classList.remove("tl-flash"), 1700);
}
function nextPanel(L) {
    const box = $("next"); box.textContent = "";
    const n = T.timelineNext(cls, L, progress); if (!n) { box.hidden = true; return; } box.hidden = false;
    const head = el("div", "st-nhead"), t = el("div");
    t.appendChild(el("h2", null, "Next up"));
    const d = today(), q = nineWeeksOf(d), left = q ? daysLeftInNineWeeks(d) : 0, meta = [];
    if (q) meta.push(left + (left === 1 ? " school day" : " school days") + " left in the " + ORDN[q.n - 1] + " nine weeks");
    meta.push(n.critLeft + " critical (★) " + (n.critLeft === 1 ? "standard" : "standards") + " not taught yet");
    t.appendChild(el("p", "st-nmeta", meta.join(" · "))); head.appendChild(t); box.appendChild(head);
    if (n.current) {
        const now = el("p", "st-nnow"); now.appendChild(el("b", null, "Now: "));
        now.appendChild(document.createTextNode(T.LANE_NAMES[n.current.lane] + (n.current.unit ? ", " + n.unitWord + " " + n.current.unit.id + ": " + n.current.unit.name : "")));
        if (n.teaching.length) now.appendChild(document.createTextNode(" (teaching " + n.teaching.join(", ") + ")"));
        box.appendChild(now);
    }
    if (!n.next.length) box.appendChild(el("p", "st-nnow", "Every standard from here on is marked Teaching or Taught."));
    const list = el("ol", "st-nlist");
    n.next.slice(0, 4).forEach((x) => {
        const li = el("li"), top = el("div", "st-ntop");
        const code = el("button", "st-code st-ncode", x.code); code.type = "button"; code.title = "Show " + x.code + " on the timeline"; code.onclick = () => findCard(x.code);
        top.appendChild(code);
        if (x.critical) top.appendChild(chip("crit", "★ Critical"));
        top.appendChild(el("span", "st-nunit", T.LANE_NAMES[x.lane] + (x.unit ? " · " + n.unitWord + " " + x.unit.id + ": " + x.unit.name : "")));
        const go = el("button", "st-nstart", "Start teaching"); go.type = "button"; go.onclick = () => setMark(x.code, "teaching");
        top.appendChild(go); li.appendChild(top);
        li.appendChild(el("p", "st-ntext", cut(x.text, 150)));
        const nd = K.needsOf(x.code), fl = K.floorOf(cls, x.code, floors);
        if (nd.length || fl.length) li.appendChild(el("p", "tl-nneeds", [nd.length ? "Builds on " + nd.map(needLabel).join(", ") : "", fl.length ? "Floor: " + fl.map(K.floorName).join(", ") : ""].filter(Boolean).join(" · ")));
        list.appendChild(li);
    });
    if (n.next.length) box.appendChild(list);
    if (n.next.length > 4) box.appendChild(el("p", "st-nmore", "Then " + (n.next.length - 4) + " more, in your timeline order."));
    const links = (label, codes) => {
        if (!codes.length) return; const p = el("p", "st-nopen"); p.appendChild(el("b", null, label));
        codes.forEach((c, i) => { const a = el("button", "st-nlink", c); a.type = "button"; a.onclick = () => findCard(c); p.appendChild(a); if (i < codes.length - 1) p.appendChild(document.createTextNode(", ")); });
        box.appendChild(p);
    };
    links("Marked Reteach: ", n.reteach);
    links("Left open earlier in the timeline: ", n.left.map((x) => x.code));
}

/* ---------- keyboard moves ---------- */
function keyMove(e, code) {
    const L = lanes(), at = T.whereIs(L, code); if (!at) return;
    let to = null;
    if (e.key === "ArrowUp" && (at.index > 0 || at.lane > 0)) to = at.index > 0 ? [at.lane, at.index - 1] : [at.lane - 1, L[at.lane - 1].length];
    if (e.key === "ArrowDown" && (at.index < L[at.lane].length - 1 || at.lane < 3)) to = at.index < L[at.lane].length - 1 ? [at.lane, at.index + 1] : [at.lane + 1, 0];
    if (e.key === "ArrowLeft" && at.lane > 0) to = [at.lane - 1, Math.min(at.index, L[at.lane - 1].length)];
    if (e.key === "ArrowRight" && at.lane < 3) to = [at.lane + 1, Math.min(at.index, L[at.lane + 1].length)];
    if (!to) return;
    e.preventDefault();
    setLanes(T.moveCard(L, code, to[0], to[1]), code + " moved to " + T.LANE_NAMES[to[0]] + ", position " + (to[1] + 1));
    const h = document.querySelector("#tl-" + code.replace(/[^A-Za-z0-9]+/g, "-") + " .tl-handle"); if (h) h.focus();
}

/* ---------- drag (pointer events: mouse, touch, pen) ---------- */
let drag = null;
function startDrag(e, cardEl, code) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const r = cardEl.getBoundingClientRect();
    const ghost = cardEl.cloneNode(true); ghost.classList.add("tl-ghost"); ghost.removeAttribute("id");
    Object.assign(ghost.style, { width: r.width + "px", left: r.left + "px", top: r.top + "px" });
    document.body.appendChild(ghost);
    const hole = el("div", "tl-hole"); hole.style.height = r.height + "px";
    cardEl.after(hole); cardEl.classList.add("tl-lifted"); cardEl.hidden = true;
    drag = { code, cardEl, ghost, hole, dx: e.clientX - r.left, dy: e.clientY - r.top, y: e.clientY, raf: 0, id: e.pointerId };
    document.body.classList.add("tl-dragging");
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", endDrag); window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("keydown", escDrag);
    scrollLoop();
}
function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    drag.x = e.clientX; drag.y = e.clientY;
    drag.ghost.style.left = e.clientX - drag.dx + "px"; drag.ghost.style.top = e.clientY - drag.dy + "px";
    place(e.clientX, e.clientY);
}
/** Move the drop gap to where the pointer is (also after the page auto-scrolls under a still pointer). */
function place(x, y) {
    const under = document.elementFromPoint(x, y);
    const list = under && (under.closest(".tl-list") || (under.closest(".tl-lane") || {}).querySelector?.(".tl-list"));
    if (!list) return;
    // Judge each card where it would sit without the gap, so the gap does not flicker as it pushes cards down.
    const holeH = drag.hole.parentElement === list ? drag.hole.getBoundingClientRect().height + 8 : 0;
    let past = false, before = null;
    for (const n of list.children) {
        if (n === drag.hole) { past = true; continue; }
        if (!n.classList.contains("tl-card") || n.hidden) continue;
        const b = n.getBoundingClientRect();
        if (y < b.top - (past ? holeH : 0) + b.height / 2) { before = n; break; }
    }
    const empty = list.querySelector(".tl-empty"); if (empty) empty.hidden = true;
    if (before) { if (drag.hole.nextSibling !== before) list.insertBefore(drag.hole, before); }
    else if (list.lastChild !== drag.hole) list.appendChild(drag.hole);
}
function scrollLoop() {
    if (!drag) return;
    const edge = 70, h = window.innerHeight;
    let dy = 0;
    if (drag.y < edge) dy = -Math.ceil((edge - drag.y) / 5);
    else if (drag.y > h - edge) dy = Math.ceil((drag.y - (h - edge)) / 5);
    if (dy) { const before = scrollY; window.scrollBy(0, dy); if (scrollY !== before && drag.x != null) place(drag.x, drag.y); }
    drag.raf = requestAnimationFrame(scrollLoop);
}
function cleanup() {
    window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", endDrag); window.removeEventListener("pointercancel", cancelDrag); window.removeEventListener("keydown", escDrag);
    document.body.classList.remove("tl-dragging");
    if (drag) { cancelAnimationFrame(drag.raf); drag.ghost.remove(); }
}
function endDrag() {
    if (!drag) return;
    const list = drag.hole.parentElement, code = drag.code;
    let to = null;
    if (list && list.classList.contains("tl-list")) {
        const idx = [...list.children].filter((n) => n === drag.hole || (n.classList.contains("tl-card") && !n.hidden)).indexOf(drag.hole);
        to = [+list.dataset.lane, idx];
    }
    drag.hole.remove(); drag.cardEl.hidden = false; cleanup(); drag = null;
    if (!to) { draw(); return; }
    const L = lanes(), at = T.whereIs(L, code);
    if (at && at.lane === to[0] && at.index === to[1]) { draw(); return; }
    setLanes(T.moveCard(L, code, to[0], to[1]), code + " moved to " + T.LANE_NAMES[to[0]] + ", position " + (to[1] + 1));
    requestAnimationFrame(() => { const n = document.getElementById("tl-" + code.replace(/[^A-Za-z0-9]+/g, "-")); if (n) { n.classList.add("tl-flash"); setTimeout(() => n.classList.remove("tl-flash"), 1700); } });
}
function cancelDrag() { if (!drag) return; drag.hole.remove(); drag.cardEl.hidden = false; cleanup(); drag = null; draw(); }
function escDrag(e) { if (e.key === "Escape") cancelDrag(); }

/* ---------- start ---------- */
// Vault Raid sets made from the tray are ordinary question sets (games/s_<id> + games/index), as the Readiness spiral makes them.
let gameSets = null;
async function saveVault(doc, n) {
    if (!gameSets) throw Object.assign(new Error("not loaded"), { code: "your question sets are still loading" });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at = Date.now();
    await store.save("games/s_" + id, Object.assign({ id, at }, doc));
    const meta = { id, title: doc.title, cats: doc.cats.length, clues: n, final: false, per: [], maker: 1, tl: 1, cls, at };
    gameSets = gameSets.filter((x) => x.id !== id).concat([meta]);
    await store.save("games/index", { sets: gameSets, at });
    return id;
}
const pick = mountPick({ cls: () => cls, demo, onChange: () => { if (!drag) draw(); }, floors: () => floors, setFloors, marks: (code) => markIn(cls, code), needLabel, saveVault });

$("reset").onclick = () => {
    if (!confirmReset()) return;
    delete order[cls]; saveLater("o"); draw(); say("Order reset");
};
// Two taps instead of a browser dialog: the first tap arms the button for 4 seconds.
let armed = 0;
function confirmReset() {
    const b = $("reset");
    if (Date.now() < armed) { armed = 0; return true; }
    armed = Date.now() + 4000; const was = b.textContent; b.textContent = "Tap again to reset " + (STANDARDS[cls].course || cls);
    setTimeout(() => { if (armed && Date.now() >= armed) { armed = 0; b.textContent = was; } }, 4100);
    return false;
}
document.addEventListener("click", (e) => { if (menuFor && !e.target.closest(".tl-status")) { menuFor = ""; draw(); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuFor && !drag) { menuFor = ""; draw(); } });
draw();

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    $("who").textContent = demo ? "This device only, nothing is saved" : "Signed in as " + user.name;
    let got = 0; const live = () => { if (++got >= 3) status(demo ? "This device only" : "Live", "ok"); };
    store.watch("standards/floors", (snap) => {
        if (snap.pending || pending.f) return;
        const d = (snap.exists && snap.data) || {}; floors = d && typeof d === "object" ? d : {};
        live(); if (!drag) { draw(); pick.redraw(); }
    }, (e) => status("Could not load your floor skills (" + ((e && e.code) || "error") + ")", "bad"));
    store.watch("standards/progress", (snap) => {
        if (snap.pending || pending.p) return;
        const d = (snap.exists && snap.data) || {}; progress = d && typeof d === "object" ? d : {};
        marksIn = true; live(); if (!drag) draw();
    }, (e) => { status("Could not load your marks (" + ((e && e.code) || "error") + ")", "bad"); if (!marksIn) { marksIn = true; if (!drag) draw(); } });
    store.watch("games/index", (snap) => { if (snap.pending) return; gameSets = ((snap.exists && snap.data && snap.data.sets) || []).filter((x) => x && x.id); }, () => {});
    store.watch("standards/timeline", (snap) => {
        if (snap.pending || pending.o) return;
        const d = (snap.exists && snap.data) || {}; order = d && typeof d === "object" ? d : {};
        live(); if (!drag) draw();
    }, (e) => status("Could not load your order (" + ((e && e.code) || "error") + ")", "bad"));
}
