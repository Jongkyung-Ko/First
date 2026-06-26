(function () {
  const MARKETS = [
    { id: "all", label: "전체" },
    { id: "kr", label: "국내" },
    { id: "us", label: "해외" }
  ];

  let activeMarket = "all";
  let abortController = null;
  let lastUpdatedAt = null;

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  function formatTime(unix) {
    if (!unix) return "";
    const d = new Date(unix * 1000);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return "방금";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatLastUpdated(date) {
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function marketBadge(market) {
    if (market === "kr") return '<span class="stock-badge stock-badge-kr">국내</span>';
    if (market === "us") return '<span class="stock-badge stock-badge-us">해외</span>';
    return "";
  }

  function setUpdating(root, updating) {
    const panel = root.classList?.contains("stock-panel") ? root : root.querySelector(".stock-panel");
    const overlay = root.querySelector("#stock-update-overlay");
    if (panel) panel.classList.toggle("stock-panel--updating", updating);
    if (overlay) overlay.hidden = !updating;
    root.querySelectorAll(".stock-tab, #stock-refresh-btn").forEach((btn) => {
      btn.disabled = updating;
    });
  }

  function setLastUpdated(root, date) {
    const el = root.querySelector("#stock-last-updated");
    if (!el || !date) return;
    lastUpdatedAt = date;
    el.textContent = `마지막 업데이트: ${formatLastUpdated(date)}`;
    el.hidden = false;
  }

  async function fetchHeadlines(market) {
    const base = getApiBase();
    if (!base) {
      throw new Error(
        "STOCK_API_URL이 설정되지 않았습니다. js/config.js에 Render 배포 URL을 넣거나 로컬 API(localhost:8000)를 사용하세요."
      );
    }

    if (abortController) abortController.abort();
    abortController = new AbortController();

    const url = `${base}/api/headlines?market=${encodeURIComponent(market)}&limit=40&lang=ko`;
    const res = await fetch(url, { signal: abortController.signal });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch (_) {
        /* noop */
      }
      throw new Error(detail || `HTTP ${res.status}`);
    }

    return res.json();
  }

  function renderItems(listEl, items) {
    if (!items?.length) {
      listEl.innerHTML = `<p class="stock-empty">표시할 헤드라인이 없습니다. 잠시 후 새로고침해 보세요.</p>`;
      return;
    }

    listEl.innerHTML = items
      .map((item) => {
        const title = escapeHtml(item.title);
        const publisher = escapeHtml(item.publisher || "Yahoo Finance");
        const time = formatTime(item.publishedAt);
        const ticker = escapeHtml(item.sourceTicker || "");
        const link = item.link ? escapeHtml(item.link) : "";
        const badge = marketBadge(item.market);

        const titleHtml = link
          ? `<a class="stock-headline-link" href="${link}" target="_blank" rel="noopener noreferrer">${title}</a>`
          : `<span class="stock-headline-link">${title}</span>`;

        return `
          <article class="stock-headline-card">
            <div class="stock-headline-meta">
              ${badge}
              <span class="stock-headline-publisher">${publisher}</span>
              ${ticker ? `<span class="stock-headline-ticker">${ticker}</span>` : ""}
              ${time ? `<time class="stock-headline-time">${time}</time>` : ""}
            </div>
            <h3 class="stock-headline-title">${titleHtml}</h3>
          </article>
        `;
      })
      .join("");
  }

  function setStatus(el, text, type) {
    if (!el) return;
    el.textContent = text || "";
    el.className = `stock-status${type ? ` stock-status-${type}` : ""}`;
    el.hidden = !text;
  }

  function hasHeadlines(listEl) {
    return !!listEl?.querySelector(".stock-headline-card");
  }

  async function loadHeadlines(root, market) {
    const listEl = root.querySelector("#stock-headline-list");
    const statusEl = root.querySelector("#stock-status");
    const hadContent = hasHeadlines(listEl);

    activeMarket = market;
    root.querySelectorAll(".stock-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.market === market);
    });

    setUpdating(root, true);
    if (!hadContent) {
      listEl.innerHTML = `<p class="stock-loading">헤드라인을 불러오는 중…</p>`;
    }
    setStatus(statusEl, "", "");

    try {
      const data = await fetchHeadlines(market);
      renderItems(listEl, data.items);
      setLastUpdated(root, new Date());
      const cacheNote = data.cached ? ` · 서버 캐시 ${data.cacheAgeSeconds || 0}초 전` : "";
      setStatus(statusEl, `${data.count}건의 헤드라인${cacheNote}`, "info");
    } catch (err) {
      if (err.name === "AbortError") return;
      if (!hadContent) listEl.innerHTML = "";
      const msg = err.message || "헤드라인을 불러오지 못했습니다.";
      setStatus(statusEl, msg, "error");
    } finally {
      setUpdating(root, false);
    }
  }

  function renderStockPage(container) {
    container.innerHTML = `
      <article class="content-panel stock-panel">
        <div class="stock-header">
          <div>
            <h2>Stock</h2>
            <p class="stock-intro">주요 지수·종목의 헤드라인 뉴스 (Yahoo Finance / yfinance)</p>
          </div>
          <button type="button" class="secondary-btn" id="stock-refresh-btn" title="새로고침">↺ 새로고침</button>
        </div>
        <div class="stock-tabs" role="tablist" aria-label="시장 필터">
          ${MARKETS.map(
            (m) =>
              `<button type="button" class="stock-tab${m.id === "all" ? " active" : ""}" data-market="${m.id}" role="tab">${m.label}</button>`
          ).join("")}
        </div>
        <p id="stock-last-updated" class="stock-last-updated" hidden>마지막 업데이트: —</p>
        <p id="stock-status" class="stock-status" hidden></p>
        <div class="stock-body">
          <div id="stock-update-overlay" class="stock-update-overlay" hidden role="status" aria-live="polite">
            <span class="stock-update-spinner" aria-hidden="true"></span>
            <span>업데이트 중</span>
            <span class="stock-update-overlay-hint">번역·수집에 시간이 걸릴 수 있습니다 (Render 무료 서버는 최대 1분)</span>
          </div>
          <div id="stock-headline-list" class="stock-headline-list"></div>
        </div>
        <p class="stock-footnote">제목은 한국어로 자동 번역됩니다 (원문은 기사 링크). 데이터: Yahoo Finance · 투자 참고용.</p>
      </article>
    `;

    const root = container.querySelector(".stock-panel") || container;

    if (lastUpdatedAt) {
      setLastUpdated(root, lastUpdatedAt);
    }

    root.querySelectorAll(".stock-tab").forEach((btn) => {
      btn.addEventListener("click", () => loadHeadlines(root, btn.dataset.market));
    });

    root.querySelector("#stock-refresh-btn")?.addEventListener("click", () => {
      loadHeadlines(root, activeMarket);
    });

    loadHeadlines(root, activeMarket);
  }

  function destroy() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  window.Stock = {
    renderStockPage,
    destroy
  };
})();
