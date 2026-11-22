/* ==========================================================
   anchorLoader.js -- the animated anchor (Anchor Board's loading and "it's ready" moments).

   Eddie, 2026-11-21: "rather than the raw font for signing in", a loader made from the anchor logo.
   2026-11-22: "where can we incorporate this", with creative freedom: setup's finish ("Building
   your board"), the early access sign-up, the public site and the board's first load.

   The logo's own parts move: the outer rings draw around in turn, then the inner arms, the amber
   eye pulses, and the white shank and crossbar stay put so the mark always reads as the anchor.

     showLoader(text, { title, steps })  full-screen loader; steps is a list of labels shown as a checklist
     loaderStep(i)                        step i is done (and the next one is underway)
     loaderDone(text)                     the finish: the rings lock in, the eye flashes, a check appears.
                                          Resolves when it has played (about 1.1 s).
     hideLoader()                         fades it away
     markSvg(cls)                         the moving mark on its own ("anl-loop": keeps drawing, "anl-drawin":
                                          draws itself once) for headers and empty screens
     ensureCss()                          the styles, for a page that only uses markSvg

   It brings its own styles, so any page can use it. Reduced motion: the rings stay drawn, only the eye glows.
   ========================================================== */

const CSS = `
.anl{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px 16px;
  background:linear-gradient(135deg,#173F86 0%,#0B2559 55%,#081B45 100%);color:#F4F7FB;text-align:center;
  font:600 16px/1.45 'Instrument Sans',system-ui,'Segoe UI',sans-serif;opacity:0;transition:opacity .22s ease-out}
.anl.on{opacity:1}
.anl .anl-art{position:relative;width:132px;height:132px}
.anl .anl-art svg{width:100%;height:100%;filter:drop-shadow(0 14px 32px rgba(4,12,32,.5))}
.anl h2{margin:6px 0 0;font:800 clamp(24px,6vw,32px)/1.15 'Bricolage Grotesque','Instrument Sans',sans-serif;letter-spacing:-.02em;color:#F4F7FB}
.anl p{margin:0;max-width:340px;color:#B9D3EE;min-height:1.45em}
.anl ol{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:10px;text-align:left;min-width:min(300px,100%)}
.anl li{display:flex;align-items:center;gap:12px;color:#7FAEDD;font-weight:600;transition:color .25s}
.anl li i{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid rgba(127,174,221,.5);position:relative;transition:background .25s,border-color .25s}
.anl li.now{color:#F4F7FB}
.anl li.now i{border-color:#F2B33D;border-top-color:transparent;animation:anl-spin .8s linear infinite}
.anl li.ok{color:#F4F7FB}
.anl li.ok i{background:#1F9D61;border-color:#1F9D61}
.anl li.ok i::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:10px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
.anl .anl-ring{position:absolute;inset:-6px;border-radius:38px;border:3px solid #F2B33D;opacity:0;pointer-events:none}
.anl.done .anl-ring{animation:anl-ripple .9s ease-out .25s both}
.anl.done .anl-art{animation:anl-pop .55s cubic-bezier(.3,1.6,.5,1) .2s both}
.anl.done .arc{animation:anl-settle .5s cubic-bezier(.65,0,.35,1) both}
.anl.done .a2{animation-delay:.05s}.anl.done .a3{animation-delay:.1s}.anl.done .a4{animation-delay:.15s}.anl.done .a5{animation-delay:.2s}.anl.done .a6{animation-delay:.25s}
.anl.done .eye{animation:anl-flash .7s ease-out .3s both}
.anl-loop .arc{stroke-dasharray:1 1;stroke-dashoffset:1;animation:anl-draw 2.4s cubic-bezier(.65,0,.35,1) infinite}
.anl-loop .a1{animation-delay:0s}.anl-loop .a2{animation-delay:.12s}.anl-loop .a3{animation-delay:.24s}
.anl-loop .a4{animation-delay:.42s}.anl-loop .a5{animation-delay:.54s}.anl-loop .a6{animation-delay:.66s}
.anl-loop .eye{transform-origin:256px 122px;animation:anl-eye 1.2s ease-in-out infinite}
.anl-drawin .arc{stroke-dasharray:1 1;animation:anl-settle .7s cubic-bezier(.65,0,.35,1) both}
.anl-drawin .a2{animation-delay:.08s}.anl-drawin .a3{animation-delay:.16s}.anl-drawin .a4{animation-delay:.3s}.anl-drawin .a5{animation-delay:.38s}.anl-drawin .a6{animation-delay:.46s}
.anl-drawin .shank{animation:anl-in .4s ease-out both}
.anl-drawin .eye{transform-origin:256px 122px;animation:anl-flash .6s ease-out .6s both}
.anl .arc{stroke-dasharray:1 1}
@keyframes anl-draw{0%{stroke-dashoffset:1}38%{stroke-dashoffset:0}62%{stroke-dashoffset:0}100%{stroke-dashoffset:-1}}
@keyframes anl-settle{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes anl-eye{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.75}}
@keyframes anl-flash{0%{transform:scale(1)}40%{transform:scale(1.35);stroke:#FFD27A}100%{transform:scale(1)}}
@keyframes anl-pop{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes anl-ripple{0%{opacity:.9;transform:scale(.92)}100%{opacity:0;transform:scale(1.22)}}
@keyframes anl-spin{to{transform:rotate(360deg)}}
@keyframes anl-in{from{opacity:0}}
@media (prefers-reduced-motion:reduce){
  .anl-loop .arc,.anl-drawin .arc,.anl.done .arc{animation:none;stroke-dashoffset:0}
  .anl-loop .eye{animation:anl-glow 1.6s ease-in-out infinite;transform:none}
  .anl-drawin .eye,.anl-drawin .shank,.anl.done .eye,.anl.done .anl-art,.anl.done .anl-ring,.anl li.now i{animation:none}
  @keyframes anl-glow{50%{opacity:.55}}
}`;

