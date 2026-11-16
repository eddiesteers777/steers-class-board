// Every week the board knows about, oldest first. The newest week whose Monday
// has arrived opens by default.
import week5 from "./week5.js?v=12";
export const WEEKS = [week5];
// The ?v= number must go up every time a week file changes, here and in the
// pages that import this file, so browsers never mix old and new files.
