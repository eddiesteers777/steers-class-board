/* Anchor Board — falling effects on the board (Board look → Effects).
   A layer of a few slow, faint shapes behind the lesson (#stageFx, just above the background).
   Pure CSS animation, nothing to download. Reduced motion: the shapes sit still. */

export const EFFECTS = [["none", "Off"], ["snow", "Snow"], ["leaves", "Fall leaves"], ["pumpkins", "Pumpkins"], ["turkeys", "Turkeys"],
    ["math", "Math symbols"], ["stars", "Stars"], ["hearts", "Hearts"], ["confetti", "Confetti"],
    // Board Builder, Nov 21
    ["numbers", "Numbers"], ["shapes", "Shapes"], ["sparkles", "Sparkles"], ["bubbles", "Bubbles"], ["rain", "Rain"], ["apples", "Apples"],
    ["pencils", "Pencils"], ["soccer", "Soccer balls"], ["football", "Footballs"], ["gifts", "Presents"], ["snowmen", "Snowmen"],
    ["flowers", "Flowers"], ["clovers", "Clovers"],
    // Photo library, Nov 22: more math, the seasons and things that go with the new photos
    ["fractions", "Fractions"], ["integers", "Integers"], ["greek", "Greek letters"], ["pizza", "Pizza slices"], ["dice", "Dice"],
    ["fireflies", "Fireflies"], ["music", "Music notes"], ["fish", "Fish"], ["rockets", "Rockets"], ["butterflies", "Butterflies"],
    ["bees", "Bees"], ["sunshine", "Sunshine"], ["raindrops", "Raindrops"], ["acorns", "Acorns"], ["trees", "Christmas trees"],
    ["cocoa", "Cocoa and mittens"], ["cookies", "Cookies"], ["fireworks", "Fireworks"], ["basketball", "Basketballs"], ["baseball", "Baseballs"],
    ["books", "Books"]];
/* How many fall at once (Board look → Effects → How many). */
export const FX_AMOUNTS = [[1, "A few"], [2, "Some"], [3, "Lots"]];
const AMOUNT = { 1: 0.5, 2: 1, 3: 1.8 };

const GLYPHS = {
    snow: ["❄︎", "❅︎", "❆︎", "•"],
    leaves: ["🍂", "🍁"],
    pumpkins: ["🎃"],
    turkeys: ["🦃"],
    math: ["π", "√", "∑", "÷", "×", "+", "−", "=", "∞", "%", "x²", "∠", "≤", "½"],
    stars: ["★", "✦", "✧"],
    hearts: ["♥", "❤︎"],
    confetti: ["■", "▲", "●", "▬"],
    numbers: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    shapes: ["△", "□", "○", "◇", "⬡", "☆"],
    sparkles: ["✦", "✧", "⋆", "✶"],
    bubbles: ["○", "◯", "◦"],
    rain: ["╲"],
    apples: ["🍎"], pencils: ["✏️"], soccer: ["⚽"], football: ["🏈"], gifts: ["🎁"], snowmen: ["⛄"], flowers: ["🌸", "🌼"], clovers: ["☘️", "🍀"],
    fractions: ["½", "⅓", "¼", "¾", "⅔", "⅛", "⅕", "⅝"], integers: ["−3", "+5", "−1", "+2", "−7", "0", "+4", "−6"],
    greek: ["α", "β", "θ", "π", "Σ", "Δ", "λ", "μ"], pizza: ["🍕"], dice: ["🎲"], fireflies: ["●"], music: ["♪", "♫", "♬"],
    fish: ["🐟", "🐠", "🐡"], rockets: ["🚀", "🪐", "⭐"], butterflies: ["🦋"], bees: ["🐝", "🌼"], sunshine: ["☀️", "🌤️"],
    raindrops: ["💧"], acorns: ["🌰", "🍂"], trees: ["🎄"], cocoa: ["☕", "🧤", "❄️"], cookies: ["🍪"], fireworks: ["🎆", "🎇", "✨"],
    basketball: ["🏀"], baseball: ["⚾"], books: ["📚", "✏️", "📐"]
};
const TINTS = {
    snow: ["#FFFFFF", "#DDEBFA"], math: ["#B9D3EE", "#F2B33D", "#FFFFFF"], stars: ["#F2B33D", "#FFE29A"],
    hearts: ["#F28DA6", "#E5484D", "#FFC2D1"], confetti: ["#F2B33D", "#7FAEDD", "#3FB37F", "#E5484D", "#C9A3F5"],
    numbers: ["#B9D3EE", "#F2B33D", "#FFFFFF"], shapes: ["#B9D3EE", "#F2B33D", "#7FAEDD"], sparkles: ["#F2B33D", "#FFE29A", "#FFFFFF"],
    bubbles: ["#B9D3EE", "#FFFFFF"], rain: ["#B9D3EE", "#7FAEDD"],
    fractions: ["#B9D3EE", "#F2B33D", "#FFFFFF"], integers: ["#F28DA6", "#7FD3A8", "#F28DA6", "#7FD3A8", "#F28DA6", "#FFFFFF", "#7FD3A8", "#F28DA6"], greek: ["#B9D3EE", "#F2B33D", "#FFFFFF"],
    fireflies: ["#FFE29A", "#F2D16B", "#E8F7A0"], music: ["#FFFFFF", "#F2B33D", "#B9D3EE"]
};
/** A tile's sample for the picker. */
export const effectSample = (id) => (GLYPHS[id] || []).slice(0, 3).join(" ");

