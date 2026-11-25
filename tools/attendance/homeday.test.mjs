// Which day Home's Today card is about (js/homeDay.js): node tools/attendance/homeday.test.mjs
import assert from "node:assert/strict";
import { homeDay, isWeekday, longDay, span } from "../../js/homeDay.js";
import { isSchoolDay, eventsOn } from "../../js/schoolCal.js";
const offOn = (d) => { const e = eventsOn(d).find((x) => x.kind === "off" || x.kind === "work"); return e ? { text: e.text, start: e.start, end: e.end } : null; };
const wk = (id, monday) => ({ id, monday, classes: {} });
const weeks = [wk("week4", "2026-11-09"), wk("week5", "2026-11-16")];
const cal = (today, list = weeks) => homeDay({ today, weeks: list, inSchool: isSchoolDay, offOn, byCalendar: true });

// Eddie's bug: Monday of Thanksgiving Break showed "Monday, November 16".
let r = cal("2026-11-23");
assert.equal(r.school, false); assert.equal(r.off.text, "Thanksgiving Break"); assert.equal(span(r.off.start, r.off.end), "Nov 23 to 27");
assert.equal(r.planDay, "2026-11-30"); assert.equal(r.planned, false); assert.equal(longDay(r.planDay), "Monday, November 30");
// Once the week of Nov 30 is approved, the break shows that Monday's plan.
r = cal("2026-11-25", weeks.concat(wk("week6", "2026-11-30")));
assert.equal(r.week.id, "week6"); assert.equal(r.di, 0); assert.equal(r.planned, true);
// A school day: today, in its own week.
r = cal("2026-11-18"); assert.equal(r.school, true); assert.equal(r.week.id, "week5"); assert.equal(r.di, 2); assert.equal(r.off, null);
// Saturday: next Monday, and next week isn't built yet.
r = cal("2026-11-14"); assert.equal(r.school, false); assert.equal(r.off, null); assert.equal(r.planDay, "2026-11-16"); assert.equal(r.week.id, "week5"); assert.equal(r.planned, true);
r = cal("2026-11-21"); assert.equal(r.planDay, "2026-11-30"); assert.equal(r.planned, false);
// A new teacher (no school calendar): weekdays count, the sample week (no Monday) always shows.
const demo = [{ id: "demo", monday: "", classes: {} }];
r = homeDay({ today: "2026-11-23", weeks: demo, inSchool: isWeekday }); assert.equal(r.school, true); assert.equal(r.week.id, "demo"); assert.equal(r.di, 0); assert.equal(r.planned, true);
r = homeDay({ today: "2026-11-28", weeks: demo, inSchool: isWeekday }); assert.equal(r.planDay, "2026-11-30"); assert.equal(r.di, 0); assert.equal(r.planned, true);
assert.equal(span("2026-12-21", "2027-01-01"), "Dec 21 to Jan 1"); assert.equal(span("2026-11-11", "2026-11-11"), "Nov 11");
console.log("homeDay: all checks passed");
