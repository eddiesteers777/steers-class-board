/* ==========================================
   Anchor Board — which built-in lessons an account sees.

   The site ships with Mr. Steers' Calera weeks built into the code (data/weeks.js).
   Other teachers should not land on his classes, so every account gets a "pack":
     "calera"   the Calera weeks, periods and classes (Mr. Steers' account)
     "starter"  one made-up sample week and one sample class, for any new teacher
   The choice is saved once at teacher/{uid}/settings/pack as { pack, how, at }.

   An account that already has board, week or roster data from before this change
   is an existing account and keeps the Calera weeks, so nothing changes for it.
   A brand-new account gets the starter pack.

   Signed out (the guest sub page) and student guests keep the Calera weeks, as before.
   When the choice can't be read (offline, first load), the Calera weeks show and
   nothing is saved, so a bad connection never moves an account.

   ?pack=starter or ?pack=calera on any signed-in page sets it by hand (for testing).
========================================== */
import { db } from "./firebase.js";
import { waitForUser } from "./auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export const PACKS = ["calera", "starter"];
const FALLBACK = "calera";
const cacheKey = (uid) => "focal-pack:" + uid;

function cached(uid) {
    try { const v = localStorage.getItem(cacheKey(uid)); return PACKS.includes(v) ? v : null; } catch { return null; }
}
function remember(uid, pack) {
    try { localStorage.setItem(cacheKey(uid), pack); } catch { /* storage unavailable */ }
}
function withTimeout(p, ms) {
    let t = 0;
    return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error("timeout")), ms); })]).finally(() => clearTimeout(t));
}
function asked() {
    try { const v = new URLSearchParams(location.search).get("pack"); return PACKS.includes(v) ? v : null; } catch { return null; }
}

/** Decide (and save) the pack for a signed-in teacher. Throws when Firestore can't be reached. */
async function decide(uid) {
    const ref = doc(db, `teacher/${uid}/settings/pack`);
    const want = asked();
    if (want) {
        await setDoc(ref, { pack: want, how: "set by hand", at: serverTimestamp() });
        return want;
    }
    const snap = await getDoc(ref);
    const saved = snap.exists() && snap.data() && snap.data().pack;
    if (PACKS.includes(saved)) return saved;
    // No choice saved yet: an account with data from before this change is an existing account.
    const had = await Promise.all(["board/state", "weekfiles/index", "rosters/all"].map((p) =>
        getDoc(doc(db, `teacher/${uid}/${p}`)).then((s) => s.exists())));
    const pack = had.some(Boolean) ? "calera" : "starter";
    await setDoc(ref, { pack, how: pack === "calera" ? "existing account" : "new account", at: serverTimestamp() });
    return pack;
}

let pending = null;
/** Resolves "calera" or "starter" for whoever is on this page. Never rejects. */
export function myPack() {
    if (pending) return pending;
    pending = (async () => {
        let user = null;
        try { user = await withTimeout(waitForUser(), 6000); } catch { return FALLBACK; }
        if (!user || user.isAnonymous) return FALLBACK;
        const known = asked() ? null : cached(user.uid);
        if (known) {
            // Fast path: use the remembered choice now and refresh it quietly for next time.
            decide(user.uid).then((p) => remember(user.uid, p)).catch(() => {});
            return known;
        }
        try {
            const p = await withTimeout(decide(user.uid), 5000);
            remember(user.uid, p);
            return p;
        } catch {
            return FALLBACK;
        }
    })();
    return pending;
}

/* ---------- A new teacher's own setup (setup.html) ----------
   teacher/{uid}/settings/setup = {
     name, school, grades: ["6","7"], subject,
     classes: [{ p: "1st", label: "Math 6", room: "112" }, ...],   one row per period, in bell order
     done: true, at
   }
   Pages read it through mySetup(); setup.html saves it with saveSetup(). */
const setupKey = (uid) => "focal-setup:" + uid;
function cachedSetup(uid) {
    try { const v = JSON.parse(localStorage.getItem(setupKey(uid)) || "null"); return v && typeof v === "object" ? v : null; } catch { return null; }
}
function rememberSetup(uid, s) {
    try { localStorage.setItem(setupKey(uid), JSON.stringify(s || {})); } catch { /* storage unavailable */ }
}
/** Keep only well-formed fields, so a bad document can never break a page. */
export function cleanSetup(d) {
    const s = d && typeof d === "object" ? d : {};
    const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
    const seen = new Set();
    const classes = (Array.isArray(s.classes) ? s.classes : []).map((c) => ({ p: str(c && c.p, 12), label: str(c && c.label, 40), room: str(c && c.room, 20) }))
        .filter((c) => c.p && c.label && !seen.has(c.p) && seen.add(c.p)).slice(0, 10);
    return {
        name: str(s.name, 40), school: str(s.school, 60), subject: str(s.subject, 30),
        grades: (Array.isArray(s.grades) ? s.grades : []).map((g) => str(g, 6)).filter(Boolean).slice(0, 8),
        classes, done: s.done === true
    };
}

let setupPending = null;
/** Resolves the signed-in teacher's setup (cleaned), or null when signed out. Never rejects. */
export function mySetup() {
    if (setupPending) return setupPending;
    setupPending = (async () => {
        let user = null;
        try { user = await withTimeout(waitForUser(), 6000); } catch { return null; }
        if (!user || user.isAnonymous) return null;
        const ref = doc(db, `teacher/${user.uid}/settings/setup`);
        const fetchIt = () => getDoc(ref).then((snap) => { const s = cleanSetup(snap.exists() ? snap.data() : null); rememberSetup(user.uid, s); return s; });
        const known = cachedSetup(user.uid);
        if (known) { fetchIt().catch(() => {}); return cleanSetup(known); }
        try { return await withTimeout(fetchIt(), 5000); } catch { return null; }
    })();
    return setupPending;
}

/** Save the setup (setup.html). Also updates this device's copy so the next page uses it at once. */
export async function saveSetup(s) {
    const user = await waitForUser();
    if (!user) throw new Error("signed out");
    const clean = cleanSetup(s);
    rememberSetup(user.uid, clean);
    await setDoc(doc(db, `teacher/${user.uid}/settings/setup`), Object.assign({}, clean, { at: serverTimestamp() }));
    return clean;
}
