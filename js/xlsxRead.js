/* ==========================================
   Calera Math — read an Excel (.xlsx) file in the browser, no library.
   An .xlsx file is a zip of XML files. This unzips it with the browser's
   own DecompressionStream and returns every sheet as rows of text cells.
   Percent-formatted cells come back as "85%", dates as "2026-11-17".
   Old .xls files (before 2007) are a different format and are not read.
========================================== */

async function inflate(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const out = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Unzip: returns Map(name -> async () => Uint8Array). */
function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf), files = new Map();
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("not a zip");
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    for (let k = 0; k < count; k++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
        const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
        const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
        const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        const data = u8.subarray(start, start + csize);
        files.set(name, () => method === 0 ? Promise.resolve(data) : inflate(data));
        p += 46 + nlen + xlen + clen;
    }
    return files;
}

const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
const kids = (node, tag) => [...node.getElementsByTagName(tag)];
function colIndex(ref) { let n = 0; for (const ch of String(ref).replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

const DATE_IDS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57]);
function serialDate(v) { const ms = Math.round((+v - 25569) * 86400000); const d = new Date(ms); return isNaN(d) ? String(v) : d.toISOString().slice(0, 10); }
function tidyNumber(n) { return String(Math.round(n * 1e6) / 1e6); }

/** Read an .xlsx File/ArrayBuffer. Returns [{ name, rows: [[cell text]] }]. */
export async function readXlsx(fileOrBuf) {
    const buf = fileOrBuf instanceof ArrayBuffer ? fileOrBuf : await fileOrBuf.arrayBuffer();
    const files = unzip(buf), dec = new TextDecoder();
    const text = async (name) => { const f = files.get(name); return f ? dec.decode(await f()) : null; };

    const shared = [];
    const ss = await text("xl/sharedStrings.xml");
    if (ss) for (const si of kids(xml(ss), "si")) shared.push(kids(si, "t").map((t) => t.textContent).join(""));

    // number formats: which style indexes are percents or dates
    const pctStyle = new Set(), dateStyle = new Set();
    const st = await text("xl/styles.xml");
    if (st) {
        const doc = xml(st), custom = new Map();
        for (const f of kids(doc, "numFmt")) custom.set(+f.getAttribute("numFmtId"), f.getAttribute("formatCode") || "");
        const xfs = doc.getElementsByTagName("cellXfs")[0];
        if (xfs) kids(xfs, "xf").forEach((xf, i) => {
            const id = +xf.getAttribute("numFmtId"), code = custom.get(id) || "";
            if (id === 9 || id === 10 || /%/.test(code)) pctStyle.add(i);
            else if (DATE_IDS.has(id) || (/[dy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, "")) && !/[#0]/.test(code))) dateStyle.add(i);
        });
    }

    // sheet names and their files
    const wb = xml(await text("xl/workbook.xml") || "<w/>"), rels = xml(await text("xl/_rels/workbook.xml.rels") || "<r/>");
    const target = new Map(kids(rels, "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target")]));
    const sheets = [];
    for (const sh of kids(wb, "sheet")) {
        const rid = sh.getAttribute("r:id") || sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
        let t = target.get(rid) || ""; t = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "");
        const body = await text(t); if (!body) continue;
        const rows = [];
        for (const r of kids(xml(body), "row")) {
            const row = [];
            for (const c of kids(r, "c")) {
                const type = c.getAttribute("t"), s = +c.getAttribute("s") || 0, v = (c.getElementsByTagName("v")[0] || {}).textContent;
                let out = "";
                if (type === "s") out = shared[+v] || "";
                else if (type === "inlineStr") out = kids(c, "t").map((x) => x.textContent).join("");
                else if (type === "b") out = v === "1" ? "TRUE" : "FALSE";
                else if (type === "str" || type === "e") out = v || "";
                else if (v != null && v !== "") out = pctStyle.has(s) ? tidyNumber(+v * 100) + "%" : dateStyle.has(s) ? serialDate(v) : tidyNumber(+v);
                const ref = c.getAttribute("r"), idx = ref ? colIndex(ref) : row.length;
                while (row.length < idx) row.push("");
                row[idx] = String(out).trim();
            }
            const rn = +r.getAttribute("r"); if (rn) while (rows.length < rn - 1) rows.push([]);
            rows.push(row);
        }
        sheets.push({ name: sh.getAttribute("name") || "Sheet " + (sheets.length + 1), rows: rows.filter((x) => x.some((c) => c !== "")) });
    }
    return sheets;
}

/** Guess which row holds the column names: the first row about as full as the fullest rows. */
export function guessHeaderRow(rows) {
    const look = rows.slice(0, 25), fill = look.map((r) => r.filter((c) => c !== "").length), most = Math.max(0, ...fill);
    if (most < 2) return 0;
    const named = look.findIndex((r, i) => fill[i] >= most * 0.6 && r.some((c) => /student|name|player|learner/i.test(c)));
    if (named >= 0) return named;
    const i = fill.findIndex((n) => n >= most * 0.6); return i < 0 ? 0 : i;
}
