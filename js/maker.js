/* ==========================================
   Anchor Board — Question Maker (maker.html). Teacher only.
   Build a question set one question at a time, the way students will see it in Vault Raid:
   typed answers or multiple choice, other answers to accept, your own second-try hint,
   and a live preview of the student's screen with an answer checker beside it.
   Questions can come in from the Question Bank (every checked question on your board) or a pasted list.

   A set is saved where every review game reads it (js/games.js):
     teacher/{uid}/games/s_<id>   { id, title, maker: 1, per, cats: [{ n: skill, clues: [{ p, q, a, al?, h?, ch? }] }], final: null, at }
     teacher/{uid}/games/index    { sets: [{ id, title, cats, clues, final, per, maker, at }] }
   Vault Raid uses every question (js/vaultCore.js gameQuestion); the Review Board shows the first 6 skills x 6.
========================================== */
import * as V from "./vaultCore.js?v=70";
import { WEEKS as PUBLISHED } from "../data/weeks.js?v=61";
import { watchPrivateWeeks } from "./weeksLive.js?v=58";
import { extract, norm as bnorm, KINDS } from "./bank.js?v=2";
import { loadStdBank, inClass, KIND as SB_KIND, WEEK_ID as SB_WEEK, WEEK_LABEL as SB_LABEL } from "./stdBank.js?v=1";

const qs = new URLSearchParams(location.search), demo = qs.has("demo");
const store = await import(demo ? "./localStore.js?v=58" : "./boardStore.js?v=58");
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const btn = (c, x, fn, label) => { const b = el("button", c, x); b.type = "button"; if (fn) b.onclick = fn; if (label) b.setAttribute("aria-label", label); return b; };
const math = (tag, cls, text) => { const n = el(tag, cls); n.append(V.mathText(text)); return n; };
const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };
const store_ = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } };
const load_ = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };

const PERIODS = [["1st", "8th"], ["2nd", "8th"], ["4th", "8th"], ["5th", "7th"], ["6th", "8th-acc"]];
const CLS = { "8th": "8th Grade", "7th": "7th Grade", "8th-acc": "8th Accelerated" };
const LET = "ABCDE";
const DRAFT = "anchorboard-maker-draft", INBOX = "anchorboard-maker-inbox";
const BOXNAME = { "": "Plain answer box", frac: "Fraction boxes", mixed: "Mixed number boxes", pow: "Base and exponent", sci: "Scientific notation", sol: "How many solutions (tap)", mc: "Multiple choice (tap)", list2: "2 answer boxes", list3: "3 answer boxes", list4: "4 answer boxes" };
const TOOLS = [["−", "−", "Minus sign"], ["×", "×", "Times"], ["÷", "÷", "Divide"], ["a/b", "/", "Fraction: type 3/4, or {x+1/2} for a longer top"], ["xⁿ", "^", "Exponent: 10^4"], ["√", "√(", "Square root"], ["°", "°", "Degrees"], ["≤", "≤", "Less than or equal"], ["≥", "≥", "Greater than or equal"], ["π", "π", "Pi"], ["$", "$", "Dollars"]];

const uidOf = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let uid = "", SETS = [], set = blank(), sel = 0, dirty = false, saving = false, tryText = "";
function blank() { return { id: "", title: "", per: qs.get("per") && PERIODS.some((p) => p[0] === qs.get("per")) ? [qs.get("per")] : [], qs: [newQ()] }; }
function newQ(o) { return Object.assign({ k: uidOf(), s: "", q: "", a: "", al: [], h: "", ch: null }, o || {}); }
const cur = () => set.qs[sel];

/* ---------- reading and writing a set ---------- */
function fromDoc(d, meta) {
    const out = { id: d.id || meta.id, title: d.title || meta.title || "", per: Array.isArray(meta.per) ? meta.per.slice() : Array.isArray(d.per) ? d.per.slice() : [], qs: [] };
    (d.cats || []).forEach((c) => (c.clues || []).forEach((k) => { if (k && k.q) out.qs.push(newQ({ s: c.n || "", q: k.q, a: k.a || "", al: Array.isArray(k.al) ? k.al.slice() : [], h: k.h || "", ch: Array.isArray(k.ch) && k.ch.length >= 2 ? k.ch.slice() : null })); }));
    if (d.final && d.final.q) out.qs.push(newQ({ s: d.final.c || "Final", q: d.final.q, a: d.final.a || "" }));
    if (!out.qs.length) out.qs.push(newQ());
    return out;
}
function toDoc() {
    const cats = [], by = new Map();
    set.qs.filter((x) => !issues(x).some((i) => i.stop)).forEach((x) => {
        const n = (x.s || "Questions").trim().slice(0, 60), key = n.toLowerCase();
        if (!by.has(key)) { by.set(key, { n, clues: [] }); cats.push(by.get(key)); }
        const c = by.get(key), k = { p: 100 * (c.clues.length + 1), q: x.q.trim().slice(0, 400), a: x.a.trim().slice(0, 200) };
        if (x.al.length) k.al = x.al.slice(0, 8);
        if (x.h.trim()) k.h = x.h.trim().slice(0, 200);
        if (x.ch) k.ch = x.ch.map((t) => t.trim()).filter(Boolean).slice(0, 5);
        c.clues.push(k);
    });
    return { id: set.id, title: (set.title.trim() || "Review game").slice(0, 80), maker: 1, per: set.per.slice(), cats, final: null };
}
function touch() { dirty = true; store_(DRAFT, set); drawHead(); }

