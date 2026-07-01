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

  const state = {
    tab: "apod",
    loading: false,
    loadingMore: false,
    error: "",
    payload: null,
    selectedPlanet: "earth",
    apodHasMore: true,
    planetHasMore: true,
    cache: {}
  };

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
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

  function truncate(text, max) {
    const s = String(text || "").trim();
    if (s.length <= max) return s;
    return s.slice(0, max).trim() + "…";
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

  function renderApodMedia(item) {
    const img = mediaUrl(item.thumbnail || item.hdurl || item.url);
    const full = mediaUrl(item.hdurl || item.url || item.thumbnail);
    const isVideo = item.media_type === "video";
    if (!isVideo) {
      return `<a class="space-img-link" href="${escapeHtml(full)}" target="_blank" rel="noopener noreferrer"><img class="space-img" src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"></a>`;
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
        ${renderApodMedia(item)}
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
            (item) => `
          <article class="space-card space-card-planet">
            <a class="space-img-link" href="${escapeHtml(mediaUrl(item.thumbnail))}" target="_blank" rel="noopener noreferrer">
            <img class="space-img" src="${escapeHtml(mediaUrl(item.thumbnail))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">
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
    const hasMore = state.tab === "apod" ? state.apodHasMore : state.planetHasMore;
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
    syncLoadingAnimation();
  }

  function apodExcludeParam(items) {
    const dates = (items || []).map((item) => item.date).filter(Boolean);
    if (!dates.length) return "";
    return `&exclude=${encodeURIComponent(dates.join(","))}`;
  }

  async function loadApod(forceRefresh) {
    const key = "apod";
    if (!forceRefresh && state.cache[key]) {
      state.payload = state.cache[key];
      state.apodHasMore = state.payload.has_more !== false;
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
      state.cache[key] = { items: data.items || [], has_more: data.has_more !== false };
      state.payload = state.cache[key];
      state.apodHasMore = state.payload.has_more !== false;
    } catch (err) {
      if (err.name === "AbortError") return;
      state.error = err.message || "우주 사진을 불러오지 못했습니다.";
    } finally {
      state.loading = false;
      updateBodyOnly();
    }
  }

  async function loadMoreApod() {
    const items = state.payload?.items || [];
    const exclude = apodExcludeParam(items);
    const data = await fetchJson(`/api/space/apod?count=${LOAD_MORE_COUNT}${exclude}`, { abort: false });
    const fresh = data.items || [];
    if (!fresh.length) {
      state.apodHasMore = false;
      return;
    }
    const seen = new Set(items.map((item) => item.date));
    const merged = items.concat(fresh.filter((item) => item.date && !seen.has(item.date)));
    state.payload.items = merged;
    state.apodHasMore = fresh.length >= LOAD_MORE_COUNT && data.has_more !== false;
    state.cache.apod = state.payload;
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
      state.planetHasMore = detail.has_more !== false;
    } catch (err) {
      if (err.name === "AbortError") return;
      state.error = err.message || "행성 사진을 불러오지 못했습니다.";
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
        await loadMoreApod();
      } else if (state.tab === "planets") {
        await loadMorePlanet();
      }
    } catch (err) {
      state.error = err.message || "추가 이미지를 불러오지 못했습니다.";
    } finally {
      state.loadingMore = false;
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
        state.planetHasMore = true;
        updateBodyOnly();
        void loadPlanetDetail(id, false)
          .then((detail) => {
            if (state.payload) state.payload.detail = detail;
            state.planetHasMore = detail.has_more !== false;
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
      state.apodHasMore = true;
      state.planetHasMore = true;
      void loadTab(state.tab, true);
    });
  }

  function renderPage(container) {
    pageRoot = container;
    state.tab = "apod";
    state.loading = false;
    state.loadingMore = false;
    state.error = "";
    state.payload = null;
    state.selectedPlanet = "earth";
    state.apodHasMore = true;
    state.planetHasMore = true;
    state.cache = {};
    renderPageShell();
    void loadTab("apod", false);
  }

  function destroy() {
    abortCtrl?.abort();
    abortCtrl = null;
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    loadingDotCount = 1;
    if (pageRoot) delete pageRoot.dataset.spaceBound;
    pageRoot = null;
  }

  window.Space = {
    renderPage,
    destroy,
    leavePage: destroy
  };
})();
