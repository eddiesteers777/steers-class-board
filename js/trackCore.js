/* ==========================================
   Anchor Board — Class Tracker rules (Nov 21, 2026). No page state, no Firebase: the page,
   the Remote's tally panel, Student Progress and the tests all use these.

   One document per school day, teacher-only:
     teacher/{uid}/track/{YYYY-MM-DD} = { day, v: 1, ev: { <id>: EVENT } }
   EVENT = { p: "1st", n: "Ava R.", k: tag key, at: ms, t?: note text, b?: ms back (restroom), x?: 1 removed }
   Events are written one field at a time (merge), so two phones tapping at once never wipe
   each other. Taking a tap back sets x: 1; the tap stays in the document but counts for nothing.

   Tags live at teacher/{uid}/settings/track = { tags: [{ k, l, s }] }, s = 1 (good) or -1 (needs work).
   Built-in kinds that are not tags: "rr" restroom (out at `at`, back at `b`), "note", "abs" absent today,
   "pick" called on (picker or by hand).
========================================== */
export const GOOD = [
    ["part", "Participation"], ["effort", "Great effort"], ["helped", "Helped a classmate"],
    ["ontask", "On task"], ["prep", "Came prepared"], ["kind", "Respectful"],
];
export const WORK = [
    ["redirect", "Had to redirect"], ["attn", "Not paying attention"], ["unprep", "Not prepared"],
    ["distract", "Distraction"], ["offtask", "Off task"], ["phone", "Phone out"],
];
export const DEFAULT_TAGS = GOOD.map(([k, l]) => ({ k, l, s: 1 })).concat(WORK.map(([k, l]) => ({ k, l, s: -1 })));
export const SPECIAL = { rr: "Out of class", note: "Note", abs: "Absent", pick: "Called on" };
/* Passes out of class. All are kind "rr" (out at `at`, back at `b`) with the place in `w`; no `w` = Restroom (Nov 21). */
export const PLACES = ["Restroom", "Water", "Nurse", "Office", "Counselor", "Locker", "Library", "Other"];
export const placeOf = (e) => (e && typeof e.w === "string" && e.w) || "Restroom";
export const MAX_TAGS = 10;   // per side
export const RATIO_GOAL = 4;  // good notes for every one that needs work (a common PBIS target)

export const localIso = (d = new Date()) => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Clean a saved tag list. Falls back to the defaults. Keys are kept so old taps keep their label. */
export function cleanTags(d) {
    const raw = d && Array.isArray(d.tags) ? d.tags : null;
    if (!raw) return DEFAULT_TAGS.map((t) => Object.assign({}, t));
    const seen = new Set(), out = [];
    raw.forEach((t) => {
        if (!t || typeof t.k !== "string" || !/^[a-z0-9_-]{1,24}$/.test(t.k) || seen.has(t.k) || SPECIAL[t.k]) return;
        const l = String(t.l || "").trim().slice(0, 32); if (!l) return;
        seen.add(t.k); out.push({ k: t.k, l, s: t.s < 0 ? -1 : 1, ...(t.off ? { off: 1 } : {}) });
    });
    return out.length ? out : DEFAULT_TAGS.map((t) => Object.assign({}, t));
}
export const tagOf = (tags, k) => tags.find((t) => t.k === k) || null;
export const labelOf = (tags, k, e) => (k === "rr" && e ? placeOf(e) : (tagOf(tags, k) || {}).l || SPECIAL[k] || k);
export const signOf = (tags, k) => { const t = tagOf(tags, k); return t ? t.s : 0; };

/** Live events of one day's document, oldest first, optionally for one period. */
export function events(doc, period) {
    const ev = (doc && doc.ev) || {};
    return Object.keys(ev).map((id) => Object.assign({ id }, ev[id]))
        .filter((e) => e && !e.x && typeof e.n === "string" && typeof e.k === "string" && (!period || e.p === period))
        .sort((a, b) => (a.at || 0) - (b.at || 0));
}

