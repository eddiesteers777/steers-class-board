/* ==========================================
   Focal — Class Page (class.html?t=<teacher>&c=<class>). Public, no sign-in.
   What a student or parent sees for one class: this week's plan day by day, the quiz or test, homework,
   the learning targets, every student paper ready to print (bellringer sheet, guided notes, study guide;
   never a key), and Extra Help videos. Reads only pub/{teacher}/... (see js/publish.js).
   &w=week6 opens a given week; &p=notes2 opens a paper straight away.
========================================== */
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { bellringerSheet, notesSheet, studyGuideSheet, rich } from "./weekSheets.js?v=59";

const qs = new URLSearchParams(location.search), T = qs.get("t") || "", C = qs.get("c") || "";
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const iso = (d) => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
const dayIso = (w, i) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w.monday || ""); return m ? iso(new Date(+m[1], +m[2] - 1, +m[3] + i)) : ""; };
const md = (w, i) => { const s = dayIso(w, i); return s ? (+s.slice(5, 7)) + "/" + (+s.slice(8)) : ""; };

let index = null, week = null, cls = null;

function fail(msg) { $("skel").hidden = true; const m = $("main"); m.textContent = ""; const b = el("section", "cp-empty"); b.appendChild(el("h1", null, "This page is not ready")); b.appendChild(el("p", null, msg)); m.appendChild(b); }

/* ---------- papers ---------- */
function openPaper(kind) {
    const w = { id: week.id, label: week.label, dates: week.dates, monday: week.monday, classes: { [C]: cls } };
    let sheet = null, title = "";
    try {
        if (kind === "bell") { sheet = bellringerSheet(w, C); title = "Bellringer sheet"; }
        else if (kind === "sg") { sheet = studyGuideSheet(w, C); title = "Study guide"; }
        else if (/^notes[0-4]$/.test(kind)) { const i = +kind.slice(5); sheet = notesSheet(w, C, i, false); title = DAYS[i] + " guided notes"; }
    } catch (e) { sheet = null; }
    if (!sheet) return;
    const box = $("paper"); box.textContent = "";
    const bar = el("div", "cp-paperbar");
    bar.appendChild(el("b", null, title));
    const pr = el("button", "cp-btn go", "Print"); pr.type = "button"; pr.onclick = () => window.print(); bar.appendChild(pr);
    const x = el("button", "cp-btn", "Close"); x.type = "button"; x.onclick = closePaper; bar.appendChild(x);
    box.appendChild(bar); const pg = el("div", "cp-sheet"); pg.appendChild(sheet); box.appendChild(pg);
    box.hidden = false; document.body.classList.add("paper-open"); box.focus();
    history.replaceState(null, "", setQ({ p: kind }));
}
function closePaper() { $("paper").hidden = true; $("paper").textContent = ""; document.body.classList.remove("paper-open"); history.replaceState(null, "", setQ({ p: null })); }
function setQ(o) { const q = new URLSearchParams(location.search); Object.entries(o).forEach(([k, v]) => (v == null ? q.delete(k) : q.set(k, v))); return "?" + q.toString(); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("paper").hidden) closePaper(); });

