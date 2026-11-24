/* ==========================================
   Anchor Board — which built-in lessons an account sees.

   The site ships with Mr. Steers' Calera weeks built into the code (data/weeks.js).
   Other teachers should not land on his classes, so every account gets a "pack":
     "calera"   the Calera weeks, periods and classes (Mr. Steers' account)
     "starter"  one made-up sample week and one sample class, for any new teacher
   The choice is saved once at teacher/{uid}/settings/pack as { pack, how, at }.

   An account that already has board, week or roster data from before this change
   is an existing account and keeps the Calera weeks, so nothing changes for it.
   A brand-new account gets the starter pack.

   Signed out (the guest sub page) and student guests keep the Calera weeks, as before.
   When the choice can't be read (offline, first load), the Calera weeks show and
   nothing is saved, so a bad connection never moves an account.

   Fixed Nov 23 (Eddie's account was saved as "starter", "new account", at 1:37 PM while his rosters and Week 5
   existed, and Plan, his classes and the Calera weeks disappeared):
     - "starter" is NEVER inferred and saved. Only an explicit choice saves it (choosePack, or ?pack=starter).
       Real data found on the server saves "calera" (existing account); finding nothing is inconclusive:
       the Calera weeks show and nothing is saved.
     - A saved "starter" that was inferred (how: "new account", from before this fix) is not trusted: it is
       checked again like an unsaved choice.
     - Every check reads the server (getDocFromServer); a device copy can never answer "missing".
     - A remembered "starter" on this device is checked with the server before a page uses it.
     - What happened is logged to the sign-in trail (?signincheck): cached / decided / fallback and each check.

   ?pack=starter or ?pack=calera on any signed-in page sets it by hand (for testing).
========================================== */
import { db } from "./firebase.js";
import { waitForUser } from "./auth.js";
import { doc, getDoc, getDocFromServer, getDocsFromServer, collection, query, limit, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { trail } from "./signInTrail.js";
import { PACKS, EVIDENCE_DOCS, EVIDENCE_COLLECTIONS, trusted, inferPack } from "./packRules.js?v=1";
export { PACKS, EVIDENCE_DOCS, EVIDENCE_COLLECTIONS, trusted, inferPack };

const FALLBACK = "calera";
const cacheKey = (uid) => "focal-pack:" + uid;

function cached(uid) {
    try { const v = localStorage.getItem(cacheKey(uid)); return PACKS.includes(v) ? v : null; } catch { return null; }
}
function remember(uid, pack) {
    try { localStorage.setItem(cacheKey(uid), pack); } catch { /* storage unavailable */ }
}
function withTimeout(p, ms) {
    let t = 0;
    return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error("timeout")), ms); })]).finally(() => clearTimeout(t));
}
function asked() {
    try { const v = new URLSearchParams(location.search).get("pack"); return PACKS.includes(v) ? v : null; } catch { return null; }
}

const SHORT = { "rosters/all": "rosters", "board/state": "board", "weekfiles/index": "wfindex", "settings/bells": "bells", "data/index": "data", "weekfiles/*": "weekfiles*", "plans/*": "plans*" };
let INFO = { pack: null, source: "", why: "", checks: null, confirmed: false };
/** What decided this page's pack: { pack, source: cached|decided|fallback|asked, why, checks, confirmed }. */
export const packInfo = () => Object.assign({}, INFO);
const log = (source, pack, why, checks) => {
    INFO = { pack, source, why, checks: checks || null, confirmed: source === "decided" || source === "asked" };
    // Two short lines (the sign-in trail keeps 80 characters a line): the decision and why, then each check (+ found, - not)
    trail("pack " + source + ": " + pack, why);
    if (checks) trail("pack checks", Object.keys(checks).map((k) => (SHORT[k] || k) + (checks[k] ? "+" : "-")).join(" "));
};

/** Read the saved choice and every evidence check from the server. Throws when the server can't be reached. */
async function readServer(uid, always) {
    const snap = await getDocFromServer(doc(db, `teacher/${uid}/settings/pack`));
    const saved = snap.exists() ? snap.data() : null;
    if (trusted(saved) && !always) return { saved, found: null };   // a trusted choice needs no evidence (Home's restore check asks for it anyway)
    const found = {};
    await Promise.all([
        ...EVIDENCE_DOCS.map((p) => getDocFromServer(doc(db, `teacher/${uid}/${p}`)).then((s) => { found[p] = s.exists(); })),
        ...EVIDENCE_COLLECTIONS.map((c) => getDocsFromServer(query(collection(db, `teacher/${uid}/${c}`), limit(1))).then((q) => { found[c + "/*"] = !q.empty; })),
    ]);
    return { saved, found };
}

/** Decide (and, only on real evidence, save) the pack for a signed-in teacher. Throws when Firestore can't be reached. */
async function decide(uid) {
    const ref = doc(db, `teacher/${uid}/settings/pack`);
    const want = asked();
    if (want) {
        await setDoc(ref, { pack: want, how: "set by hand", at: serverTimestamp() });
        log("asked", want, "?pack=" + want);
        return want;
    }
    const { saved, found } = await readServer(uid);
    const r = inferPack(saved, found);
    if (r.save) await setDoc(ref, { pack: "calera", how: "existing account", at: serverTimestamp() });
    log("decided", r.pack, r.why, found);
    return r.pack;
}

