/* ==========================================
   Anchor Board — YouTube music (Eddie, 2026-11-24: "a panel so you can add YouTube videos… search YouTube videos to
   link certain instrumentals and play it in the background… minimize it so it goes to the top of the board").

     the pill      frosted glass at the top centre of the projected board (in the top bar on the Remote): what is
                   playing, play/pause, and a tap opens the panel. It fades with the board's other corners.
     the panel     frosted glass under the pill: the video, play/pause, loop, volume, then "Search YouTube or paste a
                   link", quick searches, results and the last few picks. The minimize button tucks it back into the pill.

   It rides on the board's shared sound settings (S.sound, js/sound.js), so it plays where the built-in music plays:
   the board, unless the Remote picked "This device". Music on/off, the M key and the music volume work for both.
     S.sound.src  "yt" while a YouTube pick is the music, "gen" for the built-in styles
     S.sound.yt   { id, list, t (title), ch (channel), e (last error) }
     S.sound.ytr  the last picks (up to 8), S.sound.ytl  loop a single video (default on)

   The library (Eddie, same day: "save that specific YouTube video link so you can easily click it… start it for a
   specific class… categorize it… link it as something I would remember it by"): a video saved with the teacher's own
   name for it (never the link), in a folder they make, optionally marked for class periods. It lives in the teacher's
   account at teacher/{uid}/music/library ({ f: [{ k, n }], s: [{ k, id, list, n, f, p: [periods] }] }); the sub and
   demo pages keep it in the tab only. The Saved tab opens on "this class" when the period has saves.

   Search uses the YouTube Data API with a key the teacher saves once in their own account
   (teacher/{uid}/keys/youtube, a folder linked screens cannot read). The key is never in this public repo.
   Without a key, a pasted link or video ID still plays, and the search opens YouTube in a new tab.
   Search asks YouTube for strict SafeSearch and embeddable videos only.
========================================== */

const KEY_PATH = "keys/youtube";
const OPEN_KEY = "anchorboard-yt-open";
const RECENT_MAX = 8;
const LIB_PATH = "music/library", TAB_KEY = "anchorboard-yt-tab", LIB_MAX = 150, FOLD_MAX = 30;
const QUICK = [["Lo-fi", "lofi instrumental beats for studying"], ["Piano", "calm piano instrumental music"], ["Jazz", "smooth jazz instrumental"],
    ["Classical", "classical music for studying"], ["Acoustic", "acoustic guitar instrumental"], ["Video game", "video game music instrumental for studying"]];
const ERRORS = {
    "2": "That link doesn't point to a video. Check it and try again.",
    "5": "This video can't play in this browser. Pick another.",
    "100": "That video was removed or made private. Pick another.",
    "101": "YouTube won't play this one here. Its owner may not allow it on other sites. Pick another.",
    "150": "YouTube won't play this one here. Its owner may not allow it on other sites. Pick another.",
    "load": "YouTube didn't load on the device playing music. The school network may block it there."
};

/* ---------- links ---------- */
const ID_RE = /^[A-Za-z0-9_-]{11}$/, LIST_RE = /^[A-Za-z0-9_-]{10,64}$/;
/** A YouTube link, a video ID or a playlist link -> { id, list }, or null. */
export function parseYt(text) {
    const s = String(text || "").trim();
    if (!s) return null;
    if (ID_RE.test(s)) return { id: s, list: "" };
    let u;
    try { u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); } catch (e) { return null; }
    const host = u.hostname.replace(/^www\.|^m\.|^music\./, "");
    if (!/^(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(host)) return null;
    let id = "";
    if (host === "youtu.be") id = u.pathname.split("/")[1] || "";
    else if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/); if (m) id = m[1]; }
    const list = u.searchParams.get("list") || "";
    const out = { id: ID_RE.test(id) ? id : "", list: LIST_RE.test(list) ? list : "" };
    return out.id || out.list ? out : null;
}
/** The shape saved in the board state; anything else is dropped. */
export function cleanYt(o) {
    if (!o || typeof o !== "object") return null;
    const id = typeof o.id === "string" && ID_RE.test(o.id) ? o.id : "";
    const list = typeof o.list === "string" && LIST_RE.test(o.list) ? o.list : "";
    if (!id && !list) return null;
    const str = (x, n) => (typeof x === "string" ? x.slice(0, n) : "");
    const out = { id, list, t: str(o.t, 140), ch: str(o.ch, 80) };
    const e = str(o.e, 8); if (e) out.e = e;
    return out;
}
export function cleanRecent(a) { return (Array.isArray(a) ? a : []).map(cleanYt).filter(Boolean).map((x) => { delete x.e; return x; }).slice(0, RECENT_MAX); }
const LKEY_RE = /^[a-z0-9]{4,12}$/;
const tidy = (x, n) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, n) : "");
/** The saved library, cleaned: folders { k, n } and saves { k, id, list, n (the teacher's name for it), f (folder key), p (periods) }. */
export function cleanLib(o) {
    const f = [], fk = new Set(), s = [], sk = new Set();
    (o && Array.isArray(o.f) ? o.f : []).forEach((x) => {
        const k = x && typeof x.k === "string" && LKEY_RE.test(x.k) ? x.k : "", n = tidy(x && x.n, 40);
        if (k && n && !fk.has(k) && f.length < FOLD_MAX) { fk.add(k); f.push({ k, n }); }
    });
    (o && Array.isArray(o.s) ? o.s : []).forEach((x) => {
        const y = cleanYt(x); if (!y) return;
        const k = typeof x.k === "string" && LKEY_RE.test(x.k) ? x.k : "", n = tidy(x.n, 60);
        if (!k || !n || sk.has(k) || s.length >= LIB_MAX) return;
        sk.add(k);
        const p = [...new Set((Array.isArray(x.p) ? x.p : []).filter((v) => typeof v === "string" && v && v.length <= 12))].slice(0, 12);
        s.push({ k, id: y.id, list: y.list, n, f: fk.has(x.f) ? x.f : "", p });
    });
    return { f, s };
}
const newKey = () => Math.random().toString(36).slice(2, 10).padEnd(6, "0");
const same = (a, b) => !!a && !!b && a.id === b.id && a.list === b.list;
const thumbOf = (y) => (y && y.id ? "https://i.ytimg.com/vi/" + y.id + "/mqdefault.jpg" : "");
const nameOf = (y) => (y && y.t) || (y && y.list && !y.id ? "YouTube playlist" : "YouTube video");
/* YouTube's search titles come HTML-escaped ("Lo-fi &amp; chill"). */
function unescape(s) { const t = document.createElement("textarea"); t.innerHTML = String(s || ""); return t.value; }

