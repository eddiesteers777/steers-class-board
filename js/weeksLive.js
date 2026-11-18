/* ==========================================
   Anchor Board — private weeks.
   A week Claude writes (or the Week Builder saves) lives in the teacher's private data at
   teacher/{uid}/weekfiles/<id> as { json, at }. Once it is approved on the Week Review page its id is
   listed in weekfiles/index ({ weeks: [{ id, label, dates, monday, approved, at }] }), and every
   signed-in page that shows weeks (board, Remote, Planner, Library, Home, Week Builder) adds it to the
   published weeks from data/weeks.js. Nothing goes into the public code, so answers stay private.
   The guest (sub) page cannot read private data and still shows published weeks only.
========================================== */

/** The school-week label and id for a Monday: ids follow the site's pattern (week6 in the 2nd nine weeks, q3w2 in the 3rd). */
export function weekIdFor(n, nineWeeks) { return nineWeeks === 2 ? "week" + n : "q" + nineWeeks + "w" + n; }

const okWeek = (w) => w && typeof w === "object" && typeof w.id === "string" && w.classes && typeof w.classes === "object"
    && Object.values(w.classes).every((c) => c && Array.isArray(c.days) && c.days.length === 5);

/** Merge published weeks with private ones; a private week never replaces a published week of the same id. Oldest first. */
export function mergeWeeks(base, extra) {
    const out = base.slice();
    extra.forEach((w) => { if (okWeek(w) && !out.some((b) => b.id === w.id)) out.push(w); });
    return out.sort((a, b) => String(a.monday || "").localeCompare(String(b.monday || "")));
}

/**
 * Watch the approved private weeks. onChange(list) gets the published weeks plus every approved private
 * week that has loaded, oldest first, each time that changes. Returns nothing; failures leave the published list.
 */
export function watchPrivateWeeks(store, base, onChange) {
    const loaded = {}, watching = new Set(); let ids = [], last = "";
    const emit = () => {
        const list = mergeWeeks(base, ids.map((id) => loaded[id]).filter(Boolean));
        const key = list.map((w) => w.id + "@" + (w._at || "")).join(",");
        if (key !== last) { last = key; onChange(list); }
    };
    store.watch("weekfiles/index", (snap) => {
        if (snap.pending) return;
        const weeks = (snap.exists && snap.data && Array.isArray(snap.data.weeks)) ? snap.data.weeks : [];
        ids = weeks.filter((x) => x && x.approved && typeof x.id === "string").map((x) => x.id);
        ids.forEach((id) => {
            if (watching.has(id)) return; watching.add(id);
            store.watch("weekfiles/" + id, (s) => {
                if (s.pending) return; let w = null;
                try { w = s.exists && s.data && s.data.json ? JSON.parse(s.data.json) : null; } catch (e) { w = null; }
                loaded[id] = okWeek(w) ? Object.assign(w, { _at: (s.data && s.data.at) || 0, _private: true }) : null;
                emit();
            }, () => { loaded[id] = null; emit(); });
        });
        emit();
    }, () => {});
}
