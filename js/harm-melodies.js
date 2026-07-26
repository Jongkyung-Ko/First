(function () {
  "use strict";

  /**
   * Harm 프리셋 원곡 멜로디 (마디·슬롯 단위)
   * - n: 음名, o: 옥타브, b: 박 시작(0~), d: 박 길이
   * - key: 멜로디 기준 조 (조 이동 시 반음 transpose)
   *
   * 저작권: 재즈 스탠더드 멜로디는 각 작곡가·출판사 권리가 있습니다.
   * 교육·개인 연습 목적의 간략 전사이며, 상업 배포 시 별도 허가가 필요할 수 있습니다.
   * 국내 가요(발라드) 프리셋은 저작권으로 원곡 멜로디를 포함하지 않습니다.
   */

  /** @param {{ n: string, o: number, b?: number, d?: number, vel?: number }[]} events */
  function bar(events) {
    return {
      events: events.map((e) => ({
        n: e.n,
        o: e.o,
        b: e.b ?? 0,
        d: e.d ?? 1,
        vel: e.vel
      }))
    };
  }

  /** @param {string[]} notes @param {number} octave */
  function qBar(notes, octave) {
    return bar(notes.map((n, i) => ({ n, o: octave, b: i, d: 0.92 })));
  }

  /** Autumn Leaves — 8마디 프레이즈 × 4 (Gm) */
  const AUTUMN_LEAVES_PHRASE = [
    qBar(["Bb", "A", "G", "F"], 4),
    bar([
      { n: "E", o: 4, b: 0, d: 1 },
      { n: "D", o: 4, b: 1, d: 1 },
      { n: "C", o: 4, b: 2, d: 1 },
      { n: "Bb", o: 3, b: 3, d: 1 }
    ]),
    qBar(["A", "G", "F", "E"], 4),
    bar([
      { n: "D", o: 4, b: 0, d: 1 },
      { n: "C", o: 4, b: 1, d: 1 },
      { n: "Bb", o: 3, b: 2, d: 1 },
      { n: "A", o: 3, b: 3, d: 1 }
    ]),
    qBar(["G", "F", "E", "D"], 4),
    bar([
      { n: "F#", o: 4, b: 0, d: 1 },
      { n: "E", o: 4, b: 1, d: 1 },
      { n: "D", o: 4, b: 2, d: 1 },
      { n: "C", o: 4, b: 3, d: 1 }
    ]),
    qBar(["Bb", "A", "G", "F"], 4),
    bar([{ n: "G", o: 4, b: 0, d: 3.8, vel: 0.85 }])
  ];

  const AUTUMN_LEAVES_ENDING = [
    ...AUTUMN_LEAVES_PHRASE.slice(0, 6),
    qBar(["G", "F", "E", "D"], 4),
    bar([
      { n: "F#", o: 4, b: 0, d: 1 },
      { n: "E", o: 4, b: 1, d: 1 },
      { n: "D", o: 4, b: 2, d: 1.5 },
      { n: "G", o: 4, b: 3.5, d: 0.5, vel: 0.75 }
    ])
  ];

  function repeatPhrase(phrase, times) {
    const out = [];
    for (let i = 0; i < times; i++) out.push(...phrase.map((s) => ({ events: s.events.map((e) => ({ ...e })) })));
    return out;
  }

  /** Fly Me to the Moon — Am, 8마디 × 4 */
  const FLY_ME_PHRASE = [
    qBar(["A", "C", "E", "A"], 4),
    qBar(["G", "B", "D", "G"], 4),
    qBar(["G", "B", "D", "F"], 4),
    qBar(["E", "G", "C", "E"], 4),
    bar([
      { n: "F", o: 4, b: 0, d: 1 },
      { n: "A", o: 4, b: 1, d: 1 },
      { n: "C", o: 5, b: 2, d: 1 },
      { n: "F", o: 5, b: 3, d: 1 }
    ]),
    bar([
      { n: "F", o: 4, b: 0, d: 1 },
      { n: "Ab", o: 4, b: 1, d: 1 },
      { n: "B", o: 4, b: 2, d: 1 },
      { n: "E", o: 5, b: 3, d: 1 }
    ]),
    bar([
      { n: "E", o: 4, b: 0, d: 1 },
      { n: "G#", o: 4, b: 1, d: 1 },
      { n: "B", o: 4, b: 2, d: 1 },
      { n: "D", o: 5, b: 3, d: 1 }
    ]),
    qBar(["A", "C", "E", "A"], 4)
  ];

  /** All of Me — C, 8마디 × 4 */
  const ALL_OF_ME_PHRASE = [
    qBar(["E", "E", "F", "G"], 4),
    qBar(["G", "G", "A", "B"], 4),
    qBar(["C", "C", "D", "E"], 5),
    qBar(["E", "D", "C", "B"], 4),
    qBar(["A", "A", "G", "F"], 4),
    qBar(["E", "E", "D", "C"], 4),
    qBar(["D", "D", "E", "F"], 4),
    bar([{ n: "G", o: 4, b: 0, d: 3.8, vel: 0.88 }])
  ];

  /** Take Five — Em, 5/4 리듬 (마디당 5음) */
  const TAKE_FIVE_PHRASE = [
    qBar(["E", "G", "B", "D", "E"], 4),
    qBar(["E", "G", "A", "B", "D"], 4),
    qBar(["B", "D", "F#", "A", "B"], 4),
    qBar(["E", "G", "B", "D", "E"], 4),
    qBar(["C", "E", "G", "B", "C"], 4),
    qBar(["C", "E", "G", "A", "B"], 4),
    qBar(["G", "B", "D", "F", "G"], 4),
    qBar(["C", "E", "G", "B", "C"], 4)
  ];

  const PRESETS = {
    "autumn-leaves": {
      key: "Gm",
      copyright: "Joseph Kosma / Johnny Mercer (1945) — 교육용 간략 전사",
      slots: [
        ...repeatPhrase(AUTUMN_LEAVES_PHRASE, 3),
        ...AUTUMN_LEAVES_ENDING.map((s) => ({ events: s.events.map((e) => ({ ...e })) }))
      ]
    },
    "fly-me-to-the-moon": {
      key: "Am",
      copyright: "Bart Howard (1954) — 교육용 간략 전사",
      slots: repeatPhrase(FLY_ME_PHRASE, 4)
    },
    "all-of-me": {
      key: "C",
      copyright: "Gerald Marks / Seymour Simons (1931) — 교육용 간략 전사",
      slots: repeatPhrase(ALL_OF_ME_PHRASE, 4)
    },
    "take-five": {
      key: "Em",
      copyright: "Paul Desmond (1959) — 교육용 간략 전사",
      slots: repeatPhrase(TAKE_FIVE_PHRASE, 5)
    }
  };

  function get(presetId) {
    return PRESETS[presetId] || null;
  }

  function has(presetId) {
    return !!PRESETS[presetId]?.slots?.length;
  }

  function listIds() {
    return Object.keys(PRESETS);
  }

  window.HarmMelodies = { PRESETS, get, has, listIds };
})();