/* ---------- checks ---------- */
const hasFig = (t) => /\[\[(graph|table|map)\s*\{/.test(String(t || ""));
/** Problems with one question. stop: it cannot be played (left out when the set is saved). */
function issues(x) {
    const out = [], add = (t, stop) => out.push({ t, stop: !!stop });
    if (!x.q.trim()) add("Write the question.", true);
    if (x.ch) {
        const ch = x.ch.map((t) => t.trim());
        if (ch.filter(Boolean).length < 2) add("Give at least 2 choices.", true);
        else if (!x.a.trim() || !ch.includes(x.a.trim())) add("Tap the circle next to the right choice.", true);
        if (new Set(ch.filter(Boolean).map((t) => t.toLowerCase())).size < ch.filter(Boolean).length) add("Two choices are the same.");
    } else if (!x.a.trim()) add("Add the answer.", true);
    else if (x.a.trim().length > 24 && /[a-z]{3,}.*\s.*[a-z]{3,}/i.test(x.a) && V.numberOf(x.a.trim()) == null) add("Long answer: students must type it the same way. Shorten it, add other answers to accept, or make it multiple choice.");
    if (hasFig(x.q)) add("This question has a graph, table or diagram. Vault Raid shows text only, so students will not see the picture.");
    const same = set.qs.filter((y) => y !== x && y.q.trim() && bnorm(y.q) === bnorm(x.q)).length;
    if (same) add("The same question is in this set twice.");
    return out;
}

/* ---------- the top ---------- */
function drawHead() {
    if ($("title").value !== set.title) $("title").value = set.title;
    const per = $("per"); per.textContent = "";
    PERIODS.forEach(([p, c]) => {
        const on = set.per.includes(p), b = btn("mk-chip" + (on ? " on" : ""), p + " · " + CLS[c].replace(" Grade", ""), () => { set.per = on ? set.per.filter((x) => x !== p) : set.per.concat([p]); touch(); });
        b.setAttribute("aria-pressed", String(on)); per.appendChild(b);
    });
    per.appendChild(el("small", "mk-perhint", set.per.length ? "Shows for these classes" : "Tap a class, or leave all off for every class"));
    $("save").textContent = saving ? "Saving…" : dirty ? (set.id ? "Save changes" : "Save set") : set.id ? "Saved" : "Save set";
    $("save").disabled = saving || (!dirty && !!set.id);
    const ready = $("ready"); ready.textContent = "";
    const ok = set.qs.filter((x) => !issues(x).some((i) => i.stop)), warn = set.qs.filter((x) => issues(x).length).length, skills = new Set(ok.map((x) => (x.s || "Questions").toLowerCase())).size;
    const pill = (t, cls) => ready.appendChild(el("span", "mk-pill" + (cls ? " " + cls : ""), t));
    pill(ok.length + (ok.length === 1 ? " question ready" : " questions ready"), ok.length >= 3 ? "good" : "");
    if (ok.length < 3) pill("Vault Raid needs at least 3", "warn");
    if (warn) pill(warn + (warn === 1 ? " question needs a look" : " questions need a look"), "warn");
    pill(skills + (skills === 1 ? " skill" : " skills"));
    const mc = ok.filter((x) => x.ch).length; if (mc) pill(mc + " multiple choice");
    if (skills > 6 || ok.some((x, i, a) => a.filter((y) => (y.s || "").toLowerCase() === (x.s || "").toLowerCase()).length > 6)) pill("Review Board shows the first 6 skills × 6; Vault Raid plays them all");
    if (set.id && !dirty) {
        const p = set.per.length ? set.per[0] : "";
        const a = el("a", "mk-play", "Play it in Vault Raid"); a.href = "remote.html?" + new URLSearchParams(Object.assign({ screen: "live", vset: set.id }, p ? { period: p } : {})).toString(); ready.appendChild(a);
    }
}

/* ---------- the list ---------- */
function drawList() {
    const list = $("list"); list.textContent = "";
    $("count").textContent = "(" + set.qs.length + ")";
    set.qs.forEach((x, i) => {
        const li = el("li", "mk-item" + (i === sel ? " on" : "")), iss = issues(x), stop = iss.some((t) => t.stop);
        const b = btn("mk-itembtn", null, () => { sel = i; tryText = ""; drawAll(); $("q") && $("q").focus(); });
        b.setAttribute("aria-current", i === sel ? "true" : "false");
        b.appendChild(el("span", "mk-num" + (stop ? " stop" : iss.length ? " warn" : ""), String(i + 1)));
        const body = el("span", "mk-itembody");
        if (x.s) body.appendChild(el("span", "mk-skill", x.s));
        body.appendChild(x.q.trim() ? math("span", "mk-itemq", x.q) : el("span", "mk-itemq empty", "New question"));
        if (x.a.trim()) { const a = el("span", "mk-itema"); a.appendChild(el("b", null, x.ch ? LET[Math.max(0, x.ch.indexOf(x.a))] + " · " : "= ")); a.append(V.mathText(x.a)); body.appendChild(a); }
        b.appendChild(body);
        li.appendChild(b);
        const tools = el("span", "mk-itemtools");
        tools.append(btn("mk-mini", "↑", () => move(i, -1), "Move question " + (i + 1) + " up"), btn("mk-mini", "↓", () => move(i, 1), "Move question " + (i + 1) + " down"));
        tools.children[0].disabled = i === 0; tools.children[1].disabled = i === set.qs.length - 1;
        li.appendChild(tools);
        list.appendChild(li);
    });
}
function move(i, d) { const j = i + d; if (j < 0 || j >= set.qs.length) return; const t = set.qs[i]; set.qs[i] = set.qs[j]; set.qs[j] = t; sel = j; touch(); drawAll(); }

/* ---------- the editor ---------- */
function field(label, ctl, hint) { const w = el("label", "mk-field"); w.appendChild(el("span", "mk-lab", label)); w.appendChild(ctl); if (hint) w.appendChild(el("small", "mk-hint", hint)); return w; }
function drawEditor() {
    const box = $("editor"), x = cur(); box.textContent = "";
    if (!x) return;
    const head = el("div", "mk-edhead");
    head.appendChild(el("h2", null, "Question " + (sel + 1)));
    const acts = el("div", "mk-edacts");
    acts.append(btn("btn ghost", "Duplicate", () => { set.qs.splice(sel + 1, 0, newQ(JSON.parse(JSON.stringify(Object.assign({}, x, { k: uidOf() }))))); sel++; touch(); drawAll(); }),
        btn("btn ghost mk-del", "Delete", () => { set.qs.splice(sel, 1); if (!set.qs.length) set.qs.push(newQ()); sel = Math.min(sel, set.qs.length - 1); touch(); drawAll(); }));
    head.appendChild(acts); box.appendChild(head);

    // Skill
    const skills = [...new Set(set.qs.map((y) => y.s.trim()).filter(Boolean))];
    const dl = el("datalist"); dl.id = "skills"; skills.forEach((s) => { const o = el("option"); o.value = s; dl.appendChild(o); });
    const sk = el("input", "mk-in"); sk.id = "skill"; sk.value = x.s; sk.maxLength = 60; sk.setAttribute("list", "skills"); sk.placeholder = "Like Dividing fractions";
    sk.oninput = () => { x.s = sk.value; touch(); drawList(); drawPhone(); };
    box.append(field("Skill", sk, "Groups the questions in the end-of-game report. Same skill, same words."), dl);

    // Question with a math toolbar
    const qa = el("textarea", "mk-in mk-q"); qa.id = "q"; qa.value = x.q; qa.maxLength = 400; qa.rows = 3; qa.placeholder = "Type the question. 3/4 shows as a stacked fraction, 2 1/2 as a mixed number, 10^4 as an exponent.";
    qa.oninput = () => { x.q = qa.value; touch(); drawList(); drawPhone(); drawTry(); drawIssues(); };
    const bar = el("div", "mk-tools"); bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Math symbols");
    TOOLS.forEach(([t, ins, label]) => { const b = btn("mk-tool", t, () => { insertAt(qa, ins); qa.dispatchEvent(new Event("input")); }, label); b.title = label; bar.appendChild(b); });
    const qwrap = el("div", "mk-field"); qwrap.append(el("span", "mk-lab", "Question"), bar, qa);
    box.appendChild(qwrap);

    // How students answer
    const seg = el("div", "mk-seg"); seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-label", "How students answer");
    [["type", "They type it"], ["mc", "Multiple choice"]].forEach(([k, t]) => {
        const on = (k === "mc") === !!x.ch, b = btn("mk-segb" + (on ? " on" : ""), t, () => {
            if (k === "mc" && !x.ch) { x.ch = x.a.trim() ? [x.a.trim(), "", ""] : ["", "", ""]; }
            if (k === "type" && x.ch) x.ch = null;
            touch(); drawAll();
        });
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(on)); seg.appendChild(b);
    });
    box.appendChild(field("How students answer", seg));

    if (x.ch) {
        const wrap = el("div", "mk-choices");
        x.ch.forEach((c, i) => {
            const row = el("div", "mk-choice" + (c.trim() && c.trim() === x.a.trim() ? " right" : ""));
            const r = el("input"); r.type = "radio"; r.name = "right"; r.checked = !!c.trim() && c.trim() === x.a.trim(); r.setAttribute("aria-label", "Choice " + LET[i] + " is the right answer");
            r.onchange = () => { x.a = (x.ch[i] || "").trim(); touch(); drawAll(); };
            const inp = el("input", "mk-in"); inp.value = c; inp.maxLength = 80; inp.placeholder = "Choice " + LET[i]; inp.setAttribute("aria-label", "Choice " + LET[i]);
            inp.oninput = () => { const was = x.ch[i].trim() === x.a.trim() && x.a.trim(); x.ch[i] = inp.value; if (was) x.a = inp.value.trim(); touch(); drawList(); drawPhone(); drawIssues(); row.classList.toggle("right", !!inp.value.trim() && inp.value.trim() === x.a.trim()); };
            const del = btn("mk-mini", "×", () => { const was = x.ch[i].trim() === x.a.trim(); x.ch.splice(i, 1); if (was) x.a = ""; touch(); drawAll(); }, "Remove choice " + LET[i]);
            del.disabled = x.ch.length <= 2;
            row.append(el("b", "mk-let", LET[i]), r, inp, del); wrap.appendChild(row);
        });
        const foot = el("div", "mk-chfoot");
        const add = btn("btn ghost", "+ Add a choice", () => { x.ch.push(""); touch(); drawAll(); }); add.disabled = x.ch.length >= 5;
        const mix = btn("btn ghost", "Mix up the order", () => { for (let i = x.ch.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x.ch[i], x.ch[j]] = [x.ch[j], x.ch[i]]; } touch(); drawAll(); });
        foot.append(add, mix, el("small", "mk-hint", "Tap the circle beside the right choice. Wrong choices work best when they are real mistakes, like a sign error."));
        wrap.appendChild(foot);
        box.appendChild(field("Choices", wrap));
    } else {
        const an = el("input", "mk-in mk-a"); an.id = "ans"; an.value = x.a; an.maxLength = 200; an.placeholder = "Like 2/3, −6, $4.50, 3.6";
        an.oninput = () => { x.a = an.value; touch(); drawList(); drawPhone(); drawTry(); drawIssues(); };
        const n = V.numberOf(String(x.a).replace(/^\$/, "").replace(/[−‒–—]/g, "-").trim());
        box.appendChild(field("Answer", an, n != null ? "Equal numbers count on their own: 2/3 and 4/6, 0.5 and 1/2, −6 and -6. Units like ft can be left off." : "Students' answers are checked without caring about capitals, spaces or \"x =\"."));
        // Other answers to accept
        const chips = el("div", "mk-tags");
        x.al.forEach((t, i) => { const c = el("span", "mk-tag"); c.append(V.mathText(t)); c.appendChild(btn("mk-tagx", "×", () => { x.al.splice(i, 1); touch(); drawAll(); }, "Stop accepting " + t)); chips.appendChild(c); });
        const ai = el("input", "mk-in mk-tagin"); ai.placeholder = x.al.length ? "Add another" : "Type one and press Enter"; ai.maxLength = 80;
        ai.onkeydown = (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); const v = ai.value.trim(); if (v && !x.al.includes(v)) { x.al.push(v); touch(); drawAll(); $("altIn") && $("altIn").focus(); } } };
        ai.id = "altIn"; chips.appendChild(ai);
        box.appendChild(field("Also accept", chips, "Other ways a right answer could be written that are not just the same number, like 6 inches or six."));
    }

    // Hint
    const auto = V.hintFor("", x.a, x.q);
    const h = el("textarea", "mk-in"); h.rows = 2; h.maxLength = 200; h.value = x.h; h.placeholder = "Blank: Vault Raid writes one, like “" + auto + "”";
    h.oninput = () => { x.h = h.value; touch(); drawTry(); };
    box.appendChild(field("Second-try hint (optional)", h, "Shown after a wrong first answer when Second chance is on. Never give the answer away."));

    const iss = el("div", "mk-issues"); iss.id = "issues"; box.appendChild(iss); drawIssues();
}
function drawIssues() {
    const box = $("issues"), x = cur(); if (!box || !x) return; box.textContent = "";
    issues(x).forEach((i) => box.appendChild(el("p", "mk-issue" + (i.stop ? " stop" : ""), i.t)));
}
function insertAt(t, s) { const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? a; t.value = t.value.slice(0, a) + s + t.value.slice(b); t.focus(); t.selectionStart = t.selectionEnd = a + s.length; }

