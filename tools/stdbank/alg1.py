"""Algebra I standards bank for 8th Accelerated (Alg I.1 to Alg I.41). Codes and parts come from data/standards.js only."""
from fractions import Fraction as F
import math
from common import num, dec, money, item

out = []
add = out.append


def A(n, q, a, lvl=2, part=None, choices=None, also=None):
    add(item("Alg I." + str(n), q, a, lvl, part, choices, also))


# 1 rational exponents meaning
A(1, "Write 9^{{1/2}} another way and evaluate it.", "√9 = 3", 1, also=["3"])
A(1, "Evaluate: 8^{{1/3}}", "2", 1)
A(1, "Evaluate: 16^{{3/4}}", "8", 2)
A(1, "Write ∛x as a power of x.", "x^{{1/3}}", 1, also=["x^(1/3)", "x^1/3"])
A(1, "Why does 5^{{1/2}} = √5? Use (5^{{1/2}})².", "(5^{{1/2}})² = 5¹ = 5, so 5^{{1/2}} is the number whose square is 5", 3, also=["√5"])
A(1, "Evaluate: 27^{{2/3}}", "9", 2)
A(1, "Evaluate: 25^{−{1/2}}", "{1/5}", 3, also=["0.2"])

# 2 rewrite radicals and rational exponents
A(2, "Simplify: √50", "5√2", 1)
A(2, "Simplify: √72", "6√2", 2)
A(2, "Simplify: √(x⁶)", "x³", 2, also=["x^3"])
A(2, "Write x^{{3/2}} as a radical.", "√(x³)", 2, also=["(√x)³", "x√x"])
A(2, "Simplify: x^{{1/2}} · x^{{3/2}}", "x²", 2, also=["x^2"])
A(2, "Simplify: (x^{{2/3}})³", "x²", 2, also=["x^2"])
A(2, "Simplify: √12 + √27", "5√3", 3)
A(2, "Simplify: ∛54", "3∛2", 3)

# 3 imaginary unit
A(3, "What is i²?", "−1", 1)
A(3, "Write √(−25) using i.", "5i", 1)
A(3, "Write √(−7) using i.", "i√7", 2, also=["√7i", "√7 i"])
A(3, "Simplify: i³", "−i", 2)
A(3, "Simplify: i⁴", "1", 2)
A(3, "Simplify: √(−36) + √(−4)", "8i", 3)
A(3, "Is √(−9) a real number?", "No (it is 3i)", 1, also=["no"])

# 4 interpret parts of expressions
A(4, "In 1,000(1.05)^t, what does 1.05 mean?", "The amount grows 5% each year", 1, also=["5% growth"])
A(4, "In 1,000(1.05)^t, what does 1,000 mean?", "The starting amount", 1, also=["initial amount", "starting value"])
A(4, "A phone plan costs 25 + 0.10t for t texts. What does 0.10 mean?", "§0.10 per text", 1, also=["10 cents per text"])
A(4, "In 500(0.8)^t, is the amount growing or decaying? By what percent?", "Decaying by 20% each period", 2, also=["decay 20%", "decaying"])
A(4, "The area of a garden is (x + 3)(x + 2). What do x + 3 and x + 2 stand for?", "The length and width", 2, also=["length and width"])
A(4, "h = −16t² + 64t + 5 gives a ball's height. What does 5 mean?", "The ball starts 5 ft above the ground", 2, also=["starting height", "5 ft"])
A(4, "P(1 + r)^t: if r = 0.03, what is the growth factor?", "1.03", 2)

# 5 structure to rewrite
A(5, "Factor: x² − 49", "(x + 7)(x − 7)", 1, also=["(x − 7)(x + 7)"])
A(5, "Factor: x⁴ − 16 completely.", "(x² + 4)(x + 2)(x − 2)", 3)
A(5, "Factor: 4x² − 9", "(2x + 3)(2x − 3)", 2, also=["(2x − 3)(2x + 3)"])
A(5, "Rewrite x² + 6x + 9 as a square.", "(x + 3)²", 2)
A(5, "Factor out the GCF: 6x³ + 9x²", "3x²(2x + 3)", 1)
A(5, "Find 51² − 49² using a difference of squares.", "200", 3)
A(5, "Factor: x² − 10x + 25", "(x − 5)²", 2)

# 6 equivalent forms reveal properties
A(6, "Factor y = x² − 5x + 6 to find the zeros.", "x = 2 and x = 3", 2, also=["2, 3", "2 and 3"])
A(6, "Complete the square: y = x² + 4x + 1. What is the vertex?", "(−2, −3)", 3)
A(6, "y = (x − 3)² + 4. What is the minimum value?", "4", 1)
A(6, "Rewrite 1.2^t as a monthly rate: 1.2^t = (1.2^{{1/12}})^{12t}. About what is the monthly growth factor? Round to 3 decimals.", dec(F(round(1.2 ** (1 / 12), 3)).limit_denominator(10000)), 3)
A(6, "y = (x + 1)(x − 7). Where is the axis of symmetry?", "x = 3", 2)
A(6, "Which form shows the zeros of a quadratic: standard, vertex, or factored?", "Factored", 1, choices=["Standard", "Vertex", "Factored"])
A(6, "Which form shows the vertex of a quadratic: standard, vertex, or factored?", "Vertex", 1, choices=["Standard", "Vertex", "Factored"])
A(6, "Find the zeros of y = x² + 2x − 15 by factoring.", "x = −5 and x = 3", 2, also=["−5, 3", "−5 and 3"])

