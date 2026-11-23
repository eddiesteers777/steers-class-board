/* ==========================================
   Anchor Board — the foundational track (pure; tools/acap/found.test.mjs).
   For the students Eddie places by hand (2026-11-23: "I'll place them by hand"): when the grade-level work is out of
   reach, they work one foundational skill at a time (js/foundBank.js), pounded until it is Secure, and only then move
   up the ladder, so grade-level topics become possible.

   Placement (private): teacher/{uid}/found/{period} = { kids: { <kidKey>: { nm, start: "F:intAdd", at } }, at }
   A step is Secure by the same rule as a standard (js/readiness.js): the lock (5 right, 6 of the last 8, on 2 days)
   and 80%+ latest. The current step is the first step from the start that is not Secure.
========================================== */
import { LADDER, nameOf } from "./foundBank.js?v=1";
import { lockOf, stateOf } from "./readiness.js?v=1";
import { kidKey } from "./profileCore.js?v=2";

export const placementOf = (doc, nm) => ((doc && doc.kids) || {})[kidKey(nm)] || null;
export const placedNames = (doc) => Object.values((doc && doc.kids) || {}).map((k) => k && k.nm).filter(Boolean);

/** Place (or move) a student. Returns the new document. */
export function place(doc, nm, start, now = Date.now()) {
    const kids = Object.assign({}, (doc && doc.kids) || {});
    kids[kidKey(nm)] = { nm: String(nm).slice(0, 40), start: LADDER.some((s) => s.id === start) ? start : LADDER[0].id, at: now };
    return { kids, at: now };
}
export function unplace(doc, nm, now = Date.now()) {
    const kids = Object.assign({}, (doc && doc.kids) || {}); delete kids[kidKey(nm)];
    return { kids, at: now };
}

/**
 * Where a placed student is. rec: the Student Progress record (its stds hold F: codes too), trail: Map code -> trail
 * (readiness.answerTrail for this student). Returns { steps: [{ id, name, state, latest, lock, before }], current } or null.
 */
export function ladderOf(placement, rec, trail) {
    if (!placement) return null;
    const scored = new Map(((rec && rec.stds) || []).map((x) => [x.code, x]));
    const from = Math.max(0, LADDER.findIndex((s) => s.id === placement.start));
    const steps = LADDER.map((s, i) => {
        const x = scored.get(s.id), latest = x ? x.latest : null, lock = lockOf(trail && trail.get(s.id), null);
        return { id: s.id, name: s.name, helps: s.helps, latest, lock, state: stateOf(latest, lock.met), before: i < from };
    });
    const current = steps.find((s) => !s.before && s.state !== "secure") || null;
    return { steps, current, from };
}

/** The open foundational assignment for this student and step, if there is one (so the same step isn't assigned twice). */
export function openFor(asgIndex, per, nm, code) {
    return (asgIndex || []).find((a) => a && a.fnd === code && a.status === "open" && a.only && a.only.per === per && a.only.nm === nm) || null;
}
export const stepWord = (code) => nameOf(code);
