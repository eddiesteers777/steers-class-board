/* Anchor Board — falling effects on the board (Board look → Effects).
   A layer of a few slow, faint shapes behind the lesson (#stageFx, just above the background).
   Pure CSS animation, nothing to download. Reduced motion: the shapes sit still. */

export const EFFECTS = [["none", "Off"], ["snow", "Snow"], ["leaves", "Fall leaves"], ["pumpkins", "Pumpkins"], ["turkeys", "Turkeys"],
    ["math", "Math symbols"], ["stars", "Stars"], ["hearts", "Hearts"], ["confetti", "Confetti"]];

const GLYPHS = {
    snow: ["❄︎", "❅︎", "❆︎", "•"],
    leaves: ["🍂", "🍁"],
    pumpkins: ["🎃"],
    turkeys: ["🦃"],
    math: ["π", "√", "∑", "÷", "×", "+", "−", "=", "∞", "%", "x²", "∠", "≤", "½"],
    stars: ["★", "✦", "✧"],
    hearts: ["♥", "❤︎"],
    confetti: ["■", "▲", "●", "▬"]
};
const TINTS = {
    snow: ["#FFFFFF", "#DDEBFA"], math: ["#B9D3EE", "#F2B33D", "#FFFFFF"], stars: ["#F2B33D", "#FFE29A"],
    hearts: ["#F28DA6", "#E5484D", "#FFC2D1"], confetti: ["#F2B33D", "#7FAEDD", "#3FB37F", "#E5484D", "#C9A3F5"]
};
/** A tile's sample for the picker. */
export const effectSample = (id) => (GLYPHS[id] || []).slice(0, 3).join(" ");

let shown = "";
/** Fill or clear the effect layer on the stage. */
export function applyEffect(id) {
    const stage = document.getElementById("stage"); if (!stage) return;
    let layer = document.getElementById("stageFx");
    if (!GLYPHS[id]) { if (layer) layer.remove(); shown = ""; document.body.dataset.fx = "none"; return; }
    if (layer && shown === id) return;
    if (!layer) { layer = document.createElement("div"); layer.id = "stageFx"; layer.className = "stagefx"; layer.setAttribute("aria-hidden", "true"); const bg = document.getElementById("stageBg"); if (bg) bg.after(layer); else stage.prepend(layer); }
    layer.textContent = ""; shown = id; document.body.dataset.fx = id;
    const g = GLYPHS[id], tints = TINTS[id], n = id === "snow" || id === "confetti" ? 30 : 18;
    for (let k = 0; k < n; k++) {
        const fall = document.createElement("i"), sway = document.createElement("b"), r = (a, b) => a + Math.random() * (b - a);
        const size = id === "snow" ? r(0.8, 2) : id === "math" ? r(1.4, 2.8) : id === "confetti" ? r(0.5, 1) : r(1.6, 2.8);
        const dur = r(14, 26);
        fall.style.cssText = `left:${((k + Math.random()) / n * 100).toFixed(1)}%;--y:${r(0, 95).toFixed(0)}%;animation-duration:${dur.toFixed(1)}s;animation-delay:${(-r(0, dur)).toFixed(1)}s;font-size:${size.toFixed(2)}em`;
        sway.style.cssText = `animation-duration:${r(3, 6).toFixed(1)}s;animation-delay:${(-r(0, 6)).toFixed(1)}s` + (tints ? `;color:${tints[k % tints.length]}` : "");
        sway.textContent = g[k % g.length]; fall.appendChild(sway); layer.appendChild(fall);
    }
}
