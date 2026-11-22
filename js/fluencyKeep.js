/* ==========================================
   Anchor Board — Fact Blitz, the teacher's side that keeps a check running.
   Used by the Fact Blitz page (fluency.html, js/fluencyPage.js) and by the Student Game screen on the
   Remote and the board (js/liveRoom.js), so a check runs from any of them:
     - sends each student who joins their own clock (extra time) and tries (flu/{code}/s/<guest>)
     - saves results: Class Data (data/i_fb<id>_<period>, for the Gradebook and Student Progress), each run
       on the student's profile (profiles/<period>, once per run), and a summary on the check (flu/a_<id>)
     - opens, closes and deletes checks (flu/{code}, flu/a_<id>, flu/index)
   More than one screen can run it at once: clocks are only written when they change, Class Data is the same
   numbers from the same runs, and a run is added to a profile only once (factCore.addRun checks its id).
   Rules live in js/factCore.js; the paths are described in js/fluencyPage.js and firestore.rules.
========================================== */
import * as F from "./factCore.js?v=1";
import * as PC from "./profileCore.js?v=2";
import { shortNames } from "./vaultCore.js?v=75";

const uidOf = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const one = (x) => (Math.round((+x || 0) * 10) / 10).toString();
const errCode = (e) => (e && e.code) || "connection";

/**
 * opts: { store, rooms, periods: () => [["1st","8th"], …] | null (school period order, when known),
 *         onChange(), onIndex(ok, err), onErr(message) }
 */
