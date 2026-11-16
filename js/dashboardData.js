// Calera Math — seed data for a new teacher dashboard doc.
// School replacement for the Southbound dashboardData seed
// (js/firestore.js loadDashboard creates this on first sign-in).

export const dashboardData = {
    teacherName: "",
    currentClassId: "8th",
    currentWeekId: "week5",
    createdAt: new Date().toISOString(),
    // Week 5, Nov 16-20, 2026. Full content lives in data/week5.js;
    // this doc only remembers where the teacher left off.
    lastOpened: { classId: "8th", weekId: "week5", dayId: "mon" }
};
