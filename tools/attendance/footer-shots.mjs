// Before and after pictures of the bottom of Home, for removing its footer (Nov 24). No sign-in: the page is
// kept from sending a signed-out visitor to login.html, so only the page's own layout shows.
// node tools/attendance/footer-shots.mjs <shots dir>   (repo served: python3 -m http.server 5000; before.html = main's index.html)
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs";
const OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const shot = async (file, w, h, name) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage();
    await p.route("**/login.html*", (r) => r.fulfill({ status: 204, body: "" }));   // a 204 keeps the page where it is
    await p.goto("http://127.0.0.1:5000/" + file); await p.waitForTimeout(4000);
    const info = await p.evaluate(() => { const f = document.querySelector(".pub-footer"); return { footer: !!f && getComputedStyle(f).display !== "none" && f.offsetHeight > 0, h: document.documentElement.scrollHeight }; });
    console.log(name, JSON.stringify(info));
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    await ctx.close();
};
await shot("before.html", 1280, 900, "footer-before");
await shot("index.html", 1280, 900, "footer-after");
await shot("before.html", 390, 800, "footer-before-phone");
await shot("index.html", 390, 800, "footer-after-phone");
await browser.close();
