/* ==========================================
   Anchor Board — ACAP readiness, the rules (pure: no page, no store, no network; tools/acap/readiness.test.mjs).

   Classroom readiness only. Each standard is Not Yet, Developing or Secure for each student, from work done on
   this site. It is not a grade level, a percentile or a prediction of an ACAP score, and the page says so.

   Eddie's rule (2026-11-23):
     Secure      the topic lock is met (5 right, 6 of the last 8 right, on 2 different days: js/profileCore.js)
                 AND the latest score on the standard is 80% or better
     Developing  latest 50% to 79%, or 80%+ while the lock is not met yet
     Not Yet     latest under 50%
     (no mark)   nothing scored on the standard yet
   "Latest" is Student Progress's latest score for the standard (js/progress.js: about the last 3 questions' worth).
   The lock counts first-try answers from Vault Raid and Assignments (the effort records, which carry dates), and a
   lock already cracked in the student's game profile counts too.

   What to work on next: the standards not Secure yet, ranked by how far from Secure (1 - latest) times the
   standard's share of its blueprint category's points (data/acap.js). Critical standards break ties.
========================================== */
import { ACAP, ACAP_FOR } from "../data/acap.js?v=1";
import { LOCK_RIGHT, LOCK_WINDOW, LOCK_RECENT, LOCK_DAYS, kidKey } from "./profileCore.js?v=2";

export const SECURE_AT = 0.8, DEVELOPING_AT = 0.5;
export const STATE_WORD = { secure: "Secure", developing: "Developing", notyet: "Not Yet", none: "Not checked" };
export const NOT_A_PREDICTION = "Classroom readiness from work on this site. Not a grade level, a percentile or an ACAP score prediction.";

/** The blueprint a class is scored on, or null (a class with no ACAP weights). */
export function blueprintFor(cls) { const k = ACAP_FOR[cls]; return k ? Object.assign({ key: k }, ACAP[k]) : null; }
/** Standard number from a code: "7.12" -> { g: "7", n: 12 }; "Alg I.3" -> null. */
export function numOf(code) { const m = /^([78])\.(\d+)[a-z]?$/i.exec(String(code || "").trim()); return m ? { g: m[1], n: +m[2] } : null; }
/** The reporting category of a standard in a class's blueprint, with points per standard, or null. */
export function catOf(cls, code) {
    const bp = blueprintFor(cls), x = numOf(code); if (!bp || !x || x.g !== bp.key) return null;
    const c = bp.cats.find((c) => x.n >= c.from && x.n <= c.to); if (!c) return null;
    return Object.assign({}, c, { per: c.pts / (c.to - c.from + 1), share: c.pts / bp.total });
}
export const calcOf = (cls, code) => { const bp = blueprintFor(cls), x = numOf(code); return bp && x && x.g === bp.key ? bp.calc[x.n] || "" : ""; };

/** The topic key a standard has in a game profile ("7.4" -> "s-7-4"), the same as profileCore.topicOf. */
export const topicKey = (code) => "s-" + String(code).toLowerCase().replace(/[^a-z0-9]+/g, "-");

/**
 * First-try answers per student and standard, from effort records (Vault Raid + Assignments).
 * details: [{ date, qs: [{ std }], st: [{ s, lg: ["qi:o:t:h"] }] }] (oldest first, as buildProgress returns them).
 * nameOf(s): the roster line for a stored name (or "" to skip). Returns Map name -> Map code -> { h: "1101", days: Set }.
 */
export function answerTrail(details, nameOf) {
    const out = new Map();
    (details || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.at || 0) - (b.at || 0)).forEach((g) => {
        (g.st || []).forEach((x) => {
            const nm = nameOf(x.s); if (!nm) return;
            if (!out.has(nm)) out.set(nm, new Map());
            const mine = out.get(nm);
            (x.lg || []).forEach((s) => {
                const [i, o] = String(s).split(":").map((v) => +v || 0), q = (g.qs || [])[i], code = q && q.std; if (!code) return;
                if (!mine.has(code)) mine.set(code, { h: "", days: new Set() });
                const t = mine.get(code); t.h += o === 1 ? "1" : "0"; if (o === 1 && g.date) t.days.add(String(g.date).slice(0, 10));
            });
        });
    });
    return out;
}

const ones = (s) => [...String(s || "")].filter((c) => c === "1").length;
/** The lock for one standard: from the answer trail, or already cracked in the game profile. */
export function lockOf(trail, profTopic) {
    const h = (trail && trail.h) || "", r = ones(h), rec = ones(h.slice(-LOCK_WINDOW)), d = trail ? trail.days.size : 0;
    const fromTrail = r >= LOCK_RIGHT && rec >= LOCK_RECENT && d >= LOCK_DAYS, fromProfile = !!(profTopic && profTopic.m);
    const left = [];
    if (!fromProfile && !fromTrail) {
        if (r < LOCK_RIGHT) left.push((LOCK_RIGHT - r) + " more right");
        if (rec < LOCK_RECENT) left.push(LOCK_RECENT + " of the last " + LOCK_WINDOW + " right");
        if (d < LOCK_DAYS) left.push(LOCK_DAYS - d === 1 ? "1 more day" : (LOCK_DAYS - d) + " more days");
    }
    return { met: fromTrail || fromProfile, r, rec, d, left: left.join(" · ") };
}
export function stateOf(latest, lockMet) {
    if (latest == null || !isFinite(latest)) return "none";
    if (latest < DEVELOPING_AT) return "notyet";
    if (latest >= SECURE_AT && lockMet) return "secure";
    return "developing";
}

