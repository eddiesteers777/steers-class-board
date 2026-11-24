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
    # Batch 1: 7.9, equations and inequalities from stories
    "A bowling alley charges §4.50 for shoe rental plus §3.75 per game. If Jordan spends §19.50 total, how many games did Jordan bowl?": {
        "eq": "4.50 + 3.75g = 19.50", "var": "the number of games",
        "why": "What Jordan spends = the shoe rental + §3.75 for each game, g.",
        "story": [["§4.50 for shoe rental", "4.50"], ["§3.75 per game", "3.75g"], ["§19.50 total", "19.50"]]},
    "A rectangle has a perimeter of 54 cm. Its width is 9 cm and its length is (x + 5) cm. What is the value of x?": {
        "eq": "2(9) + 2(x + 5) = 54", "var": "the number in the length",
        "why": "Perimeter = 2 widths + 2 lengths. The width is 9 and the length is x + 5.",
        "story": [["perimeter of 54 cm", "54"], ["width is 9 cm", "2(9)"], ["(x + 5) cm", "2(x + 5)"]]},
    "Kira has §85 to spend on school supplies. She buys a §22 backpack and some notebooks that cost §4.50 each. What is the maximum number of notebooks she can buy?": {
        "eq": "22 + 4.50n ≤ 85", "var": "the number of notebooks", "whole": "notebooks",
        "why": "The backpack plus §4.50 for each notebook, n, can be at most §85, so use ≤.",
        "story": [["§85 to spend", "85"], ["§22 backpack", "22"], ["§4.50 each", "4.50n"]]},
    "A freight elevator has a maximum weight limit of 1,200 pounds. The operator weighs 185 pounds, and each crate weighs 65 pounds. Which inequality and interpretation are correct for the number of crates c?": {
        "eq": "65c + 185 ≤ 1200", "var": "the number of crates", "whole": "crates",
        "why": "The crates weigh 65c, plus the operator. The total can be at most 1,200 pounds, so use ≤.",
        "story": [["maximum weight limit of 1,200 pounds", "1200"], ["185 pounds", "185"], ["each crate weighs 65 pounds", "65c"]]},
    # Batch 1: 7.1, unit rates with fractions
    "Maria walks {1/2} mile in {1/4} hour. How many miles does she walk per hour?": {
        "expr": "{1/2} ÷ {1/4}", "why": "Miles per hour means miles ÷ hours.", "story": [["{1/2} mile", "{1/2}"], ["{1/4} hour", "{1/4}"]]},
    "A recipe uses {3/4} cup of sugar for every {1/2} cup of flour. How many cups of sugar per 1 cup of flour?": {
        "expr": "{3/4} ÷ {1/2}", "why": "Sugar per cup of flour means cups of sugar ÷ cups of flour.", "story": [["{3/4} cup of sugar", "{3/4}"], ["{1/2} cup of flour", "{1/2}"]]},
    "Jamal mows {2/3} of a lawn in {1/6} hour. How many lawns can he mow per hour?": {
        "expr": "{2/3} ÷ {1/6}", "why": "Lawns per hour means lawns ÷ hours.", "story": [["{2/3} of a lawn", "{2/3}"], ["{1/6} hour", "{1/6}"]]},
    "A car goes 150 miles on 6 gallons of gas. What is the unit rate in miles per gallon?": {
        "expr": "150 ÷ 6", "why": "Miles per gallon means miles ÷ gallons.", "story": [["150 miles", "150"], ["6 gallons", "6"]]},
    "A 12-ounce bag of chips costs §3.00. What is the price per ounce?": {
        "expr": "3.00 ÷ 12", "why": "Price per ounce means the price ÷ the ounces.", "story": [["12-ounce", "12"], ["§3.00", "3.00"]]},
    "A painter covers {3/5} of a wall in {3/4} hour. What fraction of the wall does she paint per hour?": {
        "expr": "{3/5} ÷ {3/4}", "why": "Wall per hour means the part of the wall ÷ hours.", "story": [["{3/5} of a wall", "{3/5}"], ["{3/4} hour", "{3/4}"]]},
    "A snail crawls {1/8} foot in {1/3} minute. How many feet does it crawl per minute?": {
        "expr": "{1/8} ÷ {1/3}", "why": "Feet per minute means feet ÷ minutes.", "story": [["{1/8} foot", "{1/8}"], ["{1/3} minute", "{1/3}"]]},
    "A garden of {5/6} square yard needs {1/3} bag of soil. How many square yards does 1 bag cover?": {
        "expr": "{5/6} ÷ {1/3}", "why": "Square yards per bag means square yards ÷ bags.", "story": [["{5/6} square yard", "{5/6}"], ["{1/3} bag", "{1/3}"]]},
    "Kai runs 2{1/2} miles in {1/3} hour. What is his speed in miles per hour?": {
        "expr": "2{1/2} ÷ {1/3}", "why": "Miles per hour means miles ÷ hours.", "story": [["2{1/2} miles", "2{1/2}"], ["{1/3} hour", "{1/3}"]]},
    "A snail crawls {3/4} meter in {1/2} hour. What is its speed in meters per hour?": {
        "expr": "{3/4} ÷ {1/2}", "why": "Meters per hour means meters ÷ hours.", "story": [["{3/4} meter", "{3/4}"], ["{1/2} hour", "{1/2}"]]},
    "A baker uses {2/3} cup of oats for {1/6} of a batch of granola. How many cups of oats are needed for 1 full batch?": {
        "expr": "{2/3} ÷ {1/6}", "why": "Cups per batch means cups ÷ batches.", "story": [["{2/3} cup of oats", "{2/3}"], ["{1/6} of a batch", "{1/6}"]]},
    "A printer prints {1/2} of a poster in {1/8} minute. At this rate, how many posters does it print per minute?": {
        "expr": "{1/2} ÷ {1/8}", "why": "Posters per minute means posters ÷ minutes.", "story": [["{1/2} of a poster", "{1/2}"], ["{1/8} minute", "{1/8}"]]},
    "A gardener spreads {3/5} bag of mulch over {3/10} of a flower bed. How many bags of mulch are needed to cover the entire flower bed?": {
        "expr": "{3/5} ÷ {3/10}", "why": "Bags per whole bed means bags ÷ the part of the bed.", "story": [["{3/5} bag of mulch", "{3/5}"], ["{3/10} of a flower bed", "{3/10}"]]},
    "A tile installer covers 4{1/2} square feet of wall in {3/4} hour. What is the installer's rate in square feet per hour?": {
        "expr": "4{1/2} ÷ {3/4}", "why": "Square feet per hour means square feet ÷ hours.", "story": [["4{1/2} square feet", "4{1/2}"], ["{3/4} hour", "{3/4}"]]},
    "A cyclist rides 5{1/4} miles in {3/8} hour. What is the cyclist's unit rate in miles per hour?": {
        "expr": "5{1/4} ÷ {3/8}", "why": "Miles per hour means miles ÷ hours.", "story": [["5{1/4} miles", "5{1/4}"], ["{3/8} hour", "{3/8}"]]},
    "A mural artist paints a rectangular section measuring 2{1/2} feet by 3{1/5} feet in {2/3} hour. At this rate, how many square feet does the artist paint per hour?": {
        "expr": "(2{1/2} × 3{1/5}) ÷ {2/3}", "why": "First the area: length × width. Then square feet per hour means square feet ÷ hours.", "story": [["2{1/2} feet", "2{1/2}"], ["3{1/5} feet", "3{1/5}"], ["{2/3} hour", "{2/3}"]]},
    "Pump X fills 1{3/4} gallons in {5/6} minute. Pump Y fills 2{1/4} gallons in 1{1/8} minutes. How many more gallons per minute does the faster pump fill?": {
        "why": "Each pump's rate is gallons ÷ minutes.", "story": [["1{3/4} gallons in {5/6} minute", "1{3/4} ÷ {5/6}"], ["2{1/4} gallons in 1{1/8} minutes", "2{1/4} ÷ 1{1/8}"]],
        "rates": {"per": "gallons ÷ minutes", "pick": "high", "word": "faster", "diff": True, "diffOnly": True, "rates": [{"label": "Pump X", "top": "1{3/4}", "bot": "{5/6}"}, {"label": "Pump Y", "top": "2{1/4}", "bot": "1{1/8}"}]}},
    # Batch 1: 7.2, proportional relationships
    "Tickets cost §8 each. Write an equation for the total cost c of t tickets.": {
        "write": "c = 8t", "var": "the number of tickets", "why": "Each ticket costs §8, so t tickets cost 8 times t.", "story": [["§8 each", "8t"]]},
    "y = 4.5x. What is the unit rate?": {"prop": {"ask": "fromEq", "eq": "y = 4.5x", "k": "4.5"}},
    "The equation y = 6.5x represents the cost y in dollars for x pounds of peaches. What is the constant of proportionality?": {"prop": {"ask": "fromEq", "eq": "y = 6.5x", "k": "6.5", "unit": "pound"}},
    "A proportional graph of earnings (y) for hours worked (x) passes through (6, 81). How much is earned per hour?": {
        "prop": {"pts": [["6", "81"]], "ask": "k", "unit": "hour", "dec": True}},
    "A machine bottles 54 liters of juice in 12 minutes at a constant rate. Which equation relates the liters of juice y to the time in minutes x?": {
        "why": "54 liters in 12 minutes is the point (12, 54): x is minutes, y is liters.", "story": [["54 liters", "54"], ["12 minutes", "12"]],
        "prop": {"pts": [["12", "54"]], "ask": "eq", "unit": "minute", "dec": True}},
    "A recipe uses {3/4} cup of cocoa powder for every 2{1/2} cups of flour. Which equation relates cups of cocoa powder c to cups of flour f?": {
        "why": "{3/4} cup of cocoa goes with 2{1/2} cups of flour, the pair (2{1/2}, {3/4}): f first, then c.", "story": [["{3/4} cup of cocoa powder", "{3/4}"], ["2{1/2} cups of flour", "2{1/2}"]],
        "prop": {"pts": [["2{1/2}", "{3/4}"]], "ask": "eq", "v": "f", "fy": "c", "unit": "cup of flour", "dec": True}},
    "On a graph of a proportional relationship between cups of blue paint (x) and cups of yellow paint (y), the point (4, 6) is plotted. Which point must also lie on the graph, and what does it represent?": {
        "prop": {"pts": [["4", "6"]], "ask": "unit", "unit": "cup of blue paint", "dec": True, "unitWhy": "At x = 1 cup of blue paint, y = k = 1.5 cups of yellow paint. That's the unit rate."}},
    # Batch 1: 8.16, linear functions from stories and points
    "A pool has 500 gallons and drains 20 gallons a minute. Write a function for the gallons left.": {
        "why": "The pool starts at 500 gallons and loses 20 each minute.", "story": [["500 gallons", "500"], ["drains 20 gallons a minute", "−20"]],
        "line": {"m": "−20", "b": "500", "bFirst": True, "mWhy": "It drains 20 gallons each minute, so the rate of change is −20.", "bWhy": "It starts with 500 gallons, so b = 500.", "eqWhy": "Gallons left = the 500 it starts with, minus 20 for each minute x."}},
    "A candle is 12 in tall and burns 1.5 in per hour. Write a function for its height h after t hours.": {
        "why": "The candle starts at 12 inches and gets 1.5 inches shorter each hour.", "story": [["12 in tall", "12"], ["burns 1.5 in per hour", "−1.5"]],
        "line": {"m": "−1.5", "b": "12", "v": "t", "fy": "h", "bFirst": True, "mWhy": "It burns 1.5 inches each hour, so the rate of change is −1.5.", "bWhy": "It starts 12 inches tall, so b = 12.", "eqWhy": "Height = the 12 inches it starts with, minus 1.5 for each hour t."}},
    "A phone costs §40 a month plus §100 for the phone. What are the rate of change and initial value?": {
        "why": "The cost goes up §40 every month. The §100 is paid once, at the start.", "story": [["§40 a month", "40"], ["§100 for the phone", "100"]],
        "line": {"m": "40", "b": "100", "ask": "mb", "mWhy": "§40 each month is the rate of change.", "bWhy": "§100 at the start, before any months, is the initial value."}},
    "A savings account starts with §50 and increases by §20 each week. What is the initial value and rate of change of this linear function?": {
        "why": "The account starts at §50 and goes up §20 every week.", "story": [["starts with §50", "50"], ["§20 each week", "20"]],
        "line": {"m": "20", "b": "50", "ask": "mb", "mWhy": "§20 each week is the rate of change.", "bWhy": "§50 at the start is the initial value."}},
    "Write a linear function y = mx + b for a line with a rate of change of 4 and an initial value of −6.": {
        "why": "The rate of change is m and the initial value is b.", "story": [["rate of change of 4", "4"], ["initial value of −6", "−6"]],
        "line": {"m": "4", "b": "−6", "mWhy": "The rate of change is m, so m = 4.", "bWhy": "The initial value is b, so b = −6."}},
    "A pool is being drained at a constant rate. After 2 hours, there are 8,500 gallons left. After 6 hours, there are 5,500 gallons left. Find and interpret the rate of change.": {
        "why": "Each time and amount is a point (hours, gallons).", "story": [["After 2 hours", "2"], ["8,500 gallons", "8500"], ["After 6 hours", "6"], ["5,500 gallons", "5500"]],
        "line": {"pts": [["2", "8500"], ["6", "5500"]], "ask": "m", "end": "It's negative, so the pool loses 750 gallons each hour."}},
    "A banquet hall charges a flat rental fee plus a fixed price per guest. For 20 guests, the total cost is §750. For 50 guests, the total cost is §1,500. Construct the linear function C(g) for g guests.": {
        "why": "Each number of guests and cost is a point (guests, cost).", "story": [["20 guests", "20"], ["§750", "750"], ["50 guests", "50"], ["§1,500", "1500"]],
        "line": {"pts": [["20", "750"], ["50", "1500"]], "v": "g", "fy": "C(g)"}},
    "An airplane descends at a steady rate. At 4 minutes into its descent, its altitude is 26,000 feet. At 10 minutes, its altitude is 17,000 feet. How many minutes after starting its descent will the airplane land (altitude = 0 feet)?": {
        "why": "Each time and altitude is a point (minutes, feet).", "story": [["4 minutes", "4"], ["26,000 feet", "26000"], ["10 minutes", "10"], ["17,000 feet", "17000"]],
        "line": {"pts": [["4", "26000"], ["10", "17000"]], "ask": "zero", "v": "t", "zeroTitle": "Find when the altitude is 0", "zeroWhy": "Landing means altitude 0. Set the function equal to 0, add 1500t to both sides, then divide by 1,500."}},
    # Batch 1: 8.15, comparing functions
    "Function A: y = 3x + 2. Function B goes through (0, 5) and (2, 9). Which has the greater rate of change?": {
        "cmp": {"ask": "m", "fns": [{"label": "Function A", "eq": "y = 3x + 2", "m": "3", "b": "2"}, {"label": "Function B", "pts": [["0", "5"], ["2", "9"]]}]}},
    "Function A: y = 3x + 2. Function B goes through (0, 5) and (2, 9). Which has the greater y-intercept?": {
        "cmp": {"ask": "b", "fns": [{"label": "Function A", "eq": "y = 3x + 2", "m": "3", "b": "2"}, {"label": "Function B", "pts": [["0", "5"], ["2", "9"]]}]}},
    "Ana saves §10 a week starting with §25. Ben's savings are y = 12x. Who saves faster each week?": {
        "why": "Saving faster means more money each week: the bigger rate of change.", "story": [["§10 a week", "10"], ["starting with §25", "25"], ["y = 12x", "12"]],
        "cmp": {"ask": "m", "fns": [{"label": "Ana", "m": "10", "b": "25", "why": "Ana adds §10 each week, so m = 10. She starts with §25."}, {"label": "Ben", "eq": "y = 12x", "m": "12", "b": "0"}]}},
    "Function A is y = 3x + 4. Function B has a slope of 5 and a y-intercept of 2. Which function has the greater y-intercept?": {
        "cmp": {"ask": "b", "fns": [{"label": "Function A", "eq": "y = 3x + 4", "m": "3", "b": "4"}, {"label": "Function B", "m": "5", "b": "2", "why": "Function B's slope is 5 and its y-intercept is 2."}]}},
    "Linear Function 1 is y = −2x + 8. Linear Function 2 is shown in a table: (0, 6), (2, 0), (4, −6). Which function has a steeper negative slope?": {
        "cmp": {"ask": "steep", "fns": [{"label": "Linear Function 1", "eq": "y = −2x + 8", "m": "−2", "b": "8"}, {"label": "Linear Function 2", "pts": [["0", "6"], ["2", "0"]]}]}},
    "Function P is represented by y = 4x − 3. Function Q is a linear function passing through (1, 3) and (3, 11). Compare their slopes and y-intercepts.": {
        "cmp": {"ask": "both", "fns": [{"label": "Function P", "eq": "y = 4x − 3", "m": "4", "b": "−3"}, {"label": "Function Q", "pts": [["1", "3"], ["3", "11"]]}]}},
    "A table shows the points (2, 10), (5, 19), and (9, k). What value of k makes this a linear function, and why would any other value of k make it non-linear?": {
        "line": {"pts": [["2", "10"], ["5", "19"]], "ask": "at", "at": "9", "atName": "k", "end": "Any other k would change the rate of change, so the points would not be on one line."}},
    "Function A is y = 0.5x + 6. Function B is described verbally: 'Start at 10 and decrease by 1.5 for every unit increase in x.' At what x-value do both functions produce the same output?": {
        "eq": "0.5x + 6 = 10 − 1.5x", "var": "the input",
        "why": "Function B starts at 10 and goes down 1.5 each time, so it is y = 10 − 1.5x. The same output means the two rules are equal.",
        "story": [["y = 0.5x + 6", "0.5x + 6"], ["Start at 10", "10"], ["decrease by 1.5", "1.5x"]]},
    # Batch 1: 7.1, which is the better buy
    "Store A sells 8 pencils for §2.00. Store B sells 12 pencils for §2.76. Which store has the lower price per pencil?": {
        "why": "Price per pencil means the price ÷ the number of pencils.", "story": [["8 pencils for §2.00", "2.00 ÷ 8"], ["12 pencils for §2.76", "2.76 ÷ 12"]],
        "rates": {"per": "price ÷ pencils", "rates": [{"label": "Store A", "top": "2.00", "bot": "8"}, {"label": "Store B", "top": "2.76", "bot": "12"}]}},
    "Brand A sells {2/3} pound of almonds for §4.80. Brand B sells {3/4} pound of almonds for §5.70. Which brand has the lower unit price per pound, and by how much?": {
        "why": "Price per pound means the price ÷ the pounds.", "story": [["{2/3} pound of almonds for §4.80", "4.80 ÷ {2/3}"], ["{3/4} pound of almonds for §5.70", "5.70 ÷ {3/4}"]],
        "rates": {"per": "price ÷ pounds", "diff": True, "rates": [{"label": "Brand A", "top": "4.80", "bot": "{2/3}"}, {"label": "Brand B", "top": "5.70", "bot": "{3/4}"}]}},
    # Batch 2: 8.7 to 8.10, proportional or not, slope, comparing
    "A taxi charges §3 plus §2 a mile. Is the cost proportional to the miles?": {
        "why": "The cost starts at §3 before any miles, then goes up §2 each mile.", "story": [["§3", "3"], ["§2 a mile", "2"]],
        "line": {"m": "2", "b": "3", "ask": "prop", "mWhy": "§2 each mile is the rate of change.", "bWhy": "At 0 miles you still pay §3, so b = 3."}},
    "Apples cost §1.50 a pound with no other fees. Is the cost proportional to the pounds?": {
        "why": "The cost goes up §1.50 each pound, and with no other fees, 0 pounds cost §0.", "story": [["§1.50 a pound", "1.5"], ["no other fees", "0"]],
        "line": {"m": "1.50", "b": "0", "ask": "prop", "mWhy": "§1.50 each pound is the rate of change.", "bWhy": "No other fees, so 0 pounds cost §0: b = 0."}},
    "A car travels 180 miles in 3 hours at a constant rate. What is the slope of the distance-time graph? What does it mean?": {
        "why": "180 miles in 3 hours is the point (3, 180): hours across, miles up.", "story": [["180 miles", "180"], ["3 hours", "3"]],
        "prop": {"pts": [["3", "180"]], "ask": "k", "unit": "hour", "kWhy": "The graph starts at (0, 0), so the slope is miles ÷ hours.", "end": "The slope is the speed: 60 miles each hour."}},
    "A proportional graph of earnings shows (8, 96) for 8 hours. Write the equation.": {
        "prop": {"pts": [["8", "96"]], "ask": "eq", "unit": "hour"}},
    "A cyclist rides at a constant speed. The graph of distance in miles (y) versus time in hours (x) passes through the origin and the point (3, 45). Write the equation that represents this relationship and interpret the slope.": {
        "prop": {"pts": [["3", "45"]], "ask": "eq", "unit": "hour", "end": "The slope 15 means the cyclist rides 15 miles each hour."}},
    "Two workers: Ana's graph is y = 14x; Ben earns §45 in 3 hours. Who earns more per hour?": {
        "why": "Per hour is the rate of change: dollars ÷ hours.", "story": [["y = 14x", "14"], ["§45 in 3 hours", "45 ÷ 3"]],
        "cmp": {"ask": "m", "fns": [{"label": "Ana", "eq": "y = 14x", "m": "14", "b": "0"}, {"label": "Ben", "pts": [["0", "0"], ["3", "45"]]}]}},
    "Line A represents y = 3x and Line B represents y = {5/2}x. If both are graphed on the same coordinate plane, which line is steeper and why?": {
        "cmp": {"ask": "steep", "fns": [{"label": "Line A", "eq": "y = 3x", "m": "3", "b": "0"}, {"label": "Line B", "eq": "y = 5/2x", "m": "{5/2}", "b": "0", "why": "Line B is y = 5/2 x, so its slope is 5/2 = 2.5."}]}},
    "A plumber charges §50 to come out plus §40 an hour. Write the cost as y = mx + b.": {
        "why": "§50 once, at the start, then §40 for each hour.", "story": [["§50 to come out", "50"], ["§40 an hour", "40"]],
        "line": {"m": "40", "b": "50", "mWhy": "§40 each hour is the slope, m = 40.", "bWhy": "§50 before any hours is the y-intercept, b = 50."}},
    "A taxi charges a §3 initial fee plus §2 per mile. Which equation models the total cost y for x miles?": {
        "why": "§3 once, at the start, then §2 for each mile.", "story": [["§3 initial fee", "3"], ["§2 per mile", "2"]],
        "line": {"m": "2", "b": "3", "mWhy": "§2 each mile is the slope, m = 2.", "bWhy": "§3 before any miles is the y-intercept, b = 3."}},
    "On a non-vertical line, right triangle ABC is drawn with vertical leg 6 and horizontal leg 4. Another right triangle DEF is drawn on the same line with horizontal leg 10. What is the length of the vertical leg of triangle DEF?": {
        "why": "Both triangles sit on the same line, so they are similar: vertical ÷ horizontal is the slope, the same for both.", "story": [["vertical leg 6", "6"], ["horizontal leg 4", "4"], ["horizontal leg 10", "10"]],
        "prop": {"pts": [["4", "6"]], "ask": "atx", "x": "10", "v": "run", "fy": "rise", "kWhy": "Slope = rise ÷ run = 6 ÷ 4. The second triangle has the same slope."}},
    "Line A goes through (0, 2) and (1, 5). Line B goes through (0, −1) and (2, 5). Do they have the same slope? Do they have the same y-intercept?": {
        "cmp": {"ask": "both", "fns": [{"label": "Line A", "pts": [["0", "2"], ["1", "5"]]}, {"label": "Line B", "pts": [["0", "−1"], ["2", "5"]]}]}},
    "Line 1 passes through (0, 2) and (3, 8). Line 2 passes through (0, −4) and (3, 2). How do the graphs of Line 1 and Line 2 compare?": {
        "cmp": {"ask": "both", "bNums": False, "fns": [{"label": "Line 1", "pts": [["0", "2"], ["3", "8"]]}, {"label": "Line 2", "pts": [["0", "−4"], ["3", "2"]]}]}},
    "Set A contains points (1, 5) and (4, 14). Set B contains points (−2, −10) and (2, 2). Do the lines through Set A and Set B have the same slope? What are their y-intercepts?": {
        "cmp": {"ask": "both", "fns": [{"label": "Set A", "pts": [["1", "5"], ["4", "14"]]}, {"label": "Set B", "pts": [["−2", "−10"], ["2", "2"]]}]}},
    "Plan A: y = 8x. Plan B costs §20 plus §5 per month. Which costs less for 4 months?": {
        "why": "Plan B starts at §20 and adds §5 a month, so it is y = 5x + 20.", "story": [["y = 8x", "8x"], ["§20 plus §5 per month", "5x + 20"], ["4 months", "4"]],
        "cmp": {"ask": "atLow", "at": "4", "atWhat": "4 months", "fns": [{"label": "Plan A", "eq": "y = 8x", "m": "8", "b": "0"}, {"label": "Plan B", "eq": "y = 5x + 20", "m": "5", "b": "20"}]}},
    "Plan A: y = 8x. Plan B: y = 5x + 20. After how many months do they cost the same?": {
        "eq": "8x = 5x + 20", "var": "the number of months", "why": "The same cost means Plan A's cost equals Plan B's cost.", "story": [["y = 8x", "8x"], ["y = 5x + 20", "5x + 20"]]},
    "Car A: y = 55x (miles in x hours). Car B travels 240 miles in 4 hours. Which car is faster?": {
        "why": "Faster means more miles each hour: the bigger rate of change.", "story": [["y = 55x", "55"], ["240 miles in 4 hours", "240 ÷ 4"]],
        "cmp": {"ask": "m", "fns": [{"label": "Car A", "eq": "y = 55x", "m": "55", "b": "0"}, {"label": "Car B", "pts": [["0", "0"], ["4", "240"]]}]}},
    "Gym A: §30 a month. Gym B: §60 to join plus §20 a month. Which costs less for 12 months?": {
        "why": "Gym A is 30x. Gym B starts at §60 and adds §20 a month: 20x + 60.", "story": [["§30 a month", "30x"], ["§60 to join plus §20 a month", "20x + 60"], ["12 months", "12"]],
        "cmp": {"ask": "atLow", "at": "12", "atWhat": "12 months", "fns": [{"label": "Gym A", "m": "30", "b": "0", "why": "Gym A costs §30 each month and nothing to join: m = 30, b = 0."}, {"label": "Gym B", "m": "20", "b": "60", "why": "Gym B costs §20 each month plus §60 to join: m = 20, b = 60."}]}},
    "Which has the greater rate of change: y = 2.5x + 4 or a line through (0, 0) and (2, 6)?": {
        "cmp": {"ask": "m", "fns": [{"label": "y = 2.5x + 4", "eq": "y = 2.5x + 4", "m": "2.5", "b": "4"}, {"label": "The line through (0, 0) and (2, 6)", "pts": [["0", "0"], ["2", "6"]]}]}},
    "Phone plan A: §0.10 per text. Plan B: §5 a month plus §0.05 per text. Which costs less for 200 texts?": {
        "why": "Plan A is 0.10 for each text. Plan B is §5 plus 0.05 for each text.", "story": [["§0.10 per text", "0.10x"], ["§5 a month plus §0.05 per text", "0.05x + 5"], ["200 texts", "200"]],
        "cmp": {"ask": "atLow", "at": "200", "atWhat": "200 texts", "fns": [{"label": "Plan A", "m": "0.10", "b": "0", "why": "Plan A: §0.10 each text, nothing else. m = 0.1, b = 0."}, {"label": "Plan B", "m": "0.05", "b": "5", "why": "Plan B: §0.05 each text plus §5. m = 0.05, b = 5."}]}},
    "Plan A is modeled by y = 12x. Plan B is modeled by y = 8x + 20. Which plan costs less for x = 3?": {
        "cmp": {"ask": "atLow", "at": "3", "fns": [{"label": "Plan A", "eq": "y = 12x", "m": "12", "b": "0"}, {"label": "Plan B", "eq": "y = 8x + 20", "m": "8", "b": "20"}]}},
    "Function 1 is y = 5x + 1. Function 2 is shown in a table: (0, 0), (2, 12), (4, 24). Which function has a greater rate of change?": {
        "cmp": {"ask": "m", "fns": [{"label": "Function 1", "eq": "y = 5x + 1", "m": "5", "b": "1"}, {"label": "Function 2", "pts": [["0", "0"], ["2", "12"]]}]}},
    "Store A sells notebooks for §2.50 each with no membership fee. Store B charges a §10 membership fee and sells notebooks for §1.50 each. For what number of notebooks is the total cost the same at both stores?": {
        "eq": "2.50n = 10 + 1.50n", "var": "the number of notebooks", "why": "Store A costs 2.50n. Store B costs §10 plus 1.50n. The same cost means they are equal.",
        "story": [["§2.50 each", "2.50n"], ["§10 membership fee", "10"], ["§1.50 each", "1.50n"]]},
    "Runner 1's distance is given by d = 7t (d in meters, t in seconds). Runner 2 starts 12 meters ahead of the starting line and runs at 5 meters per second. Who is farther from the starting line after 8 seconds, and by how much?": {
        "why": "Runner 2 starts at 12 and adds 5 each second: d = 5t + 12.", "story": [["d = 7t", "7t"], ["12 meters ahead", "12"], ["5 meters per second", "5t"], ["8 seconds", "8"]],
        "cmp": {"ask": "atHigh", "at": "8", "atWhat": "8 seconds", "word": "is farther", "diff": True, "fns": [{"label": "Runner 1", "eq": "d = 7t", "m": "7", "b": "0"}, {"label": "Runner 2", "m": "5", "b": "12", "why": "Runner 2 adds 5 meters each second and starts at 12: m = 5, b = 12."}]}},
    "Account 1 starts with §0 and adds §45 per week. Account 2 starts with §180 and adds §30 per week. For which number of weeks w does Account 1 have more money than Account 2?": {
        "eq": "45w > 180 + 30w", "var": "the number of weeks", "why": "Account 1 has 45w. Account 2 has 180 + 30w. More money means Account 1's amount is greater, so use >.",
        "story": [["adds §45 per week", "45w"], ["starts with §180", "180"], ["adds §30 per week", "30w"]]},
    # Batch 2: 8.12, systems from stories
    "Adult tickets are §8 and child tickets are §5. 20 tickets cost §130. How many adult tickets were sold?": {
        "why": "Let a be adult tickets and c child tickets. There are 20 tickets, so a + c = 20, which means c = 20 − a. The money: 8a + 5c = 130.",
        "story": [["Adult tickets are §8", "8a"], ["child tickets are §5", "5c"], ["20 tickets", "a + c = 20"], ["§130", "130"]],
        "sys": {"eqs": ["c = 20 − a", "8a + 5c = 130"], "ask": "a"}},
    "At a school bake sale, 25 items (cookies and brownies) were sold for a total of §40. Cookies cost §1 each and brownies cost §2 each. Using the system c + b = 25 and c + 2b = 40, how many brownies were sold?": {
        "why": "c + b = 25 means c = 25 − b. Put that into c + 2b = 40.",
        "story": [["c + b = 25", "c = 25 − b"], ["c + 2b = 40", "c + 2b = 40"]],
        "sys": {"eqs": ["c = 25 − b", "c + 2b = 40"], "ask": "b"}},
    "Two water tanks are being filled at constant rates starting from empty. On a graph of gallons (y) versus minutes (x), Tank 1's line passes through (4, 18) and Tank 2's line passes through (6, 30). After 10 minutes, how much more water is in Tank 2 than in Tank 1?": {
        "why": "Both start from empty, so both lines go through (0, 0).", "story": [["starting from empty", "(0, 0)"], ["(4, 18)", "(4, 18)"], ["(6, 30)", "(6, 30)"], ["10 minutes", "10"]],
        "cmp": {"ask": "atHigh", "at": "10", "atWhat": "10 minutes", "word": "has more", "diff": True, "diffOnly": True, "fns": [{"label": "Tank 1", "pts": [["0", "0"], ["4", "18"]]}, {"label": "Tank 2", "pts": [["0", "0"], ["6", "30"]]}]}},
    "A recipe uses 2.5 cups of flour for every 4 dozen cookies. If you graph dozens of cookies on the x-axis and cups of flour on the y-axis, what is the slope of the line, and what does the point (10, 6.25) represent?": {
        "why": "2.5 cups for 4 dozen is the point (4, 2.5): dozens across, cups up.", "story": [["2.5 cups of flour", "2.5"], ["4 dozen cookies", "4"]],
        "prop": {"pts": [["4", "2.5"]], "ask": "k", "unit": "dozen", "kWhy": "The line starts at (0, 0), so the slope is cups ÷ dozens.", "end": "The point (10, 6.25) means 10 dozen cookies take 6.25 cups of flour."}},
    "A candle is 14 inches tall when lit and burns at a steady rate of 1.5 inches per hour. Write the linear equation for its height h after t hours, and find how tall the candle is after 6 hours.": {
        "why": "The candle starts at 14 inches and gets 1.5 inches shorter each hour, so the rate is negative.", "story": [["14 inches tall when lit", "14"], ["1.5 inches per hour", "−1.5"], ["6 hours", "6"]],
        "line": {"m": "−1.5", "b": "14", "v": "t", "fy": "h", "at": "6", "atName": "h", "mWhy": "It burns down 1.5 inches each hour, so m = −1.5.", "bWhy": "When it is lit, at t = 0, it is 14 inches, so b = 14."}},
    "Drone A starts on the ground and climbs at 4 meters per second. Drone B starts on a 15-meter roof and climbs at 2.5 meters per second. After how many seconds will both drones be at the same altitude, and what will that altitude be?": {
        "eq": "4t = 15 + 2.5t", "var": "the number of seconds", "why": "Drone A is at 4t meters. Drone B is at 15 + 2.5t meters. The same altitude means they are equal.",
        "story": [["starts on the ground", "0"], ["4 meters per second", "4t"], ["15-meter roof", "15"], ["2.5 meters per second", "2.5t"]],
        "then": [{"label": "Altitude", "expr": "4t"}]},
    "Car Rental 1 is proportional: 3 days cost §135. Car Rental 2 is shown in a table: 2 days cost §110, 4 days cost §180, 6 days cost §250. How much money do you save by choosing the cheaper option for a 5-day rental?": {
        "why": "Rental 1 is proportional, so it goes through (0, 0). Use two rows of the table for Rental 2.", "story": [["3 days cost §135", "(3, 135)"], ["2 days cost §110", "(2, 110)"], ["4 days cost §180", "(4, 180)"], ["5-day rental", "5"]],
        "cmp": {"ask": "atLow", "at": "5", "atWhat": "5 days", "diff": True, "diffOnly": True, "fns": [{"label": "Rental 1", "pts": [["0", "0"], ["3", "135"]]}, {"label": "Rental 2", "pts": [["2", "110"], ["4", "180"]]}]}},
    "Store A: §10 plus §4 a shirt. Store B: §6 a shirt. When do they cost the same? How many shirts and what cost?": {
        "eq": "10 + 4n = 6n", "var": "the number of shirts", "why": "Store A costs 10 + 4n. Store B costs 6n. The same cost means they are equal.",
        "story": [["§10", "10"], ["§4 a shirt", "4n"], ["§6 a shirt", "6n"]],
        "then": [{"label": "Cost", "expr": "6n"}]},
    "A student says the point (3, 7) is the solution to the system y = 2x + 1 and y = 3x − 3. Is the student correct? Explain why or why not.": {
        "sys": {"eqs": ["y = 2x + 1", "y = 3x − 3"], "ask": "pt", "pt": "(3, 7)"}},
    # Batch 2: 7.17, 7.20, 7.22 (scale, circles, area and volume)
    'On a map, 1 inch = 20 miles. Two towns are 3.5 inches apart. How far apart are they?': {'expr': '3.5 × 20', 'formula': '1 inch = 20 miles', 'fWhy': 'Each inch on the map stands for 20 miles, so multiply the inches by 20.', 'fTitle': 'Use the scale'},
    'A scale drawing uses 1 cm : 4 m. A room is 6 cm long on the drawing. How long is the real room?': {'expr': '6 × 4', 'formula': '1 cm = 4 m', 'fWhy': 'Each centimeter on the drawing stands for 4 meters, so multiply by 4.', 'fTitle': 'Use the scale'},
    'A real car is 15 feet long. A model uses 1 inch : 2 feet. How long is the model?': {'expr': '15 ÷ 2', 'formula': '1 inch = 2 feet', 'fWhy': 'Going from real to model, divide: every 2 real feet make 1 inch on the model.', 'fTitle': 'Use the scale'},
    'A blueprint scale is {1/4} inch : 1 foot. A wall is 3 inches on the blueprint. How long is the real wall?': {'expr': '3 × 4', 'formula': ['{1/4} inch = 1 foot', '1 inch = 4 feet'], 'fWhy': 'Four quarter inches make 1 inch, so 1 inch stands for 4 feet. Multiply the blueprint inches by 4.', 'fTitle': 'Use the scale'},
    'A rectangle on a drawing is 2 cm by 3 cm. The scale is 1 cm : 5 m. What is the real area?': {'expr': '(2 × 5) × (3 × 5)', 'formula': ['1 cm = 5 m', 'Area = length × width'], 'fWhy': 'Change each side to real meters first (times 5), then multiply length × width.', 'fTitle': 'Use the scale'},
    'A drawing has a scale of 1 in : 6 ft. You redraw it at 1 in : 3 ft. A 4-inch line becomes how long?': {'expr': '4 × 6 ÷ 3', 'formula': ['1 in = 6 ft', '1 in = 3 ft'], 'fWhy': 'Find the real length first: 4 inches × 6 = 24 feet. Then on the new drawing every 3 feet is 1 inch, so divide by 3.', 'fTitle': 'Use the scale'},
    'What is the scale factor from a 5 cm drawing to a 20 cm drawing?': {'expr': '20 ÷ 5', 'formula': 'Scale factor = new ÷ old', 'fWhy': 'The scale factor is what you multiply the old size by to get the new size, so divide new by old.', 'fTitle': 'Use the scale factor'},
    'On a scale drawing, the scale is 1 inch = 8 feet. A wall measures 4.5 inches on the drawing. What is the actual length of the wall?': {'expr': '4.5 × 8', 'formula': '1 inch = 8 feet', 'fWhy': 'Each inch on the drawing stands for 8 feet, so multiply by 8.', 'fTitle': 'Use the scale'},
    'A map uses the scale 1 cm = 15 km. If two cities are 90 km apart, how far apart are they on the map?': {'expr': '90 ÷ 15', 'formula': '1 cm = 15 km', 'fWhy': 'Going from real to map, divide: every 15 km make 1 cm on the map.', 'fTitle': 'Use the scale'},
    'A square garden has a side length of 3 cm on a scale drawing with a scale of 1 cm = 4 m. What is the actual side length of the garden?': {'expr': '3 × 4', 'formula': '1 cm = 4 m', 'fWhy': 'Each centimeter on the drawing stands for 4 meters, so multiply by 4.', 'fTitle': 'Use the scale'},
    'On a blueprint with a scale of 1 inch = 4 feet, a rectangular bedroom measures 3.5 inches by 5 inches. What is the actual area of the bedroom?': {'expr': '(3.5 × 4) × (5 × 4)', 'formula': ['1 inch = 4 feet', 'Area = length × width'], 'fWhy': 'Change each side to real feet first (times 4), then multiply length × width.', 'fTitle': 'Use the scale'},
    'A triangular flower bed has a base of 4 inches and a height of 3 inches on a scale drawing where 1 inch = 6 feet. What is the actual area of the flower bed?': {'expr': '{1/2} × 24 × 18', 'parts': [{'title': 'Real base', 'expr': '4 × 6', 'is': 24}, {'title': 'Real height', 'expr': '3 × 6', 'is': 18}], 'formula': ['1 inch = 6 feet', 'A = {1/2}bh'], 'fWhy': 'Change the base and height to real feet first (times 6), then use the triangle formula.', 'fTitle': 'Use the scale'},
    'A living room has an area of 15 square centimeters on a floor plan with a scale of 1 cm = 3 m. What is the actual area of the living room?': {'expr': '15 × 3 × 3', 'formula': ['1 cm = 3 m', '1 cm² = 3 m × 3 m = 9 m²'], 'fWhy': 'Area grows in two directions. Each square centimeter on the plan is 3 m by 3 m in real life, which is 9 square meters.', 'fTitle': 'Use the scale'},
    'A circle has a radius of 6 cm. What is its diameter?': {'expr': '2 × 6', 'formula': 'd = 2r', 'fWhy': 'The diameter goes all the way across, so it is two radii.', 'fTitle': 'Use the fact'},
    'Find the circumference of a circle with diameter 10 in. Use 3.14.': {'expr': '3.14 × 10', 'formula': 'C = πd', 'fWhy': 'Circumference = π × diameter. Use 3.14 for π.'},
    'Find the area of a circle with radius 5 ft. Use 3.14.': {'expr': '3.14 × 5 × 5', 'formula': 'A = πr^{2}', 'fWhy': 'Area = π × radius × radius. Use 3.14 for π.'},
    "A circle's circumference is 18.84 cm. Find its radius. Use 3.14.": {'expr': '18.84 ÷ 3.14 ÷ 2', 'formula': ['C = 2πr', 'r = C ÷ π ÷ 2'], 'fWhy': 'C = 2 × π × r, so undo it: divide by π to get the diameter, then by 2 to get the radius.'},
    'A bike wheel has a 26-inch diameter. How far does it roll in one turn? Use 3.14.': {'expr': '3.14 × 26', 'formula': 'C = πd', 'fWhy': "One turn rolls the wheel's whole edge along the ground: the circumference, π × diameter."},
    'A circle has a diameter of 14 cm. Using 3.14 for π, what is its circumference?': {'expr': '3.14 × 14', 'formula': 'C = πd', 'fWhy': 'Circumference = π × diameter.'},
    'A circle has a radius of 4 meters. Using 3.14 for π, what is its area?': {'expr': '3.14 × 4 × 4', 'formula': 'A = πr^{2}', 'fWhy': 'Area = π × radius × radius.'},
    'A circular rug has a diameter of 12 feet. Using 3.14 for π, what is the area of the rug?': {'expr': '3.14 × 6 × 6', 'formula': ['r = 12 ÷ 2 = 6', 'A = πr^{2}'], 'fWhy': 'The area formula uses the radius, half the diameter: 12 ÷ 2 = 6 feet.'},
    'A bicycle wheel has a circumference of 62.8 inches. Using 3.14 for π, what is the radius of the wheel?': {'expr': '62.8 ÷ 3.14 ÷ 2', 'formula': ['C = 2πr', 'r = C ÷ π ÷ 2'], 'fWhy': 'C = 2 × π × r, so undo it: divide by π to get the diameter, then by 2 to get the radius.'},
    'A circular pond with a radius of 7 meters is surrounded by a gravel path that is 3 meters wide, forming a larger circle of radius 10 meters. Using 3.14 for π, what is the area of the gravel path alone?': {'expr': '314 − 153.86', 'parts': [{'title': 'The big circle', 'expr': '3.14 × 100', 'is': 314, 'why': '10 × 10 = 100, then times 3.14.'}, {'title': 'The pond', 'expr': '3.14 × 49', 'is': '153.86', 'why': '7 × 7 = 49, then times 3.14.'}], 'formula': ['A = πr^{2}', 'Path = big circle − pond'], 'fWhy': 'The path is the big circle with the pond taken out, so find both areas and subtract.'},
    'A semicircle has a diameter of 16 cm. Using 3.14 for π, what is the total perimeter of the semicircle (including the straight diameter edge)?': {'expr': '25.12 + 16', 'parts': [{'title': 'Half the curve', 'expr': '3.14 × 16 ÷ 2', 'is': '25.12'}], 'formula': ['C = πd', 'Half the curve + the diameter'], 'fWhy': "The curved part is half a circle's circumference. Then add the straight edge, the diameter."},
    'Find the area of a triangle with base 10 cm and height 7 cm.': {'expr': '{1/2} × 10 × 7', 'formula': 'A = {1/2}bh', 'fWhy': 'A triangle is half of a rectangle with the same base and height.'},
    'Find the area of a trapezoid with bases 6 and 10 and height 4.': {'expr': '{1/2} × (6 + 10) × 4', 'formula': 'A = {1/2}(b_{1} + b_{2})h', 'fWhy': 'Add the two bases, multiply by the height, then take half.'},
    'Find the volume of a rectangular prism 5 in by 3 in by 4 in.': {'expr': '5 × 3 × 4', 'formula': 'V = lwh', 'fWhy': 'Volume = length × width × height.'},
    'Find the surface area of a cube with edges of 3 ft.': {'expr': '6 × 3 × 3', 'formula': 'SA = 6s^{2}', 'fWhy': 'A cube has 6 faces, and each one is a square s × s.'},
    'Find the surface area of a rectangular prism 2 m by 3 m by 4 m.': {'expr': '2 × (6 + 8 + 12)', 'parts': [{'title': 'Find each face', 'expr': '2 × 3', 'is': 6, 'why': 'lw = 2 × 3, lh = 2 × 4 and wh = 3 × 4.'}, {'title': 'Find each face', 'expr': '2 × 4', 'is': 8}, {'title': 'Find each face', 'expr': '3 × 4', 'is': 12}], 'formula': 'SA = 2(lw + lh + wh)', 'fWhy': 'A prism has 3 pairs of matching faces. Find one face of each pair, add them, then double.'},
    'A box is 2.5 ft by 2 ft by 1.5 ft. What is its volume?': {'expr': '2.5 × 2 × 1.5', 'formula': 'V = lwh', 'fWhy': 'Volume = length × width × height.'},
    'A rectangle 8 m by 5 m has a 2 m by 2 m square cut out. What is the remaining area?': {'expr': '40 − 4', 'parts': [{'title': 'The whole rectangle', 'expr': '8 × 5', 'is': 40}, {'title': 'The square cut out', 'expr': '2 × 2', 'is': 4}], 'formula': 'Area left = rectangle − square', 'fWhy': 'Find the whole rectangle, then take away the square that was cut out.', 'fTitle': 'Plan it'},
    'A triangular prism has a base triangle with base 6 and height 4 and a length of 10. What is its volume?': {'expr': '{1/2} × 6 × 4 × 10', 'formula': ['V = Bh', 'B = {1/2}bh'], 'fWhy': 'Volume of a prism = area of the base × its length. The base here is a triangle.'},
    'A room is 12 ft by 10 ft with walls 8 ft tall. How much wall area is there to paint (no windows or doors)?': {'expr': '2 × 96 + 2 × 80', 'parts': [{'title': 'One long wall', 'expr': '12 × 8', 'is': 96}, {'title': 'One short wall', 'expr': '10 × 8', 'is': 80}], 'formula': '2 long + 2 short', 'fWhy': "Four walls: two are 12 ft by 8 ft and two are 10 ft by 8 ft. The floor and ceiling don't count.", 'fTitle': 'Plan it'},
    'Find the area of a regular hexagon split into 6 triangles, each with base 4 and height 3.5.': {'expr': '6 × {1/2} × 4 × 3.5', 'formula': ['A = 6 triangles', 'Each = {1/2}bh'], 'fWhy': 'Find one triangle, then 6 of them.'},
    'What is the area of a triangle with a base of 14 cm and a height of 9 cm?': {'expr': '{1/2} × 14 × 9', 'formula': 'A = {1/2}bh', 'fWhy': 'A triangle is half of a rectangle with the same base and height.'},
    'What is the volume of a right rectangular prism with a length of 8 inches, a width of 5 inches, and a height of 4 inches?': {'expr': '8 × 5 × 4', 'formula': 'V = lwh', 'fWhy': 'Volume = length × width × height.'},
    'What is the surface area of a cube with an edge length of 5 cm?': {'expr': '6 × 5 × 5', 'formula': 'SA = 6s^{2}', 'fWhy': 'A cube has 6 faces, and each one is a square s × s.'},
    'Find the surface area of a right rectangular prism with a length of 6 feet, a width of 4 feet, and a height of 3 feet.': {'expr': '2 × (24 + 18 + 12)', 'parts': [{'title': 'Find each face', 'expr': '6 × 4', 'is': 24, 'why': 'lw = 6 × 4, lh = 6 × 3 and wh = 4 × 3.'}, {'title': 'Find each face', 'expr': '6 × 3', 'is': 18}, {'title': 'Find each face', 'expr': '4 × 3', 'is': 12}], 'formula': 'SA = 2(lw + lh + wh)', 'fWhy': 'A prism has 3 pairs of matching faces. Find one face of each pair, add them, then double.'},
    'A trapezoid has parallel bases measuring 10 meters and 16 meters, and a height of 7 meters. What is its area?': {'expr': '{1/2} × (10 + 16) × 7', 'formula': 'A = {1/2}(b_{1} + b_{2})h', 'fWhy': 'Add the two bases, multiply by the height, then take half.'},
    'A right rectangular prism has a volume of 216 cubic cm, a length of 9 cm, and a width of 4 cm. What is its height?': {'expr': '216 ÷ (9 × 4)', 'formula': ['V = lwh', 'h = V ÷ (lw)'], 'fWhy': 'V = l × w × h, so undo it: divide the volume by length × width.'},
    'An L-shaped patio is made by joining a 12-foot by 5-foot rectangle and a 6-foot by 4-foot rectangle with no overlap. What is the total area of the patio?': {'expr': '60 + 24', 'parts': [{'title': 'Rectangle 1', 'expr': '12 × 5', 'is': 60}, {'title': 'Rectangle 2', 'expr': '6 × 4', 'is': 24}], 'formula': 'Area = rectangle 1 + rectangle 2', 'fWhy': "Find each rectangle's area, then add them.", 'fTitle': 'Plan it'},
    'A closed gift box is a right rectangular prism measuring 10 inches long, 6 inches wide, and 4 inches tall. If wrapping paper costs §0.05 per square inch, how much does it cost to cover the exact surface area of the box?': {'expr': '0.05 × 248', 'parts': [{'title': 'Add the three faces', 'expr': '60 + 40 + 24', 'is': 124, 'why': 'The faces are 10 × 6 = 60, 10 × 4 = 40 and 6 × 4 = 24.'}, {'title': 'Double it', 'expr': '2 × 124', 'is': 248, 'why': 'Each face has a match on the other side.'}], 'formula': ['SA = 2(lw + lh + wh)', 'Cost = §0.05 × SA'], 'fWhy': 'Find the surface area, then each square inch costs §0.05.'},
    'A rectangular fish tank is 20 inches long, 10 inches wide, and 12 inches tall. It is filled with water to a height of 9 inches. How many cubic inches of empty space remain at the top of the tank?': {'expr': '20 × 10 × (12 − 9)', 'formula': ['Empty height = 12 − 9', 'V = lwh'], 'fWhy': 'The empty part is a box on top: same length and width, and 12 − 9 inches tall.'},
}