# 7 polynomial operations
A(7, "Add: (3x² + 2x − 5) + (x² − 4x + 7)", "4x² − 2x + 2", 1)
A(7, "Subtract: (5x² − 3x + 1) − (2x² + x − 4)", "3x² − 4x + 5", 2)
A(7, "Multiply: (x + 4)(x − 2)", "x² + 2x − 8", 1)
A(7, "Multiply: (2x − 3)(x + 5)", "2x² + 7x − 15", 2)
A(7, "Multiply: (x − 6)²", "x² − 12x + 36", 2)
A(7, "Multiply: 3x(x² − 2x + 4)", "3x³ − 6x² + 12x", 1)
A(7, "Multiply: (x + 1)(x² − x + 1)", "x³ + 1", 3)
A(7, "Is the product of two polynomials always a polynomial?", "Yes (polynomials are closed under multiplication)", 2, choices=["Yes (polynomials are closed under multiplication)", "No"])
A(7, "What is the degree of 4x³ − x⁵ + 2?", "5", 1)

# 8 extraneous solutions with absolute value
A(8, "Solve: |x − 3| = 7", "x = 10 or x = −4", 1, also=["10, −4", "−4, 10"])
A(8, "Solve: |2x + 1| = 9", "x = 4 or x = −5", 2, also=["4, −5", "−5, 4"])
A(8, "Solve: |x + 5| = −2", "No solution (an absolute value cannot be negative)", 1, also=["no solution"])
A(8, "Solve: |x| + 4 = 10", "x = 6 or x = −6", 1, also=["±6"])
A(8, "Solve and check: |x − 1| = 2x + 4", "x = −1 (x = −5 is extraneous)", 3, also=["−1", "x = −1"])
A(8, "Why must you check answers to |x + 2| = x − 4?", "Splitting into two cases can give a value that makes x − 4 negative, and an absolute value cannot equal a negative number, so that value is extraneous", 2)
A(8, "Solve and check: |3x| = x + 8", "x = 4 or x = −2", 3, also=["4, −2", "−2, 4"])

# 9 quadratics
A(9, "Solve by inspection: x² = 49", "x = ±7", 1, "b", also=["±7", "7 and −7"])
A(9, "Solve: (x − 2)² = 25", "x = 7 or x = −3", 2, "b", also=["7, −3", "−3, 7"])
A(9, "Solve by factoring: x² + 5x + 6 = 0", "x = −2 or x = −3", 2, "b", also=["−2, −3", "−3, −2"])
A(9, "Solve: x² − 4x − 12 = 0", "x = 6 or x = −2", 2, "b", also=["6, −2", "−2, 6"])
A(9, "Complete the square: x² + 6x = 7. Write it as (x + p)² = q.", "(x + 3)² = 16", 2, "a")
A(9, "Complete the square to solve: x² − 8x + 3 = 0", "x = 4 ± √13", 3, "a", also=["4 ± √13"])
A(9, "Solve with the quadratic formula: 2x² + 3x − 2 = 0", "x = {1/2} or x = −2", 3, "b", also=["1/2, −2", "0.5, −2"])
A(9, "Solve: x² + 9 = 0", "x = ±3i (no real solutions)", 3, "b", also=["±3i", "no real solution"])
A(9, "What is the discriminant of x² + 2x + 5? How many real solutions?", "−16; no real solutions", 3, "b", also=["−16"])
A(9, "Solve: 3x² = 48", "x = ±4", 1, "b", also=["±4"])

# 10 systems by elimination
A(10, "Solve by elimination: x + y = 10 and x − y = 4", "(7, 3)", 1, "a")
A(10, "Solve by elimination: 2x + 3y = 12 and 2x − y = 4", "(3, 2)", 2, "a")
A(10, "Solve: 3x + 2y = 16 and x − 2y = 0", "(4, 2)", 2, "a")
A(10, "Solve: 4x + 3y = 5 and 2x + y = 1", "(−1, 3)", 3, "a")
A(10, "Which method is faster for y = 3x − 1 and 2x + y = 9: substitution or elimination?", "Substitution (y is already alone)", 1, "a", also=["substitution"])
A(10, "Solve y = 3x − 1 and 2x + y = 9.", "(2, 5)", 2, "a")
A(10, "A table for y = 2x + 1 and y = −x + 7 shows the same y at x = 2. What is the solution?", "(2, 5)", 2, "b")
A(10, "Elimination gives 0 = 6. What does that mean?", "No solution", 2, "b", choices=["One solution", "No solution", "Infinitely many solutions"])

