/* ==========================================
   Anchor Board — Show the board on another screen: the screen's side (tv.html, 2026-11-23).
   Eddie: "something inside of the website and app that allows you to screencast it to any TV, computer, etc."

   Any TV, Chromebook or computer with a web browser opens anchorboard.web.app/tv. No Google sign-in there:
     1. It signs in as an anonymous guest (the same free sign-in the student games use).
     2. It makes a short code, pair/{code} = { tv: its own uid }, and shows it big with a QR code.
     3. The teacher scans the QR or types the code on link.html, signed in on their own phone or Chromebook.
        That writes teacher/{uid}/tv/{this screen's uid} and adds owner to pair/{code}.
     4. This page sees the owner, keeps it (localStorage, anchor:tvOwner), deletes the code and opens board.html,
        which follows the Remote live, read only (js/boardStore.js, js/boardApp.js "tvview").
   Next time the screen opens /tv it goes straight to the board while the link is there.
   Cast (link.html, Chrome's Presentation API): a Chromecast shows this page too; it hands its code back to the
   teacher's Chrome over the cast connection, so the link happens with no typing.
========================================== */
import { auth, db } from "./firebase.js";
import { waitForUser } from "./auth.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDocFromServer, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import qrcode from "./vendor/qrcode.js?v=1";
import { markSvg, ensureCss } from "./anchorLoader.js?v=2";

const TV_KEY = "anchor:tvOwner";
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O or 1/I: easy to read across a room
const FRESH = 25 * 60 * 1000;   // a new code before the 30-minute limit in the rules
const $ = (id) => document.getElementById(id);
const note = (t) => { $("note").textContent = t; $("note").hidden = !t; };

ensureCss(); $("mark").innerHTML = markSvg("anl-loop");
const linkHost = location.host === "steers-class-board.web.app" || location.host === "focalboard.web.app" ? "anchorboard.web.app" : location.host;
$("linkUrl").textContent = linkHost + "/link";

let me = "", code = "", unsub = null, refreshT = 0;
const casts = [];   // cast connections back to the teacher's Chrome (link.html), when a Chromecast opened this page

function makeCode() { const a = new Uint32Array(6); crypto.getRandomValues(a); return Array.from(a, (x) => ABC[x % ABC.length]).join(""); }

function qrSvg(text) {
    const q = qrcode(0, "M"); q.addData(text); q.make();
    const n = q.getModuleCount(), m = 2, NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + (n + 2 * m) + " " + (n + 2 * m)); svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "QR code that opens the link page with this code");
    let d = ""; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    const bg = document.createElementNS(NS, "rect"); bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#fff");
    const path = document.createElementNS(NS, "path"); path.setAttribute("d", d); path.setAttribute("fill", "#081B45");
    svg.append(bg, path); return svg;
}

function tellCasts() { if (!code) return; casts.forEach((c) => { try { if (c.state === "connected") c.send(JSON.stringify({ kind: "anchor-tv", code })); } catch (e) { /* the code is on screen anyway */ } }); }
function watchCast() {
    const rc = navigator.presentation && navigator.presentation.receiver;
    if (!rc) return;
    document.body.classList.add("cast");
    rc.connectionList.then((list) => {
        const add = (c) => { casts.push(c); c.addEventListener("connect", tellCasts); c.addEventListener("message", () => tellCasts()); tellCasts(); };
        list.connections.forEach(add);
        list.addEventListener("connectionavailable", (e) => add(e.connection));
    }).catch(() => {});
}

async function newCode() {
    clearTimeout(refreshT); if (unsub) { unsub(); unsub = null; }
    const old = code; code = "";
    if (old) deleteDoc(doc(db, "pair/" + old)).catch(() => {});
    let got = "";
    for (let i = 0; i < 6 && !got; i++) {
        const c = makeCode();
        try { await setDoc(doc(db, "pair/" + c), { tv: me, at: serverTimestamp() }); got = c; }
        catch (e) { if (e && e.code !== "permission-denied") { note("Couldn't reach Anchor Board. Check the Wi-Fi. Trying again…"); await new Promise((r) => setTimeout(r, 4000)); } }   // permission-denied: that code is taken, pick another
    }
    if (!got) { note("Couldn't get a code. Check the Wi-Fi, then reload this page."); return; }
    code = got;
    $("code").textContent = code.slice(0, 3) + " " + code.slice(3);
    $("code").setAttribute("aria-label", code.split("").join(" "));
    const url = location.origin + "/link.html?c=" + code;
    $("qr").replaceChildren(qrSvg(url));
    $("card").hidden = false; note(new URLSearchParams(location.search).has("ended") ? "This screen was stopped from the teacher's device. Link it again any time." : "");
    tellCasts();
    unsub = onSnapshot(doc(db, "pair/" + code), (s) => {
        const d = s.exists() ? s.data() : null;
        if (d && d.owner && d.tv === me) linked(d.owner);
    }, () => {});
    refreshT = setTimeout(newCode, FRESH);
}

function linked(owner) {
    if (unsub) { unsub(); unsub = null; } clearTimeout(refreshT);
    try { localStorage.setItem(TV_KEY, owner); } catch (e) { note("This browser won't keep the link (storage is off). Try another browser."); return; }
    $("card").hidden = true; note("Linked. Opening the board…");
    deleteDoc(doc(db, "pair/" + code)).catch(() => {}).finally(() => location.replace("board.html"));
}

async function start() {
    if ("PresentationRequest" in window || (navigator.presentation && navigator.presentation.receiver)) watchCast();
    let user = await waitForUser();
    if (user && !user.isAnonymous) { note("This device is signed in as the teacher. Opening the board…"); location.replace("board.html"); return; }
    if (!user) {
        try { user = (await signInAnonymously(auth)).user; }
        catch (e) {
            note(/operation-not-allowed|admin-restricted/.test((e && e.code) || "") ? "Other screens aren't turned on for this site yet (anonymous sign-in is off in Firebase)." : "Couldn't connect. Check the Wi-Fi, then reload this page.");
            return;
        }
    }
    me = user.uid;
    let owner = ""; try { owner = localStorage.getItem(TV_KEY) || ""; } catch (e) { /* not linked */ }
    if (owner) {   // linked before: go straight to the board while the link is still there
        try {
            const s = await getDocFromServer(doc(db, "teacher/" + owner + "/tv/" + me));
            if (s.exists()) { note("Opening the board…"); location.replace("board.html"); return; }
            localStorage.removeItem(TV_KEY);
        } catch (e) {
            if (e && e.code === "permission-denied") { try { localStorage.removeItem(TV_KEY); } catch (x) { /* fine */ } }
            else { note("Opening the board…"); location.replace("board.html"); return; }   // offline: the board draws its saved copy and reconnects
        }
    }
    await newCode();
}

// Full screen: a TV browser or a computer hooked to a TV. The board page offers it too.
const fs = $("full");
if (document.fullscreenEnabled && !document.body.classList.contains("cast")) {
    fs.hidden = false;
    fs.onclick = () => { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); };
    document.addEventListener("fullscreenchange", () => { fs.hidden = !!document.fullscreenElement; });
}
start();
