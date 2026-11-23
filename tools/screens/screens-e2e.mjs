// Show the board on another screen (tv.html + link.html), end to end against the Firebase emulators:
// the TV gets a code, the teacher links it, the TV follows the Remote read only, can't read or write anything else,
// and "Stop showing" sends it back to its code page.
// Needs: firebase emulators (firestore 8080, auth 9099) for project steers-class-board, the repo served at 127.0.0.1:5000,
// and the firebase@12.1.0 npm package (FIREBASE_SDK=path/to/node_modules/firebase/). Run: node tools/screens/screens-e2e.mjs <shots dir>
const PW = await import(process.env.PLAYWRIGHT || "playwright"), chromium = PW.chromium || PW.default.chromium;
import fs from "node:fs";
const BASE = "http://127.0.0.1:5000", FB = process.env.FIREBASE_SDK || "./node_modules/firebase/", OUT = process.argv[2] || "./shots";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] });
async function ctx(w = 1280, h = 860, scale = 1) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await c.route(/gstatic\.com\/firebasejs\/12\.1\.0\/(.*)$/, (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ path: FB + f, contentType: "text/javascript" }); });
    await c.route(/\/__t\.html/, (r) => r.fulfill({ body: "<!doctype html><title>t</title>", contentType: "text/html" }));
    await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: "", contentType: "text/css" }));
    return c;
}
const logs = [], fails = [];
const ok = (cond, what) => { console.log((cond ? "PASS " : "FAIL ") + what); if (!cond) fails.push(what); };
const watch = (p, tag) => { p.on("console", (m) => { if (m.type() === "error") logs.push(tag + ": " + m.text()); }); p.on("pageerror", (e) => logs.push(tag + " PAGEERROR: " + e.message)); };

// ---------- teacher ----------
const T = await ctx(1280, 860, 2); const t = await T.newPage(); watch(t, "teacher");
await t.goto(BASE + "/__t.html?emu");
const uid = await t.evaluate(async () => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teach1", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    await F.setDoc(d("rosters/all"), { periods: { "1st": ["Ava R.", "Ben T."] }, at: Date.now() });
    await F.setDoc(d("grades/1st"), { secret: "grades are private" });
    return u;
});
console.log("teacher uid", uid);
await t.goto(BASE + "/remote.html?emu&screen=agenda&period=1st");
await t.waitForSelector("#status[data-state=ok]", { timeout: 30000 });

// ---------- the TV ----------
const V = await ctx(1920, 1080, 1); const v = await V.newPage(); watch(v, "tv");
await v.goto(BASE + "/tv.html?emu");
await v.waitForFunction(() => /^[A-Z2-9]{3} [A-Z2-9]{3}$/.test(document.getElementById("code").textContent), null, { timeout: 30000 });
const code = (await v.textContent("#code")).replace(" ", "");
console.log("tv code", code);
ok(await v.locator("#qr svg").count() === 1, "TV shows a QR code");
await sleep(400); await v.screenshot({ path: OUT + "/1-tv-code.png" });

// A guest can't claim someone else's code, or read the board before it is linked
const pre = await v.evaluate(async (u) => {
    const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    try { await F.getDocFromServer(F.doc(db, "teacher/" + u + "/board/state")); return "read"; } catch (e) { return e.code; }
}, uid);
ok(pre === "permission-denied", "unlinked TV can't read the board (" + pre + ")");

// ---------- teacher links it (phone size, from the QR link) ----------
const P = await ctx(390, 844, 2); const ph = await P.newPage(); watch(ph, "phone");
await ph.goto(BASE + "/__t.html?emu");
await ph.evaluate(async () => {
    const { auth } = await import("/js/firebase.js"); const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js");
    await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teach1", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
});
await ph.goto(BASE + "/link.html?emu&c=" + code);
await ph.waitForSelector("#codeCard:not([hidden])", { timeout: 20000 });
ok((await ph.inputValue("#codeIn")) === code.slice(0, 3) + " " + code.slice(3), "QR link fills in the code");
await ph.screenshot({ path: OUT + "/2-phone-link.png", fullPage: true });
// a wrong code says so
await ph.fill("#codeIn", "ZZZ999"); await ph.click("#go"); await ph.waitForSelector("#msg[data-s=bad]");
ok(/No screen/.test(await ph.textContent("#msg")), "wrong code: " + (await ph.textContent("#msg")));
await ph.fill("#codeIn", code); await ph.fill("#nameIn", "Back wall TV"); await ph.click("#go");
await ph.waitForSelector("#msg[data-s=ok]", { timeout: 15000 });
ok(true, "linked: " + await ph.textContent("#msg"));

