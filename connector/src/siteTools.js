/* ==========================================
   The rest of Anchor Board for Claude: week plans, the week files Claude builds, grades and Class Data,
   plus a plain read of any of the teacher's own documents. This replaces the old "Focal Firestore"
   connector, and goes through the same sign-in and database rules as the website.

   The data is the website's own, under teacher/{uid}/:
     plans/<weekId>     the week plan the teacher fills in on Plan a Week (js/plan.js), with .brief once sent to Claude
     planner/plans      { days: { iso: { note, c: { cls: text } } }, weeks: { monday: { c: { cls: focus } } } }
     weekfiles/<id>     { json, at }: a finished week (Claude's or the Week Builder's), waiting for Week Review
     weekfiles/index    { weeks: [{ id, label, dates, monday, approved, at }] }: the approved weeks
     gb/setup, gb/items, gb/s_<id>   the gradebook (js/gradeCore.js)
     data/index, data/i_<id>         Class Data sets per period (rows: [{ s: name, v: [0..1 per item] }])
     asg/index, asg/a_<id>           Assignments with results

   Writes here: only save_week_file (a draft week for Week Review; the one it replaces is kept in .prev).
   Nothing is deleted, and nothing goes on the board until the teacher approves it on the site.
========================================== */
import * as G from "../../js/gradeCore.js";
import { matchRoster } from "../../js/progress.js";
import { SCHOOL_YEAR } from "../../data/calendar.js";
import { periodOf } from "./tools.js";

const SITE = "https://anchorboard.web.app";
const ORD = ["", "1st", "2nd", "3rd", "4th"];
const userErr = (msg) => { const e = new Error(msg); e.user = true; return e; };
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const fmtDate = (d) => { if (!d) return "no date"; const [y, m, dd] = String(d).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, dd).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const pct = (v) => (v == null || !isFinite(v) ? "–" : Math.round(v * 100) + "%");

/* ---------- read any document ---------- */
export const COLLECTIONS = {
    plans: "week plans from Plan a Week, one per week id (week6, q3w2...)",
    planner: "planner/plans: the year planner's day notes and week focus",
    weekfiles: "finished weeks waiting for or past Week Review; weekfiles/index lists the approved ones",
    rosters: "rosters/all: student names per period",
    gb: "the gradebook: gb/setup, gb/items, gb/s_<item id> for typed scores",
    data: "Class Data: data/index and data/i_<id>, one set per period (Magma Math, DeltaMath, Wayground, Blooket, scanned papers, Vault Raid)",
    asg: "Assignments: asg/index and asg/a_<id> with results",
    work: "Student Work scan stacks (use the stack tools; pictures are not shown here)",
    standards: "standards/progress: which standards were taught and assessed",
    progress: "progress/index: Student Progress settings",
    games: "Vault Raid sets and results (games/index, games/results, games/s_<id>)",
    seats: "seating charts",
    tally: "behavior tallies",
    track: "Class Tracker days (positives, needs work, restroom, notes)",
    settings: "site settings",
    closeout: "week closeout checklists",
    board: "board/state: what the classroom board is showing",
};
const cleanPath = (p) => String(p || "").trim().replace(/^\/+|\/+$/g, "").replace(/^teacher\/[^/]+\//, "");
const okSeg = (s) => /^[\w.-]{1,120}$/.test(s) && s !== "." && s !== "..";

/** Pictures are swapped for a short note, so a read stays small and readable. */
function shrink(v) {
    if (typeof v === "string") return /^data:[\w/+.-]+;base64,/.test(v) && v.length > 200 ? "[picture, " + Math.round(v.length * 0.75 / 1024) + " KB, not shown]" : v;
    if (Array.isArray(v)) return v.map(shrink);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shrink(x)]));
    return v;
}
const MAX_TEXT = 60000;
function asJson(v) {
    const t = JSON.stringify(shrink(v), null, 1);
    return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + "\n… (cut off at " + MAX_TEXT + " of " + t.length + " characters)" : t;
}

export async function listSiteData(store, { collection } = {}) {
    const c = cleanPath(collection);
    if (!c) return "The teacher's data, by collection (pass one as collection to see its documents):\n" + Object.entries(COLLECTIONS).map(([k, v]) => "- " + k + ": " + v).join("\n");
    const parts = c.split("/");
    if (!parts.every(okSeg) || parts.length % 2 !== 1) throw userErr("collection must be a collection name like \"plans\" or \"gb\".");
    const ids = await store.list(c);
    if (!ids.length) return "No documents in " + c + ".";
    return ids.length + " documents in " + c + " (read one with read_site_data, path \"" + c + "/<id>\"):\n" + ids.join(", ");
}

