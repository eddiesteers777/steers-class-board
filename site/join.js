// Early access sign-up: four short steps, then one save.
const form = document.getElementById("joinForm");
const steps = [...form.querySelectorAll("fieldset[data-step]")];
const bars = [...form.querySelectorAll(".progress i")];
const back = document.getElementById("joinBack");
const next = document.getElementById("joinNext");
const msg = document.getElementById("joinMsg");
let at = 0;

const val = (n) => { const f = form.elements[n]; return f ? String(f.value || "").trim() : ""; };
const picked = (n) => { const f = form.querySelector(`input[name="${n}"]:checked`); return f ? f.value : ""; };
const NEED = [() => picked("grades") ? "" : "Pick one to keep going.", () => picked("board") ? "" : "Pick one to keep going.", () => picked("device") ? "" : "Pick one to keep going.",
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val("email")) ? "" : "Enter an email we can reach you at."];

function show(i) {
    at = i;
    steps.forEach((s, k) => { s.hidden = k !== i; });
    bars.forEach((b, k) => b.classList.toggle("on", k <= i));
    back.hidden = i === 0;
    next.textContent = i === steps.length - 1 ? "Join the list" : "Next";
    msg.textContent = ""; msg.classList.remove("err");
    const first = steps[i].querySelector("input:checked, input, textarea");
    if (first && i > 0) first.focus({ preventScroll: true });
}

// Picking an option moves on by itself: one tap per question.
steps.slice(0, 3).forEach((s, i) => s.addEventListener("change", (e) => { if (e.target.type === "radio" && at === i) setTimeout(() => show(i + 1), 180); }));
back.addEventListener("click", () => show(Math.max(0, at - 1)));

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const problem = NEED[at]();
    if (problem) { msg.textContent = problem; msg.classList.add("err"); return; }
    if (at < steps.length - 1) { show(at + 1); return; }
    if (val("website")) { done(); return; }   // a bot filled the hidden field
    next.disabled = true; msg.classList.remove("err"); msg.textContent = "Saving...";
    try {
        const { saveSignup } = await import("./waitlist.js?v=1");
        await saveSignup({
            grades: picked("grades"), subject: val("subject").slice(0, 60), board: picked("board"), device: picked("device"),
            email: val("email").slice(0, 120).toLowerCase(), name: val("name").slice(0, 40), note: val("note").slice(0, 500)
        });
        done();
    } catch (err) {
        console.error(err);
        msg.classList.add("err");
        msg.textContent = "That didn't save. Check your connection and try again.";
        next.disabled = false;
    }
});

function done() {
    form.hidden = true;
    const d = document.getElementById("joinDone");
    d.hidden = false; d.focus();
}

show(0);
