/* ==========================================================
   signInCheck.js -- shows this device's last sign-in steps on screen.
   Turned on with ?signincheck on any page (off with ?signincheck=off).
   Steps and times only: no tokens, no email, no data.
   ========================================================== */
import { readTrail } from "./signInTrail.js";

function show() {
    let box = document.getElementById("signInCheck");
    if (!box) {
        box = document.createElement("section"); box.id = "signInCheck"; box.setAttribute("aria-label", "Sign-in steps on this device");
        box.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:9999;max-width:min(560px,calc(100vw - 24px));max-height:45vh;overflow:auto;background:#fff;color:#0E1B3A;border:1.5px solid #D5DCE9;border-radius:12px;box-shadow:0 8px 32px rgba(14,27,58,.18);padding:10px 14px;font:13px/1.45 system-ui,sans-serif";
        document.body.appendChild(box);
    }
    const rows = readTrail().slice(-15).reverse();
    box.textContent = "";
    const h = document.createElement("b"); h.textContent = "Sign-in steps on this device (newest first)"; box.appendChild(h);
    if (!rows.length) { const p = document.createElement("p"); p.textContent = "No sign-in steps recorded yet."; box.appendChild(p); return; }
    const list = document.createElement("ol"); list.style.cssText = "margin:6px 0 0;padding-left:18px";
    rows.forEach(([t, page, step, detail]) => { const li = document.createElement("li"); li.textContent = new Date(t).toLocaleTimeString() + "  " + page + "  " + step + (detail ? " (" + detail + ")" : ""); list.appendChild(li); });
    box.appendChild(list);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show); else show();
setInterval(show, 2000);
