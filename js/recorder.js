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
let rec = null, chunks = [], streams = [], startedAt = 0, ticker = 0, mime = "", cropped = false, painter = null;

// A fresh key frame every second, so a player that trips on one frame recovers within a second.
// High profile H.264 first: it plays in Windows Media Player, Chrome and Schoology. Then WebM if MP4 cannot be made.
const TYPES = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.640028,opus", "video/mp4;codecs=avc1.640028",
    "video/mp4;codecs=avc1.4D4028", "video/mp4;codecs=avc1.42E028", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

/* The captured tab changes size while recording (Chrome adds its "sharing this tab" bar, the window
   is resized, the crop settles). A size change in the middle of an MP4 makes Windows players show a
   smeared, streaky picture. So the capture is drawn onto a canvas that never changes size (even
   numbers, at most 1920 x 1080), and the canvas is what gets recorded. */
function steady(track) {
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.srcObject = new MediaStream([track]);
    const set = track.getSettings ? track.getSettings() : {}, sw = set.width || 1280, sh = set.height || 720;
    const k = Math.min(1, 1920 / sw, 1080 / sh), even = (n) => Math.max(2, Math.round(n / 2) * 2);
    const c = document.createElement("canvas"); c.width = even(sw * k); c.height = even(sh * k);
    const ctx = c.getContext("2d", { alpha: false });
    const draw = () => {
        if (v.videoWidth) {
            const s = Math.min(c.width / v.videoWidth, c.height / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s;
            ctx.fillStyle = "#081B45"; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(v, (c.width - w) / 2, (c.height - h) / 2, w, h);
        }
    };
    v.play().catch(() => {}); draw();
    const timer = setInterval(draw, 1000 / 30);      // a steady 30 frames a second, even when the lesson screen is still
    const out = c.captureStream(30).getVideoTracks()[0];
    return { track: out, stop() { clearInterval(timer); out.stop(); v.srcObject = null; } };
}
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
    await new Promise((r) => setTimeout(r, 400));     // let the crop and Chrome's sharing bar settle
    painter = steady(video);
    const tracks = [painter.track];
    if ($("recMic").checked) {
        try { const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); streams.push(mic); tracks.push(mic.getAudioTracks()[0]); }
        catch (e) { say("The microphone was not allowed, so this recording has no sound.", "bad"); }
    }
    mime = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    try { rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 4000000, videoKeyFrameIntervalDuration: 1000 } : undefined); }
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
function stopStreams() { if (painter) { painter.stop(); painter = null; } streams.forEach((s) => s.getTracks().forEach((t) => t.stop())); streams = []; }
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
