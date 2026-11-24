/* ==========================================
   Anchor Board — Student Work (work.html): bring in a scanned stack, match papers to the roster,
   file them by nine weeks and week, and keep a folder per student. The rules are in js/workCore.js.

   Private documents only (teacher/{uid}/...), never this public repo:
     work/index        { sets: [{ id, title, period, date, kind, std, pages, bytes, students, unsorted, cleared }] }
     work/s_<id>       { id, title, period, date, kind, std, notes, pages: [{ p, s, b, w, h, at, gone }], cleared }
     work/p_<pid>      { img (JPEG data URL), w, h, set, at }   one page; { removed: true } once deleted or cleared
     work/k_<period>   { notes: { "<roster name>": "private teacher note" }, at }
========================================== */
import { mountStudentsNav, sharedPeriod, saveSharedPeriod } from "./studentsNav.js?v=5";
import { shrink, rotate, buildPdf, mb, pdfPages } from "./studentWork.js?v=58";
import { SCHOOL_YEAR, isSchoolDay } from "./schoolCal.js?v=59";
import { weekIdFor } from "./weeksLive.js?v=58";
import * as W from "./workCore.js?v=1";

mountStudentsNav("work.html");
const params = new URLSearchParams(location.search);
const demo = params.has("demo");   // ?demo: this device only, nothing saved
const store = await import(demo ? "./localStore.js?v=57" : "./boardStore.js?v=58");
const PERIODS = [["1st", "8th Grade", "8th"], ["2nd", "8th Grade", "8th"], ["4th", "8th Grade", "8th"], ["5th", "7th Grade", "7th"], ["6th", "8th Accelerated", "8th-acc"]];
const KEY = W.KEY, FREE = 1024 * 1048576, NW = SCHOOL_YEAR.nineWeeks, ORD = ["", "1st", "2nd", "3rd", "4th"];
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
const saved = () => status(demo ? "This device only" : "Saved", "ok");
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
const fail = (e) => status("Could not save (" + ((e && e.code) || (e && e.message) || "connection") + ")", "bad");
const fileOf = (d) => W.fileOf(d, NW, isSchoolDay);
const todayIso = () => new Date().toLocaleDateString("en-CA");
const safeName = (s) => s.replace(/[^\w\- ]+/g, "").replace(/\s+/g, " ").trim();
const remember = (k, v) => { try { if (v === undefined) return localStorage.getItem("anchorboard-work-" + k); localStorage.setItem("anchorboard-work-" + k, v); } catch (e) { return null; } };

let index = [], rosters = {}, cur = null, imgs = new Map(), unsub = new Map(), busy = false;
let period = [params.get("per"), sharedPeriod(""), remember("period")].find((p) => p && PERIODS.some((x) => x[0] === p)) || "1st";
let view = ["week", "kid", "in"].includes(remember("view")) ? remember("view") : "week";
let weekKey = "", kid = params.get("kid") || "", lastView = "week";
const full = new Map(), fullUnsub = new Map();   // set docs for the By student view, this period only
let kidNotes = {}, kidNotesUnsub = null;

const roster = (per) => (rosters[per || period] || []).filter(Boolean);
const periodSets = () => index.filter((m) => m.period === period);

/* ---------- shared bits ---------- */
/** A small progress ring (the logo idea): share of the class with work filed. */
function ring(frac, label) {
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"), r = 20, len = 2 * Math.PI * r;
    svg.setAttribute("viewBox", "0 0 52 52"); svg.setAttribute("class", "wk-ring"); svg.setAttribute("aria-hidden", "true");
    const c = (cls, dash) => { const e = document.createElementNS(NS, "circle"); e.setAttribute("cx", 26); e.setAttribute("cy", 26); e.setAttribute("r", r); e.setAttribute("class", cls); if (dash != null) e.setAttribute("stroke-dasharray", dash + " " + len); svg.appendChild(e); };
    c("bg"); if (frac > 0) c(frac >= 1 ? "fg done" : "fg", Math.max(0.02, Math.min(1, frac)) * len);
    const t = document.createElementNS(NS, "text"); t.setAttribute("x", 26); t.setAttribute("y", 30); t.setAttribute("text-anchor", "middle"); t.textContent = label; svg.appendChild(t);
    return svg;
}
function want(pid, slot = unsub) {
    if (slot.has(pid)) return;
    slot.set(pid, store.watch("work/p_" + pid, (snap) => {
        if (snap.pending || !snap.exists || !snap.data || !snap.data.img) return;
        imgs.set(pid, snap.data); document.querySelectorAll('img[data-p="' + pid + '"]').forEach((i) => { i.src = snap.data.img; });
    }, () => {}));
}
/** Wait until every page is loaded (for PDFs). */
async function loadPages(pids, slot) {
    pids.forEach((p) => want(p, slot));
    for (let t = 0; t < 240 && pids.some((p) => !imgs.has(p)); t++) await new Promise((r) => setTimeout(r, 250));
    return pids.every((p) => imgs.has(p));
}
function download(blob, name) {
    const a = el("a"); a.href = URL.createObjectURL(blob); a.download = safeName(name) + ".pdf";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function spaceLine() {
    const used = index.reduce((s, m) => s + (m.bytes || 0), 0);
    const weeks = new Set(index.filter((m) => m.bytes).map((m) => fileOf(m.date).key)).size;
    const left = W.weeksLeft(used, FREE, weeks);
    const pace = left == null || used < 20 * 1048576 ? "" : left > 36 ? " · room for the rest of the year at this pace" : " · room for about " + left + " more weeks at this pace";
    $("space").textContent = "Scans use " + mb(used) + " of about 1,000 MB" + pace;
    $("space").dataset.state = used > FREE * 0.8 ? "bad" : "";
}
async function saveIndex() { await store.save("work/index", { sets: index, at: Date.now() }); }
function summary(set) {
    const people = new Set(set.pages.filter((p) => p.s && p.s !== KEY).map((p) => p.s));   // cleared pages still count: the work was turned in
    const live = set.pages.filter((p) => !p.gone);
    return { pages: live.length, bytes: live.reduce((s, p) => s + (p.b || 0), 0), students: people.size, unsorted: live.filter((p) => !p.s).length };
}
async function saveSetDoc(set) {
    set.at = Date.now(); await store.save("work/s_" + set.id, set);
    full.set(set.id, set);
    const meta = { id: set.id, title: set.title, period: set.period, date: set.date, kind: set.kind || "graded", std: set.std || "", cleared: set.cleared || "", ...summary(set) };
    index = index.some((m) => m.id === set.id) ? index.map((m) => m.id === set.id ? { ...m, ...meta } : m) : [...index, meta];
    await saveIndex();
}

/* ---------- views ---------- */
function show(v) {
    if (v !== "set" && v !== "match") { view = v; remember("view", v); }
    ["weekView", "kidView", "inView", "matchView", "setView"].forEach((id) => { $(id).hidden = id !== v + "View"; });
    [...$("viewTabs").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    document.querySelector(".wk-bar").hidden = v === "match";
    if (v === "week") drawWeek(); else if (v === "kid") drawKid(); else if (v === "in") drawIn();
    scrollTo({ top: 0 });
}
function draw() {
    [...$("periodTabs").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === period)));
    spaceLine();
    if (cur) return;
    if (view === "week") drawWeek(); else if (view === "kid") drawKid(); else if (view === "in") drawIn();
}

