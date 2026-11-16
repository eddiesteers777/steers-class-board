// Calera Math — Week 5 content, Nov 16–20, 2026.
// Source: the "Week 5 lesson planning" school Claude thread.
// Titles and notes below are exactly as agreed in that thread.
// Bellringer PROBLEMS and answers are NOT in this file: they live
// in the thread's slides and in the "8th Grade Work-It-Out Board"
// artifact (Message 26). Do not invent problems or answers here —
// wire them in from the thread when the board is used in class.

export const WEEK5 = {
    id: "week5",
    label: "Week 5",
    dates: "November 16–20, 2026",
    school: "Calera Middle School — Home of the Eagles",
    teacher: "Mr. Steers",
    targets: {
        "8th": "I can find a missing angle in a triangle and solve equations to find all 3 angles.",
        "8th-acc": "I can solve and graph inequalities and find a missing angle in a triangle."
        // 7th Grade: no single weekly target was set in the thread.
        // The two 8th-grade targets above were written by Claude from
        // the daily targets — ask Eddie before rewording them.
    },
    classes: {
        "7th": {
            id: "7th",
            label: "Steers — 7th Grade",
            days: {
                mon: { day: "Monday", date: "Nov 16", title: "Guided Notes: Problem Solving", kind: "guided-notes" },
                tue: { day: "Tuesday", date: "Nov 17", title: "Speed Dating", kind: "activity", timer: "speed-dating" },
                wed: { day: "Wednesday", date: "Nov 18", title: "Magma Math Whole-Class Review", kind: "review" },
                thu: { day: "Thursday", date: "Nov 19", title: "Quiz", kind: "quiz", note: "Quiz today, no calculator" },
                fri: { day: "Friday", date: "Nov 20", title: "Sub Day — review worksheet", kind: "sub-day", note: "Be kind to our guest teacher" }
            }
        },
        "8th": {
            id: "8th",
            label: "Steers — 8th Grade",
            days: {
                mon: { day: "Monday", date: "Nov 16", title: "Triangle Angle Sum notes", kind: "guided-notes" },
                tue: { day: "Tuesday", date: "Nov 17", title: "Speed Dating", kind: "activity", timer: "speed-dating" },
                wed: { day: "Wednesday", date: "Nov 18", title: "Triangle Practice + Study Guide", kind: "practice" },
                thu: { day: "Thursday", date: "Nov 19", title: "Magma Math Test — Homework Packet due", kind: "test" },
                fri: { day: "Friday", date: "Nov 20", title: "Sub Day — review worksheet", kind: "sub-day", note: "Be kind to our guest teacher" }
            }
        },
        "8th-acc": {
            id: "8th-acc",
            label: "Steers — 8th Grade Accelerated",
            days: {
                mon: { day: "Monday", date: "Nov 16", title: "Inequalities notes", kind: "guided-notes" },
                tue: { day: "Tuesday", date: "Nov 17", title: "Speed Dating", kind: "activity", timer: "speed-dating" },
                wed: { day: "Wednesday", date: "Nov 18", title: "Triangle Angle Sum Notes + Study Guide", kind: "guided-notes" },
                thu: { day: "Thursday", date: "Nov 19", title: "Magma Math Test — Homework Packet due", kind: "test" },
                fri: { day: "Friday", date: "Nov 20", title: "Sub Day — review worksheet", kind: "sub-day", note: "Be kind to our guest teacher" }
            }
        }
    }
};

// Day "items" shown on the board, in order. Each day gets the same
// slots; text beyond the title comes from the weekly build in the
// Claude thread (bellringer problems, guided-notes steps, activity
// directions, worksheet links, study guide, homework, exit question).
// Slots with no text yet render as "—" and must be filled from the
// thread, never invented.
export function dayItems(classId, dayId) {
    const day = WEEK5.classes[classId]?.days[dayId];
    if (!day) return [];
    return [
        { key: "bellringer", label: "Bellringer", text: "Bellringer — see today's slide", timerSec: 300 },
        { key: "lesson", label: day.kind === "activity" ? "Activity" : "Lesson", text: day.title },
        { key: "activity", label: "Activity directions", text: day.kind === "activity" ? day.title : "—" },
        { key: "worksheet", label: "Worksheet / links", text: "—" },
        { key: "study-guide", label: "Study guide", text: day.title.includes("Study Guide") ? day.title : "—" },
        { key: "homework", label: "Homework", text: day.title.includes("Homework Packet") ? "Homework Packet due" : "—" },
        { key: "exit", label: "Exit question", text: "—" }
    ];
}

export function classIds() {
    return Object.keys(WEEK5.classes);
}

export function dayIds() {
    return ["mon", "tue", "wed", "thu", "fri"];
}
