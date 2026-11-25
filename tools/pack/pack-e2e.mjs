// Which lessons an account sees, end to end against the Firebase emulators, each scenario in a FRESH browser profile.
// Needs: firebase emulators (firestore 8080, auth 9099) for project steers-class-board, the repo served at 127.0.0.1:5000,
// and firebase@12.1.0 (FIREBASE_SDK=path/to/node_modules/firebase/). Run: node tools/pack/pack-e2e.mjs <shots dir>. Made-up names only.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const BASE = process.env.BASE || "http://127.0.0.1:5000", ONLY = (process.env.ONLY || "12345").split(""), FB = process.env.FIREBASE_SDK || "./node_modules/firebase/", OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
let SC = "";
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] });
const logs = [], RUN = Date.now().toString(36);   // fresh test accounts every run
async function fresh(w = 1280, h = 900) {   // a brand-new browser profile: no cookies, no storage, no offline copy
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    await c.route(/gstatic\.com\/firebasejs\/12\.1\.0\/(.*)$/, (r) => { const f = r.request().url().split("/").pop(); r.fulfill({ path: FB + f, contentType: "text/javascript" }); });
    await c.route(/\/__t\.html/, (r) => r.fulfill({ body: "<!doctype html><title>t</title>", contentType: "text/html" }));
    await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: "", contentType: "text/css" }));
    const p = await c.newPage(); p.on("pageerror", (e) => logs.push("scenario " + SC + " PAGEERROR " + e.message)); return { c, p };
}
/** Sign in (fresh profile) as a test teacher, optionally seed documents, return the uid. */
async function signIn(p, sub, seed) {
    await p.goto(BASE + "/__t.html?emu");
    sub = sub + RUN;
    return p.evaluate(async ({ sub, seed }) => {
        const { auth, db } = await import("/js/firebase.js");
        const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
        const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub, email: sub + "@example.com", email_verified: true, name: "Test " + sub })));
        const u = c.user.uid;
        for (const [path, data] of Object.entries(seed || {})) await F.setDoc(F.doc(db, "teacher/" + u + "/" + path), data);
        return u;
    }, { sub, seed });
}
const readDoc = (p, path) => p.evaluate(async (path) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); const s = await F.getDocFromServer(F.doc(db, path)); return s.exists() ? s.data() : null; }, path);
const homeText = async (p) => { await p.waitForFunction(() => /Signed in as/.test(document.body.innerText), null, { timeout: 30000 }); await p.waitForTimeout(1500); return p.evaluate(() => document.body.innerText); };
const isCaleraHome = (t) => /8th Grade/i.test(t) && /7th Grade/i.test(t) && !/Try the sample lesson/.test(t) && !/Math 7 \(sample\)/.test(t);

// Eddie's account on Nov 23 (made-up names): an inferred "starter", an empty setup, 5 periods of rosters, week5, no weekfiles/index
const rost = { "1st": ["Ava R.", "Ben K."], "2nd": ["Cara L.", "Dev P."], "4th": ["Eli S."], "5th": ["Fay W."], "6th": ["Gus H."] };
const brokenSeed = { "settings/pack": { pack: "starter", how: "new account", at: Date.now() }, "settings/setup": { name: "", school: "", subject: "", grades: [], classes: [], done: true, at: Date.now() },
    "rosters/all": { periods: rost, at: Date.now() }, "weekfiles/week5": { json: JSON.stringify({ id: "week5" }), at: Date.now() } };

