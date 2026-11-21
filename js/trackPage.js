/* ==========================================
   Anchor Board — Class Tracker page (tracker.html), Nov 21, 2026.
   Phone first. One tap on a student, one tap on a tag. Restroom out and back, absent,
   quick notes, a no-repeat random picker plus calling on someone by hand, and a history per student.
   Teacher-only: everything lives under teacher/{uid}/track/{day} and settings/track (rules already
   lock teacher/{uid}/** to the teacher). Nothing here reaches the board or any student screen.
   ?demo: made-up names, a this-tab store, nothing is saved.
========================================== */
import * as T from "./trackCore.js?v=1";
import { perKey, kidKey, summary as profileSummary } from "./profileCore.js?v=1";

const Q = new URLSearchParams(location.search), DEMO = Q.has("demo");
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const remember = (k, v) => { try { if (v === undefined) return localStorage.getItem("anchor:track:" + k); localStorage.setItem("anchor:track:" + k, v); } catch (e) { return null; } return v; };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* ok */ } };
const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayLabel = (iso) => new Date(iso + "T12:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

/* ---------- the store: Firestore for real, a this-tab copy for ?demo ---------- */
function demoStore() {
    const docs = new Map(), subs = new Map();
    const fire = (p) => (subs.get(p) || new Set()).forEach((f) => setTimeout(() => f({ exists: docs.has(p), data: docs.get(p), pending: false }), 0));
    const deep = (a, b) => { Object.keys(b).forEach((k) => { if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) { a[k] = a[k] && typeof a[k] === "object" ? a[k] : {}; deep(a[k], b[k]); } else a[k] = b[k]; }); return a; };
    const names = ["Avery B.", "Brooklyn C.", "Carter D.", "Dakota E.", "Elliot F.", "Finley G.", "Gray H.", "Harper J.", "Indie K.", "Jordan L.", "Kai M.", "Logan N.", "Morgan P.", "Nova R.", "Oakley S.", "Parker T.", "Quinn V.", "Reese W.", "Rowan Y.", "Sage Z.", "Tatum A.", "Winter B."];
    docs.set("rosters/all", { periods: { "1st": names, "2nd": names.slice(4).concat(["Ash C.", "Blake D."]), "4th": names.slice(2, 18), "5th": names.slice(0, 20), "6th": names.slice(6) } });
    // a little history so the history view has something to show
    const now = Date.now();
    for (let i = 1; i <= 12; i++) {
        const d = new Date(); d.setDate(d.getDate() - i); if (d.getDay() === 0 || d.getDay() === 6) continue;
        const day = T.localIso(d), ev = {};
        names.forEach((n, j) => {
            const seed = (i * 7 + j * 13) % 10, at = d.setHours(9, (j * 3) % 50, 0, 0);
            if (seed < 5) ev["d" + i + "a" + j] = { p: "1st", n, k: ["part", "effort", "helped", "ontask"][seed % 4], at };
            if (seed === 7 || seed === 3) ev["d" + i + "b" + j] = { p: "1st", n, k: ["redirect", "attn", "unprep", "distract"][(i + j) % 4], at: at + 60000 };
            if (seed === 9) ev["d" + i + "c" + j] = { p: "1st", n, k: "rr", at: at + 120000, b: at + 120000 + (3 + (j % 5)) * 60000 };
        });
        ev["d" + i + "n"] = { p: "1st", n: names[i % 5], k: "note", t: ["Asked a great question about slope.", "Needed help starting the warm-up.", "Worked well with partner.", "Left notebook in another class.", "Explained step 2 to the table."][i % 5], at: now - i * 864e5 };
        docs.set("track/" + day, { day, v: 1, ev });
    }
    return {
        async ready() { return { uid: "demo", name: "Sample class" }; },
        watch(path, next) { if (!subs.has(path)) subs.set(path, new Set()); subs.get(path).add(next); setTimeout(() => next({ exists: docs.has(path), data: docs.get(path), pending: false }), 0); return () => subs.get(path).delete(next); },
        async merge(path, data) { docs.set(path, deep(JSON.parse(JSON.stringify(docs.get(path) || {})), JSON.parse(JSON.stringify(data)))); fire(path); },
        async set(path, data) { docs.set(path, JSON.parse(JSON.stringify(data))); fire(path); },
        async get(path) { return docs.has(path) ? JSON.parse(JSON.stringify(docs.get(path))) : null; },
    };
}
async function realStore() {
    const s = await import("./boardStore.js?v=58");
    const full = (p) => "teacher/" + s.rooms.uid() + "/" + p;
    return {
        ready: s.ready,
        watch: s.watch,
        merge: (path, data) => s.rooms.save(full(path), data, true),
        set: (path, data) => s.save(path, data),
        get: (path) => s.rooms.get(full(path)),
    };
}

