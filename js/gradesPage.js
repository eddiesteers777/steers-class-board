/* ==========================================
   Anchor Board — Grades (grades.html). The teacher's gradebook: one period, one nine weeks at a time.
   Rules live in js/gradeCore.js. Scores come in from Assignments and Class Data, or are typed here.
   Reads: rosters/all, asg/index + asg/a_<id>, data/index + data/i_<id>.
   Writes only its own documents: gb/setup, gb/items, gb/s_<id> (all private, under teacher/{uid}/).
   Nothing here is student-visible, and nothing goes on the board.
   ?demo: made-up students in this tab only (js/gradesDemo.js), nothing is saved.
========================================== */
import { sharedPeriod, saveSharedPeriod } from "./studentsNav.js?v=6";
import * as G from "./gradeCore.js?v=4";
import { shortNames } from "./vaultCore.js?v=75";
import { buildProgress, BAND_WORD } from "./progress.js?v=4";
import { lineChart } from "./charts.js?v=1";
import { STANDARDS } from "../data/standards.js?v=60";
import { SCHOOL_YEAR } from "./schoolCal.js?v=59";

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };
const short = (t, n = 26) => (t && t.length > n ? t.slice(0, n - 1).trim() + "…" : t || "");
const fmtDay = (d) => { const t = new Date(d + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
const remember = (k, v) => { try { if (v === undefined) return localStorage.getItem("anchorboard-grades-" + k); localStorage.setItem("anchorboard-grades-" + k, v); } catch (e) { return null; } return null; };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ord = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
const TERMS = SCHOOL_YEAR.nineWeeks;

export async function mountGrades() {
    const demo = new URLSearchParams(location.search).has("demo");
    const store = await import(demo ? "./localStore.js?v=57" : "./boardStore.js?v=58");
    const PER = demo ? [["1st", "8th"], ["2nd", "8th"], ["5th", "7th"], ["6th", "8th-acc"]] : (await import("../data/weeks.js?v=63")).PERIODS;
    const CLS = Object.fromEntries(PER);
    const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };

    const S = { period: [sharedPeriod(""), remember("period")].find((p) => p && PER.some((x) => x[0] === p)) || PER[0][0], term: +remember("term") || G.termOf(G.isoDay(), TERMS) || 1, view: "table", item: "", focus: "" };
    if (!CLS[S.period]) S.period = PER[0][0];
    const D = { rosters: null, setupRaw: null, items: null, skip: [], hand: new Map(), asgIndex: [], asg: new Map(), dataIndex: null, imports: new Map() };

    // ---------- controls ----------
    PER.forEach(([p]) => { const b = btn(null, p + " period", () => { S.period = p; remember("period", p); saveSharedPeriod(p); if (S.view === "item") S.view = "table"; draw(); }); b.dataset.k = p; $("periodTabs").append(b); });
    TERMS.forEach((t) => { const o = el("option", null, ord(t.n) + " nine weeks"); o.value = t.n; $("term").append(o); });
    $("term").value = S.term; $("term").onchange = () => { S.term = +$("term").value; remember("term", S.term); if (S.view === "item") S.view = "table"; draw(); };
    [...$("views").children].forEach((b) => { b.onclick = () => { S.view = b.dataset.v; draw(); }; });

    const user = await store.ready();
    if (!user) { location.replace("login.html"); return; }
    if (demo) { const { seedDemo } = await import("./gradesDemo.js?v=1"); await seedDemo(store); }
    $("who").textContent = demo ? "Sample students, nothing is saved" : "Signed in as " + user.name;

    // ---------- loading ----------
    let drawT = 0, held = false; const soon = () => { clearTimeout(drawT); drawT = setTimeout(draw, 60); };
    const once = (path, fn) => { let done = false, un = null; un = store.watch(path, (s) => { if (done || s.pending) return; done = true; fn(s.exists ? s.data : null); if (un) setTimeout(un, 0); }, () => { if (!done) { done = true; fn(null); } }); };
    store.watch("rosters/all", (s) => { if (s.pending) return; D.rosters = (s.exists && s.data && s.data.periods) || {}; soon(); }, () => { D.rosters = {}; soon(); });
    store.watch("gb/setup", (s) => { if (s.pending) return; D.setupRaw = (s.exists && s.data) || {}; soon(); }, () => { D.setupRaw = {}; soon(); });
    store.watch("gb/items", (s) => {
        if (s.pending) return; D.items = ((s.exists && s.data && s.data.list) || []).filter((x) => x && x.id); D.skip = (s.exists && s.data && s.data.skip) || [];
        D.items.forEach(watchItem); status(demo ? "Sample data" : "Live", "ok"); soon();
    }, (e) => status("Could not load grades (" + ((e && e.code) || "error") + ")", "bad"));
    store.watch("asg/index", (s) => { if (s.pending) return; D.asgIndex = ((s.exists && s.data && s.data.list) || []).filter((x) => x && x.id); soon(); }, () => {});
    store.watch("data/index", (s) => {
        if (s.pending) return; D.dataIndex = (s.exists && s.data && s.data.imports) || [];
        D.dataIndex.forEach((m) => { if (!D.imports.has(m.id)) { D.imports.set(m.id, null); once("data/i_" + m.id, (d) => { D.imports.set(m.id, d && d.rows ? d : false); soon(); }); } });
        soon();
    }, () => { D.dataIndex = []; soon(); });
    const watched = new Set(), dirty = new Map();
    function watchItem(it) {
        if (!watched.has(it.id)) {
            watched.add(it.id);
            store.watch("gb/s_" + it.id, (s) => { if (s.pending) return; if (!dirty.has(it.id)) D.hand.set(it.id, (s.exists && s.data) || { sc: {} }); soon(); }, () => {});
        }
        if (it.src && it.src.k === "asg" && !D.asg.has(it.src.id)) { D.asg.set(it.src.id, null); store.watch("asg/a_" + it.src.id, (s) => { if (s.pending) return; D.asg.set(it.src.id, s.exists ? s.data : false); soon(); }, () => { D.asg.set(it.src.id, false); }); }
    }

    // ---------- saving ----------
    const saveItems = () => store.save("gb/items", { list: D.items, skip: D.skip.slice(-500), at: Date.now() });
    const saveSetup = (s) => { D.setupRaw = s; return store.save("gb/setup", Object.assign({}, s, { at: Date.now() })); };
    function handChanged(id) {
        clearTimeout(dirty.get(id)); status("Saving…", "wait");
        dirty.set(id, setTimeout(async () => {
            try { await store.save("gb/s_" + id, { sc: (D.hand.get(id) || {}).sc || {}, at: Date.now() }); status(demo ? "Sample data" : "Saved", "ok"); }
            catch (e) { status("Not saved (" + ((e && e.code) || "error") + "). Your typing is still here; try again.", "bad"); }
            finally { dirty.delete(id); }
        }, 500));
    }

    // ---------- the model for the period on screen ----------
    const setup = () => G.cleanSetup(D.setupRaw);
    const rosterOf = (p) => shortNames(((D.rosters || {})[p] || []).filter(Boolean));
    const ctx = () => ({ asg: new Map([...D.asg].filter(([, v]) => v)), imports: new Map([...D.imports].filter(([, v]) => v)), hand: D.hand });
    const catOf = (st, id) => st.cats.find((c) => c.id === id) || st.cats[0];
    const bandOf = (v, st) => { if (v == null) return ""; const L = G.letter(v, st.scale), i = st.scale.findIndex((x) => x[0] === L); return i <= 1 ? "ok" : i < st.scale.length - 1 ? "mid" : "no"; };
    const ready = () => D.rosters && D.setupRaw && D.items && D.dataIndex && ![...D.asg.values()].some((x) => x === null);

    function draw() {
        // Never pull a score box out from under the teacher's typing: hold the redraw until they leave the list.
        const a = document.activeElement; if (S.view === "item" && a && a.tagName === "INPUT" && $("out").contains(a)) { held = true; return; }
        held = false;
        [...$("periodTabs").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === S.period)));
        [...$("views").children].forEach((b) => { const on = b.dataset.v === S.view || (S.view === "item" && b.dataset.v === "table"); b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-selected", String(on)); });
        const out = $("out");
        if (!ready()) { out.replaceChildren(skeleton()); return; }
        const st = setup(), cands = G.candidates(D.asgIndex, D.dataIndex, D.items, D.skip, st);
        const nCand = cands.filter((c) => c.periods.includes(S.period)).length;
        const addTab = [...$("views").children].find((b) => b.dataset.v === "add"); addTab.textContent = nCand ? "Add scores (" + nCand + ")" : "Add scores";
        out.replaceChildren();
        if (S.view === "setup") return setupView(out, st);
        if (S.view === "add") return addView(out, st, cands);
        const roster = rosterOf(S.period);
        if (!roster.length) { out.append(empty("No roster for " + S.period + " period", "The gradebook lists students from your Rosters page (first name and last initial). Add this period's class list there first.", "Open Rosters", () => { location.href = "rosters.html"; })); return; }
        if (S.view === "item") { const it = D.items.find((x) => x.id === S.item); if (it) return itemView(out, st, it, roster); S.view = "table"; }
        tableView(out, st, roster, nCand);
    }
    $("out").addEventListener("focusout", (e) => { if (held && !(e.relatedTarget && e.relatedTarget.tagName === "INPUT" && $("out").contains(e.relatedTarget))) setTimeout(draw, 0); });

    function skeleton() { const s = el("div", "pgSkel"); s.setAttribute("aria-hidden", "true"); s.append(el("i"), el("i"), el("i")); return s; }
    function empty(h, p, label, fn, label2, fn2) { const box = el("div", "pgEmpty"); box.append(el("h2", null, h), el("p", null, p)); const row = el("div", "gbRow"); if (label) row.append(btn("btn go", label, fn)); if (label2) row.append(btn("btn ghost", label2, fn2)); box.append(row); return box; }
    const tile = (big, label, small) => { const t = el("div", "pgTile"); t.append(el("b", null, big), el("span", null, label)); if (small) t.append(el("small", null, small)); return t; };
    const termName = () => ord(S.term) + " nine weeks";

    /* ---------- the grade table ---------- */
    function tableView(out, st, roster, nCand) {
        const T = G.gradeTable(D.items, S.period, roster, ctx(), st, S.term, TERMS);
        if (!T.cols.length) {
            out.append(empty("No grades for " + S.period + " period in the " + termName() + " yet",
                nCand ? nCand + (nCand === 1 ? " score set is" : " score sets are") + " ready to bring in from Assignments and Class Data. Or type in a paper quiz or homework check." : "Bring in scores from Assignments and Class Data, or type in a paper quiz or homework check. Each one becomes a column here.",
                nCand ? "Add scores" : "New grade", () => { S.view = "add"; draw(); }, nCand ? "New grade" : null, () => newHand()));
            return;
        }
        const cMin = (st.scale.find((x) => x[0] === "C") || [0, 70])[1] / 100;
        const graded = T.rows.filter((r) => r.grade.v != null), under = graded.filter((r) => r.grade.v < cMin);
        const blanks = T.cols.filter((c) => c.item.src.k === "hand" && !c.item.off).reduce((s, c) => s + c.blanks, 0);
        const tiles = el("div", "pgTiles small");
        tiles.append(tile(T.avg == null ? "–" : G.pct(T.avg) + " " + G.letter(T.avg, st.scale), "class average", graded.length + " of " + roster.length + " students have a grade"),
            tile(String(T.missing), "missing", T.missing ? "Marked missing" + (st.missing === "zero" ? ", counting as 0 until turned in" : ", left out of the grade") : "Nothing marked missing"),
            tile(String(under.length), "under " + Math.round(cMin * 100) + "%", under.length ? short(under.map((r) => r.s).join(", "), 60) : "Everyone with a grade is at C or above"),
            tile(String(blanks), "blank scores", "On columns you type in. Blank is left out, never a 0"));
        out.append(tiles);
        if (!G.weighted(st)) out.append(note("No category weights are set, so the grade is total points. Your syllabus names Homework, Class Work, and Quizzes & Tests but gives no percentages. ", "Set weights", () => { S.view = "setup"; draw(); }));
        if (nCand) out.append(note(nCand + (nCand === 1 ? " new score set is" : " new score sets are") + " ready to bring in. ", "Add scores", () => { S.view = "add"; draw(); }));
        const bar = el("div", "gbBar2");
        bar.append(el("p", "gbHint", "Big number: the grade. Small: how much was done. Tap a name for the student, a column or score to enter or fix."));
        const acts = el("div", "gbRow"); acts.append(btn("btn go", "New grade", () => newHand()), btn("btn ghost", "Export CSV", () => {
            const blob = new Blob([G.tableCsv(T, st)], { type: "text/csv" }), a = el("a"); a.href = URL.createObjectURL(blob); a.download = "grades-" + S.period + "-period-" + ord(S.term) + "-nine-weeks-" + G.isoDay() + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }));
        bar.append(acts); out.append(bar);

        const wrap = el("div", "gbWrap"), t = el("table", "gbTbl"), hr = el("tr");
        hr.append(el("th", "gbNm", "Student"), el("th", "gbTerm", "Term"));
        T.cols.forEach((c) => {
            const th = el("th"), b = btn("gbCol" + (c.item.off ? " off" : ""), null, () => openItem(c.item.id));
            const cat = catOf(st, c.item.cat);
            b.append(el("b", null, short(c.item.title)), el("small", null, cat.name + " · " + fmtDay(c.item.date)), el("small", null, (c.item.off ? "Not counted" : c.item.xc ? "Extra credit, up to +" + c.item.pts : "Out of " + c.item.pts) + " · avg " + G.pct(c.avg)));
            b.title = c.item.title + " (" + srcWord(c.item) + ")"; th.append(b); hr.append(th);
        });
        const thead = el("thead"); thead.append(hr); t.append(thead);
        const tb = el("tbody");
        T.rows.forEach((r) => {
            const tr = el("tr"), nm = el("td", "gbNm"), nb = btn("gbName", r.s, () => openKid(r.i)); nm.append(nb);
            const tg = el("td", "gbTerm"); tg.dataset.v = bandOf(r.grade.v, st);
            tg.append(el("b", null, r.grade.v == null ? "–" : G.pct(r.grade.v)), el("small", null, r.grade.letter || (r.grade.missing ? r.grade.missing + " missing" : "no grade yet")));
            tr.append(nm, tg);
            r.cells.forEach((c, k) => {
                const td = el("td", "gbCell"), b = btn(null, null, () => openItem(T.cols[k].item.id, r.s));
                fillCell(b, c, T.cols[k].item); td.dataset.v = c && c.f != null && !T.cols[k].item.off ? bandOf(c.f, st) : c && c.x === "m" ? "no" : "";
                td.append(b); tr.append(td);
            });
            tb.append(tr);
        });
        t.append(tb); wrap.append(t); out.append(wrap);
        out.append(howItWorks(st));
    }
    function fillCell(b, c, item) {
        const label = [];
        if (!c || (c.f == null && !c.x)) { b.append(el("b", "gbBlank", "–")); label.push("no score"); }
        else if (c.x === "ex") { b.append(el("b", null, "EX"), el("small", null, "excused")); label.push("excused"); }
        else if (c.f == null) { b.append(el("b", "gbMiss", "M"), el("small", null, "missing")); label.push("missing"); }
        else {
            b.append(el("b", null, c.before != null ? G.pct(c.before) + " → " + G.pct(c.f) : G.pct(c.f)));
            const sm = c.edited ? "typed in" : c.c != null ? G.pct(c.c) + " done" : item.src.k === "hand" ? round2(c.f * item.pts) + "/" + item.pts : "";
            if (sm) b.append(el("small", null, sm));
            label.push(G.pct(c.f) + (c.before != null ? " after corrections, was " + G.pct(c.before) : "") + (c.c != null ? ", " + G.pct(c.c) + " done" : ""));
        }
        if (c && c.n) b.title = c.n;
        b.setAttribute("aria-label", item.title + ": " + label.join(", "));
    }
    const round2 = (x) => Math.round(x * 100) / 100;
    const srcWord = (it) => (it.src.k === "asg" ? "from Assignments" : it.src.k === "data" ? "from Class Data" : "typed in here");
    function note(text, label, fn) { const p = el("p", "gbNote", text); if (label) { const b = btn("gbLink", label, fn); p.append(b); } return p; }
    function howItWorks(st) {
        const d = el("details", "pgHow"); d.append(el("summary", null, "How grades are worked out"));
        const ul = el("ul");
        [
            G.weighted(st) ? "Weighted: each category is points earned over points possible, then the categories are averaged with your weights (" + st.cats.map((c) => c.name + " " + c.w + "%").join(", ") + "). A category with nothing graded yet shares its weight out to the others." : "Total points: every counted score's points added up, over every counted score's possible points. Set category weights on Setup to switch to a weighted average.",
            "Grade and complete stay apart. Grade is points earned. Complete is how much the student tried (Assignments only). Misses, tries and time never lower a grade.",
            "Test corrections show as before → after (70% → 85%). The after score is the one that counts.",
            "Blank means not turned in or not entered yet, and is left out. Missing " + (st.missing === "zero" ? "counts as 0 until a score arrives; the score then replaces it." : "is shown but left out of the grade.") + " Excused is always left out.",
            "A score typed here for a column from Assignments or Class Data replaces that one student's score there, and the cell says \"typed in\".",
            "Students are your roster lines (first name and last initial). This page is yours only; nothing here goes on the board or to students.",
        ].forEach((t) => ul.append(el("li", null, t)));
        d.append(ul); return d;
    }

    /* ---------- one column: settings and score entry ---------- */
    function openItem(id, focusName) { S.view = "item"; S.item = id; S.focus = focusName || ""; draw(); }
    function newHand() {
        const st = setup(), id = newId();
        const it = G.makeItem({ title: "New grade", date: G.isoDay(), cat: st.cats.some((c) => c.id === "hw") ? "hw" : st.cats[0].id, pts: 10, periods: [S.period], src: { k: "hand" } }, id);
        if (G.termOf(it.date, TERMS) !== S.term) { const t = TERMS.find((x) => x.n === S.term); if (t) it.date = t.end < it.date ? t.end : t.start; }
        D.items.push(it); D.hand.set(id, { sc: {} }); watchItem(it); saveItems(); openItem(id); setTimeout(() => { const f = $("gbTitle"); if (f) { f.focus(); f.select(); } }, 30);
    }
    function itemView(out, st, it, roster) {
        const back = btn("btn ghost gbBack", "← Grade table", () => { S.view = "table"; draw(); }); out.append(back);
        const card = el("section", "gbCard");
        const h = el("h2", null, it.title); card.append(h, el("p", "gbHint", srcWord(it).replace(/^./, (c) => c.toUpperCase()) + (it.src.k === "hand" ? "." : ". Scores update by themselves; a score you type below replaces that student's.")));
        const grid = el("div", "gbForm");
        const field = (label, input) => { const l = el("label", "gbField"); l.append(el("span", null, label), input); grid.append(l); return input; };
        const title = field("Name", el("input")); title.id = "gbTitle"; title.value = it.title; title.maxLength = 80;
        title.onchange = () => { it.title = title.value.trim().slice(0, 80) || "Untitled"; saveItems(); h.textContent = it.title; };
        const date = field("Date", el("input")); date.type = "date"; date.value = it.date; date.onchange = () => { if (/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { it.date = date.value; saveItems(); const n = G.termOf(it.date, TERMS); if (n !== S.term) { S.term = n; $("term").value = n; remember("term", n); } } };
        const cat = field("Category", el("select")); st.cats.forEach((c) => { const o = el("option", null, c.name); o.value = c.id; cat.append(o); }); cat.value = catOf(st, it.cat).id; cat.onchange = () => { it.cat = cat.value; saveItems(); };
        const pts = field("Out of (points)", el("input")); pts.type = "number"; pts.min = "1"; pts.step = "any"; pts.inputMode = "decimal"; pts.value = it.pts;
        pts.onchange = () => { const v = +pts.value; if (v > 0) { it.pts = v; saveItems(); draw(); } else pts.value = it.pts; };
        card.append(grid);
        const opts = el("div", "gbOpts");
        const cnt = el("label", "gbCheck"), cb = el("input"); cb.type = "checkbox"; cb.checked = !it.off; cb.onchange = () => { it.off = !cb.checked; saveItems(); }; cnt.append(cb, el("span", null, "Count this in the grade"));
        opts.append(cnt);
        const xc = el("label", "gbCheck"), xb = el("input"); xb.type = "checkbox"; xb.checked = !!it.xc; xb.onchange = () => { it.xc = xb.checked; saveItems(); draw(); }; xc.append(xb, el("span", null, "Extra credit (adds points, never adds to points possible)"));
        opts.append(xc);
        if (it.src.k === "hand") {
            const pers = el("div", "gbPers"); pers.append(el("span", null, "Periods"));
            PER.forEach(([p]) => { const l = el("label", "gbCheck"), c = el("input"); c.type = "checkbox"; c.checked = it.periods.includes(p); c.onchange = () => { it.periods = PER.map((x) => x[0]).filter((q) => (q === p ? c.checked : it.periods.includes(q))); if (!it.periods.length) { it.periods = [p]; c.checked = true; } saveItems(); }; l.append(c, el("span", null, p)); pers.append(l); });
            opts.append(pers);
        }
        opts.append(btn("btn ghost gbDel", "Remove column", () => {
            if (!confirm("Remove \"" + it.title + "\" from the gradebook? " + (it.src.k === "hand" ? "The scores typed for it are deleted." : "Its scores stay in " + (it.src.k === "asg" ? "Assignments" : "Class Data") + "; you can add it again from Add scores."))) return;
            D.items = D.items.filter((x) => x.id !== it.id); saveItems(); if (it.src.k === "hand") store.save("gb/s_" + it.id, { sc: {}, removed: true, at: Date.now() }); S.view = "table"; draw();
        }));
        card.append(opts); out.append(card);

        // ---------- scores ----------
        const list = el("section", "gbCard gbScores"), lh = el("div", "gbListHead");
        lh.append(el("h3", null, S.period + " period scores"), el("p", "gbHint", "Type points and press Enter to go down. Type m for missing, x for excused. 8/10 or 85% work too. Saves as you go."));
        list.append(lh);
        if (!(it.periods || []).includes(S.period)) { list.append(el("p", "pgWarn", "This column is not given to " + S.period + " period." + (it.src.k === "hand" ? " Tick " + S.period + " under Periods above to add it." : ""))); out.append(list); return; }
        const cells = G.cellsFor(it, S.period, roster, ctx());
        const linked = G.cellsFor(Object.assign({}, it, { id: "\u0000" }), S.period, roster, ctx());   // what the source says, before anything typed here
        const hand = D.hand.get(it.id) || { sc: {} }; if (!hand.sc) hand.sc = {}; D.hand.set(it.id, hand);
        const inputs = [];
        roster.forEach((s, i) => {
            const k = G.keyOf(S.period, s), row = el("div", "gbEntry"), c = cells.get(i), l = linked.get(i);
            const nm = el("div", "gbENm"); nm.append(el("b", null, s));
            if (l && l.f != null) nm.append(el("small", null, (it.src.k === "asg" ? "Assignment: " : "Class Data: ") + (l.before != null ? G.pct(l.before) + " → " : "") + G.pct(l.f) + (l.c != null ? " · " + G.pct(l.c) + " done" : "")));
            else if (it.src.k !== "hand") nm.append(el("small", null, it.src.k === "asg" ? "Not started" : "No score in the set"));
            const box = el("input", "gbIn"); box.inputMode = "decimal"; box.autocomplete = "off"; box.dataset.k = s; box.setAttribute("aria-label", "Points for " + s + " out of " + it.pts);
            const h = hand.sc[k] || {}; box.value = h.p != null ? h.p : ""; box.placeholder = l && l.f != null ? String(round2(l.f * it.pts)) : "";
            const of = el("span", "gbOf", "/ " + it.pts);
            const shown = el("span", "gbShown");
            const flag = (x, word) => { const b = btn("gbFlag", word, () => setFlag(x)); b.dataset.x = x; return b; };
            const fm = flag("m", "Missing"), fe = flag("ex", "Excused");
            const paint = () => { const cur = hand.sc[k] || {}; fm.setAttribute("aria-pressed", String(cur.x === "m")); fe.setAttribute("aria-pressed", String(cur.x === "ex")); const one = G.cellsFor(it, S.period, roster, ctx()).get(i); shown.textContent = !one ? "" : one.x === "ex" ? "EX" : one.f != null ? G.pct(one.f) : one.x === "m" ? "M" : ""; shown.dataset.v = one && one.f != null ? bandOf(one.f, st) : one && one.x === "m" ? "no" : ""; };
            const put = (patch) => { const cur = Object.assign({}, hand.sc[k] || {}, patch); if ((cur.p == null || cur.p === "") && !cur.x && !cur.n) delete hand.sc[k]; else hand.sc[k] = cur; handChanged(it.id); paint(); };
            function setFlag(x) { const cur = hand.sc[k] || {}; put({ x: cur.x === x ? "" : x }); }
            box.oninput = () => {
                const v = box.value.trim().toLowerCase();
                if (v === "m") { box.value = ""; put({ p: null, x: "m" }); return; }
                if (v === "x" || v === "ex") { box.value = ""; put({ p: null, x: "ex" }); return; }
                const p = G.parseScore(v, it.pts); box.classList.toggle("bad", !!v && p == null);
                if (!v) put({ p: null }); else if (p != null) put({ p, x: (hand.sc[k] || {}).x === "ex" ? "ex" : "" });
            };
            box.onchange = () => { const p = G.parseScore(box.value, it.pts); if (p != null && String(p) !== box.value.trim()) box.value = p; };
            box.onkeydown = (e) => { const j = inputs.indexOf(box); if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); (inputs[j + 1] || box).focus(); } else if (e.key === "ArrowUp") { e.preventDefault(); (inputs[j - 1] || box).focus(); } };
            box.onfocus = () => box.select();
            inputs.push(box); paint();
            const ent = el("div", "gbEIn"); ent.append(box, of, shown);
            const fl = el("div", "gbFlags"); fl.append(fm, fe);
            row.append(nm, ent, fl); list.append(row);
            if (c && c.edited) row.classList.add("edited");
        });
        out.append(list);
        const f = inputs.find((x) => x.dataset.k === S.focus); if (f) setTimeout(() => { f.focus(); f.scrollIntoView({ block: "center" }); }, 30);
        S.focus = "";
    }

    /* ---------- bring scores in ---------- */
    function addView(out, st, cands) {
        out.append(el("h2", "gbH2", "Add scores"));
        out.append(el("p", "gbHint", "Assignments and Class Data sets that are not in the gradebook yet, newest first. Pick a category and add; scores keep updating from the source. Skip anything you don't grade (practice games, diagnostics)."));
        const hand = el("section", "gbCard gbAddHand"); hand.append(el("div", null), btn("btn go", "New grade by hand", () => newHand()));
        hand.firstChild.append(el("b", null, "Paper quiz, homework check, anything else"), el("small", null, "A column you type scores into, for " + S.period + " period (add other periods inside)."));
        out.append(hand);
        if (!cands.length) { out.append(el("p", "pgWarn", "Nothing new from Assignments or Class Data. When you assign something or import a set, it shows here.")); return; }
        const mine = cands.filter((c) => c.periods.includes(S.period)), other = cands.filter((c) => !c.periods.includes(S.period));
        const group = (title, list) => {
            if (!list.length) return; out.append(el("h3", "gbH3", title));
            list.forEach((c) => {
                const row = el("div", "gbCand"), info = el("div");
                info.append(el("b", null, c.title), el("small", null, c.from + " · " + c.kind + " · " + fmtDay(c.date) + " (" + ord(G.termOf(c.date, TERMS)) + " nine weeks) · " + c.periods.join(", ")));
                const sel = el("select", "gbSel"); sel.setAttribute("aria-label", "Category for " + c.title); st.cats.forEach((x) => { const o = el("option", null, x.name); o.value = x.id; sel.append(o); }); sel.value = c.cat;
                const acts = el("div", "gbRow");
                acts.append(sel, btn("btn go", "Add", () => {
                    const id = c.src.k === "asg" ? "a" + c.src.id : newId();
                    const it = G.makeItem(Object.assign({}, c, { cat: sel.value }), D.items.some((x) => x.id === id) ? newId() : id);
                    D.items.push(it); watchItem(it); saveItems(); status("Added " + short(c.title, 40), "ok"); draw();
                }), btn("btn ghost", "Skip", () => { D.skip.push(G.srcKey(c.src)); saveItems(); draw(); }));
                row.append(info, acts); out.append(row);
            });
        };
        group("For " + S.period + " period", mine); group("Other periods", other);
        if (D.skip.length) out.append(note(D.skip.length + " skipped. ", "Show them again", () => { D.skip = []; saveItems(); draw(); }));
    }

    /* ---------- setup ---------- */
    function setupView(out, st) {
        const draft = JSON.parse(JSON.stringify(st));
        out.append(el("h2", "gbH2", "Setup"));
        const cats = el("section", "gbCard"); cats.append(el("h3", null, "Categories and weights"));
        cats.append(el("p", "gbHint", "From your 2026-27 syllabus: Homework, Class Work (class assignments, activities, DeltaMath, Magma Math), and Quizzes & Tests. It gives no percentages, so the weights start blank and the grade is total points. Enter your school's weights to switch to a weighted average."));
        const list = el("div", "gbCats"), total = el("p", "gbTotal");
        const paintTotal = () => { const t = draft.cats.reduce((s, c) => s + (+c.w || 0), 0); total.textContent = t ? "Weights add to " + t + "%" + (t === 100 ? "." : ". They don't have to add to 100; each is used as a share of the total.") : "No weights: total points."; total.dataset.v = t && t !== 100 ? "mid" : ""; };
        const paint = () => {
            list.replaceChildren();
            draft.cats.forEach((c, i) => {
                const row = el("div", "gbCatRow");
                const n = el("input"); n.value = c.name; n.maxLength = 40; n.setAttribute("aria-label", "Category name"); n.oninput = () => { c.name = n.value; };
                const w = el("input"); w.type = "number"; w.min = "0"; w.max = "100"; w.inputMode = "numeric"; w.value = c.w || ""; w.placeholder = "–"; w.setAttribute("aria-label", c.name + " weight percent"); w.oninput = () => { c.w = Math.max(0, Math.min(100, +w.value || 0)); paintTotal(); };
                const used = D.items.filter((it) => it.cat === c.id).length;
                const rm = btn("btn ghost", "Remove", () => { if (used) { alertNote(row, "Move its " + used + " columns to another category first."); return; } draft.cats.splice(i, 1); paint(); }); rm.disabled = draft.cats.length < 2;
                const wl = el("label", "gbW"); wl.append(w, el("span", null, "%"));
                row.append(n, wl, el("small", null, used + (used === 1 ? " column" : " columns")), rm); list.append(row);
            });
            paintTotal();
        };
        paint(); cats.append(list, total, btn("btn ghost", "+ Category", () => { draft.cats.push({ id: "c" + newId().slice(-6), name: "New category", w: 0 }); paint(); }));
        out.append(cats);

        const pol = el("section", "gbCard"); pol.append(el("h3", null, "Missing work"));
        [["zero", "Missing counts as 0 until a score arrives"], ["blank", "Missing is shown but left out of the grade"]].forEach(([v, t]) => { const l = el("label", "gbCheck"), r = el("input"); r.type = "radio"; r.name = "gbMiss"; r.checked = draft.missing === v; r.onchange = () => { draft.missing = v; }; l.append(r, el("span", null, t)); pol.append(l); });
        pol.append(el("p", "gbHint", "Either way a blank score (not entered yet) is never a 0, and a score that comes in replaces the M."));
        out.append(pol);

        const sc = el("section", "gbCard"); sc.append(el("h3", null, "Letter grades"), el("p", "gbHint", "The lowest score for each letter. The usual 10-point scale is filled in; change it if your school's differs."));
        const sg = el("div", "gbScale");
        draft.scale.forEach((row) => { const l = el("label", "gbField"); const i = el("input"); i.type = "number"; i.min = "0"; i.max = "100"; i.value = row[1]; i.disabled = row[1] === 0 && row === draft.scale[draft.scale.length - 1]; i.oninput = () => { row[1] = +i.value || 0; }; l.append(el("span", null, row[0]), i); sg.append(l); });
        sc.append(sg); out.append(sc);
        const save = btn("btn go gbSave", "Save setup", async () => { draft.cats.forEach((c) => { c.name = String(c.name || "").trim() || "Category"; }); try { await saveSetup(G.cleanSetup(draft)); status(demo ? "Sample data" : "Saved", "ok"); S.view = "table"; draw(); } catch (e) { status("Not saved (" + ((e && e.code) || "error") + ")", "bad"); } });
        out.append(save);
    }
    function alertNote(row, text) { let n = row.querySelector(".gbErr"); if (!n) { n = el("small", "gbErr"); row.append(n); } n.textContent = text; }

    /* ---------- one student ---------- */
    function openKid(i) {
        const st = setup(), roster = rosterOf(S.period), name = roster[i], C = ctx();
        const items = D.items.filter((it) => (it.periods || []).includes(S.period) && G.termOf(it.date, TERMS) === S.term);
        const cellsOf = (it) => G.cellsFor(it, S.period, roster, C).get(i) || null;
        const list = items.map((item) => ({ item, cell: cellsOf(item) }));
        const g = G.gradeOf(list, st);
        const dlg = $("kid"); dlg.replaceChildren();
        const head = el("div", "pgKHead"), h = el("h2", null, name); h.id = "kidName";
        head.append(h, btn("btn ghost", "Close", () => dlg.close())); dlg.append(head);
        const top = el("div", "gbKTop"), big = el("div", "gbKBig"); big.dataset.v = bandOf(g.v, st);
        big.append(el("b", null, g.v == null ? "–" : G.pct(g.v, 1)), el("span", null, g.letter || "No grade yet"));
        const facts = el("div", "gbKFacts");
        facts.append(el("p", null, S.period + " period · " + termName()), el("p", null, g.n + " graded" + (g.missing ? " · " + g.missing + " missing" : "")), el("p", "gbHint", G.weighted(st) ? "Weighted by category" : "Total points"));
        top.append(big, facts); dlg.append(top);

        dlg.append(el("h3", null, "By category"));
        const cats = el("div", "gbKCats");
        g.cats.forEach((c) => {
            const row = el("div", "gbKCat"), bar = el("div", "gbMeter"), fill = el("span"); fill.style.width = c.v == null ? "0" : Math.round(c.v * 100) + "%"; fill.dataset.v = bandOf(c.v, st); bar.append(fill);
            const lab = el("div"); lab.append(el("b", null, c.name), el("small", null, (G.weighted(st) ? c.w + "% weight" + (c.v != null && c.share ? " (counts " + Math.round(c.share * 100) + "% now)" : "") : c.n ? Math.round(c.share * 100) + "% of the points" : "") + (c.n ? " · " + round2(c.earned) + " of " + round2(c.possible) + " pts" : " · nothing graded yet")));
            row.append(lab, bar, el("b", "gbKPct", c.v == null ? "–" : G.pct(c.v))); cats.append(row);
        });
        dlg.append(cats);

        const tr = G.trajectory(items, cellsOf, st);
        if (tr.length >= 2) {
            dlg.append(el("h3", null, "How the grade moved"));
            const cMin = (st.scale.find((x) => x[0] === "C") || [0, 70])[1] / 100;
            const box = el("div", "pgCard"); box.append(lineChart(tr.map((p) => ({ d: p.d, v: p.v, label: p.label })), { h: 200, title: name + " term grade over time", refs: [{ v: cMin, label: "C", kind: "cut" }] })); dlg.append(box);
            const first = tr[0].v, last = tr[tr.length - 1].v, diff = Math.round((last - first) * 100);
            dlg.append(el("p", "pgTrend", diff > 0 ? "Up " + diff + " points since the first grade this nine weeks." : diff < 0 ? "Down " + -diff + " points since the first grade this nine weeks." : "Steady since the first grade this nine weeks."));
        }

        dlg.append(el("h3", null, "Every score"));
        const tw = el("div", "gbWrap"), t = el("table", "gbTbl gbKTbl"), hr = el("tr");
        ["Date", "What", "Category", "Grade", "Done"].forEach((x) => hr.append(el("th", null, x)));
        const th = el("thead"); th.append(hr); t.append(th); const tb = el("tbody");
        list.slice().sort((a, b) => b.item.date.localeCompare(a.item.date)).forEach(({ item, cell }) => {
            const r = el("tr"); r.append(el("td", null, fmtDay(item.date)));
            const w = el("td", "gbKWhat"); w.append(el("b", null, item.title)); const tags = [srcWord(item)]; if (item.off) tags.push("not counted"); if (cell && cell.edited) tags.push("typed in"); w.append(el("small", null, tags.join(" · "))); r.append(w);
            r.append(el("td", null, catOf(st, item.cat).name));
            const gc = el("td", "gbCell"); fillCell(gc, cell, item); gc.dataset.v = cell && cell.f != null && !item.off ? bandOf(cell.f, st) : cell && cell.x === "m" ? "no" : ""; r.append(gc);
            r.append(el("td", null, cell && cell.c != null ? G.pct(cell.c) : "–"));
            tb.append(r);
        });
        if (!list.length) { const r = el("tr"), td = el("td", null, "Nothing in the gradebook for this nine weeks yet."); td.colSpan = 5; r.append(td); tb.append(r); }
        t.append(tb); tw.append(t); dlg.append(tw);

        // What the work says they can do: the Student Progress record for this student (Class Data, Assignments, Vault Raid).
        const cls = CLS[S.period], codes = new Set(((STANDARDS[cls] || {}).standards || []).map((s) => s.code));
        const P = buildProgress({ roster, codes, imports: [...C.imports.values()], period: S.period, cut: 0.7 });
        const rec = P.students.find((x) => x.i === i);
        dlg.append(el("h3", null, "What the work says, by standard"));
        if (rec && rec.stds.length) {
            dlg.append(el("p", "gbHint", "From the same scores, matched to standards (latest work, 70% help line). A grade is the average; this is what's behind it."));
            const sg = el("div", "gbKStds");
            rec.stds.slice().sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })).forEach((x) => {
                const s = ((STANDARDS[cls] || {}).standards || []).find((y) => y.code === x.code);
                const c = el("div", "gbKStd"); c.dataset.v = x.band === "ok" ? "ok" : x.band === "mid" ? "mid" : "no";
                c.append(el("b", null, x.code + " · " + BAND_WORD[x.band]), el("small", null, G.pct(x.latest) + " latest · " + x.n + (x.n === 1 ? " score" : " scores") + (s && s.text ? " · " + short(s.text, 70) : "")));
                sg.append(c);
            });
            dlg.append(sg);
        } else dlg.append(el("p", "gbHint", "No scores tagged with a standard yet. Assignments from the standards bank, and Class Data sets with a standard, fill this in."));
        const lk = el("a", "btn ghost gbOpen", "Open in Student Progress"); lk.href = "progress.html" + (demo ? "?demo" : ""); dlg.append(lk);
        if (!dlg.open) dlg.showModal();
    }

    draw();
}
