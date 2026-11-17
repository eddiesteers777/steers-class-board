// Sample week for the public demo board (demo.html). Made-up content, written by hand.
// Not a real class. Every answer was solved and checked. Student-facing only.
const day = (name, agendaLine, short, lt, problems, extra) => Object.assign({
    name, title: name, date: "", agendaLine, short, bell: "Bellringer",
    agenda: [agendaLine], supplies: ["Bellringer", "Pencil"], reminders: ["Quiz on Friday"], lt, problems
}, extra || {});

export default {
    id: "demo",
    label: "Sample week",
    dates: "Two-step equations",
    monday: "",
    classes: {
        demo: {
            label: "Math 7 (sample)",
            cls: "Sample class",
            weekLT: "I can solve two-step equations and check my answer.",
            bellSeconds: 300,
            days: [
                day("Monday", "Two-Step Equations: Guided Notes", "Guided notes", "I can solve a two-step equation using inverse operations.", [
                    { q: "Find: 4 + 9 × 2", a: "22" },
                    { q: "Solve: x + 7 = 15", a: "x = 8" },
                    { q: "Solve: 3x = 27", a: "x = 9" },
                    { q: "Solve: {x/4} = 6", a: "x = 24" }
                ], {
                    supplies: ["Bellringer", "Guided Notes", "Pencil"],
                    notes: {
                        title: "Two-Step Equations",
                        targets: ["solve a two-step equation using inverse operations.", "check my answer by putting it back into the equation."],
                        warmup: [{ q: "x − 5 = 12", a: "x = 17" }, { q: "6x = 42", a: "x = 7" }, { q: "{x/3} = 5", a: "x = 15" }],
                        vocab: { items: [
                            "An [equation] says two expressions are equal.",
                            "[Inverse operations] undo each other: add and subtract, multiply and divide.",
                            "A [two-step equation] takes two inverse operations to solve.",
                            "To [check] an answer, put it back in and see if both sides match."
                        ] },
                        bigIdea: ["Undo the equation in reverse order.", "Undo adding or subtracting first. Then undo multiplying or dividing. Whatever you do to one side, do to the other."],
                        steps: ["Undo the + or − : do the opposite to both sides.", "Undo the × or ÷ : do the opposite to both sides.", "Check: put your answer back in. Do both sides match?"],
                        examples: [
                            { title: "Undo + then ×", q: "Solve 2x + 5 = 17.", steps: [
                                { m: "2x + 5 − 5 = 17 − 5", why: "Subtract 5 from both sides." },
                                { m: "2x = 12", why: "Simplify." },
                                { m: "x = 6", why: "Divide both sides by 2. Check: 2(6) + 5 = 17 ✔" }
                            ] },
                            { title: "Undo − then ÷", q: "Solve {x/4} − 3 = 2.", steps: [
                                { m: "{x/4} = 5", why: "Add 3 to both sides." },
                                { m: "x = 20", why: "Multiply both sides by 4. Check: {20/4} − 3 = 2 ✔" }
                            ] },
                            { title: "A negative coefficient", q: "Solve −3x + 4 = 19.", steps: [
                                { m: "−3x = 15", why: "Subtract 4 from both sides." },
                                { m: "x = −5", why: "Divide both sides by −3. Check: −3(−5) + 4 = 19 ✔" }
                            ] }
                        ],
                        guided: { q: "A phone plan costs $20 a month plus $5 for each GB of data. One month the bill was $45. How many GB were used?", steps: [
                            { m: "20 + 5g = 45", why: "Write the equation." },
                            { m: "5g = 25", why: "Subtract 20 from both sides." },
                            { m: "g = 5", why: "Divide by 5. Check: 20 + 5(5) = 45 ✔" }
                        ] },
                        practice: [
                            { label: "Part A: Solve and check", problems: [
                                { n: "A1", q: "3x + 4 = 19", a: "x = 5", work: "3x = 15, x = 5" },
                                { n: "A2", q: "4x − 1 = 27", a: "x = 7", work: "4x = 28, x = 7" },
                                { n: "A3", q: "{x/2} + 6 = 10", a: "x = 8", work: "{x/2} = 4, x = 8" },
                                { n: "A4", q: "−2x + 3 = 11", a: "x = −4", work: "−2x = 8, x = −4" }
                            ] },
                            { label: "Part B: Word problem", problems: [
                                { n: "B1", q: "Sam has $12 and saves $8 a week. How many weeks until Sam has $60?", a: "6 weeks", work: "12 + 8w = 60, 8w = 48, w = 6" }
                            ] }
                        ],
                        exit: [{ q: "Solve 6x + 2 = 32." }, { q: "Solve {x/5} − 4 = 1." }]
                    }
                }),
                day("Tuesday", "Speed Dating Review", "Speed dating", "I can solve two-step equations and explain my steps.", [
                    { q: "Solve: 2x + 1 = 9", a: "x = 4" },
                    { q: "Solve: 3x − 6 = 12", a: "x = 6" },
                    { q: "Solve: {x/2} + 5 = 9", a: "x = 8" }
                ], { supplies: ["Bellringer", "Speed Dating card", "Recording sheet", "Pencil"] }),
                day("Wednesday", "Review Game: Two-Step Equations", "Review game", "I can solve two-step equations quickly and correctly.", [
                    { q: "Solve: 5x + 5 = 30", a: "x = 5" },
                    { q: "Solve: −x + 4 = 1", a: "x = 3" },
                    { q: "Solve: 2(x + 1) = 14", a: "x = 6" }
                ]),
                day("Thursday", "Practice Stations", "Stations", "I can write and solve a two-step equation for a word problem.", [
                    { q: "Solve: 7x − 3 = 18", a: "x = 3" },
                    { q: "Solve: {x/6} + 2 = 4", a: "x = 12" },
                    { q: "Solve: 4 − 2x = 10", a: "x = −3" }
                ]),
                day("Friday", "Quiz: Two-Step Equations", "Quiz", "I can show what I know about two-step equations.", [
                    { q: "Solve: 3x + 8 = 2", a: "x = −2" },
                    { q: "Solve: 9x − 9 = 0", a: "x = 1" },
                    { q: "Solve: {x/3} − 1 = −4", a: "x = −9" }
                ], { reminders: ["Quiz today"] })
            ],
            speed: {
                cardsTitle: "Two-Step Equations",
                motto: "Show your work. Explain WHY.",
                lt: "I can solve two-step equations and explain my steps.",
                steps: [
                    "Your card is your master problem. Solve it and be ready to teach it.",
                    "Meet your partner and show your card.",
                    "Solve your partner’s problem on your recording sheet.",
                    "Explain your steps and check each other’s work.",
                    "When the timer ends, the moving side goes one seat over."
                ],
                // Answers, in order: 4, 7, −2, 5, 18, 20, −4, −2, 8, −5, 6, 9, −4, −8, 1, 7, 6 months, 5 days, 8 miles, $36.
                cards: [
                    { q: "2x + 3 = 11" }, { q: "3x − 5 = 16" }, { q: "4x + 9 = 1" }, { q: "5x − 2 = 23" },
                    { q: "{x/3} + 4 = 10" }, { q: "{x/5} − 1 = 3" }, { q: "−2x + 7 = 15" }, { q: "6x + 12 = 0" },
                    { q: "7 + 3x = 31" }, { q: "9 − x = 14" }, { q: "2(x + 3) = 18" }, { q: "3(x − 2) = 21" },
                    { q: "−4x − 6 = 10" }, { q: "{x/2} + 7 = 3" }, { q: "8x − 5 = 3" }, { q: "10 = 2x − 4" },
                    { q: "A gym costs $15 to join and $10 a month. You paid $75. How many months?" },
                    { q: "You have $40 and spend $6 a day. After how many days do you have $10 left?" },
                    { q: "A taxi costs $3 plus $2 a mile. The ride cost $19. How many miles?" },
                    { q: "Three friends split a bill evenly, then each adds a $2 tip. Each paid $14. What was the bill?" }
                ]
            },
            links: []
        }
    }
};
