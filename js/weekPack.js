/* ==========================================
   Anchor Board — the whole week on paper, from Week Review.

   printPapers(week, papers, title): every paper in one print job, each starting on a new page. The browser's
     print window makes the PDF (or sends it to the printer). Same sheets Week Builder prints.
   saveToDrive(week, groups, onStep): one Google Doc per paper, in the teacher's own Drive:
     Anchor Board/Lessons/<8th Grade>/<2nd Nine Weeks>/<Week 6 (November 30 – December 4)>/
     with the modified group's papers in "Alternate Assignments". A Doc already saved for that paper is left
     alone (the teacher may have edited it), so saving again only adds what is missing.
   Drive uses the "drive.file" permission (js/drive.js): Anchor Board sees only the files it made.
   Google Docs cannot hold a drawn stacked fraction from a web page, so fractions in the Docs read ³⁄₄;
   the printed papers keep real stacked fractions.
========================================== */
import * as Drive from "./drive.js?v=2";
import { nineWeeksOf } from "./schoolCal.js?v=58";
import { TAG } from "./weekPapers.js?v=1";

const ORD = ["", "1st", "2nd", "3rd", "4th"];
const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** The off-screen place sheets are laid out in (paged sheets measure themselves, so they must be in the page). */
function stage() {
    let s = document.getElementById("packPrint");
    if (!s) { s = document.createElement("div"); s.id = "packPrint"; s.setAttribute("aria-hidden", "true"); document.body.appendChild(s); }
    return s;
}
/** Build papers into the stage and wait until paged sheets have split into pages. */
async function lay(week, papers) {
    const s = stage(); s.textContent = "";
    const out = papers.map((p) => {
        const box = document.createElement("div"); box.className = "pk-paper"; box.dataset.id = p.id;
        try { box.appendChild(p.build(week)); } catch (e) { const n = document.createElement("p"); n.textContent = p.file + ": this part of the week could not be read (" + e.message + ")."; box.appendChild(n); }
        s.appendChild(box); return box;
    });
    await frame(); await frame(); await pause(60); await frame();
    return out;
}

/** Print these papers as one job. Resolves after the print window closes. */
export async function printPapers(week, papers, title) {
    if (!papers.length) return;
    await lay(week, papers);
    const was = document.title; document.title = title; document.body.dataset.print = "pack";
    await new Promise((ok) => {
        const done = () => { window.removeEventListener("afterprint", done); ok(); };
        window.addEventListener("afterprint", done);
        window.print();
        setTimeout(done, 1500);   // some browsers block in print() and never send afterprint
    });
    document.title = was; delete document.body.dataset.print; stage().textContent = "";
}

/* ---------- one sheet as a Google Doc ---------- */
const KEEP = ["font-size", "font-weight", "font-style", "color", "background-color", "text-align", "vertical-align",
    "border-top", "border-right", "border-bottom", "border-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "margin-top", "margin-bottom", "width", "height"];
const pt = (v) => v.replace(/(-?[\d.]+)px/g, (m, n) => (Math.round(+n * 0.75 * 10) / 10) + "pt");
const DEFAULT = { "font-style": /^normal$/, "font-weight": /^(400|normal)$/, "color": /^rgb\(0, 0, 0\)$/, "text-align": /^(start|left)$/, "vertical-align": /^baseline$/, "font-size": /^14\.6667px$/ };
["padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-bottom"].forEach((k) => { DEFAULT[k] = /^0px$/; });
const RULE = { w30: 30, w22: 22, w14: 14, w8: 8, w40: 40 };

async function svgToImg(svg) {
    const r = svg.getBoundingClientRect(), w = Math.max(20, Math.round(r.width || +svg.getAttribute("width") || 200)), h = Math.max(20, Math.round(r.height || +svg.getAttribute("height") || 200));
    const c = svg.cloneNode(true); c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); c.setAttribute("width", w); c.setAttribute("height", h);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(c));
    const im = new Image(); await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url; });
    const cv = document.createElement("canvas"); cv.width = w * 2; cv.height = h * 2;
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
    const img = document.createElement("img"); img.src = cv.toDataURL("image/png"); img.width = w; img.height = h; img.alt = "";
    return img;
}