/* ---------- By week ---------- */
function drawWeek() {
    const t = W.tree(periodSets(), NW, isSchoolDay), box = $("tree"); box.replaceChildren();
    const all = t.flatMap((q) => q.weeks);
    if (!all.some((w) => w.key === weekKey)) weekKey = (all.find((w) => w.key === fileOf(todayIso()).key) || all[0] || {}).key || "";
    box.appendChild(el("p", "wk-year", "School year " + SCHOOL_YEAR.label));
    if (!t.length) box.appendChild(el("p", "wk-empty sm", "Nothing filed for " + period + " period yet."));
    t.forEach((q) => {
        const d = el("details", "wk-q"); d.open = q.weeks.some((w) => w.key === weekKey) || q === t[t.length - 1];
        const n = q.weeks.reduce((s, w) => s + w.sets.length, 0);
        const sm = el("summary", null, q.q ? ORD[q.q] + " nine weeks" : "No date"); sm.appendChild(el("span", "pill", String(n))); d.appendChild(sm);
        q.weeks.forEach((w) => {
            const b = el("button", "wk-wk"); b.type = "button"; b.setAttribute("aria-pressed", String(w.key === weekKey));
            b.append(el("b", null, w.label), el("span", null, w.range));
            b.onclick = () => { weekKey = w.key; drawWeek(); };
            d.appendChild(b);
        });
        box.appendChild(d);
    });
    const w = all.find((x) => x.key === weekKey), list = $("sets"); list.replaceChildren();
    $("wTitle").textContent = w ? w.label + " · " + period + " period" : period + " period";
    $("wMeta").textContent = w ? [ORD[w.q] + " nine weeks", w.range, w.sets.length + (w.sets.length === 1 ? " assignment" : " assignments")].join(" · ") : "";
    $("wPdf").hidden = !w;
    if (!w) {
        const p = el("div", "wk-empty"); p.appendChild(el("p", null, "No papers for " + period + " period yet. Scan a class stack on the school copier (scan to email), then bring it in here."));
        const b = el("button", "btn go", "Bring in a stack"); b.type = "button"; b.onclick = () => show("in"); p.appendChild(b); list.appendChild(p);
    }
    (w ? w.sets : []).forEach((m) => {
        const a = el("button", "wk-card"); a.type = "button";
        const total = roster(m.period).length, got = m.students || 0;
        a.appendChild(ring(total ? got / total : (got ? 1 : 0), total ? got + "/" + total : String(got)));
        a.appendChild(el("b", null, m.title));
        a.appendChild(el("span", null, [fmtDate(m.date), m.std, m.cleared ? "" : (m.pages || 0) + (m.pages === 1 ? " page" : " pages")].filter(Boolean).join(" · ")));
        const tags = el("span", "wk-tags");
        tags.appendChild(el("i", "pill " + (m.kind === "kept" ? "" : "g"), m.kind === "kept" ? "Kept on file" : "To grade"));
        if (m.unsorted) tags.appendChild(el("i", "pill a", m.unsorted + " not sorted"));
        if (m.cleared) tags.appendChild(el("i", "pill", "Saved to PDF, cleared"));
        a.appendChild(tags);
        a.onclick = () => openSet(m.id);
        list.appendChild(a);
    });
    drawClear();
}
$("wPdf").onclick = async () => {
    const w = W.tree(periodSets(), NW, isSchoolDay).flatMap((q) => q.weeks).find((x) => x.key === weekKey); if (!w) return;
    const b = $("wPdf"), was = b.textContent; b.disabled = true; b.textContent = "Making the PDF…";
    try {
        const sets = await fullSets(w.sets.map((m) => m.id));
        const pages = [];
        sets.forEach((set) => order(set).forEach((pg) => pages.push({ pg, label: (pg.s || "NOT SORTED") + "  |  " + set.title + "  |  " + fmtDate(set.date) })));
        await pdfOf(pages, { title: w.label + " (" + w.range + ") · " + period + " period", lines: sets.map((s) => s.title + " - " + fmtDate(s.date) + " - " + summary(s).students + " students") }, period + " period " + w.label + " " + w.range, b);
    } finally { b.disabled = false; b.textContent = was; }
};

/** Pages of a set in folder order: answer key, then roster order, then others, then not sorted. */
function order(set) {
    const r = roster(set.period), live = set.pages.filter((p) => !p.gone);
    const names = [KEY, ...r, ...[...new Set(live.map((p) => p.s).filter((s) => s && s !== KEY && !r.includes(s)))].sort(), ""];
    return names.flatMap((n) => live.filter((p) => (p.s || "") === n));
}
/** Make PDFs of [{ pg, label }], in parts a Chromebook can handle. Each later part waits for its own tap
    (browsers block several downloads from one tap). */
async function pdfOf(list, cover, name, btn) {
    const chunks = W.parts(list, 250);
    for (let i = 0; i < chunks.length; i++) {
        if (i > 0) {
            const next = el("button", "btn go", "Download part " + (i + 1) + " of " + chunks.length); next.type = "button";
            btn.after(next); await new Promise((r) => { next.onclick = r; }); next.remove();
        }
        btn.textContent = "Loading pages…";
        if (!(await loadPages(chunks[i].map((x) => x.pg.p), unsub))) { status("Some pages did not load. Try again.", "bad"); return false; }
        btn.textContent = "Making the PDF…";
        const pages = chunks[i].map((x) => { const d = imgs.get(x.pg.p); return { url: d.img, w: d.w, h: d.h, label: x.label }; });
        download(buildPdf(pages, i === 0 ? cover : null), name + (chunks.length > 1 ? " part " + (i + 1) : ""));
    }
    return true;
}
/** Load whole set docs (with page lists) once. */
function fullSets(ids) {
    return Promise.all(ids.map((id) => full.has(id) ? Promise.resolve(full.get(id)) : new Promise((ok) => {
        let u = null; u = store.watch("work/s_" + id, (snap) => {
            if (snap.pending) return;
            const d = snap.exists && snap.data && !snap.data.removed ? snap.data : { id, pages: [] };
            if (!d.pages) d.pages = []; full.set(id, d); ok(d); setTimeout(() => u && u(), 0);
        }, () => ok({ id, pages: [] }));
    })));
}

