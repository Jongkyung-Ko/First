(function () {
  const PAGE_SIZE = 10;
  const PLAYLISTS_STORAGE_KEY = "dw-music-playlists-v2";
  const LEGACY_PLAYLIST_KEY = "dw-music-saved-playlist";
  const VIZ_STYLE_STORAGE_KEY = "dw-music-viz-style";
  const VOLUME_STORAGE_KEY = "dw-music-volume";
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
        { id: "electronic", label: "일렉트로닉 팝" }
      ]
    }
  ];

  const VIZ_STYLES = [
    { id: 0, icon: "🌌", label: "오로라" },
    { id: 1, icon: "✨", label: "별빛" },
    { id: 2, icon: "🌊", label: "물결" },
    { id: 3, icon: "🔮", label: "수정" },
    { id: 4, icon: "🌸", label: "꽃잎" },
    { id: 5, icon: "🪐", label: "행성" },
    { id: 6, icon: "💫", label: "소용돌이" },
    { id: 7, icon: "🦋", label: "나비" },
    { id: 8, icon: "🌙", label: "달빛" },
    { id: 9, icon: "⭐", label: "성운" }
  ];

  let pageRoot = null;
  let miniPlayerEl = null;
  let miniPlayerBound = false;
  let miniPlayerTrackId = null;
  let miniVizRaf = null;
  let fullscreenOverlay = null;
  let audioEl = null;
  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let gainNode = null;
  let bassFilter = null;
  let midFilter = null;
  let trebleFilter = null;
  let freqData = null;
  let timeData = null;
  let vizRaf = null;
  let loadingTimer = null;
  let loadingDots = 1;
  let vizParticles = [];

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
    eq: { bass: 0, mid: 0, treble: 0 },
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
    timeData = new Uint8Array(analyser.frequencyBinCount);
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

  const VIZ_DRAW = {
    aurora(ctx, w, h, data, t) {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#0f0520");
      grad.addColorStop(1, "#051525");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      const bars = 56;
      const gap = 2;
      const barW = (w - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * data.freq.length);
        const v = data.active ? data.freq[idx] / 255 : idleVal(i, bars, t);
        const bh = Math.max(3, v * h * 0.88);
        const x = i * (barW + gap);
        const g = ctx.createLinearGradient(x, h, x, h - bh);
        g.addColorStop(0, `hsla(${260 + i * 2}, 80%, 45%, 0.9)`);
        g.addColorStop(1, `hsla(${180 + i * 3}, 90%, 70%, 0.95)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, h - bh, barW, bh);
      }
    },
    stardust(ctx, w, h, data, t) {
      ctx.fillStyle = "rgba(4, 8, 24, 0.35)";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const rays = 72;
      for (let i = 0; i < rays; i++) {
        const idx = Math.floor((i / rays) * data.freq.length);
        const v = data.active ? data.freq[idx] / 255 : idleVal(i, rays, t);
        const ang = (i / rays) * Math.PI * 2 + t / 2000;
        const len = 20 + v * Math.min(w, h) * 0.42;
        ctx.strokeStyle = `hsla(${200 + i * 2}, 90%, 72%, ${0.25 + v * 0.65})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        ctx.stroke();
      }
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.35);
      glow.addColorStop(0, "rgba(167, 139, 250, 0.55)");
      glow.addColorStop(1, "rgba(167, 139, 250, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    },
    wave(ctx, w, h, data, t) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0a1628");
      bg.addColorStop(1, "#061018");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const mid = h * 0.5;
      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const fi = Math.floor((x / w) * data.freq.length);
          const v = data.active ? data.freq[fi] / 255 : idleVal(x, w, t);
          const y = mid + Math.sin(x / 28 + t / (300 + layer * 80) + layer) * (12 + v * h * 0.32);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${56 + layer * 40}, ${189 + layer * 20}, 248, ${0.45 + layer * 0.15})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    },
    crystal(ctx, w, h, data, t) {
      ctx.fillStyle = "#080818";
      ctx.fillRect(0, 0, w, h);
      const cols = 14;
      const rows = 8;
      const cellW = w / cols;
      const cellH = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = Math.floor(((r * cols + c) / (rows * cols)) * data.freq.length);
          const v = data.active ? data.freq[idx] / 255 : idleVal(r + c, cols, t);
          const size = cellW * 0.35 * (0.4 + v);
          const x = c * cellW + cellW / 2;
          const y = r * cellH + cellH / 2;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4 + t / 3000);
          ctx.fillStyle = `hsla(${280 + v * 60}, 85%, ${45 + v * 35}%, ${0.35 + v * 0.55})`;
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
        }
      }
    },
    petals(ctx, w, h, data, t) {
      ctx.fillStyle = "#120818";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const petals = 24;
      for (let i = 0; i < petals; i++) {
        const idx = Math.floor((i / petals) * data.freq.length);
        const v = data.active ? data.freq[idx] / 255 : idleVal(i, petals, t);
        const ang = (i / petals) * Math.PI * 2 + t / 2500;
        const dist = 8 + v * Math.min(w, h) * 0.28;
        const px = cx + Math.cos(ang) * dist;
        const py = cy + Math.sin(ang) * dist;
        const rad = 4 + v * 18;
        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, `rgba(251, 113, 180, ${0.5 + v * 0.4})`);
        g.addColorStop(1, "rgba(251, 113, 180, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    orbit(ctx, w, h, data, t) {
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const rings = 5;
      for (let r = 0; r < rings; r++) {
        const idx = Math.floor((r / rings) * data.freq.length);
        const v = data.active ? data.freq[idx] / 255 : idleVal(r, rings, t);
        const radius = (r + 1) * (Math.min(w, h) * 0.09) + v * 12;
        ctx.strokeStyle = `hsla(${200 + r * 25}, 80%, 65%, ${0.25 + v * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        const dotAng = t / (800 + r * 200) + r;
        ctx.fillStyle = `hsla(${260 + r * 20}, 90%, 75%, 0.9)`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(dotAng) * radius, cy + Math.sin(dotAng) * radius, 3 + v * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    spiral(ctx, w, h, data, t) {
      ctx.fillStyle = "#0a0a20";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const steps = 120;
      ctx.beginPath();
      for (let i = 0; i < steps; i++) {
        const idx = Math.floor((i / steps) * data.freq.length);
        const v = data.active ? data.freq[idx] / 255 : idleVal(i, steps, t);
        const ang = i * 0.22 + t / 1500;
        const rad = i * 1.2 + v * 8;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(129, 140, 248, ${data.active ? 0.85 : 0.45})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    butterfly(ctx, w, h, data, t) {
      ctx.fillStyle = "#100818";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const pts = 80;
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) {
        const idx = Math.floor((i / pts) * data.freq.length);
        const v = data.active ? data.freq[idx] / 255 : idleVal(i, pts, t);
        const a = (i / pts) * Math.PI * 2;
        const r = Math.abs(Math.sin(a * 2 + t / 1200)) * (40 + v * h * 0.35);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 0.65;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "rgba(192, 132, 252, 0.7)");
      g.addColorStop(1, "rgba(56, 189, 248, 0.7)");
      ctx.fillStyle = g;
      ctx.fill();
    },
    moonbeam(ctx, w, h, data, t) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#0c1228");
      g.addColorStop(1, "#1a1035");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const bars = 40;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * data.freq.length);
        const v = data.active ? data.freq[idx] / 255 : idleVal(i, bars, t);
        const x = (i / bars) * w;
        const bh = v * h * 0.75;
        const beam = ctx.createLinearGradient(x, h, x, h - bh);
        beam.addColorStop(0, "rgba(148, 163, 255, 0)");
        beam.addColorStop(0.5, `rgba(199, 210, 254, ${0.15 + v * 0.35})`);
        beam.addColorStop(1, "rgba(224, 231, 255, 0)");
        ctx.fillStyle = beam;
        ctx.fillRect(x, h - bh, w / bars + 1, bh);
      }
      ctx.fillStyle = "rgba(226, 232, 255, 0.85)";
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.22, 14 + Math.sin(t / 900) * 2, 0, Math.PI * 2);
      ctx.fill();
    },
    nebula(ctx, w, h, data, t) {
      ctx.fillStyle = "rgba(5, 5, 20, 0.4)";
      ctx.fillRect(0, 0, w, h);
      if (vizParticles.length < 48) {
        vizParticles = Array.from({ length: 48 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          hue: Math.random() * 80 + 200
        }));
      }
      const avg = data.active
        ? data.freq.reduce((a, b) => a + b, 0) / data.freq.length / 255
        : 0.15 + Math.sin(t / 500) * 0.08;
      vizParticles.forEach((p, i) => {
        const idx = Math.floor((i / vizParticles.length) * data.freq.length);
        const v = data.active ? data.freq[idx] / 255 : avg;
        p.x += p.vx * (1 + v * 2);
        p.y += p.vy * (1 + v * 2);
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        const rad = 2 + v * 10;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        g.addColorStop(0, `hsla(${p.hue}, 90%, 70%, ${0.4 + v * 0.5})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  };

  const VIZ_FN = [
    VIZ_DRAW.aurora,
    VIZ_DRAW.stardust,
    VIZ_DRAW.wave,
    VIZ_DRAW.crystal,
    VIZ_DRAW.petals,
    VIZ_DRAW.orbit,
    VIZ_DRAW.spiral,
    VIZ_DRAW.butterfly,
    VIZ_DRAW.moonbeam,
    VIZ_DRAW.nebula
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
        <button type="button" class="music-viz-icon-btn music-viz-fs-btn" id="music-viz-fullscreen-btn" title="전체 보기" aria-label="전체 보기">⛶</button>
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
  }

  function openVizFullscreen() {
    if (!state.selected) return;
    ensureFullscreenOverlay();
    state.vizFullscreen = true;
    fullscreenOverlay.hidden = false;
    document.body.classList.add("music-viz-fs-open");
    updateFullscreenUi();
    startViz();
  }

  function closeVizFullscreen() {
    state.vizFullscreen = false;
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
    if (slot) slot.innerHTML = renderTransportBar("music-transport-fs");
    bindTransportControls(fullscreenOverlay);
  }

  function bindTransportControls(root) {
    if (!root) return;
    root.querySelector('[data-action="prev"]')?.addEventListener("click", playPrevious);
    root.querySelector('[data-action="next"]')?.addEventListener("click", () => playNext(true));
    root.querySelector('[data-action="toggle-play"]')?.addEventListener("click", togglePlayback);
    root.querySelector('[data-action="repeat-one"]')?.addEventListener("click", () => {
      state.repeatMode = state.repeatMode === "one" ? "off" : "one";
      refreshTransportUi();
    });
    root.querySelector('[data-action="repeat-all"]')?.addEventListener("click", () => {
      state.repeatMode = state.repeatMode === "all" ? "off" : "all";
      refreshTransportUi();
    });
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
      if (state.subtheme) params.set("subtheme", state.subtheme);
      const url = `${apiBase()}/api/music/tracks?${params}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `목록 로드 실패 (${res.status})`);
      state.tracks = data.tracks || [];
      state.resultCount = data.result_count ?? state.tracks.length;
      state.totalEstimate = data.total_estimate ?? state.tracks.length;
      state.matchedTotal = data.matched_total ?? state.tracks.length;
      state.genreTheme = data.genre_theme || currentGenreMeta()?.theme || "";
      state.subthemeLabel = data.subtheme_label || "";
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
      state.totalEstimate = 0;
      state.matchedTotal = 0;
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
    } catch (err) {
      state.playing = false;
      state.playbackError = err.message || "재생할 수 없습니다";
    } finally {
      state.trackLoading = false;
      if (!state.loading) stopLoadingAnimation();
      updateLoadingBanner();
    }
    updatePlayerUi();
    updateFullscreenUi();
    syncMiniPlayerControls();
    updateMiniPlayerUi();
    startViz();
  }
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
      state.playing = false;
      state.trackLoading = false;
      if (!state.loading) stopLoadingAnimation();
      const code = audioEl.error?.code;
      const msgs = { 1: "재생이 중단되었습니다", 2: "네트워크 오류", 3: "디코드 오류", 4: "형식 미지원" };
      state.playbackError = msgs[code] || "재생 오류";
      updatePlayerUi();
      updateFullscreenUi();
      if (state.playQueue) playNext(false);
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

  function ensureMiniPlayer() {
    if (miniPlayerEl) return;
    miniPlayerEl = document.createElement("div");
    miniPlayerEl.id = "music-global-bar";
    miniPlayerEl.className = "music-global-bar is-hidden";
    miniPlayerEl.setAttribute("role", "region");
    miniPlayerEl.setAttribute("aria-label", "음악 재생");
    document.body.appendChild(miniPlayerEl);
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

  function renderGenreNav() {
    const genres = genreList();
    const theme = state.genreTheme || currentGenreMeta()?.theme || "";
    return `
      <nav class="music-genre-nav" aria-label="음악 장르">
        ${genres
          .map(
            (g) =>
              `<button type="button" class="music-genre-btn${g.id === state.genre ? " is-active" : ""}" data-music-genre="${g.id}">${escapeHtml(g.label)}</button>`
          )
          .join("")}
      </nav>
      ${theme ? `<p class="music-genre-theme">${escapeHtml(theme)}</p>` : ""}
      ${renderSubthemeNav()}
    `;
  }

  function renderSubthemeNav() {
    const subthemes = subthemesForGenre(state.genre);
    if (!subthemes.length) return "";
    return `
      <nav class="music-subtheme-nav" aria-label="테마 장르">
        <span class="music-subtheme-label">테마</span>
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
      <div class="music-search-row">
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

    const prevDisabled = state.page <= 1 ? " disabled" : "";
    const nextDisabled = !state.hasMore ? " disabled" : "";

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
        ${composerHint}
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
        <div class="music-eq" aria-label="이퀄라이저">
          <label class="music-eq-band"><span>저음</span><input type="range" id="music-eq-bass" min="-12" max="12" step="1" value="${state.eq.bass}"></label>
          <label class="music-eq-band"><span>중음</span><input type="range" id="music-eq-mid" min="-12" max="12" step="1" value="${state.eq.mid}"></label>
          <label class="music-eq-band"><span>고음</span><input type="range" id="music-eq-treble" min="-12" max="12" step="1" value="${state.eq.treble}"></label>
        </div>
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
        render();
      });
    });

    pageRoot.querySelector("#music-viz-fullscreen-btn")?.addEventListener("click", openVizFullscreen);

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

  async function renderPage(container) {
    pageRoot = container;
    loadPlaylists();
    loadVizStyle();
    loadVolume();
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
    closeVizFullscreen();
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
      bassFilter = null;
      midFilter = null;
      trebleFilter = null;
    }
    audioEl = null;
    updateMiniPlayerUi();
  }

  function destroy() {
    leavePage();
  }

  window.Music = { renderPage, leavePage, shutdown, destroy };
})();
