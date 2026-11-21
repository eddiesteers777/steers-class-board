/* ==========================================
   Anchor Board — Student Profiles page (profiles.html). Reads only; writes nothing.
   Reads teacher/{uid}/profiles/{period} (written by the Remote after each game, js/profiles.js)
   and the roster, and shows each student's level, XP, banked coins, badges and every topic's
   accuracy over time. ?demo shows made-up students in this tab and saves nothing.
========================================== */
import { sharedPeriod, saveSharedPeriod } from "./studentsNav.js?v=3";
import { shortNames } from "./vaultCore.js?v=75";
import * as PC from "./profileCore.js?v=2";
import * as TC from "./trackCore.js?v=1";

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const fmtDay = (d) => { if (!d) return "–"; const t = new Date(d + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); };
const remember = (k, v) => { try { if (v === undefined) return localStorage.getItem("anchorboard-profiles-" + k); localStorage.setItem("anchorboard-profiles-" + k, v); } catch (e) { return null; } return null; };
const DEMO_PERIODS = [["1st", "8th"], ["2nd", "8th"], ["4th", "8th"], ["5th", "7th"], ["6th", "8th-acc"]];

export async function mountProfiles() {
    const demo = new URLSearchParams(location.search).has("demo");
    const store = await import(demo ? "./localStore.js?v=57" : "./boardStore.js?v=58");
    const PER = demo ? DEMO_PERIODS : (await import("../data/weeks.js?v=61")).PERIODS;
    const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
    const S = { period: [sharedPeriod(""), remember("period")].find((p) => p && PER.some((x) => x[0] === p)) || PER[0][0], view: remember("view") || "students" };
    const D = { rosters: {}, kids: {}, got: {} };

    PER.forEach(([k]) => { const b = el("button", null, k + " period"); b.type = "button"; b.dataset.k = k; b.onclick = () => { S.period = k; remember("period", k); saveSharedPeriod(k); watchPeriod(); draw(); }; $("periodTabs").append(b); });
    [...$("views").children].forEach((b) => { b.onclick = () => { S.view = b.dataset.v; remember("view", S.view); draw(); }; });

    const user = await store.ready();
    if (!user) { location.replace("login.html"); return; }
    if (demo) await seedDemo(store);
    $("who").textContent = demo ? "Sample students, nothing is saved" : "Signed in as " + user.name;

    store.watch("rosters/all", (s) => { if (s.pending) return; D.rosters = (s.exists && s.data && s.data.periods) || {}; draw(); }, () => {});
    const watching = {};
    function watchPeriod() {
        const k = PC.perKey(S.period); if (watching[k]) return; watching[k] = 1;
        store.watch("profiles/" + k, (s) => { if (s.pending) return; D.kids[k] = (s.exists && s.data && s.data.kids) || {}; D.got[k] = 1; status(demo ? "Sample data" : "Live", "ok"); draw(); },
            (e) => { D.got[k] = 1; status("Could not load profiles (" + ((e && e.code) || "error") + ")", "bad"); draw(); });
    }
    watchPeriod();

    function draw() {
        [...$("periodTabs").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === S.period)));
        [...$("views").children].forEach((b) => b.setAttribute("aria-selected", String(b.dataset.v === S.view)));
        const out = $("out"), k = PC.perKey(S.period);
        if (!D.got[k]) return;
        out.textContent = "";
        const roster = (D.rosters[S.period] || []).filter(Boolean), names = shortNames(roster), kids = D.kids[k] || {};
        // Roster students first (with or without a profile), then any profile whose name is no longer on the roster.
        const rows = names.map((nm) => ({ nm, kid: kids[PC.kidKey(nm)] || null }));
        Object.entries(kids).forEach(([key, kid]) => { if (!names.some((n) => PC.kidKey(n) === key)) rows.push({ nm: kid.nm || key, kid, off: 1 }); });
        if (!rows.length) { out.append(empty("No class list for " + S.period + " period yet.", "Profiles come from your roster. Add the class on the Rosters page first.", "Open Rosters", "rosters.html")); return; }
        const played = rows.filter((r) => r.kid && r.kid.g);
        if (!played.length) out.append(empty("No games saved to profiles yet.", "Play Vault Raid with names from the class list, or a team game with the Group maker's groups. Each student's profile fills in when the game ends.", "Open the Remote", "remote.html"));
        const sums = played.map((r) => PC.summary(r.kid));
        const tiles = el("div", "pgTiles small"), tile = (v, l, sub) => { const t = el("div", "pgTile"); t.append(el("b", null, v), el("span", null, l)); if (sub) t.append(el("small", null, sub)); tiles.append(t); };
        tile(played.length + " of " + names.length, "students with a profile");
        tile(String(sums.reduce((n, s) => n + s.lv, 0)), "locks cracked", "all students together");
        tile(sums.length ? (sums.reduce((n, s) => n + s.lv, 0) / sums.length).toFixed(1) : "–", "average level");
        tile(String(sums.reduce((n, s) => n + s.b.length, 0)), "badges earned");
        if (played.length) out.append(tiles);
        if (S.view === "topics") return topicsView(out, rows);
        const list = el("div", "pfList");
        rows.sort((a, b) => (b.kid ? 1 : 0) - (a.kid ? 1 : 0) || a.nm.localeCompare(b.nm)).forEach((r) => {
            const b = el("button", "pfRow" + (r.kid ? "" : " none")); b.type = "button";
            const s = r.kid ? PC.summary(r.kid) : null;
            const left = el("div", "pfWho"); left.append(el("b", null, r.nm + (r.off ? " (not on roster)" : "")), el("small", null, s ? "Last played " + fmtDay(r.kid.ld) + " · " + s.g + (s.g === 1 ? " game" : " games") : "Not played with a profile yet"));
            b.append(el("span", "pfLv", s ? String(s.lv) : "–"), left);
            if (s) {
                const mid = el("div", "pfMid");
                mid.append(el("small", null, s.next ? "Next lock: " + s.next.l + " (" + s.next.pct + "%)" : s.lv ? "No lock in progress" : "No topics yet"));
                const bar = el("div", "pfBar"), f = el("i"); f.style.width = (s.next ? s.next.pct : 0) + "%"; bar.append(f); mid.append(bar); b.append(mid);
                const st = el("div", "pfStats"); st.append(el("span", null, s.xp + " XP"), el("span", null, s.coins + " coins"), el("span", null, s.b.length + (s.b.length === 1 ? " badge" : " badges"))); b.append(st);
                b.onclick = () => openKid(r.nm, r.kid);
            } else b.onclick = () => openKid(r.nm, null);   // no games yet, but class notes and papers can still be there
            list.append(b);
        });
        out.append(list);
    }
    function topicsView(out, rows) {
        const by = new Map();
        rows.forEach((r) => { if (!r.kid) return; PC.topicRows(r.kid).forEach((t) => { const x = by.get(t.k) || { l: t.l, n: 0, a: 0, r: 0, rec: 0, m: 0, tr: 0 }; x.n++; x.a += t.a; x.r += t.r; x.tr += t.tr; x.rec += t.recent; if (t.m) x.m++; by.set(t.k, x); }); });
        if (!by.size) { out.append(el("p", "pgEmpty", "No topics yet for " + S.period + " period.")); return; }
        const tb = el("table", "pfTable"), head = el("tr"); ["Topic", "Students", "Right (all time)", "Recent (last 10)", "With team", "Locks cracked"].forEach((h) => head.append(el("th", null, h))); tb.append(head);
        [...by.values()].sort((a, b) => a.rec / a.n - b.rec / b.n).forEach((x) => {
            const tr = el("tr"), rec = Math.round(x.rec / x.n);
            tr.append(el("td", null, x.l), el("td", null, String(x.n)), el("td", null, Math.round(100 * x.r / Math.max(1, x.a)) + "% of " + x.a), pctCell(rec), el("td", null, x.tr ? x.tr + " of " + x.r + " right" : "–"), el("td", null, x.m + " of " + x.n));
            tb.append(tr);
        });
        const wrap = el("div", "pfTableWrap"); wrap.append(tb); out.append(wrap);
    }
    function pctCell(v) { const td = el("td", "pfPct " + (v >= 80 ? "ok" : v >= 60 ? "mid" : "low")); td.textContent = v + "% " + (v >= 80 ? "✓" : v >= 60 ? "~" : "!"); return td; }
    function openKid(nm, kid) {
        const d = $("kid"); d.textContent = "";
        history.replaceState(null, "", "?kid=" + encodeURIComponent(nm) + "&per=" + encodeURIComponent(S.period) + (demo ? "&demo" : ""));
        if (!kid) {   // no game profile yet: still one place for class notes and papers
            const head = el("div", "pfKHead"); head.append(el("span", "pfLv big", "–"));
            const t = el("div"); t.append(el("h2", null, nm), el("p", null, "No games saved to this profile yet.")); head.append(t);
            const x = el("button", "btn ghost", "Close"); x.type = "button"; x.onclick = () => d.close(); head.append(x); d.append(head);
            d.querySelector("h2").id = "kidName";
            d.append(inClass(nm), classWork(nm));
            d.showModal(); return;
        }
        const s = PC.summary(kid);
        const head = el("div", "pfKHead"); head.append(el("span", "pfLv big", String(s.lv)));
        const t = el("div"); t.append(el("h2", null, nm), el("p", null, "Level " + s.lv + " · " + s.xp + " XP · " + s.coins + " coins banked (" + s.bank + " earned) · " + s.g + " games")); head.append(t);
        const x = el("button", "btn ghost", "Close"); x.type = "button"; x.onclick = () => d.close(); head.append(x); d.append(head);
        d.querySelector("h2").id = "kidName";
        const bests = [], B = s.best; if (B.c) bests.push(B.c + " coins"); if (B.acc) bests.push(B.acc + "% right"); if (B.st) bests.push(B.st + " in a row");
        d.append(el("p", "pfLine", "Badges: " + (s.b.length ? s.b.map((k) => PC.badge(k)[1]).join(", ") : "none yet") + (bests.length ? " · Personal bests: " + bests.join(", ") : "")));
        const tb = el("table", "pfTable"), hr = el("tr"); ["Topic", "Tries", "Right", "Last 10", "Days", "Weeks (right %)", "Lock"].forEach((h) => hr.append(el("th", null, h))); tb.append(hr);
        PC.topicRows(kid).forEach((r) => {
            const tr = el("tr"), dots = el("td", "pfDots"); [...r.h].forEach((c) => dots.append(el("i", c === "1" ? "y" : "n")));
            dots.setAttribute("aria-label", r.recent + "% of the last " + r.h.length);
            const wk = el("td", "pfWeeks"); r.weeks.forEach((w) => { const b = el("i"), p = w.a ? Math.round(100 * w.r / w.a) : 0; b.style.height = Math.max(8, p) + "%"; b.title = w.w + ": " + w.r + " of " + w.a + " right"; b.className = p >= 80 ? "ok" : p >= 60 ? "mid" : "low"; wk.append(b); });
            tr.append(el("td", null, r.l), el("td", null, String(r.a)), el("td", null, r.r + (r.tr ? " (" + r.tr + " with team)" : "") + " · " + r.pct + "%"), dots, el("td", null, String(r.d)), wk, el("td", null, r.m ? "Cracked " + fmtDay(r.m) : r.prog + "%"));
            tb.append(tr);
        });
        const wrap = el("div", "pfTableWrap"); wrap.append(tb); d.append(el("h3", "pfSec", "Games"), wrap);
        d.append(inClass(nm), classWork(nm));
        d.showModal();
    }
    // Every document read once (the page only reads).
    const once = (path) => new Promise((res) => { let done = false, un = null; un = store.watch(path, (s) => { if (done || s.pending) return; done = true; res(s.exists ? s.data : null); if (un) setTimeout(un, 0); }, () => { if (!done) { done = true; res(null); } }); });
    const TRACK = new Map(); let TAGS = null;
    /** In class: the Class Tracker's last six weeks for this student (behaviour, kept apart from the game level). */
    function inClass(nm) {
        const sec = el("section", "pfIn"); sec.append(el("h3", "pfSec", "In class (Class Tracker)"), el("p", "pfLine", "Loading the last six weeks\u2026"));
        (async () => {
            if (!TAGS) TAGS = TC.cleanTags(await once("settings/track"));
            const want = [];
            for (let i = 0; i < 42; i++) { const x = new Date(); x.setDate(x.getDate() - i); const k = TC.localIso(x); if (!TRACK.has(k)) want.push(k); }
            await Promise.all(want.map((k) => once("track/" + k).then((t) => TRACK.set(k, t && t.ev ? Object.assign({ day: k }, t) : null))));
            const h = TC.kidHistory([...TRACK.values()].filter(Boolean), S.period, nm, TAGS);
            sec.textContent = ""; sec.append(el("h3", "pfSec", "In class (Class Tracker)"));
            if (!h.days.length) sec.append(el("p", "pfLine", "Nothing from the Class Tracker in the last six weeks."));
            else {
                sec.append(el("p", "pfLine", h.good + " positive · " + h.work + " needs work · " + h.rr + (h.rr === 1 ? " restroom trip" : " restroom trips") + (h.rr ? " (" + h.rrMins + " min)" : "") + " · " + h.absent + " absent · " + h.picks + " times called on"));
                const tags = TAGS.filter((t) => h.tags[t.k]).sort((a, b) => b.s - a.s || h.tags[b.k] - h.tags[a.k]);
                if (tags.length) { const row = el("div", "pfTagRow"); tags.forEach((t) => row.append(el("span", "pfTag " + (t.s > 0 ? "pos" : "neg"), t.l + " \u00d7" + h.tags[t.k]))); sec.append(row); }
                h.notes.slice(0, 6).forEach((x) => sec.append(el("p", "pfNote", fmtDay(x.day) + ": " + x.t)));
                if (h.notes.length > 6) sec.append(el("p", "pfLine", (h.notes.length - 6) + " older notes in the Class Tracker."));
            }
            sec.append(el("p", "pfLine small", "Behaviour notes are yours only. They never change a level, XP or score, and students never see them."));
            const a = el("a", "btn ghost", "Open in Class Tracker"); a.href = "tracker.html?per=" + encodeURIComponent(S.period) + "&kid=" + encodeURIComponent(nm) + (demo ? "&demo" : ""); sec.append(a);
        })();
        return sec;
    }
    /** Class work: papers filed for this student on the Student Work page. */
    let WORK = null;
    function classWork(nm) {
        const sec = el("section", "pfIn"); sec.append(el("h3", "pfSec", "Class work (Student Work)"), el("p", "pfLine", "Loading papers\u2026"));
        (async () => {
            if (!WORK) { const idx = await once("work/index"); WORK = await Promise.all(((idx && idx.sets) || []).filter((x) => x && x.id).map((x) => once("work/s_" + x.id).then((s) => s || x))); }
            const sets = WORK.filter((x) => x.period === S.period);
            const mine = sets.map((x) => ({ x, n: (x.pages || []).filter((p) => p.s === nm && !p.gone).length })), turned = mine.filter((m) => m.n), missing = mine.filter((m) => !m.n && m.x.kind !== "kept" && !m.x.cleared);
            sec.textContent = ""; sec.append(el("h3", "pfSec", "Class work (Student Work)"));
            if (!sets.length) sec.append(el("p", "pfLine", "No papers scanned for " + S.period + " period yet."));
            else {
                sec.append(el("p", "pfLine", turned.length + (turned.length === 1 ? " paper" : " papers") + " filed · " + missing.length + " not turned in"));
                turned.sort((a, b) => String(b.x.date).localeCompare(String(a.x.date))).slice(0, 4).forEach((m) => sec.append(el("p", "pfNote", fmtDay(m.x.date) + ": " + (m.x.title || "Paper") + " (" + m.n + (m.n === 1 ? " page)" : " pages)"))));
                if (missing.length) sec.append(el("p", "pfNote miss", "Not turned in: " + missing.slice(0, 4).map((m) => m.x.title || "Paper").join(", ") + (missing.length > 4 ? " and " + (missing.length - 4) + " more" : "")));
            }
            const a = el("a", "btn ghost", "Open their folder"); a.href = "work.html?kid=" + encodeURIComponent(nm) + "&per=" + encodeURIComponent(S.period) + (demo ? "&demo" : ""); sec.append(a);
        })();
        return sec;
    }
    // tracker.html and other pages link here with ?kid=&per=
    const Q = new URLSearchParams(location.search), wantKid = Q.get("kid"), wantPer = Q.get("per");
    if (wantKid) { if (wantPer && PER.some((x) => x[0] === wantPer)) { S.period = wantPer; watchPeriod(); }
        let tries = 0; const t = setInterval(() => { const k = PC.perKey(S.period); if (D.got[k] || ++tries > 40) { clearInterval(t); draw(); openKid(wantKid, (D.kids[k] || {})[PC.kidKey(wantKid)] || null); } }, 150); }
    $("kid").addEventListener("close", () => history.replaceState(null, "", demo ? "?demo" : location.pathname));
    function empty(h, p, label, href) { const box = el("div", "pgEmpty"); box.append(el("h2", null, h), el("p", null, p)); const a = el("a", "btn go", label); a.href = href; box.append(a); return box; }
    draw();
}

