/* ==========================================
   Calera Math — classroom timer
   NEW file (no Southbound equivalent: Southbound's
   raceCountdown.js is only a "days to race" date countdown).

   State lives in the Firestore live doc (js/liveSession.js)
   so board + remote agree even if one reloads:
     timer: { durationSec, endsAt, state, remainingSec }
     state: "idle" | "running" | "paused" | "done"
   endsAt is a client epoch-ms timestamp. Display is derived
   from endsAt, never from a local interval alone.
========================================== */

export const BELLRINGER_SEC = 300; // 5:00, large digits, red in last 30s
export const SPEED_DATING_SEC = 240; // 4:00, then "Rotate!", 10-to-1, restart

export function newTimer(durationSec) {
    return { durationSec, endsAt: null, state: "idle", remainingSec: durationSec };
}

export function startTimer(timer, nowMs = Date.now()) {
    const remaining = timer.state === "paused" ? timer.remainingSec : timer.durationSec;
    return { ...timer, state: "running", remainingSec: remaining, endsAt: nowMs + remaining * 1000 };
}

export function pauseTimer(timer, nowMs = Date.now()) {
    if (timer.state !== "running") return timer;
    return { ...timer, state: "paused", remainingSec: remainingMs(timer, nowMs), endsAt: null };
}

export function resetTimer(timer) {
    return { ...timer, state: "idle", remainingSec: timer.durationSec, endsAt: null };
}

export function remainingMs(timer, nowMs = Date.now()) {
    if (timer.state === "running" && timer.endsAt) {
        return Math.max(0, timer.endsAt - nowMs);
    }
    return Math.max(0, (timer.remainingSec || 0) * 1000);
}

export function remainingSec(timer, nowMs = Date.now()) {
    return Math.ceil(remainingMs(timer, nowMs) / 1000);
}

export function isDone(timer, nowMs = Date.now()) {
    return timer.state === "running" && remainingMs(timer, nowMs) <= 0;
}

export function formatMMSS(totalSec) {
    const s = Math.max(0, Math.round(totalSec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Speed Dating round: 4:00 of work, then "Rotate!" with a 10-to-1
// countdown, then the next 4:00 round starts. Same behaviour as
// the 8th Grade Claude Slides deck in the Week 5 thread.
export function speedDatingPhase(timer, nowMs = Date.now()) {
    const left = remainingSec(timer, nowMs);
    if (timer.state === "running" && left <= 0) return { phase: "rotate", countdown: 10 };
    if (timer.state === "done") return { phase: "rotate", countdown: 10 };
    return { phase: "work", countdown: left };
}

// Render into an element with .timer-digits / .timer-bar / .timer-state.
// Call on an interval (250ms) from the page; pure display, no state writes.
export function renderTimer(el, timer, nowMs = Date.now()) {
    if (!el) return;
    const left = remainingSec(timer, nowMs);
    const digits = el.querySelector(".timer-digits");
    if (digits) digits.textContent = formatMMSS(left);
    const bar = el.querySelector(".timer-bar");
    if (bar) bar.style.width = `${(left / (timer.durationSec || 1)) * 100}%`;
    const state = el.querySelector(".timer-state");
    if (state) state.textContent = timer.state === "running" ? "Running" : timer.state === "paused" ? "Paused" : timer.state === "done" ? "Time!" : "Click to start";
    el.dataset.low = String(left <= 30 && left > 0 && timer.state === "running");
    if (isDone(timer, nowMs) && timer.state === "running") el.dataset.low = "true";
}
