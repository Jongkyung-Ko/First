(function () {
  "use strict";

  let pageRoot = null;
  let fsOverlay = null;
  let fsScrollRaf = null;
  let reciteSeq = 0;
  let bgmAudio = null;
  let bgmSourceUrl = "";
  let bgmPlaybackRate = 1;

  const POEM_BGM_VOLUME = 0.32;
  const POEM_BGM_DUCK = 0.18;
  const RATE_PRESETS = [0.7, 0.85, 1.0, 1.15, 1.35];
  const wikiImageCache = Object.create(null);

  const state = {
    expandedPoetId: null,
    searchAuthor: "",
    searchOpen: false,
    worksByKey: {},
    selectedByKey: {},
    loadingKey: null,
    errorByKey: {},

    fs: {
      open: false,
      poetLabel: "",
      bgmGroupIndex: 0,
      queue: [],
      index: 0,
      rate: 1.0,
      bgmOn: true,
      paused: false,
      playing: false
    }
  };

  function profiles() {
    return window.POEM_POET_PROFILES || [];
  }

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
  }

  function assetBase() {
    if (location.protocol === "file:") return "./";
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function poetKey(poet) {
    if (!poet) return "";
    return poet.id || poet.gonguAuthor || poet.name || "";
  }

  function worksKeyForPoet(poet) {
    return `poet:${poetKey(poet)}`;
  }

  function worksKeyForSearch(author) {
    return `search:${String(author || "").trim()}`;
  }

  function poetImageUrl(profile) {
    if (profile?.imageUrl) return profile.imageUrl;
    if (profile?.imageFile) {
      return `${apiBase()}/api/poem/poet-image?file=${encodeURIComponent(profile.imageFile)}`;
    }
    return "";
  }

  async function fetchWikiThumbnail(name) {
    const key = String(name || "").trim();
    if (!key) return "";
    if (wikiImageCache[key]) return wikiImageCache[key];
    for (const lang of ["ko", "en"]) {
      try {
        const res = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`
        );
        if (!res.ok) continue;
        const data = await res.json();
        const src = data?.thumbnail?.source || "";
        if (src) {
          wikiImageCache[key] = src;
          return src;
        }
      } catch (_) {
        /* try next lang */
      }
    }
    wikiImageCache[key] = "";
    return "";
  }

  function hydratePoetImages(root) {
    if (!root) return;
    root.querySelectorAll("[data-poem-wiki-name]").forEach((wrap) => {
      const name = wrap.dataset.poemWikiName || "";
      const img = wrap.querySelector(".poem-poet-photo");
      const fallback = wrap.querySelector(".poem-poet-photo-fallback");
      if (!name || !img) return;
      void fetchWikiThumbnail(name).then((src) => {
        if (!src || !wrap.isConnected) return;
        img.src = src;
        img.classList.remove("is-broken");
        fallback?.classList.add("is-hidden");
      });
    });
  }

  function fallbackWorksForAuthor(author, poetId) {
    const fb = window.PoemFallback;
    let list = fb?.listByAuthor?.(author) || [];
    if (!list.length && poetId) {
      list = fb?.listByPoetId?.(poetId) || [];
    }
    if (list.length) return list.slice();
    const poet = profiles().find(
      (p) => p.id === poetId || p.gonguAuthor === author || p.name === author
    );
    if (!poet) return [];
    return (poet.featuredWorks || []).map((title, index) => ({
      id: `fb-${poet.id}-${index}`,
      title,
      author: poet.gonguAuthor || poet.name,
      body: `${title}\n\n(공유마당 API 연결 후 전문을 불러옵니다. Render에 GONGU_SERVICE_KEY 설정·재배포가 필요합니다.)`,
      fallback: true
    }));
  }

  function isFallbackWorkId(workId) {
    return String(workId || "").startsWith("fb-");
  }

  function resolveBgmUrl(file) {
    if (!file) return "";
    return typeof window.resolveAudioAssetUrl === "function"
      ? window.resolveAudioAssetUrl(file)
      : assetBase() + file.replace(/^\.\//, "");
  }

  function ensureBgmAudio() {
    if (bgmAudio) return bgmAudio;
    bgmAudio = new Audio();
    bgmAudio.loop = true;
    bgmAudio.volume = POEM_BGM_VOLUME;
    bgmAudio.preload = "auto";
    return bgmAudio;
  }

  function resetBgmSource(url, playbackRate) {
    if (!bgmAudio || !url) return;
    bgmPlaybackRate = playbackRate || 1;
    if (bgmSourceUrl && bgmSourceUrl !== url) {
      bgmAudio.pause();
      bgmAudio.src = url;
      bgmAudio.load();
    } else if (!bgmAudio.src) {
      bgmAudio.src = url;
    }
    bgmSourceUrl = url;
    try {
      bgmAudio.playbackRate = bgmPlaybackRate;
    } catch (_) {
      /* ignore */
    }
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

  function applyBgmVolume(duck) {
    if (!bgmAudio) return;
    const base = POEM_BGM_VOLUME;
    bgmAudio.volume = duck ? POEM_BGM_DUCK : base;
  }

  function syncBgmForGroup(groupIndex) {
    if (!state.fs.open || !state.fs.bgmOn) {
      stopBgm();
      return;
    }
    const group =
      typeof window.poemBgmGroupForIndex === "function"
        ? window.poemBgmGroupForIndex(groupIndex)
        : { file: "assets/audio/bgm/space-dream-strings.mp3", playbackRate: 1 };
    const url = resolveBgmUrl(group.file);
    if (!url) return;
    const audio = ensureBgmAudio();
    resetBgmSource(url, group.playbackRate || 1);
    applyBgmVolume(state.fs.playing);
    audio.play().catch(() => {});
  }

  function toggleBgm() {
    state.fs.bgmOn = !state.fs.bgmOn;
    syncFsControls();
    if (state.fs.bgmOn) syncBgmForGroup(state.fs.bgmGroupIndex);
    else stopBgm();
  }

  function webSpeechSupported() {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    );
  }

  function sanitizeSpeechText(text) {
    return String(text || "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function pickKoreanVoice() {
    if (!webSpeechSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    const ko = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("ko"));
    return ko.find((v) => v.localService) || ko[0] || null;
  }

  function stopSpeech() {
    reciteSeq += 1;
    if (fsScrollRaf) {
      cancelAnimationFrame(fsScrollRaf);
      fsScrollRaf = null;
    }
    if (!webSpeechSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
    applyBgmVolume(false);
  }

  async function fetchWorks(author) {
    const q = String(author || "").trim();
    if (!q) return { results: [], fallback: true };
    try {
      const res = await fetch(
        `${apiBase()}/api/poem/works?${new URLSearchParams({ author: q, rows: "100" })}`
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.results)) {
        return data;
      }
    } catch (_) {
      /* fall through to offline cache */
    }
    const results = fallbackWorksForAuthor(q);
    return {
      results,
      count: results.length,
      author: q,
      fallback: true,
      attribution: "출처: 공유마당 만료저작물 (오프라인 캐시)"
    };
  }

  async function fetchWorkDetail(workId) {
    if (isFallbackWorkId(workId)) {
      const hit = window.PoemFallback?.getWorkById?.(workId);
      if (hit) return hit;
      const cached = Object.values(state.worksByKey)
        .flat()
        .find((w) => w.id === workId);
      if (cached?.body) return cached;
      throw new Error("시 본문을 찾을 수 없습니다.");
    }
    try {
      const res = await fetch(`${apiBase()}/api/poem/work/${encodeURIComponent(workId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
    } catch (_) {
      /* fallback below */
    }
    const hit = window.PoemFallback?.getWorkById?.(workId);
    if (hit) return hit;
    throw new Error("시 본문을 불러오지 못했습니다.");
  }

  function getSelectedSet(key) {
    if (!state.selectedByKey[key]) state.selectedByKey[key] = new Set();
    return state.selectedByKey[key];
  }

  function getWorks(key) {
    return state.worksByKey[key] || [];
  }

  async function loadWorksForKey(key, author, poetId) {
    if (state.loadingKey === key) return;
    if (state.worksByKey[key]) return;
    state.loadingKey = key;
    state.errorByKey[key] = "";
    renderWorksPanel(key);
    try {
      const data = await fetchWorks(author);
      state.worksByKey[key] = data.results || [];
      if (!state.worksByKey[key].length) {
        state.errorByKey[key] = "등록된 시가 없습니다.";
      }
      const sel = getSelectedSet(key);
      state.worksByKey[key].forEach((w) => sel.add(w.id));
    } catch (err) {
      state.errorByKey[key] = err.message || "시 목록을 불러오지 못했습니다.";
      state.worksByKey[key] = fallbackWorksForAuthor(author, poetId);
      if (state.worksByKey[key].length) {
        state.errorByKey[key] = "";
        const sel = getSelectedSet(key);
        state.worksByKey[key].forEach((w) => sel.add(w.id));
      }
    } finally {
      state.loadingKey = null;
      renderWorksPanel(key);
    }
  }

  function renderPoetPhoto(profile) {
    const wikiName = profile.wikiName || profile.name || "";
    const initial = (profile.name || "?").charAt(0);
    return `
      <div class="poem-poet-photo-wrap" data-poem-wiki-name="${escapeHtml(wikiName)}">
        <img class="poem-poet-photo is-broken" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.classList.add('is-broken');var f=this.parentElement&&this.parentElement.querySelector('.poem-poet-photo-fallback');if(f)f.classList.remove('is-hidden');">
        <span class="poem-poet-photo-fallback" aria-hidden="true">${escapeHtml(initial)}</span>
      </div>`;
  }

  function renderFeaturedWorks(profile) {
    const items = (profile.featuredWorks || [])
      .slice(0, 4)
      .map((w) => `<li>${escapeHtml(w)}</li>`)
      .join("");
    if (!items) return "";
    return `
      <div class="poem-poet-works">
        <h5 class="poem-poet-works-title">대표 시</h5>
        <ul class="poem-poet-works-list">${items}</ul>
      </div>`;
  }

  function renderPoetCard(profile, index) {
    const key = worksKeyForPoet(profile);
    const expanded = state.expandedPoetId === profile.id;
    const bioId = `poem-bio-${profile.id}`;
    return `
      <article class="poem-poet-card${expanded ? " is-expanded" : ""}" id="poem-poet-${escapeHtml(profile.id)}" data-poet-index="${index}">
        <div class="poem-poet-aside">
          ${renderPoetPhoto(profile)}
          <button type="button" class="poem-btn poem-btn-primary poem-poet-listen" data-poet-id="${escapeHtml(profile.id)}">
            ${expanded ? "접기" : "시듣기"}
          </button>
        </div>
        <div class="poem-poet-body">
          <h4 class="poem-poet-name">${escapeHtml(profile.name)}</h4>
          <p class="poem-poet-meta">${escapeHtml(profile.years || "")}</p>
          ${profile.chronology ? `<p class="poem-poet-chronology"><span>연대기</span> ${escapeHtml(profile.chronology)}</p>` : ""}
          <div class="poem-poet-bio-wrap is-collapsed" data-poem-bio-wrap>
            <p class="poem-poet-bio" id="${bioId}">${escapeHtml(profile.bio || "")}</p>
            <button type="button" class="poem-poet-bio-toggle" aria-expanded="false" aria-controls="${bioId}" hidden>펼치기</button>
          </div>
          ${renderFeaturedWorks(profile)}
        </div>
      </article>
      <div class="poem-work-panel-slot" data-work-slot="${escapeHtml(key)}" ${expanded ? "" : "hidden"}></div>`;
  }

  function renderWorksPanelHtml(key, authorLabel) {
    const works = getWorks(key);
    const sel = getSelectedSet(key);
    const loading = state.loadingKey === key;
    const error = state.errorByKey[key];
    const allChecked = works.length > 0 && works.every((w) => sel.has(w.id));
    const indeterminate = !allChecked && works.some((w) => sel.has(w.id));

    if (loading) {
      return `<div class="poem-work-panel"><p class="poem-work-loading">시 목록 불러오는 중…</p></div>`;
    }
    if (error) {
      return `<div class="poem-work-panel"><p class="poem-work-error">${escapeHtml(error)}</p></div>`;
    }
    if (!works.length) {
      return `<div class="poem-work-panel"><p class="poem-work-empty">등록된 시가 없습니다. 시인 검색을 이용해 보세요.</p></div>`;
    }

    const rows = works
      .map(
        (w) => `
        <label class="poem-work-row">
          <input type="checkbox" class="poem-work-check" data-work-key="${escapeHtml(key)}" data-work-id="${escapeHtml(w.id)}" ${sel.has(w.id) ? "checked" : ""}>
          <span class="poem-work-title">${escapeHtml(w.title)}</span>
          ${w.year ? `<span class="poem-work-year">${escapeHtml(w.year)}</span>` : ""}
        </label>`
      )
      .join("");

    return `
      <div class="poem-work-panel" data-work-panel="${escapeHtml(key)}">
        <div class="poem-work-panel-head">
          <h5>${escapeHtml(authorLabel)} — 시 ${works.length}편</h5>
          <label class="poem-work-select-all">
            <input type="checkbox" class="poem-work-select-all-input" data-work-key="${escapeHtml(key)}" ${allChecked ? "checked" : ""} ${indeterminate ? 'data-indeterminate="true"' : ""}>
            전체 선택
          </label>
        </div>
        <div class="poem-work-list">${rows}</div>
        <button type="button" class="poem-btn poem-btn-recite" data-recite-key="${escapeHtml(key)}" data-recite-label="${escapeHtml(authorLabel)}" ${sel.size ? "" : "disabled"}>
          시낭송 (${sel.size}편)
        </button>
        <p class="poem-attribution">출처: <a href="https://gongu.copyright.or.kr/gongu/main/main.do" target="_blank" rel="noopener noreferrer">공유마당</a> 만료저작물 · 한국저작권위원회</p>
      </div>`;
  }

  function renderWorksPanel(key) {
    if (!pageRoot) return;
    const slot = pageRoot.querySelector(`[data-work-slot="${CSS.escape(key)}"]`);
    if (!slot) return;
    const poet = profiles().find((p) => worksKeyForPoet(p) === key);
    const authorLabel = poet?.name || state.searchAuthor || key.replace(/^search:/, "");
    slot.innerHTML = renderWorksPanelHtml(key, authorLabel);
    slot.hidden = false;
    syncSelectAllIndeterminate(key);
  }

  function syncSelectAllIndeterminate(key) {
    const panel = pageRoot?.querySelector(`[data-work-panel="${CSS.escape(key)}"]`);
    const allInput = panel?.querySelector(".poem-work-select-all-input");
    if (!allInput) return;
    const works = getWorks(key);
    const sel = getSelectedSet(key);
    const allChecked = works.length > 0 && works.every((w) => sel.has(w.id));
    const some = works.some((w) => sel.has(w.id));
    allInput.checked = allChecked;
    allInput.indeterminate = !allChecked && some;
  }

  function renderSearchSection() {
    const key = state.searchAuthor ? worksKeyForSearch(state.searchAuthor) : "";
    const hasSearch = Boolean(state.searchAuthor);
    return `
      <section class="poem-search-section" aria-label="시인 검색">
        <h3>시인 검색</h3>
        <p class="poem-search-hint">공유마당 만료저작물에서 시인 이름으로 시를 찾아 낭송할 수 있습니다.</p>
        <form class="poem-search-form" id="poem-search-form">
          <input type="search" class="poem-search-input" id="poem-search-input" placeholder="예: 윤동주, 김소월, 정지용…" value="${escapeHtml(state.searchAuthor)}" autocomplete="off">
          <button type="submit" class="poem-btn poem-btn-primary">검색</button>
          ${hasSearch ? `<button type="button" class="poem-btn poem-btn-ghost" id="poem-search-clear">초기화</button>` : ""}
        </form>
        ${hasSearch ? `<div class="poem-search-results" data-work-slot="${escapeHtml(key)}"></div>` : ""}
      </section>`;
  }

  function renderPageShell() {
    const cards = profiles()
      .map((p, i) => renderPoetCard(p, i))
      .join("");
    return `
      <article class="content-panel poem-panel">
        <header class="poem-panel-head">
          <h2>Poem</h2>
          <p class="poem-intro">한국 대표 시인 30인의 네임카드와 공유마당 만료 시를 브라우저 음성으로 낭송합니다. 시인 5명마다 다른 BGM이 재생됩니다.</p>
        </header>
        ${renderSearchSection()}
        <section class="poem-poet-gallery" aria-label="한국 시인 30인">
          <header class="poem-poet-gallery-head">
            <h3>대표 시인 30인</h3>
            <p>「시듣기」를 누르면 공유마당 시 목록이 펼쳐지고, 선택 후 「시낭송」으로 전체화면 낭송을 시작합니다.</p>
          </header>
          <div class="poem-poet-grid" id="poem-poet-grid">${cards}</div>
        </section>
      </article>`;
  }

  function initBioToggles(root) {
    root?.querySelectorAll("[data-poem-bio-wrap]").forEach((wrap) => {
      const desc = wrap.querySelector(".poem-poet-bio");
      const btn = wrap.querySelector(".poem-poet-bio-toggle");
      if (!desc || !btn) return;
      const collapsed = desc.scrollHeight > 72;
      btn.hidden = !collapsed;
      btn.textContent = wrap.classList.contains("is-expanded") ? "접기" : "펼치기";
      btn.setAttribute("aria-expanded", wrap.classList.contains("is-expanded") ? "true" : "false");
      btn.onclick = () => {
        const expanded = wrap.classList.toggle("is-expanded");
        wrap.classList.toggle("is-collapsed", !expanded);
        btn.textContent = expanded ? "접기" : "펼치기";
        btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      };
    });
  }

  function expandPoet(poetId) {
    const poet = profiles().find((p) => p.id === poetId);
    if (!poet) return;
    const wasExpanded = state.expandedPoetId === poetId;
    state.expandedPoetId = wasExpanded ? null : poetId;
    renderPoetGrid();
    if (!wasExpanded) {
      void loadWorksForKey(worksKeyForPoet(poet), poet.gonguAuthor || poet.name, poet.id);
    }
  }

  function renderPoetGrid() {
    const grid = pageRoot?.querySelector("#poem-poet-grid");
    if (!grid) return;
    grid.innerHTML = profiles().map((p, i) => renderPoetCard(p, i)).join("");
    initBioToggles(grid);
    hydratePoetImages(grid);
    if (state.expandedPoetId) {
      const poet = profiles().find((p) => p.id === state.expandedPoetId);
      if (poet) renderWorksPanel(worksKeyForPoet(poet));
    }
  }

  async function runSearch(author) {
    const q = String(author || "").trim();
    if (!q) return;
    state.searchAuthor = q;
    const key = worksKeyForSearch(q);
    delete state.worksByKey[key];
    delete state.errorByKey[key];
    const searchRoot = pageRoot?.querySelector(".poem-search-section");
    if (searchRoot) {
      const parent = pageRoot.querySelector(".poem-panel");
      const gallery = parent?.querySelector(".poem-poet-gallery");
      searchRoot.outerHTML = renderSearchSection();
      bindSearchEvents();
    }
    await loadWorksForKey(key, q);
    renderWorksPanel(key);
  }

  function bindSearchEvents() {
    pageRoot?.querySelector("#poem-search-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = pageRoot.querySelector("#poem-search-input");
      void runSearch(input?.value || "");
    });
    pageRoot?.querySelector("#poem-search-clear")?.addEventListener("click", () => {
      state.searchAuthor = "";
      delete state.worksByKey[worksKeyForSearch("")];
      const searchRoot = pageRoot?.querySelector(".poem-search-section");
      if (searchRoot) searchRoot.outerHTML = renderSearchSection();
      bindSearchEvents();
    });
  }

  function selectedWorksForKey(key) {
    const sel = getSelectedSet(key);
    return getWorks(key).filter((w) => sel.has(w.id));
  }

  function poetIndexForKey(key) {
    if (key.startsWith("poet:")) {
      const id = key.slice(5);
      return profiles().findIndex((p) => p.id === id);
    }
    if (key.startsWith("search:")) {
      const name = key.slice(7);
      let hash = 0;
      for (let i = 0; i < name.length; i += 1) {
        hash = (hash + name.charCodeAt(i)) % 6;
      }
      return hash * 5;
    }
    return 0;
  }

  function ensureFsOverlay() {
    if (fsOverlay?.querySelector("[data-poem-fs-scroll]")) return;
    if (fsOverlay) fsOverlay.remove();
    fsOverlay = document.createElement("div");
    fsOverlay.id = "poem-recite-fs";
    fsOverlay.className = "poem-recite-fs";
    fsOverlay.hidden = true;
    fsOverlay.setAttribute("role", "dialog");
    fsOverlay.setAttribute("aria-modal", "true");
    fsOverlay.setAttribute("aria-label", "시낭송");
    fsOverlay.innerHTML = `
      <div class="poem-fs-top">
        <div class="poem-fs-rate" role="group" aria-label="낭송 속도">
          ${RATE_PRESETS.map(
            (r) =>
              `<button type="button" class="poem-fs-rate-btn" data-poem-fs-rate="${r}">${r}×</button>`
          ).join("")}
        </div>
        <div class="poem-fs-top-right">
          <button type="button" class="poem-fs-bgm-btn is-active" data-poem-fs-bgm aria-pressed="true">🎵 BGM</button>
          <button type="button" class="poem-fs-close" data-poem-fs-close aria-label="닫기">✕</button>
        </div>
      </div>
      <div class="poem-fs-stage">
        <div class="poem-fs-poet" data-poem-fs-poet></div>
        <h2 class="poem-fs-title" data-poem-fs-title></h2>
        <div class="poem-fs-scroll-wrap">
          <div class="poem-fs-scroll" data-poem-fs-scroll></div>
        </div>
        <p class="poem-fs-progress" data-poem-fs-progress></p>
        <p class="poem-fs-attribution">출처: 공유마당(한국저작권위원회) 만료저작물</p>
      </div>`;
    document.body.appendChild(fsOverlay);

    fsOverlay.querySelector("[data-poem-fs-close]")?.addEventListener("click", closeReciteFs);
    fsOverlay.querySelector("[data-poem-fs-bgm]")?.addEventListener("click", toggleBgm);
    fsOverlay.querySelectorAll("[data-poem-fs-rate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.fs.rate = Number(btn.dataset.poemFsRate) || 1;
        syncFsControls();
      });
    });
  }

  function syncFsControls() {
    if (!fsOverlay) return;
    fsOverlay.querySelectorAll("[data-poem-fs-rate]").forEach((btn) => {
      const r = Number(btn.dataset.poemFsRate);
      btn.classList.toggle("is-active", r === state.fs.rate);
    });
    const bgmBtn = fsOverlay.querySelector("[data-poem-fs-bgm]");
    if (bgmBtn) {
      bgmBtn.classList.toggle("is-active", state.fs.bgmOn);
      bgmBtn.setAttribute("aria-pressed", state.fs.bgmOn ? "true" : "false");
      bgmBtn.textContent = state.fs.bgmOn ? "🎵 BGM" : "🔇 BGM";
    }
    const progressEl = fsOverlay.querySelector("[data-poem-fs-progress]");
    if (progressEl && state.fs.queue.length) {
      progressEl.textContent = `${state.fs.index + 1} / ${state.fs.queue.length} · ${state.fs.poetLabel}`;
    }
  }

  function startScrollAnimation(textEl, durationMs) {
    if (fsScrollRaf) cancelAnimationFrame(fsScrollRaf);
    const wrap = fsOverlay?.querySelector(".poem-fs-scroll-wrap");
    if (!textEl || !wrap) return;
    const contentH = textEl.scrollHeight;
    const viewH = wrap.clientHeight || 280;
    const travel = contentH + viewH;
    const start = performance.now();
    const dur = Math.max(4000, durationMs || travel / (28 * state.fs.rate));

    textEl.style.transform = `translateY(${viewH}px)`;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const y = viewH - travel * t;
      textEl.style.transform = `translateY(${y}px)`;
      if (t < 1 && state.fs.open) {
        fsScrollRaf = requestAnimationFrame(tick);
      }
    };
    fsScrollRaf = requestAnimationFrame(tick);
  }

  function estimateSpeechMs(text, rate) {
    const chars = String(text || "").length;
    const cps = 7.5 * (rate || 1);
    return Math.max(5000, (chars / cps) * 1000 + 1500);
  }

  function speakText(text, rate) {
    return new Promise((resolve) => {
      if (!webSpeechSupported()) {
        resolve();
        return;
      }
      const cleaned = sanitizeSpeechText(text);
      if (!cleaned) {
        resolve();
        return;
      }
      const seq = reciteSeq;
      window.speechSynthesis.getVoices();
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = "ko-KR";
      utterance.rate = rate || 1;
      const voice = pickKoreanVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || "ko-KR";
      }
      applyBgmVolume(true);
      utterance.onend = () => {
        if (seq !== reciteSeq) return;
        applyBgmVolume(false);
        resolve();
      };
      utterance.onerror = () => {
        if (seq !== reciteSeq) return;
        applyBgmVolume(false);
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  async function reciteOneWork(work) {
    if (!state.fs.open) return;
    const titleEl = fsOverlay?.querySelector("[data-poem-fs-title]");
    const scrollEl = fsOverlay?.querySelector("[data-poem-fs-scroll]");
    const poetEl = fsOverlay?.querySelector("[data-poem-fs-poet]");
    if (!titleEl || !scrollEl) return;

    titleEl.textContent = work.title || "";
    if (poetEl) poetEl.textContent = state.fs.poetLabel;
    scrollEl.textContent = "본문 불러오는 중…";
    syncFsControls();

    let body = work.body || "";
    if (!body || (work.fallback && body.includes("API 연결"))) {
      try {
        const detail = await fetchWorkDetail(work.id);
        body = detail.body || body || detail.title || "";
      } catch (_) {
        body = body || "(본문을 불러오지 못했습니다)";
      }
    } else if (!isFallbackWorkId(work.id)) {
      try {
        const detail = await fetchWorkDetail(work.id);
        body = detail.body || body || detail.title || "";
      } catch (_) {
        body = body || "(본문을 불러오지 못했습니다)";
      }
    }

    const fullText = sanitizeSpeechText(`${work.title}\n\n${body}`);
    scrollEl.textContent = fullText;
    scrollEl.style.transform = "translateY(0)";

    state.fs.playing = true;
    const dur = estimateSpeechMs(fullText, state.fs.rate);
    startScrollAnimation(scrollEl, dur);
    await speakText(fullText, state.fs.rate);
    state.fs.playing = false;
  }

  async function runReciteQueue() {
    while (state.fs.open && state.fs.index < state.fs.queue.length) {
      await reciteOneWork(state.fs.queue[state.fs.index]);
      if (!state.fs.open) break;
      state.fs.index += 1;
      syncFsControls();
    }
    if (state.fs.open && state.fs.index >= state.fs.queue.length) {
      closeReciteFs();
    }
  }

  function openReciteFs(key, label) {
    const queue = selectedWorksForKey(key);
    if (!queue.length) return;
    if (!webSpeechSupported()) {
      alert("이 브라우저는 음성 낭송(Web Speech)을 지원하지 않습니다.");
      return;
    }
    ensureFsOverlay();
    state.fs.open = true;
    state.fs.poetLabel = label || "";
    state.fs.queue = queue;
    state.fs.index = 0;
    state.fs.rate = 1.0;
    state.fs.bgmOn = true;
    state.fs.bgmGroupIndex = Math.max(0, poetIndexForKey(key));
    fsOverlay.hidden = false;
    document.documentElement.classList.add("poem-fs-immersive-lock");
    syncFsControls();
    syncBgmForGroup(state.fs.bgmGroupIndex);
    void runReciteQueue();
  }

  function closeReciteFs() {
    state.fs.open = false;
    state.fs.playing = false;
    stopSpeech();
    stopBgm();
    if (fsOverlay) fsOverlay.hidden = true;
    document.documentElement.classList.remove("poem-fs-immersive-lock");
  }

  function bindPageEvents() {
    pageRoot?.addEventListener("click", (e) => {
      const listenBtn = e.target.closest(".poem-poet-listen");
      if (listenBtn?.dataset.poetId) {
        expandPoet(listenBtn.dataset.poetId);
        return;
      }

      const reciteBtn = e.target.closest(".poem-btn-recite");
      if (reciteBtn?.dataset.reciteKey) {
        openReciteFs(reciteBtn.dataset.reciteKey, reciteBtn.dataset.reciteLabel || "");
        return;
      }
    });

    pageRoot?.addEventListener("change", (e) => {
      const allInput = e.target.closest(".poem-work-select-all-input");
      if (allInput?.dataset.workKey) {
        const key = allInput.dataset.workKey;
        const sel = getSelectedSet(key);
        const works = getWorks(key);
        if (allInput.checked) works.forEach((w) => sel.add(w.id));
        else sel.clear();
        renderWorksPanel(key);
        return;
      }

      const check = e.target.closest(".poem-work-check");
      if (check?.dataset.workKey && check.dataset.workId) {
        const key = check.dataset.workKey;
        const sel = getSelectedSet(key);
        if (check.checked) sel.add(check.dataset.workId);
        else sel.delete(check.dataset.workId);
        syncSelectAllIndeterminate(key);
        const reciteBtn = pageRoot.querySelector(`[data-recite-key="${CSS.escape(key)}"]`);
        if (reciteBtn) {
          reciteBtn.disabled = sel.size === 0;
          reciteBtn.textContent = `시낭송 (${sel.size}편)`;
        }
      }
    });

    bindSearchEvents();
  }

  function destroy() {
    closeReciteFs();
    if (fsOverlay) {
      fsOverlay.remove();
      fsOverlay = null;
    }
    pageRoot = null;
    bgmAudio = null;
    bgmSourceUrl = "";
  }

  function renderPage(container) {
    destroy();
    if (!container) return;
    container.innerHTML = renderPageShell();
    pageRoot = container.querySelector(".poem-panel") || container;
    initBioToggles(pageRoot);
    hydratePoetImages(pageRoot);
    bindPageEvents();
    if (webSpeechSupported()) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        window.speechSynthesis.getVoices();
      });
    }
  }

  window.Poem = { renderPage, destroy };
})();
