/* ==========================================
   Anchor Board — home page scroll story (browser side)

   Adds a fixed backdrop behind the page and drives four pinned parts
   from the scroll (all the numbers come from site/storyModel.js):
   1. The opening: the hero pins while the projector warms up.
   2. "One class period": the board fills in, step by step.
   3. "Make the board yours": new looks wipe in from the board's logo.
   4. "Behind the board": the cards slide sideways.
   Skipped for reduced motion, reduced data and old browsers: the page
   stays a plain stacked page. Positions are read once in measure(),
   so the scroll loop never touches layout. Only opacity, transform
   and one clip-path change per frame.
========================================== */

import { clamp, ramp, ease, storyProgress, storyState, sidewaysProgress, skyState, runProgress, clockText, CHAPTERS, chapterIndex, wipeAt, bellTimer, checkinCount, vaultPhase } from "./storyModel.js?v=1";

const mq = (q) => window.matchMedia(q).matches;
const ok = !mq("(prefers-reduced-motion: reduce)") && navigator.connection?.saveData !== true && "IntersectionObserver" in window && CSS.supports("position", "sticky");

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const hero = $(".ab-hero"), story = $("#how"), feat = $("#tour"), track = $(".ab-track"), close = $(".ab-trust");

if (ok && hero && story && feat && track && close) {
    // The sticky parts sit under the site header, which site.js draws after this file loads.
    let barH = 64;
    const measureBar = () => { const h = $("#siteHeader")?.offsetHeight || 0; if (h && h !== barH) { barH = h; root.style.setProperty("--ab-bar", h + "px"); } };
    measureBar();

    // ---- the backdrop: the school day, from sunrise to dusk ----
    const sky = document.createElement("div");
    sky.className = "ab-sky"; sky.setAttribute("aria-hidden", "true");
    sky.innerHTML = '<i class="ab-sky-dawn"></i><i class="ab-sky-glow"></i><i class="ab-sky-dusk"></i>'
        + '<svg class="ab-rings" viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" stroke-width="1"/><circle cx="100" cy="100" r="78" stroke-width="6"/><circle cx="100" cy="100" r="58" stroke-width="1"/>'
        + '<circle class="ab-rings-arc" cx="100" cy="100" r="78" stroke-width="2.2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>'
        + '<i class="ab-glow ab-glow-amber"></i><i class="ab-glow ab-glow-sky"></i><i class="ab-glow ab-glow-light"></i><i class="ab-sky-paper"></i>';
    document.body.prepend(sky);
    const [dawnL, glowL, duskL] = $$(":scope > i", sky);
    const paperL = $(".ab-sky-paper", sky), rings = $(".ab-rings", sky), arc = $(".ab-rings-arc", sky), glows = $$(".ab-glow", sky);
    root.classList.add("ab-live", "ab-sky-on");

    // ---- 1. the opening ----
    const open = document.createElement("div");
    open.className = "ab-open"; hero.before(open); open.append(hero);
    root.classList.add("ab-open-live");
    const copy = $(".ab-hero-copy", hero), proj = $(".ab-proj", hero), screen = $(".ab-screen", hero);
    const dim = $(".ab-dim", hero), flare = $(".ab-flare", hero), beam = $(".ab-beam", hero), cue = $(".ab-cue", hero);
    const head = $("#abHead");
    if (head) {   // a letter at a time; screen readers get the plain sentence
        const label = head.textContent.replace(/\s+/g, " ").trim();
        let i = 0;
        const walk = (node) => [...node.childNodes].forEach((n) => {
            if (n.nodeType === 3) {
                const f = document.createDocumentFragment();
                n.textContent.split(/(\s+)/).forEach((word) => {
                    if (!word) return;
                    if (/^\s+$/.test(word)) { f.append(" "); return; }
                    const w = document.createElement("span"); w.style.whiteSpace = "nowrap";
                    for (const c of word) { const sp = document.createElement("span"); sp.className = "ab-ch"; sp.setAttribute("aria-hidden", "true"); sp.style.setProperty("--i", i++); sp.textContent = c; w.append(sp); }
                    f.append(w);
                });
                n.replaceWith(f);
            } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
        });
        head.setAttribute("aria-label", label); walk(head);
    }

    // The intro sentence lights up a word at a time as it comes up the screen.
    const big = $(".ab-big"), words = [];
    if (big) {
        big.setAttribute("role", "group"); big.setAttribute("aria-label", big.textContent.replace(/\s+/g, " ").trim());
        const walk = (node) => [...node.childNodes].forEach((n) => {
            if (n.nodeType === 3) {
                const f = document.createDocumentFragment();
                n.textContent.split(/(\s+)/).forEach((t) => {
                    if (!t) return;
                    if (/^\s+$/.test(t)) { f.append(" "); return; }
                    const sp = document.createElement("span"); sp.className = "ab-w"; sp.setAttribute("aria-hidden", "true"); sp.textContent = t; f.append(sp); words.push(sp);
                });
                n.replaceWith(f);
            } else if (n.nodeType === 1) walk(n);
        });
        walk(big);
        big.removeAttribute("data-rise");
    }

    // ---- 2. one class period ----
    const stick = $(".ab-stick", story), steps = $$(".ab-step", story), bars = $$(".ab-bar > div", story);
    const numeral = document.createElement("span"); numeral.className = "ab-numeral"; numeral.setAttribute("aria-hidden", "true"); numeral.textContent = "1"; stick.prepend(numeral);
    const S = {
        timer: $("#abTimer"), tbar: $("#abTbar"), ans: $("#abAns1"), line: $("#abLine"), stops: $$(".ab-line span", story),
        nsteps: $$(".ab-nstep", story), ring: $("#abRing"), ringBox: $(".ab-ring", story), ringNum: $("#abRingNum"), ringSub: $("#abRingSub"),
        pad: $(".ab-pad", story), vaults: $$("#abVaults b", story), srows: $$(".ab-srow", story),
    };
    const STOP = [0, 0.28, 0.58, 0.88, 1];
    const memo = {};
    const set = (key, val, fn) => { if (memo[key] !== val) { memo[key] = val; fn(val); } };
    const drawScene = (step, l) => {
        set("line", (STOP[step - 1] + l * (STOP[step] - STOP[step - 1])).toFixed(3), (v) => { S.line.style.transform = `scaleX(${v})`; });
        S.stops.forEach((sp, i) => set("stop" + i, i <= step - 1, (on) => sp.classList.toggle("on", on)));
        if (step === 1) {
            set("timer", bellTimer(l), (v) => { S.timer.textContent = v; });
            set("tbar", (1 - l * 0.85).toFixed(3), (v) => { S.tbar.style.transform = `scaleX(${v})`; });
            set("ans", l > 0.72, (on) => S.ans.classList.toggle("on", on));
        } else if (step === 2) {
            S.nsteps.forEach((n, i) => set("ns" + i, l > parseFloat(n.dataset.at), (on) => n.classList.toggle("on", on)));
            const n = checkinCount(l), done = l > 0.84;
            set("ring", n, (v) => { S.ring.style.strokeDashoffset = (1 - v / 24).toFixed(3); });
            set("ringTxt", done ? "done" : n, (v) => {
                S.ringBox.classList.toggle("done", v === "done");
                S.ringNum.textContent = v === "done" ? "92%" : `${v}/24`;
                S.ringSub.textContent = v === "done" ? "22 of 24 got it · x = 20" : "Solve it on your Chromebook";
            });
        } else if (step === 3) {
            const ph = vaultPhase(l);
            set("vault", ph, (v) => { S.pad.dataset.v = String(v); });
            const coins = [35 + Math.round(l * 8), 28 + Math.round(l * 5), 21 + (ph === 3 ? 4 : 0), 12 + Math.round(l * 3)];
            S.vaults.forEach((b, i) => set("coin" + i, coins[i], (v) => { b.textContent = v; }));
        } else {
            S.srows.forEach((r, i) => set("srow" + i, ease(ramp(l, i * 0.12, 0.45 + i * 0.12)).toFixed(3), (v) => { r.style.setProperty("--grow", v); }));
        }
    };

    // ---- 3. make the board yours ----
    const shots = $$(".ab-shot", feat), fTitle = $("#abFeatTitle"), fText = $("#abFeatP"), fBox = $(".ab-ftxt", feat), segs = $$(".ab-fsegs i", feat);
    const GROUPS = [
        ["Colors and backgrounds", "Pick a color, a background and a logo for the board. Change it for a unit, a season or just a Monday."],
        ["Holiday looks", "One tap for snow, Christmas lights or a winter forest. Effects like falling snow stay behind the lesson, never on top of it."],
        ["Panels and layouts", "Timers, voice level, a traffic light and more sit on a shelf beside the lesson. Save a layout like Bell work or Work time and set up the room in one tap."],
    ];
    const groupOf = shots.map((s) => parseInt(s.dataset.g, 10) || 0);
    const groupStart = GROUPS.map((_, g) => groupOf.indexOf(g));
    let lastGroup = 0;

    // ---- 4. behind the board ----
    const cards = $(".ab-cards", track), tcards = $$(".ab-tcard", track);
    const hz = document.createElement("div"); hz.className = "ab-hzw"; track.before(hz); hz.append(track); track.classList.add("is-hz");
    let hzMax = 0, cardMid = [];

    // ---- the period clock ----
    const clock = $("#abClock"), clockT = $("#abClockT"), clockL = $("#abClockL"), clockRing = $("#abClockRing");
    if (clock) clock.hidden = false;

    const rises = $$("[data-rise]");
    let riseTops = [], bigTop = 0, bigH = 0;
    let T = {};
    const measure = () => {
        measureBar();
        const y = window.scrollY, vh = window.innerHeight, top = (el) => el.getBoundingClientRect().top + y;
        open.style.height = Math.round(hero.offsetHeight + vh * 0.9) + "px";
        // Where the board would sit if it filled the pinned screen.
        const stageH = hero.offsetHeight, projTop = proj.offsetTop, projH = proj.offsetHeight, projW = proj.offsetWidth;
        const fit = Math.min(1.16, (stageH - 56) / Math.max(1, projH), (window.innerWidth - 24) / Math.max(1, projW));
        T = {
            openTop: top(open), openH: open.offsetHeight - hero.offsetHeight, heroH: open.offsetHeight,
            projShift: (stageH - projH * fit) / 2 - projTop, fit,
            storyTop: top(story), storyBottom: top(story) + story.offsetHeight,
            featTop: top(feat), featH: feat.offsetHeight, featBottom: top(feat) + feat.offsetHeight,
            hzTop: top(hz), closeTop: top(close),
        };
        const hh = Math.max(320, vh - barH);
        hzMax = Math.max(0, cards.scrollWidth - window.innerWidth);
        hz.style.height = hh + hzMax + "px";
        cardMid = tcards.map((c) => c.offsetLeft + c.offsetWidth / 2);
        riseTops = rises.map((el) => top(el));
        if (big) { const r = big.getBoundingClientRect(); bigTop = r.top + y; bigH = r.height; }
    };

    let queued = false, lastStep = 0, lastWords = -1, lastChap = -1, lastClock = "";
    const update = () => {
        queued = false;
        const y = window.scrollY, vh = window.innerHeight, vw = window.innerWidth;

        // backdrop
        const s = skyState({ scrollY: y, vh, heroH: T.heroH + T.openTop, storyTop: T.storyTop, featTop: T.featTop, trackTop: T.hzTop, closeTop: T.closeTop });
        dawnL.style.opacity = s.dawn.toFixed(3); glowL.style.opacity = s.glow.toFixed(3); duskL.style.opacity = s.dusk.toFixed(3); paperL.style.opacity = s.paper.toFixed(3);
        const run = runProgress({ scrollY: y, vh, heroH: T.heroH + T.openTop, closeTop: T.closeTop });
        rings.style.transform = `rotate(${(y * 0.018).toFixed(2)}deg)`;
        arc.style.strokeDashoffset = (1 - run).toFixed(4);
        const p = y / Math.max(1, root.scrollHeight - vh);
        glows.forEach((g, i) => {
            const a = [s.dawn * 0.9 + s.dusk, (1 - s.dawn) * (1 - s.dusk) * 0.9 + s.glow * 0.6, 0.5 + s.glow * 0.5][i] * (1 - s.paper);
            g.style.opacity = a.toFixed(3);
            if (a > 0.005) g.style.transform = `translate3d(${(Math.sin(p * 6 + i * 2.1) * 26 + (i - 1) * 22).toFixed(1)}vw,${(((p * 70 + i * 24) % 100) - 25).toFixed(1)}vh,0)`;
        });

        // 1. the opening: the projector warms up (op 0..1), then the hero scrolls away
        const op = T.openH > 0 ? clamp((y - T.openTop + barH) / T.openH) : 1;
        if (y < T.openTop + T.heroH + vh) {
            const e = ease(ramp(op, 0, 0.62)), lift = ease(ramp(op, 0.42, 1));
            const flick = op < 0.4 ? 0.14 * Math.abs(Math.sin(op * 70)) : 0;
            dim.style.opacity = Math.min(1, 0.78 * (1 - e) + flick).toFixed(3);
            const warm = Math.sin(Math.PI * ramp(op, 0.18, 0.8));
            flare.style.opacity = (warm * 0.55).toFixed(3); beam.style.opacity = (warm * 0.9).toFixed(3);
            screen.style.transform = `rotateX(${((1 - e) * 24).toFixed(2)}deg) scale(${(0.9 + 0.1 * e).toFixed(4)})`;
            proj.style.transformOrigin = "50% 0";
            proj.style.transform = `translate3d(0,${(T.projShift * lift).toFixed(1)}px,0) scale(${(1 + (T.fit - 1) * lift).toFixed(4)})`;
            copy.style.opacity = (1 - ease(ramp(op, 0.4, 0.82))).toFixed(3);
            copy.style.transform = `translate3d(0,${(-lift * 70).toFixed(1)}px,0)`;
            copy.style.visibility = op > 0.86 ? "hidden" : "";
            if (cue) cue.style.opacity = (1 - ramp(op, 0, 0.1)).toFixed(2);
        }

        // 2. one class period
        const sp = storyProgress(T.storyTop - y - barH, T.storyBottom - T.storyTop, vh - barH);
        const st = storyState(sp, steps.length);
        bars.forEach((b, i) => {
            b.firstElementChild.style.transform = `scaleX(${(st.fills[i] / 100).toFixed(3)})`;
            const cls = i < st.step - 1 ? "is-done" : i === st.step - 1 ? "is-cur" : "";
            if (b.className !== cls) b.className = cls;
        });
        if (st.step !== lastStep) {
            lastStep = st.step; stick.dataset.s = String(st.step); numeral.textContent = st.step;
            steps.forEach((el, i) => el.classList.toggle("is-on", i === st.step - 1));
            for (const k in memo) delete memo[k];   // the new pane starts from its own first frame
        }
        if (y + vh > T.storyTop && y < T.storyBottom) drawScene(st.step, st.local);

        // 3. make the board yours
        const fp = clamp((y - T.featTop + barH) / Math.max(1, T.featH - vh + barH));
        if (y + vh > T.featTop && y < T.featBottom) {
            const w = wipeAt(fp, shots.length);
            shots.forEach((sh, j) => {
                const v = j === 0 || j < w.index ? "none" : j === w.index ? `circle(${(ease(w.t) * 150).toFixed(2)}% at 7% 11%)` : "circle(0% at 7% 11%)";
                if (sh._clip !== v) { sh._clip = v; sh.style.clipPath = v; }
            });
            const on = w.t > 0.5 ? w.index : w.index - 1, g = groupOf[Math.max(0, on)];
            const f = fp * (shots.length - 1);
            segs.forEach((sg, i) => {
                const a = Math.max(0, groupStart[i] - 1), b = (groupStart[i + 1] ?? shots.length) - 1;
                sg.style.transform = `scaleX(${clamp((f - a) / Math.max(1, b - a)).toFixed(3)})`;
            });
            if (g !== lastGroup) {
                lastGroup = g; fTitle.textContent = GROUPS[g][0]; fText.textContent = GROUPS[g][1];
                fBox.classList.remove("is-swap"); void fBox.offsetWidth; fBox.classList.add("is-swap");
            }
        }

        // 4. behind the board
        const hp = sidewaysProgress(T.hzTop - y - barH, hzMax), dx = hp * hzMax;
        if (y + vh > T.hzTop && y < T.hzTop + hzMax + vh * 2) {
            cards.style.transform = `translate3d(${(-dx).toFixed(1)}px,0,0)`;
            let best = -1, bd = Infinity;
            cardMid.forEach((m, i) => { const d = Math.abs(m - dx - vw / 2); if (d < bd) { bd = d; best = i; } });
            tcards.forEach((c, i) => { const near = i === best; if (c._near !== near) { c._near = near; c.classList.toggle("is-near", near); } });
        }

        // the intro words
        if (words.length) {
            const t = clamp((vh * 0.85 - (bigTop - y)) / (vh * 0.55 + bigH));
            if (t !== lastWords) { lastWords = t; words.forEach((w, i) => { w.style.opacity = (0.18 + 0.82 * clamp(t * (words.length + 3) - i)).toFixed(2); }); }
        }

        // later sections rise in
        rises.forEach((el, i) => {
            const t = ease((vh - (riseTops[i] - y)) / (vh * 0.5)).toFixed(2);
            if (el._t !== t) { el._t = t; el.style.setProperty("--t", t); }
        });

        // the period clock
        if (clock) {
            const ci = chapterIndex({ scrollY: y, vh, heroH: T.heroH + T.openTop, storyTop: T.storyTop, storyBottom: T.storyBottom, featBottom: T.featBottom, closeTop: T.closeTop, step: st.step });
            const txt = clockText(run);
            if (txt !== lastClock) { lastClock = txt; clockT.textContent = txt; }
            if (ci !== lastChap) { lastChap = ci; clockL.textContent = CHAPTERS[ci]; }
            clockRing.style.strokeDashoffset = (1 - run).toFixed(4);
            const off = y < T.openTop + T.openH * 0.6 || s.paper > 0.5;
            if (clock._off !== off) { clock._off = off; clock.classList.toggle("is-off", off); }
        }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    const remeasure = () => { measure(); queue(); };

    measure(); update();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", remeasure);
    addEventListener("load", remeasure);
    document.fonts?.ready.then(remeasure);
    if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(document.body);
}
