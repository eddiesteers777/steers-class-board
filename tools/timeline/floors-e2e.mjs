// The floor steps added 2026-11-23 show on their cards and open in the picker, in ?demo (nothing saved).
// Needs the repo served at 127.0.0.1:5000. Run: node tools/timeline/floors-e2e.mjs <shots dir>
import assert from "node:assert/strict";
import fs from "node:fs";
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
const OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errs = [];
const c = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
await c.route(/fonts\.(googleapis|gstatic)/, (r) => r.fulfill({ body: "", contentType: "text/css" }));
const p = await c.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://127.0.0.1:5000/timeline.html?demo"); await p.waitForTimeout(2500);
const want = { "8-13": ["Points in all four quadrants", "Input/output tables"], "8-18": ["Range, median and mean"], "8-20": ["Substitute to check", "One-step equations"], "8-22": ["Name polygons and solid figures"] };
for (const [id, names] of Object.entries(want)) {
    const t = await p.locator("#tl-" + id + " .tl-links").textContent(); console.log(id, "|", t);
    names.forEach((n) => assert.ok(t.includes(n), id + " shows " + n));
}
await p.locator("#tl-8-13").scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 200));
await p.screenshot({ path: OUT + "/14-floor-chips-8-13.png" });
await p.locator("#tl-8-13 .tl-text").click(); await p.waitForTimeout(300);
await p.locator(".tp-links .tl-fchip", { hasText: "Points in all four" }).click(); await p.waitForTimeout(300);
await p.locator(".tp-btns button", { hasText: "Show answer" }).click(); await p.waitForTimeout(200);
const panel = await p.locator(".tp-panel").textContent(); console.log("panel:", panel.slice(0, 260));
assert.ok(/quadrant|origin|Reflect|apart/i.test(panel), "a coordinate problem shows");
await p.screenshot({ path: OUT + "/15-floor-coord-panel.png" });
await p.locator(".tp-btns button", { hasText: "Add to tray" }).click(); await p.keyboard.press("Escape");
await p.goto("http://127.0.0.1:5000/timeline.html?demo&cls=7th").catch(() => {}); await p.waitForTimeout(1500);
console.log("errors:", errs); await b.close(); assert.deepEqual(errs, []); console.log("floors e2e: passed");
