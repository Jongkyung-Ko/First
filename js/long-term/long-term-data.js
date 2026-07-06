/**
 * Long-term screens data — server snapshot (no Re)
 */
(function () {
  const CACHE_KEY = "dw_long_term_screens_v5";
  const LEGACY_SESSION_KEY = "dw_long_term_screens_v4";

  let prefetchPromise = null;

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function cacheTimestamp(payload) {
    const raw = payload?.lastChunkAt || payload?.updatedAt;
    if (!raw) return 0;
    const ms = new Date(raw).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }

  function isUsablePayload(data) {
    return !!(data?.strategies && typeof data.strategies === "object");
  }

  function parseCache(raw) {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  }

  function readSessionCache() {
    return parseCache(sessionStorage.getItem(CACHE_KEY));
  }

  function readLocalCache() {
    return parseCache(localStorage.getItem(CACHE_KEY));
  }

  function readBestCache() {
    const session = readSessionCache();
    const local = readLocalCache();
    if (session && local) {
      return cacheTimestamp(session) >= cacheTimestamp(local) ? session : local;
    }
    return session || local || null;
  }

  function readCache() {
    return readBestCache();
  }

  function writeCaches(payload) {
    if (!payload) return;
    const raw = JSON.stringify(payload);
    try {
      sessionStorage.setItem(CACHE_KEY, raw);
    } catch {
      /* quota */
    }
    try {
      localStorage.setItem(CACHE_KEY, raw);
    } catch {
      /* quota */
    }
    try {
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  function writeCache(payload) {
    writeCaches(payload);
  }

  function recordPagePayload(pageId, payload) {
    const pid = pageId || "long-term-screens";
    if (payload && window.StockScanLock?.recordPagePayload) {
      window.StockScanLock.recordPagePayload(pid, payload);
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

  async function refreshInBackground({ pageId, signal, onFresh } = {}) {
    const payload = await fetchApi(signal);
    writeCaches(payload);
    recordPagePayload(pageId, payload);
    if (typeof onFresh === "function") onFresh(payload);
    return payload;
  }

  async function load({
    signal,
    preferCache = true,
    pageId,
    staleWhileRevalidate = false,
    onFresh
  } = {}) {
    const cached = preferCache ? readBestCache() : null;
    if (cached && staleWhileRevalidate && isUsablePayload(cached)) {
      void refreshInBackground({ pageId, signal, onFresh }).catch(() => {});
      recordPagePayload(pageId, cached);
      return cached;
    }
    try {
      const payload = await fetchApi(signal);
      writeCaches(payload);
      recordPagePayload(pageId, payload);
      return payload;
    } catch (err) {
      if (cached && isUsablePayload(cached)) return cached;
      throw err;
    }
  }

  function prefetchLongTermScreens() {
    if (!getApiBase()) return Promise.resolve(null);
    if (prefetchPromise) return prefetchPromise;
    const cached = readBestCache();
    prefetchPromise = (cached && isUsablePayload(cached)
      ? refreshInBackground({ pageId: "long-term-screens" })
      : fetchApi()
          .then((payload) => {
            if (isUsablePayload(payload)) writeCaches(payload);
            recordPagePayload("long-term-screens", payload);
            return payload;
          })
    )
      .catch(() => null)
      .finally(() => {
        prefetchPromise = null;
      });
    return prefetchPromise;
  }

  window.LongTermData = {
    load,
    readCache,
    readBestCache,
    writeCache,
    fetchApi,
    prefetchLongTermScreens
  };

  if (typeof window !== "undefined") {
    const runPrefetch = () => {
      if (!window.Auth?.getSession?.()) return;
      void prefetchLongTermScreens();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(runPrefetch, { timeout: 3000 });
    } else {
      setTimeout(runPrefetch, 1200);
    }
  }
})();
