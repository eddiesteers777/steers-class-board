/* ==========================================
   Bell timeline: the board changes screens on its own, tied to the bell.
   For each bell schedule (Regular and the others on Home), the teacher lists
   steps like "At the bell: Find seats", "5 min after the bell: Weekly Agenda".
   The same steps run every period, using that day's chosen schedule.

   Saved in settings/timeline (its own doc, so Home's bell-times save never
   drops it): { on, plans: { <scheduleId>: [{ m, ref, go }] } }
     m   minutes (0-60)
     ref "after" (after the bell), "before" (before the bell), "end" (before class ends)
     go  "screen:<id>" or "scene:<layout id>"
   What has fired lives in the shared board state (S.bplan), so the board and
   the Remote never both fire a step, and a reload never replays one.
========================================== */
const REFS = [["after", "after the bell"], ["before", "before the bell"], ["end", "before class ends"]];
const MAX_STEPS = 10, GRACE = 120;   // a step still fires up to 2 min late (the board was asleep or reloading), never later
export const STARTER = [{ m: 0, ref: "after", go: "scene:seats" }, { m: 5, ref: "after", go: "screen:agenda" }, { m: 8, ref: "after", go: "scene:bell" }];

const mins = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
const nice = (sec) => { const m = Math.floor(sec / 60), h = Math.floor(m / 60); return ((h + 11) % 12 + 1) + ":" + ("0" + (m % 60)).slice(-2); };

export function cleanStep(x) {
    if (!x || typeof x !== "object") return null;
    const m = Math.max(0, Math.min(60, Math.round(+x.m || 0))), ref = REFS.some((r) => r[0] === x.ref) ? x.ref : "after";
    const go = typeof x.go === "string" && /^(screen|scene):[\w-]{1,20}$/.test(x.go) ? x.go : "";
    return go ? { m, ref, go } : null;
}
export function cleanPlan(d) {
    const out = { on: !!(d && d.on), plans: {} };
    const p = (d && d.plans) || {};
    Object.keys(p).slice(0, 20).forEach((id) => { if (Array.isArray(p[id])) out.plans[id.slice(0, 24)] = p[id].map(cleanStep).filter(Boolean).slice(0, MAX_STEPS); });
    return out;
}
export function cleanBplan(d) {
    const o = d && typeof d === "object" ? d : {};
    return { fired: Array.isArray(o.fired) ? o.fired.filter((k) => typeof k === "string").map((k) => k.slice(0, 60)).slice(-40) : [], skip: typeof o.skip === "string" ? o.skip.slice(0, 40) : "" };
}

/** The steps for a schedule: its own, or Regular's when it has none yet. */
export function stepsFor(plan, id) {
    const own = plan.plans[id];
    if (own && own.length) return { steps: own, from: id };
    const reg = plan.plans.regular;
    return { steps: (reg && reg.length) ? reg : [], from: reg && reg.length ? "regular" : "" };
}
/** Seconds after midnight when a step happens in a period, or null without bell times. */
export function stepAt(step, bell) {
    const s = mins(bell && bell.start), e = mins(bell && bell.end);
    if (s == null || e == null) return null;
    if (step.ref === "end") return (e - step.m) * 60;
    return (s + (step.ref === "before" ? -step.m : step.m)) * 60;
}
/** Every step today, in time order: [{ p, i, t, step, key }]. */
export function todayList(api) {
    const plan = api.plan(), bells = api.bells(); if (!plan || !bells) return [];
    const { steps } = stepsFor(plan, api.bellId()), date = api.today(), out = [];
    api.periods().forEach(([p]) => steps.forEach((step, i) => { const t = stepAt(step, bells[p]); if (t != null) out.push({ p, i, t, step, key: date + "|" + p + "|" + i + "|" + t }); }));
    return out.sort((a, b) => a.t - b.t || a.i - b.i);
}
export function goLabel(go, api) {
    const [kind, id] = String(go).split(":");
    if (kind === "screen") { const s = api.screens().find((x) => x[0] === id); return s ? s[1] : "a screen that is gone"; }
    const sc = api.layouts().find((x) => x.id === id); return sc ? sc.n + " layout" : "a layout that was deleted";
}
function whenLabel(step) {
    if (step.ref === "after" && step.m === 0) return "At the bell";
    return step.m + " min " + REFS.find((r) => r[0] === step.ref)[1];
}

