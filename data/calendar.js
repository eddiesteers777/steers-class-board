// Shelby County Schools 2026-2027 school calendar, typed from the district's printed calendar
// ("2026-2027 Calendar_English Print Version Only.pdf", given by Eddie on Nov 16, 2026).
// Check: the student days counted from this file match the PDF exactly (83 first semester, 94 second, 177 total).
// Kinds: off = no school for students, work = teacher workday / PD (no students), term = nine weeks or
// semester marker, early = early dismissal, note = information only (report cards).
export const SCHOOL_YEAR = {
    label: "2026–27",
    first: "2026-08-13",   // first day for students
    last: "2027-05-27",    // last day for students
    semesters: [{ n: 1, start: "2026-08-13", end: "2026-12-18", days: 83 }, { n: 2, start: "2027-01-05", end: "2027-05-27", days: 94 }],
    nineWeeks: [
        { n: 1, start: "2026-08-13", end: "2026-10-09" },
        { n: 2, start: "2026-10-14", end: "2026-12-18" },
        { n: 3, start: "2027-01-05", end: "2027-03-05" },
        { n: 4, start: "2027-03-09", end: "2027-05-27" }
    ],
    events: [
        ["2026-07-03", "2026-07-03", "off", "Holiday"],
        ["2026-08-06", "2026-08-07", "work", "Professional Development"],
        ["2026-08-10", "2026-08-10", "work", "Teacher Workday"],
        ["2026-08-11", "2026-08-11", "work", "Institute"],
        ["2026-08-12", "2026-08-12", "work", "Teacher Workday"],
        ["2026-08-13", "2026-08-13", "term", "First day for students · 1st semester begins"],
        ["2026-09-07", "2026-09-07", "off", "Labor Day"],
        ["2026-10-09", "2026-10-09", "term", "End of 1st nine weeks"],
        ["2026-10-12", "2026-10-13", "off", "Fall Break"],
        ["2026-10-16", "2026-10-16", "note", "Report cards sent home"],
        ["2026-11-11", "2026-11-11", "off", "Veterans Day"],
        ["2026-11-23", "2026-11-27", "off", "Thanksgiving Break"],
        ["2026-12-18", "2026-12-18", "early", "End of 2nd nine weeks · Early dismissal"],
        ["2026-12-21", "2027-01-01", "off", "Winter Break"],
        ["2027-01-04", "2027-01-04", "work", "Teacher Workday · no students"],
        ["2027-01-05", "2027-01-05", "term", "2nd semester begins"],
        ["2027-01-08", "2027-01-08", "note", "Report cards sent home"],
        ["2027-01-18", "2027-01-18", "off", "MLK Day"],
        ["2027-02-15", "2027-02-15", "work", "Presidents' Day · Teacher Workday · no students"],
        ["2027-03-05", "2027-03-05", "term", "End of 3rd nine weeks"],
        ["2027-03-08", "2027-03-08", "work", "Instructional Planning · no students"],
        ["2027-03-12", "2027-03-12", "note", "Report cards sent home"],
        ["2027-03-22", "2027-03-26", "off", "Spring Break"],
        ["2027-04-23", "2027-04-23", "work", "Instructional Planning / PD · no students"],
        ["2027-05-27", "2027-05-27", "early", "Last day · End of 4th nine weeks · Early dismissal · Grades sent home"],
        ["2027-05-28", "2027-05-28", "work", "Teacher Workday"],
        ["2027-05-31", "2027-05-31", "off", "Memorial Day"],
        ["2027-06-18", "2027-06-18", "off", "Holiday"]
    ]
};
