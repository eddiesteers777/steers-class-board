/* ==========================================
   Calera Math — Standards: each class's Alabama standards, by unit or by domain.
   Wording comes from data/standards.js (generated from the district docs; never typed by hand).
   Status marks save to teacher/{uid}/standards/progress:
     { "8th": { "8.11": { s: "taught", d: "2026-11-17" } }, "7th": { … } }
   ?demo keeps everything on this device only. ?cls=7th&q=slope opens straight to a search.
========================================== */
import { STANDARDS } from "../data/standards.js?v=57";
import { today, short, daysLeftInNineWeeks, nineWeeksOf } from "./schoolCal.js?v=57";
import { nextUp } from "./standardsNext.js?v=57";

const demo = new URLSearchParams(location.search).has("demo");
const store = await import(demo ? "./localStore.js?v=57" : "./boardStore.js?v=58");
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
const keep = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };

const CLASSES = [["8th", "8th Grade"], ["7th", "7th Grade"], ["8th-acc", "8th Accelerated"]];
const VIEWS = [["unit", "By unit"], ["domain", "By domain"]];
const ONLY = [["all", "All"], ["critical", "★ Critical"], ["open", "Not taught yet"]];
const MARKS = [["", "Not yet"], ["teaching", "Teaching"], ["taught", "Taught"], ["reteach", "Reteach"]];

const q0 = new URLSearchParams(location.search);
let cls = CLASSES.some((c) => c[0] === q0.get("cls")) ? q0.get("cls") : (keep("std-cls") || "8th");
let view = keep("std-view") === "domain" ? "domain" : "unit";
let only = "all";
let query = q0.get("q") || "";
let progress = {}, dirty = false, saveTimer = 0;

/* ---------- saving ---------- */
function save() {
    dirty = true; status("Saving…"); clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        try { await store.save("standards/progress", progress); dirty = false; status(demo ? "This device only" : "Saved", "ok"); }
        catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
    }, 500);
}
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
const markOf = (code) => ((progress[cls] || {})[code] || {}).s || "";
function setMark(code, s) {
    const p = progress[cls] = progress[cls] || {};
    if (s) p[code] = { s, d: today() }; else delete p[code];
    save(); draw();
}

/* ---------- search ---------- */
const fold = (s) => (s || "").toLowerCase().replace(/[’']/g, "'");
function hits(s, u) {
    if (only === "critical" && !s.critical) return false;
    if (only === "open" && ["taught"].includes(markOf(s.code))) return false;
    const q = fold(query).trim(); if (!q) return true;
    const words = q.split(/\s+/);
    const hay = fold([s.code, s.text, ...s.parts.map((p) => s.code + p.l + " " + p.text), ...(u ? u.targets : []), ...s.objectives].join(" "));
    return words.every((w) => hay.includes(w));
}

/* ---------- pieces ---------- */
const chip = (kind, text) => el("span", "pl-chip k-" + kind, text);
function copyBtn(text) {
    const b = el("button", "st-copy", "Copy"); b.type = "button"; b.title = "Copy the standard";
    b.onclick = async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; } catch { b.textContent = "Select it"; } setTimeout(() => (b.textContent = "Copy"), 1400); };
    return b;
}
function marks(code) {
    const g = el("div", "st-marks"); g.setAttribute("role", "group"); g.setAttribute("aria-label", "Status for " + code);
    const cur = markOf(code), when = ((progress[cls] || {})[code] || {}).d;
    MARKS.forEach(([k, label]) => {
        const b = el("button", "m-" + (k || "none"), label); b.type = "button"; b.setAttribute("aria-pressed", String(cur === k));
        b.onclick = () => setMark(code, k); g.appendChild(b);
    });
    if (cur && when) { const auto = ((progress[cls] || {})[code] || {}).by === "Anchor"; const w = el("span", "st-when", short(when, { month: "short", day: "numeric" }) + (auto ? " · auto" : "")); if (auto) w.title = "Marked by Anchor Board from your approved week. Tap a mark to change it."; g.appendChild(w); }
    return g;
}
function list(title, items, cls2) {
    if (!items || !items.length) return null;
    const box = el("div", "st-sub " + (cls2 || "")); box.appendChild(el("h4", null, title));
    const ul = el("ul"); items.forEach((t) => ul.appendChild(el("li", null, t))); box.appendChild(ul); return box;
}

