"""7th Grade standards bank (7.1 to 7.22). Codes and parts come from data/standards.js only."""
from fractions import Fraction as F
from statistics import mean, median
from common import num, dec, money, lin, term, item, MINUS as M

out = []
add = out.append


def P(x):
    return num(x, paren=True)


# ---------------- 7.1 unit rates with fractions ----------------
add(item("7.1", "Maria walks {1/2} mile in {1/4} hour. How many miles does she walk per hour?", num(F(1, 2) / F(1, 4)) + " miles per hour", 1, also=["2"]))
add(item("7.1", "A recipe uses {3/4} cup of sugar for every {1/2} cup of flour. How many cups of sugar per 1 cup of flour?", num(F(3, 4) / F(1, 2)) + " cups", 2, also=[num(F(3, 4) / F(1, 2)), "1.5"]))
add(item("7.1", "Jamal mows {2/3} of a lawn in {1/6} hour. How many lawns can he mow per hour?", num(F(2, 3) / F(1, 6)) + " lawns", 2, also=["4"]))
add(item("7.1", "A car goes 150 miles on 6 gallons of gas. What is the unit rate in miles per gallon?", "25 miles per gallon", 1, also=["25"]))
add(item("7.1", "A 12-ounce bag of chips costs §3.00. What is the price per ounce?", money(F(3, 12)), 1, also=["0.25", "§0.25"]))
add(item("7.1", "A painter covers {3/5} of a wall in {3/4} hour. What fraction of the wall does she paint per hour?", num(F(3, 5) / F(3, 4)), 2, also=["0.8"]))
add(item("7.1", "A snail crawls {1/8} foot in {1/3} minute. How many feet does it crawl per minute?", num(F(1, 8) / F(1, 3)) + " foot", 2, also=[num(F(1, 8) / F(1, 3)), "0.375"]))
add(item("7.1", "A garden of {5/6} square yard needs {1/3} bag of soil. How many square yards does 1 bag cover?", num(F(5, 6) / F(1, 3)) + " square yards", 3, also=[num(F(5, 6) / F(1, 3)), "2.5"]))
add(item("7.1", "Store A sells 8 pencils for §2.00. Store B sells 12 pencils for §2.76. Which store has the lower price per pencil?", "Store B (§0.23 each vs §0.25 each)", 2, choices=None, also=["B", "Store B"]))
add(item("7.1", "Kai runs 2{1/2} miles in {1/3} hour. What is his speed in miles per hour?", num(F(5, 2) / F(1, 3)) + " miles per hour", 3, also=[num(F(5, 2) / F(1, 3)), "7.5"]))

# ---------------- 7.2 proportional relationships ----------------
add(item("7.2", "Is this table proportional? x: 1, 2, 3, 4 and y: 5, 10, 15, 20", "Yes (y ÷ x = 5 every time)", 1, "a", also=["yes"]))
add(item("7.2", "Is this table proportional? x: 1, 2, 3, 4 and y: 4, 7, 10, 13", "No (y ÷ x is not the same)", 1, "a", also=["no"]))
add(item("7.2", "A graph is a straight line that does NOT pass through (0, 0). Is the relationship proportional?", "No", 1, "a", choices=["Yes", "No"]))
add(item("7.2", "The points (2, 6), (4, 12) and (5, 15) are on a line through the origin. What is the constant of proportionality?", "3", 2, "b", also=["k = 3"]))
add(item("7.2", "Tickets cost §8 each. Write an equation for the total cost c of t tickets.", "c = 8t", 1, "b"))
add(item("7.2", "A table shows x: 3, 6, 9 and y: 2, 4, 6. Find the constant of proportionality (y per x).", "{2/3}", 2, "b"))
add(item("7.2", "y = 4.5x. What is the unit rate?", "4.5", 1, "b"))
add(item("7.2", "A proportional graph shows cost (y) for pounds of apples (x). It passes through (1, 2.5). What does the point (1, 2.5) mean?", "1 pound of apples costs §2.50 (the unit rate)", 2, "c", also=["2.5", "§2.50"]))
add(item("7.2", "On a graph of distance (y) versus time in hours (x), what does the point (0, 0) mean?", "At 0 hours, the distance is 0", 2, "c", also=["0 hours, 0 miles", "0"]))
add(item("7.2", "A proportional graph of earnings (y) for hours worked (x) passes through (6, 81). How much is earned per hour?", money(F(81, 6)), 3, "c", also=["13.50", "13.5"]))
add(item("7.2", "Which equation is proportional? A. y = 3x + 1  B. y = 7x  C. y = x + 7  D. y = 2x − 2", "B", 2, "a", choices=["A", "B", "C", "D"]))

# ---------------- 7.3 multi-step percent ----------------
def P3(q, a, lvl=2, also=None):
    add(item("7.3", q, a, lvl, also=also))

