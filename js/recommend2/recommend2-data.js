/**
 * 추천2 — 바닥매집 데이터 로드 (Stock Picks와 분리)
 */
(function () {
  const DEFAULT_JSON = "data/recommend2-bottom-accumulation.json";
  const SESSION_KEY = "recommend2-bottom-accumulation-v1";

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

  async function fetchSnapshot() {
    const base = getApiBase();
    if (!base) {
      return fetchStatic(false);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(`${base}/api/recommend2/bottom-accumulation?period=3mo`, {
        signal: controller.signal
      });
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
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchLive() {
    const base = getApiBase();
    if (!base) {
      throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    try {
      const res = await fetch(
        `${base}/api/recommend2/bottom-accumulation?period=3mo&force=true`,
        { signal: controller.signal }
      );
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
    } finally {
      clearTimeout(timer);
    }
  }

  window.Recommend2Data = {
    SESSION_KEY,
    fetchStatic,
    fetchSnapshot,
    fetchLive,
    readSessionCache,
    writeSessionCache
  };
})();
