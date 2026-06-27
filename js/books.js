(function () {
  const TOPICS = [
    { id: "", label: "전체 장르" },
    { id: "Fiction", label: "Fiction" },
    { id: "Science fiction", label: "Science fiction" },
    { id: "Fantasy", label: "Fantasy" },
    { id: "Adventure", label: "Adventure" },
    { id: "Mystery", label: "Mystery" },
    { id: "Romance", label: "Romance" },
    { id: "Poetry", label: "Poetry" },
    { id: "Drama", label: "Drama" },
    { id: "History", label: "History" },
    { id: "Philosophy", label: "Philosophy" },
    { id: "Children", label: "Children" },
    { id: "Biography", label: "Biography" }
  ];

  const AUTHOR_YEARS = [
    { id: "", label: "전체 시대" },
    { id: "1500-1699", label: "1500–1699" },
    { id: "1700-1799", label: "1700–1799" },
    { id: "1800-1899", label: "1800–1899" },
    { id: "1900-1999", label: "1900–1999" }
  ];

  const THEME_PAGE_SIZE = 32;

  const THEME_CATALOG = [
    { id: "shakespeare", label: "셰익스피어 명작", description: "햄릿, 로미오와 줄리엣, 맥베스, 오셀로, 리어 왕 등", book_ids: [1524, 1513, 1533, 1531, 1532, 1120, 1514, 1515, 1530, 1041] },
    { id: "classic_novels", label: "영미 고전 소설", description: "오만과 편견, 제인 에어, 위더링 하이츠, 위대한 유산 등", book_ids: [1342, 1260, 768, 1400, 2701, 84, 345, 174, 120, 1661, 161, 514] },
    { id: "romance", label: "로맨스 명작", description: "사랑과 운명을 다룬 고전 로맨스", book_ids: [1342, 1513, 161, 768, 1260, 10554, 1399, 514, 1259] },
    { id: "mystery", label: "미스터리·추리", description: "셜록 홈즈, 드라큘라, 추리 고전", book_ids: [1661, 2097, 244, 345, 6133, 834, 69087] },
    { id: "scifi_fantasy", label: "SF·판타지", description: "프랑켄슈타인, 이상한 나라의 앨리스, 타임머신 등", book_ids: [84, 11, 35, 36, 188, 16, 55, 74] },
    { id: "children", label: "어린이·동화 고전", description: "이상한 나라의 앨리스, 오즈, 정글북, 어린 왕자 등", book_ids: [11, 55, 236, 16, 120, 2610, 46, 2781] },
    { id: "philosophy", label: "철학·고전 사상", description: "플라톤, 마르쿠스 아우렐리우스, 마키아벨리 등", book_ids: [1497, 2680, 1232, 4363, 5827, 2600] },
    { id: "american_classics", label: "미국 문학 명작", description: "모비딕, 허클베리 핀, 독자 연설, 월든 등", book_ids: [2701, 76, 74, 25344, 205, 514, 43] },
    { id: "arabian_nights", label: "아라비안 나이트", description: "천일야화·동방 환상 이야기", book_ids: [128, 3435, 19860, 7128, 3825] },
    { id: "aesop_fables", label: "이솝 우화", description: "이솝 우화집과 교훈 이야기", book_ids: [21, 11339, 18732, 1837, 620] },
    { id: "andersen_fairy", label: "안데르센 동화", description: "인어공주, 성냥팔이 소녀, 미운 오리 새끼 등", book_ids: [1597, 32572, 27200, 35611, 902] },
    { id: "grimm_fairy", label: "그림 형제 동화", description: "신데렐라, 백설공주, 헨젤과 그레텔 등", book_ids: [2591, 55658, 5314, 19036, 32572] },
    { id: "world_fairy_tales", label: "세계 동화 모음", description: "안데르센·그림·이솝·동방 설화", book_ids: [1597, 2591, 21, 128, 55, 16, 236, 2781] },
    { id: "edwardian_children", label: "근대 아동문학", description: "1900년대 초 아동·청소년 고전", book_ids: [1695, 2781, 16, 55, 236, 2610, 175, 47] },
    { id: "greek_roman_myth", label: "그리스·로마 신화", description: "일리아드, 오디세이, 불핀치 신화 등", book_ids: [6130, 1727, 2199, 260, 34893, 16389] },
    { id: "adventure_tales", label: "모험·탐험 이야기", description: "보물섬, 지구 중심 여행, 로빈슨 등", book_ids: [120, 188, 103, 209, 829, 74, 76, 215] },
    { id: "gothic_horror", label: "고딕·호러", description: "프랑켄슈타인, 드라큘라, 지킬 밀스터 등", book_ids: [84, 345, 42, 2147, 69087, 42324] },
    { id: "short_story_masters", label: "단편 명작", description: "에드거 앨런 포, 모파상 등", book_ids: [2147, 932, 834, 20583, 40436, 1952] },
    { id: "wisdom_parables", label: "우화·교훈·격언", description: "이솝, 교훈 이야기, 삶의 지혜 고전", book_ids: [21, 2680, 1232, 1497, 1998, 8800] },
    { id: "nursery_rhymes", label: "동요·놀이동시", description: "Mother Goose, nursery rhyme 모음", book_ids: [13214, 17661, 18546, 3314, 19551] },
    { id: "legend_knights", label: "기사·전설", description: "아서 왕, 기사도, 중세 전설", book_ids: [1251, 1739, 49260, 14328, 8712] }
  ];

  const FALLBACK_THEMES = THEME_CATALOG;

  const EN_VOICES_FREETTS = ["en-US-JennyNeural", "en-US-GuyNeural", "en-US-AriaNeural"];
  const KO_VOICES_FREETTS = ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"];
  const EN_VOICES_GOOGLE = ["en-US-Neural2-A", "en-US-Neural2-C", "en-US-Neural2-D", "en-US-Neural2-F"];
  const KO_VOICES_GOOGLE = ["ko-KR-Neural2-A", "ko-KR-Neural2-B", "ko-KR-Neural2-C"];

  const TTS_TEST_SAMPLE_EN = "Hello. This is a Books reading test.";
  const WEB_SPEECH_ENGINE_ID = "webspeech";
  const WEBSPEECH_CHUNK_MAX = 4000;
  const GOOGLE_CHUNK_BYTES = 512;
  const TTS_RATES = ["0.85", "1.0", "1.15", "1.2", "1.3", "1.4"];
  const READER_FONT_MIN = 0.65;
  const READER_FONT_MAX = 1.25;
  const READER_FONT_STEP = 0.04;
  const READER_FONT_DEFAULT = 0.82;
  const BOOKMARKS_STORAGE_KEY = "digital-world-books-bookmarks";
  const READER_FONT_STORAGE_KEY = "digital-world-books-reader-font";

  const FALLBACK_ENGINES = [
    {
      id: "freetts",
      label: "FreeTTS",
      configured: true,
      monthly_limit: 5000,
      chars_used: 0,
      chunk_max: 1000,
      hourly_limit: 1000,
      hourly_used: 0,
      voices: []
    },
    {
      id: "google",
      label: "Cloud TTS Neural2",
      configured: false,
      monthly_limit: 1000000,
      chars_used: 0,
      chunk_max: GOOGLE_CHUNK_BYTES,
      chunk_unit: "bytes",
      hourly_limit: 0,
      hourly_used: 0,
      voices: []
    }
  ];

  let pageRoot = null;
  let listAbort = null;
  let textAbort = null;
  let ttsAbort = null;
  let currentAudio = null;
  let ttsSessionId = 0;
  let testSessionId = 0;
  let translateAbort = null;
  let translateSessionId = 0;
  let pendingReaderScrollChunk = null;

  function loadReaderFontSize() {
    const saved = parseFloat(localStorage.getItem(READER_FONT_STORAGE_KEY) || "");
    if (Number.isFinite(saved) && saved >= READER_FONT_MIN && saved <= READER_FONT_MAX) {
      return saved;
    }
    return READER_FONT_DEFAULT;
  }

  function loadBookmarks() {
    try {
      const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function persistBookmarks(bookmarks) {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks.slice(0, 50)));
  }

  const state = {
    view: "list",
    readMode: "en",
    search: "",
    topic: "",
    theme: "",
    themes: [],
    themeLabel: "",
    themeDescription: "",
    authorYear: "",
    page: 1,
    count: 0,
    books: [],
    loading: false,
    error: "",
    bookId: null,
    bookMeta: null,
    bookText: "",
    textLoading: false,
    textError: "",
    engine: WEB_SPEECH_ENGINE_ID,
    engines: [],
    speechMonth: "",
    voice: "",
    rate: "1.0",
    readerFontSize: READER_FONT_DEFAULT,
    bookmarkNotice: "",
    ttsChunks: [],
    startChunkIndex: 0,
    translatedChunks: new Map(),
    listTranslated: new Map(),
    showKoreanText: false,
    translation: {
      running: false,
      current: 0,
      total: 0,
      error: "",
      scope: ""
    },
    tts: {
      playing: false,
      paused: false,
      chunkIndex: 0,
      status: "",
      testing: false,
      testStatus: ""
    }
  };

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeFilename(name) {
    return String(name || "book")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "book";
  }

  function formatCount(n) {
    if (n == null) return "—";
    return Number(n).toLocaleString("en-US");
  }

  function formatK(n) {
    const num = Number(n) || 0;
    if (num >= 1000) {
      const k = num / 1000;
      return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
    }
    return String(num);
  }

  function webSpeechSupported() {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    );
  }

  function buildWebSpeechEngineMeta() {
    return {
      id: WEB_SPEECH_ENGINE_ID,
      label: "브라우저 TTS (Web Speech)",
      configured: webSpeechSupported(),
      local: true,
      monthly_limit: 0,
      chars_used: 0,
      chunk_max: WEBSPEECH_CHUNK_MAX,
      hourly_limit: 0,
      hourly_used: 0,
      note: "이 기기 브라우저 내장 음성."
    };
  }

  function mergeEngineList(serverEngines) {
    const base = serverEngines?.length ? [...serverEngines] : [...FALLBACK_ENGINES];
    if (!base.some((e) => e.id === WEB_SPEECH_ENGINE_ID)) {
      base.push(buildWebSpeechEngineMeta());
    }
    return base;
  }

  function isWebSpeechEngine(engineId) {
    return (engineId || state.engine) === WEB_SPEECH_ENGINE_ID;
  }

  function ensureWebSpeechVoices() {
    if (!webSpeechSupported()) return [];
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) webSpeechVoicesCache = voices;
    return webSpeechVoicesCache;
  }

  function webSpeechVoiceOptions(mode) {
    const prefix = mode === "ko" ? "ko" : "en";
    return ensureWebSpeechVoices()
      .filter((v) => (v.lang || "").toLowerCase().startsWith(prefix))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => ({ id: v.voiceURI, label: `${v.name} (${v.lang})` }));
  }

  function defaultWebSpeechVoice(mode) {
    return webSpeechVoiceOptions(mode)[0]?.id || "";
  }

  function resolveWebSpeechVoice(voiceId) {
    ensureWebSpeechVoices();
    const byUri = webSpeechVoicesCache.find((v) => v.voiceURI === voiceId);
    if (byUri) return byUri;
    const options = webSpeechVoiceOptions(state.readMode);
    const fallbackId = options[0]?.id;
    if (!fallbackId) return null;
    return webSpeechVoicesCache.find((v) => v.voiceURI === fallbackId) || null;
  }

  function speakWebSpeechText(text, isActive) {
    return new Promise((resolve, reject) => {
      if (!webSpeechSupported()) {
        reject(new Error("이 브라우저는 Web Speech API를 지원하지 않습니다."));
        return;
      }
      if (!isActive()) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = resolveWebSpeechVoice(state.voice);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || (state.readMode === "ko" ? "ko-KR" : "en-US");
      utterance.rate = Math.max(0.25, Math.min(4, parseFloat(state.rate) || 1));
      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        const code = event.error || "unknown";
        if (code === "interrupted" || code === "canceled") {
          resolve();
          return;
        }
        if (code === "not-allowed") {
          reject(new Error("브라우저에서 음성 재생이 차단되었습니다."));
          return;
        }
        reject(new Error(`브라우저 TTS 오류: ${code}`));
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  function initWebSpeechVoices() {
    if (!webSpeechSupported()) return;
    ensureWebSpeechVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      webSpeechVoicesCache = window.speechSynthesis.getVoices();
      if (!pageRoot || state.engine !== WEB_SPEECH_ENGINE_ID) return;
      const valid = webSpeechVoicesCache.some((v) => v.voiceURI === state.voice);
      if (!valid) state.voice = defaultWebSpeechVoice(state.readMode);
      render();
    });
  }

  function engineList() {
    return state.engines.length ? state.engines : mergeEngineList([]);
  }

  function currentEngineMeta() {
    return engineList().find((e) => e.id === state.engine) || engineList()[0];
  }

  function chunkMaxForEngine() {
    return currentEngineMeta()?.chunk_max || 3200;
  }

  function isGoogleEngine() {
    return state.engine === "google";
  }

  function chunkUnitLabel() {
    if (isGoogleEngine()) return "512B";
    return `${formatK(chunkMaxForEngine())}자`;
  }

  function bookListDisplay(book) {
    if (shouldShowKoreanText() && state.listTranslated.has(book.id)) {
      const t = state.listTranslated.get(book.id);
      return {
        title: t.title || book.title,
        authors: t.authors || book.authors,
        pending: false
      };
    }
    return {
      title: book.title,
      authors: book.authors || "Unknown author",
      pending: shouldShowKoreanText() && state.translation.running
    };
  }

  function bookDisplayMeta() {
    const meta = state.bookMeta || {};
    if (shouldShowKoreanText() && meta.id && state.listTranslated.has(meta.id)) {
      const t = state.listTranslated.get(meta.id);
      return {
        ...meta,
        title: t.title || meta.title,
        authors: t.authors || meta.authors
      };
    }
    return meta;
  }

  function renderRateOptions() {
    return TTS_RATES.map(
      (rate) => `<option value="${rate}"${state.rate === rate ? " selected" : ""}>${rate}×</option>`
    ).join("");
  }

  function renderTranslateActions(extraButtonsHtml) {
    const listReady = state.view === "list" && state.books.length > 0 && !state.loading;
    const readerReady = state.view === "reader" && !!state.bookText && !state.textLoading;
    const canTranslate = listReady || readerReady;
    const busy = state.translation.running || (state.view === "reader" && state.textLoading);
    const showOriginal = shouldShowKoreanText() || state.translation.running;
    return `
      <div class="books-translate-actions">
        <button type="button" class="books-btn books-btn-translate" id="books-translate-btn"${canTranslate && !busy ? "" : " disabled"}>${state.translation.running ? "번역 중…" : "한글 번역"}</button>
        <button type="button" class="books-btn" id="books-original-btn"${showOriginal ? "" : " disabled"}>원문 보기</button>
        ${extraButtonsHtml || ""}
        <p class="books-translate-status${state.translation.running || state.translation.error || (shouldShowKoreanText() && (state.translatedChunks.size || state.listTranslated.size)) ? "" : " is-empty"}" id="books-translate-status"></p>
      </div>
    `;
  }

  function engineUsageHint() {
    const eng = currentEngineMeta();
    if (eng?.id === WEB_SPEECH_ENGINE_ID) {
      return `브라우저 TTS · ${chunkLimitHint()}`;
    }
    if (eng?.id === "freetts" && eng?.rate_limited) {
      return "FreeTTS 시간당 한도 도달";
    }
    if (eng?.configured) {
      let text = `${eng.label} · ${chunkLimitHint()}`;
      if (eng.id === "freetts" && eng.hourly_limit > 0) {
        text += ` · ${formatK(eng.hourly_used || 0)}/${formatK(eng.hourly_limit)}/h`;
      }
      return text;
    }
    return `${eng?.label || state.engine} 사용 불가`;
  }

  function chunkLimitHint() {
    if (isGoogleEngine()) return "구간 최대 512B(UTF-8)";
    const eng = currentEngineMeta();
    return `구간 최대 ${formatK(eng?.chunk_max || 3200)}자`;
  }

  function readerFontSizeLabel() {
    return `${Math.round((state.readerFontSize / READER_FONT_DEFAULT) * 100)}%`;
  }

  function setReaderFontSize(next) {
    state.readerFontSize = Math.max(
      READER_FONT_MIN,
      Math.min(READER_FONT_MAX, Math.round(next * 100) / 100)
    );
    localStorage.setItem(READER_FONT_STORAGE_KEY, String(state.readerFontSize));
    applyReaderFontSize();
  }

  function applyReaderFontSize() {
    if (!pageRoot) return;
    const el = pageRoot.querySelector("#books-reader-text");
    const label = pageRoot.querySelector("#books-font-size-label");
    if (el) el.style.fontSize = `${state.readerFontSize}rem`;
    if (label) label.textContent = readerFontSizeLabel();
    const downBtn = pageRoot.querySelector("#books-font-down");
    const upBtn = pageRoot.querySelector("#books-font-up");
    if (downBtn) downBtn.disabled = state.readerFontSize <= READER_FONT_MIN;
    if (upBtn) upBtn.disabled = state.readerFontSize >= READER_FONT_MAX;
  }

  function scrollToChunk(index) {
    if (!pageRoot) return;
    const idx = Math.max(0, Number(index) || 0);
    const chunkEl = pageRoot.querySelector(`.books-chunk[data-chunk="${idx}"]`);
    if (chunkEl) {
      chunkEl.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    updateChunkMarker();
  }

  function updateChunkMarker() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll(".books-chunk").forEach((el) => {
      const idx = Number(el.dataset.chunk);
      const isActive = state.tts.playing && idx === state.tts.chunkIndex;
      const isMarked = !state.tts.playing && idx === state.startChunkIndex;
      el.classList.toggle("books-chunk-active", isActive);
      el.classList.toggle("books-chunk-marked", isMarked && !isActive);
    });
  }

  function saveBookmark() {
    if (!state.bookId || !state.bookMeta || !state.ttsChunks.length) return;
    const chunkIndex = state.tts.playing ? state.tts.chunkIndex : state.startChunkIndex;
    const bookmark = {
      id: `${state.bookId}-${Date.now()}`,
      bookId: state.bookId,
      title: state.bookMeta.title || "",
      authors: state.bookMeta.authors || "",
      chunkIndex,
      chunkTotal: state.ttsChunks.length,
      readMode: state.readMode,
      savedAt: new Date().toISOString()
    };
    const bookmarks = loadBookmarks().filter(
      (item) => !(item.bookId === bookmark.bookId && item.chunkIndex === bookmark.chunkIndex)
    );
    bookmarks.unshift(bookmark);
    persistBookmarks(bookmarks);
    state.bookmarkNotice = `책갈피 저장 (${chunkIndex + 1}/${bookmark.chunkTotal}구간)`;
    render();
    window.setTimeout(() => {
      if (state.bookmarkNotice.startsWith("책갈피 저장")) {
        state.bookmarkNotice = "";
        const noticeEl = pageRoot?.querySelector("#books-bookmark-notice");
        if (noticeEl) {
          noticeEl.textContent = "";
          noticeEl.classList.add("is-empty");
        }
      }
    }, 2400);
  }

  function removeBookmark(bookmarkId) {
    persistBookmarks(loadBookmarks().filter((item) => item.id !== bookmarkId));
    render();
  }

  function loadBookmark(bookmarkId) {
    const bookmark = loadBookmarks().find((item) => item.id === bookmarkId);
    if (!bookmark) return;
    stopTts();
    stopTranslation();
    state.readMode = bookmark.readMode || "en";
    state.showKoreanText = state.readMode === "ko";
    state.voice = defaultVoiceForMode(state.readMode, state.engine);
    openReader(
      {
        id: bookmark.bookId,
        title: bookmark.title,
        authors: bookmark.authors
      },
      { chunkIndex: bookmark.chunkIndex, scrollToChunk: bookmark.chunkIndex }
    );
  }

  function utf8ByteLength(str) {
    return new TextEncoder().encode(String(str || "")).length;
  }

  function engineConfigured(engineId) {
    if (isWebSpeechEngine(engineId)) return webSpeechSupported();
    const meta = engineList().find((e) => e.id === engineId);
    return meta ? !!meta.configured : false;
  }

  function defaultVoiceForMode(mode, engine) {
    const eng = engine || state.engine;
    if (eng === WEB_SPEECH_ENGINE_ID) {
      return defaultWebSpeechVoice(mode) || (mode === "ko" ? "ko-KR" : "en-US");
    }
    if (eng === "google") {
      return mode === "ko" ? "ko-KR-Neural2-A" : "en-US-Neural2-A";
    }
    return mode === "ko" ? "ko-KR-SunHiNeural" : "en-US-JennyNeural";
  }

  function voicesForMode(mode) {
    if (state.engine === WEB_SPEECH_ENGINE_ID) {
      const options = webSpeechVoiceOptions(mode);
      if (options.length) return options;
      return [{ id: mode === "ko" ? "ko-KR" : "en-US", label: mode === "ko" ? "기본 한국어" : "Default English" }];
    }
    const meta = currentEngineMeta();
    const catalog = meta?.voices || [];
    let allowed;
    if (state.engine === "google") {
      allowed = mode === "ko" ? KO_VOICES_GOOGLE : EN_VOICES_GOOGLE;
    } else {
      allowed = mode === "ko" ? KO_VOICES_FREETTS : EN_VOICES_FREETTS;
    }
    if (!catalog.length) {
      return allowed.map((id) => ({ id, label: id }));
    }
    return catalog.filter((v) => allowed.includes(v.id));
  }

  function refreshChunks() {
    if (!state.bookText) {
      state.ttsChunks = [];
      state.startChunkIndex = 0;
      return;
    }
    const prepared = prepareBookText(state.bookText);
    state.ttsChunks = isGoogleEngine()
      ? splitIntoByteChunks(prepared, GOOGLE_CHUNK_BYTES)
      : splitIntoChunks(prepared, chunkMaxForEngine());
    if (state.startChunkIndex >= state.ttsChunks.length) {
      state.startChunkIndex = 0;
    }
  }

  function genrePreview(book) {
    const shelves = (book.bookshelves || []).filter(Boolean);
    const subjects = (book.subjects || []).filter(Boolean);
    for (const shelf of shelves) {
      if (shelf.startsWith("Category: ")) return shelf.slice("Category: ".length);
      if (!shelf.startsWith("Browsing: ")) {
        return shelf.length > 56 ? `${shelf.slice(0, 53)}…` : shelf;
      }
    }
    if (subjects.length) {
      const subject = subjects[0];
      return subject.length > 56 ? `${subject.slice(0, 53)}…` : subject;
    }
    return "General";
  }

  function stripGutenbergBoilerplate(text) {
    const startMark = text.search(/\*\*\*\s*START OF (THIS|THE) PROJECT GUTENBERG/i);
    const endMark = text.search(/\*\*\*\s*END OF (THIS|THE) PROJECT GUTENBERG/i);
    if (startMark !== -1 && endMark !== -1 && endMark > startMark) {
      const bodyStart = text.indexOf("\n", startMark);
      return text.slice(bodyStart > -1 ? bodyStart + 1 : startMark, endMark).trim();
    }
    return text.trim();
  }

  function prepareBookText(raw) {
    return stripGutenbergBoilerplate(String(raw || ""))
      .replace(/\r\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  function splitIntoChunks(text, maxLen) {
    const limit = maxLen || chunkMaxForEngine();
    const chunks = [];
    const paragraphs = text.split(/\n\n+/);
    let buf = "";

    function pushChunk(part) {
      const trimmed = String(part || "").trim();
      if (trimmed) chunks.push(trimmed);
    }

    for (const para of paragraphs) {
      const piece = para.trim();
      if (!piece) continue;

      if (piece.length > limit) {
        pushChunk(buf);
        buf = "";
        const sentences = piece.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [piece];
        let sbuf = "";
        for (const sentence of sentences) {
          const s = sentence.trim();
          if (!s) continue;
          if (s.length > limit) {
            pushChunk(sbuf);
            sbuf = "";
            for (let i = 0; i < s.length; i += limit) {
              chunks.push(s.slice(i, i + limit));
            }
            continue;
          }
          const next = sbuf ? sbuf + s : s;
          if (next.length > limit) {
            pushChunk(sbuf);
            sbuf = s;
          } else {
            sbuf = next;
          }
        }
        pushChunk(sbuf);
        continue;
      }

      const next = buf ? `${buf}\n\n${piece}` : piece;
      if (next.length > limit) {
        pushChunk(buf);
        buf = piece;
      } else {
        buf = next;
      }
    }
    pushChunk(buf);
    return chunks;
  }

  function splitIntoByteChunks(text, maxBytes) {
    const limit = maxBytes || GOOGLE_CHUNK_BYTES;
    const chunks = [];
    const paragraphs = text.split(/\n\n+/);
    let buf = "";

    function pushChunk(part) {
      const trimmed = String(part || "").trim();
      if (trimmed) chunks.push(trimmed);
    }

    function flushHard(str) {
      const bytes = new TextEncoder().encode(str);
      let start = 0;
      while (start < bytes.length) {
        let end = Math.min(start + limit, bytes.length);
        while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
          end -= 1;
        }
        const slice = new TextDecoder().decode(bytes.slice(start, end)).trim();
        if (slice) chunks.push(slice);
        start = end;
      }
    }

    for (const para of paragraphs) {
      const piece = para.trim();
      if (!piece) continue;

      if (utf8ByteLength(piece) > limit) {
        pushChunk(buf);
        buf = "";
        const sentences = piece.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [piece];
        let sbuf = "";
        for (const sentence of sentences) {
          const s = sentence.trim();
          if (!s) continue;
          if (utf8ByteLength(s) > limit) {
            pushChunk(sbuf);
            sbuf = "";
            flushHard(s);
            continue;
          }
          const next = sbuf ? sbuf + s : s;
          if (utf8ByteLength(next) > limit) {
            pushChunk(sbuf);
            sbuf = s;
          } else {
            sbuf = next;
          }
        }
        pushChunk(sbuf);
        continue;
      }

      const next = buf ? `${buf}\n\n${piece}` : piece;
      if (utf8ByteLength(next) > limit) {
        pushChunk(buf);
        buf = piece;
      } else {
        buf = next;
      }
    }
    pushChunk(buf);
    return chunks;
  }

  function themeList() {
    if (!state.themes.length) return THEME_CATALOG;
    return state.themes.map((t) => {
      const local = THEME_CATALOG.find((x) => x.id === t.id);
      return local ? { ...local, ...t, book_ids: local.book_ids } : t;
    });
  }

  function themeMeta(themeId) {
    return THEME_CATALOG.find((t) => t.id === themeId) || themeList().find((t) => t.id === themeId);
  }

  async function fetchBooksByIds(ids, signal) {
    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`${apiBase()}/api/gutenberg/books/${id}`, { signal });
          if (!res.ok) return null;
          return res.json();
        } catch (err) {
          if (err.name === "AbortError") throw err;
          return null;
        }
      })
    );
    return rows.filter(Boolean);
  }

  async function fetchThemeBooksClient(themeId, search, page, signal) {
    const meta = themeMeta(themeId);
    if (!meta?.book_ids?.length) {
      throw new Error("알 수 없는 테마입니다.");
    }
    let books = await fetchBooksByIds(meta.book_ids, signal);
    books.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    const q = (search || "").trim().toLowerCase();
    if (q) {
      books = books.filter((b) => `${b.title || ""} ${b.authors || ""}`.toLowerCase().includes(q));
    }
    const total = books.length;
    const start = (page - 1) * THEME_PAGE_SIZE;
    return {
      count: total,
      page,
      results: books.slice(start, start + THEME_PAGE_SIZE),
      theme: themeId,
      theme_label: meta.label,
      theme_description: meta.description
    };
  }

  function applyBooksPayload(data) {
    state.books = data.results || [];
    state.count = data.count ?? state.books.length;
    if (data.theme) {
      state.themeLabel = data.theme_label || themeMeta(data.theme)?.label || "";
      state.themeDescription = data.theme_description || themeMeta(data.theme)?.description || "";
    } else if (!state.theme) {
      state.themeLabel = "";
      state.themeDescription = "";
    }
  }

  function buildBooksUrl() {
    const url = new URL(`${apiBase()}/api/gutenberg/books`);
    url.searchParams.set("languages", "en");
    url.searchParams.set("page", String(state.page));
    if (state.theme) {
      url.searchParams.set("theme", state.theme);
      if (state.search.trim()) url.searchParams.set("search", state.search.trim());
      return url.href;
    }
    if (state.search.trim()) url.searchParams.set("search", state.search.trim());
    if (state.topic) url.searchParams.set("topic", state.topic);
    if (state.authorYear) url.searchParams.set("author_year", state.authorYear);
    return url.href;
  }

  async function fetchThemes() {
    try {
      const res = await fetch(`${apiBase()}/api/gutenberg/themes`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.themes) && data.themes.length) {
        state.themes = data.themes;
      } else {
        state.themes = THEME_CATALOG;
      }
    } catch (_) {
      state.themes = THEME_CATALOG;
    }
  }

  async function fetchSpeechStatus() {
    try {
      const res = await fetch(`${apiBase()}/api/books/speech/status`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        state.engines = mergeEngineList(data.engines || []);
        state.speechMonth = data.month || "";
        const preferred =
          state.engines.find((e) => e.id === WEB_SPEECH_ENGINE_ID && e.configured)?.id ||
          state.engines.find((e) => e.id === "google" && e.configured)?.id ||
          data.default_engine ||
          state.engines.find((e) => e.configured)?.id ||
          WEB_SPEECH_ENGINE_ID;
        if (!state.bookId) {
          state.engine = preferred;
          state.voice = defaultVoiceForMode(state.readMode, state.engine);
        }
      }
    } catch (_) {
      state.engines = mergeEngineList(FALLBACK_ENGINES);
    }
    updateUsageFooter();
    updateTestUI();
  }

  function formatTtsError(detail) {
    const text = String(detail || "");
    if (text.includes("Hourly limit") || text.includes("시간당 한도")) {
      return text;
    }
    if (text.includes("FreeTTS")) return text;
    if (text.includes("Google Cloud TTS")) return text;
    if (text.includes("PERMISSION_DENIED") || text.includes("blocked")) {
      return (
        "Google TTS가 차단되었습니다. GCP에서 Text-to-Speech API 활성화 후, " +
        "API 키의 '애플리케이션 제한'을 없음으로, 'API 제한'에 Text-to-Speech를 추가하세요."
      );
    }
    return text || "음성 합성에 실패했습니다.";
  }

  function applyTtsUsageHeaders(res) {
    const engineId = res.headers.get("X-TTS-Engine") || state.engine;
    const monthlyUsed = res.headers.get("X-TTS-Monthly-Used");
    const monthlyLimit = res.headers.get("X-TTS-Monthly-Limit");
    const hourlyUsed = res.headers.get("X-TTS-Hourly-Used");
    const hourlyLimit = res.headers.get("X-TTS-Hourly-Limit");
    const idx = state.engines.findIndex((e) => e.id === engineId);
    if (idx === -1) return;
    if (monthlyUsed != null) state.engines[idx].chars_used = Number(monthlyUsed);
    if (monthlyLimit != null) state.engines[idx].monthly_limit = Number(monthlyLimit);
    if (hourlyUsed != null) state.engines[idx].hourly_used = Number(hourlyUsed);
    if (hourlyLimit != null) state.engines[idx].hourly_limit = Number(hourlyLimit);
    if (engineId === "freetts" && hourlyLimit) {
      const limit = Number(hourlyLimit);
      const used = Number(hourlyUsed || 0);
      state.engines[idx].configured = used < limit;
      state.engines[idx].rate_limited = used >= limit;
    }
    updateUsageFooter();
    updateTestUI();
  }

  async function fetchBooks() {
    if (listAbort) listAbort.abort();
    listAbort = new AbortController();
    const signal = listAbort.signal;

    state.loading = true;
    state.error = "";
    render();

    try {
      let data;
      if (state.theme) {
        const res = await fetch(buildBooksUrl(), { signal });
        data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || `목록을 불러오지 못했습니다 (${res.status})`);
        }
        if (data.theme !== state.theme) {
          data = await fetchThemeBooksClient(state.theme, state.search, state.page, signal);
        }
      } else {
        const res = await fetch(buildBooksUrl(), { signal });
        data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || `목록을 불러오지 못했습니다 (${res.status})`);
        }
      }
      applyBooksPayload(data);
      if (state.theme && !state.themeLabel) {
        const meta = themeMeta(state.theme);
        state.themeLabel = meta?.label || "";
        state.themeDescription = meta?.description || "";
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      state.books = [];
      state.error = err.message || "목록을 불러오지 못했습니다.";
    } finally {
      state.loading = false;
      render();
      if (state.view === "list" && shouldShowKoreanText() && state.books.some((b) => !state.listTranslated.has(b.id))) {
        void translateListBooks();
      }
    }
  }

  async function fetchBookText(bookId, options) {
    if (textAbort) textAbort.abort();
    textAbort = new AbortController();
    const signal = textAbort.signal;
    const preserveStartChunk = !!options?.preserveStartChunk;

    state.textLoading = true;
    state.textError = "";
    state.bookText = "";
    state.ttsChunks = [];
    if (!preserveStartChunk) {
      state.startChunkIndex = 0;
    }
    state.translatedChunks = new Map();
    if (!options?.preserveListTranslations) {
      state.listTranslated = new Map();
    }
    state.showKoreanText = state.readMode === "ko";
    state.translation = { running: false, current: 0, total: 0, error: "", scope: "" };
    render();

    try {
      const res = await fetch(`${apiBase()}/api/gutenberg/text/${bookId}`, { signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `본문을 불러오지 못했습니다 (${res.status})`);
      }
      state.bookMeta = {
        id: data.id,
        title: data.title,
        authors: data.authors
      };
      state.bookText = data.text || "";
      refreshChunks();
      if (state.startChunkIndex >= state.ttsChunks.length) {
        state.startChunkIndex = 0;
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      state.textError = err.message || "본문을 불러오지 못했습니다.";
    } finally {
      state.textLoading = false;
      render();
      applyReaderFontSize();
      const scrollAfterLoad = pendingReaderScrollChunk != null;
      const scrollTarget = scrollAfterLoad ? pendingReaderScrollChunk : state.startChunkIndex;
      pendingReaderScrollChunk = null;
      if (scrollAfterLoad && state.ttsChunks.length) {
        window.requestAnimationFrame(() => scrollToChunk(scrollTarget));
      }
      if (state.readMode === "ko" && state.bookText && state.ttsChunks.length) {
        void translateAllChunks();
      }
    }
  }

  function shouldShowKoreanText() {
    return state.showKoreanText || state.readMode === "ko";
  }

  function stopTranslation() {
    translateSessionId += 1;
    if (translateAbort) {
      translateAbort.abort();
      translateAbort = null;
    }
    state.translation.running = false;
    updateTranslationUI();
  }

  async function fetchTranslation(text, signal) {
    const res = await fetch(`${apiBase()}/api/books/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target: "ko" }),
      signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `번역 실패 (${res.status})`);
    }
    return data.text || text;
  }

  async function translateChunk(text) {
    if (ttsAbort) ttsAbort.abort();
    ttsAbort = new AbortController();
    return fetchTranslation(text, ttsAbort.signal);
  }

  async function ensureBookMetaTranslated(signal, session) {
    const meta = state.bookMeta;
    if (!meta?.id || state.listTranslated.has(meta.id)) return;
    try {
      const payload = `${meta.title || ""}\n|\n${meta.authors || ""}`;
      const translated = await fetchTranslation(payload, signal);
      if (session !== translateSessionId) return;
      const splitAt = translated.indexOf("\n|\n");
      const title = splitAt === -1 ? translated.trim() : translated.slice(0, splitAt).trim();
      const authors =
        splitAt === -1 ? meta.authors || "" : translated.slice(splitAt + 3).trim();
      state.listTranslated.set(meta.id, { title, authors });
      updateListTextOnly();
    } catch (err) {
      if (err.name === "AbortError") throw err;
    }
  }

  async function translateAllChunks() {
    if (!state.bookText || !state.ttsChunks.length) return;
    if (state.translation.running) return;

    const session = ++translateSessionId;
    if (translateAbort) translateAbort.abort();
    translateAbort = new AbortController();
    const signal = translateAbort.signal;

    state.showKoreanText = true;
    state.translation = {
      running: true,
      current: 0,
      total: state.ttsChunks.length,
      error: "",
      scope: "reader"
    };
    updateTranslationUI();
    render();

    try {
      await ensureBookMetaTranslated(signal, session);
    } catch (err) {
      if (err.name === "AbortError") return;
    }

    for (let i = 0; i < state.ttsChunks.length; i++) {
      if (session !== translateSessionId) return;
      if (state.translatedChunks.has(i)) continue;
      state.translation.current = i + 1;
      updateTranslationUI();
      try {
        const translated = await fetchTranslation(state.ttsChunks[i], signal);
        if (session !== translateSessionId) return;
        state.translatedChunks.set(i, translated);
        updateReaderTextOnly();
        updateTranslationUI();
      } catch (err) {
        if (err.name === "AbortError") return;
        state.translation.error = err.message || "번역 실패";
        break;
      }
    }

    if (session !== translateSessionId) return;
    state.translation.running = false;
    updateTranslationUI();
    render();
  }

  async function translateListBooks() {
    if (!state.books.length || state.translation.running) return;

    const pending = state.books.filter((book) => !state.listTranslated.has(book.id));
    if (!pending.length) {
      state.showKoreanText = true;
      updateTranslationUI();
      updateListTextOnly();
      render();
      return;
    }

    const session = ++translateSessionId;
    if (translateAbort) translateAbort.abort();
    translateAbort = new AbortController();
    const signal = translateAbort.signal;

    state.showKoreanText = true;
    state.translation = {
      running: true,
      current: 0,
      total: pending.length,
      error: "",
      scope: "list"
    };
    updateTranslationUI();
    render();

    for (let i = 0; i < pending.length; i++) {
      if (session !== translateSessionId) return;
      const book = pending[i];
      state.translation.current = i + 1;
      updateTranslationUI();
      try {
        const payload = `${book.title || ""}\n|\n${book.authors || "Unknown author"}`;
        const translated = await fetchTranslation(payload, signal);
        if (session !== translateSessionId) return;
        const splitAt = translated.indexOf("\n|\n");
        const title = splitAt === -1 ? translated.trim() : translated.slice(0, splitAt).trim();
        const authors =
          splitAt === -1 ? book.authors || "Unknown author" : translated.slice(splitAt + 3).trim();
        state.listTranslated.set(book.id, { title, authors });
        updateListTextOnly();
        updateTranslationUI();
      } catch (err) {
        if (err.name === "AbortError") return;
        state.translation.error = err.message || "번역 실패";
        break;
      }
    }

    if (session !== translateSessionId) return;
    state.translation.running = false;
    updateTranslationUI();
    render();
  }

  function showOriginalText() {
    state.showKoreanText = false;
    stopTranslation();
    updateReaderTextOnly();
    updateTranslationUI();
    render();
  }

  function startKoreanTranslation() {
    if (state.translation.running) return;
    if (state.view === "list") {
      if (!state.books.length || state.loading) return;
      void translateListBooks();
      return;
    }
    if (!state.bookText || state.textLoading) return;
    if (!state.ttsChunks.length) refreshChunks();
    state.showKoreanText = true;
    const allDone =
      state.ttsChunks.length > 0 &&
      state.ttsChunks.every((_, i) => state.translatedChunks.has(i));
    if (allDone) {
      updateReaderTextOnly();
      updateTranslationUI();
      render();
      return;
    }
    void translateAllChunks();
  }

  function updateTranslationUI() {
    if (!pageRoot) return;
    const translateBtn = pageRoot.querySelector("#books-translate-btn");
    const originalBtn = pageRoot.querySelector("#books-original-btn");
    const statusEl = pageRoot.querySelector("#books-translate-status");
    const listReady = state.view === "list" && state.books.length > 0 && !state.loading;
    const readerReady = state.view === "reader" && !!state.bookText && !state.textLoading;
    const busy = state.translation.running || (state.view === "reader" && state.textLoading);
    if (translateBtn) {
      translateBtn.disabled = busy || !(listReady || readerReady);
      translateBtn.textContent = state.translation.running ? "번역 중…" : "한글 번역";
    }
    if (originalBtn) {
      originalBtn.disabled = busy || (!shouldShowKoreanText() && !state.translation.running);
    }
    if (statusEl) {
      let msg = state.translation.error || "";
      if (!msg && state.translation.running) {
        const scopeLabel = state.translation.scope === "list" ? "목록" : "본문";
        msg = `한글 번역 중… ${scopeLabel} ${state.translation.current}/${state.translation.total}`;
      } else if (!msg && shouldShowKoreanText()) {
        if (state.view === "reader" && state.translatedChunks.size) {
          msg = `한글 번역 ${state.translatedChunks.size}/${state.ttsChunks.length}구간`;
        } else if (state.view === "list" && state.listTranslated.size) {
          msg = `목록 번역 ${state.listTranslated.size}/${state.books.length}권`;
        }
      }
      statusEl.textContent = msg;
      statusEl.classList.toggle("is-empty", !msg);
    }
  }

  function updateListTextOnly() {
    if (!pageRoot || state.view !== "list") return;
    state.books.forEach((book) => {
      const card = pageRoot.querySelector(`[data-list-book-id="${book.id}"]`);
      if (!card) return;
      const display = bookListDisplay(book);
      const titleEl = card.querySelector(".books-card-title");
      const authorEl = card.querySelector(".books-card-author");
      if (titleEl) titleEl.textContent = display.title || "";
      if (authorEl) authorEl.textContent = display.authors || "";
      card.classList.toggle("books-card-pending", !!display.pending);
    });
    const meta = bookDisplayMeta();
    const titleEl = pageRoot.querySelector(".books-reader-title");
    const authorEl = pageRoot.querySelector(".books-reader-author");
    if (titleEl) titleEl.textContent = meta.title || "";
    if (authorEl) authorEl.textContent = meta.authors || "";
  }

  async function playTtsBlob(text, sessionId, onStatus) {
    if (isGoogleEngine() && utf8ByteLength(text) > GOOGLE_CHUNK_BYTES) {
      const subChunks = splitIntoByteChunks(text, GOOGLE_CHUNK_BYTES);
      for (let i = 0; i < subChunks.length; i++) {
        if (sessionId !== ttsSessionId) return;
        if (onStatus) onStatus(i + 1, subChunks.length);
        const blob = await fetchTtsAudio(subChunks[i]);
        if (sessionId !== ttsSessionId) return;
        await playAudioBlob(blob, sessionId);
        if (sessionId !== ttsSessionId) return;
      }
      return;
    }

    const blob = await fetchTtsAudio(text);
    if (sessionId !== ttsSessionId) return;
    await playAudioBlob(blob, sessionId);
  }

  function playAudioBlob(blob, sessionId) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      currentAudio = new Audio(url);
      currentAudio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        resolve();
      };
      currentAudio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        reject(new Error("오디오 재생 오류"));
      };
      currentAudio.play().catch(reject);
    }).then(() => {
      if (sessionId !== ttsSessionId) return;
    });
  }

  async function fetchTtsAudio(text) {
    if (ttsAbort) ttsAbort.abort();
    ttsAbort = new AbortController();
    const res = await fetch(`${apiBase()}/api/books/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        engine: state.engine,
        voice: state.voice,
        rate: state.rate,
        lang: state.readMode === "ko" ? "ko" : "en"
      }),
      signal: ttsAbort.signal
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(formatTtsError(data.detail || `음성 합성 실패 (${res.status})`));
    }
    applyTtsUsageHeaders(res);
    return res.blob();
  }

  function stopTts() {
    ttsSessionId += 1;
    testSessionId += 1;
    state.tts.playing = false;
    state.tts.paused = false;
    state.tts.status = "";
    state.tts.testing = false;
    state.tts.testStatus = "";
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
    }
    if (webSpeechSupported()) {
      window.speechSynthesis.cancel();
    }
    if (ttsAbort) {
      ttsAbort.abort();
      ttsAbort = null;
    }
    updatePlayerUI();
    updateReaderHighlight();
    updateTestUI();
  }

  function setTestStatus(message) {
    state.tts.testStatus = message;
    updateTestUI();
  }

  function updateTestUI() {
    if (!pageRoot) return;
    const btn = pageRoot.querySelector("#books-tts-test");
    const statusEl = pageRoot.querySelector("#books-tts-test-status");
    if (btn) {
      const busy = state.tts.testing || state.tts.playing;
      btn.disabled = !engineConfigured(state.engine) || busy;
      btn.textContent = state.tts.testing ? "테스트 중…" : "Test 듣기";
    }
    if (statusEl) {
      statusEl.textContent = state.tts.testStatus || "";
      statusEl.classList.toggle("is-empty", !state.tts.testStatus);
    }
  }

  async function playTtsTest() {
    if (!engineConfigured(state.engine)) {
      const eng = currentEngineMeta();
      setTestStatus(
        eng?.rate_limited ? "시간 한도 도달" : "선택한 엔진을 사용할 수 없습니다."
      );
      return;
    }

    stopTts();
    const session = ++testSessionId;
    state.tts.testing = true;
    setTestStatus("음성 합성 중…");

    try {
      let text = TTS_TEST_SAMPLE_EN;
      if (state.readMode === "ko") {
        setTestStatus("번역 중…");
        text = await translateChunk(text);
        if (session !== testSessionId) return;
        setTestStatus("음성 합성 중…");
      }

      if (isWebSpeechEngine(state.engine)) {
        setTestStatus("재생 중…");
        await speakWebSpeechText(text, () => session === testSessionId);
        if (session !== testSessionId) return;
        state.tts.testing = false;
        setTestStatus("테스트 완료");
        return;
      }

      const blob = await fetchTtsAudio(text);
      if (session !== testSessionId) return;

      const url = URL.createObjectURL(blob);
      currentAudio = new Audio(url);
      currentAudio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        if (session !== testSessionId) return;
        state.tts.testing = false;
        setTestStatus("테스트 완료");
      };
      currentAudio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        state.tts.testing = false;
        setTestStatus("테스트 재생 오류");
      };

      setTestStatus("재생 중…");
      await currentAudio.play();
    } catch (err) {
      if (err.name === "AbortError") return;
      state.tts.testing = false;
      setTestStatus(formatTtsError(err.message));
    }
  }

  function setTtsStatus(message) {
    state.tts.status = message;
    updatePlayerUI();
  }

  async function playFromChunk(index, sessionId) {
    if (sessionId !== ttsSessionId) return;

    if (index >= state.ttsChunks.length) {
      stopTts();
      setTtsStatus("재생 완료");
      return;
    }

    state.tts.chunkIndex = index;
    state.tts.playing = true;
    state.tts.paused = false;
    updatePlayerUI();
    updateReaderHighlight();

    try {
      let text = state.ttsChunks[index];
      if (state.readMode === "ko") {
        if (!state.translatedChunks.has(index)) {
          setTtsStatus(`번역 중… (${index + 1}/${state.ttsChunks.length})`);
          text = await translateChunk(text);
          if (sessionId !== ttsSessionId) return;
          state.translatedChunks.set(index, text);
          updateReaderTextOnly();
        } else {
          text = state.translatedChunks.get(index);
        }
      }

      setTtsStatus(`음성 합성 중… (${index + 1}/${state.ttsChunks.length})`);

      if (isWebSpeechEngine(state.engine)) {
        setTtsStatus(`재생 중 (${index + 1}/${state.ttsChunks.length})`);
        await speakWebSpeechText(text, () => sessionId === ttsSessionId);
        if (sessionId !== ttsSessionId) return;
        void playFromChunk(index + 1, sessionId);
        return;
      }

      await playTtsBlob(text, sessionId, (subIdx, subTotal) => {
        if (subTotal > 1) {
          setTtsStatus(`재생 중 (${index + 1}/${state.ttsChunks.length}) · ${subIdx}/${subTotal}`);
        } else {
          setTtsStatus(`재생 중 (${index + 1}/${state.ttsChunks.length})`);
        }
      });
      if (sessionId !== ttsSessionId) return;
      void playFromChunk(index + 1, sessionId);
    } catch (err) {
      if (err.name === "AbortError") return;
      stopTts();
      setTtsStatus(err.message || "듣기 실패");
    }
  }

  function startTts() {
    if (!state.bookText || !state.ttsChunks.length) return;
    if (!engineConfigured(state.engine)) {
      setTtsStatus(
        isWebSpeechEngine(state.engine)
          ? "이 브라우저는 Web Speech API를 지원하지 않습니다."
          : `${currentEngineMeta()?.label || state.engine} 엔진이 서버에 설정되지 않았습니다.`
      );
      updatePlayerUI();
      return;
    }
    stopTts();
    const sessionId = ttsSessionId;
    void playFromChunk(state.startChunkIndex, sessionId);
  }

  function pauseTts() {
    if (isWebSpeechEngine(state.engine)) {
      if (!state.tts.playing || state.tts.paused) return;
      window.speechSynthesis.pause();
      state.tts.paused = true;
      setTtsStatus("일시정지");
      updatePlayerUI();
      return;
    }
    if (!currentAudio || !state.tts.playing) return;
    currentAudio.pause();
    state.tts.paused = true;
    setTtsStatus("일시정지");
    updatePlayerUI();
  }

  function resumeTts() {
    if (isWebSpeechEngine(state.engine)) {
      if (!state.tts.paused) return;
      window.speechSynthesis.resume();
      state.tts.paused = false;
      setTtsStatus(`재생 중 (${state.tts.chunkIndex + 1}/${state.ttsChunks.length})`);
      updatePlayerUI();
      return;
    }
    if (!currentAudio || !state.tts.paused) return;
    state.tts.paused = false;
    void currentAudio.play();
    setTtsStatus(`재생 중 (${state.tts.chunkIndex + 1}/${state.ttsChunks.length})`);
    updatePlayerUI();
  }

  function openReader(book, options) {
    stopTts();
    state.view = "reader";
    state.bookId = book.id;
    state.bookMeta = {
      id: book.id,
      title: book.title,
      authors: book.authors
    };
    state.bookText = "";
    state.textError = "";
    state.translatedChunks = new Map();
    state.translation = { running: false, current: 0, total: 0, error: "", scope: "" };
    state.ttsChunks = [];
    state.startChunkIndex = options?.chunkIndex ?? 0;
    pendingReaderScrollChunk =
      options?.scrollToChunk != null ? options.scrollToChunk : null;
    render();
    void fetchBookText(book.id, {
      preserveStartChunk: options?.chunkIndex != null,
      preserveListTranslations: !!options?.preserveListTranslations
    });
  }

  function backToList() {
    stopTts();
    stopTranslation();
    state.view = "list";
    state.bookId = null;
    state.bookMeta = null;
    state.bookText = "";
    state.textError = "";
    state.ttsChunks = [];
    state.startChunkIndex = 0;
    state.translatedChunks = new Map();
    state.listTranslated = new Map();
    state.showKoreanText = false;
    state.translation = { running: false, current: 0, total: 0, error: "", scope: "" };
    if (textAbort) textAbort.abort();
    render();
  }

  function setEngine(engineId) {
    if (state.engine === engineId) return;
    stopTts();
    state.engine = engineId;
    state.voice = defaultVoiceForMode(state.readMode, engineId);
    state.translatedChunks = new Map();
    state.showKoreanText = false;
    state.startChunkIndex = 0;
    state.translation = { running: false, current: 0, total: 0, error: "" };
    refreshChunks();
    render();
  }

  function setReadMode(mode) {
    if (state.readMode === mode) return;
    stopTts();
    state.readMode = mode;
    state.voice = defaultVoiceForMode(mode, state.engine);
    state.showKoreanText = mode === "ko";
    if (mode === "ko" && state.bookText && state.ttsChunks.length) {
      const missing = state.ttsChunks.some((_, i) => !state.translatedChunks.has(i));
      if (missing) void translateAllChunks();
    }
    if (mode === "ko" && state.view === "list" && state.books.some((b) => !state.listTranslated.has(b.id))) {
      void translateListBooks();
    }
    render();
  }

  function downloadCurrentText() {
    if (!state.bookText || !state.bookMeta) return;
    const useKo = shouldShowKoreanText() && state.translatedChunks.size > 0;
    const text = useKo
      ? state.ttsChunks
          .map((chunk, i) => state.translatedChunks.get(i) || chunk)
          .join("\n\n")
      : prepareBookText(state.bookText);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const suffix = useKo ? "_ko" : "";
    a.download = `${sanitizeFilename(state.bookMeta.title)}${suffix}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderModeNav() {
    return `
      <nav class="books-mode-nav" aria-label="읽기 모드">
        <button type="button" class="books-mode-btn${state.readMode === "en" ? " active" : ""}" data-read-mode="en">영문 읽기</button>
        <button type="button" class="books-mode-btn${state.readMode === "ko" ? " active" : ""}" data-read-mode="ko">번역 읽기</button>
      </nav>
    `;
  }

  function renderFilters() {
    const themeOptions = [
      `<option value="">전체 탐색</option>`,
      ...themeList().map(
        (t) =>
          `<option value="${escapeHtml(t.id)}"${t.id === state.theme ? " selected" : ""}>${escapeHtml(t.label)}</option>`
      )
    ].join("");
    const themeLocked = !!state.theme;
    const themeBanner =
      state.theme && state.themeLabel
        ? `<p class="books-theme-banner">${escapeHtml(state.themeLabel)}${state.themeDescription ? ` — ${escapeHtml(state.themeDescription)}` : ""}</p>`
        : "";
    return `
      <form class="books-filters" id="books-filters">
        <label class="books-field books-field-theme">
          <span class="books-label">테마</span>
          <select name="theme" class="books-select" id="books-theme-select">${themeOptions}</select>
        </label>
        <label class="books-field books-field-search">
          <span class="books-label">검색</span>
          <input type="search" name="search" class="books-input" placeholder="${themeLocked ? "이 테마 안에서 검색" : "제목·작가·키워드"}" value="${escapeHtml(state.search)}" autocomplete="off">
        </label>
        <label class="books-field">
          <span class="books-label">장르</span>
          <select name="topic" class="books-select"${themeLocked ? " disabled" : ""}>
            ${TOPICS.map(
              (t) =>
                `<option value="${escapeHtml(t.id)}"${t.id === state.topic ? " selected" : ""}>${escapeHtml(t.label)}</option>`
            ).join("")}
          </select>
        </label>
        <label class="books-field">
          <span class="books-label">시대</span>
          <select name="author_year" class="books-select"${themeLocked ? " disabled" : ""}>
            ${AUTHOR_YEARS.map(
              (y) =>
                `<option value="${escapeHtml(y.id)}"${y.id === state.authorYear ? " selected" : ""}>${escapeHtml(y.label)}</option>`
            ).join("")}
          </select>
        </label>
        <button type="submit" class="books-btn books-btn-primary">검색</button>
      </form>
      ${themeBanner}
    `;
  }

  function renderEngineSelect() {
    const options = engineList()
      .map((e) => {
        let suffix = "";
        if (!e.configured) {
          suffix = e.id === WEB_SPEECH_ENGINE_ID ? " (미지원)" : e.rate_limited ? " (시간 한도)" : " (미설정)";
        }
        return `<option value="${escapeHtml(e.id)}"${e.id === state.engine ? " selected" : ""}>${escapeHtml(e.label)}${suffix}</option>`;
      })
      .join("");
    return `
      <div class="books-engine-row">
        <label class="books-engine-field">
          <span class="books-label">읽기 엔진</span>
          <select id="books-engine" class="books-select"${state.tts.playing || state.tts.testing ? " disabled" : ""}>${options}</select>
        </label>
        <button type="button" class="books-btn books-btn-test" id="books-tts-test"${
          engineConfigured(state.engine) && !state.tts.playing && !state.tts.testing ? "" : " disabled"
        }>${state.tts.testing ? "테스트 중…" : "Test 듣기"}</button>
      </div>
      <p class="books-test-status${state.tts.testStatus ? "" : " is-empty"}" id="books-tts-test-status">${escapeHtml(state.tts.testStatus)}</p>
    `;
  }

  function renderUsageFooterHtml() {
    const month = state.speechMonth || timeMonthLabel();
    const parts = engineList().map((e) => {
      if (e.local || e.id === WEB_SPEECH_ENGINE_ID) {
        return `${e.label} 로컬 (한도 없음)`;
      }
      const monthly = `${formatK(e.chars_used)} / ${formatK(e.monthly_limit)}`;
      if (e.id === "freetts" && e.hourly_limit > 0) {
        return `${e.label} ${monthly} · ${formatK(e.hourly_used || 0)}/${formatK(e.hourly_limit)}/h`;
      }
      return `${e.label} ${monthly}`;
    }).join(" · ");
    return `${month} 읽기 사용량: ${parts}`;
  }

  function timeMonthLabel() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function updateUsageFooter() {
    if (!pageRoot) return;
    const el = pageRoot.querySelector("#books-usage-footer");
    if (el) el.textContent = renderUsageFooterHtml();
  }

  function renderReaderToolbar() {
    if (!state.bookText || state.textLoading) return "";
    return `
      <div class="books-reader-toolbar">
        <div class="books-font-controls" aria-label="글자 크기">
          <button type="button" class="books-font-btn" id="books-font-down" aria-label="글자 작게"${state.readerFontSize <= READER_FONT_MIN ? " disabled" : ""}>−</button>
          <span class="books-font-size-label" id="books-font-size-label">${readerFontSizeLabel()}</span>
          <button type="button" class="books-font-btn" id="books-font-up" aria-label="글자 크게"${state.readerFontSize >= READER_FONT_MAX ? " disabled" : ""}>+</button>
        </div>
      </div>
    `;
  }

  function renderBookmarksSection() {
    const bookmarks = loadBookmarks();
    const canSave = state.view === "reader" && !!state.bookText && !state.textLoading && state.ttsChunks.length;
    const items = bookmarks
      .map((bookmark) => {
        const chunkLabel = `${bookmark.chunkIndex + 1}/${bookmark.chunkTotal || "?"}`;
        const savedAt = bookmark.savedAt
          ? new Date(bookmark.savedAt).toLocaleDateString("ko-KR")
          : "";
        return `
          <li class="books-bookmark-item">
            <button type="button" class="books-bookmark-load" data-bookmark-id="${escapeHtml(bookmark.id)}" title="${escapeHtml(bookmark.authors || "")}">
              <span class="books-bookmark-title">${escapeHtml(bookmark.title || "제목 없음")}</span>
              <span class="books-bookmark-meta">${chunkLabel}구간${savedAt ? ` · ${savedAt}` : ""}</span>
            </button>
            <button type="button" class="books-bookmark-remove" data-bookmark-id="${escapeHtml(bookmark.id)}" aria-label="책갈피 삭제">×</button>
          </li>
        `;
      })
      .join("");
    return `
      <section class="books-bookmarks" aria-label="책갈피">
        <div class="books-bookmarks-head">
          <span class="books-label">책갈피</span>
          <button type="button" class="books-btn books-btn-bookmark" id="books-save-bookmark"${canSave ? "" : " disabled"} title="현재 위치 저장">🔖 저장</button>
        </div>
        <p class="books-bookmark-notice${state.bookmarkNotice ? "" : " is-empty"}" id="books-bookmark-notice">${escapeHtml(state.bookmarkNotice)}</p>
        ${
          bookmarks.length
            ? `<ul class="books-bookmark-list">${items}</ul>`
            : `<p class="books-bookmark-empty">저장된 책갈피가 없습니다.</p>`
        }
      </section>
    `;
  }

  function renderReaderTextHtml() {
    if (!state.bookText) return "";
    const chunks = state.ttsChunks.length
      ? state.ttsChunks
      : splitIntoChunks(prepareBookText(state.bookText));

    return chunks
      .map((chunk, i) => {
        const translated = state.translatedChunks.get(i);
        const showKo = shouldShowKoreanText();
        const content = showKo && translated !== undefined ? translated : chunk;
        const pending = showKo && translated === undefined ? " books-chunk-pending" : "";
        const active =
          state.tts.playing && i === state.tts.chunkIndex ? " books-chunk-active" : "";
        const marked =
          !state.tts.playing && i === state.startChunkIndex ? " books-chunk-marked" : "";
        return `<span class="books-chunk${pending}${active}${marked}" data-chunk="${i}">${escapeHtml(content)}</span>`;
      })
      .join("\n\n");
  }

  function renderPlayer() {
    const voices = voicesForMode(state.readMode);
    const voiceOptions = voices
      .map(
        (v) =>
          `<option value="${escapeHtml(v.id)}"${v.id === state.voice ? " selected" : ""}>${escapeHtml(v.label || v.id)}</option>`
      )
      .join("");

    const canPlay = !!state.bookText && !state.textLoading && engineConfigured(state.engine);
    const engineHint = engineUsageHint();

    return `
      <section class="books-player" id="books-player" aria-label="듣기 컨트롤">
        <div class="books-player-row">
          <button type="button" class="books-btn books-btn-primary" id="books-tts-play"${canPlay ? "" : " disabled"}>▶ 듣기</button>
          <button type="button" class="books-btn" id="books-tts-pause"${state.tts.playing ? "" : " disabled"}>${state.tts.paused ? "▶ 계속" : "⏸ 일시정지"}</button>
          <button type="button" class="books-btn" id="books-tts-stop"${state.tts.playing || state.tts.paused ? "" : " disabled"}>⏹ 정지</button>
          <label class="books-player-field">
            <span class="books-label">목소리</span>
            <select id="books-voice" class="books-select"${state.tts.playing ? " disabled" : ""}>${voiceOptions}</select>
          </label>
          <label class="books-player-field">
            <span class="books-label">속도</span>
            <select id="books-rate" class="books-select"${state.tts.playing ? " disabled" : ""}>
              ${renderRateOptions()}
            </select>
          </label>
        </div>
        ${renderChunkNav()}
        <p class="books-player-usage" id="books-tts-usage">${escapeHtml(engineHint)}</p>
        <p class="books-player-status${state.tts.status ? "" : " is-empty"}" id="books-tts-status">${escapeHtml(state.tts.status)}</p>
      </section>
    `;
  }

  function renderChunkNav() {
    if (!state.bookText || !state.ttsChunks.length || state.textLoading) {
      return "";
    }
    const total = state.ttsChunks.length;
    const current = state.startChunkIndex + 1;
    const disabled = state.tts.playing || state.tts.testing ? " disabled" : "";
    return `
      <div class="books-chunk-nav" id="books-chunk-nav">
        <p class="books-chunk-meta">읽기 구간: 총 <strong>${total}</strong>묶음 (${escapeHtml(chunkUnitLabel())} 단위)</p>
        <label class="books-chunk-slider-label">
          <span class="books-label">시작 구간</span>
          <input type="range" class="books-chunk-slider" id="books-chunk-slider" min="1" max="${total}" value="${current}" step="1"${disabled} aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${current}" aria-label="시작 구간 선택">
          <span class="books-chunk-slider-val" id="books-chunk-slider-val">${current} / ${total}</span>
        </label>
      </div>
    `;
  }

  function renderList() {
    if (state.loading) {
      return `<p class="books-status books-status-info">목록을 불러오는 중…</p>`;
    }
    if (state.error) {
      return `<p class="books-status books-status-error" role="alert">${escapeHtml(state.error)}</p>`;
    }
    if (!state.books.length) {
      return `<p class="books-status books-status-info">조건에 맞는 공개 도메인 영문 도서가 없습니다.</p>`;
    }

    const cards = state.books
      .map((book) => {
        const display = bookListDisplay(book);
        const genre = genrePreview(book);
        const downloads = formatCount(book.download_count);
        const pendingClass = display.pending ? " books-card-pending" : "";
        return `
          <article class="books-card${pendingClass}" data-list-book-id="${book.id}">
            <div class="books-card-body">
              <h3 class="books-card-heading">
                <span class="books-card-title">${escapeHtml(display.title)}</span>
                <span class="books-card-sep" aria-hidden="true">·</span>
                <span class="books-card-author">${escapeHtml(display.authors)}</span>
              </h3>
              <p class="books-card-genre-line">
                <span class="books-card-genre">${escapeHtml(genre)}</span>
                <span class="books-card-downloads">(${escapeHtml(downloads)})</span>
                <span class="books-card-pd">PD</span>
              </p>
            </div>
            <button type="button" class="books-btn books-btn-read" data-book-id="${book.id}">읽기</button>
          </article>
        `;
      })
      .join("");

    const totalPages = Math.max(1, Math.ceil((state.count || 0) / 32));
    const prevDisabled = state.page <= 1 ? " disabled" : "";
    const nextDisabled = state.page >= totalPages ? " disabled" : "";
    const listTitle = state.themeLabel
      ? `${state.themeLabel} · ${formatCount(state.count)}권`
      : `총 ${formatCount(state.count)}권 · ${state.page} / ${totalPages} 페이지`;

    return `
      <div class="books-list-meta">
        <span>${listTitle}${state.themeLabel ? "" : ` · ${state.page} / ${totalPages} 페이지`}</span>
      </div>
      <div class="books-list">${cards}</div>
      <nav class="books-pagination" aria-label="Book pages">
        <button type="button" class="books-btn" data-page-nav="prev"${prevDisabled}>이전</button>
        <span class="books-page-num">${state.page}</span>
        <button type="button" class="books-btn" data-page-nav="next"${nextDisabled}>다음</button>
      </nav>
    `;
  }

  function renderReader() {
    const meta = bookDisplayMeta();
    let body = "";
    if (state.textLoading) {
      body = `<p class="books-status books-status-info">본문을 불러오는 중… (긴 책은 시간이 걸릴 수 있습니다)</p>`;
    } else if (state.textError) {
      body = `<p class="books-status books-status-error" role="alert">${escapeHtml(state.textError)}</p>`;
    } else {
      body = `
        ${renderPlayer()}
        ${renderReaderToolbar()}
        <div class="books-reader-text" id="books-reader-text" style="font-size:${state.readerFontSize}rem">${renderReaderTextHtml()}</div>
      `;
    }

    return `
      <header class="books-reader-head">
        <button type="button" class="books-btn" id="books-back-btn">← 목록</button>
        <div class="books-reader-titles">
          <h3 class="books-reader-title">${escapeHtml(meta.title || "")}</h3>
          <p class="books-reader-author">${escapeHtml(meta.authors || "")}</p>
        </div>
        <div class="books-reader-actions">
          <button type="button" class="books-btn books-btn-bookmark" id="books-save-bookmark-inline"${state.bookText && state.ttsChunks.length ? "" : " disabled"} title="현재 위치 저장">🔖</button>
          <button type="button" class="books-btn books-btn-primary" id="books-download-btn"${state.bookText ? "" : " disabled"}>TXT 저장</button>
        </div>
      </header>
      ${body}
    `;
  }

  function updatePlayerUI() {
    if (!pageRoot) return;
    const usageEl = pageRoot.querySelector("#books-tts-usage");
    const statusEl = pageRoot.querySelector("#books-tts-status");
    const playBtn = pageRoot.querySelector("#books-tts-play");
    const pauseBtn = pageRoot.querySelector("#books-tts-pause");
    const stopBtn = pageRoot.querySelector("#books-tts-stop");

    const eng = currentEngineMeta();
    if (usageEl) {
      usageEl.textContent = engineUsageHint();
    }
    if (statusEl) {
      statusEl.textContent = state.tts.status || "";
      statusEl.classList.toggle("is-empty", !state.tts.status);
    }
    if (playBtn) {
      playBtn.disabled = !state.bookText || state.textLoading || !engineConfigured(state.engine);
    }
    if (pauseBtn) {
      pauseBtn.disabled = !state.tts.playing;
      pauseBtn.textContent = state.tts.paused ? "▶ 계속" : "⏸ 일시정지";
    }
    if (stopBtn) {
      stopBtn.disabled = !state.tts.playing && !state.tts.paused;
    }
    updateChunkNavUI();
  }

  function updateChunkNavUI() {
    if (!pageRoot) return;
    const nav = pageRoot.querySelector("#books-chunk-nav");
    if (!nav) return;
    const total = state.ttsChunks.length;
    if (!total) {
      nav.hidden = true;
      return;
    }
    nav.hidden = false;
    const meta = nav.querySelector(".books-chunk-meta");
    if (meta) {
      meta.innerHTML = `읽기 구간: 총 <strong>${total}</strong>묶음 (${escapeHtml(chunkUnitLabel())} 단위)`;
    }
    const slider = pageRoot.querySelector("#books-chunk-slider");
    const valEl = pageRoot.querySelector("#books-chunk-slider-val");
    const current = state.startChunkIndex + 1;
    if (slider) {
      slider.max = String(total);
      slider.value = String(current);
      slider.disabled = state.tts.playing || state.tts.testing;
      slider.setAttribute("aria-valuemax", String(total));
      slider.setAttribute("aria-valuenow", String(current));
    }
    if (valEl) {
      valEl.textContent = `${current} / ${total}`;
    }
    updateChunkMarker();
  }

  function updateReaderHighlight() {
    if (!pageRoot) return;
    updateChunkMarker();
    const active = pageRoot.querySelector(".books-chunk-active");
    if (active && state.tts.playing) {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function updateReaderTextOnly() {
    if (!pageRoot) return;
    const el = pageRoot.querySelector("#books-reader-text");
    if (el) el.innerHTML = renderReaderTextHtml();
    updateReaderHighlight();
  }

  function render() {
    if (!pageRoot) return;

    const listView = state.view === "list";
    pageRoot.innerHTML = `
      <article class="content-panel books-panel">
        <header class="books-header">
          <h2>Books</h2>
          ${renderModeNav()}
          ${renderEngineSelect()}
          ${renderTranslateActions()}
          ${renderBookmarksSection()}
        </header>
        ${listView ? renderFilters() : ""}
        <div class="books-body">
          ${listView ? renderList() : renderReader()}
        </div>
        <p class="books-usage-footer" id="books-usage-footer">${escapeHtml(renderUsageFooterHtml())}</p>
        <p class="books-footnote">
          데이터: <a href="https://www.gutenberg.org/" target="_blank" rel="noopener noreferrer">Project Gutenberg</a>
          · 엔진: <a href="https://freetts.org/developers" target="_blank" rel="noopener noreferrer">FreeTTS</a>,
          <a href="https://cloud.google.com/text-to-speech" target="_blank" rel="noopener noreferrer">Cloud TTS Neural2</a>,
          <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API" target="_blank" rel="noopener noreferrer">Web Speech API</a>
        </p>
      </article>
    `;

    bindEvents();
    updateTranslationUI();
    applyReaderFontSize();
  }

  function bindEvents() {
    if (!pageRoot) return;

    pageRoot.querySelectorAll("[data-read-mode]").forEach((btn) => {
      btn.addEventListener("click", () => setReadMode(btn.dataset.readMode));
    });

    const form = pageRoot.querySelector("#books-filters");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        state.search = String(fd.get("search") || "");
        state.theme = String(fd.get("theme") || "");
        if (state.theme) {
          state.topic = "";
          state.authorYear = "";
          const picked = themeList().find((t) => t.id === state.theme);
          state.themeLabel = picked?.label || "";
          state.themeDescription = picked?.description || "";
        } else {
          state.topic = String(fd.get("topic") || "");
          state.authorYear = String(fd.get("author_year") || "");
          state.themeLabel = "";
          state.themeDescription = "";
        }
        state.page = 1;
        void fetchBooks();
      });
    }

    const themeSel = pageRoot.querySelector("#books-theme-select");
    if (themeSel) {
      themeSel.addEventListener("change", () => {
        themeSel.form?.requestSubmit();
      });
    }

    pageRoot.querySelectorAll("[data-book-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.bookId);
        const book = state.books.find((b) => b.id === id);
        if (book) openReader(book);
      });
    });

    pageRoot.querySelectorAll("[data-page-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const dir = btn.dataset.pageNav;
        if (dir === "prev" && state.page > 1) {
          state.page -= 1;
          void fetchBooks();
        }
        if (dir === "next") {
          state.page += 1;
          void fetchBooks();
        }
      });
    });

    const backBtn = pageRoot.querySelector("#books-back-btn");
    if (backBtn) backBtn.addEventListener("click", backToList);

    const downloadBtn = pageRoot.querySelector("#books-download-btn");
    if (downloadBtn) downloadBtn.addEventListener("click", downloadCurrentText);

    const translateBtn = pageRoot.querySelector("#books-translate-btn");
    if (translateBtn) translateBtn.addEventListener("click", () => startKoreanTranslation());

    const originalBtn = pageRoot.querySelector("#books-original-btn");
    if (originalBtn) originalBtn.addEventListener("click", showOriginalText);

    const playBtn = pageRoot.querySelector("#books-tts-play");
    if (playBtn) playBtn.addEventListener("click", startTts);

    const pauseBtn = pageRoot.querySelector("#books-tts-pause");
    if (pauseBtn) {
      pauseBtn.addEventListener("click", () => {
        if (state.tts.paused) resumeTts();
        else pauseTts();
      });
    }

    const stopBtn = pageRoot.querySelector("#books-tts-stop");
    if (stopBtn) stopBtn.addEventListener("click", stopTts);

    const engineSel = pageRoot.querySelector("#books-engine");
    if (engineSel) {
      engineSel.addEventListener("change", () => setEngine(engineSel.value));
    }

    const testBtn = pageRoot.querySelector("#books-tts-test");
    if (testBtn) testBtn.addEventListener("click", () => void playTtsTest());

    const voiceSel = pageRoot.querySelector("#books-voice");
    if (voiceSel) {
      voiceSel.addEventListener("change", () => {
        state.voice = voiceSel.value;
      });
    }

    const rateSel = pageRoot.querySelector("#books-rate");
    if (rateSel) {
      rateSel.addEventListener("change", () => {
        state.rate = rateSel.value;
      });
    }

    const chunkSlider = pageRoot.querySelector("#books-chunk-slider");
    if (chunkSlider) {
      chunkSlider.addEventListener("input", () => {
        state.startChunkIndex = Math.max(0, Number(chunkSlider.value) - 1);
        updateChunkNavUI();
        scrollToChunk(state.startChunkIndex);
      });
    }

    pageRoot.querySelectorAll(".books-bookmark-load").forEach((btn) => {
      btn.addEventListener("click", () => loadBookmark(btn.dataset.bookmarkId));
    });

    pageRoot.querySelectorAll(".books-bookmark-remove").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        removeBookmark(btn.dataset.bookmarkId);
      });
    });

    const saveBookmarkBtn = pageRoot.querySelector("#books-save-bookmark");
    if (saveBookmarkBtn) saveBookmarkBtn.addEventListener("click", saveBookmark);

    const saveBookmarkInlineBtn = pageRoot.querySelector("#books-save-bookmark-inline");
    if (saveBookmarkInlineBtn) saveBookmarkInlineBtn.addEventListener("click", saveBookmark);

    const fontDownBtn = pageRoot.querySelector("#books-font-down");
    if (fontDownBtn) {
      fontDownBtn.addEventListener("click", () => setReaderFontSize(state.readerFontSize - READER_FONT_STEP));
    }

    const fontUpBtn = pageRoot.querySelector("#books-font-up");
    if (fontUpBtn) {
      fontUpBtn.addEventListener("click", () => setReaderFontSize(state.readerFontSize + READER_FONT_STEP));
    }
  }

  function renderPage(container) {
    stopTts();
    pageRoot = container;
    state.view = "list";
    state.readMode = "en";
    state.engine = webSpeechSupported() ? WEB_SPEECH_ENGINE_ID : "freetts";
    state.engines = [];
    state.voice = defaultVoiceForMode("en", state.engine);
    state.readerFontSize = loadReaderFontSize();
    state.bookmarkNotice = "";
    state.page = 1;
    state.search = "";
    state.topic = "";
    state.theme = "";
    state.themes = [];
    state.themeLabel = "";
    state.themeDescription = "";
    state.authorYear = "";
    state.bookId = null;
    state.bookMeta = null;
    state.bookText = "";
    state.error = "";
    state.textError = "";
    state.ttsChunks = [];
    state.startChunkIndex = 0;
    state.translatedChunks = new Map();
    state.listTranslated = new Map();
    state.showKoreanText = false;
    state.translation = { running: false, current: 0, total: 0, error: "", scope: "" };
    void fetchThemes().then(() => fetchSpeechStatus().then(() => render()));
    void fetchBooks();
  }

  function destroy() {
    stopTts();
    stopTranslation();
    if (listAbort) {
      listAbort.abort();
      listAbort = null;
    }
    if (textAbort) {
      textAbort.abort();
      textAbort = null;
    }
    pageRoot = null;
  }

  window.Books = {
    renderPage,
    destroy
  };

  initWebSpeechVoices();
})();