P3("A shirt costs §24. The sales tax is 8%. What is the total cost?", money(F(24) * F(108, 100)), 1, also=["25.92"])
P3("Your meal costs §36. You leave a 20% tip. How much is the tip?", money(F(36) * F(20, 100)), 1, also=["7.20", "7.2"])
P3("A §60 jacket is 25% off. What is the sale price?", money(F(60) * F(75, 100)), 1, also=["45"])
P3("You deposit §500 at 3% simple interest per year for 4 years. How much interest do you earn?", money(F(500) * F(3, 100) * 4), 2, also=["60"])
P3("A store buys a lamp for §40 and marks it up 35%. What is the selling price?", money(F(40) * F(135, 100)), 2, also=["54"])
P3("A salesperson earns 6% commission. She sells §2,500 of shoes. How much commission does she earn?", money(F(2500) * F(6, 100)), 2, also=["150"])
P3("A price goes from §50 to §65. What is the percent increase?", "30%", 2, also=["30"])
P3("A town's population drops from 800 to 680. What is the percent decrease?", "15%", 2, also=["15"])
P3("A §80 game is 15% off, then 6% tax is added to the sale price. What is the total?", money(F(80) * F(85, 100) * F(106, 100)), 3, also=["72.08"])
P3("You borrow §1,200 at 5% simple interest for 3 years. What is the total you pay back?", money(F(1200) + F(1200) * F(5, 100) * 3), 3, also=["1380", "1,380"])
P3("A bank charges a 2% fee to cash a §350 check. How much money do you get?", money(F(350) * F(98, 100)), 2, also=["343"])
P3("Your bill is §45. You pay 7% tax and leave an 18% tip on the bill before tax. What is the total?", money(F(45) * F(125, 100)), 3, also=["56.25"])

# ---------------- 7.4 operations with rational numbers ----------------
def S(x):
    return num(x)

# a: additive inverses
add(item("7.4", "What is the opposite of −7.5?", "7.5", 1, "a"))
add(item("7.4", "Find: −{3/8} + {3/8}", "0", 1, "a"))
add(item("7.4", "A diver goes down 12 feet, then up 12 feet. What is her total change in depth?", "0 feet", 1, "a", also=["0"]))
# b: sums
add(item("7.4", "Find: −8 + 5", S(F(-8 + 5)), 1, "b"))
add(item("7.4", "Find: −{3/4} + (−{1/2})", S(F(-3, 4) + F(-1, 2)), 2, "b", also=["−1.25"]))
add(item("7.4", "Find: −2.5 + 4.75", dec(F("-2.5") + F("4.75")), 2, "b"))
add(item("7.4", "It is −6°F at 6 a.m. By noon it warms up 15°F. What is the temperature at noon?", "9°F", 1, "b", also=["9"]))
# c: subtraction as adding the inverse
add(item("7.4", "Find: 4 − (−9)", S(F(4 - (-9))), 1, "c"))
add(item("7.4", "Find: −3 − 8", S(F(-3 - 8)), 1, "c"))
add(item("7.4", "Find: {1/3} − {5/6}", S(F(1, 3) - F(5, 6)), 2, "c"))
add(item("7.4", "Rewrite 7 − (−2) as an addition problem.", "7 + 2", 1, "c", also=["7+2"]))
# d: distance on a number line
add(item("7.4", "What is the distance between −5 and 3 on a number line?", S(abs(F(-5) - 3)), 1, "d"))
add(item("7.4", "What is the distance between −2.4 and −7.1?", dec(abs(F("-2.4") - F("-7.1"))), 2, "d"))
add(item("7.4", "A submarine is at −120 m. A bird is at 35 m. How far apart are they?", "155 m", 2, "d", also=["155"]))
# e: multiply
add(item("7.4", "Find: −6 × 7", S(F(-6 * 7)), 1, "e"))
add(item("7.4", "Find: (−4)(−2.5)", dec(F(-4) * F("-2.5")), 1, "e"))
add(item("7.4", "Find: −{2/3} × {9/10}", S(F(-2, 3) * F(9, 10)), 2, "e"))
add(item("7.4", "Find: (−1)(−2)(−3)(−4)", S(F(-1 * -2 * -3 * -4)), 2, "e"))
# f: divide
add(item("7.4", "Find: −48 ÷ 6", S(F(-48, 6)), 1, "f"))
add(item("7.4", "Find: −{3/4} ÷ (−{3/8})", S(F(-3, 4) / F(-3, 8)), 2, "f"))
add(item("7.4", "What is 9 ÷ 0?", "Undefined", 1, "f", choices=["0", "9", "Undefined", "1"]))
add(item("7.4", "Are −{7/2}, {−7/2} and {7/−2} the same number?", "Yes", 2, "f", choices=["Yes", "No"]))
# g: decimals
add(item("7.4", "Write {3/8} as a decimal.", "0.375", 1, "g"))
add(item("7.4", "Write {2/3} as a decimal. Does it terminate or repeat?", "0.666… (repeats)", 2, "g", also=["0.6 repeating", "repeats", "0.666..."]))
add(item("7.4", "Write {5/11} as a decimal.", "0.4545… (repeating 45)", 2, "g", also=["0.45 repeating", "0.4545..."]))
add(item("7.4", "Does {7/20} terminate or repeat as a decimal?", "Terminates (0.35)", 2, "g", choices=["Terminates (0.35)", "Repeats"]))