/* ---------- small helpers ---------- */
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const svg = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
const IC = {
    note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
    min: '<path d="M6 15l6-6 6 6"/>',
    open: '<path d="M6 9l6 6 6-6"/>',
    loop: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    vol: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
    ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    mark: '<path d="M6 3.5h12v17l-6-4.2-6 4.2z"/>',
    marked: '<path d="M6 3.5h12v17l-6-4.2-6 4.2z" fill="currentColor"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'
};
function btn(cls, icon, label, text) {
    const b = el("button", cls); b.type = "button"; b.innerHTML = (icon ? svg(IC[icon]) : "") + (text ? "<span></span>" : "");
    if (text) b.querySelector("span").textContent = text;
    b.setAttribute("aria-label", label); b.title = label; return b;
}

/* ---------- the YouTube player (only on the device that plays) ---------- */
let apiP = null;
function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (apiP) return apiP;
    apiP = new Promise((res, rej) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { try { if (prev) prev(); } catch (e) { /* not ours */ } res(window.YT); };
        const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true;
        s.onerror = () => rej(new Error("load"));
        document.head.appendChild(s);
        setTimeout(() => rej(new Error("load")), 20000);
    }).catch((e) => { apiP = null; throw e; });
    return apiP;
}

/**
 * Mount the pill and the panel. A = {
 *   S, push(), quiet(), store() (null on a guest page), playsHere(), readOnly(), guest, slot() (top-bar element to sit before),
 *   unlock() (wake the board's sound), refresh() (redraw the Sound menu)
 * }
 */