/* ---------- state ---------- */
const S = { period: "", view: remember("view") || "class", day: T.localIso(), sel: null, pickName: "", sheetFor: null, sheetTab: "today", sort: remember("sort") || "az" };
let PROFILES = {}, profWatch = {};   // game profiles per period (read only), for the level line on a student
let store = null, PERIODS = [], ROSTER = {}, DOC = null, TAGS = T.cleanTags(null), unsubDay = null, boardPeriod = "";
const evsAll = () => T.events(DOC);
const evs = () => T.events(DOC, S.period);
const names = () => ROSTER[S.period] || [];
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };

/* ---------- writing (one field per event: two phones never clobber each other) ---------- */
function write(id, data) {
    const doc = { day: S.day, v: 1, ev: { [id]: data } };
    // Show it at once; Firestore keeps the write if the wifi drops and sends it when it is back.
    DOC = DOC || { day: S.day, ev: {} }; DOC.ev = DOC.ev || {}; DOC.ev[id] = Object.assign({}, DOC.ev[id] || {}, data);
    draw();
    return store.merge("track/" + S.day, doc).then(() => { if (!DEMO) status("Saved", "ok"); }).catch((e) => { status("Not saved (" + ((e && e.code) || "connection") + ")", "bad"); toast("That tap did not save. Check the connection and try again."); });
}
function add(name, k, extra) {
    const id = T.newId(), e = Object.assign({ p: S.period, n: name, k, at: Date.now() }, extra || {});
    write(id, e); buzz();
    return id;
}
const removeEv = (id) => write(id, { x: 1 });

/* ---------- toast with undo ---------- */
let toastT = 0;
function toast(text, undo) {
    const t = $("toast"); t.textContent = ""; t.appendChild(el("span", null, text));
    if (undo) { const b = el("button", null, "Undo"); b.type = "button"; b.onclick = () => { undo(); t.hidden = true; }; t.appendChild(b); }
    t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, undo ? 6000 : 3500);
}

/* ---------- the top: periods and today's numbers ---------- */
function drawPeriods() {
    const box = $("periods"); box.textContent = "";
    PERIODS.forEach(([p]) => {
        const b = el("button", null, p); b.type = "button"; b.setAttribute("aria-pressed", String(p === S.period));
        if (p === boardPeriod) { b.title = "The board is on " + p + " period"; b.classList.add("onboard"); }
        b.onclick = () => { if (S.period === p) return; S.period = p; S.pickName = ""; S.sel = null; remember("period", p); draw(); };
        box.appendChild(b);
    });
}
function drawSummary() {
    const e = evs(), t = T.totals(e, TAGS), box = $("summary"); box.textContent = "";
    const stat = (n, label, cls) => { const d = el("div", "tk-stat " + cls); d.appendChild(el("b", null, String(n))); d.appendChild(el("small", null, label)); return d; };
    box.appendChild(stat(t.good, "positive", "pos"));
    box.appendChild(stat(t.work, "needs work", "neg"));
    // the ratio ring: good notes for every needs-work note, against a 4 to 1 goal
    const ring = el("div", "tk-ratio"), share = t.good + t.work ? Math.min(1, (t.ratio == null ? T.RATIO_GOAL : t.ratio) / T.RATIO_GOAL) : 0;
    ring.style.setProperty("--r", String(share));
    ring.appendChild(el("b", null, t.good + t.work ? (t.ratio == null ? t.good + " : 0" : (Math.round(t.ratio * 10) / 10) + " : 1") : "–"));
    ring.appendChild(el("small", null, "goal " + T.RATIO_GOAL + " : 1"));
    ring.title = "Positive notes for every needs-work note this period. Many PBIS schools aim for about 4 to 1.";
    box.appendChild(ring);
    // who is out of the room
    const out = T.outNow(e), outBox = $("outNow"); outBox.textContent = "";
    out.forEach((o) => {
        const b = el("button", "tk-out"); b.type = "button"; b.dataset.at = o.at;
        b.appendChild(el("span", "tk-outdot")); b.appendChild(el("b", null, o.n)); b.appendChild(el("span", "tk-outclock", T.clock(Date.now() - o.at)));
        b.appendChild(el("em", null, "Back"));
        b.setAttribute("aria-label", o.n + " is out of the room. Tap when back.");
        b.onclick = () => { write(o.id, { b: Date.now() }); toast(o.n + " is back (" + T.clock(Date.now() - o.at) + ").", () => write(o.id, { b: null })); buzz(); };
        outBox.appendChild(b);
    });
    outBox.hidden = !out.length;
}

