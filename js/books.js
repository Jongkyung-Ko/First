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

  const FALLBACK_THEMES = [
    { id: "shakespeare", label: "셰익스피어 명작", description: "햄릿, 로미오와 줄리엣, 맥베스 등" },
    { id: "classic_novels", label: "영미 고전 소설", description: "오만과 편견, 제인 에어 등" },
    { id: "romance", label: "로맨스 명작", description: "사랑과 운명을 다룬 고전" },
    { id: "mystery", label: "미스터리·추리", description: "셜록 홈즈, 드라큘라 등" },
    { id: "scifi_fantasy", label: "SF·판타지", description: "프랑켄슈타인, 앨리스 등" },
    { id: "children", label: "어린이·동화 고전", description: "동화와 모험 이야기" },
    { id: "philosophy", label: "철학·고전 사상", description: "플라톤, 마르쿠스 아우렐리우스 등" },
    { id: "american_classics", label: "미국 문학 명작", description: "모비딕, 허클베리 핀 등" }
  ];

  const EN_VOICES_FREETTS = ["en-US-JennyNeural", "en-US-GuyNeural", "en-US-AriaNeural"];
  const KO_VOICES_FREETTS = ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"];
  const EN_VOICES_GOOGLE = ["en-US-Neural2-A", "en-US-Neural2-C", "en-US-Neural2-D", "en-US-Neural2-F"];
  const KO_VOICES_GOOGLE = ["ko-KR-Neural2-A", "ko-KR-Neural2-B", "ko-KR-Neural2-C"];

  const TTS_TEST_SAMPLE_EN = "Hello. This is a Books reading test.";
  const WEB_SPEECH_ENGINE_ID = "webspeech";
  const WEBSPEECH_CHUNK_MAX = 4000;

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
      chunk_max: 4500,
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
  let webSpeechVoicesCache = [];

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
    engine: "freetts",
    engines: [],
    speechMonth: "",
    voice: "en-US-JennyNeural",
    rate: "1.0",
    ttsChunks: [],
    translatedChunks: new Map(),
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
      note: "이 기기 브라우저 내장 음성. 서버 한도·API 키 없이 사용합니다."
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
      return;
    }
    state.ttsChunks = splitIntoChunks(prepareBookText(state.bookText), chunkMaxForEngine());
  }

  function subjectPreview(book) {
    const items = [...(book.subjects || []), ...(book.bookshelves || [])].filter(Boolean);
    if (!items.length) return "";
    const text = items.slice(0, 2).join(" · ");
    return text.length > 72 ? `${text.slice(0, 69)}…` : text;
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

  function themeList() {
    return state.themes.length ? state.themes : FALLBACK_THEMES;
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
      if (res.ok && Array.isArray(data.themes)) {
        state.themes = data.themes;
      } else {
        state.themes = FALLBACK_THEMES;
      }
    } catch (_) {
      state.themes = FALLBACK_THEMES;
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
          state.engines.find((e) => e.id === "google" && e.configured)?.id ||
          data.default_engine ||
          state.engines.find((e) => e.id === WEB_SPEECH_ENGINE_ID && e.configured)?.id ||
          state.engines.find((e) => e.configured)?.id ||
          "freetts";
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
      const res = await fetch(buildBooksUrl(), { signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `목록을 불러오지 못했습니다 (${res.status})`);
      }
      state.books = data.results || [];
      state.count = data.count ?? state.books.length;
      if (data.theme) {
        state.themeLabel = data.theme_label || "";
        state.themeDescription = data.theme_description || "";
      } else {
        state.themeLabel = "";
        state.themeDescription = "";
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      state.books = [];
      state.error = err.message || "목록을 불러오지 못했습니다.";
    } finally {
      state.loading = false;
      render();
    }
  }

  async function fetchBookText(bookId) {
    if (textAbort) textAbort.abort();
    textAbort = new AbortController();
    const signal = textAbort.signal;

    state.textLoading = true;
    state.textError = "";
    state.bookText = "";
    state.ttsChunks = [];
    state.translatedChunks = new Map();
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
    } catch (err) {
      if (err.name === "AbortError") return;
      state.textError = err.message || "본문을 불러오지 못했습니다.";
    } finally {
      state.textLoading = false;
      render();
    }
  }

  async function translateChunk(text) {
    if (ttsAbort) ttsAbort.abort();
    ttsAbort = new AbortController();
    const res = await fetch(`${apiBase()}/api/books/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target: "ko" }),
      signal: ttsAbort.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `번역 실패 (${res.status})`);
    }
    return data.text || text;
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
        eng?.rate_limited
          ? "시간 한도 도달 — Cloud TTS Neural2 권장"
          : "선택한 엔진을 사용할 수 없습니다."
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

      const blob = await fetchTtsAudio(text);
      if (sessionId !== ttsSessionId) return;

      const url = URL.createObjectURL(blob);
      currentAudio = new Audio(url);
      currentAudio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        void playFromChunk(index + 1, sessionId);
      };
      currentAudio.onerror = () => {
        URL.revokeObjectURL(url);
        stopTts();
        setTtsStatus("오디오 재생 오류");
      };

      setTtsStatus(`재생 중 (${index + 1}/${state.ttsChunks.length})`);
      await currentAudio.play();
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
    void playFromChunk(0, sessionId);
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

  function openReader(book) {
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
    state.ttsChunks = [];
    render();
    void fetchBookText(book.id);
  }

  function backToList() {
    stopTts();
    state.view = "list";
    state.bookId = null;
    state.bookMeta = null;
    state.bookText = "";
    state.textError = "";
    state.ttsChunks = [];
    state.translatedChunks = new Map();
    if (textAbort) textAbort.abort();
    render();
  }

  function setEngine(engineId) {
    if (state.engine === engineId) return;
    stopTts();
    state.engine = engineId;
    state.voice = defaultVoiceForMode(state.readMode, engineId);
    state.translatedChunks = new Map();
    refreshChunks();
    render();
  }

  function setReadMode(mode) {
    if (state.readMode === mode) return;
    stopTts();
    state.readMode = mode;
    state.voice = defaultVoiceForMode(mode, state.engine);
    state.translatedChunks = new Map();
    render();
  }

  function downloadCurrentText() {
    if (!state.bookText || !state.bookMeta) return;
    const text =
      state.readMode === "ko" && state.translatedChunks.size
        ? state.ttsChunks
            .map((chunk, i) => state.translatedChunks.get(i) || chunk)
            .join("\n\n")
        : prepareBookText(state.bookText);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const suffix = state.readMode === "ko" ? "_ko" : "";
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
    const freetts = engineList().find((e) => e.id === "freetts");
    const webspeech = engineList().find((e) => e.id === WEB_SPEECH_ENGINE_ID);
    const freettsNote = freetts?.note
      ? `<p class="books-engine-note">${escapeHtml(freetts.note)}</p>`
      : "";
    const webspeechNote =
      webspeech?.note && state.engine === WEB_SPEECH_ENGINE_ID
        ? `<p class="books-engine-note">${escapeHtml(webspeech.note)}</p>`
        : "";
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
      ${freettsNote}
      ${webspeechNote}
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

  function renderReaderTextHtml() {
    if (!state.bookText) return "";
    const chunks = state.ttsChunks.length
      ? state.ttsChunks
      : splitIntoChunks(prepareBookText(state.bookText));

    return chunks
      .map((chunk, i) => {
        const translated = state.translatedChunks.get(i);
        const content =
          state.readMode === "ko" && translated !== undefined ? translated : chunk;
        const pending = state.readMode === "ko" && translated === undefined ? " books-chunk-pending" : "";
        const active =
          state.tts.playing && i === state.tts.chunkIndex ? " books-chunk-active" : "";
        return `<span class="books-chunk${pending}${active}" data-chunk="${i}">${escapeHtml(content)}</span>`;
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
    const eng = currentEngineMeta();
    let engineHint = "";
    if (eng?.id === WEB_SPEECH_ENGINE_ID) {
      engineHint = `브라우저 내장 TTS · 구간 최대 ${formatK(eng.chunk_max)}자 · 서버 한도 없음`;
    } else if (eng?.id === "freetts" && eng?.rate_limited) {
      engineHint = "FreeTTS 시간당 한도 도달 — 1시간 후 재시도 또는 Cloud TTS Neural2 사용";
    } else if (eng?.configured) {
      engineHint = `${eng.label} · 구간 최대 ${formatK(eng.chunk_max)}자`;
      if (eng.id === "freetts" && eng.hourly_limit > 0) {
        engineHint += ` · 시간 ${formatK(eng.hourly_used || 0)}/${formatK(eng.hourly_limit)}`;
      }
    } else {
      engineHint = `${eng?.label || state.engine} 사용 불가 — Google Neural2 설정 또는 FreeTTS 한도 대기`;
    }

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
              <option value="0.85"${state.rate === "0.85" ? " selected" : ""}>0.85×</option>
              <option value="1.0"${state.rate === "1.0" ? " selected" : ""}>1.0×</option>
              <option value="1.15"${state.rate === "1.15" ? " selected" : ""}>1.15×</option>
            </select>
          </label>
        </div>
        <p class="books-player-usage" id="books-tts-usage">${escapeHtml(engineHint)}</p>
        <p class="books-player-status${state.tts.status ? "" : " is-empty"}" id="books-tts-status">${escapeHtml(state.tts.status)}</p>
      </section>
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
        const preview = subjectPreview(book);
        return `
          <article class="books-card">
            <div class="books-card-body">
              <h3 class="books-card-title">${escapeHtml(book.title)}</h3>
              <p class="books-card-meta">${escapeHtml(book.authors || "Unknown author")}</p>
              ${preview ? `<p class="books-card-subjects">${escapeHtml(preview)}</p>` : ""}
              <p class="books-card-stats">다운로드 ${formatCount(book.download_count)} · PD</p>
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
    const meta = state.bookMeta || {};
    let body = "";
    if (state.textLoading) {
      body = `<p class="books-status books-status-info">본문을 불러오는 중… (긴 책은 시간이 걸릴 수 있습니다)</p>`;
    } else if (state.textError) {
      body = `<p class="books-status books-status-error" role="alert">${escapeHtml(state.textError)}</p>`;
    } else {
      const modeHint =
        state.readMode === "ko"
          ? `<p class="books-reader-hint">번역 읽기: 듣기를 누르면 구간별로 한국어 번역 후 선택한 TTS 엔진으로 낭독합니다.</p>`
          : `<p class="books-reader-hint">영문 읽기: 원문을 선택한 TTS 엔진으로 낭독합니다.</p>`;
      body = `
        ${renderPlayer()}
        ${modeHint}
        <div class="books-reader-text" id="books-reader-text">${renderReaderTextHtml()}</div>
      `;
    }

    return `
      <header class="books-reader-head">
        <button type="button" class="books-btn" id="books-back-btn">← 목록</button>
        <div class="books-reader-titles">
          <h3 class="books-reader-title">${escapeHtml(meta.title || "")}</h3>
          <p class="books-reader-author">${escapeHtml(meta.authors || "")}</p>
        </div>
        <button type="button" class="books-btn books-btn-primary" id="books-download-btn"${state.bookText ? "" : " disabled"}>TXT 저장</button>
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
      const eng = currentEngineMeta();
      if (eng?.id === WEB_SPEECH_ENGINE_ID) {
        usageEl.textContent = `브라우저 내장 TTS · 구간 최대 ${formatK(eng.chunk_max)}자 · 서버 한도 없음`;
      } else if (eng?.id === "freetts" && eng?.rate_limited) {
        usageEl.textContent = "FreeTTS 시간당 한도 도달 — Cloud TTS Neural2 권장";
      } else if (eng?.configured) {
        let text = `${eng.label} · 구간 최대 ${formatK(eng.chunk_max)}자`;
        if (eng.id === "freetts" && eng.hourly_limit > 0) {
          text += ` · 시간 ${formatK(eng.hourly_used || 0)}/${formatK(eng.hourly_limit)}`;
        }
        usageEl.textContent = text;
      } else {
        usageEl.textContent = `${eng?.label || state.engine} 사용 불가`;
      }
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
  }

  function updateReaderHighlight() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll(".books-chunk").forEach((el) => {
      const idx = Number(el.dataset.chunk);
      el.classList.toggle("books-chunk-active", state.tts.playing && idx === state.tts.chunkIndex);
    });
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

  function introText() {
    if (state.readMode === "ko") {
      return "영문 고전을 한국어로 번역·낭독합니다. 서버 한도 없이 쓰려면 브라우저 TTS(Web Speech)를 선택하세요. 긴 책·고품질 음성은 Cloud TTS Neural2를 권장합니다.";
    }
    return "Project Gutenberg PD 영문 고전. 테마별 명작 모음·장르 검색. FreeTTS·Cloud TTS·브라우저 TTS로 듣기.";
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
          <p class="books-intro">${escapeHtml(introText())}</p>
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
  }

  function renderPage(container) {
    stopTts();
    pageRoot = container;
    state.view = "list";
    state.readMode = "en";
    state.engine = "freetts";
    state.engines = [];
    state.voice = defaultVoiceForMode("en", "freetts");
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
    state.translatedChunks = new Map();
    void fetchThemes().then(() => fetchSpeechStatus().then(() => render()));
    void fetchBooks();
  }

  function destroy() {
    stopTts();
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
