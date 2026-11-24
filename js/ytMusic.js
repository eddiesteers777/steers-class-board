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

   Search uses the YouTube Data API with a key the teacher saves once in their own account
   (teacher/{uid}/keys/youtube, a folder linked screens cannot read). The key is never in this public repo.
   Without a key, a pasted link or video ID still plays, and the search opens YouTube in a new tab.
   Search asks YouTube for strict SafeSearch and embeddable videos only.
========================================== */

const KEY_PATH = "keys/youtube";
const OPEN_KEY = "anchorboard-yt-open";
const RECENT_MAX = 8;
const QUICK = [["Lo-fi", "lofi instrumental beats for studying"], ["Piano", "calm piano instrumental music"], ["Jazz", "smooth jazz instrumental"],
    ["Classical", "classical music for studying"], ["Acoustic", "acoustic guitar instrumental"], ["Video game", "video game music instrumental for studying"]];
const ERRORS = {
    "2": "That link doesn't point to a video. Check it and try again.",
    "5": "This video can't play in this browser. Pick another.",
    "100": "That video was removed or made private. Pick another.",
    "101": "The video's owner doesn't allow it to play on other sites. Pick another.",
    "150": "The video's owner doesn't allow it to play on other sites. Pick another.",
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
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>'
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
    ctl.append(bPlay, bLoop, vol);
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
    panel.append(head, now, find, quick, msg, list, recentH, recent, keyBox);

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
    }
    function setOpen(v) {
        open = !!v; try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch (e) { /* this visit only */ }
        draw();
        if (open) { if (!key && !keyOff) watchKey(); setTimeout(() => { if (document.activeElement === document.body && !A.S.sound.yt) fi.focus(); }, 60); }
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
    function row(y, on) {
        const b = el("button", "ytrow" + (on ? " on" : "")); b.type = "button";
        const im = el("span", "ytrth"); if (y.id) { const i = el("img"); i.src = thumbOf(y); i.alt = ""; i.loading = "lazy"; im.appendChild(i); } else im.innerHTML = svg(IC.note);
        const tx = el("span", "ytrtx"); tx.append(el("b", null, nameOf(y)), el("small", null, y.ch || (y.list ? "Playlist" : "")));
        b.append(im, tx); b.onclick = () => pick(y); return b;
    }
    function drawKeyBox() {
        if (keyBox.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;   // don't wipe a key being typed
        keyBox.innerHTML = "";
        if (A.guest || !(A.store && A.store())) { keyBox.hidden = true; return; }
        keyBox.hidden = false;
        const t = el("button", "ytkeyt"); t.type = "button"; t.innerHTML = svg(IC.key) + "<span></span>";
        t.querySelector("span").textContent = key ? "Search key saved" : "Turn on search in this panel";
        t.setAttribute("aria-expanded", String(setup)); t.onclick = () => { setup = !setup; drawKeyBox(); };
        keyBox.appendChild(t);
        if (!setup) return;
        const p = el("p", "ytkeyn", key ? "Search uses your YouTube key, saved in your account (never on the site or in its code). Paste a new one to replace it, or clear it."
            : "Search needs a free YouTube Data API key from Google Cloud, restricted to anchorboard.web.app. Paste it once; it is saved in your account only.");
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
        mC.textContent = y ? (y.ch || (y.list ? "Playlist" : "")) : "Search or paste a YouTube link. It plays in the background, even with this panel tucked away.";
        bPlay.disabled = !y;
        bPlay.innerHTML = svg(playing ? IC.pause : IC.play); bPlay.setAttribute("aria-label", playing ? "Pause" : "Play"); bPlay.title = playing ? "Pause" : "Play";
        bPlay.classList.toggle("on", playing);
        bLoop.setAttribute("aria-pressed", String(so.ytl !== false)); bLoop.hidden = !!(y && y.list && !y.id);
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
        // search
        list.innerHTML = "";
        msg.className = "ytmsg";
        if (searching) msg.textContent = "Searching YouTube…";
        else if (searchMsg === "nokey") {
            msg.textContent = "";
            const w = el("div", "ytnokey");
            w.appendChild(el("p", null, "Search here needs a one-time YouTube key. For now, find it on YouTube, then copy its link and paste it above."));
            const a = el("a", "ytchip on"); a.href = "https://www.youtube.com/results?search_query=" + encodeURIComponent(lastQ || "instrumental music for studying"); a.target = "_blank"; a.rel = "noopener";
            a.innerHTML = svg(IC.ext) + "<span>Search on YouTube</span>"; w.appendChild(a);
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
    return { sync, unlock, duck, wantsTap, open: () => setOpen(true), isOpen: () => open, draw };
}
