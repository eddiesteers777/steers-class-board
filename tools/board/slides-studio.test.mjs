// Glass Studio (Nov 27, Eddie picked option A, and yes to Aurora glass): the Slides page in Spotlight's dark glass, the tools
// in one dock under the slide, the picked block's own bar beside it, the Spotlight buttons switch, notes as a one-line strip,
// and the Aurora glass theme. Demo week, nothing saved. No student names.
// node tools/board/slides-studio.test.mjs <shots>   Needs the repo served at 127.0.0.1:5000.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium, devices } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), errs = [];
const URL = "http://127.0.0.1:5000/studio.html?demo#slides";
const rect = (p, sel) => p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; });
const overlap = (a, b) => a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
const pageX = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function open(p) { await p.goto(URL); await p.waitForSelector("#slFilm .sfsel", { timeout: 20000 }); await p.waitForTimeout(500); }
async function bigThree(p) { await p.click("#slFilm .sfadd.lay"); await p.click(".sgrids .sgridb:has-text('Big + three')"); await p.waitForFunction(() => document.querySelectorAll(".slcanvas .slgl").length === 4); await p.waitForTimeout(300); }

for (const [w, h] of [[1366, 768], [1920, 1080], [1280, 800]]) {
    const tag = w + "x" + h;
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(tag + ": " + e.message));
    await open(p);
    // Spotlight's glass world behind the page, and one glass bar on top
    assert.match(await p.evaluate(() => getComputedStyle(document.body).backgroundImage), /radial-gradient/, tag + ": dark Spotlight glow behind Slides");
    assert.ok(await p.evaluate(() => getComputedStyle(document.querySelector(".cbar")).borderRadius === "20px"), tag + ": the header is a floating glass bar");
    await bigThree(p);
    // the dock sits under the slide and the notes strip, inside the window, and fits without scrolling sideways at 1366 and up
    const st = await rect(p, "#slStage"), dock = await rect(p, "#slTools"), notes = await rect(p, "#slNotesBox");
    assert.ok(dock.y >= notes.b - 1 && notes.y >= st.b - 1, tag + ": stage, then notes, then the dock " + JSON.stringify({ st, notes, dock }));
    assert.ok(dock.b <= h + 1, tag + ": the dock is on screen");
    if (w >= 1366) assert.ok(await p.$eval("#slTools", (e) => e.scrollWidth <= e.clientWidth + 1), tag + ": every tool shows in the dock");
    assert.equal(await p.$$eval("#slTools .tb.txt span", (x) => x.filter((s) => s.textContent.trim() && s.getBoundingClientRect().width > 0).length) >= 13, true, tag + ": tools carry their names");
    // notes: one line until you type in them
    const n1 = (await rect(p, "#slNotes")).h; await p.focus("#slNotes"); await p.waitForTimeout(350); const n2 = (await rect(p, "#slNotes")).h;
    assert.ok(n1 < 50 && n2 > 90, tag + ": notes open while typing " + n1 + " → " + n2);
    await p.$eval("#slNotes", (e) => e.blur());
    // pick the second step block: its own bar floats beside it, in one row from 1366 up, inside the page, not over the block
    const sl = await rect(p, ".slcanvas");
    await p.mouse.click(sl.x + sl.w * 0.84, sl.y + sl.h * 0.47); await p.waitForTimeout(300);
    assert.equal(await p.$eval("#slCtx", (e) => e.hidden), false, tag + ": the block bar shows");
    assert.equal(await p.$$eval("#slTools .tgrp.fmt, #slTools .tgrp.common", (x) => x.length), 0, tag + ": the block's tools are not in the dock");
    const cx = await rect(p, "#slCtx"), fr = await rect(p, "#slOver .sfr"), right = await rect(p, ".sright");
    assert.ok(cx.x >= right.x - 1 && cx.r <= right.r + 1 && cx.y >= st.y - 1, tag + ": the bar stays on the page " + JSON.stringify({ cx, right }));
    if (w >= 1366) assert.ok(cx.h < 60, tag + ": one row " + cx.h);
    assert.ok(!overlap(cx, fr), tag + ": the bar does not cover the picked block " + JSON.stringify({ cx, fr }));
    assert.ok(await p.$("#slCtx .tb[title*='Delete']"), tag + ": delete is on the bar");
    if (w === 1366) await p.screenshot({ path: OUT + "/studio-pick-" + tag + ".png" });
    // the big block: the bar goes to the strip above the slide that Spotlight keeps clear
    await p.mouse.click(sl.x + sl.w * 0.3, sl.y + sl.h * 0.55); await p.waitForTimeout(300);
    // the tall block: the bar finds the clear strip above or under it, never over its words
    const cx2 = await rect(p, "#slCtx"), fr2 = await rect(p, "#slOver .sfr");
    assert.ok(!overlap(cx2, fr2) || cx2.b <= fr2.y + 60, tag + ": a tall block keeps its words clear " + JSON.stringify({ cx2, fr2 }));
    // a click on the empty stage puts the bar away
    await p.mouse.click(st.x + 6, st.y + st.h / 2); await p.waitForTimeout(250);
    assert.equal(await p.$eval("#slCtx", (e) => e.hidden), true, tag + ": nothing picked, no bar");
    // Spotlight buttons: four marks where Spotlight's controls sit; remembered after a reload
    await p.click(".tb.tghost"); await p.waitForTimeout(200);
    assert.equal(await p.$$eval("#slOver .sghost", (x) => x.length), 4, tag + ": Spotlight buttons drawn");
    assert.equal(await p.getAttribute(".tb.tghost", "aria-pressed"), "true");
    if (w === 1366) await p.screenshot({ path: OUT + "/studio-ghost-" + tag + ".png" });
    if (w === 1366) { await p.reload(); await p.waitForSelector("#slFilm .sfsel"); await bigThree(p); assert.equal(await p.$$eval("#slOver .sghost", (x) => x.length), 4, "the switch is remembered"); }
    await p.click(".tb.tghost"); await p.waitForTimeout(200);
    assert.equal(await p.$$eval("#slOver .sghost", (x) => x.length), 0, tag + ": Spotlight buttons off");
    // Aurora glass: the theme brings its glow; a new grid slide made from it keeps the glow; Night glass puts the board back
    await p.click("#slTools .tb:has-text('Look')"); await p.click(".sthb[aria-label='Aurora glass']"); await p.waitForTimeout(400); await p.keyboard.press("Escape");
    const bgOf = () => p.$eval(".slcanvas .slbg", (e) => getComputedStyle(e).backgroundImage);
    assert.match(await bgOf(), /radial-gradient/, tag + ": Aurora glow on the slide");
    if (w === 1366) await p.screenshot({ path: OUT + "/studio-aurora-" + tag + ".png" });
    await bigThree(p);
    assert.match(await bgOf(), /radial-gradient/, tag + ": a new grid slide keeps the Aurora glow");
    await p.click("#slTools .tb:has-text('Look')"); await p.click(".sthb[aria-label='Night glass']"); await p.waitForTimeout(400); await p.keyboard.press("Escape");
    assert.doesNotMatch(await bgOf(), /radial-gradient/, tag + ": another theme takes the glow off");
    assert.ok(await pageX(p) <= 0, tag + ": no sideways page scroll");
    await ctx.close();
}
// a phone: the block's tools stay in the dock (Done first), the floating bar never shows, nothing wider than the screen
{
    const ctx = await browser.newContext({ ...devices["iPhone 13"] }), p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push("phone: " + e.message));
    await open(p); await bigThree(p);
    const sl = await rect(p, ".slcanvas");
    await p.touchscreen.tap(sl.x + sl.w * 0.3, sl.y + sl.h * 0.5); await p.waitForTimeout(300);
    assert.equal(await p.$eval("#slCtx", (e) => e.hidden), true, "phone: no floating bar");
    assert.ok(await p.$("#slTools .tdoneb"), "phone: Done in the dock");
    assert.ok(await p.$("#slTools .tgrp.common"), "phone: the block's tools in the dock");
    const dock = await rect(p, "#slTools"); assert.ok(dock.b <= 664 + 1 && dock.y > 300, "phone: the dock is pinned near the bottom " + JSON.stringify(dock));
    assert.ok(await pageX(p) <= 0, "phone: no sideways page scroll");
    await p.screenshot({ path: OUT + "/studio-phone.png" });
    await ctx.close();
}
// Board mode keeps its own light look
{
    const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
    p.on("pageerror", (e) => errs.push("board: " + e.message));
    await p.goto("http://127.0.0.1:5000/studio.html?demo"); await p.waitForSelector("#stage"); await p.waitForTimeout(800);
    assert.doesNotMatch(await p.evaluate(() => getComputedStyle(document.body).backgroundImage), /radial-gradient\(120% 90%/, "Board mode is not dark");
}
await browser.close();
assert.deepEqual(errs, [], "no page errors");
console.log("glass studio: all checks passed");
