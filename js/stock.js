(function () {
  const MARKETS = [
    { id: "all", label: "전체" },
    { id: "kr", label: "국내" },
    { id: "us", label: "해외" }
  ];

  let activeMarket = "all";
  let activePicksMarket = "all";
  let abortController = null;
  let picksAbortController = null;
  let lastUpdatedAt = null;
  let lastPicksUpdatedAt = null;

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function formatFetchError(err, base) {
    if (err?.name === "AbortError") {
      return "요청이 취소되었거나 시간이 초과되었습니다. 잠시 후 다시 시도해 보세요.";
    }

    const msg = String(err?.message || err || "");
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      if (window.IS_LOCAL_FILE_PREVIEW) {
        return "HTML 파일을 직접 열면 API가 차단됩니다. Live Server 또는 GitHub Pages(https://jongkyung-ko.github.io/First/)로 열어 주세요.";
      }
      if (base?.includes("localhost")) {
        return "로컬 API(localhost:8000)에 연결할 수 없습니다. backend 폴더에서 uvicorn을 실행했는지 확인하세요.";
      }
      return "주식 API 서버에 연결할 수 없습니다. Render 무료 서버는 첫 요청 시 최대 1분 걸릴 수 있습니다. ↺ 새로고침을 다시 눌러 보세요.";
    }

    if (/not found/i.test(msg)) {
      return "추천 API가 아직 배포되지 않았습니다. GitHub push 후 Render에서 first-stock-api를 재배포해 주세요.";
    }

    return msg || "데이터를 불러오지 못했습니다.";
  }

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function warmApi(base) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      await fetch(`${base}/health`, { signal: controller.signal });
      clearTimeout(timer);
    } catch (_) {
      /* server may still be waking up */
    }
  }

  async function fetchJsonWithRetry(url, externalSignal, options = {}) {
    const retries = options.retries ?? 2;
    const timeoutMs = options.timeoutMs ?? 90000;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (externalSignal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onExternalAbort = () => controller.abort();
      externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);

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
      } catch (err) {
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);
        if (externalSignal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        lastError = err;
        if (attempt < retries) {
          await warmApi(getApiBase());
          await sleep(1500 * (attempt + 1));
        }
      }
    }

    throw lastError || new Error("Failed to fetch");
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

  function marketLabel(market) {
    if (market === "kr") return "국내";
    if (market === "us") return "해외";
    return "";
  }

  function setUpdating(root, updating) {
    const panel = root.classList?.contains("stock-panel") ? root : root.querySelector(".stock-panel");
    const overlay = root.querySelector("#stock-update-overlay");
    if (panel) panel.classList.toggle("stock-panel--updating", updating);
    if (overlay) overlay.hidden = !updating;
    root.querySelectorAll(".stock-tab, #stock-refresh-btn, #stock-picks-refresh-btn").forEach((btn) => {
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

    const url = `${base}/api/headlines?market=${encodeURIComponent(market)}&limit=25&lang=ko`;
    await warmApi(base);
    return fetchJsonWithRetry(url, abortController.signal, { retries: 2, timeoutMs: 90000 });
  }

  async function fetchRecommendations(market) {
    const base = getApiBase();
    if (!base) {
      throw new Error(
        "STOCK_API_URL이 설정되지 않았습니다. js/config.js에 Render 배포 URL을 넣거나 로컬 API(localhost:8000)를 사용하세요."
      );
    }

    if (picksAbortController) picksAbortController.abort();
    picksAbortController = new AbortController();

    const url = `${base}/api/recommendations?market=${encodeURIComponent(market)}&limit=8&lang=ko`;
    await warmApi(base);
    return fetchJsonWithRetry(url, picksAbortController.signal, { retries: 2, timeoutMs: 120000 });
  }

  function formatPct(value) {
    if (value == null || !Number.isFinite(value)) return "—";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }

  function formatPrice(value) {
    if (value == null || !Number.isFinite(value)) return "—";
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function renderPickItems(listEl, items) {
    if (!items?.length) {
      listEl.innerHTML = `<p class="stock-empty">추천할 종목을 찾지 못했습니다. 잠시 후 새로고침해 보세요.</p>`;
      return;
    }

    listEl.innerHTML = `
      <div class="stock-picks-list">
        ${items
          .map((item, idx) => {
            const change = item.changePct;
            const changeCls = change > 0 ? "up" : change < 0 ? "down" : "";
            return `
              <article class="stock-pick-card">
                <div class="stock-pick-header">
                  <span class="stock-pick-rank">#${idx + 1}</span>
                  <div class="stock-pick-title-wrap">
                    <h3 class="stock-pick-name">${escapeHtml(item.name)}</h3>
                    <div class="stock-pick-ticker">${escapeHtml(item.ticker)} · ${escapeHtml(marketLabel(item.market))}</div>
                  </div>
                  <span class="stock-pick-score">점수 ${escapeHtml(String(item.score))}</span>
                </div>
                <div class="stock-pick-metrics">
                  <span class="stock-pick-metric">${escapeHtml(item.stanceLabel || "관망")}</span>
                  <span class="stock-pick-metric">가격 ${formatPrice(item.price)}</span>
                  <span class="stock-pick-metric ${changeCls}">1일 ${formatPct(change)}</span>
                  <span class="stock-pick-metric">호재 ${item.bullishNews ?? 0}</span>
                  <span class="stock-pick-metric">악재 ${item.bearishNews ?? 0}</span>
                </div>
                <p class="stock-pick-reason">${escapeHtml(item.reason)}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  async function buildPicksFromHeadlines(market) {
    const data = await fetchHeadlines(market);
    const scores = new Map();

    for (const item of data.items || []) {
      const tickers = new Set([item.sourceTicker, ...(item.relatedTickers || [])].filter(Boolean));
      for (const ticker of tickers) {
        if (!ticker || ticker.startsWith("^")) continue;
        const entry = scores.get(ticker) || {
          ticker,
          name: ticker,
          market: item.market || "us",
          bullishNews: 0,
          bearishNews: 0,
          score: 0
        };
        if (item.sentiment === "bullish") entry.bullishNews += 1;
        else if (item.sentiment === "bearish") entry.bearishNews += 1;
        entry.score = entry.bullishNews * 3 - entry.bearishNews * 2;
        scores.set(ticker, entry);
      }
    }

    const names = {
      AAPL: "Apple",
      NVDA: "NVIDIA",
      MSFT: "Microsoft",
      TSLA: "Tesla",
      AMZN: "Amazon",
      GOOGL: "Alphabet",
      META: "Meta",
      "005930.KS": "삼성전자",
      "000660.KS": "SK하이닉스",
      "035420.KS": "NAVER",
      "035720.KQ": "카카오"
    };

    return [...scores.values()]
      .filter((row) => row.score > 0 || row.bullishNews > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((row, idx) => ({
        ...row,
        name: names[row.ticker] || row.ticker,
        stanceLabel: row.score >= 4 ? "관심" : "관망",
        price: null,
        changePct: null,
        reason: `뉴스 분석 기반 임시 추천 (#${idx + 1}) — 호재 ${row.bullishNews}건 · 악재 ${row.bearishNews}건`
      }));
  }

  async function loadRecommendations(root, market) {
    const listEl = root.querySelector("#stock-picks-list");
    const statusEl = root.querySelector("#stock-picks-status");
    const hadContent = !!listEl?.querySelector(".stock-pick-card");

    activePicksMarket = market;
    root.querySelectorAll(".stock-picks-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.market === market);
    });

    setUpdating(root, true);
    if (!hadContent) {
      listEl.innerHTML = `<p class="stock-loading">추천 종목을 분석하는 중…</p>`;
    }
    setStatus(statusEl, "", "");

    try {
      let data;
      try {
        data = await fetchRecommendations(market);
      } catch (apiErr) {
        if (/not found/i.test(apiErr?.message || "")) {
          const fallback = await buildPicksFromHeadlines(market);
          if (fallback.length) {
            renderPickItems(listEl, fallback);
            setStatus(
              statusEl,
              `추천 API 미배포 — 뉴스 기반 임시 추천 ${fallback.length}개`,
              "info"
            );
            return;
          }
        }
        throw apiErr;
      }
      renderPickItems(listEl, data.items);
      lastPicksUpdatedAt = new Date();
      const updatedEl = root.querySelector("#stock-picks-last-updated");
      if (updatedEl) {
        updatedEl.textContent = `마지막 업데이트: ${formatLastUpdated(lastPicksUpdatedAt)}`;
        updatedEl.hidden = false;
      }
      const cacheNote = data.cached ? ` · 서버 캐시 ${data.cacheAgeSeconds || 0}초 전` : "";
      setStatus(statusEl, `${data.count}개 종목 추천${cacheNote}`, "info");
    } catch (err) {
      if (err.name === "AbortError") return;
      if (!hadContent) listEl.innerHTML = "";
      setStatus(statusEl, formatFetchError(err, getApiBase()), "error");
    } finally {
      setUpdating(root, false);
    }
  }

  function renderStockPicksPage(container) {
    container.innerHTML = `
      <article class="content-panel stock-panel">
        <div class="stock-header">
          <div>
            <h2>Stock Picks</h2>
            <p class="stock-intro">뉴스 심리·최근 가격 흐름을 바탕으로 한 주식 추천 (참고용)</p>
          </div>
          <button type="button" class="secondary-btn" id="stock-picks-refresh-btn" title="새로고침">↺ 새로고침</button>
        </div>
        <div class="stock-tabs stock-picks-tabs" role="tablist" aria-label="시장 필터">
          ${MARKETS.map(
            (m) =>
              `<button type="button" class="stock-tab stock-picks-tab${m.id === "all" ? " active" : ""}" data-market="${m.id}" role="tab">${m.label}</button>`
          ).join("")}
        </div>
        <p id="stock-picks-last-updated" class="stock-last-updated" hidden>마지막 업데이트: —</p>
        <p id="stock-picks-status" class="stock-status" hidden></p>
        <div class="stock-body">
          <div id="stock-update-overlay" class="stock-update-overlay" hidden role="status" aria-live="polite">
            <span class="stock-update-spinner" aria-hidden="true"></span>
            <span>분석 중</span>
            <span class="stock-update-overlay-hint">Render 무료 서버는 첫 요청에 최대 1분 걸릴 수 있습니다. 실패하면 ↺ 새로고침을 다시 눌러 주세요.</span>
          </div>
          <div id="stock-picks-list" class="stock-picks-list"></div>
        </div>
        <p class="stock-footnote">자동 분석 기반 참고용 추천이며 투자 권유가 아닙니다. 실제 투자 결정은 본인 책임입니다.</p>
      </article>
    `;

    const root = container.querySelector(".stock-panel") || container;

    if (lastPicksUpdatedAt) {
      const updatedEl = root.querySelector("#stock-picks-last-updated");
      if (updatedEl) {
        updatedEl.textContent = `마지막 업데이트: ${formatLastUpdated(lastPicksUpdatedAt)}`;
        updatedEl.hidden = false;
      }
    }

    root.querySelectorAll(".stock-picks-tab").forEach((btn) => {
      btn.addEventListener("click", () => loadRecommendations(root, btn.dataset.market));
    });

    root.querySelector("#stock-picks-refresh-btn")?.addEventListener("click", () => {
      loadRecommendations(root, activePicksMarket);
    });

    loadRecommendations(root, activePicksMarket);
  }

  function sentimentBadge(sentiment, label) {
    const lbl = label || (sentiment === "bullish" ? "호재" : sentiment === "bearish" ? "악재" : "중립");
    const cls =
      sentiment === "bullish"
        ? "stock-sentiment-bullish"
        : sentiment === "bearish"
          ? "stock-sentiment-bearish"
          : "stock-sentiment-neutral";
    return `<span class="stock-sentiment ${cls}">${escapeHtml(lbl)}</span>`;
  }

  function bindHeadlineCards(listEl) {
    listEl.querySelectorAll(".stock-headline-card").forEach((card) => {
      const toggle = card.querySelector(".stock-headline-toggle");
      const full = card.querySelector(".stock-headline-summary-full");
      if (!toggle || !full) return;
      toggle.addEventListener("click", () => {
        const expanded = card.classList.toggle("stock-headline-card--expanded");
        toggle.textContent = expanded ? "접기" : "더 보기";
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
    });
  }

  function renderItems(listEl, items) {
    if (!items?.length) {
      listEl.innerHTML = `<p class="stock-empty">표시할 헤드라인이 없습니다. 잠시 후 새로고침해 보세요.</p>`;
      return;
    }

    listEl.innerHTML = items
      .map((item, idx) => {
        const title = escapeHtml(item.title);
        const publisher = escapeHtml(item.publisher || "Yahoo Finance");
        const time = formatTime(item.publishedAt);
        const ticker = escapeHtml(item.sourceTicker || "");
        const link = item.link ? escapeHtml(item.link) : "";
        const badge = marketBadge(item.market);
        const sentBadge = sentimentBadge(item.sentiment, item.sentimentLabel);
        const summaryShort = escapeHtml(item.summaryShort || item.summary || "");
        const summaryFull = escapeHtml(item.summary || item.summaryShort || "");
        const hasMore =
          (item.summary || "").length > (item.summaryShort || "").length ||
          (item.summary || "").length > 180;

        const linkHtml = link
          ? `<a class="stock-headline-source" href="${link}" target="_blank" rel="noopener noreferrer">원문 기사 보기 →</a>`
          : "";

        const moreBtn = hasMore
          ? `<button type="button" class="stock-headline-toggle" aria-expanded="false" aria-controls="stock-summary-${idx}">더 보기</button>`
          : "";

        return `
          <article class="stock-headline-card">
            <div class="stock-headline-meta">
              ${sentBadge}
              ${badge}
              <span class="stock-headline-publisher">${publisher}</span>
              ${ticker ? `<span class="stock-headline-ticker">${ticker}</span>` : ""}
              ${time ? `<time class="stock-headline-time">${time}</time>` : ""}
            </div>
            <h3 class="stock-headline-title">${title}</h3>
            <p class="stock-headline-summary">${summaryShort}</p>
            <p class="stock-headline-summary-full" id="stock-summary-${idx}">${summaryFull}</p>
            <div class="stock-headline-actions">
              ${moreBtn}
              ${linkHtml}
            </div>
          </article>
        `;
      })
      .join("");

    bindHeadlineCards(listEl);
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
      setStatus(statusEl, formatFetchError(err, getApiBase()), "error");
    } finally {
      setUpdating(root, false);
    }
  }

  function renderStockNewsPage(container) {
    container.innerHTML = `
      <article class="content-panel stock-panel">
        <div class="stock-header">
          <div>
            <h2>Stock News</h2>
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
            <span class="stock-update-overlay-hint">Render 무료 서버는 첫 요청에 최대 1분 걸릴 수 있습니다. 실패하면 ↺ 새로고침을 다시 눌러 주세요.</span>
          </div>
          <div id="stock-headline-list" class="stock-headline-list"></div>
        </div>
        <p class="stock-footnote">요약·호재/악재는 자동 분석이며 참고용입니다. 제목·요약은 한국어로 번역될 수 있습니다.</p>
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
    if (picksAbortController) {
      picksAbortController.abort();
      picksAbortController = null;
    }
  }

  window.Stock = {
    renderStockNewsPage,
    renderStockPage: renderStockNewsPage,
    renderStockPicksPage,
    destroy
  };
})();