/* ---------- the page ---------- */
function videoCard(v) {
    const id = v.id || ((/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/.exec(v.u || "") || [])[1]);
    const card = el("figure", "cp-video");
    if (id) {
        const b = el("button", "cp-thumb"); b.type = "button"; b.setAttribute("aria-label", "Play " + (v.t || "video"));
        const img = el("img"); img.src = "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg"; img.alt = ""; img.loading = "lazy"; b.appendChild(img); b.appendChild(el("span", "cp-play", "▶"));
        b.onclick = () => { const f = el("iframe"); f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0"; f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true; f.title = v.t || "video"; b.replaceWith(f); };
        card.appendChild(b);
    }
    const cap = el("figcaption"); cap.appendChild(el("b", null, v.t || "Video")); if (v.ch) cap.appendChild(el("span", null, v.ch));
    const a = el("a", null, "Open on YouTube"); a.href = id ? "https://www.youtube.com/watch?v=" + id : v.u; a.target = "_blank"; a.rel = "noopener"; cap.appendChild(a);
    card.appendChild(cap); return card;
}
function draw() {
    const t = iso(new Date()), m = $("main"); m.textContent = "";
    document.title = cls.label + " | " + week.label;
    $("who").textContent = cls.cls || cls.label;

    const hero = el("section", "cp-hero");
    hero.appendChild(el("p", "cp-kicker", week.label + " · " + week.dates));
    hero.appendChild(el("h1", null, cls.topic ? cls.topic.replace(/^(Topic|Unit)\s+\w+:\s*/i, "") : cls.label));
    if (cls.weekLT) { const lt = el("p", "cp-lt"); lt.appendChild(el("b", null, "This week: ")); lt.appendChild(rich(cls.weekLT)); hero.appendChild(lt); }
    const facts = el("div", "cp-facts");
    const tests = cls.days.map((d, i) => [d, i]).filter(([d]) => /\b(quiz|test)\b/i.test(d.agendaLine || ""));
    tests.forEach(([d, i]) => { const f = el("div", "cp-fact hot"); f.appendChild(el("b", null, /\btest\b/i.test(d.agendaLine) ? "Test" : "Quiz")); f.appendChild(el("span", null, DAYS[i] + " " + md(week, i))); facts.appendChild(f); });
    if (cls.homework) { const f = el("div", "cp-fact"); f.appendChild(el("b", null, "Homework")); f.appendChild(el("span", null, cls.homework)); facts.appendChild(f); }
    if (facts.children.length) hero.appendChild(facts);
    m.appendChild(hero);

    // Day by day
    const days = el("section", "cp-days"); days.setAttribute("aria-label", "Day by day");
    cls.days.forEach((d, i) => {
        const di = dayIso(week, i), card = el("article", "cp-day" + (di === t ? " today" : "") + (/no school/i.test(d.agendaLine) ? " off" : ""));
        const h = el("div", "cp-dayh"); h.appendChild(el("b", null, DAYS[i])); h.appendChild(el("span", null, md(week, i))); if (di === t) h.appendChild(el("em", null, "Today")); card.appendChild(h);
        const line = el("p", "cp-line"); line.appendChild(rich(d.agendaLine || "")); card.appendChild(line);
        if (d.lt && !/no school/i.test(d.agendaLine)) { const lt = el("p", "cp-daylt"); lt.appendChild(rich("I can " + d.lt.replace(/^I can\s*/i, ""))); card.appendChild(lt); }
        if (d.notes) { const b = el("button", "cp-btn", "Guided notes"); b.type = "button"; b.onclick = () => openPaper("notes" + i); card.appendChild(b); }
        if ((d.problems || []).length) {
            const det = el("details", "cp-bell"); det.appendChild(el("summary", null, "Bellringer (" + d.problems.length + ")"));
            const ol = el("ol"); d.problems.forEach((p) => { const li = el("li"); li.appendChild(rich(p.q)); ol.appendChild(li); }); det.appendChild(ol); card.appendChild(det);
        }
        days.appendChild(card);
    });
    m.appendChild(days);

    // Papers to print
    const papers = el("section", "cp-sec"); papers.appendChild(el("h2", null, "Papers"));
    const grid = el("div", "cp-papers");
    const add = (kind, title, sub) => { const b = el("button", "cp-paperbtn"); b.type = "button"; b.appendChild(el("b", null, title)); b.appendChild(el("span", null, sub)); b.onclick = () => openPaper(kind); grid.appendChild(b); };
    if (cls.days.some((d) => (d.problems || []).length)) add("bell", "Bellringer sheet", "All week, one page");
    cls.days.forEach((d, i) => { if (d.notes) add("notes" + i, (d.notes.title || "Guided notes"), DAYS[i] + "'s guided notes"); });
    if (cls.studyGuide) add("sg", cls.studyGuide.title || "Study guide", "For the quiz or test");
    (cls.links || []).forEach((l) => { const a = el("a", "cp-paperbtn"); a.href = l.u; a.target = "_blank"; a.rel = "noopener"; a.appendChild(el("b", null, l.t || "Document")); a.appendChild(el("span", null, "Opens in Google Drive")); grid.appendChild(a); });
    if (grid.children.length) { papers.appendChild(grid); m.appendChild(papers); }

    if ((cls.videos || []).length) {
        const v = el("section", "cp-sec"); v.appendChild(el("h2", null, "Extra help videos"));
        const g = el("div", "cp-videos"); cls.videos.forEach((x) => g.appendChild(videoCard(x))); v.appendChild(g); m.appendChild(v);
    }

    // Other weeks
    const others = (index.weeks || []).filter((w) => w.id !== week.id).slice(-8).reverse();
    if (others.length) {
        const s = el("section", "cp-sec"); s.appendChild(el("h2", null, "Other weeks"));
        const row = el("div", "cp-weeks"); others.forEach((w) => { const a = el("a", "cp-chip", w.label + " · " + w.dates); a.href = setQ({ w: w.id, p: null }); row.appendChild(a); }); s.appendChild(row); m.appendChild(s);
    }
    $("skel").hidden = true;
    const p = qs.get("p"); if (p) openPaper(p);
}

async function start() {
    if (!/^[\w-]{1,128}$/.test(T) || !/^[\w-]{2,20}$/.test(C)) { fail("The link is missing part of its address. Ask your teacher for the class link."); return; }
    try {
        const s = await getDoc(doc(db, "pub/" + T + "/index"));
        index = s.exists() ? s.data() : null;
        if (!index || !(index.weeks || []).length) { fail("Your teacher has not posted a week yet. Check back soon."); return; }
        const t = iso(new Date()), want = qs.get("w");
        let pick = (index.weeks || []).find((w) => w.id === want);
        if (!pick) { pick = index.weeks[0]; for (const w of index.weeks) if (w.monday && dayIso(w, -2) <= t) pick = w; }   // from the Saturday before, a week is "this week"
        const ws = await getDoc(doc(db, "pub/" + T + "/weeks/" + pick.id));
        week = ws.exists() ? ws.data() : null; cls = week && week.classes && week.classes[C];
        if (!cls) { fail("This class has nothing posted for " + pick.label + " yet."); return; }
        draw();
    } catch (e) { fail("The page could not load. Check the internet connection and try again."); }
}
start();
