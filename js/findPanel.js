/* ==========================================
   Anchor Board — the Find panel ("Find a problem"). Eddie, 2026-11-24: the board is the focal point; a panel where he
   searches a standard or a topic, finds an example right away and puts it on the board, with a premium, smooth search
   that never lags, and that drags around like any other panel.

   It is an ordinary board panel (js/panels.js buildPanel "find"): on the shelf, floating, minimized to a chip, sized
   from its corners, styled from its gear. Up to four can be open at once (find, find2, find3, find4: Eddie, same day,
   "an anchor chart during quizzes or tests… more than one standard"), each with its own problem; the title bar names
   the standard it shows. "New panel" on a Find panel opens the next one, ready to search. Inside each are two faces:
     Search   type a standard ("7.9", "8.25a", "Alg I.10") or a topic ("two-step equations", "slope"). Results show as
              you type, drawn with their fractions, from the whole standards bank (js/findCore.js does the searching).
              ↑ ↓ and Enter work; a tap or Enter puts the problem on the board.
     Problem  the chosen problem, big, for the class: Hint (the bank's own steps, one at a time), Answer, Show Steps
              (the worked example, where the bank has one: js/walk.js, the board's Show Steps screen), Another one
              from the same standard, and back to Search.
   What is on the board is shared (tools.find = { find: { id, ans, hint, at }, find2: … }), so the board and the Remote
   show the same problems. What is typed, the course chips and the results stay on the device doing the searching.

   Speed: the bank is read once (js/walkBank.js, the same copy Show Steps uses), the index is built once, and each
   keystroke is a few milliseconds of plain string checks. The search UI is one node kept between redraws, so a redraw
   of the board's panels never drops what is typed or the place in the list.
========================================== */
import { buildIndex, search, browse, another, topicOf, courseFor, COURSES, plain, FIND_KEYS } from "./findCore.js?v=1";

const RECENT_KEY = "anchorboard-find-recent", RECENT_MAX = 6, PAGE = 30;
const LEVEL = { 1: "On-ramp", 2: "On level", 3: "Stretch" };
const IC = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    steps: '<path d="M4 18h4v-4h4v-4h4V6h4"/>',
    next: '<path d="M5 12h12M13 7l5 5-5 5"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
};
const svg = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + "</svg>";

/* ---------- the data: loaded once, for every Find panel on this page ---------- */
let IX = null, ITEMS = null, loading = null, walkSet = null, walkDone = false;
// The bank, its walkthroughs and the standards' wording are big, so they load the first time a Find panel needs them,
// never with the board itself. walkBank.js is the same copy Show Steps uses (one download, one cache).
const listeners = new Set();
const changed = () => listeners.forEach((f) => f());
/** Start reading the bank now (quietly, when the board has a moment), so the first search is instant. */
export function preloadFind() {
    if (loading) return loading;
    loading = Promise.all([import("./walkBank.js?v=5"), import("../data/standards.js?v=58")]).then(([wb, sd]) => wb.loadWalkItems().then((items) => {
        const walkOf = wb.walkOf;
        ITEMS = items; BYID = new Map(items.map((x) => [x.id, x])); IX = buildIndex(items, sd.STANDARDS); changed();
        // Which problems have a worked example (Show Steps): built in small slices so the board never stutters
        walkSet = new Set(); let i = 0;
        const slice = () => {
            const end = Math.min(items.length, i + 150);
            for (; i < end; i++) { try { if (walkOf(items[i]).ok) walkSet.add(items[i].id); } catch (e) { /* that one has none */ } }
            if (i < items.length) idle(slice); else { walkDone = true; changed(); }
        };
        idle(slice);
        return IX;
    })).catch((e) => { loading = null; throw e; });
    return loading;
}
const idle = (fn) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 16));
let BYID = null;
const itemOf = (id) => (BYID ? BYID.get(id) || null : null);
const hasWalk = (id) => !!(walkSet && walkSet.has(id));

/* ---------- recent picks on this device ---------- */
function recent() { try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : []; } catch (e) { return []; } }
function remember(id) { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id].concat(recent().filter((x) => x !== id)).slice(0, RECENT_MAX))); } catch (e) { /* private window: fine */ } }

