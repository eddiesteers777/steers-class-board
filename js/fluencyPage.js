/* ==========================================
   Anchor Board — Fact Blitz, the teacher's page (fluency.html).
   Open a timed facts check (or a practice) with a code, watch the class play on Chromebooks, give extra time
   to the students who need it, and see each student's fluency over time. Rules live in js/factCore.js.

   Saved (private, teacher/{uid}/…):
     flu/index      the list of checks                 flu/a_<id>   one check, with a results summary
     flu/setup      extra time per student: xt { "<period>|<short name>": 1.5 }
     data/i_fb<id>_<period>  a Speed check's scores as a Class Data set (source "Fact Blitz"), so the Gradebook
                    offers it under Add scores and Student Progress shows it beside the other scores
     profiles/<period>       each run added to that student's profile (kid.fl, kid.xp), once per run
   Shared with students (flu/{code}, see firestore.rules): the title, the fact set, the clock and the name list.
     flu/{code}/s/<guest>    this page sends each student who joins their own clock and tries. Extra time is never
                    in the shared document, so the class never sees who has it.
   ?demo: made-up students in this tab only, nothing is saved.
========================================== */
import * as F from "./factCore.js?v=1";
import * as PC from "./profileCore.js?v=2";
import { shortNames } from "./vaultCore.js?v=75";
import { lineChart, sparkline } from "./charts.js?v=1";
import qrcode from "./vendor/qrcode.js?v=1";

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };
const remember = (k, v) => { try { if (v === undefined) return localStorage.getItem("anchorboard-flu-" + k); localStorage.setItem("anchorboard-flu-" + k, v); } catch (e) { return null; } return null; };
const uidOf = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ago = (ms) => { if (!ms) return "–"; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" }); };
const fmtDay = (d) => { const t = new Date(d + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); };
const joinUrl = (code) => location.origin + "/fact.html?c=" + code;
const one = (x) => (Math.round((+x || 0) * 10) / 10).toString();

export async function mountFluency() {
    const demo = new URLSearchParams(location.search).has("demo");
    const store = await import(demo ? "./localStore.js?v=57" : "./boardStore.js?v=58");
    const rooms = demo ? demoRooms() : store.rooms;
    const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
    // Sign-in and the class list (data/weeks.js) load side by side, not one after the other (Nov 22: the page was slow to open).
    const [user, PER] = await Promise.all([store.ready(), demo ? [["1st", "8th"], ["2nd", "8th"], ["5th", "7th"], ["6th", "8th-acc"]] : import("../data/weeks.js?v=61").then((m) => m.PERIODS)]);
    if (!user) { location.replace("login.html"); return; }
    $("who").textContent = demo ? "Sample students, nothing is saved" : "Signed in as " + user.name;

    const S = { view: remember("view") || "checks", id: "", draft: null, per: remember("per") || "", set: remember("set") || "", err: "", kid: "" };
    const D = { rosters: null, index: null, defs: new Map(), entries: new Map(), sent: new Map(), setup: null, profiles: new Map(), synced: new Map() };
    let drawT = 0; const soon = () => { clearTimeout(drawT); drawT = setTimeout(draw, 60); };

    if (demo) await seedDemo(store, rooms);
    store.watch("rosters/all", (s) => { if (s.pending) return; D.rosters = (s.exists && s.data && s.data.periods) || {}; soon(); }, () => { D.rosters = {}; soon(); });
    store.watch("flu/index", (s) => { if (s.pending) return; D.index = ((s.exists && s.data && s.data.list) || []).filter((x) => x && x.id); status(demo ? "Sample data" : "Live", "ok"); soon(); }, (e) => status("Could not load (" + ((e && e.code) || "error") + ")", "bad"));
    D.setup = { xt: {} };   // until flu/setup arrives: nobody has extra time yet, and pushClocks waits for the real one
    let setupIn = false;
    store.watch("flu/setup", (s) => { if (s.pending) return; setupIn = true; D.setup = (s.exists && s.data) || { xt: {} }; D.setup.xt = D.setup.xt || {}; pushClocksAll(); soon(); }, () => { setupIn = true; });

    const rosterOf = (p) => shortNames(((D.rosters || {})[p] || []).filter(Boolean));
    const periodsWithRoster = () => PER.map((p) => p[0]).filter((p) => rosterOf(p).length);
    const xtOf = (per, nm) => { const x = +((D.setup && D.setup.xt) || {})[per + "|" + nm] || 1; return F.EXTRA.includes(x) ? x : 1; };

    /* ---------- one check: its private copy, and its students' entries while it is open ---------- */
    function def(id) {
        if (!D.defs.has(id)) { D.defs.set(id, null); store.watch("flu/a_" + id, (s) => { if (s.pending) return; if (s.exists) { D.defs.set(id, s.data); watchEntries(s.data); } soon(); }, () => {}); }
        return D.defs.get(id);
    }
    const unsubs = new Map();
    function watchEntries(d) {
        if (!d || !d.code || d.removed || unsubs.has(d.id)) return;
        const u1 = rooms.watchAll("flu/" + d.code + "/p", (list) => { D.entries.set(d.id, list); pushClocks(d); syncSoon(d.id); soon(); }, () => {});
        const u2 = rooms.watchAll("flu/" + d.code + "/s", (list) => { const m = new Map(); list.forEach((x) => m.set(x.id, x.data)); D.sent.set(d.id, m); pushClocks(d); }, () => {});
        unsubs.set(d.id, () => { u1(); u2(); });
    }
    // open checks keep their entries live from any view, so students joining always get their clock
    let watchedIndex = "";
    function watchOpen() {
        const sig = (D.index || []).filter((x) => x.status === "open").map((x) => x.id).join(",");
        if (sig === watchedIndex) return; watchedIndex = sig;
        (D.index || []).filter((x) => x.status === "open").forEach((x) => def(x.id));
    }

    /** Send each student who joined their own clock (extra time) and tries. Only what changed is written. */
    async function pushClocks(d) {
        if (!d || d.status !== "open" || !setupIn) return;   // never send a clock before the extra-time list is in
        const ents = D.entries.get(d.id) || [], sent = D.sent.get(d.id) || new Map(), writes = [];
        ents.forEach(({ id, data }) => {
            if (!data || !data.nm) return;
            const want = { x: xtOf(data.per, data.nm), rt: Math.max(1, +d.tries || 1) + (+((d.more || {})[data.per + "|" + data.nm]) || 0) };
            const have = sent.get(id);
            if (!have || have.x !== want.x || have.rt !== want.rt) { writes.push({ path: "flu/" + d.code + "/s/" + id, data: want }); sent.set(id, want); }
        });
        D.sent.set(d.id, sent);
        if (writes.length) { try { await rooms.many(writes); } catch (e) { writes.forEach((w) => sent.delete(w.path.split("/").pop())); } }
    }
    function pushClocksAll() { (D.index || []).filter((x) => x.status === "open").forEach((x) => { const d = D.defs.get(x.id); if (d) pushClocks(d); }); }

    /** Every student on the check's lists, with their runs scored. */
    function rowsOf(d) {
        const ents = D.entries.get(d.id) || [], out = [];
        (d.periods || []).forEach((per) => {
            const names = (d.names || {})[per] || [];
            const mine = ents.filter((e) => e.data && e.data.per === per);
            names.forEach((nm, ni) => {
                const es = mine.filter((e) => e.data.ni === ni || (e.data.ni < 0 && PC.normName(e.data.nm) === PC.normName(nm)));
                const runs = es.flatMap((e) => (e.data.runs || []).map((r) => Object.assign({ who: e.id }, r))).sort((a, b) => (a.t0 || 0) - (b.t0 || 0));
                out.push(rowFor(d, per, ni, nm, runs, es.length > 0));
            });
        });
        return out;
    }
    function rowFor(d, per, ni, nm, runs, joined) {
        const now = Date.now(), counted = d.mode === "check" ? F.countedRun(runs, d.counts, d.goal) : null;
        const live = runs.find((r) => !r.end && (r.t0 || 0) + (r.s || 0) * 1000 + 5000 > now);
        // a check still being played has no score or grade yet (the live count shows as "12…")
        const sc = counted && !(live && live.id === counted.id) ? F.scoreRun(counted) : null;
        const prac = runs.filter((r) => r.md === "p" && (r.end || (r.t0 || 0) + (r.s || 0) * 1000 < now));
        const bestP = prac.map((r) => F.scoreRun(r)).sort((a, b) => b.r - a.r)[0] || null;
        const state = live ? "playing" : counted ? (counted.end ? "done" : "left") : prac.length ? "practiced" : joined ? "joined" : "none";
        return { per, ni, nm, key: per + "|" + nm, runs, counted, sc, g: sc ? F.gradeOf(sc, d.goal, counted.b) : null, state, live, prac: prac.length, bestP, xt: xtOf(per, nm),
            more: +((d.more || {})[per + "|" + nm]) || 0 };
    }

    /* ---------- saving: Class Data (so the Gradebook and Student Progress have it) and profiles ---------- */
    const syncT = new Map();
    function syncSoon(id, now) { clearTimeout(syncT.get(id)); syncT.set(id, setTimeout(() => syncNow(id), now ? 200 : 5000)); }
    async function syncNow(id) {
        const d = D.defs.get(id); if (!d || d.removed) return;
        const rows = rowsOf(d), now = Date.now();
        const finished = (r) => r.end || (r.t0 || 0) + (r.s || 0) * 1000 + 5000 < now;
        const sig = JSON.stringify(rows.map((r) => [r.key, r.runs.filter(finished).map((x) => x.id + ":" + (x.lg || []).length)]));
        if (D.synced.get(id + "|sig") === sig) return;
        try {
            const day = new Date(d.opened || d.at || now), dayS = day.getFullYear() + "-" + ("0" + (day.getMonth() + 1)).slice(-2) + "-" + ("0" + day.getDate()).slice(-2);
            // 1. Class Data, one set per period (Speed checks only)
            if (d.mode === "check") {
                const ix = await getDoc("data/index"); let imports = (ix && ix.imports) || [];
                for (const per of d.periods || []) {
                    const rs = rows.filter((r) => r.per === per && r.sc && r.counted && finished(r.counted));
                    if (!rs.length) continue;
                    const imp = { id: "fb" + d.id + "_" + PC.perKey(per), title: "Fact Blitz: " + d.title, std: "", skill: F.setName(d.set) + " facts", date: dayS, source: "Fact Blitz", period: per,
                        items: ["Score (of goal)", "Accuracy"],
                        rows: rs.map((r) => ({ s: r.nm, v: [Math.round(r.g * 1e4) / 1e4, Math.round(r.sc.acc * 1e4) / 1e4], pm: one(r.sc.pm), right: r.sc.r })), at: now };
                    await store.save("data/i_" + imp.id, imp);
                    imports = imports.filter((x) => x && x.id !== imp.id).concat([{ id: imp.id, title: imp.title, std: "", skill: imp.skill, date: dayS, source: "Fact Blitz", period: per, n: imp.rows.length, items: 2 }]);
                }
                await store.save("data/index", { imports, at: now });
            }
            // 2. Profiles: every finished run, once each (factCore.addRun skips a run it already has)
            for (const per of d.periods || []) {
                const rs = rows.filter((r) => r.per === per && r.runs.some(finished)); if (!rs.length) continue;
                await rooms.tx("teacher/" + rooms.uid() + "/profiles/" + PC.perKey(per), (cur) => {
                    const kids = Object.assign({}, (cur && cur.kids) || {}); let changed = false;
                    rs.forEach((r) => {
                        const k = PC.kidKey(r.nm); if (!k) return;
                        const kid = PC.cleanKid(kids[k], r.nm);
                        r.runs.filter(finished).forEach((run) => {
                            const got = F.addRun(kid.fl, d.set, Object.assign({}, run, { id: d.id + "." + run.id }), dayS);
                            if (got.added) { kid.fl = got.fl; kid.xp += got.xp; changed = true; }
                        });
                        kids[k] = kid;
                    });
                    return changed ? { v: 1, per: String(per).slice(0, 20), kids, at: Date.now() } : null;
                });
            }
            // 3. a small summary on the check itself, for the list
            const done = rows.filter((r) => r.sc);
            d.res = { n: rows.length, played: rows.filter((r) => r.runs.length).length, done: done.length, avgR: done.length ? done.reduce((s, r) => s + r.sc.r, 0) / done.length : null, at: now };
            await store.save("flu/a_" + d.id, JSON.parse(JSON.stringify(d)));
            D.synced.set(id, now); D.synced.set(id + "|sig", sig); soon();
        } catch (e) { S.err = "Couldn't save the results yet (" + ((e && e.code) || "connection") + "). They're safe in the check; it tries again on the next change."; soon(); }
    }
    const getDoc = (p) => new Promise((res) => { let done = false, un = null; un = store.watch(p, (s) => { if (done || s.pending) return; done = true; res(s.exists ? s.data : null); if (un) setTimeout(un, 0); }, () => { if (!done) { done = true; res(null); } }); });
    // a run still going has no end yet: look again once its clock is over
    setInterval(() => { (D.index || []).filter((x) => x.status === "open").forEach((x) => { if (D.defs.get(x.id)) syncSoon(x.id); }); if (S.view === "checks" && S.id) soon(); }, 15000);

    /* ---------- drawing ---------- */
    function draw() {
        if (D.index) watchOpen();
        document.querySelectorAll("#views button").forEach((b) => { b.setAttribute("aria-selected", b.dataset.v === S.view ? "true" : "false"); b.setAttribute("aria-pressed", b.dataset.v === S.view ? "true" : "false"); });
        const out = $("out"); out.textContent = "";
        // The list of checks draws as soon as it arrives; only the parts that need the class lists wait for them.
        if (!D.index || ((S.view !== "checks" || S.draft) && !D.rosters) || (S.view === "extra" && !setupIn)) { out.append(skel()); return; }
        if (S.err) { const e = el("p", "asErr", S.err); e.setAttribute("role", "alert"); out.append(e); }
        if (S.view === "progress") return drawProgress(out);
        if (S.view === "extra") return drawExtra(out);
        if (S.draft) return drawNew(out);
        if (S.id) { const d = def(S.id); if (!d) { out.append(skel()); return; } return drawCheck(out, d); }
        drawList(out);
    }
    const skel = () => { const s = el("div", "pgSkel"); s.setAttribute("aria-hidden", "true"); s.append(el("i"), el("i"), el("i")); return s; };
    $("views").addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b) return; S.view = b.dataset.v; remember("view", S.view); S.err = ""; draw(); });

    function drawList(out) {
        const bar = el("div", "asBar");
        bar.append(el("p", "asNote", "Students play at " + location.host + "/fact with the code. Each run is timed and stops on its own."), btn("btn go", "New speed check", () => newDraft("check")));
        out.append(bar);
        const list = (D.index || []).slice().sort((a, b) => (b.status === "open") - (a.status === "open") || (b.at || 0) - (a.at || 0));
        if (!list.length) {
            const e = el("div", "pgEmpty"); e.append(el("h2", null, "No speed checks yet"), el("p", null, "Open a timed check of multiplication, division or integer facts. Students join on their Chromebooks with a code, the same way as Vault Raid. A check's scores go to the Gradebook (Add scores) and Student Progress; every run goes on the student's profile."));
            const r = el("div", "asActs"); r.append(btn("btn go", "Open a speed check", () => newDraft("check")), btn("btn ghost", "Open a practice", () => newDraft("practice"))); e.append(r); out.append(e); return;
        }
        const g = el("div", "asList");
        list.forEach((x) => {
            const c = el("button", "asCard"); c.type = "button"; c.onclick = () => { S.id = x.id; S.err = ""; draw(); window.scrollTo(0, 0); };
            const top = el("div", "asCardTop"); top.append(el("span", "asChip " + (x.mode === "check" ? "t-quiz" : "t-practice"), x.mode === "check" ? "Speed check" : "Practice"), el("span", "asChip" + (x.status === "open" ? " s-open" : ""), x.status === "open" ? "Open" : "Closed"));
            if (x.status === "open" && x.code) top.append(el("span", "asCode", x.code));
            const d = D.defs.get(x.id), res = d && d.res;
            c.append(top, el("h3", null, x.title), el("p", "asFacts", F.setName(x.set) + " · up to " + (x.top || 12) + " · " + F.fmtSecs(x.secs) + " · " + (x.periods || []).join(", ")),
                el("p", "asSum", res ? res.done + " of " + res.n + " " + (x.mode === "check" ? "checked" : "played") + (res.avgR != null ? " · " + one(res.avgR) + " right on average" : "") : fmtDay(new Date(x.at).toISOString().slice(0, 10))));
            g.append(c);
        });
        out.append(g);
        list.forEach((x) => def(x.id));
    }

    /* ---------- a new check ---------- */
    function newDraft(mode) {
        const last = (D.index || [])[0] || {};
        const pers = periodsWithRoster();
        S.draft = { mode, set: last.set || "mul", top: last.top || 12, secs: mode === "check" ? (last.mode === "check" && last.secs) || 120 : 60, goal: (last.goal || F.DEFAULTS.goal), tries: 1, counts: "first", periods: pers.slice(), title: "" };
        S.id = ""; S.err = ""; draw(); window.scrollTo(0, 0);
    }
    function autoTitle(dr) { const d = new Date(); return F.setName(dr.set) + (dr.mode === "check" ? " speed check, " : " practice, ") + d.toLocaleDateString([], { month: "short", day: "numeric" }); }
    function drawNew(out) {
        const dr = S.draft, w = el("div", "asBuild");
        w.append(el("h2", "fbH", dr.mode === "check" ? "New speed check" : "New practice"));
        // kind
        const s1 = el("section", "asSec"); s1.append(el("h2", null, "What kind"));
        const kinds = el("div", "asKinds");
        [["check", "Speed check", "Graded. One try (you can give another). Scores go to the Gradebook and Student Progress."], ["practice", "Practice", "Not graded. As many runs as they want; facts they miss come back more. Runs still go on profiles."]].forEach(([k, n, t]) => {
            const b = btn("asKind" + (dr.mode === k ? " on" : ""), null, () => { dr.mode = k; if (k === "practice" && dr.secs === 120) dr.secs = 60; if (k === "check" && dr.secs === 60) dr.secs = 120; draw(); }); b.setAttribute("aria-pressed", dr.mode === k ? "true" : "false");
            b.append(el("b", null, n), el("small", null, t)); kinds.append(b);
        });
        s1.append(kinds); w.append(s1);
        // facts
        const s2 = el("section", "asSec"); s2.append(el("h2", null, "Facts and clock"));
        const grid = el("div", "asOpts");
        const fSet = field("Facts", sel(F.SETS.map((x) => [x[0], x[1]]), dr.set, (v) => { dr.set = v; }));
        const fTop = field("Up to", sel([[12, "12 × 12"], [10, "10 × 10"]], dr.top, (v) => { dr.top = +v; }));
        const fSecs = field("Time on the clock", sel(F.TIMES.map((t) => [t, (t / 60) + (t === 60 ? " minute" : " minutes")]), dr.secs, (v) => { dr.secs = +v; draw(); }));
        grid.append(fSet, fTop, fSecs);
        if (dr.mode === "check") {
            const gi = el("input"); gi.type = "number"; gi.min = "5"; gi.max = "60"; gi.value = dr.goal; gi.oninput = () => { dr.goal = Math.max(5, Math.min(60, +gi.value || F.DEFAULTS.goal)); hint.textContent = goalHint(dr); };
            const fg = field("Goal: facts right per minute", gi), hint = el("small", "asNote", goalHint(dr)); fg.append(hint); grid.append(fg);
            grid.append(field("Tries", sel([[1, "1 try"], [2, "2 tries"], [3, "3 tries"]], dr.tries, (v) => { dr.tries = +v; draw(); })));
            if (dr.tries > 1) grid.append(field("Which try counts", sel([["first", "The first try"], ["best", "The best try"]], dr.counts, (v) => { dr.counts = v; })));
        }
        s2.append(grid, el("p", "asNote", "Students with extra time (the Extra time tab) get their own longer clock, sent only to their Chromebook. The run still stops on its own when their time is up."));
        w.append(s2);
        // who
        const s3 = el("section", "asSec"); s3.append(el("h2", null, "Which classes"));
        const pers = el("div", "asPers"), all = periodsWithRoster();
        if (!all.length) s3.append(el("p", "asNote", "Add your class lists on the Rosters page first: students pick their name from them."));
        all.forEach((p) => { const l = el("label", "asPer"), c = el("input"); c.type = "checkbox"; c.checked = dr.periods.includes(p); c.onchange = () => { dr.periods = c.checked ? dr.periods.concat([p]) : dr.periods.filter((x) => x !== p); }; l.append(c, document.createTextNode(p + " period (" + rosterOf(p).length + ")")); pers.append(l); });
        s3.append(pers);
        const ti = el("input"); ti.placeholder = autoTitle(dr); ti.value = dr.title; ti.maxLength = 80; ti.oninput = () => { dr.title = ti.value; };
        s3.append(field("Name (optional)", ti)); w.append(s3);
        const foot = el("div", "asFoot"), fb = el("div", "asFootBtns");
        fb.append(btn("btn ghost", "Cancel", () => { S.draft = null; draw(); }), btn("btn go", dr.mode === "check" ? "Open the speed check" : "Open the practice", () => openCheck(dr)));
        foot.append(el("p", "asEst", F.setName(dr.set) + " · " + F.fmtSecs(dr.secs)), fb); w.append(foot);
        out.append(w);
    }
    const goalHint = (dr) => "100% = " + Math.round(dr.goal * dr.secs / 60) + " right in " + F.fmtSecs(dr.secs) + ". Scores under the goal are a share of it (half the goal is 50%).";
    function field(label, input) { const l = el("label", "asField"); l.append(el("span", null, label), input); return l; }
    function sel(opts, val, fn) { const s = el("select"); opts.forEach(([v, t]) => { const o = el("option", null, t); o.value = String(v); if (String(v) === String(val)) o.selected = true; s.append(o); }); s.onchange = () => fn(s.value); return s; }

    async function newCode() {
        for (let i = 0; i < 12; i++) {
            const c = String(100000 + Math.floor(Math.random() * 900000));
            try { const x = await rooms.get("flu/" + c); if (!x) return c; } catch (e) { return c; }
        }
        return String(100000 + Math.floor(Math.random() * 900000));
    }
    async function openCheck(dr) {
        if (!dr.periods.length) { S.err = "Pick at least one class."; draw(); return; }
        S.err = "";
        try {
            const id = uidOf(), code = await newCode(), now = Date.now(), title = (dr.title || autoTitle(dr)).trim().slice(0, 80);
            const names = {}; dr.periods.forEach((p) => { names[p] = rosterOf(p); });
            const d = { id, code, title, mode: dr.mode, set: dr.set, top: dr.top, secs: dr.secs, goal: dr.goal, tries: dr.tries, counts: dr.counts, periods: dr.periods.slice(), names, status: "open", at: now, opened: now, more: {} };
            await rooms.save("flu/" + code, { owner: rooms.uid(), kind: "flu", title, mode: d.mode, set: d.set, top: d.top, secs: d.secs, goal: d.goal, tries: d.tries, counts: d.counts, names, status: "open", at: now });
            await store.save("flu/a_" + id, d);
            D.index = [{ id, title, mode: d.mode, set: d.set, top: d.top, secs: d.secs, goal: d.goal, code, status: "open", periods: d.periods, at: now }].concat(D.index || []);
            await store.save("flu/index", { list: D.index, at: now });
            D.defs.set(id, d); watchEntries(d);
            if (d.mode === "check" && D.setup && D.setup.goal !== d.goal) { D.setup = Object.assign({}, D.setup, { goal: d.goal }); store.save("flu/setup", { xt: D.setup.xt || {}, goal: d.goal, at: now }).catch(() => {}); }
            S.draft = null; S.id = id; draw(); window.scrollTo(0, 0);
        } catch (e) { S.err = "Couldn't open it (" + ((e && e.code) || "connection") + ")."; draw(); }
    }

    /* ---------- one check: live ---------- */
    function drawCheck(out, d) {
        const rows = rowsOf(d), check = d.mode === "check";
        const top = el("div", "asResTop");
        const back = btn("btn ghost", "← All checks", () => { S.id = ""; S.err = ""; draw(); });
        const t = el("div", "asResT"), chips = el("div", "asChips");
        chips.append(el("span", "asChip " + (check ? "t-quiz" : "t-practice"), check ? "Speed check" : "Practice"), el("span", "asChip" + (d.status === "open" ? " s-open" : ""), d.status === "open" ? "Open" : "Closed"));
        t.append(chips, el("h2", null, d.title), el("p", "asFacts", F.setName(d.set) + " · up to " + d.top + " · " + F.fmtSecs(d.secs) + " on the clock" + (check ? " · goal " + d.goal + " a minute · " + d.tries + (d.tries > 1 ? " tries, " + (d.counts === "best" ? "best" : "first") + " counts" : " try") : "")));
        top.append(back, t);
        if (d.status === "open") {
            const j = el("div", "asJoin"); j.append(el("small", null, "Students go to"), el("b", "asUrl", location.host + "/fact"), el("span", "asBigCode", d.code));
            const jb = el("div", "asJoinBtns"); jb.append(btn("btn ghost sm", "Show big", () => bigCode(d)), btn("btn ghost sm", "Copy link", (e) => { try { navigator.clipboard.writeText(joinUrl(d.code)); e.target.textContent = "Copied"; } catch (x) { /* ok */ } })); j.append(jb); top.append(j);
        }
        out.append(top);
        const acts = el("div", "asActs");
        if (d.status === "open") acts.append(btn("btn ghost", "Close it", () => setStatus(d, "closed")));
        else acts.append(btn("btn ghost", "Open it again", () => setStatus(d, "open")));
        acts.append(btn("btn ghost", "Save results now", () => { D.synced.delete(d.id + "|sig"); syncSoon(d.id, true); }), btn("btn ghost asDanger", "Delete", () => remove(d)));
        out.append(acts);
        const syncLine = el("p", "asNote asSync", D.synced.get(d.id) ? (check ? "Scores saved to Class Data (for the Gradebook and Student Progress) and to profiles " : "Runs saved to profiles ") + ago(D.synced.get(d.id)) + "." : check ? "Scores go to Class Data (Gradebook > Add scores) and profiles as students finish." : "Runs go to profiles as students finish.");
        out.append(syncLine);

        // period tabs
        const pers = d.periods || []; if (!pers.includes(S.per)) S.per = pers[0] || "";
        if (pers.length > 1) { const tb = el("div", "tabs asPerTabs"); tb.setAttribute("role", "group"); tb.setAttribute("aria-label", "Period"); pers.forEach((p) => { const b = btn("", p + " period", () => { S.per = p; remember("per", p); draw(); }); b.setAttribute("aria-pressed", p === S.per ? "true" : "false"); tb.append(b); }); out.append(tb); }
        const mine = rows.filter((r) => r.per === S.per);

        // the strip: how the class is doing
        const doneR = mine.filter((r) => r.sc), strip = el("div", "asStrip");
        const card = (big, txt, small, band) => { const c = el("div", "asStripC"); if (band) c.dataset.band = band; c.append(el("b", null, big), el("span", null, txt)); if (small) c.append(el("small", null, small)); return c; };
        strip.append(card(String(mine.filter((r) => r.state === "playing").length), "playing now"), card(doneR.length + " / " + mine.length, check ? "checks done" : "have a run"));
        if (check && doneR.length) {
            const avg = doneR.reduce((s, r) => s + r.sc.r, 0) / doneR.length, atGoal = doneR.filter((r) => r.g >= 1).length;
            strip.append(card(one(avg), "right on average", one(avg / (d.secs / 60)) + " a minute"), card(String(atGoal), "at the goal", "of " + doneR.length, atGoal ? "ok" : ""), card(F.pct(doneR.reduce((s, r) => s + r.sc.acc, 0) / doneR.length), "accurate on average"));
        }
        out.append(strip);

        // the table
        const wrap = el("div", "asTblWrap"), tbl = el("table", "asTbl"), thead = el("thead"), hr = el("tr");
        (check ? ["Student", "Status", "Right", "Accurate", "Per minute", "Grade", "Practice", "Clock", ""] : ["Student", "Status", "Runs", "Best run", "Accurate", "Per minute", "Clock"]).forEach((h) => hr.append(el("th", null, h)));
        thead.append(hr); tbl.append(thead);
        const tb = el("tbody");
        mine.forEach((r) => {
            const tr = el("tr", "asRow" + (r.state === "none" ? " none" : ""));
            const nmC = el("td", "asNm"); nmC.append(el("b", null, r.nm)); tr.append(nmC);
            const word = { playing: "Playing…", done: "Done", left: "Left early", practiced: check ? "Practice only" : "Played", joined: "Joined", none: "Not started" }[r.state];
            const st = el("td", "fbSt", word); st.dataset.s = r.state; tr.append(st);
            const timeCell = el("td", null, F.fmtSecs(Math.round(d.secs * r.xt)) + (r.xt > 1 ? " (" + r.xt + "×)" : ""));
            if (check) {
                const sc = r.sc;
                tr.append(el("td", "asG", sc ? String(sc.r) : r.live ? String(F.scoreRun(r.live).r) + "…" : "–"), el("td", null, sc ? F.pct(sc.acc) : "–"), el("td", null, sc ? one(sc.pm) : "–"));
                const gC = el("td", "asG", r.g != null ? F.pct(r.g) : "–"); if (sc && !sc.ok) { gC.append(el("small", "asWarn", " check")); gC.title = "This run's times don't add up (answers faster than anyone types, or more time than the clock). Look before you count it."; } tr.append(gC);
                tr.append(el("td", null, r.prac ? r.prac + (r.bestP ? " (best " + r.bestP.r + ")" : "") : "–"), timeCell);
                const a = el("td");
                if (r.counted && !r.live && d.status === "open") a.append(btn("btn ghost sm", "Another try", () => anotherTry(d, r)));
                tr.append(a);
            } else {
                const scs = r.runs.filter((x) => x.end).map((x) => F.scoreRun(x)), best = scs.sort((a, b) => b.r - a.r)[0];
                tr.append(el("td", null, String(r.runs.length)), el("td", "asG", best ? String(best.r) : r.live ? F.scoreRun(r.live).r + "…" : "–"), el("td", null, best ? F.pct(best.acc) : "–"), el("td", null, best ? one(best.pm) : "–"), timeCell);
            }
            tb.append(tr);
        });
        tbl.append(tb); wrap.append(tbl); out.append(wrap);
        if (!mine.length) out.append(el("p", "asNote", "No roster for " + S.per + " period."));

        // facts the class missed most
        const missed = new Map();
        mine.forEach((r) => r.runs.forEach((run) => F.parseLog(run.lg).filter((x) => !x.ok).forEach((x) => missed.set(x.f, (missed.get(x.f) || 0) + 1))));
        if (missed.size) {
            const s = el("section", "asSec fbMissed"); s.append(el("h2", null, "Facts missed most"));
            const ul = el("ul", "fbMiss"); [...missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([f, n]) => { const li = el("li"); li.append(el("b", null, F.showFact(f) + " = " + String(F.answerOf(f)).replace("-", "−")), el("small", null, n + (n === 1 ? " miss" : " misses"))); ul.append(li); });
            s.append(ul); out.append(s);
        }
    }
    async function setStatus(d, st) {
        try {
            await rooms.save("flu/" + d.code, { status: st }, true);
            d.status = st; await store.save("flu/a_" + d.id, JSON.parse(JSON.stringify(d)));
            D.index = (D.index || []).map((x) => (x.id === d.id ? Object.assign({}, x, { status: st }) : x)); await store.save("flu/index", { list: D.index, at: Date.now() });
            if (st === "closed") syncSoon(d.id, true); else watchEntries(d);
            draw();
        } catch (e) { S.err = "Couldn't change it (" + ((e && e.code) || "connection") + ")."; draw(); }
    }
    async function anotherTry(d, r) {
        if (!confirm("Give " + r.nm + " another try? " + (d.counts === "best" ? "Their best try counts." : "Their first try still counts unless you change Which try counts. To count only the new try, delete the old score in the Gradebook and type the new one."))) return;
        d.more = Object.assign({}, d.more || {}); d.more[r.key] = (+d.more[r.key] || 0) + 1;
        try { await store.save("flu/a_" + d.id, JSON.parse(JSON.stringify(d))); pushClocks(d); draw(); } catch (e) { S.err = "Couldn't save that (" + ((e && e.code) || "connection") + ")."; draw(); }
    }
    async function remove(d) {
        if (!confirm("Delete \"" + d.title + "\"? Students lose access and their runs here are deleted. Scores already saved to Class Data, the Gradebook and profiles stay there.")) return;
        try {
            if (d.code) { try { await rooms.clear("flu/" + d.code + "/p"); await rooms.clear("flu/" + d.code + "/s"); await rooms.del("flu/" + d.code); } catch (e) { /* already gone */ } }
            if (unsubs.has(d.id)) { unsubs.get(d.id)(); unsubs.delete(d.id); }
            D.index = (D.index || []).filter((x) => x.id !== d.id); await store.save("flu/index", { list: D.index, at: Date.now() });
            await store.save("flu/a_" + d.id, { id: d.id, removed: true, at: Date.now() }); D.defs.delete(d.id);
            S.id = ""; draw();
        } catch (e) { S.err = "Couldn't delete (" + ((e && e.code) || "connection") + ")."; draw(); }
    }
    function bigCode(d) {
        const dlg = $("dlg"); dlg.textContent = ""; dlg.className = "asPrev big";
        const q = qrcode(0, "M"); q.addData(joinUrl(d.code)); q.make();
        const n = q.getModuleCount(), NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 " + (n + 4) + " " + (n + 4)); svg.setAttribute("class", "asQr"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "QR code for Fact Blitz " + d.code);
        let p = ""; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += "M" + (c + 2) + " " + (r + 2) + "h1v1h-1z";
        const bg = document.createElementNS(NS, "rect"); bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#fff"); const path = document.createElementNS(NS, "path"); path.setAttribute("d", p); path.setAttribute("fill", "#081B45"); svg.append(bg, path);
        dlg.append(el("p", "asBigT", "Fact Blitz: " + d.title), el("p", "asBigU", location.host + "/fact"), el("p", "asBigC", d.code), svg, btn("btn", "Close", () => dlg.close()));
        dlg.showModal();
    }

    /* ---------- progress over time (from profiles) ---------- */
    function profilesOf(per) {
        if (!D.profiles.has(per)) { D.profiles.set(per, null); store.watch("profiles/" + PC.perKey(per), (s) => { if (s.pending) return; D.profiles.set(per, (s.exists && s.data && s.data.kids) || {}); soon(); }, () => D.profiles.set(per, {})); }
        return D.profiles.get(per);
    }
    function perTabs(out, list) {
        if (!list.includes(S.per)) S.per = list[0] || "";
        const tb = el("div", "tabs asPerTabs"); tb.setAttribute("role", "group"); tb.setAttribute("aria-label", "Period");
        list.forEach((p) => { const b = btn("", p + " period", () => { S.per = p; remember("per", p); draw(); }); b.setAttribute("aria-pressed", p === S.per ? "true" : "false"); tb.append(b); });
        out.append(tb);
    }
    function drawProgress(out) {
        const list = periodsWithRoster();
        if (!list.length) { const e = el("div", "pgEmpty"); e.append(el("h2", null, "No class lists yet"), el("p", null, "Progress is kept per student from your Rosters page."), btn("btn go", "Open Rosters", () => { location.href = "rosters.html"; })); out.append(e); return; }
        perTabs(out, list);
        const kids = profilesOf(S.per); if (!kids) { out.append(skel()); return; }
        const names = rosterOf(S.per);
        const have = new Set(); names.forEach((nm) => { const k = kids[PC.kidKey(nm)]; Object.keys((k && k.fl) || {}).forEach((s) => have.add(s)); });
        const sets = F.SETS.map((x) => x[0]).filter((s) => have.has(s));
        if (!sets.length) { const e = el("div", "pgEmpty"); e.append(el("h2", null, "No Fact Blitz runs for " + S.per + " period yet"), el("p", null, "Open a speed check (a baseline) and each student's runs show here over time: right answers per minute, the first check, the latest and the change."), btn("btn go", "New speed check", () => { S.view = "checks"; remember("view", "checks"); newDraft("check"); })); out.append(e); return; }
        if (!sets.includes(S.set)) S.set = sets[0];
        const row = el("div", "asActs"); row.append(field("Facts", sel(sets.map((s) => [s, F.setName(s)]), S.set, (v) => { S.set = v; remember("set", v); draw(); })));
        out.append(row);
        const data = names.map((nm) => { const k = kids[PC.kidKey(nm)], rec = k && k.fl && k.fl[S.set]; return { nm, rec, tr: F.flTrend(rec) }; });
        const withTr = data.filter((x) => x.tr);
        if (withTr.length) {
            const up = withTr.filter((x) => x.tr.change > 0).length, avgF = withTr.reduce((s, x) => s + x.tr.first.pm, 0) / withTr.length, avgL = withTr.reduce((s, x) => s + x.tr.last.pm, 0) / withTr.length;
            const strip = el("div", "asStrip");
            const card = (big, txt, small) => { const c = el("div", "asStripC"); c.append(el("b", null, big), el("span", null, txt)); if (small) c.append(el("small", null, small)); return c; };
            strip.append(card(one(avgF), "a minute at the first check", "class average"), card(one(avgL), "a minute at the latest check", "class average"), card(up + " / " + withTr.length, "students faster than their first check"));
            out.append(strip);
        }
        out.append(el("p", "asNote", "Right answers per minute. First and latest are Speed checks (practice runs count when there's no check yet); best is any run. Tap a student for every run."));
        const wrap = el("div", "asTblWrap"), tbl = el("table", "asTbl"), hr = el("tr");
        ["Student", "First check", "Latest", "Change", "Best", "Runs", "Trend"].forEach((h) => hr.append(el("th", null, h)));
        const th = el("thead"); th.append(hr); tbl.append(th);
        const tb = el("tbody");
        data.forEach(({ nm, rec, tr }) => {
            const r = el("tr", "asRow" + (tr ? "" : " none"));
            const nc = el("td", "asNm"); nc.append(el("b", null, nm)); r.append(nc);
            if (!tr) { r.append(el("td", null, "No runs yet")); [1, 2, 3, 4, 5].forEach(() => r.append(el("td", null, ""))); tb.append(r); return; }
            const ch = el("td", "asG", (tr.change > 0 ? "+" : "") + one(tr.change)); ch.dataset.d = tr.change > 0 ? "up" : tr.change < 0 ? "down" : "same"; ch.className = "asG fbCh";
            r.append(el("td", null, one(tr.first.pm)), el("td", null, one(tr.last.pm)), ch, el("td", null, one(tr.best)), el("td", null, String(tr.n)));
            const pts = F.flPoints(rec), mx = Math.max(10, ...pts.map((p) => p.pm)), sp = el("td"); sp.append(sparkline(pts.map((p) => p.pm / mx), nm + " per minute")); r.append(sp);
            r.tabIndex = 0; r.onclick = () => kidDialog(nm, kids[PC.kidKey(nm)]); r.onkeydown = (e) => { if (e.key === "Enter") kidDialog(nm, kids[PC.kidKey(nm)]); };
            tb.append(r);
        });
        tbl.append(tb); wrap.append(tbl); out.append(wrap);
    }
    function kidDialog(nm, kid) {
        const dlg = $("dlg"); dlg.textContent = ""; dlg.className = "asPrev fbKid";
        dlg.append(el("h2", "fbH", nm));
        Object.keys((kid && kid.fl) || {}).forEach((set) => {
            const rec = kid.fl[set], pts = F.flPoints(rec); if (!pts.length) return;
            const goal = +((D.setup && D.setup.goal) || F.DEFAULTS.goal), tr = F.flTrend(rec);
            const s = el("section", "fbKidSet"); s.append(el("h3", null, F.setName(set)), el("p", "asNote", "First check " + one(tr.first.pm) + " a minute, latest " + one(tr.last.pm) + " (" + (tr.change > 0 ? "+" : "") + one(tr.change) + "), best " + one(tr.best) + "."));
            s.append(el("p", "asNote", "The chart shows each run as a share of the goal (100% = " + goal + " right a minute)."));
            s.append(lineChart(pts.map((p) => ({ d: p.day, v: Math.min(1, p.pm / goal), label: one(p.pm) + " a minute · " + F.pct(p.acc) + " accurate · " + (p.check ? "check" : "practice") })), { h: 200, title: nm + " " + F.setName(set) + ", share of the " + goal + "-a-minute goal" }));
            const ul = el("ul", "fbRunList"); pts.slice().reverse().forEach((p) => ul.append(el("li", null, fmtDay(p.day) + ": " + one(p.pm) + " a minute, " + F.pct(p.acc) + " accurate" + (p.check ? " (check)" : " (practice)")))); s.append(ul);
            dlg.append(s);
        });
        dlg.append(btn("btn", "Close", () => dlg.close()));
        dlg.showModal();
    }

    /* ---------- extra time ---------- */
    function drawExtra(out) {
        const list = periodsWithRoster();
        if (!list.length) { const e = el("div", "pgEmpty"); e.append(el("h2", null, "No class lists yet"), el("p", null, "Extra time is set per student from your Rosters page."), btn("btn go", "Open Rosters", () => { location.href = "rosters.html"; })); out.append(e); return; }
        out.append(el("p", "asNote fbPriv", "Only you see this. A student with extra time gets their own longer clock on their Chromebook; nobody else sees who has it. Their run still stops on its own when their time is up, and their grade uses the same goal as everyone (extra time doesn't raise it)."));
        perTabs(out, list);
        const g = el("div", "fbXt");
        rosterOf(S.per).forEach((nm) => {
            const row = el("div", "fbXtRow" + (xtOf(S.per, nm) > 1 ? " on" : ""));
            row.append(el("b", null, nm));
            const s = sel(F.EXTRA.map((x) => [x, x === 1 ? "Standard time" : x + "× time"]), xtOf(S.per, nm), (v) => setXt(S.per, nm, +v)); s.setAttribute("aria-label", "Time for " + nm);
            row.append(s); g.append(row);
        });
        out.append(g);
    }
    async function setXt(per, nm, x) {
        const xt = Object.assign({}, (D.setup && D.setup.xt) || {}); if (x > 1) xt[per + "|" + nm] = x; else delete xt[per + "|" + nm];
        D.setup = Object.assign({}, D.setup, { xt });
        try { await store.save("flu/setup", { xt, goal: D.setup.goal || F.DEFAULTS.goal, at: Date.now() }); pushClocksAll(); draw(); } catch (e) { S.err = "Couldn't save extra time (" + ((e && e.code) || "connection") + ")."; draw(); }
    }

    draw();
}

