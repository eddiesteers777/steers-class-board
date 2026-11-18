/* ==========================================
   Focal — closing out a week (Phase 4 of the weekly workflow).
   One checklist per approved week, by class, in place of Claude's end-of-week report:
     teacher/{uid}/closeout/<weekId>  { done: { "<cls>.<item>": { at, by } | null }, printed: { <cls>: { <paper>: at } } }
     teacher/{uid}/settings/closeout  { schoology: { <cls>: at | null } }   (the Class Page link is set once, not weekly)
   Items Anchor can see tick themselves: the week approved (so it is on the board and the Class Page) and the
   papers printed from Week Builder. Magma, Thrillshare and Schoology are ticked by Eddie, or by Claude through
   the Focal connector ({ done: { "8th.magma": { at, by: "Claude" } } }, merged).
========================================== */
export const CLASSES = [["8th", "8th Grade"], ["7th", "7th Grade"], ["8th-acc", "8th Accelerated"]];
const DK = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** What to check off for one week. Each item: { key, cls, label, auto, done, by, at, setting }. */
export function closeoutItems(week, plan, o) {
    const out = [], co = (o && o.co) || {}, done = co.done || {}, printed = co.printed || {}, sch = ((o && o.settings) || {}).schoology || {};
    if (!week || !week.classes) return out;
    CLASSES.forEach(([k, label]) => {
        const c = week.classes[k]; if (!c) return;
        const pc = plan && plan.classes && plan.classes[k], kind = (pc && pc.assess && pc.assess.kind) || (c.quiz && c.quiz.kind) || "none";
        const pr = printed[k] || {}, has = (...ids) => ids.every((x) => pr[x]);
        const add = (item, text, autoDone, extra) => {
            const key = k + "." + item, m = done[key];
            out.push(Object.assign({ key, cls: k, clsLabel: label, label: text, auto: autoDone !== null, done: !!(autoDone || m), by: autoDone ? "Anchor" : m ? m.by || "you" : "", at: m ? m.at : 0 }, extra || {}));
        };
        add("approved", "Week approved: on the board and the Class Page", !!(o && o.approved));
        if (c.quiz && (c.quiz.items || []).length) add("quiz", "Printed the " + (c.quiz.kind === "test" ? "test" : "quiz") + " and its key", has("quiz", "quizkey"));
        if (c.quiz && c.quiz.modified) add("mod", "Printed the modified quiz and key", has("mod", "modkey"));
        if (c.modStudyGuide) add("modsg", "Printed the modified study guide and key", has("modsg", "modsgkey"));
        if (c.sub) add("sub", "Printed the sub folder: sub plan, worksheet and key, Sudoku", has("subplan", "subws", "subwskey", "sudoku"));
        if (kind !== "none" || c.quiz) {
            const word = kind === "test" ? "test" : "quiz", day = pc && pc.assess && pc.assess.day ? " for " + pc.assess.day : "";
            add("magma", "Magma " + word + day + " built (Unpublished)", null);
            if (kind === "test") add("bonus", "Magma bonus (earlier topics) built", null);
            if (k === "8th") add("magmaMod", "Magma " + word + (kind === "test" ? " and bonus" : "") + " for the modified group (4 students)", null);
        }
        add("thrillshare", "Parent message posted on Thrillshare", null);
        const s = sch[k];
        out.push({ key: k + ".schoology", cls: k, clsLabel: label, label: "Schoology course links to the Class Page (once)", auto: false, done: !!s, by: s ? "you" : "", at: s || 0, setting: true });
    });
    return out;
}

/** "3 of 12" and the short names of what is left, for Home. */
export function closeoutSummary(items) {
    const left = items.filter((x) => !x.done);
    const short = (x) => ({ magma: "Magma", bonus: "Magma bonus", magmaMod: "modified Magma", thrillshare: "Thrillshare", schoology: "Schoology link", approved: "approve", quiz: "print the quiz", mod: "print the modified quiz", modsg: "print the modified study guide", sub: "print the sub folder" }[x.key.split(".")[1]] || x.label);
    const names = []; left.forEach((x) => { const n = short(x); if (!names.includes(n)) names.push(n); });
    return { done: items.length - left.length, total: items.length, left: left.length, names };
}

/** Is a week "due" for closing out on day t (YYYY-MM-DD)? From its Thursday on. */
export function closeoutDue(week, t) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((week && week.monday) || ""); if (!m) return false;
    const th = new Date(+m[1], +m[2] - 1, +m[3] + 3), iso = th.getFullYear() + "-" + ("0" + (th.getMonth() + 1)).slice(-2) + "-" + ("0" + th.getDate()).slice(-2);
    return t >= iso;
}

/** Draw the checklist into host. onTick(item, on) saves it. */
export function drawCloseout(host, items, onTick) {
    const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
    host.textContent = "";
    const sum = closeoutSummary(items);
    const head = el("div", "co-head");
    head.appendChild(el("h2", null, "Close out the week"));
    const bar = el("div", "co-bar"); bar.setAttribute("role", "progressbar"); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", String(sum.total)); bar.setAttribute("aria-valuenow", String(sum.done)); bar.setAttribute("aria-label", "Close-out progress");
    const fill = el("span"); fill.style.width = (sum.total ? Math.round(100 * sum.done / sum.total) : 0) + "%"; bar.appendChild(fill); head.appendChild(bar);
    head.appendChild(el("p", "co-count", sum.left ? sum.done + " of " + sum.total + " done" : "All " + sum.total + " done. This week is closed out."));
    host.appendChild(head);
    host.appendChild(el("p", "co-lead", "Anchor ticks what it can see: approval and papers printed from Week Builder. Tick the rest as you finish them; Claude ticks Magma and Thrillshare when it does them."));
    const grid = el("div", "co-grid");
    CLASSES.forEach(([k, label]) => {
        const mine = items.filter((x) => x.cls === k); if (!mine.length) return;
        const col = el("div", "co-class"); col.appendChild(el("h3", null, label));
        mine.forEach((x) => {
            const row = el("label", "co-item" + (x.done ? " done" : ""));
            const cb = el("input"); cb.type = "checkbox"; cb.checked = x.done; cb.disabled = x.auto && x.by === "Anchor";
            cb.onchange = () => onTick(x, cb.checked);
            row.appendChild(cb);
            const t = el("span", "co-text", x.label); row.appendChild(t);
            if (x.done && x.by) row.appendChild(el("small", "co-by", x.by === "Anchor" ? "Automatic" : x.by === "Claude" ? "Claude" : "You"));
            else if (x.auto) row.appendChild(el("small", "co-by", "Ticks itself"));
            col.appendChild(row);
        });
        grid.appendChild(col);
    });
    host.appendChild(grid);
}
export { DK };