# 11 create equations/inequalities in one variable
A(11, "You have §60 and spend §4 a day. Write and solve an inequality for the days d until you have less than §20.", "60 − 4d < 20, so d > 10", 2, also=["d > 10"])
A(11, "Solve: 3x − 7 ≥ 11", "x ≥ 6", 1)
A(11, "Solve: −2x + 5 < 13", "x > −4", 1)
A(11, "Solve: −3 ≤ 2x + 1 < 9", "−2 ≤ x < 4", 2)
A(11, "Solve: |x − 4| < 3", "1 < x < 7", 2)
A(11, "Solve: |x + 2| ≥ 5", "x ≤ −7 or x ≥ 3", 3)
A(11, "A rectangle's length is 3 more than its width. Its area is 40. Write and solve an equation for the width.", "w(w + 3) = 40, w = 5", 3, also=["5", "w = 5"])
A(11, "A population of 200 doubles every year. Write an equation for when it reaches 3,200 and solve it.", "200 · 2^t = 3,200, t = 4 years", 3, also=["4", "t = 4"])
A(11, "Your test scores are 82 and 91. What score x on the 3rd test gives an average of at least 88?", "x ≥ 91", 2, also=["91"])

# 12 equations in two variables in context
A(12, "Hot dogs cost §3 and drinks cost §2. You spend §24. Write an equation.", "3h + 2d = 24", 1)
A(12, "A plant is 4 cm tall and grows 1.5 cm a week. Write an equation for height h after w weeks.", "h = 1.5w + 4", 1)
A(12, "A car worth §20,000 loses 15% of its value each year. Write an equation for its value v after t years.", "v = 20,000(0.85)^t", 2, also=["v = 20000(0.85)^t"])
A(12, "Using 3h + 2d = 24, if you buy 4 hot dogs, how many drinks?", "6", 1)
A(12, "A ball's height is h = −16t² + 48t. When does it land?", "t = 3 seconds", 3, also=["3"])
A(12, "Using v = 20,000(0.85)^t, predict the value after 2 years.", money(20000 * F("0.85") ** 2), 2, also=["14450", "14,450"])
A(12, "When you graph h = 1.5w + 4, what labels go on the axes?", "Weeks on the x-axis, height in cm on the y-axis", 1)

# 13 constraints, viable solutions
A(13, "You can spend at most §50 on shirts (§10) and hats (§5). Write the constraint.", "10s + 5h ≤ 50", 1)
A(13, "Using 10s + 5h ≤ 50, is buying 3 shirts and 5 hats viable?", "No (§55 is over §50)", 2, also=["no"])
A(13, "Using 10s + 5h ≤ 50, is (2.5, 4) a viable answer?", "No (you cannot buy half a shirt)", 2, also=["no"])
A(13, "A system: x + y ≤ 8, x ≥ 2, y ≥ 0. Is (3, 4) a solution?", "Yes", 1, choices=["Yes", "No"])
A(13, "A system: x + y ≤ 8, x ≥ 2, y ≥ 0. Is (1, 5) a solution?", "No (x must be at least 2)", 1, also=["no"])
A(13, "Solve the system: y = x² and y = 4", "(2, 4) and (−2, 4)", 3)
A(13, "A field trip needs at least 60 seats. Vans hold 8 and cars hold 4. Write the constraint.", "8v + 4c ≥ 60", 2)
A(13, "In a problem about tickets sold, is −3 a viable solution?", "No (you cannot sell negative tickets)", 1, also=["no"])

# 14 graph as the set of solutions
A(14, "Is (2, 7) on the graph of y = 3x + 1?", "Yes (3(2) + 1 = 7)", 1, also=["yes"])
A(14, "Is (−1, 3) on the graph of y = x² + 1?", "No (y would be 2)", 1, also=["no"])
A(14, "The graph of 2x + y = 6 crosses the y-axis where?", "(0, 6)", 1)
A(14, "Find k so that (3, k) is on the graph of y = 2x − 5.", "k = 1", 2)
A(14, "What does the graph of an equation in two variables show?", "Every solution (x, y) of the equation", 1)
A(14, "Is (4, −2) on the graph of y = |x − 6|?", "No (y would be 2)", 2, also=["no"])
A(14, "Find the x-intercept of 3x − 4y = 12.", "(4, 0)", 2)

# 15 function notation, domain, range
A(15, "f(x) = 2x² − 3. Find f(−2).", "5", 1)
A(15, "f(x) = 3(2)^x. Find f(3).", "24", 1)
A(15, "f(x) = |x − 5|. Find f(1).", "4", 1)
A(15, "f(x) = 4x − 7. Solve f(x) = 13.", "x = 5", 2)
A(15, "C(n) = 15n + 40 is the cost of n people at a party. What does C(10) = 190 mean?", "10 people cost §190", 2)
A(15, "What is the domain of {(1, 3), (2, 5), (4, 3)}?", "{1, 2, 4}", 1)
A(15, "What is the range of {(1, 3), (2, 5), (4, 3)}?", "{3, 5}", 1)
A(15, "A function gives the height of a ball for 0 ≤ t ≤ 4 seconds. What is a sensible domain?", "0 ≤ t ≤ 4", 2)
A(15, "What is the range of f(x) = x² + 2?", "y ≥ 2", 3, also=["f(x) ≥ 2"])

