/**
 * Stock strategy data — snapshot JSON + API + local/session cache
 */
(function () {
  const SESSION_PREFIX = "dw_stock_strategy_v1_";
  const LOCAL_PREFIX = "dw_stock_strategy_ls_v1_";
  const LOCAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
      const block = markets[key] || {};
      score += Number(block.recentCount || block.recentSignals?.length || 0);
      score += Number(block.activeCount || block.activeSignals?.length || 0) * 2;
    }
    score += Number(payload.activeCount || 0) * 2;
    if (payload.source === "live") score += 10000;
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
    const ta = Date.parse(a.updatedAt || a.savedAt || 0) || 0;
    const tb = Date.parse(b.updatedAt || b.savedAt || 0) || 0;
    return tb >= ta ? b : a;
  }

  function createDataLayer(config) {
    const { strategyId, jsonUrl, apiPath } = config;
    const SESSION_KEY = SESSION_PREFIX + strategyId;
    const LOCAL_KEY = LOCAL_PREFIX + strategyId;

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
      const path =
        jsonUrl ||
        `data/stock-strategy-${
          strategyId === "golden-cross"
            ? "golden"
            : strategyId === "rsi-divergence"
              ? "rsi"
              : strategyId === "candle-support"
                ? "candle-support"
                : strategyId === "obv-divergence"
                  ? "obv"
                  : strategyId === "bottom-pattern"
                    ? "bottom"
                    : strategyId === "vcp"
                      ? "vcp"
                      : strategyId
        }.json`;
      const res = await fetch(path, { signal, cache: "no-cache" });
      if (!res.ok) throw new Error(`스냅샷 HTTP ${res.status}`);
      return res.json();
    }

    async function fetchApi(signal, force = false) {
      const base = getApiBase();
      if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
      const url = `${base}${apiPath}${force ? "?force=true" : ""}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`API HTTP ${res.status}`);
      return res.json();
    }

    async function load({ forceLive = false, signal, preferCache = true } = {}) {
      const cached = preferCache ? readBestCache() : null;

      if (forceLive) {
        const live = await fetchApi(signal, true);
        writeCaches(live);
        return live;
      }

      if (cached && !isPlaceholderPayload(cached)) {
        return cached;
      }

      let apiPayload = null;
      const base = getApiBase();
      if (base) {
        try {
          apiPayload = await fetchApi(signal, false);
        } catch {
          apiPayload = null;
        }
      }

      if (apiPayload && !isPlaceholderPayload(apiPayload)) {
        writeCaches(apiPayload);
        return apiPayload;
      }

      try {
        const snap = await fetchSnapshot(signal);
        if (!isPlaceholderPayload(snap)) {
          writeCaches(snap);
          return snap;
        }
      } catch {
        /* fall through */
      }

      if (cached) return cached;
      if (apiPayload) return apiPayload;

      try {
        return await fetchSnapshot(signal);
      } catch (snapErr) {
        if (base) {
          try {
            return await fetchApi(signal, false);
          } catch {
            throw snapErr;
          }
        }
        throw snapErr;
      }
    }

    return {
      strategyId,
      payloadScore,
      isPlaceholderPayload,
      pickBetterPayload,
      readSessionCache,
      readLocalCache,
      readBestCache,
      writeSessionCache: writeCaches,
      writeCaches,
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

  const candleSupport = createDataLayer({
    strategyId: "candle-support",
    jsonUrl:
      window.STOCK_STRATEGY_CANDLE_JSON_URL || "data/stock-strategy-candle-support.json",
    apiPath: "/api/stock-strategy/candle-support"
  });

  const obv = createDataLayer({
    strategyId: "obv-divergence",
    jsonUrl: window.STOCK_STRATEGY_OBV_JSON_URL || "data/stock-strategy-obv.json",
    apiPath: "/api/stock-strategy/obv-divergence"
  });

  const bottom = createDataLayer({
    strategyId: "bottom-pattern",
    jsonUrl: window.STOCK_STRATEGY_BOTTOM_JSON_URL || "data/stock-strategy-bottom.json",
    apiPath: "/api/stock-strategy/bottom-pattern"
  });

  const vcp = createDataLayer({
    strategyId: "vcp",
    jsonUrl: window.STOCK_STRATEGY_VCP_JSON_URL || "data/stock-strategy-vcp.json",
    apiPath: "/api/stock-strategy/vcp"
  });

  window.StockStrategyData = {
    golden,
    bollinger,
    rsi,
    candleSupport,
    obv,
    bottom,
    vcp,
    createDataLayer,
    payloadScore,
    isPlaceholderPayload
  };
})();
