/* ==========================================
   Signing the teacher in: Google first, then the same Firebase sign-in the website uses.

   1. Google sign-in (the Firebase project's own web client) gives a Google ID token.
   2. Firebase's signInWithIdp turns it into a Firebase user (the same uid as on the website)
      and a Firebase refresh token, which is kept, encrypted, with Claude's access grant.
   3. Before each use, the refresh token gets a fresh one-hour Firebase ID token, and Firestore
      checks that token against the database rules like any page of the site.
   No service account key is used anywhere.

   The URLs can be pointed at a local stand-in for testing (wrangler.jsonc env "local" only).
========================================== */
const url = (env, key, real) => (env[key] || real);

export function googleAuthUrl(env, { state, redirectUri, codeChallenge }) {
    const q = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code",
        scope: "openid email", state, code_challenge: codeChallenge, code_challenge_method: "S256",
        prompt: "select_account", login_hint: env.ALLOWED_EMAIL || "",
    });
    return url(env, "GOOGLE_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth") + "?" + q;
}

/** Google code -> { idToken, email } after checking the email is the one teacher allowed. */
export async function googleExchange(env, { code, redirectUri, verifier }) {
    const res = await fetch(url(env, "GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token"), {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
    });
    if (!res.ok) throw new Error("Google sign-in failed (" + res.status + ")");
    const t = await res.json();
    if (!t.id_token) throw new Error("Google did not return an ID token");
    // the token came straight from Google over TLS with our client secret, so its claims can be read as is
    const claims = JSON.parse(b64urlDecode(t.id_token.split(".")[1] || ""));
    if (claims.aud !== env.GOOGLE_CLIENT_ID) throw new Error("Google ID token is for another app");
    const email = String(claims.email || "").toLowerCase();
    const allowed = String(env.ALLOWED_EMAIL || "").trim().toLowerCase();
    if (!allowed || !claims.email_verified || email !== allowed) { const e = new Error("not allowed"); e.notAllowed = true; e.email = email; throw e; }
    return { idToken: t.id_token, email };
}

/** Google ID token -> Firebase { uid, refreshToken, idToken, expiresAt }. */
export async function firebaseSignIn(env, googleIdToken) {
    const res = await fetch(url(env, "IDENTITY_URL", "https://identitytoolkit.googleapis.com") + "/v1/accounts:signInWithIdp?key=" + env.FIREBASE_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json", Referer: env.SITE_URL },
        body: JSON.stringify({ postBody: "id_token=" + encodeURIComponent(googleIdToken) + "&providerId=google.com", requestUri: env.SITE_URL, returnSecureToken: true, returnIdpCredential: false }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.localId) throw new Error("Anchor Board sign-in failed (" + (body.error?.message || res.status) + ")");
    return { uid: body.localId, refreshToken: body.refreshToken, idToken: body.idToken, expiresAt: Date.now() + (Number(body.expiresIn) || 3600) * 1000 };
}

/** Firebase refresh token -> a fresh Firebase ID token. Cached per isolate for most of its hour. */
const cache = new Map();
export async function firebaseIdToken(env, refreshToken) {
    const hit = cache.get(refreshToken);
    if (hit && hit.expiresAt - Date.now() > 5 * 60000) return hit;
    const res = await fetch(url(env, "SECURETOKEN_URL", "https://securetoken.googleapis.com") + "/v1/token?key=" + env.FIREBASE_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: env.SITE_URL },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.id_token) {
        const e = new Error("Anchor Board sign-in expired (" + (body.error?.message || res.status) + ")");
        e.revoked = /TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|INVALID_REFRESH_TOKEN/.test(body.error?.message || "");
        throw e;
    }
    const out = { idToken: body.id_token, uid: body.user_id, expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
    cache.set(refreshToken, out);
    return out;
}

export function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    const bin = atob(s); const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
export async function s256(verifier) {
    const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    return btoa(String.fromCharCode(...d)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