# 16 relations vs functions
A(16, "Is y = 3x − 2 a function?", "Yes", 1, choices=["Yes", "No"])
A(16, "Is x² + y² = 25 a function?", "No (most x values have two y values)", 2, also=["no"])
A(16, "Table x: 1, 2, 3, 1 and y: 5, 6, 7, 8. Function or not?", "Not a function (x = 1 has two outputs)", 1, also=["no", "not a function"])
A(16, "Is y = |x| a function?", "Yes", 1, choices=["Yes", "No"])
A(16, "Is x = 4 (a vertical line) a function?", "No", 2, choices=["Yes", "No"])
A(16, "Every function is a relation. Is every relation a function?", "No", 1, choices=["Yes", "No"])
A(16, "Is y² = x a function of x?", "No", 3, choices=["Yes", "No"])

# 17 combine functions
A(17, "f(x) = 2x + 3 and g(x) = x². Find (f + g)(2).", "11", 1, "a")
A(17, "f(x) = 2x + 3 and g(x) = x². Find (f − g)(3).", "0", 2, "a")
A(17, "f(x) = 2x + 3 and g(x) = x². Find f(g(2)).", "11", 2, "b")
A(17, "f(x) = 2x + 3 and g(x) = x². Find g(f(2)).", "49", 2, "b")
A(17, "Water flows in at 5 gal per min: I(t) = 5t. It evaporates at 0.5 gal per min: E(t) = 0.5t. Write W(t) for the water in the tank.", "W(t) = 4.5t", 2, "a")
A(17, "T(h) = 70 + 2h gives temperature after h hours. S(T) = 3T − 50 gives sales at temperature T. Find S(T(5)).", "190", 3, "b")
A(17, "f(x) = x − 4 and g(x) = 3x. Write f(g(x)).", "3x − 4", 2, "b")
A(17, "f(x) = x + 1 and g(x) = x − 1. Find f(x) · g(x).", "x² − 1", 2, "a")

# 18 linear-quadratic systems graphically
A(18, "Solve: y = x² and y = x + 2", "(2, 4) and (−1, 1)", 2)
A(18, "Solve: y = x² − 1 and y = 3", "(2, 3) and (−2, 3)", 1)
A(18, "How many solutions can a system of a line and a parabola have?", "0, 1 or 2", 1, also=["0, 1, or 2"])
A(18, "Solve: y = x² + 1 and y = 2x", "(1, 2)", 3)
A(18, "Does y = x² + 3 meet y = 1?", "No (x² + 3 is always at least 3)", 2, also=["no"])
A(18, "Solve: y = x² − 4x and y = −4", "(2, −4)", 2)

# 19 f(x) = g(x) from graphs/tables
A(19, "The graphs of y = 2x + 1 and y = 7 cross at x = 3. What does x = 3 solve?", "2x + 1 = 7", 1)
A(19, "Use a table: for which whole x is 2^x = x + 2? Try x = 0, 1, 2, 3.", "x = 2", 2)
A(19, "f(x) = x² and g(x) = 9. Where do the graphs meet? What equation does that solve?", "x = 3 and x = −3; x² = 9", 2, also=["±3"])
A(19, "Graphs of y = |x − 1| and y = 3 cross at what x-values?", "x = 4 and x = −2", 2, also=["4, −2"])
A(19, "Why are the x-coordinates where y = f(x) and y = g(x) cross the solutions of f(x) = g(x)?", "At those x-values the two outputs are equal", 2)
A(19, "Estimate the solution to 2^x = 5 between two whole numbers.", "Between 2 and 3", 3, also=["2 and 3"])

# 20 linear inequalities in two variables
A(20, "Is (1, 1) a solution of y > 2x − 3?", "Yes (1 > −1)", 1, also=["yes"])
A(20, "For y < x + 2, is the boundary line solid or dashed?", "Dashed", 1, choices=["Solid", "Dashed"])
A(20, "For y ≥ −x + 4, do you shade above or below the line?", "Above", 1, choices=["Above", "Below"])
A(20, "Is (0, 0) a solution of 3x + 2y ≥ 6?", "No", 2, choices=["Yes", "No"])
A(20, "Is (2, 3) in the solution of y > x and y < 5?", "Yes", 2, choices=["Yes", "No"])
A(20, "Write the inequality: boundary y = 2x + 1, dashed, shaded below.", "y < 2x + 1", 2)
A(20, "Is (4, 0) a solution of x + y ≤ 3 and y ≥ 0?", "No (4 + 0 is more than 3)", 2, also=["no"])

# 21 compare two functions in different forms
A(21, "f(x) = x² + 3. g has a minimum of 1 on its graph. Which has the smaller minimum?", "g", 2)
A(21, "f(x) = 2(3)^x. Table for g: x 0, 1, 2 and y 2, 5, 8. Which grows faster as x increases?", "f", 2, also=["f(x)"])
A(21, "f(x) = −(x − 2)² + 6. g(x) has a maximum of 9. Which has the greater maximum?", "g", 2)
A(21, "f(x) = |x| + 1 and g(x) = 2x + 1. What is the same about them at x = 0?", "Both equal 1 (same y-intercept)", 1, also=["1"])
A(21, "f(x) = 3x + 2. g goes through (0, 4) and (2, 8). Which has the greater slope?", "f (3 vs 2)", 1, also=["f"])
A(21, "f(x) = x² − 4 has zeros at ±2. g(x) = (x − 1)(x + 5). Which has the zero farther from 0?", "g (at x = −5)", 2, also=["g"])

