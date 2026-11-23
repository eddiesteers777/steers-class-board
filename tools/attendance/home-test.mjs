// The Absences card on Home, in Chromium with an in-memory store: node tools/attendance/home-test.mjs <shots dir>
// Needs the repo served: python3 -m http.server 5000 (repo root). Made-up names only.
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
import fs from "node:fs"; import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5000/tools/attendance/home-harness.html", OUT = process.argv[2] || "./shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(), logs = [];
for (const [w, h, tag] of [[390, 900, "phone"], [1280, 900, "desktop"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") logs.push(tag + ": " + m.text()); }); p.on("pageerror", (e) => logs.push(tag + " PAGEERROR: " + e.message));
    await p.goto(BASE); await p.waitForSelector(".abs-kid", { timeout: 8000 });
    await p.waitForSelector('.abs-warn:has-text("8.5")', { timeout: 8000 }); await p.waitForSelector('.abs-warn:has-text("foundational")', { timeout: 8000 });   // the "was behind" check waits for the game profile to load
    const txt = await p.textContent("#absent");
    assert.match(txt, /2 out today/); assert.match(txt, /2 need a look/);
    assert.match(txt, /1st period · 8th Grade/); assert.match(txt, /5th period · 7th Grade/);
    assert.match(txt, /Missed Tuesday — Speed Dating Activity, Guided Notes Day 1/);
    assert.match(txt, /Missed Thursday — Test \(make-up needed\)/);
    assert.match(txt, /Speed Dating Activity · graded, Class Work/); assert.match(txt, /Guided Notes Day 1 · practice/);
    assert.match(txt, /Missed Wednesday — Fact Blitz: Integer facts, Guided Notes Day 2/); assert.match(txt, /Fact Blitz: Integer facts · practice/);
    assert.match(txt, /Missed Monday — Guided Notes Day 3/);
    assert.match(txt, /Out often/); assert.match(txt, /Missed 8\.5, which was still being worked on/);
    const names = await p.$$eval(".abs-top b", (b) => b.map((x) => x.textContent)); assert.deepEqual(names, ["Ben", "Cara", "Ava", "Dev"]);
    assert.match(txt, /On the foundational track \(Add integers\)/);   // ACAP Phase 3 placement (found/{period})   // first names only: no last names or initials (no duplicate first names)
    assert.ok(!/Kim|Lopez|Rivera|Patel|Ben K|Cara L|Ava R|Dev P/.test(txt), "no last name or initial anywhere on the card");
    assert.equal(await p.$$eval(".abs-kid.warn", (k) => k.length), 2);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(wide <= 0, tag + " no sideways scroll");
    const small = await p.$$eval(".abs-tag, .abs-chip, .abs-line, .abs-warn", (n) => n.filter((x) => parseFloat(getComputedStyle(x).fontSize) < 12).length); assert.equal(small, 0, tag + " text at least 12px");
    // text must be readable on its own background (the first version passed every text check with white names on a white card)
    const bad = await p.evaluate(() => {
        const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number), f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
        const bg = (n) => { for (let e = n; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba?\(.*,\s*0\)$/.test(c) && c !== "transparent") return c; } return "rgb(255,255,255)"; };
        return [...document.querySelectorAll("#absent h2, #absent h3, #absent b, #absent .abs-sum, #absent .abs-line, #absent .abs-warn, #absent .abs-tag, #absent .abs-chip")].filter((n) => { const a = lum(getComputedStyle(n).color), b = lum(bg(n)), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); return r < 4.5; }).map((n) => n.className + ":" + n.textContent.slice(0, 20));
    });
    assert.deepEqual(bad, [], tag + " low-contrast text: " + bad.join(", "));
    await p.screenshot({ path: `${OUT}/absences-${tag}.png`, fullPage: true });
    // empty state
    await p.goto(BASE + "?empty"); await p.waitForSelector(".abs-none"); assert.match(await p.textContent("#absent"), /Nobody marked out in the last two weeks/);
    assert.equal(await p.$$eval("#absent a", (a) => a.map((x) => x.getAttribute("href"))[0]), "remote.html");
    await ctx.close();
}
await browser.close(); assert.deepEqual(logs, [], logs.join("\n")); console.log("absences card: all checks passed");
