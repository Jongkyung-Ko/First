/**
 * 단기추천로직 — GitHub 정적 JSON prefetch (idle · nav hover)
 */
(function () {
  const PICKS_STORAGE_KEY = "dw_stock_picks_bundle_v2";
  const prefetchPromises = Object.create(null);
  let idleStarted = false;

  const PAGE_LAYERS = {
    recommend2: () => window.Recommend2Data,
    "strategy-golden": () => window.StockStrategyData?.golden,
    "strategy-bollinger": () => window.StockStrategyData?.bollinger,
    "strategy-rsi": () => window.StockStrategyData?.rsi,
    "strategy-candle-support": () => window.StockStrategyData?.candleSupport,
    "strategy-obv": () => window.StockStrategyData?.obv,
    "strategy-bottom": () => window.StockStrategyData?.bottom,
    "strategy-vcp": () => window.StockStrategyData?.vcp
  };

  const IDLE_PREFETCH_ORDER = [
    "recommend2",
    "strategy-golden",
    "strategy-bollinger",
    "strategy-rsi",
    "strategy-candle-support",
    "strategy-obv",
    "strategy-bottom",
    "strategy-vcp",
    "stock-picks"
  ];

  function layerHasFreshCache(layer) {
    const cached = layer?.readBestCache?.();
    return !!(cached && !layer.isPlaceholderPayload?.(cached));
  }

  async function prefetchPicksBundle() {
    try {
      const raw = localStorage.getItem(PICKS_STORAGE_KEY);
      if (raw) {
        const bundle = JSON.parse(raw);
        if (bundle?.markets && bundle.version >= 2 && bundle.updatedAt) {
          window.StockScanLock?.recordLastUpdated?.("sentiment", bundle.updatedAt);
          return bundle;
        }
      }
    } catch {
      /* ignore */
    }
    const path = window.STOCK_PICKS_JSON_URL || "data/stock-picks.json";
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bundle = await res.json();
    try {
      localStorage.setItem(PICKS_STORAGE_KEY, JSON.stringify(bundle));
    } catch {
      /* quota */
    }
    if (bundle?.updatedAt) {
      window.StockScanLock?.recordLastUpdated?.("sentiment", bundle.updatedAt);
    }
    return bundle;
  }

  async function prefetchStaticLayer(pageId) {
    if (pageId === "stock-picks") {
      return prefetchPicksBundle();
    }
    const layer = PAGE_LAYERS[pageId]?.();
    if (!layer?.fetchSnapshot) return null;
    if (layerHasFreshCache(layer)) {
      const cached = layer.readBestCache();
      window.StockScanLock?.recordPagePayload?.(pageId, cached);
      return cached;
    }
    const payload = await layer.fetchSnapshot();
    if (!payload || layer.isPlaceholderPayload?.(payload)) return payload;
    if (layer.writeCaches) layer.writeCaches(payload);
    else if (layer.writeSessionCache) layer.writeSessionCache(payload);
    window.StockScanLock?.recordPagePayload?.(pageId, payload);
    return payload;
  }

  function prefetchPage(pageId) {
    if (!pageId) return Promise.resolve(null);
    if (!window.StockLiveAuth?.isShortTermPage?.(pageId)) return Promise.resolve(null);
    if (prefetchPromises[pageId]) return prefetchPromises[pageId];
    prefetchPromises[pageId] = prefetchStaticLayer(pageId)
      .catch(() => null)
      .finally(() => {
        delete prefetchPromises[pageId];
      });
    return prefetchPromises[pageId];
  }

  function startIdlePrefetch(currentPageId) {
    if (idleStarted) return;
    idleStarted = true;
    const order = currentPageId
      ? [currentPageId, ...IDLE_PREFETCH_ORDER.filter((id) => id !== currentPageId)]
      : IDLE_PREFETCH_ORDER.slice();
    let chain = Promise.resolve();
    order.forEach((pageId, idx) => {
      chain = chain.then(() =>
        new Promise((resolve) => {
          const delay = idx === 0 ? 0 : 400;
          setTimeout(() => {
            void prefetchPage(pageId).finally(resolve);
          }, delay);
        })
      );
    });
  }

  function scheduleIdlePrefetch(currentPageId) {
    const run = () => startIdlePrefetch(currentPageId);
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 2500 });
    } else {
      setTimeout(run, 800);
    }
  }

  window.StockPicksPrefetch = {
    prefetchPage,
    scheduleIdlePrefetch
  };
})();
