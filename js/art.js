(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;
  let bgmAudio = null;
  let bgmUnlockBound = false;
  let bgmSourceUrl = "";

  const ART_BGM_SRC = "/api/art/bgm";
  const ART_BGM_VOLUME = 0.5;

  const state = {
    genres: [],
    genre: "history",
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
    worksRefreshing: false
  };

  const FADE_MS = 520;
  const THUMB_SCROLL_PX_PER_SEC = 14;
  let thumbScrollLastTime = 0;

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

  async function fetchJson(path, options = {}) {
    const { retries = 3, method = "GET" } = options;
    let lastError = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(`${apiBase()}${path}`, {
          method,
          signal: abortCtrl?.signal,
          headers: { Accept: "application/json" }
        });
        if (res.ok) return res.json();

        const detail = await res.text();
        const retryable = res.status === 502 || res.status === 503 || res.status === 429;
        if (retryable && attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
          continue;
        }
        throw new Error(detail || `HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
        if (err.name === "AbortError" || attempt >= retries - 1) throw err;
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
      }
    }

    throw lastError || new Error("Request failed");
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
    const data = await fetchJson("/api/art/genres");
    state.genres = data.genres || [];
    if (!state.genres.some((g) => g.id === state.genre) && state.genres[0]) {
      state.genre = state.genres[0].id;
    }
  }

  async function loadEras() {
    const data = await fetchJson("/api/art/eras");
    state.eras = data.eras || [];
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
      state.works = dedupeArtWorks(data.works || []);
      state.genre = genreId;
      state.selectedWorkIndex = 0;
      state.worksUpdatedAt = data.updated_at || "";
    } catch (err) {
      state.error = err.message || "작품을 불러오지 못했습니다.";
      state.works = [];
    } finally {
      state.worksLoading = false;
      renderWorksSection();
      updateArtRefreshBar();
    }
  }

  async function refreshGenreWorks() {
    if (state.artistMode || state.worksRefreshing || state.worksLoading) return;
    state.worksRefreshing = true;
    state.error = "";
    updateArtRefreshBar();
    try {
      const data = await fetchJson(
        `/api/art/works/refresh?genre=${encodeURIComponent(state.genre)}`,
        { method: "POST", retries: 1 }
      );
      state.works = dedupeArtWorks(data.works || []);
      state.selectedWorkIndex = 0;
      state.worksUpdatedAt = data.updated_at || "";
      renderWorksSection();
    } catch (err) {
      state.error = err.message || "작품을 다시 불러오지 못했습니다.";
    } finally {
      state.worksRefreshing = false;
      updateArtRefreshBar();
    }
  }

  function scrollArtPageToTop() {
    const target = pageRoot?.querySelector(".art-header") || pageRoot?.querySelector(".art-panel") || pageRoot;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadArtistWorks(name) {
    state.worksLoading = true;
    state.artistMode = true;
    state.selectedArtist = name;
    state.selectedWorkIndex = 0;
    state.worksTitle = `${name} · 작품`;
    state.worksSubtitle = "";
    scrollArtPageToTop();
    renderWorksSection();
    try {
      const data = await fetchJson(`/api/art/artist-works?name=${encodeURIComponent(name)}`);
      const artistName = data.artist?.name || name;
      state.works = dedupeArtWorks(data.works || [], artistName);
      state.selectedWorkIndex = 0;
      if (data.artist?.name) {
        state.selectedArtist = data.artist.name;
        state.worksTitle = `${data.artist.name} · 작품`;
      }
      scrollArtPageToTop();
    } catch (err) {
      state.error = err.message || "화가 작품을 불러오지 못했습니다.";
      state.works = [];
    } finally {
      state.worksLoading = false;
      renderWorksSection();
      updateArtRefreshBar();
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

  function renderBgmButton() {
    return `
      <button type="button" class="art-bgm-btn is-active" id="art-bgm-btn" aria-pressed="true" title="갤러리 분위기 BGM">
        🎵 BGM
      </button>
    `;
  }

  function renderIntervalPicker() {
    const options = [3000, 5000, 10000];
    return `
      <div class="art-gallery-side-controls">
        ${renderBgmButton()}
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
    if (state.worksLoading) {
      return `<p class="art-status art-status-loading" role="status">작품을 불러오는 중…</p>`;
    }
    if (!state.works.length) {
      return `<p class="art-status art-status-info">표시할 작품이 없습니다.</p>`;
    }

    const work = state.works[state.selectedWorkIndex] || state.works[0];
    const mainSrc = workImageUrl(work, "full") || workImageUrl(work, "thumb");
    const thumbsHtml = state.works.map(renderThumbItem).join("");

    return `
      <div class="art-gallery" id="art-gallery">
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
    if (userAction) restartSlideshow();
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
      });
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
  }

  function renderWorksSection() {
    const host = pageRoot?.querySelector("#art-works-host");
    if (!host) return;
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
    const directThumb = work.direct_thumb_url || "";
    if (directThumb.startsWith("http")) return downsizeMetThumb(directThumb);
    const proxy = proxyUrl(work.thumb_url);
    if (proxy) return downsizeMetThumb(proxy);
    return "";
  }

  function renderSampleWorks(works) {
    const list = (works || []).filter((w) => sampleWorkThumb(w)).slice(0, 3);
    if (!list.length) {
      return `<p class="art-artist-works-empty">대표 작품 썸네일을 불러오는 중…</p>`;
    }
    return `
      <div class="art-artist-works-grid" role="list" aria-label="대표 작품">
        ${list
          .map(
            (work) => `
          <div class="art-sample-thumb" role="listitem" title="${escapeHtml(work.title)}">
            <img src="${escapeHtml(sampleWorkThumb(work))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="44" height="44">
          </div>`
          )
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

  function renderArtistCard(artist) {
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
            ${renderSampleWorks(artist.sample_works)}
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
          ${(era.artists || []).map(renderArtistCard).join("")}
        </div>
      </section>
    `;
  }

  function renderErasSection() {
    if (!state.eras.length) {
      return `<p class="art-status art-status-loading" role="status">화가 목록을 불러오는 중…</p>`;
    }
    return `${renderEraNav()}${renderEraPanel()}`;
  }

  function updateErasSection() {
    const host = pageRoot?.querySelector("#art-eras-host");
    if (!host) return;
    host.innerHTML = renderErasSection();
    bindEraEvents();
    bindProgressiveArtImages(pageRoot);
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
    for (const artist of artists) {
      if (artist.sample_works?.length) continue;
      try {
        const data = await fetchJson(`/api/art/artist-samples?name=${encodeURIComponent(artist.name)}`);
        artist.sample_works = data.sample_works || [];
      } catch {
        artist.sample_works = [];
      }
      if (state.selectedEraId === eraId) {
        updateErasSection();
      }
    }
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
        <footer class="art-refresh-bar" id="art-refresh-bar" aria-live="polite"></footer>
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
    updateArtRefreshBar();
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
          ${busy ? "작품 불러오는 중…" : `${escapeHtml(genreLabel)} 다시 요청하기`}
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
        if (!id || id === state.genre) return;
        pageRoot.querySelectorAll(".art-genre-btn").forEach((el) => {
          el.classList.toggle("is-active", el.dataset.artGenre === id);
        });
        void loadGenreWorks(id);
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
      await loadGenres();
      render();
      await loadGenreWorks(state.genre);
      await loadEras();
      render();
      void loadArtistSamplesForEra(state.selectedEraId || state.eras[0]?.id);
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

  window.Art = { renderPage, destroy };
})();
