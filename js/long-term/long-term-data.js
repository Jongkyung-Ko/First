/**
 * Long-term screens data — server snapshot (no Re)
 */
(function () {
  const SESSION_KEY = "dw_long_term_screens_v3";

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  }

  function writeCache(payload) {
    if (!payload) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      /* quota */
    }
  }

  async function fetchApi(signal) {
    const base = getApiBase();
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    const res = await fetch(`${base}/api/long-term/screens`, { signal, cache: "no-cache" });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch {
        /* noop */
      }
      throw new Error(detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function load({ signal, preferCache = true, pageId } = {}) {
    const cached = preferCache ? readCache() : null;
    try {
      const payload = await fetchApi(signal);
      writeCache(payload);
      const pid = pageId || "long-term-screens";
      if (payload && window.StockScanLock?.recordPagePayload) {
        window.StockScanLock.recordPagePayload(pid, payload);
      }
      return payload;
    } catch (err) {
      if (cached) return cached;
      throw err;
    }
  }

  window.LongTermData = {
    load,
    readCache,
    writeCache,
    fetchApi
  };
})();