# 22 sequences
A(22, "Find the next term: 3, 7, 11, 15, …", "19", 1, "a")
A(22, "Write an explicit formula: 3, 7, 11, 15, …", "aₙ = 4n − 1", 2, "a", also=["4n − 1"])
A(22, "Find the next term: 2, 6, 18, 54, …", "162", 1, "a")
A(22, "Write an explicit formula: 2, 6, 18, 54, …", "aₙ = 2(3)^{n − 1}", 2, "a", also=["2(3)^(n−1)", "2·3^(n−1)"])
A(22, "Write a recursive formula: 5, 8, 11, 14, …", "a₁ = 5, aₙ = aₙ₋₁ + 3", 2, "a", also=["a_n = a_(n−1) + 3"])
A(22, "Write a recursive formula: 80, 40, 20, 10, …", "a₁ = 80, aₙ = {1/2}aₙ₋₁", 2, "a", also=["a_n = 0.5a_(n−1)"])
A(22, "Find the 20th term of 3, 7, 11, 15, …", "79", 3, "a")
A(22, "Is an arithmetic sequence linear or exponential?", "Linear", 1, "a", choices=["Linear", "Exponential"])
A(22, "What is the domain of a sequence?", "Whole numbers 1, 2, 3, … (a subset of the integers)", 2)

# 23 transformations of graphs
A(23, "How does y = x² + 5 compare to y = x²?", "It shifts up 5", 1, also=["up 5"])
A(23, "How does y = (x − 3)² compare to y = x²?", "It shifts right 3", 1, also=["right 3"])
A(23, "How does y = |x + 4| compare to y = |x|?", "It shifts left 4", 1, also=["left 4"])
A(23, "How does y = 3x² compare to y = x²?", "It is a vertical stretch by 3 (narrower)", 2, also=["stretch", "narrower"])
A(23, "How does y = −x² compare to y = x²?", "It is reflected over the x-axis", 2, also=["reflection over the x-axis", "flipped"])
A(23, "f(x) = x². g(x) is the graph shifted down 2 and right 1. Write g(x).", "g(x) = (x − 1)² − 2", 2)
A(23, "g(x) = f(x) + k. g is f moved down 6. Find k.", "k = −6", 1)
A(23, "f(x) = 2^x. What is g(x) = 2^x − 3?", "f shifted down 3", 2, also=["down 3"])
A(23, "How does y = {1/2}|x| compare to y = |x|?", "Vertical shrink by {1/2} (wider)", 2, also=["wider", "shrink"])

# 24 linear vs exponential
A(24, "A table goes 4, 8, 12, 16. Linear or exponential?", "Linear (adds 4)", 1, "a", also=["linear"])
A(24, "A table goes 4, 8, 16, 32. Linear or exponential?", "Exponential (times 2)", 1, "a", also=["exponential"])
A(24, "A town grows by 300 people each year. Linear or exponential?", "Linear", 1, "b", choices=["Linear", "Exponential"])
A(24, "A town grows by 3% each year. Linear or exponential?", "Exponential", 1, "c", choices=["Linear", "Exponential"])
A(24, "Write a function: you start with §50 and add §15 a week.", "y = 15x + 50", 2, "b")
A(24, "Write a function: a §900 laptop loses 20% of its value each year.", "y = 900(0.8)^x", 2, "c")
A(24, "Bacteria start at 100 and triple every hour. Write a function.", "y = 100(3)^x", 2, "c")
A(24, "Over equal intervals, an exponential function grows by equal ___.", "Factors", 2, "a", choices=["Differences", "Factors"])

# 25 construct linear and exponential functions
A(25, "Write the linear function through (0, 2) and (3, 14).", "y = 4x + 2", 1)
A(25, "Write the exponential function through (0, 5) and (1, 15).", "y = 5(3)^x", 1)
A(25, "Write the exponential function through (0, 64) and (2, 16).", "y = 64({1/2})^x", 2, also=["y = 64(0.5)^x"])
A(25, "Write the linear function through (2, 9) and (6, 21).", "y = 3x + 3", 2)
A(25, "Write the exponential function through (1, 6) and (2, 18).", "y = 2(3)^x", 3)
A(25, "A table: x 0, 1, 2, 3 and y 3, 6, 12, 24. Write the function.", "y = 3(2)^x", 2)
A(25, "A table: x 0, 1, 2, 3 and y 10, 7, 4, 1. Write the function.", "y = −3x + 10", 2)

