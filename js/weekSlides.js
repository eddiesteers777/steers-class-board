/* ==========================================
   Anchor Board — every lesson's slides, made from the week's plan when the teacher approves it.

   For each class and school day: Today, each bellringer with its answer, then each Guided Notes step
   (the same slides as Board Builder > Slides > "Start from my plan"). Saved where the editor keeps them:
     teacher/{uid}/slides/<week>|<class>|<day>   and the count in slides/index.
   A lesson that already has slides is never touched, so the teacher's own work stays. Running it
   again only fills the lessons that have none.
========================================== */
import { fromPlan, cleanDeck, cleanIndex, deckKey, countShown } from "./slides.js?v=1";
import { notesFrames } from "./notesFrames.js?v=1";

/** Read a document once from the server (not an old offline copy). undefined when it could not be reached. */
function readOnce(store, path, ms = 9000) {
    return new Promise((res) => {
        let done = false, un = null;
        const fin = (v) => { if (done) return; done = true; res(v); setTimeout(() => { try { if (un) un(); } catch { /* gone */ } }, 0); };
        un = store.watch(path, (snap) => { if (snap.pending || (snap.fromCache && navigator.onLine)) return; fin(snap.exists ? snap.data : null); }, () => fin(undefined));
        setTimeout(() => fin(undefined), ms);
    });
}

/** The lessons a week would get slides for: [{ key, cls, day, slides }]. Days off and days with no plan are left out. */
export function plannedDecks(week) {
    const out = [];
    Object.entries((week && week.classes) || {}).forEach(([cls, L]) => (L.days || []).forEach((d, i) => {
        if (!d || /no school/i.test(d.agendaLine || "")) return;
        const slides = fromPlan(L, i, notesFrames(d));
        if (slides.length > 1) out.push({ key: deckKey(week.id, cls, i), cls, day: i, slides });   // more than the Today slide alone
    }));
    return out;
}

/**
 * Make the slides for every lesson in the week that has none yet.
 * Resolves { made, kept, failed } (counts of lessons).
 */
export async function buildWeekSlides(store, week, onStep = () => {}) {
    const plan = plannedDecks(week), res = { made: 0, kept: 0, failed: 0 };
    if (!plan.length) return res;
    const idxRaw = await readOnce(store, "slides/index");
    if (idxRaw === undefined) { res.failed = plan.length; return res; }   // never write the list of lessons from a guess
    const idx = cleanIndex(idxRaw);
    for (const p of plan) {
        onStep("Making slides " + (res.made + res.kept + res.failed + 1) + " of " + plan.length);
        const have = (idx.n[p.key] || 0) > 0 ? true : await readOnce(store, "slides/" + p.key);
        if (have === undefined) { res.failed++; continue; }
        if (have === true || (have && Array.isArray(have.slides) && have.slides.length)) { res.kept++; continue; }
        const deck = cleanDeck({ slides: p.slides });
        try { await store.save("slides/" + p.key, Object.assign(deck, { at: Date.now(), by: "review" })); idx.n[p.key] = countShown(deck); res.made++; }
        catch { res.failed++; }
    }
    if (res.made) {
        const now = await readOnce(store, "slides/index");   // merge with any change made meanwhile on another page
        const fresh = now === undefined ? idx : cleanIndex(now);
        plan.forEach((p) => { if (idx.n[p.key] && !fresh.n[p.key]) fresh.n[p.key] = idx.n[p.key]; });
        try { await store.save("slides/index", Object.assign({}, fresh, { at: Date.now() })); } catch { /* the editor rebuilds counts as decks load */ }
    }
    return res;
}
