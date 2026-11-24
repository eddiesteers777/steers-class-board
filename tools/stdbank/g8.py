"""8th Grade standards bank (8.1 to 8.30). Codes and parts come from data/standards.js only.
These also show for 8th Accelerated, which teaches the same 8th standards."""
from fractions import Fraction as F
import math
from common import num, dec, money, lin, item

out = []
add = out.append

# ---------------- 8.1 real number system ----------------
add(item("8.1", "Is √50 rational or irrational?", "Irrational", 1, choices=["Rational", "Irrational"]))
add(item("8.1", "Is 0.125 rational or irrational?", "Rational", 1, choices=["Rational", "Irrational"]))
add(item("8.1", "Is π rational or irrational?", "Irrational", 1, choices=["Rational", "Irrational"]))
add(item("8.1", "Is √81 rational or irrational?", "Rational (√81 = 9)", 1, choices=["Rational (√81 = 9)", "Irrational"]))
add(item("8.1", "Does the decimal for {5/8} terminate or repeat?", "Terminates (0.625)", 1, "a", choices=["Terminates (0.625)", "Repeats"]))
add(item("8.1", "Write {4/9} as a decimal.", "0.444… (repeating 4)", 2, "a", also=["0.4 repeating", "0.444..."]))
add(item("8.1", "Write 0.777… (7 repeating) as a fraction.", "{7/9}", 2, "b"))
add(item("8.1", "Write 0.272727… (27 repeating) as a fraction in simplest form.", num(F(27, 99)), 2, "b"))
add(item("8.1", "Write 0.1666… (6 repeating) as a fraction in simplest form.", num(F(1, 6)), 3, "b"))
add(item("8.1", "Write 1.333… (3 repeating) as a fraction.", num(F(4, 3), mixed=False), 3, "b", also=["1{1/3}"]))
add(item("8.1", "Which number is irrational? A. −{2/3}  B. 0.5  C. √7  D. √16", "C", 2, choices=["A", "B", "C", "D"]))

# ---------------- 8.2 approximating irrationals ----------------
add(item("8.2", "√30 is between which two whole numbers?", "5 and 6", 1, also=["5, 6"]))
add(item("8.2", "√70 is between which two whole numbers?", "8 and 9", 1, also=["8, 9"]))
add(item("8.2", "Is √40 closer to 6 or 7?", "6 (40 is closer to 36 than to 49)", 2, also=["6"]))
add(item("8.2", "Estimate √20 to the nearest tenth.", "4.5", 2))
add(item("8.2", "Which is greater: √50 or 7.2?", "7.2", 2, also=["7.2"]))
add(item("8.2", "Order from least to greatest: √10, 3.5, π", "π, √10, 3.5", 3))
add(item("8.2", "Estimate √2 to the nearest tenth.", "1.4", 2))
add(item("8.2", "Between which two consecutive whole numbers is −√12?", "−4 and −3", 3, also=["−4, −3"]))
add(item("8.2", "Estimate π² to the nearest whole number.", "10", 3))

# ---------------- 8.3 integer exponents ----------------
add(item("8.3", "Simplify: 3² × 3⁴", "3⁶", 1, also=["729", "3^6"]))
add(item("8.3", "Simplify: 5⁷ ÷ 5³", "5⁴", 1, also=["625", "5^4"]))
add(item("8.3", "Simplify: (2³)²", "2⁶", 1, also=["64", "2^6"]))
add(item("8.3", "Evaluate: 4⁰", "1", 1))
add(item("8.3", "Evaluate: 2⁻³", "{1/8}", 2))
add(item("8.3", "Simplify: x⁵ · x⁻²", "x³", 2, also=["x^3"]))
add(item("8.3", "Simplify: (x⁴)³", "x¹²", 2, also=["x^12"]))
add(item("8.3", "Evaluate: 3⁻² × 3⁵", "27", 2, also=["3³"]))
add(item("8.3", "Simplify and write with a positive exponent: {a³/a⁷}", "{1/a⁴}", 3, also=["1/a^4", "a^-4"]))
add(item("8.3", "Evaluate: (−2)⁴", "16", 2))
add(item("8.3", "Evaluate: −2⁴", "−16", 3))
add(item("8.3", "Simplify: (3x²)³", "27x⁶", 3, also=["27x^6"]))

# ---------------- 8.4 square and cube roots ----------------
add(item("8.4", "Evaluate: √144", "12", 1, "a"))
add(item("8.4", "Evaluate: ∛125", "5", 1, "a"))
add(item("8.4", "Evaluate: √225", "15", 1, "a"))
add(item("8.4", "Evaluate: ∛1000", "10", 1, "a"))
add(item("8.4", "Solve: x² = 64", "x = ±8", 2, also=["8 and −8", "±8"]))
add(item("8.4", "Solve: x³ = 27", "x = 3", 2))
add(item("8.4", "Solve: x² = 13", "x = ±√13", 2, also=["±√13"]))
add(item("8.4", "Solve: x³ = −216", "x = −6", 3))
add(item("8.4", "A square has area 81 cm². What is its side length?", "9 cm", 1, also=["9"]))
add(item("8.4", "A cube has volume 343 in³. What is its edge length?", "7 in", 2, also=["7"]))
add(item("8.4", "Why is √15 irrational?", "15 is not a perfect square, so its square root never ends or repeats", 2, "b", also=["not a perfect square"]))
add(item("8.4", "Solve: 2x² = 50", "x = ±5", 3, also=["±5"]))

