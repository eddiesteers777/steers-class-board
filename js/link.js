/* ==========================================
   Anchor Board — Show the board on another screen: the teacher's side (link.html, 2026-11-23).
   The screen (tv.html, js/tv.js) shows a code. Here the signed-in teacher types or scans it:
     teacher/{uid}/tv/{screen uid} = { name, code, at }   lets that one screen read the board (firestore.rules)
     pair/{code}.owner = uid                               tells the screen it is linked
   Both go in one batch, so a screen is never told it is linked without the access to show the board.
   "Stop showing" deletes the screen's document: the screen loses access and goes back to its code page.
   Cast: Chrome's Presentation API opens tv.html on a Chromecast or Google TV; the cast page sends its code
   back over the connection and this page links it with no typing.
========================================== */
import { db } from "./firebase.js";
import { waitForUser } from "./auth.js";
import { doc, collection, getDoc, writeBatch, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const clean = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");   // codes never use 0, O, 1 or I
let uid = "";

const tvHost = location.host === "steers-class-board.web.app" || location.host === "focalboard.web.app" ? "anchorboard.web.app" : location.host;
$("tvUrl").textContent = tvHost + "/tv";

/** Link the screen showing `code`. Resolves a sentence for the teacher. */
async function link(raw, name) {
    const code = clean(raw);
    if (!CODE.test(code)) return { ok: false, t: "Codes are 6 letters and numbers, like ABC 234." };
    let p;
    try { p = await getDoc(doc(db, "pair/" + code)); } catch (e) { return { ok: false, t: "Couldn't check that code (" + ((e && e.code) || "connection") + "). Try again." }; }
    if (!p.exists()) return { ok: false, t: "No screen is showing " + code + ". Check the code on the TV." };
    const d = p.data();
    if (d.owner) return { ok: d.owner === uid, t: d.owner === uid ? "That screen is already linked." : "That code was already used. Reload the page on the TV for a new one." };
    const at = d.at && d.at.toMillis ? d.at.toMillis() : 0;
    if (at && Date.now() - at > 29 * 60 * 1000) return { ok: false, t: "That code ran out. The TV shows a new one; type that." };
    const b = writeBatch(db);
    b.set(doc(db, "teacher/" + uid + "/tv/" + d.tv), { name: String(name || "Screen").trim().slice(0, 40) || "Screen", code, at: serverTimestamp() });
    b.update(doc(db, "pair/" + code), { owner: uid });
    try { await b.commit(); } catch (e) { return { ok: false, t: "Couldn't link it (" + ((e && e.code) || "connection") + "). Try again." }; }
    return { ok: true, t: "Linked. The screen opens your board in a moment." };
}

function list() {
    onSnapshot(collection(db, "teacher/" + uid + "/tv"), (s) => {
        const ul = $("list"); ul.replaceChildren();
        const rows = s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => ((b.at && b.at.toMillis && b.at.toMillis()) || 0) - ((a.at && a.at.toMillis && a.at.toMillis()) || 0));
        $("listCard").hidden = !rows.length;
        rows.forEach((r) => {
            const li = document.createElement("li"), txt = document.createElement("div"), b = document.createElement("b"), sm = document.createElement("small"), btn = document.createElement("button");
            b.textContent = r.name || "Screen";
            const when = r.at && r.at.toDate ? r.at.toDate() : null;
            sm.textContent = when ? "Linked " + when.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Linking…";
            txt.append(b, sm);
            btn.type = "button"; btn.className = "lkbtn ghost small"; btn.textContent = "Stop showing";
            btn.onclick = async () => { btn.disabled = true; btn.textContent = "Stopping…"; try { await deleteDoc(doc(db, "teacher/" + uid + "/tv/" + r.id)); } catch (e) { btn.disabled = false; btn.textContent = "Couldn't stop it. Try again"; } };
            li.append(txt, btn); ul.append(li);
        });
    }, () => {});
}

function codeForm() {
    const inp = $("codeIn"), msg = $("msg"), go = $("go");
    const pre = new URLSearchParams(location.search).get("c");
    inp.addEventListener("input", () => { const c = clean(inp.value).slice(0, 6); const v = c.length > 3 ? c.slice(0, 3) + " " + c.slice(3) : c; if (inp.value !== v) inp.value = v; msg.textContent = ""; msg.dataset.s = ""; });
    $("form").addEventListener("submit", async (e) => {
        e.preventDefault(); go.disabled = true; msg.dataset.s = ""; msg.textContent = "Linking…";
        const r = await link(inp.value, $("nameIn").value);
        msg.textContent = r.t; msg.dataset.s = r.ok ? "ok" : "bad"; go.disabled = false;
        if (r.ok) inp.value = "";
    });
    if (pre) { inp.value = clean(pre).slice(0, 6); inp.dispatchEvent(new Event("input")); $("nameIn").focus(); $("nameIn").select(); }
}

function cast() {
    const card = $("castCard"), btn = $("castBtn"), msg = $("castMsg");
    card.hidden = false;
    if (!("PresentationRequest" in window)) {
        btn.hidden = true;
        $("castWhy").textContent = "Casting works from Chrome on a Chromebook or computer. This browser can't cast, so use the code above (it works on any TV with a browser).";
        return;
    }
    const req = new PresentationRequest([location.origin + "/tv.html?cast=1"]);
    const say = (on) => { btn.disabled = !on; btn.textContent = on ? "Cast to a TV" : "No TVs found on this Wi-Fi"; };
    req.getAvailability().then((a) => { say(a.value); a.onchange = () => say(a.value); }).catch(() => { btn.disabled = false; btn.textContent = "Cast to a TV"; });   // some Chrome builds can't watch: let the teacher try
    btn.onclick = async () => {
        msg.dataset.s = ""; msg.textContent = "Pick the TV in Chrome's list…";
        let c;
        try { c = await req.start(); }
        catch (e) { msg.textContent = e && e.name === "NotAllowedError" ? "" : "Couldn't cast (" + ((e && e.name) || "error") + "). Use the code above instead."; return; }
        msg.textContent = "Casting. Waiting for the TV's code…";
        let done = false;
        c.addEventListener("message", async (ev) => {
            if (done) return;
            let d = null; try { d = JSON.parse(ev.data); } catch (x) { return; }
            if (!d || d.kind !== "anchor-tv" || !CODE.test(d.code || "")) return;
            done = true;
            const r = await link(d.code, "Chromecast");
            msg.textContent = r.ok ? "Linked. The TV opens your board in a moment. Leave this tab open while you cast." : r.t; msg.dataset.s = r.ok ? "ok" : "bad";
        });
        c.addEventListener("connect", () => { try { c.send(JSON.stringify({ kind: "hello" })); } catch (x) { /* the TV sends its code on its own too */ } });
        c.addEventListener("terminate", () => { msg.dataset.s = ""; msg.textContent = "Casting stopped."; });
        setTimeout(() => { if (!done) msg.textContent = "Casting, but the TV hasn't sent its code. If the TV shows a code, type it above."; }, 15000);
    };
}

(async () => {
    const user = await waitForUser();
    if (!user || user.isAnonymous) { $("signin").hidden = false; return; }
    uid = user.uid;
    $("codeCard").hidden = false;
    codeForm(); cast(); list();
})();
