/* ==========================================
   Anchor Board — timer sounds and background music.
   Every sound is made right here in the browser with the Web Audio API:
   no audio files, no recordings, nothing copyrighted. The music is
   generated live from chord progressions, so it never repeats exactly.

   The board app decides WHERE sound plays (one screen, usually the board)
   and calls set() with the shared settings. Timer code calls cue().
========================================== */

let ctx = null, master = null, fxBus = null, musicBus = null, gameBus = null, duckGain = null, verb = null, noise = null;
let cfg = { fx: true, fxv: 0.7, music: false, mv: 0.35, style: "focus", game: true }, here = false;

const STYLES = [["calm", "Calm"], ["focus", "Focus"], ["upbeat", "Upbeat"]];
export { STYLES };

/** Start (or wake) the audio engine. Browsers only allow this after a tap or key press. */
export function unlock() {
    try {
        if (!ctx) build();
        if (ctx.state === "suspended") ctx.resume().then(() => { onState(); syncMusic(); syncGame(); }, () => {});
    } catch (e) { /* no Web Audio on this device */ }
    onState(); syncMusic(); syncGame();
}
/** True when this device can make sound right now. */
export const running = () => !!ctx && ctx.state === "running";
/** True when this device is the one that should play. */
export const playsHere = () => here;
/** Whether anything is switched on that needs this device to make sound. */
export const wanted = () => here && (cfg.fx || cfg.music || (cfg.game && !!phase));

let listeners = [];
export function onChange(fn) { listeners.push(fn); }
function onState() { listeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); }

function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.onstatechange = onState;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 1;
    master.connect(comp); comp.connect(ctx.destination);
    fxBus = ctx.createGain(); fxBus.connect(master);
    duckGain = ctx.createGain(); duckGain.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(duckGain);
    gameBus = ctx.createGain(); gameBus.connect(duckGain);
    // A soft room so the music and bells do not sound dry: decaying noise as the impulse.
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.32; verb.connect(wet); wet.connect(musicBus);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    levels();
}

function levels() {
    if (!ctx) return;
    const t = ctx.currentTime;
    fxBus.gain.setTargetAtTime(here && cfg.fx ? cfg.fxv * 0.9 : 0, t, 0.03);
    musicBus.gain.setTargetAtTime(here && cfg.music ? cfg.mv * 0.8 : 0, t, 0.25);
    gameBus.gain.setTargetAtTime(here && cfg.game ? Math.max(0.15, cfg.mv) * 0.8 : 0, t, 0.25);
}

/** Apply the shared settings. playHere: whether this device is the speaker. */
export function set(s, playHere) {
    const n = Object.assign({}, cfg, s || {});
    const changed = JSON.stringify(n) !== JSON.stringify(cfg) || playHere !== here;
    cfg = n; here = !!playHere;
    if (!changed) return;
    if (ctx) levels();
    syncMusic(); syncGame(); onState();
}

/* ---------- small instruments ---------- */
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, a, peak, d, end = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
function osc(type, f, t, stop, dest, detune = 0) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune; o.connect(dest); o.start(t); o.stop(stop); return o; }

/* A bell: a few inharmonic partials that die away, like a small hand bell. */
function bell(t, f, vol, dest, len = 1.6) {
    [[1, 1], [2.0, 0.45], [2.76, 0.32], [5.4, 0.14], [8.93, 0.06]].forEach(([r, a], i) => {
        const g = ctx.createGain(); g.connect(dest); env(g, t, 0.004, vol * a, len / (1 + i * 0.7)); osc("sine", f * r, t, t + len + 0.1, g);
    });
}
/* A marimba-style mallet note. */
function mallet(t, f, vol, dest) {
    const g = ctx.createGain(); g.connect(dest); env(g, t, 0.003, vol, 0.55); osc("sine", f, t, t + 0.7, g);
    const g2 = ctx.createGain(); g2.connect(dest); env(g2, t, 0.002, vol * 0.35, 0.12); osc("sine", f * 4, t, t + 0.2, g2);
}
/* A wood block click for the last seconds. */
function block(t, vol, dest, f = 1250) {
    const g = ctx.createGain(); g.connect(dest); env(g, t, 0.002, vol, 0.07); osc("triangle", f, t, t + 0.1, g);
    const g2 = ctx.createGain(); g2.connect(dest); env(g2, t, 0.001, vol * 0.5, 0.04); osc("sine", f * 2.3, t, t + 0.06, g2);
}
function noiseHit(t, vol, dest, type, freq, d, q = 0.8) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.002, vol, d);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
}

