// Every week the board knows about, oldest first. The newest week whose Monday
// has arrived opens by default.
import week0 from "./week0.js?v=35";
import week1 from "./week1.js?v=35";
import week2 from "./week2.js?v=35";
import week3 from "./week3.js?v=35";
import week4 from "./week4.js?v=35";
import week5 from "./week5.js?v=35";
export const WEEKS = [week0, week1, week2, week3, week4, week5];
// The ?v= number must go up every time a week file changes, here and in the
// pages that import this file, so browsers never mix old and new files.
