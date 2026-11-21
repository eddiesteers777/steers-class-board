/* ==========================================
   Anchor Board — offline copy of the site (service worker)

   Why: the board on the Promethean must keep showing today's lesson when the school wifi drops,
   even if the page reloads (the board reloads itself after repeated connection errors, and a
   Promethean can restart its browser). The lesson data already stays on the device (Firestore's
   offline copy, js/firebase.js). This file keeps the site's own files (pages, code, styles, the
   Firebase code from gstatic, fonts) so the page itself can open with no connection.

   How it answers:
     - The site's own files: the network first, so a new version is always used when online.
       If the network fails or takes longer than a few seconds, the saved copy answers instead,
       and the network answer still refreshes the saved copy when it arrives.
     - Firebase code (pinned versions on www.gstatic.com) and Google Fonts: the saved copy first,
       since those files never change at the same address.
     - Everything else (the database, sign-in, Drive, YouTube) is never touched here.

   After the first visit online it also saves the whole list in offline.json (written by the
   deploy, tools/offline/make-list.mjs) in the background, and refreshes it at most every 6 hours,
   so screens not opened yet (a game, PDF notes) also open offline.

   Nothing private is ever saved here: only public site files. Student and class data stays in
   Firestore's own offline copy, which signing out clears.
========================================== */
const CACHE = "anchor-site-v1";
const WARM_EVERY = 6 * 3600 * 1000;
const NET_WAIT = 4000;   // ms before the saved copy answers a slow request
const CORE = ["board.html", "remote.html", "index.html", "login.html", "brand/logo.svg", "favicon.svg"];
const PINNED = [/^https:\/\/www\.gstatic\.com\/firebasejs\//, /^https:\/\/fonts\.(googleapis|gstatic)\.com\//];

self.addEventListener("install", (event) => {
    self.skipWaiting();
    // Never fail the install over one missing file.
    event.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, { cache: "no-cache" })).catch(() => {})))));
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
        await self.clients.claim();
    })());
});

const sameSite = (url) => url.origin === self.location.origin;
// Firebase's own sign-in pages (/__/auth/...) and anything private stay on the network.
const skipPath = (url) => url.pathname.startsWith("/__/") || url.pathname === "/sw.js";

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (sameSite(url)) {
        if (skipPath(url)) return;
        event.respondWith(networkFirst(req, event));
        if (req.mode === "navigate") event.waitUntil(warmMaybe());
    } else if (PINNED.some((re) => re.test(req.url))) {
        event.respondWith(cacheFirst(req));
    }
});

async function fromCache(req) {
    const c = await caches.open(CACHE);
    // Exact address first; then the same file under any ?v= (pages import code as file.js?v=58).
    return (await c.match(req)) || (await c.match(req, { ignoreSearch: true })) ||
        (req.mode === "navigate" ? await c.match(new URL(req.url).pathname === "/" ? "index.html" : req.url, { ignoreSearch: true }) : undefined);
}

function keep(req, res, opaqueOk) {
    if (!res || !(res.ok || (opaqueOk && res.type === "opaque")) || (res.type !== "basic" && res.type !== "cors" && !opaqueOk)) return;
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
}

function networkFirst(req, event) {
    const net = fetch(req).then((res) => { keep(req, res); return res; });
    event.waitUntil(net.catch(() => {}));   // let a slow answer still refresh the saved copy
    return new Promise((resolve, reject) => {
        let done = false;
        const fallback = async () => {
            if (done) return;
            const hit = await fromCache(req);
            if (hit && !done) { done = true; resolve(hit); }
            return hit;
        };
        const timer = setTimeout(fallback, NET_WAIT);
        net.then((res) => { clearTimeout(timer); if (!done) { done = true; resolve(res); } })
            .catch(async () => {
                clearTimeout(timer);
                if (done) return;
                if (!(await fallback()) && !done) { done = true; resolve(offlinePage(req)); }
            });
    });
}

async function cacheFirst(req) {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    keep(req, res, true);   // the Google Fonts stylesheet comes back opaque (no CORS); still worth keeping
    return res;
}

function offlinePage(req) {
    if (req.mode !== "navigate") return Response.error();
    const html = "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Offline | Anchor Board</title>" +
        "<body style='font:18px system-ui,sans-serif;background:#081B45;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px'>" +
        "<div><h1 style='margin:0 0 8px'>No connection</h1><p style='opacity:.8'>This page has not been saved on this device yet. Open it once while online and it will open offline next time.</p>" +
        "<p><a style='color:#9CC9FF' href='board.html'>Open the board</a></p></div>";
    return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/* ---------- save the whole site in the background ---------- */
let warming = null;
async function warmMaybe() {
    if (warming) return warming;
    warming = (async () => {
        const c = await caches.open(CACHE);
        const stamp = await c.match("__warm");
        const at = stamp ? +(await stamp.text()) || 0 : 0;
        if (Date.now() - at < WARM_EVERY) return;
        let list;
        try { list = await (await fetch("offline.json", { cache: "no-cache" })).json(); } catch { return; }   // offline, or no list on this copy
        const files = Array.isArray(list.files) ? list.files : [];
        for (let i = 0; i < files.length; i += 6) {   // a few at a time, so the school wifi is not flooded
            await Promise.all(files.slice(i, i + 6).map(async (f) => {
                try { const res = await fetch(new Request(f, { cache: "no-cache" })); if (res.ok) await c.put(f, res); } catch { /* try again next time */ }
            }));
        }
        await c.put("__warm", new Response(String(Date.now())));
    })().finally(() => { warming = null; });
    return warming;
}