/** Lower the music for a moment so a timer sound is easy to hear. */
function duck(secs) {
    if (!ctx) return; const t = ctx.currentTime;
    duckGain.gain.cancelScheduledValues(t); duckGain.gain.setTargetAtTime(0.18, t, 0.05); duckGain.gain.setTargetAtTime(1, t + secs, 0.6);
}

/* ---------- timer cues ---------- */
const CUES = {
    // Timer started (or a new speed dating round began): two bright notes up.
    go(t, d) { mallet(t, hz(79), 0.5, d); mallet(t + 0.13, hz(84), 0.55, d); },
    // One minute left (30 s in a speed dating round): one soft bell.
    warn(t, d) { bell(t, hz(76), 0.28, d, 1.4); },
    // Each of the last few seconds.
    tick(t, d) { block(t, 0.32, d); },
    // Last tick before the end, a touch higher.
    tock(t, d) { block(t, 0.36, d, 1600); },
    // Round over: rotate. A rising four-note call students learn fast.
    rotate(t, d) { [72, 76, 79, 84].forEach((m, i) => mallet(t + i * 0.12, hz(m), 0.5, d)); bell(t + 0.5, hz(84), 0.3, d, 1.2); bell(t + 0.5, hz(88), 0.2, d, 1.2); },
    // Time is up: three rings of a bright two-bell chord.
    done(t, d) { for (let n = 0; n < 3; n++) { bell(t + n * 0.55, hz(84), 0.42, d, 1.4); bell(t + n * 0.55, hz(91), 0.26, d, 1.2); } },
    // Short positive pop for game moments.
    pop(t, d) { mallet(t, hz(84), 0.4, d); },
    /* ---- Vault Raid moments (the board) ---- */
    // Someone joined the waiting room: a soft blip.
    join(t, d) { mallet(t, hz([76, 79, 81, 84, 88][Math.floor(Math.random() * 5)]), 0.28, d); },
    // Game on: three low hits and a high answer.
    start(t, d) { [0, 0.16, 0.32].forEach((x) => { kick(t + x, 0.5, d); pluck(t + x, hz(57), 0.12, 0.25, d); }); pluck(t + 0.5, hz(69), 0.6, 0.3, d); pluck(t + 0.5, hz(76), 0.6, 0.22, d); bell(t + 0.5, hz(81), 0.3, d, 1.4); },
    // A vault cracked: an alarm, then coins pouring out.
    crack(t, d) {
        for (let i = 0; i < 6; i++) { const g = ctx.createGain(); g.connect(d); env(g, t + i * 0.13, 0.005, 0.08, 0.12); osc("square", i % 2 ? 660 : 880, t + i * 0.13, t + i * 0.13 + 0.14, g); }
        [88, 91, 93, 96, 91, 93, 96, 100, 98, 103].forEach((m, i) => bell(t + 0.85 + i * 0.065, hz(m), 0.16, d, 0.7));
    },
    // A Shield blocked a crack: a heavy metal clang.
    block(t, d) { bell(t, hz(45), 0.5, d, 1.6); bell(t, hz(52), 0.3, d, 1.2); noiseHit(t, 0.35, d, "bandpass", 2400, 0.25, 2); kick(t, 0.5, d); },
    // Bonus round: a rising sweep and a bright major chord.
    bonus(t, d) {
        const g = ctx.createGain(); g.connect(d); env(g, t, 0.05, 0.1, 0.7); const o = osc("sawtooth", 180, t, t + 0.8, g); o.frequency.exponentialRampToValueAtTime(1400, t + 0.7);
        [69, 73, 76, 81].forEach((m, i) => { pluck(t + 0.75 + i * 0.07, hz(m), 0.5, 0.22, d); bell(t + 1.05, hz(m + 12), 0.14, d, 1.6); });
    },
    // A mystery box: a quick sparkle.
    box(t, d) { [93, 97, 100, 105].forEach((m, i) => bell(t + i * 0.05, hz(m), 0.1, d, 0.6)); },
    // The last 30 seconds: one tense low hit.
    rush(t, d) { kick(t, 0.55, d); bell(t, hz(57), 0.35, d, 2); pluck(t, hz(45), 0.8, 0.25, d); },
    // Game over: a fanfare up to a held chord.
    win(t, d) { [57, 61, 64, 69, 73, 76].forEach((m, i) => pluck(t + i * 0.09, hz(m + 12), 0.25, 0.25, d)); [69, 73, 76, 81].forEach((m) => { pluck(t + 0.6, hz(m), 1.6, 0.18, d); bell(t + 0.6, hz(m + 12), 0.22, d, 2.4); }); kick(t + 0.6, 0.5, d); },
};
/** Play a timer cue on this device, if this device is the speaker and timer sounds are on. */
export const recent = [];   // the last cues played here, for checking
export function cue(name) {
    if (!here || !cfg.fx || !running() || !CUES[name]) return;
    recent.push([name, Date.now()]); if (recent.length > 30) recent.shift();
    try {
        if (name === "rotate" || name === "done") duck(name === "done" ? 2.6 : 2);
        else if (name === "crack" || name === "bonus" || name === "win" || name === "block") duck(name === "win" ? 3 : 2);
        CUES[name](ctx.currentTime + 0.02, fxBus);
    } catch (e) { /* ignore */ }
}
/** Let the Remote preview a cue on its own speaker, whatever the speaker setting. */
export function preview(name) {
    try { unlock(); if (!running() || !CUES[name]) return; const g = ctx.createGain(); g.gain.value = cfg.fxv * 0.9; g.connect(master); CUES[name](ctx.currentTime + 0.03, g); } catch (e) { /* ignore */ }
}