export async function readSiteData(store, { path } = {}) {
    const p = cleanPath(path), parts = p.split("/");
    if (!p || !parts.every(okSeg) || parts.length % 2 !== 0) throw userErr("path must be a collection and a document, like \"plans/week6\", \"planner/plans\" or \"gb/setup\". Call list_site_data to see what is there.");
    const doc = await store.get(p);
    if (!doc) return "Nothing saved at " + p + ".";
    if (/^weekfiles\/[^/]+$/.test(p) && typeof doc.data.json === "string") {
        let week = null; try { week = JSON.parse(doc.data.json); } catch { /* left as text */ }
        if (week) return p + " (saved " + (doc.data.at ? new Date(doc.data.at).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "at an unknown time") + "):\n" + asJson(week);
    }
    return p + ":\n" + asJson(doc.data);
}

/* ---------- week plans and week files ---------- */
async function findPlan(store, week) {
    const w = String(week || "").trim();
    if (!w) throw userErr("Pass week: a week id like \"week6\" or \"q3w2\", or any date in that week like \"2026-12-01\".");
    if (/^\d{4}-\d{2}-\d{2}$/.test(w)) {
        const [y, m, d] = w.split("-").map(Number), dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
        const monday = dt.toISOString().slice(0, 10);
        for (const id of await store.list("plans")) {
            if (!okSeg(id)) continue;
            const doc = await store.get("plans/" + id);
            if (doc && doc.data.monday === monday) return { id, doc };
        }
        throw userErr("No week plan saved for the week of " + fmtDate(monday) + ". The teacher starts one on Plan a Week (" + SITE + "/plan.html).");
    }
    if (!okSeg(w)) throw userErr("week must be a week id like \"week6\" or a date.");
    const doc = await store.get("plans/" + w);
    if (!doc) {
        const ids = (await store.list("plans")).filter(okSeg);
        throw userErr("No week plan with id " + w + "." + (ids.length ? " Saved week plans: " + ids.join(", ") + "." : " The teacher starts one on Plan a Week (" + SITE + "/plan.html)."));
    }
    return { id: w, doc };
}

export async function readWeekPlan(store, { week } = {}) {
    const { id, doc } = await findPlan(store, week), plan = doc.data;
    const [file, index] = await Promise.all([store.get("weekfiles/" + id), store.get("weekfiles/index")]);
    const approved = ((index && index.data.weeks) || []).find((x) => x && x.id === id && x.approved);
    const head = [
        (plan.label || id) + (plan.dates ? " (" + plan.dates + ")" : "") + ", " + (ORD[plan.nineWeeks] || "") + " nine weeks. Week id: " + id + ". Plan status: " + (plan.status || "draft") + ".",
        plan.brief ? "The teacher sent this plan to Claude. Build the week from \"brief\" and follow its rules, then save it with save_week_file (week_id " + id + ")." : "The teacher has not pressed Send to Claude yet, so there is no brief; the plan below may still change.",
        approved ? "A week file for " + id + " is already approved and on the board. Only replace it if the teacher asks." : file ? "A week file for " + id + " is saved and waiting for Week Review." : "No week file saved for " + id + " yet.",
    ];
    return head.join("\n") + "\n\n" + asJson(plan);
}

/** The same check the site uses before it shows a week (js/weeksLive.js okWeek). */
const okWeek = (w) => w && typeof w === "object" && typeof w.id === "string" && w.classes && typeof w.classes === "object" && !Array.isArray(w.classes)
    && Object.keys(w.classes).length > 0 && Object.values(w.classes).every((c) => c && Array.isArray(c.days) && c.days.length === 5);

