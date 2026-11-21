/* ==========================================
   Anchor Board — Google Drive, from the page (no server, nothing to pay for).

   Uses Google's sign-in script (the same web client as Anchor Board's sign-in, js/googleSignIn.js)
   to ask for the "drive.file" permission only: Anchor Board can see and change ONLY the files and
   folders it made itself. It cannot open anything else in the teacher's Drive.

   The permission lasts about an hour and is kept in this tab only (sessionStorage), never saved in
   the database or the site's code. Every first ask must come from a tap (Google opens a small window).

   Needs: the Google Drive API turned on in the Google Cloud project (free), and the school site
   in the web client's Authorized JavaScript origins (already true: sign-in uses it).
========================================== */
import { GOOGLE_CLIENT_ID } from "./googleSignIn.js";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UP = "https://www.googleapis.com/upload/drive/v3";
const KEEP = "anchorboard-drive-token";
export const FOLDER = "application/vnd.google-apps.folder";
export const SHEET = "application/vnd.google-apps.spreadsheet";

let token = "", until = 0, client = null, waiting = null, scriptP = null;
try { const t = JSON.parse(sessionStorage.getItem(KEEP) || "null"); if (t && t.until > Date.now() + 60000) { token = t.token; until = t.until; } } catch { /* storage off */ }

/** Plain words for what went wrong. err.code is one of the "drive/..." codes below. */
export function sayError(e) {
    const c = (e && e.code) || "";
    if (c === "drive/off") return "The Google Drive connection is not turned on for Anchor Board yet. It is a free switch in Google Cloud (see the steps on this page).";
    if (c === "drive/blocked") return "Google would not let this account connect. A school account can be blocked by the district's Google settings. Try your personal Google account, or ask your tech office.";
    if (c === "drive/closed") return "The Google window was closed before you said yes.";
    if (c === "drive/popup") return "Your browser blocked the Google window. Allow pop-ups for this site and tap again.";
    if (c === "drive/expired") return "The Drive connection timed out. Tap the button again.";
    if (c === "drive/full") return "That Google Drive is full.";
    if (c === "drive/offline") return "No internet connection right now.";
    return "Google Drive said no (" + ((e && e.message) || "unknown") + ").";
}
const fail = (code, message) => Object.assign(new Error(message || code), { code });

function loadScript() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve(window.google);
    if (scriptP) return scriptP;
    scriptP = new Promise((ok, no) => {
        const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
        s.onload = () => (window.google && window.google.accounts && window.google.accounts.oauth2 ? ok(window.google) : no(fail("drive/offline", "Google script missing")));
        s.onerror = () => { scriptP = null; no(fail("drive/offline", "Google script did not load")); };
        document.head.appendChild(s);
    });
    return scriptP;
}

/** Load Google's script ahead of the tap, so the window opens straight from the tap. */
export function prepare() { return loadScript().catch(() => {}); }

/** True while a Drive permission from this tab is still good. */
export const connected = () => !!token && until > Date.now() + 60000;

/**
 * Ask for Drive permission. Call from a tap. pick: true shows Google's account chooser
 * (to choose the school or the personal account); hint: the email used last time.
 */
export async function connect({ pick = false, hint = "" } = {}) {
    if (connected() && !pick) return token;
    const google = await loadScript();
    if (!client) {
        client = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID, scope: SCOPE,
            callback: (r) => {
                const w = waiting; waiting = null; if (!w) return;
                if (r && r.access_token && google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) {
                    token = r.access_token; until = Date.now() + (+r.expires_in || 3600) * 1000;
                    try { sessionStorage.setItem(KEEP, JSON.stringify({ token, until })); } catch { /* this page only */ }
                    w.ok(token);
                } else w.no(fail(r && /admin_policy|access_denied/.test(r.error || "") ? "drive/blocked" : "drive/closed", (r && r.error) || "no permission"));
            },
            error_callback: (e) => { const w = waiting; waiting = null; if (w) w.no(fail(e && e.type === "popup_failed_to_open" ? "drive/popup" : "drive/closed", e && e.type)); },
        });
    }
    return new Promise((ok, no) => {
        waiting = { ok, no };
        client.requestAccessToken({ prompt: pick ? "select_account" : "", hint: hint || undefined });
    });
}

