// Saves one early access sign-up to Firestore (waitlist/{auto id}).
// Create-only: the rules let anyone add one well-formed entry and nobody read the list from the site.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { firebaseConfig } from "../js/firebaseConfig.js?v=1";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore-lite.js";

const app = initializeApp(firebaseConfig, "site");
const db = getFirestore(app);

export async function saveSignup(entry) {
    await addDoc(collection(db, "waitlist"), Object.assign({}, entry, { at: serverTimestamp() }));
}
