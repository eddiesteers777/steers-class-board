// YouTube music links and saved shape (js/ytMusic.js). Run: node tools/board/ytmusic.test.mjs
import assert from "node:assert/strict";
import { parseYt, cleanYt, cleanRecent } from "../../js/ytMusic.js";

const ID = "dQw4w9WgXcQ", LIST = "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG";
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FAIL", name); throw e; } };

t("bare id", () => assert.deepEqual(parseYt(ID), { id: ID, list: "" }));
t("watch link", () => assert.deepEqual(parseYt("https://www.youtube.com/watch?v=" + ID + "&t=42s"), { id: ID, list: "" }));
t("no https", () => assert.deepEqual(parseYt("youtube.com/watch?v=" + ID), { id: ID, list: "" }));
t("short link", () => assert.deepEqual(parseYt("https://youtu.be/" + ID + "?si=abc"), { id: ID, list: "" }));
t("phone link", () => assert.deepEqual(parseYt("https://m.youtube.com/watch?v=" + ID), { id: ID, list: "" }));
t("music link", () => assert.deepEqual(parseYt("https://music.youtube.com/watch?v=" + ID), { id: ID, list: "" }));
t("embed", () => assert.deepEqual(parseYt("https://www.youtube-nocookie.com/embed/" + ID), { id: ID, list: "" }));
t("shorts", () => assert.deepEqual(parseYt("https://www.youtube.com/shorts/" + ID), { id: ID, list: "" }));
t("live", () => assert.deepEqual(parseYt("https://www.youtube.com/live/" + ID + "?feature=share"), { id: ID, list: "" }));
t("video in a playlist", () => assert.deepEqual(parseYt("https://www.youtube.com/watch?v=" + ID + "&list=" + LIST + "&index=3"), { id: ID, list: LIST }));
t("playlist", () => assert.deepEqual(parseYt("https://www.youtube.com/playlist?list=" + LIST), { id: "", list: LIST }));
t("search words are not a link", () => { assert.equal(parseYt("lofi piano"), null); assert.equal(parseYt("calm jazz for studying"), null); });
t("other sites are not YouTube", () => { assert.equal(parseYt("https://vimeo.com/123456"), null); assert.equal(parseYt("https://evil.com/watch?v=" + ID), null); assert.equal(parseYt("https://youtube.com.evil.com/watch?v=" + ID), null); });
t("bad ids", () => { assert.equal(parseYt("https://www.youtube.com/watch?v=short"), null); assert.equal(parseYt(""), null); assert.equal(parseYt(null), null); });

t("clean keeps the shape", () => assert.deepEqual(cleanYt({ id: ID, list: "", t: "Calm piano", ch: "Some channel", x: 1 }), { id: ID, list: "", t: "Calm piano", ch: "Some channel" }));
t("clean drops junk", () => { assert.equal(cleanYt({ id: "<script>" }), null); assert.equal(cleanYt("x"), null); assert.equal(cleanYt(null), null); });
t("clean trims long text", () => assert.equal(cleanYt({ id: ID, t: "a".repeat(500) }).t.length, 140));
t("clean keeps an error code", () => assert.equal(cleanYt({ id: ID, e: "150" }).e, "150"));
t("recent: at most 8, no errors kept", () => {
    const r = cleanRecent(Array.from({ length: 12 }, (_, i) => ({ id: ID.slice(0, 10) + "ABCDEFGHIJKL"[i], e: "150" })).concat([{ id: "bad" }]));
    assert.equal(r.length, 8); assert.ok(r.every((x) => !("e" in x)));
});
t("recent from junk", () => assert.deepEqual(cleanRecent("nope"), []));
console.log("ytmusic: " + n + " checks passed");