/* ---------- background music ----------
   Generated, not recorded: a chord progression, a bass line, a few
   melody notes from the key's pentatonic scale and (for Focus and
   Upbeat) a quiet beat. Keys and progressions change every few bars. */
const QUAL = { M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], sus: [0, 5, 7, 10], M9: [0, 4, 7, 11, 14], six: [0, 4, 7, 9] };
const PROGS = [
    [[0, "M7"], [9, "m7"], [5, "M7"], [7, "add9"]],
    [[2, "m7"], [7, "sus"], [0, "M9"], [9, "m9"]],
    [[5, "M7"], [4, "m7"], [9, "m7"], [0, "add9"]],
    [[9, "m9"], [5, "M7"], [0, "add9"], [7, "sus"]],
    [[0, "six"], [5, "M9"], [2, "m7"], [7, "sus"]],
];
const KEYS = [62, 65, 60, 67, 63, 58];     // D, F, C, G, Eb, Bb
const PENTA = [0, 2, 4, 7, 9];
const STYLE = {
    calm: { bpm: 66, drums: 0, bars: 2, mel: 0.22, pad: 1, keys: 0.6 },
    focus: { bpm: 78, drums: 1, bars: 1, mel: 0.3, pad: 0.6, keys: 1, swing: 0.16 },
    upbeat: { bpm: 102, drums: 2, bars: 1, mel: 0.38, pad: 0.35, keys: 0.9, swing: 0.06 },
};

let mus = null;   // { out, timer, next, step, bar, key, prog, style, lastMel }
function voice(root, q) {
    return QUAL[q].map((iv) => { let m = root + iv; while (m < 57) m += 12; while (m > 74) m -= 12; return m; }).sort((a, b) => a - b);
}
function epiano(t, m, dur, vol, d) {
    const g = ctx.createGain(); g.connect(d); if (mus) g.connect(mus.send);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    osc("sine", hz(m), t, t + dur + 0.9, g); osc("sine", hz(m), t, t + dur + 0.9, g, 7);
    const b = ctx.createGain(); b.connect(g); b.gain.setValueAtTime(0.25, t); b.gain.exponentialRampToValueAtTime(0.001, t + 0.25); osc("sine", hz(m) * 7, t, t + 0.3, b);
}
function pad(t, m, dur, vol, d) {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; f.Q.value = 0.4;
    const g = ctx.createGain(); f.connect(g); g.connect(d); if (mus) g.connect(mus.send);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(1.2, dur * 0.4)); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
    osc("triangle", hz(m), t, t + dur + 1.3, f, -6); osc("sawtooth", hz(m), t, t + dur + 1.3, f, 6);
}
function bass(t, m, dur, vol, d) {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 420;
    const g = ctx.createGain(); f.connect(g); g.connect(d); env(g, t, 0.01, vol, dur);
    osc("triangle", hz(m), t, t + dur + 0.1, f); osc("sine", hz(m), t, t + dur + 0.1, f);
}
/* A bright plucked synth for the game's theme: a square wave through a closing filter. */
function pluck(t, f, dur, vol, d) {
    const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 3; fl.frequency.setValueAtTime(3200, t); fl.frequency.exponentialRampToValueAtTime(700, t + Math.max(0.12, dur));
    const g = ctx.createGain(); fl.connect(g); g.connect(d); env(g, t, 0.004, vol, Math.max(0.08, dur));
    osc("square", f, t, t + dur + 0.1, fl); osc("sawtooth", f, t, t + dur + 0.1, fl, 8);
}
function kick(t, vol, d) {
    const g = ctx.createGain(); g.connect(d); env(g, t, 0.002, vol, 0.32);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); o.connect(g); o.start(t); o.stop(t + 0.4);
}