/* ---------- Class view: one card per student ---------- */
function drawClass() {
    const host = $("view"); host.textContent = "";
    const list = names();
    if (!list.length) return host.appendChild(empty("No names for " + S.period + " period yet.", "Add your class lists on the Rosters page. First name and last initial is plenty.", "Open Rosters", "rosters.html"));
    const by = T.dayByKid(evs(), TAGS), present = list.filter((n) => !(by[n] && by[n].abs));
    const noGood = present.filter((n) => !(by[n] && by[n].good));
    // tools row
    const bar = el("div", "tk-bar");
    const sel = el("button", "tk-chip" + (S.sel ? " on" : ""), S.sel ? "Done selecting" : "Select several"); sel.type = "button";
    sel.onclick = () => { S.sel = S.sel ? null : new Set(); draw(); };
    bar.appendChild(sel);
    if (S.sel) { const all = el("button", "tk-chip", "Everyone here"); all.type = "button"; all.onclick = () => { S.sel = new Set(present); draw(); }; bar.appendChild(all); }
    const sort = el("button", "tk-chip", S.sort === "az" ? "A to Z" : "No positive yet first"); sort.type = "button";
    sort.title = "Change the order"; sort.onclick = () => { S.sort = S.sort === "az" ? "need" : "az"; remember("sort", S.sort); draw(); };
    bar.appendChild(sort);
    host.appendChild(bar);
    if (present.length && noGood.length) {
        const p = el("p", "tk-hint"); p.appendChild(el("span", "tk-dot")); p.appendChild(document.createTextNode(noGood.length === present.length ? " No positive notes yet this period. Catch someone doing it right." : " " + noGood.length + " of " + present.length + " have no positive note yet today."));
        host.appendChild(p);
    }
    const order = S.sort === "need" ? list.slice().sort((a, b) => {
        const ga = by[a] ? by[a].good : 0, gb = by[b] ? by[b].good : 0, aa = by[a] && by[a].abs ? 1 : 0, ab = by[b] && by[b].abs ? 1 : 0;
        return aa - ab || ga - gb || a.localeCompare(b);
    }) : list;
    const grid = el("div", "tk-grid");
    order.forEach((n) => {
        const r = by[n] || { good: 0, work: 0, abs: false, rr: { out: null }, notes: [] }, c = el("button", "tk-kid"); c.type = "button";
        if (r.abs) c.classList.add("abs");
        if (S.sel && S.sel.has(n)) c.classList.add("picked");
        c.appendChild(el("b", "tk-name", n));
        const row = el("span", "tk-counts");
        if (r.abs) row.appendChild(el("span", "tk-abs", "Absent"));
        else {
            if (r.good) row.appendChild(el("span", "tk-g", "+" + r.good));
            if (r.work) row.appendChild(el("span", "tk-w", "−" + r.work));
            if (r.rr.out) row.appendChild(el("span", "tk-rr", "Out"));
            if (r.notes.length) row.appendChild(el("span", "tk-n", "Note"));
            if (!r.good && !r.work && !r.rr.out && !r.notes.length) row.appendChild(el("span", "tk-none", " "));
        }
        c.appendChild(row);
        if (!r.abs && !r.good) c.appendChild(el("span", "tk-dot corner"));
        c.setAttribute("aria-label", n + (r.abs ? ", absent" : ", " + r.good + " positive, " + r.work + " needs work" + (r.rr.out ? ", out of the room" : "")) + (S.sel ? (S.sel.has(n) ? ". Selected." : ". Tap to select.") : ". Tap for tags and notes."));
        c.onclick = () => {
            if (S.sel) { if (S.sel.has(n)) S.sel.delete(n); else S.sel.add(n); draw(); return; }
            openSheet([n]);
        };
        grid.appendChild(c);
    });
    host.appendChild(grid);
    // the bar for several students
    const go = $("selBar"); go.hidden = !S.sel;
    if (S.sel) {
        $("selCount").textContent = S.sel.size ? S.sel.size + (S.sel.size === 1 ? " student" : " students") + " selected" : "Tap students to select them";
        $("selGo").disabled = !S.sel.size;
    }
}

function empty(title, body, btn, href) {
    const d = el("div", "tk-empty"); d.appendChild(el("h2", null, title)); d.appendChild(el("p", null, body));
    if (btn) { const a = el("a", "tk-primary", btn); a.href = href; d.appendChild(a); }
    return d;
}

