/* ==========================================
   Anchor Board — early access: is this account on the approved list? (rules: js/accessRules.js)

   checkAccess(user) reads access/{email} from the server and answers
     "owner" | "approved" | "waiting" | "unknown" | "guest".
   Only "waiting" (the server said this email is not on the list) sends anyone to waiting.html.
   Offline, a slow connection, or rules that aren't live yet all answer "unknown" and change nothing.
   An answer of owner or approved is remembered on this device (anchor-access:uid) for the top bar link.

   The Teacher access page (access.html) uses the rest: the list, add, remove, and the waitlist.
========================================== */
import { db } from "./firebase.js";
import { doc, getDocFromServer, getDocsFromServer, collection, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { cleanEmail, decideAccess } from "./accessRules.js?v=1";

const memoKey = (uid) => "anchor-access:" + uid;
export function rememberedAccess(uid) { try { return localStorage.getItem(memoKey(uid)) || ""; } catch { return ""; } }

async function sha256hex(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

/** Where this signed-in account stands. Never rejects. */
export async function checkAccess(user) {
    if (!user) return "unknown";
    if (user.isAnonymous) return "guest";
    const email = cleanEmail(user.email);
    const verified = user.emailVerified === true && !!email;
    let hash = "", entry = "error";
    try { hash = email ? await sha256hex(email) : ""; } catch { /* no crypto: can't be the owner here */ }
    let r = decideAccess({ anonymous: false, verified, hash, entry: "error" });
    if (r !== "owner" && email) {
        try { entry = (await withTimeout(getDocFromServer(doc(db, "access", email)), 6000)).exists(); }
        catch { entry = "error"; }   // permission-denied (rules not live yet), offline or slow: can't tell
        r = decideAccess({ anonymous: false, verified, hash, entry });
    }
    try {
        if (r === "owner" || r === "approved") localStorage.setItem(memoKey(user.uid), r);
        else if (r === "waiting") localStorage.removeItem(memoKey(user.uid));
    } catch { /* storage unavailable */ }
    return r;
}

/* ---------- the Teacher access page (owner only; the rules refuse anyone else) ---------- */
const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : Number(t) || 0);

export async function listApproved() {
    const q = await getDocsFromServer(collection(db, "access"));
    return q.docs.map((d) => ({ email: d.id, at: ms(d.data().at), from: d.data().from || "added", note: d.data().note || "" }))
        .sort((a, b) => b.at - a.at);
}
export async function approve(email, from = "added", note = "") {
    const e = cleanEmail(email); if (!e) throw new Error("not an email address");
    const data = { email: e, at: serverTimestamp(), from: from === "waitlist" ? "waitlist" : "added" };
    const n = String(note || "").trim().slice(0, 80); if (n) data.note = n;
    await setDoc(doc(db, "access", e), data);
    return e;
}
export async function removeApproved(email) { await deleteDoc(doc(db, "access", cleanEmail(email) || String(email))); }

export async function listWaitlist() {
    const q = await getDocsFromServer(collection(db, "waitlist"));
    return q.docs.map((d) => { const w = d.data(); return { id: d.id, email: w.email || "", name: w.name || "", grades: w.grades || "", subject: w.subject || "", board: w.board || "", device: w.device || "", note: w.note || "", at: ms(w.at) }; });
}
export async function clearWaitlistEntry(id) { await deleteDoc(doc(db, "waitlist", id)); }
