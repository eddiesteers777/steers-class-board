/* ==========================================
   Anchor Board — pick problems from the standards bank by standard (Plan the Week bellringers,
   Week Review swaps). One sheet: choose a standard, see its problems with their checked answers,
   tap Add. The problems come from data/stdbank (answers computed and checked by tools/stdbank/build.py).
   openBankPicker({ cls, codes, extra, stdOf, taken, onAdd, title })
     codes  the standards to offer first (this week's, review, reteach); extra = every other standard of the class
     taken  ids already picked (shown as Added)
     onAdd(item) is called with { id, q, a, std, lvl, also? }
========================================== */
import { loadStdBank, inClass, LEVELS } from "./stdBank.js?v=2";
import { rich } from "./weekSheets.js?v=59";

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };

export async function openBankPicker(o) {
    const all = (await loadStdBank()).filter((x) => inClass(x, o.cls));
    const dlg = el("dialog", "bp"); dlg.setAttribute("aria-label", o.title || "Pick from the standards bank");
    const head = el("div", "bp-head"); head.appendChild(el("h2", null, o.title || "Pick from the standards bank"));
    const close = el("button", "btn ghost", "Done"); close.type = "button"; close.onclick = () => dlg.close(); head.appendChild(close);
    dlg.appendChild(head);
    const counts = (code) => all.filter((x) => x.std === code).length;
    let cur = (o.codes || []).find((c) => counts(c)) || (o.codes || [])[0] || "", lvl = 0;
    const chips = el("div", "pw-chips bp-stds"), other = el("select", "pw-in bp-other"), lv = el("div", "pl-seg pw-seg bp-lv"), list = el("div", "bp-list"), text = el("p", "bp-text");
    other.setAttribute("aria-label", "Another standard");
    dlg.append(chips, other, text, lv, list);
    const taken = new Set(o.taken || []);
    function draw() {
        chips.textContent = "";
        [...new Set(o.codes || [])].forEach((code) => {
            const b = el("button", "pw-chip", code + " · " + counts(code)); b.type = "button"; b.setAttribute("aria-pressed", String(code === cur));
            b.onclick = () => { cur = code; draw(); }; chips.appendChild(b);
        });
        other.textContent = ""; const o0 = el("option", null, "Another standard…"); o0.value = ""; other.appendChild(o0);
        (o.extra || []).filter((c) => !(o.codes || []).includes(c) && counts(c)).forEach((c) => { const op = el("option", null, c + " · " + counts(c) + " problems"); op.value = c; other.appendChild(op); });
        other.value = (o.codes || []).includes(cur) ? "" : cur;
        const s = o.stdOf ? o.stdOf(cur) : null; text.textContent = s ? cur + ": " + s.text : "";
        lv.textContent = "";
        [[0, "All levels"], [1, LEVELS[1]], [2, LEVELS[2]], [3, LEVELS[3]]].forEach(([v, t]) => { const b = el("button", null, t); b.type = "button"; b.setAttribute("aria-pressed", String(v === lvl)); b.onclick = () => { lvl = v; draw(); }; lv.appendChild(b); });
        list.textContent = "";
        const items = all.filter((x) => x.std === cur && (!lvl || x.lvl === lvl));
        if (!items.length) list.appendChild(el("p", "pw-hint", cur ? "No bank problems for " + cur + " at this level." : "Pick a standard."));
        items.forEach((x) => {
            const row = el("div", "bp-item"), q = el("div", "bp-q"); q.appendChild(rich(x.q));
            const a = el("div", "bp-a"); a.appendChild(el("span", null, "Answer ")); a.appendChild(rich(x.a));
            const meta = el("span", "bp-meta", (LEVELS[x.lvl] || "") + (x.part ? " · part " + x.part : ""));
            const add = el("button", "btn" + (taken.has(x.id) ? " ghost" : " go"), taken.has(x.id) ? "Added" : "Add"); add.type = "button"; add.disabled = taken.has(x.id);
            add.onclick = () => { taken.add(x.id); o.onAdd({ id: x.id, q: x.q, a: x.a, std: x.std, lvl: x.lvl, also: x.also }); add.textContent = "Added"; add.className = "btn ghost"; add.disabled = true; };
            const txt = el("div", "bp-txt"); txt.append(q, a, meta);
            row.append(txt, add); list.appendChild(row);
        });
    }
    other.onchange = () => { if (other.value) { cur = other.value; draw(); } };
    draw();
    dlg.addEventListener("close", () => { dlg.remove(); if (o.onClose) o.onClose(); });
    document.body.appendChild(dlg); dlg.showModal();
    return dlg;
}

/** Up to n bank problems for a list of standards, spread across them, on-level first, skipping ids already used. */
export async function bankFor(cls, codes, n, skip = new Set()) {
    const all = (await loadStdBank()).filter((x) => inClass(x, cls) && !skip.has(x.id));
    const by = codes.map((c) => all.filter((x) => x.std === c).sort((a, b) => Math.abs(a.lvl - 2) - Math.abs(b.lvl - 2)));
    const out = []; let k = 0;
    while (out.length < n && by.some((l) => l.length)) { const l = by[k % by.length]; if (l.length) out.push(l.shift()); k++; }
    return out;
}
