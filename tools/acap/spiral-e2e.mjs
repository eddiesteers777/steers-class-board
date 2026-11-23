// The Vault Raid spiral and the ACAP answer boxes, end to end against the Firebase emulators. Made-up names only.
// Needs what tools/acap/ready-e2e.mjs needs. Run: node tools/acap/spiral-e2e.mjs <shots dir>
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5000", FB = process.env.FIREBASE_SDK || "./node_modules/firebase/", OUT = process.argv[2] || "./shots";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

// ---------- teacher: 2nd period (8th), 8.11 marked Teaching, three earlier standards taught ----------
const T = await ctx(); const t = await T.newPage(); watch(t, "teacher");
await t.goto(BASE + "/__t.html?emu&pack=calera");
const uid = await t.evaluate(async () => {
    const { auth, db } = await import("/js/firebase.js");
    const A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"), F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    const c = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: "teachspiral", email: "teacher@example.com", email_verified: true, name: "Test Teacher" })));
    const u = c.user.uid, d = (p) => F.doc(db, "teacher/" + u + "/" + p);
    await F.setDoc(d("games/index"), { sets: [], at: Date.now() });
    await F.setDoc(d("games/room"), { v: 1, status: "none", at: Date.now() });
    await F.setDoc(d("settings/pack"), { pack: "calera", how: "test", at: Date.now() });
    await F.setDoc(d("standards/progress"), { "8th": { "8.2": { s: "taught" }, "8.3": { s: "taught" }, "8.4": { s: "taught" }, "8.11": { s: "teaching" } } });
    await F.setDoc(d("rosters/all"), { periods: { "2nd": ["Ava R.", "Ben S."] }, at: Date.now() });
    // one scored exit ticket, so Readiness has something to show
    await F.setDoc(d("data/i_x1"), { id: "x1", title: "Exit ticket 8.4", std: "8.4", skill: "", date: "2026-11-16", source: "Test", period: "2nd", items: ["Q1-4"], rows: [{ s: "Ava R.", v: [0.5] }, { s: "Ben S.", v: [0.25] }], at: Date.parse("2026-11-16") });
    await F.setDoc(d("data/index"), { imports: [{ id: "x1", period: "2nd", title: "Exit ticket 8.4", date: "2026-11-16" }], at: Date.now() });
    return u;
});
await t.goto(BASE + "/progress.html?emu&pack=calera");
await t.waitForSelector("#periodTabs button[data-k='2nd']", { timeout: 30000 });
await t.click("#periodTabs button[data-k='2nd']"); await t.click('#views button[data-v="ready"]');
await t.waitForSelector(".rdCheck", { timeout: 20000 });
await t.click(".rdCheck:has-text('Vault Raid spiral') button");
await t.waitForSelector(".rdSpList li", { timeout: 20000 });
assert.equal(await t.$eval(".rdSpiral .rdWeek select", (s) => s.value), "8.11");
const head = await t.textContent(".rdSpPrev p"); console.log(head);
assert.match(head, /on this week's standard/); assert.match(head, /ACAP formats:/);
await t.locator(".rdSpiral").screenshot({ path: OUT + "/11-spiral-builder.png" });
await t.click("text=Save the Vault Raid set");
await t.waitForFunction(() => /Saved: Spiral/.test((document.querySelector(".rdSpiral .rdMsg") || {}).textContent || ""), null, { timeout: 20000 });
console.log(await t.textContent(".rdSpiral .rdMsg"));
const ix = await getDoc(t, "teacher/" + uid + "/games/index"); assert.equal(ix.sets.length, 1); assert.equal(ix.sets[0].sp, 1);
const set = await getDoc(t, "teacher/" + uid + "/games/s_" + ix.sets[0].id);
const all = set.cats.flatMap((c) => c.clues.map((q) => Object.assign({ c: c.n }, q)));
const nowN = all.filter((q) => / this week$/.test(q.c)).length, oldN = all.filter((q) => / review$/.test(q.c)).length;
console.log("set:", nowN, "this week,", oldN, "review; formats", all.filter((q) => q.fm).map((q) => q.fm).join(", "));
assert.ok(oldN > 0 && oldN / (nowN + oldN) <= 0.4);

// ---------- Vault Raid with one of each answer shape (taken from the saved spiral) ----------
const AF = await import("../../js/acapFormats.js"), g8 = (await import("../../data/stdbank/g8.js")).default.items.map(AF.itemOf);
const made = (f) => { for (const code of ["8.11", "8.3", "8.2", "8.4", "8.6"]) for (const seed of ["a", "b", "c"]) { const pool = g8.filter((x) => x.std === code && !x.ch); const q = f === "ms" ? AF.selectAll(pool, seed) : f === "ord" ? pool.map((x) => AF.orderSteps(x, seed)).find(Boolean) : AF.notTrue(pool, seed); if (q) { delete q.used; return q; } } return null; };
const pick = (f) => all.find((q) => q.fm === f) || made(f);   // the bank decides which formats a set gets, so make any that this one didn't
const qs = [pick("ms"), pick("ord"), pick("not") || all.find((q) => q.ch && !q.fm)].filter(Boolean);
assert.ok(qs.length === 3, "a select all, an order the steps and a multiple choice question");
await t.evaluate(async ([u, qs]) => {
    const { db } = await import("/js/firebase.js"); const F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");
    await F.setDoc(F.doc(db, "teacher/" + u + "/games/s_fm"), { id: "fm", title: "ACAP formats", cats: [{ n: "8.11 this week", clues: qs.map((q, i) => JSON.parse(JSON.stringify(Object.assign({}, q, { p: 100 * (i + 1) })))) }], final: null, at: Date.now() });
    const ix = (await F.getDoc(F.doc(db, "teacher/" + u + "/games/index"))).data();
    await F.setDoc(F.doc(db, "teacher/" + u + "/games/index"), { sets: ix.sets.concat([{ id: "fm", title: "ACAP formats" }]), at: Date.now() });
}, [uid, qs.map((q) => { const x = Object.assign({}, q); delete x.c; return x; })]);
await t.goto(BASE + "/remote.html?emu&pack=calera&screen=live&period=2nd&vset=fm");
await t.waitForSelector("text=Open the room", { timeout: 30000 });
for (const label of ["Students must show work before they can submit", "Step-by-step help after a miss"]) { const l = t.locator("label.gpchk", { hasText: label }); if (await l.count()) await l.locator("input").evaluate((n) => { if (n.checked) n.click(); }); }
await t.click("text=Open the room");
await t.waitForSelector("text=Start the game", { timeout: 20000 });
const code = (await getDoc(t, "teacher/" + uid + "/games/room")).code; console.log("room", code);
const S = await ctx(1280, 860); const s = await S.newPage(); watch(s, "student");
await s.goto(BASE + "/play.html?emu&code=" + code);
await s.waitForSelector(".pname", { timeout: 20000 }); await s.click(".pname >> text=Ava R.");
await s.waitForSelector(".pkeys"); for (const d of ["1", "2", "3"]) await s.click(".pkey >> text=" + d);
await s.click("text=Join the game"); await s.waitForSelector(".wroom", { timeout: 20000 }); await sleep(1000);
await t.click("text=Start the game"); await sleep(2000);
const shots = { ms: "12-select-all.png", ord: "13-order-steps.png", mc: "14-not-true.png" };
for (let i = 0; i < 3; i++) {
    await s.waitForSelector("form.pform.ans", { timeout: 15000 });
    const kind = (await s.$(".pachoices.ms")) ? "ms" : (await s.$(".pachoices.ord")) ? "ord" : (await s.$(".pachoices.mc")) ? "mc" : "";
    const q = qs.find((x) => (kind === "mc" ? x.fm !== "ms" && x.fm !== "ord" : x.fm === kind)); assert.ok(q, "answer shape " + kind);
    assert.equal(await s.locator(".pachoices .pachoice").count(), q.ch.length);
    const btns = s.locator(".pachoices .pachoice");
    if (kind === "mc") await btns.nth(q.ch.indexOf(q.a)).click();
    else {
        if (kind === "ord") {   // a half-done order is refused
            await btns.nth("ABCDE".indexOf(q.a[0])).click(); await s.click("form.pform.ans button[type=submit]");
            assert.match(await s.textContent("#pnote"), /Tap every step/); await btns.nth("ABCDE".indexOf(q.a[0])).click();
        }
        for (const L of q.a.split(", ")) await btns.nth("ABCDE".indexOf(L)).click();
    }
    await s.screenshot({ path: OUT + "/" + shots[kind] });
    await s.click("form.pform.ans button[type=submit]"); await sleep(1500);
    const next = s.locator("button", { hasText: /Next question|Keep going|Next/ }).first(); if (await next.count()) await next.click().catch(() => {});
    await sleep(600);
}
const room = await getDoc(t, "teacher/" + uid + "/games/room");
const me = Object.values(room.players || {}).find((p) => p.nm === "Ava R.");
console.log("Ava right", me && me.r, "of", me && me.n);
assert.equal(me.r, 3); assert.equal(me.n, 3);
console.log(logs.length ? logs.join("\n") : "no page errors");
await browser.close();
console.log("spiral e2e: passed");
