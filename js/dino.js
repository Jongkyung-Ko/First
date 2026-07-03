(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;
  let loadingTimer = null;
  let loadingDotCount = 1;

  const ERAS = [
    { id: "cretaceous", label: "백악기", label_en: "Cretaceous", hint: "약 1억 4500만~6600만 년 전" },
    { id: "jurassic", label: "쥬라기", label_en: "Jurassic", hint: "약 2억 100만~1억 4500만 년 전" }
  ];

  const SLIDE_INTERVAL_MS = 5000;
  const FADE_MS = 520;
  const THUMB_SCROLL_PX_PER_SEC = 14;
  const IMG_PLACEHOLDER =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  const state = {
    era: "cretaceous",
    dinosaurs: [],
    eraLabel: "",
    periodKo: "",
    loading: false,
    error: "",
    selectedIndex: 0,
    slideshowTimer: null,
    thumbScrollRaf: null,
    thumbFlowOffset: 0,
    mainImageLoading: false
  };

  let thumbScrollLastTime = 0;
  let mainImageLoadSeq = 0;

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
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

  async function fetchJson(path) {
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    const res = await fetch(`${apiBase()}${path}`, {
      signal: abortCtrl.signal,
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
    if (!pageRoot || state.dinosaurs.length < 2) return;
    state.slideshowTimer = setInterval(() => {
      state.selectedIndex = (state.selectedIndex + 1) % state.dinosaurs.length;
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

  function renderEraNav() {
    return `
      <nav class="dino-era-nav" aria-label="공룡 시대">
        ${ERAS.map(
          (era) =>
            `<button type="button" class="dino-era-btn${era.id === state.era ? " is-active" : ""}" data-dino-era="${escapeHtml(era.id)}" title="${escapeHtml(era.hint)}">
              <span class="dino-era-label">${escapeHtml(era.label)}</span>
              <span class="dino-era-en">${escapeHtml(era.label_en)}</span>
            </button>`
        ).join("")}
      </nav>`;
  }

  function renderMainMeta(dino) {
    if (!dino) return "";
    const stats = [
      dino.length ? `길이 ${dino.length}` : "",
      dino.height ? `높이 ${dino.height}` : "",
      dino.weight ? `체중 ${dino.weight}` : "",
      dino.diet ? `식성 ${dino.diet}` : "",
      dino.period_ko || state.periodKo ? `시대 ${dino.period_ko || state.periodKo}` : ""
    ]
      .filter(Boolean)
      .join(" · ");
    return `
      <h3 class="dino-main-title">${escapeHtml(dino.name)}</h3>
      <p class="dino-main-subtitle">${escapeHtml(dino.name_en || "")}</p>
      <p class="dino-main-stats">${escapeHtml(stats)}</p>
      <p class="dino-main-desc">${escapeHtml(dino.description || "")}</p>`;
  }

  function renderThumbItem(dino, index) {
    const src = dinoImageUrl(dino, "thumb");
    if (!src) return "";
    const active = index === state.selectedIndex ? " is-active" : "";
    return `
      <button type="button" class="dino-thumb-item${active}" data-dino-thumb="${index}" aria-label="${escapeHtml(dino.name)}" aria-current="${index === state.selectedIndex ? "true" : "false"}">
        <img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
      </button>`;
  }

  function renderGallery() {
    if (state.loading && !state.dinosaurs.length) {
      return `<p class="dino-status dino-status-loading" role="status">공룡 불러오는 중</p>`;
    }
    if (state.error && !state.dinosaurs.length) {
      return `<p class="dino-status dino-status-error" role="alert">${escapeHtml(state.error)}</p>`;
    }
    if (!state.dinosaurs.length) {
      return `<p class="dino-status dino-status-info">표시할 공룡이 없습니다.</p>`;
    }

    const dino = state.dinosaurs[state.selectedIndex] || state.dinosaurs[0];
    const mainSrc = dinoImageUrl(dino, "full");
    const thumbsHtml = state.dinosaurs.map(renderThumbItem).filter(Boolean).join("");

    return `
      <div class="dino-gallery" id="dino-gallery">
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
          <p class="dino-slideshow-hint">5초마다 자동 전환 · 썸네일을 눌러 선택</p>
        </div>
        <div class="dino-main-canvas" id="dino-main-canvas">
          ${
            mainSrc
              ? `<img class="dino-main-img" id="dino-main-img" src="${escapeHtml(mainSrc)}" alt="${escapeHtml(dino.name)}" referrerpolicy="no-referrer" decoding="async" loading="eager">`
              : `<div class="dino-main-placeholder" aria-hidden="true">🦕</div>`
          }
        </div>
        <div class="dino-main-meta" id="dino-main-meta">
          ${renderMainMeta(dino)}
        </div>
      </div>`;
  }

  function renderPageHtml() {
    const eraMeta = ERAS.find((e) => e.id === state.era);
    return `
      <div class="dino-panel">
        <header class="dino-header">
          <h2>🦖 Dino</h2>
          <p class="dino-tagline">${escapeHtml(eraMeta?.hint || "공룡 시대별 탐험")}</p>
        </header>
        ${renderEraNav()}
        <section class="dino-works-section">
          <p class="dino-works-line">${escapeHtml(state.eraLabel || eraMeta?.label || "")} · ${escapeHtml(state.periodKo || eraMeta?.hint || "")} · ${state.dinosaurs.length || 20}종</p>
          ${renderGallery()}
        </section>
        <p class="dino-footnote">
          데이터: <a href="https://dinosaur-facts-api.shorthair.fr/dinosaurs" target="_blank" rel="noopener noreferrer">Dinosaur Facts API</a>
          · 이미지: <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
        </p>
      </div>`;
  }

  function updateGalleryView(options = {}) {
    const { fade = false } = options;
    if (!pageRoot || !state.dinosaurs.length) return;
    const dino = state.dinosaurs[state.selectedIndex];
    if (!dino) return;

    const loadSeq = ++mainImageLoadSeq;
    const canvas = pageRoot.querySelector("#dino-main-canvas");
    let img = pageRoot.querySelector("#dino-main-img");
    const mainSrc = dinoImageUrl(dino, "full");

    const syncMetaAndThumbs = () => {
      const meta = pageRoot.querySelector("#dino-main-meta");
      if (meta) meta.innerHTML = renderMainMeta(dino);
      pageRoot.querySelectorAll("[data-dino-thumb]").forEach((btn) => {
        const idx = Number(btn.dataset.dinoThumb);
        const active = idx === state.selectedIndex;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-current", active ? "true" : "false");
      });
    };

    if (!mainSrc) {
      syncMetaAndThumbs();
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
      syncMetaAndThumbs();
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

  function bindGalleryEvents() {
    if (!pageRoot) return;

    pageRoot.querySelector("#dino-thumb-prev")?.addEventListener("click", () => scrollThumbBy(-140));
    pageRoot.querySelector("#dino-thumb-next")?.addEventListener("click", () => scrollThumbBy(140));

    pageRoot.querySelectorAll("[data-dino-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.dinoThumb);
        if (!Number.isFinite(idx)) return;
        state.selectedIndex = idx;
        updateGalleryView({ fade: true });
        stopSlideshow();
        startSlideshow();
      });
    });
  }

  function bindEvents() {
    if (!pageRoot || pageRoot.dataset.dinoBound) return;
    pageRoot.dataset.dinoBound = "1";

    pageRoot.addEventListener("click", (event) => {
      const eraBtn = event.target.closest("[data-dino-era]");
      if (!eraBtn) return;
      const era = eraBtn.dataset.dinoEra;
      if (!era || era === state.era) return;
      void loadEra(era);
    });
  }

  function paint() {
    if (!pageRoot) return;
    pageRoot.innerHTML = renderPageHtml();
    bindGalleryEvents();
    startThumbAutoScroll();
    startSlideshow();
  }

  async function loadEra(eraId) {
    state.era = eraId;
    state.loading = true;
    state.error = "";
    state.selectedIndex = 0;
    stopSlideshow();
    stopThumbScroll();
    paint();
    startLoadingDots("공룡 불러오는 중");
    try {
      const data = await fetchJson(`/api/dino/dinosaurs?era=${encodeURIComponent(eraId)}`);
      state.dinosaurs = data.dinosaurs || [];
      state.eraLabel = data.era_label || "";
      state.periodKo = data.period_ko || "";
      state.selectedIndex = 0;
      if (!state.dinosaurs.length) {
        state.error = "이 시대의 공룡을 불러오지 못했습니다.";
      }
    } catch (err) {
      state.error = err.message || "공룡 목록을 불러오지 못했습니다.";
      state.dinosaurs = [];
    } finally {
      state.loading = false;
      stopLoadingDots();
      paint();
    }
  }

  function renderPage(container) {
    if (!container) return;
    if (pageRoot && pageRoot !== container) {
      destroy();
    }
    pageRoot = container;
    pageRoot.innerHTML = `<p class="dino-status dino-status-loading">준비 중…</p>`;
    bindEvents();
    void loadEra(state.era);
  }

  function destroy() {
    stopSlideshow();
    stopThumbScroll();
    stopLoadingDots();
    if (abortCtrl) {
      abortCtrl.abort();
      abortCtrl = null;
    }
    if (pageRoot) {
      delete pageRoot.dataset.dinoBound;
      pageRoot.innerHTML = "";
    }
    pageRoot = null;
    state.dinosaurs = [];
    state.loading = false;
    state.error = "";
    state.selectedIndex = 0;
    state.thumbFlowOffset = 0;
  }

  window.Dino = {
    renderPage,
    leavePage: destroy,
    destroy
  };
})();
