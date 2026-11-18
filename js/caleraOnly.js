/* Anchor Board — pages built around Mr. Steers' Calera classes, calendar and Alabama standards
   (Plan the Week, Week Review, Question Bank, Planner, Week Builder, Standards).
   A new teacher (starter pack, js/contentPack.js) who opens one by link goes back to Home. */
import { PACK } from "../data/weeks.js?v=60";
if (PACK !== "calera") location.replace("index.html?from=calera-only");
