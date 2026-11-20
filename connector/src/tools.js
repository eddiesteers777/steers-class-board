/* ==========================================
   What Claude can do with Anchor Board's Student Work, as plain functions over a teacher store
   (src/firestore.js teacherStore, or a fake one in test/tools.test.mjs).

   The data is the website's own (see js/workPage.js):
     rosters/all       { periods: { "1st": ["Ava M.", ...], ... } }
     work/index        { sets: [{ id, title, period, date, kind, std, pages, bytes, students, unsorted, cleared }] }
     work/s_<id>       { id, title, period, date, kind, std, notes, per?, pages: [{ p, s, b, w, h, at, gone, by? }] }
     work/p_<pid>      { img, w, h, set, at, strip? }   strip: the name box at the top, when the site saved one

   Pages are numbered 1, 2, 3... in stack order, counting only pages that still have their picture or
   name (pages cleared to PDF keep their place). Claude never deletes anything here.
========================================== */
import * as W from "../../js/workCore.js";
import { SCHOOL_YEAR } from "../../data/calendar.js";

const ORD = ["", "1st", "2nd", "3rd", "4th"];
const pad = (n) => ("0" + n).slice(-2);
const weekday = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
export function isSchoolDay(s) {
    const w = weekday(s);
    if (w === 0 || w === 6 || s < SCHOOL_YEAR.first || s > SCHOOL_YEAR.last) return false;
    return !SCHOOL_YEAR.events.some(([a, b, kind]) => s >= a && s <= b && (kind === "off" || kind === "work"));
}
const fileOf = (d) => W.fileOf(d, SCHOOL_YEAR.nineWeeks, isSchoolDay);
const fmtDate = (d) => { if (!d) return "no date"; const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };

/** "3rd period", "3", "third" -> "3rd"; anything else is passed through. */
export function periodOf(p) {
    const s = String(p || "").trim().toLowerCase();
    const words = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7 };
    const m = /(\d)/.exec(s); const n = m ? +m[1] : Object.entries(words).find(([w]) => s.startsWith(w))?.[1];
    if (!n) return String(p || "").trim();
    return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
}

async function rosterFor(store, period) {
    const doc = await store.get("rosters/all");
    return ((doc && doc.data.periods && doc.data.periods[period]) || []).filter(Boolean);
}
const live = (set) => (set.pages || []).filter((p) => !p.gone);
function summary(set) {
    const people = new Set((set.pages || []).filter((p) => p.s && p.s !== W.KEY).map((p) => p.s));
    const l = live(set);
    return { pages: l.length, bytes: l.reduce((s, p) => s + (p.b || 0), 0), students: people.size, unsorted: l.filter((p) => !p.s).length };
}
function line(m, rosterSize) {
    const f = fileOf(m.date);
    return [
        "stack_id " + m.id,
        m.period + " period",
        fmtDate(m.date),
        "“" + (m.title || "Untitled") + "”",
        f.q ? ORD[f.q] + " nine weeks, " + f.label + " (" + f.range + ")" : "",
        (m.pages || 0) + " pages",
        (m.students || 0) + (rosterSize ? " of " + rosterSize : "") + " students named",
        m.unsorted ? m.unsorted + " pages not sorted" : "all pages sorted",
        m.cleared ? "pictures cleared " + m.cleared : "",
    ].filter(Boolean).join(" · ");
}

/* ---------- list_stacks ---------- */
export async function listStacks(store, { period, unsorted_only, limit } = {}) {
    const idx = await store.get("work/index");
    let sets = ((idx && idx.data.sets) || []).filter((m) => !m.removed);
    const per = period ? periodOf(period) : "";
    if (per) sets = sets.filter((m) => m.period === per);
    if (unsorted_only) sets = sets.filter((m) => m.unsorted > 0 && !m.cleared);
    sets.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.at || 0) - (a.at || 0));
    const total = sets.length; sets = sets.slice(0, Math.min(100, limit || 30));
    if (!sets.length) return per ? "No stacks for " + per + " period" + (unsorted_only ? " with unsorted pages." : ".") : "No stacks saved yet" + (unsorted_only ? " with unsorted pages." : ".");
    const rosters = (await store.get("rosters/all"))?.data?.periods || {};
    return [total > sets.length ? "Newest " + sets.length + " of " + total + " stacks:" : total + (total === 1 ? " stack:" : " stacks:"), ...sets.map((m) => "- " + line(m, (rosters[m.period] || []).length))].join("\n");
}

/* ---------- get_roster ---------- */
export async function getRoster(store, { period }) {
    const per = periodOf(period), r = await rosterFor(store, per);
    if (!r.length) return "No roster saved for " + per + " period. The teacher adds it on the Rosters page.";
    return per + " period roster (" + r.length + "):\n" + r.map((n) => "- " + n).join("\n");
}

async function loadSet(store, id) {
    const doc = await store.get("work/s_" + String(id || "").replace(/[^\w-]/g, ""));
    if (!doc || doc.data.removed) { const e = new Error("No stack with id " + id + ". Call list_stacks for the ids."); e.user = true; throw e; }
    return doc;
}

