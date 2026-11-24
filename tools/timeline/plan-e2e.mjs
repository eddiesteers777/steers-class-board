// Plan the Week + Planner suggest units in the Standards Timeline order. Firebase emulators, made-up data only.
// Needs what tools/timeline/timeline-e2e.mjs needs. Run: node tools/timeline/plan-e2e.mjs <shots dir>
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "../../js/timelineCore.js";
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

// 1st nine weeks taught. Default order: next is 8.25 (triangle angle sum). Custom order: 8.13 moved to the top of the 2nd nine weeks.
const taught = Object.fromEntries(T.PLAN["8th"].lanes[0].map((x) => [x, { s: "taught", d: "2026-10-01" }]));
const lanes = T.defaultLanes("8th").map((l) => l.slice()); const moved = T.moveCard(lanes, "8.13", 1, 0);
const want = { def: T.timelineUnit("8th", T.defaultLanes("8th"), { "8th": taught }), cus: T.timelineUnit("8th", moved, { "8th": taught }) };
assert.notEqual(want.def, want.cus, "custom order should change the unit");
console.log("expect default:", want.def, "| custom:", want.cus);

const setup = async (order) => t.evaluate(async ({ taught, order }) => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teachtlplan", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    for (const x of (await F.getDocs(F.collection(db, "teacher/" + u + "/plans"))).docs) await F.deleteDoc(x.ref);
    await F.setDoc(d("settings/pack"), { pack: "calera", how: "test", at: Date.now() });
    await F.setDoc(d("planner/plans"), { weeks: {} });
    await F.setDoc(d("standards/progress"), { "8th": taught });
    if (order) await F.setDoc(d("standards/timeline"), { "8th": order }); else await F.deleteDoc(d("standards/timeline"));
}, { taught, order });

for (const [name, order, unit] of [["default", null, want.def], ["custom", { lanes: T.toSaved(moved), at: 1 }, want.cus]]) {
    await t.goto(BASE + "/__t.html?emu&pack=calera"); await setup(order);
    await t.goto(BASE + "/plan.html?emu&pack=calera"); await t.waitForTimeout(6000);
    // An unsaved week starts with the suggested unit in "Topic this week".
    const topics = await t.locator("section.pw-class").evaluateAll((els) => els.map((e) => e.querySelector("h2").textContent + " = " + ((e.querySelector("input") || {}).value || "")));
    console.log(name, "plan:", topics);
    await t.screenshot({ path: OUT + "/plan-" + name + ".png" });
    assert.ok(topics.some((x) => /^8th/.test(x) && x.endsWith("= " + unit)), name + " Plan the Week topic " + unit);
    await t.screenshot({ path: OUT + "/plan-" + name + ".png" });
    await t.goto(BASE + "/planner.html?emu&pack=calera&view=week"); await t.waitForTimeout(5000);
    const sug = await t.locator(".pl-sug").allInnerTexts();
    console.log(name, "planner:", sug);
    assert.ok(sug.includes("Next up: " + unit), name + " Planner suggestion " + unit);
    await t.screenshot({ path: OUT + "/planner-" + name + ".png" });
}
const bad = logs.filter((l) => !/favicon|ERR_|net::|Failed to load resource/.test(l));
assert.deepEqual(bad, [], "page errors");
await browser.close();
console.log("timeline plan e2e: passed");
