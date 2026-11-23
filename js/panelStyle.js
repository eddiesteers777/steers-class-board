/* ==========================================
   Anchor Board — panel styles (Eddie, 2026-11-23): each panel's own color, finish and see-through amount,
   picked in the panel's Settings side panel (the gear, or More > Style). Saved in the shared board state
   as tools.sty[panel] = { c: color, f: finish, o: how solid 35-100, r: corners }, so the projected board follows.
   A panel with no style looks exactly as before.
   No imports: boardTools.js cleans the saved value with cleanSty, boardApp.js paints it with applySty.
========================================== */

/* [id, name, fill, deeper fill (gradients), accent (edges, glow), dark?] */
export const PANEL_COLORS = [
    ["paper", "Paper", "#F6F9FD", "#DCE7F5", "#7FAEDD", 0],
    ["sky", "Sky", "#DDEBFA", "#B9D3EE", "#4F8FD8", 0],
    ["mint", "Mint", "#DDF4E8", "#B6E6CC", "#2FB46B", 0],
    ["sun", "Sunshine", "#FFF1CC", "#FFDC85", "#F2B33D", 0],
    ["rose", "Rose", "#FCE3EA", "#F6BFD0", "#E5537A", 0],
    ["lilac", "Lilac", "#ECE4FC", "#D4C4F6", "#8E6BE0", 0],
    ["board", "Match board", "", "", "", 1],
    ["navy", "Navy", "#0B2559", "#081B45", "#7FAEDD", 1],
    ["night", "Midnight", "#0D1222", "#05081A", "#8C98F0", 1],
    ["ocean", "Ocean", "#0A3D5A", "#06243A", "#6FC0DA", 1],
    ["forest", "Forest", "#123B2E", "#0A251C", "#7CC4A2", 1],
    ["plum", "Plum", "#2D1B4B", "#1A0F2E", "#B79BE6", 1],
    ["berry", "Berry", "#4B1438", "#2A0A1F", "#E39BC8", 1],
    ["slate", "Charcoal", "#242C3B", "#141A24", "#9AA8BF", 1],
];
/* [id, name, one line] */
export const PANEL_FINISHES = [
    ["solid", "Solid", "Flat and clean, the most readable"],
    ["glass", "Glass", "Frosted: the board shows through, softly blurred"],
    ["glossy", "Glossy", "A shiny top like a polished button"],
    ["grad", "Gradient", "A soft fade from light to deep"],
    ["glow", "Neon", "A glowing edge in the panel's color"],
    ["grain", "Paper grain", "A fine printed texture"],
    ["frame", "Outline", "See-through with a bold edge"],
];
export const PANEL_CORNERS = [["soft", "Soft"], ["round", "Round"], ["square", "Square"]];
/* One-tap looks: [name, color, finish, solid %] */
export const PANEL_PRESETS = [
    ["Frosted glass", "paper", "glass", 55],
    ["Night glass", "night", "glass", 60],
    ["Glossy candy", "sky", "glossy", 100],
    ["Neon", "night", "glow", 88],
    ["Sunny paper", "sun", "grain", 100],
    ["Match board", "board", "grad", 92],
];
const COLOR_IDS = new Set(PANEL_COLORS.map((c) => c[0])), FIN_IDS = new Set(PANEL_FINISHES.map((f) => f[0])), CORNER_IDS = new Set(PANEL_CORNERS.map((c) => c[0]));
export const MIN_SOLID = 35;   // below this a panel stops being readable from the back of the room

/** A saved style, cleaned; null when it is the plain default (so nothing is stored for it). */
export function cleanSty(x) {
    if (!x || typeof x !== "object") return null;
    const s = { c: COLOR_IDS.has(x.c) ? x.c : "paper", f: FIN_IDS.has(x.f) ? x.f : "solid",
        o: Math.min(100, Math.max(MIN_SOLID, Math.round(+x.o || 100))), r: CORNER_IDS.has(x.r) ? x.r : "soft" };
    return s.c === "paper" && s.f === "solid" && s.o === 100 && s.r === "soft" ? null : s;
}
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) + " " + ((n >> 8) & 255) + " " + (n & 255); };
const CLASSES = ["psty", "pdark", "plight"].concat(PANEL_FINISHES.map((f) => "pf-" + f[0]), PANEL_CORNERS.map((c) => "pr-" + c[0]));
const VARS = ["--pbg", "--pbg2", "--pacc", "--pa"];

/** Paint a panel card with its style. look: [hi, mid, out] of the board's color scheme, for "Match board". */
export function applySty(card, sty, look) {
    const s = cleanSty(sty);
    card.classList.remove(...CLASSES); VARS.forEach((v) => card.style.removeProperty(v));
    if (!s) return;
    const col = PANEL_COLORS.find((c) => c[0] === s.c);
    let fill = col[2], deep = col[3], acc = col[4];
    if (s.c === "board") { const L = look && look.length === 3 ? look : ["#173F86", "#0B2559", "#081B45"]; fill = L[1]; deep = L[2]; acc = "#B9D3EE"; }
    card.classList.add("psty", col[5] ? "pdark" : "plight", "pf-" + s.f, "pr-" + s.r);
    card.style.setProperty("--pbg", rgb(fill)); card.style.setProperty("--pbg2", rgb(deep)); card.style.setProperty("--pacc", rgb(acc));
    card.style.setProperty("--pa", String(s.o / 100));
}
/** For the swatches in the Settings side panel. */
export function swatchBg(c, look) {
    const col = PANEL_COLORS.find((x) => x[0] === c); if (!col) return "#fff";
    if (c === "board") { const L = look || ["#173F86", "#0B2559", "#081B45"]; return "linear-gradient(135deg," + L[0] + "," + L[2] + ")"; }
    return "linear-gradient(160deg," + col[2] + "," + col[3] + ")";
}
