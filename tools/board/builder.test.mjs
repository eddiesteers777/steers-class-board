// Board Builder rules: stickers, saved boards and looks. Run: node tools/board/builder.test.mjs
import assert from "node:assert/strict";
import { cleanSticker, cleanStickers, makeSticker, MAX_STICKERS } from "../../js/stickers.js";
import { cleanScene, mergeTools, defaultTools, MAX_SCENES, MAX_DAYB } from "../../js/boardTools.js";
import { saveScene, sceneActive, cleanLook, LOOK_PRESETS, LOOK_THEMES, LOOK_BGS, LOOK_PHOTOS, DAILY_PHOTOS, PHOTO_SECTIONS, dailyPhoto, bgName, presetLook } from "../../js/panels.js";
import { existsSync } from "node:fs";
import { EFFECTS } from "../../js/effects.js";
import { MARKS } from "../../js/marks.js";

let n = 0; const t = (name, fn) => { fn(); n++; };

t("pictures and symbols only from the lists", () => {
    assert.equal(cleanSticker({ t: "e", v: "<img src=x>" }), null);
    assert.equal(cleanSticker({ t: "m", v: "🍎" }), null);
    assert.equal(cleanSticker({ t: "x", v: "🍎" }), null);
    assert.ok(cleanSticker({ t: "e", v: "🍎" }));
    assert.ok(cleanSticker({ t: "m", v: "π" }));
});
t("word stickers: trimmed, 40 letters at most, never empty", () => {
    assert.equal(cleanSticker({ t: "w", v: "   " }), null);
    assert.equal(cleanSticker({ t: "w", v: "  Great job!  " }).v, "Great job!");
    assert.equal(cleanSticker({ t: "w", v: "x".repeat(80) }).v.length, 40);
});
t("position, size, turn and colour stay in range", () => {
    const s = cleanSticker({ t: "w", v: "Hi", x: -5, y: 500, s: 99, r: 900, c: 42 });
    assert.deepEqual([s.x, s.y, s.s, s.r, s.c], [0, 94, 4, 180, 4]);
    assert.equal(cleanSticker({ t: "e", v: "⭐" }).c, undefined);
});
t("a board holds at most 24 stickers", () => {
    const many = Array.from({ length: 40 }, () => ({ t: "e", v: "⭐" }));
    assert.equal(cleanStickers(many).length, MAX_STICKERS);
    assert.deepEqual(cleanStickers("nope"), []);
});
t("new stickers never land on the last one", () => {
    const list = []; for (let i = 0; i < 12; i++) list.push(makeSticker("e", "⭐", list));
    const spots = new Set(list.map((s) => s.x + "," + s.y)); assert.equal(spots.size, 12);
});
t("a saved board keeps its look and stickers", () => {
    const sc = cleanScene({ id: "u1", n: "Turkey day", screen: "today", on: { ptimer: true }, look: { theme: "harvest", bg: "leaves", mark: "anchor", fx: "turkeys", fxn: 3 }, stk: [{ t: "e", v: "🦃" }, { t: "e", v: "bad" }] });
    assert.equal(sc.look.theme, "harvest"); assert.equal(sc.look.fxn, 3); assert.equal(sc.stk.length, 1);
    const plain = cleanScene({ id: "u2", n: "Notes", on: { target: true } });
    assert.equal(plain.look, undefined); assert.equal(plain.stk, undefined);
    assert.equal(cleanScene({ n: "x", look: { theme: "<script>" } }).look.theme, undefined);
});
t("up to 12 saved boards", () => {
    const d = defaultTools(); d.scenes = Array.from({ length: 20 }, (_, i) => ({ id: "u" + i, n: "B" + i, on: {} }));
    assert.equal(mergeTools(d).scenes.length, MAX_SCENES);
});
t("saving with the same name replaces the board and keeps its id (bell timeline steps still find it)", () => {
    const S = { screen: "today", tools: defaultTools(), look: cleanLook({ theme: "ocean" }), stickers: cleanStickers([{ t: "e", v: "⭐" }]) };
    S.tools.on = { ptimer: true };
    const a = saveScene(S, "Monday", true); S.look = cleanLook({ theme: "plum" }); const b = saveScene(S, "monday", true);
    assert.equal(S.tools.scenes.length, 1); assert.equal(a.id, b.id); assert.equal(S.tools.scenes[0].look.theme, "plum");
});
t("a board counts as showing only with its look and stickers", () => {
    const S = { screen: "today", tools: defaultTools(), look: cleanLook({ theme: "ocean" }), stickers: [] }; S.tools.on = { ptimer: true };
    const sc = saveScene(S, "Ocean", true);
    assert.equal(sceneActive(S, sc), true);
    S.look = cleanLook({ theme: "plum" }); assert.equal(sceneActive(S, sc), false);
    S.look = cleanLook({ theme: "ocean" }); S.stickers = cleanStickers([{ t: "e", v: "⭐" }]); assert.equal(sceneActive(S, sc), false);
});
t("every Quick look uses colours, backgrounds, logos and effects that exist", () => {
    const has = (list, id) => list.some((x) => x[0] === id);
    LOOK_PRESETS.forEach((p) => { assert.ok(has(LOOK_THEMES, p[2]), p[1]); assert.ok(has(LOOK_BGS.concat(LOOK_PHOTOS, DAILY_PHOTOS), p[3]), p[1]); assert.ok(has(MARKS, p[4]), p[1]); assert.ok(has(EFFECTS, p[5]), p[1]);
        assert.deepEqual(cleanLook(presetLook(p)), presetLook(p)); });
});
t("photos: every one has its files, a known group and a short id; daily photos turn over each day", () => {
    const groups = new Set(PHOTO_SECTIONS.flatMap((s) => s[1].map((g) => g[0]))), ids = new Set();
    LOOK_PHOTOS.forEach(([id, name, g, who]) => {
        assert.ok(/^ph-[a-z]+-[a-z]+$/.test(id) && id.length <= 16, id); assert.ok(!ids.has(id), "twice: " + id); ids.add(id);
        assert.ok(groups.has(g), id + " group " + g); assert.ok(name && who, id);
        assert.ok(existsSync("photos/" + id.slice(3) + ".webp") && existsSync("photos/sm/" + id.slice(3) + ".webp"), "files for " + id);
        assert.equal(cleanLook({ bg: id }).bg, id);
    });
    groups.forEach((g) => assert.ok(LOOK_PHOTOS.some((x) => x[2] === g), "empty group " + g));
    DAILY_PHOTOS.forEach(([id]) => { assert.equal(cleanLook({ bg: id }).bg, id); assert.ok(id.length <= 16); });
    const day = (n) => new Date(2026, 0, 1 + n, 12);
    const seen = new Set(); for (let i = 0; i < 40; i++) { const x = dailyPhoto("pd-all", day(i)); assert.ok(ids.has(x)); seen.add(x); }
    assert.ok(seen.size >= 30, "pd-all repeats too soon");
    assert.equal(dailyPhoto("pd-win", day(3)), dailyPhoto("pd-win", day(3)));   // same all day, on every screen
    for (let i = 0; i < 10; i++) assert.equal(LOOK_PHOTOS.find((x) => x[0] === dailyPhoto("pd-mth", day(i)))[2], "mth");
    const sp = LOOK_PHOTOS.filter((x) => x[2] === "spt").length, run = new Set(); for (let i = 0; i < sp; i++) run.add(dailyPhoto("pd-spt", day(i)));
    assert.equal(run.size, sp, "a group shows every photo before repeating");
    assert.equal(bgName("pd-all"), "Photo of the day"); assert.equal(bgName("ph-ani-fox"), "Fox");
});
t("own pictures: only well-formed my- ids are kept", () => {
    assert.equal(cleanLook({ bg: "my-ab12cd34" }).bg, "my-ab12cd34");
    ["my-", "my-AB", "my-<x>", "my-12345678901234"].forEach((b) => assert.equal(cleanLook({ bg: b }).bg, "anchor", b));
});
t("effects: unique ids", () => { const ids = EFFECTS.map((e) => e[0]); assert.equal(new Set(ids).size, ids.length); });
t("cleanLook keeps the effect amount and drops anything unknown", () => {
    assert.equal(cleanLook({ fxn: 3 }).fxn, 3); assert.equal(cleanLook({ fxn: 9 }).fxn, 2); assert.equal(cleanLook({ bg: "nope" }).bg, "anchor");
});
t("day boards: only real lessons and boards that still exist", () => {
    const d = defaultTools(); d.scenes = [{ id: "u1", n: "Mon notes", on: {} }, { id: "u2", n: "Quiz", on: {} }];
    d.dayb = { "q2w5|7th|0": "u1", "ql-2026-11-23|8th-acc|4": "u2", "q2w5|7th|1": "gone", "q2w5|7th|7": "u1", "bad key|7th|0": "u1", "q2w5|8th|2": 5 };
    assert.deepEqual(mergeTools(d).dayb, { "q2w5|7th|0": "u1", "ql-2026-11-23|8th-acc|4": "u2" });
    assert.deepEqual(mergeTools({}).dayb, {}); assert.deepEqual(mergeTools({ dayb: "nope" }).dayb, {});
    const big = defaultTools(); big.scenes = [{ id: "u1", n: "A", on: {} }]; big.dayb = {};
    for (let i = 0; i < 100; i++) big.dayb["w" + i + "|7th|0"] = "u1";
    assert.equal(Object.keys(mergeTools(big).dayb).length, MAX_DAYB);
});
console.log("Board Builder: " + n + " checks passed");
