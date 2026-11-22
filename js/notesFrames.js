/* ==========================================
   Anchor Board — a day's Guided Notes as frames (one thing on screen at a time).
   Used by the board's Guided Notes screen (js/boardApp.js) and by the slides made from a plan
   (js/slides.js fromPlan, js/weekSlides.js). No page access: plain data in, plain data out.
========================================== */
import { cleanPdf } from "./pdfNotes.js?v=1";

// The day's notes become a list of frames. Each frame is one thing on screen: a question, lines
// that are revealed one tap at a time, and sometimes an answer. The whiteboard sits beside it.
export function notesFrames(d) {
    // The teacher's own PDF notes (Quick lesson): each page is two frames, top half then bottom half.
    const pdf = cleanPdf(d && d.pdf);
    if (pdf) { const F = []; for (let i = 0; i < pdf.pages; i++) [0, 1].forEach((half) => F.push({ kind: "Page " + (i + 1) + " of " + pdf.pages + (half ? " · bottom" : " · top"), q: pdf.title, lines: [], open: true, pdf: { id: pdf.id, n: i, half, w: pdf.w, h: pdf.h } }));
        const ex = d.notes && d.notes.exit; if (ex && ex.length) F.push({ kind: "Exit ticket", q: "On your own. Show every step.", lines: ex.map((p, i) => ({ m: (i + 1) + ". " + p.q })), open: true });
        return F; }
    const n = d && d.notes; if (!n) return [];
    const F = [];
    if (n.targets && n.targets.length) F.push({ kind: "Learning targets", q: "I can…", lines: n.targets.map((t) => ({ m: t })), open: true });
    (n.warmup || []).forEach((p, i, a) => F.push({ kind: "Warm-up " + (i + 1) + " of " + a.length, q: p.q, lines: [], ans: p.a }));
    ((n.vocab && n.vocab.items) || []).forEach((v, i, a) => F.push({ kind: "Vocabulary " + (i + 1) + " of " + a.length, q: v, lines: [], ans: "fill", blanks: true }));
    if (n.bigIdea && n.bigIdea.length) F.push({ kind: "The big idea", q: n.bigIdea[0], lines: n.bigIdea.slice(1).concat(n.steps || []).map((t) => ({ m: t })) });
    (n.examples || []).forEach((e, i, a) => {
        if (e.intro && e.intro.length) F.push({ kind: "Key idea", q: e.intro[0], lines: e.intro.slice(1).map((t) => ({ m: t })) }); // a rule box that sits before this example on the paper notes
        F.push({ kind: "Example " + (i + 1) + " of " + a.length + (e.title ? ": " + e.title : ""), q: e.q, lines: e.steps || [] });
    });
    if (n.guided) F.push({ kind: "Your turn, with help", q: n.guided.q, lines: n.guided.steps || [] });
    (n.practice || []).forEach((part) => (part.problems || []).forEach((p) => F.push({ kind: (part.kind || "Practice") + " " + (p.n || ""), q: p.q, lines: p.work ? [{ m: p.work }] : [], ans: p.a })));
    if (n.exit && n.exit.length) F.push({ kind: "Exit ticket", q: "On your own. Show every step.", lines: n.exit.map((p, i) => ({ m: (i + 1) + ". " + p.q })), open: true });
    return F;
}