/* ---------- save a nine weeks, then clear ---------- */
function drawClear() {
    const body = $("clearBody"); body.replaceChildren();
    body.appendChild(el("p", "wk-help", "The free space holds roughly a nine weeks or two of every class's papers. When it gets full, save a finished nine weeks as PDFs (one per period, every student's papers in roster order), keep those PDFs in your school Google Drive, then clear the pictures here. The list of assignments and who turned what in stays."));
    const t = W.tree(index, NW, isSchoolDay);
    t.filter((q) => q.q).forEach((q) => {
        const live = q.weeks.flatMap((w) => w.sets).filter((m) => !m.cleared && m.pages);
        if (!live.length) return;
        const row = el("div", "wk-crow"); row.appendChild(el("b", null, ORD[q.q] + " nine weeks: " + live.length + " assignments, " + mb(live.reduce((s, m) => s + (m.bytes || 0), 0))));
        const btns = el("div", "wk-cbtns"), done = new Set();
        const clear = el("button", "bx", "Clear these scans"); clear.type = "button"; clear.disabled = true;
        PERIODS.forEach(([p]) => {
            const mine = live.filter((m) => m.period === p); if (!mine.length) return;
            const b = el("button", "btn ghost", "Save " + p + " period PDF"); b.type = "button";
            b.onclick = async () => {
                b.disabled = true; const was = b.textContent;
                try {
                    const sets = (await fullSets(mine.map((m) => m.id))).sort((a, c) => String(a.date).localeCompare(String(c.date)));
                    const r = roster(p), names = [...r, ...[...new Set(sets.flatMap((s) => s.pages.map((x) => x.s)).filter((s) => s && s !== KEY && !r.includes(s)))].sort(), KEY, ""];
                    const list = [];
                    names.forEach((n) => sets.forEach((s) => s.pages.filter((x) => !x.gone && (x.s || "") === n).forEach((pg) => list.push({ pg, label: (n || "NOT SORTED") + "  |  " + s.title + "  |  " + fmtDate(s.date) }))));
                    const ok = await pdfOf(list, { title: ORD[q.q] + " nine weeks · " + p + " period · student work", lines: ["Saved from Anchor Board " + fmtDate(todayIso()) + ".", "Papers are in roster order, each student's papers by date.", ...sets.map((s) => fmtDate(s.date) + " - " + s.title)] }, p + " period " + ORD[q.q] + " nine weeks student work", b);
                    if (ok) { done.add(p); b.textContent = "Saved ✓"; } else b.textContent = was;
                } catch (e) { b.textContent = was; fail(e); }
                b.disabled = false;
                clear.disabled = ![...new Set(live.map((m) => m.period))].every((x) => done.has(x));
            };
            btns.appendChild(b);
        });
        clear.onclick = async () => {
            if (clear.dataset.sure !== "1") { clear.dataset.sure = "1"; clear.textContent = "Tap again: delete " + live.reduce((s, m) => s + (m.pages || 0), 0) + " page pictures for good"; return; }
            clear.disabled = true; status("Clearing…"); busy = true;
            try {
                const sets = await fullSets(live.map((m) => m.id)), when = todayIso();
                for (const s of sets) {
                    for (const pg of s.pages) if (!pg.gone) { await store.save("work/p_" + pg.p, { removed: true, at: Date.now() }); pg.gone = 1; imgs.delete(pg.p); }
                    s.cleared = when; s.period = s.period || (index.find((m) => m.id === s.id) || {}).period; await saveSetDoc(s);
                }
                saved(); clear.textContent = "Cleared";
            } catch (e) { fail(e); }
            busy = false; draw();
        };
        btns.appendChild(clear); row.appendChild(btns); body.appendChild(row);
    });
    if (body.children.length === 1) body.appendChild(el("p", "wk-help", "Nothing to clear yet."));
}

/* ---------- By student ---------- */
function watchPeriodSets() {
    const ids = new Set(periodSets().map((m) => m.id));
    fullUnsub.forEach((u, id) => { if (!ids.has(id)) { u(); fullUnsub.delete(id); } });
    ids.forEach((id) => {
        if (fullUnsub.has(id)) return;
        fullUnsub.set(id, store.watch("work/s_" + id, (snap) => {
            if (snap.pending) return;
            if (snap.exists && snap.data && !snap.data.removed) { full.set(id, { pages: [], ...snap.data }); if (view === "kid" && !cur) drawKidBody(); }
        }, () => {}));
    });
    if (kidNotesUnsub) kidNotesUnsub();
    kidNotesUnsub = store.watch("work/k_" + period, (snap) => { if (snap.pending) return; kidNotes = (snap.exists && snap.data && snap.data.notes) || {}; if (view === "kid" && !cur && document.activeElement !== $("kNote")) drawKidBody(); }, () => {});
}
let kidsFor = "";
function drawKid() {
    if (kidsFor !== period) { kidsFor = period; fullUnsub.forEach((u) => u()); fullUnsub.clear(); }
    watchPeriodSets();
    const names = roster(), box = $("kids"); box.replaceChildren();
    const extra = [...new Set([...full.values()].filter((s) => s.period === period).flatMap((s) => s.pages.map((p) => p.s)).filter((s) => s && s !== KEY && !names.includes(s)))].sort();
    const all = [...names, ...extra];
    if (!all.includes(kid)) kid = all[0] || "";
    if (!all.length) box.appendChild(el("p", "wk-empty", "No roster for " + period + " period yet. Add it on the Rosters page, or file a stack first."));
    all.forEach((n) => {
        const b = el("button", null, n); b.type = "button"; b.setAttribute("aria-pressed", String(n === kid));
        b.onclick = () => { kid = n; history.replaceState(null, "", "?kid=" + encodeURIComponent(n) + "&per=" + period + (demo ? "&demo" : "")); drawKid(); };
        box.appendChild(b);
    });
    drawKidBody();
}
function drawKidBody() {
    const body = $("kidBody"); body.replaceChildren(); if (!kid) return;
    const sets = periodSets().map((m) => full.get(m.id) ? { ...m, ...full.get(m.id), period: m.period } : null).filter(Boolean);
    const loading = sets.length < periodSets().length;
    const weeks = W.folder(kid, sets, NW, isSchoolDay);
    const term = fileOf(todayIso()).q;
    const turnedIn = weeks.reduce((s, w) => s + w.items.filter((i) => !i.missing).length, 0), miss = weeks.reduce((s, w) => s + w.items.filter((i) => i.missing).length, 0);
    const head = el("div", "wk-khead");
    head.append(el("span", "wk-av", W.initials(kid)));
    const who = el("div"); who.append(el("b", null, kid), el("small", null, period + " period · " + turnedIn + (turnedIn === 1 ? " paper" : " papers") + (miss ? " · " + miss + " with no paper" : "") + (loading ? " · loading…" : ""))); head.appendChild(who);
    const sel = el("select"); sel.setAttribute("aria-label", "Which papers go in the PDF");
    [["q" + term, (ORD[term] || "This") + " nine weeks"], ["all", "Whole year"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.appendChild(o); });
    const pdf = el("button", "btn ghost", "Folder as one PDF"); pdf.type = "button";
    pdf.onclick = async () => {
        const pick = weeks.filter((w) => sel.value === "all" || "q" + w.q === sel.value).slice().reverse();
        const list = []; pick.forEach((w) => w.items.slice().reverse().forEach((i) => i.pages.filter((p) => !p.gone).forEach((pg) => list.push({ pg, label: kid + "  |  " + i.set.title + "  |  " + fmtDate(i.set.date) }))));
        if (!list.length) { status("No pictures to put in a PDF", "bad"); return; }
        pdf.disabled = true; const was = pdf.textContent;
        try {
            const lines = [period + " period · " + (sel.value === "all" ? "School year " + SCHOOL_YEAR.label : ORD[term] + " nine weeks"), ...pick.flatMap((w) => w.items.map((i) => w.label + " (" + w.range + ") - " + i.set.title + " - " + (i.missing ? "no paper" : i.pages.some((p) => p.gone) ? "saved to an earlier PDF" : "included")))];
            if (kidNotes[kid]) lines.push("Teacher note: " + kidNotes[kid]);
            await pdfOf(list, { title: kid + " · student work", lines }, kid + " " + period + " period work", pdf);
        } finally { pdf.disabled = false; pdf.textContent = was; }
    };
    const tools = el("div", "wk-ktools"); tools.append(sel, pdf); head.appendChild(tools);
    body.appendChild(head);

    const note = el("label", "wk-notes"); note.appendChild(el("span", null, "Private note about " + kid + " (only you see it; it goes on the front of the folder PDF)"));
    const ta = el("textarea"); ta.id = "kNote"; ta.rows = 2; ta.value = kidNotes[kid] || ""; ta.placeholder = "Example: Nov 19, still adds the angles instead of subtracting from 180. Pulled for small group Friday.";
    let t = 0; ta.oninput = () => { clearTimeout(t); t = setTimeout(async () => { kidNotes = { ...kidNotes, [kid]: ta.value }; try { await store.save("work/k_" + period, { notes: kidNotes, at: Date.now() }); saved(); } catch (e) { fail(e); } }, 700); };
    note.appendChild(ta); body.appendChild(note);

    if (!weeks.length) body.appendChild(el("p", "wk-empty", loading ? "Loading…" : "No papers filed for " + kid + " yet."));
    weeks.forEach((w) => {
        body.appendChild(el("h3", "wk-wh", w.label + " · " + w.range + (w.q ? " · " + ORD[w.q] + " nine weeks" : "")));
        const row = el("div", "wk-papers");
        w.items.forEach((i) => {
            const c = el("button", "wk-paper" + (i.missing ? " miss" : "")); c.type = "button";
            const im = el("span", "wk-pim");
            const live = i.pages.filter((p) => !p.gone);
            if (live.length) { const img = el("img"); img.alt = ""; img.dataset.p = live[0].p; img.loading = "lazy"; if (imgs.has(live[0].p)) img.src = imgs.get(live[0].p).img; else want(live[0].p); im.appendChild(img); }
            else im.appendChild(el("em", null, i.missing ? "No paper" : "Saved to PDF"));
            if (live.length > 1) im.appendChild(el("small", null, live.length + " pages"));
            c.append(im, el("b", null, i.set.title), el("span", null, [fmtDate(i.set.date), i.set.std, i.set.kind === "kept" ? "kept" : ""].filter(Boolean).join(" · ")));
            c.onclick = () => { lastView = "kid"; openSet(i.set.id, null, kid); };
            row.appendChild(c);
        });
        body.appendChild(row);
    });
}

