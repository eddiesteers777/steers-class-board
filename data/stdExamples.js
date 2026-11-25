/* ==========================================
   Anchor Board — "What it looks like in class" for a standard (Nov 24, Eddie: the standard's wording is a lot to take in;
   show a specific problem so it is clear what students actually do).
   Keyed by standard code, so 8.13 serves 8th and 8th Accelerated alike. The official wording always comes from
   data/standards.js; these are Eddie's plain-words layer on top. First batch: the stops each class is at right now.

   Each entry:
     skill   short name of the skill, a few words
     plain   one "I can" line in kid language
     problem a sample problem like one done in class
     visual  optional picture that changes as the steps go: { type, ... } (see js/stdExplain.js)
     steps   [{ say (what we do, in words), show (the math, optional), hl (angles to light up, transversal only) }]
     check   { q, options: [..3], right (index), why } a quick "your turn"
   Write math with the real minus sign (−), not a hyphen.
========================================== */
export const STD_EXAMPLES = {
    /* ---------- 8th (and 8th Accelerated) ---------- */
    "8.25": {
        skill: "Angles made by parallel lines and a transversal",
        plain: "I can find a missing angle when one line crosses two parallel lines, because matching angles are equal and angles on a straight line add to 180°.",
        problem: "Lines m and n are parallel, and line t crosses both. Angle 1 is 65°. Find angle 2 and angle 5.",
        visual: { type: "transversal", given: { 1: "65°" } },
        steps: [
            { say: "Angles 1 and 2 sit side by side on line m, a straight line. They add to 180°.", show: "∠2 = 180° − 65° = 115°", hl: [1, 2] },
            { say: "Angle 5 is in the same spot at line n that angle 1 is at line m. Corresponding angles are equal.", show: "∠5 = 65°", hl: [1, 5] },
            { say: "Check it: angle 5 and angle 2 should add to 180°, since angle 2 matches angle 6.", show: "65° + 115° = 180° ✓", hl: [2, 5] },
        ],
        check: { q: "Angle 1 is 65°. What is angle 8?", options: ["65°", "115°", "25°"], right: 0, why: "Angle 8 is straight across from angle 5 (vertical angles), and angle 5 matches angle 1." },
    },
    "8.13": {
        skill: "Is it a function?",
        plain: "I can tell if a relation is a function: every input has exactly one output.",
        problem: "Is this mapping a function?",
        visual: { type: "mapping", from: ["1", "2", "3", "4"], to: ["5", "7", "9"], pairs: [[0, 0], [1, 1], [2, 2], [3, 2]] },
        steps: [
            { say: "Start on the left. Count the arrows leaving each input.", show: "1 → 5    2 → 7    3 → 9    4 → 9" },
            { say: "Every input has exactly one arrow. Two inputs sharing the output 9 is allowed." },
            { say: "So the answer is yes.", show: "It is a function." },
        ],
        check: { q: "Which set of ordered pairs is NOT a function?", options: ["(1, 4), (2, 5), (3, 6)", "(2, 3), (2, 7), (5, 1)", "(0, 2), (1, 2), (2, 2)"], right: 1, why: "The input 2 has two outputs, 3 and 7." },
    },
    "8.14": {
        skill: "Plug in and evaluate",
        plain: "I can put an input into a function rule and find the output.",
        problem: "f(x) = 3x − 4. Find f(5).",
        visual: { type: "machine", input: "5", rule: ["× 3", "− 4"], output: "11", at: 3 },
        steps: [
            { say: "Put 5 in for x.", show: "f(5) = 3(5) − 4" },
            { say: "Multiply first.", show: "f(5) = 15 − 4" },
            { say: "Then subtract.", show: "f(5) = 11" },
        ],
        check: { q: "g(x) = −2x + 1. What is g(−3)?", options: ["7", "−5", "−7"], right: 0, why: "−2 times −3 is positive 6, and 6 + 1 = 7." },
    },
    "8.7": {
        skill: "Proportional or not?",
        plain: "I can tell if two amounts are proportional: they grow at the same rate, and zero of one means zero of the other.",
        problem: "A babysitter's pay is in the table. Is the pay proportional to the hours?",
        visual: { type: "table", head: ["Hours", "Pay ($)"], rows: [["1", "12"], ["2", "24"], ["3", "36"], ["4", "48"]], extra: { head: "Pay ÷ hours", vals: ["12", "12", "12", "12"], at: 1 } },
        steps: [
            { say: "Divide pay by hours in every row.", show: "12 ÷ 1 = 12, 24 ÷ 2 = 12, 36 ÷ 3 = 12, 48 ÷ 4 = 12" },
            { say: "Every row gives the same number, $12 an hour, and 0 hours would pay $0." },
            { say: "Same ratio every time means proportional.", show: "Yes: y = 12x" },
        ],
        check: { q: "A gym costs $20 to join, then $10 a month. Is the total cost proportional to the months?", options: ["Yes", "No"], right: 1, why: "At 0 months it already costs $20, so it doesn't start at zero." },
    },

    /* ---------- 7th ---------- */
    "7.6": {
        skill: "Expand, factor, combine like terms",
        plain: "I can rewrite an expression a simpler way by distributing, factoring and combining like terms.",
        problem: "Simplify 3(2x − 4) + 5x.",
        visual: { type: "area", outer: "3", parts: ["2x", "−4"], cells: ["6x", "−12"], at: 1 },
        steps: [
            { say: "Distribute the 3 to both terms inside the parentheses.", show: "6x − 12 + 5x" },
            { say: "Put the like terms together: the x terms side by side.", show: "6x + 5x − 12" },
            { say: "Combine them.", show: "11x − 12" },
        ],
        check: { q: "Factor 8x + 12 using the greatest common factor.", options: ["4(2x + 3)", "2(4x + 12)", "8(x + 12)"], right: 0, why: "4 is the biggest number that divides both 8 and 12, and 4(2x + 3) = 8x + 12." },
    },
    "7.7": {
        skill: "Same amount, two ways",
        plain: "I can write the same amount in two different ways and explain what each one tells me.",
        problem: "A store marks every price up 5%. Write the new price of an item that costs p dollars in two ways.",
        visual: { type: "bar", parts: [{ t: "p", sub: "the price, 100%", w: 10 }, { t: "0.05p", sub: "5%", w: 2.4 }], total: "1.05p", at: 2 },
        steps: [
            { say: "Start with the price, then add 5% of it.", show: "p + 0.05p" },
            { say: "p is the same as 1p, so combine them.", show: "1p + 0.05p = 1.05p" },
            { say: "p + 0.05p shows the price plus the markup. 1.05p shows the new price is 105% of the old one. Same amount, two ways." },
        ],
        check: { q: "Which expression means a 25% discount on a price d?", options: ["0.75d", "d − 25", "0.25d"], right: 0, why: "Taking off 25% leaves 75% of the price: d − 0.25d = 0.75d." },
    },
    "7.8": {
        skill: "Multi-step problems with negatives, fractions and decimals",
        plain: "I can solve a real-world problem with negatives, fractions or decimals, then estimate to check my answer makes sense.",
        problem: "It is −8°F at 6 a.m. The temperature rises 2.5° every hour. What is the temperature at noon?",
        visual: { type: "line", min: -10, max: 10, step: 2, start: -8, end: 7, at: 2 },
        steps: [
            { say: "6 a.m. to noon is 6 hours. Find the total rise.", show: "6 × 2.5 = 15°" },
            { say: "Add the rise to the starting temperature.", show: "−8 + 15 = 7" },
            { say: "Estimate: about 2 or 3 degrees an hour for 6 hours is about 15, and −8 up 15 is a little above 0. 7°F makes sense.", show: "It is 7°F at noon." },
        ],
        check: { q: "A diver at −12.5 m rises 1/4 of the way to the surface. Where is the diver now?", options: ["−9.375 m", "−15.625 m", "−3.125 m"], right: 0, why: "A quarter of 12.5 is 3.125. Rising moves toward 0: −12.5 + 3.125 = −9.375." },
    },
    "7.9": {
        skill: "Write it, solve it",
        plain: "I can turn a word problem into an equation or inequality, solve it, and explain what the answer means.",
        problem: "T-shirts cost $8 each, plus a $5 shipping fee for the order. You spend exactly $45. How many shirts did you buy?",
        visual: { type: "tape", unit: "8", count: 5, unknown: "x shirts at $8", extra: "5", extraSub: "shipping", total: "$45", at: 3 },
        steps: [
            { say: "Let x be the number of shirts. The cost is $8 per shirt plus $5.", show: "8x + 5 = 45" },
            { say: "Undo the + 5 by subtracting 5 from both sides.", show: "8x = 40" },
            { say: "Undo the × 8 by dividing both sides by 8.", show: "x = 5" },
            { say: "Check it in the story: 5 shirts cost 8(5) + 5 = 45.", show: "You bought 5 shirts." },
        ],
        check: { q: "Which inequality means you spend at most $45?", options: ["8x + 5 ≤ 45", "8x + 5 ≥ 45", "8x + 5 < 45"], right: 0, why: "At most means the cost can equal $45 or be less." },
    },

    /* ---------- 8th Accelerated (Algebra I) ---------- */
    "Alg I.11": {
        skill: "Equations and inequalities from a situation",
        plain: "I can write an equation or inequality from a real situation, solve it, and say what the answer means there.",
        problem: "A phone plan costs $30 a month plus $0.10 per text. How many texts can you send and keep the bill at $45 or less?",
        visual: { type: "line", min: 0, max: 200, step: 50, ray: { at: 150, from: 0, closed: true }, at: 3 },
        steps: [
            { say: "Let t be the number of texts. The bill is $30 plus $0.10 for each text, and it can't go over $45.", show: "30 + 0.10t ≤ 45" },
            { say: "Subtract 30 from both sides.", show: "0.10t ≤ 15" },
            { say: "Divide both sides by 0.10.", show: "t ≤ 150" },
            { say: "You can't send negative texts, so the answer is anywhere from 0 up to 150 texts.", show: "0 ≤ t ≤ 150" },
        ],
        check: { q: "Bags pass if they weigh within 0.5 oz of 16 oz. Which equation finds the lightest and heaviest passing weights?", options: ["|w − 16| = 0.5", "w − 16 = 0.5", "|w + 16| = 0.5"], right: 0, why: "Absolute value is distance from 16, so it catches both 15.5 oz and 16.5 oz." },
    },
};

/** The example for a code, or null. */
export const exampleFor = (code) => STD_EXAMPLES[code] || null;
