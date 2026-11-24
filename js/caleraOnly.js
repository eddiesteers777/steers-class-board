/* Anchor Board — pages built around Mr. Steers' Calera classes, calendar and Alabama standards
   (Plan the Week, Week Review, Question Bank, Planner, Week Builder, Standards, Timeline).
   A new teacher (starter pack, js/contentPack.js) who opens one by link goes back to Home.

   Nov 23: the page is sent away only when the server CONFIRMED a starter choice. A provisional answer
   (remembered on this device, sign-in still restoring, server not reached) never redirects: Plan stays,
   and a short "Checking your account" note shows while the check runs. */
import { PACK } from "../data/weeks.js?v=63";
import { packInfo } from "./contentPack.js?v=4";

if (PACK !== "calera") {
    const info = packInfo();
    if (info.confirmed) location.replace("index.html?from=calera-only");
    else {
        // Not confirmed: say so and stay. (myPack only answers "starter" after the server confirms, so this is a guard.)
        const n = document.createElement("p"); n.setAttribute("role", "status");
        n.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;margin:0;padding:10px 16px;border-radius:12px;background:#FFF8E6;color:#5A4200;border:1px solid #F2D58A;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 8px 32px rgba(11,37,89,.12)";
        n.textContent = "Checking your account… If this page looks empty, reload in a moment.";
        (document.body || document.documentElement).appendChild(n);
    }
}