/* ---------- ?demo: a shared-room store that lives in this tab ---------- */
function demoRooms() {
    const docs = new Map(), subs = new Set();
    const fire = () => subs.forEach((f) => setTimeout(f, 0));
    return {
        uid: () => "guest",
        get: async (p) => (docs.has(p) ? JSON.parse(JSON.stringify(docs.get(p))) : null),
        save: async (p, d, merge) => { docs.set(p, JSON.parse(JSON.stringify(merge && docs.has(p) ? Object.assign({}, docs.get(p), d) : d))); fire(); },
        many: async (list) => { list.forEach((w) => { if (w.del) docs.delete(w.path); else docs.set(w.path, JSON.parse(JSON.stringify(w.data))); }); fire(); },
        clear: async (p) => { [...docs.keys()].filter((k) => k.startsWith(p + "/")).forEach((k) => docs.delete(k)); fire(); },
        del: async (p) => { docs.delete(p); fire(); },
        tx: async (p, fn) => { const next = fn(docs.has(p) ? JSON.parse(JSON.stringify(docs.get(p))) : null); if (next) { docs.set(p, JSON.parse(JSON.stringify(next))); fire(); demoMirror(p, next); } return next; },
        watchAll(p, next) { const f = () => next([...docs.entries()].filter(([k]) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).map(([k, v]) => ({ id: k.slice(p.length + 1), data: v })), []); subs.add(f); setTimeout(f, 0); return () => subs.delete(f); },
        _set: (p, d) => docs.set(p, d),
    };
}
let demoMirror = () => {};
async function seedDemo(store, rooms) {
    const names = ["Ava Rivera", "Ben Shaw", "Cora Diaz", "Dev Patel", "Eli Moore", "Fay Kim", "Gus Long", "Hana Ito"];
    await store.save("rosters/all", { periods: { "1st": names, "2nd": names.slice(0, 5), "5th": names.slice(2), "6th": names.slice(1, 7) } });
    // profiles written by the demo transaction land in the tab store too, so Progress shows them
    demoMirror = (p, data) => { const m = /profiles\/(.+)$/.exec(p); if (m) store.save("profiles/" + m[1], data); };
    const short = shortNames(names), now = Date.now(), day = (n) => { const d = new Date(now - n * 864e5); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
    // earlier runs on profiles: a baseline three weeks ago, practice, and a check last week
    const kids = {};
    short.forEach((nm, i) => {
        let fl = {}; const base = 8 + i * 2;
        [[21, base, 1], [17, base + 2, 0], [14, base + 3, 0], [7, base + 5 + (i % 3), 1]].forEach(([ago, pm, chk], j) => {
            const secs = chk ? 120 : 60, r = Math.round(pm * secs / 60), lg = Array(r).fill("7x8:56:" + Math.floor(secs * 1000 / (r + 2))).concat(["6x7:41:3000"]);
            fl = F.addRun(fl, "mul", { id: "demo" + i + "." + j, md: chk ? "c" : "p", s: secs, b: secs, lg }, day(ago)).fl;
        });
        kids[PC.kidKey(nm)] = Object.assign(PC.cleanKid(null, nm), { fl, xp: 60 });
    });
    await store.save("profiles/1st", { v: 1, per: "1st", kids, at: now });
    rooms._set("teacher/guest/profiles/1st", { v: 1, per: "1st", kids, at: now });
    // one open check, half the class done
    const d = { id: "demo1", code: "424242", title: "Multiplication speed check, Nov 30", mode: "check", set: "mul", top: 12, secs: 120, goal: 25, tries: 1, counts: "first", periods: ["1st", "2nd"],
        names: { "1st": short, "2nd": short.slice(0, 5) }, status: "open", at: now - 600e3, opened: now - 600e3, more: {} };
    await store.save("flu/a_demo1", d);
    await store.save("flu/index", { list: [{ id: d.id, title: d.title, mode: d.mode, set: d.set, top: d.top, secs: d.secs, goal: d.goal, code: d.code, status: "open", periods: d.periods, at: d.at },
        { id: "demo0", title: "Multiplication speed check, Nov 9", mode: "check", set: "mul", top: 12, secs: 120, goal: 25, code: "", status: "closed", periods: ["1st"], at: now - 21 * 864e5 }], at: now });
    await store.save("flu/a_demo0", { id: "demo0", title: "Multiplication speed check, Nov 9", mode: "check", set: "mul", top: 12, secs: 120, goal: 25, periods: ["1st"], names: { "1st": short }, status: "closed", at: now - 21 * 864e5, res: { n: 8, played: 8, done: 8, avgR: 31.5 } });
    await store.save("flu/setup", { xt: { "1st|Dev P.": 1.5 }, at: now });
    const facts = F.deck("mul", 12, 42, 200);
    [[0, 52, 1], [1, 38, 2], [2, 27, 3], [3, 44, 0], [4, 19, 4]].forEach(([ni, right, wrong]) => {
        const secs = ni === 3 ? 180 : 120, lg = [];
        let k = 0; for (; k < right; k++) lg.push(F.logItem(facts[k], String(F.answerOf(facts[k])), Math.floor(secs * 1000 / (right + wrong + 1))));
        for (let w = 0; w < wrong; w++, k++) lg.push(F.logItem(facts[k], String(F.answerOf(facts[k]) + 1), 3000));
        rooms._set("flu/424242/p/kid" + ni, { per: "1st", ni, nm: short[ni], at: now - 120e3, runs: [{ id: "r" + ni, md: "c", set: "mul", top: 12, b: 120, s: secs, t0: now - 400e3, lg, end: now - 400e3 + secs * 1000, pts: right * 140 }] });
    });
    // one still playing
    rooms._set("flu/424242/p/kid5", { per: "1st", ni: 5, nm: short[5], at: now, runs: [{ id: "r5", md: "c", set: "mul", top: 12, b: 120, s: 120, t0: now - 40e3, lg: facts.slice(0, 14).map((f) => F.logItem(f, String(F.answerOf(f)), 2600)), end: 0, pts: 1900 }] });
    rooms._set("flu/424242/p/kid6", { per: "1st", ni: 6, nm: short[6], at: now, runs: [] });
}
