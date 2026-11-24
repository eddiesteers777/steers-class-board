/* ==========================================
   Anchor Board — the Absences card at the top of Home (Phase 2B, Nov 23 2026). Rules: js/absenceCore.js.
   Reads records the site already keeps (attendance/{day} from the Remote's "Who's out", the Tracker's track/{day},
   the Gradebook, Class Data, Assignments, rosters, game profiles) and writes nothing. First names only (the initial
   only for two students in a period who share a first name). Shows nothing it cannot back up: a day with no lesson
   plan says so.
========================================== */
import * as AC from "./attendanceCore.js?v=1";
import * as K from "./absenceCore.js?v=2";
import { shortNames } from "./vaultCore.js?v=75";
import { kidKey, perKey } from "./profileCore.js?v=2";
import { placementOf } from "./foundational.js?v=2";
import { nameOf } from "./foundBank.js?v=2";
import { marksOf, STATUS_WORD, ROUTES } from "./catchupCore.js?v=2";

const WARN_WORD = { days: "Out often", test: "Test", work: "Graded work", behind: "Foundational" };

export function mountAbsences(opts) {
    const { store, host, el, periods, today } = opts, D = { att: new Map(), trk: new Map(), gb: { items: [], cats: [] }, data: [], asg: [], rost: {}, prof: new Map(), found: new Map(), cu: new Map(), weeks: opts.weeks || [] };
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

    const watchFound = (per) => { if (D.found.has(per)) return; D.found.set(per, null); store.watch("found/" + perKey(per), (s) => { if (s.pending) return; D.found.set(per, s.exists ? s.data : false); soon(); }, () => { D.found.set(per, false); }); };
    const found = (per, nm) => { watchFound(per); const pl = placementOf(D.found.get(per) || null, nm); return pl ? { skill: nameOf(pl.start) || "" } : null; };
    const watchCu = (per) => { if (D.cu.has(per)) return; D.cu.set(per, null); store.watch("catchup/" + perKey(per), (s) => { if (s.pending) return; D.cu.set(per, s.exists ? s.data : false); soon(); }, () => { D.cu.set(per, false); }); };
    const marks = (per, nm) => { watchCu(per); return marksOf(D.cu.get(per) || null, nm); };
    const behind = (per, nm, codes) => { watchProf(per); const prof = D.prof.get(per), kid = prof && prof.kids ? prof.kids[kidKey(nm)] : null; return K.behindFromKid(kid, codes); };
    const dash = () => K.buildDashboard({ absences: AC.absences(days.map((k) => ({ day: k, doc: D.att.get(k) })).filter((x) => x.doc), [...D.trk.values()].filter(Boolean)), weeks: D.weeks, periods, gb: D.gb, data: D.data, asg: D.asg, behind, found, marks, today });

    function draw() {
        host.textContent = "";
        if (seenDays.size < days.length) { host.hidden = false; host.setAttribute("aria-busy", "true"); host.appendChild(el("div", "abs-skel")); return; }   // the shape of the card until the records arrive
        host.removeAttribute("aria-busy");
        const R = dash();
        host.hidden = false;
        const head = el("div", "abs-head"), h = el("h2", null, "Absences"), ico = el("span", "abs-ico"); ico.setAttribute("aria-hidden", "true"); ico.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 11h6"/></svg>'; head.appendChild(ico); head.appendChild(h);
        const bits = []; if (R.outToday) bits.push(R.outToday + " out today"); if (R.warned) bits.push(R.warned + (R.warned === 1 ? " needs" : " need") + " a look");
        head.appendChild(el("span", "abs-sum", bits.join(" · "))); host.appendChild(head);
        if (!R.periods.length) { host.appendChild(el("p", "abs-none", "Nobody marked out in the last two weeks. At the start of class, tap who is out on the Remote (Who’s out).")); const a = el("a", "btn ghost", "Open Remote"); a.href = "remote.html"; host.appendChild(a); return; }
        // Compact (Eddie, Nov 24: "shrink it down so that it doesn't take up too much space"): one small row per student,
        // the catch-up link on the name line, at most 3 missed days each, and only the first SHOW students until "Show all".
        const SHOW = 4; let n = 0; const extra = [];
        R.periods.forEach((P) => {
            const sec = el("section", "abs-per"), names = D.rost[P.per] || [], grid = el("div", "abs-grid");
            sec.appendChild(el("h3", null, P.per + " period" + (P.cls ? " · " + (opts.classLabel ? opts.classLabel(P.cls) : P.cls) : "")));
            P.students.forEach((S) => {
                const row = el("article", "abs-kid" + (S.warnings.length ? " warn" : "")), top = el("div", "abs-top");
                top.appendChild(el("b", null, AC.displayName(S.nm, names.length ? names : P.students.map((x) => x.nm))));
                if (S.today) top.appendChild(el("span", "abs-tag out", "Out today"));
                if (S.allDone) top.appendChild(el("span", "abs-tag ok", "All caught up"));
                S.warnings.forEach((w) => { const t = el("span", "abs-tag w-" + w.k, WARN_WORD[w.k] || "Look"); t.title = w.text; top.appendChild(t); });
                { const a = el("a", "abs-go" + (S.allDone ? "" : " due"), S.allDone ? "Open catch-up" : "Catch-up"); a.href = "catchup.html?p=" + encodeURIComponent(P.per) + "&k=" + encodeURIComponent(S.key); a.title = S.allDone ? "Open catch-up" : "Catch-up: worksheet and assign"; top.appendChild(a); }
                row.appendChild(top);
                if (S.warnings.length) row.appendChild(el("p", "abs-warn", S.warnings.map((w) => w.text).join(" · ")));
                S.days.slice(0, 3).forEach((d) => {
                    const line = el("div", "abs-day" + (d.mark && d.mark.st === "done" ? " done" : "")), lp = el("p", "abs-line", d.line); line.appendChild(lp);
                    if (d.mark) lp.appendChild(el("span", "abs-tag " + (d.mark.st === "done" ? "ok" : "out") + " abs-st", STATUS_WORD[d.mark.st] + (d.mark.via ? " (" + ROUTES[d.mark.via].name + ")" : "")));
                    // Only graded work gets a chip: that is what must not become a zero. Practice is already named in the line.
                    d.items.filter((i) => i.graded).forEach((i) => { lp.appendChild(document.createTextNode(" ")); lp.appendChild(el("span", "abs-chip graded", i.t + " · " + (i.catName ? "graded, " + i.catName : "graded"))); });
                    row.appendChild(line);
                });
                if (S.days.length > 3) row.appendChild(el("p", "abs-more", "and " + (S.days.length - 3) + " earlier day" + (S.days.length - 3 === 1 ? "" : "s")));
                if (++n > SHOW) { row.hidden = true; extra.push(row); }
                grid.appendChild(row);
            });
            sec.appendChild(grid);
            host.appendChild(sec);
        });
        host.querySelectorAll(".abs-per").forEach((sec) => { if (![...sec.querySelectorAll(".abs-kid")].some((k) => !k.hidden)) { sec.hidden = true; extra.push(sec); } });
        if (extra.length) {
            const more = n - SHOW, b = el("button", "abs-all", "Show all " + n); b.type = "button"; b.setAttribute("aria-expanded", "false");
            b.onclick = () => { const open = b.getAttribute("aria-expanded") !== "true"; extra.forEach((x) => { x.hidden = !open; }); b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "Show fewer" : "Show all " + n; };
            b.title = more + " more not shown"; head.appendChild(b);
        }
    }
    draw();
    return { setWeeks: (w) => { D.weeks = w; soon(); }, refresh: soon };
}