/* ---------- the student's screen ---------- */
function drawPhone() {
    const x = cur(), ph = $("phone"); ph.textContent = ""; if (!x) return;
    const g = { a: x.a, ch: x.ch && x.ch.filter((t) => t.trim()).length >= 2 ? x.ch.filter((t) => t.trim()) : null };
    const kind = V.formOf(g);
    $("phoneKind").textContent = BOXNAME[kind] || "Answer box";
    const card = el("div", "mk-pcard");
    const top = el("div", "mk-ptop"); top.appendChild(el("span", "mk-pchip", (x.s || "Questions").slice(0, 40))); top.appendChild(el("span", "mk-phack", "Hack a vault (1)")); card.appendChild(top);
    card.appendChild(x.q.trim() ? math("p", "mk-pq", x.q) : el("p", "mk-pq empty", "Your question shows here."));
    const ans = el("div", "mk-pans");
    if (kind === "mc") {
        const ch = el("div", "mk-pch");
        g.ch.forEach((t, i) => { const b = btn("mk-pc" + (tryText && tryText === t ? " on" : ""), null, () => { tryText = t; drawPhone(); drawTry(); }); b.append(el("b", null, LET[i]), math("span", null, t)); ch.appendChild(b); });
        ans.appendChild(ch);
    } else {
        const tabs = el("div", "mk-ptabs"); ["123 Number", "a/b Fraction", "1 a/b Mixed"].forEach((t, i) => tabs.appendChild(el("span", "mk-ptab" + ((kind === "" && i === 0) || (kind === "frac" && i === 1) || (kind === "mixed" && i === 2) ? " on" : ""), t)));
        if (/^(pow|sci|sol|list)/.test(kind)) tabs.insertBefore(el("span", "mk-ptab on", kind === "pow" ? "xⁿ Exponent" : kind === "sci" ? "×10ⁿ Sci." : kind === "sol" ? "✓ Choose" : "□ □ Boxes"), tabs.firstChild);
        ans.appendChild(tabs);
        const f = el("div", "mk-pfield");
        if (kind === "frac" || kind === "mixed") { f.appendChild(el("span", "mk-psign", "+/−")); if (kind === "mixed") f.appendChild(el("span", "mk-pbox w")); const fr = el("span", "mk-pfrac"); fr.append(el("span", "mk-pbox"), el("i"), el("span", "mk-pbox")); f.appendChild(fr); }
        else if (kind === "pow" || kind === "sci") { f.append(el("span", "mk-pbox w"), kind === "sci" ? el("span", "mk-px", "× 10") : el("span"), el("span", "mk-pbox sup")); }
        else if (/^list/.test(kind)) { for (let i = 0; i < +kind.slice(4); i++) { if (i) f.appendChild(el("span", "mk-px", ",")); f.appendChild(el("span", "mk-pbox w")); } }
        else if (kind === "sol") { ["One", "None", "Infinitely many"].forEach((t) => f.appendChild(el("span", "mk-pbox opt", t))); }
        else f.appendChild(el("span", "mk-ptext", "Your answer"));
        ans.appendChild(f);
    }
    const go = el("span", "mk-pgo", "Submit"); ans.appendChild(go);
    card.appendChild(ans); ph.appendChild(card);
    ph.appendChild(el("div", "mk-ppad", "Work pad"));
}
function drawTry() {
    const x = cur(), box = $("try"); box.textContent = ""; if (!x) return;
    box.appendChild(el("h3", null, "Try an answer"));
    const inp = el("input", "mk-in"); inp.id = "tryIn"; inp.value = tryText; inp.placeholder = x.ch ? "Tap a choice above, or type one" : "What might a student type?"; inp.maxLength = 80; inp.autocomplete = "off";
    inp.oninput = () => { tryText = inp.value; drawResult(); if (x.ch) drawPhone(); };
    box.appendChild(inp);
    const res = el("div", "mk-tryres"); res.id = "tryRes"; box.appendChild(res); drawResult();
}
function drawResult() {
    const x = cur(), res = $("tryRes"); if (!res || !x) return; res.textContent = "";
    const t = tryText.trim(); if (!t) { res.appendChild(el("p", "mk-trynote", "Check how Vault Raid marks it before the class does.")); return; }
    if (!x.a.trim()) { res.appendChild(el("p", "mk-trynote", "Add the answer first.")); return; }
    const ok = V.sameAnswer(t, x.a, x.al);
    const verdict = el("p", "mk-verdict " + (ok ? "ok" : "no")); verdict.append(el("b", null, ok ? "✓ Counts as right" : "✗ Counts as wrong")); res.appendChild(verdict);
    if (!ok) {
        const h = el("p", "mk-tryhint"); h.append(el("span", null, "Their second-try hint: "), document.createTextNode(x.h.trim() || V.hintFor(t, x.a, x.q))); res.appendChild(h);
        if (!x.ch) res.appendChild(btn("btn ghost", "Count “" + t.slice(0, 24) + "” as right too", () => { if (!x.al.includes(t)) x.al.push(t); touch(); drawAll(); }));
    }
}