let n = 0;
/** The logo's own shapes (brand/logo.svg). pathLength="1" lets every arc draw over the same time. */
export function markSvg(cls = "anl-loop") {
    const id = "anlg" + (++n);
    return `<svg class="${cls}" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173F86"/><stop offset=".55" stop-color="#0B2559"/><stop offset="1" stop-color="#081B45"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="url(#${id})"/>
<g fill="none" stroke-linecap="round">
<path d="M101.9 317.8 A170 170 0 0 1 101.9 174.2" stroke="#2F5DAE" stroke-width="30" pathLength="1" class="arc a1"/>
<path d="M400.2 336.1 A170 170 0 0 1 111.8 336.1" stroke="#7FAEDD" stroke-width="30" pathLength="1" class="arc a2"/>
<path d="M410.1 174.2 A170 170 0 0 1 410.1 317.8" stroke="#2F5DAE" stroke-width="30" pathLength="1" class="arc a3"/>
<path d="M153.7 291.6 A112 112 0 0 1 159.0 190.0" stroke="#B9D3EE" stroke-width="28" pathLength="1" class="arc a4"/>
<path d="M352.0 303.7 A112 112 0 0 1 160.0 303.7" stroke="#F6F9FD" stroke-width="28" pathLength="1" class="arc a5"/>
<path d="M353.0 190.0 A112 112 0 0 1 358.3 291.6" stroke="#B9D3EE" stroke-width="28" pathLength="1" class="arc a6"/>
<g class="shank" stroke="#F6F9FD"><path d="M256 160 L256 344" stroke-width="28"/><path d="M204 200 L308 200" stroke-width="24"/></g>
<circle class="eye" cx="256" cy="122" r="30" stroke="#F2B33D" stroke-width="22"/>
</g></svg>`;
}

export function ensureCss() {
    if (typeof document === "undefined" || document.getElementById("anlCss")) return;
    const s = document.createElement("style"); s.id = "anlCss"; s.textContent = CSS; document.head.appendChild(s);
}

let box = null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

export function showLoader(text, opts = {}) {
    if (typeof document === "undefined") return;
    ensureCss();
    if (!box) {
        box = document.createElement("div"); box.className = "anl"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
        box.innerHTML = `<div class="anl-art">${markSvg("anl-loop")}<span class="anl-ring"></span></div><h2 hidden></h2><p></p><ol hidden></ol>`;
        document.body.appendChild(box);
        requestAnimationFrame(() => { if (box) box.classList.add("on"); });
    }
    box.classList.remove("done");
    const h = box.querySelector("h2"); h.hidden = !opts.title; h.textContent = opts.title || "";
    box.querySelector("p").textContent = text || "";
    const ol = box.querySelector("ol");
    if (Array.isArray(opts.steps)) {
        ol.hidden = false; ol.textContent = "";
        opts.steps.forEach((label, i) => { const li = document.createElement("li"); if (!i) li.className = "now"; li.innerHTML = "<i></i>"; li.appendChild(document.createTextNode(label)); ol.appendChild(li); });
    }
}

/** Step i is done; the next one is now underway. */
export function loaderStep(i) {
    if (!box) return;
    const items = [...box.querySelectorAll("ol li")];
    items.forEach((li, k) => { li.className = k <= i ? "ok" : k === i + 1 ? "now" : ""; });
}

/** The finish: every step ticks, the rings lock in, the eye flashes. Resolves once it has played. */
export async function loaderDone(text, title) {
    if (!box) return;
    box.querySelectorAll("ol li").forEach((li) => { li.className = "ok"; });
    if (title != null) { const h = box.querySelector("h2"); h.hidden = !title; h.textContent = title; }
    if (text != null) box.querySelector("p").textContent = text;
    const svg = box.querySelector("svg"); svg.classList.remove("anl-loop");
    void svg.getBoundingClientRect();
    box.classList.add("done");
    await wait(calm() ? 500 : 1150);
}

export function hideLoader() {
    if (!box) return;
    const b = box; box = null; b.classList.remove("on");
    setTimeout(() => b.remove(), 240);
}

/** Show a loader for at least ms while work runs, so a fast step still reads as a step. */
export async function atLeast(ms, work) {
    const [r] = await Promise.all([work, wait(calm() ? 0 : ms)]);
    return r;
}

// A page kept in the back/forward cache comes back without the loader it was showing when it left.
if (typeof window !== "undefined") window.addEventListener("pageshow", (e) => { if (e.persisted) hideLoader(); });