# ---------------- 7.5 problems with rational numbers, complex fractions ----------------
def C(a, b):
    return S(F(a) / F(b))

add(item("7.5", "A complex fraction has {1/2} on top and {3/4} on the bottom. Simplify it.", C(F(1, 2), F(3, 4)), 2))
add(item("7.5", "A complex fraction has {2/3} on top and 4 on the bottom. Simplify it.", C(F(2, 3), 4), 2))
add(item("7.5", "A complex fraction has 5 on top and {1/3} on the bottom. Simplify it.", C(5, F(1, 3)), 2))
add(item("7.5", "A complex fraction has −{4/5} on top and {2/15} on the bottom. Simplify it.", C(F(-4, 5), F(2, 15)), 3))
add(item("7.5", "Find: 3.6 ÷ (−0.4) + 2", S(F("3.6") / F("-0.4") + 2), 2))
add(item("7.5", "Find: −{1/2}(8 − 14)", S(F(-1, 2) * (8 - 14)), 2))
add(item("7.5", "Use the distributive property to find: 4 × 2{1/4}", S(4 * F(9, 4)), 1))
add(item("7.5", "Find: (−3)² − 4(2.5)", dec(F(9) - 4 * F("2.5")), 2))
add(item("7.5", "A hiker climbs {3/4} mile in {1/2} hour. Write and simplify a complex fraction for her speed in miles per hour.", C(F(3, 4), F(1, 2)) + " mph", 3, also=[C(F(3, 4), F(1, 2)), "1.5"]))
add(item("7.5", "Find: −{2/5} + 0.6 − {1/4}", dec(F(-2, 5) + F("0.6") - F(1, 4)), 3, also=[S(F(-2, 5) + F("0.6") - F(1, 4))]))

# ---------------- 7.6 linear expressions ----------------
def E(a, b):
    return lin(a, b)

add(item("7.6", "Simplify: 3x + 5 + 2x − 8", E(5, -3), 1))
add(item("7.6", "Expand: 4(2x − 3)", E(8, -12), 1))
add(item("7.6", "Expand: −3(x + 6)", E(-3, -18), 1))
add(item("7.6", "Simplify: {1/2}x + {1/4}x", E(F(3, 4), 0), 2))
add(item("7.6", "Factor: 6x + 18", "6(x + 3)", 2))
add(item("7.6", "Factor: 10x − 15", "5(2x − 3)", 2))
add(item("7.6", "Simplify: (2x + 7) − (5x − 1)", E(-3, 8), 2))
add(item("7.6", "Simplify: 0.4(5x − 10) + 3x", E(F("0.4") * 5 + 3, F("0.4") * -10), 2))
add(item("7.6", "Expand: −{2/3}(6x − 9)", E(F(-2, 3) * 6, F(-2, 3) * -9), 3))
add(item("7.6", "Simplify: 2(3x − 4) − 3(x − 5)", E(6 - 3, -8 + 15), 3))

# ---------------- 7.7 equivalent expressions in context ----------------
add(item("7.7", "A price p goes up 10%. Write the new price as one term.", "1.1p", 2, also=["1.10p"]))
add(item("7.7", "A shirt that costs p dollars is 20% off. Write an expression for the sale price with one term.", "0.8p", 2, also=["0.80p"]))
add(item("7.7", "Write an expression: 5 more than twice a number n.", "2n + 5", 1))
add(item("7.7", "A rectangle has length L and width 4. Write two equivalent expressions for its perimeter.", "2L + 8 and 2(L + 4)", 2, also=["2L + 8", "2(L + 4)"]))
add(item("7.7", "Which is the same as a + 0.05a?  A. 0.05a  B. 1.05a  C. 1.5a  D. a + 5", "B", 2, choices=["A", "B", "C", "D"]))
add(item("7.7", "Four friends split a bill b and each adds a §3 tip. Write an expression for what each pays.", "{b/4} + 3", 2, also=["b/4 + 3", "0.25b + 3"]))
add(item("7.7", "Write 3(x + 2) in words.", "3 times the sum of a number and 2", 1, also=["three times the sum of x and 2"]))
add(item("7.7", "A pool has 500 gallons and drains 25 gallons each minute. Write an expression for the gallons left after m minutes.", "500 − 25m", 1))
add(item("7.7", "Explain why n + n + n + n and 4n mean the same thing.", "Adding n four times is the same as 4 times n", 1, also=["4n"]))
add(item("7.7", "The cost of x hats at §12 each plus x scarves at §8 each. Write the cost as one term.", "20x", 2))