function drawAll() { drawHead(); drawList(); drawEditor(); drawPhone(); drawTry(); }

/* ---------- from the Question Bank ---------- */
let BANK = null, WEEKS = PUBLISHED, picked = new Map(), SB = [];
loadStdBank().then((list) => { SB = list; if ($("bankDlg").open) { BANK = bankItems(); drawBank(); } });
/** Week-file writing to what a student types: {2/3} -> 2/3, 4{2/3} -> 4 2/3, § -> $. */
const typed = (s) => String(s == null ? "" : s).replace(/(\d)\{([^{}/]+)\/([^{}/]+)\}/g, "$1 $2/$3").replace(/\{([^{}/]+)\/([^{}/]+)\}/g, "$1/$2").replace(/§/g, "$").trim();
const shown = (s) => String(s == null ? "" : s).replace(/(\d)\{([^{}/]+)\/([^{}/]+)\}/g, "$1 $2/$3").replace(/§/g, "$");
function bankItems() {
    const all = [], seen = new Set();
    WEEKS.forEach((w) => extract(w).forEach((x) => {
        const key = x.cls + "|" + bnorm(x.q); if (seen.has(key)) return; seen.add(key);
        const why = hasFig(x.q) ? "Has a picture (Vault Raid shows text only)" : Array.isArray(x.choices) && /;/.test(x.a) ? "Select-all question" : !String(x.a || "").trim() ? "No answer" : "";
        all.push(Object.assign({}, x, { week: w.id, wlabel: w.label || w.id, monday: w.monday || "", key, why }));
    }));
    all.sort((a, b) => String(b.monday).localeCompare(String(a.monday)));
    // Then the standards bank: problems for every Alabama standard (js/stdBank.js), in standards order.
    SB.forEach((x) => all.push(Object.assign({}, x, { wlabel: SB_LABEL + " · " + x.id, monday: "", key: "sb|" + x.id, why: hasFig(x.q) ? "Has a picture (Vault Raid shows text only)" : "" })));
    return all;
}
function opts(sel, list, first) { const keep = sel.value; sel.textContent = ""; [["", first]].concat(list).forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.appendChild(o); }); if ([...sel.options].some((o) => o.value === keep)) sel.value = keep; }
function openBank() {
    BANK = bankItems(); picked = new Map();
    opts($("bkCls"), Object.entries(CLS).filter(([k]) => BANK.some((x) => inClass(x, k))), "All classes");
    const want = set.per.length ? (PERIODS.find((p) => p[0] === set.per[0]) || [])[1] : ""; if (want && [...$("bkCls").options].some((o) => o.value === want)) $("bkCls").value = want;
    opts($("bkKind"), KINDS.concat([SB_KIND]).filter((k) => BANK.some((x) => x.kind === k)).map((k) => [k, k]), "Every kind");
    const wk = []; WEEKS.slice().reverse().forEach((w) => { if (BANK.some((x) => x.week === w.id)) wk.push([w.id, (w.label || w.id) + (w.dates ? " · " + w.dates : "")]); });
    if (SB.length) wk.unshift([SB_WEEK, SB_LABEL + " (every standard)"]);
    opts($("bkWeek"), wk, "Every week");
    drawBank(); $("bankDlg").showModal(); $("bkQ").focus();
}
function drawBank() {
    const words = bnorm($("bkQ").value).split(" ").filter(Boolean), c = $("bkCls").value, k = $("bkKind").value, w = $("bkWeek").value;
    const list = BANK.filter((x) => inClass(x, c) && (!k || x.kind === k) && (!w || x.week === w) && (!words.length || words.every((t) => (bnorm(x.q) + " " + bnorm(x.a) + " " + bnorm(x.std || x.skill || "")).includes(t))));
    const box = $("bkList"); box.textContent = "";
    const have = new Set(set.qs.map((y) => bnorm(y.q)));
    list.slice(0, 120).forEach((x) => {
        const li = el("li", "mk-bk" + (x.why ? " off" : "")), lab = el("label", "mk-bklab");
        const cb = el("input"); cb.type = "checkbox"; cb.checked = picked.has(x.key); cb.disabled = !!x.why || have.has(bnorm(shown(x.q)));
        cb.onchange = () => { if (cb.checked) picked.set(x.key, x); else picked.delete(x.key); bankFoot(); };
        const body = el("span", "mk-bkbody"); body.appendChild(math("span", "mk-bkq", shown(x.q)));
        if (Array.isArray(x.choices) && x.choices.length) { const ch = el("span", "mk-bkch"); x.choices.forEach((t, i) => { const s = el("span"); s.append(el("b", null, LET[i] + ". "), V.mathText(shown(t))); ch.appendChild(s); }); body.appendChild(ch); }
        const a = el("span", "mk-bka"); a.append(el("b", null, "Answer: "), V.mathText(typed(x.a))); body.appendChild(a);
        const meta = el("span", "mk-bkmeta"); [CLS[x.cls] || x.cls, x.kind, x.wlabel, x.std ? x.std + (x.part || "") : x.skill || ""].filter(Boolean).forEach((t) => meta.appendChild(el("span", null, t)));
        if (x.why) meta.appendChild(el("span", "why", x.why)); else if (have.has(bnorm(shown(x.q)))) meta.appendChild(el("span", "why", "Already in this set"));
        body.appendChild(meta); lab.append(cb, body); li.appendChild(lab); box.appendChild(li);
    });
    $("bkCount").textContent = list.length ? (list.length > 120 ? "Showing 120 of " + list.length + ". Search to narrow it down." : list.length + (list.length === 1 ? " question" : " questions")) : BANK.length ? "Nothing matches. Try fewer words or Every week." : "Your bank is empty. Approved weeks fill it on their own.";
    bankFoot();
}
function bankFoot() { $("bkPicked").textContent = picked.size ? picked.size + (picked.size === 1 ? " question picked" : " questions picked") : ""; $("bkAdd").disabled = !picked.size; $("bkAdd").textContent = picked.size ? "Add " + picked.size + (picked.size === 1 ? " question" : " questions") : "Add questions"; }
function fromBank(x) {
    const ch = Array.isArray(x.choices) && x.choices.length >= 2 ? x.choices.map((t) => typed(t)).slice(0, 5) : null;
    let a = typed(x.a), al = [];
    // "{14/3} = 4{2/3}" is two ways to write one answer. "x = 5" and "A = 40°, B = 50°" are one answer each.
    if (!ch && / = /.test(a) && !/^[a-z]\s*=/i.test(a) && !a.includes(",") && !a.includes("(")) { const parts = a.split(/\s+=\s+/).map((t) => t.trim()).filter(Boolean); a = parts[0]; al = parts.slice(1, 4); }
    if (ch && !ch.includes(a)) { const k = LET.indexOf(a.toUpperCase()); a = k >= 0 && ch[k] ? ch[k] : a; }
    if (!ch && Array.isArray(x.also)) x.also.forEach((t) => { const v = typed(t); if (v && v !== a && !al.includes(v) && al.length < 4) al.push(v); });   // the standards bank's other right answers
    return newQ({ s: (x.skill || (x.std ? "AL " + x.std + (x.part || "") : "")).slice(0, 60), q: shown(x.q).slice(0, 400), a: a.slice(0, 200), al, ch });
}
function addQs(list) {
    if (!list.length) return;
    const empty = set.qs.length === 1 && !set.qs[0].q.trim() && !set.qs[0].a.trim();
    if (empty) set.qs = [];
    const at = set.qs.length; set.qs.push(...list); sel = at; tryText = ""; touch(); drawAll();
    status(list.length + (list.length === 1 ? " question added" : " questions added"), "ok");
}

