// Shared header and footer for the public site (same idea as a shared header component:
// one place to change the name, the menu and the footer links).
import { markSvg, ensureCss, showLoader } from "../js/anchorLoader.js?v=2";
export const BRAND = "Anchor Board";
const LOGO = "../brand/logo.svg";

const LINKS = [
    ["index.html#how", "How it works"],
    ["index.html#tour", "Tour"],
    ["schools.html", "For schools"],
    ["pricing.html", "Pricing"],
    ["about.html", "About"]
];

const page = location.pathname.split("/").pop() || "index.html";

// The header's anchor draws itself in once per visit (the animated logo, 2026-11-22), then stays still.
function drawIn() {
    try { if (sessionStorage.getItem("ab-drawn")) return false; sessionStorage.setItem("ab-drawn", "1"); } catch (e) { /* no storage: draw it */ }
    return true;
}

// "Try the demo board" shows the moving anchor while the board loads.
document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href$="demo.html"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
    showLoader("Opening the demo board…");
});

function header() {
    ensureCss();
    const h = document.getElementById("siteHeader");
    if (!h) return;
    h.className = "nav";
    h.innerHTML = `
<a class="skip" href="#main">Skip to content</a>
<div class="wrap nav-in">
  <a class="brand" href="index.html"><span class="brand-mark">${markSvg(drawIn() ? "anl-drawin" : "")}</span><span>${BRAND}</span></a>
  <nav class="nav-links" id="navLinks" aria-label="Main">
    ${LINKS.map(([href, label]) => `<a href="${href}"${href === page ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
    <a class="only-menu" href="../login.html">Teacher sign in</a>
  </nav>
  <div class="nav-end">
    <a class="nav-signin" href="../login.html">Sign in</a>
    <a class="btn btn-primary btn-sm" href="join.html"><span class="nav-long">Join early access</span><span class="nav-short">Join</span></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="navLinks" aria-label="Menu"><span></span><span></span></button>
  </div>
</div>`;
    const btn = h.querySelector(".menu-btn");
    btn.addEventListener("click", () => {
        const open = !h.classList.contains("open");
        h.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", String(open));
    });
    h.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => { h.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }));
}

function footer() {
    const f = document.getElementById("siteFooter");
    if (!f) return;
    f.className = "foot";
    f.innerHTML = `
<div class="wrap">
  <div class="foot-grid">
    <div>
      <a class="brand" href="index.html"><img src="${LOGO}" alt="" width="34" height="34"><span>${BRAND}</span></a>
      <p class="foot-line">Run the whole lesson from one board. Made by a middle school math teacher.</p>
    </div>
    <nav aria-label="Product"><h2>Product</h2><a href="index.html#how">How it works</a><a href="index.html#tour">Tour</a><a href="../demo.html">Try the demo board</a><a href="pricing.html">Pricing</a></nav>
    <nav aria-label="Teachers"><h2>Teachers</h2><a href="join.html">Join early access</a><a href="schools.html">For schools</a><a href="../login.html">Teacher sign in</a></nav>
    <nav aria-label="About"><h2>About</h2><a href="about.html">About</a><a href="../privacy.html">Privacy</a><a href="../terms.html">Terms</a></nav>
  </div>
  <div class="foot-legal">&copy; ${new Date().getFullYear()} ${BRAND}. Students never make an account.</div>
</div>`;
}

header();
footer();
