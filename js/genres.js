/* ==========================================
   Anchor Board — the music library (js/genres.js).
   Every style here is written as code and played live with the Web Audio API, like the first six in
   js/sound.js: no recordings, no samples, nothing copyrighted. Each style is a short recipe (tempo,
   feel, chords, which instruments play what rhythm) and the engine below turns it into music that keeps
   changing key and progression, so it never loops the same way twice.

   A recipe:
     bpm, beats (per bar), sub (steps per beat: 4 = sixteenths, 3 = triplet/swing feel), swing (0..0.3)
     keys: tonic notes (MIDI) to choose from; prog: progressions, each a list of [degree, quality, bars?]
     comp: chord parts  { ins, pat, vol, len?, oct?, top?, roll?, lo?, hi? }   pat "change" = once per chord
     bass: { ins, pat (R 5 8 3 7 6 4 A = root, fifth, octave, third, seventh, sixth, fourth, approach), walk?, vol }
     arp:  { ins, every, seq (up, updown, alberti, roll, montuno, random), oct, vol, len }
     mel:  { ins, scale, grid, density, oct, vol, len, phrase }   a short tune that repeats with changes
     drums: { kick: "x---", snare: "...", ... }   x = full, o = medium, . = ghost, - = rest
     bed: rain | vinyl | wind | space | stream | birds   (a quiet sound under the music)
   Patterns longer than one bar run across bars (a 2-bar clave is 32 steps at sub 4).
========================================== */

/* ---------- the styles, grouped the way the picker shows them ----------
   The first six (calm, chill, focus, upbeat, christmas, thanksgiving) live in js/sound.js and keep their sound. */
export const GENRE_GROUPS = [
    ["Calm & focus", ["calm", "chill", "focus", "piano", "rainy", "musicbox", "space", "classical", "sunny"]],
    ["Jazz, soul & blues", ["jazz", "bossa", "blues", "soul", "funk", "mystery"]],
    ["Pop & beats", ["upbeat", "pop", "dance", "hiphop", "rock", "synthwave", "chiptune"]],
    ["Around the world", ["reggae", "island", "salsa", "tango", "afrobeat", "bluegrass", "celtic"]],
    ["Big moments", ["epic", "gameshow", "march", "gameday"]],
    ["Holidays & seasons", ["halloween", "spooky", "thanksgiving", "christmas", "snowday", "valentine", "spring"]],
];

const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], MIX = [0, 2, 4, 5, 7, 9, 10];
const HARM = [0, 2, 3, 5, 7, 8, 11], PENT = [0, 2, 4, 7, 9], MPENT = [0, 3, 5, 7, 10], BLUES = [0, 3, 5, 6, 7, 10];
const POP = [[[0, "M"], [7, "M"], [9, "m"], [5, "M"]], [[9, "m"], [5, "M"], [0, "M"], [7, "M"]], [[0, "M"], [9, "m"], [5, "M"], [7, "sus"]], [[5, "M"], [0, "M"], [7, "M"], [9, "m"]]];
const MINPOP = [[[0, "m"], [8, "M"], [3, "M"], [10, "M"]], [[0, "m"], [10, "M"], [8, "M"], [7, "M"]], [[0, "m7"], [5, "m7"], [8, "M7"], [7, "sus"]]];

