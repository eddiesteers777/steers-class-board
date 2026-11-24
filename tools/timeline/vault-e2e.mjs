// Standards Timeline tray -> Vault Raid question set, against the Firebase emulators. Made-up data only.
// Needs what tools/timeline/timeline-e2e.mjs needs. Run: node tools/timeline/vault-e2e.mjs <shots dir>
import assert from "node:assert/strict";
import fs from "node:fs";
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
const BASE = "http://127.0.0.1:5000", FB = process.env.FIREBASE_SDK || "./node_modules/firebase/", OUT = process.argv[2] || "./shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] });
const c = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
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
    localStorage.removeItem("anchorboard-tl-tray-8th");
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teachtlvr", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    await F.setDoc(d("settings/pack"), { pack: "calera", how: "test", at: Date.now() });
    await F.setDoc(d("games/index"), { sets: [{ id: "old1", title: "Older set", cats: 1, clues: 2, final: false, per: [], at: 1 }], at: 1 });
});
await t.goto(BASE + "/timeline.html?emu&pack=calera&cls=8th"); await t.waitForTimeout(4000);
await t.locator("#tl-8-25 .tl-probs").click(); await t.locator(".tp-btns button", { hasText: "Add to tray" }).click(); await t.keyboard.press("Escape");
await t.locator("#tl-8-26 .tl-probs").click(); await t.locator(".tp-btns button", { hasText: "Add to tray" }).click(); await t.keyboard.press("Escape");
await t.locator(".tp-vr").click(); await t.waitForTimeout(2500);
const msg = await t.locator(".tp-vmsg").textContent(); console.log("message:", msg);
assert.match(msg, /^Saved “Timeline review · 8\.25, 8\.26 · .+” \(\d+ questions in \d+ categories\)/);
await t.screenshot({ path: OUT + "/16-tray-vault-saved.png" });
const idx = await read("games/index"); console.log("index:", idx.sets.map((s) => s.title + " " + s.clues));
assert.equal(idx.sets.length, 2); assert.equal(idx.sets[0].id, "old1", "older set kept");
const meta = idx.sets[1]; assert.equal(meta.tl, 1); assert.equal(meta.cls, "8th");
const doc = await read("games/s_" + meta.id);
const check = await t.evaluate(async (doc) => { const G = await import("/js/games.js"); const s = G.cleanSet(doc); return { n: G.countClues(s), cats: s.cats.map((c) => c.n) }; }, doc);
console.log("as Vault Raid loads it:", check);
assert.equal(check.n, meta.clues); assert.ok(check.cats.every((n) => /^8\.2[56]/.test(n)));
// Changing the tray clears the message.
await t.locator(".tp-rm").first().click(); await t.waitForTimeout(300);
assert.equal(await t.locator(".tp-vmsg").count(), 0);
const bad = logs.filter((l) => !/favicon|ERR_|net::|Failed to load resource/.test(l));
assert.deepEqual(bad, [], "page errors"); await browser.close(); console.log("vault e2e: passed");
