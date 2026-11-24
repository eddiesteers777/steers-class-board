/* Anchor Board — before a page sends someone to the sign-in page (Nov 23).
   A page that finds no user shows "Still signing in…" and checks once more after the sign-in has fully restored
   (auth.authStateReady) and a short wait, so a slow Chromebook restoring the session is never bounced to login.
   Only a confirmed signed-out user goes to login.html. */
import { auth } from "./firebase.js";

export async function toLoginIfSignedOut(wait = 2500) {
    const n = document.createElement("p"); n.id = "stillSigningIn"; n.setAttribute("role", "status");
    n.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;margin:0;padding:10px 16px;border-radius:12px;background:#fff;color:#0E1B3A;border:1px solid #D5DCE9;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 8px 32px rgba(11,37,89,.12)";
    n.textContent = "Still signing in…";
    (document.body || document.documentElement).appendChild(n);
    try { await auth.authStateReady(); } catch { /* older browsers: the wait below still applies */ }
    await new Promise((r) => setTimeout(r, wait));
    if (auth.currentUser && !auth.currentUser.isAnonymous) { location.reload(); return false; }   // it was only slow: start the page again signed in
    location.replace("login.html");
    return true;
}