/* ---------- Pick view: random, no repeats, or by hand ---------- */
let rolling = false;
function drawPick() {
    const host = $("view"); host.textContent = "";
    const list = names();
    if (!list.length) return host.appendChild(empty("No names for " + S.period + " period yet.", "The picker uses your class list.", "Open Rosters", "rosters.html"));
    const e = evs(), round = T.pickRound(list, e), by = T.dayByKid(e, TAGS);
    const stage = el("div", "tk-stage");
    stage.appendChild(el("p", "tk-stagek", S.pickName ? "Called on" : "Ready"));
    const nm = el("p", "tk-stagen", S.pickName || "Tap Pick"); nm.id = "pickName"; nm.setAttribute("aria-live", "polite");
    stage.appendChild(nm);
    stage.appendChild(el("p", "tk-stages", round.of ? round.called + " of " + round.of + " called on this round. No repeats until everyone here has had a turn." : "Everyone is marked absent or out."));
    host.appendChild(stage);
    const go = el("button", "tk-primary big", S.pickName ? "Pick again" : "Pick at random"); go.type = "button";
    go.onclick = () => roll();
    host.appendChild(go);
    if (S.pickName) {
        const q = el("div", "tk-quick");
        const good = TAGS.filter((t) => t.s > 0 && !t.off).slice(0, 3), work = TAGS.filter((t) => t.s < 0 && !t.off).slice(0, 2);
        good.concat(work).forEach((t) => {
            const b = el("button", "tk-tag " + (t.s > 0 ? "pos" : "neg"), t.l); b.type = "button";
            b.onclick = () => tagOne(S.pickName, t);
            q.appendChild(b);
        });
        const more = el("button", "tk-tag plain", "More for " + S.pickName.split(" ")[0]); more.type = "button"; more.onclick = () => openSheet([S.pickName]); q.appendChild(more);
        const gone = el("button", "tk-tag plain", "Not here today"); gone.type = "button";
        gone.onclick = () => { const n = S.pickName, id = add(n, "abs"); toast(n + " marked absent.", () => removeEv(id)); undoLastPick(n); roll(true); };
        q.appendChild(gone);
        host.appendChild(q);
    }
    // by hand: who has not had a turn first
    host.appendChild(el("h2", "tk-h", "Call on someone yourself"));
    const low = Math.min(...list.map((n) => (by[n] ? by[n].picks : 0)));
    const hand = el("div", "tk-hand");
    list.slice().sort((a, b) => ((by[a] ? by[a].picks : 0) - (by[b] ? by[b].picks : 0)) || a.localeCompare(b)).forEach((n) => {
        const r = by[n], away = r && (r.abs || r.rr.out), b = el("button", "tk-handb" + (away ? " away" : "") + (r && r.picks > low ? " had" : "")); b.type = "button";
        b.appendChild(el("span", null, n));
        if (r && r.picks) b.appendChild(el("small", null, r.picks === 1 ? "1 turn" : r.picks + " turns"));
        else if (away) b.appendChild(el("small", null, r.abs ? "absent" : "out"));
        b.onclick = () => { S.pickName = n; add(n, "pick"); draw(); };
        hand.appendChild(b);
    });
    host.appendChild(hand);
}
function undoLastPick(n) {
    const last = evs().filter((e) => e.k === "pick" && e.n === n).pop();
    if (last) removeEv(last.id);
}
function roll(skipSame) {
    if (rolling) return;
    const list = names(), r = T.pickNext(list, evs(), Math.random, skipSame ? "" : S.pickName);
    if (!r) { toast("Nobody to pick: everyone is absent or out."); return; }
    const finish = () => { rolling = false; S.pickName = r.name; add(r.name, "pick"); draw(); };
    if (reduced()) return finish();
    rolling = true; const nm = $("pickName"), pool = list.slice(); let i = 0;
    const spin = setInterval(() => { if (nm) nm.textContent = pool[Math.floor(Math.random() * pool.length)]; if (++i > 9) { clearInterval(spin); finish(); } }, 60);
}

/* ---------- Today view: the period's feed ---------- */
function drawToday() {
    const host = $("view"); host.textContent = "";
    const e = evs(), by = T.dayByKid(e, TAGS), list = names();
    if (!e.length) return host.appendChild(empty("Nothing yet for " + S.period + " period today.", "Tap a student on the Class tab to add a positive, a needs-work note, a restroom trip or a note.", null));
    // counts by tag
    const counts = {}; e.forEach((x) => { if (T.signOf(TAGS, x.k)) counts[x.k] = (counts[x.k] || 0) + 1; });
    const tagBox = el("div", "tk-tagsum");
    TAGS.filter((t) => counts[t.k]).sort((a, b) => b.s - a.s || counts[b.k] - counts[a.k]).forEach((t) => {
        const d = el("div", "tk-ts " + (t.s > 0 ? "pos" : "neg")); d.appendChild(el("b", null, String(counts[t.k]))); d.appendChild(el("span", null, t.l)); tagBox.appendChild(d);
    });
    if (tagBox.childNodes.length) { host.appendChild(el("h2", "tk-h", "This period")); host.appendChild(tagBox); }
    // restroom log
    const rr = e.filter((x) => x.k === "rr");
    if (rr.length) {
        host.appendChild(el("h2", "tk-h", "Restroom today"));
        const box = el("div", "tk-list");
        rr.forEach((x) => { const row = el("div", "tk-li"); row.appendChild(el("b", null, x.n)); row.appendChild(el("span", null, time(x.at) + (x.b ? " to " + time(x.b) + " · " + Math.max(1, Math.round((x.b - x.at) / 60000)) + " min" : " · out now"))); box.appendChild(row); });
        host.appendChild(box);
    }
    // nobody positive yet
    const noGood = list.filter((n) => !(by[n] && (by[n].good || by[n].abs)));
    if (noGood.length && noGood.length < list.length) {
        host.appendChild(el("h2", "tk-h", "No positive note yet"));
        const box = el("div", "tk-hand");
        noGood.forEach((n) => { const b = el("button", "tk-handb"); b.type = "button"; b.appendChild(el("span", null, n)); b.onclick = () => openSheet([n]); box.appendChild(b); });
        host.appendChild(box);
    }
    host.appendChild(el("h2", "tk-h", "Everything, newest first"));
    host.appendChild(feed(e.slice().reverse(), true));
}
function feed(list, withName) {
    const box = el("div", "tk-list");
    list.forEach((x) => {
        const row = el("div", "tk-li"), s = T.signOf(TAGS, x.k);
        const left = el("div", "tk-lil");
        left.appendChild(el("span", "tk-pip " + (s > 0 ? "pos" : s < 0 ? "neg" : "plain")));
        const txt = el("div");
        txt.appendChild(el("b", null, (withName ? x.n + " · " : "") + (x.k === "note" ? "Note" : T.labelOf(TAGS, x.k)) + (x.k === "rr" && x.b ? " (" + Math.max(1, Math.round((x.b - x.at) / 60000)) + " min)" : x.k === "rr" ? " (out now)" : "")));
        if (x.t) txt.appendChild(el("p", "tk-note", x.t));
        left.appendChild(txt);
        row.appendChild(left);
        row.appendChild(el("span", "tk-time", time(x.at)));
        const del = el("button", "tk-x", "×"); del.type = "button"; del.title = "Remove"; del.setAttribute("aria-label", "Remove " + T.labelOf(TAGS, x.k) + " for " + x.n);
        del.onclick = () => { removeEv(x.id); toast("Removed.", () => write(x.id, { x: null })); };
        row.appendChild(del);
        box.appendChild(row);
    });
    return box;
}