/* ---------- Bring in a stack ---------- */
let stack = null;   // { name, pages: [{ url, w, h, bytes }] }
function drawIn() {
    $("iPeriod").value = period;
    if (!$("iDate").value) $("iDate").value = todayIso();
    const f = fileOf($("iDate").value);
    $("fileTo").replaceChildren();
    if (f.q) { $("fileTo").append("Files to "); $("fileTo").appendChild(el("b", null, SCHOOL_YEAR.label + " › " + ORD[f.q] + " nine weeks › " + f.label + " (" + f.range + ")")); $("fileTo").append(" from the date."); }
    const r = roster($("iPeriod").value).length;
    $("iNote").textContent = "";
    if (stack) {
        const per = +$("iPer").value, n = W.cut(stack.pages.length, per).length;
        $("iNote").textContent = stack.pages.length + " pages ÷ " + per + " = " + n + (n === 1 ? " paper" : " papers") + (r ? ". Roster has " + r + "." : ". No roster saved for this period.");
    }
    $("iGo").disabled = !stack || !$("iTitle").value.trim();
    if (stack && !$("iTitle").value.trim()) $("iNote").textContent += " Name the assignment.";
    suggestFromPlan();
}
["iPeriod", "iDate", "iPer", "iTitle", "iStd"].forEach((id) => { $(id).addEventListener("input", drawIn); $(id).addEventListener("change", drawIn); });
$("iPeriod").addEventListener("change", () => { if (stack) $("iPer").value = String(Math.min(6, W.guessPer(stack.pages.length, roster($("iPeriod").value).length))); drawIn(); });

/** Fill the title and standard lists from the Plan for that day (if the week was planned on the site). */
let planCache = new Map(), planFor = "";
function suggestFromPlan() {
    const date = $("iDate").value, per = $("iPeriod").value, f = fileOf(date), ask = f.q + "|" + f.n + "|" + per + "|" + date;
    if (!f.q || ask === planFor) return; planFor = ask;
    const id = weekIdFor(f.n, f.q), cls = (PERIODS.find((p) => p[0] === per) || [])[2];
    const i = Math.round((new Date(date + "T12:00:00") - new Date(f.monday + "T12:00:00")) / 864e5);   // 0 Monday … 4 Friday
    const use = (plan) => {
        const c = plan && plan.classes && plan.classes[cls]; const titles = new Set(index.map((m) => m.title).slice(-40)), stds = new Set();
        if (c) {
            const kind = (c.plans || [])[i], topic = (c.topic || "").replace(/^Unit \S+:\s*/, "");
            if (kind) titles.add(kind + (topic ? " · " + topic : ""));
            (c.standards || []).forEach((s) => stds.add(s));
            if (kind && !$("iTitle").value.trim()) { $("iTitle").placeholder = kind + (topic ? " · " + topic : ""); }
            if (!$("iStd").value.trim() && c.standards && c.standards[0]) $("iStd").placeholder = c.standards.join(", ");
        }
        $("titles").replaceChildren(...[...titles].reverse().map((v) => { const o = el("option"); o.value = v; return o; }));
        $("stds").replaceChildren(...[...stds].map((v) => { const o = el("option"); o.value = v; return o; }));
    };
    if (planCache.has(id)) { use(planCache.get(id)); return; }
    let u = null; u = store.watch("plans/" + id, (snap) => { if (snap.pending) return; const d = snap.exists ? snap.data : null; planCache.set(id, d); use(d); setTimeout(() => u && u(), 0); }, () => use(null));
}

async function takeStack(files) {
    files = [...files]; if (!files.length) return;
    const pdfs = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)), pics = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
    $("iGo").disabled = true; stack = null;
    const note = (t) => { $("dropSub").textContent = t; };
    try {
        const pages = [];
        for (const f of pdfs) pages.push(...await pdfPages(f, (d, n) => note("Reading " + f.name + ": page " + (d + 1 > n ? n : d + 1) + " of " + n + "…")));
        for (let i = 0; i < pics.length; i++) { note("Reading photo " + (i + 1) + " of " + pics.length + "…"); pages.push(await shrink(pics[i])); }
        if (!pages.length) { note("That file could not be read. Use the PDF from the copier, or photos (JPEG or PNG)."); return; }
        stack = { name: files.map((f) => f.name).join(", "), pages };
        $("dropTitle").textContent = files.length === 1 ? files[0].name : files.length + " files";
        note(pages.length + " pages · " + mb(pages.reduce((s, p) => s + p.bytes, 0)) + " once saved. Drop another file to start over.");
        $("iPer").value = String(Math.min(6, W.guessPer(pages.length, roster($("iPeriod").value).length)));
        if (!$("iTitle").value.trim() && $("iTitle").placeholder && !/^Example/.test($("iTitle").placeholder)) $("iTitle").value = $("iTitle").placeholder;
        if (!$("iStd").value.trim() && $("iStd").placeholder && $("iStd").placeholder !== "8.G.5") $("iStd").value = $("iStd").placeholder;
    } catch (e) { console.warn(e); note("That file could not be read (" + ((e && e.message) || "error") + "). Try the PDF straight from the copier email."); }
    drawIn();
}
$("stackFile").onchange = (e) => { const f = [...e.target.files]; e.target.value = ""; takeStack(f); };
const drop = $("drop");
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.dataset.over = "1"; }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.dataset.over = ""; }));
drop.addEventListener("drop", (e) => takeStack(e.dataTransfer.files));