export function mountYt(A) {
    let open = false; try { open = localStorage.getItem(OPEN_KEY) === "1"; } catch (e) { /* closed */ }
    let player = null, playerP = null, loaded = null, loadedAt = 0, state = -1, blocked = false, duckT = 0, ducked = false;
    let key = "", keyOff = null, results = [], searching = false, searchMsg = "", setup = false, lastQ = "";
    // the library: what is saved, which tab and folder show, and the save form (edit) or folder form (fedit) when open
    let lib = { f: [], s: [] }, libOff = null, libMsg = "", tab = "", fold = null, foldPer = "", edit = null, fedit = null;
    const subs = [];   // others that show the music's state (Spotlight's Music button)
    try { tab = localStorage.getItem(TAB_KEY) || ""; } catch (e) { /* default */ }

    /* --- the pill --- */
    const pill = el("div", "ytpill"); pill.id = "ytPill";
    const pOpen = el("button", "ytp-open"); pOpen.type = "button";
    pOpen.innerHTML = '<span class="ytp-ic">' + svg(IC.note) + '</span><span class="ytp-t"></span><span class="ytp-ch">' + svg(IC.open) + "</span>";
    const pPlay = btn("ytp-play", "play", "Play");
    pill.append(pOpen, pPlay);
    pOpen.onclick = () => setOpen(!open);
    pPlay.onclick = () => togglePlay();

    /* --- the panel --- */
    const panel = el("section", "ytpanel"); panel.id = "ytPanel"; panel.setAttribute("aria-label", "YouTube music"); panel.hidden = true;
    const head = el("div", "yth");
    const hT = el("b", null, "Music"); const hSub = el("small", null, "YouTube");
    const hText = el("div", "ytht"); hText.append(hT, hSub);
    const hMin = btn("ytb ytmin", "min", "Minimize to the top");
    hMin.onclick = () => setOpen(false);
    head.append(el("span", "ytp-ic"), hText, hMin); head.firstChild.innerHTML = svg(IC.note);

    const now = el("div", "ytnow");
    const vid = el("div", "ytvid"); const thumb = el("img"); thumb.alt = ""; thumb.loading = "lazy"; vid.appendChild(thumb);
    const vEmpty = el("div", "ytvempty"); vEmpty.innerHTML = svg(IC.note) + "<span>Nothing picked yet</span>"; vid.appendChild(vEmpty);
    const meta = el("div", "ytmeta"); const mT = el("p", "ytmt"); const mC = el("p", "ytmc"); meta.append(mT, mC);
    const ctl = el("div", "ytctl");
    const bPlay = btn("ytbig", "play", "Play");
    bPlay.onclick = () => togglePlay();
    const bLoop = btn("ytb ytloop", "loop", "Loop this video", "Loop");
    bLoop.onclick = () => { A.S.sound.ytl = !A.S.sound.ytl; A.push(); };
    const vol = el("label", "ytvol"); vol.innerHTML = svg(IC.vol);
    const vr = el("input"); vr.type = "range"; vr.min = "0"; vr.max = "100"; vr.step = "5"; vr.setAttribute("aria-label", "Music volume"); vol.appendChild(vr);
    vr.oninput = () => { A.S.sound.mv = +vr.value / 100; volume(); A.quiet(); if (A.refresh) A.refresh(); };
    const bSave = btn("ytb ytsave", "mark", "Save this video to your library", "Save");
    bSave.onclick = () => { const y = A.S.sound.yt; if (y) openEdit(savedOf(y) || { id: y.id, list: y.list, n: y.t && y.t !== nameOf(null) ? y.t : "" }); };
    ctl.append(bPlay, bLoop, bSave, vol);
    const note = el("p", "ytnote"); note.setAttribute("role", "status");
    now.append(vid, meta, ctl, note);

    const find = el("form", "ytfind"); find.setAttribute("role", "search");
    const fi = el("input"); fi.type = "search"; fi.placeholder = "Search YouTube or paste a link"; fi.setAttribute("aria-label", "Search YouTube or paste a link"); fi.enterKeyHint = "search"; fi.autocomplete = "off";
    const fb = btn("ytgo", "search", "Search");
    find.append(fi, fb);
    find.onsubmit = (e) => { e.preventDefault(); go(fi.value); };
    fi.addEventListener("focus", () => { if (fi.value) fi.select(); });   // a paste replaces the last search words
    const quick = el("div", "ytquick"); quick.setAttribute("role", "group"); quick.setAttribute("aria-label", "Quick searches");
    QUICK.forEach(([label, q]) => { const b = el("button", "ytchip", label); b.type = "button"; b.onclick = () => { fi.value = label + " instrumental"; search(q); }; quick.appendChild(b); });
    const msg = el("p", "ytmsg"); msg.setAttribute("role", "status");
    const list = el("div", "ytlist");
    const recentH = el("p", "ytsec", "Recent"); const recent = el("div", "ytlist ytrecent");
    const keyBox = el("div", "ytkey");
    const tabs = el("div", "yttabs"); tabs.setAttribute("role", "tablist");
    const tSaved = el("button", "yttab"), tFind = el("button", "yttab", "Find");
    [tSaved, tFind].forEach((b, i) => { b.type = "button"; b.setAttribute("role", "tab"); b.onclick = () => setTab(i ? "find" : "saved"); });
    tabs.append(tSaved, tFind);
    const savedBox = el("div", "ytsaved"), editBox = el("form", "ytedit");
    editBox.onsubmit = (e) => { e.preventDefault(); commitEdit(); };
    panel.append(head, now, tabs, editBox, savedBox, find, quick, msg, list, recentH, recent, keyBox);

    const host = el("div", "ythost"); host.id = "ytHost"; host.setAttribute("aria-hidden", "true");
    const frame = el("div"); frame.id = "ytFrame"; host.appendChild(frame);
    document.body.append(panel, host);
    place();

    /* --- where things sit --- */
    function isBoard() { return document.body.classList.contains("board"); }
    function place() {
        // On the projected board the pill floats at the top centre; on the Remote it sits in the top bar.
        if (A.readOnly()) { pill.remove(); return; }
        const slot = isBoard() ? null : A.slot();
        if (slot) { pill.classList.add("inbar"); if (pill.nextSibling !== slot) slot.before(pill); }
        else { pill.classList.remove("inbar"); if (pill.parentNode !== document.body) document.body.appendChild(pill); }
        panel.classList.toggle("onboard", isBoard());
        // Spotlight (the Board Builder's full-screen tab) opens the panel from its toolbar, so it pops up above that
        const spot = isSpot(); panel.classList.toggle("onspot", spot);
        const t = spot ? "Minimize" : "Minimize to the top";
        if (hMin.title !== t) { hMin.title = t; hMin.setAttribute("aria-label", t); hMin.innerHTML = svg(spot ? IC.open : IC.min); }
    }
    function isSpot() { return document.body.classList.contains("spotmode"); }
    function setOpen(v) {
        open = !!v; try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch (e) { /* this visit only */ }
        draw();
        if (open) { if (!key && !keyOff) watchKey(); watchLib(); setTimeout(() => { if (document.activeElement === document.body && !A.S.sound.yt) fi.focus(); }, 60); }
    }

    /* --- picking and playing --- */
    function pick(y) {
        const c = cleanYt(y); if (!c) return;
        delete c.e;
        const so = A.S.sound;
        so.yt = c; so.src = "yt"; so.music = true;
        so.ytr = cleanRecent([c].concat((so.ytr || []).filter((r) => !same(r, c))));
        blocked = false;
        if (A.unlock) A.unlock();
        A.push();
    }
    function togglePlay() {
        const so = A.S.sound;
        if (!so.yt) { fi.focus(); return; }
        if (so.src !== "yt") { so.src = "yt"; so.music = true; }
        else so.music = !so.music;
        if (A.unlock) A.unlock();
        A.push();
    }
    function go(text) {
        const y = parseYt(text);
        if (y) { fi.value = ""; results = []; searchMsg = ""; pick(y); return; }
        if (String(text || "").trim()) search(String(text).trim());
    }
    async function search(q) {
        lastQ = q;
        if (!key) { searchMsg = "nokey"; results = []; draw(); return; }
        searching = true; searchMsg = ""; draw();
        try {
            const u = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=strict&maxResults=12&q="
                + encodeURIComponent(q) + "&key=" + encodeURIComponent(key);
            const r = await fetch(u), d = await r.json().catch(() => ({}));
            if (!r.ok) {
                const why = d && d.error && d.error.errors && d.error.errors[0] && d.error.errors[0].reason || "";
                searchMsg = /quota/i.test(why) ? "Today's YouTube search limit is used up. Paste a link, or search again tomorrow."
                    : /key|forbidden|referer|blocked/i.test(why) || r.status === 400 || r.status === 403 ? "YouTube turned the search key down. Check it under Search key below." : "YouTube search didn't answer. Try again.";
                results = [];
            } else {
                results = (d.items || []).map((it) => cleanYt({ id: it.id && it.id.videoId, t: unescape(it.snippet && it.snippet.title), ch: unescape(it.snippet && it.snippet.channelTitle) })).filter(Boolean);
                searchMsg = results.length ? "" : "No videos found. Try other words.";
            }
        } catch (e) { searchMsg = "YouTube search didn't answer. Check the wifi and try again."; results = []; }
        searching = false; draw();
    }
    function watchKey() {
        const st = A.store && A.store();
        if (!st || A.guest || !st.watch) return;
        try { keyOff = st.watch(KEY_PATH, (snap) => { if (snap.pending) return; key = snap.exists && snap.data && typeof snap.data.key === "string" ? snap.data.key.trim() : ""; draw(); }, () => {}) || true; } catch (e) { keyOff = true; }
    }
    async function saveKey(v) {
        const st = A.store && A.store(); if (!st) return false;
        const k = String(v || "").trim();
        if (k && !/^[A-Za-z0-9_-]{30,60}$/.test(k)) return false;
        try { await st.save(KEY_PATH, { key: k, at: new Date().toISOString() }); key = k; return true; } catch (e) { return false; }
    }

    /* --- the library --- */
    function watchLib() {
        const st = A.store && A.store();
        if (libOff || !st || !st.watch) return;
        try {
            libOff = st.watch(LIB_PATH, (snap) => { if (snap.pending) return; lib = cleanLib(snap.exists ? snap.data : null); draw(); }, () => { libMsg = "Your saved videos didn't load. Check the wifi."; draw(); }) || true;
        } catch (e) { libOff = null; }
    }
    const libOn = () => !!(A.store && A.store());
    function saveLib(next) {
        lib = cleanLib(next); draw();
        const st = A.store && A.store(); if (!st) return;
        Promise.resolve(st.save(LIB_PATH, { f: lib.f, s: lib.s, at: new Date().toISOString() })).then(() => { if (libMsg) { libMsg = ""; draw(); } })
            .catch(() => { libMsg = "That change didn't save. Check the wifi and try again."; draw(); });
    }
    /** The folder showing: the one tapped, else this period's saves when it has any, else all. */
    function effFold() {
        if (A.S.period !== foldPer) { foldPer = A.S.period; fold = null; }   // a new period starts on its own music
        if (fold === "class" || fold === "") return fold;
        if (fold && lib.f.some((x) => x.k === fold)) return fold;
        return lib.s.some((x) => x.p.includes(A.S.period)) ? "class" : "";
    }
    const savedOf = (y) => (y ? lib.s.find((x) => same(x, y)) || null : null);
    const foldName = (k) => ((lib.f.find((x) => x.k === k) || {}).n || "");
    const periods = () => (A.periods ? A.periods() : []);
    function setTab(t) { tab = t; edit = null; fedit = null; try { localStorage.setItem(TAB_KEY, t); } catch (e) { /* this visit */ } draw(); if (t === "find") setTimeout(() => fi.focus(), 30); }
    function curTab() { return tab === "find" || tab === "saved" ? tab : (lib.s.length ? "saved" : "find"); }
    function playSaved(x) { pick({ id: x.id, list: x.list, t: x.n }); }
    /** Open the save form: for a saved video (x.k), a new video (x.id or x.list), or an empty one with a link box. */
    function openEdit(x) {
        const ef = effFold();
        edit = { k: x.k || "", id: x.id || "", list: x.list || "", n: x.n || "", f: x.f != null ? x.f : (ef && ef !== "class" ? ef : ""),
            p: x.p ? x.p.slice() : (ef === "class" ? [A.S.period] : []), link: !(x.id || x.list), nf: "", msg: "" };
        fedit = null; draw();
        setTimeout(() => { const i = editBox.querySelector(edit && edit.link ? "input[name=link]" : "input[name=name]"); if (i) i.focus(); }, 40);
    }
    function commitEdit() {
        if (!edit) return;
        const e = edit;
        if (e.link) { const y = parseYt(editBox.querySelector("input[name=link]").value); if (!y) { e.msg = "Paste a YouTube link first."; draw(); return; } e.id = y.id; e.list = y.list; }
        e.n = tidy(editBox.querySelector("input[name=name]").value, 60);
        if (!e.n) { e.msg = "Give it a name you'll remember."; draw(); return; }
        const next = { f: lib.f.slice(), s: lib.s.slice() };
        let f = e.f;
        if (f === "+new") {
            const nf = tidy(e.nf, 40);
            if (!nf) { e.msg = "Name the new folder, or pick another."; draw(); return; }
            const had = next.f.find((x) => x.n.toLowerCase() === nf.toLowerCase());
            if (had) f = had.k; else { if (next.f.length >= FOLD_MAX) { e.msg = "That's the most folders. Delete one first."; draw(); return; } f = newKey(); next.f.push({ k: f, n: nf }); }
        }
        const dup = next.s.find((x) => same(x, e) && x.k !== e.k);
        const k = e.k || (dup && dup.k) || newKey();
        const item = { k, id: e.id, list: e.list, n: e.n, f, p: e.p.filter((v) => periods().includes(v)) };
        next.s = next.s.filter((x) => x.k !== k);
        if (!e.k && next.s.length >= LIB_MAX) { e.msg = "Your library is full. Remove a video first."; draw(); return; }
        if (e.k) { const i = lib.s.findIndex((x) => x.k === k); next.s.splice(Math.max(0, Math.min(i, next.s.length)), 0, item); } else next.s.unshift(item);
        // the video on now takes its new name everywhere (the pill, Recent)
        const so = A.S.sound;
        if (so.yt && same(so.yt, item) && so.yt.t !== item.n) { so.yt.t = item.n; so.ytr = cleanRecent((so.ytr || []).map((r) => (same(r, item) ? Object.assign({}, r, { t: item.n }) : r))); A.quiet(); }
        edit = null; if (curTab() !== "saved") tab = "saved";
        fold = f || null;
        saveLib(next);
    }
    function removeSaved(k) { edit = null; saveLib({ f: lib.f, s: lib.s.filter((x) => x.k !== k) }); }
    function commitFolder(name) {
        const n = tidy(name, 40); if (!n) { fedit = null; draw(); return; }
        const next = { f: lib.f.map((x) => Object.assign({}, x)), s: lib.s };
        if (fedit === "+new") { if (next.f.length >= FOLD_MAX) { libMsg = "That's the most folders. Delete one first."; fedit = null; draw(); return; } const k = newKey(); next.f.push({ k, n }); fold = k; }
        else { const x = next.f.find((y) => y.k === fedit); if (x) x.n = n; }
        fedit = null; saveLib(next);
    }
    function removeFolder(k) {
        // its videos stay, with no folder
        fold = null; fedit = null;
        saveLib({ f: lib.f.filter((x) => x.k !== k), s: lib.s.map((x) => (x.f === k ? Object.assign({}, x, { f: "" }) : x)) });
    }

    /* --- the player --- */
    function ensurePlayer() {
        if (player) return Promise.resolve(player);
        if (playerP) return playerP;
        playerP = loadApi().then((YT) => new Promise((res) => {
            const p = new YT.Player(frame, {
                host: "https://www.youtube-nocookie.com", width: "320", height: "180",
                playerVars: { autoplay: 0, controls: 1, rel: 0, playsinline: 1, iv_load_policy: 3, disablekb: 1, fs: 0, origin: location.origin },
                events: {
                    onReady: () => { player = p; res(p); },
                    onStateChange: (e) => onState(e.data),
                    onError: (e) => onErr(String(e.data)),
                    onAutoplayBlocked: () => { blocked = true; if (A.refresh) A.refresh(); draw(); }
                }
            });
        })).catch(() => { playerP = null; onErr("load"); return null; });
        return playerP;
    }
    function onState(s) {
        state = s;
        const so = A.S.sound, y = so.yt;
        if (s === 1) {   // playing
            blocked = false;
            if (y && (y.e || !y.t) && !A.readOnly()) {   // fill in the title the first time it plays, and clear an old error
                let changed = !!y.e; delete y.e;
                try { const d = player.getVideoData() || {}; if (!y.t && d.title) { y.t = String(d.title).slice(0, 140); y.ch = String(d.author || "").slice(0, 80); changed = true; } } catch (e) { /* no title */ }
                if (changed) { so.ytr = cleanRecent([cleanYt(y)].concat((so.ytr || []).filter((r) => !same(r, y)))); A.quiet(); }
            }
            // Play pressed on the video itself while the music was paused: that is the teacher's play.
            if (A.playsHere() && so.src === "yt" && !so.music && same(loaded, y) && !A.readOnly()) { so.music = true; A.push(); }
            else if (!(A.playsHere() && so.music && so.src === "yt")) { try { player.pauseVideo(); } catch (e) { /* gone */ } }
        }
        // Pause pressed on the video itself: pause the shared music too, so every screen agrees.
        if (s === 2 && A.playsHere() && so.music && so.src === "yt" && same(loaded, y) && !blocked && Date.now() - loadedAt > 1500 && !A.readOnly()) { so.music = false; A.push(); }
        if (s === 0 && so.ytl !== false && loaded && loaded.id) { try { player.seekTo(0, true); player.playVideo(); } catch (e) { /* gone */ } }
        draw(); if (A.refresh) A.refresh();
    }
    function onErr(code) {
        const so = A.S.sound;
        if (so.yt && so.yt.e !== code && !A.readOnly()) { so.yt.e = code; A.quiet(); }
        loaded = code === "load" ? null : loaded;
        draw(); if (A.refresh) A.refresh();
    }
    function volume() {
        if (!player) return;
        const v = Math.round(Math.max(0, Math.min(1, A.S.sound.mv)) * 100);
        try { player.setVolume(ducked ? Math.round(v * 0.2) : v); } catch (e) { /* not ready */ }
    }
    function load(p, y) {
        // A video link plays that video (looped if Loop is on); a playlist link with no video plays the whole list, looped.
        loaded = { id: y.id, list: y.list }; loadedAt = Date.now();
        try {
            if (y.id) p.loadVideoById(y.id);
            else { p.loadPlaylist({ list: y.list, listType: "playlist", index: 0 }); try { p.setLoop(true); } catch (e) { /* fine */ } }
        } catch (e) { loaded = null; }   // the next sync tries again
    }

    /** Called whenever the shared sound settings or the speaker change. */
    function sync() {
        place();
        const so = A.S.sound, y = so.yt;
        const want = A.playsHere() && so.music && so.src === "yt" && !!y && y.e !== "load";
        if (want) {
            ensurePlayer().then((p) => {
                if (!p) return;
                const s2 = A.S.sound, y2 = s2.yt;
                if (!(A.playsHere() && s2.music && s2.src === "yt" && y2)) return;
                volume();
                if (!loaded || !same(loaded, y2)) load(p, y2);
                else if (state !== 1 && state !== 3) { try { p.playVideo(); } catch (e) { /* not ready */ } }
            });
        } else if (player) {
            try { if (!y || !same(loaded, y)) { player.stopVideo(); loaded = null; } else player.pauseVideo(); } catch (e) { /* gone */ }
        }
        draw();
    }
    /** A tap on the playing device: browsers let a video start with sound only after one. */
    function unlock() {
        const so = A.S.sound;
        if (player && A.playsHere() && so.music && so.src === "yt" && so.yt && state !== 1 && state !== 3) { try { player.playVideo(); } catch (e) { /* not ready */ } }
    }
    /** Timer bells: lower the video for a moment, like the built-in music. */
    function duck(secs) {
        if (!player || !(state === 1)) return;
        ducked = true; volume(); clearTimeout(duckT);
        duckT = setTimeout(() => { ducked = false; volume(); }, Math.max(0.5, secs) * 1000);
    }
    /** True while this device should be playing YouTube but the browser is waiting for a tap. */
    function wantsTap() { const so = A.S.sound; return A.playsHere() && so.music && so.src === "yt" && !!so.yt && (blocked || (!!player && !!loaded && [-1, 5].includes(state) && Date.now() - loadedAt > 3000)); }

    /* --- drawing --- */
    function row(y, on, opt) {
        const o = opt || {};
        const b = el("button", "ytrow" + (on ? " on" : "")); b.type = "button";
        const im = el("span", "ytrth"); if (y.id) { const i = el("img"); i.src = thumbOf(y); i.alt = ""; i.loading = "lazy"; im.appendChild(i); } else im.innerHTML = svg(IC.note);
        const tx = el("span", "ytrtx"); tx.append(el("b", null, o.name || nameOf(y)), el("small", null, o.sub != null ? o.sub : (y.ch || (y.list && !y.id ? "Playlist" : ""))));
        b.append(im, tx); b.onclick = o.play || (() => pick(y));
        if (!libOn()) return b;
        // a small button beside the row: save it (or change it, once saved)
        const w = el("div", "ytrw"), had = o.saved || savedOf(y);
        const m = btn("ytrm" + (had ? " on" : ""), o.saved ? "edit" : (had ? "marked" : "mark"), o.saved ? "Rename, move or remove " + o.name : had ? "Saved as " + had.n : "Save to your library");
        m.onclick = () => openEdit(had || { id: y.id, list: y.list, n: y.t || "" });
        w.append(b, m); return w;
    }
    function chip(label, on, fn, cls) { const b = el("button", "ytchip" + (on ? " on" : "") + (cls ? " " + cls : ""), label); b.type = "button"; b.setAttribute("aria-pressed", String(!!on)); b.onclick = fn; return b; }
    function drawEdit() {
        editBox.hidden = !edit;
        if (!edit) { editBox.innerHTML = ""; return; }
        if (editBox.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && editBox.dataset.k === (edit.k || "new") && !edit.redraw) return;   // don't wipe what is being typed
        edit.redraw = false;
        const e = edit; editBox.dataset.k = e.k || "new"; editBox.innerHTML = "";
        editBox.appendChild(el("p", "ytsec", e.k ? "Change saved video" : "Save to your library"));
        const field = (label, name, value, ph, max) => {
            const l = el("label", "ytfld"); l.appendChild(el("span", null, label));
            const i = el("input"); i.name = name; i.value = value; i.placeholder = ph; i.maxLength = max; i.autocomplete = "off";
            i.oninput = () => { if (name === "name") e.n = i.value; if (name === "nf") e.nf = i.value; if (name === "link") e.lv = i.value; };
            l.appendChild(i); editBox.appendChild(l); return i;
        };
        if (e.link) field("YouTube link", "link", e.lv || "", "Paste the video's link", 400);
        else if (e.id) { const pv = el("div", "ytedpv"); const i = el("img"); i.src = thumbOf(e); i.alt = ""; pv.appendChild(i); editBox.appendChild(pv); }
        field("Name", "name", e.n, "What you'll call it, like Test day piano", 60);
        editBox.appendChild(el("p", "ytlab", "Folder"));
        const fr = el("div", "ytquick");
        fr.appendChild(chip("None", !e.f, () => { e.f = ""; e.redraw = true; draw(); }));
        lib.f.forEach((x) => fr.appendChild(chip(x.n, e.f === x.k, () => { e.f = x.k; e.redraw = true; draw(); })));
        fr.appendChild(chip("+ New folder", e.f === "+new", () => { e.f = "+new"; e.redraw = true; draw(); setTimeout(() => { const i = editBox.querySelector("input[name=nf]"); if (i) i.focus(); }, 30); }));
        editBox.appendChild(fr);
        if (e.f === "+new") field("New folder", "nf", e.nf, "Like Calm, Hype or Test day", 40);
        const ps = periods();
        if (ps.length) {
            editBox.appendChild(el("p", "ytlab", "Show it first for these classes (optional)"));
            const pr = el("div", "ytquick");
            ps.forEach((pd) => pr.appendChild(chip(pd, e.p.includes(pd), () => { e.p = e.p.includes(pd) ? e.p.filter((v) => v !== pd) : e.p.concat(pd); e.redraw = true; draw(); })));
            editBox.appendChild(pr);
        }
        if (e.msg) { const m = el("p", "ytnote bad", e.msg); m.setAttribute("role", "status"); editBox.appendChild(m); }
        const act = el("div", "ytedact");
        const ok = el("button", "ytchip on", e.k ? "Save changes" : "Save"); ok.type = "submit";
        const no = chip("Cancel", false, () => { edit = null; draw(); });
        act.append(ok, no);
        if (e.k) { const rm = el("button", "ytlink bad", "Remove from library"); rm.type = "button"; rm.onclick = () => removeSaved(e.k); act.appendChild(rm); }
        editBox.appendChild(act);
    }
    function drawSaved(show) {
        savedBox.hidden = !show;
        if (!show) return;
        if (fedit && savedBox.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;   // naming a folder
        savedBox.innerHTML = "";
        const ef = effFold(), per = A.S.period;
        const inClass = lib.s.filter((x) => x.p.includes(per));
        // folder chips: all, this class, each folder, a new folder
        const fr = el("div", "ytquick ytfolds"); fr.setAttribute("role", "group"); fr.setAttribute("aria-label", "Folders");
        const counted = (c, n, icon) => { c.textContent = ""; if (icon) c.insertAdjacentHTML("beforeend", svg(icon)); c.append(el("span", null, c.dataset.l), el("small", null, String(n))); c.setAttribute("aria-label", c.dataset.l + ", " + n); return c; };
        const fc = (label, on, fn, n, cls, icon) => { const c = chip(label, on, fn, cls); c.dataset.l = label; return counted(c, n, icon); };
        fr.appendChild(fc("All", ef === "", () => { fold = ""; draw(); }, lib.s.length));
        if (inClass.length) fr.appendChild(fc(per + " period", ef === "class", () => { fold = "class"; draw(); }, inClass.length, "ytper"));
        lib.f.forEach((x) => fr.appendChild(fc(x.n, ef === x.k, () => { fold = x.k; draw(); }, lib.s.filter((y) => y.f === x.k).length, "", IC.folder)));
        fr.appendChild(chip("+ Folder", fedit === "+new", () => { fedit = "+new"; draw(); setTimeout(() => { const i = savedBox.querySelector("input"); if (i) i.focus(); }, 30); }, "ytadd"));
        savedBox.appendChild(fr);
        if (fedit) {
            const f = el("form", "ytfoldf"); const i = el("input"); i.placeholder = "Folder name, like Calm or Test day"; i.maxLength = 40; i.value = fedit === "+new" ? "" : foldName(fedit); i.setAttribute("aria-label", "Folder name");
            const ok = el("button", "ytchip on", fedit === "+new" ? "Add" : "Rename"); ok.type = "submit";
            f.append(i, ok, chip("Cancel", false, () => { fedit = null; draw(); }));
            f.onsubmit = (ev) => { ev.preventDefault(); commitFolder(i.value); };
            savedBox.appendChild(f);
        } else if (ef && ef !== "class") {
            const t = el("div", "ytftools");
            const rn = el("button", "ytlink", "Rename folder"); rn.type = "button"; rn.onclick = () => { fedit = ef; draw(); setTimeout(() => { const i = savedBox.querySelector("input"); if (i) { i.focus(); i.select(); } }, 30); };
            const rm = el("button", "ytlink bad", "Delete folder"); rm.type = "button"; rm.title = "Its videos stay in All"; rm.onclick = () => removeFolder(ef);
            t.append(rn, rm); savedBox.appendChild(t);
        }
        if (libMsg) { const m = el("p", "ytnote bad", libMsg); m.setAttribute("role", "status"); savedBox.appendChild(m); }
        const shown = ef === "class" ? inClass : ef ? lib.s.filter((x) => x.f === ef) : lib.s;
        const ls = el("div", "ytlist ytlib");
        const y = A.S.sound.yt;
        shown.forEach((x) => {
            const sub = [ef === x.f ? "" : foldName(x.f), x.p.length ? x.p.join(", ") + (x.p.length === 1 ? " period" : " periods") : ""].filter(Boolean).join(" \u00b7 ");
            ls.appendChild(row(x, same(x, y) && A.S.sound.src === "yt", { name: x.n, sub, saved: x, play: () => playSaved(x) }));
        });
        if (!shown.length) ls.appendChild(el("p", "ytempty", lib.s.length ? "Nothing in this folder yet. Save a video and pick this folder." : "Nothing saved yet. Paste a link below, or play a video and tap Save, then give it a name you'll remember."));
        savedBox.appendChild(ls);
        const add = el("button", "ytaddv"); add.type = "button"; add.innerHTML = svg(IC.plus) + "<span>Add a video by link</span>"; add.onclick = () => openEdit({});
        savedBox.appendChild(add);
    }
    /* The one-time setup, step by step. The key is free; it lets this panel search YouTube itself. */
    function keySteps() {
        const box = el("div", "ytsteps");
        box.appendChild(el("p", "ytkeyn", "A free key from Google lets this panel search YouTube by itself. It takes about five minutes, once."));
        const ol = el("ol");
        const step = (html) => { const li = el("li"); li.innerHTML = html; ol.appendChild(li); };
        const ln = (href, text) => '<a href="' + href + '" target="_blank" rel="noopener">' + text + "</a>";
        step(ln("https://console.cloud.google.com/apis/library/youtube.googleapis.com", "Open YouTube Data API v3") + " in Google Cloud (make a project if it asks) and press <b>Enable</b>.");
        step("Go to " + ln("https://console.cloud.google.com/apis/credentials", "Credentials") + ", press <b>Create credentials</b>, then <b>API key</b>.");
        step("Open the new key. Under <b>Website restrictions</b> add <code>https://anchorboard.web.app/*</code>. Under <b>API restrictions</b> pick <b>YouTube Data API v3</b>. Save.");
        step("Copy the key and paste it below.");
        box.appendChild(ol);
        return box;
    }
    function drawKeyBox() {
        if (keyBox.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;   // don't wipe a key being typed
        keyBox.innerHTML = "";
        if (A.guest || !(A.store && A.store())) { keyBox.hidden = true; return; }
        keyBox.hidden = false;
        const t = el("button", "ytkeyt"); t.type = "button"; t.innerHTML = svg(IC.key) + "<span></span>";
        t.querySelector("span").textContent = key ? "Search key saved" : "Turn on search here (one time)";
        t.setAttribute("aria-expanded", String(setup)); t.onclick = () => { setup = !setup; drawKeyBox(); };
        keyBox.appendChild(t);
        if (!setup) return;
        const p = key ? el("p", "ytkeyn", "Search uses your YouTube key, saved in your account (never on the site or in its code). Paste a new one to replace it, or clear it.") : keySteps();
        const f = el("form", "ytkeyf"); const ki = el("input"); ki.type = "password"; ki.placeholder = key ? "New key" : "Paste your key"; ki.autocomplete = "off"; ki.setAttribute("aria-label", "YouTube search key");
        const ks = el("button", "ytchip on", "Save"); ks.type = "submit";
        f.append(ki, ks);
        const km = el("p", "ytkeyn"); km.setAttribute("role", "status");
        f.onsubmit = async (e) => { e.preventDefault(); km.textContent = "Saving…"; const ok = await saveKey(ki.value); km.textContent = ok ? (ki.value.trim() ? "Saved. Search is on." : "Cleared.") : "That doesn't look like a YouTube key. Check it and try again."; if (ok) { ki.value = ""; setTimeout(() => { setup = false; draw(); }, 900); } };
        keyBox.append(p, f, km);
        if (key) { const c = el("button", "ytlink", "Clear the key"); c.type = "button"; c.onclick = async () => { await saveKey(""); draw(); }; keyBox.appendChild(c); }
    }
    function draw() {
        const so = A.S.sound, y = so.yt, on = so.src === "yt" && !!y, playing = on && so.music;
        const here = A.playsHere();
        place();
        subs.forEach((f) => { try { f({ open: open && !A.readOnly(), playing, name: on ? nameOf(y) : "" }); } catch (e) { /* theirs */ } });
        // pill
        pill.hidden = A.readOnly();
        pill.classList.toggle("playing", playing); pill.classList.toggle("isopen", open);
        pOpen.querySelector(".ytp-t").textContent = on ? nameOf(y) : "YouTube";
        pOpen.setAttribute("aria-label", (open ? "Close" : "Open") + " the music panel" + (on ? ", " + nameOf(y) : ""));
        pOpen.setAttribute("aria-expanded", String(open));
        pOpen.querySelector(".ytp-ch").innerHTML = svg(open ? IC.min : IC.open);
        pPlay.hidden = !on;
        pPlay.innerHTML = svg(playing ? IC.pause : IC.play); pPlay.setAttribute("aria-label", playing ? "Pause" : "Play"); pPlay.title = playing ? "Pause" : "Play";
        // panel
        panel.hidden = !open || A.readOnly();
        if (panel.hidden) { host.classList.remove("show"); host.style.cssText = ""; return; }
        thumb.hidden = !(y && y.id); if (y && y.id && thumb.getAttribute("src") !== thumbOf(y)) thumb.src = thumbOf(y);
        vEmpty.hidden = !!y;
        mT.textContent = y ? nameOf(y) : "Pick a video below";
        mC.textContent = y ? (y.ch || (y.list && !y.id ? "Playlist" : "")) : "Search or paste a YouTube link. It plays in the background, even with this panel tucked away.";
        bPlay.disabled = !y;
        bPlay.innerHTML = svg(playing ? IC.pause : IC.play); bPlay.setAttribute("aria-label", playing ? "Pause" : "Play"); bPlay.title = playing ? "Pause" : "Play";
        bPlay.classList.toggle("on", playing);
        bLoop.setAttribute("aria-pressed", String(so.ytl !== false)); bLoop.hidden = !!(y && y.list && !y.id);
        if (libOn()) watchLib();
        const sv = savedOf(y);
        bSave.hidden = !y || !libOn();
        bSave.innerHTML = svg(sv ? IC.marked : IC.mark) + "<span></span>"; bSave.querySelector("span").textContent = sv ? "Saved" : "Save";
        bSave.classList.toggle("on", !!sv); bSave.title = sv ? "Saved as " + sv.n + ". Tap to change it." : "Save this video to your library"; bSave.setAttribute("aria-label", bSave.title);
        if (document.activeElement !== vr) vr.value = String(Math.round(so.mv * 100));
        let n = "";
        if (y && y.e) n = ERRORS[y.e] || "That video can't play here. Pick another.";
        else if (!y) n = "";
        else if (so.src !== "yt" && so.music) n = "The built-in music is on. Press play to switch to this video.";
        else if (!so.music) n = "Paused.";
        else if (here) n = wantsTap() ? "Tap anywhere on this screen once to let the video play with sound." : (state === 1 ? "Playing on this screen." : "Starting…");
        else n = so.at ? "Playing on another device." : "Playing on the board. If it stays quiet, tap the board once.";
        note.textContent = n; note.classList.toggle("bad", !!(y && y.e));
        // the real player shows in the video box on the device that plays, so the teacher sees what is on
        const showFrame = here && !!player && !!y && !!loaded;
        host.classList.toggle("show", showFrame); vid.classList.toggle("live", showFrame); if (!showFrame) host.style.cssText = "";
        if (showFrame) requestAnimationFrame(posFrame);
        // tabs: Saved (the library) and Find (search, paste, recent, key)
        const t = libOn() ? curTab() : "find";
        tabs.hidden = !libOn() || !!edit;
        tSaved.textContent = "Saved" + (lib.s.length ? " " + lib.s.length : ""); tSaved.setAttribute("aria-selected", String(t === "saved")); tFind.setAttribute("aria-selected", String(t === "find"));
        drawEdit();
        drawSaved(t === "saved" && !edit);
        const fshow = t === "find" && !edit;
        [find, quick, msg, list, recentH, recent, keyBox].forEach((x) => { x.classList.toggle("ytoff", !fshow); });
        // search
        list.innerHTML = "";
        msg.className = "ytmsg";
        if (searching) msg.textContent = "Searching YouTube…";
        else if (searchMsg === "nokey") {
            msg.textContent = "";
            const w = el("div", "ytnokey");
            const canKey = !A.guest && !!(A.store && A.store());   // a signed-in account can keep a key; a guest board can't
            w.appendChild(el("p", null, canKey ? "To search right here, turn on search once with a free YouTube key. Until then, a pasted link still plays."
                : "Search here needs the teacher's YouTube key. For now, find it on YouTube, then copy its link and paste it above."));
            if (canKey) {
                const k = el("button", "ytchip on"); k.type = "button"; k.innerHTML = svg(IC.key) + "<span>Turn on search here</span>";
                k.onclick = () => { setup = true; searchMsg = ""; draw(); requestAnimationFrame(() => keyBox.scrollIntoView({ block: "nearest", behavior: "smooth" })); };
                w.appendChild(k);
            }
            const a = el("a", canKey ? "ytlink" : "ytchip on"); a.href = "https://www.youtube.com/results?search_query=" + encodeURIComponent(lastQ || "instrumental music for studying"); a.target = "_blank"; a.rel = "noopener";
            if (canKey) a.textContent = "Or search on YouTube in a new tab"; else a.innerHTML = svg(IC.ext) + "<span>Search on YouTube</span>";
            w.appendChild(a);
            list.appendChild(w);
        } else msg.textContent = searchMsg;
        results.forEach((r) => list.appendChild(row(r, same(r, y))));
        const rec = (so.ytr || []).filter((r) => !results.some((x) => same(x, r)));
        recentH.hidden = !rec.length; recent.innerHTML = ""; rec.slice(0, 6).forEach((r) => recent.appendChild(row(r, same(r, y))));
        drawKeyBox();
    }
    /* The player sits over the panel's video box (it can't move into the panel: a moved iframe restarts). */
    function posFrame() {
        if (!host.classList.contains("show")) return;
        const r = vid.getBoundingClientRect(), p = panel.getBoundingClientRect();
        // keep it inside the panel's scroll box, so it never floats over the search or the page
        const top = Math.max(r.top, p.top), bottom = Math.min(r.bottom, p.bottom);
        host.style.left = r.left + "px"; host.style.width = r.width + "px"; host.style.top = r.top + "px"; host.style.height = r.height + "px";
        host.style.clipPath = bottom <= top ? "inset(100%)" : "inset(" + (top - r.top) + "px 0 " + (r.bottom - bottom) + "px 0 round 14px)";
    }
    window.addEventListener("resize", () => { if (open) draw(); });
    panel.addEventListener("scroll", posFrame, { passive: true });
    panel.addEventListener("animationend", posFrame);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open && panel.contains(document.activeElement)) setOpen(false); });

    draw();
    return { sync, unlock, duck, wantsTap, open: () => setOpen(true), close: () => setOpen(false), toggle: () => setOpen(!open), isOpen: () => open, draw,
        /** fn({ open, playing, name }) runs each time the music or the panel changes. */
        listen: (fn) => { subs.push(fn); draw(); } };
}