# ---------------- 7.8 multi-step rational number problems ----------------
add(item("7.8", "Sam has −§12.40 in his account. He deposits §30, then pays a §2.75 fee 3 times. What is his balance?", money(F("-12.40") + 30 - 3 * F("2.75")), 2, also=["9.35"]))
add(item("7.8", "A recipe needs 2{1/4} cups of flour. You triple it. How many cups do you need?", S(3 * F(9, 4)) + " cups", 2, also=[S(3 * F(9, 4)), "6.75"]))
add(item("7.8", "The temperature was −4.5°C. It dropped 3.2°C, then rose 6°C. What is the temperature now?", dec(F("-4.5") - F("3.2") + 6) + "°C", 2, also=[dec(F("-4.5") - F("3.2") + 6)]))
add(item("7.8", "A board is 8 feet long. You cut off {3/4} foot three times. How long is it now?", S(8 - 3 * F(3, 4)) + " feet", 2, also=[S(8 - 3 * F(3, 4)), "5.75"]))
add(item("7.8", "Estimate first: 19.8 × 4.1 is about what whole number? Then find the exact product.", "About 80; exact " + dec(F("19.8") * F("4.1")), 2, also=[dec(F("19.8") * F("4.1"))]))
add(item("7.8", "You earn §15.50 an hour and work 6{1/2} hours. How much do you earn?", money(F("15.50") * F(13, 2)), 2, also=["100.75"]))
add(item("7.8", "A stock lost §1.35 each day for 5 days. What was the total change in price?", money(F("-1.35") * 5), 1, also=["−6.75"]))
add(item("7.8", "25% of the class is 7 students. How many students are in the class?", "28", 2))
add(item("7.8", "A tank is {2/5} full and holds 30 gallons when full. You add 4.5 gallons. How many gallons are in it now?", dec(F(2, 5) * 30 + F("4.5")) + " gallons", 3, also=[dec(F(2, 5) * 30 + F("4.5"))]))
add(item("7.8", "Lia says {3/8} + 0.6 is about 2. Is that reasonable? Find the exact sum.", "No; it is about 1 (exact " + dec(F(3, 8) + F("0.6")) + ")", 3, also=[dec(F(3, 8) + F("0.6"))]))

# ---------------- 7.9 equations and inequalities ----------------
def solve(p, q, r):
    return (F(r) - F(q)) / F(p)

add(item("7.9", "Solve: 0.6x + 1.2 = 4.2", "x = " + num(solve(F("0.6"), F("1.2"), F("4.2"))), 2, "a"))
for (p, q, r, lvl) in [(3, 7, 22, 1), (-4, 9, -15, 2), (F(1, 2), -3, 5, 2), (F(-2, 3), 4, 10, 3)]:
    qtext = "Solve: " + lin(p, q) + " = " + num(r)
    add(item("7.9", qtext, "x = " + num(solve(p, q, r)), lvl, "a"))
for (p, q, r, lvl) in [(2, -4, 10, 1), (-3, 5, 12, 2), (F(1, 4), 8, 3, 3)]:
    qtext = "Solve: " + num(p, mixed=False) + "(" + lin(1, q) + ") = " + num(r)
    add(item("7.9", qtext, "x = " + num(F(r) / F(p) - q), lvl, "a"))
add(item("7.9", "A gym charges §25 to join plus §15 a month. You paid §130. How many months did you pay for?", "7 months", 2, "a", also=["7"]))
add(item("7.9", "Three friends each buy a §4 snack and split a §18 pizza. Each paid the same total. Write and solve an equation for what each paid, t.", "t = 10 (t = 4 + 18 ÷ 3)", 3, "a", also=["10", "§10"]))
for (p, q, r, sym, lvl) in [(2, 3, 11, ">", 1), (-3, 4, 19, "<", 2), (F(1, 2), -1, 4, ">", 2)]:
    x = solve(p, q, r)
    s2 = sym if p > 0 else {">": "<", "<": ">"}[sym]
    add(item("7.9", "Solve: " + lin(p, q) + " " + sym + " " + num(r), "x " + s2 + " " + num(x), lvl, "b"))
add(item("7.9", "You have §40. Movie tickets are §9 each and you spend §4 on popcorn. Write and solve an inequality for the number of tickets t you can buy.", "9t + 4 ≤ 40, so t ≤ 4 (at most 4 tickets)", 2, "b", also=["t ≤ 4", "4"]))
add(item("7.9", "On a number line, the solution to x > −2 has an open or closed circle at −2?", "Open circle", 1, "b", choices=["Open circle", "Closed circle"]))
add(item("7.9", "Solve and say which way the arrow points: −2x + 6 ≥ 14", "x ≤ −4 (arrow points left, closed circle)", 3, "b", also=["x ≤ −4"]))

