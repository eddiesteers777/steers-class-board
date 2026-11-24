// ==========================================
// Calera Math Authentication
// ==========================================

import { auth, clearOfflineCopy } from "./firebase.js";

import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithCredential,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { prewarmGoogleSignIn, googleSignInReady, requestGoogleAccessToken, GOOGLE_CLIENT_ID } from "./googleSignIn.js";
import { trail } from "./signInTrail.js";
import { retryOnNetworkError } from "./signInRetry.js";
import { buildAuthUrl, newState, returnUrlForOrigin, useRedirectSignIn } from "./googleRedirect.js";

// ?signincheck shows the sign-in steps on screen (js/signInCheck.js).
try {
    const ask = new URLSearchParams(location.search).get("signincheck");
    if (ask === "off") sessionStorage.removeItem("school-signincheck");
    else if (ask !== null) sessionStorage.setItem("school-signincheck", "1");
    if (sessionStorage.getItem("school-signincheck") === "1") import("./signInCheck.js").catch(() => {});
} catch { /* storage unavailable */ }

const provider = new GoogleAuthProvider();

// Load Google's sign-in script now, so the tap can open its window right away.
prewarmGoogleSignIn();

// Account-sensitive browser state must not survive an account switch.
// Device-only UI preferences are deliberately not in this list.
const ACCOUNT_LOCAL_STORAGE_KEYS = [
    "school-nav-access",
    "school-account-role",
    "school-live-session",
    "school-current-class",
    "school-current-week",
    "school-current-day",
    "school-timer-state",
    "school-whiteboard-open",
    "school-account-storage-owner",
    "school-splash-day",
    "school-start-pending",
    "school-guest-stash"
];

const ACCOUNT_LOCAL_STORAGE_PREFIXES = [
    "school-draft:",
    "school-live:",
    "school-week:"
];

// Which lessons an account sees, and a new teacher's setup (js/contentPack.js). Cleared on sign-out and account switch
// so a stale "starter" can never carry into another session (Nov 23). Kept out of hasLegacyAccountState(): their
// presence alone must not trigger the clear-and-reload that an account switch does.
const ACCOUNT_CACHE_PREFIXES = ["focal-pack:", "focal-setup:"];

const ACCOUNT_SESSION_STORAGE_KEYS = [
    "school-role-reloaded",
    "school-signincheck",
    "school-loadcheck"
];

const ACCOUNT_STORAGE_OWNER_KEY = "school-account-storage-owner";
let preparedAccountUid;
let accountPreparation = Promise.resolve();
let accountReloadRequested = false;

function getStorageOwner() {
    try { return localStorage.getItem(ACCOUNT_STORAGE_OWNER_KEY); } catch { return null; }
}

function setStorageOwner(uid) {
    try {
        if (uid) localStorage.setItem(ACCOUNT_STORAGE_OWNER_KEY, uid);
        else localStorage.removeItem(ACCOUNT_STORAGE_OWNER_KEY);
    } catch { /* storage unavailable */ }
}

function hasLegacyAccountState() {
    try {
        for (const key of ACCOUNT_LOCAL_STORAGE_KEYS) {
            if (localStorage.getItem(key) !== null) return true;
        }
        for (const prefix of ACCOUNT_LOCAL_STORAGE_PREFIXES) {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key?.startsWith(prefix)) return true;
            }
        }
        for (const key of ACCOUNT_SESSION_STORAGE_KEYS) {
            if (sessionStorage.getItem(key) !== null) return true;
        }
    } catch { /* storage unavailable */ }
    return false;
}

export function clearAccountSensitiveBrowserState() {
    for (const key of ACCOUNT_LOCAL_STORAGE_KEYS) {
        try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
    }
    for (const prefix of ACCOUNT_LOCAL_STORAGE_PREFIXES) {
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key?.startsWith(prefix)) localStorage.removeItem(key);
            }
        } catch { /* storage unavailable */ }
    }
    for (const key of ACCOUNT_SESSION_STORAGE_KEYS) {
        try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
    }
    for (const prefix of ACCOUNT_CACHE_PREFIXES) {
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key?.startsWith(prefix)) localStorage.removeItem(key);
            }
        } catch { /* storage unavailable */ }
    }
    clearLinkedPlaybook();
    clearLinked75();
}

// Calera Math Playbook work (js/playbook/cloud.js) belongs to the device until it is linked to an
// account (school-playbook-owner). A guest's work survives sign-in and is offered to the account;
// work already linked leaves with the account on sign-out or an account switch.
function clearLinkedPlaybook() {
    try {
        if (!localStorage.getItem("school-playbook-owner")) return;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith("school-playbook-") && key !== "school-playbook-theme") localStorage.removeItem(key);
        }
    } catch { /* storage unavailable */ }
}

