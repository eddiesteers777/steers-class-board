/* ==========================================
   Anchor Board — Standards Timeline: the problem picker and the tray (page code; rules in js/timelineTray.js).
   Click a standard on the timeline: a side panel shows its problems from Anchor's standards bank, by level.
   Preview one, show another, show the answer and worked steps, and add the standard to the tray.
   The tray (bottom of the page) keeps your picks in order with a live time estimate, and opens them in
   Assignments as a practice draft. The tray lives on this device only (it holds problem picks, no student data).
========================================== */
import { STANDARDS } from "../data/standards.js?v=58";
import { loadStdBank, LEVELS } from "./stdBank.js?v=2";
import * as C from "./assignCore.js?v=7";
import { mathText } from "./vaultCore.js?v=75";
import * as Tr from "./timelineTray.js?v=1";

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };
const mathEl = (tag, cls, text) => { const e = el(tag, cls); e.append(mathText(text)); return e; };
const keyOf = (cls) => "anchorboard-tl-tray-" + cls;
const load = (cls) => { try { return Tr.clean(JSON.parse(localStorage.getItem(keyOf(cls)) || "{}")); } catch (e) { return { items: [] }; } };
const store = (cls, t) => { try { localStorage.setItem(keyOf(cls), JSON.stringify(t)); } catch (e) { /* private window: the tray lasts for this visit */ } };

let bank = null, bankP = null;
export function bankReady() { if (!bankP) bankP = loadStdBank().then((b) => { bank = b; return b; }); return bankP; }
export const bankNow = () => bank;

/**
 * mount({ cls: () => current class, onChange: () => redraw the timeline }) -> { open(code), tray(), redraw() }
 */
