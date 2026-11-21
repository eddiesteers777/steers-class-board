// node test/tools.test.mjs : the connector's tools against a made-up teacher store (no network, no real names)
import assert from "node:assert/strict";
import * as T from "../src/tools.js";
import * as S from "../src/siteTools.js";
import { enc, dec } from "../src/firestore.js";

let ok = 0; const t = async (name, fn) => { await fn(); ok++; console.log("ok -", name); };

function fakeStore(docs) {
    let clock = 1; const meta = {};
    for (const k of Object.keys(docs)) meta[k] = String(clock++);
    return {
        docs, writes: 0, interfere: null,
        async get(path) { return docs[path] ? { data: structuredClone(docs[path]), updateTime: meta[path] } : null; },
        async put(path, data, updateTime) {
            if (this.interfere) { const f = this.interfere; this.interfere = null; f(); }
            if (updateTime && meta[path] !== updateTime) { const e = new Error("changed"); e.changed = true; throw e; }
            docs[path] = structuredClone(data); meta[path] = String(clock++); this.writes++; return { updateTime: meta[path] };
        },
        touch(path) { meta[path] = String(clock++); },
        async list(c) { return Object.keys(docs).filter((k) => k.startsWith(c + "/") && !k.slice(c.length + 1).includes("/")).map((k) => k.slice(c.length + 1)); },
    };
}
const img = "data:image/jpeg;base64,/9j/AAAA";
function world() {
    return fakeStore({
        "rosters/all": { periods: { "1st": ["Ava M.", "Ben C.", "Chloe D.", "Ben T."], "2nd": [] } },
        "work/index": { sets: [
            { id: "s1", title: "Quiz 4.2", period: "1st", date: "2026-11-18", pages: 6, students: 0, unsorted: 6 },
            { id: "s2", title: "Warm-up", period: "2nd", date: "2026-11-19", pages: 1, students: 1, unsorted: 0 },
        ], at: 1 },
        "work/s_s1": { id: "s1", title: "Quiz 4.2", period: "1st", date: "2026-11-18", per: 2, pages: [
            { p: "a", s: "", b: 100 }, { p: "b", s: "", b: 100 }, { p: "c", s: "", b: 100 },
            { p: "d", s: "Chloe D.", b: 100 }, { p: "x", s: "", b: 0, gone: 1 }, { p: "e", s: "", b: 100 }, { p: "f", s: "", b: 100 },
        ] },
        "work/p_a": { img, strip: "data:image/jpeg;base64,STRIP", set: "s1" }, "work/p_b": { img, set: "s1" }, "work/p_c": { img, set: "s1" },
        "work/p_d": { img, set: "s1" }, "work/p_e": { removed: true }, "work/p_f": { img, set: "s1" },
    });
}

