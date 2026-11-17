/* ==========================================
   Calera Math — private class tally (Remote only).
   One tap per mark: Participation, On task, Redirect, per student, per day.
   Names show only in this panel on the teacher's Remote. The board and the
   Board view never show it (body.board hides the panel), and nothing here
   goes in the shared board state.
   Saved at teacher/{uid}/tally/{YYYY-MM-DD}:
     { day, periods: { "1st": { "<student name>": { p, t, r } } } }
========================================== */
export const MARKS = [["p", "Participation", "+1"], ["t", "On task", "+1"], ["r", "Redirect", "+1"]];
const localIso = (d = new Date()) => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

/** Pure: add n to one mark, never below 0. Returns a new periods object. */
export function bump(periods, period, name, mark, n) {
    const out = JSON.parse(JSON.stringify(periods || {})), row = ((out[period] = out[period] || {})[name] = out[period][name] || { p: 0, t: 0, r: 0 });
    row[mark] = Math.max(0, Math.min(99, (+row[mark] || 0) + n));
    if (!row.p && !row.t && !row.r) delete out[period][name];
    return out;
}

/** mount({ store, period: () => "1st" }). Call after sign-in. */
export function mount({ store, period }) {
    const open = $("tallyOpen"), panel = $("tally"); if (!open || !panel) return;
    let day = localIso(), periods = {}, roster = {}, unsub = null, busy = 0, pending = null;
    const watchDay = () => {
        if (unsub) unsub();
        unsub = store.watch("tally/" + day, (snap) => { if (snap.pending || busy) return; periods = (snap.exists && snap.data && snap.data.periods) || {}; draw(); }, () => say("The tally is not available right now."));
    };
    const say = (t) => { $("tallyNote").textContent = t || ""; };
    async function save() {
        // One write at a time; taps made meanwhile go out with the next write.
        if (busy) { pending = true; return; }
        busy++;
        try { await store.save("tally/" + day, { day, periods }); say(""); }
        catch (e) { say("Could not save (" + ((e && e.code) || "connection") + "). Your taps stay on this screen; try again."); }
        busy--;
        if (pending) { pending = false; save(); }
    }
    function draw() {
        const p = period(), names = roster[p] || [], list = $("tallyList");
        $("tallyHead").textContent = p + " period · " + new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
        list.textContent = "";
        if (!names.length) { list.appendChild(el("p", "tnote", "No names saved for " + p + " period yet. Add them on the Rosters page.")); return; }
        const tot = { p: 0, t: 0, r: 0 };
        names.forEach((name) => {
            const rec = (periods[p] && periods[p][name]) || { p: 0, t: 0, r: 0 }, row = el("div", "trow");
            row.appendChild(el("span", "tname2", name));
            MARKS.forEach(([k, label]) => {
                tot[k] += rec[k] || 0;
                const b = el("button", "tmark tm-" + k); b.type = "button";
                b.appendChild(el("b", null, String(rec[k] || 0))); b.appendChild(el("small", null, label));
                b.setAttribute("aria-label", label + " for " + name + ", now " + (rec[k] || 0) + ". Tap to add one.");
                b.onclick = () => { periods = bump(periods, p, name, k, 1); draw(); save(); };
                row.appendChild(b);
            });
            const undo = el("button", "tundo", "−"); undo.type = "button"; undo.title = "Take back the last mark for " + name;
            undo.setAttribute("aria-label", "Take back one mark for " + name);
            undo.onclick = () => { const r = (periods[p] || {})[name]; if (!r) return; const k = ["r", "t", "p"].find((x) => r[x] > 0); if (!k) return; periods = bump(periods, p, name, k, -1); draw(); save(); };
            row.appendChild(undo);
            list.appendChild(row);
        });
        $("tallyTot").textContent = "Today: " + tot.p + " participation · " + tot.t + " on task · " + tot.r + " redirects";
    }
    store.watch("rosters/all", (snap) => { const ps = (snap.exists && snap.data && snap.data.periods) || {}; roster = {}; Object.keys(ps).forEach((k) => { if (Array.isArray(ps[k])) roster[k] = ps[k].map((n) => String(n).slice(0, 60)); }); draw(); }, () => {});
    watchDay();
    open.onclick = () => { panel.hidden = !panel.hidden; open.setAttribute("aria-expanded", String(!panel.hidden)); if (!panel.hidden) { if (localIso() !== day) { day = localIso(); periods = {}; watchDay(); } draw(); } };
    $("tallyClose").onclick = () => { panel.hidden = true; open.setAttribute("aria-expanded", "false"); };
    $("periodSel").addEventListener("change", () => { if (!panel.hidden) draw(); });
    let shown = period();   // the Remote can change period from another device; follow it while open
    setInterval(() => { if (localIso() !== day) { day = localIso(); periods = {}; watchDay(); } if (!panel.hidden && period() !== shown) { shown = period(); draw(); } }, 1000);
}