/* ---------- ?demo: made-up students, built by playing made-up games through the real rules ---------- */
async function seedDemo(store) {
    const names = ["Ava R.", "Ben T.", "Cara L.", "Dev P.", "Eli M.", "Fay K.", "Gus W.", "Hana S."];
    await store.save("rosters/all", { periods: { "1st": names, "2nd": [], "4th": [], "5th": [], "6th": [] } });
    const topics = ["AL 8.11a", "AL 8.9b", "AL 8.12a", "AL 8.4", "Scientific notation"], qs = topics.map((c) => ({ c }));
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const days = ["2026-11-02", "2026-11-05", "2026-11-10", "2026-11-13", "2026-11-17", "2026-11-19"], kids = {};
    names.forEach((nm, n) => {
        const skill = 0.45 + 0.07 * n; let kid = null;
        days.forEach((day, di) => {
            const lg = []; for (let i = 0; i < 10; i++) { const qi = Math.floor(rnd() * Math.min(qs.length, 2 + di)), ok = rnd() < skill + di * 0.04 ? 1 : 0; lg.push({ i: qi, ok, fx: !ok && rnd() < 0.5 ? 1 : 0 }); }
            const g = PC.vaultGain({ nm, lg, c: Math.round(60 + 200 * rnd()), best: Math.floor(1 + 6 * rnd()) }, qs); g.av = n % 8;
            kid = PC.applyGain(kid, g, day).kid;
            if (di % 2) { const tg = PC.teamGains([{ c: topics[di % 3], w: rnd() < skill ? [0] : [], x: [0] }, { c: topics[(di + 1) % 3], w: [0], x: [0] }], [{ m: [nm] }], (x) => x); kid = PC.applyGain(kid, Object.assign(tg[nm], { play: 1 }), day).kid; }
        });
        if (n < 7) kids[PC.kidKey(nm)] = kid;   // Hana hasn't played with a profile yet
    });
    await store.save("profiles/1st", { v: 1, per: "1st", kids, at: Date.now() });
}