# ---------------- 8.5 estimate and compare in scientific notation ----------------
add(item("8.5", "Write 4,500,000 in scientific notation.", "4.5 × 10⁶", 1))
add(item("8.5", "Write 0.00072 in scientific notation.", "7.2 × 10⁻⁴", 1))
add(item("8.5", "Write 3.1 × 10⁵ in standard form.", "310,000", 1))
add(item("8.5", "Which is greater: 6 × 10⁸ or 9 × 10⁷?", "6 × 10⁸", 2))
add(item("8.5", "Estimate 49,800,000 as a single digit times a power of 10.", "5 × 10⁷", 2))
add(item("8.5", "The Sun is about 1.5 × 10⁸ km from Earth. The Moon is about 4 × 10⁵ km away. About how many times farther is the Sun?", "About 375 times", 3, also=["375"]))
add(item("8.5", "Order from least to greatest: 3 × 10⁻², 5 × 10⁻³, 1 × 10⁻¹", "5 × 10⁻³, 3 × 10⁻², 1 × 10⁻¹", 2))
add(item("8.5", "A city has about 8 × 10⁶ people. A town has about 2 × 10⁴. How many times as many people live in the city?", "400", 2, also=["4 × 10²"]))

# ---------------- 8.6 operations in scientific notation ----------------
add(item("8.6", "Find: (3 × 10⁴)(2 × 10⁵)", "6 × 10⁹", 1))
add(item("8.6", "Find: (8 × 10⁹) ÷ (2 × 10³)", "4 × 10⁶", 1))
add(item("8.6", "Find: (5 × 10³)(4 × 10²). Write it in scientific notation.", "2 × 10⁶", 2))
add(item("8.6", "Find: (6.3 × 10⁵) + (2.1 × 10⁵)", "8.4 × 10⁵", 2))
add(item("8.6", "Find: (4.5 × 10⁶) − (3 × 10⁵)", "4.2 × 10⁶", 3))
add(item("8.6", "Find: 2,000 × (3.5 × 10⁴). Write it in scientific notation.", "7 × 10⁷", 2))
add(item("8.6", "Find: (1.2 × 10⁻³) ÷ (4 × 10²)", "3 × 10⁻⁶", 3))
add(item("8.6", "A calculator shows 5.6E7. Write it in scientific notation.", "5.6 × 10⁷", 1, "b"))
add(item("8.6", "A calculator shows 2.3E−4. Write it in standard form.", "0.00023", 2, "b"))
add(item("8.6", "Which unit fits the width of a human hair best (about 8 × 10⁻⁵ m)? Kilometers, meters, or micrometers?", "Micrometers", 2, "a", choices=["Kilometers", "Meters", "Micrometers"]))
add(item("8.6", "Which unit fits the distance between two cities best? Millimeters, centimeters, or kilometers?", "Kilometers", 1, "a", choices=["Millimeters", "Centimeters", "Kilometers"]))

# ---------------- 8.7 proportional or not ----------------
add(item("8.7", "Is y = 6x proportional?", "Yes", 1, choices=["Yes", "No"]))
add(item("8.7", "Is y = 2x + 5 proportional?", "No (it does not pass through the origin)", 1, choices=["Yes", "No (it does not pass through the origin)"]))
add(item("8.7", "x: 2, 4, 6 and y: 7, 14, 21. Proportional or non-proportional?", "Proportional (y ÷ x = 3.5)", 2, also=["proportional"]))
add(item("8.7", "x: 1, 2, 3 and y: 3, 5, 7. Proportional or non-proportional?", "Non-proportional", 2, also=["not proportional", "no"]))
add(item("8.7", "A taxi charges §3 plus §2 a mile. Is the cost proportional to the miles?", "No (the §3 start fee)", 2, also=["no"]))
add(item("8.7", "Apples cost §1.50 a pound with no other fees. Is the cost proportional to the pounds?", "Yes", 1, choices=["Yes", "No"]))
add(item("8.7", "A line passes through (0, 0) and (3, 12). Is it proportional?", "Yes", 1, choices=["Yes", "No"]))
add(item("8.7", "A line passes through (0, 4) and (2, 8). Is it proportional?", "No", 1, choices=["Yes", "No"]))

# ---------------- 8.8 graph proportional relationships ----------------
add(item("8.8", "A proportional graph passes through (4, 10). What is the slope?", num(F(10, 4)), 1, "a", also=["2.5"]))
add(item("8.8", "Write the equation of a proportional line through (5, 15).", "y = 3x", 1, "a"))
add(item("8.8", "A car travels 180 miles in 3 hours at a constant rate. What is the slope of the distance-time graph? What does it mean?", "60; the car goes 60 miles per hour", 2, "a", also=["60"]))
add(item("8.8", "In y = 0.75x, what is the unit rate?", "0.75", 1, "a"))
add(item("8.8", "Which point must every proportional graph pass through?", "(0, 0)", 1, also=["the origin", "origin"]))
add(item("8.8", "A proportional graph of earnings shows (8, 96) for 8 hours. Write the equation.", "y = 12x", 2, "a"))
add(item("8.8", "Two workers: Ana's graph is y = 14x; Ben earns §45 in 3 hours. Who earns more per hour?", "Ben (§15 per hour)", 3, "a", also=["Ben"]))
add(item("8.8", "A proportional line passes through (6, 4). Find y when x = 9.", "6", 2))

