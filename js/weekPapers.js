/* ==========================================
   Anchor Board — every paper in a week, in the teacher's Drive order.

   One list for Week Review's "Paper for this week" (print it all, save it all to Drive):
     "0 Weekly - " first, then "1 Monday - " to "5 Friday - ", each TEACHER KEY right after its item.
   File names follow tools/weekly_kit/build_week.py, so a paper saved from the site has the same name
   as one the weekly kit builds. The modified group's papers go in "Alternate Assignments".
   Each paper: { id, cls, label, file, key, alt, build(week) -> .sheet element }.
   id is the same id Week Builder uses, so printing ticks the same close-out items.
========================================== */
import { DAYS, bellringerSheet, bellringerKey, notesSheet, studyGuideSheet, studyGuideKey, speedDatingSheet, speedDatingKey, homeworkSheet, homeworkKey, homeworkTitle } from "./weekSheets.js?v=60";
import { quizSheet, quizKey, modQuizSheet, modQuizKey, modStudyGuideSheet, modStudyGuideKey, modNotesSheet, modNotesKey, modHomeworkSheet, modHomeworkKey, subPlanSheet, subWorksheetSheet, sudokuSheet } from "./moreSheets.js?v=63";

export const TAG = { "7th": "7th Grade", "8th": "8th Grade", "8th-acc": "8th Grade Accelerated" };
const clean = (s) => String(s || "").replace(/[{}^§$]/g, "").replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim();
const dayPre = (i) => (i + 1) + " " + DAYS[i];
const isDay = (n) => Number.isInteger(n) && n >= 0 && n < 5;

/** The papers one class has this week, in Drive order. opts.guestUrl goes on the sub plan. */
export function papersFor(week, cid, opts = {}) {
    const c = week && week.classes && week.classes[cid]; if (!c) return [];
    const tag = TAG[cid] || c.label || cid, out = [];
    const add = (pre, id, label, name, build, keyName, keyBuild, extra) => {
        const base = Object.assign({ cls: cid, alt: false }, extra || {});
        out.push(Object.assign({}, base, { id, label, key: false, pre, file: clean(pre + " - " + name + " (" + tag + (base.alt ? " Modified" : "") + ")"), build }));
        if (keyBuild) out.push(Object.assign({}, base, { id: id + "key", label: label + " key", key: true, pre, file: clean(pre + " - TEACHER KEY - " + keyName + " (" + tag + (base.alt ? " Modified" : "") + ")"), build: keyBuild }));
    };
    const prefixOf = (part) => (part && part.prefix) || "0 Weekly";

    if (c.days.some((d) => (d.problems || []).length)) add("0 Weekly", "sheet", "Bellringer", "Bellringer (Mon-Fri)", (w) => bellringerSheet(w, cid), "Bellringer", (w) => bellringerKey(w, cid));
    if (c.homework && (c.homework.days || []).length) {
        const name = c.homework.file || (cid === "7th" ? "Extra Practice" : "Homework Packet (Due Thursday)");
        add(prefixOf(c.homework), "hw", homeworkTitle(week, cid), name, (w) => homeworkSheet(w, cid), name.replace(/\s*\(Due[^)]*\)/i, ""), (w) => homeworkKey(w, cid));
    }
    if (c.studyGuide && c.studyGuide.title) add(prefixOf(c.studyGuide), "sg", "Study guide", "Study Guide", (w) => studyGuideSheet(w, cid), "Study Guide", (w) => studyGuideKey(w, cid));
    if (c.speedDating && Array.isArray(c.speedDating.cards)) add(prefixOf(c.speedDating), "sd", "Speed dating", "Speed Dating Cards and Recording Sheet", (w) => speedDatingSheet(w, cid), "Speed Dating Cards and Recording Sheet", (w) => speedDatingKey(w, cid));
    c.days.forEach((d, i) => {
        if (d && d.notes) add(dayPre(i), "notes" + i, "Guided notes, " + DAYS[i], "Guided Notes - " + d.notes.title, (w) => notesSheet(w, cid, i, false), "Guided Notes - " + d.notes.title, (w) => notesSheet(w, cid, i, true), { day: i });
    });
    const q = c.quiz;
    if (q && (q.items || []).length) {
        const word = q.kind === "test" ? "Test" : "Quiz", title = String(q.title || word).replace(/^(Quiz|Test):\s*/i, ""), pre = isDay(+q.day) ? dayPre(+q.day) : "0 Weekly";
        const name = title.toLowerCase() === word.toLowerCase() ? word : word + " - " + title;
        add(pre, "quiz", word, name, (w) => quizSheet(w, cid), name, (w) => quizKey(w, cid));
        if (q.modified) add(pre, "mod", "Modified " + word.toLowerCase(), name, (w) => modQuizSheet(w, cid), name, (w) => modQuizKey(w, cid), { alt: true });
    }
    if (c.modStudyGuide && (c.modStudyGuide.parts || []).length) add("0 Weekly", "modsg", "Modified study guide", "Study Guide - " + String(c.modStudyGuide.title || "").replace(/^Study Guide:\s*/i, ""), (w) => modStudyGuideSheet(w, cid), "Study Guide", (w) => modStudyGuideKey(w, cid), { alt: true });
    c.days.forEach((d, i) => {
        if (d && d.modNotes) add(dayPre(i), "modnotes" + i, "Modified guided notes, " + DAYS[i], "Guided Notes - " + d.modNotes.title, (w) => modNotesSheet(w, cid, i), "Guided Notes - " + d.modNotes.title, (w) => modNotesKey(w, cid, i), { alt: true, day: i });
    });
    if (c.modHomework && (c.modHomework.days || []).length) add("0 Weekly", "modhw", "Modified homework packet", "Modified Homework Packet (Due Thursday)", (w) => modHomeworkSheet(w, cid), "Modified Homework Packet", (w) => modHomeworkKey(w, cid), { alt: true });
    const s = c.sub;
    if (s && isDay(+s.day)) {
        const pre = dayPre(+s.day);
        add(pre, "subplan", "Sub plan", "Sub Plan", (w) => subPlanSheet(w, cid, { guestUrl: opts.guestUrl || "" }));
        if (s.worksheet) add(pre, "subws", "Sub worksheet", "Sub Worksheet", (w) => subWorksheetSheet(w, cid, false), "Sub Worksheet", (w) => subWorksheetSheet(w, cid, true));
        add(pre, "sudoku", "Sudoku early finishers", "Early Finishers - Sudoku", (w) => sudokuSheet(w, cid, false), "Sudoku", (w) => sudokuSheet(w, cid, true));
    }
    // "0 Weekly" first, then Monday to Friday; a key stays right after its item (the sort is stable).
    const rank = (p) => { const m = /^(\d)/.exec(p.pre); return m ? +m[1] : 0; };
    return out.map((p, n) => [p, n]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([p]) => p);
}

/** Every class in the week, in board order. */
export function allPapers(week, opts) {
    return ["8th", "7th", "8th-acc"].concat(Object.keys((week && week.classes) || {})).filter((k, i, a) => a.indexOf(k) === i && week.classes[k])
        .map((cid) => ({ cid, label: week.classes[cid].label || TAG[cid] || cid, papers: papersFor(week, cid, opts) }));
}
