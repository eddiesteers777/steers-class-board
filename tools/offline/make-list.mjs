// Writes offline.json: every public site file the board, the Remote and the teacher pages can need,
// so the service worker (sw.js) can save them for when the wifi drops.
// Run from the repo root before deploying: node tools/offline/make-list.mjs
// (the deploy workflow does this). Marketing pages (site/), tools, docs and private folders are left out.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIRS = ["js", "css", "data", "brand", "icons"];
const SKIP_HTML = new Set(["googleea7ac023f8b74807.html"]);
const files = [];
const walk = (dir) => {
    for (const name of readdirSync(dir)) {
        if (name.startsWith(".")) continue;
        const p = join(dir, name), st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (!/\.(md|map|log|patch|py|mjs\.test)$/.test(name)) files.push(p.split("\\").join("/"));
    }
};
DIRS.forEach(walk);
for (const name of readdirSync(".")) if (/\.(html|svg|json)$/.test(name) && !SKIP_HTML.has(name) && name !== "firebase.json" && name !== "offline.json") files.push(name);

// Firebase code pinned on gstatic, as the pages import it.
const fb = new Set();
for (const f of files.filter((f) => /\.(js|html)$/.test(f))) {
    for (const m of readFileSync(f, "utf8").matchAll(/https:\/\/www\.gstatic\.com\/firebasejs\/[0-9.]+\/[a-z-]+\.js/g)) fb.add(m[0]);
}
const list = { at: new Date().toISOString(), files: [...files.sort(), ...[...fb].sort()] };
writeFileSync("offline.json", JSON.stringify(list));
console.log("offline.json:", list.files.length, "files");
