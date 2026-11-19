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
}
