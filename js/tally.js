/* ==========================================
   Anchor Board — the class tally panel on the Remote (private, never on the board).
   Since Nov 21 it writes to the Class Tracker (js/trackCore.js, teacher/{uid}/track/{day}),
   so the Remote, tracker.html and the student profiles all read one record.
   Three quick marks per student here: Participation, On task, Had to redirect.
   The full tracker (all tags, restroom, notes, picker, history) opens from the panel.
   Older days saved at teacher/{uid}/tally/{day} stay where they are; Student Progress still reads them.
========================================== */
import * as T from "./trackCore.js?v=1";

export const MARKS = [["part", "Participation", 1], ["ontask", "On task", 1], ["redirect", "Redirect", -1]];
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

/** mount({ store, period: () => "1st" }). Call after sign-in. */
export function mount({ store, period }) {
    const open = $("tallyOpen"), panel = $("tally"); if (!open || !panel) return;
    let day = T.localIso(), DOC = null, roster = {}, unsub = null, TAGS = T.cleanTags(null);
    const say = (t) => { $("tallyNote").textContent = t || ""; };
    const full = (p) => "teacher/" + store.rooms.uid() + "/" + p;
    const watchDay = () => {
        if (unsub) unsub();
        unsub = store.watch("track/" + day, (snap) => { if (snap.pending) return; DOC = snap.exists ? snap.data : null; draw(); }, () => say("The tally is not available right now."));
    };
    function write(id, data) {
        DOC = DOC || { day, ev: {} }; DOC.ev = DOC.ev || {}; DOC.ev[id] = Object.assign({}, DOC.ev[id] || {}, data); draw();
        store.rooms.save(full("track/" + day), { day, v: 1, ev: { [id]: data } }, true).then(() => say("")).catch((e) => say("Could not save (" + ((e && e.code) || "connection") + "). Try again."));
    }
    function draw() {
        const p = period(), names = roster[p] || [], list = $("tallyList");
        $("tallyHead").textContent = p + " period · " + new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
        list.textContent = "";
        if (!names.length) { list.appendChild(el("p", "tnote", "No names saved for " + p + " period yet. Add them on the Rosters page.")); return; }
        const evs = T.events(DOC, p), by = T.dayByKid(evs, TAGS), tot = T.totals(evs, TAGS);
        names.forEach((name) => {
            const r = by[name] || { tags: {} }, row = el("div", "trow");
            row.appendChild(el("span", "tname2", name));
            MARKS.forEach(([k, label]) => {
                const n = r.tags[k] || 0, b = el("button", "tmark tm-" + (k === "part" ? "p" : k === "ontask" ? "t" : "r")); b.type = "button";
                b.appendChild(el("b", null, String(n))); b.appendChild(el("small", null, label));
                b.setAttribute("aria-label", label + " for " + name + ", now " + n + ". Tap to add one.");
                b.onclick = () => write(T.newId(), { p, n: name, k, at: Date.now() });
                row.appendChild(b);
            });
            const undo = el("button", "tundo", "−"); undo.type = "button"; undo.title = "Take back the last mark for " + name;
            undo.setAttribute("aria-label", "Take back one mark for " + name);
            undo.onclick = () => { const last = evs.filter((e) => e.n === name && MARKS.some((m) => m[0] === e.k)).pop(); if (last) write(last.id, { x: 1 }); };
            row.appendChild(undo);
            list.appendChild(row);
        });
        $("tallyTot").textContent = "Today: " + tot.good + " positive · " + tot.work + " needs work";
    }
    store.watch("rosters/all", (snap) => { const ps = (snap.exists && snap.data && snap.data.periods) || {}; roster = {}; Object.keys(ps).forEach((k) => { if (Array.isArray(ps[k])) roster[k] = ps[k].map((n) => String(n).slice(0, 60)); }); draw(); }, () => {});
    store.watch("settings/track", (snap) => { if (snap.pending) return; TAGS = T.cleanTags(snap.exists ? snap.data : null); draw(); }, () => {});
    watchDay();
    open.onclick = () => { panel.hidden = !panel.hidden; open.setAttribute("aria-expanded", String(!panel.hidden)); if (!panel.hidden) { if (T.localIso() !== day) { day = T.localIso(); DOC = null; watchDay(); } draw(); } };
    $("tallyClose").onclick = () => { panel.hidden = true; open.setAttribute("aria-expanded", "false"); };
    const full2 = $("tallyFull"); if (full2) full2.onclick = () => { full2.href = "tracker.html?per=" + encodeURIComponent(period()); };
    $("periodSel").addEventListener("change", () => { if (!panel.hidden) draw(); });
    let shown = period();   // the Remote can change period from another device; follow it while open
    setInterval(() => { if (T.localIso() !== day) { day = T.localIso(); DOC = null; watchDay(); } if (!panel.hidden && period() !== shown) { shown = period(); draw(); } }, 1000);
}
