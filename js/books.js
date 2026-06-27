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

  const EN_VOICES_AZURE = ["en-US-JennyNeural", "en-US-GuyNeural", "en-US-AriaNeural"];
  const KO_VOICES_AZURE = ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"];
  const EN_VOICES_GOOGLE = ["en-US-Neural2-A", "en-US-Neural2-C", "en-US-Neural2-D", "en-US-Neural2-F"];
  const KO_VOICES_GOOGLE = ["ko-KR-Neural2-A", "ko-KR-Neural2-B", "ko-KR-Neural2-C"];

  const FALLBACK_ENGINES = [
    { id: "azure", label: "Azure Speech", configured: false, monthly_limit: 500000, chars_used: 0, chunk_max: 4000, voices: [] },
    { id: "freetts", label: "FreeTTS", configured: true, monthly_limit: 5000, chars_used: 0, chunk_max: 1000, voices: [] },
    { id: "google", label: "Cloud TTS Neural2", configured: false, monthly_limit: 1000000, chars_used: 0, chunk_max: 4500, voices: [] }
  ];

  let pageRoot = null;
  let listAbort = null;
  let textAbort = null;
  let ttsAbort = null;
  let currentAudio = null;
  let ttsSessionId = 0;

  const state = {
    view: "list",
    readMode: "en",
    search: "",
    topic: "",
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
    engine: "azure",
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
      status: ""
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

  function engineList() {
    return state.engines.length ? state.engines : FALLBACK_ENGINES;
  }

  function currentEngineMeta() {
    return engineList().find((e) => e.id === state.engine) || engineList()[0];
  }

  function chunkMaxForEngine() {
    return currentEngineMeta()?.chunk_max || 3200;
  }

  function engineConfigured(engineId) {
    const meta = engineList().find((e) => e.id === engineId);
    return meta ? !!meta.configured : false;
  }

  function defaultVoiceForMode(mode, engine) {
    const eng = engine || state.engine;
    if (eng === "google") {
      return mode === "ko" ? "ko-KR-Neural2-A" : "en-US-Neural2-A";
    }
    return mode === "ko" ? "ko-KR-SunHiNeural" : "en-US-JennyNeural";
  }

  function voicesForMode(mode) {
    const meta = currentEngineMeta();
    const catalog = meta?.voices || [];
    let allowed;
    if (state.engine === "google") {
      allowed = mode === "ko" ? KO_VOICES_GOOGLE : EN_VOICES_GOOGLE;
    } else {
      allowed = mode === "ko" ? KO_VOICES_AZURE : EN_VOICES_AZURE;
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

  function buildBooksUrl() {
    const url = new URL(`${apiBase()}/api/gutenberg/books`);
    url.searchParams.set("languages", "en");
    url.searchParams.set("page", String(state.page));
    if (state.search.trim()) url.searchParams.set("search", state.search.trim());
    if (state.topic) url.searchParams.set("topic", state.topic);
    if (state.authorYear) url.searchParams.set("author_year", state.authorYear);
    return url.href;
  }

  async function fetchSpeechStatus() {
    try {
      const res = await fetch(`${apiBase()}/api/books/speech/status`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        state.engines = data.engines || [];
        state.speechMonth = data.month || "";
        const preferred =
          data.default_engine ||
          state.engines.find((e) => e.configured)?.id ||
          "freetts";
        if (!state.bookId) {
          state.engine = preferred;
          state.voice = defaultVoiceForMode(state.readMode, state.engine);
        }
      }
    } catch (_) {
      state.engines = FALLBACK_ENGINES;
    }
    updateUsageFooter();
  }

  function applyTtsUsageHeaders(res) {
    const engineId = res.headers.get("X-TTS-Engine") || state.engine;
    const monthlyUsed = res.headers.get("X-TTS-Monthly-Used");
    const monthlyLimit = res.headers.get("X-TTS-Monthly-Limit");
    const idx = state.engines.findIndex((e) => e.id === engineId);
    if (idx === -1) return;
    if (monthlyUsed != null) state.engines[idx].chars_used = Number(monthlyUsed);
    if (monthlyLimit != null) state.engines[idx].monthly_limit = Number(monthlyLimit);
    updateUsageFooter();
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
      throw new Error(data.detail || `음성 합성 실패 (${res.status})`);
    }
    applyTtsUsageHeaders(res);
    return res.blob();
  }

  function stopTts() {
    ttsSessionId += 1;
    state.tts.playing = false;
    state.tts.paused = false;
    state.tts.status = "";
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
    }
    if (ttsAbort) {
      ttsAbort.abort();
      ttsAbort = null;
    }
    updatePlayerUI();
    updateReaderHighlight();
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
      setTtsStatus(`${currentEngineMeta()?.label || state.engine} 엔진이 서버에 설정되지 않았습니다.`);
      updatePlayerUI();
      return;
    }
    stopTts();
    const sessionId = ttsSessionId;
    void playFromChunk(0, sessionId);
  }

  function pauseTts() {
    if (!currentAudio || !state.tts.playing) return;
    currentAudio.pause();
    state.tts.paused = true;
    setTtsStatus("일시정지");
    updatePlayerUI();
  }

  function resumeTts() {
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
    return `
      <form class="books-filters" id="books-filters">
        <label class="books-field books-field-search">
          <span class="books-label">검색</span>
          <input type="search" name="search" class="books-input" placeholder="제목·작가·키워드" value="${escapeHtml(state.search)}" autocomplete="off">
        </label>
        <label class="books-field">
          <span class="books-label">장르</span>
          <select name="topic" class="books-select">
            ${TOPICS.map(
              (t) =>
                `<option value="${escapeHtml(t.id)}"${t.id === state.topic ? " selected" : ""}>${escapeHtml(t.label)}</option>`
            ).join("")}
          </select>
        </label>
        <label class="books-field">
          <span class="books-label">시대</span>
          <select name="author_year" class="books-select">
            ${AUTHOR_YEARS.map(
              (y) =>
                `<option value="${escapeHtml(y.id)}"${y.id === state.authorYear ? " selected" : ""}>${escapeHtml(y.label)}</option>`
            ).join("")}
          </select>
        </label>
        <button type="submit" class="books-btn books-btn-primary">검색</button>
      </form>
    `;
  }

  function renderEngineSelect() {
    const options = engineList()
      .map((e) => {
        const suffix = e.configured ? "" : " (미설정)";
        return `<option value="${escapeHtml(e.id)}"${e.id === state.engine ? " selected" : ""}>${escapeHtml(e.label)}${suffix}</option>`;
      })
      .join("");
    return `
      <label class="books-engine-field">
        <span class="books-label">읽기 엔진</span>
        <select id="books-engine" class="books-select"${state.tts.playing ? " disabled" : ""}>${options}</select>
      </label>
    `;
  }

  function renderUsageFooterHtml() {
    const month = state.speechMonth || timeMonthLabel();
    const parts = engineList()
      .map((e) => `${e.label} ${formatK(e.chars_used)} / ${formatK(e.monthly_limit)}`)
      .join(" · ");
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
    const engineHint = eng?.configured
      ? `${eng.label} · 구간 최대 ${formatK(eng.chunk_max)}자`
      : `${eng?.label || state.engine} 미설정 — Render 환경 변수 확인`;

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

    return `
      <div class="books-list-meta">
        <span>총 ${formatCount(state.count)}권 · ${state.page} / ${totalPages} 페이지</span>
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
          ? `<p class="books-reader-hint">번역 읽기: 듣기를 누르면 구간별로 한국어 번역 후 Azure Neural TTS로 낭독합니다. 화면 번역도 재생에 맞춰 채워집니다.</p>`
          : `<p class="books-reader-hint">영문 읽기: 원문 그대로 Azure Neural TTS로 낭독합니다.</p>`;
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
      usageEl.textContent = eng?.configured
        ? `${eng.label} · 구간 최대 ${formatK(eng.chunk_max)}자`
        : `${eng?.label || state.engine} 미설정 — Render 환경 변수 확인`;
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
      return "영문 고전을 한국어로 번역·낭독합니다. 읽기 엔진: Azure Speech, FreeTTS(freetts.org), Google Cloud TTS Neural2.";
    }
    return "Project Gutenberg PD 영문 고전을 읽고 들을 수 있습니다. 읽기 엔진을 선택하세요.";
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
          · 엔진: <a href="https://azure.microsoft.com/products/ai-services/ai-speech" target="_blank" rel="noopener noreferrer">Azure Speech</a>,
          <a href="https://freetts.org/developers" target="_blank" rel="noopener noreferrer">FreeTTS</a>,
          <a href="https://cloud.google.com/text-to-speech" target="_blank" rel="noopener noreferrer">Cloud TTS Neural2</a>
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
        state.topic = String(fd.get("topic") || "");
        state.authorYear = String(fd.get("author_year") || "");
        state.page = 1;
        void fetchBooks();
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
    state.engine = "azure";
    state.engines = [];
    state.voice = defaultVoiceForMode("en", "azure");
    state.page = 1;
    state.search = "";
    state.topic = "";
    state.authorYear = "";
    state.bookId = null;
    state.bookMeta = null;
    state.bookText = "";
    state.error = "";
    state.textError = "";
    state.ttsChunks = [];
    state.translatedChunks = new Map();
    void fetchSpeechStatus().then(() => render());
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
})();