/* ---------- a pasted list ---------- */
function parsePaste(text) {
    const out = [], bad = []; let title = "";
    String(text || "").replace(/\r\n?/g, "\n").split("\n").forEach((raw, i) => {
        const line = raw.trim(); if (!line) return;
        let p = (line.includes("\t") ? line.split("\t") : line.split(/\s+\|\s+|\s*\|\s*/)).map((x) => x.trim());
        while (p.length && !p[p.length - 1]) p.pop();
        if (p.length === 1 && /^(title|set)\s*:/i.test(p[0])) { title = p[0].replace(/^[^:]*:\s*/, "").slice(0, 80); return; }   // Title: Rational Numbers Test Review
        if (/^(category|skill)$/i.test(p[0]) || /^question$/i.test(p[1] || "")) return;   // a heading line
        // Optional extras anywhere after the question: "Hint: ..." and "Also: 6 in, six" (other answers to accept)
        let h = "", al = [];
        p = p.filter((t) => {
            if (/^hint\s*:/i.test(t)) { h = t.replace(/^hint\s*:\s*/i, "").slice(0, 200); return false; }
            if (/^also(\s+accept)?\s*:/i.test(t)) { al = t.replace(/^[^:]*:\s*/, "").split(/\s*;\s*|\s*,\s+/).map((x) => x.trim()).filter(Boolean).slice(0, 8); return false; }
            return true;
        });
        let s = "", q = "", a = "", ch = null;
        if (p.length === 4 && /^\d+$/.test(p[1]) ) { [s, , q, a] = p; }             // a Game Library table: category | points | question | answer
        else if (p.length === 2) { [q, a] = p; }
        else if (p.length === 3) { [s, q, a] = p; }
        else if (p.length >= 5) { [s, q, a] = p; ch = p.slice(3, 8).map((t) => t.replace(/^[A-Ea-e][).:]\s*/, "")); }
        else { bad.push(i + 1); return; }
        if (ch) { const k = LET.indexOf(a.toUpperCase()); if (a.length === 1 && k >= 0 && ch[k]) a = ch[k]; if (!ch.includes(a)) ch.unshift(a); ch = ch.slice(0, 5); }
        if (!q || !a) { bad.push(i + 1); return; }
        out.push(newQ({ s: s.slice(0, 60), q: q.slice(0, 400), a: a.slice(0, 200), al: ch ? [] : al, h, ch }));
    });
    return { out, bad, title };
}