const node = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const btn = (cls, html, label) => { const b = node("button", cls); b.type = "button"; b.innerHTML = html; if (label) { b.title = label; b.setAttribute("aria-label", label); } return b; };
/** The bank's writing, drawn the way the board draws it: {3/4} as a fraction, [[…]] as a figure, § as a dollar sign
    and x^{2} as a raised 2. */
function R(t) {
    const f = document.createDocumentFragment();
    String(t == null ? "" : t).replace(/§/g, "$").split(/\^\{([^{}]{1,12})\}/).forEach((part, i) => {
        if (i % 2) { const s = document.createElement("sup"); s.textContent = part; f.appendChild(s); } else if (part) f.appendChild(api.rich(part));
    });
    return f;
}
const stateOf = (T, k) => ((T && T.find) || {})[k] || { id: "", ans: false, hint: 0, at: 0 };

/** The title bar of a Find panel: the standard it shows, so a row of them reads like anchor charts. */
export function findTitle(k, T) {
    const f = stateOf(T, k), x = f.id && itemOf(f.id);
    if (!x) return "";
    let t = topicOf(x.std); if (t.length > 30) t = t.slice(0, 30).replace(/[\s&,]+\S*$/, "") + "\u2026";   // short enough for the title bar
    return x.std + (x.part || "") + "  " + t;
}
/** What a minimized Find panel's chip says. */
export function findChip(k, T) {
    const f = stateOf(T, k), x = f.id && itemOf(f.id);
    if (!f.id) return { v: "Search" };
    return { v: (x ? x.std : f.id.split("-")[0]) + (f.ans ? " · answer up" : ""), tone: f.ans ? "green" : "" };
}

/* ---------- one Find panel on this device: its kept node and its own search ---------- */
const panels = new Map();   // key → panel
let api = null, wantFocus = "";
/** The body of Find panel k. Called on every redraw of the board's panels; returns the same node each time. */
export function findBody(a, k = "find") {
    api = a;
    let p = panels.get(k); if (!p) { p = makePanel(k); panels.set(k, p); }
    p.refresh();
    if (!IX) preloadFind().catch(() => p.failed());
    return p.root;
}

