/* ==========================================
   Anchor Board — one absent student's catch-up (catchup.html?p=<period>&k=<kidKey>). Rules: js/catchupCore.js,
   js/absenceCore.js. Opened from the Absences card on Home.

   For each day the student missed (last two weeks): the plain line, the day's own papers from the week file (shown
   right here, printable; never a key), and the catch-up choice:
     DeltaMath   the platform does some of the teaching (practice, homework, catch-up, built-in help)
     Magma Math  you lead it (your pacing, your explaining, on the board)
   Choosing one shows the practice to paste (copied from that day's checked notes, else Phase 1's standards bank)
   and "Mark assigned"; "Mark caught up" clears the day from the warnings on Home. Writes only
   teacher/{uid}/catchup/{period}, one student and day at a time. First names only.
========================================== */
import * as AC from "./attendanceCore.js?v=1";
import * as K from "./absenceCore.js?v=2";
import * as CU from "./catchupCore.js?v=2";
import { papersFor } from "./weekPapers.js?v=1";
import { kidKey, perKey } from "./profileCore.js?v=2";
import { shortNames } from "./vaultCore.js?v=75";
import * as V from "./catchupVideo.js?v=2";

/**
 * o = { store, el, host, periods, weeks, per, key, today, print(week, papers, title), bank() -> Promise<items>,
 *       copyVersion, poolFor (js/acapAssign.js), save(path, data) -> Promise (merge write to teacher/{uid}/<path>),
 *       savePub(path, data) -> Promise (merge write to pub/{uid}/<path>: the checked catch-up video students see), grade }
 */
