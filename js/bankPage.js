/* ==========================================
   Focal — Question Bank page (bank.html). Teacher only.
   Every question from the weeks on the board (published and approved private weeks), searchable by words, class,
   kind, standard or skill, and week. Select questions and copy them for Claude, or update Claude's copy
   (teacher/{uid}/bank/<weekId>, js/bank.js) for every week at once.
========================================== */
import { WEEKS as PUBLISHED } from "../data/weeks.js?v=60";
import { watchPrivateWeeks } from "./weeksLive.js?v=58";
import { extract, norm, KINDS, saveBankWeek } from "./bank.js?v=2";
import { rich } from "./weekSheets.js?v=59";

const qs = new URLSearchParams(location.search), demo = qs.has("demo");
const store = await import(demo ? "./localStore.js?v=58" : "./boardStore.js?v=58");
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
const LABEL = { "8th": "8th Grade", "7th": "7th Grade", "8th-acc": "8th Accelerated" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PAGE = 60;

let WEEKS = PUBLISHED, all = [], shown = PAGE, uid = "", claudeDocs = null;
const picked = new Map();   // key -> item

function rebuild() {
    all = [];
    WEEKS.forEach((w) => extract(w).forEach((x) => all.push(Object.assign(x, { label: w.label || w.id, monday: w.monday || "", key: w.id + "|" + x.cls + "|" + x.kind + "|" + norm(x.q) }))));
    all.sort((a, b) => String(b.monday).localeCompare(String(a.monday)));
    fill();
    draw();
}
function opts(sel, list, first) {
    const keep = sel.value; sel.textContent = "";
    [["", first]].concat(list).forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.appendChild(o); });
    if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
}
function fill() {
    opts($("fCls"), Object.entries(LABEL).filter(([k]) => all.some((x) => x.cls === k)), "All classes");
    opts($("fKind"), KINDS.filter((k) => all.some((x) => x.kind === k)).map((k) => [k, k]), "Every kind");
    const stds = [...new Set(all.map((x) => x.std || x.skill).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    opts($("fStd"), stds.map((s) => [s, s]), stds.length ? "Any" : "None tagged yet");
    const wk = []; WEEKS.slice().reverse().forEach((w) => { if (all.some((x) => x.week === w.id)) wk.push([w.id, (w.label || w.id) + (w.dates ? " · " + w.dates : "")]); });
    opts($("fWeek"), wk, "Every week");
}
function matches() {
    const words = norm($("q").value).split(" ").filter(Boolean), c = $("fCls").value, k = $("fKind").value, s = $("fStd").value, w = $("fWeek").value;
    let list = all.filter((x) => (!c || x.cls === c) && (!k || x.kind === k) && (!s || (x.std || x.skill) === s) && (!w || x.week === w)
        && (!words.length || words.every((t) => (norm(x.q) + " " + norm(x.a) + " " + norm(x.std || x.skill || "")).includes(t))));
    if ($("once").checked) {
        const by = new Map();
        list.forEach((x) => { const key = x.cls + "|" + norm(x.q); const h = by.get(key); if (h) { if (!h.uses.includes(x.label)) h.uses.push(x.label); } else by.set(key, Object.assign({}, x, { uses: [x.label] })); });
        list = [...by.values()];
    }
    return list;
}
function summary() {
    const box = $("summary"); box.textContent = "";
    const tile = (big, small, accent) => { const t = el("div", "pl-tile" + (accent ? " accent" : "")); t.appendChild(el("b", null, big)); t.appendChild(el("span", null, small)); box.appendChild(t); };
    const uniq = new Set(all.map((x) => x.cls + "|" + norm(x.q))).size, weeks = new Set(all.map((x) => x.week)).size;
    tile(String(uniq), "different questions", true);
    tile(String(weeks), weeks === 1 ? "week" : "weeks");
    tile(String(all.filter((x) => x.check).length), "with Claude's math check");
    tile(claudeDocs == null ? "…" : String(claudeDocs), "weeks in Claude's copy");
}
function card(x) {
    const li = el("li", "bk-item"), top = el("div", "bk-top");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = picked.has(x.key); cb.setAttribute("aria-label", "Select this question");
    cb.onchange = () => { if (cb.checked) picked.set(x.key, x); else picked.delete(x.key); selBar(); };
    top.appendChild(cb);
    const q = el("div", "bk-q"); q.appendChild(rich(x.q)); top.appendChild(q); li.appendChild(top);
    if (Array.isArray(x.choices) && x.choices.length) { const ch = el("p", "bk-ch"); x.choices.forEach((t, i) => { const s = el("span"); s.appendChild(el("b", null, "ABCDE"[i] + ". ")); s.appendChild(rich(t)); ch.appendChild(s); }); li.appendChild(ch); }
    if ($("ans").checked) { const a = el("p", "bk-a"); a.appendChild(el("b", null, "Answer: ")); a.appendChild(rich(x.a)); li.appendChild(a); }
    const meta = el("p", "bk-meta");
    [LABEL[x.cls] || x.cls, x.kind, (x.uses ? x.uses.join(", ") : x.label) + (x.day != null && DAYS[x.day] ? " · " + DAYS[x.day] : ""), x.std || x.skill || "", x.check ? "Checked" : ""].filter(Boolean)
        .forEach((t) => meta.appendChild(el("span", t === "Checked" ? "bk-chip ok" : "bk-chip", t)));
    li.appendChild(meta);
    return li;
}
function draw() {
    $("skel").hidden = true; summary();
    const list = matches(), box = $("list"); box.textContent = "";
    list.slice(0, shown).forEach((x) => box.appendChild(card(x)));
    $("count").textContent = list.length ? (list.length === 1 ? "1 question" : list.length + " questions") + (list.length > shown ? ", showing " + shown : "") : all.length ? "No question matches. Try fewer words or Every week." : "No weeks on the board yet. Approved weeks fill the bank on their own.";
    $("more").hidden = list.length <= shown;
    selBar();
}
function selBar() {
    $("selBar").hidden = !picked.size;
    $("selCount").textContent = picked.size + (picked.size === 1 ? " question selected" : " questions selected");
}
function forClaude() {
    const keep = ["q", "a", "choices", "wrong", "work", "check", "std", "skill"];
    const lines = [...picked.values()].map((x) => { const o = { from: (LABEL[x.cls] || x.cls) + ", " + x.label + ", " + x.kind }; keep.forEach((k) => { if (x[k] != null) o[k] = x[k]; }); return JSON.stringify(o); });
    return "Reuse these checked questions from my Question Bank (recompute each check before using it):\n" + lines.join("\n");
}
function drawClaude() {
    const box = $("claude"); box.textContent = "";
    box.appendChild(el("h2", "rv-h2", "Claude's copy"));
    box.appendChild(el("p", "pw-sendp", "Week Review saves each week here when you approve it. If a week is missing (weeks from before this page existed), update the copy once."));
    const b = el("button", "btn", "Update Claude's copy for every week"); b.type = "button"; b.disabled = demo || !store.rooms || !uid;
    b.onclick = async () => {
        b.disabled = true; status("Saving…");
        try { for (const w of WEEKS) if (extract(w).length) await saveBankWeek(store, uid, w, true); status("Saved", "ok"); }
        catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
        b.disabled = false;
    };
    box.appendChild(b);
}

["q"].forEach((i) => { let t = 0; $(i).oninput = () => { clearTimeout(t); t = setTimeout(() => { shown = PAGE; draw(); }, 150); }; });
["fCls", "fKind", "fStd", "fWeek", "once", "ans"].forEach((i) => { $(i).onchange = () => { shown = PAGE; draw(); }; });
$("more").onclick = () => { shown += PAGE; draw(); };
$("clearSel").onclick = () => { picked.clear(); draw(); };
$("copySel").onclick = async () => { try { await navigator.clipboard.writeText(forClaude()); const b = $("copySel"), o = b.textContent; b.textContent = "Copied"; setTimeout(() => (b.textContent = o), 1600); } catch (e) { status("Copy did not work on this device", "bad"); } };

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    uid = user.uid || "";
    $("who").textContent = demo ? "This device only, nothing is saved" : (user.name ? "Signed in as " + user.name : "Signed in");
    status(demo ? "This device only" : "Live", "ok");
    rebuild(); drawClaude();
    watchPrivateWeeks(store, PUBLISHED, (list) => { WEEKS = list; rebuild(); });
    if (store.rooms && store.rooms.watchAll && uid) store.rooms.watchAll("teacher/" + uid + "/bank", (docs) => { claudeDocs = docs.length; summary(); }, () => {});
}
