/* ==========================================
   Anchor Board — back up to Google Drive, and move old scans out of the database.

   Everything goes in one "Anchor Board" folder that Anchor Board makes in the teacher's Drive
   (they can move or rename it in Drive; it keeps working):
     Anchor Board/Backups/Anchor Board backup 2026-11-21.json   every saved document, one file per backup
     Anchor Board/Gradebook/Grades - 1st period - 2nd nine weeks  a Google Sheet per period (same file each time)
     Anchor Board/Student Work/2026-27/2nd nine weeks/Week 5 (Nov 16-20)/<date> <title> - 1st period.pdf
   Only what changed since the last backup is sent again.

   What Drive holds is remembered in the teacher's own private settings (teacher/{uid}/settings/drive):
     { root, account, last, lastFile, sheets: { "<period>|<term>": fileId },
       sets: { "<setId>": { f: fileId, at: <set saved at>, pages, link } } }
   No student data ever goes into the site's code; it goes from the teacher's account to the
   teacher's own Drive.
========================================== */
import { db } from "./firebase.js";
import { waitForUser } from "./auth.js";
import { doc, collection, getDoc, getDocs, setDoc, query, where, documentId, Timestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import * as Drive from "./drive.js?v=2";
import { buildPdf } from "./studentWork.js?v=58";
import { SCHOOL_YEAR, isSchoolDay } from "./schoolCal.js?v=58";
import * as W from "./workCore.js?v=1";
import * as G from "./gradeCore.js?v=3";
import { shortNames } from "./vaultCore.js?v=75";

// Every top-level folder under teacher/{uid}/ (keep in step with js/accountData.js COLLECTIONS).
export const BACKUP_COLLECTIONS = ["board", "ink", "games", "weekfiles", "pdfs", "pdfpages", "plans", "planner", "standards", "closeout",
    "data", "work", "rosters", "tally", "track", "settings", "asg", "gb", "progress", "seats", "walk"];
const ORD = ["", "1st", "2nd", "3rd", "4th"];
const NW = SCHOOL_YEAR.nineWeeks;
const DUE_DAYS = 7;
const todayIso = () => new Date().toLocaleDateString("en-CA");
const clean = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

let uid = "";
const tref = (p) => doc(db, `teacher/${uid}/${p}`);
async function me() { const u = await waitForUser(); if (!u) throw Object.assign(new Error("signed out"), { code: "signed-out" }); uid = u.uid; return u; }

/** The saved Drive settings (or an empty start). */
export async function settings() {
    await me();
    const s = await getDoc(tref("settings/drive"));
    const d = s.exists() ? s.data() : {};
    return { root: d.root || "", account: d.account || "", last: +d.last || 0, lastFile: d.lastFile || "", lastNote: d.lastNote || "", dayFile: d.dayFile || null, sheets: d.sheets || {}, sets: d.sets || {}, moved: d.moved || {}, lessons: d.lessons || {} };
}
const keep = (S) => setDoc(tref("settings/drive"), { ...S, at: Date.now() });

/** True when a Drive folder is set up and the last backup is a week old or more. */
export const due = (S) => !!(S && S.root) && Date.now() - (S.last || 0) > DUE_DAYS * 86400000;

/* ---------- reading everything ---------- */
// Firestore types made plain for JSON (a Timestamp becomes { "__time": ms }).
function plain(v) {
    if (v instanceof Timestamp) return { __time: v.toMillis() };
    if (Array.isArray(v)) return v.map(plain);
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = plain(v[k]); return o; }
    return v;
}
async function readAll(onStep) {
    const docs = {};
    for (const c of BACKUP_COLLECTIONS) {
        onStep("Reading " + c);
        const col = collection(db, `teacher/${uid}/${c}`);
        // Scanned page pictures (work/p_...) go to Drive as PDFs instead of into the backup file.
        const snaps = c === "work"
            ? [...(await getDocs(query(col, where(documentId(), "<", "p_")))).docs, ...(await getDocs(query(col, where(documentId(), ">=", "p`")))).docs]
            : (await getDocs(col)).docs;
        snaps.forEach((d) => { docs[c + "/" + d.id] = plain(d.data()); });
    }
    try {
        const pub = await getDoc(doc(db, `pub/${uid}`)); if (pub.exists()) docs["pub"] = plain(pub.data());
        (await getDocs(collection(db, `pub/${uid}/weeks`))).docs.forEach((d) => { docs["pub/weeks/" + d.id] = plain(d.data()); });
    } catch { /* no posted Class Pages */ }
    return docs;
}

