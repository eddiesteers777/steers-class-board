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
@media (prefers-reduced-motion:reduce){.callout{transition:opacity .2s}.callout.land{animation:none}.cofx{display:none}}`;

const FRESH = 20000, SPIN = 2200, HOLD = 9000;

/** mountCallout({ store, cue }) on the board and the Remote's board picture. cue(name) plays a sound if this device is the speaker. */
export function mountCallout({ store, cue = () => {}, now = () => Date.now() }) {
    if (!document.getElementById("calloutCss")) { const s = document.createElement("style"); s.id = "calloutCss"; s.textContent = CSS; document.head.appendChild(s); }
    let lastId = "", timers = [];
    const box = () => {
        const stage = document.getElementById("stage"); if (!stage) return null;
        let b = document.getElementById("calloutBanner");
        if (!b || b.parentNode !== stage) { b = document.createElement("div"); b.id = "calloutBanner"; b.className = "callout"; b.setAttribute("role", "status"); b.innerHTML = '<span class="cok">Called on</span><span class="con"></span>'; stage.appendChild(b); }
        return b;
    };
    /** A right answer: the banner turns green with the name, confetti falls, a short happy sound. */
    function celebrate(d) {
        const b = box(); if (!b) return;
        timers.forEach(clearTimeout); timers = [];
        const name = String(d.n).slice(0, 60), stage = document.getElementById("stage");
        b.querySelector(".cok").textContent = "Got it right!"; b.querySelector(".con").textContent = name;
        b.classList.remove("land", "spin"); b.classList.add("cheer", "show"); void b.offsetWidth; b.classList.add("land");
        cue("win");
        if (stage && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
        const b = box(); if (!b) return;
        timers.forEach(clearTimeout); timers = [];
        const name = String(d.n).slice(0, 60), pool = (Array.isArray(d.pool) ? d.pool : []).map((x) => String(x).slice(0, 60)).filter(Boolean);
        const nm = b.querySelector(".con"), reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        b.classList.remove("land", "show", "cheer"); b.querySelector(".cok").textContent = "Called on"; void b.offsetWidth; b.classList.add("show");
        const land = () => { b.classList.remove("spin"); nm.textContent = name; void b.offsetWidth; b.classList.add("land"); cue("tock"); timers.push(setTimeout(() => b.classList.remove("show", "land"), HOLD)); };
        if (reduced || pool.length < 2) return land();
        // flip through names, slowing down, then stop on the picked one
        b.classList.add("spin"); let t = 0, i = Math.floor(Math.random() * pool.length), step = 60;
        while (t + step < SPIN) {
            t += step; step = Math.min(320, Math.round(step * 1.13));
            const k = i++ % pool.length, at = t;
            timers.push(setTimeout(() => { nm.textContent = pool[k] === name && at < SPIN - 400 ? pool[(k + 1) % pool.length] : pool[k]; cue("tick"); }, at));
        }
        timers.push(setTimeout(land, SPIN));
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
