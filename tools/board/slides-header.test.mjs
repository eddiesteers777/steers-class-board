// The Slides header never runs under Menu (Nov 24, Eddie's screenshot: "Teach this slide" under "Menu" at 1366 with three
// classes). Demo week, with and without three classes, at 13 widths: the lesson row fits, nothing reaches Menu, no sideways
// page scroll, and from 1024 up every day button shows. node tools/board/slides-header.test.mjs (repo served at 127.0.0.1:5000)
const pw = await import(process.env.PLAYWRIGHT || "playwright"), { chromium } = pw.default || pw;
const b = await chromium.launch(); let bad = 0;
for (const three of [true, false]) for (const w of [1920, 1600, 1440, 1366, 1280, 1240, 1180, 1100, 1024, 960, 900, 870, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
  if (three) await ctx.route(/data\/demo-week\.js/, async (r) => { const res = await r.fetch(); let t = await res.text(); t = t.replace("export default", "const __w =") + "\nconst __c = Object.keys(__w.classes)[0]; __w.classes['7th'] = Object.assign({}, __w.classes[__c], { label: '7th Grade' }); __w.classes['8th-acc'] = Object.assign({}, __w.classes[__c], { label: '8th Grade Accelerated' }); export default __w;"; r.fulfill({ body: t, contentType: "text/javascript" }); });
  const p = await ctx.newPage(); await p.goto("http://127.0.0.1:5000/studio.html?demo#slides"); await p.waitForSelector("#slFilm .sfsel"); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const slot = document.getElementById("slBarSlot"), row = slot.firstElementChild, menu = document.querySelector(".cbar details.acct summary"), teach = document.querySelector(".slteach");
    const m = menu.getBoundingClientRect(), t = teach.getBoundingClientRect(), more = teach.nextElementSibling ? teach.nextElementSibling.getBoundingClientRect() : t;
    return { over: Math.round(row.scrollWidth - slot.clientWidth), pageX: document.documentElement.scrollWidth - innerWidth, hitsMenu: Math.round(Math.max(t.right, more.right) - m.left), slot: Math.round(slot.clientWidth), teach: teach.innerText.trim() || "(icon)", daysClip: (() => { const d = document.querySelector(".sldays"); return d.scrollWidth - d.clientWidth; })() }; });
  const ok = r.over <= 1 && r.pageX <= 0 && (r.hitsMenu <= 0 || w <= 860) && (w < 1024 || r.daysClip <= 1);
  if (!ok) bad++;
  console.log((ok ? "ok  " : "BAD ") + w + (three ? " 3cls " : " 1cls ") + JSON.stringify(r));
  await ctx.close();
}
await b.close(); if (bad) { console.error(bad + " widths overflow"); process.exit(1); } console.log("slides header fits at every width: all checks passed");
