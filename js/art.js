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
    selectedArtist: null
  };

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
    const meta = genreMeta(genreId);
    state.worksTitle = meta ? `${meta.label} · 대표 작품` : "대표 작품";
    state.worksSubtitle = meta?.hint || "";
    renderWorksSection();
    try {
      const data = await fetchJson(`/api/art/works?genre=${encodeURIComponent(genreId)}`);
      state.works = data.works || [];
      state.genre = genreId;
    } catch (err) {
      state.error = err.message || "작품을 불러오지 못했습니다.";
      state.works = [];
    } finally {
      state.worksLoading = false;
      renderWorksSection();
      bindWorksEvents();
    }
  }

  async function loadArtistWorks(name) {
    state.worksLoading = true;
    state.artistMode = true;
    state.selectedArtist = name;
    state.worksTitle = `${name} · 작품 감상`;
    state.worksSubtitle = "The Met Open Access 소장 작품";
    renderWorksSection();
    try {
      const data = await fetchJson(`/api/art/artist-works?name=${encodeURIComponent(name)}`);
      state.works = data.works || [];
      if (data.artist?.name) {
        state.selectedArtist = data.artist.name;
        state.worksTitle = `${data.artist.name} · 작품 감상`;
        if (data.artist.description) {
          state.worksSubtitle = data.artist.description.slice(0, 160) + (data.artist.description.length > 160 ? "…" : "");
        }
      }
      const worksEl = pageRoot?.querySelector("#art-works-section");
      worksEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      state.error = err.message || "화가 작품을 불러오지 못했습니다.";
      state.works = [];
    } finally {
      state.worksLoading = false;
      renderWorksSection();
      bindWorksEvents();
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

  function renderWorkCard(work) {
    const imgHtml = renderProgressiveImg(work, { alt: work.title, wantFull: true });
    return `
      <article class="art-work-card">
        <div class="art-work-media">
          ${imgHtml || `<div class="art-work-placeholder" aria-hidden="true">🖼</div>`}
        </div>
        <div class="art-work-body">
          <h4 class="art-work-title">${escapeHtml(work.title)}</h4>
          <p class="art-work-meta"><span class="art-work-artist">${escapeHtml(work.artist)}</span>${work.date ? ` · <span class="art-work-date">${escapeHtml(work.date)}</span>` : ""}</p>
          <p class="art-work-desc">${formatDescription(work.description)}</p>
        </div>
      </article>
    `;
  }

  function renderWorksSection() {
    const host = pageRoot?.querySelector("#art-works-host");
    if (!host) return;
    host.innerHTML = `
      <section class="art-works-section" id="art-works-section">
        <header class="art-works-head">
          <div>
            <h3 class="art-works-title">${escapeHtml(state.worksTitle)}</h3>
            ${state.worksSubtitle ? `<p class="art-works-sub">${escapeHtml(state.worksSubtitle)}</p>` : ""}
          </div>
          ${
            state.artistMode
              ? `<button type="button" class="art-btn art-btn-ghost" id="art-back-genre">장르 작품으로</button>`
              : ""
          }
        </header>
        ${
          state.worksLoading
            ? `<p class="art-status art-status-loading" role="status">작품을 불러오는 중…</p>`
            : state.works.length
              ? `<div class="art-works-grid">${state.works.map(renderWorkCard).join("")}</div>`
              : `<p class="art-status art-status-info">표시할 작품이 없습니다.</p>`
        }
      </section>
    `;
    bindWorksEvents();
    bindProgressiveArtImages(pageRoot);
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
          <p class="art-intro">뉴욕 메트로폴리탄 미술관(The Met) Open Access 컬렉션 · 5대 장르와 시대별 화가 30인</p>
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
    disconnectArtImageObserver();
    pageRoot = null;
  }

  window.Art = { renderPage, destroy };
})();