/* ---------- saving and opening ---------- */
async function save() {
    if (saving) return;
    const doc = toDoc(); const n = doc.cats.reduce((t, c) => t + c.clues.length, 0);
    if (!n) { status("Add at least one finished question first", "bad"); return; }
    if (!set.title.trim()) { $("title").focus(); status("Name the set first", "bad"); return; }
    saving = true; drawHead(); status("Saving…");
    try {
        const id = set.id || uidOf(), at = Date.now();
        doc.id = id; await store.save("games/s_" + id, Object.assign({ at }, doc));
        const meta = { id, title: doc.title, cats: doc.cats.length, clues: n, final: false, per: doc.per, maker: 1, at };
        SETS = SETS.filter((x) => x.id !== id).concat([meta]); await store.save("games/index", { sets: SETS, at });
        set.id = id; dirty = false; store_(DRAFT, null);
        history.replaceState(null, "", "?" + new URLSearchParams(Object.assign({ set: id }, demo ? { demo: "" } : {})).toString());
        const left = set.qs.length - n;
        status(demo ? "Saved on this device" : "Saved" + (left ? " (" + left + " unfinished left out)" : ""), "ok");
    } catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
    saving = false; drawAll(); fillOpen();
}
function fillOpen() {
    const s = $("openSet"), keep = set.id; s.textContent = "";
    const o0 = el("option", null, SETS.length ? "Open a saved set…" : "No saved sets yet"); o0.value = ""; s.appendChild(o0);
    SETS.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).forEach((m) => { const o = el("option", null, (m.title || "Review game") + " (" + (m.clues || 0) + ")" + (m.maker ? "" : " · from the Game Library")); o.value = m.id; s.appendChild(o); });
    s.value = SETS.some((m) => m.id === keep) ? keep : "";
}
function openSet(id) {
    const meta = SETS.find((m) => m.id === id); if (!meta) return;
    if (dirty && !confirmLeave()) { fillOpen(); return; }
    status("Opening…");
    let done = false;
    const u = store.watch("games/s_" + id, (snap) => {
        if (done || snap.pending) return; done = true; setTimeout(() => u && u(), 0);
        if (!snap.exists || snap.data.removed) { status("That set is gone", "bad"); return; }
        set = fromDoc(snap.data, meta); sel = 0; dirty = false; tryText = ""; store_(DRAFT, null);
        history.replaceState(null, "", "?" + new URLSearchParams(Object.assign({ set: id }, demo ? { demo: "" } : {})).toString());
        status(meta.maker ? "Opened" : "Opened. Saving here adds the Question Maker's extras; the Game Library still plays it.", "ok"); drawAll(); fillOpen();
    }, () => status("Could not open that set", "bad"));
}
let leaveArm = 0;
function confirmLeave() { if (Date.now() - leaveArm < 5000) return true; leaveArm = Date.now(); status("Unsaved changes. Do that again within 5 seconds to leave them.", "bad"); return false; }