export async function saveWeekFile(store, { week_id, week, replace_approved = false } = {}) {
    const id = String(week_id || "").trim();
    if (!okSeg(id)) throw userErr("week_id must be the week's id, like \"week6\".");
    let w = week;
    if (typeof w === "string") { try { w = JSON.parse(w); } catch (e) { throw userErr("week is not valid JSON: " + e.message); } }
    if (!okWeek(w)) throw userErr("That week file would not open on the site. It needs an id and classes, and every class needs days with exactly 5 entries (Monday to Friday).");
    if (w.id !== id) throw userErr("The week's id is \"" + w.id + "\" but week_id is \"" + id + "\". They must match.");
    const json = JSON.stringify(w);
    if (json.length > 900000) throw userErr("That week file is too big to save (" + Math.round(json.length / 1024) + " KB; the limit is about 900 KB).");
    const index = await store.get("weekfiles/index");
    const approved = ((index && index.data.weeks) || []).find((x) => x && x.id === id && x.approved);
    if (approved && !replace_approved) throw userErr("Week " + id + " is already approved and on the board. Nothing was saved. Pass replace_approved true only if the teacher asked to replace it; the board keeps showing the new file right away.");
    for (let attempt = 0; attempt < 3; attempt++) {
        const old = await store.get("weekfiles/" + id);
        const doc = { json, at: Date.now(), by: "claude" };
        if (old && typeof old.data.json === "string") { doc.prev = old.data.json; doc.prevAt = old.data.at || 0; }
        try { await store.put("weekfiles/" + id, doc, old ? old.updateTime : undefined); }
        catch (e) { if (e.changed) continue; throw e; }
        const classes = Object.keys(w.classes).length;
        return [
            "Saved " + (w.label || id) + (w.dates ? " (" + w.dates + ")" : "") + " with " + classes + (classes === 1 ? " class" : " classes") + (old ? ". The file it replaced is kept as a backup." : "."),
            approved ? "This week was already approved, so the board shows the new file now." : "It is not on the board yet. The teacher checks and approves it on Week Review: " + SITE + "/review.html?week=" + encodeURIComponent(id),
            w.checked && w.checked.n ? "" : "It has no \"checked\" stamp, so Week Review will ask for the answers to be checked first.",
        ].filter(Boolean).join("\n");
    }
    return "The week file kept changing while saving (the teacher may have it open on the site). Try again in a moment.";
}

/* ---------- Class Data ---------- */
const rowScore = (imp, row) => {
    const vals = (row.v || []).filter((v) => v != null && isFinite(v));
    if (!vals.length) return null;
    return imp.source === "Vault Raid" || imp.source === "Assignment" ? (row.v[0] != null ? row.v[0] : vals[0]) : vals.reduce((s, v) => s + v, 0) / vals.length;
};

export async function listClassData(store, { period, limit } = {}) {
    const idx = await store.get("data/index");
    let list = ((idx && idx.data.imports) || []).filter((m) => m && m.id && !m.removed);
    const per = period ? periodOf(period) : "";
    if (per) list = list.filter((m) => m.period === per);
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.at || 0) - (a.at || 0));
    const total = list.length; list = list.slice(0, Math.min(100, limit || 40));
    if (!list.length) return per ? "No Class Data for " + per + " period." : "No Class Data saved yet.";
    return (total > list.length ? "Newest " + list.length + " of " + total : String(total)) + " Class Data sets:\n" + list.map((m) =>
        "- data_id " + m.id + " · " + m.period + " period · " + fmtDate(m.date) + " · “" + (m.title || "Untitled") + "” · " + (m.source || "unknown source") +
        (m.std ? " · standard " + m.std : "") + " · " + (m.n || 0) + " students · " + (m.items || 0) + " items").join("\n");
}

export async function getClassData(store, { data_id } = {}) {
    const id = String(data_id || "").trim();
    if (!okSeg(id)) throw userErr("Pass data_id from list_class_data.");
    const doc = await store.get("data/i_" + id);
    if (!doc || doc.data.removed) throw userErr("No Class Data set with id " + id + ". Call list_class_data for the ids.");
    const imp = doc.data, items = imp.items || [], rows = (imp.rows || []).filter((r) => r && r.s);
    const scored = rows.map((r) => ({ r, v: rowScore(imp, r) }));
    const vals = scored.map((x) => x.v).filter((v) => v != null);
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    const itemAvg = items.map((_, k) => { const xs = rows.map((r) => (r.v || [])[k]).filter((v) => v != null && isFinite(v)); return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null; });
    return [
        "“" + (imp.title || "Untitled") + "”, " + imp.period + " period, " + fmtDate(imp.date) + ", from " + (imp.source || "an unknown source") + (imp.std ? ", standard " + imp.std : "") + ".",
        rows.length + " students. Class average " + pct(avg) + ". Scores are 0-100% per item.",
        items.length ? "Items (class average): " + items.map((it, k) => it + " " + pct(itemAvg[k])).join(", ") : "",
        "",
        ...scored.map(({ r, v }) => "- " + r.s + ": " + pct(v) + (items.length > 1 ? " (" + (r.v || []).map((x) => (x == null ? "–" : pct(x))).join(", ") + ")" : "")),
    ].filter((x) => x !== "").join("\n");
}

