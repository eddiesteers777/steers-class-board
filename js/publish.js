/* ==========================================
   Focal — Class Pages publishing (Phase 2 of the weekly workflow).
   Approving a week on Week Review copies a STUDENT version of it to the public read-only area
     pub/{uid}/weeks/<weekId>   { id, label, dates, monday, at, classes: { <cls>: student class } }
     pub/{uid}                  { weeks: [{ id, label, dates, monday }], classes: { <cls>: { label, cls } } }
   which class.html shows to students and parents without sign-in. The student version keeps only
   what a student sheet shows: no answers, worked solutions, likely wrong answers, keys, speed dating
   cards or Claude's check stamp, and never any student information (none is in a week file).
   Firestore rules: pub/{uid}/** is readable by anyone and writable only by that teacher.
========================================== */
import { myName, CALERA_NAME } from "./teacherName.js?v=1";
let ME = CALERA_NAME;   // signs the parent message; the Calera account is Mr. Steers, a new teacher their setup name
myName().then((n) => { ME = n; }).catch(() => {});
const DROP = new Set(["a", "ans", "answer", "answers", "work", "wrong", "key", "checked", "orig", "edited", "speedDating", "exitAnswers", "teacher", "teacherNotes"]);

/** A deep copy with every answer-bearing field removed. */
export function strip(x) {
    if (Array.isArray(x)) return x.map(strip);
    if (!x || typeof x !== "object") return x;
    const out = {};
    for (const [k, v] of Object.entries(x)) if (!DROP.has(k) && !k.startsWith("_")) out[k] = strip(v);
    return out;
}

const BADLINK = /\b(key|keys|test|jeopardy|answers?)\b/i;
/** The student version of one class's week. */
export function studentClass(c, extra) {
    const s = strip({
        label: c.label, cls: c.cls, weekLT: c.weekLT || "",
        days: (c.days || []).map((d) => ({
            name: d.name, title: d.title, date: d.date, agendaLine: d.agendaLine || "", short: d.short || "", bell: d.bell || "", agenda: d.agenda || [], supplies: d.supplies || [],
            reminders: d.reminders || [], lt: d.lt || "", bellNote: d.bellNote, problems: (d.problems || []).map((p) => ({ q: p.q })), notes: d.notes || undefined
        })),
        bellringer: c.bellringer, studyGuide: c.studyGuide,
        links: (c.links || []).filter((l) => l && l.u && /^https:\/\//.test(l.u) && !BADLINK.test((l.t || "") + " " + l.u)),
        videos: (c.videos || []).filter((v) => v && (v.id || v.u)).slice(0, 6)
    });
    return Object.assign(s, extra || {});
}

/** Write the student week and update the index. store = boardStore (rooms.save writes full paths). */
export async function publishWeek(store, uid, week, plan) {
    const classes = {};
    Object.entries(week.classes).forEach(([k, c]) => {
        const pc = plan && plan.classes && plan.classes[k];
        classes[k] = studentClass(c, { topic: (pc && pc.topic) || "", homework: (pc && pc.homework) || "" });
    });
    const doc = { id: week.id, label: week.label || week.id, dates: week.dates || "", monday: week.monday || "", at: Date.now(), classes };
    await store.rooms.save("pub/" + uid + "/weeks/" + week.id, JSON.parse(JSON.stringify(doc)));
    const idx = (await store.rooms.get("pub/" + uid)) || {};
    const weeks = (idx.weeks || []).filter((w) => w.id !== week.id).concat([{ id: doc.id, label: doc.label, dates: doc.dates, monday: doc.monday }])
        .sort((a, b) => String(a.monday).localeCompare(String(b.monday)));
    const cl = Object.assign({}, idx.classes || {}); Object.entries(classes).forEach(([k, c]) => { cl[k] = { label: c.label, cls: c.cls || "" }; });
    await store.rooms.save("pub/" + uid, { weeks, classes: cl, at: Date.now() });
}
export async function unpublishWeek(store, uid, id) {
    await store.rooms.del("pub/" + uid + "/weeks/" + id);
    const idx = (await store.rooms.get("pub/" + uid)) || {};
    await store.rooms.save("pub/" + uid, { weeks: (idx.weeks || []).filter((w) => w.id !== id), classes: idx.classes || {}, at: Date.now() });
}

/** The class page address for a class. */
export const classUrl = (uid, cls) => new URL("class.html?t=" + encodeURIComponent(uid) + "&c=" + encodeURIComponent(cls), location.href).href;

/** The weekly parent message, in the standing Thrillshare format. */
const GRADE = { "7th": "7th grade", "8th": "8th grade", "8th-acc": "8th grade Accelerated" };
export function parentMessage(week, cls, plan, link, questions) {
    const c = week.classes[cls], pc = plan && plan.classes && plan.classes[cls];
    const md = (i) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(week.monday || ""); if (!m) return ""; const d = new Date(+m[1], +m[2] - 1, +m[3] + i); return (d.getMonth() + 1) + "/" + d.getDate(); };
    const DK = ["Mon", "Tue", "Wed", "Thu", "Fri"], FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const lines = [];
    lines.push("Hello " + (GRADE[cls] || c.label) + " families,");
    const topic = (pc && pc.topic) || c.weekLT || "";
    if (topic) lines.push("This week we are working on " + topic.replace(/^(Topic|Unit)\s+\w+:\s*/i, "") + ".");
    const tests = c.days.map((d, i) => [d, i]).filter(([d]) => /\b(quiz|test)\b/i.test(d.agendaLine || ""));
    if (tests.length) lines.push(tests.map(([d, i]) => (/\btest\b/i.test(d.agendaLine) ? "Test" : "Quiz") + " on " + FULL[i] + " " + md(i) + ".").join(" "));
    lines.push(c.days.map((d, i) => DK[i] + " " + md(i) + ": " + (d.agendaLine || "")).join("\n"));
    const hw = (pc && pc.homework) || "";
    if (hw) lines.push("Homework: " + hw + ".");
    lines.push("This week's plan and every paper: " + link);
    if (questions) lines.push(questions);
    lines.push("Thank you, " + (ME || "your teacher"));
    return lines.join("\n\n").replace(/\.\./g, ".");
}