/* ---------- running it ---------- */
const local = new Set();   // what this page fired, until the shared state echoes it back
let lastCheck = 0;
/** Called four times a second. Fires at most one step per call. */
export function planTick(api) {
    const t = api.now(); if (t - lastCheck < 1000) return; lastCheck = t;
    const plan = api.plan(); if (!plan || !plan.on || !api.schoolDay()) return;
    const d = new Date(t), nowS = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    const B = api.S.bplan, date = api.today();
    // The board fires on time. A Remote waits 5 s, so with the board open it is the board that switches.
    const lag = api.mode() === "board" ? 0 : 5;
    const due = todayList(api).filter((x) => nowS >= x.t + lag && nowS < x.t + GRACE && !B.fired.includes(x.key) && !local.has(x.key) && B.skip !== date + "|" + x.p);
    if (!due.length) return;
    const x = due[due.length - 1];   // if two are due at once (the board woke up late), only the latest one matters
    due.forEach((y) => local.add(y.key));
    fire(api, x, due.map((y) => y.key));
}
function fire(api, x, keys) {
    const S = api.S;
    S.bplan.fired = S.bplan.fired.concat(keys).slice(-40);
    if (S.period !== x.p) api.goPeriod(x.p);
    const [kind, id] = x.step.go.split(":");
    if (kind === "scene") { const sc = api.layouts().find((s) => s.id === id); if (sc) { api.applyScene(sc); return; } }
    else if (api.screenOk(id) && S.screen !== id) { S.screen = id; S.show = false; }
    api.push();
}
/** For the Remote: the next step today, or why nothing will happen. */
export function nextUp(api) {
    const plan = api.plan();
    if (!plan) return { line: "Loading…" };
    if (!plan.on) return { line: "Off. The board only changes when you change it." };
    if (!api.bells()) return { line: "Set bell times on Home first. The timeline runs from them." };
    if (!api.schoolDay()) return { line: "No school today, so nothing runs." };
    const { steps } = stepsFor(plan, api.bellId());
    if (!steps.length) return { line: "No steps yet for " + api.bellName() + ". Tap Edit steps." };
    const d = new Date(api.now()), nowS = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(), date = api.today(), B = api.S.bplan;
    const nx = todayList(api).find((x) => x.t > nowS - 1 && B.skip !== date + "|" + x.p && !B.fired.includes(x.key));
    if (!nx) return { line: "Done for today (" + api.bellName() + " schedule)." };
    const inS = nx.t - nowS, soon = inS <= 3600 ? " · in " + (inS < 60 ? inS + " s" : Math.ceil(inS / 60) + " min") : "";
    return { line: "Next: " + goLabel(nx.step.go, api) + ", " + nx.p + " period at " + nice(nx.t) + soon, p: nx.p };
}

