// ACAP Summative reporting categories, from the 2024 Summative Test Blueprints - Math (ALSDE/ACAP, v1.0):
// https://www.alabamaachieves.org/wp-content/uploads/2024/10/ASMT_20241010_2024-Summative-Test-Blueprints-Math_v1.0.pdf
// The blueprint gives Possible Points by reporting category (46 in each grade). ALSDE prints no percentages:
// any share shown on the site is points / 46, worked out here, and labelled as such.
// Standards are matched by number (7.10 is standard 10 of Grade 7). Grade 8's first category is one block of 29
// points and the blueprint does not split it, so it is never split here either.
// 8th Accelerated takes the Grade 8 test (Eddie, 2026-11-23): its 8.x standards use Grade 8; Algebra I has no weight.
// Calculator use per standard comes from Eddie's ACAP rigor guides (from the item specifications); "neutral" = either way.
export const ACAP = {
    "7": {
        grade: "Grade 7", total: 46,
        cats: [
            { id: "PR", name: "Proportional Reasoning", from: 1, to: 3, pts: 6 },
            { id: "NSO", name: "Number Systems and Operations", from: 4, to: 5, pts: 10 },
            { id: "AF", name: "Algebra and Functions", from: 6, to: 9, pts: 6 },
            { id: "DSP", name: "Data Analysis, Statistics, and Probability", from: 10, to: 16, pts: 15 },
            { id: "GM", name: "Geometry and Measurement", from: 17, to: 22, pts: 9 },
        ],
        // calculator: yes / no / neutral, by standard number
        calc: { 1: "yes", 2: "yes", 3: "yes", 4: "no", 5: "no", 6: "no", 7: "no", 8: "yes", 9: "yes", 10: "neutral", 11: "yes", 12: "yes", 13: "yes", 14: "yes", 15: "yes", 16: "yes", 17: "neutral", 18: "neutral", 19: "neutral", 20: "yes", 21: "yes", 22: "yes" },
    },
    "8": {
        grade: "Grade 8", total: 46,
        cats: [
            { id: "NAF", name: "Numbers, Algebra, and Functions", from: 1, to: 17, pts: 29 },
            { id: "DSP", name: "Data Analysis, Statistics, and Probability", from: 18, to: 21, pts: 6 },
            { id: "GM", name: "Geometry and Measurement", from: 22, to: 30, pts: 11 },
        ],
        calc: { 1: "no", 2: "no", 3: "no", 4: "no", 5: "no", 6: "no", 7: "yes", 8: "yes", 9: "yes", 10: "yes", 11: "yes", 12: "yes", 13: "yes", 14: "yes", 15: "yes", 16: "yes", 17: "yes",
            18: "yes", 19: "yes", 20: "yes", 21: "yes", 22: "neutral", 23: "neutral", 24: "neutral", 25: "neutral", 26: "yes", 27: "yes", 28: "yes", 29: "yes", 30: "yes" },
    },
};
// Which blueprint a class is scored on.
export const ACAP_FOR = { "7th": "7", "8th": "8", "8th-acc": "8" };
