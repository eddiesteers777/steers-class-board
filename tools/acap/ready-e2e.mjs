// ACAP readiness + Work on next, end to end against the Firebase emulators. Made-up names only.
// Needs: firebase emulators (firestore 8080, auth 9099) for project steers-class-board, the repo served at 127.0.0.1:5000,
// and the firebase@12.1.0 npm package (FIREBASE_SDK=path/to/node_modules/firebase/). Run: node tools/acap/ready-e2e.mjs <shots dir>
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5000", FB = process.env.FIREBASE_SDK || "./node_modules/firebase/", OUT = process.argv[2] || "./shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] });
async function ctx(w = 1280, h = 900) {
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    await c.route(/gstatic\.com\/firebasejs\/12\.1\.0\/(.*)$/, (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ path: FB + f, contentType: "text/javascript" }); });
    await c.route(/\/__t\.html/, (r) => r.fulfill({ body: "<!doctype html><title>t</title>", contentType: "text/html" }));
    await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: "", contentType: "text/css" }));
    return c;
}
const logs = [];
const watch = (p, tag) => { p.on("console", (m) => { if (m.type() === "error") logs.push(tag + ": " + m.text()); }); p.on("pageerror", (e) => logs.push(tag + " PAGEERROR: " + e.message)); };

// ---------- teacher: a roster and two scored sets for 2nd period (8th) ----------
const T = await ctx(); const t = await T.newPage(); watch(t, "teacher");
await t.goto(BASE + "/__t.html?emu&pack=calera");
await t.evaluate(async () => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teachacap", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    await F.setDoc(d("asg/index"), { list: [], at: Date.now() });   // a fresh week of extra credit on every run
    await F.setDoc(d("settings/pack"), { pack: "calera", how: "test", at: Date.now() });
    await F.setDoc(d("standards/progress"), { "8th": { "8.5": { s: "taught" }, "8.4": { s: "taught" }, "8.20": { s: "teaching" } } });
    await F.setDoc(d("rosters/all"), { periods: { "2nd": ["Ava R.", "Ben S.", "Cam T."] }, at: Date.now() });
    const imp = (id, std, date, rows) => ({ id, title: "Exit ticket " + std, std, skill: "", date, source: "Test", period: "2nd", items: ["Q1-4"], rows, at: Date.parse(date) });
    await F.setDoc(d("data/i_x1"), imp("x1", "8.5", "2026-11-16", [{ s: "Ava R.", v: [0.9] }, { s: "Ben S.", v: [0.25] }, { s: "Cam T.", v: [0.6] }]));
    await F.setDoc(d("data/i_x2"), imp("x2", "8.20", "2026-11-18", [{ s: "Ava R.", v: [0.7] }, { s: "Ben S.", v: [0.75] }, { s: "Cam T.", v: [0.3] }]));
    await F.setDoc(d("data/index"), { imports: [{ id: "x1", period: "2nd", title: "Exit ticket 8.5", date: "2026-11-16" }, { id: "x2", period: "2nd", title: "Exit ticket 8.20", date: "2026-11-18" }], at: Date.now() });
});
await t.goto(BASE + "/progress.html?emu&pack=calera");
await t.waitForSelector("#periodTabs button[data-k='2nd']", { timeout: 30000 });
await t.click("#periodTabs button[data-k='2nd']"); await t.click('#views button[data-v="ready"]');
await t.waitForSelector(".rdGrid", { timeout: 20000 });
await t.screenshot({ path: OUT + "/1-readiness.png", fullPage: true });
const grid = await t.textContent(".rdGrid"); assert.match(grid, /Ben S\./);
// Ben: Not Yet on 8.5 (25%) -> first suggestion 8.5 (NAF has 29/17 = 1.7 pts a standard, DSP 6/4 = 1.5)
await t.click(".rdGrid .pgName:has-text('Ben S.')");
await t.waitForSelector(".rdNext h3");
assert.match(await t.textContent(".rdNext h3"), /^8\.5/);
await t.screenshot({ path: OUT + "/2-ben-work-on-next.png" });
await t.click("text=Approve practice");
await t.waitForFunction(() => /Code \d{6}/.test(document.querySelector(".rdMsg").textContent), null, { timeout: 20000 });
const code = (await t.textContent(".rdMsg")).match(/Code (\d{6})/)[1];
console.log("assigned", code);
await t.screenshot({ path: OUT + "/3-ben-approved.png" });
await t.click("#kid .btn.ghost:has-text('Close')");
// Cam: extra credit, then the extra credit button is used up for the week.
await t.click(".rdGrid .pgName:has-text('Cam T.')"); await t.waitForSelector(".rdNext h3");
await t.click("text=Approve as extra credit");
await t.waitForFunction(() => /Code \d{6}/.test(document.querySelector(".rdMsg").textContent), null, { timeout: 20000 });
await t.click("#kid .btn.ghost:has-text('Close')");
await t.click(".rdGrid .pgName:has-text('Cam T.')"); await t.waitForSelector(".rdNext h3");
assert.ok(await t.$("button:has-text('Extra credit used this week')"), "one extra credit a week");
await t.screenshot({ path: OUT + "/4-cam-xc-used.png" });

