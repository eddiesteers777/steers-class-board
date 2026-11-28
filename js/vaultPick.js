/* ==========================================
   Anchor Board — which question set Vault Raid opens on (pure; tests: tools/board/vaultpick.test.mjs).
   Nov 28 (audit; Nov 23: 5th-period 7th Grade opened on "Week 5 Test Review, 8th Accelerated" and the pick did not stick
   after signing in again). Two causes: the pick carried over from the last period, and the default was simply the newest
   set, counting sets saved for every class. Now the teacher's own pick is remembered per period on the device, and with
   no pick the default prefers, in order: a set saved for this period, a set whose title names this period's class,
   a set that names no class, then a set for another class; newest first within each.
========================================== */
/** The class a set's title names: "8th-acc", "8th", "7th", or "" when it names none. */
export function classOfTitle(title) {
    const t = String(title || "").toLowerCase();
    if (/accelerated|\bacc\b|\balg(ebra)?\s*(i|1)\b/.test(t)) return "8th-acc";
    if (/\b8th\b|\bgrade 8\b/.test(t)) return "8th";
    if (/\b7th\b|\bgrade 7\b/.test(t)) return "7th";
    return "";
}
/** The sets that can be played in a period: saved for it, or saved for every class (no list). All of them if none fit. */
export function setsFor(sets, per) {
    const mine = (sets || []).filter((s) => !Array.isArray(s.per) || !s.per.length || s.per.includes(per));
    return mine.length ? mine : (sets || []);
}
/** The set id to open on. remembered: the teacher's last pick for this period (kept when it is still there). */
export function pickSet(sets, per, cls, remembered) {
    const list = setsFor(sets, per); if (!list.length) return "";
    if (remembered && list.some((s) => s.id === remembered)) return remembered;
    const rank = (s) => {
        if (Array.isArray(s.per) && s.per.includes(per)) return 0;
        const c = classOfTitle(s.title);
        return c && c === cls ? 1 : !c ? 2 : 3;
    };
    return list.slice().sort((a, b) => rank(a) - rank(b) || (b.at || 0) - (a.at || 0))[0].id;
}
