/* ==========================================
   Anchor Board — student profiles, the rules every game shares.
   Pure functions only (no page, no store), so they can be tested on their own (tools/profiles/core.test.mjs).

   One profile per student, built from the teacher's roster and keyed by period + first name + last initial
   (the same short name Vault Raid shows). It lives at teacher/{uid}/profiles/{period}: one document per
   class period, teacher-only. Only the teacher's Remote writes it, once, after a game ends. Students never
   write it; their Chromebook only remembers which name it plays as (play.html, this browser only).

     teacher/{uid}/profiles/{period} = { v: 1, per, at, kids: { <key>: KID } }
     KID = { nm, xp, bank, sp, g, ld, fx, tr, b: [badge keys], best: { c, acc, st },
             av, vs (the character and vault skin they last picked),
             t: { <topic key>: { l, a, r, tr, h, d, rd, w: { <week>: [right, tries] }, m } } }
       nm    "Ava R." (first name + last initial, never more)
       xp    effort and mastery points: right answers, fixes after a miss, tries, cracked locks
       bank  coins banked from answering (10 a right answer, 5 a fix). A crack in a game never touches the bank.
       sp    banked coins spent (a Shield from the bank). Coins to spend = bank - sp.
       g, ld games played, last day played ("2026-11-20")
       fx    misses fixed on a second try (strategy change after a miss), all time
       tr    right answers as part of a team, all time
       best  personal bests: c (most Vault Raid coins in one game), acc (best % right, 8+ answers), st (longest streak)
       t     one entry per topic (the question's Alabama standard, like 7.10, else its skill name):
             l label · a tries · r right · tr right as a team · h last 10 results ("1101", newest last)
             d days with a right answer · rd last day with a right answer · w right/tries per week (12 weeks) · m day the lock cracked

   Level = locks cracked (topics mastered), not time served. A lock cracks at LOCK_RIGHT right answers,
   LOCK_RECENT of the last LOCK_WINDOW right, on LOCK_DAYS different days. A cracked lock never locks again.
========================================== */

export const LOCK_RIGHT = 5, LOCK_WINDOW = 8, LOCK_RECENT = 6, LOCK_DAYS = 2, HIST = 10, WEEKS = 12;
export const XP = { right: 10, fix: 6, try: 1, team: 6, lock: 50, classRight: 2, classMax: 20 };
export const BANK = { right: 10, fix: 5, team: 5, classRight: 2, classMax: 20 };
export const BANK_SHIELD = 30;      // banked coins for a Shield brought into a Vault Raid game (once a game)
export const GRACE_GIFT = 10;       // a grace lock: the hacker still finds this many new coins, the student loses none

/** Avatars (an index into vaultCore AVATARS): the first 8 are open to everyone, the rest open with XP. */
export const AVATAR_XP = [0, 0, 0, 0, 0, 0, 0, 0, 100, 200, 350, 500, 700, 900, 1200, 1500];
export const avatarsOpen = (xp) => AVATAR_XP.filter((x) => (+xp || 0) >= x).length;
/** Vault skins (vaultCore SKINS) also open for good with locks: skin i at level i. */
export const skinsByLevel = (lv) => Math.max(1, (+lv || 0) + 1);

/** Badges: few, and each one named for a skill. [key, name, what earns it]. */
export const BADGES = [
    ["lock1", "First Lock", "Crack your first topic lock."],
    ["eq", "Equation Breaker", "Crack a lock on an equations or inequalities standard."],
    ["comeback", "Comeback Crew", "Fix 10 misses on your second try."],
    ["steady", "Steady Hand", "90% right on 10 or more answers in one game."],
    ["team", "Team Anchor", "Get 15 answers right with your team."],
    ["lock5", "Lock Master", "Crack 5 topic locks."],
];
export const badge = (k) => BADGES.find((b) => b[0] === k) || null;
/** Standards whose wording is about equations or inequalities (from data/standards.js). */
const EQ_STDS = new Set(["7.9", "7.21", "8.4", "8.9", "8.11", "8.12", "8.14", "alg i.8", "alg i.9", "alg i.10", "alg i.11", "alg i.12", "alg i.13", "alg i.14", "alg i.16", "alg i.18", "alg i.19", "alg i.20"]);

/* ---------- names and keys ---------- */
/** How a name compares: lower case, no dots, single spaces ("Ava R." and "ava r" are the same). */
export const normName = (s) => String(s || "").toLowerCase().replace(/[.]/g, "").replace(/\s+/g, " ").trim();
/** The profile key for a short name ("Ava R." -> "ava-r"). Stable across games; the period is the document. */
export const kidKey = (nm) => normName(nm).replace(/[^a-z0-9à-ɏ]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
/** A period label as a document id ("1st" stays "1st"; anything odd becomes safe). */
export const perKey = (per) => String(per || "").trim().replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 20) || "class";
/**
 * Match a typed name to the roster's short names, so "ava r", "Ava R" and "Ava" (when only one Ava) all land on
 * the same profile. Returns the roster index, or -1 when it matches nobody (or more than one: never guess).
 */