/* ---------- the student sheet (one student, or several) ---------- */
function openSheet(list) {
    S.sheetFor = list.slice(); S.sheetTab = "today";
    drawSheet();
    const d = $("sheet"); if (!d.open) d.showModal();
}
function closeSheet() { const d = $("sheet"); if (d.open) d.close(); S.sheetFor = null; }
function tagOne(n, t) {
    const id = add(n, t.k);
    toast((t.s > 0 ? "+ " : "− ") + t.l + " · " + n, () => removeEv(id));
}
function drawSheet() {
    const list = S.sheetFor; if (!list) return;
    const box = $("sheetBody"); box.textContent = "";
    const many = list.length > 1, n = list[0], by = T.dayByKid(evs(), TAGS), r = by[n] || { good: 0, work: 0, abs: false, rr: { out: null }, notes: [] };
    $("sheetTitle").textContent = many ? list.length + " students" : n;
    $("sheetSub").textContent = many ? list.join(", ") : (r.abs ? "Absent today" : r.good + " positive · " + r.work + " needs work today" + (r.rr.out ? " · out of the room" : ""));
    const prof = $("sheetProf"); prof.textContent = ""; prof.hidden = many;
    if (!many) {
        const kid = (PROFILES[perKey(S.period)] || {})[kidKey(n)];
        let line = "No games on their profile yet";
        if (kid) { try { const ps = profileSummary(kid); line = "Level " + ps.lv + " · " + ps.xp + " XP · " + ps.g + (ps.g === 1 ? " game" : " games"); } catch (e) { /* older profile */ } }
        prof.appendChild(el("span", null, line));
        const a = el("a", null, "Full profile"); a.href = "profiles.html?kid=" + encodeURIComponent(n) + "&per=" + encodeURIComponent(S.period) + (DEMO ? "&demo" : ""); prof.appendChild(a);
    }
    const tabs = $("sheetTabs"); tabs.hidden = many;
    [...tabs.children].forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.t === S.sheetTab)); b.onclick = () => { S.sheetTab = b.dataset.t; drawSheet(); }; });
    if (!many && S.sheetTab === "history") return drawHistory(box, n);

    const tagGrid = (sign, title) => {
        const tags = TAGS.filter((t) => t.s === sign && !t.off); if (!tags.length) return;
        box.appendChild(el("h3", "tk-sh " + (sign > 0 ? "pos" : "neg"), title));
        const g = el("div", "tk-tags");
        tags.forEach((t) => {
            const b = el("button", "tk-tag " + (sign > 0 ? "pos" : "neg")); b.type = "button";
            b.appendChild(el("span", null, t.l));
            const c = !many && r.tags && r.tags[t.k]; if (c) b.appendChild(el("small", null, "×" + c));
            b.onclick = () => {
                if (many) { const ids = list.map((x) => add(x, t.k)); toast((sign > 0 ? "+ " : "− ") + t.l + " for " + list.length + " students", () => ids.forEach(removeEv)); S.sel = null; }
                else tagOne(n, t);
                closeSheet(); draw();
            };
            g.appendChild(b);
        });
        box.appendChild(g);
    };

    if (!many) {
        const row = el("div", "tk-acts");
        const rr = el("button", "tk-act" + (r.rr.out ? " live" : "")); rr.type = "button";
        rr.appendChild(el("b", null, r.rr.out ? "Back from restroom" : "Restroom"));
        rr.appendChild(el("small", null, r.rr.out ? "Out " + T.clock(Date.now() - r.rr.out.at) : (r.rr.n ? r.rr.n + (r.rr.n === 1 ? " trip" : " trips") + " today" : "Starts a timer")));
        rr.onclick = () => {
            if (r.rr.out) { const o = r.rr.out; write(o.id, { b: Date.now() }); toast(n + " is back (" + T.clock(Date.now() - o.at) + ").", () => write(o.id, { b: null })); }
            else { const others = T.outNow(evs()); const id = add(n, "rr"); toast(n + " is out" + (others.length ? ". " + others.map((o) => o.n).join(", ") + (others.length === 1 ? " is" : " are") + " out too." : "."), () => removeEv(id)); }
            closeSheet(); draw();
        };
        row.appendChild(rr);
        const ab = el("button", "tk-act" + (r.abs ? " on" : "")); ab.type = "button";
        ab.appendChild(el("b", null, r.abs ? "Here after all" : "Absent")); ab.appendChild(el("small", null, r.abs ? "Takes off the absent mark" : "Skipped by the picker"));
        ab.onclick = () => {
            if (r.abs) evs().filter((e) => e.k === "abs" && e.n === n).forEach((e) => removeEv(e.id));
            else { const id = add(n, "abs"); toast(n + " marked absent.", () => removeEv(id)); }
            closeSheet(); draw();
        };
        row.appendChild(ab);
        box.appendChild(row);
    }

    tagGrid(1, "Positive");
    tagGrid(-1, "Needs work");

    // quick note
    box.appendChild(el("h3", "tk-sh", many ? "Note for all " + list.length : "Quick note"));
    const f = el("form", "tk-noteform");
    const lab = el("label", "tk-vh", "Note"); lab.htmlFor = "noteIn";
    const ta = el("textarea"); ta.id = "noteIn"; ta.rows = 2; ta.maxLength = 400; ta.placeholder = "What happened? Keep it short and factual.";
    const save = el("button", "tk-primary", "Save note"); save.type = "submit";
    f.append(lab, ta, save);
    f.onsubmit = (ev) => {
        ev.preventDefault(); const t = ta.value.trim(); if (!t) { ta.focus(); return; }
        const ids = list.map((x) => add(x, "note", { t }));
        toast("Note saved" + (many ? " for " + list.length + " students." : "."), () => ids.forEach(removeEv));
        if (many) { S.sel = null; closeSheet(); } else { ta.value = ""; drawSheet(); }
        draw();
    };
    box.appendChild(f);

    if (!many) {
        const today = evs().filter((e) => e.n === n && e.k !== "pick").reverse();
        if (today.length) { box.appendChild(el("h3", "tk-sh", "Today")); box.appendChild(feed(today, false)); }
    }
}

