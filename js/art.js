(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;

  const state = {
    genres: [],
    genre: "history",
    works: [],
    worksTitle: "",
    worksSubtitle: "",
    eras: [],
    loading: false,
    worksLoading: false,
    error: "",
    artistMode: false,
    selectedArtist: null,
    selectedWorkIndex: 0,
    slideshowInterval: 5000,
    slideshowTimer: null,
    thumbScrollTimer: null
  };

  const FADE_MS = 520;
  const THUMB_SCROLL_MS = 2800;

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

  async function fetchJson(path) {
    const res = await fetch(`${apiBase()}${path}`, {
      signal: abortCtrl?.signal,
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function loadGenres() {
    const data = await fetchJson("/api/art/genres");
    state.genres = data.genres || [];
    if (!state.genres.some((g) => g.id === state.genre) && state.genres[0]) {
      state.genre = state.genres[0].id;
    }
  }

  async function loadEras() {
    const data = await fetchJson("/api/art/eras");
    state.eras = data.eras || [];
  }

  async function loadGenreWorks(genreId) {
    state.worksLoading = true;
    state.artistMode = false;
    state.selectedArtist = null;
    state.selectedWorkIndex = 0;
    const meta = genreMeta(genreId);
    state.worksTitle = meta?.hint || "";
    state.worksSubtitle = "";
    renderWorksSection();
    try {
      const data = await fetchJson(`/api/art/works?genre=${encodeURIComponent(genreId)}`);
      state.works = data.works || [];
      state.genre = genreId;
      state.selectedWorkIndex = 0;
    } catch (err) {
      state.error = err.message || "작품을 불러오지 못했습니다.";
      state.works = [];
    } finally {
      state.worksLoading = false;
      renderWorksSection();
    }
  }

  async function loadArtistWorks(name) {
    state.worksLoading = true;
    state.artistMode = true;
    state.selectedArtist = name;
    state.selectedWorkIndex = 0;
    state.worksTitle = `${name} · 작품`;
    state.worksSubtitle = "";
    renderWorksSection();
    try {
      const data = await fetchJson(`/api/art/artist-works?name=${encodeURIComponent(name)}`);
      state.works = data.works || [];
      state.selectedWorkIndex = 0;
      if (data.artist?.name) {
        state.selectedArtist = data.artist.name;
        state.worksTitle = `${data.artist.name} · 작품`;
      }
      const worksEl = pageRoot?.querySelector("#art-works-section");
      worksEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      state.error = err.message || "화가 작품을 불러오지 못했습니다.";
      state.works = [];
    } finally {
      state.worksLoading = false;
      renderWorksSection();
    }
  }

  function renderGenreNav() {
    return `
      <nav class="art-genre-nav" aria-label="미술 5대 장르">
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
    const thumbSrc = workImageUrl(work, "thumb") || workImageUrl(work, "preview") || workImageUrl(work, "full");
    const active = index === state.selectedWorkIndex ? " is-active" : "";
    return `
      <button type="button" class="art-thumb-item${active}" data-art-thumb="${index}" aria-label="${escapeHtml(work.title)}" aria-current="${index === state.selectedWorkIndex ? "true" : "false"}">
        <img src="${escapeHtml(thumbSrc)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
      </button>
    `;
  }

  function renderIntervalPicker() {
    const options = [3000, 5000, 10000];
    return `
      <div class="art-interval-picker" role="group" aria-label="슬라이드 간격">
        ${options
          .map(
            (ms) =>
              `<button type="button" class="art-interval-btn${state.slideshowInterval === ms ? " is-active" : ""}" data-art-interval="${ms}">${ms / 1000}초</button>`
          )
          .join("")}
      </div>
    `;
  }

  function stopSlideshow() {
    if (state.slideshowTimer) {
      clearInterval(state.slideshowTimer);
      state.slideshowTimer = null;
    }
  }

  function stopThumbAutoScroll() {
    if (state.thumbScrollTimer) {
      clearInterval(state.thumbScrollTimer);
      state.thumbScrollTimer = null;
    }
  }

  function stopGalleryMotion() {
    stopSlideshow();
    stopThumbAutoScroll();
  }

  function startSlideshow() {
    stopSlideshow();
    if (!pageRoot || state.works.length < 2) return;
    state.slideshowTimer = setInterval(() => {
      const next = (state.selectedWorkIndex + 1) % state.works.length;
      state.selectedWorkIndex = next;
      updateGalleryView({ fade: true });
    }, state.slideshowInterval);
  }

  function startThumbAutoScroll() {
    stopThumbAutoScroll();
    if (!pageRoot || state.works.length < 2) return;
    state.thumbScrollTimer = setInterval(() => {
      const track = pageRoot.querySelector("#art-thumb-track");
      if (!track) return;
      const item = track.querySelector(".art-thumb-item");
      const gap = 8;
      const step = item ? item.offsetWidth + gap : 72;
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 0) return;
      if (track.scrollLeft >= maxScroll - 2) {
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        track.scrollBy({ left: step, behavior: "smooth" });
      }
    }, THUMB_SCROLL_MS);
  }

  function restartGalleryMotion() {
    stopGalleryMotion();
    startSlideshow();
    startThumbAutoScroll();
  }

  function renderGalleryBody() {
    if (state.worksLoading) {
      return `<p class="art-status art-status-loading" role="status">작품을 불러오는 중…</p>`;
    }
    if (!state.works.length) {
      return `<p class="art-status art-status-info">표시할 작품이 없습니다.</p>`;
    }

    const work = state.works[state.selectedWorkIndex] || state.works[0];
    const mainSrc = workImageUrl(work, "full") || workImageUrl(work, "thumb");

    return `
      <div class="art-gallery" id="art-gallery">
        <div class="art-gallery-controls">
          <div class="art-thumb-carousel" aria-label="작품 썸네일">
            <button type="button" class="art-thumb-scroll-btn" id="art-thumb-prev" aria-label="이전 작품">‹</button>
            <div class="art-thumb-viewport">
              <div class="art-thumb-track" id="art-thumb-track">
                ${state.works.map(renderThumbItem).join("")}
              </div>
            </div>
            <button type="button" class="art-thumb-scroll-btn" id="art-thumb-next" aria-label="다음 작품">›</button>
          </div>
          ${renderIntervalPicker()}
        </div>
        <div class="art-main-canvas" id="art-main-canvas">
          ${
            mainSrc
              ? `<img class="art-main-img" id="art-main-img" src="${escapeHtml(mainSrc)}" alt="${escapeHtml(work.title)}" referrerpolicy="no-referrer" decoding="async">`
              : `<div class="art-main-placeholder" aria-hidden="true">🖼</div>`
          }
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

    const img = pageRoot.querySelector("#art-main-img");
    const mainSrc = workImageUrl(work, "full") || workImageUrl(work, "thumb");

    const syncMetaAndThumbs = () => {
      const meta = pageRoot.querySelector("#art-main-meta");
      if (meta) meta.innerHTML = renderMainMeta(work);

      pageRoot.querySelectorAll("[data-art-thumb]").forEach((btn) => {
        const idx = Number(btn.dataset.artThumb);
        const active = idx === state.selectedWorkIndex;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-current", active ? "true" : "false");
      });

      const activeThumb = pageRoot.querySelector(`[data-art-thumb="${state.selectedWorkIndex}"]`);
      activeThumb?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    };

    if (img && mainSrc) {
      const applyImage = () => {
        if (!img.isConnected || state.works[state.selectedWorkIndex] !== work) return;
        img.src = mainSrc;
        img.alt = work.title;
        img.classList.remove("is-loading", "is-fading-out");
        img.classList.add("is-fading-in");
        requestAnimationFrame(() => img.classList.remove("is-fading-in"));
        syncMetaAndThumbs();
      };

      if (fade) {
        img.classList.add("is-fading-out");
        const loader = new Image();
        loader.referrerPolicy = "no-referrer";
        loader.onload = () => {
          if (!img.isConnected || state.works[state.selectedWorkIndex] !== work) return;
          setTimeout(applyImage, FADE_MS);
        };
        loader.onerror = () => {
          img.classList.remove("is-fading-out");
          syncMetaAndThumbs();
        };
        loader.src = mainSrc;
      } else {
        img.classList.add("is-loading");
        const loader = new Image();
        loader.referrerPolicy = "no-referrer";
        loader.onload = () => {
          if (!img.isConnected || state.works[state.selectedWorkIndex] !== work) return;
          img.src = mainSrc;
          img.alt = work.title;
          img.classList.remove("is-loading");
          syncMetaAndThumbs();
        };
        loader.onerror = () => {
          img.classList.remove("is-loading");
          syncMetaAndThumbs();
        };
        loader.src = mainSrc;
      }
    } else {
      syncMetaAndThumbs();
    }
  }

  function selectWork(index, options = {}) {
    const { fade = false, userAction = false } = options;
    if (index < 0 || index >= state.works.length) return;
    state.selectedWorkIndex = index;
    updateGalleryView({ fade });
    if (userAction) restartGalleryMotion();
  }

  function scrollThumbTrack(direction) {
    const track = pageRoot?.querySelector("#art-thumb-track");
    if (!track) return;
    const item = track.querySelector(".art-thumb-item");
    const gap = 8;
    const step = item ? item.offsetWidth + gap : track.clientWidth / 7;
    track.scrollBy({ left: direction * step * 2, behavior: "smooth" });
  }

  function bindGalleryEvents() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-art-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.artThumb);
        if (!Number.isNaN(index)) selectWork(index, { userAction: true });
      });
    });
    pageRoot.querySelector("#art-thumb-prev")?.addEventListener("click", () => {
      scrollThumbTrack(-1);
      restartGalleryMotion();
    });
    pageRoot.querySelector("#art-thumb-next")?.addEventListener("click", () => {
      scrollThumbTrack(1);
      restartGalleryMotion();
    });
    pageRoot.querySelectorAll("[data-art-interval]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ms = Number(btn.dataset.artInterval);
        if (!ms || state.slideshowInterval === ms) return;
        state.slideshowInterval = ms;
        pageRoot.querySelectorAll("[data-art-interval]").forEach((el) => {
          el.classList.toggle("is-active", Number(el.dataset.artInterval) === ms);
        });
        restartGalleryMotion();
      });
    });

    const track = pageRoot.querySelector("#art-thumb-track");
    if (track && !track.dataset.wheelBound) {
      track.dataset.wheelBound = "1";
      track.addEventListener(
        "wheel",
        (e) => {
          if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          e.preventDefault();
          track.scrollBy({ left: e.deltaY, behavior: "smooth" });
          restartGalleryMotion();
        },
        { passive: false }
      );
    }

    restartGalleryMotion();
  }

  function renderWorksSection() {
    const host = pageRoot?.querySelector("#art-works-host");
    if (!host) return;
    stopGalleryMotion();
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
  }

  function renderArtistCard(artist) {
    const imgHtml = renderProgressiveImg(artist, { alt: artist.name, wantFull: true });
    return `
      <article class="art-artist-card">
        <div class="art-artist-portrait">
          ${imgHtml || `<div class="art-artist-placeholder" aria-hidden="true">👤</div>`}
        </div>
        <div class="art-artist-body">
          <div class="art-artist-head">
            <h4 class="art-artist-name">${escapeHtml(artist.name)}</h4>
            <button type="button" class="art-btn art-btn-primary art-artist-view" data-art-artist="${escapeHtml(artist.name)}">작품감상</button>
          </div>
          ${artist.life ? `<p class="art-artist-life">${escapeHtml(artist.life)}</p>` : ""}
          <p class="art-artist-desc">${formatDescription(artist.description)}</p>
        </div>
      </article>
    `;
  }

  function renderErasSection() {
    if (!state.eras.length) {
      return `<p class="art-status art-status-loading" role="status">화가 목록을 불러오는 중…</p>`;
    }
    return state.eras
      .map(
        (era) => `
        <section class="art-era-block" aria-labelledby="art-era-${escapeHtml(era.id)}">
          <header class="art-era-head">
            <h3 id="art-era-${escapeHtml(era.id)}">${escapeHtml(era.label)}</h3>
            <span class="art-era-period">${escapeHtml(era.period || "")}</span>
          </header>
          <div class="art-artists-grid">
            ${(era.artists || []).map(renderArtistCard).join("")}
          </div>
        </section>
      `
      )
      .join("");
  }

  function render() {
    if (!pageRoot) return;
    pageRoot.innerHTML = `
      <article class="content-panel art-panel">
        <header class="art-header">
          <h2>ART</h2>
        </header>
        ${state.error ? `<p class="art-status art-status-error" role="alert">${escapeHtml(state.error)}</p>` : ""}
        ${state.genres.length ? renderGenreNav() : `<p class="art-status art-status-loading">준비 중…</p>`}
        <div id="art-works-host"></div>
        <section class="art-eras-wrap" aria-label="시대별 주요 화가">
          <h3 class="art-eras-heading">시대별 주요 화가</h3>
          <div id="art-eras-host">${renderErasSection()}</div>
        </section>
        <p class="art-footnote">
          데이터·이미지: <a href="https://www.metmuseum.org/about-the-met/policies-and-documents/open-access" target="_blank" rel="noopener noreferrer">The Metropolitan Museum of Art</a>
          · <a href="https://metmuseum.github.io/" target="_blank" rel="noopener noreferrer">Collection API</a>
        </p>
      </article>
    `;
    renderWorksSection();
    bindEvents();
    bindProgressiveArtImages(pageRoot);
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
        if (!id || id === state.genre) return;
        pageRoot.querySelectorAll(".art-genre-btn").forEach((el) => {
          el.classList.toggle("is-active", el.dataset.artGenre === id);
        });
        void loadGenreWorks(id);
      });
    });
    pageRoot.querySelectorAll("[data-art-artist]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.artArtist;
        if (name) void loadArtistWorks(name);
      });
    });
  }

  async function renderPage(container) {
    pageRoot = container;
    abortCtrl = new AbortController();
    state.loading = true;
    state.error = "";
    state.genre = "history";
    state.artistMode = false;
    state.selectedArtist = null;
    state.selectedWorkIndex = 0;
    render();
    try {
      await Promise.all([loadGenres(), loadEras()]);
      render();
      await loadGenreWorks(state.genre);
    } catch (err) {
      if (err.name === "AbortError") return;
      state.error = err.message || "ART 페이지를 불러오지 못했습니다.";
      render();
    } finally {
      state.loading = false;
    }
  }

  function destroy() {
    abortCtrl?.abort();
    abortCtrl = null;
    stopGalleryMotion();
    disconnectArtImageObserver();
    pageRoot = null;
  }

  window.Art = { renderPage, destroy };
})();
