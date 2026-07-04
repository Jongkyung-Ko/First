(function () {
  "use strict";

  const STORAGE_KEY = "digital-world-harm-saves-v1";

  const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

  const QUALITIES = [
    { id: "maj", label: "Major" },
    { id: "min", label: "Minor" },
    { id: "dim", label: "Dim" },
    { id: "aug", label: "Aug" },
    { id: "sus2", label: "Sus2" },
    { id: "sus4", label: "Sus4" },
    { id: "maj7", label: "Maj7" },
    { id: "min7", label: "Min7" },
    { id: "dom7", label: "7" },
    { id: "m7b5", label: "m7♭5" },
    { id: "sus4dom7", label: "7sus4" }
  ];

  const TIME_SIGS = [
    { id: "4/4", num: 4, den: 4, label: "4/4" },
    { id: "3/4", num: 3, den: 4, label: "3/4" },
    { id: "6/8", num: 6, den: 8, label: "6/8" },
    { id: "12/8", num: 12, den: 8, label: "12/8" }
  ];

  const INSTRUMENTS = [
    { id: "violin", label: "바이올린", octave: 5, wave: "sine", cutoff: 4200, detune: 4 },
    { id: "viola", label: "비올라", octave: 4, wave: "triangle", cutoff: 3200, detune: 5 },
    { id: "cello", label: "첼로", octave: 3, wave: "triangle", cutoff: 2400, detune: 6 },
    { id: "contrabass", label: "콘트라베이스", octave: 2, wave: "sine", cutoff: 1600, detune: 3 },
    { id: "harp", label: "하프", octave: 4, wave: "sine", cutoff: 5000, detune: 2, pluck: true },
    { id: "ensemble", label: "스트링 앙상블", octave: 4, wave: "triangle", cutoff: 3000, detune: 8, layers: 2 }
  ];

  const PLAY_STYLES = [
    { id: "ballad", label: "발라드 아르페지오" },
    { id: "block", label: "블록 패드" },
    { id: "guitar", label: "기타 스트럼" },
    { id: "strings", label: "스트링 롱톤" }
  ];

  const DRUM_GENRES = [
    { id: "ballad", label: "발라드" },
    { id: "pop", label: "팝" },
    { id: "rock", label: "록" },
    { id: "jazz", label: "재즈" },
    { id: "waltz", label: "왈츠" },
    { id: "latin", label: "라틴" },
    { id: "rnb", label: "R&B" },
    { id: "acoustic", label: "어쿠스틱" },
    { id: "electronic", label: "일렉트로닉" },
    { id: "bossa", label: "보사노바" }
  ];

  /** @type {{ beat: number, type: string, vel?: number }[]} */
  const DRUM_PATTERNS = {
    ballad: [
      { beat: 0, type: "kick", vel: 0.55 },
      { beat: 0.5, type: "snare", vel: 0.35 },
      { beat: 0, type: "hihat", vel: 0.12 },
      { beat: 0.25, type: "hihat", vel: 0.1 },
      { beat: 0.5, type: "hihat", vel: 0.12 },
      { beat: 0.75, type: "hihat", vel: 0.1 }
    ],
    pop: [
      { beat: 0, type: "kick", vel: 0.7 },
      { beat: 0.5, type: "kick", vel: 0.55 },
      { beat: 0.25, type: "snare", vel: 0.5 },
      { beat: 0.75, type: "snare", vel: 0.5 },
      { beat: 0, type: "hihat", vel: 0.14 },
      { beat: 0.125, type: "hihat", vel: 0.11 },
      { beat: 0.25, type: "hihat", vel: 0.14 },
      { beat: 0.375, type: "hihat", vel: 0.11 },
      { beat: 0.5, type: "hihat", vel: 0.14 },
      { beat: 0.625, type: "hihat", vel: 0.11 },
      { beat: 0.75, type: "hihat", vel: 0.14 },
      { beat: 0.875, type: "hihat", vel: 0.11 }
    ],
    rock: [
      { beat: 0, type: "kick", vel: 0.85 },
      { beat: 0.375, type: "kick", vel: 0.6 },
      { beat: 0.25, type: "snare", vel: 0.7 },
      { beat: 0.75, type: "snare", vel: 0.75 },
      { beat: 0, type: "hihat", vel: 0.18 },
      { beat: 0.25, type: "hihat", vel: 0.16 },
      { beat: 0.5, type: "hihat", vel: 0.18 },
      { beat: 0.75, type: "hihat", vel: 0.16 },
      { beat: 0.125, type: "crash", vel: 0.08 }
    ],
    jazz: [
      { beat: 0, type: "ride", vel: 0.2 },
      { beat: 0.33, type: "ride", vel: 0.16 },
      { beat: 0.66, type: "ride", vel: 0.18 },
      { beat: 0.25, type: "snare", vel: 0.22 },
      { beat: 0.75, type: "snare", vel: 0.2 },
      { beat: 0, type: "kick", vel: 0.35 }
    ],
    waltz: [
      { beat: 0, type: "kick", vel: 0.6 },
      { beat: 0.333, type: "snare", vel: 0.3 },
      { beat: 0.666, type: "snare", vel: 0.28 },
      { beat: 0, type: "hihat", vel: 0.1 },
      { beat: 0.333, type: "hihat", vel: 0.1 },
      { beat: 0.666, type: "hihat", vel: 0.1 }
    ],
    latin: [
      { beat: 0, type: "kick", vel: 0.5 },
      { beat: 0.375, type: "kick", vel: 0.45 },
      { beat: 0.625, type: "kick", vel: 0.4 },
      { beat: 0.25, type: "snare", vel: 0.35 },
      { beat: 0.75, type: "snare", vel: 0.38 },
      { beat: 0, type: "hihat", vel: 0.13 },
      { beat: 0.125, type: "hihat", vel: 0.1 },
      { beat: 0.375, type: "hihat", vel: 0.12 },
      { beat: 0.5, type: "hihat", vel: 0.13 },
      { beat: 0.875, type: "hihat", vel: 0.11 }
    ],
    rnb: [
      { beat: 0, type: "kick", vel: 0.65 },
      { beat: 0.5, type: "kick", vel: 0.45 },
      { beat: 0.375, type: "snare", vel: 0.42 },
      { beat: 0.875, type: "snare", vel: 0.38 },
      { beat: 0, type: "hihat", vel: 0.11 },
      { beat: 0.25, type: "hihat", vel: 0.09 },
      { beat: 0.5, type: "hihat", vel: 0.11 },
      { beat: 0.75, type: "hihat", vel: 0.09 }
    ],
    acoustic: [
      { beat: 0, type: "kick", vel: 0.5 },
      { beat: 0.5, type: "snare", vel: 0.32 },
      { beat: 0, type: "hihat", vel: 0.08 },
      { beat: 0.5, type: "hihat", vel: 0.08 }
    ],
    electronic: [
      { beat: 0, type: "kick", vel: 0.8 },
      { beat: 0.25, type: "kick", vel: 0.75 },
      { beat: 0.5, type: "kick", vel: 0.8 },
      { beat: 0.75, type: "kick", vel: 0.75 },
      { beat: 0.25, type: "snare", vel: 0.45 },
      { beat: 0.75, type: "snare", vel: 0.45 },
      { beat: 0, type: "hihat", vel: 0.15 },
      { beat: 0.125, type: "hihat", vel: 0.12 },
      { beat: 0.25, type: "hihat", vel: 0.15 },
      { beat: 0.375, type: "hihat", vel: 0.12 },
      { beat: 0.5, type: "hihat", vel: 0.15 },
      { beat: 0.625, type: "hihat", vel: 0.12 },
      { beat: 0.75, type: "hihat", vel: 0.15 },
      { beat: 0.875, type: "hihat", vel: 0.12 }
    ],
    bossa: [
      { beat: 0, type: "kick", vel: 0.42 },
      { beat: 0.625, type: "kick", vel: 0.38 },
      { beat: 0.375, type: "snare", vel: 0.3 },
      { beat: 0.875, type: "snare", vel: 0.28 },
      { beat: 0, type: "hihat", vel: 0.1 },
      { beat: 0.25, type: "hihat", vel: 0.09 },
      { beat: 0.5, type: "hihat", vel: 0.1 },
      { beat: 0.75, type: "hihat", vel: 0.09 }
    ]
  };

  const CHORD_INTERVALS = {
    maj: [0, 4, 7],
    min: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
    m7b5: [0, 3, 6, 10],
    sus4dom7: [0, 5, 7, 10]
  };

  const ROOT_SEMITONE = {
    C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5,
    Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11
  };

  const DEFAULT_LOOP = [
    { root: "C", quality: "maj" },
    { root: "A", quality: "min" },
    { root: "F", quality: "maj" },
    { root: "G", quality: "maj" }
  ];

  const PRESETS = [
    {
      id: "my-love-by-my-side",
      label: "내 사랑 내 곁에",
      bpm: 68,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "A", quality: "min" },
        { root: "F", quality: "maj" },
        { root: "C", quality: "maj" },
        { root: "G", quality: "maj" }
      ]
    },
    {
      id: "around-thirty",
      label: "30살쯤에",
      bpm: 72,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "D", quality: "min" },
        { root: "G", quality: "maj" },
        { root: "C", quality: "maj" },
        { root: "A", quality: "min" }
      ]
    },
    {
      id: "rhapsody-in-rain",
      label: "비의 랩소디",
      bpm: 63,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "F", quality: "maj7" },
        { root: "G", quality: "maj" },
        { root: "E", quality: "min7" },
        { root: "A", quality: "min" }
      ]
    },
    {
      id: "how-are-you",
      label: "좋니",
      bpm: 70,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "C", quality: "maj" },
        { root: "G", quality: "maj" },
        { root: "A", quality: "min" },
        { root: "F", quality: "maj" }
      ]
    },
    {
      id: "because-i-love-you",
      label: "사랑하기 때문에",
      bpm: 66,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "A", quality: "min" },
        { root: "D", quality: "min" },
        { root: "G", quality: "maj" },
        { root: "C", quality: "maj" }
      ]
    },
    {
      id: "regret",
      label: "미련",
      bpm: 64,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "Bb", quality: "maj" },
        { root: "F", quality: "maj" },
        { root: "G", quality: "min" },
        { root: "Eb", quality: "maj" }
      ]
    },
    {
      id: "footsteps",
      label: "발걸음",
      bpm: 74,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "E", quality: "min" },
        { root: "C", quality: "maj" },
        { root: "G", quality: "maj" },
        { root: "D", quality: "maj" }
      ]
    },
    {
      id: "you-in-my-arms",
      label: "그대 내 품에",
      bpm: 67,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "G", quality: "maj" },
        { root: "E", quality: "min" },
        { root: "C", quality: "maj" },
        { root: "D", quality: "maj" }
      ]
    },
    {
      id: "love-runs-away",
      label: "사랑은 늘 도망가",
      bpm: 65,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "F", quality: "maj" },
        { root: "C", quality: "maj" },
        { root: "D", quality: "min" },
        { root: "Bb", quality: "maj" }
      ]
    },
    {
      id: "i-miss-you",
      label: "보고싶다",
      bpm: 60,
      timeSig: "4/4",
      beatUnit: 1,
      loop: [
        { root: "A", quality: "min" },
        { root: "F", quality: "maj" },
        { root: "C", quality: "maj" },
        { root: "G", quality: "maj" }
      ]
    }
  ];

  let pageRoot = null;
  let ac = null;
  let chordGain = null;
  let drumGain = null;
  let masterGain = null;
  let reverbNode = null;
  let reverbSend = null;
  let activeVoices = [];
  let playTimers = [];
  let playing = false;
  let highlightIndex = -1;

  const HARMONY_OCTAVE = 3;
  const BASS_OCTAVE = 2;
  const LEGATO_OVERLAP = 1.1;

  const state = {
    bpm: 72,
    timeSig: "4/4",
    beatUnit: 1,
    instrument: "cello",
    playStyle: "ballad",
    bassEnabled: true,
    drumsEnabled: false,
    drumGenre: "ballad",
    chords: [],
    saveName: ""
  };

  function buildDefaultChords(measures, loop, beatUnit) {
    const unit = beatUnit === 0.5 ? 0.5 : 1;
    const slots = Math.round(measures / unit);
    const chords = [];
    for (let i = 0; i < slots; i++) {
      chords.push({ ...loop[i % loop.length] });
    }
    return chords;
  }

  function initDefaultChords() {
    state.chords = buildDefaultChords(16, DEFAULT_LOOP, state.beatUnit);
  }

  initDefaultChords();

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function chordLabel(ch) {
    const q = QUALITIES.find((x) => x.id === ch.quality);
    const qText = q ? q.label.replace("Major", "").replace("Minor", "m") : ch.quality;
    if (ch.quality === "maj") return ch.root;
    if (ch.quality === "min") return `${ch.root}m`;
    return `${ch.root}${qText}`;
  }

  function getTimeSig() {
    return TIME_SIGS.find((t) => t.id === state.timeSig) || TIME_SIGS[0];
  }

  function measureSeconds() {
    const ts = getTimeSig();
    return (60 / state.bpm) * ts.num;
  }

  function slotSeconds() {
    return measureSeconds() * state.beatUnit;
  }

  function totalMeasures() {
    return state.chords.length * state.beatUnit;
  }

  function noteFrequency(root, interval, octave) {
    const semi = (ROOT_SEMITONE[root] ?? 0) + interval;
    const midi = 12 * (octave + 1) + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function chordMidiNotes(ch, octave) {
    const root = ROOT_SEMITONE[ch.root] ?? 0;
    const intervals = CHORD_INTERVALS[ch.quality] || CHORD_INTERVALS.maj;
    return intervals.map((iv) => root + iv + (octave + 1) * 12);
  }

  function voicingDistance(prev, next) {
    if (!prev || !prev.length) return 0;
    const avgPrev = prev.reduce((s, n) => s + n, 0) / prev.length;
    const avgNext = next.reduce((s, n) => s + n, 0) / next.length;
    let cost = Math.abs(avgNext - avgPrev) * 0.6;
    const len = Math.max(prev.length, next.length);
    for (let i = 0; i < len; i++) {
      const a = prev[Math.min(i, prev.length - 1)];
      const b = next[Math.min(i, next.length - 1)];
      cost += Math.abs(b - a);
    }
    return cost;
  }

  function inversionCandidates(baseNotes) {
    const sorted = [...baseNotes].sort((a, b) => a - b);
    const candidates = [];
    for (let inv = 0; inv < sorted.length; inv++) {
      const voiced = [];
      for (let i = 0; i < sorted.length; i++) {
        let note = sorted[(inv + i) % sorted.length];
        if (i > 0 && note <= voiced[i - 1]) note += 12;
        voiced.push(note);
      }
      [-12, 0, 12].forEach((shift) => {
        candidates.push(voiced.map((n) => n + shift));
      });
    }
    return candidates;
  }

  /** @returns {number[][]} */
  function computeVoicings(chords) {
    const voicings = [];
    let prev = null;
    chords.forEach((ch) => {
      const base = chordMidiNotes(ch, HARMONY_OCTAVE);
      const candidates = inversionCandidates(base);
      if (!prev) {
        voicings.push(base.slice().sort((a, b) => a - b));
        prev = voicings[voicings.length - 1];
        return;
      }
      let best = candidates[0];
      let bestCost = Infinity;
      candidates.forEach((cand) => {
        const cost = voicingDistance(prev, cand);
        if (cost < bestCost) {
          bestCost = cost;
          best = cand;
        }
      });
      voicings.push(best.slice().sort((a, b) => a - b));
      prev = voicings[voicings.length - 1];
    });
    return voicings;
  }

  function bassMidiPair(ch) {
    const root = ROOT_SEMITONE[ch.root] ?? 0;
    const intervals = CHORD_INTERVALS[ch.quality] || CHORD_INTERVALS.maj;
    const fifthIv = intervals.length >= 3 ? intervals[2] : 7;
    const base = (BASS_OCTAVE + 1) * 12;
    return { root: root + base, fifth: root + fifthIv + base };
  }

  function arpeggioStepCount() {
    const ts = getTimeSig();
    return Math.max(2, Math.round(ts.num * 2 * state.beatUnit));
  }

  function balladArpeggioIndices(voicingLen, steps) {
    const hi = Math.min(2, voicingLen - 1);
    const mid = Math.min(1, voicingLen - 1);
    const cycle = [0, hi, mid, hi];
    const pattern = [];
    for (let i = 0; i < steps; i++) pattern.push(cycle[i % cycle.length]);
    return pattern;
  }

  function ensureReverb(ctx) {
    if (reverbNode) return;
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * 1.6);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2) * 0.55;
      }
    }
    convolver.buffer = impulse;
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.28;
    convolver.connect(reverbSend);
    reverbSend.connect(masterGain);
    reverbNode = convolver;
  }

  function ensureAudio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ac.createGain();
      chordGain = ac.createGain();
      drumGain = ac.createGain();
      chordGain.gain.value = 0.38;
      drumGain.gain.value = 0.55;
      chordGain.connect(masterGain);
      drumGain.connect(masterGain);
      masterGain.connect(ac.destination);
      ensureReverb(ac);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  function stopVoices() {
    activeVoices.forEach((v) => {
      try {
        v.osc?.stop?.();
        v.osc2?.stop?.();
        v.src?.stop?.();
      } catch (_) { /* noop */ }
    });
    activeVoices = [];
  }

  function stopPlayback() {
    playTimers.forEach(clearTimeout);
    playTimers = [];
    stopVoices();
    playing = false;
    highlightIndex = -1;
    updatePlayUi();
  }

  function playNote(freq, when, duration, opts) {
    const ctx = ensureAudio();
    const inst = INSTRUMENTS.find((i) => i.id === state.instrument) || INSTRUMENTS[2];
    const voice = opts?.voice || "harm";
    const style = state.playStyle;
    const isBass = voice === "bass";
    const isPluck = inst.pluck || style === "guitar" || opts?.pluck;
    let attack = isPluck ? 0.006 : style === "strings" ? 0.28 : 0.12;
    let release = isPluck ? 0.07 : style === "strings" ? 0.45 : 0.22;
    if (isBass) {
      attack = 0.04;
      release = 0.18;
    }
    const volBase = isBass ? 0.32 : style === "block" ? 0.2 : 0.17;
    const vol = (opts?.vel ?? 1) * volBase;
    const dur = duration * (style === "strings" || style === "block" ? LEGATO_OVERLAP : 0.92);
    const sustainEnd = Math.max(attack + 0.04, dur - release);
    const layerCount = isBass ? 1 : inst.layers || 1;
    const cutoff = isBass ? 900 : inst.cutoff;
    const wave = isBass ? "sine" : inst.wave;

    for (let layer = 0; layer < layerCount; layer++) {
      const det = (layer - (layerCount - 1) / 2) * (inst.detune * (isBass ? 0.3 : 1));
      const osc = ctx.createOscillator();
      const osc2 = layerCount > 1 ? ctx.createOscillator() : null;
      const filter = ctx.createBiquadFilter();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, when);
      osc.detune.setValueAtTime(det, when);

      if (osc2) {
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(freq, when);
        osc2.detune.setValueAtTime(det + 7, when);
      }

      if (!isBass && style === "strings") {
        vibrato.frequency.value = 5.2;
        vibratoGain.gain.value = 3.5;
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);
        vibrato.start(when);
        vibrato.stop(when + dur + 0.1);
        activeVoices.push({ osc: vibrato });
      }

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(cutoff, when);
      filter.Q.setValueAtTime(isBass ? 0.5 : 0.85, when);

      dry.gain.setValueAtTime(0.001, when);
      dry.gain.linearRampToValueAtTime(vol, when + attack);
      dry.gain.setValueAtTime(vol * 0.85, when + sustainEnd);
      dry.gain.exponentialRampToValueAtTime(0.001, when + dur);

      wet.gain.value = isBass ? 0.08 : 0.18;

      osc.connect(filter);
      if (osc2) osc2.connect(filter);
      filter.connect(dry);
      filter.connect(wet);
      dry.connect(chordGain);
      if (reverbNode) wet.connect(reverbNode);

      osc.start(when);
      osc.stop(when + dur + 0.06);
      if (osc2) {
        osc2.start(when);
        osc2.stop(when + dur + 0.06);
      }
      activeVoices.push({ osc, osc2 });
    }
  }

  function scheduleBass(ch, slotStart, slotSec) {
    if (!state.bassEnabled) return;
    const bass = bassMidiPair(ch);
    const steps = arpeggioStepCount();
    const stepSec = slotSec / steps;
    const bassHits = [0, Math.floor(steps / 2)];
    bassHits.forEach((step) => {
      const midi = step === 0 ? bass.root : bass.fifth;
      const when = slotStart + step * stepSec;
      playNote(midiToFreq(midi), when, stepSec * 1.6, { voice: "bass", vel: step === 0 ? 1 : 0.75 });
    });
  }

  function scheduleHarmony(voicing, slotStart, slotSec) {
    const style = state.playStyle;
    const notes = voicing.slice().sort((a, b) => a - b);
    if (!notes.length) return;

    if (style === "block") {
      notes.forEach((midi) => {
        playNote(midiToFreq(midi), slotStart, slotSec, { vel: 0.9 / notes.length });
      });
      return;
    }

    if (style === "guitar") {
      notes.forEach((midi, i) => {
        playNote(midiToFreq(midi), slotStart + i * 0.028, slotSec * 0.55, { pluck: true, vel: 0.85 / notes.length });
      });
      return;
    }

    if (style === "strings") {
      notes.forEach((midi) => {
        playNote(midiToFreq(midi), slotStart, slotSec, { vel: 0.75 / notes.length });
      });
      return;
    }

    const steps = arpeggioStepCount();
    const stepSec = slotSec / steps;
    const pattern = balladArpeggioIndices(notes.length, steps);
    pattern.forEach((noteIdx, step) => {
      const when = slotStart + step * stepSec;
      playNote(midiToFreq(notes[noteIdx]), when, stepSec * 1.35, { vel: 0.82 });
    });
  }

  function scheduleSlot(ch, voicing, slotStart, slotSec) {
    scheduleBass(ch, slotStart, slotSec);
    scheduleHarmony(voicing, slotStart, slotSec);
  }

  function playDrum(type, when, vel) {
    const ctx = ensureAudio();
    const v = vel ?? 0.5;
    if (type === "kick") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(42, when + 0.12);
      g.gain.setValueAtTime(v * 0.9, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
      osc.connect(g);
      g.connect(drumGain);
      osc.start(when);
      osc.stop(when + 0.2);
      activeVoices.push({ osc });
    } else if (type === "snare") {
      const bufferSize = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.setValueAtTime(v * 0.55, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
      src.connect(g);
      g.connect(drumGain);
      src.start(when);
      activeVoices.push({ src });
    } else if (type === "hihat" || type === "ride" || type === "crash") {
      const dur = type === "crash" ? 0.35 : type === "ride" ? 0.14 : 0.05;
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = type === "ride" ? 5200 : 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(v * (type === "crash" ? 0.35 : 0.28), when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(drumGain);
      src.start(when);
      activeVoices.push({ src });
    }
  }

  function schedulePlayback() {
    stopPlayback();
    ensureAudio();
    playing = true;
    updatePlayUi();

    const ctx = ensureAudio();
    const start = ctx.currentTime + 0.08;
    const slotSec = slotSeconds();
    const measureSec = measureSeconds();
    const pattern = DRUM_PATTERNS[state.drumGenre] || DRUM_PATTERNS.ballad;
    let cursor = start;

    if (state.drumsEnabled) {
      const totalM = totalMeasures();
      for (let m = 0; m < totalM; m++) {
        pattern.forEach((hit) => {
          playDrum(hit.type, start + m * measureSec + hit.beat * measureSec, hit.vel);
        });
      }
    }

    const voicings = computeVoicings(state.chords);

    state.chords.forEach((ch, idx) => {
      const tMs = (cursor - start) * 1000;
      playTimers.push(
        setTimeout(() => {
          highlightIndex = idx;
          renderChordGrid();
        }, tMs)
      );
      scheduleSlot(ch, voicings[idx], cursor, slotSec);
      cursor += slotSec;
    });

    playTimers.push(
      setTimeout(() => {
        playing = false;
        highlightIndex = -1;
        updatePlayUi();
        renderChordGrid();
      }, (cursor - start) * 1000 + 50)
    );
  }

  function updatePlayUi() {
    if (!pageRoot) return;
    const playBtn = pageRoot.querySelector("[data-harm-play]");
    const stopBtn = pageRoot.querySelector("[data-harm-stop]");
    if (playBtn) playBtn.disabled = playing;
    if (stopBtn) stopBtn.disabled = !playing;
  }

  function loadSaves() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function persistSaves(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function snapshot() {
    return {
      bpm: state.bpm,
      timeSig: state.timeSig,
      beatUnit: state.beatUnit,
      instrument: state.instrument,
      playStyle: state.playStyle,
      bassEnabled: state.bassEnabled,
      drumsEnabled: state.drumsEnabled,
      drumGenre: state.drumGenre,
      chords: state.chords.map((c) => ({ root: c.root, quality: c.quality }))
    };
  }

  function applySnapshot(data) {
    state.bpm = Number(data.bpm) || 72;
    state.timeSig = data.timeSig || "4/4";
    state.beatUnit = data.beatUnit === 0.5 ? 0.5 : 1;
    state.instrument = data.instrument || "cello";
    state.playStyle = PLAY_STYLES.some((s) => s.id === data.playStyle) ? data.playStyle : "ballad";
    state.bassEnabled = data.bassEnabled !== false;
    state.drumsEnabled = !!data.drumsEnabled;
    state.drumGenre = data.drumGenre || "ballad";
    state.chords = (data.chords || []).map((c) => ({
      root: c.root || "C",
      quality: c.quality || "maj"
    }));
    if (!state.chords.length) initDefaultChords();
  }

  function applyPreset(presetId) {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    state.bpm = preset.bpm;
    state.timeSig = preset.timeSig;
    state.beatUnit = preset.beatUnit;
    state.chords = [];
    for (let i = 0; i < 16; i++) {
      state.chords.push({ ...preset.loop[i % preset.loop.length] });
    }
    stopPlayback();
    renderAll();
    showToast(`프리셋 · ${preset.label}`);
  }

  function addFourMeasures() {
    const copyCount = state.beatUnit === 0.5 ? 8 : 4;
    const start = Math.max(0, state.chords.length - copyCount);
    const slice = state.chords.slice(start, start + copyCount);
    if (!slice.length) return;
    state.chords.push(...slice.map((c) => ({ ...c })));
    renderChordGrid();
    renderSummary();
    showToast(`+${copyCount}칸 (4마디) · 이전 패턴 복사`);
  }

  function setBeatUnit(next) {
    const unit = next === 0.5 ? 0.5 : 1;
    if (unit === state.beatUnit) return;
    if (unit === 0.5) {
      const expanded = [];
      state.chords.forEach((c) => {
        expanded.push({ ...c });
        expanded.push({ ...c });
      });
      state.chords = expanded;
    } else {
      const merged = [];
      for (let i = 0; i < state.chords.length; i += 2) {
        merged.push({ ...(state.chords[i] || state.chords[0]) });
      }
      state.chords = merged.length ? merged : [{ root: "C", quality: "maj" }];
    }
    state.beatUnit = unit;
    renderAll();
  }

  function showToast(msg) {
    if (!pageRoot) return;
    let el = pageRoot.querySelector(".harm-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "harm-toast";
      pageRoot.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-visible"), 2200);
  }

  function renderSummary() {
    if (!pageRoot) return;
    const el = pageRoot.querySelector("[data-harm-summary]");
    if (!el) return;
    el.textContent = `${state.chords.length}칸 · ${totalMeasures()}마디 · ${Math.round(totalMeasures() * measureSeconds())}초`;
  }

  function renderSaveList() {
    if (!pageRoot) return;
    const listEl = pageRoot.querySelector("[data-harm-save-list]");
    if (!listEl) return;
    const saves = loadSaves();
    if (!saves.length) {
      listEl.innerHTML = `<p class="harm-save-empty">저장된 작곡이 없습니다.</p>`;
      return;
    }
    listEl.innerHTML = saves
      .map(
        (item) => `
      <div class="harm-save-item" data-save-id="${escapeHtml(item.id)}">
        <div class="harm-save-meta">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.updatedAt || "")}</span>
        </div>
        <div class="harm-save-actions">
          <button type="button" class="harm-btn harm-btn-ghost" data-harm-load="${escapeHtml(item.id)}">불러오기</button>
          <button type="button" class="harm-btn harm-btn-danger" data-harm-delete="${escapeHtml(item.id)}">삭제</button>
        </div>
      </div>`
      )
      .join("");
  }

  function renderChordGrid() {
    if (!pageRoot) return;
    const grid = pageRoot.querySelector("[data-harm-grid]");
    if (!grid) return;

    let measureAcc = 0;
    grid.innerHTML = state.chords
      .map((ch, idx) => {
        const measureLabel =
          state.beatUnit === 0.5
            ? `${Math.floor(measureAcc * 2) / 2 + 1}${measureAcc % 1 ? "½" : ""}`
            : String(Math.floor(measureAcc) + 1);
        measureAcc += state.beatUnit;
        const active = idx === highlightIndex ? " is-playing" : "";
        const rootOpts = ROOTS.map(
          (r) => `<option value="${r}"${r === ch.root ? " selected" : ""}>${r}</option>`
        ).join("");
        const qualOpts = QUALITIES.map(
          (q) =>
            `<option value="${q.id}"${q.id === ch.quality ? " selected" : ""}>${escapeHtml(q.label)}</option>`
        ).join("");
        return `
        <div class="harm-slot${active}" data-slot="${idx}">
          <span class="harm-slot-num">${measureLabel}</span>
          <select class="harm-select harm-root" data-chord-root="${idx}" aria-label="코드 ${idx + 1} 근음">${rootOpts}</select>
          <select class="harm-select harm-quality" data-chord-quality="${idx}" aria-label="코드 ${idx + 1} 타입">${qualOpts}</select>
          <span class="harm-slot-label">${escapeHtml(chordLabel(ch))}</span>
        </div>`;
      })
      .join("");
    renderSummary();
  }

  function renderAll() {
    if (!pageRoot) return;
    const bpmEl = pageRoot.querySelector("[data-harm-bpm]");
    const timeSigEl = pageRoot.querySelector("[data-harm-timesig]");
    const beatUnitEl = pageRoot.querySelector("[data-harm-beatunit]");
    const instEl = pageRoot.querySelector("[data-harm-instrument]");
    const styleEl = pageRoot.querySelector("[data-harm-play-style]");
    const bassEl = pageRoot.querySelector("[data-harm-bass-toggle]");
    const drumGenreEl = pageRoot.querySelector("[data-harm-drum-genre]");
    const drumToggleEl = pageRoot.querySelector("[data-harm-drum-toggle]");
    const saveNameEl = pageRoot.querySelector("[data-harm-save-name]");
    if (!bpmEl || !timeSigEl || !beatUnitEl || !instEl || !styleEl || !bassEl || !drumGenreEl || !drumToggleEl || !saveNameEl) return;
    bpmEl.value = String(state.bpm);
    timeSigEl.value = state.timeSig;
    beatUnitEl.value = String(state.beatUnit);
    instEl.value = state.instrument;
    styleEl.value = state.playStyle;
    bassEl.checked = state.bassEnabled;
    drumGenreEl.value = state.drumGenre;
    drumToggleEl.checked = state.drumsEnabled;
    saveNameEl.value = state.saveName;
    renderChordGrid();
    renderSaveList();
    updatePlayUi();
  }

  function bindEvents() {
    if (!pageRoot) return;

    pageRoot.addEventListener("input", (e) => {
      const t = e.target;
      if (t.matches("[data-harm-bpm]")) {
        state.bpm = Math.min(200, Math.max(40, Number(t.value) || 72));
        renderSummary();
      }
      if (t.matches("[data-harm-save-name]")) {
        state.saveName = t.value;
      }
    });

    pageRoot.addEventListener("change", (e) => {
      const t = e.target;
      if (t.matches("[data-harm-timesig]")) {
        state.timeSig = t.value;
        renderSummary();
      }
      if (t.matches("[data-harm-beatunit]")) {
        setBeatUnit(Number(t.value));
      }
      if (t.matches("[data-harm-instrument]")) {
        state.instrument = t.value;
      }
      if (t.matches("[data-harm-play-style]")) {
        state.playStyle = t.value;
      }
      if (t.matches("[data-harm-bass-toggle]")) {
        state.bassEnabled = t.checked;
      }
      if (t.matches("[data-harm-drum-genre]")) {
        state.drumGenre = t.value;
      }
      if (t.matches("[data-harm-drum-toggle]")) {
        state.drumsEnabled = t.checked;
      }
      if (t.matches("[data-harm-preset]")) {
        if (t.value) applyPreset(t.value);
        t.value = "";
      }
      if (t.matches("[data-chord-root]")) {
        const idx = Number(t.dataset.chordRoot);
        if (state.chords[idx]) {
          state.chords[idx].root = t.value;
          renderChordGrid();
        }
      }
      if (t.matches("[data-chord-quality]")) {
        const idx = Number(t.dataset.chordQuality);
        if (state.chords[idx]) {
          state.chords[idx].quality = t.value;
          renderChordGrid();
        }
      }
    });

    pageRoot.addEventListener("click", (e) => {
      const playBtn = e.target.closest("[data-harm-play]");
      if (playBtn) {
        schedulePlayback();
        return;
      }
      const stopBtn = e.target.closest("[data-harm-stop]");
      if (stopBtn) {
        stopPlayback();
        renderChordGrid();
        return;
      }
      const addBtn = e.target.closest("[data-harm-add-measures]");
      if (addBtn) {
        addFourMeasures();
        return;
      }
      const saveBtn = e.target.closest("[data-harm-save]");
      if (saveBtn) {
        const name = state.saveName.trim() || `작곡 ${new Date().toLocaleString("ko-KR")}`;
        const saves = loadSaves();
        const id = `harm-${Date.now()}`;
        const entry = {
          id,
          name,
          updatedAt: new Date().toLocaleString("ko-KR"),
          data: snapshot()
        };
        saves.unshift(entry);
        persistSaves(saves.slice(0, 40));
        state.saveName = name;
        renderSaveList();
        showToast(`저장 · ${name}`);
        return;
      }
      const loadBtn = e.target.closest("[data-harm-load]");
      if (loadBtn) {
        const id = loadBtn.dataset.harmLoad;
        const item = loadSaves().find((s) => s.id === id);
        if (item) {
          applySnapshot(item.data);
          state.saveName = item.name;
          stopPlayback();
          renderAll();
          showToast(`불러옴 · ${item.name}`);
        }
        return;
      }
      const delBtn = e.target.closest("[data-harm-delete]");
      if (delBtn) {
        const id = delBtn.dataset.harmDelete;
        persistSaves(loadSaves().filter((s) => s.id !== id));
        renderSaveList();
        showToast("삭제했습니다");
      }
    });
  }

  function renderPage(container) {
    pageRoot = container;
    const presetOpts = PRESETS.map(
      (p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`
    ).join("");
    const timeSigOpts = TIME_SIGS.map(
      (t) => `<option value="${t.id}">${t.label}</option>`
    ).join("");
    const instOpts = INSTRUMENTS.map(
      (i) => `<option value="${i.id}">${escapeHtml(i.label)}</option>`
    ).join("");
    const drumOpts = DRUM_GENRES.map(
      (d) => `<option value="${d.id}">${escapeHtml(d.label)}</option>`
    ).join("");
    const styleOpts = PLAY_STYLES.map(
      (s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`
    ).join("");

    container.innerHTML = `
      <div class="harm-panel">
        <header class="harm-header">
          <h2>Harm</h2>
          <p class="harm-intro">코드 진행에 맞춰 아르페지오·베이스·보이스 리딩 반주를 재생합니다. 연주 스타일과 악기를 바꿔 보세요.</p>
        </header>

        <section class="harm-toolbar" aria-label="재생 설정">
          <label class="harm-field">
            <span>BPM</span>
            <input type="number" min="40" max="200" step="1" data-harm-bpm value="72">
          </label>
          <label class="harm-field">
            <span>박자</span>
            <select data-harm-timesig>${timeSigOpts}</select>
          </label>
          <label class="harm-field">
            <span>코드 간격</span>
            <select data-harm-beatunit>
              <option value="1">1마디</option>
              <option value="0.5">0.5마디</option>
            </select>
          </label>
          <label class="harm-field">
            <span>연주 스타일</span>
            <select data-harm-play-style>${styleOpts}</select>
          </label>
          <label class="harm-field">
            <span>반주 악기</span>
            <select data-harm-instrument>${instOpts}</select>
          </label>
          <label class="harm-toggle">
            <input type="checkbox" data-harm-bass-toggle checked>
            <span>베이스 ON</span>
          </label>
          <div class="harm-transport">
            <button type="button" class="harm-btn harm-btn-primary" data-harm-play>▶ 재생</button>
            <button type="button" class="harm-btn" data-harm-stop disabled>■ 정지</button>
          </div>
        </section>

        <section class="harm-toolbar harm-toolbar-drums" aria-label="드럼">
          <label class="harm-field">
            <span>드럼 장르</span>
            <select data-harm-drum-genre>${drumOpts}</select>
          </label>
          <label class="harm-toggle">
            <input type="checkbox" data-harm-drum-toggle>
            <span>드럼 ON</span>
          </label>
        </section>

        <section class="harm-toolbar" aria-label="프리셋">
          <label class="harm-field harm-field-grow">
            <span>코드 프리셋 (발라드)</span>
            <select data-harm-preset>
              <option value="">— 곡 선택 —</option>
              ${presetOpts}
            </select>
          </label>
        </section>

        <div class="harm-summary" data-harm-summary></div>

        <div class="harm-grid" data-harm-grid aria-label="코드 진행"></div>

        <div class="harm-actions">
          <button type="button" class="harm-btn" data-harm-add-measures">+ 4마디 추가 (패턴 복사)</button>
        </div>

        <section class="harm-save-section" aria-label="저장 및 불러오기">
          <h3>내 작곡</h3>
          <div class="harm-save-form">
            <input type="text" class="harm-save-input" data-harm-save-name placeholder="저장 이름" maxlength="40">
            <button type="button" class="harm-btn harm-btn-primary" data-harm-save>저장</button>
          </div>
          <div class="harm-save-list" data-harm-save-list></div>
        </section>
      </div>`;

    bindEvents();
    renderAll();
  }

  function leavePage() {
    stopPlayback();
    pageRoot = null;
  }

  window.Harm = { renderPage, leavePage };
})();
