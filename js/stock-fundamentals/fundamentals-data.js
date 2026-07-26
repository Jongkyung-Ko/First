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
  const KR_MARKET_KEYS = new Set(["kospi", "kosdaq"]);

  /** KOSPI·KOSDAQ Re — 휴장 무관, 현재 탭 1시장만. 미국은 열린 시장 필터 유지. */
  function resolveFundamentalsReSteps(activeMarket) {
    const market = activeMarket || "kospi";
    const tabStep = LIVE_SCAN_STEPS.find((step) => step.region === market);
    if (KR_MARKET_KEYS.has(market) && tabStep) {
      return { steps: [tabStep], mode: "tab", market };
    }
    const lock = window.StockScanLock;
    if (!lock?.resolveOpenMarketScanSteps) {
      return { steps: tabStep ? [tabStep] : LIVE_SCAN_STEPS, mode: "open" };
    }
    return lock.resolveOpenMarketScanSteps(LIVE_SCAN_STEPS, market);
  }

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
    const historyLen = payload.history?.length || 0;
    if (historyLen > 0) score += 50000 + Math.min(historyLen, 400);
    if (payload.source === "live") score += 10000;
    if (payload.source === "global_snapshot") score += 8000;
    if (payload.source === "snapshot" && score > 0) score += 100;
    return score;
  }

  function isPlaceholderPayload(payload) {
    if (!payload || payload.empty === true || payload.source === "placeholder") return true;
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

  const KR_RE_CHUNK_SIZE = 5;
  const KR_CHUNK_TIMEOUT_MS = 120000;

  async function fetchLiveKrChunked({
    base,
    activeMarket,
    signal,
    onProgress,
    onPartial,
    pageId
  }) {
    const step = LIVE_SCAN_STEPS.find((s) => s.region === activeMarket);
    const label = step?.label || activeMarket.toUpperCase();
    const prior = readBestCache();
    const universeSize =
      prior?.markets?.[activeMarket]?.universeSize ||
      (activeMarket === "kospi" ? 176 : activeMarket === "kosdaq" ? 160 : 200);
    const totalChunks = Math.max(1, Math.ceil(universeSize / KR_RE_CHUNK_SIZE));

    let offset = 0;
    let scanJobId = null;
    let payload = null;
    let chunkIndex = 0;

    while (offset < universeSize) {
      chunkIndex += 1;
      onProgress?.({
        step: chunkIndex,
        total: totalChunks,
        region: activeMarket,
        label: `${label} · DART PBR`
      });

      const params = new URLSearchParams({
        force: "true",
        region: activeMarket,
        chunk: "true",
        offset: String(offset),
        limit: String(KR_RE_CHUNK_SIZE),
        fast: "false"
      });
      if (scanJobId) params.set("scan_job_id", scanJobId);

      payload = await fetchApiUrl(`${base}/api/stock-fundamentals?${params}`, {
        signal,
        timeoutMs: KR_CHUNK_TIMEOUT_MS
      });
      scanJobId = payload?.scanJob?.id || scanJobId;
      if (payload) onPartial?.(payload);

      const chunkMeta = payload?.chunk || payload?.chunkResult || {};
      if (chunkMeta.done) break;
      const next = Number(chunkMeta.nextOffset);
      if (!Number.isFinite(next) || next <= offset) break;
      offset = next;
    }

    if (!payload) {
      throw new Error("청크 스캔 결과가 없습니다.");
    }
    return payload;
  }

  async function fetchLive({ signal, onProgress, onPartial, pageId, activeMarket } = {}) {
    const base = getApiBase();
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");

    if (KR_MARKET_KEYS.has(activeMarket)) {
      const payload = await fetchLiveKrChunked({
        base,
        activeMarket,
        signal,
        onProgress,
        onPartial,
        pageId
      });
      return payload;
    }

    const lock = window.StockScanLock;
    if (!lock) throw new Error("StockScanLock 모듈이 없습니다.");

    const scanScope = resolveFundamentalsReSteps(activeMarket);
    const result = await lock.runLiveScan({
      pageId: pageId || "fundamentals-per",
      signal,
      onProgress,
      onPartial,
      steps: scanScope.steps,
      buildUrl(region, scanJobId) {
        const params = new URLSearchParams({ force: "true", region });
        if (scanJobId) params.set("scan_job_id", scanJobId);
        return `${base}/api/stock-fundamentals?${params}`;
      }
    });
    result.scanScope = scanScope;

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

  async function load({
    forceLive = false,
    signal,
    preferCache = true,
    onProgress,
    onPartial,
    pageId,
    activeMarket
  } = {}) {
    const loader = window.SnapshotFirstLoad;
    if (!loader?.loadSnapshotFirst) {
      throw new Error("SnapshotFirstLoad 모듈이 없습니다.");
    }
    return loader.loadSnapshotFirst({
      forceLive,
      signal,
      pageId: pageId || "fundamentals-per",
      apiTimeoutMs: 45000,
      fetchLive: () => fetchLive({ signal, onProgress, onPartial, pageId, activeMarket }),
      fetchSnapshot,
      fetchApi: (apiSignal) => fetchApi(apiSignal, false),
      readCache: preferCache ? readBestCache : () => null,
      writeCache: writeCaches,
      isPlaceholder: isPlaceholderPayload,
      pickBetter: pickBetterPayload
    });
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
    resolveFundamentalsReSteps,
    LIVE_SCAN_STEPS,
    KR_MARKET_KEYS,
    SCAN_PAGE_IDS
  };

  window.StockFundamentalsData = {
    shared,
    LIVE_SCAN_STEPS,
    KR_MARKET_KEYS,
    resolveFundamentalsReSteps,
    SCAN_PAGE_IDS,
    payloadScore,
    isPlaceholderPayload
  };
})();
