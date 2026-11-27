// Assignment results reach Student Progress without opening the Assignments page (js/asgSync.js catchUp).
// Against the Firebase emulators, made-up names only. Needs what tools/acap/ready-e2e.mjs needs.
// Run: node tools/acap/sync-e2e.mjs <shots dir>
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
const getDoc = (p, path) => p.evaluate(async (path) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); const s = await F.getDoc(F.doc(db, path)); return s.exists() ? s.data() : null; }, path);

const T = await ctx(); const t = await T.newPage(); watch(t, "teacher");
await t.goto(BASE + "/__t.html?emu&pack=calera");
const uid = await t.evaluate(async () => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teachsync", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    await F.setDoc(d("asg/index"), { list: [], at: Date.now() });
    await F.setDoc(d("settings/pack"), { pack: "calera", how: "test", at: Date.now() });
    await F.setDoc(d("standards/progress"), { "8th": { "8.5": { s: "teaching" } } });
    await F.setDoc(d("rosters/all"), { periods: { "2nd": ["Ava R.", "Ben S."] }, at: Date.now() });
    await F.setDoc(d("data/i_x1"), { id: "x1", title: "Exit ticket 8.5", std: "8.5", skill: "", date: "2026-11-16", source: "Test", period: "2nd", items: ["Q1-4"], rows: [{ s: "Ava R.", v: [0.9] }, { s: "Ben S.", v: [0.25] }], at: Date.parse("2026-11-16") });
    await F.setDoc(d("data/index"), { imports: [{ id: "x1", period: "2nd", title: "Exit ticket 8.5", date: "2026-11-16" }], at: Date.now() });
    await F.setDoc(d("progress/index"), { games: [], at: Date.now() });
    return u;
});
// The teacher approves Ben's practice on Student Progress (never opens the Assignments page).
await t.goto(BASE + "/progress.html?emu&pack=calera");
await t.waitForSelector("#periodTabs button[data-k='2nd']", { timeout: 30000 });
await t.click("#periodTabs button[data-k='2nd']"); await t.click('#views button[data-v="ready"]');
await t.waitForSelector(".rdGrid", { timeout: 20000 });
await t.click(".rdGrid .pgName:has-text('Ben S.')"); await t.waitForSelector(".rdNext h3");
await t.click("text=Approve practice");
await t.waitForFunction(() => /Code \d{6}/.test(document.querySelector(".rdMsg").textContent), null, { timeout: 20000 });
const code = (await t.textContent(".rdMsg")).match(/Code (\d{6})/)[1]; console.log("practice", code);
await t.goto(BASE + "/__t.html?emu&pack=calera");

// Ben works two problems on his Chromebook.
const S = await ctx(390, 844); const s = await S.newPage(); watch(s, "student");
await s.goto(BASE + "/do.html?emu&c=" + code);
await s.waitForSelector(".pname", { timeout: 30000 }); await s.click(".pname");
for (let k = 0; k < 6 && !(await s.$(".dq")); k++) { const b = s.locator("button.pbtn.go").first(); if (await b.count()) await b.click(); else { const d = s.locator(".dskill").first(); if (await d.count()) await d.click(); } await s.waitForTimeout(800); }
for (let k = 0; k < 2; k++) {
    await s.waitForSelector(".dq", { timeout: 15000 });
    const inps = s.locator("form input:visible"); for (let j = 0; j < await inps.count(); j++) await inps.nth(j).fill("1");   // every box of the answer shape (a fraction or 8 × 10ⁿ has two)
    await s.click("button:has-text('Check')"); await s.waitForTimeout(1200);
    const next = s.locator("button:has-text('Next problem'), button:has-text('Try again')").first(); if (await next.count()) await next.click(); await s.waitForTimeout(500);
}
await s.waitForTimeout(1500);
const tried = await t.evaluate(async (code) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); const q = await F.getDocs(F.collection(db, "asg/" + code + "/p")); return q.docs.reduce((n, d) => n + ((d.data().lg || []).length), 0); }, code);
console.log("attempts saved:", tried);
assert.ok(tried >= 1, "Ben's attempts were saved");
const ix0 = await getDoc(t, "teacher/" + uid + "/data/index");
assert.ok(!ix0.imports.some((x) => x.source === "Assignment"), "nothing copied yet: the Assignments page was never opened");

// The teacher opens Student Progress: the practice result is copied in on its own.
await t.goto(BASE + "/progress.html?emu&pack=calera");
await t.waitForFunction(async () => true);
let ix = null;
for (let k = 0; k < 20; k++) { await t.waitForTimeout(1000); ix = await getDoc(t, "teacher/" + uid + "/data/index"); if (ix.imports.some((x) => x.source === "Assignment")) break; }
const imp = ix.imports.find((x) => x.source === "Assignment"); assert.ok(imp, "Ben's practice reached Class Data");
const doc = await getDoc(t, "teacher/" + uid + "/data/i_" + imp.id); console.log(doc.title, doc.istd, JSON.stringify(doc.rows));
assert.deepEqual(doc.rows.map((r) => r.s), ["Ben S."]); assert.equal(doc.istd[1], "8.5");
const pix = await getDoc(t, "teacher/" + uid + "/progress/index"); assert.ok(pix.games.length >= 1, "effort record too");
const a = await getDoc(t, "teacher/" + uid + "/asg/a_" + (await getDoc(t, "teacher/" + uid + "/asg/index")).list[0].id); assert.ok(a.res && a.res.started === 1 && a.res.sig);
console.log("status:", await t.textContent("#status"));
// Opening again copies nothing new (same attempts).
const at0 = a.res.at; await t.reload(); await t.waitForTimeout(5000);
assert.equal((await getDoc(t, "teacher/" + uid + "/asg/a_" + a.id)).res.at, at0, "no second copy when nothing changed");
// The Assignments page still does its own copy, through the same code (js/asgSync.js).
await t.goto(BASE + "/assign.html?emu&pack=calera"); await t.waitForSelector(".asCard", { timeout: 30000 });
let again = null; for (let k = 0; k < 15; k++) { await t.waitForTimeout(1000); again = (await getDoc(t, "teacher/" + uid + "/asg/a_" + a.id)).res; if (again.at !== at0) break; }
assert.notEqual(again.at, at0, "Assignments page copied too"); assert.equal(again.started, 1);
console.log(logs.length ? logs.join("\n") : "no page errors");
await browser.close();
console.log("sync e2e: passed");
