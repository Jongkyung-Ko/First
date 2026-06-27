(function () {
  const MAX_MIXER = 10;
  const DEFAULT_MIXER_VOLUME = 70;
  const PREVIEW_MAX_SEC = 5;

  const GROUPS = [
    { id: "animals", label: "동물" },
    { id: "nature", label: "자연" },
    { id: "whitenoise", label: "백색소음" },
    { id: "instruments", label: "악기" }
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
    const items = CATALOG[group] || [];
    const found = items.find(([sid]) => sid === id);
    const groupLabel = GROUPS.find((g) => g.id === group)?.label || group;
    return found ? `${found[1]} · ${groupLabel}` : id;
  }

  function ensure() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ac.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(ac.destination);
    }
    if (ac.state === "suspended") void ac.resume();
    return ac;
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
      else playInstrument(id);
    });
  }

  async function addToMixer() {
    if (!selectedId || mixerLayers.length >= MAX_MIXER) return;
    await unlock();
    const ctx = ensure();
    if (ctx.state === "suspended") await ctx.resume();

    const layerGain = ctx.createGain();
    layerGain.gain.value = (DEFAULT_MIXER_VOLUME / 100) * 0.85;
    layerGain.connect(masterGain);

    try {
      const stop = await attachLayerSound(activeGroup, selectedId, layerGain);
      mixerLayers.push({
        uid: ++mixerUid,
        group: activeGroup,
        soundId: selectedId,
        label: getLabel(activeGroup, selectedId),
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
    const noSelection = !selectedId;
    btn.disabled = full || noSelection;
    btn.title = full
      ? "최대 10개까지 추가할 수 있습니다"
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

  function setGroup(groupId) {
    if (!CATALOG[groupId]) return;
    activeGroup = groupId;
    selectedId = null;
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
        <h3 class="sound-group-title" id="sound-group-title">동물</h3>
        <div id="sound-grid" class="sound-grid" role="listbox" aria-label="Sound items"></div>
        <section class="sound-mixer" aria-label="Sound mixer">
          <div class="sound-mixer-head">
            <h3 class="sound-mixer-title">믹서</h3>
            <span class="sound-mixer-count" id="sound-mixer-count">0 / ${MAX_MIXER}</span>
          </div>
          <div id="sound-mixer-list" class="sound-mixer-list"></div>
        </section>
        <p class="sound-footnote">소리를 눌러 미리 듣고, <strong>추가</strong>로 믹서에 넣으면 반복 재생됩니다(최대 ${MAX_MIXER}개). 각 슬라이더로 볼륨을 조절할 수 있습니다.</p>
      </article>
    `;
    bindToolbar();
    setGroup(activeGroup);
    renderMixer();
    bindUnlockGestures();
  }

  function destroy() {
    stopPreview();
    stopMixer();
    selectedId = null;
    pageRoot = null;
  }

  window.Sound = {
    renderPage,
    destroy
  };
})();
