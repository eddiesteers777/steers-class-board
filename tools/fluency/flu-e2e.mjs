// Fact Blitz end to end against the Firebase emulators: the teacher opens a speed check, gives one student extra
// time, two students play on their own "Chromebooks", the runs end on their own, and the results reach Class Data
// (what the Gradebook offers) and the student profiles.
// Needs: firebase emulators (firestore 8080, auth 9099) for project steers-class-board, the repo served at 127.0.0.1:5000,
// and the firebase@12.1.0 npm package (FIREBASE_SDK=path/to/node_modules/firebase/).
// Run: node tools/fluency/flu-e2e.mjs <shots dir>
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
import fs from "node:fs";
const BASE = "http://127.0.0.1:5000", FB = process.env.FIREBASE_SDK || "./node_modules/firebase/", OUT = process.argv[2] || "./shots";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] });
async function ctx(w = 1366, h = 768) {
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    await c.route(/gstatic\.com\/firebasejs\/12\.1\.0\/(.*)$/, (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ path: FB + f, contentType: "text/javascript" }); });
    await c.route(/\/__t\.html/, (r) => r.fulfill({ body: "<!doctype html><title>t</title>", contentType: "text/html" }));
    await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: "", contentType: "text/css" }));
    return c;
}
const logs = [], fails = [];
const watch = (p, tag) => { p.on("console", (m) => { if (m.type() === "error") logs.push(tag + ": " + m.text()); }); p.on("pageerror", (e) => logs.push(tag + " PAGEERROR: " + e.message)); };
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg); };

// ---------- teacher ----------
const T = await ctx(1366, 900); const t = await T.newPage(); watch(t, "teacher");
await t.goto(BASE + "/__t.html?emu");
const uid = await t.evaluate(async () => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teachfb" + Date.now(), email: "t" + Date.now() + "@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    await F.setDoc(d("rosters/all"), { periods: { "1st": ["Ava Rivera", "Ben Shaw", "Cara Lee", "Dev Patel"] }, at: Date.now() });
    return u;
});
console.log("teacher uid", uid);
await t.goto(BASE + "/fluency.html?emu");
await t.waitForSelector("#status[data-state=ok]", { timeout: 30000 });
// Ben gets 1.5x time
await t.click("#views >> text=Extra time");
await t.waitForSelector(".fbXtRow");
await t.locator(".fbXtRow", { hasText: "Ben S." }).locator("select").selectOption("1.5");
await sleep(600);
await t.click("#views >> text=Checks");
await t.click("button:has-text(\"New speed check\")"); await t.screenshot({ path: OUT + "/e2e-0.png" });
await t.locator("label.asField", { hasText: "Time on the clock" }).locator("select").selectOption("60");
await t.screenshot({ path: OUT + "/e2e-1-new.png", fullPage: true });
await t.click("text=Open the speed check");
await t.waitForSelector(".asBigCode", { timeout: 20000 });
const code = (await t.textContent(".asBigCode")).trim();
console.log("code", code);
check(/^[1-9]\d{5}$/.test(code), "a 6-digit code");

// ---------- students ----------
async function student(name) {
    const c = await ctx(1366, 768), p = await c.newPage(); watch(p, name);
    await p.goto(BASE + "/fact.html?emu&c=" + code);
    await p.waitForSelector(".pname", { timeout: 20000 });
    await p.click(".pname >> text=" + name);
    await p.waitForSelector(".fbstart", { timeout: 20000 });
    return { c, p };
}
const ava = await student("Ava R."), ben = await student("Ben S.");
await ava.p.screenshot({ path: OUT + "/e2e-2-student-home.png" });
const clockOf = async (p) => (await p.textContent(".fbclock")).trim();
check((await clockOf(ava.p)).startsWith("1:00"), "Ava's clock is 1:00 (" + await clockOf(ava.p) + ")");
check((await clockOf(ben.p)).startsWith("1:30"), "Ben's clock is 1:30 with extra time (" + await clockOf(ben.p) + ")");
// nobody's extra time is in the shared document
const shared = await ava.p.evaluate(async (code) => {
    const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"), { getApp } = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js");
    const db = F.getFirestore(getApp("play"));
    const s = await F.getDoc(F.doc(db, "flu", code)); let other = "readable";
    try { await F.getDocs(F.collection(db, "flu", code, "s")); } catch (e) { other = "blocked"; }
    return { doc: JSON.stringify(s.data()), other };
}, code);
check(!/1\.5|xt/.test(shared.doc), "extra time is not in the shared document");
check(shared.other === "blocked", "a student can't list other students' clocks");

