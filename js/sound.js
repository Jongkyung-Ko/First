(function () {
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
    ["lion", "사자"],
    ["wolf", "늑대"],
    ["owl", "올빼미"],
    ["eagle", "독수리"],
    ["mouse", "쥐"],
    ["snake", "뱀"],
    ["monkey", "원숭이"],
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
      pig: "pig.ogg",
      horse: "horse.mp3",
      chicken: "chicken.mp3",
      duck: "duck.mp3",
      bird: "bird.mp3",
      bee: "bee.mp3",
      frog: "frog.mp3",
      elephant: "elephant.ogg",
      lion: "lion.ogg",
      wolf: "wolf.ogg",
      owl: "owl.mp3",
      eagle: "eagle.ogg",
      mouse: "mouse.mp3",
      snake: "snake.ogg",
      monkey: "monkey.ogg",
      penguin: "penguin.ogg"
    },
    instruments: {
      piano: "piano.wav",
      guitar: "guitar.mp3",
      violin: "violin.mp3",
      flute: "flute.wav",
      drums: "drums.mp3",
      harp: "harp.mp3",
      trumpet: "trumpet.mp3",
      sax: "sax.wav",
      xylophone: "xylophone.mp3",
      organ: "organ.mp3"
    }
  };

  let ac = null;
  let masterGain = null;
  let activeLoops = [];
  let activeSampleSource = null;
  const sampleCache = new Map();
  let activeGroup = "animals";
  let selectedId = null;
  let categoryNavEl = null;
  let pageRoot = null;

  function assetBase() {
    if (location.protocol === "file:") return "./";
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function sampleUrl(group, id) {
    const file = SAMPLE_FILES[group]?.[id];
    if (!file) return null;
    return assetBase() + "assets/audio/sfx/" + group + "/" + file;
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
    activeSampleSource = null;
  }

  async function playSample(group, id) {
    stopLoops();
    const url = sampleUrl(group, id);
    if (!url) return false;
    try {
      const buffer = await loadSample(url);
      const ctx = ensure();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(masterGain);
      src.onended = () => {
        if (activeSampleSource === src) activeSampleSource = null;
      };
      src.start();
      activeSampleSource = src;
      return true;
    } catch (err) {
      console.warn("Sound sample failed:", group, id, err);
      return false;
    }
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

  function unlock() {
    ensure();
  }

  function stopLoops() {
    activeLoops.forEach((node) => {
      try {
        node.stop?.();
        node.disconnect?.();
      } catch (_) {
        /* already stopped */
      }
    });
    activeLoops = [];
    stopSample();
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

  function playNoiseLoop(seconds, color, filterHz, q, gain) {
    const ctx = ensure();
    stopLoops();
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
    activeLoops.push(src);
    return src;
  }

  function playAnimal(id) {
    void playSample("animals", id);
  }

  function playNature(id) {
    stopLoops();
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
        const ctx = ensure();
        const t = ctx.currentTime;
        for (let i = 0; i < 8; i++) tone(4200, 0.03, "square", 0.04, t + i * 0.12);
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
  }

  function playWhitenoise(id) {
    stopLoops();
    const bands = {
      "band-125": 125,
      "band-250": 250,
      "band-500": 500,
      "band-1k": 1000,
      "band-2k": 2000,
      "band-4k": 4000,
      "band-8k": 8000
    };
    if (id === "white") return playNoiseLoop(2, "white", null, null, 0.22);
    if (id === "pink") return playNoiseLoop(2, "pink", null, null, 0.22);
    if (id === "brown") return playNoiseLoop(2, "brown", null, null, 0.22);
    if (id === "blue") return playNoiseLoop(2, "white", 4000, 2, 0.2);
    if (id === "violet") return playNoiseLoop(2, "white", 6000, 2, 0.18);
    if (bands[id]) return playNoiseLoop(2, "white", bands[id], 1.4, 0.2);
    const presets = {
      tv: [2200, 0.8, 0.18],
      radio: [1400, 1.2, 0.16],
      fan: [400, 0.5, 0.2],
      ac: [180, 0.7, 0.14],
      vacuum: [320, 0.6, 0.22],
      hum: [60, 0.8, 0.2],
      deep: [45, 0.9, 0.22],
      hiss: [5000, 1.5, 0.15]
    };
    const p = presets[id] || [1000, 1, 0.18];
    playNoiseLoop(2, "pink", p[0], p[1], p[2]);
  }

  function playInstrument(id) {
    void playSample("instruments", id);
  }

  function playSound(group, id) {
    unlock();
    if (group === "animals") playAnimal(id);
    else if (group === "nature") playNature(id);
    else if (group === "whitenoise") playWhitenoise(id);
    else playInstrument(id);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  function ensureCategoryNav() {
    if (categoryNavEl) return categoryNavEl;
    categoryNavEl = document.createElement("nav");
    categoryNavEl.id = "sound-category-nav";
    categoryNavEl.className = "sound-category-nav";
    categoryNavEl.setAttribute("aria-label", "Sound categories");
    categoryNavEl.hidden = true;
    categoryNavEl.innerHTML = GROUPS.map(
      (g) =>
        `<button type="button" class="sound-category-btn" data-sound-group="${g.id}">${escapeHtml(g.label)}</button>`
    ).join("");
    document.body.appendChild(categoryNavEl);
    categoryNavEl.querySelectorAll(".sound-category-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setGroup(btn.dataset.soundGroup);
      });
    });
    return categoryNavEl;
  }

  function updateCategoryNav() {
    if (!categoryNavEl) return;
    categoryNavEl.querySelectorAll(".sound-category-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.soundGroup === activeGroup);
    });
  }

  function renderGrid() {
    if (!pageRoot) return;
    const grid = pageRoot.querySelector("#sound-grid");
    const title = pageRoot.querySelector("#sound-group-title");
    if (!grid || !title) return;

    const groupMeta = GROUPS.find((g) => g.id === activeGroup);
    title.textContent = groupMeta?.label || "Sound";

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
        playSound(activeGroup, selectedId);
      });
    });
  }

  function setGroup(groupId) {
    if (!CATALOG[groupId]) return;
    activeGroup = groupId;
    selectedId = null;
    stopLoops();
    updateCategoryNav();
    renderGrid();
  }

  function openCategoryPanel() {
    const nav = ensureCategoryNav();
    nav.hidden = false;
    updateCategoryNav();
  }

  function closeCategoryPanel() {
    if (categoryNavEl) categoryNavEl.hidden = true;
  }

  function renderPage(container) {
    pageRoot = container;
    container.innerHTML = `
      <article class="content-panel sound-panel">
        <div class="sound-header">
          <div>
            <h2>Sound</h2>
            <p class="sound-intro">우측 상단에서 카테고리를 고르고, 버튼을 눌러 소리를 들어 보세요.</p>
          </div>
        </div>
        <h3 class="sound-group-title" id="sound-group-title">동물</h3>
        <div id="sound-grid" class="sound-grid" role="listbox" aria-label="Sound items"></div>
        <p class="sound-footnote">동물·악기는 실제 녹음 샘플(CC0)이며, 자연·백색소음은 Web Audio로 생성됩니다. 자연·백색소음은 선택 시 반복 재생되며, 다른 소리를 누르면 멈춥니다.</p>
      </article>
    `;
    setGroup(activeGroup);
    openCategoryPanel();
  }

  function destroy() {
    stopLoops();
    stopSample();
    closeCategoryPanel();
    selectedId = null;
    pageRoot = null;
  }

  window.Sound = {
    renderPage,
    destroy,
    openCategoryPanel,
    closeCategoryPanel
  };
})();
