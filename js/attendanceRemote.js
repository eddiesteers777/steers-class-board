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
import { PERIOD_KEYS } from "./boardTools.js?v=63";

let api = null, box = null, body = null, count = null, unsub = null, watchedDay = "", DOC = null, note = "";
const busy = new Set();

export function mountAttendance(a, anchor) {
    api = a; const { el } = a;
    box = el("details", "menu fold outmenu"); box.id = "outMenu"; box.open = true;
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

const names = (per) => shortNames((api.rosters()[per] || []).filter(Boolean));
const period = () => (api.periods().some((p) => p[0] === api.S.period) ? api.S.period : (api.periods()[0] || [""])[0]);

/** Keep the Name Picker / Group maker's own list (roster positions, today only) in step with the record. */
function mirror() {
    const T = api.S.tools, day = api.today(); if (!DOC) return;
    const next = {}; let changed = T.absent.day !== day;
    PERIOD_KEYS.forEach((per) => {
        const n = names(per); if (!n.length && !(DOC.out[per])) return;
        const pos = A.positionsOut(DOC, per, n), cur = T.absent.day === day ? (T.absent.periods[per] || []) : [];
        next[per] = pos; if (pos.join() !== cur.slice().sort((x, y) => x - y).join()) changed = true;
    });
    if (!changed) return;
    // positions the Remote's own list already holds stay (a tap in the Name Picker is a mark too); the record adds to them
    T.absent.day = day; PERIOD_KEYS.forEach((per) => { const have = T.absent.periods[per] || []; T.absent.periods[per] = Array.from(new Set((next[per] || []).concat(T.absent.day === day ? have : []))).sort((x, y) => x - y); });
    api.push();
}

async function tap(per, nm, out) {
    const day = api.today(), key = per + "|" + nm; if (busy.has(key)) return; busy.add(key);
    DOC = DOC || A.cleanDoc(null, day);
    const w = A.tapWrite(day, per, nm, out); (DOC.out[per] = DOC.out[per] || {}); Object.assign(DOC.out[per], w.out[per]);
    // the Remote's own list, at once
    const T = api.S.tools, at = n_(per).indexOf(nm); if (T.absent.day !== day) { T.absent.day = day; T.absent.periods = {}; }
    if (at >= 0) { const cur = (T.absent.periods[per] || []).filter((i) => i !== at); if (out) cur.push(at); T.absent.periods[per] = cur; api.push(); }
    note = ""; draw();
    try {
        const st = api.store();
        // the signed-in store merges one student into the day's document; a stand-in store (no rooms) saves the whole copy
        if (st.rooms && st.rooms.uid()) await st.rooms.save("teacher/" + st.rooms.uid() + "/attendance/" + day, w, true);
        else await st.save("attendance/" + day, DOC);
    } catch (e) { note = "That tap did not save (" + ((e && e.code) || "connection") + "). Tap again."; }
    busy.delete(key); draw();
}
const n_ = (per) => names(per);

function draw() {
    if (!api || !box || box.hidden) return;
    const { el } = api, per = period(), list = n_(per), doc = DOC || A.cleanDoc(null, api.today());
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
