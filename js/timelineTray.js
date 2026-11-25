/* ==========================================
   Anchor Board — the Standards Timeline's tray (pure, no page code). Tested by tools/timeline/tray.test.mjs.
   The tray is what you picked from the timeline to assign: one row per standard, in your order, with the levels
   to draw from. It hands off to the Assignments builder (assign.html) as a practice draft, keeping each standard as
   its own skill (so the assignment stays grouped by standard). Problems come from Anchor's standards bank only.
   Tray shape (kept on this device, per class): { items: [{ code, lv: [1, 2], need: 4, w: 1 }] }
========================================== */
import * as C from "./assignCore.js?v=7";
import { inClass } from "./stdBank.js?v=5";
import { isFoundational, problemsFor, nameOf } from "./foundBank.js?v=2";

export const FLOOR_N = 12;   // problems drawn from a floor (foundational) skill, made from numbers in js/foundBank.js

export const NEED = 4;          // Eddie, Nov 23: assignments made from the Timeline need 4 right per skill
export const LEVEL_DEFAULT = [1, 2];
export const HANDOFF_KEY = "anchorboard-asg-handoff";

/** Bank problems for one standard in one class, at the given levels, in the Assignments shape. */
export function poolFor(bank, cls, code, lv) {
    const want = lv && lv.length ? lv : [1, 2, 3];
    if (isFoundational(code)) return problemsFor(code, FLOOR_N).filter((x) => want.includes(x.lvl)).map(C.cleanItem);
    return (bank || []).filter((x) => x.std === code && inClass(x, cls) && want.includes(x.lvl) && x.q && x.a).map(C.cleanItem);
}
/** How many bank problems a standard has at each level: { 1: n, 2: n, 3: n, all: n }. */
export function counts(bank, cls, code) {
    const out = { 1: 0, 2: 0, 3: 0, all: 0 };
    if (isFoundational(code)) { problemsFor(code, FLOOR_N).forEach((x) => { out[x.lvl]++; out.all++; }); return out; }
    (bank || []).forEach((x) => { if (x.std === code && inClass(x, cls) && x.q && x.a) { out[x.lvl] = (out[x.lvl] || 0) + 1; out.all++; } });
    return out;
}

const fresh = (t) => ({ items: Array.isArray(t && t.items) ? t.items.filter((x) => x && x.code).map((x) => ({ code: String(x.code), lv: (x.lv || LEVEL_DEFAULT).filter((n) => [1, 2, 3].includes(n)), need: Math.max(1, Math.min(10, +x.need || NEED)), w: Math.max(1, Math.min(5, +x.w || 1)) })) : [] });
export const clean = fresh;
export const has = (t, code) => fresh(t).items.some((x) => x.code === code);

/** Add a standard (or update its levels if it is already in). */
export function add(t, code, lv) {
    const o = fresh(t), lvl = (lv && lv.length ? lv : LEVEL_DEFAULT).slice().sort();
    const at = o.items.find((x) => x.code === code);
    if (at) at.lv = lvl; else o.items.push({ code, lv: lvl, need: NEED, w: 1 });
    return o;
}
export const remove = (t, code) => ({ items: fresh(t).items.filter((x) => x.code !== code) });
export function move(t, code, to) {
    const o = fresh(t), i = o.items.findIndex((x) => x.code === code); if (i < 0) return o;
    const [x] = o.items.splice(i, 1); o.items.splice(Math.max(0, Math.min(o.items.length, to)), 0, x); return o;
}
export function set(t, code, field, v) { const o = fresh(t); const x = o.items.find((y) => y.code === code); if (x) x[field] = v; return fresh(o); }

