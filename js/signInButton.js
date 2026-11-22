/* ==========================================================
   signInButton.js -- the "Sign In with Google" button on home.html
   and login.html.

   Nov 16 live test: the first Google window closed without finishing.
   Two things made that worse, both fixed here:
   - The page went on to the dashboard even when sign-in had failed,
     and the dashboard sent it straight back. Now it stays put and says so.
   - A tap before Google's script had loaded fell back to a different
     sign-in window. Now the button waits (a few seconds at most) until
     Google's window can open straight from the tap.
   ========================================================== */
import { login } from "./auth.js";
import { googleSignInReady } from "./googleSignIn.js";
import { trail } from "./signInTrail.js";
import { showLoader, hideLoader } from "./anchorLoader.js?v=1";

export function wireSignIn(button, note) {
    const say = (t) => { note.textContent = t; };
    const label = button.textContent;
    // Wait for Google's script so the tap opens Google's own window. Give up waiting after 4 s.
    if (!googleSignInReady()) {
        button.disabled = true; button.textContent = "Getting sign-in ready…";
        const t0 = Date.now(), iv = setInterval(() => {
            if (googleSignInReady() || Date.now() - t0 > 4000) { clearInterval(iv); button.disabled = false; button.textContent = label; }
        }, 100);
    }
    let busy = false;
    button.addEventListener("click", async () => {
        if (busy) return;   // one sign-in at a time; a second request would cancel the first
        busy = true; button.disabled = true;
        say("A Google window is opening. Choose your account there.");
        showLoader("Choose your account in the Google window.");
        let ok = false;
        try { ok = await login(); } catch { ok = false; }
        if (ok) { say("Signed in. Opening Anchor Board…"); showLoader("Signed in. Opening Anchor Board…"); location.replace("index.html"); return; }
        hideLoader();
        trail("login-stayed", "sign-in did not finish");
        say("Sign-in didn't finish. Tap Sign In with Google to try again.");
        busy = false; button.disabled = false; button.textContent = label; button.focus();
    });
}
