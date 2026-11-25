/* ==========================================
   Anchor Board — Standards Timeline logic (pure, no page code). Used by timeline.html and tools/timeline/core.test.mjs.

   Four lanes, one per nine weeks. Every Alabama standard of a class is one card, in teaching order.
   PLAN holds Eddie's locked v1 order (approved Nov 23, 2026) for 8th and 7th. 8th Accelerated has no locked
   order yet, so it uses the district unit order split across the four lanes.
   A teacher's own order (dragged on the page) saves to teacher/{uid}/standards/timeline as
     { "8th": { lanes: { q1: [codes], q2: [codes], q3: [codes], q4: [codes] }, at: <ms> }, … }
   (an object of four lists, because Firestore cannot store a list of lists).
   It never changes data/standards.js or the district unit order the Standards page shows.
   Status marks are the same standards/progress marks the Standards page uses ({ s, d }).
========================================== */
import { STANDARDS } from "../data/standards.js?v=60";

export const LANES = 4;
export const LANE_NAMES = ["1st nine weeks", "2nd nine weeks", "3rd nine weeks", "4th nine weeks"];

/** Locked v1 order. Codes only; wording always comes from data/standards.js. */
export const PLAN = {
    "8th": {
        v: 1,
        lanes: [
            ["8.1", "8.2", "8.4", "8.3", "8.5", "8.6", "8.11"],
            ["8.25", "8.26", "8.27", "8.28"],
            ["8.13", "8.14", "8.15", "8.16", "8.17", "8.7", "8.8", "8.9", "8.10", "8.12"],
            ["8.22", "8.23", "8.24", "8.29", "8.30", "8.18", "8.19", "8.20", "8.21"],
        ],
        notes: [
            "Real numbers and exponents, then multi-step equations",
            "Keep equations: triangle angle sum as an equation, then Pythagorean",
            "Functions, then slope and graphing, then systems: where two functions meet",
            "Transformations, volume, scatter plots and two-way tables, then ACAP spiral",
        ],
    },
    "7th": {
        v: 1,
        lanes: [
            ["7.4", "7.5", "7.6", "7.7", "7.8"],
            ["7.9", "7.1", "7.2", "7.3"],
            ["7.17", "7.18", "7.19", "7.20", "7.21", "7.22"],
            ["7.10", "7.11", "7.12", "7.13", "7.14", "7.15", "7.16"],
        ],
        notes: [
            "Rational number operations, then expressions",
            "Equations and inequalities, then proportional relationships",
            "Geometry: scale drawings, circles, angles, area and volume, all as equation practice",
            "Statistics and probability, then ACAP spiral",
        ],
    },
};

const classOf = (cls) => STANDARDS[cls] || null;

/** Every standard code of a class in district order: units first (first time a code appears), then any not in a unit. */
export function districtOrder(cls) {
    const C = classOf(cls); if (!C) return [];
    const seen = new Set(), out = [];
    C.units.forEach((u) => u.standards.forEach((x) => { if (!seen.has(x.code) && C.standards.some((s) => s.code === x.code)) { seen.add(x.code); out.push(x.code); } }));
    C.standards.forEach((s) => { if (!seen.has(s.code)) { seen.add(s.code); out.push(s.code); } });
    return out;
}

/** The first district unit that lists a code, or null. */
export function unitOf(cls, code) {
    const C = classOf(cls); if (!C) return null;
    return C.units.find((u) => u.standards.some((x) => x.code === code)) || null;
}

/** The starting order: the locked plan, or the district units split across the four lanes (a whole unit stays in one lane). */
export function defaultLanes(cls) {
    if (PLAN[cls]) return PLAN[cls].lanes.map((l) => l.slice());
    const C = classOf(cls); if (!C) return [[], [], [], []];
    const order = districtOrder(cls), total = order.length || 1, lanes = [[], [], [], []], placed = new Set();
    let before = 0;
    C.units.forEach((u) => {
        const mine = u.standards.map((x) => x.code).filter((c) => !placed.has(c) && order.includes(c));
        if (!mine.length) return;
        const lane = Math.min(LANES - 1, Math.floor(((before + mine.length / 2) * LANES) / total));
        mine.forEach((c) => { placed.add(c); lanes[lane].push(c); });
        before += mine.length;
    });
    order.filter((c) => !placed.has(c)).forEach((c) => lanes[LANES - 1].push(c));
    return lanes;
}

