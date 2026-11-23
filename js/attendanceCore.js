/* ==========================================
   Anchor Board — attendance, the rules (Phase 2, Nov 23 2026). Pure: no page, no store, no network
   (tests: tools/attendance/core.test.mjs).

   Eddie takes attendance in PowerSchool. Anchor does not read it. Once at the start of class he taps who is
   out for that period on the Remote; this is the one dated record the dashboard reads.

     teacher/{uid}/attendance/{YYYY-MM-DD} = { v: 1, day, out: { "<period>": { "<kidKey>": MARK } } }
     MARK = { n: "Ava R.", at: ms, x?: 1 }      x: 1 = tapped back in (present), the tap stays but counts for nothing

   Students are identified the way the game profiles already do (js/profileCore.js): period + kidKey of the short
   roster name. No second student list, no ids, no dates of birth, nothing new about a student. The record is
   written one student at a time (merge), so two devices tapping never wipe each other.
   Shown names are first names only (displayName), with the last initial added ONLY when two students in the same
   period share a first name (Eddie, Nov 23).

   The Remote's Name Picker / Group maker keep their own daily "who is out" list (S.tools.absent, roster
   positions, wiped each day). attendance and that list are kept in step by js/attendanceRemote.js; the Class
   Tracker's own "abs" events (track/{day}) are read as extra evidence, never written here.
========================================== */
import { kidKey } from "./profileCore.js?v=2";

export const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const localIso = (d = new Date()) => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
export const isDay = (s) => typeof s === "string" && DAY.test(s);

/** First name of a short roster name ("Ava R." -> "Ava"). */
export const firstOf = (nm) => String(nm || "").trim().split(/\s+/)[0] || "";

/**
 * The name to show for a student. First name only, unless another student in the same period shares the first
 * name: then the short name ("Ava R.") so the two can be told apart. allNms: every short name in that period.
 */
export function displayName(nm, allNms) {
    const f = firstOf(nm).toLowerCase(), same = (allNms || []).filter((x) => firstOf(x).toLowerCase() === f);
    return same.length > 1 ? String(nm).trim() : firstOf(nm);
}

/** One MARK, cleaned (or null). */
function cleanMark(m) {
    if (!m || typeof m !== "object") return null;
    const n = typeof m.n === "string" ? m.n.replace(/\s+/g, " ").trim().slice(0, 24) : "", at = Math.max(0, Math.floor(+m.at || 0));
    if (!n) return null;
    const o = { n, at }; if (m.x) o.x = 1; return o;
}

/** A saved document, cleaned: { day, out: { period: { key: MARK } } } (empty when there is none or it is odd). */
export function cleanDoc(d, day) {
    const out = {};
    if (d && typeof d === "object" && d.out && typeof d.out === "object") {
        Object.keys(d.out).slice(0, 12).forEach((per) => {
            if (!/^[A-Za-z0-9_-]{1,20}$/.test(per) || !d.out[per] || typeof d.out[per] !== "object") return;
            const keep = {};
            Object.keys(d.out[per]).slice(0, 80).forEach((k) => { const m = cleanMark(d.out[per][k]); if (m && /^[a-z0-9-]{1,40}$/.test(k)) keep[k] = m; });
            if (Object.keys(keep).length) out[per] = keep;
        });
    }
    return { v: 1, day: isDay(day) ? day : isDay(d && d.day) ? d.day : "", out };
}

/** Who is out for a period: [{ key, nm, at }] (marks tapped back in are dropped), oldest tap first. */
export function outList(doc, per) {
    const m = (doc && doc.out && doc.out[per]) || {};
    return Object.keys(m).filter((k) => !m[k].x).map((k) => ({ key: k, nm: m[k].n, at: m[k].at })).sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}
export const isOut = (doc, per, nm) => !!(doc && doc.out && doc.out[per] && doc.out[per][kidKey(nm)] && !doc.out[per][kidKey(nm)].x);

/** The write for one tap: a partial document to merge into attendance/{day}. out true = marked out, false = back in. */
export function tapWrite(day, per, nm, out, at = Date.now()) {
    return { v: 1, day, out: { [per]: { [kidKey(nm)]: out ? { n: String(nm).trim().slice(0, 24), at } : { n: String(nm).trim().slice(0, 24), at, x: 1 } } } };
}

/**
 * Keep the Remote's daily list (roster positions) in step with a record.
 * names: the period's short names in roster order. Returns the positions that are out.
 */
export function positionsOut(doc, per, names) {
    const keys = new Set(outList(doc, per).map((o) => o.key));
    return (names || []).map((n, i) => (keys.has(kidKey(n)) ? i : -1)).filter((i) => i >= 0);
}

/**
 * Everyone marked out, by day, from several days' documents and (as extra evidence) the Tracker's "abs" events.
 * docs: [{ day, doc }]; trackDocs: [{ day, ev: { id: { p, n, k, x } } }].
 * Returns [{ day, per, key, nm }], newest day first.
 */
export function absences(docs, trackDocs) {
    const seen = new Set(), out = [];
    const add = (day, per, nm) => { const key = kidKey(nm), id = day + "|" + per + "|" + key; if (!key || seen.has(id)) return; seen.add(id); out.push({ day, per, key, nm }); };
    (docs || []).forEach(({ day, doc }) => {
        const c = cleanDoc(doc, day); if (!c.day) return;
        Object.keys(c.out).forEach((per) => outList(c, per).forEach((o) => add(c.day, per, o.nm)));
    });
    (trackDocs || []).forEach((t) => {
        if (!t || !isDay(t.day)) return;
        // a student the teacher tapped back in on attendance is not counted from the Tracker's older tap
        const back = (docs || []).find((d) => d.day === t.day);
        Object.values(t.ev || {}).forEach((e) => {
            if (!e || e.k !== "abs" || e.x || typeof e.n !== "string" || typeof e.p !== "string") return;
            const cd = back ? cleanDoc(back.doc, back.day) : null, m = cd && cd.out[e.p] && cd.out[e.p][kidKey(e.n)];
            if (m && m.x) return;
            add(t.day, e.p, e.n);
        });
    });
    return out.sort((a, b) => b.day.localeCompare(a.day) || a.per.localeCompare(b.per) || a.nm.localeCompare(b.nm));
}
