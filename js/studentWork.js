/* ==========================================
   Calera Math — student work helpers (no network).
   - shrink(file): a phone photo or image -> a small grey "scan" JPEG.
   - rotate(dataUrl): turn a saved page a quarter turn.
   - buildPdf(pages, cover): one PDF of every page, each labelled with the
     student's name, made in the browser so it can be handed to Claude for
     grading. Student work is saved only under teacher/{uid}/work/...,
     never in this public repo.
========================================== */

// Kept small so a year of papers fits the database's free space: about 70-120 KB a page,
// still sharp enough to read pencil work at full screen.
const MAX_SIDE = 1400, QUALITY = 0.6;

function canvasFor(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
const toUrl = (c) => c.toDataURL("image/jpeg", QUALITY);

/** Grey, a little more contrast, white paper stays white. */
function scanLook(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    // paper level: a bright percentile of the brightness, so shadows do not grey the page
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 16) hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++;
    let total = 0; for (const n of hist) total += n;
    let acc = 0, paper = 255; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.25) { paper = v; break; } }
    const white = Math.max(120, paper - 6), black = 30, span = white - black;
    for (let i = 0; i < d.length; i += 4) {
        let y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        y = ((y - black) / span) * 255; y = y < 0 ? 0 : y > 255 ? 255 : y;
        d[i] = d[i + 1] = d[i + 2] = y;
    }
    ctx.putImageData(img, 0, 0);
}

/** A photo or image file -> { url (JPEG data URL), w, h, bytes }. */
export async function shrink(file, { grey = true } = {}) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k), c = canvasFor(w, h), ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    if (grey) scanLook(ctx, w, h);
    let url = toUrl(c);
    for (const q of [0.6, 0.5, 0.4]) if (url.length > 900000) url = c.toDataURL("image/jpeg", q);   // one saved page must stay under 1 MB
    return { url, w, h, bytes: Math.round(url.length * 0.75) };
}

/**
 * A scanned PDF (the copier's scan-to-email file) -> one small grey picture per page:
 * [{ url, w, h, bytes }]. onStep(done, total) reports progress. Nothing leaves the browser.
 */
let pdfjs = null;
export async function pdfPages(file, onStep = () => {}) {
    if (!pdfjs) {
        pdfjs = await import("./vendor/pdfjs/pdf.min.js");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.min.js", import.meta.url).href;
    }
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, out = [];
    try {
        for (let n = 1; n <= doc.numPages; n++) {
            onStep(n - 1, doc.numPages);
            const page = await doc.getPage(n), base = page.getViewport({ scale: 1 });
            const k = Math.min(MAX_SIDE / Math.max(base.width, base.height), 4), vp = page.getViewport({ scale: k });
            const c = canvasFor(Math.round(vp.width), Math.round(vp.height)), ctx = c.getContext("2d", { willReadFrequently: true });
            ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            scanLook(ctx, c.width, c.height);
            let url = toUrl(c);
            for (const q of [0.5, 0.4]) if (url.length > 900000) url = c.toDataURL("image/jpeg", q);
            out.push({ url, w: c.width, h: c.height, bytes: Math.round(url.length * 0.75) });
            page.cleanup();
        }
        onStep(doc.numPages, doc.numPages);
    } finally { doc.destroy(); }
    return out;
}

function loadImg(url) { return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; }); }

/** Turn a saved page a quarter turn clockwise (dir 1) or back (dir -1). */
export async function rotate(url, dir = 1) {
    const i = await loadImg(url), c = canvasFor(i.height, i.width), ctx = c.getContext("2d");
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate(dir * Math.PI / 2); ctx.drawImage(i, -i.width / 2, -i.height / 2);
    const out = toUrl(c); return { url: out, w: c.width, h: c.height, bytes: Math.round(out.length * 0.75) };
}