/* ---------- Check names ---------- */
let match = null;   // { per, papers: [[a,b]], picks: {}, order, keyFirst, title, std, date, kind }
$("iGo").onclick = () => {
    if (!stack) return;
    match = { per: $("iPeriod").value, papers: W.cut(stack.pages.length, +$("iPer").value), picks: {}, order: $("iOrder").value, keyFirst: $("iKey").checked,
        title: $("iTitle").value.trim(), std: $("iStd").value.trim(), date: $("iDate").value, kind: $("iKind").value, read: null, byClaude: null };
    $("mReadNote").textContent = ""; $("pList").value = ""; $("pNote").textContent = ""; show("match"); drawMatch();
};
$("mBack").onclick = () => show("in");
$("mCrop").value = remember("crop") || "left";
$("mCrop").onchange = () => { remember("crop", $("mCrop").value); drawMatch(); };
function drawMatch() {
    const r = roster(match.per), names = W.matchNames(match.papers.length, r, match.picks, match.order, match.keyFirst);
    const miss = W.missing(r, names), dbl = W.doubles(names), blank = names.filter((n) => !n.name).length, guesses = names.filter((n) => n.guess).length;
    $("mTitle").textContent = match.title;
    $("mMeta").textContent = [match.per + " period", fmtDate(match.date), fileOf(match.date).label, match.papers.length + " papers"].join(" · ");
    const fl = $("mFlags"); fl.replaceChildren();
    if (guesses) fl.appendChild(el("span", "pill", guesses + " guessed from roster order: check the name boxes"));
    if (blank) fl.appendChild(el("span", "pill a", blank + " to pick"));
    if (dbl.length) fl.appendChild(el("span", "pill a", "Used twice: " + dbl.join(", ")));
    if (miss.length) fl.appendChild(el("span", "pill a", (miss.length === 1 ? "No paper: " : miss.length + " with no paper: ") + miss.join(", ")));
    if (!r.length) fl.appendChild(el("span", "pill a", "No roster for " + match.per + " period: type each name"));
    const box = $("papers"); box.replaceChildren();
    const opts = [["", "Who is this?"], ...r.map((n) => [n, n]), [KEY, "Answer key"], [W.SAME, "Same student as before (extra page)"], [W.SKIP, "Not a paper (skip it)"]];
    match.papers.forEach(([a, b], i) => {
        const n = names[i], rdi = match.read && match.read[i], unsure = rdi && match.byClaude && match.byClaude[i] && n.name && rdi.sure !== "high";
        const card = el("div", "wk-mp" + (n.name ? (n.guess ? " guess" : unsure ? " ask" : " ok") : " ask") + (dbl.includes(n.name) ? " ask" : ""));
        const crop = el("button", "wk-crop " + $("mCrop").value); crop.type = "button"; crop.title = "See the whole page";
        const img = el("img"); img.alt = "Top of paper " + (i + 1); img.src = stack.pages[a].url; crop.appendChild(img);
        crop.onclick = () => peek(a, b, i);
        card.appendChild(crop);
        const sel = el("select"); sel.setAttribute("aria-label", "Whose paper is number " + (i + 1));
        const list = opts.some(([v]) => v === n.name) ? opts : [...opts, [n.name, n.name]];
        list.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.appendChild(o); });
        sel.value = n.name;
        sel.onchange = () => { match.picks[i] = sel.value; if (match.byClaude) delete match.byClaude[i]; if (match.read) delete match.read[i]; drawMatch(); };
        card.appendChild(sel);
        const rd = match.read && match.read[i];
        if (rd) card.appendChild(el("span", "wk-read " + rd.sure + (rd.match && rd.match === n.name ? "" : " off"), rd.written ? "Claude read \u201c" + rd.written + "\u201d" + (rd.match ? (rd.sure === "high" ? "" : ", not sure") : ", no roster match") : "Claude could not read a name"));
        card.appendChild(el("small", null, "Paper " + (i + 1) + " · " + (b - a === 1 ? "page " + (a + 1) : "pages " + (a + 1) + "-" + b) + (n.guess ? " · guess" : "")));
        box.appendChild(card);
    });
    const left = names.filter((n) => !n.name).length;
    $("mFile").textContent = left ? "File the papers (" + left + " go to Not sorted)" : "File " + names.filter((n) => n.name && n.name !== W.SKIP && n.name !== W.SAME && n.name !== KEY).length + " papers";
}
/* ---------- Claude reads the name boxes (functions/index.js readNames) ---------- */
/** Cut the name strip from the top of a page: left or right 60% (or the whole width), top 14%. Small JPEG. */
async function strip(url, where) {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const sw = where === "whole" ? img.width : Math.round(img.width * 0.6), sx = where === "right" ? img.width - sw : 0, sh = Math.round(img.height * (where === "whole" ? 0.12 : 0.14));
    const k = Math.min(1, 760 / sw), c = document.createElement("canvas"); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, sx, 0, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
}
let callRead = null;
async function readCall(data) {
    if (demo) {   // ?demo: no server; pretend Claude read the roster-order names so the page can be tried
        await new Promise((r) => setTimeout(r, 600));
        return { papers: data.strips.map((_, i) => i < data.roster.length ? { written: data.roster[i], match: data.roster[i], sure: i % 4 === 3 ? "medium" : "high" } : { written: "", match: "", sure: "low" }) };
    }
    if (!callRead) {
        const { app } = await import("./firebase.js");
        const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js");
        callRead = httpsCallable(getFunctions(app, "us-central1"), "readNames", { timeout: 130000 });
    }
    return (await callRead(data)).data;
}
// Off until it is set up (it needs the paid Blaze plan and a Claude API key). Open work.html?claudenames=on once to show it.
if (params.get("claudenames")) remember("claudenames", params.get("claudenames") === "on" ? "on" : "");
$("mRead").hidden = !demo && remember("claudenames") !== "on";
$("mRead").onclick = async () => {
    const r = roster(match.per); if (!r.length) { $("mReadNote").textContent = "Add this period's roster first."; return; }
    const btn = $("mRead"), note = (t) => { $("mReadNote").textContent = t; };
    btn.disabled = true; note("Cutting the name strips…");
    try {
        const strips = []; for (const [a] of match.papers) strips.push(await strip(stack.pages[a].url, $("mCrop").value));
        const read = {};
        for (let k = 0; k < strips.length; k += 40) {
            note("Claude is reading names" + (strips.length > 40 ? " (" + (k + 1) + "-" + Math.min(strips.length, k + 40) + " of " + strips.length + ")" : "") + "…");
            const res = await readCall({ roster: r, strips: strips.slice(k, k + 40) });
            (res.papers || []).forEach((p, j) => { read[k + j] = p; });
        }
        match.read = read; let sure = 0, ask = 0;
        Object.entries(read).forEach(([i, p]) => {
            if (match.keyFirst && +i === 0) return;               // the answer key stays the key
            if (Object.prototype.hasOwnProperty.call(match.picks, i) && match.picks[i] && !match.byClaude?.[i]) return;   // the teacher's own pick wins
            match.byClaude = match.byClaude || {}; match.byClaude[i] = 1;
            if (p.match && p.sure !== "low") { match.picks[i] = p.match; if (p.sure === "high") sure++; else ask++; }
            else { match.picks[i] = ""; ask++; }
        });
        note("Claude read " + sure + " for sure" + (ask ? ". Check the " + ask + " marked in yellow." : ". Glance over them, then file."));
        drawMatch();
    } catch (e) {
        console.warn(e);
        const code = String((e && e.code) || "").replace("functions/", "");
        const notSetUp = code === "not-found" || (code === "internal" && /^internal$/i.test((e && e.message) || ""));   // no function deployed answers like this
        note(notSetUp ? "Claude name reading is not set up yet. Pick names by hand for now."
            : code === "failed-precondition" ? "Claude name reading needs its API key. Pick names by hand for now."
            : "Claude could not read the names (" + ((e && e.message) || code || "error") + "). Pick them by hand.");
    }
    btn.disabled = false;
};
/* ---------- free: Claude sorts in Eddie's own chat, the list is pasted back ---------- */
function askText() {
    const r = roster(match.per), per = match.papers.length ? match.papers[0][1] - match.papers[0][0] : 1;
    return [
        "Attached is a scanned class stack (" + stack.pages.length + " pages, " + per + (per === 1 ? " page" : " pages") + " per student, so " + match.papers.length + " papers in order).",
        "Read the handwritten name at the top of each paper and match it to this roster:",
        ...r.map((n) => "- " + n),
        "",
        "Answer only with a numbered list, one line per paper, in stack order: the number, then the roster name exactly as written above.",
        "Write \"?\" if you cannot tell, \"key\" for an answer key, \"skip\" for a blank or cover page, and \"same\" if a paper is really extra pages of the student before.",
        match.keyFirst ? "Paper 1 is the answer key." : "",
    ].filter((l) => l !== "").join("\n");
}
$("pAsk").onclick = async () => {
    try { await navigator.clipboard.writeText(askText()); $("pNote").textContent = "Copied. Paste it in Claude with the PDF."; }
    catch (e) { $("pList").value = askText(); $("pList").select(); $("pNote").textContent = "Could not copy. The request is in the box: copy it from there."; }
};
$("pFill").onclick = () => {
    const { picks, unknown, count } = W.parseNameList($("pList").value, roster(match.per));
    if (!count) { $("pNote").textContent = "No numbered lines found. Paste Claude's list as it came."; return; }
    let n = 0; Object.entries(picks).forEach(([i, v]) => { if (+i < match.papers.length) { match.picks[i] = v; n++; } });
    match.read = null; match.byClaude = null;
    const extra = count - n;
    $("pNote").textContent = "Filled " + n + (n === 1 ? " paper" : " papers") + "." + (unknown.length ? " No roster match for " + unknown.map((u) => "#" + u.n + " (" + u.text + ")").join(", ") + ": pick those." : "") + (extra > 0 ? " " + extra + " lines were past the last paper; check pages per student." : "");
    drawMatch();
};
function peek(a, b, i) {
    open = null; $("vImg").src = stack.pages[a].url; $("vTitle").textContent = "Paper " + (i + 1) + (b - a > 1 ? " (first page)" : "");
    $("viewer").dataset.mode = "peek"; $("viewer").showModal();
}
/** Save the stack. later: every page saved with no name (and its name strip), for Claude to sort through the connector. */
async function fileStack(later) {
    const r = roster(match.per), names = W.matchNames(match.papers.length, r, match.picks, match.order, match.keyFirst);
    const pages = later ? W.pagesFor(match.papers, match.papers.map((_, i) => ({ name: i === 0 && match.keyFirst ? KEY : "" }))) : W.pagesFor(match.papers, names);
    const btn = $(later ? "mLater" : "mFile"); btn.disabled = true; busy = true; status("Saving…");
    // same assignment, same day, same period: add to it instead of making a second one
    const same = index.find((m) => m.period === match.per && m.date === match.date && m.title.toLowerCase() === match.title.toLowerCase() && !m.cleared);
    try {
        const set = same ? (await fullSets([same.id]))[0] : { id: newId(), title: match.title, period: match.per, date: match.date, kind: match.kind, std: match.std, notes: "", pages: [] };
        set.period = match.per; if (!set.pages) set.pages = []; if (match.std && !set.std) set.std = match.std;
        if (match.papers.length) set.per = match.papers[0][1] - match.papers[0][0];
        for (let k = 0; k < pages.length; k++) {
            $("mNote").textContent = "Saving page " + (k + 1) + " of " + pages.length + "…";
            const pg = stack.pages[pages[k].page], pid = newId(), doc = { img: pg.url, w: pg.w, h: pg.h, set: set.id, at: Date.now() };
            if (later) try { doc.strip = await strip(pg.url, $("mCrop").value); } catch (e) { /* the whole page still works */ }
            await store.save("work/p_" + pid, doc);
            imgs.set(pid, { img: pg.url, w: pg.w, h: pg.h });
            set.pages.push({ p: pid, s: pages[k].s, b: pg.bytes + (doc.strip ? doc.strip.length : 0), w: pg.w, h: pg.h, at: Date.now() });
            if (k % 10 === 9) await saveSetDoc(set);   // a dropped connection keeps what was saved
        }
        await saveSetDoc(set);
        saved(); stack = null; $("dropTitle").textContent = "Drop the copier PDF here"; $("dropSub").textContent = "or tap to choose it. Phone photos of papers work too (pick them all at once, in stack order)."; $("iTitle").value = ""; $("iStd").value = "";
        busy = false; period = match.per; weekKey = fileOf(match.date).key; match = null; lastView = "week";
        openSet(set.id, set);
        if (later) $("sNote").textContent = "Saved with no names. In Claude, say: sort my " + set.period + " period stack \u201c" + set.title + "\u201d.";
    } catch (e) { fail(e); $("mNote").textContent = "Stopped. What was saved is kept; try again to add the rest."; }
    busy = false; btn.disabled = false;
}
$("mFile").onclick = () => fileStack(false);
$("mLater").onclick = () => fileStack(true);

