// Several slides at once on the Slides side (Nov 24), in the demo sample week (nothing saved):
// node tools/board/slides-multi.test.mjs <shots>   Needs the repo served at 127.0.0.1:5000. No student names.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), errs = [];
const count = (p) => p.$$eval("#slFilm .sflist .sfi", (x) => x.length);
for (const [w, h, tag] of [[1366, 900, "desktop"]]) {
    const p = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    p.on("pageerror", (e) => errs.push(tag + ": " + e.message));
    await p.goto("http://127.0.0.1:5000/studio.html?demo#slides"); await p.waitForSelector("#slFilm .sfsel", { timeout: 20000 });
    assert.equal(await count(p), 0);
    // a layout, five at once: added, ticked, the bar shows them
    await p.click("#slFilm .sfadd.lay"); await p.click(".slaycnt .spchip:text-is('5')"); await p.click(".slaygrid .slayb >> nth=1");
    await p.waitForFunction(() => document.querySelectorAll("#slFilm .sflist .sfi").length === 5);
    assert.equal(await p.textContent(".sfpkn"), "5 selected"); assert.equal(await p.$$eval("#slFilm .sfi.picked", (x) => x.length), 5);
    // panels for all five
    await p.click(".sfpka:has-text('Panels')"); await p.click(".spchip:text-is('5 min')");
    await p.waitForFunction(() => document.querySelectorAll("#slFilm .sfi .sfpn").length === 5);
    await p.keyboard.press("Escape");
    // duplicate all five: ten slides, the copies are ticked
    await p.click(".sfpka:has-text('Duplicate')"); await p.waitForFunction(() => document.querySelectorAll("#slFilm .sflist .sfi").length === 10);
    assert.equal(await p.textContent(".sfpkn"), "5 selected");
    assert.equal(await p.$$eval("#slFilm .sfi .sfpn", (x) => x.length), 10, "copies keep their panels");
    // delete the five copies, then Undo brings them back in one step
    await p.click(".sfpka.danger"); await p.waitForFunction(() => document.querySelectorAll("#slFilm .sflist .sfi").length === 5);
    assert.ok(await p.$(".sfsel"), "after deleting, back to the plain Select button");
    await p.keyboard.press("Control+z"); await p.waitForFunction(() => document.querySelectorAll("#slFilm .sflist .sfi").length === 10, null, { timeout: 5000 });
    // Select, tick 2 then Shift-tick 4: a run of three; Hide them, then Show
    await p.click(".sfsel"); await p.click("#slFilm .sflist .sfi >> nth=1 >> .sfpk"); await p.click("#slFilm .sflist .sfi >> nth=3 >> .sft", { modifiers: ["Shift"] });
    assert.equal(await p.textContent(".sfpkn"), "3 selected");
    await p.click(".sfpka:has-text('Hide')"); assert.equal(await p.$$eval("#slFilm .sfi.hid", (x) => x.length), 3);
    await p.click(".sfpka:has-text('Show')"); assert.equal(await p.$$eval("#slFilm .sfi.hid", (x) => x.length), 0);
    // tapping a slide while selecting ticks it instead of opening it
    await p.click("#slFilm .sflist .sfi >> nth=6 >> .sft"); assert.equal(await p.textContent(".sfpkn"), "4 selected");
    if (tag === "desktop") await p.screenshot({ path: OUT + "/slides-multi-" + tag + ".png" });
    else { const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(wide <= 0, "phone: no sideways page scroll"); await p.screenshot({ path: OUT + "/slides-multi-phone.png" }); }
    // the copy menu offers the ticked slides
    if (tag === "desktop") { await p.click(".sfpka:has-text('Copy to')"); assert.ok(await p.$(".spchip:has-text('Copy 4 selected')")); await p.keyboard.press("Escape"); }
    // put the four in Spotlight: Spotlight opens with a screen for each (plus the screen it had)
    await p.click(".sfpkgo"); await p.waitForFunction(() => document.body.classList.contains("spotmode") || /spot/.test(location.hash), null, { timeout: 10000 });
    await p.waitForTimeout(1500);
    const pages = await p.evaluate(() => (document.body.innerText.match(/(\d+)\s*\/\s*(\d+)/) || [])[2]);
    assert.equal(pages, "5", "Spotlight has 1 + 4 screens");
    if (tag === "desktop") await p.screenshot({ path: OUT + "/slides-multi-spotlight.png" });
}
// a phone: the strip runs across under the slide; the compact bar stays pinned at its left edge
{
    const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
    p.on("pageerror", (e) => errs.push("phone: " + e.message));
    await p.goto("http://127.0.0.1:5000/studio.html?demo#slides"); await p.waitForSelector("#slFilm .sfsel", { timeout: 20000 });
    await p.click("#slFilm .sfadd.lay"); await p.click(".slaycnt .spchip:text-is('5')"); await p.click(".slaygrid .slayb >> nth=1");
    await p.waitForFunction(() => document.querySelectorAll("#slFilm .sflist .sfi").length === 5);
    await p.$eval("#slFilm", (f) => { f.scrollLeft = f.scrollWidth; });   // scrolled to the far end
    await p.waitForTimeout(200);
    const box = await p.$eval(".sfpick", (b) => { const r = b.getBoundingClientRect(); return { x: r.x, w: r.width, h: r.height }; });
    assert.ok(box.x >= -1 && box.x < 20 && box.w > 80, "phone: the bar stays at the left edge while the strip scrolls " + JSON.stringify(box));
    assert.equal(await p.textContent(".sfpick .sfpkn"), "5 selected"); assert.equal(await p.$$eval(".sfpick .sfpkn", (x) => x.length), 1, "phone: one count, not two");
    const fits = await p.$eval(".sfpick", (b) => [...b.children].every((k) => k.getBoundingClientRect().bottom <= b.getBoundingClientRect().bottom + 1)); assert.ok(fits, "phone: everything in the bar fits the strip");
    const small = await p.$$eval(".sfpick button", (b) => b.filter((x) => x.getBoundingClientRect().height < 30).length); assert.equal(small, 0);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(wide <= 0, "phone: no sideways page scroll");
    await p.screenshot({ path: OUT + "/slides-multi-phone.png" });
    await p.click(".sfpkmore"); await p.click(".spi.danger:has-text('Delete')"); await p.waitForFunction(() => document.querySelectorAll("#slFilm .sflist .sfi").length === 0);
    await p.click("button.tb[title*='Undo' i], button[aria-label*='Undo' i]"); await p.waitForFunction(() => document.querySelectorAll("#slFilm .sflist .sfi").length === 5, null, { timeout: 5000 });
    await p.click(".sfsel"); await p.click("#slFilm .sflist .sfi >> nth=0 >> .sft"); await p.click("#slFilm .sflist .sfi >> nth=1 >> .sft");
    await p.click(".sfpick .sfpkgo"); await p.waitForTimeout(2000);
    assert.equal(await p.evaluate(() => (document.body.innerText.match(/(\d+)\s*\/\s*(\d+)/) || [])[2]), "3", "phone: Spotlight has 1 + 2 screens");
}
await browser.close(); assert.deepEqual(errs, [], errs.join("\n")); console.log("several slides at once: all checks passed");
