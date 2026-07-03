(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;
  let loadingTimer = null;
  let loadingDotCount = 1;

  const ERAS = [
    { id: "triassic", label: "삼엽기", label_en: "Triassic", hint: "약 2억 5200만~2억 100만 년 전" },
    { id: "jurassic", label: "쥬라기", label_en: "Jurassic", hint: "약 2억 100만~1억 4500만 년 전" },
    { id: "cretaceous", label: "백악기", label_en: "Cretaceous", hint: "약 1억 4500만~6600만 년 전" }
  ];

  const SLIDE_INTERVAL_MS = 5000;
  const FADE_MS = 520;
  const THUMB_SCROLL_PX_PER_SEC = 14;

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
    thumbFlowOffset: 0
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
    if (!pageRoot || state.allDinosaurs.length < 2) return;
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
    if (!src) return "";
    const active = index === state.selectedIndex ? " is-active" : "";
    return `
      <button type="button" class="dino-thumb-item${active}" data-dino-thumb="${index}" aria-label="${escapeHtml(dino.name)}" aria-current="${index === state.selectedIndex ? "true" : "false"}">
        <img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
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
            src
              ? `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
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
              ? `<div class="dino-era-section-hero"><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(era.label)} 대표 이미지" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`
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
            mainSrc
              ? `<img class="dino-main-img" id="dino-main-img" src="${escapeHtml(mainSrc)}" alt="${escapeHtml(dino.name)}" referrerpolicy="no-referrer" decoding="async" loading="eager">`
              : `<div class="dino-main-placeholder" aria-hidden="true">🦕</div>`
          }
        </div>
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

  function bindGalleryEvents() {
    if (!pageRoot) return;

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
    startThumbAutoScroll();
    startSlideshow();
  }

  async function loadEraIntros() {
    try {
      const data = await fetchJson("/api/dino/eras");
      state.eraIntros = data.eras || [];
    } catch (_) {
      state.eraIntros = ERAS.map((e) => ({ ...e }));
    }
  }

  async function loadAllEras() {
    state.loading = true;
    state.error = "";
    state.selectedIndex = 0;
    stopSlideshow();
    stopThumbScroll();
    paint();
    startLoadingDots("공룡 불러오는 중");
    try {
      await loadEraIntros();
      const results = await Promise.all(
        ERAS.map((era) => fetchJson(`/api/dino/dinosaurs?era=${encodeURIComponent(era.id)}`))
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
      state.error = err.message || "공룡 목록을 불러오지 못했습니다.";
      state.allDinosaurs = [];
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
    void loadAllEras();
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
      pageRoot.innerHTML = "";
    }
    pageRoot = null;
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
  }

  window.Dino = {
    renderPage,
    leavePage: destroy,
    destroy
  };
})();