export const GENRES = {
    /* ---- Calm & focus ---- */
    piano: { name: "Study piano", bpm: 70, swing: 0.08, keys: [60, 65, 62, 67], bars: 2,
        prog: [[[0, "add9"], [7, "M"], [9, "m7"], [5, "M7"]], [[5, "M7"], [0, "add9"], [2, "m7"], [7, "sus"]], [[9, "m9"], [5, "M9"], [0, "add9"], [7, "sus"]]],
        comp: [{ ins: "piano", pat: "change", vol: 0.055, lo: 48, hi: 64, roll: 0.03 }],
        arp: { ins: "piano", every: 2, seq: "updown", oct: 0, vol: 0.045, len: 3, lo: 55, hi: 74 },
        mel: { ins: "piano", scale: PENT, grid: "x---", density: 0.45, oct: 12, vol: 0.065, len: 1 } },
    rainy: { name: "Rainy day", bpm: 64, swing: 0.1, keys: [62, 65, 58], bars: 2, bed: "rain",
        prog: [[[0, "M7"], [9, "m7"], [5, "M7"], [7, "add9"]], [[2, "m7"], [7, "sus"], [0, "M9"], [9, "m9"]]],
        comp: [{ ins: "pad", pat: "change", vol: 0.026 }, { ins: "ep", pat: "x-------x-------", vol: 0.035, roll: 0.05, len: 6 }],
        bass: { ins: "bass", pat: "R---------------", vol: 0.16 },
        mel: { ins: "ep", scale: PENT, grid: "x---", density: 0.3, oct: 12, vol: 0.04, len: 1 } },
    musicbox: { name: "Music box", bpm: 92, beats: 3, keys: [65, 70, 63], bars: 1,
        prog: [[[0, "M"], [5, "M"], [7, "M"], [0, "M"]], [[0, "M"], [9, "m"], [2, "m"], [7, "M"]]],
        arp: { ins: "musicbox", every: 2, seq: "alberti", oct: 12, vol: 0.05, len: 2, lo: 60, hi: 79 },
        bass: { ins: "harp", pat: "R-----------", vol: 0.13 },
        mel: { ins: "musicbox", scale: MAJ, grid: "x---", density: 0.55, oct: 24, vol: 0.06, len: 1 } },
    space: { name: "Deep space", bpm: 60, keys: [62, 57, 64], bars: 2, bed: "space",
        prog: [[[0, "M7"], [2, "M"], [0, "M7"], [2, "M"]], [[0, "m9"], [8, "M7"], [5, "m9"], [3, "M7"]]],
        comp: [{ ins: "pad", pat: "change", vol: 0.036 }, { ins: "strings", pat: "change", vol: 0.016, oct: 12 }],
        arp: { ins: "bell", every: 2, seq: "random", oct: 24, vol: 0.02, len: 4, chance: 0.35 },
        mel: { ins: "synth", scale: [0, 2, 4, 6, 7, 9, 11], grid: "x-------", density: 0.35, oct: 12, vol: 0.022, len: 1.5, glide: true } },
    classical: { name: "Classical", bpm: 100, keys: [62, 67, 60, 65], bars: 1,
        prog: [[[0, "M"], [7, "M"], [9, "m"], [4, "m"], [5, "M"], [0, "M"], [5, "M"], [7, "7"]], [[0, "M"], [5, "M"], [7, "7"], [0, "M"]]],
        comp: [{ ins: "strings", pat: "change", vol: 0.015 }],
        arp: { ins: "harpsi", every: 2, seq: "alberti", oct: 0, vol: 0.05, len: 2, lo: 55, hi: 74 },
        bass: { ins: "cello", pat: "R---R---5---5---", vol: 0.045 },
        mel: { ins: "violin", scale: MAJ, grid: "x-x-", density: 0.55, oct: 12, vol: 0.045, len: 1 } },
    sunny: { name: "Sunny morning", bpm: 108, keys: [60, 67, 62, 65], bars: 1,
        prog: POP,
        comp: [{ ins: "ep", pat: "x-------x-------", vol: 0.03, len: 6 }],
        arp: { ins: "marimba", every: 2, seq: "updown", oct: 12, vol: 0.06, len: 2 },
        bass: { ins: "bass", pat: "R-------5---R---", vol: 0.17 },
        mel: { ins: "flute", scale: PENT, grid: "x-x-", density: 0.45, oct: 12, vol: 0.03, len: 1 },
        drums: { kick: "x-------x-------", rim: "----x-------x---", shaker: "x.x.x.x.x.x.x.x." } },

    /* ---- Jazz, soul & blues ---- */
    jazz: { name: "Jazz café", bpm: 132, sub: 3, keys: [65, 70, 63, 60], bars: 1,
        prog: [[[2, "m9"], [7, "13"], [0, "M9"], [0, "M9"]], [[4, "m7"], [9, "7"], [2, "m9"], [7, "13"]], [[0, "M9"], [9, "7"], [2, "m9"], [7, "13"]], [[5, "M9"], [10, "9"], [4, "m7"], [9, "7"], [2, "m9"], [7, "13"], [0, "M9"], [0, "M9"]]],
        comp: [{ ins: "ep", pat: "-----x-----x------x--x-----", vol: 0.04, len: 2, top: 4 }],
        bass: { ins: "upright", walk: true, vol: 0.22 },
        mel: { ins: "vibes", scale: [0, 2, 3, 4, 7, 9], grid: "x-x", density: 0.5, oct: 12, vol: 0.05, len: 1 },
        drums: { ride: "x--x-xx--x-x", hat: "---x-----x--", kick: ".-----------", snare: "--------.--." } },
    bossa: { name: "Bossa nova", bpm: 128, keys: [62, 64, 67], bars: 2,
        prog: [[[0, "M9"], [0, "M9"], [2, "m9"], [7, "13"]], [[2, "m7"], [7, "9"], [0, "M7"], [9, "m7"]], [[5, "M7"], [4, "m7"], [9, "7"], [2, "m9"]]],
        comp: [{ ins: "nylon", pat: "x--x--x---x--x----x--x---x--x---", vol: 0.04, len: 2, top: 4, roll: 0.012 }],
        bass: { ins: "bass", pat: "R-----5-R-----5-", vol: 0.2 },
        mel: { ins: "flute", scale: MAJ, grid: "x-x-", density: 0.4, oct: 12, vol: 0.032, len: 1.2 },
        drums: { rim: "x--x--x---x--x----x--x---x--x---", shaker: "xoxoxoxoxoxoxoxo", kick: "x-----xx-----x--" } },
    blues: { name: "Blues shuffle", bpm: 92, sub: 3, keys: [57, 64, 55], bars: 1,
        prog: [[[0, "7"], [5, "7"], [0, "7"], [0, "7"], [5, "7"], [5, "7"], [0, "7"], [0, "7"], [7, "7"], [5, "7"], [0, "7"], [7, "7"]]],
        comp: [{ ins: "organ", pat: "--x--x--x--x", vol: 0.026, len: 1, top: 3 }],
        bass: { ins: "bass", pat: "R-35-67-65-3", vol: 0.18 },
        mel: { ins: "sax", scale: BLUES, grid: "x-x", density: 0.42, oct: 12, vol: 0.035, len: 1.3 },
        drums: { kick: "x-----x-----", snare: "---x-----x--", hat: "x-xx-xx-xx-x" } },
    soul: { name: "Soul", bpm: 66, sub: 3, keys: [63, 65, 60], bars: 1,
        prog: [[[0, "M"], [5, "M"], [0, "M"], [7, "7"]], [[0, "M"], [4, "m7"], [5, "M"], [7, "sus"]], [[5, "M7"], [4, "m7"], [2, "m7"], [7, "7"]]],
        comp: [{ ins: "organ", pat: "change", vol: 0.022 }, { ins: "piano", pat: "x.ox.ox.ox.o", vol: 0.03, len: 1, top: 3 }],
        bass: { ins: "bass", pat: "R-----5--R--", vol: 0.2 },
        mel: { ins: "sax", scale: PENT, grid: "x--", density: 0.4, oct: 12, vol: 0.033, len: 2 },
        drums: { kick: "x-----x-x---", snare: "---x-----x--", hat: "xooxooxooxoo" } },
    funk: { name: "Funk", bpm: 104, keys: [64, 62, 69], bars: 2,
        prog: [[[0, "m7"], [5, "9"]], [[0, "9"], [0, "9"], [5, "9"], [7, "9"]], [[0, "m7"], [0, "m7"], [3, "M7"], [5, "9"]]],
        comp: [{ ins: "scratch", pat: "-x-x.x-x-x.x-xx-", vol: 0.05 }, { ins: "brass", pat: "------x-------x-", vol: 0.03, len: 1, top: 3 }],
        bass: { ins: "slap", pat: "R--8-R--R-8-5-7-", vol: 0.2 },
        mel: { ins: "synth", scale: MPENT, grid: "x-x-", density: 0.3, oct: 12, vol: 0.025, len: 1 },
        drums: { kick: "x-x----x--x-----", snare: "----x--o.---x--o", hat: "xoxoxoxoxoxoxoxo" } },
    mystery: { name: "Mystery", bpm: 84, sub: 3, keys: [62, 57, 64], bars: 1,
        prog: [[[0, "m"], [0, "mM7"], [0, "m7"], [0, "m6"]], [[5, "m7"], [5, "m6"], [0, "m"], [7, "7"]]],
        comp: [{ ins: "vibes", pat: "x-----x-----", vol: 0.035, len: 4 }],
        bass: { ins: "upright", walk: true, vol: 0.2 },
        mel: { ins: "mute", scale: [0, 2, 3, 5, 7, 8, 11], grid: "x-x", density: 0.3, oct: 12, vol: 0.03, len: 2 },
        drums: { snap: "---x-----x--", brush: "x--x--x--x--", kick: ".-----------" } },

    /* ---- Pop & beats ---- */
    pop: { name: "Pop", bpm: 112, keys: [60, 67, 62, 64], bars: 1, prog: POP,
        comp: [{ ins: "piano", pat: "x-x-x-x-x-x-x-x-", vol: 0.026, len: 1.5, top: 3 }, { ins: "pad", pat: "change", vol: 0.018 }],
        bass: { ins: "synthbass", pat: "R-R-R-R-R-R-R-8-", vol: 0.16 },
        mel: { ins: "synth", scale: PENT, grid: "x-x-", density: 0.55, oct: 12, vol: 0.03, len: 1 },
        drums: { kick: "x-------x-x-----", clap: "----x-------x---", hat: "x-x-x-x-x-x-x-x-", shaker: "-.-.-.-.-.-.-.-." } },
    dance: { name: "Dance party", bpm: 124, keys: [57, 62, 64], bars: 1, prog: MINPOP,
        comp: [{ ins: "stab", pat: "--x---x---x---x-", vol: 0.03, len: 1.4, top: 4 }],
        bass: { ins: "synthbass", pat: "--R---R---R---R-", vol: 0.17 },
        arp: { ins: "pluck", every: 1, seq: "up", oct: 12, vol: 0.016, len: 0.8 },
        mel: { ins: "synth", scale: MIN, grid: "x-x-", density: 0.45, oct: 12, vol: 0.028, len: 1 },
        drums: { kick: "x---x---x---x---", clap: "----x-------x---", ohat: "--x---x---x---x-", hat: "x-x-x-x-x-x-x-x-" } },
    hiphop: { name: "Hip-hop beat", bpm: 88, swing: 0.14, keys: [62, 65, 58], bars: 2, bed: "vinyl",
        prog: [[[0, "m9"], [5, "m9"]], [[0, "m7"], [8, "M7"], [3, "M7"], [7, "m7"]], [[9, "m9"], [2, "m9"]]],
        comp: [{ ins: "ep", pat: "x-------x-----x-", vol: 0.04, len: 6, top: 4, roll: 0.02 }],
        bass: { ins: "sub", pat: "R-------R--R----R---------R-----", vol: 0.22 },
        mel: { ins: "bell", scale: MPENT, grid: "x---", density: 0.3, oct: 12, vol: 0.02, len: 2 },
        drums: { kick: "x------x-x------x-----x--x------", snare: "----x-------x-------x-------x--.", hat: "x-x-xox-x-x-xox-" } },
    rock: { name: "Rock", bpm: 128, keys: [64, 57, 62], bars: 1,
        prog: [[[0, "5"], [10, "5"], [5, "5"], [0, "5"]], [[0, "5"], [8, "5"], [10, "5"], [10, "5"]], [[0, "5"], [5, "5"], [7, "5"], [5, "5"]]],
        comp: [{ ins: "drive", pat: "x-o-o-o-x-o-o-o-", vol: 0.03, len: 1.6, lo: 40, hi: 64 }],
        bass: { ins: "bass", pat: "R-R-R-R-R-R-R-R-", vol: 0.17 },
        mel: { ins: "lead", scale: MPENT, grid: "x-x-", density: 0.35, oct: 12, vol: 0.022, len: 1.3 },
        drums: { kick: "x-----x-x-------", snare: "----x-------x---", hat: "x-x-x-x-x-x-x-x-", crash: "x---------------------------------------------------------------" } },
    synthwave: { name: "Synthwave", bpm: 100, keys: [57, 62, 64], bars: 1, prog: MINPOP,
        comp: [{ ins: "pad", pat: "change", vol: 0.03 }],
        bass: { ins: "synthbass", pat: "R-8-R-8-R-8-R-8-", vol: 0.15 },
        arp: { ins: "pluck", every: 1, seq: "updown", oct: 12, vol: 0.017, len: 0.8 },
        mel: { ins: "lead", scale: MIN, grid: "x-x-", density: 0.4, oct: 12, vol: 0.025, len: 1.4, glide: true },
        drums: { kick: "x-------x-------", snare: "----x-------x---", hat: "x-x-x-x-x-x-x-x-" }, bigSnare: true },
    chiptune: { name: "8-bit", bpm: 140, keys: [60, 67, 65], bars: 1, prog: POP,
        arp: { ins: "chip", every: 1, seq: "up", oct: 12, vol: 0.015, len: 0.9 },
        bass: { ins: "chiptri", pat: "R-R-5-R-R-8-5-R-", vol: 0.12 },
        mel: { ins: "chip", scale: MAJ, grid: "x-x-", density: 0.55, oct: 24, vol: 0.02, len: 1 },
        drums: { chipkick: "x-------x-------", chipsnare: "----x-------x---", chiphat: "x-x-x-x-x-x-x-x-" } },

    /* ---- Around the world ---- */
    reggae: { name: "Reggae", bpm: 76, swing: 0.1, keys: [67, 62, 65], bars: 1,
        prog: [[[0, "M"], [5, "M"], [0, "M"], [7, "M"]], [[2, "m"], [7, "M"], [2, "m"], [7, "M"]], [[0, "M"], [9, "m"], [5, "M"], [7, "M"]]],
        comp: [{ ins: "skank", pat: "----x-------x---", vol: 0.04, len: 0.6, top: 3 }, { ins: "organ", pat: "--o---o---o---o-", vol: 0.016, len: 0.6, top: 3 }],
        bass: { ins: "bass", pat: "R---5-8-R---3-5-", vol: 0.22 },
        mel: { ins: "melodica", scale: PENT, grid: "x-x-", density: 0.3, oct: 12, vol: 0.026, len: 1.3 },
        drums: { kick: "--------x-------", rim: "--------x-------", hat: "x-x-x-x-x-x-x-x-" } },
    island: { name: "Island", bpm: 112, keys: [65, 60, 67], bars: 1,
        prog: [[[0, "M"], [5, "M"], [7, "7"], [0, "M"]], [[0, "M"], [0, "M"], [7, "7"], [7, "7"]], [[5, "M"], [0, "M"], [7, "7"], [0, "M"]]],
        comp: [{ ins: "steel", pat: "x--x--x-x--x--x-", vol: 0.028, len: 1, top: 3, oct: 12 }],
        bass: { ins: "bass", pat: "R--5--R-R--5--8-", vol: 0.19 },
        mel: { ins: "steel", scale: MAJ, grid: "x-x-", density: 0.55, oct: 12, vol: 0.05, len: 1 },
        drums: { kick: "x-------x-------", conga: "--o-x--o--o-x--o", shaker: "xoxoxoxoxoxoxoxo", cowbell: "x---x---x---x---" } },
    salsa: { name: "Salsa", bpm: 96, keys: [62, 57, 64], bars: 1,
        prog: [[[0, "m"], [5, "7"], [7, "7"], [0, "m"]], [[0, "m7"], [5, "7"], [10, "M"], [7, "7"]]],
        arp: { ins: "piano", every: 2, seq: "montuno", oct: 12, vol: 0.04, len: 1.6 },
        bass: { ins: "bass", pat: "------5-----R---", vol: 0.2 },
        mel: { ins: "brass", scale: HARM, grid: "x-x-", density: 0.35, oct: 12, vol: 0.022, len: 1 },
        drums: { clave: "x-----x-----x-------x---x-------", conga: "--o-x--o-x-o-o--", cowbell: "x---x---x---x---", shaker: "x.x.x.x.x.x.x.x." } },
    tango: { name: "Tango", bpm: 116, keys: [64, 62, 57], bars: 1,
        prog: [[[0, "m"], [0, "m"], [7, "7"], [7, "7"]], [[0, "m"], [5, "m"], [7, "7"], [0, "m"]], [[0, "m"], [8, "M"], [5, "m6"], [7, "7"]]],
        comp: [{ ins: "accordion", pat: "x---x---x---x---", vol: 0.06, len: 2, top: 3 }],
        bass: { ins: "cello", pat: "R--5--R-5---R---", vol: 0.05 },
        mel: { ins: "violin", scale: HARM, grid: "x-x-", density: 0.45, oct: 12, vol: 0.045, len: 1.2 },
        drums: { rim: "x--x--x-x-------" } },
    afrobeat: { name: "Afrobeat", bpm: 110, keys: [62, 64, 57], bars: 2,
        prog: [[[0, "m7"], [5, "7"]], [[0, "m7"], [0, "m7"], [5, "9"], [7, "m7"]]],
        arp: { ins: "nylon", every: 2, seq: "updown", oct: 12, vol: 0.035, len: 1.2 },
        comp: [{ ins: "scratch", pat: "x.x.-x.x.x.-x.x-", vol: 0.04 }],
        bass: { ins: "bass", pat: "R--R-5--R---8-5-", vol: 0.2 },
        mel: { ins: "brass", scale: DOR, grid: "x-x-", density: 0.3, oct: 12, vol: 0.022, len: 1 },
        drums: { kick: "x-----x---x-----", snare: "----x--.----x--o", hat: "x.x.xx.x.x.xx.x.", conga: "--o-x-o---o-x-oo", cowbell: "x--x--x---x-x---" } },
    bluegrass: { name: "Bluegrass", bpm: 124, keys: [67, 62, 69], bars: 1,
        prog: [[[0, "M"], [0, "M"], [5, "M"], [0, "M"], [0, "M"], [0, "M"], [7, "M"], [0, "M"]], [[0, "M"], [5, "M"], [7, "M"], [0, "M"]]],
        arp: { ins: "banjo", every: 1, seq: "roll", oct: 12, vol: 0.026, len: 0.8 },
        comp: [{ ins: "nylon", pat: "----x-------x---", vol: 0.03, len: 1, top: 3 }],
        bass: { ins: "upright", pat: "R-------5-------", vol: 0.2 },
        mel: { ins: "fiddle", scale: MIX, grid: "x-x-", density: 0.5, oct: 12, vol: 0.028, len: 1 },
        drums: { brush: "----x-------x---" } },
    celtic: { name: "Celtic", bpm: 104, sub: 3, keys: [62, 64, 57], bars: 1,
        prog: [[[0, "m"], [10, "M"], [0, "m"], [10, "M"]], [[0, "m"], [5, "M"], [10, "M"], [0, "m"]], [[0, "m"], [3, "M"], [10, "M"], [5, "M"]]],
        comp: [{ ins: "drone", pat: "change", vol: 0.03 }],
        arp: { ins: "harp", every: 1, seq: "updown", oct: 0, vol: 0.04, len: 1.5 },
        mel: { ins: "whistle", scale: DOR, grid: "xxx", density: 0.6, oct: 24, vol: 0.034, len: 1 },
        drums: { bodhran: "x--o--x--o-.", } },

    /* ---- Big moments ---- */
    epic: { name: "Epic adventure", bpm: 90, keys: [62, 57, 60], bars: 1,
        prog: [[[0, "m"], [8, "M"], [3, "M"], [10, "M"]], [[0, "m"], [10, "M"], [8, "M"], [7, "M"]], [[8, "M"], [10, "M"], [0, "m"], [0, "m"]]],
        comp: [{ ins: "strings", pat: "change", vol: 0.016 }, { ins: "choir", pat: "change", vol: 0.009, oct: 12 }, { ins: "brass", pat: "x-------------x-", vol: 0.024, len: 6, top: 3 }],
        arp: { ins: "cello", every: 2, seq: "ostinato", oct: -12, vol: 0.05, len: 1.6 },
        mel: { ins: "horn", scale: MIN, grid: "x---", density: 0.45, oct: 0, vol: 0.035, len: 2 },
        drums: { taiko: "x--o--o-x--o----", timp: "o-------o-------" } },
    gameshow: { name: "Game show", bpm: 126, sub: 3, keys: [70, 65, 67], bars: 1,
        prog: [[[0, "M7"], [9, "7"], [2, "m7"], [7, "7"]], [[4, "m7"], [9, "7"], [2, "m7"], [7, "7"]]],
        comp: [{ ins: "brass", pat: "x-----x--x--", vol: 0.03, len: 1, top: 3 }],
        bass: { ins: "upright", walk: true, vol: 0.2 },
        mel: { ins: "vibes", scale: MAJ, grid: "x-x", density: 0.5, oct: 12, vol: 0.045, len: 1 },
        drums: { ride: "x--x-xx--x-x", snare: "---x-----x--", kick: "x-----x-----", bongo: "--x-----x-x-" } },
    march: { name: "Marching band", bpm: 116, keys: [70, 65, 63], bars: 1,
        prog: [[[0, "M"], [0, "M"], [7, "7"], [0, "M"]], [[0, "M"], [5, "M"], [7, "7"], [0, "M"]], [[5, "M"], [0, "M"], [7, "7"], [0, "M"]]],
        comp: [{ ins: "brass", pat: "----x-------x---", vol: 0.022, len: 1.5, top: 3 }],
        bass: { ins: "tuba", pat: "R-------5-------", vol: 0.13 },
        mel: { ins: "piccolo", scale: MAJ, grid: "x-x-", density: 0.6, oct: 24, vol: 0.022, len: 1 },
        drums: { kick: "x-------x-------", snare: "x-.xx-.xx-.x.x.x", cymbal: "x-------x-------" } },
    gameday: { name: "Game day", bpm: 100, keys: [62, 64, 57], bars: 1, prog: MINPOP,
        comp: [{ ins: "brass", pat: "x-----x---x-----", vol: 0.03, len: 1, top: 3 }],
        bass: { ins: "synthbass", pat: "R-R---R-R-R---R-", vol: 0.15 },
        drums: { snare: "x.x.xox.x.xox.xx", tom: "x---x-x-x---x-x-", clap: "----x-------x---", kick: "x-------x-x-----" } },

    /* ---- Holidays & seasons ---- */
    halloween: { name: "Halloween", bpm: 100, beats: 3, keys: [57, 62, 52], bars: 1, bed: "wind", ghosts: true,
        prog: [[[0, "m"], [5, "m"], [7, "7"], [0, "m"]], [[0, "m"], [8, "M"], [11, "dim7"], [7, "7"]], [[0, "m"], [1, "M"], [7, "7"], [0, "m"]]],
        comp: [{ ins: "organ", pat: "change", vol: 0.016, lo: 45, hi: 60 }],
        arp: { ins: "harpsi", every: 2, seq: "up", oct: 12, vol: 0.03, len: 2 },
        bass: { ins: "organbass", pat: "R-----------", vol: 0.05 },
        mel: { ins: "theremin", scale: HARM, grid: "x---", density: 0.4, oct: 12, vol: 0.036, len: 2.2, glide: true },
        drums: { tick: "x-------x---", tock: "----x-------" } },
    spooky: { name: "Spooky party", bpm: 150, keys: [64, 57, 62], bars: 1,
        prog: [[[0, "m"], [0, "m"], [8, "M"], [7, "7"]], [[0, "m"], [5, "m"], [8, "M"], [7, "7"]]],
        comp: [{ ins: "organ", pat: "--x---x---x---x-", vol: 0.022, len: 1, top: 3 }],
        bass: { ins: "bass", pat: "R-R-5-5-8-8-5-5-", vol: 0.16 },
        mel: { ins: "surf", scale: HARM, grid: "x---", density: 0.55, oct: 12, vol: 0.026, len: 2 },
        drums: { kick: "x---x---x---x---", snare: "----x-------x---", hat: "x-x-x-x-x-x-x-x-" } },
    snowday: { name: "Snow day", bpm: 76, keys: [67, 62, 65], bars: 2,
        prog: [[[0, "add9"], [5, "M7"], [9, "m7"], [7, "sus"]], [[5, "M9"], [0, "add9"], [2, "m7"], [7, "sus"]]],
        comp: [{ ins: "pad", pat: "change", vol: 0.03 }],
        arp: { ins: "musicbox", every: 2, seq: "updown", oct: 12, vol: 0.045, len: 2.5 },
        mel: { ins: "bell", scale: PENT, grid: "x---", density: 0.35, oct: 12, vol: 0.04, len: 2 },
        drums: { shaker: "..-...-...-...-." } },
    valentine: { name: "Valentine's", bpm: 58, beats: 2, sub: 3, keys: [65, 63, 70], bars: 1,
        prog: [[[0, "M7"], [9, "m7"], [2, "m7"], [7, "sus"]], [[5, "M7"], [4, "m7"], [2, "m7"], [7, "7"]]],
        comp: [{ ins: "strings", pat: "change", vol: 0.015 }],
        arp: { ins: "harp", every: 1, seq: "updown", oct: 0, vol: 0.032, len: 2 },
        bass: { ins: "cello", pat: "R-----", vol: 0.045 },
        mel: { ins: "flute", scale: MAJ, grid: "x--", density: 0.5, oct: 12, vol: 0.03, len: 1.6 } },
    spring: { name: "Spring", bpm: 96, keys: [67, 62, 60], bars: 1, bed: "birds",
        prog: [[[0, "M"], [5, "M"], [9, "m"], [7, "M"]], [[0, "add9"], [7, "M"], [5, "M7"], [5, "M7"]]],
        arp: { ins: "harp", every: 2, seq: "updown", oct: 0, vol: 0.03, len: 2 },
        comp: [{ ins: "pizz", pat: "x---x---x---x---", vol: 0.025, len: 1, top: 3 }],
        bass: { ins: "bass", pat: "R-------5-------", vol: 0.14 },
        mel: { ins: "flute", scale: PENT, grid: "x-x-", density: 0.45, oct: 12, vol: 0.03, len: 1.2 },
        drums: { shaker: "x.x.x.x.x.x.x.x." } },
};

