// Catch-up video rules: node tools/attendance/video.test.mjs  (real Week 5 notes from data/week5.js)
import assert from "node:assert/strict";
import fs from "node:fs";
import * as V from "../../js/catchupVideo.js";

// links: only https YouTube / Google Drive / Docs / Gemini Notebook
assert.equal(V.cleanUrl("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing"), "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing");
assert.equal(V.cleanUrl("https://youtu.be/dQw4w9WgXcQ"), "https://youtu.be/dQw4w9WgXcQ");
assert.equal(V.cleanUrl("http://youtu.be/dQw4w9WgXcQ"), "");                 // not https
assert.equal(V.cleanUrl("https://example.com/video.mp4"), "");               // not an allowed site
assert.equal(V.cleanUrl("javascript:alert(1)"), ""); assert.equal(V.cleanUrl(""), "");
assert.deepEqual(V.embedOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3"), { kind: "yt", id: "dQw4w9WgXcQ" });
assert.deepEqual(V.embedOf("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view"), { kind: "drive", id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345" });
assert.deepEqual(V.embedOf("https://notebooklm.google.com/notebook/abc"), { kind: "link" });

// records: private link, checked, public copy only with a link; one class+day per write
assert.deepEqual(V.linkWrite("8th", 0, "https://youtu.be/dQw4w9WgXcQ", 5), { v: { "8th|0": { u: "https://youtu.be/dQw4w9WgXcQ", at: 5, ok: 0 } } });
assert.equal(V.okWrite("8th", 0, "u", true, 9).v["8th|0"].ok, 9); assert.equal(V.okWrite("8th", 0, "u", false, 9).v["8th|0"].ok, 0);
assert.deepEqual(V.pubWrite("7th", 2, "", ""), { v: { "7th|2": { u: "", t: "" } } });
assert.deepEqual(V.vidOf({ v: { "8th|0": { u: "https://youtu.be/dQw4w9WgXcQ", ok: 3 } } }, "8th", 0), { u: "https://youtu.be/dQw4w9WgXcQ", ok: 3, t: "" });
assert.equal(V.vidOf({ v: { "8th|0": { u: "https://evil.example/x" } } }, "8th", 0), null);   // a bad saved link is never shown
assert.equal(V.vidOf({ v: { "8th|0": { u: "" } } }, "8th", 0), null);

// the Gemini pack from the real Week 5 notes: only checked content, the limits, no answer key
const s = fs.readFileSync(new URL("../../data/week5.js", import.meta.url), "utf8"), w = JSON.parse(s.slice(s.indexOf("export default") + 14).trim().replace(/;\s*$/, ""));
const n8 = w.classes["8th"].days[0].notes, p8 = V.geminiPack(n8, { grade: "8th grade", day: "Monday" });
assert.equal(p8.examples, 2);
assert.match(p8.source, /^Triangle Angle Sum \(8th grade\)/);
assert.match(p8.source, /Worked example 1: Find the missing angle\nA triangle has angles 50° and 60°\. Find x\.\n  Step 1: 50 \+ 60 \+ x = 180/);
assert.match(p8.source, /Step 3: x = 55°/);                           // example 2's answer: 180 − 90 − 35 = 55
assert.equal(180 - 90 - 35, 55); assert.equal(180 - 50 - 60, 70);
assert.ok(!/Worked example 3/.test(p8.source), "two worked examples at most");
assert.ok(!/A1|Answer key|Exit/i.test(p8.source), "no practice answers, key or exit ticket in the pack");
assert.match(p8.ask, /5 minutes or less/); assert.match(p8.ask, /Do not change any number, do not add other problems/); assert.match(p8.ask, /Now try the practice on your worksheet\./);
const n7 = w.classes["7th"].days[0].notes, p7 = V.geminiPack(n7, { grade: "7th grade" });
assert.match(p7.source, /\nI can solve real-world/); assert.match(p7.source, /\nNo calculator on the quiz, so we practice by hand\./);   // a note stays a note
assert.ok(!/I can No calculator/.test(p7.source));
assert.match(p7.source, /- To divide by a fraction, multiply by its reciprocal\./);   // vocabulary blanks filled in
assert.match(p7.source, /Find \(−2 1\/2\)\(1 1\/3\)\./); assert.match(p7.source, /Step 3: −3 1\/3/);   // (−5/2)(4/3) = −10/3 = −3 1/3
assert.equal(V.geminiPack(null), null); assert.equal(V.geminiPack({ title: "x", examples: [] }), null);
console.log("catch-up video: all checks passed");
