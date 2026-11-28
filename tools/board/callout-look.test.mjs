// The Class Tracker's light glass look and the board's "Called on" banner looks (Nov 28, Eddie: "bring that premium classy
// look to the class tracker but keep it light ... update the look of it to look glassy and premium and also be a way to edit
// the look of it on the class tracker page"). Sample names only. node tools/board/callout-look.test.mjs <shots>
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium, devices } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), errs = [], BASE = "http://127.0.0.1:5000/";
// 1. the look rule
{
    const p = await (await browser.newContext()).newPage(); await p.goto(BASE + "demo.html");
    const r = await p.evaluate(async () => { const m = await import("/js/callout.js?v=3"); return [m.cleanLook(null), m.cleanLook({ lk: "gold", sz: "big", pos: "mid" }), m.cleanLook({ lk: "spot", sz: "reg", pos: "top" }), m.cleanLook({ lk: "nope", sz: "huge" }), m.LOOKS.map((l) => l[0])]; });
    assert.deepEqual(r[0], { lk: "glass", sz: "reg", pos: "top" }, "no choice: frosted glass, regular, top");
    assert.deepEqual(r[1], { lk: "gold", sz: "big", pos: "mid" });
    assert.deepEqual(r[2], { lk: "spot", sz: "big", pos: "mid" }, "Spotlight is always big in the middle");
    assert.deepEqual(r[3], { lk: "glass", sz: "reg", pos: "top" }, "unknown values fall back");
    assert.deepEqual(r[4], ["glass", "night", "aurora", "gold", "spot", "classic"]);
}
// 2. the Tracker: light glass, and the look fold saves, previews and survives a reload
for (const [tag, opts] of [["phone", { ...devices["iPhone 13"] }], ["laptop", { viewport: { width: 1366, height: 900 } }]]) {
    const p = await (await browser.newContext(opts)).newPage(); p.on("pageerror", (e) => errs.push(tag + ": " + e.message));
    await p.goto(BASE + "tracker.html?demo"); await p.waitForSelector("#views"); await p.waitForTimeout(1200);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.mode), "light");
    const top = await p.evaluate(() => getComputedStyle(document.querySelector(".tk-top")).backgroundImage);
    assert.match(top, /rgba\(255, 255, 255/, tag + ": the header is frosted white glass, not the navy band");
    assert.match(await p.evaluate(() => getComputedStyle(document.body).backgroundImage), /radial-gradient/, tag + ": a soft glow behind the page");
    await p.click('#views button[data-v="pick"]'); await p.waitForSelector(".tk-look");
    assert.equal(await p.$eval(".tk-look", (d) => d.open), false, tag + ": the look fold starts closed");
    await p.click(".tk-look > summary"); await p.waitForTimeout(400);
    assert.equal(await p.$$eval(".tk-lookb", (x) => x.length), 6, tag + ": six looks");
    await p.click('.tk-lookb:has(b:text-is("Gold"))'); await p.waitForTimeout(300);
    await p.click('.tk-lookrow .tk-chip:text-is("Big")'); await p.waitForTimeout(300);
    assert.deepEqual(JSON.parse(await p.evaluate(() => localStorage.getItem("anchor:track:look"))), { lk: "gold", sz: "big", pos: "top" }, tag + ": the choice is saved");
    await p.waitForTimeout(3000);
    assert.match(await p.$eval(".tk-costage .callout", (c) => c.className), /lk-gold.*sz-big.*land/, tag + ": the preview lands in the chosen look");
    await p.click('.tk-lookb:has(b:text-is("Spotlight"))'); await p.waitForTimeout(300);
    assert.equal(await p.$$eval('.tk-lookrow .tk-chip:text-is("Big")', (x) => x[0].disabled), true, tag + ": Spotlight fixes the size");
    if (tag === "phone") await p.screenshot({ path: OUT + "/tracker-look-phone.png", fullPage: true });
    await p.reload(); await p.waitForSelector("#views"); await p.click('#views button[data-v="pick"]'); await p.waitForSelector(".tk-look");
    assert.match(await p.textContent(".tk-look > summary"), /Spotlight/, tag + ": remembered after a reload");
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), tag + ": no sideways scroll");
}
// 3. the board: a pick lands in the look it was sent with; a pick with none is frosted glass; a cheer keeps the size
{
    const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage(); p.on("pageerror", (e) => errs.push("board: " + e.message));
    await p.goto(BASE + "demo.html"); await p.waitForSelector("#stage"); await p.waitForTimeout(1500);
    await p.evaluate(async () => { const m = await import("/js/callout.js?v=3"); m.mountCallout({ store: { watch: (path, cb) => { window.__co = cb; } } }); window.__co({ exists: false }); });
    const send = (d) => p.evaluate((d) => window.__co({ exists: true, data: Object.assign({ id: Math.random().toString(36).slice(2), at: Date.now() }, d) }), d);
    const cls = () => p.$eval("#stage .callout", (c) => c.className);
    await send({ n: "Sample A", pool: ["Sample A", "Sample B", "Sample C"], lk: "aurora", sz: "big", pos: "mid" }); await p.waitForTimeout(2800);
    assert.match(await cls(), /lk-aurora.*sz-big.*at-mid.*show.*land/, "the board lands the pick in the sent look");
    await send({ n: "Sample A", pool: ["Sample A", "Sample B"], lk: "spot" }); await p.waitForTimeout(400);
    assert.equal(await p.$$eval("#stage .codim.show", (x) => x.length), 1, "Spotlight dims the board");
    await p.waitForTimeout(2600);
    await send({ n: "Sample A", cheer: 1, lk: "spot" }); await p.waitForTimeout(400);
    assert.match(await cls(), /lk-spot.*cheer/, "Got it right keeps the look's size and place, in green");
    assert.equal(await p.$$eval("#stage .codim.show", (x) => x.length), 0, "the dim lifts for the cheer");
    await send({ n: "Sample B", pool: ["Sample A", "Sample B"] }); await p.waitForTimeout(2800);
    assert.match(await cls(), /^callout lk-glass show land$/, "a pick sent with no look is frosted glass");
}
await browser.close();
assert.deepEqual(errs, [], "no page errors");
console.log("callout looks: all checks passed");
