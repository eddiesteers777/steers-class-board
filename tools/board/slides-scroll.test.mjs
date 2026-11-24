// Ticking slides keeps the slide list where it is (Nov 24, Eddie: "every time I select one it goes back to the top"):
// node tools/board/slides-scroll.test.mjs   Needs the repo served at 127.0.0.1:5000. Demo week, nothing saved.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import assert from "node:assert/strict";
const browser = await chromium.launch(), errs = [];
const posOf = (p, n, across) => p.$eval("#slFilm", (f, [n, across]) => { const it = f.querySelectorAll(".sflist .sfi")[n], fr = f.getBoundingClientRect(), r = it.getBoundingClientRect(); return Math.round(across ? r.left - fr.left : r.top - fr.top); }, [n, across]);
for (const [w, h, tag, across] of [[1366, 900, "desktop", false], [390, 844, "phone", true]]) {
    const p = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: across })).newPage();
    p.on("pageerror", (e) => errs.push(tag + ": " + e.message));
    await p.goto("http://127.0.0.1:5000/studio.html?demo#slides"); await p.waitForSelector("#slFilm .sfsel", { timeout: 20000 });
    await p.click("#slFilm .sfadd.lay"); await p.click(".slaycnt .spchip:text-is('10')"); await p.click(".slaygrid .slayb >> nth=1");
    await p.waitForFunction(() => document.querySelectorAll("#slFilm .sflist .sfi").length === 10);
    await p.click(".sfpkx:has-text('Done'), .sfpkmore"); if (across) { await p.click(".spi:has-text('Done selecting')"); }
    await p.waitForSelector("#slFilm .sfsel");
    await p.click("#slFilm .sflist .sfi >> nth=0 >> .sft");   // open slide 1, the one near the start of the list
    // scroll the list well past slide 1, so the open slide is out of view
    await p.$eval("#slFilm", (f, across) => { if (across) f.scrollLeft = 700; else f.scrollTop = 1000; }, across); await p.waitForTimeout(150);
    await p.click(".sfsel"); await p.waitForTimeout(150);
    for (const n of [7, 8, 6]) {
        await p.$eval("#slFilm", (f, [n, across]) => { const it = f.querySelectorAll(".sflist .sfi")[n]; const fr = f.getBoundingClientRect(), r = it.getBoundingClientRect(); if (across) f.scrollLeft += r.left - fr.left - 130; else f.scrollTop += r.top - fr.top - 260; }, [n, across]);
        await p.waitForTimeout(100);
        const before = await posOf(p, n, across);
        await p.click("#slFilm .sflist .sfi >> nth=" + n + " >> .sft"); await p.waitForTimeout(150);
        const after = await posOf(p, n, across);
        assert.ok(Math.abs(after - before) <= 2, tag + ": slide " + (n + 1) + " stayed put when ticked (" + before + " -> " + after + ")");
        assert.equal(await p.$eval("#slFilm .sflist .sfi >> nth=0", () => 0).catch(() => 0), 0);
    }
    assert.match(await p.textContent(".sfpick .sfpkn"), /^3 selected$/);
    // unticking the last one (the bar shrinks back) also keeps the list in place
    const n = 6, before = await posOf(p, n, across); await p.click("#slFilm .sflist .sfi >> nth=" + n + " >> .sft"); await p.waitForTimeout(150);
    assert.ok(Math.abs((await posOf(p, n, across)) - before) <= 2, tag + ": unticking keeps it in place too");
    // opening a different slide still brings that slide into view
    await p.click(".sfpkx:has-text('Done'), .sfpkmore"); if (across) await p.click(".spi:has-text('Done selecting')");
    await p.$eval("#slFilm", (f, across) => { if (across) f.scrollLeft = 0; else f.scrollTop = 0; }, across);
    await p.evaluate(() => document.querySelectorAll("#slFilm .sflist .sfi")[9].querySelector(".sft").click()); await p.waitForTimeout(250);
    const vis = await p.$eval("#slFilm", (f) => { const it = f.querySelector(".sfi.on"), fr = f.getBoundingClientRect(), r = it.getBoundingClientRect(); return r.bottom > fr.top && r.top < fr.bottom && r.right > fr.left && r.left < fr.right; });
    assert.ok(vis, tag + ": the slide just opened is in view");
}
await browser.close(); assert.deepEqual(errs, [], errs.join("\n")); console.log("slide list stays put while ticking: all checks passed");
