/**
 * GitHub 정적 스냅샷 우선 → Render API 갱신 → 브라우저 캐시(더 좋을 때만)
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
      apiTimeoutMs = 28000
    } = opts;

    if (forceLive) {
      if (!fetchLive) throw new Error("fetchLive is required when forceLive=true");
      const live = await fetchLive();
      if (writeCache) writeCache(live);
      notifyPayloadLoaded(live, opts);
      return live;
    }

    let snapshot = null;
    try {
      const snap = await fetchSnapshot(signal);
      if (!isPlaceholder(snap)) snapshot = snap;
    } catch {
      /* static snapshot optional */
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

    let best = pickBetter(snapshot, apiPayload);
    const cached = readCache ? readCache() : null;
    if (cached && !isPlaceholder(cached)) {
      best = pickBetter(best, cached);
    }

    if (best && !isPlaceholder(best)) {
      if (writeCache) writeCache(best);
      notifyPayloadLoaded(best, opts);
      return best;
    }

    const fallback = pickBetter(pickBetter(snapshot, apiPayload), cached);
    if (fallback) {
      notifyPayloadLoaded(fallback, opts);
      return fallback;
    }

    try {
      return await fetchSnapshot(signal);
    } catch (snapErr) {
      if (fetchApi && getApiBase()) {
        try {
          return await fetchApi(signal);
        } catch {
          throw snapErr;
        }
      }
      throw snapErr;
    }
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