# 26 exponential eventually exceeds
A(26, "Compare y = 2^x and y = 10x at x = 6.", "2^6 = 64 vs 10(6) = 60, so 2^x is bigger", 2, also=["2^x"])
A(26, "At x = 5, which is bigger: y = 2^x or y = 10x?", "10x (50 vs 32)", 1, also=["10x"])
A(26, "Which eventually grows larger: y = 100x or y = 1.1^x?", "y = 1.1^x", 2, also=["1.1^x", "exponential"])
A(26, "Which is larger at x = 10: y = x² or y = 2^x?", "2^x (1,024 vs 100)", 2, also=["2^x"])
A(26, "Job A pays §1,000 a day. Job B pays 1 cent on day 1 and doubles each day. On which day does Job B's daily pay first pass Job A's?", "Day 18", 3, also=["18"])
A(26, "Can a linear function with a large slope stay above an increasing exponential function forever?", "No", 1, choices=["Yes", "No"])

# 27 interpret parameters
A(27, "In y = 25x + 150, where y is total savings after x weeks, what does 150 mean?", "§150 saved at the start", 1, also=["starting amount"])
A(27, "In y = 25x + 150 (savings), what does 25 mean?", "§25 saved each week", 1)
A(27, "In y = 3,000(1.04)^t for a town's population, what does 1.04 mean?", "The population grows 4% each year", 1, also=["4% growth"])
A(27, "In y = 3,000(1.04)^t, what does 3,000 mean?", "The starting population", 1)
A(27, "In y = 80(0.9)^t for a medicine in the body (mg), what percent leaves each hour?", "10%", 2, also=["10"])
A(27, "In y = −12x + 300 for fuel in a tank, what does −12 mean?", "The tank loses 12 units of fuel each hour (or each unit of x)", 2)

# 28 key features
A(28, "y = −(x − 4)² + 9. What is the maximum?", "9", 1)
A(28, "y = (x − 1)(x − 5). What are the x-intercepts?", "x = 1 and x = 5", 1, also=["1, 5", "(1, 0) and (5, 0)"])
A(28, "y = x² − 6x + 8. What is the y-intercept?", "(0, 8)", 1, also=["8"])
A(28, "y = (x − 3)² − 4. On what interval is it decreasing?", "x < 3", 2)
A(28, "y = 2^x. What happens as x gets very negative?", "y gets close to 0", 2, also=["approaches 0"])
A(28, "A ball's height h(t) = −16t² + 32t + 48. When is it highest, and how high?", "At t = 1 s, 64 ft", 3, also=["(1, 64)"])
A(28, "Where is y = |x + 2| − 3 at its minimum?", "(−2, −3)", 2)
A(28, "y = −2x + 6. Where is it positive?", "x < 3", 2)

# 29 average rate of change
A(29, "f(x) = x². Find the average rate of change from x = 1 to x = 4.", "5", 1)
A(29, "f(x) = 2^x. Find the average rate of change from x = 0 to x = 3.", num(F(8 - 1, 3)), 2, also=["2.33"])
A(29, "A car is 30 miles away at 1 h and 150 miles away at 3 h. What is its average rate of change?", "60 miles per hour", 1, also=["60"])
A(29, "f(x) = |x|. Find the average rate of change from x = −4 to x = 2.", num(F(2 - 4, 2 - (-4))), 2)
A(29, "Table: x 0, 2, 4 and y 5, 13, 37. Find the average rate of change from 2 to 4.", "12", 2)
A(29, "f(x) = −x² + 10. Find the average rate of change from x = 0 to x = 3.", "−3", 2)
A(29, "h(t) = −16t² + 64t. Find the average rate of change from t = 1 to t = 3.", "0", 3)

# 30 graph functions, key features
A(30, "Graph y = x² − 4. What are the x-intercepts and the minimum?", "x = ±2; minimum (0, −4)", 2, "a", also=["±2"])
A(30, "y = −x² + 2x + 3. Find the vertex.", "(1, 4)", 2, "a")
A(30, "Find the x- and y-intercepts of y = 3x − 6.", "x-intercept (2, 0), y-intercept (0, −6)", 1, "a")
A(30, "y = |x − 2| + 1. Where is the vertex?", "(2, 1)", 1, "b")
A(30, "A step function: parking costs §5 for each hour or part of an hour. What do 2.5 hours cost?", "§15", 2, "b", also=["15"])
A(30, "f(x) = x + 1 when x < 0, and f(x) = 2x when x ≥ 0. Find f(−3) and f(3).", "f(−3) = −2, f(3) = 6", 2, "b", also=["−2 and 6"])
A(30, "y = 3(2)^x. What is the y-intercept?", "(0, 3)", 1, "c", also=["3"])
A(30, "y = 5({1/2})^x. As x gets large, what happens to y?", "y gets close to 0", 2, "c", also=["approaches 0"])
A(30, "Does y = 4(3)^x have an x-intercept?", "No (y is always positive)", 2, "c", also=["no"])

