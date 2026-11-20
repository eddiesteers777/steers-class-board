// node test/tools.test.mjs : the connector's tools against a made-up teacher store (no network, no real names)
import assert from "node:assert/strict";
import * as T from "../src/tools.js";
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
console.log("\n" + ok + " checks passed");
