(function () {
  const CHART_MARKETS = [
    { id: "kr_kospi", label: "KOSPI" },
    { id: "kr_kosdaq", label: "KOSDAQ" },
    { id: "nyse", label: "NYSE" },
    { id: "nasdaq", label: "NASDAQ" }
  ];

  const CHART_UNIVERSE = {
    kr_kospi: [
      ["005930.KS", "삼성전자"],
      ["000660.KS", "SK하이닉스"],
      ["373220.KS", "LG에너지솔루션"],
      ["207940.KS", "삼성바이오로직스"],
      ["005380.KS", "현대차"],
      ["329180.KS", "HD현대중공업"],
      ["000270.KS", "기아"],
      ["105560.KS", "KB금융"],
      ["035420.KS", "NAVER"],
      ["055550.KS", "신한지주"]
    ],
    kr_kosdaq: [
      ["247540.KQ", "에코프로비엠"],
      ["196170.KQ", "알테오젠"],
      ["277810.KQ", "레인보우로보틱스"],
      ["086520.KQ", "에코프로"],
      ["403870.KQ", "HPSP"],
      ["141080.KQ", "레고켐바이오"],
      ["028300.KQ", "HLB"],
      ["145020.KQ", "휴젤"],
      ["214450.KQ", "파마리서치"],
      ["310210.KQ", "보로노이"]
    ],
    nyse: [
      ["BRK-B", "Berkshire Hathaway"],
      ["JPM", "JPMorgan Chase"],
      ["V", "Visa"],
      ["UNH", "UnitedHealth"],
      ["XOM", "Exxon Mobil"],
      ["JNJ", "Johnson & Johnson"],
      ["WMT", "Walmart"],
      ["PG", "Procter & Gamble"],
      ["MA", "Mastercard"],
      ["HD", "Home Depot"]
    ],
    nasdaq: [
      ["AAPL", "Apple"],
      ["MSFT", "Microsoft"],
      ["NVDA", "NVIDIA"],
      ["GOOGL", "Alphabet"],
      ["AMZN", "Amazon"],
      ["META", "Meta"],
      ["TSLA", "Tesla"],
      ["AVGO", "Broadcom"],
      ["COST", "Costco"],
      ["NFLX", "Netflix"]
    ]
  };

  const INDICATORS = [
    { id: "sma5", label: "SMA 5", type: "overlay", color: "#f59e0b" },
    { id: "sma20", label: "SMA 20", type: "overlay", color: "#8b5cf6" },
    { id: "sma60", label: "SMA 60", type: "overlay", color: "#06b6d4" },
    { id: "ema12", label: "EMA 12", type: "overlay", color: "#ec4899" },
    { id: "bb", label: "볼린저", type: "bollinger", color: "#94a3b8" },
    { id: "rsi", label: "RSI(14)", type: "rsi", color: "#a78bfa" },
    { id: "macd", label: "MACD", type: "macd", color: "#38bdf8" }
  ];

  const CHART_PERIODS = [
    { id: "1mo", label: "1M" },
    { id: "3mo", label: "3M" },
    { id: "6mo", label: "6M" }
  ];
  const DEFAULT_CHART_PERIOD = "6mo";
  const CHART_INTERVAL = "1d";

  const FONT_SCALE_KEY = "dw_chart_font_scale";
  const FONT_SCALE_MIN = 0.72;
  const FONT_SCALE_MAX = 1.08;
  const FONT_SCALE_STEP = 0.06;
  const FONT_SCALE_DEFAULT = 0.82;

  let activeMarket = "kr_kospi";
  let fontScale = FONT_SCALE_DEFAULT;
  let abortController = null;
  const chartPanelState = new WeakMap();
  const chartDataCache = new Map();

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPct(value) {
    if (value == null || !Number.isFinite(value)) return "—";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }

  function formatPrice(value, ticker) {
    if (value == null || !Number.isFinite(value)) return "—";
    const isKr = /\.(KS|KQ)$/i.test(ticker || "");
    if (isKr) return `${Math.round(value).toLocaleString()}원`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function formatFetchError(err, base) {
    if (err?.name === "AbortError") {
      return "요청이 취소되었거나 시간이 초과되었습니다.";
    }
    const msg = String(err?.message || err || "");
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      if (window.IS_LOCAL_FILE_PREVIEW) {
        return "HTML 파일을 직접 열면 API가 차단됩니다. Live Server 또는 GitHub Pages로 열어 주세요.";
      }
      if (base?.includes("localhost")) {
        return "로컬 API(localhost:8000)에 연결할 수 없습니다.";
      }
      return "주식 API 서버에 연결할 수 없습니다. 첫 요청은 최대 1~2분 걸릴 수 있습니다.";
    }
    return msg || "데이터를 불러오지 못했습니다.";
  }

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function warmApi(base) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      await fetch(`${base}/health`, { signal: controller.signal });
      clearTimeout(timer);
    } catch (_) {
      /* noop */
    }
  }

  async function fetchJsonWithRetry(url, externalSignal, options = {}) {
    const retries = options.retries ?? 2;
    const timeoutMs = options.timeoutMs ?? 90000;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (externalSignal?.aborted) throw new DOMException("Aborted", "AbortError");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onExternalAbort = () => controller.abort();
      externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(detail || `HTTP ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);
        lastError = err;
        if (err?.name === "AbortError") throw err;
        if (attempt < retries) await sleep(800 * (attempt + 1));
      }
    }
    throw lastError || new Error("Request failed");
  }

  function fallbackItems(market) {
    const universe = CHART_UNIVERSE[market] || [];
    return universe.map(([ticker, name], idx) => ({
      rank: idx + 1,
      ticker,
      name,
      price: null,
      changePct: null
    }));
  }

  async function fetchMarketTop10(market) {
    const base = getApiBase();
    if (!base) {
      return {
        market,
        segmentTitle: CHART_MARKETS.find((m) => m.id === market)?.label || market,
        items: fallbackItems(market),
        offline: true
      };
    }

    if (abortController) abortController.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    await warmApi(base);
    const url = `${base}/api/market-top10?market=${encodeURIComponent(market)}`;
    return fetchJsonWithRetry(url, signal, { retries: 2, timeoutMs: 120000 });
  }

  function readFontScale() {
    try {
      const raw = localStorage.getItem(FONT_SCALE_KEY);
      const value = raw != null ? Number(raw) : FONT_SCALE_DEFAULT;
      if (!Number.isFinite(value)) return FONT_SCALE_DEFAULT;
      return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value));
    } catch (_) {
      return FONT_SCALE_DEFAULT;
    }
  }

  function writeFontScale(value) {
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(value));
    } catch (_) {
      /* noop */
    }
  }

  function periodLabel(period) {
    return CHART_PERIODS.find((p) => p.id === period)?.label || period;
  }

  function applyFontScale(root) {
    if (!root) return;
    root.style.setProperty("--chart-font-scale", String(fontScale));
    const downBtn = root.querySelector("#chart-font-down");
    const upBtn = root.querySelector("#chart-font-up");
    if (downBtn) downBtn.disabled = fontScale <= FONT_SCALE_MIN;
    if (upBtn) upBtn.disabled = fontScale >= FONT_SCALE_MAX;
  }

  function bindFontControls(root) {
    root.querySelector("#chart-font-down")?.addEventListener("click", () => {
      fontScale = Math.max(FONT_SCALE_MIN, +(fontScale - FONT_SCALE_STEP).toFixed(2));
      writeFontScale(fontScale);
      applyFontScale(root);
    });
    root.querySelector("#chart-font-up")?.addEventListener("click", () => {
      fontScale = Math.min(FONT_SCALE_MAX, +(fontScale + FONT_SCALE_STEP).toFixed(2));
      writeFontScale(fontScale);
      applyFontScale(root);
    });
  }

  async function fetchChartData(ticker, period) {
    const periodToUse = period || DEFAULT_CHART_PERIOD;
    const cacheKey = `${ticker}:${periodToUse}`;
    if (chartDataCache.has(cacheKey)) return chartDataCache.get(cacheKey);

    const base = getApiBase();
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");

    const url = `${base}/api/chart?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(periodToUse)}&interval=${CHART_INTERVAL}`;
    await warmApi(base);
    const data = await fetchJsonWithRetry(url, null, { retries: 2, timeoutMs: 120000 });
    chartDataCache.set(cacheKey, data);
    return data;
  }

  function sma(values, period) {
    const out = [];
    for (let i = period - 1; i < values.length; i += 1) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += values[j].close;
      out.push({ time: values[i].time, value: sum / period });
    }
    return out;
  }

  function ema(values, period) {
    const out = [];
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < values.length; i += 1) {
      if (i < period - 1) continue;
      if (prev == null) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j += 1) sum += values[j].close;
        prev = sum / period;
      } else {
        prev = values[i].close * k + prev * (1 - k);
      }
      out.push({ time: values[i].time, value: prev });
    }
    return out;
  }

  function bollinger(values, period = 20, mult = 2) {
    const upper = [];
    const middle = [];
    const lower = [];
    for (let i = period - 1; i < values.length; i += 1) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += values[j].close;
      const mean = sum / period;
      let variance = 0;
      for (let j = i - period + 1; j <= i; j += 1) {
        variance += (values[j].close - mean) ** 2;
      }
      const std = Math.sqrt(variance / period);
      const time = values[i].time;
      middle.push({ time, value: mean });
      upper.push({ time, value: mean + mult * std });
      lower.push({ time, value: mean - mult * std });
    }
    return { upper, middle, lower };
  }

  function rsi(values, period = 14) {
    const out = [];
    if (values.length <= period) return out;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i += 1) {
      const diff = values[i].close - values[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push({ time: values[period].time, value: 100 - 100 / (1 + rs) });

    for (let i = period + 1; i < values.length; i += 1) {
      const diff = values[i].close - values[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rsVal = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out.push({ time: values[i].time, value: 100 - 100 / (1 + rsVal) });
    }
    return out;
  }

  function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
    const closes = values.map((c) => c.close);
    const emaFast = [];
    const emaSlow = [];
    const macdLine = [];

    function buildEmaArray(data, period) {
      const arr = new Array(data.length).fill(null);
      const k = 2 / (period + 1);
      let prev = null;
      for (let i = 0; i < data.length; i += 1) {
        if (i < period - 1) continue;
        if (prev == null) {
          let sum = 0;
          for (let j = i - period + 1; j <= i; j += 1) sum += data[j];
          prev = sum / period;
        } else {
          prev = data[i] * k + prev * (1 - k);
        }
        arr[i] = prev;
      }
      return arr;
    }

    const fastArr = buildEmaArray(closes, fast);
    const slowArr = buildEmaArray(closes, slow);
    for (let i = 0; i < values.length; i += 1) {
      if (fastArr[i] != null && slowArr[i] != null) {
        macdLine.push({ idx: i, value: fastArr[i] - slowArr[i] });
      }
    }

    const signal = [];
    const histogram = [];
    const k = 2 / (signalPeriod + 1);
    let sigPrev = null;
    for (let j = 0; j < macdLine.length; j += 1) {
      const val = macdLine[j].value;
      if (j < signalPeriod - 1) continue;
      if (sigPrev == null) {
        let sum = 0;
        for (let x = j - signalPeriod + 1; x <= j; x += 1) sum += macdLine[x].value;
        sigPrev = sum / signalPeriod;
      } else {
        sigPrev = val * k + sigPrev * (1 - k);
      }
      const idx = macdLine[j].idx;
      const time = values[idx].time;
      signal.push({ time, value: sigPrev });
      histogram.push({
        time,
        value: val - sigPrev,
        color: val - sigPrev >= 0 ? "rgba(239, 68, 68, 0.55)" : "rgba(59, 130, 246, 0.55)"
      });
    }

    const macdSeries = macdLine
      .slice(slow - 1)
      .map((row) => ({ time: values[row.idx].time, value: row.value }));

    return { macd: macdSeries, signal, histogram };
  }

  function destroyChartPanel(panel) {
    const state = chartPanelState.get(panel);
    if (!state) return;
    if (state.resizeObserver) state.resizeObserver.disconnect();
    if (state.rsiResizeObserver) state.rsiResizeObserver.disconnect();
    if (state.macdResizeObserver) state.macdResizeObserver.disconnect();
    for (const chart of [state.chart, state.rsiChart, state.macdChart]) {
      if (chart) {
        try {
          chart.remove();
        } catch (_) {
          /* noop */
        }
      }
    }
    chartPanelState.delete(panel);
    panel.querySelector("[data-chart-root]")?.replaceChildren();
    panel.querySelector("[data-rsi-root]")?.replaceChildren();
    panel.querySelector("[data-macd-root]")?.replaceChildren();
  }

  function createBaseChartOptions(width) {
    return {
      width: width || 320,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#334155"
      },
      grid: {
        vertLines: { color: "rgba(203, 213, 225, 0.9)" },
        horzLines: { color: "rgba(203, 213, 225, 0.9)" }
      },
      rightPriceScale: { borderColor: "#cbd5e1" },
      timeScale: { borderColor: "#cbd5e1", timeVisible: true, secondsVisible: false }
    };
  }

  function applyIndicators(state, candles, enabled) {
    const { chart } = state;
    if (!chart) return;

    for (const series of state.overlaySeries || []) {
      try {
        chart.removeSeries(series);
      } catch (_) {
        /* noop */
      }
    }
    state.overlaySeries = [];

    if (state.rsiChart) {
      state.rsiResizeObserver?.disconnect();
      try {
        state.rsiChart.remove();
      } catch (_) {
        /* noop */
      }
      state.rsiChart = null;
      state.rsiResizeObserver = null;
    }
    if (state.rsiRoot) {
      state.rsiRoot.hidden = true;
      state.rsiRoot.replaceChildren();
    }

    if (state.macdChart) {
      state.macdResizeObserver?.disconnect();
      try {
        state.macdChart.remove();
      } catch (_) {
        /* noop */
      }
      state.macdChart = null;
      state.macdResizeObserver = null;
    }
    if (state.macdRoot) {
      state.macdRoot.hidden = true;
      state.macdRoot.replaceChildren();
    }

    if (enabled.has("sma5")) {
      const data = sma(candles, 5);
      if (data.length) {
        const s = chart.addLineSeries({ color: "#f59e0b", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData(data);
        state.overlaySeries.push(s);
      }
    }
    if (enabled.has("sma20")) {
      const data = sma(candles, 20);
      if (data.length) {
        const s = chart.addLineSeries({ color: "#8b5cf6", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData(data);
        state.overlaySeries.push(s);
      }
    }
    if (enabled.has("sma60")) {
      const data = sma(candles, 60);
      if (data.length) {
        const s = chart.addLineSeries({ color: "#06b6d4", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData(data);
        state.overlaySeries.push(s);
      }
    }
    if (enabled.has("ema12")) {
      const data = ema(candles, 12);
      if (data.length) {
        const s = chart.addLineSeries({ color: "#ec4899", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData(data);
        state.overlaySeries.push(s);
      }
    }
    if (enabled.has("bb")) {
      const bands = bollinger(candles, 20, 2);
      if (bands.middle.length) {
        const upper = chart.addLineSeries({ color: "rgba(148, 163, 184, 0.9)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        const middle = chart.addLineSeries({ color: "rgba(148, 163, 184, 0.55)", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        const lower = chart.addLineSeries({ color: "rgba(148, 163, 184, 0.9)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        upper.setData(bands.upper);
        middle.setData(bands.middle);
        lower.setData(bands.lower);
        state.overlaySeries.push(upper, middle, lower);
      }
    }

    if (enabled.has("rsi") && candles.length > 15 && state.rsiRoot) {
      state.rsiRoot.hidden = false;
      const rsiChart = window.LightweightCharts.createChart(state.rsiRoot, {
        ...createBaseChartOptions(state.rsiRoot.clientWidth),
        height: 90
      });
      const rsiSeries = rsiChart.addLineSeries({ color: "#a78bfa", lineWidth: 1.5, priceLineVisible: false });
      rsiSeries.setData(rsi(candles, 14));
      rsiChart.timeScale().fitContent();
      const rsiResizeObserver = new ResizeObserver(() => {
        rsiChart.applyOptions({ width: state.rsiRoot.clientWidth || 320 });
      });
      rsiResizeObserver.observe(state.rsiRoot);
      state.rsiChart = rsiChart;
      state.rsiResizeObserver = rsiResizeObserver;
    }

    if (enabled.has("macd") && candles.length > 35 && state.macdRoot) {
      state.macdRoot.hidden = false;
      const macdChart = window.LightweightCharts.createChart(state.macdRoot, {
        ...createBaseChartOptions(state.macdRoot.clientWidth),
        height: 100
      });
      const macdData = macd(candles);
      const macdSeries = macdChart.addLineSeries({ color: "#38bdf8", lineWidth: 1.5, priceLineVisible: false });
      const signalSeries = macdChart.addLineSeries({ color: "#f472b6", lineWidth: 1, priceLineVisible: false });
      const histSeries = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
      macdSeries.setData(macdData.macd.slice(macdData.signal.length > 0 ? macdData.macd.length - macdData.signal.length : 0));
      signalSeries.setData(macdData.signal);
      histSeries.setData(macdData.histogram);
      macdChart.timeScale().fitContent();
      const macdResizeObserver = new ResizeObserver(() => {
        macdChart.applyOptions({ width: state.macdRoot.clientWidth || 320 });
      });
      macdResizeObserver.observe(state.macdRoot);
      state.macdChart = macdChart;
      state.macdResizeObserver = macdResizeObserver;
    }

    chart.timeScale().fitContent();
  }

  function renderStockChart(chartRoot, rsiRoot, macdRoot, candles, enabled) {
    if (!window.LightweightCharts || !candles?.length) return null;

    const chart = window.LightweightCharts.createChart(chartRoot, {
      ...createBaseChartOptions(chartRoot.clientWidth),
      height: 300
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444",
      downColor: "#3b82f6",
      borderUpColor: "#ef4444",
      borderDownColor: "#3b82f6",
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6"
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume"
    });

    chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

    const ohlc = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    const volumes = candles.map((c, i) => {
      const prevClose = i > 0 ? candles[i - 1].close : c.open;
      const up = c.close >= prevClose;
      return {
        time: c.time,
        value: c.volume || 0,
        color: up ? "rgba(239, 68, 68, 0.55)" : "rgba(59, 130, 246, 0.55)"
      };
    });

    candleSeries.setData(ohlc);
    volumeSeries.setData(volumes);

    const state = {
      chart,
      candleSeries,
      volumeSeries,
      overlaySeries: [],
      candles,
      rsiRoot,
      macdRoot,
      enabled: new Set(enabled)
    };

    applyIndicators(state, candles, enabled);

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: chartRoot.clientWidth || 320 });
    });
    resizeObserver.observe(chartRoot);
    state.resizeObserver = resizeObserver;

    chart.timeScale().fitContent();
    return state;
  }

  function getEnabledIndicators(panel) {
    const enabled = new Set();
    panel.querySelectorAll(".chart-indicator-btn.is-active").forEach((btn) => {
      if (btn.dataset.indicator) enabled.add(btn.dataset.indicator);
    });
    return enabled;
  }

  function periodToolbarHtml(activePeriod) {
    const period = activePeriod || DEFAULT_CHART_PERIOD;
    return `
      <div class="chart-period-bar" role="group" aria-label="차트 기간">
        ${CHART_PERIODS.map(
          (p) =>
            `<button type="button" class="chart-pill-btn chart-period-btn${p.id === period ? " is-active" : ""}" data-period="${p.id}">${p.label}</button>`
        ).join("")}
      </div>
    `;
  }

  function indicatorBarHtml() {
    return `
      <div class="chart-indicator-bar" role="group" aria-label="보조지표">
        ${INDICATORS.map(
          (ind) =>
            `<button type="button" class="chart-pill-btn chart-indicator-btn" data-indicator="${ind.id}" aria-pressed="false">${escapeHtml(ind.label)}</button>`
        ).join("")}
      </div>
    `;
  }

  function panelLoadKey(panel) {
    const ticker = panel.dataset.ticker || "";
    const period = panel.dataset.period || DEFAULT_CHART_PERIOD;
    const enabled = [...getEnabledIndicators(panel)].sort().join(",");
    return `${ticker}:${period}:${enabled}`;
  }

  function refreshPanelIndicators(panel) {
    const state = chartPanelState.get(panel);
    if (!state?.candles?.length) return false;
    const enabled = getEnabledIndicators(panel);
    state.enabled = enabled;
    applyIndicators(state, state.candles, enabled);
    panel.dataset.loaded = panelLoadKey(panel);
    return true;
  }

  function renderList(container, data) {
    const listEl = container.querySelector("#chart-list");
    const statusEl = container.querySelector("#chart-status");
    const items = data?.items?.length ? data.items : fallbackItems(activeMarket);

    if (statusEl) {
      if (data?.offline) {
        statusEl.textContent = "API 연결 없음 — 종목 목록만 표시됩니다. 시세·차트는 API 연결 후 이용하세요.";
        statusEl.className = "chart-status chart-status--warn";
        statusEl.hidden = false;
      } else if (data?.error) {
        statusEl.textContent = data.error;
        statusEl.className = "chart-status chart-status--error";
        statusEl.hidden = false;
      } else {
        statusEl.textContent = `${data.segmentTitle || ""} · ${items.length}개 · 최대 6개월 일봉`;
        statusEl.className = "chart-status chart-status--info";
        statusEl.hidden = false;
      }
    }

    listEl.innerHTML = `
      <div class="chart-table-wrap">
        <table class="chart-table">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">종목</th>
              <th scope="col">티커</th>
              <th scope="col">현재가</th>
              <th scope="col">등락률</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map((item, idx) => {
                const change = item.changePct;
                const changeCls = change > 0 ? "up" : change < 0 ? "down" : "";
                return `
                  <tr class="chart-row" data-idx="${idx}">
                    <td class="chart-rank">#${item.rank ?? idx + 1}</td>
                    <td class="chart-name">${escapeHtml(item.name)}</td>
                    <td class="chart-ticker">${escapeHtml(item.ticker)}</td>
                    <td class="chart-price">${formatPrice(item.price, item.ticker)}</td>
                    <td class="chart-change ${changeCls}">${formatPct(change)}</td>
                    <td class="chart-action">
                      <button type="button" class="chart-open-btn" data-ticker="${escapeHtml(item.ticker)}" data-name="${escapeHtml(item.name)}" aria-expanded="false" aria-controls="chart-panel-${idx}">Chart</button>
                    </td>
                  </tr>
                  <tr class="chart-panel-row" id="chart-panel-${idx}" hidden>
                    <td colspan="6">
                      <div class="chart-panel" data-ticker="${escapeHtml(item.ticker)}" data-name="${escapeHtml(item.name)}" data-period="${DEFAULT_CHART_PERIOD}" data-loaded="">
                        <div class="chart-panel-head">
                          <span class="chart-panel-title">${escapeHtml(item.name)} <span class="chart-panel-period" data-period-label>${periodLabel(DEFAULT_CHART_PERIOD)} · 일봉</span></span>
                          ${periodToolbarHtml(DEFAULT_CHART_PERIOD)}
                        </div>
                        ${indicatorBarHtml()}
                        <div class="chart-panel-wrap" data-chart-root hidden></div>
                        <div class="chart-sub-wrap" data-rsi-root hidden></div>
                        <div class="chart-sub-wrap" data-macd-root hidden></div>
                        <p class="chart-panel-status" data-chart-status hidden>차트를 불러오는 중…</p>
                      </div>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    bindListControls(listEl);
  }

  async function loadChartPanel(panel, options = {}) {
    const ticker = panel.dataset.ticker;
    const chartRoot = panel.querySelector("[data-chart-root]");
    const statusEl = panel.querySelector("[data-chart-status]");
    if (!ticker || !chartRoot) return;

    const period = options.period || panel.dataset.period || DEFAULT_CHART_PERIOD;
    panel.dataset.period = period;
    const periodLabelEl = panel.querySelector("[data-period-label]");
    if (periodLabelEl) periodLabelEl.textContent = `${periodLabel(period)} · 일봉`;

    panel.querySelectorAll(".chart-period-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.period === period);
    });

    const loadKey = panelLoadKey(panel);

    if (!options.force && panel.dataset.loaded === loadKey && chartPanelState.has(panel)) return;

    destroyChartPanel(panel);
    panel.dataset.loaded = "loading";
    if (statusEl) {
      statusEl.className = "chart-panel-status";
      statusEl.textContent = "차트를 불러오는 중… (첫 요청은 최대 1분)";
      statusEl.hidden = false;
    }
    chartRoot.hidden = true;

    try {
      const enabled = getEnabledIndicators(panel);
      const data = await fetchChartData(ticker, period);
      if (!data?.candles?.length) {
        if (statusEl) {
          statusEl.className = "chart-panel-status chart-panel-status--error";
          statusEl.textContent = "표시할 차트 데이터가 없습니다.";
          statusEl.hidden = false;
        }
        panel.dataset.loaded = "";
        return;
      }

      chartRoot.hidden = false;
      const rsiRoot = panel.querySelector("[data-rsi-root]");
      const macdRoot = panel.querySelector("[data-macd-root]");
      const state = renderStockChart(chartRoot, rsiRoot, macdRoot, data.candles, enabled);
      if (state) {
        state.candles = data.candles;
        chartPanelState.set(panel, state);
      }
      panel.dataset.loaded = loadKey;
      if (statusEl) statusEl.hidden = true;
    } catch (err) {
      panel.dataset.loaded = "";
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.className = "chart-panel-status chart-panel-status--error";
        statusEl.textContent = formatFetchError(err, getApiBase());
      }
    }
  }

  function closeAllChartPanels(listEl, exceptRow) {
    listEl.querySelectorAll(".chart-panel-row").forEach((row) => {
      if (row === exceptRow) return;
      row.hidden = true;
      const panel = row.querySelector(".chart-panel");
      if (panel) destroyChartPanel(panel);
    });
    listEl.querySelectorAll(".chart-open-btn").forEach((btn) => {
      if (exceptRow && btn.getAttribute("aria-controls") === exceptRow.id) return;
      btn.setAttribute("aria-expanded", "false");
      btn.classList.remove("is-open");
    });
  }

  function bindListControls(listEl) {
    listEl.querySelectorAll(".chart-open-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".chart-row");
        const panelRow = row?.nextElementSibling;
        const panel = panelRow?.querySelector(".chart-panel");
        if (!panelRow || !panel) return;

        const willOpen = panelRow.hidden;
        closeAllChartPanels(listEl, willOpen ? panelRow : null);

        if (willOpen) {
          panelRow.hidden = false;
          btn.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          await loadChartPanel(panel);
        } else {
          panelRow.hidden = true;
          btn.classList.remove("is-open");
          btn.setAttribute("aria-expanded", "false");
          destroyChartPanel(panel);
          panel.dataset.loaded = "";
        }
      });
    });

    listEl.querySelectorAll(".chart-indicator-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const panel = btn.closest(".chart-panel");
        if (!panel) return;
        const willActivate = !btn.classList.contains("is-active");
        btn.classList.toggle("is-active", willActivate);
        btn.setAttribute("aria-pressed", willActivate ? "true" : "false");
        if (panel.dataset.loaded === "" || panel.dataset.loaded === "loading") return;
        if (refreshPanelIndicators(panel)) return;
        await loadChartPanel(panel, { force: true });
      });
    });

    listEl.querySelectorAll(".chart-period-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const panel = btn.closest(".chart-panel");
        if (!panel || btn.classList.contains("is-active")) return;
        panel.dataset.period = btn.dataset.period || DEFAULT_CHART_PERIOD;
        panel.dataset.loaded = "";
        await loadChartPanel(panel, { period: panel.dataset.period, force: true });
      });
    });
  }

  async function loadMarket(container, market) {
    activeMarket = market;
    const listEl = container.querySelector("#chart-list");
    const statusEl = container.querySelector("#chart-status");

    container.querySelectorAll(".chart-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.market === market);
    });

    listEl.innerHTML = `<p class="chart-loading">시세를 불러오는 중…<br><span class="chart-loading-hint">Render 무료 서버 첫 요청은 최대 1분 걸릴 수 있습니다.</span></p>`;
    if (statusEl) statusEl.hidden = true;

    try {
      const data = await fetchMarketTop10(market);
      renderList(container, data);
    } catch (err) {
      if (err.name === "AbortError") return;
      renderList(container, {
        market,
        segmentTitle: CHART_MARKETS.find((m) => m.id === market)?.label,
        items: fallbackItems(market),
        error: formatFetchError(err, getApiBase())
      });
    }
  }

  function renderPage(container) {
    fontScale = readFontScale();
    container.innerHTML = `
      <article class="content-panel chart-panel-page">
        <div class="chart-page-head">
          <div class="chart-page-head-text">
            <h2>Chart</h2>
            <p class="chart-intro">시가총액 상위 10개 종목의 현재 시세와 일봉 차트(최대 6개월)를 확인합니다.</p>
          </div>
          <div class="chart-font-controls" aria-label="글자 크기">
            <button type="button" class="chart-font-btn" id="chart-font-down" aria-label="글자 작게">−</button>
            <button type="button" class="chart-font-btn" id="chart-font-up" aria-label="글자 크게">+</button>
          </div>
        </div>
        <div class="chart-tabs" role="tablist" aria-label="시장 선택">
          ${CHART_MARKETS.map(
            (m) =>
              `<button type="button" class="chart-tab stock-tab${m.id === activeMarket ? " active" : ""}" data-market="${m.id}" role="tab">${m.label}</button>`
          ).join("")}
        </div>
        <p id="chart-status" class="chart-status" hidden></p>
        <div id="chart-list" class="chart-list"></div>
        <p class="chart-footnote">시세·차트 데이터는 Yahoo Finance(yfinance) 기준이며 참고용입니다. 투자 권유가 아닙니다.</p>
      </article>
    `;

    const root = container.querySelector(".chart-panel-page") || container;
    applyFontScale(root);
    bindFontControls(root);
    root.querySelectorAll(".chart-tab").forEach((btn) => {
      btn.addEventListener("click", () => loadMarket(root, btn.dataset.market));
    });

    loadMarket(root, activeMarket);
  }

  function destroy() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    chartDataCache.clear();
  }

  window.Chart = {
    renderPage,
    destroy
  };
})();
