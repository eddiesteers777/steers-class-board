// Preview pictures of the Absences card's Open Remote button and icon, before (main) and after (this branch). Made-up names only.
// node tools/attendance/remote-btn-shots.mjs <shots dir>   (repo served on :5000, main's copy under /before/)
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs";
const H = "tools/attendance/home-harness.html", OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), errs = [];
const shot = async (name, { w, h, dsf = 1, qs = "", before = false, hover = false }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, timezoneId: "America/Chicago" }), p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(name + ": " + e.message));
    await p.goto("http://127.0.0.1:5000/" + (before ? "before/" : "") + H + "?" + qs);
    await p.waitForSelector(".abs-head", { timeout: 8000 }); await p.waitForTimeout(500);
    if (hover) { await p.hover(".abs-remote"); await p.waitForTimeout(300); }
    const box = await p.evaluate(() => { const a = document.querySelector(".nowcard").getBoundingClientRect(), b = document.querySelector("#absent").getBoundingClientRect(); return { y: Math.max(0, a.top - 12), h: b.bottom - a.top + 24 }; });
    await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: box.y, width: w, height: Math.min(box.h, h * 3) } });
    await ctx.close();
};
const CB = { w: 1366, h: 768 }, PM = { w: 1920, h: 1080, dsf: 2 }, PH = { w: 390, h: 1200, dsf: 2 };
await shot("0-before-chromebook", { ...CB, qs: "scheme=navy&mode=light&empty", before: true });
await shot("1-chromebook-navy", { ...CB, qs: "scheme=navy&mode=light&empty" });
await shot("2-chromebook-hover", { ...CB, qs: "scheme=navy&mode=light&empty", hover: true });
await shot("3-chromebook-teal", { ...CB, qs: "scheme=teal&mode=light&empty" });
await shot("4-chromebook-plum-night", { ...CB, qs: "scheme=plum&mode=dark&empty" });
await shot("5-promethean", { ...PM, qs: "scheme=navy&mode=light&empty" });
await shot("6-phone", { ...PH, qs: "scheme=navy&mode=light&empty" });
await shot("7-icon-with-absences", { ...CB, qs: "scheme=navy&mode=light" });
await shot("8-icon-before-with-absences", { ...CB, qs: "scheme=navy&mode=light", before: true });
await browser.close();
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
console.log("pictures saved to " + OUT);