function startMusic() {
    if (mus || !running()) return;
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2.5); out.connect(musicBus);
    const send2 = ctx.createGain(); send2.connect(verb);
    send2.gain.setValueAtTime(0.0001, ctx.currentTime); send2.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2.5);
    mus = { out, send: send2, step: 0, bar: 0, next: ctx.currentTime + 0.15, key: KEYS[Math.floor(Math.random() * KEYS.length)], prog: Math.floor(Math.random() * PROGS.length), lastMel: 2, style: cfg.style };
    mus.timer = setInterval(schedule, 120); schedule();
}
function stopMusic() {
    if (!mus) return; const m = mus; mus = null; clearInterval(m.timer);
    if (!ctx) return; const t = ctx.currentTime;
    try { m.out.gain.cancelScheduledValues(t); m.out.gain.setValueAtTime(Math.max(0.0001, m.out.gain.value), t); m.out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); m.send.gain.cancelScheduledValues(t); m.send.gain.setValueAtTime(Math.max(0.0001, m.send.gain.value), t); m.send.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); } catch (e) { /* ignore */ }
    setTimeout(() => { try { m.out.disconnect(); m.send.disconnect(); } catch (e) { /* ignore */ } }, 1500);
}
function syncMusic() {
    const want = here && cfg.music && running() && !gm;   // the game's theme song takes over while a game is on
    if (want && mus && mus.style !== cfg.style) { stopMusic(); }
    if (want && !mus) startMusic(); else if (!want && mus) stopMusic();
}