function makePanel(key) {
    const local = { view: "", lastId: null, q: "", course: null, sel: 0, shown: PAGE, scroll: 0, focus: false };
    let raf = 0, painted = "", shownSig = "";
    const root = node("div", "fp"); root.dataset.key = key;
    root.addEventListener("pointerdown", (e) => e.stopPropagation());   // a tap inside never starts a panel drag
    /* search face */
    const sf = node("div", "fp-search");
    const bar = node("label", "fp-bar"); bar.innerHTML = svg("search");
    const input = node("input", "fp-in"); input.id = key === "find" ? "findIn" : "findIn-" + key; input.type = "search"; input.autocomplete = "off"; input.spellcheck = false; input.enterKeyHint = "go";
    input.placeholder = "Search 7.9, slope, two-step equations…"; input.setAttribute("aria-label", "Search problems by standard or topic");
    input.setAttribute("role", "combobox"); input.setAttribute("aria-expanded", "true"); input.setAttribute("aria-controls", "findList-" + key);
    const clear = btn("fp-clear", svg("x"), "Clear the search"); clear.hidden = true;
    bar.append(input, clear);
    const courses = node("div", "fp-courses"); courses.setAttribute("role", "group"); courses.setAttribute("aria-label", "Course");
    const sugg = node("div", "fp-sugg");
    const list = node("div", "fp-list"); list.id = "findList-" + key; list.setAttribute("role", "listbox"); list.setAttribute("aria-label", "Problems");
    const foot = node("p", "fp-foot");
    sf.append(bar, courses, sugg, list, foot);
    /* problem face */
    const pf = node("div", "fp-show");
    const q = node("div", "fp-q"), hints = node("ol", "fp-hints"), ans = node("div", "fp-ans"), acts = node("div", "fp-acts");
    pf.append(q, hints, ans, acts);
    root.append(sf, pf);

    const T = () => api.S.tools, me = () => stateOf(T(), key);
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { raf = 0; paintSearch(); }); };
    input.addEventListener("input", () => { local.q = input.value; local.sel = 0; local.shown = PAGE; local.scroll = 0; schedule(); });
    input.addEventListener("focus", () => { local.focus = true; if (!IX) preloadFind().catch(() => {}); });
    input.addEventListener("blur", () => { setTimeout(() => { if (document.activeElement !== input && root.isConnected) local.focus = false; }, 0); });
    input.addEventListener("keydown", (e) => {
        const rows = list.querySelectorAll(".fp-row");
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!rows.length) return; local.sel = (local.sel + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length; markSel(true); }
        else if (e.key === "Enter") { e.preventDefault(); const r = rows[local.sel]; if (r) r.click(); }
        else if (e.key === "Escape") { e.preventDefault(); if (input.value) { input.value = ""; local.q = ""; schedule(); } else if (me().id) { local.view = "show"; refresh(); } else input.blur(); }
        e.stopPropagation();
    });
    clear.onclick = (e) => { e.preventDefault(); input.value = ""; local.q = ""; local.sel = 0; schedule(); input.focus(); };
    list.addEventListener("scroll", () => { local.scroll = list.scrollTop; }, { passive: true });
    listeners.add(() => { if (root.isConnected) { paintSearch(); paintShow(); retitle(); } });
    /** The bank arrived after the panel was drawn: put the standard in the title bar now. */
    function retitle() {
        const h = root.closest(".card") && root.closest(".card").querySelector("h3"), t = findTitle(key, T());
        if (h && t && h.firstChild && h.firstChild.nodeType === 3 && h.firstChild.nodeValue !== t) h.firstChild.nodeValue = t;
    }

    function refresh() {
        const f = me();
        if (local.course == null) local.course = courseFor(api.S.cls);
        if (f.id !== local.lastId) { local.lastId = f.id; local.view = f.id ? "show" : "search"; }
        if (!f.id) local.view = "search";
        root.dataset.view = local.view;
        paintShow(); paintSearch();
        if (wantFocus === key) { wantFocus = ""; local.focus = true; }
        // A redraw moved this node: keep the list where it was and the typing where it was
        requestAnimationFrame(() => {
            if (list.isConnected) list.scrollTop = local.scroll;
            if (local.focus && local.view === "search" && input.isConnected && document.activeElement !== input) input.focus({ preventScroll: true });
        });
    }
    function failed() { list.textContent = ""; list.appendChild(node("p", "fp-empty", "The problem bank didn't load. Check the wifi, then tap the search box again.")); }

    /* the search face */
    function paintSearch() {
        if (local.view !== "search") { painted = ""; return; }
        if (input.value !== local.q && document.activeElement !== input) input.value = local.q;
        clear.hidden = !local.q;
        const k2 = JSON.stringify([local.q, local.course, local.shown, !!IX, walkDone, recent().join()]);
        if (k2 === painted) { markSel(false); return; }
        painted = k2;
        courses.textContent = "";
        COURSES.forEach(([c, t]) => { const b = node("button", "fp-chip", t); b.type = "button"; b.setAttribute("aria-pressed", String(local.course === c)); b.onclick = () => { local.course = c; local.sel = 0; local.shown = PAGE; schedule(); }; courses.appendChild(b); });
        sugg.textContent = ""; list.textContent = ""; foot.textContent = "";
        if (!IX) { for (let i = 0; i < 4; i++) list.appendChild(node("div", "fp-skel")); foot.textContent = "Getting the problem bank…"; return; }
        const qq = local.q.trim();
        if (!qq) { browseFace(); return; }
        const r = search(IX, qq, { course: local.course, limit: local.shown });
        if (r.std) {   // a standard by its code: say which, then its problems
            const head = node("div", "fp-stdhead");
            head.append(node("span", "fp-code", r.std.code + (r.part ? r.part : "")), node("b", null, r.std.topic), node("span", "fp-n", r.total + " problems"));
            sugg.appendChild(head);
        }
        if (r.topics.length) {
            const row = node("div", "fp-topics");
            r.topics.forEach((s) => { const b = node("button", "fp-topic"); b.type = "button"; b.append(node("span", "fp-code", s.code), node("span", null, s.topic)); b.onclick = () => setQuery(s.code); row.appendChild(b); });
            sugg.appendChild(row);
        }
        if (!r.rows.length) {
            const e = node("div", "fp-empty");
            if (r.topics.length) e.appendChild(node("p", null, "Pick a standard above."));
            else if (local.course) {
                e.appendChild(node("p", null, "Nothing for “" + qq + "” in " + (COURSES.find((c) => c[0] === local.course) || [0, ""])[1] + "."));
                const all = node("button", "fp-chip", "Search all courses"); all.type = "button"; all.onclick = () => { local.course = ""; schedule(); }; e.appendChild(all);
            } else e.appendChild(node("p", null, "No problems match “" + qq + "”. Try a standard like 7.9, or a word like slope, percent or angles."));
            list.appendChild(e); return;
        }
        r.rows.forEach((row, i) => list.appendChild(resultRow(row.item, i)));
        if (r.total > r.rows.length) { const more = node("button", "fp-more", "Show " + Math.min(PAGE, r.total - r.rows.length) + " more"); more.type = "button"; more.onclick = () => { local.shown += PAGE; schedule(); }; list.appendChild(more); }
        foot.textContent = r.total + (r.total === 1 ? " problem" : " problems") + " · ↑ ↓ to choose, Enter to put it up";
        if (local.sel >= r.rows.length) local.sel = 0;
        markSel(false);
    }
    function setQuery(t) { local.q = t; local.sel = 0; local.shown = PAGE; local.scroll = 0; input.value = t; schedule(); input.focus({ preventScroll: true }); }
    function markSel(scroll) {
        list.querySelectorAll(".fp-row").forEach((r, i) => { const on = i === local.sel; r.classList.toggle("sel", on); r.setAttribute("aria-selected", String(on)); if (on && scroll) r.scrollIntoView({ block: "nearest" }); });
    }
    /** The empty search box: recent picks on this device, then every standard of the course to browse. */
    function browseFace() {
        const rec = recent().map(itemOf).filter(Boolean);
        if (rec.length) {
            sugg.appendChild(node("p", "fp-label", "Recently on the board"));
            const row = node("div", "fp-recent");
            rec.forEach((x) => { const b = node("button", "fp-rec"); b.type = "button"; b.append(node("span", "fp-code", x.std)); const t = node("span", "fp-rect"), pq = plain(x.q); t.textContent = pq.slice(0, 44) + (pq.length > 44 ? "…" : ""); b.appendChild(t); b.onclick = () => put(x.id); row.appendChild(b); });
            sugg.appendChild(row);
        }
        list.appendChild(node("p", "fp-label", "Browse by standard"));
        browse(IX, local.course).forEach((s) => {
            const b = node("button", "fp-std"); b.type = "button";
            b.append(node("span", "fp-code", s.code), node("span", "fp-stdt", s.topic), node("span", "fp-n", String(s.n)));
            b.onclick = () => setQuery(s.code); list.appendChild(b);
        });
        foot.textContent = "Type a standard or a topic. Press / to search from anywhere.";
    }
    /** One result: its standard, the problem as the class will see it (fractions drawn), its level, and Steps if it has a worked example. */
    function resultRow(x, i) {
        const b = node("button", "fp-row"); b.type = "button"; b.setAttribute("role", "option");
        const side = node("span", "fp-side"); side.appendChild(node("span", "fp-code", x.std + (x.part || "")));
        const body = node("span", "fp-rb");
        const top = node("span", "fp-rtop"); top.appendChild(node("span", "fp-rtopic", topicOf(x.std)));
        top.appendChild(node("span", "fp-lvl l" + (x.lvl || 2), LEVEL[x.lvl] || ""));
        if (hasWalk(x.id)) { const s = node("span", "fp-walk"); s.innerHTML = svg("play") + "<span>Steps</span>"; s.title = "Has a worked example for Show Steps"; top.appendChild(s); }
        const qd = node("span", "fp-rq");
        qd.appendChild(R(String(x.q).replace(/\[\[[\s\S]*?\]\]/g, " ")));
        if (/\[\[/.test(x.q)) qd.appendChild(node("span", "fp-fig", "+ figure"));
        body.append(top, qd);
        const go = node("span", "fp-go"); go.innerHTML = svg("next");
        b.append(side, body, go);
        b.onclick = () => put(x.id);
        b.onpointerenter = () => { if (local.sel !== i) { local.sel = i; markSel(false); } };
        return b;
    }

    /* putting a problem up */
    function put(id) {
        const t = T(); t.find = Object.assign({}, t.find, { [key]: { id, ans: false, hint: 0, at: Date.now() } });
        if (t.min) delete t.min[key];
        remember(id);
        local.view = "show"; local.lastId = id; local.focus = false;
        if (document.activeElement === input) input.blur();
        api.push();
    }
    function setMe(patch) { const t = T(); t.find = Object.assign({}, t.find, { [key]: Object.assign({}, me(), patch) }); api.push(); }

    /* the problem face */
    function paintShow() {
        const f = me(), x = f.id ? itemOf(f.id) : null, F = api.find;
        const sig = JSON.stringify([local.view, f.id, f.ans, f.hint, !!x, hasWalk(f.id), F ? F.stepsOk(f.id) : 0, F ? F.mode() : "", nextFree()]);
        if (sig === shownSig) return; shownSig = sig;
        [q, hints, ans, acts].forEach((n) => { n.textContent = ""; });
        if (local.view !== "show" || !f.id) return;
        if (!x) { q.appendChild(node("p", "fp-wait", IX ? "That problem isn't in the bank anymore." : "Getting the problem…")); if (IX) acts.appendChild(searchBtn()); return; }
        q.appendChild(R(x.q));
        const steps = Array.isArray(x.steps) ? x.steps : [];
        steps.slice(0, f.hint).forEach((s, i) => { const li = node("li", i === f.hint - 1 ? "new" : ""); li.appendChild(R(s)); hints.appendChild(li); });
        hints.hidden = !f.hint;
        if (f.ans) { ans.appendChild(node("span", "fp-alab", "Answer")); const v = node("span", "fp-aval"); v.appendChild(R(x.a)); ans.appendChild(v); }
        ans.hidden = !f.ans;
        // the teacher's buttons: quiet on the board, and gone with the rest of the controls when nobody touches it
        if (steps.length && f.hint < steps.length) { const h = act("bulb", f.hint ? "Next hint" : "Hint", () => setMe({ hint: f.hint + 1 })); h.appendChild(node("small", null, (f.hint + 1) + "/" + steps.length)); acts.appendChild(h); }
        else if (f.hint) acts.appendChild(act("bulb", "Hide hints", () => setMe({ hint: 0 })));
        acts.appendChild(act("eye", f.ans ? "Hide answer" : "Answer", () => setMe({ ans: !f.ans }), f.ans ? "on" : ""));
        if (hasWalk(x.id) && F && F.canSteps(x.id)) acts.appendChild(act("play", "Show Steps", () => F.showSteps(x.id), "amber"));
        acts.appendChild(act("next", "Another", () => { const n = another(IX, x.id); if (n) { remember(n.item.id); setMe({ id: n.item.id, ans: false, hint: 0, at: Date.now() }); } }));
        acts.appendChild(searchBtn());
        const nk = nextFree(); if (nk) acts.appendChild(act("plus", "New panel", () => openNext(nk, key)));
    }
    function act(ic, t, fn, cls) { const b = btn("fp-act" + (cls ? " " + cls : ""), svg(ic) + "<span>" + t + "</span>"); b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; }
    function searchBtn() {
        return act("search", "Search", () => {
            local.view = "search"; local.focus = true; root.dataset.view = "search"; shownSig = ""; painted = "";
            paintShow(); paintSearch(); requestAnimationFrame(() => { input.focus({ preventScroll: true }); input.select(); });
        });
    }
    return { root, refresh, failed, focus: () => { local.focus = true; if (local.view === "search") input.focus({ preventScroll: true }); }, isSearch: () => local.view === "search" };
}

/* ---------- more than one ---------- */
/** The next Find panel that isn't open yet, or "" when all four are. */
function nextFree() { const on = (api && api.S.tools.on) || {}; return FIND_KEYS.find((k) => !on[k]) || ""; }
/** Open another Find panel, ready to search (the board places it in an open spot, like any new panel). */
function openNext(k, from) {
    if (!k || !api.find || !api.find.open) return;
    wantFocus = k; api.find.open(k, from);
}

// "/" anywhere on the page jumps to the search box of a Find panel that is searching (like a site search)
if (typeof document !== "undefined") document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || t.isContentEditable)) return;
    const p = [...panels.values()].find((x) => x.root.isConnected && x.isSearch()); if (!p) return;
    e.preventDefault(); p.focus();
});
