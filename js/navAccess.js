/* ==========================================
   Calera Math — Nav Access (teacher-only)

   School rewrite of the Southbound nav-access module.
   There is one role: teacher (Eddie, signed in with his Google
   account). Students never sign in; the board is a display.

   This only controls what is SHOWN. It is never the security
   boundary: Firestore rules decide what anyone can read or write.

   Exports kept so js/loadHeader.js (and the parked js/app.js)
   keep working: cachedNavAccess, accessFromProfile,
   fallbackAccess, getNavAccess, profileAccess, meets, can,
   PAGE_REQUIRES, pageAllowed, applyNavAccess.
========================================== */

const ACCESS_KEY = "school-nav-access";
const VERSION = 2;

// School pages and what they require. "" = any signed-in teacher.
export const PAGE_REQUIRES = Object.freeze({
    "index.html": "",
    "home.html": "",
    "login.html": "",
    "board.html": "teacher",
    "remote.html": "teacher",
    "schedule.html": "teacher",
    "planning.html": "teacher",
    "homework.html": "teacher",
    "auth-return.html": ""
});

export function teacherAccess(source = "profile") {
    return { v: VERSION, isTeacher: true, isCoach: false, status: "active", caps: ["teacher"], source };
}

export function cachedNavAccess() {
    try {
        const access = JSON.parse(localStorage.getItem(ACCESS_KEY) || "null");
        return access && typeof access === "object" && access.v === VERSION && Array.isArray(access.caps)
            ? { ...access, source: "cache" }
            : null;
    } catch {
        return null;
    }
}

function rememberNavAccess(access) {
    try {
        if (access) localStorage.setItem(ACCESS_KEY, JSON.stringify({ ...access, source: undefined }));
        else localStorage.removeItem(ACCESS_KEY);
    } catch { /* storage unavailable */ }
    return access;
}

export function accessFromProfile(profile) {
    if (!profile) return teacherAccess("profile");
    return teacherAccess("profile");
}

// Fails OPEN to the teacher (this device is the teacher's).
export function fallbackAccess() {
    return teacherAccess("fallback");
}

export async function getNavAccess() {
    try {
        const { getMyProfile } = await import("./userProfile.js");
        const profile = await getMyProfile();
        return rememberNavAccess(accessFromProfile(profile));
    } catch {
        return fallbackAccess();
    }
}

export async function profileAccess() {
    return getNavAccess();
}

// meets("teacher", access) / meets("", access) / meets("a,b", access: ANY)
export function meets(requires, access) {
    if (!requires) return true;
    if (!access) return true; // fail open: never lock the teacher out on a slow profile read
    const parts = String(requires).split(",").map(s => s.trim()).filter(Boolean);
    return parts.some(part =>
        part.split("+").every(need => need === "teacher" ? access.isTeacher === true : (access.caps || []).includes(need))
    );
}

export function can(capability, access = cachedNavAccess()) {
    return meets(capability, access);
}

export function pageAllowed(page, access) {
    const file = String(page || "").split("/").pop() || "index.html";
    return meets(PAGE_REQUIRES[file] || "", access);
}

export function applyNavAccess(root, access) {
    try {
        const scope = root || document;
        scope.querySelectorAll("[data-requires]").forEach(el => {
            const req = el.getAttribute("data-requires");
            if (!meets(req, access)) el.hidden = true;
        });
    } catch { /* nav is UX only */ }
    return access;
}
