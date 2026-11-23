/* ==========================================
   Anchor Board — the catch-up video for a missed day (absence dashboard part D, Nov 23 2026). Tests:
   tools/attendance/video.test.mjs. Eddie picked "You make it in Gemini" (Nov 23): Gemini Notebook's Video Overviews
   have no official API, so Anchor hands him a ready pack, he makes the video in Gemini, and pastes its link back.

   One video per class per day, used for every student who missed that day:
     private  teacher/{uid}/catchvid/{weekId} = { v: { "<cls>|<day 0-4>": { u, at, ok } } }
              ok = when Eddie ticked "I watched it and the math matches the worksheet" (0 = not yet)
     public   pub/{uid}/cv/{weekId} = { v: { "<cls>|<day 0-4>": { u, t } } }   only once ok; taking it down removes it
   The public copy is its own document, so approving the week again on Week Review never wipes it. The Class Page
   shows it under that day, next to the guided notes. Students watch it at school (no home Chromebooks).

   The pack is made only from the day's checked guided notes (target, vocabulary, the key idea, the first two worked
   examples, word for word), and tells Gemini not to change a number or add a problem.
========================================== */
import { plain } from "./catchupCore.js?v=1";

export const MAX_MIN = 5;
export const vidKey = (cls, i) => cls + "|" + i;
export const GEMINI_URL = "https://notebooklm.google.com/";

/** Only a plain https link to YouTube or Google Drive / Docs / Gemini Notebook is kept; anything else is "". */
export function cleanUrl(u) {
    let x; try { x = new URL(String(u || "").trim()); } catch (e) { return ""; }
    if (x.protocol !== "https:") return "";
    const h = x.hostname.toLowerCase();
    const ok = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "drive.google.com", "docs.google.com", "notebooklm.google.com", "gemini.google.com"].includes(h);
    return ok && x.href.length <= 500 ? x.href : "";
}
/** How a link plays: { kind: "yt", id } | { kind: "drive", id } | { kind: "link" }. */
export function embedOf(u) {
    const s = String(u || ""), yt = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/.exec(s);
    if (/youtu/.test(s) && yt) return { kind: "yt", id: yt[1] };
    const dr = /drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{20,})/.exec(s);
    if (dr) return { kind: "drive", id: dr[1] };
    return { kind: "link" };
}

const fill = (s) => plain(String(s || "").replace(/\[([^\]]+)\]/g, "$1"));   // "[reciprocal]" -> "reciprocal"
/**
 * The two pieces to paste into Gemini Notebook: source (the lesson, from the checked notes) and ask (the Video
 * Overview instructions). Returns null when the day has no guided notes to make a video from.
 */
export function geminiPack(notes, o = {}) {
    if (!notes || !(notes.examples || []).length) return null;
    const S = [];
    S.push(plain(notes.title || "Lesson") + (o.grade ? " (" + o.grade + ")" : ""));
    if (notes.standard) S.push("Standard: " + plain(notes.standard));
    // "solve ..." becomes "I can solve ..."; a note like "No calculator on the quiz" stays as written
    if ((notes.targets || []).length) S.push("", "Learning target", ...notes.targets.map((t) => { const x = plain(t).replace(/^I can\s*/i, "").trim(); return /^[a-z]/.test(x) ? "I can " + x : x; }));
    const vocab = (notes.vocab && notes.vocab.items) || [];
    if (vocab.length) S.push("", "Vocabulary", ...vocab.map((v) => "- " + fill(v)));
    const big = notes.bigIdea || [];
    if (big.length) S.push("", "Key idea", ...big.map((t) => "- " + plain(t)));
    if ((notes.steps || []).length) S.push("", "Steps", ...notes.steps.map((t, k) => (k + 1) + ". " + plain(t)));
    const ex = notes.examples.filter((e) => e && e.q && (e.steps || []).length).slice(0, 2);
    ex.forEach((e, k) => {
        S.push("", "Worked example " + (k + 1) + (e.title ? ": " + plain(e.title) : ""), plain(e.q));
        e.steps.forEach((st, j) => S.push("  Step " + (j + 1) + ": " + plain(st && st.m != null ? st.m : st) + (st && st.why ? " (" + plain(st.why) + ")" : "")));
    });
    const ask = [
        "Make a short explainer video for " + (o.grade || "middle school") + " math students who missed this lesson" + (o.day ? " (" + o.day + ")" : "") + ". Many of them are still building basic math skills.",
        "Keep it to " + MAX_MIN + " minutes or less. No fluff: no long intro, no history, no jokes, no recap of things not in the source.",
        "Cover only these, in this order: 1) the learning target, 2) the vocabulary words, 3) the key idea, 4) the worked example" + (ex.length > 1 ? "s" : "") + ", one step at a time.",
        "Solve the worked examples exactly as written in the source: the same numbers, the same steps and the same answers. Do not change any number, do not add other problems, and do not use a different method.",
        "Show each step on screen as you say it. Use short sentences.",
        "End with: \"Now try the practice on your worksheet.\"",
    ].join("\n");
    return { source: S.join("\n"), ask, examples: ex.length };
}

/** Private record writes (merge). */
export const linkWrite = (cls, i, u, at = Date.now()) => ({ v: { [vidKey(cls, i)]: { u, at, ok: 0 } } });
export const okWrite = (cls, i, u, ok, at = Date.now()) => ({ v: { [vidKey(cls, i)]: { u, at, ok: ok ? at : 0 } } });
export const clearWrite = (cls, i, at = Date.now()) => ({ v: { [vidKey(cls, i)]: { u: "", at, ok: 0 } } });
/** The public copy for students (only after Eddie checked it), or a removal. */
export const pubWrite = (cls, i, u, title) => ({ v: { [vidKey(cls, i)]: u ? { u, t: String(title || "Catch-up video").slice(0, 80) } : { u: "", t: "" } } });

/** A video record for a class and day, cleaned: { u, ok } or null. */
export function vidOf(doc, cls, i) {
    const r = doc && doc.v && doc.v[vidKey(cls, i)]; if (!r) return null;
    const u = cleanUrl(r.u); return u ? { u, ok: +r.ok || 0, t: typeof r.t === "string" ? r.t.slice(0, 80) : "" } : null;
}

/** The player for a link: YouTube and Drive play in the page after a tap; any other allowed link opens in a new tab. */
export function videoBlock(el, v, label) {
    const box = el("div", "cv-box"), e = embedOf(v.u), title = label || v.t || "Catch-up video";
    box.appendChild(el("b", "cv-title", title));
    if (e.kind === "yt" || e.kind === "drive") {
        const b = el("button", "cv-play", "▶ Play the video"); b.type = "button";
        b.onclick = () => {
            const f = el("iframe", "cv-frame"); f.title = title; f.allowFullscreen = true; f.allow = "autoplay; encrypted-media; picture-in-picture";
            f.src = e.kind === "yt" ? "https://www.youtube-nocookie.com/embed/" + e.id + "?autoplay=1&rel=0" : "https://drive.google.com/file/d/" + e.id + "/preview";
            b.replaceWith(f);
        };
        box.appendChild(b);
    }
    const a = el("a", "cv-open", e.kind === "yt" ? "Open on YouTube" : "Open the video"); a.href = v.u; a.target = "_blank"; a.rel = "noopener"; box.appendChild(a);
    return box;
}
