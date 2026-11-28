// Glass teaching screens and the phone dock (Nov 28, Eddie: "8, 9, and 10 now (make them match slides)").
// The Board Builder (the Remote's layout with a builder rail) wears Slides' glass in Night colors; on a phone, Back / Next /
// Blank / Timer sit in a dock pinned to the bottom and work. Demo week, nothing saved. No student names.
// node tools/board/glass-remote.test.mjs <shots>   Needs the repo served at 127.0.0.1:5000.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium, devices } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), errs = [];
const rect = (p, s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
// Chromebook: glass Board Builder
{
    const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage(); p.on("pageerror", (e) => errs.push("laptop: " + e.message));
    await p.goto("http://127.0.0.1:5000/studio.html?demo"); await p.waitForSelector("#stage"); await p.waitForTimeout(1500);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.mode), "dark", "the Board Builder is always Night");
    assert.match(await p.evaluate(() => getComputedStyle(document.body).backgroundImage), /radial-gradient/, "the glow behind it, as in Slides");
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".cbar")).borderRadius), "20px", "a floating glass header");
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".srail")).borderRadius), "20px", "the rail is a glass card");
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".flowbar")).borderRadius), "20px", "the day strip and Back / Next on a glass bar");
    assert.equal(await p.$$eval(".flow .fx", (x) => x.filter((b) => getComputedStyle(b).display !== "none").length), 0, "no Blank / Timer on a Chromebook");
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no sideways scroll");
    await p.screenshot({ path: OUT + "/glass-builder-1366.png" });
}
// a page without data-glass keeps the teacher's own light or Night choice
{
    const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
    await p.goto("http://127.0.0.1:5000/games.html?demo"); await p.waitForTimeout(1200);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.mode), "light", "other pages follow the site setting (light by default)");
}
// phone: the dock
for (const dev of ["iPhone 13", "iPhone SE"]) {
    const p = await (await browser.newContext({ ...devices[dev] })).newPage(); p.on("pageerror", (e) => errs.push(dev + ": " + e.message));
    await p.goto("http://127.0.0.1:5000/demo.html"); await p.waitForSelector("#flowBlank"); await p.waitForTimeout(1500);
    const vw = await p.evaluate(() => innerWidth), vh = await p.evaluate(() => innerHeight);
    const dock = await rect(p, ".flowbar .flow");
    assert.ok(dock.x >= 0 && dock.r <= vw && dock.b <= vh && dock.y > vh / 2, dev + ": the dock is pinned at the bottom, inside the screen " + JSON.stringify(dock));
    for (const id of ["flowBack", "flowNext", "flowBlank", "flowTimer"]) { const r = await rect(p, "#" + id); assert.ok(r.r <= dock.r + 1 && r.h >= 44, dev + ": " + id + " whole and fingertip-size"); }
    await p.evaluate(() => scrollTo(0, 2000)); await p.waitForTimeout(200);
    const dock2 = await rect(p, ".flowbar .flow"); assert.ok(Math.abs(dock2.y - dock.y) < 2, dev + ": the dock stays put while the page scrolls");
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
    const scr = () => p.$eval("#screens [aria-pressed=true]", (e) => e.textContent.trim());
    const was = await scr();
    await p.tap("#flowBlank"); await p.waitForTimeout(300); assert.equal(await scr(), "Whiteboard", dev + ": Blank shows the empty whiteboard");
    await p.tap("#flowBlank"); await p.waitForTimeout(300); assert.equal(await scr(), was, dev + ": a second tap goes back");
    await p.tap("#flowTimer"); await p.waitForTimeout(300); assert.equal(await p.$$eval('#toolLayer [data-panel="ptimer"]', (x) => x.length), 1, dev + ": Timer puts the timer on the board");
    await p.tap("#flowTimer"); await p.waitForTimeout(300); assert.equal(await p.$$eval('#toolLayer [data-panel="ptimer"]', (x) => x.length), 0, dev + ": and takes it off");
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), dev + ": no sideways scroll");
    if (dev === "iPhone 13") await p.screenshot({ path: OUT + "/phone-dock.png" });
}
await browser.close();
assert.deepEqual(errs, [], "no page errors");
console.log("glass remote: all checks passed");
