/* ==========================================
   Anchor Board — Student Progress page (progress.html).
   Reads only; writes nothing. Loads the teacher's own documents, builds the record with
   js/progress.js and draws one view at a time: Today, Class, Students, Questions.
   ?demo fills a this-tab store with made-up students (js/progressDemo.js) and saves nothing.
========================================== */
import { sharedPeriod, saveSharedPeriod } from "./studentsNav.js?v=3";
import { buildProgress, distribution, standardOverTime, needGroups, missedOn, heatmap, engagement, fidelity, studentSummary, stdIn, BAND_WORD } from "./progress.js?v=2";
import { lineChart, sparkline, bandBar, meter } from "./charts.js?v=1";
import { STANDARDS } from "../data/standards.js?v=57";

const DEMO_PERIODS = [["1st", "8th"], ["2nd", "8th"], ["4th", "8th"], ["5th", "7th"], ["6th", "8th-acc"]];
const MARK = { teaching: "Teaching", taught: "Taught", reteach: "Reteach" };
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const pct = (v) => (v == null ? "–" : Math.round(v * 100) + "%");
const fmtDay = (d) => { if (!d) return "–"; const t = new Date(d + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); };
const short = (t, n = 80) => (t && t.length > n ? t.slice(0, n - 1).trim() + "…" : t || "");
const remember = (k, v) => { try { if (v === undefined) return localStorage.getItem("anchorboard-progress-" + k); localStorage.setItem("anchorboard-progress-" + k, v); } catch (e) { return null; } return null; };