export function createKeeper(opts) {
    const { store, rooms } = opts;
    const changed = () => { if (opts.onChange) opts.onChange(); };
    const D = { rosters: null, index: null, defs: new Map(), entries: new Map(), sent: new Map(), setup: { xt: {} }, profiles: new Map(), synced: new Map() };
    let setupIn = false;
    const offs = [];

    offs.push(store.watch("rosters/all", (s) => { if (s.pending) return; D.rosters = (s.exists && s.data && s.data.periods) || {}; changed(); }, () => { D.rosters = {}; changed(); }));
    offs.push(store.watch("flu/index", (s) => { if (s.pending) return; D.index = ((s.exists && s.data && s.data.list) || []).filter((x) => x && x.id); watchOpen(); if (opts.onIndex) opts.onIndex(true); changed(); }, (e) => { if (opts.onIndex) opts.onIndex(false, e); }));
    // until flu/setup arrives nobody has extra time yet, and pushClocks waits for the real one
    offs.push(store.watch("flu/setup", (s) => { if (s.pending) return; setupIn = true; D.setup = (s.exists && s.data) || { xt: {} }; D.setup.xt = D.setup.xt || {}; pushClocksAll(); changed(); }, () => { setupIn = true; }));

    const rosterOf = (p) => shortNames(((D.rosters || {})[p] || []).filter(Boolean));
    const periodsWithRoster = () => { const PER = opts.periods && opts.periods(); return (PER ? PER.map((p) => p[0]) : Object.keys(D.rosters || {}).sort((a, b) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99))).filter((p) => rosterOf(p).length); };
    const xtOf = (per, nm) => { const x = +((D.setup && D.setup.xt) || {})[per + "|" + nm] || 1; return F.EXTRA.includes(x) ? x : 1; };
    const openList = () => (D.index || []).filter((x) => x.status === "open");

    /* ---------- one check: its private copy, and its students' entries while it is open ---------- */
    function def(id) {
        if (!D.defs.has(id)) { D.defs.set(id, null); offs.push(store.watch("flu/a_" + id, (s) => { if (s.pending) return; if (s.exists) { D.defs.set(id, s.data); watchEntries(s.data); } changed(); }, () => {})); }
        return D.defs.get(id);
    }
    const unsubs = new Map();
    function watchEntries(d) {
        if (!d || !d.code || d.removed || unsubs.has(d.id)) return;
        const u1 = rooms.watchAll("flu/" + d.code + "/p", (list) => { D.entries.set(d.id, list); pushClocks(d); syncSoon(d.id); changed(); }, () => {});
        const u2 = rooms.watchAll("flu/" + d.code + "/s", (list) => { const m = new Map(); list.forEach((x) => m.set(x.id, x.data)); D.sent.set(d.id, m); pushClocks(d); }, () => {});
        unsubs.set(d.id, () => { u1(); u2(); });
    }
    // open checks keep their entries live, so students joining always get their clock
    let watchedIndex = "";
    function watchOpen() {
        const sig = openList().map((x) => x.id).join(",");
        if (sig === watchedIndex) return; watchedIndex = sig;
        openList().forEach((x) => def(x.id));
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
    function pushClocksAll() { openList().forEach((x) => { const d = D.defs.get(x.id); if (d) pushClocks(d); }); }

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
                    const kids = Object.assign({}, (cur && cur.kids) || {}); let any = false;
                    rs.forEach((r) => {
                        const k = PC.kidKey(r.nm); if (!k) return;
                        const kid = PC.cleanKid(kids[k], r.nm);
                        r.runs.filter(finished).forEach((run) => {
                            const got = F.addRun(kid.fl, d.set, Object.assign({}, run, { id: d.id + "." + run.id }), dayS);
                            if (got.added) { kid.fl = got.fl; kid.xp += got.xp; any = true; }
                        });
                        kids[k] = kid;
                    });
                    return any ? { v: 1, per: String(per).slice(0, 20), kids, at: Date.now() } : null;
                });
            }
            // 3. a small summary on the check itself, for the list
            const done = rows.filter((r) => r.sc);
            d.res = { n: rows.length, played: rows.filter((r) => r.runs.length).length, done: done.length, avgR: done.length ? done.reduce((s, r) => s + r.sc.r, 0) / done.length : null, at: now };
            await store.save("flu/a_" + d.id, JSON.parse(JSON.stringify(d)));
            D.synced.set(id, now); D.synced.set(id + "|sig", sig); changed();
        } catch (e) { if (opts.onErr) opts.onErr("Couldn't save the results yet (" + errCode(e) + "). They're safe in the check; it tries again on the next change."); }
    }
    const getDoc = (p) => new Promise((res) => { let done = false, un = null; un = store.watch(p, (s) => { if (done || s.pending) return; done = true; res(s.exists ? s.data : null); if (un) setTimeout(un, 0); }, () => { if (!done) { done = true; res(null); } }); });
    // a run still going has no end yet: look again once its clock is over
    const tick = setInterval(() => { openList().forEach((x) => { if (D.defs.get(x.id)) syncSoon(x.id); }); }, 15000);

    /* ---------- opening, closing, deleting (each throws on a failed save; the caller says so) ---------- */
    async function newCode() {
        for (let i = 0; i < 12; i++) {
            const c = String(100000 + Math.floor(Math.random() * 900000));
            try { const x = await rooms.get("flu/" + c); if (!x) return c; } catch (e) { return c; }
        }
        return String(100000 + Math.floor(Math.random() * 900000));
    }
    const autoTitle = (dr) => F.setName(dr.set) + (dr.mode === "check" ? " speed check, " : " practice, ") + new Date().toLocaleDateString([], { month: "short", day: "numeric" });
    /** A new check from a draft { mode, set, top, secs, goal, tries, counts, periods, title }. Returns the check. */
    async function openCheck(dr) {
        const id = uidOf(), code = await newCode(), now = Date.now(), title = (dr.title || autoTitle(dr)).trim().slice(0, 80);
        const names = {}; dr.periods.forEach((p) => { names[p] = rosterOf(p); });
        const d = { id, code, title, mode: dr.mode, set: dr.set, top: dr.top, secs: dr.secs, goal: dr.goal, tries: dr.tries, counts: dr.counts, periods: dr.periods.slice(), names, status: "open", at: now, opened: now, more: {} };
        await rooms.save("flu/" + code, { owner: rooms.uid(), kind: "flu", title, mode: d.mode, set: d.set, top: d.top, secs: d.secs, goal: d.goal, tries: d.tries, counts: d.counts, names, status: "open", at: now });
        await store.save("flu/a_" + id, d);
        D.index = [{ id, title, mode: d.mode, set: d.set, top: d.top, secs: d.secs, goal: d.goal, code, status: "open", periods: d.periods, at: now }].concat(D.index || []);
        await store.save("flu/index", { list: D.index, at: now });
        D.defs.set(id, d); watchEntries(d);
        if (d.mode === "check" && D.setup && D.setup.goal !== d.goal) { D.setup = Object.assign({}, D.setup, { goal: d.goal }); store.save("flu/setup", { xt: D.setup.xt || {}, goal: d.goal, at: now }).catch(() => {}); }
        changed();
        return d;
    }
    async function setStatus(d, st) {
        await rooms.save("flu/" + d.code, { status: st }, true);
        d.status = st; await store.save("flu/a_" + d.id, JSON.parse(JSON.stringify(d)));
        D.index = (D.index || []).map((x) => (x.id === d.id ? Object.assign({}, x, { status: st }) : x)); await store.save("flu/index", { list: D.index, at: Date.now() });
        if (st === "closed") syncSoon(d.id, true); else watchEntries(d);
        changed();
    }
    async function moreTries(d, key) {
        d.more = Object.assign({}, d.more || {}); d.more[key] = (+d.more[key] || 0) + 1;
        await store.save("flu/a_" + d.id, JSON.parse(JSON.stringify(d))); pushClocks(d); changed();
    }
    async function remove(d) {
        if (d.code) { try { await rooms.clear("flu/" + d.code + "/p"); await rooms.clear("flu/" + d.code + "/s"); await rooms.del("flu/" + d.code); } catch (e) { /* already gone */ } }
        if (unsubs.has(d.id)) { unsubs.get(d.id)(); unsubs.delete(d.id); }
        D.index = (D.index || []).filter((x) => x.id !== d.id); await store.save("flu/index", { list: D.index, at: Date.now() });
        await store.save("flu/a_" + d.id, { id: d.id, removed: true, at: Date.now() }); D.defs.delete(d.id);
        changed();
    }
    function stop() { clearInterval(tick); unsubs.forEach((u) => u()); unsubs.clear(); offs.forEach((u) => { try { if (typeof u === "function") u(); } catch (e) { /* gone */ } }); }

    return { D, setupIn: () => setupIn, def, watchOpen, rowsOf, rowFor, pushClocks, pushClocksAll, syncSoon, rosterOf, periodsWithRoster, xtOf, autoTitle, openCheck, setStatus, moreTries, remove, getDoc, stop };
}