# 31 modeling cycle
A(31, "A rocket's height is h = −16t² + 96t. When does it land?", "6 seconds", 2, also=["6", "t = 6"])
A(31, "You invest §2,000 at 5% growing yearly. Write a model and find the value after 3 years.", "y = 2,000(1.05)^t; " + money(2000 * F("1.05") ** 3), 3, also=[money(2000 * F("1.05") ** 3), "2315.25"])
A(31, "A gym costs §30 to join and §20 a month. You have §190. Model it and find the months you can pay for.", "30 + 20m ≤ 190, 8 months", 2, also=["8"])
A(31, "A model predicts 1,250.6 people at a game. What should you report?", "About 1,251 people (whole people)", 1, also=["1251", "1,251"])
A(31, "After using a model to predict, what is the next step of the modeling cycle?", "Check whether the answer makes sense in the situation and revise if needed", 2, also=["validate", "check"])
A(31, "A fence costs §12 a foot. A square pen has area 144 ft². How much does the fence cost?", "§576", 3, also=["576"])

# 32 bivariate categorical data, risk
A(32, "Of 200 drivers, 40 texted while driving and 12 of them had a crash. 160 did not text and 8 had a crash. Find the crash rate for texters.", "30%", 2, also=["0.3", "30"])
A(32, "Using the data above, find the crash rate for non-texters.", "5%", 2, also=["0.05", "5"])
A(32, "Using the data above, how many times as likely is a crash for texters?", "6 times", 3, also=["6"])
A(32, "Of 100 students who sleep less than 7 hours, 45 are often tired. Of 100 who sleep more, 15 are. Does sleep seem related to being tired?", "Yes (45% vs 15%)", 2, also=["yes"])
A(32, "Does an association in a two-way table prove that one thing causes the other?", "No", 1, choices=["Yes", "No"])
A(32, "A vaccine group of 500 had 10 sick; a no-vaccine group of 500 had 50 sick. Which group had the lower risk?", "The vaccine group (2% vs 10%)", 2, also=["vaccine"])

# 33 investigation, association
A(33, "You want to know if 8th graders who play sports prefer outdoor lunch. Name the two categorical variables.", "Plays sports (yes/no) and lunch preference (indoor/outdoor)", 1)
A(33, "In your survey, 70% of athletes and 30% of non-athletes prefer outdoor lunch. Is there an association?", "Yes", 1, choices=["Yes", "No"])
A(33, "In your survey, 52% of athletes and 50% of non-athletes prefer outdoor lunch. Is there an association?", "Little or none (the rates are about the same)", 2, also=["no"])
A(33, "Why should you survey a random sample for an investigation?", "So the results represent the whole group without bias", 2)
A(33, "Write one sentence to argue there is an association from 70% vs 30%.", "Athletes prefer outdoor lunch much more often (70%) than non-athletes (30%), so the variables seem associated", 3)
A(33, "What kind of table organizes two categorical variables?", "A two-way table", 1, also=["two-way table"])

# 34 quantitative vs categorical
A(34, "Is \"favorite color\" quantitative or categorical?", "Categorical", 1, choices=["Quantitative", "Categorical"])
A(34, "Is \"height in inches\" quantitative or categorical?", "Quantitative", 1, choices=["Quantitative", "Categorical"])
A(34, "Is \"zip code\" quantitative or categorical?", "Categorical (you do not do math with zip codes)", 2, choices=["Quantitative", "Categorical (you do not do math with zip codes)"])
A(34, "Which display fits categorical data: a bar graph or a histogram?", "Bar graph", 1, choices=["Bar graph", "Histogram"])
A(34, "Which display fits two quantitative variables?", "Scatter plot", 1, choices=["Scatter plot", "Two-way table", "Pie chart"])
A(34, "Can you find the mean of categorical data?", "No", 1, choices=["Yes", "No"])
A(34, "Is \"number of pets\" quantitative or categorical?", "Quantitative", 1, choices=["Quantitative", "Categorical"])

# 35 two-way frequency tables
T = "Survey of 80 students: 20 boys like cats, 15 boys like dogs; 25 girls like cats, 20 girls like dogs."
A(35, T + " How many students like cats?", "45", 1, "a")
A(35, T + " What is the joint relative frequency of girls who like dogs?", num(F(20, 80)), 2, "b", also=["0.25", "25%"])
A(35, T + " What is the marginal relative frequency of boys?", num(F(35, 80)), 2, "b", also=["0.4375", "43.75%"])
A(35, T + " Of the boys, what fraction like cats?", num(F(20, 35)), 2, "b", also=["57%"])
A(35, T + " Of the girls, what fraction like cats?", num(F(25, 45)), 2, "b", also=["56%"])
A(35, T + " Is there a strong association between gender and pet preference?", "No (about 57% of boys and 56% of girls like cats)", 3, "c", also=["no"])
A(35, "In a segmented bar graph, each bar adds up to what percent?", "100%", 1, "a", also=["100"])

# 36 aggregate data
A(36, "Class A: 12 of 20 passed. Class B: 18 of 30 passed. Combine them. What percent passed overall?", "60%", 2, "a", also=["60"])
A(36, "School 1: 30 of 50 ride the bus. School 2: 45 of 100 ride the bus. What fraction ride overall?", num(F(75, 150)), 2, "a", also=["50%"])
A(36, "Two clubs: Club A has 8 of 10 who like pizza, Club B has 20 of 40. What is the overall percent?", "56%", 2, "a", also=["56"])
A(36, "Why can combined percents differ from the average of two percents?", "The groups have different sizes", 3, "a")
A(36, "Make a two-way table total: 15 + 25 in row 1 and 10 + 30 in row 2. What is the grand total?", "80", 1)
A(36, "A store tracks 60 morning and 40 evening buyers. 30 morning and 30 evening buyers used coupons. What percent of all buyers used coupons?", "60%", 2, "a", also=["60"])