let shown = "";
/** Fill or clear the effect layer on the stage. amount: 1 a few, 2 some (the usual), 3 lots. */
export function applyEffect(id, amount) {
    const amt = AMOUNT[amount] ? +amount : 2;
    const stage = document.getElementById("stage"); if (!stage) return;
    let layer = document.getElementById("stageFx");
    if (!GLYPHS[id]) { if (layer) layer.remove(); shown = ""; document.body.dataset.fx = "none"; return; }
    if (layer && shown === id + amt) return;
    if (!layer) { layer = document.createElement("div"); layer.id = "stageFx"; layer.className = "stagefx"; layer.setAttribute("aria-hidden", "true"); const bg = document.getElementById("stageBg"); if (bg) bg.after(layer); else stage.prepend(layer); }
    layer.textContent = ""; shown = id + amt; document.body.dataset.fx = id;
    const g = GLYPHS[id], tints = TINTS[id], n = Math.round((["snow", "confetti", "rain", "sparkles", "fireflies"].includes(id) ? 30 : 18) * AMOUNT[amt]);
    for (let k = 0; k < n; k++) {
        const fall = document.createElement("i"), sway = document.createElement("b"), r = (a, b) => a + Math.random() * (b - a);
        const size = id === "snow" || id === "sparkles" ? r(0.8, 2) : id === "fireflies" ? r(0.35, 0.75) : ["math", "numbers", "shapes", "fractions", "integers", "greek", "music"].includes(id) ? r(1.4, 2.8) : id === "confetti" ? r(0.5, 1) : id === "rain" ? r(0.9, 1.5) : r(1.6, 2.8);
        const dur = id === "rain" || id === "raindrops" ? r(5, 9) : id === "bubbles" || id === "fireflies" ? r(18, 34) : r(14, 26);
        fall.style.cssText = `left:${((k + Math.random()) / n * 100).toFixed(1)}%;--y:${r(0, 95).toFixed(0)}%;animation-duration:${dur.toFixed(1)}s;animation-delay:${(-r(0, dur)).toFixed(1)}s;font-size:${size.toFixed(2)}em`;
        sway.style.cssText = `animation-duration:${r(3, 6).toFixed(1)}s;animation-delay:${(-r(0, 6)).toFixed(1)}s` + (tints ? `;color:${tints[k % tints.length]}` : "");
        sway.textContent = g[k % g.length]; fall.appendChild(sway); layer.appendChild(fall);
    }
}
