/* ==========================================
   Anchor Board — "This week" on Home: where the week being planned stands, step by step.

   Plan → Built by Claude → Approved → Slides → Printed → Parent messages. Each step reads what the site
   already saves, so nothing has to be ticked twice:
     plans/<id>            the plan (draft or sent)              weekfiles/<id>   the week Claude built
     weekfiles/index       approved weeks                        slides/index     which lessons have slides
     closeout/<id>         papers printed (printed) and Thrillshare posts (done)
   The week shown is this school week until it is approved, then the next school week.
========================================== */
import { SCHOOL_YEAR, addDays, mondayOf, isSchoolDay, nineWeeksOf } from "./schoolCal.js?v=58";
import { weekIdFor } from "./weeksLive.js?v=58";
import { allPapers } from "./weekPapers.js?v=1";
import { plannedDecks } from "./weekSlides.js?v=1";

const isSchoolWeek = (m) => [0, 1, 2, 3, 4].some((i) => isSchoolDay(addDays(m, i)));
/** { id, label, monday } for the school week that starts on Monday m (ids follow the site: week6, q3w2). */
export function weekOf(m) {
    const q = nineWeeksOf(m); if (!q) return null;
    let n = 0; for (let d = mondayOf(q.start); d < m; d = addDays(d, 7)) if (isSchoolWeek(d)) n++;
    return { id: weekIdFor(n, q.n), label: "Week " + n, monday: m };
}
/** The school weeks to look at from day t: this one (if it has school) and the next one. */
export function candidates(t) {
    const out = []; let m = mondayOf(t);
    for (let i = 0; i < 8 && out.length < 2 && m <= SCHOOL_YEAR.last; i++, m = addDays(m, 7)) if (isSchoolWeek(m)) { const w = weekOf(m); if (w) out.push(w); }
    return out;
}

/**
 * The steps for one week. s: { plan, week (object or null), approved, slides (slides/index), co (closeout doc) }.
 * Each step: { k, label, state: "done" | "part" | "todo", note, go: [button, href] }.
 */
export function flowSteps(w, s) {
    const id = w.id, wk = s.week, plan = s.plan, co = s.co || {}, out = [];
    const step = (k, label, state, note, go) => out.push({ k, label, state, note, go });
    step("plan", "Plan", plan && plan.status === "sent" ? "done" : plan ? "part" : "todo",
        plan && plan.status === "sent" ? "Sent to Claude" : plan ? "Draft, not sent yet" : "Not started", ["Plan the Week", "plan.html?week=" + id]);
    step("built", "Built", wk ? "done" : "todo", wk ? "Claude saved the week" : plan && plan.status === "sent" ? "Waiting for Claude" : "After you send the plan", ["Week Review", "review.html?week=" + id]);
    step("approved", "Approved", s.approved ? "done" : "todo", s.approved ? "On the board and Class Pages" : wk ? "Check it and approve" : "—", ["Week Review", "review.html?week=" + id]);
    let sl = { state: "todo", note: "Made when you approve" };
    if (wk) {
        const want = plannedDecks(wk).map((p) => p.key), n = (s.slides && s.slides.n) || {}, have = want.filter((k) => n[k] > 0).length;
        sl = want.length ? { state: have >= want.length ? "done" : have ? "part" : "todo", note: have + " of " + want.length + " lessons" } : { state: "done", note: "No lessons need slides" };
    }
    step("slides", "Slides", sl.state, sl.note, ["Board Builder", "studio.html#slides"]);
    let pr = { state: "todo", note: "Print from Week Review" };
    if (wk) {
        const printed = co.printed || {}, groups = allPapers(wk, {}), all = groups.flatMap((g) => g.papers.map((p) => [g.cid, p.id]));
        const got = all.filter(([c, p]) => printed[c] && printed[c][p]).length;
        pr = all.length ? { state: got >= all.length ? "done" : got ? "part" : "todo", note: got + " of " + all.length + " papers" } : { state: "done", note: "No papers this week" };
    }
    step("printed", "Printed", pr.state, pr.note, ["Week Review", "review.html?week=" + id + "#paper"]);
    const cls = wk ? Object.keys(wk.classes || {}) : [], done = co.done || {}, posted = cls.filter((c) => done[c + ".thrillshare"]).length;
    step("posted", "Parents", !cls.length ? "todo" : posted >= cls.length ? "done" : posted ? "part" : "todo",
        cls.length ? posted + " of " + cls.length + " messages posted" : "After you approve", ["Week Review", "review.html?week=" + id + "#pages"]);
    return out;
}