// ---------- the TV opens the board and follows ----------
await v.waitForURL(/board\.html/, { timeout: 20000 });
await v.waitForSelector("body.tvview:not(.syncing)", { timeout: 30000 });
await sleep(2500);
const scr1 = await v.evaluate(() => JSON.parse(localStorage.getItem("school-live:board") || "null")?.d?.screen);
ok(scr1 === "agenda", "TV shows the Remote's screen (" + scr1 + ")");
await v.screenshot({ path: OUT + "/3-tv-board.png" });
ok(await v.locator("#exit").isHidden() && await v.locator(".bnav").isHidden(), "TV hides the board's controls");
ok(await v.locator("#tvFull").count() === 1, "TV offers Full screen");

await ph.screenshot({ path: OUT + "/4-phone-linked-list.png", fullPage: true });
ok(/Back wall TV/.test(await ph.textContent("#list")), "linked screens list shows the TV");

// Remote changes the screen: the TV follows
await t.click("#screens button:has-text('Today')");
await v.waitForFunction(() => JSON.parse(localStorage.getItem("school-live:board") || "null")?.d?.screen === "today", null, { timeout: 15000 }).then(() => ok(true, "TV followed the Remote to Today"), () => ok(false, "TV followed the Remote to Today"));
await sleep(1500); await v.screenshot({ path: OUT + "/5-tv-follows.png" });

// The TV can't write anything or read what the board doesn't show
const sec = await v.evaluate(async (u) => {
    const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const r = {};
    const tryIt = async (k, f) => { try { await f(); r[k] = "allowed"; } catch (e) { r[k] = e.code; } };
    await tryIt("readBoard", () => F.getDocFromServer(F.doc(db, "teacher/" + u + "/board/state")));
    await tryIt("readGrades", () => F.getDocFromServer(F.doc(db, "teacher/" + u + "/grades/1st")));
    await tryIt("writeBoard", () => F.setDoc(F.doc(db, "teacher/" + u + "/board/state"), { screen: "blank" }));
    await tryIt("addLink", () => F.setDoc(F.doc(db, "teacher/" + u + "/tv/someoneelse"), { name: "x" }));
    return r;
}, uid);
console.log(sec);
ok(sec.readBoard === "allowed", "TV can read the board");
ok(sec.readGrades === "permission-denied", "TV can't read grades");
ok(sec.writeBoard === "permission-denied", "TV can't change the board");
ok(sec.addLink === "permission-denied", "TV can't link other screens");

// ---------- Stop showing ----------
await ph.click("#list button:has-text('Stop showing')");
await v.waitForURL(/tv\.html\?ended=1/, { timeout: 20000 }).then(() => ok(true, "Stop showing sends the TV back to its code page"), () => ok(false, "Stop showing sends the TV back to its code page"));
await v.waitForFunction(() => /^[A-Z2-9]{3} [A-Z2-9]{3}$/.test(document.getElementById("code").textContent), null, { timeout: 20000 });
ok(/stopped/.test(await v.textContent("#note")), "TV says it was stopped");
ok((await v.textContent("#code")).replace(" ", "") !== code, "a fresh code after stopping");
await v.screenshot({ path: OUT + "/6-tv-stopped.png" });

// ---------- a teacher's own computer on /tv goes straight to the board ----------
const tv2 = await T.newPage(); await tv2.goto(BASE + "/tv.html?emu");
await tv2.waitForURL(/board\.html/, { timeout: 15000 }).then(() => ok(true, "signed-in teacher on /tv goes to the board"), () => ok(false, "signed-in teacher on /tv goes to the board"));

console.log("\nconsole errors:\n" + logs.filter((l) => !/favicon|ERR_|net::|Failed to load resource|permission-denied|Missing or insufficient/.test(l)).join("\n"));
console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nALL PASSED");
await browser.close();
process.exit(fails.length ? 1 : 0);
