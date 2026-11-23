/* ==========================================
   Anchor Board — the Absences card at the top of Home (Phase 2B, Nov 23 2026). Rules: js/absenceCore.js.
   Reads records the site already keeps (attendance/{day} from the Remote's "Who's out", the Tracker's track/{day},
   the Gradebook, Class Data, Assignments, rosters, game profiles) and writes nothing. First names only (the initial
   only for two students in a period who share a first name). Shows nothing it cannot back up: a day with no lesson
   plan says so.
========================================== */
import * as AC from "./attendanceCore.js?v=1";
import * as K from "./absenceCore.js?v=1";
import { shortNames } from "./vaultCore.js?v=75";
import { kidKey, perKey } from "./profileCore.js?v=2";

const WARN_WORD = { days: "Out often", test: "Test", work: "Graded work", behind: "Was behind" };

export function mountAbsences(opts) {
    const { store, host, el, periods, today } = opts, D = { att: new Map(), trk: new Map(), gb: { items: [], cats: [] }, data: [], asg: [], rost: {}, prof: new Map(), weeks: opts.weeks || [] };
    let timer = null; const seenDays = new Set();
    const soon = () => { clearTimeout(timer); timer = setTimeout(draw, 60); };
    const days = []; for (let i = 0; i < K.WINDOW_DAYS; i++) { const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() - i); const k = K.isoOf(d); if (K.dayIndex(k) >= 0) days.push(k); }
    days.forEach((k) => {
        store.watch("attendance/" + k, (s) => { if (s.pending) return; D.att.set(k, s.exists ? s.data : null); seenDays.add(k); soon(); }, () => { seenDays.add(k); soon(); });
        store.watch("track/" + k, (s) => { if (s.pending) return; D.trk.set(k, s.exists && s.data && s.data.ev ? { day: k, ev: s.data.ev } : null); soon(); }, () => {});
    });
    store.watch("gb/items", (s) => { if (s.pending) return; D.gb.items = (s.exists && s.data && Array.isArray(s.data.list)) ? s.data.list : []; soon(); }, () => {});
    store.watch("gb/setup", (s) => { if (s.pending) return; D.gb.cats = (s.exists && s.data && Array.isArray(s.data.cats)) ? s.data.cats : []; soon(); }, () => {});
    store.watch("data/index", (s) => { if (s.pending) return; D.data = (s.exists && s.data && Array.isArray(s.data.imports)) ? s.data.imports : []; soon(); }, () => {});
    store.watch("asg/index", (s) => { if (s.pending) return; D.asg = (s.exists && s.data && Array.isArray(s.data.list)) ? s.data.list : []; soon(); }, () => {});
    store.watch("rosters/all", (s) => { if (s.pending) return; const p = (s.exists && s.data && s.data.periods) || {}; D.rost = {}; Object.keys(p).forEach((k) => { if (Array.isArray(p[k])) D.rost[k] = shortNames(p[k].filter(Boolean).map((n) => String(n).slice(0, 60))); }); soon(); }, () => {});
    const watchProf = (per) => { if (D.prof.has(per)) return; D.prof.set(per, null); store.watch("profiles/" + perKey(per), (s) => { if (s.pending) return; D.prof.set(per, s.exists ? s.data : false); soon(); }, () => { D.prof.set(per, false); }); };

    const behind = (per, nm, codes) => { watchProf(per); const prof = D.prof.get(per), kid = prof && prof.kids ? prof.kids[kidKey(nm)] : null; return K.behindFromKid(kid, codes); };
    const dash = () => K.buildDashboard({ absences: AC.absences(days.map((k) => ({ day: k, doc: D.att.get(k) })).filter((x) => x.doc), [...D.trk.values()].filter(Boolean)), weeks: D.weeks, periods, gb: D.gb, data: D.data, asg: D.asg, behind, today });

    function draw() {
        host.textContent = "";
        if (seenDays.size < days.length) { host.hidden = false; host.setAttribute("aria-busy", "true"); host.appendChild(el("div", "abs-skel")); return; }   // the shape of the card until the records arrive
        host.removeAttribute("aria-busy");
        const R = dash();
        host.hidden = false;
        const head = el("div", "abs-head"), h = el("h2", null, "Absences"); head.appendChild(h);
        const bits = []; if (R.outToday) bits.push(R.outToday + " out today"); if (R.warned) bits.push(R.warned + (R.warned === 1 ? " needs" : " need") + " a look");
        head.appendChild(el("span", "abs-sum", bits.join(" · "))); host.appendChild(head);
        if (!R.periods.length) { host.appendChild(el("p", "abs-none", "Nobody marked out in the last two weeks. At the start of class, tap who is out on the Remote (Who’s out).")); const a = el("a", "btn ghost", "Open Remote"); a.href = "remote.html"; host.appendChild(a); return; }
        R.periods.forEach((P) => {
            const sec = el("section", "abs-per"), names = D.rost[P.per] || [];
            sec.appendChild(el("h3", null, P.per + " period" + (P.cls ? " · " + (opts.classLabel ? opts.classLabel(P.cls) : P.cls) : "")));
            P.students.forEach((S) => {
                const row = el("article", "abs-kid" + (S.warnings.length ? " warn" : "")), top = el("div", "abs-top");
                top.appendChild(el("b", null, AC.displayName(S.nm, names.length ? names : P.students.map((x) => x.nm))));
                if (S.today) top.appendChild(el("span", "abs-tag out", "Out today"));
                S.warnings.forEach((w) => { const t = el("span", "abs-tag w-" + w.k, WARN_WORD[w.k] || "Look"); t.title = w.text; top.appendChild(t); });
                row.appendChild(top);
                S.warnings.forEach((w) => row.appendChild(el("p", "abs-warn", w.text)));
                S.days.slice(0, 5).forEach((d) => {
                    const line = el("div", "abs-day"); line.appendChild(el("p", "abs-line", d.line));
                    if (d.items.length) { const chips = el("p", "abs-chips"); d.items.forEach((i) => { const c = el("span", "abs-chip " + (i.graded ? "graded" : "practice"), i.t + " · " + (i.graded ? (i.catName ? "graded, " + i.catName : "graded") : "practice")); chips.appendChild(c); }); line.appendChild(chips); }
                    row.appendChild(line);
                });
                if (S.days.length > 5) row.appendChild(el("p", "abs-more", "and " + (S.days.length - 5) + " earlier days"));
                sec.appendChild(row);
            });
            host.appendChild(sec);
        });
    }
    draw();
    return { setWeeks: (w) => { D.weeks = w; soon(); }, refresh: soon };
}