await t("Firestore values round-trip", () => {
    const v = { a: 1, b: 1.5, c: "x", d: [1, "y", { e: null }], f: true, g: [], h: {} };
    assert.deepEqual(dec(enc(v)), v);
    assert.deepEqual(enc(7), { integerValue: "7" });
});
await t("periods", () => {
    assert.equal(T.periodOf("3rd period"), "3rd"); assert.equal(T.periodOf("1"), "1st"); assert.equal(T.periodOf("second"), "2nd"); assert.equal(T.periodOf("6th"), "6th");
});
await t("list_stacks shows ids, weeks and unsorted counts", async () => {
    const s = world(), out = await T.listStacks(s, {});
    assert.match(out, /2 stacks/); assert.match(out, /stack_id s2[^\n]*\n- stack_id s1/);   // newest first
    assert.match(out, /2nd nine weeks, Week 5 \(Nov 16-20\)/); assert.match(out, /0 of 4 students named · 6 pages not sorted/);
    assert.match(await T.listStacks(s, { unsorted_only: true }), /1 stack:\n- stack_id s1/);
    assert.match(await T.listStacks(s, { period: "4" }), /No stacks for 4th period/);
});
await t("get_roster", async () => {
    const s = world();
    assert.match(await T.getRoster(s, { period: "1st period" }), /1st period roster \(4\):\n- Ava M\./);
    assert.match(await T.getRoster(s, { period: "2nd" }), /No roster saved/);
});
await t("look_at_pages: unsorted name strips by default, whole page when asked", async () => {
    const s = world(), out = await T.lookAtPages(s, { stack_id: "s1" });
    assert.match(out[0].text, /6 pages in the stack\. Pages per student: 2\. Showing the name area .* pages 1, 2, 3, 5, 6\./);
    assert.equal(out[1].text, "Page 1 (now: not sorted):"); assert.deepEqual(out[2], { type: "image", data: "STRIP", mimeType: "image/jpeg" });
    assert.match(out[3].text, /Page 2 .*whole page \(no name strip saved\)/);
    assert.ok(out.some((c) => c.text === "Page 5 (now: not sorted): picture cleared or missing."));
    const whole = await T.lookAtPages(s, { stack_id: "s1", pages: [1, 4, 99], view: "page" });
    assert.match(whole[0].text, /whole pages for pages 1, 4\./); assert.equal(whole[2].data, "/9j/AAAA"); assert.match(whole[3].text, /now: Chloe D\./);
    await assert.rejects(() => T.lookAtPages(s, { stack_id: "nope" }), /No stack with id nope/);
});
await t("assign_names: roster matching, same, key, teacher picks kept, index updated", async () => {
    const s = world();
    const out = await T.assignNames(s, { stack_id: "s1", names: [
        { page: 1, name: "Ava" }, { page: 2, name: "same" }, { page: 3, name: "Ben" }, { page: 4, name: "Ava M." }, { page: 5, name: "key" }, { page: 6, name: "Zed Q." }, { page: 9, name: "Ava M." },
    ] });
    const set = s.docs["work/s_s1"], live = set.pages.filter((p) => !p.gone);
    assert.deepEqual(live.map((p) => p.s), ["Ava M.", "Ava M.", "", "Chloe D.", "Answer key", ""]);
    assert.equal(live[0].by, "claude"); assert.equal(live[3].by, undefined);
    assert.match(out, /Saved names for 3 pages/);
    assert.match(out, /No roster match, left unsorted: page 3 \(“Ben”\), page 6 \(“Zed Q\.”\)/);   // two Bens: not a guess
    assert.match(out, /Not changed, the teacher already named: page 4 \(Chloe D\.\)/);
    assert.match(out, /page 9 is not in this stack \(it has 6\)/);
    assert.match(out, /2 pages still not sorted/); assert.match(out, /No paper yet from: Ben C\., Ben T\./);
    const m = s.docs["work/index"].sets.find((x) => x.id === "s1");
    assert.equal(m.unsorted, 2); assert.equal(m.students, 2); assert.equal(m.pages, 6);
    assert.equal(s.docs["work/index"].sets.length, 2);
});
await t("assign_names: overwrite and un-sorting Claude's own pick", async () => {
    const s = world();
    await T.assignNames(s, { stack_id: "s1", names: [{ page: 4, name: "Ben C." }], overwrite: true });
    assert.equal(s.docs["work/s_s1"].pages[3].s, "Ben C.");
    await T.assignNames(s, { stack_id: "s1", names: [{ page: 4, name: "?" }] });
    assert.equal(s.docs["work/s_s1"].pages[3].s, ""); assert.equal(s.docs["work/s_s1"].pages[3].by, undefined);
});
await t("assign_names: a site save in between is not overwritten", async () => {
    const s = world();
    s.interfere = () => { s.docs["work/s_s1"].pages[0].s = "Ben T."; s.touch("work/s_s1"); };   // the teacher names page 1 while Claude saves
    const out = await T.assignNames(s, { stack_id: "s1", names: [{ page: 1, name: "Ava M." }, { page: 2, name: "Ava M." }] });
    assert.equal(s.docs["work/s_s1"].pages[0].s, "Ben T."); assert.equal(s.docs["work/s_s1"].pages[1].s, "Ava M.");
    assert.match(out, /teacher already named: page 1 \(Ben T\.\)/);
});