/* ---------- the Remote's fold ---------- */
export function mountPlanFold(api, anchor) {
    const { el } = api;
    const box = el("details", "menu fold bplan"); box.id = "planMenu";
    const sum = el("summary", null, "Bell timeline "); const cnt = el("span", "count"); cnt.id = "planCount"; sum.appendChild(cnt); box.appendChild(sum);
    const b = el("div", "bpbox"); box.appendChild(b);
    const tog = el("button", "sndtog"); tog.type = "button"; tog.id = "planOn"; tog.appendChild(el("span", null, "Change screens on the bell")); tog.appendChild(el("i")); b.appendChild(tog);
    const tl = el("label", "field bptoday"); tl.appendChild(el("span", null, "Today's schedule"));
    const tsel = el("select"); tsel.id = "planToday"; tl.appendChild(tsel); b.appendChild(tl);
    const tnote = el("p", "bphint"); tnote.setAttribute("role", "status"); b.appendChild(tnote);
    tsel.onchange = async () => { const id = tsel.value; tnote.textContent = "Saving\u2026"; const ok = await api.setToday(id); tnote.textContent = ok ? "Today runs on " + (api.schedules().find((x) => x[0] === id) || ["", "it"])[1] + ". The period clock uses its times." : "Could not save. Check the connection."; };
    const line = el("p", "bpline"); line.id = "planLine"; line.setAttribute("role", "status"); b.appendChild(line);
    const row = el("div", "bprow"); b.appendChild(row);
    const skip = el("button", "btn ghost bpskip"); skip.type = "button"; skip.id = "planSkip"; row.appendChild(skip);
    const edit = el("button", "btn ghost"); edit.type = "button"; edit.id = "planEdit"; edit.textContent = "Edit steps"; row.appendChild(edit);
    // The step editor needs more room than the rail: it opens as a dialog over the page.
    const dlg = el("dialog", "bpdlg"); dlg.id = "planDialog"; dlg.setAttribute("aria-labelledby", "planDlgTitle");
    const dh = el("div", "bpdhead"), dt = el("h2", null, "Bell timeline"); dt.id = "planDlgTitle"; dh.appendChild(dt);
    const close = el("button", "btn ghost", "Done"); close.type = "button"; close.onclick = () => dlg.close(); dh.appendChild(close); dlg.appendChild(dh);
    dlg.appendChild(el("p", "bphint", "The board switches on its own at each step, every period. You can still change screens by hand any time; the next step switches it again."));
    const ed = el("div", "bped"); ed.id = "planEditor"; dlg.appendChild(ed); document.body.appendChild(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    anchor.after(box);

    tog.onclick = async () => { const p = api.plan(); if (!p) return; const was = p.on; p.on = !was; if (!was && !Object.keys(p.plans).length) p.plans.regular = STARTER.map((s) => Object.assign({}, s)); await api.savePlan(p); refresh(); };
    skip.onclick = () => {
        const S = api.S, key = api.today() + "|" + S.period;
        S.bplan.skip = S.bplan.skip === key ? "" : key; api.push(); refresh();
    };
    edit.onclick = () => { drawEditor(api, ed, () => refresh()); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); };
    function refresh() {
        const p = api.plan(), on = !!(p && p.on);
        tog.setAttribute("aria-pressed", String(on)); tog.querySelector("i").textContent = on ? "On" : "Off";
        cnt.textContent = on ? "On" : "Off";
        const nx = nextUp(api); line.textContent = nx.line;
        const sc = api.schedules(), sig = sc.map((x) => x.join(":")).join("|");
        if (tsel.dataset.sig !== sig) { tsel.textContent = ""; sc.forEach(([id, n]) => { const o = el("option", null, n); o.value = id; tsel.appendChild(o); }); tsel.dataset.sig = sig; }
        if (document.activeElement !== tsel) tsel.value = api.bellId();
        tl.hidden = sc.length < 2;
        const S = api.S, key = api.today() + "|" + S.period, skipped = S.bplan.skip === key;
        skip.hidden = !on; skip.textContent = skipped ? "Resume " + S.period + " period" : "Skip the rest of " + S.period + " period";
        skip.setAttribute("aria-pressed", String(skipped));
    }
    refresh();
    let last = 0;
    return { refresh, tick: () => { const t = Date.now(); if (t - last < 1000) return; last = t; refresh(); },
        editor: () => (dlg.open && !ed.contains(document.activeElement) ? drawEditor(api, ed, refresh) : null) };
}

