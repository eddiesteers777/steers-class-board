/* ==========================================
   Anchor Board — the room's microphone and camera, on this device only.
   Voice level panel: "Listen" asks for the microphone and shows how loud the room is against the
   chosen voice level (Silent, Whisper, Partner, Group). Webcam panel: asks for the camera, shows it,
   and records a video that is saved straight to this device (Downloads). Nothing here is sent anywhere:
   no sound or picture leaves the browser, and nothing is stored in the database.
   Each device asks for itself, so the board computer listens with its own microphone.
========================================== */
const LS = (k, d) => { try { const v = localStorage.getItem("anchorboard-" + k); return v == null ? d : v; } catch (e) { return d; } };
const SS = (k, v) => { try { localStorage.setItem("anchorboard-" + k, String(v)); } catch (e) { /* this visit only */ } };

/* ---------- microphone ---------- */
const mic = { on: false, busy: false, err: "", stream: null, ctx: null, an: null, buf: null, level: 0, peak: 0, over: 0, raf: 0 };
/** How loud each voice level may get, 0-1 on the meter. */
export const VOICE_LIMIT = { silent: 0.18, whisper: 0.38, partner: 0.62, group: 0.82 };
export const micSens = () => Math.min(2, Math.max(0.5, +LS("mic-sens", 1) || 1));
export function setMicSens(v) { SS("mic-sens", Math.min(2, Math.max(0.5, v))); }
export const micState = () => ({ on: mic.on, busy: mic.busy, err: mic.err, level: mic.level, over: mic.over });
export async function micStart() {
    if (mic.on || mic.busy) return; mic.busy = true; mic.err = "";
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("none");
        mic.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        const AC = window.AudioContext || window.webkitAudioContext; mic.ctx = new AC();
        const src = mic.ctx.createMediaStreamSource(mic.stream); mic.an = mic.ctx.createAnalyser(); mic.an.fftSize = 1024; src.connect(mic.an);
        mic.buf = new Float32Array(mic.an.fftSize); mic.on = true; loop();
    } catch (e) {
        mic.err = e && e.name === "NotAllowedError" ? "The microphone was blocked. Allow it in the browser's site settings." : e && e.name === "NotFoundError" ? "No microphone was found on this device." : "The microphone could not start on this device.";
        micStop(true);
    }
    mic.busy = false; paintMic();
}
export function micStop(keepErr) {
    cancelAnimationFrame(mic.raf); mic.on = false; mic.level = 0; mic.over = 0;
    if (mic.stream) mic.stream.getTracks().forEach((t) => t.stop()); mic.stream = null;
    if (mic.ctx) { try { mic.ctx.close(); } catch (e) { /* closed */ } } mic.ctx = null; mic.an = null;
    if (!keepErr) mic.err = ""; paintMic();
}
let lastT = 0;
function loop() {
    mic.raf = requestAnimationFrame(loop);
    if (!mic.an) return; mic.an.getFloatTimeDomainData(mic.buf);
    let sum = 0; for (let i = 0; i < mic.buf.length; i++) sum += mic.buf[i] * mic.buf[i];
    const rms = Math.sqrt(sum / mic.buf.length), db = 20 * Math.log10(Math.max(1e-6, rms));   // about -70 (quiet room) to -10 (shouting)
    const v = Math.min(1, Math.max(0, (db + 62) / 52 * micSens()));
    mic.level = v > mic.level ? mic.level * 0.55 + v * 0.45 : mic.level * 0.92 + v * 0.08;   // quick up, slow down
    const now = performance.now(), dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0; lastT = now;
    const lim = VOICE_LIMIT[curVoice] || 1;
    mic.over = mic.level > lim ? mic.over + dt : Math.max(0, mic.over - dt * 2);
    paintMic();
}
let curVoice = "silent";
/** The voice level the class is on now (the panel tells this module each time it draws). */
export function setVoice(v) { curVoice = v; }
/** Every meter on the page follows the microphone: .vmeter elements made by meterEl(). */
function paintMic() {
    document.querySelectorAll(".vmeter").forEach((m) => {
        const lim = VOICE_LIMIT[curVoice] || 1, loud = mic.on && mic.over > 1.2;
        m.classList.toggle("on", mic.on); m.classList.toggle("loud", loud);
        const f = m.querySelector(".vmfill"); if (f) f.style.width = Math.round(mic.level * 100) + "%";
        const l = m.querySelector(".vmlim"); if (l) l.style.left = Math.round(lim * 100) + "%";
        const s = m.querySelector(".vmstat"); if (s) { const t = mic.err ? mic.err : !mic.on ? (mic.busy ? "Asking for the microphone…" : "Tap Listen to hear the room") : loud ? "Too loud!" : mic.level > lim * 0.85 ? "Getting loud" : "Just right"; if (s.textContent !== t) s.textContent = t; }
        const b = m.querySelector(".vmbtn"); if (b) { const t = mic.on ? "Stop listening" : "Listen"; if (b.textContent !== t) b.textContent = t; b.setAttribute("aria-pressed", String(mic.on)); }
        const card = m.closest(".card"); if (card) card.classList.toggle("tooloud", loud);
    });
}
export function meterEl(el) {
    const m = el("div", "vmeter"), bar = el("div", "vmbar"); bar.append(el("i", "vmfill"), el("b", "vmlim"));
    const row = el("div", "vmrow"), btn = el("button", "vmbtn", "Listen"); btn.type = "button";
    btn.onclick = (e) => { e.stopPropagation(); if (mic.on) micStop(); else micStart(); };
    row.append(btn, el("span", "vmstat")); m.append(bar, row);
    setTimeout(paintMic, 0); return m;
}

