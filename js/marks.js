/* Anchor Board — the board's logo mark, drawn in the board's colour scheme.
   markUrl(mark, theme colours, kind) gives a data: URL for one of four uses:
     tile  the rounded-square logo in the board header and whiteboard strip
     dark  the mark on a dark stage (learning-target badge)
     light the mark on white cards (card headings)
     wm    one-colour watermark (header watermark, "Logo" background)
   Navy + Anchor is never drawn here: the page keeps brand/logo.svg and theme-rings.css as they are. */

export const MARKS = [["anchor", "Anchor"], ["rings", "Rings"], ["pi", "Pi"], ["star", "Star"], ["snowflake", "Snowflake"], ["tree", "Tree"], ["ornament", "Ornament"]];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
const AMBER = "#F2B33D", WHITE = "#F6F9FD";

/** Colour roles for one use: o outer, b bottom/second, i inner/soft, m main stroke, a accent. */
function roles(c, kind, theme) {
    const navy = theme === "navy", sky = navy ? "#7FAEDD" : mix(c[0], "#FFFFFF", 0.45), pale = navy ? "#B9D3EE" : mix(c[0], "#FFFFFF", 0.68);
    if (kind === "wm") return { o: sky, b: sky, i: sky, m: sky, a: sky, fill: "none" };
    if (kind === "light") return { o: pale, b: sky, i: sky, m: navy ? "#10358A" : mix(c[0], "#000000", 0.12), a: AMBER, fill: AMBER };
    return { o: c[0], b: sky, i: pale, m: WHITE, a: AMBER, fill: AMBER };   // dark and tile
}
const arc = (d, col, w) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
function starPts(cx, cy, R, r) { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r : R; p.push((cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1)); } return "M" + p.join(" L") + "Z"; }

const DRAW = {
    anchor: (r) => arc("M101.9 317.8 A170 170 0 0 1 101.9 174.2", r.o, 30) + arc("M410.1 174.2 A170 170 0 0 1 410.1 317.8", r.o, 30) + arc("M400.2 336.1 A170 170 0 0 1 111.8 336.1", r.b, 30)
        + arc("M353.0 190.0 A112 112 0 0 1 358.3 291.6", r.i, 28) + arc("M153.7 291.6 A112 112 0 0 1 159.0 190.0", r.i, 28) + arc("M352.0 303.7 A112 112 0 0 1 160.0 303.7", r.m, 28)
        + arc("M256 160 L256 344", r.m, 28) + arc("M204 200 L308 200", r.m, 24) + `<circle cx="256" cy="122" r="30" fill="none" stroke="${r.a}" stroke-width="22"/>`,
    rings: (r) => `<g transform="rotate(-90 256 256)" fill="none" stroke-linecap="round">`
        + `<circle cx="256" cy="256" r="170" stroke="${r.o}" stroke-width="30" stroke-dasharray="880 1200"/>`
        + `<circle cx="256" cy="256" r="112" stroke="${r.b}" stroke-width="28" stroke-dasharray="520 1200"/>`
        + `<circle cx="256" cy="256" r="56" stroke="${r.m}" stroke-width="26" stroke-dasharray="230 1200"/></g>`
        + `<circle cx="256" cy="256" r="16" fill="${r.a}"/>`,
    pi: (r) => arc("M138 196 Q150 160 196 166 L376 162", r.m, 34) + arc("M222 168 Q222 290 168 352", r.m, 34) + arc("M306 166 L302 318 Q302 356 348 342", r.m, 34)
        + arc("M150 400 L362 400", r.a, 18),
    star: (r) => `<path d="${starPts(256, 270, 176, 72)}" fill="${r.fill}" stroke="${r.m}" stroke-width="22" stroke-linejoin="round"/>`,
    snowflake: (r) => { let s = ""; for (let k = 0; k < 6; k++) { const g = `rotate(${k * 60} 256 256)`; s += `<g transform="${g}">` + arc("M256 256 L256 92", r.m, 26) + arc("M256 156 L214 120 M256 156 L298 120", r.i, 20) + arc("M256 206 L226 182 M256 206 L286 182", r.b, 16) + "</g>"; }
        return s + `<circle cx="256" cy="256" r="22" fill="${r.a}"/>`; },
    tree: (r) => arc("M256 128 L352 240 L306 240 L384 340 L128 340 L206 240 L160 240 Z", r.m, 24) + arc("M256 340 L256 404", r.b, 30)
        + `<path d="${starPts(256, 104, 40, 17)}" fill="${r.fill}" stroke="${r.a}" stroke-width="8" stroke-linejoin="round"/>`
        + `<circle cx="226" cy="286" r="13" fill="${r.i}"/><circle cx="292" cy="300" r="13" fill="${r.a}"/><circle cx="262" cy="214" r="12" fill="${r.b}"/>`,
    ornament: (r) => `<circle cx="256" cy="292" r="132" fill="none" stroke="${r.m}" stroke-width="26"/>`
        + arc("M134 270 Q195 236 256 270 T378 270", r.b, 22) + arc("M134 322 Q195 356 256 322 T378 322", r.i, 18)
        + `<rect x="222" y="132" width="68" height="40" rx="8" fill="${r.fill}" stroke="${r.a}" stroke-width="10"/>`
        + `<circle cx="256" cy="108" r="20" fill="none" stroke="${r.a}" stroke-width="12"/>`
};

/** colours = the theme's [hi, mid, deep]. */
export function markSvg(mark, colours, kind, theme) {
    const draw = DRAW[mark] || DRAW.anchor, r = roles(colours, kind, theme);
    const bg = kind === "tile" ? `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colours[0]}"/><stop offset=".55" stop-color="${colours[1]}"/><stop offset="1" stop-color="${colours[2]}"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#g)"/>` : "";
    const inner = kind === "tile" && mark !== "anchor" ? `<g transform="translate(46 46) scale(.82)">${draw(r)}</g>` : draw(r);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${inner}</svg>`;
}
export const markUrl = (mark, colours, kind, theme) => "data:image/svg+xml," + encodeURIComponent(markSvg(mark, colours, kind, theme));
