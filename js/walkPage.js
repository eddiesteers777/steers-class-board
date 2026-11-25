/* ==========================================
   Anchor Board — Walkthroughs page (walk.html). Teacher only.
   Every standards-bank problem the site can write a walkthrough for, by class and standard. Watch one in the
   StepPlayer, tap "Looks right" to let it go on the board (teacher/{uid}/walk/ok), reword any why line in your own
   words (teacher/{uid}/walk/edits), or send it to the board's Show Steps screen through the Remote.
   The math lines are never typed in by hand: they come from js/walk.js, which checks every line before showing it.
========================================== */
import { STANDARDS } from "../data/standards.js?v=60";
import { inClass, LEVELS } from "./stdBank.js?v=6";
import { loadWalkItems, walkOf, withEdits, cleanOk, cleanEdits } from "./walkBank.js?v=14";
import { createStepPlayer, drawDT } from "./stepPlayer.js?v=6";
import { keyDT } from "./walk.js?v=14";

const qs = new URLSearchParams(location.search), demo = qs.has("demo");
const store = await import(demo ? "./localStore.js?v=58" : "./boardStore.js?v=58");
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
const CLASSES = [["7th", "7th Grade"], ["8th", "8th Grade"], ["8th-acc", "8th Accelerated"]];
const STD = new Map(); Object.values(STANDARDS).forEach((c) => c.standards.forEach((s) => { if (!STD.has(s.code)) STD.set(s.code, s.text); }));
const KEY = "anchorboard-walk-view";

let ITEMS = [], OK = {}, EDITS = {}, sel = "", player = null, editing = false;
const remembered = (() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } })();
const remember = () => { try { localStorage.setItem(KEY, JSON.stringify({ cls: $("fCls").value, std: $("fStd").value, id: sel })); } catch (e) { /* only a convenience */ } };

