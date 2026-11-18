/* ==========================================================
   googleRedirect.js -- Google sign-in as a full page trip, for the
   iPhone Home Screen app.

   Google's pop-up window hands its answer back to the page that opened
   it. In the Home Screen app that page gets reloaded as the window
   closes (2026-11-07, read off the ?signincheck box: token received,
   page restarted a second later, never signed in), so the answer is
   lost. Here the whole page goes to Google and Google sends it back to
   auth-return.html with the answer in the address, which that page reads
   when it loads. A reload can't lose it.

   Needs https://steers-class-board.firebaseapp.com/auth-return.html,
   https://anchorboard.web.app/auth-return.html and
   https://steers-class-board.web.app/auth-return.html in the Google Cloud web
   client's Authorized redirect URIs (one per hosting domain). Pure helpers: unit-tested.
   ========================================================== */

export const RETURN_URL = "https://steers-class-board.firebaseapp.com/auth-return.html";
export const RETURN_URL_ANCHORBOARD = "https://anchorboard.web.app/auth-return.html";
export const RETURN_URL_WEBAPP = "https://steers-class-board.web.app/auth-return.html";

/** The return page for the domain the site is running on. */
export function returnUrlForOrigin(origin) {
    if (origin === "https://anchorboard.web.app") return RETURN_URL_ANCHORBOARD;
    if (origin === "https://steers-class-board.web.app") return RETURN_URL_WEBAPP;
    return RETURN_URL;
}
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/** The Google address to send the whole page to. */
export function buildAuthUrl({ clientId, redirectUri = RETURN_URL, state }) {
    const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "token",
        scope: "openid email profile",
        prompt: "select_account",
        include_granted_scopes: "true",
        state
    });
    return `${AUTH_URL}?${q}`;
}

/** Reads what Google put after the # when it sent the page back. */
export function parseReturnHash(hash, expectedState) {
    const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
    if (![...params.keys()].length) return { kind: "none" };
    if (params.get("error")) return { kind: "error", error: params.get("error") };
    if (!expectedState || params.get("state") !== expectedState) return { kind: "error", error: "state-mismatch" };
    const accessToken = params.get("access_token");
    return accessToken ? { kind: "token", accessToken } : { kind: "error", error: "no-token" };
}

/** A fresh random value tying the trip out to the trip back. */
export function newState() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return [...a].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** The Home Screen app, where the pop-up can't be trusted. Only on the real site (a redirect address is registered for each hosting domain). */
export function useRedirectSignIn({ standalone, origin }) {
    return Boolean(standalone) && (origin === "https://steers-class-board.firebaseapp.com" || origin === "https://anchorboard.web.app" || origin === "https://steers-class-board.web.app");
}