/* ---------- one assignment ---------- */
function owners() {
    const r = roster(cur.period), extra = [...new Set(cur.pages.map((p) => p.s).filter((s) => s && s !== KEY && !r.includes(s)))].sort();
    return [KEY, ...r, ...extra];
}
let focusKid = "";
function openSet(id, given, who) {
    closeSet(true); focusKid = who || "";
    history.replaceState(null, "", "#" + id);
    let first = true;
    const showSet = (data) => {
        cur = { pages: [], ...data }; ["weekView", "kidView", "inView", "matchView"].forEach((v) => { $(v).hidden = true; }); $("setView").hidden = false; $("periodTabs").hidden = true;
        [...$("viewTabs").children].forEach((b) => b.setAttribute("aria-pressed", "false"));
        drawSet();
        if (first) { first = false; const row = focusKid && document.querySelector('.wk-stu[data-name="' + CSS.escape(focusKid) + '"]'); if (row) row.scrollIntoView({ block: "center" }); else scrollTo({ top: 0 }); }
    };
    if (given) showSet(given);
    unsub.set("set", store.watch("work/s_" + id, (snap) => {
        if (snap.pending || !snap.exists || !snap.data || snap.data.removed) return;
        if (busy && cur && cur.id === id) return;   // our own saves are already drawn
        showSet(snap.data);
    }, () => status("Could not load this assignment", "bad")));
}
function closeSet(keepView) {
    unsub.forEach((u) => u && u()); unsub.clear(); cur = null; $("periodTabs").hidden = false; document.querySelector(".wk-bar").hidden = false;
    if (!keepView) { history.replaceState(null, "", location.pathname + location.search); show(lastView); }
}
$("back").onclick = () => closeSet();

