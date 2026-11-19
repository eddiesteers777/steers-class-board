/* ==========================================
   Anchor Board — public home page scroll story (pure logic, no DOM)

   Everything the page does as you scroll is worked out here from the
   scroll position and where a few sections sit (all in page pixels).
   site/story.js reads the page once, then calls these on each frame.
   The technique is the same one the coach's own site uses: a tall
   section with a sticky inner panel, progress 0..1 through it, and
   only opacity and transform changing per frame.
========================================== */

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ramp = (v, a, b) => (b > a ? clamp((v - a) / (b - a)) : v >= b ? 1 : 0);
export const ease = (t) => { const x = clamp(t); return x * x * (3 - 2 * x); };
const num = (v) => (Number.isFinite(v) ? v : 0);

/* How far through a pinned section the page is: 0 at its top, 1 when its end reaches the bottom of the window. */
export function storyProgress(top, height, viewport) {
    const travel = num(height) - num(viewport);
    if (!(travel > 0)) return 0;
    return clamp(-num(top) / travel);
}

/* The step on show (1..steps), how far through that step (local, 0..1) and how full each 01-04 bar is (0..100).
   The current bar never shows less than a sliver, so the visitor can see where they are. */
export function storyState(progress, steps = 4) {
    const p = clamp(num(progress));
    const step = Math.min(steps, Math.floor(p * steps) + 1);
    const local = clamp(p * steps - (step - 1));
    const fills = Array.from({ length: steps }, (_, i) =>
        i < step - 1 ? 100 : i === step - 1 ? Math.round(Math.max(6, Math.min(100, local * 100))) : 0);
    return { step, local, fills };
}

/* A pinned sideways track: top is the wrapper's distance below the pin line, travel how far the cards slide. */
export function sidewaysProgress(top, travel) {
    return travel > 0 ? clamp(-num(top) / travel) : 0;
}

/* The backdrop follows the school day: a sunrise behind the opening, deep navy through the class period,
   a sky-blue glow behind "Make it yours", and an amber dusk before the paper close.
   Returns opacities 0..1 for each layer. */
export function skyState({ scrollY, vh, heroH, storyTop, featTop, trackTop, closeTop }) {
    const y = num(scrollY), v = Math.max(1, num(vh)), mid = y + v * 0.5;
    const dawn = 1 - ramp(y, num(heroH) * 0.2, num(heroH) * 1.1);
    const glow = ramp(mid, num(featTop) - v * 0.3, num(featTop) + v * 0.5) * (1 - ramp(mid, num(trackTop) - v * 0.2, num(trackTop) + v * 0.6));
    const dusk = ramp(mid, num(trackTop) - v * 0.1, Math.max(num(trackTop) + 1, num(closeTop) - v * 0.2));
    const paper = ramp(mid, num(closeTop) - v * 0.05, num(closeTop) + v * 0.3);
    return { dawn, glow, dusk, paper, night: ramp(y, 0, Math.max(1, num(storyTop))) };
}

/* "The page is one class period": from the opening to the close the clock runs 7:58 to 8:52. */
export const PERIOD_START = 7 * 60 + 58, PERIOD_END = 8 * 60 + 52;
export function runProgress({ scrollY, vh, heroH, closeTop }) {
    const start = num(heroH) * 0.5;
    return clamp((num(scrollY) + Math.max(1, num(vh)) * 0.5 - start) / Math.max(1, num(closeTop) - start));
}
export function clockText(run) {
    const m = Math.round(PERIOD_START + clamp(num(run)) * (PERIOD_END - PERIOD_START));
    const h = Math.floor(m / 60), mm = m % 60;
    return `${h}:${String(mm).padStart(2, "0")}`;
}

export const CHAPTERS = ["Before the bell", "Bell rings", "Bellringer", "Guided notes", "Vault Raid", "Exit check", "Make it yours", "Behind the board", "Dismissal"];
/* Which chapter label to show. step is the story's step, 1..4. */
export function chapterIndex({ scrollY, vh, heroH, storyTop, storyBottom, featBottom, closeTop, step }) {
    const y = num(scrollY), v = Math.max(1, num(vh)), mid = y + v * 0.5;
    if (y < num(heroH) * 0.5) return 0;
    if (mid < num(storyTop)) return 1;
    if (mid < num(storyBottom)) return 1 + Math.min(4, Math.max(1, Math.round(num(step)) || 1));
    if (mid < num(featBottom)) return 6;
    if (mid < num(closeTop) - v * 0.2) return 7;
    return 8;
}

/* "Make it yours": n pictures, each wiped in over its share of the pinned section.
   Returns which picture is on top (index) and how far its wipe is (0..1); picture 0 is always fully in. */
export function wipeAt(progress, n) {
    const k = Math.max(1, Math.round(num(n)));
    if (k === 1) return { index: 0, t: 1 };
    const f = clamp(num(progress)) * (k - 1);
    const index = Math.min(k - 1, Math.floor(f) + 1);
    // Each wipe runs over the first 70% of its slice, then the picture holds still to be read.
    const t = clamp((f - (index - 1)) / 0.7);
    return f >= k - 1 ? { index: k - 1, t: 1 } : { index, t };
}

/* Scene numbers for each story step, from local progress 0..1 (all made up, sample class). */
export function bellTimer(local) { const s = Math.round(300 - clamp(num(local)) * 255); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
export function checkinCount(local, of = 24) { return Math.round(ramp(num(local), 0.25, 0.8) * of); }
export function vaultPhase(local) { const l = clamp(num(local)); return l < 0.34 ? 1 : l < 0.67 ? 2 : 3; }
