// Every week the board knows about, oldest first. The newest week whose Monday
// has arrived opens by default.
import q1w0 from "./q1w0.js?v=57";
import q1w1 from "./q1w1.js?v=57";
import q1w2 from "./q1w2.js?v=57";
import q1w3 from "./q1w3.js?v=57";
import q1w4 from "./q1w4.js?v=57";
import q1w5 from "./q1w5.js?v=57";
import q1w6 from "./q1w6.js?v=57";
import q1w7 from "./q1w7.js?v=57";
import q1w8 from "./q1w8.js?v=57";
import week0 from "./week0.js?v=57";
import week1 from "./week1.js?v=58";
import week2 from "./week2.js?v=58";
import week3 from "./week3.js?v=58";
import week4 from "./week4.js?v=58";
import week5 from "./week5.js?v=58";
import demoWeek from "./demo-week.js?v=1";
import { myPack, mySetup } from "../js/contentPack.js?v=2";

// Mr. Steers' Calera weeks. Only his account (and the guest sub page) sees them; see js/contentPack.js.
export const CALERA_WEEKS = [q1w0, q1w1, q1w2, q1w3, q1w4, q1w5, q1w6, q1w7, q1w8, week0, week1, week2, week3, week4, week5];
// Calera periods: [period, class]. A new teacher gets one sample class instead.
export const CALERA_PERIODS = [["1st", "8th"], ["2nd", "8th"], ["4th", "8th"], ["5th", "7th"], ["6th", "8th-acc"]];
export const STARTER_PERIODS = [["1st", "demo"]];

export const PACK = await myPack();
// A new teacher's own classes and periods from setup.html (null for the Calera pack or before setup).
export const SETUP = PACK === "calera" ? null : await mySetup();

/** The sample week, copied once for each of the teacher's classes, so the board shows their own class names. */
function starterFrom(setup) {
    const rows = (setup && setup.classes) || [];
    if (!rows.length) return { weeks: [demoWeek], periods: STARTER_PERIODS };
    const sample = demoWeek.classes.demo, ids = new Map(), classes = {};
    const periods = rows.map((r) => {
        if (!ids.has(r.label)) {
            const id = "c" + (ids.size + 1); ids.set(r.label, id);
            classes[id] = Object.assign(structuredClone(sample), { label: r.label, cls: setup.name ? setup.name + " · " + r.label : r.label });
        }
        return [r.p, ids.get(r.label)];
    });
    return { weeks: [Object.assign({}, demoWeek, { classes })], periods };
}
const STARTER = PACK === "calera" ? null : starterFrom(SETUP);
export const WEEKS = PACK === "calera" ? CALERA_WEEKS : STARTER.weeks;
export const PERIODS = PACK === "calera" ? CALERA_PERIODS : STARTER.periods;
// The ?v= number must go up every time a week file changes, here and in the
// pages that import this file, so browsers never mix old and new files.
