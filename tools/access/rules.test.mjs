// The approved list in firestore.rules, against the Firestore emulator.
// Run: firebase emulators:exec --only firestore "node tools/access/rules.test.mjs"
// Needs @firebase/rules-unit-testing (RULES_TESTING=path/to/node_modules/@firebase/rules-unit-testing) and the firebase SDK.
// OWNER_EMAIL is the address whose hash is in OWNER_HASHES; it is passed in, never written here.
import fs from "node:fs"; import assert from "node:assert/strict";
const RT = await import(process.env.RULES_TESTING || "@firebase/rules-unit-testing");
const F = await import(process.env.FIRESTORE_SDK || "firebase/firestore");
const { initializeTestEnvironment, assertSucceeds, assertFails } = RT;
const { doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp } = F;
const OWNER = process.env.OWNER_EMAIL; if (!OWNER) throw new Error("set OWNER_EMAIL");
const env = await initializeTestEnvironment({ projectId: "steers-class-board", firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
await env.clearFirestore();
const g = (uid, email, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified, firebase: { sign_in_provider: "google.com" } }).firestore();
const owner = g("owner1", OWNER.toUpperCase());          // the hash check ignores capitals
const stranger = g("str1", "stranger@example.com");
const later = g("new1", "New.Teacher@Example.com");       // approved below, by its lowercase address
const unverified = g("unv1", "new.teacher@example.com", false);
const guest = env.authenticatedContext("anon1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
let n = 0; const ok = async (p, why) => { await assertSucceeds(p); n++; }, no = async (p, why) => { await assertFails(p); n++; };

// owner: own space, the list and the waitlist
await ok(setDoc(doc(owner, "teacher/owner1/board/state"), { s: 1 }));
await ok(getDoc(doc(owner, "teacher/owner1/board/state")));
await ok(setDoc(doc(owner, "teacher/owner1"), { name: "x" }));
// stranger: signed in, nothing works, and they can see that they are not on the list
await no(setDoc(doc(stranger, "teacher/str1/board/state"), { s: 1 }));
await no(getDoc(doc(stranger, "teacher/str1/board/state")));
await no(setDoc(doc(stranger, "teacher/str1"), { name: "x" }));
await no(setDoc(doc(stranger, "rooms/123456"), { owner: "str1" }));
await no(setDoc(doc(stranger, "asg/123456"), { owner: "str1", kind: "asg" }));
await no(setDoc(doc(stranger, "pub/str1"), { a: 1 }));
await ok(getDoc(doc(stranger, "access/stranger@example.com")));
await no(getDoc(doc(stranger, "access/new.teacher@example.com")));
await no(getDocs(collection(stranger, "access")));
await no(setDoc(doc(stranger, "access/stranger@example.com"), { email: "stranger@example.com", at: serverTimestamp(), from: "added" }));
await no(getDocs(collection(stranger, "waitlist")));
// owner approves the new teacher
await no(setDoc(doc(owner, "access/New.Teacher@example.com"), { email: "New.Teacher@example.com", at: serverTimestamp(), from: "added" }));   // id must be lowercase
await no(setDoc(doc(owner, "access/new.teacher@example.com"), { email: "new.teacher@example.com", at: serverTimestamp(), from: "nope" }));
await no(setDoc(doc(owner, "access/new.teacher@example.com"), { email: "new.teacher@example.com", at: serverTimestamp(), from: "added", extra: 1 }));
await ok(setDoc(doc(owner, "access/new.teacher@example.com"), { email: "new.teacher@example.com", at: serverTimestamp(), from: "waitlist", note: "From the list" }));
await ok(getDocs(collection(owner, "access")));
// now the new teacher works in their own space only
await ok(setDoc(doc(later, "teacher/new1/board/state"), { s: 1 }));
await ok(getDoc(doc(later, "teacher/new1/board/state")));
await no(getDoc(doc(later, "teacher/owner1/board/state")));
await ok(setDoc(doc(later, "rooms/234567"), { owner: "new1", status: "lobby" }));
await ok(getDoc(doc(later, "access/new.teacher@example.com")));
await no(getDocs(collection(later, "access")));
await no(getDocs(collection(later, "waitlist")));
await no(deleteDoc(doc(later, "access/new.teacher@example.com")));
// same address, but Google has not verified it: no
await no(setDoc(doc(unverified, "teacher/unv1/board/state"), { s: 1 }));
// student guests are unchanged: they can still join a room and write their own entry
await ok(getDoc(doc(guest, "rooms/234567")));
await ok(setDoc(doc(guest, "rooms/234567/p/anon1"), { nm: "Ava R.", at: 1 }));
await no(setDoc(doc(guest, "teacher/anon1/board/state"), { s: 1 }));
// waitlist: anyone can still join; only the owner reads or clears it
const pub = env.unauthenticatedContext().firestore();
await ok(setDoc(doc(pub, "waitlist/w1"), { grades: "middle", board: "promethean", device: "chromebook", email: "a@b.co", at: serverTimestamp() }));
await no(getDocs(collection(pub, "waitlist")));
await ok(getDocs(collection(owner, "waitlist")));
await no(setDoc(doc(owner, "waitlist/w1"), { grades: "high", board: "promethean", device: "chromebook", email: "a@b.co", at: serverTimestamp() }));
await ok(deleteDoc(doc(owner, "waitlist/w1")));
// removing someone shuts them out again
await ok(deleteDoc(doc(owner, "access/new.teacher@example.com")));
await no(getDoc(doc(later, "teacher/new1/board/state")));
await env.cleanup();
console.log("access rules: " + n + " checks passed");