function thumb(pg, n, of) {
    const b = el("button", "wk-thumb"); b.type = "button"; b.title = "Open page";
    const i = el("img"); i.alt = (pg.s || "Not sorted") + ", page " + n; i.dataset.p = pg.p; i.loading = "lazy";
    if (imgs.has(pg.p)) i.src = imgs.get(pg.p).img; else want(pg.p);
    b.appendChild(i); if (of > 1) b.appendChild(el("small", null, n + "/" + of));
    if (pg.by === "claude" && pg.s) { b.appendChild(el("i", "wk-by", "Claude")); b.title = "Named by Claude: open to check"; }
    b.onclick = () => viewPage(pg);
    return b;
}
function addInput(label, who, camera) {
    const lab = el("label", "wk-add" + (camera ? " cam" : "")); lab.title = label;
    lab.appendChild(el("span", null, label));
    const inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.hidden = true; if (camera) inp.setAttribute("capture", "environment");
    inp.onchange = () => { const f = [...inp.files]; inp.value = ""; addPages(f, who); };
    lab.appendChild(inp); return lab;
}
function drawSet() {
    $("sTitle").textContent = cur.title;
    const live = cur.pages.filter((p) => !p.gone), sum = summary(cur), f = fileOf(cur.date);
    $("sMeta").textContent = [cur.period + " period", fmtDate(cur.date), f.q ? ORD[f.q] + " nine weeks, " + f.label : "", live.length + (live.length === 1 ? " page" : " pages"), sum.students + " of " + (roster(cur.period).length || "?") + " students", mb(sum.bytes), cur.cleared ? "pictures cleared " + fmtDate(cur.cleared) : ""].filter(Boolean).join(" · ");
    if (document.activeElement !== $("sNotes")) $("sNotes").value = cur.notes || "";
    $("sKind").value = cur.kind || "graded"; if (document.activeElement !== $("sStd")) $("sStd").value = cur.std || ""; if (document.activeElement !== $("sDate")) $("sDate").value = cur.date || "";
    $("names").replaceChildren(...owners().map((n) => { const o = el("option"); o.value = n; return o; }));
    $("rosterHelp").hidden = roster(cur.period).length > 0;

    const byClaude = live.filter((p) => p.by === "claude" && p.s);
    $("claudeBox").hidden = !byClaude.length;
    $("claudeNote").textContent = "Claude named " + byClaude.length + (byClaude.length === 1 ? " page" : " pages") + " (marked \u201cClaude\u201d below). Open any that look wrong to fix the name.";

    const loose = live.filter((p) => !p.s);
    $("unsortedBox").hidden = !loose.length; const ub = $("unsorted"); ub.replaceChildren();
    loose.forEach((pg) => {
        const card = el("div", "wk-sort"); card.appendChild(thumb(pg, 1, 1));
        const inp = el("input"); inp.type = "text"; inp.setAttribute("list", "names"); inp.placeholder = "Whose is this?"; inp.setAttribute("aria-label", "Whose page is this?"); inp.autocomplete = "off";
        inp.onchange = () => { const v = inp.value.trim(); if (v) move(pg.p, v); };
        card.appendChild(inp); ub.appendChild(card);
    });

    const box = $("students"); box.replaceChildren();
    owners().forEach((name) => {
        const mine = live.filter((p) => p.s === name), gone = cur.pages.some((p) => p.gone && p.s === name);
        const row = el("div", "wk-stu" + (mine.length ? "" : " none") + (name === KEY ? " key" : "") + (name === focusKid ? " focus" : "")); row.dataset.name = name;
        const head = el("div", "wk-sname"); head.appendChild(el("b", null, name)); head.appendChild(el("small", null, mine.length ? mine.length + (mine.length === 1 ? " page" : " pages") : gone ? "Saved to PDF, cleared" : (name === KEY ? "Optional" : "No work yet")));
        row.appendChild(head);
        const strip = el("div", "wk-strip"); mine.forEach((pg, k) => strip.appendChild(thumb(pg, k + 1, mine.length)));
        strip.appendChild(addInput("Snap", name, true)); strip.appendChild(addInput("File", name, false));
        row.appendChild(strip); box.appendChild(row);
    });
}
async function saveSet() { await saveSetDoc(cur); }
$("claudeOk").onclick = async () => {
    if (!cur) return; cur.pages.forEach((p) => { delete p.by; });
    busy = true; status("Saving…"); try { await saveSet(); saved(); } catch (e) { fail(e); } busy = false; drawSet();
};

async function addPages(files, who) {
    files = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    if (!files.length) return;
    busy = true; let done = 0, bad = 0; const note = (t) => { $("sNote").textContent = t; };
    for (const f of files) {
        note("Saving page " + (done + bad + 1) + " of " + files.length + "…"); status("Saving…");
        try {
            const s = await shrink(f), pid = newId();
            await store.save("work/p_" + pid, { img: s.url, w: s.w, h: s.h, set: cur.id, at: Date.now() });
            imgs.set(pid, { img: s.url, w: s.w, h: s.h });
            cur.pages.push({ p: pid, s: who || "", b: s.bytes, w: s.w, h: s.h, at: Date.now() });
            await saveSet(); done++; drawSet();
        } catch (e) { bad++; console.warn(e); }
    }
    busy = false;
    note(done + (done === 1 ? " page saved" : " pages saved") + (bad ? ". " + bad + " could not be read (iPhone HEIC photos: take them with the Snap button instead)." : "."));
    status(bad ? "Some pages failed" : (demo ? "This device only" : "Saved"), bad ? "bad" : "ok");
}
$("snap").onchange = (e) => { const f = [...e.target.files]; e.target.value = ""; addPages(f, ""); };
$("pick").onchange = (e) => { const f = [...e.target.files]; e.target.value = ""; addPages(f, ""); };

async function move(pid, who) {
    const pg = cur.pages.find((p) => p.p === pid); if (!pg) return;
    const m = owners().find((n) => n.toLowerCase() === who.toLowerCase()); pg.s = m || who; delete pg.by;   // the teacher's pick: no longer Claude's
    busy = true; status("Saving…");
    try { await saveSet(); saved(); } catch (e) { fail(e); }
    busy = false; drawSet();
}
const later = (fn) => { let t = 0; return () => { clearTimeout(t); t = setTimeout(fn, 700); }; };
async function saveField(fn) { if (!cur) return; fn(); busy = true; try { await saveSet(); saved(); } catch (e) { fail(e); } busy = false; }
$("sNotes").oninput = later(() => saveField(() => { cur.notes = $("sNotes").value; }));
$("sStd").oninput = later(() => saveField(() => { cur.std = $("sStd").value.trim(); }));
$("sKind").onchange = () => saveField(() => { cur.kind = $("sKind").value; });
$("sDate").onchange = () => { if ($("sDate").value) saveField(() => { cur.date = $("sDate").value; drawSet(); }); };

