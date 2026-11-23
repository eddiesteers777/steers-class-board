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
import { doc, collection, setDoc, getDoc, getDocs, deleteDoc, writeBatch, getDocFromServer, onSnapshot, runTransaction, serverTimestamp, disableNetwork, enableNetwork } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

let uid = null;

/* Other screens (tv.html, 2026-11-23): a TV or computer the teacher linked signs in as an anonymous guest and keeps
   the teacher's uid in localStorage (TV_KEY). It reads that teacher's board, read only: every write here is skipped,
   and the Firestore rules would refuse it anyway. */
export const TV_KEY = "anchor:tvOwner";
let screenMe = "";   // this screen's own (guest) uid, when this page is a linked screen
export const isScreen = () => !!screenMe;

/** Resolves { uid, name } for the signed-in teacher, or null when signed out.
    A guest (anonymous) sign-in is not a teacher: null, unless the board asks with { screen: true }. Then a linked
    screen gets { uid: the teacher's, name: "", screen: true } and a guest with no link { unlinked: true }. */
export async function ready(opts) {
    const user = await waitForUser();
    if (!user) return null;
    if (user.isAnonymous) {
        if (!(opts && opts.screen)) return null;
        let owner = ""; try { owner = localStorage.getItem(TV_KEY) || ""; } catch { /* storage off: not linked */ }
        if (!/^[\w-]{6,128}$/.test(owner)) return { unlinked: true };
        uid = owner; screenMe = user.uid;
        return { uid, name: "", screen: true };
    }
    uid = user.uid;
    return { uid, name: user.displayName || user.email || "" };
}

/** On a linked screen: next(true) while the teacher's link to this screen is there, next(false) once it is gone. */
export function watchLink(next) {
    if (!screenMe) return () => {};
    return listen(() => ref(`tv/${screenMe}`), (snap) => { if (!snap.metadata.fromCache) next(snap.exists()); }, (e) => { if (e && e.code === "permission-denied") next(false); });
}
/** A linked screen that lost its link forgets it and goes back to the code screen. */
export function unlinkHere() {
    try { localStorage.removeItem(TV_KEY); } catch { /* fine */ }
    location.replace("tv.html?ended=1");
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
    return listen(() => ref(path), (snap) => next({ exists: snap.exists(), data: snap.data(), pending: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache }), error);
}
function listen(target, next, error) {
    let unsub = null, stopped = false, fails = 0, timer = 0;
    const start = () => {
        clearTimeout(timer); timer = 0;
        if (stopped || unsub) return;
        unsub = onSnapshot(target(), { includeMetadataChanges: true },
            (snap) => { fails = 0; next(snap); },
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
    if (screenMe) return Promise.resolve();   // a linked screen only shows the board
    return setDoc(ref(path), data);
}

/**
 * How far this device's clock is from the shared (server) clock, in ms.
 * Timers use it so the board and the Chromebook show the same time even
 * when one of their clocks is wrong. Resolves 0 if it cannot be measured.
 */
export async function clockSkew() {
    if (screenMe) return 0;   // a linked screen cannot write; its own clock is close enough
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

/* ---------- student game rooms ----------
   A student game (Vault Raid, js/liveRoom.js) lives OUTSIDE the teacher's space, at rooms/{code},
   so students with no Google account can reach it by its code. The rules (firestore.rules) let only
   the teacher who opened a room change it, and let each student write only their own entry.
   Paths here are full paths from the top, e.g. "rooms/123456/p". */
const abs = (path) => doc(db, path);
export const rooms = {
    uid: () => uid,
    /** One document, same snapshot shape as watch(). */
    watch(path, next, error = () => {}) {
        return listen(() => abs(path), (snap) => next({ exists: snap.exists(), data: snap.data(), pending: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache }), error);
    },
    /** Every document in a collection: next([{ id, data }], changedIds). */
    watchAll(path, next, error = () => {}) {
        return listen(() => collection(db, path), (snap) => {
            if (snap.metadata.hasPendingWrites) return;
            next(snap.docs.map((d) => ({ id: d.id, data: d.data() })), snap.docChanges().map((c) => c.doc.id));
        }, error);
    },
    get: async (path) => { const s = await getDoc(abs(path)); return s.exists() ? s.data() : null; },
    save: (path, data, merge) => setDoc(abs(path), data, merge ? { merge: true } : undefined),
    /** Several writes at once (up to 450): [{ path, data, merge }] or [{ path, del: true }]. */
    async many(list) {
        for (let i = 0; i < list.length; i += 450) {
            const b = writeBatch(db);
            list.slice(i, i + 450).forEach((w) => { if (w.del) b.delete(abs(w.path)); else b.set(abs(w.path), w.data, w.merge ? { merge: true } : {}); });
            await b.commit();
        }
    },
    /** Delete every document in a collection (the teacher's own room only). */
    async clear(path) {
        const s = await getDocs(collection(db, path)), ids = s.docs.map((d) => d.ref.path);
        await rooms.many(ids.map((p) => ({ path: p, del: true })));
        return ids.length;
    },
    del: (path) => deleteDoc(abs(path)),
    /** Read one document, change it and write it back in one go (Firestore retries if another screen wrote it meanwhile).
        fn(data or null) returns the new data (written whole) or null to leave it as it is. Resolves what fn returned. */
    async tx(path, fn) {
        return runTransaction(db, async (t) => {
            const r = abs(path), s = await t.get(r), next = fn(s.exists() ? s.data() : null);
            if (next) t.set(r, next);
            return next;
        });
    },
};

export { logout as signOut };
