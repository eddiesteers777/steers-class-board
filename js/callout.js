/* ==========================================
   Anchor Board — "Called on" banner on the board (Nov 21, 2026).
   The Class Tracker's Pick tab (on the teacher's phone) writes teacher/{uid}/board/callout:
     { id, n: picked name, pool: [names to flash], at: ms }
   The board drops a banner from the top, like the end-of-class alert, flips through names,
   then stops on the picked one and holds it for a few seconds. A callout older than 20 s is
   never replayed (a board opened later stays quiet). Names show only because the teacher picked
   on purpose, the same as the board's own Name picker.
   { cheer: 1 } (the phone's "Got it right!") turns the banner green with confetti and a short sound.
   A wrong answer sends nothing: the board never shows a miss.
   Nov 28 (Eddie: "update the look of it to look glassy and premium and also be a way to edit the look of it on the class
   tracker page"): the banner has looks (LOOKS: frosted glass, night glass, aurora, gold, spotlight, classic), a size and a
   place, picked on the Class Tracker's Pick tab and sent with every pick as { lk, sz, pos }; a pick without them uses the
   frosted glass default. The Tracker's preview draws the very same banner (previewCallout), so what it shows is what the
   class sees.
========================================== */
const CSS = `
.callout{position:absolute;left:50%;top:1.2em;z-index:41;transform:translate(-50%,-170%);opacity:0;pointer-events:none;min-width:9em;text-align:center;
  background:#081B45;color:#F4F7FB;border:.12em solid #F2B33D;border-radius:.6em;padding:.35em 1.1em .45em;box-shadow:0 .5em 1.6em rgba(0,0,0,.4);
  transition:transform .45s cubic-bezier(.2,.9,.3,1.2),opacity .3s}
.callout.show{transform:translate(-50%,0);opacity:1}
.callout .cok{display:block;font-size:.8em;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#F2B33D}
.callout .con{display:block;font-family:"Bricolage Grotesque","Instrument Sans",system-ui,sans-serif;font-weight:800;font-size:2.6em;line-height:1.1;white-space:nowrap;min-height:1.1em}
.callout.spin .con{opacity:.75;filter:blur(.02em)}
.callout.land{animation:coPulse 1.2s ease-in-out 2}
.callout.land .con{color:#fff}
@keyframes coPulse{50%{box-shadow:0 0 0 .4em rgba(242,179,61,.5),0 .5em 1.6em rgba(0,0,0,.4)}}
.callout.cheer{background:linear-gradient(135deg,#1F9D61,#127A48);border-color:#F2B33D}
.callout.cheer .cok{color:#FFE3A3!important}
.callout.cheer.land{animation:coCheer .5s cubic-bezier(.2,.9,.3,1.4) 1}
@keyframes coCheer{0%{transform:translate(-50%,0) scale(.85)}60%{transform:translate(-50%,0) scale(1.08)}100%{transform:translate(-50%,0) scale(1)}}
.cofx{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:40}
.cofx i{position:absolute;top:-1em;width:.55em;height:.9em;border-radius:.12em;opacity:.95;animation:coFall var(--d,2.6s) cubic-bezier(.25,.6,.4,1) var(--w,0s) forwards}
@keyframes coFall{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(var(--x,0),110vh) rotate(var(--r,540deg));opacity:.9}}
@media (prefers-reduced-motion:reduce){.callout{transition:opacity .2s}.callout.land{animation:none}.cofx{display:none}}
/* the looks (Nov 28): every look keeps the board's palette, amber for "called on", green for "got it right" */
.callout{--co-pad:.42em 1.3em .5em;padding:var(--co-pad);border-radius:.8em}
.callout .cok{font-size:.72em;letter-spacing:.16em}
.callout.lk-glass{background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(236,243,252,.74));color:#0E1B3A;border:.08em solid rgba(255,255,255,.95);
  -webkit-backdrop-filter:blur(.6em) saturate(160%);backdrop-filter:blur(.6em) saturate(160%);box-shadow:inset 0 .06em 0 #fff,0 0 0 .06em rgba(242,179,61,.75),0 .7em 2em rgba(2,8,26,.45)}
.callout.lk-glass .cok{color:#A86F0C}
.callout.lk-glass .con,.callout.lk-glass.land .con{color:#0B2559}
.callout.lk-night{background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.04)),rgba(12,28,66,.62);color:#F4F8FF;border:.06em solid rgba(255,255,255,.28);
  -webkit-backdrop-filter:blur(.7em) saturate(170%);backdrop-filter:blur(.7em) saturate(170%);box-shadow:inset 0 .06em 0 rgba(255,255,255,.4),0 0 1.2em rgba(127,174,221,.35),0 .7em 2em rgba(2,8,26,.5)}
.callout.lk-night .cok{color:#FFD271}
.callout.lk-aurora{background:radial-gradient(70% 120% at 15% 0%,rgba(127,174,221,.75),transparent 70%),radial-gradient(60% 120% at 100% 100%,rgba(242,179,61,.45),transparent 70%),rgba(16,40,96,.66);
  color:#fff;border:.06em solid rgba(255,255,255,.35);-webkit-backdrop-filter:blur(.7em) saturate(180%);backdrop-filter:blur(.7em) saturate(180%);box-shadow:inset 0 .06em 0 rgba(255,255,255,.5),0 .7em 2em rgba(2,8,26,.45)}
.callout.lk-aurora .cok{color:#FFE3A6}
.callout.lk-gold{background:linear-gradient(160deg,#0F2A63,#081B45);color:#FFF3D6;border:0;
  box-shadow:0 0 0 .1em #F2B33D,0 0 0 .2em rgba(242,179,61,.25),0 .7em 2em rgba(2,8,26,.5)}
.callout.lk-gold .cok{color:#F2B33D}
.callout.lk-gold .con,.callout.lk-gold.land .con{background:linear-gradient(180deg,#FFE7A8,#F2B33D 60%,#C98F1F);-webkit-background-clip:text;background-clip:text;color:transparent}
.callout.lk-spot{background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04)),rgba(8,18,46,.55);color:#fff;border:.06em solid rgba(255,255,255,.3);
  -webkit-backdrop-filter:blur(.6em) saturate(170%);backdrop-filter:blur(.6em) saturate(170%);box-shadow:inset 0 .06em 0 rgba(255,255,255,.45),0 0 2.4em rgba(242,179,61,.35),0 1em 3em rgba(0,0,0,.5)}
.callout.lk-spot .cok{color:#FFD271}
/* while names flip: a light sweep across the glass */
.callout.spin::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);background-size:220% 100%;animation:coSweep .9s linear infinite}
@keyframes coSweep{from{background-position:120% 0}to{background-position:-120% 0}}
/* size and place */
.callout.sz-big .con{font-size:3.6em}
.callout.sz-big .cok{font-size:.9em}
.callout.at-mid{top:50%;transform:translate(-50%,-50%) scale(.6)}
.callout.at-mid.show{transform:translate(-50%,-50%) scale(1)}
.callout.at-mid.cheer.land{animation:coCheerMid .5s cubic-bezier(.2,.9,.3,1.4) 1}
@keyframes coCheerMid{0%{transform:translate(-50%,-50%) scale(.85)}60%{transform:translate(-50%,-50%) scale(1.08)}100%{transform:translate(-50%,-50%) scale(1)}}
/* Spotlight: the board dims behind the name */
.codim{position:absolute;inset:0;z-index:40;background:radial-gradient(60% 60% at 50% 50%,rgba(4,10,28,.35),rgba(4,10,28,.78));opacity:0;transition:opacity .4s;pointer-events:none}
.codim.show{opacity:1}
.callout.cheer{background:linear-gradient(135deg,#1F9D61,#127A48)!important;color:#fff!important;-webkit-backdrop-filter:none;backdrop-filter:none}
.callout.cheer .con{color:#fff!important;background:none!important;-webkit-background-clip:border-box!important;background-clip:border-box!important}
@media (prefers-reduced-motion:reduce){.callout.spin::after{animation:none}.codim{transition:none}}
/* celebrations for "Got it right!" (Nov 28): each a few dozen pieces on the board, then gone; none under reduced motion */
.cofx.co-fw i{top:auto;left:auto;width:.42em;height:.42em;border-radius:50%;animation:coBurst var(--d,1.3s) cubic-bezier(.15,.7,.3,1) var(--w,0s) forwards;opacity:0;box-shadow:0 0 .5em currentColor}
@keyframes coBurst{0%{transform:translate(0,0) scale(.4);opacity:1}70%{opacity:1}100%{transform:translate(var(--x),var(--y)) scale(.9);opacity:0}}
.cofx.co-st i{top:auto;left:auto;width:auto;height:auto;background:none!important;font-size:var(--s,1.8em);line-height:1;color:var(--c);text-shadow:0 0 .4em var(--c);animation:coStar var(--d,1.6s) cubic-bezier(.2,.8,.3,1) var(--w,0s) forwards;opacity:0}
@keyframes coStar{0%{transform:translate(0,0) rotate(0) scale(.2);opacity:1}80%{opacity:1}100%{transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(1);opacity:0}}
.cofx.co-bl i{top:auto;bottom:-3.5em;width:2.4em;height:3em;border-radius:50% 50% 48% 48%/55% 55% 45% 45%;opacity:.95;
  background:radial-gradient(35% 30% at 35% 30%,rgba(255,255,255,.75),transparent 60%),var(--c)!important;animation:coRise var(--d,4s) cubic-bezier(.3,.1,.5,1) var(--w,0s) forwards}
.cofx.co-bl i::after{content:"";position:absolute;left:50%;top:100%;width:.06em;height:2.2em;background:rgba(255,255,255,.7)}
@keyframes coRise{0%{transform:translate(0,0) rotate(-4deg)}50%{transform:translate(var(--x),-60vh) rotate(5deg)}100%{transform:translate(calc(var(--x) * -.5),-125vh) rotate(-3deg)}}
.cofx.co-sp i{width:.9em;height:.9em;border-radius:0;background:none!important;animation:coTwinkle var(--d,3s) ease-in var(--w,0s) forwards;opacity:0}
.cofx.co-sp i::before{content:"";position:absolute;inset:0;background:var(--c);clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);filter:drop-shadow(0 0 .25em var(--c))}
@keyframes coTwinkle{0%{transform:translateY(0) scale(.3);opacity:0}15%{opacity:1}50%{transform:translateY(45vh) scale(1);opacity:1}100%{transform:translateY(95vh) scale(.5);opacity:0}}
.cofx.co-gl{background:radial-gradient(60% 55% at 50% 18%,rgba(255,210,113,.55),rgba(242,179,61,.18) 45%,transparent 75%);animation:coGlow 2.6s ease-out forwards;opacity:0}
@keyframes coGlow{0%{opacity:0}18%{opacity:1}100%{opacity:0}}
.cofx.co-gl.co-mid{background:radial-gradient(55% 55% at 50% 50%,rgba(255,210,113,.55),rgba(242,179,61,.18) 45%,transparent 75%)}
@media (prefers-reduced-motion:reduce){.cofx.co-gl{display:block;animation:none;opacity:.6}}`;

