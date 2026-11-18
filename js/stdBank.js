/* ==========================================
   Anchor Board — the standards Question Bank: problems written for every Alabama standard in 7th Grade, 8th Grade
   and 8th Accelerated, each tagged with its standard (and part letter), with a checked answer.
   Built by tools/stdbank/build.py into data/stdbank/<course>.js. Shared by every page that pulls questions:
   the Question Bank page, the Question Maker (and so Vault Raid and every review game), and Claude's copy.
   Items come out in the same shape as js/bank.js extract(): { q, a, cls, kind, std, part?, lvl, choices?, also? }.
   8th Grade problems are also offered to 8th Accelerated, which teaches the same 8th standards (for).
========================================== */
import { STANDARDS } from "../data/standards.js?v=57";

export const WEEK_ID = "stdbank";
export const WEEK_LABEL = "Standards bank";
export const KIND = "Standards bank";
export const LEVELS = { 1: "On-ramp", 2: "On level", 3: "Stretch" };
const FILES = ["g7", "g8", "alg1"];

/** Classes whose standards list holds this code (an 8.x problem is for 8th and 8th Accelerated). */
function classesFor(std) { return Object.keys(STANDARDS).filter((c) => STANDARDS[c].standards.some((s) => s.code === std)); }

let cache = null;
/** Every standards-bank problem. Files not built yet are skipped. */
export function loadStdBank() {
    if (cache) return cache;
    cache = Promise.all(FILES.map((f) => import("../data/stdbank/" + f + ".js?v=1").then((m) => m.default, () => null))).then((files) => {
        const out = [];
        files.filter(Boolean).forEach((file) => file.items.forEach((x) => {
            const o = Object.assign({}, x, { cls: file.cls, for: classesFor(x.std), kind: KIND, week: WEEK_ID, label: WEEK_LABEL, sb: true });
            if (!o.for.length) o.for = [file.cls];
            out.push(o);
        }));
        return out;
    });
    return cache;
}

/** True when an item belongs in a class's list (its own class, or a class that teaches its standard). */
export const inClass = (x, cls) => !cls || x.cls === cls || (Array.isArray(x.for) && x.for.includes(cls));

/** For each class: every standard in order with how many problems (bank + weeks) carry it. */
export function coverage(items) {
    const out = {};
    Object.entries(STANDARDS).forEach(([cls, c]) => {
        out[cls] = c.standards.map((s) => {
            const mine = items.filter((x) => x.std === s.code && inClass(x, cls));
            return { code: s.code, text: s.text, critical: !!s.critical, bank: mine.filter((x) => x.sb).length, weeks: mine.filter((x) => !x.sb).length };
        });
    });
    return out;
}