/* ---------- camera ---------- */
const cam = { on: false, busy: false, err: "", stream: null, video: null, rec: null, chunks: [], recAt: 0, saved: "", timer: 0 };
export const camMirror = () => LS("cam-mirror", "1") === "1";
export function setCamMirror(on) { SS("cam-mirror", on ? "1" : "0"); paintCam(); }
export const camState = () => ({ on: cam.on, busy: cam.busy, err: cam.err, recording: !!cam.rec, recAt: cam.recAt, saved: cam.saved });
/** One video element for the page, moved into whichever Webcam panel is showing (panels are rebuilt often). */
export function camVideo() {
    if (!cam.video) { cam.video = document.createElement("video"); cam.video.className = "camvid"; cam.video.muted = true; cam.video.playsInline = true; cam.video.autoplay = true; cam.video.setAttribute("aria-label", "Webcam"); }
    if (cam.stream && cam.video.srcObject !== cam.stream) cam.video.srcObject = cam.stream;
    cam.video.classList.toggle("mirror", camMirror());
    return cam.video;
}
export async function camStart() {
    if (cam.on || cam.busy) return; cam.busy = true; cam.err = ""; paintCam();
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("none");
        cam.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
        cam.on = true; const v = camVideo(); v.srcObject = cam.stream; try { await v.play(); } catch (e) { /* plays when shown */ }
    } catch (e) {
        cam.err = e && e.name === "NotAllowedError" ? "The camera was blocked. Allow it in the browser's site settings." : e && e.name === "NotFoundError" ? "No camera was found on this device." : "The camera could not start on this device.";
        cam.stream = null;
    }
    cam.busy = false; paintCam();
}
export function camStop() {
    if (cam.rec) recStop();
    if (cam.stream) cam.stream.getTracks().forEach((t) => t.stop()); cam.stream = null; cam.on = false;
    if (cam.video) cam.video.srcObject = null; paintCam();
}
export function recStart() {
    if (!cam.stream || cam.rec || !window.MediaRecorder) { if (!window.MediaRecorder) { cam.err = "This browser cannot record video."; paintCam(); } return; }
    const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
    cam.chunks = []; cam.saved = "";
    cam.rec = type ? new MediaRecorder(cam.stream, { mimeType: type }) : new MediaRecorder(cam.stream);
    cam.rec.ondataavailable = (e) => { if (e.data && e.data.size) cam.chunks.push(e.data); };
    cam.rec.onstop = () => {
        const mime = (cam.rec && cam.rec.mimeType) || type || "video/webm", ext = /mp4/.test(mime) ? "mp4" : "webm";
        const blob = new Blob(cam.chunks, { type: mime }), url = URL.createObjectURL(blob), d = new Date();
        const name = "class-video-" + d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + "-" + ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2) + "." + ext;
        const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        cam.rec = null; cam.chunks = []; cam.saved = name; paintCam();
    };
    cam.rec.start(1000); cam.recAt = Date.now();
    clearInterval(cam.timer); cam.timer = setInterval(paintCam, 500); paintCam();
}
export function recStop() { clearInterval(cam.timer); if (cam.rec && cam.rec.state !== "inactive") cam.rec.stop(); else cam.rec = null; paintCam(); }
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); };
/** The Webcam panel's body. */
export function camBody(el) {
    const box = el("div", "cambox"), screen = el("div", "camscreen");
    screen.appendChild(camVideo());
    const off = el("div", "camoff"); off.appendChild(el("p", "camofft", "Camera is off")); screen.appendChild(off);
    const dot = el("span", "camrec"); screen.appendChild(dot);
    box.appendChild(screen);
    const row = el("div", "minis camctl");
    const mk = (cls, t, fn) => { const b = el("button", cls, t); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); fn(); }; row.appendChild(b); return b; };
    mk("camgo primary", "Turn on camera", () => (cam.on ? camStop() : camStart()));
    mk("camrecb", "Record", () => (cam.rec ? recStop() : recStart()));
    box.appendChild(row);
    box.appendChild(el("p", "camnote"));
    setTimeout(paintCam, 0); return box;
}
export function paintCam() {
    document.querySelectorAll(".cambox").forEach((b) => {
        const v = b.querySelector(".camscreen"); if (v && cam.video && cam.video.parentNode !== v) v.prepend(camVideo());
        if (cam.video) cam.video.classList.toggle("mirror", camMirror());
        b.classList.toggle("on", cam.on); b.classList.toggle("rec", !!cam.rec);
        const go = b.querySelector(".camgo"); if (go) { const t = cam.busy ? "Asking…" : cam.on ? "Turn off" : "Turn on camera"; if (go.textContent !== t) go.textContent = t; go.classList.toggle("primary", !cam.on); }
        const r = b.querySelector(".camrecb"); if (r) { r.hidden = !cam.on; const t = cam.rec ? "Stop " + mmss(Date.now() - cam.recAt) : "Record"; if (r.textContent !== t) r.textContent = t; r.classList.toggle("recing", !!cam.rec); }
        const n = b.querySelector(".camnote"); if (n) { const t = cam.err || (cam.rec ? "Recording on this device" : cam.saved ? "Saved to this device: " + cam.saved : cam.on ? "Videos save to this device only" : ""); if (n.textContent !== t) n.textContent = t; }
    });
}
/** A Webcam or Voice level panel that was taken off lets go of the camera or microphone (a running recording is saved first).
    A minimized panel keeps them: the recording goes on, and the chip still says when the room is too loud. */
export function senseIdle(on) { if (cam.on && !on.cam) camStop(); if (mic.on && !on.work) micStop(); }
export const tooLoud = () => mic.on && mic.over > 1.2;
