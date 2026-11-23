// ==========================================
// Calera Math v2.0 - Firebase Initialization
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager, memoryLocalCache,
  terminate, clearIndexedDbPersistence, connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA8kAei_AJMU66EePYQyI8nlVJeLes5HLY",
  // Rolled back 2026-10-26: a custom auth domain broke Google sign-in.
  // Start on the default *.firebaseapp.com auth domain.
  authDomain: "steers-class-board.firebaseapp.com",
  projectId: "steers-class-board",
  storageBucket: "steers-class-board.firebasestorage.app",
  messagingSenderId: "997357619072",
  appId: "1:997357619072:web:8e47464df7c4e329fd2365"
  // No measurementId: Google Analytics is OFF for this project.
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);

// Firestore keeps a copy of what this account has read, and any writes
// not yet sent, on this device (IndexedDB): pages still show the plan,
// check-ins and coach replies they last loaded when the phone is
// offline, and a workout logged offline is sent when the connection
// comes back, even after the app was closed. Reads still go to the
// server whenever it's reachable, so nothing is shown stale while
// online. Only one tab owns the persistent cache; additional tabs fall
// back to memory (see below). If the browser won't allow
// IndexedDB (private windows, strict tracking protection) the SDK falls
// back to memory, as before. Signing out clears the persistent copy
// (js/auth.js).
// Some phones stall Firestore's streaming connection with no error (2026-11-07, iPhone Safari: the
// sync read never answered). Auto-detect only helps when the stream fails; on a stall it waits forever,
// and every screen that reads Firestore then sits empty (coach pages, 2026-11-12). So an iPhone/iPad,
// or any device that has already seen a hang (js/cloudSync.js leaves the mark), skips the stream and
// uses plain requests from the start. Slightly more traffic, but it answers.
function streamLooksUnsafe() {
  try {
    if (Date.now() - Number(localStorage.getItem("__cloudSyncSdkHungAt") || 0) < 24 * 3600 * 1000) return true;
  } catch { /* storage blocked */ }
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// One tab owns the offline copy; every other tab keeps its own copy in memory (2026-11-23).
// Before this, every tab shared the offline copy (persistentMultipleTabManager). That mode lets only
// ONE tab talk to the server and the other tabs ask it for their data. When that leader tab is in the
// background, iPhone Safari pauses it, and Chrome/Edge freeze or slow it down, so every other tab sat
// waiting until the leader's turn ran out (8 s on every new tab in testing, longer on a phone), and
// then the tabs passed the job back and forth as you switched between them.
// Now each tab talks to the server itself. The first tab open gets the offline copy (a browser lock
// marks it, and the lock goes away when that tab closes); the others start in memory, which answers
// in about the time of one server trip. Pages with a quick copy (Remote, Tracker, Plan) still draw
// from it at once, and the board and the Remote still hear each other at once (BroadcastChannel).
let ownsOfflineCopy = false;
async function claimOfflineCopy() {
  if (!(navigator.locks && navigator.locks.request)) return false;   // very old browser: memory only, so no two tabs ever fight over the copy
  try {
    return await new Promise((resolve, reject) => {
      navigator.locks.request("anchorboard-offline-copy", { ifAvailable: true }, (lock) => {
        resolve(!!lock);
        return lock ? new Promise(() => {}) : undefined;   // keep the lock for the life of this page
      }).catch(reject);
    });
  } catch {
    return false;
  }
}
ownsOfflineCopy = await claimOfflineCopy();

let db;
try {
  db = initializeFirestore(app, {
    // forceOwnership: the lock already says no other open tab has it, so a leftover claim from a
    // tab that just closed must not stop this one.
    localCache: ownsOfflineCopy
      ? persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: true }) })
      : memoryLocalCache(),
    ...(streamLooksUnsafe() ? { experimentalForceLongPolling: true } : { experimentalAutoDetectLongPolling: true })
  });
} catch (error) {
  console.warn("Calera Math: offline copy unavailable, using memory only.", error);
  db = getFirestore(app);
}

// A page restored from the browser's back/forward memory may have lost its hold on the offline copy
// while it was away. Reload it so it starts clean instead of going quiet.
addEventListener("pageshow", (event) => { if (event.persisted && ownsOfflineCopy) location.reload(); });

// Local testing only: a page opened on localhost with ?emu uses the Firebase emulators
// (firebase emulators:start). Never on the live site.
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  try {
    if (new URLSearchParams(location.search).has("emu")) sessionStorage.setItem("anchorboard-emu", "1");
    if (sessionStorage.getItem("anchorboard-emu")) { connectFirestoreEmulator(db, "127.0.0.1", 8080); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); }
  } catch { /* storage blocked */ }
}

// Auth defaults to IndexedDB-backed persistence, which browsers with
// strict tracking/storage protections (e.g. Edge's Tracking Prevention)
// can abort mid-open -- surfacing as an uncaught AbortError on every
// page load. Plain localStorage persistence sidesteps that entirely.
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Sign-out wipes this device's offline copy of the account's Firestore
// data (js/auth.js). Firestore can't be used again on this page after
// it; every sign-out reloads the page.
async function clearOfflineCopy() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (error) {
    console.warn("Calera Math: couldn't clear the offline copy.", error);
  }
}

// Plain HTTPS address for the one read js/cloudSync.js falls back to when the SDK's connection hangs.
const firestoreRestBase = "https://firestore.googleapis.com/v1/projects/steers-class-board/databases/(default)/documents";

// Export for use in other files
export { app, auth, db, clearOfflineCopy, firestoreRestBase, ownsOfflineCopy };