const NEXT = { plan: "plan the week and send it to Claude", built: "Claude builds the week, then it shows on Week Review", approved: "check the week and approve it", slides: "finish the slides", printed: "print the papers", posted: "post the parent messages" };
/** The first step that is not done (what to do next), or null. */
export const nextStep = (steps) => steps.find((x) => x.state !== "done") || null;

/** The week to show from the candidates: this week until it is approved, then the next. */
export function pickWeek(cands, approvedIds) {
    if (!cands.length) return null;
    if (cands.length > 1 && approvedIds.has(cands[0].id)) return cands[1];
    return cands[0];
}

/**
 * Draw "This week" into host and keep it current. store: boardStore. published: weeks in the site's code
 * (data/weeks.js): those count as built and approved. Returns nothing.
 */
export function mountWeekFlow(store, host, published, today) {
    const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
    const cands = candidates(today); if (!cands.length) { host.hidden = true; return; }
    const S = {}, index = { weeks: [] }; let slides = null;
    const approvedIds = () => new Set(published.map((w) => w.id).concat((index.weeks || []).filter((x) => x && x.approved).map((x) => x.id)));
    const watched = new Set();
    const watchWeek = (id) => {
        if (watched.has(id)) return; watched.add(id); S[id] = { plan: null, week: null, co: {} };
        store.watch("plans/" + id, (s) => { if (s.pending) return; S[id].plan = (s.exists && s.data) || null; draw(); }, () => {});
        store.watch("weekfiles/" + id, (s) => { if (s.pending) return; let w = null; try { w = s.exists && s.data && s.data.json ? JSON.parse(s.data.json) : null; } catch { w = null; } S[id].week = w; draw(); }, () => {});
        store.watch("closeout/" + id, (s) => { if (s.pending) return; S[id].co = (s.exists && s.data) || {}; draw(); }, () => {});
    };
    function draw() {
        const w = pickWeek(cands, approvedIds()); if (!w) { host.hidden = true; return; }
        watchWeek(w.id);
        const pub = published.find((x) => x.id === w.id), st = S[w.id];
        const steps = flowSteps(w, { plan: st.plan, week: st.week || pub || null, approved: approvedIds().has(w.id), slides, co: st.co });
        host.hidden = false; host.textContent = "";
        const head = el("div", "wf-head");
        const when = new Date(w.monday + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
        head.appendChild(el("h2", null, w.label + " · week of " + when));
        const nx = nextStep(steps);
        head.appendChild(el("p", "wf-sum", nx ? "Next: " + NEXT[nx.k] + (nx.state === "part" && nx.k !== "plan" ? " (" + nx.note + ")" : "") + "." : "Everything for this week is done."));
        host.appendChild(head);
        const ol = el("ol", "wf-steps");
        steps.forEach((x) => {
            const li = el("li", "wf-step wf-" + x.state + (nx && nx.k === x.k ? " wf-next" : ""));
            const mark = el("span", "wf-mark", x.state === "done" ? "✓" : x.state === "part" ? "…" : ""); mark.setAttribute("aria-hidden", "true"); li.appendChild(mark);
            const tx = el("span", "wf-tx"); tx.appendChild(el("b", null, x.label)); tx.appendChild(el("small", null, x.note)); li.appendChild(tx);
            li.setAttribute("aria-label", x.label + ": " + (x.state === "done" ? "done" : x.state === "part" ? "partly done" : "not done") + ". " + x.note);
            ol.appendChild(li);
        });
        host.appendChild(ol);
        if (nx && nx.go) { const a = el("a", "btn go", nx.go[0]); a.href = nx.go[1]; a.style.textDecoration = "none"; host.appendChild(a); }
    }
    store.watch("weekfiles/index", (s) => { if (s.pending) return; index.weeks = ((s.exists && s.data) || {}).weeks || []; draw(); }, () => {});
    store.watch("slides/index", (s) => { if (s.pending) return; slides = (s.exists && s.data) || { n: {} }; draw(); }, () => {});
    draw();
}
