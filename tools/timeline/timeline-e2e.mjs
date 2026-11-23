// Standards Timeline against the Firebase emulators: marks shared with the Standards page, order saved, no page errors.
// Needs what tools/acap/ready-e2e.mjs needs (emulators + hosting on 5000, firebase@12.1.0 at FIREBASE_SDK).
// Run: node tools/timeline/timeline-e2e.mjs <shots dir>
import assert from "node:assert/strict";
import fs from "node:fs";
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
const BASE = "http://127.0.0.1:5000", FB = process.env.FIREBASE_SDK || "./node_modules/firebase/", OUT = process.argv[2] || "./shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] });
const c = await browser.newContext({ viewport: { width: 1440, height: 1500 }, deviceScaleFactor: 2 });
await c.route(/gstatic\.com\/firebasejs\/12\.1\.0\/(.*)$/, (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ path: FB + f, contentType: "text/javascript" }); });
await c.route(/\/__t\.html/, (r) => r.fulfill({ body: "<!doctype html><title>t</title>", contentType: "text/html" }));
await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: "", contentType: "text/css" }));
const t = await c.newPage(); const logs = [];
t.on("pageerror", (e) => logs.push("PAGEERROR " + e.message)); t.on("console", (m) => { if (m.type() === "error") logs.push(m.text()); });
const read = (p) => t.evaluate(async (p) => {
    const { auth, db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const s = await F.getDoc(F.doc(db, "teacher/" + auth.currentUser.uid + "/" + p)); return s.exists() ? s.data() : null;
}, p);
await t.goto(BASE + "/__t.html?emu&pack=calera");
await t.evaluate(async () => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teachtl", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    await F.setDoc(d("settings/pack"), { pack: "calera", how: "test", at: Date.now() });
    await F.deleteDoc(d("standards/timeline"));
    const taught = { s: "taught", d: "2026-10-01" };
    await F.setDoc(d("standards/progress"), { "8th": { "8.1": taught, "8.2": taught, "8.4": taught, "8.3": taught, "8.5": taught, "8.6": taught, "8.11": taught, "8.13": { s: "teaching", d: "2026-11-12" } }, "7th": { "7.4": taught, "7.5": { s: "teaching", d: "2026-11-20", by: "Anchor" } } });
});
await t.goto(BASE + "/timeline.html?emu&pack=calera&cls=8th"); await t.waitForTimeout(4000);
assert.equal(await t.locator(".tl-card").count(), 30);
assert.equal(await t.locator("#status").textContent(), "Live");
assert.match(await t.locator("#next").textContent(), /Left open earlier in the timeline: 8\.25, 8\.26, 8\.27, 8\.28/);
assert.equal(await t.locator("#tl-8-14").locator("..").getAttribute("data-lane"), "2");
await t.screenshot({ path: OUT + "/1-timeline-8th.png" });
// Mark 8.25 Teaching from the Timeline; the Standards page sees it.
await t.locator("#tl-8-25 .tl-pill").click(); await t.locator("#tl-8-25 .m-teaching").click(); await t.waitForTimeout(1500);
assert.equal(((await read("standards/progress"))["8th"]["8.25"] || {}).s, "teaching");
assert.equal((await read("standards/progress"))["7th"]["7.5"].by, "Anchor", "other marks kept as they were");
// Drag 8.24 from the 4th nine weeks up to the end of the 2nd.
await t.setViewportSize({ width: 1440, height: 2400 }); await t.evaluate(() => scrollTo(0, 0));
const h = await t.locator("#tl-8-24 .tl-handle").boundingBox(), to = await t.locator("#tl-8-28").boundingBox();
await t.mouse.move(h.x + 10, h.y + 10); await t.mouse.down(); await t.mouse.move(to.x + 60, to.y + to.height + 14, { steps: 14 });
await t.screenshot({ path: OUT + "/2-dragging.png" });
await t.mouse.up(); await t.waitForTimeout(1500);
console.log("dom lane2:", await t.locator(".tl-list[data-lane=\"1\"] .tl-card").evaluateAll((n) => n.map((x) => x.dataset.code).join(",")), await t.locator("#status").textContent(), await t.locator("#orderNote").textContent());
const saved = await read("standards/timeline");
assert.deepEqual(saved["8th"].lanes.q2, ["8.25", "8.26", "8.27", "8.28", "8.24"]);
assert.equal(Object.values(saved["8th"].lanes).flat().length, 30);
await t.screenshot({ path: OUT + "/3-after-drag.png" }); await t.setViewportSize({ width: 1440, height: 1500 });
// The Standards page: still district order, sees the new mark, its own Next up unchanged in kind.
await t.goto(BASE + "/standards.html?emu&pack=calera&cls=8th"); await t.waitForTimeout(3500);
assert.equal(await t.locator("#s-8-25 .m-teaching").getAttribute("aria-pressed"), "true");
const units = await t.locator(".st-unit .st-uno").allTextContents(); assert.equal(units[0], "Topic 1A"); assert.equal(units.at(-2), "Topic 7");
assert.ok(await t.locator("a[href='timeline.html']").count());
// Reset (two taps) puts the locked order back.
await t.goto(BASE + "/timeline.html?emu&pack=calera&cls=8th"); await t.waitForTimeout(3500);
assert.ok(!(await t.locator("#reset").isHidden()));
await t.locator("#reset").click(); await t.locator("#reset").click(); await t.waitForTimeout(1500);
assert.equal((await read("standards/timeline"))["8th"], undefined);
// Floor skills: change 8.25's on the side panel; it saves to standards/floors.
await t.locator(".pl-seg button", { hasText: "8th Grade" }).click(); await t.waitForTimeout(300);
await t.locator("#tl-8-25 .tl-text").click(); await t.locator(".tp-edit").click();
await t.locator(".tp-fedit label", { hasText: "Add integers" }).locator("input").check(); await t.waitForTimeout(1500);
assert.deepEqual((await read("standards/floors"))["8th"]["8.25"], ["F:eq2", "F:intAdd"]);
await t.keyboard.press("Escape");
// 7th and 8th Acc.
await t.locator(".pl-seg button", { hasText: "7th Grade" }).click(); await t.waitForTimeout(300);
assert.equal(await t.locator(".tl-card").count(), 22);
await t.screenshot({ path: OUT + "/4-timeline-7th.png" });
await t.locator(".pl-seg button", { hasText: "8th Accelerated" }).click(); await t.waitForTimeout(300);
assert.equal(await t.locator(".tl-card").count(), 71);
// Phone width: no sideways scroll.
await t.setViewportSize({ width: 390, height: 844 }); await t.locator(".pl-seg button", { hasText: "8th Grade" }).click(); await t.waitForTimeout(300);
assert.ok(await t.evaluate(() => document.documentElement.scrollWidth <= 390));
await t.screenshot({ path: OUT + "/5-phone.png" });
console.log(logs.length ? logs.join("\n") : "no page errors"); assert.ok(!logs.some((x) => /PAGEERROR/.test(x)));
await browser.close();
console.log("timeline e2e: passed");
