/* ==========================================
   Anchor Board — Send to students (Eddie, 2026-11-24): "while I am doing the guided notes on the board I can push a
   calculator to their screen or a manipulative… push out a problem… and view the live feed of the different solutions".
   It rides on Live notes (js/liveNotes.js on the Remote and board, js/follow.js on the Chromebooks): a send is a
   Live notes check-in that can carry a tool. This file is the plain logic both sides share, with no page or database.

     What can be sent   a Find panel's problem (with its key, its other accepted answers and its bank id for Show Steps),
                        any of the math tools on its own (students explore it, nothing to submit),
                        or a problem with a tool beside it.
     Answer groups      every answer students sent, grouped when they mean the same thing (V.sameAnswer), with how many
                        sent each. The right one first, then the rest, most common first.
     Follow-ups         after a check-in: try again for only the students who didn't get it, or Show Steps for them.
========================================== */
import { MT_KEYS, cleanMt } from "./manipCore.js?v=12";

/** The tools a teacher can send, in the order the picker lists them. */
export const SEND_TOOLS = [
    ["calc", "Basic calculator"], ["sci", "Scientific calculator"], ["graph", "Graphing calculator"],
    ["balance", "Equation balance"], ["counters", "Integer counters"], ["line", "Line explorer"], ["xform", "Transformations"],
    ["pyth", "Pythagorean squares"], ["angle", "Angle explorer"], ["fn", "Function machine"], ["area", "Expression area model"],
    ["nl", "Rational number line"], ["sys", "Systems graph"], ["scat", "Scatter plot"], ["chance", "Chance lab"],
];
export const TOOL_NAMES = Object.fromEntries(SEND_TOOLS);
export const isTool = (k) => typeof k === "string" && MT_KEYS.includes(k) && !!TOOL_NAMES[k];
/** A calculator starts blank on every Chromebook; a manipulative or a graph starts from the board's setup. */
const FRESH = new Set(["calc", "sci"]);
const TS_MAX = 4000;

/** The starting state that goes with a tool: the board panel's own state, cleaned, or "" for a blank start. */
export function toolStart(k, T) {
    if (!isTool(k) || FRESH.has(k)) return "";
    const st = T && T.mt && T.mt[k]; if (!st) return "";
    const clean = cleanMt({ [k]: st })[k]; if (!clean) return "";
    if (k === "chance") { clean.t = clean.t.map(() => 0); clean.last = -1; clean.at = 0; delete clean.dv; }   // the class's own trials, not the board's
    if (k === "balance") { clean.s = clean.e.slice(); clean.h = []; clean.r = clean.er; clean.t = 0; clean.tr = []; clean.sh = false; }   // the equation as set, not the board's moves so far
    if (k === "xform") clean.ops = [];
    if (k === "fn") { clean.ins = []; clean.g = ""; clean.sh = false; }   // their own inputs, and their own call on "function or not?"
    if (k === "area") clean.rv = [false, false];   // each student reveals the parts themselves
    if (k === "nl") clean.rv = false;
    if (k === "sys") { clean.rv = false; clean.tp = null; }   // each student tests their own points
    if (k === "scat") { clean.rv = false; clean.px = null; }   // each student checks the trend and predicts themselves
    const s = JSON.stringify(clean);
    return s.length <= TS_MAX ? s : "";
}
/** A tool's state as a student's page reads it back: an object, or null for a fresh start. */
export function readStart(k, ts) {
    if (!isTool(k) || !ts || typeof ts !== "string" || ts.length > TS_MAX) return null;
    try { const o = JSON.parse(ts); const c = cleanMt({ [k]: o })[k]; return c || null; } catch (e) { return null; }
}

/** Bank writing as a student reads it: § is a dollar sign. Fractions and powers stay for V.mathText. */
export const bankText = (t) => String(t == null ? "" : t).replace(/§/g, "$");

/** What a Find panel sends: its problem, key, other answers and bank id. Null when it shows no problem. */
export function fromFind(item) {
    if (!item || !item.q) return null;
    const al = (Array.isArray(item.also) ? item.also : []).filter((x) => typeof x === "string" && x.trim()).map((x) => bankText(x).slice(0, 80)).slice(0, 8);
    return { q: bankText(item.q).slice(0, 400), a: bankText(item.a || "").slice(0, 200), al, id: String(item.id || "").slice(0, 40), std: String(item.std || "") };
}

/** Who a check-in is for: everyone joined, or only the students it was sent to. */
export function forIds(ci, ids) { return ci && Array.isArray(ci.to) ? ids.filter((id) => ci.to.includes(id)) : ids.slice(); }

/** Answers grouped. res = { id: { y, ok, none } }; same(a, b) says two answers mean the same thing.
    → [{ y, n, ids: [...], ok: true | false | null }]: the right answer first, then the most common. */
export function answerGroups(res, ids, same) {
    const groups = [];
    ids.forEach((id) => {
        const r = res && res[id]; if (!r || r.none) return;
        const y = String(r.y || "").trim();
        if (!y) { let g = groups.find((x) => x.blank); if (!g) { g = { y: "", blank: true, n: 0, ids: [], ok: null, oks: [] }; groups.push(g); } g.n++; g.ids.push(id); g.oks.push(r.ok); return; }
        let g = groups.find((x) => !x.blank && (x.y.toLowerCase() === y.toLowerCase() || same(y, x.y)));
        if (!g) { g = { y, blank: false, n: 0, ids: [], ok: null, oks: [] }; groups.push(g); }
        g.n++; g.ids.push(id); g.oks.push(r.ok);
    });
    groups.forEach((g) => { g.ok = g.oks.some((x) => x === true) ? true : g.oks.every((x) => x === false) ? false : null; delete g.oks; });
    const rank = (g) => (g.blank ? 3 : g.ok === true ? 0 : g.ok === null ? 1 : 2);
    return groups.sort((a, b) => rank(a) - rank(b) || b.n - a.n || a.y.localeCompare(b.y));
}

/** The students to follow up with after a check-in: everyone it was for who didn't get it right (missed, or sent nothing). */
export function notYet(ci, ids) {
    return forIds(ci, ids).filter((id) => { const r = ci.res && ci.res[id]; return !r || r.none || r.ok !== true; });
}

/** A walkthrough cut down to what a student's Show Steps needs (js/stepPlayer.js reads steps and cols). */
export function slimWalk(w) {
    if (!w || !w.ok || !Array.isArray(w.steps) || !w.steps.length) return null;
    const out = { ok: true, q: String(w.q || "").slice(0, 400), a: String(w.a || "").slice(0, 200), steps: w.steps, cols: w.cols || 3 };
    return JSON.stringify(out).length <= 24000 ? out : null;
}
/** The bank's hint lines, for a problem with no worked example: up to four short lines, never the answer itself. */
export function hintLines(item) {
    return (item && Array.isArray(item.steps) ? item.steps : []).filter((x) => typeof x === "string" && x.trim()).slice(0, 4).map((x) => bankText(x).slice(0, 200));
}