# ---------------- 8.9 y = mx + b and slope ----------------
add(item("8.9", "Find the slope of the line through (1, 2) and (3, 8).", "3", 1, "b"))
add(item("8.9", "Find the slope of the line through (−2, 5) and (2, −3).", num(F(-3 - 5, 2 - (-2))), 2, "b"))
add(item("8.9", "Find the slope of the line through (0, 4) and (6, 7).", num(F(7 - 4, 6)), 2, "b"))
add(item("8.9", "What are the slope and y-intercept of y = −2x + 7?", "Slope −2, y-intercept 7", 1, "c", also=["m = −2, b = 7"]))
add(item("8.9", "A plumber charges §50 to come out plus §40 an hour. Write the cost as y = mx + b.", "y = 40x + 50", 2, "c"))
add(item("8.9", "In y = 40x + 50 (plumber cost), what does 50 mean?", "The §50 starting fee (the initial value)", 2, "c", also=["50", "starting fee"]))
add(item("8.9", "Write the equation of the line with slope 4 and y-intercept −3.", "y = 4x − 3", 1, "c"))
add(item("8.9", "Two slope triangles on the same line have {rise/run} = {2/3} and {6/9}. Why are the slopes the same?", "The triangles are similar, so {6/9} = {2/3}", 3, "a", also=["similar triangles"]))
add(item("8.9", "Lines y = 3x + 1 and y = 3x − 4 have the same slope. Are they the same line?", "No; they are parallel with different y-intercepts", 2, "d", also=["no"]))
add(item("8.9", "Line A goes through (0, 2) and (1, 5). Line B goes through (0, −1) and (2, 5). Do they have the same slope? Do they have the same y-intercept?", "Same slope (3), different y-intercepts (2 and −1)", 3, "d"))
add(item("8.9", "What is the slope of a horizontal line?", "0", 1, "b"))

# ---------------- 8.10 compare proportional and non-proportional ----------------
add(item("8.10", "Plan A: y = 8x. Plan B costs §20 plus §5 per month. Which costs less for 4 months?", "Plan A (§32 vs §40)", 2, also=["Plan A", "A"]))
add(item("8.10", "Plan A: y = 8x. Plan B: y = 5x + 20. After how many months do they cost the same?", "x = " + num(F(20, 3)) + " months (about 6.7)", 3, also=[num(F(20, 3)), "6{2/3}"]))
add(item("8.10", "Car A: y = 55x (miles in x hours). Car B travels 240 miles in 4 hours. Which car is faster?", "Car B (60 mph)", 2, also=["B", "Car B"]))
add(item("8.10", "Gym A: §30 a month. Gym B: §60 to join plus §20 a month. Which relationship is proportional?", "Gym A", 1, also=["A"]))
add(item("8.10", "Gym A: §30 a month. Gym B: §60 to join plus §20 a month. Which costs less for 12 months?", "Gym B (§300 vs §360)", 3, also=["B", "Gym B"]))
add(item("8.10", "A table shows x: 1, 2, 3 and y: 9, 18, 27. Another relationship is y = 9x + 1. Which is proportional?", "The table", 2))
add(item("8.10", "Which has the greater rate of change: y = 2.5x + 4 or a line through (0, 0) and (2, 6)?", "The line through (0, 0) and (2, 6) (rate 3)", 2, also=["the line", "3"]))
add(item("8.10", "Phone plan A: §0.10 per text. Plan B: §5 a month plus §0.05 per text. Which costs less for 200 texts?", "Plan B (§15 vs §20)", 3, also=["Plan B", "B"]))

# ---------------- 8.11 multi-step equations ----------------
def solve2(a, b, c, d):
    """ax + b = cx + d"""
    return F(d - b) / F(a - c)

for (a, b, c, d, lvl) in [(5, -3, 2, 12, 1), (7, 4, 3, -8, 2), (-2, 9, 4, -15, 2)]:
    add(item("8.11", "Solve: " + lin(a, b) + " = " + lin(c, d), "x = " + num(solve2(a, b, c, d)), lvl))
add(item("8.11", "Solve: 3(x + 4) = 27", "x = 5", 1))
add(item("8.11", "Solve: 4(2x − 1) = 3x + 11", "x = 3", 2))
add(item("8.11", "Solve: 2(x + 5) = 3(x − 1)", "x = 13", 2))
add(item("8.11", "Solve: {2/3}x + 4 = 10", "x = 9", 2))
add(item("8.11", "Solve: 0.5(x + 6) = 2x − 6", "x = 6", 3))
add(item("8.11", "Solve: 7x − 3x + 5 = 21", "x = 4", 1))
add(item("8.11", "Solve: 4x + 7 = 4x − 2", "No solution", 2, "a", choices=["One solution", "No solution", "Infinitely many solutions"]))
add(item("8.11", "Solve: 2(3x − 1) = 6x − 2", "Infinitely many solutions", 2, "a", choices=["One solution", "No solution", "Infinitely many solutions"]))
add(item("8.11", "How many solutions does 5x + 2 = 3x + 2 have?", "One solution (x = 0)", 2, "a", choices=["One solution (x = 0)", "No solution", "Infinitely many solutions"]))
add(item("8.11", "Gym A: §20 to join plus §15 a month. Gym B: §50 to join plus §10 a month. After how many months is the cost the same?", "6 months", 2, "b", also=["6"]))
add(item("8.11", "A rectangle's length is 5 more than its width. Its perimeter is 46. Find the length.", "14", 2, "b"))
add(item("8.11", "The sides of a triangle are x, x + 3 and 2x − 1. The perimeter is 30. Find the longest side.", "13", 3, "b"))
add(item("8.11", "Solve: {x/2} + 3 = {x/5} + 9", "x = 20", 3))