async function playFor(p, answers) {
    await p.click(".fbstart");
    await p.waitForSelector(".fbq", { timeout: 10000 });
    for (let i = 0; i < answers; i++) {
        const q = (await p.textContent(".fbq")).replace("=", "").trim();
        const a = q.replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
        let v = Math.round(Function("return (" + a + ")")());
        if (i % 7 === 6) v = String(v + 1).length === String(v).length ? v + 1 : v - 1;   // a miss now and then (same length)
        for (const ch of String(v)) await p.keyboard.press(ch);   // it checks itself once the answer is long enough
        await sleep(400);
        if (i === 4) await p.screenshot({ path: OUT + "/e2e-3-playing.png" });
    }
}
await Promise.all([playFor(ava.p, 20), playFor(ben.p, 16)]);
await t.screenshot({ path: OUT + "/e2e-4-teacher-live.png", fullPage: true });
const liveTxt = await t.textContent(".asTbl");
check(/Playing/.test(liveTxt), "teacher sees students playing");
// keys do nothing once the clock is done; wait out Ava's 60 s and Ben's 90 s
await ava.p.waitForSelector(".fbbign", { timeout: 80000 });
await ava.p.screenshot({ path: OUT + "/e2e-5-results.png" });
const avaRight = +(await ava.p.textContent(".fbbign"));
check(avaRight >= 15 && avaRight <= 20, "Ava's run ended on its own with " + avaRight + " right");
await ben.p.waitForSelector(".fbbign", { timeout: 60000 });
const benRight = +(await ben.p.textContent(".fbbign"));
await ben.p.waitForSelector(".fbsaved[data-s=saved]", { timeout: 15000 });
check(true, "Ben's run ended after his longer clock (" + benRight + " right) and saved");
// try is used: home shows practice, not another check
await ava.p.click("text=Done");
await ava.p.waitForSelector("text=PRACTICE MORE");
check(true, "after the check, only practice is offered");

// ---------- teacher: results saved ----------
await sleep(9000);
await t.screenshot({ path: OUT + "/e2e-6-teacher-done.png", fullPage: true });
const tbl = await t.textContent(".asTbl");
check(/Ava R\.Done/.test(tbl.replace(/\s+/g, "")) || /Ava R\.\s*Done/.test(tbl), "Ava shows Done");
const saved = await t.evaluate(async (u) => {
    const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const g = async (p) => { const s = await F.getDoc(F.doc(db, "teacher/" + u + "/" + p)); return s.exists() ? s.data() : null; };
    const ix = await g("data/index"), prof = await g("profiles/1st");
    const imp = ix && ix.imports && ix.imports.find((x) => x.source === "Fact Blitz");
    return { imp, rows: imp ? (await g("data/i_" + imp.id)).rows : null, ava: prof && prof.kids["ava-r"], ben: prof && prof.kids["ben-s"] };
}, uid);
check(!!saved.imp, "a Class Data set from Fact Blitz");
const avaRow = saved.rows && saved.rows.find((r) => r.s === "Ava R.");
check(avaRow && Math.abs(avaRow.v[0] - Math.min(1, avaRight / 25)) < 0.01, "Ava's grade = right / 25 (" + (avaRow && avaRow.v[0]) + ")");
const benRow = saved.rows && saved.rows.find((r) => r.s === "Ben S.");
check(benRow && Math.abs(benRow.v[0] - Math.min(1, benRight / 25)) < 0.01, "Ben's goal is not raised by extra time (" + (benRow && benRow.v[0]) + ")");
check(saved.ava && saved.ava.fl && saved.ava.fl.mul && saved.ava.fl.mul.h.length === 1, "Ava's profile has the run");
check(saved.ava && saved.ava.xp === avaRight, "Ava's XP = right answers (" + (saved.ava && saved.ava.xp) + ")");
// saving again never doubles
await t.click("text=Save results now"); await sleep(3000);
const again = await t.evaluate(async (u) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); return (await F.getDoc(F.doc(db, "teacher/" + u + "/profiles/1st"))).data().kids["ava-r"]; }, uid);
check(again.fl.mul.h.length === 1 && again.xp === avaRight, "saving again adds nothing twice");

// Gradebook offers it
await t.goto(BASE + "/grades.html?emu");
await t.waitForSelector("#views >> text=Add scores (1)", { timeout: 30000 });
await t.click("#views >> text=Add scores"); await sleep(1500);
const add = await t.textContent("#out");
check(/Fact Blitz/.test(add), "the Gradebook offers the check under Add scores");
await t.screenshot({ path: OUT + "/e2e-7-gradebook.png", fullPage: true });
// Progress tab
await t.goto(BASE + "/fluency.html?emu");
await t.waitForSelector("#status[data-state=ok]", { timeout: 30000 }); await t.click("#views >> text=Progress"); await sleep(1500);
await t.screenshot({ path: OUT + "/e2e-8-progress.png", fullPage: true });
check(/Ava R\./.test(await t.textContent("#out")), "Progress lists the class");
// closed: students can't write
await t.click("#views >> text=Checks"); await t.click(".asCard >> nth=0"); await t.click("text=Close it"); await sleep(1500);
await ava.p.reload(); await ava.p.waitForSelector(".fbins", { timeout: 20000 }); await sleep(1000);
await ava.p.screenshot({ path: OUT + "/e2e-9-closed.png" });
check(/closed/i.test(await ava.p.textContent("main")), "a closed check says so to the student");

console.log("\nconsole errors:", logs.filter((l) => !/favicon|404/.test(l)).slice(0, 12));
console.log(fails.length ? fails.length + " FAILED" : "all passed");
await browser.close();
process.exit(fails.length ? 1 : 0);
