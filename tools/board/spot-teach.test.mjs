// Spotlight teach mode (Nov 28, Eddie: "make the spotlight view better for the board to use in class"; "go through each phase").
// Phase 1: controls fade after 4 s idle and come back on a touch; big Next / Back; swipe and edge taps; + Screen and Remove in ⋯.
// Phase 2: a short class toolkit, All tools, Pin tools (remembered). Phase 3: Focus, reveal dots, a quiet corner counter.
// Demo week, nothing saved. node tools/board/spot-teach.test.mjs <shots>
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), errs = [];
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } }), p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://127.0.0.1:5000/studio.html?demo#slides"); await p.waitForSelector("#slFilm .sfsel");
await p.click("text=From my plan"); await p.waitForTimeout(900);
// a bellringer slide (one piece on Next) and a second screen after it
await p.click("#slFilm .sflist .sfi >> nth=1 >> .sft"); await p.waitForTimeout(300);
await p.click(".slteach"); await p.waitForSelector(".spot:not([hidden]) .spnext"); await p.waitForTimeout(1500);
const count = () => p.$eval(".spcount b", (e) => e.textContent);
const idle = () => p.evaluate(() => document.body.classList.contains("spidle"));
// phase 1: the big amber Next; building actions only in the ⋯ menu
const nx = await p.$eval(".spnext", (b) => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width, t: b.textContent.trim() }; });
assert.ok(nx.h >= 50 && nx.w >= 90 && /Next/.test(nx.t), "a big Next with its name " + JSON.stringify(nx));
assert.equal(await p.$eval("#spMore", (m) => m.hidden), true, "+ Screen and Remove are tucked in the ⋯ menu");
await p.click(".spmorebtn"); assert.equal(await p.$eval("#spMore", (m) => m.hidden), false); await p.mouse.click(960, 540); assert.equal(await p.$eval("#spMore", (m) => m.hidden), true, "the menu closes on a tap elsewhere");
// phase 3: reveal dots on a slide with a piece on Next, and the Next label says so
assert.ok(await p.$(".spcount .spdots i"), "reveal dots for the slide's pieces");
assert.match(await p.textContent(".spnext"), /Next step/, "Next says it shows the next piece");
// phase 1: idle fade and wake
await p.mouse.move(5, 540); await p.waitForTimeout(4600);
assert.equal(await idle(), true, "controls fade after 4 s");
assert.equal(await p.$eval(".spdock", (e) => getComputedStyle(e).opacity), "0");
assert.match(await p.textContent("#spPage"), /\d+ of \d+/, "the quiet counter shows while the controls are away");
assert.equal(await p.$eval("#spPage", (e) => getComputedStyle(e).opacity) !== "0", true);
await p.screenshot({ path: OUT + "/spot-idle.png" });
await p.mouse.move(960, 600); await p.waitForTimeout(100);
assert.equal(await idle(), false, "a touch brings them back");
// phase 1: edge tap and swipe (on the background strip under the blocks)
const st = await p.$eval("#stage", (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
for (let i = 0; i < 4 && !/^1 \//.test(await count()); i++) { await p.click(".spback2"); await p.waitForTimeout(300); }   // back to the first screen
const c0 = await count(); assert.match(c0, /^1 \//, "Back reaches the first screen");
await p.mouse.click(st.x + st.w * 0.97, st.y + st.h * 0.5); await p.waitForTimeout(500);
const c1 = await count(); assert.notEqual(c1, c0, "tapping the right edge moves forward " + c0 + " -> " + c1);
await p.mouse.move(st.x + st.w * 0.3, st.y + st.h * 0.895); await p.mouse.down(); await p.mouse.move(st.x + st.w * 0.75, st.y + st.h * 0.895, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
assert.notEqual(await count(), c1, "swiping right goes back");
// phase 2: the toolkit, All tools, Pin tools
const shown = () => p.$$eval(".sprack .spt", (x) => x.filter((b) => !b.hidden).map((b) => b.dataset.k));
const avail = await p.$$eval(".sprack .spt", (x) => x.filter((b) => !b.hidden || b.dataset.k).map((b) => b.dataset.k));
// the sample board hides student-name tools (Name picker) when signed out, so the toolkit is the default list minus those
const kit = await shown(), DEF = ["pick", "ptimer", "target", "traffic"];
assert.ok(kit.every((k) => DEF.includes(k)) && ["ptimer", "target", "traffic"].every((k) => kit.includes(k)), "the class toolkit by default: " + kit);
assert.equal(await p.$eval(".sptbg", (b) => b.hidden), true, "Background waits under All tools");
await p.click(".sptall"); await p.waitForTimeout(200);
assert.ok((await shown()).length > 10, "All tools shows every tool");
await p.click(".sptpin"); await p.click('.sprack .spt[data-k="clock"]'); await p.click('.sprack .spt[data-k="traffic"]'); await p.click(".sptpin"); await p.click(".sptall"); await p.waitForTimeout(200);
{ const k2 = await shown(); assert.ok(k2.includes("clock") && !k2.includes("traffic") && k2.includes("ptimer") && k2.includes("target"), "Pin tools changes the toolkit: " + k2); }
const fs1 = await p.$eval('.sprack .spt[data-k="ptimer"] span', (s) => parseFloat(getComputedStyle(s).fontSize)); assert.ok(fs1 >= 12, "labels are at least 12px");
// phase 3: Focus
await p.click(".sptfocus"); await p.waitForTimeout(200);
assert.equal(await p.$eval("#spFocus", (f) => f.hidden), false, "Focus dims the board");
await p.mouse.move(600, 400); await p.mouse.down(); await p.mouse.move(1300, 500, { steps: 4 }); await p.mouse.up();
assert.match(await p.$eval("#spFocus", (f) => f.style.getPropertyValue("--fx")), /^6[5-9]|^7/, "the circle follows the drag");
await p.screenshot({ path: OUT + "/spot-focus.png" });
await p.click(".spfoff"); assert.equal(await p.$eval("#spFocus", (f) => f.hidden), true, "Done turns Focus off");
// the toolkit is remembered
await p.reload(); await p.waitForTimeout(1500);
const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("anchorboard-spot-fav") || "null"));
assert.deepEqual((kept || []).slice().sort(), ["clock", "pick", "ptimer", "target"].sort(), "the pinned toolkit is saved on this device");
await browser.close();
assert.deepEqual(errs, [], "no page errors");
console.log("spotlight teach mode: all checks passed");
