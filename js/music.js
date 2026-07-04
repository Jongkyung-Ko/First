(function () {
  const PAGE_SIZE = 10;
  const PLAYLISTS_STORAGE_KEY = "dw-music-playlists-v2";
  const LEGACY_PLAYLIST_KEY = "dw-music-saved-playlist";
  const VIZ_STYLE_STORAGE_KEY = "dw-music-viz-style";
  const VOLUME_STORAGE_KEY = "dw-music-volume";
  const EQ_STORAGE_KEY = "dw-music-eq-v3";
  const EQ_PRESETS = [
    { id: "flat", label: "Flat", values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { id: "jazz", label: "Jazz", values: [3, 2, 1, 2, 1, 0, 1, 2, 1, 0] },
    { id: "pop", label: "Pop", values: [2, 1, 0, -1, 0, 1, 2, 3, 2, 1] },
    { id: "classical", label: "Classic", values: [0, 0, 0, 0, 0, 0, 1, 2, 2, 1] },
    { id: "rock", label: "Rock", values: [4, 3, 1, 0, -1, 0, 2, 4, 5, 4] },
    { id: "vocal", label: "Vocal", values: [-2, -1, 0, 2, 3, 3, 2, 1, 0, -1] }
  ];
  const EQ_BANDS = [
    { freq: 32, label: "32" },
    { freq: 64, label: "64" },
    { freq: 125, label: "125" },
    { freq: 250, label: "250" },
    { freq: 500, label: "500" },
    { freq: 1000, label: "1k" },
    { freq: 2000, label: "2k" },
    { freq: 4000, label: "4k" },
    { freq: 8000, label: "8k" },
    { freq: 16000, label: "16k" }
  ];
  const GENRE_FALLBACK = [
    {
      id: "jazz",
      label: "재즈",
      theme: "스윙·비밥·재즈 피아노·트리오",
      subthemes: [
        { id: "swing", label: "스윙" },
        { id: "bebop", label: "비밥" },
        { id: "piano", label: "재즈 피아노" },
        { id: "trio", label: "트리오" }
      ]
    },
    {
      id: "classical",
      label: "클래식",
      theme: "오케스트라·피아노·현악·바로크",
      subthemes: [
        { id: "orchestra", label: "오케스트라" },
        { id: "piano", label: "피아노" },
        { id: "strings", label: "현악" },
        { id: "baroque", label: "바로크" }
      ]
    },
    {
      id: "pop",
      label: "팝",
      theme: "팝송·어쿠스틱·일렉트로닉 팝",
      subthemes: [
        { id: "popsong", label: "팝송" },
        { id: "acoustic", label: "어쿠스틱" },
        { id: "electronic", label: "일렉트로닉 팝" },
        { id: "indie", label: "인디" }
      ]
    },
    {
      id: "rock",
      label: "록",
      theme: "얼터너티브·인디·소프트 록",
      subthemes: [
        { id: "alternative", label: "얼터너티브" },
        { id: "indie", label: "인디 록" },
        { id: "soft", label: "소프트 록" }
      ]
    },
    {
      id: "folkhiphop",
      label: "포크·힙합",
      theme: "포크·어쿠스틱·힙합·랩",
      subthemes: [
        { id: "folk", label: "포크" },
        { id: "acoustic", label: "어쿠스틱" },
        { id: "hiphop", label: "힙합" },
        { id: "rap", label: "랩" }
      ]
    }
  ];

  const VIZ_STYLES = [
    { id: 0, icon: "💠", label: "네온 미러" },
    { id: 1, icon: "🌠", label: "갤럭시" },
    { id: 2, icon: "🫧", label: "리퀴드" },
    { id: 3, icon: "🕳", label: "터널" },
    { id: 4, icon: "🌌", label: "오로라+" },
    { id: 5, icon: "✨", label: "파티클" },
    { id: 6, icon: "📊", label: "스펙트럼" },
    { id: 7, icon: "🔶", label: "프리즘" },
    { id: 8, icon: "🚀", label: "하이퍼" },
    { id: 9, icon: "💎", label: "다이아" },
    { id: 10, icon: "💥", label: "노바" },
    { id: 11, icon: "🌊", label: "크롬" }
  ];

  let pageRoot = null;
  let miniPlayerEl = null;
  let miniPlayerBound = false;
  let miniPlayerTrackId = null;
  let miniVizRaf = null;
  let fullscreenOverlay = null;
  let musicFsImmersive = false;
  let musicFsEventsBound = false;
  let audioEl = null;
  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let gainNode = null;
  let eqFilters = [];
  let freqData = null;
  let timeData = null;
  let vizRaf = null;
  let loadingTimer = null;
  let loadingDots = 1;
  let vizParticles = [];
  let musicToastTimer = null;
  let playbackSkipGuard = 0;
  let handlingPlaybackError = false;
  let fsVizSwipeStartX = 0;
  let fsVizKeyHandler = null;

  const PLAYBACK_ERROR_MSGS = {
    1: "재생이 중단되었습니다",
    2: "네트워크 오류",
    3: "디코드 오류",
    4: "형식 미지원"
  };

  const state = {
    genre: "jazz",
    subtheme: "",
    genreTheme: "",
    subthemeLabel: "",
    genresCatalog: null,
    page: 1,
    tracks: [],
    resultCount: 0,
    totalEstimate: 0,
    matchedTotal: 0,
    hasMore: false,
    knownLastPage: null,
    maxPageWithTracks: 0,
    loading: false,
    trackLoading: false,
    searchQuery: "",
    composerSearchLabel: "",
    error: "",
    playbackError: "",
    apiStatus: null,
    selected: null,
    listCollapsed: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    eqPreset: "flat",
    playlists: [],
    activePlaylistId: "",
    playlistsExpanded: false,
    globalBarEnabled: false,
    volume: 1,
    miniVolumeOpen: false,
    playQueue: null,
    queueIndex: 0,
    repeatMode: "off",
    vizStyle: 0,
    vizFullscreen: false
  };

  function apiBase() {
    return window.STOCK_API_URL || "https://first-stock-api.onrender.com";
  }

  function genreList() {
    return state.genresCatalog?.length ? state.genresCatalog : GENRE_FALLBACK;
  }

  function currentGenreMeta() {
    return genreList().find((g) => g.id === state.genre) || genreList()[0];
  }

  function subthemesForGenre(genreId) {
    const meta = genreList().find((g) => g.id === genreId);
    return meta?.subthemes || [];
  }

  async function fetchGenres() {
    try {
      const res = await fetch(`${apiBase()}/api/music/genres`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.genres) && data.genres.length) {
        state.genresCatalog = data.genres;
      }
    } catch {
      /* fallback catalog */
    }
    const meta = currentGenreMeta();
    state.genreTheme = meta?.theme || "";
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

  function loadVolume() {
    const n = parseFloat(localStorage.getItem(VOLUME_STORAGE_KEY) || "1");
    state.volume = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
    if (audioEl) audioEl.volume = state.volume;
  }

  function applyVolume(value) {
    state.volume = Math.max(0, Math.min(1, value));
    if (audioEl) audioEl.volume = state.volume;
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(state.volume));
    } catch {
      /* ignore */
    }
    syncMiniVolumeUi();
    syncFullscreenVolumeUi();
    syncPlayerVolumeUi();
  }

  function syncPlayerVolumeUi() {
    if (!pageRoot) return;
    const slider = pageRoot.querySelector("#music-volume");
    const icon = pageRoot.querySelector(".music-player-volume-icon");
    if (slider) slider.value = String(Math.round(state.volume * 100));
    if (icon) icon.textContent = volumeIcon();
  }

  function loadEq() {
    try {
      const raw = localStorage.getItem(EQ_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === EQ_BANDS.length) {
        state.eq = parsed.map((v) => {
          const n = Number(v);
          return Number.isFinite(n) ? Math.max(-12, Math.min(12, n)) : 0;
        });
        state.eqPreset = "custom";
        return;
      }
      if (parsed && Array.isArray(parsed.bands) && parsed.bands.length === EQ_BANDS.length) {
        state.eq = parsed.bands.map((v) => {
          const n = Number(v);
          return Number.isFinite(n) ? Math.max(-12, Math.min(12, n)) : 0;
        });
        state.eqPreset = EQ_PRESETS.some((p) => p.id === parsed.preset) ? parsed.preset : "custom";
      }
    } catch {
      /* ignore */
    }
  }

  function persistEq() {
    try {
      localStorage.setItem(
        EQ_STORAGE_KEY,
        JSON.stringify({ preset: state.eqPreset || "custom", bands: state.eq })
      );
    } catch {
      /* ignore */
    }
  }

  function resetEq() {
    applyEqPreset("flat");
  }

  function applyEqPreset(presetId) {
    const preset = EQ_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    state.eqPreset = presetId;
    state.eq = preset.values.slice();
    persistEq();
    applyEq();
    syncEqUi();
  }

  function markEqCustom() {
    state.eqPreset = "custom";
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-eq-preset]").forEach((btn) => btn.classList.remove("is-active"));
  }

  function syncEqUi() {
    if (!pageRoot) return;
    EQ_BANDS.forEach((_, i) => {
      const val = state.eq[i] ?? 0;
      const input = pageRoot.querySelector(`#music-eq-${i}`);
      if (input) input.value = String(val);
      updateEqColumnUi(i);
    });
    pageRoot.querySelectorAll("[data-eq-preset]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.eqPreset === state.eqPreset);
    });
  }

  function eqFillHeight(val) {
    return `${Math.max(8, Math.round(((Number(val) + 12) / 24) * 100))}%`;
  }

  function eqDbLabel(val) {
    const n = Number(val) || 0;
    return n > 0 ? `+${n}` : String(n);
  }

  function updateEqColumnUi(index) {
    if (!pageRoot) return;
    const input = pageRoot.querySelector(`#music-eq-${index}`);
    const col = input?.closest(".music-eq-column");
    if (!col) return;
    const fill = col.querySelector(".music-eq-fill");
    const db = col.querySelector(".music-eq-db");
    const val = state.eq[index] ?? 0;
    if (fill) fill.style.height = eqFillHeight(val);
    if (db) db.textContent = eqDbLabel(val);
  }

  function syncFullscreenVolumeUi() {
    if (!fullscreenOverlay || fullscreenOverlay.hidden) return;
    const slider = fullscreenOverlay.querySelector(".music-fs-volume");
    const icon = fullscreenOverlay.querySelector(".music-fs-volume-icon");
    if (slider) slider.value = String(Math.round(state.volume * 100));
    if (icon) icon.textContent = volumeIcon();
  }

  function volumeIcon() {
    if (state.volume <= 0.001) return "🔇";
    if (state.volume < 0.45) return "🔉";
    return "🔊";
  }

  function shouldShowMiniPlayer() {
    return state.globalBarEnabled && state.selected && !pageRoot;
  }

  function stopMiniViz() {
    if (miniVizRaf) {
      cancelAnimationFrame(miniVizRaf);
      miniVizRaf = null;
    }
  }

  function startMiniViz() {
    stopMiniViz();
    if (!shouldShowMiniPlayer()) return;
    const loop = () => {
      if (!shouldShowMiniPlayer()) {
        stopMiniViz();
        return;
      }
      drawOnCanvas(miniPlayerEl?.querySelector("#music-global-viz"));
      miniVizRaf = requestAnimationFrame(loop);
    };
    miniVizRaf = requestAnimationFrame(loop);
  }

  function loadVizStyle() {
    const n = parseInt(localStorage.getItem(VIZ_STYLE_STORAGE_KEY) || "0", 10);
    state.vizStyle = Number.isFinite(n) && n >= 0 && n < VIZ_STYLES.length ? n : 0;
  }

  function saveVizStyle() {
    try {
      localStorage.setItem(VIZ_STYLE_STORAGE_KEY, String(state.vizStyle));
    } catch {
      /* ignore */
    }
  }

  function trackCover(track) {
    if (track.thumbnail) {
      return `<img class="music-card-cover" src="${escapeHtml(track.thumbnail)}" alt="" loading="lazy" decoding="async" onerror="this.classList.add('is-broken')">`;
    }
    const initial = (track.artist || track.title || "?").trim().charAt(0).toUpperCase();
    return `<span class="music-card-cover-fallback" aria-hidden="true">${escapeHtml(initial)}</span>`;
  }

  function newPlaylistId() {
    return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function activePlaylist() {
    return state.playlists.find((p) => p.id === state.activePlaylistId) || state.playlists[0] || null;
  }

  function activeTracks() {
    return activePlaylist()?.tracks || [];
  }

  function loadPlaylists() {
    try {
      const raw = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        state.playlists = Array.isArray(data.playlists) ? data.playlists : [];
        state.activePlaylistId = data.activePlaylistId || "";
      } else {
        const legacyRaw = localStorage.getItem(LEGACY_PLAYLIST_KEY);
        const legacyTracks = legacyRaw ? JSON.parse(legacyRaw) : [];
        const id = newPlaylistId();
        state.playlists = [
          {
            id,
            name: "저장 목록 1",
            tracks: Array.isArray(legacyTracks) ? legacyTracks : []
          }
        ];
        state.activePlaylistId = id;
        persistPlaylists();
      }
    } catch {
      state.playlists = [];
      state.activePlaylistId = "";
    }
    if (!state.playlists.length) {
      const id = newPlaylistId();
      state.playlists = [{ id, name: "내 목록", tracks: [] }];
      state.activePlaylistId = id;
      persistPlaylists();
    }
    if (!state.activePlaylistId || !state.playlists.some((p) => p.id === state.activePlaylistId)) {
      state.activePlaylistId = state.playlists[0].id;
    }
  }

  function persistPlaylists() {
    try {
      localStorage.setItem(
        PLAYLISTS_STORAGE_KEY,
        JSON.stringify({
          playlists: state.playlists,
          activePlaylistId: state.activePlaylistId
        })
      );
    } catch {
      /* ignore */
    }
  }

  function isInActivePlaylist(trackId) {
    return activeTracks().some((t) => t.id === trackId);
  }

  function isInAnyPlaylist(trackId) {
    return state.playlists.some((p) => (p.tracks || []).some((t) => t.id === trackId));
  }

  function addToActivePlaylist(track) {
    const pl = activePlaylist();
    if (!pl || !track?.id || isInActivePlaylist(track.id)) return false;
    pl.tracks.push({ ...track });
    persistPlaylists();
    return true;
  }

  function addAllCurrentTracksToPlaylist() {
    const pl = activePlaylist();
    if (!pl || !state.tracks.length) return 0;
    let added = 0;
    for (const track of state.tracks) {
      if (track?.id && !isInActivePlaylist(track.id)) {
        pl.tracks.push({ ...track });
        added += 1;
      }
    }
    if (added > 0) persistPlaylists();
    return added;
  }

  function addAllCurrentTracksAndPlay() {
    if (!state.tracks.length) return { added: 0, played: false };
    const added = addAllCurrentTracksToPlaylist();
    state.playQueue = state.tracks.map((t) => ({ ...t }));
    state.queueIndex = 0;
    void playTrack(state.playQueue[0], { fromQueue: true });
    return { added, played: true };
  }

  function unsavedTracksInCurrentList() {
    return state.tracks.filter((t) => t?.id && !isInActivePlaylist(t.id));
  }

  function removeFromPlaylist(playlistId, trackId) {
    const pl = state.playlists.find((p) => p.id === playlistId);
    if (!pl) return false;
    const before = pl.tracks.length;
    pl.tracks = pl.tracks.filter((t) => t.id !== trackId);
    if (pl.tracks.length === before) return false;
    persistPlaylists();
    if (state.playQueue) {
      const idx = state.playQueue.findIndex((t) => t.id === trackId);
      state.playQueue = state.playQueue.filter((t) => t.id !== trackId);
      if (!state.playQueue.length) {
        state.playQueue = null;
        state.queueIndex = 0;
      } else if (idx >= 0 && idx < state.queueIndex) {
        state.queueIndex = Math.max(0, state.queueIndex - 1);
      } else if (state.queueIndex >= state.playQueue.length) {
        state.queueIndex = Math.max(0, state.playQueue.length - 1);
      }
    }
    return true;
  }

  function createPlaylist(name) {
    const label = (name || "").trim();
    if (!label) return null;
    const pl = { id: newPlaylistId(), name: label.slice(0, 40), tracks: [] };
    state.playlists.push(pl);
    state.activePlaylistId = pl.id;
    persistPlaylists();
    return pl;
  }

  function deletePlaylist(playlistId) {
    if (state.playlists.length <= 1) return false;
    const idx = state.playlists.findIndex((p) => p.id === playlistId);
    if (idx < 0) return false;
    state.playlists.splice(idx, 1);
    if (state.activePlaylistId === playlistId) {
      state.activePlaylistId = state.playlists[0]?.id || "";
    }
    persistPlaylists();
    return true;
  }

  function playPlaylist(playlistId) {
    const pl = state.playlists.find((p) => p.id === playlistId);
    if (!pl?.tracks?.length) return;
    state.activePlaylistId = pl.id;
    state.playQueue = pl.tracks.map((t) => ({ ...t }));
    state.queueIndex = 0;
    void playTrack(state.playQueue[0], { fromQueue: true });
  }

  function allPlaylistTracks() {
    return state.playlists.flatMap((p) => p.tracks || []);
  }

  function findPlaylistByTrackId(trackId) {
    return state.playlists.find((p) => (p.tracks || []).some((t) => t.id === trackId)) || null;
  }

  function findTrackById(id) {
    return (
      state.tracks.find((t) => t.id === id) ||
      allPlaylistTracks().find((t) => t.id === id) ||
      state.playQueue?.find((t) => t.id === id) ||
      (state.selected?.id === id ? state.selected : null)
    );
  }

  function hasActiveQueue() {
    return (state.playQueue?.length || 0) > 0;
  }

  function startLoadingAnimation() {
    stopLoadingAnimation();
    loadingDots = 1;
    updateLoadingBanner();
    loadingTimer = setInterval(() => {
      loadingDots = loadingDots >= 4 ? 1 : loadingDots + 1;
      updateLoadingBanner();
      updatePlayerUi();
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
    eqFilters = EQ_BANDS.map((band) => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = band.freq;
      filter.Q.value = 1.15;
      filter.gain.value = 0;
      return filter;
    });
    gainNode = audioCtx.createGain();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.frequencyBinCount);
    sourceNode.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    eqFilters[eqFilters.length - 1].connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    applyEq();
  }

  function applyEq() {
    if (!eqFilters.length) return;
    eqFilters.forEach((filter, i) => {
      filter.gain.value = state.eq[i] ?? 0;
    });
  }

  function stopViz() {
    if (vizRaf) {
      cancelAnimationFrame(vizRaf);
      vizRaf = null;
    }
    stopMiniViz();
  }

  function startViz() {
    stopViz();
    if (pageRoot) {
      const loop = () => {
        drawVisualizer();
        vizRaf = requestAnimationFrame(loop);
      };
      vizRaf = requestAnimationFrame(loop);
      return;
    }
    startMiniViz();
  }

  function idleVal(i, n, t) {
    return 0.1 + Math.sin(t / 400 + i * 0.35) * 0.06 + Math.sin(t / 700 + i * 0.12) * 0.04;
  }

  function readAudioData(active) {
    if (active && analyser && freqData) {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);
      return { freq: freqData, time: timeData, active: true };
    }
    return { freq: freqData, time: timeData, active: false };
  }

  function setupCanvas(canvas, ctx) {
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
    return { w, h };
  }

  function vizBand(data, i, bars, t) {
    const idx = Math.floor((i / bars) * data.freq.length);
    return data.active ? data.freq[idx] / 255 : idleVal(i, bars, t);
  }

  function vizHue(i, bars, t, offset) {
    return ((i / bars) * 300 + t / 40 + offset) % 360;
  }

  const VIZ_DRAW = {
    neonMirror(ctx, w, h, data, t) {
      ctx.fillStyle = "#020010";
      ctx.fillRect(0, 0, w, h);
      const bars = 72;
      const mid = w / 2;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < bars; i++) {
        const v = vizBand(data, i, bars, t);
        const bh = Math.max(2, v * h * 0.46);
        const hue = vizHue(i, bars, t, 0);
        const xOff = (i / bars) * mid;
        ctx.shadowBlur = 10 + v * 22;
        ctx.shadowColor = `hsl(${hue}, 100%, 58%)`;
        ctx.fillStyle = `hsla(${hue}, 100%, 62%, 0.88)`;
        ctx.fillRect(mid - xOff - 2, h - bh, 4, bh);
        ctx.fillRect(mid + xOff - 2, h - bh, 4, bh);
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
    },
    galaxy(ctx, w, h, data, t) {
      ctx.fillStyle = "#030818";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      for (let s = 0; s < 120; s++) {
        const v = vizBand(data, s, 120, t);
        const ang = (s / 120) * Math.PI * 2 + t / 5000;
        const rad = (s % 17) * 9 + v * 40 + Math.sin(t / 900 + s) * 8;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        const size = 0.8 + v * 2.8;
        ctx.fillStyle = `hsla(${200 + s * 2}, 90%, ${55 + v * 35}%, ${0.35 + v * 0.55})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      const bass = vizBand(data, 2, 8, t);
      ctx.strokeStyle = `hsla(260, 100%, 72%, ${0.25 + bass * 0.65})`;
      ctx.lineWidth = 2 + bass * 6;
      ctx.shadowBlur = 18 + bass * 30;
      ctx.shadowColor = "#a78bfa";
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * (0.12 + bass * 0.18), 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    },
    liquid(ctx, w, h, data, t) {
      ctx.fillStyle = "#050818";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const blobs = 14;
      for (let i = 0; i < blobs; i++) {
        const v = vizBand(data, i, blobs, t);
        const x = w * (0.12 + (i / blobs) * 0.76) + Math.sin(t / 700 + i * 1.7) * w * 0.04;
        const y = h * 0.5 + Math.cos(t / 850 + i * 2.1) * h * 0.22;
        const rad = 18 + v * Math.min(w, h) * 0.14;
        const hue = vizHue(i, blobs, t, 40);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.85)`);
        g.addColorStop(0.55, `hsla(${hue + 40}, 95%, 55%, 0.35)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    },
    tunnel(ctx, w, h, data, t) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const rings = 18;
      for (let r = rings; r >= 0; r--) {
        const v = vizBand(data, r, rings, t);
        const scale = (r + 1) / rings;
        const rw = w * scale * 0.92;
        const rh = h * scale * 0.55;
        const hue = vizHue(r, rings, t, 180);
        ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${0.08 + v * 0.55})`;
        ctx.lineWidth = 1 + v * 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rw / 2, rh / 2, t / 4000, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    auroraPlus(ctx, w, h, data, t) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(1, "#0f172a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "screen";
      for (let layer = 0; layer < 4; layer++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const fi = Math.floor((x / w) * data.freq.length);
          const v = data.active ? data.freq[fi] / 255 : idleVal(x + layer, w, t);
          const y = h * (0.35 + layer * 0.08) + Math.sin(x / (40 + layer * 10) + t / (500 + layer * 90)) * (24 + v * h * 0.28);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const hue = 140 + layer * 35 + t / 120;
        ctx.fillStyle = `hsla(${hue % 360}, 95%, 58%, ${0.12 + layer * 0.06})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    },
    particleStorm(ctx, w, h, data, t) {
      ctx.fillStyle = "rgba(2, 6, 23, 0.22)";
      ctx.fillRect(0, 0, w, h);
      if (vizParticles.length < 64) {
        vizParticles = Array.from({ length: 64 }, (_, i) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          hue: i * 6
        }));
      }
      ctx.globalCompositeOperation = "lighter";
      vizParticles.forEach((p, i) => {
        const v = vizBand(data, i, vizParticles.length, t);
        p.x += p.vx * (0.6 + v * 2.2);
        p.y += p.vy * (0.6 + v * 2.2);
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        const rad = 1.5 + v * 5;
        ctx.shadowBlur = 8 + v * 16;
        ctx.shadowColor = `hsl(${(p.hue + t / 40) % 360}, 100%, 65%)`;
        ctx.fillStyle = `hsla(${(p.hue + t / 40) % 360}, 100%, 70%, ${0.45 + v * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
    },
    spectrum(ctx, w, h, data, t) {
      ctx.fillStyle = "#04040f";
      ctx.fillRect(0, 0, w, h);
      const bars = 48;
      const barW = w / bars;
      const mid = h / 2;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < bars; i++) {
        const v = vizBand(data, i, bars, t);
        const bh = Math.max(3, v * mid * 0.92);
        const hue = vizHue(i, bars, t, 0);
        const x = i * barW;
        const g = ctx.createLinearGradient(x, mid - bh, x, mid + bh);
        g.addColorStop(0, `hsla(${hue}, 100%, 65%, 0.95)`);
        g.addColorStop(0.5, `hsla(${hue + 30}, 100%, 55%, 0.75)`);
        g.addColorStop(1, `hsla(${hue}, 100%, 65%, 0.95)`);
        ctx.fillStyle = g;
        ctx.fillRect(x + 1, mid - bh, barW - 2, bh * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    },
    prism(ctx, w, h, data, t) {
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const rays = 36;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < rays; i++) {
        const v = vizBand(data, i, rays, t);
        const ang = (i / rays) * Math.PI * 2 + t / 3000;
        const len = 30 + v * Math.min(w, h) * 0.48;
        const hue = vizHue(i, rays, t, i * 8);
        ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${0.2 + v * 0.75})`;
        ctx.lineWidth = 2 + v * 5;
        ctx.shadowBlur = 6 + v * 14;
        ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
    },
    hyperdrive(ctx, w, h, data, t) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const lines = 80;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < lines; i++) {
        const v = vizBand(data, i, lines, t);
        const ang = (i / lines) * Math.PI * 2;
        const len = 20 + v * Math.min(w, h) * 0.55;
        const x0 = cx + Math.cos(ang) * 8;
        const y0 = cy + Math.sin(ang) * 8;
        const x1 = cx + Math.cos(ang) * len;
        const y1 = cy + Math.sin(ang) * len;
        const hue = vizHue(i, lines, t, t / 20);
        ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${0.15 + v * 0.8})`;
        ctx.lineWidth = 1 + v * 2.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    },
    diamond(ctx, w, h, data, t) {
      ctx.fillStyle = "#080818";
      ctx.fillRect(0, 0, w, h);
      const cols = 12;
      const rows = 8;
      const cellW = w / cols;
      const cellH = h / rows;
      ctx.globalCompositeOperation = "lighter";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const v = vizBand(data, i, cols * rows, t);
          const size = cellW * 0.28 * (0.35 + v);
          const x = c * cellW + cellW / 2;
          const y = r * cellH + cellH / 2;
          const hue = vizHue(i, cols * rows, t, 0);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4 + t / 2500 + v);
          ctx.fillStyle = `hsla(${hue}, 95%, ${50 + v * 35}%, ${0.35 + v * 0.6})`;
          ctx.shadowBlur = 8 + v * 12;
          ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
        }
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
    },
    nova(ctx, w, h, data, t) {
      ctx.fillStyle = "rgba(2, 4, 16, 0.25)";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const bursts = 10;
      ctx.globalCompositeOperation = "lighter";
      for (let b = 0; b < bursts; b++) {
        const v = vizBand(data, b, bursts, t);
        const phase = (t / (700 + b * 80) + b) % 1;
        const rad = phase * Math.min(w, h) * 0.45 * (0.35 + v);
        const hue = vizHue(b, bursts, t, b * 30);
        ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${(1 - phase) * (0.25 + v * 0.65)})`;
        ctx.lineWidth = 2 + v * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    },
    chrome(ctx, w, h, data, t) {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#0a1020");
      bg.addColorStop(1, "#101828");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const mid = h / 2;
      for (let layer = 0; layer < 4; layer++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const fi = Math.floor((x / w) * data.freq.length);
          const v = data.active ? data.freq[fi] / 255 : idleVal(x + layer, w, t);
          const y = mid + Math.sin(x / (22 + layer * 6) + t / (280 + layer * 70) + layer) * (16 + v * h * 0.34);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const alpha = 0.35 + layer * 0.12;
        ctx.strokeStyle = `rgba(${180 + layer * 15}, ${210 + layer * 10}, 255, ${alpha})`;
        ctx.lineWidth = 2 + layer * 0.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(147, 197, 253, 0.6)";
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
  };

  const VIZ_FN = [
    VIZ_DRAW.neonMirror,
    VIZ_DRAW.galaxy,
    VIZ_DRAW.liquid,
    VIZ_DRAW.tunnel,
    VIZ_DRAW.auroraPlus,
    VIZ_DRAW.particleStorm,
    VIZ_DRAW.spectrum,
    VIZ_DRAW.prism,
    VIZ_DRAW.hyperdrive,
    VIZ_DRAW.diamond,
    VIZ_DRAW.nova,
    VIZ_DRAW.chrome
  ];
  function drawOnCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = setupCanvas(canvas, ctx);
    const active = state.playing && analyser && freqData;
    const data = readAudioData(active);
    const fn = VIZ_FN[state.vizStyle] || VIZ_FN[0];
    fn(ctx, w, h, data, Date.now());
  }

  function drawVisualizer() {
    if (state.vizFullscreen && fullscreenOverlay && !fullscreenOverlay.hidden) {
      drawOnCanvas(fullscreenOverlay.querySelector("#music-viz-canvas-fs"));
      return;
    }
    if (!pageRoot) return;
    drawOnCanvas(pageRoot.querySelector("#music-viz-canvas"));
  }

  function renderVizPicker() {
    return `
      <div class="music-viz-picker" role="radiogroup" aria-label="비주얼라이저 스타일">
        ${VIZ_STYLES.map(
          (s) =>
            `<button type="button" class="music-viz-icon-btn${state.vizStyle === s.id ? " is-active" : ""}" data-viz-style="${s.id}" title="${escapeHtml(s.label)}" aria-label="${escapeHtml(s.label)}" aria-pressed="${state.vizStyle === s.id}">${s.icon}</button>`
        ).join("")}
      </div>
    `;
  }

  function currentVizMeta() {
    return VIZ_STYLES[state.vizStyle] || VIZ_STYLES[0];
  }

  function updateFullscreenVizLabel() {
    if (!fullscreenOverlay || fullscreenOverlay.hidden) return;
    const label = fullscreenOverlay.querySelector(".music-fs-viz-label");
    const meta = currentVizMeta();
    if (label) label.textContent = `${meta.icon} ${meta.label}`;
  }

  function updateVizStyleUi() {
    if (pageRoot) {
      pageRoot.querySelectorAll("[data-viz-style]").forEach((btn) => {
        const id = parseInt(btn.dataset.vizStyle, 10);
        const active = id === state.vizStyle;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    updateFullscreenVizLabel();
  }

  function cycleVizStyle(delta) {
    const n = VIZ_STYLES.length;
    if (!n) return;
    state.vizStyle = (state.vizStyle + delta + n) % n;
    saveVizStyle();
    vizParticles = [];
    updateVizStyleUi();
    const meta = currentVizMeta();
    showMusicToast(`${meta.icon} ${meta.label}`);
  }

  function bindFsVizNav() {
    if (!fullscreenOverlay || fullscreenOverlay.dataset.vizNavBound) return;
    fullscreenOverlay.dataset.vizNavBound = "1";

    fullscreenOverlay.querySelector("[data-action='viz-prev']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      cycleVizStyle(-1);
    });
    fullscreenOverlay.querySelector("[data-action='viz-next']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      cycleVizStyle(1);
    });

    const canvas = fullscreenOverlay.querySelector("#music-viz-canvas-fs");
    const onEnd = (x) => {
      const dx = x - fsVizSwipeStartX;
      if (Math.abs(dx) < 48) return;
      cycleVizStyle(dx < 0 ? 1 : -1);
    };
    canvas?.addEventListener(
      "touchstart",
      (e) => {
        fsVizSwipeStartX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    canvas?.addEventListener(
      "touchend",
      (e) => {
        onEnd(e.changedTouches[0].clientX);
      },
      { passive: true }
    );
    canvas?.addEventListener("mousedown", (e) => {
      fsVizSwipeStartX = e.clientX;
    });
    canvas?.addEventListener("mouseup", (e) => {
      onEnd(e.clientX);
    });

    if (!fsVizKeyHandler) {
      fsVizKeyHandler = (e) => {
        if (!state.vizFullscreen || fullscreenOverlay?.hidden) return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          cycleVizStyle(-1);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          cycleVizStyle(1);
        }
      };
      document.addEventListener("keydown", fsVizKeyHandler);
    }
  }

  function renderFullscreenTransport() {
    const hasQueue = hasActiveQueue();
    const canPrev = hasQueue && (state.queueIndex > 0 || state.repeatMode === "all");
    const canNext = hasQueue;
    return `
      <div class="music-transport music-transport-fs" aria-label="재생 제어">
        <button type="button" class="music-transport-btn" data-action="prev" title="이전 곡" aria-label="이전 곡"${canPrev ? "" : " disabled"}>⏮</button>
        <button type="button" class="music-transport-btn music-transport-play" data-action="toggle-play" title="재생/일시정지" aria-label="재생/일시정지">${state.playing ? "⏸" : "▶"}</button>
        <button type="button" class="music-transport-btn" data-action="next" title="다음 곡" aria-label="다음 곡"${canNext ? "" : " disabled"}>⏭</button>
        <button type="button" class="music-transport-btn" data-action="stop" title="정지" aria-label="정지">⏹</button>
        <label class="music-fs-volume-wrap">
          <span class="music-fs-volume-icon" aria-hidden="true">${volumeIcon()}</span>
          <input type="range" class="music-fs-volume" data-action="volume" min="0" max="100" value="${Math.round(state.volume * 100)}" aria-label="볼륨">
        </label>
      </div>
    `;
  }

  function renderTransportBar(extraClass = "") {
    const hasQueue = hasActiveQueue();
    const canPrev = hasQueue && (state.queueIndex > 0 || state.repeatMode === "all");
    const canNext = hasQueue;
    return `
      <div class="music-transport ${extraClass}" aria-label="재생 제어">
        <button type="button" class="music-transport-btn" data-action="prev" title="이전 곡" aria-label="이전 곡"${canPrev ? "" : " disabled"}>⏮</button>
        <button type="button" class="music-transport-btn music-transport-play" data-action="toggle-play" title="재생/일시정지" aria-label="재생/일시정지">${state.playing ? "⏸" : "▶"}</button>
        <button type="button" class="music-transport-btn" data-action="next" title="다음 곡" aria-label="다음 곡"${canNext ? "" : " disabled"}>⏭</button>
        <button type="button" class="music-transport-btn${state.repeatMode === "one" ? " is-active" : ""}" data-action="repeat-one" title="한 곡 반복" aria-label="한 곡 반복" aria-pressed="${state.repeatMode === "one"}">🔂</button>
        <button type="button" class="music-transport-btn${state.repeatMode === "all" ? " is-active" : ""}" data-action="repeat-all" title="전체 반복" aria-label="전체 반복" aria-pressed="${state.repeatMode === "all"}">🔁</button>
      </div>
    `;
  }

  function ensureFullscreenOverlay() {
    if (fullscreenOverlay) return;
    fullscreenOverlay = document.createElement("div");
    fullscreenOverlay.id = "music-viz-fullscreen";
    fullscreenOverlay.className = "music-viz-fullscreen";
    fullscreenOverlay.hidden = true;
    fullscreenOverlay.innerHTML = `
      <button type="button" class="music-fs-close" data-action="fs-close" aria-label="닫기">✕</button>
      <button type="button" class="music-fs-viz-nav music-fs-viz-prev" data-action="viz-prev" aria-label="이전 비주얼">‹</button>
      <button type="button" class="music-fs-viz-nav music-fs-viz-next" data-action="viz-next" aria-label="다음 비주얼">›</button>
      <p class="music-fs-viz-label" aria-live="polite"></p>
      <canvas id="music-viz-canvas-fs" class="music-viz-canvas-fs" aria-hidden="true"></canvas>
      <div class="music-fs-bottom">
        <div class="music-fs-meta">
          <p class="music-fs-title"></p>
          <p class="music-fs-artist"></p>
        </div>
        <div class="music-fs-transport-slot"></div>
      </div>
    `;
    document.body.appendChild(fullscreenOverlay);
    fullscreenOverlay.querySelector("[data-action='fs-close']")?.addEventListener("click", closeVizFullscreen);
    fullscreenOverlay.addEventListener("click", (e) => {
      if (e.target === fullscreenOverlay) closeVizFullscreen();
    });
    bindTransportControls(fullscreenOverlay);
    bindFsVizNav();
  }

  function getMusicFsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function bindMusicFsEvents() {
    if (musicFsEventsBound) return;
    musicFsEventsBound = true;
    document.addEventListener("fullscreenchange", onMusicFsFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onMusicFsFullscreenChange);
  }

  function onMusicFsFullscreenChange() {
    if (!fullscreenOverlay) return;
    if (getMusicFsElement() === fullscreenOverlay) {
      fullscreenOverlay.classList.add("is-immersive");
      musicFsImmersive = true;
      document.documentElement.classList.add("music-viz-immersive-lock");
      return;
    }
    if (state.vizFullscreen) {
      void closeVizFullscreen();
      return;
    }
    fullscreenOverlay.classList.remove("is-immersive");
    document.documentElement.classList.remove("music-viz-immersive-lock");
    musicFsImmersive = false;
  }

  async function enterMusicFsImmersive() {
    if (!fullscreenOverlay) return;
    try {
      if (fullscreenOverlay.requestFullscreen) await fullscreenOverlay.requestFullscreen();
      else if (fullscreenOverlay.webkitRequestFullscreen) await fullscreenOverlay.webkitRequestFullscreen();
      else throw new Error("fullscreen unsupported");
      fullscreenOverlay.classList.add("is-immersive");
      musicFsImmersive = true;
      document.documentElement.classList.add("music-viz-immersive-lock");
    } catch {
      fullscreenOverlay.classList.add("is-immersive");
      document.documentElement.classList.add("music-viz-immersive-lock");
      musicFsImmersive = true;
    }
  }

  async function exitMusicFsImmersive() {
    const fsEl = getMusicFsElement();
    if (fsEl) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch {
        /* ignore */
      }
    }
    if (fullscreenOverlay) fullscreenOverlay.classList.remove("is-immersive");
    document.documentElement.classList.remove("music-viz-immersive-lock");
    musicFsImmersive = false;
  }

  async function openVizFullscreen() {
    if (!state.selected) {
      showMusicToast("재생 중인 곡이 없습니다");
      return;
    }
    ensureFullscreenOverlay();
    bindMusicFsEvents();
    state.vizFullscreen = true;
    fullscreenOverlay.hidden = false;
    document.body.classList.add("music-viz-fs-open");
    updateFullscreenUi();
    startViz();
    await enterMusicFsImmersive();
  }

  async function closeVizFullscreen() {
    state.vizFullscreen = false;
    await exitMusicFsImmersive();
    if (fullscreenOverlay) fullscreenOverlay.hidden = true;
    document.body.classList.remove("music-viz-fs-open");
    if (state.playing || state.selected) startViz();
    else drawVisualizer();
  }

  function updateFullscreenUi() {
    if (!fullscreenOverlay || fullscreenOverlay.hidden) return;
    const t = state.selected;
    const title = fullscreenOverlay.querySelector(".music-fs-title");
    const artist = fullscreenOverlay.querySelector(".music-fs-artist");
    const slot = fullscreenOverlay.querySelector(".music-fs-transport-slot");
    if (title) title.textContent = t?.title || "";
    if (artist) artist.textContent = t?.artist || "";
    if (slot) slot.innerHTML = renderFullscreenTransport();
    bindTransportControls(fullscreenOverlay);
    updateFullscreenVizLabel();
    syncFullscreenVolumeUi();
  }

  function bindTransportControls(root) {
    if (!root) return;
    root.querySelector('[data-action="prev"]')?.addEventListener("click", playPrevious);
    root.querySelector('[data-action="next"]')?.addEventListener("click", () => playNext(true));
    root.querySelector('[data-action="toggle-play"]')?.addEventListener("click", togglePlayback);
    root.querySelector('[data-action="stop"]')?.addEventListener("click", stopPlayback);
    root.querySelector('[data-action="repeat-one"]')?.addEventListener("click", () => {
      state.repeatMode = state.repeatMode === "one" ? "off" : "one";
      refreshTransportUi();
    });
    root.querySelector('[data-action="repeat-all"]')?.addEventListener("click", () => {
      state.repeatMode = state.repeatMode === "all" ? "off" : "all";
      refreshTransportUi();
    });
    const vol = root.querySelector('[data-action="volume"], .music-fs-volume');
    if (vol) {
      vol.addEventListener("input", () => applyVolume(Number(vol.value) / 100));
    }
  }

  function refreshTransportUi() {
    const slot = pageRoot?.querySelector("#music-transport-slot");
    if (slot) {
      slot.innerHTML = hasActiveQueue() ? renderTransportBar() : "";
      bindTransportControls(pageRoot);
    }
    updateFullscreenUi();
  }

  function handleTrackEnded() {
    state.playing = false;
    if (state.repeatMode === "one" && state.selected && audioEl) {
      audioEl.currentTime = 0;
      void audioEl.play();
      return;
    }
    if (state.playQueue?.length) {
      const next = state.queueIndex + 1;
      if (next >= state.playQueue.length) {
        if (state.repeatMode === "all") {
          state.queueIndex = 0;
          void playTrack(state.playQueue[0], { fromQueue: true });
        } else {
          updatePlayerUi();
          updateFullscreenUi();
        }
      } else {
        state.queueIndex = next;
        void playTrack(state.playQueue[next], { fromQueue: true });
      }
      return;
    }
    updatePlayerUi();
    updateFullscreenUi();
  }

  function playPrevious() {
    const q = state.playQueue;
    if (!q?.length) return;
    let prev = state.queueIndex - 1;
    if (prev < 0) {
      if (state.repeatMode === "all") prev = q.length - 1;
      else return;
    }
    state.queueIndex = prev;
    void playTrack(q[prev], { fromQueue: true });
  }

  function playNext(manual) {
    const q = state.playQueue;
    if (!q?.length) return;
    let next = state.queueIndex + 1;
    if (next >= q.length) {
      if (state.repeatMode === "all") next = 0;
      else if (manual) return;
      else return handleTrackEnded();
    }
    state.queueIndex = next;
    void playTrack(q[next], { fromQueue: true });
  }

  async function requestTracksPage(page) {
    const params = new URLSearchParams({
      genre: state.genre,
      page: String(page),
      limit: String(PAGE_SIZE)
    });
    const q = state.searchQuery.trim();
    if (q) params.set("q", q);
    if (state.subtheme) params.set("subtheme", state.subtheme);
    const url = `${apiBase()}/api/music/tracks?${params}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `목록 로드 실패 (${res.status})`);
    return data;
  }

  function resetPaginationBounds() {
    state.knownLastPage = null;
    state.maxPageWithTracks = 0;
  }

  function applyTracksResponse(data, page) {
    state.page = page;
    state.tracks = data.tracks || [];
    state.resultCount = data.result_count ?? state.tracks.length;
    state.totalEstimate = data.total_estimate ?? state.tracks.length;
    state.matchedTotal = data.matched_total ?? state.tracks.length;
    state.genreTheme = data.genre_theme || currentGenreMeta()?.theme || "";
    state.subthemeLabel = data.subtheme_label || "";
    state.hasMore = !!data.has_more;
    state.apiStatus = data.api_status || null;
    if (state.tracks.length) {
      state.maxPageWithTracks = Math.max(state.maxPageWithTracks || 0, page);
    }
    if (!state.hasMore && state.tracks.length) {
      state.knownLastPage = page;
    }
  }

  function showMusicToast(message) {
    let el = document.getElementById("music-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "music-toast";
      el.className = "music-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(musicToastTimer);
    musicToastTimer = setTimeout(() => {
      el.classList.remove("is-visible");
    }, 2200);
  }

  async function goToLastPage() {
    if (!state.hasMore) {
      showMusicToast("맨 끝입니다");
      return;
    }

    state.loading = true;
    state.error = "";
    startLoadingAnimation();
    render();

    try {
      let page = Math.max(state.page, getLastPage());
      let data = await requestTracksPage(page);

      while (!data.tracks?.length && page > 1) {
        page -= 1;
        data = await requestTracksPage(page);
      }

      if (!data.tracks?.length) {
        throw new Error("목록을 불러오지 못했습니다.");
      }

      while (data.has_more) {
        const nextPage = page + 1;
        const nextData = await requestTracksPage(nextPage);
        if (!nextData.tracks?.length) break;
        page = nextPage;
        data = nextData;
      }

      applyTracksResponse(data, page);
      state.knownLastPage = page;
      state.error = "";
    } catch (err) {
      state.error = err.message || "목록을 불러오지 못했습니다.";
      state.tracks = [];
      state.resultCount = 0;
      state.totalEstimate = 0;
      state.matchedTotal = 0;
    } finally {
      state.loading = false;
      stopLoadingAnimation();
      render();
      showMusicToast("맨 끝입니다");
    }
  }

  async function fetchTracks() {
    state.loading = true;
    state.error = "";
    startLoadingAnimation();
    render();
    try {
      const requestedPage = state.page;
      const data = await requestTracksPage(requestedPage);

      if (!data.tracks?.length && requestedPage > 1) {
        state.knownLastPage = requestedPage - 1;
        const prevData = await requestTracksPage(requestedPage - 1);
        applyTracksResponse(prevData, requestedPage - 1);
        state.error = "";
        showMusicToast("맨 끝입니다");
        return;
      }

      applyTracksResponse(data, requestedPage);
      const q = state.searchQuery.trim();
      if (!state.tracks.length) {
        state.error = q
          ? `"${q}" 검색 결과가 없습니다.`
          : "이 장르에 표시할 곡이 없습니다. API 키 설정을 확인하세요.";
      }
    } catch (err) {
      state.error = err.message || "목록을 불러오지 못했습니다.";
      state.tracks = [];
      state.resultCount = 0;
      state.totalEstimate = 0;
      state.matchedTotal = 0;
    } finally {
      state.loading = false;
      stopLoadingAnimation();
      render();
    }
  }

  function getPlaybackErrorMessage(code) {
    return PLAYBACK_ERROR_MSGS[code] || "재생 오류";
  }

  function shouldAutoSkipPlaybackMessage(message) {
    return (
      message === "형식 미지원" ||
      message === "디코드 오류" ||
      message === "네트워크 오류" ||
      message === "오디오 로드 시간 초과" ||
      message === "오디오를 불러오지 못했습니다"
    );
  }

  function buildBrowseQueueForTrack(track) {
    if (!track?.id || state.tracks.length <= 1) {
      state.playQueue = null;
      state.queueIndex = 0;
      return;
    }
    const idx = state.tracks.findIndex((t) => t.id === track.id);
    if (idx < 0) {
      state.playQueue = null;
      state.queueIndex = 0;
      return;
    }
    state.playQueue = state.tracks.map((t) => ({ ...t }));
    state.queueIndex = idx;
  }

  function tryAutoSkipToNextTrack(reason) {
    const q = state.playQueue;
    if (!q?.length) return false;

    playbackSkipGuard += 1;
    if (playbackSkipGuard > q.length) {
      playbackSkipGuard = 0;
      return false;
    }

    let next = state.queueIndex + 1;
    if (next >= q.length) {
      if (state.repeatMode === "all") next = 0;
      else return false;
    }

    if (reason) showMusicToast(`${reason} · 다음 곡`);
    state.queueIndex = next;
    void playTrack(q[next], { fromQueue: true });
    return true;
  }

  function handlePlaybackError(message, options = {}) {
    const { autoSkip = true } = options;
    if (handlingPlaybackError) return;
    handlingPlaybackError = true;
    try {
      state.playing = false;
      state.trackLoading = false;
      if (!state.loading) stopLoadingAnimation();
      updateLoadingBanner();

      if (autoSkip && shouldAutoSkipPlaybackMessage(message) && tryAutoSkipToNextTrack(message)) {
        state.playbackError = "";
        return;
      }

      state.playbackError = message || "재생 오류";
      updatePlayerUi();
      updateFullscreenUi();
      syncMiniPlayerControls();
      updateMiniPlayerUi();
    } finally {
      handlingPlaybackError = false;
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
        reject(new Error(getPlaybackErrorMessage(el.error?.code) || "오디오를 불러오지 못했습니다"));
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
      buildBrowseQueueForTrack(track);
      playbackSkipGuard = 0;
    }
    state.selected = track;
    state.globalBarEnabled = true;
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
      playbackSkipGuard = 0;
    } catch (err) {
      handlePlaybackError(err.message || "재생할 수 없습니다");
    } finally {
      state.trackLoading = false;
      if (!state.loading) stopLoadingAnimation();
      updateLoadingBanner();
    }
    updatePlayerUi();
    updateFullscreenUi();
    syncMiniPlayerControls();
    updateMiniPlayerUi();
    if (state.playing) startViz();
  }

  function playActivePlaylist() {
    const pl = activePlaylist();
    if (!pl?.tracks?.length) return;
    playPlaylist(pl.id);
  }

  function ensureAudio() {
    if (audioEl) return;
    ensureMiniPlayer();
    loadVolume();
    audioEl = new Audio();
    audioEl.crossOrigin = "anonymous";
    audioEl.preload = "metadata";
    audioEl.volume = state.volume;
    audioEl.addEventListener("play", () => {
      state.playing = true;
      state.globalBarEnabled = true;
      updatePlayerUi();
      updateFullscreenUi();
      syncMiniPlayerControls();
      startViz();
    });
    audioEl.addEventListener("pause", () => {
      state.playing = false;
      updatePlayerUi();
      updateFullscreenUi();
      syncMiniPlayerControls();
    });
    audioEl.addEventListener("timeupdate", () => {
      state.currentTime = audioEl.currentTime;
      state.duration = audioEl.duration || 0;
      updateProgressUi();
    });
    audioEl.addEventListener("ended", handleTrackEnded);
    audioEl.addEventListener("loadedmetadata", () => {
      state.duration = audioEl.duration || trackDurationMs(state.selected) / 1000;
      updateProgressUi();
    });
    audioEl.addEventListener("error", () => {
      handlePlaybackError(getPlaybackErrorMessage(audioEl.error?.code));
    });
  }

  function trackDurationMs(track) {
    return track?.duration_ms || 0;
  }

  function pausePlayback() {
    audioEl?.pause();
    state.playing = false;
    updatePlayerUi();
    updateFullscreenUi();
  }

  function togglePlayback() {
    if (!audioEl || !state.selected) return;
    if (state.playing) pausePlayback();
    else void audioEl.play();
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
    state.selected = null;
    state.globalBarEnabled = false;
    state.miniVolumeOpen = false;
    state.currentTime = 0;
    if (!state.loading) stopLoadingAnimation();
    updatePlayerUi();
    updateFullscreenUi();
    updateMiniPlayerUi();
    stopViz();
    if (pageRoot) render();
  }

  function getGlobalBarsHost() {
    if (typeof window.mountGlobalBarsHost === "function") {
      return window.mountGlobalBarsHost();
    }
    let host = document.getElementById("app-global-bars");
    if (!host) {
      host = document.createElement("div");
      host.id = "app-global-bars";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    return host;
  }

  function ensureMiniPlayer() {
    const host = getGlobalBarsHost();
    if (miniPlayerEl) {
      if (miniPlayerEl.parentElement !== host) host.appendChild(miniPlayerEl);
      return;
    }
    miniPlayerEl = document.createElement("div");
    miniPlayerEl.id = "music-global-bar";
    miniPlayerEl.className = "music-global-bar is-hidden";
    miniPlayerEl.setAttribute("role", "region");
    miniPlayerEl.setAttribute("aria-label", "음악 재생");
    host.appendChild(miniPlayerEl);
  }

  function bindMiniPlayerEvents() {
    if (!miniPlayerEl || miniPlayerBound) return;
    miniPlayerBound = true;
    miniPlayerEl.addEventListener("click", (e) => {
      if (e.target.closest("#music-global-volume") || e.target.closest(".music-global-volume-pop")) {
        return;
      }
      const go = e.target.closest("[data-music-global-go]");
      if (go) {
        document.querySelector('[data-page="music"]')?.click();
        return;
      }
      if (e.target.closest("#music-global-prev")) {
        playPrevious();
        syncMiniPlayerControls();
        return;
      }
      if (e.target.closest("#music-global-next")) {
        playNext(true);
        syncMiniPlayerControls();
        return;
      }
      if (e.target.closest("#music-global-play")) {
        togglePlayback();
        syncMiniPlayerControls();
        return;
      }
      if (e.target.closest("#music-global-volume-btn")) {
        state.miniVolumeOpen = !state.miniVolumeOpen;
        syncMiniVolumeUi();
        return;
      }
      if (e.target.closest("#music-global-close")) {
        shutdown();
      }
    });
    miniPlayerEl.addEventListener("input", (e) => {
      if (e.target.id === "music-global-volume") {
        applyVolume(Number(e.target.value) / 100);
      }
    });
    document.addEventListener("click", (e) => {
      if (!state.miniVolumeOpen || !miniPlayerEl) return;
      if (miniPlayerEl.contains(e.target)) return;
      state.miniVolumeOpen = false;
      syncMiniVolumeUi();
    });
  }

  function syncMiniPlayerControls() {
    if (!miniPlayerEl || miniPlayerEl.classList.contains("is-hidden")) return;
    const playBtn = miniPlayerEl.querySelector("#music-global-play");
    if (playBtn) playBtn.textContent = state.playing ? "⏸" : "▶";
    const prev = miniPlayerEl.querySelector("#music-global-prev");
    const next = miniPlayerEl.querySelector("#music-global-next");
    const hasQueue = hasActiveQueue();
    const canPrev = hasQueue && (state.queueIndex > 0 || state.repeatMode === "all");
    if (prev) prev.disabled = !canPrev;
    if (next) next.disabled = !hasQueue;
  }

  function syncMiniVolumeUi() {
    if (!miniPlayerEl) return;
    const btn = miniPlayerEl.querySelector("#music-global-volume-btn");
    const pop = miniPlayerEl.querySelector("#music-global-volume-pop");
    const slider = miniPlayerEl.querySelector("#music-global-volume");
    if (btn) btn.textContent = volumeIcon();
    if (pop) pop.classList.toggle("is-open", !!state.miniVolumeOpen);
    if (slider) slider.value = String(Math.round(state.volume * 100));
  }

  function renderMiniPlayerContent() {
    if (!miniPlayerEl || !state.selected) return;
    const t = state.selected;
    const queueLabel = state.playQueue?.length
      ? ` · ${state.queueIndex + 1}/${state.playQueue.length}`
      : "";
    const hasQueue = hasActiveQueue();
    const canPrev = hasQueue && (state.queueIndex > 0 || state.repeatMode === "all");
    miniPlayerEl.innerHTML = `
      <button type="button" class="music-global-go" data-music-global-go aria-label="Music 페이지로">
        <canvas id="music-global-viz" class="music-global-viz" aria-hidden="true"></canvas>
        <span class="music-global-text">
          <span class="music-global-title">${escapeHtml(t.title)}</span>
          <span class="music-global-artist">${escapeHtml(t.artist)}${escapeHtml(queueLabel)}</span>
        </span>
      </button>
      <div class="music-global-actions">
        <button type="button" class="music-global-btn" id="music-global-prev" aria-label="이전 곡"${canPrev ? "" : " disabled"}>⏮</button>
        <button type="button" class="music-global-btn" id="music-global-play" aria-label="재생/일시정지">${state.playing ? "⏸" : "▶"}</button>
        <button type="button" class="music-global-btn" id="music-global-next" aria-label="다음 곡"${hasQueue ? "" : " disabled"}>⏭</button>
        <div class="music-global-volume-wrap">
          <button type="button" class="music-global-btn" id="music-global-volume-btn" aria-label="볼륨" aria-expanded="${state.miniVolumeOpen ? "true" : "false"}">${volumeIcon()}</button>
          <div class="music-global-volume-pop${state.miniVolumeOpen ? " is-open" : ""}" id="music-global-volume-pop">
            <label class="music-global-volume-label" for="music-global-volume">볼륨</label>
            <input type="range" class="music-global-volume-slider" id="music-global-volume" min="0" max="100" value="${Math.round(state.volume * 100)}" orient="vertical" aria-label="볼륨 조절">
          </div>
        </div>
        <button type="button" class="music-global-btn music-global-close" id="music-global-close" aria-label="닫기">✕</button>
      </div>
    `;
    startMiniViz();
  }

  function updateMiniPlayerUi() {
    ensureMiniPlayer();
    bindMiniPlayerEvents();
    if (!miniPlayerEl) return;
    const show = shouldShowMiniPlayer();
    miniPlayerEl.classList.toggle("is-hidden", !show);
    document.body.classList.toggle("music-global-active", !!show);
    if (show) {
      const host = getGlobalBarsHost();
      if (miniPlayerEl.parentElement !== host) host.appendChild(miniPlayerEl);
    }
    if (!show) {
      miniPlayerTrackId = null;
      state.miniVolumeOpen = false;
      stopMiniViz();
      miniPlayerEl.innerHTML = "";
      return;
    }
    const trackChanged = miniPlayerTrackId !== state.selected?.id;
    if (trackChanged || !miniPlayerEl.querySelector("#music-global-viz")) {
      miniPlayerTrackId = state.selected?.id || null;
      renderMiniPlayerContent();
    } else {
      syncMiniPlayerControls();
      syncMiniVolumeUi();
      if (!miniVizRaf) startMiniViz();
    }
  }

  function goToMusicPage() {
    document.querySelector('[data-page="music"]')?.click();
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
          ? `재생 목록 ${state.queueIndex + 1}/${state.playQueue.length}`
          : `재생 목록 ${state.queueIndex + 1}/${state.playQueue.length}`;
      } else {
        status.textContent = state.playing ? "재생 중" : state.selected ? "일시정지" : "곡을 선택하세요";
      }
    }
    const addBtn = pageRoot.querySelector("#music-add-saved-btn");
    if (addBtn && state.selected) {
      const saved = isInActivePlaylist(state.selected.id);
      const activeName = activePlaylist()?.name || "목록";
      addBtn.textContent = saved ? "저장됨" : `「${activeName}」에 추가`;
      addBtn.disabled = saved;
    }
    refreshTransportUi();
  }

  function licenseLine(track) {
    const label = track.license_label || track.license || "";
    const nc = track.nc ? ' <span class="music-nc-badge">NC</span>' : "";
    const dur = track.duration_ms ? ` · ${formatDuration(track.duration_ms)}` : "";
    return `${escapeHtml(label)}${nc}${dur}`;
  }

  function getLastPage() {
    if (state.knownLastPage != null) return state.knownLastPage;
    if (!state.hasMore) return Math.max(1, state.page);
    const proven = Math.max(1, state.maxPageWithTracks || state.page);
    return proven + 1;
  }

  function getPageWindow() {
    const current = state.page;
    const last = getLastPage();
    const size = 5;
    let start = Math.max(1, current - 2);
    let end = start + size - 1;
    if (end > last) {
      end = last;
      start = Math.max(1, end - size + 1);
    }
    const pages = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages.length ? pages : [1];
  }

  function renderPagination() {
    const last = getLastPage();
    const pages = getPageWindow();
    const firstDisabled = state.page <= 1 ? " disabled" : "";
    const prevDisabled = state.page <= 1 ? " disabled" : "";
    const nextDisabled = !state.hasMore ? " disabled" : "";
    const pageBtns = pages
      .map(
        (p) =>
          `<button type="button" class="music-btn music-page-btn${p === state.page ? " is-active" : ""}" data-music-page="${p}"${p === state.page ? ' aria-current="page"' : ""}>${p}</button>`
      )
      .join("");
    return `
      <nav class="music-pagination" aria-label="음악 목록 페이지">
        <button type="button" class="music-btn music-page-nav" data-music-page="first"${firstDisabled} aria-label="맨 앞">|◀</button>
        <button type="button" class="music-btn music-page-nav" data-music-page="prev"${prevDisabled}>이전</button>
        <span class="music-page-nums">${pageBtns}</span>
        <button type="button" class="music-btn music-page-nav" data-music-page="next"${nextDisabled}>다음</button>
        <button type="button" class="music-btn music-page-nav" data-music-page="last" aria-label="맨 끝">▶|</button>
      </nav>
    `;
  }

  function renderGenreNav() {
    const genres = genreList();
    return `
      <nav class="music-genre-nav" aria-label="음악 장르">
        ${genres
          .map(
            (g) =>
              `<button type="button" class="music-genre-btn${g.id === state.genre ? " is-active" : ""}" data-music-genre="${g.id}">${escapeHtml(g.label)}</button>`
          )
          .join("")}
      </nav>
      ${renderSubthemeNav()}
    `;
  }

  function renderSubthemeNav() {
    const subthemes = subthemesForGenre(state.genre);
    if (!subthemes.length) return "";
    return `
      <nav class="music-subtheme-nav" aria-label="테마 선택">
        <span class="music-subtheme-label">테마선택</span>
        <button type="button" class="music-subtheme-btn${!state.subtheme ? " is-active" : ""}" data-music-subtheme="">전체</button>
        ${subthemes
          .map(
            (st) =>
              `<button type="button" class="music-subtheme-btn${st.id === state.subtheme ? " is-active" : ""}" data-music-subtheme="${escapeHtml(st.id)}">${escapeHtml(st.label)}</button>`
          )
          .join("")}
      </nav>
    `;
  }

  function renderSearchBar() {
    return `
      <div class="music-search-row music-search-row--hidden" hidden>
        <label class="music-search-label" for="music-search-input">검색</label>
        <input type="search" id="music-search-input" class="music-search-input" placeholder="제목·아티스트 검색" value="${escapeHtml(state.searchQuery)}" autocomplete="off">
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

  function renderListCountLabel() {
    if (state.loading || !state.tracks.length) return "";
    const pool = Math.max(state.totalEstimate || 0, state.matchedTotal || 0, state.tracks.length);
    const start = (state.page - 1) * PAGE_SIZE + 1;
    const end = start + state.tracks.length - 1;
    const totalStr = state.hasMore ? `전체 약 ${pool}+곡` : `전체 ${pool}곡`;
    return `${totalStr} · ${start}–${end}번`;
  }

  function renderListToolbar() {
    if (!state.tracks.length || state.loading) return "";
    const unsaved = unsavedTracksInCurrentList();
    const activeName = activePlaylist()?.name || "목록";
    const addLabel = unsaved.length ? ` (${unsaved.length}곡)` : "";
    return `
      <div class="music-list-toolbar">
        <button type="button" class="music-btn music-btn-primary" id="music-add-all-tracks">
          「${escapeHtml(activeName)}」에 전체 추가 · 재생${escapeHtml(addLabel)}
        </button>
      </div>
    `;
  }

  function renderList() {
    const collapsed = state.listCollapsed;
    const countLabel = renderListCountLabel();

    if (state.error && !state.tracks.length && !state.loading) {
      return `${renderLoadingLine()}<p class="music-status music-status-error" role="alert">${escapeHtml(state.error)}</p>`;
    }

    const cards = state.tracks
      .map((track) => {
        const meta = [track.year, ...(track.instruments || []).slice(0, 2)].filter(Boolean).join(" · ");
        const isSel = state.selected?.id === track.id;
        const saved = isInActivePlaylist(track.id);
        return `
          <article class="music-card${isSel ? " is-selected" : ""}" data-track-id="${escapeHtml(track.id)}">
            <div class="music-card-cover-wrap">${trackCover(track)}</div>
            <div class="music-card-body">
              <h3 class="music-card-title">${escapeHtml(track.title)}</h3>
              <p class="music-card-artist">${escapeHtml(track.artist)}</p>
              ${meta ? `<p class="music-card-meta">${escapeHtml(meta)}</p>` : ""}
              <p class="music-card-license">${licenseLine(track)}</p>
            </div>
            <div class="music-card-actions">
              <button type="button" class="music-btn music-btn-add-card${saved ? " is-saved" : ""}" data-add-track="${escapeHtml(track.id)}" aria-label="목록에 추가" title="목록에 추가"${saved ? " disabled" : ""}>${saved ? "✓" : "+"}</button>
              <button type="button" class="music-btn music-btn-play-card" data-play-track="${escapeHtml(track.id)}" aria-label="재생">▶</button>
            </div>
          </article>
        `;
      })
      .join("");

    const composerHint = state.composerSearchLabel
      ? `<p class="music-composer-result-hint">「${escapeHtml(state.composerSearchLabel)}」음악 검색 결과</p>`
      : "";

    return `
      <section class="music-list-section${collapsed ? " is-collapsed" : ""}" id="music-list-section">
        <div class="music-list-head">
          <div class="music-list-head-left">
            <h3 class="music-list-title">음악 목록</h3>
            ${countLabel ? `<span class="music-list-count">${escapeHtml(countLabel)}</span>` : ""}
          </div>
          <button type="button" class="music-btn music-btn-ghost" id="music-toggle-list">${collapsed ? "목록 펼치기" : "목록 접기"}</button>
        </div>
        ${renderListToolbar()}
        ${composerHint}
        ${renderLoadingLine()}
        <div class="music-list${collapsed ? " music-list-fold" : ""}">${!state.loading && !cards ? `<p class="music-status">곡이 없습니다.</p>` : cards}</div>
        ${renderPagination()}
      </section>
    `;
  }

  function renderPlaylistsPanel() {
    const active = activePlaylist();
    const expanded = state.playlistsExpanded;
    const items = state.playlists
      .map((pl) => {
        const isActive = pl.id === state.activePlaylistId;
        const tracks = pl.tracks || [];
        const trackItems = tracks
          .map(
            (track, idx) => `
          <li class="music-saved-item" data-pl-track="${escapeHtml(pl.id)}:${escapeHtml(track.id)}">
            <span class="music-saved-num">${idx + 1}</span>
            <div class="music-saved-meta">
              <span class="music-saved-title">${escapeHtml(track.title)}</span>
              <span class="music-saved-artist">${escapeHtml(track.artist)}</span>
            </div>
            <button type="button" class="music-btn music-btn-play-card" data-play-pl-track="${escapeHtml(pl.id)}" data-play-pl-track-id="${escapeHtml(track.id)}" aria-label="재생">▶</button>
            <button type="button" class="music-btn music-btn-ghost music-btn-remove-saved" data-remove-pl-track="${escapeHtml(pl.id)}" data-remove-pl-track-id="${escapeHtml(track.id)}" aria-label="삭제">✕</button>
          </li>
        `
          )
          .join("");
        return `
          <li class="music-pl-item${isActive ? " is-active" : ""}">
            <div class="music-pl-item-head">
              <button type="button" class="music-btn music-btn-primary music-pl-play" data-play-playlist="${escapeHtml(pl.id)}"${tracks.length ? "" : " disabled"}>재생</button>
              <div class="music-pl-item-meta">
                <span class="music-pl-name">${escapeHtml(pl.name)}</span>
                <span class="music-pl-count">${tracks.length}곡</span>
              </div>
              <button type="button" class="music-btn music-btn-ghost music-pl-select" data-select-playlist="${escapeHtml(pl.id)}">${isActive ? "선택됨" : "선택"}</button>
              <button type="button" class="music-btn music-btn-ghost music-pl-delete" data-delete-playlist="${escapeHtml(pl.id)}" aria-label="삭제"${state.playlists.length <= 1 ? " disabled" : ""}>✕</button>
            </div>
            ${expanded && isActive && tracks.length ? `<ol class="music-saved-list music-pl-tracks">${trackItems}</ol>` : ""}
          </li>
        `;
      })
      .join("");

    return `
      <section class="music-playlists-section${expanded ? " is-expanded" : ""}" aria-label="저장 목록">
        <button type="button" class="music-playlists-toggle" id="music-playlists-toggle" aria-expanded="${expanded ? "true" : "false"}">
          <span class="music-playlists-toggle-label">저장 목록</span>
          <span class="music-playlists-toggle-meta">${state.playlists.length}개${active ? ` · ${escapeHtml(active.name)}` : ""}</span>
          <span class="music-playlists-chevron" aria-hidden="true">${expanded ? "▲" : "▼"}</span>
        </button>
        <div class="music-playlists-panel" id="music-playlists-panel"${expanded ? "" : " hidden"}>
          <ul class="music-pl-list">${items}</ul>
          <div class="music-pl-create-row">
            <input type="text" id="music-new-playlist-name" class="music-new-playlist-input" placeholder="새 목록 이름" maxlength="40" autocomplete="off">
            <button type="button" class="music-btn" id="music-create-playlist-btn">추가</button>
          </div>
          <p class="music-pl-hint">「선택」된 목록에 곡을 저장합니다. 「재생」으로 목록 전체를 재생합니다.</p>
        </div>
      </section>
    `;
  }

  function composerImageSrc(c) {
    if (c.imageFile) {
      return `${apiBase()}/api/music/composer-image?file=${encodeURIComponent(c.imageFile)}`;
    }
    return String(c.image || "").replace(/"/g, "");
  }

  function composerPhotoHtml(c) {
    const initial = (c.name || "?").trim().charAt(0);
    const src = composerImageSrc(c);
    const img = src
      ? `<img class="music-composer-photo" src="${src}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.classList.add('is-broken');var f=this.parentElement&&this.parentElement.querySelector('.music-composer-photo-fallback');if(f)f.classList.remove('is-hidden');">`
      : "";
    return `
      <div class="music-composer-photo-wrap">
        ${img}
        <span class="music-composer-photo-fallback${src ? " is-hidden" : ""}" aria-hidden="true">${escapeHtml(initial)}</span>
      </div>
    `;
  }

  async function listenToComposer(searchKey, label) {
    if (!searchKey) return;
    state.genre = "classical";
    state.subtheme = "";
    state.subthemeLabel = "";
    state.genreTheme = currentGenreMeta()?.theme || "";
    state.searchQuery = searchKey;
    state.composerSearchLabel = label || searchKey;
    resetPaginationBounds();
    state.page = 1;
    state.listCollapsed = false;
    state.selected = null;
    await fetchTracks();
    requestAnimationFrame(() => {
      pageRoot?.querySelector("#music-list-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function renderClassicalComposers() {
    const list = window.CLASSICAL_COMPOSERS || [];
    if (!list.length) return "";
    const cards = list
      .map((c) => {
        const searchKey = c.search || c.nameEn || c.name || "";
        return `
          <article class="music-composer-card">
            ${composerPhotoHtml(c)}
            <div class="music-composer-body">
              <div class="music-composer-name-row">
                <h4 class="music-composer-name">${escapeHtml(c.name)}</h4>
                <button type="button" class="music-btn music-btn-primary music-composer-listen" data-composer-search="${escapeHtml(searchKey)}" data-composer-label="${escapeHtml(c.name)}">듣기</button>
              </div>
              <p class="music-composer-name-en">${escapeHtml(c.nameEn || "")}${c.years ? ` · ${escapeHtml(c.years)}` : ""}</p>
              <p class="music-composer-desc">${escapeHtml(c.desc || "")}</p>
              <p class="music-composer-works"><span>대표곡</span> ${escapeHtml(c.works || "")}</p>
            </div>
          </article>
        `;
      })
      .join("");
    return `
      <section class="music-classical-section" aria-label="클래식 주요 음악가">
        <header class="music-classical-head">
          <h3>클래식 주요 음악가 30인</h3>
          <p>대표 작곡가의 생애·대표곡을 함께 살펴보세요.</p>
        </header>
        <div class="music-composer-grid">${cards}</div>
      </section>
    `;
  }

  function renderEqualizer() {
    const columns = EQ_BANDS.map((band, i) => {
      const val = state.eq[i] ?? 0;
      return `
        <div class="music-eq-column">
          <span class="music-eq-db">${eqDbLabel(val)}</span>
          <div class="music-eq-track">
            <div class="music-eq-grid-line" aria-hidden="true"></div>
            <div class="music-eq-fill" style="height:${eqFillHeight(val)}"></div>
            <input type="range" class="music-eq-slider" id="music-eq-${i}" data-eq-band="${i}" min="-12" max="12" step="1" value="${val}" aria-label="${band.label}Hz">
          </div>
          <span class="music-eq-hz">${band.label}</span>
        </div>
      `;
    }).join("");
    return `
      <div class="music-eq-panel" aria-label="10단 이퀄라이저">
        <div class="music-eq-panel-head">
          <span class="music-eq-panel-title">Equalizer</span>
          <button type="button" class="music-btn music-btn-ghost music-eq-reset" id="music-eq-reset">리셋</button>
        </div>
        <div class="music-eq-presets" role="group" aria-label="EQ 프리셋">
          ${EQ_PRESETS.map(
            (p) =>
              `<button type="button" class="music-eq-preset-btn${state.eqPreset === p.id ? " is-active" : ""}" data-eq-preset="${p.id}">${p.label}</button>`
          ).join("")}
        </div>
        <div class="music-eq-rack">${columns}</div>
      </div>
    `;
  }

  function renderPlayer() {
    const t = state.selected;
    if (!t) {
      return `<section class="music-player music-player-empty" aria-label="재생 패널"><p class="music-player-placeholder">목록에서 곡을 선택하면 여기서 재생됩니다.</p></section>`;
    }
    const cover = trackCover(t);
    const saved = isInActivePlaylist(t.id);
    const activeName = activePlaylist()?.name || "목록";
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
            <button type="button" class="music-btn" id="music-add-saved-btn"${saved ? " disabled" : ""}>${saved ? "저장됨" : `「${escapeHtml(activeName)}」에 추가`}</button>
            <button type="button" class="music-btn music-btn-primary" id="music-play-btn" aria-label="재생/일시정지">${state.playing ? "⏸" : "▶"}</button>
            <button type="button" class="music-btn" id="music-stop-btn" aria-label="정지">⏹</button>
          </div>
        </div>
        <p class="music-player-status" id="music-player-status">${state.playing ? "재생 중" : "일시정지"}</p>
        <div id="music-transport-slot">${hasActiveQueue() ? renderTransportBar() : ""}</div>
        <div class="music-seek-row">
          <span id="music-time-current">${formatTime(state.currentTime)}</span>
          <input type="range" class="music-seek" id="music-seek" min="0" max="100" value="0" aria-label="재생 위치">
          <span id="music-time-total">${formatTime(state.duration || trackDurationMs(t) / 1000)}</span>
        </div>
        <div class="music-volume-row">
          <span class="music-player-volume-icon" aria-hidden="true">${volumeIcon()}</span>
          <input type="range" class="music-volume" id="music-volume" min="0" max="100" value="${Math.round(state.volume * 100)}" aria-label="볼륨">
          <div class="music-viz-nav-group">
            <button type="button" class="music-btn music-viz-nav-btn" id="music-viz-prev" title="이전 비주얼" aria-label="이전 비주얼">◀</button>
            <button type="button" class="music-btn music-viz-nav-btn" id="music-viz-next" title="다음 비주얼" aria-label="다음 비주얼">▶</button>
            <button type="button" class="music-btn music-player-fs-btn" id="music-viz-fullscreen-btn" title="전체화면 비주얼" aria-label="전체화면">⛶</button>
          </div>
        </div>
        ${renderEqualizer()}
        ${renderVizPicker()}
        <div class="music-viz-wrap">
          <canvas id="music-viz-canvas" class="music-viz-canvas" aria-hidden="true"></canvas>
        </div>
        <p class="music-footnote">사이트 내 스트리밍만 · NC 포함 · 저장 목록 무료 · 출처 표시</p>
      </section>
    `;
  }

  function render() {
    if (!pageRoot) return;
    pageRoot.innerHTML = `
      <article class="content-panel music-panel">
        <header class="music-header">
          <h2>Music</h2>
          <p class="music-intro">Jamendo · Openverse — 사이트 내 재생(CC·NC 포함) · 저장 목록 무료</p>
        </header>
        ${renderPlaylistsPanel()}
        ${renderGenreNav()}
        ${renderSearchBar()}
        ${renderApiHint()}
        ${renderList()}
        ${renderPlayer()}
        ${state.genre === "classical" ? renderClassicalComposers() : ""}
      </article>
    `;
    bindEvents();
    updatePlayerUi();
    updateProgressUi();
    updateLoadingBanner();
    if (state.playing || state.selected) startViz();
    else drawVisualizer();
  }

  function runSearch() {
    const input = pageRoot?.querySelector("#music-search-input");
    state.searchQuery = (input?.value || "").trim();
    state.composerSearchLabel = "";
    resetPaginationBounds();
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
        state.subtheme = "";
        state.subthemeLabel = "";
        state.genreTheme = genreList().find((g) => g.id === genre)?.theme || "";
        state.page = 1;
        state.searchQuery = "";
        state.composerSearchLabel = "";
        resetPaginationBounds();
        state.selected = null;
        state.listCollapsed = false;
        void fetchTracks();
      });
    });

    pageRoot.querySelectorAll("[data-music-subtheme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const subtheme = btn.dataset.musicSubtheme || "";
        if (subtheme === state.subtheme) return;
        stopPlayback();
        state.subtheme = subtheme;
        resetPaginationBounds();
        state.page = 1;
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
    }

    pageRoot.querySelector("#music-search-btn")?.addEventListener("click", runSearch);
    pageRoot.querySelector("#music-search-clear")?.addEventListener("click", () => {
      state.searchQuery = "";
      state.composerSearchLabel = "";
      resetPaginationBounds();
      state.page = 1;
      void fetchTracks();
    });

    pageRoot.querySelectorAll("[data-viz-style]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.vizStyle, 10);
        if (!Number.isFinite(id)) return;
        state.vizStyle = id;
        saveVizStyle();
        vizParticles = [];
        updateVizStyleUi();
      });
    });

    pageRoot.querySelector("#music-viz-prev")?.addEventListener("click", () => cycleVizStyle(-1));
    pageRoot.querySelector("#music-viz-next")?.addEventListener("click", () => cycleVizStyle(1));

    pageRoot.querySelector("#music-viz-fullscreen-btn")?.addEventListener("click", openVizFullscreen);

    pageRoot.querySelector("#music-add-all-tracks")?.addEventListener("click", () => {
      if (!state.tracks.length) {
        showMusicToast("추가할 곡이 없습니다");
        return;
      }
      const { added } = addAllCurrentTracksAndPlay();
      const name = activePlaylist()?.name || "목록";
      if (added > 0) {
        showMusicToast(`「${name}」에 ${added}곡 추가 · 재생 시작`);
      } else {
        showMusicToast(`${state.tracks.length}곡 재생 시작`);
      }
    });

    bindTransportControls(pageRoot);

    pageRoot.querySelectorAll("[data-play-track]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const track = findTrackById(btn.dataset.playTrack);
        if (track) void playTrack(track);
      });
    });

    pageRoot.querySelectorAll("[data-add-track]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const track = findTrackById(btn.dataset.addTrack);
        if (track && addToActivePlaylist(track)) render();
      });
    });

    pageRoot.querySelectorAll(".music-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const track = findTrackById(card.dataset.trackId);
        if (track) void playTrack(track);
      });
    });

    pageRoot.querySelector(".music-pagination")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-music-page]");
      if (!btn || btn.disabled) return;
      const action = btn.dataset.musicPage;
      if (action === "last") {
        void goToLastPage();
        return;
      }
      let target = state.page;
      if (action === "first") target = 1;
      else if (action === "prev") target = state.page - 1;
      else if (action === "next") target = state.page + 1;
      else target = parseInt(action, 10);
      if (!Number.isFinite(target) || target < 1 || target === state.page) return;
      if (action === "next" && !state.hasMore) return;
      if (Number.isFinite(target) && target > getLastPage()) return;
      state.page = target;
      void fetchTracks();
    });

    pageRoot.querySelectorAll(".music-composer-listen").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        void listenToComposer(btn.dataset.composerSearch, btn.dataset.composerLabel);
      });
    });

    pageRoot.querySelector("#music-toggle-list")?.addEventListener("click", () => {
      state.listCollapsed = !state.listCollapsed;
      render();
    });

    pageRoot.querySelector("#music-playlists-toggle")?.addEventListener("click", () => {
      state.playlistsExpanded = !state.playlistsExpanded;
      render();
    });

    pageRoot.querySelector("#music-create-playlist-btn")?.addEventListener("click", () => {
      const input = pageRoot.querySelector("#music-new-playlist-name");
      if (createPlaylist(input?.value || "")) {
        state.playlistsExpanded = true;
        if (input) input.value = "";
        render();
      }
    });

    pageRoot.querySelectorAll("[data-play-playlist]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        playPlaylist(btn.dataset.playPlaylist);
      });
    });

    pageRoot.querySelectorAll("[data-select-playlist]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.activePlaylistId = btn.dataset.selectPlaylist;
        persistPlaylists();
        render();
      });
    });

    pageRoot.querySelectorAll("[data-delete-playlist]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (deletePlaylist(btn.dataset.deletePlaylist)) render();
      });
    });

    pageRoot.querySelectorAll("[data-play-pl-track]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pl = state.playlists.find((p) => p.id === btn.dataset.playPlTrack);
        const idx = pl?.tracks?.findIndex((t) => t.id === btn.dataset.playPlTrackId) ?? -1;
        if (idx < 0 || !pl) return;
        state.activePlaylistId = pl.id;
        state.playQueue = pl.tracks.map((t) => ({ ...t }));
        state.queueIndex = idx;
        void playTrack(state.playQueue[idx], { fromQueue: true });
      });
    });

    pageRoot.querySelectorAll("[data-remove-pl-track]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (removeFromPlaylist(btn.dataset.removePlTrack, btn.dataset.removePlTrackId)) render();
      });
    });

    pageRoot.querySelector("#music-play-btn")?.addEventListener("click", togglePlayback);
    pageRoot.querySelector("#music-stop-btn")?.addEventListener("click", () => {
      stopPlayback();
    });

    pageRoot.querySelector("#music-add-saved-btn")?.addEventListener("click", () => {
      if (state.selected && addToActivePlaylist(state.selected)) render();
    });

    const seek = pageRoot.querySelector("#music-seek");
    if (seek) {
      seek.addEventListener("input", () => seekTo(Number(seek.value) / 100));
    }

    pageRoot.querySelector("#music-volume")?.addEventListener("input", (e) => {
      applyVolume(Number(e.target.value) / 100);
    });

    pageRoot.querySelectorAll("[data-eq-band]").forEach((el) => {
      el.addEventListener("input", () => {
        const index = Number(el.dataset.eqBand);
        if (!Number.isFinite(index)) return;
        state.eq[index] = Number(el.value);
        markEqCustom();
        persistEq();
        applyEq();
        updateEqColumnUi(index);
      });
    });

    pageRoot.querySelectorAll("[data-eq-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyEqPreset(btn.dataset.eqPreset);
      });
    });

    pageRoot.querySelector("#music-eq-reset")?.addEventListener("click", () => {
      resetEq();
    });
  }

  async function renderPage(container) {
    pageRoot = container;
    loadPlaylists();
    loadVizStyle();
    loadVolume();
    loadEq();
    ensureAudio();
    if (!state._musicBrowseReady) {
      state.genre = "jazz";
      state.subtheme = "";
      state.subthemeLabel = "";
      state.page = 1;
      state.searchQuery = "";
      state.listCollapsed = false;
      state._musicBrowseReady = true;
    }
    await fetchGenres();
    state.genreTheme = currentGenreMeta()?.theme || "";
    void fetchTracks();
    updateMiniPlayerUi();
  }

  function leavePage() {
    void closeVizFullscreen();
    if (fullscreenOverlay) {
      fullscreenOverlay.remove();
      fullscreenOverlay = null;
    }
    stopLoadingAnimation();
    if (vizRaf) {
      cancelAnimationFrame(vizRaf);
      vizRaf = null;
    }
    pageRoot = null;
    vizParticles = [];
    updateMiniPlayerUi();
  }

  function shutdown() {
    stopPlayback();
    leavePage();
    if (audioCtx) {
      void audioCtx.close();
      audioCtx = null;
      sourceNode = null;
      analyser = null;
      gainNode = null;
      eqFilters = [];
    }
    audioEl = null;
    updateMiniPlayerUi();
  }

  function destroy() {
    leavePage();
  }

  window.Music = { renderPage, leavePage, shutdown, destroy, updateMiniPlayerUi };
})();
