/* ==========================================
   Anchor Board — "Work on next": turn one suggested standard into an assignment for one student, after the
   teacher taps Approve (nothing is made before that tap). Used by Student Progress (js/progressPage.js).

   The assignment is an ordinary Practice assignment (js/assignCore.js) from the standards bank, so it shows on the
   Assignments page, its results reach Student Progress the same way, and it can go into the gradebook like any
   other. Two extra fields:
     only  { per, nm }  it is for one student: the name list students see holds only that name (the other roster
                        lines are blanked, so the roster positions still line up), and "My name isn't here" is hidden
     xc    true         extra credit (the gradebook adds its points without adding to points possible)
     acap  { state, latest }  why it was made (for the teacher only)
   Also: a plain-text copy of the same practice for DeltaMath or Magma Math (one worked example, then 8 to 10
   problems, then the answer key), since neither app takes an import from this site.
========================================== */
import * as C from "./assignCore.js?v=6";
import { shortNames } from "./vaultCore.js?v=75";
import { levelsFor } from "./readiness.js?v=1";

const uidOf = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const firstPart = (t) => { const s = String(t || "").split(/[,;.:]/)[0].trim(); if (s.length <= 60) return s; const cut = s.slice(0, 60); return cut.slice(0, cut.lastIndexOf(" ")).trim() + "…"; };

/** The problems for a standard at the right levels for this student (falls back to every level if too few). */
export function poolFor(bank, cls, code, state, atLeast = 6) {
    const all = (bank || []).filter((x) => x.std === code && (x.cls === cls || (x.for || []).includes(cls)));
    const lv = levelsFor(state), mine = all.filter((x) => lv.includes(x.lvl));
    return (mine.length >= atLeast ? mine : all).map(C.cleanItem);
}

/** The assignment, before saving. o = { cls, per, nm, code, text, state, latest, pool, xc } */
export function makeDef(o) {
    const now = Date.now(), name = o.code + " " + firstPart(o.text);
    return {
        id: uidOf(), title: (o.xc ? "Extra credit: " : "Practice: ") + name, type: "practice", cls: o.cls, periods: [o.per],
        skills: [{ k: "s0", src: "bank:" + o.code, name, std: o.code, need: 5, w: 1, pin: -1, pool: o.pool }],
        opts: Object.assign({}, C.DEFAULTS, { need: 5 }), due: 0, status: "open", opened: now, at: now,
        only: { per: o.per, nm: o.nm }, xc: !!o.xc, acap: { state: o.state || "", latest: o.latest == null ? null : Math.round(o.latest * 100) / 100 },
    };
}

/** The name list a one-student assignment shows: only that student's line, the rest blank (positions kept). */
export function namesOnly(roster, only) {
    const lines = (roster || []).filter(Boolean), list = shortNames(lines);
    let at = lines.indexOf(only.nm); if (at < 0) at = list.indexOf(only.nm);
    return { [only.per]: list.map((n, i) => (i === at ? n : "")) };
}
export const indexEntry = (d) => {
    const m = { id: d.id, title: d.title, type: d.type, cls: d.cls, periods: d.periods, code: d.code || "", status: d.status, at: d.at, due: d.due || 0, n: d.skills.length };
    if (d.only) m.only = d.only; if (d.xc) m.xc = true; if (d.opened) m.opened = d.opened;
    return m;
};

/**
 * Save and open it (the teacher's tap). store: the teacher's store; rooms: the shared store; index: the current
 * asg/index list; roster: the period's roster. Returns the saved assignment (with its code).
 */
export async function approve(store, rooms, uid, def, index, roster) {
    def.code = await freeCode(rooms);
    const clean = JSON.parse(JSON.stringify(def));
    await store.save("asg/a_" + clean.id, clean);
    await store.save("asg/index", { list: (index || []).filter((x) => x.id !== clean.id).concat([indexEntry(clean)]), at: Date.now() });
    await rooms.save("asg/" + clean.code, C.publicDoc(clean, namesOnly(roster, clean.only), uid));
    return clean;
}
async function freeCode(rooms) {
    for (let t = 0; t < 8; t++) {
        const code = C.newCode(); let a = null, r = null;
        try { a = await rooms.get("asg/" + code); } catch (e) { a = null; }
        try { r = await rooms.get("rooms/" + code); } catch (e) { r = null; }
        if (!a && !r) return code;
    }
    throw Object.assign(new Error("no code"), { code: "no free code" });
}

/* ---------- the DeltaMath / Magma Math copy ---------- */
/** Bank markup to plain text that pastes anywhere: {3/4} -> 3/4, 4{2/3} -> 4 2/3, § -> $, ^{2} -> ^2. */
export function plain(s) {
    return String(s == null ? "" : s).replace(/§/g, "$")
        .replace(/(\d)\{([^{}]+)\/([^{}]+)\}/g, "$1 $2/$3")
        .replace(/\{([^{}]+)\/([^{}]+)\}/g, (m, a, b) => (/[\s+\-−×÷]/.test(a.trim()) ? "(" + a.trim() + ")" : a.trim()) + "/" + (/[\s+\-−×÷]/.test(b.trim()) ? "(" + b.trim() + ")" : b.trim()))
        .replace(/\^\{([^{}]+)\}/g, (m, x) => "^" + (x.length > 1 ? "(" + x + ")" : x));
}
/**
 * One worked example and 8 to 10 problems for a standard, as text to paste into DeltaMath or Magma Math.
 * Same seed, same problems. Returns { text, n } (n = problems, 0 when the bank has too few).
 */
export function copyVersion(o, seed = "") {
    const pool = (o.pool || []).slice(), n = Math.min(10, Math.max(0, pool.length - 1)); if (n < 4) return { text: "", n: 0 };
    const order = C.shuffled(pool.length, "copy|" + o.code + "|" + seed);
    // The example: an On-ramp or On level problem with its own written steps and no choices, else any with steps.
    const good = (i, strict) => C.stepsOf(pool[i]).length >= 2 && (!strict || ((pool[i].st || []).length >= 2 && !(pool[i].ch || []).length && pool[i].lvl <= 2));
    const exI = order.find((i) => good(i, true)) ?? order.find((i) => good(i, false)) ?? order[0], ex = pool[exI];
    const rest = order.filter((i) => i !== exI).slice(0, n).map((i) => pool[i]).sort((a, b) => a.lvl - b.lvl);
    const L = [];
    L.push(o.code + " practice" + (o.text ? " — " + firstPart(o.text) : ""));
    L.push("Calculator: " + ({ yes: "allowed on ACAP for this standard", no: "not allowed on ACAP for this standard: practise without one", neutral: "either way on ACAP" }[o.calc] || "your call"));
    L.push("");
    L.push("Worked example");
    L.push(plain(ex.q));
    C.stepsOf(ex).forEach((s, k) => L.push("  Step " + (k + 1) + ": " + plain(s)));
    L.push("  Answer: " + plain(ex.a));
    L.push("");
    L.push("Problems");
    rest.forEach((x, k) => { L.push((k + 1) + ". " + plain(x.q)); if (x.ch && x.ch.length) x.ch.forEach((c, j) => L.push("    " + "ABCDE"[j] + ") " + plain(c))); });
    L.push("");
    L.push("Answer key (teacher only)");
    rest.forEach((x, k) => L.push((k + 1) + ". " + plain(x.a)));
    return { text: L.join("\n"), n: rest.length };
}