/* ---------- grades ---------- */
export async function getGrades(store, { period, nine_weeks, student } = {}) {
    const per = periodOf(period);
    if (!per) throw userErr("Pass period, like \"1st\".");
    const terms = SCHOOL_YEAR.nineWeeks;
    const term = nine_weeks === 0 ? 0 : nine_weeks || G.termOf(todayIso(), terms);
    const [rDoc, sDoc, iDoc] = await Promise.all([store.get("rosters/all"), store.get("gb/setup"), store.get("gb/items")]);
    const roster = ((rDoc && rDoc.data.periods && rDoc.data.periods[per]) || []).filter(Boolean);
    if (!roster.length) return "No roster saved for " + per + " period, so there are no grades. The teacher adds it on the Rosters page.";
    const setup = G.cleanSetup(sDoc && sDoc.data);
    const items = ((iDoc && iDoc.data.list) || []).filter((it) => it && it.id && it.date && (it.periods || []).includes(per) && (!term || G.termOf(it.date, terms) === term));
    const when = term ? ORD[term] + " nine weeks" : "the whole year";
    if (!items.length) return "No grade items for " + per + " period in " + when + " yet. The teacher adds them in the Gradebook (" + SITE + "/grades.html).";
    const ctx = { asg: new Map(), imports: new Map(), hand: new Map() };
    await Promise.all(items.map(async (it) => {
        const src = it.src || { k: "hand" };
        const hand = await store.get("gb/s_" + it.id); if (hand) ctx.hand.set(it.id, hand.data);
        if (src.k === "asg" && src.id && okSeg(src.id)) { const d = await store.get("asg/a_" + src.id); if (d) ctx.asg.set(src.id, d.data); }
        const imp = src.k === "data" && (src.ids || {})[per];
        if (imp && okSeg(imp)) { const d = await store.get("data/i_" + imp); if (d) ctx.imports.set(imp, d.data); }
    }));
    const T = G.gradeTable(items, per, roster, ctx, setup, term, terms);
    const cat = (id) => (setup.cats.find((c) => c.id === id) || setup.cats[0]).name;
    const how = G.weighted(setup) ? "Weighted: " + setup.cats.map((c) => c.name + " " + c.w + "%").join(", ") : "Total points (no category weights set yet)";
    const scale = setup.scale.map(([l, m]) => l + " " + m).join(", ");
    const cellText = (c, it) => !c ? "not entered" : c.x === "ex" ? "Excused" : c.f != null ? pct(c.f) + (it.pts ? " (" + Math.round(c.f * it.pts * 10) / 10 + "/" + it.pts + ")" : "") + (c.before != null ? ", was " + pct(c.before) + " before corrections" : "") + (c.x === "m" ? ", marked missing" : "") : c.x === "m" ? "Missing" + (setup.missing === "zero" ? " (counts as 0)" : "") : "not entered";
    const head = per + " period, " + when + ". " + items.length + " grade items. " + how + ". Scale: " + scale + ".";
    if (student) {
        const i = matchRoster(student, roster);
        if (i < 0) throw userErr("No one on the " + per + " period roster matches “" + student + "”. Call get_roster for the names.");
        const row = T.rows[i], g = row.grade;
        return [head, "", row.s + ": " + (g.v == null ? "no grade yet" : pct(g.v) + " " + g.letter) + (g.missing ? " · " + g.missing + " missing" : "") + ".",
            g.cats.some((c) => c.possible > 0) ? "By category: " + g.cats.filter((c) => c.possible > 0).map((c) => c.name + " " + pct(c.v)).join(", ") + "." : null,
            "", ...T.cols.map((col, k) => "- " + fmtDate(col.item.date) + " “" + col.item.title + "” (" + cat(col.item.cat) + ", " + (col.item.pts || 0) + " pts" + (col.item.off ? ", not counted" : "") + "): " + cellText(row.cells[k], col.item))]
            .filter((x) => x !== null).join("\n");
    }
    return [head, "Class average " + pct(T.avg) + (T.missing ? ". " + T.missing + " missing assignments in all" : "") + ".", "",
        "Students:", ...T.rows.map((r) => "- " + r.s + ": " + (r.grade.v == null ? "no grade yet" : pct(r.grade.v) + " " + r.grade.letter) + (r.grade.missing ? " · " + r.grade.missing + " missing" : "")),
        "", "Grade items, newest first:", ...T.cols.map((c) => "- " + fmtDate(c.item.date) + " “" + c.item.title + "” (" + cat(c.item.cat) + ", " + (c.item.pts || 0) + " pts" + (c.item.off ? ", not counted" : "") + "): average " + pct(c.avg) + ", " + c.n + " scored" + (c.missing ? ", " + c.missing + " missing" : "") + (c.blanks ? ", " + c.blanks + " not entered" : "")),
        "", "Pass student for one student's scores item by item."].join("\n");
}