# ---------------- 8.12 systems ----------------
add(item("8.12", "Solve by substitution: y = 2x and x + y = 12", "(4, 8)", 1))
add(item("8.12", "Solve by substitution: y = x + 3 and 2x + y = 18", "(5, 8)", 2))
add(item("8.12", "Solve: y = 3x − 5 and y = x + 7", "(6, 13)", 2))
add(item("8.12", "Solve: y = −x + 4 and y = 2x − 2", "(2, 2)", 2))
add(item("8.12", "Two lines cross at (3, −1). What is the solution to the system?", "(3, −1)", 1, "a"))
add(item("8.12", "Why is the point where two lines cross the solution to the system?", "It is on both lines, so it makes both equations true", 2, "a"))
add(item("8.12", "How many solutions does y = 2x + 1 and y = 2x − 3 have?", "No solution (parallel lines)", 2, "b", choices=["One solution", "No solution (parallel lines)", "Infinitely many solutions"]))
add(item("8.12", "How many solutions does y = 3x + 2 and 2y = 6x + 4 have?", "Infinitely many solutions (same line)", 3, "b", choices=["One solution", "No solution", "Infinitely many solutions (same line)"]))
add(item("8.12", "Adult tickets are §8 and child tickets are §5. 20 tickets cost §130. How many adult tickets were sold?", "10", 3, "b"))
add(item("8.12", "Is (2, 5) a solution to y = 2x + 1 and y = x + 3?", "Yes (5 = 5 in both)", 2, "a", also=["yes"]))
add(item("8.12", "Store A: §10 plus §4 a shirt. Store B: §6 a shirt. When do they cost the same? How many shirts and what cost?", "5 shirts, §30", 3, "b", also=["(5, 30)"]))

# ---------------- 8.13 functions ----------------
add(item("8.13", "Is {(1, 2), (2, 4), (3, 6)} a function?", "Yes", 1, choices=["Yes", "No"]))
add(item("8.13", "Is {(1, 2), (1, 5), (3, 6)} a function?", "No (input 1 has two outputs)", 1, choices=["Yes", "No (input 1 has two outputs)"]))
add(item("8.13", "Is {(4, 1), (5, 1), (6, 1)} a function?", "Yes (each input has one output)", 2, choices=["Yes (each input has one output)", "No"]))
add(item("8.13", "Does a vertical line pass the vertical line test?", "No", 2, choices=["Yes", "No"]))
add(item("8.13", "A table has x: 1, 2, 2, 3 and y: 4, 5, 6, 7. Is it a function?", "No (x = 2 has two outputs)", 1, also=["no"]))
add(item("8.13", "In a function, each input has exactly ___ output.", "One", 1, also=["1"]))
add(item("8.13", "A mapping sends 1 → 3, 2 → 3, 3 → 5. Is it a function?", "Yes", 2, choices=["Yes", "No"]))
add(item("8.13", "Is x = y² (for example (4, 2) and (4, −2)) a function of x?", "No", 3, choices=["Yes", "No"]))

# ---------------- 8.14 evaluate functions ----------------
add(item("8.14", "f(x) = 3x − 4. Find f(5).", "11", 1))
add(item("8.14", "f(x) = −2x + 7. Find f(−3).", "13", 1))
add(item("8.14", "g(x) = x² + 1. Find g(4).", "17", 2))
add(item("8.14", "h(x) = {1/2}x + 6. Find h(10).", "11", 1))
add(item("8.14", "f(x) = 5x + 2. Find x when f(x) = 27.", "x = 5", 3))
add(item("8.14", "y = 4x − 1. Find y when x = −2.", "−9", 1))
add(item("8.14", "C(t) = 12t + 15 is the cost of t tickets. Find C(6).", "87", 2, also=["§87"]))
add(item("8.14", "f(x) = x² − 3x. Find f(−2).", "10", 3))

# ---------------- 8.15 compare functions; linear vs non-linear ----------------
add(item("8.15", "Is y = x² linear or non-linear?", "Non-linear", 1, "a", choices=["Linear", "Non-linear"]))
add(item("8.15", "Is y = 4 − 3x linear or non-linear?", "Linear", 1, "a", choices=["Linear", "Non-linear"]))
add(item("8.15", "Table: x 0, 1, 2, 3 and y 1, 2, 4, 8. Linear or non-linear?", "Non-linear (y doubles)", 2, "a", also=["non-linear", "nonlinear"]))
add(item("8.15", "Table: x 0, 1, 2, 3 and y 5, 8, 11, 14. Linear or non-linear?", "Linear (adds 3 each time)", 2, "a", also=["linear"]))
add(item("8.15", "Function A: y = 3x + 2. Function B goes through (0, 5) and (2, 9). Which has the greater rate of change?", "Function A (3 vs 2)", 2, also=["A"]))
add(item("8.15", "Function A: y = 3x + 2. Function B goes through (0, 5) and (2, 9). Which has the greater y-intercept?", "Function B (5 vs 2)", 2, also=["B"]))
add(item("8.15", "Is y = {6/x} linear?", "No", 2, "a", choices=["Yes", "No"]))
add(item("8.15", "Ana saves §10 a week starting with §25. Ben's savings are y = 12x. Who saves faster each week?", "Ben (§12 vs §10)", 2, also=["Ben"]))

