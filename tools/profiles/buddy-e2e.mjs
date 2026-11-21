// Student characters (js/buddy.js) in Vault Raid, end to end against the Firebase emulators: dress-up studio,
// the Remote checking earned pieces, the look saved to the profile and remembered next game, the board podium.
// Needs: firebase emulators (firestore 8080, auth 9099) for project steers-class-board, the repo served at 127.0.0.1:5000,
// and the firebase@12.1.0 npm package (FIREBASE_SDK=path/to/node_modules/firebase/). Run: node tools/profiles/buddy-e2e.mjs <shots dir>
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
    await F.setDoc(d("games/room"), { v: 1, status: "none", at: Date.now() });
    await F.setDoc(d("rosters/all"), { periods: { "1st": ["Ava R.", "Ben T.", "Cara L.", "Dev P."] }, at: Date.now() });
    await F.setDoc(d("games/index"), { sets: [{ id: "t1", title: "Profile test" }], at: Date.now() });
    const clue = (q) => ({ p: 100, q, a: "5" });
    await F.setDoc(d("games/s_t1"), { id: "t1", title: "Profile test", cats: [{ n: "AL 8.11a", clues: [clue("2x = 10. x = ?"), clue("x + 1 = 6. x = ?"), clue("3x = 15. x = ?")] }, { n: "AL 8.4", clues: [clue("√25 = ?"), clue("∛125 = ?")] }], final: null, at: Date.now() });
    // Ava already has 4 right on 8.11 from an earlier day: one more right today cracks the lock.
    await F.setDoc(d("profiles/1st"), { v: 1, per: "1st", at: Date.now(), kids: { "ava-r": { nm: "Ava R.", xp: 260, bank: 40, sp: 0, g: 1, ld: "2026-11-17", fx: 0, tr: 0, b: [], best: { c: 50, acc: 0, st: 4 }, av: 8, t: { "s-8-11": { l: "8.11", a: 4, r: 4, tr: 0, h: "1111", d: 1, rd: "2026-11-17", w: { "2026-W47": [4, 4] } } } } } });
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

// ---------- students ----------
async function student(name, w, h) {
    const c = await ctx(w || 1280, h || 860), p = await c.newPage(); watch(p, name);
    await p.goto(BASE + "/play.html?emu&code=" + code);
    return { c, p };
}
async function joinAs(p, name, shot) {
    await p.waitForSelector(".pname, .pme", { timeout: 20000 });
    if (await p.locator(".pme").count()) await p.click("text=That's me, let's go"); else await p.click(".pname >> text=" + name);
    await p.waitForSelector(".pkeys");
    if (shot) await p.screenshot({ path: OUT + "/" + shot + "-vault-step.png" });
    for (const d of ["1", "2", "3"]) await p.click(".pkey >> text=" + d);
    await p.click("text=Join the game");
    await p.waitForSelector(".wroom", { timeout: 20000 });
    await sleep(1200);
}
const ava = await student("Ava"), ben = await student("Ben", 390, 844), guest = null;
await joinAs(ava.p, "Ava R.", "ava"); await joinAs(ben.p, "Ben T.", "ben");
await ava.p.screenshot({ path: OUT + "/ava-waiting-room.png", fullPage: true });
await ben.p.screenshot({ path: OUT + "/ben-waiting-room-phone.png", fullPage: true });
// ---------- the dress-up studio ----------
await ava.p.waitForSelector("#wrfig svg.bd");
await ava.p.screenshot({ path: OUT + "/ava-studio.png", fullPage: true });
await ava.p.click(".wrtab >> text=Top"); await ava.p.click(".wrtile[aria-label='Jacket']");
await ava.p.click(".wrswatch[aria-label='Purple']");
console.log("jacket open at 260 XP:", await ava.p.locator(".wrtile[aria-label='Jacket']").isEnabled(), "math tee locked:", !(await ava.p.locator(".wrtile[aria-label^='Math tee']").isEnabled()));
await ava.p.click(".wrtab >> text=Hat"); await ava.p.click(".wrtile[aria-label='Cap']");
console.log("crown locked:", !(await ava.p.locator(".wrtile[aria-label^='Crown']").isEnabled()));
await ava.p.click(".wrtab >> text=Glasses"); await ava.p.click(".wrtile[aria-label='Shades']");
await ava.p.click(".wrtab >> text=Bottoms"); await ava.p.click(".wrtile[aria-label='Shorts']");
await ava.p.click(".wrmove >> text=Dance"); await sleep(450);
await ava.p.screenshot({ path: OUT + "/ava-studio-dance.png" });
await sleep(1500);
await ben.p.click(".wrtab >> text=Hair"); await sleep(200);
await ben.p.screenshot({ path: OUT + "/ben-studio-phone.png", fullPage: true });
// What the Remote accepted (the student's own screen doc).
const lkOf = (p) => p.evaluate(() => [...document.querySelectorAll(".wrtile.on")].map((b) => b.getAttribute("aria-label")).join(", "));
console.log("ava picks on screen:", await lkOf(ava.p));
// A crown sent straight to the database (not earned) is swapped back by the Remote.
await ava.p.evaluate(async (c) => {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js");
    const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const app = getApps().find((a) => a.name === "play"), uid = getAuth(app).currentUser.uid, db = F.getFirestore(app);
    await F.setDoc(F.doc(db, "rooms", c, "p", uid), { at: Date.now(), lk: "s0h0c0e0m0t0u0b0v0f0w0a6k0g0x0" }, { merge: true });
}, code);
await sleep(2500);
const hostView = await t.evaluate(async (c) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); const q = await F.getDocs(F.collection(db, "rooms", c, "s")); return q.docs.map((d) => [d.data().nm, d.data().lk]); }, code);
console.log("host looks:", JSON.stringify(hostView));
// A look that breaks the rules is refused by the database.
const bad = await ava.p.evaluate(async (c) => {
    const { getApps } = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js");
    const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const app = getApps().find((a) => a.name === "play"), uid = getAuth(app).currentUser.uid, db = F.getFirestore(app);
    try { await F.setDoc(F.doc(db, "rooms", c, "p", uid), { at: Date.now(), lk: "<script>" }, { merge: true }); return "accepted"; } catch (e) { return e.code; }
}, code);
console.log("bad look write:", bad);
// put a good look back
await ava.p.click(".wrtab >> text=Hat"); await ava.p.click(".wrtile[aria-label='Beanie']"); await sleep(1500);
await t.click("text=Start the game"); await sleep(2000);

