/* ==========================================
   Anchor Board — Assignments: the rules, with no page, no sign-in and no network (tested in Node).
   Used by the teacher's page (assign.html, js/assignPage.js) and the student's page (do.html, js/do.js).

   Four kinds:
     practice  Mastery to a target. Each skill asks for N right; a miss or a "Still stuck?" just serves a fresh
               problem from that skill's pool. Instant feedback, a few tries per problem, worked steps.
     quiz/test One question per skill, 1 try, no feedback. Answers are checked on the TEACHER's page with the
               private key, and students see results only when the teacher releases them.
     fix       Test corrections: each student gets back only the questions they missed, with feedback,
               and part of the points they win back raises the original test score (70% → 85%).

   Two numbers, kept apart everywhere:
     grade     points earned (scores only go up: a right answer is never taken away, a miss costs nothing)
     complete  how much was attempted
   Misses, tries and time are a separate effort signal. They never lower a grade.

   Where the data lives (see firestore.rules):
     teacher/{uid}/asg/index        the list
     teacher/{uid}/asg/a_<id>       one assignment with its answer key (private)
     asg/{code}                     what students can read (no key for quizzes and tests)
     asg/{code}/p/{guest}           one student's own entry: who they are and every attempt
     asg/{code}/r/{guest}           a released quiz or test result, written by the teacher
========================================== */
import { sameAnswer, stepsFor, answerKind } from "./vaultCore.js?v=73";

export const TYPES = {
    practice: { label: "Practice", word: "practice", blurb: "Mastery: each skill asks for a number right. Instant feedback and fresh problems after a miss." },
    quiz: { label: "Quiz", word: "quiz", blurb: "One question per skill, one try, no feedback until you release results." },
    test: { label: "Test", word: "test", blurb: "Like a quiz, with a passcode option. Results and answers come out when you say." },
    fix: { label: "Test corrections", word: "corrections", blurb: "Each student redoes only what they missed. Part of what they fix raises the test score." },
};
export const isTest = (t) => t === "quiz" || t === "test";
export const LEVEL_MIN = { 1: 1, 2: 1.5, 3: 2.5 };   // rough minutes per problem, for the builder's time estimate
export const DEFAULTS = { need: 3, tries: 2, cap: 0, example: true, stuck: true, pass: "", release: "none", shuffle: true, lock: false, back: 0.5 };
export const MAX_LOG = 600;        // attempts kept per student entry (the rules allow no more)