/** One standard. u = this unit's notes for it ({ parts, targets, specs }) or null. */
function stdRow(s, u) {
    const row = el("article", "st-row" + (s.critical ? " crit" : "") + " s-" + (markOf(s.code) || "none"));
    row.id = "s-" + s.code.replace(/[^A-Za-z0-9]+/g, "-");
    const top = el("div", "st-top");
    const code = el("span", "st-code", s.code + (u && u.parts.length && u.parts.length < s.parts.length ? u.parts.join(",") : ""));
    top.appendChild(code);
    if (s.critical) top.appendChild(chip("crit", "★ Critical"));
    const spec = u && u.specs[0];
    if (spec) { const m = /(no|yes|neutral|natural) calculator|calculator may or may not/i.exec(spec); if (m) top.appendChild(chip("note", /^no/i.test(m[0]) ? "No calculator" : /yes/i.test(m[0]) ? "Calculator" : "Calculator optional")); }
    top.appendChild(copyBtn(s.code + " " + s.text + (s.parts.length ? "\n" + s.parts.map((p) => p.l + ". " + p.text).join("\n") : "")));
    row.appendChild(top);
    row.appendChild(el("p", "st-text", s.text));
    if (s.parts.length) {
        const ol = el("ol", "st-parts");
        s.parts.forEach((p) => {
            const on = !u || !u.parts.length || u.parts.includes(p.l);
            const li = el("li", on ? "" : "dim"); li.appendChild(el("b", null, p.l + ".")); li.appendChild(document.createTextNode(" " + p.text));
            if (!on) li.title = "Taught in another unit"; ol.appendChild(li);
        });
        row.appendChild(ol);
    }
    row.appendChild(marks(s.code));
    const more = el("details", "st-more");
    const n = (u ? u.targets.length : 0) + s.objectives.length;
    more.appendChild(el("summary", null, (u && u.targets.length ? "I can targets, " : "") + "objectives and prior skills" + (n ? " (" + n + ")" : "")));
    const inner = el("div", "st-moregrid");
    [list("I can…", u && u.targets, "ican"), list("Learning objectives", s.objectives), list("Prior knowledge", s.prior), list("ACAP item notes", u && u.specs, "spec")].forEach((b) => b && inner.appendChild(b));
    more.appendChild(inner); row.appendChild(more);
    return row;
}

