// Fact Blitz from the Student Game screen, against the Firebase emulators: the Remote switches the panel to Fact Blitz,
// opens a 1-minute speed check for the class, the board shows the code (no names), a student plays with the Fact Blitz
// page closed, gets their extra time from the Remote/board, and the score reaches Class Data and the profile.
// Same needs as flu-e2e.mjs. Run: node tools/fluency/live-e2e.mjs <shots dir>
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

const T = await ctx(1366, 900), t = await T.newPage(); watch(t, "remote");
await t.goto(BASE + "/__t.html?emu");
const uid = await t.evaluate(async () => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teachlive" + Date.now(), email: "l" + Date.now() + "@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    await F.setDoc(d("games/room"), { v: 1, status: "none", at: Date.now() });
    await F.setDoc(d("rosters/all"), { periods: { "1st": ["Ava Rivera", "Ben Shaw", "Cara Lee"], "2nd": ["Dev Patel"] }, at: Date.now() });
    await F.setDoc(d("flu/setup"), { xt: { "1st|Ben S.": 1.5 }, goal: 25, at: Date.now() });
    return u;
});
const get = (p) => t.evaluate(async ([u, p]) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); const s = await F.getDoc(F.doc(db, "teacher/" + u + "/" + p)); return s.exists() ? s.data() : null; }, [uid, p]);

await t.goto(BASE + "/remote.html?emu&screen=live&period=1st");
await t.waitForSelector("#livePanel .vrgamesw", { timeout: 30000 });
await t.screenshot({ path: OUT + "/live-0-vault.png" });
await t.click("#livePanel .vrgamesw >> text=Fact Blitz");
await t.waitForSelector("text=Open it and show on the board", { timeout: 20000 });
await t.locator("#livePanel label.vrfield", { hasText: "Time on the clock" }).locator("select").selectOption("60");
await t.screenshot({ path: OUT + "/live-1-fact-setup.png" });
check(/1 student has extra time/.test(await t.textContent("#livePanel")), "the panel says one student has extra time");
await t.click("text=Open it and show on the board");
await t.waitForSelector("text=Close the check", { timeout: 20000 });
const fb = await get("games/fact");
check(fb && /^[1-9]\d{5}$/.test(fb.code), "games/fact names the check on the board (" + (fb && fb.code) + ")");
const code = fb.code;
const def = await get("flu/a_" + fb.id);
check(def && def.periods.join() === "1st" && def.secs === 60 && def.mode === "check", "a 1-minute speed check for 1st period only");
await sleep(800);
check(/Fact Blitz/.test(await t.textContent("#stage")) && (await t.textContent("#stage")).includes(code.slice(0, 3) + " " + code.slice(3)), "the board picture on the Remote shows the code");
await t.screenshot({ path: OUT + "/live-2-remote-on.png" });

// the projected board, same teacher
const b = await T.newPage(); watch(b, "board"); await b.setViewportSize({ width: 1600, height: 900 });
await b.goto(BASE + "/board.html?emu");
await b.waitForSelector(".fbstage", { timeout: 30000 });
await sleep(1000);
const boardTxt = await b.textContent("#stage");
check(boardTxt.includes(code.slice(0, 3) + " " + code.slice(3)) && /\/fact/.test(boardTxt), "the board shows /fact and the code");
check(!/Ava|Ben|Cara/.test(boardTxt), "no names on the board");
await b.screenshot({ path: OUT + "/live-3-board.png" });

// a student plays: the Fact Blitz page is never opened
const S = await ctx(1366, 768), s = await S.newPage(); watch(s, "ben");
await s.goto(BASE + "/fact.html?emu&c=" + code);
await s.waitForSelector(".pname", { timeout: 20000 });
check(!/Dev P\./.test(await s.textContent("main")), "only 1st period's names are offered");
await s.click(".pname >> text=Ben S.");
await s.waitForSelector(".fbstart", { timeout: 20000 });
check((await s.textContent(".fbclock")).startsWith("1:30"), "Ben's extra time came from the Remote/board (" + (await s.textContent(".fbclock")).trim() + ")");
await s.click(".fbstart"); await s.waitForSelector(".fbq", { timeout: 10000 });
for (let i = 0; i < 6; i++) {
    const q = (await s.textContent(".fbq")).replace("=", "").trim();
    const v = Math.round(Function("return (" + q.replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/") + ")")());
    for (const ch of String(v)) await s.keyboard.press(ch);
    await sleep(350);
}
await sleep(2500);
await b.screenshot({ path: OUT + "/live-4-board-playing.png" });
check(/1\s*playing now/.test((await b.textContent("#stage")).replace(/\s+/g, " ")), "the board counts 1 playing");
// close the Remote: the board alone keeps saving
await t.close();
await s.waitForSelector(".fbbign", { timeout: 110000 });
const right = +(await s.textContent(".fbbign"));
await sleep(12000);
const ix = await (async () => { const p = await T.newPage(); await p.goto(BASE + "/__t.html?emu"); const r = await p.evaluate(async (u) => { const { db, auth } = await import("/js/firebase.js"); await auth.authStateReady(); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); const g = async (x) => { const s = await F.getDoc(F.doc(db, "teacher/" + u + "/" + x)); return s.exists() ? s.data() : null; }; return { ix: await g("data/index"), prof: await g("profiles/1st") }; }, uid); await p.close(); return r; })();
const imp = ix.ix && ix.ix.imports.find((x) => x.source === "Fact Blitz");
check(!!imp, "the score reached Class Data with only the board open");
check(ix.prof && ix.prof.kids["ben-s"] && ix.prof.kids["ben-s"].xp === right, "Ben's profile has the run (" + right + " right)");
await b.screenshot({ path: OUT + "/live-5-board-done.png" });

const t2 = await T.newPage(); watch(t2, "remote2");
await t2.goto(BASE + "/remote.html?emu&screen=live&period=1st");
await t2.waitForSelector("text=Close the check", { timeout: 30000 });
await t2.screenshot({ path: OUT + "/live-6-remote-back.png" });
await t2.setViewportSize({ width: 390, height: 844 }); await sleep(800); await t2.screenshot({ path: OUT + "/live-7-phone.png", fullPage: true }); await t2.setViewportSize({ width: 1366, height: 900 }); await sleep(500);
await t2.click("text=Close the check");
await t2.waitForSelector("text=Open it and show on the board", { timeout: 20000 });
await sleep(1500);
check(/No student game is open/.test(await b.textContent("#stage")), "closing takes it off the board");
const closed = await t2.evaluate(async ([u, id]) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); return (await F.getDoc(F.doc(db, "teacher/" + u + "/flu/a_" + id))).data().status; }, [uid, fb.id]);
check(closed === "closed", "the check is closed");

console.log("\nconsole errors:", logs.filter((l) => !/favicon|404/.test(l)).slice(0, 12));
console.log(fails.length ? fails.length + " FAILED" : "all passed");
await browser.close();
process.exit(fails.length ? 1 : 0);