// ---------- student: only Ben's name shows, no "My name isn't here" ----------
const S = await ctx(390, 844); const s = await S.newPage(); watch(s, "student");
await s.goto(BASE + "/do.html?emu&c=" + code);
await s.waitForSelector(".pname", { timeout: 30000 });
const names = await s.$$eval(".pname", (b) => b.map((x) => x.textContent));
console.log("student sees", names);
assert.deepEqual(names, ["Ben S."]);
assert.equal(await s.$("text=My name isn't here"), null);
await s.screenshot({ path: OUT + "/5-student-names.png" });

// ---------- the checks: a Friday check on the standard marked Teaching, assigned to 2nd period ----------
await t.goto(BASE + "/progress.html?emu&pack=calera");
await t.waitForSelector("#periodTabs button[data-k='2nd']", { timeout: 30000 });
await t.click("#periodTabs button[data-k='2nd']"); await t.click('#views button[data-v="ready"]');
await t.waitForSelector(".rdCheck", { timeout: 20000 });
await t.click(".rdCheck:nth-child(1) button");   // Monday diagnostic
const diag = await t.$$eval(".rdSlots li", (l) => l.map((x) => x.querySelector(".rdRole").textContent + " " + x.querySelector("select").value));
console.log("diagnostic", diag);
assert.deepEqual(diag.filter((x) => x.startsWith("New")).map((x) => x.split(" ").pop()), ["8.20", "8.20", "8.20"]);
assert.equal(diag.filter((x) => x.startsWith("Earlier")).length, 2);
for (const p of ["1st", "4th"]) { const box = t.locator(".rdPers label", { hasText: p }).locator("input"); if (await box.isChecked()) await box.uncheck(); }
await t.click("text=Approve and assign");
await t.waitForFunction(() => /Code \d{6}/.test((document.querySelector(".rdBuild .rdMsg") || {}).textContent || ""), null, { timeout: 20000 });
const dmsg = await t.textContent(".rdBuild .rdMsg"); console.log(dmsg); const dcode = dmsg.match(/Code (\d{6})/)[1];
assert.match(dmsg, /for 2nd period/);
await t.screenshot({ path: OUT + "/7-checks.png" });
const s2 = await S.newPage(); watch(s2, "student2");
await s2.goto(BASE + "/do.html?emu&c=" + dcode); await s2.waitForSelector(".pname", { timeout: 30000 });
assert.deepEqual(await s2.$$eval(".pname", (b) => b.map((x) => x.textContent)), ["Ava R.", "Ben S.", "Cam T."]);

// ---------- Assignments list shows the chips; Grades offers the extra credit ----------
await t.goto(BASE + "/assign.html?emu&pack=calera"); await t.waitForSelector(".asCard", { timeout: 30000 });
const list = await t.textContent(".asList"); assert.match(list, /For Ben S\./); assert.match(list, /Extra credit/);
await t.screenshot({ path: OUT + "/6-assignments.png" });

console.log(logs.length ? logs.join("\n") : "no page errors");
await browser.close();
console.log("ready e2e: passed");