// ---------- PDF ----------
const enc = new TextEncoder();
const latin = (s) => String(s == null ? "" : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "?");
const pdfText = (s) => "(" + latin(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ")";
function b64bytes(url) { const b = atob(url.slice(url.indexOf(",") + 1)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

/** Wrap text to lines of about n characters. */
function wrap(s, n) {
    const out = []; for (const para of latin(s).split(/\n/)) {
        let line = ""; for (const w of para.split(/\s+/)) { if ((line + " " + w).trim().length > n) { if (line) out.push(line); line = w; } else line = (line + " " + w).trim(); }
        out.push(line);
    } return out;
}

/**
 * pages: [{ url, w, h, label }] in order. cover: { title, lines: [text] }.
 * Returns a Blob (application/pdf), US Letter pages.
 */
export function buildPdf(pages, cover) {
    const W = 612, H = 792, M = 28, parts = [], offsets = [];
    let size = 0; const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); size += b.length; };
    const objs = []; const add = (fn) => { objs.push(fn); return objs.length; };   // object numbers start at 1
    const CATALOG = add(), PAGES = add(), FONT = add(), BOLD = add();
    const pageIds = [];

    function textPage(title, lines) {
        let y = H - 64, s = "BT /F2 20 Tf " + M * 2 + " " + y + " Td " + pdfText(title) + " Tj ET\n"; y -= 34;
        for (const l of lines) { for (const w of wrap(l, 92)) { if (y < 50) break; s += "BT /F1 11 Tf " + M * 2 + " " + y + " Td " + pdfText(w) + " Tj ET\n"; y -= 16; } y -= 4; }
        const content = add(), page = add(); pageIds.push(page);
        objs[content - 1] = () => stream("", enc.encode(s));
        objs[page - 1] = () => "<< /Type /Page /Parent " + PAGES + " 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 " + FONT + " 0 R /F2 " + BOLD + " 0 R >> >> /Contents " + content + " 0 R >>";
    }
    function stream(dict, bytes) { return [enc.encode("<< " + dict + " /Length " + bytes.length + " >>\nstream\n"), bytes, enc.encode("\nendstream")]; }

    if (cover) textPage(cover.title, cover.lines || []);
    pages.forEach((pg) => {
        const img = add(), content = add(), page = add(); pageIds.push(page);
        const jpg = b64bytes(pg.url);
        objs[img - 1] = () => stream("/Type /XObject /Subtype /Image /Width " + pg.w + " /Height " + pg.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", jpg);
        const top = 34, aw = W - 2 * M, ah = H - 2 * M - top, k = Math.min(aw / pg.w, ah / pg.h), dw = pg.w * k, dh = pg.h * k;
        const x = (W - dw) / 2, y = M + (ah - dh);
        const s = "BT /F2 13 Tf " + M + " " + (H - M - 14) + " Td " + pdfText(pg.label) + " Tj ET\n" +
            "q " + dw.toFixed(2) + " 0 0 " + dh.toFixed(2) + " " + x.toFixed(2) + " " + y.toFixed(2) + " cm /Im0 Do Q\n";
        objs[content - 1] = () => stream("", enc.encode(s));
        objs[page - 1] = () => "<< /Type /Page /Parent " + PAGES + " 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 " + FONT + " 0 R /F2 " + BOLD + " 0 R >> /XObject << /Im0 " + img + " 0 R >> >> /Contents " + content + " 0 R >>";
    });
    objs[CATALOG - 1] = () => "<< /Type /Catalog /Pages " + PAGES + " 0 R >>";
    objs[PAGES - 1] = () => "<< /Type /Pages /Kids [" + pageIds.map((n) => n + " 0 R").join(" ") + "] /Count " + pageIds.length + " >>";
    objs[FONT - 1] = () => "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objs[BOLD - 1] = () => "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    objs.forEach((fn, i) => {
        offsets[i] = size; push((i + 1) + " 0 obj\n");
        const body = fn(); (Array.isArray(body) ? body : [body]).forEach(push); push("\nendobj\n");
    });
    const xref = size;
    push("xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join(""));
    push("trailer\n<< /Size " + (objs.length + 1) + " /Root " + CATALOG + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(parts, { type: "application/pdf" });
}

/** "12.3 MB" */
export const mb = (bytes) => (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0) + " MB";
