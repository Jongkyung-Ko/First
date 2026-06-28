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
  const LIST_PAGE_SIZE = 10;

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

  const THEME_GUTENDEX_EXPAND = {
    shakespeare: { search_queries: ["Shakespeare"], topics: ["Drama", "Tragedies"] },
    classic_novels: { search_queries: ["English fiction", "British fiction"], topics: ["England -- Fiction"] },
    romance: { search_queries: ["romance fiction"], topics: ["Romance fiction", "Love stories"] },
    mystery: { search_queries: ["mystery detective", "Sherlock Holmes"], topics: ["Detective and mystery stories"] },
    scifi_fantasy: { search_queries: ["science fiction", "fantasy fiction"], topics: ["Science fiction", "Fantasy fiction"] },
    children: { search_queries: ["children's literature", "juvenile fiction"], topics: ["Children's literature"] },
    philosophy: { search_queries: ["philosophy Plato"], topics: ["Philosophy", "Ethics"] },
    american_classics: { search_queries: ["American fiction classics"], topics: ["United States -- Fiction"] },
    arabian_nights: { search_queries: ["Arabian Nights"], topics: ["Folklore -- Arab countries"] },
    aesop_fables: { search_queries: ["Aesop fables"], topics: ["Fables"] },
    andersen_fairy: { search_queries: ["Hans Christian Andersen fairy tales"], topics: ["Fairy tales"] },
    grimm_fairy: { search_queries: ["Grimm fairy tales"], topics: ["Fairy tales", "Folklore -- Germany"] },
    world_fairy_tales: {
      search_queries: ["fairy tales", "folk tales", "Grimm", "Andersen", "Aesop fables"],
      topics: ["Fairy tales", "Folklore", "Children's stories"]
    },
    edwardian_children: { search_queries: ["children's books"], topics: ["Children's literature", "Juvenile fiction"] },
    greek_roman_myth: { search_queries: ["Greek mythology", "Homer"], topics: ["Mythology, Greek", "Mythology, Roman"] },
    adventure_tales: { search_queries: ["adventure fiction"], topics: ["Adventure stories"] },
    gothic_horror: { search_queries: ["gothic horror"], topics: ["Horror tales", "Gothic fiction"] },
    short_story_masters: { search_queries: ["short stories Poe"], topics: ["Short stories"] },
    wisdom_parables: { search_queries: ["fables parables"], topics: ["Fables", "Ethics"] },
    nursery_rhymes: { search_queries: ["Mother Goose nursery rhymes"], topics: ["Nursery rhymes"] },
    legend_knights: { search_queries: ["King Arthur knights"], topics: ["Arthurian romances"] }
  };

  const THEME_GUTENDEX_MAX = 96;

  const FALLBACK_THEMES = THEME_CATALOG;

  const EN_VOICES_FREETTS = ["en-US-JennyNeural", "en-US-GuyNeural", "en-US-AriaNeural"];
  const KO_VOICES_FREETTS = ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"];
  const EN_VOICES_GOOGLE = ["en-US-Neural2-A", "en-US-Neural2-C", "en-US-Neural2-D", "en-US-Neural2-F"];
  const KO_VOICES_GOOGLE = ["ko-KR-Neural2-A", "ko-KR-Neural2-B", "ko-KR-Neural2-C"];

  const TTS_TEST_SAMPLE_EN = "Hello. This is a Books reading test.";
  const WEB_SPEECH_ENGINE_ID = "webspeech";
  const WEBSPEECH_CHUNK_MAX = 320;
  const WEBSPEECH_SPEAK_MAX = 280;
  const GOOGLE_CHUNK_BYTES = 512;
  const TRANSLATE_CHUNK_MAX = 4000;
  const TRANSLATE_CONCURRENCY = 4;
  const TEXT_PREVIEW_BYTES = 120000;
  const TTS_RATES = ["0.85", "1.0", "1.15", "1.2", "1.3", "1.4"];
  const READER_FONT_MIN = 0.65;
  const READER_FONT_MAX = 1.25;
  const READER_FONT_STEP = 0.04;
  const READER_FONT_DEFAULT = 0.82;
  const BOOKMARKS_STORAGE_KEY = "digital-world-books-bookmarks";
  const READER_FONT_STORAGE_KEY = "digital-world-books-reader-font";
  const READER_THEME_STORAGE_KEY = "digital-world-books-reader-theme";
  const READER_PARA_STORAGE_KEY = "digital-world-books-reader-para";
  const READER_SENT_STORAGE_KEY = "digital-world-books-reader-sent";
  const READER_THEMES = [
    {
      id: "white",
      label: "화이트 · 명조",
      fontSize: 0.82,
      fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
      lineHeight: 1.65
    },
    {
      id: "black",
      label: "블랙 · 명조",
      fontSize: 0.82,
      fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
      lineHeight: 1.65
    },
    {
      id: "gray",
      label: "회색 · 고딕",
      fontSize: 0.84,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      lineHeight: 1.6
    },
    {
      id: "paper",
      label: "종이 · 명조",
      fontSize: 0.88,
      fontFamily: 'Georgia, "Times New Roman", ui-serif, serif',
      lineHeight: 1.72
    },
    {
      id: "sepia",
      label: "세피아 · 명조",
      fontSize: 0.86,
      fontFamily: 'Georgia, "Palatino Linotype", "Book Antiqua", serif',
      lineHeight: 1.75
    },
    {
      id: "night",
      label: "야간 블루 · 명조",
      fontSize: 0.84,
      fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
      lineHeight: 1.68
    },
    {
      id: "eink",
      label: "e-ink · 명조",
      fontSize: 0.9,
      fontFamily: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
      lineHeight: 1.8
    },
    {
      id: "sage",
      label: "세이지 · 명조",
      fontSize: 0.85,
      fontFamily: '"Libre Baskerville", Georgia, "Times New Roman", serif',
      lineHeight: 1.7
    },
    {
      id: "latte",
      label: "라떼 · 고딕",
      fontSize: 0.88,
      fontFamily: '"Segoe UI", ui-sans-serif, system-ui, sans-serif',
      lineHeight: 1.65
    }
  ];

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
  const themeBooksCache = new Map();
  let themeFetchSession = 0;
  let textAbort = null;
  let textFetchSession = 0;
  let ttsAbort = null;
  let currentAudio = null;
  let ttsSessionId = 0;
  let testSessionId = 0;
  let translateAbort = null;
  let translateSessionId = 0;
  let pendingReaderScrollChunk = null;
  let webSpeechVoicesCache = [];
  let readerScrollHandler = null;
  let readerResizeBound = false;
  let readerAutoFollow = true;
  let readerScrollProgrammatic = false;
  let readerFullscreenEl = null;
  let htmlPreviewEl = null;
  let htmlPreviewEventsBound = false;
  let fsEventsBound = false;

  function loadReaderFontSize() {
    const saved = parseFloat(localStorage.getItem(READER_FONT_STORAGE_KEY) || "");
    if (Number.isFinite(saved) && saved >= READER_FONT_MIN && saved <= READER_FONT_MAX) {
      return saved;
    }
    return READER_FONT_DEFAULT;
  }

  function loadReaderTheme() {
    const saved = localStorage.getItem(READER_THEME_STORAGE_KEY) || "";
    if (READER_THEMES.some((t) => t.id === saved)) return saved;
    return "black";
  }

  function loadReaderParagraphBreaks() {
    return localStorage.getItem(READER_PARA_STORAGE_KEY) === "1";
  }

  function loadReaderSentenceBreaks() {
    return localStorage.getItem(READER_SENT_STORAGE_KEY) === "1";
  }

  function currentReaderTheme() {
    return READER_THEMES.find((t) => t.id === state.readerTheme) || READER_THEMES[1];
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
    themeBooksAll: [],
    themeFetchPhase: "idle",
    loading: false,
    error: "",
    bookId: null,
    bookMeta: null,
    bookText: "",
    textLoading: false,
    textLoadPhase: "idle",
    textError: "",
    engine: WEB_SPEECH_ENGINE_ID,
    engines: [],
    speechMonth: "",
    voice: "",
    rate: "1.0",
    readerFontSize: READER_FONT_DEFAULT,
    readerTheme: "black",
    readerParagraphBreaks: false,
    readerSentenceBreaks: false,
    bookmarksExpanded: false,
    readerFullscreen: false,
    bookmarkNotice: "",
    ttsChunks: [],
    translateChunks: [],
    ttsTranslateMap: [],
    batchOffsets: [],
    preparedTextSnapshot: "",
    startChunkIndex: 0,
    translatedChunks: new Map(),
    translatedBatches: new Map(),
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

  function detectTextLang(text) {
    const sample = String(text || "");
    if (!sample.length) return "en";
    const ko = (sample.match(/[\uAC00-\uD7A3]/g) || []).length;
    return ko / sample.length > 0.12 ? "ko" : "en";
  }

  function bookSourceLang() {
    if (!state.bookText) return "en";
    return detectTextLang(prepareBookText(state.bookText).slice(0, 2400));
  }

  function uiVoiceLang() {
    if (state.showKoreanText) return "ko";
    return bookSourceLang();
  }

  function koreanChunkText(index) {
    if (state.translatedChunks.has(index)) {
      const stored = state.translatedChunks.get(index);
      if (stored) return stored;
    }
    const map = state.ttsTranslateMap[index];
    if (map != null && state.translatedBatches.has(map.batchIndex)) {
      const koBatch = state.translatedBatches.get(map.batchIndex);
      const srcBatch = state.translateChunks[map.batchIndex];
      let nextMap = null;
      for (let j = index + 1; j < state.ttsTranslateMap.length; j++) {
        const m = state.ttsTranslateMap[j];
        if (m && m.batchIndex === map.batchIndex) {
          nextMap = m;
          break;
        }
      }
      return sliceKoForTtsMap(koBatch, srcBatch, map, nextMap);
    }
    return null;
  }

  function chunkSpeechContent(index) {
    const source = state.ttsChunks[index] || "";
    if (state.showKoreanText) {
      const ko = koreanChunkText(index);
      if (ko && sanitizeSpeechText(ko)) {
        return { text: ko, lang: "ko" };
      }
      if (sanitizeSpeechText(source)) {
        return { text: source, lang: detectTextLang(source) };
      }
    }
    return { text: source, lang: detectTextLang(source) };
  }

  function ensureVoiceMatchesLang(lang) {
    const mode = lang === "ko" ? "ko" : "en";
    const voices = voicesForMode(mode);
    if (!voices.some((v) => v.id === state.voice)) {
      state.voice = defaultVoiceForMode(mode, state.engine);
    }
  }

  function shouldShowKoreanText() {
    return state.showKoreanText;
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
    return pickWebSpeechVoice(voiceId);
  }

  function sanitizeSpeechText(text) {
    return String(text || "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/gi, " ")
      .replace(/_{4,}/g, " ")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function waitForWebSpeechVoices(timeoutMs) {
    const limit = timeoutMs || 2500;
    return new Promise((resolve) => {
      const existing = ensureWebSpeechVoices();
      if (existing.length) {
        resolve(existing);
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.speechSynthesis.removeEventListener("voiceschanged", onChange);
        resolve(ensureWebSpeechVoices());
      };
      const onChange = () => finish();
      window.speechSynthesis.addEventListener("voiceschanged", onChange);
      window.speechSynthesis.getVoices();
      window.setTimeout(finish, limit);
    });
  }

  function pickWebSpeechVoice(voiceId, lang) {
    ensureWebSpeechVoices();
    const modePrefix = lang === "ko" ? "ko" : "en";
    const matchesMode = (voice) => (voice.lang || "").toLowerCase().startsWith(modePrefix);

    if (voiceId) {
      const selected = webSpeechVoicesCache.find((v) => v.voiceURI === voiceId);
      if (selected && matchesMode(selected)) return selected;
    }

    const modeVoices = webSpeechVoicesCache.filter(matchesMode);
    const localVoice = modeVoices.find((v) => v.localService);
    if (localVoice) return localVoice;
    if (modeVoices.length) return modeVoices[0];
    return null;
  }

  function webSpeechHasVoiceForLang(lang) {
    const mode = lang === "ko" ? "ko" : "en";
    return webSpeechVoiceOptions(mode).length > 0;
  }

  function speechDelay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function speakOneUtterance(text, isActive, useVoice, lang) {
    return new Promise((resolve, reject) => {
      if (!webSpeechSupported()) {
        reject(new Error("이 브라우저는 Web Speech API를 지원하지 않습니다."));
        return;
      }
      if (!isActive()) {
        resolve();
        return;
      }
      const cleaned = sanitizeSpeechText(text);
      if (!cleaned) {
        resolve();
        return;
      }

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const speechLang = lang === "ko" ? "ko-KR" : "en-US";
      const utterance = new SpeechSynthesisUtterance(cleaned);
      if (useVoice) {
        const voice = pickWebSpeechVoice(state.voice, lang);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = speechLang;
        }
      } else {
        utterance.lang = speechLang;
      }
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
        const err = new Error(`브라우저 TTS 오류: ${code}`);
        err.code = code;
        reject(err);
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  async function speakWebSpeechText(text, isActive, lang) {
    if (!webSpeechSupported()) {
      throw new Error("이 브라우저는 Web Speech API를 지원하지 않습니다.");
    }
    if (!isActive()) return;

    await waitForWebSpeechVoices();
    if (!isActive()) return;

    const cleaned = sanitizeSpeechText(text);
    if (!cleaned) return;

    const speechLang = lang || detectTextLang(cleaned);
    const segments =
      cleaned.length > WEBSPEECH_SPEAK_MAX
        ? splitIntoChunks(cleaned, WEBSPEECH_SPEAK_MAX)
        : [cleaned];

    const useAssignedVoice = webSpeechHasVoiceForLang(speechLang) && !!pickWebSpeechVoice(state.voice, speechLang);

    for (const segment of segments) {
      if (!isActive()) return;
      try {
        await speakOneUtterance(segment, isActive, useAssignedVoice, speechLang);
      } catch (err) {
        if (err.code !== "synthesis-failed" || !isActive()) throw err;
        try {
          await speakOneUtterance(segment, isActive, false, speechLang);
        } catch (retryErr) {
          if (retryErr.code !== "synthesis-failed" || segment.length <= 80 || !isActive()) {
            throw retryErr;
          }
          const mid = Math.max(40, Math.floor(segment.length / 2));
          const breakAt = segment.lastIndexOf(" ", mid);
          const splitAt = breakAt > 40 ? breakAt : mid;
          const head = segment.slice(0, splitAt).trim();
          const tail = segment.slice(splitAt).trim();
          if (head) await speakOneUtterance(head, isActive, false, speechLang);
          if (tail && isActive()) await speakOneUtterance(tail, isActive, false, speechLang);
        }
      }
      await speechDelay(60);
    }
  }

  function initWebSpeechVoices() {
    if (!webSpeechSupported()) return;
    ensureWebSpeechVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      webSpeechVoicesCache = window.speechSynthesis.getVoices();
      if (!pageRoot || state.engine !== WEB_SPEECH_ENGINE_ID) return;
      const valid = webSpeechVoicesCache.some((v) => v.voiceURI === state.voice);
      if (!valid) state.voice = defaultWebSpeechVoice(uiVoiceLang());
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
    if (isWebSpeechEngine()) return WEBSPEECH_CHUNK_MAX;
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


  function ttsPlaybackRate() {
    return Math.max(0.25, Math.min(4, parseFloat(state.rate) || 1));
  }

  function applyLiveTtsRate() {
    if (currentAudio) {
      currentAudio.playbackRate = ttsPlaybackRate();
    }
  }

  function isBookTextComplete() {
    return state.textLoadPhase === "complete";
  }

  function canUseFullBookFeatures() {
    return state.view === "reader" && !!state.bookText && isBookTextComplete();
  }

  function renderTextLoadBanner() {
    if (!state.bookText || isBookTextComplete()) return "";
    const loadingRest = state.textLoadPhase === "loading_rest";
    return `
      <p class="books-text-load-banner books-status-info${loadingRest ? " books-status-loading" : ""}" id="books-text-load-banner" role="status" aria-live="polite">
        ${loadingRest ? "나머지 본문 불러오는 중" : "미리보기 — 전체 본문 로딩 후 번역·듣기 사용 가능"}
      </p>
    `;
  }

  function applyBookTextData(data) {
    state.bookMeta = {
      id: data.id,
      title: data.title,
      authors: data.authors
    };
    state.bookText = data.text || "";
    refreshChunks();
    if (state.startChunkIndex >= state.ttsChunks.length) {
      state.startChunkIndex = Math.max(0, state.ttsChunks.length - 1);
    }
  }

  function finishBookTextLoad(options) {
    applyReaderFontSize();
    const scrollAfterLoad = pendingReaderScrollChunk != null;
    const scrollTarget = scrollAfterLoad ? pendingReaderScrollChunk : state.startChunkIndex;
    pendingReaderScrollChunk = null;
    if (scrollAfterLoad && state.ttsChunks.length) {
      window.requestAnimationFrame(() => scrollToChunk(scrollTarget));
    }
    if (isBookTextComplete()) {
      if (state.showKoreanText && state.bookText && state.translateChunks.length) {
        const missing = state.translateChunks.some((_, i) => !state.translatedBatches.has(i));
        if (missing) void translateAllChunks();
      } else if (!state.showKoreanText && state.bookText) {
        state.voice = defaultVoiceForMode(bookSourceLang(), state.engine);
      }
    }
    if (options?.render !== false) {
      render();
    }
  }

  async function fetchBookTextFull(bookId, session, signal) {
    if (session !== textFetchSession) return;
    state.textLoadPhase = "loading_rest";
    render();

    try {
      const res = await fetch(`${apiBase()}/api/gutenberg/text/${bookId}`, { signal });
      const data = await res.json().catch(() => ({}));
      if (session !== textFetchSession) return;
      if (!res.ok) {
        throw new Error(data.detail || `본문을 불러오지 못했습니다 (${res.status})`);
      }

      const prevChunk = state.startChunkIndex;
      state.translatedChunks = new Map();
      state.translatedBatches = new Map();
      applyBookTextData(data);
      state.startChunkIndex = Math.min(prevChunk, Math.max(0, state.ttsChunks.length - 1));
      state.textLoadPhase = "complete";
      state.textError = "";
      finishBookTextLoad();
    } catch (err) {
      if (err.name === "AbortError" || session !== textFetchSession) return;
      state.textError = err.message || "나머지 본문을 불러오지 못했습니다.";
      render();
    }
  }

  function renderTranslateActions() {
    const readerReady = state.view === "reader" && !!state.bookText && !state.textLoading && isBookTextComplete();
    const busy = state.translation.running || state.textLoading || state.textLoadPhase === "loading_rest";
    const showOriginal = shouldShowKoreanText() || state.translation.running;
    const statusVisible =
      state.translation.running ||
      state.translation.error ||
      (shouldShowKoreanText() && (state.translatedBatches.size || state.translatedChunks.size));
    return `
      <div class="books-translate-actions books-reader-translate-bar">
        <button type="button" class="books-btn books-btn-translate" id="books-translate-btn"${readerReady && !busy ? "" : " disabled"}>${state.translation.running ? "번역 중…" : "한글 번역"}</button>
        <button type="button" class="books-btn" id="books-original-btn"${showOriginal && !busy ? "" : " disabled"}>원문 보기</button>
        <p class="books-translate-status${statusVisible ? "" : " is-empty"}" id="books-translate-status"></p>
      </div>
    `;
  }

  function renderListTranslateBar() {
    if (state.loading || state.error || !state.books.length) return "";
    const busy = state.translation.running;
    const label = busy ? "번역 중…" : shouldShowKoreanText() ? "원문" : "번역";
    const statusVisible =
      state.translation.running ||
      state.translation.error ||
      (shouldShowKoreanText() && state.listTranslated.size);
    return `
      <div class="books-list-translate-bar">
        <button type="button" class="books-btn books-btn-translate" id="books-list-lang-btn"${busy ? " disabled" : ""}>${label}</button>
        <p class="books-translate-status${statusVisible ? "" : " is-empty"}" id="books-list-translate-status"></p>
      </div>
    `;
  }

  function updateListLangButtonUI() {
    if (!pageRoot || state.view !== "list") return;
    const btn = pageRoot.querySelector("#books-list-lang-btn");
    if (!btn) return;
    const busy = state.translation.running;
    const canUse = state.books.length > 0 && !state.loading;
    btn.disabled = busy || !canUse;
    if (busy) btn.textContent = "번역 중…";
    else if (shouldShowKoreanText()) btn.textContent = "원문";
    else btn.textContent = "번역";
  }

  function toggleListTranslation() {
    if (state.translation.running) return;
    if (shouldShowKoreanText()) {
      showOriginalListText();
      return;
    }
    if (!state.books.length || state.loading) return;
    void translateListBooks();
  }

  function showOriginalListText() {
    state.showKoreanText = false;
    stopTranslation();
    updateListTextOnly();
    updateListLangButtonUI();
    updateTranslationUI();
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

  function applyReaderTextStyles(el) {
    if (!el) return;
    const theme = currentReaderTheme();
    el.style.fontSize = `${state.readerFontSize}rem`;
    if (theme?.fontFamily) el.style.fontFamily = theme.fontFamily;
    if (theme?.lineHeight) el.style.lineHeight = String(theme.lineHeight);
  }

  function applyThemeClassToEl(el) {
    if (!el) return;
    READER_THEMES.forEach((t) => el.classList.remove(`books-reader-theme-${t.id}`));
    el.classList.add(`books-reader-theme-${state.readerTheme}`);
  }

  function getReaderTextEl(preferFullscreen) {
    if (preferFullscreen !== false && state.readerFullscreen && readerFullscreenEl) {
      const fs = readerFullscreenEl.querySelector("#books-fs-text");
      if (fs) return fs;
    }
    return pageRoot?.querySelector("#books-reader-text") || null;
  }

  function forEachReaderTextRoot(fn) {
    const main = pageRoot?.querySelector("#books-reader-text");
    if (main) fn(main);
    const fs = readerFullscreenEl?.querySelector("#books-fs-text");
    if (fs && state.readerFullscreen) fn(fs);
  }

  function isChunkVisibleInReader(chunkEl, container) {
    if (!chunkEl || !container) return false;
    const cRect = container.getBoundingClientRect();
    const elRect = chunkEl.getBoundingClientRect();
    return elRect.top >= cRect.top - 4 && elRect.bottom <= cRect.bottom + 4;
  }

  function scrollChunkInContainer(container, chunkEl, behavior) {
    if (!container || !chunkEl) return;
    readerScrollProgrammatic = true;
    const cRect = container.getBoundingClientRect();
    const elRect = chunkEl.getBoundingClientRect();
    const offset = elRect.top - cRect.top + container.scrollTop - 12;
    container.scrollTo({ top: Math.max(0, offset), behavior: behavior || "smooth" });
    window.requestAnimationFrame(() => {
      readerScrollProgrammatic = false;
    });
  }

  function scrollActiveChunkToView(index, behavior, force) {
    if (!force && !readerAutoFollow) return;
    const container = state.readerFullscreen
      ? readerFullscreenEl?.querySelector("#books-fs-text")
      : pageRoot?.querySelector("#books-reader-text");
    if (!container) return;
    const chunkEl = container.querySelector(`.books-chunk[data-chunk="${index}"]`);
    if (chunkEl) scrollChunkInContainer(container, chunkEl, behavior);
  }

  function syncFullscreenReaderContent() {
    if (!state.readerFullscreen || !readerFullscreenEl) return;
    const main = pageRoot?.querySelector("#books-reader-text");
    const fs = readerFullscreenEl.querySelector("#books-fs-text");
    const titleEl = readerFullscreenEl.querySelector("#books-fs-title");
    if (!main || !fs) return;
    const scrollRatio = main.scrollHeight > main.clientHeight
      ? main.scrollTop / (main.scrollHeight - main.clientHeight)
      : 0;
    fs.innerHTML = main.innerHTML;
    applyThemeClassToEl(fs);
    applyReaderTextStyles(fs);
    updateChunkMarker();
    if (fs.scrollHeight > fs.clientHeight) {
      fs.scrollTop = scrollRatio * (fs.scrollHeight - fs.clientHeight);
    }
    if (titleEl) {
      const meta = bookDisplayMeta();
      titleEl.textContent = meta.title || "";
    }
    updateReaderPageUI();
    updateFollowButtonUI();
  }

  function ensureFullscreenOverlay() {
    if (readerFullscreenEl) return;
    readerFullscreenEl = document.createElement("div");
    readerFullscreenEl.id = "books-reader-fullscreen";
    readerFullscreenEl.className = "books-reader-fullscreen";
    readerFullscreenEl.hidden = true;
    readerFullscreenEl.innerHTML = `
      <header class="books-fs-head">
        <button type="button" class="books-btn books-fs-close" id="books-fs-close" aria-label="전체 화면 닫기">✕</button>
        <span class="books-fs-title" id="books-fs-title"></span>
      </header>
      <nav class="books-page-nav books-fs-page-nav" aria-label="전체 화면 페이지">
        <button type="button" class="books-btn books-reader-page-btn" id="books-fs-page-prev">◀ 이전</button>
        <span class="books-reader-page-label" id="books-fs-page-label">1 / 1</span>
        <button type="button" class="books-btn books-reader-page-btn" id="books-fs-page-next">다음 ▶</button>
      </nav>
      <div class="books-reader-text books-reader-theme-black" id="books-fs-text"></div>
    `;
    document.body.appendChild(readerFullscreenEl);
  }

  function bindFullscreenEvents() {
    if (fsEventsBound || !readerFullscreenEl) return;
    fsEventsBound = true;
    readerFullscreenEl.querySelector("#books-fs-close")?.addEventListener("click", closeReaderFullscreen);
    readerFullscreenEl.querySelector("#books-fs-page-prev")?.addEventListener("click", () => scrollReaderByPage(-1, true));
    readerFullscreenEl.querySelector("#books-fs-page-next")?.addEventListener("click", () => scrollReaderByPage(1, true));
    const fsText = readerFullscreenEl.querySelector("#books-fs-text");
    if (fsText) {
      fsText.addEventListener(
        "scroll",
        () => {
          onReaderContainerScroll(fsText);
          updateReaderPageUI();
        },
        { passive: true }
      );
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.readerFullscreen) closeReaderFullscreen();
    });
  }

  function openReaderFullscreen() {
    if (!state.bookText || state.view !== "reader") return;
    ensureFullscreenOverlay();
    bindFullscreenEvents();
    state.readerFullscreen = true;
    readerFullscreenEl.hidden = false;
    document.body.classList.add("books-reader-fs-open");
    syncFullscreenReaderContent();
    bindReaderScrollListener();
  }

  function closeReaderFullscreen() {
    if (!readerFullscreenEl) return;
    const main = pageRoot?.querySelector("#books-reader-text");
    const fs = readerFullscreenEl.querySelector("#books-fs-text");
    if (main && fs) {
      const scrollRatio = fs.scrollHeight > fs.clientHeight
        ? fs.scrollTop / (fs.scrollHeight - fs.clientHeight)
        : 0;
      main.innerHTML = fs.innerHTML;
      applyThemeClassToEl(main);
      applyReaderTextStyles(main);
      updateChunkMarker();
      if (main.scrollHeight > main.clientHeight) {
        main.scrollTop = scrollRatio * (main.scrollHeight - main.clientHeight);
      }
    }
    state.readerFullscreen = false;
    readerFullscreenEl.hidden = true;
    document.body.classList.remove("books-reader-fs-open");
    updateReaderPageUI();
  }

  function updateFollowButtonUI() {
    if (!pageRoot) return;
    const btn = pageRoot.querySelector("#books-reader-follow");
    if (!btn) return;
    const show = state.tts.playing && !readerAutoFollow;
    btn.hidden = !show;
    btn.classList.toggle("is-active", readerAutoFollow);
  }

  function onReaderContainerScroll(container) {
    if (readerScrollProgrammatic) return;
    if (!state.tts.playing) return;
    const active = container.querySelector(".books-chunk-active");
    if (!active) return;
    if (!isChunkVisibleInReader(active, container)) {
      readerAutoFollow = false;
      updateFollowButtonUI();
    }
  }

  function enableReaderAutoFollow() {
    readerAutoFollow = true;
    updateFollowButtonUI();
    if (state.tts.playing) {
      scrollActiveChunkToView(state.tts.chunkIndex, "smooth", true);
    }
  }

  function toggleBookmarksExpanded() {
    state.bookmarksExpanded = !state.bookmarksExpanded;
    updateBookmarksPanelUI();
  }

  function updateBookmarksPanelUI() {
    if (!pageRoot) return;
    const panel = pageRoot.querySelector("#books-bookmarks-panel");
    const toggle = pageRoot.querySelector("#books-bookmarks-toggle");
    const bookmarks = loadBookmarks();
    if (panel) {
      panel.classList.toggle("is-collapsed", !state.bookmarksExpanded);
    }
    if (toggle) {
      toggle.textContent = state.bookmarksExpanded ? "접기 ▴" : "펼치기 ▾";
      toggle.setAttribute("aria-expanded", state.bookmarksExpanded ? "true" : "false");
    }
    const countEl = pageRoot.querySelector("#books-bookmarks-count");
    if (countEl) countEl.textContent = bookmarks.length ? `(${bookmarks.length})` : "";
  }

  function applyReaderFontSize() {
    if (!pageRoot) return;
    applyReaderTextStyles(pageRoot.querySelector("#books-reader-text"));
    applyReaderTextStyles(readerFullscreenEl?.querySelector("#books-fs-text"));
    const label = pageRoot.querySelector("#books-font-size-label");
    if (label) label.textContent = readerFontSizeLabel();
    const downBtn = pageRoot.querySelector("#books-font-down");
    const upBtn = pageRoot.querySelector("#books-font-up");
    if (downBtn) downBtn.disabled = state.readerFontSize <= READER_FONT_MIN;
    if (upBtn) upBtn.disabled = state.readerFontSize >= READER_FONT_MAX;
    window.requestAnimationFrame(() => updateReaderPageUI());
  }

  function setReaderTheme(themeId) {
    if (!READER_THEMES.some((t) => t.id === themeId)) return;
    state.readerTheme = themeId;
    localStorage.setItem(READER_THEME_STORAGE_KEY, themeId);
    const theme = READER_THEMES.find((t) => t.id === themeId);
    if (theme?.fontSize) {
      state.readerFontSize = theme.fontSize;
      localStorage.setItem(READER_FONT_STORAGE_KEY, String(theme.fontSize));
    }
    applyReaderTheme();
    applyReaderFontSize();
    if (state.readerFullscreen) syncFullscreenReaderContent();
  }

  function applyReaderTheme() {
    if (!pageRoot) return;
    applyThemeClassToEl(pageRoot.querySelector("#books-reader-text"));
    applyThemeClassToEl(readerFullscreenEl?.querySelector("#books-fs-text"));
    const sel = pageRoot.querySelector("#books-reader-theme");
    if (sel) {
      setOptionPickerValue("books-reader-theme", state.readerTheme, readerThemePickerOptions());
    }
  }

  function getReaderPageMetricsForEl(el) {
    if (!el || !el.clientHeight) {
      return { current: 1, total: 1, pageHeight: 1 };
    }
    const pageHeight = el.clientHeight;
    const total = Math.max(1, Math.ceil(el.scrollHeight / pageHeight));
    const current = Math.min(total, Math.floor(el.scrollTop / pageHeight) + 1);
    return { current, total, pageHeight };
  }

  function getReaderPageMetrics() {
    return getReaderPageMetricsForEl(pageRoot?.querySelector("#books-reader-text"));
  }

  function updatePageNavForEl(el, labelSel, prevSel, nextSel) {
    if (!el) return;
    const { current, total } = getReaderPageMetricsForEl(el);
    const label = typeof labelSel === "string" ? pageRoot?.querySelector(labelSel) : labelSel;
    const prevBtn = typeof prevSel === "string" ? pageRoot?.querySelector(prevSel) : prevSel;
    const nextBtn = typeof nextSel === "string" ? pageRoot?.querySelector(nextSel) : nextSel;
    const fsLabel = readerFullscreenEl?.querySelector("#books-fs-page-label");
    const fsPrev = readerFullscreenEl?.querySelector("#books-fs-page-prev");
    const fsNext = readerFullscreenEl?.querySelector("#books-fs-page-next");
    const isFs = el.id === "books-fs-text";
    const targetLabel = isFs ? fsLabel : label;
    const targetPrev = isFs ? fsPrev : prevBtn;
    const targetNext = isFs ? fsNext : nextBtn;
    if (targetLabel) targetLabel.textContent = `${current} / ${total}`;
    if (targetPrev) targetPrev.disabled = current <= 1;
    if (targetNext) targetNext.disabled = current >= total;
  }

  function updateReaderPageUI() {
    if (state.view !== "reader") return;
    const main = pageRoot?.querySelector("#books-reader-text");
    if (main) {
      updatePageNavForEl(
        main,
        "#books-reader-page-label",
        "#books-reader-page-prev",
        "#books-reader-page-next"
      );
    }
    const fs = readerFullscreenEl?.querySelector("#books-fs-text");
    if (fs && state.readerFullscreen) {
      updatePageNavForEl(fs, null, null, null);
    }
  }

  function scrollReaderByPage(delta, inFullscreen) {
    const el = inFullscreen || state.readerFullscreen
      ? readerFullscreenEl?.querySelector("#books-fs-text")
      : pageRoot?.querySelector("#books-reader-text");
    if (!el) return;
    const { current, total, pageHeight } = getReaderPageMetricsForEl(el);
    const next = Math.max(1, Math.min(total, current + delta));
    readerScrollProgrammatic = true;
    el.scrollTo({ top: (next - 1) * pageHeight, behavior: "smooth" });
    window.requestAnimationFrame(() => {
      readerScrollProgrammatic = false;
      updateReaderPageUI();
    });
  }

  function bindReaderScrollListener() {
    const main = pageRoot?.querySelector("#books-reader-text");
    if (main) {
      if (readerScrollHandler) {
        main.removeEventListener("scroll", readerScrollHandler);
      }
      readerScrollHandler = () => {
        onReaderContainerScroll(main);
        updateReaderPageUI();
      };
      main.addEventListener("scroll", readerScrollHandler, { passive: true });
    }
  }

  function ensureReaderResizeListener() {
    if (readerResizeBound) return;
    readerResizeBound = true;
    window.addEventListener(
      "resize",
      () => {
        if (state.view === "reader") updateReaderPageUI();
      },
      { passive: true }
    );
  }

  function scrollToChunk(index) {
    if (!pageRoot) return;
    const idx = Math.max(0, Number(index) || 0);
    readerAutoFollow = true;
    updateFollowButtonUI();
    scrollActiveChunkToView(idx, "smooth", true);
    updateChunkMarker();
  }

  function updateChunkMarker() {
    forEachReaderTextRoot((root) => {
      root.querySelectorAll(".books-chunk").forEach((el) => {
        const idx = Number(el.dataset.chunk);
        const isActive = state.tts.playing && idx === state.tts.chunkIndex;
        const isMarked = !state.tts.playing && idx === state.startChunkIndex;
        el.classList.toggle("books-chunk-active", isActive);
        el.classList.toggle("books-chunk-marked", isMarked && !isActive);
      });
    });
  }

  function saveBookmark() {
    if (!state.bookId || !state.bookMeta || !state.ttsChunks.length || !isBookTextComplete()) return;
    const chunkIndex = state.tts.playing ? state.tts.chunkIndex : state.startChunkIndex;
    const bookmark = {
      id: `${state.bookId}-${Date.now()}`,
      bookId: state.bookId,
      title: state.bookMeta.title || "",
      authors: state.bookMeta.authors || "",
      chunkIndex,
      chunkTotal: state.ttsChunks.length,
      showKoreanText: state.showKoreanText,
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
    state.showKoreanText =
      bookmark.showKoreanText === true || bookmark.readMode === "ko";
    state.voice = defaultVoiceForMode(uiVoiceLang(), state.engine);
    openReader(
      {
        id: bookmark.bookId,
        title: bookmark.title,
        authors: bookmark.authors
      },
      { chunkIndex: bookmark.chunkIndex, scrollToChunk: bookmark.chunkIndex, preserveShowKoreanText: true }
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
    const lang = mode || uiVoiceLang();
    if (state.engine === WEB_SPEECH_ENGINE_ID) {
      const options = webSpeechVoiceOptions(lang);
      if (options.length) return options;
      return [{ id: lang === "ko" ? "ko-KR" : "en-US", label: lang === "ko" ? "기본 한국어" : "Default English" }];
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
      state.translateChunks = [];
      state.ttsTranslateMap = [];
      state.batchOffsets = [];
      state.preparedTextSnapshot = "";
      state.startChunkIndex = 0;
      return;
    }
    const prepared = prepareBookText(state.bookText);
    state.preparedTextSnapshot = prepared;
    state.translateChunks = splitIntoChunks(prepared, TRANSLATE_CHUNK_MAX);
    state.batchOffsets = buildBatchOffsets(prepared, state.translateChunks);
    state.ttsChunks = isGoogleEngine()
      ? splitIntoByteChunks(prepared, GOOGLE_CHUNK_BYTES)
      : splitIntoChunks(prepared, chunkMaxForEngine());
    state.ttsTranslateMap = buildTtsTranslateMap(prepared, state.ttsChunks, state.batchOffsets);
    if (state.startChunkIndex >= state.ttsChunks.length) {
      state.startChunkIndex = 0;
    }
    if (state.translatedBatches.size) {
      reapplyTranslatedBatches();
    }
  }

  function buildBatchOffsets(prepared, batches) {
    const offsets = [];
    let searchFrom = 0;
    for (const batch of batches) {
      const start = prepared.indexOf(batch, searchFrom);
      if (start === -1) {
        const fallbackStart = searchFrom;
        offsets.push({ start: fallbackStart, end: fallbackStart + batch.length });
        searchFrom = fallbackStart + batch.length;
      } else {
        offsets.push({ start, end: start + batch.length });
        searchFrom = start + batch.length;
      }
    }
    return offsets;
  }

  function buildTtsTranslateMap(prepared, ttsChunks, batchOffsets) {
    let searchFrom = 0;
    return ttsChunks.map((chunk) => {
      let pos = prepared.indexOf(chunk, searchFrom);
      if (pos === -1) pos = prepared.indexOf(chunk);
      if (pos === -1) return null;
      searchFrom = pos + Math.max(1, chunk.length);
      for (let j = 0; j < batchOffsets.length; j++) {
        const { start, end } = batchOffsets[j];
        if (pos >= start && pos < end) {
          return {
            batchIndex: j,
            offset: pos - start,
            length: Math.min(chunk.length, end - pos)
          };
        }
      }
      return null;
    });
  }

  function isMostlyEnglish(text) {
    const sample = String(text || "");
    if (!sample.trim()) return false;
    const ko = (sample.match(/[\uAC00-\uD7A3]/g) || []).length;
    const en = (sample.match(/[A-Za-z]/g) || []).length;
    const letters = ko + en;
    return letters > 0 && en / letters > 0.35;
  }

  function chunkNeedsDirectTranslation(index) {
    const src = state.ttsChunks[index] || "";
    if (!src.trim() || !isMostlyEnglish(src)) return false;
    if (!state.translatedChunks.has(index)) return true;
    const existing = state.translatedChunks.get(index) || "";
    return isMostlyEnglish(existing);
  }

  function sliceKoForTtsMap(koText, srcBatch, map, nextMap) {
    const srcLen = Math.max(1, srcBatch.length);
    const koLen = koText.length;
    if (!koLen) return "";
    const startRatio = map.offset / srcLen;
    const endRatio = (map.offset + map.length) / srcLen;
    let koStart = Math.floor(startRatio * koLen);
    let koEnd = Math.ceil(endRatio * koLen);
    if (nextMap) {
      const nextStart = Math.floor((nextMap.offset / srcLen) * koLen);
      koEnd = Math.max(koEnd, nextStart);
    } else {
      koEnd = koLen;
    }
    koStart = Math.max(0, Math.min(koStart, koLen - 1));
    koEnd = Math.max(koEnd, koStart + 1);
    koEnd = Math.min(koEnd, koLen);
    return koText.slice(koStart, koEnd).trim();
  }

  function sliceTranslatedBatch(koText, srcBatch, offset, length) {
    return sliceKoForTtsMap(koText, srcBatch, { offset, length }, null);
  }

  function applyBatchTranslation(batchIndex, koText) {
    const srcBatch = state.translateChunks[batchIndex];
    if (!srcBatch) return;
    state.translatedBatches.set(batchIndex, koText);

    const mapped = [];
    for (let i = 0; i < state.ttsTranslateMap.length; i++) {
      const map = state.ttsTranslateMap[i];
      if (map && map.batchIndex === batchIndex) mapped.push({ index: i, map });
    }
    mapped.sort((a, b) => a.map.offset - b.map.offset || a.index - b.index);

    for (let n = 0; n < mapped.length; n++) {
      const { index, map } = mapped[n];
      const nextMap = n + 1 < mapped.length ? mapped[n + 1].map : null;
      const slice = sliceKoForTtsMap(koText, srcBatch, map, nextMap);
      if (slice) state.translatedChunks.set(index, slice);
    }
    updateReaderContentOnly();
  }

  function reapplyTranslatedBatches() {
    state.translatedChunks = new Map();
    for (const [batchIndex, koText] of state.translatedBatches.entries()) {
      applyBatchTranslation(batchIndex, koText);
    }
  }

  async function runTranslationPool(batchIndices, concurrency, signal, session, onProgress) {
    let cursor = 0;
    let completed = 0;
    const total = batchIndices.length;

    async function worker() {
      while (cursor < total) {
        if (session !== translateSessionId) return;
        const batchIndex = batchIndices[cursor++];
        if (state.translatedBatches.has(batchIndex)) {
          completed += 1;
          onProgress(completed, total);
          continue;
        }
        const translated = await fetchTranslation(state.translateChunks[batchIndex], signal);
        if (session !== translateSessionId) return;
        applyBatchTranslation(batchIndex, translated);
        completed += 1;
        onProgress(completed, total);
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
    await Promise.all(workers);
  }

  async function fillMissingTranslatedChunks(signal, session) {
    const indices = [];
    for (let i = 0; i < state.ttsChunks.length; i++) {
      if (chunkNeedsDirectTranslation(i)) indices.push(i);
    }
    if (!indices.length) return;

    let cursor = 0;
    const total = indices.length;

    async function worker() {
      while (cursor < total) {
        if (session !== translateSessionId) return;
        const chunkIndex = indices[cursor++];
        const src = state.ttsChunks[chunkIndex];
        if (!src?.trim()) continue;
        try {
          const translated = await fetchTranslation(src, signal);
          if (session !== translateSessionId) return;
          if (translated) {
            state.translatedChunks.set(chunkIndex, translated);
            updateReaderContentOnly();
          }
        } catch (err) {
          if (err.name === "AbortError") throw err;
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(TRANSLATE_CONCURRENCY, total) },
      () => worker()
    );
    await Promise.all(workers);
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

  function genreDisplay(book) {
    if (shouldShowKoreanText() && state.listTranslated.has(book.id)) {
      const genre = state.listTranslated.get(book.id)?.genre;
      if (genre) return genre;
    }
    return genrePreview(book);
  }

  function pickHtmlUrlFromBook(book) {
    const formats = book.formats || {};
    if (formats["text/html"]) return formats["text/html"];
    if (book.html_url) return book.html_url;
    if (book.id) return `https://www.gutenberg.org/ebooks/${book.id}.html.images`;
    return "";
  }

  function authorYearsFromBook(book) {
    if (book?.author_years) return book.author_years;
    const authors = book?.authors_raw || book?.authors;
    if (!Array.isArray(authors) || !authors.length) return "";
    const primary = authors.find((a) => a && a.name) || authors[0];
    if (!primary || typeof primary === "string") return "";
    const birth = primary.birth_year;
    const death = primary.death_year;
    if (birth != null && death != null) return `${birth}–${death}`;
    if (birth != null) return `${birth}–?`;
    if (death != null) return `?–${death}`;
    return "";
  }

  function primaryLanguageLabel(book) {
    const langs = (book.languages || []).filter(Boolean);
    return langs.length ? languageLabel(langs[0]) : "";
  }

  function renderBookListMeta(book) {
    const parts = [];
    const years = authorYearsFromBook(book);
    const lang = primaryLanguageLabel(book);
    const downloads = formatCount(book.download_count);
    if (years) parts.push(`<span class="books-card-meta-years">${escapeHtml(years)}</span>`);
    if (lang) parts.push(`<span class="books-card-meta-lang">${escapeHtml(lang)}</span>`);
    if (downloads !== "—") {
      parts.push(`<span class="books-card-meta-downloads">(${escapeHtml(downloads)})</span>`);
    }
    if (!parts.length) return "";
    return parts.join('<span class="books-card-meta-sep" aria-hidden="true">·</span>');
  }

  function hasHtmlPreview(book) {
    return !!book?.id;
  }

  function htmlPreviewProxyUrl(bookId) {
    return `${apiBase()}/api/gutenberg/html/${bookId}`;
  }

  function findListBook(bookId) {
    return (
      state.books.find((b) => b.id === bookId) ||
      (state.themeBooksAll.length ? state.themeBooksAll.find((b) => b.id === bookId) : null)
    );
  }

  function ensureHtmlPreviewOverlay() {
    if (htmlPreviewEl) return;
    htmlPreviewEl = document.createElement("div");
    htmlPreviewEl.id = "books-html-preview";
    htmlPreviewEl.className = "books-html-preview";
    htmlPreviewEl.hidden = true;
    htmlPreviewEl.innerHTML = `
      <div class="books-html-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="books-html-preview-title">
        <header class="books-html-preview-head">
          <h2 class="books-html-preview-title" id="books-html-preview-title"></h2>
          <div class="books-html-preview-actions">
            <a class="books-btn books-btn-ghost books-html-external" id="books-html-external" href="#" target="_blank" rel="noopener noreferrer">Gutenberg ↗</a>
            <button type="button" class="books-btn books-html-close" id="books-html-close" aria-label="HTML 보기 닫기">✕</button>
          </div>
        </header>
        <p class="books-html-status" id="books-html-status" role="status" aria-live="polite">HTML을 불러오는 중…</p>
        <iframe class="books-html-frame" id="books-html-frame" title="Gutenberg HTML edition" hidden></iframe>
      </div>
    `;
    document.body.appendChild(htmlPreviewEl);
  }

  function bindHtmlPreviewEvents() {
    if (htmlPreviewEventsBound || !htmlPreviewEl) return;
    htmlPreviewEventsBound = true;
    htmlPreviewEl.querySelector("#books-html-close")?.addEventListener("click", closeHtmlPreview);
    htmlPreviewEl.addEventListener("click", (event) => {
      if (event.target === htmlPreviewEl) closeHtmlPreview();
    });
    const frame = htmlPreviewEl.querySelector("#books-html-frame");
    if (frame) {
      frame.addEventListener("load", () => {
        if (htmlPreviewEl.hidden || frame.src) return;
        if (frame.srcdoc) {
          setHtmlPreviewStatus("");
          frame.hidden = false;
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && htmlPreviewEl && !htmlPreviewEl.hidden) closeHtmlPreview();
    });
  }

  function setHtmlPreviewStatus(message) {
    if (!htmlPreviewEl) return;
    const statusEl = htmlPreviewEl.querySelector("#books-html-status");
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-empty", !message);
  }

  function openHtmlPreview(book) {
    if (!book?.id) return;
    ensureHtmlPreviewOverlay();
    bindHtmlPreviewEvents();
    const title = bookListDisplay(book).title || book.title || "Untitled";
    const externalUrl = pickHtmlUrlFromBook(book);
    const titleEl = htmlPreviewEl.querySelector("#books-html-preview-title");
    const externalEl = htmlPreviewEl.querySelector("#books-html-external");
    const frame = htmlPreviewEl.querySelector("#books-html-frame");
    if (titleEl) titleEl.textContent = title;
    if (externalEl) {
      externalEl.href = externalUrl || `https://www.gutenberg.org/ebooks/${book.id}`;
    }
    if (frame) {
      frame.hidden = true;
      frame.removeAttribute("src");
      frame.removeAttribute("srcdoc");
    }
    setHtmlPreviewStatus("HTML을 불러오는 중…");
    htmlPreviewEl.hidden = false;
    document.body.classList.add("books-html-preview-open");
    htmlPreviewEl.querySelector("#books-html-close")?.focus();
    void loadHtmlPreviewContent(book.id, frame);
  }

  async function loadHtmlPreviewContent(bookId, frame) {
    try {
      const res = await fetch(htmlPreviewProxyUrl(bookId));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail = typeof data.detail === "string" ? data.detail : `HTTP ${res.status}`;
        throw new Error(detail);
      }
      const html = await res.text();
      if (!htmlPreviewEl || htmlPreviewEl.hidden || !frame) return;
      frame.srcdoc = html;
      frame.hidden = false;
      setHtmlPreviewStatus("");
    } catch (err) {
      if (!htmlPreviewEl || htmlPreviewEl.hidden) return;
      const msg = err?.message ? String(err.message) : "알 수 없는 오류";
      setHtmlPreviewStatus(`HTML을 불러오지 못했습니다: ${msg}`);
    }
  }

  function closeHtmlPreview() {
    if (!htmlPreviewEl) return;
    const frame = htmlPreviewEl.querySelector("#books-html-frame");
    if (frame) {
      frame.removeAttribute("src");
      frame.removeAttribute("srcdoc");
      frame.hidden = true;
    }
    setHtmlPreviewStatus("");
    htmlPreviewEl.hidden = true;
    document.body.classList.remove("books-html-preview-open");
  }

  function pickCoverUrlFromBook(book) {
    const formats = book.formats || {};
    const id = book.id;
    if (formats["image/jpeg"]) return formats["image/jpeg"];
    if (id) return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
    return book.cover_url || "";
  }

  function languageLabel(code) {
    const labels = {
      en: "EN",
      fr: "FR",
      de: "DE",
      es: "ES",
      it: "IT",
      pt: "PT",
      la: "LA",
      fi: "FI",
      nl: "NL",
      zh: "ZH",
      ja: "JA",
      ko: "KO"
    };
    const key = String(code || "").toLowerCase();
    return labels[key] || key.toUpperCase();
  }

  function renderBookCover(book, altTitle) {
    const url = pickCoverUrlFromBook(book);
    const alt = escapeHtml(altTitle || "Book cover");
    if (!url) {
      return `<div class="books-card-cover-wrap is-fallback" aria-hidden="true"><span class="books-card-cover-fallback">📖</span></div>`;
    }
    return `
      <div class="books-card-cover-wrap">
        <img class="books-card-cover" src="${escapeHtml(url)}" alt="${alt}" loading="lazy" decoding="async" onerror="this.classList.add('is-broken'); this.closest('.books-card-cover-wrap')?.classList.add('is-fallback')">
        <span class="books-card-cover-fallback" aria-hidden="true">📖</span>
      </div>`;
  }

  function renderBookLanguageBadges(book) {
    const langs = (book.languages || []).filter(Boolean).slice(0, 4);
    if (!langs.length) return "";
    return langs
      .map((code) => `<span class="books-card-lang">${escapeHtml(languageLabel(code))}</span>`)
      .join("");
  }

  function parseListTranslation(translated, book, genreFallback) {
    const parts = String(translated || "").split("\n|\n");
    return {
      title: (parts[0] || book.title || "").trim(),
      authors: (parts[1] || book.authors || "Unknown author").trim(),
      genre: (parts[2] || genreFallback || "").trim()
    };
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
    let text = stripGutenbergBoilerplate(String(raw || ""))
      .replace(/\r\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n");
    text = text.replace(/-\n(?=\S)/g, "");
    text = text.replace(/([^\n])\n([^\n])/g, "$1 $2");
    return text
      .split(/\n\n+/)
      .map((block) => block.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n")
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
    const base = THEME_CATALOG.find((t) => t.id === themeId) || themeList().find((t) => t.id === themeId);
    if (!base) return null;
    const expand = THEME_GUTENDEX_EXPAND[themeId];
    return expand ? { ...base, ...expand } : base;
  }

  function serializeGutendexBook(book) {
    const authorObjs = book.authors || [];
    const authors = authorObjs
      .map((a) => a.name)
      .filter(Boolean)
      .join(", ");
    const serialized = {
      id: book.id,
      title: book.title || "Untitled",
      authors: authors || "Unknown author",
      author_years: authorYearsFromBook({ authors_raw: authorObjs }),
      subjects: book.subjects || [],
      bookshelves: book.bookshelves || [],
      languages: book.languages || [],
      download_count: book.download_count,
      copyright: book.copyright,
      license: "public_domain_us"
    };
    const coverUrl = pickCoverUrlFromBook(book);
    if (coverUrl) serialized.cover_url = coverUrl;
    if (book.id) serialized.html_url = pickHtmlUrlFromBook(book);
    const formats = book.formats || {};
    const epub =
      formats["application/epub+zip"] || formats["application/epub+zip; charset=utf-8"];
    if (epub) serialized.epub_url = epub;
    return serialized;
  }

  async function collectGutendexBooks(params, maxBooks, signal) {
    const byId = new Map();
    let page = 1;
    while (byId.size < maxBooks && page <= 8) {
      const url = new URL("https://gutendex.com/books/");
      url.searchParams.set("languages", "en");
      url.searchParams.set("page", String(page));
      if (params.search) url.searchParams.set("search", params.search);
      if (params.topic) url.searchParams.set("topic", params.topic);
      const res = await fetch(url.href, { signal });
      if (!res.ok) break;
      const data = await res.json().catch(() => ({}));
      for (const book of data.results || []) {
        if (book.copyright !== false || !book.id) continue;
        if (!byId.has(book.id)) byId.set(book.id, serializeGutendexBook(book));
      }
      if (!data.next) break;
      page += 1;
    }
    return byId;
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

  function filterThemeBooks(books, search) {
    const q = (search || "").trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => `${b.title || ""} ${b.authors || ""}`.toLowerCase().includes(q));
  }

  function sortThemeBooks(books) {
    return [...books].sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
  }

  function listPageSize() {
    return state.theme ? LIST_PAGE_SIZE : THEME_PAGE_SIZE;
  }

  function applyThemePageSlice() {
    const filtered = filterThemeBooks(state.themeBooksAll, state.search);
    state.count = filtered.length;
    const start = (state.page - 1) * LIST_PAGE_SIZE;
    state.books = filtered.slice(start, start + LIST_PAGE_SIZE);
  }

  function saveThemeCache(themeId, books, phase) {
    themeBooksCache.set(themeId, { books: [...books], phase });
  }

  function applyThemeMeta(themeId) {
    const meta = themeMeta(themeId);
    if (!meta) return;
    state.themeLabel = meta.label || "";
    state.themeDescription = meta.description || "";
  }

  function maybeTranslateVisibleList() {
    if (
      state.view === "list" &&
      shouldShowKoreanText() &&
      state.books.some((b) => !state.listTranslated.has(b.id))
    ) {
      void translateListBooks();
    }
  }

  function themeBooksFromMap(byId) {
    return sortThemeBooks(Array.from(byId.values()));
  }

  function mergeIntoThemeMap(byId, collected) {
    collected.forEach((row, id) => {
      if (!byId.has(id)) byId.set(id, row);
    });
  }

  function updateThemeBooksFromMap(byId, themeId, fetchSession) {
    if (fetchSession !== themeFetchSession || state.theme !== themeId) return false;
    state.themeBooksAll = themeBooksFromMap(byId);
    saveThemeCache(themeId, state.themeBooksAll, state.themeFetchPhase);
    applyThemePageSlice();
    render();
    return true;
  }

  async function expandThemeBooks(byId, meta, themeId, signal, fetchSession) {
    for (const q of meta.search_queries || []) {
      if (fetchSession !== themeFetchSession || state.theme !== themeId) return;
      if (byId.size >= THEME_GUTENDEX_MAX) break;
      const collected = await collectGutendexBooks({ search: q }, THEME_GUTENDEX_MAX - byId.size, signal);
      mergeIntoThemeMap(byId, collected);
      state.themeFetchPhase = "expanding";
      updateThemeBooksFromMap(byId, themeId, fetchSession);
    }
    for (const topic of meta.topics || []) {
      if (fetchSession !== themeFetchSession || state.theme !== themeId) return;
      if (byId.size >= THEME_GUTENDEX_MAX) break;
      const collected = await collectGutendexBooks({ topic }, THEME_GUTENDEX_MAX - byId.size, signal);
      mergeIntoThemeMap(byId, collected);
      state.themeFetchPhase = "expanding";
      updateThemeBooksFromMap(byId, themeId, fetchSession);
    }
  }

  async function fetchThemeBooksStaged(themeId, signal, fetchSession) {
    const meta = themeMeta(themeId);
    if (!meta) {
      throw new Error("알 수 없는 테마입니다.");
    }
    applyThemeMeta(themeId);
    const byId = new Map();

    const curated = await fetchBooksByIds(meta.book_ids || [], signal);
    curated.forEach((book) => {
      if (book?.id) byId.set(book.id, book);
    });

    if (fetchSession !== themeFetchSession || state.theme !== themeId) return;

    state.themeFetchPhase = "expanding";
    state.themeBooksAll = themeBooksFromMap(byId);
    saveThemeCache(themeId, state.themeBooksAll, "expanding");
    state.loading = false;
    applyThemePageSlice();
    render();
    maybeTranslateVisibleList();

    await expandThemeBooks(byId, meta, themeId, signal, fetchSession);
    if (fetchSession !== themeFetchSession || state.theme !== themeId) return;

    state.themeFetchPhase = "done";
    state.themeBooksAll = themeBooksFromMap(byId);
    saveThemeCache(themeId, state.themeBooksAll, "done");
    applyThemePageSlice();
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
          state.voice = defaultVoiceForMode(uiVoiceLang(), state.engine);
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
    if (state.theme) {
      const cached = themeBooksCache.get(state.theme);
      if (cached?.phase === "done") {
        state.themeBooksAll = cached.books;
        state.themeFetchPhase = "done";
        state.loading = false;
        state.error = "";
        applyThemeMeta(state.theme);
        applyThemePageSlice();
        render();
        maybeTranslateVisibleList();
        return;
      }
    }

    if (listAbort) listAbort.abort();
    listAbort = new AbortController();
    const signal = listAbort.signal;

    state.loading = true;
    state.error = "";
    if (state.theme) {
      state.themeBooksAll = [];
      state.themeFetchPhase = "loading";
      themeFetchSession += 1;
    }
    render();

    try {
      if (state.theme) {
        const fetchSession = themeFetchSession;
        await fetchThemeBooksStaged(state.theme, signal, fetchSession);
        if (fetchSession !== themeFetchSession) return;
        if (state.theme && !state.themeLabel) {
          applyThemeMeta(state.theme);
        }
      } else {
        state.themeBooksAll = [];
        state.themeFetchPhase = "idle";
        const res = await fetch(buildBooksUrl(), { signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || `목록을 불러오지 못했습니다 (${res.status})`);
        }
        applyBooksPayload(data);
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      state.books = [];
      state.themeBooksAll = [];
      state.themeFetchPhase = "idle";
      state.error = err.message || "목록을 불러오지 못했습니다.";
    } finally {
      state.loading = false;
      render();
      maybeTranslateVisibleList();
    }
  }

  function navigateListPage(dir) {
    if (state.theme && state.themeBooksAll.length) {
      const filtered = filterThemeBooks(state.themeBooksAll, state.search);
      const totalPages = Math.max(1, Math.ceil(filtered.length / LIST_PAGE_SIZE));
      if (dir === "prev" && state.page > 1) {
        state.page -= 1;
        applyThemePageSlice();
        render();
        maybeTranslateVisibleList();
        return;
      }
      if (dir === "next" && state.page < totalPages) {
        state.page += 1;
        applyThemePageSlice();
        render();
        maybeTranslateVisibleList();
      }
      return;
    }
    if (dir === "prev" && state.page > 1) {
      state.page -= 1;
      void fetchBooks();
    } else if (dir === "next") {
      state.page += 1;
      void fetchBooks();
    }
  }

  async function fetchBookText(bookId, options) {
    if (textAbort) textAbort.abort();
    textAbort = new AbortController();
    const signal = textAbort.signal;
    const preserveStartChunk = !!options?.preserveStartChunk;
    textFetchSession += 1;
    const session = textFetchSession;

    state.textLoading = true;
    state.textLoadPhase = "loading_preview";
    state.textError = "";
    state.bookText = "";
    state.ttsChunks = [];
    if (!preserveStartChunk) {
      state.startChunkIndex = 0;
    }
    state.translatedChunks = new Map();
    state.translatedBatches = new Map();
    state.translateChunks = [];
    state.ttsTranslateMap = [];
    state.batchOffsets = [];
    state.preparedTextSnapshot = "";
    if (!options?.preserveListTranslations) {
      state.listTranslated = new Map();
    }
    if (!options?.preserveShowKoreanText) {
      state.showKoreanText = false;
    }
    state.translation = { running: false, current: 0, total: 0, error: "", scope: "" };
    render();

    try {
      const previewUrl = `${apiBase()}/api/gutenberg/text/${bookId}?preview_bytes=${TEXT_PREVIEW_BYTES}`;
      const res = await fetch(previewUrl, { signal });
      const data = await res.json().catch(() => ({}));
      if (session !== textFetchSession) return;
      if (!res.ok) {
        throw new Error(data.detail || `본문을 불러오지 못했습니다 (${res.status})`);
      }

      applyBookTextData(data);
      state.textLoadPhase = data.partial === true ? "partial" : "complete";
    } catch (err) {
      if (err.name === "AbortError" || session !== textFetchSession) return;
      state.textError = err.message || "본문을 불러오지 못했습니다.";
      state.textLoadPhase = "idle";
    } finally {
      if (session !== textFetchSession) return;
      state.textLoading = false;
      finishBookTextLoad();
      if (state.textLoadPhase === "partial") {
        void fetchBookTextFull(bookId, session, signal);
      }
    }
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
    if (!state.bookText || !state.translateChunks.length) return;
    if (state.translation.running) return;

    const session = ++translateSessionId;
    if (translateAbort) translateAbort.abort();
    translateAbort = new AbortController();
    const signal = translateAbort.signal;

    state.showKoreanText = true;
    const pending = state.translateChunks
      .map((_, i) => i)
      .filter((i) => !state.translatedBatches.has(i));
    if (!pending.length) {
      updateTranslationUI();
      render();
      return;
    }

    const alreadyDone = state.translatedBatches.size;
    state.translation = {
      running: true,
      current: alreadyDone,
      total: state.translateChunks.length,
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

    try {
      await runTranslationPool(
        pending,
        TRANSLATE_CONCURRENCY,
        signal,
        session,
        (done) => {
          state.translation.current = alreadyDone + done;
          state.translation.total = state.translateChunks.length;
          updateTranslationUI();
        }
      );
      if (session !== translateSessionId) return;
      await fillMissingTranslatedChunks(signal, session);
    } catch (err) {
      if (err.name === "AbortError") return;
      state.translation.error = err.message || "번역 실패";
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

    let cursor = 0;
    let completed = 0;
    const total = pending.length;

    async function translateOneBook(book) {
      const genre = genrePreview(book);
      const payload = `${book.title || ""}\n|\n${book.authors || "Unknown author"}\n|\n${genre}`;
      const translated = await fetchTranslation(payload, signal);
      if (session !== translateSessionId) return;
      const parsed = parseListTranslation(translated, book, genre);
      state.listTranslated.set(book.id, parsed);
      updateListTextOnly();
      completed += 1;
      state.translation.current = completed;
      updateTranslationUI();
    }

    async function worker() {
      while (cursor < total) {
        if (session !== translateSessionId) return;
        const book = pending[cursor++];
        try {
          await translateOneBook(book);
        } catch (err) {
          if (err.name === "AbortError") return;
          state.translation.error = err.message || "번역 실패";
          return;
        }
      }
    }

    try {
      await Promise.all(
        Array.from({ length: Math.min(TRANSLATE_CONCURRENCY, total) }, () => worker())
      );
    } catch (err) {
      if (err.name === "AbortError") return;
      state.translation.error = err.message || "번역 실패";
    }

    if (session !== translateSessionId) return;
    state.translation.running = false;
    updateTranslationUI();
    render();
  }

  function showOriginalText() {
    state.showKoreanText = false;
    stopTranslation();
    state.voice = defaultVoiceForMode(uiVoiceLang(), state.engine);
    if (state.view === "list") {
      showOriginalListText();
      return;
    }
    updateReaderContentOnly();
    updateTranslationUI();
    render();
  }

  function startKoreanTranslation() {
    if (state.translation.running) return;
    if (state.view === "list") {
      if (!state.books.length || state.loading) return;
      state.showKoreanText = true;
      void translateListBooks();
      return;
    }
    if (!state.bookText || state.textLoading || !isBookTextComplete()) return;
    if (!state.ttsChunks.length) refreshChunks();
    state.showKoreanText = true;
    state.voice = defaultVoiceForMode("ko", state.engine);
    const allDone =
      state.translateChunks.length > 0 &&
      state.translateChunks.every((_, i) => state.translatedBatches.has(i));
    if (allDone) {
      updateReaderContentOnly();
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
    const listStatusEl = pageRoot.querySelector("#books-list-translate-status");
    const readerReady = state.view === "reader" && !!state.bookText && !state.textLoading && isBookTextComplete();
    const busy = state.translation.running || state.textLoading || state.textLoadPhase === "loading_rest";
    if (translateBtn) {
      translateBtn.disabled = busy || !readerReady;
      translateBtn.textContent = state.translation.running && state.translation.scope === "reader"
        ? "번역 중…"
        : "한글 번역";
    }
    if (originalBtn) {
      originalBtn.disabled = busy || (!shouldShowKoreanText() && !state.translation.running);
    }
    updateListLangButtonUI();
    let msg = state.translation.error || "";
    if (!msg && state.translation.running) {
      const scopeLabel = state.translation.scope === "list" ? "목록" : "본문";
      msg = `한글 번역 중… ${scopeLabel} ${state.translation.current}/${state.translation.total}`;
    } else if (!msg && shouldShowKoreanText()) {
      if (state.view === "reader" && state.translatedBatches.size) {
        msg = `한글 번역 ${state.translatedBatches.size}/${state.translateChunks.length}묶음 · 표시 ${state.translatedChunks.size}/${state.ttsChunks.length}구간`;
      } else if (state.view === "reader" && state.translatedChunks.size) {
        msg = `한글 번역 ${state.translatedChunks.size}/${state.ttsChunks.length}구간`;
      } else if (state.view === "list" && state.listTranslated.size) {
        msg = `목록 번역 ${state.listTranslated.size}/${state.books.length}권`;
      }
    }
    if (statusEl) {
      statusEl.textContent = state.view === "reader" ? msg : "";
      statusEl.classList.toggle("is-empty", state.view !== "reader" || !msg);
    }
    if (listStatusEl) {
      listStatusEl.textContent = state.view === "list" ? msg : "";
      listStatusEl.classList.toggle("is-empty", state.view !== "list" || !msg);
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
      const genreEl = card.querySelector(".books-card-genre");
      if (titleEl) titleEl.textContent = display.title || "";
      if (authorEl) authorEl.textContent = display.authors || "";
      if (genreEl) genreEl.textContent = genreDisplay(book);
      card.classList.toggle("books-card-pending", !!display.pending);
    });
    const meta = bookDisplayMeta();
    const titleEl = pageRoot.querySelector(".books-reader-title");
    const authorEl = pageRoot.querySelector(".books-reader-author");
    if (titleEl) titleEl.textContent = meta.title || "";
    if (authorEl) authorEl.textContent = meta.authors || "";
  }

  async function playTtsBlob(text, sessionId, lang, onStatus) {
    if (isGoogleEngine() && utf8ByteLength(text) > GOOGLE_CHUNK_BYTES) {
      const subChunks = splitIntoByteChunks(text, GOOGLE_CHUNK_BYTES);
      for (let i = 0; i < subChunks.length; i++) {
        if (sessionId !== ttsSessionId) return;
        if (onStatus) onStatus(i + 1, subChunks.length);
        const blob = await fetchTtsAudio(subChunks[i], lang);
        if (sessionId !== ttsSessionId) return;
        await playAudioBlob(blob, sessionId);
        if (sessionId !== ttsSessionId) return;
      }
      return;
    }

    const blob = await fetchTtsAudio(text, lang);
    if (sessionId !== ttsSessionId) return;
    await playAudioBlob(blob, sessionId);
  }

  function playAudioBlob(blob, sessionId) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      currentAudio = new Audio(url);
      currentAudio.playbackRate = ttsPlaybackRate();
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

  async function fetchTtsAudio(text, lang) {
    if (ttsAbort) ttsAbort.abort();
    ttsAbort = new AbortController();
    const speechLang = lang || detectTextLang(text);
    const res = await fetch(`${apiBase()}/api/books/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        engine: state.engine,
        voice: state.voice,
        rate: state.rate,
        lang: speechLang
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
    updateFollowButtonUI();
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
      const testLang = uiVoiceLang();
      if (testLang === "ko") {
        setTestStatus("번역 중…");
        text = await translateChunk(text);
        if (session !== testSessionId) return;
        setTestStatus("음성 합성 중…");
      }
      ensureVoiceMatchesLang(testLang);

      if (isWebSpeechEngine(state.engine)) {
        setTestStatus("재생 중…");
        await speakWebSpeechText(text, () => session === testSessionId, testLang === "ko" ? "ko" : "en");
        if (session !== testSessionId) return;
        state.tts.testing = false;
        setTestStatus("테스트 완료");
        return;
      }

      const blob = await fetchTtsAudio(text, testLang === "ko" ? "ko" : "en");
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
      const speech = chunkSpeechContent(index);
      const text = speech.text;
      const speechLang = speech.lang;
      ensureVoiceMatchesLang(speechLang);

      if (!sanitizeSpeechText(text)) {
        void playFromChunk(index + 1, sessionId);
        return;
      }

      setTtsStatus(`음성 합성 중… (${index + 1}/${state.ttsChunks.length})`);

      if (isWebSpeechEngine(state.engine)) {
        setTtsStatus(`재생 중 (${index + 1}/${state.ttsChunks.length})`);
        await speakWebSpeechText(text, () => sessionId === ttsSessionId, speechLang);
        if (sessionId !== ttsSessionId) return;
        void playFromChunk(index + 1, sessionId);
        return;
      }

      await playTtsBlob(text, sessionId, speechLang, (subIdx, subTotal) => {
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
    if (!isBookTextComplete()) {
      setTtsStatus("전체 본문 로딩 후 듣기를 사용할 수 있습니다.");
      updatePlayerUI();
      return;
    }
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
    readerAutoFollow = true;
    const sessionId = ttsSessionId;
    const speechMode = uiVoiceLang();
    const begin = () => void playFromChunk(state.startChunkIndex, sessionId);
    if (isWebSpeechEngine(state.engine)) {
      setTtsStatus("음성 준비 중…");
      void waitForWebSpeechVoices().then(() => {
        if (sessionId !== ttsSessionId) return;
        ensureVoiceMatchesLang(speechMode);
        if (speechMode === "ko" && !webSpeechHasVoiceForLang("ko")) {
          setTtsStatus("한국어 음성 없음 — 브라우저 기본(ko-KR)으로 재생 시도…");
        }
        begin();
      });
      return;
    }
    ensureVoiceMatchesLang(speechMode);
    begin();
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
    state.textLoadPhase = "idle";
    state.translatedChunks = new Map();
    state.translatedBatches = new Map();
    state.translateChunks = [];
    state.ttsTranslateMap = [];
    state.batchOffsets = [];
    state.preparedTextSnapshot = "";
    state.translation = { running: false, current: 0, total: 0, error: "", scope: "" };
    state.ttsChunks = [];
    state.startChunkIndex = options?.chunkIndex ?? 0;
    pendingReaderScrollChunk =
      options?.scrollToChunk != null ? options.scrollToChunk : null;
    render();
    void fetchBookText(book.id, {
      preserveStartChunk: options?.chunkIndex != null,
      preserveListTranslations: !!options?.preserveListTranslations,
      preserveShowKoreanText: !!options?.preserveShowKoreanText
    });
  }

  function backToList() {
    stopTts();
    stopTranslation();
    closeReaderFullscreen();
    closeHtmlPreview();
    state.view = "list";
    state.bookId = null;
    state.bookMeta = null;
    state.bookText = "";
    state.textError = "";
    state.ttsChunks = [];
    state.startChunkIndex = 0;
    state.translatedChunks = new Map();
    state.translatedBatches = new Map();
    state.translateChunks = [];
    state.ttsTranslateMap = [];
    state.batchOffsets = [];
    state.preparedTextSnapshot = "";
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
    state.voice = defaultVoiceForMode(uiVoiceLang(), engineId);
    state.translatedChunks = new Map();
    state.translatedBatches = new Map();
    state.showKoreanText = false;
    state.startChunkIndex = 0;
    state.translation = { running: false, current: 0, total: 0, error: "", scope: "" };
    refreshChunks();
    render();
  }

  function downloadCurrentText() {
    if (!state.bookText || !state.bookMeta || !isBookTextComplete()) return;
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

  function filterOptionLabel(options, value) {
    const found = options.find((o) => o.id === value);
    return found ? found.label : options[0]?.label || "";
  }

  function renderFilterPicker(name, label, options, value, disabled, extraClass, pickerId) {
    const currentLabel = filterOptionLabel(options, value);
    const optionsHtml = options
      .map(
        (o) =>
          `<button type="button" class="books-filter-option${o.id === value ? " is-selected" : ""}" data-value="${escapeHtml(o.id)}" role="option" aria-selected="${o.id === value ? "true" : "false"}">${escapeHtml(o.label)}</button>`
      )
      .join("");
    const extra = extraClass ? ` ${extraClass}` : "";
    const idAttr = pickerId ? ` id="${escapeHtml(pickerId)}"` : "";
    return `
      <div class="books-field books-filter-picker${disabled ? " is-disabled" : ""}${extra}" data-filter-name="${escapeHtml(name)}">
        <span class="books-label">${escapeHtml(label)}</span>
        <input type="hidden" name="${escapeHtml(name)}"${idAttr} value="${escapeHtml(value)}">
        <button type="button" class="books-filter-trigger" aria-haspopup="listbox" aria-expanded="false"${disabled ? " disabled" : ""}>
          <span class="books-filter-trigger-text">${escapeHtml(currentLabel)}</span>
          <span class="books-filter-caret" aria-hidden="true">▾</span>
        </button>
        <div class="books-filter-menu" role="listbox" hidden>
          ${optionsHtml}
        </div>
      </div>
    `;
  }

  function readerThemePickerOptions() {
    return READER_THEMES.map((t) => ({ id: t.id, label: t.label }));
  }

  function enginePickerOptions() {
    return engineList().map((e) => {
      let suffix = "";
      if (!e.configured) {
        suffix = e.id === WEB_SPEECH_ENGINE_ID ? " (미지원)" : e.rate_limited ? " (시간 한도)" : " (미설정)";
      }
      return { id: e.id, label: `${e.label}${suffix}` };
    });
  }

  function voicePickerOptions() {
    return voicesForMode(uiVoiceLang()).map((v) => ({
      id: v.id,
      label: v.label || v.id
    }));
  }

  function ratePickerOptions() {
    return TTS_RATES.map((rate) => ({ id: rate, label: `${rate}×` }));
  }

  function setOptionPickerValue(pickerId, value, options) {
    const hidden = pageRoot?.querySelector(`#${pickerId}`);
    if (!hidden) return;
    hidden.value = value;
    const picker = hidden.closest(".books-filter-picker");
    if (!picker) return;
    const label = filterOptionLabel(options, value);
    const triggerText = picker.querySelector(".books-filter-trigger-text");
    if (triggerText) triggerText.textContent = label;
    picker.querySelectorAll(".books-filter-option").forEach((opt) => {
      const selected = (opt.dataset.value ?? "") === value;
      opt.classList.toggle("is-selected", selected);
      opt.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function setPickerDisabled(pickerId, disabled) {
    const hidden = pageRoot?.querySelector(`#${pickerId}`);
    const picker = hidden?.closest(".books-filter-picker");
    const trigger = picker?.querySelector(".books-filter-trigger");
    if (!picker || !trigger) return;
    trigger.disabled = disabled;
    picker.classList.toggle("is-disabled", disabled);
  }

  let booksFilterPickerDocBound = false;

  function filterMenuMobile() {
    return window.matchMedia("(max-width: 520px)").matches;
  }

  function resetFilterMenuPosition(menu) {
    if (!menu) return;
    menu.style.position = "";
    menu.style.top = "";
    menu.style.left = "";
    menu.style.right = "";
    menu.style.width = "";
    menu.style.maxHeight = "";
    menu.style.bottom = "";
    menu.style.transform = "";
    menu.classList.remove("is-flipped");
  }

  function getBooksOptionBackdrop() {
    return document.getElementById("books-option-backdrop");
  }

  function setBooksFilterScrollLock(locked) {
    document.body.classList.toggle("books-filter-menu-open", !!locked);
  }

  function isBooksFilterInteractionTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest("#books-option-layer") || !!target.closest(".books-filter-picker.is-open");
  }

  function ensureBooksOptionLayer() {
    let layer = document.getElementById("books-option-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "books-option-layer";
      layer.setAttribute("aria-hidden", "true");
    }
    document.body.appendChild(layer);
    return layer;
  }

  function clearBooksOptionLayer() {
    const layer = document.getElementById("books-option-layer");
    if (layer && !layer.childElementCount) {
      layer.setAttribute("aria-hidden", "true");
    }
  }

  function restoreBooksFilterBackdrop(backdrop) {
    if (!backdrop || !backdrop._portalHome) return;
    backdrop._portalHome.appendChild(backdrop);
    delete backdrop._portalHome;
  }

  function restoreBooksFilterMenu(menu) {
    if (!menu) return;
    const picker = menu._portalPicker;
    if (picker && menu.parentElement !== picker) {
      picker.appendChild(menu);
      delete picker._portaledMenu;
    }
    delete menu._portalPicker;
    menu.classList.remove("is-portaled");
  }

  function portalBooksFilterMenu(picker, menu, backdrop) {
    if (!filterMenuMobile()) return;
    const layer = ensureBooksOptionLayer();
    layer.setAttribute("aria-hidden", "false");
    if (backdrop && backdrop.parentElement !== layer) {
      backdrop._portalHome = backdrop.parentElement;
      layer.appendChild(backdrop);
    }
    menu._portalPicker = picker;
    picker._portaledMenu = menu;
    menu.classList.add("is-portaled");
    if (menu.parentElement !== layer) {
      layer.appendChild(menu);
    } else {
      layer.appendChild(menu);
    }
  }

  function positionFilterMenu(trigger, menu) {
    if (!filterMenuMobile()) return;

    menu.style.position = "fixed";
    menu.style.left = "0";
    menu.style.right = "0";
    menu.style.bottom = "0";
    menu.style.top = "auto";
    menu.style.width = "auto";
    menu.style.maxHeight = "min(52vh, 420px)";
    menu.style.transform = "none";
    menu.classList.remove("is-flipped");
  }

  function closeBooksFilterMenus(exceptPicker) {
    if (!pageRoot) return;
    const backdrop = getBooksOptionBackdrop();
    pageRoot.querySelectorAll(".books-filter-picker.is-open").forEach((picker) => {
      if (exceptPicker && picker === exceptPicker) return;
      picker.classList.remove("is-open");
      const trigger = picker.querySelector(".books-filter-trigger");
      const menu = picker._portaledMenu || picker.querySelector(".books-filter-menu");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      if (menu) {
        menu.hidden = true;
        menu.setAttribute("hidden", "");
        resetFilterMenuPosition(menu);
        restoreBooksFilterMenu(menu);
      }
      delete picker._portaledMenu;
    });
    if (backdrop) {
      const keepOpen = exceptPicker && exceptPicker.classList.contains("is-open");
      backdrop.hidden = !keepOpen;
      if (!keepOpen) {
        restoreBooksFilterBackdrop(backdrop);
        clearBooksOptionLayer();
      }
    }
    if (!exceptPicker || !exceptPicker.classList.contains("is-open")) {
      setBooksFilterScrollLock(false);
    }
  }

  function applyFilterOptionSelection(picker, hidden, triggerText, menu, opt, handlers, form) {
    const val = opt.dataset.value ?? "";
    hidden.value = val;
    triggerText.textContent = opt.textContent.trim();
    menu.querySelectorAll(".books-filter-option").forEach((o) => {
      const selected = o === opt;
      o.classList.toggle("is-selected", selected);
      o.setAttribute("aria-selected", selected ? "true" : "false");
    });
    closeBooksFilterMenus();
    const filterName = picker.dataset.filterName;
    if (filterName === "theme") {
      form?.requestSubmit();
    } else if (handlers && typeof handlers[filterName] === "function") {
      handlers[filterName](val);
    }
  }

  function bindOptionPickers(root, handlers) {
    if (!root) return;
    const backdrop = getBooksOptionBackdrop();
    const form = pageRoot?.querySelector("#books-filters");

    root.querySelectorAll(".books-filter-picker").forEach((picker) => {
      const trigger = picker.querySelector(".books-filter-trigger");
      const menu = picker.querySelector(".books-filter-menu");
      const hidden = picker.querySelector('input[type="hidden"]');
      const triggerText = picker.querySelector(".books-filter-trigger-text");
      if (!trigger || !menu || !hidden || !triggerText) return;

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        if (trigger.disabled || picker.classList.contains("is-disabled")) return;
        const willOpen = menu.hidden;
        closeBooksFilterMenus();
        if (willOpen) {
          picker.classList.add("is-open");
          menu.hidden = false;
          menu.removeAttribute("hidden");
          trigger.setAttribute("aria-expanded", "true");
          if (backdrop) backdrop.hidden = false;
          portalBooksFilterMenu(picker, menu, backdrop);
          setBooksFilterScrollLock(filterMenuMobile());
          window.requestAnimationFrame(() => positionFilterMenu(trigger, menu));
        }
      });

      menu.querySelectorAll(".books-filter-option").forEach((opt) => {
        const pickOption = (event) => {
          event.preventDefault();
          event.stopPropagation();
          applyFilterOptionSelection(picker, hidden, triggerText, menu, opt, handlers, form);
        };
        opt.addEventListener("pointerup", pickOption);
        opt.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      });
    });

    if (backdrop) {
      backdrop.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        closeBooksFilterMenus();
      });
    }

    if (!booksFilterPickerDocBound) {
      booksFilterPickerDocBound = true;
      document.addEventListener(
        "pointerdown",
        (event) => {
          if (isBooksFilterInteractionTarget(event.target)) return;
          closeBooksFilterMenus();
        },
        true
      );
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeBooksFilterMenus();
      });
      document.addEventListener(
        "scroll",
        (event) => {
          if (event.target instanceof Element && event.target.closest(".books-filter-menu")) return;
          closeBooksFilterMenus();
        },
        { passive: true, capture: true }
      );
      window.addEventListener("resize", () => {
        const openPicker = pageRoot?.querySelector(".books-filter-picker.is-open");
        if (!openPicker) return;
        const trigger = openPicker.querySelector(".books-filter-trigger");
        const menu = openPicker._portaledMenu || openPicker.querySelector(".books-filter-menu");
        if (trigger && menu && !menu.hidden) {
          resetFilterMenuPosition(menu);
          if (filterMenuMobile()) {
            portalBooksFilterMenu(openPicker, menu, getBooksOptionBackdrop());
          } else {
            restoreBooksFilterMenu(menu);
            restoreBooksFilterBackdrop(getBooksOptionBackdrop());
            clearBooksOptionLayer();
          }
          positionFilterMenu(trigger, menu);
        }
      });
    }
  }

  function renderFilters() {
    const themeOptions = [{ id: "", label: "전체 탐색" }, ...themeList().map((t) => ({ id: t.id, label: t.label }))];
    const themeLocked = !!state.theme;
    const themeBanner =
      state.theme && state.themeLabel
        ? `<p class="books-theme-banner">${escapeHtml(state.themeLabel)}${state.themeDescription ? ` — ${escapeHtml(state.themeDescription)}` : ""}</p>`
        : "";
    return `
      <form class="books-filters" id="books-filters">
        ${renderFilterPicker("theme", "테마", themeOptions, state.theme, false, "books-field-theme")}
        <label class="books-field books-field-search">
          <span class="books-label">검색</span>
          <input type="search" name="search" class="books-input" placeholder="${themeLocked ? "이 테마 안에서 검색" : "제목·작가·키워드"}" value="${escapeHtml(state.search)}" autocomplete="off">
        </label>
        ${renderFilterPicker("topic", "장르", TOPICS, state.topic, themeLocked)}
        ${renderFilterPicker("author_year", "시대", AUTHOR_YEARS, state.authorYear, themeLocked)}
        <button type="submit" class="books-btn books-btn-primary">검색</button>
      </form>
      ${themeBanner}
    `;
  }

  function renderEngineSelect() {
    const disabled = state.tts.playing || state.tts.testing;
    return `
      <div class="books-engine-row">
        ${renderFilterPicker("engine", "읽기 엔진", enginePickerOptions(), state.engine, disabled, "books-engine-field", "books-engine")}
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

  function formatPgItalicToHtml(text) {
    const src = String(text || "");
    const parts = [];
    const re = /__([^_\n]+?)__|_([^_\n]+?)_/g;
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) parts.push({ type: "text", value: src.slice(last, m.index) });
      parts.push({ type: "em", value: m[1] || m[2] });
      last = m.index + m[0].length;
    }
    if (last < src.length) parts.push({ type: "text", value: src.slice(last) });
    return parts
      .map((p) =>
        p.type === "em"
          ? `<em class="books-pg-em">${escapeHtml(p.value)}</em>`
          : escapeHtml(p.value)
      )
      .join("");
  }

  const READER_SENTENCE_BREAK_RE =
    /([.!?…]+(?:["'\u201D\u2019)\]]*))\s+(?=[A-Z0-9"\u201C\u2018([])/g;

  function formatReaderDisplayHtml(text) {
    const src = String(text || "");
    if (!state.readerSentenceBreaks) return formatPgItalicToHtml(src);
    const segments = [];
    let last = 0;
    let m;
    while ((m = READER_SENTENCE_BREAK_RE.exec(src)) !== null) {
      segments.push(src.slice(last, m.index + m[1].length));
      last = m.index + m[0].length;
    }
    segments.push(src.slice(last));
    return segments
      .map((segment) => formatPgItalicToHtml(segment))
      .join('<br class="books-reader-sent-break" aria-hidden="true">');
  }

  function buildChunkPositions(prepared, chunks) {
    let searchFrom = 0;
    return chunks.map((chunk) => {
      if (!chunk) return { start: -1, end: -1 };
      let pos = prepared.indexOf(chunk, searchFrom);
      if (pos === -1) {
        pos = prepared.indexOf(chunk);
        if (pos === -1) return { start: -1, end: -1 };
      }
      searchFrom = pos + chunk.length;
      return { start: pos, end: pos + chunk.length };
    });
  }

  function chunkDisplaySeparator(prepared, positions, index) {
    if (!state.readerParagraphBreaks) return " ";
    const a = positions[index];
    const b = positions[index + 1];
    if (!a || !b || a.end < 0 || b.start < 0) return " ";
    const between = prepared.slice(a.end, b.start);
    if (/\n\s*\n/.test(between)) {
      return '<span class="books-reader-para-gap" aria-hidden="true"></span>';
    }
    return " ";
  }

  function toggleReaderParagraphBreaks() {
    state.readerParagraphBreaks = !state.readerParagraphBreaks;
    localStorage.setItem(READER_PARA_STORAGE_KEY, state.readerParagraphBreaks ? "1" : "");
    updateReaderFormatButtonsUI();
    updateReaderContentOnly();
  }

  function toggleReaderSentenceBreaks() {
    state.readerSentenceBreaks = !state.readerSentenceBreaks;
    localStorage.setItem(READER_SENT_STORAGE_KEY, state.readerSentenceBreaks ? "1" : "");
    updateReaderFormatButtonsUI();
    updateReaderContentOnly();
  }

  function updateReaderFormatButtonsUI() {
    if (!pageRoot) return;
    const paraBtn = pageRoot.querySelector("#books-reader-para-btn");
    if (paraBtn) {
      paraBtn.classList.toggle("is-active", state.readerParagraphBreaks);
      paraBtn.setAttribute("aria-pressed", state.readerParagraphBreaks ? "true" : "false");
    }
    const sentBtn = pageRoot.querySelector("#books-reader-sent-btn");
    if (sentBtn) {
      sentBtn.classList.toggle("is-active", state.readerSentenceBreaks);
      sentBtn.setAttribute("aria-pressed", state.readerSentenceBreaks ? "true" : "false");
    }
  }

  function renderReaderToolbar() {
    if (!state.bookText || state.textLoading) return "";
    const followHidden = !(state.tts.playing && !readerAutoFollow);
    return `
      ${renderTranslateActions()}
      <div class="books-reader-toolbar">
        ${renderFilterPicker("reader_theme", "읽기 테마", readerThemePickerOptions(), state.readerTheme, false, "books-reader-theme-field", "books-reader-theme")}
        <div class="books-reader-toolbar-actions">
          <div class="books-reader-format-toggles" aria-label="본문 표시">
            <button type="button" class="books-btn books-btn-toggle${state.readerParagraphBreaks ? " is-active" : ""}" id="books-reader-para-btn" aria-pressed="${state.readerParagraphBreaks ? "true" : "false"}" title="문단 구분 표시">문단</button>
            <button type="button" class="books-btn books-btn-toggle${state.readerSentenceBreaks ? " is-active" : ""}" id="books-reader-sent-btn" aria-pressed="${state.readerSentenceBreaks ? "true" : "false"}" title="문장 줄바꿈 표시">문장</button>
          </div>
          <button type="button" class="books-btn books-btn-follow" id="books-reader-follow"${followHidden ? " hidden" : ""} title="현재 위치로">📍 따라가기</button>
          <button type="button" class="books-btn" id="books-reader-fullscreen" title="전체 화면">⛶</button>
          <div class="books-font-controls" aria-label="글자 크기">
            <button type="button" class="books-font-btn" id="books-font-down" aria-label="글자 작게"${state.readerFontSize <= READER_FONT_MIN ? " disabled" : ""}>−</button>
            <span class="books-font-size-label" id="books-font-size-label">${readerFontSizeLabel()}</span>
            <button type="button" class="books-font-btn" id="books-font-up" aria-label="글자 크게"${state.readerFontSize >= READER_FONT_MAX ? " disabled" : ""}>+</button>
          </div>
        </div>
      </div>
      <nav class="books-page-nav" aria-label="원문 페이지">
        <button type="button" class="books-btn books-reader-page-btn" id="books-reader-page-prev" disabled>◀ 이전</button>
        <span class="books-reader-page-label" id="books-reader-page-label">1 / 1</span>
        <button type="button" class="books-btn books-reader-page-btn" id="books-reader-page-next" disabled>다음 ▶</button>
      </nav>
    `;
  }

  function renderBookmarksSection() {
    const bookmarks = loadBookmarks();
    const canSave =
      state.view === "reader" && !!state.bookText && !state.textLoading && state.ttsChunks.length && isBookTextComplete();
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
      <section class="books-bookmarks${state.bookmarksExpanded ? "" : " is-collapsed"}" id="books-bookmarks-panel" aria-label="책갈피">
        <div class="books-bookmarks-head">
          <div class="books-bookmarks-head-left">
            <span class="books-label">책갈피</span>
            <span class="books-bookmarks-count" id="books-bookmarks-count">${bookmarks.length ? `(${bookmarks.length})` : ""}</span>
            <button type="button" class="books-btn books-btn-ghost" id="books-bookmarks-toggle" aria-expanded="${state.bookmarksExpanded ? "true" : "false"}">${state.bookmarksExpanded ? "접기 ▴" : "펼치기 ▾"}</button>
          </div>
          <button type="button" class="books-btn books-btn-bookmark" id="books-save-bookmark"${canSave ? "" : " disabled"} title="현재 위치 저장">🔖 저장</button>
        </div>
        <div class="books-bookmarks-body">
          <p class="books-bookmark-notice${state.bookmarkNotice ? "" : " is-empty"}" id="books-bookmark-notice">${escapeHtml(state.bookmarkNotice)}</p>
          ${
            bookmarks.length
              ? `<ul class="books-bookmark-list">${items}</ul>`
              : `<p class="books-bookmark-empty">저장된 책갈피가 없습니다.</p>`
          }
        </div>
      </section>
    `;
  }

  function renderReaderTextHtml() {
    if (!state.bookText) return "";
    const prepared =
      state.preparedTextSnapshot || prepareBookText(state.bookText);
    const chunks = state.ttsChunks.length
      ? state.ttsChunks
      : splitIntoChunks(prepared);
    const positions = buildChunkPositions(prepared, chunks);
    const parts = [];

    chunks.forEach((chunk, i) => {
      const showKo = shouldShowKoreanText();
      const translated = showKo ? koreanChunkText(i) : null;
      const content = showKo && translated ? translated : chunk;
      const pending = showKo && !translated ? " books-chunk-pending" : "";
      const active =
        state.tts.playing && i === state.tts.chunkIndex ? " books-chunk-active" : "";
      const marked =
        !state.tts.playing && i === state.startChunkIndex ? " books-chunk-marked" : "";
      parts.push(
        `<span class="books-chunk${pending}${active}${marked}" data-chunk="${i}">${formatReaderDisplayHtml(content)}</span>`
      );
      if (i < chunks.length - 1) {
        parts.push(chunkDisplaySeparator(prepared, positions, i));
      }
    });

    return parts.join("");
  }

  function renderPlayer() {
    const canPlay =
      !!state.bookText && isBookTextComplete() && !state.textLoading && engineConfigured(state.engine);

    return `
      <section class="books-player books-player-compact" id="books-player" aria-label="듣기 컨트롤">
        <div class="books-player-row">
          <div class="books-player-transport">
            <button type="button" class="books-btn books-btn-primary books-btn-icon" id="books-tts-play"${canPlay ? "" : " disabled"} aria-label="듣기">▶</button>
            <button type="button" class="books-btn books-btn-icon" id="books-tts-pause"${state.tts.playing ? "" : " disabled"} aria-label="${state.tts.paused ? "계속" : "일시정지"}">${state.tts.paused ? "▶" : "⏸"}</button>
            <button type="button" class="books-btn books-btn-icon" id="books-tts-stop"${state.tts.playing || state.tts.paused ? "" : " disabled"} aria-label="정지">⏹</button>
          </div>
          ${renderFilterPicker("voice", "목소리", voicePickerOptions(), state.voice, state.tts.playing, "books-player-field books-player-field-voice", "books-voice")}
          ${renderFilterPicker("rate", "속도", ratePickerOptions(), state.rate, state.tts.testing, "books-player-field books-player-field-rate", "books-rate")}
        </div>
        ${renderChunkNav()}
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
      <div class="books-chunk-nav books-chunk-nav-compact" id="books-chunk-nav">
        <span class="books-chunk-slider-val" id="books-chunk-slider-val">${current}/${total}</span>
        <input type="range" class="books-chunk-slider" id="books-chunk-slider" min="1" max="${total}" value="${current}" step="1"${disabled} aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${current}" aria-label="시작 구간">
      </div>
    `;
  }

  function renderList() {
    if (state.loading) {
      return `<p class="books-status books-status-info books-status-loading" role="status" aria-live="polite">목록을 불러오는 중</p>`;
    }
    if (state.error) {
      return `<p class="books-status books-status-error" role="alert">${escapeHtml(state.error)}</p>`;
    }

    const pageSize = listPageSize();
    const filteredCount = state.theme
      ? filterThemeBooks(state.themeBooksAll, state.search).length
      : state.count || 0;
    const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
    const expanding = state.theme && state.themeFetchPhase === "expanding";
    const searchingMore = expanding && !state.books.length;

    if (!state.books.length && !searchingMore) {
      return `<p class="books-status books-status-info">조건에 맞는 공개 도메인 영문 도서가 없습니다.</p>`;
    }

    const cards = state.books
      .map((book) => {
        const display = bookListDisplay(book);
        const genre = genreDisplay(book);
        const pendingClass = display.pending ? " books-card-pending" : "";
        const listMeta = renderBookListMeta(book);
        const htmlBtn = hasHtmlPreview(book)
          ? `<button type="button" class="books-btn books-btn-icon books-btn-html" data-html-book-id="${book.id}" aria-label="HTML 원본 보기" title="HTML 원본 보기">⛶</button>`
          : "";
        return `
          <article class="books-card${pendingClass}" data-list-book-id="${book.id}">
            ${renderBookCover(book, display.title)}
            <div class="books-card-body">
              <h3 class="books-card-heading">
                <span class="books-card-title">${escapeHtml(display.title)}</span>
                <span class="books-card-sep" aria-hidden="true">·</span>
                <span class="books-card-author">${escapeHtml(display.authors)}</span>
              </h3>
              ${listMeta ? `<p class="books-card-meta-line">${listMeta}</p>` : ""}
              <p class="books-card-genre-line">
                <span class="books-card-genre">${escapeHtml(genre)}</span>
                <span class="books-card-pd">PD</span>
              </p>
            </div>
            <div class="books-card-actions">
              ${htmlBtn}
              <button type="button" class="books-btn books-btn-read" data-book-id="${book.id}">읽기</button>
            </div>
          </article>
        `;
      })
      .join("");

    const prevDisabled = state.page <= 1 ? " disabled" : "";
    const nextDisabled =
      state.page >= totalPages && (!expanding || filteredCount <= state.page * pageSize) ? " disabled" : "";
    const expandNote = expanding ? " · 더 검색 중…" : "";
    const listTitle = state.themeLabel
      ? `${state.themeLabel} · ${formatCount(filteredCount)}권${expandNote} · ${state.page} / ${totalPages} 페이지`
      : `총 ${formatCount(state.count)}권 · ${state.page} / ${totalPages} 페이지`;

    return `
      ${renderListTranslateBar()}
      <div class="books-list-meta">
        <span>${listTitle}</span>
      </div>
      ${searchingMore ? `<p class="books-status books-status-info books-status-loading" role="status" aria-live="polite">목록을 찾는 중</p>` : `<div class="books-list">${cards}</div>`}
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
      body = `<p class="books-status books-status-info books-status-loading" role="status" aria-live="polite">본문을 불러오는 중 (긴 책은 시간이 걸릴 수 있습니다)</p>`;
    } else if (state.textError) {
      body = `<p class="books-status books-status-error" role="alert">${escapeHtml(state.textError)}</p>`;
    } else {
      body = `
        ${renderPlayer()}
        ${renderTextLoadBanner()}
        <div class="books-reader-block">
          ${renderReaderToolbar()}
          <div class="books-reader-text books-reader-theme-${state.readerTheme}" id="books-reader-text" style="font-size:${state.readerFontSize}rem">${renderReaderTextHtml()}</div>
        </div>
      `;
    }

    const canDownload = state.bookText && isBookTextComplete();
    const canBookmark = state.bookText && state.ttsChunks.length && isBookTextComplete();

    return `
      <header class="books-reader-head">
        <button type="button" class="books-btn" id="books-back-btn">← 목록</button>
        <div class="books-reader-titles">
          <h3 class="books-reader-title">${escapeHtml(meta.title || "")}</h3>
          <p class="books-reader-author">${escapeHtml(meta.authors || "")}</p>
        </div>
        <div class="books-reader-actions">
          <button type="button" class="books-btn books-btn-bookmark" id="books-save-bookmark-inline"${canBookmark ? "" : " disabled"} title="현재 위치 저장">🔖</button>
          <button type="button" class="books-btn books-btn-primary" id="books-download-btn"${canDownload ? "" : " disabled"}>TXT 저장</button>
        </div>
      </header>
      ${renderEngineSelect()}
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
      playBtn.disabled =
        !state.bookText || !isBookTextComplete() || state.textLoading || !engineConfigured(state.engine);
    }
    if (pauseBtn) {
      pauseBtn.disabled = !state.tts.playing;
      pauseBtn.textContent = state.tts.paused ? "▶" : "⏸";
      pauseBtn.setAttribute("aria-label", state.tts.paused ? "계속" : "일시정지");
    }
    if (stopBtn) {
      stopBtn.disabled = !state.tts.playing && !state.tts.paused;
    }
    setPickerDisabled("books-voice", state.tts.playing || state.tts.testing);
    setPickerDisabled("books-rate", state.tts.testing);
    setPickerDisabled("books-engine", state.tts.playing || state.tts.testing);
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
      valEl.textContent = `${current}/${total}`;
    }
    updateChunkMarker();
  }

  function updateReaderHighlight() {
    if (!pageRoot) return;
    updateChunkMarker();
    if (state.tts.playing && readerAutoFollow) {
      scrollActiveChunkToView(state.tts.chunkIndex, "smooth", false);
    }
    updateFollowButtonUI();
  }

  function updateReaderContentOnly() {
    if (!pageRoot) return;
    const el = pageRoot.querySelector("#books-reader-text");
    if (el) el.innerHTML = renderReaderTextHtml();
    if (state.readerFullscreen) syncFullscreenReaderContent();
    updateReaderHighlight();
    window.requestAnimationFrame(() => updateReaderPageUI());
  }

  function render() {
    if (!pageRoot) return;

    const listView = state.view === "list";
    pageRoot.innerHTML = `
      <article class="content-panel books-panel">
        <header class="books-header">
          <h2>Books</h2>
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
        <button type="button" class="books-filter-backdrop" id="books-option-backdrop" hidden aria-hidden="true" tabindex="-1"></button>
      </article>
    `;

    bindEvents();
    updateTranslationUI();
    applyReaderFontSize();
    applyReaderTheme();
    bindReaderScrollListener();
    updateBookmarksPanelUI();
    if (state.readerFullscreen) syncFullscreenReaderContent();
    updateFollowButtonUI();
    window.requestAnimationFrame(() => updateReaderPageUI());
  }

  function bindEvents() {
    if (!pageRoot) return;

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

    bindOptionPickers(pageRoot, {
      engine: (val) => setEngine(val),
      voice: (val) => {
        state.voice = val;
      },
      rate: (val) => {
        state.rate = val;
        if (state.tts.playing || state.tts.paused) applyLiveTtsRate();
      },
      reader_theme: (val) => setReaderTheme(val)
    });

    pageRoot.querySelectorAll("[data-book-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.bookId);
        const book = findListBook(id);
        if (book) openReader(book);
      });
    });

    pageRoot.querySelectorAll("[data-html-book-id]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = Number(btn.dataset.htmlBookId);
        const book = findListBook(id);
        if (book) openHtmlPreview(book);
      });
    });

    pageRoot.querySelectorAll("[data-page-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        navigateListPage(btn.dataset.pageNav);
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

    const listLangBtn = pageRoot.querySelector("#books-list-lang-btn");
    if (listLangBtn) listLangBtn.addEventListener("click", toggleListTranslation);

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

    const testBtn = pageRoot.querySelector("#books-tts-test");
    if (testBtn) testBtn.addEventListener("click", () => void playTtsTest());

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

    const paraBtn = pageRoot.querySelector("#books-reader-para-btn");
    if (paraBtn) paraBtn.addEventListener("click", toggleReaderParagraphBreaks);

    const sentBtn = pageRoot.querySelector("#books-reader-sent-btn");
    if (sentBtn) sentBtn.addEventListener("click", toggleReaderSentenceBreaks);

    const readerPagePrev = pageRoot.querySelector("#books-reader-page-prev");
    if (readerPagePrev) {
      readerPagePrev.addEventListener("click", () => scrollReaderByPage(-1));
    }

    const readerPageNext = pageRoot.querySelector("#books-reader-page-next");
    if (readerPageNext) {
      readerPageNext.addEventListener("click", () => scrollReaderByPage(1));
    }

    const bookmarksToggle = pageRoot.querySelector("#books-bookmarks-toggle");
    if (bookmarksToggle) {
      bookmarksToggle.addEventListener("click", toggleBookmarksExpanded);
    }

    const fullscreenBtn = pageRoot.querySelector("#books-reader-fullscreen");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", openReaderFullscreen);
    }

    const followBtn = pageRoot.querySelector("#books-reader-follow");
    if (followBtn) {
      followBtn.addEventListener("click", enableReaderAutoFollow);
    }
  }

  function renderPage(container) {
    stopTts();
    pageRoot = container;
    state.view = "list";
    state.engine = webSpeechSupported() ? WEB_SPEECH_ENGINE_ID : "freetts";
    state.engines = [];
    state.voice = defaultVoiceForMode("en", state.engine);
    state.readerFontSize = loadReaderFontSize();
    state.readerTheme = loadReaderTheme();
    state.readerParagraphBreaks = loadReaderParagraphBreaks();
    state.readerSentenceBreaks = loadReaderSentenceBreaks();
    state.bookmarkNotice = "";
    state.page = 1;
    state.search = "";
    state.topic = "";
    state.theme = "";
    state.themes = [];
    state.themeLabel = "";
    state.themeDescription = "";
    state.themeBooksAll = [];
    state.themeFetchPhase = "idle";
    state.authorYear = "";
    state.bookId = null;
    state.bookMeta = null;
    state.bookText = "";
    state.error = "";
    state.textError = "";
    state.textLoadPhase = "idle";
    state.ttsChunks = [];
    state.startChunkIndex = 0;
    state.translatedChunks = new Map();
    state.translatedBatches = new Map();
    state.translateChunks = [];
    state.ttsTranslateMap = [];
    state.batchOffsets = [];
    state.preparedTextSnapshot = "";
    state.listTranslated = new Map();
    state.showKoreanText = false;
    state.translation = { running: false, current: 0, total: 0, error: "", scope: "" };
    void fetchThemes().then(() => fetchSpeechStatus().then(() => render()));
    void fetchBooks();
    ensureReaderResizeListener();
  }

  function destroy() {
    stopTts();
    stopTranslation();
    closeReaderFullscreen();
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
