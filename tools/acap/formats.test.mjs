// ACAP formats and the Vault Raid spiral: node tools/acap/formats.test.mjs (no browser, no network).
import * as F from "../../js/acapFormats.js";
import { sameAnswer } from "../../js/vaultCore.js";
import assert from "node:assert/strict";
const load = async (f, cls) => (await import("../../data/stdbank/" + f + ".js")).default.items.map((x) => Object.assign({}, x, { cls }));
const banks = { "7th": await load("g7", "7th"), "8th": await load("g8", "8th") };

// The game's answer checker reads letters the way the new answer boxes write them.
assert.ok(sameAnswer("A, C", "A, C")); assert.ok(sameAnswer("A,C", "A, C")); assert.ok(sameAnswer("ac", "A, C", ["AC"]));
assert.ok(!sameAnswer("C, A, B", "A, C, B")); assert.ok(!sameAnswer("A", "A, C")); assert.ok(!sameAnswer("A, B, C", "A, C"));
assert.ok(F.lettersOk("B, D, A, C", 4, "ord")); assert.ok(!F.lettersOk("B, D, A", 4, "ord")); assert.ok(F.lettersOk("A, C", 4, "ms")); assert.ok(!F.lettersOk("A, E", 4, "ms")); assert.ok(!F.lettersOk("A, A", 4, "ms"));
// Old sets are untouched: no fm, same answer shape as before.
assert.deepEqual(F.fmOf({ q: "2+2", a: "4" }), {}); assert.equal(F.formOf({ q: "2+2", a: "4" }), "");
assert.equal(F.formOf({ q: "x", a: "B", ch: ["1", "2"] }), "mc");
assert.equal(F.formOf({ q: "x", a: "A, B", ch: ["1", "2", "3"], fm: "ms" }), "ms");
assert.deepEqual(F.fmOf({ a: "Q", ch: ["1", "2"], fm: "ms" }), {}, "a select-all whose answer is no longer letters is plain multiple choice");

// Wrong answers are never the right answer, on every problem in the bank.
let wrongs = 0;
for (const items of Object.values(banks)) for (const x of items.map(F.itemOf)) for (const salt of [0, 1, 2]) {
    const w = F.wrongOf(x, salt); if (w == null) continue; wrongs++;
    assert.ok(!sameAnswer(w, x.a, x.al), x.id + ": " + w + " vs " + x.a);
}
assert.ok(wrongs > 300, "wrong answers made: " + wrongs);

// Every format question on every standard is consistent.
const seen = { not: 0, ms: 0, ord: 0, sw: 0 };
for (const [cls, items] of Object.entries(banks)) {
    for (const code of [...new Set(items.map((x) => x.std))]) {
        const r = F.spiralSet({ cls, now: [code], earlier: [], bank: items, n: 14, seed: "t" });
        const qs = r.doc.cats.flatMap((c) => c.clues);
        assert.equal(qs.length, r.counts.now);
        assert.equal(new Set(qs.map((q) => q.q + "|" + (q.ch || []).join())).size, qs.length, code + ": no question twice");
        for (const q of qs) {
            assert.ok(q.q.length <= 400 && q.a);
            if (!q.fm) continue; seen[q.fm]++;
            if (q.ch) q.ch.forEach((c) => assert.ok(c.length <= 80, c));
            if (q.fm === "not") { assert.equal(F.formOf(q), "mc"); assert.equal(q.ch.length, 4); assert.ok(q.ch.includes(q.a)); }
            if (q.fm === "ms") { assert.ok(F.lettersOk(q.a, q.ch.length, "ms")); assert.equal(q.a.split(", ").length, 2); assert.equal(F.formOf(q), "ms"); }
            if (q.fm === "ord") { assert.ok(F.lettersOk(q.a, q.ch.length, "ord")); assert.notEqual(q.a, "ABCD".slice(0, q.ch.length).split("").join(", "), "never already in order"); }
            if (q.fm === "sw") assert.match(q.q, /^Show your work/);
            assert.deepEqual(F.fmOf(q), q.fm === "ms" || q.fm === "ord" || q.fm === "not" || q.fm === "sw" ? { fm: q.fm } : {});
        }
    }
}
console.log("formats made over every standard:", seen);
Object.values(seen).forEach((n) => assert.ok(n > 0));

