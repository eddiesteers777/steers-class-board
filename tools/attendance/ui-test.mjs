// Who's out card in Chromium with a fake Remote and store (no Firebase): node tools/attendance/ui-test.mjs <shots dir>
// Needs the repo served: python3 -m http.server 5000 (from the repo root). Made-up names only.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5000/tools/attendance/harness.html", OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(); const logs = [];
for (const [w, h, tag] of [[390, 800, "phone"], [1280, 800, "desktop"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500 }), p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") logs.push(tag + ": " + m.text()); }); p.on("pageerror", (e) => logs.push(tag + " PAGEERROR: " + e.message));
    await p.goto(BASE); await p.waitForFunction(() => window.__ready);
    await p.waitForSelector(".outgrid button");
    const names = await p.$$eval(".outgrid button", (b) => b.map((x) => x.textContent));
    assert.deepEqual(names, ["Ava R.", "Ava T.", "Ben", "Cara", "Dev"], tag + " first names only; initial only for the two Avas");
    assert.ok(!names.some((n) => /Kim|Lopez|Patel|Rivera|Tran/.test(n)), "no last names");
    const tap = async (n) => { await p.click(`.outgrid button:has-text("${n}")`); await p.waitForTimeout(60); };
    await tap("Ben"); await tap("Dev");
    assert.equal(await p.textContent("#outCount"), "2 out");
    assert.equal(await p.$$eval(".outgrid button.out", (b) => b.length), 2);
    const saved = await p.evaluate(() => window.__saved);
    assert.equal(saved.length, 2); assert.equal(saved[0].path, "teacher/t1/attendance/2026-11-24"); assert.equal(saved[0].merge, true);
    assert.deepEqual(Object.keys(saved[0].data.out["1st"]), ["ben-k"]);   // one student per write
    assert.ok(!JSON.stringify(saved).includes("Kim"), "last name never saved");
    const abs = await p.evaluate(() => window.__S.tools.absent); assert.equal(abs.day, "2026-11-24"); assert.deepEqual(abs.periods["1st"].sort(), [2, 4]);   // Name Picker list in step
    await tap("Ben"); assert.equal(await p.textContent("#outCount"), "1 out");   // tap again = back in
    assert.equal((await p.evaluate(() => window.__saved))[2].data.out["1st"]["ben-k"].x, 1);
    await p.click('.outper button:has-text("2nd")'); assert.equal(await p.evaluate(() => window.__pushes) > 0, true);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(wide <= 0, tag + " no sideways scroll");
    const small = await p.$$eval(".outgrid button, .outper button", (b) => b.filter((x) => x.getBoundingClientRect().height < 44).length); assert.equal(small, 0, tag + " tap targets 44px");
    await p.screenshot({ path: `${OUT}/who-out-${tag}.png` }); await ctx.close();
}
await browser.close(); assert.deepEqual(logs, [], logs.join("\n")); console.log("who's out card: all checks passed");
