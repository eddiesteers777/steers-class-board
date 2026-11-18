// Saves one early access sign-up to Firestore (waitlist/{auto id}).
// Create-only: the rules let anyone add one well-formed entry and nobody read the list from the site.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore-lite.js";

const app = initializeApp({
    apiKey: "AIzaSyA8kAei_AJMU66EePYQyI8nlVJeLes5HLY",
    authDomain: "steers-class-board.firebaseapp.com",
    projectId: "steers-class-board",
    appId: "1:997357619072:web:8e47464df7c4e329fd2365"
}, "site");
const db = getFirestore(app);

export async function saveSignup(entry) {
    await addDoc(collection(db, "waitlist"), Object.assign({}, entry, { at: serverTimestamp() }));
}
