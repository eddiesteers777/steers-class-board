/* ==========================================
   Anchor Board — what to teach next, from the district unit order and the private status marks.
   Used by the Standards page ("Next up" panel) and the Planner (suggested unit for weeks not planned yet).

   The current unit is the first unit, in district order, that holds a standard marked Teaching.
   With nothing marked Teaching it is the first unit that still has a standard not marked Taught.
   "Next" is every standard from the current unit onward that is neither Taught nor Teaching,
   in the order the district units list them. Standards left open in units before the current one
   are reported separately as "left open", so they are not mistaken for the next lesson.
========================================== */
import { STANDARDS } from "../data/standards.js?v=58";

const stateOf = (p, code) => ((p || {})[code] || {}).s || "";

export function nextUp(cls, progress) {
    const C = STANDARDS[cls]; if (!C) return null;
    const p = (progress || {})[cls] || {}, byCode = new Map(C.standards.map((s) => [s.code, s]));
    const units = C.units.filter((u) => u.standards.length);
    let at = units.findIndex((u) => u.standards.some((x) => stateOf(p, x.code) === "teaching"));
    if (at < 0) at = units.findIndex((u) => u.standards.some((x) => stateOf(p, x.code) !== "taught"));
    const seen = new Set(), next = [], left = [];
    units.forEach((u, i) => u.standards.forEach((x) => {
        if (seen.has(x.code)) return; seen.add(x.code);
        const st = stateOf(p, x.code), s = byCode.get(x.code); if (!s) return;
        const item = { code: x.code, text: s.text, critical: !!s.critical, unit: u, state: st };
        if (st === "taught" || st === "teaching") return;
        if (at >= 0 && i < at) left.push(item); else next.push(item);
    }));
    const teaching = C.standards.filter((s) => stateOf(p, s.code) === "teaching").map((s) => s.code);
    const critLeft = C.standards.filter((s) => s.critical && stateOf(p, s.code) !== "taught").length;
    const reteach = C.standards.filter((s) => stateOf(p, s.code) === "reteach").map((s) => s.code);
    return { unitWord: C.unitWord || "Unit", current: at >= 0 ? units[at] : null, teaching, next, left, critLeft, reteach };
}

/** The unit after the current one has run out: the unit that holds the first "next" standard. */
export function suggestedUnit(cls, progress) {
    const n = nextUp(cls, progress); if (!n) return "";
    const u = n.next.length ? n.next[0].unit : n.current;
    return u ? n.unitWord + " " + u.id + ": " + u.name : "";
}
