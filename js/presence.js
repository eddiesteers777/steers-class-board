/* ==========================================
   Anchor Board — Live status: which screens are on, and did the board get my change?
   Every signed-in board page and Remote checks in here every 20 seconds, and right away
   whenever it shows a new board state:
     teacher/{uid}/screens/{device-tab}   one document per open board or Remote tab
     teacher/{uid}/screens/_ping          "Check now" from a Remote; every open screen answers at once
     teacher/{uid}/settings/screenNames   names the teacher gave each device ("Promethean")
   All of it sits in the teacher's own space, which the Firestore rules already allow.
   Nothing about students is written here: only the screen, period, day and panel names.
   The Remote's "Live status" button opens a sheet that lists them and says, for the newest
   change, whether each board has received it.
========================================== */
import { db } from "./firebase.js";
import { doc, collection, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const BEAT = 20000;          // a check-in every 20 s while open
const FRESH = 50000;         // heard within 50 s: on
const QUIET = 180000;        // heard within 3 min: quiet (tab in the background, or a slow network)
const SHOW_FOR = 12 * 3600e3; // older than 12 h: left off the list
const DROP_AFTER = 3 * 86400e3; // older than 3 days: removed

function deviceLabel() {
    const ua = navigator.userAgent || "";
    if (/CrOS/.test(ua)) return "Chromebook";
    if (/iPhone|iPod/.test(ua)) return "iPhone";
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android screen";
    if (/Windows/.test(ua)) return "Windows computer";
    if (/Macintosh/.test(ua)) return "Mac";
    if (/Linux/.test(ua)) return "Linux computer";
    return "Device";
}
const store = (k, make) => { try { let v = localStorage.getItem(k); if (!v) { v = make(); localStorage.setItem(k, v); } return v; } catch (e) { return make(); } };
const tabStore = (k, make) => { try { let v = sessionStorage.getItem(k); if (!v) { v = make(); sessionStorage.setItem(k, v); } return v; } catch (e) { return make(); } };
const rid = () => Math.random().toString(36).slice(2, 10);
const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : (typeof t === "number" ? t : 0));
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
const ago = (d) => { const s = Math.max(0, Math.round(d / 1000)); if (s < 5) return "just now"; if (s < 60) return s + " s ago"; const m = Math.round(s / 60); if (m < 60) return m + " min ago"; const h = Math.round(m / 6) / 10; return h + " h ago"; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Start checking in. api:
 *   uid, page (this tab's mark on what it saves), mode ("board" | "remote"),
 *   snap() -> { screen, screenName, period, day, week, panels: [names], look, conn }
 *   now() -> shared-clock ms (this device's clock corrected by the measured skew)
 * Returns { saw(by, at), beat(), mount(host) }.
 */
export function startPresence(api) {
    const dev = store("anchorboard-device-id", rid);   // same id the sound settings use
    const tab = tabStore("anchorboard-tab-id", rid);    // survives a reload of this tab
    const id = (dev + "-" + tab).slice(0, 40);
    const me = doc(db, `teacher/${api.uid}/screens/${id}`);
    let got = { by: "", at: 0 }, gotWhen = 0, pong = 0, timer = 0, soon = 0, last = "";

    function body() {
        const s = api.snap() || {};
        const showing = api.mode === "board" || document.body.classList.contains("board");
        return {
            dev, page: api.page, kind: api.mode === "board" ? "board" : "remote", showing,
            full: !!document.fullscreenElement, vis: document.visibilityState, label: deviceLabel(),
            w: Math.round(window.innerWidth), h: Math.round(window.innerHeight),
            screen: String(s.screen || ""), screenName: String(s.screenName || ""), period: String(s.period || ""),
            day: String(s.day || ""), week: String(s.week || ""), panels: (s.panels || []).slice(0, 14).map(String), look: String(s.look || ""),
            conn: String(s.conn || "").slice(0, 80), got: { by: got.by, at: got.at, when: gotWhen }, pong,
            ct: api.now(), t: serverTimestamp(),
        };
    }
    function beat() {
        clearTimeout(soon); soon = 0;
        const b = body(), k = JSON.stringify([b.showing, b.full, b.vis, b.screen, b.period, b.day, b.week, b.panels, b.look, b.conn, b.got.at, b.got.by, b.pong]);
        last = k;
        setDoc(me, b).catch(() => { /* the next check-in tries again */ });
    }
    const beatSoon = () => { if (!soon) soon = setTimeout(beat, 250); };
    timer = setInterval(beat, BEAT);
    document.addEventListener("visibilitychange", beatSoon);
    document.addEventListener("fullscreenchange", beatSoon);
    window.addEventListener("online", beatSoon);
    window.addEventListener("pagehide", () => { try { setDoc(me, { vis: "closed", t: serverTimestamp(), ct: api.now() }, { merge: true }); } catch (e) { /* closing */ } });
    // "Check now" from any Remote: answer right away, so the phone sees a fresh time from each screen.
    onSnapshot(doc(db, `teacher/${api.uid}/screens/_ping`), (s) => {
        const d = s.data(); if (!d || s.metadata.hasPendingWrites) return;
        const at = +d.at || 0; if (at && at !== pong) { pong = at; beat(); }
    }, () => {});
    setTimeout(beat, 1500);   // first check-in, once the page has drawn

    /** This tab is now showing the board state saved by `by` at `at`. */
    function saw(by, at) {
        if (!by || !at || (by === got.by && at === got.at)) return;
        got = { by: String(by).slice(0, 20), at: +at || 0 }; gotWhen = api.now();
        beatSoon();
    }
    /** Check in now if anything shown has changed since the last check-in (a cheap compare, called often). */
    function changed() { const b = body(); const k = JSON.stringify([b.showing, b.full, b.vis, b.screen, b.period, b.day, b.week, b.panels, b.look, b.conn, b.got.at, b.got.by, b.pong]); if (k !== last) beatSoon(); }

    return { saw, beat, changed, mount: (host) => mountSheet(api, host, id), id };
}

/* ---------- the Live status sheet on the Remote ---------- */
function mountSheet(api, host, myId) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "lsbtn"; btn.id = "liveStatusBtn"; btn.setAttribute("aria-expanded", "false");
    // The screen badge (Eddie picked option B, Nov 25): a small screen tile in the site colors with a light on its corner.
    // Off: the screen crossed out and grey. On: green light. Catching up: amber light. css/livestatus.css draws it.
    btn.dataset.s = "load";
    btn.innerHTML = '<span class="lsscr" aria-hidden="true">'
        + '<svg class="lson" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
        + '<svg class="lsoff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.5 1-2 1-2"/><path d="M22 15V5a2 2 0 0 0-2-2H9"/><path d="M8 21h8M12 17v4M2 2l20 20"/></svg>'
        + '<i class="lsdot" data-s="load"></i></span><span id="lsBtnText">Live status</span>';
    host.parentNode.insertBefore(btn, host);
    const sheet = document.createElement("aside");
    sheet.className = "lssheet"; sheet.id = "liveStatus"; sheet.hidden = true; sheet.setAttribute("aria-label", "Live status");
    sheet.innerHTML = '<div class="lshead"><div><b>Live status</b><span>Every screen signed in to this account</span></div><button class="btn ghost" id="lsClose" type="button">Close</button></div>'
        + '<div id="lsAck" class="lsack" role="status"></div>'
        + '<div class="lsrow"><button class="btn" id="lsPing" type="button">Check now</button><span id="lsPingNote" class="lsnote"></span></div>'
        + '<div id="lsList"></div><p class="lsfoot">The picture on this Remote is drawn from the same saved board state, so if a board below says it has your latest change, it is showing what you see here. A board counts as on when it checked in within the last minute.</p>';
    document.body.appendChild(sheet);
    const open = (v) => { sheet.hidden = !v; btn.setAttribute("aria-expanded", v ? "true" : "false"); if (v) draw(); };
    btn.onclick = () => open(sheet.hidden);
    sheet.querySelector("#lsClose").onclick = () => open(false);

    let rows = [], names = {}, state = null, pingAt = 0;
    const path = (p) => `teacher/${api.uid}/${p}`;
    onSnapshot(collection(db, path("screens")), { includeMetadataChanges: false }, (s) => {
        rows = s.docs.filter((d) => !d.id.startsWith("_")).map((d) => Object.assign({ id: d.id }, d.data({ serverTimestamps: "estimate" })));
        const now = api.now();
        rows.forEach((r) => { if (r.id !== myId && now - (ms(r.t) || r.ct || 0) > DROP_AFTER) deleteDoc(doc(db, path("screens/" + r.id))).catch(() => {}); });
        draw();
    }, () => { setText("Can't read Live status right now."); });
    onSnapshot(doc(db, path("settings/screenNames")), (s) => { names = (s.data() || {}); draw(); }, () => {});
    onSnapshot(doc(db, path("board/state")), (s) => { const d = s.data(); state = d ? { by: d.by || "", at: +d.at || 0 } : null; draw(); }, () => {});
    sheet.querySelector("#lsPing").onclick = () => {
        pingAt = api.now();
        setDoc(doc(db, path("screens/_ping")), { at: pingAt, by: api.page }).catch(() => {});
        sheet.querySelector("#lsPingNote").textContent = "Asked every screen to answer…";
        setTimeout(draw, 6000);
    };
    sheet.addEventListener("click", (e) => {
        const b = e.target.closest("[data-name]"); if (!b) return;
        const dev = b.dataset.name, cur = names[dev] || "";
        const v = window.prompt("Name this device (for example: Promethean board, my Chromebook, my phone)", cur);
        if (v == null) return;
        setDoc(doc(db, path("settings/screenNames")), { [dev]: v.trim().slice(0, 40) }, { merge: true }).catch(() => {});
    });
    setInterval(() => { draw(); }, 5000);   // ages keep counting

    function setText(t) { const a = sheet.querySelector("#lsAck"); if (a) a.textContent = t; }
    const age = (r) => api.now() - (ms(r.t) || r.ct || 0);
    const stateOf = (r) => (r.vis === "closed" ? "off" : age(r) < FRESH ? (r.vis === "hidden" ? "quiet" : "on") : age(r) < QUIET ? "quiet" : "off");
    const isBoard = (r) => r.kind === "board" || r.showing;
    const nameOf = (r) => names[r.dev] || r.label || "Device";
    const gotIt = (r) => state && r.got && ((r.got.by === state.by && r.got.at === state.at) || r.got.at > state.at);

    function draw() {
        const now = api.now();
        const list = rows.filter((r) => r.id === myId || age(r) < SHOW_FOR)
            .sort((a, b) => (isBoard(b) - isBoard(a)) || (age(a) - age(b)));
        const boardsOn = list.filter((r) => isBoard(r) && stateOf(r) === "on" && r.id !== myId);
        // the button: a count anyone can read at a glance
        const dot = btn.querySelector(".lsdot"), bt = btn.querySelector("#lsBtnText");
        const allGot = boardsOn.length && boardsOn.every(gotIt);
        const s = !boardsOn.length ? "bad" : allGot ? "ok" : "wait";
        dot.dataset.s = s; btn.dataset.s = s;
        const n = boardsOn.length;
        bt.textContent = s === "bad" ? "Board off" : s === "wait" ? "Catching up" : (n === 1 ? "Board on" : n + " boards on");
        btn.title = (s === "bad" ? "No board is on" : s === "wait" ? "The board doesn't have your latest change yet" : n === 1 ? "The board is on and has your latest change" : "All " + n + " boards are on and have your latest change") + ". Tap for Live status.";   // Slides shows the dot alone (css/slidedit.css), so the words show on hover
        if (sheet.hidden) return;
        // the newest change, and who has it
        let ack = "";
        if (!state || !state.at) ack = "<p>No board changes saved yet.</p>";
        else if (!boardsOn.length && !list.some((r) => isBoard(r) && r.id !== myId)) ack = '<p class="lsbig" data-s="bad">No board has checked in.</p><p>A board page opened before this update was added keeps working, but it can only check in here after it is reloaded once.</p>';
        else {
            const from = state.by === api.page ? "this device" : esc(nameOf(rows.find((r) => r.page === state.by) || {}));
            const boards = boardsOn.filter((r) => r.id !== myId);
            const have = boards.filter(gotIt);
            const cls = !boards.length ? "bad" : have.length === boards.length ? "ok" : "wait";
            const head = !boards.length ? "No board has checked in in the last minute." : have.length === boards.length ? (boards.length === 1 ? "The board has it." : "All " + boards.length + " boards have it.") : "Waiting for " + (boards.length - have.length) + " of " + boards.length + " board" + (boards.length === 1 ? "" : "s") + "…";
            ack = '<p class="lsbig" data-s="' + cls + '">' + head + "</p><p>Latest change: " + clock(state.at) + " from " + from + ".</p>";
        }
        sheet.querySelector("#lsAck").innerHTML = ack;
        const pn = sheet.querySelector("#lsPingNote");
        if (pingAt) {
            const back = list.filter((r) => r.id !== myId && +r.pong === pingAt);
            pn.textContent = back.length ? back.length + " screen" + (back.length === 1 ? "" : "s") + " answered" + (now - pingAt < 6000 ? "…" : ".") : (now - pingAt < 6000 ? "Asked every screen to answer…" : "No screen answered. Check that the board is on and the page is open.");
        }
        sheet.querySelector("#lsList").innerHTML = list.length ? list.map((r) => {
            const st = stateOf(r), mine = r.id === myId;
            const role = mine ? "This device" : r.kind === "board" ? "Board page" : r.showing ? "Remote in Board view" : "Remote";
            const where = r.vis === "closed" ? "Page closed" : st === "off" ? "Not heard from since " + clock(ms(r.t) || r.ct) : r.vis === "hidden" ? "Tab in the background or screen asleep" : (r.full ? "Full screen" : "In a window") + ", checked in " + ago(age(r));
            const what = [r.screenName || r.screen, r.period ? r.period + " period" : "", r.day].filter(Boolean).join(" · ");
            const panels = r.panels && r.panels.length ? "Panels: " + r.panels.join(", ") : "No panels open";
            const tick = !mine && isBoard(r) && st !== "off" && state && state.at ? (gotIt(r) ? '<span class="lsgot" data-s="ok">Has your latest change</span>' : '<span class="lsgot" data-s="wait">Not on the latest change yet</span>') : "";
            const conn = r.conn && r.conn !== "Live" && st !== "off" ? '<p class="lswarn">' + esc(r.conn) + "</p>" : "";
            return '<div class="lsitem" data-s="' + st + '"><div class="lstop"><i class="lsdot" data-s="' + (st === "on" ? "ok" : st === "quiet" ? "wait" : "bad") + '"></i><b>' + esc(nameOf(r)) + '</b><span class="lsrole">' + role + '</span><button type="button" class="lsname" data-name="' + esc(r.dev) + '">Rename</button></div>'
                + '<p class="lswhere">' + esc(where) + "</p>" + (st !== "off" ? '<p class="lswhat">' + esc(what) + '</p><p class="lspanels">' + esc(panels) + "</p>" : "") + conn + tick + "</div>";
        }).join("") : "<p>No screens have checked in yet.</p>";
    }
    return { open };
}