/** The Assignments skills for this tray: one per standard, its pool at its levels. Standards with no problems are left out. */
export function skills(t, bank, cls, standards) {
    const byCode = new Map((standards || []).map((s) => [s.code, s]));
    return fresh(t).items.map((x) => {
        const s = byCode.get(x.code), pool = poolFor(bank, cls, x.code, x.lv);
        if (!pool.length) return null;
        const name = isFoundational(x.code) ? "Floor: " + nameOf(x.code) : x.code + (s ? " " + s.text.split(/[,;.:]/)[0].slice(0, 70).trim() : "");
        return { src: "bank:" + x.code, name, std: x.code, pool, need: x.need, w: x.w, pin: -1 };
    }).filter(Boolean);
}
/** Minutes, the same estimate the Assignments builder shows for practice. 0 when the tray is empty. */
export function minutes(t, bank, cls, standards) {
    const sk = skills(t, bank, cls, standards);
    return sk.length ? C.estimateMins({ type: "practice", skills: sk, opts: { need: NEED } }) : 0;
}
/** What assign.html picks up: a practice draft for this class. */
export function handoff(t, bank, cls, standards, now = Date.now()) {
    const sk = skills(t, bank, cls, standards);
    return { v: 1, from: "timeline", at: now, cls, type: "practice", need: NEED, title: sk.map((x) => (isFoundational(x.std) ? nameOf(x.std) : x.std)).join(", ").slice(0, 70) + " practice", skills: sk };
}

/* ---------- Vault Raid set from the tray ---------- */
export const VAULT = { cats: 6, clues: 6, target: 24 };   // Vault Raid shows at most 6 categories of 6 questions (js/games.js LIMITS)
function seeded(seed) { let a = 0; for (const c of String(seed)) a = (Math.imul(a ^ c.charCodeAt(0), 2654435761) + 1) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (list, seed) => { const r = seeded(seed), a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** "Timeline review · 8.25, 8.26 · Nov 23" */
export function vaultTitle(t, day = new Date()) {
    const names = fresh(t).items.map((x) => (isFoundational(x.code) ? nameOf(x.code) : x.code));
    return ("Timeline review · " + names.slice(0, 4).join(", ") + (names.length > 4 ? " +" + (names.length - 4) : "") + " · " + day.toLocaleDateString("en-US", { month: "short", day: "numeric" })).slice(0, 80);
}
/**
 * A Vault Raid question set from the tray (games/s_<id> shape, without id). Each standard gets its own categories,
 * questions easiest first, at the tray's levels; Weight sets each standard's share. Only the first 6 standards fit.
 * Returns { doc, n, left: [codes that did not fit], short: [codes with fewer than 3 problems] }.
 */
export function vaultSet(t, bank, cls, o = {}) {
    const items = fresh(t).items.map((x) => ({ x, pool: poolFor(bank, cls, x.code, x.lv) })).filter((y) => y.pool.length);
    const use = items.slice(0, VAULT.cats), left = items.slice(VAULT.cats).map((y) => y.x.code);
    const per = use.length ? Math.min(4, Math.floor(VAULT.cats / use.length)) : 0, wsum = use.reduce((s, y) => s + y.x.w, 0);
    const cats = [], short = [];
    use.forEach((y) => {
        const want = Math.max(3, Math.round((VAULT.target * y.x.w) / wsum)), k = Math.min(y.pool.length, per * VAULT.clues, want);
        if (y.pool.length < 3) short.push(y.x.code);
        const pick = shuffle(y.pool, "vr|" + y.x.code + "|" + (o.seed || "")).slice(0, k).sort((a, b) => a.lvl - b.lvl);
        const name = isFoundational(y.x.code) ? "Floor: " + nameOf(y.x.code) : y.x.code;
        const chunks = Math.ceil(pick.length / VAULT.clues);
        for (let c = 0; c < chunks; c++) {
            const part = pick.slice(Math.round((c * pick.length) / chunks), Math.round(((c + 1) * pick.length) / chunks));
            cats.push({ n: (chunks > 1 ? name + " (" + (c + 1) + ")" : name).slice(0, 60), clues: part.map((p, i) => {
                const q = { p: 100 * (i + 1), q: p.q, a: p.a };
                if (p.al && p.al.length) q.al = p.al.slice(0, 8);
                if (p.ch && p.ch.length >= 2) q.ch = p.ch.slice(0, 5);
                if (p.st && p.st.length) q.st = p.st.slice(0, 4);
                return q;
            }) });
        }
    });
    const n = cats.reduce((s, c) => s + c.clues.length, 0);
    return { doc: { title: (o.title || vaultTitle(t)).slice(0, 80), maker: 1, per: (o.per || []).slice(), cats, final: null, tl: { cls, codes: use.map((y) => y.x.code) } }, n, left, short };
}