const walkable = () => ITEMS.filter((x) => walkOf(x).ok);
function fillFilters() {
    const f = $("fCls"), have = new Set(walkable().flatMap((x) => x.for || [x.cls]));
    if (!f.options.length) {
        CLASSES.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; f.appendChild(o); });
        f.value = qs.get("cls") || remembered.cls || "8th";
        if (!have.has(f.value)) f.value = "8th";
    }
    const cls = f.value, s = $("fStd"), was = s.value || qs.get("std") || remembered.std || "";
    s.textContent = "";
    const counts = new Map();
    walkable().filter((x) => inClass(x, cls)).forEach((x) => counts.set(x.std, (counts.get(x.std) || 0) + 1));
    const order = (STANDARDS[cls] ? STANDARDS[cls].standards.map((x) => x.code) : []).filter((c) => counts.has(c));
    order.forEach((c) => { const o = el("option", null, c + " · " + counts.get(c) + " walkthrough" + (counts.get(c) === 1 ? "" : "s")); o.value = c; s.appendChild(o); });
    if (!order.length) { const o = el("option", null, "None yet"); o.value = ""; s.appendChild(o); }
    s.value = order.includes(was) ? was : order[0] || "";
}
function summary() {
    const all = walkable(), ok = all.filter((x) => OK[x.id]).length;
    const box = $("summary"); box.textContent = "";
    const chip = (n, t, c) => { const s = el("span", "wk-chip" + (c ? " " + c : "")); s.appendChild(el("b", null, String(n))); s.appendChild(document.createTextNode(" " + t)); box.appendChild(s); };
    chip(all.length, "walkthroughs written and checked by the site");
    chip(ok, "checked by you", ok ? "ok" : "");
    chip(ITEMS.length - all.length, "bank problems without one yet");
}
function draw() {
    const cls = $("fCls").value, std = $("fStd").value, show = $("fShow").value;
    $("stdText").textContent = std ? std + ": " + (STD.get(std) || "") : "";
    const all = ITEMS.filter((x) => inClass(x, cls) && x.std === std);
    const list = all.filter((x) => walkOf(x).ok).filter((x) => (show === "ok" ? OK[x.id] : show === "new" ? !OK[x.id] : true));
    const ol = $("list"); ol.textContent = "";
    list.forEach((x) => {
        const li = el("li"), b = el("button", "wk-item" + (x.id === sel ? " on" : "")); b.type = "button"; b.dataset.id = x.id;
        b.setAttribute("aria-pressed", String(x.id === sel));
        const top = el("span", "wk-meta"); top.appendChild(el("span", "wk-lvl", LEVELS[x.lvl] || "")); if (OK[x.id]) top.appendChild(el("span", "wk-okb", "Checked"));
        const q = el("span", "wk-text"); q.appendChild(drawDT(keyDT(x.q)));
        b.append(top, q);
        b.onclick = () => open(x.id, true);
        li.appendChild(b); ol.appendChild(li);
    });
    const missing = all.length - all.filter((x) => walkOf(x).ok).length;
    $("none").textContent = !list.length ? (show ? "Nothing here with that filter." : "No walkthroughs for this standard yet.") : missing ? missing + " other problem" + (missing === 1 ? "" : "s") + " in " + std + " " + (missing === 1 ? "has" : "have") + " no walkthrough yet (pictures, tables or kinds of problems the site cannot write steps for)." : "";
    if (!sel || !list.some((x) => x.id === sel)) { if (list[0]) open(list[0].id, false); else openNone(); }
}
function openNone() { sel = ""; if (player) player.destroy(); player = null; $("qHead").textContent = ""; $("acts").textContent = ""; $("edit").hidden = true; $("player").appendChild(el("p", "wk-empty", "Pick a problem on the left to watch its walkthrough.")); }
function open(id, scroll) {
    const x = ITEMS.find((i) => i.id === id); if (!x) return;
    const w = walkOf(x); if (!w.ok) return;
    sel = id; editing = false; remember();
    draw2(x, w);
    $("list").querySelectorAll(".wk-item").forEach((b) => { const on = b.dataset.id === id; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    if (scroll && matchMedia("(max-width: 900px)").matches) $("qHead").scrollIntoView({ behavior: "smooth", block: "start" });
}
function draw2(x, w) {
    const h = $("qHead"); h.textContent = "";
    const meta = el("div", "wk-qmeta"); meta.appendChild(el("span", "wk-std", x.std)); meta.appendChild(el("span", null, (LEVELS[x.lvl] || "") + " · " + x.id));
    const q = el("p", "wk-qtext"); q.appendChild(drawDT(keyDT(x.q)));
    h.append(meta, q);
    if (player) player.destroy();
    $("player").textContent = "";
    player = createStepPlayer($("player"), withEdits(w, EDITS[x.id]), { onStep: () => { if (editing) drawEdit(x, w); } });
    drawActs(x, w);
    $("edit").hidden = true;
}
function drawActs(x, w) {
    const a = $("acts"); a.textContent = "";
    const checked = !!OK[x.id];
    if (checked) {
        const p = el("span", "wk-okpill", "✓ Checked " + new Date(OK[x.id]).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
        const undo = el("button", "btn ghost", "Uncheck"); undo.type = "button"; undo.onclick = () => setOk(x.id, false);
        a.append(p, undo);
    } else {
        const b = el("button", "btn go", "Looks right"); b.type = "button"; b.onclick = () => setOk(x.id, true);
        a.appendChild(b);
    }
    const show = el("a", "btn" + (checked ? "" : " ghost dis"), "Show on the board");
    if (checked) show.href = "remote.html?screen=steps&walk=" + encodeURIComponent(x.id);
    else { show.setAttribute("aria-disabled", "true"); show.title = "Check it first. The board only shows walkthroughs you have checked."; }
    const ed = el("button", "btn ghost", editing ? "Done rewording" : "Reword this step"); ed.type = "button";
    ed.onclick = () => { editing = !editing; drawActs(x, w); if (editing) drawEdit(x, w); else $("edit").hidden = true; };
    a.append(show, ed);
    if (!checked) a.appendChild(el("span", "wk-hint", "Only walkthroughs you check go on the board."));
}
function drawEdit(x, w) {
    const box = $("edit"); box.hidden = false; box.textContent = "";
    const i = player ? player.index : 0, step = w.steps[i];
    const mine = EDITS[x.id] && EDITS[x.id][i];
    box.appendChild(el("p", "wk-editlab", "Step " + (i + 1) + ": " + step.title + ". Say it the way you say it in class. The math lines stay as the site wrote them."));
    const ta = el("textarea", "pw-in wk-ta"); ta.rows = 3; ta.maxLength = 400; ta.value = mine || step.why; ta.setAttribute("aria-label", "Why line for step " + (i + 1));
    const row = el("div", "wk-editrow");
    const save = el("button", "btn", "Save wording"); save.type = "button";
    save.onclick = () => saveEdit(x, i, ta.value.trim() === step.why ? "" : ta.value.trim());
    row.appendChild(save);
    if (mine) { const r = el("button", "btn ghost", "Use the site's wording"); r.type = "button"; r.onclick = () => saveEdit(x, i, ""); row.appendChild(r); }
    box.append(ta, row);
}
async function setOk(id, on) {
    const next = Object.assign({}, OK); if (on) next[id] = Date.now(); else delete next[id];
    OK = next; drawAll(); status("Saving…");
    try { await store.save("walk/ok", { ids: next, at: Date.now() }); status(demo ? "This device only" : "Saved", "ok"); }
    catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
}
async function saveEdit(x, i, text) {
    const next = JSON.parse(JSON.stringify(EDITS)); next[x.id] = next[x.id] || {};
    if (text) next[x.id][i] = text.slice(0, 400); else delete next[x.id][i];
    if (!Object.keys(next[x.id]).length) delete next[x.id];
    EDITS = next; status("Saving…");
    try { await store.save("walk/edits", { ids: next, at: Date.now() }); status(demo ? "This device only" : "Saved", "ok"); }
    catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
    const at = player ? player.index : 0, w = walkOf(x);
    draw2(x, w); player.go(at, false); editing = true; drawActs(x, w); drawEdit(x, w);
}
function drawAll() { summary(); draw(); const x = ITEMS.find((i) => i.id === sel); if (x) drawActs(x, walkOf(x)); }

$("fCls").onchange = () => { sel = ""; fillFilters(); draw(); remember(); };
$("fStd").onchange = () => { sel = ""; draw(); remember(); };
$("fShow").onchange = () => draw();

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    $("who").textContent = demo ? "This device only, nothing is saved" : (user.name ? "Signed in as " + user.name : "Signed in");
    status(demo ? "This device only" : "Live", "ok");
    $("list").appendChild(el("li", "wk-loading", "Writing walkthroughs…"));
    ITEMS = await loadWalkItems();
    walkable();   // builds and checks every walkthrough once
    fillFilters();
    sel = qs.get("id") || remembered.id || "";
    const want = ITEMS.find((x) => x.id === sel);
    if (want && walkOf(want).ok) { const c = (want.for || [want.cls]); if (!c.includes($("fCls").value)) { $("fCls").value = c[0]; fillFilters(); } $("fStd").value = want.std; }
    summary(); draw();
    if (sel) open(sel, false);
    store.watch("walk/ok", (snap) => { if (snap.pending) return; OK = cleanOk(snap.exists ? snap.data : null); drawAll(); });
    store.watch("walk/edits", (snap) => { if (snap.pending) return; EDITS = cleanEdits(snap.exists ? snap.data : null); });
}