# ---------------- 8.16 construct a linear function ----------------
add(item("8.16", "A pool has 500 gallons and drains 20 gallons a minute. Write a function for the gallons left.", "y = 500 − 20x", 1, also=["y = −20x + 500"]))
add(item("8.16", "Write the function for the line through (0, 3) and (2, 11).", "y = 4x + 3", 2))
add(item("8.16", "Write the function for the line through (1, 5) and (3, 9).", "y = 2x + 3", 2))
add(item("8.16", "A table shows x: 0, 1, 2 and y: 7, 4, 1. Write the function.", "y = −3x + 7", 2))
add(item("8.16", "A phone costs §40 a month plus §100 for the phone. What are the rate of change and initial value?", "Rate §40 per month, initial value §100", 1, "a", also=["40 and 100"]))
add(item("8.16", "A candle is 12 in tall and burns 1.5 in per hour. Write a function for its height h after t hours.", "h = 12 − 1.5t", 2, "a", also=["h = −1.5t + 12"]))
add(item("8.16", "A line goes through (2, 10) and (5, 19). What is the rate of change?", "3", 2, "a"))
add(item("8.16", "In y = −1.5t + 12 (candle height), what does −1.5 mean?", "The candle gets 1.5 inches shorter each hour", 2, "a"))
add(item("8.16", "Write the function for the line through (−2, 1) and (2, 9).", "y = 2x + 5", 3))

# ---------------- 8.17 analyze graphs ----------------
add(item("8.17", "A graph of a car's distance from home goes up in a straight line. Is the distance increasing or decreasing? Linear or non-linear?", "Increasing, linear", 1, also=["increasing linear"]))
add(item("8.17", "A graph of a ball's height goes up, then curves back down. Is it linear or non-linear?", "Non-linear", 1, choices=["Linear", "Non-linear"]))
add(item("8.17", "A line on a graph of water in a tank slants down from left to right. Is the water increasing or decreasing?", "Decreasing", 1, choices=["Increasing", "Decreasing"]))
add(item("8.17", "A graph of distance is flat (horizontal) from minute 5 to minute 8. What is happening?", "The person stopped (the distance did not change)", 2, also=["stopped", "not moving"]))
add(item("8.17", "A graph of a phone's battery drops quickly, then more slowly. Linear or non-linear?", "Non-linear", 2, choices=["Linear", "Non-linear"]))
add(item("8.17", "Sketch description: Sam walks to school at a steady pace, waits for a friend, then runs. Which part of the graph is steepest?", "The running part", 3, also=["running"]))
add(item("8.17", "A graph of height of a plant over weeks rises faster and faster. Is it increasing at a constant rate?", "No; it is non-linear", 2, also=["no"]))
add(item("8.17", "On a graph, a line goes down 3 units for every 1 unit right. Is the relationship increasing or decreasing?", "Decreasing", 1, choices=["Increasing", "Decreasing"]))

# ---------------- 8.18 scatter plots ----------------
add(item("8.18", "As hours studied go up, test scores go up. What kind of association is this?", "Positive", 1, choices=["Positive", "Negative", "No association"]))
add(item("8.18", "As a car's age goes up, its value goes down. What kind of association?", "Negative", 1, choices=["Positive", "Negative", "No association"]))
add(item("8.18", "Shoe size and favorite color. What kind of association?", "No association", 1, choices=["Positive", "Negative", "No association"]))
add(item("8.18", "Points: (1, 2), (2, 4), (3, 5), (4, 8), (5, 9), (6, 30). Which point is an outlier?", "(6, 30)", 2))
add(item("8.18", "On a scatter plot, most points form a group between x = 3 and x = 5. What is that called?", "A cluster", 1, also=["cluster", "clustering"]))
add(item("8.18", "Points: (1, 9), (2, 7), (3, 6), (4, 4), (5, 2). Positive, negative, or no association?", "Negative", 2, choices=["Positive", "Negative", "No association"]))
add(item("8.18", "Points curve up like a U shape. Is the association linear or non-linear?", "Non-linear", 2, choices=["Linear", "Non-linear"]))
add(item("8.18", "Temperature outside and hot chocolate sales. Likely positive or negative association?", "Negative", 2, choices=["Positive", "Negative"]))

# ---------------- 8.19 line of fit ----------------
add(item("8.19", "A good line of fit should have about how many points above and below it?", "About the same number above and below", 1, also=["the same", "equal"]))
add(item("8.19", "Points cluster close to a line of fit. Is it a good fit?", "Yes", 1, choices=["Yes", "No"]))
add(item("8.19", "A line of fit passes through (0, 10) and (5, 35). What is its equation?", "y = 5x + 10", 2))
add(item("8.19", "Points are spread far from the line in every direction. Is the line a good model?", "No", 1, choices=["Yes", "No"]))
add(item("8.19", "Which line fits (1, 3), (2, 5), (3, 7), (4, 9) best? A. y = x + 2  B. y = 2x + 1  C. y = 3x", "B", 2, choices=["A", "B", "C"]))
add(item("8.19", "Should a line of fit always go through the first and last points?", "No", 2, choices=["Yes", "No"]))
add(item("8.19", "A line of fit is y = 2x + 4. A data point is (3, 13). How far above the line is it?", "3 units", 3, also=["3"]))
add(item("8.19", "A line of fit passes through (2, 50) and (6, 70). What is its slope?", "5", 2))

