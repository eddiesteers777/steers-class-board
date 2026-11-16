/* ==========================================
   Calera Math — board <-> remote live session
   NEW file. Pattern copied from Southbound js/messages.js
   watchThread: onSnapshot(doc(...)) + unsubscribe, with a
   cancelled flag. Do NOT copy the messages collections or
   coach/client UIDs — this is ONE doc per live session:

     live/{sessionId}
     { classId, weekId, dayId, itemIndex, answerVisible,
       whiteboardOpen, timer: { durationSec, endsAt,
       state, remainingSec }, updatedAt }

   Remote (Chromebook) writes it; board subscribes and
   re-renders on every change. Never sync via localStorage —
   the board and Chromebook are different devices.
========================================== */

import { db } from "./firebase.js";
import { waitForUser } from "./auth.js";
import {
    doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { newTimer } from "./classTimer.js";

export function sessionIdFor(classId, weekId, dayId) {
    return `${weekId}-${classId}-${dayId}`;
}

export function defaultSession(classId, weekId, dayId) {
    return {
        classId, weekId, dayId,
        itemIndex: 0,
        answerVisible: false,
        whiteboardOpen: false,
        timer: newTimer(300),
        updatedAt: serverTimestamp()
    };
}

async function me() {
    const user = await waitForUser();
    if (!user) throw new Error("not-signed-in");
    return user;
}

/** Create the live doc if missing, then return it. Remote calls this on open. */
export async function openLiveSession(classId, weekId, dayId) {
    await me();
    const id = sessionIdFor(classId, weekId, dayId);
    const ref = doc(db, "live", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) await setDoc(ref, defaultSession(classId, weekId, dayId));
    return id;
}

/** Remote: write a partial update (itemIndex, answerVisible, timer, ...). */
export async function publishLiveSession(sessionId, patch) {
    await me();
    await updateDoc(doc(db, "live", sessionId), { ...patch, updatedAt: serverTimestamp() });
}

/**
 * Board: live subscription. Calls onChange(session) now and on
 * every change. Returns the unsubscribe function.
 * (Same shape as Southbound messages.js watchThread.)
 */
export function watchLiveSession(sessionId, onChange, onError = () => {}) {
    let stop = () => {};
    let cancelled = false;
    me().then(() => {
        if (cancelled) return;
        stop = onSnapshot(doc(db, "live", sessionId),
            snap => { if (snap.exists()) onChange({ id: snap.id, ...snap.data() }); },
            error => onError(error));
    }).catch(onError);
    return () => { cancelled = true; stop(); };
}