# 37 events, unions, intersections, complements
A(37, "A number cube is rolled. List the event \"even.\"", "{2, 4, 6}", 1)
A(37, "A number cube is rolled. A = even, B = greater than 3. List A and B (both).", "{4, 6}", 2)
A(37, "A number cube is rolled. A = even, B = greater than 3. List A or B.", "{2, 4, 5, 6}", 2)
A(37, "A number cube is rolled. What is the complement of \"rolling a 1 or 2\"?", "{3, 4, 5, 6}", 1)
A(37, "P(A) = 0.35. What is P(not A)?", "0.65", 1)
A(37, "How many outcomes are there for flipping 3 coins?", "8", 1)
A(37, "A deck has 52 cards. How many are red or a king?", "28", 3)
A(37, "An outfit is a shirt (4 choices), pants (3) and shoes (2). How many outfits?", "24", 1)

# 38 independence
A(38, "You flip a coin and roll a cube. Are the results independent?", "Yes", 1, choices=["Yes", "No"])
A(38, "You draw two cards without putting the first back. Are the draws independent?", "No", 1, choices=["Yes", "No"])
A(38, "P(A) = 0.5, P(B) = 0.4 and P(A and B) = 0.2. Are A and B independent?", "Yes (0.5 × 0.4 = 0.2)", 2, also=["yes"])
A(38, "P(A) = 0.3, P(B) = 0.6 and P(A and B) = 0.25. Are A and B independent?", "No (0.3 × 0.6 = 0.18)", 2, also=["no"])
A(38, "Of 100 students, 40 play an instrument and 50 are in 8th grade. 20 are 8th graders who play an instrument. Are the events independent?", "Yes (0.4 × 0.5 = 0.2)", 3, also=["yes"])
A(38, "A and B are independent with P(A) = 0.2 and P(B) = 0.5. Find P(A and B).", "0.1", 2)

# 39 conditional probability
A(39, "Of 80 students, 30 have a dog. 12 of the dog owners also have a cat. Find P(cat | dog).", num(F(12, 30)), 2, also=["0.4", "40%"])
A(39, "P(A and B) = 0.12 and P(B) = 0.4. Find P(A | B).", "0.3", 2)
A(39, T + " Find P(likes dogs | girl).", num(F(20, 45)), 2)
A(39, T + " Find P(girl | likes dogs).", num(F(20, 35)), 3)
A(39, "A bag has 3 red and 2 blue marbles. You draw one red and don't put it back. What is P(second is red | first was red)?", num(F(2, 4)), 2)
A(39, "A tree diagram: P(rain) = 0.3, P(late | rain) = 0.5. Find P(rain and late).", "0.15", 2)
A(39, "Are mutually exclusive events able to happen at the same time?", "No", 1, choices=["Yes", "No"])
A(39, "A card is drawn from a standard deck. Are \"heart\" and \"spade\" mutually exclusive?", "Yes", 1, choices=["Yes", "No"])

# 40 conditional probability in everyday language
A(40, "Explain P(umbrella | rain) in everyday words.", "The chance someone carries an umbrella when it is raining", 1)
A(40, "Is the chance of being late higher given there is a snowstorm? Is that conditional probability?", "Yes; it is the chance of being late given a snowstorm", 1, also=["yes"])
A(40, "Does knowing a coin landed heads change the chance the next flip is heads?", "No (the flips are independent)", 1, also=["no"])
A(40, "P(pass | studied) = 0.9 and P(pass | did not study) = 0.5. Are passing and studying independent?", "No (the chances are different)", 2, also=["no"])
A(40, "Is P(sick | fever) the same as P(fever | sick)? Explain.", "No; the first is among people with a fever, the second is among sick people", 3, also=["no"])
A(40, "Give an example of two independent events in everyday life.", "Rolling a die and the weather tomorrow", 2)

# 41 P(A | B) as a fraction of B's outcomes
A(41, "A number cube is rolled. Given the roll is even, what is the probability it is a 6?", "{1/3}", 1)
A(41, "A number cube is rolled. Given the roll is greater than 2, what is the probability it is even?", num(F(2, 4)), 2)
A(41, "Of 50 students in band, 20 also play a sport. What is P(sport | band)?", num(F(20, 50)), 1, also=["0.4", "40%"])
A(41, "In P(A | B), which group do you divide by?", "The outcomes in B", 1, also=["B"])
A(41, "Two coins are flipped. Given at least one is heads, what is the probability both are heads?", "{1/3}", 3)
A(41, "Of 120 people at a game, 75 wore team colors. 45 of those cheered loudly. What fraction of people in team colors cheered loudly?", num(F(45, 75)), 2, also=["0.6", "60%"])