/* Schedules 16th-note steps a little ahead of time. */
function schedule() {
    if (!mus || !ctx) return;
    const st = STYLE[mus.style] || STYLE.focus, sixteenth = 60 / st.bpm / 4, ahead = ctx.currentTime + 1.2, d = mus.out;
    while (mus.next < ahead) {
        const s = mus.step % 16, t = mus.next + (s % 2 === 1 ? sixteenth * (st.swing || 0) : 0);
        const prog = PROGS[mus.prog], ci = Math.floor(mus.bar / st.bars) % prog.length, [deg, q] = prog[ci], root = mus.key + deg, chordLen = sixteenth * 16 * st.bars;
        const firstOfChord = s === 0 && mus.bar % st.bars === 0;
        if (firstOfChord) {
            const v = voice(root, q);
            if (st.pad) v.forEach((m) => pad(t, m, chordLen, 0.035 * st.pad, d));
            if (st.keys) v.forEach((m, i) => epiano(t + i * (mus.style === "calm" ? 0.09 : 0.015), m, chordLen * 0.5, 0.06 * st.keys, d));
            let b = root; while (b > 47) b -= 12; while (b < 36) b += 12;
            bass(t, b, mus.style === "upbeat" ? sixteenth * 3 : chordLen * 0.45, 0.24, d);
        } else if (s === 8 && st.keys && mus.style !== "calm") {
            voice(root, q).slice(-3).forEach((m) => epiano(t, m, sixteenth * 6, 0.04 * st.keys, d));
            let b = root + 7; while (b > 50) b -= 12; while (b < 36) b += 12;
            bass(t, b, sixteenth * 3, 0.16, d);
        } else if (mus.style === "upbeat" && (s === 6 || s === 14)) {
            let b = root; while (b > 47) b -= 12; while (b < 36) b += 12; bass(t, b + 12, sixteenth * 1.5, 0.12, d);
        }
        if (st.drums) {
            if (s === 0 || (s === 10 && st.drums === 1) || (st.drums === 2 && (s === 4 || s === 8 || s === 12))) kick(t, st.drums === 2 ? 0.34 : 0.4, d);
            if (s === 4 || s === 12) noiseHit(t, 0.08, d, "bandpass", 1900, 0.13, 0.7);
            if (s % 2 === 0) noiseHit(t, s % 4 === 2 ? 0.05 : 0.03, d, "highpass", 7500, 0.035);
            if (st.drums === 2 && s % 2 === 1 && Math.random() < 0.3) noiseHit(t, 0.02, d, "highpass", 8500, 0.025);
        }
        // Melody: a few notes per bar, stepping around the pentatonic scale.
        const slot = mus.style === "calm" ? s % 4 === 0 : s % 2 === 0;
        if (slot && s !== 0 && Math.random() < st.mel) {
            mus.lastMel = Math.max(0, Math.min(9, mus.lastMel + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
            const m = mus.key + 12 + PENTA[mus.lastMel % 5] + 12 * Math.floor(mus.lastMel / 5);
            if (mus.style === "calm") bell(t, hz(m), 0.05, d, 2.2); else epiano(t, m, sixteenth * 3, 0.05, d);
        }
        mus.next += sixteenth; mus.step++;
        if (mus.step % 16 === 0) {
            mus.bar++;
            if (mus.bar % (prog.length * st.bars * 2) === 0) {   // after two passes, move on
                mus.prog = (mus.prog + 1 + Math.floor(Math.random() * (PROGS.length - 1))) % PROGS.length;
                if (Math.random() < 0.5) mus.key = KEYS[Math.floor(Math.random() * KEYS.length)];
            }
        }
    }
}

/* ---------- Vault Raid's theme song ----------
   An original 8-bar tune in A minor, written for Anchor Board: a plucked
   lead over a driving bass, with drums once the game starts. The phase
   sets the energy: lobby (light, no drums), play (full band), rush (the
   last 30 seconds: faster, busier). It loops until the game ends. */
const THEME = {
    // Each bar: a chord ([bass note, triad]) per half bar, and the melody as [16th step, note, 16ths long].
    chords: [[[45, [57, 60, 64]]], [[45, [57, 60, 64]]], [[41, [53, 57, 60]]], [[40, [56, 59, 64]]],
        [[38, [50, 53, 57]]], [[45, [57, 60, 64]]], [[41, [53, 57, 60]], [43, [55, 59, 62]]], [[40, [56, 59, 64]]]],
    tune: [
        [[0, 76, 2], [3, 76, 1], [4, 72, 2], [6, 74, 2], [8, 76, 2], [11, 79, 1], [12, 77, 2], [14, 76, 2]],
        [[0, 74, 3], [4, 72, 2], [6, 71, 2], [8, 72, 4], [12, 69, 4]],
        [[0, 72, 2], [3, 72, 1], [4, 74, 2], [6, 76, 2], [8, 77, 2], [11, 76, 1], [12, 74, 4]],
        [[0, 71, 2], [2, 68, 2], [4, 71, 2], [6, 74, 2], [8, 76, 6], [14, 74, 2]],
        [[0, 77, 2], [2, 74, 2], [4, 77, 2], [6, 81, 2], [8, 79, 4], [12, 77, 4]],
        [[0, 76, 2], [2, 72, 2], [4, 76, 2], [6, 79, 2], [8, 81, 6]],
        [[0, 77, 4], [4, 76, 2], [6, 74, 2], [8, 79, 4], [12, 77, 2], [14, 76, 2]],
        [[0, 74, 2], [2, 71, 2], [4, 68, 4], [8, 64, 4], [12, 68, 2], [14, 71, 2]],
    ],
    bpm: { lobby: 104, play: 116, rush: 132 },
};
let phase = "", gm = null;   // gm: { out, timer, next, step, bar }
/** The board says what the game is doing: "" (no game), "lobby", "play", "rush" or "paused". */
export function gamePhase(p) {
    const n = ["lobby", "play", "rush", "paused"].includes(p) ? p : "";
    if (n === phase) return;
    phase = n; syncGame(); syncMusic(); onState();
}
export const themeOn = () => !!gm;
function syncGame() {
    const want = here && cfg.game && running() && (phase === "lobby" || phase === "play" || phase === "rush");
    if (want && !gm) startTheme(); else if (!want && gm) stopTheme();
    if (!want && here && cfg.music && running() && !mus) syncMusic();
}
function startTheme() {
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2); out.connect(gameBus);
    if (mus) stopMusic();
    gm = { out, step: 0, bar: 0, next: ctx.currentTime + 0.1 };
    gm.timer = setInterval(themeSchedule, 100); themeSchedule();
}
function stopTheme() {
    const m = gm; gm = null; if (!m) return; clearInterval(m.timer);
    if (!ctx) return; const t = ctx.currentTime;
    try { m.out.gain.cancelScheduledValues(t); m.out.gain.setValueAtTime(Math.max(0.0001, m.out.gain.value), t); m.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); } catch (e) { /* ignore */ }
    setTimeout(() => { try { m.out.disconnect(); } catch (e) { /* ignore */ } }, 1200);
}
function themeSchedule() {
    if (!gm || !ctx) return;
    const ahead = ctx.currentTime + 0.6, d = gm.out;
    while (gm.next < ahead) {
        const ph = phase === "lobby" || phase === "rush" ? phase : "play", six = 60 / THEME.bpm[ph] / 4, s = gm.step % 16, t = gm.next;
        const bar = gm.bar % 8, ch = THEME.chords[bar], [root, triad] = ch[ch.length > 1 && s >= 8 ? 1 : 0];
        const full = ph !== "lobby";
        // Bass: eighth notes, jumping up an octave on the off beats.
        if (s % 2 === 0) bass(t, root + (s % 8 === 6 ? 12 : 0), six * 1.6, full ? 0.26 : 0.18, d);
        // Chord stabs on the "and" of each beat.
        if (s % 4 === 2) triad.forEach((m) => pluck(t, hz(m), six * 0.9, full ? 0.035 : 0.025, d));
        // The tune: every bar in play and rush; in the waiting room only on alternate passes, softer.
        if (full || Math.floor(gm.bar / 8) % 2 === 0) THEME.tune[bar].forEach(([at, m, len]) => { if (at === s) { pluck(t, hz(m), six * len * 0.9, full ? 0.11 : 0.07, d); if (full) mallet(t, hz(m + 12), 0.05, d); } });
        // Drums once the game is on.
        if (full) {
            if (s === 0 || s === 8 || (ph === "rush" && (s === 10 || s === 14))) kick(t, 0.42, d);
            if (s === 4 || s === 12) noiseHit(t, 0.1, d, "bandpass", 1800, 0.14, 0.7);
            if (ph === "rush" || s % 2 === 0) noiseHit(t, s % 4 === 2 ? 0.05 : 0.03, d, "highpass", 7500, 0.03);
        } else if (s === 0) noiseHit(t, 0.03, d, "highpass", 6000, 0.05);
        gm.next += six; gm.step++;
        if (gm.step % 16 === 0) gm.bar++;
    }
}

