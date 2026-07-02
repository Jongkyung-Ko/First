/**
 * Fundamentals data — PER / ROE / PBR / 배당 (4탭 공통 스냅샷)
 */
(function () {
  const SESSION_KEY = "dw_stock_fundamentals_v1";
  const LOCAL_KEY = "dw_stock_fundamentals_ls_v1";
  const LOCAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const SCAN_PAGE_IDS = new Set([
    "fundamentals-per",
    "fundamentals-roe",
    "fundamentals-pbr",
    "fundamentals-dividend"
  ]);

  const LIVE_SCAN_STEPS = [
    { region: "kospi", label: "KOSPI" },
    { region: "kosdaq", label: "KOSDAQ" },
    { region: "nasdaq", label: "NASDAQ" },
    { region: "nyse", label: "NYSE" }
  ];

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
      if (block?.fundamentalsReady) score += 100;
      const rankings = block?.rankings || {};
      for (const metric of ["per", "roe", "pbr", "dividend"]) {
        score += (rankings[metric]?.items?.length || 0) * 2;
      }
    }
    if (payload.source === "live") score += 10000;
    if (payload.source === "snapshot" && score > 0) score += 100;
    return score;
  }

  function isPlaceholderPayload(payload) {
    return payloadScore(payload) <= 0;
  }

  function pickBetterPayload(a, b) {
    if (!a) return b;
    if (!b) return a;
    const sa = payloadScore(a);
    const sb = payloadScore(b);
    if (sb > sa) return b;
    if (sa > sb) return a;
    const ta = Date.parse(a.updatedAt || a.savedAt || 0) || 0;
    const tb = Date.parse(b.updatedAt || b.savedAt || 0) || 0;
    return tb >= ta ? b : a;
  }

  function marketsComplete(payload, steps) {
    return (steps || LIVE_SCAN_STEPS).every((step) => {
      const market = payload?.markets?.[step.region];
      return !!(market && market.fundamentalsReady);
    });
  }

  async function fetchApiUrl(url, { timeoutMs = 360000, signal } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    const token = window.Auth?.getSession?.()?.access_token;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const res = await fetch(url, { signal: controller.signal, headers });
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const body = await res.json();
          detail = body.detail || detail;
        } catch {
          /* noop */
        }
        throw new Error(detail || `API HTTP ${res.status}`);
      }
      return res.json();
    } catch (err) {
      if (err.name === "AbortError") {
        if (signal?.aborted) throw err;
        throw new Error(`요청 시간 초과 (${Math.round(timeoutMs / 1000)}초)`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }

  function readSessionCache() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  }

  function readLocalCache() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      const wrap = JSON.parse(raw);
      if (!wrap || typeof wrap !== "object") return null;
      if (wrap.expiresAt && Date.now() > wrap.expiresAt) {
        localStorage.removeItem(LOCAL_KEY);
        return null;
      }
      return wrap.payload && typeof wrap.payload === "object" ? wrap.payload : null;
    } catch {
      return null;
    }
  }

  function writeCaches(payload) {
    if (!payload || isPlaceholderPayload(payload)) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({
          expiresAt: Date.now() + LOCAL_TTL_MS,
          savedAt: Date.now(),
          payload
        })
      );
    } catch {
      /* ignore */
    }
  }

  function readBestCache() {
    return pickBetterPayload(readSessionCache(), readLocalCache());
  }

  async function fetchSnapshot(signal) {
    const path = window.STOCK_FUNDAMENTALS_JSON_URL || "data/stock-fundamentals.json";
    const res = await fetch(path, { signal, cache: "no-cache" });
    if (!res.ok) throw new Error(`스냅샷 HTTP ${res.status}`);
    return res.json();
  }

  async function fetchApi(signal, force = false, region = "all", scanJobId = null) {
    const base = getApiBase();
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    const params = new URLSearchParams();
    if (force) {
      params.set("force", "true");
      params.set("region", region);
    }
    if (scanJobId) params.set("scan_job_id", scanJobId);
    const qs = params.toString();
    const url = `${base}/api/stock-fundamentals${qs ? `?${qs}` : ""}`;
    return fetchApiUrl(url, { signal });
  }

  async function fetchLive({ signal, onProgress, onPartial, pageId } = {}) {
    const base = getApiBase();
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    const lock = window.StockScanLock;
    if (!lock) throw new Error("StockScanLock 모듈이 없습니다.");

    const result = await lock.runLiveScan({
      pageId: pageId || "fundamentals-per",
      signal,
      onProgress,
      onPartial,
      buildUrl(region, scanJobId) {
        const params = new URLSearchParams({ force: "true", region });
        if (scanJobId) params.set("scan_job_id", scanJobId);
        return `${base}/api/stock-fundamentals?${params}`;
      }
    });

    if (result.joined) {
      return fetchApi(signal, false);
    }
    if (result.blocked) {
      const err = new Error("이미 스캔 중입니다.");
      err.code = "scan_busy_blocked";
      throw err;
    }
    if (!result.payload) {
      throw new Error("실시간 스캔 결과가 없습니다.");
    }
    return result.payload;
  }

  async function load({ forceLive = false, signal, preferCache = true, onProgress, onPartial, pageId } = {}) {
    const cached = preferCache ? readBestCache() : null;

    if (forceLive) {
      const live = await fetchLive({ signal, onProgress, onPartial, pageId });
      writeCaches(live);
      return live;
    }

    if (cached && !isPlaceholderPayload(cached)) {
      return cached;
    }

    let apiPayload = null;
    const base = getApiBase();
    if (base) {
      try {
        apiPayload = await fetchApi(signal, false);
      } catch {
        apiPayload = null;
      }
    }

    if (apiPayload && !isPlaceholderPayload(apiPayload)) {
      writeCaches(apiPayload);
      return apiPayload;
    }

    try {
      const snap = await fetchSnapshot(signal);
      if (!isPlaceholderPayload(snap)) {
        writeCaches(snap);
        return snap;
      }
    } catch {
      /* fall through */
    }

    if (cached) return cached;
    if (apiPayload) return apiPayload;

    try {
      return await fetchSnapshot(signal);
    } catch (snapErr) {
      if (base) {
        try {
          return await fetchApi(signal, false);
        } catch {
          throw snapErr;
        }
      }
      throw snapErr;
    }
  }

  const shared = {
    strategyId: "fundamentals",
    payloadScore,
    isPlaceholderPayload,
    pickBetterPayload,
    readSessionCache,
    readLocalCache,
    readBestCache,
    writeCaches,
    fetchLive,
    load,
    marketsComplete,
    LIVE_SCAN_STEPS,
    SCAN_PAGE_IDS
  };

  window.StockFundamentalsData = {
    shared,
    LIVE_SCAN_STEPS,
    SCAN_PAGE_IDS,
    payloadScore,
    isPlaceholderPayload
  };
})();
