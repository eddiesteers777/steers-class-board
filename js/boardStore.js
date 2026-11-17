/* ==========================================
   Calera Math — where the board app keeps its live state.
   Everything lives under teacher/{uid}/..., which the Firestore
   rules already lock to the signed-in teacher:
     teacher/{uid}/board/state   what the board is showing (class, day, screen, problem, timers)
     teacher/{uid}/ink/{key}     the whiteboard drawing for one problem
   The Promethean and the Chromebook stay in sync because both sign in
   with the SAME Google account and so read the same documents.
========================================== */
import { db } from "./firebase.js";
import { waitForUser, logout } from "./auth.js";
import { doc, setDoc, getDocFromServer, onSnapshot, serverTimestamp, disableNetwork, enableNetwork } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

let uid = null;

/** Resolves { uid, name } for the signed-in teacher, or null when signed out. */
export async function ready() {
    const user = await waitForUser();
    if (!user) return null;
    uid = user.uid;
    return { uid, name: user.displayName || user.email || "" };
}

const ref = (path) => doc(db, `teacher/${uid}/${path}`);

/**
 * Live subscription. next({ exists, data, pending, fromCache }); returns unsubscribe.
 *
 * Two things here keep the board following the Remote (fixed 2026-11-17):
 * - includeMetadataChanges: when the board and the Remote run as two tabs of one browser they share
 *   the offline copy, so the Remote's change first reaches the board as a "pending" snapshot, which
 *   the pages skip. Without metadata changes the confirmed copy that follows is never delivered
 *   (only its metadata changed), so the board never moved until a reload.
 * - A listener that fails (for example "aborted") is dead for good in Firestore. This one calls
 *   error(e) and then listens again on its own, sooner when the device comes back online or the
 *   tab comes back into view.
 */
const RETRY = [1000, 2000, 4000, 8000, 15000, 30000];
export function watch(path, next, error = () => {}) {
    let unsub = null, stopped = false, fails = 0, timer = 0;
    const start = () => {
        clearTimeout(timer); timer = 0;
        if (stopped || unsub) return;
        unsub = onSnapshot(ref(path), { includeMetadataChanges: true },
            (snap) => { fails = 0; next({ exists: snap.exists(), data: snap.data(), pending: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache }); },
            (e) => {
                unsub = null; fails++;
                try { error(e, fails); } catch { /* the page's handler must not stop the retry */ }
                if (!stopped) timer = setTimeout(start, RETRY[Math.min(fails - 1, RETRY.length - 1)]);
            });
    };
    const soon = () => { if (!stopped && !unsub && document.visibilityState !== "hidden") start(); };
    window.addEventListener("online", soon);
    document.addEventListener("visibilitychange", soon);
    start();
    return () => {
        stopped = true; clearTimeout(timer);
        window.removeEventListener("online", soon); document.removeEventListener("visibilitychange", soon);
        if (unsub) { unsub(); unsub = null; }
    };
}

/** Resolves true when the server answers a read of this document within ms, false otherwise. */
export async function reachable(path, ms = 8000) {
    let to = 0;
    try {
        return await Promise.race([getDocFromServer(ref(path)).then(() => true), new Promise((r) => { to = setTimeout(() => r(false), ms); })]);
    } catch { return false; } finally { clearTimeout(to); }
}

/** Replace the whole document. */
export function save(path, data) {
    return setDoc(ref(path), data);
}

/**
 * How far this device's clock is from the shared (server) clock, in ms.
 * Timers use it so the board and the Chromebook show the same time even
 * when one of their clocks is wrong. Resolves 0 if it cannot be measured.
 */
export async function clockSkew() {
    try {
        let id = sessionStorage.getItem("school-device-id");
        if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("school-device-id", id); }
        const r = ref(`clock/${id}`), sent = Date.now();
        await setDoc(r, { t: serverTimestamp() });
        const snap = await getDocFromServer(r), back = Date.now();
        const t = snap.data()?.t;
        return t ? t.toMillis() - (sent + back) / 2 : 0;
    } catch { return 0; }
}

/** Drop and reopen Firestore's connection: wakes a connection that has stalled without an error. */
export async function kick() {
    try { await disableNetwork(db); } catch { /* already off */ }
    try { await enableNetwork(db); } catch { /* tried */ }
}

export { logout as signOut };