export function matchRoster(typed, names) {
    const t = normName(typed); if (!t || !Array.isArray(names)) return -1;
    const list = names.map(normName);
    let i = list.indexOf(t); if (i >= 0) return i;
    const tight = (s) => s.replace(/\s+/g, ""); i = list.findIndex((n) => tight(n) === tight(t)); if (i >= 0) return i;
    const first = (s) => s.split(" ")[0];
    if (!t.includes(" ")) { const hits = list.map((n, j) => (first(n) === t ? j : -1)).filter((j) => j >= 0); return hits.length === 1 ? hits[0] : -1; }
    // "ava rivera" typed for "Ava R." (first name and the start of the last name)
    const [tf, tl] = [first(t), t.split(" ").slice(1).join(" ")];
    const hits = list.map((n, j) => { const nl = n.split(" ").slice(1).join(" ").replace(/\s\d+$/, ""); return first(n) === tf && nl && tl.startsWith(nl) ? j : -1; }).filter((j) => j >= 0);
    return hits.length === 1 ? hits[0] : -1;
}

/* ---------- topics ---------- */
const STD = /\b(alg\s*i\.\d+|[78]\.\d+)/i;
/** The topic a question counts toward: its Alabama standard when the skill names one ("AL 7.10a" -> 7.10), else the skill name. */
export function topicOf(cat) {
    const s = String(cat || "").replace(/\s+/g, " ").trim(), m = s.match(STD);
    if (m) { const code = m[1].replace(/^alg\s*i/i, "Alg I"); return { k: "s-" + code.toLowerCase().replace(/[^a-z0-9]+/g, "-"), l: code, std: code.toLowerCase() }; }
    if (!s) return { k: "k-questions", l: "Questions", std: "" };
    return { k: "k-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40), l: s.slice(0, 40), std: "" };
}
export const isEquationTopic = (t) => !!t && (EQ_STDS.has(String(t.std || "").toLowerCase()) || /equation|inequal/i.test(t.l || ""));

/* ---------- dates ---------- */
export const dayOf = (d = new Date()) => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
/** ISO week of a "YYYY-MM-DD" day, like "2026-W47". */
export function weekOf(day) {
    const [y, m, dd] = String(day).split("-").map(Number); const d = new Date(Date.UTC(y, (m || 1) - 1, dd || 1));
    const wd = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - wd);
    const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)), wk = Math.ceil(((d - y0) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + "-W" + ("0" + wk).slice(-2);
}

/* ---------- locks ---------- */
const ones = (s) => [...String(s || "")].filter((c) => c === "1").length;
/** Is this topic's lock cracked by the numbers (ignores the m flag)? */
export const lockReady = (t) => !!t && (+t.r || 0) >= LOCK_RIGHT && ones(String(t.h || "").slice(-LOCK_WINDOW)) >= LOCK_RECENT && (+t.d || 0) >= LOCK_DAYS;
export const cracked = (t) => !!(t && t.m);
export const levelOf = (kid) => Object.values((kid && kid.t) || {}).filter(cracked).length;
/** Progress toward one lock, 0..1, and the three parts as kids see them. */
export function lockProgress(t) {
    const r = Math.min(LOCK_RIGHT, +t.r || 0), rec = Math.min(LOCK_RECENT, ones(String(t.h || "").slice(-LOCK_WINDOW))), d = Math.min(LOCK_DAYS, +t.d || 0);
    return { r, rNeed: LOCK_RIGHT, rec, recNeed: LOCK_RECENT, d, dNeed: LOCK_DAYS, pct: Math.round(100 * (r / LOCK_RIGHT + rec / LOCK_RECENT + d / LOCK_DAYS) / 3) };
}
/** The next lock: the topic tried but not cracked that is closest to cracking. null when there is none yet. */
export function nextLock(kid) {
    let best = null;
    Object.entries((kid && kid.t) || {}).forEach(([k, t]) => {
        if (cracked(t) || !(+t.a)) return;
        const p = lockProgress(t);
        if (!best || p.pct > best.pct || (p.pct === best.pct && (+t.a) > best.a)) best = Object.assign({ k, l: t.l, a: +t.a }, p);
    });
    if (!best) return null;
    const left = [];
    if (best.r < best.rNeed) left.push((best.rNeed - best.r) + " more right");
    if (best.rec < best.recNeed) left.push(best.recNeed + " of your last " + LOCK_WINDOW + " right");
    if (best.d < best.dNeed) left.push(best.dNeed - best.d === 1 ? "one more day" : (best.dNeed - best.d) + " more days");
    best.left = left.join(" · ");
    return best;
}

/* ---------- one game's gain ---------- */
/** An empty gain for one student from one game. ans: [{ tk, l, std, ok, team }]. */
export const newGain = (nm) => ({ nm, xp: 0, bank: 0, sp: 0, fx: 0, tr: 0, n: 0, r: 0, ans: [], best: { c: 0, acc: 0, st: 0 }, play: 1 });

/**
 * A Vault Raid player's gain from their answer log. lg: [{ i (question index), ok, fx }] as js/liveRoom.js keeps it;
 * qs: the game's questions ({ c: skill }). Only the first try counts for accuracy; a fix after a miss earns XP and coins.
 */
export function vaultGain(p, qs) {
    const g = newGain(p.nm);
    (p.lg || []).forEach((x) => {
        const q = qs[x.i]; if (!q) return;
        const t = topicOf(q.c); g.ans.push({ tk: t.k, l: t.l, std: t.std, ok: x.ok ? 1 : 0, team: 0 });
        g.n++; if (x.ok) g.r++; if (!x.ok && x.fx) g.fx++;
    });
    g.xp = XP.right * g.r + XP.fix * g.fx + XP.try * g.n;
    g.bank = BANK.right * g.r + BANK.fix * g.fx;
    g.sp = Math.max(0, +p.bsp || 0);
    g.best = { c: Math.max(0, +p.c || 0), acc: g.n >= 8 ? Math.round(100 * g.r / g.n) : 0, st: Math.max(0, +p.best || 0) };
    return g;
}

/**
 * Gains for a teacher-led team game (js/games.js). log: [{ c (skill), w: [team indices right], x: [team indices that answered] }];
 * teams: [{ m: [roster lines] }]; nameOf(rosterLine) -> the short name, or "" when not on the roster.
 * Only teams with named members (the Group maker's groups) count by name. Returns { <short name>: gain }.
 */
export function teamGains(log, teams, nameOf) {
    const out = {};
    const members = (teams || []).map((t) => (Array.isArray(t && t.m) ? t.m.map(nameOf).filter(Boolean) : []));
    (log || []).forEach((e) => {
        if (!Array.isArray(e.w) || !Array.isArray(e.x)) return;   // an older entry, or a whole-class game
        const t = topicOf(e.c);
        e.x.forEach((ti) => (members[ti] || []).forEach((nm) => {
            const g = out[nm] || (out[nm] = newGain(nm)), ok = e.w.includes(ti) ? 1 : 0;
            g.ans.push({ tk: t.k, l: t.l, std: t.std, ok, team: 1 }); g.n++;
            if (ok) { g.r++; g.tr++; }
        }));
    });
    Object.values(out).forEach((g) => { g.xp = XP.team * g.r + XP.try * g.n; g.bank = BANK.team * g.r; });
    return out;
}
/** A whole-class game (Class vs. Teacher, Rapid Fire, Bingo, Tug of War): small participation XP for each student present, no topic record. */
export function classGain(nm, rights) {
    const g = newGain(nm), r = Math.max(0, +rights || 0);
    g.xp = Math.min(XP.classMax, XP.classRight * r + 4); g.bank = Math.min(BANK.classMax, BANK.classRight * r);
    return g;
}

/* ---------- adding a gain to a profile ---------- */
const blankKid = (nm) => ({ nm, xp: 0, bank: 0, sp: 0, g: 0, ld: "", fx: 0, tr: 0, b: [], best: { c: 0, acc: 0, st: 0 }, t: {} });
const clone = (o) => JSON.parse(JSON.stringify(o));
/** Make whatever is stored safe to use (old or partly written profiles). */
export function cleanKid(k, nm) {
    const out = Object.assign(blankKid(nm || (k && k.nm) || ""), k && typeof k === "object" ? clone(k) : {});
    ["xp", "bank", "sp", "g", "fx", "tr"].forEach((f) => { out[f] = Math.max(0, Math.floor(+out[f] || 0)); });
    out.b = Array.isArray(out.b) ? out.b.filter((x) => badge(x)) : [];
    out.best = Object.assign({ c: 0, acc: 0, st: 0 }, out.best || {});
    out.t = out.t && typeof out.t === "object" ? out.t : {};
    if (nm) out.nm = nm;
    return out;
}

/**
 * Add one game's gain to a student's profile. Returns { kid, locks: [labels newly cracked], badges: [keys newly earned] }.
 * Never takes anything away: no streak loss, no lost locks, no lost XP.
 */
export function applyGain(kidIn, gain, day = dayOf()) {
    const kid = cleanKid(kidIn, gain.nm), before = levelOf(kid), wk = weekOf(day), locks = [];
    gain.ans.forEach((a) => {
        const t = kid.t[a.tk] || (kid.t[a.tk] = { l: a.l, a: 0, r: 0, tr: 0, h: "", d: 0, rd: "", w: {} });
        t.l = a.l || t.l; t.a = (+t.a || 0) + 1; t.h = (String(t.h || "") + (a.ok ? "1" : "0")).slice(-HIST);
        if (a.ok) { t.r = (+t.r || 0) + 1; if (a.team) t.tr = (+t.tr || 0) + 1; if (t.rd !== day) { t.d = (+t.d || 0) + 1; t.rd = day; } }
        const w = (t.w = t.w || {}); w[wk] = [(w[wk] ? +w[wk][0] : 0) + (a.ok ? 1 : 0), (w[wk] ? +w[wk][1] : 0) + 1];
        const keys = Object.keys(w).sort(); keys.slice(0, Math.max(0, keys.length - WEEKS)).forEach((x) => delete w[x]);
        if (!t.m && lockReady(t)) { t.m = day; locks.push(t.l); }
        if (a.std && !t.std) t.std = a.std;
    });
    kid.xp += gain.xp + XP.lock * locks.length; kid.bank += gain.bank; kid.sp += gain.sp || 0;
    kid.fx += gain.fx || 0; kid.tr += gain.tr || 0;
    if (gain.play) { kid.g += 1; kid.ld = day; }
    if (Number.isInteger(gain.av) && gain.av >= 0) kid.av = gain.av;   // the look they picked comes back next game
    if (Number.isInteger(gain.vs) && gain.vs >= 0) kid.vs = gain.vs;
    if (typeof gain.lk === "string" && gain.lk.length <= 40 && /^([a-z][0-9a-z])*$/.test(gain.lk)) kid.lk = gain.lk;   // their character's outfit (js/buddy.js)
    kid.best.c = Math.max(+kid.best.c || 0, +gain.best.c || 0); kid.best.acc = Math.max(+kid.best.acc || 0, +gain.best.acc || 0); kid.best.st = Math.max(+kid.best.st || 0, +gain.best.st || 0);
    const lv = levelOf(kid), has = new Set(kid.b), earned = [];
    const give = (k, ok) => { if (ok && !has.has(k)) { has.add(k); earned.push(k); } };
    give("lock1", lv >= 1);
    give("eq", Object.values(kid.t).some((t) => cracked(t) && isEquationTopic(t)));
    give("comeback", kid.fx >= 10);
    give("steady", gain.n >= 10 && gain.r / gain.n >= 0.9);
    give("team", kid.tr >= 15);
    give("lock5", lv >= 5);
    kid.b = BADGES.map((b) => b[0]).filter((k) => has.has(k));
    return { kid, locks, badges: earned, levelUp: lv - before };
}

/** What a student sees about themselves (their own device and the end-of-game card). Never anyone else's. */
export function summary(kidIn) {
    const kid = cleanKid(kidIn), lv = levelOf(kid), nx = nextLock(kid);
    return { nm: kid.nm, lv, xp: kid.xp, coins: Math.max(0, kid.bank - kid.sp), bank: kid.bank, g: kid.g,
        next: nx ? { l: nx.l, pct: nx.pct, left: nx.left, r: nx.r, rNeed: nx.rNeed, d: nx.d, dNeed: nx.dNeed } : null,
        b: kid.b.slice(), best: Object.assign({}, kid.best), av: avatarsOpen(kid.xp), sk: skinsByLevel(lv),
        locks: Object.values(kid.t).filter(cracked).map((t) => t.l).slice(-12),
        lav: Number.isInteger(kid.av) ? kid.av : -1, lvs: Number.isInteger(kid.vs) ? kid.vs : 0, lk: typeof kid.lk === "string" ? kid.lk : "" };
}

/** Teacher view: every topic for one student, worst recent accuracy first, with the week-by-week trend. */
export function topicRows(kidIn) {
    const kid = cleanKid(kidIn);
    return Object.entries(kid.t).map(([k, t]) => {
        const h = String(t.h || ""), weeks = Object.keys(t.w || {}).sort().map((w) => ({ w, r: +t.w[w][0] || 0, a: +t.w[w][1] || 0 }));
        return { k, l: t.l, a: +t.a || 0, r: +t.r || 0, tr: +t.tr || 0, pct: t.a ? Math.round(100 * t.r / t.a) : 0,
            recent: h.length ? Math.round(100 * ones(h) / h.length) : 0, h, d: +t.d || 0, m: t.m || "", weeks, prog: lockProgress(t).pct };
    }).sort((a, b) => (a.m ? 1 : 0) - (b.m ? 1 : 0) || a.recent - b.recent || b.a - a.a);
}
