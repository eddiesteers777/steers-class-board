/* ==========================================
   Anchor Board — walkthroughs for the standards bank (js/walkBank.js).
   Joins the bank's problems (js/stdBank.js) with the word-problem setups (data/stdbank/walk.js) and builds each
   walkthrough with js/walk.js the first time it is asked for. No third problem store: a walkthrough is always
   built from the bank problem itself, and the teacher's part (checked it, reworded a why line) is saved under
   teacher/{uid}/walk/ok and teacher/{uid}/walk/edits.
========================================== */
import { loadStdBank } from "./stdBank.js?v=4";
import { walkFor } from "./walk.js?v=1";

let cache = null;
const built = new Map();
/** Every bank problem, with its word-problem setup attached when it has one. */
export function loadWalkItems() {
    if (cache) return cache;
    cache = Promise.all([loadStdBank(), import("../data/stdbank/walk.js?v=1").then((m) => m.default, () => ({}))])
        .then(([items, setups]) => items.map((x) => (setups[x.id] ? Object.assign({}, x, { walk: setups[x.id] }) : x)));
    return cache;
}
/** The walkthrough for one bank problem: { ok, steps, … } or { ok: false, why }. Built once, then reused. */
export function walkOf(item) {
    if (!item) return { ok: false, why: "That problem is not in the bank." };
    if (!built.has(item.id)) built.set(item.id, walkFor(item));
    return built.get(item.id);
}
/** A walkthrough with the teacher's own wording for any why line they changed. */
export function withEdits(w, edits) {
    if (!w || !w.ok || !edits) return w;
    return Object.assign({}, w, { steps: w.steps.map((s, i) => (typeof edits[i] === "string" && edits[i].trim() ? Object.assign({}, s, { why: edits[i].trim().slice(0, 400), edited: true }) : s)) });
}
/** Saved teacher data, cleaned: ok = { id: when checked }, edits = { id: { stepIndex: text } }. */
export const cleanOk = (d) => { const o = {}; const ids = d && d.ids && typeof d.ids === "object" ? d.ids : {}; Object.keys(ids).slice(0, 2000).forEach((k) => { if (typeof ids[k] === "number") o[k.slice(0, 40)] = ids[k]; }); return o; };
export const cleanEdits = (d) => {
    const o = {}; const ids = d && d.ids && typeof d.ids === "object" ? d.ids : {};
    Object.keys(ids).slice(0, 2000).forEach((k) => { const e = ids[k]; if (!e || typeof e !== "object") return; const m = {}; Object.keys(e).slice(0, 30).forEach((i) => { if (/^\d+$/.test(i) && typeof e[i] === "string") m[i] = e[i].slice(0, 400); }); if (Object.keys(m).length) o[k.slice(0, 40)] = m; });
    return o;
};
