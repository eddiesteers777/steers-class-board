/* ==========================================
   Anchor Board — the rule for which lessons an account sees (pure; tests: tools/pack/core.test.mjs).
   Used by js/contentPack.js. Nov 23: "starter" is never inferred; only an explicit saved choice gives it.
========================================== */
export const PACKS = ["calera", "starter"];
/** Where an account's real work lives. Any one of these on the server means an existing (Calera) account. */
export const EVIDENCE_DOCS = ["rosters/all", "board/state", "weekfiles/index", "settings/bells", "data/index"];
export const EVIDENCE_COLLECTIONS = ["weekfiles", "plans"];
/** A saved choice is trusted unless it is a "starter" that was inferred (how: "new account") rather than chosen. */
export const trusted = (d) => !!(d && PACKS.includes(d.pack) && !(d.pack === "starter" && d.how === "new account"));

/**
 * The pure rule (tests: tools/pack/core.test.mjs). saved: the settings/pack document (or null); found: { path: true|false }
 * for each evidence check, or null when the checks could not run. Returns { pack, save, why }.
 * Never answers "starter" without an explicit saved choice.
 */
export function inferPack(saved, found) {
    if (trusted(saved)) return { pack: saved.pack, save: false, why: "saved (" + (saved.how || "?") + ")" };
    const hit = found ? Object.keys(found).filter((k) => found[k]) : [];
    if (hit.length) return { pack: "calera", save: true, why: "real data: " + hit.join(", ") };
    return { pack: "calera", save: false, why: found ? "no data found: inconclusive, nothing saved" : "checks could not run" };
}

