/* ==========================================
   Anchor Board — who may use the site (pure; tests: tools/access/core.test.mjs).

   Early access: a Google account can use Anchor Board when it is the site owner's, or when the owner
   approved its email on the Teacher access page (access.html, saved as access/{email}). Any other
   Google account can sign in but is sent to waiting.html. firestore.rules enforces the same thing.

   The owner is matched by a SHA-256 of the lowercase email, so the address is not in this public code.
   Keep OWNER_HASHES the same in firestore.rules and functions/index.js.
========================================== */
export const OWNER_HASHES = ["f7765647c872fc9185968a516a7f6cefb0d9cd969eafa480429a37b9f3243e08"];

/** A typed or pasted address, tidied: trimmed, lowercase, "Name <a@b.co>" cut to a@b.co. "" when it is not an email. */
export function cleanEmail(v) {
    let s = String(v == null ? "" : v).trim();
    const m = /<([^<>]+)>/.exec(s); if (m) s = m[1].trim();
    s = s.replace(/^mailto:/i, "").toLowerCase();
    return /^[^@\s<>,;"]+@[^@\s<>,;"]+\.[^@\s<>,;".]+$/.test(s) && s.length <= 120 ? s : "";
}

/** Several addresses pasted at once (commas, spaces, new lines): the good ones, once each, and what didn't read. */
export function splitEmails(text) {
    const good = [], bad = [], seen = new Set();
    for (const part of String(text || "").split(/[\s,;]+/)) {
        if (!part) continue;
        const e = cleanEmail(part);
        if (!e) { bad.push(part); continue; }
        if (!seen.has(e)) { seen.add(e); good.push(e); }
    }
    return { good, bad };
}

/** Pages a waiting account may still open: the public ones, sign-in, and the waiting page itself. */
export const OPEN_PAGES = ["home.html", "login.html", "waiting.html", "auth-return.html", "privacy.html", "terms.html", "demo.html", "class.html"];
export function pageIsOpen(pathname) {
    const f = String(pathname || "").split("/").pop() || "";
    return OPEN_PAGES.includes(f) || /^site\//.test(String(pathname || "").replace(/^\//, ""));
}

/**
 * The decision. hash: SHA-256 hex of the account's lowercase email. entry: what reading access/{email} gave:
 *   true (there), false (not there), or "error" (couldn't tell: offline, or the rules aren't live yet).
 * Returns "owner" | "approved" | "waiting" | "unknown". Only "waiting" ever sends someone away.
 */
export function decideAccess({ anonymous, verified, hash, entry }) {
    if (anonymous) return "guest";
    if (verified && OWNER_HASHES.includes(String(hash || "").toLowerCase())) return "owner";
    if (entry === true) return "approved";
    if (entry === false && verified) return "waiting";
    return "unknown";
}

/** The early access sign-ups, newest first, each marked approved when its email is on the list. */
export function waitlistRows(entries, approvedEmails) {
    const on = new Set((approvedEmails || []).map(cleanEmail));
    return (entries || []).map((w) => ({ ...w, email: cleanEmail(w.email) || String(w.email || ""), approved: on.has(cleanEmail(w.email)) }))
        .sort((a, b) => (Number(a.approved) - Number(b.approved)) || ((b.at || 0) - (a.at || 0)));
}
