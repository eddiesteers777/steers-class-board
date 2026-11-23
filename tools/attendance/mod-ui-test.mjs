// The modified group switch on the catch-up page (real Week 5 file + made-up modified notes): node tools/attendance/mod-ui-test.mjs <shots>
// Needs the repo served: python3 -m http.server 5000 (repo root). Made-up names only.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5000/tools/attendance/catchup-harness.html", OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), logs = [];
for (const [w, h, tag] of [[390, 900, "phone"], [1280, 900, "desktop"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") logs.push(tag + ": " + m.text()); }); p.on("pageerror", (e) => logs.push(tag + " PAGEERROR: " + e.message));
    await p.goto(BASE + "?mod"); await p.waitForSelector(".cu-day", { timeout: 8000 });
    const mon = p.locator(".cu-day").nth(1), sw = p.locator(".cu-mod input");
    await p.waitForFunction(() => { const i = document.querySelector(".cu-mod input"); return i && !i.disabled; });
    assert.equal(await sw.isChecked(), false);
    assert.deepEqual(await mon.locator(".cu-paper b").allTextContents(), ["1 Monday - Guided Notes - Triangle Angle Sum (8th Grade)"]);
    await sw.check();
    assert.deepEqual(await mon.locator(".cu-paper b").allTextContents(), ["1 Monday - Guided Notes - Find the Missing Angle (8th Grade Modified)"]);
    const saved = await p.evaluate(() => window.__saved); assert.equal(saved[0].path, "modgroup/1st"); assert.deepEqual(saved[0].data.kids["ben-k"].on, 1);
    await mon.locator(".cu-paper button:has-text('Show')").click(); await p.waitForSelector(".cu-sheet .sheet");
    const sheet = await p.textContent(".cu-sheet"); assert.match(sheet, /Find the Missing Angle/); assert.ok(!/TEACHER KEY|x = 80°/.test(sheet), "student copy, no answers");
    await mon.locator(".cu-route").first().click(); await p.waitForSelector(".cu-copy");
    const copy = await p.inputValue(".cu-copy"); assert.match(copy, /^Catch-up \(modified\): Find the Missing Angle/); assert.match(copy, /3\. A triangle has angles 60° and 60°\. Find x\./);
    assert.match(await mon.textContent(), /From the modified guided notes for that day\./);
    await sw.uncheck(); assert.deepEqual(await mon.locator(".cu-paper b").allTextContents(), ["1 Monday - Guided Notes - Triangle Angle Sum (8th Grade)"]);
    assert.equal((await p.evaluate(() => window.__saved))[1].data.kids["ben-k"].on, 0);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(wide <= 0, tag + " no sideways scroll");
    const lh = await p.$eval(".cu-mod", (x) => x.getBoundingClientRect().height); assert.ok(lh >= 44, tag + " switch 44px tall");
    await p.screenshot({ path: `${OUT}/mod-${tag}.png` }); await ctx.close();
}
await browser.close(); assert.deepEqual(logs, [], logs.join("\n")); console.log("modified group switch: all checks passed");
