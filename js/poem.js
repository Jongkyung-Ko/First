(function () {
  "use strict";

  let pageRoot = null;
  let fsOverlay = null;
  let readOverlay = null;
  let readSeq = 0;
  let fsScrollRaf = null;
  let reciteSeq = 0;
  let bgmAudio = null;
  let bgmSourceUrl = "";
  let bgmPlaybackRate = 1;
  let poemAudio = null;
  let ttsAbort = null;

  const POEM_BGM_VOLUME = 0.24;
  const POEM_BGM_DUCK = 0.1;
  const POEM_SPEECH_VOLUME = 0.55;
  const POEM_SPEECH_PITCH = 0.92;
  const RATE_PRESETS = [0.7, 0.85, 1.0, 1.15, 1.35];
  const POEM_VOICE_OPTIONS = [
    { id: "google:ko-KR-Neural2-A", label: "Neural2 A ♀", engine: "google", voice: "ko-KR-Neural2-A", gender: "female" },
    { id: "google:ko-KR-Neural2-B", label: "Neural2 B ♂", engine: "google", voice: "ko-KR-Neural2-B", gender: "male" },
    { id: "google:ko-KR-Neural2-C", label: "Neural2 C ♀", engine: "google", voice: "ko-KR-Neural2-C", gender: "female" },
    { id: "browser:female", label: "브라우저 ♀", engine: "browser", gender: "female" },
    { id: "browser:male", label: "브라우저 ♂", engine: "browser", gender: "male" },
    { id: "off", label: "OFF (읽기만)", engine: "off" }
  ];
  const FEMALE_VOICE_PATTERNS = [
    /Heami/i, /SunHi/i, /Sun-Hi/i, /Haemi/i, /Yuna/i, /SeoYeon/i, /JiMin/i, /Female/i, /여성/i, /woman/i
  ];
  const MALE_VOICE_PATTERNS = [
    /InJoon/i, /Inmoon/i, /InMoon/i, /Hyunsu/i, /HyunSu/i, /Hyun-su/i, /Male/i, /남성/i, /\bJun\b/i, /Minho/i
  ];
  const wikiImageCache = Object.create(null);
  let speechGen = 0;
  let scrollAnimGen = 0;

  const state = {
    expandedPoetId: null,
    searchAuthor: "",
    searchOpen: false,
    worksByKey: {},
    selectedByKey: {},
    loadingKey: null,
    errorByKey: {},

    fs: {
      open: false,
      poetLabel: "",
      bgmGroupIndex: 0,
      queue: [],
      index: 0,
      rate: 1.0,
      voiceId: "google:ko-KR-Neural2-A",
      ttsFallbackNote: "",
      bgmOn: true,
      paused: false,
      playing: false,
      currentText: "",
      speechFullText: "",
      speechCharIndex: 0,
      poemWaitResolve: null
    },

    read: {
      open: false,
      poetLabel: "",
      queue: [],
      index: 0
    }
  };

  try {
    const savedVoice = localStorage.getItem("poem-voice-id");
    if (savedVoice && POEM_VOICE_OPTIONS.some((v) => v.id === savedVoice)) {
      state.fs.voiceId = savedVoice;
    } else if (savedVoice && savedVoice.startsWith("freetts:")) {
      state.fs.voiceId = savedVoice.includes("InJoon")
        ? "google:ko-KR-Neural2-B"
        : "google:ko-KR-Neural2-A";
    } else {
      const savedMode = localStorage.getItem("poem-narration-mode") || localStorage.getItem("poem-voice-gender");
      if (savedMode === "off") state.fs.voiceId = "off";
      else if (savedMode === "male") state.fs.voiceId = "google:ko-KR-Neural2-B";
      else if (savedMode === "female") state.fs.voiceId = "google:ko-KR-Neural2-A";
    }
    const savedRate = Number(localStorage.getItem("poem-recite-rate"));
    if (RATE_PRESETS.includes(savedRate)) {
      state.fs.rate = savedRate;
    }
  } catch (_) {
    /* ignore */
  }

  function getVoiceOption(id) {
    return POEM_VOICE_OPTIONS.find((v) => v.id === (id || state.fs.voiceId)) || POEM_VOICE_OPTIONS[0];
  }

  function isVoiceOff() {
    return state.fs.voiceId === "off";
  }

  function isBrowserVoiceId(id) {
    return String(id || state.fs.voiceId).startsWith("browser:");
  }

  function browserGenderFromVoiceId(id) {
    return String(id || state.fs.voiceId) === "browser:male" ? "male" : "female";
  }

  function narrationModeForSpeech() {
    if (isVoiceOff()) return "off";
    if (isBrowserVoiceId()) return browserGenderFromVoiceId();
    const opt = getVoiceOption();
    return opt.gender === "male" ? "male" : "female";
  }

  function profiles() {
    const excluded = new Set(window.POEM_COPYRIGHT_EXCLUDED_IDS || []);
    return (window.POEM_POET_PROFILES || []).filter((p) => !excluded.has(p.id));
  }

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
  }

  function assetBase() {
    if (location.protocol === "file:") return "./";
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function poetKey(poet) {
    if (!poet) return "";
    return poet.id || poet.gonguAuthor || poet.name || "";
  }

  function worksKeyForPoet(poet) {
    return `poet:${poetKey(poet)}`;
  }

  function worksKeyForSearch(author) {
    return `search:${String(author || "").trim()}`;
  }

  function poetImageUrl(profile) {
    if (profile?.imageUrl) return profile.imageUrl;
    if (profile?.imageFile) {
      return `${apiBase()}/api/poem/poet-image?file=${encodeURIComponent(profile.imageFile)}`;
    }
    return "";
  }

  async function fetchWikiThumbnail(name) {
    const key = String(name || "").trim();
    if (!key) return "";
    if (wikiImageCache[key]) return wikiImageCache[key];
    for (const lang of ["ko", "en"]) {
      try {
        const res = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`
        );
        if (!res.ok) continue;
        const data = await res.json();
        const src = data?.thumbnail?.source || "";
        if (src) {
          wikiImageCache[key] = src;
          return src;
        }
      } catch (_) {
        /* try next lang */
      }
    }
    wikiImageCache[key] = "";
    return "";
  }

  function hydratePoetImages(root) {
    if (!root) return;
    root.querySelectorAll("[data-poem-wiki-name]").forEach((wrap) => {
      const name = wrap.dataset.poemWikiName || "";
      const img = wrap.querySelector(".poem-poet-photo");
      const fallback = wrap.querySelector(".poem-poet-photo-fallback");
      if (!name || !img) return;
      void fetchWikiThumbnail(name).then((src) => {
        if (!src || !wrap.isConnected) return;
        img.src = src;
        img.classList.remove("is-broken");
        fallback?.classList.add("is-hidden");
      });
    });
  }

  function fallbackWorksForAuthor(author, poetId) {
    const fb = window.PoemFallback;
    let list = fb?.listByAuthor?.(author) || [];
    if (!list.length && poetId) {
      list = fb?.listByPoetId?.(poetId) || [];
    }
    return list.slice();
  }

  function isFallbackWorkId(workId) {
    return String(workId || "").startsWith("fb-");
  }

  function resolveBgmUrl(entry) {
    if (!entry) return "";
    if (typeof entry === "object" && entry.url) return entry.url;
    const file = typeof entry === "object" ? entry.file : entry;
    if (!file) return "";
    if (/^https?:\/\//i.test(file)) return file;
    return typeof window.resolveAudioAssetUrl === "function"
      ? window.resolveAudioAssetUrl(file)
      : assetBase() + String(file).replace(/^\.\//, "");
  }

  function ensureBgmAudio() {
    if (bgmAudio) return bgmAudio;
    bgmAudio = new Audio();
    bgmAudio.loop = true;
    bgmAudio.volume = POEM_BGM_VOLUME;
    bgmAudio.preload = "auto";
    return bgmAudio;
  }

  function resetBgmSource(url, playbackRate) {
    if (!bgmAudio || !url) return;
    bgmPlaybackRate = playbackRate || 1;
    if (bgmSourceUrl && bgmSourceUrl !== url) {
      bgmAudio.pause();
      bgmAudio.src = url;
      bgmAudio.load();
    } else if (!bgmAudio.src) {
      bgmAudio.src = url;
    }
    bgmSourceUrl = url;
    try {
      bgmAudio.playbackRate = bgmPlaybackRate;
    } catch (_) {
      /* ignore */
    }
  }

  function stopBgm() {
    if (!bgmAudio) return;
    bgmAudio.pause();
    try {
      bgmAudio.currentTime = 0;
    } catch (_) {
      /* ignore */
    }
  }

  function applyBgmVolume(duck) {
    if (!bgmAudio) return;
    const base = POEM_BGM_VOLUME;
    bgmAudio.volume = duck ? POEM_BGM_DUCK : base;
  }

  function syncBgmForGroup(groupIndex) {
    if (!state.fs.open || !state.fs.bgmOn) {
      stopBgm();
      return;
    }
    const group =
      typeof window.poemBgmGroupForIndex === "function"
        ? window.poemBgmGroupForIndex(groupIndex)
        : { url: "", playbackRate: 1 };
    const url = resolveBgmUrl(group);
    if (!url) return;
    const audio = ensureBgmAudio();
    resetBgmSource(url, group.playbackRate || 1);
    applyBgmVolume(state.fs.playing);
    audio.play().catch(() => {});
  }

  function toggleBgm() {
    state.fs.bgmOn = !state.fs.bgmOn;
    syncFsControls();
    if (state.fs.bgmOn) syncBgmForGroup(state.fs.bgmGroupIndex);
    else stopBgm();
  }

  function webSpeechSupported() {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    );
  }

  function sanitizeSpeechText(text) {
    return String(text || "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function koVoices() {
    if (!webSpeechSupported()) return [];
    return window.speechSynthesis.getVoices().filter((v) => (v.lang || "").toLowerCase().startsWith("ko"));
  }

  function voiceMatches(voice, patterns) {
    return patterns.some((re) => re.test(voice.name || ""));
  }

  function pickKoreanVoice(mode) {
    const want = mode || narrationModeForSpeech();
    if (want === "off") return null;
    const voices = koVoices();
    if (!voices.length) return null;
    const female = voices.filter((v) => voiceMatches(v, FEMALE_VOICE_PATTERNS));
    const male = voices.filter(
      (v) => voiceMatches(v, MALE_VOICE_PATTERNS) && !voiceMatches(v, FEMALE_VOICE_PATTERNS)
    );
    if (want === "male") {
      return (
        male.find((v) => v.localService) ||
        male[0] ||
        voices.find((v) => !voiceMatches(v, FEMALE_VOICE_PATTERNS)) ||
        voices[0]
      );
    }
    return female.find((v) => v.localService) || female[0] || voices[0];
  }

  function configureUtterance(utterance, rate) {
    utterance.lang = "ko-KR";
    utterance.rate = Math.min(2, Math.max(0.5, rate || state.fs.rate || 1));
    utterance.volume = POEM_SPEECH_VOLUME;
    utterance.pitch = POEM_SPEECH_PITCH;
    const voice = pickKoreanVoice(narrationModeForSpeech());
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "ko-KR";
    }
  }

  function saveReciteSettings() {
    try {
      localStorage.setItem("poem-voice-id", state.fs.voiceId);
      localStorage.setItem("poem-recite-rate", String(state.fs.rate));
    } catch (_) {
      /* ignore */
    }
  }

  function stopPoemAudio() {
    if (ttsAbort) {
      ttsAbort.abort();
      ttsAbort = null;
    }
    if (poemAudio) {
      try {
        poemAudio.pause();
      } catch (_) {
        /* ignore */
      }
      poemAudio = null;
    }
  }

  function buildTtsFallbackChain(opt) {
    if (opt.engine !== "google") return [];
    return [{ engine: "google", voice: opt.voice }];
  }

  async function fetchPoemTtsBlob(text, engine, voice) {
    ttsAbort = new AbortController();
    const res = await fetch(`${apiBase()}/api/books/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        engine,
        voice,
        rate: String(state.fs.rate),
        lang: "ko"
      }),
      signal: ttsAbort.signal
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const detail = data.detail;
      const msg = typeof detail === "string" ? detail : JSON.stringify(detail || `HTTP ${res.status}`);
      throw new Error(msg);
    }
    return res.blob();
  }

  function playPoemAudioBlob(blob, myGen) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      poemAudio = new Audio(url);
      poemAudio.playbackRate = state.fs.rate;
      applyBgmVolume(true);
      const scrollEl = fsOverlay?.querySelector("[data-poem-fs-scroll]");
      poemAudio.addEventListener(
        "loadedmetadata",
        () => {
          if (myGen !== speechGen || !scrollEl || isVoiceOff()) return;
          const dur = Math.max(4000, (poemAudio.duration / Math.max(0.5, state.fs.rate)) * 1000);
          startScrollAnimation(scrollEl, dur);
        },
        { once: true }
      );
      const finish = (result) => {
        URL.revokeObjectURL(url);
        poemAudio = null;
        ttsAbort = null;
        applyBgmVolume(false);
        resolve(result);
      };
      poemAudio.onended = () => {
        finish(myGen !== speechGen ? "interrupt" : "done");
      };
      poemAudio.onerror = () => finish(myGen !== speechGen ? "interrupt" : "done");
      poemAudio.play().catch(() => finish("error"));
    });
  }

  async function speakApiWithFallback(text) {
    const opt = getVoiceOption();
    if (opt.engine === "off") return "off";
    if (opt.engine === "browser") return speakFromCharIndex(0);

    const chain = buildTtsFallbackChain(opt);
    const myGen = speechGen;
    let lastErr = "";
    for (const item of chain) {
      if (myGen !== speechGen) return "interrupt";
      try {
        const blob = await fetchPoemTtsBlob(text, item.engine, item.voice);
        if (myGen !== speechGen) return "interrupt";
        state.fs.ttsFallbackNote =
          item.engine !== opt.engine ? `${ENGINE_LABEL[item.engine] || item.engine}로 재생` : "";
        syncFsControls();
        const result = await playPoemAudioBlob(blob, myGen);
        if (result === "done") return "done";
        if (result === "interrupt") return "interrupt";
      } catch (err) {
        lastErr = err.message || String(err);
      }
    }
    state.fs.ttsFallbackNote = "API 한도 초과 · 브라우저 음성";
    syncFsControls();
    if (myGen !== speechGen) return "interrupt";
    return speakFromCharIndex(0);
  }

  const ENGINE_LABEL = { google: "Cloud Neural2" };

  function getScrollTranslateY(el) {
    const m = String(el?.style?.transform || "").match(/translateY\(([-\d.]+)px\)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function bumpSpeechPlayback(restartScroll) {
    speechGen += 1;
    if (restartScroll) scrollAnimGen += 1;
    if (fsScrollRaf) {
      cancelAnimationFrame(fsScrollRaf);
      fsScrollRaf = null;
    }
    stopPoemAudio();
    if (!webSpeechSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
  }

  function resolvePoemWait(reason) {
    if (state.fs.poemWaitResolve) {
      const resolve = state.fs.poemWaitResolve;
      state.fs.poemWaitResolve = null;
      resolve(reason);
    }
  }

  function skipCurrentPoem() {
    reciteSeq += 1;
    bumpSpeechPlayback(true);
    applyBgmVolume(false);
    resolvePoemWait("skip");
  }

  function stopSpeech() {
    reciteSeq += 1;
    bumpSpeechPlayback(true);
    applyBgmVolume(false);
    state.fs.currentText = "";
    state.fs.speechFullText = "";
    state.fs.speechCharIndex = 0;
    resolvePoemWait("stop");
  }

  function setReciteRate(newRate) {
    const oldRate = state.fs.rate;
    if (newRate === oldRate) return;
    state.fs.rate = newRate;
    saveReciteSettings();
    syncFsControls();
    if (poemAudio) {
      try {
        poemAudio.playbackRate = newRate;
      } catch (_) {
        /* ignore */
      }
    }
    if (!state.fs.playing || isVoiceOff() || !state.fs.speechFullText) return;

    const scrollEl = fsOverlay?.querySelector("[data-poem-fs-scroll]");
    const wrap = fsOverlay?.querySelector(".poem-fs-scroll-wrap");
    if (scrollEl && wrap && !wrap.classList.contains("is-manual")) {
      const viewH = wrap.clientHeight || 280;
      const travel = scrollEl.scrollHeight + viewH;
      const currentY = getScrollTranslateY(scrollEl);
      const progress = Math.max(0, Math.min(1, (viewH - currentY) / travel));
      const remainingTravel = travel * (1 - progress);
      const remainingMs = Math.max(800, (remainingTravel / (28 * newRate)) * 1000);
      startScrollAnimationFrom(scrollEl, currentY, remainingMs, viewH, travel);
    }

    if (poemAudio) return;
    resumeSpeechFromCharIndex(state.fs.speechCharIndex, false);
  }

  function setVoiceId(voiceId) {
    const prev = state.fs.voiceId;
    if (prev === voiceId) return;
    state.fs.voiceId = voiceId;
    state.fs.ttsFallbackNote = "";
    saveReciteSettings();
    syncFsControls();
    updateFsScrollMode();

    if (isVoiceOff()) {
      bumpSpeechPlayback(true);
      applyBgmVolume(false);
      syncFsNavButtons();
      return;
    }

    if (state.fs.playing && state.fs.speechFullText) {
      if (prev === "off") {
        state.fs.speechCharIndex = 0;
        void replayCurrentSpeech(true);
      } else {
        void replayCurrentSpeech(false);
      }
    }
  }

  async function replayCurrentSpeech(restartScroll) {
    bumpSpeechPlayback(restartScroll);
    if (isVoiceOff() || !state.fs.speechFullText) return;
    const text = state.fs.speechFullText;
    const scrollEl = fsOverlay?.querySelector("[data-poem-fs-scroll]");
    if (restartScroll && scrollEl && !isVoiceOff()) {
      const dur = estimateSpeechMs(text, state.fs.rate);
      startScrollAnimation(scrollEl, dur);
    }
    const myGen = speechGen;
    const opt = getVoiceOption();
    let result;
    if (opt.engine === "browser") {
      result = await speakFromCharIndex(0);
    } else {
      result = await speakApiWithFallback(text);
    }
    if (result === "interrupt" && myGen !== speechGen) return;
  }

  function updateFsScrollMode() {
    const wrap = fsOverlay?.querySelector(".poem-fs-scroll-wrap");
    const scrollEl = fsOverlay?.querySelector("[data-poem-fs-scroll]");
    const hint = fsOverlay?.querySelector("[data-poem-fs-manual-hint]");
    if (!wrap) return;
    const manual = isVoiceOff();
    wrap.classList.toggle("is-manual", manual);
    if (hint) hint.hidden = !manual;
    if (manual && scrollEl) {
      scrollAnimGen += 1;
      scrollEl.style.transform = "none";
      wrap.scrollTop = 0;
    }
  }

  async function fetchWorks(author) {
    const q = String(author || "").trim();
    if (!q) return { results: [], fallback: true };
    try {
      const res = await fetch(
        `${apiBase()}/api/poem/works?${new URLSearchParams({ author: q, rows: "100" })}`
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.results)) {
        return data;
      }
    } catch (_) {
      /* fall through to offline cache */
    }
    const results = fallbackWorksForAuthor(q);
    return {
      results,
      count: results.length,
      author: q,
      fallback: true,
      attribution: results.length
        ? "출처: 공유마당 만료저작물 (오프라인 캐시)"
        : "공유마당 만료저작물만 표시합니다"
    };
  }

  async function fetchWorkDetail(workId) {
    if (isFallbackWorkId(workId)) {
      const hit = window.PoemFallback?.getWorkById?.(workId);
      if (hit) return hit;
      const cached = Object.values(state.worksByKey)
        .flat()
        .find((w) => w.id === workId);
      if (cached?.body) return cached;
      throw new Error("시 본문을 찾을 수 없습니다.");
    }
    try {
      const res = await fetch(`${apiBase()}/api/poem/work/${encodeURIComponent(workId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
    } catch (_) {
      /* fallback below */
    }
    const hit = window.PoemFallback?.getWorkById?.(workId);
    if (hit) return hit;
    throw new Error("시 본문을 불러오지 못했습니다.");
  }

  function getSelectedSet(key) {
    if (!state.selectedByKey[key]) state.selectedByKey[key] = new Set();
    return state.selectedByKey[key];
  }

  function getWorks(key) {
    return state.worksByKey[key] || [];
  }

  async function loadWorksForKey(key, author, poetId) {
    if (state.loadingKey === key) return;
    if (state.worksByKey[key]) return;
    state.loadingKey = key;
    state.errorByKey[key] = "";
    renderWorksPanel(key);
    try {
      const data = await fetchWorks(author);
      state.worksByKey[key] = data.results || [];
      if (!state.worksByKey[key].length) {
        state.errorByKey[key] = "등록된 시가 없습니다.";
      }
      const sel = getSelectedSet(key);
      state.worksByKey[key].forEach((w) => sel.add(w.id));
    } catch (err) {
      state.errorByKey[key] = err.message || "시 목록을 불러오지 못했습니다.";
      state.worksByKey[key] = fallbackWorksForAuthor(author, poetId);
      if (state.worksByKey[key].length) {
        state.errorByKey[key] = "";
        const sel = getSelectedSet(key);
        state.worksByKey[key].forEach((w) => sel.add(w.id));
      }
    } finally {
      state.loadingKey = null;
      renderWorksPanel(key);
    }
  }

  function renderPoetPhoto(profile) {
    const wikiName = profile.wikiName || profile.name || "";
    const initial = (profile.name || "?").charAt(0);
    return `
      <div class="poem-poet-photo-wrap" data-poem-wiki-name="${escapeHtml(wikiName)}">
        <img class="poem-poet-photo is-broken" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.classList.add('is-broken');var f=this.parentElement&&this.parentElement.querySelector('.poem-poet-photo-fallback');if(f)f.classList.remove('is-hidden');">
        <span class="poem-poet-photo-fallback" aria-hidden="true">${escapeHtml(initial)}</span>
      </div>`;
  }

  function renderFeaturedWorksList(profile) {
    const items = (profile.featuredWorks || [])
      .slice(0, 5)
      .map((w) => `<li>${escapeHtml(w)}</li>`)
      .join("");
    return items || `<li class="poem-poet-works-empty">—</li>`;
  }

  function renderPoetCard(profile, index) {
    const key = worksKeyForPoet(profile);
    const expanded = state.expandedPoetId === profile.id;
    const chronologyInline = profile.chronology
      ? `<span class="poem-poet-chronology-inline"><span>연대기</span> ${escapeHtml(profile.chronology)}</span>`
      : "";
    return `
      <article class="poem-poet-card${expanded ? " is-expanded" : ""}" id="poem-poet-${escapeHtml(profile.id)}" data-poet-index="${index}">
        <div class="poem-poet-header-row">
          ${renderPoetPhoto(profile)}
          <div class="poem-poet-quick-col">
            <h5 class="poem-poet-works-title">대표 시</h5>
            <ul class="poem-poet-works-list">${renderFeaturedWorksList(profile)}</ul>
          </div>
        </div>
        <div class="poem-poet-body">
          <div class="poem-poet-title-row">
            <h4 class="poem-poet-name">${escapeHtml(profile.name)}</h4>
            ${profile.years ? `<span class="poem-poet-meta-inline">${escapeHtml(profile.years)}</span>` : ""}
            ${chronologyInline}
          </div>
          <div class="poem-poet-bio-wrap is-collapsed" data-poem-bio-wrap>
            <p class="poem-poet-bio">${escapeHtml(profile.bio || "")}</p>
            ${profile.bioDetail ? `<p class="poem-poet-bio-extra">${escapeHtml(profile.bioDetail)}</p>` : ""}
            <button type="button" class="poem-poet-bio-toggle" aria-expanded="false">더 보기</button>
          </div>
          <button type="button" class="poem-btn poem-btn-primary poem-poet-listen" data-poet-id="${escapeHtml(profile.id)}">
            ${expanded ? "접기" : "시듣기"}
          </button>
        </div>
      </article>
      <div class="poem-work-panel-slot" data-work-slot="${escapeHtml(key)}" ${expanded ? "" : "hidden"}></div>`;
  }

  function renderWorksPanelHtml(key, authorLabel) {
    const works = getWorks(key);
    const sel = getSelectedSet(key);
    const loading = state.loadingKey === key;
    const error = state.errorByKey[key];
    const allChecked = works.length > 0 && works.every((w) => sel.has(w.id));
    const indeterminate = !allChecked && works.some((w) => sel.has(w.id));

    if (loading) {
      return `<div class="poem-work-panel"><p class="poem-work-loading">시 목록 불러오는 중…</p></div>`;
    }
    if (error) {
      return `<div class="poem-work-panel"><p class="poem-work-error">${escapeHtml(error)}</p></div>`;
    }
    if (!works.length) {
      return `<div class="poem-work-panel"><p class="poem-work-empty">등록된 시가 없습니다. 시인 검색을 이용해 보세요.</p></div>`;
    }

    const rows = works
      .map(
        (w) => `
        <label class="poem-work-row">
          <input type="checkbox" class="poem-work-check" data-work-key="${escapeHtml(key)}" data-work-id="${escapeHtml(w.id)}" ${sel.has(w.id) ? "checked" : ""}>
          <span class="poem-work-title">${escapeHtml(w.title)}</span>
          ${w.year ? `<span class="poem-work-year">${escapeHtml(w.year)}</span>` : ""}
        </label>`
      )
      .join("");

    return `
      <div class="poem-work-panel" data-work-panel="${escapeHtml(key)}">
        <div class="poem-work-panel-head">
          <h5>${escapeHtml(authorLabel)} — 시 ${works.length}편</h5>
          <label class="poem-work-select-all">
            <input type="checkbox" class="poem-work-select-all-input" data-work-key="${escapeHtml(key)}" ${allChecked ? "checked" : ""} ${indeterminate ? 'data-indeterminate="true"' : ""}>
            전체 선택
          </label>
        </div>
        <div class="poem-work-list">${rows}</div>
        <div class="poem-work-actions">
          <button type="button" class="poem-btn poem-btn-recite" data-recite-key="${escapeHtml(key)}" data-recite-label="${escapeHtml(authorLabel)}" ${sel.size ? "" : "disabled"}>
            시낭송 (${sel.size}편)
          </button>
          <button type="button" class="poem-btn poem-btn-read" data-read-key="${escapeHtml(key)}" data-read-label="${escapeHtml(authorLabel)}" ${sel.size ? "" : "disabled"}>
            시 보기 (${sel.size}편)
          </button>
        </div>
        <p class="poem-attribution">출처: <a href="https://gongu.copyright.or.kr/gongu/main/main.do" target="_blank" rel="noopener noreferrer">공유마당</a> 만료저작물 · 한국저작권위원회</p>
      </div>`;
  }

  function renderWorksPanel(key) {
    if (!pageRoot) return;
    const slot = pageRoot.querySelector(`[data-work-slot="${CSS.escape(key)}"]`);
    if (!slot) return;
    const poet = profiles().find((p) => worksKeyForPoet(p) === key);
    const authorLabel = poet?.name || state.searchAuthor || key.replace(/^search:/, "");
    slot.innerHTML = renderWorksPanelHtml(key, authorLabel);
    slot.hidden = false;
    syncSelectAllIndeterminate(key);
  }

  function syncSelectAllIndeterminate(key) {
    const panel = pageRoot?.querySelector(`[data-work-panel="${CSS.escape(key)}"]`);
    const allInput = panel?.querySelector(".poem-work-select-all-input");
    if (!allInput) return;
    const works = getWorks(key);
    const sel = getSelectedSet(key);
    const allChecked = works.length > 0 && works.every((w) => sel.has(w.id));
    const some = works.some((w) => sel.has(w.id));
    allInput.checked = allChecked;
    allInput.indeterminate = !allChecked && some;
  }

  function renderSearchSection() {
    const key = state.searchAuthor ? worksKeyForSearch(state.searchAuthor) : "";
    const hasSearch = Boolean(state.searchAuthor);
    return `
      <section class="poem-search-section" aria-label="시인 검색">
        <h3>시인 검색</h3>
        <p class="poem-search-hint">공유마당 만료저작물에서 시인 이름으로 시를 찾아 낭송할 수 있습니다.</p>
        <form class="poem-search-form" id="poem-search-form">
          <input type="search" class="poem-search-input" id="poem-search-input" placeholder="예: 윤동주, 김소월, 정지용…" value="${escapeHtml(state.searchAuthor)}" autocomplete="off">
          <button type="submit" class="poem-btn poem-btn-primary">검색</button>
          ${hasSearch ? `<button type="button" class="poem-btn poem-btn-ghost" id="poem-search-clear">초기화</button>` : ""}
        </form>
        ${hasSearch ? `<div class="poem-search-results" data-work-slot="${escapeHtml(key)}"></div>` : ""}
      </section>`;
  }

  function renderPageShell() {
    const cards = profiles()
      .map((p, i) => renderPoetCard(p, i))
      .join("");
    return `
      <article class="content-panel poem-panel">
        <header class="poem-panel-head">
          <h2>Poem</h2>
          <p class="poem-intro">한국 대표 시인 ${profiles().length}인의 네임카드와 공유마당 만료 시를 Cloud Neural2·FreeTTS 또는 브라우저 음성으로 낭송합니다. 시인 5명마다 다른 BGM이 재생됩니다.</p>
        </header>
        ${renderSearchSection()}
        <section class="poem-poet-gallery" aria-label="한국 시인 30인">
          <header class="poem-poet-gallery-head">
            <h3>대표 시인 30인</h3>
            <p>「시듣기」를 누르면 공유마당 시 목록이 펼쳐지고, 선택 후 「시낭송」으로 전체화면 낭송을 시작합니다.</p>
          </header>
          <div class="poem-poet-grid" id="poem-poet-grid">${cards}</div>
        </section>
      </article>`;
  }

  function initBioSummaryToggles(root) {
    root?.querySelectorAll("[data-poem-bio-wrap]").forEach((wrap) => {
      const btn = wrap.querySelector(".poem-poet-bio-toggle");
      if (!btn) return;
      btn.onclick = () => {
        const expanded = btn.getAttribute("aria-expanded") !== "true";
        wrap.classList.toggle("is-collapsed", !expanded);
        wrap.classList.toggle("is-expanded", expanded);
        btn.setAttribute("aria-expanded", expanded ? "true" : "false");
        btn.textContent = expanded ? "접기" : "더 보기";
      };
    });
  }

  function expandPoet(poetId) {
    const poet = profiles().find((p) => p.id === poetId);
    if (!poet) return;
    const wasExpanded = state.expandedPoetId === poetId;
    state.expandedPoetId = wasExpanded ? null : poetId;
    renderPoetGrid();
    if (!wasExpanded) {
      void loadWorksForKey(worksKeyForPoet(poet), poet.gonguAuthor || poet.name, poet.id);
    }
  }

  function renderPoetGrid() {
    const grid = pageRoot?.querySelector("#poem-poet-grid");
    if (!grid) return;
    grid.innerHTML = profiles().map((p, i) => renderPoetCard(p, i)).join("");
    initBioSummaryToggles(grid);
    hydratePoetImages(grid);
    if (state.expandedPoetId) {
      const poet = profiles().find((p) => p.id === state.expandedPoetId);
      if (poet) renderWorksPanel(worksKeyForPoet(poet));
    }
  }

  async function runSearch(author) {
    const q = String(author || "").trim();
    if (!q) return;
    state.searchAuthor = q;
    const key = worksKeyForSearch(q);
    delete state.worksByKey[key];
    delete state.errorByKey[key];
    const searchRoot = pageRoot?.querySelector(".poem-search-section");
    if (searchRoot) {
      const parent = pageRoot.querySelector(".poem-panel");
      const gallery = parent?.querySelector(".poem-poet-gallery");
      searchRoot.outerHTML = renderSearchSection();
      bindSearchEvents();
    }
    await loadWorksForKey(key, q);
    renderWorksPanel(key);
  }

  function bindSearchEvents() {
    pageRoot?.querySelector("#poem-search-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = pageRoot.querySelector("#poem-search-input");
      void runSearch(input?.value || "");
    });
    pageRoot?.querySelector("#poem-search-clear")?.addEventListener("click", () => {
      state.searchAuthor = "";
      delete state.worksByKey[worksKeyForSearch("")];
      const searchRoot = pageRoot?.querySelector(".poem-search-section");
      if (searchRoot) searchRoot.outerHTML = renderSearchSection();
      bindSearchEvents();
    });
  }

  function selectedWorksForKey(key) {
    const sel = getSelectedSet(key);
    return getWorks(key).filter((w) => sel.has(w.id));
  }

  function poetIndexForKey(key) {
    if (key.startsWith("poet:")) {
      const id = key.slice(5);
      return profiles().findIndex((p) => p.id === id);
    }
    if (key.startsWith("search:")) {
      const name = key.slice(7);
      let hash = 0;
      for (let i = 0; i < name.length; i += 1) {
        hash = (hash + name.charCodeAt(i)) % 6;
      }
      return hash * 5;
    }
    return 0;
  }

  function ensureFsOverlay() {
    if (fsOverlay?.querySelector("[data-poem-fs-voice-select]")) return;
    if (fsOverlay) fsOverlay.remove();
    fsOverlay = document.createElement("div");
    fsOverlay.id = "poem-recite-fs";
    fsOverlay.className = "poem-recite-fs";
    fsOverlay.hidden = true;
    fsOverlay.setAttribute("role", "dialog");
    fsOverlay.setAttribute("aria-modal", "true");
    fsOverlay.setAttribute("aria-label", "시낭송");
    const voiceOptions = POEM_VOICE_OPTIONS.map(
      (v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.label)}</option>`
    ).join("");
    fsOverlay.innerHTML = `
      <div class="poem-fs-top">
        <div class="poem-fs-controls-left">
          <label class="poem-fs-voice-label">
            <span class="poem-fs-voice-label-text">목소리</span>
            <select class="poem-fs-voice-select" data-poem-fs-voice-select aria-label="낭송 목소리">${voiceOptions}</select>
          </label>
          <p class="poem-fs-tts-note" data-poem-fs-tts-note hidden></p>
          <div class="poem-fs-rate" role="group" aria-label="낭송 속도">
            ${RATE_PRESETS.map(
              (r) =>
                `<button type="button" class="poem-fs-rate-btn" data-poem-fs-rate="${r}">${r}×</button>`
            ).join("")}
          </div>
        </div>
        <div class="poem-fs-top-right">
          <button type="button" class="poem-fs-bgm-btn is-active" data-poem-fs-bgm aria-pressed="true">🎵 BGM</button>
          <button type="button" class="poem-fs-close" data-poem-fs-close aria-label="닫기">✕</button>
        </div>
      </div>
      <div class="poem-fs-stage">
        <div class="poem-fs-poet" data-poem-fs-poet></div>
        <h2 class="poem-fs-title" data-poem-fs-title></h2>
        <div class="poem-fs-scroll-wrap">
          <div class="poem-fs-scroll" data-poem-fs-scroll></div>
        </div>
        <p class="poem-fs-manual-hint" data-poem-fs-manual-hint hidden>나레이션 OFF · 스크롤·드래그로 직접 읽을 수 있습니다</p>
        <div class="poem-fs-nav" data-poem-fs-nav>
          <button type="button" class="poem-btn poem-fs-nav-btn" data-poem-fs-prev disabled>← 이전 시</button>
          <button type="button" class="poem-btn poem-fs-nav-btn" data-poem-fs-next disabled>다음 시 →</button>
        </div>
        <p class="poem-fs-progress" data-poem-fs-progress></p>
        <p class="poem-fs-attribution">출처: 공유마당(한국저작권위원회) 만료저작물</p>
      </div>`;
    document.body.appendChild(fsOverlay);

    fsOverlay.querySelector("[data-poem-fs-close]")?.addEventListener("click", closeReciteFs);
    fsOverlay.querySelector("[data-poem-fs-bgm]")?.addEventListener("click", toggleBgm);
    fsOverlay.querySelector("[data-poem-fs-prev]")?.addEventListener("click", () => navigatePoem(-1));
    fsOverlay.querySelector("[data-poem-fs-next]")?.addEventListener("click", () => navigatePoem(1));
    fsOverlay.querySelector("[data-poem-fs-voice-select]")?.addEventListener("change", (e) => {
      setVoiceId(e.target.value);
    });
    fsOverlay.querySelectorAll("[data-poem-fs-rate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setReciteRate(Number(btn.dataset.poemFsRate) || 1);
      });
    });
  }

  function syncFsNavButtons() {
    const prevBtn = fsOverlay?.querySelector("[data-poem-fs-prev]");
    const nextBtn = fsOverlay?.querySelector("[data-poem-fs-next]");
    if (!prevBtn || !nextBtn) return;
    const open = state.fs.open && state.fs.queue.length > 0;
    nextBtn.disabled = !open;
    prevBtn.disabled = !open || state.fs.index <= 0;
    nextBtn.textContent =
      open && state.fs.index >= state.fs.queue.length - 1 ? "끝내기 →" : "다음 시 →";
  }

  function navigatePoem(delta) {
    if (!state.fs.open || !state.fs.queue.length) return;
    const target = state.fs.index + delta;
    if (delta > 0 && state.fs.index >= state.fs.queue.length - 1) {
      closeReciteFs();
      return;
    }
    if (target < 0 || target >= state.fs.queue.length) return;
    skipCurrentPoem();
    state.fs.index = target;
    syncFsControls();
    void runReciteQueue();
  }

  function syncFsControls() {
    if (!fsOverlay) return;
    const voiceSel = fsOverlay.querySelector("[data-poem-fs-voice-select]");
    if (voiceSel && voiceSel.value !== state.fs.voiceId) voiceSel.value = state.fs.voiceId;
    const noteEl = fsOverlay.querySelector("[data-poem-fs-tts-note]");
    if (noteEl) {
      const note = state.fs.ttsFallbackNote || "";
      noteEl.textContent = note;
      noteEl.hidden = !note;
    }
    fsOverlay.querySelectorAll("[data-poem-fs-rate]").forEach((btn) => {
      const r = Number(btn.dataset.poemFsRate);
      btn.classList.toggle("is-active", r === state.fs.rate);
      btn.setAttribute("aria-pressed", r === state.fs.rate ? "true" : "false");
    });
    const bgmBtn = fsOverlay.querySelector("[data-poem-fs-bgm]");
    if (bgmBtn) {
      bgmBtn.classList.toggle("is-active", state.fs.bgmOn);
      bgmBtn.setAttribute("aria-pressed", state.fs.bgmOn ? "true" : "false");
      bgmBtn.textContent = state.fs.bgmOn ? "🎵 BGM" : "🔇 BGM";
    }
    const progressEl = fsOverlay.querySelector("[data-poem-fs-progress]");
    if (progressEl && state.fs.queue.length) {
      progressEl.textContent = `${state.fs.index + 1} / ${state.fs.queue.length} · ${state.fs.poetLabel}`;
    }
    syncFsNavButtons();
  }

  function startScrollAnimationFrom(textEl, startY, durationMs, viewH, travel) {
    if (fsScrollRaf) cancelAnimationFrame(fsScrollRaf);
    if (!textEl) return;
    const animGen = scrollAnimGen;
    const start = performance.now();
    const endY = viewH - travel;
    const dur = Math.max(800, durationMs || 4000);

    textEl.style.transform = `translateY(${startY}px)`;

    const tick = (now) => {
      if (animGen !== scrollAnimGen || !state.fs.open || isVoiceOff()) return;
      const t = Math.min(1, (now - start) / dur);
      const y = startY + (endY - startY) * t;
      textEl.style.transform = `translateY(${y}px)`;
      if (t < 1) fsScrollRaf = requestAnimationFrame(tick);
    };
    fsScrollRaf = requestAnimationFrame(tick);
  }

  function startScrollAnimation(textEl, durationMs) {
    if (fsScrollRaf) cancelAnimationFrame(fsScrollRaf);
    const wrap = fsOverlay?.querySelector(".poem-fs-scroll-wrap");
    if (!textEl || !wrap || isVoiceOff()) return;
    const viewH = wrap.clientHeight || 280;
    const travel = textEl.scrollHeight + viewH;
    startScrollAnimationFrom(textEl, viewH, durationMs || travel / (28 * state.fs.rate), viewH, travel);
  }

  function estimateSpeechMs(text, rate) {
    const chars = String(text || "").length;
    const cps = 7.5 * (rate || 1);
    return Math.max(5000, (chars / cps) * 1000 + 1500);
  }

  function speakFromCharIndex(charIndex) {
    return new Promise((resolve) => {
      if (!webSpeechSupported() || isVoiceOff()) {
        resolve("done");
        return;
      }
      const full = state.fs.speechFullText || "";
      const remaining = full.slice(charIndex || 0);
      if (!remaining.trim()) {
        resolve("done");
        return;
      }
      const myGen = speechGen;
      window.speechSynthesis.getVoices();
      const utterance = new SpeechSynthesisUtterance(remaining);
      configureUtterance(utterance, state.fs.rate);
      applyBgmVolume(true);
      utterance.onboundary = (e) => {
        if (e.charIndex != null) state.fs.speechCharIndex = (charIndex || 0) + e.charIndex;
      };
      utterance.onend = () => {
        if (myGen !== speechGen) {
          resolve("interrupt");
          return;
        }
        state.fs.speechCharIndex = full.length;
        applyBgmVolume(false);
        resolve("done");
      };
      utterance.onerror = () => {
        if (myGen !== speechGen) resolve("interrupt");
        else resolve("done");
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  function resumeSpeechFromCharIndex(charIndex, restartScroll) {
    speechGen += 1;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
    if (isVoiceOff() || !state.fs.speechFullText) return;

    const scrollEl = fsOverlay?.querySelector("[data-poem-fs-scroll]");
    const wrap = fsOverlay?.querySelector(".poem-fs-scroll-wrap");
    if (restartScroll && scrollEl && wrap) {
      scrollAnimGen += 1;
      const viewH = wrap.clientHeight || 280;
      const travel = scrollEl.scrollHeight + viewH;
      const dur = estimateSpeechMs(state.fs.speechFullText.slice(charIndex || 0), state.fs.rate);
      startScrollAnimationFrom(scrollEl, viewH, dur, viewH, travel);
    }

    void speakFromCharIndex(charIndex || 0);
  }

  async function runSpeechUntilDone(text) {
    const mySeq = reciteSeq;
    state.fs.currentText = text;
    state.fs.speechFullText = text;
    state.fs.speechCharIndex = 0;
    updateFsScrollMode();

    if (isVoiceOff()) {
      syncFsNavButtons();
      await new Promise((resolve) => {
        state.fs.poemWaitResolve = resolve;
      });
      return;
    }

    const scrollEl = fsOverlay?.querySelector("[data-poem-fs-scroll]");
    const opt = getVoiceOption();
    let result;
    if (opt.engine === "browser") {
      const dur = estimateSpeechMs(text, state.fs.rate);
      if (scrollEl) startScrollAnimation(scrollEl, dur);
      result = await speakFromCharIndex(0);
    } else {
      result = await speakApiWithFallback(text);
    }

    if (mySeq !== reciteSeq) return;
    if (result === "interrupt" && isVoiceOff()) {
      updateFsScrollMode();
      syncFsNavButtons();
      await new Promise((resolve) => {
        state.fs.poemWaitResolve = resolve;
      });
    }
  }

  async function loadWorkBody(work) {
    let body = work.body || "";
    if (!body || (work.fallback && body.includes("API 연결"))) {
      try {
        const detail = await fetchWorkDetail(work.id);
        body = detail.body || body || detail.title || "";
      } catch (_) {
        body = body || "(본문을 불러오지 못했습니다)";
      }
    } else if (!isFallbackWorkId(work.id)) {
      try {
        const detail = await fetchWorkDetail(work.id);
        body = detail.body || body || detail.title || "";
      } catch (_) {
        body = body || "(본문을 불러오지 못했습니다)";
      }
    }
    return { title: work.title || "", body: body || "" };
  }

  function ensureReadOverlay() {
    if (readOverlay?.querySelector("[data-poem-read-body]")) return;
    if (readOverlay) readOverlay.remove();
    readOverlay = document.createElement("div");
    readOverlay.id = "poem-read-fs";
    readOverlay.className = "poem-read-fs";
    readOverlay.hidden = true;
    readOverlay.setAttribute("role", "dialog");
    readOverlay.setAttribute("aria-modal", "true");
    readOverlay.setAttribute("aria-label", "시 보기");
    readOverlay.innerHTML = `
      <div class="poem-read-top">
        <button type="button" class="poem-read-close" data-poem-read-close aria-label="닫기">✕</button>
      </div>
      <div class="poem-read-paper-wrap">
        <article class="poem-read-paper">
          <p class="poem-read-poet" data-poem-read-poet></p>
          <h2 class="poem-read-title" data-poem-read-title></h2>
          <div class="poem-read-body" data-poem-read-body></div>
          <p class="poem-read-attribution">출처: 공유마당(한국저작권위원회) 만료저작물</p>
        </article>
      </div>
      <div class="poem-read-nav">
        <button type="button" class="poem-btn poem-read-nav-btn" data-poem-read-prev disabled>← 이전 시</button>
        <span class="poem-read-progress" data-poem-read-progress></span>
        <button type="button" class="poem-btn poem-read-nav-btn" data-poem-read-next disabled>다음 시 →</button>
      </div>`;
    document.body.appendChild(readOverlay);

    readOverlay.querySelector("[data-poem-read-close]")?.addEventListener("click", closePoemReadFs);
    readOverlay.querySelector("[data-poem-read-prev]")?.addEventListener("click", () => navigateReadPoem(-1));
    readOverlay.querySelector("[data-poem-read-next]")?.addEventListener("click", () => navigateReadPoem(1));
  }

  function syncReadNav() {
    if (!readOverlay) return;
    const prevBtn = readOverlay.querySelector("[data-poem-read-prev]");
    const nextBtn = readOverlay.querySelector("[data-poem-read-next]");
    const progressEl = readOverlay.querySelector("[data-poem-read-progress]");
    const open = state.read.open && state.read.queue.length > 0;
    if (prevBtn) prevBtn.disabled = !open || state.read.index <= 0;
    if (nextBtn) nextBtn.disabled = !open;
    if (nextBtn && open) {
      nextBtn.textContent =
        state.read.index >= state.read.queue.length - 1 ? "끝내기 →" : "다음 시 →";
    }
    if (progressEl && open) {
      progressEl.textContent = `${state.read.index + 1} / ${state.read.queue.length}`;
    }
  }

  async function showReadPoem(work) {
    if (!state.read.open || !readOverlay) return;
    const poetEl = readOverlay.querySelector("[data-poem-read-poet]");
    const titleEl = readOverlay.querySelector("[data-poem-read-title]");
    const bodyEl = readOverlay.querySelector("[data-poem-read-body]");
    const paperWrap = readOverlay.querySelector(".poem-read-paper-wrap");
    if (!titleEl || !bodyEl) return;

    if (poetEl) poetEl.textContent = state.read.poetLabel;
    titleEl.textContent = work.title || "";
    bodyEl.textContent = "본문 불러오는 중…";
    if (paperWrap) paperWrap.scrollTop = 0;
    syncReadNav();

    const { title, body } = await loadWorkBody(work);
    if (!state.read.open) return;
    if (titleEl) titleEl.textContent = title;
    bodyEl.textContent = body;
    if (paperWrap) paperWrap.scrollTop = 0;
  }

  function navigateReadPoem(delta) {
    if (!state.read.open || !state.read.queue.length) return;
    if (delta > 0 && state.read.index >= state.read.queue.length - 1) {
      closePoemReadFs();
      return;
    }
    const target = state.read.index + delta;
    if (target < 0 || target >= state.read.queue.length) return;
    readSeq += 1;
    state.read.index = target;
    syncReadNav();
    void showReadPoem(state.read.queue[state.read.index]);
  }

  function openPoemReadFs(key, label) {
    const queue = selectedWorksForKey(key);
    if (!queue.length) return;
    closeReciteFs();
    ensureReadOverlay();
    state.read.open = true;
    state.read.poetLabel = label || "";
    state.read.queue = queue;
    state.read.index = 0;
    readSeq += 1;
    readOverlay.hidden = false;
    document.documentElement.classList.add("poem-read-immersive-lock");
    syncReadNav();
    void showReadPoem(queue[0]);
  }

  function closePoemReadFs() {
    state.read.open = false;
    readSeq += 1;
    if (readOverlay) readOverlay.hidden = true;
    document.documentElement.classList.remove("poem-read-immersive-lock");
  }

  async function reciteOneWork(work) {
    const mySeq = reciteSeq;
    if (!state.fs.open) return;
    const titleEl = fsOverlay?.querySelector("[data-poem-fs-title]");
    const scrollEl = fsOverlay?.querySelector("[data-poem-fs-scroll]");
    const poetEl = fsOverlay?.querySelector("[data-poem-fs-poet]");
    if (!titleEl || !scrollEl) return;

    titleEl.textContent = work.title || "";
    if (poetEl) poetEl.textContent = state.fs.poetLabel;
    scrollEl.textContent = "본문 불러오는 중…";
    syncFsControls();

    const { title, body } = await loadWorkBody(work);
    const fullText = sanitizeSpeechText(`${title}\n\n${body}`);
    scrollEl.textContent = fullText;
    if (isVoiceOff()) {
      scrollEl.style.transform = "none";
      wrapResetScroll();
    } else {
      scrollEl.style.transform = "translateY(0)";
    }

    state.fs.playing = true;
    await runSpeechUntilDone(fullText);
    if (mySeq !== reciteSeq) return;
    state.fs.playing = false;
    state.fs.currentText = "";
  }

  function wrapResetScroll() {
    const wrap = fsOverlay?.querySelector(".poem-fs-scroll-wrap");
    if (wrap) wrap.scrollTop = 0;
    updateFsScrollMode();
  }

  async function runReciteQueue() {
    const mySeq = reciteSeq;
    while (state.fs.open && state.fs.index < state.fs.queue.length) {
      if (mySeq !== reciteSeq) return;
      await reciteOneWork(state.fs.queue[state.fs.index]);
      if (!state.fs.open || mySeq !== reciteSeq) return;
      if (state.fs.index >= state.fs.queue.length - 1) {
        closeReciteFs();
        return;
      }
      state.fs.index += 1;
      syncFsControls();
    }
  }

  function openReciteFsWithQueue(queue, label, bgmGroupIndex) {
    if (!queue.length) return;
    closePoemReadFs();
    const opt = getVoiceOption();
    if (opt.engine === "browser" && !isVoiceOff() && !webSpeechSupported()) {
      alert("브라우저 음성을 지원하지 않습니다. Neural2 등 클라우드 목소리를 선택하세요.");
      state.fs.voiceId = "google:ko-KR-Neural2-A";
    }
    ensureFsOverlay();
    state.fs.open = true;
    state.fs.poetLabel = label || "";
    state.fs.queue = queue;
    state.fs.index = 0;
    state.fs.bgmOn = true;
    state.fs.bgmGroupIndex = Math.max(0, bgmGroupIndex || 0);
    try {
      const savedRate = Number(localStorage.getItem("poem-recite-rate"));
      if (RATE_PRESETS.includes(savedRate)) state.fs.rate = savedRate;
    } catch (_) {
      /* ignore */
    }
    fsOverlay.hidden = false;
    document.documentElement.classList.add("poem-fs-immersive-lock");
    syncFsControls();
    updateFsScrollMode();
    syncBgmForGroup(state.fs.bgmGroupIndex);
    reciteSeq += 1;
    void runReciteQueue();
  }

  function openReciteFs(key, label) {
    openReciteFsWithQueue(selectedWorksForKey(key), label, poetIndexForKey(key));
  }

  function closeReciteFs() {
    state.fs.open = false;
    state.fs.playing = false;
    stopSpeech();
    stopBgm();
    if (fsOverlay) fsOverlay.hidden = true;
    document.documentElement.classList.remove("poem-fs-immersive-lock");
  }

  function bindPageEvents() {
    pageRoot?.addEventListener("click", (e) => {
      const listenBtn = e.target.closest(".poem-poet-listen");
      if (listenBtn?.dataset.poetId) {
        expandPoet(listenBtn.dataset.poetId);
        return;
      }

      const reciteBtn = e.target.closest(".poem-btn-recite");
      if (reciteBtn?.dataset.reciteKey) {
        openReciteFs(reciteBtn.dataset.reciteKey, reciteBtn.dataset.reciteLabel || "");
        return;
      }

      const readBtn = e.target.closest(".poem-btn-read");
      if (readBtn?.dataset.readKey) {
        openPoemReadFs(readBtn.dataset.readKey, readBtn.dataset.readLabel || "");
      }
    });

    pageRoot?.addEventListener("change", (e) => {
      const allInput = e.target.closest(".poem-work-select-all-input");
      if (allInput?.dataset.workKey) {
        const key = allInput.dataset.workKey;
        const sel = getSelectedSet(key);
        const works = getWorks(key);
        if (allInput.checked) works.forEach((w) => sel.add(w.id));
        else sel.clear();
        renderWorksPanel(key);
        return;
      }

      const check = e.target.closest(".poem-work-check");
      if (check?.dataset.workKey && check.dataset.workId) {
        const key = check.dataset.workKey;
        const sel = getSelectedSet(key);
        if (check.checked) sel.add(check.dataset.workId);
        else sel.delete(check.dataset.workId);
        syncSelectAllIndeterminate(key);
        const panel = pageRoot.querySelector(`[data-work-panel="${CSS.escape(key)}"]`);
        const selCount = sel.size;
        panel?.querySelector("[data-recite-key]")?.toggleAttribute("disabled", selCount === 0);
        panel?.querySelector("[data-read-key]")?.toggleAttribute("disabled", selCount === 0);
        const reciteBtn = panel?.querySelector("[data-recite-key]");
        const readBtn = panel?.querySelector("[data-read-key]");
        if (reciteBtn) reciteBtn.textContent = `시낭송 (${selCount}편)`;
        if (readBtn) readBtn.textContent = `시 보기 (${selCount}편)`;
      }
    });

    bindSearchEvents();
  }

  function destroy() {
    closeReciteFs();
    closePoemReadFs();
    if (fsOverlay) {
      fsOverlay.remove();
      fsOverlay = null;
    }
    if (readOverlay) {
      readOverlay.remove();
      readOverlay = null;
    }
    pageRoot = null;
    bgmAudio = null;
    bgmSourceUrl = "";
    stopPoemAudio();
  }

  function renderPage(container) {
    destroy();
    if (!container) return;
    container.innerHTML = renderPageShell();
    pageRoot = container.querySelector(".poem-panel") || container;
    initBioSummaryToggles(pageRoot);
    hydratePoetImages(pageRoot);
    bindPageEvents();
    if (webSpeechSupported()) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        window.speechSynthesis.getVoices();
      });
    }
  }

  window.Poem = { renderPage, destroy };
})();
