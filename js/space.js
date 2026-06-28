(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;

  const TABS = [
    { id: "apod", label: "우주 사진", hint: "NASA APOD · Astronomy Picture of the Day" },
    { id: "planets", label: "태양계", hint: "NASA Image Library · 행성" }
  ];

  const state = {
    tab: "apod",
    loading: false,
    error: "",
    payload: null,
    selectedPlanet: "earth",
    cache: {}
  };

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function truncate(text, max) {
    const s = String(text || "").trim();
    if (s.length <= max) return s;
    return s.slice(0, max).trim() + "…";
  }

  async function fetchJson(path, options = {}) {
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    const res = await fetch(`${apiBase()}${path}`, {
      signal: abortCtrl.signal,
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

  function renderApodCard(item, index) {
    const img = item.thumbnail || item.hdurl || item.url;
    const isVideo = item.media_type === "video";
    return `
      <article class="space-card space-card-apod">
        <p class="space-card-index">${index + 1}</p>
        ${isVideo
          ? `<div class="space-media space-media-video"><p class="space-video-label">🎬 동영상 APOD</p><a class="space-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">NASA에서 보기</a></div>`
          : `<a class="space-img-link" href="${escapeHtml(item.hdurl || item.url || img)}" target="_blank" rel="noopener noreferrer"><img class="space-img" src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"></a>`}
        <h3 class="space-card-title">${escapeHtml(item.title)}</h3>
        <p class="space-card-meta">${escapeHtml(item.date || "")}${item.copyright ? ` · © ${escapeHtml(item.copyright)}` : ""}</p>
        <p class="space-card-text">${escapeHtml(truncate(item.explanation, 320))}</p>
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
          ? `<img class="space-planet-thumb" src="${escapeHtml(hero.thumbnail)}" alt="" loading="lazy" decoding="async">`
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
            (item) => `
          <article class="space-card space-card-planet">
            <a class="space-img-link" href="${escapeHtml(item.thumbnail)}" target="_blank" rel="noopener noreferrer">
              <img class="space-img" src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">
            </a>
            <h3 class="space-card-title">${escapeHtml(truncate(item.title, 80))}</h3>
            <p class="space-card-text">${escapeHtml(truncate(item.description, 200))}</p>
          </article>`
          )
          .join("")}
      </div>`;
  }

  function renderBody() {
    if (state.loading) {
      return `<p class="space-status space-status-loading" role="status">NASA에서 불러오는 중…</p>`;
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
      return `<div class="space-apod-grid">${items.map((item, i) => renderApodCard(item, i)).join("")}</div>`;
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
          <h2>Space</h2>
          <p class="space-intro">NASA APOD와 Image Library에서 우주·태양계 사진을 불러옵니다.</p>
        </header>
        ${renderTabNav()}
        <div class="space-toolbar">
          <button type="button" class="space-btn space-btn-primary" id="space-refresh">다시 불러오기</button>
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
        </p>
      </article>`;
    bindEvents();
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
  }

  async function loadApod(forceRefresh) {
    const key = "apod";
    if (!forceRefresh && state.cache[key]) {
      state.payload = state.cache[key];
      state.loading = false;
      state.error = "";
      updateBodyOnly();
      return;
    }
    state.loading = true;
    state.error = "";
    updateBodyOnly();
    try {
      const data = await fetchJson("/api/space/apod?count=6");
      state.cache[key] = { items: data.items || [] };
      state.payload = state.cache[key];
    } catch (err) {
      if (err.name === "AbortError") return;
      state.error = err.message || "우주 사진을 불러오지 못했습니다.";
    } finally {
      state.loading = false;
      updateBodyOnly();
    }
  }

  async function loadPlanetDetail(planetId, forceRefresh) {
    const detailKey = `planet:${planetId}`;
    if (!forceRefresh && state.cache[detailKey]) {
      return state.cache[detailKey];
    }
    const data = await fetchJson(`/api/space/planet/${encodeURIComponent(planetId)}?limit=8`);
    state.cache[detailKey] = data;
    return data;
  }

  async function loadPlanets(forceRefresh) {
    const key = "planets";
    state.loading = true;
    state.error = "";
    updateBodyOnly();
    try {
      let overview = state.cache.planets_overview;
      if (!overview || forceRefresh) {
        overview = await fetchJson("/api/space/planets/overview?per_planet=1");
        state.cache.planets_overview = overview;
      }
      const detail = await loadPlanetDetail(state.selectedPlanet, forceRefresh);
      state.cache[key] = { overview, detail };
      state.payload = state.cache[key];
    } catch (err) {
      if (err.name === "AbortError") return;
      state.error = err.message || "행성 사진을 불러오지 못했습니다.";
    } finally {
      state.loading = false;
      updateBodyOnly();
    }
  }

  async function loadTab(tabId, forceRefresh) {
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
        state.selectedPlanet = id;
        state.loading = true;
        updateBodyOnly();
        void loadPlanetDetail(id, false)
          .then((detail) => {
            if (state.payload) state.payload.detail = detail;
            state.loading = false;
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
      if (state.tab === "apod") delete state.cache.apod;
      if (state.tab === "planets") {
        delete state.cache.planets_overview;
        delete state.cache[`planet:${state.selectedPlanet}`];
        delete state.cache.planets;
      }
      void loadTab(state.tab, true);
    });
  }

  function renderPage(container) {
    pageRoot = container;
    state.tab = "apod";
    state.loading = false;
    state.error = "";
    state.payload = null;
    state.selectedPlanet = "earth";
    state.cache = {};
    renderPageShell();
    void loadTab("apod", false);
  }

  function destroy() {
    abortCtrl?.abort();
    abortCtrl = null;
    if (pageRoot) delete pageRoot.dataset.spaceBound;
    pageRoot = null;
  }

  window.Space = {
    renderPage,
    destroy,
    leavePage: destroy
  };
})();
