/* ==========================================
   Anchor Board — Student Profiles page (profiles.html). Reads only; writes nothing.
   Reads teacher/{uid}/profiles/{period} (written by the Remote after each game, js/profiles.js)
   and the roster, and shows each student's level, XP, banked coins, badges and every topic's
   accuracy over time. ?demo shows made-up students in this tab and saves nothing.
========================================== */
import { sharedPeriod, saveSharedPeriod } from "./studentsNav.js?v=3";
import { shortNames } from "./vaultCore.js?v=75";
import * as PC from "./profileCore.js?v=2";

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
            } else b.disabled = true;
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
        const d = $("kid"), s = PC.summary(kid); d.textContent = "";
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
        const wrap = el("div", "pfTableWrap"); wrap.append(tb); d.append(wrap);
        d.showModal();
    }
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
