(function () {
  "use strict";

  /** @typedef {{ root: string, quality: string }} HarmChord */

  /**
   * @param {HarmChord[]} prog
   * @param {number} bars
   * @returns {HarmChord[]}
   */
  function fillBars(prog, bars) {
    const out = [];
    for (let i = 0; i < bars; i++) {
      out.push({ ...prog[i % prog.length] });
    }
    return out;
  }

  /**
   * @param {{ bars: number, prog: HarmChord[] }[]} sections
   * @param {number} [maxMeasures=48]
   * @returns {HarmChord[]}
   */
  function buildSong(sections, maxMeasures) {
    const limit = maxMeasures ?? 48;
    const chords = [];
    sections.forEach((sec) => {
      chords.push(...fillBars(sec.prog, sec.bars));
    });
    return chords.slice(0, limit);
  }

  const BALLAD_PRESETS = [
    {
      id: "my-love-by-my-side",
      label: "내 사랑 내 곁에",
      key: "Am",
      bpm: 68,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 48,
      chords: buildSong([
        { bars: 4, prog: [{ root: "A", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "E", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "D", quality: "min" }, { root: "A", quality: "min" }, { root: "E", quality: "maj" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "E", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "D", quality: "min" }, { root: "A", quality: "min" }, { root: "E", quality: "maj" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }] },
        { bars: 4, prog: [{ root: "F", quality: "maj" }, { root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "A", quality: "min" }] }
      ])
    },
    {
      id: "around-thirty",
      label: "30살쯤에",
      key: "C",
      bpm: 72,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 40,
      chords: buildSong([
        { bars: 4, prog: [{ root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "F", quality: "maj" }, { root: "E", quality: "min" }] },
        { bars: 8, prog: [{ root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }, { root: "F", quality: "maj" }] },
        { bars: 8, prog: [{ root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "F", quality: "maj" }, { root: "E", quality: "min" }] },
        { bars: 8, prog: [{ root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }, { root: "F", quality: "maj" }] },
        { bars: 4, prog: [{ root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }] }
      ])
    },
    {
      id: "rhapsody-in-rain",
      label: "비의 랩소디",
      key: "F",
      bpm: 63,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 48,
      chords: buildSong([
        { bars: 4, prog: [{ root: "F", quality: "maj7" }, { root: "G", quality: "maj" }, { root: "E", quality: "min7" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "D", quality: "min7" }, { root: "G", quality: "min7" }, { root: "C", quality: "maj7" }, { root: "F", quality: "maj7" }, { root: "B", quality: "min7" }, { root: "E", quality: "min7" }, { root: "A", quality: "min7" }, { root: "D", quality: "min7" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj7" }, { root: "G", quality: "maj" }, { root: "E", quality: "min7" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "D", quality: "min7" }, { root: "G", quality: "min7" }, { root: "C", quality: "maj7" }, { root: "F", quality: "maj7" }, { root: "B", quality: "min7" }, { root: "E", quality: "min7" }, { root: "A", quality: "min7" }, { root: "D", quality: "min7" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj7" }, { root: "G", quality: "maj" }, { root: "E", quality: "min7" }, { root: "A", quality: "min" }] },
        { bars: 4, prog: [{ root: "Bb", quality: "maj" }, { root: "G", quality: "min" }, { root: "C", quality: "maj7" }, { root: "F", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "D", quality: "min7" }, { root: "G", quality: "dom7" }, { root: "G", quality: "min7" }, { root: "C", quality: "maj7" }] }
      ])
    },
    {
      id: "how-are-you",
      label: "좋니",
      key: "C",
      bpm: 70,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 44,
      chords: buildSong([
        { bars: 4, prog: [{ root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "A", quality: "min" }, { root: "F", quality: "maj" }] },
        { bars: 8, prog: [{ root: "C", quality: "maj" }, { root: "E", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "A", quality: "min" }, { root: "F", quality: "maj" }] },
        { bars: 8, prog: [{ root: "C", quality: "maj" }, { root: "E", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj" }, { root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "A", quality: "min" }, { root: "F", quality: "maj" }] }
      ])
    },
    {
      id: "because-i-love-you",
      label: "사랑하기 때문에",
      key: "C",
      bpm: 66,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 48,
      chords: buildSong([
        { bars: 4, prog: [{ root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "F", quality: "maj" }, { root: "D", quality: "min" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "G", quality: "dom7" }] },
        { bars: 8, prog: [{ root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "A", quality: "min" }, { root: "F", quality: "maj" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "F", quality: "maj" }, { root: "D", quality: "min" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "G", quality: "dom7" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj" }, { root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }, { root: "C", quality: "maj" }] },
        { bars: 4, prog: [{ root: "F", quality: "maj" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }, { root: "C", quality: "maj" }] }
      ])
    },
    {
      id: "regret",
      label: "미련",
      key: "Bb",
      bpm: 64,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 40,
      chords: buildSong([
        { bars: 4, prog: [{ root: "Bb", quality: "maj" }, { root: "F", quality: "maj" }, { root: "G", quality: "min" }, { root: "Eb", quality: "maj" }] },
        { bars: 8, prog: [{ root: "Cm", quality: "min" }, { root: "F", quality: "maj" }, { root: "Bb", quality: "maj" }, { root: "Eb", quality: "maj" }, { root: "Cm", quality: "min" }, { root: "F", quality: "maj" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }] },
        { bars: 8, prog: [{ root: "Bb", quality: "maj" }, { root: "F", quality: "maj" }, { root: "G", quality: "min" }, { root: "Eb", quality: "maj" }] },
        { bars: 8, prog: [{ root: "Cm", quality: "min" }, { root: "F", quality: "maj" }, { root: "Bb", quality: "maj" }, { root: "Eb", quality: "maj" }, { root: "Cm", quality: "min" }, { root: "F", quality: "maj" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }] },
        { bars: 8, prog: [{ root: "Eb", quality: "maj" }, { root: "F", quality: "maj" }, { root: "G", quality: "min" }, { root: "Bb", quality: "maj" }] },
        { bars: 4, prog: [{ root: "Eb", quality: "maj" }, { root: "F", quality: "maj" }, { root: "Bb", quality: "maj" }, { root: "Bb", quality: "maj" }] }
      ])
    },
    {
      id: "footsteps",
      label: "발걸음",
      key: "Em",
      bpm: 74,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 44,
      chords: buildSong([
        { bars: 4, prog: [{ root: "E", quality: "min" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "D", quality: "maj" }] },
        { bars: 8, prog: [{ root: "E", quality: "min" }, { root: "B", quality: "min" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "A", quality: "min" }, { root: "E", quality: "min" }, { root: "B", quality: "maj" }, { root: "E", quality: "min" }] },
        { bars: 8, prog: [{ root: "E", quality: "min" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "D", quality: "maj" }] },
        { bars: 8, prog: [{ root: "E", quality: "min" }, { root: "B", quality: "min" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "A", quality: "min" }, { root: "E", quality: "min" }, { root: "B", quality: "maj" }, { root: "E", quality: "min" }] },
        { bars: 8, prog: [{ root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "D", quality: "maj" }, { root: "E", quality: "min" }] },
        { bars: 8, prog: [{ root: "E", quality: "min" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "D", quality: "maj" }] }
      ])
    },
    {
      id: "you-in-my-arms",
      label: "그대 내 품에",
      key: "G",
      bpm: 67,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 48,
      chords: buildSong([
        { bars: 4, prog: [{ root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "C", quality: "maj" }, { root: "D", quality: "maj" }] },
        { bars: 8, prog: [{ root: "G", quality: "maj" }, { root: "B", quality: "min" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }, { root: "D", quality: "maj" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }, { root: "D", quality: "maj" }] },
        { bars: 8, prog: [{ root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "C", quality: "maj" }, { root: "D", quality: "maj" }] },
        { bars: 8, prog: [{ root: "G", quality: "maj" }, { root: "B", quality: "min" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }, { root: "D", quality: "maj" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }, { root: "D", quality: "maj" }] },
        { bars: 8, prog: [{ root: "E", quality: "min" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "D", quality: "maj" }] },
        { bars: 8, prog: [{ root: "G", quality: "maj" }, { root: "E", quality: "min" }, { root: "C", quality: "maj" }, { root: "D", quality: "maj" }] },
        { bars: 4, prog: [{ root: "C", quality: "maj" }, { root: "D", quality: "maj" }, { root: "G", quality: "maj" }, { root: "G", quality: "maj" }] }
      ])
    },
    {
      id: "love-runs-away",
      label: "사랑은 늘 도망가",
      key: "F",
      bpm: 65,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 48,
      chords: buildSong([
        { bars: 4, prog: [{ root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "D", quality: "min" }, { root: "Bb", quality: "maj" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj" }, { root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "Bb", quality: "maj" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "min" }, { root: "C", quality: "maj" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "D", quality: "min" }, { root: "Bb", quality: "maj" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj" }, { root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "Bb", quality: "maj" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "min" }, { root: "C", quality: "maj" }] },
        { bars: 8, prog: [{ root: "D", quality: "min" }, { root: "Bb", quality: "maj" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "D", quality: "min" }, { root: "Bb", quality: "maj" }] },
        { bars: 4, prog: [{ root: "Bb", quality: "maj" }, { root: "C", quality: "maj" }, { root: "F", quality: "maj" }, { root: "F", quality: "maj" }] }
      ])
    },
    {
      id: "i-miss-you",
      label: "보고싶다",
      key: "Am",
      bpm: 60,
      timeSig: "4/4",
      beatUnit: 1,
      measures: 48,
      chords: buildSong([
        { bars: 4, prog: [{ root: "A", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }, { root: "F", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }, { root: "E", quality: "min" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "D", quality: "min" }, { root: "G", quality: "maj" }, { root: "C", quality: "maj" }, { root: "F", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }, { root: "E", quality: "min" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }, { root: "A", quality: "min" }] },
        { bars: 8, prog: [{ root: "A", quality: "min" }, { root: "F", quality: "maj" }, { root: "C", quality: "maj" }, { root: "G", quality: "maj" }] },
        { bars: 4, prog: [{ root: "F", quality: "maj" }, { root: "E", quality: "min" }, { root: "A", quality: "min" }, { root: "A", quality: "min" }] }
      ])
    }
  ];

  const JAZZ_PRESETS = [
    {
      id: "autumn-leaves",
      label: "Autumn Leaves (가을낙엽)",
      category: "jazz",
      key: "Gm",
      bpm: 120,
      timeSig: "4/4",
      beatUnit: 1,
      drumGenre: "jazz",
      playStyle: "ballad",
      measures: 32,
      chords: buildSong([
        { bars: 8, prog: [{ root: "G", quality: "min7" }, { root: "C", quality: "dom7" }, { root: "F", quality: "maj7" }, { root: "Bb", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "A", quality: "min7" }, { root: "D", quality: "dom7" }, { root: "G", quality: "min7" }, { root: "G", quality: "min7" }] },
        { bars: 8, prog: [{ root: "G", quality: "min7" }, { root: "C", quality: "dom7" }, { root: "F", quality: "maj7" }, { root: "Bb", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "A", quality: "min7" }, { root: "D", quality: "dom7" }, { root: "G", quality: "min7" }, { root: "D", quality: "dom7" }] }
      ])
    },
    {
      id: "fly-me-to-the-moon",
      label: "Fly Me to the Moon",
      category: "jazz",
      key: "Am",
      bpm: 110,
      timeSig: "4/4",
      beatUnit: 1,
      drumGenre: "jazz",
      measures: 32,
      chords: buildSong([
        { bars: 8, prog: [{ root: "A", quality: "min7" }, { root: "D", quality: "min7" }, { root: "G", quality: "dom7" }, { root: "C", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj7" }, { root: "B", quality: "m7b5" }, { root: "E", quality: "dom7" }, { root: "A", quality: "min7" }] },
        { bars: 8, prog: [{ root: "A", quality: "min7" }, { root: "D", quality: "min7" }, { root: "G", quality: "dom7" }, { root: "C", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "D", quality: "min7" }, { root: "G", quality: "dom7" }, { root: "C", quality: "maj7" }, { root: "F", quality: "maj7" }] }
      ])
    },
    {
      id: "all-of-me",
      label: "All of Me",
      category: "jazz",
      key: "C",
      bpm: 108,
      timeSig: "4/4",
      beatUnit: 1,
      drumGenre: "jazz",
      measures: 32,
      chords: buildSong([
        { bars: 8, prog: [{ root: "C", quality: "maj7" }, { root: "E", quality: "min7" }, { root: "A", quality: "min7" }, { root: "D", quality: "min7" }] },
        { bars: 8, prog: [{ root: "G", quality: "dom7" }, { root: "G", quality: "dom7" }, { root: "C", quality: "maj7" }, { root: "C", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "E", quality: "min7" }, { root: "A", quality: "min7" }, { root: "D", quality: "min7" }, { root: "G", quality: "dom7" }] },
        { bars: 8, prog: [{ root: "C", quality: "maj7" }, { root: "E", quality: "min7" }, { root: "A", quality: "min7" }, { root: "D", quality: "dom7" }] }
      ])
    },
    {
      id: "take-five",
      label: "Take Five",
      category: "jazz",
      key: "Em",
      bpm: 160,
      timeSig: "5/4",
      beatUnit: 1,
      drumGenre: "jazz",
      measures: 40,
      chords: buildSong([
        { bars: 10, prog: [{ root: "E", quality: "min7" }, { root: "E", quality: "min7" }, { root: "B", quality: "m7b5" }, { root: "E", quality: "min7" }, { root: "A", quality: "min7" }] },
        { bars: 10, prog: [{ root: "E", quality: "min7" }, { root: "E", quality: "min7" }, { root: "B", quality: "m7b5" }, { root: "E", quality: "min7" }, { root: "A", quality: "min7" }] },
        { bars: 10, prog: [{ root: "C", quality: "min7" }, { root: "C", quality: "min7" }, { root: "G", quality: "min7" }, { root: "C", quality: "min7" }, { root: "F", quality: "min7" }] },
        { bars: 10, prog: [{ root: "E", quality: "min7" }, { root: "E", quality: "min7" }, { root: "B", quality: "m7b5" }, { root: "E", quality: "min7" }, { root: "A", quality: "min7" }] }
      ])
    },
    {
      id: "misty",
      label: "Misty",
      category: "jazz",
      key: "Eb",
      bpm: 70,
      timeSig: "4/4",
      beatUnit: 1,
      drumGenre: "ballad",
      measures: 32,
      chords: buildSong([
        { bars: 8, prog: [{ root: "Eb", quality: "maj7" }, { root: "Bb", quality: "dom7" }, { root: "G", quality: "min7" }, { root: "C", quality: "min7" }] },
        { bars: 8, prog: [{ root: "F", quality: "min7" }, { root: "Bb", quality: "dom7" }, { root: "Eb", quality: "maj7" }, { root: "Ab", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "Eb", quality: "maj7" }, { root: "Bb", quality: "dom7" }, { root: "G", quality: "min7" }, { root: "C", quality: "min7" }] },
        { bars: 8, prog: [{ root: "F", quality: "min7" }, { root: "Bb", quality: "dom7" }, { root: "Eb", quality: "maj7" }, { root: "Eb", quality: "maj7" }] }
      ])
    },
    {
      id: "summertime",
      label: "Summertime",
      category: "jazz",
      key: "Am",
      bpm: 88,
      timeSig: "4/4",
      beatUnit: 1,
      drumGenre: "jazz",
      measures: 32,
      chords: buildSong([
        { bars: 8, prog: [{ root: "A", quality: "min7" }, { root: "A", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }] },
        { bars: 8, prog: [{ root: "A", quality: "min7" }, { root: "A", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj7" }, { root: "F", quality: "maj7" }, { root: "E", quality: "min7" }, { root: "E", quality: "min7" }] },
        { bars: 8, prog: [{ root: "A", quality: "min7" }, { root: "D", quality: "min7" }, { root: "G", quality: "dom7" }, { root: "C", quality: "maj7" }] }
      ])
    },
    {
      id: "blue-in-green",
      label: "Blue in Green",
      category: "jazz",
      key: "G",
      bpm: 58,
      timeSig: "4/4",
      beatUnit: 1,
      drumGenre: "jazz",
      playStyle: "strings",
      measures: 32,
      chords: buildSong([
        { bars: 8, prog: [{ root: "G", quality: "maj7" }, { root: "A", quality: "min7" }, { root: "D", quality: "dom7" }, { root: "G", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "B", quality: "m7b5" }, { root: "E", quality: "min7" }, { root: "A", quality: "min7" }, { root: "D", quality: "dom7" }] },
        { bars: 8, prog: [{ root: "G", quality: "maj7" }, { root: "G", quality: "maj7" }, { root: "B", quality: "m7b5" }, { root: "E", quality: "min7" }] },
        { bars: 8, prog: [{ root: "A", quality: "min7" }, { root: "D", quality: "dom7" }, { root: "G", quality: "maj7" }, { root: "G", quality: "maj7" }] }
      ])
    },
    {
      id: "so-what",
      label: "So What",
      category: "jazz",
      key: "Dm",
      bpm: 132,
      timeSig: "4/4",
      beatUnit: 1,
      drumGenre: "jazz",
      measures: 32,
      chords: buildSong([
        { bars: 8, prog: [{ root: "D", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }] },
        { bars: 8, prog: [{ root: "D", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }] },
        { bars: 8, prog: [{ root: "Eb", quality: "min7" }, { root: "Eb", quality: "min7" }, { root: "Eb", quality: "min7" }, { root: "Eb", quality: "min7" }] },
        { bars: 8, prog: [{ root: "D", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }] }
      ])
    },
    {
      id: "girl-from-ipanema",
      label: "The Girl from Ipanema",
      category: "jazz",
      key: "F",
      bpm: 118,
      timeSig: "4/4",
      beatUnit: 1,
      drumGenre: "bossa",
      measures: 40,
      chords: buildSong([
        { bars: 8, prog: [{ root: "F", quality: "maj7" }, { root: "G", quality: "min7" }, { root: "G", quality: "min7" }, { root: "F", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "Bb", quality: "maj7" }, { root: "G", quality: "min7" }, { root: "G", quality: "min7" }, { root: "C", quality: "dom7" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj7" }, { root: "G", quality: "min7" }, { root: "G", quality: "min7" }, { root: "F", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "D", quality: "min7" }, { root: "G", quality: "dom7" }, { root: "C", quality: "maj7" }, { root: "F", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "F", quality: "maj7" }, { root: "G", quality: "min7" }, { root: "G", quality: "min7" }, { root: "F", quality: "maj7" }] }
      ])
    },
    {
      id: "cantaloupe-island",
      label: "Cantaloupe Island",
      category: "jazz",
      key: "Fm",
      bpm: 108,
      timeSig: "4/4",
      beatUnit: 1,
      drumGenre: "latin",
      measures: 32,
      chords: buildSong([
        { bars: 8, prog: [{ root: "F", quality: "min7" }, { root: "F", quality: "min7" }, { root: "F", quality: "min7" }, { root: "F", quality: "min7" }] },
        { bars: 8, prog: [{ root: "Db", quality: "maj7" }, { root: "Db", quality: "maj7" }, { root: "Db", quality: "maj7" }, { root: "Db", quality: "maj7" }] },
        { bars: 8, prog: [{ root: "D", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }, { root: "D", quality: "min7" }] },
        { bars: 8, prog: [{ root: "F", quality: "min7" }, { root: "F", quality: "min7" }, { root: "F", quality: "min7" }, { root: "F", quality: "min7" }] }
      ])
    }
  ];

  BALLAD_PRESETS.forEach((p) => {
    p.category = "ballad";
  });

  const PRESETS = [...BALLAD_PRESETS, ...JAZZ_PRESETS];

  window.HarmPresets = { PRESETS, BALLAD_PRESETS, JAZZ_PRESETS, buildSong, fillBars };
})();