/* ---------- small helpers ---------- */
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** A repeatable random stream from a text seed (mulberry32). */
export function rng(seed) {
    let a = hash(seed);
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(n, seed) { const r = rng(seed), a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** The seed for one student: the same on any Chromebook they use, so their problems don't change if they move. */
export const seedOf = (code, per, who) => code + "|" + per + "|" + who;
const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
export const pct = (v) => (v == null || !isFinite(v) ? "–" : Math.round(v * 100) + "%");
export const newCode = (rand = Math.random) => String(100000 + Math.floor(rand() * 900000));
export const validCode = (s) => /^[1-9]\d{5}$/.test(String(s || ""));
export const today = (d = new Date()) => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);

/** One problem, from the standards bank, a question set clue, or a saved assignment: { id, std, q, a, al, ch, st, lvl }. */
const money = (s) => String(s == null ? "" : s).replace(/§/g, "$");   // the bank writes § for a dollar sign
export function cleanItem(x) {
    const clip = (s, n) => money(s).slice(0, n);
    const list = (v, n, m) => (Array.isArray(v) ? v.map((s) => clip(s, m).trim()).filter(Boolean).slice(0, n) : []);
    const ch = list(x.ch || x.choices, 5, 80);
    return { id: clip(x.id || "", 40), std: clip(x.std || "", 12), q: clip(x.q, 400), a: clip(x.a, 200), al: list(x.al || x.also, 8, 80),
        ch: ch.length >= 2 ? ch : [], st: list(x.st || x.steps, 4, 200), lvl: [1, 2, 3].includes(+x.lvl) ? +x.lvl : 2 };
}
/** Is this typed answer right for this problem? Multiple choice compares the choice; everything else uses the game checker. */
export function isRight(item, typed) {
    const t = String(typed == null ? "" : typed).trim(); if (!t || !item) return false;
    if (item.ch && item.ch.length >= 2) { if (t === String(item.a).trim()) return true; if ((item.al || []).includes(t)) return true; return sameAnswer(t, item.a, item.al); }
    return sameAnswer(t, item.a, item.al);
}
/** The answer box a problem wants on the student's page. */
export const boxOf = (item) => (item && item.ch && item.ch.length >= 2 ? "mc" : answerKind(item && item.a));
/** Worked steps for a problem (its own, else the automatic ones the games use). */
export const stepsOf = (item) => stepsFor({ q: item && item.q, st: item && item.st });

/* ---------- the builder ---------- */
/** Minutes a student would likely spend: practice counts N problems a skill plus a few misses; a test, one each. */
export function estimateMins(def) {
    const o = Object.assign({}, DEFAULTS, def.opts || {});
    const per = (sk) => { const p = sk.pool || []; const lv = p.length ? p.reduce((s, x) => s + (LEVEL_MIN[x.lvl] || 1.5), 0) / p.length : 1.5; return lv; };
    const total = (def.skills || []).reduce((s, sk) => s + (def.type === "practice" ? (sk.need || o.need) * 1.3 : 1) * per(sk), 0);
    return Math.max(1, Math.round(total));
}
/** What a student's device may read: the title, the names to pick from and the problems.
    Practice and corrections carry the key (instant feedback needs it on the device). Quizzes and tests never do. */
export function publicDoc(def, names, owner) {
    const o = Object.assign({}, DEFAULTS, def.opts || {}), keyed = !isTest(def.type);
    const item = (x) => { const it = { q: x.q, ch: x.ch && x.ch.length >= 2 ? x.ch : [], b: boxOf(x) }; if (keyed) { it.a = x.a; it.al = x.al || []; it.st = stepsOf(x); } return it; };
    return {
        owner, kind: "asg", v: 1, title: clip(def.title, 80), type: def.type, status: def.status === "open" ? "open" : "closed",
        due: +def.due || 0, lock: !!(o.lock && def.due), names,
        opts: { need: o.need, tries: o.tries, cap: o.cap, example: !!o.example, stuck: !!o.stuck, shuffle: !!o.shuffle, back: o.back,
            pass: o.pass ? String(hash("ab|" + def.code + "|" + String(o.pass).trim().toLowerCase())) : "" },
        rel: isTest(def.type) ? (def.rel || "none") : "",
        skills: (def.skills || []).map((sk) => ({ k: sk.k, name: clip(sk.name, 80), std: sk.std || "", need: sk.need || o.need, w: sk.w || 1, pin: sk.pin != null && sk.pin >= 0 ? sk.pin : -1, pool: (sk.pool || []).map(item) })),
        fix: def.type === "fix" ? (def.fix || {}) : null,
        at: Date.now(),
    };
}
export const passOk = (pub, code, typed) => !pub.opts.pass || String(hash("ab|" + code + "|" + String(typed || "").trim().toLowerCase())) === pub.opts.pass;

/* ---------- practice: mastery to a target ---------- */
/**
 * One skill's state for one student, from their attempts in order.
 * log entries: { k: skill index, i: pool index, y: typed, o: 1 right · 0 wrong · 3 viewed the solution, t: seconds }
 * check(i, y) says if an answer is right (the student's device uses the key it has; the teacher's page re-checks with
 * the private key, so a changed or forged "o" never earns credit).
 * Returns { runs: [{ i, tries, ok, viewed, ended }], right, served, cur (open run or null), mastered, capped, done }.
 */
export function skillState(skill, kIdx, log, opts, check) {
    const o = Object.assign({}, DEFAULTS, opts || {}), need = skill.need || o.need;
    const mine = (log || []).filter((x) => x && +x.k === kIdx), runs = [];
    mine.forEach((x) => {
        let r = runs[runs.length - 1];
        if (!r || r.ended || r.i !== +x.i) { r = { i: +x.i, tries: [], ok: false, viewed: false, ended: false, secs: 0 }; runs.push(r); }
        if (+x.o === 3) { r.viewed = true; r.ended = true; return; }
        r.tries.push(String(x.y || "")); r.secs += Math.max(0, Math.min(900, +x.t || 0));
        const ok = check ? check(r.i, x.y) : +x.o === 1;
        if (ok) { r.ok = true; r.ended = true; }
        else if (r.tries.length >= triesFor(skill.pool && skill.pool[r.i], o)) r.ended = true;
    });
    const right = runs.filter((r) => r.ok).length, served = runs.length, cur = runs.length && !runs[runs.length - 1].ended ? runs[runs.length - 1] : null;
    const mastered = right >= need, capped = !mastered && o.cap > 0 && served >= o.cap && !cur;
    return { runs, right, need, served, cur, mastered, capped, done: mastered || capped };
}
/** Tries a problem allows: multiple choice gets 1 (guessing between 4 is not practice), others the teacher's number. */
export const triesFor = (item, o) => (item && item.ch && item.ch.length >= 2 ? 1 : Math.max(1, +(o || DEFAULTS).tries || 2));
/** The next problem in a skill: the student's own shuffled order, skipping ones already served; once the pool runs out,
    the ones they haven't got right come back. Never the same one twice in a row when there is another. */
export function nextProblem(skill, state, seed, shuffle = true) {
    const n = (skill.pool || []).length; if (!n) return -1;
    if (skill.pin != null && skill.pin >= 0 && skill.pin < n) return skill.pin;
    const order = shuffle ? shuffled(n, seed + "|" + skill.k) : Array.from({ length: n }, (_, i) => i);
    const used = new Set(state.runs.map((r) => r.i)), solved = new Set(state.runs.filter((r) => r.ok).map((r) => r.i));
    const last = state.runs.length ? state.runs[state.runs.length - 1].i : -1;
    const pick = (list) => list.find((i) => i !== last) ?? list[0];
    const fresh = order.filter((i) => !used.has(i)); if (fresh.length) return fresh[0];
    const again = order.filter((i) => !solved.has(i)); if (again.length) return pick(again);
    return pick(order);
}
/** A worked example for a skill: a problem the student won't be served first (the last one in their order). */
export function exampleFor(skill, seed, shuffle = true) {
    const n = (skill.pool || []).length; if (!n) return -1;
    const order = shuffle ? shuffled(n, seed + "|" + skill.k) : Array.from({ length: n }, (_, i) => i);
    return order[order.length - 1];
}
/** Grade and complete for practice: each skill counts min(right, N) of N (grade) and min(served, N) of N (complete), weighted. */
export function practiceScore(skills, log, opts, check) {
    let w = 0, g = 0, c = 0; const parts = skills.map((sk, k) => {
        const s = skillState(sk, k, log, opts, check ? (i, y) => check(k, i, y) : null), wt = +sk.w || 1;
        const grade = Math.min(s.right, s.need) / s.need, comp = Math.min(s.served, s.need) / s.need;
        w += wt; g += wt * grade; c += wt * comp; return Object.assign(s, { grade, comp, k });
    });
    return { grade: w ? g / w : 0, complete: w ? c / w : 0, parts };
}

/* ---------- quizzes and tests ---------- */
/** The problem each question shows this student: the pinned one, else one picked from the pool with their seed. */
export function testItems(skills, seed) {
    return skills.map((sk) => { const n = (sk.pool || []).length; if (!n) return -1; if (sk.pin != null && sk.pin >= 0 && sk.pin < n) return sk.pin; return Math.floor(rng(seed + "|t|" + sk.k)() * n); });
}
/** The problem index each question showed one student (their answer's, or their seed's pick for a blank). */
export function shownFor(def, r) {
    const seedPick = testItems(def.skills, seedOf(def.code, r.per, r.ni >= 0 ? "#" + r.ni : String(r.nm).toLowerCase()));
    return def.skills.map((sk, k) => { const a = (r.ans || {})[k]; return a && +a.i >= 0 ? +a.i : seedPick[k]; });
}
/** The order the questions show in (shuffled per student when the teacher asks). */
export const testOrder = (n, seed, shuffle) => (shuffle ? shuffled(n, seed + "|order") : Array.from({ length: n }, (_, i) => i));
/** Score a turned-in test with the private key. ans: { "<q>": { i, y } }. */
export function testScore(skills, ans, check) {
    let w = 0, got = 0, answered = 0; const parts = skills.map((sk, k) => {
        const a = (ans || {})[k], wt = +sk.w || 1, y = a ? String(a.y || "") : "", ok = !!(a && y && check(k, +a.i, y));
        w += wt; if (ok) got += wt; if (y) answered++;
        return { i: a ? +a.i : -1, y, ok, w: wt };
    });
    return { grade: w ? got / w : 0, points: got, of: w, complete: skills.length ? answered / skills.length : 0, parts };
}
/** Test corrections raise the test score by part of what was missed and then fixed: 70% with back 0.5 and every miss fixed is 85%. */
export function withCorrections(testGrade, fixedPts, totalPts, back) {
    if (testGrade == null) return null;
    const up = totalPts ? Math.max(0, fixedPts) / totalPts * (back == null ? DEFAULTS.back : back) : 0;
    return Math.min(1, testGrade + up);
}

/* ---------- the teacher's results ---------- */
/**
 * Join the student entries (one per device) into one row per student.
 * entries: [{ id, data: { per, ni, nm, lg, ans, done, at } }]; names: { period: ["Ava R.", …] }.
 * Two devices that picked the same name are merged (their attempts in time order) and flagged.
 */
export function joinEntries(entries, names) {
    const by = new Map();
    (entries || []).forEach(({ id, data: d }) => {
        if (!d || !d.per) return;
        const list = (names || {})[d.per] || [], ni = Number.isInteger(+d.ni) && +d.ni >= 0 && +d.ni < list.length ? +d.ni : -1;
        const nm = ni >= 0 ? list[ni] : clip(d.nm, 24).trim(); if (!nm) return;
        const key = d.per + "|" + (ni >= 0 ? "#" + ni : nm.toLowerCase());
        if (!by.has(key)) by.set(key, { key, per: d.per, ni, nm, ids: [], lg: [], ans: {}, done: false, at: 0, sub: 0 });
        const r = by.get(key); r.ids.push(id);
        (Array.isArray(d.lg) ? d.lg : []).forEach((x) => r.lg.push(Object.assign({ dev: id }, x)));
        Object.entries(d.ans || {}).forEach(([q, a]) => { const cur = r.ans[q]; if (a && (!cur || (+a.at || 0) >= (+cur.at || 0))) r.ans[q] = a; });
        r.done = r.done || !!d.done; r.at = Math.max(r.at, +d.at || 0); r.sub = Math.max(r.sub, +d.sub || 0);
    });
    const rows = [...by.values()];
    rows.forEach((r) => { if (r.ids.length > 1) r.lg.sort((a, b) => (+a.at || 0) - (+b.at || 0)); r.devices = r.ids.length; });
    return rows;
}
/** The key check the teacher's page uses: the private pool, plus any answer the teacher counted. */
export const keyCheck = (def) => (k, i, y) => { const sk = def.skills[k]; return !!(sk && sk.pool && sk.pool[i] && isRight(sk.pool[i], y)); };

/** Score every row of an assignment. Returns rows with { grade, complete, tries, missed, viewed, mins, per }. */
export function scoreRows(def, rows, extra = {}) {
    const check = keyCheck(def), o = Object.assign({}, DEFAULTS, def.opts || {});
    return rows.map((r) => {
        const tries = r.lg.filter((x) => +x.o !== 3).length, viewed = r.lg.filter((x) => +x.o === 3).length;
        const secs = r.lg.reduce((s, x) => s + Math.max(0, Math.min(900, +x.t || 0)), 0);
        let s;
        if (isTest(def.type)) s = testScore(def.skills, r.ans, check);
        else if (def.type === "fix") {
            const mine = ((def.fix || {}).who || {})[r.key] || null;
            s = fixScore(def, mine, r.lg, check);
        } else s = practiceScore(def.skills, r.lg, o, check);
        const missed = r.lg.filter((x) => +x.o !== 3 && !check(+x.k, +x.i, x.y)).length;
        return Object.assign({}, r, s, { tries, viewed, missed, mins: Math.round(secs / 6) / 10, started: tries + viewed > 0 || Object.keys(r.ans).length > 0 }, extra);
    });
}
/** Corrections: one "skill" per test question; a student works only the ones listed for them, needing 1 right each. */
export function fixScore(def, mine, log, check) {
    const qs = (mine && mine.q) || [], o = Object.assign({}, DEFAULTS, def.opts || {}, { need: 1, cap: 0 });
    let fixed = 0, pts = 0, served = 0; const parts = qs.map((k) => {
        const sk = def.skills[k]; const s = skillState(Object.assign({}, sk, { need: 1 }), k, log, o, (i, y) => check(k, i, y));
        if (s.right) { fixed++; pts += +sk.w || 1; } if (s.served) served++;
        return Object.assign(s, { k });
    });
    const missedPts = qs.reduce((s, k) => s + (+(def.skills[k] || {}).w || 1), 0);
    return { grade: qs.length ? fixed / qs.length : 1, complete: qs.length ? served / qs.length : 1, parts, fixed, fixedPts: pts, missedPts, before: mine ? mine.g : null,
        after: mine ? withCorrections(mine.g, pts, mine.of || missedPts, def.opts && def.opts.back) : null };
}
/** For test corrections: which questions each student missed, with the exact problem they saw. */
export function missedByStudent(def, scored) {
    const who = {};
    scored.forEach((r) => {
        if (!r.done && !Object.keys(r.ans).length) return;
        const miss = r.parts.map((x, k) => (!x.ok ? k : -1)).filter((k) => k >= 0); if (!miss.length) return;
        // A blank question gets the problem that student was shown (their own seed), so it is the same one.
        const shown = shownFor(def, r);
        who[r.key] = { q: miss, i: miss.map((k) => shown[k]), g: Math.round(r.grade * 1e4) / 1e4, of: r.of };
    });
    return who;
}

/* ---------- Student Progress (js/progress.js reads these, no separate store) ---------- */
/**
 * For one period: a Class Data set (data/i_<id>) with the grade first and one column per skill (with its standard),
 * and an effort record (progress/g_<id>) with every attempt as "qi:o:t:h", the same shape Vault Raid writes.
 * roster: the period's Rosters lines. Students show by their roster line, never more.
 */
export function toProgress(def, per, scored, roster) {
    const rows = scored.filter((r) => r.per === per && r.started);
    const rosterName = (r) => (r.ni >= 0 && roster && roster[r.ni] ? roster[r.ni] : r.nm);
    const id = "as" + def.id + "_" + per.replace(/[^A-Za-z0-9]/g, ""), date = today(new Date(def.opened || def.at || Date.now()));
    const title = TYPES[def.type].label + ": " + def.title;
    const cols = def.type === "fix" ? [] : def.skills;
    const imp = def.type === "fix" ? null : { id, title, std: "", skill: "", date, source: "Assignment", period: per, asg: def.id,
        items: ["Grade"].concat(cols.map((sk) => sk.name)), istd: [""].concat(cols.map((sk) => sk.std || "")),
        rows: rows.map((r) => ({ s: rosterName(r), v: [r.withFix != null ? r.withFix : r.grade].concat(cols.map((sk, k) => (r.parts[k] ? (isTest(def.type) ? (r.parts[k].y ? (r.parts[k].ok ? 1 : 0) : null) : r.parts[k].grade) : null))) })),
        at: Date.now() };
    // Effort: every problem a student met, flat-numbered across the skills' pools.
    const base = []; let n = 0; def.skills.forEach((sk) => { base.push(n); n += (sk.pool || []).length; });
    const qs = []; def.skills.forEach((sk) => (sk.pool || []).forEach((x) => qs.push({ q: clip(x.q, 160), a: clip(x.a, 60), std: x.std || sk.std || "", c: sk.name, n: 0, ok: 0, w: [] })));
    const check = keyCheck(def);
    const st = rows.map((r) => {
        const lg = [];
        if (isTest(def.type)) r.parts.forEach((x, k) => { if (x.i < 0 || !x.y) return; const qi = base[k] + x.i; lg.push(qi + ":" + (x.ok ? 1 : 0) + ":0:0"); const q = qs[qi]; q.n++; if (x.ok) q.ok++; else bumpWrong(q, x.y); });
        else r.parts.flatMap((s) => s.runs.map((run) => Object.assign({ k: s.k }, run))).forEach((run) => {
            const qi = base[run.k] + run.i, o = run.ok ? (run.tries.length > 1 || run.tries.length === 0 ? 2 : 1) : 0;
            const q = qs[qi]; if (!q) return; q.n++; if (run.ok && run.tries.length === 1) q.ok++; else if (run.tries[0]) bumpWrong(q, run.tries[0]);
            lg.push(qi + ":" + o + ":" + Math.round(run.secs || 0) + ":" + (run.viewed ? 1 : 0));
        });
        const right = lg.filter((x) => x.split(":")[1] === "1").length;
        return { s: rosterName(r), ta: lg.length, r: right, n: lg.length, best: 0, cr: 0, mins: r.mins || 0, lg: lg.slice(0, 400), rd: [], ex: null };
    }).filter((x) => x.lg.length);
    // Pools grow large; keep only the problems someone met, renumbered.
    const used = [...new Set(st.flatMap((x) => x.lg.map((s) => +s.split(":")[0])))].sort((a, b) => a - b), map = new Map(used.map((qi, j) => [qi, j]));
    st.forEach((x) => { x.lg = x.lg.map((s) => { const p = s.split(":"); p[0] = map.get(+p[0]); return p.join(":"); }); });
    const det = { id, date, at: Date.now(), period: per, game: "Assignment", kind: def.type, title, setId: def.id, vr: true, qs: used.map((qi) => qs[qi]), st };
    return { imp, det };
}
function bumpWrong(q, y) { const t = clip(y, 40); if (!t) return; const w = q.w.find((x) => x.a === t); if (w) w.n++; else q.w.push({ a: t, n: 1 }); q.w.sort((a, b) => b.n - a.n); q.w = q.w.slice(0, 3); }

/* ---------- the grade table ---------- */
/** One row per roster student, one column per assignment: { cols: [{ id, title, type }], rows: [{ s, cells: [{ g, c, before }] }] }. */
export function gradeTable(list, roster) {
    const cols = list.map((x) => ({ id: x.def.id, title: x.def.title, type: x.def.type, date: today(new Date(x.def.opened || x.def.at || Date.now())) }));
    const names = (roster || []).slice(); const extra = [];
    list.forEach((x) => x.rows.forEach((r) => { if (r.ni < 0 && !names.includes(r.nm) && !extra.includes(r.nm)) extra.push(r.nm); }));
    const rows = names.concat(extra).map((s, idx) => ({ s, cells: list.map((x) => {
        const r = x.rows.find((y) => (idx < names.length ? y.ni === idx : y.ni < 0 && y.nm === s));
        if (!r || !r.started) return null;
        return { g: r.withFix != null ? r.withFix : r.grade, c: r.complete, before: r.withFix != null ? r.grade : null };
    }) }));
    return { cols, rows };
}
export function tableCsv(t) {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const head = ["Student"].concat(t.cols.flatMap((c) => [c.title + " grade", c.title + " complete"]));
    return [head.map(q).join(",")].concat(t.rows.map((r) => [q(r.s)].concat(r.cells.flatMap((c) => (c ? [Math.round(c.g * 100), Math.round(c.c * 100)] : ["", ""]))).join(","))).join("\n");
}
