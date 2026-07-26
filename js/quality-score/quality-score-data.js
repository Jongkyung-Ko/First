/**
 * 재무 종합 점수 — data loader
 */
(function () {
  const LOCAL_KEY = "dw_stock_quality_score_ls_v1";
  const LOCAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function payloadScore(payload) {
    if (!payload || payload.empty === true) return 0;
    let score = 0;
    const markets = payload.markets || {};
    for (const key of ["kospi", "kosdaq", "nasdaq", "nyse"]) {
      const block = markets[key];
      if (block?.qualityReady) score += 200;
      score += (block?.items?.length || 0);
    }
    if (payload.source === "global_snapshot") score += 5000;
    if (payload.source === "snapshot") score += 100;
    return score;
  }

  function isPlaceholderPayload(payload) {
    if (!payload || payload.empty === true) return true;
    return payloadScore(payload) <= 0;
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const ts = parsed?.savedAtMs || 0;
      if (Date.now() - ts > LOCAL_TTL_MS) return null;
      return parsed.payload || null;
    } catch {
      return null;
    }
  }

  function writeLocal(payload) {
    try {
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({ savedAtMs: Date.now(), payload })
      );
    } catch {
      /* ignore */
    }
  }

  async function fetchJsonUrl(url, { timeoutMs = 120000, signal } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    try {
      const res = await fetch(url, { signal: controller.signal, cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }

  async function loadPayload({ signal } = {}) {
    const staticUrl = window.STOCK_QUALITY_SCORE_JSON_URL || "data/stock-quality-score.json";
    const apiBase = getApiBase();
    let best = readLocal();

    if (apiBase) {
      try {
        const apiPayload = await fetchJsonUrl(`${apiBase}/api/stock-quality-score`, { signal });
        if (!isPlaceholderPayload(apiPayload)) {
          writeLocal(apiPayload);
          return apiPayload;
        }
        if (!best) best = apiPayload;
      } catch {
        /* fallback */
      }
    }

    try {
      const staticPayload = await fetchJsonUrl(staticUrl, { signal });
      if (payloadScore(staticPayload) > payloadScore(best)) {
        writeLocal(staticPayload);
        return staticPayload;
      }
    } catch {
      /* ignore */
    }

    return best || { empty: true, markets: {} };
  }

  window.QualityScoreData = {
    loadPayload,
    payloadScore,
    isPlaceholderPayload
  };
})();
