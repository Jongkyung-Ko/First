(function () {
  const MAX_MIXER = 10;
  const DEFAULT_MIXER_VOLUME = 70;
  const PREVIEW_MAX_SEC = 5;
  const LULLABY_PREVIEW_MAX_SEC = 90;

  const GROUPS = [
    { id: "animals", label: "동물" },
    { id: "nature", label: "자연" },
    { id: "whitenoise", label: "백색소음" },
    { id: "instruments", label: "악기" },
    { id: "synth", label: "합성" },
    { id: "lullabies", label: "자장가" }
  ];

  const SYNTH_FREQ_MIN = 80;
  const SYNTH_FREQ_MAX = 50000;
  const SYNTH_CUTOFF_MIN = 120;
  const SYNTH_CUTOFF_MAX = 20000;
  const SYNTH_BAR_COUNT = 16;
  const DEFAULT_SYNTH = {
    frequency: 440,
    waveform: "sine",
    cutoff: 2200,
    resonance: 6,
    vibrato: 0.02,
    volumeCycle: 1
  };

  const SYNTH_VOLUME_CYCLE_MIN = 0.01;
  const SYNTH_VOLUME_CYCLE_MAX = 3;
  const SYNTH_PANEL_VERSION = "6";

  const SYNTH_PRESET_GROUPS = [
    { id: "human", label: "사람이 듣기 좋은" },
    { id: "animal", label: "동물 가청" }
  ];

  /** @type {{ id: string, group: string, label: string, frequency: number, waveform: string, cutoff: number, resonance: number, vibrato: number, volumeCycle: number }[]} */
  const SYNTH_PRESETS = [
    {
      id: "human-warm-bass",
      group: "human",
      label: "따뜻한 저음 256Hz",
      frequency: 256,
      waveform: "sine",
      cutoff: 1200,
      resonance: 3,
      vibrato: 0,
      volumeCycle: 1
    },
    {
      id: "human-a4",
      group: "human",
      label: "표준 라(A4) 440Hz",
      frequency: 440,
      waveform: "sine",
      cutoff: 4000,
      resonance: 4,
      vibrato: 0.01,
      volumeCycle: 1
    },
    {
      id: "human-alt432",
      group: "human",
      label: "자연 톤 432Hz",
      frequency: 432,
      waveform: "sine",
      cutoff: 3500,
      resonance: 3.5,
      vibrato: 0.008,
      volumeCycle: 1.2
    },
    {
      id: "human-mid-voice",
      group: "human",
      label: "중역 음색 880Hz",
      frequency: 880,
      waveform: "triangle",
      cutoff: 2800,
      resonance: 5,
      vibrato: 0.015,
      volumeCycle: 1
    },
    {
      id: "human-soft-pad",
      group: "human",
      label: "부드러운 패드 523Hz",
      frequency: 523,
      waveform: "sine",
      cutoff: 1800,
      resonance: 6,
      vibrato: 0.03,
      volumeCycle: 2
    },
    {
      id: "human-bright",
      group: "human",
      label: "맑은 고음 1760Hz",
      frequency: 1760,
      waveform: "sine",
      cutoff: 6000,
      resonance: 4,
      vibrato: 0.012,
      volumeCycle: 1
    },
    {
      id: "human-bell",
      group: "human",
      label: "종소리 1047Hz",
      frequency: 1047,
      waveform: "triangle",
      cutoff: 5000,
      resonance: 8,
      vibrato: 0.02,
      volumeCycle: 1.5
    },
    {
      id: "human-stable",
      group: "human",
      label: "안정감 중저음 330Hz",
      frequency: 330,
      waveform: "sine",
      cutoff: 1500,
      resonance: 4,
      vibrato: 0,
      volumeCycle: 1
    },
    {
      id: "animal-dog-whistle",
      group: "animal",
      label: "개 휘파람 18kHz",
      frequency: 18000,
      waveform: "sine",
      cutoff: 20000,
      resonance: 3,
      vibrato: 0,
      volumeCycle: 0.2
    },
    {
      id: "animal-cat-call",
      group: "animal",
      label: "고양이 초음파 22kHz",
      frequency: 22000,
      waveform: "sine",
      cutoff: 24000,
      resonance: 4,
      vibrato: 0.01,
      volumeCycle: 0.35
    },
    {
      id: "animal-bird-chirp",
      group: "animal",
      label: "새 지저귐 3.2kHz",
      frequency: 3200,
      waveform: "sawtooth",
      cutoff: 8000,
      resonance: 7,
      vibrato: 0.05,
      volumeCycle: 0.12
    },
    {
      id: "animal-mouse-ultra",
      group: "animal",
      label: "쥐 초음파 38kHz",
      frequency: 38000,
      waveform: "pulse",
      cutoff: 42000,
      resonance: 3,
      vibrato: 0,
      volumeCycle: 0.08
    },
    {
      id: "animal-horse-alert",
      group: "animal",
      label: "말 경계음 7kHz",
      frequency: 7000,
      waveform: "square",
      cutoff: 12000,
      resonance: 6,
      vibrato: 0.02,
      volumeCycle: 0.5
    },
    {
      id: "animal-cow-low",
      group: "animal",
      label: "소 저음 울음 120Hz",
      frequency: 120,
      waveform: "sine",
      cutoff: 400,
      resonance: 3,
      vibrato: 0.01,
      volumeCycle: 1.8
    },
    {
      id: "animal-pig-call",
      group: "animal",
      label: "돼지 호출 550Hz",
      frequency: 550,
      waveform: "triangle",
      cutoff: 2200,
      resonance: 5,
      vibrato: 0.025,
      volumeCycle: 0.6
    },
    {
      id: "animal-rabbit-alert",
      group: "animal",
      label: "토끼 경보 11kHz",
      frequency: 11000,
      waveform: "sine",
      cutoff: 15000,
      resonance: 5,
      vibrato: 0,
      volumeCycle: 0.25
    },
    {
      id: "animal-chicken",
      group: "animal",
      label: "닭 울음 900Hz",
      frequency: 900,
      waveform: "sawtooth",
      cutoff: 2500,
      resonance: 6,
      vibrato: 0.04,
      volumeCycle: 0.3
    },
    {
      id: "animal-frog",
      group: "animal",
      label: "개구리 울음 750Hz",
      frequency: 750,
      waveform: "triangle",
      cutoff: 3000,
      resonance: 7,
      vibrato: 0.06,
      volumeCycle: 0.8
    },
    {
      id: "animal-bee",
      group: "animal",
      label: "벌 날개 260Hz",
      frequency: 260,
      waveform: "pulse",
      cutoff: 800,
      resonance: 4,
      vibrato: 0,
      volumeCycle: 0.05
    }
  ];

  /** @type {{ id: string, label: string, min: number, max: number, note: string }[]} */
  const HEARING_GUIDE = [
    {
      id: "human",
      label: "사람",
      min: 20,
      max: 20000,
      note: "음성·음악의 대부분을 인지합니다. 12kHz 이상 고음은 나이가 들수록 잘 들리지 않습니다."
    },
    {
      id: "dog",
      label: "개",
      min: 40,
      max: 60000,
      note: "초음파 휘파람·훈련용 초음파 기기에 반응합니다. 사람보다 훨씬 높은 소리를 구분합니다."
    },
    {
      id: "cat",
      label: "고양이",
      min: 48,
      max: 85000,
      note: "쥐·새 등 먹이의 고주파 소리를 잘 포착합니다. 초음파 영역의 신호에도 민감합니다."
    },
    {
      id: "bird",
      label: "새",
      min: 250,
      max: 12000,
      note: "짝짓기·영역·경고 울음에 쓰입니다. 종마다 잘 듣는 대역이 크게 다릅니다."
    },
    {
      id: "mouse",
      label: "쥐",
      min: 1000,
      max: 90000,
      note: "초음파로 위험과 짝을 알립니다. 사람 귀로는 거의 들리지 않는 대역을 씁니다."
    },
    {
      id: "horse",
      label: "말",
      min: 55,
      max: 33000,
      note: "경계·불안 신호에 민감합니다. 넓은 주파수 대역으로 주변 변화를 감지합니다."
    },
    {
      id: "cow",
      label: "소",
      min: 23,
      max: 35000,
      note: "울음·저음 떨림을 잘 감지합니다. 넓은 범위의 환경 소리에 반응합니다."
    },
    {
      id: "pig",
      label: "돼지",
      min: 42,
      max: 40000,
      note: "먹이·동료 호출 등 다양한 소리를 구분합니다. 스트레스 유발 고음에도 민감할 수 있습니다."
    },
    {
      id: "rabbit",
      label: "토끼",
      min: 360,
      max: 42000,
      note: "발소리·이상 징후를 멀리서도 감지합니다. 갑작스러운 고음에 놀라기 쉽습니다."
    },
    {
      id: "chicken",
      label: "닭",
      min: 125,
      max: 2000,
      note: "울음·경계 소리 중심으로 소통합니다. 사람 음성과 비슷한 중저음 대역에 집중합니다."
    },
    {
      id: "frog",
      label: "개구리",
      min: 50,
      max: 4000,
      note: "짝짓기 울음·영역 신호에 쓰입니다. 연못·비 오는 날 소리에 잘 반응합니다."
    },
    {
      id: "bee",
      label: "벌",
      min: 200,
      max: 500,
      note: "날개 진동(약 200~300Hz)으로 소통합니다. 음 높이보다 진동 패턴이 더 중요합니다."
    }
  ];

  const SYNTH_WAVEFORMS = [
    { id: "sine", label: "정현파", type: "sine" },
    { id: "square", label: "구형파", type: "square" },
    { id: "pulse", label: "펄스파", custom: "pulse" },
    { id: "sawtooth", label: "톱니파", type: "sawtooth" },
    { id: "triangle", label: "삼각파", type: "triangle" }
  ];

  const ANIMALS = [
    ["dog", "개"],
    ["cat", "고양이"],
    ["cow", "소"],
    ["sheep", "양"],
    ["pig", "돼지"],
    ["horse", "말"],
    ["chicken", "닭"],
    ["duck", "오리"],
    ["bird", "새"],
    ["bee", "벌"],
    ["frog", "개구리"],
    ["elephant", "코끼리"],
    ["wolf", "늑대"],
    ["owl", "올빼미"],
    ["crow", "까마귀"],
    ["mouse", "쥐"],
    ["goat", "염소"],
    ["donkey", "당나귀"],
    ["robin", "울새"],
    ["penguin", "펭귄"]
  ];

  const NATURE = [
    ["wind", "바람"],
    ["stream", "시냇물"],
    ["waves", "파도"],
    ["rain", "비"],
    ["thunder", "천둥"],
    ["waterfall", "폭포"],
    ["forest", "숲"],
    ["cricket", "귀뚜라미"],
    ["campfire", "모닥불"],
    ["blizzard", "눈보라"],
    ["lake", "호수"],
    ["creek", "개울"],
    ["dawn", "새벽"],
    ["night", "밤"],
    ["gust", "돌풍"],
    ["beach", "해변"],
    ["cave", "동굴"],
    ["storm", "폭우"],
    ["mist", "안개"],
    ["river", "강물"]
  ];

  const WHITENOISE = [
    ["white", "화이트"],
    ["pink", "핑크"],
    ["brown", "브라운"],
    ["blue", "블루"],
    ["violet", "바이올렛"],
    ["band-125", "125 Hz"],
    ["band-250", "250 Hz"],
    ["band-500", "500 Hz"],
    ["band-1k", "1 kHz"],
    ["band-2k", "2 kHz"],
    ["band-4k", "4 kHz"],
    ["band-8k", "8 kHz"],
    ["tv", "TV 잡음"],
    ["radio", "라디오"],
    ["fan", "선풍기"],
    ["ac", "에어컨"],
    ["vacuum", "청소기"],
    ["hum", "전기 험"],
    ["deep", "저역 험"],
    ["hiss", "고역 쉬"]
  ];

  const INSTRUMENTS = [
    ["piano", "피아노"],
    ["guitar", "기타"],
    ["violin", "바이올린"],
    ["flute", "플루트"],
    ["drums", "드럼"],
    ["harp", "하프"],
    ["trumpet", "트럼펫"],
    ["sax", "색소폰"],
    ["xylophone", "실로폰"],
    ["organ", "오르골"]
  ];

  const LULLABIES = [
    ["sleepy-piano", "잠든 업라이트 피아노"],
    ["light-piano-loop", "라이트 피아노 루프"],
    ["soft-piano-lullaby", "부드러운 피아노 자장가"],
    ["dreaming-piano", "드리밍 피아노"],
    ["memories-piano", "추억 피아노"],
    ["happy-thoughts-piano", "행복한 생각 피아노"],
    ["piano-lullaby", "피아노 자장가"],
    ["bittersweet-bells", "쓸쓸한 종 벨"],
    ["twinkle-piano", "반짝 피아노"],
    ["brahms-music-box", "브람스 오르골 상자"],
    ["brahms-box-field", "브람스 오르골 (현장)"],
    ["brahms-box-close", "브람스 자장가 오르골"],
    ["musicbox-clip", "오르골 자장가 클립"],
    ["musicbox-gentle-1", "오르골 자장가 1"],
    ["musicbox-gentle-2", "오르골 자장가 2"],
    ["musicbox-soft", "부드러운 오르골"],
    ["musicbox-vintage", "빈티지 뮤직박스"],
    ["all-night-all-day", "올 나이트 올 데이"],
    ["berceuse-piano", "베르장스 (자장가)"],
    ["mystic-musicbox", "몽환적 오르골"]
  ];

  const CATALOG = {
    animals: ANIMALS,
    nature: NATURE,
    whitenoise: WHITENOISE,
    instruments: INSTRUMENTS,
    lullabies: LULLABIES
  };

  const SAMPLE_FILES = {
    animals: {
      dog: "dog.mp3",
      cat: "cat.mp3",
      cow: "cow.mp3",
      sheep: "sheep.mp3",
      pig: "pig.mp3",
      horse: "horse.mp3",
      chicken: "chicken.mp3",
      duck: "duck.mp3",
      bird: "bird.mp3",
      bee: "bee.mp3",
      frog: "frog.mp3",
      elephant: "elephant.wav",
      wolf: "wolf.mp3",
      owl: "owl.mp3",
      crow: "crow.mp3",
      eagle: "crow.mp3",
      mouse: "mouse-real.mp3",
      goat: "goat.mp3",
      donkey: "donkey.mp3",
      robin: "robin.mp3",
      penguin: "penguin.ogg"
    },
    nature: {
      wind: "wind.mp3",
      stream: "stream.mp3",
      waves: "waves.mp3",
      rain: "rain.mp3",
      thunder: "thunder.mp3",
      waterfall: "waterfall.mp3",
      forest: "forest.mp3",
      cricket: "cricket.mp3",
      campfire: "campfire.mp3",
      blizzard: "blizzard.mp3",
      lake: "lake.mp3",
      creek: "creek.mp3",
      dawn: "dawn.mp3",
      night: "night.mp3",
      gust: "gust.mp3",
      beach: "beach.mp3",
      cave: "cave.mp3",
      storm: "storm.mp3",
      mist: "mist.mp3",
      river: "river.mp3"
    },
    instruments: {
      piano: "piano.wav",
      guitar: "guitar.mp3",
      violin: "violin.mp3",
      flute: "flute.wav",
      drums: "drums.mp3",
      harp: "harp.wav",
      trumpet: "trumpet.mp3",
      sax: "sax.wav",
      xylophone: "xylophone.mp3",
      organ: "organ.mp3"
    },
    lullabies: {
      "sleepy-piano": "sleepy-piano.mp3",
      "light-piano-loop": "light-piano-loop.mp3",
      "soft-piano-lullaby": "soft-piano-lullaby.mp3",
      "dreaming-piano": "dreaming-piano.mp3",
      "memories-piano": "memories-piano.mp3",
      "happy-thoughts-piano": "happy-thoughts-piano.mp3",
      "piano-lullaby": "piano-lullaby.mp3",
      "bittersweet-bells": "bittersweet-bells.mp3",
      "twinkle-piano": "twinkle-piano.mp3",
      "brahms-music-box": "brahms-music-box.mp3",
      "brahms-box-field": "brahms-box-field.mp3",
      "brahms-box-close": "brahms-box-close.mp3",
      "musicbox-clip": "musicbox-clip.mp3",
      "musicbox-gentle-1": "musicbox-gentle-1.mp3",
      "musicbox-gentle-2": "musicbox-gentle-2.mp3",
      "musicbox-soft": "musicbox-soft.mp3",
      "musicbox-vintage": "musicbox-vintage.mp3",
      "all-night-all-day": "all-night-all-day.mp3",
      "berceuse-piano": "berceuse-piano.mp3",
      "mystic-musicbox": "mystic-musicbox.mp3"
    }
  };

  const BAND_HZ = {
    "band-125": 125,
    "band-250": 250,
    "band-500": 500,
    "band-1k": 1000,
    "band-2k": 2000,
    "band-4k": 4000,
    "band-8k": 8000
  };

  const NOISE_PRESETS = {
    tv: [2200, 0.8, 0.18],
    radio: [1400, 1.2, 0.16],
    fan: [400, 0.5, 0.2],
    ac: [180, 0.7, 0.14],
    vacuum: [320, 0.6, 0.22],
    hum: [60, 0.8, 0.2],
    deep: [45, 0.9, 0.22],
    hiss: [5000, 1.5, 0.15]
  };

  let ac = null;
  let masterGain = null;
  let analyser = null;
  let freqData = null;
  let timeData = null;
  let activePreviewLoops = [];
  let activeSampleSource = null;
  let cricketPreviewTimer = null;
  let previewLimitTimer = null;
  const sampleCache = new Map();
  let activeGroup = "animals";
  let selectedId = null;
  let pageRoot = null;
  let mixerUid = 0;
  /** @type {{ uid: number, group: string, soundId: string, label: string, volume: number, gainNode: GainNode, stop: () => void }[]} */
  let mixerLayers = [];
  let synthParams = { ...DEFAULT_SYNTH };
  let activeSynthPreset = "";
  let activeSynthStop = null;
  let synthPreviewDebounce = null;
  let vizRaf = null;
  let vizType = "bars";
  let vizParticles = [];
  let vizSparks = [];
  let vizWaterfallHistory = [];
  let vizRadarAngle = 0;
  let lastDreamyVizType = null;
  let vizImmersive = false;
  let vizFsKeyHandler = null;

  const VIZ_TYPES_BASIC = [
    { id: "bars", label: "막대" },
    { id: "wave", label: "파형" },
    { id: "circle", label: "원형" },
    { id: "line", label: "라인" },
    { id: "mirror", label: "미러" },
    { id: "radar", label: "레이더" },
    { id: "waterfall", label: "워터폴" }
  ];

  const VIZ_TYPES_DREAMY = [
    { id: "aurora", label: "오로라" },
    { id: "stardust", label: "별빛" },
    { id: "bloom", label: "블룸" },
    { id: "dream", label: "몽환" },
    { id: "galaxy", label: "은하" },
    { id: "nebula", label: "네뷸라" },
    { id: "fireworks", label: "불꽃" }
  ];

  const VIZ_TYPES = [...VIZ_TYPES_BASIC, ...VIZ_TYPES_DREAMY];
  const DREAMY_VIZ = new Set(VIZ_TYPES_DREAMY.map((t) => t.id));
  const VIZ_STORAGE_KEY = "sound-viz-type";
  const MASTER_VOLUME_STORAGE_KEY = "sound-master-volume";

  let masterVolume = loadMasterVolume();
  let mixerPaused = false;
  let miniVolumeOpen = false;
  let globalBarEnabled = true;
  let miniPlayerEl = null;
  let miniPlayerBound = false;
  let miniVizRaf = null;

  function loadMasterVolume() {
    try {
      const v = parseFloat(localStorage.getItem(MASTER_VOLUME_STORAGE_KEY));
      if (Number.isFinite(v)) return Math.min(1, Math.max(0, v));
    } catch (_) {
      /* ignore */
    }
    return 0.85;
  }

  function applyMasterVolume(vol) {
    masterVolume = Math.min(1, Math.max(0, vol));
    if (masterGain) masterGain.gain.value = masterVolume;
    try {
      localStorage.setItem(MASTER_VOLUME_STORAGE_KEY, String(masterVolume));
    } catch (_) {
      /* ignore */
    }
    syncMiniVolumeUi();
  }

  function volumeIcon() {
    if (masterVolume <= 0.001) return "🔇";
    if (masterVolume < 0.45) return "🔉";
    return "🔊";
  }

  function isMixerPlaying() {
    return mixerLayers.length > 0 && !mixerPaused;
  }

  function shouldShowMiniPlayer() {
    return globalBarEnabled && mixerLayers.length > 0 && !pageRoot;
  }

  function mixerSummaryLabel() {
    if (!mixerLayers.length) return "";
    if (mixerLayers.length === 1) return mixerLayers[0].label;
    return `믹서 ${mixerLayers.length}개 소리`;
  }

  function pauseMixer() {
    if (!mixerLayers.length || mixerPaused) return;
    mixerPaused = true;
    mixerLayers.forEach((layer) => {
      layer._pausedGain = layer.gainNode.gain.value;
      layer.gainNode.gain.value = 0;
    });
    updateMiniPlayerUi();
  }

  function resumeMixer() {
    if (!mixerLayers.length) return;
    mixerPaused = false;
    mixerLayers.forEach((layer) => {
      const vol = layer._pausedGain ?? (layer.volume / 100) * 0.85;
      layer.gainNode.gain.value = vol;
      delete layer._pausedGain;
    });
    void unlock();
    updateMiniPlayerUi();
  }

  function assetBase() {
    if (location.protocol === "file:") return "./";
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function sampleUrl(group, id) {
    const file = SAMPLE_FILES[group]?.[id];
    if (!file) return null;
    return assetBase() + "assets/audio/sfx/" + group + "/" + file;
  }

  function getLabel(group, id) {
    if (group === "synth") return formatSynthLabel(synthParams);
    const items = CATALOG[group] || [];
    const found = items.find(([sid]) => sid === id);
    const groupLabel = GROUPS.find((g) => g.id === group)?.label || group;
    return found ? `${found[1]} · ${groupLabel}` : id;
  }

  function formatSynthLabel(params) {
    const hz = Math.round(params?.frequency ?? DEFAULT_SYNTH.frequency);
    const wave =
      SYNTH_WAVEFORMS.find((w) => w.id === params?.waveform)?.label ||
      SYNTH_WAVEFORMS[0].label;
    return `합성 ${hz}Hz · ${wave}`;
  }

  function clampSynthParams(p) {
    const waveform = SYNTH_WAVEFORMS.some((w) => w.id === p.waveform)
      ? p.waveform
      : DEFAULT_SYNTH.waveform;
    return {
      frequency: Math.min(SYNTH_FREQ_MAX, Math.max(SYNTH_FREQ_MIN, p.frequency)),
      waveform,
      cutoff: Math.min(SYNTH_CUTOFF_MAX, Math.max(SYNTH_CUTOFF_MIN, p.cutoff)),
      resonance: Math.min(20, Math.max(0.3, p.resonance)),
      vibrato: Math.min(0.1, Math.max(0, p.vibrato)),
      volumeCycle: Math.min(
        SYNTH_VOLUME_CYCLE_MAX,
        Math.max(SYNTH_VOLUME_CYCLE_MIN, p.volumeCycle ?? DEFAULT_SYNTH.volumeCycle)
      )
    };
  }

  function renderSynthPresetOptionsHtml() {
    const groups = SYNTH_PRESET_GROUPS.map((group) => {
      const items = SYNTH_PRESETS.filter((preset) => preset.group === group.id);
      if (!items.length) return "";
      return `<optgroup label="${escapeHtml(group.label)}">${items
        .map(
          (preset) =>
            `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</option>`
        )
        .join("")}</optgroup>`;
    }).join("");
    return `<option value="">직접 조절</option>${groups}`;
  }

  function applySynthPreset(presetId) {
    const preset = SYNTH_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    activeSynthPreset = presetId;
    synthParams = clampSynthParams({
      frequency: preset.frequency,
      waveform: preset.waveform,
      cutoff: preset.cutoff,
      resonance: preset.resonance,
      vibrato: preset.vibrato,
      volumeCycle: preset.volumeCycle
    });
    if (activeGroup !== "synth" || !pageRoot) return;
    updateSynthUi();
    queueSynthPreview();
    updateAddButton();
  }

  function formatHearingRange(min, max) {
    return `${min.toLocaleString("ko-KR")} ~ ${max.toLocaleString("ko-KR")} Hz`;
  }

  function renderHearingGuideHtml() {
    return `
      <section class="sound-hearing-guide" aria-label="생물별 가청 주파수">
        <h3 class="sound-hearing-title">생물별 가청 주파수</h3>
        <p class="sound-hearing-intro">
          주변 동물은 사람과 다른 주파수 대역을 잘 듣습니다. 합성 주파수를 조절할 때 참고하세요.
          약 20kHz 이상은 사람 귀로 거의 들리지 않으며, 스피커·청력 한계로 실제 재생이 제한될 수 있습니다.
        </p>
        <ul class="sound-hearing-list">
          ${HEARING_GUIDE.map(
            (item) => `
            <li class="sound-hearing-item">
              <div class="sound-hearing-item-head">
                <strong class="sound-hearing-label">${escapeHtml(item.label)}</strong>
                <span class="sound-hearing-range">${escapeHtml(formatHearingRange(item.min, item.max))}</span>
              </div>
              <p class="sound-hearing-note">${escapeHtml(item.note)}</p>
            </li>
          `
          ).join("")}
        </ul>
      </section>
    `;
  }

  function formatVolumeCycle(sec) {
    const rounded = Math.round(sec * 100) / 100;
    const text = Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return `${text}초`;
  }

  function configureOscillator(osc, ctx, waveformId) {
    const meta = SYNTH_WAVEFORMS.find((w) => w.id === waveformId) || SYNTH_WAVEFORMS[0];
    if (meta.custom === "pulse") {
      const duty = 0.125;
      const harmonics = 64;
      const real = new Float32Array(harmonics);
      const imag = new Float32Array(harmonics);
      for (let i = 1; i < harmonics; i++) {
        real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
      }
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
      return;
    }
    osc.type = meta.type || "sine";
  }

  function freqFromChartT(t) {
    const clamped = Math.min(1, Math.max(0, t));
    return SYNTH_FREQ_MIN * Math.pow(SYNTH_FREQ_MAX / SYNTH_FREQ_MIN, clamped);
  }

  function chartTFromFreq(freq) {
    const f = Math.min(SYNTH_FREQ_MAX, Math.max(SYNTH_FREQ_MIN, freq));
    return Math.log(f / SYNTH_FREQ_MIN) / Math.log(SYNTH_FREQ_MAX / SYNTH_FREQ_MIN);
  }

  function barSpectrumHeight(barIndex, freq) {
    const barT = barIndex / (SYNTH_BAR_COUNT - 1);
    const activeT = chartTFromFreq(freq);
    const dist = Math.abs(barT - activeT);
    const peak = Math.max(0, 1 - dist * 5.5);
    const harmonic =
      Math.max(0, 1 - Math.abs(barT - Math.min(1, activeT * 1.35 + 0.05)) * 8) * 0.35;
    return 0.12 + (peak + harmonic) * 0.88;
  }

  function stopSynthPreview() {
    if (activeSynthStop) {
      try {
        activeSynthStop();
      } catch (_) {
        /* ignore */
      }
      activeSynthStop = null;
    }
  }

  function connectSynthVoice(params, destGain) {
    const p = clampSynthParams(params);
    const ctx = ensure();
    const osc = ctx.createOscillator();
    configureOscillator(osc, ctx, p.waveform);
    osc.frequency.value = p.frequency;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = p.cutoff;
    filter.Q.value = p.resonance;

    const vibratoOsc = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibratoOsc.frequency.value = 5.2;
    vibratoGain.gain.value = p.frequency * p.vibrato;
    vibratoOsc.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.3;

    const tremoloOsc = ctx.createOscillator();
    tremoloOsc.type = "sine";
    tremoloOsc.frequency.value = 1 / p.volumeCycle;
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = 0.22;
    tremoloOsc.connect(tremoloDepth);
    tremoloDepth.connect(voiceGain.gain);

    osc.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(destGain);

    osc.start();
    vibratoOsc.start();
    tremoloOsc.start();

    return () => {
      try {
        osc.stop();
        vibratoOsc.stop();
        tremoloOsc.stop();
      } catch (_) {
        /* ignore */
      }
      [osc, filter, vibratoOsc, vibratoGain, tremoloOsc, tremoloDepth, voiceGain].forEach((node) => {
        try {
          node.disconnect();
        } catch (_) {
          /* ignore */
        }
      });
    };
  }

  function playSynthPreview() {
    stopPreview();
    void unlock().then(() => {
      activeSynthStop = connectSynthVoice(synthParams, masterGain);
      schedulePreviewLimit();
    });
  }

  function queueSynthPreview() {
    if (synthPreviewDebounce) clearTimeout(synthPreviewDebounce);
    synthPreviewDebounce = setTimeout(() => {
      synthPreviewDebounce = null;
      if (activeGroup !== "synth") return;
      playSynthPreview();
    }, 160);
  }

  function applySynthParams(next) {
    activeSynthPreset = "";
    synthParams = clampSynthParams({ ...synthParams, ...next });
    if (activeGroup !== "synth" || !pageRoot) return;
    updateSynthUi();
    queueSynthPreview();
    updateAddButton();
  }

  function ensure() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ac.createGain();
      masterGain.gain.value = masterVolume;
      analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      masterGain.connect(analyser);
      analyser.connect(ac.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);
    }
    if (ac.state === "suspended") void ac.resume();
    return ac;
  }

  function isAudioActive() {
    const mixerActive = mixerLayers.length > 0 && !mixerPaused;
    return (
      mixerActive ||
      !!activeSampleSource ||
      activePreviewLoops.length > 0 ||
      !!activeSynthStop ||
      !!cricketPreviewTimer
    );
  }

  function resetVizDreamState() {
    vizParticles = [];
    vizSparks = [];
    vizWaterfallHistory = [];
    vizRadarAngle = 0;
    lastDreamyVizType = null;
  }

  function vizBassLevel(active) {
    if (!active || !freqData) return 0.12;
    let sum = 0;
    const n = Math.min(10, freqData.length);
    for (let i = 0; i < n; i++) sum += freqData[i];
    return sum / (n * 255);
  }

  function vizBinLevel(idx, active, fallback = 0.1) {
    if (!active || !freqData || !freqData.length) {
      return fallback + Math.sin(performance.now() * 0.002 + idx) * 0.04;
    }
    const i = Math.min(freqData.length - 1, Math.max(0, idx));
    return freqData[i] / 255;
  }

  function vizFadeFrame(ctx, w, h, alpha = 0.1) {
    ctx.fillStyle = `rgba(2, 6, 23, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
  }

  function renderVizTypesHtml() {
    const btn = (t, dreamy) =>
      `<button type="button" class="sound-viz-type-btn${dreamy ? " is-dreamy" : ""}" data-viz-type="${t.id}" role="tab">${escapeHtml(t.label)}</button>`;
    return `
      <div class="sound-viz-type-group">
        <span class="sound-viz-type-group-label">기본</span>
        <div class="sound-viz-types-row">${VIZ_TYPES_BASIC.map((t) => btn(t, false)).join("")}</div>
      </div>
      <div class="sound-viz-type-group">
        <span class="sound-viz-type-group-label">몽환</span>
        <div class="sound-viz-types-row">${VIZ_TYPES_DREAMY.map((t) => btn(t, true)).join("")}</div>
      </div>
    `;
  }

  function stopVisualizerLoop() {
    if (vizRaf) {
      cancelAnimationFrame(vizRaf);
      vizRaf = null;
    }
  }

  function startVisualizerLoop() {
    stopVisualizerLoop();
    const tick = () => {
      vizRaf = requestAnimationFrame(tick);
      drawVisualizerFrame();
    };
    tick();
  }

  function drawVisualizerIdle(ctx, w, h) {
    const t = performance.now() * 0.001;
    ctx.strokeStyle = "rgba(71, 85, 105, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 2) {
      const y = h / 2 + Math.sin(x * 0.04 + t * 2) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawVizBars(ctx, w, h, active) {
    const bars = 48;
    const gap = 2;
    const barW = (w - gap * (bars - 1)) / bars;
    const binCount = freqData?.length ?? 128;
    const use = Math.floor(binCount * 0.7);
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * use);
      const v = active && freqData ? freqData[idx] / 255 : 0.06 + Math.sin(i * 0.35 + performance.now() * 0.002) * 0.02;
      const bh = Math.max(3, v * h * 0.92);
      const x = i * (barW + gap);
      const y = h - bh;
      const grad = ctx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, "#93c5fd");
      grad.addColorStop(1, "#2563eb");
      ctx.fillStyle = active ? grad : "rgba(51, 65, 85, 0.65)";
      ctx.fillRect(x, y, barW, bh);
    }
  }

  function drawVizWave(ctx, w, h, active) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? "#60a5fa" : "rgba(71, 85, 105, 0.55)";
    ctx.beginPath();
    const slice = w / (active && timeData ? timeData.length : 120);
    for (let i = 0; i < (active && timeData ? timeData.length : 120); i++) {
      const v = active && timeData ? (timeData[i] - 128) / 128 : Math.sin(i * 0.12 + performance.now() * 0.003) * 0.15;
      const x = i * slice;
      const y = h / 2 + v * (h * 0.38);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawVizCircle(ctx, w, h, active) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.28;
    const bars = 64;
    const binCount = freqData?.length ?? 128;
    const use = Math.floor(binCount * 0.75);
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * use);
      const v = active && freqData ? freqData[idx] / 255 : 0.08;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const len = radius * 0.25 + v * radius * 0.75;
      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + len);
      const y2 = cy + Math.sin(angle) * (radius + len);
      ctx.strokeStyle = active ? `rgba(96, 165, 250, ${0.35 + v * 0.65})` : "rgba(71, 85, 105, 0.45)";
      ctx.lineWidth = active ? 2 + v * 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  function drawVizLine(ctx, w, h, active) {
    const points = 96;
    const binCount = freqData?.length ?? 128;
    const use = Math.max(2, Math.floor(binCount * 0.8));
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#60a5fa";
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const idx = Math.floor((i / (points - 1)) * (use - 1));
      const v = active && freqData ? freqData[idx] / 255 : 0.05;
      const x = (i / (points - 1)) * w;
      const y = h - 4 - v * (h - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (active) {
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, 0, 0, h);
      fill.addColorStop(0, "rgba(37, 99, 235, 0.35)");
      fill.addColorStop(1, "rgba(37, 99, 235, 0)");
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  function drawVizMirror(ctx, w, h, active) {
    const bars = 40;
    const gap = 2;
    const barW = (w - gap * (bars - 1)) / bars;
    const mid = h / 2;
    const binCount = freqData?.length ?? 128;
    const use = Math.floor(binCount * 0.65);
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * use);
      const v = active && freqData ? freqData[idx] / 255 : 0.05;
      const bh = Math.max(2, v * mid * 0.92);
      const x = i * (barW + gap);
      ctx.fillStyle = active ? "rgba(96, 165, 250, 0.85)" : "rgba(51, 65, 85, 0.55)";
      ctx.fillRect(x, mid - bh, barW, bh);
      ctx.fillRect(x, mid, barW, bh);
    }
    ctx.strokeStyle = "rgba(71, 85, 105, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
  }

  function drawVizRadar(ctx, w, h, active) {
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.46;
    const bass = vizBassLevel(active);
    vizRadarAngle = (vizRadarAngle + 0.018 + bass * 0.035) % (Math.PI * 2);

    for (let r = 1; r <= 4; r++) {
      ctx.strokeStyle = "rgba(71, 85, 105, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, (maxR * r) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.stroke();
    }

    const bins = 52;
    for (let i = 0; i < bins; i++) {
      const v = vizBinLevel(i, active, 0.08);
      if (v < 0.1) continue;
      const angle = (i / bins) * Math.PI * 2 - Math.PI / 2;
      const dist = maxR * (0.18 + v * 0.78);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(96, 165, 250, ${0.25 + v * 0.75})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + v * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const sweep = vizRadarAngle - Math.PI / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    grad.addColorStop(0, "rgba(96, 165, 250, 0)");
    grad.addColorStop(1, "rgba(96, 165, 250, 0.18)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, sweep - 0.55, sweep + 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(147, 197, 253, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * maxR, cy + Math.sin(sweep) * maxR);
    ctx.stroke();
  }

  function drawVizWaterfall(ctx, w, h, active) {
    const rows = 36;
    const newCol = new Float32Array(rows);
    for (let i = 0; i < rows; i++) {
      const idx = Math.floor((i / rows) * (freqData?.length ?? 64) * 0.82);
      newCol[i] = vizBinLevel(idx, active, 0.05);
    }
    vizWaterfallHistory.push(newCol);
    const maxCols = Math.max(1, Math.ceil(w));
    while (vizWaterfallHistory.length > maxCols) vizWaterfallHistory.shift();

    const colW = w / maxCols;
    const rowH = h / rows;
    const startX = w - vizWaterfallHistory.length * colW;
    vizWaterfallHistory.forEach((col, xi) => {
      for (let yi = 0; yi < rows; yi++) {
        const v = col[rows - 1 - yi];
        const lightness = 28 + v * 52;
        ctx.fillStyle = `hsla(${215 + v * 45}, 82%, ${lightness}%, ${0.35 + v * 0.65})`;
        ctx.fillRect(startX + xi * colW, yi * rowH, colW + 0.5, rowH + 0.5);
      }
    });
  }

  function drawVizAurora(ctx, w, h, active) {
    const t = performance.now() * 0.001;
    const bass = vizBassLevel(active);
    const bands = 5;
    for (let b = 0; b < bands; b++) {
      const hue = (220 + b * 42 + t * 14) % 360;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const bin = Math.floor((x / w) * (freqData?.length ?? 64) * 0.65);
        const v = vizBinLevel(bin, active, 0.18);
        const y =
          h * (0.28 + b * 0.11) +
          Math.sin(x * 0.011 + t * (0.7 + b * 0.12) + b * 1.7) * (14 + v * h * 0.24 + bass * 28);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `hsla(${hue}, 88%, 70%, 0)`);
      grad.addColorStop(0.45, `hsla(${hue}, 92%, 74%, ${0.32 + bass * 0.35})`);
      grad.addColorStop(1, `hsla(${(hue + 50) % 360}, 88%, 70%, 0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5 + bass * 3.5;
      ctx.shadowBlur = 14;
      ctx.shadowColor = `hsla(${hue}, 100%, 72%, 0.55)`;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawVizStardust(ctx, w, h, active) {
    const bass = vizBassLevel(active);
    const spawnRate = active ? 0.18 + bass * 0.55 : 0.04;
    while (vizParticles.length < 120 && Math.random() < spawnRate) {
      vizParticles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        life: 0.65 + Math.random() * 0.35,
        hue: (250 + Math.random() * 90) % 360,
        size: 1 + Math.random() * 2 + bass * 2.5
      });
    }
    if (vizParticles.length > 150) vizParticles.splice(0, vizParticles.length - 150);

    const next = [];
    for (const p of vizParticles) {
      if (active && freqData) {
        const push = vizBinLevel(Math.floor(Math.random() * 12), true) * 0.12;
        p.vx += (Math.random() - 0.5) * push;
        p.vy += (Math.random() - 0.5) * push;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.life -= active ? 0.0035 : 0.0018;
      if (p.x < 0) {
        p.x = 0;
        p.vx *= -0.8;
      } else if (p.x > w) {
        p.x = w;
        p.vx *= -0.8;
      }
      if (p.y < 0) {
        p.y = 0;
        p.vy *= -0.8;
      } else if (p.y > h) {
        p.y = h;
        p.vy *= -0.8;
      }
      if (p.life <= 0) continue;
      const alpha = p.life * (0.35 + bass * 0.5);
      ctx.fillStyle = `hsla(${p.hue}, 92%, 80%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      if (p.life > 0.55 && Math.random() < 0.04) {
        ctx.strokeStyle = `hsla(${p.hue}, 100%, 92%, ${alpha * 0.45})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x - 5, p.y);
        ctx.lineTo(p.x + 5, p.y);
        ctx.moveTo(p.x, p.y - 5);
        ctx.lineTo(p.x, p.y + 5);
        ctx.stroke();
      }
      next.push(p);
    }
    vizParticles = next;
  }

  function drawVizBloom(ctx, w, h, active) {
    const cx = w / 2;
    const cy = h / 2;
    const bass = vizBassLevel(active);
    const t = performance.now() * 0.001;
    const rings = 7;
    const base = Math.min(w, h);
    for (let i = 0; i < rings; i++) {
      const v = vizBinLevel(i * 4, active, 0.1 + Math.sin(t + i) * 0.05);
      const r = base * 0.06 + i * base * 0.055 + v * 36 + bass * 22;
      const hue = (275 + i * 24 + t * 20) % 360;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 90%, 74%, ${0.12 + v * 0.5})`;
      ctx.lineWidth = 1.5 + v * 4;
      ctx.shadowBlur = 12 + v * 18;
      ctx.shadowColor = `hsla(${hue}, 100%, 72%, 0.6)`;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    const pulse = base * (0.04 + bass * 0.08);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse);
    core.addColorStop(0, `hsla(${(300 + t * 40) % 360}, 95%, 88%, ${0.25 + bass * 0.4})`);
    core.addColorStop(1, "hsla(280, 90%, 70%, 0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawVizDream(ctx, w, h, active) {
    const t = performance.now() * 0.001;
    const bass = vizBassLevel(active);
    const slices = 6;
    const cx = w / 2;
    const cy = h / 2;
    for (let s = 0; s < slices; s++) {
      const rot = (s / slices) * Math.PI * 2 + t * 0.12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      const points = 72;
      for (let i = 0; i <= points; i++) {
        const idx = Math.floor((i / points) * (freqData?.length ?? 64) * 0.78);
        const v = vizBinLevel(idx, active, 0.08);
        const angle = (i / points) * Math.PI * 2;
        const rad = 10 + v * Math.min(w, h) * 0.34 + bass * 18;
        const x = Math.cos(angle) * rad;
        const y = Math.sin(angle) * rad * 0.55;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const hue = (295 + s * 28 + t * 22) % 360;
      ctx.strokeStyle = `hsla(${hue}, 94%, 78%, ${0.2 + bass * 0.45})`;
      ctx.lineWidth = 1.2 + bass * 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = `hsla(${hue}, 100%, 75%, 0.45)`;
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawVizGalaxy(ctx, w, h, active) {
    const cx = w / 2;
    const cy = h / 2;
    const t = performance.now() * 0.001;
    const bass = vizBassLevel(active);
    const arms = 3;
    const dots = 100;
    const maxR = Math.min(w, h) * 0.46;
    for (let i = 0; i < dots; i++) {
      const idx = Math.floor((i / dots) * (freqData?.length ?? 64) * 0.85);
      const v = vizBinLevel(idx, active, 0.1);
      const angle = (i / dots) * Math.PI * 2 * arms + t * (0.25 + bass * 0.35);
      const dist = (i / dots) * maxR * (0.55 + v * 0.55 + bass * 0.25);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist * 0.72;
      const hue = (235 + i * 1.8 + t * 28) % 360;
      const size = 0.8 + v * 2.8 + bass * 1.8;
      ctx.fillStyle = `hsla(${hue}, 88%, 82%, ${0.25 + v * 0.65})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      if (v > 0.45 && i % 7 === 0) {
        ctx.strokeStyle = `hsla(${hue}, 100%, 90%, ${v * 0.35})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  }

  function drawVizNebula(ctx, w, h, active) {
    const bass = vizBassLevel(active);
    const t = performance.now() * 0.001;

    if (vizParticles.length < 10) {
      vizParticles.push({
        kind: "nebula",
        x: Math.random() * w,
        y: Math.random() * h,
        r: 28 + Math.random() * 55,
        hue: 250 + Math.random() * 70,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12
      });
    }

    const next = [];
    for (const p of vizParticles) {
      if (p.kind !== "nebula") continue;
      const idx = Math.floor(Math.random() * 16);
      const v = vizBinLevel(idx, active, 0.15);
      p.x += p.vx + Math.sin(t + p.hue) * v * 0.15;
      p.y += p.vy + Math.cos(t * 0.8 + p.hue) * v * 0.12;
      if (p.x < -p.r) p.x = w + p.r;
      if (p.x > w + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = h + p.r;
      if (p.y > h + p.r) p.y = -p.r;

      const radius = p.r * (0.85 + v * 0.55 + bass * 0.35);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      grad.addColorStop(0, `hsla(${p.hue}, 88%, 72%, ${0.22 + v * 0.35})`);
      grad.addColorStop(0.45, `hsla(${(p.hue + 30) % 360}, 85%, 58%, ${0.1 + v * 0.2})`);
      grad.addColorStop(1, "hsla(260, 80%, 40%, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      next.push(p);
    }
    vizParticles = next;
  }

  function drawVizFireworks(ctx, w, h, active) {
    const bass = vizBassLevel(active);
    if (active && bass > 0.28 && Math.random() < 0.12 + bass * 0.35) {
      const bx = Math.random() * w;
      const by = Math.random() * h * 0.55 + h * 0.12;
      const hue = (260 + Math.random() * 90) % 360;
      const count = 14 + Math.floor(bass * 22);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 1 + Math.random() * 2.2 + bass * 2.8;
        vizSparks.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          hue: (hue + i * 7) % 360
        });
      }
    }

    const next = [];
    for (const s of vizSparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.018;
      s.vx *= 0.985;
      s.life -= active ? 0.014 : 0.008;
      if (s.life <= 0) continue;
      const alpha = s.life * (0.45 + bass * 0.45);
      ctx.fillStyle = `hsla(${s.hue}, 95%, 78%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.2 + s.life * 2.2, 0, Math.PI * 2);
      ctx.fill();
      if (s.life > 0.5) {
        ctx.strokeStyle = `hsla(${s.hue}, 100%, 90%, ${alpha * 0.35})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 3, s.y - s.vy * 3);
        ctx.stroke();
      }
      next.push(s);
    }
    vizSparks = next.length > 220 ? next.slice(-220) : next;
  }

  function drawVisualizerFrame() {
    if (!pageRoot) return;
    const canvas = pageRoot.querySelector("#sound-viz-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resetVizDreamState();
    }

    const active = isAudioActive();
    const isDreamy = DREAMY_VIZ.has(vizType);
    if (isDreamy) {
      if (lastDreamyVizType !== vizType) {
        ctx.clearRect(0, 0, w, h);
        vizParticles = [];
        vizSparks = [];
        lastDreamyVizType = vizType;
      } else {
        vizFadeFrame(ctx, w, h, active ? 0.09 : 0.14);
      }
    } else {
      lastDreamyVizType = null;
      vizParticles = [];
      vizSparks = [];
      ctx.clearRect(0, 0, w, h);
    }

    if (analyser && active && freqData && timeData) {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);
    }

    const status = pageRoot.querySelector("#sound-viz-status");
    if (status) {
      status.textContent = active ? "재생 중" : "대기";
      status.classList.toggle("is-active", active);
    }

    if (!active && !isDreamy && vizType !== "wave") {
      drawVisualizerIdle(ctx, w, h);
    }

    switch (vizType) {
      case "wave":
        drawVizWave(ctx, w, h, active);
        break;
      case "circle":
        drawVizCircle(ctx, w, h, active);
        break;
      case "line":
        drawVizLine(ctx, w, h, active);
        break;
      case "mirror":
        drawVizMirror(ctx, w, h, active);
        break;
      case "radar":
        drawVizRadar(ctx, w, h, active);
        break;
      case "waterfall":
        drawVizWaterfall(ctx, w, h, active);
        break;
      case "aurora":
        drawVizAurora(ctx, w, h, active);
        break;
      case "stardust":
        drawVizStardust(ctx, w, h, active);
        break;
      case "bloom":
        drawVizBloom(ctx, w, h, active);
        break;
      case "dream":
        drawVizDream(ctx, w, h, active);
        break;
      case "galaxy":
        drawVizGalaxy(ctx, w, h, active);
        break;
      case "nebula":
        drawVizNebula(ctx, w, h, active);
        break;
      case "fireworks":
        drawVizFireworks(ctx, w, h, active);
        break;
      default:
        drawVizBars(ctx, w, h, active);
    }
  }

  function bindVisualizer() {
    if (!pageRoot) return;
    try {
      const saved = localStorage.getItem(VIZ_STORAGE_KEY);
      if (saved && VIZ_TYPES.some((t) => t.id === saved)) vizType = saved;
    } catch (_) {
      /* ignore */
    }

    pageRoot.querySelectorAll(".sound-viz-type-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.vizType === vizType);
      btn.addEventListener("click", () => {
        const next = btn.dataset.vizType || "bars";
        if (next !== vizType) resetVizDreamState();
        vizType = next;
        try {
          localStorage.setItem(VIZ_STORAGE_KEY, vizType);
        } catch (_) {
          /* ignore */
        }
        pageRoot.querySelectorAll(".sound-viz-type-btn").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.vizType === vizType);
        });
      });
    });

    bindVizFullscreen();
  }

  function getVizStage() {
    return pageRoot?.querySelector("#sound-viz-stage") ?? null;
  }

  function getVizFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isVizFullscreenActive() {
    const stage = getVizStage();
    return !!(stage && (getVizFullscreenElement() === stage || vizImmersive));
  }

  function updateVizFullscreenUi() {
    if (!pageRoot) return;
    const on = isVizFullscreenActive();
    const enterBtn = pageRoot.querySelector("#sound-viz-fullscreen-btn");
    const exitBtn = pageRoot.querySelector("#sound-viz-exit-fs-btn");
    if (enterBtn) {
      enterBtn.hidden = on;
      enterBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (exitBtn) exitBtn.hidden = !on;
  }

  async function exitVizFullscreen() {
    const stage = getVizStage();
    const fsEl = getVizFullscreenElement();
    if (fsEl) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (_) {
        /* ignore */
      }
    }
    if (stage) stage.classList.remove("is-immersive");
    document.documentElement.classList.remove("sound-viz-immersive-lock");
    vizImmersive = false;
    resetVizDreamState();
    updateVizFullscreenUi();
  }

  async function enterVizFullscreen() {
    const stage = getVizStage();
    if (!stage) return;
    resetVizDreamState();
    try {
      if (stage.requestFullscreen) await stage.requestFullscreen();
      else if (stage.webkitRequestFullscreen) await stage.webkitRequestFullscreen();
      else throw new Error("fullscreen unsupported");
    } catch (_) {
      stage.classList.add("is-immersive");
      document.documentElement.classList.add("sound-viz-immersive-lock");
      vizImmersive = true;
    }
    updateVizFullscreenUi();
  }

  async function toggleVizFullscreen() {
    if (isVizFullscreenActive()) await exitVizFullscreen();
    else await enterVizFullscreen();
  }

  function onVizFullscreenChange() {
    const stage = getVizStage();
    if (!stage) return;
    if (getVizFullscreenElement() !== stage && vizImmersive) return;
    if (!getVizFullscreenElement() && !vizImmersive) {
      stage.classList.remove("is-immersive");
      document.documentElement.classList.remove("sound-viz-immersive-lock");
      resetVizDreamState();
    }
    updateVizFullscreenUi();
  }

  function bindVizFullscreen() {
    if (!pageRoot || pageRoot.dataset.vizFsBound === "1") return;
    pageRoot.dataset.vizFsBound = "1";

    const enterBtn = pageRoot.querySelector("#sound-viz-fullscreen-btn");
    const exitBtn = pageRoot.querySelector("#sound-viz-exit-fs-btn");
    enterBtn?.addEventListener("click", () => {
      void enterVizFullscreen();
    });
    exitBtn?.addEventListener("click", () => {
      void exitVizFullscreen();
    });

    document.addEventListener("fullscreenchange", onVizFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onVizFullscreenChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onVizFullscreenChange);
    }

    if (!vizFsKeyHandler) {
      vizFsKeyHandler = (e) => {
        if (e.key === "Escape" && vizImmersive) void exitVizFullscreen();
      };
      document.addEventListener("keydown", vizFsKeyHandler);
    }

    updateVizFullscreenUi();
  }

  function unbindVizFullscreen() {
    document.removeEventListener("fullscreenchange", onVizFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", onVizFullscreenChange);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", onVizFullscreenChange);
    }
    if (vizFsKeyHandler) {
      document.removeEventListener("keydown", vizFsKeyHandler);
      vizFsKeyHandler = null;
    }
    void exitVizFullscreen();
  }

  async function unlock() {
    const ctx = ensure();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (_) {
        /* gesture may be required on mobile */
      }
    }
  }

  let unlockBound = false;
  function bindUnlockGestures() {
    if (unlockBound) return;
    unlockBound = true;
    const handler = () => {
      void unlock();
    };
    document.addEventListener("pointerdown", handler, { once: true, passive: true });
    document.addEventListener("touchstart", handler, { once: true, passive: true });
    document.addEventListener("keydown", handler, { once: true });
  }

  async function loadSample(url) {
    if (sampleCache.has(url)) return sampleCache.get(url);
    const ctx = ensure();
    const res = await fetch(url);
    if (!res.ok) throw new Error("sample fetch failed: " + url);
    const data = await res.arrayBuffer();
    const audio = await ctx.decodeAudioData(data.slice(0));
    sampleCache.set(url, audio);
    return audio;
  }

  function stopSample() {
    if (!activeSampleSource) return;
    try {
      activeSampleSource.stop();
    } catch (_) {
      /* already stopped */
    }
    activeSampleSource.disconnect?.();
    activeSampleSource = null;
  }

  function clearPreviewLimitTimer() {
    if (!previewLimitTimer) return;
    clearTimeout(previewLimitTimer);
    previewLimitTimer = null;
  }

  function schedulePreviewLimit(sec = PREVIEW_MAX_SEC) {
    clearPreviewLimitTimer();
    previewLimitTimer = setTimeout(() => {
      previewLimitTimer = null;
      stopPreview();
    }, sec * 1000);
  }

  function stopPreviewLoops() {
    clearPreviewLimitTimer();
    if (cricketPreviewTimer) {
      clearInterval(cricketPreviewTimer);
      cricketPreviewTimer = null;
    }
    activePreviewLoops.forEach((node) => {
      try {
        node.stop?.();
        node.disconnect?.();
      } catch (_) {
        /* already stopped */
      }
    });
    activePreviewLoops = [];
    stopSample();
    stopSynthPreview();
  }

  function stopPreview() {
    stopPreviewLoops();
  }

  function stopMixer() {
    mixerLayers.forEach((layer) => {
      try {
        layer.stop();
      } catch (_) {
        /* ignore */
      }
      try {
        layer.gainNode.disconnect();
      } catch (_) {
        /* ignore */
      }
    });
    mixerLayers = [];
    mixerPaused = false;
    if (pageRoot) renderMixer();
    updateMiniPlayerUi();
  }

  function setLayerVolume(layer, volumePct) {
    layer.volume = volumePct;
    const gain = (volumePct / 100) * 0.85;
    if (mixerPaused) {
      layer._pausedGain = gain;
    } else {
      layer.gainNode.gain.value = gain;
    }
  }

  function tone(freq, dur, type, vol, when, dest) {
    const ctx = ensure();
    const t = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(dest || masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBuffer(seconds, color = "white") {
    const ctx = ensure();
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (color === "white") {
        data[i] = white;
      } else if (color === "pink") {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        data[i] = (b0 + b1 + b2 + white * 0.3104856) * 0.11;
      } else {
        data[i] = (b0 = (b0 + 0.02 * white) / 1.02) * 3.5;
      }
    }
    return buffer;
  }

  function connectNoiseLoop(seconds, color, filterHz, q, level, destGain) {
    const ctx = ensure();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(seconds, color);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterHz ? "bandpass" : "lowpass";
    filter.frequency.value = filterHz || 8000;
    if (q) filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(filter);
    filter.connect(g);
    g.connect(destGain);
    src.start();
    return () => {
      try {
        src.stop();
      } catch (_) {
        /* ignore */
      }
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  function playNoiseLoop(seconds, color, filterHz, q, gain) {
    stopPreview();
    const ctx = ensure();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(seconds, color);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterHz ? "bandpass" : "lowpass";
    filter.frequency.value = filterHz || 8000;
    if (q) filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    src.start();
    activePreviewLoops.push(src);
    return src;
  }

  async function startSampleLoop(group, id, destGain) {
    const url = sampleUrl(group, id);
    if (!url) return null;
    const buffer = await loadSample(url);
    const ctx = ensure();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(destGain);
    src.start();
    return () => {
      try {
        src.stop();
      } catch (_) {
        /* ignore */
      }
      src.disconnect();
    };
  }

  async function attachLayerSound(group, id, destGain) {
    const ctx = ensure();

    if (group === "animals" || group === "instruments" || group === "lullabies") {
      const stop = await startSampleLoop(group, id, destGain);
      if (!stop) throw new Error("no sample");
      return stop;
    }

    if (group === "nature") {
      const sampleStop = await startSampleLoop("nature", id, destGain);
      if (sampleStop) return sampleStop;
      const natureMap = {
        wind: () => connectNoiseLoop(3, "pink", 600, 0.7, 0.28, destGain),
        stream: () => connectNoiseLoop(3, "white", 1200, 1.2, 0.22, destGain),
        waves: () => connectNoiseLoop(4, "pink", 300, 0.5, 0.3, destGain),
        rain: () => connectNoiseLoop(3, "white", 2500, 0.4, 0.2, destGain),
        thunder: () => {
          const n = ctx.createBufferSource();
          n.buffer = noiseBuffer(1.5, "brown");
          n.loop = true;
          const g = ctx.createGain();
          g.gain.value = 0.35;
          n.connect(g);
          g.connect(destGain);
          n.start();
          return () => {
            try {
              n.stop();
            } catch (_) {
              /* ignore */
            }
            n.disconnect();
            g.disconnect();
          };
        },
        waterfall: () => connectNoiseLoop(3, "white", 900, 0.9, 0.26, destGain),
        campfire: () => connectNoiseLoop(2, "pink", 200, 0.4, 0.18, destGain),
        blizzard: () => connectNoiseLoop(3, "white", 1500, 0.3, 0.24, destGain),
        lake: () => connectNoiseLoop(3, "pink", 450, 0.5, 0.16, destGain),
        creek: () => connectNoiseLoop(3, "white", 1800, 1, 0.2, destGain),
        night: () => connectNoiseLoop(3, "brown", 120, 0.5, 0.14, destGain),
        gust: () => connectNoiseLoop(2, "white", 350, 0.8, 0.32, destGain),
        beach: () => connectNoiseLoop(4, "pink", 280, 0.6, 0.28, destGain),
        cave: () => connectNoiseLoop(3, "brown", 90, 0.7, 0.2, destGain),
        mist: () => connectNoiseLoop(3, "pink", 700, 0.3, 0.12, destGain),
        river: () => connectNoiseLoop(3, "white", 500, 0.6, 0.24, destGain),
        storm: () => connectNoiseLoop(3, "white", 2500, 0.4, 0.2, destGain),
        cricket: () => {
          const timer = setInterval(() => {
            const t = ctx.currentTime;
            tone(4200, 0.03, "square", 0.04, t, destGain);
          }, 120);
          return () => clearInterval(timer);
        },
        forest: async () => {
          const stops = [];
          const bird = await startSampleLoop("animals", "bird", destGain);
          if (bird) stops.push(bird);
          stops.push(connectNoiseLoop(2, "pink", 400, 0.6, 0.08, destGain));
          return () => stops.forEach((fn) => fn());
        },
        dawn: async () => {
          const stops = [];
          const bird = await startSampleLoop("animals", "bird", destGain);
          if (bird) stops.push(bird);
          stops.push(connectNoiseLoop(2, "pink", 800, 0.5, 0.06, destGain));
          return () => stops.forEach((fn) => fn());
        }
      };
      const fn = natureMap[id] || natureMap.wind;
      const result = fn();
      return result instanceof Promise ? await result : result;
    }

    if (group === "whitenoise") {
      if (id === "white") return connectNoiseLoop(2, "white", null, null, 0.22, destGain);
      if (id === "pink") return connectNoiseLoop(2, "pink", null, null, 0.22, destGain);
      if (id === "brown") return connectNoiseLoop(2, "brown", null, null, 0.22, destGain);
      if (id === "blue") return connectNoiseLoop(2, "white", 4000, 2, 0.2, destGain);
      if (id === "violet") return connectNoiseLoop(2, "white", 6000, 2, 0.18, destGain);
      if (BAND_HZ[id]) return connectNoiseLoop(2, "white", BAND_HZ[id], 1.4, 0.2, destGain);
      const p = NOISE_PRESETS[id] || [1000, 1, 0.18];
      return connectNoiseLoop(2, "pink", p[0], p[1], p[2], destGain);
    }

    if (group === "synth") {
      const params = typeof id === "object" && id ? id : synthParams;
      return connectSynthVoice(params, destGain);
    }

    throw new Error("unknown group");
  }

  async function playSample(group, id) {
    stopPreview();
    await unlock();
    const url = sampleUrl(group, id);
    if (!url) return false;
    try {
      const buffer = await loadSample(url);
      const ctx = ensure();
      if (ctx.state === "suspended") await ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(masterGain);
      src.onended = () => {
        if (activeSampleSource === src) activeSampleSource = null;
      };
      const playSec =
        group === "instruments"
          ? Math.min(buffer.duration, PREVIEW_MAX_SEC)
          : group === "lullabies"
            ? Math.min(buffer.duration, LULLABY_PREVIEW_MAX_SEC)
            : buffer.duration;
      src.start(0, 0, playSec);
      activeSampleSource = src;
      if (group === "lullabies") schedulePreviewLimit(LULLABY_PREVIEW_MAX_SEC);
      return true;
    } catch (err) {
      console.warn("Sound sample failed:", group, id, err);
      return false;
    }
  }

  function playAnimal(id) {
    void playSample("animals", id);
  }

  function playNature(id) {
    stopPreview();
    void playSample("nature", id).then((ok) => {
      if (ok) return;
      playNatureFallback(id);
    });
  }

  function playNatureFallback(id) {
    const map = {
      wind: () => playNoiseLoop(3, "pink", 600, 0.7, 0.28),
      stream: () => playNoiseLoop(3, "white", 1200, 1.2, 0.22),
      waves: () => playNoiseLoop(4, "pink", 300, 0.5, 0.3),
      rain: () => playNoiseLoop(3, "white", 2500, 0.4, 0.2),
      thunder: () => {
        const ctx = ensure();
        const t = ctx.currentTime;
        const n = ctx.createBufferSource();
        n.buffer = noiseBuffer(1.5, "brown");
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.55, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        n.connect(g);
        g.connect(masterGain);
        n.start(t);
      },
      waterfall: () => playNoiseLoop(3, "white", 900, 0.9, 0.26),
      forest: () => {
        playAnimal("bird");
        setTimeout(() => playNoiseLoop(2, "pink", 400, 0.6, 0.08), 200);
      },
      cricket: () => {
        cricketPreviewTimer = setInterval(() => {
          const ctx = ensure();
          const t = ctx.currentTime;
          tone(4200, 0.03, "square", 0.04, t);
        }, 120);
      },
      campfire: () => playNoiseLoop(2, "pink", 200, 0.4, 0.18),
      blizzard: () => playNoiseLoop(3, "white", 1500, 0.3, 0.24),
      lake: () => playNoiseLoop(3, "pink", 450, 0.5, 0.16),
      creek: () => playNoiseLoop(3, "white", 1800, 1, 0.2),
      dawn: () => {
        playAnimal("bird");
        playNoiseLoop(2, "pink", 800, 0.5, 0.06);
      },
      night: () => playNoiseLoop(3, "brown", 120, 0.5, 0.14),
      gust: () => playNoiseLoop(2, "white", 350, 0.8, 0.32),
      beach: () => playNoiseLoop(4, "pink", 280, 0.6, 0.28),
      cave: () => playNoiseLoop(3, "brown", 90, 0.7, 0.2),
      storm: () => {
        playNature("rain");
        setTimeout(() => playNature("thunder"), 400);
      },
      mist: () => playNoiseLoop(3, "pink", 700, 0.3, 0.12),
      river: () => playNoiseLoop(3, "white", 500, 0.6, 0.24)
    };
    (map[id] || map.wind)();
    schedulePreviewLimit();
  }

  function playWhitenoise(id) {
    stopPreview();
    if (id === "white") return playNoiseLoop(2, "white", null, null, 0.22);
    if (id === "pink") return playNoiseLoop(2, "pink", null, null, 0.22);
    if (id === "brown") return playNoiseLoop(2, "brown", null, null, 0.22);
    if (id === "blue") return playNoiseLoop(2, "white", 4000, 2, 0.2);
    if (id === "violet") return playNoiseLoop(2, "white", 6000, 2, 0.18);
    if (BAND_HZ[id]) return playNoiseLoop(2, "white", BAND_HZ[id], 1.4, 0.2);
    const p = NOISE_PRESETS[id] || [1000, 1, 0.18];
    playNoiseLoop(2, "pink", p[0], p[1], p[2]);
  }

  function playInstrument(id) {
    void playSample("instruments", id);
  }

  function playLullaby(id) {
    void playSample("lullabies", id);
  }

  function playSound(group, id) {
    void unlock().then(() => {
      if (group === "animals") playAnimal(id);
      else if (group === "nature") playNature(id);
      else if (group === "whitenoise") playWhitenoise(id);
      else if (group === "synth") playSynthPreview();
      else if (group === "lullabies") playLullaby(id);
      else playInstrument(id);
    });
  }

  async function addToMixer() {
    if (mixerLayers.length >= MAX_MIXER) return;
    if (activeGroup === "synth") {
      if (!selectedId) return;
    } else if (!selectedId) {
      return;
    }
    await unlock();
    const ctx = ensure();
    if (ctx.state === "suspended") await ctx.resume();

    const layerGain = ctx.createGain();
    layerGain.gain.value = (DEFAULT_MIXER_VOLUME / 100) * 0.85;
    layerGain.connect(masterGain);

    const paramsSnapshot =
      activeGroup === "synth" ? { ...clampSynthParams(synthParams) } : null;

    try {
      const stop = await attachLayerSound(
        activeGroup,
        activeGroup === "synth" ? paramsSnapshot : selectedId,
        layerGain
      );
      mixerLayers.push({
        uid: ++mixerUid,
        group: activeGroup,
        soundId: activeGroup === "synth" ? "custom" : selectedId,
        synthParams: paramsSnapshot,
        label:
          activeGroup === "synth"
            ? formatSynthLabel(paramsSnapshot)
            : getLabel(activeGroup, selectedId),
        volume: DEFAULT_MIXER_VOLUME,
        gainNode: layerGain,
        stop
      });
      renderMixer();
      updateAddButton();
      mixerPaused = false;
      updateMiniPlayerUi();
    } catch (err) {
      layerGain.disconnect();
      console.warn("Mixer add failed:", err);
    }
  }

  function removeMixerLayer(uid) {
    const idx = mixerLayers.findIndex((l) => l.uid === uid);
    if (idx === -1) return;
    const layer = mixerLayers[idx];
    try {
      layer.stop();
    } catch (_) {
      /* ignore */
    }
    try {
      layer.gainNode.disconnect();
    } catch (_) {
      /* ignore */
    }
    mixerLayers.splice(idx, 1);
    if (!mixerLayers.length) mixerPaused = false;
    renderMixer();
    updateAddButton();
    updateMiniPlayerUi();
  }

  function updateAddButton() {
    if (!pageRoot) return;
    const btn = pageRoot.querySelector("#sound-add-btn");
    if (!btn) return;
    const full = mixerLayers.length >= MAX_MIXER;
    const noSelection = activeGroup === "synth" ? false : !selectedId;
    btn.disabled = full || noSelection;
    btn.title = full
      ? "최대 10개까지 추가할 수 있습니다"
      : activeGroup === "synth"
        ? "현재 합성 설정을 믹서에 추가"
        : noSelection
          ? "먼저 소리를 선택하세요"
          : "선택한 소리를 믹서에 추가";
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  function updateCategoryNav() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll(".sound-category-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.soundGroup === activeGroup);
    });
  }

  function renderMixer() {
    if (!pageRoot) return;
    const list = pageRoot.querySelector("#sound-mixer-list");
    const count = pageRoot.querySelector("#sound-mixer-count");
    if (!list) return;

    if (count) {
      count.textContent = `${mixerLayers.length} / ${MAX_MIXER}`;
    }

    if (!mixerLayers.length) {
      list.innerHTML = `<p class="sound-mixer-empty">추가된 소리가 없습니다. 소리를 고른 뒤 우측 상단 <strong>추가</strong>를 누르세요.</p>`;
      return;
    }

    list.innerHTML = mixerLayers
      .map(
        (layer) => `
      <div class="sound-mixer-item" data-mixer-uid="${layer.uid}">
        <span class="sound-mixer-label">${escapeHtml(layer.label)}</span>
        <input type="range" class="sound-mixer-slider" min="0" max="100" value="${layer.volume}" aria-label="${escapeHtml(layer.label)} 볼륨" />
        <button type="button" class="sound-mixer-remove" data-mixer-uid="${layer.uid}" aria-label="제거">×</button>
      </div>
    `
      )
      .join("");

    list.querySelectorAll(".sound-mixer-slider").forEach((slider) => {
      slider.addEventListener("input", () => {
        const uid = Number(slider.closest(".sound-mixer-item")?.dataset.mixerUid);
        const layer = mixerLayers.find((l) => l.uid === uid);
        if (layer) setLayerVolume(layer, Number(slider.value));
      });
    });

    list.querySelectorAll(".sound-mixer-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeMixerLayer(Number(btn.dataset.mixerUid));
      });
    });
  }

  function renderGrid() {
    if (!pageRoot) return;
    const grid = pageRoot.querySelector("#sound-grid");
    const title = pageRoot.querySelector("#sound-group-title");
    if (!grid || !title) return;

    updateGroupLayout();

    if (activeGroup === "synth") {
      renderSynthPanel();
      return;
    }

    const groupMeta = GROUPS.find((g) => g.id === activeGroup);
    title.textContent = groupMeta?.label || "";

    const items = CATALOG[activeGroup] || [];
    grid.innerHTML = items
      .map(
        ([id, label]) => `
        <button type="button" class="sound-item-btn${selectedId === id ? " is-selected" : ""}" data-sound-id="${escapeHtml(id)}">
          ${escapeHtml(label)}
        </button>
      `
      )
      .join("");

    grid.querySelectorAll(".sound-item-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedId = btn.dataset.soundId;
        renderGrid();
        updateAddButton();
        playSound(activeGroup, selectedId);
      });
    });
  }

  function updateSynthUi() {
    if (!pageRoot || activeGroup !== "synth") return;
    const freqInput = pageRoot.querySelector("#sound-synth-freq-input");
    if (freqInput && document.activeElement !== freqInput) {
      freqInput.value = String(Math.round(synthParams.frequency));
    }

    const bars = pageRoot.querySelectorAll(".sound-synth-bar");
    const activeIndex = Math.round(chartTFromFreq(synthParams.frequency) * (SYNTH_BAR_COUNT - 1));
    bars.forEach((bar, i) => {
      const h = barSpectrumHeight(i, synthParams.frequency);
      bar.style.height = `${Math.round(h * 100)}%`;
      bar.classList.toggle("is-active", i === activeIndex);
    });

    const cutoff = pageRoot.querySelector("#sound-synth-cutoff");
    const resonance = pageRoot.querySelector("#sound-synth-resonance");
    const vibrato = pageRoot.querySelector("#sound-synth-vibrato");
    if (cutoff) {
      cutoff.value = String(
        Math.round(
          ((synthParams.cutoff - SYNTH_CUTOFF_MIN) / (SYNTH_CUTOFF_MAX - SYNTH_CUTOFF_MIN)) * 100
        )
      );
    }
    if (resonance) resonance.value = String(Math.round(((synthParams.resonance - 0.3) / (20 - 0.3)) * 100));
    if (vibrato) vibrato.value = String(Math.round((synthParams.vibrato / 0.1) * 100));

    const volumeCycle = pageRoot.querySelector("#sound-synth-volume-cycle");
    const volumeCycleVal = pageRoot.querySelector("#sound-synth-volume-cycle-val");
    if (volumeCycle) volumeCycle.value = String(synthParams.volumeCycle);
    if (volumeCycleVal) volumeCycleVal.textContent = formatVolumeCycle(synthParams.volumeCycle);

    pageRoot.querySelectorAll(".sound-synth-wave-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.waveform === synthParams.waveform);
    });

    const presetSelect = pageRoot.querySelector("#sound-synth-preset");
    if (presetSelect && document.activeElement !== presetSelect) {
      presetSelect.value = activeSynthPreset || "";
    }
  }

  function bindSynthPreset() {
    if (!pageRoot) return;
    const select = pageRoot.querySelector("#sound-synth-preset");
    if (!select || select.dataset.bound === "1") return;
    select.dataset.bound = "1";

    select.addEventListener("change", () => {
      const id = select.value;
      if (!id) {
        activeSynthPreset = "";
        return;
      }
      applySynthPreset(id);
    });
  }

  function bindSynthFreqInput() {
    if (!pageRoot) return;
    const input = pageRoot.querySelector("#sound-synth-freq-input");
    if (!input || input.dataset.bound === "1") return;
    input.dataset.bound = "1";

    const commit = () => {
      const raw = Number(input.value);
      if (!Number.isFinite(raw)) {
        input.value = String(Math.round(synthParams.frequency));
        return;
      }
      applySynthParams({ frequency: raw });
      input.value = String(Math.round(synthParams.frequency));
    };

    input.addEventListener("change", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        input.blur();
      }
    });
  }

  function bindSynthChart() {
    if (!pageRoot) return;
    const chart = pageRoot.querySelector("#sound-synth-chart-bars");
    if (!chart || chart.dataset.bound === "1") return;
    chart.dataset.bound = "1";

    const setFreqFromPointer = (clientX) => {
      const rect = chart.getBoundingClientRect();
      if (!rect.width) return;
      const t = (clientX - rect.left) / rect.width;
      applySynthParams({ frequency: freqFromChartT(t) });
    };

    chart.addEventListener("pointerdown", (e) => {
      chart.setPointerCapture(e.pointerId);
      setFreqFromPointer(e.clientX);
    });
    chart.addEventListener("pointermove", (e) => {
      if (!chart.hasPointerCapture(e.pointerId)) return;
      setFreqFromPointer(e.clientX);
    });
    chart.addEventListener("pointerup", (e) => {
      try {
        chart.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    });

    chart.querySelectorAll(".sound-synth-bar").forEach((bar) => {
      bar.addEventListener("click", () => {
        const idx = Number(bar.dataset.barIndex);
        const t = idx / (SYNTH_BAR_COUNT - 1);
        applySynthParams({ frequency: freqFromChartT(t) });
      });
    });
  }

  function updateGroupLayout() {
    if (!pageRoot) return;
    const isSynth = activeGroup === "synth";
    const title = pageRoot.querySelector("#sound-group-title");
    const grid = pageRoot.querySelector("#sound-grid");
    const waveRow = pageRoot.querySelector("#sound-synth-waves-row");
    const synthPanel = pageRoot.querySelector("#sound-synth-panel");
    if (title) title.hidden = isSynth;
    if (grid) grid.hidden = isSynth;
    if (waveRow) waveRow.hidden = !isSynth;
    if (synthPanel) synthPanel.hidden = !isSynth;
  }

  function bindSynthWaves() {
    if (!pageRoot) return;
    const wrap = pageRoot.querySelector("#sound-synth-waves-row");
    if (!wrap || wrap.dataset.bound === "1") return;
    wrap.dataset.bound = "1";

    wrap.querySelectorAll(".sound-synth-wave-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        applySynthParams({ waveform: btn.dataset.waveform || "sine" });
      });
    });
  }

  function bindSynthFilters() {
    if (!pageRoot) return;
    const cutoff = pageRoot.querySelector("#sound-synth-cutoff");
    const resonance = pageRoot.querySelector("#sound-synth-resonance");
    const vibrato = pageRoot.querySelector("#sound-synth-vibrato");
    const volumeCycle = pageRoot.querySelector("#sound-synth-volume-cycle");
    if (!cutoff || cutoff.dataset.bound === "1") return;

    cutoff.dataset.bound = "1";
    resonance.dataset.bound = "1";
    vibrato.dataset.bound = "1";
    if (volumeCycle) volumeCycle.dataset.bound = "1";

    cutoff.addEventListener("input", () => {
      const v = Number(cutoff.value) / 100;
      applySynthParams({ cutoff: SYNTH_CUTOFF_MIN + v * (SYNTH_CUTOFF_MAX - SYNTH_CUTOFF_MIN) });
    });
    resonance.addEventListener("input", () => {
      const v = Number(resonance.value) / 100;
      applySynthParams({ resonance: 0.3 + v * (20 - 0.3) });
    });
    vibrato.addEventListener("input", () => {
      const v = Number(vibrato.value) / 100;
      applySynthParams({ vibrato: v * 0.1 });
    });
    volumeCycle?.addEventListener("input", () => {
      applySynthParams({ volumeCycle: Number(volumeCycle.value) });
    });
  }

  function renderSynthPanel() {
    if (!pageRoot) return;
    let panel = pageRoot.querySelector("#sound-synth-panel");
    if (!panel) return;

    if (panel.dataset.synthVersion !== SYNTH_PANEL_VERSION) {
      const barsHtml = Array.from({ length: SYNTH_BAR_COUNT }, (_, i) => {
        const freq = Math.round(freqFromChartT(i / (SYNTH_BAR_COUNT - 1)));
        return `<button type="button" class="sound-synth-bar" data-bar-index="${i}" style="height:40%" aria-label="${freq} Hz"></button>`;
      }).join("");

      panel.innerHTML = `
        <div class="sound-synth-wrap">
          <label class="sound-synth-preset">
            <span class="sound-synth-preset-label">프리셋</span>
            <select id="sound-synth-preset" class="sound-synth-preset-select" aria-label="합성 프리셋">
              ${renderSynthPresetOptionsHtml()}
            </select>
          </label>
          <p class="sound-synth-hint">프리셋을 고르거나 막대 차트·입력란으로 직접 조절하세요. 주파수는 최대 ${SYNTH_FREQ_MAX.toLocaleString("ko-KR")} Hz까지 입력할 수 있습니다. 미리듣기는 최대 ${PREVIEW_MAX_SEC}초입니다.</p>
          <div class="sound-synth-chart" id="sound-synth-chart">
            <div class="sound-synth-chart-bars" id="sound-synth-chart-bars" role="slider" aria-label="주파수" aria-valuemin="${SYNTH_FREQ_MIN}" aria-valuemax="${SYNTH_FREQ_MAX}" tabindex="0">${barsHtml}</div>
            <div class="sound-synth-freq-row">
              <label class="sound-synth-freq-input-label" for="sound-synth-freq-input">주파수</label>
              <input
                type="number"
                id="sound-synth-freq-input"
                class="sound-synth-freq-input"
                min="${SYNTH_FREQ_MIN}"
                max="${SYNTH_FREQ_MAX}"
                step="1"
                inputmode="numeric"
                value="${DEFAULT_SYNTH.frequency}"
                aria-label="주파수 Hz"
              />
              <span class="sound-synth-freq-unit">Hz</span>
            </div>
          </div>
          <div class="sound-synth-filters">
            <label class="sound-synth-filter">
              <span class="sound-synth-filter-label">필터 (저역 통과)</span>
              <input type="range" id="sound-synth-cutoff" min="0" max="100" value="50" />
            </label>
            <label class="sound-synth-filter">
              <span class="sound-synth-filter-label">공명</span>
              <input type="range" id="sound-synth-resonance" min="0" max="100" value="30" />
            </label>
            <label class="sound-synth-filter">
              <span class="sound-synth-filter-label">떨림 (비브라토)</span>
              <input type="range" id="sound-synth-vibrato" min="0" max="100" value="20" />
            </label>
            <label class="sound-synth-filter">
              <span class="sound-synth-filter-label">볼륨 주기 <strong id="sound-synth-volume-cycle-val">1초</strong></span>
              <input
                type="range"
                id="sound-synth-volume-cycle"
                min="${SYNTH_VOLUME_CYCLE_MIN}"
                max="${SYNTH_VOLUME_CYCLE_MAX}"
                step="0.01"
                value="${DEFAULT_SYNTH.volumeCycle}"
              />
            </label>
          </div>
        </div>
      `;
      panel.dataset.synthVersion = SYNTH_PANEL_VERSION;
      bindSynthPreset();
      bindSynthChart();
      bindSynthFreqInput();
      bindSynthFilters();
    }

    updateSynthUi();
    selectedId = "custom";
    updateAddButton();
    queueSynthPreview();
  }

  function setGroup(groupId) {
    const isSynth = groupId === "synth";
    if (!isSynth && !CATALOG[groupId]) return;
    activeGroup = groupId;
    selectedId = isSynth ? "custom" : null;
    stopPreview();
    updateCategoryNav();
    renderGrid();
    updateAddButton();
  }

  function bindToolbar() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll(".sound-category-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setGroup(btn.dataset.soundGroup);
      });
    });
    const addBtn = pageRoot.querySelector("#sound-add-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        void addToMixer();
      });
    }
  }

  function renderPage(container) {
    pageRoot = container;
    container.innerHTML = `
      <article class="content-panel sound-panel">
        <div class="sound-toolbar">
          <nav class="sound-category-nav" aria-label="Sound categories">
            ${GROUPS.map(
              (g) =>
                `<button type="button" class="sound-category-btn" data-sound-group="${g.id}">${escapeHtml(g.label)}</button>`
            ).join("")}
          </nav>
          <button type="button" class="sound-add-btn" id="sound-add-btn" disabled>추가</button>
        </div>
        <nav id="sound-synth-waves-row" class="sound-synth-waves-row" aria-label="파형" hidden>
          <div class="sound-synth-waves" role="tablist">
            ${SYNTH_WAVEFORMS.map(
              (w) =>
                `<button type="button" class="sound-synth-wave-btn" data-waveform="${w.id}" role="tab">${escapeHtml(w.label)}</button>`
            ).join("")}
          </div>
        </nav>
        <h3 class="sound-group-title" id="sound-group-title">동물</h3>
        <div id="sound-grid" class="sound-grid" role="listbox" aria-label="Sound items"></div>
        <div id="sound-synth-panel" class="sound-synth-panel" hidden></div>
        <section class="sound-mixer" aria-label="Sound mixer">
          <div class="sound-mixer-head">
            <h3 class="sound-mixer-title">믹서</h3>
            <span class="sound-mixer-count" id="sound-mixer-count">0 / ${MAX_MIXER}</span>
          </div>
          <div id="sound-mixer-list" class="sound-mixer-list"></div>
        </section>
        <section class="sound-visualizer" aria-label="Sound visualizer">
          <div class="sound-viz-head">
            <h3 class="sound-viz-title">비주얼라이저</h3>
            <div class="sound-viz-head-actions">
              <span class="sound-viz-status" id="sound-viz-status">대기</span>
              <button type="button" class="sound-viz-fullscreen-btn" id="sound-viz-fullscreen-btn" aria-pressed="false">전체 화면</button>
            </div>
          </div>
          <div class="sound-viz-types" role="tablist" aria-label="비주얼라이저 유형">
            ${renderVizTypesHtml()}
          </div>
          <div class="sound-viz-stage" id="sound-viz-stage">
            <canvas id="sound-viz-canvas" class="sound-viz-canvas" aria-hidden="true"></canvas>
            <button type="button" class="sound-viz-exit-fs-btn" id="sound-viz-exit-fs-btn" hidden aria-label="전체 화면 닫기">닫기</button>
          </div>
        </section>
        ${renderHearingGuideHtml()}
        <p class="sound-footnote">소리를 눌러 미리 듣고, <strong>추가</strong>로 믹서에 넣으면 반복 재생됩니다(최대 ${MAX_MIXER}개). <strong>합성</strong>은 주파수·필터를 조절한 뒤 추가하세요. <strong>자장가</strong> 20곡은 Freesound CC0 음원입니다(상업적 이용 가능).</p>
      </article>
    `;
    bindToolbar();
    bindSynthWaves();
    setGroup(activeGroup);
    renderMixer();
    bindVisualizer();
    startVisualizerLoop();
    bindUnlockGestures();
    updateMiniPlayerUi();
  }

  function getGlobalBarsHost() {
    if (typeof window.mountGlobalBarsHost === "function") {
      return window.mountGlobalBarsHost();
    }
    let host = document.getElementById("app-global-bars");
    if (!host) {
      host = document.createElement("div");
      host.id = "app-global-bars";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    return host;
  }

  function forceClearSoundOverlays() {
    vizImmersive = false;
    document.documentElement.classList.remove("sound-viz-immersive-lock");
    pageRoot?.querySelector("#sound-viz-stage")?.classList.remove("is-immersive");
    document.querySelectorAll(".sound-viz-stage.is-immersive").forEach((el) => {
      el.classList.remove("is-immersive");
    });
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs && (fs.id === "sound-viz-stage" || fs.classList?.contains("sound-viz-stage"))) {
      try {
        if (document.exitFullscreen) void document.exitFullscreen();
        else if (document.webkitExitFullscreen) void document.webkitExitFullscreen();
      } catch (_) {
        /* ignore */
      }
    }
  }

  function mountMiniPlayer() {
    if (!miniPlayerEl) return;
    const host = getGlobalBarsHost();
    if (miniPlayerEl.parentElement !== host) {
      host.appendChild(miniPlayerEl);
    }
  }

  function drawMiniVisualizerFrame() {
    const canvas = miniPlayerEl?.querySelector("#sound-global-viz");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(0, 0, w, h);
    const active = isMixerPlaying();
    if (analyser && active && freqData) {
      analyser.getByteFrequencyData(freqData);
    }
    drawVizBars(ctx, w, h, active);
  }

  function stopMiniViz() {
    if (miniVizRaf) {
      cancelAnimationFrame(miniVizRaf);
      miniVizRaf = null;
    }
  }

  function startMiniViz() {
    stopMiniViz();
    if (!shouldShowMiniPlayer()) return;
    const loop = () => {
      if (!shouldShowMiniPlayer()) {
        stopMiniViz();
        return;
      }
      drawMiniVisualizerFrame();
      miniVizRaf = requestAnimationFrame(loop);
    };
    miniVizRaf = requestAnimationFrame(loop);
  }

  function ensureMiniPlayer() {
    if (miniPlayerEl) {
      mountMiniPlayer();
      return;
    }
    miniPlayerEl = document.createElement("div");
    miniPlayerEl.id = "sound-global-bar";
    miniPlayerEl.className = "sound-global-bar is-hidden";
    miniPlayerEl.setAttribute("role", "region");
    miniPlayerEl.setAttribute("aria-label", "Sound 믹서 재생");
    mountMiniPlayer();
  }

  function bindMiniPlayerEvents() {
    if (!miniPlayerEl || miniPlayerBound) return;
    miniPlayerBound = true;
    miniPlayerEl.addEventListener("click", (e) => {
      if (e.target.closest("#sound-global-volume") || e.target.closest(".sound-global-volume-pop")) {
        return;
      }
      if (e.target.closest("[data-sound-global-go]")) {
        document.querySelector('[data-page="sound"]')?.click();
        return;
      }
      if (e.target.closest("#sound-global-pause")) {
        pauseMixer();
        syncMiniPlayerControls();
        return;
      }
      if (e.target.closest("#sound-global-play")) {
        resumeMixer();
        syncMiniPlayerControls();
        return;
      }
      if (e.target.closest("#sound-global-volume-btn")) {
        miniVolumeOpen = !miniVolumeOpen;
        syncMiniVolumeUi();
        return;
      }
      if (e.target.closest("#sound-global-close")) {
        shutdown();
      }
    });
    miniPlayerEl.addEventListener("input", (e) => {
      if (e.target.id === "sound-global-volume") {
        applyMasterVolume(Number(e.target.value) / 100);
      }
    });
    document.addEventListener("click", (e) => {
      if (!miniVolumeOpen || !miniPlayerEl) return;
      if (miniPlayerEl.contains(e.target)) return;
      miniVolumeOpen = false;
      syncMiniVolumeUi();
    });
  }

  function syncMiniPlayerControls() {
    if (!miniPlayerEl || miniPlayerEl.classList.contains("is-hidden")) return;
    const pauseBtn = miniPlayerEl.querySelector("#sound-global-pause");
    const playBtn = miniPlayerEl.querySelector("#sound-global-play");
    const playing = isMixerPlaying();
    if (pauseBtn) pauseBtn.disabled = !playing;
    if (playBtn) playBtn.disabled = playing || !mixerLayers.length;
  }

  function syncMiniVolumeUi() {
    if (!miniPlayerEl) return;
    const btn = miniPlayerEl.querySelector("#sound-global-volume-btn");
    const pop = miniPlayerEl.querySelector("#sound-global-volume-pop");
    const slider = miniPlayerEl.querySelector("#sound-global-volume");
    if (btn) btn.textContent = volumeIcon();
    if (pop) pop.classList.toggle("is-open", !!miniVolumeOpen);
    if (slider) slider.value = String(Math.round(masterVolume * 100));
  }

  function renderMiniPlayerContent() {
    if (!miniPlayerEl || !mixerLayers.length) return;
    const label = mixerSummaryLabel();
    miniPlayerEl.innerHTML = `
      <button type="button" class="sound-global-go" data-sound-global-go aria-label="Sound 페이지로">
        <canvas id="sound-global-viz" class="sound-global-viz" aria-hidden="true"></canvas>
        <span class="sound-global-text">
          <span class="sound-global-title">${escapeHtml(label)}</span>
          <span class="sound-global-sub">${mixerPaused ? "일시정지" : "믹서 재생 중"}</span>
        </span>
      </button>
      <div class="sound-global-actions">
        <button type="button" class="sound-global-btn" id="sound-global-pause" aria-label="일시정지"${isMixerPlaying() ? "" : " disabled"}>⏸</button>
        <button type="button" class="sound-global-btn" id="sound-global-play" aria-label="재생"${mixerPaused ? "" : " disabled"}>▶</button>
        <div class="sound-global-volume-wrap">
          <button type="button" class="sound-global-btn" id="sound-global-volume-btn" aria-label="볼륨" aria-expanded="${miniVolumeOpen ? "true" : "false"}">${volumeIcon()}</button>
          <div class="sound-global-volume-pop${miniVolumeOpen ? " is-open" : ""}" id="sound-global-volume-pop">
            <label class="sound-global-volume-label" for="sound-global-volume">볼륨</label>
            <input type="range" class="sound-global-volume-slider" id="sound-global-volume" min="0" max="100" value="${Math.round(masterVolume * 100)}" orient="vertical" aria-label="볼륨 조절">
          </div>
        </div>
        <button type="button" class="sound-global-btn sound-global-close" id="sound-global-close" aria-label="닫기">✕</button>
      </div>
    `;
    startMiniViz();
  }

  function updateMiniPlayerUi() {
    ensureMiniPlayer();
    bindMiniPlayerEvents();
    if (!miniPlayerEl) return;
    const show = shouldShowMiniPlayer();
    miniPlayerEl.classList.toggle("is-hidden", !show);
    document.body.classList.toggle("sound-global-active", !!show);
    if (show) mountMiniPlayer();
    if (!show) {
      miniVolumeOpen = false;
      stopMiniViz();
      miniPlayerEl.innerHTML = "";
      return;
    }
    if (!miniPlayerEl.querySelector("#sound-global-viz")) {
      renderMiniPlayerContent();
    } else {
      const title = miniPlayerEl.querySelector(".sound-global-title");
      const sub = miniPlayerEl.querySelector(".sound-global-sub");
      if (title) title.textContent = mixerSummaryLabel();
      if (sub) sub.textContent = mixerPaused ? "일시정지" : "믹서 재생 중";
      syncMiniPlayerControls();
      syncMiniVolumeUi();
      if (!miniVizRaf) startMiniViz();
    }
  }

  function leavePage() {
    stopPreview();
    stopVisualizerLoop();
    forceClearSoundOverlays();
    unbindVizFullscreen();
    if (synthPreviewDebounce) {
      clearTimeout(synthPreviewDebounce);
      synthPreviewDebounce = null;
    }
    selectedId = null;
    pageRoot = null;
    updateMiniPlayerUi();
    requestAnimationFrame(() => updateMiniPlayerUi());
  }

  function shutdown() {
    stopMixer();
    stopPreview();
    mixerPaused = false;
    leavePage();
    if (miniPlayerEl) {
      miniPlayerEl.classList.add("is-hidden");
      miniPlayerEl.innerHTML = "";
      document.body.classList.remove("sound-global-active");
    }
    stopMiniViz();
  }

  function destroy() {
    leavePage();
  }

  window.Sound = {
    renderPage,
    leavePage,
    shutdown,
    destroy,
    updateMiniPlayerUi
  };
})();