/* ---------- viewer ---------- */
let open = null;
function viewPage(pg) {
    open = pg; $("viewer").dataset.mode = ""; const d = imgs.get(pg.p); $("vImg").src = d ? d.img : ""; $("vTitle").textContent = pg.s || "Not sorted yet";
    $("vWho").value = pg.s || ""; $("vDel").dataset.sure = ""; $("vDel").textContent = "Delete page"; $("viewer").showModal();
}
$("vClose").onclick = () => $("viewer").close();
$("viewer").addEventListener("click", (e) => { if (e.target === $("viewer")) $("viewer").close(); });
async function turn(dir) {
    if ($("viewer").dataset.mode === "peek") return;
    const d = imgs.get(open.p); if (!d) return;
    status("Saving…");
    try {
        const r = await rotate(d.img, dir); await store.save("work/p_" + open.p, { img: r.url, w: r.w, h: r.h, set: cur.id, at: Date.now() });
        imgs.set(open.p, { img: r.url, w: r.w, h: r.h }); Object.assign(open, { w: r.w, h: r.h, b: r.bytes }); $("vImg").src = r.url;
        document.querySelectorAll('img[data-p="' + open.p + '"]').forEach((i) => { i.src = r.url; });
        busy = true; await saveSet(); busy = false; saved();
    } catch (e) { busy = false; fail(e); }
}
$("vLeft").onclick = () => turn(-1);
$("vRight").onclick = () => turn(1);
$("vWho").onchange = () => { const v = $("vWho").value.trim(); $("vTitle").textContent = v || "Not sorted yet"; move(open.p, v); };
$("vDel").onclick = async () => {
    if ($("vDel").dataset.sure !== "1") { $("vDel").dataset.sure = "1"; $("vDel").textContent = "Tap again to delete"; return; }
    const pid = open.p; $("viewer").close(); status("Deleting…");
    try {
        await store.save("work/p_" + pid, { removed: true, at: Date.now() });
        cur.pages = cur.pages.filter((p) => p.p !== pid); imgs.delete(pid);
        busy = true; await saveSet(); busy = false; drawSet(); status("Deleted", "ok");
    } catch (e) { busy = false; fail(e); }
};

/* ---------- PDF for grading ---------- */
$("pdf").onclick = async () => {
    const live = cur.pages.filter((p) => !p.gone);
    if (!live.length) { $("sNote").textContent = "Add some pages first."; return; }
    $("sNote").textContent = "Making the PDF…";
    if (!(await loadPages(live.map((p) => p.p), unsub))) { $("sNote").textContent = "Some pages have not loaded yet. Try again in a moment."; return; }
    const order = owners(), sorted = [];
    order.forEach((name) => { const mine = live.filter((p) => p.s === name); mine.forEach((p, k) => sorted.push({ ...p, label: (name === KEY ? "ANSWER KEY" : name) + "  -  page " + (k + 1) + " of " + mine.length })); });
    live.filter((p) => !p.s).forEach((p, k) => sorted.push({ ...p, label: "NOT SORTED  -  loose page " + (k + 1) }));
    const pages = sorted.map((p) => { const d = imgs.get(p.p); return { url: d.img, w: d.w, h: d.h, label: p.label + "   |   " + cur.title }; });
    const r = roster(cur.period), withWork = order.filter((n) => n !== KEY && live.some((p) => p.s === n)), miss = r.filter((n) => !withWork.includes(n));
    const lines = [
        cur.period + " period (" + (PERIODS.find(([k]) => k === cur.period) || [, ""])[1] + ")  -  " + fmtDate(cur.date) + (cur.std ? "  -  " + cur.std : ""),
        "Grading notes: " + (cur.notes && cur.notes.trim() ? cur.notes.trim() : "none given"),
        "Answer key: " + (live.some((p) => p.s === KEY) ? "scanned, comes first" : "not scanned"),
        "Students with work (" + withWork.length + "): " + withWork.map((n) => n + " (" + live.filter((p) => p.s === n).length + "p)").join(", "),
        miss.length ? "No work scanned (" + miss.length + "): " + miss.join(", ") : "",
        live.some((p) => !p.s) ? "Some pages are not sorted to a student yet; they come last." : "",
        "Please return scores as a table: one row per student, columns Student, Score, Out of, and a short note.",
    ].filter(Boolean);
    const blob = buildPdf(pages, { title: cur.title, lines });
    download(blob, cur.period + " " + cur.title + " " + (cur.date || ""));
    $("sNote").textContent = "PDF downloaded: " + pages.length + " pages, " + mb(blob.size) + ".";
};

$("delSet").onclick = async () => {
    const b = $("delSet"), live = cur.pages.filter((p) => !p.gone);
    if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Tap again to delete " + live.length + " pages for good"; return; }
    status("Deleting…"); const id = cur.id;
    try {
        for (const pg of live) await store.save("work/p_" + pg.p, { removed: true, at: Date.now() });
        await store.save("work/s_" + id, { removed: true, at: Date.now() });
        index = index.filter((m) => m.id !== id); full.delete(id); await saveIndex();
        b.dataset.sure = ""; b.textContent = "Delete this assignment and its scans"; closeSet(); status("Deleted", "ok");
    } catch (e) { fail(e); }
};

/* ---------- New assignment from photos (the old way, still handy for one or two papers) ---------- */
$("nMake").onclick = async () => {
    const title = $("nTitle").value.trim(), per = $("nPeriod").value, date = $("nDate").value;
    if (!title) { $("nNote").textContent = "Name the assignment first."; return; }
    const set = { id: newId(), title, period: per, date, kind: "graded", std: "", notes: "", pages: [] };
    status("Saving…");
    try {
        await saveSetDoc(set); saved(); $("nTitle").value = ""; $("nNote").textContent = ""; $("newBox").open = false;
        period = per; lastView = "week"; openSet(set.id, set);
    } catch (e) { fail(e); }
};

/* ---------- start ---------- */
PERIODS.forEach(([k, label]) => {
    const b = el("button", null, k + " period"); b.type = "button"; b.dataset.k = k; b.title = label;
    b.onclick = () => { period = k; saveSharedPeriod(k); remember("period", k); if (cur) closeSet(true); draw(); show(view); };
    $("periodTabs").appendChild(b);
    for (const id of ["nPeriod", "iPeriod"]) { const o = el("option", null, k + " period, " + label); o.value = k; $(id).appendChild(o); }
});
[...$("viewTabs").children].forEach((b) => { b.onclick = () => { if (cur) closeSet(true); lastView = b.dataset.v; show(b.dataset.v); }; });
$("nDate").value = todayIso(); $("iDate").value = todayIso();

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    $("who").textContent = demo ? "This device only, nothing is saved" : "Signed in as " + user.name;
    if (demo) await store.save("rosters/all", { periods: { "1st": ["Ava M.", "Ben C.", "Chloe D.", "Diego F.", "Ella G.", "Finn H."], "2nd": ["Gia K.", "Hank L."], "4th": [], "5th": [], "6th": [] } });
    if (params.has("kid")) view = "kid";
    store.watch("rosters/all", (snap) => { if (snap.pending) return; rosters = (snap.exists && snap.data && snap.data.periods) || {}; if (cur) drawSet(); else if (!match) draw(); }, () => {});
    let first = true;
    store.watch("work/index", (snap) => {
        if (snap.pending || busy) return;
        index = ((snap.exists && snap.data && snap.data.sets) || []).filter((m) => m && m.id);
        if (first) {
            first = false; status(demo ? "This device only" : "Live", "ok");
            const h = location.hash.slice(1), m = index.find((x) => x.id === h);
            if (m) { period = m.period; draw(); openSet(m.id); return; }
            show(view);
        }
        if (!cur && !match) draw(); else spaceLine();
    }, (e) => status("Could not load student work (" + ((e && e.code) || "error") + ")", "bad"));
}
