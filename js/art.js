(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;
  let bgmAudio = null;
  let bgmUnlockBound = false;
  let bgmSourceUrl = "";
  let loadingTimer = null;
  let loadingDotCount = 1;
  let fsOverlay = null;
  let fsEventsBound = false;
  let wakeLock = null;

  const ART_BGM_SRC = "/api/art/bgm";
  const ART_BGM_VOLUME = 0.5;
  const GENRE_CACHE_LS_KEY = "art-genre-works-v4";
  const ART_FETCH_FAST = { fast: true };
  const ART_FETCH_FULL = { fast: false };

  const STATIC_GENRES = [
    { id: "masterpiece", label: "명작", label_en: "Masterpieces", hint: "세계에서 가장 유명한 그림 40선" },
    { id: "history", label: "역사화", label_en: "History Painting", hint: "역사·신화·종교적 장면을 그린 회화" },
    { id: "portrait", label: "초상화", label_en: "Portrait", hint: "인물의 얼굴과 성격을 담은 회화" },
    { id: "landscape", label: "풍경화", label_en: "Landscape", hint: "자연과 풍경을 주제로 한 회화" },
    { id: "genre", label: "풍속화", label_en: "Genre Painting", hint: "일상과 풍속을 담은 회화" },
    { id: "still_life", label: "정물화", label_en: "Still Life", hint: "정물·꽃·과일 등을 배치한 회화" }
  ];

  const STATIC_ERAS = [
    { id: "renaissance", label: "르네상스", period: "15–16세기", artists: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Titian", "Sandro Botticelli"] },
    { id: "baroque", label: "바로크", period: "17세기", artists: ["Rembrandt", "Caravaggio", "Peter Paul Rubens", "Diego Velázquez", "Artemisia Gentileschi"] },
    { id: "rococo", label: "로코코", period: "18세기 초", artists: ["Jean-Antoine Watteau", "François Boucher", "Jean-Honoré Fragonard", "Giovanni Battista Tiepolo", "Canaletto"] },
    { id: "romanticism", label: "낭만주의", period: "18–19세기", artists: ["Eugène Delacroix", "Francisco Goya", "J.M.W. Turner", "John Constable", "Jacques-Louis David"] },
    { id: "impressionism", label: "인상주의", period: "19세기 후반", artists: ["Claude Monet", "Edgar Degas", "Pierre-Auguste Renoir", "Camille Pissarro", "Mary Cassatt"] },
    { id: "modern", label: "근대·현대", period: "19–20세기", artists: ["Vincent van Gogh", "Paul Cézanne", "Paul Gauguin", "Henri Matisse", "Pablo Picasso"] }
  ];

  function artistPortraitFields(name) {
    const q = encodeURIComponent(name);
    const preview = `${apiBase()}/api/art/portrait?name=${q}&w=120`;
    const thumb = `${apiBase()}/api/art/portrait?name=${q}&w=200`;
    const image = `${apiBase()}/api/art/portrait?name=${q}&w=320`;
    return {
      preview_url: preview,
      thumb_url: thumb,
      image_url: image,
      direct_preview_url: preview,
      direct_thumb_url: thumb,
      direct_image_url: image,
      lqip: ""
    };
  }

  function staticErasSkeleton() {
    return STATIC_ERAS.map((era) => ({
      id: era.id,
      label: era.label,
      period: era.period,
      _samplesLoaded: false,
      artists: era.artists.map((name) => ({
        name,
        life: "",
        description: `${name}은(는) ${era.label} 시기를 대표하는 화가입니다.`,
        sample_works: [],
        ...artistPortraitFields(name)
      }))
    }));
  }

  function instantWorksForGenre(genreId) {
    const list = (window.ART_INSTANT_BY_GENRE || {})[genreId];
    return list ? list.map((work) => ({ ...work })) : [];
  }

  function loadGenreCacheFromStorage() {
    try {
      const raw = localStorage.getItem(GENRE_CACHE_LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;
      for (const [genreId, entry] of Object.entries(data)) {
        if (entry?.works?.length) genreWorksCache.set(genreId, entry);
      }
    } catch (_) {
      /* ignore */
    }
  }

  function persistGenreCacheToStorage() {
    try {
      if (!genreWorksCache.size) return;
      localStorage.setItem(GENRE_CACHE_LS_KEY, JSON.stringify(Object.fromEntries(genreWorksCache)));
    } catch (_) {
      /* ignore */
    }
  }

  const state = {
    genres: [],
    genre: "masterpiece",
    works: [],
    worksTitle: "",
    worksSubtitle: "",
    eras: [],
    selectedEraId: "",
    loading: false,
    worksLoading: false,
    error: "",
    artistMode: false,
    selectedArtist: null,
    selectedWorkIndex: 0,
    slideshowInterval: 5000,
    slideshowTimer: null,
    thumbScrollRaf: null,
    thumbFlowOffset: 0,
    bgmEnabled: true,
    worksUpdatedAt: "",
    worksRefreshing: false,
    mainImageLoading: false,
    fsOpen: false,
    fsSlideshowTimer: null
  };

  const FADE_MS = 520;
  const THUMB_SCROLL_PX_PER_SEC = 14;
  let thumbScrollLastTime = 0;
  let genreLoadSeq = 0;

  /** @type {Map<string, { works: object[], updatedAt: string, selectedWorkIndex: number }>} */
  const genreWorksCache = new Map();
  loadGenreCacheFromStorage();

  function getCachedGenreWorks(genreId) {
    const entry = genreWorksCache.get(genreId);
    if (!entry?.works?.length) return null;
    const minCount = genreId === "masterpiece" ? 40 : 20;
    if (entry.works.length < minCount) return null;
    return entry;
  }

  function cacheGenreWorks(genreId, works, updatedAt, selectedWorkIndex = 0) {
    if (!genreId || !works?.length) return;
    genreWorksCache.set(genreId, {
      works,
      updatedAt: updatedAt || "",
      selectedWorkIndex: Math.max(0, selectedWorkIndex || 0)
    });
    persistGenreCacheToStorage();
  }

  function saveCurrentGenreToCache() {
    if (state.artistMode || !state.genre || !state.works.length) return;
    cacheGenreWorks(state.genre, state.works, state.worksUpdatedAt, state.selectedWorkIndex);
  }

  function touchGenreCacheSelection() {
    if (state.artistMode || !state.genre) return;
    const entry = genreWorksCache.get(state.genre);
    if (entry) entry.selectedWorkIndex = state.selectedWorkIndex;
  }

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
  }

  const ART_IMG_PLACEHOLDER =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  let artImageObserver = null;

  function proxyUrl(path) {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    return `${apiBase()}${path}`;
  }

  function normalizeTitleKey(title) {
    let t = String(title || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    t = t.replace(/\([^)]*\)/g, " ");
    t = t.replace(/\[[^\]]*\]/g, " ");
    t = t.replace(/[^\w\s]/g, " ");
    t = t.replace(/\s+/g, " ").trim();
    t = t.replace(/^(the|a|an)\s+/, "");
    t = t.replace(/,?\s*\d{4}(\s*-\s*\d{4})?$/, "");
    return t.trim();
  }

  function artistDedupeSig(name) {
    const skip = new Set(["da", "de", "del", "van", "von", "di", "le", "la", "the", "of", "and", "y"]);
    const tokens = String(name || "")
      .toLowerCase()
      .split(/[\s,.]+/)
      .filter((p) => p.length >= 3 && !skip.has(p));
    if (!tokens.length) return String(name || "").toLowerCase().trim();
    if (tokens.length === 1) return tokens[0];
    return `${tokens[tokens.length - 1]}:${tokens[0]}`;
  }

  function titlesLikelySame(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    return shorter.length >= 6 && longer.includes(shorter);
  }

  function dedupeArtWorks(works, contextArtist) {
    const seen = new Set();
    const pairs = [];
    const out = [];
    for (const work of works || []) {
      const title = normalizeTitleKey(work.title);
      const artistSig = artistDedupeSig(contextArtist || work.artist);
      const key = title && title !== "untitled" ? `${title}|${artistSig}` : `id:${work.id}`;
      if (seen.has(key)) continue;
      let duplicate = false;
      for (const [prevTitle, prevArtist] of pairs) {
        if (prevArtist === artistSig && titlesLikelySame(title, prevTitle)) {
          duplicate = true;
          break;
        }
      }
      if (duplicate) continue;
      seen.add(key);
      pairs.push([title, artistSig]);
      out.push(work);
    }
    return out;
  }

  function preloadImage(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }
      const probe = new Image();
      probe.referrerPolicy = "no-referrer";
      probe.onload = () => resolve(probe.naturalWidth > 16);
      probe.onerror = () => resolve(false);
      probe.src = url;
    });
  }

  async function preloadFirst(urls) {
    const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
    for (const url of list) {
      if (await preloadImage(url)) return url;
    }
    return "";
  }

  const pruningWorkKeys = new Set();

  function workIdentity(work) {
    if (!work) return "";
    return String(work.id || `${work.artist || ""}:${work.title || ""}`);
  }

  function collectWorkImageUrls(work) {
    const urls = [
      ...stageUrls(work, "full"),
      ...stageUrls(work, "preview"),
      ...stageUrls(work, "thumb"),
    ];
    const seen = new Set();
    return urls.filter((url) => url && !seen.has(url) && seen.add(url));
  }

  function removeWorkWithoutImage(index) {
    if (index < 0 || index >= state.works.length) return;
    const work = state.works[index];
    const key = workIdentity(work);
    if (!key || pruningWorkKeys.has(key)) return;
    pruningWorkKeys.add(key);
    state.works = state.works.filter((_, i) => i !== index);
    if (!state.works.length) {
      state.selectedWorkIndex = 0;
      renderWorksSection();
      return;
    }
    if (state.selectedWorkIndex > index) state.selectedWorkIndex -= 1;
    else if (state.selectedWorkIndex >= state.works.length) {
      state.selectedWorkIndex = Math.max(0, state.works.length - 1);
    }
    renderWorksSection();
  }

  function setGalleryLoadingBar(loading, base = "이미지 불러오는 중") {
    state.mainImageLoading = Boolean(loading);
    const bar = pageRoot?.querySelector("#art-image-loading-bar");
    if (bar) {
      bar.hidden = !state.mainImageLoading;
      bar.querySelectorAll("[data-art-loading]").forEach((el) => {
        el.dataset.loadingBase = base;
        el.textContent = base;
      });
    }
    if (state.mainImageLoading) startLoadingAnimation();
    else if (!isPageLoading()) stopLoadingAnimation();
  }

  function setMainImageLoading(loading) {
    setGalleryLoadingBar(loading, "이미지 불러오는 중");
  }

  function showMainCanvasPlaceholder() {
    const canvas = pageRoot?.querySelector("#art-main-canvas");
    if (!canvas) return;
    const img = canvas.querySelector("#art-main-img");
    let placeholder = canvas.querySelector(".art-main-placeholder");
    if (img) {
      img.removeAttribute("src");
      img.hidden = true;
    }
    if (!placeholder) {
      placeholder = document.createElement("div");
      placeholder.className = "art-main-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.textContent = "🖼";
      canvas.appendChild(placeholder);
    }
    placeholder.hidden = false;
  }

  function mainImageCandidates(work) {
    const seen = new Set();
    const urls = [
      carouselThumbUrl(work),
      ...collectWorkImageUrls(work),
    ];
    return urls.filter((url) => url && !seen.has(url) && seen.add(url));
  }

  function workCanvasId(work, index) {
    return String(work?.id || workIdentity(work) || index);
  }

  function handleMainImageLoadFail(work) {
    setMainImageLoading(false);
    showMainCanvasPlaceholder();
    const canvas = pageRoot?.querySelector("#art-main-canvas");
    if (canvas) delete canvas.dataset.currentWorkId;
    const meta = pageRoot?.querySelector("#art-main-meta");
    if (meta && work) meta.innerHTML = renderMainMeta(work);
  }

  function loadImageWithFallbacks(urls, onSuccess, onFail) {
    const list = (Array.isArray(urls) ? urls : []).filter(Boolean);
    if (!list.length) {
      onFail?.();
      return;
    }
    let idx = 0;
    const loader = new Image();
    loader.referrerPolicy = "no-referrer";
    loader.onload = () => onSuccess?.(list[idx]);
    loader.onerror = () => {
      idx += 1;
      if (idx < list.length) loader.src = list[idx];
      else onFail?.();
    };
    loader.src = list[0];
  }

  async function applyImageStage(img, urls, stageClass, removeClasses) {
    const url = await preloadFirst(urls);
    if (!url || !img.isConnected) return false;
    img.src = url;
    removeClasses.forEach((cls) => img.classList.remove(cls));
    if (stageClass) img.classList.add(stageClass);
    return true;
  }

  function stageUrls(item, kind) {
    const directKey =
      kind === "preview"
        ? "direct_preview_url"
        : kind === "thumb"
          ? "direct_thumb_url"
          : "direct_image_url";
    const proxyKey =
      kind === "preview" ? "preview_url" : kind === "thumb" ? "thumb_url" : "image_url";
    const direct = item[directKey] || item[proxyKey] || "";
    if (direct.startsWith("http")) return [direct];
    const proxy = proxyUrl(item[proxyKey]);
    return [proxy, direct].filter(Boolean);
  }

  async function progressiveLoadArtImage(img) {
    if (img.dataset.progressiveLoaded) return;
    img.dataset.progressiveLoaded = "1";

    const lqip = img.dataset.lqip || "";
    const preview = (img.dataset.preview || "").split("|").filter(Boolean);
    const thumb = (img.dataset.thumb || "").split("|").filter(Boolean);
    const full = (img.dataset.full || "").split("|").filter(Boolean);
    const wantFull = img.dataset.wantFull === "1";

    if (lqip) {
      img.src = lqip;
      img.classList.add("is-lqip");
    }

    const blurClasses = ["is-lqip", "is-preview", "is-thumb"];
    let upgraded = false;

    if (preview) {
      upgraded = (await applyImageStage(img, preview, "is-preview", ["is-lqip"])) || upgraded;
    }

    if (thumb) {
      upgraded = (await applyImageStage(img, thumb, "is-thumb", blurClasses.filter((c) => c !== "is-thumb"))) || upgraded;
    }

    if (wantFull && full) {
      upgraded = (await applyImageStage(img, full, "is-full", blurClasses)) || upgraded;
    }

    if (!upgraded && lqip) {
      img.classList.add("is-stuck-lqip");
    }
  }

  function ensureArtImageObserver() {
    if (artImageObserver) return;
    artImageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          artImageObserver.unobserve(entry.target);
          void progressiveLoadArtImage(entry.target);
        });
      },
      { rootMargin: "160px 0px", threshold: 0.01 }
    );
  }

  function bindProgressiveArtImages(root) {
    if (!root) return;
    ensureArtImageObserver();
    root.querySelectorAll("img.art-img[data-progressive]").forEach((img) => {
      if (img.dataset.progressiveObserved) return;
      img.dataset.progressiveObserved = "1";
      const lqip = img.dataset.lqip;
      if (lqip && (!img.src || img.src === ART_IMG_PLACEHOLDER)) {
        img.src = lqip;
        img.classList.add("is-lqip");
      }
      artImageObserver.observe(img);
    });
  }

  function disconnectArtImageObserver() {
    artImageObserver?.disconnect();
    artImageObserver = null;
  }

  function renderProgressiveImg(item, { alt, wantFull = false, extraClass = "" }) {
    const lqip = item.lqip || "";
    const preview = stageUrls(item, "preview");
    const thumb = stageUrls(item, "thumb");
    const full = stageUrls(item, "full");
    if (!lqip && !preview.length && !thumb.length && !full.length) return "";

    const initial = lqip || preview[0] || thumb[0] || ART_IMG_PLACEHOLDER;
    const cls = `art-img${lqip ? " is-lqip" : ""}${extraClass ? ` ${extraClass}` : ""}`;
    return `<img class="${cls}"
      src="${escapeHtml(initial)}"
      data-progressive="1"
      data-want-full="${wantFull ? "1" : "0"}"
      data-lqip="${escapeHtml(lqip)}"
      data-preview="${escapeHtml(preview.join("|"))}"
      data-thumb="${escapeHtml(thumb.join("|"))}"
      data-full="${escapeHtml(full.join("|"))}"
      alt="${escapeHtml(alt)}"
      referrerpolicy="no-referrer"
      decoding="async">`;
  }

  function renderLoadingStatus(baseText) {
    const base = String(baseText || "로딩 중").replace(/\.+$/, "");
    return `<p class="art-status art-status-loading" data-art-loading data-loading-base="${escapeHtml(base)}" role="status" aria-live="polite">${escapeHtml(base)}</p>`;
  }

  function updateLoadingDots() {
    pageRoot?.querySelectorAll("[data-art-loading]").forEach((el) => {
      const base = el.dataset.loadingBase || "로딩 중";
      el.textContent = base + ".".repeat(loadingDotCount);
    });
  }

  function isArtLoadingVisible() {
    if (state.loading || state.worksLoading || state.worksRefreshing) return true;
    if (!state.genres.length || !state.eras.length) return true;
    return Boolean(pageRoot?.querySelector("[data-art-loading]"));
  }

  function renderRefreshOverlay() {
    return "";
  }

  function startLoadingAnimation() {
    if (loadingTimer) return;
    loadingDotCount = 1;
    updateLoadingDots();
    loadingTimer = setInterval(() => {
      loadingDotCount = loadingDotCount >= 4 ? 1 : loadingDotCount + 1;
      updateLoadingDots();
    }, 400);
  }

  function stopLoadingAnimation() {
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    loadingDotCount = 1;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDescription(text) {
    if (!text) return "";
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function genreMeta(id) {
    return state.genres.find((g) => g.id === id) || null;
  }

  async function fetchJson(path, options = {}) {
    const { retries = 3, method = "GET", timeoutMs = 28000, fast = false } = options;
    const effectiveRetries = fast ? 1 : retries;
    const effectiveTimeout = fast ? 12000 : timeoutMs;
    let lastError = null;

    for (let attempt = 0; attempt < effectiveRetries; attempt++) {
      const timeoutCtrl = new AbortController();
      const timeoutId = setTimeout(() => timeoutCtrl.abort(), effectiveTimeout);
      try {
        const signals = [timeoutCtrl.signal];
        if (abortCtrl?.signal) signals.push(abortCtrl.signal);
        const signal =
          typeof AbortSignal !== "undefined" && AbortSignal.any
            ? AbortSignal.any(signals)
            : timeoutCtrl.signal;
        const res = await fetch(`${apiBase()}${path}`, {
          method,
          signal,
          headers: { Accept: "application/json" }
        });
        clearTimeout(timeoutId);
        if (res.ok) return res.json();

        const detail = await res.text();
        const retryable = res.status === 502 || res.status === 503 || res.status === 429;
        if (retryable && attempt < effectiveRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
          continue;
        }
        throw new Error(detail || `HTTP ${res.status}`);
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        if (err.name === "AbortError") {
          lastError = new Error("요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
        }
        if (err.name === "AbortError" && abortCtrl?.signal?.aborted) throw err;
        if (attempt >= effectiveRetries - 1) throw lastError;
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
      }
    }

    throw lastError || new Error("Request failed");
  }

  function wakeArtApi() {
    const base = apiBase();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(`${base}/health`, { signal: ctrl.signal, headers: { Accept: "application/json" } })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }

  function fetchArtJson(path, options = {}) {
    return fetchJson(path, options);
  }

  function formatWorksUpdatedAt(iso) {
    if (!iso) return "";
    try {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Seoul"
      }).format(date);
    } catch (_) {
      return "";
    }
  }

  async function loadGenres() {
    const data = await fetchArtJson("/api/art/genres", ART_FETCH_FAST);
    state.genres = data.genres || STATIC_GENRES;
    if (!state.genres.some((g) => g.id === state.genre) && state.genres[0]) {
      state.genre = state.genres[0].id;
    }
  }

  async function loadEras() {
    const data = await fetchArtJson("/api/art/eras", ART_FETCH_FAST);
    state.eras = data.eras || staticErasSkeleton();
    if (!state.selectedEraId && state.eras[0]) {
      state.selectedEraId = state.eras[0].id;
    }
  }

  function artBgmUrl() {
    return `${apiBase()}${ART_BGM_SRC}`;
  }

  function ensureBgmAudio() {
    if (bgmAudio) return bgmAudio;
    bgmAudio = new Audio();
    bgmAudio.loop = true;
    bgmAudio.volume = ART_BGM_VOLUME;
    bgmAudio.crossOrigin = "anonymous";
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
    const btn = pageRoot?.querySelector("#art-bgm-btn");
    if (!btn) return;
    btn.classList.toggle("is-active", state.bgmEnabled);
    btn.setAttribute("aria-pressed", state.bgmEnabled ? "true" : "false");
    btn.textContent = state.bgmEnabled ? "🎵 BGM" : "🔇 BGM";
    syncFsBgmButton();
  }

  function syncFsBgmButton() {
    const btn = fsOverlay?.querySelector("[data-art-fs-bgm]");
    if (!btn) return;
    btn.classList.toggle("is-active", state.bgmEnabled);
    btn.setAttribute("aria-pressed", state.bgmEnabled ? "true" : "false");
    btn.textContent = state.bgmEnabled ? "🎵 BGM" : "🔇 BGM";
  }

  async function acquireWakeLock() {
    if (!navigator.wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      void wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  function syncBgmPlayback() {
    if (!pageRoot) return;
    syncBgmButton();
    if (!state.bgmEnabled) {
      stopBgm();
      return;
    }
    const audio = ensureBgmAudio();
    audio.volume = ART_BGM_VOLUME;
    const url = artBgmUrl();
    resetBgmSourceIfNeeded(url);
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

  async function loadGenreWorks(genreId) {
    const requestId = ++genreLoadSeq;
    const isCurrent = () => requestId === genreLoadSeq;

    pruningWorkKeys.clear();
    loadGenreCacheFromStorage();
    if (!state.artistMode && state.genre && state.genre !== genreId && state.works.length) {
      saveCurrentGenreToCache();
    }

    state.artistMode = false;
    state.selectedArtist = null;
    state.error = "";
    const meta = genreMeta(genreId);
    state.worksTitle = meta?.hint || "";
    state.worksSubtitle = "";

    const applyGenreUi = () => {
      if (!isCurrent()) return;
      updateGenreNav();
      updateArtRefreshBar();
    };

    const cached = getCachedGenreWorks(genreId);
    if (cached) {
      if (!isCurrent()) return;
      state.worksLoading = false;
      state.works = cached.works;
      state.genre = genreId;
      state.selectedWorkIndex = Math.min(
        cached.selectedWorkIndex,
        Math.max(0, cached.works.length - 1)
      );
      state.worksUpdatedAt = cached.updatedAt;
      renderWorksSection();
      applyGenreUi();
      return;
    }

    const hadVisibleWorks = state.genre === genreId && state.works.length > 0;
    if (!hadVisibleWorks) {
      const instant = instantWorksForGenre(genreId);
      if (instant.length) {
        if (!isCurrent()) return;
        state.works = instant;
        state.genre = genreId;
        state.selectedWorkIndex = 0;
        state.worksLoading = false;
        renderWorksSection();
        applyGenreUi();
      } else {
        if (!isCurrent()) return;
        state.worksLoading = true;
        state.selectedWorkIndex = 0;
        state.works = [];
        state.genre = genreId;
        renderWorksSection();
        applyGenreUi();
      }
    } else {
      state.worksLoading = false;
    }

    try {
      const data = await fetchArtJson(`/api/art/works?genre=${encodeURIComponent(genreId)}`, ART_FETCH_FAST);
      if (!isCurrent()) return;
      const works = dedupeArtWorks(data.works || []);
      if (works.length) {
        state.works = works;
        state.genre = genreId;
        if (!hadVisibleWorks) state.selectedWorkIndex = 0;
        state.worksUpdatedAt = data.updated_at || "";
        cacheGenreWorks(genreId, state.works, state.worksUpdatedAt, state.selectedWorkIndex);
      }
    } catch (err) {
      if (!isCurrent()) return;
      if (!state.works.length) {
        state.error = err.message || "작품을 불러오지 못했습니다.";
      }
    } finally {
      if (!isCurrent()) return;
      state.worksLoading = false;
      renderWorksSection();
      applyGenreUi();
    }
  }

  async function refreshGenreWorks() {
    if (state.artistMode || state.worksRefreshing || state.worksLoading) return;
    state.worksRefreshing = true;
    state.error = "";
    renderWorksSection();
    setGalleryLoadingBar(true, "업데이트 중");
    updateArtRefreshBar();
    try {
      const data = await fetchArtJson(
        `/api/art/works/refresh?genre=${encodeURIComponent(state.genre)}`,
        { method: "POST", retries: 1, ...ART_FETCH_FULL }
      );
      const works = dedupeArtWorks(data.works || []);
      if (works.length) {
        state.works = works;
        state.selectedWorkIndex = 0;
        state.worksUpdatedAt = data.updated_at || "";
        cacheGenreWorks(state.genre, state.works, state.worksUpdatedAt, 0);
      }
      renderWorksSection();
    } catch (err) {
      state.error = err.message || "작품을 다시 불러오지 못했습니다.";
    } finally {
      state.worksRefreshing = false;
      setGalleryLoadingBar(false);
      renderWorksSection();
      updateArtRefreshBar();
    }
  }

  function scrollArtPageToTop() {
    const target = pageRoot?.querySelector(".art-header") || pageRoot?.querySelector(".art-panel") || pageRoot;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function findArtistSampleWorks(name) {
    const target = String(name || "").trim();
    if (!target) return [];
    for (const era of state.eras) {
      const artist = (era.artists || []).find((a) => a.name === target);
      if (artist?.sample_works?.length) return artist.sample_works;
    }
    return [];
  }

  async function loadArtistWorks(name) {
    saveCurrentGenreToCache();
    pruningWorkKeys.clear();
    state.worksLoading = true;
    state.artistMode = true;
    state.selectedArtist = name;
    state.selectedWorkIndex = 0;
    state.worksTitle = `${name} · 작품`;
    state.worksSubtitle = "";
    scrollArtPageToTop();
    renderWorksSection();
    try {
      const data = await fetchArtJson(`/api/art/artist-works?name=${encodeURIComponent(name)}`, ART_FETCH_FAST);
      const artistName = data.artist?.name || name;
      state.works = dedupeArtWorks(data.works || [], artistName);
      if (!state.works.length) {
        const fallback = findArtistSampleWorks(artistName || name);
        if (fallback.length) {
          state.works = dedupeArtWorks(fallback, artistName || name);
        }
      }
      state.selectedWorkIndex = 0;
      if (data.artist?.name) {
        state.selectedArtist = data.artist.name;
        state.worksTitle = `${data.artist.name} · 작품`;
      }
      scrollArtPageToTop();
    } catch (err) {
      state.error = err.message || "화가 작품을 불러오지 못했습니다.";
      const fallback = findArtistSampleWorks(name);
      state.works = fallback.length ? dedupeArtWorks(fallback, name) : [];
      if (state.works.length) state.error = "";
    } finally {
      state.worksLoading = false;
      renderWorksSection();
      updateArtRefreshBar();
    }
  }

  function renderGenreNav() {
    return `
      <nav class="art-genre-nav" aria-label="미술 장르와 명작">
        ${state.genres
          .map(
            (g) =>
              `<button type="button" class="art-genre-btn${g.id === state.genre && !state.artistMode ? " is-active" : ""}" data-art-genre="${escapeHtml(g.id)}" title="${escapeHtml(g.hint || g.label_en || "")}">
                <span class="art-genre-label">${escapeHtml(g.label)}</span>
                <span class="art-genre-en">${escapeHtml(g.label_en || "")}</span>
              </button>`
          )
          .join("")}
      </nav>
    `;
  }

  function workImageUrl(work, kind = "full") {
    const urls = stageUrls(work, kind);
    return urls[0] || "";
  }

  function renderMainMeta(work) {
    if (!work) return "";
    const dateHtml = work.date
      ? ` · <span class="art-main-date">${escapeHtml(work.date)}</span>`
      : "";
    return `
      <h3 class="art-main-title">${escapeHtml(work.title)}</h3>
      <p class="art-main-artist"><strong>${escapeHtml(work.artist)}</strong>${dateHtml}</p>
      <p class="art-main-desc">${formatDescription(work.description)}</p>
    `;
  }

  function renderThumbItem(work, index) {
    const thumbSrc = carouselThumbUrl(work);
    if (!thumbSrc) return "";
    const fallbacks = carouselThumbFallbacks(work);
    const active = index === state.selectedWorkIndex ? " is-active" : "";
    return `
      <button type="button" class="art-thumb-item${active}" data-art-thumb="${index}" aria-label="${escapeHtml(work.title)}" aria-current="${index === state.selectedWorkIndex ? "true" : "false"}">
        <img src="${escapeHtml(thumbSrc)}" data-fallback="${escapeHtml(fallbacks)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
      </button>
    `;
  }

  function renderBgmButton() {
    return `
      <button type="button" class="art-bgm-btn is-active" id="art-bgm-btn" aria-pressed="true" title="갤러리 분위기 BGM">
        🎵 BGM
      </button>
    `;
  }

  function renderIntervalPicker() {
    const options = [3000, 5000, 10000];
    const canFullscreen = state.works.length >= 1 && !state.worksLoading;
    return `
      <div class="art-gallery-side-controls">
        ${renderBgmButton()}
        <button type="button" class="art-fs-btn" id="art-fs-btn" title="전체화면 슬라이드쇼" aria-label="전체화면 슬라이드쇼"${canFullscreen ? "" : " disabled"}>⛶ 전체화면</button>
        <div class="art-interval-picker" role="group" aria-label="슬라이드 간격">
          ${options
            .map(
              (ms) =>
                `<button type="button" class="art-interval-btn${state.slideshowInterval === ms ? " is-active" : ""}" data-art-interval="${ms}">${ms / 1000}초</button>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function stopSlideshow() {
    if (state.slideshowTimer) {
      clearInterval(state.slideshowTimer);
      state.slideshowTimer = null;
    }
  }

  function getThumbTrack() {
    return pageRoot?.querySelector("#art-thumb-track");
  }

  function getThumbFlowEl() {
    return pageRoot?.querySelector("#art-thumb-flow");
  }

  function getThumbGap(track) {
    if (!track) return 8;
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap);
    return Number.isFinite(gap) ? gap : 8;
  }

  function getThumbStep(track) {
    const item = track?.querySelector(".art-thumb-item");
    if (!item) return 56;
    return item.getBoundingClientRect().width + getThumbGap(track);
  }

  function getThumbLoopWidth(track) {
    if (!track) return 0;
    const items = track.querySelectorAll(".art-thumb-item");
    const half = items.length / 2;
    if (half < 1) return 0;

    const gap = getThumbGap(track);
    let total = 0;
    for (let i = 0; i < half; i++) {
      const w = items[i].getBoundingClientRect().width;
      if (w > 0) total += w;
    }
    total += gap * Math.max(0, half - 1);
    if (total > 0) return total;

    const scrollHalf = track.scrollWidth / 2;
    if (scrollHalf > 0) return scrollHalf;

    const offsetHalf = track.offsetWidth / 2;
    return offsetHalf > 0 ? offsetHalf : 0;
  }

  function wrapThumbFlowOffset(loopWidth) {
    if (loopWidth > 0) {
      state.thumbFlowOffset = ((state.thumbFlowOffset % loopWidth) + loopWidth) % loopWidth;
    }
  }

  function applyThumbTransform() {
    const flow = getThumbFlowEl();
    if (!flow) return;
    flow.style.transform = `translate3d(${-state.thumbFlowOffset}px, 0, 0)`;
  }

  function stopThumbAutoScroll() {
    if (state.thumbScrollRaf) {
      cancelAnimationFrame(state.thumbScrollRaf);
      state.thumbScrollRaf = null;
    }
    thumbScrollLastTime = 0;
    getThumbTrack()?.classList.remove("is-continuous");
    getThumbFlowEl()?.classList.remove("is-flowing");
  }

  function stopGalleryMotion() {
    stopSlideshow();
    stopThumbAutoScroll();
  }

  function startSlideshow() {
    stopSlideshow();
    if (!pageRoot || state.works.length < 2 || state.fsOpen) return;
    state.slideshowTimer = setInterval(() => {
      const next = (state.selectedWorkIndex + 1) % state.works.length;
      state.selectedWorkIndex = next;
      touchGenreCacheSelection();
      updateGalleryView({ fade: true });
    }, state.slideshowInterval);
  }

  function startThumbAutoScroll() {
    stopThumbAutoScroll();
    if (!pageRoot || state.works.length < 2) return;

    const track = getThumbTrack();
    const flow = getThumbFlowEl();
    if (!track || !flow) return;

    track.classList.add("is-continuous");
    flow.classList.add("is-flowing");
    applyThumbTransform();

    const tick = (now) => {
      if (!pageRoot || !track.isConnected || !flow.isConnected) {
        state.thumbScrollRaf = null;
        return;
      }

      if (!thumbScrollLastTime) thumbScrollLastTime = now;
      const dt = Math.min((now - thumbScrollLastTime) / 1000, 0.05);
      thumbScrollLastTime = now;

      const loopWidth = getThumbLoopWidth(track);
      if (loopWidth > 0) {
        state.thumbFlowOffset += THUMB_SCROLL_PX_PER_SEC * dt;
        if (state.thumbFlowOffset >= loopWidth) state.thumbFlowOffset -= loopWidth;
        applyThumbTransform();
      }

      state.thumbScrollRaf = requestAnimationFrame(tick);
    };

    const boot = () => {
      if (!pageRoot || !track.isConnected || !flow.isConnected) return;
      applyThumbTransform();
      thumbScrollLastTime = 0;
      state.thumbScrollRaf = requestAnimationFrame(tick);
    };

    requestAnimationFrame(() => requestAnimationFrame(boot));
  }

  function restartSlideshow() {
    stopSlideshow();
    startSlideshow();
  }

  function restartGalleryMotion() {
    restartSlideshow();
  }

  function renderGalleryBody() {
    if (state.worksLoading && !state.works.length) {
      return renderLoadingStatus("작품 불러오는 중");
    }
    if (!state.works.length) {
      return `<p class="art-status art-status-info">표시할 작품이 없습니다.</p>`;
    }

    const work = state.works[state.selectedWorkIndex] || state.works[0];
    const mainSrc = workImageUrl(work, "full") || workImageUrl(work, "thumb");
    const thumbsHtml = state.works.map(renderThumbItem).filter(Boolean).join("");
    const refreshOverlay = state.worksRefreshing ? renderRefreshOverlay() : "";

    return `
      <div class="art-gallery${state.worksRefreshing ? " is-refreshing" : ""}" id="art-gallery">
        ${refreshOverlay}
        <div class="art-gallery-controls">
          <div class="art-thumb-carousel" aria-label="작품 썸네일">
            <button type="button" class="art-thumb-scroll-btn" id="art-thumb-prev" aria-label="이전 작품">‹</button>
            <div class="art-thumb-viewport">
              <div class="art-thumb-flow" id="art-thumb-flow">
                <div class="art-thumb-track is-continuous" id="art-thumb-track">
                  ${thumbsHtml}${thumbsHtml}
                </div>
              </div>
            </div>
            <button type="button" class="art-thumb-scroll-btn" id="art-thumb-next" aria-label="다음 작품">›</button>
          </div>
          ${renderIntervalPicker()}
        </div>
        <div class="art-main-canvas" id="art-main-canvas" data-current-work-id="${escapeHtml(workCanvasId(work, state.selectedWorkIndex))}">
          ${
            mainSrc
              ? `<img class="art-main-img" id="art-main-img" src="${escapeHtml(mainSrc)}" alt="${escapeHtml(work.title)}" referrerpolicy="no-referrer" decoding="async" loading="eager" fetchpriority="high">`
              : `<div class="art-main-placeholder" aria-hidden="true">🖼</div>`
          }
        </div>
        <div class="art-image-loading-bar" id="art-image-loading-bar" hidden aria-live="polite">
          ${renderLoadingStatus("이미지 불러오는 중")}
        </div>
        <div class="art-main-meta" id="art-main-meta">
          ${renderMainMeta(work)}
        </div>
      </div>
    `;
  }

  function updateGalleryView(options = {}) {
    const { fade = false } = options;
    if (!pageRoot || !state.works.length) return;
    const work = state.works[state.selectedWorkIndex];
    if (!work) return;

    const canvas = pageRoot.querySelector("#art-main-canvas");
    let img = pageRoot.querySelector("#art-main-img");
    const placeholder = canvas?.querySelector(".art-main-placeholder");
    const urls = mainImageCandidates(work);
    const workId = workCanvasId(work, state.selectedWorkIndex);

    const syncMetaAndThumbs = () => {
      const meta = pageRoot.querySelector("#art-main-meta");
      if (meta) meta.innerHTML = renderMainMeta(work);

      pageRoot.querySelectorAll("[data-art-thumb]").forEach((btn) => {
        const idx = Number(btn.dataset.artThumb);
        const active = idx === state.selectedWorkIndex;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-current", active ? "true" : "false");
      });
    };

    const applyUrl = (url) => {
      if (!pageRoot || state.works[state.selectedWorkIndex] !== work) return;
      setMainImageLoading(false);
      if (placeholder) placeholder.hidden = true;
      if (!img && canvas) {
        img = document.createElement("img");
        img.className = "art-main-img";
        img.id = "art-main-img";
        img.referrerPolicy = "no-referrer";
        img.decoding = "async";
        canvas.appendChild(img);
      }
      if (!img) return;
      img.hidden = false;
      img.alt = work.title || "";
      img.classList.remove("is-fading-out", "is-loading");
      img.src = url;
      img.classList.add("is-fading-in");
      requestAnimationFrame(() => img.classList.remove("is-fading-in"));
      if (canvas) canvas.dataset.currentWorkId = workId;
      syncMetaAndThumbs();
    };

    if (!urls.length) {
      handleMainImageLoadFail(work);
      syncMetaAndThumbs();
      return;
    }

    if (
      !fade &&
      canvas?.dataset.currentWorkId === workId &&
      img &&
      !img.hidden &&
      img.getAttribute("src")
    ) {
      setMainImageLoading(false);
      syncMetaAndThumbs();
      return;
    }

    if (fade && img) img.classList.add("is-fading-out");
    setMainImageLoading(true);
    loadImageWithFallbacks(
      urls,
      (url) => {
        if (!pageRoot || state.works[state.selectedWorkIndex] !== work) return;
        if (fade) setTimeout(() => applyUrl(url), FADE_MS);
        else applyUrl(url);
      },
      () => {
        if (img) img.classList.remove("is-fading-out");
        handleMainImageLoadFail(work);
        syncMetaAndThumbs();
      }
    );
  }

  function stopFsSlideshow() {
    if (state.fsSlideshowTimer) {
      clearInterval(state.fsSlideshowTimer);
      state.fsSlideshowTimer = null;
    }
  }

  function ensureArtFullscreenOverlay() {
    if (fsOverlay) return;
    fsOverlay = document.createElement("div");
    fsOverlay.id = "art-slideshow-fs";
    fsOverlay.className = "art-slideshow-fs";
    fsOverlay.hidden = true;
    fsOverlay.setAttribute("role", "dialog");
    fsOverlay.setAttribute("aria-modal", "true");
    fsOverlay.setAttribute("aria-label", "전체화면 작품 감상");
    fsOverlay.innerHTML = `
      <div class="art-fs-top">
        <button type="button" class="art-fs-close" data-art-fs-close aria-label="전체화면 닫기">✕</button>
        <button type="button" class="art-fs-bgm-btn is-active" data-art-fs-bgm aria-pressed="true" title="BGM">🎵 BGM</button>
      </div>
      <div class="art-fs-stage">
        <img class="art-fs-img" data-art-fs-img alt="" referrerpolicy="no-referrer" decoding="async">
      </div>
      <div class="art-fs-bottom">
        <div class="art-fs-meta" data-art-fs-meta></div>
        <div class="art-fs-dots" data-art-fs-dots aria-hidden="true"></div>
      </div>
    `;
    document.body.appendChild(fsOverlay);
  }

  function bindArtFullscreenEvents() {
    if (fsEventsBound) return;
    fsEventsBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.fsOpen) closeArtFullscreen();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.fsOpen) void acquireWakeLock();
    });
  }

  function syncFsDots() {
    const dots = fsOverlay?.querySelector("[data-art-fs-dots]");
    if (!dots) return;
    if (state.works.length < 2) {
      dots.innerHTML = "";
      return;
    }
    dots.innerHTML = state.works
      .map(
        (_, i) =>
          `<span class="art-fs-dot${i === state.selectedWorkIndex ? " is-active" : ""}"></span>`
      )
      .join("");
  }

  function updateFsView(options = {}) {
    const { fade = false } = options;
    if (!fsOverlay || fsOverlay.hidden || !state.fsOpen || !state.works.length) return;
    const work = state.works[state.selectedWorkIndex];
    if (!work) return;

    const img = fsOverlay.querySelector("[data-art-fs-img]");
    const meta = fsOverlay.querySelector("[data-art-fs-meta]");
    const candidates = collectWorkImageUrls(work);

    const syncMeta = () => {
      if (meta) meta.innerHTML = renderMainMeta(work);
      syncFsDots();
    };

    if (!img || !candidates.length) {
      if (!candidates.length) {
        img?.classList.remove("is-fading-out");
        if (img) img.hidden = true;
        syncMeta();
      } else {
        syncMeta();
      }
      return;
    }

    const applyImage = (url) => {
      if (!state.fsOpen || state.works[state.selectedWorkIndex] !== work) return;
      img.src = url;
      img.alt = work.title || "";
      img.hidden = false;
      img.classList.remove("is-fading-out");
      img.classList.add("is-fading-in");
      requestAnimationFrame(() => img.classList.remove("is-fading-in"));
      syncMeta();
    };

    if (fade) {
      img.classList.add("is-fading-out");
      loadImageWithFallbacks(
        candidates,
        (url) => {
          if (!state.fsOpen || state.works[state.selectedWorkIndex] !== work) return;
          setTimeout(() => applyImage(url), FADE_MS);
        },
        () => {
          img.classList.remove("is-fading-out");
          syncMeta();
        }
      );
    } else {
      loadImageWithFallbacks(
        candidates,
        (url) => applyImage(url),
        () => syncMeta()
      );
    }
  }

  function startFsSlideshow() {
    stopFsSlideshow();
    if (!state.fsOpen || state.works.length < 2) return;
    state.fsSlideshowTimer = setInterval(() => {
      const next = (state.selectedWorkIndex + 1) % state.works.length;
      state.selectedWorkIndex = next;
      touchGenreCacheSelection();
      updateFsView({ fade: true });
    }, state.slideshowInterval);
  }

  function openArtFullscreen() {
    if (!state.works.length || state.worksLoading) return;
    ensureArtFullscreenOverlay();
    bindArtFullscreenEvents();

    const closeBtn = fsOverlay.querySelector("[data-art-fs-close]");
    const bgmBtn = fsOverlay.querySelector("[data-art-fs-bgm]");
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = "1";
      closeBtn.addEventListener("click", closeArtFullscreen);
    }
    if (bgmBtn && !bgmBtn.dataset.bound) {
      bgmBtn.dataset.bound = "1";
      bgmBtn.addEventListener("click", () => {
        toggleBgm();
        syncBgmButton();
      });
    }

    state.fsOpen = true;
    fsOverlay.hidden = false;
    document.body.classList.add("art-fs-open");
    stopGalleryMotion();
    updateFsView({ fade: false });
    syncFsBgmButton();
    syncBgmPlayback();
    void acquireWakeLock();
    startFsSlideshow();
  }

  function closeArtFullscreen() {
    if (!state.fsOpen) return;
    state.fsOpen = false;
    stopFsSlideshow();
    releaseWakeLock();
    if (fsOverlay) fsOverlay.hidden = true;
    document.body.classList.remove("art-fs-open");
    updateGalleryView({ fade: false });
    restartGalleryMotion();
  }

  function selectWork(index, options = {}) {
    const { fade = false, userAction = false } = options;
    if (index < 0 || index >= state.works.length) return;
    state.selectedWorkIndex = index;
    touchGenreCacheSelection();
    updateGalleryView({ fade });
    if (state.fsOpen) updateFsView({ fade });
    if (userAction) {
      restartSlideshow();
      if (state.fsOpen) startFsSlideshow();
    }
  }

  function nudgeThumbFlow(direction) {
    const track = getThumbTrack();
    if (!track) return;
    const step = getThumbStep(track);
    state.thumbFlowOffset += direction * step;
    wrapThumbFlowOffset(getThumbLoopWidth(track));
    applyThumbTransform();
  }

  function bindGalleryEvents() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-art-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.artThumb);
        if (!Number.isNaN(index)) selectWork(index, { userAction: true });
      });
    });
    const bindThumbNav = (id, direction) => {
      const btn = pageRoot.querySelector(id);
      if (!btn || btn.dataset.thumbNavBound) return;
      btn.dataset.thumbNavBound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        nudgeThumbFlow(direction);
        restartSlideshow();
      });
    };
    bindThumbNav("#art-thumb-prev", -1);
    bindThumbNav("#art-thumb-next", 1);
    pageRoot.querySelectorAll("[data-art-interval]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ms = Number(btn.dataset.artInterval);
        if (!ms || state.slideshowInterval === ms) return;
        state.slideshowInterval = ms;
        pageRoot.querySelectorAll("[data-art-interval]").forEach((el) => {
          el.classList.toggle("is-active", Number(el.dataset.artInterval) === ms);
        });
        restartGalleryMotion();
        if (state.fsOpen) startFsSlideshow();
      });
    });

    pageRoot.querySelector("#art-fs-btn")?.addEventListener("click", () => {
      openArtFullscreen();
    });

    pageRoot.querySelector("#art-bgm-btn")?.addEventListener("click", () => {
      toggleBgm();
    });
    syncBgmButton();
    syncBgmPlayback();
    bindBgmUnlock();

    const viewport = pageRoot.querySelector(".art-thumb-viewport");
    if (viewport && !viewport.dataset.wheelBound) {
      viewport.dataset.wheelBound = "1";
      viewport.addEventListener(
        "wheel",
        (e) => {
          if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          e.preventDefault();
          const track = getThumbTrack();
          if (!track) return;
          state.thumbFlowOffset += e.deltaY * 0.35;
          wrapThumbFlowOffset(getThumbLoopWidth(track));
          applyThumbTransform();
          restartSlideshow();
        },
        { passive: false }
      );

      let touchLastX = 0;
      let touchDragging = false;
      viewport.addEventListener(
        "touchstart",
        (e) => {
          if (!e.touches[0]) return;
          touchLastX = e.touches[0].clientX;
          touchDragging = true;
        },
        { passive: true, capture: true }
      );
      viewport.addEventListener(
        "touchmove",
        (e) => {
          if (!touchDragging || !e.touches[0]) return;
          const x = e.touches[0].clientX;
          const dx = touchLastX - x;
          if (Math.abs(dx) < 0.5) return;
          touchLastX = x;
          const track = getThumbTrack();
          if (!track) return;
          state.thumbFlowOffset += dx;
          wrapThumbFlowOffset(getThumbLoopWidth(track));
          applyThumbTransform();
        },
        { passive: true, capture: true }
      );
      viewport.addEventListener(
        "touchend",
        () => {
          if (touchDragging) restartSlideshow();
          touchDragging = false;
        },
        { passive: true, capture: true }
      );
    }

    startThumbAutoScroll();
    restartSlideshow();
    bindCarouselThumbErrors();
  }

  function renderWorksSection() {
    const host = pageRoot?.querySelector("#art-works-host");
    if (!host) return;
    closeArtFullscreen();
    stopGalleryMotion();
    state.thumbFlowOffset = 0;
    host.innerHTML = `
      <section class="art-works-section" id="art-works-section">
        <header class="art-works-head">
          ${state.worksTitle ? `<p class="art-works-line">${escapeHtml(state.worksTitle)}</p>` : ""}
          ${
            state.artistMode
              ? `<button type="button" class="art-btn art-btn-ghost" id="art-back-genre">장르 작품으로</button>`
              : ""
          }
        </header>
        ${renderGalleryBody()}
      </section>
    `;
    bindWorksEvents();
    bindGalleryEvents();
    if (state.works.length) {
      try {
        updateGalleryView({ fade: false });
      } catch (_) {
        /* gallery image sync failed; keep list */
      }
    }
    if (isArtLoadingVisible()) startLoadingAnimation();
    else stopLoadingAnimation();
  }

  function wikiSnapWidth(width) {
    const sizes = [250, 330, 500, 960, 1280];
    for (const w of sizes) {
      if (w >= width) return w;
    }
    return sizes[sizes.length - 1];
  }

  function downsizeWikiThumb(url, width = 330) {
    if (!url || !url.includes("upload.wikimedia.org") || !url.includes("/thumb/")) return url;
    const snap = wikiSnapWidth(width);
    return url.replace(/\/\d+px-/, `/${snap}px-`);
  }

  function carouselThumbUrl(work) {
    const full = workImageUrl(work, "full");
    const preview = workImageUrl(work, "preview");
    const thumb = workImageUrl(work, "thumb");
    if (full?.includes("upload.wikimedia.org")) {
      return downsizeWikiThumb(full, 330) || full;
    }
    return thumb || preview || full || "";
  }

  function carouselThumbFallbacks(work) {
    const primary = carouselThumbUrl(work);
    const urls = [];
    const add = (url) => {
      if (url && url !== primary && !urls.includes(url)) urls.push(url);
    };
    add(workImageUrl(work, "full"));
    add(workImageUrl(work, "preview"));
    add(workImageUrl(work, "thumb"));
    return urls.join("|");
  }

  function bindCarouselThumbErrors() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll(".art-thumb-item img").forEach((img) => {
      if (img.dataset.thumbBound) return;
      img.dataset.thumbBound = "1";
      const fallbacks = (img.dataset.fallback || "").split("|").filter(Boolean);
      let idx = 0;
      img.addEventListener("error", () => {
        if (idx < fallbacks.length) {
          img.src = fallbacks[idx++];
          return;
        }
        const btn = img.closest("[data-art-thumb]");
        const workIndex = btn ? Number(btn.dataset.artThumb) : -1;
        if (workIndex >= 0) removeWorkWithoutImage(workIndex);
      });
    });
  }

  function downsizeMetThumb(url) {
    if (!url) return "";
    return url
      .replace("/web-large/", "/web-small/")
      .replace("/original/", "/web-small/")
      .replace("/web-additional/", "/web-small/");
  }

  function sampleWorkThumb(work) {
    if (!work) return "";
    const proxy = proxyUrl(work.thumb_url || work.preview_url);
    const directThumb = work.direct_thumb_url || work.direct_preview_url || "";
    if (directThumb.includes("artic.edu/iiif")) {
      if (proxy) return proxy;
    }
    if (directThumb.startsWith("http")) {
      if (directThumb.includes("upload.wikimedia.org")) {
        return downsizeWikiThumb(directThumb, 330);
      }
      if (directThumb.includes("metmuseum.org") || directThumb.includes("/web-")) {
        return downsizeMetThumb(directThumb);
      }
      return directThumb;
    }
    if (proxy) return downsizeMetThumb(proxy);
    return "";
  }

  function sampleWorkThumbFallbacks(work) {
    const urls = [];
    const add = (url) => {
      if (url && !urls.includes(url)) urls.push(url);
    };
    const proxy = proxyUrl(work.thumb_url || work.preview_url);
    const direct = work.direct_thumb_url || work.direct_preview_url || "";
    if (direct.includes("artic.edu/iiif")) {
      add(proxy);
      add(direct);
    } else if (direct.startsWith("http")) {
      add(sampleWorkThumb(work));
      add(proxy);
      if (direct.includes("upload.wikimedia.org")) {
        add(downsizeWikiThumb(direct, 400));
      }
    } else {
      add(proxy);
    }
    return urls.filter((u) => u && u !== sampleWorkThumb(work));
  }

  function bindSampleThumbErrors() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll(".art-sample-thumb img").forEach((img) => {
      if (img.dataset.sampleBound) return;
      img.dataset.sampleBound = "1";
      const fallbacks = (img.dataset.fallback || "").split("|").filter(Boolean);
      let idx = 0;
      img.addEventListener("error", () => {
        if (idx < fallbacks.length) {
          img.src = fallbacks[idx++];
          return;
        }
        img.src = ART_IMG_PLACEHOLDER;
        img.classList.add("is-broken");
      });
    });
  }

  function renderSampleWorks(works, samplesLoaded) {
    const list = (works || []).filter((w) => sampleWorkThumb(w)).slice(0, 3);
    if (!list.length) {
      if (samplesLoaded === false) {
        return `<p class="art-artist-works-empty">대표 작품 썸네일을 불러오는 중…</p>`;
      }
      return `<p class="art-artist-works-empty">대표 작품을 준비 중입니다.</p>`;
    }
    return `
      <div class="art-artist-works-grid" role="list" aria-label="대표 작품">
        ${list
          .map((work) => {
            const thumb = sampleWorkThumb(work);
            const fallbacks = sampleWorkThumbFallbacks(work).join("|");
            return `
          <div class="art-sample-thumb" role="listitem" title="${escapeHtml(work.title)}">
            <img src="${escapeHtml(thumb)}" data-fallback="${escapeHtml(fallbacks)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="44" height="44">
          </div>`;
          })
          .join("")}
      </div>
    `;
  }

  function renderArtistDescription(artist) {
    if (!artist?.description) return "";
    return `
      <div class="art-artist-desc-wrap is-collapsed" data-art-desc-wrap>
        <div class="art-artist-desc">${formatDescription(artist.description)}</div>
        <button type="button" class="art-desc-toggle" data-art-desc-toggle hidden>더 보기</button>
      </div>
    `;
  }

  function bindDescToggles() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-art-desc-wrap]").forEach((wrap) => {
      if (wrap.dataset.descBound) return;
      wrap.dataset.descBound = "1";
      const desc = wrap.querySelector(".art-artist-desc");
      const btn = wrap.querySelector("[data-art-desc-toggle]");
      if (!desc || !btn) return;

      requestAnimationFrame(() => {
        const lineHeight = parseFloat(getComputedStyle(desc).lineHeight) || 21;
        const maxLines = 7;
        const needsToggle = desc.scrollHeight > lineHeight * maxLines + 4;
        if (!needsToggle) {
          wrap.classList.remove("is-collapsed");
          btn.hidden = true;
          return;
        }
        btn.hidden = false;
        wrap.classList.add("is-collapsed");
        btn.addEventListener("click", () => {
          const expanded = wrap.classList.toggle("is-expanded");
          wrap.classList.toggle("is-collapsed", !expanded);
          btn.textContent = expanded ? "접기" : "더 보기";
          btn.setAttribute("aria-expanded", expanded ? "true" : "false");
        });
      });
    });
  }

  function renderArtistCard(artist, samplesLoaded) {
    const imgHtml = renderProgressiveImg(artist, { alt: artist.name, wantFull: false });
    const viewBtn = `<button type="button" class="art-btn art-btn-primary art-artist-view" data-art-artist="${escapeHtml(artist.name)}">작품감상</button>`;
    return `
      <article class="art-artist-card">
        <div class="art-artist-aside">
          <div class="art-artist-portrait">
            ${imgHtml || `<div class="art-artist-placeholder" aria-hidden="true">👤</div>`}
          </div>
          <div class="art-artist-view-mobile">${viewBtn}</div>
        </div>
        <div class="art-artist-body">
          <div class="art-artist-head">
            <div class="art-artist-title-wrap">
              <h4 class="art-artist-name">${escapeHtml(artist.name)}</h4>
              ${artist.life ? `<p class="art-artist-life">${escapeHtml(artist.life)}</p>` : ""}
            </div>
            <div class="art-artist-view-desktop">${viewBtn}</div>
          </div>
          ${renderArtistDescription(artist)}
          <div class="art-artist-works">
            <p class="art-artist-works-label">대표 작품</p>
            ${renderSampleWorks(artist.sample_works, samplesLoaded)}
          </div>
        </div>
      </article>
    `;
  }

  function renderEraNav() {
    const selectedId = state.selectedEraId || state.eras[0]?.id || "";
    return `
      <nav class="art-era-nav" aria-label="미술 시대">
        ${state.eras
          .map(
            (era) =>
              `<button type="button" class="art-era-btn${era.id === selectedId ? " is-active" : ""}" data-art-era="${escapeHtml(era.id)}" title="${escapeHtml(era.period || "")}">
                <span class="art-era-label">${escapeHtml(era.label)}</span>
                <span class="art-era-period">${escapeHtml(era.period || "")}</span>
              </button>`
          )
          .join("")}
      </nav>
    `;
  }

  function renderEraPanel() {
    const selectedId = state.selectedEraId || state.eras[0]?.id || "";
    const era = state.eras.find((e) => e.id === selectedId) || state.eras[0];
    if (!era) return "";
    return `
      <section class="art-era-panel" aria-labelledby="art-era-active-title">
        <header class="art-era-head">
          <h3 id="art-era-active-title">${escapeHtml(era.label)}</h3>
          <span class="art-era-period">${escapeHtml(era.period || "")}</span>
        </header>
        <div class="art-artists-list">
          ${(era.artists || []).map((artist) => renderArtistCard(artist, era._samplesLoaded)).join("")}
        </div>
      </section>
    `;
  }

  function renderErasSection() {
    if (!state.eras.length) {
      return renderLoadingStatus("화가 목록 연결 중");
    }
    return `${renderEraNav()}${renderEraPanel()}`;
  }

  function updateErasSection() {
    const host = pageRoot?.querySelector("#art-eras-host");
    if (!host) return;
    host.innerHTML = renderErasSection();
    bindEraEvents();
    bindProgressiveArtImages(pageRoot);
    if (isArtLoadingVisible()) startLoadingAnimation();
    else stopLoadingAnimation();
  }

  function selectEra(eraId) {
    if (!eraId || eraId === state.selectedEraId) return;
    state.selectedEraId = eraId;
    updateErasSection();
    void loadArtistSamplesForEra(eraId);
  }

  async function loadArtistSamplesForEra(eraId) {
    const era = state.eras.find((e) => e.id === eraId);
    if (!era || era._samplesLoaded) return;

    const artists = era.artists || [];
    const pending = artists.filter((artist) => !artist.sample_works?.length);
    if (!pending.length) {
      era._samplesLoaded = true;
      return;
    }

    await Promise.all(
      pending.map(async (artist) => {
        try {
          const data = await fetchArtJson(
            `/api/art/artist-samples?name=${encodeURIComponent(artist.name)}`,
            ART_FETCH_FAST
          );
          artist.sample_works = data.sample_works || [];
        } catch {
          artist.sample_works = [];
        }
      })
    );

    era._samplesLoaded = true;
    if (state.selectedEraId === eraId) updateErasSection();
  }

  function bindEraEvents() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-art-era]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.artEra;
        if (id) selectEra(id);
      });
    });
    pageRoot.querySelectorAll("[data-art-artist]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.artArtist;
        if (name) void loadArtistWorks(name);
      });
    });
    bindDescToggles();
    bindSampleThumbErrors();
  }

  function updateGenreNav() {
    const host = pageRoot?.querySelector("#art-genre-nav-host");
    if (!host) return;
    host.innerHTML = renderGenreNav();
    bindEvents();
    if (isArtLoadingVisible()) startLoadingAnimation();
  }

  function renderGenreNavHost() {
    return `<div id="art-genre-nav-host">${renderGenreNav()}</div>`;
  }

  function render() {
    if (!pageRoot) return;
    pageRoot.innerHTML = `
      <article class="content-panel art-panel">
        <header class="art-header">
          <h2>ART</h2>
        </header>
        ${state.error ? `<p class="art-status art-status-error" role="alert">${escapeHtml(state.error)}</p>` : ""}
        ${renderGenreNavHost()}
        <div id="art-works-host"></div>
        <footer class="art-refresh-bar" id="art-refresh-bar" aria-live="polite"></footer>
        <section class="art-eras-wrap" aria-label="시대별 주요 화가">
          <h3 class="art-eras-heading">시대별 주요 화가</h3>
          <div id="art-eras-host">${renderErasSection()}</div>
        </section>
        <p class="art-footnote">
          데이터·이미지:
          <a href="https://www.metmuseum.org/about-the-met/policies-and-documents/open-access" target="_blank" rel="noopener noreferrer">The Metropolitan Museum of Art</a>
          ·
          <a href="https://metmuseum.github.io/" target="_blank" rel="noopener noreferrer">Met Collection API</a>
          ·
          <a href="https://www.artic.edu/open-access" target="_blank" rel="noopener noreferrer">Art Institute of Chicago</a>
          ·
          <a href="https://api.artic.edu/docs/" target="_blank" rel="noopener noreferrer">artic.edu API</a>
        </p>
      </article>
    `;
    renderWorksSection();
    bindEvents();
    bindEraEvents();
    bindBgmUnlock();
    syncBgmPlayback();
    bindProgressiveArtImages(pageRoot);
    try {
      updateArtRefreshBar();
    } catch (_) {
      /* keep empty footer shell */
    }
    if (isArtLoadingVisible()) startLoadingAnimation();
    else stopLoadingAnimation();
  }

  function renderArtRefreshBar() {
    if (state.artistMode) {
      return `<footer class="art-refresh-bar is-hidden" id="art-refresh-bar" aria-hidden="true"></footer>`;
    }
    const genreLabel = genreMeta(state.genre)?.label || "장르";
    const updated = formatWorksUpdatedAt(state.worksUpdatedAt);
    const metaText = updated
      ? `마지막 갱신 ${updated} · 2시간마다 자동 갱신`
      : "서버에 저장된 작품을 표시합니다 · 2시간마다 자동 갱신";
    const busy = state.worksRefreshing;
    return `
      <footer class="art-refresh-bar" id="art-refresh-bar" aria-live="polite">
        <p class="art-refresh-meta">${escapeHtml(metaText)}</p>
        <button
          type="button"
          class="art-btn art-btn-primary art-refresh-btn"
          id="art-refresh-btn"
          ${busy || state.worksLoading ? "disabled" : ""}
        >
          ${busy ? "업데이트 중…" : `${escapeHtml(genreLabel)} 다시 요청하기`}
        </button>
      </footer>
    `;
  }

  function updateArtRefreshBar() {
    const host = pageRoot?.querySelector("#art-refresh-bar");
    if (!host) return;
    host.outerHTML = renderArtRefreshBar();
    pageRoot?.querySelector("#art-refresh-btn")?.addEventListener("click", () => {
      void refreshGenreWorks();
    });
  }

  function bindWorksEvents() {
    if (!pageRoot) return;
    pageRoot.querySelector("#art-back-genre")?.addEventListener("click", () => {
      void loadGenreWorks(state.genre);
    });
  }

  function bindEvents() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-art-genre]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.artGenre;
        if (!id) return;
        void loadGenreWorks(id);
      });
    });
  }

  async function renderPage(container) {
    pageRoot = container;
    abortCtrl = new AbortController();
    state.error = "";
    state.genre = "masterpiece";
    state.artistMode = false;
    state.selectedArtist = null;
    state.selectedWorkIndex = 0;
    state.genres = STATIC_GENRES.slice();
    state.eras = staticErasSkeleton();
    state.selectedEraId = state.eras[0]?.id || "";
    state.loading = false;
    state.worksLoading = false;
    state.worksTitle = STATIC_GENRES[0]?.hint || "";

    loadGenreCacheFromStorage();
    const cachedMaster = getCachedGenreWorks("masterpiece");
    if (cachedMaster) {
      state.works = cachedMaster.works;
      state.worksUpdatedAt = cachedMaster.updatedAt || "";
      state.selectedWorkIndex = cachedMaster.selectedWorkIndex || 0;
    } else {
      state.works = instantWorksForGenre("masterpiece");
    }

    render();
    wakeArtApi();

    const initialEraId = state.selectedEraId;
    void loadGenreWorks(state.genre);

    Promise.all([
      loadGenres()
        .then(() => updateGenreNav())
        .catch((err) => {
          if (err.name === "AbortError") return;
          state.genres = STATIC_GENRES.slice();
          updateGenreNav();
        }),
      loadEras()
        .then(() => {
          updateErasSection();
          const eraId = state.selectedEraId || initialEraId;
          if (eraId) void loadArtistSamplesForEra(eraId);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          state.eras = staticErasSkeleton();
          state.error = state.error || err.message || "시대별 화가 상세를 불러오지 못했습니다.";
          updateErasSection();
          const eraId = state.selectedEraId || initialEraId;
          if (eraId) void loadArtistSamplesForEra(eraId);
        })
    ]).catch(() => {});
  }

  function destroy() {
    closeArtFullscreen();
    pruningWorkKeys.clear();
    genreLoadSeq += 1;
    if (fsOverlay) {
      fsOverlay.remove();
      fsOverlay = null;
    }
    fsEventsBound = false;
    abortCtrl?.abort();
    abortCtrl = null;
    stopLoadingAnimation();
    stopGalleryMotion();
    stopBgm();
    if (bgmAudio) {
      bgmAudio.src = "";
      bgmAudio = null;
    }
    bgmSourceUrl = "";
    bgmUnlockBound = false;
    disconnectArtImageObserver();
    pageRoot = null;
  }

  function prefetchArtMasterpiece() {
    loadGenreCacheFromStorage();
    if (getCachedGenreWorks("masterpiece")) return;
    wakeArtApi();
    fetchArtJson("/api/art/works?genre=masterpiece", ART_FETCH_FAST)
      .then((data) => {
        const works = dedupeArtWorks(data.works || []);
        if (works.length) {
          cacheGenreWorks("masterpiece", works, data.updated_at || "", 0);
        }
      })
      .catch(() => {});
  }

  window.Art = { renderPage, destroy };

  if (typeof window !== "undefined") {
    const runPrefetch = () => prefetchArtMasterpiece();
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(runPrefetch, { timeout: 2000 });
    } else {
      setTimeout(runPrefetch, 600);
    }
  }
})();
