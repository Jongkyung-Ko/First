(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;
  let loadingTimer = null;
  let loadingDotCount = 1;

  const TABS = [
    { id: "apod", label: "우주 사진", hint: "NASA APOD · Astronomy Picture of the Day" },
    { id: "planets", label: "태양계", hint: "NASA Image Library · 행성" }
  ];

  const LOAD_MORE_COUNT = 5;
  const APOD_COUNT = 20;
  const SPACE_CACHE_LS_KEY = "space-page-cache-v1";
  const EAGER_IMAGE_COUNT = 6;
  const SLIDE_INTERVAL_MS = 5000;
  const FADE_MS = 520;

  let fsOverlay = null;
  let fsEventsBound = false;
  let spaceFsImmersive = false;
  let fsPlanetLoadSeq = 0;
  let bgmAudio = null;
  let bgmUnlockBound = false;
  let bgmSourceUrl = "";

  const SPACE_BGM_FILE = "assets/audio/bgm/space-dream-strings.mp3";
  const SPACE_BGM_VOLUME = 0.45;
  const PLANET_ORDER = [
    "sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"
  ];
  const FS_DOTS_MAX = 24;

  const state = {
    tab: "apod",
    loading: false,
    loadingMore: false,
    error: "",
    payload: null,
    selectedPlanet: "earth",
    apodHasMore: true,
    planetHasMore: true,
    cache: {},
    fsOpen: false,
    fsIndex: 0,
    fsSlides: [],
    fsTimer: null,
    fsPreparing: false,
    bgmEnabled: true
  };

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
  }

  function assetBase() {
    if (location.protocol === "file:") return "./";
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function spaceBgmUrl() {
    return assetBase() + SPACE_BGM_FILE;
  }

  function ensureBgmAudio() {
    if (bgmAudio) return bgmAudio;
    bgmAudio = new Audio();
    bgmAudio.loop = true;
    bgmAudio.volume = SPACE_BGM_VOLUME;
    bgmAudio.preload = "auto";
    return bgmAudio;
  }

  function resetBgmSourceIfNeeded(url) {
    if (!bgmAudio || !url) return;
    if (bgmSourceUrl && bgmSourceUrl !== url) {
      bgmAudio.pause();
      bgmAudio.src = url;
      bgmAudio.load();
    } else if (!bgmAudio.src) {
      bgmAudio.src = url;
    }
    bgmSourceUrl = url;
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

  function syncBgmButton() {
    const btn = pageRoot?.querySelector("#space-bgm-btn");
    if (!btn) return;
    btn.classList.toggle("is-active", state.bgmEnabled);
    btn.setAttribute("aria-pressed", state.bgmEnabled ? "true" : "false");
    btn.textContent = state.bgmEnabled ? "🎵 BGM" : "🔇 BGM";
    syncFsBgmButton();
  }

  function syncFsBgmButton() {
    const btn = fsOverlay?.querySelector("[data-space-fs-bgm]");
    if (!btn) return;
    btn.classList.toggle("is-active", state.bgmEnabled);
    btn.setAttribute("aria-pressed", state.bgmEnabled ? "true" : "false");
    btn.textContent = state.bgmEnabled ? "🎵 BGM" : "🔇 BGM";
  }

  function syncBgmPlayback() {
    if (!pageRoot) return;
    syncBgmButton();
    if (!state.bgmEnabled) {
      stopBgm();
      return;
    }
    const audio = ensureBgmAudio();
    audio.volume = SPACE_BGM_VOLUME;
    resetBgmSourceIfNeeded(spaceBgmUrl());
    audio.play().catch(() => {});
  }

  function toggleBgm() {
    state.bgmEnabled = !state.bgmEnabled;
    syncBgmPlayback();
  }

  function bindBgmUnlock() {
    if (!pageRoot || bgmUnlockBound) return;
    bgmUnlockBound = true;
    const unlock = () => {
      if (state.bgmEnabled) syncBgmPlayback();
    };
    pageRoot.addEventListener("pointerdown", unlock, { once: true, passive: true });
    pageRoot.addEventListener("touchstart", unlock, { once: true, passive: true });
  }

  function mediaUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${apiBase()}${raw.startsWith("/") ? raw : `/${raw}`}`;
  }

  function renderLoadingStatus(baseText) {
    const base = String(baseText || "불러오는 중").replace(/\.+$/, "");
    return `<p class="space-status space-status-loading" data-space-loading data-loading-base="${escapeHtml(base)}" role="status" aria-live="polite">${escapeHtml(base)}</p>`;
  }

  function updateLoadingDots() {
    pageRoot?.querySelectorAll("[data-space-loading]").forEach((el) => {
      const base = el.dataset.loadingBase || "불러오는 중";
      el.textContent = base + ".".repeat(loadingDotCount);
    });
  }

  function syncLoadingAnimation() {
    if (state.loading || state.loadingMore) {
      if (!loadingTimer) {
        loadingDotCount = 1;
        loadingTimer = setInterval(() => {
          loadingDotCount = loadingDotCount >= 4 ? 1 : loadingDotCount + 1;
          updateLoadingDots();
        }, 400);
      }
      updateLoadingDots();
      return;
    }
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    loadingDotCount = 1;
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function imgLoadAttrs(index) {
    if (index < EAGER_IMAGE_COUNT) {
      const priority = index === 0 ? ' fetchpriority="high"' : "";
      return `loading="eager" decoding="async"${priority}`;
    }
    return 'loading="lazy" decoding="async"';
  }

  function loadSpaceCacheFromStorage() {
    try {
      const raw = localStorage.getItem(SPACE_CACHE_LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const cached = data?.cache;
      if (!cached || typeof cached !== "object") return;
      for (const [key, value] of Object.entries(cached)) {
        if (value && typeof value === "object") state.cache[key] = value;
      }
    } catch (_) {
      /* ignore */
    }
  }

  function saveSpaceCacheToStorage() {
    try {
      const snapshot = {};
      for (const [key, value] of Object.entries(state.cache)) {
        if (value && typeof value === "object") snapshot[key] = value;
      }
      localStorage.setItem(
        SPACE_CACHE_LS_KEY,
        JSON.stringify({ cache: snapshot, savedAt: Date.now() })
      );
    } catch (_) {
      /* ignore */
    }
  }

  function truncate(text, max) {
    const s = String(text || "").trim();
    if (s.length <= max) return s;
    return s.slice(0, max).trim() + "…";
  }

  function getApodItems() {
    const cached = state.cache.apod?.items;
    const live = state.payload?.items;
    if (cached?.length && live?.length && live.length > cached.length) {
      return live;
    }
    return cached || live || (state.payload?.item ? [state.payload.item] : []);
  }

  function apodToSlides(items) {
    return items
      .filter((item) => String(item.media_type || "image").toLowerCase() !== "video")
      .map((item) => {
        const imageUrl = mediaUrl(item.hdurl || item.thumbnail || item.url);
        if (!imageUrl) return null;
        const metaParts = [item.date, item.copyright ? `© ${item.copyright}` : ""].filter(Boolean);
        return {
          imageUrl,
          title: String(item.title || "Untitled"),
          caption: String(item.explanation || ""),
          meta: metaParts.join(" · ")
        };
      })
      .filter(Boolean);
  }

  function planetDetailToSlides(detail) {
    const planet = detail?.planet;
    const planetLabel = planet ? `${planet.emoji || ""} ${planet.label || ""}`.trim() : "";
    return (detail?.items || [])
      .map((item) => {
        const imageUrl = mediaUrl(item.thumbnail);
        if (!imageUrl) return null;
        return {
          imageUrl,
          title: String(item.title || "NASA Image"),
          caption: String(item.description || ""),
          meta: planetLabel
        };
      })
      .filter(Boolean);
  }

  function tagSlides(slides, section, sectionLabel) {
    const total = slides.length;
    return slides.map((slide, index) => ({
      ...slide,
      section,
      sectionLabel,
      indexInSection: index,
      totalInSection: total
    }));
  }

  async function ensureApodCached() {
    if (getApodItems().length) return;
    try {
      const data = await fetchJson(`/api/space/apod?count=${APOD_COUNT}`, { abort: false });
      state.cache.apod = { items: data.items || [], has_more: data.has_more !== false };
      if (state.tab === "apod" && state.payload) {
        state.payload.items = state.cache.apod.items;
      }
    } catch {
      /* apod optional if planets exist */
    }
  }

  async function loadPlanetGalleryAll(planetId) {
    const key = `planet:${planetId}`;
    let detail = state.cache[key];
    if (!detail) {
      detail = await fetchJson(`/api/space/planet/${encodeURIComponent(planetId)}?limit=12&skip=0`, {
        abort: false
      });
    }
    let items = [...(detail.items || [])];
    let skip = items.length;
    while (detail.has_more && skip < 500) {
      const more = await fetchJson(
        `/api/space/planet/${encodeURIComponent(planetId)}?limit=12&skip=${skip}`,
        { abort: false }
      );
      const fresh = more.items || [];
      if (!fresh.length) break;
      items = items.concat(fresh);
      skip = items.length;
      detail = { ...detail, ...more, items, has_more: more.has_more !== false };
    }
    detail.items = items;
    state.cache[key] = detail;
    return detail;
  }

  function getPlanetOrder() {
    const overview = state.cache.planets_overview;
    const planetIds = (overview?.items || []).map((row) => row.id).filter(Boolean);
    return planetIds.length ? planetIds : PLANET_ORDER;
  }

  function getInitialFullscreenSlides() {
    const apodSlides = apodToSlides(getApodItems());
    if (apodSlides.length) {
      return { slides: tagSlides(apodSlides, "apod", "우주"), skipPlanetIds: [] };
    }
    if (state.tab === "planets") {
      const detail = state.payload?.detail;
      const slides = planetDetailToSlides(detail);
      if (slides.length) {
        const planet = detail?.planet;
        const label = planet ? `${planet.emoji || ""} ${planet.label || ""}`.trim() : state.selectedPlanet;
        return { slides: tagSlides(slides, "planet", label), skipPlanetIds: [state.selectedPlanet] };
      }
    }
    return { slides: [], skipPlanetIds: [] };
  }

  async function appendPlanetSlidesInBackground(loadSeq, skipPlanetIds = []) {
    const skip = new Set(skipPlanetIds);
    let overview = state.cache.planets_overview;
    if (!overview) {
      try {
        overview = await fetchJson("/api/space/planets/overview?per_planet=1", { abort: false });
        state.cache.planets_overview = overview;
      } catch {
        overview = null;
      }
    }
    if (loadSeq !== fsPlanetLoadSeq || !state.fsOpen) return;

    for (const planetId of getPlanetOrder()) {
      if (loadSeq !== fsPlanetLoadSeq || !state.fsOpen) return;
      if (skip.has(planetId)) continue;
      try {
        const detail = await loadPlanetGalleryAll(planetId);
        if (loadSeq !== fsPlanetLoadSeq || !state.fsOpen) return;
        const label = detail.planet
          ? `${detail.planet.emoji || ""} ${detail.planet.label || ""}`.trim()
          : planetId;
        const slides = planetDetailToSlides(detail);
        if (!slides.length) continue;
        state.fsSlides.push(...tagSlides(slides, "planet", label));
        syncFsDots();
        if (state.fsSlides.length >= 2 && !state.fsTimer) startFsSlideshow();
      } catch {
        /* skip planet on failure */
      }
    }
  }

  function getFullscreenSlides() {
    if (state.tab === "apod") {
      return apodToSlides(getApodItems());
    }
    if (state.tab === "planets") {
      return planetDetailToSlides(state.payload?.detail);
    }
    return [];
  }

  function canOpenFullscreen() {
    if (state.loading || state.loadingMore || state.fsPreparing) return false;
    if (getApodItems().length > 0) return true;
    if (state.tab === "planets" && (state.payload?.detail?.items?.length || state.cache.planets_overview)) {
      return true;
    }
    return false;
  }

  function syncFullscreenButton() {
    const btn = pageRoot?.querySelector("#space-fullscreen");
    if (!btn) return;
    btn.disabled = !canOpenFullscreen();
  }

  function stopFsSlideshow() {
    if (state.fsTimer) {
      clearInterval(state.fsTimer);
      state.fsTimer = null;
    }
  }

  function ensureSpaceFullscreenOverlay() {
    if (fsOverlay && fsOverlay.querySelector("[data-space-fs-progress]")) return;
    if (fsOverlay) {
      fsOverlay.remove();
      fsOverlay = null;
    }
    fsOverlay = document.createElement("div");
    fsOverlay.id = "space-slideshow-fs";
    fsOverlay.className = "space-slideshow-fs";
    fsOverlay.hidden = true;
    fsOverlay.setAttribute("role", "dialog");
    fsOverlay.setAttribute("aria-modal", "true");
    fsOverlay.setAttribute("aria-label", "우주 전체화면 슬라이드쇼");
    fsOverlay.innerHTML = `
      <div class="space-fs-top">
        <button type="button" class="space-fs-bgm-btn is-active" data-space-fs-bgm aria-pressed="true" title="BGM">🎵 BGM</button>
        <button type="button" class="space-fs-close" data-space-fs-close aria-label="전체화면 닫기">✕</button>
      </div>
      <div class="space-fs-stage">
        <p class="space-fs-loading" data-space-fs-loading hidden role="status" aria-live="polite">슬라이드 준비 중…</p>
        <img class="space-fs-img" data-space-fs-img alt="" decoding="async">
      </div>
      <div class="space-fs-bottom">
        <p class="space-fs-progress" data-space-fs-progress></p>
        <p class="space-fs-title" data-space-fs-title></p>
        <p class="space-fs-meta" data-space-fs-meta></p>
        <p class="space-fs-caption" data-space-fs-caption></p>
        <div class="space-fs-dots" data-space-fs-dots aria-hidden="true"></div>
      </div>`;
    document.body.appendChild(fsOverlay);
    fsOverlay.querySelector("[data-space-fs-close]")?.addEventListener("click", closeSpaceFullscreen);
    fsOverlay.querySelector("[data-space-fs-bgm]")?.addEventListener("click", toggleBgm);
    fsOverlay.addEventListener("click", (event) => {
      if (event.target === fsOverlay) closeSpaceFullscreen();
    });
  }

  function bindSpaceFullscreenEvents() {
    if (fsEventsBound) return;
    fsEventsBound = true;
    document.addEventListener("keydown", (event) => {
      if (!state.fsOpen) return;
      if (event.key === "Escape") closeSpaceFullscreen();
      if (event.key === "ArrowRight") advanceFsSlide(1);
      if (event.key === "ArrowLeft") advanceFsSlide(-1);
    });
    document.addEventListener("visibilitychange", () => {
      if (!state.fsOpen) return;
      if (document.visibilityState === "hidden") stopFsSlideshow();
      else startFsSlideshow();
    });
    document.addEventListener("fullscreenchange", onSpaceFsFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onSpaceFsFullscreenChange);
  }

  function getSpaceFsFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function onSpaceFsFullscreenChange() {
    if (!fsOverlay) return;
    if (getSpaceFsFullscreenElement() === fsOverlay) {
      fsOverlay.classList.add("is-immersive");
      spaceFsImmersive = true;
      return;
    }
    if (!state.fsOpen && !state.fsPreparing) {
      fsOverlay.classList.remove("is-immersive");
      document.documentElement.classList.remove("space-fs-immersive-lock");
      spaceFsImmersive = false;
    }
  }

  async function enterSpaceFsImmersive() {
    if (!fsOverlay) return;
    try {
      if (fsOverlay.requestFullscreen) await fsOverlay.requestFullscreen();
      else if (fsOverlay.webkitRequestFullscreen) await fsOverlay.webkitRequestFullscreen();
      else throw new Error("fullscreen unsupported");
      fsOverlay.classList.add("is-immersive");
      spaceFsImmersive = true;
    } catch (_) {
      fsOverlay.classList.add("is-immersive");
      document.documentElement.classList.add("space-fs-immersive-lock");
      spaceFsImmersive = true;
    }
  }

  async function exitSpaceFsImmersive() {
    const fsEl = getSpaceFsFullscreenElement();
    if (fsEl) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (_) {
        /* ignore */
      }
    }
    if (fsOverlay) fsOverlay.classList.remove("is-immersive");
    document.documentElement.classList.remove("space-fs-immersive-lock");
    spaceFsImmersive = false;
  }

  function showFsLoading(show) {
    const el = fsOverlay?.querySelector("[data-space-fs-loading]");
    const img = fsOverlay?.querySelector("[data-space-fs-img]");
    if (el) el.hidden = !show;
    if (img && show) img.hidden = true;
  }

  function syncFsProgress() {
    const el = fsOverlay?.querySelector("[data-space-fs-progress]");
    if (!el || !state.fsSlides.length) {
      if (el) el.textContent = "";
      return;
    }
    const slide = state.fsSlides[state.fsIndex];
    const global = `${state.fsIndex + 1} / ${state.fsSlides.length}`;
    if (!slide) {
      el.textContent = global;
      return;
    }
    const sectionPart =
      slide.sectionLabel && slide.totalInSection
        ? `${slide.sectionLabel} ${slide.indexInSection + 1}/${slide.totalInSection}`
        : "";
    el.textContent = sectionPart ? `${sectionPart} · 전체 ${global}` : `전체 ${global}`;
  }

  function syncFsDots() {
    const dots = fsOverlay?.querySelector("[data-space-fs-dots]");
    if (!dots) return;
    syncFsProgress();
    if (state.fsSlides.length < 2 || state.fsSlides.length > FS_DOTS_MAX) {
      dots.innerHTML = "";
      return;
    }
    dots.innerHTML = state.fsSlides
      .map((_, i) => `<span class="space-fs-dot${i === state.fsIndex ? " is-active" : ""}"></span>`)
      .join("");
  }

  function syncFsCaption() {
    if (!fsOverlay || fsOverlay.hidden) return;
    const slide = state.fsSlides[state.fsIndex];
    if (!slide) return;
    const titleEl = fsOverlay.querySelector("[data-space-fs-title]");
    const metaEl = fsOverlay.querySelector("[data-space-fs-meta]");
    const captionEl = fsOverlay.querySelector("[data-space-fs-caption]");
    if (titleEl) titleEl.textContent = slide.title;
    if (metaEl) {
      metaEl.textContent = slide.meta || "";
      metaEl.hidden = !slide.meta;
    }
    if (captionEl) captionEl.textContent = slide.caption || "";
  }

  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
  }

  function updateFsView(options = {}) {
    const { fade = false } = options;
    if (!fsOverlay || fsOverlay.hidden || !state.fsOpen || !state.fsSlides.length) return;
    const slide = state.fsSlides[state.fsIndex];
    if (!slide) return;

    const img = fsOverlay.querySelector("[data-space-fs-img]");
    if (!img) return;

    const applySlide = () => {
      if (!state.fsOpen || state.fsSlides[state.fsIndex] !== slide) return;
      img.src = slide.imageUrl;
      img.alt = slide.title;
      img.hidden = false;
      img.classList.remove("is-fading-out");
      img.classList.add("is-fading-in");
      requestAnimationFrame(() => img.classList.remove("is-fading-in"));
      syncFsCaption();
      syncFsDots();
    };

    if (fade) {
      img.classList.add("is-fading-out");
      preloadImage(slide.imageUrl)
        .then(() => {
          if (!state.fsOpen || state.fsSlides[state.fsIndex] !== slide) return;
          setTimeout(applySlide, FADE_MS);
        })
        .catch(() => {
          img.classList.remove("is-fading-out");
          syncFsCaption();
          syncFsDots();
        });
      return;
    }

    preloadImage(slide.imageUrl)
      .then(applySlide)
      .catch(() => {
        syncFsCaption();
        syncFsDots();
      });
  }

  function advanceFsSlide(delta) {
    if (!state.fsOpen || state.fsSlides.length < 2) return;
    stopFsSlideshow();
    state.fsIndex = (state.fsIndex + delta + state.fsSlides.length) % state.fsSlides.length;
    updateFsView({ fade: true });
    startFsSlideshow();
  }

  function advanceFsSlideNext() {
    if (!state.fsOpen || !state.fsSlides.length) return;
    if (state.fsSlides.length < 2) return;
    state.fsIndex = (state.fsIndex + 1) % state.fsSlides.length;
    updateFsView({ fade: true });
  }

  function startFsSlideshow() {
    stopFsSlideshow();
    if (!state.fsOpen || state.fsSlides.length < 2) return;
    state.fsTimer = setInterval(() => {
      advanceFsSlideNext();
    }, SLIDE_INTERVAL_MS);
  }

  async function openSpaceFullscreen() {
    if (state.loading || state.fsPreparing) return;
    if (!canOpenFullscreen()) return;
    ensureSpaceFullscreenOverlay();
    bindSpaceFullscreenEvents();
    state.fsPreparing = true;
    syncFullscreenButton();
    state.fsOpen = true;
    fsOverlay.hidden = false;
    document.body.classList.add("space-fs-open");
    syncFsBgmButton();
    syncBgmPlayback();
    void enterSpaceFsImmersive();

    fsPlanetLoadSeq += 1;
    const loadSeq = fsPlanetLoadSeq;

    try {
      let { slides, skipPlanetIds } = getInitialFullscreenSlides();
      if (!slides.length) {
        showFsLoading(true);
        await ensureApodCached();
        ({ slides, skipPlanetIds } = getInitialFullscreenSlides());
      }
      if (!slides.length) {
        closeSpaceFullscreen();
        return;
      }
      state.fsSlides = slides;
      state.fsIndex = 0;
      showFsLoading(false);
      updateFsView({ fade: false });
      startFsSlideshow();
      void appendPlanetSlidesInBackground(loadSeq, skipPlanetIds);
    } catch (err) {
      closeSpaceFullscreen();
      state.error = err.message || "전체화면 슬라이드를 준비하지 못했습니다.";
      updateBodyOnly();
    } finally {
      state.fsPreparing = false;
      syncFullscreenButton();
    }
  }

  function closeSpaceFullscreen() {
    if (!state.fsOpen && !state.fsPreparing) return;
    fsPlanetLoadSeq += 1;
    state.fsOpen = false;
    state.fsPreparing = false;
    stopFsSlideshow();
    showFsLoading(false);
    void exitSpaceFsImmersive();
    if (fsOverlay) fsOverlay.hidden = true;
    document.body.classList.remove("space-fs-open");
    state.fsSlides = [];
    state.fsIndex = 0;
  }

  async function fetchJson(path, options = {}) {
    const useAbort = options.abort !== false;
    if (useAbort) {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();
    }
    const res = await fetch(`${apiBase()}${path}`, {
      signal: useAbort && abortCtrl ? abortCtrl.signal : undefined,
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || data.message || `HTTP ${res.status}`);
    }
    return data;
  }

  function renderTabNav() {
    return `
      <nav class="space-tab-nav" aria-label="우주 세부 메뉴">
        ${TABS.map(
          (tab) =>
            `<button type="button" class="space-tab-btn${tab.id === state.tab ? " is-active" : ""}" data-space-tab="${escapeHtml(tab.id)}" title="${escapeHtml(tab.hint)}">${escapeHtml(tab.label)}</button>`
        ).join("")}
      </nav>`;
  }

  function renderApodMedia(item, index = 0) {
    const img = mediaUrl(item.thumbnail || item.hdurl || item.url);
    const full = mediaUrl(item.hdurl || item.url || item.thumbnail);
    const isVideo = item.media_type === "video";
    if (!isVideo) {
      return `<a class="space-img-link" href="${escapeHtml(full)}" target="_blank" rel="noopener noreferrer"><img class="space-img" src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}" ${imgLoadAttrs(index)}></a>`;
    }
    if (item.embed_url) {
      return `
        <div class="space-media space-media-video">
          <iframe class="space-video-frame" src="${escapeHtml(item.embed_url)}" title="${escapeHtml(item.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>`;
    }
    return `
      <div class="space-media space-media-video">
        <p class="space-video-label">🎬 동영상 APOD</p>
        <a class="space-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">NASA에서 보기</a>
      </div>`;
  }

  function renderApodCard(item, index) {
    const isVideo = item.media_type === "video";
    return `
      <article class="space-card space-card-apod${isVideo ? " space-card-apod--video" : ""}">
        <p class="space-card-index">${index + 1}${isVideo ? " · 영상" : ""}</p>
        ${renderApodMedia(item, index)}
        <h3 class="space-card-title">${escapeHtml(item.title)}</h3>
        <p class="space-card-meta">${escapeHtml(item.date || "")}${item.copyright ? ` · © ${escapeHtml(item.copyright)}` : ""}</p>
        <p class="space-card-text">${escapeHtml(truncate(item.explanation, isVideo ? 480 : 320))}</p>
      </article>`;
  }

  function renderPlanetHeroCard(item) {
    const hero = item.hero;
    const accent = item.accent || "#6366f1";
    return `
      <button type="button" class="space-planet-card${item.id === state.selectedPlanet ? " is-active" : ""}" data-space-planet="${escapeHtml(item.id)}" style="--space-accent:${escapeHtml(accent)}">
        <span class="space-planet-emoji" aria-hidden="true">${escapeHtml(item.emoji || "🪐")}</span>
        <span class="space-planet-label">${escapeHtml(item.label)}</span>
        <span class="space-planet-label-en">${escapeHtml(item.label_en || "")}</span>
        ${hero?.thumbnail
          ? `<img class="space-planet-thumb" src="${escapeHtml(mediaUrl(hero.thumbnail))}" alt="" loading="lazy" decoding="async">`
          : `<span class="space-planet-thumb space-planet-thumb--empty">NASA</span>`}
      </button>`;
  }

  function renderPlanetGallery(items) {
    if (!items?.length) {
      return `<p class="space-status space-status-info">이 행성 이미지를 찾지 못했습니다.</p>`;
    }
    return `
      <div class="space-gallery">
        ${items
          .map(
            (item, index) => `
          <article class="space-card space-card-planet">
            <a class="space-img-link" href="${escapeHtml(mediaUrl(item.thumbnail))}" target="_blank" rel="noopener noreferrer">
            <img class="space-img" src="${escapeHtml(mediaUrl(item.thumbnail))}" alt="${escapeHtml(item.title)}" ${imgLoadAttrs(index)}>
            </a>
            <h3 class="space-card-title">${escapeHtml(truncate(item.title, 80))}</h3>
            <p class="space-card-text">${escapeHtml(truncate(item.description, 200))}</p>
          </article>`
          )
          .join("")}
      </div>`;
  }

  function renderLoadMoreButton() {
    if (state.loadingMore) {
      return `<div class="space-load-more">${renderLoadingStatus("불러오는 중")}</div>`;
    }
    if (state.tab === "apod") {
      return `
      <div class="space-load-more">
        <button type="button" class="space-btn space-btn-load" id="space-load-more">요청</button>
        <span class="space-load-more-hint">클릭하면 우주 사진 ${APOD_COUNT}장을 새로 받아옵니다</span>
      </div>`;
    }
    const hasMore = state.planetHasMore;
    if (!hasMore) {
      return `<div class="space-load-more"><p class="space-status space-status-info">더 이상 불러올 이미지가 없습니다.</p></div>`;
    }
    return `
      <div class="space-load-more">
        <button type="button" class="space-btn space-btn-load" id="space-load-more">요청</button>
        <span class="space-load-more-hint">클릭하면 이미지 ${LOAD_MORE_COUNT}장을 더 불러옵니다</span>
      </div>`;
  }

  function renderBody() {
    if (state.loading) {
      return renderLoadingStatus("불러오는 중");
    }
    if (state.error) {
      return `<p class="space-status space-status-error" role="alert">${escapeHtml(state.error)}</p>`;
    }
    const payload = state.payload;
    if (!payload) {
      return `<p class="space-status space-status-info">탭을 선택하면 NASA 이미지가 표시됩니다.</p>`;
    }

    if (state.tab === "apod") {
      const items = payload.items || (payload.item ? [payload.item] : []);
      if (!items.length) {
        return `<p class="space-status space-status-info">표시할 우주 사진이 없습니다.</p>`;
      }
      return `
        <div class="space-apod-grid">${items.map((item, i) => renderApodCard(item, i)).join("")}</div>
        ${renderLoadMoreButton()}`;
    }

    if (state.tab === "planets") {
      const overview = payload.overview?.items || [];
      const detail = payload.detail;
      return `
        <div class="space-planets-layout">
          <div class="space-planet-nav" role="tablist" aria-label="태양계 행성">
            ${overview.map(renderPlanetHeroCard).join("")}
          </div>
          <section class="space-planet-detail" aria-live="polite">
            ${detail?.planet
              ? `<header class="space-planet-head"><span class="space-planet-head-emoji">${escapeHtml(detail.planet.emoji || "")}</span><h3>${escapeHtml(detail.planet.label)} <span class="space-planet-head-en">${escapeHtml(detail.planet.label_en || "")}</span></h3></header>`
              : ""}
            ${renderPlanetGallery(detail?.items || [])}
            ${renderLoadMoreButton()}
          </section>
        </div>`;
    }

    return "";
  }

  function renderPageShell() {
    if (!pageRoot) return;
    pageRoot.innerHTML = `
      <article class="content-panel space-panel">
        <header class="space-header">
          <h2>우주</h2>
          <p class="space-intro">NASA APOD와 Image Library에서 골라 서버에 저장한 우주·태양계 사진을 보여줍니다. 4시간마다 새 사진으로 갱신됩니다.</p>
        </header>
        ${renderTabNav()}
        <div class="space-toolbar">
          <button type="button" class="space-btn space-btn-primary" id="space-refresh">다시 불러오기</button>
          <button type="button" class="space-btn space-bgm-btn is-active" id="space-bgm-btn" aria-pressed="true" title="우주 BGM">🎵 BGM</button>
          <button type="button" class="space-btn space-fs-btn" id="space-fullscreen" title="우주·태양계 전체 슬라이드쇼" aria-label="우주·태양계 전체 슬라이드쇼" disabled><svg class="space-fs-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>전체화면</button>
        </div>
        <section class="space-body" id="space-body" aria-live="polite">
          ${renderBody()}
        </section>
        <p class="space-footnote">
          API:
          <a href="https://api.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA Open APIs</a>
          ·
          <a href="https://apod.nasa.gov/apod/astropix.html" target="_blank" rel="noopener noreferrer">APOD</a>
          ·
          <a href="https://images.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA Image Library</a>
          · BGM: <a href="https://mixkit.co/free-stock-music/" target="_blank" rel="noopener noreferrer">Mixkit</a> (Arulo)
        </p>
      </article>`;
    bindEvents();
    bindBgmUnlock();
    syncBgmButton();
    syncFullscreenButton();
    syncLoadingAnimation();
  }

  function updateBodyOnly() {
    const body = pageRoot?.querySelector("#space-body");
    if (body) body.innerHTML = renderBody();
    pageRoot?.querySelectorAll(".space-tab-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.spaceTab === state.tab);
    });
    pageRoot?.querySelectorAll("[data-space-planet]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.spacePlanet === state.selectedPlanet);
    });
    pageRoot?.querySelector("#space-load-more")?.addEventListener("click", () => {
      void loadMore();
    });
    syncFullscreenButton();
    syncLoadingAnimation();
  }

  async function loadApod(forceRefresh) {
    const key = "apod";
    if (!forceRefresh && state.cache[key]) {
      state.payload = state.cache[key];
      state.apodHasMore = false;
      state.loading = false;
      state.error = "";
      updateBodyOnly();
      return;
    }
    const showSpinner = !state.cache[key]?.items?.length;
    if (showSpinner) {
      state.loading = true;
      state.error = "";
      updateBodyOnly();
    }
    try {
      const refreshQs = forceRefresh ? "&refresh=1" : "";
      const data = await fetchJson(`/api/space/apod?count=${APOD_COUNT}${refreshQs}`);
      state.cache[key] = { items: data.items || [], has_more: false };
      state.payload = state.cache[key];
      state.apodHasMore = false;
      saveSpaceCacheToStorage();
    } catch (err) {
      if (err.name === "AbortError") return;
      if (state.cache[key]?.items?.length) {
        state.payload = state.cache[key];
        state.error = "";
      } else {
        state.error = err.message || "우주 사진을 불러오지 못했습니다.";
      }
    } finally {
      state.loading = false;
      updateBodyOnly();
    }
  }

  async function refreshApodGallery() {
    const data = await fetchJson(`/api/space/apod?count=${APOD_COUNT}&refresh=1`, { abort: false });
    const items = data.items || [];
    state.cache.apod = { items, has_more: false };
    state.payload = state.cache.apod;
    state.apodHasMore = false;
    saveSpaceCacheToStorage();
  }

  async function loadPlanetDetail(planetId, forceRefresh) {
    const detailKey = `planet:${planetId}`;
    if (!forceRefresh && state.cache[detailKey]) {
      return state.cache[detailKey];
    }
    const data = await fetchJson(`/api/space/planet/${encodeURIComponent(planetId)}?limit=8&skip=0`);
    state.cache[detailKey] = data;
    return data;
  }

  async function loadMorePlanet() {
    const detail = state.payload?.detail;
    if (!detail) return;
    const items = detail.items || [];
    const skip = items.length;
    const planetId = detail.planet?.id || state.selectedPlanet;
    const data = await fetchJson(
      `/api/space/planet/${encodeURIComponent(planetId)}?limit=${LOAD_MORE_COUNT}&skip=${skip}`,
      { abort: false }
    );
    const fresh = data.items || [];
    if (!fresh.length) {
      state.planetHasMore = false;
      return;
    }
    detail.items = items.concat(fresh);
    detail.has_more = data.has_more !== false;
    state.planetHasMore = detail.has_more;
    state.cache[`planet:${planetId}`] = detail;
    if (state.payload) state.payload.detail = detail;
    if (state.cache.planets) state.cache.planets.detail = detail;
    saveSpaceCacheToStorage();
  }

  async function loadPlanets(forceRefresh) {
    const key = "planets";
    if (!forceRefresh && state.cache[key]) {
      state.payload = state.cache[key];
      state.planetHasMore = state.payload.detail?.has_more !== false;
      state.loading = false;
      state.error = "";
      updateBodyOnly();
      return;
    }

    const cachedOverview = !forceRefresh ? state.cache.planets_overview : null;
    const cachedDetail = !forceRefresh ? state.cache[`planet:${state.selectedPlanet}`] : null;
    const canShowPartial = Boolean(cachedOverview || cachedDetail);

    state.loading = !canShowPartial;
    state.error = "";
    if (canShowPartial) {
      state.payload = { overview: cachedOverview, detail: cachedDetail };
      updateBodyOnly();
    } else {
      updateBodyOnly();
    }

    try {
      let overview = cachedOverview;
      if (!overview || forceRefresh) {
        overview = await fetchJson("/api/space/planets/overview?per_planet=1");
        state.cache.planets_overview = overview;
      }
      const detail = await loadPlanetDetail(state.selectedPlanet, forceRefresh);
      state.cache[key] = { overview, detail };
      state.payload = state.cache[key];
      state.planetHasMore = detail.has_more !== false;
      saveSpaceCacheToStorage();
    } catch (err) {
      if (err.name === "AbortError") return;
      if (state.payload?.overview || state.payload?.detail) {
        state.error = "";
      } else {
        state.error = err.message || "행성 사진을 불러오지 못했습니다.";
      }
    } finally {
      state.loading = false;
      updateBodyOnly();
    }
  }

  async function loadMore() {
    if (state.loading || state.loadingMore) return;
    state.loadingMore = true;
    state.error = "";
    updateBodyOnly();
    try {
      if (state.tab === "apod") {
        await refreshApodGallery();
      } else if (state.tab === "planets") {
        await loadMorePlanet();
      }
    } catch (err) {
      state.error = err.message || "추가 이미지를 불러오지 못했습니다.";
    } finally {
      state.loadingMore = false;
      updateBodyOnly();
      syncFullscreenButton();
    }
  }

  async function loadTab(tabId, forceRefresh) {
    if (state.fsOpen) closeSpaceFullscreen();
    state.tab = tabId;
    state.error = "";
    if (tabId === "apod") {
      await loadApod(forceRefresh);
      return;
    }
    if (tabId === "planets") {
      await loadPlanets(forceRefresh);
    }
  }

  function bindEvents() {
    if (!pageRoot || pageRoot.dataset.spaceBound) return;
    pageRoot.dataset.spaceBound = "1";

    pageRoot.addEventListener("click", (event) => {
      const planetBtn = event.target.closest("[data-space-planet]");
      if (planetBtn) {
        const id = planetBtn.dataset.spacePlanet;
        if (!id || id === state.selectedPlanet) return;
        if (state.fsOpen) closeSpaceFullscreen();
        state.selectedPlanet = id;
        const detailKey = `planet:${id}`;
        if (state.cache[detailKey]) {
          if (state.payload) state.payload.detail = state.cache[detailKey];
          state.planetHasMore = state.cache[detailKey].has_more !== false;
          state.loading = false;
          state.error = "";
          updateBodyOnly();
          return;
        }
        state.loading = true;
        state.planetHasMore = true;
        updateBodyOnly();
        void loadPlanetDetail(id, false)
          .then((detail) => {
            if (state.payload) state.payload.detail = detail;
            state.planetHasMore = detail.has_more !== false;
            state.loading = false;
            if (state.cache.planets) state.cache.planets.detail = detail;
            saveSpaceCacheToStorage();
            updateBodyOnly();
          })
          .catch((err) => {
            state.error = err.message || "행성 사진을 불러오지 못했습니다.";
            state.loading = false;
            updateBodyOnly();
          });
        return;
      }
    });

    pageRoot.querySelectorAll("[data-space-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabId = btn.dataset.spaceTab;
        if (!tabId || tabId === state.tab) return;
        void loadTab(tabId, false);
      });
    });

    pageRoot.querySelector("#space-refresh")?.addEventListener("click", () => {
      if (state.fsOpen) closeSpaceFullscreen();
      if (state.tab === "apod") delete state.cache.apod;
      if (state.tab === "planets") {
        delete state.cache.planets_overview;
        delete state.cache[`planet:${state.selectedPlanet}`];
        delete state.cache.planets;
      }
      state.apodHasMore = false;
      state.planetHasMore = true;
      void loadTab(state.tab, true);
    });

    pageRoot.querySelector("#space-fullscreen")?.addEventListener("click", () => {
      void openSpaceFullscreen();
    });

    pageRoot.querySelector("#space-bgm-btn")?.addEventListener("click", () => {
      toggleBgm();
    });
  }

  function renderPage(container) {
    pageRoot = container;
    state.tab = "apod";
    state.loadingMore = false;
    state.error = "";
    state.payload = null;
    state.selectedPlanet = "earth";
    state.apodHasMore = false;
    state.planetHasMore = true;
    state.cache = {};
    state.bgmEnabled = true;
    bgmUnlockBound = false;
    loadSpaceCacheFromStorage();
    const cachedApod = state.cache.apod;
    if (cachedApod?.items?.length) {
      state.payload = cachedApod;
      state.loading = false;
    } else {
      state.loading = true;
    }
    renderPageShell();
    void loadTab("apod", false);
  }

  function destroy() {
    closeSpaceFullscreen();
    void exitSpaceFsImmersive();
    stopBgm();
    if (bgmAudio) {
      bgmAudio.src = "";
      bgmAudio = null;
      bgmSourceUrl = "";
    }
    bgmUnlockBound = false;
    abortCtrl?.abort();
    abortCtrl = null;
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    loadingDotCount = 1;
    if (fsOverlay) {
      fsOverlay.remove();
      fsOverlay = null;
    }
    fsEventsBound = false;
    if (pageRoot) delete pageRoot.dataset.spaceBound;
    pageRoot = null;
  }

  window.Space = {
    renderPage,
    destroy,
    leavePage: destroy
  };
})();