/* ---------- chord shapes ---------- */
const Q = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], 9: [0, 4, 7, 10, 14], 13: [0, 4, 10, 14, 21],
    add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], M9: [0, 4, 7, 11, 14], sus: [0, 5, 7, 10], six: [0, 4, 7, 9], m6: [0, 3, 7, 9],
    mM7: [0, 3, 7, 11], dim7: [0, 3, 6, 9], 5: [0, 7, 12] };
const voice = (root, q, lo, hi) => (Q[q] || Q.M).map((iv) => { let m = root + iv; while (m < lo) m += 12; while (m > hi) m -= 12; return m; }).sort((a, b) => a - b);

/* ---------- instruments ----------
   ctx: an AudioContext (or OfflineAudioContext for checks). send: the room (reverb) input. */
function kit(ctx, noiseBuf, send) {
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const out = (dest, rev) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(dest);   // silent until its note starts
        if (send && rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(send); } return g; };
    const o = (type, f, t, end, dest, det) => { const x = ctx.createOscillator(); x.type = type; x.frequency.setValueAtTime(f, t); if (det) x.detune.value = det; x.connect(dest); x.start(t); x.stop(end); return x; };
    const filt = (type, f, q, dest) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q || 0.7; x.connect(dest); return x; };
    // pluck: fast attack, falls away over d.  hold: attack a, held at s for dur, released over r.
    const pluck = (p, t, a, peak, d) => { p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); p.exponentialRampToValueAtTime(0.0001, t + a + d); return t + a + d; };
    const hold = (p, t, a, peak, s, dur, r) => {
        const pk = Math.max(peak, 0.0002), sv = Math.max(pk * s, 0.0002), d1 = t + a + Math.min(0.25, Math.max(0.02, dur * 0.3)), end = Math.max(d1, t + dur);
        p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(pk, t + a); p.exponentialRampToValueAtTime(sv, d1); p.setValueAtTime(sv, end); p.exponentialRampToValueAtTime(0.0001, end + r); return end + r;
    };
    const vib = (x, t, end, rate, cents, delay) => { const l = ctx.createOscillator(), g = ctx.createGain(); l.frequency.value = rate; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(cents, t + (delay || 0.2)); l.connect(g); g.connect(x.detune); l.start(t); l.stop(end); };
    const nz = (t, d, dest) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02); return s; };
    let gl = { theremin: 0, synth: 0, lead: 0 };   // last pitch, for the instruments that slide between notes
    const slide = (k, x, f, t, on) => { if (on && gl[k] && Math.abs(Math.log2(gl[k] / f)) < 1) { x.frequency.setValueAtTime(gl[k], t); x.frequency.exponentialRampToValueAtTime(f, t + 0.12); } gl[k] = f; };
    const shaper = (() => { const c = new Float32Array(1025); for (let i = 0; i < 1025; i++) { const v = i / 512 - 1; c[i] = Math.tanh(v * 5); } return c; })();   // odd length: silence in gives silence out
    const I = {
        piano(t, m, dur, v, d) {
            const g = out(d, 0.45), f = filt("lowpass", 2600 + m * 10, 0.5, g), e = pluck(g.gain, t, 0.006, v, 1.4 + dur * 0.6);
            o("triangle", hz(m), t, e, f); o("sine", hz(m) * 2, t, e, f, 3);
            const h = out(d, 0); pluck(h.gain, t, 0.002, v * 0.25, 0.08); o("sine", hz(m) * 5, t, t + 0.1, h);
        },
        ep(t, m, dur, v, d) {
            const g = out(d, 0.4); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
            o("sine", hz(m), t, t + dur + 0.9, g); o("sine", hz(m), t, t + dur + 0.9, g, 7);
            const b = ctx.createGain(); b.connect(g); b.gain.setValueAtTime(0.25, t); b.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o("sine", hz(m) * 7, t, t + 0.3, b);
        },
        organ(t, m, dur, v, d) {
            const g = out(d, 0.3), e = hold(g.gain, t, 0.015, v, 0.85, dur, 0.08);
            [[1, 1], [2, 0.55], [3, 0.3], [4, 0.22], [8, 0.08]].forEach(([r, a]) => { const h = ctx.createGain(); h.gain.value = a; h.connect(g); o("sine", hz(m) * r, t, e, h); });
        },
        organbass(t, m, dur, v, d) { const g = out(d, 0.2), e = hold(g.gain, t, 0.03, v, 0.8, dur, 0.2); o("sine", hz(m), t, e, g); const h = ctx.createGain(); h.gain.value = 0.35; h.connect(g); o("sine", hz(m) * 2, t, e, h); },
        accordion(t, m, dur, v, d) { const g = out(d, 0.25), f = filt("bandpass", 1300, 0.6, g), e = hold(g.gain, t, 0.02, v, 0.8, dur * 0.7, 0.05); o("sawtooth", hz(m), t, e, f, -6); o("square", hz(m), t, e, f, 6); },
        pad(t, m, dur, v, d) {
            const g = out(d, 0.6), f = filt("lowpass", 900, 0.4, g); hold(g.gain, t, Math.min(1.2, dur * 0.4), v, 1, dur * 0.85, 1.2);
            o("triangle", hz(m), t, t + dur + 1.3, f, -6); o("sawtooth", hz(m), t, t + dur + 1.3, f, 6);
        },
        drone(t, m, dur, v, d) { I.pad(t, m - 12, dur, v, d); },
        strings(t, m, dur, v, d) {
            const g = out(d, 0.55), f = filt("lowpass", 2000, 0.5, g), e = hold(g.gain, t, Math.min(0.5, dur * 0.3), v, 1, dur * 0.9, 0.6);
            [-9, 0, 9].forEach((det) => { const x = o("sawtooth", hz(m), t, e, f, det); vib(x, t, e, 5.2, 7, 0.3); });
        },
        choir(t, m, dur, v, d) {
            const g = out(d, 0.6), a = filt("bandpass", 700, 4, g), b = filt("bandpass", 1150, 5, g), e = hold(g.gain, t, 0.6, v * 3, 1, dur * 0.9, 0.8);
            [-7, 7].forEach((det) => { const x = o("sawtooth", hz(m), t, e, a, det); vib(x, t, e, 4.6, 9, 0.4); o("sawtooth", hz(m), t, e, b, -det); });
        },
        violin(t, m, dur, v, d) { const g = out(d, 0.45), f = filt("lowpass", 3200, 0.7, g), e = hold(g.gain, t, 0.06, v, 0.85, dur, 0.18); const x = o("sawtooth", hz(m), t, e, f); vib(x, t, e, 5.6, 14, 0.18); },
        fiddle(t, m, dur, v, d) { const g = out(d, 0.3), f = filt("lowpass", 3600, 0.8, g), e = hold(g.gain, t, 0.025, v, 0.8, dur, 0.1); const x = o("sawtooth", hz(m), t, e, f); vib(x, t, e, 6, 10, 0.12); },
        cello(t, m, dur, v, d) { const g = out(d, 0.35), f = filt("lowpass", 1100, 0.6, g), e = hold(g.gain, t, 0.04, v, 0.8, dur * 0.85, 0.15); const x = o("sawtooth", hz(m), t, e, f); vib(x, t, e, 5, 8, 0.25); o("sine", hz(m), t, e, g); },
        pizz(t, m, dur, v, d) { const g = out(d, 0.4), f = filt("lowpass", 1800, 0.8, g), e = pluck(g.gain, t, 0.003, v, 0.28); o("triangle", hz(m), t, e, f); o("sawtooth", hz(m), t, e, f, 4); },
        brass(t, m, dur, v, d) {
            const g = out(d, 0.3), f = filt("lowpass", 400, 1.2, g), e = hold(g.gain, t, 0.03, v, 0.8, dur, 0.12);
            f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.06); f.frequency.exponentialRampToValueAtTime(1500, t + 0.3);
            o("sawtooth", hz(m), t, e, f, -5); o("sawtooth", hz(m), t, e, f, 5);
        },
        horn(t, m, dur, v, d) { const g = out(d, 0.5), f = filt("lowpass", 900, 0.8, g), e = hold(g.gain, t, 0.08, v, 0.9, dur, 0.3); const x = o("sawtooth", hz(m), t, e, f); vib(x, t, e, 5, 6, 0.3); o("triangle", hz(m), t, e, g); },
        tuba(t, m, dur, v, d) { const g = out(d, 0.1), f = filt("lowpass", 500, 0.7, g), e = hold(g.gain, t, 0.03, v, 0.7, Math.min(dur, 0.35), 0.1); o("sawtooth", hz(m), t, e, f); o("sine", hz(m), t, e, g); },
        stab(t, m, dur, v, d) { const g = out(d, 0.35), f = filt("lowpass", 3000, 1, g), e = pluck(g.gain, t, 0.005, v, Math.max(0.15, dur)); f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(800, t + 0.25); [-12, 0, 12].forEach((det) => o("sawtooth", hz(m), t, e, f, det)); },
        nylon(t, m, dur, v, d) { const g = out(d, 0.35), f = filt("lowpass", 3000, 0.7, g), e = pluck(g.gain, t, 0.003, v, Math.min(1.4, 0.5 + dur)); f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(800, t + 0.35); o("triangle", hz(m), t, e, f); o("sawtooth", hz(m), t, e, f, 3); },
        skank(t, m, dur, v, d) { const g = out(d, 0.25), f = filt("highpass", 500, 0.7, filt("lowpass", 3500, 0.7, g)), e = pluck(g.gain, t, 0.002, v, 0.14); o("sawtooth", hz(m), t, e, f); o("square", hz(m), t, e, f, 5); },
        scratch(t, m, dur, v, d) { const g = out(d, 0.1), f = filt("bandpass", 1800, 1.5, g); pluck(g.gain, t, 0.002, v, 0.035); nz(t, 0.05, f); },
        surf(t, m, dur, v, d) { const n = Math.max(2, Math.round(dur / 0.07)); for (let i = 0; i < n; i++) { const g = out(d, 0.45), f = filt("lowpass", 2800, 1, g), tt = t + i * (dur / n), e = pluck(g.gain, tt, 0.003, v * (i ? 0.75 : 1), 0.12); o("sawtooth", hz(m), tt, e, f); } },
        harpsi(t, m, dur, v, d) { const g = out(d, 0.4), f = filt("highpass", 200, 0.5, filt("lowpass", 5000, 0.5, g)), e = pluck(g.gain, t, 0.002, v, 0.9); o("sawtooth", hz(m), t, e, f); o("square", hz(m) * 2, t, e, f, 4); },
        banjo(t, m, dur, v, d) { const g = out(d, 0.25), f = filt("highpass", 250, 0.5, filt("lowpass", 4200, 1, g)), e = pluck(g.gain, t, 0.002, v, 0.3); o("square", hz(m), t, e, f); o("sawtooth", hz(m), t, e, f, 6); },
        harp(t, m, dur, v, d) { const g = out(d, 0.6), f = filt("lowpass", 3000, 0.5, g), e = pluck(g.gain, t, 0.004, v, 1.8); o("triangle", hz(m), t, e, f); o("sine", hz(m) * 2, t, e, f); },
        marimba(t, m, dur, v, d) { const g = out(d, 0.35), e = pluck(g.gain, t, 0.003, v, 0.5); o("sine", hz(m), t, e, g); const h = out(d, 0); pluck(h.gain, t, 0.002, v * 0.35, 0.1); o("sine", hz(m) * 4, t, t + 0.15, h); },
        vibes(t, m, dur, v, d) {
            const g = out(d, 0.5), e = pluck(g.gain, t, 0.004, v, 1.6), tr = ctx.createGain(); tr.connect(g);
            const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5; lg.gain.value = 0.3; l.connect(lg); lg.connect(tr.gain); tr.gain.value = 0.7; l.start(t); l.stop(e);
            o("sine", hz(m), t, e, tr); const h = ctx.createGain(); h.gain.value = 0.15; h.connect(tr); o("sine", hz(m) * 4, t, e, h);
        },
        steel(t, m, dur, v, d) { [[1, 1], [2, 0.4], [3, 0.12], [4.2, 0.05]].forEach(([r, a]) => { const g = out(d, 0.35), e = pluck(g.gain, t, 0.006, v * a, 0.9 / Math.sqrt(r)); const x = o("sine", hz(m) * r, t, e, g); x.frequency.setValueAtTime(hz(m) * r * 1.012, t); x.frequency.exponentialRampToValueAtTime(hz(m) * r, t + 0.05); }); },
        bell(t, m, dur, v, d) { [[1, 1], [2, 0.45], [2.76, 0.32], [5.4, 0.14]].forEach(([r, a], i) => { const g = out(d, 0.6); pluck(g.gain, t, 0.004, v * a, 2 / (1 + i * 0.7)); o("sine", hz(m) * r, t, t + 2.2, g); }); },
        musicbox(t, m, dur, v, d) { [[1, 1], [3, 0.18], [5.4, 0.06]].forEach(([r, a]) => { const g = out(d, 0.55); pluck(g.gain, t, 0.002, v * a, 1.2 / r); o("sine", hz(m) * r, t, t + 1.3, g); }); },
        flute(t, m, dur, v, d) {
            const g = out(d, 0.45), e = hold(g.gain, t, 0.06, v, 0.85, dur, 0.12); const x = o("sine", hz(m), t, e, g); vib(x, t, e, 5, 12, 0.25);
            const h = ctx.createGain(); h.gain.value = 0.18; h.connect(g); o("triangle", hz(m) * 2, t, e, h);
            const b = out(d, 0.2), bf = filt("bandpass", hz(m) * 2, 3, b); hold(b.gain, t, 0.03, v * 0.5, 0.3, dur * 0.5, 0.05); nz(t, dur, bf);
        },
        whistle(t, m, dur, v, d) { const g = out(d, 0.4), e = hold(g.gain, t, 0.02, v, 0.9, dur, 0.06); const x = o("sine", hz(m), t, e, g); vib(x, t, e, 6, 15, 0.15); const h = ctx.createGain(); h.gain.value = 0.1; h.connect(g); o("sine", hz(m) * 2, t, e, h); },
        piccolo(t, m, dur, v, d) { I.whistle(t, m, dur, v, d); },
        sax(t, m, dur, v, d) { const g = out(d, 0.35), f = filt("lowpass", 2200, 0.7, filt("bandpass", 1100, 0.6, g)), e = hold(g.gain, t, 0.04, v * 1.6, 0.8, dur, 0.1); const x = o("sawtooth", hz(m), t, e, f); vib(x, t, e, 5, 14, 0.25); },
        mute(t, m, dur, v, d) { const g = out(d, 0.4), f = filt("bandpass", 1400, 2, g), e = hold(g.gain, t, 0.02, v * 1.8, 0.8, dur, 0.1); const x = o("square", hz(m), t, e, f); vib(x, t, e, 5.5, 10, 0.3); },
        melodica(t, m, dur, v, d) { const g = out(d, 0.35), f = filt("lowpass", 2400, 0.6, g), e = hold(g.gain, t, 0.02, v, 0.85, dur, 0.08); o("square", hz(m), t, e, f); o("sawtooth", hz(m), t, e, f, 7); },
        theremin(t, m, dur, v, d, gl2) { const g = out(d, 0.6), e = hold(g.gain, t, 0.15, v, 0.9, dur, 0.3); const x = o("sine", hz(m), t, e, g); slide("theremin", x, hz(m), t, gl2); vib(x, t, e, 6, 28, 0.2); },
        synth(t, m, dur, v, d, gl2) { const g = out(d, 0.45), f = filt("lowpass", 2400, 1, g), e = hold(g.gain, t, 0.01, v, 0.7, dur, 0.15); const x = o("sawtooth", hz(m), t, e, f, -8), y = o("square", hz(m), t, e, f, 8); slide("synth", x, hz(m), t, gl2); y.frequency.setValueAtTime(hz(m), t); },
        lead(t, m, dur, v, d, gl2) { const g = out(d, 0.4), f = filt("lowpass", 3200, 2, g), e = hold(g.gain, t, 0.01, v, 0.8, dur, 0.12); const x = o("sawtooth", hz(m), t, e, f, -10); o("sawtooth", hz(m), t, e, f, 10); slide("lead", x, hz(m), t, gl2); vib(x, t, e, 5.5, 10, 0.25); },
        pluck(t, m, dur, v, d) { const g = out(d, 0.45), f = filt("lowpass", 3200, 3, g), e = pluck(g.gain, t, 0.003, v, Math.max(0.12, dur)); f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(600, t + Math.max(0.12, dur)); o("square", hz(m), t, e, f); o("sawtooth", hz(m), t, e, f, 8); },
        chip(t, m, dur, v, d) { const g = out(d, 0.1); g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v * 0.7, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o("square", hz(m), t, t + dur + 0.02, g); },
        chiptri(t, m, dur, v, d) { const g = out(d, 0); g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, t + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o("triangle", hz(m), t, t + dur + 0.02, g); },
        drive(t, m, dur, v, d) {
            const g = out(d, 0.2), f = filt("lowpass", 2600, 0.8, g), ws = ctx.createWaveShaper(); ws.curve = shaper; ws.connect(f);
            const pre = ctx.createGain(); pre.gain.value = 0.6; pre.connect(ws); const e = pluck(g.gain, t, 0.004, v, Math.max(0.15, dur)); o("sawtooth", hz(m), t, e, pre, -6); o("sawtooth", hz(m), t, e, pre, 6);
        },
        // bass instruments
        bass(t, m, dur, v, d) { const g = out(d, 0), f = filt("lowpass", 420, 0.7, g), e = pluck(g.gain, t, 0.01, v, dur); o("triangle", hz(m), t, e + 0.05, f); o("sine", hz(m), t, e + 0.05, f); },
        upright(t, m, dur, v, d) { const g = out(d, 0.1), f = filt("lowpass", 700, 0.7, g), e = pluck(g.gain, t, 0.008, v, Math.max(0.25, dur)); o("sine", hz(m), t, e, f); o("triangle", hz(m), t, e, f); const h = out(d, 0); pluck(h.gain, t, 0.004, v * 0.4, 0.09); o("sine", hz(m) * 2, t, t + 0.12, h); },
        slap(t, m, dur, v, d) { const g = out(d, 0), f = filt("lowpass", 2400, 2, g), e = pluck(g.gain, t, 0.003, v, Math.max(0.12, dur * 0.8)); f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(450, t + 0.12); o("sawtooth", hz(m), t, e, f); o("sine", hz(m), t, e, g); },
        synthbass(t, m, dur, v, d) { const g = out(d, 0), f = filt("lowpass", 1600, 3, g), e = pluck(g.gain, t, 0.004, v, Math.max(0.12, dur)); f.frequency.setValueAtTime(1600, t); f.frequency.exponentialRampToValueAtTime(280, t + 0.2); o("sawtooth", hz(m), t, e, f); o("square", hz(m), t, e, f, 7); },
        sub(t, m, dur, v, d) { const g = out(d, 0), e = pluck(g.gain, t, 0.006, v * 1.2, Math.max(0.4, dur)); const x = o("sine", hz(m), t, e, g); x.frequency.setValueAtTime(hz(m) * 1.6, t); x.frequency.exponentialRampToValueAtTime(hz(m), t + 0.05); },
    };
    /* drums: (t, vol, dest) */
    const hit = (t, v, d, type, f, len, q, rev) => { const g = out(d, rev || 0), fl = filt(type, f, q || 0.8, g); pluck(g.gain, t, 0.002, v, len); nz(t, len, fl); };
    const tone = (t, v, d, f0, f1, len, type, rev) => { const g = out(d, rev || 0); pluck(g.gain, t, 0.002, v, len); const x = o(type || "sine", f0, t, t + len + 0.05, g); x.frequency.exponentialRampToValueAtTime(f1, t + len * 0.7); };
    const D = {
        kick: (t, v, d) => tone(t, v * 0.4, d, 130, 42, 0.32),
        snare: (t, v, d) => { hit(t, v * 0.11, d, "bandpass", 1900, 0.13, 0.7, 0.15); tone(t, v * 0.08, d, 200, 160, 0.08, "triangle"); },
        clap: (t, v, d) => { [0, 0.012, 0.024].forEach((dt) => hit(t + dt, v * 0.07, d, "bandpass", 1300, 0.03, 1.2, 0.2)); hit(t + 0.03, v * 0.06, d, "bandpass", 1200, 0.16, 1, 0.25); },
        hat: (t, v, d) => hit(t, v * 0.045, d, "highpass", 7500, 0.035),
        ohat: (t, v, d) => hit(t, v * 0.04, d, "highpass", 7000, 0.22),
        ride: (t, v, d) => { hit(t, v * 0.035, d, "highpass", 5200, 0.38, 0.6, 0.15); tone(t, v * 0.012, d, 3100, 3050, 0.25); },
        crash: (t, v, d) => hit(t, v * 0.05, d, "highpass", 4500, 1.6, 0.5, 0.3),
        cymbal: (t, v, d) => hit(t, v * 0.04, d, "highpass", 5000, 0.9, 0.5, 0.25),
        brush: (t, v, d) => { const g = out(d, 0.1), f = filt("bandpass", 3000, 0.6, g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.035, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); nz(t, 0.25, f); },
        rim: (t, v, d) => { tone(t, v * 0.1, d, 1700, 1600, 0.05, "triangle"); hit(t, v * 0.03, d, "bandpass", 3000, 0.02, 2); },
        snap: (t, v, d) => hit(t, v * 0.09, d, "bandpass", 2400, 0.04, 2, 0.35),
        shaker: (t, v, d) => hit(t, v * 0.035, d, "highpass", 6500, 0.05),
        clave: (t, v, d) => tone(t, v * 0.12, d, 2500, 2450, 0.06, "sine"),
        conga: (t, v, d) => tone(t, v * 0.16, d, 330, 300, 0.22),
        bongo: (t, v, d) => tone(t, v * 0.14, d, 520, 480, 0.12),
        cowbell: (t, v, d) => { const g = out(d, 0.1), f = filt("bandpass", 800, 2, g); pluck(g.gain, t, 0.002, v * 0.06, 0.16); o("square", 545, t, t + 0.2, f); o("square", 815, t, t + 0.2, f); },
        tom: (t, v, d) => tone(t, v * 0.22, d, 140, 85, 0.3),
        taiko: (t, v, d) => { tone(t, v * 0.45, d, 90, 48, 0.55, "sine", 0.2); hit(t, v * 0.05, d, "lowpass", 600, 0.15); },
        timp: (t, v, d) => tone(t, v * 0.2, d, 98, 92, 0.9, "sine", 0.3),
        bodhran: (t, v, d) => { tone(t, v * 0.25, d, 110, 70, 0.25); hit(t, v * 0.03, d, "lowpass", 900, 0.05); },
        tick: (t, v, d) => tone(t, v * 0.08, d, 1900, 1850, 0.05, "triangle", 0.3),
        tock: (t, v, d) => tone(t, v * 0.08, d, 1250, 1200, 0.06, "triangle", 0.3),
        chipkick: (t, v, d) => tone(t, v * 0.25, d, 180, 50, 0.15, "square"),
        chipsnare: (t, v, d) => hit(t, v * 0.08, d, "highpass", 1500, 0.1, 0.5),
        chiphat: (t, v, d) => hit(t, v * 0.03, d, "highpass", 9000, 0.03),
    };
    return { I, D, hz, out, o, filt, pluck, hold, nz };
}

