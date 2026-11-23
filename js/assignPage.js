/* ==========================================
   Anchor Board — Assignments, the teacher's page (assign.html).
   Build practice, quizzes and tests from the standards bank (or your own question sets), assign them with a code,
   watch who is trying, and send the results to Student Progress. Rules live in js/assignCore.js.

   Saved (private, teacher/{uid}/…):
     asg/index        the list           asg/a_<id>   one assignment with its key and a small results summary
     data/i_as<id>_<period> and progress/g_as<id>_<period>   the same Class Data + effort records Vault Raid writes,
                      so Student Progress picks assignments up with no store of its own
   Shared with students (asg/{code}, see firestore.rules): the title, the name list and the problems. Quizzes and
   tests go out without the key: this page checks them.
   ?demo: made-up students in this tab only, nothing is saved.
========================================== */
import * as C from "./assignCore.js?v=7";
import { namesOnly, indexEntry } from "./acapAssign.js?v=4";
import { sendToProgress, sigOf } from "./asgSync.js?v=2";
import * as V from "./vaultCore.js?v=75";
import { loadStdBank, inClass, LEVELS } from "./stdBank.js?v=2";
import { STANDARDS } from "../data/standards.js?v=58";
import qrcode from "./vendor/qrcode.js?v=1";

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const btn = (cls, text, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };
const mathEl = (tag, cls, text) => { const e = el(tag, cls); e.append(V.mathText(text)); return e; };
const short = (t, n = 90) => (t && t.length > n ? t.slice(0, n - 1).trim() + "…" : t || "");
const remember = (k, v) => { try { if (v === undefined) return localStorage.getItem("anchorboard-asg-" + k); localStorage.setItem("anchorboard-asg-" + k, v); } catch (e) { return null; } return null; };
const uidOf = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtWhen = (ms) => { if (!ms) return ""; const d = new Date(ms); return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
const ago = (ms) => { if (!ms) return "–"; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" }); };
const joinUrl = (code) => location.origin + "/do.html?c=" + code;

export async function mountAssign() {
    const demo = new URLSearchParams(location.search).has("demo");
    const store = await import(demo ? "./localStore.js?v=57" : "./boardStore.js?v=58");
    const rooms = demo ? demoRooms() : store.rooms;
    const PER = demo ? [["1st", "8th"], ["2nd", "8th"], ["5th", "7th"], ["6th", "8th-acc"]] : (await import("../data/weeks.js?v=61")).PERIODS;
    const CLS = Object.fromEntries(PER), classes = [...new Set(PER.map((p) => p[1]))].filter((c) => STANDARDS[c]);
    const clsLabel = (c) => (STANDARDS[c] && STANDARDS[c].label) || c;
    const status = (t, s) => { const n = $("status"); n.textContent = t; n.dataset.state = s || "wait"; };

    const user = await store.ready();
    if (!user) { location.replace("login.html"); return; }
    $("who").textContent = demo ? "Sample students, nothing is saved" : "Signed in as " + user.name;

    const S = { view: "list", id: "", period: "", draft: null, open: "", src: "bank", q: "", lv: [1, 2, 3], prev: null, table: remember("tper") || "" };
    const D = { rosters: {}, index: null, defs: new Map(), entries: new Map(), sets: [], bank: null, synced: new Map() };
    let drawT = 0; const soon = () => { clearTimeout(drawT); drawT = setTimeout(draw, 60); };
    const once = (path, fn) => { let done = false, un = null; un = store.watch(path, (s) => { if (done || s.pending) return; done = true; fn(s.exists ? s.data : null); if (un) setTimeout(un, 0); }, () => { if (!done) { done = true; fn(null); } }); };

    if (demo) await seedDemo(store, rooms);
    store.watch("rosters/all", (s) => { if (s.pending) return; D.rosters = (s.exists && s.data && s.data.periods) || {}; soon(); }, () => {});
    store.watch("asg/index", (s) => { if (s.pending) return; D.index = ((s.exists && s.data && s.data.list) || []).filter((x) => x && x.id); status(demo ? "Sample data" : "Live", "ok"); soon(); }, (e) => status("Could not load (" + ((e && e.code) || "error") + ")", "bad"));
    store.watch("games/index", (s) => { if (s.pending) return; D.sets = ((s.exists && s.data && s.data.sets) || []).filter((x) => x && x.id); }, () => {});
    loadStdBank().then((b) => { D.bank = b; soon(); });

    const unsubs = new Map();
    /** The full assignment (private copy), loaded once and kept in step. */
    function def(id) {
        if (!D.defs.has(id)) { D.defs.set(id, null); store.watch("asg/a_" + id, (s) => { if (s.pending) return; if (s.exists) D.defs.set(id, s.data); soon(); }, () => {}); }
        return D.defs.get(id);
    }
    /** Live student entries for an assignment with a code. */
    function watchEntries(d) {
        if (!d || !d.code || unsubs.has(d.id)) return;
        unsubs.set(d.id, rooms.watchAll("asg/" + d.code + "/p", (list) => { D.entries.set(d.id, list); soon(); syncSoon(d.id); }, () => {}));
    }
    // A "Work on next" assignment (Student Progress) is for one student: only that name shows, positions kept.
    const namesFor = (periods, d) => (d && d.only ? namesOnly(D.rosters[d.only.per] || [], d.only) : Object.fromEntries(periods.map((p) => [p, V.shortNames((D.rosters[p] || []).filter(Boolean))])));
    function scored(d) {
        const rows = C.joinEntries(D.entries.get(d.id) || [], namesFor(d.periods || [], d));
        const out = C.scoreRows(d, rows);
        if (C.isTest(d.type) && d.fixId) { const f = D.defs.get(d.fixId), fr = f && f.res && f.res.rows || []; out.forEach((r) => { const x = fr.find((y) => y.key === r.key); if (x && x.after != null) r.withFix = Math.max(r.grade, x.after); }); }
        return out;
    }

    // ---------- controls ----------
    [...$("views").children].forEach((b) => { b.onclick = () => { S.view = b.dataset.v; S.id = ""; draw(); }; });
    $("newBtn").onclick = () => startDraft();

    function draw() {
        [...$("views").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === (S.view === "table" ? "table" : "list"))));
        $("newBtn").hidden = S.view === "build";
        const out = $("out"); out.textContent = "";
        if (D.index == null) { out.append(skel()); return; }
        if (S.view === "build") return build(out);
        if (S.view === "results" && S.id) return results(out);
        if (S.view === "table") return table(out);
        list(out);
    }
    const skel = () => { const s = el("div", "pgSkel"); s.setAttribute("aria-hidden", "true"); s.append(el("i"), el("i")); return s; };
    function empty(h, p, label, fn) { const box = el("div", "pgEmpty"); box.append(el("h2", null, h), el("p", null, p)); if (label) box.append(btn("btn go", label, fn)); return box; }
    const chip = (text, cls) => el("span", "asChip " + (cls || ""), text);

    /* ---------- the list ---------- */
    function list(out) {
        const L = D.index.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
        if (!L.length) { out.append(empty("No assignments yet", "Pick standards from the bank, choose practice, a quiz or a test, and get a code students type in. Every attempt they make is saved, so you can see who is trying.", "New assignment", startDraft)); return; }
        const g = el("div", "asList");
        L.forEach((m) => {
            const d = def(m.id); if (d && d.status === "open") watchEntries(d);
            const c = el("button", "asCard"); c.type = "button"; c.onclick = () => { if (m.status === "draft") { S.draft = JSON.parse(JSON.stringify(d || m)); S.view = "build"; } else { S.view = "results"; S.id = m.id; S.period = ""; } draw(); window.scrollTo(0, 0); };
            const top = el("div", "asCardTop"); top.append(chip(C.TYPES[m.type].label, "t-" + m.type), chip(m.status === "open" ? "Open" : m.status === "draft" ? "Draft" : "Closed", "s-" + m.status));
            if (m.xc) top.append(chip("Extra credit", "s-xc"));
            if (m.only) top.append(chip("For " + m.only.nm, "s-one"));
            if (m.code && m.status === "open") top.append(el("span", "asCode", m.code));
            c.append(top, el("h3", null, m.title));
            const facts = el("p", "asFacts"); facts.textContent = [clsLabel(m.cls), (m.periods || []).join(", ") + " period", m.n + (m.n === 1 ? " skill" : " skills"), m.due ? "Due " + fmtWhen(m.due) : ""].filter(Boolean).join(" · "); c.append(facts);
            if (d && d.res && d.res.n != null) { const r = el("p", "asSum"); r.textContent = d.res.started + " started · average " + C.pct(d.res.avg) + (d.res.done != null ? " · " + d.res.done + " finished" : ""); c.append(r); }
            g.append(c);
        });
        out.append(g);
    }

    /* ---------- the builder ---------- */
    function startDraft() {
        const saved = (() => { try { return JSON.parse(remember("defaults") || "{}"); } catch (e) { return {}; } })();
        const cls = remember("cls") && classes.includes(remember("cls")) ? remember("cls") : classes[0];
        S.draft = { id: "", title: "", type: "practice", cls, periods: PER.filter((p) => p[1] === cls).map((p) => p[0]), skills: [], opts: Object.assign({}, C.DEFAULTS, saved), due: 0, status: "draft" };
        S.view = "build"; S.prev = null; draw(); window.scrollTo(0, 0);
    }
    function build(out) {
        const d = S.draft, o = d.opts, test = C.isTest(d.type);
        const wrap = el("div", "asBuild");
        // 1. kind
        const kinds = el("div", "asKinds"); kinds.setAttribute("role", "radiogroup"); kinds.setAttribute("aria-label", "Kind of assignment");
        ["practice", "quiz", "test"].forEach((t) => { const b = btn("asKind" + (d.type === t ? " on" : ""), null, () => { d.type = t; if (C.isTest(t) && o.release === undefined) o.release = "none"; draw(); }); b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(d.type === t)); b.append(el("b", null, C.TYPES[t].label), el("small", null, C.TYPES[t].blurb)); kinds.append(b); });
        if (d.type === "fix") kinds.append(chip("Test corrections", "t-fix"));
        wrap.append(sec("1", "What kind", kinds));
        // 2. who
        const who = el("div", "asWho");
        const title = el("label", "asField"); title.append(el("span", null, "Title")); const ti = el("input"); ti.value = d.title; ti.placeholder = d.skills[0] ? autoTitle(d) : "Like: Unit rates practice"; ti.maxLength = 80; ti.oninput = () => { d.title = ti.value; }; title.append(ti);
        const cf = el("label", "asField"); cf.append(el("span", null, "Class")); const cs = el("select"); classes.forEach((c) => { const op = el("option", null, clsLabel(c)); op.value = c; op.selected = c === d.cls; cs.append(op); });
        cs.onchange = () => { d.cls = cs.value; remember("cls", d.cls); d.periods = PER.filter((p) => p[1] === d.cls).map((p) => p[0]); draw(); }; cs.disabled = d.type === "fix"; cf.append(cs);
        const pf = el("div", "asField"); pf.append(el("span", null, "Periods"));
        const pc = el("div", "asPers"); PER.filter((p) => p[1] === d.cls).forEach(([p]) => { const l = el("label", "asPer"), i = el("input"); i.type = "checkbox"; i.checked = d.periods.includes(p); i.onchange = () => { d.periods = i.checked ? d.periods.concat([p]) : d.periods.filter((x) => x !== p); draw(); }; l.append(i, document.createTextNode(p + ((D.rosters[p] || []).length ? " (" + D.rosters[p].length + ")" : " (no roster)"))); pc.append(l); });
        pf.append(pc); who.append(title, cf, pf);
        const due = el("div", "asField"); due.append(el("span", null, "Due (optional)"));
        const dd = el("input"); dd.type = "datetime-local"; dd.value = d.due ? toLocalInput(d.due) : ""; dd.onchange = () => { d.due = dd.value ? new Date(dd.value).getTime() : 0; draw(); };
        const lock = el("label", "asChk"), li = el("input"); li.type = "checkbox"; li.checked = !!o.lock; li.disabled = !d.due; li.onchange = () => { o.lock = li.checked; }; lock.append(li, document.createTextNode("Stop taking answers at the due time"));
        due.append(dd, lock); who.append(due);
        wrap.append(sec("2", "Who and when", who));
        // 3. skills
        if (d.type !== "fix") wrap.append(sec("3", test ? "Questions (one per skill)" : "Skills", skillsBuilder(d)));
        else wrap.append(sec("3", "Questions", el("p", "asNote", "Each student gets back only the questions they missed on " + (d.fixOf || "the test") + ", the same problem they saw.")));
        // 4. settings
        const st = el("div", "asOpts");
        if (!test) {
            if (d.type === "practice") st.append(num("Right answers needed per skill", o.need, 1, 10, (v) => { o.need = v; }), num("Most problems per skill (0 = no limit)", o.cap, 0, 40, (v) => { o.cap = v; }));
            st.append(num("Tries per problem (multiple choice always gets 1)", o.tries, 1, 3, (v) => { o.tries = v; }));
            if (d.type === "practice") st.append(chk("Show a \"See an example\" button", o.example, (v) => { o.example = v; }));
            st.append(chk("Allow \"Still stuck?\" (shows how to solve it; that problem won't count)", o.stuck, (v) => { o.stuck = v; }));
            if (d.type === "fix") st.append(num("Share of the missed points a fix wins back (%)", Math.round(o.back * 100), 10, 100, (v) => { o.back = v / 100; }));
        } else {
            const pw = el("label", "asField"); pw.append(el("span", null, "Passcode (optional, you say it out loud)")); const pi = el("input"); pi.maxLength = 30; pi.value = o.pass || ""; pi.autocomplete = "off"; pi.oninput = () => { o.pass = pi.value.trim(); }; pw.append(pi); st.append(pw);
            st.append(chk("Mix up the question order for each student", o.shuffle, (v) => { o.shuffle = v; }));
            st.append(el("p", "asNote", "One try per question and no right or wrong until you release results from the results page. Each student gets their own problem from each skill's pool, unless you pick one problem for everyone."));
        }
        wrap.append(sec("4", "Settings", st));
        // footer
        const est = el("p", "asEst"); est.textContent = d.skills.length ? "About " + C.estimateMins(d) + " minutes · " + d.skills.length + (d.skills.length === 1 ? " skill" : " skills") + " · " + d.skills.reduce((s, x) => s + x.pool.length, 0) + " problems to draw from" : "Add at least one skill.";
        const foot = el("div", "asFoot"); foot.append(est);
        const fb = el("div", "asFootBtns");
        fb.append(btn("btn ghost", "Cancel", () => { S.draft = null; S.view = "list"; draw(); }), btn("btn ghost", "Save draft", () => saveDraft(false)));
        const go = btn("btn go", d.status === "open" ? "Save changes" : "Assign it", () => saveDraft(true)); go.disabled = !d.skills.length || !d.periods.length; fb.append(go);
        foot.append(fb); wrap.append(foot);
        if (S.err) wrap.append(el("p", "asErr", S.err));
        out.append(wrap);
    }
    const sec = (n, h, body) => { const s = el("section", "asSec"); const hh = el("h2"); hh.append(el("span", "asNum", n), document.createTextNode(h)); s.append(hh, body); return s; };
    function num(label, v, min, max, fn) { const l = el("label", "asField asNumF"); l.append(el("span", null, label)); const i = el("input"); i.type = "number"; i.min = min; i.max = max; i.value = v; i.onchange = () => { const x = Math.max(min, Math.min(max, Math.round(+i.value || min))); i.value = x; fn(x); soon(); }; l.append(i); return l; }
    function chk(label, v, fn) { const l = el("label", "asChk"), i = el("input"); i.type = "checkbox"; i.checked = !!v; i.onchange = () => fn(i.checked); l.append(i, document.createTextNode(label)); return l; }
    function toLocalInput(ms) { const d = new Date(ms), p = (x) => ("0" + x).slice(-2); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); }
    const autoTitle = (d) => (d.skills.length === 1 ? d.skills[0].name : d.skills.map((s) => s.std).filter(Boolean).slice(0, 4).join(", ")) + " " + C.TYPES[d.type].word;

    function skillsBuilder(d) {
        const box = el("div", "asSkills");
        // left: where problems come from
        const pick = el("div", "asPick");
        const tabs = el("div", "tabs"); [["bank", "Standards bank"], ["sets", "My question sets"]].forEach(([k, n]) => { const b = btn(null, n, () => { S.src = k; draw(); }); b.setAttribute("aria-pressed", String(S.src === k)); tabs.append(b); });
        pick.append(tabs);
        if (S.src === "bank") {
            const sr = el("input", "asSearch"); sr.type = "search"; sr.placeholder = "Search standards: 8.5, slope, unit rate…"; sr.value = S.q; sr.setAttribute("aria-label", "Search standards");
            sr.oninput = () => { S.q = sr.value; clearTimeout(sr._t); sr._t = setTimeout(() => { const pos = sr.selectionStart; draw(); const n = document.querySelector(".asSearch"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ok */ } } }, 200); };
            const lv = el("div", "asLv"); lv.append(el("span", null, "Levels"));
            [1, 2, 3].forEach((n) => { const l = el("label", "asChk sm"), i = el("input"); i.type = "checkbox"; i.checked = S.lv.includes(n); i.onchange = () => { S.lv = i.checked ? S.lv.concat([n]) : S.lv.filter((x) => x !== n); if (!S.lv.length) S.lv = [n]; draw(); }; l.append(i, document.createTextNode(LEVELS[n])); lv.append(l); });
            pick.append(sr, lv);
            const ul = el("div", "asStdList");
            if (!D.bank) ul.append(el("p", "asNote", "Loading the bank…"));
            else {
                const STD = (STANDARDS[d.cls] || { standards: [] }).standards, q = S.q.trim().toLowerCase();
                STD.filter((s) => !q || (s.code + " " + s.text + " " + (s.domain || "")).toLowerCase().includes(q)).forEach((s) => {
                    const pool = D.bank.filter((x) => x.std === s.code && inClass(x, d.cls) && S.lv.includes(x.lvl)); if (!pool.length) return;
                    const have = d.skills.some((x) => x.src === "bank:" + s.code);
                    const row = el("div", "asStd" + (have ? " in" : ""));
                    const t = el("div", "asStdT"); t.append(el("b", null, s.code + (s.critical ? " ★" : "")), el("span", null, short(s.text, 120)), el("small", null, pool.length + " problems · " + [1, 2, 3].map((n) => pool.filter((x) => x.lvl === n).length + " " + LEVELS[n].toLowerCase()).join(", ")));
                    const b = el("div", "asStdB");
                    b.append(btn("btn ghost sm", "Preview", () => preview({ name: s.code + " " + short(s.text, 50), std: s.code, pool: pool.map(C.cleanItem) })));
                    b.append(btn("btn" + (have ? " ghost" : "") + " sm", have ? "Added ✓" : "Add", () => { if (have) return; addSkill(d, { src: "bank:" + s.code, name: s.code + " " + short(s.text.split(/[,;.:]/)[0], 70), std: s.code, pool: pool.map(C.cleanItem) }); }));
                    row.append(t, b); ul.append(row);
                });
                if (!ul.childNodes.length) ul.append(el("p", "asNote", "No standard matches. Try a code like 8.5 or a word like slope."));
            }
            pick.append(ul);
        } else {
            const ul = el("div", "asStdList");
            if (!D.sets.length) ul.append(el("p", "asNote", "No saved question sets yet. Make one in the Question Maker."));
            D.sets.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).forEach((m) => {
                const row = el("div", "asStd"); const t = el("div", "asStdT"); t.append(el("b", null, m.title || "Question set"), el("small", null, (m.clues || 0) + " questions · " + (m.cats || 0) + " categories"));
                const b = el("div", "asStdB"); b.append(btn("btn sm", "Add its categories", () => addSet(d, m.id))); row.append(t, b); ul.append(row);
            });
            pick.append(ul);
        }
        // right: what's in it
        const inn = el("div", "asIn"); inn.append(el("h3", null, "In this " + C.TYPES[d.type].word + " (" + d.skills.length + ")"));
        if (!d.skills.length) inn.append(el("p", "asNote", "Nothing yet. Add a standard on the left."));
        d.skills.forEach((sk, k) => {
            const r = el("div", "asSk");
            const nm = el("input", "asSkName"); nm.value = sk.name; nm.maxLength = 80; nm.setAttribute("aria-label", "Skill name"); nm.oninput = () => { sk.name = nm.value; };
            const meta = el("small", null, (sk.std ? "Standard " + sk.std + " · " : "") + (sk.pin >= 0 ? "1 problem for everyone" : sk.pool.length + " problems"));
            const ctl = el("div", "asSkCtl");
            if (d.type === "practice") ctl.append(mini("Need", sk.need || d.opts.need, 1, 10, (v) => { sk.need = v; }));
            if (C.isTest(d.type)) ctl.append(mini("Points", sk.w || 1, 1, 10, (v) => { sk.w = v; }));
            else ctl.append(mini("Weight", sk.w || 1, 1, 5, (v) => { sk.w = v; }));
            ctl.append(btn("btn ghost sm", "Preview", () => preview(sk, k)));
            if (k > 0) ctl.append(btn("btn ghost sm", "↑", () => { d.skills.splice(k - 1, 0, d.skills.splice(k, 1)[0]); draw(); }));
            ctl.append(btn("btn ghost sm asRm", "Remove", () => { d.skills.splice(k, 1); draw(); }));
            r.append(nm, meta, ctl); inn.append(r);
        });
        box.append(pick, inn);
        return box;
    }
    function mini(label, v, min, max, fn) { const l = el("label", "asMini"); l.append(el("span", null, label)); const i = el("input"); i.type = "number"; i.min = min; i.max = max; i.value = v; i.onchange = () => { const x = Math.max(min, Math.min(max, Math.round(+i.value || min))); i.value = x; fn(x); soon(); }; l.append(i); return l; }
    function addSkill(d, sk) { d.skills.push(Object.assign({ k: "s" + uidOf(), w: 1, pin: -1 }, sk)); draw(); }
    function addSet(d, id) {
        once("games/s_" + id, (set) => {
            if (!set) { S.err = "Couldn't open that question set."; draw(); return; }
            (set.cats || []).forEach((cat) => { const pool = (cat.clues || []).filter((x) => x && x.q && x.a).map((x) => C.cleanItem({ q: x.q, a: x.a, al: x.al, ch: x.ch, st: x.st, std: x.std || "" })); if (pool.length) addSkill(d, { src: "set:" + id + ":" + cat.n, name: (cat.n || set.title || "Questions").slice(0, 80), std: pool[0].std || "", pool }); });
        });
    }

    /* ---------- preview: a problem as a student sees it, another one, pin it ---------- */
    function preview(sk, k) {
        const dlg = $("prev"); dlg.textContent = ""; let i = sk.pin >= 0 ? sk.pin : Math.floor(Math.random() * sk.pool.length);
        const paint = () => {
            dlg.textContent = ""; const it = sk.pool[i];
            const h = el("div", "asPrevH"); h.append(el("b", null, sk.name), el("small", null, "Problem " + (i + 1) + " of " + sk.pool.length + (it.lvl ? " · " + LEVELS[it.lvl] : ""))); dlg.append(h);
            dlg.append(mathEl("p", "asPrevQ", it.q));
            if (it.ch && it.ch.length) { const ul = el("ul", "asPrevCh"); it.ch.forEach((c, j) => ul.append(mathEl("li", null, "ABCDE"[j] + ". " + c))); dlg.append(ul); }
            const a = el("p", "asPrevA"); a.append("Answer: "); a.append(V.mathText(it.a)); if (it.al && it.al.length) a.append(el("small", null, "  Also accepted: " + it.al.join(", "))); dlg.append(a);
            const steps = C.stepsOf(it); if (steps.length) { const ol = el("ol", "asPrevSt"); steps.forEach((t) => ol.append(mathEl("li", null, t))); dlg.append(el("p", "asNote", "Worked steps students see after a miss:"), ol); }
            else dlg.append(el("p", "asNote", "No worked steps for this one yet; students see the answer."));
            const row = el("div", "asPrevBtns");
            row.append(btn("btn ghost", "Another one", () => { if (sk.pool.length > 1) { let j = i; while (j === i) j = Math.floor(Math.random() * sk.pool.length); i = j; } paint(); }));
            if (k != null && S.draft) {
                if (sk.pin === i) row.append(btn("btn ghost", "Use any problem from this skill", () => { sk.pin = -1; dlg.close(); draw(); }));
                else row.append(btn("btn ghost", "Use only this problem", () => { sk.pin = i; dlg.close(); draw(); }));
            }
            row.append(btn("btn", "Close", () => dlg.close())); dlg.append(row);
        };
        paint(); dlg.showModal();
    }

    /* ---------- save and assign ---------- */
    async function saveDraft(assign) {
        const d = S.draft; S.err = "";
        if (!d.title.trim()) d.title = autoTitle(d);
        remember("defaults", JSON.stringify(Object.assign({}, d.opts, { pass: "" })));
        if (!d.id) { d.id = uidOf(); d.at = Date.now(); }
        if (assign && d.status !== "open") { d.status = "open"; d.opened = Date.now(); }
        status("Saving…");
        try {
            if (d.status === "open" && !d.code) d.code = await freeCode();
            const clean = JSON.parse(JSON.stringify(d));
            await store.save("asg/a_" + d.id, clean); D.defs.set(d.id, clean);
            await saveIndex(clean);
            if (d.status !== "draft") await rooms.save("asg/" + d.code, C.publicDoc(clean, namesFor(clean.periods, clean), user.uid));
            // Corrections, once assigned, are remembered on their test so the test's scores rise with them.
            if (clean.type === "fix" && clean.fixOf && clean.status === "open") { const t = D.defs.get(clean.fixOf); if (t && t.fixId !== clean.id) { t.fixId = clean.id; await saveDef(t); } }
            status(demo ? "Sample data" : "Live", "ok");
            S.draft = null; S.view = d.status === "draft" ? "list" : "results"; S.id = d.id; draw(); window.scrollTo(0, 0);
        } catch (e) { S.err = "Couldn't save (" + ((e && e.code) || "connection") + "). Try again."; status("Not saved", "bad"); draw(); }
    }
    async function saveIndex(d) {
        const m = indexEntry(d);
        D.index = (D.index || []).filter((x) => x.id !== d.id).concat([m]);
        await store.save("asg/index", { list: D.index, at: Date.now() });
    }
    async function freeCode() {
        for (let t = 0; t < 8; t++) {
            const code = C.newCode(); let a = null, r = null;
            try { a = await rooms.get("asg/" + code); } catch (e) { a = null; }
            try { r = await rooms.get("rooms/" + code); } catch (e) { r = null; }
            if (!a && !r) return code;
        }
        throw Object.assign(new Error("no code"), { code: "no free code" });
    }

    /* ---------- results ---------- */
    function results(out) {
        const d = def(S.id); if (!d) { out.append(skel()); return; }
        if (S.seen !== S.id) { S.seen = S.id; S.open = ""; S.err = ""; }
        watchEntries(d);
        const rows = scored(d), pers = d.periods || [];
        if (!S.period || !pers.includes(S.period)) S.period = pers[0];
        const top = el("div", "asResTop");
        const back = btn("btn ghost", "← All assignments", () => { S.view = "list"; S.id = ""; draw(); });
        const ht = el("div", "asResT"); const hc = el("div", "asChips"); hc.append(chip(C.TYPES[d.type].label, "t-" + d.type), chip(d.status === "open" ? "Open" : "Closed", "s-" + d.status)); ht.append(hc, el("h2", null, d.title));
        const facts = el("p", "asFacts"); facts.textContent = [clsLabel(d.cls), d.due ? "Due " + fmtWhen(d.due) + (d.opts.lock ? " (stops taking answers then)" : "") : "No due date", d.skills.length + (C.isTest(d.type) ? " questions" : " skills")].join(" · "); ht.append(facts);
        top.append(back, ht);
        if (d.code) {
            const join = el("div", "asJoin");
            join.append(el("small", null, "Students go to"), el("b", "asUrl", location.host + "/do"), el("small", null, "and type"), el("b", "asBigCode", d.code));
            const jb = el("div", "asJoinBtns");
            jb.append(btn("btn ghost sm", "Copy link", (e) => { navigator.clipboard && navigator.clipboard.writeText(joinUrl(d.code)).then(() => { e.target.textContent = "Copied"; setTimeout(() => { e.target.textContent = "Copy link"; }, 1500); }, () => {}); }));
            jb.append(btn("btn ghost sm", "Show code big", () => bigCode(d)));
            // Google's free "Share to Classroom" link: Classroom opens with the link ready to post (the teacher picks the class).
            jb.append(btn("btn ghost sm", "Share to Google Classroom", () => { window.open("https://classroom.google.com/share?url=" + encodeURIComponent(joinUrl(d.code)) + "&title=" + encodeURIComponent(d.title || "Assignment") + "&body=" + encodeURIComponent("Open the link, or go to " + location.host + "/do and type code " + d.code + "."), "_blank", "noopener,width=640,height=720"); }));
            join.append(jb); top.append(join);
        }
        out.append(top);
        // actions
        const act = el("div", "asActs");
        if (d.status === "open") act.append(btn("btn ghost", "Close it", () => setStatus(d, "closed")));
        else act.append(btn("btn ghost", "Reopen", () => setStatus(d, "open")));
        act.append(btn("btn ghost", "Edit", () => { S.draft = JSON.parse(JSON.stringify(d)); S.view = "build"; draw(); }));
        if (C.isTest(d.type)) {
            const rel = d.rel || "none";
            if (rel === "none") { act.append(btn("btn go", "Release scores", () => release(d, "score")), btn("btn ghost", "Release scores and answers", () => release(d, "answers"))); }
            else { act.append(chip(rel === "answers" ? "Scores and answers released" : "Scores released", "s-open")); if (rel === "score") act.append(btn("btn ghost", "Release answers too", () => release(d, "answers"))); act.append(btn("btn ghost", "Hide results", () => release(d, "none"))); }
            if (d.fixId) act.append(btn("btn ghost", "Open the corrections", () => { S.id = d.fixId; S.period = ""; draw(); }));
            else act.append(btn("btn ghost", "Start test corrections", () => makeFix(d, rows)));
        }
        if (d.type === "fix" && d.fixOf) act.append(btn("btn ghost", "Back to the test", () => { S.id = d.fixOf; S.period = ""; draw(); }));
        act.append(btn("btn ghost asDanger", "Delete", () => remove(d)));
        out.append(act);
        const sy = el("p", "asNote asSync"); const sv = D.synced.get(d.id); sy.textContent = sv ? "Sent to Student Progress " + ago(sv) + "." : "Results go to Student Progress and Class Data as students work."; out.append(sy);
        if (S.err) out.append(el("p", "asErr", S.err));
        // period tabs
        if (pers.length > 1) { const pt = el("div", "tabs asPerTabs"); pers.forEach((p) => { const b = btn(null, p + " period", () => { S.period = p; S.open = ""; draw(); }); b.setAttribute("aria-pressed", String(p === S.period)); pt.append(b); }); out.append(pt); }
        const names = namesFor([S.period], d)[S.period] || [], nN = names.filter(Boolean).length, mine = rows.filter((r) => r.per === S.period), started = mine.filter((r) => r.started);
        // tiles
        const tiles = el("div", "pgTiles small");
        const tile = (b, s, sm) => { const t = el("div", "pgTile"); t.append(el("b", null, b), el("span", null, s)); if (sm) t.append(el("small", null, sm)); return t; };
        const avg = (f) => (started.length ? started.reduce((s, r) => s + f(r), 0) / started.length : null);
        tiles.append(tile(started.length + " of " + (nN || started.length), "started", nN ? (nN - mine.filter((r) => r.ni >= 0 && r.started).length) + " not yet" : ""));
        tiles.append(tile(C.pct(avg((r) => (r.withFix != null ? r.withFix : r.grade))), "average grade", "points earned"));
        tiles.append(tile(C.pct(avg((r) => r.complete)), "average complete", "how much was attempted"));
        if (C.isTest(d.type)) tiles.append(tile(String(mine.filter((r) => r.done).length), "turned in"));
        else tiles.append(tile(String(started.reduce((s, r) => s + r.tries, 0)), "tries", started.reduce((s, r) => s + r.viewed, 0) + " solutions viewed"));
        out.append(tiles);
        // per-skill strip
        out.append(skillStrip(d, started));
        // the students
        out.append(studentTable(d, mine, names));
    }
    function skillStrip(d, started) {
        const box = el("div", "asStrip"); if (d.type === "fix") return box;
        d.skills.forEach((sk, k) => {
            const xs = started.map((r) => r.parts[k]).filter(Boolean), c = el("div", "asStripC");
            const v = C.isTest(d.type) ? (xs.filter((x) => x.y).length ? xs.filter((x) => x.ok).length / xs.filter((x) => x.y).length : null) : (xs.length ? xs.filter((x) => x.mastered).length / xs.length : null);
            c.append(el("b", null, C.pct(v)), el("span", null, short(sk.name, 40)), el("small", null, C.isTest(d.type) ? "right" : "mastered"));
            c.dataset.band = v == null ? "" : v < 0.6 ? "low" : v < 0.8 ? "mid" : "ok"; box.append(c);
        });
        return box;
    }
    function studentTable(d, mine, names) {
        const wrap = el("div", "asTblWrap"), t = el("table", "asTbl");
        const hr = el("tr"); ["Student", "Grade", "Complete"].concat(d.type === "fix" ? ["Test score"] : d.skills.map((sk, k) => C.isTest(d.type) ? "Q" + (k + 1) : short(sk.name, 18))).concat(["Tries", "Last active"]).forEach((h, j) => { const th = el("th", null, h); if (j > 2 && j < 3 + d.skills.length && d.type !== "fix") th.title = d.skills[j - 3].name; hr.append(th); });
        const th = el("thead"); th.append(hr); t.append(th);
        const tb = el("tbody");
        const order = mine.filter((r) => r.started).sort((a, b) => (a.ni < 0) - (b.ni < 0) || a.ni - b.ni || a.nm.localeCompare(b.nm));
        order.forEach((r) => {
            const tr = el("tr", "asRow" + (S.open === r.key ? " open" : "")); tr.tabIndex = 0; tr.onclick = () => { S.open = S.open === r.key ? "" : r.key; draw(); }; tr.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tr.onclick(); } };
            const nm = el("td", "asNm"); nm.append(el("b", null, r.nm)); if (r.ni < 0) nm.append(el("small", null, " not on roster")); if (r.devices > 1) nm.append(el("small", "asWarn", " " + r.devices + " devices"));
            tr.append(nm, el("td", "asG", r.withFix != null ? C.pct(r.grade) + " → " + C.pct(r.withFix) : C.pct(r.grade)), el("td", null, C.pct(r.complete)));
            if (d.type === "fix") tr.append(el("td", null, r.before != null ? C.pct(r.before) + " → " + C.pct(r.after) : "–"));
            else d.skills.forEach((sk, k) => { const x = r.parts[k]; const td = el("td", "asCell");
                if (C.isTest(d.type)) { td.textContent = x && x.y ? (x.ok ? "✓" : "✗") : "–"; td.dataset.v = x && x.y ? (x.ok ? "ok" : "no") : ""; }
                else { td.textContent = x && x.served ? Math.min(x.right, x.need) + "/" + x.need : "–"; td.dataset.v = !x || !x.served ? "" : x.mastered ? "ok" : x.right ? "mid" : "no"; }
                tr.append(td); });
            tr.append(el("td", null, String(r.tries) + (r.viewed ? " · " + r.viewed + " viewed" : "")), el("td", null, ago(r.at)));
            tb.append(tr);
            if (S.open === r.key) { const dr = el("tr", "asDetail"), td = el("td"); td.colSpan = 5 + (d.type === "fix" ? 1 : d.skills.length); td.append(history(d, r)); dr.append(td); tb.append(dr); }
        });
        // roster students with no entry
        names.forEach((nm, ni) => { if (!nm || mine.some((r) => r.ni === ni && r.started)) return; const tr = el("tr", "asRow none"); tr.append(el("td", "asNm", nm), el("td", null, "Not started")); for (let j = 0; j < 3 + (d.type === "fix" ? 1 : d.skills.length); j++) tr.append(el("td")); tb.append(tr); });
        t.append(tb); wrap.append(t);
        if (!mine.length && !names.length) wrap.append(el("p", "asNote", "No class list for this period. Add one on the Rosters page so students can tap their name."));
        return wrap;
    }
    /** Every attempt, in order, with "Count it" for an answer the key missed. */
    function history(d, r) {
        const box = el("div", "asHist"), check = C.keyCheck(d);
        if (C.isTest(d.type)) {
            const shown = C.shownFor(d, r);
            r.parts.forEach((x, k) => { const sk = d.skills[k], it = sk.pool[shown[k]]; const row = el("div", "asAtt " + (x.y ? (x.ok ? "ok" : "no") : ""));
                row.append(el("b", null, "Q" + (k + 1))); if (it) row.append(mathEl("span", "asAttQ", it.q)); const y = el("span", "asAttY"); y.append(x.y ? V.mathText(x.y) : "(blank)"); row.append(y);
                if (it && !x.ok) { const a = el("small"); a.append("Key: "); a.append(V.mathText(it.a)); row.append(a); }
                if (it && x.y && !x.ok) row.append(btn("btn ghost sm", "Count it", () => countIt(d, k, x.i, x.y)));
                box.append(row); });
            if (r.sub) box.append(el("p", "asNote", "Turned in " + fmtWhen(r.sub) + "."));
            return box;
        }
        if (!r.lg.length) { box.append(el("p", "asNote", "No attempts yet.")); return box; }
        r.lg.forEach((x) => { const sk = d.skills[+x.k], it = sk && sk.pool[+x.i]; if (!it) return;
            const ok = +x.o !== 3 && check(+x.k, +x.i, x.y), row = el("div", "asAtt " + (+x.o === 3 ? "view" : ok ? "ok" : "no"));
            row.append(el("b", null, short(sk.name, 22)), mathEl("span", "asAttQ", it.q));
            const y = el("span", "asAttY"); if (+x.o === 3) y.append("Viewed the solution"); else y.append(V.mathText(x.y)); row.append(y);
            row.append(el("small", null, (x.t ? x.t + " s" : "") + (x.at ? " · " + new Date(x.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "")));
            if (+x.o !== 3 && !ok) row.append(btn("btn ghost sm", "Count it", () => countIt(d, +x.k, +x.i, x.y)));
            box.append(row); });
        return box;
    }
    async function countIt(d, k, i, y) {
        const it = d.skills[k] && d.skills[k].pool[i]; if (!it) return;
        if (!confirm("Count \"" + y + "\" as right for this problem? It will count for every student who wrote it.")) return;
        it.al = (it.al || []).concat([String(y).slice(0, 80)]).slice(-8);
        await saveDef(d);
        if (d.rel && d.rel !== "none") await release(d, d.rel, true);
    }
    async function saveDef(d) {
        try {
            await store.save("asg/a_" + d.id, JSON.parse(JSON.stringify(d))); D.defs.set(d.id, d); await saveIndex(d);
            if (d.code) await rooms.save("asg/" + d.code, C.publicDoc(d, namesFor(d.periods, d), user.uid));
            S.err = ""; syncSoon(d.id, true);
        } catch (e) { S.err = "Couldn't save (" + ((e && e.code) || "connection") + ")."; }
        draw();
    }
    async function setStatus(d, st) { d.status = st; await saveDef(d); if (st === "closed") syncNow(d.id); }
    async function release(d, rel, quiet) {
        d.rel = rel;
        try {
            await saveDef(d);
            const rows = scored(d), writes = [];
            rows.forEach((r) => r.ids.forEach((id) => {
                if (rel === "none") { writes.push({ path: "asg/" + d.code + "/r/" + id, del: true }); return; }
                const res = { pts: r.points, of: r.of, at: Date.now() };
                if (r.withFix != null) res.fix = Math.round(r.withFix * 1000) / 1000;
                const shown = C.shownFor(d, r);
                if (rel === "answers") res.q = r.parts.map((x, k) => { const it = d.skills[k].pool[shown[k]]; return { q: it ? it.q : "", y: x.y, ok: x.ok, a: it ? it.a : "" }; });
                writes.push({ path: "asg/" + d.code + "/r/" + id, data: res });
            }));
            if (writes.length) await rooms.many(writes);
            if (!quiet) S.err = "";
        } catch (e) { S.err = "Couldn't release results (" + ((e && e.code) || "connection") + ")."; }
        draw();
    }
    async function makeFix(d, rows) {
        const who = C.missedByStudent(d, rows);
        if (!Object.keys(who).length) { S.err = "Nobody has a missed question to correct yet."; draw(); return; }
        if (!confirm("Start test corrections? " + Object.keys(who).length + " students get back only the questions they missed, with feedback. Half of the points they win back (you can change this) raises their test score.")) return;
        const f = { id: uidOf(), at: Date.now(), title: d.title + " corrections", type: "fix", cls: d.cls, periods: d.periods.slice(), skills: JSON.parse(JSON.stringify(d.skills)),
            opts: Object.assign({}, C.DEFAULTS, { tries: 2, example: false, stuck: true, back: 0.5, pass: "" }), due: 0, status: "draft", fix: { who, test: d.id }, fixOf: d.id };
        S.draft = f; S.view = "build"; draw(); window.scrollTo(0, 0);
    }
    async function remove(d) {
        if (!confirm("Delete \"" + d.title + "\"? Students lose access and their attempts are deleted. Scores already sent to Student Progress and Class Data stay there.")) return;
        try {
            if (d.code) { try { await rooms.clear("asg/" + d.code + "/p"); await rooms.clear("asg/" + d.code + "/r"); await rooms.del("asg/" + d.code); } catch (e) { /* already gone */ } }
            if (unsubs.has(d.id)) { unsubs.get(d.id)(); unsubs.delete(d.id); }
            D.index = (D.index || []).filter((x) => x.id !== d.id); await store.save("asg/index", { list: D.index, at: Date.now() });
            await store.save("asg/a_" + d.id, { id: d.id, removed: true, at: Date.now() }); D.defs.delete(d.id);
            S.view = "list"; S.id = ""; draw();
        } catch (e) { S.err = "Couldn't delete (" + ((e && e.code) || "connection") + ")."; draw(); }
    }
    function bigCode(d) {
        const dlg = $("prev"); dlg.textContent = ""; dlg.classList.add("big");
        const q = qrcode(0, "M"); q.addData(joinUrl(d.code)); q.make();
        const n = q.getModuleCount(), NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 " + (n + 4) + " " + (n + 4)); svg.setAttribute("class", "asQr"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "QR code for assignment " + d.code);
        let p = ""; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += "M" + (c + 2) + " " + (r + 2) + "h1v1h-1z";
        const bg = document.createElementNS(NS, "rect"); bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#fff"); const path = document.createElementNS(NS, "path"); path.setAttribute("d", p); path.setAttribute("fill", "#081B45"); svg.append(bg, path);
        dlg.append(el("p", "asBigT", d.title), el("p", "asBigU", location.host + "/do"), el("p", "asBigC", d.code), svg, btn("btn", "Close", () => { dlg.close(); dlg.classList.remove("big"); }));
        dlg.showModal();
    }

    /* ---------- to Student Progress: the same Class Data + effort records Vault Raid writes ---------- */
    const syncT = new Map();
    function syncSoon(id, now) { clearTimeout(syncT.get(id)); syncT.set(id, setTimeout(() => syncNow(id), now ? 300 : 5000)); }
    async function syncNow(id) {
        const d = D.defs.get(id); if (!d || d.status === "draft" || demo && !d.code) return;
        const rows = scored(d), sig = sigOf(rows);
        if (D.synced.get(id + "|sig") === sig) return;
        try {
            await sendToProgress({ save: (p, x) => store.save(p, x), get: getDoc }, d, rows, D.rosters);
            D.synced.set(id, Date.now()); D.synced.set(id + "|sig", sig);
            // Corrections raise the test: re-send the test so its Class Data score and released results go up too.
            if (d.type === "fix" && d.fixOf && D.defs.get(d.fixOf)) { const t = D.defs.get(d.fixOf); watchEntries(t); setTimeout(() => { syncNow(t.id); if (t.rel && t.rel !== "none") release(t, t.rel, true); }, 1500); }
            soon();
        } catch (e) { /* the attempts are safe in the assignment; this copy is tried again on the next change */ }
    }
    const getDoc = (path) => new Promise((res) => once(path, res));

    /* ---------- the grade table ---------- */
    function table(out) {
        const pers = PER.map((p) => p[0]); if (!S.table || !pers.includes(S.table)) S.table = pers[0];
        const pt = el("div", "tabs asPerTabs"); pers.forEach((p) => { const b = btn(null, p + " period", () => { S.table = p; remember("tper", p); draw(); }); b.setAttribute("aria-pressed", String(p === S.table)); pt.append(b); }); out.append(pt);
        const metas = (D.index || []).filter((m) => m.status !== "draft" && (m.periods || []).includes(S.table)).sort((a, b) => (a.at || 0) - (b.at || 0));
        metas.forEach((m) => def(m.id));
        const roster = V.shortNames((D.rosters[S.table] || []).filter(Boolean));
        const list = metas.map((m) => D.defs.get(m.id)).filter((d) => d && d.type !== "fix").map((d) => {
            const rs = ((d.res && d.res.rows) || []).filter((r) => r.per === S.table).map((r) => ({ ni: r.ni, nm: r.nm, started: !!r.s, grade: r.g, complete: r.c, withFix: r.fx != null ? r.fx : null }));
            return { def: d, rows: rs };
        });
        if (!list.length) { out.append(empty("No results for " + S.table + " period yet", "Assign something to this period. Each assignment becomes a column here, with grade and complete for every student.", "New assignment", startDraft)); return; }
        const T = C.gradeTable(list, roster);
        const bar = el("div", "asTblBar"); bar.append(el("p", "asNote", "Grade is points earned; complete is how much was attempted. Test scores show corrections as 70% → 85%."));
        bar.append(btn("btn ghost", "Export CSV", () => { const blob = new Blob([C.tableCsv(T)], { type: "text/csv" }), a = el("a"); a.href = URL.createObjectURL(blob); a.download = "grades-" + S.table + "-period-" + C.today() + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }));
        out.append(bar);
        const wrap = el("div", "asTblWrap"), t = el("table", "asTbl asGrid"), hr = el("tr"); hr.append(el("th", null, "Student"));
        T.cols.forEach((c) => { const th = el("th"); const b = btn("asColBtn", null, () => { S.view = "results"; S.id = c.id; S.period = S.table; draw(); }); b.append(el("b", null, short(c.title, 28)), el("small", null, C.TYPES[c.type].label + " · " + c.date.slice(5))); th.append(b); hr.append(th); });
        const th = el("thead"); th.append(hr); t.append(th); const tb = el("tbody");
        T.rows.forEach((r) => { const tr = el("tr"); tr.append(el("td", "asNm", r.s)); r.cells.forEach((c) => { const td = el("td", "asCell"); if (!c) { td.textContent = "–"; } else { td.append(el("b", null, c.before != null ? C.pct(c.before) + " → " + C.pct(c.g) : C.pct(c.g)), el("small", null, C.pct(c.c) + " done")); td.dataset.v = c.g >= 0.8 ? "ok" : c.g >= 0.6 ? "mid" : "no"; } tr.append(td); }); tb.append(tr); });
        t.append(tb); wrap.append(t); out.append(wrap);
    }

    // Open straight to an assignment from a link (assign.html?a=<id>).
    const qa = new URLSearchParams(location.search).get("a"); if (qa) { S.view = "results"; S.id = qa; }
    // From the Standards Timeline tray (timeline.html "Make assignment"): open the builder with those standards as a practice draft.
    if (new URLSearchParams(location.search).get("from") === "timeline") {
        let h = null; try { h = JSON.parse(localStorage.getItem("anchorboard-asg-handoff") || "null"); localStorage.removeItem("anchorboard-asg-handoff"); } catch (e) { h = null; }
        if (h && h.from === "timeline" && Date.now() - (h.at || 0) < 30 * 60e3 && Array.isArray(h.skills) && h.skills.length) {
            const saved = (() => { try { return JSON.parse(remember("defaults") || "{}"); } catch (e) { return {}; } })();
            const cls = classes.includes(h.cls) ? h.cls : classes[0];
            S.draft = { id: "", title: String(h.title || "").slice(0, 80), type: "practice", cls, periods: PER.filter((p) => p[1] === cls).map((p) => p[0]),
                skills: h.skills.map((x) => ({ k: "s" + uidOf(), w: Math.max(1, Math.min(5, +x.w || 1)), pin: -1, src: String(x.src || ""), name: String(x.name || x.std || "").slice(0, 90), std: String(x.std || ""), need: Math.max(1, Math.min(10, +x.need || 4)), pool: (x.pool || []).map(C.cleanItem) })),
                opts: Object.assign({}, C.DEFAULTS, saved, { need: Math.max(1, Math.min(10, +h.need || 4)) }), due: 0, status: "draft" };
            S.view = "build"; S.prev = null;
        }
        window.history.replaceState(null, "", location.pathname + (demo ? "?demo" : ""));
    }
    draw();
}