/** Per-student summary for one period on one day: { name: { good, work, tags: {k: n}, notes: [], rr: {out, mins, n}, abs, picks } } */
export function dayByKid(evs, tags) {
    const out = {};
    const rec = (n) => (out[n] = out[n] || { good: 0, work: 0, tags: {}, notes: [], rr: { out: null, mins: 0, n: 0 }, abs: false, picks: 0 });
    evs.forEach((e) => {
        const r = rec(e.n);
        if (e.k === "note") { if (e.t) r.notes.push({ t: e.t, at: e.at, id: e.id }); return; }
        if (e.k === "abs") { r.abs = true; return; }
        if (e.k === "pick") { r.picks++; return; }
        if (e.k === "rr") { r.rr.n++; if (e.b) r.rr.mins += Math.max(0, Math.round((e.b - e.at) / 60000)); else r.rr.out = e; return; }
        r.tags[e.k] = (r.tags[e.k] || 0) + 1;
        const s = signOf(tags, e.k); if (s > 0) r.good++; else if (s < 0) r.work++;
    });
    return out;
}

/** Totals for a list of events: { good, work, ratio (good per work, or null when no work notes) } */
export function totals(evs, tags) {
    let good = 0, work = 0;
    evs.forEach((e) => { const s = signOf(tags, e.k); if (s > 0) good++; else if (s < 0) work++; });
    return { good, work, ratio: work ? good / work : null };
}

/** Who is out of the room right now (restroom with no back time), oldest first. */
export const outNow = (evs) => evs.filter((e) => e.k === "rr" && !e.b);

/**
 * The random picker: no repeats until everyone present has been called on today in this period.
 * names: roster; evs: today's events for the period; rand: () => 0..1 (Math.random by default).
 * Skips absent students and anyone out of the room. Returns { name, left, of } or null when nobody can be picked.
 */
export function pickNext(names, evs, rand = Math.random, avoid = "") {
    const by = dayByKid(evs, []);
    const here = names.filter((n) => !(by[n] && (by[n].abs || by[n].rr.out)));
    if (!here.length) return null;
    // A round starts over once everyone present has been called. Count calls per name; the lowest count is "not yet".
    const calls = (n) => (by[n] ? by[n].picks : 0), low = Math.min(...here.map(calls));
    let pool = here.filter((n) => calls(n) === low);
    if (pool.length > 1 && avoid) pool = pool.filter((n) => n !== avoid);
    const name = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
    return { name, left: pool.length - 1, of: here.length };
}

/** Called-on round status: { called, of } for the people present. */
export function pickRound(names, evs) {
    const by = dayByKid(evs, []);
    const here = names.filter((n) => !(by[n] && (by[n].abs || by[n].rr.out)));
    if (!here.length) return { called: 0, of: 0 };
    const calls = here.map((n) => (by[n] ? by[n].picks : 0)), low = Math.min(...calls);
    return { called: calls.filter((c) => c > low).length, of: here.length };
}