/** A laid-out .sheet as an HTML page Google Drive turns into a Doc: looks copied inline, fractions as ³⁄₄, blanks as lines. */
export async function docHtml(sheet) {
    const copy = sheet.cloneNode(true), a = [sheet, ...sheet.querySelectorAll("*")], b = [copy, ...copy.querySelectorAll("*")];
    a.forEach((n, i) => {
        const cs = getComputedStyle(n), out = [];
        KEEP.forEach((k) => {
            let v = cs.getPropertyValue(k); if (!v) return;
            if ((k === "width" || k === "height") && !/^(TD|TH|TABLE|IMG)$/.test(n.tagName)) return;
            if (/^border/.test(k) && /^0px|none/.test(v)) return;
            if (k === "background-color" && /rgba\(0, 0, 0, 0\)|transparent/.test(v)) return;
            if (DEFAULT[k] && DEFAULT[k].test(v)) return;   // leave out what a Doc does anyway
            out.push(k + ":" + pt(v));
        });
        if (out.length) b[i].setAttribute("style", out.join(";"));
        b[i].removeAttribute("class");
        if (n.classList.contains("frac")) b[i].dataset.frac = "1";
        if (n.classList.contains("rule")) b[i].dataset.rule = String(Object.keys(RULE).find((k) => n.classList.contains(k)) ? RULE[Object.keys(RULE).find((k) => n.classList.contains(k))] : 12);
        if (n.classList.contains("sh-page") && n.previousElementSibling && n.previousElementSibling.classList.contains("sh-page")) b[i].dataset.newpage = "1";
        if (n.classList.contains("newpage")) b[i].dataset.newpage = "1";
        if (n.tagName === "svg" || n.tagName === "SVG") b[i].dataset.svg = String(i);
    });
    copy.querySelectorAll("[data-frac]").forEach((f) => {
        const [top, bot] = [...f.children].map((x) => x.textContent.trim());
        const s = document.createElement("span"); s.innerHTML = "<sup></sup>⁄<sub></sub>"; s.firstChild.textContent = top || ""; s.lastChild.textContent = bot || "";
        f.replaceWith(s);
    });
    copy.querySelectorAll("[data-rule]").forEach((r) => r.replaceWith(document.createTextNode(" " + "_".repeat(+r.dataset.rule || 12) + " ")));
    copy.querySelectorAll("[data-newpage]").forEach((n) => { n.style.pageBreakBefore = "always"; n.style.breakBefore = "page"; });
    for (const s of [...copy.querySelectorAll("[data-svg]")]) {
        try { s.replaceWith(await svgToImg(a[+s.dataset.svg])); } catch { s.replaceWith(document.createTextNode("[picture: see the printed copy]")); }
    }
    copy.querySelectorAll("[data-frac],[data-rule],[data-newpage],[data-svg]").forEach((n) => { delete n.dataset.frac; delete n.dataset.rule; delete n.dataset.newpage; delete n.dataset.svg; });
    copy.removeAttribute("style");
    return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>@page{margin:0.7in}body{font-family:Calibri,Arial,sans-serif;font-size:11pt}table{border-collapse:collapse}</style></head><body>" + copy.innerHTML + "</body></html>";
}

/* ---------- saving to Drive ---------- */
/** Where a class's papers go, as folder names under the Anchor Board folder. */
export function folderPath(week, cid, alt) {
    const q = week.monday ? nineWeeksOf(week.monday) : null, n = (q && q.n) || (/^week\d/.test(week.id || "") ? 2 : +((/^q(\d)/.exec(week.id || "") || [])[1]) || 0);
    const names = ["Lessons", TAG[cid] || cid, (ORD[n] ? ORD[n] + " Nine Weeks" : "School Year"), String((week.label || week.id) + (week.dates ? " (" + week.dates + ")" : "")).replace(/[\\/:*?"<>|]+/g, "-")];
    if (alt) names.push("Alternate Assignments");
    return names;
}

/**
 * Save every paper in groups ([{ cid, papers }]) as Google Docs. Drive must already be connected (from a tap).
 * backup: the js/backup.js module (it owns the Anchor Board folder and the saved Drive settings).
 * Resolves { made, kept, failed: [file], folders: { "<cid>": folderId } }.
 */
export async function saveToDrive(week, groups, backup, onStep = () => {}) {
    onStep("Finding the Anchor Board folder in Drive");
    const { S, root } = await backup.driveRoot();
    const files = S.lessons || (S.lessons = {}), res = { made: 0, kept: 0, failed: [], folders: {} };
    const all = groups.flatMap((g) => g.papers.map((p) => ({ g, p }))), total = all.length;
    let n = 0, since = 0;
    for (const { g, p } of all) {
        n++;
        const key = week.id + "|" + g.cid + "|" + p.id;
        const parent = await Drive.path(folderPath(week, g.cid, p.alt), root);
        if (!p.alt) res.folders[g.cid] = parent;
        if (files[key] && (await Drive.info(files[key]))) { res.kept++; continue; }
        onStep("Saving " + n + " of " + total + ": " + p.file);
        try {
            const [box] = await lay(week, [p]), sheet = box.querySelector(".sheet") || box;
            const html = await docHtml(sheet);
            const f = await Drive.save(new Blob([html], { type: "text/html" }), { name: p.file, parent, as: Drive.DOC });
            files[key] = f.id; res.made++; since++;
            if (since >= 6) { await backup.keepDrive(S); since = 0; }   // so a stopped save does not lose track of what is there
        } catch (e) {
            if (e && e.code && /^drive\/(expired|offline|blocked|off|full)$/.test(e.code)) { await backup.keepDrive(S); stage().textContent = ""; throw e; }
            res.failed.push(p.file);
        }
    }
    stage().textContent = "";
    await backup.keepDrive(S);
    return res;
}