/* ---------- wiring ---------- */
$("title").oninput = () => { set.title = $("title").value; touch(); };
$("addQ").onclick = () => { set.qs.push(newQ({ s: cur() ? cur().s : "" })); sel = set.qs.length - 1; tryText = ""; touch(); drawAll(); $("q").focus(); };
$("save").onclick = save;
$("newSet").onclick = () => { if (dirty && !confirmLeave()) return; set = blank(); sel = 0; dirty = false; tryText = ""; store_(DRAFT, null); history.replaceState(null, "", demo ? "?demo" : location.pathname); status("New set", "ok"); drawAll(); fillOpen(); $("title").focus(); };
$("openSet").onchange = () => { const v = $("openSet").value; if (v) openSet(v); };
$("fromBank").onclick = openBank;
["bkQ"].forEach((i) => { let t = 0; $(i).oninput = () => { clearTimeout(t); t = setTimeout(drawBank, 150); }; });
["bkCls", "bkKind", "bkWeek"].forEach((i) => { $(i).onchange = drawBank; });
$("bkAdd").onclick = () => { addQs([...picked.values()].map(fromBank)); $("bankDlg").close(); };
$("paste").onclick = () => { $("pasteNote").textContent = ""; $("pasteDlg").showModal(); $("pasteText").focus(); };
$("pasteGo").onclick = () => {
    const { out, bad, title } = parsePaste($("pasteText").value);
    if (title && !set.title.trim()) { set.title = title; $("title").value = title; }
    if (!out.length) { $("pasteNote").textContent = bad.length ? "Could not read line" + (bad.length > 1 ? "s " : " ") + bad.slice(0, 6).join(", ") + ". Use Skill | Question | Answer." : "Paste at least one line."; return; }
    addQs(out); $("pasteText").value = ""; $("pasteDlg").close();
    if (bad.length) status("Added " + out.length + "; skipped line" + (bad.length > 1 ? "s " : " ") + bad.slice(0, 6).join(", "), "bad");
};
document.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } });
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