export const sameName = (a, b) => String(a || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "") === String(b || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * History for one student across many day documents ([{ day, ev }]).
 * Returns { days: [{ day, good, work, rr, rrMins, abs, notes }], tags: {k: n}, good, work, rr, rrMins, absent, notes: [{day, t, at}] }, newest day first.
 */
export function kidHistory(docs, period, name, tags) {
    const out = { days: [], tags: {}, good: 0, work: 0, rr: 0, rrMins: 0, absent: 0, picks: 0, notes: [] };
    docs.slice().sort((a, b) => String(b.day).localeCompare(String(a.day))).forEach((d) => {
        // names match loosely ("Ava R." = "ava r"), since a profile may show a shortened roster name
        const r = dayByKid(events(d, period).filter((e) => sameName(e.n, name)).map((e) => Object.assign({}, e, { n: name })), tags)[name];
        if (!r) return;
        out.days.push({ day: d.day, good: r.good, work: r.work, rr: r.rr.n, rrMins: r.rr.mins, abs: r.abs, notes: r.notes.length });
        Object.keys(r.tags).forEach((k) => { out.tags[k] = (out.tags[k] || 0) + r.tags[k]; });
        out.good += r.good; out.work += r.work; out.rr += r.rr.n; out.rrMins += r.rr.mins; out.picks += r.picks; if (r.abs) out.absent++;
        r.notes.forEach((x) => out.notes.push({ day: d.day, t: x.t, at: x.at }));
    });
    return out;
}

/**
 * The old class tally shape, so Student Progress keeps one behaviour line:
 * { day, periods: { per: { name: { p, t, r } } } }. p = Participation, t = any other good tag, r = any needs-work tag.
 */
export function toTally(doc, tags) {
    const periods = {};
    events(doc).forEach((e) => {
        const s = signOf(tags, e.k); if (!s) return;
        const row = ((periods[e.p] = periods[e.p] || {})[e.n] = periods[e.p][e.n] || { p: 0, t: 0, r: 0 });
        if (s < 0) row.r++; else if (e.k === "part") row.p++; else row.t++;
    });
    return { day: doc && doc.day, periods };
}

/** Minutes for one trip out (0 while out or with no back time). */
export const tripMins = (e) => (e && e.b && e.b > e.at ? Math.max(1, Math.round((e.b - e.at) / 60000)) : 0);

/** Every trip out of class for one student in one period, newest first: [{ day, id, at, b, w, mins }] */
export function tripsOf(docs, period, name) {
    const out = [];
    docs.forEach((d) => events(d, period).forEach((e) => { if (e.k === "rr" && sameName(e.n, name)) out.push({ day: d.day, id: e.id, at: e.at, b: e.b || 0, w: placeOf(e), mins: tripMins(e) }); }));
    return out.sort((a, b) => b.at - a.at);
}

/**
 * Time out of class added up: this week (Mon to Sun), this month, this nine weeks and this school year.
 * today "YYYY-MM-DD"; nineWeeks [{ n, start, end }]; yearFirst "YYYY-MM-DD".
 * Returns { week, month, nine, year: { mins, n }, nineN, places: [{ w, mins, n }] (year, most minutes first), noBack: trips with no back time }
 */
export function outTotals(trips, today, nineWeeks, yearFirst) {
    const t = new Date(today + "T12:00"), dow = (t.getDay() + 6) % 7, mon = new Date(t); mon.setDate(t.getDate() - dow);
    const monIso = localIso(mon), month = today.slice(0, 7), nw = (nineWeeks || []).find((q) => today >= q.start && today <= q.end) || null;
    const box = () => ({ mins: 0, n: 0 }), R = { week: box(), month: box(), nine: box(), year: box(), nineN: nw ? nw.n : 0, places: [], noBack: 0 }, pl = {};
    trips.forEach((x) => {
        if (x.day > today) return;
        const add = (b) => { b.mins += x.mins; b.n++; };
        if (!yearFirst || x.day >= yearFirst) { add(R.year); const p = (pl[x.w] = pl[x.w] || { w: x.w, mins: 0, n: 0 }); p.mins += x.mins; p.n++; }
        if (nw && x.day >= nw.start && x.day <= nw.end) add(R.nine);
        if (x.day.slice(0, 7) === month) add(R.month);
        if (x.day >= monIso) add(R.week);
        if (!x.b && x.day < today) R.noBack++;
    });
    R.places = Object.values(pl).sort((a, b) => b.mins - a.mins || b.n - a.n);
    return R;
}
/** "1 h 05 min" / "12 min" */
export const hm = (mins) => (mins >= 60 ? Math.floor(mins / 60) + " h " + ("0" + (mins % 60)).slice(-2) + " min" : mins + " min");

/** "3:07" from ms. */
export function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60);
    return m + ":" + ("0" + (s % 60)).slice(-2);
}

/** Make a tag key from a label that is not already used. */
export function keyFor(label, tags) {
    const base = String(label || "tag").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18) || "tag";
    let k = base, i = 2; while (tags.some((t) => t.k === k) || SPECIAL[k]) k = base + "-" + i++;
    return k;
}