// A NOT-true question: the true statements show the bank's own answers; the false one does not.
const g8 = banks["8th"].map(F.itemOf);
const nt = F.notTrue(g8.filter((x) => x.std === "8.11" && !x.ch), "s") || F.notTrue(g8.filter((x) => x.std === "8.3" && !x.ch), "s");
assert.ok(nt);
nt.ch.forEach((c) => { const isA = c === nt.a; const ans = c.split(" → ").pop(); const src = g8.find((x) => c.startsWith(x.q.replace(/\s+/g, " ").trim() + " → ")); assert.ok(src); assert.equal(sameAnswer(ans, src.a, src.al), !isA, c); });

// The spiral is 70/30, review on the weakest earlier standards, each standard its own category named with its code.
const sp = F.spiralSet({ cls: "8th", now: ["8.11"], earlier: ["8.2", "8.4", "8.3"], bank: banks["8th"], n: 20, seed: "x", title: "T", per: ["2nd"] });
const tot = sp.counts.now + sp.counts.old; assert.ok(sp.counts.old / tot >= 0.2 && sp.counts.old / tot <= 0.4, JSON.stringify(sp.counts));
assert.deepEqual(sp.doc.cats.map((c) => c.n.split(" ")[0]).slice(0, 1), ["8.11"]);
assert.ok(sp.doc.cats.slice(1).every((c) => / review$/.test(c.n)));
assert.ok(Object.values(sp.counts.fmt).reduce((a, b) => a + b, 0) >= 2, "ACAP formats mixed in");
// Saved sets carry what Vault Raid reads: q, a, p, and only fields that have something in them.
sp.doc.cats.forEach((c) => c.clues.forEach((q) => { assert.ok(q.q && q.a && q.p); if ("ch" in q) assert.ok(q.ch.length >= 2); if ("al" in q) assert.ok(q.al.length); }));
// Nothing earlier: all on this week.
const only = F.spiralSet({ cls: "8th", now: ["8.11"], earlier: [], bank: banks["8th"], n: 10, seed: "x" }); assert.equal(only.counts.old, 0);
// Which standards: the marked Teaching one, then the weakest earlier ones.
const order = ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6"];
const pick = F.spiralCodes({ order, marks: { "8.1": "taught", "8.2": "taught", "8.3": "taught", "8.5": "teaching" }, need: new Map([["8.3", 2], ["8.1", 1]]) });
assert.deepEqual(pick.now, ["8.5"]); assert.deepEqual(pick.earlier, ["8.3", "8.1", "8.2"]);
console.log("formats tests: passed");

// Bellringers for the week: 2 new + 2 review each school day, picks kept, nothing twice, days off skipped.
{
    const days = [{ school: true }, { school: true, bell: [{ id: "8.11-01", std: "8.11" }] }, { school: false }, { school: true }, { school: true }];
    const add = F.bellWeek({ cls: "8th", bank: banks["8th"], now: ["8.11"], review: ["8.4", "8.2"], days });
    assert.deepEqual(add.map((d) => d.length), [4, 3, 0, 4, 4]);
    assert.deepEqual(add[0].map((x) => x.std), ["8.11", "8.11", "8.4", "8.2"]);
    assert.equal(add[1].filter((x) => x.std === "8.11").length, 1, "a picked 8.11 counts toward the 2 new");
    const ids = add.flat().map((x) => x.id).concat(["8.11-01"]); assert.equal(new Set(ids).size, ids.length);
    const none = F.bellWeek({ cls: "8th", bank: banks["8th"], now: ["8.11"], review: [], days: [{ school: true }] });
    assert.deepEqual(none[0].map((x) => x.std), ["8.11", "8.11", "8.11", "8.11"], "no review standards: all on this week");
}
console.log("bellringer tests: passed");