/** True when the class has a locked order (as opposed to the district split). */
export const isLocked = (cls) => !!PLAN[cls];

/**
 * The lanes to show: the teacher's saved order, cleaned. Unknown codes and repeats are dropped; a standard missing
 * from the saved order (for example one added to the Course of Study later) goes back to its default lane.
 */
export function lanesFor(cls, saved) {
    const valid = new Set(districtOrder(cls)), def = defaultLanes(cls);
    const raw = saved && saved.lanes, s = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw.q1, raw.q2, raw.q3, raw.q4] : null;
    if (!s) return def;
    const seen = new Set();
    const out = [0, 1, 2, 3].map((i) => (Array.isArray(s[i]) ? s[i] : []).filter((c) => { if (!valid.has(c) || seen.has(c)) return false; seen.add(c); return true; }));
    def.forEach((lane, i) => lane.forEach((c) => { if (!seen.has(c)) { seen.add(c); out[i].push(c); } }));
    return out;
}

/** The saved shape of four lanes: { q1, q2, q3, q4 }. */
export const toSaved = (lanes) => ({ q1: lanes[0] || [], q2: lanes[1] || [], q3: lanes[2] || [], q4: lanes[3] || [] });

/** Same lanes as the default order? */
export function isDefault(cls, lanes) {
    const d = defaultLanes(cls);
    return d.every((l, i) => (lanes[i] || []).length === l.length && l.every((c, j) => lanes[i][j] === c));
}

/** Move one card to a lane and position (position in the lane after it is taken out). Returns new lanes. */
export function moveCard(lanes, code, toLane, toIndex) {
    const out = lanes.map((l) => l.filter((c) => c !== code));
    const l = out[Math.max(0, Math.min(LANES - 1, toLane))];
    l.splice(Math.max(0, Math.min(l.length, toIndex)), 0, code);
    return out;
}

/** Where a card is: { lane, index } or null. */
export function whereIs(lanes, code) {
    for (let i = 0; i < lanes.length; i++) { const j = lanes[i].indexOf(code); if (j >= 0) return { lane: i, index: j }; }
    return null;
}

const stateOf = (p, code) => ((p || {})[code] || {}).s || "";

/**
 * Next up, the same rule as js/standardsNext.js but in the Timeline's order. A "group" is a run of cards that sit
 * together in one lane and come from the same district unit (so with the district order this is exactly the unit rule).
 * The current group is the first one holding a card marked Teaching; with nothing marked Teaching, the first group
 * that still has a card not marked Taught. "next" = every card from the current group on that is neither Taught nor
 * Teaching; cards still open in earlier groups are "left". progress = the whole standards/progress doc.
 */
export function timelineNext(cls, lanes, progress) {
    const C = classOf(cls); if (!C) return null;
    const p = (progress || {})[cls] || {}, byCode = new Map(C.standards.map((s) => [s.code, s]));
    const groups = [];
    lanes.forEach((lane, li) => lane.forEach((code) => {
        const u = unitOf(cls, code), key = li + "|" + (u ? u.id : "-"), g = groups[groups.length - 1];
        if (g && g.key === key) g.codes.push(code); else groups.push({ key, lane: li, unit: u, codes: [code] });
    }));
    let at = groups.findIndex((g) => g.codes.some((c) => stateOf(p, c) === "teaching"));
    if (at < 0) at = groups.findIndex((g) => g.codes.some((c) => stateOf(p, c) !== "taught"));
    const next = [], left = [];
    groups.forEach((g, i) => g.codes.forEach((code) => {
        const st = stateOf(p, code), s = byCode.get(code); if (!s) return;
        if (st === "taught" || st === "teaching") return;
        const item = { code, text: s.text, critical: !!s.critical, unit: unitOf(cls, code), lane: g.lane, state: st };
        if (at >= 0 && i < at) left.push(item); else next.push(item);
    }));
    const all = lanes.flat();
    return {
        unitWord: C.unitWord || "Unit",
        current: at >= 0 ? { lane: groups[at].lane, unit: groups[at].unit } : null,
        teaching: all.filter((c) => stateOf(p, c) === "teaching"),
        next, left,
        critLeft: C.standards.filter((s) => s.critical && stateOf(p, s.code) !== "taught").length,
        reteach: all.filter((c) => stateOf(p, c) === "reteach"),
    };
}