async function answer(p, val, shot) {
    try { await p.waitForSelector("form.pform.ans", { timeout: 15000 }); } catch (e) { await p.screenshot({ path: OUT + "/FAIL.png", fullPage: true }); console.log("FAIL text:", (await p.textContent("main")).slice(0, 300)); console.log(logs.join("\n")); throw e; }
    const inp = p.locator("form.pform.ans input").first(); await inp.fill(val);
    await p.click("form.pform.ans button[type=submit]");
    await sleep(1200); if (shot) await p.screenshot({ path: OUT + "/" + shot + ".png" });
    const next = p.locator("button", { hasText: /Next question|Keep going|Next|Try again/ }).first();
    if (await next.count()) await next.click().catch(() => {});
    await sleep(500);
}
await answer(ava.p, "5", "ava-right-cheer"); for (let i = 0; i < 3; i++) await answer(ava.p, "5");

await answer(ben.p, "4", "ben-miss-oops-phone"); // miss → hint and retry
await answer(ben.p, "5"); // fix
await answer(ben.p, "5");
// end the game (two taps)
await t.click("text=End the game"); await t.click("text=Tap again to end");
await sleep(4000);
await ava.p.screenshot({ path: OUT + "/ava-game-over.png", fullPage: true });
await ben.p.screenshot({ path: OUT + "/ben-game-over-phone.png", fullPage: true });
console.log("ava done screen:", (await ava.p.textContent("main")).match(/Saved to your profile|Lock cracked: [^!]+!|\+\d+ XP|New badge: [^.]+/g));
const prof = await t.evaluate(async (u) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); return (await F.getDoc(F.doc(db, "teacher/" + u + "/profiles/1st"))).data(); }, uid);
for (const [k, v] of Object.entries(prof.kids)) console.log(k, "xp", v.xp, "bank", v.bank, "g", v.g, "fx", v.fx, "badges", v.b, "topics", Object.fromEntries(Object.entries(v.t).map(([a, b]) => [a, b.r + "/" + b.a + (b.m ? " cracked" : "")])));
console.log("saved looks:", JSON.stringify(Object.fromEntries(Object.entries(prof.kids).map(([k, v]) => [k, v.lk]))));
const bp = await t.context().newPage(); watch(bp, "board"); await bp.setViewportSize({ width: 1600, height: 900 });
await bp.goto(BASE + "/board.html?emu"); await sleep(6000);
await bp.screenshot({ path: OUT + "/board-podium.png" });
console.log("podium characters:", await bp.locator(".vrpod svg.bd").count());
await bp.close();

// ---------- next game: the Chromebook remembers ----------
await t.locator("button.gpend", { hasText: "Close the room" }).click(); await sleep(500);
const cl = t.locator("text=Tap again to close"); if (await cl.count()) await cl.click();
await sleep(2500);
await t.screenshot({ path: OUT + "/remote-closed.png" });
await t.goto(BASE + "/remote.html?emu&screen=live&period=1st&vset=t1");
await t.waitForSelector("text=Open the room", { timeout: 20000 });
await t.click("text=Open the room"); await t.waitForSelector("text=Start the game", { timeout: 20000 });
const code2 = await t.evaluate(async (u) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); return (await F.getDoc(F.doc(db, "teacher/" + u + "/games/room"))).data().code; }, uid);
await ava.p.goto(BASE + "/play.html?emu&code=" + code2);
await ava.p.waitForSelector(".pme", { timeout: 20000 });
await ava.p.screenshot({ path: OUT + "/ava-playing-as.png" });
console.log("remembered:", (await ava.p.textContent(".pme")).replace(/\s+/g, " "), "character shown:", await ava.p.locator(".pme svg.bd").count());
await joinAs(ava.p, "Ava R.", "ava2");
await ava.p.screenshot({ path: OUT + "/ava-waiting-room-2.png", fullPage: true });
console.log("ava lobby 2:", (await ava.p.textContent(".wrhead")).replace(/\s+/g, " ").slice(0, 160));

console.log("ERRORS:\n" + (logs.filter((l) => !/favicon|fonts|404/.test(l)).join("\n") || "none"));
await browser.close();
