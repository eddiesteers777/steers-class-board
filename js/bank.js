/* ==========================================
   Focal — question bank (Phase 4 of the weekly workflow).
   Every approved week's questions, with their answers, checks, standards and likely wrong answers, are kept as
     teacher/{uid}/bank/<weekId>  { id, label, dates, monday, at, items: [ item ] }
   item: { q, a, cls, kind, day?, std?, skill?, choices?, wrong?, work?, check? }
   Week Review writes a week's entry when it is approved (and on every save while approved) and removes it when the
   week comes off the board. The Bank page (bank.html) searches them; Claude reads them through the Focal connector
   to reuse checked questions for spiral review, Friday bellringers, bonus sets and review games.
========================================== */
export const KINDS = ["Bellringer", "Guided notes", "Homework", "Study guide", "Speed dating", "Quiz", "Test", "Modified quiz", "Bonus", "Modified study guide", "Sub worksheet", "Exit ticket"];
const KEEP = ["q", "a", "choices", "wrong", "work", "check", "std", "skill"];
export const norm = (q) => String(q == null ? "" : q).toLowerCase().replace(/[−–]/g, "-").replace(/\s+/g, " ").replace(/[.?!:]+$/, "").trim();

function pick(x, base) {
    const o = Object.assign({}, base); KEEP.forEach((k) => { if (x[k] != null && x[k] !== "") o[k] = x[k]; });
    if (typeof o.q !== "string") o.q = String(o.q); if (typeof o.a !== "string") o.a = String(o.a);
    return o;
}
/** Every object below x that has a question and an answer. */
function walk(x, base, out, kindOf) {
    if (Array.isArray(x)) { x.forEach((v) => walk(v, base, out, kindOf)); return; }
    if (!x || typeof x !== "object") return;
    const hasQ = (typeof x.q === "string" || typeof x.q === "number") && String(x.q).trim(), hasA = x.a != null && String(x.a).trim();
    if (hasQ && hasA) out.push(pick(x, base));
    Object.entries(x).forEach(([k, v]) => { if (k === "wrong" || k === "orig" || k === "choices") return; if (v && typeof v === "object") walk(v, kindOf ? Object.assign({}, base, { kind: kindOf(k, base.kind) }) : base, out, kindOf); });
}

/** All questions in a week, one item per question. */
export function extract(week) {
    const out = [];
    if (!week || !week.classes) return out;
    Object.entries(week.classes).forEach(([cls, c]) => {
        const at = { cls, week: week.id };
        (c.days || []).forEach((d, i) => {
            (d.problems || []).forEach((p) => { if (p && p.q && p.a) out.push(pick(p, Object.assign({ kind: "Bellringer", day: i }, at))); });
            if (d.notes) walk(d.notes, Object.assign({ kind: "Guided notes", day: i }, at), out, (k, cur) => (k === "exit" ? "Exit ticket" : cur));
        });
        if (c.homework) walk(c.homework, Object.assign({ kind: "Homework" }, at), out);
        if (c.studyGuide) walk(c.studyGuide, Object.assign({ kind: "Study guide" }, at), out);
        if (c.speedDating) walk(c.speedDating, Object.assign({ kind: "Speed dating" }, at), out);
        if (c.quiz) {
            const qk = c.quiz.kind === "test" ? "Test" : "Quiz";
            (c.quiz.items || []).forEach((x) => { if (x && x.q && x.a) out.push(pick(x, Object.assign({ kind: qk, day: c.quiz.day }, at))); });
            const m = c.quiz.modified;
            if (m) { (m.items || []).forEach((x) => { if (x && x.q && x.a) out.push(pick(x, Object.assign({ kind: "Modified quiz" }, at))); }); (m.bonus || []).forEach((x) => { if (x && x.q && x.a) out.push(pick(x, Object.assign({ kind: "Bonus" }, at))); }); }
        }
        if (c.modStudyGuide) walk(c.modStudyGuide.parts, Object.assign({ kind: "Modified study guide" }, at), out);
        if (c.sub && c.sub.worksheet) { walk(c.sub.worksheet.pages, Object.assign({ kind: "Sub worksheet", day: c.sub.day }, at), out); walk(c.sub.worksheet.exit, Object.assign({ kind: "Exit ticket", day: c.sub.day }, at), out); }
    });
    return out;
}

/**
 * Repeats for Week Review. same: the same question twice in one class's paper this week (a defect unless deliberate);
 * earlier: questions this week that a class already had in an earlier week (fine as spiral review if the key says so).
 */
export function repeats(week, bankItems) {
    const items = extract(week), seen = new Map(), same = [], earlier = [];
    items.forEach((x) => {
        if (x.kind === "Bellringer" || x.kind === "Guided notes") return;   // a bellringer may echo the notes on purpose
        const k = x.cls + "|" + x.kind + "|" + norm(x.q);
        if (seen.has(k)) same.push(x); else seen.set(k, x);
    });
    const before = new Set((bankItems || []).filter((b) => b.week !== week.id).map((b) => b.cls + "|" + norm(b.q)));
    const once = new Set();
    items.forEach((x) => { const k = x.cls + "|" + norm(x.q); if (before.has(k) && !once.has(k)) { once.add(k); earlier.push(x); } });
    return { same, earlier };
}

/** Write (or remove) a week's bank entry. store.rooms writes full paths; the ?demo store has none. */
export async function saveBankWeek(store, uid, week, on) {
    if (!store.rooms || !uid || !week || !week.id) return;
    const path = "teacher/" + uid + "/bank/" + week.id;
    if (!on) { await store.rooms.del(path); return; }
    const items = extract(week);
    await store.rooms.save(path, JSON.parse(JSON.stringify({ id: week.id, label: week.label || week.id, dates: week.dates || "", monday: week.monday || "", at: Date.now(), items })));
}
