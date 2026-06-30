(function () {
  const MARKETS = [
    { id: "all", label: "전체" },
    { id: "kr", label: "국내" },
    { id: "us", label: "해외" }
  ];

  let activeMarket = "all";
  let abortController = null;
  let updateTimerId = null;
  let updateStartedAt = 0;
  let lastUpdatedAt = null;
  let newsBundleMemory = null;
  let headlinesCache = {};
  let headlinesRequestId = 0;

  function getStaticNewsUrl(bust) {
    const path = window.STOCK_NEWS_JSON_URL || "data/stock-news.json";
    const url = new URL(path, window.location.href);
    if (bust) url.searchParams.set("t", String(Date.now()));
    return url.href;
  }

  async function fetchStaticNewsBundle(bust) {
    const res = await fetch(getStaticNewsUrl(bust), { cache: bust ? "no-store" : "default" });
    if (!res.ok) {
      throw new Error(`뉴스 스냅샷을 불러오지 못했습니다 (HTTP ${res.status})`);
    }
    const bundle = await res.json();
    newsBundleMemory = bundle;
    return bundle;
  }

  function marketNewsFromBundle(bundle, market) {
    return bundle?.markets?.[market] || null;
  }

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
    if (/internal server error|http 500|http 502|failed to build recommendations/i.test(msg)) {
      return "주식 API 서버 오류가 발생했습니다. 잠시 후 ↺ 새로고침을 다시 눌러 주세요.";
    }
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      if (window.IS_LOCAL_FILE_PREVIEW) {
        return "HTML 파일을 직접 열면 API가 차단됩니다. Live Server 또는 GitHub Pages(https://jongkyung-ko.github.io/First/)로 열어 주세요.";
      }
      if (base?.includes("localhost")) {
        return "로컬 API(localhost:8000)에 연결할 수 없습니다. backend 폴더에서 uvicorn을 실행했는지 확인하세요.";
      }
      return "주식 API 서버에 연결할 수 없습니다. Render 무료 서버는 첫 요청 시 최대 1~2분 걸릴 수 있습니다. ↺ 새로고침을 다시 눌러 보세요.";
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
      const timer = setTimeout(() => controller.abort(), 45000);
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

  function headlineThumbHtml(item, link) {
    const rawUrl = item.imageUrl || item.thumbnailUrl || "";
    if (!/^https:\/\//i.test(rawUrl)) return "";

    const imageUrl = escapeHtml(rawUrl);
    const href = link || imageUrl;
    return `<a class="stock-headline-thumb-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-hidden="true" tabindex="-1"><img class="stock-headline-thumb" src="${imageUrl}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.remove()"></a>`;
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

  function isGuestMode() {
    return !window.Auth?.getSession?.();
  }

  const GUEST_REFRESH_MSG = "Guest 모드에서는 새로고침을 사용할 수 없습니다. 로그인 후 이용하세요.";

  function isStockRefreshButton(btn) {
    return btn?.id === "stock-refresh-btn" || btn?.id === "stock-picks-refresh-btn";
  }

  function applyGuestRefreshControls(root) {
    if (!root) return;
    const guest = isGuestMode();
    root.querySelectorAll("#stock-refresh-btn, #stock-picks-refresh-btn").forEach((btn) => {
      if (guest) {
        btn.disabled = true;
        btn.title = GUEST_REFRESH_MSG;
        btn.classList.add("stock-refresh-guest-disabled");
      } else {
        btn.classList.remove("stock-refresh-guest-disabled");
        btn.title = "새로고침";
      }
    });
  }

  function clearUpdateTimer(root) {
    if (updateTimerId) {
      clearInterval(updateTimerId);
      updateTimerId = null;
    }
    if (root) {
      const elapsedEl = root.querySelector("#stock-update-elapsed");
      if (elapsedEl) elapsedEl.textContent = "0초";
    }
  }

  function tickUpdateElapsed(root) {
    const elapsedEl = root.querySelector("#stock-update-elapsed");
    if (!elapsedEl) return;
    const sec = Math.max(0, Math.floor((Date.now() - updateStartedAt) / 1000));
    elapsedEl.textContent = `${sec}초`;
  }

  function setUpdating(root, updating, options = {}) {
    const panel = root.classList?.contains("stock-panel") ? root : root.querySelector(".stock-panel");
    const overlay = root.querySelector("#stock-update-overlay");
    const msgEl = root.querySelector("#stock-update-message");

    if (panel) panel.classList.toggle("stock-panel--updating", updating);

    if (updating) {
      if (msgEl && options.message) msgEl.textContent = options.message;
      updateStartedAt = Date.now();
      tickUpdateElapsed(root);
      clearUpdateTimer(root);
      updateTimerId = setInterval(() => tickUpdateElapsed(root), 1000);
      if (overlay) overlay.hidden = false;
    } else {
      clearUpdateTimer(root);
      if (overlay) overlay.hidden = true;
    }

    root.querySelectorAll(".stock-tab, #stock-refresh-btn, #stock-picks-refresh-btn").forEach((btn) => {
      if (isStockRefreshButton(btn) && isGuestMode()) {
        btn.disabled = true;
      } else {
        btn.disabled = updating;
      }
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

        const thumbHtml = headlineThumbHtml(item, link);

        return `
          <article class="stock-headline-card${thumbHtml ? " stock-headline-card--has-thumb" : ""}">
            <div class="stock-headline-meta">
              ${sentBadge}
              ${badge}
              <span class="stock-headline-publisher">${publisher}</span>
              ${ticker ? `<span class="stock-headline-ticker">${ticker}</span>` : ""}
              ${time ? `<time class="stock-headline-time">${time}</time>` : ""}
            </div>
            <div class="stock-headline-body">
              ${thumbHtml}
              <div class="stock-headline-content">
                <h3 class="stock-headline-title">${title}</h3>
                <p class="stock-headline-summary">${summaryShort}</p>
                <p class="stock-headline-summary-full" id="stock-summary-${idx}">${summaryFull}</p>
                <div class="stock-headline-actions">
                  ${moreBtn}
                  ${linkHtml}
                </div>
              </div>
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

  function showCachedHeadlines(root, listEl, statusEl, market) {
    const cached = headlinesCache[market];
    if (!cached?.items?.length) return false;
    renderItems(listEl, cached.items);
    if (cached.fetchedAt) {
      setLastUpdated(root, cached.fetchedAt);
    }
    const schedule = newsBundleMemory?.updateSchedule ? ` · ${newsBundleMemory.updateSchedule}` : "";
    setStatus(statusEl, `${cached.items.length}건의 헤드라인 · 저장된 스냅샷${schedule}`, "info");
    return true;
  }

  function showNewsFromBundle(root, listEl, statusEl, market, bundle, sourceLabel) {
    const payload = marketNewsFromBundle(bundle, market);
    if (!payload?.items?.length) return false;

    const fetchedAt = bundle?.updatedAt ? new Date(bundle.updatedAt) : new Date();
    headlinesCache[market] = { items: payload.items, fetchedAt };
    renderItems(listEl, payload.items);
    setLastUpdated(root, fetchedAt);
    const schedule = bundle?.updateSchedule ? ` · ${bundle.updateSchedule}` : "";
    const cacheNote = payload.cached ? ` · 서버 캐시 ${payload.cacheAgeSeconds || 0}초 전` : "";
    setStatus(
      statusEl,
      `${payload.count ?? payload.items.length}건의 헤드라인 · ${sourceLabel}${schedule}${cacheNote}`,
      "info"
    );
    return true;
  }

  async function loadHeadlines(root, market, options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const listEl = root.querySelector("#stock-headline-list");
    const statusEl = root.querySelector("#stock-status");
    const requestId = ++headlinesRequestId;

    activeMarket = market;
    root.querySelectorAll(".stock-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.market === market);
    });

    if (!forceRefresh) {
      let showedSnapshot =
        (newsBundleMemory && showNewsFromBundle(root, listEl, statusEl, market, newsBundleMemory, "GitHub 스냅샷")) ||
        showCachedHeadlines(root, listEl, statusEl, market);

      if (!showedSnapshot) {
        setUpdating(root, true, {
          message: "뉴스 스냅샷을 불러오는 중… 잠시만 기다려 주세요."
        });
        listEl.innerHTML = `<p class="stock-loading">헤드라인을 불러오는 중…</p>`;
        setStatus(statusEl, "", "");
        try {
          const bundle = await fetchStaticNewsBundle(false);
          showedSnapshot = showNewsFromBundle(root, listEl, statusEl, market, bundle, "GitHub 스냅샷");
        } catch (err) {
          if (!showedSnapshot) {
            listEl.innerHTML = `<p class="stock-empty">뉴스 스냅샷을 불러오지 못했습니다. 잠시 후 ↺ 새로고침을 눌러 주세요.</p>`;
            setStatus(statusEl, err.message || "스냅샷 로드 실패", "error");
          }
        } finally {
          setUpdating(root, false);
        }
      }

      if (showedSnapshot) return;

      if (window.STOCK_PICKS_USE_API && getApiBase()) {
        await loadHeadlines(root, market, { forceRefresh: true });
      }
      return;
    }

    const hadCache = showCachedHeadlines(root, listEl, statusEl, market);
    const hadVisible = hasHeadlines(listEl);

    setUpdating(root, true, {
      message:
        hadCache || hadVisible
          ? "헤드라인을 새로고침하는 중… 기존 뉴스는 그대로 보입니다. 잠시만 기다려 주세요. (최대 약 1분)"
          : "헤드라인을 불러오는 중… 잠시만 기다려 주세요. (최대 약 1분)"
    });

    if (!hadCache && !hadVisible) {
      listEl.innerHTML = `<p class="stock-loading">헤드라인을 불러오는 중…</p>`;
      setStatus(statusEl, "", "");
    } else {
      setStatus(statusEl, "새 데이터를 불러오는 중… (기존 뉴스 유지)", "info");
    }

    try {
      const data = await fetchHeadlines(market);
      if (requestId !== headlinesRequestId) return;

      const fetchedAt = new Date();
      headlinesCache[market] = { items: data.items, fetchedAt };
      renderItems(listEl, data.items);
      setLastUpdated(root, fetchedAt);
      const cacheNote = data.cached ? ` · 서버 캐시 ${data.cacheAgeSeconds || 0}초 전` : "";
      setStatus(statusEl, `${data.count}건의 헤드라인 · 실시간${cacheNote}`, "info");
    } catch (err) {
      if (err.name === "AbortError") return;
      if (requestId !== headlinesRequestId) return;
      if (!hadCache && !hadVisible) listEl.innerHTML = "";
      setStatus(statusEl, formatFetchError(err, getApiBase()), "error");
    } finally {
      if (requestId === headlinesRequestId) {
        setUpdating(root, false);
      }
    }
  }

  function renderStockNewsPage(container) {
    container.innerHTML = `
      <article class="content-panel stock-panel">
        <div class="stock-header">
          <div>
            <h2>Stock News</h2>
            <p class="stock-intro">주요 지수·종목 헤드라인 (GitHub 스냅샷 · ↺ 새로고침 시 실시간 API)</p>
          </div>
          <button type="button" class="secondary-btn" id="stock-refresh-btn" title="새로고침">Re</button>
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
            <span id="stock-update-elapsed" class="stock-update-elapsed">0초</span>
            <span id="stock-update-message" class="stock-update-overlay-msg">헤드라인을 불러오는 중… 잠시만 기다려 주세요. (최대 약 1분)</span>
          </div>
          <div id="stock-headline-list" class="stock-headline-list"></div>
        </div>
        <p class="stock-footnote">요약·호재/악재는 자동 분석이며 참고용입니다. 제목·요약은 한국어로 번역될 수 있습니다.</p>
      </article>
    `;

    const root = container.querySelector(".stock-panel") || container;

    const newsIntroEl = root.querySelector(".stock-intro");
    if (newsIntroEl && isGuestMode()) {
      newsIntroEl.textContent =
        "Guest 모드 — 뉴스를 볼 수 있습니다. ↺ 새로고침은 로그인 후 이용하세요.";
    }

    if (lastUpdatedAt) {
      setLastUpdated(root, lastUpdatedAt);
    }

    root.querySelectorAll(".stock-tab").forEach((btn) => {
      btn.addEventListener("click", () => loadHeadlines(root, btn.dataset.market));
    });

    root.querySelector("#stock-refresh-btn")?.addEventListener("click", async () => {
      if (isGuestMode()) {
        setStatus(root.querySelector("#stock-status"), GUEST_REFRESH_MSG, "info");
        return;
      }
      const spendResult = await window.Digimon?.spendForStockNewsRefresh?.();
      if (spendResult && !spendResult.ok) {
        setStatus(root.querySelector("#stock-status"), spendResult.error || "Digi-Mon이 부족합니다.", "error");
        return;
      }
      loadHeadlines(root, activeMarket, { forceRefresh: true });
    });

    loadHeadlines(root, activeMarket);
    applyGuestRefreshControls(root);
  }

  function destroy() {
    clearUpdateTimer(null);
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    window.DwStockPicks?.destroy?.();
  }

  function renderStockPicksPage(container) {
    if (window.DwStockPicks?.renderPage) {
      return window.DwStockPicks.renderPage(container);
    }
    container.innerHTML = `<article class="content-panel stock-panel"><h2>Stock Picks</h2><p class="stock-empty">Stock Picks 모듈을 불러오지 못했습니다.</p></article>`;
  }

  window.Stock = {
    renderStockNewsPage,
    renderStockPage: renderStockNewsPage,
    renderStockPicksPage,
    destroy
  };
})();
