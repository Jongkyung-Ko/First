(function () {
  const MAX_MIXER = 10;
  const DEFAULT_MIXER_VOLUME = 70;
  const PREVIEW_MAX_SEC = 5;

  const GROUPS = [
    { id: "animals", label: "동물" },
    { id: "nature", label: "자연" },
    { id: "whitenoise", label: "백색소음" },
    { id: "instruments", label: "악기" },
    { id: "synth", label: "합성" }
  ];

  const SYNTH_FREQ_MIN = 80;
  const SYNTH_FREQ_MAX = 6000;
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
  const SYNTH_PANEL_VERSION = "4";

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
    ["eagle", "독수리"],
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

  const CATALOG = {
    animals: ANIMALS,
    nature: NATURE,
    whitenoise: WHITENOISE,
    instruments: INSTRUMENTS
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
      wolf: "wolf.wav",
      owl: "owl.mp3",
      eagle: "eagle.mp3",
      mouse: "mouse.mp3",
      goat: "goat.mp3",
      donkey: "donkey.mp3",
      robin: "robin.mp3",
      penguin: "penguin.ogg"
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
  let activeSynthStop = null;
  let synthPreviewDebounce = null;
  let vizRaf = null;
  let vizType = "bars";

  const VIZ_TYPES = [
    { id: "bars", label: "막대" },
    { id: "wave", label: "파형" },
    { id: "circle", label: "원형" },
    { id: "line", label: "라인" },
    { id: "mirror", label: "미러" }
  ];
  const VIZ_STORAGE_KEY = "sound-viz-type";

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
      cutoff: Math.min(12000, Math.max(120, p.cutoff)),
      resonance: Math.min(20, Math.max(0.3, p.resonance)),
      vibrato: Math.min(0.1, Math.max(0, p.vibrato)),
      volumeCycle: Math.min(
        SYNTH_VOLUME_CYCLE_MAX,
        Math.max(SYNTH_VOLUME_CYCLE_MIN, p.volumeCycle ?? DEFAULT_SYNTH.volumeCycle)
      )
    };
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
      masterGain.gain.value = 0.85;
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
    return (
      mixerLayers.length > 0 ||
      !!activeSampleSource ||
      activePreviewLoops.length > 0 ||
      !!activeSynthStop ||
      !!cricketPreviewTimer
    );
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
    }

    ctx.clearRect(0, 0, w, h);
    const active = isAudioActive();
    if (analyser && active && freqData && timeData) {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);
    }

    const status = pageRoot.querySelector("#sound-viz-status");
    if (status) {
      status.textContent = active ? "재생 중" : "대기";
      status.classList.toggle("is-active", active);
    }

    if (!active && vizType !== "wave") {
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
        vizType = btn.dataset.vizType || "bars";
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

  function schedulePreviewLimit() {
    clearPreviewLimitTimer();
    previewLimitTimer = setTimeout(() => {
      previewLimitTimer = null;
      stopPreview();
    }, PREVIEW_MAX_SEC * 1000);
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
    renderMixer();
  }

  function setLayerVolume(layer, volumePct) {
    layer.volume = volumePct;
    layer.gainNode.gain.value = (volumePct / 100) * 0.85;
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

    if (group === "animals" || group === "instruments") {
      const stop = await startSampleLoop(group, id, destGain);
      if (!stop) throw new Error("no sample");
      return stop;
    }

    if (group === "nature") {
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
        group === "instruments" ? Math.min(buffer.duration, PREVIEW_MAX_SEC) : buffer.duration;
      src.start(0, 0, playSec);
      activeSampleSource = src;
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

  function playSound(group, id) {
    void unlock().then(() => {
      if (group === "animals") playAnimal(id);
      else if (group === "nature") playNature(id);
      else if (group === "whitenoise") playWhitenoise(id);
      else if (group === "synth") playSynthPreview();
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
    renderMixer();
    updateAddButton();
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
    if (cutoff) cutoff.value = String(Math.round(((synthParams.cutoff - 120) / (12000 - 120)) * 100));
    if (resonance) resonance.value = String(Math.round(((synthParams.resonance - 0.3) / (20 - 0.3)) * 100));
    if (vibrato) vibrato.value = String(Math.round((synthParams.vibrato / 0.1) * 100));

    const volumeCycle = pageRoot.querySelector("#sound-synth-volume-cycle");
    const volumeCycleVal = pageRoot.querySelector("#sound-synth-volume-cycle-val");
    if (volumeCycle) volumeCycle.value = String(synthParams.volumeCycle);
    if (volumeCycleVal) volumeCycleVal.textContent = formatVolumeCycle(synthParams.volumeCycle);

    pageRoot.querySelectorAll(".sound-synth-wave-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.waveform === synthParams.waveform);
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
      applySynthParams({ cutoff: 120 + v * (12000 - 120) });
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
          <p class="sound-synth-hint">막대 차트를 드래그하거나 막대를 눌러 주파수를 조절하세요. 원하는 Hz는 아래 입력란에 직접 넣을 수 있습니다. 미리듣기는 최대 ${PREVIEW_MAX_SEC}초입니다.</p>
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
            <span class="sound-viz-status" id="sound-viz-status">대기</span>
          </div>
          <div class="sound-viz-types" role="tablist" aria-label="비주얼라이저 유형">
            ${VIZ_TYPES.map(
              (t) =>
                `<button type="button" class="sound-viz-type-btn" data-viz-type="${t.id}" role="tab">${escapeHtml(t.label)}</button>`
            ).join("")}
          </div>
          <canvas id="sound-viz-canvas" class="sound-viz-canvas" aria-hidden="true"></canvas>
        </section>
        <p class="sound-footnote">소리를 눌러 미리 듣고, <strong>추가</strong>로 믹서에 넣으면 반복 재생됩니다(최대 ${MAX_MIXER}개). <strong>합성</strong>은 주파수·필터를 조절한 뒤 추가하세요.</p>
      </article>
    `;
    bindToolbar();
    bindSynthWaves();
    setGroup(activeGroup);
    renderMixer();
    bindVisualizer();
    startVisualizerLoop();
    bindUnlockGestures();
  }

  function destroy() {
    stopPreview();
    stopMixer();
    stopVisualizerLoop();
    if (synthPreviewDebounce) {
      clearTimeout(synthPreviewDebounce);
      synthPreviewDebounce = null;
    }
    selectedId = null;
    pageRoot = null;
  }

  window.Sound = {
    renderPage,
    destroy
  };
})();
