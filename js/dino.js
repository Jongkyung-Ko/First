(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;
  let loadingTimer = null;
  let loadingDotCount = 1;
  let fsOverlay = null;
  let fsEventsBound = false;
  let dinoFsImmersive = false;
  let bgmAudio = null;
  let bgmUnlockBound = false;
  let bgmSourceUrl = "";
  let sfxCtx = null;

  const ERAS = [
    { id: "triassic", label: "삼엽기", label_en: "Triassic", hint: "약 2억 5200만~2억 100만 년 전" },
    { id: "jurassic", label: "쥬라기", label_en: "Jurassic", hint: "약 2억 100만~1억 4500만 년 전" },
    { id: "cretaceous", label: "백악기", label_en: "Cretaceous", hint: "약 1억 4500만~6600만 년 전" }
  ];

  const SLIDE_INTERVAL_MS = 5000;
  const FADE_MS = 520;
  const THUMB_SCROLL_PX_PER_SEC = 14;
  const DINO_BGM_FILE = "assets/audio/bgm/space-dream-strings.mp3";
  const DINO_BGM_VOLUME = 0.336;
  const DINO_BGM_NARRATION_DUCK = 0.2;
  const DINO_NARRATION_VOLUME = 1;
  const FS_AUTO_OPTIONS = [5000, 10000, 15000, 0];

  const state = {
    eraIntros: [],
    erasData: {
      triassic: { dinosaurs: [], eraLabel: "", periodKo: "" },
      jurassic: { dinosaurs: [], eraLabel: "", periodKo: "" },
      cretaceous: { dinosaurs: [], eraLabel: "", periodKo: "" }
    },
    allDinosaurs: [],
    loading: false,
    error: "",
    selectedIndex: 0,
    slideshowTimer: null,
    thumbScrollRaf: null,
    thumbFlowOffset: 0,
    bgmEnabled: true,
    fsOpen: false,
    fsIndex: 0,
    fsSlides: [],
    fsAutoMs: 5000,
    fsTimer: null,
    fsPreparing: false,
    fsNarrationEnabled: false,
    imageSync: { active: false, total: 0, done: 0, failed: 0, dotCount: 1 },
    variantIndex: 0
  };

  let thumbScrollLastTime = 0;
  let mainImageLoadSeq = 0;
  const imageReady = new Set();
  let imagePrefetchAbort = null;
  let imageSyncTimer = null;
  let fsNarrationSeq = 0;
  const IMAGE_PREFETCH_CONCURRENCY = 2;

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
  }

  function assetBase() {
    if (location.protocol === "file:") return "./";
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function dinoBgmUrl() {
    return typeof window.resolveAudioAssetUrl === "function"
      ? window.resolveAudioAssetUrl(DINO_BGM_FILE)
      : assetBase() + DINO_BGM_FILE;
  }

  function ensureBgmAudio() {
    if (bgmAudio) return bgmAudio;
    bgmAudio = new Audio();
    bgmAudio.loop = true;
    bgmAudio.volume = DINO_BGM_VOLUME;
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
    const btn = pageRoot?.querySelector("#dino-bgm-btn");
    if (btn) {
      btn.classList.toggle("is-active", state.bgmEnabled);
      btn.setAttribute("aria-pressed", state.bgmEnabled ? "true" : "false");
      btn.textContent = state.bgmEnabled ? "🎵 BGM" : "🔇 BGM";
    }
    syncFsBgmButton();
  }

  function syncFsBgmButton() {
    const btn = fsOverlay?.querySelector("[data-dino-fs-bgm]");
    if (!btn) return;
    btn.classList.toggle("is-active", state.bgmEnabled);
    btn.setAttribute("aria-pressed", state.bgmEnabled ? "true" : "false");
    btn.textContent = state.bgmEnabled ? "🎵 BGM" : "🔇 BGM";
  }

  function syncBgmPlayback() {
    if (!pageRoot && !state.fsOpen) return;
    syncBgmButton();
    if (!state.bgmEnabled) {
      stopBgm();
      return;
    }
    const audio = ensureBgmAudio();
    applyBgmVolume(isFsNarrationPlaying());
    resetBgmSourceIfNeeded(dinoBgmUrl());
    audio.play().catch(() => {});
  }

  function isFsNarrationPlaying() {
    if (!webSpeechSupported() || !state.fsNarrationEnabled) return false;
    return window.speechSynthesis.speaking || window.speechSynthesis.pending;
  }

  function applyBgmVolume(duckForNarration = false) {
    if (!bgmAudio) return;
    bgmAudio.volume = duckForNarration
      ? DINO_BGM_VOLUME * DINO_BGM_NARRATION_DUCK
      : DINO_BGM_VOLUME;
  }

  function restoreBgmVolumeAfterNarration(seq) {
    if (seq !== fsNarrationSeq) return;
    applyBgmVolume(false);
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
      ensureDinoSfxCtx();
    };
    pageRoot.addEventListener("pointerdown", unlock, { once: true, passive: true });
    pageRoot.addEventListener("touchstart", unlock, { once: true, passive: true });
  }

  function ensureDinoSfxCtx() {
    if (!sfxCtx) {
      sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (sfxCtx.state === "suspended") sfxCtx.resume();
    return sfxCtx;
  }

  function playSlideClick() {
    try {
      const ctx = ensureDinoSfxCtx();
      const t = ctx.currentTime;
      [880, 620].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, t + i * 0.016);
        g.gain.setValueAtTime(0.07, t + i * 0.016);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.016 + 0.028);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t + i * 0.016);
        osc.stop(t + i * 0.016 + 0.035);
      });
    } catch (_) {
      /* ignore */
    }
  }

  function mediaUrl(path) {
    const raw = String(path || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("assets/") || raw.startsWith("data/")) {
      const slash = raw.lastIndexOf("/");
      if (slash >= 0) {
        const dir = raw.slice(0, slash + 1);
        const file = raw.slice(slash + 1);
        return assetBase() + dir + encodeURIComponent(file);
      }
      return assetBase() + encodeURIComponent(raw);
    }
    return `${apiBase()}${raw.startsWith("/") ? raw : `/${raw}`}`;
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function startLoadingDots(message) {
    stopLoadingDots();
    loadingDotCount = 1;
    const tick = () => {
      const el = pageRoot?.querySelector(".dino-status-loading");
      if (!el) return;
      loadingDotCount = (loadingDotCount % 3) + 1;
      el.textContent = `${message}${".".repeat(loadingDotCount)}`;
      loadingTimer = setTimeout(tick, 420);
    };
    tick();
  }

  function stopLoadingDots() {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
  }

  async function fetchJson(path, signal) {
    const res = await fetch(`${apiBase()}${path}`, {
      signal,
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const err = await res.json();
        detail = err.detail || err.message || detail;
      } catch (_) {
        /* ignore */
      }
      throw new Error(typeof detail === "string" ? detail : "요청에 실패했습니다.");
    }
    return res.json();
  }

  function stopSlideshow() {
    if (state.slideshowTimer) {
      clearInterval(state.slideshowTimer);
      state.slideshowTimer = null;
    }
  }

  function startSlideshow() {
    stopSlideshow();
    if (!pageRoot || state.allDinosaurs.length < 2 || state.fsOpen) return;
    state.slideshowTimer = setInterval(() => {
      const dino = state.allDinosaurs[state.selectedIndex];
      const imgs = dinoStaticImages(dino);
      if (imgs.length > 1) {
        state.variantIndex = (state.variantIndex + 1) % imgs.length;
        if (state.variantIndex === 0) {
          state.selectedIndex = (state.selectedIndex + 1) % state.allDinosaurs.length;
        }
      } else {
        state.variantIndex = 0;
        state.selectedIndex = (state.selectedIndex + 1) % state.allDinosaurs.length;
      }
      updateGalleryView({ fade: true });
    }, SLIDE_INTERVAL_MS);
  }

  function stopThumbScroll() {
    if (state.thumbScrollRaf) {
      cancelAnimationFrame(state.thumbScrollRaf);
      state.thumbScrollRaf = null;
    }
    thumbScrollLastTime = 0;
  }

  function getThumbLoopWidth(track) {
    if (!track) return 0;
    return track.scrollWidth / 2;
  }

  function applyThumbTransform() {
    const flow = pageRoot?.querySelector("#dino-thumb-flow");
    if (!flow) return;
    flow.style.transform = `translate3d(${-state.thumbFlowOffset}px, 0, 0)`;
  }

  function startThumbAutoScroll() {
    stopThumbScroll();
    const track = pageRoot?.querySelector("#dino-thumb-track");
    const flow = pageRoot?.querySelector("#dino-thumb-flow");
    if (!track || !flow) return;
    track.classList.add("is-continuous");
    flow.classList.add("is-flowing");
    applyThumbTransform();

    const tick = (now) => {
      if (!pageRoot || !track.isConnected) {
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
    state.thumbScrollRaf = requestAnimationFrame(tick);
  }

  function scrollThumbBy(delta) {
    const track = pageRoot?.querySelector("#dino-thumb-track");
    const loopWidth = getThumbLoopWidth(track);
    if (!loopWidth) return;
    state.thumbFlowOffset = (state.thumbFlowOffset + delta + loopWidth) % loopWidth;
    applyThumbTransform();
  }

  function scrollThumbToIndex(index) {
    const track = pageRoot?.querySelector("#dino-thumb-track");
    const viewport = pageRoot?.querySelector("#dino-thumb-viewport");
    if (!track || !viewport || !state.allDinosaurs.length) return;
    const thumbs = track.querySelectorAll("[data-dino-thumb]");
    const thumb = thumbs[index];
    if (!thumb) return;
    const loopWidth = getThumbLoopWidth(track);
    if (!loopWidth) return;
    const thumbLeft = thumb.offsetLeft;
    const thumbWidth = thumb.offsetWidth || thumb.getBoundingClientRect().width;
    const viewWidth = viewport.clientWidth;
    let target = thumbLeft - (viewWidth - thumbWidth) / 2;
    if (!Number.isFinite(target)) return;
    target = Math.max(0, Math.min(target, Math.max(0, loopWidth - 1)));
    state.thumbFlowOffset = target;
    applyThumbTransform();
  }

  function findDinoIndexByName(name) {
    const key = String(name || "").trim();
    if (!key) return -1;
    return state.allDinosaurs.findIndex((d) => d.name === key || d.name_en === key || d.id === key);
  }

  async function warmDinoImage(dino) {
    if (!dino || !dinoNeedsApiWarm(dino) || imageReady.has(dino.id)) return true;
    const thumbUrl = dinoImageUrl(dino, "thumb");
    const fullUrl = dinoImageUrl(dino, "full");
    for (const url of [fullUrl, thumbUrl]) {
      if (!url) continue;
      try {
        const res = await fetch(url, { mode: "cors", credentials: "omit" });
        if (!res.ok) continue;
        markDinoImageReady(dino.id, thumbUrl);
        return true;
      } catch (_) {
        /* try next */
      }
    }
    return false;
  }

  function dinoStaticImages(dino) {
    if (!dino) return [];
    const list = Array.isArray(dino.static_images) ? dino.static_images.filter(Boolean) : [];
    if (list.length) return list.map((p) => mediaUrl(p));
    const one = dino.static_image || (dinoHasStaticImage(dino) ? dino.image_url : "");
    return one ? [mediaUrl(one)] : [];
  }

  function dinoImageUrl(dino, kind, variantIdx) {
    if (!dino) return "";
    const imgs = dinoStaticImages(dino);
    if (imgs.length) {
      if (kind === "thumb") return imgs[0];
      const vi = Number.isFinite(variantIdx) ? variantIdx : state.variantIndex;
      return imgs[vi] || imgs[0];
    }
    if (kind === "thumb") return mediaUrl(dino.thumb_url || dino.image_url);
    return mediaUrl(dino.image_url || dino.thumb_url);
  }

  function dinoHasStaticImage(dino) {
    if (Array.isArray(dino?.static_images) && dino.static_images.length) return true;
    const url = String(dino?.static_image || dino?.image_url || "");
    return url.startsWith("assets/");
  }

  function dinoNeedsApiWarm(dino) {
    if (dinoHasStaticImage(dino)) return false;
    const url = String(dino?.image_url || "");
    return url.includes("/api/dino/image/") && !url.includes("/api/dino/image-file/");
  }

  function eraIntroNeedsApiWarm(intro) {
    const url = String(intro?.intro_image_url || "");
    if (url.startsWith("assets/")) return false;
    return url.includes("/api/dino/image/") && !url.includes("/api/dino/image-file/");
  }

  function applyStaticCatalog(staticData) {
    if (!staticData?.catalog) return false;
    state.eraIntros = staticData.eras || [];
    ERAS.forEach((era) => {
      const rows = staticData.catalog[era.id] || [];
      state.erasData[era.id] = {
        dinosaurs: rows,
        eraLabel: era.label,
        periodKo: era.hint
      };
    });
    rebuildAllDinosaurs();
    imageReady.clear();
    state.allDinosaurs.forEach((d) => {
      if (dinoHasStaticImage(d)) {
        imageReady.add(d.id);
        dinoStaticImages(d);
      }
    });
    (state.eraIntros || []).forEach((intro) => {
      const u = String(intro.intro_image_url || "");
      if (u.startsWith("assets/")) {
        imageReady.add(`era-${intro.id}`);
      }
    });
    return state.allDinosaurs.length > 0;
  }

  async function refreshMissingImagesFromApi(signal) {
    const erasNeedingApi = ERAS.filter((era) =>
      (state.erasData[era.id]?.dinosaurs || []).some((d) => !dinoHasStaticImage(d))
    );
    if (!erasNeedingApi.length) return;

    for (const era of erasNeedingApi) {
      if (signal?.aborted) return;
      try {
        const data = await fetchJson(`/api/dino/dinosaurs?era=${encodeURIComponent(era.id)}`, signal);
        const byId = Object.fromEntries((data.dinosaurs || []).map((d) => [d.id, d]));
        const pack = state.erasData[era.id];
        if (!pack) continue;
        pack.dinosaurs = pack.dinosaurs.map((d) => {
          if (dinoHasStaticImage(d)) return d;
          const remote = byId[d.id];
          if (!remote?.image_url) return d;
          return { ...d, ...remote, static_image: "" };
        });
      } catch (_) {
        /* keep placeholders */
      }
    }
    rebuildAllDinosaurs();
    if (!signal?.aborted && pageRoot) {
      paint();
      void prefetchDinoImages();
    }
  }

  function renderImageSyncStatus() {
    const sync = state.imageSync;
    if (!sync.active || sync.done >= sync.total) return "";
    const dots = ".".repeat(sync.dotCount);
    const failNote = sync.failed ? ` · 실패 ${sync.failed}` : "";
    return `<p class="dino-image-sync" id="dino-image-sync" role="status" aria-live="polite">이미지 업데이트 중${dots} (${sync.done}/${sync.total})${failNote}</p>`;
  }

  function updateImageSyncUi() {
    const el = pageRoot?.querySelector("#dino-image-sync");
    if (!el) return;
    const sync = state.imageSync;
    if (!sync.active || sync.done >= sync.total) {
      el.remove();
      return;
    }
    const dots = ".".repeat(sync.dotCount);
    const failNote = sync.failed ? ` · 실패 ${sync.failed}` : "";
    el.textContent = `이미지 업데이트 중${dots} (${sync.done}/${sync.total})${failNote}`;
  }

  function startImageSyncDots() {
    stopImageSyncDots();
    imageSyncTimer = setInterval(() => {
      state.imageSync.dotCount = (state.imageSync.dotCount % 3) + 1;
      updateImageSyncUi();
    }, 420);
  }

  function stopImageSyncDots() {
    if (imageSyncTimer) {
      clearInterval(imageSyncTimer);
      imageSyncTimer = null;
    }
  }

  function stopImagePrefetch() {
    stopImageSyncDots();
    if (imagePrefetchAbort) {
      imagePrefetchAbort.abort();
      imagePrefetchAbort = null;
    }
    state.imageSync.active = false;
  }

  function markDinoImageReady(dinoId, thumbUrl) {
    imageReady.add(dinoId);
    if (!pageRoot) return;
    const dino = state.allDinosaurs.find((d) => d.id === dinoId);
    const fullUrl = dino ? dinoImageUrl(dino, "full") : thumbUrl;
    pageRoot.querySelectorAll(`[data-dino-img-id="${dinoId}"]`).forEach((img) => {
      img.src = img.classList.contains("dino-main-img") ? fullUrl : thumbUrl;
      img.hidden = false;
    });
    pageRoot.querySelectorAll(`[data-dino-img-placeholder="${dinoId}"]`).forEach((el) => {
      el.remove();
    });
  }

  function renderDinoImg(dinoId, url, { alt = "", eager = false, className = "", id = "" } = {}) {
    const idAttr = id ? ` id="${escapeHtml(id)}"` : "";
    const dino = state.allDinosaurs.find((d) => d.id === dinoId);
    const showNow =
      url &&
      (imageReady.has(dinoId) ||
        (dino && dinoHasStaticImage(dino)) ||
        (dino && !dinoNeedsApiWarm(dino)) ||
        (!dino && dinoId.startsWith("era-") && imageReady.has(dinoId)));
    if (showNow) {
      const loadAttr = eager ? ' loading="eager"' : ' loading="lazy"';
      return `<img class="${className}" data-dino-img-id="${dinoId}"${idAttr} src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${loadAttr} decoding="async" referrerpolicy="no-referrer">`;
    }
    const phClass = className ? `${className} dino-img-placeholder` : "dino-img-placeholder";
    return `<span class="${phClass}" data-dino-img-placeholder="${dinoId}" aria-hidden="true">🦕</span><img class="${className}" data-dino-img-id="${dinoId}"${idAttr} alt="${escapeHtml(alt)}" hidden decoding="async" referrerpolicy="no-referrer">`;
  }

  async function prefetchDinoImages() {
    stopImagePrefetch();

    const tasks = [];
    state.allDinosaurs.forEach((dino, index) => {
      if (!dinoNeedsApiWarm(dino)) {
        imageReady.add(dino.id);
        return;
      }
      tasks.push({
        id: dino.id,
        url: dinoImageUrl(dino, "thumb"),
        priority: index === state.selectedIndex ? 0 : 1
      });
    });
    state.eraIntros.forEach((intro) => {
      if (!eraIntroNeedsApiWarm(intro)) return;
      tasks.push({
        id: `era-${intro.id}`,
        url: mediaUrl(intro.intro_image_url),
        priority: 2
      });
    });
    tasks.sort((a, b) => a.priority - b.priority);

    if (!tasks.length) return;

    imagePrefetchAbort = new AbortController();
    const signal = imagePrefetchAbort.signal;
    state.imageSync = {
      active: true,
      total: tasks.length,
      done: 0,
      failed: 0,
      dotCount: 1
    };
    updateImageSyncUi();
    if (!pageRoot?.querySelector("#dino-image-sync")) {
      pageRoot?.querySelector("#dino-main-canvas")?.insertAdjacentHTML("afterend", renderImageSyncStatus());
    }
    startImageSyncDots();

    let cursor = 0;
    async function worker() {
      while (cursor < tasks.length) {
        if (signal.aborted) return;
        const task = tasks[cursor++];
        try {
          const res = await fetch(task.url, { signal, mode: "cors", credentials: "omit" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          if (signal.aborted) return;
          markDinoImageReady(task.id, task.url);
        } catch (err) {
          if (signal.aborted || err.name === "AbortError") return;
          state.imageSync.failed += 1;
        }
        state.imageSync.done += 1;
        updateImageSyncUi();
        if (task.id === state.allDinosaurs[state.selectedIndex]?.id) {
          updateGalleryView({ fade: false });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(IMAGE_PREFETCH_CONCURRENCY, tasks.length) }, () => worker())
    );

    if (signal.aborted) return;
    state.imageSync.active = false;
    stopImageSyncDots();
    updateImageSyncUi();
    syncFullscreenButton();
  }

  function eraIntroFor(eraId) {
    return state.eraIntros.find((e) => e.id === eraId) || ERAS.find((e) => e.id === eraId) || {};
  }

  function rebuildAllDinosaurs() {
    const all = [];
    ERAS.forEach((era) => {
      const pack = state.erasData[era.id];
      (pack?.dinosaurs || []).forEach((dino) => {
        all.push({
          ...dino,
          era: era.id,
          era_label: pack.eraLabel || era.label,
          period_ko: pack.periodKo || era.hint
        });
      });
    });
    state.allDinosaurs = all;
  }

  function buildFsSlides() {
    return state.allDinosaurs
      .map((dino, index) => ({
        index,
        imageUrl: dinoImageUrl(dino, "full"),
        title: dino.name || "",
        subtitle: dino.name_en || "",
        meta: [dino.era_label, dino.diet, dino.length, dino.weight].filter(Boolean).join(" · "),
        caption: dino.description || ""
      }))
      .filter((slide) => slide.imageUrl);
  }

  function canOpenFullscreen() {
    return !state.loading && buildFsSlides().length > 0;
  }

  function syncFullscreenButton() {
    const btn = pageRoot?.querySelector("#dino-fullscreen");
    if (!btn) return;
    btn.disabled = !canOpenFullscreen();
  }

  function renderMainMeta(dino) {
    if (!dino) return "";
    const stats = [
      dino.length ? `길이 ${dino.length}` : "",
      dino.height ? `높이 ${dino.height}` : "",
      dino.weight ? `체중 ${dino.weight}` : "",
      dino.diet ? `식성 ${dino.diet}` : "",
      dino.period_ko ? `시대 ${dino.period_ko}` : ""
    ]
      .filter(Boolean)
      .join(" · ");
    const credit = dino.image_page_url
      ? `<p class="dino-image-credit">이미지: <a href="${escapeHtml(dino.image_page_url)}" target="_blank" rel="noopener noreferrer">Pixabay</a>${dino.image_user ? ` · ${escapeHtml(dino.image_user)}` : ""}</p>`
      : "";
    return `
      <h3 class="dino-main-title">${escapeHtml(dino.name)}</h3>
      <p class="dino-main-subtitle">${escapeHtml(dino.name_en || "")}</p>
      <p class="dino-main-stats">${escapeHtml(stats)}</p>
      <p class="dino-main-desc">${escapeHtml(dino.description || "")}</p>
      ${credit}`;
  }

  function renderThumbItem(dino, index) {
    const src = dinoImageUrl(dino, "thumb");
    if (!src && !dinoNeedsApiWarm(dino)) return "";
    const active = index === state.selectedIndex ? " is-active" : "";
    return `
      <button type="button" class="dino-thumb-item${active}" data-dino-thumb="${index}" aria-label="${escapeHtml(dino.name)}" aria-current="${index === state.selectedIndex ? "true" : "false"}">
        ${renderDinoImg(dino.id, src)}
      </button>`;
  }

  function renderSpeciesCard(dino, globalIndex) {
    const src = dinoImageUrl(dino, "thumb");
    const active = globalIndex === state.selectedIndex ? " is-active" : "";
    const meta = [dino.diet, dino.length].filter(Boolean).join(" · ");
    return `
      <button type="button" class="dino-species-card${active}" data-dino-select="${globalIndex}" aria-label="${escapeHtml(dino.name)} 보기">
        <div class="dino-species-card-img-wrap">
          ${
            src || dinoNeedsApiWarm(dino)
              ? renderDinoImg(dino.id, src)
              : `<div class="dino-species-card-placeholder" aria-hidden="true">🦕</div>`
          }
        </div>
        <div class="dino-species-card-body">
          <p class="dino-species-card-name">${escapeHtml(dino.name)}</p>
          <p class="dino-species-card-meta">${escapeHtml(meta)}</p>
        </div>
      </button>`;
  }

  function renderEraSection(era, startIndex) {
    const intro = eraIntroFor(era.id);
    const pack = state.erasData[era.id] || { dinosaurs: [] };
    const dinosaurs = pack.dinosaurs || [];
    const imgSrc = intro.intro_image_url ? mediaUrl(intro.intro_image_url) : "";

    return `
      <section class="dino-era-section" id="dino-era-${escapeHtml(era.id)}" aria-labelledby="dino-era-title-${escapeHtml(era.id)}">
        <header class="dino-era-section-header">
          <div class="dino-era-section-heading">
            <h3 class="dino-era-section-title" id="dino-era-title-${escapeHtml(era.id)}">${escapeHtml(intro.intro_title || `${era.label} — ${era.label_en}`)}</h3>
            <p class="dino-era-section-period">${escapeHtml(intro.period_ko || era.hint || "")}</p>
            ${intro.highlight_dino ? `<p class="dino-era-section-highlight">대표 종: <button type="button" class="dino-highlight-link" data-dino-highlight="${escapeHtml(intro.highlight_dino)}">${escapeHtml(intro.highlight_dino)}</button></p>` : ""}
          </div>
          ${
            imgSrc
              ? `<div class="dino-era-section-hero">${renderDinoImg(`era-${era.id}`, imgSrc, { alt: `${era.label} 대표 이미지` })}</div>`
              : ""
          }
        </header>
        <p class="dino-era-section-desc">${escapeHtml(intro.intro_description || "")}</p>
        <div class="dino-card-grid" role="list">
          ${dinosaurs.map((dino, i) => renderSpeciesCard(dino, startIndex + i)).join("")}
        </div>
      </section>`;
  }

  function renderEraBlocks() {
    let startIndex = 0;
    const sections = ERAS.map((era) => {
      const pack = state.erasData[era.id] || { dinosaurs: [] };
      const html = renderEraSection(era, startIndex);
      startIndex += (pack.dinosaurs || []).length;
      return html;
    });
    return `<div class="dino-era-blocks">${sections.join("")}</div>`;
  }

  function renderToolbar() {
    return `
      <div class="dino-toolbar">
        <button type="button" class="dino-btn dino-bgm-btn is-active" id="dino-bgm-btn" aria-pressed="true" title="공룡 시대 BGM">🎵 BGM</button>
        <button type="button" class="dino-btn dino-fs-btn" id="dino-fullscreen" title="공룡 전체화면 슬라이드쇼" aria-label="공룡 전체화면 슬라이드쇼" disabled>
          <svg class="dino-fs-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>
          전체화면
        </button>
      </div>`;
  }

  function renderGallery() {
    if (state.loading && !state.allDinosaurs.length) {
      return `<p class="dino-status dino-status-loading" role="status">공룡 불러오는 중</p>`;
    }
    if (state.error && !state.allDinosaurs.length) {
      return `<p class="dino-status dino-status-error" role="alert">${escapeHtml(state.error)}</p>`;
    }
    if (!state.allDinosaurs.length) {
      return `<p class="dino-status dino-status-info">표시할 공룡이 없습니다.</p>`;
    }

    const dino = state.allDinosaurs[state.selectedIndex] || state.allDinosaurs[0];
    const mainSrc = dinoImageUrl(dino, "full");
    const thumbsHtml = state.allDinosaurs.map(renderThumbItem).filter(Boolean).join("");

    return `
      <div class="dino-gallery" id="dino-gallery">
        ${renderToolbar()}
        <div class="dino-gallery-controls">
          <div class="dino-thumb-carousel" aria-label="공룡 썸네일">
            <button type="button" class="dino-thumb-scroll-btn" id="dino-thumb-prev" aria-label="이전 공룡">‹</button>
            <div class="dino-thumb-viewport">
              <div class="dino-thumb-flow" id="dino-thumb-flow">
                <div class="dino-thumb-track is-continuous" id="dino-thumb-track">
                  ${thumbsHtml}${thumbsHtml}
                </div>
              </div>
            </div>
            <button type="button" class="dino-thumb-scroll-btn" id="dino-thumb-next" aria-label="다음 공룡">›</button>
          </div>
          <p class="dino-slideshow-hint">5초마다 자동 전환 · 썸네일·카드를 눌러 선택</p>
        </div>
        <div class="dino-main-canvas" id="dino-main-canvas">
          ${
            mainSrc || dinoNeedsApiWarm(dino)
              ? renderDinoImg(dino.id, mainSrc, {
                  alt: dino.name,
                  eager: true,
                  className: "dino-main-img",
                  id: "dino-main-img"
                })
              : `<div class="dino-main-placeholder" aria-hidden="true">🦕</div>`
          }
        </div>
        ${renderImageSyncStatus()}
        <div class="dino-main-meta" id="dino-main-meta">
          ${renderMainMeta(dino)}
        </div>
        ${renderEraBlocks()}
      </div>`;
  }

  function renderPageHtml() {
    const total = state.allDinosaurs.length;
    return `
      <div class="dino-panel">
        <header class="dino-header">
          <h2>🦖 Dino</h2>
          <p class="dino-tagline">메소조ic 공룡 3대 시대 · 대표 공룡 ${total || 30}종</p>
        </header>
        <section class="dino-works-section">
          ${renderGallery()}
        </section>
        <p class="dino-footnote">
          데이터: <a href="https://dinosaur-facts-api.shorthair.fr/dinosaurs" target="_blank" rel="noopener noreferrer">Dinosaur Facts API</a>
          · 이미지: 로컬 PNG · <a href="https://pixabay.com/" target="_blank" rel="noopener noreferrer">Pixabay</a> (일부)
          · BGM: slow orchestral strings
        </p>
      </div>`;
  }

  function updateGalleryView(options = {}) {
    const { fade = false } = options;
    if (!pageRoot || !state.allDinosaurs.length) return;
    const dino = state.allDinosaurs[state.selectedIndex];
    if (!dino) return;

    const loadSeq = ++mainImageLoadSeq;
    const canvas = pageRoot.querySelector("#dino-main-canvas");
    let img = pageRoot.querySelector("#dino-main-img");
    const mainSrc = dinoImageUrl(dino, "full");

    const syncMetaAndSelection = () => {
      const meta = pageRoot.querySelector("#dino-main-meta");
      if (meta) meta.innerHTML = renderMainMeta(dino);
      pageRoot.querySelectorAll("[data-dino-thumb]").forEach((btn) => {
        const idx = Number(btn.dataset.dinoThumb);
        const active = idx === state.selectedIndex;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-current", active ? "true" : "false");
      });
      pageRoot.querySelectorAll("[data-dino-select]").forEach((btn) => {
        const idx = Number(btn.dataset.dinoSelect);
        btn.classList.toggle("is-active", idx === state.selectedIndex);
      });
    };

    if (!mainSrc) {
      syncMetaAndSelection();
      return;
    }

    const showImage = (src) => {
      if (loadSeq !== mainImageLoadSeq) return;
      pageRoot.querySelectorAll(`[data-dino-img-placeholder="${dino.id}"]`).forEach((el) => el.remove());
      if (!img || img.hidden) {
        canvas.innerHTML = renderDinoImg(dino.id, src, {
          alt: dino.name,
          eager: true,
          className: "dino-main-img",
          id: "dino-main-img"
        });
        img = pageRoot.querySelector("#dino-main-img");
        syncMetaAndSelection();
        return;
      }
      img.alt = dino.name;
      if (fade) img.classList.add("is-fading");
      img.onload = () => {
        if (loadSeq !== mainImageLoadSeq) return;
        img.classList.remove("is-fading");
      };
      img.onerror = () => {
        if (loadSeq !== mainImageLoadSeq) return;
        img.classList.remove("is-fading");
      };
      img.src = src;
      syncMetaAndSelection();
    };

    if (!fade || !img) {
      showImage(mainSrc);
      return;
    }

    img.classList.add("is-fading");
    setTimeout(() => {
      if (loadSeq !== mainImageLoadSeq) return;
      showImage(mainSrc);
    }, FADE_MS);
  }

  function selectDino(index, options = {}) {
    void focusDino(index, options);
  }

  async function focusDino(index, options = {}) {
    if (!Number.isFinite(index) || index < 0 || index >= state.allDinosaurs.length) return;
    const dino = state.allDinosaurs[index];
    if (!dino) return;

    stopSlideshow();
    state.selectedIndex = index;
    state.variantIndex = 0;
    scrollThumbToIndex(index);
    syncMetaAndSelectionForIndex(index);

    if (dinoNeedsApiWarm(dino) && !imageReady.has(dino.id)) {
      setCanvasLoading(true, `${dino.name} 이미지 검색 중`);
      await warmDinoImage(dino);
      setCanvasLoading(false);
    }

    updateGalleryView({ fade: options.fade !== false });

    if (options.scrollToGallery !== false) {
      pageRoot?.querySelector("#dino-gallery")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (options.restartSlideshow) startSlideshow();
  }

  function syncMetaAndSelectionForIndex(index) {
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-dino-thumb]").forEach((btn) => {
      const idx = Number(btn.dataset.dinoThumb);
      const active = idx === index;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-current", active ? "true" : "false");
    });
    pageRoot.querySelectorAll("[data-dino-select]").forEach((btn) => {
      const idx = Number(btn.dataset.dinoSelect);
      btn.classList.toggle("is-active", idx === index);
    });
  }

  function setCanvasLoading(active, message) {
    const canvas = pageRoot?.querySelector("#dino-main-canvas");
    if (!canvas) return;
    let overlay = canvas.querySelector(".dino-canvas-loading");
    if (!active) {
      overlay?.remove();
      return;
    }
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "dino-canvas-loading";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      canvas.appendChild(overlay);
    }
    overlay.textContent = message || "이미지 검색 중…";
  }

  function stopFsSlideshow() {
    if (state.fsTimer) {
      clearInterval(state.fsTimer);
      state.fsTimer = null;
    }
  }

  function webSpeechSupported() {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    );
  }

  function sanitizeNarrationText(text) {
    return String(text || "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function pickKoreanVoice() {
    if (!webSpeechSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    const koVoices = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("ko"));
    return koVoices.find((v) => v.localService) || koVoices[0] || null;
  }

  function stopFsNarration() {
    fsNarrationSeq += 1;
    if (!webSpeechSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
    applyBgmVolume(false);
  }

  function speakFsSlide(slide) {
    if (!state.fsNarrationEnabled || !state.fsOpen || !slide) return;
    const text = sanitizeNarrationText(slide.caption);
    if (!text || !webSpeechSupported()) return;

    stopFsNarration();
    const seq = fsNarrationSeq;
    window.speechSynthesis.getVoices();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    const voice = pickKoreanVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "ko-KR";
    }
    utterance.rate = 0.95;
    utterance.volume = DINO_NARRATION_VOLUME;
    applyBgmVolume(true);
    utterance.onend = () => restoreBgmVolumeAfterNarration(seq);
    utterance.onerror = () => {
      if (seq !== fsNarrationSeq) return;
      restoreBgmVolumeAfterNarration(seq);
    };

    window.speechSynthesis.speak(utterance);
  }

  function syncFsNarrationButton() {
    if (!fsOverlay) return;
    const btn = fsOverlay.querySelector("[data-dino-fs-narration]");
    if (!btn) return;
    btn.classList.toggle("is-active", state.fsNarrationEnabled);
    btn.setAttribute("aria-pressed", state.fsNarrationEnabled ? "true" : "false");
  }

  function toggleFsNarration() {
    state.fsNarrationEnabled = !state.fsNarrationEnabled;
    syncFsNarrationButton();
    if (!state.fsNarrationEnabled) {
      stopFsNarration();
      return;
    }
    state.fsAutoMs = 15000;
    syncFsAutoButtons();
    stopFsSlideshow();
    startFsSlideshow();
    speakFsSlide(state.fsSlides[state.fsIndex]);
  }

  function syncFsAutoButtons() {
    if (!fsOverlay) return;
    fsOverlay.querySelectorAll("[data-dino-fs-auto]").forEach((btn) => {
      const ms = Number(btn.dataset.dinoFsAuto);
      btn.classList.toggle("is-active", ms === state.fsAutoMs);
      btn.setAttribute("aria-pressed", ms === state.fsAutoMs ? "true" : "false");
    });
  }

  function ensureDinoFullscreenOverlay() {
    if (fsOverlay?.querySelector("[data-dino-fs-img]")) return;
    if (fsOverlay) {
      fsOverlay.remove();
      fsOverlay = null;
    }
    fsOverlay = document.createElement("div");
    fsOverlay.id = "dino-slideshow-fs";
    fsOverlay.className = "dino-slideshow-fs";
    fsOverlay.hidden = true;
    fsOverlay.setAttribute("role", "dialog");
    fsOverlay.setAttribute("aria-modal", "true");
    fsOverlay.setAttribute("aria-label", "공룡 전체화면 슬라이드쇼");
    fsOverlay.innerHTML = `
      <div class="dino-fs-top">
        <div class="dino-fs-auto" role="group" aria-label="자동 넘김">
          ${FS_AUTO_OPTIONS.map(
            (ms) =>
              `<button type="button" class="dino-fs-auto-btn${ms === state.fsAutoMs ? " is-active" : ""}" data-dino-fs-auto="${ms}" aria-pressed="${ms === state.fsAutoMs ? "true" : "false"}">${ms === 0 ? "OFF" : `${ms / 1000}초`}</button>`
          ).join("")}
          <button type="button" class="dino-fs-auto-btn${state.fsNarrationEnabled ? " is-active" : ""}" data-dino-fs-narration aria-pressed="${state.fsNarrationEnabled ? "true" : "false"}" title="공룡 설명 음성 나래이션">나래이션</button>
        </div>
        <div class="dino-fs-top-right">
          <button type="button" class="dino-fs-bgm-btn is-active" data-dino-fs-bgm aria-pressed="true" title="BGM">🎵 BGM</button>
          <button type="button" class="dino-fs-close" data-dino-fs-close aria-label="전체화면 닫기">✕</button>
        </div>
      </div>
      <button type="button" class="dino-fs-nav dino-fs-nav-prev" data-dino-fs-prev aria-label="이전 공룡">‹</button>
      <button type="button" class="dino-fs-nav dino-fs-nav-next" data-dino-fs-next aria-label="다음 공룡">›</button>
      <div class="dino-fs-stage">
        <img class="dino-fs-img" data-dino-fs-img alt="" decoding="async" referrerpolicy="no-referrer">
        <div class="dino-fs-caption-overlay">
          <p class="dino-fs-progress" data-dino-fs-progress></p>
          <h2 class="dino-fs-title" data-dino-fs-title></h2>
          <p class="dino-fs-subtitle" data-dino-fs-subtitle></p>
          <p class="dino-fs-meta" data-dino-fs-meta></p>
          <p class="dino-fs-desc" data-dino-fs-desc></p>
        </div>
      </div>`;
    document.body.appendChild(fsOverlay);

    fsOverlay.querySelector("[data-dino-fs-close]")?.addEventListener("click", closeDinoFullscreen);
    fsOverlay.querySelector("[data-dino-fs-bgm]")?.addEventListener("click", toggleBgm);
    fsOverlay.querySelector("[data-dino-fs-prev]")?.addEventListener("click", () => advanceFsSlide(-1, { user: true }));
    fsOverlay.querySelector("[data-dino-fs-next]")?.addEventListener("click", () => advanceFsSlide(1, { user: true }));
    fsOverlay.querySelectorAll("[data-dino-fs-auto]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ms = Number(btn.dataset.dinoFsAuto);
        if (!Number.isFinite(ms)) return;
        state.fsAutoMs = ms;
        syncFsAutoButtons();
        stopFsSlideshow();
        startFsSlideshow();
      });
    });
    fsOverlay.querySelector("[data-dino-fs-narration]")?.addEventListener("click", toggleFsNarration);
    fsOverlay.addEventListener("click", (event) => {
      if (event.target === fsOverlay) closeDinoFullscreen();
    });
  }

  function bindDinoFullscreenEvents() {
    if (fsEventsBound) return;
    fsEventsBound = true;
    document.addEventListener("keydown", (event) => {
      if (!state.fsOpen) return;
      if (event.key === "Escape") closeDinoFullscreen();
      if (event.key === "ArrowRight") advanceFsSlide(1, { user: true });
      if (event.key === "ArrowLeft") advanceFsSlide(-1, { user: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (!state.fsOpen) return;
      if (document.visibilityState === "hidden") {
        stopFsSlideshow();
        stopFsNarration();
      } else {
        startFsSlideshow();
      }
    });
    document.addEventListener("fullscreenchange", onDinoFsFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onDinoFsFullscreenChange);
  }

  function getDinoFsFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function onDinoFsFullscreenChange() {
    if (!fsOverlay) return;
    if (getDinoFsFullscreenElement() === fsOverlay) {
      fsOverlay.classList.add("is-immersive");
      dinoFsImmersive = true;
      return;
    }
    if (!state.fsOpen && !state.fsPreparing) {
      fsOverlay.classList.remove("is-immersive");
      document.documentElement.classList.remove("dino-fs-immersive-lock");
      dinoFsImmersive = false;
    }
  }

  async function enterDinoFsImmersive() {
    if (!fsOverlay) return;
    try {
      if (fsOverlay.requestFullscreen) await fsOverlay.requestFullscreen();
      else if (fsOverlay.webkitRequestFullscreen) await fsOverlay.webkitRequestFullscreen();
      else throw new Error("fullscreen unsupported");
      fsOverlay.classList.add("is-immersive");
      dinoFsImmersive = true;
    } catch (_) {
      fsOverlay.classList.add("is-immersive");
      document.documentElement.classList.add("dino-fs-immersive-lock");
      dinoFsImmersive = true;
    }
  }

  async function exitDinoFsImmersive() {
    const fsEl = getDinoFsFullscreenElement();
    if (fsEl) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (_) {
        /* ignore */
      }
    }
    if (fsOverlay) fsOverlay.classList.remove("is-immersive");
    document.documentElement.classList.remove("dino-fs-immersive-lock");
    dinoFsImmersive = false;
  }

  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
  }

  function syncFsCaption() {
    if (!fsOverlay || fsOverlay.hidden) return;
    const slide = state.fsSlides[state.fsIndex];
    if (!slide) return;
    const progressEl = fsOverlay.querySelector("[data-dino-fs-progress]");
    const titleEl = fsOverlay.querySelector("[data-dino-fs-title]");
    const subtitleEl = fsOverlay.querySelector("[data-dino-fs-subtitle]");
    const metaEl = fsOverlay.querySelector("[data-dino-fs-meta]");
    const descEl = fsOverlay.querySelector("[data-dino-fs-desc]");
    if (progressEl) progressEl.textContent = `${state.fsIndex + 1} / ${state.fsSlides.length}`;
    if (titleEl) titleEl.textContent = slide.title;
    if (subtitleEl) {
      subtitleEl.textContent = slide.subtitle;
      subtitleEl.hidden = !slide.subtitle;
    }
    if (metaEl) {
      metaEl.textContent = slide.meta;
      metaEl.hidden = !slide.meta;
    }
    if (descEl) descEl.textContent = slide.caption;
  }

  function updateFsView(options = {}) {
    const { fade = false, playSfx = false } = options;
    if (!fsOverlay || fsOverlay.hidden || !state.fsOpen || !state.fsSlides.length) return;
    const slide = state.fsSlides[state.fsIndex];
    if (!slide) return;
    if (playSfx) playSlideClick();

    const img = fsOverlay.querySelector("[data-dino-fs-img]");
    if (!img) return;

    const applySlide = () => {
      if (!state.fsOpen || state.fsSlides[state.fsIndex] !== slide) return;
      img.src = slide.imageUrl;
      img.alt = slide.title;
      img.classList.remove("is-fading-out");
      img.classList.add("is-fading-in");
      requestAnimationFrame(() => img.classList.remove("is-fading-in"));
      syncFsCaption();
      speakFsSlide(slide);
      const dinoIndex = slide.index;
      if (Number.isFinite(dinoIndex) && dinoIndex >= 0 && dinoIndex < state.allDinosaurs.length) {
        state.selectedIndex = dinoIndex;
        if (pageRoot) updateGalleryView({ fade: false });
      }
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
        });
      return;
    }

    preloadImage(slide.imageUrl).then(applySlide).catch(() => syncFsCaption());
  }

  function advanceFsSlide(delta, options = {}) {
    if (!state.fsOpen || state.fsSlides.length < 2) return;
    stopFsSlideshow();
    state.fsIndex = (state.fsIndex + delta + state.fsSlides.length) % state.fsSlides.length;
    updateFsView({ fade: true, playSfx: options.user !== false });
    startFsSlideshow();
  }

  function advanceFsSlideNext() {
    if (!state.fsOpen || state.fsSlides.length < 2) return;
    state.fsIndex = (state.fsIndex + 1) % state.fsSlides.length;
    updateFsView({ fade: true, playSfx: true });
  }

  function startFsSlideshow() {
    stopFsSlideshow();
    if (!state.fsOpen || state.fsSlides.length < 2 || !state.fsAutoMs) return;
    state.fsTimer = setInterval(() => {
      advanceFsSlideNext();
    }, state.fsAutoMs);
  }

  async function openDinoFullscreen() {
    if (state.loading || state.fsPreparing || !canOpenFullscreen()) return;
    ensureDinoFullscreenOverlay();
    bindDinoFullscreenEvents();
    state.fsPreparing = true;
    syncFullscreenButton();
    stopSlideshow();

    const slides = buildFsSlides();
    if (!slides.length) {
      state.fsPreparing = false;
      return;
    }

    state.fsSlides = slides;
    const currentSlide = slides.findIndex((slide) => slide.index === state.selectedIndex);
    state.fsIndex = currentSlide >= 0 ? currentSlide : 0;
    state.fsOpen = true;
    fsOverlay.hidden = false;
    document.body.classList.add("dino-fs-open");
    syncFsBgmButton();
    syncFsAutoButtons();
    syncFsNarrationButton();
    syncBgmPlayback();
    void enterDinoFsImmersive();

    updateFsView({ fade: false });
    startFsSlideshow();
    state.fsPreparing = false;
  }

  function closeDinoFullscreen() {
    if (!state.fsOpen && !state.fsPreparing) return;
    state.fsOpen = false;
    state.fsPreparing = false;
    stopFsSlideshow();
    stopFsNarration();
    void exitDinoFsImmersive();
    if (fsOverlay) fsOverlay.hidden = true;
    document.body.classList.remove("dino-fs-open");
    state.fsSlides = [];
    state.fsIndex = 0;
    syncFullscreenButton();
    startSlideshow();
  }

  function bindGalleryEvents() {
    if (!pageRoot) return;

    pageRoot.querySelector("#dino-bgm-btn")?.addEventListener("click", toggleBgm);
    pageRoot.querySelector("#dino-fullscreen")?.addEventListener("click", () => void openDinoFullscreen());
    pageRoot.querySelector("#dino-thumb-prev")?.addEventListener("click", () => scrollThumbBy(-140));
    pageRoot.querySelector("#dino-thumb-next")?.addEventListener("click", () => scrollThumbBy(140));

    pageRoot.querySelectorAll("[data-dino-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.dinoThumb);
        focusDino(idx, { restartSlideshow: true, scrollToGallery: false });
      });
    });

    pageRoot.querySelectorAll("[data-dino-select]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.dinoSelect);
        focusDino(idx, { restartSlideshow: true, scrollToGallery: true });
      });
    });

    pageRoot.querySelectorAll("[data-dino-highlight]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = findDinoIndexByName(btn.dataset.dinoHighlight);
        if (idx < 0) return;
        focusDino(idx, { restartSlideshow: true, scrollToGallery: true });
      });
    });
  }

  function paint() {
    if (!pageRoot) return;
    pageRoot.innerHTML = renderPageHtml();
    bindGalleryEvents();
    bindBgmUnlock();
    syncBgmButton();
    syncFullscreenButton();
    if (state.bgmEnabled) syncBgmPlayback();
    startThumbAutoScroll();
    if (!state.fsOpen) startSlideshow();
  }

  function loadAllEras() {
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = null;

    state.loading = false;
    state.error = "";
    state.selectedIndex = 0;
    state.variantIndex = 0;
    stopSlideshow();
    stopThumbScroll();
    stopImagePrefetch();

    const ok = applyStaticCatalog(window.DINO_STATIC);
    if (!ok) {
      state.error = "공룡 데이터를 불러오지 못했습니다.";
    }

    paint();
  }

  function renderPage(container) {
    if (!container) return;
    if (pageRoot && pageRoot !== container) {
      destroy();
    }
    pageRoot = container;
    loadAllEras();
  }

  function destroy() {
    closeDinoFullscreen();
    stopSlideshow();
    stopThumbScroll();
    stopLoadingDots();
    stopImagePrefetch();
    stopBgm();
    stopFsNarration();
    if (abortCtrl) {
      abortCtrl.abort();
      abortCtrl = null;
    }
    if (fsOverlay) {
      fsOverlay.remove();
      fsOverlay = null;
    }
    if (pageRoot) {
      pageRoot.innerHTML = "";
    }
    pageRoot = null;
    bgmUnlockBound = false;
    if (bgmAudio) {
      bgmAudio.src = "";
      bgmAudio = null;
    }
    bgmSourceUrl = "";
    state.allDinosaurs = [];
    state.eraIntros = [];
    state.erasData = {
      triassic: { dinosaurs: [], eraLabel: "", periodKo: "" },
      jurassic: { dinosaurs: [], eraLabel: "", periodKo: "" },
      cretaceous: { dinosaurs: [], eraLabel: "", periodKo: "" }
    };
    state.loading = false;
    state.error = "";
    state.selectedIndex = 0;
    state.thumbFlowOffset = 0;
    state.bgmEnabled = true;
    state.fsSlides = [];
    state.fsIndex = 0;
    state.fsAutoMs = 5000;
    state.fsNarrationEnabled = false;
    state.variantIndex = 0;
    imageReady.clear();
    state.imageSync = { active: false, total: 0, done: 0, failed: 0, dotCount: 1 };
  }

  window.Dino = {
    renderPage,
    leavePage: destroy,
    destroy
  };
})();
