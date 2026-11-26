// Early access end to end against the Firebase emulators, with preview pictures. Made-up teachers only.
// Needs: emulators (firestore 8080, auth 9099) for steers-class-board, this repo served at BASE (default 127.0.0.1:5000),
// firebase@12.1.0 (FIREBASE_SDK=.../node_modules/firebase/), fonts (FONTS=.../node_modules/@fontsource/), CHROME=path to Chromium.
// OWNER_EMAIL: the address whose hash is in js/accessRules.js (only ever sent to the local emulator).
// MODE=before shoots what a new teacher sees today (serve main and use main's rules); MODE=after (default) checks and shoots the new flow.
// Run: node tools/access/access-e2e.mjs <out dir>
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict";
const BASE = process.env.BASE || "http://127.0.0.1:5000", FB = process.env.FIREBASE_SDK, FONTS = process.env.FONTS, OUT = process.argv[2] || "./shots", MODE = process.env.MODE || "after";
const OWNER = process.env.OWNER_EMAIL; if (!OWNER) throw new Error("set OWNER_EMAIL");
fs.mkdirSync(OUT, { recursive: true });
const SIZES = { chromebook: [1366, 768, 1], promethean: [1920, 1080, 1], phone: [390, 844, 3] };
const face = (fam, file, w) => `@font-face{font-family:"${fam}";font-weight:${w};font-style:normal;font-display:block;src:url(http://fonts.local/${file}) format("woff2")}`;
const css = [400, 500, 600, 700].map((w) => face("Instrument Sans", "instrument-sans/files/instrument-sans-latin-" + w + "-normal.woff2", w))
    .concat([500, 600, 700, 800].map((w) => face("Bricolage Grotesque", "bricolage-grotesque/files/bricolage-grotesque-latin-" + w + "-normal.woff2", w))).join("\n");
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none", "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] });
const errors = [], RUN = Date.now().toString(36);
async function fresh(size = "chromebook", night = false) {
    const [w, h, s] = SIZES[size];
    const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: s, isMobile: size === "phone", hasTouch: size === "phone", colorScheme: night ? "dark" : "light" });
    await c.route(/gstatic\.com\/firebasejs\/12\.1\.0\/(.*)$/, (r) => r.fulfill({ path: FB + r.request().url().split("/").pop(), contentType: "text/javascript" }));
    await c.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ body: css, contentType: "text/css" }));
    await c.route(/fonts\.local\//, (r) => r.fulfill({ path: path.join(FONTS, decodeURIComponent(new URL(r.request().url()).pathname.slice(1))), contentType: "font/woff2" }));
    await c.route(/fonts\.gstatic\.com|accounts\.google\.com|apis\.google\.com/, (r) => r.fulfill({ body: "", contentType: "text/plain" }));
    await c.route(/\/__t\.html/, (r) => r.fulfill({ body: "<!doctype html><title>t</title>", contentType: "text/html" }));
    const p = await c.newPage(); p.on("pageerror", (e) => errors.push(size + " " + p.url() + " " + e.message));
    return { c, p };
}
/** Sign in (fresh profile) as a made-up Google account on the emulator. */
async function signIn(p, email, seed) {
    await p.goto(BASE + "/__t.html?emu");
    return p.evaluate(async ({ email, seed }) => {
        const { auth, db } = await import("/js/firebase.js");
        const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
        const sub = email.replace(/[^a-z0-9]/gi, "");
        const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true, name: email.split("@")[0].replace(/[._]/g, " ") })));
        for (const [p, data] of Object.entries(seed || {})) await F.setDoc(F.doc(db, p.replace("{uid}", c.user.uid)), data);
        return c.user.uid;
    }, { email, seed });
}
const run = (p, fn, arg) => p.evaluate(fn, arg);
const until = (p, fn, name) => p.waitForFunction(fn, null, { timeout: 30000 }).catch(async (e) => { console.log("stuck at", name, p.url()); await p.screenshot({ path: path.join(OUT, "stuck-" + name + ".png") }); throw e; });
const tryWrite = (p, uid) => run(p, async (uid) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    try { await F.setDoc(F.doc(db, "teacher/" + uid + "/ink/e2e"), { t: 1 }); return "ok"; } catch (e) { return e.code; } }, uid);
const shot = async (p, name) => { await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, name + ".png") }); console.log("shot", name); };
async function joinWaitlist(entries) {   // the public join form's documents, as a stranger with no sign-in
    const { c, p } = await fresh(); await p.goto(BASE + "/__t.html?emu");
    await run(p, async (entries) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
        for (const e of entries) await F.addDoc(F.collection(db, "waitlist"), { ...e, at: F.serverTimestamp() }); }, entries);
    await c.close();
}
const ownerSeed = { "teacher/{uid}/rosters/all": { periods: { "1st": ["Ava R.", "Ben K."] }, at: 1 }, "teacher/{uid}/settings/pack": { pack: "calera", how: "existing account", at: 1 } };

