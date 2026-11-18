/* ==========================================
   Anchor Board — everything one teacher account has saved, and deleting it.

   A teacher's data lives under teacher/{uid}/<collection>/<doc>, their posted Class Pages under
   pub/{uid}/..., and an open student game under rooms/{code}/... (found from games/room and
   games/notes). The Firestore rules already let a signed-in teacher read and delete all of it.

   KEEP COLLECTIONS UP TO DATE: a new top-level folder under teacher/{uid}/ must be added here,
   or "Delete all my data" would leave it behind.
========================================== */
import { db } from "./firebase.js";
import { waitForUser } from "./auth.js";
import { doc, collection, getDoc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export const COLLECTIONS = [
    ["board", "What the board is showing"],
    ["ink", "Whiteboard drawings"],
    ["games", "Question sets, games and game results"],
    ["weekfiles", "Weeks you built or approved"],
    ["pdfs", "PDF notes you uploaded"],
    ["pdfpages", "Pages of those PDF notes"],
    ["plans", "Week plans"],
    ["planner", "Planner"],
    ["standards", "Standards marked taught"],
    ["closeout", "Week close-out checklists"],
    ["data", "Class Data (scores and imports)"],
    ["work", "Student Work (scanned papers)"],
    ["rosters", "Rosters"],
    ["tally", "Behavior tally"],
    ["settings", "Settings, bell times and your classes"]
];

async function deleteAll(paths, onStep) {
    for (let i = 0; i < paths.length; i += 400) {
        const b = writeBatch(db);
        paths.slice(i, i + 400).forEach((p) => b.delete(doc(db, p)));
        await b.commit();
        if (onStep) onStep(Math.min(i + 400, paths.length));
    }
}
const docsIn = async (path) => (await getDocs(collection(db, path))).docs.map((d) => d.ref.path);

/** Counts of saved documents, by collection: [{ id, label, count }]. */
export async function summary() {
    const user = await waitForUser(); if (!user) return null;
    const out = [];
    for (const [id, label] of COLLECTIONS) out.push({ id, label, count: (await docsIn(`teacher/${user.uid}/${id}`)).length });
    out.push({ id: "pub", label: "Posted Class Pages", count: (await docsIn(`pub/${user.uid}/weeks`)).length });   // plus the index at pub/{uid}
    return out;
}

/** Room codes this teacher may still have open (Vault Raid and live notes). */
async function roomCodes(uid) {
    const codes = new Set();
    try { const r = await getDoc(doc(db, `teacher/${uid}/games/room`)); const c = r.exists() && r.data().code; if (/^[1-9]\d{5}$/.test(c || "")) codes.add(c); } catch { /* none */ }
    try {
        const n = await getDoc(doc(db, `teacher/${uid}/games/notes`)); const d = n.exists() ? n.data() : {};
        if (/^[1-9]\d{5}$/.test(d.code || "")) codes.add(d.code);
        Object.values(d.codes || {}).forEach((c) => { if (/^[1-9]\d{5}$/.test(String(c))) codes.add(String(c)); });
    } catch { /* none */ }
    return [...codes];
}

/**
 * Delete everything this account saved. onProgress(text) reports each step.
 * Resolves the number of documents deleted. Throws on a failure part way (what was deleted stays deleted).
 */
export async function deleteEverything(onProgress = () => {}) {
    const user = await waitForUser(); if (!user) throw new Error("signed out");
    const uid = user.uid; let n = 0;
    // Open student game rooms first: their rules check this teacher owns them.
    for (const code of await roomCodes(uid)) {
        try {
            const r = await getDoc(doc(db, `rooms/${code}`));
            if (!r.exists() || r.data().owner !== uid) continue;
            const kids = [...await docsIn(`rooms/${code}/p`), ...await docsIn(`rooms/${code}/s`)];
            await deleteAll(kids); await deleteAll([`rooms/${code}`]); n += kids.length + 1;
            onProgress("Closed student game room " + code);
        } catch { /* a room another teacher reused, or already gone */ }
    }
    for (const [id, label] of COLLECTIONS) {
        const paths = await docsIn(`teacher/${uid}/${id}`);
        if (paths.length) { onProgress("Deleting " + label.toLowerCase() + " (" + paths.length + ")"); await deleteAll(paths); n += paths.length; }
    }
    // Class Pages: every posted week, plus the index document if one exists (js/publish.js).
    const pub = await docsIn(`pub/${uid}/weeks`);
    if ((await getDoc(doc(db, `pub/${uid}`))).exists()) pub.push(`pub/${uid}`);
    if (pub.length) { onProgress("Taking down posted Class Pages (" + pub.length + ")"); await deleteAll(pub); n += pub.length; }
    await deleteAll([`teacher/${uid}`]); n += 1;
    onProgress("Done");
    return n;
}
