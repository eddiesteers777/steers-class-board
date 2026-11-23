// Music library rules (js/genres.js, js/sound.js styles). Run: node tools/board/music.test.mjs
// Plays every style for a minute through a stand-in audio engine: every instrument and drum a recipe names
// must exist, every part must actually play, and the picker's groups must list every style exactly once.
import assert from "node:assert/strict";
import { GENRES, GENRE_GROUPS, createGenre } from "../../js/genres.js";

const FIRST = ["calm", "chill", "focus", "upbeat", "christmas", "thanksgiving"];   // played by js/sound.js
let n = 0; const t = (name, fn) => { fn(); n++; };

function fakeCtx() {
    const made = { osc: 0, noise: 0 };
    const param = () => ({ value: 1, setValueAtTime() {}, exponentialRampToValueAtTime(v) { assert.ok(v > 0 && isFinite(v), "ramp to " + v); }, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
    const node = (x) => Object.assign({ connect() {}, disconnect() {} }, x);
    const ctx = {
        currentTime: 0, made,
        createGain: () => node({ gain: param() }),
        createOscillator: () => { made.osc++; return node({ type: "sine", frequency: param(), detune: param(), start() {}, stop() {} }); },
        createBiquadFilter: () => node({ type: "lowpass", frequency: param(), Q: param() }),
        createBufferSource: () => { made.noise++; return node({ buffer: null, loop: false, start() {}, stop() {} }); },
        createWaveShaper: () => node({ curve: null }),
    };
    return ctx;
}

t("every style in the picker exists, and every style is in the picker once", () => {
    const listed = GENRE_GROUPS.flatMap((g) => g[1]);
    assert.equal(new Set(listed).size, listed.length, "a style is listed twice");
    listed.forEach((id) => assert.ok(GENRES[id] || FIRST.includes(id), "unknown style " + id));
    Object.keys(GENRES).forEach((id) => assert.ok(listed.includes(id), id + " is not in a group"));
    FIRST.forEach((id) => assert.ok(listed.includes(id), id + " is not in a group"));
    assert.ok(Object.keys(GENRES).length >= 30);
});
t("every style plays a minute with no errors, and every part makes sound", () => {
    Object.keys(GENRES).forEach((id) => {
        const st = GENRES[id], ctx = fakeCtx(), g = createGenre(ctx, id, ctx.createGain(), ctx.createGain(), {}, 7);
        assert.ok(g, id);
        // count each part by turning the others off
        const parts = ["comp", "bass", "arp", "mel", "drums"].filter((k) => st[k]);
        g.fill(60); g.stop();
        assert.ok(ctx.made.osc > 50, id + " barely played");
        parts.forEach((k) => {
            const keep = {}; parts.filter((x) => x !== k).forEach((x) => { keep[x] = st[x]; delete st[x]; });
            const bed = st.bed; delete st.bed;
            const c2 = fakeCtx(), g2 = createGenre(c2, id, c2.createGain(), c2.createGain(), {}, 7); g2.fill(30);
            Object.assign(st, keep); if (bed) st.bed = bed;
            assert.ok(c2.made.osc + c2.made.noise > 4, id + ": the " + k + " part made no sound");
        });
        assert.ok(st.bpm >= 50 && st.bpm <= 160, id + " tempo");
        assert.ok(st.name && st.keys.length && st.prog.length, id);
    });
});
console.log("Music library: " + n + " checks passed (" + Object.keys(GENRES).length + " styles)");