/* ---------- ?demo: a this-tab copy of the student side, with made-up students ---------- */
function demoRooms() {
    const docs = new Map(), subs = new Set();
    const fire = () => subs.forEach((f) => setTimeout(f, 0));
    return {
        uid: () => "guest",
        get: async (p) => (docs.has(p) ? JSON.parse(JSON.stringify(docs.get(p))) : null),
        save: async (p, d) => { docs.set(p, JSON.parse(JSON.stringify(d))); fire(); },
        many: async (list) => { list.forEach((w) => { if (w.del) docs.delete(w.path); else docs.set(w.path, JSON.parse(JSON.stringify(w.data))); }); fire(); },
        clear: async (p) => { [...docs.keys()].filter((k) => k.startsWith(p + "/")).forEach((k) => docs.delete(k)); fire(); },
        del: async (p) => { docs.delete(p); fire(); },
        watchAll(p, next) { const f = () => next([...docs.entries()].filter(([k]) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).map(([k, v]) => ({ id: k.slice(p.length + 1), data: v })), []); subs.add(f); setTimeout(f, 0); return () => subs.delete(f); },
        _set: (p, d) => docs.set(p, d),
    };
}
async function seedDemo(store, rooms) {
    const names = ["Ava Rivera", "Ben Shaw", "Cora Diaz", "Dev Patel", "Eli Moore", "Fay Kim", "Gus Long", "Hana Ito"];
    await store.save("rosters/all", { periods: { "1st": names, "2nd": names.slice(0, 5), "5th": names.slice(2), "6th": names.slice(1, 7) } });
    const bank = await loadStdBank(), pick = (code) => bank.filter((x) => x.std === code && inClass(x, "8th")).map(C.cleanItem);
    const d = { id: "demo1", at: Date.now() - 864e5, opened: Date.now() - 864e5, title: "Slope and rate of change practice", type: "practice", cls: "8th", periods: ["1st", "2nd"], code: "424242", status: "open", due: Date.now() + 2 * 864e5,
        opts: Object.assign({}, C.DEFAULTS), skills: [{ k: "a", name: "8.11 Slope from two points", std: "8.11", w: 1, pin: -1, pool: pick("8.11") }, { k: "b", name: "8.12 Proportional relationships", std: "8.12", w: 1, pin: -1, pool: pick("8.12") }, { k: "c", name: "8.13 Linear equations", std: "8.13", w: 1, pin: -1, pool: pick("8.13") }].filter((s) => s.pool.length) };
    await store.save("asg/a_demo1", d);
    await store.save("asg/index", { list: [{ id: d.id, title: d.title, type: d.type, cls: d.cls, periods: d.periods, code: d.code, status: "open", at: d.at, due: d.due, n: d.skills.length }], at: Date.now() });
    const short = V.shortNames(names), t0 = Date.now() - 3600e3;
    short.slice(0, 6).forEach((nm, ni) => {
        const lg = []; let t = t0 + ni * 60e3;
        d.skills.forEach((sk, k) => {
            const want = [3, 3, 2, 1, 3, 0][ni] - (k === 2 && ni % 2 ? 1 : 0); let got = 0, i = 0;
            while (got < Math.max(0, want) && i < sk.pool.length) { const it = sk.pool[i]; const miss = (ni + i + k) % 3 === 0; if (miss) lg.push({ k, i, y: "12", o: 0, t: 40, at: t += 50e3 }); lg.push({ k, i, y: it.a, o: 1, t: 35, at: t += 45e3 }); got++; i++; }
            if (ni === 3 && k === 0) lg.push({ k, i, y: "", o: 3, t: 80, at: t += 60e3 });
        });
        rooms._set("asg/424242/p/dev" + ni, { per: "1st", ni, nm, at: t, lg, ans: {}, done: false });
    });
}