/* ---------- the rest of the site (siteTools.js) ---------- */
const day5 = (n) => ({ agenda: ["x"], target: "t" + n });
const goodWeek = (id) => ({ id, label: "Week 6", dates: "Nov 30-Dec 4", monday: "2026-11-30", classes: { "8th": { days: [1, 2, 3, 4, 5].map(day5) } }, checked: { n: 12, at: 1 } });
function site() {
    const s = world();
    Object.assign(s.docs, {
        "plans/week6": { id: "week6", n: 6, nineWeeks: 2, monday: "2026-11-30", label: "Week 6", dates: "Nov 30-Dec 4", status: "sent", classes: { "8th": { topic: "Slope" } }, brief: { prompt: "Build Week 6", rules: "r" } },
        "plans/week7": { id: "week7", monday: "2026-12-07", label: "Week 7", status: "draft", classes: {} },
        "weekfiles/index": { weeks: [{ id: "week5", approved: true }] },
        "weekfiles/week5": { json: JSON.stringify(goodWeek("week5")), at: 5 },
        "gb/setup": { cats: [{ id: "hw", name: "Homework", w: 0 }, { id: "qt", name: "Quizzes & Tests", w: 0 }], scale: [["A", 90], ["B", 80], ["C", 70], ["D", 60], ["F", 0]], missing: "zero" },
        "gb/items": { list: [
            { id: "g1", title: "Quiz 4.2", date: "2026-11-18", cat: "qt", pts: 10, periods: ["1st"], src: { k: "hand" } },
            { id: "g2", title: "DeltaMath 4.4", date: "2026-11-12", cat: "hw", pts: 10, periods: ["1st"], src: { k: "data", ids: { "1st": "d1" } } },
            { id: "g3", title: "Old quiz", date: "2026-09-01", cat: "qt", pts: 10, periods: ["1st"], src: { k: "hand" } },
        ] },
        "gb/s_g1": { sc: { "1st|Ava M.": { p: 9 }, "1st|Ben C.": { p: null, x: "m" }, "1st|Chloe D.": { p: 7 } } },
        "gb/s_g3": { sc: { "1st|Ava M.": { p: 2 } } },
        "data/index": { imports: [{ id: "d1", title: "DeltaMath 4.4", date: "2026-11-12", source: "DeltaMath", period: "1st", n: 2, items: 2 }, { id: "d2", title: "Magma 5", date: "2026-11-13", source: "Magma Math", period: "2nd", n: 0, items: 1 }] },
        "data/i_d1": { id: "d1", title: "DeltaMath 4.4", date: "2026-11-12", source: "DeltaMath", period: "1st", items: ["Q1", "Q2"], rows: [{ s: "Ava M.", v: [1, 1] }, { s: "Chloe D.", v: [1, 0] }] },
    });
    return s;
}
await t("list_site_data and read_site_data: read only, pictures left out, paths checked", async () => {
    const s = site();
    assert.match(await S.listSiteData(s, {}), /- plans: week plans/);
    assert.match(await S.listSiteData(s, { collection: "plans" }), /2 documents in plans .*\nweek6, week7/);
    assert.match(await S.readSiteData(s, { path: "work/p_a" }), /"img": "data:image\/jpeg;base64,\/9j\/AAAA"/);   // short, kept
    s.docs["work/p_a"].img = "data:image/jpeg;base64," + "A".repeat(4000);
    assert.match(await S.readSiteData(s, { path: "teacher/xyz/work/p_a" }), /\[picture, 3 KB, not shown\]/);
    assert.match(await S.readSiteData(s, { path: "weekfiles/week5" }), /"label": "Week 6"/);   // the week's JSON, unpacked
    assert.match(await S.readSiteData(s, { path: "gb/nothing" }), /Nothing saved at gb\/nothing/);
    for (const bad of ["plans", "../x/y", "a/b/c"]) await assert.rejects(() => S.readSiteData(s, { path: bad }), /path must be/);
});
await t("read_week_plan: by id or by any date in the week, with what is saved", async () => {
    const s = site();
    const a = await S.readWeekPlan(s, { week: "week6" });
    assert.match(a, /Week 6 \(Nov 30-Dec 4\), 2nd nine weeks\. Week id: week6\. Plan status: sent\./); assert.match(a, /Build the week from "brief"/); assert.match(a, /No week file saved for week6/);
    assert.match(await S.readWeekPlan(s, { week: "2026-12-03" }), /Week id: week6/);
    assert.match(await S.readWeekPlan(s, { week: "week7" }), /has not pressed Send to Claude/);
    await assert.rejects(() => S.readWeekPlan(s, { week: "week9" }), /Saved week plans: week6, week7/);
    await assert.rejects(() => S.readWeekPlan(s, { week: "2027-01-05" }), /No week plan saved for the week of Jan 4/);
});
await t("save_week_file: checks the shape, keeps a backup, won't replace an approved week by accident", async () => {
    const s = site();
    const out = await S.saveWeekFile(s, { week_id: "week6", week: JSON.stringify(goodWeek("week6")) });
    assert.match(out, /Saved Week 6 \(Nov 30-Dec 4\) with 1 class\./); assert.match(out, /review\.html\?week=week6/);
    assert.equal(JSON.parse(s.docs["weekfiles/week6"].json).id, "week6"); assert.equal(s.docs["weekfiles/week6"].prev, undefined);
    const again = await S.saveWeekFile(s, { week_id: "week6", week: { ...goodWeek("week6"), checked: undefined } });
    assert.match(again, /kept as a backup/); assert.match(again, /no "checked" stamp/); assert.ok(s.docs["weekfiles/week6"].prev);
    await assert.rejects(() => S.saveWeekFile(s, { week_id: "week6", week: goodWeek("week7") }), /must match/);
    await assert.rejects(() => S.saveWeekFile(s, { week_id: "week6", week: { id: "week6", classes: { "8th": { days: [1, 2] } } } }), /exactly 5/);
    await assert.rejects(() => S.saveWeekFile(s, { week_id: "week6", week: "{nope" }), /not valid JSON/);
    const before = s.docs["weekfiles/week5"].json;
    await assert.rejects(() => S.saveWeekFile(s, { week_id: "week5", week: goodWeek("week5") }), /already approved/);
    assert.equal(s.docs["weekfiles/week5"].json, before);
    assert.match(await S.saveWeekFile(s, { week_id: "week5", week: goodWeek("week5"), replace_approved: true }), /board shows the new file now/);
});
await t("class data: list and one set", async () => {
    const s = site();
    assert.match(await S.listClassData(s, {}), /2 Class Data sets:\n- data_id d2 [^\n]*\n- data_id d1 · 1st period · Nov 12 · “DeltaMath 4\.4” · DeltaMath/);
    assert.match(await S.listClassData(s, { period: "3" }), /No Class Data for 3rd period/);
    const one = await S.getClassData(s, { data_id: "d1" });
    assert.match(one, /2 students\. Class average 75%/); assert.match(one, /Items \(class average\): Q1 100%, Q2 50%/); assert.match(one, /- Chloe D\.: 50% \(100%, 0%\)/);
    await assert.rejects(() => S.getClassData(s, { data_id: "zz" }), /No Class Data set with id zz/);
});
await t("get_grades: the Gradebook's own math, by period and nine weeks, and one student", async () => {
    const s = site();
    const out = await S.getGrades(s, { period: "1st period", nine_weeks: 2 });
    assert.match(out, /1st period, 2nd nine weeks\. 2 grade items\. Total points/);
    assert.match(out, /- Ava M\.: 95% A/);            // 9/10 + 10/10
    assert.match(out, /- Ben C\.: 0% F · 1 missing/);  // missing counts as 0
    assert.match(out, /- Chloe D\.: 60% D/);           // 7/10 + 5/10
    assert.match(out, /- Ben T\.: no grade yet/);
    assert.match(out, /Quiz 4\.2” \(Quizzes & Tests, 10 pts\): average 80%, 2 scored, 1 missing, 1 not entered/);
    assert.match(await S.getGrades(s, { period: "1st", nine_weeks: 1 }), /1 grade items[\s\S]*Ava M\.: 20% F/);
    const one = await S.getGrades(s, { period: "1st", nine_weeks: 2, student: "Chloe" });
    assert.match(one, /Chloe D\.: 60% D\./); assert.match(one, /By category: Homework 50%, Quizzes & Tests 70%\./); assert.match(one, /“Quiz 4\.2” \(Quizzes & Tests, 10 pts\): 70% \(7\/10\)/);
    await assert.rejects(() => S.getGrades(s, { period: "1st", student: "Ben" }), /No one on the 1st period roster matches/);
    assert.match(await S.getGrades(s, { period: "2nd" }), /No roster saved/);
});
console.log("\n" + ok + " checks passed");
