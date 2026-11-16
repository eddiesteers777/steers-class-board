/* ==========================================
   Calera Math — Account Profile (teacher-only)

   School rewrite of the Southbound userProfile module.
   One profile per teacher, stored at teacher/{uid} in Firestore:
   { uid, displayName, email, role: "teacher", status: "active" }.

   No client directory, no approvals, no services, no
   coach/client workflow — students never sign in.
   Exports used by the live code: ensureProfile, getMyProfile,
   getProfile, touchLastSeen.
========================================== */

import { db } from "./firebase.js";
import { waitForUser } from "./auth.js";
import {
    doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

function profileDoc(uid) {
    return doc(db, "teacher", uid);
}

export async function ensureProfile() {
    const user = await waitForUser();
    if (!user) return null;
    const ref = profileDoc(user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return { uid: user.uid, ...snap.data() };
    const profile = {
        uid: user.uid,
        displayName: user.displayName || "",
        email: user.email || "",
        role: "teacher",
        status: "active",
        createdAt: serverTimestamp()
    };
    await setDoc(ref, profile);
    return profile;
}

export async function getMyProfile() {
    const user = await waitForUser();
    if (!user) return null;
    const snap = await getDoc(profileDoc(user.uid));
    if (!snap.exists()) return ensureProfile();
    return { uid: user.uid, ...snap.data() };
}

export async function getProfile(uid) {
    if (!uid) return null;
    const snap = await getDoc(profileDoc(uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function touchLastSeen() {
    try {
        const user = await waitForUser();
        if (!user) return;
        await updateDoc(profileDoc(user.uid), { lastSeenAt: serverTimestamp() });
    } catch { /* best effort */ }
}
