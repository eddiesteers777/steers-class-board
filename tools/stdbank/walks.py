"""Walkthrough setups for standards-bank word problems (read by build.py, written to data/stdbank/walk.js).

A word problem's walkthrough needs the equation (or expression) the story turns into. That translation is the one
part that cannot be read off the text, so it is written here, keyed by the problem's exact wording. build.py stops
if a key no longer matches a problem, and js/walk.js only shows a walkthrough when solving this setup gives the
problem's answer key exactly, so a setup cannot drift from its problem.

  eq / expr   the equation or inequality to solve, or the expression to work out
  var         what the letter stands for, in words
  why         the first "why" line: how the story becomes math
  story       [phrase in the question, the piece of the equation it becomes] — highlighted in the story, then moved
  then        after solving, what the question really asks for: [{label, expr, unit}]
Problems with no setup here are walked through straight from their text (Solve:, Find:, angle facts, …).
"""

WALKS = {
    # 8th Grade, 8.11
    "Gym A: §20 to join plus §15 a month. Gym B: §50 to join plus §10 a month. After how many months is the cost the same?": {
        "eq": "20 + 15m = 50 + 10m", "var": "the number of months",
        "why": "Each gym's cost is its joining fee plus its monthly price times the months, m. The costs are the same, so set them equal.",
        "story": [["§20 to join", "20"], ["§15 a month", "15m"], ["§50 to join", "50"], ["§10 a month", "10m"]]},
    "A rectangle's length is 5 more than its width. Its perimeter is 46. Find the length.": {
        "eq": "2w + 2(w + 5) = 46", "var": "the width",
        "why": "Let w be the width. The length is 5 more, w + 5. Perimeter = 2 widths + 2 lengths.",
        "story": [["5 more than its width", "2(w + 5)"], ["perimeter is 46", "46"]],
        "then": [{"label": "Length", "expr": "w + 5"}]},
    "The sides of a triangle are x, x + 3 and 2x − 1. The perimeter is 30. Find the longest side.": {
        "eq": "x + (x + 3) + (2x − 1) = 30", "var": "the shortest side",
        "why": "The perimeter is all three sides added together.",
        "story": [["x + 3", "x + 3"], ["2x − 1", "2x − 1"], ["perimeter is 30", "30"]],
        "then": [{"label": "Longest side, 2x − 1", "expr": "2x − 1"}]},
    # 7th Grade, 7.9
    "A gym charges §25 to join plus §15 a month. You paid §130. How many months did you pay for?": {
        "eq": "25 + 15m = 130", "var": "the number of months",
        "why": "What you paid = the joining fee + §15 for each month, m.",
        "story": [["§25 to join", "25"], ["§15 a month", "15m"], ["§130", "130"]]},
    "Three friends each buy a §4 snack and split a §18 pizza. Each paid the same total. Write and solve an equation for what each paid, t.": {
        "eq": "3t = 12 + 18", "var": "what each friend paid",
        "why": "Each friend pays t, so together they pay 3t. That covers three §4 snacks (§12) and the §18 pizza.",
        "story": [["Three friends", "3t"], ["§4 snack", "12"], ["§18 pizza", "18"]]},
    "You have §40. Movie tickets are §9 each and you spend §4 on popcorn. Write and solve an inequality for the number of tickets t you can buy.": {
        "eq": "9t + 4 ≤ 40", "var": "the number of tickets",
        "why": "Tickets cost §9 each, so t tickets cost 9t. Add the popcorn. You can spend at most §40, so use ≤.",
        "story": [["§9 each", "9t"], ["§4 on popcorn", "4"], ["You have §40", "40"]]},
    # 7th Grade, 7.4
    "A diver goes down 12 feet, then up 12 feet. What is her total change in depth?": {
        "expr": "−12 + 12", "why": "Down is negative and up is positive. Add the two changes.",
        "story": [["down 12 feet", "−12"], ["up 12 feet", "12"]]},
    "It is −6°F at 6 a.m. By noon it warms up 15°F. What is the temperature at noon?": {
        "expr": "−6 + 15", "why": "Start at −6. Warming up adds 15.",
        "story": [["−6°F", "−6"], ["warms up 15°F", "15"]]},
    "What is the distance between −5 and 3 on a number line?": {
        "expr": "3 − (−5)", "why": "Distance is the bigger number minus the smaller number.",
        "story": [["−5", "−5"], ["3", "3"]]},
    "What is the distance between −2.4 and −7.1?": {
        "expr": "−2.4 − (−7.1)", "why": "Distance is the bigger number minus the smaller number. −2.4 is bigger (closer to 0).",
        "story": [["−2.4", "−2.4"], ["−7.1", "−7.1"]]},
    "A submarine is at −120 m. A bird is at 35 m. How far apart are they?": {
        "expr": "35 − (−120)", "why": "How far apart = the higher one minus the lower one.",
        "story": [["−120 m", "−120"], ["35 m", "35"]]},
    # 7th Grade, 7.8
    "Sam has −§12.40 in his account. He deposits §30, then pays a §2.75 fee 3 times. What is his balance?": {
        "expr": "−12.40 + 30 − 3(2.75)", "why": "Start with what he has, add the deposit, and take away the fee 3 times.",
        "story": [["−§12.40", "−12.40"], ["deposits §30", "30"], ["§2.75 fee 3 times", "3(2.75)"]]},
    "A recipe needs 2{1/4} cups of flour. You triple it. How many cups do you need?": {
        "expr": "3 × 2{1/4}", "why": "Triple means multiply by 3.",
        "story": [["2{1/4} cups", "2{1/4}"], ["triple it", "3"]]},
    "The temperature was −4.5°C. It dropped 3.2°C, then rose 6°C. What is the temperature now?": {
        "expr": "−4.5 − 3.2 + 6", "why": "Dropped means subtract; rose means add.",
        "story": [["−4.5°C", "−4.5"], ["dropped 3.2°C", "3.2"], ["rose 6°C", "6"]]},
    "A board is 8 feet long. You cut off {3/4} foot three times. How long is it now?": {
        "expr": "8 − 3 × {3/4}", "why": "Start with 8 feet and take away {3/4} foot, 3 times.",
        "story": [["8 feet", "8"], ["{3/4} foot three times", "3 × {3/4}"]]},
    "You earn §15.50 an hour and work 6{1/2} hours. How much do you earn?": {
        "expr": "15.50 × 6{1/2}", "why": "Pay = pay per hour × hours.",
        "story": [["§15.50 an hour", "15.50"], ["6{1/2} hours", "6{1/2}"]]},
    "A stock lost §1.35 each day for 5 days. What was the total change in price?": {
        "expr": "−1.35 × 5", "why": "A loss is negative. It happened 5 times, so multiply.",
        "story": [["lost §1.35", "−1.35"], ["5 days", "5"]]},
    "A tank is {2/5} full and holds 30 gallons when full. You add 4.5 gallons. How many gallons are in it now?": {
        "expr": "{2/5} × 30 + 4.5", "why": "{2/5} full means {2/5} of 30 gallons. Then add 4.5.",
        "story": [["{2/5} full", "{2/5}"], ["30 gallons", "30"], ["add 4.5 gallons", "4.5"]]},
    # Algebra I, Alg I.11
    "You have §60 and spend §4 a day. Write and solve an inequality for the days d until you have less than §20.": {
        "eq": "60 − 4d < 20", "var": "the number of days",
        "why": "You start with §60 and lose §4 each day, so after d days you have 60 − 4d. That has to be less than §20.",
        "story": [["§60", "60"], ["§4 a day", "−4d"], ["less than §20", "20"]]},

    # 7th Grade, 7.7: write the expression from the story, then simplify it
    "A price p goes up 10%. Write the new price as one term.": {
        "simp": "p + 0.1p", "var": "the old price",
        "why": "Going up 10% means the old price plus 10% of it. 10% is 0.1, so 10% of p is 0.1p.",
        "story": [["A price p", "p"], ["goes up 10%", "0.1p"]],
        "end": "1.1p means the new price is 110% of the old price."},
    "A shirt that costs p dollars is 20% off. Write an expression for the sale price with one term.": {
        "simp": "p − 0.2p", "var": "the price before the sale",
        "why": "20% off means the price minus 20% of it. 20% is 0.2, so 20% of p is 0.2p.",
        "story": [["costs p dollars", "p"], ["20% off", "0.2p"]],
        "end": "0.8p means you pay 80% of the price."},
    "The cost of x hats at §12 each plus x scarves at §8 each. Write the cost as one term.": {
        "simp": "12x + 8x", "var": "the number of hats, and also of scarves",
        "why": "x hats at §12 each cost 12x. x scarves at §8 each cost 8x. Add them.",
        "story": [["x hats at §12 each", "12x"], ["x scarves at §8 each", "8x"]],
        "end": "Each hat and scarf together cost §20, so x of each cost 20x."},
    "An item with regular price p is discounted by 15%. Which two expressions both represent the sale price?": {
        "simp": "p − 0.15p", "var": "the regular price",
        "why": "Discounted by 15% means the price minus 15% of it. 15% is 0.15, so 15% of p is 0.15p.",
        "story": [["regular price p", "p"], ["discounted by 15%", "0.15p"]],
        "end": "p − 0.15p and 0.85p are the same sale price, written two ways."},
    "A store adds a 7% sales tax to a purchase of d dollars. Which expression is equivalent to d + 0.07d?": {
        "simp": "d + 0.07d", "var": "the purchase before tax",
        "why": "The tax adds 7% of d. 7% is 0.07, so the total is d + 0.07d.",
        "story": [["purchase of d dollars", "d"], ["7% sales tax", "0.07d"]],
        "end": "1.07d means the total is 107% of the purchase."},
    "A square has side length s. If each side is increased by 2 inches, which two expressions represent the new perimeter?": {
        "simp": "4(s + 2)", "var": "the old side length",
        "why": "Each new side is s + 2. A square has 4 equal sides, so the perimeter is 4 times (s + 2).",
        "story": [["increased by 2 inches", "2"], ["A square", "4(s + 2)"]],
        "end": "4(s + 2) and 4s + 8 are the same perimeter, written two ways."},
    "A rectangle has length L and width 4. Write two equivalent expressions for its perimeter.": {
        "simp": "2(L + 4)", "var": "the length",
        "why": "Perimeter is the length plus the width, twice: 2(L + 4).",
        "story": [["length L", "L"], ["width 4", "4"]],
        "end": "2L + 8 and 2(L + 4) are the same perimeter, written two ways."},
    "A bookstore marks up wholesale book prices w by 30%, then offers a 10% loyalty discount on the marked-up price. Which simplified expression represents the final price, and what single percent change from w does it represent?": {
        "simp": "0.9(1.3w)", "var": "the wholesale price",
        "why": "A 30% markup makes the price w + 0.3w = 1.3w. A 10% discount leaves 90% of that price, so multiply by 0.9.",
        "story": [["marks up wholesale book prices w by 30%", "1.3w"], ["10% loyalty discount", "0.9(1.3w)"]],
        "end": "1.17w is 117% of w, so it's a 17% increase overall."},
    "A town's population p decreased by 8% last year and then decreased by 8% again this year. A student writes 0.84p for the new population. Which expression is actually correct, and why?": {
        "simp": "0.92(0.92p)", "var": "the starting population",
        "why": "Each 8% decrease leaves 92% of what was there. After last year the population is 0.92p. This year's 8% comes off 0.92p, not p, so multiply by 0.92 again.",
        "story": [["decreased by 8% last year", "0.92p"], ["decreased by 8% again this year", "0.92(0.92p)"]],
        "end": "0.8464p is about 84.6% of p. The student took 8% off the original p twice."},
    "Write an expression: 5 more than twice a number n.": {
        "write": "2n + 5", "var": "the number",
        "why": "Twice a number n is 2n. 5 more than that means add 5.",
        "story": [["twice a number n", "2n"], ["5 more", "5"]]},
    "A pool has 500 gallons and drains 25 gallons each minute. Write an expression for the gallons left after m minutes.": {
        "write": "500 − 25m", "var": "the number of minutes",
        "why": "It starts at 500 gallons. Each minute takes away 25 gallons, so m minutes take away 25m.",
        "story": [["500 gallons", "500"], ["25 gallons each minute", "25m"]]},
    "Four friends split a bill b and each adds a §3 tip. Write an expression for what each pays.": {
        "write": "{b/4} + 3", "var": "the bill",
        "why": "Four friends split the bill, so each pays b ÷ 4. Then each adds §3.",
        "story": [["split a bill b", "{b/4}"], ["§3 tip", "3"]]},
    # Algebra I, AlgI.11
    "Your test scores are 82 and 91. What score x on the 3rd test gives an average of at least 88?": {
        "eq": "82 + 91 + x ≥ 264", "var": "the 3rd test score",
        "why": "An average of at least 88 over 3 tests means the 3 scores add up to at least 3 × 88 = 264.",
        "story": [["82", "82"], ["91", "91"], ["average of at least 88", "264"]]},
    "Elena has §45 and saves §12 per week to buy a bicycle that costs §165. Which equation can be used to find w, the number of weeks it will take her to save enough money?": {
        "write": "45 + 12w = 165", "var": "the number of weeks",
        "why": "She starts with §45 and adds §12 each week, so after w weeks she has 45 + 12w. That has to reach §165.",
        "story": [["has §45", "45"], ["§12 per week", "12w"], ["costs §165", "165"]]},
    "A delivery truck can carry at most 2,500 pounds. It already holds a 700-pound crate, and the driver wants to load boxes that weigh 60 pounds each. Which inequality represents the number of boxes, b, the driver can load?": {
        "write": "700 + 60b ≤ 2500", "var": "the number of boxes",
        "why": "The load is the 700-pound crate plus 60 pounds for each box, 60b. At most 2,500 means it can equal 2,500 or be less: ≤.",
        "story": [["700-pound crate", "700"], ["60 pounds each", "60b"], ["at most 2,500 pounds", "2500"]]},
}
