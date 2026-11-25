// Preview pictures of Home's Today card and Absences card in every Settings color scheme (made-up names only):
// node tools/attendance/home-shots.mjs <shots dir>   (repo served: python3 -m http.server 5000)
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs";
const BASE = "http://127.0.0.1:5000/tools/attendance/home-harness.html", OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const SCHEMES = ["navy", "royal", "ocean", "teal", "forest", "plum", "berry", "crimson", "slate"];
const browser = await chromium.launch(), errs = [];
const shot = async (w, h, qs, name, open) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: "America/Chicago" }), p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(name + ": " + e.message));
    await p.goto(BASE + "?" + qs); await p.waitForSelector(".abs-kid", { timeout: 8000, state: "attached" }); if (open) { await p.click('.abs-per > summary >> nth=0'); if (open !== true) await p.click('.abs-kid:has(b:text-is("' + open + '")) summary'); } await p.waitForTimeout(400);
    const box = await p.evaluate(() => { const a = document.querySelector(".nowcard").getBoundingClientRect(), b = document.querySelector("#absent").getBoundingClientRect(); return { y: Math.max(0, a.top - 12), h: b.bottom - a.top + 24 }; });
    await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: box.y, width: w, height: box.h } });
    await ctx.close();
};
for (const s of SCHEMES) await shot(1280, 1000, "scheme=" + s + "&mode=light", "home-" + s);
await shot(1280, 1000, "scheme=navy&mode=dark", "home-navy-night");
await shot(1280, 1000, "scheme=plum&mode=dark", "home-plum-night");
await shot(390, 1400, "scheme=navy&mode=light", "home-phone");
await shot(1280, 1000, "scheme=navy&mode=light", "home-navy-open", "Ben");
await shot(390, 1400, "scheme=teal&mode=light", "home-phone-open", "Ben");
await shot(1280, 1000, "scheme=teal&mode=light&many", "home-teal-period-open", true);
await browser.close();
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
console.log("home preview pictures saved to " + OUT);