/**
 * One student's readiness for a class.
 * standards: the class's standards list (data/standards.js), rec: the Student Progress record (r.stds with latest),
 * trail: Map code -> trail (answerTrail for this student), kid: the game profile kid ({ t: { topicKey: { m } } }) or null.
 * Returns { bp, rows: [{ code, text, critical, cat, latest, n, state, lock }], cats: [{ id, name, pts, share, n, secure, developing, notyet, none }], next: [...] }
 */
export function readinessOf(cls, standards, rec, trail, kid) {
    const bp = blueprintFor(cls); if (!bp) return null;
    const scored = new Map(((rec && rec.stds) || []).map((x) => [x.code, x]));
    const rows = (standards || []).map((s) => {
        const cat = catOf(cls, s.code); if (!cat) return null;
        const x = scored.get(s.code), latest = x ? x.latest : null;
        const lock = lockOf(trail && trail.get(s.code), kid && kid.t && kid.t[topicKey(s.code)]);
        return { code: s.code, text: s.text || "", critical: !!s.critical, cat, latest, n: x ? x.n : 0, state: stateOf(latest, lock.met), lock };
    }).filter(Boolean);
    const cats = bp.cats.map((c) => {
        const mine = rows.filter((r) => r.cat.id === c.id), k = (st) => mine.filter((r) => r.state === st).length;
        return { id: c.id, name: c.name, pts: c.pts, share: c.pts / bp.total, n: mine.length, secure: k("secure"), developing: k("developing"), notyet: k("notyet"), none: k("none") };
    });
    return { bp, rows, cats, next: nextUp(rows) };
}

/** Standards to work on, best first: scored, not Secure, ranked by (1 - latest) x points per standard. */
export function nextUp(rows) {
    return rows.filter((r) => r.state === "notyet" || r.state === "developing")
        .map((r) => Object.assign({}, r, { score: Math.max(0.05, 1 - r.latest) * r.cat.per }))
        .sort((a, b) => b.score - a.score || (b.critical ? 1 : 0) - (a.critical ? 1 : 0) || a.latest - b.latest);
}

/** Why a standard was suggested, in one plain sentence. */
export function whyLine(r, total = 46) {
    const pts = Math.round(r.cat.per * 10) / 10;
    const where = r.state === "notyet" ? "Not Yet (" + Math.round(r.latest * 100) + "% latest)" : r.latest >= SECURE_AT ? "Developing: " + Math.round(r.latest * 100) + "% latest, lock not met yet (" + (r.lock.left || "keep going") + ")" : "Developing (" + Math.round(r.latest * 100) + "% latest)";
    return where + ". " + r.code + " is worth about " + pts + " of " + total + " blueprint points (" + r.cat.name + ", " + r.cat.pts + " points over " + (r.cat.to - r.cat.from + 1) + (r.cat.to - r.cat.from ? " standards" : " standard") + ")" + (r.critical ? ", and it is a critical standard." : ".");
}

/** The class's focus list: each standard with how many students are at each state, ranked by weighted need. */
export function classFocus(all) {
    const by = new Map();
    all.filter(Boolean).forEach((R) => R.rows.forEach((r) => {
        if (!by.has(r.code)) by.set(r.code, { code: r.code, text: r.text, critical: r.critical, cat: r.cat, secure: 0, developing: 0, notyet: 0, none: 0, need: 0 });
        const x = by.get(r.code); x[r.state]++;
        if (r.state === "notyet" || r.state === "developing") x.need += Math.max(0.05, 1 - r.latest) * r.cat.per;
    }));
    return [...by.values()].filter((x) => x.need > 0).sort((a, b) => b.need - a.need || (b.critical ? 1 : 0) - (a.critical ? 1 : 0));
}

/** Problem levels to practise at: Not Yet starts at On-ramp; Developing works On level and Stretch. */
export const levelsFor = (state) => (state === "notyet" ? [1, 2] : [2, 3]);

/** Profile kid for a roster name from a profiles/{period} doc. */
export const kidOf = (profDoc, nm) => ((profDoc && profDoc.kids) || {})[kidKey(nm)] || null;

/** ISO week ("2026-W48") of a time in ms, local. */
export function weekKey(ms) {
    const t = new Date(+ms || Date.now()), d = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
    const wd = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - wd);
    const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return d.getUTCFullYear() + "-W" + ("0" + Math.ceil(((d - y0) / 86400000 + 1) / 7)).slice(-2);
}
/** Extra credit is one a week per student for now (Eddie, 2026-11-23). asgIndex: asg/index list. */
export function extraThisWeek(asgIndex, per, nm, now = Date.now()) {
    const wk = weekKey(now);
    return (asgIndex || []).find((a) => a && a.xc && a.status !== "draft" && a.only && a.only.per === per && a.only.nm === nm && weekKey(a.opened || a.at) === wk) || null;
}
