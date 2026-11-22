/* ==========================================================
   anchorLoader.js -- the animated anchor shown while sign-in works.

   Eddie, 2026-11-21: "rather than the raw font for signing in", a loader made from the anchor logo.
   The logo's own parts move: the outer rings draw around in turn, then the inner arms, the amber
   eye at the top pulses, and the white shank and crossbar stay put so the mark always reads as
   the anchor. One quiet line under it says what is happening.

   showLoader(text) puts it over the page (or changes its line); hideLoader() takes it away.
   It brings its own styles, so any page can use it. Reduced motion: the rings stay drawn and
   only the eye glows.
   ========================================================== */

const CSS = `
.anl{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:24px 16px;
  background:linear-gradient(135deg,#173F86 0%,#0B2559 55%,#081B45 100%);color:#F4F7FB;text-align:center;
  font:600 16px/1.45 'Instrument Sans',system-ui,'Segoe UI',sans-serif;opacity:0;transition:opacity .2s ease-out}
.anl.on{opacity:1}
.anl svg{width:132px;height:132px;filter:drop-shadow(0 14px 32px rgba(4,12,32,.5))}
.anl p{margin:0;max-width:320px;color:#B9D3EE;min-height:1.45em}
.anl .arc{stroke-dasharray:1 1;stroke-dashoffset:1;animation:anl-draw 2.4s cubic-bezier(.65,0,.35,1) infinite}
.anl .a1{animation-delay:0s}.anl .a2{animation-delay:.12s}.anl .a3{animation-delay:.24s}
.anl .a4{animation-delay:.42s}.anl .a5{animation-delay:.54s}.anl .a6{animation-delay:.66s}
.anl .eye{transform-origin:256px 122px;animation:anl-eye 1.2s ease-in-out infinite}
.anl .shank{animation:anl-in .5s ease-out both}
@keyframes anl-draw{0%{stroke-dashoffset:1}38%{stroke-dashoffset:0}62%{stroke-dashoffset:0}100%{stroke-dashoffset:-1}}
@keyframes anl-eye{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.75}}
@keyframes anl-in{from{opacity:0}}
@media (prefers-reduced-motion:reduce){
  .anl .arc{animation:none;stroke-dashoffset:0}
  .anl .eye{animation:anl-glow 1.6s ease-in-out infinite;transform:none}
  @keyframes anl-glow{50%{opacity:.55}}
}`;

// The logo's own shapes (brand/logo.svg). pathLength="1" lets every arc draw over the same time.
const MARK = `<svg viewBox="0 0 512 512" aria-hidden="true">
<defs><linearGradient id="anlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173F86"/><stop offset=".55" stop-color="#0B2559"/><stop offset="1" stop-color="#081B45"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="url(#anlg)"/>
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

let box = null;

export function showLoader(text) {
    if (typeof document === "undefined") return;
    if (!box) {
        if (!document.getElementById("anlCss")) { const s = document.createElement("style"); s.id = "anlCss"; s.textContent = CSS; document.head.appendChild(s); }
        box = document.createElement("div"); box.className = "anl"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
        box.innerHTML = MARK + "<p></p>";
        document.body.appendChild(box);
        requestAnimationFrame(() => { if (box) box.classList.add("on"); });
    }
    box.querySelector("p").textContent = text || "";
}

export function hideLoader() {
    if (!box) return;
    const b = box; box = null; b.classList.remove("on");
    setTimeout(() => b.remove(), 220);
}
