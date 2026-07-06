/**
 * Render API(서버 공통 스냅샷) 우선 → GitHub 정적 JSON → 브라우저 캐시
 */
(function () {
  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function mergeAbortSignals(signal, controller) {
    if (!signal) return () => {};
    if (signal.aborted) {
      controller.abort();
      return () => {};
    }
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    return () => signal.removeEventListener("abort", onAbort);
  }

  function notifyPayloadLoaded(payload, opts) {
    const pageId = opts?.pageId;
    if (pageId && window.StockScanLock?.recordPagePayload) {
      window.StockScanLock.recordPagePayload(pageId, payload);
    }
  }

  /** API-only history — static JSON has no history field */
  function mergeApiHistory(best, apiPayload) {
    if (!best || !apiPayload?.history?.length) return best;
    const bestLen = best.history?.length || 0;
    const apiLen = apiPayload.history.length;
    if (bestLen >= apiLen) return best;
    return {
      ...best,
      history: apiPayload.history,
      historySummary: apiPayload.historySummary ?? best.historySummary
    };
  }

  /**
   * @param {object} opts
   * @param {boolean} [opts.forceLive]
   * @param {() => Promise<object>} [opts.fetchLive]
   * @param {(signal?: AbortSignal) => Promise<object>} opts.fetchSnapshot
   * @param {(signal?: AbortSignal) => Promise<object>} [opts.fetchApi]
   * @param {() => object|null} [opts.readCache]
   * @param {(payload: object) => void} [opts.writeCache]
   * @param {(payload: object|null|undefined) => boolean} opts.isPlaceholder
   * @param {(a: object|null|undefined, b: object|null|undefined) => object|null|undefined} opts.pickBetter
   * @param {AbortSignal} [opts.signal]
   * @param {number} [opts.apiTimeoutMs=28000]
   * @param {boolean} [opts.staleWhileRevalidate]
   * @param {(payload: object) => void} [opts.onFresh]
   */
  async function loadSnapshotFirst(opts) {
    const {
      forceLive = false,
      fetchLive,
      fetchSnapshot,
      fetchApi,
      readCache,
      writeCache,
      isPlaceholder,
      pickBetter,
      signal,
      apiTimeoutMs = 28000,
      staleWhileRevalidate = false,
      onFresh
    } = opts;

    if (forceLive) {
      if (!fetchLive) throw new Error("fetchLive is required when forceLive=true");
      const live = await fetchLive();
      if (writeCache) writeCache(live);
      notifyPayloadLoaded(live, opts);
      return live;
    }

    if (staleWhileRevalidate && readCache) {
      const cached = readCache();
      if (cached && !isPlaceholder(cached)) {
        notifyPayloadLoaded(cached, opts);
        const userOnFresh = onFresh;
        void loadSnapshotFirst({
          ...opts,
          staleWhileRevalidate: false,
          signal: undefined,
          onFresh: (fresh) => {
            if (writeCache) writeCache(fresh);
            notifyPayloadLoaded(fresh, opts);
            if (typeof userOnFresh === "function") userOnFresh(fresh);
          }
        }).catch(() => {});
        return cached;
      }
    }

    let apiPayload = null;
    if (fetchApi && getApiBase()) {
      const apiController = new AbortController();
      const unlink = mergeAbortSignals(signal, apiController);
      const timer = setTimeout(() => apiController.abort(), apiTimeoutMs);
      try {
        const api = await fetchApi(apiController.signal);
        if (!isPlaceholder(api)) apiPayload = api;
      } catch {
        apiPayload = null;
      } finally {
        clearTimeout(timer);
        unlink();
      }
    }

    let snapshot = null;
    try {
      const snap = await fetchSnapshot(signal);
      if (!isPlaceholder(snap)) snapshot = snap;
    } catch {
      /* static snapshot optional */
    }

    let best = pickBetter(apiPayload, snapshot);
    best = mergeApiHistory(best, apiPayload);
    const cached = readCache ? readCache() : null;
    if (cached && !isPlaceholder(cached)) {
      best = pickBetter(best, cached);
    }
    best = mergeApiHistory(best, apiPayload);

    if (best && !isPlaceholder(best)) {
      if (writeCache) writeCache(best);
      notifyPayloadLoaded(best, opts);
      if (typeof onFresh === "function") onFresh(best);
      return best;
    }

    const fallback = mergeApiHistory(
      pickBetter(pickBetter(apiPayload, snapshot), cached),
      apiPayload
    );
    if (fallback) {
      notifyPayloadLoaded(fallback, opts);
      if (typeof onFresh === "function") onFresh(fallback);
      return fallback;
    }

    if (fetchApi && getApiBase()) {
      try {
        const payload = await fetchApi(signal);
        if (typeof onFresh === "function") onFresh(payload);
        return payload;
      } catch (apiErr) {
        try {
          const payload = await fetchSnapshot(signal);
          if (typeof onFresh === "function") onFresh(payload);
          return payload;
        } catch {
          throw apiErr;
        }
      }
    }

    const payload = await fetchSnapshot(signal);
    if (typeof onFresh === "function") onFresh(payload);
    return payload;
  }

  function payloadUpdatedAt(payload) {
    if (!payload || typeof payload !== "object") return null;
    return (
      payload.updatedAt ||
      payload.updatedAtKst ||
      payload.updatedAtNy ||
      payload.savedAt ||
      null
    );
  }

  async function fetchStaticUpdatedAt(jsonPath, signal) {
    if (!jsonPath) return null;
    try {
      const res = await fetch(jsonPath, { signal, cache: "no-cache" });
      if (!res.ok) return null;
      const data = await res.json();
      return payloadUpdatedAt(data);
    } catch {
      return null;
    }
  }

  window.SnapshotFirstLoad = {
    loadSnapshotFirst,
    getApiBase,
    payloadUpdatedAt,
    fetchStaticUpdatedAt
  };
})();