/* ---------- the gradebook as Google Sheets ---------- */
function gradeCsvs(docs, periods) {
    const items = ((docs["gb/items"] || {}).list || []).filter((x) => x && x.id);
    if (!items.length) return [];
    const setup = G.cleanSetup(docs["gb/setup"] || {});
    const hand = new Map(), asg = new Map(), imports = new Map();
    Object.keys(docs).forEach((k) => {
        if (k.startsWith("gb/s_")) hand.set(k.slice(5), docs[k]);
        else if (k.startsWith("asg/a_")) asg.set(k.slice(6), docs[k]);
        else if (k.startsWith("data/i_") && docs[k] && docs[k].rows) imports.set(k.slice(7), docs[k]);
    });
    const ctx = { asg, imports, hand };
    const rosters = ((docs["rosters/all"] || {}).periods) || {};
    const term = G.termOf(todayIso(), NW) || 1;
    const out = [];
    periods.forEach((p) => {
        const roster = shortNames((rosters[p] || []).filter(Boolean));
        if (!roster.length) return;
        const T = G.gradeTable(items, p, roster, ctx, setup, term, NW);
        if (!T.cols.length) return;
        out.push({ key: p + "|" + term, name: "Grades - " + p + " period - " + ORD[term] + " nine weeks", csv: G.tableCsv(T, setup) });
    });
    return out;
}

/* ---------- Student Work as PDFs ---------- */
function orderPages(set, rosterNames) {
    const live = (set.pages || []).filter((p) => !p.gone);
    const names = [W.KEY, ...rosterNames, ...[...new Set(live.map((p) => p.s).filter((s) => s && s !== W.KEY && !rosterNames.includes(s)))].sort(), ""];
    return names.flatMap((n) => live.filter((p) => (p.s || "") === n));
}
async function setPdf(set, rosterNames) {
    const pages = orderPages(set, rosterNames);
    if (!pages.length) return null;
    const pics = new Map();
    (await getDocs(query(collection(db, `teacher/${uid}/work`), where("set", "==", set.id)))).docs.forEach((d) => { const x = d.data(); if (x && x.img) pics.set(d.id.slice(2), x); });
    const list = pages.map((pg) => { const d = pics.get(pg.p); return d ? { url: d.img, w: d.w, h: d.h, label: (pg.s || "NOT SORTED") + "   |   " + set.title } : null; });
    if (list.some((x) => !x)) throw Object.assign(new Error("Some pages of " + set.title + " did not load"), { code: "pages-missing" });
    const cover = { title: set.title || "Student work", lines: [set.period + " period · " + fmtDate(set.date), "Saved from Anchor Board " + fmtDate(todayIso()) + ".", "Answer key first, then students in roster order."] };
    return { blob: buildPdf(list, cover), pages: pages.length };
}
function placeOf(set) {
    const f = W.fileOf(set.date, NW, isSchoolDay);
    return f.q ? [SCHOOL_YEAR.label.replace(/[–—]/g, "-"), ORD[f.q] + " nine weeks", f.label + " (" + f.range + ")"] : [SCHOOL_YEAR.label.replace(/[–—]/g, "-"), "No date"];
}
async function sendSet(S, set, rosterNames, root, onStep) {
    const made = await setPdf(set, rosterNames);
    if (!made) return null;
    onStep("Saving " + set.title + " (" + set.period + " period) to Drive");
    const parent = await Drive.path(["Student Work", ...placeOf(set)], root);
    const f = await Drive.save(made.blob, { name: clean((set.date || "") + " " + set.title + " - " + set.period + " period") + ".pdf", parent, id: (S.sets[set.id] || {}).f });
    S.sets[set.id] = { f: f.id, at: +set.at || 0, pages: made.pages, link: f.webViewLink || "" };
    await keep(S);
    return f;
}

