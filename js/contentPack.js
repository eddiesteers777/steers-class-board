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
