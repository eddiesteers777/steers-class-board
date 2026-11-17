/* ==========================================
   Calera Math — record a lesson from the Remote.
   Press Record, teach the problem (reveal steps, write on the whiteboard),
   press Done, and a video file is saved to this device to upload to Schoology.

   - It records the lesson stage only, not the teacher's controls, when the
     browser supports cropping a tab capture to one element. Otherwise it
     records the whole tab and says so.
   - The microphone is off unless the teacher turns it on.
   - Nothing is uploaded or stored by the site. The file goes to Downloads.
   - Chrome always asks which tab to share. That prompt cannot be skipped.
========================================== */
const $ = (id) => document.getElementById(id);
let rec = null, chunks = [], streams = [], startedAt = 0, ticker = 0, mime = "", cropped = false;

const TYPES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
export function supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder); }

function say(text, state) { const n = $("recNote"); if (n) { n.textContent = text; n.dataset.state = state || ""; } }
function clock() { const s = Math.floor((Date.now() - startedAt) / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
function nameTools() { return document.querySelectorAll(".tool-pick, .tool-groups").length > 0; }
function fileName(ext) {
    const clean = (t) => String(t || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    const per = clean(($("periodSel") && $("periodSel").selectedOptions[0] && $("periodSel").selectedOptions[0].textContent) || "");
    const title = clean((document.querySelector("#stage .ttl h1") || {}).textContent), sub = clean((document.querySelector("#stage .ttl p") || {}).textContent);
    const d = new Date(), day = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    return ["Steers", per, title, sub, day].filter(Boolean).join(" - ").slice(0, 120) + "." + ext;
}
function setUi(on) {
    document.body.classList.toggle("recording", on);
    $("recGo").hidden = on; $("recDone").hidden = !on; $("recMic").disabled = on;
    const pill = $("recPill"); if (pill) pill.hidden = !on;
}

async function start() {
    if (rec) return;
    if (!supported()) { say("This browser cannot record. Use Chrome on the Chromebook.", "bad"); return; }
    if (nameTools() && !$("recGo").dataset.warned) {
        $("recGo").dataset.warned = "1"; $("recGo").textContent = "Record anyway";
        say("A student name tool is showing. Hide it first, or press Record anyway.", "bad"); return;
    }
    say("Choose this tab in Chrome's box, then Share.");
    let screen;
    try {
        screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, displaySurface: "browser" }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude" });
    } catch (e) { say(e && e.name === "NotAllowedError" ? "Recording was not started." : "Could not start recording (" + ((e && e.name) || "error") + ").", "bad"); return; }
    streams = [screen];
    const video = screen.getVideoTracks()[0];
    cropped = false;
    try { if (window.CropTarget && video.cropTo) { await video.cropTo(await window.CropTarget.fromElement($("stage"))); cropped = true; } } catch (e) { cropped = false; }
    const tracks = [video];
    if ($("recMic").checked) {
        try { const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); streams.push(mic); tracks.push(mic.getAudioTracks()[0]); }
        catch (e) { say("The microphone was not allowed, so this recording has no sound.", "bad"); }
    }
    mime = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    try { rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : undefined); }
    catch (e) { stopStreams(); say("Could not start recording (" + ((e && e.name) || "error") + ").", "bad"); return; }
    chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = save;
    video.addEventListener("ended", stop);            // the teacher pressed Chrome's own "Stop sharing"
    rec.start(1000); startedAt = Date.now(); setUi(true);
    $("recGo").textContent = "Record"; delete $("recGo").dataset.warned;
    const tick = () => { const t = $("recTime"); if (t) t.textContent = clock(); };
    tick(); ticker = setInterval(tick, 500);
    say(cropped ? "Recording the lesson screen only." : "Recording this whole tab, including the controls.");
}
function stopStreams() { streams.forEach((s) => s.getTracks().forEach((t) => t.stop())); streams = []; }
function stop() { if (rec && rec.state !== "inactive") rec.stop(); }
function save() {
    clearInterval(ticker); stopStreams(); setUi(false);
    const type = (mime || "video/webm").split(";")[0], ext = type === "video/mp4" ? "mp4" : "webm";
    const blob = new Blob(chunks, { type }); chunks = []; rec = null;
    if (!blob.size) { say("Nothing was recorded.", "bad"); return; }
    const a = document.createElement("a"), url = URL.createObjectURL(blob), name = fileName(ext);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    say("Saved to Downloads: " + name + " (" + (blob.size / 1048576).toFixed(1) + " MB). Upload it to Schoology from there.", "ok");
}

export function mount() {
    if (!$("recGo")) return;
    if (!supported()) { $("recGo").disabled = true; say("Recording needs Chrome on a computer."); return; }
    $("recGo").onclick = start; $("recDone").onclick = stop;
    const pd = $("recPillDone"); if (pd) pd.onclick = stop;
    window.addEventListener("beforeunload", (e) => { if (rec) { e.preventDefault(); e.returnValue = ""; } });
}
