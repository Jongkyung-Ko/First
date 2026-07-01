/**
 * Stock strategy data — snapshot JSON + API (golden / bollinger / rsi)
 */
(function () {
  const SESSION_PREFIX = "dw_stock_strategy_v1_";

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function createDataLayer(config) {
    const { strategyId, jsonUrl, apiPath } = config;
    const SESSION_KEY = SESSION_PREFIX + strategyId;

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

    function writeSessionCache(payload) {
      try {
        if (payload) sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    }

    async function fetchSnapshot(signal) {
      const path = jsonUrl || `data/stock-strategy-${strategyId === "golden-cross" ? "golden" : strategyId === "rsi-divergence" ? "rsi" : strategyId}.json`;
      const res = await fetch(path, { signal, cache: "no-cache" });
      if (!res.ok) throw new Error(`스냅샷 HTTP ${res.status}`);
      return res.json();
    }

    async function fetchLive(signal) {
      const base = getApiBase();
      if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
      const res = await fetch(`${base}${apiPath}?force=true`, { signal });
      if (!res.ok) throw new Error(`API HTTP ${res.status}`);
      return res.json();
    }

    async function load({ forceLive = false, signal } = {}) {
      if (forceLive) {
        return fetchLive(signal);
      }
      try {
        return await fetchSnapshot(signal);
      } catch (snapErr) {
        const base = getApiBase();
        if (!base) throw snapErr;
        const res = await fetch(`${base}${apiPath}`, { signal });
        if (!res.ok) throw snapErr;
        return res.json();
      }
    }

    return {
      strategyId,
      readSessionCache,
      writeSessionCache,
      load
    };
  }

  const golden = createDataLayer({
    strategyId: "golden-cross",
    jsonUrl: window.STOCK_STRATEGY_GOLDEN_JSON_URL || "data/stock-strategy-golden.json",
    apiPath: "/api/stock-strategy/golden-cross"
  });

  const bollinger = createDataLayer({
    strategyId: "bollinger",
    jsonUrl: window.STOCK_STRATEGY_BOLLINGER_JSON_URL || "data/stock-strategy-bollinger.json",
    apiPath: "/api/stock-strategy/bollinger"
  });

  const rsi = createDataLayer({
    strategyId: "rsi-divergence",
    jsonUrl: window.STOCK_STRATEGY_RSI_JSON_URL || "data/stock-strategy-rsi.json",
    apiPath: "/api/stock-strategy/rsi-divergence"
  });

  window.StockStrategyData = {
    golden,
    bollinger,
    rsi,
    createDataLayer
  };
})();
