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
    # 7th Grade, 7.3
    "A shirt costs §24. The sales tax is 8%. What is the total cost?": {
        "expr": "24 + 0.08 × 24", "why": "Tax is 8% of the price, and 8% = 0.08. The total is the price plus the tax.",
        "story": [["§24", "24"], ["8%", "0.08"]]},
    "Your meal costs §36. You leave a 20% tip. How much is the tip?": {
        "expr": "0.2 × 36", "why": "The tip is 20% of the meal, and 20% = 0.20 = 0.2.",
        "story": [["§36", "36"], ["20%", "0.2"]]},
    "A §60 jacket is 25% off. What is the sale price?": {
        "expr": "60 − 0.25 × 60", "why": "25% off means take away 25% of the price, and 25% = 0.25.",
        "story": [["§60", "60"], ["25%", "0.25"]]},
    "You deposit §500 at 3% simple interest per year for 4 years. How much interest do you earn?": {
        "expr": "500 × 0.03 × 4", "why": "Simple interest = principal × rate × years. The rate 3% = 0.03.",
        "story": [["§500", "500"], ["3%", "0.03"], ["4 years", "4"]]},
    "A store buys a lamp for §40 and marks it up 35%. What is the selling price?": {
        "expr": "40 + 0.35 × 40", "why": "A markup adds 35% of the cost to the cost, and 35% = 0.35.",
        "story": [["§40", "40"], ["35%", "0.35"]]},
    "A salesperson earns 6% commission. She sells §2,500 of shoes. How much commission does she earn?": {
        "expr": "0.06 × 2500", "why": "Commission is 6% of the sales, and 6% = 0.06.",
        "story": [["6%", "0.06"], ["§2,500", "2500"]]},
    "A price goes from §50 to §65. What is the percent increase?": {
        "expr": "(65 − 50) ÷ 50", "why": "Percent increase = the change ÷ the original price. Then write the decimal as a percent.",
        "story": [["§50", "50"], ["§65", "65"]]},
    "A town's population drops from 800 to 680. What is the percent decrease?": {
        "expr": "(800 − 680) ÷ 800", "why": "Percent decrease = the change ÷ the original number. Then write the decimal as a percent.",
        "story": [["800", "800"], ["680", "680"]]},
    "A §80 game is 15% off, then 6% tax is added to the sale price. What is the total?": {
        "expr": "(80 − 0.15 × 80) × 1.06", "why": "First take 15% off. Then the tax adds 6%, so you pay 106% of the sale price, and 106% = 1.06.",
        "story": [["§80", "80"], ["15%", "0.15"], ["6%", "1.06"]]},
    "You borrow §1,200 at 5% simple interest for 3 years. What is the total you pay back?": {
        "expr": "1200 + 1200 × 0.05 × 3", "why": "You pay back what you borrowed plus the interest. Interest = principal × rate × years, and 5% = 0.05.",
        "story": [["§1,200", "1200"], ["5%", "0.05"], ["3 years", "3"]]},
    "A bank charges a 2% fee to cash a §350 check. How much money do you get?": {
        "expr": "350 − 0.02 × 350", "why": "The bank keeps 2% of the check, and 2% = 0.02. You get the rest.",
        "story": [["2%", "0.02"], ["§350", "350"]]},
    "Your bill is §45. You pay 7% tax and leave an 18% tip on the bill before tax. What is the total?": {
        "expr": "45 + 0.07 × 45 + 0.18 × 45", "why": "Both the tax and the tip are a percent of the §45 bill. 7% = 0.07 and 18% = 0.18.",
        "story": [["§45", "45"], ["7%", "0.07"], ["18%", "0.18"]]},
    "A jacket costs §60 before tax. If sales tax is 8%, how much is the sales tax?": {
        "expr": "0.08 × 60", "why": "The tax is 8% of the price, and 8% = 0.08.",
        "story": [["§60", "60"], ["8%", "0.08"]]},
    "Marcus deposits §500 in a savings account that earns 4% simple interest per year. How much simple interest does he earn in 2 years?": {
        "expr": "500 × 0.04 × 2", "why": "Simple interest = principal × rate × years. The rate 4% = 0.04.",
        "story": [["§500", "500"], ["4%", "0.04"], ["2 years", "2"]]},
    "A store marks down a §45 backpack by 20%. What is the sale price?": {
        "expr": "45 − 0.2 × 45", "why": "A 20% markdown takes away 20% of the price, and 20% = 0.2.",
        "story": [["§45", "45"], ["20%", "0.2"]]},
    "A family's restaurant bill is §68.00 before tax and tip. Sales tax is 5% of the pre-tax bill, and they leave a 15% tip on the pre-tax bill. What is the total amount they pay?": {
        "expr": "68 + 0.05 × 68 + 0.15 × 68", "why": "The tax and the tip are both a percent of the §68 bill. 5% = 0.05 and 15% = 0.15.",
        "story": [["§68.00", "68"], ["5%", "0.05"], ["15%", "0.15"]]},
    "Last month, a school club had 40 members. This month, it has 52 members. What is the percent increase in membership?": {
        "expr": "(52 − 40) ÷ 40", "why": "Percent increase = the change ÷ the original number. Then write the decimal as a percent.",
        "story": [["40 members", "40"], ["52 members", "52"]]},
    "A real estate agent earns a 3.5% commission on home sales. How much commission does the agent earn on a house that sells for §240,000?": {
        "expr": "0.035 × 240000", "why": "The commission is 3.5% of the price, and 3.5% = 0.035.",
        "story": [["3.5%", "0.035"], ["§240,000", "240000"]]},
    "A bike shop buys a bicycle from a manufacturer for §180, marks it up by 40%, and later puts it on sale for 25% off the marked-up price. What is the final sale price?": {
        "expr": "(180 + 0.4 × 180) × 0.75", "why": "First add the 40% markup. 25% off means you pay 75% of the marked-up price, and 75% = 0.75.",
        "story": [["§180", "180"], ["40%", "0.4"], ["25% off", "0.75"]]},
    "After a 15% discount, a pair of headphones costs §102. What was the original price before the discount?": {
        "eq": "0.85p = 102", "var": "the original price", "why": "After 15% off you pay 85% of the original price: 100% − 15% = 85% = 0.85. So 0.85 of the original price, p, is §102.",
        "story": [["15% discount", "0.85p"], ["§102", "102"]]},
    "Elena borrows §1,200 at 6% simple annual interest. If she pays back a total of §1,416 (principal plus interest), for how many years did she borrow the money?": {
        "eq": "1200 + 72t = 1416", "var": "the number of years", "why": "Each year's interest is 6% of §1,200: 0.06 × 1,200 = §72. What she pays back = what she borrowed + §72 for each year, t.",
        "story": [["§1,200", "1200"], ["6%", "72t"], ["§1,416", "1416"]]},
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

    # 7th Grade, 7.4
    "The temperature at dawn was −4.5 degrees Fahrenheit. By noon, it rose 11.2 degrees, and by midnight it dropped 8.9 degrees. What was the temperature at midnight?": {
        "expr": "−4.5 + 11.2 − 8.9",
        "why": "Start at −4.5. Rising 11.2 degrees adds 11.2. Dropping 8.9 degrees subtracts 8.9.",
        "story": [["−4.5 degrees", "−4.5"], ["rose 11.2 degrees", "11.2"], ["dropped 8.9 degrees", "8.9"]]},
    "A stock loses §2.40 in value each day for 5 days. Which expression and product correctly model the total change in the stock's value?": {
        "expr": "5 × (−2.40)",
        "why": "Losing §2.40 is a change of −2.40. It happens 5 times, so multiply 5 by −2.40.",
        "story": [["loses §2.40", "−2.40"], ["5 days", "5"]]},
    # Week 6 gaps: 7.5
    "A hiker climbs {3/4} mile in {1/2} hour. Write and simplify a complex fraction for her speed in miles per hour.": {
        "expr": "{3/4} ÷ {1/2}", "why": "Speed is miles ÷ hours. The complex fraction has {3/4} on top and {1/2} on the bottom, and that's the same as {3/4} ÷ {1/2}.",
        "story": [["{3/4} mile", "{3/4}"], ["{1/2} hour", "{1/2}"]]},
    "Simplify the complex fraction: {3/5} ÷ {9/10}": {
        "expr": "{3/5} ÷ {9/10}", "why": "A complex fraction is a fraction divided by a fraction. Divide {3/5} by {9/10}."},
    "A hiker starts at an elevation of 125.4 feet, climbs 48.6 feet, and then descends 3 equal sections of 62.5 feet each. What is the hiker's final elevation?": {
        "expr": "125.4 + 48.6 − 3 × 62.5", "why": "Start at 125.4. Climbing adds 48.6. Descending 3 sections of 62.5 takes away 3 × 62.5.",
        "story": [["125.4 feet", "125.4"], ["climbs 48.6 feet", "48.6"], ["3 equal sections of 62.5 feet", "3 × 62.5"]]},
    "A bakery has 18{3/4} pounds of flour. Each loaf of bread uses 1{1/4} pounds of flour, and each batch of rolls uses {5/8} pound of flour. If the baker makes 9 loaves of bread, how many full batches of rolls can be made with the remaining flour?": {
        "expr": "(18{3/4} − 9 × 1{1/4}) ÷ {5/8}", "why": "9 loaves use 9 × 1{1/4} pounds. Take that from 18{3/4} to get what's left, then see how many {5/8}-pound batches fit in it.",
        "story": [["18{3/4} pounds", "18{3/4}"], ["1{1/4} pounds", "1{1/4}"], ["{5/8} pound", "{5/8}"], ["9 loaves", "9"]]},
    "Over four days, a bank account had transactions of -§42.50, +§115.00, -§28.75, and -§19.25. If the ending balance is §84.50, what was the starting balance?": {
        "eq": "s − 42.50 + 115.00 − 28.75 − 19.25 = 84.50", "var": "the starting balance",
        "why": "Start with the unknown balance, s. Add each transaction to it. What's left at the end is §84.50.",
        "story": [["-§42.50", "42.50"], ["+§115.00", "115.00"], ["-§28.75", "28.75"], ["-§19.25", "19.25"], ["§84.50", "84.50"]]},
    # Week 6 gaps: 7.6
    "For what value of k is the expression k(4x − 6) + 2x equivalent to −10x + 18?": {
        "eq": "−6k = 18", "var": "the number in front",
        "why": "k(4x − 6) + 2x = 4kx − 6k + 2x. Its number without x is −6k. To match −10x + 18, that number has to be 18.",
        "story": [["k(4x − 6)", "−6k"], ["18", "18"]]},
    # Week 6 gaps: 8.14
    "Given p(x) = −2x + 7 and q(x) = x² − 3, find the value of p(4) + q(−3).": {
        "expr": "(−2(4) + 7) + ((−3)² − 3)", "why": "Put 4 in for x in p, and −3 in for x in q. Then add the two outputs.",
        "story": [["p(4)", "−2(4) + 7"], ["q(−3)", "(−3)² − 3"]]},
    "A tank drains according to V(t) = 120 − 4.5t, where V is gallons remaining after t minutes. How much water has drained out of the tank between t = 4 and t = 12?": {
        "expr": "(120 − 4.5 × 4) − (120 − 4.5 × 12)", "why": "Find what's left at t = 4 and at t = 12. What drained out is the first amount minus the second.",
        "story": [["t = 4", "4"], ["t = 12", "12"], ["120 − 4.5t", "120"]]},
    # Week 6 gaps: 8.25
    "Triangle JKL is divided into two smaller triangles, JKM and LKM, by drawing segment KM from vertex K to point M on side JL. Angle J measures 42°, angle JKM measures 53°, and angle L measures 61°. What is the measure of angle LKM?": {
        "expr": "(180 − 42 − 61) − 53", "why": "The angles of the big triangle JKL add up to 180°, so angle K = 180 − 42 − 61. Segment KM splits angle K into JKM and LKM, so take away 53.",
        "story": [["42°", "42"], ["61°", "61"], ["53°", "53"]]},
    "In a figure, parallel lines AB and CD are intersected by two transversals that meet at point E on line CD, forming a triangle. If the angle at A is 52 degrees and the angle at B is 71 degrees, what is the interior angle at E inside the triangle?": {
        "expr": "180 − (52 + 71)", "why": "The three angles of a triangle add up to 180°. Take the two known angles away from 180.",
        "story": [["52 degrees", "52"], ["71 degrees", "71"]]},
    "A zig-zag path between two parallel walls forms an interior 'elbow' angle pointing left. The top segment makes a 35-degree angle with the top wall, and the bottom segment makes a 42-degree angle with the bottom wall. By drawing an auxiliary parallel line through the vertex of the elbow, find the measure of the acute elbow angle.": {
        "expr": "35 + 42", "why": "The line through the elbow, parallel to the walls, splits the elbow into two pieces. Each piece is an alternate interior angle with one wall, so the pieces are 35° and 42°. Add them.",
        "story": [["35-degree", "35"], ["42-degree", "42"]]},
    # Week 6 gaps: Alg I.11
    "Hall A charges §300 plus §8 per student. Hall B charges a flat §1,100 for up to 150 students. For how many students n (up to 150) is Hall B cheaper?": {
        "eq": "300 + 8n > 1100", "var": "the number of students",
        "why": "Hall A costs 300 + 8n. Hall B is cheaper when Hall A costs more than §1,100.",
        "story": [["§300", "300"], ["§8 per student", "8n"], ["§1,100", "1100"]],
        "end": "n is a whole number of students, up to 150. So Hall B is cheaper for 101 to 150 students."},
    "A culture of 100 bacteria doubles every hour. Which equation models the time t in hours when the population reaches 3,200?": {
        "write": "100(2)^t = 3200", "var": "the number of hours",
        "why": "Doubling every hour multiplies by 2 each hour, so after t hours there are 100 × 2 × 2 × … = 100(2)^t bacteria. That has to reach 3,200.",
        "story": [["100 bacteria", "100"], ["doubles", "2"], ["3,200", "3200"]]},
    "A car purchased for §20,000 loses 10% of its value each year. Which equation can be solved to find the number of years t until the car is worth §14,580?": {
        "write": "20000(0.9)^t = 14580", "var": "the number of years",
        "why": "Losing 10% each year leaves 90% of the value: 1 − 0.10 = 0.9. After t years the car is worth 20000(0.9)^t, and that has to equal §14,580.",
        "story": [["§20,000", "20000"], ["loses 10%", "0.9"], ["§14,580", "14580"]]},
    "A machine fills bags of flour with a target weight of 500 grams. Bags are acceptable if their actual weight w is within 4 grams of the target weight. Which inequality represents all acceptable weights?": {
        "write": "|w − 500| ≤ 4", "var": "the actual weight",
        "why": "How far w is from 500 is |w − 500|. Within 4 grams means that distance is 4 or less.",
        "story": [["target weight of 500 grams", "500"], ["within 4 grams", "4"]]},
    # Week 6 gaps: 7.6, a perimeter in factored form
    "A rectangle has length (2.5x + 4) meters and width (1.5x − 1) meters. Which factored expression represents its perimeter?": {
        "simp": "(2.5x + 4) + (1.5x − 1)", "var": "the unknown in the side lengths", "wrap": 2,
        "why": "A rectangle's perimeter is 2 times (length + width). Add the length and width first.",
        "wrapWhy": "The perimeter is 2 times that sum. Keep it in factored form: 2 in front, the sum in parentheses.",
        "story": [["(2.5x + 4) meters", "2.5x"], ["(1.5x − 1) meters", "1.5x"]]},
    # Week 6 gaps: Alg I.11, area and height by factoring
    "A rectangle's length is 3 more than its width. Its area is 40. Write and solve an equation for the width.": {
        "quad": "w(w + 3) = 40", "var": "the width", "keep": "positive",
        "why": "Call the width w. The length is 3 more, w + 3. Area is width × length, so w(w + 3) = 40.",
        "story": [["3 more than its width", "w + 3"], ["area is 40", "40"]],
        "keepWhy": "A width can't be negative, so w = 5. The length is 5 + 3 = 8."},
    "A rectangular garden has a length that is 5 meters longer than its width w. If the area of the garden is 84 square meters, write and solve an equation to find the width of the garden.": {
        "quad": "w(w + 5) = 84", "var": "the width", "keep": "positive",
        "why": "The width is w, so the length is w + 5. Area is width × length, so w(w + 5) = 84.",
        "story": [["5 meters longer than its width w", "w + 5"], ["84 square meters", "84"]],
        "keepWhy": "A width can't be negative, so the width is 7 meters."},
    "A rocket's height is h = −16t² + 96t + 40 (feet, t seconds). When is the rocket 148 feet high?": {
        "quad": "−16t² + 96t + 40 = 148", "var": "the time in seconds",
        "why": "The height is −16t² + 96t + 40. Set it equal to 148 and solve for t.",
        "story": [["h = −16t² + 96t + 40", "−16t² + 96t + 40"], ["148 feet", "148"]],
        "keepWhy": "Both times work. The rocket passes 148 feet on the way up, then again on the way down.",
        "labels": ["on the way up", "on the way down"]},
    "A population of 200 doubles every year. Write an equation for when it reaches 3,200 and solve it.": {
        "grow": "200 · 2^t = 3200", "var": "the number of years",
        "why": "Doubling every year multiplies by 2 each year, so after t years the population is 200 · 2^t. It has to reach 3,200.",
        "story": [["200", "200"], ["doubles every year", "2"], ["3,200", "3200"]]},
    # Week 6 gaps: Alg I.11, absolute value
    "A metal rod is cut to a length of 24 cm, but any rod whose length L differs from 24 cm by more than 0.15 cm must be rejected. Write an absolute value inequality representing the lengths of rejected rods and solve it.": {
        "eq": "|L − 24| > 0.15", "var": "the rod's length",
        "why": "How far L is from 24 is |L − 24|. A rejected rod is more than 0.15 cm away, so |L − 24| > 0.15.",
        "story": [["a length of 24 cm", "24"], ["more than 0.15 cm", "0.15"]]},
}