export function mountCatchup(o) {
    const { store, el, host, periods, per, key, today } = o;
    const D = { att: new Map(), trk: new Map(), gb: { items: [], cats: [] }, data: [], asg: [], names: [], mk: null, vid: new Map(), weeks: o.weeks || [] };
    const S = { open: {}, route: {}, show: {}, note: "", vin: {}, pack: {} };
    let timer = null; const seen = new Set();
    const soon = () => { clearTimeout(timer); timer = setTimeout(draw, 40); };
    const cls = ((periods || []).find((p) => p[0] === per) || [])[1] || "";
    const days = []; for (let i = 0; i < K.WINDOW_DAYS; i++) { const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() - i); const k = K.isoOf(d); if (K.dayIndex(k) >= 0) days.push(k); }
    days.forEach((k) => {
        store.watch("attendance/" + k, (s) => { if (s.pending) return; D.att.set(k, s.exists ? s.data : null); seen.add(k); soon(); }, () => { seen.add(k); soon(); });
        store.watch("track/" + k, (s) => { if (s.pending) return; D.trk.set(k, s.exists && s.data && s.data.ev ? { day: k, ev: s.data.ev } : null); soon(); }, () => {});
    });
    store.watch("gb/items", (s) => { if (s.pending) return; D.gb.items = (s.exists && s.data && Array.isArray(s.data.list)) ? s.data.list : []; soon(); }, () => {});
    store.watch("gb/setup", (s) => { if (s.pending) return; D.gb.cats = (s.exists && s.data && Array.isArray(s.data.cats)) ? s.data.cats : []; soon(); }, () => {});
    store.watch("data/index", (s) => { if (s.pending) return; D.data = (s.exists && s.data && Array.isArray(s.data.imports)) ? s.data.imports : []; soon(); }, () => {});
    store.watch("asg/index", (s) => { if (s.pending) return; D.asg = (s.exists && s.data && Array.isArray(s.data.list)) ? s.data.list : []; soon(); }, () => {});
    store.watch("rosters/all", (s) => { if (s.pending) return; const p = (s.exists && s.data && s.data.periods) || {}; D.names = shortNames(((p[per] || []).filter(Boolean)).map((n) => String(n).slice(0, 60))); soon(); }, () => {});
    store.watch("catchup/" + perKey(per), (s) => { if (s.pending) return; D.mk = s.exists ? s.data : {}; soon(); }, () => { D.mk = {}; soon(); });

    /** The day's catch-up video (one per class and day, shared by every student who missed it): teacher/{uid}/catchvid/{weekId}. */
    const watchVid = (id) => { if (D.vid.has(id)) return; D.vid.set(id, null); store.watch("catchvid/" + id, (s) => { if (s.pending) return; D.vid.set(id, s.exists ? s.data : {}); soon(); }, () => { D.vid.set(id, {}); soon(); }); };
    async function setVid(w, i, priv, pub) {
        S.note = "";
        const d = D.vid.get(w.id) || {}; d.v = Object.assign({}, d.v, priv.v); D.vid.set(w.id, d); draw();   // show it at once
        try { await o.save("catchvid/" + w.id, priv); if (pub) await o.savePub("cv/" + w.id, pub); }
        catch (e) { S.note = "The video link did not save (" + ((e && e.code) || "connection") + "). Try again."; draw(); }
    }
    function videoSection(card, d, w) {
        const i = K.dayIndex(d.day), sid = w.id + "|" + i; watchVid(w.id);
        card.appendChild(el("h3", null, "Catch-up video"));
        const doc = D.vid.get(w.id); if (doc === null) { card.appendChild(el("p", "cu-hint", "Loading…")); return; }
        const v = V.vidOf(doc, cls, i), dayLabel = d.name + " " + d.day.slice(5).replace("-", "/");
        if (v) {
            card.appendChild(V.videoBlock(el, v, "Catch-up video: " + dayLabel));
            const st = el("p", "cu-hint", v.ok ? "Checked and showing on the Class Page under " + d.name + ". One video for everyone who missed this day." : "Not on the Class Page yet. Watch it first: students see it only after you tick the box.");
            card.appendChild(st);
            const row = el("div", "cu-marks");
            const lab = el("label", "cv-ok"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!v.ok;
            cb.onchange = () => setVid(w, i, V.okWrite(cls, i, v.u, cb.checked), V.pubWrite(cls, i, cb.checked ? v.u : "", "Catch-up video: " + dayLabel));
            lab.append(cb, el("span", null, "I watched it: the math matches the worksheet. Show it to students.")); row.appendChild(lab); card.appendChild(row);
            const acts = el("div", "cu-marks");
            const cp = el("button", "btn ghost", "Copy link for Schoology"); cp.type = "button"; cp.onclick = async () => { try { await navigator.clipboard.writeText(v.u); cp.textContent = "Link copied"; } catch (e) { cp.textContent = v.u; } };
            const rm = el("button", "btn ghost", "Remove video"); rm.type = "button"; rm.onclick = () => setVid(w, i, V.clearWrite(cls, i), V.pubWrite(cls, i, "", ""));
            acts.append(cp, rm); card.appendChild(acts);
            return;
        }
        const notes = notesOf(d.day), pack = V.geminiPack(notes, { grade: o.grade ? o.grade(cls) : "", day: dayLabel });
        if (!pack) { card.appendChild(el("p", "cu-hint", "No guided notes for this day, so there is nothing to make a video from.")); return; }
        if (!S.pack[sid]) {
            const b = el("button", "btn", "Make it in Gemini"); b.type = "button"; b.onclick = () => { S.pack[sid] = true; draw(); };
            card.appendChild(el("p", "cu-hint", "One short video for everyone who missed " + d.name + ": the learning target, vocabulary and " + pack.examples + " worked example" + (pack.examples > 1 ? "s" : "") + " from these notes."));
            card.appendChild(b);
        } else {
            const steps = el("ol", "cv-steps");
            [["Open Gemini Notebook and start a new notebook.", null],
             ["Add a source: choose Copied text and paste the lesson.", "lesson"],
             ["In Studio, choose Video Overview, open its options and paste the instructions.", "ask"],
             ["When it is ready, download it, put it in Google Drive, share it so students can open it, and paste the link below.", null]].forEach(([t, k]) => {
                const li = el("li", null, t);
                if (k) { const btn = el("button", "btn ghost", k === "lesson" ? "Copy the lesson" : "Copy the instructions"); btn.type = "button"; const txt = k === "lesson" ? pack.source : pack.ask; btn.onclick = async () => { try { await navigator.clipboard.writeText(txt); btn.textContent = "Copied"; } catch (e) { btn.textContent = "Select and copy below"; } }; li.appendChild(btn); }
                steps.appendChild(li);
            });
            card.appendChild(steps);
            const open = el("a", "btn ghost", "Open Gemini Notebook"); open.href = V.GEMINI_URL; open.target = "_blank"; open.rel = "noopener"; card.appendChild(open);
            const det = el("details", "cv-see"); det.appendChild(el("summary", null, "See what you are pasting"));
            const ta1 = el("textarea", "cu-copy"); ta1.readOnly = true; ta1.rows = 8; ta1.value = pack.source; ta1.setAttribute("aria-label", "The lesson for Gemini");
            const ta2 = el("textarea", "cu-copy"); ta2.readOnly = true; ta2.rows = 6; ta2.value = pack.ask; ta2.setAttribute("aria-label", "The video instructions for Gemini");
            det.append(ta1, ta2); card.appendChild(det);
        }
        const f = el("div", "cv-link"), lab = el("label", null), inp = el("input"); inp.type = "url"; inp.placeholder = "https://drive.google.com/file/d/…"; inp.value = S.vin[sid] || ""; inp.setAttribute("aria-label", "Video link for " + d.name);
        inp.oninput = () => { S.vin[sid] = inp.value; };
        lab.append(el("span", null, "Video link"), inp);
        const go = el("button", "btn go", "Save link"); go.type = "button";
        go.onclick = () => { const u = V.cleanUrl(inp.value); if (!u) { S.note = "That link will not work here. Use a Google Drive or YouTube link that starts with https://."; draw(); return; } delete S.vin[sid]; setVid(w, i, V.linkWrite(cls, i, u), null); };
        f.append(lab, go); card.appendChild(f);
    }

    /** This student's missed days, from the same records the Home card reads. */
    function student() {
        const all = AC.absences(days.map((k) => ({ day: k, doc: D.att.get(k) })).filter((x) => x.doc), [...D.trk.values()].filter(Boolean)).filter((a) => a.per === per && a.key === key);
        if (!all.length) return null;
        const nm = all[0].nm, marks = CU.marksOf(D.mk, nm);
        const R = K.buildDashboard({ absences: all, weeks: D.weeks, periods, gb: D.gb, data: D.data, asg: D.asg, marks: () => marks, today });
        return R.periods.length ? R.periods[0].students[0] : null;
    }
    const weekOf = (day) => K.weekFor(D.weeks, day);
    const notesOf = (day) => { const w = weekOf(day), c = w && w.classes && w.classes[cls], d = c && c.days[K.dayIndex(day)]; return (d && d.notes) || null; };

    async function practice(day, route) {
        const dl = K.dayName(day) + ", " + day.slice(5).replace("-", "/");
        const fromNotes = CU.copyFromNotes(notesOf(day), route, dl);
        if (fromNotes.n) return { text: fromNotes.text, from: "the guided notes for that day" };
        const codes = K.standardsFor({ weeks: D.weeks, periods, per, day });
        if (codes.length && o.bank && o.copyVersion && o.poolFor) {
            try {
                const items = await o.bank(), cv = o.copyVersion({ code: codes[0], text: "", calc: "", pool: o.poolFor(items, cls, codes[0], "developing", 11) }, key + day);
                if (cv.n) return { text: "For " + CU.ROUTES[route].name + ": " + CU.ROUTES[route].when + "\n\n" + cv.text, from: "the standards bank (" + codes[0] + ")" };
            } catch (e) { /* the bank did not load: say so below */ }
        }
        return { text: "", from: "" };
    }
    async function mark(nm, day, st, via) {
        S.note = "";
        const w = st ? CU.markWrite(nm, day, st, via) : CU.clearWrite(nm, day);
        // show it at once; the store keeps the write until the wifi is back
        D.mk = D.mk || {}; D.mk.kids = D.mk.kids || {}; const k = kidKey(nm), cur = D.mk.kids[k] || { nm, d: {} };
        cur.d = Object.assign({}, cur.d, w.kids[k].d); D.mk.kids[k] = cur; draw();
        try { await o.save("catchup/" + perKey(per), w); } catch (e) { S.note = "That did not save (" + ((e && e.code) || "connection") + "). Try again."; draw(); }
    }

    function draw() {
        host.textContent = "";
        if (seen.size < days.length || D.mk === null) { host.setAttribute("aria-busy", "true"); host.appendChild(el("div", "cu-skel")); return; }
        host.removeAttribute("aria-busy");
        const s = student();
        if (!s) {
            host.appendChild(el("h1", null, "Catch-up"));
            host.appendChild(el("p", "cu-lead", "No absences for this student in " + per + " period in the last two weeks."));
            const a = el("a", "btn ghost", "Back to Home"); a.href = "index.html"; host.appendChild(a); return;
        }
        const shown = AC.displayName(s.nm, D.names.length ? D.names : [s.nm]);
        document.title = shown + " catch-up | Anchor Board";
        host.appendChild(el("h1", null, shown + ": catch-up"));
        host.appendChild(el("p", "cu-lead", per + " period. " + (s.allDone ? "All caught up." : s.days.filter((d) => !(d.mark && d.mark.st === "done")).length + " of " + s.days.length + " missed days still to catch up.")));
        s.warnings.forEach((w) => host.appendChild(el("p", "abs-warn", w.text)));
        if (S.note) { const n = el("p", "abs-warn", S.note); n.setAttribute("role", "status"); host.appendChild(n); }
        s.days.forEach((d) => {
            const card = el("section", "cu-day" + (d.mark && d.mark.st === "done" ? " done" : "")), w = weekOf(d.day);
            const top = el("div", "abs-top"); top.appendChild(el("h2", null, d.name + ", " + d.day.slice(5).replace("-", "/")));
            if (d.mark) top.appendChild(el("span", "abs-tag " + (d.mark.st === "done" ? "ok" : "out"), CU.STATUS_WORD[d.mark.st] + (d.mark.via ? " (" + CU.ROUTES[d.mark.via].name + ")" : "")));
            card.appendChild(top);
            card.appendChild(el("p", "abs-line", d.line));
            if (d.items.length) { const chips = el("p", "abs-chips"); d.items.forEach((i) => chips.appendChild(el("span", "abs-chip " + (i.graded ? "graded" : "practice"), i.t + " · " + (i.graded ? (i.catName ? "graded, " + i.catName : "graded") : "practice")))); card.appendChild(chips); }
            // the missed worksheet(s): the day's own papers, made from the week file
            const papers = w && w.classes && w.classes[cls] ? CU.dayPapers(papersFor(w, cls), K.dayIndex(d.day)) : [];
            card.appendChild(el("h3", null, "Worksheet"));
            if (!papers.length) card.appendChild(el("p", "cu-hint", w ? "No paper for this day in the week file." : "This week is not in Anchor, so there is no paper to show."));
            papers.forEach((p) => {
                const row = el("div", "cu-paper"), sid = d.day + "|" + p.id;
                row.appendChild(el("b", null, p.file));
                const show = el("button", "btn ghost", S.show[sid] ? "Hide" : "Show"); show.type = "button"; show.onclick = () => { S.show[sid] = !S.show[sid]; draw(); };
                const pr = el("button", "btn ghost", "Print"); pr.type = "button"; pr.onclick = () => o.print(w, [p], p.file);
                const acts = el("span", "cu-acts"); acts.append(show, pr); row.appendChild(acts); card.appendChild(row);
                if (S.show[sid]) { const box = el("div", "cu-sheet"); try { box.appendChild(p.build(w)); } catch (e) { box.appendChild(el("p", "cu-hint", "This paper could not be drawn (" + e.message + ").")); } card.appendChild(box); }
            });
            if (w && w.classes && w.classes[cls]) videoSection(card, d, w);
            // the catch-up choice
            card.appendChild(el("h3", null, "Assign catch-up"));
            const pick = el("div", "cu-routes"); pick.setAttribute("role", "radiogroup"); pick.setAttribute("aria-label", "Where the catch-up goes");
            CU.ROUTE_KEYS.forEach((r) => {
                const R = CU.ROUTES[r], on = S.route[d.day] === r, b = el("button", "cu-route" + (on ? " on" : "")); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(on));
                b.append(el("b", null, R.name + ": " + R.short), el("span", null, R.when), el("small", null, R.best));
                b.onclick = async () => { S.route[d.day] = r; S.open[d.day] = { busy: true }; draw(); S.open[d.day] = await practice(d.day, r); draw(); };
                pick.appendChild(b);
            });
            card.appendChild(pick);
            const r = S.route[d.day], P = S.open[d.day];
            if (r && P && !P.busy) {
                if (P.text) {
                    const ta = el("textarea", "cu-copy"); ta.readOnly = true; ta.rows = 10; ta.value = P.text; ta.setAttribute("aria-label", "Practice to paste into " + CU.ROUTES[r].name);
                    card.appendChild(ta);
                    card.appendChild(el("p", "cu-hint", "From " + P.from + ". Paste into " + CU.ROUTES[r].name + "; keep the answer key for yourself."));
                    const cp = el("button", "btn ghost", "Copy"); cp.type = "button"; cp.onclick = async () => { try { await navigator.clipboard.writeText(P.text); cp.textContent = "Copied"; } catch (e) { ta.select(); } };
                    card.appendChild(cp);
                } else card.appendChild(el("p", "cu-hint", "No practice for this day in the week file or the standards bank. Assign from " + CU.ROUTES[r].name + "'s own sets."));
            }
            const acts = el("div", "cu-marks");
            if (r) { const a = el("button", "btn go", "Mark assigned on " + CU.ROUTES[r].name); a.type = "button"; a.onclick = () => mark(s.nm, d.day, "assigned", r); acts.appendChild(a); }
            if (!(d.mark && d.mark.st === "done")) { const dn = el("button", "btn", "Mark caught up"); dn.type = "button"; dn.onclick = () => mark(s.nm, d.day, "done", (d.mark && d.mark.via) || r || ""); acts.appendChild(dn); }
            if (d.mark) { const un = el("button", "btn ghost", "Undo"); un.type = "button"; un.onclick = () => mark(s.nm, d.day, "", ""); acts.appendChild(un); }
            card.appendChild(acts);
            host.appendChild(card);
        });
    }
    draw();
    return { setWeeks: (w) => { D.weeks = w; soon(); } };
}
