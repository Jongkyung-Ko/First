/**
 * 추천2 — 바닥매집 데이터 로드 (Stock Picks와 분리)
 */
(function () {
  const DEFAULT_JSON = "data/recommend2-bottom-accumulation.json";
  const SESSION_KEY = "recommend2-bottom-accumulation-v3";
  const LOCAL_KEY = "recommend2-bottom-accumulation-ls-v1";
  const LOCAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const LEGACY_SESSION_KEY = "recommend2-bottom-accumulation-v2";

  const LIVE_SCAN_STEPS = [
    { region: "kospi", label: "KOSPI" },
    { region: "kosdaq", label: "KOSDAQ" },
    { region: "nasdaq", label: "NASDAQ" },
    { region: "nyse", label: "NYSE" }
  ];

  function getJsonUrl(bust) {
    const path = window.RECOMMEND2_JSON_URL || DEFAULT_JSON;
    const url = new URL(path, window.location.href);
    if (bust) url.searchParams.set("t", String(Date.now()));
    return url.href;
  }

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function payloadScore(payload) {
    if (!payload || payload.empty === true || payload.source === "placeholder") return 0;
    let score = 0;
    const markets = payload.markets || {};
    for (const key of ["kospi", "kosdaq", "nasdaq", "nyse"]) {
      const block = markets[key] || {};
      score += Number(block.recentCount || block.recentSignals?.length || 0);
      score += Number(block.activeCount || block.activeSignals?.length || 0) * 2;
    }
    score += Number(payload.recentCount || payload.recentSignals?.length || 0);
    if (payload.source === "live") score += 10000;
    if (payload.source === "global_snapshot") score += 8000;
    if (payload.source === "latest_run") score += 5000;
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
    const ta = Date.parse(a.updatedAt || a.updatedAtKst || a.savedAt || 0) || 0;
    const tb = Date.parse(b.updatedAt || b.updatedAtKst || b.savedAt || 0) || 0;
    return tb >= ta ? b : a;
  }

  function readSessionCache() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch (_) {
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
    } catch (_) {
      return null;
    }
  }

  function writeCaches(payload) {
    if (!payload || isPlaceholderPayload(payload)) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (_) {
      /* quota */
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
    } catch (_) {
      /* quota */
    }
    try {
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    } catch (_) {
      /* ignore */
    }
  }

  function writeSessionCache(payload) {
    writeCaches(payload);
  }

  function readBestCache() {
    return pickBetterPayload(readSessionCache(), readLocalCache());
  }

  async function fetchStatic(bust, signal) {
    const res = await fetch(getJsonUrl(bust), {
      signal,
      cache: bust ? "no-store" : "no-cache"
    });
    if (!res.ok) {
      throw new Error(`스냅샷을 불러오지 못했습니다 (HTTP ${res.status})`);
    }
    return res.json();
  }

  async function fetchApiUrl(url, timeoutMs, signal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    try {
      const res = await fetch(url, { signal: controller.signal });
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

  async function fetchSnapshot(signal) {
    return fetchStatic(false, signal);
  }

  async function fetchApi(signal) {
    const base = getApiBase();
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    return fetchApiUrl(
      `${base}/api/recommend2/bottom-accumulation?period=3mo`,
      28000,
      signal
    );
  }

  /** @deprecated API 우선 — load() 사용 권장 */
  async function fetchSnapshotLegacy() {
    const base = getApiBase();
    if (!base) {
      return fetchStatic(false);
    }
    return fetchApiUrl(`${base}/api/recommend2/bottom-accumulation?period=3mo&_t=${Date.now()}`, 90000);
  }

  async function fetchLiveRegion(region, { retries = 1 } = {}) {
    const base = getApiBase();
    if (!base) {
      throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    }
    const url = `${base}/api/recommend2/bottom-accumulation?period=3mo&force=true&region=${encodeURIComponent(region)}`;
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fetchApiUrl(url, 180000);
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    throw lastErr;
  }

  function marketsComplete(payload) {
    return LIVE_SCAN_STEPS.every((step) => {
      const market = payload?.markets?.[step.region];
      return (
        market &&
        (typeof market.recentCount === "number" ||
          typeof market.activeCount === "number" ||
          typeof market.signalCount === "number")
      );
    });
  }

  async function fetchLiveRegionChunked(
    region,
    { base, lock, signal, scanJobId, onProgress, onPartial, stepIndex, totalSteps, label, isLastStep }
  ) {
    const RE_CHUNK_SIZE = 25;
    const RE_CHUNK_TIMEOUT_MS = 180000;
    const prior = readBestCache();
    const universeSize = prior?.markets?.[region]?.universeSize || 100;
    const totalChunks = Math.max(1, Math.ceil(universeSize / RE_CHUNK_SIZE));
    let offset = 0;
    let payload = null;
    let jobId = scanJobId;
    let chunkIndex = 0;

    while (offset < universeSize) {
      chunkIndex += 1;
      onProgress?.({
        step: stepIndex,
        total: totalSteps,
        region,
        label: `${label} · ${chunkIndex}/${totalChunks}`
      });

      const params = new URLSearchParams({
        period: "3mo",
        force: "true",
        region,
        chunk: "true",
        offset: String(offset),
        limit: String(RE_CHUNK_SIZE)
      });
      if (!jobId && totalSteps) params.set("scan_total_steps", String(totalSteps));
      if (isLastStep && offset + RE_CHUNK_SIZE >= universeSize) {
        params.set("session_complete", "true");
      }
      if (jobId) params.set("scan_job_id", jobId);

      payload = await lock.fetchForceUrl(`${base}/api/recommend2/bottom-accumulation?${params}`, {
        scanJobId: jobId,
        signal,
        timeoutMs: RE_CHUNK_TIMEOUT_MS
      });
      jobId = payload?.scanJob?.id || jobId;
      if (payload) onPartial?.(payload);

      const chunkMeta = payload?.chunk || {};
      if (chunkMeta.done || chunkMeta.finalize) break;
      const next = Number(chunkMeta.nextOffset);
      if (!Number.isFinite(next) || next <= offset) break;
      offset = next;
    }

    if (!payload) {
      throw new Error("청크 스캔 결과가 없습니다.");
    }
    return payload;
  }

  async function fetchLive(onProgress, onPartial, signal) {
    const base = getApiBase();
    if (!base) {
      throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    }
    const lock = window.StockScanLock;
    if (!lock) {
      throw new Error("StockScanLock 모듈이 없습니다.");
    }

    const result = await lock.runLiveScan({
      pageId: "recommend2",
      signal,
      steps: (lock.resolveOpenMarketScanSteps
        ? lock.resolveOpenMarketScanSteps(lock.LIVE_SCAN_STEPS || LIVE_SCAN_STEPS).steps
        : LIVE_SCAN_STEPS),
      onProgress,
      onPartial,
      fetchStep(step, scanJobId, stepMeta) {
        return fetchLiveRegionChunked(step.region, {
          base,
          lock,
          signal,
          scanJobId,
          onProgress,
          onPartial,
          stepIndex: stepMeta.stepIndex,
          totalSteps: stepMeta.totalSteps,
          label: step.label,
          isLastStep: stepMeta.isLastStep
        });
      }
    });

    if (result.joined) {
      return load({ signal });
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
    staleWhileRevalidate = false,
    onFresh
  } = {}) {
    const loader = window.SnapshotFirstLoad;
    if (!loader?.loadSnapshotFirst) {
      throw new Error("SnapshotFirstLoad 모듈이 없습니다.");
    }
    return loader.loadSnapshotFirst({
      forceLive,
      signal,
      pageId: "recommend2",
      fetchLive: () => fetchLive(onProgress, onPartial, signal),
      fetchSnapshot,
      fetchApi,
      readCache: preferCache ? readBestCache : () => null,
      writeCache: writeCaches,
      isPlaceholder: isPlaceholderPayload,
      pickBetter: pickBetterPayload,
      staleWhileRevalidate,
      onFresh
    });
  }

  window.Recommend2Data = {
    SESSION_KEY,
    LOCAL_KEY,
    LIVE_SCAN_STEPS,
    payloadScore,
    isPlaceholderPayload,
    pickBetterPayload,
    fetchStatic,
    fetchSnapshot,
    fetchSnapshotLegacy,
    fetchApi,
    fetchLive,
    fetchLiveRegion,
    load,
    readSessionCache,
    readLocalCache,
    writeSessionCache,
    writeCaches,
    readBestCache
  };
})();
