(function () {
  const PAGE_SIZE = 10;

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

  const state = {
    genre: "jazz",
    page: 1,
    tracks: [],
    hasMore: false,
    loading: false,
    error: "",
    apiStatus: null,
    selected: null,
    listCollapsed: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    eq: { bass: 0, mid: 0, treble: 0 }
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
    render();
    try {
      const url = `${apiBase()}/api/music/tracks?genre=${encodeURIComponent(state.genre)}&page=${state.page}&limit=${PAGE_SIZE}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `목록 로드 실패 (${res.status})`);
      state.tracks = data.tracks || [];
      state.hasMore = !!data.has_more;
      state.apiStatus = data.api_status || null;
      if (!state.tracks.length) {
        state.error = "이 장르에 표시할 곡이 없습니다. API 키 설정을 확인하세요.";
      }
    } catch (err) {
      state.error = err.message || "목록을 불러오지 못했습니다.";
      state.tracks = [];
    } finally {
      state.loading = false;
      render();
    }
  }

  function streamUrl(track) {
    if (!track?.stream_path) return "";
    return `${apiBase()}${track.stream_path}`;
  }

  async function playTrack(track) {
    if (!track) return;
    state.selected = track;
    state.listCollapsed = true;
    render();
    ensureAudio();
    ensureAudioGraph();
    if (audioCtx?.state === "suspended") {
      await audioCtx.resume();
    }
    const url = streamUrl(track);
    if (!url) return;
    audioEl.pause();
    audioEl.src = url;
    try {
      await audioEl.play();
      state.playing = true;
    } catch {
      state.playing = false;
    }
    updatePlayerUi();
    startViz();
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
      updatePlayerUi();
    });
    audioEl.addEventListener("loadedmetadata", () => {
      state.duration = audioEl.duration || trackDurationMs(state.selected) / 1000;
      updateProgressUi();
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
    state.currentTime = 0;
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
      status.textContent = state.playing ? "재생 중" : state.selected ? "일시정지" : "곡을 선택하세요";
    }
  }

  function renderGenreNav() {
    const genres = [
      { id: "jazz", label: "재즈" },
      { id: "classical", label: "클래식" },
      { id: "pop", label: "팝" }
    ];
    return `
      <nav class="music-genre-nav" aria-label="음악 장르">
        ${genres
          .map(
            (g) =>
              `<button type="button" class="music-genre-btn${g.id === state.genre ? " is-active" : ""}" data-music-genre="${g.id}">${escapeHtml(g.label)}</button>`
          )
          .join("")}
      </nav>
    `;
  }

  function renderApiHint() {
    if (!state.apiStatus) return "";
    const parts = [];
    if (!state.apiStatus.jamendo) parts.push("Jamendo 키 없음 → Openverse만 사용");
    if (!parts.length) return "";
    return `<p class="music-api-hint">${escapeHtml(parts.join(" · "))} · <a href="docs/MUSIC_API_KEYS.md" target="_blank" rel="noopener">API 키 발급 안내</a></p>`;
  }

  function renderList() {
    const collapsed = state.listCollapsed && state.selected;
    if (state.loading) {
      return `<p class="music-status music-status-loading" role="status">목록 불러오는 중</p>`;
    }
    if (state.error && !state.tracks.length) {
      return `<p class="music-status music-status-error" role="alert">${escapeHtml(state.error)}</p>`;
    }
    const cards = state.tracks
      .map((track) => {
        const meta = [track.year, ...(track.instruments || []).slice(0, 2)].filter(Boolean).join(" · ");
        const isSel = state.selected?.id === track.id;
        return `
          <article class="music-card${isSel ? " is-selected" : ""}" data-track-id="${escapeHtml(track.id)}">
            <div class="music-card-cover-wrap">${trackCover(track)}</div>
            <div class="music-card-body">
              <h3 class="music-card-title">${escapeHtml(track.title)}</h3>
              <p class="music-card-artist">${escapeHtml(track.artist)}</p>
              ${meta ? `<p class="music-card-meta">${escapeHtml(meta)}</p>` : ""}
              <p class="music-card-license">${escapeHtml(track.license_label || track.license || "")}${track.duration_ms ? ` · ${formatDuration(track.duration_ms)}` : ""}</p>
            </div>
            <button type="button" class="music-btn music-btn-play-card" data-play-track="${escapeHtml(track.id)}" aria-label="재생">▶</button>
          </article>
        `;
      })
      .join("");

    const prevDisabled = state.page <= 1 ? " disabled" : "";
    const nextDisabled = !state.hasMore ? " disabled" : "";

    return `
      <section class="music-list-section${collapsed ? " is-collapsed" : ""}" id="music-list-section">
        <div class="music-list-head">
          <h3 class="music-list-title">음악 목록</h3>
          ${collapsed ? `<button type="button" class="music-btn music-btn-ghost" id="music-expand-list">목록 펼치기</button>` : ""}
        </div>
        <div class="music-list${collapsed ? " music-list-fold" : ""}">${cards || `<p class="music-status">곡이 없습니다.</p>`}</div>
        <nav class="music-pagination" aria-label="음악 목록 페이지">
          <button type="button" class="music-btn" data-music-page="prev"${prevDisabled}>이전</button>
          <span class="music-page-num">${state.page}</span>
          <button type="button" class="music-btn" data-music-page="next"${nextDisabled}>다음</button>
        </nav>
      </section>
    `;
  }

  function renderPlayer() {
    const t = state.selected;
    if (!t) {
      return `<section class="music-player music-player-empty" aria-label="재생 패널"><p class="music-player-placeholder">목록에서 곡을 선택하면 여기서 재생됩니다.</p></section>`;
    }
    const cover = trackCover(t);
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
        ${renderApiHint()}
        ${renderList()}
        ${renderPlayer()}
      </article>
    `;
    bindEvents();
    updatePlayerUi();
    updateProgressUi();
    if (state.playing) startViz();
    else drawVisualizer();
  }

  function bindEvents() {
    if (!pageRoot) return;

    pageRoot.querySelectorAll("[data-music-genre]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const genre = btn.dataset.musicGenre;
        if (!genre || genre === state.genre) return;
        stopPlayback();
        state.genre = genre;
        state.page = 1;
        state.selected = null;
        state.listCollapsed = false;
        void fetchTracks();
      });
    });

    pageRoot.querySelectorAll("[data-play-track]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.playTrack;
        const track = state.tracks.find((t) => t.id === id);
        if (track) void playTrack(track);
      });
    });

    pageRoot.querySelectorAll(".music-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.trackId;
        const track = state.tracks.find((t) => t.id === id);
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
    state.genre = "jazz";
    state.page = 1;
    state.selected = null;
    state.listCollapsed = false;
    void fetchTracks();
  }

  function destroy() {
    stopPlayback();
    stopViz();
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
