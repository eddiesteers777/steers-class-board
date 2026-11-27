/* ==========================================
   Focal — Question Bank page (bank.html). Teacher only.
   Every question from the weeks on the board (published and approved private weeks), searchable by words, class,
   kind, standard or skill, and week. Select questions and copy them for Claude, or update Claude's copy
   (teacher/{uid}/bank/<weekId>, js/bank.js) for every week at once.
========================================== */
import { WEEKS as PUBLISHED } from "../data/weeks.js?v=64";
import { watchPrivateWeeks } from "./weeksLive.js?v=58";
import { extract, norm, KINDS, saveBankWeek } from "./bank.js?v=2";
import { rich } from "./weekSheets.js?v=60";
import { STANDARDS } from "../data/standards.js?v=60";
import { loadStdBank, inClass, coverage, LEVELS, WEEK_ID, WEEK_LABEL, KIND } from "./stdBank.js?v=6";
import { byGrade } from "./courseOrder.js?v=1";

const qs = new URLSearchParams(location.search), demo = qs.has("demo");
const store = await import(demo ? "./localStore.js?v=58" : "./boardStore.js?v=58");
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
const LABEL = { "8th": "8th Grade", "7th": "7th Grade", "8th-acc": "8th Accelerated", "g2": "2nd Grade", "g3": "3rd Grade", "g4": "4th Grade", "g5": "5th Grade", "g6": "6th Grade", "geo": "Geometry", "alg2": "Algebra II", "precalc": "Precalculus", "mm": "Math Modeling", "afm": "Finite Math" };
const IN_ORDER = byGrade(Object.entries(LABEL), ([, t]) => t);   // [key, label] in grade level order, for the class list and the coverage cards
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PAGE = 60;
// Alabama standard wording by code (from data/standards.js, built from the curriculum docs), for the chip and filter labels.
const STD_TEXT = new Map();
Object.values(STANDARDS).forEach((c) => c.standards.forEach((s) => { if (!STD_TEXT.has(s.code)) STD_TEXT.set(s.code, s.text); }));
const tagOf = (x) => x.std || x.skill || "";
const short = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t);

let WEEKS = PUBLISHED, all = [], shown = PAGE, uid = "", claudeDocs = null, SB = [];
const openCov = new Set();   // coverage lists left open between redraws
const picked = new Map();   // key -> item

function rebuild() {
    all = [];
    WEEKS.forEach((w) => extract(w).forEach((x) => all.push(Object.assign(x, { label: w.label || w.id, monday: w.monday || "", key: w.id + "|" + x.cls + "|" + x.kind + "|" + norm(x.q) }))));
    all.sort((a, b) => String(b.monday).localeCompare(String(a.monday)));
    // The standards bank (every Alabama standard, js/stdBank.js) comes after the weeks, in standards order.
    SB.forEach((x) => all.push(Object.assign({}, x, { monday: "", key: "sb|" + x.id })));
    fill();
    draw();
}
function opts(sel, list, first) {
    const keep = sel.value; sel.textContent = "";
    [["", first]].concat(list).forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.appendChild(o); });
    if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
}
function fill() {
    opts($("fCls"), IN_ORDER.filter(([k]) => all.some((x) => inClass(x, k))), "All classes");
    opts($("fKind"), KINDS.concat([KIND]).filter((k) => all.some((x) => x.kind === k)).map((k) => [k, k]), "Every kind");
    fillStd();
    const wk = []; WEEKS.slice().reverse().forEach((w) => { if (all.some((x) => x.week === w.id)) wk.push([w.id, (w.label || w.id) + (w.dates ? " · " + w.dates : "")]); });
    if (SB.length) wk.unshift([WEEK_ID, WEEK_LABEL + " (every standard)"]);
    opts($("fWeek"), wk, "Every week");
}
/** Standard or skill list. With a class picked, only the tags on that class's questions, in that course's standards
 *  order, then its below-grade skills. With All classes, every tag: standards first, then prior skills. */