/* ---------- history for one student ---------- */
const HIST = new Map();   // day -> doc (null when none), loaded once per page visit
async function loadHistory(days) {
    const want = [];
    for (let i = 0; i < days; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = T.localIso(d); if (k !== S.day && !HIST.has(k)) want.push(k); }
    await Promise.all(want.map((k) => store.get("track/" + k).then((d) => HIST.set(k, d && d.ev ? Object.assign({ day: k }, d) : null)).catch(() => HIST.set(k, null))));
    return [...HIST.values()].filter(Boolean).concat(DOC ? [Object.assign({ day: S.day }, DOC)] : []);
}
async function drawHistory(box, n) {
    box.appendChild(el("p", "tk-hint", "Loading the last 30 days…"));
    const docs = await loadHistory(42);
    if (S.sheetTab !== "history" || !S.sheetFor || S.sheetFor[0] !== n) return;
    box.textContent = "";
    const h = T.kidHistory(docs, S.period, n, TAGS);
    if (!h.days.length) { box.appendChild(empty("Nothing saved yet for " + n + ".", "Taps and notes from the last six weeks show here.", null)); return; }
    const stats = el("div", "tk-hstats");
    const st = (v, l, c) => { const d = el("div", "tk-stat " + c); d.appendChild(el("b", null, String(v))); d.appendChild(el("small", null, l)); stats.appendChild(d); };
    st(h.good, "positive", "pos"); st(h.work, "needs work", "neg"); st(h.rr, h.rr === 1 ? "restroom trip" : "restroom trips", "plain"); st(h.absent, "absent", "plain");
    box.appendChild(stats);
    box.appendChild(el("p", "tk-hint", "Last six weeks in " + S.period + " period" + (h.rr ? ". Restroom: " + h.rrMins + " min in all, about " + Math.round(h.rrMins / h.rr) + " min a trip." : ".")));
    // day bars: positive up, needs work down
    const days = h.days.slice(0, 15).reverse(), max = Math.max(1, ...days.map((d) => Math.max(d.good, d.work)));
    const chart = el("div", "tk-chart"); chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "Day by day: " + days.map((d) => dayLabel(d.day) + " " + d.good + " positive, " + d.work + " needs work").join("; "));
    days.forEach((d) => {
        const col = el("div", "tk-col" + (d.abs ? " abs" : ""));
        const up = el("span", "tk-up"); up.style.height = (d.good / max * 100) + "%";
        const dn = el("span", "tk-dn"); dn.style.height = (d.work / max * 100) + "%";
        const top = el("div", "tk-half tk-hu"), bot = el("div", "tk-half tk-hd"); top.appendChild(up); bot.appendChild(dn);
        col.append(top, bot, el("small", null, new Date(d.day + "T12:00").toLocaleDateString([], { weekday: "narrow" })));
        col.title = dayLabel(d.day) + ": " + d.good + " positive, " + d.work + " needs work" + (d.abs ? ", absent" : "");
        chart.appendChild(col);
    });
    box.appendChild(chart);
    // by tag
    const tagRows = TAGS.filter((t) => h.tags[t.k]).sort((a, b) => b.s - a.s || h.tags[b.k] - h.tags[a.k]);
    if (tagRows.length) {
        box.appendChild(el("h3", "tk-sh", "By tag"));
        const top = Math.max(...tagRows.map((t) => h.tags[t.k]));
        const list = el("div", "tk-bars");
        tagRows.forEach((t) => { const r = el("div", "tk-barrow"); r.appendChild(el("span", null, t.l)); const bar = el("i", t.s > 0 ? "pos" : "neg"); bar.style.width = (h.tags[t.k] / top * 100) + "%"; const w = el("span", "tk-barw"); w.appendChild(bar); r.appendChild(w); r.appendChild(el("b", null, String(h.tags[t.k]))); list.appendChild(r); });
        box.appendChild(list);
    }
    if (h.notes.length) {
        box.appendChild(el("h3", "tk-sh", "Notes"));
        const list = el("div", "tk-list");
        h.notes.forEach((x) => { const r = el("div", "tk-li"); const t = el("div"); t.appendChild(el("b", null, dayLabel(x.day))); t.appendChild(el("p", "tk-note", x.t)); r.appendChild(t); list.appendChild(r); });
        box.appendChild(list);
    }
    const copy = el("button", "tk-chip", "Copy a summary"); copy.type = "button";
    copy.onclick = () => {
        const lines = [n + " · " + S.period + " period · last six weeks", h.good + " positive, " + h.work + " needs work, " + h.rr + " restroom trips, " + h.absent + " absent"]
            .concat(tagRows.map((t) => t.l + ": " + h.tags[t.k])).concat(h.notes.map((x) => dayLabel(x.day) + ": " + x.t));
        navigator.clipboard.writeText(lines.join("\n")).then(() => toast("Summary copied. Paste it into an email or a parent note."), () => toast("Could not copy on this device."));
    };
    box.appendChild(copy);
}

