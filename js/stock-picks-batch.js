/**
 * Stock Picks 통합 Re — 시장별 TOP 100 청크 스캔 (Render 타임아웃 회피)
 */
(function () {
  const BATCH_SESSION_AT = "dw_stock_picks_batch_at_v1";
  const BATCH_FRESH_MS = 15 * 60 * 1000;
  const CHUNK_SIZE = 25;
  const UNIVERSE_LIMIT = 100;

  const LIVE_SCAN_MARKETS = [
    { region: "kospi", label: "KOSPI" },
    { region: "kosdaq", label: "KOSDAQ" },
    { region: "nasdaq", label: "NASDAQ" },
    { region: "nyse", label: "NYSE" }
  ];

  const STRATEGY_LAYER_MAP = {
    "golden-cross": () => window.StockStrategyData?.golden,
    bollinger: () => window.StockStrategyData?.bollinger,
    "rsi-divergence": () => window.StockStrategyData?.rsi,
    "candle-support": () => window.StockStrategyData?.candleSupport,
    "obv-divergence": () => window.StockStrategyData?.obv,
    "bottom-pattern": () => window.StockStrategyData?.bottom,
    vcp: () => window.StockStrategyData?.vcp
  };

  let running = false;

  function buildScanSteps() {
    const steps = [];
    for (const market of LIVE_SCAN_MARKETS) {
      for (let offset = 0; offset < UNIVERSE_LIMIT; offset += CHUNK_SIZE) {
        steps.push({
          region: market.region,
          label: market.label,
          offset,
          limit: CHUNK_SIZE
        });
      }
      steps.push({
        region: market.region,
        label: market.label,
        finalize: true
      });
    }
    return steps;
  }

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function isBatchFresh() {
    try {
      const at = Number(sessionStorage.getItem(BATCH_SESSION_AT) || 0);
      return at > 0 && Date.now() - at < BATCH_FRESH_MS;
    } catch {
      return false;
    }
  }

  function markBatchFresh() {
    try {
      sessionStorage.setItem(BATCH_SESSION_AT, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  function applyPartial(partial) {
    if (!partial || typeof partial !== "object") return;
    const r2 = partial.recommend2;
    if (r2 && window.Recommend2Data?.writeSessionCache) {
      window.Recommend2Data.writeSessionCache(r2);
    }
    const strategies = partial.strategies || {};
    for (const [sid, payload] of Object.entries(strategies)) {
      const layer = STRATEGY_LAYER_MAP[sid]?.();
      if (layer?.writeCaches) layer.writeCaches(payload);
      else if (layer?.writeSessionCache) layer.writeSessionCache(payload);
    }
    window.dispatchEvent(
      new CustomEvent("stock-picks-batch-updated", {
        detail: partial
      })
    );
  }

  async function fetchBatchRegion(
    region,
    { offset = 0, limit = CHUNK_SIZE, finalize = false, signal, timeoutMs = 90000, retries = 1 } = {}
  ) {
    const base = getApiBase();
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    const params = new URLSearchParams({ region });
    if (finalize) params.set("finalize", "true");
    else {
      params.set("offset", String(offset));
      params.set("limit", String(limit));
    }
    const url = `${base}/api/stock-picks/batch-build?${params}`;
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }
      try {
        const res = await fetch(url, { method: "POST", signal: controller.signal });
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
      } catch (err) {
        lastErr = err;
        if (err.name === "AbortError" && signal?.aborted) throw err;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
      }
    }
    if (lastErr?.name === "AbortError") {
      throw new Error(`요청 시간 초과 (${Math.round(timeoutMs / 1000)}초)`);
    }
    throw lastErr;
  }

  async function runBatch({ signal, onProgress, onPartial, skipDmCheck = false } = {}) {
    if (running) throw new Error("통합 스캔이 이미 진행 중입니다.");
    const base = getApiBase();
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");

    running = true;
    const steps = buildScanSteps();
    try {
      if (!skipDmCheck && !isBatchFresh()) {
        const spend = window.Digimon?.spendForStockPicksBatchRefresh;
        if (spend) {
          const result = await spend();
          if (!result.ok) {
            throw new Error(result.error || "Digi-Mon이 부족합니다.");
          }
        }
      }

      let lastPayload = null;
      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const chunkLabel = step.finalize
          ? "활성 신호 정리"
          : `${step.offset + 1}–${Math.min(step.offset + step.limit, UNIVERSE_LIMIT)}`;
        onProgress?.({
          step: i + 1,
          total: steps.length,
          region: step.region,
          label: `${step.label} · ${chunkLabel}`
        });
        const partial = await fetchBatchRegion(step.region, {
          signal,
          retries: 1,
          offset: step.offset,
          limit: step.limit,
          finalize: step.finalize
        });
        lastPayload = partial;
        applyPartial(partial);
        onPartial?.(partial);
      }
      markBatchFresh();
      return lastPayload;
    } finally {
      running = false;
    }
  }

  window.StockPicksBatch = {
    LIVE_SCAN_STEPS: LIVE_SCAN_MARKETS,
    CHUNK_SIZE,
    buildScanSteps,
    isBatchFresh,
    runBatch,
    applyPartial,
    fetchBatchRegion
  };
})();