/** Make sure the Anchor Board folder exists in this Drive; returns its id. */
async function rootFolder(S) {
    if (S.root && (await Drive.info(S.root))) return S.root;
    S.root = await Drive.folder("Anchor Board");
    S.sheets = {}; S.sets = {};   // a new folder: send everything again
    return S.root;
}

/** For other pages that save into the Anchor Board folder (Week Review's lesson papers). Drive must be connected. */
export async function driveRoot() {
    await me();
    const S = await settings();
    const acct = await Drive.who();
    if (S.account && acct.email && S.account !== acct.email) { S.root = ""; S.lessons = {}; }   // another Google account: its own folder
    S.account = acct.email || S.account;
    const had = S.root, root = await rootFolder(S);
    if (had !== root) S.lessons = {};   // a new folder: nothing saved there yet
    await keep(S);
    return { S, root };
}
export const keepDrive = (S) => keep(S);

/**
 * Back up now. Drive must be connected (Drive.connect from a tap first).
 * onStep(text) reports progress. Resolves { file, sheets, pdfs, docs }.
 */
export async function backupNow(onStep = () => {}, periods = []) {
    await me();
    const S = await settings();
    const acct = await Drive.who();
    if (S.account && acct.email && S.account !== acct.email) { S.root = ""; }   // another Google account: its own folder
    S.account = acct.email || S.account;
    onStep("Finding the Anchor Board folder in Drive");
    const root = await rootFolder(S);
    await keep(S);

    // 1. Every saved document, in one file.
    const docs = await readAll(onStep);
    onStep("Saving the backup file");
    const body = JSON.stringify({ app: "Anchor Board", kind: "backup", version: 1, at: new Date().toISOString(), note: "Every document under your account, except scanned page pictures (those are the PDFs in Student Work). Times are { __time: milliseconds }.", docs });
    const backups = await Drive.folder("Backups", root);
    // One file per day: a second backup the same day replaces that day's file.
    const file = await Drive.save(new Blob([body], { type: "application/json" }), { name: "Anchor Board backup " + todayIso() + ".json", parent: backups, id: S.dayFile && S.dayFile.d === todayIso() ? S.dayFile.id : "" });
    S.dayFile = { d: todayIso(), id: file.id };

    // 2. The gradebook, one Google Sheet per period for this nine weeks.
    const sheets = gradeCsvs(docs, periods.length ? periods : Object.keys(((docs["rosters/all"] || {}).periods) || {}));
    if (sheets.length) {
        const gb = await Drive.folder("Gradebook", root);
        for (const s of sheets) {
            onStep("Saving " + s.name);
            const f = await Drive.save(new Blob([s.csv], { type: "text/csv" }), { name: s.name, parent: gb, as: Drive.SHEET, id: S.sheets[s.key] });
            S.sheets[s.key] = f.id;
        }
        await keep(S);
    }

    // 3. Student Work: one PDF per assignment per period, only the ones that changed.
    const index = ((docs["work/index"] || {}).sets || []).filter((m) => m && m.id && !m.cleared && m.pages);
    const rosters = ((docs["rosters/all"] || {}).periods) || {};
    let pdfs = 0;
    for (const m of index) {
        const set = docs["work/s_" + m.id]; if (!set || set.removed || !set.pages) continue;
        set.id = set.id || m.id; set.period = set.period || m.period;
        const had = S.sets[set.id];
        if (had && had.at === (+set.at || 0)) continue;
        if (await sendSet(S, set, (rosters[set.period] || []).filter(Boolean), root, onStep)) pdfs++;
    }

    S.last = Date.now(); S.lastFile = file.webViewLink || ""; S.lastNote = Object.keys(docs).length + " items, " + sheets.length + (sheets.length === 1 ? " grade sheet, " : " grade sheets, ") + pdfs + (pdfs === 1 ? " new Student Work PDF" : " new Student Work PDFs");
    await keep(S);
    onStep("Done");
    return { file, sheets: sheets.length, pdfs, docs: Object.keys(docs).length, settings: S };
}