/* ---------- timer watcher ----------
   Called four times a second with every running timer. It works out which
   whole seconds passed since the last call and plays the cue for each,
   so a timer still rings when the board is showing a different screen. */
const seen = {};
/** spec: { kind, running, secs (elapsed whole seconds), total (seconds) or round: { len, gap } } */
export function watchTimer(spec) {
    const p = seen[spec.kind]; seen[spec.kind] = { running: spec.running, secs: spec.secs };
    if (!p) return;                              // first look after loading: never play old events
    if (!spec.running) return;
    if (!p.running) { if (spec.secs <= 1 || spec.round) cue("go"); return; }   // just started or resumed
    if (spec.secs <= p.secs) return;
    for (let s = Math.max(p.secs + 1, spec.secs - 3); s <= spec.secs; s++) {
        if (spec.round) {
            const { len, gap } = spec.round, x = s % (len + gap);
            if (x === 0) cue("go");
            else if (x === len - 30) cue("warn");
            else if (x === len) cue("rotate");
            else if (x >= len + gap - 3) cue(x === len + gap - 1 ? "tock" : "tick");
        } else {
            const r = spec.total - s;
            if (r === 0) cue("done");
            else if (r === 60 && spec.total >= 120) cue("warn");
            else if (r > 0 && r <= 5 && spec.total >= 20) cue(r === 1 ? "tock" : "tick");
        }
    }
}
