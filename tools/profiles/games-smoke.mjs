// Ring Race with named teams credits student profiles (and the other team games load), against the Firebase emulators.
// Needs: firebase emulators (firestore 8080, auth 9099) for project steers-class-board, the repo served at 127.0.0.1:5000,
// and the firebase@12.1.0 npm package (FIREBASE_SDK=path/to/node_modules/firebase/). Run: node tools/profiles/prof-e2e.mjs <shots dir>
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
import fs from "node:fs";
const BASE = "http://127.0.0.1:5000", FB = process.env.FIREBASE_SDK || "./node_modules/firebase/", OUT = process.argv[2] || "./shots";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] });
async function ctx(w = 1280, h = 860) {
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    await c.route(/gstatic\.com\/firebasejs\/12\.1\.0\/(.*)$/, (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ path: FB + f, contentType: "text/javascript" }); });
    await c.route(/\/__t\.html/, (r) => r.fulfill({ body: "<!doctype html><title>t</title>", contentType: "text/html" }));
    await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: "", contentType: "text/css" }));
    return c;
}
const logs = [];
const watch = (p, tag) => { p.on("console", (m) => { if (m.type() === "error") logs.push(tag + ": " + m.text()); }); p.on("pageerror", (e) => logs.push(tag + " PAGEERROR: " + e.message)); };

// ---------- teacher ----------
const T = await ctx(); const t = await T.newPage(); watch(t, "teacher");
await t.goto(BASE + "/__t.html?emu");
const uid = await t.evaluate(async () => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teach1", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    await F.setDoc(d("games/live_1st"), { v: 0, ended: Date.now() });
    await F.setDoc(d("games/room"), { v: 1, status: "none", at: Date.now() });
    await F.setDoc(d("rosters/all"), { periods: { "1st": ["Ava R.", "Ben T.", "Cara L.", "Dev P."] }, at: Date.now() });
    await F.setDoc(d("games/index"), { sets: [{ id: "t1", title: "Profile test" }], at: Date.now() });
    const clue = (q) => ({ p: 100, q, a: "5" });
    await F.setDoc(d("games/s_t1"), { id: "t1", title: "Profile test", cats: [{ n: "AL 8.11a", clues: [clue("2x = 10. x = ?"), clue("x + 1 = 6. x = ?"), clue("3x = 15. x = ?")] }, { n: "AL 8.4", clues: [clue("√25 = ?"), clue("∛125 = ?")] }], final: null, at: Date.now() });
    // Ava already has 4 right on 8.11 from an earlier day: one more right today cracks the lock.
    await F.setDoc(d("profiles/1st"), { v: 1, per: "1st", at: Date.now(), kids: { "ava-r": { nm: "Ava R.", xp: 60, bank: 40, sp: 0, g: 1, ld: "2026-11-17", fx: 0, tr: 0, b: [], best: { c: 50, acc: 0, st: 4 }, av: 8, t: { "s-8-11": { l: "8.11", a: 4, r: 4, tr: 0, h: "1111", d: 1, rd: "2026-11-17", w: { "2026-W47": [4, 4] } } } } } });
    return u;
});
console.log("teacher uid", uid);
await t.goto(BASE + "/remote.html?emu&screen=live&period=1st&vset=t1");
await t.waitForSelector("text=Open the room", { timeout: 30000 });
// keep it simple for the test: no pad work required, no step help
for (const label of ["Students must show work before they can submit", "Step-by-step help after a miss"]) { const l = t.locator("label.gpchk", { hasText: label }); if (await l.count()) { await l.locator("input").evaluate((n) => { if (n.checked) n.click(); }); } }
await t.click("text=Open the room");
await t.waitForSelector("text=Start the game", { timeout: 20000 });
const code = await t.evaluate(async (u) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); return (await F.getDoc(F.doc(db, "teacher/" + u + "/games/room"))).data().code; }, uid);
console.log("room", code);


await t.goto(BASE + "/remote.html?emu&screen=game&period=1st&set=t1&game=race"); await sleep(5000);
// name the teams the way "Use the Group maker's groups" does (roster lines in t.m)
await t.evaluate(async (u) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
  const r = F.doc(db, "teacher/" + u + "/games/live_1st"), g = (await F.getDoc(r)).data();
  g.teams = [{ n: "Group 1", s: 0, m: ["Cara L.", "Dev P."] }, { n: "Group 2", s: 0, m: ["Ben T."] }]; await F.setDoc(r, g); }, uid);
await sleep(2500);
for (let q = 0; q < 5; q++) {
  await t.locator("button.gpteam", { hasText: "Group 1" }).first().click(); await sleep(300);
  if (q % 2) { await t.locator("button.gpteam", { hasText: "Group 2" }).first().click(); await sleep(300); }
  try { await t.locator("button", { hasText: /^Move \d teams?$/ }).click({ timeout: 5000 }); } catch (e) { console.log("q", q); await t.screenshot({ path: OUT + "/race-fail.png" }); throw e; } await sleep(500);
  await t.locator("button.btn.go", { hasText: /Next question|Show the final scores/ }).click(); await sleep(700);
}
await sleep(3000);
await t.screenshot({ path: OUT + "/game-race-done.png" });
const prof = await t.evaluate(async (u) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); return (await F.getDoc(F.doc(db, "teacher/" + u + "/profiles/1st"))).data(); }, uid);
for (const [k, v] of Object.entries(prof.kids)) console.log(k, "xp", v.xp, "bank", v.bank, "g", v.g, "tr", v.tr, "topics", Object.fromEntries(Object.entries(v.t).map(([a, b]) => [a, b.r + "/" + b.a + " team " + (b.tr||0)])));
console.log("panel:", (await t.textContent("body")).match(/Added to student profiles[^.]*\.|Not added[^.]*\./g));
console.log("ERRORS:\n" + (logs.filter((l) => !/favicon|fonts|404|terminated/.test(l)).join("\n") || "none"));
await browser.close();
