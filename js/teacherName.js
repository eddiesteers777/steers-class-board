/* ==========================================
   Anchor Board — the teacher's name as students see it ("Mr. Steers", "Ms. Rivera").

   The Calera account is Mr. Steers, as before. A new teacher's name is the one they typed in setup
   ("What should students see on the board?", settings/setup name). Unknown (signed out, not set up yet,
   or the account couldn't be checked) is "", and each page uses its own plain fallback.

   The last name and subject are remembered on this device (anchor-who) so the signed-out sign-in page
   (home.html) can greet the same teacher: "Mr. Steers · Math". It is a display name only, never sent anywhere.
========================================== */
import { myPack, mySetup, packInfo } from "./contentPack.js?v=4";

export const CALERA_NAME = "Mr. Steers";
const KEY = "anchor-who";

/** What this device last showed: { name, subject }, or null. */
export function lastWho() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && typeof v.name === "string" && v.name ? v : null; } catch { return null; }
}
function remember(who) {
    try { if (who && who.name) localStorage.setItem(KEY, JSON.stringify(who)); } catch { /* storage unavailable */ }
}

let pending = null;
/** Resolves { name, subject } for the signed-in teacher ({ name: "" } when unknown). Never rejects. */
export function myWho() {
    if (pending) return pending;
    pending = (async () => {
        try {
            const pack = await myPack(), info = packInfo();
            if (info.source === "fallback") return lastWho() || { name: "", subject: "" };   // signed out or not checked: don't guess
            let who;
            if (pack === "calera") who = { name: CALERA_NAME, subject: "Math" };
            else { const s = (await mySetup()) || {}; who = { name: s.name || "", subject: s.subject || "" }; }
            remember(who);
            return who;
        } catch { return lastWho() || { name: "", subject: "" }; }
    })();
    return pending;
}
export const myName = () => myWho().then((w) => w.name || "");

/** "Steers" from "Mr. Steers", "Rivera" from "Ms. Ana Rivera". */
export function surname(name) {
    const w = String(name || "").replace(/^(mr|mrs|ms|miss|mx|dr|coach|prof)\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
    return w.length ? w[w.length - 1] : "";
}
/** The line under the logo on the sign-in page. */
export const whoLine = (w) => (w && w.name ? w.name + (w.subject ? " · " + w.subject : "") : "");