let edId = "", draft = null, draftFor = "";
function drawEditor(api, host, after) {
    const { el } = api, plan = api.plan(); host.textContent = ""; if (!plan) return;
    const scheds = api.schedules();
    if (!edId || !scheds.some((s) => s[0] === edId)) edId = api.bellId();
    if (draftFor !== edId || !draft) { const own = plan.plans[edId]; draft = (own && own.length ? own : stepsFor(plan, edId).steps).map((s) => Object.assign({}, s)); draftFor = edId; }
    const top = el("label", "field bpsched"); top.appendChild(el("span", null, "Bell schedule"));
    const sel = el("select"); scheds.forEach(([id, n]) => { const o = el("option", null, n + (id === api.bellId() ? " (today)" : "")); o.value = id; sel.appendChild(o); }); sel.value = edId;
    sel.onchange = () => { edId = sel.value; draft = null; drawEditor(api, host, after); };
    top.appendChild(sel); host.appendChild(top);
    const own = plan.plans[edId] && plan.plans[edId].length;
    const regHas = plan.plans.regular && plan.plans.regular.length;
    host.appendChild(el("p", "bphint", !draft.length ? "No steps yet. Tap Add a step. For example: at the bell, Find seats; 5 min after the bell, Weekly Agenda." : edId !== "regular" && !own && regHas ? "This schedule has no steps of its own, so it uses Regular's. Change them here to give it its own." : "These steps run every period on this schedule."));
    const list = el("div", "bplist"); host.appendChild(list);
    const bells = api.bellsFor(edId), per = api.S.period;
    const opts = [["Screens", api.screens().map(([id, n]) => ["screen:" + id, n])], ["Layouts (screen + panels)", api.layouts().map((s) => ["scene:" + s.id, s.n])]];
    draft.forEach((st, i) => {
        const r = el("div", "bpstep");
        const n = el("input"); n.type = "number"; n.min = "0"; n.max = "60"; n.step = "1"; n.value = String(st.m); n.setAttribute("aria-label", "Minutes"); n.className = "bpmin";
        n.oninput = () => { st.m = Math.max(0, Math.min(60, Math.round(+n.value || 0))); at.textContent = when(); };
        const ref = el("select"); ref.setAttribute("aria-label", "From"); REFS.forEach(([k, t]) => { const o = el("option", null, "min " + t); o.value = k; ref.appendChild(o); }); ref.value = st.ref;
        ref.onchange = () => { st.ref = ref.value; at.textContent = when(); };
        const go = el("select"); go.setAttribute("aria-label", "Show"); go.className = "bpgo";
        opts.forEach(([g, items]) => { const og = el("optgroup"); og.label = g; items.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; og.appendChild(o); }); go.appendChild(og); });
        if (![...go.options].some((o) => o.value === st.go)) { const o = el("option", null, goLabel(st.go, api)); o.value = st.go; go.prepend(o); }
        go.value = st.go; go.onchange = () => { st.go = go.value; };
        const del = el("button", "btn ghost bpdel", "Remove"); del.type = "button"; del.setAttribute("aria-label", "Remove this step"); del.onclick = () => { draft.splice(i, 1); drawEditor(api, host, after); };
        const at = el("span", "bpat");
        const when = () => { const t = stepAt(st, bells && bells[per]); return t == null ? "" : per + " period: " + nice(t); };
        at.textContent = when();
        r.append(n, ref, el("span", "bparrow", "show"), go, del, at); list.appendChild(r);
    });
    const acts = el("div", "bprow"); host.appendChild(acts);
    if (draft.length < MAX_STEPS) { const add = el("button", "btn ghost", "Add a step"); add.type = "button"; add.onclick = () => { const last = draft[draft.length - 1]; draft.push({ m: last ? Math.min(60, last.m + 5) : 0, ref: "after", go: "screen:today" }); drawEditor(api, host, after); }; acts.appendChild(add); }
    if (edId !== "regular" && own) { const use = el("button", "btn ghost", "Use Regular's steps"); use.type = "button"; use.onclick = async () => { delete plan.plans[edId]; draft = null; await api.savePlan(plan); drawEditor(api, host, after); after(); }; acts.appendChild(use); }
    const save = el("button", "btn primary", "Save steps"); save.type = "button"; acts.appendChild(save);
    const note = el("p", "bphint"); note.setAttribute("role", "status"); host.appendChild(note);
    save.onclick = async () => {
        const clean = draft.map(cleanStep).filter(Boolean);
        clean.sort((a, b) => (stepAt(a, { start: "12:00", end: "13:00" }) - stepAt(b, { start: "12:00", end: "13:00" })));
        plan.plans[edId] = clean; draft = clean.map((s) => Object.assign({}, s));
        const ok = await api.savePlan(plan);
        drawEditor(api, host, after); after();
        host.lastElementChild.textContent = ok ? "Saved. " + (plan.on ? "The board will follow these steps." : "Turn on “Change screens on the bell” to use them.") : "Could not save. Check the connection and try again.";
    };
}
