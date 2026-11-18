/* ==========================================
   Anchor Board — a teacher's own notes as a PDF, shown on the board's Guided Notes.

   The PDF never leaves the browser as a PDF. pdf.js (js/vendor/pdfjs, Apache-2.0) draws each page here,
   and each page is saved as a JPEG picture in the teacher's private data:
     teacher/{uid}/pdfs/<id>              { title, pages, w, h, at }     one per upload
     teacher/{uid}/pdfpages/<id>_<n>      { img: "data:image/jpeg…", n }  one per page (n from 0)
   A day that uses it carries day.pdf = { id, title, pages, w, h } in its week (see js/quickLesson.js).
   On the board each page is two frames, top half then bottom half, so a portrait page fills a
   landscape projector at a readable size. "Whole page" shows all of it. The pen works on top, as always.
========================================== */

export const MAX_PAGES = 20;
const MAX_BYTES = 900000;   // a Firestore document holds up to 1 MiB

let pdfjs = null;
async function lib() {
    if (pdfjs) return pdfjs;
    pdfjs = await import("./vendor/pdfjs/pdf.min.js");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.min.js", import.meta.url).href;
    return pdfjs;
}

/** Draw one page to a JPEG data URL, as large as fits in a Firestore document. */
async function pageImage(page) {
    for (const [width, q] of [[1600, 0.78], [1600, 0.6], [1250, 0.6], [1000, 0.5]]) {
        const base = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: width / base.width });
        const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;
        const url = c.toDataURL("image/jpeg", q);
        if (url.length <= MAX_BYTES) return { url, w: c.width, h: c.height };
    }
    throw Object.assign(new Error("page too detailed"), { code: "page-too-big" });
}

/**
 * Turn a PDF file into saved page pictures. onStep(text) reports progress.
 * Resolves { id, title, pages, w, h } to put on the day. Throws { code } on a bad file.
 */
export async function savePdf(store, file, onStep = () => {}) {
    if (!file || !/pdf$/i.test(file.type || file.name || "")) throw Object.assign(new Error("not a pdf"), { code: "not-pdf" });
    if (file.size > 40 * 1024 * 1024) throw Object.assign(new Error("too big"), { code: "too-big" });
    const P = await lib();
    let doc;
    try { doc = await P.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
    catch (e) { throw Object.assign(new Error("could not read"), { code: e && e.name === "PasswordException" ? "password" : "unreadable" }); }
    const n = Math.min(doc.numPages, MAX_PAGES), id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const title = String(file.name || "Notes").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 60) || "Notes";
    let w = 0, h = 0;
    for (let i = 0; i < n; i++) {
        onStep("Page " + (i + 1) + " of " + n + "…");
        const img = await pageImage(await doc.getPage(i + 1));
        if (!i) { w = img.w; h = img.h; }
        await store.save("pdfpages/" + id + "_" + i, { img: img.url, n: i, at: Date.now() });
    }
    const meta = { id, title, pages: n, w, h };
    await store.save("pdfs/" + id, Object.assign({ at: Date.now(), skipped: doc.numPages - n }, meta));
    try { doc.destroy(); } catch { /* done */ }
    return Object.assign(meta, { skipped: doc.numPages - n });
}

/** A well-formed day.pdf, or null. */
export function cleanPdf(p) {
    if (!p || typeof p !== "object" || typeof p.id !== "string" || !/^[a-z0-9]{4,40}$/i.test(p.id)) return null;
    const pages = Math.max(0, Math.min(MAX_PAGES, Math.floor(+p.pages || 0))); if (!pages) return null;
    return { id: p.id, title: String(p.title || "Notes").slice(0, 60), pages, w: +p.w || 1600, h: +p.h || 2070 };
}

/* ---------- reading pages back (board and Remote) ---------- */
const cache = new Map(), waiting = new Map();
/** The page picture as a data URL, or "" while it loads. onReady() runs once when it arrives. */
export function pageUrl(store, id, n, onReady) {
    const key = id + "_" + n;
    if (cache.has(key)) return cache.get(key);
    if (!waiting.has(key)) {
        waiting.set(key, []);
        let stop = null; const done = (url) => { cache.set(key, url); const fns = waiting.get(key) || []; waiting.delete(key); if (stop) stop(); fns.forEach((f) => f()); };
        stop = store.watch("pdfpages/" + key, (s) => { if (s.pending || (s.fromCache && !s.exists)) return; done(s.exists && s.data && typeof s.data.img === "string" && s.data.img.startsWith("data:image/") ? s.data.img : "x"); }, () => {});
    }
    if (onReady) waiting.get(key).push(onReady);
    return "";
}
