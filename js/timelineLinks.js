/* ==========================================
   Anchor Board — Standards Timeline: what a standard builds on (needs) and its floor skills (pure).
   Defaults come from data/stdLinks.js. A teacher's own floor skills for a year save to teacher/{uid}/standards/floors:
     { "8th": { "8.25": ["F:eq2", "F:intAdd"] }, … }   (an empty list means "no floor skill" on purpose)
   Tested by tools/timeline/links.test.mjs.
========================================== */
import { STANDARDS } from "../data/standards.js?v=60";
import { LINKS } from "../data/stdLinks.js?v=2";
import { LADDER, stepOf } from "./foundBank.js?v=2";

const known = new Set(Object.values(STANDARDS).flatMap((c) => c.standards.map((s) => s.code)));
const ladder = new Set(LADDER.map((x) => x.id));

/** Earlier standards this one builds on (only real codes). */
export const needsOf = (code) => ((LINKS[code] || {}).needs || []).filter((c) => known.has(c));
/** Anchor's default floor skills. */
export const defaultFloor = (code) => ((LINKS[code] || {}).floor || []).filter((f) => ladder.has(f));
/** The floor skills in use: the teacher's for this class and code if set, else the default. */
export function floorOf(cls, code, floors) {
    const mine = floors && floors[cls] && floors[cls][code];
    return Array.isArray(mine) ? mine.filter((f) => ladder.has(f)) : defaultFloor(code);
}
export const isCustomFloor = (cls, code, floors) => !!(floors && floors[cls] && Array.isArray(floors[cls][code]));
/** Set (list) or clear (null) a teacher floor. Returns a new floors doc. */
export function setFloor(floors, cls, code, list) {
    const out = JSON.parse(JSON.stringify(floors || {}));
    out[cls] = out[cls] || {};
    if (list == null) delete out[cls][code]; else out[cls][code] = [...new Set(list.filter((f) => ladder.has(f)))];
    if (!Object.keys(out[cls]).length) delete out[cls];
    return out;
}
export const floorName = (id) => (stepOf(id) || {}).name || id;
export const LADDER_STEPS = LADDER;

/** Does this class teach the code (so its mark means something here)? */
export const inClass = (cls, code) => !!(STANDARDS[cls] && STANDARDS[cls].standards.some((s) => s.code === code));

/**
 * Needs that sit LATER than the card in this order (same class only): shown as a warning on the card.
 * lanes = the Timeline's four lanes.
 */
export function needsAfter(cls, lanes, code) {
    const flat = lanes.flat(), at = flat.indexOf(code);
    return needsOf(code).filter((c) => inClass(cls, c) && flat.indexOf(c) > at);
}
