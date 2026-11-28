// Plan the Week: "Fill every day: 2 new + 2 review" against the Firebase emulators. Made-up data only.
// Needs what tools/acap/ready-e2e.mjs needs. Run: node tools/acap/plan-e2e.mjs <shots dir>
import assert from "node:assert/strict";
import fs from "node:fs";
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
const BASE = "http://127.0.0.1:5000", FB = process.env.FIREBASE_SDK || "./node_modules/firebase/", OUT = process.argv[2] || "./shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] });
const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await c.route(/gstatic\.com\/firebasejs\/12\.1\.0\/(.*)$/, (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ path: FB + f, contentType: "text/javascript" }); });
await c.route(/\/__t\.html/, (r) => r.fulfill({ body: "<!doctype html><title>t</title>", contentType: "text/html" }));
await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: "", contentType: "text/css" }));
const t = await c.newPage(); const logs = [];
t.on("pageerror", (e) => logs.push("PAGEERROR " + e.message)); t.on("console", (m) => { if (m.type() === "error") logs.push(m.text()); });
await t.goto(BASE + "/__t.html?emu&pack=calera");
await t.evaluate(async () => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teachplan", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    for (const x of (await F.getDocs(F.collection(db, "teacher/" + u + "/plans"))).docs) await F.deleteDoc(x.ref);
    await F.setDoc(d("settings/pack"), { pack: "calera", how: "test", at: Date.now() });
    await F.setDoc(d("games/index"), { sets: [{ id: "spx", title: "Spiral · 8.11 + review · Nov 23", sp: 1, cls: "8th", at: Date.now() }], at: Date.now() });
});
await t.goto(BASE + "/plan.html?emu&pack=calera");
await t.waitForTimeout(6000);
const card = t.locator(".pw-field:has(.pw-lab:text-is('Bellringers for the week'))").first();
console.log("cards:", await t.locator(".pw-field:has(.pw-lab:text-is('Bellringers for the week'))").count());
const btn = card.locator("button.wp-fill"); console.log("disabled:", await btn.isDisabled());
await btn.click(); await t.waitForTimeout(2500);
const card2 = t.locator(".pw-field:has(.pw-lab:text-is('Bellringers for the week'))").first();
console.log("msg:", await card2.locator("small").textContent());
await card2.scrollIntoViewIfNeeded(); await t.waitForTimeout(300);
const box = await card2.boundingBox(); await t.screenshot({ path: OUT + "/plan-fill.png", clip: { x: 0, y: Math.max(0, box.y - 420), width: 1280, height: 620 } });
// open Monday for that class (tap sheet, Nov 26) to see the bellringers
const mon = t.locator(".wp-c .wp-dp").first(); await mon.click(); await t.waitForTimeout(500);   // a day tile opens that day in a sheet
const bells = await t.locator(".pw-drawer").first().locator(".pw-bells li").count(); assert.equal(bells, 4);
assert.match(await card2.locator("small").textContent(), /Added 20 bellringers/);
console.log("monday bells:", await t.locator(".pw-bells li").count(), (await t.locator(".pw-bells").first().textContent()).slice(0, 300));
await t.locator(".pw-drawer").first().screenshot({ path: OUT + "/plan-monday.png" });
console.log(logs.length ? logs.join("\n") : "no page errors"); assert.ok(!logs.some((x) => /PAGEERROR/.test(x)));
await browser.close();
console.log("plan e2e: passed");