/* ---------- tags editor ---------- */
function openTags() {
    const d = $("tagsDlg"), box = $("tagsBody"); let draft = TAGS.map((t) => Object.assign({}, t));
    const drawEd = () => {
        box.textContent = "";
        [[1, "Positive"], [-1, "Needs work"]].forEach(([s, title]) => {
            box.appendChild(el("h3", "tk-sh " + (s > 0 ? "pos" : "neg"), title));
            draft.filter((t) => t.s === s).forEach((t) => {
                const row = el("div", "tk-edrow");
                const inp = el("input"); inp.value = t.l; inp.maxLength = 32; inp.setAttribute("aria-label", title + " tag name");
                inp.oninput = () => { t.l = inp.value; };
                const off = el("button", "tk-chip" + (t.off ? "" : " on"), t.off ? "Hidden" : "Shown"); off.type = "button";
                off.title = "Hidden tags keep their history but leave the buttons";
                off.onclick = () => { if (t.off) delete t.off; else t.off = 1; drawEd(); };
                const del = el("button", "tk-x", "×"); del.type = "button"; del.setAttribute("aria-label", "Remove " + t.l);
                del.onclick = () => { draft = draft.filter((x) => x !== t); drawEd(); };
                row.append(inp, off, del); box.appendChild(row);
            });
            if (draft.filter((t) => t.s === s).length < T.MAX_TAGS) {
                const addB = el("button", "tk-chip", "+ Add a " + title.toLowerCase() + " tag"); addB.type = "button";
                addB.onclick = () => { draft.push({ k: T.keyFor("new " + (s > 0 ? "good" : "work"), draft), l: "", s }); drawEd(); setTimeout(() => { const ins = [...box.querySelectorAll("input")].filter((i) => !i.value); if (ins.length) ins[ins.length - 1].focus(); }, 0); };
                box.appendChild(addB);
            }
        });
        const reset = el("button", "tk-chip", "Back to the starting tags"); reset.type = "button";
        reset.onclick = () => { draft = T.DEFAULT_TAGS.map((t) => Object.assign({}, t)); drawEd(); };
        box.appendChild(reset);
    };
    drawEd();
    $("tagsSave").onclick = async () => {
        const clean = draft.map((t) => ({ k: t.k, l: String(t.l || "").trim(), s: t.s, ...(t.off ? { off: 1 } : {}) })).filter((t) => t.l);
        // keep removed tags as hidden, so old taps still show their name
        TAGS.forEach((t) => { if (!clean.some((x) => x.k === t.k)) clean.push(Object.assign({}, t, { off: 1 })); });
        TAGS = T.cleanTags({ tags: clean }); d.close(); draw();
        try { await store.set("settings/track", { tags: TAGS, at: Date.now() }); toast("Tags saved."); } catch (e) { toast("Tags did not save (" + ((e && e.code) || "connection") + ")."); }
    };
    d.showModal();
}