export async function mountProgress() {
    const demo = new URLSearchParams(location.search).has("demo");
    const store = await import(demo ? "./localStore.js?v=57" : "./boardStore.js?v=58");
    // This teacher's periods and the class each one is (Mr. Steers' five, or a new teacher's own from Setup).
    const PER = demo ? DEMO_PERIODS : (await import("../data/weeks.js?v=61")).PERIODS;
    const CLS = Object.fromEntries(PER), PERIODS = PER.map(([p, c]) => [p, (STANDARDS[c] && STANDARDS[c].label) || c]);
    const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };

    const S = { period: [sharedPeriod(""), remember("period")].find((p) => p && PERIODS.some((x) => x[0] === p)) || "1st", view: remember("view") || "today", game: "", sort: "need", std: "" };
    if (!CLS[S.period]) S.period = PER[0][0];
    const D = { rosters: {}, marks: {}, index: null, imports: new Map(), results: [], pindex: null, details: new Map(), tally: new Map() };

    // ---------- controls ----------
    PERIODS.forEach(([k, label]) => { const b = el("button", null, k + " period"); b.type = "button"; b.dataset.k = k; b.title = label; b.onclick = () => { S.period = k; S.game = ""; S.std = ""; remember("period", k); saveSharedPeriod(k); draw(); }; $("periodTabs").appendChild(b); });
    $("cut").value = remember("cut") || "0.7";
    $("cut").onchange = () => { remember("cut", $("cut").value); draw(); };
    [...$("views").children].forEach((b) => { b.onclick = () => { S.view = b.dataset.v; remember("view", S.view); draw(); }; });

    const user = await store.ready();
    if (!user) { location.replace("login.html"); return; }
    if (demo) { const { seedDemo } = await import("./progressDemo.js?v=1"); await seedDemo(store); }
    $("who").textContent = demo ? "Sample students, nothing is saved" : "Signed in as " + user.name;

    // ---------- loading (each document once; the page reads, never writes) ----------
    let drawT = 0; const soon = () => { clearTimeout(drawT); drawT = setTimeout(draw, 60); };
    const once = (path, fn) => { let done = false, un = null; un = store.watch(path, (s) => { if (done || s.pending) return; done = true; fn(s.exists ? s.data : null); if (un) setTimeout(un, 0); }, () => { if (!done) { done = true; fn(null); } }); };
    store.watch("rosters/all", (s) => { if (s.pending) return; D.rosters = (s.exists && s.data && s.data.periods) || {}; soon(); }, () => {});
    store.watch("standards/progress", (s) => { if (s.pending) return; D.marks = (s.exists && s.data) || {}; soon(); }, () => {});
    store.watch("games/results", (s) => { if (s.pending) return; D.results = ((s.exists && s.data && s.data.list) || []).filter((r) => r && r.id); soon(); }, () => {});
    store.watch("data/index", (s) => {
        if (s.pending) return; D.index = (s.exists && s.data && s.data.imports) || [];
        D.index.forEach((m) => { if (!D.imports.has(m.id)) { D.imports.set(m.id, null); once("data/i_" + m.id, (d) => { D.imports.set(m.id, d && d.rows ? d : false); soon(); }); } });
        status(demo ? "Sample data" : "Live", "ok"); soon();
    }, (e) => status("Could not load Class Data (" + ((e && e.code) || "error") + ")", "bad"));
    store.watch("progress/index", (s) => {
        if (s.pending) return; D.pindex = (s.exists && s.data && s.data.games) || [];
        D.pindex.slice(-400).forEach((m) => { if (!D.details.has(m.id)) { D.details.set(m.id, null); once("progress/g_" + m.id, (d) => { D.details.set(m.id, d || false); soon(); }); } });
        soon();
    }, () => { D.pindex = []; soon(); });
    // The class tally for the last 45 days (one document per day).
    for (let i = 0; i < 45; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); once("tally/" + k, (t) => { if (t && t.periods) { D.tally.set(k, t); soon(); } }); }
    // The Class Tracker (Nov 21) keeps the same behaviour line, one document per day at track/{day}.
    import("./trackCore.js?v=2").then((TC) => once("settings/track", (st) => { const tags = TC.cleanTags(st); for (let i = 0; i < 45; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = TC.localIso(d); once("track/" + k, (t) => { if (t && t.ev) { D.tally.set("t:" + k, TC.toTally(Object.assign({ day: k }, t), tags)); soon(); } }); } })).catch(() => {});

    // ---------- the model for the period on screen ----------
    function model() {
        const cls = CLS[S.period], C = STANDARDS[cls] || { standards: [], units: [] }, codes = new Set(C.standards.map((s) => s.code));
        const imports = [...D.imports.values()].filter(Boolean), vrIds = new Set(imports.filter((i) => i.source === "Vault Raid" || i.source === "Assignment").map((i) => String(i.id).replace(/^vr/, "")));
        const details = [...D.details.values()].filter(Boolean).map((g) => Object.assign({}, g, { vr: vrIds.has(g.id), qs: (g.qs || []).map((q) => Object.assign({}, q, { std: stdIn(q.c, codes) })) }));
        const cut = +$("cut").value;
        const P = buildProgress({ roster: (D.rosters[S.period] || []).map((n) => String(n).slice(0, 60)), codes, imports, results: D.results, details, tally: [...D.tally.values()], period: S.period, cut });
        const order = []; C.units.forEach((u) => u.standards.forEach((x) => { if (!order.includes(x.code)) order.push(x.code); })); C.standards.forEach((s) => { if (!order.includes(s.code)) order.push(s.code); });
        const std = (code) => C.standards.find((s) => s.code === code) || null;
        return { P, cut, cls, C, order, std, mark: (code) => ((D.marks[cls] || {})[code] || {}).s || "" };
    }

    function draw() {
        [...$("periodTabs").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === S.period)));
        [...$("views").children].forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.v === S.view)); b.setAttribute("aria-selected", String(b.dataset.v === S.view)); });
        const out = $("out");
        if (D.index == null || D.pindex == null || [...D.imports.values()].some((x) => x === null)) { out.replaceChildren(skeleton()); return; }
        const M = model(), withData = M.P.students.filter((r) => r.sets.length || r.effort.games || r.games.played);
        out.replaceChildren();
        if (!(D.rosters[S.period] || []).length) out.appendChild(empty("No class list for " + S.period + " period yet.", "Progress joins every score to a roster name. Add the class on the Rosters page first.", "Open Rosters", "rosters.html"));
        else if (!withData.length) out.appendChild(empty("No results for " + S.period + " period yet.", "Bring in a quiz, exit ticket or app report on Class Data, or play Vault Raid with “Save results to Class Data” on. Progress builds from there.", "Open Class Data", "data.html"));
        else ({ today, class: classView, students, questions }[S.view] || today)(out, M);
    }
    const skeleton = () => { const s = el("div", "pgSkel"); s.setAttribute("aria-hidden", "true"); s.append(el("i"), el("i"), el("i")); return s; };
    function empty(h, p, label, href) { const box = el("div", "pgEmpty"); box.append(el("h2", null, h), el("p", null, p)); const a = el("a", "btn go", label); a.href = href; box.appendChild(a); return box; }
    const stdLine = (M, code) => { const s = M.std(code); return s ? short(s.text, 90) : ""; };
    const chip = (text, cls) => el("span", "pgChip " + (cls || ""), text);
    const nameBtn = (M, s) => { const b = el("button", "pgName", s); b.type = "button"; b.onclick = () => openKid(M, s); return b; };

    // ---------- Today: who needs help, on what, what to do ----------
    function today(out, M) {
        const { P, cut } = M, roster = P.students.filter((r) => r.onRoster), eng = engagement(P.students).filter((x) => x.idle);
        const fid = fidelity(P.details.filter((g) => g.period === S.period), P.students), wk = fid.weeks[fid.weeks.length - 1];
        const tiles = el("div", "pgTiles");
        const tile = (n, label, sub) => { const t = el("div", "pgTile"); t.append(el("b", null, n), el("span", null, label)); if (sub) t.appendChild(el("small", null, sub)); tiles.appendChild(t); };
        tile(String(P.students.filter((r) => r.weak.length).length), "need help on a standard", "below " + pct(cut) + " on their latest scores");
        tile(String(P.students.filter((r) => r.excelling).length), "ready for a stretch", "well above " + pct(cut) + " everywhere");
        tile(String(eng.length), "showing up, not solving", "seen lately, nothing right for a week");
        tile(wk ? String(wk.per) : "–", "questions tried per student", wk ? "week of " + fmtDay(wk.wk) + " in Vault Raid" : "no Vault Raid effort saved yet");
        out.appendChild(tiles);

        out.appendChild(el("h2", null, "Who needs help today"));
        const groups = needGroups(P.students, cut, { missedOn: missedOn(P.details) });
        if (!groups.length) { out.appendChild(el("p", "sub", "Nobody is below " + pct(cut) + " on a standard with a score. Tag your Class Data sets with a standard (or build Vault Raid sets from the standards bank) so progress can name the standard.")); }
        const grid = el("div", "pgGroups");
        groups.forEach((g, gi) => {
            const card = el("section", "pgGroup g-" + g.kind), head = el("div", "pgGHead");
            if (g.kind === "need") {
                head.append(el("span", "pgGNum", "Group " + (gi + 1)), el("h3", null, g.code));
                const m = M.mark(g.code); if (m) head.appendChild(chip(MARK[m] || m, "m-" + m));
                card.append(head, el("p", "pgGText", stdLine(M, g.code)));
                card.appendChild(el("p", "pgProfile", g.who.length + (g.who.length === 1 ? " student" : " students") + ", averaging " + pct(g.avg) + " on " + g.code + ". This is the lowest standard for each of them."));
                const step = el("div", "pgNext"); step.appendChild(el("b", null, "Next step"));
                step.appendChild(el("p", null, "Pull them for 10 minutes. Reteach " + g.code + " with one worked example, then have them do one on their own while you watch."));
                if (g.q) { const q = el("p", "pgQ"); q.append(el("span", null, "Most missed: “" + short(g.q.q, 120) + "” (answer " + g.q.a + ")"), g.q.w ? el("small", null, "Common wrong answer: " + g.q.w.y + " (" + g.q.w.n + ")") : ""); step.appendChild(q); }
                card.appendChild(step);
            } else if (g.kind === "mixed") {
                head.append(el("span", "pgGNum", "Group " + (gi + 1)), el("h3", null, "Mixed needs"));
                card.append(head, el("p", "pgProfile", g.who.length + " students, each with a different lowest standard. Check in one on one."));
            } else {
                head.append(el("span", "pgGNum", "Stretch"), el("h3", null, "Ready for more"));
                card.append(head, el("p", "pgProfile", g.who.length + (g.who.length === 1 ? " student is" : " students are") + " well above " + pct(cut) + " on everything scored, and climbing."));
                const step = el("div", "pgNext"); step.append(el("b", null, "Next step"), el("p", null, "Give them Stretch-level problems from the standards bank, or let one lead a group."));
                card.appendChild(step);
            }
            const who = el("div", "pgWho"); g.who.forEach((x) => { const b = nameBtn(M, x.s); b.appendChild(el("small", null, pct(x.v) + (g.kind === "mixed" ? " · " + x.code : ""))); who.appendChild(b); });
            card.appendChild(who); grid.appendChild(card);
        });
        out.appendChild(grid);

        out.appendChild(el("h2", null, "Showing up, not solving"));
        if (!eng.length) out.appendChild(el("p", "sub", "Everyone seen lately has solved something in the last week."));
        else {
            out.appendChild(el("p", "sub", "Seen in a game, a set or the tally lately, but no right answer for a week or more. Worth a quiet check-in."));
            const list = el("div", "pgWho"); eng.forEach((x) => { const b = nameBtn(M, x.s); b.appendChild(el("small", null, "seen " + fmtDay(x.seen) + " · last solved " + (x.solve ? fmtDay(x.solve) : "never"))); list.appendChild(b); }); out.appendChild(list);
        }
        if (P.unmatched) out.appendChild(el("p", "pgWarn", P.unmatched + (P.unmatched === 1 ? " name" : " names") + " in your results did not match the " + S.period + " period roster. They show on the Students tab as “not on roster”. Fix the spelling on the Rosters page to join them up."));
    }

    // ---------- Class: distribution by standard, accuracy over time, weekly practice ----------
    function classView(out, M) {
        const { P, cut } = M;
        out.appendChild(el("h2", null, "Where the class sits on each standard"));
        out.appendChild(el("p", "sub", "Each student's latest scores on the standard. Tap a bar segment for the count."));
        const dist = distribution(P.students, M.order, cut);
        if (!dist.length) out.appendChild(el("p", "sub", "No scores tagged with a standard yet. Give a Class Data set a standard, or build Vault Raid sets from the standards bank."));
        const key = el("div", "pgKey"); [["low", "Not yet (below " + pct(cut) + ")"], ["mid", "Getting there"], ["ok", "Has it"]].forEach(([k, t]) => { const s = el("span"); s.append(el("i", "b-" + k), document.createTextNode(t)); key.appendChild(s); }); if (dist.length) out.appendChild(key);
        let lastUnit = "";
        dist.forEach((x) => {
            const u = M.C.units.find((u) => u.standards.some((y) => y.code === x.code)), uName = u ? (M.C.unitWord || "Unit") + " " + u.id + ": " + u.name : "Other standards";
            if (uName !== lastUnit) { out.appendChild(el("h3", "pgUnit", uName)); lastUnit = uName; }
            const row = el("details", "pgDist"), sum = el("summary"), lab = el("div", "pgDistLab");
            lab.append(el("b", null, x.code), el("small", null, stdLine(M, x.code)));
            const m = M.mark(x.code); if (m) lab.appendChild(chip(MARK[m] || m, "m-" + m));
            sum.append(lab, bandBar(x.c, x.code), el("span", "pgAvg", pct(x.avg)));
            row.appendChild(sum);
            const body = el("div", "pgDistBody");
            body.appendChild(el("p", null, x.low.length ? "Below " + pct(cut) + ", lowest first:" : "Nobody below " + pct(cut) + "."));
            const who = el("div", "pgWho"); x.low.forEach((y) => { const b = nameBtn(M, y.s); b.appendChild(el("small", null, pct(y.v))); who.appendChild(b); }); body.appendChild(who);
            row.appendChild(body); out.appendChild(row);
        });

        out.appendChild(el("h2", null, "Class accuracy over time"));
        const over = standardOverTime(P.students).sort((a, b) => M.order.indexOf(a.code) - M.order.indexOf(b.code));
        const sel = el("select"), lab = el("label", "field"); lab.append(el("span", null, "Show"), sel);
        const o0 = el("option", null, "Every scored set (class average)"); o0.value = ""; sel.appendChild(o0);
        over.forEach((x) => { const o = el("option", null, x.code + " · " + short(stdLine(M, x.code), 60)); o.value = x.code; sel.appendChild(o); });
        sel.value = over.some((x) => x.code === S.std) ? S.std : ""; sel.onchange = () => { S.std = sel.value; draw(); };
        out.appendChild(lab);
        let pts;
        if (!S.std) {
            const by = new Map(); P.students.forEach((r) => r.sets.forEach((x) => { const k = x.id; if (!by.has(k)) by.set(k, { d: x.d, title: x.title, vs: [] }); by.get(k).vs.push(x.v); }));
            pts = [...by.values()].sort((a, b) => a.d.localeCompare(b.d)).map((x) => ({ d: x.d, v: x.vs.reduce((s, v) => s + v, 0) / x.vs.length, label: x.title + " · " + x.vs.length + " students" }));
        } else pts = (over.find((x) => x.code === S.std) || { pts: [] }).pts.map((p) => ({ d: p.d, v: p.v, label: p.n + " scores" }));
        const card = el("div", "pgCard"); card.appendChild(pts.length ? lineChart(pts, { cut, title: S.std ? "Class accuracy on " + S.std : "Class average on each set" }) : el("p", "sub", "Nothing scored yet.")); out.appendChild(card);
        if (pts.length >= 4) { const h = Math.floor(pts.length / 2), avg = (a) => a.reduce((s, p) => s + p.v, 0) / a.length, a1 = avg(pts.slice(0, h)), a2 = avg(pts.slice(h)); out.appendChild(el("p", "pgTrend", "Earlier half: " + pct(a1) + ". Later half: " + pct(a2) + ". " + (a2 - a1 >= 0.03 ? "Going up." : a1 - a2 >= 0.03 ? "Going down." : "About the same."))); }

        out.appendChild(el("h2", null, "Practice each week"));
        const fid = fidelity(P.details, P.students);
        if (!fid.weeks.length) out.appendChild(el("p", "sub", "Shows once a Vault Raid game is saved with results on."));
        else { const t = el("div", "pgWeeks"); fid.weeks.forEach((w) => { const c = el("div", "pgWeek"); c.append(el("b", null, String(w.per)), el("span", null, "questions per student"), el("small", null, "Week of " + fmtDay(w.wk) + " · " + w.games + (w.games === 1 ? " game" : " games") + " · " + w.kids + " played")); t.appendChild(c); }); out.appendChild(t); }
    }

    // ---------- Students: one row each, tap for the full record ----------
    function students(out, M) {
        const { P, cut } = M;
        const bar = el("div", "pgBarRow"), sel = el("select"), lab = el("label", "field"); lab.append(el("span", null, "Order"), sel);
        [["need", "Needs help first"], ["growth", "Most growth first"], ["name", "Name"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.appendChild(o); });
        sel.value = S.sort; sel.onchange = () => { S.sort = sel.value; draw(); }; bar.appendChild(lab); out.appendChild(bar);
        const list = P.students.slice();
        const g = (r) => (r.target ? r.target.earned : -1);
        if (S.sort === "need") list.sort((a, b) => b.weak.length - a.weak.length || (a.current ?? 2) - (b.current ?? 2));
        else if (S.sort === "growth") list.sort((a, b) => g(b) - g(a));
        else list.sort((a, b) => a.s.localeCompare(b.s));
        const box = el("div", "pgRows");
        list.forEach((r) => {
            const row = el("button", "pgRow"); row.type = "button"; row.onclick = () => openKid(M, r.s);
            const who = el("div", "pgRowName"); who.appendChild(el("b", null, r.s));
            const flags = el("span", "pgFlags");
            if (!r.onRoster) flags.appendChild(chip("not on roster", "warn"));
            if (r.excelling) flags.appendChild(chip("stretch", "ok"));
            if (r.idle) flags.appendChild(chip("not solving lately", "bad"));
            who.appendChild(flags);
            const trend = el("div", "pgRowTrend"); trend.appendChild(sparkline(r.sets.map((x) => x.v), r.s + " scores"));
            trend.appendChild(el("small", null, r.sets.length ? pct(r.baseline) + " → " + pct(r.current) : "no scores yet"));
            const goal = el("div", "pgRowGoal");
            if (r.target) { goal.appendChild(meter(r.target.earned, r.target.need, r.s + " progress to target")); goal.appendChild(el("small", null, r.target.top ? "At the top already" : r.target.earned >= r.target.need ? "Target met: +" + r.target.earned + " points" : r.target.earned + " of " + r.target.need + " points to target")); }
            else goal.appendChild(el("small", null, r.sets.length ? (3 - r.sets.length) + " more " + (3 - r.sets.length === 1 ? "set" : "sets") + " to set a target" : ""));
            const need = el("div", "pgRowNeed");
            need.appendChild(r.weak.length ? el("span", "pgBand b-low", r.weak[0].code + " " + pct(r.weak[0].latest)) : r.stds.length ? el("span", "pgBand b-ok", "No standard below " + pct(cut)) : el("small", null, "No standard scores"));
            const eff = el("div", "pgRowEff"), e = r.effort;
            eff.appendChild(el("small", null, e.games ? e.tries + " tries · " + (e.missed ? "fixed " + e.fixed + " of " + e.missed + " misses" : "no misses") : r.games.played ? r.games.played + " games, no effort detail" : "–"));
            eff.appendChild(el("small", null, "Solved " + (r.lastSolve ? fmtDay(r.lastSolve) : "–") + " · seen " + (r.lastSeen ? fmtDay(r.lastSeen) : "–")));
            row.append(who, trend, goal, need, eff); box.appendChild(row);
        });
        out.appendChild(box);
    }

    // ---------- Questions: the Vault Raid heatmap ----------
    function questions(out, M) {
        const games = M.P.details.slice().reverse();
        out.appendChild(el("h2", null, "Who got which question"));
        if (!games.length) { out.appendChild(el("p", "sub", "Each Vault Raid game played with “Save results to Class Data” on shows here: every student against every question, with tries and the most common wrong answer. Games saved before Nov 19, 2026 did not keep this detail.")); return; }
        const sel = el("select"), lab = el("label", "field"); lab.append(el("span", null, "Game"), sel);
        games.forEach((g) => { const o = el("option", null, fmtDay(g.date) + " · " + g.title); o.value = g.id; sel.appendChild(o); });
        if (!games.some((g) => g.id === S.game)) S.game = games[0].id; sel.value = S.game; sel.onchange = () => { S.game = sel.value; draw(); };
        out.appendChild(lab);
        const g = games.find((x) => x.id === S.game), H = heatmap(g, D.rosters[S.period] || []);
        const key = el("div", "pgKey"); [["ok", "✓ right first try"], ["mid", "↻ fixed after a miss"], ["low", "✗ missed"]].forEach(([k, t]) => { const s = el("span"); s.append(el("i", "b-" + k), document.createTextNode(t)); key.appendChild(s); }); key.appendChild(el("span", null, "Small number = steps used")); out.appendChild(key);
        const wrap = el("div", "gridwrap pgHeatWrap"), T = el("table", "pgHeat"), hr = el("tr");
        hr.appendChild(el("th", "pgHN", "Student"));
        H.qs.forEach((q, k) => { const th = el("th"); th.title = q.q + "  Answer: " + q.a; th.append(el("b", null, "Q" + (k + 1)), el("small", null, pct(q.n ? q.ok / q.n : null))); if (q.std) th.appendChild(el("small", null, q.std)); hr.appendChild(th); });
        hr.appendChild(el("th", null, "Right")); T.appendChild(hr);
        H.rows.forEach((r) => {
            const tr = el("tr"), n = el("th", "pgHN"); n.appendChild(nameBtn(M, r.s)); tr.appendChild(n);
            H.qs.forEach((q) => { const a = r.cells.get(q.i), td = el("td"); if (a) { td.className = a.o === 1 ? "b-ok" : a.o === 2 ? "b-mid" : "b-low"; td.textContent = a.o === 1 ? "✓" : a.o === 2 ? "↻" : "✗"; if (a.h) td.appendChild(el("sub", null, String(a.h))); td.title = r.s + ": " + (a.o === 1 ? "right first try" : a.o === 2 ? "fixed after a miss" : "missed") + (a.h ? ", " + a.h + " steps" : "") + (a.t ? ", " + a.t + " s" : ""); } tr.appendChild(td); });
            tr.appendChild(el("td", "num", r.right + "/" + r.tried)); T.appendChild(tr);
        });
        const fr = el("tr"); fr.appendChild(el("th", "pgHN", "Most common wrong answer"));
        H.qs.forEach((q) => fr.appendChild(el("td", "pgHW", q.w && q.w[0] ? q.w[0].y : ""))); fr.appendChild(el("td")); T.appendChild(fr);
        wrap.appendChild(T); out.appendChild(wrap);
        out.appendChild(el("h3", null, "The questions, hardest first"));
        const ol = el("ol", "pgQs");
        H.qs.forEach((q) => { const li = el("li"); li.append(el("b", null, q.q), el("span", null, "Answer: " + q.a + " · " + q.ok + " of " + q.n + " right first try" + (q.std ? " · " + q.std : ""))); if (q.w && q.w.length) li.appendChild(el("small", null, "Wrong answers seen: " + q.w.map((w) => w.y + " (" + w.n + ")").join(", "))); ol.appendChild(li); });
        out.appendChild(ol);
        out.appendChild(el("p", "sub", "Only Vault Raid keeps each student's answers. Team review games (Jeopardy-style boards, Rapid Fire and the rest) save team scores, so they count toward games played and wins only."));
    }

    // ---------- one student's record (teacher view, and the student's own view) ----------
    function openKid(M, name, studentView) {
        const r = M.P.students.find((x) => x.s === name); if (!r) return;
        const dlg = $("kid"); dlg.replaceChildren();
        const head = el("div", "pgKHead"), close = el("button", "btn ghost", "Close"); close.type = "button"; close.onclick = () => dlg.close();
        const flip = el("button", "btn ghost", studentView ? "Teacher view" : "Student view"); flip.type = "button"; flip.title = "A simpler view to show the student on your Chromebook. Not for the board."; flip.onclick = () => openKid(M, name, !studentView);
        head.append(el("h2", null, r.s), flip, close); head.firstChild.id = "kidName"; dlg.appendChild(head);
        if (studentView) kidStudent(dlg, M, r); else kidTeacher(dlg, M, r);
        if (!dlg.open) dlg.showModal();
    }
    function kidTeacher(dlg, M, r) {
        const { cut } = M;
        if (!r.onRoster) dlg.appendChild(el("p", "pgWarn", "This name did not match the " + S.period + " period roster. Fix the spelling on the Rosters page to join it to the right student."));
        dlg.appendChild(el("h3", null, "Growth"));
        if (r.sets.length) {
            const refs = r.target && !r.target.top ? [{ v: r.baseline, label: "Start", kind: "base" }, { v: r.target.typical, label: "Typical", kind: "target" }, { v: r.target.stretch, label: "Stretch", kind: "stretch" }] : r.baseline != null ? [{ v: r.baseline, label: "Start", kind: "base" }] : [];
            dlg.appendChild(lineChart(r.sets.map((x) => ({ d: x.d, v: x.v, label: x.title })), { refs, cut, title: r.s + " scores over time", h: 200 }));
            const p = el("p", "pgTrend");
            p.textContent = r.target ? (r.target.top ? "Started at " + pct(r.baseline) + ", already at the top. Keep it there." : "Started at " + pct(r.baseline) + ", now " + pct(r.current) + " (last 3 sets). " + r.target.earned + " of " + r.target.need + " points to the Typical target (" + pct(r.target.typical) + "); Stretch is " + pct(r.target.stretch) + ".") : r.sets.length + (r.sets.length === 1 ? " scored set" : " scored sets") + ". A target shows after 3.";
            dlg.appendChild(p);
            if (r.target && !r.target.top) dlg.appendChild(meter(r.target.earned, r.target.need, "Progress to the Typical target"));
        } else dlg.appendChild(el("p", "sub", "No scored sets yet."));

        dlg.appendChild(el("h3", null, "By standard"));
        if (!r.stds.length) dlg.appendChild(el("p", "sub", "No scores tagged with a standard yet."));
        const sl = el("div", "pgKStd");
        r.stds.slice().sort((a, b) => M.order.indexOf(a.code) - M.order.indexOf(b.code)).forEach((x) => {
            const row = el("div", "pgKStdRow"), lab = el("div"); lab.append(el("b", null, x.code), el("small", null, stdLine(M, x.code)));
            row.append(lab, sparkline(x.list.map((p) => p.v), x.code), el("span", "pgBand b-" + x.band, BAND_WORD[x.band] + " " + pct(x.latest)));
            sl.appendChild(row);
        });
        dlg.appendChild(sl);

        dlg.appendChild(el("h3", null, "Effort in Vault Raid"));
        const e = r.effort;
        if (!e.games) dlg.appendChild(el("p", "sub", "No effort detail saved yet (only games saved with results on, from Nov 19, 2026)."));
        else {
            const t = el("div", "pgTiles small");
            const tile = (n, l) => { const d = el("div", "pgTile"); d.append(el("b", null, n), el("span", null, l)); t.appendChild(d); };
            tile(String(e.tries), "tries in " + e.games + (e.games === 1 ? " game" : " games"));
            tile(e.missed ? e.fixed + " of " + e.missed : "–", "misses fixed after trying again");
            tile(String(e.steps), "help steps used");
            tile(e.secAvg != null ? e.secAvg + " s" : "–", "average time before first answer");
            if (e.redo) tile(e.redoOk + " of " + e.redo, "sent-back questions right");
            if (e.exit) tile(e.exitOk + " of " + e.exit, "exit ticket right");
            dlg.appendChild(t);
            const tb = el("table", "cdt pgKGames"), h = el("tr"); ["Game", "First tries", "Right", "Fixed", "Steps", "Minutes"].forEach((x) => h.appendChild(el("th", null, x))); tb.appendChild(h);
            e.perGame.slice().reverse().forEach((x) => { const tr = el("tr"); [fmtDay(x.d) + " · " + x.title, x.first, x.right, x.fixed, x.steps, x.mins || "–"].forEach((v, i) => tr.appendChild(el("td", i ? "num" : null, String(v)))); tb.appendChild(tr); });
            const w = el("div", "gridwrap"); w.appendChild(tb); dlg.appendChild(w);
        }
        dlg.appendChild(el("p", "sub", "Games played: " + r.games.played + (r.games.wins ? " · wins: " + r.games.wins : "") + " · last solved " + fmtDay(r.lastSolve) + " · last seen " + fmtDay(r.lastSeen) + "."));

        const b = r.behavior;
        const papers = el("p", "sub"), a = el("a", null, "Open " + r.s.split(" ")[0] + "'s folder of scanned papers"); a.href = "work.html?kid=" + encodeURIComponent(r.s) + "&per=" + encodeURIComponent(S.period);
        papers.append("Papers: ", a, " (filed by nine weeks and week)."); dlg.appendChild(papers);
        dlg.appendChild(el("h3", null, "Class tally (behaviour, kept apart)"));
        dlg.appendChild(el("p", "sub", b.days ? "Last 45 days, " + b.days + (b.days === 1 ? " day" : " days") + " marked: " + b.p + " participation · " + b.t + " on task · " + b.r + " redirects. This never changes a score, group or target." : "Nothing on the class tally in the last 45 days."));
    }
    function kidStudent(dlg, M, r) {
        const sum = studentSummary(r, M.cut, (code) => stdLine(M, code)), box = el("div", "pgStu");
        box.appendChild(el("p", "pgStuHi", "Here's your progress, " + r.s.split(" ")[0] + "."));
        if (sum.goal) {   // never a zero to stare at: before any growth, the goal is shown as a goal
            const g = el("div", "pgStuGoal");
            if (sum.goal.earned > 0) { g.append(el("b", null, sum.goal.earned + " / " + sum.goal.need), el("span", null, "growth points toward your goal")); g.appendChild(meter(sum.goal.earned, sum.goal.need, "Growth toward your goal")); }
            else g.append(el("b", null, "+" + sum.goal.need), el("span", null, "points is your growth goal from where you started. Every activity counts toward it."));
            box.appendChild(g);
        }
        if (r.sets.length > 1) box.appendChild(lineChart(r.sets.map((x) => ({ d: x.d, v: x.v, label: x.title })), { title: "Your scores", h: 180 }));
        const ul = el("ul", "pgStuList"); sum.lines.forEach((t) => ul.appendChild(el("li", null, t))); box.appendChild(ul);
        if (sum.got.length) { box.appendChild(el("h3", null, "You've got these")); const w = el("div", "pgStuStd"); sum.got.forEach((x) => { const d = el("div", "ok"); d.append(el("b", null, "✓ " + x.code), el("small", null, x.text)); w.appendChild(d); }); box.appendChild(w); }
        if (sum.work.length) { box.appendChild(el("h3", null, "Working on")); const w = el("div", "pgStuStd"); sum.work.forEach((x) => { const d = el("div", "work"); d.append(el("b", null, "→ " + x.code), el("small", null, x.text)); w.appendChild(d); }); box.appendChild(w); }
        box.appendChild(el("p", "sub", "For a one-on-one on your Chromebook. It shows only this student and never a rank or a lower number."));
        dlg.appendChild(box);
    }
    $("kid").addEventListener("click", (e) => { if (e.target === $("kid")) $("kid").close(); });   // tap outside to close

    draw();
}
