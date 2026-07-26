/**
 * 단기추천로직 Re(force live) — maspro79@naver.com 전용
 */
(function () {
  const SHORT_TERM_PAGE_IDS = new Set([
    "stock-picks",
    "recommend2",
    "strategy-golden",
    "strategy-bollinger",
    "strategy-rsi",
    "strategy-candle-support",
    "strategy-obv",
    "strategy-bottom",
    "strategy-vcp"
  ]);

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function forceEmail() {
    return normalizeEmail(
      window.SHORT_TERM_FORCE_EMAIL ||
        window.FUNDAMENTALS_FORCE_EMAIL ||
        "maspro79@naver.com"
    );
  }

  function canShortTermLiveRe(session) {
    if (!session?.user?.email) return false;
    return normalizeEmail(session.user.email) === forceEmail();
  }

  function isShortTermPage(pageId) {
    return !!pageId && SHORT_TERM_PAGE_IDS.has(pageId);
  }

  function getKstParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return {
      weekday: get("weekday"),
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hour: Number(get("hour")),
      minute: Number(get("minute"))
    };
  }

  /** 한국 정규장 09:00–15:30 KST (주말 제외) */
  function isKrMarketOpen() {
    const parts = getKstParts();
    if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
    const minutes = parts.hour * 60 + parts.minute;
    return minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
  }

  function collectKrRecommendationTickers(payload) {
    const tickers = new Set();
    const visited = new WeakSet();

    function visit(value) {
      if (!value || typeof value !== "object" || visited.has(value)) return;
      visited.add(value);
      if (typeof value.ticker === "string" && /\.(KS|KQ)$/i.test(value.ticker)) {
        tickers.add(value.ticker.toUpperCase());
      }
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else {
        Object.values(value).forEach(visit);
      }
    }

    visit(payload);
    return [...tickers].slice(0, 200);
  }

  function clonePayload(payload) {
    if (typeof structuredClone === "function") return structuredClone(payload);
    return JSON.parse(JSON.stringify(payload));
  }

  function applyKrLivePrices(payload, response) {
    const next = clonePayload(payload);
    const prices = response?.prices || {};
    const updatedAt = response?.updatedAt || new Date().toISOString();
    const visited = new WeakSet();

    function visit(value) {
      if (!value || typeof value !== "object" || visited.has(value)) return;
      visited.add(value);
      const ticker = typeof value.ticker === "string" ? value.ticker.toUpperCase() : "";
      const price = Number(prices[ticker]?.price);
      const entry = Number(value.entryClose ?? value.close);
      if (ticker && Number.isFinite(price) && price > 0) {
        value.livePrice = price;
        value.livePriceAt = updatedAt;
        if (Number.isFinite(entry) && entry > 0) {
          value.liveReturnPct = Number((((price / entry) - 1) * 100).toFixed(4));
        }
      }
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else {
        Object.values(value).forEach(visit);
      }
    }

    visit(next);
    next.livePriceUpdatedAt = updatedAt;
    next.livePriceRequestedCount = Number(response?.requestedCount || 0);
    next.livePriceUpdatedCount = Number(response?.updatedCount || 0);
    return next;
  }

  async function refreshKrLivePrices(payload, { signal, timeoutMs = 30000 } = {}) {
    const base = String(window.STOCK_API_URL || "").replace(/\/$/, "");
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    const token = window.Auth?.getSession?.()?.access_token;
    if (!token) throw new Error("로그인이 필요합니다.");
    const tickers = collectKrRecommendationTickers(payload);
    if (!tickers.length) {
      return { payload, requestedCount: 0, updatedCount: 0 };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const res = await fetch(`${base}/api/stock-picks/live-prices`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tickers })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof body?.detail === "string" ? body.detail : body?.detail?.message;
        throw new Error(detail || `현재가 조회 실패 (HTTP ${res.status})`);
      }
      return {
        payload: applyKrLivePrices(payload, body),
        requestedCount: Number(body.requestedCount || 0),
        updatedCount: Number(body.updatedCount || 0),
        updatedAt: body.updatedAt || null
      };
    } catch (err) {
      if (err?.name === "AbortError") {
        if (signal?.aborted) throw err;
        throw new Error("현재가 조회 시간이 초과되었습니다.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }

  function hasFreshKrLivePrice(sig) {
    if (!sig?.livePriceAt || !isKrMarketOpen()) return false;
    const updated = new Date(sig.livePriceAt);
    if (Number.isNaN(updated.getTime())) return false;
    return getKstParts(updated).date === getKstParts().date;
  }

  /** @param {HTMLElement|null} root */
  function syncShortTermReButton(root, btnSelector, opts = {}) {
    const btn = root?.querySelector?.(btnSelector);
    if (!btn) return;
    const session = window.Auth?.getSession?.();
    if (!session || !canShortTermLiveRe(session)) {
      btn.hidden = true;
      btn.setAttribute("aria-hidden", "true");
      return;
    }
    btn.hidden = false;
    btn.removeAttribute("aria-hidden");
    btn.title = opts.title || "운영자 실시간 스캔 (4시장 · 장중 점검용)";
  }

  window.StockLiveAuth = {
    SHORT_TERM_PAGE_IDS,
    canShortTermLiveRe,
    isShortTermPage,
    isKrMarketOpen,
    collectKrRecommendationTickers,
    applyKrLivePrices,
    refreshKrLivePrices,
    hasFreshKrLivePrice,
    syncShortTermReButton
  };
})();
