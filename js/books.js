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

  let pageRoot = null;
  let listAbort = null;
  let textAbort = null;

  const state = {
    view: "list",
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
    textError: ""
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

  function subjectPreview(book) {
    const items = [...(book.subjects || []), ...(book.bookshelves || [])].filter(Boolean);
    if (!items.length) return "";
    const text = items.slice(0, 2).join(" · ");
    return text.length > 72 ? `${text.slice(0, 69)}…` : text;
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
    } catch (err) {
      if (err.name === "AbortError") return;
      state.textError = err.message || "본문을 불러오지 못했습니다.";
    } finally {
      state.textLoading = false;
      render();
    }
  }

  function openReader(book) {
    state.view = "reader";
    state.bookId = book.id;
    state.bookMeta = {
      id: book.id,
      title: book.title,
      authors: book.authors
    };
    state.bookText = "";
    state.textError = "";
    render();
    void fetchBookText(book.id);
  }

  function backToList() {
    state.view = "list";
    state.bookId = null;
    state.bookMeta = null;
    state.bookText = "";
    state.textError = "";
    if (textAbort) textAbort.abort();
    render();
  }

  function downloadCurrentText() {
    if (!state.bookText || !state.bookMeta) return;
    const blob = new Blob([state.bookText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sanitizeFilename(state.bookMeta.title)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
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
      body = `<pre class="books-reader-text" id="books-reader-text">${escapeHtml(state.bookText)}</pre>`;
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

  function render() {
    if (!pageRoot) return;

    const listView = state.view === "list";
    pageRoot.innerHTML = `
      <article class="content-panel books-panel">
        <header class="books-header">
          <h2>Books · 영문 읽기</h2>
          <p class="books-intro">
            Project Gutenberg 공개 도메인(미국 PD, 상업적 이용 가능) 영문 고전만 표시합니다.
            번역 읽기는 별도 메뉴로 준비 중입니다.
          </p>
        </header>
        ${listView ? renderFilters() : ""}
        <div class="books-body">
          ${listView ? renderList() : renderReader()}
        </div>
        <p class="books-footnote">
          데이터: <a href="https://www.gutenberg.org/" target="_blank" rel="noopener noreferrer">Project Gutenberg</a>
          · 카탈로그: Gutendex · 본문은 Render API 프록시를 통해 제공됩니다.
        </p>
      </article>
    `;

    bindEvents();
  }

  function bindEvents() {
    if (!pageRoot) return;

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
  }

  function renderPage(container) {
    pageRoot = container;
    state.view = "list";
    state.page = 1;
    state.search = "";
    state.topic = "";
    state.authorYear = "";
    state.bookId = null;
    state.bookMeta = null;
    state.bookText = "";
    state.error = "";
    state.textError = "";
    render();
    void fetchBooks();
  }

  function destroy() {
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