if (MODE === "before") {
    for (const size of Object.keys(SIZES)) {
        const { c, p } = await fresh(size); await signIn(p, "new.teacher." + size + RUN + "@example.org");
        await p.goto(BASE + "/index.html"); await p.waitForFunction(() => /New to Anchor Board|Signed in as/.test(document.body.innerText), null, { timeout: 30000 });
        await shot(p, "0-before-new-teacher-lands-on-calera-" + size); await c.close();
    }
} else {
    // 1. A Google account that isn't on the list: sent to "Not on the list yet", and the database refuses it
    for (const size of Object.keys(SIZES)) {
        const { c, p } = await fresh(size); const uid = await signIn(p, "stranger." + size + RUN + "@example.org");
        assert.equal(await tryWrite(p, uid), "permission-denied");
        await p.goto(BASE + "/index.html"); await p.waitForURL(/waiting\.html/, { timeout: 30000 }); await p.waitForFunction(() => { const m = document.getElementById("mail"); return m && /@example\.org/.test(m.textContent); }, null, { timeout: 15000 }).catch(async (e) => { console.log("at", p.url()); await p.screenshot({ path: path.join(OUT, "debug.png") }); throw e; });
        await shot(p, "1-not-on-the-list-" + size);
        if (size === "chromebook") { await p.goto(BASE + "/plan.html"); await p.waitForURL(/waiting\.html/, { timeout: 30000 }); console.log("ok: plan.html sends a stranger to waiting.html"); }
        await c.close();
    }
    // 2. The owner: Home works as before, Teacher access is in Settings, the page lists sign-ups and lets one in
    await joinWaitlist([
        { name: "Jordan Lee", email: "jordan.lee" + RUN + "@example.org", grades: "middle", subject: "Math", board: "promethean", device: "chromebook", note: "Two sections of 6th grade math." },
        { name: "Priya Shah", email: "priya.shah" + RUN + "@example.org", grades: "high", subject: "Algebra I", board: "smart", device: "laptop" },
        { email: "sam.ortiz" + RUN + "@example.org", grades: "middle", subject: "Science", board: "projector", device: "ipad" },
    ]);
    let ownerUid = "";
    for (const size of Object.keys(SIZES)) {
        const { c, p } = await fresh(size); ownerUid = await signIn(p, OWNER, ownerSeed);
        assert.equal(await tryWrite(p, ownerUid), "ok");
        if (size === "chromebook") {
            await p.goto(BASE + "/index.html?settings=acct"); await until(p, () => /Plan the Week|Plan/.test(document.body.innerText) && document.getElementById("settings"), "owner-home");
            assert.ok(!/waiting/.test(p.url()), "the owner is never sent to waiting.html");
            await until(p, () => { const a = document.getElementById("accessLink"); return a && !a.hidden; }, "access-row");
            await shot(p, "2-owner-home-settings-teacher-access-row-chromebook");
        }
        await p.goto(BASE + "/access.html"); await p.waitForFunction(() => /Early access sign-ups/.test(document.body.innerText) && document.getElementById("status").dataset.state === "ok", null, { timeout: 30000 });
        if (size === "chromebook") {
            await p.fill("#addBox", "chris.nguyen" + RUN + "@example.org, not-an-email"); await p.click("#addGo"); await p.waitForFunction(() => /is in/.test(document.getElementById("addMsg").textContent));
            await p.locator("#wl li", { hasText: "Jordan Lee" }).locator("button").click(); await p.waitForFunction(() => /jordan/.test(document.getElementById("in").textContent));
        }
        await shot(p, "3-teacher-access-page-" + size);
        await c.close();
    }
    // 3. A teacher let in: their own space works, they go straight to setup (not the Calera weeks), and they can't open Teacher access
    {
        const { c, p } = await fresh("chromebook"); const uid = await signIn(p, "chris.nguyen" + RUN + "@example.org");
        assert.equal(await tryWrite(p, uid), "ok");
        assert.equal(await tryWrite(p, ownerUid), "permission-denied");
        await p.goto(BASE + "/index.html"); await p.waitForURL(/setup\.html/, { timeout: 30000 }).catch(async (e) => { await p.screenshot({ path: path.join(OUT, "stuck-setup.png") }); console.log("TRAIL", await p.evaluate(() => document.body.innerText.slice(-1500))); throw e; });
        await shot(p, "4-teacher-let-in-goes-to-setup-chromebook");
        const pack = await run(p, async (uid) => { const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"); const s = await F.getDocFromServer(F.doc(db, "teacher/" + uid + "/settings/pack")); return s.exists() ? s.data().pack + " / " + s.data().how : "none"; }, uid);
        assert.equal(pack, "starter / new teacher (approved list)"); console.log("ok: saved", pack);
        await p.goto(BASE + "/access.html"); await p.waitForFunction(() => /Only the site owner/.test(document.body.innerText), null, { timeout: 30000 });
        await shot(p, "5-teacher-cannot-open-teacher-access-chromebook");
        await c.close();
    }
    // 4. Let in from the sign-ups list, then removed: back to "Not on the list yet"
    {
        const { c, p } = await fresh("phone"); const uid = await signIn(p, "jordan.lee" + RUN + "@example.org");
        assert.equal(await tryWrite(p, uid), "ok");
        const o = await fresh("chromebook"); await signIn(o.p, OWNER); await o.p.goto(BASE + "/access.html");
        await o.p.waitForFunction(() => document.getElementById("status").dataset.state === "ok", null, { timeout: 30000 });
        const rm = o.p.locator("#in li", { hasText: "jordan.lee" }).locator("button"); await rm.click(); await rm.click();
        await o.p.waitForFunction(() => /was removed/.test(document.getElementById("addMsg").textContent)); await o.c.close();
        assert.equal(await tryWrite(p, uid), "permission-denied"); console.log("ok: removed teacher is refused");
        await c.close();
    }
}
await browser.close();
const real = errors.filter((e) => !/Failed to fetch|NetworkError|offline|permission|Missing or insufficient/i.test(e));
if (real.length) console.log("PAGE ERRORS:\n" + real.join("\n")); else console.log("no page errors");
console.log("access e2e (" + MODE + "): done");
