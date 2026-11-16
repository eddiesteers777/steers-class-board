/* ==========================================
   Calera Math — Account role on this device

   School rewrite of the Southbound role module.
   One role only: "teacher". There is no coach/client split,
   no personal marathon plan, and no client view.
   Kept exports: cachedRole, setCachedRole, showsPersonalPlan
   (always false now — nothing personal to show), isTeacher.
========================================== */

const KEY = "school-account-role";

export function cachedRole() {
    try {
        return localStorage.getItem(KEY) || "teacher";
    } catch {
        return "teacher";
    }
}

export function setCachedRole(role) {
    try {
        if (role) localStorage.setItem(KEY, role);
        else localStorage.removeItem(KEY);
    } catch { /* storage blocked */ }
}

export function isTeacher() {
    return cachedRole() === "teacher";
}

// Kept for callers (js/loadHeader.js, parked js/app.js).
// The school site has no personal plan to show.
export function showsPersonalPlan() {
    return false;
}