/* ---------- moving finished nine weeks of scans out of the database ---------- */
function summary(set) {
    const people = new Set(set.pages.filter((p) => p.s && p.s !== W.KEY).map((p) => p.s));
    const live = set.pages.filter((p) => !p.gone);
    return { pages: live.length, bytes: live.reduce((s, p) => s + (p.b || 0), 0), students: people.size, unsorted: live.filter((p) => !p.s).length };
}

/** Nine weeks that are over and still have scans in the database: [{ q, label, sets, pages, bytes }]. */
export async function movable() {
    await me();
    const s = await getDoc(tref("work/index"));
    const index = ((s.exists() && s.data().sets) || []).filter((m) => m && m.id && !m.cleared && m.pages);
    const now = G.termOf(todayIso(), NW) || 1;
    const out = [];
    W.tree(index, NW, isSchoolDay).filter((t) => t.q && t.q < now).forEach((t) => {
        const sets = t.weeks.flatMap((w) => w.sets).filter((m) => !m.cleared && m.pages);
        if (sets.length) out.push({ q: t.q, label: ORD[t.q] + " nine weeks", sets: sets.length, pages: sets.reduce((a, m) => a + (m.pages || 0), 0), bytes: sets.reduce((a, m) => a + (m.bytes || 0), 0) });
    });
    return out;
}

/**
 * Move one finished nine weeks of scans to Drive: each assignment's PDF is saved (or brought up
 * to date) and checked in Drive first, and only then are its page pictures removed from the
 * database, the same way Student Work's own "Clear these scans" does. The list of assignments and
 * who turned what in stays. Resolves the number of assignments moved.
 */
export async function moveTerm(q, onStep = () => {}) {
    await me();
    const S = await settings();
    const root = await rootFolder(S);
    const rosterSnap = await getDoc(tref("rosters/all"));
    const rosters = (rosterSnap.exists() && rosterSnap.data().periods) || {};
    const idx0 = await getDoc(tref("work/index"));
    const metas = ((idx0.exists() && idx0.data().sets) || []).filter((m) => m && m.id && !m.cleared && m.pages && W.fileOf(m.date, NW, isSchoolDay).q === q);
    let moved = 0;
    for (const m of metas) {
        const snap = await getDoc(tref("work/s_" + m.id)); if (!snap.exists()) continue;
        const set = snap.data(); if (!set.pages) continue;
        set.id = set.id || m.id; set.period = set.period || m.period;
        const had = S.sets[set.id];
        let f = had && had.at === (+set.at || 0) ? await Drive.info(had.f) : null;
        if (!f) { f = await sendSet(S, set, (rosters[set.period] || []).filter(Boolean), root, onStep); if (f) f = await Drive.info(f.id); }
        if (!f || !(+f.size > 0)) throw Object.assign(new Error("Drive did not keep " + set.title), { code: "not-saved" });
        onStep("Freeing space: " + set.title + " (" + set.period + " period)");
        for (const pg of set.pages) if (!pg.gone) { await setDoc(tref("work/p_" + pg.p), { removed: true, at: Date.now() }); pg.gone = 1; }
        set.cleared = todayIso(); set.drive = { id: f.id, link: f.webViewLink || "" }; set.at = Date.now();
        await setDoc(tref("work/s_" + set.id), set);
        S.sets[set.id] = { ...(S.sets[set.id] || {}), at: set.at, moved: set.cleared };
        // Read the list fresh right before changing it, so a change made on another device is not lost.
        const idx = await getDoc(tref("work/index")); const sets = (idx.exists() && idx.data().sets) || [];
        const meta = { id: set.id, title: set.title, period: set.period, date: set.date, kind: set.kind || "graded", std: set.std || "", cleared: set.cleared, ...summary(set) };
        await setDoc(tref("work/index"), { sets: sets.some((x) => x.id === set.id) ? sets.map((x) => x.id === set.id ? { ...x, ...meta } : x) : [...sets, meta], at: Date.now() });
        moved++;
    }
    S.moved[q] = todayIso();
    await keep(S);
    onStep("Done");
    return moved;
}
