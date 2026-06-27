(function () {
  const MARKETS = [
    { id: "all", label: "전체" },
    { id: "kr", label: "국내" },
    { id: "us", label: "해외" }
  ];

  const PICK_MARKETS = [
    { id: "kr_kospi", label: "KOSPI TOP 10" },
    { id: "kr_kosdaq", label: "KOSDAQ TOP 10" },
    { id: "us", label: "미국 TOP 10" }
  ];

  const PICK_UNIVERSE = {
    kr_kospi: [
      ["005930.KS", "삼성전자"],
      ["000660.KS", "SK하이닉스"],
      ["373220.KS", "LG에너지솔루션"],
      ["207940.KS", "삼성바이오로직스"],
      ["005380.KS", "현대차"],
      ["329180.KS", "HD현대중공업"],
      ["000270.KS", "기아"],
      ["105560.KS", "KB금융"],
      ["035420.KS", "NAVER"],
      ["055550.KS", "신한지주"]
    ],
    kr_kosdaq: [
      ["247540.KQ", "에코프로비엠"],
      ["196170.KQ", "알테오젠"],
      ["277810.KQ", "레인보우로보틱스"],
      ["086520.KQ", "에코프로"],
      ["403870.KQ", "HPSP"],
      ["141080.KQ", "레고켐바이오"],
      ["028300.KQ", "HLB"],
      ["145020.KQ", "휴젤"],
      ["214450.KQ", "파마리서치"],
      ["310210.KQ", "보로노이"]
    ],
    us: [
      ["AAPL", "Apple"],
      ["MSFT", "Microsoft"],
      ["NVDA", "NVIDIA"],
      ["GOOGL", "Alphabet"],
      ["AMZN", "Amazon"],
      ["META", "Meta"],
      ["TSLA", "Tesla"],
      ["AVGO", "Broadcom"],
      ["BRK-B", "Berkshire Hathaway"],
      ["LLY", "Eli Lilly"]
    ]
  };

  let activeMarket = "all";
  let activePicksMarket = "kr_kospi";
  let abortController = null;
  let picksAbortController = null;
  let updateTimerId = null;
  let updateStartedAt = 0;
  let lastUpdatedAt = null;
  let lastPicksUpdatedAt = null;
  let picksBundleMemory = null;
  let picksSessionAutoLiveDone = false;
  let headlinesCache = {};
  let headlinesRequestId = 0;

  const PICKS_STORAGE_KEY = "dw_stock_picks_bundle_v1";
  const PICK_MARKET_IDS = PICK_MARKETS.map((m) => m.id);

  function usesPicksApi() {
    return !!window.STOCK_PICKS_USE_API;
  }

  function usesLiveRefresh() {
    return window.STOCK_PICKS_LIVE_REFRESH !== false;
  }

  function getStaticPicksUrl(bust) {
    const path = window.STOCK_PICKS_JSON_URL || "data/stock-picks.json";
    const url = new URL(path, window.location.href);
    if (bust) url.searchParams.set("t", String(Date.now()));
    return url.href;
  }

  function readPicksCache() {
    try {
      const raw = localStorage.getItem(PICKS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writePicksCache(bundle) {
    try {
      localStorage.setItem(PICKS_STORAGE_KEY, JSON.stringify(bundle));
    } catch (_) {
      /* storage full or disabled */
    }
  }

  function marketPayloadFromBundle(bundle, market) {
    return bundle?.markets?.[market] || null;
  }

  function showPicksResult(root, listEl, statusEl, data, bundle, sourceLabel) {
    renderPickItems(listEl, data.items);
    const updatedIso = bundle?.updatedAt;
    if (updatedIso) {
      lastPicksUpdatedAt = new Date(updatedIso);
      const updatedEl = root.querySelector("#stock-picks-last-updated");
      if (updatedEl) {
        updatedEl.textContent = `마지막 업데이트: ${formatLastUpdated(lastPicksUpdatedAt)}`;
        updatedEl.hidden = false;
      }
    }
    const title = data.segmentTitle ? `${data.segmentTitle} — ` : "";
    const recommendCount = (data.items || []).filter((i) => i.recommended).length;
    const schedule = bundle?.updateSchedule ? ` · ${bundle.updateSchedule}` : "";
    const windowLabel = data.newsWindowLabel || bundle?.newsWindowLabel || "최근 7일 뉴스 기준";
    setStatus(
      statusEl,
      `${title}${data.count}개 종목 (추천 ${recommendCount}개) · ${windowLabel} · ${sourceLabel}${schedule}`,
      "info"
    );
  }

  async function fetchStaticPicksBundle(bust) {
    const res = await fetch(getStaticPicksUrl(bust), { cache: bust ? "no-store" : "default" });
    if (!res.ok) {
      throw new Error(`스냅샷을 불러오지 못했습니다 (HTTP ${res.status})`);
    }
    const bundle = await res.json();
    picksBundleMemory = bundle;
    writePicksCache(bundle);
    return bundle;
  }

  async function fetchLivePicksBundle() {
    const base = getApiBase();
    if (!base) {
      throw new Error(
        "STOCK_API_URL이 설정되지 않았습니다. js/config.js에 Render 배포 URL을 넣거나 로컬 API(localhost:8000)를 사용하세요."
      );
    }

    if (picksAbortController) picksAbortController.abort();
    picksAbortController = new AbortController();
    const signal = picksAbortController.signal;

    await warmApi(base);

    const bundleUrl = `${base}/api/recommendations/bundle?limit=10&lang=ko`;
    try {
      const bundle = await fetchJsonWithRetry(bundleUrl, signal, { retries: 1, timeoutMs: 240000 });
      picksBundleMemory = bundle;
      writePicksCache(bundle);
      return bundle;
    } catch (err) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return fetchLivePicksBundleFallback(signal, err);
    }
  }

  async function fetchLivePicksBundleFallback(signal, bundleError) {
    const markets = {};
    let successCount = 0;
    let lastError = bundleError;

    for (const marketId of PICK_MARKET_IDS) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        markets[marketId] = await fetchLiveRecommendations(marketId, signal);
        successCount += 1;
      } catch (err) {
        lastError = err;
      }
    }

    if (!successCount) {
      throw lastError || bundleError || new Error("Failed to fetch recommendations");
    }

    const bundle = {
      version: 1,
      updatedAt: new Date().toISOString(),
      trigger: "live",
      updateSchedule: "방문·새로고침 시 실시간 분석",
      newsWindowDays: 7,
      newsWindowLabel: "최근 7일 뉴스 기준",
      markets
    };
    picksBundleMemory = bundle;
    writePicksCache(bundle);
    return bundle;
  }

  function mergeLiveMarketIntoBundle(market, data) {
    const bundle = {
      version: 1,
      updatedAt: new Date().toISOString(),
      trigger: "live",
      updateSchedule: "방문·새로고침 시 실시간 분석",
      newsWindowDays: data.newsWindowDays ?? picksBundleMemory?.newsWindowDays ?? 7,
      newsWindowLabel: data.newsWindowLabel ?? picksBundleMemory?.newsWindowLabel ?? "최근 7일 뉴스 기준",
      markets: {
        ...(picksBundleMemory?.markets || {}),
        [market]: data
      }
    };
    picksBundleMemory = bundle;
    writePicksCache(bundle);
    return bundle;
  }

  function showStaleFromBundle(root, listEl, statusEl, bundle, market, label) {
    const data = marketPayloadFromBundle(bundle, market);
    if (!data?.items?.length) {
      return false;
    }
    picksBundleMemory = bundle;
    showPicksResult(root, listEl, statusEl, data, bundle, label);
    return true;
  }

  async function refreshPicksLive(root, market) {
    const listEl = root.querySelector("#stock-picks-list");
    const statusEl = root.querySelector("#stock-picks-status");
    const hadCards = !!listEl?.querySelector(".stock-pick-card");

    setUpdating(root, true, {
      message: hadCards
        ? "실시간 분석 중… 기존 목록은 그대로 보입니다. 잠시만 기다려 주세요. (최대 약 1분)"
        : "추천 종목을 불러오는 중… 잠시만 기다려 주세요. (최대 약 1분)"
    });
    if (!hadCards) {
      listEl.innerHTML = `<p class="stock-loading">실시간 분석 중…<br><span class="stock-loading-hint">Render 무료 서버 첫 요청은 최대 1분 걸릴 수 있습니다.</span></p>`;
      setStatus(statusEl, "", "");
    } else {
      setStatus(statusEl, "실시간 분석 중… (기존 데이터 유지)", "info");
    }

    try {
      const data = await fetchLiveRecommendations(market);
      if (data?.items?.length) {
        const bundle = mergeLiveMarketIntoBundle(market, data);
        showPicksResult(root, listEl, statusEl, data, bundle, "실시간 분석 완료");
      } else if (hadCards) {
        setStatus(
          statusEl,
          data?.error
            ? `실시간 분석 실패 — ${data.error} (기존 데이터 유지)`
            : "실시간 분석 결과가 비어 있습니다. 잠시 후 다시 시도해 주세요.",
          "error"
        );
      } else {
        listEl.innerHTML = `<p class="stock-empty">추천할 종목을 찾지 못했습니다. 잠시 후 새로고침해 보세요.</p>`;
        setStatus(statusEl, data?.error || "실시간 분석 결과가 비어 있습니다.", "error");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      if (!hadCards) {
        listEl.innerHTML = "";
      }
      const message = hadCards
        ? `${formatFetchError(err, getApiBase())} (기존 데이터는 유지됩니다)`
        : formatFetchError(err, getApiBase());
      setStatus(statusEl, message, "error");
    } finally {
      setUpdating(root, false);
    }
  }

  async function fetchLiveRecommendations(market, externalSignal) {
    const base = getApiBase();
    if (!base) {
      throw new Error(
        "STOCK_API_URL이 설정되지 않았습니다. js/config.js에 Render 배포 URL을 넣거나 로컬 API(localhost:8000)를 사용하세요."
      );
    }

    let signal = externalSignal;
    if (!signal) {
      if (picksAbortController) picksAbortController.abort();
      picksAbortController = new AbortController();
      signal = picksAbortController.signal;
    }

    const url = `${base}/api/recommendations?market=${encodeURIComponent(market)}&limit=10&lang=ko`;
    if (!externalSignal) {
      await warmApi(base);
    }
    return fetchJsonWithRetry(url, signal, { retries: 2, timeoutMs: 180000 });
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

  async function fetchRecommendations(market) {
    return fetchLiveRecommendations(market);
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

  function pickStanceClass(stance) {
    if (stance === "recommend") return "recommend";
    if (stance === "caution") return "caution";
    return "watch";
  }

  function normalizeImageUrl(url) {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (/^https:\/\//i.test(trimmed)) return trimmed;
    if (/^http:\/\//i.test(trimmed)) return trimmed.replace(/^http:/i, "https:");
    return "";
  }

  function pickLogoUrlList(item) {
    const urls = [];
    const add = (candidate) => {
      const normalized = normalizeImageUrl(candidate);
      if (normalized && !urls.includes(normalized)) urls.push(normalized);
    };

    add(item.imageUrl);
    add(item.logoUrl);

    const ticker = String(item.ticker || "");
    const krMatch = ticker.match(/^(\d{6})\.(KS|KQ)$/i);
    if (krMatch) {
      add(`https://ssl.pstatic.net/imgstock/fn/real/logo/${krMatch[1]}.png`);
    }

    const symbol = ticker.split(".")[0].toUpperCase();
    if (item.market === "us" || (/^[A-Z]{1,5}$/.test(symbol) && !krMatch)) {
      add(`https://financialmodelingprep.com/image-stock/${symbol}.png`);
    }

    return urls;
  }

  function pickThumbOnError(img) {
    const rest = (img.dataset.fallbacks || "").split("|").filter(Boolean);
    if (rest.length) {
      img.dataset.fallbacks = rest.slice(1).join("|");
      img.src = rest[0];
      return;
    }
    const initial = escapeHtml(img.dataset.initial || "?");
    const wrap = img.parentElement;
    if (wrap) {
      wrap.innerHTML = `<span class="stock-pick-thumb stock-pick-thumb--initial">${initial}</span>`;
    }
  }

  if (!window.__pickThumbOnError) {
    window.__pickThumbOnError = pickThumbOnError;
  }

  function pickThumbHtml(item) {
    const urls = pickLogoUrlList(item);
    const initial = escapeHtml((item.name || item.ticker || "?").charAt(0).toUpperCase());
    if (!urls.length) {
      return `<span class="stock-pick-thumb stock-pick-thumb--initial">${initial}</span>`;
    }

    const encoded = urls.map(escapeHtml);
    const first = encoded[0];
    const rest = encoded.slice(1).join("|");
    return `<span class="stock-pick-thumb-wrap"><img class="stock-pick-thumb" src="${first}" alt="" loading="lazy" decoding="async" data-fallbacks="${rest}" data-initial="${initial}" onerror="window.__pickThumbOnError(this)"></span>`;
  }

  function renderPickArticleItem(article) {
    const title = escapeHtml(article.title || "제목 없음");
    const summary = escapeHtml(article.summaryShort || "");
    const time = formatTime(article.publishedAt);
    const link = article.link ? escapeHtml(article.link) : "";
    const thumbHtml = headlineThumbHtml(article, link);
    const linkHtml = link
      ? `<a class="stock-pick-article-link" href="${link}" target="_blank" rel="noopener noreferrer">원문 →</a>`
      : "";

    return `
      <article class="stock-pick-article${thumbHtml ? " stock-pick-article--has-thumb" : ""}">
        <div class="stock-pick-article-body">
          ${thumbHtml}
          <div class="stock-pick-article-content">
            <h4 class="stock-pick-article-title">${title}</h4>
            ${summary ? `<p class="stock-pick-article-summary">${summary}</p>` : ""}
            <div class="stock-pick-article-meta">
              ${time ? `<time class="stock-pick-article-time">${time}</time>` : ""}
              ${linkHtml}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderPickNewsPanel(articles, sentiment, pickIdx, count, ticker, market) {
    if (!count) {
      return "";
    }
    const label = sentiment === "bullish" ? "호재" : "악재";
    const hasArticles = Array.isArray(articles) && articles.length > 0;
    const listBody = hasArticles
      ? articles.map((article) => renderPickArticleItem(article)).join("")
      : `<p class="stock-pick-news-panel-placeholder">관련 뉴스를 불러오는 중…</p>`;

    return `
      <div class="stock-pick-news-panel" id="pick-news-${sentiment}-${pickIdx}" data-sentiment="${sentiment}" data-ticker="${escapeHtml(ticker)}" data-market="${escapeHtml(market)}" data-loaded="${hasArticles ? "1" : ""}" hidden>
        <p class="stock-pick-news-panel-title">${label} 뉴스 ${count}건</p>
        <div class="stock-pick-article-list">
          ${listBody}
        </div>
      </div>
    `;
  }

  async function loadPickNewsPanel(panel) {
    if (!panel || panel.dataset.loaded === "1" || panel.dataset.loaded === "loading") {
      return;
    }

    panel.dataset.loaded = "loading";
    const listEl = panel.querySelector(".stock-pick-article-list");
    const sentiment = panel.dataset.sentiment;
    const ticker = panel.dataset.ticker;
    const market = panel.dataset.market || "kr";
    const label = sentiment === "bullish" ? "호재" : "악재";

    if (listEl) {
      listEl.innerHTML = `<p class="stock-pick-news-panel-placeholder">관련 뉴스를 불러오는 중…</p>`;
    }

    try {
      const headlineMarket = market === "us" ? "us" : "kr";
      const data = await fetchHeadlines(headlineMarket);
      const cutoff = Math.floor(Date.now() / 1000) - 7 * 86400;
      const articles = (data.items || [])
        .filter((item) => {
          if (item.publishedAt && item.publishedAt < cutoff) return false;
          if (item.sentiment !== sentiment) return false;
          const tickers = new Set([item.sourceTicker, ...(item.relatedTickers || [])].filter(Boolean));
          return tickers.has(ticker);
        })
        .slice(0, 5)
        .map((item) => ({
          title: item.title,
          summaryShort: item.summaryShort || item.summary,
          publishedAt: item.publishedAt,
          link: item.link,
          imageUrl: item.imageUrl
        }));

      if (!listEl) return;

      if (articles.length) {
        listEl.innerHTML = articles.map((article) => renderPickArticleItem(article)).join("");
      } else {
        listEl.innerHTML = `<p class="stock-pick-news-panel-empty">표시할 ${label} 기사가 없습니다. ↺ 새로고침으로 최신 분석을 받아보세요.</p>`;
      }
      panel.dataset.loaded = "1";
    } catch (_) {
      if (listEl) {
        listEl.innerHTML = `<p class="stock-pick-news-panel-empty">기사를 불러오지 못했습니다. 잠시 후 다시 시도하거나 ↺ 새로고침해 주세요.</p>`;
      }
      panel.dataset.loaded = "";
    }
  }

  function bindPickCards(listEl) {
    listEl.querySelectorAll(".stock-pick-metric--toggle").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const card = btn.closest(".stock-pick-card");
        if (!card) return;
        const sentiment = btn.dataset.sentiment;
        const panel = card.querySelector(`.stock-pick-news-panel[data-sentiment="${sentiment}"]`);
        if (!panel) return;

        const willOpen = panel.hidden;

        card.querySelectorAll(".stock-pick-news-panel").forEach((other) => {
          other.hidden = true;
        });
        card.querySelectorAll(".stock-pick-metric--toggle").forEach((otherBtn) => {
          otherBtn.classList.remove("is-open");
          otherBtn.setAttribute("aria-expanded", "false");
          const caret = otherBtn.querySelector(".stock-pick-metric-caret");
          if (caret) caret.textContent = "▾";
        });

        if (willOpen) {
          panel.hidden = false;
          btn.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          const caret = btn.querySelector(".stock-pick-metric-caret");
          if (caret) caret.textContent = "▴";
          await loadPickNewsPanel(panel);
        }
      });
    });
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
            const rank = item.rank ?? idx + 1;
            const label = item.recommendLabel || item.stanceLabel || "관망";
            const stanceCls = pickStanceClass(item.stance);
            const bullishCount = item.bullishNews ?? 0;
            const bearishCount = item.bearishNews ?? 0;
            const windowDays = item.newsWindowDays ?? 7;
            const windowHint =
              item.newsAnalyzedFrom && item.newsAnalyzedTo
                ? ` · ${formatTime(item.newsAnalyzedFrom)} ~ ${formatTime(item.newsAnalyzedTo)}`
                : "";
            const bullishArticles = item.bullishArticles || [];
            const bearishArticles = item.bearishArticles || [];

            return `
              <article class="stock-pick-card stock-pick-card--${stanceCls}">
                <div class="stock-pick-header">
                  ${pickThumbHtml(item)}
                  <span class="stock-pick-rank">#${rank}</span>
                  <div class="stock-pick-title-wrap">
                    <h3 class="stock-pick-name">${escapeHtml(item.name)}</h3>
                    <div class="stock-pick-ticker">${escapeHtml(item.ticker)} · ${escapeHtml(marketLabel(item.market))}</div>
                    <p class="stock-pick-window">최근 ${windowDays}일 뉴스 기준${windowHint}</p>
                  </div>
                  <span class="stock-pick-score">점수 ${escapeHtml(String(item.score ?? 0))}</span>
                </div>
                <div class="stock-pick-metrics">
                  <span class="stock-pick-metric stock-pick-metric--stance ${stanceCls}">${escapeHtml(label)}</span>
                  <span class="stock-pick-metric">가격 ${formatPrice(item.price)}</span>
                  <span class="stock-pick-metric ${changeCls}">1일 ${formatPct(change)}</span>
                  <button type="button" class="stock-pick-metric stock-pick-metric--toggle up" data-sentiment="bullish" aria-expanded="false" aria-controls="pick-news-bullish-${idx}"${bullishCount ? "" : " disabled"}>
                    호재 ${bullishCount} <span class="stock-pick-metric-caret">▾</span>
                  </button>
                  <button type="button" class="stock-pick-metric stock-pick-metric--toggle down" data-sentiment="bearish" aria-expanded="false" aria-controls="pick-news-bearish-${idx}"${bearishCount ? "" : " disabled"}>
                    악재 ${bearishCount} <span class="stock-pick-metric-caret">▾</span>
                  </button>
                </div>
                ${renderPickNewsPanel(bullishArticles, "bullish", idx, bullishCount, item.ticker, item.market)}
                ${renderPickNewsPanel(bearishArticles, "bearish", idx, bearishCount, item.ticker, item.market)}
                <p class="stock-pick-reason">${escapeHtml(item.reason)}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    `;

    bindPickCards(listEl);
  }

  function fallbackRecommendLabel(score, bullish, bearish) {
    if (bearish >= 2 && bearish > bullish) return { label: "주의", stance: "caution", recommended: false };
    if (score >= 4) return { label: "추천", stance: "recommend", recommended: true };
    return { label: "관망", stance: "watch", recommended: false };
  }

  async function buildPicksFromHeadlines(market) {
    const headlineMarket = market === "us" ? "us" : "kr";
    const universe = PICK_UNIVERSE[market] || [];
    const universeSet = new Set(universe.map(([ticker]) => ticker));
    const data = await fetchHeadlines(headlineMarket);
    const cutoff = Math.floor(Date.now() / 1000) - 7 * 86400;
    const scores = new Map();

    for (const [ticker, name] of universe) {
      scores.set(ticker, {
        rank: scores.size + 1,
        ticker,
        name,
        market: headlineMarket,
        bullishNews: 0,
        bearishNews: 0,
        bullishArticles: [],
        bearishArticles: [],
        score: 0
      });
    }

    const articlePayload = (item, sentiment, label) => {
      const payload = {
        title: item.title || "",
        summaryShort: item.summaryShort || item.summary || "",
        publishedAt: item.publishedAt,
        link: item.link,
        sentiment,
        sentimentLabel: label
      };
      if (item.imageUrl) payload.imageUrl = item.imageUrl;
      return payload;
    };

    for (const item of data.items || []) {
      if (item.publishedAt && item.publishedAt < cutoff) continue;
      const tickers = new Set([item.sourceTicker, ...(item.relatedTickers || [])].filter(Boolean));
      for (const ticker of tickers) {
        if (!universeSet.has(ticker)) continue;
        const entry = scores.get(ticker);
        if (!entry) continue;
        if (item.sentiment === "bullish") {
          entry.bullishNews += 1;
          if (entry.bullishArticles.length < 5) {
            entry.bullishArticles.push(articlePayload(item, "bullish", item.sentimentLabel || "호재"));
          }
        } else if (item.sentiment === "bearish") {
          entry.bearishNews += 1;
          if (entry.bearishArticles.length < 5) {
            entry.bearishArticles.push(articlePayload(item, "bearish", item.sentimentLabel || "악재"));
          }
        }
        entry.score = entry.bullishNews * 3 - entry.bearishNews * 2;
      }
    }

    return universe.map(([ticker, name], idx) => {
      const row = scores.get(ticker) || {
        ticker,
        name,
        market: headlineMarket,
        bullishNews: 0,
        bearishNews: 0,
        bullishArticles: [],
        bearishArticles: [],
        score: 0
      };
      const status = fallbackRecommendLabel(row.score, row.bullishNews, row.bearishNews);
      const pickItem = {
        ticker,
        name,
        market: headlineMarket
      };
      const logoUrls = pickLogoUrlList(pickItem);
      return {
        rank: idx + 1,
        ticker,
        name,
        market: headlineMarket,
        score: row.score,
        recommended: status.recommended,
        recommendLabel: status.label,
        stance: status.stance,
        stanceLabel: status.label,
        price: null,
        changePct: null,
        bullishNews: row.bullishNews,
        bearishNews: row.bearishNews,
        bullishArticles: row.bullishArticles,
        bearishArticles: row.bearishArticles,
        newsWindowDays: 7,
        imageUrl: logoUrls[0] || null,
        reason: `최근 7일 뉴스 분석 — 호재 ${row.bullishNews}건 · 악재 ${row.bearishNews}건`
      };
    });
  }

  async function loadRecommendations(root, market, options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const fromTab = options.fromTab === true;
    const listEl = root.querySelector("#stock-picks-list");
    const statusEl = root.querySelector("#stock-picks-status");

    activePicksMarket = market;
    root.querySelectorAll(".stock-picks-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.market === market);
    });

    if (fromTab && picksBundleMemory) {
      const tabData = marketPayloadFromBundle(picksBundleMemory, market);
      if (tabData?.items?.length) {
        const label = picksBundleMemory.trigger === "live" ? "실시간 데이터" : "저장된 스냅샷";
        showPicksResult(root, listEl, statusEl, tabData, picksBundleMemory, label);
        return;
      }
    }

    if (forceRefresh) {
      if (isGuestMode()) {
        setStatus(statusEl, GUEST_REFRESH_MSG, "info");
        return;
      }
      await refreshPicksLive(root, market);
      return;
    }

    let showedStale = false;
    const cachedBundle = picksBundleMemory || readPicksCache();
    if (cachedBundle) {
      const label = cachedBundle.trigger === "live" ? "저장된 데이터" : "이전 스냅샷";
      showedStale = showStaleFromBundle(root, listEl, statusEl, cachedBundle, market, label);
    }

    if (!showedStale) {
      setUpdating(root, true, {
        message: "스냅샷 데이터를 불러오는 중… 잠시만 기다려 주세요."
      });
      listEl.innerHTML = `<p class="stock-loading">추천 종목을 불러오는 중…</p>`;
      setStatus(statusEl, "", "");
      try {
        const staticBundle = await fetchStaticPicksBundle(false);
        showedStale = showStaleFromBundle(root, listEl, statusEl, staticBundle, market, "GitHub 스냅샷");
      } catch (_) {
        /* static snapshot optional */
      } finally {
        setUpdating(root, false);
      }
    }

    if (isGuestMode()) return;

    if (usesLiveRefresh()) {
      if (!picksSessionAutoLiveDone || !showedStale) {
        picksSessionAutoLiveDone = true;
        await refreshPicksLive(root, market);
      }
    } else if (!showedStale && usesPicksApi()) {
      await refreshPicksLive(root, market);
    }
  }

  function renderStockPicksGate(container, message, detail) {
    container.innerHTML = `
      <article class="content-panel stock-panel stock-picks-gate">
        <h2>Stock Picks</h2>
        <p class="stock-picks-gate-message">${escapeHtml(message)}</p>
        ${detail ? `<p class="stock-picks-gate-detail">${escapeHtml(detail)}</p>` : ""}
        <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · ↺ 새로고침 1개 추가 · 잔액 0이면 다음날(한국 시간) 3개 충전</p>
      </article>
    `;
  }

  async function ensureStockPicksAccess() {
    if (isGuestMode()) {
      return { ok: true, guest: true };
    }

    if (!window.Digimon?.spendForStockPicks) {
      return { ok: false, message: "Digi-Mon 모듈을 불러오지 못했습니다.", detail: null };
    }

    const spendResult = await window.Digimon.spendForStockPicks();
    if (!spendResult.ok) {
      return {
        ok: false,
        message: spendResult.error || "Stock Picks를 열 수 없습니다.",
        detail: `보유 Digi-Mon: ${window.Digimon.format(spendResult.balance)}개`
      };
    }

    return { ok: true, balance: spendResult.balance };
  }

  function mountStockPicksPage(container) {
    picksSessionAutoLiveDone = false;

    container.innerHTML = `
      <article class="content-panel stock-panel">
        <div class="stock-header">
          <div>
            <h2>Stock Picks</h2>
            <p class="stock-intro">시가총액 상위 10종목 · 최근 7일 뉴스 분석 · 열람 Digi-Mon 1개 · ↺ 새로고침 1개</p>
          </div>
          <button type="button" class="secondary-btn" id="stock-picks-refresh-btn" title="새로고침">↺ 새로고침</button>
        </div>
        <div class="stock-tabs stock-picks-tabs" role="tablist" aria-label="시장 필터">
          ${PICK_MARKETS.map(
            (m) =>
              `<button type="button" class="stock-tab stock-picks-tab${m.id === "kr_kospi" ? " active" : ""}" data-market="${m.id}" role="tab">${m.label}</button>`
          ).join("")}
        </div>
        <p id="stock-picks-last-updated" class="stock-last-updated" hidden>마지막 업데이트: —</p>
        <p id="stock-picks-status" class="stock-status" hidden></p>
        <div class="stock-body">
          <div id="stock-update-overlay" class="stock-update-overlay" hidden role="status" aria-live="polite">
            <span class="stock-update-spinner" aria-hidden="true"></span>
            <span id="stock-update-elapsed" class="stock-update-elapsed">0초</span>
            <span id="stock-update-message" class="stock-update-overlay-msg">실시간 분석 중… 잠시만 기다려 주세요. (최대 약 1분)</span>
          </div>
          <div id="stock-picks-list" class="stock-picks-list"></div>
        </div>
        <p class="stock-footnote">정기 스냅샷 기반 참고용이며 투자 권유가 아닙니다. 실제 투자 결정은 본인 책임입니다.</p>
      </article>
    `;

    const root = container.querySelector(".stock-panel") || container;

    const introEl = root.querySelector(".stock-intro");
    if (introEl && isGuestMode()) {
      introEl.textContent =
        "Guest 모드 — 저장된 추천 데이터를 볼 수 있습니다. ↺ 새로고침·실시간 분석은 로그인 후 이용하세요.";
    }

    if (lastPicksUpdatedAt) {
      const updatedEl = root.querySelector("#stock-picks-last-updated");
      if (updatedEl) {
        updatedEl.textContent = `마지막 업데이트: ${formatLastUpdated(lastPicksUpdatedAt)}`;
        updatedEl.hidden = false;
      }
    }

    root.querySelectorAll(".stock-picks-tab").forEach((btn) => {
      btn.addEventListener("click", () => loadRecommendations(root, btn.dataset.market, { fromTab: true }));
    });

    root.querySelector("#stock-picks-refresh-btn")?.addEventListener("click", async () => {
      const statusEl = root.querySelector("#stock-picks-status");
      if (isGuestMode()) {
        setStatus(statusEl, GUEST_REFRESH_MSG, "info");
        return;
      }
      const spendResult = await window.Digimon?.spendForStockPicksRefresh?.();
      if (!spendResult?.ok) {
        setStatus(statusEl, spendResult?.error || "Digi-Mon이 부족합니다.", "error");
        return;
      }
      await loadRecommendations(root, activePicksMarket, { forceRefresh: true });
    });

    loadRecommendations(root, activePicksMarket);
    applyGuestRefreshControls(root);
  }

  async function renderStockPicksPage(container) {
    container.innerHTML = `<p class="stock-loading">Stock Picks 접근 확인 중…</p>`;
    const access = await ensureStockPicksAccess();
    if (!access.ok) {
      renderStockPicksGate(container, access.message, access.detail);
      return;
    }
    mountStockPicksPage(container);
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

  function showCachedHeadlines(root, listEl, market) {
    const cached = headlinesCache[market];
    if (!cached?.items?.length) return false;
    renderItems(listEl, cached.items);
    if (cached.fetchedAt) {
      setLastUpdated(root, cached.fetchedAt);
    }
    return true;
  }

  async function loadHeadlines(root, market) {
    const listEl = root.querySelector("#stock-headline-list");
    const statusEl = root.querySelector("#stock-status");
    const requestId = ++headlinesRequestId;

    activeMarket = market;
    root.querySelectorAll(".stock-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.market === market);
    });

    const hadCache = showCachedHeadlines(root, listEl, market);
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
      setStatus(statusEl, `${data.count}건의 헤드라인${cacheNote}`, "info");
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
      loadHeadlines(root, activeMarket);
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
