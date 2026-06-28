(function () {
  const PAGE_SIZE = 10;
  const PLAYLIST_STORAGE_KEY = "dw-music-saved-playlist";
  const GENRE_THEMES = {
    jazz: "스윙·비밥·재즈 피아노·트리오",
    classical: "오케스트라·피아노·현악·바로크",
    pop: "팝송·어쿠스틱·일렉트로닉 팝"
  };

  let pageRoot = null;
  let audioEl = null;
  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let gainNode = null;
  let bassFilter = null;
  let midFilter = null;
  let trebleFilter = null;
  let freqData = null;
  let vizRaf = null;
  let loadingTimer = null;
  let loadingDots = 1;
  let searchDebounce = null;

  const state = {
    genre: "jazz",
    genreTheme: "",
    page: 1,
    tracks: [],
    resultCount: 0,
    hasMore: false,
    loading: false,
    trackLoading: false,
    searchQuery: "",
    error: "",
    playbackError: "",
    apiStatus: null,
    selected: null,
    listCollapsed: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    eq: { bass: 0, mid: 0, treble: 0 },
    savedTracks: [],
    playQueue: null,
    queueIndex: 0
  };

  function apiBase() {
    return window.STOCK_API_URL || "https://first-stock-api.onrender.com";
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDuration(ms) {
    const sec = Math.max(0, Math.floor((ms || 0) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function trackCover(track) {
    if (track.thumbnail) {
      return `<img class="music-card-cover" src="${escapeHtml(track.thumbnail)}" alt="" loading="lazy" decoding="async" onerror="this.classList.add('is-broken')">`;
    }
    const initial = (track.artist || track.title || "?").trim().charAt(0).toUpperCase();
    return `<span class="music-card-cover-fallback" aria-hidden="true">${escapeHtml(initial)}</span>`;
  }

  function loadSavedPlaylist() {
    try {
      const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      state.savedTracks = Array.isArray(parsed) ? parsed : [];
    } catch {
      state.savedTracks = [];
    }
  }

  function persistSavedPlaylist() {
    try {
      localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(state.savedTracks));
    } catch {
      /* ignore quota */
    }
  }

  function isInSavedPlaylist(trackId) {
    return state.savedTracks.some((t) => t.id === trackId);
  }

  function addToSavedPlaylist(track) {
    if (!track?.id || isInSavedPlaylist(track.id)) return false;
    state.savedTracks.push({ ...track });
    persistSavedPlaylist();
    return true;
  }

  function removeFromSavedPlaylist(trackId) {
    const before = state.savedTracks.length;
    state.savedTracks = state.savedTracks.filter((t) => t.id !== trackId);
    if (state.savedTracks.length !== before) {
      persistSavedPlaylist();
      if (state.playQueue) {
        state.playQueue = state.playQueue.filter((t) => t.id !== trackId);
        if (!state.playQueue.length) state.playQueue = null;
      }
      return true;
    }
    return false;
  }

  function findTrackById(id) {
    return (
      state.tracks.find((t) => t.id === id) ||
      state.savedTracks.find((t) => t.id === id) ||
      (state.selected?.id === id ? state.selected : null)
    );
  }

  function startLoadingAnimation() {
    stopLoadingAnimation();
    loadingDots = 1;
    updateLoadingBanner();
    loadingTimer = setInterval(() => {
      loadingDots = loadingDots >= 4 ? 1 : loadingDots + 1;
      updateLoadingBanner();
    }, 400);
  }

  function stopLoadingAnimation() {
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    updateLoadingBanner();
  }

  function isLoadingVisible() {
    return state.loading || state.trackLoading;
  }

  function updateLoadingBanner() {
    if (!pageRoot) return;
    const el = pageRoot.querySelector("#music-loading-line");
    if (!el) return;
    if (!isLoadingVisible()) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = `로딩 중 ${".".repeat(loadingDots)}`;
  }

  function ensureAudioGraph() {
    if (!audioEl) return;
    if (audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    sourceNode = audioCtx.createMediaElementSource(audioEl);
    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 200;
    midFilter = audioCtx.createBiquadFilter();
    midFilter.type = "peaking";
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 0.8;
    trebleFilter = audioCtx.createBiquadFilter();
    trebleFilter.type = "highshelf";
    trebleFilter.frequency.value = 4000;
    gainNode = audioCtx.createGain();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    sourceNode.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    applyEq();
  }

  function applyEq() {
    if (!bassFilter || !midFilter || !trebleFilter) return;
    bassFilter.gain.value = state.eq.bass;
    midFilter.gain.value = state.eq.mid;
    trebleFilter.gain.value = state.eq.treble;
  }

  function stopViz() {
    if (vizRaf) {
      cancelAnimationFrame(vizRaf);
      vizRaf = null;
    }
  }

  function startViz() {
    stopViz();
    const loop = () => {
      drawVisualizer();
      vizRaf = requestAnimationFrame(loop);
    };
    vizRaf = requestAnimationFrame(loop);
  }

  function drawVisualizer() {
    if (!pageRoot) return;
    const canvas = pageRoot.querySelector("#music-viz-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.clearRect(0, 0, w, h);
    const active = state.playing && analyser && freqData;
    if (active) {
      analyser.getByteFrequencyData(freqData);
    }
    const bars = 48;
    const gap = 2;
    const barW = (w - gap * (bars - 1)) / bars;
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * (freqData?.length || 1));
      const v = active ? freqData[idx] / 255 : 0.08 + Math.sin(Date.now() / 400 + i * 0.3) * 0.04;
      const bh = Math.max(4, v * h * 0.92);
      const x = i * (barW + gap);
      const grad = ctx.createLinearGradient(0, h, 0, h - bh);
      grad.addColorStop(0, "#1e3a5f");
      grad.addColorStop(1, active ? "#38bdf8" : "#475569");
      ctx.fillStyle = grad;
      ctx.fillRect(x, h - bh, barW, bh);
    }
  }

  async function fetchTracks() {
    state.loading = true;
    state.error = "";
    startLoadingAnimation();
    render();
    try {
      const params = new URLSearchParams({
        genre: state.genre,
        page: String(state.page),
        limit: String(PAGE_SIZE)
      });
      const q = state.searchQuery.trim();
      if (q) params.set("q", q);
      const url = `${apiBase()}/api/music/tracks?${params}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `목록 로드 실패 (${res.status})`);
      state.tracks = data.tracks || [];
      state.resultCount = data.result_count ?? state.tracks.length;
      state.genreTheme = data.genre_theme || GENRE_THEMES[state.genre] || "";
      state.hasMore = !!data.has_more;
      state.apiStatus = data.api_status || null;
      if (!state.tracks.length) {
        state.error = q
          ? `"${q}" 검색 결과가 없습니다.`
          : "이 장르에 표시할 곡이 없습니다. API 키 설정을 확인하세요.";
      }
    } catch (err) {
      state.error = err.message || "목록을 불러오지 못했습니다.";
      state.tracks = [];
      state.resultCount = 0;
    } finally {
      state.loading = false;
      stopLoadingAnimation();
      render();
    }
  }

  function streamUrl(track) {
    if (!track?.stream_path) return "";
    return `${apiBase()}${track.stream_path}`;
  }

  function waitForAudioReady(el, timeoutMs = 45000) {
    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("오디오 로드 시간 초과"));
      }, timeoutMs);
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        const code = el.error?.code;
        const msgs = { 1: "재생이 중단되었습니다", 2: "네트워크 오류", 3: "디코드 오류", 4: "형식 미지원" };
        reject(new Error(msgs[code] || "오디오를 불러오지 못했습니다"));
      };
      const cleanup = () => {
        clearTimeout(timer);
        el.removeEventListener("canplay", onReady);
        el.removeEventListener("error", onError);
      };
      el.addEventListener("canplay", onReady, { once: true });
      el.addEventListener("error", onError, { once: true });
    });
  }

  async function playTrack(track, options = {}) {
    if (!track) return;
    const { fromQueue = false } = options;
    if (!fromQueue) {
      state.playQueue = null;
      state.queueIndex = 0;
    }
    state.selected = track;
    state.listCollapsed = true;
    state.playbackError = "";
    state.trackLoading = true;
    startLoadingAnimation();
    ensureAudio();
    const url = streamUrl(track);
    if (!url) {
      state.trackLoading = false;
      stopLoadingAnimation();
      return;
    }
    audioEl.pause();
    audioEl.src = url;
    audioEl.load();
    render();
    ensureAudioGraph();
    if (audioCtx?.state === "suspended") {
      await audioCtx.resume();
    }
    try {
      await waitForAudioReady(audioEl);
      await audioEl.play();
      state.playing = true;
      state.playbackError = "";
    } catch (err) {
      state.playing = false;
      state.playbackError = err.message || "재생할 수 없습니다";
    } finally {
      state.trackLoading = false;
      if (!state.loading) stopLoadingAnimation();
      updateLoadingBanner();
    }
    updatePlayerUi();
    startViz();
  }

  function playNextInQueue() {
    if (!state.playQueue?.length) return;
    const next = state.queueIndex + 1;
    if (next >= state.playQueue.length) {
      state.playQueue = null;
      state.queueIndex = 0;
      state.playing = false;
      updatePlayerUi();
      return;
    }
    state.queueIndex = next;
    void playTrack(state.playQueue[next], { fromQueue: true });
  }

  function playAllSaved() {
    if (!state.savedTracks.length) return;
    state.playQueue = state.savedTracks.map((t) => ({ ...t }));
    state.queueIndex = 0;
    void playTrack(state.playQueue[0], { fromQueue: true });
  }

  function ensureAudio() {
    if (audioEl) return;
    audioEl = new Audio();
    audioEl.crossOrigin = "anonymous";
    audioEl.preload = "metadata";
    audioEl.addEventListener("play", () => {
      state.playing = true;
      updatePlayerUi();
      startViz();
    });
    audioEl.addEventListener("pause", () => {
      state.playing = false;
      updatePlayerUi();
    });
    audioEl.addEventListener("timeupdate", () => {
      state.currentTime = audioEl.currentTime;
      state.duration = audioEl.duration || 0;
      updateProgressUi();
    });
    audioEl.addEventListener("ended", () => {
      state.playing = false;
      if (state.playQueue) {
        playNextInQueue();
      } else {
        updatePlayerUi();
      }
    });
    audioEl.addEventListener("loadedmetadata", () => {
      state.duration = audioEl.duration || trackDurationMs(state.selected) / 1000;
      updateProgressUi();
    });
    audioEl.addEventListener("error", () => {
      state.playing = false;
      state.trackLoading = false;
      if (!state.loading) stopLoadingAnimation();
      const code = audioEl.error?.code;
      const msgs = { 1: "재생이 중단되었습니다", 2: "네트워크 오류", 3: "디코드 오류", 4: "형식 미지원" };
      state.playbackError = msgs[code] || "재생 오류";
      updatePlayerUi();
      if (state.playQueue) playNextInQueue();
    });
  }

  function trackDurationMs(track) {
    return track?.duration_ms || 0;
  }

  function pausePlayback() {
    audioEl?.pause();
    state.playing = false;
    updatePlayerUi();
  }

  function togglePlayback() {
    if (!audioEl || !state.selected) return;
    if (state.playing) {
      pausePlayback();
    } else {
      void audioEl.play();
    }
  }

  function seekTo(ratio) {
    if (!audioEl || !state.duration) return;
    audioEl.currentTime = Math.max(0, Math.min(state.duration, ratio * state.duration));
  }

  function stopPlayback() {
    if (audioEl) {
      audioEl.pause();
      audioEl.removeAttribute("src");
      audioEl.load();
    }
    state.playing = false;
    state.trackLoading = false;
    state.playQueue = null;
    state.queueIndex = 0;
    state.currentTime = 0;
    if (!state.loading) stopLoadingAnimation();
    updatePlayerUi();
    stopViz();
  }

  function updateProgressUi() {
    if (!pageRoot) return;
    const cur = pageRoot.querySelector("#music-time-current");
    const total = pageRoot.querySelector("#music-time-total");
    const slider = pageRoot.querySelector("#music-seek");
    if (cur) cur.textContent = formatTime(state.currentTime);
    if (total) total.textContent = formatTime(state.duration || trackDurationMs(state.selected) / 1000);
    if (slider && state.duration) {
      slider.value = String((state.currentTime / state.duration) * 100);
    }
  }

  function updatePlayerUi() {
    if (!pageRoot) return;
    const playBtn = pageRoot.querySelector("#music-play-btn");
    if (playBtn) playBtn.textContent = state.playing ? "⏸" : "▶";
    const status = pageRoot.querySelector("#music-player-status");
    if (status) {
      if (state.trackLoading) {
        status.textContent = `로딩 중 ${".".repeat(loadingDots)}`;
      } else if (state.playbackError) {
        status.textContent = state.playbackError;
      } else if (state.playQueue) {
        status.textContent = state.playing
          ? `저장 목록 재생 ${state.queueIndex + 1}/${state.playQueue.length}`
          : `저장 목록 ${state.queueIndex + 1}/${state.playQueue.length}`;
      } else {
        status.textContent = state.playing ? "재생 중" : state.selected ? "일시정지" : "곡을 선택하세요";
      }
    }
    const addBtn = pageRoot.querySelector("#music-add-saved-btn");
    if (addBtn && state.selected) {
      const saved = isInSavedPlaylist(state.selected.id);
      addBtn.textContent = saved ? "저장됨" : "목록에 추가";
      addBtn.disabled = saved;
    }
  }

  function renderGenreNav() {
    const genres = [
      { id: "jazz", label: "재즈" },
      { id: "classical", label: "클래식" },
      { id: "pop", label: "팝" }
    ];
    const theme = state.genreTheme || GENRE_THEMES[state.genre] || "";
    return `
      <nav class="music-genre-nav" aria-label="음악 장르">
        ${genres
          .map(
            (g) =>
              `<button type="button" class="music-genre-btn${g.id === state.genre ? " is-active" : ""}" data-music-genre="${g.id}">${escapeHtml(g.label)}</button>`
          )
          .join("")}
      </nav>
      ${theme ? `<p class="music-genre-theme">테마: ${escapeHtml(theme)}</p>` : ""}
    `;
  }

  function renderSearchBar() {
    return `
      <div class="music-search-row">
        <label class="music-search-label" for="music-search-input">검색</label>
        <input
          type="search"
          id="music-search-input"
          class="music-search-input"
          placeholder="제목·아티스트 검색"
          value="${escapeHtml(state.searchQuery)}"
          autocomplete="off"
        >
        <button type="button" class="music-btn" id="music-search-btn">검색</button>
        ${state.searchQuery ? `<button type="button" class="music-btn music-btn-ghost" id="music-search-clear">초기화</button>` : ""}
      </div>
    `;
  }

  function renderApiHint() {
    if (!state.apiStatus) return "";
    const parts = [];
    if (!state.apiStatus.jamendo) parts.push("Jamendo 키 없음 → Openverse만 사용");
    if (!parts.length) return "";
    return `<p class="music-api-hint">${escapeHtml(parts.join(" · "))} · <a href="docs/MUSIC_API_KEYS.md" target="_blank" rel="noopener">API 키 발급 안내</a></p>`;
  }

  function renderLoadingLine() {
    return `<p class="music-loading-line" id="music-loading-line" role="status"${isLoadingVisible() ? "" : " hidden"}>${isLoadingVisible() ? `로딩 중 ${".".repeat(loadingDots)}` : ""}</p>`;
  }

  function renderList() {
    const collapsed = state.listCollapsed && state.selected;
    const countLabel = state.loading ? "" : `조회 ${state.resultCount}곡`;

    if (state.error && !state.tracks.length && !state.loading) {
      return `
        ${renderLoadingLine()}
        <p class="music-status music-status-error" role="alert">${escapeHtml(state.error)}</p>
      `;
    }

    const cards = state.tracks
      .map((track) => {
        const meta = [track.year, ...(track.instruments || []).slice(0, 2)].filter(Boolean).join(" · ");
        const isSel = state.selected?.id === track.id;
        const saved = isInSavedPlaylist(track.id);
        return `
          <article class="music-card${isSel ? " is-selected" : ""}" data-track-id="${escapeHtml(track.id)}">
            <div class="music-card-cover-wrap">${trackCover(track)}</div>
            <div class="music-card-body">
              <h3 class="music-card-title">${escapeHtml(track.title)}</h3>
              <p class="music-card-artist">${escapeHtml(track.artist)}</p>
              ${meta ? `<p class="music-card-meta">${escapeHtml(meta)}</p>` : ""}
              <p class="music-card-license">${escapeHtml(track.license_label || track.license || "")}${track.duration_ms ? ` · ${formatDuration(track.duration_ms)}` : ""}</p>
            </div>
            <div class="music-card-actions">
              <button type="button" class="music-btn music-btn-add-card${saved ? " is-saved" : ""}" data-add-track="${escapeHtml(track.id)}" aria-label="목록에 추가" title="목록에 추가"${saved ? " disabled" : ""}>${saved ? "✓" : "+"}</button>
              <button type="button" class="music-btn music-btn-play-card" data-play-track="${escapeHtml(track.id)}" aria-label="재생">▶</button>
            </div>
          </article>
        `;
      })
      .join("");

    const prevDisabled = state.page <= 1 ? " disabled" : "";
    const nextDisabled = !state.hasMore ? " disabled" : "";

    return `
      <section class="music-list-section${collapsed ? " is-collapsed" : ""}" id="music-list-section">
        <div class="music-list-head">
          <div class="music-list-head-left">
            <h3 class="music-list-title">음악 목록</h3>
            ${countLabel ? `<span class="music-list-count">${escapeHtml(countLabel)}</span>` : ""}
          </div>
          ${collapsed ? `<button type="button" class="music-btn music-btn-ghost" id="music-expand-list">목록 펼치기</button>` : ""}
        </div>
        ${renderLoadingLine()}
        <div class="music-list${collapsed ? " music-list-fold" : ""}">${!state.loading && !cards ? `<p class="music-status">곡이 없습니다.</p>` : cards}</div>
        <nav class="music-pagination" aria-label="음악 목록 페이지">
          <button type="button" class="music-btn" data-music-page="prev"${prevDisabled}>이전</button>
          <span class="music-page-num">${state.page}</span>
          <button type="button" class="music-btn" data-music-page="next"${nextDisabled}>다음</button>
        </nav>
      </section>
    `;
  }

  function renderSavedPlaylist() {
    const n = state.savedTracks.length;
    const items = state.savedTracks
      .map(
        (track, idx) => `
        <li class="music-saved-item" data-saved-id="${escapeHtml(track.id)}">
          <span class="music-saved-num">${idx + 1}</span>
          <div class="music-saved-meta">
            <span class="music-saved-title">${escapeHtml(track.title)}</span>
            <span class="music-saved-artist">${escapeHtml(track.artist)}</span>
          </div>
          <button type="button" class="music-btn music-btn-play-card" data-play-saved="${escapeHtml(track.id)}" aria-label="재생">▶</button>
          <button type="button" class="music-btn music-btn-ghost music-btn-remove-saved" data-remove-saved="${escapeHtml(track.id)}" aria-label="삭제">✕</button>
        </li>
      `
      )
      .join("");

    return `
      <section class="music-saved-section" aria-label="저장 목록">
        <div class="music-saved-head">
          <h3 class="music-saved-title-head">저장 목록 <span class="music-saved-count">${n}곡</span></h3>
          <button type="button" class="music-btn music-btn-primary" id="music-play-saved-all"${n ? "" : " disabled"}>저장 목록 전체 재생</button>
        </div>
        ${n ? `<ol class="music-saved-list">${items}</ol>` : `<p class="music-saved-empty">곡을 선택해 「목록에 추가」하면 여기에 저장됩니다.</p>`}
      </section>
    `;
  }

  function renderPlayer() {
    const t = state.selected;
    if (!t) {
      return `<section class="music-player music-player-empty" aria-label="재생 패널"><p class="music-player-placeholder">목록에서 곡을 선택하면 여기서 재생됩니다.</p></section>`;
    }
    const cover = trackCover(t);
    const saved = isInSavedPlaylist(t.id);
    return `
      <section class="music-player" aria-label="재생 패널">
        <div class="music-now-playing">
          <div class="music-now-cover">${cover}</div>
          <div class="music-now-meta">
            <h3 class="music-now-title">${escapeHtml(t.title)}</h3>
            <p class="music-now-artist">${escapeHtml(t.artist)}</p>
            ${t.year ? `<p class="music-now-year">${escapeHtml(t.year)}</p>` : ""}
            <p class="music-now-license">${escapeHtml(t.attribution || t.license_label || "")}</p>
          </div>
          <div class="music-now-controls">
            <button type="button" class="music-btn" id="music-add-saved-btn"${saved ? " disabled" : ""}>${saved ? "저장됨" : "목록에 추가"}</button>
            <button type="button" class="music-btn music-btn-primary" id="music-play-btn" aria-label="재생/일시정지">${state.playing ? "⏸" : "▶"}</button>
            <button type="button" class="music-btn" id="music-stop-btn" aria-label="정지">⏹</button>
          </div>
        </div>
        <p class="music-player-status" id="music-player-status">${state.playing ? "재생 중" : "일시정지"}</p>
        <div class="music-seek-row">
          <span id="music-time-current">${formatTime(state.currentTime)}</span>
          <input type="range" class="music-seek" id="music-seek" min="0" max="100" value="0" aria-label="재생 위치">
          <span id="music-time-total">${formatTime(state.duration || trackDurationMs(t) / 1000)}</span>
        </div>
        <div class="music-eq" aria-label="이퀄라이저">
          <label class="music-eq-band"><span>저음</span><input type="range" id="music-eq-bass" min="-12" max="12" step="1" value="${state.eq.bass}"></label>
          <label class="music-eq-band"><span>중음</span><input type="range" id="music-eq-mid" min="-12" max="12" step="1" value="${state.eq.mid}"></label>
          <label class="music-eq-band"><span>고음</span><input type="range" id="music-eq-treble" min="-12" max="12" step="1" value="${state.eq.treble}"></label>
        </div>
        <div class="music-viz-wrap">
          <canvas id="music-viz-canvas" class="music-viz-canvas" aria-hidden="true"></canvas>
        </div>
        <p class="music-footnote">사이트 내 스트리밍만 허용 · NC 라이선스 제외 · 출처 표시</p>
      </section>
    `;
  }

  function render() {
    if (!pageRoot) return;
    pageRoot.innerHTML = `
      <article class="content-panel music-panel">
        <header class="music-header">
          <h2>Music</h2>
          <p class="music-intro">Jamendo · Openverse — 상업용 사이트 내 재생(CC0/PD/CC BY·BY-SA)</p>
        </header>
        ${renderGenreNav()}
        ${renderSearchBar()}
        ${renderApiHint()}
        ${renderList()}
        ${renderSavedPlaylist()}
        ${renderPlayer()}
      </article>
    `;
    bindEvents();
    updatePlayerUi();
    updateProgressUi();
    updateLoadingBanner();
    if (state.playing) startViz();
    else drawVisualizer();
  }

  function runSearch() {
    const input = pageRoot?.querySelector("#music-search-input");
    state.searchQuery = (input?.value || "").trim();
    state.page = 1;
    void fetchTracks();
  }

  function bindEvents() {
    if (!pageRoot) return;

    pageRoot.querySelectorAll("[data-music-genre]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const genre = btn.dataset.musicGenre;
        if (!genre || genre === state.genre) return;
        stopPlayback();
        state.genre = genre;
        state.genreTheme = GENRE_THEMES[genre] || "";
        state.page = 1;
        state.searchQuery = "";
        state.selected = null;
        state.listCollapsed = false;
        void fetchTracks();
      });
    });

    const searchInput = pageRoot.querySelector("#music-search-input");
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          runSearch();
        }
      });
      searchInput.addEventListener("input", () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(runSearch, 450);
      });
    }

    pageRoot.querySelector("#music-search-btn")?.addEventListener("click", runSearch);
    pageRoot.querySelector("#music-search-clear")?.addEventListener("click", () => {
      state.searchQuery = "";
      state.page = 1;
      void fetchTracks();
    });

    pageRoot.querySelectorAll("[data-play-track]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.playTrack;
        const track = findTrackById(id);
        if (track) void playTrack(track);
      });
    });

    pageRoot.querySelectorAll("[data-add-track]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.addTrack;
        const track = findTrackById(id);
        if (track && addToSavedPlaylist(track)) render();
      });
    });

    pageRoot.querySelectorAll(".music-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const id = card.dataset.trackId;
        const track = findTrackById(id);
        if (track) void playTrack(track);
      });
    });

    pageRoot.querySelector('[data-music-page="prev"]')?.addEventListener("click", () => {
      if (state.page > 1) {
        state.page -= 1;
        void fetchTracks();
      }
    });

    pageRoot.querySelector('[data-music-page="next"]')?.addEventListener("click", () => {
      if (state.hasMore) {
        state.page += 1;
        void fetchTracks();
      }
    });

    pageRoot.querySelector("#music-expand-list")?.addEventListener("click", () => {
      state.listCollapsed = false;
      render();
    });

    pageRoot.querySelector("#music-play-btn")?.addEventListener("click", togglePlayback);
    pageRoot.querySelector("#music-stop-btn")?.addEventListener("click", () => {
      stopPlayback();
      render();
    });

    pageRoot.querySelector("#music-add-saved-btn")?.addEventListener("click", () => {
      if (state.selected && addToSavedPlaylist(state.selected)) render();
    });

    pageRoot.querySelector("#music-play-saved-all")?.addEventListener("click", () => {
      playAllSaved();
    });

    pageRoot.querySelectorAll("[data-play-saved]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.playSaved;
        const idx = state.savedTracks.findIndex((t) => t.id === id);
        if (idx < 0) return;
        state.playQueue = state.savedTracks.map((t) => ({ ...t }));
        state.queueIndex = idx;
        void playTrack(state.playQueue[idx], { fromQueue: true });
      });
    });

    pageRoot.querySelectorAll("[data-remove-saved]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.removeSaved;
        if (removeFromSavedPlaylist(id)) render();
      });
    });

    const seek = pageRoot.querySelector("#music-seek");
    if (seek) {
      seek.addEventListener("input", () => {
        seekTo(Number(seek.value) / 100);
      });
    }

    const bindEq = (id, key) => {
      const el = pageRoot.querySelector(id);
      if (!el) return;
      el.addEventListener("input", () => {
        state.eq[key] = Number(el.value);
        applyEq();
      });
    };
    bindEq("#music-eq-bass", "bass");
    bindEq("#music-eq-mid", "mid");
    bindEq("#music-eq-treble", "treble");
  }

  function renderPage(container) {
    pageRoot = container;
    loadSavedPlaylist();
    state.genre = "jazz";
    state.genreTheme = GENRE_THEMES.jazz;
    state.page = 1;
    state.searchQuery = "";
    state.selected = null;
    state.listCollapsed = false;
    state.playQueue = null;
    void fetchTracks();
  }

  function destroy() {
    stopLoadingAnimation();
    stopPlayback();
    stopViz();
    clearTimeout(searchDebounce);
    if (audioCtx) {
      void audioCtx.close();
      audioCtx = null;
      sourceNode = null;
      analyser = null;
    }
    audioEl = null;
    pageRoot = null;
  }

  window.Music = { renderPage, destroy };
})();