// 1. the broken state, fresh profile: Home shows the Calera classes; Plan loads with no redirect; reload Plan still loads
if (ONLY.includes("1")) { SC = "1";
    const { c, p } = await fresh(); const uid = await signIn(p, "eddie1", brokenSeed);
    await p.goto(BASE + "/index.html"); const t = await homeText(p);
    assert.ok(isCaleraHome(t), "1: Home shows the Calera classes, not the sample");
    assert.match(t, /Week 5 is on the board/, "1: Week 5 is on the board");
    assert.match(t, /\bPlan\b/, "1: the Plan link is back");
    const pack = await readDoc(p, "teacher/" + uid + "/settings/pack"); assert.equal(pack.pack, "calera"); assert.equal(pack.how, "existing account", "1: real data found, Calera saved");
    const trail = await p.evaluate(() => localStorage.getItem("school-signin-trail") || ""); assert.match(trail, /pack decided: calera/); assert.match(trail, /"pack checks","rosters\+ board- wfindex- bells- data- weekfiles\*\+ plans\*-"/);
    await p.screenshot({ path: OUT + "/1-home.png" });
    await p.goto(BASE + "/plan.html"); await p.waitForTimeout(4000); assert.match(p.url(), /\/plan\.html(\?|$)/, "1: Plan did not redirect"); assert.match(await p.textContent("body"), /Plan/);
    await p.reload(); await p.waitForTimeout(4000); assert.match(p.url(), /\/plan\.html(\?|$)/, "1: Plan still there after reload");
    await p.screenshot({ path: OUT + "/1-plan.png" }); await c.close();
}
// 2. this device remembers "starter" (another Chromebook): still Calera, never the sample first
if (ONLY.includes("2")) { SC = "2";
    const { c, p } = await fresh(); const uid = await signIn(p, "eddie2", brokenSeed);
    await p.evaluate((u) => localStorage.setItem("focal-pack:" + u, "starter"), uid);
    await p.goto(BASE + "/plan.html"); await p.waitForTimeout(4500); assert.match(p.url(), /\/plan\.html(\?|$)/, "2: a remembered starter does not redirect Plan");
    await p.goto(BASE + "/index.html"); assert.ok(isCaleraHome(await homeText(p)), "2: Home shows Calera");
    assert.equal(await p.evaluate((u) => localStorage.getItem("focal-pack:" + u), uid), "calera", "2: the device copy is corrected");
    await c.close();
}
// 3. a brand-new teacher (nothing at all): Calera sample weeks, nothing saved, an explicit way to start their own
if (ONLY.includes("3")) { SC = "3";
    const { c, p } = await fresh(); const uid = await signIn(p, "newteacher", {});
    await p.goto(BASE + "/index.html"); const t = await homeText(p);
    assert.equal(await readDoc(p, "teacher/" + uid + "/settings/pack"), null, "3: nothing saved on an inconclusive check");
    await p.waitForSelector(".pack-card:has-text('New to Anchor Board?')"); await p.screenshot({ path: OUT + "/3-new.png" });
    await p.click(".pack-card button"); await p.waitForURL(/setup\.html/, { timeout: 15000 });
    const pk = await readDoc(p, "teacher/" + uid + "/settings/pack"); assert.deepEqual([pk.pack, pk.how], ["starter", "chosen on Home"], "3: starter only by an explicit choice");
    await c.close();
}
// 4. an explicit starter on an account with real work: Home offers "Restore my Calera classes"
if (ONLY.includes("4")) { SC = "4";
    const seed = Object.assign({}, brokenSeed, { "settings/pack": { pack: "starter", how: "chosen on Home", at: Date.now() }, "settings/setup": { name: "", classes: [], grades: [], done: true, at: Date.now() } });
    const { c, p } = await fresh(); const uid = await signIn(p, "eddie4", seed);
    await p.goto(BASE + "/index.html"); await homeText(p);
    await p.waitForSelector(".pack-card:has-text('Restore my Calera classes')", { timeout: 20000 }); await p.screenshot({ path: OUT + "/4-restore.png" });
    await p.click(".pack-card button"); await p.waitForLoadState("load"); const t = await homeText(p);
    assert.ok(isCaleraHome(t), "4: restored to Calera"); assert.deepEqual((await readDoc(p, "teacher/" + uid + "/settings/pack")).how, "restored from Home");
    await p.goto(BASE + "/plan.html"); await p.waitForTimeout(4000); assert.match(p.url(), /\/plan\.html(\?|$)/, "4: Plan loads after restore");
    await c.close();
}
// 5. sign-out clears this device's remembered pack and setup
if (ONLY.includes("5")) { SC = "5";
    const { c, p } = await fresh(); const uid = await signIn(p, "eddie5", brokenSeed);
    await p.goto(BASE + "/index.html"); await homeText(p);
    assert.equal(await p.evaluate((u) => localStorage.getItem("focal-pack:" + u), uid), "calera");
    await p.click("#signOutOpen"); await p.click("#signOut"); await p.waitForURL(/login\.html/, { timeout: 15000 });
    assert.deepEqual(await p.evaluate(() => Object.keys(localStorage).filter((k) => /^focal-(pack|setup):/.test(k))), [], "5: no remembered pack or setup after sign-out");
    await c.close();
}
await browser.close();
assert.deepEqual(logs, [], logs.join("\n")); console.log("pack end to end (5 fresh profiles): all checks passed");