/* ---------- views ---------- */
function unitView(C, box) {
    const used = new Set();
    let shown = 0;
    C.units.forEach((u) => {
        const rows = u.standards.map((x) => [C.standards.find((s) => s.code === x.code), x]).filter(([s, x]) => s && hits(s, x));
        u.standards.forEach((x) => used.add(x.code));
        if (!rows.length) return;
        shown += rows.length;
        const card = el("section", "st-unit");
        const h = el("header", "st-uhead");
        const t = el("div"); t.appendChild(el("span", "st-uno", (C.unitWord || "Unit") + " " + u.id)); t.appendChild(el("h3", null, u.name)); h.appendChild(t);
        const meta = el("div", "st-umeta");
        if (u.pacing) meta.appendChild(chip("term", u.pacing));
        const crit = u.standards.filter((x) => (C.standards.find((s) => s.code === x.code) || {}).critical).length;
        if (crit) meta.appendChild(chip("crit", crit + " critical"));
        const done = u.standards.filter((x) => markOf(x.code) === "taught").length;
        meta.appendChild(el("span", "st-frac", done + " of " + u.standards.length + " taught"));
        h.appendChild(meta); card.appendChild(h);
        const bar = el("div", "pl-prog"); const i = el("i"); i.style.width = (u.standards.length ? (100 * done) / u.standards.length : 0) + "%"; bar.appendChild(i); card.appendChild(bar);
        rows.forEach(([s, x]) => card.appendChild(stdRow(s, x)));
        (u.extra || []).filter((x) => !query || fold(x.label + " " + x.text).includes(fold(query).trim())).forEach((x) => {
            const r = el("article", "st-row extra"); const top = el("div", "st-top");
            top.appendChild(el("span", "st-code", x.label || "Unit doc")); top.appendChild(chip("note", "Wording from the unit doc")); r.appendChild(top);
            r.appendChild(el("p", "st-text", x.text));
            const l = list("I can…", x.targets, "ican"); if (l) r.appendChild(l);
            card.appendChild(r);
        });
        box.appendChild(card);
    });
    const loose = C.standards.filter((s) => !used.has(s.code) && hits(s, null));
    if (loose.length) {
        const card = el("section", "st-unit loose");
        const h = el("header", "st-uhead"); const t = el("div"); t.appendChild(el("span", "st-uno", "No unit doc yet")); t.appendChild(el("h3", null, "Not listed in a unit")); h.appendChild(t); card.appendChild(h);
        card.appendChild(el("p", "st-note", "These standards are in the Course of Study but none of the unit docs in the shared folder list them."));
        loose.forEach((s) => card.appendChild(stdRow(s, null)));
        box.appendChild(card); shown += loose.length;
    }
    return shown;
}
function domainView(C, box) {
    let shown = 0, card = null, lastDomain = null, lastCluster = null;
    const unitOf = (code) => C.units.find((u) => u.standards.some((x) => x.code === code));
    C.standards.forEach((s) => {
        const u = unitOf(s.code), x = u && u.standards.find((y) => y.code === s.code);
        if (!hits(s, x)) return;
        if (s.domain !== lastDomain) { card = el("section", "st-unit"); const h = el("header", "st-uhead"); const t = el("div"); t.appendChild(el("span", "st-uno", "Domain")); t.appendChild(el("h3", null, s.domain)); h.appendChild(t); card.appendChild(h); box.appendChild(card); lastDomain = s.domain; lastCluster = null; }
        if (s.cluster !== lastCluster) { card.appendChild(el("p", "st-cluster", s.cluster)); lastCluster = s.cluster; }
        const r = stdRow(s, x);
        if (u) { const a = el("a", "pl-pill st-unitlink", (C.unitWord || "Unit") + " " + u.id + ": " + u.name); a.href = "#"; a.onclick = (e) => { e.preventDefault(); view = "unit"; keep("std-view", view); draw(); requestAnimationFrame(() => { const n = document.getElementById(r.id); if (n) n.scrollIntoView({ behavior: "smooth", block: "center" }); }); }; r.querySelector(".st-top").insertBefore(a, r.querySelector(".st-copy")); }
        card.appendChild(r); shown++;
    });
    return shown;
}

