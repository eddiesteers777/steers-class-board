/* Anchor Board — the Remote's left panel (remote.html only). Eddie, 2026-11-24:
   "push out the panel more but add a feature to minimize and expand the panel and to resize the panel to the
   users liking", and "start Mon right where the board starts so they are aligned".
   - The panel starts a little wider (280px). Drag its right edge to make it wider or narrower (200 to 520px);
     double-click the edge to go back to 280. Arrow keys work on the edge too.
   - The « button at the top hides the panel to a slim strip; » brings it back.
   - Width and hidden/shown are kept on this device (localStorage), so each Chromebook remembers its own.
   - The day picker and Back/Next line up with the board's left and right edges, wherever the board sits.
   Phones keep their own layout: every rule for this is in css/remotebar.css under body.console:not(.phone). */
const W_KEY = "anchorboard-rail-w", MIN_KEY = "anchorboard-rail-min", DEF = 280, LO = 200, HI = 520;
const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private window: still works, just not remembered */ } };
const ICON = (d) => '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';

function mount() {
    const rail = document.querySelector(".cbody > .rail"), deck = document.querySelector(".cbody > .deck");
    if (!rail || !deck || rail.dataset.sized) return;
    rail.dataset.sized = "1";
    const root = document.documentElement, body = document.body;
    const hi = () => Math.max(LO, Math.min(HI, Math.round(window.innerWidth * 0.45)));
    const clamp = (w) => Math.max(LO, Math.min(hi(), Math.round(w)));
    let width = clamp(+get(W_KEY) || DEF);
    const apply = () => root.style.setProperty("--railw", width + "px");
    apply();

    /* hide / show */
    const tog = document.createElement("button");
    tog.type = "button"; tog.className = "railtoggle";
    rail.insertBefore(tog, rail.firstChild);
    const setMin = (on, keep) => {
        body.classList.toggle("railmin", on);
        tog.innerHTML = ICON(on ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6");
        tog.title = on ? "Show the panel" : "Hide the panel";
        tog.setAttribute("aria-label", tog.title); tog.setAttribute("aria-expanded", on ? "false" : "true");
        if (keep) set(MIN_KEY, on ? "1" : null);
        align();
    };
    tog.onclick = () => setMin(!body.classList.contains("railmin"), true);

    /* drag the edge */
    const grip = document.createElement("div");
    grip.className = "railgrip"; grip.tabIndex = 0;
    grip.setAttribute("role", "separator"); grip.setAttribute("aria-orientation", "vertical");
    grip.setAttribute("aria-label", "Panel width. Drag, or use the arrow keys. Double-click to reset.");
    grip.title = "Drag to resize the panel. Double-click to reset.";
    rail.after(grip);
    const commit = () => { apply(); set(W_KEY, width === DEF ? null : String(width)); grip.setAttribute("aria-valuenow", width); };
    grip.setAttribute("aria-valuemin", LO); grip.setAttribute("aria-valuemax", HI); grip.setAttribute("aria-valuenow", width);
    grip.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const x0 = e.clientX, w0 = rail.getBoundingClientRect().width;
        grip.setPointerCapture(e.pointerId); body.classList.add("raildrag");
        const move = (ev) => { width = clamp(w0 + ev.clientX - x0); apply(); };
        const up = () => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up); body.classList.remove("raildrag"); commit(); };
        grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
    });
    grip.addEventListener("dblclick", () => { width = clamp(DEF); commit(); });
    grip.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowLeft" ? -16 : e.key === "ArrowRight" ? 16 : 0;
        if (e.key === "Home") { width = clamp(DEF); commit(); e.preventDefault(); return; }
        if (!d) return;
        e.preventDefault(); width = clamp(width + d); commit();
    });
    window.addEventListener("resize", () => { const w = clamp(width); if (w !== width) { width = w; apply(); } });

    /* days and Back/Next line up with the board */
    const fb = deck.querySelector(".flowbar"), stage = document.getElementById("stage");
    let shelfSeen = null, raf = 0;
    function align() { if (!raf) raf = requestAnimationFrame(doAlign); }
    function doAlign() {
        raf = 0;
        if (!fb || !stage) return;
        const shelf = document.getElementById("toolShelf");
        if (shelf && shelf !== shelfSeen && ro) { shelfSeen = shelf; ro.observe(shelf); }
        const d = deck.getBoundingClientRect(), s = stage.getBoundingClientRect();
        if (!s.width || !d.width) return;
        let right = s.right;
        if (shelf && !shelf.hidden) { const r = shelf.getBoundingClientRect(); if (r.width) right = Math.max(right, r.right); }
        fb.style.setProperty("--fbl", Math.max(8, Math.round(s.left - d.left)) + "px");
        fb.style.setProperty("--fbr", Math.max(8, Math.round(d.right - right)) + "px");
    }
    const ro = window.ResizeObserver ? new ResizeObserver(align) : null;
    if (ro) { ro.observe(deck); if (stage) ro.observe(stage); }
    window.addEventListener("resize", align);
    new MutationObserver(align).observe(body, { attributes: true, attributeFilter: ["class"] });

    setMin(get(MIN_KEY) === "1", false);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