const FRESH = 20000, SPIN = 2200, HOLD = 9000;
/** The banner's looks: [id, name, one line]. "glass" is the default. */
export const LOOKS = [
    ["glass", "Frosted glass", "Light frosted glass with a gold edge"],
    ["night", "Night glass", "Dark glass, like Spotlight's buttons"],
    ["aurora", "Aurora", "Clear glass over a sky and gold glow"],
    ["gold", "Gold", "Navy with a gold frame and gold name"],
    ["spot", "Spotlight", "Big in the middle, the board dims"],
    ["classic", "Classic", "The original navy banner"],
];
/** A look choice, cleaned: { lk, sz: "reg"|"big", pos: "top"|"mid" }. Spotlight is always big and in the middle. */
/** "Got it right!" celebrations (Nov 28, Eddie: "different celebrations ... and a way to edit which type"): [id, name, one line]. */
export const CELEBRATIONS = [
    ["confetti", "Confetti", "Colored paper falls across the board"],
    ["fireworks", "Fireworks", "Bursts of light across the top"],
    ["stars", "Star burst", "Stars fly out from the name"],
    ["balloons", "Balloons", "Balloons float up from the bottom"],
    ["sparkles", "Sparkle rain", "Gold and white sparkles drift down"],
    ["glow", "Golden glow", "A calm warm glow, nothing flying"],
    ["mix", "Mix it up", "A different one each time"],
];
const CE_IDS = CELEBRATIONS.map((c) => c[0]);
/** A look choice, cleaned: { lk, sz: "reg"|"big", pos: "top"|"mid", ce }. Spotlight is always big and in the middle. */
export function cleanLook(o) {
    const x = o && typeof o === "object" ? o : {};
    const lk = LOOKS.some((l) => l[0] === x.lk) ? x.lk : "glass", ce = CE_IDS.includes(x.ce) ? x.ce : "confetti";
    if (lk === "spot") return { lk, sz: "big", pos: "mid", ce };
    return { lk, sz: x.sz === "big" ? "big" : "reg", pos: x.pos === "mid" ? "mid" : "top", ce };
}
const PAL = ["#F2B33D", "#7FAEDD", "#3FB37F", "#E5484D", "#F4F7FB", "#C9A3F5"];
/** Throw a celebration onto a stage. kind: a CELEBRATIONS id ("mix" picks one); mid: the banner sits in the middle. Returns the layer. */
/** The celebration to play: "mix" picks one of the others at random. */
export function resolveCe(kind) { return kind === "mix" ? CE_IDS.filter((k) => k !== "mix")[Math.floor(Math.random() * (CE_IDS.length - 1))] : (CE_IDS.includes(kind) ? kind : "confetti"); }
/** Each celebration's sound (js/sound.js CUES); confetti keeps the win fanfare. */
export const ceSound = (kind) => (kind === "confetti" ? "win" : "ce_" + kind);
export function celebrateFx(stage, kind, mid) {
    const pick = resolveCe(kind);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches && pick !== "glow") return null;
    const fx = document.createElement("div"), R = Math.random, add = (n, f) => { for (let i = 0; i < n; i++) { const c = document.createElement("i"); f(c, i); fx.appendChild(c); } };
    const set = (c, k, v) => c.style.setProperty(k, v);
    fx.className = "cofx"; fx.dataset.kind = pick;
    if (pick === "confetti") add(90, (c, i) => {
        c.style.left = (20 + R() * 60) + "%"; c.style.background = PAL[i % PAL.length];
        set(c, "--x", ((R() - 0.5) * 60) + "em"); set(c, "--r", (R() * 900 - 450) + "deg"); set(c, "--d", (2 + R() * 1.6) + "s"); set(c, "--w", (R() * 0.5) + "s");
        if (i % 3 === 0) { c.style.borderRadius = "50%"; c.style.height = ".55em"; }
    });
    else if (pick === "fireworks") { fx.classList.add("co-fw"); const bursts = [[22, 24], [50, 14], [78, 26], [35, 42], [66, 40]];
        bursts.forEach(([bx, by], b) => add(26, (c, i) => { const a = (i / 26) * Math.PI * 2, d = 6 + R() * 5; c.style.left = bx + "%"; c.style.top = by + "%"; c.style.color = c.style.background = PAL[(b + i) % 4];
            set(c, "--x", (Math.cos(a) * d) + "em"); set(c, "--y", (Math.sin(a) * d) + "em"); set(c, "--w", (b * 0.32 + R() * 0.08) + "s"); set(c, "--d", (1.1 + R() * 0.5) + "s"); })); }
    else if (pick === "stars") { fx.classList.add("co-st"); add(26, (c, i) => { const a = (i / 26) * Math.PI * 2 + R() * 0.3, d = 10 + R() * 14; c.textContent = "★";
        c.style.left = "50%"; c.style.top = mid ? "50%" : "14%"; set(c, "--c", ["#F2B33D", "#FFD271", "#F4F7FB", "#7FAEDD"][i % 4]); set(c, "--s", (1.2 + R() * 1.6) + "em");
        set(c, "--x", (Math.cos(a) * d) + "em"); set(c, "--y", (Math.sin(a) * d * 0.7) + "em"); set(c, "--r", (R() * 360 - 180) + "deg"); set(c, "--w", (R() * 0.25) + "s"); set(c, "--d", (1.3 + R() * 0.7) + "s"); }); }
    else if (pick === "balloons") { fx.classList.add("co-bl"); add(16, (c, i) => { c.style.left = (4 + (i / 16) * 88 + R() * 4) + "%"; set(c, "--c", PAL[i % 5]); set(c, "--x", ((R() - 0.5) * 8) + "em"); set(c, "--w", (R() * 0.9) + "s"); set(c, "--d", (3.4 + R() * 1.4) + "s"); }); }
    else if (pick === "sparkles") { fx.classList.add("co-sp"); add(70, (c, i) => { c.style.left = (R() * 98) + "%"; c.style.top = (-5 + R() * 20) + "%"; set(c, "--c", i % 3 ? "#FFD271" : "#F4F7FB"); const s = 0.5 + R() * 0.9; c.style.width = c.style.height = s + "em"; set(c, "--w", (R() * 1.2) + "s"); set(c, "--d", (2.2 + R() * 1.4) + "s"); }); }
    else { fx.classList.add("co-gl"); if (mid) fx.classList.add("co-mid"); }
    stage.appendChild(fx);
    return fx;
}
/** The banner's CSS, once per page (the board, or the Tracker for its preview). */
export function calloutCss() { if (!document.getElementById("calloutCss")) { const s = document.createElement("style"); s.id = "calloutCss"; s.textContent = CSS; document.head.appendChild(s); } }
function lookClasses(b, look) {
    const L = cleanLook(look);
    b.className = "callout lk-" + L.lk + (L.sz === "big" ? " sz-big" : "") + (L.pos === "mid" ? " at-mid" : "");
    return L;
}
/** The banner inside a stage: a fresh one each time, so a look change takes effect at once. */
function bannerIn(stage) {
    let b = stage.querySelector(".callout");
    if (!b) { b = document.createElement("div"); b.className = "callout"; b.setAttribute("role", "status"); b.innerHTML = '<span class="cok">Called on</span><span class="con"></span>'; stage.appendChild(b); }
    return b;
}
function dimIn(stage, on) {
    let d = stage.querySelector(".codim");
    if (!d && on) { d = document.createElement("div"); d.className = "codim"; stage.insertBefore(d, stage.querySelector(".callout")); }
    if (d) d.classList.toggle("show", !!on);
}
/** Draw a pick in a stage: names flip, slow down and stop on the picked one, which holds. Returns the timers. */
function runPick(stage, d, cue, hold) {
    const timers = [], b = bannerIn(stage), L = lookClasses(b, d);
    const name = String(d.n).slice(0, 60), pool = (Array.isArray(d.pool) ? d.pool : []).map((x) => String(x).slice(0, 60)).filter(Boolean);
    const nm = b.querySelector(".con"), reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    b.querySelector(".cok").textContent = "Called on"; void b.offsetWidth; b.classList.add("show"); dimIn(stage, L.lk === "spot");
    const off = () => { b.classList.remove("show", "land", "spin"); dimIn(stage, false); };
    const land = () => { b.classList.remove("spin"); nm.textContent = name; void b.offsetWidth; b.classList.add("land"); cue("tock"); timers.push(setTimeout(off, hold)); };
    if (reduced || pool.length < 2) { land(); return timers; }
    b.classList.add("spin"); let t = 0, i = Math.floor(Math.random() * pool.length), step = 60;
    while (t + step < SPIN) {
        t += step; step = Math.min(320, Math.round(step * 1.13));
        const k = i++ % pool.length, at = t;
        timers.push(setTimeout(() => { nm.textContent = pool[k] === name && at < SPIN - 400 ? pool[(k + 1) % pool.length] : pool[k]; cue("tick"); }, at));
    }
    timers.push(setTimeout(land, SPIN));
    return timers;
}
/** The Class Tracker's preview: the same banner and animation in a small stage on the page (nothing goes to the board). */
let previewTimers = [];
/** The Tracker's preview of "Got it right!": the green banner and the chosen celebration in the small stage. */
export function previewCheer(stage, look, name, sound) {
    calloutCss(); previewTimers.forEach(clearTimeout); previewTimers = [];
    stage.querySelectorAll(".cofx").forEach((x) => x.remove());
    const b = bannerIn(stage), L = lookClasses(b, look);
    dimIn(stage, false);
    b.querySelector(".cok").textContent = "Got it right!"; b.querySelector(".con").textContent = String(name || "Sample name").slice(0, 60);
    b.classList.add("cheer", "show"); void b.offsetWidth; b.classList.add("land");
    const kind = resolveCe(L.ce), fx = celebrateFx(stage, kind, L.pos === "mid");
    if (sound) sound(ceSound(kind));
    previewTimers.push(setTimeout(() => { if (fx) fx.remove(); b.classList.remove("show", "land", "cheer"); }, 4500));
}
export function previewCallout(stage, look, names) {
    calloutCss(); previewTimers.forEach(clearTimeout); stage.querySelectorAll(".cofx").forEach((x) => x.remove());
    const list = (names && names.length ? names : ["Sample name"]).slice(0, 12), pick = list[Math.floor(Math.random() * list.length)];
    previewTimers = runPick(stage, Object.assign({ n: pick, pool: list }, cleanLook(look)), () => {}, 3500);
}

