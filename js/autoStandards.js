/* ==========================================
   Anchor Board — standards mark themselves from the approved weeks.

   For each approved week planned on Plan the Week (plans/<id> + weekfiles/<id>), by class:
     - from that Monday, the plan's standards that are not marked yet become "Teaching";
     - once the quiz or test day is over (the day after it), the standards it covers become "Taught"
       (the quiz items' own codes when they have them, else the plan's standards).
   A standard marked Taught or Reteach by hand is never changed. Each change is made once: the list of
   what was done lives in settings/autostd, so a mark the teacher takes back stays taken back.
   Marks look like hand marks, plus by: "Anchor": { s: "taught", d: "2026-12-03", by: "Anchor" }.
========================================== */
import { STANDARDS } from "../data/standards.js?v=60";
import { addDays } from "./schoolCal.js?v=59";

const DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const RANK = { "": 0, teaching: 1, taught: 2, reteach: 2 };
const codesOf = (cls) => new Set((((STANDARDS[cls] || {}).standards) || []).map((s) => s.code));

/**
 * What to change. weeks: [{ id, monday, plan, week }] (approved only), progress: standards/progress,
 * done: settings/autostd done map, today: YYYY-MM-DD. Returns [{ key, cls, code, s, d, week }].
 */
export function autoMarks(weeks, progress, done, today) {
    const out = [], p = progress || {}, seen = done || {};
    const want = (wid, cls, code, s, d) => {
        if (!codesOf(cls).has(code)) return;   // a spiral code from another grade, or one not in this class
        const key = wid + "|" + cls + "|" + code + "|" + s, cur = ((p[cls] || {})[code] || {}).s || "";
        if (seen[key] || (RANK[cur] || 0) >= RANK[s]) return;
        const prev = out.find((x) => x.cls === cls && x.code === code);
        if (prev) { if (RANK[prev.s] >= RANK[s]) return; out.splice(out.indexOf(prev), 1); }
        out.push({ key, cls, code, s, d, week: wid });
    };
    (weeks || []).slice().sort((a, b) => String(a.monday).localeCompare(String(b.monday))).forEach(({ id, monday, plan, week }) => {
        if (!plan || !plan.classes || !monday || monday > today) return;
        Object.entries(plan.classes).forEach(([cls, pc]) => {
            const std = (pc && pc.standards) || [];
            std.forEach((code) => want(id, cls, code, "teaching", monday));
            const wc = week && week.classes && week.classes[cls], q = wc && wc.quiz;
            let day = q && Number.isInteger(+q.day) && q.day !== null && q.day !== "" ? +q.day : -1;
            if (day < 0 && pc.assess && pc.assess.kind && pc.assess.kind !== "none") day = DK.indexOf(pc.assess.day);
            if (day < 0 || day > 4) return;
            const date = addDays(monday, day); if (date >= today) return;   // marked the day after the quiz
            const onQuiz = [...new Set(((q && q.items) || []).map((x) => x && x.std).filter(Boolean))];
            (onQuiz.length ? onQuiz : std).forEach((code) => want(id, cls, code, "taught", date));
        });
    });
    return out;
}

/** Read once (skips an old offline copy when online). */
function once(store, path) {
    return new Promise((ok) => {
        let fin = false, un = null; const end = (v) => { if (fin) return; fin = true; ok(v); setTimeout(() => { try { if (un) un(); } catch { /* gone */ } }, 0); };
        un = store.watch(path, (s) => { if (s.pending || (s.fromCache && navigator.onLine)) return; end(s.exists ? s.data : null); }, () => end(undefined));
        setTimeout(() => end(undefined), 9000);
    });
}

/**
 * Look at the approved weeks and save any marks due. published: weeks in the site's code (they have no plan, so
 * they are skipped). Resolves the changes made ([] when none, or when something could not be read).
 */
export async function runAutoStandards(store, today) {
    const [index, progress, auto] = await Promise.all([once(store, "weekfiles/index"), once(store, "standards/progress"), once(store, "settings/autostd")]);
    if (index === undefined || progress === undefined || auto === undefined) return [];
    const ids = ((index && index.weeks) || []).filter((w) => w && w.approved && w.monday && w.monday <= today && w.monday >= addDays(today, -70)).map((w) => w);
    const weeks = [];
    for (const w of ids) {
        const [plan, file] = await Promise.all([once(store, "plans/" + w.id), once(store, "weekfiles/" + w.id)]);
        let week = null; try { week = file && file.json ? JSON.parse(file.json) : null; } catch { week = null; }
        if (plan) weeks.push({ id: w.id, monday: w.monday, plan, week });
    }
    const done = (auto && auto.done) || {}, changes = autoMarks(weeks, progress || {}, done, today);
    if (!changes.length) return [];
    const fresh = (await once(store, "standards/progress")) || progress || {};   // merge onto the newest copy
    changes.forEach((c) => {
        const cur = ((fresh[c.cls] || {})[c.code] || {}).s || "";
        if ((RANK[cur] || 0) >= RANK[c.s]) return;
        (fresh[c.cls] = fresh[c.cls] || {})[c.code] = { s: c.s, d: c.d, by: "Anchor" };
    });
    changes.forEach((c) => { done[c.key] = Date.now(); });
    await store.save("standards/progress", fresh);
    await store.save("settings/autostd", { done, at: Date.now() });
    return changes;
}
