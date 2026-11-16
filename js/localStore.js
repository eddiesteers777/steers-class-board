/* ==========================================
   Calera Math — a store that lives only in this browser tab.
   Used by sub.html so a guest teacher can run the board with no sign-in.
   Same shape as js/boardStore.js, but nothing is saved or shared: closing
   the tab clears it, and it never touches the teacher's account or rosters.
========================================== */
const docs = new Map(), subs = new Map();

export async function ready() { return { uid: "guest", name: "Guest teacher" }; }

export function watch(path, next) {
    const fire = () => next({ exists: docs.has(path), data: docs.get(path), pending: false });
    if (!subs.has(path)) subs.set(path, new Set());
    subs.get(path).add(fire); setTimeout(fire, 0);
    return () => subs.get(path).delete(fire);
}

export async function save(path, data) {
    docs.set(path, JSON.parse(JSON.stringify(data)));
    (subs.get(path) || []).forEach((f) => setTimeout(f, 0));
}

export async function clockSkew() { return 0; }
export async function signOut() { /* nothing to sign out of */ }
