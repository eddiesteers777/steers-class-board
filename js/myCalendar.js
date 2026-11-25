/* ==========================================
   Anchor Board — which school year this page uses (browser only; js/schoolCal.js loads it).

   1. A year the teacher saved (setup.html "Your school year", Home > Settings > School year):
      teacher/{uid}/settings/calendar. See js/calendarRules.js for the shape.
   2. Nothing saved (the Calera account, a new teacher who skipped it, signed out, student guests):
      data/calendar.js, exactly as every page used before. (A new teacher's Home still treats every weekday
      as a school day until they save a year; index.html checks CAL_SOURCE.)
   Never rejects and never waits more than a few seconds: on any trouble the page gets data/calendar.js,
   which is what every page used before Nov 24.

   The saved year is remembered on this device (anchor-cal:<uid>) so later pages open at once, and refreshed
   from the server in the background for the next load.
========================================== */
import { db } from "./firebase.js";
import { waitForUser } from "./auth.js";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { cleanCalendar, yearFromDoc } from "./calendarRules.js?v=1";

const key = (uid) => "anchor-cal:" + uid;
const PATH = (uid) => `teacher/${uid}/settings/calendar`;

function withTimeout(p, ms) {
    let t = 0;
    return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error("timeout")), ms); })]).finally(() => clearTimeout(t));
}
/** This device's copy: { doc } (doc null = checked, nothing saved), or undefined when never checked. */
function cached(uid) {
    try { const v = JSON.parse(localStorage.getItem(key(uid)) || "null"); return v && typeof v === "object" && "doc" in v ? v : undefined; } catch { return undefined; }
}
function remember(uid, d) {
    try { localStorage.setItem(key(uid), JSON.stringify({ doc: d ? cleanCalendar(d) : null })); } catch { /* storage unavailable */ }
}

let pending = null;
/** Resolves { year, source: "saved" | "file" }. fileYear is data/calendar.js's SCHOOL_YEAR. */
export function myYear(fileYear) {
    if (pending) return pending;
    const file = { year: fileYear, source: "file" };
    pending = (async () => {
        let user = null;
        try { user = await withTimeout(waitForUser(), 6000); } catch { return file; }
        if (!user || user.isAnonymous) return file;
        const fromDoc = (d) => { const y = d ? yearFromDoc(d) : null; return y ? { year: y, source: "saved" } : file; };
        const fetchIt = () => getDoc(doc(db, PATH(user.uid))).then((snap) => { const d = snap.exists() ? snap.data() : null; remember(user.uid, d); return d; });
        const known = cached(user.uid);
        if (known !== undefined) { fetchIt().catch(() => {}); return fromDoc(known.doc); }
        try { return await fromDoc(await withTimeout(fetchIt(), 5000)); } catch { return file; }
    })().catch(() => file);
    return pending;
}

/** Save the teacher's year (setup.html). Returns the cleaned document. Throws when it isn't usable or can't be saved. */
export async function saveCalendar(d) {
    const user = await waitForUser();
    if (!user || user.isAnonymous) throw new Error("signed out");
    const clean = cleanCalendar(d);
    if (!clean) throw new Error("bad calendar");
    await setDoc(doc(db, PATH(user.uid)), Object.assign({}, clean, { at: serverTimestamp() }));
    remember(user.uid, clean);
    return clean;
}

/** Remove the saved year, so the account goes back to its built-in one (Calera: data/calendar.js). */
export async function clearCalendar() {
    const user = await waitForUser();
    if (!user || user.isAnonymous) throw new Error("signed out");
    await deleteDoc(doc(db, PATH(user.uid)));
    remember(user.uid, null);
}