// The 75-day challenge (js/seventyFiveCloud.js) works the same way: it stays on a device used as a
// guest, and leaves with the account once linked (school-75-owner).
function clearLinked75() {
    try {
        if (!localStorage.getItem("school-75-owner")) return;
        localStorage.removeItem("school-75-state");
        localStorage.removeItem("school-75-owner");
    } catch { /* storage unavailable */ }
}

// The Fueling calculator works without an account (js/guestFuel.js). A guest who used it and then
// signs in would lose that work to the clear below, so their "fueling-" keys are set aside first,
// tied to the account that signed in; the Fueling page offers to add them. Only from a device with
// no account on it (no owner) that was used as a guest for fueling (the mark).
const GUEST_FUEL_MARK = "school-guest-fueling";
const GUEST_FUEL_STASH = "school-guest-fueling-stash";
function takeGuestFueling() {
    try {
        if (localStorage.getItem(GUEST_FUEL_MARK) !== "1") return null;
        const keys = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith("fueling-")) keys[key] = localStorage.getItem(key);
        }
        return Object.keys(keys).length ? keys : null;
    } catch { return null; }
}

// The "Get started" page (start.html) keeps a guest's taps in school-start-answers. At first sign-in from a
// device with no account on it they are set aside for that account (js/startCarry.js writes them in).
function takeStartAnswers() {
    try {
        const raw = localStorage.getItem("school-start-answers");
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function prepareAccountState(user) {
    const nextUid = user?.uid || null;
    const owner = getStorageOwner();
    const firstPreparation = preparedAccountUid === undefined;
    // Signing in on a page that was signed out is not a switch: there is no other account's copy to clear (an old
    // account left on this device is caught by ownerMismatch). Counting it made the sign-in page clear and reload itself
    // just as it was opening the home screen, so the first Google sign-in landed back on the sign-in page (2026-11-21).
    const uidChanged = !firstPreparation && preparedAccountUid !== null && preparedAccountUid !== nextUid;
    const ownerMismatch = nextUid && owner && owner !== nextUid;
    const signedOutOwner = !nextUid && owner;
    const legacyAccountState = nextUid && !owner && hasLegacyAccountState();
    const changed = Boolean(uidChanged || ownerMismatch || signedOutOwner || legacyAccountState);
    const guestFueling = nextUid && !owner ? takeGuestFueling() : null;
    const startAnswers = nextUid && !owner ? takeStartAnswers() : null;

    if (changed) {
        clearAccountSensitiveBrowserState();
        setStorageOwner(null);
        await clearOfflineCopy();
    }

    if (nextUid) {
        try {
            localStorage.removeItem(GUEST_FUEL_MARK);
            if (startAnswers) {
                localStorage.setItem("school-start-pending", JSON.stringify({ uid: nextUid, at: Date.now(), answers: startAnswers }));
            }
            localStorage.removeItem("school-start-answers");
            if (guestFueling) localStorage.setItem(GUEST_FUEL_STASH, JSON.stringify({ uid: nextUid, at: Date.now(), keys: guestFueling }));
        } catch { /* storage unavailable: the guest's work is lost, as before */ }
    }

    setStorageOwner(nextUid);
    preparedAccountUid = nextUid;
    return { changed };
}

function reloadAfterAccountTransition(changed) {
    if (!changed || accountReloadRequested || typeof window === "undefined") return;
    accountReloadRequested = true;
    window.location.reload();
}

function queueAccountPreparation(user) {
    accountPreparation = accountPreparation
        .catch(() => {})
        .then(() => prepareAccountState(user));
    return accountPreparation;
}

// A single auth-state watcher is installed as soon as this module loads.
// Every caller below waits for its cleanup work, so a changed Firebase user
// cannot immediately inherit the prior account's browser/Firestore state.
onAuthStateChanged(auth, (user) => {
    queueAccountPreparation(user).then(async result => {
        trail("auth-state", user ? "signed in" : "signed out");
        if (result.changed) trail("account-ready", "cleared+reload");
        // Seed/repair the account profile and its minimal client directory
        // before an account-transition reload. This removes the race where
        // the old auth flow could reload before page bootstrap repaired an
        // existing active client account.
        if (user) {
            try {
                const { ensureProfile } = await import("./userProfile.js");
                await ensureProfile();
                // Taps from the "Get started" page join the new account's profile.
                const { carryStartAnswers } = await import("./startCarry.js");
                await carryStartAnswers(user).catch(error => console.warn("Calera Math: start answers not saved yet.", error));
            } catch (error) {
                // A temporary Firestore failure must not make sign-in fail.
                // The normal page bootstrap will retry on the next load.
                console.warn("Calera Math: signed-in account bootstrap failed.", error);
            }
        }
        reloadAfterAccountTransition(result.changed);
    });
});

export function waitForAccountIsolation() {
    return accountPreparation;
}

// ==========================================
// Login
// ==========================================

export async function login() {

    try {

        // Home Screen app: the pop-up's answer is lost when that page reloads, so go out and come back by full page.
        if (useRedirectSignIn({ standalone: matchMedia("(display-mode: standalone)").matches || navigator.standalone === true, origin: location.origin })) {
            const state = newState();
            try { localStorage.setItem("school-oauth-state", JSON.stringify({ state, at: Date.now(), back: "index.html" })); } catch { /* storage unavailable */ }
            trail("login-start", "full page");
            location.href = buildAuthUrl({ clientId: GOOGLE_CLIENT_ID, redirectUri: returnUrlForOrigin(location.origin), state });
            return new Promise(() => {});   // the page is leaving; nothing after this should run
        }
        const viaGoogle = googleSignInReady();
        trail("login-start", viaGoogle ? "google window" : "popup");
        if (viaGoogle) {
            // Google's own window: no firebaseapp.com page, which iPhone Safari can't finish.
            const accessToken = await requestGoogleAccessToken();
            trail("google-token", "received");
            // The first request after Google's window closes can be dropped on iPhone: try again before giving up.
            await retryOnNetworkError(
                () => signInWithCredential(auth, GoogleAuthProvider.credential(null, accessToken)),
                { onRetry: n => trail("login-retry", "network, try " + (n + 1)) }
            );
        } else {
            await signInWithPopup(auth, provider);
        }
        await waitForAccountIsolation();
        trail("login-ok", getCurrentUser() ? "user set" : "NO USER");
        // A fresh sign-in always reads the whole cloud copy on the next page, never "nothing changed".
        try { localStorage.removeItem("__cloudSyncVersion"); localStorage.removeItem("__cloudSyncFullPullAt"); } catch { /* storage unavailable */ }

        return true;

    } catch (error) {

        console.error("Login Error:", error);
        trail("login-fail", error?.code || error?.message || "error");

        // Say why, unless the person just closed the Google window themselves.
        // Imported when needed so sign-in code carries no UI on its own.
        try {
            const [{ signInFailureMessage }, { toast }] = await Promise.all([
                import("./signInErrors.js"),
                import("./ui.js")
            ]);
            const message = signInFailureMessage(error);
            if (message) toast(message, { type: "error" });
        } catch { /* the message is a courtesy; failing to show it changes nothing */ }

        return false;

    }

}

// ==========================================
// Logout
// ==========================================

export async function logout() {

    try {

        await signOut(auth);

    } catch (error) {

        console.error("Logout Error:", error);

    }

    // The auth-state watcher also performs this cleanup for passive
    // account transitions in other tabs. Do it here too so an explicit
    // logout does not depend on callback timing.
    clearAccountSensitiveBrowserState();
    setStorageOwner(null);
    await clearOfflineCopy();
    preparedAccountUid = null;

}

// ==========================================
// Current User
// ==========================================

export function getCurrentUser() {

    return auth.currentUser;

}

// ==========================================
// Wait for Authentication
// ==========================================

export function waitForUser() {

    return new Promise((resolve) => {

        const unsubscribe = onAuthStateChanged(auth, (user) => {

            unsubscribe();
            queueAccountPreparation(user).then(result => {
                reloadAfterAccountTransition(result.changed);
                resolve(user);
            });

        });

    });

}

// ==========================================
// Protect Pages
// ==========================================

export async function requireLogin() {

    const user = await waitForUser();

    if (!user) {

        window.location.href = "login.html";

        return null;

    }

    return user;

}

// ==========================================
// Listen for Auth Changes
// ==========================================

export function listenForAuth(callback) {

    return onAuthStateChanged(auth, (user) => {

        queueAccountPreparation(user).then(result => {
            reloadAfterAccountTransition(result.changed);
            callback(user);
        });

    });

}

// ==========================================
// Update Header (Optional)
// ==========================================

export function setupHeader() {

    const userName = document.getElementById("user-name");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (!userName || !loginBtn || !logoutBtn) return;

    onAuthStateChanged(auth, (user) => {

        queueAccountPreparation(user).then(() => {

            if (user) {

            userName.textContent = user.displayName || "Runner";

            loginBtn.style.display = "none";
            logoutBtn.style.display = "inline-block";

            } else {

                userName.textContent = "Guest";

                loginBtn.style.display = "inline-block";
                logoutBtn.style.display = "none";

            }

        });

    });

}
