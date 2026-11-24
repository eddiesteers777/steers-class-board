/* ==========================================
   Anchor Board — "Who's out" on the Remote (Phase 2, Nov 23 2026). Rules: js/attendanceCore.js.

   Once at the start of class: pick the period, tap who is out. Each tap saves one student into
   teacher/{uid}/attendance/{today} (merge, one field per student) and keeps the Name Picker / Group maker's own
   daily list (S.tools.absent) in step, so a student marked out here is also skipped there.
   Names show as first names (the initial only when two students in a period share a first name).
   Nothing here reads PowerSchool. The Remote only; the board and the sub page never show it.
========================================== */
import * as A from "./attendanceCore.js?v=1";
import { shortNames } from "./vaultCore.js?v=75";
import { PERIOD_KEYS } from "./boardTools.js?v=75";
import { kidKey } from "./profileCore.js?v=2";

let api = null, box = null, body = null, count = null, unsub = null, watchedDay = "", DOC = null, note = "";

export function mountAttendance(a, anchor) {
    api = a; const { el } = a;
    box = el("details", "menu fold outmenu"); box.id = "outMenu"; box.open = true; box.hidden = true;   // shown only once signed in on the Remote
    const sum = el("summary", null, "Who’s out "); count = el("span", "count"); count.id = "outCount"; sum.appendChild(count); box.appendChild(sum);
    body = el("div", "outbody"); box.appendChild(body);
    if (anchor && anchor.after) anchor.after(box); else document.querySelector(".rail").prepend(box);
    return box;
}

/** Called with the board's redraw: follow today's record and draw. Does nothing on the board, sub page or Board Builder. */
export function syncAttendance() {
    if (!api || !box) return;
    const on = api.mode() === "remote" && api.signedIn() && !!api.store();
    box.hidden = !on; if (!on) return;
    const day = api.today();
    if (watchedDay !== day) {
        if (unsub) { try { unsub(); } catch (e) { /* closed */ } unsub = null; }
        watchedDay = day; DOC = null;
        unsub = api.store().watch("attendance/" + day, (snap) => { if (snap.pending) return; DOC = A.cleanDoc(snap.exists ? snap.data : null, day); mirror(); draw(); }, () => {});
    }
    draw();
}

/** Short names in the SAME positions as the roster (a blank line stays ""), because the Name Picker counts positions in the raw roster. */
export function posNames(raw) {
    const lines = (raw || []).map((n) => String(n || "").trim()), filled = lines.map((n, i) => (n ? i : -1)).filter((i) => i >= 0), sn = shortNames(filled.map((i) => lines[i]));
    const out = lines.map(() => ""); filled.forEach((i, k) => { out[i] = sn[k]; }); return out;
}
const names = (per) => posNames(api.rosters()[per]);
const period = () => (api.periods().some((p) => p[0] === api.S.period) ? api.S.period : (api.periods()[0] || [""])[0]);

/**
 * Keep the Name Picker / Group maker's own list (roster positions, today only) in step with the record.
 * The record wins for every student it names: marked out -> in the list, tapped back in -> out of it. Taps made only in
 * the Name Picker today stay. A list from an earlier day is dropped.
 */
export function mirrorList(absent, doc, day, namesOf, periods) {
    const sameDay = absent.day === day, next = {};
    periods.forEach((per) => {
        const n = namesOf(per), m = (doc && doc.out && doc.out[per]) || {}, pos = (k) => n.findIndex((x) => x && kidKey(x) === k);
        const set = new Set(sameDay ? (absent.periods[per] || []) : []);
        Object.keys(m).forEach((k) => { const i = pos(k); if (i < 0) return; if (m[k].x) set.delete(i); else set.add(i); });
        if (set.size || (sameDay && absent.periods[per])) next[per] = Array.from(set).sort((a, b) => a - b);
    });
    const was = JSON.stringify(sameDay ? absent.periods : {}), now = JSON.stringify(next);
    return { changed: !sameDay || was !== now, list: { day, periods: next } };
}
function mirror() {
    if (!DOC) return; const T = api.S.tools;
    const r = mirrorList(T.absent, DOC, api.today(), names, PERIOD_KEYS); if (!r.changed) return;
    T.absent.day = r.list.day; T.absent.periods = r.list.periods; api.push();
}

/** One tap: shown at once and saved in the background, so a mis-tap can be undone straight away even on slow wifi. */
function tap(per, nm, out) {
    const day = api.today();
    DOC = DOC || A.cleanDoc(null, day);
    const w = A.tapWrite(day, per, nm, out); (DOC.out[per] = DOC.out[per] || {}); Object.assign(DOC.out[per], w.out[per]);
    const T = api.S.tools, at = names(per).indexOf(nm); if (T.absent.day !== day) { T.absent.day = day; T.absent.periods = {}; }
    if (at >= 0) { const cur = (T.absent.periods[per] || []).filter((i) => i !== at); if (out) cur.push(at); T.absent.periods[per] = cur.sort((a, b) => a - b); api.push(); }
    note = ""; draw();
    let p;
    try {
        const st = api.store();
        // the signed-in store merges one student into the day's document (it is kept on the device until the wifi is back); a stand-in store saves the whole copy
        p = st.rooms && st.rooms.uid() ? st.rooms.save("teacher/" + st.rooms.uid() + "/attendance/" + day, w, true) : st.save("attendance/" + day, DOC);
    } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).catch((e) => { note = "That tap did not save (" + ((e && e.code) || "connection") + "). Tap again."; draw(); });
}

function draw() {
    if (!api || !box || box.hidden) return;
    const { el } = api, per = period(), list = names(per).filter(Boolean), doc = DOC || A.cleanDoc(null, api.today());
    const outNow = A.outList(doc, per), total = outNow.length;
    count.textContent = total ? total + " out" : "";
    body.textContent = "";
    const pr = el("div", "outper"); pr.setAttribute("role", "group"); pr.setAttribute("aria-label", "Period");
    api.periods().forEach(([p]) => { const o = A.outList(doc, p).length, b = el("button", null, p + (o ? " · " + o : "")); b.type = "button"; b.setAttribute("aria-pressed", String(p === per)); b.onclick = () => { api.S.period = p; api.push(); }; pr.appendChild(b); });
    body.appendChild(pr);
    if (!list.length) { body.appendChild(el("p", "outhint", "No names saved for " + per + " period yet. Add them on the Rosters page.")); return; }
    body.appendChild(el("p", "outhint", "Tap anyone who is out today. Tap again to put them back."));
    const grid = el("div", "outgrid"); grid.setAttribute("role", "group"); grid.setAttribute("aria-label", "Students in " + per + " period");
    list.forEach((nm) => {
        const out = A.isOut(doc, per, nm), b = el("button", out ? "out" : "", A.displayName(nm, list)); b.type = "button";
        b.setAttribute("aria-pressed", String(out)); b.setAttribute("aria-label", A.displayName(nm, list) + (out ? ", out today" : ", here"));
        b.onclick = () => tap(per, nm, !out); grid.appendChild(b);
    });
    body.appendChild(grid);
    body.appendChild(el("p", "outsum", total ? total + " of " + list.length + " out in " + per + " period" : "Everyone here in " + per + " period"));
    if (note) { const p = el("p", "outbad", note); p.setAttribute("role", "status"); body.appendChild(p); }
}
