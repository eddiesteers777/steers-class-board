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
import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

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

export { logout as signOut };
