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
  const DINO_BGM_VOLUME = 0.42;
  const FS_AUTO_OPTIONS = [5000, 10000, 0];

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
    imageSync: { active: false, total: 0, done: 0, failed: 0, dotCount: 1 }
  };

  let thumbScrollLastTime = 0;
  let mainImageLoadSeq = 0;
  const imageReady = new Set();
  let imagePrefetchAbort = null;
  let imageSyncTimer = null;
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
    audio.volume = DINO_BGM_VOLUME;
    resetBgmSourceIfNeeded(dinoBgmUrl());
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
      state.selectedIndex = (state.selectedIndex + 1) % state.allDinosaurs.length;
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

  function dinoImageUrl(dino, kind) {
    if (!dino) return "";
    if (kind === "thumb") return mediaUrl(dino.thumb_url || dino.image_url);
    return mediaUrl(dino.image_url || dino.thumb_url);
  }

  function dinoNeedsApiWarm(dino) {
    const url = String(dino?.image_url || "");
    return url.includes("/api/dino/image/") && !url.includes("/api/dino/image-file/");
  }

  function eraIntroNeedsApiWarm(intro) {
    const url = String(intro?.intro_image_url || "");
    return url.includes("/api/dino/image/") && !url.includes("/api/dino/image-file/");
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
    if (url && (imageReady.has(dinoId) || !dinoNeedsApiWarm({ image_url: url }))) {
      const loadAttr = eager ? ' loading="eager"' : ' loading="lazy"';
      return `<img class="${className}" data-dino-img-id="${dinoId}"${idAttr} src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${loadAttr} decoding="async" referrerpolicy="no-referrer">`;
    }
    const phClass = className ? `${className} dino-img-placeholder` : "dino-img-placeholder";
    return `<span class="${phClass}" data-dino-img-placeholder="${dinoId}" aria-hidden="true">🦕</span><img class="${className}" data-dino-img-id="${dinoId}"${idAttr} alt="${escapeHtml(alt)}" hidden decoding="async" referrerpolicy="no-referrer">`;
  }

  async function prefetchDinoImages() {
    stopImagePrefetch();
    imageReady.clear();

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
            ${intro.highlight_dino ? `<p class="dino-era-section-highlight">대표 종: ${escapeHtml(intro.highlight_dino)}</p>` : ""}
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
          · 이미지: <a href="https://pixabay.com/" target="_blank" rel="noopener noreferrer">Pixabay</a>
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
      if (!img) {
        canvas.innerHTML = `<img class="dino-main-img" id="dino-main-img" alt="${escapeHtml(dino.name)}" referrerpolicy="no-referrer">`;
        img = pageRoot.querySelector("#dino-main-img");
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
    if (!Number.isFinite(index) || index < 0 || index >= state.allDinosaurs.length) return;
    state.selectedIndex = index;
    updateGalleryView({ fade: options.fade !== false });
    if (options.restartSlideshow) {
      stopSlideshow();
      startSlideshow();
    }
  }

  function stopFsSlideshow() {
    if (state.fsTimer) {
      clearInterval(state.fsTimer);
      state.fsTimer = null;
    }
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
      if (document.visibilityState === "hidden") stopFsSlideshow();
      else startFsSlideshow();
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
        selectDino(idx, { restartSlideshow: true });
      });
    });

    pageRoot.querySelectorAll("[data-dino-select]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.dinoSelect);
        selectDino(idx, { restartSlideshow: true });
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

  async function loadEraIntros(signal) {
    try {
      const data = await fetchJson("/api/dino/eras", signal);
      state.eraIntros = data.eras || [];
    } catch (_) {
      state.eraIntros = ERAS.map((e) => ({ ...e }));
    }
  }

  async function loadAllEras() {
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    const signal = abortCtrl.signal;

    state.loading = true;
    state.error = "";
    state.selectedIndex = 0;
    stopSlideshow();
    stopThumbScroll();
    paint();
    startLoadingDots("공룡 불러오는 중");
    try {
      await loadEraIntros(signal);
      const results = await Promise.all(
        ERAS.map((era) => fetchJson(`/api/dino/dinosaurs?era=${encodeURIComponent(era.id)}`, signal))
      );
      ERAS.forEach((era, index) => {
        const data = results[index] || {};
        state.erasData[era.id] = {
          dinosaurs: data.dinosaurs || [],
          eraLabel: data.era_label || era.label,
          periodKo: data.period_ko || era.hint
        };
      });
      rebuildAllDinosaurs();
      if (!state.allDinosaurs.length) {
        state.error = "대표 공룡을 불러오지 못했습니다.";
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      state.error = err.message || "공룡 목록을 불러오지 못했습니다.";
      state.allDinosaurs = [];
    } finally {
      if (signal.aborted) return;
      state.loading = false;
      stopLoadingDots();
      paint();
      void prefetchDinoImages();
    }
  }

  function renderPage(container) {
    if (!container) return;
    if (pageRoot && pageRoot !== container) {
      destroy();
    }
    pageRoot = container;
    pageRoot.innerHTML = `<p class="dino-status dino-status-loading">준비 중…</p>`;
    void loadAllEras();
  }

  function destroy() {
    closeDinoFullscreen();
    stopSlideshow();
    stopThumbScroll();
    stopLoadingDots();
    stopImagePrefetch();
    stopBgm();
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
    imageReady.clear();
    state.imageSync = { active: false, total: 0, done: 0, failed: 0, dotCount: 1 };
  }

  window.Dino = {
    renderPage,
    leavePage: destroy,
    destroy
  };
})();