# ---------------- 8.20 use a linear model ----------------
add(item("8.20", "A model is y = 3x + 20, where y is plant height in cm after x weeks. Predict the height after 10 weeks.", "50 cm", 1, also=["50"]))
add(item("8.20", "In y = 3x + 20 (plant height), what does 3 mean?", "The plant grows 3 cm each week", 1, "a", also=["3 cm per week"]))
add(item("8.20", "In y = 3x + 20 (plant height), what does 20 mean?", "The plant was 20 cm tall at week 0", 1, "a", also=["starting height"]))
add(item("8.20", "A model for ticket sales is y = 150x + 400 after x days. Predict sales on day 6.", "1,300", 2, also=["1300"]))
add(item("8.20", "A model is y = −2.5x + 90, where y is test score and x is hours of TV a day. Predict the score for 4 hours.", "80", 2))
add(item("8.20", "Using y = −2.5x + 90 (score vs TV hours), what does −2.5 mean?", "The score drops 2.5 points for each extra hour of TV", 2, "a"))
add(item("8.20", "Using y = 3x + 20 (plant height), when will the plant be 65 cm?", "Week 15", 3, also=["15"]))
add(item("8.20", "A model is y = 12x + 30 for savings after x weeks. How much is saved after 8 weeks?", "§126", 1, also=["126"]))

# ---------------- 8.21 two-way tables ----------------
TBL = "Of 50 students: 18 boys play sports, 7 boys do not; 15 girls play sports, 10 girls do not."
add(item("8.21", TBL + " How many students play sports?", "33", 1))
add(item("8.21", TBL + " How many girls are there?", "25", 1))
add(item("8.21", TBL + " What fraction of the boys play sports?", num(F(18, 25)), 2, also=["0.72", "72%"]))
add(item("8.21", TBL + " What percent of the girls play sports?", "60%", 2, also=["60"]))
add(item("8.21", TBL + " Is there an association between being a boy and playing sports?", "Yes, a weak one (72% of boys vs 60% of girls)", 3, also=["yes"]))
add(item("8.21", TBL + " What percent of all students do not play sports?", "34%", 2, also=["34"]))
add(item("8.21", TBL + " Of the students who play sports, what fraction are girls?", num(F(15, 33)), 3))
add(item("8.21", "In a two-way table, a row relative frequency compares a cell to its ___.", "Row total", 1, choices=["Row total", "Column total", "Grand total"]))

# ---------------- 8.22 rigid motions ----------------
add(item("8.22", "A segment is 5 cm long. After a rotation, how long is it?", "5 cm", 1, also=["5"]))
add(item("8.22", "An angle is 72°. After a reflection, what is its measure?", "72°", 1, also=["72"]))
add(item("8.22", "Two parallel lines are translated. Are the images parallel?", "Yes", 1, choices=["Yes", "No"]))
add(item("8.22", "Do rigid motions change size or shape?", "No", 1, choices=["Yes", "No"]))
add(item("8.22", "Triangle ABC is reflected and then translated to triangle DEF. Are the triangles congruent?", "Yes", 1, "a", choices=["Yes", "No"]))
add(item("8.22", "Which is NOT a rigid motion? A. Rotation  B. Reflection  C. Dilation  D. Translation", "C", 2, choices=["A", "B", "C", "D"]))
add(item("8.22", "Square A has sides 4. Square B has sides 6. Can rigid motions map A onto B?", "No (they are different sizes)", 2, "a", also=["no"]))
add(item("8.22", "Triangle P is at (1, 1), (3, 1), (1, 4). Triangle Q is at (4, 3), (6, 3), (4, 6). Describe a rigid motion that maps P onto Q.", "Translate 3 right and 2 up", 3, "a", also=["(x + 3, y + 2)"]))

# ---------------- 8.23 transformations on coordinates ----------------
add(item("8.23", "Translate (2, −3) 4 units left and 5 units up.", "(−2, 2)", 1))
add(item("8.23", "Reflect (3, 7) over the x-axis.", "(3, −7)", 1))
add(item("8.23", "Reflect (−4, 2) over the y-axis.", "(4, 2)", 1))
add(item("8.23", "Rotate (2, 5) 90° counterclockwise about the origin.", "(−5, 2)", 2))
add(item("8.23", "Rotate (3, −1) 180° about the origin.", "(−3, 1)", 2))
add(item("8.23", "Dilate (4, −6) by a scale factor of {1/2} centered at the origin.", "(2, −3)", 2))
add(item("8.23", "Dilate (−3, 2) by a scale factor of 3 centered at the origin.", "(−9, 6)", 1))
add(item("8.23", "Rotate (−1, 4) 90° clockwise about the origin.", "(4, 1)", 3))
add(item("8.23", "What rule describes a translation 6 left and 2 down?", "(x − 6, y − 2)", 2))
add(item("8.23", "A point (x, y) becomes (y, −x). What transformation is this?", "A 90° clockwise rotation about the origin", 3, also=["90° clockwise rotation", "rotation 90 clockwise"]))