/** The unit to plan next, in the Timeline's order (for the Planner and Plan the Week): "Topic 3: Functions", or "". */
export function timelineUnit(cls, lanes, progress) {
    const n = timelineNext(cls, lanes, progress); if (!n) return "";
    const u = (n.next.length && n.next[0].unit) || (n.current && n.current.unit);
    return u ? n.unitWord + " " + u.id + ": " + u.name : "";
}

/** Taught count and total for one lane. */
export function laneDone(lane, cls, progress) {
    const p = (progress || {})[cls] || {};
    return { taught: lane.filter((c) => stateOf(p, c) === "taught").length, total: lane.length };
}

/**
 * The Timeline as a map (Nov 24): the year as one road, a region per nine weeks, a stop per unit.
 * A stop is a run of cards that sit together in one lane and come from the same district unit (the same groups
 * timelineNext uses), so "You are here" is the same place Next up calls current.
 * Returns { unitWord, regions: [{ lane, name, stops: [stop] }], stops: [stop] (all, in order), here, next, taught, total }
 * where a stop is { n (1-based), lane, unit, label ("Topic 3" or the domain), name, items: [{ code, text, critical, state }],
 *   taught, teaching, reteach, total, cont, state } (label is "" for standards in no unit doc; cont = same unit as the stop before) and state is "done" | "here" | "teaching" | "left" | "started" | "ahead".
 * here = index of the current stop (-1 when every standard is taught), next = the first stop after it not done (-1 if none).
 */
export function mapStops(cls, lanes, progress) {
    const C = classOf(cls); if (!C) return null;
    const p = (progress || {})[cls] || {}, byCode = new Map(C.standards.map((s) => [s.code, s]));
    const unitWord = C.unitWord || "Unit";
    const regions = [0, 1, 2, 3].map((li) => ({ lane: li, name: LANE_NAMES[li], stops: [] }));
    const stops = [];
    (lanes || []).forEach((lane, li) => (lane || []).forEach((code) => {
        const s = byCode.get(code); if (!s || !regions[li]) return;
        const u = unitOf(cls, code), key = u ? "u" + u.id : "d" + (s.domain || "");
        const R = regions[li], last = R.stops[R.stops.length - 1];
        const item = { code, text: s.text, critical: !!s.critical, state: stateOf(p, code) };
        if (last && last.key === key) { last.items.push(item); return; }
        const stop = { key, lane: li, unit: u, label: u ? unitWord + " " + u.id : "", name: u ? u.name : (s.domain || code), items: [item] };
        R.stops.push(stop); stops.push(stop);
    }));
    stops.forEach((st, i) => {
        st.n = i + 1;
        st.cont = !!(st.unit && i > 0 && stops[i - 1].unit && stops[i - 1].unit.id === st.unit.id);   // the unit carries over from the stop before
    });
    stops.forEach((st) => {
        delete st.key;
        st.total = st.items.length;
        st.taught = st.items.filter((x) => x.state === "taught").length;
        st.teaching = st.items.filter((x) => x.state === "teaching").length;
        st.reteach = st.items.filter((x) => x.state === "reteach").length;
    });
    let here = stops.findIndex((st) => st.teaching > 0);
    if (here < 0) here = stops.findIndex((st) => st.taught < st.total);
    stops.forEach((st, i) => {
        st.state = st.total && st.taught === st.total ? "done" : i === here ? "here" : st.teaching ? "teaching" : here >= 0 && i < here ? "left" : st.taught ? "started" : "ahead";
    });
    const next = here < 0 ? -1 : stops.findIndex((st, i) => i > here && st.state !== "done");
    const all = stops.flatMap((st) => st.items);
    return { unitWord, regions, stops, here, next, taught: all.filter((x) => x.state === "taught").length, total: all.length };
}