const user = await store.ready();
if (!user) location.replace("login.html");
else {
    uid = user.uid || "";
    $("who").textContent = demo ? "This device only, nothing is saved" : (user.name ? "Signed in as " + user.name : "Signed in");
    status(demo ? "This device only" : "Live", "ok");
    // Questions sent from the Question Bank page, or the set asked for, or the draft left last time.
    const inbox = load_(INBOX), want = qs.get("set"), draft = load_(DRAFT);
    if (draft && draft.qs && !want && !(inbox && inbox.length)) { set = Object.assign(blank(), draft); set.qs = set.qs.map((x) => newQ(x)); dirty = true; status("Picked up your unsaved set", "ok"); }
    if (inbox && inbox.length) { store_(INBOX, null); set = blank(); set.qs = []; addQs(inbox.map(fromBank)); }
    drawAll();
    let first = true;
    store.watch("games/index", (snap) => {
        if (snap.pending) return;
        SETS = ((snap.exists && snap.data && snap.data.sets) || []).filter((s) => s && s.id).slice(0, 200); fillOpen();
        if (first) { first = false; if (want && SETS.some((m) => m.id === want)) openSet(want); }
    }, () => { SETS = []; fillOpen(); });
    watchPrivateWeeks(store, PUBLISHED, (list) => { WEEKS = list; if ($("bankDlg").open) { BANK = bankItems(); drawBank(); } });
}