# ---------------- 7.10 samples and populations ----------------
add(item("7.10", "A principal wants to know the favorite lunch of all 600 students. She asks 60 students. What is the population?", "All 600 students", 1, "a", also=["600 students"]))
add(item("7.10", "In the question above, what is the sample?", "The 60 students she asked", 1, "a", also=["60 students"]))
add(item("7.10", "Which sample is random? A. The first 20 students in the lunch line  B. 20 names drawn from a hat with every student's name  C. 20 students on the soccer team  D. 20 students who volunteer", "B", 2, "b", choices=["A", "B", "C", "D"]))
add(item("7.10", "To find the school's favorite sport, Leo surveys only the basketball team. Is the sample biased? Why?", "Yes; basketball players are likely to pick basketball", 2, "e", also=["yes"]))
add(item("7.10", "In a random sample of 50 students, 18 walk to school. About how many of the 900 students walk?", str(18 * 900 // 50), 2, "d", also=["about 324"]))
add(item("7.10", "A random sample of 40 light bulbs has 2 broken bulbs. Predict how many of 1,000 bulbs are broken.", str(2 * 1000 // 40), 2, "d"))
add(item("7.10", "Three random samples of 20 students had 8, 10 and 9 students who like math best. Estimate the percent of all students who like math best.", "About 45%", 3, "d", also=["45%", "45"]))
add(item("7.10", "A survey asks, \"Don't you agree the cafeteria food is great?\" What kind of problem does this question have?", "Bias (a leading question)", 2, "e", also=["bias", "biased", "leading question"]))
add(item("7.10", "Can you use a sample of 5 students to make a conclusion about 800 students? Why or why not?", "No; the sample is too small to represent the population", 2, "c", also=["no"]))
add(item("7.10", "A random sample of 100 voters shows 56 support a new park. Can you conclude that about 56% of voters support it?", "Yes, because the sample is random and large enough", 2, "c", also=["yes"]))

# ---------------- 7.11 overlap of two distributions ----------------
add(item("7.11", "Team A's mean height is 62 in and Team B's is 68 in. Both have a MAD of 2 in. How many MADs apart are the means?", str((68 - 62) // 2), 2, also=["3 MADs", "3"]))
add(item("7.11", "Two classes' test means differ by 4 points. Each class has a MAD of 8 points. Is there a lot of overlap or a little?", "A lot (the means are only half a MAD apart)", 2, choices=["A lot (the means are only half a MAD apart)", "Very little"]))
add(item("7.11", "Data set A: mean 20, MAD 1. Data set B: mean 30, MAD 1. Is there much overlap?", "No, very little (the means are 10 MADs apart)", 2, also=["no"]))
add(item("7.11", "Plants with fertilizer: mean height 15 cm, MAD 1.5 cm. Without: mean 12 cm, MAD 1.5 cm. Express the difference in means as a multiple of the MAD.", "2 (3 ÷ 1.5)", 3, also=["2"]))
add(item("7.11", "Two box plots have the same IQR of 6. Their medians are 40 and 52. How many IQRs apart are the medians?", "2", 2))
add(item("7.11", "When the difference in means is less than 1 MAD, the two distributions usually ___.", "Overlap a lot", 1, choices=["Overlap a lot", "Do not overlap"]))
add(item("7.11", "Bus 1 commute times: mean 25 min, MAD 5 min. Bus 2: mean 40 min, MAD 5 min. How many MADs apart are the means?", "3", 2))
add(item("7.11", "A difference of 4 MADs between means suggests the two groups are ___.", "Very different", 1, choices=["Very different", "About the same"]))

# ---------------- 7.12 comparative inferences ----------------
def mad(xs):
    m = F(sum(xs), len(xs))
    return F(sum(abs(F(x) - m) for x in xs), len(xs))

A = [2, 4, 6, 8, 10]
B = [10, 12, 14, 16, 18]
add(item("7.12", "Find the mean of 2, 4, 6, 8, 10.", num(F(sum(A), len(A))), 1))
add(item("7.12", "Find the MAD of 2, 4, 6, 8, 10.", dec(mad(A)), 2))
add(item("7.12", "Find the MAD of 5, 7, 7, 9, 12.", dec(mad([5, 7, 7, 9, 12])), 3))
add(item("7.12", "Class A quiz scores have a mean of 80 and a MAD of 4. Class B has a mean of 80 and a MAD of 10. Which class's scores are more consistent?", "Class A (smaller MAD)", 2, also=["A", "Class A"]))
add(item("7.12", "Find the median of 3, 9, 4, 7, 12, 5.", dec(F(median([3, 9, 4, 7, 12, 5])).limit_denominator()), 1))
add(item("7.12", "Find the IQR of 1, 3, 4, 6, 8, 9, 11, 14.", "6.5", 3))
add(item("7.12", "7th graders' sleep: median 8 h, IQR 1 h. 8th graders': median 7 h, IQR 1 h. Make one comparison.", "7th graders usually sleep about 1 hour more (same spread)", 2, also=["7th graders sleep more"]))
add(item("7.12", "Group X: 10, 12, 14, 16, 18. Group Y: 13, 14, 14, 14, 15. Which group has more variability?", "Group X", 2, also=["X"]))
add(item("7.12", "Group A test times have mean 30 minutes, MAD 3. Group B mean 36 minutes, MAD 3. How many MADs apart are the means? What can you infer?", "2 MADs; Group B usually takes longer", 3, also=["2"]))
add(item("7.12", "Data: 4, 4, 5, 6, 6. What is the range?", "2"))

# ---------------- 7.13 probability from 0 to 1 ----------------
add(item("7.13", "An event has a probability of 0. Is it impossible, unlikely, likely, or certain?", "Impossible", 1, choices=["Impossible", "Unlikely", "Likely", "Certain"]))
add(item("7.13", "An event has a probability of 0.92. Describe its likelihood.", "Likely", 1, choices=["Impossible", "Unlikely", "Likely", "Certain"]))
add(item("7.13", "Which is more likely: an event with probability {1/3} or one with probability 0.4?", "0.4", 2))
add(item("7.13", "A bag has only red marbles. What is the probability of pulling a red marble?", "1", 1))
add(item("7.13", "Can a probability be 1.3? Explain.", "No; probabilities are from 0 to 1", 1, also=["no"]))
add(item("7.13", "A spinner has 8 equal parts and 1 is blue. Is landing on blue likely or unlikely?", "Unlikely ({1/8})", 1, also=["unlikely"]))
add(item("7.13", "Put in order from least to most likely: {1/2}, 0.05, 85%, {1/4}", "0.05, {1/4}, {1/2}, 85%", 2))
add(item("7.13", "A probability of {1/2} means the event is ___.", "Equally likely to happen or not happen", 1, also=["equally likely", "as likely as not"]))

# ---------------- 7.14 probability models ----------------
add(item("7.14", "A fair number cube is rolled. What is P(4)?", "{1/6}", 1))
add(item("7.14", "A bag has 3 red, 5 blue and 2 green tiles. What is P(blue)?", num(F(5, 10)), 1))
add(item("7.14", "Is a model with P(red) = {1/2}, P(blue) = {1/4}, P(green) = {1/4} uniform?", "No (the outcomes are not equally likely)", 2, also=["no"]))
add(item("7.14", "A spinner landed on A 12 times, B 18 times and C 30 times. Use the data to find P(C).", num(F(30, 60)), 2, "a"))
add(item("7.14", "Using the same data (A 12, B 18, C 30), predict how many times out of 200 spins it lands on A.", str(200 * 12 // 60), 2, "a"))
add(item("7.14", "A fair coin is flipped 20 times and lands heads 14 times. The model says P(heads) = {1/2}. Give one reason for the difference.", "With only 20 flips, results can vary by chance", 2, "b", also=["too few trials", "chance"]))
add(item("7.14", "A model says a fair cube lands on 6 about {1/6} of the time. In 600 rolls, how many 6s do you expect?", "100"))
add(item("7.14", "In 50 rolls a cube showed 1 twenty times. What might this tell you?", "The cube might not be fair", 3, "b", also=["not fair", "unfair"]))
add(item("7.14", "The probabilities in a model must add up to ___.", "1", 1))
add(item("7.14", "P(red) = 0.3 and P(blue) = 0.5. The only other color is green. What is P(green)?", dec(1 - F("0.3") - F("0.5")), 2))

# ---------------- 7.15 experimental vs theoretical ----------------
add(item("7.15", "A coin is flipped 50 times and lands heads 27 times. What is the experimental probability of heads?", num(F(27, 50)), 1, also=["0.54", "54%"]))
add(item("7.15", "What is the theoretical probability of heads on a fair coin?", "{1/2}", 1, also=["0.5", "50%"]))
add(item("7.15", "A cube is rolled 60 times and shows 3 eleven times. What is the experimental P(3)?", num(F(11, 60)), 2))
add(item("7.15", "The theoretical P(3) on a fair cube is {1/6}. In 60 rolls, how many 3s are expected?", "10"))
add(item("7.15", "As the number of trials gets larger, the experimental probability usually gets ___ the theoretical probability.", "Closer to", 1, "a", choices=["Closer to", "Farther from"]))
add(item("7.15", "A basketball player made 42 of 60 free throws. Predict how many she makes out of 100.", "70", 2, "a"))
add(item("7.15", "A spinner landed on red 45 times out of 180. What percent of the spins were red?", "25%", 2, also=["25"]))
add(item("7.15", "Out of 400 simulated births, 196 are girls. Is that close to the theoretical {1/2}? What is the experimental probability as a decimal?", "Yes; " + dec(F(196, 400)), 3, "a", also=[dec(F(196, 400))]))

# ---------------- 7.16 compound events ----------------
add(item("7.16", "You flip a coin and roll a number cube. How many outcomes are in the sample space?", "12", 1, "a"))
add(item("7.16", "You flip a coin and roll a number cube. What is P(heads and 5)?", "{1/12}", 2, "a"))
add(item("7.16", "You flip two coins. List the sample space.", "HH, HT, TH, TT", 1, "a"))
add(item("7.16", "You flip two coins. What is P(exactly one head)?", num(F(2, 4)), 2, "c"))
add(item("7.16", "You roll two number cubes. What is P(sum of 7)?", num(F(6, 36)), 3, "a"))
add(item("7.16", "A shirt comes in 3 colors and 4 sizes. How many choices are there?", "12", 1, "a"))
add(item("7.16", "A spinner has 4 equal parts (1 to 4). You spin twice. What is P(both spins are even)?", num(F(2, 4) * F(2, 4)), 2, "a"))
add(item("7.16", "Rolling two cubes, which outcomes make the event \"doubles\"?", "(1,1), (2,2), (3,3), (4,4), (5,5), (6,6)", 2, "c"))
add(item("7.16", "Write P(heads and 5) from above as a percent, rounded to the nearest tenth.", "8.3%", 3, also=["8.3"]))
add(item("7.16", "40% of cereal boxes have a prize. How could you simulate buying 3 boxes using a spinner?", "Spin a spinner with 10 equal parts, 4 marked prize, 3 times for each trial", 3, "b", also=["spinner with 4 of 10 parts prize"]))

# ---------------- 7.17 scale drawings ----------------
add(item("7.17", "On a map, 1 inch = 20 miles. Two towns are 3.5 inches apart. How far apart are they?", dec(F("3.5") * 20) + " miles", 1, also=[dec(F("3.5") * 20)]))
add(item("7.17", "A scale drawing uses 1 cm : 4 m. A room is 6 cm long on the drawing. How long is the real room?", "24 m", 1, also=["24"]))
add(item("7.17", "A real car is 15 feet long. A model uses 1 inch : 2 feet. How long is the model?", "7.5 inches", 2, also=["7.5"]))
add(item("7.17", "A blueprint scale is {1/4} inch : 1 foot. A wall is 3 inches on the blueprint. How long is the real wall?", "12 feet", 2, also=["12"]))
add(item("7.17", "A rectangle on a drawing is 2 cm by 3 cm. The scale is 1 cm : 5 m. What is the real area?", str(10 * 15) + " m²", 3, also=["150"]))
add(item("7.17", "A drawing has a scale of 1 in : 6 ft. You redraw it at 1 in : 3 ft. A 4-inch line becomes how long?", "8 inches", 3, also=["8"]))
add(item("7.17", "What is the scale factor from a 5 cm drawing to a 20 cm drawing?", "4"))
add(item("7.17", "A garden is 30 ft by 12 ft. On a drawing, 1 in = 6 ft. What are the drawing's dimensions?", "5 in by 2 in", 2, also=["5 by 2"]))

# ---------------- 7.18 constructing triangles ----------------
add(item("7.18", "Can sides of 3 cm, 4 cm and 8 cm make a triangle?", "No (3 + 4 is less than 8)", 1, also=["no"]))
add(item("7.18", "Can sides of 5 in, 6 in and 10 in make a triangle?", "Yes (5 + 6 is greater than 10)", 1, also=["yes"]))
add(item("7.18", "Angles of 50°, 60° and 70° are given. How many triangles can you make: none, one, or more than one?", "More than one (same shape, any size)", 2, choices=["None", "One", "More than one (same shape, any size)"]))
add(item("7.18", "Angles of 80°, 60° and 50° are given. How many triangles can you make?", "None (the angles add to 190°)", 2, choices=["None (the angles add to 190°)", "One", "More than one"]))
add(item("7.18", "Three side lengths that work, like 6, 8 and 10, make how many different triangles?", "One", 2, choices=["None", "One", "More than one"]))
add(item("7.18", "Two sides of a triangle are 7 and 9. What lengths can the third side be?", "Greater than 2 and less than 16", 3, also=["2 < x < 16"]))
add(item("7.18", "Which tool do you use to draw a 45° angle?", "Protractor", 1, choices=["Ruler", "Protractor", "Compass"]))
add(item("7.18", "Can a triangle have two right angles?", "No (the third angle would be 0°)", 1, also=["no"]))

# ---------------- 7.19 cross sections ----------------
add(item("7.19", "A right rectangular prism is sliced parallel to its base. What shape is the cross section?", "Rectangle", 1, choices=["Rectangle", "Triangle", "Circle", "Pentagon"]))
add(item("7.19", "A cylinder is sliced parallel to its base. What shape is the cross section?", "Circle", 1, choices=["Circle", "Rectangle", "Triangle", "Oval"]))
add(item("7.19", "A cylinder is sliced straight down through its center, perpendicular to the base. What shape is the cross section?", "Rectangle", 2, choices=["Circle", "Rectangle", "Triangle", "Trapezoid"]))
add(item("7.19", "A square pyramid is sliced parallel to its base. What shape is the cross section?", "Square", 2, choices=["Square", "Triangle", "Rectangle", "Circle"]))
add(item("7.19", "A square pyramid is sliced from the top vertex straight down to the base, perpendicular to the base. What shape is the cross section?", "Triangle", 2, choices=["Square", "Triangle", "Pentagon", "Circle"]))
add(item("7.19", "A cone is sliced parallel to its base. What shape is the cross section?", "Circle", 1, choices=["Circle", "Triangle", "Square"]))
add(item("7.19", "A cube is sliced through one corner, cutting across three faces. What shape is the cross section?", "Triangle", 3, choices=["Square", "Triangle", "Hexagon", "Circle"]))
add(item("7.19", "A sphere is sliced by any plane. What shape is the cross section?", "Circle", 1, choices=["Circle", "Oval", "Square"]))

# ---------------- 7.20 circles ----------------
add(item("7.20", "A circle has a radius of 6 cm. What is its diameter?", "12 cm", 1, also=["12"]))
add(item("7.20", "Find the circumference of a circle with diameter 10 in. Use 3.14.", dec(F("3.14") * 10) + " in", 1, "b", also=[dec(F("3.14") * 10)]))
add(item("7.20", "Find the area of a circle with radius 5 ft. Use 3.14.", dec(F("3.14") * 25) + " ft²", 2, "b", also=[dec(F("3.14") * 25)]))
add(item("7.20", "Find the area of a circle with diameter 8 m. Leave your answer in terms of π.", "16π m²", 2, "b", also=["16π"]))
add(item("7.20", "A circle's circumference is 18.84 cm. Find its radius. Use 3.14.", "3 cm", 3, "b", also=["3"]))
add(item("7.20", "A pizza has a 14-inch diameter. What is its area? Use 3.14 and round to the nearest tenth.", dec(F("3.14") * 49, 1) + " in²", 2, "b", also=[dec(F("3.14") * 49, 1)]))
add(item("7.20", "A circle cut into many equal wedges and laid out side by side looks like a parallelogram. Its base is half the circumference. What is its height?", "The radius", 3, "a", choices=["The radius", "The diameter", "The circumference"]))
add(item("7.20", "Which formula gives the circumference? A. πr²  B. 2πr  C. πr  D. 2r", "B", 1, choices=["A", "B", "C", "D"]))
add(item("7.20", "A bike wheel has a 26-inch diameter. How far does it roll in one turn? Use 3.14.", dec(F("3.14") * 26) + " in", 2, "b", also=[dec(F("3.14") * 26)]))
add(item("7.20", "A circle has area 78.5 square units. Find its radius. Use 3.14.", "5", 3, "b"))

# ---------------- 7.21 angle relationships ----------------
add(item("7.21", "Two angles are complementary. One is 35°. Find the other.", "55°", 1, also=["55"]))
add(item("7.21", "Two angles are supplementary. One is 118°. Find the other.", "62°", 1, also=["62"]))
add(item("7.21", "Vertical angles measure (3x + 10)° and 70°. Find x.", "x = 20", 2))
add(item("7.21", "Two supplementary angles are (2x)° and (x + 30)°. Find x.", "x = 50", 2))
add(item("7.21", "Two complementary angles are (x + 12)° and (2x)°. Find x.", "x = 26", 2))
add(item("7.21", "Angles A and B are adjacent and form a right angle. A = 4x° and B = 5x°. Find each angle.", "A = 40°, B = 50°", 3, also=["40 and 50"]))
add(item("7.21", "Vertical angles are always ___.", "Equal (congruent)", 1, also=["equal", "congruent"]))
add(item("7.21", "Three angles on a straight line are 40°, x°, and 75°. Find x.", "x = 65", 2))
add(item("7.21", "An angle is 3 times its supplement. Find the angle.", "135°", 3, also=["135"]))
add(item("7.21", "Two lines cross. One angle is 125°. Find the angle next to it (adjacent).", "55°", 1, also=["55"]))

# ---------------- 7.22 area, volume and surface area ----------------
add(item("7.22", "Find the area of a triangle with base 10 cm and height 7 cm.", "35 cm²", 1, also=["35"]))
add(item("7.22", "Find the area of a trapezoid with bases 6 and 10 and height 4.", str((6 + 10) * 4 // 2), 2))
add(item("7.22", "Find the volume of a rectangular prism 5 in by 3 in by 4 in.", "60 in³", 1, also=["60"]))
add(item("7.22", "Find the surface area of a cube with edges of 3 ft.", "54 ft²", 2, also=["54"]))
add(item("7.22", "Find the surface area of a rectangular prism 2 m by 3 m by 4 m.", str(2 * (2 * 3 + 2 * 4 + 3 * 4)) + " m²", 2, also=[str(2 * (2 * 3 + 2 * 4 + 3 * 4))]))
add(item("7.22", "A box is 2.5 ft by 2 ft by 1.5 ft. What is its volume?", dec(F("2.5") * 2 * F("1.5")) + " ft³", 2, also=[dec(F("2.5") * 2 * F("1.5"))]))
add(item("7.22", "A rectangle 8 m by 5 m has a 2 m by 2 m square cut out. What is the remaining area?", "36 m²", 2, also=["36"]))
add(item("7.22", "A triangular prism has a base triangle with base 6 and height 4 and a length of 10. What is its volume?", "120", 3))
add(item("7.22", "A cube has a volume of 64 in³. What is the length of one edge?", "4 in", 2, also=["4"]))
add(item("7.22", "A room is 12 ft by 10 ft with walls 8 ft tall. How much wall area is there to paint (no windows or doors)?", str(2 * (12 * 8) + 2 * (10 * 8)) + " ft²", 3, also=[str(2 * (12 * 8) + 2 * (10 * 8))]))
add(item("7.22", "Find the area of a regular hexagon split into 6 triangles, each with base 4 and height 3.5.", dec(6 * F(1, 2) * 4 * F("3.5")), 3))

# ---------------- more problems (checked Gemini drafts, Nov 2026): added last so earlier ids stay put ----------------
from more import more
out.extend(more("g7"))
