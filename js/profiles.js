/* ==========================================
   Anchor Board — reading and crediting student profiles (the store side of js/profileCore.js).
   Used by the Remote only: Vault Raid (js/liveRoom.js) and the teacher-led games (js/games.js).
   Profiles live at teacher/{uid}/profiles/{period}, teacher-only (the existing teacher/{uid} rule).
   A game credits them once, after it ends, in one transaction, so two screens can't overwrite each other.
========================================== */
import * as PC from "./profileCore.js?v=1";

/** rooms: the board store's `rooms` (full paths). Resolves { <kid key>: KID } for one period, {} when there is none yet. */
export async function loadKids(rooms, per) {
    if (!rooms || !rooms.get || !rooms.uid()) return {};
    const d = await rooms.get("teacher/" + rooms.uid() + "/profiles/" + PC.perKey(per));
    return (d && d.kids && typeof d.kids === "object") ? d.kids : {};
}

/**
 * Add each student's gain from one game to their profile. gains: { <short name>: gain }. Students not on
 * the roster never reach this (the games only make gains for roster names). Resolves
 * { kids (the whole period after the change), res: { <short name>: { locks, badges, levelUp, sum } } }.
 */
export async function credit(rooms, per, gains, day = PC.dayOf()) {
    const list = Object.values(gains || {}).filter((g) => g && g.nm);
    if (!rooms || !rooms.tx || !rooms.uid() || !list.length) return { kids: null, res: {} };
    const res = {};
    const out = await rooms.tx("teacher/" + rooms.uid() + "/profiles/" + PC.perKey(per), (cur) => {
        const kids = Object.assign({}, (cur && cur.kids) || {});
        list.forEach((g) => {
            const k = PC.kidKey(g.nm); if (!k) return;
            const r = PC.applyGain(kids[k], g, day);
            kids[k] = r.kid; res[g.nm] = { locks: r.locks, badges: r.badges, levelUp: r.levelUp, sum: PC.summary(r.kid) };
        });
        return { v: 1, per: String(per || "").slice(0, 20), kids, at: Date.now() };
    });
    return { kids: out ? out.kids : null, res };
}