/* ---------- drawing ---------- */
function watchProfiles() {
    const k = perKey(S.period); if (DEMO || profWatch[k]) return; profWatch[k] = 1;
    store.watch("profiles/" + k, (snap) => { if (snap.pending) return; PROFILES[k] = (snap.exists && snap.data && snap.data.kids) || {}; }, () => {});
}
function draw() {
    watchProfiles();
    drawPeriods(); drawSummary();
    [...$("views").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === S.view)));
    if (S.view !== "class") $("selBar").hidden = true;
    if (S.view === "pick") drawPick(); else if (S.view === "today") drawToday(); else drawClass();
    if (S.sheetFor && $("sheet").open && S.sheetTab === "today") drawSheet();
}
function watchDay() {
    if (unsubDay) unsubDay();
    unsubDay = store.watch("track/" + S.day, (snap) => {
        if (snap.pending) return;
        DOC = snap.exists ? snap.data : { day: S.day, ev: {} };
        if (!DEMO) status(snap.fromCache ? "Offline: taps save when back" : "Live", snap.fromCache ? "wait" : "ok");
        if (!rolling) draw();
    }, (e) => status("Could not load today (" + ((e && e.code) || "error") + ")", "bad"));
}

async function start() {
    store = DEMO ? demoStore() : await realStore();
    PERIODS = DEMO ? ["1st", "2nd", "4th", "5th", "6th"].map((p) => [p, ""]) : (await import("../data/weeks.js?v=61")).PERIODS;
    const user = await store.ready();
    if (!user) { location.replace("login.html"); return; }
    $("who").textContent = DEMO ? "Sample names, nothing is saved" : "Only you see this";
    if (DEMO) status("Sample class", "ok");
    const want = Q.get("period") || Q.get("per"), last = remember("period");
    S.period = [want, last].find((p) => p && PERIODS.some((x) => x[0] === p)) || PERIODS[0][0];
    [...$("views").children].forEach((b) => { b.onclick = () => { S.view = b.dataset.v; remember("view", S.view); if (S.view !== "class") S.sel = null; draw(); window.scrollTo({ top: 0 }); }; });
    $("sheetClose").onclick = closeSheet;
    $("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeSheet(); });   // tap outside the card
    $("sheet").addEventListener("close", () => { S.sheetFor = null; });
    $("selGo").onclick = () => { if (S.sel && S.sel.size) openSheet([...S.sel]); };
    $("tagsBtn").onclick = openTags;
    $("tagsClose").onclick = () => $("tagsDlg").close();
    store.watch("rosters/all", (snap) => {
        const ps = (snap.exists && snap.data && snap.data.periods) || {}; ROSTER = {};
        Object.keys(ps).forEach((k) => { if (Array.isArray(ps[k])) ROSTER[k] = ps[k].map((n) => String(n).slice(0, 60)).filter(Boolean); });
        draw();
    }, () => {});
    store.watch("settings/track", (snap) => { if (snap.pending) return; TAGS = T.cleanTags(snap.exists ? snap.data : null); draw(); }, () => {});
    if (!DEMO) store.watch("board/state", (snap) => {   // follow the board's period when it changes (never claim a period on our own)
        const p = snap.exists && snap.data && snap.data.period;
        if (typeof p !== "string" || p === boardPeriod || !PERIODS.some((x) => x[0] === p)) return;
        const first = !boardPeriod; boardPeriod = p;
        if (!first || !want) { if (S.period !== p) { S.period = p; S.pickName = ""; S.sel = null; remember("period", p); toast("Switched to " + p + " period, like the board."); } }
        draw();
    }, () => {});
    watchDay();
    // a new day (the page left open overnight), and the live restroom clocks
    setInterval(() => {
        if (T.localIso() !== S.day) { S.day = T.localIso(); DOC = null; S.pickName = ""; watchDay(); }
        document.querySelectorAll(".tk-out").forEach((b) => { const c = b.querySelector(".tk-outclock"); if (c) c.textContent = T.clock(Date.now() - +b.dataset.at); });
    }, 1000);
    draw();
    // a link from a student's profile opens that student
    const kidQ = Q.get("kid");
    if (kidQ) { let tries = 0; const t = setInterval(() => { if (names().includes(kidQ)) { clearInterval(t); openSheet([kidQ]); } else if (++tries > 40) clearInterval(t); }, 150); }
}
start();
