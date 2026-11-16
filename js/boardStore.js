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
import { doc, setDoc, getDocFromServer, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

let uid = null;

/** Resolves { uid, name } for the signed-in teacher, or null when signed out. */
export async function ready() {
    const user = await waitForUser();
    if (!user) return null;
    uid = user.uid;
    return { uid, name: user.displayName || user.email || "" };
}

const ref = (path) => doc(db, `teacher/${uid}/${path}`);

/** Live subscription. next({ exists, data, pending }); returns unsubscribe. */
export function watch(path, next, error = () => {}) {
    return onSnapshot(ref(path),
        (snap) => next({ exists: snap.exists(), data: snap.data(), pending: snap.metadata.hasPendingWrites }),
        error);
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

export { logout as signOut };