# ---------------- 8.24 similarity ----------------
add(item("8.24", "Triangle A has sides 3, 4, 5. Triangle B has sides 6, 8, 10. Are they similar? What is the scale factor from A to B?", "Yes, scale factor 2", 1, also=["2", "yes"]))
add(item("8.24", "A rectangle 2 by 5 is dilated by a factor of 3. What are the new dimensions?", "6 by 15", 1))
add(item("8.24", "Are congruent figures also similar?", "Yes (scale factor 1)", 2, choices=["Yes (scale factor 1)", "No"]))
add(item("8.24", "A figure is dilated by {1/2}, then rotated 90°. Is the image similar to the original?", "Yes", 1, choices=["Yes", "No"]))
add(item("8.24", "Rectangle 4 by 6 and rectangle 6 by 8. Are they similar?", "No ({4/6} is not equal to {6/8})", 2, also=["no"]))
add(item("8.24", "Triangle (0, 0), (2, 0), (0, 4) maps to (0, 0), (6, 0), (0, 12). Describe the transformation.", "A dilation by a scale factor of 3 centered at the origin", 2, also=["dilation by 3", "scale factor 3"]))
add(item("8.24", "Two triangles have angles 40°, 60°, 80° and 40°, 60°, 80°. Are they similar?", "Yes", 2, choices=["Yes", "No"]))
add(item("8.24", "Similar triangles: one has sides 5, 7, 9 and the other's shortest side is 15. Find its longest side.", "27", 3))

# ---------------- 8.25 parallel lines and transversals, triangle sum ----------------
add(item("8.25", "Two parallel lines are cut by a transversal. One angle is 65°. Find its corresponding angle.", "65°", 1, also=["65"]))
add(item("8.25", "Two parallel lines are cut by a transversal. One angle is 110°. Find its alternate interior angle.", "110°", 1, also=["110"]))
add(item("8.25", "Two parallel lines are cut by a transversal. Same-side interior angles are (3x)° and (2x + 30)°. Find x.", "x = 30", 3))
add(item("8.25", "Alternate exterior angles are (4x − 10)° and (2x + 40)°. Find x.", "x = 25", 2))
add(item("8.25", "Corresponding angles are (5x + 5)° and 80°. Find x.", "x = 15", 2))
add(item("8.25", "Two angles of a triangle are 48° and 67°. Find the third angle.", "65°", 1, "a", also=["65"]))
add(item("8.25", "The angles of a triangle are (x + 3)°, (3x + 2)° and (2x + 1)°. Find x.", "x = 29", 2, "a"))
add(item("8.25", "An isosceles triangle has a vertex angle of 40°. Find each base angle.", "70°", 2, "a", also=["70"]))
add(item("8.25", "The angles of a triangle are in the ratio 2 : 3 : 4. Find the largest angle.", "80°", 3, "a", also=["80"]))
add(item("8.25", "An exterior angle of a triangle is 120°. One remote interior angle is 50°. Find the other.", "70°", 3, "a", also=["70"]))

# ---------------- 8.26 justify the Pythagorean Theorem and converse ----------------
add(item("8.26", "Write the Pythagorean Theorem.", "a² + b² = c²", 1))
add(item("8.26", "In a right triangle, what is the hypotenuse?", "The side across from the right angle (the longest side)", 1, also=["longest side"]))
add(item("8.26", "Is a triangle with sides 5, 12, 13 a right triangle?", "Yes (25 + 144 = 169)", 1, also=["yes"]))
add(item("8.26", "Is a triangle with sides 6, 7, 9 a right triangle?", "No (36 + 49 = 85, not 81)", 2, also=["no"]))
add(item("8.26", "Is a triangle with sides 8, 15, 17 a right triangle?", "Yes (64 + 225 = 289)", 2, also=["yes"]))
add(item("8.26", "Squares are drawn on the sides of a right triangle. The two small squares have areas 9 and 16. What is the area of the big square?", "25", 2))
add(item("8.26", "Is a triangle with sides 1.5, 2 and 2.5 a right triangle?", "Yes (2.25 + 4 = 6.25)", 3, also=["yes"]))
add(item("8.26", "Which side goes in c when you check sides 9, 40, 41?", "41 (the longest side)", 1, also=["41"]))

# ---------------- 8.27 distance between points ----------------
def dist(p, q):
    return math.hypot(q[0] - p[0], q[1] - p[1])

for (p, q, lvl) in [((1, 2), (4, 6), 1), ((-2, -1), (4, 7), 2), ((0, 0), (5, 12), 1), ((-3, 4), (3, -4), 2)]:
    d = dist(p, q)
    assert d == int(d)
    fmt = lambda t: "(" + ", ".join(num(v) for v in t) + ")"
    add(item("8.27", "Find the distance between " + fmt(p) + " and " + fmt(q) + ".", str(int(d)), lvl))
add(item("8.27", "Find the distance between (1, 1) and (4, 3). Round to the nearest tenth.", dec(F(round(dist((1, 1), (4, 3)), 1)).limit_denominator(1000)), 2, also=["√13"]))
add(item("8.27", "Find the distance between (−2, 3) and (2, −1). Round to the nearest tenth.", dec(F(round(dist((-2, 3), (2, -1)), 1)).limit_denominator(1000)), 3, also=["√32", "4√2"]))
add(item("8.27", "Points A(2, 1) and B(2, 9) are on a vertical line. How far apart are they?", "8", 1))
add(item("8.27", "On a map grid, school is at (0, 0) and the park is at (6, 8). Each unit is 1 block. How far is the park in a straight line?", "10 blocks", 2, also=["10"]))