export function forget() {
    token = ""; until = 0;
    try { sessionStorage.removeItem(KEEP); } catch { /* fine */ }
}

async function call(url, opts = {}) {
    if (!connected()) throw fail("drive/expired");
    let res;
    try { res = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + token, ...(opts.headers || {}) } }); }
    catch { throw fail("drive/offline"); }
    if (res.ok) return res;
    let body = {}; try { body = await res.json(); } catch { /* no body */ }
    const why = ((body.error && body.error.errors && body.error.errors[0]) || {}).reason || "";
    const msg = (body.error && body.error.message) || res.statusText;
    if (res.status === 401) { forget(); throw fail("drive/expired", msg); }
    if (/accessNotConfigured|SERVICE_DISABLED/.test(why + " " + msg) || /has not been used in project|is disabled/.test(msg)) throw fail("drive/off", msg);
    if (/storageQuotaExceeded/.test(why)) throw fail("drive/full", msg);
    throw Object.assign(fail("drive/" + res.status, msg), { status: res.status });
}
const json = async (url, opts) => (await call(url, opts)).json();

/** { email, name } of the Drive account. */
export async function who() {
    const r = await json(API + "/about?fields=user(emailAddress,displayName)");
    return { email: (r.user && r.user.emailAddress) || "", name: (r.user && r.user.displayName) || "" };
}

/** A file or folder Anchor Board made, or null if it is gone or in the trash. */
export async function info(id) {
    if (!id) return null;
    try {
        const f = await json(API + "/files/" + encodeURIComponent(id) + "?fields=id,name,size,trashed,webViewLink,mimeType");
        return f.trashed ? null : f;
    } catch (e) { if (e.status === 404 || e.status === 403) return null; throw e; }
}

const q = (s) => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
/** Find (or make) the folder called name inside parent (or at the top of My Drive). Returns its id. */
export async function folder(name, parent = "") {
    const where = ["mimeType = " + q(FOLDER), "name = " + q(name), "trashed = false", parent ? q(parent) + " in parents" : "'root' in parents"].join(" and ");
    const found = await json(API + "/files?pageSize=1&fields=files(id)&q=" + encodeURIComponent(where));
    if (found.files && found.files[0]) return found.files[0].id;
    const made = await json(API + "/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER, parents: parent ? [parent] : undefined }) });
    return made.id;
}

/** Walk a path of folder names from root, making what is missing. */
export async function path(names, root) {
    let at = root;
    for (const n of names) at = await folder(n, at);
    return at;
}

/**
 * Save a file. blob: the content. name, parent: where. as: a Google type to turn it into
 * (SHEET turns a CSV into a Google Sheet). id: an earlier copy to replace (same link); if it is
 * gone, a new file is made. Returns { id, name, size, webViewLink }.
 */
export async function save(blob, { name, parent, as = "", id = "" }) {
    if (id && !(await info(id))) id = "";
    const meta = id ? { name } : { name, parents: parent ? [parent] : undefined, mimeType: as || undefined };
    const fields = "fields=id,name,size,webViewLink";
    const type = blob.type || "application/octet-stream";
    const base = id ? UP + "/files/" + encodeURIComponent(id) : UP + "/files";
    const method = id ? "PATCH" : "POST";
    if (blob.size <= 4 * 1048576) {   // one request
        const cut = "anchor" + Math.random().toString(36).slice(2);
        const body = new Blob(["--" + cut + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n--" + cut + "\r\nContent-Type: " + type + "\r\n\r\n", blob, "\r\n--" + cut + "--"]);
        return json(base + "?uploadType=multipart&" + fields, { method, headers: { "Content-Type": "multipart/related; boundary=" + cut }, body });
    }
    // Big files (a long stack of scans): Google's resumable upload, sent in one go after the start.
    const start = await call(base + "?uploadType=resumable&" + fields, { method, headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": type, "X-Upload-Content-Length": String(blob.size) }, body: JSON.stringify(meta) });
    const where = start.headers.get("Location");
    if (!where) throw fail("drive/upload", "no upload address");
    let res;
    try { res = await fetch(where, { method: "PUT", headers: { "Content-Type": type }, body: blob }); } catch { throw fail("drive/offline"); }
    if (!res.ok) throw fail("drive/" + res.status, "upload stopped");
    return res.json();
}