/** An explicit choice from the teacher (setup.html "Start with my own classes", Home "Restore my Calera classes"). */
export async function choosePack(pack, how) {
    if (!PACKS.includes(pack)) throw new Error("unknown pack");
    const user = await waitForUser();
    if (!user || user.isAnonymous) throw new Error("signed out");
    await setDoc(doc(db, `teacher/${user.uid}/settings/pack`), { pack, how: String(how || "chosen").slice(0, 40), at: serverTimestamp() });
    remember(user.uid, pack);
    trail("pack chosen: " + pack, how || "chosen");
    return pack;
}

/** For Home: true when this account has real Calera work on the server (rosters, week files, plans...). */
export async function hasRealWork() {
    const user = await waitForUser(); if (!user || user.isAnonymous) return false;
    try { const { found } = await readServer(user.uid, true); return !!found && Object.values(found).some(Boolean); }
    catch { return false; }
}

let pending = null;
/** Resolves "calera" or "starter" for whoever is on this page. Never rejects. "starter" only after the server confirms an explicit choice. */
export function myPack() {
    if (pending) return pending;
    pending = (async () => {
        let user = null;
        try { user = await withTimeout(waitForUser(), 6000); } catch { log("fallback", FALLBACK, "sign-in not restored in 6 s"); return FALLBACK; }
        if (!user || user.isAnonymous) { log("fallback", FALLBACK, user ? "guest or linked screen" : "signed out"); return FALLBACK; }
        const known = asked() ? null : cached(user.uid);
        if (known === "calera") {
            // Fast path: use the remembered Calera choice now and refresh it quietly for next time.
            log("cached", known, "remembered on this device");
            decide(user.uid).then((p) => remember(user.uid, p)).catch(() => {});
            return known;
        }
        // Nothing remembered, or a remembered "starter": the server decides before the page uses it.
        try {
            const p = await withTimeout(decide(user.uid), 5000);
            remember(user.uid, p);
            return p;
        } catch (e) {
            log("fallback", FALLBACK, "server not reached (" + ((e && e.message) || "error") + "); nothing saved");
            return FALLBACK;
        }
    })();
    return pending;
}

/* ---------- A new teacher's own setup (setup.html) ----------
   teacher/{uid}/settings/setup = {
     name, school, grades: ["6","7"], subject,
     classes: [{ p: "1st", label: "Math 6", room: "112" }, ...],   one row per period, in bell order
     done: true, at
   }
   Pages read it through mySetup(); setup.html saves it with saveSetup(). */
const setupKey = (uid) => "focal-setup:" + uid;
function cachedSetup(uid) {
    try { const v = JSON.parse(localStorage.getItem(setupKey(uid)) || "null"); return v && typeof v === "object" ? v : null; } catch { return null; }
}
function rememberSetup(uid, s) {
    try { localStorage.setItem(setupKey(uid), JSON.stringify(s || {})); } catch { /* storage unavailable */ }
}
/** Keep only well-formed fields, so a bad document can never break a page. */
export function cleanSetup(d) {
    const s = d && typeof d === "object" ? d : {};
    const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
    const seen = new Set();
    const classes = (Array.isArray(s.classes) ? s.classes : []).map((c) => ({ p: str(c && c.p, 12), label: str(c && c.label, 40), room: str(c && c.room, 20) }))
        .filter((c) => c.p && c.label && !seen.has(c.p) && seen.add(c.p)).slice(0, 10);
    return {
        name: str(s.name, 40), school: str(s.school, 60), subject: str(s.subject, 30),
        grades: (Array.isArray(s.grades) ? s.grades : []).map((g) => str(g, 6)).filter(Boolean).slice(0, 8),
        classes, done: s.done === true
    };
}

let setupPending = null;
/** Resolves the signed-in teacher's setup (cleaned), or null when signed out. Never rejects. */
export function mySetup() {
    if (setupPending) return setupPending;
    setupPending = (async () => {
        let user = null;
        try { user = await withTimeout(waitForUser(), 6000); } catch { return null; }
        if (!user || user.isAnonymous) return null;
        const ref = doc(db, `teacher/${user.uid}/settings/setup`);
        const fetchIt = () => getDoc(ref).then((snap) => { const s = cleanSetup(snap.exists() ? snap.data() : null); rememberSetup(user.uid, s); return s; });
        const known = cachedSetup(user.uid);
        if (known) { fetchIt().catch(() => {}); return cleanSetup(known); }
        try { return await withTimeout(fetchIt(), 5000); } catch { return null; }
    })();
    return setupPending;
}

/** Save the setup (setup.html). Also updates this device's copy so the next page uses it at once. */
export async function saveSetup(s) {
    const user = await waitForUser();
    if (!user) throw new Error("signed out");
    const clean = cleanSetup(s);
    rememberSetup(user.uid, clean);
    await setDoc(doc(db, `teacher/${user.uid}/settings/setup`), Object.assign({}, clean, { at: serverTimestamp() }));
    return clean;
}