export function mount(opt) {
    const panel = el("aside", "tp-panel"); panel.hidden = true; panel.setAttribute("aria-label", "Problems for a standard");
    const shade = el("div", "tp-shade"); shade.hidden = true; shade.onclick = () => close();
    const bar = el("section", "tp-tray"); bar.setAttribute("aria-label", "Tray");
    document.body.append(shade, panel, bar);
    const S = { code: "", lvl: 2, i: 0, show: false, lv: Tr.LEVEL_DEFAULT.slice(), open: false, trays: {} };
    const cls = () => opt.cls();
    const tray = () => (S.trays[cls()] = S.trays[cls()] || load(cls()));
    const setTray = (t) => { S.trays[cls()] = Tr.clean(t); store(cls(), S.trays[cls()]); drawTray(); opt.onChange(); };
    const std = (code) => (STANDARDS[cls()] || { standards: [] }).standards.find((s) => s.code === code);

    function close() { panel.hidden = true; shade.hidden = true; document.body.classList.remove("tp-on"); const back = document.querySelector('[data-pick="' + S.code + '"]'); S.code = ""; if (back) back.focus(); }
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });

    function open(code) {
        S.code = code; S.show = false;
        const t = tray().items.find((x) => x.code === code); S.lv = t ? t.lv.slice() : Tr.LEVEL_DEFAULT.slice();
        panel.hidden = false; shade.hidden = false; document.body.classList.add("tp-on");
        if (!bank) { panel.textContent = ""; panel.append(el("p", "tp-note", "Loading the problem bank…")); bankReady().then(() => { if (S.code === code) { pickLevel(); draw(); } }); return; }
        pickLevel(); draw();
        const f = panel.querySelector(".tp-close"); if (f) f.focus();
    }
    function pickLevel() { const n = Tr.counts(bank, cls(), S.code); S.lvl = n[2] ? 2 : n[1] ? 1 : 3; S.i = Math.floor(Math.random() * Math.max(1, n[S.lvl])); }

    function draw() {
        panel.textContent = ""; const s = std(S.code); if (!s) return;
        const head = el("header", "tp-head");
        const t = el("div"); const c = el("span", "st-code", S.code); t.append(c);
        if (s.critical) t.append(el("span", "pl-chip k-crit", "★ Critical"));
        head.append(t, btn("tp-close", "Close", close));
        panel.append(head, el("p", "tp-std", s.text));
        const n = Tr.counts(bank, cls(), S.code);
        if (!n.all) { panel.append(el("p", "tp-note", "No bank problems for this standard yet.")); return; }
        // level tabs
        const tabs = el("div", "pl-seg tp-lv"); tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "Level to preview");
        [1, 2, 3].forEach((k) => { const b = btn(null, LEVELS[k] + " · " + n[k], () => { S.lvl = k; S.i = 0; S.show = false; draw(); }); b.disabled = !n[k]; b.setAttribute("aria-pressed", String(S.lvl === k)); tabs.append(b); });
        panel.append(tabs);
        const pool = Tr.poolFor(bank, cls(), S.code, [S.lvl]);
        const box = el("div", "tp-prob");
        if (!pool.length) box.append(el("p", "tp-note", "No " + LEVELS[S.lvl].toLowerCase() + " problems for this standard."));
        else {
            S.i = S.i % pool.length; const it = pool[S.i];
            box.append(el("small", "tp-count", "Problem " + (S.i + 1) + " of " + pool.length + " · " + LEVELS[S.lvl]));
            box.append(mathEl("p", "tp-q", it.q));
            if (it.ch && it.ch.length) { const ul = el("ul", "tp-ch"); it.ch.forEach((x, j) => ul.append(mathEl("li", null, "ABCDE"[j] + ". " + x))); box.append(ul); }
            const row = el("div", "tp-btns");
            row.append(btn("btn ghost sm", "Another problem", () => { S.i = (S.i + 1) % pool.length; S.show = false; draw(); }));
            row.append(btn("btn ghost sm", S.show ? "Hide answer" : "Show answer and steps", () => { S.show = !S.show; draw(); }));
            box.append(row);
            if (S.show) {
                const a = el("p", "tp-a"); a.append(el("b", null, "Answer: ")); a.append(mathText(it.a)); if (it.al && it.al.length) a.append(el("small", null, "  Also accepted: " + it.al.join(", "))); box.append(a);
                const steps = C.stepsOf(it);
                if (steps.length) { const ol = el("ol", "tp-steps"); steps.forEach((x) => ol.append(mathEl("li", null, x))); box.append(ol); }
                else box.append(el("p", "tp-note", "No worked steps for this one yet; students see the answer."));
            }
        }
        panel.append(box);
        panel.append(el("p", "tp-note", "Another problem shows the next one in Anchor's bank for this level. It does not make new numbers."));
        // add to tray
        const add = el("div", "tp-add"); add.append(el("b", null, "Levels to assign"));
        const chk = el("div", "tp-chk");
        [1, 2, 3].forEach((k) => {
            const l = el("label", null), i = el("input"); i.type = "checkbox"; i.checked = S.lv.includes(k); i.disabled = !n[k];
            i.onchange = () => { S.lv = i.checked ? [...new Set(S.lv.concat([k]))] : S.lv.filter((x) => x !== k); if (!S.lv.length) S.lv = [k]; draw(); };
            l.append(i, document.createTextNode(" " + LEVELS[k] + " (" + n[k] + ")")); chk.append(l);
        });
        add.append(chk);
        const inT = Tr.has(tray(), S.code), cur = inT && tray().items.find((x) => x.code === S.code), same = cur && cur.lv.join() === S.lv.slice().sort().join();
        const row = el("div", "tp-btns");
        row.append(btn("btn", inT ? (same ? "In the tray ✓" : "Update levels in the tray") : "+ Add to tray", () => { setTray(Tr.add(tray(), S.code, S.lv)); draw(); }));
        if (inT) row.append(btn("btn ghost", "− Take out", () => { setTray(Tr.remove(tray(), S.code)); draw(); }));
        add.append(row);
        add.append(el("p", "tp-note", Tr.poolFor(bank, cls(), S.code, S.lv).length + " problems to draw from · each student needs " + Tr.NEED + " right"));
        panel.append(add);
    }

    /* ---------- the tray ---------- */
    function drawTray() {
        bar.textContent = ""; const t = tray(), C2 = STANDARDS[cls()];
        bar.hidden = !t.items.length; document.body.classList.toggle("tp-has", !!t.items.length);
        if (!t.items.length) return;
        const mins = bank ? Tr.minutes(t, bank, cls(), C2.standards) : 0;
        const top = el("div", "tp-ttop");
        const tog = btn("tp-ttog", null, () => { S.open = !S.open; drawTray(); }); tog.setAttribute("aria-expanded", String(S.open));
        tog.append(el("b", null, "Tray"), el("span", null, " · " + t.items.length + (t.items.length === 1 ? " standard" : " standards") + (mins ? " · about " + mins + " min" : "")));
        top.append(tog);
        const go = btn("btn sm", "Make assignment", () => {
            if (!bank) return;
            const h = Tr.handoff(t, bank, cls(), C2.standards);
            try { localStorage.setItem(Tr.HANDOFF_KEY, JSON.stringify(h)); } catch (e) { /* storage off: the builder opens empty */ }
            location.href = "assign.html?from=timeline" + (opt.demo ? "&demo" : "");
        });
        top.append(go); bar.append(top);
        if (!S.open) return;
        const ul = el("ol", "tp-list");
        t.items.forEach((x, idx) => {
            const s = C2.standards.find((y) => y.code === x.code), li = el("li", "tp-row"); li.dataset.code = x.code;
            const h = btn("tl-handle tp-h", null); h.setAttribute("aria-label", "Move " + x.code + " up or down with the arrow keys");
            h.innerHTML = '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></g></svg>';
            h.onkeydown = (e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); setTray(Tr.move(tray(), x.code, idx + (e.key === "ArrowUp" ? -1 : 1))); const n = bar.querySelector('[data-code="' + x.code + '"] .tp-h'); if (n) n.focus(); } };
            h.onpointerdown = (e) => sortStart(e, li, x.code);
            const name = btn("tp-name", null, () => open(x.code)); name.append(el("b", null, x.code), el("span", null, s ? " " + s.text.slice(0, 60) + (s.text.length > 60 ? "…" : "") : ""));
            const lv = el("small", "tp-lvs", x.lv.map((k) => LEVELS[k]).join(", ") + " · " + (bank ? Tr.poolFor(bank, cls(), x.code, x.lv).length : "…") + " problems");
            const mid = el("div", "tp-mid"); mid.append(name, lv);
            const num = (label, v, min, max, f) => { const l = el("label", "tp-num"); const i = el("input"); i.type = "number"; i.min = min; i.max = max; i.value = v; i.onchange = () => f(Math.max(min, Math.min(max, Math.round(+i.value || min)))); l.append(el("span", null, label), i); return l; };
            li.append(h, mid, num("Need", x.need, 1, 10, (v) => setTray(Tr.set(tray(), x.code, "need", v))), num("Weight", x.w, 1, 5, (v) => setTray(Tr.set(tray(), x.code, "w", v))), btn("tp-rm", "−", () => setTray(Tr.remove(tray(), x.code))));
            li.lastChild.setAttribute("aria-label", "Take " + x.code + " out of the tray");
            ul.append(li);
        });
        bar.append(ul);
        const foot = el("div", "tp-tfoot");
        foot.append(el("small", null, "Practice, " + Tr.NEED + " right per standard by default. You pick periods, due date and the rest in Assignments."));
        foot.append(btn("btn ghost sm", "Clear tray", () => { setTray({ items: [] }); }));
        bar.append(foot);
    }
    // drag to reorder inside the tray
    let so = null;
    function sortStart(e, li, code) {
        e.preventDefault(); so = { li, code, list: li.parentElement };
        li.classList.add("tp-drag");
        const mv = (ev) => {
            const rows = [...so.list.children].filter((n) => n !== li);
            const after = rows.find((n) => { const b = n.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
            if (after) so.list.insertBefore(li, after); else so.list.append(li);
        };
        const up = () => {
            window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
            const to = [...so.list.children].indexOf(li); li.classList.remove("tp-drag"); const c = so.code; so = null;
            setTray(Tr.move(tray(), c, to));
        };
        window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    }

    bankReady().then(() => { drawTray(); opt.onChange(); });
    drawTray();
    return { open, tray, redraw: () => { drawTray(); if (S.code && !panel.hidden) draw(); } };
}