# ---------------- 8.28 unknown side lengths ----------------
add(item("8.28", "The legs of a right triangle are 6 and 8. Find the hypotenuse.", "10", 1))
add(item("8.28", "A right triangle has a hypotenuse of 13 and a leg of 5. Find the other leg.", "12", 1))
add(item("8.28", "The legs are 7 and 24. Find the hypotenuse.", "25", 2))
add(item("8.28", "A 10-foot ladder leans against a wall. Its base is 6 feet from the wall. How high does it reach?", "8 feet", 2, also=["8"]))
add(item("8.28", "A TV screen is 32 in wide and 18 in tall. Find the diagonal to the nearest inch.", str(round(math.hypot(32, 18))) + " in", 3, also=[str(round(math.hypot(32, 18)))]))
add(item("8.28", "The legs of a right triangle are 4 and 5. Find the hypotenuse to the nearest tenth.", dec(F(round(math.hypot(4, 5), 1)).limit_denominator(1000)), 2, also=["√41"]))
add(item("8.28", "A soccer field is 100 yd by 60 yd. How long is the diagonal to the nearest yard?", str(round(math.hypot(100, 60))) + " yd", 3, also=[str(round(math.hypot(100, 60)))]))
add(item("8.28", "A square has a diagonal of 10 cm. Find the side length to the nearest tenth.", dec(F(round(10 / math.sqrt(2), 1)).limit_denominator(1000)) + " cm", 3, also=[dec(F(round(10 / math.sqrt(2), 1)).limit_denominator(1000)), "√50", "5√2"]))
add(item("8.28", "You walk 9 blocks north and 12 blocks east. How far are you from where you started in a straight line?", "15 blocks", 2, also=["15"]))

# ---------------- 8.29 deriving cone and sphere volume ----------------
add(item("8.29", "A cone and a cylinder have the same radius and height. How many cones of water fill the cylinder?", "3", 1))
add(item("8.29", "A cone has the same radius and height as a cylinder with volume 90 cm³. What is the cone's volume?", "30 cm³", 1, also=["30"]))
add(item("8.29", "A sphere fits exactly inside a cylinder (same radius, height = diameter). What fraction of the cylinder's volume is the sphere?", "{2/3}", 2))
add(item("8.29", "A cylinder with radius r and height 2r has volume 2πr³. What is the volume of a sphere with radius r?", "{4/3}πr³", 2))
add(item("8.29", "A cylinder holds 600 mL. A cone with the same radius and height is filled and poured in. How many times can you pour before the cylinder is full?", "3", 1))
add(item("8.29", "A cylinder (height = diameter) holds 150 cm³. What is the volume of the sphere that fits inside?", "100 cm³", 3, also=["100"]))
add(item("8.29", "Why is a cone's volume {1/3} of a cylinder's with the same base and height?", "Three cones of water fill the cylinder exactly", 2))
add(item("8.29", "Write the formula for the volume of a cone.", "V = {1/3}πr²h", 1, also=["1/3πr²h"]))

# ---------------- 8.30 volume of cylinders, cones and spheres ----------------
PI = F("3.14")
add(item("8.30", "Find the volume of a cylinder with radius 3 cm and height 10 cm. Use 3.14.", dec(PI * 9 * 10) + " cm³", 1, also=[dec(PI * 9 * 10)]))
add(item("8.30", "Find the volume of a cylinder with radius 4 in and height 5 in. Leave it in terms of π.", "80π in³", 1, also=["80π"]))
add(item("8.30", "Find the volume of a cone with radius 3 ft and height 4 ft. Leave it in terms of π.", "12π ft³", 2, also=["12π"]))
add(item("8.30", "Find the volume of a sphere with radius 3 m. Leave it in terms of π.", "36π m³", 2, also=["36π"]))
add(item("8.30", "Find the volume of a cone with diameter 10 cm and height 9 cm. Use 3.14.", dec(PI * 25 * 9 / 3) + " cm³", 2, also=[dec(PI * 25 * 9 / 3)]))
add(item("8.30", "Find the volume of a sphere with diameter 6 in. Use 3.14 and round to the nearest tenth.", dec(F(4, 3) * PI * 27, 1) + " in³", 2, also=[dec(F(4, 3) * PI * 27, 1)]))
add(item("8.30", "A can is 12 cm tall with a radius of 4 cm. How much does it hold? Use 3.14.", dec(PI * 16 * 12) + " cm³", 2, also=[dec(PI * 16 * 12)]))
add(item("8.30", "A cylinder has volume 72π and radius 3. Find its height.", "8", 3))
add(item("8.30", "A cone-shaped cup has radius 2 in and height 6 in. A cylinder cup has radius 2 in and height 6 in. How many cone cups fill the cylinder cup?", "3", 1))
add(item("8.30", "An ice cream cone (radius 1 in, height 5 in) has a half sphere of ice cream (radius 1 in) on top. Find the total volume in terms of π.", "{7/3}π in³", 3, also=["7/3π", "2{1/3}π"]))

# ---------------- more problems (checked Gemini drafts, Nov 2026): added last so earlier ids stay put ----------------
from more import more
out.extend(more("g8"))