/* ---------- look_at_pages ---------- */
const MAX_FULL = 8, MAX_STRIPS = 30;
export async function lookAtPages(store, { stack_id, pages, view = "name", count } = {}) {
    const { data: set } = await loadSet(store, stack_id), l = live(set);
    const full = view === "page";
    const cap = full ? MAX_FULL : MAX_STRIPS;
    let want = Array.isArray(pages) && pages.length ? [...new Set(pages.map((n) => Math.floor(n)))].filter((n) => n >= 1 && n <= l.length)
        : l.map((p, i) => (p.s ? 0 : i + 1)).filter(Boolean);   // default: the pages nobody is named on yet
    const asked = want.length; want = want.slice(0, Math.min(cap, count || cap));
    const per = set.per ? " Pages per student: " + set.per + "." : "";
    const head = { type: "text", text: "“" + (set.title || "Untitled") + "”, " + set.period + " period, " + fmtDate(set.date) + ". " + l.length + " pages in the stack." + per +
        (want.length ? " Showing " + (full ? "whole pages" : "the name area at the top of each page") + " for page" + (want.length === 1 ? " " : "s ") + want.join(", ") + (asked > want.length ? " (" + (asked - want.length) + " more after these; ask for them next)." : ".") : " No pages to show: every page already has a name. Pass page numbers to look again.") };
    const out = [head];
    for (const n of want) {
        const pg = l[n - 1], doc = await store.get("work/p_" + pg.p);
        const now = pg.s ? "now: " + pg.s + (pg.by === "claude" ? " (named by Claude)" : "") : "now: not sorted";
        const d = doc && !doc.data.removed ? doc.data : null;
        const url = d ? (!full && d.strip) || d.img : "";
        const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(url || "");
        if (!m) { out.push({ type: "text", text: "Page " + n + " (" + now + "): picture cleared or missing." }); continue; }
        out.push({ type: "text", text: "Page " + n + " (" + now + ")" + (!full && !d.strip ? ", whole page (no name strip saved)" : "") + ":" });
        out.push({ type: "image", data: m[2], mimeType: m[1] });
    }
    return out;
}

/* ---------- assign_names ---------- */
/**
 * names: [{ page, name }]. name is a roster name (a first name or "first last" is matched like the
 * site's paste box), "key" for an answer key, "same" for one more page of the page before, or "?" to
 * leave it unsorted. Pages the teacher named by hand are not changed unless overwrite is true.
 */
export async function assignNames(store, { stack_id, names, overwrite = false } = {}) {
    if (!Array.isArray(names) || !names.length) return "Nothing to assign: pass names as [{ page, name }].";
    for (let attempt = 0; attempt < 3; attempt++) {
        const doc = await loadSet(store, stack_id), set = doc.data, l = live(set);
        const r = await rosterFor(store, set.period);
        const sorted = [...names].map((x) => ({ page: Math.floor(Number(x.page)), name: String(x.name ?? "").replace(/[\r\n]+/g, " ").slice(0, 80) })).sort((a, b) => a.page - b.page);
        const text = sorted.map((x) => x.page + " " + (x.name.trim() || "?")).join("\n");
        const { picks, unknown } = W.parseNameList(text, r);
        const done = [], kept = [], bad = [];
        let last = "";
        for (const x of sorted) {
            const pg = l[x.page - 1];
            if (!pg) { bad.push("page " + x.page + " is not in this stack (it has " + l.length + ")"); continue; }
            let v = picks[x.page - 1];
            if (v === W.SKIP) { bad.push("page " + x.page + ": pages can't be removed here; the teacher can delete it on the site"); continue; }
            if (v === W.SAME) v = last || (l[x.page - 2] && l[x.page - 2].s) || "";
            if (v === undefined) v = "";
            if (pg.s && pg.by !== "claude" && !overwrite && pg.s !== v) { kept.push(x.page + " (" + pg.s + ")"); last = pg.s; continue; }
            if (pg.s !== v || (v && pg.by !== "claude")) { pg.s = v; if (v) pg.by = "claude"; else delete pg.by; }
            if (v) done.push(x.page); last = v;
        }
        set.at = Date.now();
        try {
            await store.put("work/s_" + set.id, set, doc.updateTime);
        } catch (e) { if (e.changed) continue; throw e; }   // the teacher saved something meanwhile: read again and redo
        await saveIndexEntry(store, set);
        const s = summary(set), named = new Set(l.filter((p) => p.s && p.s !== W.KEY).map((p) => p.s));
        const none = r.filter((n) => !named.has(n));
        return [
            "Saved names for " + done.length + (done.length === 1 ? " page" : " pages") + " in “" + (set.title || "Untitled") + "” (" + set.period + " period). The teacher sees them marked “named by Claude” to check.",
            unknown.length ? "No roster match, left unsorted: " + unknown.map((u) => "page " + u.n + " (“" + u.text + "”)").join(", ") + ". Roster: " + list(r) : "",
            kept.length ? "Not changed, the teacher already named: page " + kept.join(", page ") + ". Pass overwrite true only if the teacher asked." : "",
            bad.length ? "Skipped: " + bad.join("; ") + "." : "",
            s.unsorted ? s.unsorted + " pages still not sorted." : "Every page has a name now.",
            r.length ? (none.length ? "No paper yet from: " + list(none) : "Every student on the roster has a paper.") : "",
        ].filter(Boolean).join("\n");
    }
    return "The stack kept changing while saving (the teacher may be editing it on the site). Try again in a moment.";
}

/** "A, B, C." without a doubled period after a name like "Ben T." */
const list = (names) => { const t = names.join(", "); return /\.$/.test(t) ? t : t + "."; };

async function saveIndexEntry(store, set) {
    for (let attempt = 0; attempt < 4; attempt++) {
        const idx = await store.get("work/index"), sets = (idx && idx.data.sets) || [];
        const meta = { id: set.id, title: set.title, period: set.period, date: set.date, kind: set.kind || "graded", std: set.std || "", cleared: set.cleared || "", ...summary(set) };
        const next = sets.some((m) => m.id === set.id) ? sets.map((m) => (m.id === set.id ? { ...m, ...meta } : m)) : [...sets, meta];
        try { await store.put("work/index", { ...(idx ? idx.data : {}), sets: next, at: Date.now() }, idx && idx.updateTime); return; }
        catch (e) { if (!e.changed) throw e; }
    }
}

export const _test = { summary, fileOf, pad };
