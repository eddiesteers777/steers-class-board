// The Find panel's search (js/findCore.js): standard codes, topic words, courses, and the saved state of up to four
// Find panels. Run: node tools/board/find.test.mjs
import assert from "node:assert/strict";
import { buildIndex, search, browse, another, parseCode, topicOf, courseFor, cleanFind, cleanFinds, isFind, FIND_KEYS, TOPICS } from "../../js/findCore.js";
import { loadStdBank } from "../../js/stdBank.js";
import { STANDARDS } from "../../data/standards.js";

let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FAIL", name); throw e; } };
const items = await loadStdBank();
let t0 = performance.now(); const ix = buildIndex(items, STANDARDS); const built = performance.now() - t0;

t("the index holds the whole bank", () => assert.equal(ix.rows.length, items.length));
t("the index builds fast", () => assert.ok(built < 400, "built in " + built.toFixed(0) + " ms"));
t("every standard in the bank has a topic", () => { const miss = [...new Set(items.map((x) => x.std))].filter((s) => !TOPICS[s]); assert.deepEqual(miss, []); });

t("codes", () => {
    assert.deepEqual(parseCode("7.9"), parseCode(" 7.9 "));
    assert.ok(parseCode("8.25a")); assert.ok(parseCode("alg 1.10")); assert.ok(parseCode("a1 3"));
    assert.equal(parseCode("slope"), null);
});
t("a code finds only that standard", () => { const r = search(ix, "7.9"); assert.equal(r.std.code, "7.9"); assert.ok(r.rows.length > 0); assert.ok(r.rows.every((x) => x.item.std === "7.9")); });
t("a code with a part finds that part", () => { const r = search(ix, "8.25a"); assert.ok(r.rows.length > 0); assert.ok(r.rows.every((x) => x.item.std === "8.25" && (!x.item.part || x.item.part === "a"))); });
t("8.2 offers 8.20 to 8.29 as well", () => { const r = search(ix, "8.2"); assert.equal(r.std.code, "8.2"); assert.ok(r.topics.some((s) => s.code === "8.25")); });
t("Algebra I codes", () => { const r = search(ix, "alg 1.10"); assert.ok(r.std && /^A/i.test(r.std.code) || r.rows.length); });
t("topic words", () => {
    ["two-step equations", "slope", "pythagorean", "percent", "angles", "y = mx + b"].forEach((q) => assert.ok(search(ix, q).rows.length > 0, q));
    assert.ok(search(ix, "slope").rows.slice(0, 5).every((x) => /slope|rate of change/i.test(topicOf(x.item.std) + " " + x.item.q)), "slope ranks slope problems first");
});
t("the course filter keeps to that course", () => {
    const r = search(ix, "equations", { course: "8th", limit: 200 });
    assert.ok(r.rows.length > 0); assert.ok(r.rows.every((x) => x.item.cls === "8th" || (x.item.for || []).includes("8th")));
});
t("nonsense finds nothing, quietly", () => { const r = search(ix, "zzqqxx"); assert.equal(r.rows.length, 0); assert.equal(r.total, 0); });
t("each keystroke is quick", () => {
    const qs = ["7", "7.", "7.9", "s", "sl", "slo", "slop", "slope", "two", "two-step", "two-step eq", "pyth", "percent of", "volume of a cylinder"];
    const t1 = performance.now(); qs.forEach((q) => search(ix, q, { limit: 30 })); const per = (performance.now() - t1) / qs.length;
    assert.ok(per < 25, per.toFixed(1) + " ms a search");
});
t("browse lists each course's standards", () => { const b = browse(ix, "7th"); assert.ok(b.length > 10); assert.ok(b.every((s) => s.n > 0 && s.topic)); });
t("another stays in the standard and moves on", () => { const a = ix.rows.find((x) => x.std === "7.9"); const b = another(ix, a.id); assert.equal(b.item.std, "7.9"); assert.notEqual(b.id, a.id); });
t("course from the class", () => { assert.equal(courseFor("7th"), "7th"); assert.equal(courseFor("8th"), "8th"); assert.equal(courseFor("x"), ""); });

t("hints cover every problem's steps (saved hints stop at 4)", () => { const most = Math.max(...items.map((x) => (Array.isArray(x.steps) ? x.steps.length : 0))); assert.ok(most <= 4, "a problem has " + most + " steps"); assert.equal(cleanFind({ id: "a", hint: 99 }).hint, 4); });
t("saved state keeps the shape", () => assert.deepEqual(cleanFind({ id: "g7-9-3", ans: 1, hint: 2, at: 5, x: 1 }), { id: "g7-9-3", ans: true, hint: 2, at: 5 }));
t("saved state drops junk", () => { assert.equal(cleanFind({ id: "<script>" }).id, ""); assert.equal(cleanFind({ ans: true }).ans, false); assert.deepEqual(cleanFind(null), { id: "", ans: false, hint: 0, at: 0 }); });
t("four Find panels, no more", () => {
    assert.deepEqual(FIND_KEYS, ["find", "find2", "find3", "find4"]); assert.ok(isFind("find3")); assert.ok(!isFind("find5"));
    const c = cleanFinds({ find: { id: "a" }, find2: { id: "b", ans: true }, find5: { id: "c" }, find3: { id: "" } });
    assert.deepEqual(Object.keys(c), ["find", "find2"]); assert.equal(c.find2.ans, true);
});
t("an old single-panel save is ignored safely", () => assert.deepEqual(cleanFinds({ id: "g7-9-3", ans: true }), {}));

console.log("find: " + n + " checks passed (index " + built.toFixed(0) + " ms, " + items.length + " problems)");