/* ---------- beds: a quiet, steady sound under the music ---------- */
function startBed(ctx, K, kind, dest) {
    const nodes = [], g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.connect(dest);
    const loop = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = K.noise; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7; s.connect(fl); fl.connect(g); s.start(); nodes.push(s); return fl; };
    let level = 0;
    if (kind === "rain") { loop("lowpass", 2400); loop("highpass", 5000, 0.5); level = 0.05; }
    else if (kind === "vinyl") { loop("highpass", 4000); level = 0.008; }
    else if (kind === "wind") { const f = loop("bandpass", 500, 1.2); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.08; lg.gain.value = 300; l.connect(lg); lg.connect(f.frequency); l.start(); nodes.push(l); level = 0.05; }
    else if (kind === "space") { loop("lowpass", 160); level = 0.08; }
    else if (kind === "birds") { loop("bandpass", 1400, 0.4); level = 0.012; }   // a far-off stream; the birds are events
    g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), ctx.currentTime + 3);
    return { stop() { const t = ctx.currentTime; try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0002, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1); } catch (e) { /* gone */ } setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) { /* gone */ } }), 1300); } };
}

/* ---------- the engine ----------
   createGenre(ctx, id, out, send, noise) -> { fill(until), stop() }. fill() schedules notes up to a time;
   the caller runs it every ~120 ms with until = now + 1.2 s (or once, far ahead, to render offline). */
