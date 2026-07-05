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
    { id: "5/4", num: 5, den: 4, label: "5/4" },
    { id: "6/8", num: 6, den: 8, label: "6/8" },
    { id: "12/8", num: 12, den: 8, label: "12/8" }
  ];

  const INSTRUMENTS = [
    { id: "piano", label: "그랜드 피아노", category: "keys", soundfont: "acoustic_grand_piano" },
    { id: "rhodes", label: "일렉트릭 피아노 (Rhodes)", category: "keys", soundfont: "electric_piano_1", octave: 4, wave: "sine", cutoff: 3800, detune: 3 },
    { id: "organ", label: "오르간", category: "keys", soundfont: "drawbar_organ", octave: 4, wave: "square", cutoff: 2800, detune: 2, layers: 2 },
    { id: "ensemble", label: "스트링 앙상블", category: "strings", soundfont: "string_ensemble_1", octave: 4, wave: "triangle", cutoff: 3000, detune: 8, layers: 2 },
    { id: "violin", label: "바이올린", category: "strings", soundfont: "violin", octave: 5, wave: "sine", cutoff: 4200, detune: 4 },
    { id: "viola", label: "비올라", category: "strings", soundfont: "viola", octave: 4, wave: "triangle", cutoff: 3200, detune: 5 },
    { id: "cello", label: "첼로", category: "strings", soundfont: "cello", octave: 3, wave: "triangle", cutoff: 2400, detune: 6 },
    { id: "contrabass", label: "콘트라베이스", category: "strings", soundfont: "acoustic_bass", octave: 2, wave: "sine", cutoff: 1600, detune: 3 },
    { id: "harp", label: "하프", category: "strings", soundfont: "harp", octave: 4, wave: "sine", cutoff: 5000, detune: 2, pluck: true },
    { id: "guitar_nylon", label: "나일론 기타", category: "guitar", soundfont: "acoustic_guitar_nylon", octave: 4, wave: "triangle", cutoff: 4000, detune: 2, pluck: true },
    { id: "guitar_jazz", label: "재즈 기타", category: "guitar", soundfont: "electric_guitar_jazz", octave: 4, wave: "triangle", cutoff: 3500, detune: 3, pluck: true },
    { id: "mandolin", label: "만돌린", category: "guitar", soundfont: "mandolin", octave: 5, wave: "triangle", cutoff: 4500, detune: 4, pluck: true },
    { id: "vibraphone", label: "비브라폰", category: "mallet", soundfont: "vibraphone", octave: 4, wave: "sine", cutoff: 5000, detune: 2 },
    { id: "marimba", label: "마림바", category: "mallet", soundfont: "marimba", octave: 4, wave: "triangle", cutoff: 4200, detune: 2, pluck: true },
    { id: "accordion", label: "아코디언", category: "folk", soundfont: "accordion", octave: 4, wave: "triangle", cutoff: 3200, detune: 5, layers: 2 },
    { id: "clavinet", label: "클라비넷", category: "folk", soundfont: "clavinet", octave: 4, wave: "square", cutoff: 3000, detune: 1, pluck: true }
  ];

  const INSTRUMENT_GROUPS = [
    { id: "keys", label: "건반" },
    { id: "strings", label: "현악" },
    { id: "guitar", label: "기타" },
    { id: "mallet", label: "타악·마림바" },
    { id: "folk", label: "민속·펑크" }
  ];

  const SOUNDFONT_MAP = Object.fromEntries(
    INSTRUMENTS.filter((i) => i.soundfont).map((i) => [i.id, i.soundfont])
  );

  const PLAY_STYLES = [
    { id: "ballad", label: "발라드 아르페지오", category: "ballad" },
    { id: "alberti", label: "알베르티", category: "ballad" },
    { id: "gospel", label: "갸스펠 롤", category: "ballad" },
    { id: "waltz", label: "왈츠 (3/4)", category: "dance" },
    { id: "block", label: "블록 패드", category: "pad" },
    { id: "strings", label: "스트링 롱톤", category: "pad" },
    { id: "comping", label: "재즈 컴핑", category: "jazz" },
    { id: "stride", label: "스트라이드", category: "jazz" },
    { id: "bossa", label: "보사노바", category: "latin" },
    { id: "guitar", label: "기타 스트럼", category: "guitar" },
    { id: "triplet", label: "12/8 셔플", category: "blues" }
  ];

  const PLAY_STYLE_GROUPS = [
    { id: "ballad", label: "발라드·피아노" },
    { id: "dance", label: "왈츠·댄스" },
    { id: "pad", label: "패드·롱톤" },
    { id: "jazz", label: "재즈" },
    { id: "latin", label: "라틴" },
    { id: "guitar", label: "기타" },
    { id: "blues", label: "블루스·셔플" }
  ];

  const ARPEGGIO_VARIANTS = [
    { id: "classic", label: "클래식 (저·고·중·고)" },
    { id: "ascend", label: "상행" },
    { id: "descend", label: "하행" },
    { id: "harp", label: "하프 (넓게)" },
    { id: "syncop", label: "싱코페이션" },
    { id: "octave", label: "옥타브 번갈아" },
    { id: "rolling", label: "롤링 순차" },
    { id: "pop8", label: "팝 8분" },
    { id: "cascade", label: "캐스케이드" }
  ];

  const ARPEGGIO_STYLES = new Set(["ballad", "alberti", "gospel", "triplet"]);

  const MAX_CHORD_SLOTS = 64;
  const MEASURES_PER_ADD = 4;

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
      { beat: 0, type: "kick", vel: 0.62 },
      { beat: 0.5, type: "snare", vel: 0.42 },
      { beat: 0.875, type: "snare", vel: 0.18 },
      { beat: 0, type: "hihat", vel: 0.14 },
      { beat: 0.125, type: "hihat", vel: 0.1 },
      { beat: 0.25, type: "hihat", vel: 0.13 },
      { beat: 0.375, type: "hihat", vel: 0.1 },
      { beat: 0.5, type: "hihat", vel: 0.14 },
      { beat: 0.625, type: "hihat", vel: 0.1 },
      { beat: 0.75, type: "hihat", vel: 0.13 },
      { beat: 0.875, type: "hihat", vel: 0.11 },
      { beat: 0.9375, type: "kick", vel: 0.28 }
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

  function getPresets() {
    return window.HarmPresets?.PRESETS || [];
  }

  function buildPresetOptionsHtml() {
    const all = getPresets();
    const ballad = all.filter((p) => p.category !== "jazz");
    const jazz = all.filter((p) => p.category === "jazz");
    const opt = (p) =>
      `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)} (${p.measures ?? p.chords?.length ?? 16}마디)</option>`;
    return `
      <optgroup label="발라드">${ballad.map(opt).join("")}</optgroup>
      <optgroup label="재즈 명곡">${jazz.map(opt).join("")}</optgroup>`;
  }

  function buildInstrumentOptionsHtml() {
    const opt = (i) => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.label)}</option>`;
    return INSTRUMENT_GROUPS.map((g) => {
      const items = INSTRUMENTS.filter((i) => i.category === g.id);
      if (!items.length) return "";
      return `<optgroup label="${escapeHtml(g.label)}">${items.map(opt).join("")}</optgroup>`;
    }).join("");
  }

  function buildPlayStyleOptionsHtml() {
    const opt = (s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.label)}</option>`;
    return PLAY_STYLE_GROUPS.map((g) => {
      const items = PLAY_STYLES.filter((s) => s.category === g.id);
      if (!items.length) return "";
      return `<optgroup label="${escapeHtml(g.label)}">${items.map(opt).join("")}</optgroup>`;
    }).join("");
  }

  let pageRoot = null;
  let ac = null;
  let chordGain = null;
  let drumGain = null;
  let masterGain = null;
  let reverbNode = null;
  let reverbSend = null;
  /** @type {Record<string, AudioBuffer|null>} */
  let drumSamples = {};
  let drumSamplesLoading = null;
  /** @type {Record<string, unknown>} */
  let sfInstruments = {};
  let sfLoading = null;
  let schedulerTimer = null;
  /** @type {object|null} */
  let playbackSession = null;
  let activeVoices = [];
  let playTimers = [];
  let playing = false;
  let highlightIndex = -1;
  /** @type {AbortController|null} */
  let eventsAbort = null;

  const HARMONY_OCTAVE = 3;
  const BASS_OCTAVE = 2;
  const LEGATO_OVERLAP = 1.1;

  const state = {
    bpm: 72,
    timeSig: "4/4",
    beatUnit: 1,
    instrument: "piano",
    playStyle: "ballad",
    bassEnabled: true,
    drumsEnabled: false,
    drumGenre: "ballad",
    chords: [],
    saveName: "",
    saveListOpen: false,
    theoryOpenId: null,
    songKey: "C",
    arpeggioVariant: "classic",
    /** @type {{ title: string, key: string, source: string } | null} */
    presetMeta: null
  };

  function parseKeySignature(keyStr) {
    if (!keyStr) return { root: "C", mode: "major" };
    const s = String(keyStr).trim();
    if (s.length > 1 && s.endsWith("m")) {
      const root = s.slice(0, -1);
      if (ROOT_SEMITONE[root] !== undefined) return { root, mode: "minor" };
    }
    if (ROOT_SEMITONE[s] !== undefined) return { root: s, mode: "major" };
    return { root: "C", mode: "major" };
  }

  /** @returns {"tonic"|"subdom"|"dominant"|"other"} */
  function chordFunction(ch, keyStr) {
    const key = parseKeySignature(keyStr);
    const keySemi = ROOT_SEMITONE[key.root] ?? 0;
    const chSemi = ROOT_SEMITONE[ch.root] ?? 0;
    const deg = ((chSemi - keySemi) % 12 + 12) % 12;
    if (key.mode === "major") {
      if ([0, 3, 9].includes(deg)) return "tonic";
      if ([2, 5].includes(deg)) return "subdom";
      if ([7, 11].includes(deg)) return "dominant";
    } else {
      if ([0, 3].includes(deg)) return "tonic";
      if ([5, 8, 10].includes(deg)) return "subdom";
      if ([7, 11].includes(deg)) return "dominant";
    }
    return "other";
  }

  function getDisplayKey() {
    return state.songKey || state.presetMeta?.key || "C";
  }

  function semitoneToRoot(semi) {
    return ROOTS[((semi % 12) + 12) % 12];
  }

  function transposeKeyLabel(keyStr, semitones) {
    const parsed = parseKeySignature(keyStr);
    const newRoot = semitoneToRoot((ROOT_SEMITONE[parsed.root] ?? 0) + semitones);
    return parsed.mode === "minor" ? `${newRoot}m` : newRoot;
  }

  function transposeChord(ch, semitones) {
    const semi = (ROOT_SEMITONE[ch.root] ?? 0) + semitones;
    return { root: semitoneToRoot(semi), quality: ch.quality };
  }

  function transposeAll(semitones) {
    if (!semitones) return;
    stopPlayback();
    state.chords = state.chords.map((ch) => transposeChord(ch, semitones));
    state.songKey = transposeKeyLabel(getDisplayKey(), semitones);
    if (state.presetMeta) state.presetMeta.key = state.songKey;
    renderAll();
    showToast(`조 이동 · ${getDisplayKey()} (${semitones > 0 ? "+" : ""}${semitones})`);
  }

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
    const base = (BASS_OCTAVE + 1) * 12;
    return {
      root: root + base,
      third: root + (intervals[1] ?? 4) + base,
      fifth: root + (intervals[2] ?? 7) + base
    };
  }

  function arpeggioStepCount() {
    const ts = getTimeSig();
    const style = state.playStyle;
    const unit = state.beatUnit;
    if (style === "waltz") return Math.max(3, Math.round(ts.num * unit));
    if (style === "alberti") return Math.max(4, Math.round(ts.num * 4 * unit));
    if (style === "gospel") return Math.max(8, Math.round(ts.num * 4 * unit));
    if (style === "triplet") return Math.max(6, Math.round(ts.num * 3 * unit));
    if (style === "ballad") return Math.max(4, Math.round(ts.num * 4 * unit));
    return Math.max(4, Math.round(ts.num * 2 * unit));
  }

  function balladArpeggioIndices(voicingLen, steps, slotIndex) {
    const variant = state.arpeggioVariant || "classic";
    const { lo, mid, hi, top } = (() => {
      const l = 0;
      const m = Math.min(1, voicingLen - 1);
      const h = Math.min(2, voicingLen - 1);
      const t = Math.min(voicingLen - 1, voicingLen > 3 ? voicingLen - 1 : h);
      return { lo: l, mid: m, hi: h, top: t };
    })();

    const cycles = {
      classic: [lo, hi, mid, hi],
      ascend: [lo, mid, hi, top].slice(0, Math.max(1, voicingLen)),
      descend: [top, hi, mid, lo].slice(0, Math.max(1, voicingLen)),
      harp: [lo, mid, hi, top, hi, mid],
      syncop: [lo, hi, lo, mid, hi, mid, lo, top],
      octave: [lo, hi, lo, hi, mid, top],
      pop8: [lo, mid, lo, hi, mid, hi, mid, top],
      cascade: [hi, mid, lo, mid, hi, lo]
    };

    if (variant === "rolling") {
      const pattern = [];
      const offset = slotIndex % voicingLen;
      for (let i = 0; i < steps; i++) pattern.push((i + offset) % voicingLen);
      return pattern;
    }

    let cycle = cycles[variant] || cycles.classic;
    if (steps >= 12 && variant === "classic") {
      cycle = [lo, mid, hi, mid, top, hi, mid, hi];
    }
    const rot = slotIndex % cycle.length;
    const rotated = cycle.slice(rot).concat(cycle.slice(0, rot));
    const pattern = [];
    for (let i = 0; i < steps; i++) pattern.push(rotated[i % rotated.length]);
    return pattern;
  }

  function albertiIndices(voicingLen, steps) {
    const lo = 0;
    const hi = Math.min(2, voicingLen - 1);
    const mid = Math.min(1, voicingLen - 1);
    const cycle = [lo, hi, mid, hi];
    const pattern = [];
    for (let i = 0; i < steps; i++) pattern.push(cycle[i % cycle.length]);
    return pattern;
  }

  function bassPatternSteps(steps, slotIndex) {
    const third = Math.min(1, 2);
    const fifth = Math.min(2, 2);
    const base = [0, fifth, 0, third, fifth, 0, third, fifth];
    const pattern = [];
    for (let i = 0; i < steps; i++) {
      const idx = base[i % base.length];
      pattern.push({ idx, vel: i % 4 === 0 ? 1 : i % 2 === 0 ? 0.78 : 0.62 });
    }
    if (slotIndex % 4 === 3) {
      pattern[pattern.length - 1] = { idx: fifth, vel: 0.95 };
    }
    return pattern;
  }

  const DRUM_SAMPLE_FILES = {
    kick: "assets/audio/harm/kick.mp3",
    snare: "assets/audio/harm/snare.mp3",
    hihat: "assets/audio/harm/hihat.mp3",
    ride: "assets/audio/harm/ride.mp3",
    crash: "assets/audio/harm/crash.mp3"
  };

  function midiToNoteName(midi) {
    const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    const oct = Math.floor(midi / 12) - 1;
    return names[((midi % 12) + 12) % 12] + oct;
  }

  function clampWhen(when) {
    const ctx = ensureAudio();
    return Math.max(when, ctx.currentTime + 0.008);
  }

  async function loadSoundfontInstrument(instId) {
    const id = instId || state.instrument;
    if (sfInstruments[id]) return sfInstruments[id];
    const sfName = SOUNDFONT_MAP[id];
    if (!sfName || !window.Soundfont) return null;
    const ctx = ensureAudio();
    try {
      const instrument = await window.Soundfont.instrument(ctx, sfName, { soundfont: "MusyngKite" });
      sfInstruments[id] = instrument;
      return instrument;
    } catch {
      return null;
    }
  }

  async function ensureSoundfontReady() {
    if (sfLoading) return sfLoading;
    sfLoading = loadSoundfontInstrument(state.instrument);
    return sfLoading;
  }

  function playNoteSoundfont(midi, when, duration, opts) {
    const inst = sfInstruments[state.instrument];
    if (!inst) return false;
    const t = clampWhen(when);
    const isBass = opts?.voice === "bass";
    const gain = (opts?.vel ?? 1) * (isBass ? 0.9 : 0.78);
    const dur = Math.max(duration, 0.08);
    try {
      inst.play(midiToNoteName(midi), t, { duration: dur, gain });
      return true;
    } catch {
      return false;
    }
  }

  const DRUM_SAMPLE_FALLBACK = {
    kick: "https://cdn.freesound.org/previews/808/808848_12825979-hq.mp3",
    snare: "https://cdn.freesound.org/previews/558/558436_9774248-hq.mp3",
    hihat: "https://cdn.freesound.org/previews/344/344449_5123851-hq.mp3",
    ride: "https://cdn.freesound.org/previews/344/344449_5123851-hq.mp3",
    crash: "https://cdn.freesound.org/previews/558/558436_9774248-hq.mp3"
  };

  async function fetchDrumBuffer(url) {
    const ctx = ensureAudio();
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch fail");
    const buf = await res.arrayBuffer();
    return ctx.decodeAudioData(buf);
  }

  async function loadDrumSamples() {
    if (drumSamplesLoading) return drumSamplesLoading;
    drumSamplesLoading = (async () => {
      const ctx = ensureAudio();
      const entries = Object.entries(DRUM_SAMPLE_FILES);
      await Promise.all(
        entries.map(async ([type, relPath]) => {
          if (drumSamples[type]) return;
          const urls = [
            window.resolveAudioAssetUrl?.(relPath) || relPath,
            DRUM_SAMPLE_FALLBACK[type]
          ].filter(Boolean);
          for (const url of urls) {
            try {
              drumSamples[type] = await fetchDrumBuffer(url);
              return;
            } catch {
              /* try next */
            }
          }
          drumSamples[type] = null;
        })
      );
    })();
    return drumSamplesLoading;
  }

  function playDrumSample(type, when, vel) {
    const ctx = ensureAudio();
    const buffer = drumSamples[type];
    if (!buffer) return false;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime((vel ?? 0.5) * 1.05, clampWhen(when));
    src.connect(g);
    g.connect(drumGain);
    src.start(clampWhen(when));
    activeVoices.push({ src });
    return true;
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
    reverbSend.gain.value = 0.38;
    convolver.connect(reverbSend);
    reverbSend.connect(masterGain);
    reverbNode = convolver;
  }

  async function ensureAudioReady() {
    const ctx = ensureAudio();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  }

  function ensureAudio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ac.createGain();
      chordGain = ac.createGain();
      drumGain = ac.createGain();
      chordGain.gain.value = 0.62;
      drumGain.gain.value = 0.78;
      masterGain.gain.value = 0.92;
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
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    playbackSession = null;
    playTimers.forEach(clearTimeout);
    playTimers = [];
    stopVoices();
    playing = false;
    highlightIndex = -1;
    updatePlayUi();
  }

  function playNoteAt(midi, when, duration, opts) {
    if (playNoteSoundfont(midi, when, duration, opts)) return;
    playNoteSynth(midiToFreq(midi), when, duration, opts);
  }

  function playNoteSynth(freq, when, duration, opts) {
    const ctx = ensureAudio();
    when = clampWhen(when);
    const inst = INSTRUMENTS.find((i) => i.id === state.instrument) || INSTRUMENTS[2];
    const voice = opts?.voice || "harm";
    const style = state.playStyle;
    const isBass = voice === "bass";
    const isPluck = inst.pluck || style === "guitar" || style === "comping" || opts?.pluck;
    let attack = isPluck ? 0.006 : style === "strings" ? 0.28 : style === "comping" ? 0.008 : 0.12;
    let release = isPluck ? 0.07 : style === "strings" ? 0.45 : style === "comping" ? 0.09 : 0.22;
    if (isBass) {
      attack = 0.04;
      release = 0.18;
    }
    const volBase = isBass ? 0.42 : style === "block" ? 0.28 : style === "comping" ? 0.32 : 0.24;
    const vol = (opts?.vel ?? 1) * volBase;
    let dur = duration * (style === "strings" || style === "block" ? LEGATO_OVERLAP : style === "comping" ? 0.55 : 0.92);
    dur = Math.max(dur, attack + release + 0.06);
    const releaseStart = Math.max(attack + 0.02, dur - release);
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
      dry.gain.setValueAtTime(vol * 0.88, when + releaseStart);
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

  function scheduleBass(ch, slotStart, slotSec, slotIndex) {
    if (!state.bassEnabled) return;
    const style = state.playStyle;
    if (style === "bossa" || style === "stride") return;

    const bass = bassMidiPair(ch);
    const bassNotes = [bass.root, bass.third, bass.fifth];

    if (style === "waltz") {
      playNoteAt(bass.root, slotStart, slotSec * 0.32, { voice: "bass", vel: 1 });
      return;
    }

    if (style === "comping") {
      playNoteAt(bass.root, slotStart, slotSec * 0.14, { voice: "bass", vel: 0.88 });
      playNoteAt(bass.fifth, slotStart + slotSec * 0.5, slotSec * 0.12, { voice: "bass", vel: 0.58 });
      return;
    }

    const steps = arpeggioStepCount();
    const stepSec = slotSec / steps;
    const pattern = bassPatternSteps(steps, slotIndex);
    pattern.forEach(({ idx, vel }, step) => {
      const midi = bassNotes[Math.min(idx, bassNotes.length - 1)];
      const when = slotStart + step * stepSec;
      playNoteAt(midi, when, stepSec * 1.45, { voice: "bass", vel });
    });
  }

  function scheduleHarmony(voicing, slotStart, slotSec, slotIndex) {
    const style = state.playStyle;
    const slot = slotIndex ?? 0;
    const notes = voicing.slice().sort((a, b) => a - b);
    if (!notes.length) return;

    const playBlock = (when, dur, vel) => {
      notes.forEach((midi) => {
        playNoteAt(midi, when, dur, { vel: vel / notes.length });
      });
    };

    if (style === "block" || style === "strings") {
      notes.forEach((midi) => {
        playNoteAt(midi, slotStart, slotSec, { vel: 0.75 / notes.length });
      });
      return;
    }

    if (style === "guitar") {
      notes.forEach((midi, i) => {
        playNoteAt(midi, slotStart + i * 0.028, slotSec * 0.55, { pluck: true, vel: 0.85 / notes.length });
      });
      return;
    }

    if (style === "waltz") {
      const third = slotSec / 3;
      playBlock(slotStart + third, third * 0.85, 0.88);
      playBlock(slotStart + third * 2, third * 0.85, 0.82);
      return;
    }

    if (style === "comping") {
      const ts = getTimeSig();
      const hits = ts.num === 3 ? [0.333, 0.666] : [0.25, 0.75];
      hits.forEach((frac) => {
        playBlock(slotStart + slotSec * frac, slotSec * 0.18, 0.92);
      });
      return;
    }

    if (style === "bossa") {
      const bass = notes[0];
      playNoteAt(bass, slotStart, slotSec * 0.22, { vel: 0.78 });
      playBlock(slotStart + slotSec * 0.375, slotSec * 0.28, 0.72);
      playBlock(slotStart + slotSec * 0.6875, slotSec * 0.25, 0.6);
      return;
    }

    if (style === "stride") {
      const bass = notes[0];
      playNoteAt(bass, slotStart, slotSec * 0.2, { vel: 0.72 });
      playBlock(slotStart + slotSec * 0.25, slotSec * 0.22, 0.86);
      playNoteAt(bass, slotStart + slotSec * 0.5, slotSec * 0.2, { vel: 0.68 });
      playBlock(slotStart + slotSec * 0.75, slotSec * 0.22, 0.82);
      return;
    }

    if (style === "alberti") {
      const steps = arpeggioStepCount();
      const stepSec = slotSec / steps;
      const pattern = albertiIndices(notes.length, steps);
      pattern.forEach((noteIdx, step) => {
        playNoteAt(notes[noteIdx], slotStart + step * stepSec, stepSec * 1.2, { vel: 0.8 });
      });
      return;
    }

    if (style === "gospel") {
      const steps = arpeggioStepCount();
      const stepSec = slotSec / steps;
      const pattern = balladArpeggioIndices(notes.length, steps, slot);
      pattern.forEach((noteIdx, step) => {
        playNoteAt(notes[noteIdx], slotStart + step * stepSec, stepSec * 1.05, {
          vel: 0.78 + (step % 4 === 0 ? 0.1 : 0)
        });
      });
      return;
    }

    if (style === "triplet") {
      const steps = arpeggioStepCount();
      const stepSec = slotSec / steps;
      const pattern = balladArpeggioIndices(notes.length, steps, slot);
      pattern.forEach((noteIdx, step) => {
        playNoteAt(notes[noteIdx], slotStart + step * stepSec, stepSec * 1.15, {
          vel: step % 3 === 0 ? 0.88 : 0.72
        });
      });
      return;
    }

    const steps = arpeggioStepCount();
    const stepSec = slotSec / steps;
    const pattern = balladArpeggioIndices(notes.length, steps, slot);
    pattern.forEach((noteIdx, step) => {
      const when = slotStart + step * stepSec;
      playNoteAt(notes[noteIdx], when, stepSec * 1.35, { vel: 0.82 });
    });
  }

  function scheduleSlot(ch, voicing, slotStart, slotSec, slotIndex) {
    scheduleBass(ch, slotStart, slotSec, slotIndex);
    scheduleHarmony(voicing, slotStart, slotSec, slotIndex);
  }

  function playDrum(type, when, vel) {
    when = clampWhen(when);
    if (playDrumSample(type, when, vel)) return;
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

  function tickScheduler() {
    if (!playbackSession || !playing) return;
    const ctx = ensureAudio();
    const now = ctx.currentTime;
    const horizon = now + 2.5;
    const session = playbackSession;
    const { start, slotSec, measureSec, voicings, scheduledKeys, endTime, pattern } = session;

    if (now >= endTime - 0.02) {
      playing = false;
      highlightIndex = -1;
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
      playbackSession = null;
      updatePlayUi();
      renderChordGrid();
      return;
    }

    if (state.drumsEnabled) {
      const totalM = totalMeasures();
      for (let m = 0; m < totalM; m++) {
        const mStart = start + m * measureSec;
        if (mStart > horizon) break;
        const isFillBar = m > 0 && m % 4 === 3;
        pattern.forEach((hit) => {
          const when = mStart + hit.beat * measureSec;
          const key = `d:${m}:${hit.beat}:${hit.type}`;
          if (when < now - 0.05 || when > horizon || scheduledKeys.has(key)) return;
          scheduledKeys.add(key);
          const vel = isFillBar && hit.type === "snare" ? (hit.vel ?? 0.5) * 1.15 : hit.vel;
          playDrum(hit.type, when, vel);
        });
        if (isFillBar) {
          const cKey = `d:${m}:crash`;
          const cWhen = mStart + 0.875 * measureSec;
          if (cWhen >= now - 0.05 && cWhen <= horizon && !scheduledKeys.has(cKey)) {
            scheduledKeys.add(cKey);
            playDrum("crash", cWhen, 0.28);
          }
        }
      }
    }

    for (let idx = 0; idx < session.chordCount; idx++) {
      const slotStart = start + idx * slotSec;
      if (slotStart > horizon) break;
      const slotKey = `s:${idx}`;
      if (scheduledKeys.has(slotKey)) continue;
      if (slotStart < now - slotSec) {
        scheduledKeys.add(slotKey);
        continue;
      }
      scheduledKeys.add(slotKey);
      scheduleSlot(state.chords[idx], voicings[idx], slotStart, slotSec, idx);
      const delayMs = Math.max(0, (slotStart - now) * 1000);
      playTimers.push(
        setTimeout(() => {
          if (playing) {
            highlightIndex = idx;
            renderChordGrid();
          }
        }, delayMs)
      );
    }
  }

  async function schedulePlayback() {
    stopPlayback();
    try {
      await ensureAudioReady();
      await Promise.all([loadDrumSamples(), ensureSoundfontReady()]);
    } catch {
      showToast("오디오 초기화 실패");
      return;
    }

    const ctx = ensureAudio();
    const slotSec = slotSeconds();
    const measureSec = measureSeconds();
    const start = ctx.currentTime + 0.2;
    const voicings = computeVoicings(state.chords);
    const pattern = DRUM_PATTERNS[state.drumGenre] || DRUM_PATTERNS.ballad;

    playbackSession = {
      start,
      slotSec,
      measureSec,
      voicings,
      scheduledKeys: new Set(),
      chordCount: state.chords.length,
      pattern,
      endTime: start + state.chords.length * slotSec
    };

    playing = true;
    updatePlayUi();
    tickScheduler();
    schedulerTimer = setInterval(tickScheduler, 45);
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
      songKey: state.songKey,
      arpeggioVariant: state.arpeggioVariant,
      chords: state.chords.map((c) => ({ root: c.root, quality: c.quality }))
    };
  }

  function applySnapshot(data) {
    state.bpm = Number(data.bpm) || 72;
    state.timeSig = data.timeSig || "4/4";
    state.beatUnit = data.beatUnit === 0.5 ? 0.5 : 1;
    state.instrument = INSTRUMENTS.some((i) => i.id === data.instrument) ? data.instrument : "piano";
    state.playStyle = PLAY_STYLES.some((s) => s.id === data.playStyle) ? data.playStyle : "ballad";
    state.bassEnabled = data.bassEnabled !== false;
    state.drumsEnabled = !!data.drumsEnabled;
    state.drumGenre = data.drumGenre || "ballad";
    state.songKey = data.songKey || data.presetMeta?.key || "C";
    state.arpeggioVariant = ARPEGGIO_VARIANTS.some((v) => v.id === data.arpeggioVariant)
      ? data.arpeggioVariant
      : "classic";
    state.chords = (data.chords || []).map((c) => ({
      root: c.root || "C",
      quality: c.quality || "maj"
    }));
    if (!state.chords.length) initDefaultChords();
  }

  function applyPreset(presetId) {
    const preset = getPresets().find((p) => p.id === presetId);
    if (!preset) return;
    state.bpm = preset.bpm;
    state.timeSig = preset.timeSig;
    state.beatUnit = preset.beatUnit;
    if (preset.playStyle && PLAY_STYLES.some((s) => s.id === preset.playStyle)) {
      state.playStyle = preset.playStyle;
    }
    if (preset.instrument && INSTRUMENTS.some((i) => i.id === preset.instrument)) {
      state.instrument = preset.instrument;
      sfLoading = loadSoundfontInstrument(state.instrument);
    }
    if (preset.drumGenre && DRUM_GENRES.some((d) => d.id === preset.drumGenre)) {
      state.drumGenre = preset.drumGenre;
    }
    if (preset.chords?.length) {
      state.chords = preset.chords.map((c) => ({ root: c.root, quality: c.quality }));
    } else if (preset.loop) {
      const measures = Math.min(preset.measures ?? 48, 48);
      state.chords = [];
      for (let i = 0; i < measures; i++) {
        state.chords.push({ ...preset.loop[i % preset.loop.length] });
      }
    }
    state.presetMeta = {
      title: preset.label,
      key: preset.key || "",
      source: "preset"
    };
    state.songKey = preset.key || "C";
    stopPlayback();
    renderAll();
    const keyHint = preset.key ? ` · ${preset.key}` : "";
    const lenHint = `${state.chords.length}마디`;
    showToast(`프리셋 · ${preset.label}${keyHint} · ${lenHint}`);
  }

  function applyTheoryDemo(demoId, autoPlay) {
    const demo = (window.HarmTheory?.PROGRESSION_DEMOS || []).find((d) => d.id === demoId);
    if (!demo) return;
    stopPlayback();
    state.chords = demo.chords.map((c) => ({ root: c.root, quality: c.quality }));
    state.presetMeta = { title: demo.title, key: demo.key, source: "theory" };
    state.songKey = demo.key || "C";
    state.timeSig = demo.timeSig || "4/4";
    state.beatUnit = 1;
    if (demo.bpm) state.bpm = demo.bpm;
    if (demo.playStyle && PLAY_STYLES.some((s) => s.id === demo.playStyle)) {
      state.playStyle = demo.playStyle;
    }
    if (demo.instrument && INSTRUMENTS.some((i) => i.id === demo.instrument)) {
      state.instrument = demo.instrument;
      sfLoading = loadSoundfontInstrument(state.instrument);
    }
    renderAll();
    pageRoot?.querySelector(".harm-grid-wrap")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast(`${demo.title} · ${demo.feel}`);
    if (autoPlay) {
      setTimeout(() => {
        schedulePlayback();
      }, 120);
    }
  }

  function addFourMeasures() {
    const slotsPerMeasure = state.beatUnit === 0.5 ? 2 : 1;
    const copyCount = MEASURES_PER_ADD * slotsPerMeasure;
    if (state.chords.length + copyCount > MAX_CHORD_SLOTS) {
      showToast(`최대 ${MAX_CHORD_SLOTS}칸(${Math.floor(MAX_CHORD_SLOTS * state.beatUnit)}마디)까지 추가할 수 있습니다`);
      return;
    }
    const start = Math.max(0, state.chords.length - copyCount);
    const slice = state.chords.slice(start);
    if (!slice.length) {
      showToast("복사할 패턴이 없습니다");
      return;
    }
    stopPlayback();
    state.chords.push(...slice.map((c) => ({ root: c.root, quality: c.quality })));
    renderAll();
    showToast(`+${MEASURES_PER_ADD}마디 (${copyCount}칸) · 직전 패턴 복사`);
    requestAnimationFrame(() => {
      const grid = pageRoot?.querySelector("[data-harm-grid]");
      const last = grid?.querySelector(`[data-slot="${state.chords.length - 1}"]`);
      last?.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
    });
  }

  function updateArpeggioFieldVisibility() {
    if (!pageRoot) return;
    const field = pageRoot.querySelector("[data-harm-arpeggio-field]");
    if (!field) return;
    field.hidden = !ARPEGGIO_STYLES.has(state.playStyle);
  }

  function updateKeyDisplay() {
    if (!pageRoot) return;
    const el = pageRoot.querySelector("[data-harm-key-display]");
    if (el) el.textContent = getDisplayKey();
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
    const meta = state.presetMeta;
    const metaHtml = meta?.title
      ? `<span class="harm-summary-song">「${escapeHtml(meta.title)}」</span>`
      : "";
    const stats = `${state.chords.length}칸 · ${totalMeasures()}마디 · ${Math.round(totalMeasures() * measureSeconds())}초`;
    el.innerHTML = `${metaHtml}<span class="harm-summary-stats">${stats}</span>`;
    updateKeyDisplay();
  }

  function renderProgressionDemosHtml() {
    const demos = window.HarmTheory?.PROGRESSION_DEMOS || [];
    if (!demos.length) return "";
    return `
      <div class="harm-theory-demos">
        <h4 class="harm-theory-demos-title">코드 진행 예시 · 마디에 적용 후 바로 들어보기</h4>
        <div class="harm-demo-grid">
          ${demos
            .map(
              (d) => `
            <article class="harm-demo-card">
              <div class="harm-demo-head">
                <strong>${escapeHtml(d.title)}</strong>
                <span class="harm-demo-key">${escapeHtml(d.key)}</span>
              </div>
              <p class="harm-demo-prog">${escapeHtml(d.progressionLabel)}</p>
              <p class="harm-demo-feel">${escapeHtml(d.feel)}</p>
              <div class="harm-demo-actions">
                <button type="button" class="harm-btn harm-btn-ghost harm-demo-btn" data-harm-theory-demo="${escapeHtml(d.id)}">마디에 적용</button>
                <button type="button" class="harm-btn harm-btn-primary harm-demo-btn" data-harm-theory-demo="${escapeHtml(d.id)}" data-harm-theory-play="1">▶ 들어보기</button>
              </div>
            </article>`
            )
            .join("")}
        </div>
      </div>`;
  }

  function renderTheorySection() {
    if (!pageRoot) return;
    const root = pageRoot.querySelector("[data-harm-theory]");
    if (!root) return;
    const tabs = window.HarmTheory?.TABS || [];
    root.innerHTML = `
      <h3 class="harm-theory-heading">작곡·화성 이론</h3>
      <p class="harm-theory-intro">코드 진행, 조의 느낌, 곡 구조를 Harm 작곡에 바로 연결해 보세요.</p>
      <div class="harm-theory-tabs">
        ${tabs
          .map((tab) => {
            const open = state.theoryOpenId === tab.id;
            const extra = tab.id === "progression" ? renderProgressionDemosHtml() : "";
            return `
          <div class="harm-theory-item${open ? " is-open" : ""}">
            <button type="button" class="harm-theory-tab" data-harm-theory-tab="${escapeHtml(tab.id)}" aria-expanded="${open}">
              <span class="harm-theory-tab-title">${escapeHtml(tab.title)}</span>
              <span class="harm-theory-tab-summary">${escapeHtml(tab.summary)}</span>
              <span class="harm-collapse-icon">${open ? "▾" : "▸"}</span>
            </button>
            <div class="harm-theory-body"${open ? "" : " hidden"}>${tab.body}${extra}</div>
          </div>`;
          })
          .join("")}
      </div>`;
  }

  function renderChordGrid() {
    if (!pageRoot) return;
    const grid = pageRoot.querySelector("[data-harm-grid]");
    if (!grid) return;

    const displayKey = getDisplayKey();
    let measureAcc = 0;
    grid.innerHTML = state.chords
      .map((ch, idx) => {
        const measureLabel =
          state.beatUnit === 0.5
            ? `${Math.floor(measureAcc * 2) / 2 + 1}${measureAcc % 1 ? "½" : ""}`
            : String(Math.floor(measureAcc) + 1);
        measureAcc += state.beatUnit;
        const active = idx === highlightIndex ? " is-playing" : "";
        const fn = chordFunction(ch, displayKey);
        const fnClass = fn !== "other" ? ` harm-fn-${fn}` : "";
        const rootOpts = ROOTS.map(
          (r) => `<option value="${r}"${r === ch.root ? " selected" : ""}>${r}</option>`
        ).join("");
        const qualOpts = QUALITIES.map(
          (q) =>
            `<option value="${q.id}"${q.id === ch.quality ? " selected" : ""}>${escapeHtml(q.label)}</option>`
        ).join("");
        return `
        <div class="harm-slot${active}${fnClass}" data-slot="${idx}" title="${fn === "tonic" ? "1도 계열" : fn === "subdom" ? "4도 계열" : fn === "dominant" ? "5도 계열" : ""}">
          <span class="harm-slot-num">${measureLabel}</span>
          <div class="harm-slot-row">
            <select class="harm-select harm-root" data-chord-root="${idx}" aria-label="코드 ${idx + 1} 근음">${rootOpts}</select>
            <select class="harm-select harm-quality" data-chord-quality="${idx}" aria-label="코드 ${idx + 1} 타입">${qualOpts}</select>
          </div>
        </div>`;
      })
      .join("");
    renderSummary();
  }

  function renderSaveList() {
    if (!pageRoot) return;
    const listEl = pageRoot.querySelector("[data-harm-save-list]");
    const countEl = pageRoot.querySelector("[data-harm-save-count]");
    const panelEl = pageRoot.querySelector("[data-harm-save-panel]");
    const toggleBtn = pageRoot.querySelector("[data-harm-save-toggle]");
    if (!listEl) return;

    const saves = loadSaves();
    if (countEl) countEl.textContent = saves.length ? `(${saves.length})` : "";
    if (panelEl) panelEl.classList.toggle("is-collapsed", !state.saveListOpen);
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", state.saveListOpen ? "true" : "false");
      const icon = toggleBtn.querySelector(".harm-collapse-icon");
      if (icon) icon.textContent = state.saveListOpen ? "▾" : "▸";
    }

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
    const arpEl = pageRoot.querySelector("[data-harm-arpeggio]");
    if (arpEl) arpEl.value = state.arpeggioVariant;
    renderChordGrid();
    renderSaveList();
    renderTheorySection();
    updateArpeggioFieldVisibility();
    updateKeyDisplay();
    updatePlayUi();
  }

  function bindEvents() {
    if (!pageRoot) return;
    eventsAbort?.abort();
    eventsAbort = new AbortController();
    const { signal } = eventsAbort;

    pageRoot.addEventListener("input", (e) => {
      const t = e.target;
      if (t.matches("[data-harm-bpm]")) {
        state.bpm = Math.min(200, Math.max(40, Number(t.value) || 72));
        renderSummary();
      }
      if (t.matches("[data-harm-save-name]")) {
        state.saveName = t.value;
      }
    }, { signal });

    pageRoot.addEventListener("change", (e) => {
      const t = e.target;
      if (t.matches("[data-harm-timesig]")) {
        state.timeSig = t.value;
        if (state.timeSig === "3/4" && ["ballad", "block", "alberti"].includes(state.playStyle)) {
          state.playStyle = "waltz";
          const styleEl = pageRoot?.querySelector("[data-harm-play-style]");
          if (styleEl) styleEl.value = "waltz";
        }
        if (state.timeSig === "12/8" && state.playStyle === "ballad") {
          state.playStyle = "triplet";
          const styleEl = pageRoot?.querySelector("[data-harm-play-style]");
          if (styleEl) styleEl.value = "triplet";
        }
        renderSummary();
      }
      if (t.matches("[data-harm-beatunit]")) {
        setBeatUnit(Number(t.value));
      }
      if (t.matches("[data-harm-instrument]")) {
        state.instrument = t.value;
        sfLoading = loadSoundfontInstrument(state.instrument);
      }
      if (t.matches("[data-harm-play-style]")) {
        state.playStyle = t.value;
        updateArpeggioFieldVisibility();
      }
      if (t.matches("[data-harm-arpeggio]")) {
        state.arpeggioVariant = t.value;
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
    }, { signal });

    pageRoot.addEventListener("click", (e) => {
      const playBtn = e.target.closest("[data-harm-play]");
      if (playBtn) {
        void schedulePlayback();
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
        e.preventDefault();
        addFourMeasures();
        return;
      }
      const trBtn = e.target.closest("[data-harm-transpose]");
      if (trBtn) {
        e.preventDefault();
        transposeAll(Number(trBtn.dataset.harmTranspose));
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
        return;
      }
      const saveToggle = e.target.closest("[data-harm-save-toggle]");
      if (saveToggle) {
        state.saveListOpen = !state.saveListOpen;
        renderSaveList();
        return;
      }
      const theoryTab = e.target.closest("[data-harm-theory-tab]");
      if (theoryTab) {
        const id = theoryTab.dataset.harmTheoryTab;
        state.theoryOpenId = state.theoryOpenId === id ? null : id;
        renderTheorySection();
        return;
      }
      const demoBtn = e.target.closest("[data-harm-theory-demo]");
      if (demoBtn) {
        applyTheoryDemo(demoBtn.dataset.harmTheoryDemo, demoBtn.hasAttribute("data-harm-theory-play"));
      }
    }, { signal });
  }

  function buildArpeggioOptionsHtml() {
    return ARPEGGIO_VARIANTS.map(
      (v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.label)}</option>`
    ).join("");
  }

  function renderPage(container) {
    const presetOpts = buildPresetOptionsHtml();
    const timeSigOpts = TIME_SIGS.map(
      (t) => `<option value="${t.id}">${t.label}</option>`
    ).join("");
    const instOpts = buildInstrumentOptionsHtml();
    const drumOpts = DRUM_GENRES.map(
      (d) => `<option value="${d.id}">${escapeHtml(d.label)}</option>`
    ).join("");
    const styleOpts = buildPlayStyleOptionsHtml();
    const arpOpts = buildArpeggioOptionsHtml();

    container.innerHTML = `
      <div class="harm-panel">
        <header class="harm-header">
          <h2>Harm</h2>
          <p class="harm-intro">SoundFont 실제 악기 16종·반주 11패턴·아르페지오 9종. 조 ± 이동, 64마디까지 확장.</p>
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
          <label class="harm-field harm-field-grow" data-harm-arpeggio-field hidden>
            <span>아르페지오 패턴</span>
            <select data-harm-arpeggio>${arpOpts}</select>
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
            <span>코드 프리셋</span>
            <select data-harm-preset>
              <option value="">— 곡 선택 (발라드 / 재즈) —</option>
              ${presetOpts}
            </select>
          </label>
        </section>

        <div class="harm-summary-row">
          <div class="harm-summary" data-harm-summary></div>
          <div class="harm-key-transpose" aria-label="조 이동">
            <span class="harm-key-label">조</span>
            <button type="button" class="harm-key-btn" data-harm-transpose="-1" title="반음 내림">−</button>
            <span class="harm-key-display" data-harm-key-display>C</span>
            <button type="button" class="harm-key-btn" data-harm-transpose="1" title="반음 올림">+</button>
          </div>
        </div>

        <div class="harm-fn-legend" aria-label="코드 기능 색상">
          <span class="harm-fn-legend-item harm-fn-tonic">1도</span>
          <span class="harm-fn-legend-item harm-fn-subdom">4도</span>
          <span class="harm-fn-legend-item harm-fn-dominant">5도</span>
          <span class="harm-fn-legend-hint">대리코드(iii, vi 등) 포함</span>
        </div>

        <div class="harm-grid-wrap">
          <div class="harm-grid" data-harm-grid aria-label="코드 진행"></div>
        </div>

        <div class="harm-actions">
          <button type="button" class="harm-btn" data-harm-add-measures">+ 4마디 추가 (패턴 복사)</button>
        </div>

        <section class="harm-save-section" aria-label="저장 및 불러오기">
          <button type="button" class="harm-collapse-btn" data-harm-save-toggle aria-expanded="false">
            <span>내 작곡</span>
            <span data-harm-save-count></span>
            <span class="harm-collapse-icon">▸</span>
          </button>
          <div class="harm-save-panel is-collapsed" data-harm-save-panel>
            <div class="harm-save-form">
              <input type="text" class="harm-save-input" data-harm-save-name placeholder="저장 이름" maxlength="40">
              <button type="button" class="harm-btn harm-btn-primary" data-harm-save>저장</button>
            </div>
            <div class="harm-save-list" data-harm-save-list></div>
          </div>
        </section>

        <section class="harm-theory-section" data-harm-theory aria-label="작곡 이론"></section>
      </div>`;

    pageRoot = container.querySelector(".harm-panel") || container;
    bindEvents();
    renderAll();
  }

  function leavePage() {
    eventsAbort?.abort();
    eventsAbort = null;
    stopPlayback();
    pageRoot = null;
  }

  window.Harm = { renderPage, leavePage };
})();
