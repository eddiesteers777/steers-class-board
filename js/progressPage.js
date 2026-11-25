/* ==========================================
   Anchor Board — Student Progress page (progress.html).
   Loads the teacher's own documents, builds the record with js/progress.js and draws one view at a time:
   Today, Class, Students, Readiness, Questions. It writes only when the teacher taps Approve on a student's
   "Work on next" card (ACAP readiness, js/readiness.js + js/acapAssign.js): that saves one Practice assignment.
   ?demo fills a this-tab store with made-up students (js/progressDemo.js) and saves nothing.
========================================== */
import { sharedPeriod, saveSharedPeriod } from "./studentsNav.js?v=6";
import { buildProgress, distribution, standardOverTime, needGroups, missedOn, heatmap, engagement, fidelity, studentSummary, stdIn, BAND_WORD } from "./progress.js?v=4";
import { lineChart, sparkline, bandBar, meter } from "./charts.js?v=1";
import { STANDARDS } from "../data/standards.js?v=60";
import * as R from "./readiness.js?v=1";
import * as AA from "./acapAssign.js?v=4";
import * as K from "./checks.js?v=1";
import * as FB from "./foundBank.js?v=2";
import * as FT from "./foundational.js?v=2";
import * as AF from "./acapFormats.js?v=1";
import { matchRoster } from "./progress.js?v=4";
import { perKey } from "./profileCore.js?v=2";
import { shortNames } from "./vaultCore.js?v=75";
import { cleanItem as C_clean } from "./assignCore.js?v=7";

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
    const PER = demo ? DEMO_PERIODS : (await import("../data/weeks.js?v=63")).PERIODS;
    const CLS = Object.fromEntries(PER), PERIODS = PER.map(([p, c]) => [p, (STANDARDS[c] && STANDARDS[c].label) || c]);
    const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };

    const S = { period: [sharedPeriod(""), remember("period")].find((p) => p && PERIODS.some((x) => x[0] === p)) || "1st", view: remember("view") || "today", game: "", sort: "need", std: "" };
    if (!CLS[S.period]) S.period = PER[0][0];
    const D = { rosters: {}, marks: {}, index: null, imports: new Map(), results: [], pindex: null, details: new Map(), tally: new Map(), prof: new Map(), asg: [], bank: null, flu: [], found: new Map(), sets: [] };

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
    // ACAP readiness: game profiles (cracked locks) per period, and the Assignments list (one extra credit a week).
    store.watch("flu/index", (s) => { if (s.pending) return; D.flu = ((s.exists && s.data && s.data.list) || []).filter((x) => x && x.id); soon(); }, () => {});
    store.watch("games/index", (s) => { if (s.pending) return; D.sets = ((s.exists && s.data && s.data.sets) || []).filter((x) => x && x.id); soon(); }, () => {});
    store.watch("asg/index", (s) => { if (s.pending) return; D.asg = ((s.exists && s.data && s.data.list) || []).filter((x) => x && x.id); soon(); }, () => {});
    // Foundational track placements (Eddie places students by hand), one document per period.
    const watchFound = (per) => { if (D.found.has(per)) return; D.found.set(per, null); store.watch("found/" + perKey(per), (s) => { if (s.pending) return; D.found.set(per, s.exists ? s.data : false); soon(); }, () => D.found.set(per, false)); };
    const watchProf = (per) => { if (D.prof.has(per)) return; D.prof.set(per, null); store.watch("profiles/" + perKey(per), (s) => { if (s.pending) return; D.prof.set(per, s.exists ? s.data : false); soon(); }, () => D.prof.set(per, false)); };
    const rooms = demo ? memRooms() : store.rooms;
    const bank = () => (D.bank ? Promise.resolve(D.bank) : import("./stdBank.js?v=6").then((m) => m.loadStdBank()).then((b) => (D.bank = b)));
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
        watchProf(S.period); watchFound(S.period);
        const roster = (D.rosters[S.period] || []).map((n) => String(n).slice(0, 60));
        let RD = null;   // readiness, worked out the first time a view asks for it
        const ready = () => {
            if (RD) return RD;
            const nameOf = (s) => { const i = matchRoster(s, roster); return i >= 0 ? roster[i] : ""; };
            const trail = R.answerTrail(P.details, nameOf), prof = D.prof.get(S.period) || null;
            RD = new Map(P.students.filter((r) => r.onRoster).map((r) => [r.s, R.readinessOf(cls, C.standards, r, trail.get(r.s), R.kidOf(prof, r.s))]));
            const fdoc = D.found.get(S.period) || null;   // the foundational ladder for students placed on it
            P.students.filter((r) => r.onRoster).forEach((r) => { const x = RD.get(r.s); if (x) x.ladder = FT.ladderOf(FT.placementOf(fdoc, r.s), r, trail.get(r.s)); });
            return RD;
        };
        return { P, cut, cls, C, order, std, ready, bp: R.blueprintFor(cls), mark: (code) => ((D.marks[cls] || {})[code] || {}).s || "" };
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
        else ({ today, class: classView, students, ready: readiness, questions }[S.view] || today)(out, M);
    }
    const skeleton = () => { const s = el("div", "pgSkel"); s.setAttribute("aria-hidden", "true"); s.append(el("i"), el("i"), el("i")); return s; };
    function empty(h, p, label, href) { const box = el("div", "pgEmpty"); box.append(el("h2", null, h), el("p", null, p)); const a = el("a", "btn go", label); a.href = href; box.appendChild(a); return box; }
    const stdLine = (M, code) => { if (FB.isFoundational(code)) return "Foundational: " + FB.nameOf(code); const s = M.std(code); return s ? short(s.text, 90) : ""; };
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

    // ---------- Readiness: ACAP-weighted Not Yet / Developing / Secure by standard ----------
    const ST_CLS = { secure: "rd-s", developing: "rd-d", notyet: "rd-n", none: "rd-0" }, ST_SYM = { secure: "S", developing: "D", notyet: "N", none: "·" };
    const shareTxt = (c, bp) => c.pts + " of " + bp.total + " points (" + Math.round((100 * c.pts) / bp.total) + "%, worked out from the blueprint)";
    function rdKey() {
        const key = el("div", "pgKey");
        [["s", "Secure: lock met and 80%+ latest"], ["d", "Developing: 50 to 79%, or 80%+ before the lock"], ["n", "Not Yet: under 50%"], ["0", "Not checked yet"]].forEach(([k, t]) => { const s = el("span"); s.append(el("i", "rd-" + k), document.createTextNode(t)); key.appendChild(s); });
        return key;
    }
    function readiness(out, M) {
        if (!M.bp) { out.appendChild(el("p", "sub", "This class has no ACAP blueprint weights.")); return; }
        const RD = M.ready(), all = [...RD.values()].filter(Boolean), bp = M.bp;
        out.appendChild(el("h2", null, "ACAP readiness · " + bp.grade + " blueprint"));
        out.appendChild(el("p", "pgNote", R.NOT_A_PREDICTION + (M.cls === "8th-acc" ? " 8th Accelerated is scored on the Grade 8 blueprint; Algebra I standards are tracked on the other tabs, not weighted here." : "")));
        checksPanel(out, M, all);
        foundPanel(out, M);
        // category tiles
        const tiles = el("div", "rdCats");
        bp.cats.forEach((c) => {
            const t = el("div", "rdCat"), sum = (k) => all.reduce((s, x) => s + (((x.cats.find((y) => y.id === c.id) || {})[k]) || 0), 0);
            const tot = sum("secure") + sum("developing") + sum("notyet") + sum("none");
            t.append(el("b", null, c.name), el("small", null, "Standards " + bp.key + "." + c.from + "–" + bp.key + "." + c.to + " · " + shareTxt(c, bp)));
            const bar = el("div", "rdBar"); [["secure", "s"], ["developing", "d"], ["notyet", "n"], ["none", "0"]].forEach(([k, z]) => { const n = sum(k); if (!n) return; const i = el("i", "rd-" + z); i.style.flexGrow = n; i.title = n + " " + R.STATE_WORD[k]; bar.appendChild(i); });
            t.append(bar, el("small", null, tot ? sum("secure") + " Secure · " + sum("developing") + " Developing · " + sum("notyet") + " Not Yet · " + sum("none") + " not checked (student × standard)" : "No students yet"));
            tiles.appendChild(t);
        });
        out.appendChild(tiles);
        // where to focus
        out.appendChild(el("h2", null, "Where to focus"));
        const focus = R.classFocus(all).slice(0, 5);
        if (!focus.length) out.appendChild(el("p", "sub", "Nothing scored below Secure yet. Readiness fills in from tagged Class Data sets, Vault Raid games built from the standards bank, and Assignments."));
        else {
            out.appendChild(el("p", "sub", "Ranked by how far students are from Secure times each standard's share of its category's blueprint points. Tap a name to see their Work on next card."));
            const grid = el("div", "pgGroups");
            focus.forEach((f, k) => {
                const card = el("section", "pgGroup rdFocus"), head = el("div", "pgGHead");
                head.append(el("span", "pgGNum", "#" + (k + 1)), el("h3", null, f.code + (f.critical ? " ★" : "")), chip(f.cat.name));
                card.append(head, el("p", "pgGText", short(f.text, 140)));
                card.appendChild(el("p", "pgProfile", f.notyet + " Not Yet · " + f.developing + " Developing · " + f.secure + " Secure · about " + (Math.round(f.cat.per * 10) / 10) + " of " + bp.total + " points per standard in this category"));
                const who = el("div", "pgWho");
                [...RD.entries()].filter(([, x]) => x).map(([s, x]) => ({ s, r: x.rows.find((y) => y.code === f.code) })).filter((y) => y.r && (y.r.state === "notyet" || y.r.state === "developing")).sort((a, b) => a.r.latest - b.r.latest)
                    .forEach((y, i, arr) => { if (i < 6) { const b = nameBtn(M, y.s); b.appendChild(el("small", null, R.STATE_WORD[y.r.state] + " " + pct(y.r.latest))); who.appendChild(b); } else if (i === 6) who.appendChild(el("small", "rdMore", "+" + (arr.length - 6) + " more on the grid below")); });
                card.appendChild(who); grid.appendChild(card);
            });
            out.appendChild(grid);
        }
        // the grid
        out.appendChild(el("h2", null, "Every student, every standard"));
        out.appendChild(rdKey());
        const codes = M.C.standards.map((s) => s.code).filter((c) => R.catOf(M.cls, c));
        const wrap = el("div", "gridwrap rdWrap"), T = el("table", "rdGrid"), h1 = el("tr"), h2 = el("tr");
        h1.appendChild(el("th", "rdN", "")); h2.appendChild(el("th", "rdN", "Student"));
        bp.cats.forEach((c) => { const mine = codes.filter((x) => R.catOf(M.cls, x).id === c.id); if (!mine.length) return; const th = el("th", "rdCh", c.name + " · " + c.pts + " pts"); th.colSpan = mine.length; h1.appendChild(th); mine.forEach((x, i) => { const t = el("th", i === 0 ? "rdC first" : "rdC", x.split(".")[1]); t.title = x + " " + short((M.std(x) || {}).text || "", 120); h2.appendChild(t); }); });
        T.append(h1, h2);
        [...RD.entries()].forEach(([s, x]) => {
            if (!x) return; const tr = el("tr"), n = el("th", "rdN"); n.appendChild(nameBtn(M, s)); tr.appendChild(n);
            bp.cats.forEach((c) => codes.filter((y) => R.catOf(M.cls, y).id === c.id).forEach((code, i) => {
                const r = x.rows.find((y) => y.code === code), td = el("td", ST_CLS[r.state] + (i === 0 ? " first" : ""), ST_SYM[r.state]);
                td.title = s + " · " + code + ": " + R.STATE_WORD[r.state] + (r.latest != null ? ", " + pct(r.latest) + " latest" : "") + (r.state !== "none" && !r.lock.met ? " · lock: " + r.lock.left : r.lock.met ? " · lock met" : "");
                tr.appendChild(td);
            }));
            T.appendChild(tr);
        });
        wrap.appendChild(T); out.appendChild(wrap);
        out.appendChild(el("p", "sub", "Column numbers are standard numbers (" + bp.key + ".1, " + bp.key + ".2, …). Hover or tap and hold a square for the score and what the lock still needs."));
    }

    // ---------- the checks: Monday diagnostic, Friday check, cumulative check, Fact Blitz ----------
    let CK = null;   // the check being built: { kind, cls, slots, periods, msg }
    const fmtAgo = (ms) => { if (!ms) return "never"; const d = Math.round((Date.now() - ms) / 864e5); return fmtDay(new Date(ms).toISOString().slice(0, 10)) + (d < 1 ? " (today)" : " (" + d + (d === 1 ? " day" : " days") + " ago)"); };
    function checksPanel(out, M, all) {
        out.appendChild(el("h2", null, "Checks"));
        const perOfCls = PER.filter((p) => p[1] === M.cls).map((p) => p[0]);
        const need = new Map(R.classFocus(all).map((f) => [f.code, f.need]));
        const scored = new Set(all.flatMap((x) => x.rows.filter((r) => r.state !== "none").map((r) => r.code)));
        const grid = el("div", "rdChecks");
        Object.entries(K.KINDS).forEach(([kind, k]) => {
            const last = D.asg.filter((a) => a.chk === kind && a.cls === M.cls && a.status !== "draft").sort((a, b) => (b.opened || b.at || 0) - (a.opened || a.at || 0))[0];
            const c = el("section", "rdCheck"); c.append(el("b", null, k.label), el("p", null, k.blurb), el("small", null, "Last given: " + (last ? fmtAgo(last.opened || last.at) : "never") + (kind === "cum" && last ? " · next due " + fmtDay(new Date((last.opened || last.at) + 28 * 864e5).toISOString().slice(0, 10)) : "")));
            const b = el("button", "btn" + (CK && CK.kind === kind && CK.cls === M.cls ? "" : " ghost"), "Build it"); b.type = "button"; b.setAttribute("aria-label", "Build a " + k.label);
            b.onclick = () => { const ctx = { cls: M.cls, order: M.order, marks: Object.fromEntries(Object.entries(D.marks[M.cls] || {}).map(([c, m]) => [c, (m && m.s) || ""])), need, scored }; CK = { kind, cls: M.cls, ctx, slots: K.planCheck(kind, ctx), periods: perOfCls.slice(), msg: "" }; draw(); };
            c.appendChild(b); grid.appendChild(c);
        });
        const lastFlu = (D.flu || []).filter((f) => f.mode === "check").sort((a, b) => (b.at || 0) - (a.at || 0))[0];
        const f = el("section", "rdCheck"); f.append(el("b", null, "Fluency (Fact Blitz)"), el("p", null, "Monthly speed check, same 2-minute format every time so the trend means something. Each student's first, latest and change are on the Fact Blitz page."), el("small", null, "Last speed check: " + (lastFlu ? fmtAgo(lastFlu.at) + " · next due " + fmtDay(new Date(lastFlu.at + 30 * 864e5).toISOString().slice(0, 10)) : "never")));
        const fa = el("a", "btn ghost", "Open Fact Blitz"); fa.href = "fluency.html"; f.appendChild(fa); grid.appendChild(f);
        // The Vault Raid spiral: 70% this week, 30% earlier standards, about 1 in 4 of this week's questions in an ACAP format.
        const lastSp = D.sets.filter((x) => x.sp && x.cls === M.cls).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
        const v = el("section", "rdCheck"); v.append(el("b", null, "Vault Raid spiral"), el("p", null, "A question set for Vault Raid: 70% this week's standard, 30% earlier ones the class is weakest on, with ACAP formats mixed in (which is NOT true, select all, order the steps, show your work)."), el("small", null, "Last made: " + (lastSp ? fmtAgo(lastSp.at) : "never")));
        const vb = el("button", "btn" + (SP && SP.cls === M.cls ? "" : " ghost"), "Build it"); vb.type = "button"; vb.setAttribute("aria-label", "Build a Vault Raid spiral set");
        vb.onclick = () => { const ctx = { cls: M.cls, order: M.order, marks: Object.fromEntries(Object.entries(D.marks[M.cls] || {}).map(([c, m]) => [c, (m && m.s) || ""])), need }; const pick = AF.spiralCodes(ctx); SP = { cls: M.cls, ctx, now: pick.now.slice(0, 1), earlier: pick.earlier, periods: perOfCls.slice(), msg: "" }; draw(); };
        v.appendChild(vb); grid.appendChild(v);
        out.appendChild(grid);
        if (CK && CK.cls === M.cls) out.appendChild(checkBuilder(M, perOfCls));
        if (SP && SP.cls === M.cls) out.appendChild(spiralBuilder(M, perOfCls));
    }
    function checkBuilder(M, perOfCls) {
        const k = K.KINDS[CK.kind], box = el("section", "rdBuild");
        box.append(el("h3", null, k.label + " for " + ((STANDARDS[M.cls] || {}).label || M.cls)));
        box.appendChild(el("p", "pgProfile", CK.kind === "diag" ? "The two earlier standards are the class's weakest standards taught before the new one. Swap any question's standard below." : CK.kind === "cum" ? "Spread by ACAP blueprint points over the standards marked Teaching, Taught or Reteach on the Standards page, the class's weakest first. Swap any question's standard below." : "From the standards marked Teaching on the Standards page. Swap any question's standard below."));
        if (CK.kind !== "cum" && CK.slots.length) {
            // One choice for the week's standard re-plans the whole check (the earlier standards follow it).
            const cur = (CK.slots.find((x) => x.role !== "prior") || CK.slots[0]).code, l = el("label", "field rdWeek"), sel = el("select");
            M.order.forEach((code) => { const o = el("option", null, code + " · " + short((M.std(code) || {}).text || "", 70)); o.value = code; sel.appendChild(o); });
            sel.value = cur; sel.onchange = () => { CK.slots = K.planCheck(CK.kind, Object.assign({}, CK.ctx, { focus: [sel.value] })); CK.msg = ""; draw(); };
            l.append(el("span", null, CK.kind === "diag" ? "New standard this week" : "This week's standard"), sel); box.appendChild(l);
        }
        const counts = K.catCounts(M.cls, CK.slots); box.appendChild(el("p", "pgProfile", [...counts.entries()].map(([n, c]) => n + ": " + c).join(" · ")));
        const list = el("ol", "rdSlots");
        CK.slots.forEach((sl, i) => {
            const li = el("li"), sel = el("select"); sel.setAttribute("aria-label", "Standard for question " + (i + 1));
            M.order.forEach((code) => { const o = el("option", null, code + " · " + short((M.std(code) || {}).text || "", 70)); o.value = code; sel.appendChild(o); });
            sel.value = sl.code; sel.onchange = () => { sl.code = sel.value; CK.msg = ""; draw(); };
            li.append(el("span", "rdRole", K.ROLE_WORD[sl.role]), sel); list.appendChild(li);
        });
        box.appendChild(list);
        const pers = el("div", "rdPers"); pers.appendChild(el("span", null, "Periods"));
        perOfCls.forEach((p) => { const l = el("label", "asChk sm"), c = el("input"); c.type = "checkbox"; c.checked = CK.periods.includes(p); c.onchange = () => { CK.periods = perOfCls.filter((q) => (q === p ? c.checked : CK.periods.includes(q))); }; l.append(c, document.createTextNode(" " + p)); pers.appendChild(l); });
        box.appendChild(pers);
        const placed = CK.periods.flatMap((p) => FT.placedNames(D.found.get(p)).map((nm) => ({ p, nm })));
        if (placed.length) {
            if (CK.fall == null) CK.fall = CK.kind === "week";   // Friday check: the foundational group works its own step instead; diagnostics and the cumulative check still go to everyone
            const l = el("label", "asChk sm rdFall"), c = el("input"); c.type = "checkbox"; c.checked = CK.fall; c.onchange = () => { CK.fall = c.checked; };
            l.append(c, document.createTextNode(" Foundational group (" + placed.map((x) => x.nm).join(", ") + ") gets their own foundational practice instead of this check"));
            box.appendChild(l);
        }
        box.appendChild(el("p", "pgProfile", "It goes out as a Quiz: one question per line, one try, no feedback until you release results on Assignments. Each answer lands in Readiness by student and standard."));
        const row = el("div", "rdBtns"), msg = el("p", "rdMsg", CK.msg || ""); msg.setAttribute("role", "status");
        const go = el("button", "btn go", "Approve and assign"); go.type = "button";
        go.onclick = async () => {
            if (!CK.periods.length) { CK.msg = "Pick at least one period."; draw(); return; }
            go.disabled = true; msg.textContent = "Saving…";
            try {
                const items = await bank(), title = K.titleFor(CK.kind, CK.slots), def = K.buildQuiz(CK.kind, CK.slots, items, M.cls, CK.periods, title);
                if (!def) throw Object.assign(new Error("bank"), { code: "a standard here has no problems in the bank yet; swap it" });
                const fall = CK.fall ? CK.periods.flatMap((p) => FT.placedNames(D.found.get(p)).map((nm) => ({ p, nm }))) : [];
                const names = Object.fromEntries(CK.periods.map((p) => { const lines = (D.rosters[p] || []).filter(Boolean), sn = shortNames(lines); return [p, sn.map((n, i) => (fall.some((x) => x.p === p && (x.nm === lines[i] || x.nm === n)) ? "" : n))]; }));
                const saved = await AA.approveWith(store, rooms, user.uid, def, D.asg, names);
                D.asg = D.asg.filter((a) => a.id !== saved.id).concat([AA.indexEntry(saved)]);
                let extra = "";
                if (fall.length) { const made = await approveFound(M, fall); extra = " Foundational practice: " + made + "."; }
                CK.msg = "Assigned: " + saved.title + ". Code " + saved.code + " for " + CK.periods.join(", ") + " period. Release results on Assignments when everyone is done." + extra;
                CK.slots = []; draw();
            } catch (e) { CK.msg = "Not assigned (" + ((e && e.code) || "connection") + "). Try again."; draw(); }
        };
        const cancel = el("button", "btn ghost", "Close"); cancel.type = "button"; cancel.onclick = () => { CK = null; draw(); };
        if (CK.slots.length) row.append(go); row.append(cancel); box.append(row, msg);
        return box;
    }

    // ---------- the Vault Raid spiral set ----------
    let SP = null;   // { cls, ctx, now: [code], earlier: [codes], periods, msg, saved }
    const FMT_WORD = { not: "Which is NOT true", ms: "Select all", ord: "Order the steps", sw: "Show your work" };
    function spiralBuilder(M, perOfCls) {
        const box = el("section", "rdBuild rdSpiral");
        box.append(el("h3", null, "Vault Raid spiral for " + ((STANDARDS[M.cls] || {}).label || M.cls)));
        box.appendChild(el("p", "pgProfile", "This week's standard comes from the one marked Teaching on the Standards page. The review standards are the class's weakest standards taught before it. Swap any of them."));
        const opts = (sel, cur, blank) => { if (blank) { const o = el("option", null, "None"); o.value = ""; sel.appendChild(o); } M.order.forEach((code) => { const o = el("option", null, code + " · " + short((M.std(code) || {}).text || "", 70)); o.value = code; sel.appendChild(o); }); sel.value = cur || ""; };
        const wk = el("label", "field rdWeek"), ws = el("select"); opts(ws, SP.now[0]);
        ws.onchange = () => { const pick = AF.spiralCodes(Object.assign({}, SP.ctx, { focus: [ws.value] })); SP.now = [ws.value]; SP.earlier = pick.earlier; SP.msg = ""; SP.saved = null; draw(); };
        wk.append(el("span", null, "This week's standard (70%)"), ws); box.appendChild(wk);
        const rv = el("div", "rdPers"); rv.appendChild(el("span", null, "Review (30%)"));
        [0, 1, 2].forEach((i) => { const sel = el("select"); sel.setAttribute("aria-label", "Review standard " + (i + 1)); opts(sel, SP.earlier[i], true); sel.onchange = () => { const e = SP.earlier.slice(); e[i] = sel.value; SP.earlier = e.filter(Boolean); SP.msg = ""; SP.saved = null; draw(); }; rv.appendChild(sel); });
        box.appendChild(rv);
        const prev = el("div", "rdSpPrev"); prev.appendChild(el("p", "pgProfile", "Loading the question bank…")); box.appendChild(prev);
        const made = () => AF.spiralSet({ cls: M.cls, now: SP.now, earlier: SP.earlier.filter((c) => !SP.now.includes(c)), bank: D.bank, n: 20, seed: SP.now.join() + "|" + new Date().toDateString(), title: AF.spiralTitle(SP.now), per: SP.periods });
        bank().then(() => {
            if (!prev.isConnected) return;
            const r = made(); prev.textContent = "";
            const f = r.counts.fmt, fm = Object.keys(f).filter((k) => f[k]).map((k) => f[k] + " " + FMT_WORD[k]).join(", ");
            prev.appendChild(el("p", "pgProfile", (r.counts.now + r.counts.old) + " questions: " + r.counts.now + " on this week's standard, " + r.counts.old + " review." + (fm ? " ACAP formats: " + fm + "." : " No ACAP formats fit these problems.")));
            if (r.short.length) prev.appendChild(el("p", "pgProfile", "The bank has only a few problems for " + r.short.join(", ") + ", so the set is short. Vault Raid repeats questions in a mixed order, and you can add your own in the Question Maker."));
            const ol = el("ol", "rdSpList");
            r.doc.cats.forEach((c) => c.clues.forEach((q) => { const li = el("li"); li.append(el("span", "rdRole", c.n + (q.fm ? " · " + FMT_WORD[q.fm] : "")), el("span", null, short(String(q.q).replace(/\s+/g, " "), 110))); ol.appendChild(li); }));
            prev.appendChild(ol);
        });
        const pers = el("div", "rdPers"); pers.appendChild(el("span", null, "Show it for"));
        perOfCls.forEach((p) => { const l = el("label", "asChk sm"), c = el("input"); c.type = "checkbox"; c.checked = SP.periods.includes(p); c.onchange = () => { SP.periods = perOfCls.filter((q) => (q === p ? c.checked : SP.periods.includes(q))); }; l.append(c, document.createTextNode(" " + p)); pers.appendChild(l); });
        box.appendChild(pers);
        box.appendChild(el("p", "pgProfile", "Saving makes an ordinary Vault Raid question set. Nothing goes to students until you start Vault Raid on the Remote and pick it. Saved results land in Readiness per standard."));
        const row = el("div", "rdBtns"), msg = el("p", "rdMsg", SP.msg || ""); msg.setAttribute("role", "status");
        const go = el("button", "btn go", "Save the Vault Raid set"); go.type = "button";
        go.onclick = async () => {
            go.disabled = true; msg.textContent = "Saving…";
            try {
                await bank(); const r = made(), n = r.doc.cats.reduce((t, c) => t + c.clues.length, 0);
                if (n < 3) throw Object.assign(new Error("few"), { code: "the bank has too few problems for these standards" });
                const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at = Date.now();
                await store.save("games/s_" + id, Object.assign({ id, at }, r.doc));
                const meta = { id, title: r.doc.title, cats: r.doc.cats.length, clues: n, final: false, per: SP.periods.slice(), maker: 1, sp: 1, cls: M.cls, at };
                D.sets = D.sets.filter((x) => x.id !== id).concat([meta]);
                await store.save("games/index", { sets: D.sets, at });
                SP.saved = id; SP.msg = "Saved: " + r.doc.title + " (" + n + " questions). Start it on the Remote: Student Game, Vault Raid, then pick it from the question sets."; draw();
            } catch (e) { SP.msg = "Not saved (" + ((e && e.code) || "connection") + "). Try again."; draw(); }
        };
        const cancel = el("button", "btn ghost", "Close"); cancel.type = "button"; cancel.onclick = () => { SP = null; draw(); };
        if (!SP.saved) row.append(go);
        else { const a = el("a", "btn ghost", "Open it in the Question Maker"); a.href = "maker.html?set=" + encodeURIComponent(SP.saved); row.append(a); }
        row.append(cancel); box.append(row, msg);
        return box;
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
        if (M.bp && r.onRoster) kidReady(dlg, M, r);
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
    /* ---------- one student's ACAP readiness and Work on next (nothing is assigned until Approve) ---------- */
    const pickAt = new Map();   // which suggestion is showing, per student
    function kidReady(dlg, M, r) {
        const x = M.ready().get(r.s); if (!x) return;
        kidFound(dlg, M, r, x);
        dlg.appendChild(el("h3", null, "ACAP readiness"));
        const cats = el("div", "rdKCats");
        x.cats.forEach((c) => {
            const row = el("div", "rdKCat"), bar = el("div", "rdBar");
            [["secure", "s"], ["developing", "d"], ["notyet", "n"], ["none", "0"]].forEach(([k, z]) => { if (!c[k]) return; const i = el("i", "rd-" + z); i.style.flexGrow = c[k]; bar.appendChild(i); });
            row.append(el("b", null, c.name), el("small", null, c.pts + " of " + x.bp.total + " pts · " + c.secure + " Secure, " + c.developing + " Developing, " + c.notyet + " Not Yet, " + c.none + " not checked"), bar);
            cats.appendChild(row);
        });
        dlg.appendChild(cats);
        dlg.appendChild(el("p", "pgNote", R.NOT_A_PREDICTION));

        const card = el("section", "rdNext"); dlg.appendChild(card);
        const mine = D.asg.filter((a) => a.only && a.only.per === S.period && a.only.nm === r.s && a.status === "open");
        const paint = () => {
            card.replaceChildren(); const list = x.next, k = Math.min(pickAt.get(r.s) || 0, Math.max(0, list.length - 1)), s = list[k];
            card.appendChild(el("b", "rdNextH", "Work on next"));
            if (!s) { card.appendChild(el("p", null, x.rows.some((y) => y.state !== "none") ? "Nothing below Secure among the standards scored so far." : "Nothing scored yet. A Monday diagnostic, a tagged Class Data set or a standards-bank Vault Raid game fills this in.")); return; }
            const h = el("div", "pgGHead"); h.append(el("h3", null, s.code + (s.critical ? " ★" : "")), el("span", "pgBand rdb-" + (s.state === "notyet" ? "n" : "d"), R.STATE_WORD[s.state] + " " + pct(s.latest)));
            if (list.length > 1) h.appendChild(el("small", "rdOf", "Suggestion " + (k + 1) + " of " + list.length));
            card.append(h, el("p", "pgGText", short(s.text, 220)), el("p", "pgProfile", R.whyLine(s, x.bp.total)));
            const calc = R.calcOf(M.cls, s.code); if (calc) card.appendChild(el("p", "pgProfile", "Calculator on ACAP for this standard: " + ({ yes: "yes", no: "no (practise without one)", neutral: "either way" }[calc])));
            card.appendChild(el("p", "pgProfile", "Approve makes a Practice assignment for " + r.s + " only: 5 right from the standards bank (" + (s.state === "notyet" ? "On-ramp and On level" : "On level and Stretch") + " problems), worked steps after a miss. It counts toward the lock."));
            const row = el("div", "rdBtns"), msg = el("p", "rdMsg"); msg.setAttribute("role", "status");
            const xcHas = R.extraThisWeek(D.asg, S.period, r.s);
            const go = (xc) => async () => {
                row.querySelectorAll("button").forEach((b) => { b.disabled = true; }); msg.textContent = "Saving…";
                try {
                    const items = await bank(), pool = AA.poolFor(items, M.cls, s.code, s.state);
                    if (pool.length < 3) throw Object.assign(new Error("few"), { code: "the bank has too few problems for " + s.code });
                    const def = AA.makeDef({ cls: M.cls, per: S.period, nm: r.s, code: s.code, text: s.text, state: s.state, latest: s.latest, pool, xc });
                    const saved = await AA.approve(store, rooms, user.uid, def, D.asg, D.rosters[S.period] || []);
                    D.asg = D.asg.filter((a) => a.id !== saved.id).concat([AA.indexEntry(saved)]);
                    row.hidden = true;
                    msg.replaceChildren(document.createTextNode("Assigned" + (xc ? " as extra credit" : "") + ". Code " + saved.code + " · " + r.s.split(" ")[0] + " opens "), (() => { const a = el("a", null, "do.html?c=" + saved.code); a.href = "do.html?c=" + saved.code; a.target = "_blank"; return a; })(), document.createTextNode(" and taps their name. Results show on Assignments."));
                } catch (e) { msg.textContent = "Not assigned (" + ((e && e.code) || "connection") + "). Try again."; row.querySelectorAll("button").forEach((b) => { b.disabled = false; }); }
            };
            const b1 = el("button", "btn go", "Approve practice"); b1.type = "button"; b1.onclick = go(false);
            const b2 = el("button", "btn", xcHas ? "Extra credit used this week" : "Approve as extra credit"); b2.type = "button"; b2.disabled = !!xcHas; b2.onclick = go(true);
            if (xcHas) b2.title = "One extra credit a week for now: " + xcHas.title;
            const b3 = el("button", "btn ghost", "Copy for DeltaMath / Magma"); b3.type = "button";
            b3.onclick = async () => {
                const items = await bank(), cv = AA.copyVersion({ code: s.code, text: s.text, calc, pool: AA.poolFor(items, M.cls, s.code, s.state, 11) }, r.s);
                if (!cv.n) { msg.textContent = "The bank has too few problems for " + s.code + " to make a copy."; return; }
                copyBox(card, cv.text, s.code);
            };
            row.append(b1, b2, b3);
            if (list.length > 1) { const b4 = el("button", "btn ghost", "Another suggestion"); b4.type = "button"; b4.onclick = () => { pickAt.set(r.s, (k + 1) % list.length); paint(); }; row.append(b4); }
            card.append(row, msg);
            if (mine.length) { const o = el("p", "pgProfile"); o.textContent = "Open for " + r.s + " now: " + mine.map((a) => a.title + (a.code ? " (code " + a.code + ")" : "")).join(" · "); card.appendChild(o); }
        };
        paint();
    }
    /* ---------- the foundational track (students Eddie places by hand) ---------- */
    const placeDoc = async (doc, name) => { await store.save("found/" + perKey(S.period), doc); D.found.set(S.period, doc); draw(); if (name && $("kid").open) openKid(model(), name); };
    /** One-student foundational practice on each student's current step; skips a step already open. Returns a summary. */
    async function approveFound(M, who) {
        const RD = M.ready(), done = [], skip = [];
        for (const w of who) {
            const per = w.p || S.period; if (per !== S.period) { skip.push(w.nm + " (open " + per + " period to assign)"); continue; }
            const x = RD.get(w.nm), cur = x && x.ladder && x.ladder.current; if (!cur) { skip.push(w.nm + " (every step Secure)"); continue; }
            const open = FT.openFor(D.asg, per, w.nm, cur.id); if (open) { skip.push(w.nm + " (" + cur.name + " already open, code " + open.code + ")"); continue; }
            const pool = FB.problemsFor(cur.id).map(C_clean);
            const def = AA.makeDef({ cls: M.cls, per, nm: w.nm, code: cur.id, text: cur.name, state: cur.state, latest: cur.latest, pool, fnd: true });
            const saved = await AA.approve(store, rooms, user.uid, def, D.asg, D.rosters[per] || []);
            D.asg = D.asg.filter((a) => a.id !== saved.id).concat([AA.indexEntry(saved)]);
            done.push(w.nm + " " + cur.name + " (code " + saved.code + ")");
        }
        return (done.length ? done.join(", ") : "none made") + (skip.length ? "; skipped " + skip.join(", ") : "");
    }
    function foundPanel(out, M) {
        const RD = M.ready(), kids = [...RD.entries()].filter(([, x]) => x && x.ladder);
        out.appendChild(el("h2", null, "Foundational group"));
        if (!kids.length) { out.appendChild(el("p", "sub", "Nobody placed in " + S.period + " period. Open a student and tap “Place on the foundational track” when grade-level work is out of reach. They work one skill at a time and move up only when it's Secure.")); return; }
        out.appendChild(el("p", "sub", "One skill at a time, pounded until Secure (the lock and 80%+), then the next. Practice is 5 right a day from that skill, with worked steps after a miss."));
        const box = el("div", "rdFound");
        kids.forEach(([nm, x]) => {
            const L = x.ladder, row = el("div", "rdFRow"), cur = L.current;
            row.appendChild(nameBtn(M, nm));
            row.appendChild(ladderStrip(L));
            const open = cur && FT.openFor(D.asg, S.period, nm, cur.id);
            row.appendChild(el("small", null, cur ? cur.name + " · " + R.STATE_WORD[cur.state] + (cur.latest != null ? " " + pct(cur.latest) : "") + (cur.lock.met ? "" : " · lock: " + cur.lock.left) + (open ? " · open, code " + open.code : "") : "Every step Secure: ready for grade-level work"));
            box.appendChild(row);
        });
        out.appendChild(box);
        const row = el("div", "rdBtns"), msg = el("p", "rdMsg"); msg.setAttribute("role", "status");
        const go = el("button", "btn go", "Approve today's foundational practice for all " + kids.length); go.type = "button";
        go.onclick = async () => { go.disabled = true; msg.textContent = "Saving…"; try { msg.textContent = "Made: " + (await approveFound(M, kids.map(([nm]) => ({ p: S.period, nm })))) + "."; } catch (e) { msg.textContent = "Not assigned (" + ((e && e.code) || "connection") + "). Try again."; go.disabled = false; } };
        row.appendChild(go); out.append(row, msg);
    }
    function ladderStrip(L) {
        const strip = el("div", "rdLadder");
        L.steps.forEach((s) => { if (s.before) return; const i = el("i", s.state === "secure" ? "rd-s" : L.current && s.id === L.current.id ? "rd-cur" : s.state === "none" ? "rd-0" : s.state === "notyet" ? "rd-n" : "rd-d", s.state === "secure" ? "✓" : ""); i.title = s.name + ": " + R.STATE_WORD[s.state]; strip.appendChild(i); });
        return strip;
    }
    function kidFound(dlg, M, r, x) {
        const doc = D.found.get(S.period) || null, pl = FT.placementOf(doc, r.s), L = x.ladder;
        const sec = el("section", "rdFKid"); dlg.appendChild(sec);
        const sel = el("select"); sel.setAttribute("aria-label", "Start the ladder at");
        FB.LADDER.forEach((s, i) => { const o = el("option", null, (i + 1) + ". " + s.name); o.value = s.id; sel.appendChild(o); });
        sel.value = pl ? pl.start : FB.LADDER[0].id;
        if (!pl) {
            sec.append(el("b", "rdNextH", "Foundational track"), el("p", "pgProfile", "For when grade-level work is out of reach. They work one below-grade skill at a time and only move up when it's Secure. Start at:"));
            const b = el("button", "btn", "Place on the foundational track"); b.type = "button"; b.onclick = () => placeDoc(FT.place(doc, r.s, sel.value), r.s);
            const row = el("div", "rdBtns"); row.append(sel, b); sec.appendChild(row); return;
        }
        sec.classList.add("on");
        const cur = L && L.current;
        sec.append(el("b", "rdNextH", "Foundational track · step " + (cur ? FB.LADDER.findIndex((s) => s.id === cur.id) + 1 : "done") + " of " + FB.LADDER.length));
        if (L) sec.appendChild(ladderStrip(L));
        if (cur) {
            sec.append(el("h3", null, cur.name), el("p", "pgProfile", R.STATE_WORD[cur.state] + (cur.latest != null ? " (" + pct(cur.latest) + " latest)" : "") + ". Secure needs the lock" + (cur.lock.met ? " (met)" : ": " + cur.lock.left) + " and 80%+ latest. It opens up " + cur.helps.join(", ") + "."));
        } else sec.appendChild(el("p", null, "Every step from the start is Secure. Time for grade-level work (Work on next below)."));
        const row = el("div", "rdBtns"), msg = el("p", "rdMsg"); msg.setAttribute("role", "status");
        if (cur) {
            const open = FT.openFor(D.asg, S.period, r.s, cur.id);
            const go = el("button", "btn go", open ? "Open now, code " + open.code : "Approve " + cur.name.toLowerCase() + " practice"); go.type = "button"; go.disabled = !!open;
            go.onclick = async () => { go.disabled = true; msg.textContent = "Saving…"; try { msg.textContent = "Made: " + (await approveFound(M, [{ p: S.period, nm: r.s }])) + "."; } catch (e) { msg.textContent = "Not assigned (" + ((e && e.code) || "connection") + ")."; go.disabled = false; } };
            const cp = el("button", "btn ghost", "Copy for DeltaMath / Magma"); cp.type = "button";
            cp.onclick = () => { const cv = AA.copyVersion({ code: cur.name, text: "", calc: "", pool: FB.problemsFor(cur.id).map(C_clean) }, r.s); copyBox(sec, cv.text, cur.name); };
            row.append(go, cp);
        }
        const mv = el("button", "btn ghost", "Start at"); mv.type = "button"; mv.onclick = () => placeDoc(FT.place(doc, r.s, sel.value), r.s);
        const off = el("button", "btn ghost", "Take off the track"); off.type = "button"; off.onclick = () => placeDoc(FT.unplace(doc, r.s), r.s);
        row.append(sel, mv, off); sec.append(row, msg);
    }
    function copyBox(card, text, code) {
        const old = card.querySelector(".rdCopy"); if (old) old.remove();
        const box = el("div", "rdCopy"), ta = el("textarea"); ta.value = text; ta.rows = 14; ta.readOnly = true; ta.setAttribute("aria-label", "Practice for " + code + " to paste into DeltaMath or Magma Math");
        const b = el("button", "btn ghost", "Copy"); b.type = "button";
        b.onclick = async () => { try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; } catch (e) { ta.select(); b.textContent = "Press Ctrl+C"; } };
        box.append(el("small", null, "One worked example, the problems, then the answer key (keep the key for yourself). Paste into a DeltaMath custom problem set or a Magma Math assignment."), ta, b);
        card.appendChild(box);
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

/** ?demo: assignments are "saved" in this tab only. */
function memRooms() {
    const docs = new Map();
    return { get: async (p) => (docs.has(p) ? JSON.parse(JSON.stringify(docs.get(p))) : null), save: async (p, d) => { docs.set(p, JSON.parse(JSON.stringify(d))); } };
}