function fillStd() {
    const c = $("fCls").value, pool = c ? all.filter((x) => inClass(x, c)) : all;
    const seq = new Map(c && STANDARDS[c] ? STANDARDS[c].standards.map((s, i) => [s.code, i]) : []);
    const rank = (t) => (seq.has(t) ? 0 : STD_TEXT.has(t) ? 1 : 2);
    const tags = [...new Set(pool.map(tagOf).filter(Boolean))].sort((a, b) => (rank(a) - rank(b)) || ((seq.get(a) ?? 0) - (seq.get(b) ?? 0)) || a.localeCompare(b, undefined, { numeric: true }));
    opts($("fStd"), tags.map((s) => [s, STD_TEXT.has(s) ? s + " · " + short(STD_TEXT.get(s), 60) : s]), tags.length ? (c ? "Any for " + (LABEL[c] || c) : "Any") : "None tagged yet");
}
function matches() {
    const words = norm($("q").value).split(" ").filter(Boolean), c = $("fCls").value, k = $("fKind").value, s = $("fStd").value, w = $("fWeek").value, l = $("fLvl").value;
    let list = all.filter((x) => inClass(x, c) && (!k || x.kind === k) && (!s || tagOf(x) === s) && (!w || x.week === w) && (!l || String(x.lvl) === l)
        && (!words.length || words.every((t) => (norm(x.q) + " " + norm(x.a) + " " + norm(tagOf(x) + " " + (STD_TEXT.get(x.std) || ""))).includes(t))));
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
    const tagged = new Set(all.filter((x) => x.std).map((x) => x.cls + "|" + norm(x.q))).size;
    tile(tagged + " of " + uniq, "tagged with a standard");
    const cov = coverage(all), stds = new Set(), have = new Set();
    Object.values(cov).forEach((list) => list.forEach((r) => { stds.add(r.code); if (r.bank + r.weeks) have.add(r.code); }));
    tile(have.size + " of " + stds.size, "standards with questions");
    tile(claudeDocs == null ? "…" : String(claudeDocs), "weeks in Claude's copy");
}
function card(x) {
    const li = el("li", "bk-item"), top = el("div", "bk-top");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = picked.has(x.key); cb.setAttribute("aria-label", "Select this question");
    cb.onchange = () => { if (cb.checked) picked.set(x.key, x); else picked.delete(x.key); selBar(); };
    top.appendChild(cb);
    const q = el("div", "bk-q"); q.appendChild(rich(x.q)); top.appendChild(q); li.appendChild(top);
    if (Array.isArray(x.choices) && x.choices.length) { const ch = el("p", "bk-ch"); x.choices.forEach((t, i) => { const s = el("span"); s.appendChild(el("b", null, "ABCDE"[i] + ". ")); s.appendChild(rich(t)); ch.appendChild(s); }); li.appendChild(ch); }
    if ($("ans").checked) { const a = el("p", "bk-a"); a.appendChild(el("b", null, "Answer: ")); a.appendChild(rich(x.a)); const alt = Array.isArray(x.also) ? x.also.filter((t) => !/\^\(|\d\s*\/\s*\d|[a-z)]\/|\^\-?[a-z0-9]/i.test(String(t).replace(/\{[^{}]*\}/g, ""))) : [];   // typed forms like 3/4 or x^3 stay out of sight
    if (alt.length) { const s = el("span", "bk-also", "  Also right: "); alt.forEach((t, i) => { if (i) s.appendChild(document.createTextNode(", ")); s.appendChild(rich(t)); }); a.appendChild(s); } li.appendChild(a); }
    const meta = el("p", "bk-meta");
    const where = x.sb ? (x.for || [x.cls]).map((k) => LABEL[k] || k).join(" + ") : LABEL[x.cls] || x.cls;
    [where, x.sb ? (LEVELS[x.lvl] || "") : x.kind, x.sb ? "" : (x.uses ? x.uses.join(", ") : x.label) + (x.day != null && DAYS[x.day] ? " · " + DAYS[x.day] : ""), x.check ? "Checked" : ""].filter(Boolean)
        .forEach((t) => meta.appendChild(el("span", t === "Checked" ? "bk-chip ok" : "bk-chip", t)));
    const tag = tagOf(x);
    if (tag) {   // the standard (or prior skill): tap it to show only questions with the same tag
        const b = el("button", "bk-chip bk-std" + (x.std ? "" : " skill"), x.std ? "AL " + x.std + (x.part || "") : tag); b.type = "button";
        b.title = x.std ? x.std + ": " + (STD_TEXT.get(x.std) || "") + "\nTap to show every question with this standard." : "Below grade level: no standard for this class. Tap to show every question like it.";
        b.onclick = () => { $("fStd").value = tag; shown = PAGE; draw(); window.scrollTo({ top: 0, behavior: "smooth" }); };
        meta.appendChild(b);
    }
    li.appendChild(meta);
    return li;
}
/** Every standard for the chosen class (or all three) with how many questions carry it. Tap one to show them. */
function drawCoverage() {
    const box = $("cover"); if (!box) return; box.textContent = "";
    const cov = coverage(all), c = $("fCls").value, classes = c ? [c] : IN_ORDER.map(([k]) => k).filter((k) => cov[k]);
    classes.forEach((cls) => {
        const rows = cov[cls] || [], done = rows.filter((r) => r.bank + r.weeks).length;
        const d = el("details", "bk-cov"); d.open = openCov.has(cls); d.ontoggle = () => { if (d.open) openCov.add(cls); else openCov.delete(cls); }; const sm = el("summary", null, (LABEL[cls] || cls) + ": " + done + " of " + rows.length + " standards have questions"); d.appendChild(sm);
        const ul = el("ul", "bk-covlist");
        rows.forEach((r) => {
            const li = el("li", r.bank + r.weeks ? "" : "none"), b = el("button", "bk-covbtn"); b.type = "button";
            b.appendChild(el("b", null, r.code + (r.critical ? " *" : ""))); b.appendChild(el("span", null, short(r.text, 70)));
            b.appendChild(el("em", null, r.bank + r.weeks ? r.bank + " bank" + (r.weeks ? " · " + r.weeks + " from weeks" : "") : "None yet"));
            b.title = r.code + ": " + r.text; if (!(r.bank + r.weeks)) b.disabled = true;
            b.onclick = () => { $("fCls").value = cls; fillStd(); $("fWeek").value = ""; $("fStd").value = [...$("fStd").options].some((o) => o.value === r.code) ? r.code : ""; shown = PAGE; draw(); $("count").scrollIntoView({ behavior: "smooth" }); };
            li.appendChild(b); ul.appendChild(li);
        });
        d.appendChild(ul); box.appendChild(d);
    });
}
function draw() {
    $("skel").hidden = true; summary(); drawCoverage();
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
    const keep = ["q", "a", "choices", "also", "wrong", "work", "check", "std", "part", "skill", "lvl"];
    const lines = [...picked.values()].map((x) => { const o = { from: x.sb ? WEEK_LABEL + " " + x.id : (LABEL[x.cls] || x.cls) + ", " + x.label + ", " + x.kind }; keep.forEach((k) => { if (x[k] != null) o[k] = x[k]; }); return JSON.stringify(o); });
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
$("fCls").onchange = () => { fillStd(); shown = PAGE; draw(); };   // the standards list follows the class
["fKind", "fStd", "fWeek", "fLvl", "once", "ans"].forEach((i) => { $(i).onchange = () => { shown = PAGE; draw(); }; });
$("more").onclick = () => { shown += PAGE; draw(); };
$("clearSel").onclick = () => { picked.clear(); draw(); };
// Send the picked questions to the Question Maker as a new game set (Vault Raid and the review games).
$("toGame").onclick = () => {
    const keep = ["q", "a", "choices", "also", "std", "part", "skill", "kind", "cls"];
    const list = [...picked.values()].map((x) => { const o = {}; keep.forEach((k) => { if (x[k] != null) o[k] = x[k]; }); return o; });
    try { localStorage.setItem("anchorboard-maker-inbox", JSON.stringify(list)); } catch (e) { status("This browser blocked it. Use Add from Question Bank in the Question Maker.", "bad"); return; }
    location.href = "maker.html?from=bank" + (demo ? "&demo" : "");
};
$("copySel").onclick = async () => { try { await navigator.clipboard.writeText(forClaude()); const b = $("copySel"), o = b.textContent; b.textContent = "Copied"; setTimeout(() => (b.textContent = o), 1600); } catch (e) { status("Copy did not work on this device", "bad"); } };

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    uid = user.uid || "";
    $("who").textContent = demo ? "This device only, nothing is saved" : (user.name ? "Signed in as " + user.name : "Signed in");
    status(demo ? "This device only" : "Live", "ok");
    rebuild(); drawClaude();
    loadStdBank().then((list) => { SB = list; rebuild(); });
    watchPrivateWeeks(store, PUBLISHED, (list) => { WEEKS = list; rebuild(); });
    if (store.rooms && store.rooms.watchAll && uid) store.rooms.watchAll("teacher/" + uid + "/bank", (docs) => { claudeDocs = docs.length; summary(); }, () => {});
}
