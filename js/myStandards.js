/* ==========================================
   Anchor Board — this account's classes and the standards each one follows (browser only).
   Used by the Standards page. See js/courseRules.js for the shapes.

   Calera account: its three classes and data/standards.js, exactly as before.
   New teacher: the classes from setup, each with the course picked in setup step 2. A class on
   "My own standards" reads its pasted list from teacher/{uid}/settings/standards.
========================================== */
import { STANDARDS } from "../data/standards.js?v=58";
import { PACK, PERIODS, WEEKS, SETUP } from "../data/weeks.js?v=63";
import { classesFor, cleanLists, ownCourse, listKey } from "./courseRules.js?v=1";

export const CALERA_CLASSES = [["8th", "8th Grade"], ["7th", "7th Grade"], ["8th-acc", "8th Accelerated"]];
export const IS_CALERA = PACK === "calera";

/** [{ id, label, course, std, key }] for this account. */
export const MY_CLASSES = IS_CALERA
    ? CALERA_CLASSES.map(([id, label]) => ({ id, label, course: "calera", std: id, key: listKey(label) }))
    : classesFor(PERIODS, WEEKS, SETUP);

/** The standards a class follows, in data/standards.js's shape, or null (no course yet, or no list pasted yet). */
export function courseOf(c, lists) {
    if (!c) return null;
    if (c.std) return STANDARDS[c.std] || null;
    if (c.course === "own") { const rows = ((lists && lists.lists) || {})[c.key]; return rows && rows.length ? ownCourse(c.label, rows) : null; }
    return null;
}

/** Watch the pasted lists (new teachers only). onLists gets the cleaned document each time it changes. */
export function watchLists(store, onLists, onError) {
    if (IS_CALERA || !MY_CLASSES.some((c) => c.course === "own")) { onLists(cleanLists(null)); return () => {}; }
    return store.watch("settings/standards", (snap) => { if (snap.pending) return; onLists(cleanLists(snap.exists ? snap.data : null)); }, onError);
}

/** Save one class's pasted list (rows from parseStandardsList), keeping the others. Empty rows remove it. */
export async function saveList(store, lists, label, rows) {
    const next = cleanLists(lists);
    if (rows && rows.length) next.lists[listKey(label)] = rows; else delete next.lists[listKey(label)];
    const clean = cleanLists(next);
    await store.save("settings/standards", clean);
    return clean;
}
