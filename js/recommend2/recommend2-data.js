/**
 * 추천2 — 바닥매집 데이터 로드 (Stock Picks와 분리)
 */
(function () {
  const DEFAULT_JSON = "data/recommend2-bottom-accumulation.json";
  const SESSION_KEY = "recommend2-bottom-accumulation-v1";

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

  function writeSessionCache(payload) {
    try {
      if (payload) sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (_) {
      /* quota */
    }
  }

  async function fetchStatic(bust) {
    const res = await fetch(getJsonUrl(bust), { cache: bust ? "no-store" : "default" });
    if (!res.ok) {
      throw new Error(`스냅샷을 불러오지 못했습니다 (HTTP ${res.status})`);
    }
    return res.json();
  }

  async function fetchApiUrl(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
        throw new Error(`요청 시간 초과 (${Math.round(timeoutMs / 1000)}초)`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchSnapshot() {
    const base = getApiBase();
    if (!base) {
      return fetchStatic(false);
    }
    return fetchApiUrl(`${base}/api/recommend2/bottom-accumulation?period=3mo`, 90000);
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
      return market && typeof market.signalCount === "number";
    });
  }

  async function fetchLive(onProgress, onPartial) {
    const base = getApiBase();
    if (!base) {
      throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    }

    let payload = null;
    for (let i = 0; i < LIVE_SCAN_STEPS.length; i += 1) {
      const step = LIVE_SCAN_STEPS[i];
      onProgress?.({
        step: i + 1,
        total: LIVE_SCAN_STEPS.length,
        region: step.region,
        label: step.label
      });
      payload = await fetchLiveRegion(step.region, { retries: 1 });
      if (payload) onPartial?.(payload);

      // 구 API: region 무시·전체 스캔 한 번에 완료
      if (!payload?.scanRegion && marketsComplete(payload)) {
        return payload;
      }
      // 신 API: 요청한 시장만 스캔했으면 다음 시장 진행
      if (payload?.scanRegion === step.region) {
        continue;
      }
      if (marketsComplete(payload)) {
        return payload;
      }
    }
    if (!payload) {
      throw new Error("실시간 스캔 결과가 없습니다.");
    }
    return payload;
  }

  window.Recommend2Data = {
    SESSION_KEY,
    LIVE_SCAN_STEPS,
    fetchStatic,
    fetchSnapshot,
    fetchLive,
    fetchLiveRegion,
    readSessionCache,
    writeSessionCache
  };
})();