/** mountCallout({ store, cue }) on the board and the Remote's board picture. cue(name) plays a sound if this device is the speaker. */
export function mountCallout({ store, cue = () => {}, now = () => Date.now() }) {
    calloutCss();
    let lastId = "", timers = [];
    const stageEl = () => document.getElementById("stage");
    /** A right answer: the banner turns green with the name, confetti falls, a short happy sound (in the picked look's size and place). */
    function celebrate(d) {
        const stage = stageEl(); if (!stage) return;
        timers.forEach(clearTimeout); timers = [];
        const b = bannerIn(stage), name = String(d.n).slice(0, 60);
        lookClasses(b, d); dimIn(stage, false);
        b.querySelector(".cok").textContent = "Got it right!"; b.querySelector(".con").textContent = name;
        b.classList.add("cheer", "show"); void b.offsetWidth; b.classList.add("land");
        const L = cleanLook(d), kind = resolveCe(L.ce), fx = celebrateFx(stage, kind, L.pos === "mid");
        cue(ceSound(kind));
        if (fx) timers.push(setTimeout(() => fx.remove(), 5600));
        timers.push(setTimeout(() => b.classList.remove("show", "land", "cheer"), 5500));
    }
    function play(d) {
        const stage = stageEl(); if (!stage) return;
        timers.forEach(clearTimeout); timers = runPick(stage, d, cue, HOLD);
    }
    // The first copy this screen hears is the last pick from before it opened: play it only if it is
    // seconds old (a board reloaded mid-pick). After that, every new pick plays, whatever the clocks say.
    let first = true;
    store.watch("board/callout", (snap) => {
        if (snap.pending && !snap.exists) return;
        const d = snap.exists && snap.data, was = first; first = false;
        if (!d || !d.id || d.id === lastId || typeof d.n !== "string") return;
        lastId = d.id;
        if (was && Math.abs(now() - (+d.at || 0)) > FRESH) return;
        if (d.cheer) celebrate(d); else play(d);
    }, () => {});
}