export function createGenre(ctx, id, dest, send, noiseBuf, seed) {
    const st = GENRES[id]; if (!st) return null;
    let rs = (seed >>> 0) || Math.floor(Math.random() * 1e9);
    const rnd = () => { rs = (rs + 0x6D2B79F5) >>> 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const K = kit(ctx, noiseBuf, send); K.noise = noiseBuf;
    const sub = st.sub || 4, beats = st.beats || 4, sb = sub * beats, dur = 60 / st.bpm / sub, swing = sub === 4 ? (st.swing || 0) : 0;
    const bed = st.bed ? startBed(ctx, K, st.bed, dest) : null;
    let next = ctx.currentTime + 0.12, step = 0, key = pick(st.keys), pi = Math.floor(rnd() * st.prog.length), pbar = 0;
    let motif = null, lastBass = 0, arpI = 0;
    const vel = (c) => (c === "x" ? 1 : c === "o" ? 0.6 : c === "." ? 0.3 : c && c !== "-" && c !== " " ? 1 : 0);
    const at = (pat, g) => pat[g % pat.length];
    // the chord at a bar of the current progression
    const chordAt = (b) => {
        const P = st.prog[pi % st.prog.length], lens = P.map((c) => c[2] || st.bars || 1), total = lens.reduce((a, x) => a + x, 0);
        let r = ((b % total) + total) % total, i = 0; while (r >= lens[i]) { r -= lens[i]; i++; }
        return { deg: P[i][0], q: P[i][1], first: r === 0, last: r === lens[i] - 1, len: lens[i], total };
    };
    const inRange = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };
    const scaleNote = (sc, d, base) => base + sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length);
    const nearChord = (m, root, q) => { const pcs = (Q[q] || Q.M).map((iv) => (root + iv) % 12); for (let k = 0; k <= 2; k++) { if (pcs.includes(((m - k) % 12 + 12) % 12)) return m - k; if (pcs.includes(((m + k) % 12 + 12) % 12)) return m + k; } return m; };
    const birds = (t) => { const n = 2 + Math.floor(rnd() * 3), f0 = 2600 + rnd() * 1400; for (let i = 0; i < n; i++) { const tt = t + i * 0.09, g = K.out(dest, 0.4); K.pluck(g.gain, tt, 0.005, 0.012, 0.07); const x = K.o("sine", f0, tt, tt + 0.1, g); x.frequency.exponentialRampToValueAtTime(f0 * (1.3 + rnd() * 0.3), tt + 0.06); } };
    const drip = (t) => { const g = K.out(dest, 0.5), f = 1800 + rnd() * 1800; K.pluck(g.gain, t, 0.002, 0.01, 0.06); const x = K.o("sine", f, t, t + 0.08, g); x.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.04); };
    const crackle = (t) => { const g = K.out(dest, 0), fl = K.filt("highpass", 2000, 0.7, g); K.pluck(g.gain, t, 0.001, 0.02 + rnd() * 0.03, 0.004); K.nz(t, 0.01, fl); };
    const ghost = (t) => { const g = K.out(dest, 0.8), e = K.hold(g.gain, t, 0.4, 0.02, 1, 1.6, 0.8), f = K.hz(key + 12 + pick([0, 3, 7])); const x = K.o("sine", f, t, e, g); x.frequency.exponentialRampToValueAtTime(f * (rnd() < 0.5 ? 2 : 0.5), t + 2); };

    function newMotif(m) {
        const len = sb * 2, grid = m.grid || "x-", notes = []; let d = Math.floor(rnd() * 3);
        for (let s = 0; s < len; s++) {
            if (at(grid, s) !== "x") continue;
            const strong = s % sub === 0;
            if (s === 0 || rnd() < m.density * (strong ? 1.15 : 0.85)) { d = Math.max(-2, Math.min(9, d + pick([-2, -1, -1, 0, 1, 1, 2, 3]))); notes.push({ s, d }); }
        }
        notes.forEach((n, i) => { n.n = (i + 1 < notes.length ? notes[i + 1].s : len) - n.s; });
        return { notes, len, age: 0 };
    }

    function play(g, t) {
        const s = g % sb, bar = Math.floor(g / sb), c = chordAt(pbar), root = key + c.deg;
        const nextC = chordAt(pbar + 1), nextRoot = key + nextC.deg;
        const chordStart = c.first && s === 0, chordLenSec = c.len * sb * dur;
        // chords
        (st.comp || []).forEach((cp) => {
            let v = 0;
            if (cp.pat === "change") v = chordStart ? 1 : 0; else v = vel(at(cp.pat, g));
            if (!v || (cp.chance && rnd() > cp.chance)) return;
            let notes = voice(root, c.q, cp.lo || 55, cp.hi || 74).map((m) => m + (cp.oct || 0)); if (cp.top) notes = notes.slice(-cp.top);
            let len;
            if (cp.pat === "change") len = chordLenSec;
            else if (cp.len) len = cp.len * dur;
            else { let k = 1; while (k < sb && !vel(at(cp.pat, g + k))) k++; len = k * dur * 0.9; }
            notes.forEach((m, i) => K.I[cp.ins](t + i * (cp.roll || 0), m, len, cp.vol * v, dest));
        });
        // bass
        const B = st.bass;
        if (B) {
            let m = null, len = 0;
            if (B.walk) {
                if (s % sub === 0) {
                    const beat = s / sub, lastBeat = c.last && beat === beats - 1;
                    if (beat === 0 && c.first) m = root;
                    else if (lastBeat) m = nextRoot + (rnd() < 0.5 ? -1 : 1);
                    else m = root + pick([(Q[c.q] || Q.M)[1], 7, (Q[c.q] || Q.M)[(Q[c.q] || Q.M).length > 3 ? 3 : 2], 2, 5, 9]);
                    len = sub * dur * 0.95;
                }
            } else {
                const ch = at(B.pat, g);
                if (ch && ch !== "-" && ch !== " ") {
                    const tones = Q[c.q] || Q.M;
                    m = ch === "R" ? root : ch === "5" ? root + 7 : ch === "8" ? root + 12 : ch === "3" ? root + tones[1] : ch === "7" ? root + (tones[3] != null && tones[3] < 12 ? tones[3] : 10)
                        : ch === "6" ? root + 9 : ch === "4" ? root + 5 : ch === "A" ? nextRoot - 1 : root;
                    let k = 1; while (k < sb * 2 && (at(B.pat, g + k) === "-" || at(B.pat, g + k) === " ")) k++; len = Math.min(k, sb) * dur * (B.gate || 0.92);
                }
            }
            if (m != null) {
                let x = inRange(m, B.lo || 36, B.hi || 50);
                if (B.walk && lastBass && Math.abs(x - lastBass) > 7) x += x > lastBass ? -12 : 12;
                x = inRange(x, 33, 52); lastBass = x;
                K.I[B.ins](t, x, len, B.vol, dest);
            }
        }
        // arpeggio
        const A = st.arp;
        if (A && s % A.every === 0 && (!A.chance || rnd() < A.chance)) {
            const v = voice(root, c.q, A.lo || 55, A.hi || 72).map((m) => m + (A.oct || 0)), n = v.length, i = arpI++;
            let m;
            if (A.seq === "up") m = v[i % n];
            else if (A.seq === "updown") { const cyc = v.concat(v.slice(1, -1).reverse()); m = cyc[i % cyc.length]; }
            else if (A.seq === "alberti") m = v[[0, n - 1, Math.min(1, n - 1), n - 1][i % 4]];
            else if (A.seq === "roll") m = [v[0], v[1 % n], v[n - 1] + 12, v[0], v[1 % n], v[n - 1] + 12, v[0], v[n - 1] + 12][i % 8];
            else if (A.seq === "montuno") { const p = [0, 2, 1, 2, 0, 2, 1, 0]; m = v[p[i % 8] % n] + (i % 4 === 3 ? 12 : 0); }
            else if (A.seq === "ostinato") m = [v[0], v[0], v[0] + 12, v[0], v[1 % n], v[0], v[0] + 12, v[0]][i % 8];
            else m = pick(v);
            K.I[A.ins](t, m, A.len * A.every * dur, A.vol, dest);
        }
        // melody: a two-bar tune, played twice, then changed
        const M = st.mel;
        if (M) {
            const phraseBars = 4;
            if (s === 0 && bar % phraseBars === 0) { if (!motif || motif.age >= (M.phrase || 2)) motif = newMotif(M); else motif.age++; }
            if (motif) {
                const ps = (bar % 2) * sb + s, second = (bar % phraseBars) >= 2, n = motif.notes.find((x) => x.s === ps);
                if (n) {
                    let d = n.d;
                    if (second && ps >= sb) { const later = motif.notes.filter((x) => x.s >= sb), idx = later.indexOf(n); if (idx === later.length - 1) d = 0; else if (idx >= later.length - 3) d = n.d + pick([-1, 1, 2]); }
                    let m = scaleNote(M.scale, d, key + (M.oct || 0));
                    if (s % sub === 0) m = nearChord(m, root, c.q);
                    m = inRange(m, 55 + (M.oct > 12 ? 12 : 0), 86);
                    K.I[M.ins](t, m, Math.max(1, Math.min(n.n, sub * 2)) * dur * (M.len || 1), M.vol, dest, !!M.glide);
                }
            }
        }
        // drums
        if (st.drums) Object.keys(st.drums).forEach((k) => {
            const v = vel(at(st.drums[k], g)); if (!v || !K.D[k]) return;
            K.D[k](t, v * (0.9 + rnd() * 0.2), dest);
            if (st.bigSnare && k === "snare") K.D.clap(t, v * 0.6, dest);
        });
        // little extras
        if (st.bed === "rain" && rnd() < 0.05) drip(t + rnd() * dur);
        if (st.bed === "vinyl" && rnd() < 0.12) crackle(t + rnd() * dur);
        if (st.bed === "birds" && s === 0 && rnd() < 0.3) birds(t + rnd() * sb * dur * 0.5);
        if (st.ghosts && s === 0 && bar % 8 === 6 && rnd() < 0.6) ghost(t);
    }

    return {
        fill(until) {
            while (next < until) {
                const s = step % sb, t = next + (s % 2 === 1 ? dur * swing : 0);
                play(step, t);
                next += dur; step++;
                if (step % sb === 0) {
                    pbar++;
                    const c0 = chordAt(0);
                    if (pbar % (c0.total * 2) === 0) {   // after two passes, a new progression and sometimes a new key
                        pbar = 0; pi = (pi + 1 + Math.floor(rnd() * Math.max(1, st.prog.length - 1))) % st.prog.length;
                        if (rnd() < 0.5) key = pick(st.keys);
                    }
                }
            }
        },
        stop() { if (bed) bed.stop(); },
        get key() { return key; },
    };
}
