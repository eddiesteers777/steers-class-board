/* Students: one place for everything about how students are doing.
   Student Progress, Grades, Assignments, Class Data and Student Work stay their own pages
   (old links and bookmarks keep working), but each one shows the same tab row at the top,
   so they read as one Students page. The period picked on one tab is remembered for the
   others that use it (Progress and Grades). */
const TABS = [
    ["progress.html", "Progress", "Who needs help, on what"],
    ["grades.html", "Grades", "The gradebook"],
    ["assign.html", "Assignments", "Practice, quizzes and tests"],
    ["data.html", "Class Data", "Scores and imports"],
    ["work.html", "Student Work", "Scanned papers"],
];
const CSS = `
.stuNav{display:flex;align-items:center;gap:12px;flex-wrap:wrap;max-width:1080px;margin:18px auto -6px;padding:0 18px}
.stuNav .stuLbl{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-weight:700;font-size:15px;color:var(--c-ink,#0E1B3A);letter-spacing:.01em}
.stuNav .stuTabs{display:inline-flex;flex-wrap:wrap;gap:2px;background:var(--c-surface,#fff);border:1.5px solid var(--c-line,#D5DCE9);border-radius:12px;padding:3px}
.stuNav a{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border-radius:9px;font-weight:600;color:var(--c-mute,#55627F);text-decoration:none}
.stuNav a:hover{color:var(--c-ink,#0E1B3A);background:#EEF1F6}
.stuNav a[aria-current="page"]{background:var(--navy,#081B45);color:#fff}
.stuNav a:focus-visible{outline:3px solid #7FAEDD;outline-offset:2px}
@media (max-width:640px){
  .stuNav{margin-top:12px;gap:8px}
  .stuNav .stuTabs{display:flex;width:100%;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none}
  .stuNav a{flex:0 0 auto;min-height:44px;padding:0 12px}
}`;

/** Draw the Students tab row under the page header. `here` is this page's file name. */
export function mountStudentsNav(here) {
    if (document.querySelector(".stuNav")) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const nav = document.createElement("nav"); nav.className = "stuNav"; nav.setAttribute("aria-label", "Students");
    const lbl = document.createElement("span"); lbl.className = "stuLbl"; lbl.textContent = "Students";
    const row = document.createElement("div"); row.className = "stuTabs";
    const keep = location.search.includes("demo") ? "?demo" : "";   // stay in sample data across tabs
    for (const [href, name, tip] of TABS) {
        const a = document.createElement("a"); a.href = href + keep; a.textContent = name; a.title = tip;
        if (href === here) a.setAttribute("aria-current", "page");
        row.appendChild(a);
    }
    nav.append(lbl, row);
    const head = document.querySelector("header.cbar");
    if (head) head.after(nav); else document.body.prepend(nav);
}

/** The period shared by the Students tabs. Falls back to the page's own saved choice. */
export function sharedPeriod(own) {
    try { return localStorage.getItem("anchorboard-students-period") || own; } catch (e) { return own; }
}
export function saveSharedPeriod(p) {
    try { localStorage.setItem("anchorboard-students-period", p); } catch (e) { /* private window: the page still works */ }
}
