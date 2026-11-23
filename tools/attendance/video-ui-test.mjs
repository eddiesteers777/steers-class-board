// The catch-up video on the catch-up page (real Week 5 file, fake store): node tools/attendance/video-ui-test.mjs <shots>
// Needs the repo served: python3 -m http.server 5000 (repo root). Made-up names only.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5000/tools/attendance/catchup-harness.html", OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), logs = [];
for (const [w, h, tag] of [[390, 900, "phone"], [1280, 900, "desktop"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage();
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5000" });
    p.on("console", (m) => { if (m.type() === "error") logs.push(tag + ": " + m.text()); }); p.on("pageerror", (e) => logs.push(tag + " PAGEERROR: " + e.message));
    await p.goto(BASE); await p.waitForSelector(".cu-day", { timeout: 8000 });
    const tue = p.locator(".cu-day").nth(0), mon = p.locator(".cu-day").nth(1);
    await tue.locator("text=No guided notes for this day, so there is nothing to make a video from.").waitFor({ timeout: 8000 });
    await mon.locator("button:has-text('Make it in Gemini')").click();
    assert.equal(await mon.locator(".cv-steps li").count(), 4);
    await mon.locator("button:has-text('Copy the lesson')").click();
    const lesson = await p.evaluate(() => navigator.clipboard.readText());
    assert.match(lesson, /^Triangle Angle Sum \(8th grade\)/); assert.match(lesson, /Worked example 2: Right triangle/); assert.ok(!/A1|Answer key/.test(lesson));
    await mon.locator("button:has-text('Copy the instructions')").click();
    assert.match(await p.evaluate(() => navigator.clipboard.readText()), /5 minutes or less[\s\S]*Do not change any number/);
    assert.equal(await mon.locator("a:has-text('Open Gemini Notebook')").getAttribute("href"), "https://notebooklm.google.com/");
    // a bad link is refused
    await mon.locator(".cv-link input").fill("http://example.com/v.mp4"); await mon.locator("button:has-text('Save link')").click();
    assert.match(await p.textContent("#cu"), /That link will not work here/);
    assert.equal((await p.evaluate(() => window.__saved)).length, 0);
    // a Drive link is saved privately; students do not see it yet
    const url = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing";
    await mon.locator(".cv-link input").fill(url); await mon.locator("button:has-text('Save link')").click();
    await mon.locator(".cv-box").waitFor();
    let saved = await p.evaluate(() => window.__saved); assert.equal(saved[0].path, "catchvid/week5"); assert.deepEqual({ u: saved[0].data.v["8th|0"].u, ok: saved[0].data.v["8th|0"].ok }, { u: url, ok: 0 });
    assert.equal((await p.evaluate(() => window.__pub)).length, 0, "not public before it is checked");
    assert.match(await mon.textContent(), /Not on the Class Page yet\. Watch it first/);
    await mon.locator(".cv-play").click(); assert.equal(await mon.locator("iframe.cv-frame").getAttribute("src"), "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview");
    // ticked: shown to students (public copy); untick takes it down
    await mon.locator(".cv-ok input").check();
    let pub = await p.evaluate(() => window.__pub); assert.equal(pub[0].path, "cv/week5"); assert.deepEqual(pub[0].data.v["8th|0"], { u: url, t: "Catch-up video: Monday 11/16" });
    assert.match(await mon.textContent(), /Checked and showing on the Class Page under Monday/);
    await mon.locator("button:has-text('Copy link for Schoology')").click(); assert.equal(await p.evaluate(() => navigator.clipboard.readText()), url);
    await mon.locator(".cv-ok input").uncheck(); pub = await p.evaluate(() => window.__pub); assert.deepEqual(pub[1].data.v["8th|0"], { u: "", t: "" });
    await mon.locator("button:has-text('Remove video')").click(); await mon.locator(".cv-steps").waitFor();   // back to the Gemini steps (still open)
    assert.equal(await mon.locator(".cv-box").count(), 0);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(wide <= 0, tag + " no sideways scroll");
    const small = await p.$$eval(".cu-day .btn, .cv-play, .cv-link input", (b) => b.filter((x) => x.offsetParent && x.getBoundingClientRect().height < 44).length); assert.equal(small, 0, tag + " tap targets 44px");
    // screenshot with the steps open
    await p.screenshot({ path: `${OUT}/video-${tag}.png`, fullPage: true });
    await ctx.close();
}
await browser.close(); assert.deepEqual(logs, [], logs.join("\n")); console.log("catch-up video page: all checks passed");
