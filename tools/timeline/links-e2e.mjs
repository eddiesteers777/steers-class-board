// Standards Timeline builds-on + floor skills, in ?demo (nothing saved). Needs the repo served at 127.0.0.1:5000.
// Run: node tools/timeline/links-e2e.mjs
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; fs.mkdirSync("./shots", { recursive: true });
const b = await chromium.launch(); const errs = [];
const c = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
await c.route(/fonts\.(googleapis|gstatic)/, (r) => r.fulfill({ body: "", contentType: "text/css" }));
const p = await c.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://127.0.0.1:5000/timeline.html?demo"); await p.waitForTimeout(2500);
console.log("8.25 links:", await p.locator("#tl-8-25 .tl-links").textContent());
await p.locator("#tl-8-25").scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 200));
await p.screenshot({ path: "./shots/l1-cards.png" });
await p.locator("#tl-8-25 .tl-text").click(); await p.waitForTimeout(300);
console.log("panel links:", await p.locator(".tp-links").textContent());
await p.locator(".tp-edit").click(); await p.locator(".tp-fedit label", { hasText: "Combine" }).count().then((n)=>console.log("has combine step?", n));
await p.locator(".tp-fedit label", { hasText: "Add integers" }).locator("input").check(); await p.waitForTimeout(300);
console.log("floors now:", await p.locator("#tl-8-25 .tl-floor").textContent());
await p.screenshot({ path: "./shots/l2-panel-edit.png" });
await p.locator(".tp-links .tl-fchip", { hasText: "Two-step" }).click(); await p.waitForTimeout(300);
console.log("floor panel:", (await p.locator(".tp-panel").textContent()).slice(0, 220));
await p.locator(".tp-btns button", { hasText: "Show answer" }).click();
await p.locator(".tp-btns button", { hasText: "Add to tray" }).click();
await p.screenshot({ path: "./shots/l3-floor.png" });
await p.keyboard.press("Escape"); await p.locator(".tp-ttog").click();
console.log("tray:", await p.locator(".tp-tray").textContent());
// Drag 8.25 to top of lane 1: warning
await p.locator("#tl-8-25 .tl-handle").focus(); for (let i = 0; i < 8; i++) await p.keyboard.press("ArrowUp"); await p.waitForTimeout(300);
console.log("warning:", await p.locator("#tl-8-25 .tl-links .pl-chip").textContent().catch(() => "none"));
console.log("next item:", await p.locator(".tl-nneeds").first().textContent());
await p.locator(".tp-tray .btn", { hasText: "Make assignment" }).click(); await p.waitForTimeout(3000);
console.log("assign:", (await p.locator(".asIn").textContent()).slice(0, 160), "|", await p.locator(".asEst").textContent());
console.log("errors:", errs); await b.close(); if (errs.length) process.exit(1); console.log("links e2e: passed");
