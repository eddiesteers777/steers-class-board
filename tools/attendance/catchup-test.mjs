// One student's catch-up page with the real Week 5 week file and a fake store: node tools/attendance/catchup-test.mjs <shots>
// Needs the repo served: python3 -m http.server 5000 (repo root). Made-up names only.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5000/tools/attendance/catchup-harness.html", OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), logs = [];
for (const [w, h, tag] of [[390, 900, "phone"], [1280, 900, "desktop"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") logs.push(tag + ": " + m.text()); }); p.on("pageerror", (e) => logs.push(tag + " PAGEERROR: " + e.message));
    await p.goto(BASE); await p.waitForSelector(".cu-day", { timeout: 8000 });
    assert.equal(await p.textContent("h1"), "Ben: catch-up");                    // first name only
    assert.ok(!/Kim|Ben K/.test(await p.textContent("#cu")), "no last name or initial");
    const days = await p.$$eval(".cu-day h2", (x) => x.map((n) => n.textContent)); assert.deepEqual(days, ["Tuesday, 11/17", "Monday, 11/16"]);
    const mon = p.locator(".cu-day").nth(1);
    assert.match(await mon.textContent(), /Missed Monday — /);
    const paperNames = await mon.locator(".cu-paper b").allTextContents();
    assert.ok(paperNames.some((n) => /^1 Monday - Guided Notes - Triangle Angle Sum \(8th Grade\)$/.test(n)), "Monday's guided notes paper: " + paperNames.join(" | "));
    assert.ok(!paperNames.some((n) => /TEACHER KEY/.test(n)), "never a key");
    await mon.locator(".cu-paper button:has-text('Show')").first().click();
    await p.waitForSelector(".cu-sheet .sheet"); const sheet = await p.textContent(".cu-sheet");
    assert.match(sheet, /Triangle Angle Sum/); assert.ok(!/TEACHER KEY/.test(sheet));
    await mon.locator(".cu-paper button:has-text('Print')").first().click();
    assert.deepEqual(await p.evaluate(() => window.__printed[0]), { n: 1, title: "1 Monday - Guided Notes - Triangle Angle Sum (8th Grade)", key: false });
    // the choice: DeltaMath (the platform teaches) vs Magma (you lead)
    const routes = await mon.locator(".cu-route b").allTextContents(); assert.deepEqual(routes, ["DeltaMath: The platform teaches", "Magma Math: I teach it"]);
    await mon.locator(".cu-route").first().click(); await p.waitForSelector(".cu-copy");
    const copy = await p.inputValue(".cu-copy");
    assert.match(copy, /^Catch-up: Triangle Angle Sum \(Monday, 11\/16\)/); assert.match(copy, /For DeltaMath: /); assert.match(copy, /Answer key \(teacher only\)/); assert.match(copy, /1\. A triangle has angles 70° and 45°\. Find x\./);
    await p.click("button:has-text('Mark assigned on DeltaMath')");
    let saved = await p.evaluate(() => window.__saved); assert.equal(saved[0].path, "catchup/1st"); assert.deepEqual(Object.values(saved[0].data.kids["ben-k"].d)[0].st, "assigned");
    assert.equal(Object.keys(saved[0].data.kids["ben-k"].d)[0], "2026-11-16"); assert.equal(saved[0].data.kids["ben-k"].d["2026-11-16"].via, "deltamath");
    assert.match(await mon.textContent(), /Catch-up assigned \(DeltaMath\)/);
    // Tuesday in the published Week 5 has no paper of its own: say so
    assert.match(await p.locator(".cu-day").nth(0).textContent(), /No paper for this day in the week file\./);
    // caught up: both days done -> all caught up, warnings gone
    await p.locator(".cu-day").nth(0).locator("button:has-text('Mark caught up')").click();
    await mon.locator("button:has-text('Mark caught up')").click();
    await p.waitForFunction(() => /All caught up/.test(document.querySelector(".cu-lead").textContent));
    saved = await p.evaluate(() => window.__saved); assert.equal(saved.length, 3); assert.equal(saved[2].data.kids["ben-k"].d["2026-11-16"].via, "deltamath");   // keeps where it was assigned
    assert.equal(await p.$$eval("#cu > .abs-warn", (x) => x.length), 0);
    await mon.locator("button:has-text('Undo')").click(); assert.equal((await p.evaluate(() => window.__saved))[3].data.kids["ben-k"].d["2026-11-16"].st, "");
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(wide <= 0, tag + " no sideways scroll");
    const small = await p.$$eval(".cu-day .btn, .cu-route", (b) => b.filter((x) => x.getBoundingClientRect().height < 44).length); assert.equal(small, 0, tag + " tap targets 44px");
    const bad = await p.evaluate(() => {
        const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number), f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
        const bg = (n) => { for (let e = n; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba?\(.*,\s*0\)$/.test(c) && c !== "transparent") return c; } return "rgb(255,255,255)"; };
        return [...document.querySelectorAll("#cu h1, #cu h2, #cu h3, .cu-lead, .abs-line, .cu-paper b, .cu-route b, .cu-route span, .cu-hint")].filter((n) => { const a = lum(getComputedStyle(n).color), b = lum(bg(n)), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); return r < 4.5; }).map((n) => n.tagName + "." + n.className + ":" + n.textContent.slice(0, 20));
    });
    assert.deepEqual(bad, [], tag + " low-contrast: " + bad.join(", "));
    await p.screenshot({ path: `${OUT}/catchup-${tag}.png`, fullPage: true }); await ctx.close();
}
await browser.close(); assert.deepEqual(logs, [], logs.join("\n")); console.log("catch-up page: all checks passed");