/* ---------- top ---------- */
function summary(C) {
    const S = $("summary"); S.textContent = "";
    const tile = (big, small, accent) => { const t = el("div", "pl-tile" + (accent ? " accent" : "")); t.appendChild(el("b", null, big)); t.appendChild(el("span", null, small)); S.appendChild(t); };
    if (!C) { tile("—", "Standards for this class are coming next", true); return; }
    const all = C.standards.length, crit = C.standards.filter((s) => s.critical).length;
    const p = progress[cls] || {};
    const taught = C.standards.filter((s) => (p[s.code] || {}).s === "taught").length;
    const critTaught = C.standards.filter((s) => s.critical && (p[s.code] || {}).s === "taught").length;
    const teaching = C.standards.filter((s) => (p[s.code] || {}).s === "teaching").map((s) => s.code);
    tile(taught + " / " + all, "standards marked taught", true);
    tile(critTaught + " / " + crit, "critical (★) standards taught");
    tile(teaching.length ? teaching.slice(0, 3).join(", ") + (teaching.length > 3 ? "…" : "") : "None", "teaching right now");
    tile(String(C.units.length), C.course + " units in the district plan");
}
/* ---------- next up: what the district order says comes next ---------- */
const ORDN = ["", "1st", "2nd", "3rd", "4th"];
function findRow(code) {
    const go = () => { const n = document.getElementById("s-" + code.replace(/[^A-Za-z0-9]+/g, "-")); if (n) { n.scrollIntoView({ behavior: "smooth", block: "center" }); n.classList.add("st-flash"); setTimeout(() => n.classList.remove("st-flash"), 1600); } };
    if (only !== "all" || query) { only = "all"; query = ""; $("q").value = ""; draw(); }
    requestAnimationFrame(go);
}
function nextPanel() {
    const box = $("next"); box.textContent = "";
    const n = nextUp(cls, progress); if (!n) { box.hidden = true; return; } box.hidden = false;
    const head = el("div", "st-nhead"), t = el("div");
    t.appendChild(el("h2", null, "Next up"));
    const d = today(), q = nineWeeksOf(d), left = q ? daysLeftInNineWeeks(d) : 0;
    const meta = [];
    if (q) meta.push(left + (left === 1 ? " school day" : " school days") + " left in the " + ORDN[q.n] + " nine weeks");
    meta.push(n.critLeft + " critical (★) " + (n.critLeft === 1 ? "standard" : "standards") + " not taught yet");
    t.appendChild(el("p", "st-nmeta", meta.join(" · ")));
    head.appendChild(t); box.appendChild(head);
    if (n.current) {
        const now = el("p", "st-nnow"); now.appendChild(el("b", null, "Now: ")); now.appendChild(document.createTextNode(n.unitWord + " " + n.current.id + ": " + n.current.name));
        if (n.teaching.length) now.appendChild(document.createTextNode(" (teaching " + n.teaching.join(", ") + ")"));
        box.appendChild(now);
    }
    if (!n.next.length) box.appendChild(el("p", "st-nnow", "Every standard from here on is marked Teaching or Taught."));
    const list = el("ol", "st-nlist");
    n.next.slice(0, 4).forEach((x) => {
        const li = el("li"), top = el("div", "st-ntop");
        const code = el("button", "st-code st-ncode", x.code); code.type = "button"; code.title = "Show " + x.code + " in the list"; code.onclick = () => findRow(x.code);
        top.appendChild(code);
        if (x.critical) top.appendChild(chip("crit", "★ Critical"));
        top.appendChild(el("span", "st-nunit", n.unitWord + " " + x.unit.id + ": " + x.unit.name));
        const go = el("button", "st-nstart", "Start teaching"); go.type = "button"; go.onclick = () => setMark(x.code, "teaching");
        top.appendChild(go);
        li.appendChild(top);
        li.appendChild(el("p", "st-ntext", x.text.length > 150 ? x.text.slice(0, 147).trim() + "…" : x.text));
        list.appendChild(li);
    });
    if (n.next.length) box.appendChild(list);
    if (n.next.length > 4) box.appendChild(el("p", "st-nmore", "Then " + (n.next.length - 4) + " more, in district order below."));
    const links = (label, codes) => { if (!codes.length) return; const p = el("p", "st-nopen"); p.appendChild(el("b", null, label)); codes.forEach((c, i) => { const a = el("button", "st-nlink", c); a.type = "button"; a.onclick = () => findRow(c); if (i) p.appendChild(document.createTextNode(", ")); p.appendChild(a); }); box.appendChild(p); };
    links("Marked Reteach: ", n.reteach);
    links("Left open in earlier " + n.unitWord.toLowerCase() + "s: ", n.left.map((x) => x.code));
}
function seg(id, items, cur, onPick) {
    const box = $(id); box.textContent = "";
    items.forEach(([k, label]) => { const b = el("button", null, label); b.type = "button"; b.dataset.v = k; b.setAttribute("aria-pressed", String(k === cur)); b.onclick = () => onPick(k); box.appendChild(b); });
}
function draw() {
    seg("classes", CLASSES, cls, (k) => { cls = k; keep("std-cls", k); draw(); });
    seg("views", VIEWS, view, (k) => { view = k; keep("std-view", k); draw(); });
    seg("only", ONLY, only, (k) => { only = k; draw(); });
    const C = STANDARDS[cls];
    summary(C);
    nextPanel();
    const box = $("view"); box.textContent = "";
    box.classList.remove("pl-view"); void box.offsetWidth; box.classList.add("pl-view");
    if (!C) { box.appendChild(el("div", "pl-empty", "No standards loaded for this class yet.")); return; }
    const n = view === "domain" ? domainView(C, box) : unitView(C, box);
    if (!n) box.appendChild(el("div", "pl-empty", query ? "No standard matches “" + query + "”." : "Nothing to show with this filter."));
}

const qi = $("q"); qi.value = query;
let qt = 0; qi.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { query = qi.value; draw(); }, 120); };
document.addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement !== qi) { e.preventDefault(); qi.focus(); } });
draw();

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    $("who").textContent = demo ? "This device only, nothing is saved" : "Signed in as " + user.name;
    store.watch("standards/progress", (snap) => {
        if (snap.pending || dirty) return;
        const d = (snap.exists && snap.data) || {};
        progress = d && typeof d === "object" ? d : {};
        status(demo ? "This device only" : "Live", "ok");
        draw();
    }, (e) => { status("Could not load your marks (" + ((e && e.code) || "error") + ")", "bad"); });
}
