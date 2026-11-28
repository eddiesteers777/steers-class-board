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
.callout.cheer .cok{color:#FFE3A3}
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
@media (prefers-reduced-motion:reduce){.callout.spin::after{animation:none}.codim{transition:none}}`;

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
export function cleanLook(o) {
    const x = o && typeof o === "object" ? o : {};
    const lk = LOOKS.some((l) => l[0] === x.lk) ? x.lk : "glass";
    if (lk === "spot") return { lk, sz: "big", pos: "mid" };
    return { lk, sz: x.sz === "big" ? "big" : "reg", pos: x.pos === "mid" ? "mid" : "top" };
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
export function previewCallout(stage, look, names) {
    calloutCss(); previewTimers.forEach(clearTimeout);
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
        cue("win");
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
            const fx = document.createElement("div"); fx.className = "cofx"; const C = ["#F2B33D", "#7FAEDD", "#3FB37F", "#E5484D", "#F4F7FB", "#C9A3F5"];
            for (let i = 0; i < 90; i++) {
                const c = document.createElement("i"), left = 20 + Math.random() * 60;
                c.style.left = left + "%"; c.style.background = C[i % C.length];
                c.style.setProperty("--x", ((Math.random() - 0.5) * 60) + "em"); c.style.setProperty("--r", (Math.random() * 900 - 450) + "deg");
                c.style.setProperty("--d", (2 + Math.random() * 1.6) + "s"); c.style.setProperty("--w", (Math.random() * 0.5) + "s");
                if (i % 3 === 0) { c.style.borderRadius = "50%"; c.style.height = ".55em"; }
                fx.appendChild(c);
            }
            stage.appendChild(fx); timers.push(setTimeout(() => fx.remove(), 4800));
        }
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
